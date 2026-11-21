---
name: node-api
description: REST API на Node.js (Express/Fastify)
---

1. Структура: src/routes, src/services, src/db, src/middleware.
2. Валидация входа (zod), единый обработчик ошибок, коды 400/401/404/409/500.
3. Конфиг через process.env + .env.example; никаких секретов в коде.
4. Аутентификация: JWT (access короткий) или сессии; пароли — bcrypt/argon2.
5. CORS, helmet, rate limit; логирование запросов.
6. Тесты: supertest + node:test или vitest.
7. Пагинация, идемпотентность POST по необходимости.
