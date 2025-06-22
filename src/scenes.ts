// Здесь будут реализованы все основные сценарии и логика бота по ТЗ

import { Scenes, Markup } from 'telegraf';
import { BotContext } from './bot.context';
import { PRICES, PAYMENT_INFO, ADMIN_CHAT_ID } from './constants';
import { isValidEmail, isValidImageFile, isValidResumeFile, generateOrderId } from './utils';
import { sendAdminEmail } from './email';
import { orders } from './index';
import { Order } from './types';

export const mainMenuScene = new Scenes.BaseScene<BotContext>('mainMenu');

mainMenuScene.enter((ctx) => {
  ctx.reply(
    'Выберите услугу:',
    Markup.keyboard([
      ['🛒 Готовое резюме из базы | Андрей! Я сделаю сам!'],
      ['🔍 Разбор-прожарка резюме | Андрей! Помоги мне улучшить!'],
      ['✨ Резюме «Под ключ» | Андрей! Сделай за меня!'],
      ['⬅️ Выйти']
    ]).resize()
  );
});

mainMenuScene.hears('🛒 Готовое резюме из базы | Андрей! Я сделаю сам!', (ctx) => ctx.scene.enter('exampleScene'));
mainMenuScene.hears('🔍 Разбор-прожарка резюме | Андрей! Помоги мне улучшить!', (ctx) => ctx.scene.enter('reviewScene'));
mainMenuScene.hears('✨ Резюме «Под ключ» | Андрей! Сделай за меня!', (ctx) => ctx.scene.enter('fullResumeScene'));
mainMenuScene.hears('⬅️ Выйти', (ctx) => {
  ctx.reply('Выход в главное меню.', Markup.removeKeyboard());
  ctx.scene.leave();
});

