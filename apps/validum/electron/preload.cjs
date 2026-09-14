const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  restartAndInstallUpdate: () => ipcRenderer.invoke('restart-and-install-update'),
  savePDFFile: (defaultName, base64Data) => ipcRenderer.invoke('save-pdf-file', { defaultName, base64Data }),
  onUpdaterStatus: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('updater-status', subscription);
    return () => ipcRenderer.removeListener('updater-status', subscription);
  },
});
