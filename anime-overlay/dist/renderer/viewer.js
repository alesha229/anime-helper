"use strict";
(() => {
  // src/config.ts
  var config = {
    MODELS: [
      "./models/adaerbote_2/adaerbote_2.model3.json",
      "./models/dafeng_6/dafeng_6.model3.json",
      "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)/abeikelongbi_3/abeikelongbi_3.model3.json",
      "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/haru/haru_greeter_t03.model3.json"
    ],
    LAST_MODEL_KEY: "anime_overlay_last_model_url",
    GITHUBRAW: "https://raw.githubusercontent.com"
  };

  // src/renderer/modelStore.ts
  var model2 = null;
  function getModel() {
    return model2;
  }
  function setModel(m) {
    model2 = m;
  }

  // src/renderer/live2d/live2dutils.ts
  function fitModelToCanvas2() {
    const model3 = getModel();
    if (!model3) return;
    try {
      if (model3.anchor && typeof model3.anchor.set === "function") {
        model3.anchor.set(0.5, 0.5);
      }
    } catch {
    }
    try {
      const userMoved = !!model3.__userMoved;
      if (!userMoved) {
        model3.x = app.renderer.width / 2;
        model3.y = app.renderer.height / 2;
      }
      const b = model3.getBounds();
      const bw = Math.max(1, b.width);
      const bh = Math.max(1, b.height);
      const fudge = 0.5;
      const base = Math.min(
        app.renderer.width * 0.4 / bw,
        app.renderer.height * 0.4 / bh
      );
      const baseScale = Math.max(0.1, base * fudge);
      window.__live2d_base_scale = baseScale;
      let factor = 1;
      try {
        const input = document.getElementById(
          "opacity"
        );
        if (input)
          factor = Math.max(0.5, Math.min(1.5, Number(input.value) || 1));
      } catch {
      }
      const userScaled = !!model3.__userScaled;
      if (!userScaled) {
        if (isFinite(baseScale) && baseScale > 0) {
          const conservative = 0.85;
          model3.scale.set(baseScale * factor * conservative);
        }
      }
    } catch {
    }
  }
  function resizeStageToContainer() {
    try {
      const modelContainerEl = document.getElementById("model");
      const w = modelContainerEl && modelContainerEl.clientWidth || 320;
      const h = modelContainerEl && modelContainerEl.clientHeight || 480;
      app.renderer.resize(w, h);
      fitModelToCanvas2();
    } catch {
    }
  }
  function stateKeyFor(url) {
    return "live2d_model_state::" + encodeURIComponent(String(url || ""));
  }

  // src/renderer/modelIterations/motionState.ts
  var motionEntries2 = [];
  var availableGroups = [];
  function getmotionEntries() {
    return motionEntries2;
  }
  function setmotionEntries(state) {
    motionEntries2 = state;
  }
  function getavailableGroups() {
    return availableGroups;
  }
  function setavailableGroups(state) {
    availableGroups = state;
  }

  // src/renderer/lipsync/lipsyncState.ts
  var lipSyncState = {
    stream: null,
    audioContext: null,
    source: null,
    analyser: null,
    data: null,
    raf: null,
    lipSyncEnabled: true
  };
  function getLipSyncState() {
    return lipSyncState;
  }
  function setLipSyncState(state) {
    lipSyncState = state;
  }

  // src/renderer/index.ts
  var app = new PIXI.Application({
    transparent: true,
    width: 320,
    height: 480
  });
  if (document.getElementById("model") && document.getElementById("controls")) {
    (async function() {
      window.overlayAPI.setZoomFactor(1);
      const MODELS2 = config.MODELS;
      const LAST_MODEL_KEY2 = config.LAST_MODEL_KEY;
      const ping2 = async (url) => {
        try {
          const r = await fetch(url, { method: "HEAD" });
          return r.ok;
        } catch {
          return false;
        }
      };
      let ghAvalible = false;
      await ping2("https://raw.githubusercontent.com").then((e) => {
        ghAvalible = e;
      });
      try {
        let setMouthOpenParam2 = function(value) {
          const targetModel = getModel();
          if (!targetModel) return false;
          const v = Math.max(0, Math.min(1, value));
          try {
            const core = targetModel.internalModel && targetModel.internalModel.coreModel;
            if (core) {
              if (typeof core.setParameterById === "function") {
                core.setParameterById("ParamMouthOpenY", v);
                return true;
              }
              if (typeof core.setParameterValueById === "function") {
                core.setParameterValueById("ParamMouthOpenY", v);
                return true;
              }
              if (typeof core.getParameterIndexById === "function" && typeof core.setParameterValueByIndex === "function") {
                const idx = core.getParameterIndexById("ParamMouthOpenY");
                if (idx >= 0) {
                  core.setParameterValueByIndex(idx, v);
                  return true;
                }
              }
            }
          } catch (e) {
          }
          try {
            const c2 = targetModel.internalModel && targetModel.internalModel.coreModel || targetModel;
            if (c2 && typeof c2.setParamFloat === "function") {
              c2.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
              return true;
            }
          } catch (e) {
          }
          try {
            if (typeof targetModel.setParamFloat === "function") {
              targetModel.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
              return true;
            }
          } catch (e) {
          }
          return false;
        }, getAudio2 = function(url) {
          let a = audioCache.get(url);
          if (!a) {
            a = new Audio(url);
            a.preload = "auto";
            audioCache.set(url, a);
          }
          return a;
        }, playAudioCategory2 = function(cat) {
          return new Promise((resolve) => {
            try {
              const list = VOICE_AUDIO && VOICE_AUDIO[cat] || [];
              if (!Array.isArray(list) || !list.length) return resolve(false);
              const pick = list[Math.floor(Math.random() * list.length)];
              if (!pick) return resolve(false);
              if (currentAudio) {
                try {
                  currentAudio.pause();
                  currentAudio.currentTime = 0;
                } catch (e) {
                }
              }
              const a = getAudio2(pick);
              currentAudio = a;
              a.currentTime = 0;
              const p = a.play();
              if (p && typeof p.then === "function") {
                p.then(() => resolve(true)).catch(() => resolve(false));
              } else {
                resolve(true);
              }
            } catch (e) {
              resolve(false);
            }
          });
        }, getForcePriority2 = function() {
          try {
            const ns = PIXI.live2d && PIXI.live2d.MotionPriority;
            return ns && (ns.FORCE || ns.PriorityForce) || 3;
          } catch (e) {
            return 3;
          }
        }, ensureAudioContext2 = function() {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext || null;
            if (!AudioCtx) return null;
            const lipSyncState2 = getLipSyncState();
            if (!lipSyncState2.audioContext) {
              try {
                lipSyncState2.audioContext = new AudioCtx();
              } catch {
                lipSyncState2.audioContext = null;
              }
              setLipSyncState(lipSyncState2);
            }
            const ctx = getLipSyncState().audioContext;
            if (!ctx) {
              const retry = () => {
                try {
                  const lipSyncState3 = getLipSyncState();
                  lipSyncState3.audioContext = new AudioCtx();
                  setLipSyncState(lipSyncState3);
                } catch {
                }
                window.removeEventListener("pointerdown", retry);
                window.removeEventListener("touchstart", retry);
              };
              window.addEventListener("pointerdown", retry, { once: true });
              window.addEventListener("touchstart", retry, { once: true });
              return null;
            }
            try {
              if (ctx.state === "suspended") {
                ctx.resume();
              }
            } catch {
            }
            return getLipSyncState().audioContext;
          } catch {
            return null;
          }
        }, startLipSyncForAudio2 = function(audioEl) {
          const model3 = getModel();
          if (!audioEl || !model3) return;
          const ctx = ensureAudioContext2();
          if (!ctx) return;
          try {
            if (getLipSyncState().source && getLipSyncState().source.disconnect)
              getLipSyncState().source.disconnect();
          } catch (e) {
          }
          try {
            const source = ctx.createMediaElementSource(audioEl);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 2048;
            const data = new Uint8Array(analyser.fftSize);
            source.connect(analyser);
            analyser.connect(ctx.destination);
            const lipSyncState2 = getLipSyncState();
            lipSyncState2.source = source;
            lipSyncState2.analyser = analyser;
            lipSyncState2.data = data;
            setLipSyncState(lipSyncState2);
            const update = () => {
              if (!getLipSyncState().lipSyncEnabled) return;
              try {
                analyser.getByteTimeDomainData(data);
                let min = 255, max = 0;
                for (let i = 0; i < data.length; i++) {
                  const v = data[i];
                  if (v < min) min = v;
                  if (v > max) max = v;
                }
                let amp = (max - min) / 255;
                amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
                if (amp > 1) amp = 1;
                setMouthOpenParam2(amp);
              } catch (e) {
              }
              if (audioEl.ended || audioEl.paused) {
                setMouthOpenParam2(0);
                return;
              }
              const lipSyncState3 = getLipSyncState();
              lipSyncState3.raf = requestAnimationFrame(update);
              setLipSyncState(lipSyncState3);
            };
            const lipSyncStateUpdated = getLipSyncState();
            lipSyncStateUpdated.lipSyncEnabled = true;
            lipSyncStateUpdated.raf = requestAnimationFrame(update);
            setLipSyncState(lipSyncStateUpdated);
          } catch (e) {
          }
        }, playRandomNonIdle2 = function() {
          const model3 = getModel();
          if (!model3 || !getmotionEntries().length) return;
          const candidates = motionEntries.filter((m) => {
            const g = String(m.group || "").toLowerCase();
            const f = String(m.file || "").toLowerCase();
            return g !== "idle" && !f.includes("idle");
          });
          const list = candidates.length ? candidates : motionEntries;
          const pick = list[Math.floor(Math.random() * list.length)];
          try {
            const mm = model3.internalModel && model3.internalModel.motionManager;
            const pr = getForcePriority2();
            if (mm && typeof mm.startMotion === "function")
              mm.startMotion(pick.group, pick.index, pr);
            else if (mm && typeof mm.startRandomMotion === "function")
              mm.startRandomMotion(pick.group, pr);
          } catch (e) {
          }
        }, interruptAndPlayRandomNonIdle2 = function() {
          const m = getModel();
          if (!m) return;
          try {
            const mm = m.internalModel && m.internalModel.motionManager;
            if (mm) {
              if (typeof mm.stopAllMotions === "function") mm.stopAllMotions();
              else if (mm._motionQueueManager && typeof mm._motionQueueManager.stopAllMotions === "function")
                mm._motionQueueManager.stopAllMotions();
            }
          } catch (e) {
          }
          playRandomNonIdle2();
          try {
            snoozeIdle2(6e3);
          } catch (e) {
          }
        }, speakCategory2 = function(cat) {
          if (!voiceEnabled || !cat) return;
          playAudioCategory2(cat).then((ok) => {
            if (ok && currentAudio) {
              if (getLipSyncState().lipSyncEnabled)
                startLipSyncForAudio2(currentAudio);
              interruptAndPlayRandomNonIdle2();
              try {
                currentAudio.addEventListener(
                  "play",
                  () => interruptAndPlayRandomNonIdle2(),
                  { once: true }
                );
                currentAudio.addEventListener(
                  "playing",
                  () => interruptAndPlayRandomNonIdle2(),
                  { once: true }
                );
              } catch (e) {
              }
              if (!currentAudio.paused) {
                setTimeout(() => interruptAndPlayRandomNonIdle2(), 0);
              }
            } else if (!ok) {
              interruptAndPlayRandomNonIdle2();
            }
          });
          return;
        }, stopLipSync3 = function() {
          try {
            if (getLipSyncState() && getLipSyncState().raf != null) {
              cancelAnimationFrame(getLipSyncState().raf);
              const lipSyncState2 = getLipSyncState();
              lipSyncState2.raf = null;
              setLipSyncState(lipSyncState2);
            }
          } catch (e) {
          }
          try {
            if (getLipSyncState() && getLipSyncState().source && getLipSyncState().source.disconnect) {
              getLipSyncState().source.disconnect();
            }
          } catch (e) {
          }
          try {
            if (getLipSyncState() && getLipSyncState().stream) {
              getLipSyncState().stream.getTracks().forEach((t) => t.stop());
            }
          } catch (e) {
          }
          try {
            setMouthOpenParam2(0);
          } catch (e) {
          }
        }, refreshAnimationsUI3 = function() {
          const placeholder = document.createElement("option");
          placeholder.value = "";
          placeholder.textContent = "\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u0438";
          animSelect.innerHTML = "";
          animSelect.appendChild(placeholder);
          const entries = Array.isArray(motionEntries) ? motionEntries.slice() : [];
          const niceName = (filePath) => {
            try {
              const file = decodeURIComponent(String(filePath || "")).split("/").pop();
              if (!file) return "motion";
              return file.replace(/\.(motion3|mtn|json)$/i, "").replace(/[_.]+/g, " ").trim();
            } catch {
              return "motion";
            }
          };
          if (entries.length) {
            entries.forEach((e) => {
              const opt = document.createElement("option");
              opt.value = `${e.group}::${e.index}`;
              opt.dataset.group = String(e.group || "");
              opt.dataset.index = String(e.index);
              const labelCore = niceName(e.file);
              const groupLabel = String(e.group || "").trim();
              opt.textContent = groupLabel ? `${groupLabel}: ${labelCore}` : labelCore;
              animSelect.appendChild(opt);
            });
            animSelect.disabled = false;
            animPlayBtn.disabled = false;
            return;
          }
          const groups = Array.from(
            /* @__PURE__ */ new Set([...getavailableGroups() || []])
          ).filter((g) => String(g).length > 0);
          let synthesized = false;
          try {
            const mm = model && model.internalModel && model.internalModel.motionManager;
            const defs = mm && (mm.definitions || mm._definitions || mm._motions || null);
            if (defs) {
              for (const g of groups) {
                let length = 0;
                if (Array.isArray(defs[g])) length = defs[g].length || 0;
                else if (defs[g] && typeof defs[g].length === "number")
                  length = defs[g].length;
                else if (typeof defs.get === "function") {
                  const arr = defs.get(g);
                  length = arr && arr.length || 0;
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
          } catch (e) {
          }
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
          animPlayBtn.disabled = !enabled;
        }, playSelectedAnimationGroup2 = function() {
          const model3 = getModel();
          if (!model3) return;
          if (!animSelect.value) return;
          const mm = model3.internalModel && model3.internalModel.motionManager;
          const selectedOpt = animSelect.options[animSelect.selectedIndex];
          const hasIndexSel = selectedOpt && selectedOpt.dataset && selectedOpt.dataset.index != null;
          let played = false;
          if (hasIndexSel) {
            const grp = selectedOpt.dataset.group || "";
            const idx = parseInt(selectedOpt.dataset.index, 10);
            try {
              if (mm && typeof mm.startMotion === "function") {
                mm.startMotion(grp, isFinite(idx) ? idx : 0, getForcePriority2());
                played = true;
              }
            } catch (e) {
            }
            if (!played) {
              try {
                if (typeof model3.motion === "function") {
                  model3.motion(grp, isFinite(idx) ? idx : 0);
                  played = true;
                }
              } catch (e) {
              }
            }
            if (played) {
              snoozeIdle2(9e3);
              return;
            }
          }
          const group = animSelect.value;
          const pickIndex = () => {
            const candidates = (getmotionEntries() || []).filter((e) => (e.group || "") === group).map((e) => e.index).filter((i) => typeof i === "number" && i >= 0);
            if (candidates.length) {
              return candidates[Math.floor(Math.random() * candidates.length)];
            }
            try {
              const defs = mm && (mm.definitions || mm._definitions || mm._motions) || null;
              if (defs) {
                if (Array.isArray(defs[group])) return 0;
                if (defs[group] && typeof defs[group].length === "number")
                  return 0;
                if (typeof defs.get === "function") {
                  const arr = defs.get(group);
                  if (arr && arr.length) return 0;
                }
              }
            } catch {
            }
            return 0;
          };
          try {
            if (mm && typeof mm.startMotion === "function") {
              const idx = pickIndex();
              mm.startMotion(group, idx, getForcePriority2());
              snoozeIdle2(9e3);
              return;
            }
          } catch (e) {
          }
          try {
            if (mm && typeof mm.startRandomMotion === "function") {
              mm.startRandomMotion(group, getForcePriority2());
              snoozeIdle2(9e3);
              return;
            }
          } catch (e) {
          }
          try {
            if (typeof model3.motion === "function") {
              const idx = pickIndex();
              try {
                model3.motion(group, idx);
              } catch {
                model3.motion(group);
              }
              snoozeIdle2(getModel(), 9e3);
              return;
            }
          } catch (e) {
          }
        }, getMotionEntriesFromJson2 = function(json, baseUrl) {
          const entries = [];
          const add = (group, arr) => {
            (arr || []).forEach((m, idx) => {
              if (typeof m === "string") {
                entries.push({ group, index: idx, file: baseUrl + m });
              } else if (m && (m.file || m.File)) {
                const f = m.file || m.File;
                entries.push({ group, index: idx, file: baseUrl + f });
              }
            });
          };
          try {
            const m2 = json.motions || json.Motions || {};
            for (const g of Object.keys(m2)) add(g, m2[g]);
          } catch {
          }
          try {
            const m4 = json.FileReferences && json.FileReferences.Motions || {};
            for (const g of Object.keys(m4)) add(g, m4[g]);
          } catch {
          }
          return entries;
        }, startIdleLoop3 = function(preferredGroups) {
          const model3 = getModel();
          if (!model3) return;
          try {
            if (model3.__idleTimer) {
              clearInterval(model3.__idleTimer);
              model3.__idleTimer = null;
            }
          } catch {
          }
          const mm = model3.internalModel && model3.internalModel.motionManager;
          if (!(mm && typeof mm.startRandomMotion === "function")) return;
          let groups = Array.isArray(preferredGroups) ? preferredGroups.slice() : [];
          try {
            const s = model3.internalModel && model3.internalModel.settings;
            const motions = s && s.motions || {};
            groups = Array.from(/* @__PURE__ */ new Set([...groups, ...Object.keys(motions)]));
          } catch {
          }
          const defaults = [
            "Idle",
            "idle",
            "TapBody",
            "TapHead",
            "tap_body",
            "tap_head"
          ];
          const candidates = Array.from(/* @__PURE__ */ new Set([...defaults, ...groups])).filter(
            Boolean
          );
          const hasGroup = (g) => {
            try {
              const defs = mm.definitions || mm._definitions || mm._motions || {};
              return !!defs[g];
            } catch {
              return true;
            }
          };
          let chosen = null;
          for (const g of candidates) {
            if (!hasGroup(g)) continue;
            try {
              mm.startRandomMotion(g);
              chosen = g;
              break;
            } catch {
            }
          }
          if (!chosen) return;
          model3.__idleTimer = setInterval(() => {
            try {
              if (!getModel() || getModel() !== model3) {
                clearInterval(model3.__idleTimer);
                model3.__idleTimer = null;
                return;
              }
              const cur = getModel();
              const curMM = cur && cur.internalModel && cur.internalModel.motionManager;
              if (curMM && typeof curMM.startRandomMotion === "function") {
                curMM.startRandomMotion(chosen);
              }
            } catch {
            }
          }, 12e3);
        }, startIdleLoopC43 = function() {
          const model3 = getModel();
          if (!model3) return;
          try {
            if (model3.__idleTimer) {
              clearInterval(model3.__idleTimer);
              model3.__idleTimer = null;
            }
          } catch {
          }
          const mm = model3.internalModel && model3.internalModel.motionManager;
          if (!mm) return;
          const entries = Array.isArray(getmotionEntries()) ? getmotionEntries() : [];
          const idleEntries = entries.filter((e) => {
            try {
              const name = String(e.file || "").toLowerCase();
              return name.includes("idle");
            } catch {
              return false;
            }
          });
          let chosen = null;
          if (idleEntries.length) {
            chosen = idleEntries[Math.floor(Math.random() * idleEntries.length)];
          } else {
            try {
              const defs = mm.definitions || mm._definitions || mm._motions || {};
              const groups = Object.keys(defs || {});
              const idleGroup = groups.find(
                (g) => String(g).toLowerCase() === "idle"
              );
              if (idleGroup) chosen = { group: idleGroup, index: 0 };
            } catch {
            }
          }
          if (!chosen) return;
          try {
            if (typeof mm.startMotion === "function") {
              mm.startMotion(chosen.group || "Idle", chosen.index || 0);
            } else if (typeof mm.startRandomMotion === "function") {
              mm.startRandomMotion(chosen.group || "Idle");
            }
          } catch {
          }
          model3.__idleTimer = setInterval(() => {
            try {
              if (!getModel() || getModel() !== model3) {
                clearInterval(model3.__idleTimer);
                model3.__idleTimer = null;
                return;
              }
              const cur = getModel();
              const curMM = cur && cur.internalModel && cur.internalModel.motionManager;
              if (!curMM) return;
              if (typeof curMM.startMotion === "function") {
                curMM.startMotion(chosen.group || "Idle", chosen.index || 0);
              } else if (typeof curMM.startRandomMotion === "function") {
                curMM.startRandomMotion(chosen.group || "Idle");
              }
            } catch {
            }
          }, 12e3);
        }, snoozeIdle2 = function(ms) {
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
            modelRef.__idleSnooze = setTimeout(() => {
              try {
                if (!getModel() || getModel() !== modelRef) return;
                if (currentRuntime2 === "c4") startIdleLoopC43();
                else
                  startIdleLoop3(
                    Array.from(
                      new Set(
                        (getmotionEntries() || []).map(
                          (e) => String(e.group || "").trim()
                        )
                      )
                    ).filter(Boolean)
                  );
              } catch (e) {
              }
            }, Math.max(2e3, ms || 8e3));
          } catch (e) {
          }
        }, applyPixiLive2dPatches2 = function() {
          const ns = PIXI.live2d;
          if (!ns) return;
          if (window.__live2d_loader_patched) return;
          window.__live2d_loader_patched = true;
          const {
            Live2DLoader,
            XHRLoader,
            Live2DFactory,
            InternalModel,
            Cubism2ModelSettings,
            Cubism4ModelSettings
          } = ns || {};
          if (!Live2DLoader || !XHRLoader || !Live2DFactory) return;
          const urlUtils = {
            resolve: (baseUrl, relative) => {
              try {
                return new URL(relative, baseUrl).toString();
              } catch {
                return relative;
              }
            }
          };
          const snakeCaseUpper = (s) => {
            if (!s) return s;
            return String(s).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toUpperCase();
          };
          const unionBy = (arr, extras, key) => {
            const out = Array.isArray(arr) ? arr.slice() : [];
            const seen = new Set(out.map((x) => String(x && x[key])));
            for (const e of extras) {
              const k = String(e && e[key]);
              if (!seen.has(k)) {
                seen.add(k);
                out.push(e);
              }
            }
            return out;
          };
          try {
            const idx = Live2DLoader.middlewares.indexOf(XHRLoader.loader);
            if (idx >= 0) {
              Live2DLoader.middlewares[idx] = async (context, next) => {
                const url = context.settings ? context.settings.resolveURL(context.url) : context.url;
                try {
                  await XHRLoader.loader(context, next);
                  return;
                } catch (e) {
                  if (!(e && e.status === 403 && /jsdelivr/i.test(url))) {
                    throw e;
                  }
                  try {
                    console.warn(
                      "[live2d] 403 from jsDelivr, switching alternative URL"
                    );
                  } catch {
                  }
                }
                context.url = getAlternativeURL(url);
                await XHRLoader.loader(context, next);
                return next();
              };
            }
          } catch {
          }
          const patches = [
            {
              search: "\u9B42\u5668\u5B66\u9662",
              replace(jsonText) {
                return jsonText.replace(/mtn"([^,])/gm, 'mtn","$1');
              }
            },
            {
              search: "\u5C11\u5973\u524D\u7EBF",
              async patch(json, url) {
                extractCubism2IdleMotions(json, ["daiji"]);
                if (!json.name) {
                  json.name = folderName(
                    url.replace(/(normal|destroy)\.model\.json/, "")
                  );
                }
                if (json.motions?.idle?.length) {
                  const motion0 = json.motions.idle[0] || {};
                  if (motion0.file && motion0.file.startsWith("daiji")) {
                    const ok = await ping2(urlUtils.resolve(url, motion0.file));
                    if (!ok) motion0.file = "motions/" + motion0.file;
                  }
                }
              }
            },
            {
              search: "\u30A2\u30F3\u30CE\u30A6\u30F3\u30D6\u30E9\u30A4\u30C9",
              async patch(json, url) {
                if (json.FileReferences?.Textures?.length === 0) {
                  const exists = await ping2(
                    urlUtils.resolve(url, "textures/texture_00.png")
                  );
                  json.FileReferences.Textures.push(
                    exists ? "textures/texture_00.png" : "textures/texture_00 .png"
                  );
                }
                extractCubism4IdleMotions(json, ["home", "gacha"]);
              }
            },
            {
              search: "\u51CD\u4EAC",
              async patch(json, url) {
                const correctTexture = async (tex) => await ping2(urlUtils.resolve(url, tex)) ? tex : tex.replace("/texture", "/android/texture");
                if (Cubism2ModelSettings && Cubism2ModelSettings.isValidJSON?.(json)) {
                  if (json.textures)
                    json.textures = await Promise.all(
                      json.textures.map(correctTexture)
                    );
                  if (json.motions) {
                    for (const grp of Object.values(json.motions)) {
                      if (grp?.length)
                        for (const m of grp) {
                          m.file = m.file ?? m.File;
                          delete m.File;
                        }
                    }
                    if (!json.motions.idle?.length && json.motions[""]) {
                      json.motions.idle = json.motions[""].filter(
                        (m) => m.file && m.file.includes("loop")
                      );
                    }
                  }
                } else if (Cubism4ModelSettings && Cubism4ModelSettings.isValidJSON?.(json)) {
                  if (json.FileReferences?.Textures)
                    json.FileReferences.Textures = await Promise.all(
                      json.FileReferences.Textures.map(correctTexture)
                    );
                  if (json.FileReferences?.Motions) {
                    if (!json.FileReferences.Motions.Idle?.length && json.FileReferences.Motions[""]) {
                      json.FileReferences.Motions.Idle = json.FileReferences.Motions[""].filter(
                        (m) => m.File && m.File.includes("loop")
                      );
                    }
                  }
                }
              }
            },
            {
              search: "\u5929\u547D\u4E4B\u5B50",
              patch(json) {
                if (json.motions?.[""]?.length && !json.motions?.idle?.length)
                  json.motions.idle = json.motions[""].map((m) => ({
                    ...m
                  }));
              }
            },
            {
              search: "\u78A7\u84DD\u822A\u7EBF",
              patch(json) {
                extractCubism4IdleMotions(json, ["idle"]);
              }
            },
            {
              search: "\u5C11\u5973\u5496\u5561\u67AA",
              patch(json) {
                extractCubism4IdleMotions(json, ["stand"]);
              },
              patchInternalModel(internalModel) {
                for (const prop of Object.keys(internalModel))
                  if (prop.startsWith("idParam"))
                    internalModel[prop] = snakeCaseUpper(
                      internalModel[prop]
                    );
              }
            },
            {
              search: "princesses",
              patch(json) {
                extractCubism2IdleMotions(json, ["default", "loop"]);
              }
            },
            {
              search: "\u5D29\u574F",
              patch(json) {
                removeSoundDefs(json);
                if (json.name === "") delete json.name;
              }
            },
            {
              search: "\u6218\u8230\u5C11\u5973",
              patch(json) {
                removeSoundDefs(json);
              }
            },
            {
              search: "\u673A\u52A8\u6218\u961F",
              patch(json) {
                removeSoundDefs(json);
              }
            },
            {
              search: "\u8BFA\u4E9A\u5E7B\u60F3",
              patch(json) {
                if (json.name === "model") delete json.name;
              }
            }
          ];
          function folderName(url) {
            try {
              const u = new URL(url);
              const parts = u.pathname.split("/").filter(Boolean);
              return parts.slice(-2, -1)[0] || "";
            } catch {
              return "";
            }
          }
          function replaceJSONText(jsonText, url) {
            for (const p of patches)
              if (url.includes(encodeURI(p.search)) && p.replace)
                jsonText = p.replace(jsonText, url);
            return jsonText;
          }
          async function patchJSON(json, url) {
            for (const p of patches)
              if (url.includes(encodeURI(p.search)) && p.patch)
                await p.patch(json, url);
          }
          async function patchInternalModel(internalModel) {
            const url = internalModel?.settings?.url || "";
            for (const p of patches)
              if (url.includes(encodeURI(p.search)) && p.patchInternalModel)
                await p.patchInternalModel(internalModel);
          }
          function tolerantParse(text) {
            try {
              return JSON.parse(text);
            } catch {
            }
            try {
              const fixed = text.replace(/\r\n/g, "\n").replace(/,\s*(\}|\])/g, "$1");
              return JSON.parse(fixed);
            } catch {
            }
            return JSON.parse(text);
          }
          try {
            const orig = Live2DFactory.urlToJSON;
            const arr = Live2DFactory.live2DModelMiddlewares || Live2DFactory.middlewares || [];
            const idxU = arr.indexOf(orig);
            const urlToJSON = async (context, next) => {
              if (typeof context.source === "string") {
                const url = context.source;
                let json;
                if (/\.(moc|moc3)(\?|$)/i.test(url)) {
                  const isV3 = /\.moc3(\?|$)/i.test(url);
                  const base = url.replace(/[^/]+$/, "");
                  if (isV3) {
                    json = {
                      url: urlUtils.resolve(url, "dummy.model3.json"),
                      FileReferences: { Moc: url, Textures: [], Motions: {} }
                    };
                  } else {
                    json = {
                      url: urlUtils.resolve(url, "dummy.model.json"),
                      model: url,
                      textures: [],
                      motions: {}
                    };
                  }
                } else {
                  let text = await fetch(url).then((r) => r.text());
                  text = replaceJSONText(text, url);
                  json = tolerantParse(text);
                  json.url = url;
                }
                await patchJSON(json, url);
                setSingleMotionAsIdle(json);
                context.source = json;
                try {
                  context.live2dModel && context.live2dModel.emit && context.live2dModel.emit("settingsJSONLoaded", json);
                } catch {
                }
              }
              return next();
            };
            if (idxU >= 0) arr[idxU] = urlToJSON;
            else Live2DFactory.urlToJSON = urlToJSON;
          } catch {
          }
          try {
            const origInit = InternalModel.prototype.init;
            InternalModel.prototype.init = async function patchedInit() {
              try {
                await patchInternalModel(this);
              } catch {
              }
              return origInit.apply(this, arguments);
            };
          } catch {
          }
          function setSingleMotionAsIdle(json) {
            const motions = json && json.FileReferences && json.FileReferences.Motions;
            if (motions && !(motions.Idle || [])[0] && Array.isArray(motions[""]) && motions[""].length === 1) {
              motions.Idle = motions[""].map((m) => ({ ...m }));
            }
          }
          function extractCubism2IdleMotions(json, keywords) {
            if (json && json.motions) {
              const idle = [];
              for (const [group, motions] of Object.entries(
                json.motions
              )) {
                if (group !== "idle" && Array.isArray(motions)) {
                  for (const motion of motions)
                    for (const kw of keywords)
                      if (motion.file && String(motion.file).toLowerCase().includes(kw))
                        idle.push(motion);
                }
              }
              if (idle.length)
                json.motions.idle = unionBy(json.motions.idle, idle, "file");
            }
          }
          function extractCubism4IdleMotions(json, keywords) {
            const ref = json && json.FileReferences && json.FileReferences.Motions;
            if (ref) {
              const idle = [];
              for (const [group, motions] of Object.entries(ref)) {
                if (group !== "Idle" && Array.isArray(motions)) {
                  for (const motion of motions)
                    for (const kw of keywords)
                      if (motion.File && String(motion.File).toLowerCase().includes(kw))
                        idle.push(motion);
                }
              }
              if (idle.length) ref.Idle = unionBy(ref.Idle, idle, "File");
            }
          }
          function removeSoundDefs(json) {
            if (json && json.motions) {
              for (const grp of Object.values(json.motions))
                if (Array.isArray(grp))
                  for (const m of grp) m.sound = void 0;
            }
          }
        }, encodeRepoPath3 = function(path) {
          return (path || "").split("/").map((seg) => encodeURIComponent(seg)).join("/");
        }, pathToJsDelivr2 = function(repoPath, ref) {
          const encoded = encodeRepoPath3(repoPath);
          const suffix = ref ? "@" + ref : "";
          return "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model" + suffix + "/" + encoded;
        }, pathToRaw2 = function(repoPath, ref) {
          const encoded = encodeRepoPath3(repoPath);
          const branch = ref || "master";
          return "https://raw.githubusercontent.com/Eikanya/Live2d-model/" + branch + "/" + encoded;
        }, indexRootName2 = function() {
          return modelIndexRoot && modelIndexRoot.name || "Eikanya/Live2d-model";
        }, findIndexNode2 = function(path) {
          return indexPathMap[path || ""] || null;
        }, listDirFromIndex2 = function(path) {
          const node = findIndexNode2(path);
          return {
            dirs: node && node.children || [],
            files: node && node.files || []
          };
        }, buildRepoPath3 = function(path, name) {
          return (path ? path + "/" : "") + name;
        };
        var setMouthOpenParam = setMouthOpenParam2, getAudio = getAudio2, playAudioCategory = playAudioCategory2, getForcePriority = getForcePriority2, ensureAudioContext = ensureAudioContext2, startLipSyncForAudio = startLipSyncForAudio2, playRandomNonIdle = playRandomNonIdle2, interruptAndPlayRandomNonIdle = interruptAndPlayRandomNonIdle2, speakCategory = speakCategory2, stopLipSync2 = stopLipSync3, refreshAnimationsUI2 = refreshAnimationsUI3, playSelectedAnimationGroup = playSelectedAnimationGroup2, getMotionEntriesFromJson = getMotionEntriesFromJson2, startIdleLoop2 = startIdleLoop3, startIdleLoopC42 = startIdleLoopC43, snoozeIdle = snoozeIdle2, applyPixiLive2dPatches = applyPixiLive2dPatches2, encodeRepoPath2 = encodeRepoPath3, pathToJsDelivr = pathToJsDelivr2, pathToRaw = pathToRaw2, indexRootName = indexRootName2, findIndexNode = findIndexNode2, listDirFromIndex = listDirFromIndex2, buildRepoPath2 = buildRepoPath3;
        document.getElementById("model").appendChild(app.view);
        try {
          app.stage.interactive = true;
        } catch {
        }
        const modelContainerEl = document.getElementById("model");
        window.addEventListener("resize", resizeStageToContainer);
        try {
          const ro = new ResizeObserver(() => resizeStageToContainer());
          ro.observe(modelContainerEl);
        } catch {
        }
        resizeStageToContainer();
        const controls = document.getElementById("controls");
        const select = document.createElement("select");
        select.style.webkitAppRegion = "no-drag";
        MODELS2.forEach((url, i) => {
          const opt = document.createElement("option");
          opt.value = url;
          opt.textContent = `Model ${i + 1}`;
          select.appendChild(opt);
        });
        controls.insertBefore(select, controls.firstChild);
        const openInspectorBtn = document.createElement("button");
        openInspectorBtn.textContent = "Change model\u{1F496}";
        openInspectorBtn.style.webkitAppRegion = "no-drag";
        openInspectorBtn.className = "btn";
        openInspectorBtn.addEventListener("click", () => {
          let current = "";
          try {
            current = localStorage.getItem(LAST_MODEL_KEY2) || "";
          } catch {
          }
          if (!current) current = select.value || "";
          try {
            localStorage.setItem(LAST_MODEL_KEY2, current);
          } catch {
          }
          try {
            window.overlayAPI?.saveLastModel?.(current);
          } catch {
          }
          window.location.href = `viewer.html`;
        });
        controls.insertBefore(openInspectorBtn, select);
        const spineviewerbtn = document.createElement("button");
        spineviewerbtn.textContent = "spine viewer";
        spineviewerbtn.style.webkitAppRegion = "no-drag";
        spineviewerbtn.className = "btn";
        spineviewerbtn.addEventListener("click", () => {
          window.location.href = `spine.html`;
        });
        controls.insertBefore(spineviewerbtn, openInspectorBtn);
        const animSelect = document.createElement("select");
        animSelect.className = "select";
        animSelect.style.webkitAppRegion = "no-drag";
        animSelect.id = "animSelect";
        animSelect.disabled = true;
        const animPlayBtn = document.createElement("button");
        animPlayBtn.className = "btn";
        animPlayBtn.textContent = "\u25B6";
        animPlayBtn.title = "\u041F\u0440\u043E\u0438\u0433\u0440\u0430\u0442\u044C \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0433\u0440\u0443\u043F\u043F\u0443";
        animPlayBtn.style.webkitAppRegion = "no-drag";
        animPlayBtn.disabled = true;
        const voiceBtn = document.createElement("button");
        voiceBtn.className = "btn";
        voiceBtn.textContent = "Voice: Audio";
        voiceBtn.title = "\u041E\u0437\u0432\u0443\u0447\u043A\u0430 \u0444\u0440\u0430\u0437 (TTS)";
        voiceBtn.style.webkitAppRegion = "no-drag";
        controls.insertBefore(voiceBtn, openInspectorBtn);
        loadPhrasesJson();
        let voiceEnabled = true;
        let voiceMode = "audio";
        const VOICE_AUDIO_DEFAULT = {
          start: [],
          finish: [],
          break: [],
          xp: [],
          fun: []
        };
        let VOICE_AUDIO = { ...VOICE_AUDIO_DEFAULT };
        const audioCache = /* @__PURE__ */ new Map();
        let currentAudio = null;
        async function loadPhrasesJson() {
          try {
            const resp = await fetch("./phrases.json", { cache: "no-cache" });
            if (!resp.ok) return;
            const data = await resp.json();
            const mergedAudio = { ...VOICE_AUDIO_DEFAULT };
            for (const k of Object.keys(mergedAudio)) {
              const v = data[k];
              if (Array.isArray(v)) {
                mergedAudio[k] = v;
              } else if (v && Array.isArray(v.audio)) {
                mergedAudio[k] = v.audio;
              } else {
                mergedAudio[k] = [];
              }
            }
            VOICE_AUDIO = mergedAudio;
          } catch (e) {
          }
        }
        voiceBtn.addEventListener("click", () => {
          if (voiceMode === "audio") {
            voiceMode = "off";
            voiceBtn.textContent = "Voice: Off";
          } else {
            voiceMode = "audio";
            voiceBtn.textContent = "Voice: Audio";
          }
          voiceEnabled = voiceMode !== "off";
        });
        async function startLipSync2() {
          const model3 = getModel();
          if (!window.navigator || !navigator.mediaDevices) return;
          if (!model3) return;
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false
            });
            const AudioCtx = window.AudioContext || window.webkitAudioContext || null;
            if (!AudioCtx) return;
            const audioContext = new AudioCtx();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            const data = new Uint8Array(analyser.fftSize);
            source.connect(analyser);
            setLipSyncState({
              stream,
              audioContext,
              source,
              analyser,
              data,
              raf: null
            });
            const update = () => {
              if (!lipSyncEnabled) return;
              try {
                analyser.getByteTimeDomainData(data);
                let min = 255, max = 0;
                for (let i = 0; i < data.length; i++) {
                  const v = data[i];
                  if (v < min) min = v;
                  if (v > max) max = v;
                }
                let amp = (max - min) / 255;
                amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
                if (amp > 1) amp = 1;
                setMouthOpenParam2(getModel(), amp);
              } catch (e) {
              }
              const lipSyncState2 = getLipSyncState();
              lipSyncState2.raf = requestAnimationFrame(update);
              setLipSyncState(lipSyncState2);
            };
            lipSyncEnabled = true;
            update();
          } catch (e) {
          }
        }
        let cubism2Ready = false;
        let cubism4Ready = false;
        let currentRuntime2 = null;
        window.__loadedRuntime = window.__loadedRuntime || null;
        let saved = null;
        try {
          if (window.overlayAPI && typeof window.overlayAPI.getLastModel === "function") {
            try {
              saved = await window.overlayAPI.getLastModel();
            } catch {
            }
          }
          if (!saved) {
            saved = localStorage.getItem(LAST_MODEL_KEY2) || null;
          }
        } catch (e) {
          saved = null;
        }
        const initial = saved && (/\.json($|\?)/i.test(saved) || /\.moc3($|\?)/i.test(saved) || /\.moc($|\?)/i.test(saved)) ? saved : MODELS2[0];
        if (ghAvalible != false) {
          await loadSelectedModel(initial);
        } else {
          await loadSelectedModel(MODELS2[1]);
        }
        const modal = document.getElementById("modelInspector");
        const listEl = document.getElementById("inspectorList");
        const breadcrumbEl = document.getElementById("inspectorBreadcrumb");
        const urlInput = document.getElementById("inspectorUrl");
        const loadUrlBtn = document.getElementById("inspectorLoadUrl");
        let currentPath = "";
        let selectedModelPath = "";
        async function resolveModelUrl2(repoPath) {
          const tries = [
            pathToJsDelivr2(repoPath, "master"),
            pathToJsDelivr2(repoPath, "v1.0.0"),
            pathToRaw2(repoPath, "master"),
            pathToRaw2(repoPath, "v1.0.0")
          ];
          for (const url of tries) {
            try {
              const r = await fetch(url, { method: "HEAD" });
              if (r.ok) return url;
            } catch {
            }
          }
          return pathToRaw2(repoPath, "master");
        }
        const INDEX_URL = "https://guansss.github.io/live2d-viewer-web/eikanyalive2d-model.json";
        let modelIndexRoot = null;
        let modelInfoMap = null;
        let indexPathMap = {};
        async function ensureIndexLoaded2() {
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
          (function build(node, prefix) {
            const path = prefix || "";
            indexPathMap[path] = node;
            const children = node && node.children || [];
            for (const ch of children) {
              if (!ch || !ch.name) continue;
              const next = path ? path + "/" + ch.name : ch.name;
              build(ch, next);
            }
          })(modelIndexRoot, "");
        }
        async function buildSyntheticCubism2Json2(repoPathToMoc) {
          const key = indexRootName2() + "/" + repoPathToMoc;
          const meta = modelInfoMap[key] || {};
          const dir = repoPathToMoc.replace(/\/?[^/]*$/, "");
          const modelUrl = await resolveModelUrl2(repoPathToMoc);
          const textures = Array.isArray(meta.textures) ? meta.textures : ["texture_00.png"];
          const motionsObj = {};
          if (meta.motions) {
            for (const g of Object.keys(meta.motions)) {
              motionsObj[g] = (meta.motions[g] || []).map((m) => ({
                file: m
              }));
            }
          }
          const absTextures = [];
          for (const t of textures)
            absTextures.push(await resolveModelUrl2((dir ? dir + "/" : "") + t));
          const absPhysics = meta.physics ? await resolveModelUrl2((dir ? dir + "/" : "") + meta.physics) : void 0;
          const json = { model: modelUrl, textures: absTextures };
          if (absPhysics) json.physics = absPhysics;
          if (Object.keys(motionsObj).length) json.motions = motionsObj;
          return "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
        }
        (function() {
          const TIMER_WORK_DEFAULT = 25 * 60;
          const TIMER_BREAK_DEFAULT = 5 * 60;
          let workDuration = TIMER_WORK_DEFAULT;
          let breakDuration = TIMER_BREAK_DEFAULT;
          let timeLeft = workDuration;
          let running = false;
          let mode = "work";
          const stateKey = "anime_overlay_rpg_v1";
          let state = { level: 1, xp: 0, tomatoes: 0 };
          try {
            const saved2 = localStorage.getItem(stateKey);
            if (saved2) state = JSON.parse(saved2);
          } catch (e) {
          }
          const $ = (id) => document.getElementById(id);
          const controlsWrap = $("controls");
          const toggleUIBtn = $("toggleUI");
          const showUIBtn = $("showUIBtn");
          const UI_HIDDEN_KEY = "anime_overlay_ui_hidden_v1";
          function setUIHidden(hidden) {
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
            } catch {
            }
          }
          try {
            const saved2 = localStorage.getItem(UI_HIDDEN_KEY) || "0";
            setUIHidden(saved2 === "1");
          } catch {
          }
          try {
            if (toggleUIBtn)
              toggleUIBtn.addEventListener("click", () => {
                const hidden = controlsWrap && controlsWrap.classList.contains("hidden");
                setUIHidden(!hidden);
              });
            if (showUIBtn)
              showUIBtn.addEventListener("click", () => setUIHidden(false));
          } catch {
          }
          const timerDisplay = $("timerDisplay");
          const timerLabel = $("timerLabel");
          const startBtn = $("startBtn");
          const pauseBtn = $("pauseBtn");
          const resetBtn = $("resetBtn");
          const levelEl = $("level");
          const xpEl = $("xp");
          const tomatoesEl = $("tomatoes");
          function saveState() {
            try {
              localStorage.setItem(stateKey, JSON.stringify(state));
            } catch (e) {
            }
          }
          function formatTime(s) {
            const mm = Math.floor(s / 60);
            const ss = s % 60;
            return String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
          }
          function updateUI() {
            timerDisplay.textContent = formatTime(timeLeft);
            timerLabel.textContent = mode === "work" ? "\u0420\u0430\u0431\u043E\u0442\u0430" : "\u041F\u0435\u0440\u0435\u0440\u044B\u0432";
            levelEl.textContent = state.level;
            xpEl.textContent = state.xp;
            tomatoesEl.textContent = state.tomatoes;
          }
          function rewardForWork() {
            state.xp += 10;
            state.tomatoes += 1;
            if (state.xp >= state.level * 100) {
              state.xp -= state.level * 100;
              state.level += 1;
              pulseModel(1.3, 600);
              toast("\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u043F\u043E\u0432\u044B\u0448\u0435\u043D!");
              speakCategory2("xp");
            } else {
              pulseModel(1.1, 400);
            }
            saveState();
            updateUI();
          }
          function toast(msg) {
            const t = document.createElement("div");
            t.textContent = msg;
            t.style.position = "absolute";
            t.style.left = "8px";
            t.style.bottom = "8px";
            t.style.background = "rgba(0,0,0,0.6)";
            t.style.color = "white";
            t.style.padding = "6px";
            t.style.borderRadius = "6px";
            t.style.zIndex = "30";
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 2500);
          }
          function pulseModel(scale, to) {
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
              m.x = origX;
              m.y = origY;
              if (p < 1) requestAnimationFrame(tick);
              else m.scale.set(start);
            };
            requestAnimationFrame(tick);
          }
          function tryStartRandomMotion(preferredGroup) {
            const m = getModel();
            if (!m) return false;
            try {
              const groups = [
                preferredGroup,
                "TapBody",
                "TapHand",
                "TapHead",
                "Idle"
              ];
              if (typeof m.motion === "function") {
                for (const g of groups) {
                  try {
                    if (g) {
                      m.motion(g);
                      return true;
                    }
                  } catch (e) {
                  }
                }
              }
              if (m.internalModel && m.internalModel.motionManager) {
                const manager = m.internalModel.motionManager;
                if (typeof manager.startRandomMotion === "function") {
                  for (const g of groups) {
                    try {
                      if (g) {
                        manager.startRandomMotion(g);
                        toast("\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F: " + g);
                        return true;
                      } else {
                        manager.startRandomMotion();
                        toast("\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F: default");
                        return true;
                      }
                    } catch (e) {
                    }
                  }
                }
                if (typeof manager.startMotion === "function") {
                  for (const g of groups) {
                    try {
                      manager.startMotion(g || "");
                      return true;
                    } catch (e) {
                    }
                  }
                }
              }
              if (m.internalModel && typeof m.internalModel.startRandomMotion === "function") {
                try {
                  m.internalModel.startRandomMotion(preferredGroup);
                  return true;
                } catch (e) {
                }
              }
              pulseModel(1.08, 300);
              return true;
            } catch (e) {
              console.error("tryStartRandomMotion failed", e);
              pulseModel(1.05, 250);
              return false;
            }
          }
          function playRandomNonIdle3() {
            if (!getModel() || !motionEntries.length) return;
            const candidates = motionEntries.filter((m) => {
              const g = String(m.group || "").toLowerCase();
              const f = String(m.file || "").toLowerCase();
              return g !== "idle" && !f.includes("idle");
            });
            const list = candidates.length ? candidates : motionEntries;
            const pick = list[Math.floor(Math.random() * list.length)];
            try {
              const mm = getModel().internalModel && getModel().internalModel.motionManager;
              const pr = getForcePriority2();
              if (mm && typeof mm.startMotion === "function")
                mm.startMotion(pick.group, pick.index, pr);
              else if (mm && typeof mm.startRandomMotion === "function")
                mm.startRandomMotion(pick.group, pr);
            } catch (e) {
            }
          }
          function interruptAndPlayRandomNonIdle3() {
            const m = getModel();
            if (!m) return;
            const tryRuntimeGroups = () => {
              try {
                const mmFallback = m && m.internalModel && m.internalModel.motionManager;
                const defs = mmFallback && (mmFallback.definitions || mmFallback._definitions || mmFallback._motions);
                if (defs && Object.keys(defs).length) {
                  const groups = Object.keys(defs).filter(
                    (g) => String(g || "").toLowerCase() !== "idle" && String(g || "").length > 0
                  );
                  if (groups.length) {
                    const g = groups[Math.floor(Math.random() * groups.length)];
                    const pr = getForcePriority2();
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
              } catch (e) {
              }
              return false;
            };
            const stopCurrent = () => {
              try {
                const mm = m.internalModel && m.internalModel.motionManager;
                if (mm) {
                  if (typeof mm.stopAllMotions === "function")
                    mm.stopAllMotions();
                  else if (mm._motionQueueManager && typeof mm._motionQueueManager.stopAllMotions === "function")
                    mm._motionQueueManager.stopAllMotions();
                }
              } catch (e) {
              }
            };
            const tryModelConvenience = () => {
              try {
                if (typeof m.motion === "function") {
                  const groups = ["TapBody", "TapHead", "Tap", "Body", "Idle"];
                  for (const g of groups) {
                    try {
                      m.motion(g);
                      return true;
                    } catch (e) {
                    }
                  }
                }
              } catch (e) {
              }
              return false;
            };
            let attempts = 5;
            const tryStart = () => {
              stopCurrent();
              if (Array.isArray(getmotionEntries()) && getmotionEntries().length) {
                playRandomNonIdle3();
                snoozeIdle2(6e3);
                return;
              }
              if (tryRuntimeGroups()) {
                snoozeIdle2(6e3);
                return;
              }
              try {
                if (typeof tryStartRandomMotion === "function") {
                  const ok = tryStartRandomMotion("TapBody");
                  if (ok) {
                    snoozeIdle2(6e3);
                    return;
                  }
                }
              } catch (e) {
              }
              if (tryModelConvenience()) {
                snoozeIdle2(6e3);
                return;
              }
              if (attempts-- > 0) setTimeout(tryStart, 200);
            };
            tryStart();
          }
          function focusModel() {
            const m = getModel();
            if (!m) return;
            m.scale.set(0.55);
          }
          function relaxModel() {
            const m = getModel();
            if (!m) return;
            m.scale.set(0.65);
          }
          let timerInterval = null;
          function startTimer() {
            if (running) return;
            running = true;
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            speakCategory2("start");
            interruptAndPlayRandomNonIdle3();
            timerInterval = setInterval(() => {
              timeLeft--;
              if (timeLeft <= 0) {
                clearInterval(timerInterval);
                running = false;
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                completeSession();
              }
              updateUI();
            }, 1e3);
          }
          function pauseTimer() {
            if (!running) return;
            running = false;
            clearInterval(timerInterval);
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            speakCategory2("break");
            interruptAndPlayRandomNonIdle3();
          }
          function resetTimer() {
            pauseTimer();
            mode = "work";
            workDuration = TIMER_WORK_DEFAULT;
            breakDuration = TIMER_BREAK_DEFAULT;
            timeLeft = workDuration;
            updateUI();
          }
          function completeSession() {
            if (mode === "work") {
              rewardForWork();
              mode = "break";
              timeLeft = breakDuration;
              toast("\u041F\u0435\u0440\u0435\u0440\u044B\u0432!");
              speakCategory2("break");
              try {
                const m = getModel();
                if (m && m.internalModel && m.internalModel.motionManager && m.internalModel.motionManager.startRandomMotion)
                  m.internalModel.motionManager.startRandomMotion("Relax");
              } catch (e) {
              }
            } else {
              mode = "work";
              timeLeft = workDuration;
              toast("\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C!");
              speakCategory2("finish");
            }
            updateUI();
          }
          const modelDiv = $("model");
          modelDiv.addEventListener("click", () => {
            state.xp += 1;
            saveState();
            updateUI();
            toast("+1 XP");
          });
          startBtn.addEventListener("click", startTimer);
          pauseBtn.addEventListener("click", pauseTimer);
          resetBtn.addEventListener("click", resetTimer);
          timeLeft = workDuration;
          updateUI();
          pauseBtn.disabled = true;
          startBtn.disabled = false;
          const pinBtn = document.getElementById("pin");
          const opacityInput = document.getElementById("opacity");
          let pinned = false;
          pinBtn.addEventListener("click", async () => {
            pinned = !pinned;
            pinBtn.textContent = pinned ? "Pinned" : "Pin";
            if (window.overlayAPI)
              await window.overlayAPI.toggleClickThrough(pinned);
          });
          opacityInput.addEventListener("input", () => {
            try {
              const m = getModel();
              const base = window.__live2d_base_scale || (m ? m.scale.x : 1);
              const factor = Math.max(
                0.01,
                Math.min(1.5, Number(opacityInput.value))
              );
              if (m && isFinite(base)) {
                const origX = m.x;
                const origY = m.y;
                m.scale.set(factor / 2);
                m.x = origX;
                m.y = origY;
                try {
                  m.__userScaled = true;
                } catch {
                }
                try {
                  saveModelState();
                } catch {
                }
              }
            } catch {
            }
          });
          if (window.overlayAPI && window.overlayAPI.onEvent) {
            const processed = /* @__PURE__ */ new Set();
            window.overlayAPI.onEvent((data) => {
              try {
                if (!data || !data.type) return;
                const key = [
                  data.type,
                  data.path || "",
                  data.timestamp || ""
                ].join("|");
                if (processed.has(key)) return;
                processed.add(key);
                if (data.type === "save") {
                  const chars = typeof data.chars === "number" ? data.chars : 0;
                  let gain = 0;
                  if (chars > 0) gain = Math.max(1, Math.ceil(chars / 10));
                  if (gain > 0) {
                    state.xp += gain;
                    saveState();
                    updateUI();
                    toast("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E: +" + gain + " XP (" + chars + " chars)");
                    speakCategory2("xp");
                    playRandomNonIdle3();
                  } else {
                    toast("\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E (\u0431\u0435\u0437 XP)");
                  }
                } else if (data.type === "edit") {
                  saveState();
                  updateUI();
                  toast("\u041F\u0440\u0430\u0432\u043A\u0430");
                  playRandomNonIdle3();
                  if (Math.random() < 0.1) speakCategory2("fun");
                } else if (data.type === "focus") {
                  focusModel();
                  toast("\u0424\u043E\u043A\u0443\u0441 \u043D\u0430 \u0444\u0430\u0439\u043B\u0435");
                }
              } catch (e) {
                console.error("onEvent handler", e);
              }
            });
          }
        })();
      } catch (e) {
        console.error("Live2D load error", e);
        const el = document.getElementById("model");
        el.textContent = "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043C\u043E\u0434\u0435\u043B\u0438: " + (e && e.message ? e.message : e);
        const img = document.createElement("img");
        img.style.width = "100%";
        img.style.height = "100%";
        img.src = "./img/demo.gif";
        el.appendChild(img);
      }
    })();
  } else {
  }

  // src/utils/utils.ts
  function toAbsoluteAssetUrl(modelJsonUrl, assetPath) {
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
  window.addEventListener("keydown", (e) => {
    if (e.key === "F12" && window.overlayAPI && window.overlayAPI.openDevTools)
      window.overlayAPI.openDevTools();
  });

  // src/renderer/live2d/live2dLoader.ts
  var MODELS = config.MODELS;
  var LAST_MODEL_KEY = config.LAST_MODEL_KEY;
  var __loadedRuntime = null;
  var __live2d_patches_installed = false;
  async function loadScript(src) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res();
      s.onerror = () => rej(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function getAlternativeURL2(u) {
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
    } catch {
    }
    return u;
  }
  async function loadJson5IfNeeded() {
    try {
      if (window.JSON5) return window.JSON5;
    } catch {
    }
    try {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.min.js"
      );
      return window.JSON5 || null;
    } catch {
      return null;
    }
  }
  function installLive2dPatches(ns) {
    if (!ns || __live2d_patches_installed) return;
    try {
      const Loader = ns.Live2DLoader;
      const XHR = ns.XHRLoader;
      if (Loader && XHR && Array.isArray(Loader.middlewares)) {
        const idx = Loader.middlewares.indexOf(XHR.loader);
        if (idx >= 0) {
          const orig = XHR.loader;
          Loader.middlewares[idx] = async (context, next) => {
            const url = context.settings ? context.settings.resolveURL(context.url) : context.url;
            try {
              await orig(context, next);
              return;
            } catch (e) {
              if (!(e && e.status === 403 && typeof url === "string" && url.includes("jsdelivr")))
                throw e;
            }
            try {
              context.url = getAlternativeURL2(url);
            } catch {
            }
            await orig(context, next);
            return next();
          };
        }
      }
    } catch {
    }
    try {
      const Factory = ns.Live2DFactory;
      if (Factory && Array.isArray(Factory.live2DModelMiddlewares)) {
        const idx = Factory.live2DModelMiddlewares.indexOf(Factory.urlToJSON);
        if (idx >= 0) {
          Factory.live2DModelMiddlewares[idx] = async (context, next) => {
            if (typeof context.source === "string") {
              let url = context.source;
              let text = null;
              try {
                const r1 = await fetch(url);
                text = await r1.text();
              } catch {
              }
              try {
                if (!text || /^\s*<!DOCTYPE|<html/i.test(text)) {
                  const alt = getAlternativeURL2(url);
                  if (alt && alt !== url) {
                    const r2 = await fetch(alt);
                    const t2 = await r2.text();
                    if (t2) {
                      text = t2;
                      url = alt;
                    }
                  }
                }
              } catch {
              }
              if (!text) throw new Error("Failed to fetch settings JSON");
              let json = null;
              try {
                json = JSON.parse(text);
              } catch {
                try {
                  const JSON5 = await loadJson5IfNeeded();
                  if (JSON5) json = JSON5.parse(text);
                } catch {
                }
              }
              if (!json) throw new Error("Failed to parse settings JSON");
              try {
                json.url = url;
              } catch {
              }
              context.source = json;
              try {
                context.live2dModel?.emit?.("settingsJSONLoaded", json);
              } catch {
              }
            }
            return next();
          };
        }
      }
    } catch {
    }
    __live2d_patches_installed = true;
  }
  async function ensureCubism4() {
    if (!window.Live2DCubismCore) {
      await loadScript("./vendor/live2dcubismcore.min.js");
    }
    if (!window.__live2d_api_c4) {
      await loadScript("./vendor/cubism4.min.js");
      try {
        window.__live2d_api_c4 = PIXI.live2d;
        __loadedRuntime = "c4";
        try {
          window.__loadedRuntime = "c4";
        } catch {
        }
      } catch {
      }
    }
    try {
      installLive2dPatches(
        window.__live2d_api_c4 || PIXI.live2d
      );
    } catch {
    }
  }
  async function ensureCubism2() {
    if (!window.Live2D) {
      await loadScript("./vendor/live2d.min.js");
    }
    if (!window.__live2d_api_c2) {
      await loadScript("./vendor/cubism2.min.js");
      try {
        window.__live2d_api_c2 = PIXI.live2d;
        __loadedRuntime = "c2";
        try {
          window.__loadedRuntime = "c2";
        } catch {
        }
      } catch {
      }
    }
    try {
      installLive2dPatches(
        window.__live2d_api_c2 || PIXI.live2d
      );
    } catch {
    }
  }
  function detectUseV4FromUrl(u) {
    try {
      if (!u) return null;
      const low = u.toLowerCase();
      if (/(^|\/)model3\.json(\?|$)/.test(low)) return true;
      if (/(^|\/)model\.json(\?|$)/.test(low)) return false;
    } catch {
    }
    return null;
  }
  function detectRuntimeByUrl2(u) {
    try {
      if (!u) return null;
      const low = u.toLowerCase();
      if (/\.model3\.json(\?|$)/.test(low) || /\.moc3(\?|$)/.test(low))
        return true;
      if (/\.model\.json(\?|$)/.test(low) || /\.moc(\?|$)/.test(low))
        return false;
      if (/\.json(\?|$)/.test(low)) return false;
    } catch {
    }
    return null;
  }
  function rewriteModelJsonUrls(modelJsonUrl, j) {
    try {
      if (j && j.FileReferences) {
        if (j.FileReferences.Moc)
          j.FileReferences.Moc = toAbsoluteAssetUrl(
            modelJsonUrl,
            j.FileReferences.Moc
          );
        if (Array.isArray(j.FileReferences.Textures))
          j.FileReferences.Textures = j.FileReferences.Textures.map(
            (t) => toAbsoluteAssetUrl(modelJsonUrl, t)
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
          j.textures = j.textures.map(
            (t) => toAbsoluteAssetUrl(modelJsonUrl, t)
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
                if (m.file)
                  m.file = toAbsoluteAssetUrl(
                    modelJsonUrl,
                    m.file
                  );
                if (m.File)
                  m.File = toAbsoluteAssetUrl(
                    modelJsonUrl,
                    m.File
                  );
              }
            }
          }
        }
      }
    } catch {
    }
    return j;
  }
  async function loadSettingsJson(url, forceV4) {
    let useV4 = forceV4 ?? detectUseV4FromUrl(url);
    const byExt = detectRuntimeByUrl2(url);
    let groups = [];
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
      } catch {
      }
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
          cloned.url = url;
        } catch {
        }
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
      const tex = PIXI.utils && PIXI.utils.TextureCache || {};
      for (const k of Object.keys(tex)) {
        try {
          tex[k]?.destroy?.(true);
        } catch {
        }
        delete tex[k];
      }
    } catch {
    }
    try {
      const btex = PIXI.utils && PIXI.utils.BaseTextureCache || {};
      for (const k of Object.keys(btex)) {
        try {
          btex[k]?.destroy?.();
        } catch {
        }
        delete btex[k];
      }
    } catch {
    }
  }
  async function loadModel2(app2, url, forceV4) {
    const stageDiv = document.getElementById("stage");
    try {
      await clearPixiCaches();
      if (getModel()) {
        try {
          app2.stage.removeChild(getModel());
          getModel()?.destroy?.(true);
        } catch {
        }
      }
      setModel(void 0);
    } catch {
    }
    const { urlOrSettings, useV4, originalUrl, groups } = await loadSettingsJson(
      url,
      forceV4
    );
    try {
      localStorage.setItem(config.LAST_MODEL_KEY, originalUrl);
    } catch {
    }
    try {
      window.overlayAPI?.saveLastModel?.(originalUrl);
    } catch {
    }
    try {
      const desired = useV4 === true ? "c4" : useV4 === false ? "c2" : null;
      if (desired && __loadedRuntime && __loadedRuntime !== desired) {
        window.location.href = `viewer.html`;
        throw new Error("Switching runtime requires reload");
      }
    } catch {
    }
    if (useV4 === true) await ensureCubism4();
    else if (useV4 === false) await ensureCubism2();
    else await ensureCubism4();
    let model3 = null;
    const ns = useV4 ? window.__live2d_api_c4 || PIXI.live2d : window.__live2d_api_c2 || PIXI.live2d;
    const prevLive2d = PIXI.live2d;
    PIXI.live2d = ns;
    try {
      model3 = await PIXI.live2d.Live2DModel.from(urlOrSettings, {
        motionPreload: "none"
      });
    } catch {
      try {
        model3 = await PIXI.live2d.Live2DModel.from(urlOrSettings);
      } catch {
        if (useV4 === false && typeof urlOrSettings === "string") {
          try {
            const resp = await fetch(String(urlOrSettings), {
              headers: { Accept: "application/json" }
            });
            const txt = await resp.text();
            const j = JSON.parse(txt);
            const cloned = JSON.parse(JSON.stringify(j));
            rewriteModelJsonUrls(String(urlOrSettings), cloned);
            model3 = await PIXI.live2d.Live2DModel.from(cloned);
          } catch {
          }
        }
      }
    } finally {
      try {
        PIXI.live2d = prevLive2d;
      } catch {
      }
    }
    setModel(model3);
    try {
      stageDiv.dataset.modelUrl = originalUrl;
    } catch {
    }
    try {
    } catch {
    }
    try {
      getModel()?.anchor && getModel().anchor.set(0.5, 0.5);
    } catch {
    }
    try {
      enableDraggingForModel2(app2, getModel());
    } catch {
    }
    app2.stage.addChild(getModel());
    const fitModel = () => {
      if (!getModel()) return;
      getModel().x = app2.renderer.width / 2;
      getModel().y = app2.renderer.height / 2;
      try {
        const b = getModel().getBounds();
        const scale = Math.min(
          0.9,
          app2.renderer.width * 0.9 / Math.max(1, b.width),
          app2.renderer.height * 0.9 / Math.max(1, b.height)
        );
        if (isFinite(scale) && scale > 0) getModel().scale.set(scale);
      } catch {
      }
    };
    fitModel();
    return { model: model3, groups, fitModel };
  }
  async function loadSelectedModel(url) {
    const model3 = getModel();
    if (model3) {
      try {
        app.stage.removeChild(model3);
        model3.destroy(true);
      } catch (e) {
      }
      if (getLipSyncState().lipSyncEnabled) stopLipSync();
    }
    setmotionEntries([]);
    const byExt = detectRuntimeByUrl2(url);
    const res = await loadModel2(app, url, byExt);
    setModel(res && res.model ? res.model : null);
    try {
      window.__current_model_url = String(url);
    } catch {
    }
    setavailableGroups(Array.isArray(res?.groups)) ? res.groups : [];
    try {
      enableDraggingForModel2(model3);
    } catch {
    }
    scheduleGroupRefresh2();
    try {
      await restoreModelState();
    } catch {
    }
    await new Promise(
      (r) => requestAnimationFrame(() => requestAnimationFrame(r))
    );
    try {
      fitModelToCanvas();
      if (model3) {
        model3.alpha = 1;
        model3.visible = true;
      }
    } catch {
    }
    try {
      saveModelState2();
    } catch {
    }
    try {
      if (currentRuntime === "c4") {
        startIdleLoopC4(model3);
      } else {
        startIdleLoop(
          model3,
          Array.from(
            new Set(
              (getmotionEntries() || []).map((e) => String(e.group || "").trim())
            )
          ).filter(Boolean)
        );
      }
    } catch {
    }
    try {
      await startLipSync();
    } catch {
    }
  }
  function scheduleGroupRefresh2() {
    const model3 = getModel();
    let attempts = 16;
    const poll = () => {
      if (!model3) return;
      try {
        const mm = model3.internalModel && model3.internalModel.motionManager;
        const groups = getGroupsFromManager(mm);
        if (groups && groups.length) {
          setavailableGroups(
            Array.from(/* @__PURE__ */ new Set([...getavailableGroups() || [], ...groups]))
          );
          refreshAnimationsUI();
          return;
        }
      } catch (e) {
      }
      if (--attempts > 0) setTimeout(poll, 250);
    };
    poll();
  }
  function getGroupsFromManager(mm) {
    try {
      const defs = mm && (mm.definitions || mm._definitions || mm._motions || {});
      return Object.keys(defs || {});
    } catch (e) {
      return [];
    }
  }
  var dragState = {
    active: false,
    data: null,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    target: null
  };
  function installStageDragHandlers(app2, model3) {
    try {
      if (app2.stage.__dragHandlersInstalled) return;
      app2.stage.interactive = true;
      const onMove = (ev) => {
        try {
          if (!dragState.active || !dragState.data || !dragState.target) return;
          const parent = dragState.target.parent || app2.stage;
          const p = dragState.data.getLocalPosition(parent);
          const nx = dragState.origX + (p.x - dragState.startX);
          const ny = dragState.origY + (p.y - dragState.startY);
          dragState.target.position.set(nx, ny);
        } catch {
        }
      };
      const onUp = () => {
        try {
          if (dragState.target) {
            try {
              dragState.target.__userMoved = true;
            } catch {
            }
            try {
              dragState.target.cursor = "grab";
            } catch {
            }
            try {
              saveModelState2(model3);
            } catch {
            }
          }
          dragState.active = false;
          dragState.data = null;
          dragState.target = null;
        } catch {
        }
      };
      app2.stage.on("pointermove", onMove);
      app2.stage.on("pointerup", onUp);
      app2.stage.on("pointerupoutside", onUp);
      app2.stage.on("pointercancel", onUp);
      app2.stage.__dragHandlersInstalled = true;
    } catch {
    }
  }
  function saveModelState2(model3) {
    try {
      const url = getCurrentModelUrl();
      if (!url || !model3) return;
      const x = Number(model3.x) || 0;
      const y = Number(model3.y) || 0;
      const scale = Number(model3.scale?.x) || 1;
      try {
        window.overlayAPI?.saveModelState?.(url, x, y, scale);
      } catch {
      }
      const state = { x, y, scale };
      localStorage.setItem(stateKeyFor(url), JSON.stringify(state));
    } catch {
    }
  }
  async function restoreModelState() {
    try {
      const url = getCurrentModelUrl();
      if (!url || !model) return false;
      let s = null;
      try {
        s = await window.overlayAPI?.getModelState?.(url);
      } catch {
      }
      if (!s) {
        const raw = localStorage.getItem(stateKeyFor(url));
        if (raw) s = JSON.parse(raw || "null");
      }
      if (!s || typeof s !== "object") return false;
      if (isFinite(Number(s.x)) && isFinite(Number(s.y))) {
        model.x = Number(s.x);
        model.y = Number(s.y);
        try {
          model.__userMoved = true;
        } catch {
        }
      }
      if (isFinite(Number(s.scale)) && Number(s.scale) > 0) {
        model.scale?.set(Number(s.scale));
        try {
          model.__userScaled = true;
        } catch {
        }
      }
      return true;
    } catch {
      return false;
    }
  }
  function getCurrentModelUrl() {
    try {
      return window.__current_model_url || localStorage.getItem(LAST_MODEL_KEY) || "";
    } catch {
      return "";
    }
  }
  function enableDraggingForModel2(app2, target, saveModelState3) {
    if (!target) return;
    installStageDragHandlers(app2, target, saveModelState3);
    try {
      target.interactive = true;
      target.cursor = "grab";
    } catch {
    }
    const onDown = (event) => {
      try {
        dragState.active = true;
        dragState.data = event.data || event;
        dragState.target = target;
        const parent = target.parent || app2.stage;
        const p = dragState.data.getLocalPosition(parent);
        dragState.startX = p.x;
        dragState.startY = p.y;
        dragState.origX = target.x;
        dragState.origY = target.y;
        try {
          target.cursor = "grabbing";
        } catch {
        }
        if (event.stopPropagation) event.stopPropagation();
      } catch {
      }
    };
    target.on("pointerdown", onDown);
    target.on("touchstart", onDown);
  }

  // src/renderer/viewer.ts
  var __loadedRuntime2 = null;
  var __live2d_patches_installed2 = false;
  async function loadScript2(src) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res();
      s.onerror = (ev) => rej(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function getAlternativeURL3(u) {
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
    } catch {
    }
    return u;
  }
  async function loadJson5IfNeeded2() {
    try {
      if (window.JSON5) return window.JSON5;
    } catch {
    }
    try {
      await loadScript2(
        "https://cdn.jsdelivr.net/npm/json5@2.2.3/dist/index.min.js"
      );
      return window.JSON5 || null;
    } catch {
      return null;
    }
  }
  function installLive2dPatches2(ns) {
    if (!ns || __live2d_patches_installed2) return;
    try {
      const Loader = ns.Live2DLoader;
      const XHR = ns.XHRLoader;
      if (Loader && XHR && Array.isArray(Loader.middlewares)) {
        const idx = Loader.middlewares.indexOf(XHR.loader);
        if (idx >= 0) {
          const orig = XHR.loader;
          Loader.middlewares[idx] = async (context, next) => {
            const url = context.settings ? context.settings.resolveURL(context.url) : context.url;
            try {
              await orig(context, next);
              return;
            } catch (e) {
              if (!(e && e.status === 403 && typeof url === "string" && url.includes("jsdelivr"))) {
                throw e;
              }
              console.warn(
                "[viewer] 403 from jsDelivr, switching to alternative URL"
              );
            }
            try {
              context.url = getAlternativeURL3(url);
            } catch {
            }
            await orig(context, next);
            return next();
          };
        }
      }
    } catch {
    }
    try {
      const Factory = ns.Live2DFactory;
      if (Factory && Array.isArray(Factory.live2DModelMiddlewares)) {
        const idx = Factory.live2DModelMiddlewares.indexOf(Factory.urlToJSON);
        if (idx >= 0) {
          Factory.live2DModelMiddlewares[idx] = async (context, next) => {
            if (typeof context.source === "string") {
              let url = context.source;
              let text = null;
              try {
                const r1 = await fetch(url);
                text = await r1.text();
              } catch {
              }
              try {
                if (!text || /^\s*<!DOCTYPE|<html/i.test(text)) {
                  const alt = getAlternativeURL3(url);
                  if (alt && alt !== url) {
                    const r2 = await fetch(alt);
                    const t2 = await r2.text();
                    if (t2) {
                      text = t2;
                      url = alt;
                    }
                  }
                }
              } catch {
              }
              if (!text) throw new Error("Failed to fetch settings JSON");
              let json = null;
              try {
                json = JSON.parse(text);
              } catch {
                try {
                  const JSON5 = await loadJson5IfNeeded2();
                  if (JSON5) json = JSON5.parse(text);
                } catch {
                }
              }
              if (!json) throw new Error("Failed to parse settings JSON");
              try {
                json.url = url;
              } catch {
              }
              context.source = json;
              try {
                context.live2dModel?.emit?.("settingsJSONLoaded", json);
              } catch {
              }
            }
            return next();
          };
        }
      }
    } catch {
    }
    __live2d_patches_installed2 = true;
  }
  async function ensureCubism42() {
    if (!window.Live2DCubismCore) {
      await loadScript2("./vendor/live2dcubismcore.min.js");
    }
    if (!window.__live2d_api_c4) {
      await loadScript2("./vendor/cubism4.min.js");
      try {
        window.__live2d_api_c4 = PIXI.live2d;
        __loadedRuntime2 = "c4";
      } catch {
      }
    }
    try {
      installLive2dPatches2(
        window.__live2d_api_c4 || PIXI.live2d
      );
    } catch {
    }
  }
  async function ensureCubism22() {
    if (!window.Live2D) {
      await loadScript2("./vendor/live2d.min.js");
    }
    if (!window.__live2d_api_c2) {
      await loadScript2("./vendor/cubism2.min.js");
      try {
        window.__live2d_api_c2 = PIXI.live2d;
        __loadedRuntime2 = "c2";
      } catch {
      }
    }
    try {
      installLive2dPatches2(
        window.__live2d_api_c2 || PIXI.live2d
      );
    } catch {
    }
  }
  function detectRuntimeByUrl3(u) {
    try {
      if (!u) return null;
      const low = u.toLowerCase();
      if (/\.model3\.json(\?|$)/.test(low) || /\.moc3(\?|$)/.test(low))
        return true;
      if (/\.model\.json(\?|$)/.test(low) || /\.moc(\?|$)/.test(low))
        return false;
      if (/\.json(\?|$)/.test(low)) return false;
    } catch {
    }
    return null;
  }
  function toAbsoluteAssetUrl2(modelJsonUrl, assetPath) {
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
  function rewriteModelJsonUrls2(modelJsonUrl, j) {
    try {
      if (j && j.FileReferences) {
        if (j.FileReferences.Moc)
          j.FileReferences.Moc = toAbsoluteAssetUrl2(
            modelJsonUrl,
            j.FileReferences.Moc
          );
        if (Array.isArray(j.FileReferences.Textures))
          j.FileReferences.Textures = j.FileReferences.Textures.map(
            (t) => toAbsoluteAssetUrl2(modelJsonUrl, t)
          );
        if (j.FileReferences.Physics)
          j.FileReferences.Physics = toAbsoluteAssetUrl2(
            modelJsonUrl,
            j.FileReferences.Physics
          );
        if (j.FileReferences.Motions) {
          for (const g of Object.keys(j.FileReferences.Motions)) {
            const arr = j.FileReferences.Motions[g] || [];
            for (const m of arr)
              if (m.File) m.File = toAbsoluteAssetUrl2(modelJsonUrl, m.File);
          }
        }
      }
      if (j) {
        if (j.model) j.model = toAbsoluteAssetUrl2(modelJsonUrl, j.model);
        if (Array.isArray(j.textures))
          j.textures = j.textures.map(
            (t) => toAbsoluteAssetUrl2(modelJsonUrl, t)
          );
        if (j.physics) j.physics = toAbsoluteAssetUrl2(modelJsonUrl, j.physics);
        if (j.motions) {
          for (const g of Object.keys(j.motions)) {
            const arr = j.motions[g] || [];
            for (let i = 0; i < arr.length; i++) {
              const m = arr[i];
              if (typeof m === "string")
                arr[i] = { file: toAbsoluteAssetUrl2(modelJsonUrl, m) };
              else {
                if (m.file)
                  m.file = toAbsoluteAssetUrl2(
                    modelJsonUrl,
                    m.file
                  );
                if (m.File)
                  m.File = toAbsoluteAssetUrl2(
                    modelJsonUrl,
                    m.File
                  );
              }
            }
          }
        }
      }
    } catch {
    }
    return j;
  }
  function initBackButton() {
    const stageDiv = document.getElementById("stage");
    const backBtn = document.getElementById("backBtn");
    backBtn?.addEventListener("click", () => {
      try {
        window.overlayAPI?.exitFullscreen?.();
      } catch {
      }
      const currentModel = stageDiv?.dataset?.modelUrl || "";
      localStorage.setItem(config.LAST_MODEL_KEY, currentModel);
      window.location.href = `index.html`;
    });
  }
  (async () => {
    try {
      window.overlayAPI?.enterFullscreen?.();
    } catch {
    }
    const stageDiv = document.getElementById("stage");
    const treeEl = document.getElementById("tree");
    const listEl = document.getElementById("list");
    const crumbEl = document.getElementById("breadcrumb");
    const app2 = new PIXI.Application({
      transparent: true,
      width: 360,
      height: 420
    });
    stageDiv.appendChild(app2.view);
    const onResize = () => {
      try {
        const w = stageDiv.clientWidth || 360;
        const h = stageDiv.clientHeight || 420;
        app2.renderer.resize(w, h);
      } catch {
      }
    };
    window.addEventListener("resize", onResize);
    try {
      const ro = new window.ResizeObserver(() => onResize());
      ro.observe(stageDiv);
    } catch {
    }
    onResize();
    initBackButton();
    const INDEX_URL = "https://guansss.github.io/live2d-viewer-web/eikanyalive2d-model.json";
    const pathMap = {};
    let currentPath = "";
    const REPOS = {
      eikanya: {
        type: "index",
        owner: "Eikanya",
        repo: "Live2d-model",
        ref: "master"
      },
      st: {
        type: "index",
        owner: "test157t",
        repo: "Live2dModels-ST-",
        ref: "main"
      }
    };
    let currentRepo = (() => {
      try {
        const v = localStorage.getItem("viewer_repo");
        return v === "st" || v === "eikanya" ? v : "eikanya";
      } catch {
        return "eikanya";
      }
    })();
    function activeRepo() {
      return REPOS[currentRepo];
    }
    function el(tag, props = {}, children = []) {
      const n = document.createElement(tag);
      Object.assign(n, props);
      for (const c of children)
        n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      return n;
    }
    function pathToJsDelivr(repoPath, ref) {
      const enc = repoPath.split("/").map(encodeURIComponent).join("/");
      const repo = activeRepo();
      const suffix = "@" + (ref || repo.ref || "master");
      return `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.repo}${suffix}/${enc}`;
    }
    function pathToRaw(repoPath, ref) {
      const enc = repoPath.split("/").map(encodeURIComponent).join("/");
      const repo = activeRepo();
      const branch = ref || repo.ref || "master";
      return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${enc}`;
    }
    async function resolveModelUrl2(repoPath) {
      const tries = [
        pathToRaw(repoPath, activeRepo().ref),
        pathToJsDelivr(repoPath, activeRepo().ref)
      ];
      for (const u of tries) {
        try {
          const r = await fetch(u, { method: "HEAD" });
          if (r.ok) return u;
        } catch {
        }
      }
      return pathToRaw(repoPath, activeRepo().ref);
    }
    function renderBreadcrumb(path) {
      if (!crumbEl) return;
      const parts = (path || "").split("/").filter(Boolean);
      const frag = document.createDocumentFragment();
      const rootA = el("a", {
        href: "#",
        onclick: (e) => {
          e.preventDefault();
          openPath("");
        },
        textContent: "root"
      });
      frag.appendChild(rootA);
      let acc = "";
      for (const part of parts) {
        frag.appendChild(el("span", { textContent: " / " }));
        acc = acc ? acc + "/" + part : part;
        frag.appendChild(
          el("a", {
            href: "#",
            onclick: (e) => {
              e.preventDefault();
              openPath(acc);
            },
            textContent: part
          })
        );
      }
      crumbEl.innerHTML = "";
      crumbEl.appendChild(frag);
    }
    function renderTree(path) {
      if (!treeEl) return;
      const node = pathMap[path || ""];
      const dirs = node && node.children || [];
      const cont = el("div");
      const parent = (path || "").replace(/\/?[^/]*$/, "");
      cont.appendChild(
        el("div", {
          textContent: "..",
          onclick: async () => {
            await ensureNodeLoaded(parent);
            openPath(parent);
          },
          style: "padding:4px 6px; cursor:pointer; border-radius:4px;"
        })
      );
      for (const d of dirs) {
        cont.appendChild(
          el("div", {
            textContent: d.name,
            onclick: async () => {
              const p = (path ? path + "/" : "") + d.name;
              await ensureNodeLoaded(p);
              openPath(p);
            },
            style: "padding:4px 6px; cursor:pointer; border-radius:4px;"
          })
        );
      }
      treeEl.innerHTML = "";
      treeEl.appendChild(cont);
    }
    function findThumbnailFileForPath(path) {
      try {
        const node = pathMap[path || ""];
        const files = node && node.files || [];
        for (const f of files) {
          if (/\.(png|jpe?g|webp)$/i.test(f) && /(thumbnail|thumb|preview)/i.test(f)) {
            return f;
          }
        }
        const children = node && node.children || [];
        for (const ch of children) {
          const childPath = (path ? path + "/" : "") + ch.name;
          const childNode = pathMap[childPath] || {};
          const childFiles = childNode && childNode.files || [];
          for (const f of childFiles) {
            if (/\.(png|jpe?g|webp)$/i.test(f) && /(thumbnail|thumb|preview)/i.test(f)) {
              return ch.name + "/" + f;
            }
          }
        }
      } catch {
      }
      return null;
    }
    function buildImageUrl(repoPathWithFile) {
      return pathToJsDelivr(repoPathWithFile, activeRepo().ref);
    }
    function listEntries(path) {
      if (!listEl) return;
      const node = pathMap[path || ""];
      const dirs = node && node.children || [];
      const files = node && node.files || [];
      const items = [
        ...dirs.map((d) => ({
          type: "dir",
          name: d.name,
          path: (path ? path + "/" : "") + d.name
        })),
        ...files.map((f) => ({
          type: "file",
          name: f,
          path: (path ? path + "/" : "") + f
        }))
      ].sort(
        (a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1
      );
      listEl.innerHTML = "";
      for (const it of items) {
        const div = el("div", {
          className: "card",
          style: "position:relative;"
        });
        let usedOverlay = false;
        if (currentRepo === "st" && it.type === "dir") {
          const thumb = findThumbnailFileForPath(it.path);
          if (thumb) {
            const repoFile = (it.path ? it.path + "/" : "") + thumb;
            const img = el("img", {
              src: buildImageUrl(repoFile),
              style: "width:100%;height:180px;display:block;object-fit:cover;background:#0e0e0e;",
              onerror: function() {
                this.onerror = null;
                this.src = pathToRaw(repoFile, activeRepo().ref);
              }
            });
            div.appendChild(img);
            const overlay = el(
              "div",
              {
                style: "position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.65);color:#fff;padding:4px 6px;border-radius:4px;"
              },
              [
                el("div", {
                  textContent: it.name,
                  style: "font-weight:600;font-size:13px;"
                }),
                el("div", {
                  textContent: "\u041F\u0430\u043F\u043A\u0430",
                  style: "opacity:.8;font-size:11px;"
                })
              ]
            );
            div.appendChild(overlay);
            usedOverlay = true;
          }
        }
        if (!usedOverlay) {
          div.appendChild(
            el("div", { textContent: it.name, style: "font-weight:600" })
          );
          div.appendChild(
            el("div", {
              textContent: it.type === "dir" ? "\u041F\u0430\u043F\u043A\u0430" : "\u0424\u0430\u0439\u043B",
              style: "opacity:.6; font-size:12px"
            })
          );
        }
        div.onclick = async () => it.type === "dir" ? (await ensureNodeLoaded(it.path), openPath(it.path)) : selectFile(it.path);
        listEl.appendChild(div);
      }
    }
    async function buildCubism2Json(repoMocPath, infoMap) {
      const key = (pathMap[""]?.name || "Eikanya/Live2d-model") + "/" + repoMocPath;
      const meta = infoMap[key] || {};
      const dir = repoMocPath.replace(/\/?[^/]*$/, "");
      const modelUrl2 = await resolveModelUrl2(repoMocPath);
      let textures = [];
      if (Array.isArray(meta.textures) && meta.textures.length) {
        textures = meta.textures.slice();
      } else {
        try {
          const node = pathMap[dir] || { files: [] };
          const files = node && node.files || [];
          const pngs = files.filter((f) => /\.(png)$/i.test(f));
          const preferred = pngs.filter((f) => /texture_\d+\.png$/i.test(f)).sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
          textures = preferred.length ? preferred : pngs;
        } catch {
        }
        if (!textures.length) textures = ["texture_00.png"];
      }
      const motionsObj = {};
      if (meta.motions)
        for (const g of Object.keys(meta.motions))
          motionsObj[g] = (meta.motions[g] || []).map((f) => ({
            file: f
          }));
      let physicsRel = meta.physics;
      if (!physicsRel) {
        try {
          const node = pathMap[dir] || { files: [] };
          const files = node && node.files || [];
          const phys = files.find((f) => /physics\.json$/i.test(f));
          if (phys) physicsRel = phys;
        } catch {
        }
      }
      const absTextures = [];
      for (const t of textures)
        absTextures.push(await resolveModelUrl2((dir ? dir + "/" : "") + t));
      const absPhysics = physicsRel ? await resolveModelUrl2((dir ? dir + "/" : "") + physicsRel) : void 0;
      const json = { model: modelUrl2, textures: absTextures };
      if (absPhysics) json.physics = absPhysics;
      if (Object.keys(motionsObj).length) json.motions = motionsObj;
      return "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
    }
    function urlToRepoPath(u) {
      try {
        const d = decodeURI(u);
        let m = d.match(
          /cdn\.jsdelivr\.net\/gh\/Eikanya\/Live2d-model@[^/]+\/(.+)$/
        );
        if (m) return m[1];
        m = d.match(
          /raw\.githubusercontent\.com\/Eikanya\/Live2d-model\/[^/]+\/(.+)$/
        );
        if (m) return m[1];
        m = d.match(
          /cdn\.jsdelivr\.net\/gh\/test157t\/Live2dModels-ST-@[^/]+\/(.+)$/
        );
        if (m) return m[1];
        m = d.match(
          /raw\.githubusercontent\.com\/test157t\/Live2dModels-ST-\/[^/]+\/(.+)$/
        );
        if (m) return m[1];
      } catch {
      }
      return null;
    }
    function candidatesFromUrl(u) {
      const repoPath = urlToRepoPath(u);
      if (!repoPath) return [u];
      return [
        pathToRaw(repoPath, activeRepo().ref),
        pathToJsDelivr(repoPath, activeRepo().ref)
      ];
    }
    async function selectFile(repoPath) {
      try {
        const fallbackUrl = pathToRaw(repoPath, activeRepo().ref);
        localStorage.setItem(config.LAST_MODEL_KEY, fallbackUrl);
      } catch {
      }
      if (/\.(moc3|moc)$/i.test(repoPath)) {
        const dir = repoPath.replace(/\/?[^/]*$/, "");
        const node = pathMap[dir] || { files: [] };
        const files = node.files || [];
        if (/\.moc3$/i.test(repoPath)) {
          const j = files.find((n) => /\.model3\.json$/i.test(n));
          if (j) {
            await loadFile((dir ? dir + "/" : "") + j);
            return;
          }
        } else {
          const j = files.find((n) => /model\.json$/i.test(n)) || files.find((n) => /model.*\.json$/i.test(n)) || files.find((n) => /\.json$/i.test(n));
          if (j) {
            await loadFile((dir ? dir + "/" : "") + j);
            return;
          }
        }
        const dataUrl = await buildCubism2Json(repoPath, {});
        await loadModel2(app2, dataUrl);
        return;
      }
      await loadFile(repoPath);
    }
    async function loadFile(repoPath) {
      const initialUrl = await resolveModelUrl2(repoPath);
      try {
        localStorage.setItem(config.LAST_MODEL_KEY, initialUrl);
      } catch {
      }
      try {
        window.overlayAPI?.saveLastModel?.(initialUrl);
      } catch {
      }
      const extFlag = detectRuntimeByUrl3(initialUrl);
      let selectedUrl = initialUrl;
      let isCubism4 = /\.model3\.json($|\?)/i.test(initialUrl);
      let motionGroups = [];
      let rewrittenSettings = null;
      const candidates = candidatesFromUrl(initialUrl);
      for (const tryUrl of candidates) {
        try {
          const r = await fetch(tryUrl, {
            headers: { Accept: "application/json" }
          });
          const text = await r.text();
          const j = JSON.parse(text);
          selectedUrl = tryUrl;
          try {
            const cloned = JSON.parse(JSON.stringify(j));
            rewriteModelJsonUrls2(selectedUrl, cloned);
            if (cloned && (cloned.model || cloned.textures || cloned.motions) && !cloned.FileReferences) {
            }
            rewrittenSettings = cloned;
          } catch {
          }
          if (j?.FileReferences && /\.moc3$/i.test(String(j.FileReferences.Moc || "")))
            isCubism4 = true;
          if (j?.FileReferences && /\.moc$/i.test(String(j.FileReferences.Moc || "")))
            isCubism4 = false;
          if (j && (j.model || j.textures || j.motions) && !j.FileReferences)
            isCubism4 = false;
          try {
            motionGroups = Object.keys(
              j.motions || j.Motions || j.FileReferences?.Motions || {}
            );
          } catch {
          }
          break;
        } catch {
          continue;
        }
      }
      const tries = [selectedUrl];
      const isC4Settings = (obj) => !!(obj && obj.FileReferences && (obj.FileReferences.Moc || obj.FileReferences.Textures));
      const isC2Settings = (obj) => !!(obj && (obj.model || obj.textures || obj.motions) && !obj.FileReferences);
      async function tryWithRuntime(useV4) {
        if (useV4) await ensureCubism42();
        else await ensureCubism22();
        let last = null;
        const queue = tries.filter(
          (u) => typeof u === "string"
        );
        for (const u of queue) {
          try {
            await loadModel2(app2, u, extFlag);
            return { ok: true };
          } catch (e) {
            last = e;
          }
        }
        if (!useV4) {
          for (const u of queue) {
            try {
              const repoPath2 = urlToRepoPath(u);
              if (!repoPath2) continue;
              const dir = repoPath2.replace(/\/?[^/]*$/, "");
              const node = pathMap[dir] || { files: [] };
              const files = node.files || [];
              const moc = files.find((n) => /\.moc$/i.test(n));
              if (!moc) continue;
              const mocPath = dir ? dir + "/" + moc : moc;
              const dataUrl = await buildCubism2Json(mocPath, {});
              await loadModel2(app2, dataUrl, false);
              return { ok: true };
            } catch (e) {
              last = e;
            }
          }
        }
        return { ok: false, err: last };
      }
      const res = await tryWithRuntime(isCubism4);
      if (res.ok) return;
      throw res.err || new Error("Failed to load model");
    }
    function openPath(path) {
      currentPath = path || "";
      renderBreadcrumb(currentPath);
      renderTree(currentPath);
      listEntries(currentPath);
    }
    try {
      const toolbar = document.getElementById("toolbar");
      if (toolbar) {
        const repoSel = el("select", { style: "margin-right:8px;" });
        repoSel.appendChild(
          el("option", { value: "eikanya", textContent: "Eikanya (indexed)" })
        );
        repoSel.appendChild(
          el("option", { value: "st", textContent: "Live2dModels-ST- (indexed)" })
        );
        repoSel.value = currentRepo;
        repoSel.onchange = async () => {
          try {
            currentRepo = repoSel.value || "eikanya";
            localStorage.setItem("viewer_repo", currentRepo);
            for (const k of Object.keys(pathMap)) delete pathMap[k];
            await loadRepoRoot();
            openPath("");
          } catch {
          }
        };
        toolbar.insertBefore(repoSel, toolbar.firstChild);
      }
    } catch {
    }
    async function ensureNodeLoaded(_path) {
    }
    async function loadRepoRoot() {
      try {
        const repo = activeRepo();
        const localIndexName = repo.owner === "Eikanya" ? "eikanyalive2d-model.json" : "Live2dModels-ST-.json";
        const localUrl = `./index/${localIndexName}`;
        let data = null;
        try {
          const r = await fetch(localUrl, { cache: "no-cache" });
          if (r.ok) data = await r.json();
        } catch {
        }
        if (!data && repo.owner === "Eikanya") {
          const resp = await fetch(INDEX_URL);
          data = await resp.json();
        }
        if (data) {
          const root = data.models || data;
          (function build(node, p) {
            const path = p || "";
            pathMap[path] = node;
            for (const ch of node && node.children || [])
              build(ch, (path ? path + "/" : "") + ch.name);
          })(root, "");
        }
      } catch {
      }
    }
    await loadRepoRoot();
    openPath("");
    const qp = new URLSearchParams(location.search);
    let modelUrl = null;
    try {
      modelUrl = localStorage.getItem(config.LAST_MODEL_KEY) || null;
    } catch {
    }
    if (!modelUrl) {
      try {
        if (window.overlayAPI && typeof window.overlayAPI.getLastModel === "function") {
          modelUrl = await window.overlayAPI.getLastModel() || null;
        }
      } catch {
      }
    }
    if (!modelUrl) modelUrl = qp.get("model");
    if (modelUrl) {
      const byExt = detectRuntimeByUrl2(modelUrl);
      await loadModel2(app2, modelUrl, byExt);
    }
  })();
})();
//# sourceMappingURL=viewer.js.map
