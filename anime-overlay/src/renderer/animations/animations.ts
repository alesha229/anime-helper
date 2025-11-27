// @ts-nocheck
import { getModel } from "../modelStore";
import { getmotionEntries, getavailableGroups } from "../modelIterations/motionState";
import { toast } from "../ui/toast";

declare const PIXI: any;

let currentRuntime = "c2"; // default, should be updated

export function setCurrentRuntime(r: string) {
  currentRuntime = r;
}

export function getForcePriority() {
  try {
    const ns = PIXI.live2d && PIXI.live2d.MotionPriority;
    return (ns && (ns.FORCE || ns.PriorityForce)) || 3;
  } catch (e) {
    return 3;
  }
}

export function playRandomNonIdle() {
  const model = getModel();
  const entries = getmotionEntries();
  if (!model || !entries.length) return;
  const candidates = entries.filter((m: any) => {
    const g = String(m.group || "").toLowerCase();
    const f = String(m.file || "").toLowerCase();
    return g !== "idle" && !f.includes("idle");
  });
  const list = candidates.length ? candidates : entries;
  const pick = list[Math.floor(Math.random() * list.length)];
  try {
    const mm = model.internalModel && model.internalModel.motionManager;
    const pr = getForcePriority();
    if (mm && typeof mm.startMotion === "function")
      mm.startMotion(pick.group, pick.index, pr);
    else if (mm && typeof mm.startRandomMotion === "function")
      mm.startRandomMotion(pick.group, pr);
  } catch (e) {}
}