// --- Сценарий "Пример резюме из базы" ---
export const exampleScene = new Scenes.WizardScene<BotContext>(
  'exampleScene',
  // Шаг 1: Описание услуги и запрос должности
  async (ctx) => {
    (ctx.session as any).orderType = 'example';
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).upsell = false;
    (ctx.session as any).userId = ctx.from?.id;
    // Сохраняем заказ
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: 'example',
      status: 'pending',
      price: 0,
      createdAt: new Date(),
      delivery: 'telegram',
    } as Order;
    await ctx.reply(
      'Что вы получите:\n\n• реальное, продающее компетенции резюме, которое я составлял под заказ на конкретную должность (без личных данных).\n\nКак это поможет вам:\n• поймёте структуру\n• заимствуете акценты на компетенциях и достижениях\n• сэкономите время\n\nЭто самый доступный способ получить профессиональные наработки и быстро создать сильное резюме.\n\nУкажите название должности для которой нужен Пример идеального резюме.\n\nПишите развернуто и объемно!\n\n✅ Пример: Менеджер по продажам банковских услуг\n✅ Пример: PHP-разработчик (Middle)\n❌ Не писать: Продажник, Программист',
      Markup.keyboard([['✏️ в Главное меню']]).resize()
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Получение должности
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text !== '✏️ в Главное меню') {
      (ctx.session as any).position = ctx.message.text.trim();
      await ctx.reply(
        'Куда отправить готовый пример резюме?',
        Markup.keyboard([
          ['✅ В этот чат в Telegram'],
          ['📧 Отправить на E-mail'],
          ['⬅️ Назад']
        ]).resize()
      );
      return ctx.wizard.next();
    } else if (ctx.message && 'text' in ctx.message && ctx.message.text === '✏️ в Главное меню') {
      await ctx.scene.leave();
      await ctx.scene.enter('mainMenu');
    } else {
      await ctx.reply('Пожалуйста, введите корректное название должности.');
    }
  },
  // Шаг 3: Выбор способа доставки
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (ctx.message.text === '✅ В этот чат в Telegram') {
        (ctx.session as any).delivery = 'telegram';
        (ctx.session as any).email = undefined;
        orders[(ctx.session as any).orderId].delivery = 'telegram';
        orders[(ctx.session as any).orderId].email = undefined;
      } else if (ctx.message.text === '📧 Отправить на E-mail') {
        (ctx.session as any).delivery = 'email';
        orders[(ctx.session as any).orderId].delivery = 'email';
        await ctx.reply('Пожалуйста, введите ваш email:');
        return; // не next, ждем email
      } else if (ctx.message.text === '⬅️ Назад') {
        await ctx.scene.reenter();
        return;
      } else if (isValidEmail(ctx.message.text)) {
        (ctx.session as any).delivery = 'email';
        (ctx.session as any).email = ctx.message.text.trim();
        orders[(ctx.session as any).orderId].delivery = 'email';
        orders[(ctx.session as any).orderId].email = ctx.message.text.trim();
      } else {
        await ctx.reply('Пожалуйста, выберите способ доставки или введите корректный email.');
        return;
      }
      // upsell
      await ctx.reply(
        'Желаете получить дополнительный видео-комментарий в формате видеозаписи? Я расскажу что ОБЯЗАТЕЛЬНО должно быть в резюме на эту должность.',
        Markup.keyboard([
          ['👍 Да, добавить видео-совет (+199₽)'],
          ['Нет, спасибо, только пример']
        ]).resize()
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 4: Upsell
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (ctx.message.text.startsWith('👍')) {
        (ctx.session as any).upsell = true;
      } else {
        (ctx.session as any).upsell = false;
      }
      // Подтверждение заказа
      const price = (ctx.session as any).upsell ? PRICES.exampleWithVideo : PRICES.example;
      (ctx.session as any).price = price;
      await ctx.reply(
        `Ваш заказ:\n\n📄 Пример резюме: ${(ctx.session as any).position}\n📧 Отправить: ${(ctx.session as any).delivery === 'email' ? (ctx.session as any).email : 'Telegram'}\n🗣️ Видео-комментарии: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\n-----------------\nИтого к оплате: ${price} рублей\nСрок исполнения: 24 часа (по рабочим дням).\n\nВсе верно?`,
        Markup.keyboard([
          ['✅ Да, все верно'],
          ['✏️ Изменить заказ']
        ]).resize()
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 5: Подтверждение заказа
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (ctx.message.text === '✅ Да, все верно') {
        await ctx.reply(
          `Для оплаты переведите ${(ctx.session as any).price} рублей одним из удобных способов:\n\n💳 Картой по номеру: [номер карты]\n📞 По номеру телефона (СБП): [номер телефона]\n\nПосле оплаты, пожалуйста, обязательно вернитесь в этот чат и нажмите кнопку ниже, чтобы прикрепить чек.`,
          Markup.keyboard([
            ['📸 Я оплатил(а) и готов(а) прикрепить чек']
          ]).resize()
        );
        return ctx.wizard.next();
      } else if (ctx.message.text === '✏️ Изменить заказ') {
        await ctx.scene.reenter();
      } else {
        await ctx.reply('Пожалуйста, подтвердите заказ или измените его.');
      }
    }
  },
  // Шаг 6: Ожидание оплаты и загрузка чека
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '📸 Я оплатил(а) и готов(а) прикрепить чек') {
      await ctx.reply('Пожалуйста, прикрепите скриншот или фото чека (jpg, jpeg, png).');
      return;
    }
    if (ctx.message && 'photo' in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      (ctx.session as any).receiptFileId = photo.file_id;
      await ctx.reply(
        `Спасибо, чек получен! Ваш заказ №${(ctx.session as any).orderId} принят в работу.\nЯ подберу наиболее подходящий пример резюме и отправлю его вам сюда, в этот чат, в течение 24 часов (в рабочие дни).`,
        Markup.removeKeyboard()
      );
      const adminMsg =
        `🔔 НОВЫЙ ЗАКАЗ №${(ctx.session as any).orderId}: Пример резюме\n-----------------\nКлиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\nТариф: Пример резюме\nДолжность: ${(ctx.session as any).position}\nДоставка: ${(ctx.session as any).delivery === 'email' ? (ctx.session as any).email : 'Telegram'}\nВидео-комментарии: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\nСумма: ${(ctx.session as any).price} рублей\nСтатус: ОПЛАЧЕН\n-----------------`;
      await ctx.telegram.sendPhoto(
        ADMIN_CHAT_ID,
        photo.file_id,
        {
          caption: adminMsg,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📂 Отправить файл', callback_data: `send_result_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` }
              ]
            ]
          }
        }
      );
      await sendAdminEmail(
        `Новый заказ №${(ctx.session as any).orderId}`,
        adminMsg
      );
      return ctx.scene.leave();
    } else if (ctx.message && 'document' in ctx.message) {
      if (ctx.message.document && isValidImageFile(ctx.message.document.file_name || '')) {
        (ctx.session as any).receiptFileId = ctx.message.document.file_id;
        await ctx.reply(
          `Спасибо, чек получен! Ваш заказ №${(ctx.session as any).orderId} принят в работу.\nЯ подберу наиболее подходящий пример резюме и отправлю его вам сюда, в этот чат, в течение 24 часов (в рабочие дни).`,
          Markup.removeKeyboard()
        );
        const adminMsg =
          `🔔 НОВЫЙ ЗАКАЗ №${(ctx.session as any).orderId}: Пример резюме\n-----------------\nКлиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\nТариф: Пример резюме\nДолжность: ${(ctx.session as any).position}\nДоставка: ${(ctx.session as any).delivery === 'email' ? (ctx.session as any).email : 'Telegram'}\nВидео-комментарии: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\nСумма: ${(ctx.session as any).price} рублей\nСтатус: ОПЛАЧЕН\n-----------------`;
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          ctx.message.document.file_id,
          {
            caption: adminMsg,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📂 Отправить файл', callback_data: `send_result_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` }
                ]
              ]
            }
          }
        );
        await sendAdminEmail(
          `Новый заказ №${(ctx.session as any).orderId}`,
          adminMsg
        );
        return ctx.scene.leave();
      } else {
        await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
      }
    } else {
      await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
    }
  }
);

