import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlayAPI", {
  toggleClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke("overlay-toggle-click-through", enabled),
  close: () => ipcRenderer.send("overlay-close"),
  setOpacity: (v: number | string) =>
    ipcRenderer.send("overlay-set-opacity", v),
  openDevTools: () => ipcRenderer.send("overlay-open-devtools"),
  enterFullscreen: () => ipcRenderer.send("overlay-enter-fullscreen"),
  exitFullscreen: () => ipcRenderer.send("overlay-exit-fullscreen"),
  saveLastModel: (url: string) =>
    ipcRenderer.send("overlay-save-last-model", url),
  getLastModel: (): Promise<string | null> =>
    ipcRenderer.invoke("overlay-get-last-model"),
  saveModelState: (url: string, x: number, y: number, scale: number) =>
    ipcRenderer.send("overlay-save-model-state", { url, x, y, scale }),
  getModelState: (
    url: string
  ): Promise<{ x: number; y: number; scale: number } | null> =>
    ipcRenderer.invoke("overlay-get-model-state", url),
  // Return caret/screen typing position from host (optional)
  getCaretPosition: (): Promise<{ x: number; y: number } | null> =>
    ipcRenderer.invoke("overlay-get-caret-position"),
  setZoomFactor: (zoomFactor: number = 1.0) =>
    ipcRenderer.invoke("overlay-set-zoom-factor", zoomFactor),
  saveZoomSetting: (url: string, zoomFactor: number) =>
    ipcRenderer.send("overlay-save-zoom-setting", { url, zoomFactor }),
  getZoomSetting: (url: string): Promise<number> =>
    ipcRenderer.invoke("overlay-get-zoom-setting", url),
  onEvent: (cb: (data: any) => void) => {
    ipcRenderer.on("overlay-event", (_ev, data) => {
      try {
        cb(data);
      } catch (e) {
        console.error(e);
      }
    });
  },
});

declare global {
  interface Window {
    overlayAPI: {
      toggleClickThrough: (enabled: boolean) => Promise<boolean>;
      close: () => void;
      setOpacity: (v: number | string) => void;
      openDevTools: () => void;
      enterFullscreen: () => void;
      exitFullscreen: () => void;
      saveLastModel: (url: string) => void;
      getLastModel: () => Promise<string | null>;
      setZoomFactor: (zoomFactor?: number) => Promise<boolean>;
      saveZoomSetting: (url: string, zoomFactor: number) => void;
      getZoomSetting: (url: string) => Promise<number>;
      onEvent: (cb: (data: any) => void) => void;
      saveModelState: (
        url: string,
        x: number,
        y: number,
        scale: number
      ) => void;
      getModelState: (
        url: string
      ) => Promise<{ x: number; y: number; scale: number } | null>;
      getCaretPosition: () => Promise<{ x: number; y: number } | null>;
    };
  }
}
