import { config } from 'dotenv';
config();

import { Telegraf, session, Scenes, Markup } from 'telegraf';
import { ADMIN_CHAT_ID } from './constants';
import { generateOrderId } from './utils';
import { mainMenuScene, exampleScene, reviewScene, fullResumeScene } from './scenes';
import { BotContext } from './bot.context';
import { sendAdminEmail, sendClientEmail } from './email';
import { Order } from './types';
import axios from 'axios';
import express, { Request, Response } from 'express';

export const orders: Record<string, Order> = {};

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

const stage = new Scenes.Stage<BotContext>();
stage.register(mainMenuScene, exampleScene, reviewScene, fullResumeScene);
bot.use(session());
bot.use(stage.middleware());

// Главное меню
function getMainMenu() {
  return Markup.keyboard([
    ['📄 Работа с резюме'],
  ]).resize();
}

bot.start((ctx) => {
  console.log("STARTED: ", ctx.from.username);
  ctx.reply(
    'Добро пожаловать! Я помогу вам с резюме.\n\nВыберите действие:',
    getMainMenu()
  );
});

bot.hears('📄 Работа с резюме', (ctx) => ctx.scene.enter('mainMenu'));

// TODO: Подключить все сцены и обработчики

// --- Админ-функционал: анонимная отправка результата клиенту ---
interface PendingAdminAction {
  orderId: string;
  userId: number;
  realUserId: number;
}
const pendingAdminActions = new Map<number, PendingAdminAction>();

bot.on('callback_query', async (ctx) => {
  const callbackQuery = ctx.callbackQuery as any;
  const data = callbackQuery?.data;
  if (!data) return;
  if (data.startsWith('send_result_')) {
    // Только для админа
    if (ctx.from?.id?.toString() !== ADMIN_CHAT_ID) {
      await ctx.answerCbQuery('Нет доступа');
      return;
    }
    // Парсим orderId и userId из callback_data
    const match = data.match(/^send_result_(.+)_(\d+)$/);
    if (!match) {
      await ctx.reply('Ошибка: не удалось определить пользователя. Введите userId клиента:');
      pendingAdminActions.set(ctx.from.id, { orderId: '', userId: 0, realUserId: 0 });
      return;
    }
    const orderId = match[1];
    const userId = Number(match[2]);
    await ctx.reply('Отправьте файл (резюме или видео) для клиента.');
    pendingAdminActions.set(ctx.from.id, { orderId, userId, realUserId: userId });
  }
});

