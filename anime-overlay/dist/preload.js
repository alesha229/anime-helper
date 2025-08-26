"use strict";

// src/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("overlayAPI", {
  toggleClickThrough: (enabled) => import_electron.ipcRenderer.invoke("overlay-toggle-click-through", enabled),
  close: () => import_electron.ipcRenderer.send("overlay-close"),
  setOpacity: (v) => import_electron.ipcRenderer.send("overlay-set-opacity", v),
  openDevTools: () => import_electron.ipcRenderer.send("overlay-open-devtools"),
  enterFullscreen: () => import_electron.ipcRenderer.send("overlay-enter-fullscreen"),
  exitFullscreen: () => import_electron.ipcRenderer.send("overlay-exit-fullscreen"),
  saveLastModel: (url) => import_electron.ipcRenderer.send("overlay-save-last-model", url),
  getLastModel: () => import_electron.ipcRenderer.invoke("overlay-get-last-model"),
  saveModelState: (url, x, y, scale) => import_electron.ipcRenderer.send("overlay-save-model-state", { url, x, y, scale }),
  getModelState: (url) => import_electron.ipcRenderer.invoke("overlay-get-model-state", url),
  // Return caret/screen typing position from host (optional)
  getCaretPosition: () => import_electron.ipcRenderer.invoke("overlay-get-caret-position"),
  setZoomFactor: (zoomFactor = 1) => import_electron.ipcRenderer.invoke("overlay-set-zoom-factor", zoomFactor),
  saveZoomSetting: (url, zoomFactor) => import_electron.ipcRenderer.send("overlay-save-zoom-setting", { url, zoomFactor }),
  getZoomSetting: (url) => import_electron.ipcRenderer.invoke("overlay-get-zoom-setting", url),
  onEvent: (cb) => {
    import_electron.ipcRenderer.on("overlay-event", (_ev, data) => {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    });
  }
});
//# sourceMappingURL=preload.js.map
