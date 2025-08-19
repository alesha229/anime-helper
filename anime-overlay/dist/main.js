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
    skipTaskbar: true,
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
          if (obj && obj.type === "shutdown") {
            try {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.close();
              }
              import_electron.app.quit();
            } catch {
            }
            return;
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
