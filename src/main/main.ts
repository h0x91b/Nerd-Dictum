import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage, screen, systemPreferences, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { decode as decodeBase65 } from '../lib/base65';
import { getDisplayBounds, isPositionValid } from './window-position';
import type { WindowPosition } from './window-position';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Settings persistence
interface AppSettings {
  apiKey: string;
  model: string;
  languages: string[];
  speechDomain: string;
  customDomainHint: string;
  customKeywords: string;
  microphoneDeviceId: string;
  silenceDetectionEnabled: boolean;
  silenceDurationMs: number;
  launchAtStartup: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'gemini-3-flash-preview',
  languages: ['en', 'he'],
  speechDomain: 'programming',
  customDomainHint: '',
  customKeywords: '',
  microphoneDeviceId: '',
  silenceDetectionEnabled: true,
  silenceDurationMs: 2500,
  launchAtStartup: false,
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
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      // Sync launchAtStartup with actual system state
      const { openAtLogin } = app.getLoginItemSettings();
      settings.launchAtStartup = openAtLogin;
      return settings;
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
    // Apply auto-launch setting to system
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtStartup,
      openAsHidden: true, // macOS: launch without focusing
    });
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
      const displays = screen.getAllDisplays();
      const isValidPosition = isPositionValid(
        parsed,
        displays.length,
        getDisplayBounds(displays)
      );
      console.log('[TEST] Window position validation:', {
        displayCount: displays.length,
        isValid: isValidPosition,
      });

      if (!isValidPosition) {
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
let infoWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

async function updateDockVisibility() {
  if (process.platform !== 'darwin' || !app.dock) return;

  const hasSecondaryWindows =
    (settingsWindow && !settingsWindow.isDestroyed()) ||
    (infoWindow && !infoWindow.isDestroyed());

  if (hasSecondaryWindows) {
    // Show dock first, then set icon (setIcon requires dock to be visible)
    await app.dock.show();
    const appIconPath = getAppIconPath();
    const appIcon = nativeImage.createFromPath(appIconPath);
    if (!appIcon.isEmpty()) {
      app.dock.setIcon(appIcon);
    }
  } else {
    app.dock.hide();
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  // Get the display where the main window is located
  let windowBounds: { x: number; y: number; width: number; height: number } | undefined;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: mainBounds.x, y: mainBounds.y });
    const { workArea } = display;
    // Center the settings window on the same display
    const width = 500;
    const height = 700;
    windowBounds = {
      x: Math.round(workArea.x + (workArea.width - width) / 2),
      y: Math.round(workArea.y + (workArea.height - height) / 2),
      width,
      height,
    };
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 700,
    ...(windowBounds && { x: windowBounds.x, y: windowBounds.y }),
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Nerd Dictum — Settings',
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.ELECTRON_DEV === 'true' || (!app.isPackaged && !process.env.ELECTRON_FORCE_PROD);

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5173/settings.html');
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
  }

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    updateDockVisibility();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    updateDockVisibility();
  });
}

