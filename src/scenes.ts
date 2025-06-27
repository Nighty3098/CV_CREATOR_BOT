// Здесь будут реализованы все основные сценарии и логика бота по ТЗ

import { Scenes, Markup } from "telegraf";
import { BotContext } from "./bot.context";
import {
  PAYMENT_INFO,
  ADMIN_CHAT_ID,
  PRICE_EXAMPLE,
  PRICE_EXAMPLE_VIDEO,
  PRICE_REVIEW,
  PRICE_REVIEW_EXAMPLES,
  PRICE_FULL_JUNIOR,
  PRICE_FULL_PRO,
  PRICE_FULL_LEAD,
  PRICE_UPSELL_VIDEO,
  PRICE_UPSELL_EXAMPLES,
} from "./constants";
import {
  isValidEmail,
  isValidImageFile,
  isValidResumeFile,
  generateOrderId,
  isCommand,
  isEmptyText,
  isTooLongText,
  isFileTooLarge,
  isSkipButton,
} from "./utils";
import { sendAdminEmail } from "./email";
import { orders } from "./index";
import { Order } from "./types";
import { MESSAGES } from "./messages";

export const mainMenuScene = new Scenes.BaseScene<BotContext>("mainMenu");

mainMenuScene.enter((ctx) => {
  ctx.reply(
    MESSAGES.mainMenu,
    { ...Markup.keyboard([
      [MESSAGES.buttons.exampleResume, MESSAGES.buttons.infoExample],
      [MESSAGES.buttons.reviewResume, MESSAGES.buttons.infoReview],
      [MESSAGES.buttons.fullResume, MESSAGES.buttons.infoFull],
      [MESSAGES.buttons.exit],
    ]).resize(), parse_mode: 'HTML' }
  );
});

// --- Обработка info-кнопок главного меню ---
mainMenuScene.hears(MESSAGES.buttons.infoExample, async (ctx) => {
  (ctx.session as any).mainMenuInfoSelected = "example";
  await ctx.reply(
    MESSAGES.mainMenuInfo.example,
    { ...Markup.keyboard([
      ["⬅️ Назад к меню", "✅ Выбрать эту услугу"]
    ]).resize(), parse_mode: 'HTML' }
  );
});
mainMenuScene.hears(MESSAGES.buttons.infoReview, async (ctx) => {
  (ctx.session as any).mainMenuInfoSelected = "review";
  await ctx.reply(
    MESSAGES.mainMenuInfo.review,
    { ...Markup.keyboard([
      ["⬅️ Назад к меню", "✅ Выбрать эту услугу"]
    ]).resize(), parse_mode: 'HTML' }
  );
});
mainMenuScene.hears(MESSAGES.buttons.infoFull, async (ctx) => {
  (ctx.session as any).mainMenuInfoSelected = "full";
  await ctx.reply(
    MESSAGES.mainMenuInfo.full,
    { ...Markup.keyboard([
      ["⬅️ Назад к меню", "✅ Выбрать эту услугу"]
    ]).resize(), parse_mode: 'HTML' }
  );
});

// --- Основные кнопки главного меню ---
mainMenuScene.hears(MESSAGES.buttons.exampleResume, (ctx) =>
  ctx.scene.enter("exampleScene"),
);
mainMenuScene.hears(MESSAGES.buttons.reviewResume, (ctx) =>
  ctx.scene.enter("reviewScene"),
);
mainMenuScene.hears(MESSAGES.buttons.fullResume, (ctx) =>
  ctx.scene.enter("fullResumeScene"),
);

mainMenuScene.hears("⬅️ Назад к меню", (ctx) => {
  ctx.scene.reenter();
});
mainMenuScene.hears("✅ Выбрать эту услугу", async (ctx) => {
  const selected = (ctx.session as any).mainMenuInfoSelected;
  if (selected === "example") {
    await ctx.scene.enter("exampleScene");
  } else if (selected === "review") {
    await ctx.scene.enter("reviewScene");
  } else if (selected === "full") {
    await ctx.scene.enter("fullResumeScene");
  } else {
    await ctx.reply("Пожалуйста, выберите услугу из меню.");
    ctx.scene.reenter();
  }
});

