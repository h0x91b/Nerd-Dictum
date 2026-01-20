import { app, BrowserWindow, ipcMain, clipboard, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 80,
    height: 100,
    frame: false,
    transparent: false,
    backgroundColor: '#2a2a2a',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Default shortcut: Cmd+Shift+R on macOS, Ctrl+Shift+R on other platforms
const TOGGLE_RECORDING_SHORTCUT = process.platform === 'darwin' ? 'CommandOrControl+Shift+R' : 'CommandOrControl+Shift+R';

function registerGlobalShortcuts() {
  const registered = globalShortcut.register(TOGGLE_RECORDING_SHORTCUT, () => {
    console.log('[Shortcut] Toggle recording shortcut triggered');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-recording');
    }
  });

  if (!registered) {
    console.error('[Shortcut] Failed to register global shortcut:', TOGGLE_RECORDING_SHORTCUT);
  } else {
    console.log('[Shortcut] Registered global shortcut:', TOGGLE_RECORDING_SHORTCUT);
  }
}

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('get-api-key', () => {
  return process.env.GEMINI_API_KEY || '';
});

ipcMain.handle('get-model', () => {
  return process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
});