function createInfoWindow() {
  if (infoWindow && !infoWindow.isDestroyed()) {
    infoWindow.focus();
    return;
  }

  // Get the display where the main window is located
  let windowBounds: { x: number; y: number; width: number; height: number } | undefined;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const mainBounds = mainWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: mainBounds.x, y: mainBounds.y });
    const { workArea } = display;
    // Center the info window on the same display
    const width = 400;
    const height = 380;
    windowBounds = {
      x: Math.round(workArea.x + (workArea.width - width) / 2),
      y: Math.round(workArea.y + (workArea.height - height) / 2),
      width,
      height,
    };
  }

  infoWindow = new BrowserWindow({
    width: 400,
    height: 380,
    ...(windowBounds && { x: windowBounds.x, y: windowBounds.y }),
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Nerd Dictum — How to Use',
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.ELECTRON_DEV === 'true' || (!app.isPackaged && !process.env.ELECTRON_FORCE_PROD);

  if (isDev) {
    infoWindow.loadURL('http://localhost:5173/info.html');
  } else {
    infoWindow.loadFile(path.join(__dirname, '../renderer/info.html'));
  }

  infoWindow.once('ready-to-show', () => {
    infoWindow?.show();
    updateDockVisibility();
  });

  infoWindow.on('closed', () => {
    infoWindow = null;
    updateDockVisibility();
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
    visibleOnAllWorkspaces: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // macOS: ensure window stays visible on all Spaces
  if (process.platform === 'darwin') {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Use ELECTRON_DEV env var to detect dev mode, or fall back to app.isPackaged
  const isDev = process.env.ELECTRON_DEV === 'true' || (!app.isPackaged && !process.env.ELECTRON_FORCE_PROD);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
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
    // Close child windows when main window is closed
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    if (infoWindow && !infoWindow.isDestroyed()) {
      infoWindow.close();
    }
    mainWindow = null;
  });
}

function getIconPath(): string {
  // Use Template suffix on macOS for proper menu bar appearance
  const iconName = process.platform === 'darwin' ? 'tray-iconTemplate.png' : 'tray-icon.png';

  if (!app.isPackaged) {
    // In development, assets are in project root
    return path.join(app.getAppPath(), 'assets', iconName);
  } else {
    // In production, assets are in resources folder
    return path.join(process.resourcesPath, 'assets', iconName);
  }
}

function getAppIconPath(): string {
  if (!app.isPackaged) {
    // In development, use the icon from build folder
    return path.join(app.getAppPath(), 'build', 'icon.png');
  } else {
    // In production, electron-builder handles this automatically
    return path.join(process.resourcesPath, 'icon.png');
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
  tray.setToolTip('Nerd Dictum — ⌘⇧R to record');

  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;

  const isVisible = mainWindow?.isVisible() ?? false;

  const isDevToolsOpen = mainWindow?.webContents.isDevToolsOpened() ?? false;

  // Build update menu items
  const updateMenuItems: Electron.MenuItemConstructorOptions[] = [];
  if (updateDownloaded && downloadedVersion) {
    updateMenuItems.push({
      label: `Install Update (v${downloadedVersion})`,
      click: () => {
        installUpdate();
      },
    });
  } else {
    updateMenuItems.push({
      label: 'Check for Updates',
      click: () => {
        checkForUpdates();
      },
    });
  }

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
    {
      label: isDevToolsOpen ? 'Hide Developer Tools' : 'Show Developer Tools',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
          }
          updateTrayMenu();
        }
      },
    },
    { type: 'separator' },
    ...updateMenuItems,
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        (app as any).isQuitting = true;
        // Destroy tray first to prevent menu callbacks
        if (tray) {
          tray.destroy();
          tray = null;
        }
        // Close all windows explicitly
        BrowserWindow.getAllWindows().forEach(win => {
          win.destroy();
        });
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

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CommandOrControl+,',
                click: () => createSettingsWindow(),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } as Electron.MenuItemConstructorOptions,
        ]
      : []),
    // Edit menu (for copy/paste support)
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // View menu with custom DevTools handler
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              if (focusedWindow.webContents.isDevToolsOpened()) {
                focusedWindow.webContents.closeDevTools();
              } else {
                focusedWindow.webContents.openDevTools({ mode: 'detach' });
              }
            }
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Auto-updater setup
// Obfuscated read-only token for accessing private GitHub releases (base65 encoded)
const GH_RELEASES_TOKEN_ENCODED = 'ГцжАЦНудлуФмэЦрзееврфЯдаэЫзГФцекТЮхЦПшшЯЫцРцЯМЪШНьуУэРъыРЛЙегЗ__ЭЭЛРАЧцЙВонхзШнОаъпхЦЫГбодТКЦрфУрГчбюЫСуМахя_ыкхШшКЛДЛДлшЮЬы';

// Update state tracking
let updateDownloaded = false;
let downloadedVersion: string | null = null;
let updateCheckInterval: NodeJS.Timeout | null = null;

// Enable dev testing with: FORCE_UPDATE_CHECK=true bun run dev
const FORCE_UPDATE_CHECK = process.env.FORCE_UPDATE_CHECK === 'true';

