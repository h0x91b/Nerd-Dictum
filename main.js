// src/main/main.ts
import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage, screen } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = path.dirname(__filename2);
var DEFAULT_SETTINGS = {
  apiKey: "",
  model: "gemini-3-flash-preview",
  languages: [],
  speechDomain: "programming",
  customDomainHint: "",
  microphoneDeviceId: "",
  silenceDetectionEnabled: true,
  silenceDurationMs: 2500,
  launchAtStartup: false
};
function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}
function loadSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      const parsed = JSON.parse(data);
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      const { openAtLogin } = app.getLoginItemSettings();
      settings.launchAtStartup = openAtLogin;
      return settings;
    }
  } catch (error) {
    console.error("[Settings] Failed to load settings:", error);
  }
  return { ...DEFAULT_SETTINGS };
}
function saveSettings(settings) {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtStartup,
      openAsHidden: true
    });
    return true;
  } catch (error) {
    console.error("[Settings] Failed to save:", error);
    return false;
  }
}
var appSettings = DEFAULT_SETTINGS;
function getWindowPositionPath() {
  return path.join(app.getPath("userData"), "window-position.json");
}
function loadWindowPosition() {
  try {
    const positionPath = getWindowPositionPath();
    if (fs.existsSync(positionPath)) {
      const data = fs.readFileSync(positionPath, "utf-8");
      const parsed = JSON.parse(data);
      const currentDisplayCount = screen.getAllDisplays().length;
      if (parsed.displayCount !== currentDisplayCount) {
        return null;
      }
      const displays = screen.getAllDisplays();
      const isPositionVisible = displays.some((display) => {
        const { x, y, width, height } = display.bounds;
        return parsed.x >= x && parsed.x < x + width && parsed.y >= y && parsed.y < y + height;
      });
      if (!isPositionVisible) {
        return null;
      }
      return parsed;
    }
  } catch (error) {
    console.error("[WindowPosition] Failed to load position:", error);
  }
  return null;
}
function saveWindowPosition(x, y) {
  try {
    const displayCount = screen.getAllDisplays().length;
    const position = { x, y, displayCount };
    const positionPath = getWindowPositionPath();
    fs.writeFileSync(positionPath, JSON.stringify(position, null, 2), "utf-8");
  } catch (error) {
    console.error("[WindowPosition] Failed to save position:", error);
  }
}
var mainWindow = null;
var settingsWindow = null;
var tray = null;
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 700,
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Settings",
    parent: mainWindow || undefined,
    modal: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname2, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (true) {
    settingsWindow.loadURL("http://localhost:5173/settings.html");
  } else {}
  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
  });
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}
function createWindow() {
  const savedPosition = loadWindowPosition();
  mainWindow = new BrowserWindow({
    width: 80,
    height: 100,
    ...savedPosition && { x: savedPosition.x, y: savedPosition.y },
    frame: false,
    transparent: false,
    backgroundColor: "#2a2a2a",
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname2, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (true) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {}
  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      saveWindowPosition(x, y);
    }
  });
  mainWindow.on("close", (event) => {
    if (tray && !app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function getIconPath() {
  const iconName = process.platform === "darwin" ? "tray-iconTemplate.png" : "tray-icon.png";
  if (true) {
    return path.join(app.getAppPath(), "assets", iconName);
  } else {}
}
function createTray() {
  const iconPath = getIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let y = 0;y < size; y++) {
      for (let x = 0;x < size; x++) {
        const idx = (y * size + x) * 4;
        const cx = size / 2, cy = size / 2, r = 6;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (dist <= r) {
          canvas[idx] = 255;
          canvas[idx + 1] = 255;
          canvas[idx + 2] = 255;
          canvas[idx + 3] = 255;
        } else {
          canvas[idx + 3] = 0;
        }
      }
    }
    icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip("Voice Recognition — ⌘⇧R to record");
  updateTrayMenu();
}
function updateTrayMenu() {
  if (!tray)
    return;
  const isVisible = mainWindow?.isVisible() ?? false;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? "Hide Widget" : "Show Widget",
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
      }
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => {
        createSettingsWindow();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}
var TOGGLE_RECORDING_SHORTCUT = process.platform === "darwin" ? "CommandOrControl+Shift+R" : "CommandOrControl+Shift+R";
function registerGlobalShortcuts() {
  const registered = globalShortcut.register(TOGGLE_RECORDING_SHORTCUT, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("toggle-recording");
    }
  });
  if (!registered) {
    console.error("[Shortcut] Failed to register global shortcut:", TOGGLE_RECORDING_SHORTCUT);
  }
}
app.whenReady().then(() => {
  appSettings = loadSettings();
  createWindow();
  createTray();
  registerGlobalShortcuts();
});
app.on("window-all-closed", () => {
  if (!tray && process.platform !== "darwin") {
    app.quit();
  }
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    updateTrayMenu();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.handle("copy-to-clipboard", (_event, text) => {
  clipboard.writeText(text);
  return true;
});
ipcMain.handle("get-api-key", () => {
  return appSettings.apiKey || process.env.GEMINI_API_KEY || "";
});
ipcMain.handle("get-model", () => {
  return appSettings.model || process.env.GEMINI_MODEL || "gemini-3-flash-preview";
});
ipcMain.handle("get-settings", () => {
  const { openAtLogin } = app.getLoginItemSettings();
  return {
    apiKey: appSettings.apiKey || process.env.GEMINI_API_KEY || "",
    model: appSettings.model || process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    languages: appSettings.languages,
    speechDomain: appSettings.speechDomain,
    customDomainHint: appSettings.customDomainHint,
    microphoneDeviceId: appSettings.microphoneDeviceId,
    silenceDetectionEnabled: appSettings.silenceDetectionEnabled,
    silenceDurationMs: appSettings.silenceDurationMs,
    launchAtStartup: openAtLogin
  };
});
ipcMain.handle("save-settings", (_event, settings) => {
  appSettings = { ...appSettings, ...settings };
  return saveSettings(appSettings);
});
ipcMain.handle("open-settings-window", () => {
  createSettingsWindow();
  return true;
});
ipcMain.handle("close-settings-window", () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  return true;
});
