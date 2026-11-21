---
name: chrome-extension
description: Расширение для Chrome (Manifest V3)
---

1. manifest.json: manifest_version:3, permissions минимально нужные, action, background.service_worker.
2. Контент-скрипты для работы со страницей, сообщения через chrome.runtime.sendMessage.
3. Хранение: chrome.storage.sync/local.
4. Service worker без долгоживущего состояния; таймеры через chrome.alarms.
5. Загрузка для теста: chrome://extensions → режим разработчика → Load unpacked.
