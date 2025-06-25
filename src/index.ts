import { config } from "dotenv";
config();

import { Telegraf, session, Scenes, Markup } from "telegraf";
import { ADMIN_CHAT_ID } from "./constants";
import { generateOrderId } from "./utils";
import {
  mainMenuScene,
  exampleScene,
  reviewScene,
  fullResumeScene,
} from "./scenes";
import { BotContext } from "./bot.context";
import { sendAdminEmail, sendClientEmail } from "./email";
import { Order } from "./types";
import { MESSAGES } from "./messages";
import axios from "axios";
import express, { Request, Response } from "express";

export const orders: Record<string, Order> = {};

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

const stage = new Scenes.Stage<BotContext>();
stage.register(mainMenuScene, exampleScene, reviewScene, fullResumeScene);
bot.use(session());
bot.use(stage.middleware());

// Главное меню
function getMainMenu() {
  return Markup.keyboard([[MESSAGES.buttons.workWithResume]]).resize();
}

bot.start((ctx) => {
  console.log(`[START] Пользователь ${ctx.from?.id} (${ctx.from?.username}) запустил бота`);
  ctx.reply(MESSAGES.welcome, { ...getMainMenu(), parse_mode: 'HTML' });
});

bot.hears(MESSAGES.buttons.workWithResume, (ctx) =>
  ctx.scene.enter("mainMenu"),
);

bot.hears(MESSAGES.buttons.editMainMenu, async (ctx) => {
  await ctx.scene.leave();
  await ctx.reply(MESSAGES.welcome, { ...getMainMenu(), parse_mode: 'HTML' });
});

// TODO: Подключить все сцены и обработчики

// --- Админ-функционал: анонимная отправка результата клиенту ---
interface PendingAdminAction {
  orderId: string;
  userId: number;
  realUserId: number;
  type?: string;
}
const pendingAdminActions = new Map<number, PendingAdminAction>();

// Глобальный обработчик ошибок для Telegraf
bot.catch((err, ctx) => {
  console.error('Unhandled error in bot:', err);
  // Не отправляем сообщение пользователю
});

bot.on("callback_query", async (ctx) => {
  try {
    const callbackQuery = ctx.callbackQuery as any;
    const data = callbackQuery?.data;
    if (!data) return;
    if (data === 'go_main_menu') {
      await ctx.answerCbQuery();
      if (ctx.scene && ctx.scene.leave) await ctx.scene.leave();
      await ctx.reply(MESSAGES.welcome, { ...getMainMenu(), parse_mode: 'HTML' });
      return;
    }
    if (data.startsWith("send_result_")) {
      // Только для админа
      if (ctx.from?.id?.toString() !== ADMIN_CHAT_ID) {
        await ctx.answerCbQuery(MESSAGES.admin.noAccess);
        return;
      }
      // Парсим orderId и userId из callback_data
      const match = data.match(/^send_result_(.+)_(\d+)$/);
      if (!match) {
        await ctx.reply(MESSAGES.admin.errorParsingUser);
        pendingAdminActions.set(ctx.from.id, {
          orderId: "",
          userId: 0,
          realUserId: 0,
        });
        return;
      }
      const orderId = match[1];
      const userId = Number(match[2]);
      await ctx.reply(MESSAGES.admin.sendFile);
      pendingAdminActions.set(ctx.from.id, {
        orderId,
        userId,
        realUserId: userId,
      });
    }
    // --- Новый функционал: отправка ссылки и документа клиенту ---
    if (data.startsWith("send_link_")) {
      if (ctx.from?.id?.toString() !== ADMIN_CHAT_ID) {
        await ctx.answerCbQuery(MESSAGES.admin.noAccess);
        return;
      }
      const match = data.match(/^send_link_(.+)_(\d+)$/);
      if (!match) {
        await ctx.reply("Ошибка: не удалось определить заказ или пользователя.");
        return;
      }
      const orderId = match[1];
      const userId = Number(match[2]);
      await ctx.reply("Пожалуйста, отправьте ссылку для клиента.");
      pendingAdminActions.set(ctx.from.id, {
        orderId,
        userId,
        realUserId: userId,
        type: "link"
      });
      return;
    }
    if (data.startsWith("send_doc_")) {
      if (ctx.from?.id?.toString() !== ADMIN_CHAT_ID) {
        await ctx.answerCbQuery(MESSAGES.admin.noAccess);
        return;
      }
      const match = data.match(/^send_doc_(.+)_(\d+)$/);
      if (!match) {
        await ctx.reply("Ошибка: не удалось определить заказ или пользователя.");
        return;
      }
      const orderId = match[1];
      const userId = Number(match[2]);
      await ctx.reply("Пожалуйста, отправьте документ для клиента (PDF, DOCX и т.д.).");
      pendingAdminActions.set(ctx.from.id, {
        orderId,
        userId,
        realUserId: userId,
        type: "doc"
      });
      return;
    }
  } catch (err) {
    console.error('Error in callback_query handler:', err);
    await ctx.reply('Произошла ошибка при обработке запроса. Попробуйте ещё раз.');
  }
});

