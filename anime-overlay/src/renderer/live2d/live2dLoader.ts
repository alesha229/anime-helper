/* eslint-disable */
// @ts-nocheck
// Shared Live2D model loader used by both viewer and index renderers
// This module encapsulates robust runtime detection, settings rewriting,
// CDN fallbacks, and PIXI stage attachment.

import { app } from "../index";
import { config } from "../../config";
const MODELS = config.MODELS;
const LAST_MODEL_KEY = config.LAST_MODEL_KEY;
import {
  makeAbsolute,
  toAbsoluteAssetUrl,
  encodeRepoPath,
  buildRepoPath,
  sayRandom,
  ping,
  log,
} from "../../utils/utils";
import { stateKeyFor } from "./live2dutils";
import { getModel, setModel } from "../modelStore";
import { getLipSyncState, setLipSyncState } from "../lipsync/lipsyncState";
import {
  getmotionEntries,
  setmotionEntries,
  getavailableGroups,
  setavailableGroups,
} from "../modelIterations/motionState";
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

// --- Index / repo helpers moved from index.ts ---
const INDEX_URL =
  "https://guansss.github.io/live2d-viewer-web/eikanyalive2d-model.json";
let modelIndexRoot: any = null;
let modelInfoMap: any = null;
let indexPathMap: any = {};
async function ensureIndexLoaded() {
  if (modelIndexRoot && modelInfoMap) return;
  const resp = await fetch(INDEX_URL);
  if (!resp.ok) throw new Error("Failed to load model index");
  const data = await resp.json();
  modelIndexRoot = data.models;
  modelInfoMap = {};
  for (const k of Object.keys(data)) {
    if (k !== "models") modelInfoMap[k] = data[k];
  }
  indexPathMap = {};
  (function build(node: any, prefix: string) {
    const path = prefix || "";
    indexPathMap[path] = node;
    const children = (node && node.children) || [];
    for (const ch of children) {
      if (!ch || !ch.name) continue;
      const next = path ? path + "/" + ch.name : ch.name;
      build(ch, next);
    }
  })(modelIndexRoot, "");
}
function indexRootName() {
  return (modelIndexRoot && modelIndexRoot.name) || "Eikanya/Live2d-model";
}
function findIndexNode(path: string) {
  return indexPathMap[path || ""] || null;
}
function listDirFromIndex(path: string) {
  const node = findIndexNode(path);
  return {
    dirs: (node && node.children) || [],
    files: (node && node.files) || [],
  };
}
function urlToRepoPath(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "raw.githubusercontent.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      return decodeURIComponent(parts.slice(3).join("/"));
    }
    if (u.hostname === "cdn.jsdelivr.net") {
      const m = u.pathname.match(/\/gh\/Eikanya\/Live2d-model@[^/]+\/(.*)$/);
      if (m) return decodeURIComponent(m[1]);
    }
  } catch {}
  return null;
}
async function resolveModelUrl(repoPath: string) {
  const tries = [
    pathToJsDelivr(repoPath, "master"),
    pathToJsDelivr(repoPath, "v1.0.0"),
    pathToRaw(repoPath, "master"),
    pathToRaw(repoPath, "v1.0.0"),
  ];
  for (const url of tries) {
    try {
      const r = await fetch(url, { method: "HEAD" });
      if (r.ok) return url;
    } catch {}
  }
  return pathToRaw(repoPath, "master");
}
function pathToJsDelivr(repoPath: string, ref?: string) {
  const encoded = encodeRepoPath(repoPath);
  const suffix = ref ? "@" + ref : "";
  return (
    "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model" + suffix + "/" + encoded
  );
}
function pathToRaw(repoPath: string, ref?: string) {
  const encoded = encodeRepoPath(repoPath);
  const branch = ref || "master";
  return (
    "https://raw.githubusercontent.com/Eikanya/Live2d-model/" +
    branch +
    "/" +
    encoded
  );
}
async function tryFindAlternateModelJsonUrl(originalUrl: string) {
  const baseDir = originalUrl.replace(/[^/]+$/, "");
  const tryCandidates = async (names: string[]) => {
    for (const name of names) {
      const cand = baseDir + name;
      try {
        const r = await fetch(cand, { method: "HEAD" });
        if (r.ok) return cand;
      } catch {}
    }
    return null;
  };
  const simple = await tryCandidates(["model.json", "model.model.json"]);
  if (simple) return simple;
  try {
    await ensureIndexLoaded();
    const repoPath = urlToRepoPath(originalUrl);
    if (!repoPath) return null;
    const dir = repoPath.replace(/\/?[^/]*$/, "");
    const node = findIndexNode(dir);
    const files = (node && node.files) || [];
    const sorted = files
      .filter((f: string) => /\.json$/i.test(f) && !/model3\.json$/i.test(f))
      .sort((a: string, b: string) =>
        a.toLowerCase() === "model.json" ? -1 : 1
      );
    for (const f of sorted) {
      const url = await resolveModelUrl((dir ? dir + "/" : "") + f);
      try {
        const r = await fetch(url, { method: "HEAD" });
        if (r.ok) return url;
      } catch {}
    }
  } catch {}
  return null;
}

