// @ts-nocheck
declare const PIXI: any;
import { config } from "../config";
import { app } from "./app";
import {
  loadModel,
  loadSelectedModel,
} from "./live2d/live2dLoader";
import { resizeStageToContainer } from "./live2d/live2dutils";
import { ping } from "../utils/utils";
import { applyPixiLive2dPatches } from "./live2d/live2dPatches";
import { initUI } from "./ui/ui";
import { initPomodoro } from "./timer/pomodoro";
import { initEvents } from "./events";
import { loadPhrasesJson } from "./voice/voice";

// Only run the main index page logic when we're actually on the index.html
if (document.getElementById("model") && document.getElementById("controls")) {
  (async function () {
    window.overlayAPI?.enterFullscreen?.();
    const MODELS = config.MODELS;
    
    // Check GitHub availability
    let ghAvalible = false;
    await ping("https://raw.githubusercontent.com").then((e) => {
      ghAvalible = e;
    });

    try {
      document.getElementById("model").appendChild(app.view);
      try {
        (app.stage as any).interactive = true;
      } catch {}
      const modelContainerEl = document.getElementById("model");

      window.addEventListener("resize", resizeStageToContainer);
      try {
        const ro = new ResizeObserver(() => resizeStageToContainer());
        ro.observe(modelContainerEl);
      } catch {}
      // initial fit
      resizeStageToContainer();

      // Apply patches
      applyPixiLive2dPatches(PIXI);

      // Initialize UI
      initUI();

      // Initialize Voice
      loadPhrasesJson();

      // Initialize Pomodoro
      initPomodoro();

      // Initialize Events
      initEvents();

      // Load initial model
      const LAST_MODEL_KEY = config.LAST_MODEL_KEY;
      let saved = null;
      try {
        if (
          window.overlayAPI &&
          typeof window.overlayAPI.getLastModel === "function"
        ) {
          try {
            saved = await window.overlayAPI.getLastModel();
          } catch {}
        }
        if (!saved) {
          saved = localStorage.getItem(LAST_MODEL_KEY) || null;
        }
      } catch (e) {
        saved = null;
      }
      const initial =
        saved &&
        (/\.json($|\?)/i.test(saved) ||
          /\.moc3($|\?)/i.test(saved) ||
          /\.moc($|\?)/i.test(saved))
          ? saved
          : MODELS[0];
      
      if (ghAvalible != false) {
        await loadSelectedModel(initial);
      } else {
        await loadSelectedModel(MODELS[1]);
      }

    } catch (e) {
      console.error("Live2D load error", e);
      const el = document.getElementById("model");
      el.textContent =
        "Ошибка загрузки модели: " + (e && e.message ? e.message : e);
      // попытаться показать fallback из локальных ассетов
      const img = document.createElement("img");
      img.style.width = "100%";
      img.style.height = "100%";
      img.src = "./img/demo.gif";
      el.appendChild(img);
    }
  })();
} else {
  // If loaded on a page without the main UI, export a no-op app to avoid
  // runtime errors from other modules that import `app`.
  // `app` is imported from ./app
}