// --- Сценарий "Пример резюме из базы" ---
export const exampleScene = new Scenes.WizardScene<BotContext>(
  "exampleScene",
  // Шаг 1: Описание услуги и кнопки
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (mainMenu)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    (ctx.session as any).orderType = "example";
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).upsell = false;
    (ctx.session as any).userId = ctx.from?.id;
    // Сохраняем заказ
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: "example",
      status: "pending",
      price: 0,
      createdAt: new Date(),
      delivery: "telegram",
    } as Order;
    console.log(`[ORDER] Новый заказ: ${(ctx.session as any).orderId}, user: ${ctx.from?.id}, услуга: example`);
    await ctx.reply(
      MESSAGES.exampleResume.description,
      { ...Markup.keyboard([
        ["✅ Да, я хочу Пример идеального резюме"],
        [MESSAGES.buttons.editMainMenu],
      ]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Обработка кнопок и запрос должности
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === "✅ Да, я хочу Пример идеального резюме"
    ) {
      await ctx.reply(
        MESSAGES.exampleResume.requestPosition,
        { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    } else if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.editMainMenu
    ) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    } else {
      await ctx.reply("Пожалуйста, выберите действие с помощью кнопок ниже.", { parse_mode: 'HTML' });
    }
  },
  // Шаг 3: Получение должности
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text !== MESSAGES.buttons.editMainMenu
    ) {
      if (isEmptyText(ctx.message.text)) {
        await ctx.reply("Пожалуйста, введите корректное название должности.", { parse_mode: 'HTML' });
        return;
      }
      if (isTooLongText(ctx.message.text)) {
        await ctx.reply(
          "Слишком длинный текст. Пожалуйста, сократите до 4096 символов.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).position = ctx.message.text.trim();
      await ctx.reply(
        MESSAGES.exampleResume.deliveryChoice,
        { ...Markup.keyboard([
          [MESSAGES.buttons.telegramDelivery],
          [MESSAGES.buttons.emailDelivery],
          [MESSAGES.buttons.back],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    } else if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.editMainMenu
    ) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
    } else {
      await ctx.reply(MESSAGES.common.enterPosition, { parse_mode: 'HTML' });
    }
  },
  // Шаг 4: Выбор способа доставки
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === MESSAGES.buttons.telegramDelivery) {
        (ctx.session as any).delivery = "telegram";
        (ctx.session as any).email = undefined;
        orders[(ctx.session as any).orderId].delivery = "telegram";
        orders[(ctx.session as any).orderId].email = undefined;
      } else if (ctx.message.text === MESSAGES.buttons.emailDelivery) {
        (ctx.session as any).delivery = "email";
        orders[(ctx.session as any).orderId].delivery = "email";
        await ctx.reply(MESSAGES.exampleResume.enterEmail, { parse_mode: 'HTML' });
        return; // не next, ждем email
      } else if (ctx.message.text === MESSAGES.buttons.back) {
        await ctx.scene.reenter();
        return;
      } else if (isValidEmail(ctx.message.text)) {
        (ctx.session as any).delivery = "email";
        (ctx.session as any).email = ctx.message.text.trim();
        orders[(ctx.session as any).orderId].delivery = "email";
        orders[(ctx.session as any).orderId].email = ctx.message.text.trim();
      } else {
        await ctx.reply(MESSAGES.exampleResume.invalidEmail, { parse_mode: 'HTML' });
        return;
      }
      // upsell
      await ctx.reply(
        MESSAGES.exampleResume.upsell(),
        { ...Markup.keyboard([
          [MESSAGES.buttons.addVideoAdvice()],
          [MESSAGES.buttons.onlyExample],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 5: Upsell
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text.startsWith("👍")) {
        (ctx.session as any).upsell = true;
      } else {
        (ctx.session as any).upsell = false;
      }
      // Подтверждение заказа
      let price = (ctx.session as any).upsell
        ? PRICE_EXAMPLE + PRICE_UPSELL_VIDEO
        : PRICE_EXAMPLE;
      if (isNaN(price)) {
        console.error(
          "Ошибка: цена example не определена или не число",
          PRICE_EXAMPLE,
          PRICE_UPSELL_VIDEO,
        );
        await ctx.reply(
          "Ошибка: цена услуги не задана. Пожалуйста, обратитесь к администратору.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).price = price;
      await ctx.reply(
        MESSAGES.exampleResume.orderSummary(
          (ctx.session as any).position,
          (ctx.session as any).delivery,
          (ctx.session as any).email || "",
          (ctx.session as any).upsell,
          price,
        ),
        { ...Markup.keyboard([
          [MESSAGES.buttons.confirm],
          [MESSAGES.buttons.editOrder],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 6: Подтверждение заказа
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === MESSAGES.buttons.confirm) {
        await ctx.reply(
          MESSAGES.exampleResume.paymentInstructions(
            (ctx.session as any).price,
          ),
          { ...Markup.keyboard([[MESSAGES.buttons.attachReceipt]]).resize(), parse_mode: 'HTML' }
        );
        return ctx.wizard.next();
      } else if (ctx.message.text === MESSAGES.buttons.editOrder) {
        await ctx.scene.reenter();
      } else {
        await ctx.reply(MESSAGES.common.confirmOrder, { parse_mode: 'HTML' });
      }
    }
  },
  // Шаг 7: Ожидание оплаты и загрузка чека
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (exampleScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message && ctx.message.text === MESSAGES.buttons.editMainMenu) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} нажал 'в Главное меню' после orderAccepted (exampleScene)`);
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.attachReceipt
    ) {
      await ctx.reply(MESSAGES.exampleResume.attachReceipt, { parse_mode: 'HTML' });
      return;
    }
    if (ctx.message && "photo" in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      if (isFileTooLarge(photo.file_size || 0, 50)) {
        await ctx.reply("Файл слишком большой. Максимальный размер — 50 МБ.", { parse_mode: 'HTML' });
        return;
      }
      (ctx.session as any).receiptFileId = photo.file_id;
      await ctx.reply(
        MESSAGES.exampleResume.orderAccepted((ctx.session as any).orderId),
        { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' },
      );
      const adminMsg = MESSAGES.exampleResume.adminNotification(
        (ctx.session as any).orderId,
        ctx.from?.first_name || "",
        ctx.from?.username || "",
        (ctx.session as any).userId,
        (ctx.session as any).position,
        (ctx.session as any).delivery,
        (ctx.session as any).email || "",
        (ctx.session as any).upsell,
        (ctx.session as any).price,
      );
      await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
        caption: adminMsg,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔗 Отправить ссылку",
                callback_data: `send_link_${(ctx.session as any).orderId}_${(ctx.session as any).userId}`,
              },
            ],
          ],
        },
      });
      // Отправляем файл резюме админу
      if ((ctx.session as any).fileId) {
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          (ctx.session as any).fileId,
          {
            caption: `Файл резюме пользователя: ${(ctx.session as any).fileName}`,
          },
        );
      }
      await sendAdminEmail(
        `Новый заказ №${(ctx.session as any).orderId}`,
        adminMsg,
      );
      return ctx.scene.leave();
    } else if (ctx.message && "document" in ctx.message) {
      if (
        ctx.message.document &&
        isValidImageFile(ctx.message.document.file_name || "")
      ) {
        if (isFileTooLarge(ctx.message.document.file_size || 0, 20)) {
          await ctx.reply("Файл слишком большой. Максимальный размер — 20 МБ.", { parse_mode: 'HTML' });
          return;
        }
        (ctx.session as any).receiptFileId = ctx.message.document.file_id;
        await ctx.reply(
          MESSAGES.exampleResume.orderAccepted((ctx.session as any).orderId),
          { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' },
        );
        const adminMsg = MESSAGES.exampleResume.adminNotification(
          (ctx.session as any).orderId,
          ctx.from?.first_name || "",
          ctx.from?.username || "",
          (ctx.session as any).userId,
          (ctx.session as any).position,
          (ctx.session as any).delivery,
          (ctx.session as any).email || "",
          (ctx.session as any).upsell,
          (ctx.session as any).price,
        );
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          ctx.message.document.file_id,
          {
            caption: adminMsg,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Отправить ссылку",
                    callback_data: `send_link_${(ctx.session as any).orderId}_${(ctx.session as any).userId}`,
                  },
                ],
              ],
            },
          },
        );
        // Отправляем файл резюме админу
        if ((ctx.session as any).fileId) {
          await ctx.telegram.sendDocument(
            ADMIN_CHAT_ID,
            (ctx.session as any).fileId,
            {
              caption: `Файл резюме пользователя: ${(ctx.session as any).fileName}`,
            },
          );
        }
        await sendAdminEmail(
          `Новый заказ №${(ctx.session as any).orderId}`,
          adminMsg,
        );
        return ctx.scene.leave();
      } else {
        await ctx.reply(
          "Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).",
          { parse_mode: 'HTML' }
        );
      }
    } else {
      await ctx.reply(
        "Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).",
        { parse_mode: 'HTML' }
      );
    }
  },
);

// --- Сценарий "Разбор-прожарка резюме" ---
export const reviewScene = new Scenes.WizardScene<BotContext>(
  "reviewScene",
  // Шаг 1: Описание услуги
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    ) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    (ctx.session as any).orderType = "review";
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).upsell = false;
    (ctx.session as any).userId = ctx.from?.id;
    // Сохраняем заказ
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: "review",
      status: "pending",
      price: 0,
      createdAt: new Date(),
      delivery: "telegram",
    } as Order;
    await ctx.reply(
      MESSAGES.reviewResume.description,
      { ...Markup.keyboard([
        [MESSAGES.buttons.startReview],
        [MESSAGES.buttons.backToMenu],
      ]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Загрузка файла
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    ) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.backToMenu
    ) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.startReview
    ) {
      await ctx.reply(MESSAGES.reviewResume.attachFile, Markup.removeKeyboard());
      return;
    }
    if (ctx.message && "document" in ctx.message) {
      const fileName = ctx.message.document.file_name || "";
      if (!isValidResumeFile(fileName)) {
        await ctx.reply(MESSAGES.reviewResume.invalidFile, { parse_mode: 'HTML' });
        return;
      }
      if (
        ctx.message.document.file_size &&
        ctx.message.document.file_size > 20 * 1024 * 1024
      ) {
        await ctx.reply("Файл слишком большой. Максимальный размер — 20 МБ.", { parse_mode: 'HTML' });
        return;
      }
      (ctx.session as any).fileId = ctx.message.document.file_id;
      (ctx.session as any).fileName = fileName;
      await ctx.reply(
        MESSAGES.reviewResume.enterPosition,
        Markup.removeKeyboard(),
      );
      return ctx.wizard.next();
    }
    if (ctx.message && "photo" in ctx.message) {
      await ctx.reply(
        "Пожалуйста, отправьте файл резюме в формате .doc, .docx или .pdf, а не фото.",
        { parse_mode: 'HTML' }
      );
      return;
    }
    if (ctx.message && "text" in ctx.message) {
      if (!ctx.message.text.trim()) {
        await ctx.reply("Пожалуйста, прикрепите файл с резюме.", { parse_mode: 'HTML' });
        return;
      }
      await ctx.reply("Пожалуйста, прикрепите файл с резюме.", { parse_mode: 'HTML' });
      return;
    }
    await ctx.reply(MESSAGES.common.attachFile, { parse_mode: 'HTML' });
  },
  // Шаг 3: Сбор дополнительной информации (3 вопроса)
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    ) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.skip
    ) {
      (ctx.session as any).position = MESSAGES.common.no;
      await ctx.reply(
        MESSAGES.reviewResume.enterVacancy,
        { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    if (ctx.message && "text" in ctx.message) {
      if (!ctx.message.text.trim()) {
        await ctx.reply("Пожалуйста, введите должность.", { parse_mode: 'HTML' });
        return;
      }
      if (ctx.message.text.length > 4096) {
        await ctx.reply(
          "Слишком длинный текст. Пожалуйста, сократите до 4096 символов.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).position = ctx.message.text.trim();
      await ctx.reply(
        MESSAGES.reviewResume.enterVacancy,
        { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    await ctx.reply(MESSAGES.common.enterPositionPrompt, { parse_mode: 'HTML' });
  },
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    ) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.skip
    ) {
      (ctx.session as any).vacancyUrl = MESSAGES.common.no;
      await ctx.reply(
        MESSAGES.reviewResume.enterComment,
        { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text.length > 4096) {
        await ctx.reply(
          "Слишком длинный текст. Пожалуйста, сократите до 4096 символов.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).vacancyUrl = ctx.message.text.trim();
      await ctx.reply(
        MESSAGES.reviewResume.enterComment,
        { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    await ctx.reply(MESSAGES.common.enterVacancy, { parse_mode: 'HTML' });
  },
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text.startsWith("/")
    ) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.skip
    ) {
      (ctx.session as any).comment = MESSAGES.common.no;
      // upsell
      await ctx.reply(
        MESSAGES.reviewResume.upsell(),
        { ...Markup.keyboard([
          [MESSAGES.buttons.addExamples()],
          [MESSAGES.buttons.onlyReview],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text.length > 4096) {
        await ctx.reply(
          "Слишком длинный текст. Пожалуйста, сократите до 4096 символов.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).comment = ctx.message.text.trim();
      // upsell
      await ctx.reply(
        MESSAGES.reviewResume.upsell(),
        { ...Markup.keyboard([
          [MESSAGES.buttons.addExamples()],
          [MESSAGES.buttons.onlyReview],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    await ctx.reply(MESSAGES.common.enterComment, { parse_mode: 'HTML' });
  },
  // Шаг 4: Upsell
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text.startsWith("👍")) {
        (ctx.session as any).upsell = true;
      } else {
        (ctx.session as any).upsell = false;
      }
      // Подтверждение заказа
      let price = (ctx.session as any).upsell
        ? PRICE_REVIEW + PRICE_UPSELL_EXAMPLES
        : PRICE_REVIEW;
      if (isNaN(price)) {
        console.error(
          "Ошибка: цена review не определена или не число",
          PRICE_REVIEW,
          PRICE_UPSELL_EXAMPLES,
        );
        await ctx.reply(
          "Ошибка: цена услуги не задана. Пожалуйста, обратитесь к администратору.",
          { parse_mode: 'HTML' }
        );
        return;
      }
      (ctx.session as any).price = price;
      await ctx.reply(
        MESSAGES.reviewResume.orderSummary(
          (ctx.session as any).fileName,
          (ctx.session as any).position,
          (ctx.session as any).upsell,
          price,
        ),
        { ...Markup.keyboard([
          [MESSAGES.buttons.confirmPayment],
          [MESSAGES.buttons.startOver],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 5: Подтверждение заказа
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === MESSAGES.buttons.confirmPayment) {
        await ctx.reply(
          MESSAGES.exampleResume.paymentInstructions(
            (ctx.session as any).price,
          ),
          { ...Markup.keyboard([[MESSAGES.buttons.attachReceipt]]).resize(), parse_mode: 'HTML' }
        );
        return ctx.wizard.next();
      } else if (ctx.message.text === MESSAGES.buttons.startOver) {
        await ctx.scene.reenter();
      } else {
        await ctx.reply(MESSAGES.common.confirmOrderOrRestart, { parse_mode: 'HTML' });
      }
    }
  },
  // Шаг 6: Ожидание оплаты и загрузка чека
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (reviewScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message && ctx.message.text === MESSAGES.buttons.editMainMenu) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} нажал 'в Главное меню' после orderAccepted (reviewScene)`);
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.attachReceipt
    ) {
      await ctx.reply(MESSAGES.exampleResume.attachReceipt, { parse_mode: 'HTML' });
      return;
    }
    if (ctx.message && "photo" in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      (ctx.session as any).receiptFileId = photo.file_id;
      await ctx.reply(
        MESSAGES.reviewResume.orderAccepted((ctx.session as any).orderId),
        { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' },
      );
      const adminMsg = MESSAGES.reviewResume.adminNotification(
        (ctx.session as any).orderId,
        ctx.from?.first_name || "",
        ctx.from?.username || "",
        (ctx.session as any).userId,
        (ctx.session as any).fileName,
        (ctx.session as any).position,
        (ctx.session as any).vacancyUrl,
        (ctx.session as any).comment,
        (ctx.session as any).upsell,
        (ctx.session as any).price,
      );
      await ctx.telegram.sendPhoto(ADMIN_CHAT_ID, photo.file_id, {
        caption: adminMsg,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔗 Отправить ссылку",
                callback_data: `send_link_${(ctx.session as any).orderId}_${(ctx.session as any).userId}`,
              },
            ],
          ],
        },
      });
      // Отправляем файл резюме админу
      if ((ctx.session as any).fileId) {
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          (ctx.session as any).fileId,
          {
            caption: `Файл резюме пользователя: ${(ctx.session as any).fileName}`,
          },
        );
      }
      await sendAdminEmail(
        `Новый заказ №${(ctx.session as any).orderId}`,
        adminMsg,
      );
      return ctx.scene.leave();
    } else if (ctx.message && "document" in ctx.message) {
      if (
        ctx.message.document &&
        isValidImageFile(ctx.message.document.file_name || "")
      ) {
        (ctx.session as any).receiptFileId = ctx.message.document.file_id;
        await ctx.reply(
          MESSAGES.reviewResume.orderAccepted((ctx.session as any).orderId),
          { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' },
        );
        const adminMsg = MESSAGES.reviewResume.adminNotification(
          (ctx.session as any).orderId,
          ctx.from?.first_name || "",
          ctx.from?.username || "",
          (ctx.session as any).userId,
          (ctx.session as any).fileName,
          (ctx.session as any).position,
          (ctx.session as any).vacancyUrl,
          (ctx.session as any).comment,
          (ctx.session as any).upsell,
          (ctx.session as any).price,
        );
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          ctx.message.document.file_id,
          {
            caption: adminMsg,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔗 Отправить ссылку",
                    callback_data: `send_link_${(ctx.session as any).orderId}_${(ctx.session as any).userId}`,
                  },
                ],
              ],
            },
          },
        );
        // Отправляем файл резюме админу
        if ((ctx.session as any).fileId) {
          await ctx.telegram.sendDocument(
            ADMIN_CHAT_ID,
            (ctx.session as any).fileId,
            {
              caption: `Файл резюме пользователя: ${(ctx.session as any).fileName}`,
            },
          );
        }
        await sendAdminEmail(
          `Новый заказ №${(ctx.session as any).orderId}`,
          adminMsg,
        );
        return ctx.scene.leave();
      } else {
        await ctx.reply(
          "Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).",
          { parse_mode: 'HTML' }
        );
      }
    } else {
      await ctx.reply(MESSAGES.common.attachReceipt, { parse_mode: 'HTML' });
    }
  },
);

