# Документация по запуску и деплою Telegram CV Creator Bot

## Стек
- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Nodemailer (email)
- dotenv
- Vercel (серверлес-деплой)
- SMTP (email): укажите SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS в .env

---

## Локальный запуск

1. **Склонируйте репозиторий и перейдите в папку проекта:**
   ```bash
   git clone https://github.com/Nighty3098/CV_CREATOR_BOT
   cd CV_CREATOR_BOT
   ```

2. **Создайте файл окружения:**
   ```bash
   cp .env.example .env
   ```
   Заполните все переменные в `.env`:

   ```

   BOT_TOKEN=
   ADMIN_CHAT_ID=

   ADMIN_EMAIL=

   SMTP_HOST=
   SMTP_PORT=
   SMTP_USER=
   SMTP_PASS=

   CARD_NUM=
   PHONE_NUM=

   PRICE_EXAMPLE=
   PRICE_EXAMPLE_VIDEO=
   PRICE_REVIEW=
   PRICE_REVIEW_EXAMPLES=
   PRICE_FULL_JUNIOR=
   PRICE_FULL_PRO=
   PRICE_FULL_LEAD=
   PRICE_UPSELL_VIDEO=
   PRICE_UPSELL_EXAMPLES=

   ```

3. **Установите зависимости:**
   ```bash
   npm install
   ```

4. **Запустите бота локально:**
   ```bash
   npx ts-node src/index.ts
   ```
   > Для продакшн-сборки используйте `npm run build` и `node dist/index.js` (если настроен build-скрипт).

---

## Деплой на Vercel

1. **Установите Vercel CLI (если ещё не установлен):**
   ```bash
   npm i -g vercel
   ```

2. **Авторизуйтесь в Vercel:**
   ```bash
   vercel login
   ```

3. **Добавьте все переменные окружения в настройках проекта на Vercel:**
   - Через веб-интерфейс Vercel (Project Settings → Environment Variables)
   - Или через CLI:
     ```bash
     vercel env add
     ```

4. **Деплойте проект:**
   ```bash
   vercel --prod
   ```
   Vercel автоматически использует настройки из `vercel.json`:
   - Точка входа: `src/index.ts`
   - Серверлес-функция на Node.js

5. **Webhook для Telegram:**
   - Для работы бота в режиме webhook (а не polling) укажите публичный URL, который выдаст Vercel, в настройках Telegram-бота:
     ```
     https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook?url=https://<your-vercel-deployment-url>/
     ```
   - Если бот работает только через polling (без webhook), этот шаг можно пропустить.

---

## Структура проекта

- `src/` — исходный код бота
- `DOC/` — ТЗ, сценарии, примеры
- `vercel.json` — конфиг для деплоя на Vercel

---

## Особенности

- Поддержка запуска как локально, так и на Vercel (серверлес)
- Гибкая настройка сценариев и текстов через `src/messages.ts`
- Уведомления администратору в Telegram и на email
- Возможность интеграции с внешними сервисами (например, календарь через webhook)
