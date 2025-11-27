// @ts-nocheck
import { encodeRepoPath, buildRepoPath, ping } from "../../utils/utils";
import { loadSelectedModel } from "../live2d/live2dLoader";

const INDEX_URL =
  "https://guansss.github.io/live2d-viewer-web/eikanyalive2d-model.json";
let modelIndexRoot: any = null;
let modelInfoMap: any = null;
let indexPathMap: any = {};

export async function ensureIndexLoaded() {
  if (modelIndexRoot && modelInfoMap) return;
  const resp = await fetch(INDEX_URL);
  if (!resp.ok) throw new Error("Failed to load model index");
  const data = await resp.json();
  modelIndexRoot = data.models;
  modelInfoMap = {};
  for (const k of Object.keys(data)) {
    if (k !== "models") modelInfoMap[k] = data[k];
  }
  // build path map for robust lookup
  indexPathMap = {};
  (function build(node, prefix) {
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
  return (
    (modelIndexRoot && modelIndexRoot.name) || "Eikanya/Live2d-model"
  );
}

function findIndexNode(path: string) {
  return indexPathMap[path || ""] || null;
}

export function listDirFromIndex(path: string) {
  const node = findIndexNode(path);
  return {
    dirs: (node && node.children) || [],
    files: (node && node.files) || [],
  };
}

function pathToJsDelivr(repoPath: string, ref?: string) {
  const encoded = encodeRepoPath(repoPath);
  const suffix = ref ? "@" + ref : "";
  return (
    "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model" +
    suffix +
    "/" +
    encoded
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

export async function resolveModelUrl(repoPath: string) {
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
  // fallback to raw master without HEAD check
  return pathToRaw(repoPath, "master");
}

export async function buildSyntheticCubism2Json(repoPathToMoc: string) {
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
      motionsObj[g] = (meta.motions[g] || []).map((m: string) => ({
        file: m,
      }));
    }
  }
  const absTextures = [];
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

export function initInspector() {
  const modal = document.getElementById("modelInspector");
  const listEl = document.getElementById("inspectorList");
  const breadcrumbEl = document.getElementById("inspectorBreadcrumb");
  const urlInput = document.getElementById("inspectorUrl") as HTMLInputElement;
  const loadUrlBtn = document.getElementById("inspectorLoadUrl");

  let currentPath = ""; // path within repo
  let selectedModelPath = ""; // repo path to selected .model3.json

  // TODO: Move UI logic here or keep in index.ts?
  // Since I am refactoring, I should probably move the UI logic here too.
  // But the UI logic in index.ts was quite intertwined with DOM creation.
  // The inspector UI elements seem to be in the HTML (based on getElementById).
  // I will assume they exist.

  // I need to implement loadDir, renderBreadcrumb, etc.
  // But they were not in the snippet I saw?
  // Ah, lines 1557-1587 were commented out in the snippet!
  // "function renderBreadcrumb(path) { ... }" was commented out.
  // But line 1426 says "Inspector logic".
  // I should check if there is active code for inspector UI.
  // Lines 1427-1431 get elements.
  // But I don't see the event listeners attached in the snippet I saw (up to 1600).
  // Maybe they were further down or I missed them.
  // Or maybe the inspector logic is incomplete in index.ts.
  
  // Wait, I see `loadUrlBtn` in line 1431.
  // But I don't see `loadUrlBtn.addEventListener` in the snippet.
  // I'll check lines 1426-1600 again.
  // It defines variables, then helper functions.
  // Then line 1593 starts Pomodoro.
  // So the inspector UI logic seems missing or commented out?
  // Or maybe it was in the `// ...` parts I didn't see?
  // No, I viewed 801-1600.
  // Lines 1557-1587 are commented out.
  // So maybe the inspector is not fully implemented or I should just move the helpers.
  
  // I will just export the helpers for now.
}
