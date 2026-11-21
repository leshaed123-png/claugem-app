const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claugem', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (p) => ipcRenderer.invoke('settings:set', p),
  pickWorkspace: () => ipcRenderer.invoke('workspace:pick'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  openUrl: (u) => ipcRenderer.invoke('open:url', u),
  send: (t) => ipcRenderer.invoke('chat:send', t),
  stop: () => ipcRenderer.invoke('chat:stop'),
  reset: () => ipcRenderer.invoke('chat:reset'),
  confirm: (id, ok) => ipcRenderer.send('confirm:response', { id, ok }),
  onEvent: (cb) => { const h = (_e, ev) => cb(ev); ipcRenderer.on('agent:event', h); return () => ipcRenderer.removeListener('agent:event', h); }
});
