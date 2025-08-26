// Сервис для работы с localStorage и overlayAPI

export function getLastModel(): string | null {
  try {
    if (
      window.overlayAPI &&
      typeof window.overlayAPI.getLastModel === "function"
    ) {
      return window.overlayAPI.getLastModel();
    }
    return localStorage.getItem("LAST_MODEL_KEY");
  } catch {
    return null;
  }
}

export function saveLastModel(url: string): void {
  try {
    localStorage.setItem("LAST_MODEL_KEY", url);
    if (
      window.overlayAPI &&
      typeof window.overlayAPI.saveLastModel === "function"
    ) {
      window.overlayAPI.saveLastModel(url);
    }
  } catch {}
}
