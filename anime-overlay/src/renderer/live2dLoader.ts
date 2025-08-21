/* eslint-disable */

// Shared Live2D model loader used by both viewer and index renderers
// This module encapsulates robust runtime detection, settings rewriting,
// CDN fallbacks, and PIXI stage attachment.

declare const PIXI: any;
import { config } from "../config";

let __loadedRuntime: "c2" | "c4" | null = null;
let __live2d_patches_installed = false;

async function loadScript(src: string): Promise<void> {
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

function getAlternativeURL(u: string): string {
  try {
    if (u.includes("cdn.jsdelivr.net/gh/")) {
      const m = u.match(
        /cdn\.jsdelivr\.net\/gh\/([^@/]+)\/([^@/]+)@[^/]+\/(.+)$/
      );
      if (m)
        return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/master/${m[3]}`;
    }
    if (u.includes("raw.githubusercontent.com/")) {
      const m = u.match(
        /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/[^/]+\/(.+)$/
      );
      if (m)
        return `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@master/${m[3]}`;
    }
  } catch {}
  return u;
}

async function loadJson5IfNeeded(): Promise<any | null> {
  try {
    if ((window as any).JSON5) return (window as any).JSON5;
  } catch {}
  try {
    await loadScript(
      "https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.min.js"
    );
    return (window as any).JSON5 || null;
  } catch {
    return null;
  }
}

function installLive2dPatches(ns: any) {
  if (!ns || __live2d_patches_installed) return;
  try {
    const Loader = ns.Live2DLoader;
    const XHR = ns.XHRLoader;
    if (Loader && XHR && Array.isArray(Loader.middlewares)) {
      const idx = Loader.middlewares.indexOf(XHR.loader);
      if (idx >= 0) {
        const orig = XHR.loader;
        Loader.middlewares[idx] = async (context: any, next: any) => {
          const url = context.settings
            ? context.settings.resolveURL(context.url)
            : context.url;
          try {
            await orig(context, next);
            return;
          } catch (e: any) {
            if (
              !(
                e &&
                e.status === 403 &&
                typeof url === "string" &&
                url.includes("jsdelivr")
              )
            )
              throw e;
          }
          try {
            context.url = getAlternativeURL(url);
          } catch {}
          await orig(context, next);
          return next();
        };
      }
    }
  } catch {}
  try {
    const Factory = ns.Live2DFactory;
    if (Factory && Array.isArray(Factory.live2DModelMiddlewares)) {
      const idx = Factory.live2DModelMiddlewares.indexOf(Factory.urlToJSON);
      if (idx >= 0) {
        Factory.live2DModelMiddlewares[idx] = async (
          context: any,
          next: any
        ) => {
          if (typeof context.source === "string") {
            let url = context.source as string;
            let text: string | null = null;
            try {
              const r1 = await fetch(url);
              text = await r1.text();
            } catch {}
            try {
              if (!text || /^\s*<!DOCTYPE|<html/i.test(text)) {
                const alt = getAlternativeURL(url);
                if (alt && alt !== url) {
                  const r2 = await fetch(alt);
                  const t2 = await r2.text();
                  if (t2) {
                    text = t2;
                    url = alt;
                  }
                }
              }
            } catch {}
            if (!text) throw new Error("Failed to fetch settings JSON");
            let json: any = null;
            try {
              json = JSON.parse(text);
            } catch {
              try {
                const JSON5 = await loadJson5IfNeeded();
                if (JSON5) json = JSON5.parse(text);
              } catch {}
            }
            if (!json) throw new Error("Failed to parse settings JSON");
            try {
              json.url = url;
            } catch {}
            context.source = json;
            try {
              context.live2dModel?.emit?.("settingsJSONLoaded", json);
            } catch {}
          }
          return next();
        };
      }
    }
  } catch {}
  __live2d_patches_installed = true;
}

async function ensureCubism4(): Promise<void> {
  if (!(window as any).Live2DCubismCore) {
    await loadScript("./vendor/live2dcubismcore.min.js");
  }
  if (!(window as any).__live2d_api_c4) {
    await loadScript("./vendor/cubism4.min.js");
    try {
      (window as any).__live2d_api_c4 = (PIXI as any).live2d;
      __loadedRuntime = "c4";
      try {
        (window as any).__loadedRuntime = "c4";
      } catch {}
    } catch {}
  }
  try {
    installLive2dPatches(
      (window as any).__live2d_api_c4 || (PIXI as any).live2d
    );
  } catch {}
}

async function ensureCubism2(): Promise<void> {
  if (!(window as any).Live2D) {
    await loadScript("./vendor/live2d.min.js");
  }
  if (!(window as any).__live2d_api_c2) {
    await loadScript("./vendor/cubism2.min.js");
    try {
      (window as any).__live2d_api_c2 = (PIXI as any).live2d;
      __loadedRuntime = "c2";
      try {
        (window as any).__loadedRuntime = "c2";
      } catch {}
    } catch {}
  }
  try {
    installLive2dPatches(
      (window as any).__live2d_api_c2 || (PIXI as any).live2d
    );
  } catch {}
}

export function detectUseV4FromUrl(u: string | null): boolean | null {
  try {
    if (!u) return null;
    const low = u.toLowerCase();
    if (/(^|\/)model3\.json(\?|$)/.test(low)) return true;
    if (/(^|\/)model\.json(\?|$)/.test(low)) return false;
  } catch {}
  return null;
}

export function detectRuntimeByUrl(u: string | null): boolean | null {
  try {
    if (!u) return null;
    const low = u.toLowerCase();
    if (/\.model3\.json(\?|$)/.test(low) || /\.moc3(\?|$)/.test(low))
      return true;
    if (/\.model\.json(\?|$)/.test(low) || /\.moc(\?|$)/.test(low))
      return false;
    if (/\.json(\?|$)/.test(low)) return false;
  } catch {}
  return null;
}

function toAbsoluteAssetUrl(modelJsonUrl: string, assetPath: string) {
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

function rewriteModelJsonUrls(modelJsonUrl: string, j: any) {
  try {
    if (j && j.FileReferences) {
      if (j.FileReferences.Moc)
        j.FileReferences.Moc = toAbsoluteAssetUrl(
          modelJsonUrl,
          j.FileReferences.Moc
        );
      if (Array.isArray(j.FileReferences.Textures))
        j.FileReferences.Textures = j.FileReferences.Textures.map((t: any) =>
          toAbsoluteAssetUrl(modelJsonUrl, t)
        );
      if (j.FileReferences.Physics)
        j.FileReferences.Physics = toAbsoluteAssetUrl(
          modelJsonUrl,
          j.FileReferences.Physics
        );
      if (j.FileReferences.Motions) {
        for (const g of Object.keys(j.FileReferences.Motions)) {
          const arr = j.FileReferences.Motions[g] || [];
          for (const m of arr)
            if (m.File) m.File = toAbsoluteAssetUrl(modelJsonUrl, m.File);
        }
      }
    }
    if (j) {
      if (j.model) j.model = toAbsoluteAssetUrl(modelJsonUrl, j.model);
      if (Array.isArray(j.textures))
        j.textures = j.textures.map((t: any) =>
          toAbsoluteAssetUrl(modelJsonUrl, t)
        );
      if (j.physics) j.physics = toAbsoluteAssetUrl(modelJsonUrl, j.physics);
      if (j.motions) {
        for (const g of Object.keys(j.motions)) {
          const arr = j.motions[g] || [];
          for (let i = 0; i < arr.length; i++) {
            const m = arr[i];
            if (typeof m === "string")
              arr[i] = { file: toAbsoluteAssetUrl(modelJsonUrl, m) };
            else {
              if ((m as any).file)
                (m as any).file = toAbsoluteAssetUrl(
                  modelJsonUrl,
                  (m as any).file
                );
              if ((m as any).File)
                (m as any).File = toAbsoluteAssetUrl(
                  modelJsonUrl,
                  (m as any).File
                );
            }
          }
        }
      }
    }
  } catch {}
  return j;
}

async function loadSettingsJson(
  url: string,
  forceV4?: boolean | null
): Promise<{
  urlOrSettings: any;
  useV4: boolean | null;
  originalUrl: string;
  groups: string[];
}> {
  let useV4 = forceV4 ?? detectUseV4FromUrl(url);
  const byExt = detectRuntimeByUrl(url);
  let groups: string[] = [];
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const txt = await r.text();
    const j = JSON.parse(txt);
    const cloned = JSON.parse(JSON.stringify(j));
    rewriteModelJsonUrls(url, cloned);
    let isC4 = false;
    try {
      groups = Object.keys(
        j.motions || j.Motions || j.FileReferences?.Motions || {}
      );
    } catch {}
    if (j?.FileReferences?.Moc && /\.moc3$/i.test(String(j.FileReferences.Moc)))
      isC4 = true;
    if (j?.FileReferences?.Moc && /\.moc$/i.test(String(j.FileReferences.Moc)))
      isC4 = false;
    if ((j.model || j.textures || j.motions) && !j.FileReferences) isC4 = false;
    if (forceV4 === true) isC4 = true;
    if (forceV4 === false) isC4 = false;
    if (forceV4 == null) {
      if (byExt === true) isC4 = true;
      if (byExt === false) isC4 = false;
    }
    if (isC4) {
      useV4 = true;
      try {
        (cloned as any).url = url;
      } catch {}
      return { urlOrSettings: cloned, useV4, originalUrl: url, groups };
    }
    useV4 = false;
    return { urlOrSettings: url, useV4, originalUrl: url, groups };
  } catch {
    return { urlOrSettings: url, useV4, originalUrl: url, groups };
  }
}

function clearPixiCaches() {
  try {
    const tex = (PIXI.utils && (PIXI.utils as any).TextureCache) || {};
    for (const k of Object.keys(tex)) {
      try {
        tex[k]?.destroy?.(true);
      } catch {}
      delete tex[k];
    }
  } catch {}
  try {
    const btex = (PIXI.utils && (PIXI.utils as any).BaseTextureCache) || {};
    for (const k of Object.keys(btex)) {
      try {
        btex[k]?.destroy?.();
      } catch {}
      delete btex[k];
    }
  } catch {}
}

export async function loadModel(
  app: any,
  url: string,
  forceV4?: boolean | null
) {
  const stageDiv = document.getElementById("stage") as HTMLElement | null;
  try {
    await clearPixiCaches();
    if ((window as any).__live2d_model) {
      try {
        app.stage.removeChild((window as any).__live2d_model);
        (window as any).__live2d_model.destroy?.(true);
      } catch {}
    }
    (window as any).__live2d_model = undefined;
  } catch {}
  const { urlOrSettings, useV4, originalUrl, groups } = await loadSettingsJson(
    url,
    forceV4
  );
  try {
    localStorage.setItem(config.LAST_MODEL_KEY, originalUrl);
  } catch {}
  try {
    (window as any).overlayAPI?.saveLastModel?.(originalUrl);
  } catch {}
  try {
    const desired: "c2" | "c4" | null =
      useV4 === true ? "c4" : useV4 === false ? "c2" : null;
    if (desired && __loadedRuntime && __loadedRuntime !== desired) {
      (window.location as any).href = `viewer.html`;
      throw new Error("Switching runtime requires reload");
    }
  } catch {}
  if (useV4 === true) await ensureCubism4();
  else if (useV4 === false) await ensureCubism2();
  else await ensureCubism4();

  let model: any = null;
  const ns = useV4
    ? (window as any).__live2d_api_c4 || (PIXI as any).live2d
    : (window as any).__live2d_api_c2 || (PIXI as any).live2d;
  const prevLive2d = (PIXI as any).live2d;
  (PIXI as any).live2d = ns;
  try {
    model = await (PIXI as any).live2d.Live2DModel.from(urlOrSettings, {
      motionPreload: "none",
    });
  } catch {
    try {
      model = await (PIXI as any).live2d.Live2DModel.from(urlOrSettings);
    } catch {
      if (useV4 === false && typeof urlOrSettings === "string") {
        try {
          const resp = await fetch(String(urlOrSettings), {
            headers: { Accept: "application/json" },
          });
          const txt = await resp.text();
          const j = JSON.parse(txt);
          const cloned = JSON.parse(JSON.stringify(j));
          rewriteModelJsonUrls(String(urlOrSettings), cloned);
          model = await (PIXI as any).live2d.Live2DModel.from(cloned);
        } catch {}
      }
    }
  } finally {
    try {
      (PIXI as any).live2d = prevLive2d;
    } catch {}
  }
  try {
    (stageDiv as any).dataset.modelUrl = originalUrl;
  } catch {}
  try {
    (window as any).__live2d_model = model;
  } catch {}
  try {
    model.anchor && model.anchor.set(0.5, 0.5);
  } catch {}
  app.stage.addChild(model);

  const fitModel = () => {
    if (!model) return;
    model.x = app.renderer.width / 2;
    model.y = app.renderer.height / 2;
    try {
      const b = model.getBounds();
      const scale = Math.min(
        0.9,
        (app.renderer.width * 0.9) / Math.max(1, b.width),
        (app.renderer.height * 0.9) / Math.max(1, b.height)
      );
      if (isFinite(scale) && scale > 0) model.scale.set(scale);
    } catch {}
  };
  fitModel();
  return { model, groups, fitModel };
}

export {};
