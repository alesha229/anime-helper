// @ts-nocheck
import { config } from "../../config";
import { loadSelectedModel, saveModelState } from "../live2d/live2dLoader";
import { playSelectedAnimationGroup, refreshAnimationsUI } from "../animations/animations";
import { setVoiceEnabled, setVoiceMode, getVoiceMode } from "../voice/voice";
import { getModel } from "../modelStore";

export function initUI() {
  const MODELS = config.MODELS;
  const LAST_MODEL_KEY = config.LAST_MODEL_KEY;

  const controls = document.getElementById("controls");
  if (!controls) return;

  // Model Select
  const select = document.createElement("select");
  select.style.webkitAppRegion = "no-drag";
  MODELS.forEach((url: string, i: number) => {
    const opt = document.createElement("option");
    opt.value = url;
    opt.textContent = `Model ${i + 1}`;
    select.appendChild(opt);
  });
  controls.insertBefore(select, controls.firstChild);

  // Inspector Button
  const openInspectorBtn = document.createElement("button");
  openInspectorBtn.textContent = "Change model💖";
  openInspectorBtn.style.webkitAppRegion = "no-drag";
  openInspectorBtn.className = "btn";
  openInspectorBtn.addEventListener("click", () => {
    let current = "";
    try {
      current = localStorage.getItem(LAST_MODEL_KEY) || "";
    } catch {}
    if (!current) current = select.value || "";
    try {
      localStorage.setItem(LAST_MODEL_KEY, current);
    } catch {}
    try {
      window.overlayAPI?.saveLastModel?.(current);
    } catch {}
    window.location.href = `viewer.html`;
  });
  controls.insertBefore(openInspectorBtn, select);

  // Spine Viewer Button
  const spineviewerbtn = document.createElement("button");
  spineviewerbtn.textContent = "spine viewer";
  spineviewerbtn.style.webkitAppRegion = "no-drag";
  spineviewerbtn.className = "btn";
  spineviewerbtn.addEventListener("click", () => {
    window.location.href = `spine.html`;
  });
  controls.insertBefore(spineviewerbtn, openInspectorBtn);

  // Animation Controls
  const animSelect = document.createElement("select");
  animSelect.className = "select";
  animSelect.style.webkitAppRegion = "no-drag";
  animSelect.id = "animSelect";
  animSelect.disabled = true;
  
  const animPlayBtn = document.createElement("button");
  animPlayBtn.id = "animPlayBtn";
  animPlayBtn.className = "btn";
  animPlayBtn.textContent = "▶";
  animPlayBtn.title = "Проиграть выбранную группу";
  animPlayBtn.style.webkitAppRegion = "no-drag";
  animPlayBtn.disabled = true;
  
  // controls.insertBefore(animPlayBtn, openInspectorBtn);
  // controls.insertBefore(animSelect, openInspectorBtn);

  animPlayBtn.addEventListener("click", () => playSelectedAnimationGroup(animSelect));
  animSelect.addEventListener("change", () => {
     // optional: auto-play on selection
     playSelectedAnimationGroup(animSelect);
  });

  // Voice Toggle
  const voiceBtn = document.createElement("button");
  voiceBtn.className = "btn";
  voiceBtn.textContent = "Voice: Audio";
  voiceBtn.title = "Озвучка фраз (TTS)";
  voiceBtn.style.webkitAppRegion = "no-drag";
  controls.insertBefore(voiceBtn, openInspectorBtn);

  voiceBtn.addEventListener("click", () => {
    let mode = getVoiceMode();
    if (mode === "audio") {
      setVoiceMode("off");
      setVoiceEnabled(false);
      voiceBtn.textContent = "Voice: Off";
    } else {
      setVoiceMode("audio");
      setVoiceEnabled(true);
      voiceBtn.textContent = "Voice: Audio";
    }
  });

  // UI Visibility Toggle
  const toggleUIBtn = document.getElementById("toggleUI");
  const showUIBtn = document.getElementById("showUIBtn");
  const UI_HIDDEN_KEY = "anime_overlay_ui_hidden_v1";
  const controlsWrap = controls;

  function setUIHidden(hidden: boolean) {
    try {
      if (!controlsWrap || !showUIBtn) return;

      if (hidden) {
        controlsWrap.classList.add("hidden");
        showUIBtn.classList.remove("hidden");
        localStorage.setItem(UI_HIDDEN_KEY, "1");
      } else {
        controlsWrap.classList.remove("hidden");
        showUIBtn.classList.add("hidden");
        localStorage.setItem(UI_HIDDEN_KEY, "0");
      }

      if (window.overlayAPI) {
        window.overlayAPI.toggleClickThrough(hidden);
      }
    } catch {}
  }

  try {
    const saved = localStorage.getItem(UI_HIDDEN_KEY) || "0";
    setUIHidden(saved === "1");
  } catch {}

  try {
    if (toggleUIBtn)
      toggleUIBtn.addEventListener("click", () => {
        const hidden =
          controlsWrap && controlsWrap.classList.contains("hidden");
        setUIHidden(!hidden);
      });

    if (showUIBtn)
      showUIBtn.addEventListener(
        "click",
        () => setUIHidden(false)
      );
  } catch {}

  function sendBounds() {
    if (!showUIBtn) return;
    const b = showUIBtn.getBoundingClientRect();
    window.overlayAPI?.reportPinBounds({
      x: b.left,
      y: b.top,
      w: b.width,
      h: b.height,
    });
  }
  window.overlayAPI?.onRequestBounds(() => sendBounds());
  window.addEventListener("resize", sendBounds);
  window.addEventListener("DOMContentLoaded", sendBounds);

  // Opacity Input
  const opacityInput = document.getElementById("opacity");
  if (opacityInput) {
    opacityInput.addEventListener("input", () => {
      try {
        const m = getModel();
        const base =
          (window as any).__live2d_base_scale || (m ? m.scale.x : 1);
        const factor = Math.max(
          0.01,
          Math.min(1.5, Number((opacityInput as HTMLInputElement).value))
        );
        if (m && isFinite(base)) {
          const origX = m.x;
          const origY = m.y;
          m.scale.set(factor / 2);
          m.x = origX;
          m.y = origY;
          try {
            m.__userScaled = true;
          } catch {}
          try {
            saveModelState();
          } catch {}
        }
      } catch {}
    });
  }

  return { animSelect, animPlayBtn, select };
}