// Заглушки для wizard-сцен (будут реализованы далее)
export const reviewScene = new Scenes.WizardScene<BotContext>(
  'reviewScene',
  // Шаг 1: Описание услуги
  async (ctx) => {
    (ctx.session as any).orderType = 'review';
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).upsell = false;
    (ctx.session as any).userId = ctx.from?.id;
    // Сохраняем заказ
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: 'review',
      status: 'pending',
      price: 0,
      createdAt: new Date(),
      delivery: 'telegram',
    } as Order;
    await ctx.reply(
      'Вы присылаете мне ваше резюме.\nЯ запишу для вас подробный видео-разбор, где на вашем резюме проверю и покажу:\n\n• Правило 7 секунд.\n• Слепые зоны.\n• Точки роста.\n\nПосле этого разбора вы сможете самостоятельно усилить свое резюме.\n\nНажмите «🚀 Начать разбор» или вернитесь в меню.',
      Markup.keyboard([
        ['🚀 Начать разбор'],
        ['⬅️ Назад в меню']
      ]).resize()
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Загрузка файла
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '⬅️ Назад в меню') {
      await ctx.scene.leave();
      await ctx.scene.enter('mainMenu');
      return;
    }
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '🚀 Начать разбор') {
      await ctx.reply('Отлично! Пожалуйста, прикрепите файл с вашим резюме. Поддерживаемые форматы: .doc, .docx, .pdf');
      return;
    }
    if (ctx.message && 'document' in ctx.message) {
      const fileName = ctx.message.document.file_name || '';
      if (!isValidResumeFile(fileName)) {
        await ctx.reply('Пожалуйста, отправьте файл в формате .doc, .docx или .pdf');
        return;
      }
      (ctx.session as any).fileId = ctx.message.document.file_id;
      (ctx.session as any).fileName = fileName;
      await ctx.reply('На какую должность (и в какую сферу) вы претендуете в первую очередь? Это поможет мне сделать разбор максимально точным.');
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, прикрепите файл с резюме.');
  },
  // Шаг 3: Сбор дополнительной информации (3 вопроса)
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).position = ctx.message.text.trim();
      await ctx.reply('Есть ли у вас ссылка на конкретную вакансию мечты? Если да, пришлите ее. Если нет — пропустите.');
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, введите должность.');
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).vacancyUrl = ctx.message.text.trim();
      await ctx.reply('Есть ли что-то, на чем вы бы хотели, чтобы я сделал особый акцент при разборе? Если нет — пропустите.');
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, введите ссылку или напишите "нет".');
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).comment = ctx.message.text.trim();
      // upsell
      await ctx.reply(
        'Спасибо! Видео-разбор покажет ваши ошибки и точки роста. А хотите узнать не только "что исправить", но и "как исправить"?\n🔥 За +199 рублей я дополню разбор примерами идеальных формулировок из успешных резюме для вашей профессии.',
        Markup.keyboard([
          ['👍 Да, с примерами (+199₽)'],
          ['Нет, спасибо, только разбор']
        ]).resize()
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, напишите комментарий или "нет".');
  },
  // Шаг 4: Upsell
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (ctx.message.text.startsWith('👍')) {
        (ctx.session as any).upsell = true;
      } else {
        (ctx.session as any).upsell = false;
      }
      // Подтверждение заказа
      const price = (ctx.session as any).upsell ? PRICES.reviewWithExamples : PRICES.review;
      (ctx.session as any).price = price;
      await ctx.reply(
        `Ваш заказ:\n\n✔️ Услуга: Видео-разбор резюме\n✔️ Файл: ${(ctx.session as any).fileName}\n✔️ Целевая должность: ${(ctx.session as any).position}\n✔️ Примеры формулировок: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\n-----------------\nИтого к оплате: ${price} рублей\nСрок исполнения: 1 рабочий день\n\nВсе верно?`,
        Markup.keyboard([
          ['✅ Да, перейти к оплате'],
          ['✏️ Начать заново']
        ]).resize()
      );
      return ctx.wizard.next();
    }
  },
  // Шаг 5: Подтверждение заказа
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      if (ctx.message.text === '✅ Да, перейти к оплате') {
        await ctx.reply(
          `Для оплаты переведите ${(ctx.session as any).price} рублей одним из удобных способов:\n\n💳 Картой по номеру: [номер карты]\n📞 По номеру телефона (СБП): [номер телефона]\n\nПосле оплаты, пожалуйста, обязательно вернитесь в этот чат и нажмите кнопку ниже, чтобы прикрепить чек.`,
          Markup.keyboard([
            ['📸 Я оплатил(а) и готов(а) прикрепить чек']
          ]).resize()
        );
        return ctx.wizard.next();
      } else if (ctx.message.text === '✏️ Начать заново') {
        await ctx.scene.reenter();
      } else {
        await ctx.reply('Пожалуйста, подтвердите заказ или начните заново.');
      }
    }
  },
  // Шаг 6: Ожидание оплаты и загрузка чека
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '📸 Я оплатил(а) и готов(а) прикрепить чек') {
      await ctx.reply('Пожалуйста, прикрепите скриншот или фото чека (jpg, jpeg, png).');
      return;
    }
    if (ctx.message && 'photo' in ctx.message) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      (ctx.session as any).receiptFileId = photo.file_id;
      await ctx.reply(
        `Спасибо, чек получен! Ваш заказ №${(ctx.session as any).orderId} принят в работу.\nЯ подготовлю видео-разбор и отправлю его вам сюда, в этот чат, в течение 1 рабочего дня.`,
        Markup.removeKeyboard()
      );
      const adminMsg =
        `🔔 НОВЫЙ ЗАКАЗ №${(ctx.session as any).orderId}: Разбор резюме\n-----------------\n` +
        `Клиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\n` +
        `Тариф: Разбор-прожарка\n` +
        `Файл: ${(ctx.session as any).fileName}\n` +
        `Целевая должность: ${(ctx.session as any).position}\n` +
        `Вакансия: ${(ctx.session as any).vacancyUrl || '—'}\n` +
        `Комментарий: ${(ctx.session as any).comment || '—'}\n` +
        `Примеры формулировок: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\n` +
        `Сумма: ${(ctx.session as any).price} рублей\n` +
        `Статус: ОПЛАЧЕН\n-----------------`;
      await ctx.telegram.sendPhoto(
        ADMIN_CHAT_ID,
        photo.file_id,
        {
          caption: adminMsg,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📂 Отправить файл', callback_data: `send_result_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` }
              ]
            ]
          }
        }
      );
      await sendAdminEmail(
        `Новый заказ №${(ctx.session as any).orderId}`,
        adminMsg
      );
      return ctx.scene.leave();
    } else if (ctx.message && 'document' in ctx.message) {
      if (ctx.message.document && isValidImageFile(ctx.message.document.file_name || '')) {
        (ctx.session as any).receiptFileId = ctx.message.document.file_id;
        await ctx.reply(
          `Спасибо, чек получен! Ваш заказ №${(ctx.session as any).orderId} принят в работу.\nЯ подготовлю видео-разбор и отправлю его вам сюда, в этот чат, в течение 1 рабочего дня.`,
          Markup.removeKeyboard()
        );
        const adminMsg =
          `🔔 НОВЫЙ ЗАКАЗ №${(ctx.session as any).orderId}: Разбор резюме\n-----------------\n` +
          `Клиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\n` +
          `Тариф: Разбор-прожарка\n` +
          `Файл: ${(ctx.session as any).fileName}\n` +
          `Целевая должность: ${(ctx.session as any).position}\n` +
          `Вакансия: ${(ctx.session as any).vacancyUrl || '—'}\n` +
          `Комментарий: ${(ctx.session as any).comment || '—'}\n` +
          `Примеры формулировок: ${(ctx.session as any).upsell ? 'Да' : 'Нет'}\n` +
          `Сумма: ${(ctx.session as any).price} рублей\n` +
          `Статус: ОПЛАЧЕН\n-----------------`;
        await ctx.telegram.sendDocument(
          ADMIN_CHAT_ID,
          ctx.message.document.file_id,
          {
            caption: adminMsg,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📂 Отправить файл', callback_data: `send_result_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` }
                ]
              ]
            }
          }
        );
        await sendAdminEmail(
          `Новый заказ №${(ctx.session as any).orderId}`,
          adminMsg
        );
        return ctx.scene.leave();
      } else {
        await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
      }
    } else {
      await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
    }
  }
);

