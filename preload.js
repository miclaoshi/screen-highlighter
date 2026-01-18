const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onEnabledChanged: (callback) => ipcRenderer.on('enabled-changed', (event, enabled) => callback(enabled)),
    onDrawingMode: (callback) => ipcRenderer.on('drawing-mode', (event, isDrawing) => callback(isDrawing)),
    onConfigChanged: (callback) => ipcRenderer.on('config-changed', (event, config) => callback(config))
});