export function interruptAndPlayRandomNonIdle() {
  const m = getModel();
  if (!m) return;

  const tryRuntimeGroups = () => {
    try {
      const mmFallback =
        m && m.internalModel && m.internalModel.motionManager;
      const defs =
        mmFallback &&
        (mmFallback.definitions ||
          mmFallback._definitions ||
          mmFallback._motions);
      if (defs && Object.keys(defs).length) {
        const groups = Object.keys(defs).filter(
          (g) =>
            String(g || "").toLowerCase() !== "idle" &&
            String(g || "").length > 0
        );
        if (groups.length) {
          const g = groups[Math.floor(Math.random() * groups.length)];
          const pr = getForcePriority();
          if (typeof mmFallback.startRandomMotion === "function") {
            mmFallback.startRandomMotion(g, pr);
            return true;
          }
          if (typeof mmFallback.startMotion === "function") {
            mmFallback.startMotion(g, 0, pr);
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  };

  const stopCurrent = () => {
    try {
      const mm = m.internalModel && m.internalModel.motionManager;
      if (mm) {
        if (typeof mm.stopAllMotions === "function") mm.stopAllMotions();
        else if (
          mm._motionQueueManager &&
          typeof mm._motionQueueManager.stopAllMotions === "function"
        )
          mm._motionQueueManager.stopAllMotions();
      }
    } catch (e) {}
  };

  const tryModelConvenience = () => {
    try {
      if (typeof m.motion === "function") {
        const groups = ["TapBody", "TapHead", "Tap", "Body", "Idle"];
        for (const g of groups) {
          try {
            m.motion(g);
            return true;
          } catch (e) {}
        }
      }
    } catch (e) {}
    return false;
  };

  let attempts = 5;
  const tryStart = () => {
    // stop whatever is running
    stopCurrent();
    // 1) use parsed entries
    if (
      Array.isArray(getmotionEntries()) &&
      getmotionEntries().length
    ) {
      playRandomNonIdle();
      snoozeIdle(6000);
      return;
    }
    // 2) use runtime groups
    if (tryRuntimeGroups()) {
      snoozeIdle(6000);
      return;
    }
    // 3) last resort: try generic triggers via helper
    try {
      if (typeof tryStartRandomMotion === "function") {
        const ok = tryStartRandomMotion("TapBody");
        if (ok) {
          snoozeIdle(6000);
          return;
        }
      }
    } catch (e) {}
    // 4) model.motion convenience if available
    if (tryModelConvenience()) {
      snoozeIdle(6000);
      return;
    }
    if (attempts-- > 0) setTimeout(tryStart, 200);
  };
  tryStart();
}

export function refreshAnimationsUI(animSelect?: HTMLSelectElement, animPlayBtn?: HTMLButtonElement) {
  if (!animSelect) animSelect = document.getElementById("animSelect") as HTMLSelectElement;
  if (!animPlayBtn) animPlayBtn = document.getElementById("animPlayBtn") as HTMLButtonElement;
  if (!animSelect) return;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Анимации";
  animSelect.innerHTML = "";
  animSelect.appendChild(placeholder);

  const entries = Array.isArray(getmotionEntries())
    ? getmotionEntries().slice()
    : [];

  const niceName = (filePath: string) => {
    try {
      const file = decodeURIComponent(String(filePath || ""))
        .split("/")
        .pop();
      if (!file) return "motion";
      return file
        .replace(/\.(motion3|mtn|json)$/i, "")
        .replace(/[_.]+/g, " ")
        .trim();
    } catch {
      return "motion";
    }
  };

  if (entries.length) {
    entries.forEach((e: any) => {
      const opt = document.createElement("option");
      opt.value = `${e.group}::${e.index}`;
      opt.dataset.group = String(e.group || "");
      opt.dataset.index = String(e.index);
      const labelCore = niceName(e.file);
      const groupLabel = String(e.group || "").trim();
      opt.textContent = groupLabel
        ? `${groupLabel}: ${labelCore}`
        : labelCore;
      animSelect.appendChild(opt);
    });
    animSelect.disabled = false;
    if (animPlayBtn) animPlayBtn.disabled = false;
    return;
  }

  // Fallback to group-based listing if we have no parsed entries
  const groups = Array.from(
    new Set([...(getavailableGroups() || [])])
  ).filter((g) => String(g).length > 0);
  // Try to synthesize per-index entries from runtime definitions
  let synthesized = false;
  const model = getModel();
  try {
    const mm =
      model && model.internalModel && model.internalModel.motionManager;
    const defs =
      mm && (mm.definitions || mm._definitions || mm._motions || null);
    if (defs) {
      for (const g of groups) {
        let length = 0;
        if (Array.isArray(defs[g])) length = defs[g].length || 0;
        else if (defs[g] && typeof defs[g].length === "number")
          length = defs[g].length;
        else if (typeof defs.get === "function") {
          const arr = defs.get(g);
          length = (arr && arr.length) || 0;
        }
        if (length > 0) {
          for (let i = 0; i < length; i++) {
            const opt = document.createElement("option");
            opt.value = `${g}::${i}`;
            opt.dataset.group = String(g);
            opt.dataset.index = String(i);
            opt.textContent = `${g}: motion ${i + 1}`;
            animSelect.appendChild(opt);
          }
          synthesized = true;
        }
      }
    }
  } catch (e) {}
  if (!synthesized) {
    for (const g of groups) {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      animSelect.appendChild(opt);
    }
  }
  const enabled = groups.length > 0;
  animSelect.disabled = !enabled;
  if (animPlayBtn) animPlayBtn.disabled = !enabled;
}

export function playSelectedAnimationGroup(animSelect: HTMLSelectElement) {
  const model = getModel();
  if (!model) return;
  if (!animSelect.value) return;
  const mm = model.internalModel && model.internalModel.motionManager;

  // If a specific motion (group+index) was selected, prefer that
  const selectedOpt = animSelect.options[animSelect.selectedIndex];
  const hasIndexSel =
    selectedOpt &&
    selectedOpt.dataset &&
    selectedOpt.dataset.index != null;
  let played = false;
  if (hasIndexSel) {
    const grp = selectedOpt.dataset.group || "";
    const idx = parseInt(selectedOpt.dataset.index || "0", 10);
    try {
      if (mm && typeof mm.startMotion === "function") {
        mm.startMotion(grp, isFinite(idx) ? idx : 0, getForcePriority());
        played = true;
      }
    } catch (e) {}
    if (!played) {
      try {
        if (typeof model.motion === "function") {
          model.motion(grp, isFinite(idx) ? idx : 0);
          played = true;
        }
      } catch (e) {}
    }
    if (played) {
      snoozeIdle(9000);
      return;
    }
  }

  // Otherwise treat value as a group and pick an index
  const group = animSelect.value;
  const pickIndex = () => {
    // Prefer indices from parsed motionEntries
    const candidates = (getmotionEntries() || [])
      .filter((e: any) => (e.group || "") === group)
      .map((e: any) => e.index)
      .filter((i: any) => typeof i === "number" && i >= 0);
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    // Try to inspect runtime definitions
    try {
      const defs =
        (mm && (mm.definitions || mm._definitions || mm._motions)) ||
        null;
      if (defs) {
        if (Array.isArray(defs[group])) return 0;
        if (defs[group] && typeof defs[group].length === "number")
          return 0;
        if (typeof defs.get === "function") {
          const arr = defs.get(group);
          if (arr && arr.length) return 0;
        }
      }
    } catch {}
    return 0;
  };

  // Try available APIs in order
  try {
    if (mm && typeof mm.startMotion === "function") {
      const idx = pickIndex();
      mm.startMotion(group, idx, getForcePriority());
      snoozeIdle(9000);
      return;
    }
  } catch (e) {}
  try {
    if (mm && typeof mm.startRandomMotion === "function") {
      mm.startRandomMotion(group, getForcePriority());
      snoozeIdle(9000);
      return;
    }
  } catch (e) {}
  try {
    if (typeof model.motion === "function") {
      const idx = pickIndex();
      try {
        model.motion(group, idx);
      } catch {
        model.motion(group);
      }
      snoozeIdle(9000);
      return;
    }
  } catch (e) {}
}

export function startIdleLoop(preferredGroups: string[]) {
  const model = getModel();
  if (!model) return;
  try {
    if (model.__idleTimer) {
      clearInterval(model.__idleTimer);
      model.__idleTimer = null;
    }
  } catch {}
  const mm = model.internalModel && model.internalModel.motionManager;
  if (!(mm && typeof mm.startRandomMotion === "function")) return;
  // collect groups from settings if not provided
  let groups = Array.isArray(preferredGroups)
    ? preferredGroups.slice()
    : [];
  try {
    const s = model.internalModel && model.internalModel.settings;
    const motions = (s && s.motions) || {};
    groups = Array.from(new Set([...groups, ...Object.keys(motions)]));
  } catch {}
  const defaults = [
    "Idle",
    "idle",
    "TapBody",
    "TapHead",
    "tap_body",
    "tap_head",
  ];
  const candidates = Array.from(new Set([...defaults, ...groups])).filter(
    Boolean
  );
  const hasGroup = (g: string) => {
    try {
      const defs = mm.definitions || mm._definitions || mm._motions || {};
      return !!defs[g];
    } catch {
      return true; // best-effort
    }
  };
  let chosen = null;
  for (const g of candidates) {
    if (!hasGroup(g)) continue;
    try {
      mm.startRandomMotion(g);
      chosen = g;
      break;
    } catch {}
  }
  if (!chosen) return;
  model.__idleTimer = setInterval(() => {
    try {
      // stop if model replaced
      if (!getModel() || getModel() !== model) {
        clearInterval(model.__idleTimer);
        model.__idleTimer = null;
        return;
      }
      const cur = getModel();
      const curMM =
        cur && cur.internalModel && cur.internalModel.motionManager;
      if (curMM && typeof curMM.startRandomMotion === "function") {
        curMM.startRandomMotion(chosen);
      }
    } catch {}
  }, 12000);
}

export function startIdleLoopC4() {
  const model = getModel();
  if (!model) return;
  try {
    if (model.__idleTimer) {
      clearInterval(model.__idleTimer);
      model.__idleTimer = null;
    }
  } catch {}
  const mm = model.internalModel && model.internalModel.motionManager;
  if (!mm) return;

  const entries = Array.isArray(getmotionEntries())
    ? getmotionEntries()
    : [];
  const idleEntries = entries.filter((e: any) => {
    try {
      const name = String(e.file || "").toLowerCase();
      return name.includes("idle");
    } catch {
      return false;
    }
  });

  let chosen: any = null;
  if (idleEntries.length) {
    chosen = idleEntries[Math.floor(Math.random() * idleEntries.length)];
  } else {
    // Fallback: look for a group literally named Idle
    try {
      const defs = mm.definitions || mm._definitions || mm._motions || {};
      const groups = Object.keys(defs || {});
      const idleGroup = groups.find(
        (g) => String(g).toLowerCase() === "idle"
      );
      if (idleGroup) chosen = { group: idleGroup, index: 0 };
    } catch {}
  }

  if (!chosen) return;
  // Start once and then repeat periodically
  try {
    if (typeof mm.startMotion === "function") {
      mm.startMotion(chosen.group || "Idle", chosen.index || 0);
    } else if (typeof mm.startRandomMotion === "function") {
      mm.startRandomMotion(chosen.group || "Idle");
    }
  } catch {}
  model.__idleTimer = setInterval(() => {
    try {
      if (!getModel() || getModel() !== model) {
        clearInterval(model.__idleTimer);
        model.__idleTimer = null;
        return;
      }
      const cur = getModel();
      const curMM =
        cur && cur.internalModel && cur.internalModel.motionManager;
      if (!curMM) return;
      if (typeof curMM.startMotion === "function") {
        curMM.startMotion(chosen.group || "Idle", chosen.index || 0);
      } else if (typeof curMM.startRandomMotion === "function") {
        curMM.startRandomMotion(chosen.group || "Idle");
      }
    } catch {}
  }, 12000);
}

export function snoozeIdle(ms: number) {
  const modelRef = getModel();
  try {
    if (!modelRef) return;
    if (modelRef.__idleTimer) {
      clearInterval(modelRef.__idleTimer);
      modelRef.__idleTimer = null;
    }
    if (modelRef.__idleSnooze) {
      clearTimeout(modelRef.__idleSnooze);
      modelRef.__idleSnooze = null;
    }
    modelRef.__idleSnooze = setTimeout(
      () => {
        try {
          if (!getModel() || getModel() !== modelRef) return;
          if (currentRuntime === "c4") startIdleLoopC4();
          else
            startIdleLoop(
              Array.from(
                new Set(
                  (getmotionEntries() || []).map((e: any) =>
                    String(e.group || "").trim()
                  )
                )
              )
            ).filter(Boolean);
        } catch (e) {}
      },
      Math.max(2000, ms || 8000)
    );
  } catch (e) {}
}

export function tryStartRandomMotion(preferredGroup: string) {
  const m = getModel();
  if (!m) return false;
  try {
    // Try common APIs from different Live2D wrappers
    const groups = [
      preferredGroup,
      "TapBody",
      "TapHand",
      "TapHead",
      "Idle",
    ];
    // 1) PIXI-live2d-display exposes model.motion(name) in some versions
    if (typeof m.motion === "function") {
      for (const g of groups) {
        try {
          if (g) {
            m.motion(g);
            return true;
          }
        } catch (e) {}
      }
    }
    // 2) internalModel.motionManager.startRandomMotion(group)
    if (m.internalModel && m.internalModel.motionManager) {
      const manager = m.internalModel.motionManager;
      if (typeof manager.startRandomMotion === "function") {
        for (const g of groups) {
          try {
            if (g) {
              manager.startRandomMotion(g);
              toast("Анимация: " + g); // Added debug toast
              return true;
            } else {
              manager.startRandomMotion();
              toast("Анимация: default"); // Added debug toast
              return true;
            }
          } catch (e) {}
        }
      }
      // 3) startMotion (group, index) fallback
      if (typeof manager.startMotion === "function") {
        for (const g of groups) {
          try {
            manager.startMotion(g || "");
            return true;
          } catch (e) {}
        }
      }
    }
    // 4) model.internalModel.startRandomMotion (other wrappers)
    if (
      m.internalModel &&
      typeof m.internalModel.startRandomMotion === "function"
    ) {
      try {
        m.internalModel.startRandomMotion(preferredGroup);
        return true;
      } catch (e) {}
    }

    // fallback gentle pulse
    pulseModel(1.08, 300);
    return true;
  } catch (e) {
    console.error("tryStartRandomMotion failed", e);
    pulseModel(1.05, 250);
    return false;
  }
}

export function pulseModel(scale: number, to: number) {
  const m = getModel();
  if (!m) return;
  const start = m.scale.x;
  const target = scale;
  const dur = to || 400;
  const origX = m.x;
  const origY = m.y;
  const t0 = Date.now();
  const tick = () => {
    const p = Math.min(1, (Date.now() - t0) / dur);
    const val = start + (target - start) * Math.sin(p * Math.PI);
    m.scale.set(val);
    // restore position to avoid shift when scaling
    m.x = origX;
    m.y = origY;
    if (p < 1) requestAnimationFrame(tick);
    else m.scale.set(start);
  };
  requestAnimationFrame(tick);
}

export function focusModel() {
  const m = getModel();
  if (!m) return;
  m.scale.set(0.55);
}

export function relaxModel() {
  const m = getModel();
  if (!m) return;
  m.scale.set(0.65);
}