function checkForUpdates() {
  if (!app.isPackaged && !FORCE_UPDATE_CHECK) return;
  autoUpdater.checkForUpdates().catch((error) => {
    console.error('[AutoUpdater] Check failed:', error.message);
  });
}

function installUpdate() {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall();
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged && !FORCE_UPDATE_CHECK) return;

  const token = decodeBase65(GH_RELEASES_TOKEN_ENCODED);
  autoUpdater.requestHeaders = { Authorization: `token ${token}` };

  if (FORCE_UPDATE_CHECK && !app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Up to date:', info.version);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Downloading: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Downloaded:', info.version);
    updateDownloaded = true;
    downloadedVersion = info.version;
    updateTrayMenu();

    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you restart the app.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error.message);
  });

  // Initial check for updates
  checkForUpdates();

  // Check for updates every hour
  updateCheckInterval = setInterval(checkForUpdates, 60 * 60 * 1000);
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return true; // Only macOS needs explicit permission request
  }

  const status = systemPreferences.getMediaAccessStatus('microphone');
  console.log('[Permissions] Microphone access status:', status);

  if (status === 'granted') {
    return true;
  }

  if (status === 'not-determined') {
    // Request permission - this will show the macOS permission dialog
    const granted = await systemPreferences.askForMediaAccess('microphone');
    console.log('[Permissions] Microphone permission request result:', granted);
    return granted;
  }

  // status is 'denied' or 'restricted'
  console.error('[Permissions] Microphone access denied. Please enable in System Preferences > Privacy & Security > Microphone');
  return false;
}

app.whenReady().then(async () => {
  // Load settings on app start
  appSettings = loadSettings();

  // Set dock icon on macOS (especially useful in dev mode)
  if (process.platform === 'darwin' && app.dock) {
    const appIconPath = getAppIconPath();
    const appIcon = nativeImage.createFromPath(appIconPath);
    if (!appIcon.isEmpty()) {
      app.dock.setIcon(appIcon);
    }
    // Hide dock icon initially - it will show when settings/info windows open
    app.dock.hide();
  }

  // Request microphone permission on macOS before creating window
  const micPermission = await requestMicrophonePermission();
  if (!micPermission) {
    console.warn('[Permissions] Microphone permission not granted - recording may not work');
  }

  createApplicationMenu();
  createWindow();
  createTray();
  registerGlobalShortcuts();

  // Check for updates after app is ready
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  // With tray integration, don't quit when windows are closed
  // The app keeps running in the tray
  if (!tray && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
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
  // Sync launchAtStartup with actual system state
  const { openAtLogin } = app.getLoginItemSettings();
  // For apiKey and model: prefer saved settings, fallback to env var
  return {
    apiKey: appSettings.apiKey || process.env.GEMINI_API_KEY || '',
    model: appSettings.model || process.env.GEMINI_MODEL || 'gemini-3-flash-preview',
    languages: appSettings.languages,
    speechDomain: appSettings.speechDomain,
    customDomainHint: appSettings.customDomainHint,
    customKeywords: appSettings.customKeywords,
    microphoneDeviceId: appSettings.microphoneDeviceId,
    silenceDetectionEnabled: appSettings.silenceDetectionEnabled,
    silenceDurationMs: appSettings.silenceDurationMs,
    launchAtStartup: openAtLogin,
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

// Microphone permission handlers
ipcMain.handle('get-microphone-permission-status', () => {
  if (process.platform !== 'darwin') {
    return 'granted'; // Non-macOS platforms don't need explicit permission
  }
  return systemPreferences.getMediaAccessStatus('microphone');
});

ipcMain.handle('request-microphone-permission', async () => {
  return requestMicrophonePermission();
});

// Open external URL in default browser
ipcMain.handle('open-external-url', (_event, url: string) => {
  // Only allow https URLs for security
  if (url.startsWith('https://')) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// Open info window
ipcMain.handle('open-info-window', () => {
  createInfoWindow();
  return true;
});
