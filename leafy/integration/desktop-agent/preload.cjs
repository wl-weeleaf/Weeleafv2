const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('leafyDesktop', Object.freeze({
  moveWindow: (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) ipcRenderer.send('leafy:move-widget', { x, y }); },
  openDashboard: () => ipcRenderer.send('leafy:open-dashboard')
}));
