import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage, screen } from 'electron';
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

// Window position persistence
interface WindowPosition {
  x: number;
  y: number;
  displayCount: number;
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
    return true;
  } catch (error) {
    console.error('[Settings] Failed to save:', error);
    return false;
  }
}

let appSettings: AppSettings = DEFAULT_SETTINGS;

// Window position persistence
function getWindowPositionPath(): string {
  return path.join(app.getPath('userData'), 'window-position.json');
}

function loadWindowPosition(): WindowPosition | null {
  try {
    const positionPath = getWindowPositionPath();
    if (fs.existsSync(positionPath)) {
      const data = fs.readFileSync(positionPath, 'utf-8');
      const parsed = JSON.parse(data) as WindowPosition;

      // Validate that display count matches current configuration
      const currentDisplayCount = screen.getAllDisplays().length;
      if (parsed.displayCount !== currentDisplayCount) {
        return null;
      }

      // Validate that position is within visible bounds
      const displays = screen.getAllDisplays();
      const isPositionVisible = displays.some(display => {
        const { x, y, width, height } = display.bounds;
        return parsed.x >= x && parsed.x < x + width && parsed.y >= y && parsed.y < y + height;
      });

      if (!isPositionVisible) {
        return null;
      }

      return parsed;
    }
  } catch (error) {
    console.error('[WindowPosition] Failed to load position:', error);
  }
  return null;
}

function saveWindowPosition(x: number, y: number): void {
  try {
    const displayCount = screen.getAllDisplays().length;
    const position: WindowPosition = { x, y, displayCount };
    const positionPath = getWindowPositionPath();
    fs.writeFileSync(positionPath, JSON.stringify(position, null, 2), 'utf-8');
  } catch (error) {
    console.error('[WindowPosition] Failed to save position:', error);
  }
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

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
  // Try to restore saved window position
  const savedPosition = loadWindowPosition();

  mainWindow = new BrowserWindow({
    width: 80,
    height: 100,
    ...(savedPosition && { x: savedPosition.x, y: savedPosition.y }),
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

  // Save window position when moved
  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      saveWindowPosition(x, y);
    }
  });

  // Hide to tray instead of closing on macOS/Windows
  mainWindow.on('close', (event) => {
    if (tray && !(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getIconPath(): string {
  // Use Template suffix on macOS for proper menu bar appearance
  const iconName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';

  if (process.env.NODE_ENV === 'development') {
    // In development, assets are in project root
    return path.join(app.getAppPath(), 'assets', iconName);
  } else {
    // In production, assets are in resources folder
    return path.join(process.resourcesPath, 'assets', iconName);
  }
}

function createTray() {
  const iconPath = getIconPath();
  let icon = nativeImage.createFromPath(iconPath);

  // If icon failed to load, create a simple 16x16 icon programmatically
  if (icon.isEmpty()) {
    // Create a simple 16x16 white circle on transparent background
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4); // RGBA
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const cx = size / 2, cy = size / 2, r = 6;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          canvas[idx] = 255;     // R
          canvas[idx + 1] = 255; // G
          canvas[idx + 2] = 255; // B
          canvas[idx + 3] = 255; // A
        } else {
          canvas[idx + 3] = 0;   // Transparent
        }
      }
    }
    icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  // Mark as template image on macOS for proper dark/light mode handling
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Voice Recognition — ⌘⇧R to record');

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const isVisible = mainWindow?.isVisible() ?? false;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Widget' : 'Show Widget',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
          updateTrayMenu();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

// Default shortcut: Cmd+Shift+R on macOS, Ctrl+Shift+R on other platforms
const TOGGLE_RECORDING_SHORTCUT = process.platform === 'darwin' ? 'CommandOrControl+Shift+R' : 'CommandOrControl+Shift+R';

function registerGlobalShortcuts() {
  const registered = globalShortcut.register(TOGGLE_RECORDING_SHORTCUT, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-recording');
    }
  });

  if (!registered) {
    console.error('[Shortcut] Failed to register global shortcut:', TOGGLE_RECORDING_SHORTCUT);
  }
}

app.whenReady().then(() => {
  // Load settings on app start
  appSettings = loadSettings();
  createWindow();
  createTray();
  registerGlobalShortcuts();
});

app.on('window-all-closed', () => {
  // With tray integration, don't quit when windows are closed
  // The app keeps running in the tray
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on('activate', () => {
  // Show the window if it's hidden when dock icon is clicked (macOS)
  if (mainWindow) {
    mainWindow.show();
    updateTrayMenu();
  } else if (BrowserWindow.getAllWindows().length === 0) {
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
  // For apiKey and model: prefer saved settings, fallback to env var
  return {
    apiKey: appSettings.apiKey || process.env.GEMINI_API_KEY || '',
    model: appSettings.model || process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    customPrompt: appSettings.customPrompt,
    languages: appSettings.languages,
  };
});

ipcMain.handle('save-settings', (_event, settings: Partial<AppSettings>) => {
  appSettings = { ...appSettings, ...settings };
  return saveSettings(appSettings);
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