// Заглушки для wizard-сцен (будут реализованы далее)
export const fullResumeScene = new Scenes.WizardScene<BotContext>(
  "fullResumeScene",
  // Шаг 1: Описание услуги и выбор тарифа
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && isCommand(ctx.message.text)) {
      console.log(`[SCENE] Пользователь ${ctx.from?.id} начал новую команду (fullResumeScene)`);
      await ctx.reply("Вы начали новую команду. Возвращаю в главное меню.", { parse_mode: 'HTML' });
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "text" in ctx.message && ctx.message.text === MESSAGES.buttons.backToMenu) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    (ctx.session as any).orderType = "full";
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).userId = ctx.from?.id;
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: "full",
      status: "pending",
      price: 0,
      createdAt: new Date(),
      delivery: "telegram",
    } as Order;
    await ctx.reply(
      MESSAGES.fullResume.description,
      { ...Markup.keyboard([
        [MESSAGES.buttons.selectTariff],
        [MESSAGES.buttons.backToMenu],
      ]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Выбор тарифа
  async (ctx) => {
    if (
      ctx.message &&
      "text" in ctx.message &&
      ctx.message.text === MESSAGES.buttons.selectTariff
    ) {
      await ctx.reply(
        MESSAGES.fullResume.tariffSelection,
        { ...Markup.keyboard([
          [MESSAGES.buttons.juniorTariff(), MESSAGES.buttons.infoJunior],
          [MESSAGES.buttons.proTariff(), MESSAGES.buttons.infoPro],
          [MESSAGES.buttons.leadTariff(), MESSAGES.buttons.infoLead],
          [MESSAGES.buttons.back],
        ]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    if (ctx.message && "text" in ctx.message && ctx.message.text === MESSAGES.buttons.backToMenu) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    // Обработка кнопок информации о тарифах
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === MESSAGES.buttons.infoJunior) {
        (ctx.session as any).tariffInfoSelected = "junior";
        await ctx.reply(
          MESSAGES.fullResume.juniorInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.infoPro) {
        (ctx.session as any).tariffInfoSelected = "pro";
        await ctx.reply(
          MESSAGES.fullResume.proInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.infoLead) {
        (ctx.session as any).tariffInfoSelected = "lead";
        await ctx.reply(
          MESSAGES.fullResume.leadInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.backToTariffList) {
        await ctx.reply(
          MESSAGES.fullResume.tariffSelection,
          { ...Markup.keyboard([
            [MESSAGES.buttons.juniorTariff(), MESSAGES.buttons.infoJunior],
            [MESSAGES.buttons.proTariff(), MESSAGES.buttons.infoPro],
            [MESSAGES.buttons.leadTariff(), MESSAGES.buttons.infoLead],
            [MESSAGES.buttons.back],
          ]).resize(), parse_mode: 'HTML' }
        );
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.closeTariffInfo) {
        await ctx.reply(
          MESSAGES.fullResume.tariffSelection,
          { ...Markup.keyboard([
            [MESSAGES.buttons.juniorTariff(), MESSAGES.buttons.infoJunior],
            [MESSAGES.buttons.proTariff(), MESSAGES.buttons.infoPro],
            [MESSAGES.buttons.leadTariff(), MESSAGES.buttons.infoLead],
            [MESSAGES.buttons.back],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor - 1);
        return;
      }
      // Добавляю обработку кнопки 'Выбрать этот тариф' на этом шаге
      if (ctx.message.text === MESSAGES.buttons.selectThisTariff) {
        const selected = (ctx.session as any).tariffInfoSelected;
        let tariff = "";
        let price = 0;
        if (selected === "junior") {
          tariff = "junior";
          price = PRICE_FULL_JUNIOR;
        } else if (selected === "pro") {
          tariff = "pro";
          price = PRICE_FULL_PRO;
        } else if (selected === "lead") {
          tariff = "lead";
          price = PRICE_FULL_LEAD;
        } else {
          await ctx.reply(MESSAGES.common.selectTariff, { parse_mode: 'HTML' });
          return;
        }
        (ctx.session as any).tariff = tariff;
        (ctx.session as any).price = price;
        await ctx.reply(
          'Прикрепите ваше старое резюме, если оно есть. Если нет — пропустите.',
          { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
        );
        return ctx.wizard.next();
      }
    }
  },
  // Шаг 3.1: Вопрос 1 — старое резюме
  async (ctx) => {
    // Обработка info-кнопок и выбора тарифа из инфо
    if (ctx.message && "text" in ctx.message) {
      // --- Информация о тарифах ---
      if (ctx.message.text === MESSAGES.buttons.infoJunior) {
        (ctx.session as any).tariffInfoSelected = "junior";
        await ctx.reply(
          MESSAGES.fullResume.juniorInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.infoPro) {
        (ctx.session as any).tariffInfoSelected = "pro";
        await ctx.reply(
          MESSAGES.fullResume.proInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      if (ctx.message.text === MESSAGES.buttons.infoLead) {
        (ctx.session as any).tariffInfoSelected = "lead";
        await ctx.reply(
          MESSAGES.fullResume.leadInfo,
          { ...Markup.keyboard([
            [MESSAGES.buttons.backToTariffList, MESSAGES.buttons.selectThisTariff],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor);
        return;
      }
      // --- Кнопка 'Назад к тарифам' ---
      if (ctx.message.text === MESSAGES.buttons.backToTariffList) {
        await ctx.reply(
          MESSAGES.fullResume.tariffSelection,
          { ...Markup.keyboard([
            [MESSAGES.buttons.juniorTariff(), MESSAGES.buttons.infoJunior],
            [MESSAGES.buttons.proTariff(), MESSAGES.buttons.infoPro],
            [MESSAGES.buttons.leadTariff(), MESSAGES.buttons.infoLead],
            [MESSAGES.buttons.back],
          ]).resize(), parse_mode: 'HTML' }
        );
        ctx.wizard.selectStep(ctx.wizard.cursor - 1);
        return;
      }
      // --- Кнопка 'Выбрать этот тариф' ---
      if (ctx.message.text === MESSAGES.buttons.selectThisTariff) {
        const selected = (ctx.session as any).tariffInfoSelected;
        let tariff = "";
        let price = 0;
        if (selected === "junior") {
          tariff = "junior";
          price = PRICE_FULL_JUNIOR;
        } else if (selected === "pro") {
          tariff = "pro";
          price = PRICE_FULL_PRO;
        } else if (selected === "lead") {
          tariff = "lead";
          price = PRICE_FULL_LEAD;
        } else {
          await ctx.reply(MESSAGES.common.selectTariff, { parse_mode: 'HTML' });
          return;
        }
        (ctx.session as any).tariff = tariff;
        (ctx.session as any).price = price;
        await ctx.reply(
          'Прикрепите ваше старое резюме, если оно есть. Если нет — пропустите.',
          { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
        );
        return ctx.wizard.next();
      }
      // --- Обычный выбор тарифа ---
      let tariff = "";
      let price = 0;
      if (ctx.message.text === MESSAGES.buttons.juniorTariff()) {
        tariff = "junior";
        price = PRICE_FULL_JUNIOR;
      } else if (ctx.message.text === MESSAGES.buttons.proTariff()) {
        tariff = "pro";
        price = PRICE_FULL_PRO;
      } else if (ctx.message.text === MESSAGES.buttons.leadTariff()) {
        tariff = "lead";
        price = PRICE_FULL_LEAD;
      } else if (ctx.message.text === MESSAGES.buttons.back) {
        await ctx.scene.reenter();
        return;
      } else {
        await ctx.reply(MESSAGES.common.selectTariff, { parse_mode: 'HTML' });
        return;
      }
      (ctx.session as any).tariff = tariff;
      (ctx.session as any).price = price;
      await ctx.reply(
        'Прикрепите ваше старое резюме, если оно есть. Если нет — пропустите.',
        { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    await ctx.reply(MESSAGES.common.selectTariff, { parse_mode: 'HTML' });
  },
  // Шаг 3.2: Вопрос 2 — вакансия/должность
  async (ctx) => {
    if (ctx.message && "document" in ctx.message) {
      (ctx.session as any).oldResumeFileId = ctx.message.document.file_id;
      (ctx.session as any).oldResumeFileName = ctx.message.document.file_name;
    } else if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === MESSAGES.buttons.skip) {
        (ctx.session as any).oldResumeFileId = undefined;
        (ctx.session as any).oldResumeFileName = undefined;
      } else {
        (ctx.session as any).oldResumeFileId = undefined;
        (ctx.session as any).oldResumeFileName = undefined;
      }
    }
    await ctx.reply(
      'Укажите ссылку на желаемую вакансию или название должности, на которую претендуете.',
      { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 3.3: Вопрос 3 — пожелания
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      (ctx.session as any).vacancyUrl = ctx.message.text === MESSAGES.buttons.skip ? undefined : ctx.message.text.trim();
    }
    await ctx.reply(
      'Если есть дополнительные пожелания к будущему резюме, напишите их здесь. Если нет — нажмите пропустить.',
      { ...Markup.keyboard([[MESSAGES.buttons.skip]]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 4: Блок с календарём и оплатой
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      (ctx.session as any).comment = ctx.message.text === MESSAGES.buttons.skip ? undefined : ctx.message.text.trim();
    }
    await ctx.reply(
      'Спасибо! Следующий шаг — часовое онлайн интервью.\nВ ходе интервью я соберу всю необходимую информацию и раскрою ваш опыт.\n\nВыберите время в календаре по ссылке и внесите оплату\n\n❗️Важно: Интервью начинается строго в назначенное время и не переносится. Предоплата за бронирование не возвращается в случае вашей неявки.',
      { ...Markup.keyboard([["Я готов получить ссылку на календарь"]]).resize(), parse_mode: 'HTML' }
    );
    return ctx.wizard.next();
  },
  // Шаг 5: Запись на интервью
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === "Я готов получить ссылку на календарь") {
      await ctx.reply(
        '1. Выберите время в календаре по ссылке\n2. оплатите встречу\n3. сделайте скриншот покупки\n\nhttps://planerka.app/andrey-gunyavin',
        { ...Markup.keyboard([["📸 Я записался(ась)"]]).resize(), parse_mode: 'HTML' }
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, нажмите кнопку ниже, чтобы получить ссылку на календарь.', { ...Markup.keyboard([["Я готов получить ссылку на календарь"]]).resize(), parse_mode: 'HTML' });
  },
  // Шаг 6: Подтверждение времени
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === "📸 Я записался(ась)") {
      await ctx.reply(
        'Супер! Укажите, пожалуйста, день и время, на которое вы записались.\nЭто нужно для синхронизации данных между календарем и ботом',
        { parse_mode: 'HTML', ...Markup.removeKeyboard() }
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, нажмите кнопку ниже, когда запишетесь.', { ...Markup.keyboard([["📸 Я записался(ась)"]]).resize(), parse_mode: 'HTML' });
  },
  // Шаг 7: Ожидание времени и загрузка чека
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      (ctx.session as any).interviewTime = ctx.message.text.trim();
      await ctx.reply('Завершающий шаг. Прикрепите, пожалуйста, скриншот или фото чека', { parse_mode: 'HTML' });
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, укажите дату и время вашей записи.', { parse_mode: 'HTML' });
  },
  // Шаг 8: Ожидание файла (только изображение)
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === MESSAGES.buttons.editMainMenu) {
      await ctx.scene.leave();
      await ctx.scene.enter("mainMenu");
      return;
    }
    if (ctx.message && "photo" in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      (ctx.session as any).finalReceiptFileId = photo.file_id;
      await ctx.reply('Запись произведена. До встречи. Ссылка на встречу будет выслана в ваш Телеграмм за 5 минут до её начала', 
        { ...Markup.keyboard([[MESSAGES.buttons.editMainMenu]]).resize(), parse_mode: 'HTML' }
      );
      // Уведомление админу о полной оплате
      const adminMsg = `Поступила полная оплата по заказу №${(ctx.session as any).orderId}. Необходимо начать работу.

Информация о заказе:
-----------------
Тариф: ${((ctx.session as any).tariff === 'junior') ? 'Исполнитель' : (ctx.session as any).tariff === 'pro' ? 'Профи' : (ctx.session as any).tariff === 'lead' ? 'Руководитель' : '—'}
🗂 Старое резюме: ${(ctx.session as any).oldResumeFileName ? `Прикреплено (${(ctx.session as any).oldResumeFileName})` : 'Не предоставлено'}
🎯 Желаемая вакансия/должность: ${(ctx.session as any).vacancyUrl || 'Не указано'}
📝 Дополнительные пожелания: ${(ctx.session as any).comment || 'Не указано'}
📅 Время интервью: ${(ctx.session as any).interviewTime}
-----------------`;

      await ctx.telegram.sendPhoto(
        ADMIN_CHAT_ID,
        photo.file_id,
        {
          caption: adminMsg,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔗 Отправить ссылку', callback_data: `send_link_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` },
                { text: '📂 Отправить документ', callback_data: `send_doc_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` },
              ],
            ],
          },
        }
      );

      // Если есть старое резюме, отправляем его отдельным сообщением
      if ((ctx.session as any).oldResumeFileId) {
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          (ctx.session as any).oldResumeFileId,
          {
            caption: `Старое резюме клиента (заказ №${(ctx.session as any).orderId})`,
          }
        );
      }

      await sendAdminEmail(`Полная оплата №${(ctx.session as any).orderId}`, adminMsg);
      return ctx.scene.leave();
    } else if (ctx.message && "document" in ctx.message) {
      await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).', { parse_mode: 'HTML' });
    } else {
      await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).', { parse_mode: 'HTML' });
    }
  },
);

export {};