bot.on('message', async (ctx) => {
  // Если админ только что нажал "Отправить файл"
  if (ctx.from?.id?.toString() === ADMIN_CHAT_ID && pendingAdminActions.has(ctx.from.id)) {
    const action = pendingAdminActions.get(ctx.from.id)!;
    // Если ждем userId
    if (action.userId === 0 && ctx.message && 'text' in ctx.message && /^\d+$/.test(ctx.message.text)) {
      action.userId = Number(ctx.message.text);
      action.realUserId = action.userId;
      pendingAdminActions.set(ctx.from.id, action);
      await ctx.reply('Теперь отправьте файл (резюме или видео) для клиента.');
      return;
    }
    // Если ждем файл
    if (action.userId > 0 && ctx.message && ('document' in ctx.message || 'video' in ctx.message)) {
      if ('document' in ctx.message) {
        await ctx.telegram.sendDocument(action.userId, ctx.message.document.file_id, {
          caption: `Ваш файл. ID заказа: ${action.orderId}`
        });
        // Отправка на email, если выбран способ доставки email
        const order = findOrderByOrderId(action.orderId);
        console.log('[DEBUG] order найден:', order);
        if (order && order.delivery === 'email' && order.email) {
          try {
            console.log('[DEBUG] Готовлюсь вызвать sendClientEmail для резюме', order.email, ctx.message.document.file_name);
            const fileUrl = await ctx.telegram.getFileLink(ctx.message.document.file_id);
            const response = await axios.get(fileUrl.toString(), { responseType: 'arraybuffer' });
            await sendClientEmail(order.email, 'Ваше резюме', 'Ваше резюме во вложении. Если возникнут вопросы — пишите!', [
              {
                filename: ctx.message.document.file_name,
                content: Buffer.from(response.data)
              }
            ]);
            console.log(`[EMAIL] Резюме отправлено на ${order.email}`);
          } catch (e) {
            console.error(`[EMAIL ERROR] Не удалось отправить резюме на ${order.email}:`, e);
          }
        }
      } else if ('video' in ctx.message) {
        await ctx.telegram.sendVideo(action.userId, ctx.message.video.file_id, {
          caption: `Ваш видеоразбор. ID заказа: ${action.orderId}`
        });
        // Отправка на email, если выбран способ доставки email
        const order = findOrderByOrderId(action.orderId);
        console.log('[DEBUG] order найден:', order);
        if (order && order.delivery === 'email' && order.email) {
          try {
            console.log('[DEBUG] Готовлюсь вызвать sendClientEmail для видео', order.email);
            const fileUrl = await ctx.telegram.getFileLink(ctx.message.video.file_id);
            const response = await axios.get(fileUrl.toString(), { responseType: 'arraybuffer' });
            await sendClientEmail(order.email, 'Ваш видеоразбор', 'Ваш видеоразбор во вложении. Если возникнут вопросы — пишите!', [
              {
                filename: 'video.mp4',
                content: Buffer.from(response.data)
              }
            ]);
            console.log(`[EMAIL] Видеоразбор отправлен на ${order.email}`);
          } catch (e) {
            console.error(`[EMAIL ERROR] Не удалось отправить видеоразбор на ${order.email}:`, e);
          }
        }
      }
      await ctx.reply('Файл отправлен клиенту. Теперь напишите текстовое сообщение для клиента.');
      action.userId = -1; // Ожидаем текст
      pendingAdminActions.set(ctx.from.id, action);
      return;
    }
    // Если ждем текст
    if (action.userId === -1 && ctx.message && 'text' in ctx.message) {
      await ctx.telegram.sendMessage(action.realUserId, ctx.message.text + '\n\nСсылка на облачное хранилище будет доступна 48 часов, пожалуйста, сохраните файл себе на компьютер.');
      // Отправка текста на email, если выбран способ доставки email
      const order = findOrderByOrderId(action.orderId);
      if (order && order.delivery === 'email' && order.email) {
        await sendClientEmail(order.email, 'Комментарий к вашему заказу', ctx.message.text + '\n\nСсылка на облачное хранилище будет доступна 48 часов, пожалуйста, сохраните файл себе на компьютер.');
      }
      await ctx.reply('Сообщение отправлено клиенту.');
      pendingAdminActions.delete(ctx.from.id);
      return;
    }
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

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
      if (!order.interviewReminded24h) {
        botInstance.telegram.sendMessage(order.userId, `Напоминание: ваше интервью назначено на ${order.interviewTime} (через 24 часа).`);
        botInstance.telegram.sendMessage(ADMIN_CHAT_ID, `Напоминание: интервью с клиентом @${order.username} (${order.userId}) через 24 часа (${order.interviewTime}).`);
        order.interviewReminded24h = true;
      }
    }, msTo24h);
  }
  if (msTo1h > 0) {
    setTimeout(() => {
      if (!order.interviewReminded1h) {
        botInstance.telegram.sendMessage(order.userId, `Напоминание: ваше интервью начнётся через 1 час (${order.interviewTime}).`);
        botInstance.telegram.sendMessage(ADMIN_CHAT_ID, `Напоминание: интервью с клиентом @${order.username} (${order.userId}) через 1 час (${order.interviewTime}).`);
        order.interviewReminded1h = true;
      }
    }, msTo1h);
  }
}

const app = express();
app.use(express.json());

app.post('/calendly-webhook', (req: Request, res: Response) => {
  const { email, name, event_time } = req.body;
  const order = Object.values(orders).find(o => o.email === email || o.username === name);
  if (order) {
    order.interviewTime = event_time;
    scheduleInterviewReminders(order, bot);
    // Уведомление клиенту и админу
    if (order.userId) {
      bot.telegram.sendMessage(order.userId, `Ваше интервью подтверждено на ${event_time}. Если время не подходит — свяжитесь с администратором.`);
    }
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `Клиент @${order.username} (${order.userId}) забронировал интервью на ${event_time} (заказ №${order.id}).`);
    res.status(200).send('ok');
  } else {
    res.status(404).send('order not found');
  }
});

app.listen(3001, () => {
  console.log('Calendly webhook listening on port 3001');
});

export { scheduleInterviewReminders, bot }; 