async function buildSyntheticCubism2Json(repoPathToMoc: string) {
  const key = indexRootName() + "/" + repoPathToMoc;
  const meta = modelInfoMap[key] || {};
  const dir = repoPathToMoc.replace(/\/?[^/]*$/, "");
  const modelUrl = await resolveModelUrl(repoPathToMoc);
  const textures = Array.isArray(meta.textures)
    ? meta.textures
    : ["texture_00.png"];
  const motionsObj: any = {};
  if (meta.motions) {
    for (const g of Object.keys(meta.motions)) {
      motionsObj[g] = (meta.motions[g] || []).map((m: any) => ({ file: m }));
    }
  }
  const absTextures: string[] = [];
  for (const t of textures)
    absTextures.push(await resolveModelUrl((dir ? dir + "/" : "") + t));
  const absPhysics = meta.physics
    ? await resolveModelUrl((dir ? dir + "/" : "") + meta.physics)
    : undefined;
  const json: any = { model: modelUrl, textures: absTextures };
  if (absPhysics) json.physics = absPhysics;
  if (Object.keys(motionsObj).length) json.motions = motionsObj;
  return (
    "data:application/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(json))
  );
}

export async function loadModel(
  app: any,
  url: string,
  forceV4?: boolean | null
) {
  const stageDiv = document.getElementById("stage") as HTMLElement | null;
  try {
    await clearPixiCaches();
    if (getModel()) {
      try {
        app.stage.removeChild(getModel());
        getModel()?.destroy?.(true);
      } catch {}
    }
    setModel(undefined);
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
  setModel(model);
  try {
    (stageDiv as any).dataset.modelUrl = originalUrl;
  } catch {}
  try {
    // (window as any).__live2d_model = model; // This line is removed as per the edit hint
  } catch {}
  try {
    getModel()?.anchor && getModel().anchor.set(0.5, 0.5);
  } catch {}
  try {
    enableDraggingForModel(app, getModel());
  } catch {}
  app.stage.addChild(getModel());

  const fitModel = () => {
    if (!getModel()) return;
    getModel().x = app.renderer.width / 2;
    getModel().y = app.renderer.height / 2;
    try {
      const b = getModel().getBounds();
      const scale = Math.min(
        0.9,
        (app.renderer.width * 0.9) / Math.max(1, b.width),
        (app.renderer.height * 0.9) / Math.max(1, b.height)
      );
      if (isFinite(scale) && scale > 0) getModel().scale.set(scale);
    } catch {}
  };
  fitModel();
  return { model, groups, fitModel };
}
export async function loadSelectedModel(url) {
  const model = getModel();
  if (model) {
    try {
      app.stage.removeChild(model);
      model.destroy(true);
    } catch (e) {}
    if (getLipSyncState().lipSyncEnabled) stopLipSync();
  }
  // reset motions UI and load via viewer-style helper
  setmotionEntries([]);
  // refreshAnimationsUI();
  const byExt = detectRuntimeByUrl(url);
  const res = await loadModel(app, url, byExt);
  setModel(res && (res as any).model ? (res as any).model : null);
  try {
    (window as any).__current_model_url = String(url);
  } catch {}
  setavailableGroups(Array.isArray((res as any)?.groups))
    ? (res as any).groups
    : [];
  // Re-enable interactions now that the model is loaded
  try {
    enableDraggingForModel(model);
  } catch {}
  scheduleGroupRefresh();
  // Try restore previously saved position/scale
  try {
    await restoreModelState();
  } catch {}
  // wait two frames for layout before measuring
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))
  );
  // restore old positioning timing: fit and reveal after layout settles
  try {
    fitModelToCanvas();
    if (model) {
      (model as any).alpha = 1;
      (model as any).visible = true;
    }
  } catch {}
  // Save restored/fitted state for consistency
  try {
    saveModelState();
  } catch {}
  // start Idle loop depending on runtime
  try {
    if (currentRuntime === "c4") {
      startIdleLoopC4(model);
    } else {
      startIdleLoop(
        model,
        Array.from(
          new Set(
            (getmotionEntries() || []).map((e) => String(e.group || "").trim())
          )
        ).filter(Boolean)
      );
    }
  } catch {}
  // Start microphone-driven lipsync automatically
  try {
    await startLipSync();
  } catch {}
}
export function scheduleGroupRefresh() {
  const model = getModel();
  let attempts = 16;
  const poll = () => {
    if (!model) return;
    try {
      const mm = model.internalModel && model.internalModel.motionManager;
      const groups = getGroupsFromManager(mm);
      if (groups && groups.length) {
        setavailableGroups(
          Array.from(new Set([...(getavailableGroups() || []), ...groups]))
        );
        refreshAnimationsUI();
        return;
      }
    } catch (e) {}
    if (--attempts > 0) setTimeout(poll, 250);
  };
  poll();
}
export function getGroupsFromManager(mm) {
  try {
    const defs = mm && (mm.definitions || mm._definitions || mm._motions || {});
    return Object.keys(defs || {});
  } catch (e) {
    return [];
  }
}
// --- Drag & Drop для Live2D модели ---
const dragState: any = {
  active: false,
  data: null,
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
  target: null,
};

