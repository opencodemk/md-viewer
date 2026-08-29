/*
 * AutoBalas AI — Preload (jambatan selamat antara Electron & renderer)
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  isDesktop: true
});
