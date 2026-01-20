import { app, BrowserWindow, ipcMain, clipboard, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Settings persistence
interface AppSettings {
  apiKey: string;
  model: string;
  customPrompt: string;
  languages: string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3-flash-preview',
  customPrompt: '',
  languages: [],
};

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('[Settings] Failed to load settings:', error);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings): boolean {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    console.log('[Settings] Saved to:', settingsPath);
    return true;
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
    return false;
  }
}

let appSettings: AppSettings = DEFAULT_SETTINGS;

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 450,
    height: 550,
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Settings',
    parent: mainWindow || undefined,
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    settingsWindow.loadURL('http://localhost:5173/settings.html');
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

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
  // Load settings on app start
  appSettings = loadSettings();
  console.log('[Settings] Loaded settings, API key configured:', !!appSettings.apiKey);
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

// API key: prefer saved settings, fallback to env var
ipcMain.handle('get-api-key', () => {
  return appSettings.apiKey || process.env.GEMINI_API_KEY || '';
});

// Model: prefer saved settings, fallback to env var
ipcMain.handle('get-model', () => {
  return appSettings.model || process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
});

// Settings management
ipcMain.handle('get-settings', () => {
  return {
    apiKey: appSettings.apiKey,
    model: appSettings.model,
    customPrompt: appSettings.customPrompt,
    languages: appSettings.languages,
  };
});

ipcMain.handle('save-settings', (_event, settings: Partial<AppSettings>) => {
  appSettings = { ...appSettings, ...settings };
  const success = saveSettings(appSettings);
  console.log('[Settings] Save result:', success);
  return success;
});

// Open settings window
ipcMain.handle('open-settings-window', () => {
  createSettingsWindow();
  return true;
});

// Close settings window
ipcMain.handle('close-settings-window', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  return true;
});
