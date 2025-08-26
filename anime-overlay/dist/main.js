"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/main.ts
var import_electron = require("electron");
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var mainWindow = null;
var initialBounds = null;
var lastModelFile = () => path.join(import_electron.app.getPath("userData"), "last_model.json");
var modelStateFile = () => path.join(import_electron.app.getPath("userData"), "model_state.json");
var zoomSettingsFile = () => path.join(import_electron.app.getPath("userData"), "zoom_settings.json");
function createWindow() {
  const primary = import_electron.screen.getPrimaryDisplay();
  const area = primary && primary.workArea || primary.bounds || { width: 1920, height: 1080, x: 0, y: 0 };
  const winW = 360;
  const winH = 640;
  const x = area.x + area.width - winW;
  const y = area.y + area.height - winH;
  mainWindow = new import_electron.BrowserWindow({
    width: winW,
    height: winH,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: false,
    x,
    y,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  initialBounds = mainWindow.getBounds();
  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
  mainWindow.setIgnoreMouseEvents(false);
  try {
    const candidates = [
      path.join(__dirname, "../public/events.json"),
      path.join(__dirname, "../events.json")
    ];
    for (const eventsFile of candidates) {
      if (!fs.existsSync(eventsFile)) continue;
      const emitFromFile = () => {
        try {
          const txt = fs.readFileSync(eventsFile, "utf8");
          const obj = JSON.parse(txt);
          try {
            if (obj && obj.type === "caret") {
              const primary2 = import_electron.screen.getPrimaryDisplay();
              const area2 = primary2 && primary2.workArea || primary2.bounds || { x: 0, y: 0 };
              const fontSize = Number(obj.fontSize) || 14;
              const lineHeight = fontSize * 1.25;
              const charWidth = fontSize * 0.6;
              const editorLeft = area2.x + 40;
              const editorTop = area2.y + 60;
              const gutter = 56;
              const visibleStart = typeof obj.visibleStart === "number" ? obj.visibleStart : obj.line;
              const rowOffset = (typeof obj.line === "number" ? obj.line : 0) - visibleStart;
              const caretX = editorLeft + gutter + (typeof obj.character === "number" ? obj.character : 0) * charWidth;
              const caretY = editorTop + rowOffset * lineHeight + lineHeight / 2;
              obj.screenX = Math.round(caretX);
              obj.screenY = Math.round(caretY);
              obj._caretMapping = {
                editorLeft,
                editorTop,
                gutter,
                lineHeight,
                charWidth
              };
            }
          } catch (e) {
          }
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send("overlay-event", obj);
        } catch {
        }
      };
      emitFromFile();
      fs.watch(eventsFile, { persistent: false }, emitFromFile);
      break;
    }
  } catch (e) {
    console.warn("Events watcher failed", e);
  }
  import_electron.ipcMain.handle("overlay-toggle-click-through", (_event, enabled) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(!!enabled, { forward: true });
      return true;
    }
    return false;
  });
  import_electron.ipcMain.on("overlay-close", () => {
    if (mainWindow) mainWindow.close();
  });
  import_electron.ipcMain.on("overlay-set-opacity", (_event, value) => {
    if (mainWindow) mainWindow.setOpacity(Number(value));
  });
  import_electron.ipcMain.on("overlay-open-devtools", () => {
    if (mainWindow) mainWindow.webContents.openDevTools({ mode: "right" });
  });
  import_electron.ipcMain.on("overlay-enter-fullscreen", () => {
    if (!mainWindow) return;
    try {
      initialBounds = mainWindow.getBounds();
    } catch {
    }
    const { bounds } = import_electron.screen.getPrimaryDisplay();
    mainWindow.setBounds(
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      false
    );
  });
  import_electron.ipcMain.on("overlay-exit-fullscreen", () => {
    if (!mainWindow) return;
    if (initialBounds) mainWindow.setBounds(initialBounds, false);
  });
  import_electron.ipcMain.on("overlay-save-last-model", (_ev, url) => {
    try {
      const file = lastModelFile();
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ url }), { encoding: "utf8" });
    } catch {
    }
  });
  import_electron.ipcMain.handle("overlay-get-last-model", () => {
    try {
      const file = lastModelFile();
      if (!fs.existsSync(file)) return null;
      const t = fs.readFileSync(file, "utf8");
      const j = JSON.parse(t);
      return j && j.url || null;
    } catch {
      return null;
    }
  });
  import_electron.ipcMain.on(
    "overlay-save-model-state",
    (_ev, payload) => {
      try {
        if (!payload || !payload.url) return;
        const file = modelStateFile();
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let map = {};
        try {
          if (fs.existsSync(file)) {
            const txt = fs.readFileSync(file, "utf8");
            map = JSON.parse(txt) || {};
          }
        } catch {
        }
        map[payload.url] = {
          x: Number(payload.x) || 0,
          y: Number(payload.y) || 0,
          scale: Number(payload.scale) || 1,
          savedAt: Date.now()
        };
        fs.writeFileSync(file, JSON.stringify(map), { encoding: "utf8" });
      } catch {
      }
    }
  );
  import_electron.ipcMain.handle("overlay-get-model-state", (_ev, url) => {
    try {
      if (!url) return null;
      const file = modelStateFile();
      if (!fs.existsSync(file)) return null;
      const txt = fs.readFileSync(file, "utf8");
      const map = JSON.parse(txt) || {};
      const s = map[url];
      if (!s) return null;
      return {
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        scale: Number(s.scale) || 1
      };
    } catch {
      return null;
    }
  });
  import_electron.ipcMain.handle(
    "overlay-set-zoom-factor",
    async (_ev, zoomFactor = 1) => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.setZoomFactor(zoomFactor);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to set zoom factor:", error);
        return false;
      }
    }
  );
  import_electron.ipcMain.on(
    "overlay-save-zoom-setting",
    (_ev, payload) => {
      try {
        if (!payload || !payload.url) return;
        const file = zoomSettingsFile();
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        let map = {};
        try {
          if (fs.existsSync(file)) {
            const txt = fs.readFileSync(file, "utf8");
            map = JSON.parse(txt) || {};
          }
        } catch {
        }
        map[payload.url] = {
          zoomFactor: Number(payload.zoomFactor) || 1,
          savedAt: Date.now()
        };
        fs.writeFileSync(file, JSON.stringify(map), { encoding: "utf8" });
      } catch {
      }
    }
  );
  import_electron.ipcMain.handle("overlay-get-zoom-setting", (_ev, url) => {
    try {
      if (!url) return 1;
      const file = zoomSettingsFile();
      if (!fs.existsSync(file)) return 1;
      const txt = fs.readFileSync(file, "utf8");
      const map = JSON.parse(txt) || {};
      const setting = map[url];
      if (!setting) return 1;
      return Number(setting.zoomFactor) || 1;
    } catch {
      return 1;
    }
  });
}
import_electron.app.whenReady().then(() => {
  createWindow();
  import_electron.app.on("activate", function() {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  try {
    const ppidStr = process.env.VSCODE_PARENT_PID || "";
    const ppid = Number(ppidStr);
    if (ppid && Number.isFinite(ppid)) {
      const interval = setInterval(() => {
        try {
          process.kill(ppid, 0);
        } catch {
          try {
            clearInterval(interval);
          } catch {
          }
          try {
            import_electron.app.quit();
          } catch {
          }
        }
      }, 1500);
      import_electron.app.once("before-quit", () => {
        try {
          clearInterval(interval);
        } catch {
        }
      });
    }
  } catch {
  }
});
import_electron.app.on("window-all-closed", function() {
  if (process.platform !== "darwin") import_electron.app.quit();
});
//# sourceMappingURL=main.js.map
