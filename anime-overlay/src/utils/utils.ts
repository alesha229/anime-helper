// Утилиты для работы с путями, строками, массивами и логированием

export function makeAbsolute(baseUrl: string, relative: string): string {
  try {
    if (!relative) return relative;
    if (/^https?:\/\//i.test(relative)) return relative;
    const base = baseUrl.replace(/[^/]+$/, "");
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}

export function toAbsoluteAssetUrl(
  modelJsonUrl: string,
  assetPath: string
): string {
  if (!assetPath) return assetPath;
  if (/^https?:/i.test(assetPath) || assetPath.startsWith("data:"))
    return assetPath;
  try {
    const base = modelJsonUrl.replace(/\/[^/]*$/, "/");
    return new URL(assetPath, base).href;
  } catch {
    return assetPath;
  }
}

export function encodeRepoPath(path: string): string {
  return (path || "")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export function buildRepoPath(path: string, name: string): string {
  return (path ? path + "/" : "") + name;
}

export function sayRandom<T>(list: T[]): T | null {
  try {
    if (!Array.isArray(list) || !list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)];
    return pick;
  } catch {
    return null;
  }
}

export async function ping(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

export function log(...args: any[]): void {
  if (typeof window !== "undefined" && window.console) {
    window.console.log("[utils]", ...args);
  }
}
window.addEventListener("keydown", (e) => {
  if (e.key === "F12" && window.overlayAPI && window.overlayAPI.openDevTools)
    window.overlayAPI.openDevTools();
});
