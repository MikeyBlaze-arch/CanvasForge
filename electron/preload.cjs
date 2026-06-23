const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('canvasForgeDesktop', {
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:save-file', options),
  platform: process.platform,
  isDesktop: true,
})
