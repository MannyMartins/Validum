const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Configuración de logs del auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Validum - Gestor Universal de Formularios EPS',
    backgroundColor: '#0a1824',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    const port = process.env.PORT || 3000;
    mainWindow.loadURL(`http://localhost:${port}`);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Abrir enlaces externos en el navegador predeterminado
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Chequeo de actualizaciones silencioso al iniciar
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log('Error checking updates on startup:', err);
    });
  }
}

// Eventos de Auto-Updater
autoUpdater.on('checking-for-update', () => {
  if (mainWindow) mainWindow.webContents.send('updater-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('updater-status', { status: 'available', version: info.version });
});

autoUpdater.on('update-not-available', () => {
  if (mainWindow) mainWindow.webContents.send('updater-status', { status: 'not-available' });
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('updater-status', { 
      status: 'downloading', 
      percent: Math.round(progressObj.percent) 
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('updater-status', { 
      status: 'downloaded', 
      version: info.version 
    });
  }
});

autoUpdater.on('error', (err) => {
  if (mainWindow) {
    mainWindow.webContents.send('updater-status', { 
      status: 'error', 
      error: err.message 
    });
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-updates', async () => {
  if (app.isPackaged) {
    try {
      const res = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: res?.updateInfo };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'En modo desarrollo no se buscan actualizaciones.' };
});

ipcMain.handle('restart-and-install-update', () => {
  autoUpdater.quitAndInstall();
});

// Guardar archivo PDF directamente al sistema de archivos local
ipcMain.handle('save-pdf-file', async (event, { defaultName, base64Data }) => {
  if (!mainWindow) return { success: false };

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar Formulario PDF',
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: 'Archivos PDF', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  try {
    const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