export function installStageDragHandlers(app: any, model: any) {
  try {
    if ((app.stage as any).__dragHandlersInstalled) return;
    (app.stage as any).interactive = true;
    const onMove = (ev: any) => {
      try {
        if (!dragState.active || !dragState.data || !dragState.target) return;
        const parent = dragState.target.parent || app.stage;
        const p = dragState.data.getLocalPosition(parent);
        const nx = dragState.origX + (p.x - dragState.startX);
        const ny = dragState.origY + (p.y - dragState.startY);
        dragState.target.position.set(nx, ny);
      } catch {}
    };
    const onUp = () => {
      try {
        if (dragState.target) {
          try {
            (dragState.target as any).__userMoved = true;
          } catch {}
          try {
            (dragState.target as any).cursor = "grab";
          } catch {}
          try {
            saveModelState(model);
          } catch {}
        }
        dragState.active = false;
        dragState.data = null;
        dragState.target = null;
      } catch {}
    };
    app.stage.on("pointermove", onMove);
    app.stage.on("pointerup", onUp);
    app.stage.on("pointerupoutside", onUp);
    app.stage.on("pointercancel", onUp as any);
    (app.stage as any).__dragHandlersInstalled = true;
  } catch {}
}
export function saveModelState(model: any) {
  try {
    const url = getCurrentModelUrl();
    if (!url || !model) return;
    const x = Number((model as any).x) || 0;
    const y = Number((model as any).y) || 0;
    const scale = Number((model as any).scale?.x) || 1;
    try {
      (window as any).overlayAPI?.saveModelState?.(url, x, y, scale);
    } catch {}
    const state = { x, y, scale };
    localStorage.setItem(stateKeyFor(url), JSON.stringify(state));
  } catch {}
}
async function restoreModelState() {
  try {
    const url = getCurrentModelUrl();
    if (!url || !model) return false;
    let s: any = null;
    try {
      s = await (window as any).overlayAPI?.getModelState?.(url);
    } catch {}
    if (!s) {
      const raw = localStorage.getItem(stateKeyFor(url));
      if (raw) s = JSON.parse(raw || "null");
    }
    if (!s || typeof s !== "object") return false;
    if (isFinite(Number(s.x)) && isFinite(Number(s.y))) {
      (model as any).x = Number(s.x);
      (model as any).y = Number(s.y);
      try {
        (model as any).__userMoved = true;
      } catch {}
    }
    if (isFinite(Number(s.scale)) && Number(s.scale) > 0) {
      (model as any).scale?.set(Number(s.scale));
      try {
        (model as any).__userScaled = true;
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

export function getCurrentModelUrl(): string {
  try {
    return (
      ((window as any).__current_model_url as string) ||
      localStorage.getItem(LAST_MODEL_KEY) ||
      ""
    );
  } catch {
    return "";
  }
}
export function enableDraggingForModel(
  app: any,
  target: any,
  saveModelState: () => void
) {
  if (!target) return;
  installStageDragHandlers(app, target, saveModelState);
  try {
    target.interactive = true;
    (target as any).cursor = "grab";
  } catch {}
  const onDown = (event: any) => {
    try {
      dragState.active = true;
      dragState.data = event.data || event;
      dragState.target = target;
      const parent = target.parent || app.stage;
      const p = dragState.data.getLocalPosition(parent);
      dragState.startX = p.x;
      dragState.startY = p.y;
      dragState.origX = target.x;
      dragState.origY = target.y;
      try {
        (target as any).cursor = "grabbing";
      } catch {}
      if (event.stopPropagation) event.stopPropagation();
    } catch {}
  };
  target.on("pointerdown", onDown);
  target.on("touchstart", onDown);
}
// export async function tryLoadModel(url) {
//   try {
//     const resp = await fetch(url, { method: "GET" });
//     if (!resp.ok)
//       throw new Error(
//         "HTTP " + resp.status + " " + resp.statusText + " for " + url
//       );
//     let discoveredMotionGroups = [];
//     try {
//       discoveredMotionGroups = await preloadMotionsFromModelJson(url);
//     } catch (e) {
//       console.warn(e);
//     }
//     await setModel(PIXI.live2d.Live2DModel.from(url));
//     try {
//       (getModel() as any).__motionGroups = discoveredMotionGroups;
//     } catch (e) {}
//     return getModel();
//   } catch (err) {
//     throw new Error(
//       "Failed to load model from " +
//         url +
//         " — " +
//         (err && err.message ? err.message : err)
//     );
//   }
// }

export {};
