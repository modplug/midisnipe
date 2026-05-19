const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createNativeMidiService } = require("./native-midi.cjs");

const isDev = Boolean(process.env.MIDISNIPE_DEV_SERVER);
const nativeMidi = createNativeMidiService();

function appUrl() {
  if (isDev) return process.env.MIDISNIPE_DEV_SERVER;
  return `file://${path.join(__dirname, "..", "out", "index.html")}`;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#0f0e0c",
    title: "Midisnipe",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadURL(appUrl());

  if (isDev) {
    window.webContents.openDevTools({ mode: "detach" });
  }

  return window;
}

function installPermissions() {
  const permissions = new Set(["midi", "midiSysex"]);

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permissions.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permissions.has(permission);
  });
}

function installMenu() {
  const template = [
    {
      label: "Midisnipe",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Open Web Version",
          click: () => shell.openExternal("https://midisnipe.vercel.app"),
        },
        {
          label: "Open GitHub Releases",
          click: () => shell.openExternal("https://github.com/modplug/midisnipe/releases/latest"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("midisnipe:desktop-info", () => ({
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  midiBackend: nativeMidi.describe(),
}));

ipcMain.handle("midisnipe:list-native-inputs", async () => nativeMidi.listInputs());

ipcMain.handle("midisnipe:save-log", async (_event, payload) => {
  const defaultPath = `midisnipe-${new Date().toISOString().replaceAll(":", "-")}.txt`;
  const result = await dialog.showSaveDialog({
    title: "Save MIDI log",
    defaultPath,
    filters: [{ name: "Text log", extensions: ["txt"] }],
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  await fs.writeFile(result.filePath, String(payload?.text ?? ""), "utf8");
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  installPermissions();
  installMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
