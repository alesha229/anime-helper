import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

let mainWindow: BrowserWindow | null = null;
let initialBounds: Electron.Rectangle | null = null;
// Persist last model path in userData to survive abrupt exits
const lastModelFile = () =>
  path.join(app.getPath("userData"), "last_model.json");

function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const area = (primary && (primary as any).workArea) ||
    (primary as any).bounds || { width: 1920, height: 1080, x: 0, y: 0 };
  const winW = 360;
  const winH = 640;
  const x = (area as any).x + (area as any).width - winW;
  const y = (area as any).y + (area as any).height - winH;

  mainWindow = new BrowserWindow({
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
      nodeIntegration: false,
    },
  });

  initialBounds = mainWindow.getBounds();

  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
  mainWindow.setIgnoreMouseEvents(false);

  // watch for events.json written by the VS Code extension
  try {
    const candidates = [
      path.join(__dirname, "../public/events.json"),
      path.join(__dirname, "../events.json"),
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
              app.quit();
            } catch {}
            return;
          }
          if (mainWindow && !mainWindow.isDestroyed())
            mainWindow.webContents.send("overlay-event", obj);
        } catch {}
      };
      // initial read
      emitFromFile();
      // watch for changes
      fs.watch(eventsFile, { persistent: false }, emitFromFile);
      break; // bind to first existing
    }
  } catch (e) {
    console.warn("Events watcher failed", e);
  }

  // IPC handlers
  ipcMain.handle("overlay-toggle-click-through", (_event, enabled: boolean) => {
    if (mainWindow) {
      mainWindow.setIgnoreMouseEvents(!!enabled, { forward: true });
      return true;
    }
    return false;
  });

  ipcMain.on("overlay-close", () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on("overlay-set-opacity", (_event, value: number | string) => {
    if (mainWindow) mainWindow.setOpacity(Number(value));
  });
  ipcMain.on("overlay-open-devtools", () => {
    if (mainWindow) mainWindow.webContents.openDevTools({ mode: "right" });
  });

  ipcMain.on("overlay-enter-fullscreen", () => {
    if (!mainWindow) return;
    try {
      initialBounds = mainWindow.getBounds();
    } catch {}
    const { bounds } = screen.getPrimaryDisplay();
    mainWindow.setBounds(
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      false
    );
  });
  ipcMain.on("overlay-exit-fullscreen", () => {
    if (!mainWindow) return;
    if (initialBounds) mainWindow.setBounds(initialBounds, false);
  });

  // Persist last model via filesystem (sync writes are fine for small JSON)
  ipcMain.on("overlay-save-last-model", (_ev, url: string) => {
    try {
      const file = lastModelFile();
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ url }), { encoding: "utf8" });
    } catch {}
  });
  ipcMain.handle("overlay-get-last-model", () => {
    try {
      const file = lastModelFile();
      if (!fs.existsSync(file)) return null;
      const t = fs.readFileSync(file, "utf8");
      const j = JSON.parse(t);
      return (j && j.url) || null;
    } catch {
      return null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Watchdog: if VS Code parent PID is provided and exits, quit overlay
  try {
    const ppidStr = process.env.VSCODE_PARENT_PID || "";
    const ppid = Number(ppidStr);
    if (ppid && Number.isFinite(ppid)) {
      const interval = setInterval(() => {
        try {
          process.kill(ppid, 0);
          // parent alive
        } catch {
          try {
            clearInterval(interval);
          } catch {}
          try {
            app.quit();
          } catch {}
        }
      }, 1500);
      app.once("before-quit", () => {
        try {
          clearInterval(interval);
        } catch {}
      });
    }
  } catch {}
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