bot.on("message", async (ctx) => {
  try {
    // Если админ только что нажал "Отправить файл"
    if (
      ctx.from?.id?.toString() === ADMIN_CHAT_ID &&
      pendingAdminActions.has(ctx.from.id)
    ) {
      const action = pendingAdminActions.get(ctx.from.id)!;
      // Если ждем ссылку
      if (action.type === "link" && ctx.message && "text" in ctx.message) {
        try {
          await ctx.telegram.sendMessage(
            action.userId,
            ctx.message.text
          );
          await ctx.reply("Ссылка отправлена клиенту.");
          pendingAdminActions.delete(ctx.from.id);
          return;
        } catch (err) {
          await ctx.reply("Ошибка при отправке ссылки клиенту.");
          pendingAdminActions.delete(ctx.from.id);
          return;
        }
      }
      // Если ждем документ
      if (action.type === "doc" && ctx.message && "document" in ctx.message) {
        try {
          await ctx.telegram.sendDocument(
            action.userId,
            ctx.message.document.file_id,
            {
              caption: "Ваше резюме готово! Ссылка на облачное хранилище будет доступна 48 часов, пожалуйста, сохраните файл себе на компьютер."
            }
          );
          await ctx.reply("Документ отправлен клиенту.");
          pendingAdminActions.delete(ctx.from.id);
          return;
        } catch (err) {
          await ctx.reply("Ошибка при отправке документа клиенту.");
          pendingAdminActions.delete(ctx.from.id);
          return;
        }
      }
      // Если ждем userId
      if (
        action.userId === 0 &&
        ctx.message &&
        "text" in ctx.message &&
        /^\d+$/.test(ctx.message.text)
      ) {
        action.userId = Number(ctx.message.text);
        action.realUserId = action.userId;
        pendingAdminActions.set(ctx.from.id, action);
        await ctx.reply(MESSAGES.admin.sendFile);
        return;
      }
      // Если ждем файл
      if (
        action.userId > 0 &&
        ctx.message &&
        ("document" in ctx.message || "video" in ctx.message)
      ) {
        if ("document" in ctx.message) {
          try {
            await ctx.telegram.sendDocument(
              action.userId,
              ctx.message.document.file_id,
              {
                caption: MESSAGES.client.fileReceived(action.orderId),
              },
            );
            // Отправка на email, если выбран способ доставки email
            const order = findOrderByOrderId(action.orderId);
            console.log("[DEBUG] order найден:", order);
            if (order && order.delivery === "email" && order.email) {
              try {
                console.log(
                  "[DEBUG] Готовлюсь вызвать sendClientEmail для резюме",
                  order.email,
                  ctx.message.document.file_name,
                );
                const fileUrl = await ctx.telegram.getFileLink(
                  ctx.message.document.file_id,
                );
                const response = await axios.get(fileUrl.toString(), {
                  responseType: "arraybuffer",
                });
                await sendClientEmail(
                  order.email,
                  MESSAGES.email.resumeSubject,
                  MESSAGES.email.resumeBody,
                  [
                    {
                      filename: ctx.message.document.file_name,
                      content: Buffer.from(response.data),
                    },
                  ],
                );
                console.log(`[EMAIL] Резюме отправлено на ${order.email}`);
              } catch (e) {
                console.error(
                  `[EMAIL ERROR] Не удалось отправить резюме на ${order.email}:`,
                  e,
                );
              }
            }
          } catch (err) {
            console.error('Error sending document:', err);
            await ctx.reply('Ошибка при отправке файла клиенту.');
          }
        }
        if ("video" in ctx.message) {
          try {
            await ctx.telegram.sendVideo(action.userId, ctx.message.video.file_id, {
              caption: MESSAGES.client.videoReceived(action.orderId),
            });
            // Отправка на email, если выбран способ доставки email
            const order = findOrderByOrderId(action.orderId);
            console.log("[DEBUG] order найден:", order);
            if (order && order.delivery === "email" && order.email) {
              try {
                console.log(
                  "[DEBUG] Готовлюсь вызвать sendClientEmail для видео",
                  order.email,
                );
                const fileUrl = await ctx.telegram.getFileLink(
                  ctx.message.video.file_id,
                );
                const response = await axios.get(fileUrl.toString(), {
                  responseType: "arraybuffer",
                });
                await sendClientEmail(
                  order.email,
                  MESSAGES.email.videoSubject,
                  MESSAGES.email.videoBody,
                  [
                    {
                      filename: "video.mp4",
                      content: Buffer.from(response.data),
                    },
                  ],
                );
                console.log(`[EMAIL] Видеоразбор отправлен на ${order.email}`);
              } catch (e) {
                console.error(
                  `[EMAIL ERROR] Не удалось отправить видеоразбор на ${order.email}:`,
                  e,
                );
              }
            }
          } catch (err) {
            console.error('Error sending video:', err);
            await ctx.reply('Ошибка при отправке видео клиенту.');
          }
        }
        await ctx.reply(MESSAGES.admin.fileSent);
        action.userId = -1; // Ожидаем текст
        pendingAdminActions.set(ctx.from.id, action);
        return;
      }
      // Если ждем текст
      if (action.userId === -1 && ctx.message && "text" in ctx.message) {
        try {
          await ctx.telegram.sendMessage(
            action.realUserId,
            ctx.message.text + MESSAGES.client.fileComment,
          );
          // Отправка текста на email, если выбран способ доставки email
          const order = findOrderByOrderId(action.orderId);
          if (order && order.delivery === "email" && order.email) {
            await sendClientEmail(
              order.email,
              MESSAGES.email.commentSubject,
              ctx.message.text + MESSAGES.client.fileComment,
            );
          }
          await ctx.reply(MESSAGES.admin.messageSent);
          pendingAdminActions.delete(ctx.from.id);
          return;
        } catch (err) {
          console.error('Error sending message to client:', err);
          await ctx.reply('Ошибка при отправке сообщения клиенту.');
        }
      }
    }
  } catch (err) {
    console.error('Error in message handler:', err);
    await ctx.reply('Произошла ошибка при обработке сообщения. Попробуйте ещё раз.');
  }
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// В каждом wizard-сценарии после генерации orderId и заполнения данных заказа:
// orders[orderId] = { ... };

function findOrderByOrderId(orderId: string): Order | undefined {
  return orders[orderId];
}

function scheduleInterviewReminders(order: Order, botInstance: typeof bot) {
  if (!order.interviewTime || !order.userId) return;
  const interviewDate = new Date(order.interviewTime);
  const now = new Date();
  const msTo24h = interviewDate.getTime() - now.getTime() - 24 * 60 * 60 * 1000;
  const msTo1h = interviewDate.getTime() - now.getTime() - 1 * 60 * 60 * 1000;
  if (msTo24h > 0) {
    setTimeout(() => {
      if (!order.interviewReminded24h && order.interviewTime) {
        botInstance.telegram.sendMessage(
          order.userId,
          MESSAGES.admin.interviewReminder24h(order.interviewTime),
        );
        botInstance.telegram.sendMessage(
          ADMIN_CHAT_ID,
          MESSAGES.admin.adminReminder24h(
            order.username || "Unknown",
            order.userId,
            order.interviewTime,
          ),
        );
        order.interviewReminded24h = true;
      }
    }, msTo24h);
  }
  if (msTo1h > 0) {
    setTimeout(() => {
      if (!order.interviewReminded1h && order.interviewTime) {
        botInstance.telegram.sendMessage(
          order.userId,
          MESSAGES.admin.interviewReminder1h(order.interviewTime),
        );
        botInstance.telegram.sendMessage(
          ADMIN_CHAT_ID,
          MESSAGES.admin.adminReminder1h(
            order.username || "Unknown",
            order.userId,
            order.interviewTime,
          ),
        );
        order.interviewReminded1h = true;
      }
    }, msTo1h);
  }
}

const app = express();
app.use(express.json());

app.post("/calendly-webhook", (req: Request, res: Response) => {
  const { email, name, event_time } = req.body;
  const order = Object.values(orders).find(
    (o) => o.email === email || o.username === name,
  );
  if (order) {
    order.interviewTime = event_time;
    scheduleInterviewReminders(order, bot);
    // Уведомление клиенту и админу
    if (order.userId) {
      bot.telegram.sendMessage(
        order.userId,
        MESSAGES.admin.interviewConfirmed(event_time),
      );
    }
    bot.telegram.sendMessage(
      ADMIN_CHAT_ID,
      MESSAGES.admin.adminBookingConfirmation(
        order.username || "Unknown",
        order.userId,
        event_time,
        order.id,
      ),
    );
    res.status(200).send("ok");
  } else {
    res.status(404).send("order not found");
  }
});

app.listen(3001, () => {
  console.log("Calendly webhook listening on port 3001");
});

export { scheduleInterviewReminders, bot };
