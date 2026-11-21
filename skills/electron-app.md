---
name: electron-app
description: Desktop-приложение на Electron (Mac/Win/Linux)
---

1. main.js: BrowserWindow с contextIsolation:true, nodeIntegration:false, preload.js.
2. Весь доступ к ФС/сети из рендерера — только через ipcMain.handle + contextBridge в preload.
3. Mac-стиль: titleBarStyle:'hiddenInset', vibrancy:'under-window', зоны перетаскивания -webkit-app-region:drag.
4. Секреты — safeStorage.encryptString; настройки в app.getPath('userData').
5. Сборка: electron-builder, targets dmg; без подписи `mac.identity: null`.
6. Если приложение не открывается как «повреждённое»: `xattr -cr /Applications/Имя.app`.
