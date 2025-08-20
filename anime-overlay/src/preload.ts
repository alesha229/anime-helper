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
      onEvent: (cb: (data: any) => void) => void;
    };
  }
}
