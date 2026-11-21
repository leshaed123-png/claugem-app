---
name: telegram-bot
description: Telegram-бот на Node.js или Python
---

1. Токен от @BotFather — только в переменной окружения.
2. Node: grammy или telegraf; Python: aiogram или python-telegram-bot.
3. Команды: /start, /help; клавиатуры inline для действий.
4. Состояние пользователя хранить в SQLite/Redis, а не в памяти.
5. Ловить ошибки в обработчиках, чтобы бот не падал; long polling для начала, webhook для продакшена.