// Заглушки для wizard-сцен (будут реализованы далее)
export const fullResumeScene = new Scenes.WizardScene<BotContext>(
  'fullResumeScene',
  // Шаг 1: Описание услуги
  async (ctx) => {
    (ctx.session as any).orderType = 'full';
    (ctx.session as any).orderId = generateOrderId();
    (ctx.session as any).userId = ctx.from?.id;
    // Сохраняем заказ
    orders[(ctx.session as any).orderId] = {
      id: (ctx.session as any).orderId,
      userId: ctx.from?.id!,
      username: ctx.from?.username,
      type: 'full',
      status: 'pending',
      price: 0,
      createdAt: new Date(),
      delivery: 'telegram',
    } as Order;
    await ctx.reply(
      'Вы устраиваетесь на ответственную должность, и понимаете, что от резюме зависит слишком многое, чтобы делать его "на коленке".\n\nЯ проведу с вами часовое интервью, соберу всю необходимую информацию и составлю для вас сильное, готовое резюме.\n\nНажмите «Выбрать тариф и начать» или вернитесь в меню.',
      Markup.keyboard([
        ['Выбрать тариф и начать'],
        ['⬅️ Назад в меню']
      ]).resize()
    );
    return ctx.wizard.next();
  },
  // Шаг 2: Выбор тарифа
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '⬅️ Назад в меню') {
      await ctx.scene.leave();
      await ctx.scene.enter('mainMenu');
      return;
    }
    if (ctx.message && 'text' in ctx.message && ctx.message.text === 'Выбрать тариф и начать') {
      await ctx.reply(
        'Чтобы выбрать подходящий тариф, ориентируйтесь на тип задач, которые вы решаете.',
        Markup.keyboard([
          ['Резюме "Исполнитель" - 1999₽'],
          ['Резюме "Профи" - 2999₽'],
          ['Резюме "Руководитель" - 3999₽'],
          ['⬅️ Назад']
        ]).resize()
      );
      return;
    }
    if (ctx.message && 'text' in ctx.message) {
      let tariff = '';
      let price = 0;
      if (ctx.message.text.startsWith('Резюме "Исполнитель"')) {
        tariff = 'junior'; price = PRICES.full.junior;
      } else if (ctx.message.text.startsWith('Резюме "Профи"')) {
        tariff = 'pro'; price = PRICES.full.pro;
      } else if (ctx.message.text.startsWith('Резюме "Руководитель"')) {
        tariff = 'lead'; price = PRICES.full.lead;
      } else if (ctx.message.text === '⬅️ Назад') {
        await ctx.scene.reenter();
        return;
      } else {
        await ctx.reply('Пожалуйста, выберите тариф из списка.');
        return;
      }
      (ctx.session as any).tariff = tariff;
      (ctx.session as any).price = price;
      await ctx.reply('Прикрепите ваше старое резюме, если оно есть. Если нет — напишите "нет".');
      return ctx.wizard.next();
    }
  },
  // Шаг 3: Сбор информации
  async (ctx) => {
    if (ctx.message && 'document' in ctx.message) {
      (ctx.session as any).oldResumeFileId = ctx.message.document.file_id;
      (ctx.session as any).oldResumeFileName = ctx.message.document.file_name;
    } else if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).oldResumeFileId = undefined;
      (ctx.session as any).oldResumeFileName = undefined;
    }
    await ctx.reply('Укажите ссылку на желаемую вакансию или название должности, на которую претендуете.');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).vacancyUrl = ctx.message.text.trim();
      await ctx.reply('Если есть дополнительные пожелания к будущему резюме, напишите их здесь. Если нет — напишите "нет".');
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, введите ссылку или название должности.');
  },
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).comment = ctx.message.text.trim();
      // Предоплата
      const prepay = Math.floor((ctx.session as any).price / 2);
      await ctx.reply(
        `Спасибо! Следующий шаг — глубинное интервью. Для бронирования времени необходимо внести предоплату 50%: ${prepay} рублей.\n❗️Важно: Интервью начинается строго в назначенное время и не переносится. Предоплата не возвращается в случае вашей неявки.`,
        Markup.keyboard([
          ['✅ Перейти к оплате предоплаты']
        ]).resize()
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, напишите пожелания или "нет".');
  },
  // Шаг 4: Оплата предоплаты
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '✅ Перейти к оплате предоплаты') {
      const prepay = Math.floor((ctx.session as any).price / 2);
      await ctx.reply(
        `Для оплаты предоплаты переведите ${prepay} рублей:\n\n💳 Картой по номеру: [номер карты]\n📞 По номеру телефона (СБП): [номер телефона]\n\nПосле оплаты прикрепите чек.`,
        Markup.keyboard([
          ['📸 Я оплатил(а) и готов(а) прикрепить чек (предоплата)']
        ]).resize()
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, нажмите "Перейти к оплате предоплаты".');
  },
  // Шаг 5: Загрузка чека предоплаты
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '📸 Я оплатил(а) и готов(а) прикрепить чек (предоплата)') {
      await ctx.reply('Пожалуйста, прикрепите скриншот или фото чека (jpg, jpeg, png).');
      return;
    }
    if (ctx.message && 'photo' in ctx.message) {
      (ctx.session as any).prepayReceiptFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      await ctx.reply('Предоплата получена! Теперь выберите удобное для вас время для интервью по ссылке: [ссылка на Calendly]. Доступные слоты: Пн-Пт.\n\nПожалуйста, после выбора времени скопируйте и отправьте его сюда (например: 2024-07-01 15:00).');
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
  },
  // Шаг 6: Ожидание выбора времени интервью
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message) {
      (ctx.session as any).interviewTime = ctx.message.text.trim();
      orders[(ctx.session as any).orderId].interviewTime = ctx.message.text.trim();
      require('./index').scheduleInterviewReminders(orders[(ctx.session as any).orderId], require('./index').bot);
      // Уведомление админу о брони с временем
      const adminMsg =
        `🔔 НОВАЯ БРОНЬ №${(ctx.session as any).orderId}: Резюме под ключ\n-----------------\n` +
        `Клиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\n` +
        `Тариф: ${(ctx.session as any).tariff}\n` +
        `Время интервью: ${(ctx.session as any).interviewTime}\n` +
        `Старое резюме: ${(ctx.session as any).oldResumeFileName || '—'}\n` +
        `Вакансия/должность: ${(ctx.session as any).vacancyUrl || '—'}\n` +
        `Пожелания: ${(ctx.session as any).comment || '—'}\n` +
        `Статус: ПРЕДОПЛАТА\n-----------------`;
      await ctx.telegram.sendMessage(ADMIN_CHAT_ID, adminMsg);
      await sendAdminEmail(`Новая бронь №${(ctx.session as any).orderId}`, adminMsg);
      await ctx.reply('Бот напомнит вам об интервью за 24 часа и за 1 час до начала. После интервью оплатите вторую часть.');
      await ctx.reply('После интервью для завершения заказа оплатите вторую часть. Нажмите "✅ Оплатить вторую часть".');
      await ctx.reply('✅ Оплатить вторую часть', Markup.keyboard([["✅ Оплатить вторую часть"]]).resize());
      // Для теста: напоминания через setTimeout (в проде — cron или внешний сервис)
      // setTimeout(() => { ... }, msTo24hBefore)
      // setTimeout(() => { ... }, msTo1hBefore)
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, введите дату и время интервью (например: 2024-07-01 15:00).');
  },
  // Шаг 7: Финальная оплата
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '✅ Оплатить вторую часть') {
      const rest = Math.ceil((ctx.session as any).price / 2);
      await ctx.reply(
        `Для завершения заказа оплатите вторую часть: ${rest} рублей.\n\n💳 Картой по номеру: [номер карты]\n📞 По номеру телефона (СБП): [номер телефона]\n\nПосле оплаты прикрепите чек.`,
        Markup.keyboard([
          ['📸 Я оплатил(а) и готов(а) прикрепить чек (финал)']
        ]).resize()
      );
      return ctx.wizard.next();
    }
    await ctx.reply('Пожалуйста, нажмите "Оплатить вторую часть".');
  },
  // Шаг 8: Загрузка финального чека
  async (ctx) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text === '📸 Я оплатил(а) и готов(а) прикрепить чек (финал)') {
      await ctx.reply('Пожалуйста, прикрепите скриншот или фото чека (jpg, jpeg, png).');
      return;
    }
    if (ctx.message && 'photo' in ctx.message) {
      (ctx.session as any).finalReceiptFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      await ctx.reply('Оплата получена, спасибо! Беру ваш заказ в работу. Готовое резюме будет у вас в течение 1 рабочего дня.', Markup.removeKeyboard());
      // Уведомление админу о полной оплате
      const adminMsg =
        `🔔 ОПЛАЧЕНО №${(ctx.session as any).orderId}: Резюме под ключ\n-----------------\nКлиент: ${ctx.from?.first_name} @${ctx.from?.username} (ID: ${(ctx.session as any).userId})\nТариф: ${(ctx.session as any).tariff}\nСтатус: ОПЛАЧЕНО\n-----------------`;
      await ctx.telegram.sendPhoto(
        ADMIN_CHAT_ID,
        (ctx.session as any).finalReceiptFileId,
        {
          caption: adminMsg,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📂 Отправить файл', callback_data: `send_result_${(ctx.session as any).orderId}_${(ctx.session as any).userId}` }
              ]
            ]
          }
        }
      );
      await sendAdminEmail(
        `Полная оплата №${(ctx.session as any).orderId}`,
        adminMsg
      );
      return ctx.scene.leave();
    }
    await ctx.reply('Пожалуйста, прикрепите изображение чека (jpg, jpeg, png).');
  }
);

export {}; 
