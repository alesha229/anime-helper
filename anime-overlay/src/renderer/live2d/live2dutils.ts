import { getModel, setModel } from "../modelStore";
import { app } from "../index";

export function fitModelToCanvas() {
  const model = getModel();
  if (!model) return;
  try {
    if (model.anchor && typeof model.anchor.set === "function") {
      model.anchor.set(0.5, 0.5);
    }
  } catch {}
  try {
    const userMoved = !!(model as any).__userMoved;
    if (!userMoved) {
      model.x = app.renderer.width / 2;
      model.y = app.renderer.height / 2;
    }
    const b = model.getBounds();
    const bw = Math.max(1, b.width);
    const bh = Math.max(1, b.height);
    // Slightly smaller than strict fit to avoid oversizing in index view
    const fudge = 0.5;
    const base = Math.min(
      (app.renderer.width * 0.4) / bw,
      (app.renderer.height * 0.4) / bh
    );
    const baseScale = Math.max(0.1, base * fudge);
    (window as any).__live2d_base_scale = baseScale;
    let factor = 1;
    try {
      const input = document.getElementById(
        "opacity"
      ) as HTMLInputElement | null;
      if (input)
        factor = Math.max(0.5, Math.min(1.5, Number(input.value) || 1));
    } catch {}
    const userScaled = !!(model as any).__userScaled;
    if (!userScaled) {
      if (isFinite(baseScale) && baseScale > 0) {
        const conservative = 0.85;
        model.scale.set(baseScale * factor * conservative);
      }
    }
  } catch {}
}
export async function preloadMotionsFromModelJson(modelJsonUrl: string) {
  try {
    const resp = await fetch(modelJsonUrl);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const json = await resp.json();
    const base = modelJsonUrl.replace(/[^/]+$/, "");
    const motions = json.motions || {};
    const groups = Object.keys(motions);
    const files = [];
    for (const g of groups) {
      const arr = motions[g] || [];
      for (const item of arr) {
        if (item && item.file) files.push(base + item.file);
      }
    }
    for (const f of files) {
      try {
        await fetch(f);
      } catch (e) {}
    }
    return groups;
  } catch (e) {
    console.warn("preloadMotionsFromModelJson failed", e);
    return [];
  }
}
export function resizeStageToContainer() {
  try {
    const modelContainerEl = document.getElementById("model");
    const w = (modelContainerEl && modelContainerEl.clientWidth) || 320;
    const h = (modelContainerEl && modelContainerEl.clientHeight) || 480;
    app.renderer.resize(w, h);
    fitModelToCanvas();
  } catch {}
}
export function stateKeyFor(url: string): string {
  return "live2d_model_state::" + encodeURIComponent(String(url || ""));
}
