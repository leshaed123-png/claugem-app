const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { runAgent } = require('./agent');

let win;
let history = [];
let abort = null;
const pendingConfirms = new Map();

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 820, minHeight: 560,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (process.env.CLAUGEM_DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('settings:get', () => store.publicSettings());
ipcMain.handle('settings:set', (_e, patch) => store.updateSettings(patch));
ipcMain.handle('workspace:pick', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled) return store.publicSettings();
  return store.updateSettings({ workspace: r.filePaths[0] });
});
ipcMain.handle('models:free', () => store.fetchFreeModels().catch(() => []));
ipcMain.handle('skills:list', () => store.listSkills());
ipcMain.handle('open:url', (_e, url) => shell.openExternal(url));
ipcMain.handle('chat:reset', () => { history = []; });
ipcMain.handle('chat:stop', () => { abort?.abort(); });
ipcMain.on('confirm:response', (_e, { id, ok }) => { pendingConfirms.get(id)?.(ok); pendingConfirms.delete(id); });

ipcMain.handle('chat:send', async (_e, text) => {
  abort = new AbortController();
  const emit = (ev) => win.webContents.send('agent:event', ev);
  const confirm = (command) => new Promise((resolve) => {
    const id = String(Date.now() + Math.random());
    pendingConfirms.set(id, resolve);
    emit({ type: 'confirm', id, command });
  });
  try { await runAgent({ history, userText: text, emit, confirm, signal: abort.signal }); }
  catch (e) { emit({ type: 'error', text: e.message }); }
  emit({ type: 'done' });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
