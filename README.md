# Telegram CV Creator Bot

Бот для создания, разбора и заказа резюме через Telegram по ТЗ (см. папку DOC).

## Стек
- Node.js + TypeScript
- Telegraf (Telegram Bot API)
- Nodemailer (email)
- dotenv
- Vercel-ready
- SMTP (email): укажите SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS в .env
- Для отправки email с вложениями используется nodemailer и axios

## Запуск
1. Скопируйте `.env.example` в `.env` и заполните переменные.
2. Установите зависимости:
   ```bash
   npm install
   ```
3. Запустите бота:
   ```bash
   npx ts-node src/index.ts
   ```

## Структура
- `src/` — исходный код бота
- `DOC/` — ТЗ, сценарии, примеры

## Особенности
- Поддержка polling и запуска на Vercel
- Гибкая настройка сценариев и текстов
- Уведомления администратору в канал и на email
