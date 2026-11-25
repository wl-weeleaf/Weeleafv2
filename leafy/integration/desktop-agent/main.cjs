const { app, BrowserWindow, ipcMain, session, screen } = require('electron');
const path = require('node:path');

const APP_ORIGIN = 'https://leafy-0-1-live.bushy-flame-4467.chatgpt.site';
const WIDGET_URL = `${APP_ORIGIN}/desktop/widget`;
let widget;
let dashboard;

function isLeafyUrl(value) {
  try { return new URL(value).origin === APP_ORIGIN; } catch { return false; }
}
function openDashboard() {
  if (dashboard && !dashboard.isDestroyed()) { dashboard.show(); dashboard.focus(); return; }
  dashboard = new BrowserWindow({ width: 1320, height: 900, minWidth: 780, minHeight: 620, title: 'Leafy 0.1', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  dashboard.on('closed', () => { dashboard = null; });
  dashboard.webContents.setWindowOpenHandler(({ url }) => { if (isLeafyUrl(url)) openDashboard(); return { action: 'deny' }; });
  void dashboard.loadURL(APP_ORIGIN);
}
function createWidget() {
  widget = new BrowserWindow({ width: 250, height: 300, minWidth: 210, minHeight: 250, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000', title: 'Leafy', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  widget.setAlwaysOnTop(true, 'floating');
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widget.webContents.setWindowOpenHandler(({ url }) => { if (isLeafyUrl(url)) openDashboard(); return { action: 'deny' }; });
  widget.webContents.on('will-navigate', (event, url) => { if (url !== WIDGET_URL) event.preventDefault(); });
  void widget.loadURL(WIDGET_URL);
  widget.on('closed', () => { widget = null; });
}
app.whenReady().then(() => {
  const ses = session.defaultSession;
  ses.setPermissionCheckHandler((contents, permission, requestingOrigin) => permission === 'media' && isLeafyUrl(requestingOrigin));
  ses.setPermissionRequestHandler((contents, permission, callback, details) => callback(permission === 'media' && isLeafyUrl(details.requestingUrl)));
  ipcMain.on('leafy:move-widget', (event, point) => {
    if (!widget || event.sender !== widget.webContents || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const display = screen.getDisplayNearestPoint({ x: point.x, y: point.y });
    const area = display.workArea;
    widget.setPosition(Math.max(area.x, Math.min(area.x + area.width - widget.getBounds().width, Math.round(point.x))), Math.max(area.y, Math.min(area.y + area.height - widget.getBounds().height, Math.round(point.y))));
  });
  ipcMain.on('leafy:open-dashboard', event => { if (widget && event.sender === widget.webContents) openDashboard(); });
  createWidget();
  app.on('activate', () => { if (!widget) createWidget(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
