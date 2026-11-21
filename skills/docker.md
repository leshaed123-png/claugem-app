---
name: docker
description: Docker и docker-compose
---

1. Dockerfile: лёгкий базовый образ, сначала COPY package*.json и install (кэш), потом код; запуск не от root.
2. .dockerignore: node_modules, .git, .env.
3. Multi-stage для сборки фронтенда/компиляции.
4. compose: сервисы, volumes для данных, healthcheck, depends_on, env через .env.
5. Диагностика: `docker logs`, `docker exec -it ... sh`.
