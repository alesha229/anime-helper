"use strict";
(() => {
  // src/renderer/index.ts
  (async function() {
    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => res(src);
        s.onerror = (ev) => rej(
          new Error(
            "Failed to load script " + src + " (" + (ev && ev.message ? ev.message : ev) + ")"
          )
        );
        document.head.appendChild(s);
      });
    }
    try {
      let installStageDragHandlers2 = function() {
        try {
          if (app.stage.__dragHandlersInstalled) return;
          app.stage.interactive = true;
          const onMove = (ev) => {
            try {
              if (!dragState.active || !dragState.data || !dragState.target)
                return;
              const parent = dragState.target.parent || app.stage;
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
              }
              dragState.active = false;
              dragState.data = null;
              dragState.target = null;
            } catch {
            }
          };
          app.stage.on("pointermove", onMove);
          app.stage.on("pointerup", onUp);
          app.stage.on("pointerupoutside", onUp);
          app.stage.on("pointercancel", onUp);
          app.stage.__dragHandlersInstalled = true;
        } catch {
        }
      }, enableDraggingForModel2 = function(target) {
        if (!target) return;
        installStageDragHandlers2();
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
            const parent = target.parent || app.stage;
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
      }, fitModelToCanvas2 = function() {
        if (!model) return;
        try {
          if (model.anchor && typeof model.anchor.set === "function") {
            model.anchor.set(0.5, 0.5);
          }
        } catch {
        }
        try {
          const userMoved = !!model.__userMoved;
          if (!userMoved) {
            model.x = app.renderer.width / 2;
            model.y = app.renderer.height / 2;
          }
          const b = model.getBounds();
          const bw = Math.max(1, b.width);
          const bh = Math.max(1, b.height);
          const fudge = 1.2;
          const base = Math.min(
            app.renderer.width * 0.98 / bw,
            app.renderer.height * 0.98 / bh
          );
          const baseScale = Math.max(0.1, Math.min(base * fudge, base * 1.4));
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
          if (isFinite(baseScale) && baseScale > 0)
            model.scale.set(baseScale * factor);
        } catch {
        }
      }, resizeStageToContainer2 = function() {
        try {
          const w = modelContainerEl && modelContainerEl.clientWidth || 320;
          const h = modelContainerEl && modelContainerEl.clientHeight || 480;
          app.renderer.resize(w, h);
          fitModelToCanvas2();
        } catch {
        }
      }, makeAbsolute2 = function(baseUrl, relative) {
        try {
          if (!relative) return relative;
          if (/^https?:\/\//i.test(relative)) return relative;
          const u = new URL(baseUrl);
          const base = baseUrl.replace(/[^/]+$/, "");
          return new URL(relative, base).toString();
        } catch {
          return relative;
        }
      }, buildCubism2DataJson2 = function(json, baseUrl) {
        const clone = { ...json };
        try {
          if (clone.model) clone.model = makeAbsolute2(baseUrl, clone.model);
          if (Array.isArray(clone.textures))
            clone.textures = clone.textures.map((t) => makeAbsolute2(baseUrl, t));
          if (clone.physics) clone.physics = makeAbsolute2(baseUrl, clone.physics);
          if (clone.pose) clone.pose = makeAbsolute2(baseUrl, clone.pose);
          if (Array.isArray(clone.expressions)) {
            clone.expressions = clone.expressions.map((e) => {
              if (typeof e === "string") return makeAbsolute2(baseUrl, e);
              const ee = { ...e };
              if (ee.file) ee.file = makeAbsolute2(baseUrl, ee.file);
              if (ee.File) ee.File = makeAbsolute2(baseUrl, ee.File);
              return ee;
            });
          }
          if (clone.motions || clone.Motions) {
            const motions = clone.motions || clone.Motions;
            const out = {};
            for (const g of Object.keys(motions || {})) {
              out[g] = (motions[g] || []).map((m) => {
                if (typeof m === "string") return makeAbsolute2(baseUrl, m);
                const mm = { ...m };
                if (mm.file) mm.file = makeAbsolute2(baseUrl, mm.file);
                if (mm.File) mm.File = makeAbsolute2(baseUrl, mm.File);
                return mm;
              });
            }
            if (clone.motions) clone.motions = out;
            if (clone.Motions) clone.Motions = out;
          }
        } catch {
        }
        const data = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clone));
        return data;
      }, detectUseV4FromUrl2 = function(u) {
        try {
          if (!u) return null;
          const low = u.toLowerCase();
          if (/(^|\/)model3\.json(\?|$)/.test(low)) return true;
          if (/(^|\/)model\.json(\?|$)/.test(low)) return false;
        } catch {
        }
        return null;
      }, detectRuntimeByUrl2 = function(u) {
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
      }, toAbsoluteAssetUrl2 = function(modelJsonUrl, assetPath) {
        if (!assetPath) return assetPath;
        if (/^https?:/i.test(assetPath) || assetPath.startsWith("data:"))
          return assetPath;
        try {
          const base = modelJsonUrl.replace(/\/[^/]*$/, "/");
          return new URL(assetPath, base).href;
        } catch {
          return assetPath;
        }
      }, rewriteModelJsonUrls2 = function(modelJsonUrl, j) {
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
            if (j.physics)
              j.physics = toAbsoluteAssetUrl2(modelJsonUrl, j.physics);
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
      }, clearPixiCaches2 = function() {
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
      }, urlToRepoPath2 = function(url) {
        try {
          const u = new URL(url);
          if (u.hostname === "raw.githubusercontent.com") {
            const parts = u.pathname.split("/").filter(Boolean);
            return decodeURIComponent(parts.slice(3).join("/"));
          }
          if (u.hostname === "cdn.jsdelivr.net") {
            const m = u.pathname.match(
              /\/gh\/Eikanya\/Live2d-model@[^/]+\/(.*)$/
            );
            if (m) return decodeURIComponent(m[1]);
          }
        } catch {
        }
        return null;
      }, setMouthOpenParam2 = function(targetModel, value) {
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
      }, sayRandom2 = function(list) {
        try {
          if (!Array.isArray(list) || !list.length) return null;
          const pick = list[Math.floor(Math.random() * list.length)];
          return pick;
        } catch {
        }
        return null;
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
          if (!lipSyncState.audioContext)
            lipSyncState.audioContext = new AudioCtx();
          return lipSyncState.audioContext;
        } catch {
          return null;
        }
      }, startLipSyncForAudio2 = function(audioEl) {
        if (!audioEl || !model) return;
        const ctx = ensureAudioContext2();
        if (!ctx) return;
        try {
          if (lipSyncState.source && lipSyncState.source.disconnect)
            lipSyncState.source.disconnect();
        } catch (e) {
        }
        try {
          const source = ctx.createMediaElementSource(audioEl);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          const data = new Uint8Array(analyser.fftSize);
          source.connect(analyser);
          analyser.connect(ctx.destination);
          lipSyncState.source = source;
          lipSyncState.analyser = analyser;
          lipSyncState.data = data;
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
              setMouthOpenParam2(window.__live2d_model, amp);
            } catch (e) {
            }
            if (audioEl.ended || audioEl.paused) {
              setMouthOpenParam2(window.__live2d_model, 0);
              return;
            }
            lipSyncState.raf = requestAnimationFrame(update);
          };
          lipSyncEnabled = true;
          lipSyncState.raf = requestAnimationFrame(update);
        } catch (e) {
        }
      }, startLipSyncForSpeech2 = function(utterance) {
        if (!model) return;
        const tick = () => {
          if (!lipSyncEnabled) return;
          const speaking = window.speechSynthesis && window.speechSynthesis.speaking;
          if (!speaking) {
            setMouthOpenParam2(window.__live2d_model, 0);
            return;
          }
          const t = performance.now() / 1e3;
          const amp = Math.max(
            0,
            Math.min(1, (Math.sin(t * 9) + Math.sin(t * 13) * 0.5 + 1) / 2)
          );
          setMouthOpenParam2(window.__live2d_model, amp * 0.9);
          lipSyncState.raf = requestAnimationFrame(tick);
        };
        lipSyncEnabled = true;
        lipSyncState.raf = requestAnimationFrame(tick);
        if (utterance) {
          try {
            utterance.onend = () => setMouthOpenParam2(window.__live2d_model, 0);
          } catch (e) {
          }
        }
      }, playRandomNonIdle2 = function() {
        if (!window.__live2d_model || !motionEntries.length) return;
        const candidates = motionEntries.filter((m) => {
          const g = String(m.group || "").toLowerCase();
          const f = String(m.file || "").toLowerCase();
          return g !== "idle" && !f.includes("idle");
        });
        const list = candidates.length ? candidates : motionEntries;
        const pick = list[Math.floor(Math.random() * list.length)];
        try {
          const mm = window.__live2d_model.internalModel && window.__live2d_model.internalModel.motionManager;
          const pr = getForcePriority2();
          if (mm && typeof mm.startMotion === "function")
            mm.startMotion(pick.group, pick.index, pr);
          else if (mm && typeof mm.startRandomMotion === "function")
            mm.startRandomMotion(pick.group, pr);
        } catch (e) {
        }
      }, interruptAndPlayRandomNonIdle2 = function() {
        const m = window.__live2d_model;
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
          snoozeIdle2(m, 6e3);
        } catch (e) {
        }
      }, speakCategory2 = function(cat) {
        if (!voiceEnabled || !cat) return;
        if (voiceMode === "audio") {
          playAudioCategory2(cat).then((ok) => {
            if (ok && currentAudio) {
              if (lipSyncEnabled) startLipSyncForAudio2(currentAudio);
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
        }
        if (voiceMode === "tts") {
          const text = sayRandom2(TTS_PHRASES[cat] || []);
          if (text) {
            const u = tts.say(text);
            try {
              if (u) u.onstart = () => interruptAndPlayRandomNonIdle2();
            } catch (e) {
            }
            interruptAndPlayRandomNonIdle2();
            if (lipSyncEnabled) startLipSyncForSpeech2(u);
          }
          return;
        }
      }, stopLipSync2 = function() {
        try {
          if (lipSyncState && lipSyncState.raf != null) {
            cancelAnimationFrame(lipSyncState.raf);
            lipSyncState.raf = null;
          }
        } catch (e) {
        }
        try {
          if (lipSyncState && lipSyncState.source && lipSyncState.source.disconnect) {
            lipSyncState.source.disconnect();
          }
        } catch (e) {
        }
        try {
          if (lipSyncState && lipSyncState.stream) {
            lipSyncState.stream.getTracks().forEach((t) => t.stop());
          }
        } catch (e) {
        }
        try {
          setMouthOpenParam2(window.__live2d_model, 0);
        } catch (e) {
        }
      }, refreshAnimationsUI2 = function() {
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
        const groups = Array.from(/* @__PURE__ */ new Set([...availableGroups || []])).filter(
          (g) => String(g).length > 0
        );
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
      }, getGroupsFromManager2 = function(mm) {
        try {
          const defs = mm && (mm.definitions || mm._definitions || mm._motions || {});
          return Object.keys(defs || {});
        } catch (e) {
          return [];
        }
      }, scheduleGroupRefresh2 = function() {
        let attempts = 16;
        const poll = () => {
          if (!model) return;
          try {
            const mm = model.internalModel && model.internalModel.motionManager;
            const groups = getGroupsFromManager2(mm);
            if (groups && groups.length) {
              availableGroups = Array.from(
                /* @__PURE__ */ new Set([...availableGroups || [], ...groups])
              );
              refreshAnimationsUI2();
              return;
            }
          } catch (e) {
          }
          if (--attempts > 0) setTimeout(poll, 250);
        };
        poll();
      }, playSelectedAnimationGroup2 = function() {
        if (!model) return;
        if (!animSelect.value) return;
        const mm = model.internalModel && model.internalModel.motionManager;
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
              if (typeof model.motion === "function") {
                model.motion(grp, isFinite(idx) ? idx : 0);
                played = true;
              }
            } catch (e) {
            }
          }
          if (played) {
            snoozeIdle2(window.__live2d_model, 9e3);
            return;
          }
        }
        const group = animSelect.value;
        const pickIndex = () => {
          const candidates = (motionEntries || []).filter((e) => (e.group || "") === group).map((e) => e.index).filter((i) => typeof i === "number" && i >= 0);
          if (candidates.length) {
            return candidates[Math.floor(Math.random() * candidates.length)];
          }
          try {
            const defs = mm && (mm.definitions || mm._definitions || mm._motions) || null;
            if (defs) {
              if (Array.isArray(defs[group])) return 0;
              if (defs[group] && typeof defs[group].length === "number") return 0;
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
            snoozeIdle2(window.__live2d_model, 9e3);
            return;
          }
        } catch (e) {
        }
        try {
          if (mm && typeof mm.startRandomMotion === "function") {
            mm.startRandomMotion(group, getForcePriority2());
            snoozeIdle2(window.__live2d_model, 9e3);
            return;
          }
        } catch (e) {
        }
        try {
          if (typeof model.motion === "function") {
            const idx = pickIndex();
            try {
              model.motion(group, idx);
            } catch {
              model.motion(group);
            }
            snoozeIdle2(window.__live2d_model, 9e3);
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
      }, startIdleLoop2 = function(model2, preferredGroups) {
        if (!model2) return;
        try {
          if (model2.__idleTimer) {
            clearInterval(model2.__idleTimer);
            model2.__idleTimer = null;
          }
        } catch {
        }
        const mm = model2.internalModel && model2.internalModel.motionManager;
        if (!(mm && typeof mm.startRandomMotion === "function")) return;
        let groups = Array.isArray(preferredGroups) ? preferredGroups.slice() : [];
        try {
          const s = model2.internalModel && model2.internalModel.settings;
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
        model2.__idleTimer = setInterval(() => {
          try {
            if (!window.__live2d_model || window.__live2d_model !== model2) {
              clearInterval(model2.__idleTimer);
              model2.__idleTimer = null;
              return;
            }
            const cur = window.__live2d_model;
            const curMM = cur && cur.internalModel && cur.internalModel.motionManager;
            if (curMM && typeof curMM.startRandomMotion === "function") {
              curMM.startRandomMotion(chosen);
            }
          } catch {
          }
        }, 12e3);
      }, startIdleLoopC42 = function(model2) {
        if (!model2) return;
        try {
          if (model2.__idleTimer) {
            clearInterval(model2.__idleTimer);
            model2.__idleTimer = null;
          }
        } catch {
        }
        const mm = model2.internalModel && model2.internalModel.motionManager;
        if (!mm) return;
        const entries = Array.isArray(motionEntries) ? motionEntries : [];
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
        model2.__idleTimer = setInterval(() => {
          try {
            if (!window.__live2d_model || window.__live2d_model !== model2) {
              clearInterval(model2.__idleTimer);
              model2.__idleTimer = null;
              return;
            }
            const cur = window.__live2d_model;
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
      }, snoozeIdle2 = function(modelRef, ms) {
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
              if (!window.__live2d_model || window.__live2d_model !== modelRef)
                return;
              if (currentRuntime === "c4") startIdleLoopC42(modelRef);
              else
                startIdleLoop2(
                  modelRef,
                  Array.from(
                    new Set(
                      (motionEntries || []).map(
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
        const getAlternativeURL = (url) => {
          try {
            if (/jsdelivr/i.test(url)) {
              const m = url.match(
                /cdn\.jsdelivr\.net\/gh\/Eikanya\/Live2d-model@([^/]+)\/(.*)$/i
              );
              if (m)
                return `https://raw.githubusercontent.com/Eikanya/Live2d-model/${m[1]}/${m[2]}`;
            }
            if (/raw\.githubusercontent\.com/i.test(url)) {
              const m = url.match(
                /raw\.githubusercontent\.com\/Eikanya\/Live2d-model\/([^/]+)\/(.*)$/i
              );
              if (m)
                return `https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@${m[1]}/${m[2]}`;
            }
          } catch {
          }
          return url;
        };
        const ping = async (url) => {
          try {
            const r = await fetch(url, { method: "HEAD" });
            return r.ok;
          } catch {
            return false;
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
                  const ok = await ping(urlUtils.resolve(url, motion0.file));
                  if (!ok) motion0.file = "motions/" + motion0.file;
                }
              }
            }
          },
          {
            search: "\u30A2\u30F3\u30CE\u30A6\u30F3\u30D6\u30E9\u30A4\u30C9",
            async patch(json, url) {
              if (json.FileReferences?.Textures?.length === 0) {
                const exists = await ping(
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
              const correctTexture = async (tex) => await ping(urlUtils.resolve(url, tex)) ? tex : tex.replace("/texture", "/android/texture");
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
                json.motions.idle = json.motions[""].map((m) => ({ ...m }));
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
            for (const [group, motions] of Object.entries(json.motions)) {
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
      }, encodeRepoPath2 = function(path) {
        return (path || "").split("/").map((seg) => encodeURIComponent(seg)).join("/");
      }, pathToJsDelivr2 = function(repoPath, ref) {
        const encoded = encodeRepoPath2(repoPath);
        const suffix = ref ? "@" + ref : "";
        return "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model" + suffix + "/" + encoded;
      }, pathToRaw2 = function(repoPath, ref) {
        const encoded = encodeRepoPath2(repoPath);
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
      }, buildRepoPath2 = function(path, name) {
        return (path ? path + "/" : "") + name;
      }, renderBreadcrumb2 = function(path) {
        const parts = path ? path.split("/") : [];
        const frag = document.createDocumentFragment();
        const rootLink = document.createElement("a");
        rootLink.href = "#";
        rootLink.textContent = "root";
        rootLink.style.color = "#9cdcfe";
        rootLink.addEventListener("click", (e) => {
          e.preventDefault();
          loadDir("");
        });
        frag.appendChild(rootLink);
        let acc = "";
        parts.forEach((p, idx) => {
          const sep = document.createElement("span");
          sep.textContent = " / ";
          frag.appendChild(sep);
          acc = acc ? acc + "/" + p : p;
          const a = document.createElement("a");
          a.href = "#";
          a.textContent = p;
          a.style.color = "#9cdcfe";
          a.addEventListener("click", (e) => {
            e.preventDefault();
            loadDir(acc);
          });
          frag.appendChild(a);
        });
        breadcrumbEl.innerHTML = "";
        breadcrumbEl.appendChild(frag);
      }, getAuthHeaders2 = function() {
        try {
          const t = localStorage.getItem("gh_token") || "";
          if (t) return { Authorization: `token ${t}` };
        } catch {
        }
        return {};
      };
      var installStageDragHandlers = installStageDragHandlers2, enableDraggingForModel = enableDraggingForModel2, fitModelToCanvas = fitModelToCanvas2, resizeStageToContainer = resizeStageToContainer2, makeAbsolute = makeAbsolute2, buildCubism2DataJson = buildCubism2DataJson2, detectUseV4FromUrl = detectUseV4FromUrl2, detectRuntimeByUrl = detectRuntimeByUrl2, toAbsoluteAssetUrl = toAbsoluteAssetUrl2, rewriteModelJsonUrls = rewriteModelJsonUrls2, clearPixiCaches = clearPixiCaches2, urlToRepoPath = urlToRepoPath2, setMouthOpenParam = setMouthOpenParam2, sayRandom = sayRandom2, getAudio = getAudio2, playAudioCategory = playAudioCategory2, getForcePriority = getForcePriority2, ensureAudioContext = ensureAudioContext2, startLipSyncForAudio = startLipSyncForAudio2, startLipSyncForSpeech = startLipSyncForSpeech2, playRandomNonIdle = playRandomNonIdle2, interruptAndPlayRandomNonIdle = interruptAndPlayRandomNonIdle2, speakCategory = speakCategory2, stopLipSync = stopLipSync2, refreshAnimationsUI = refreshAnimationsUI2, getGroupsFromManager = getGroupsFromManager2, scheduleGroupRefresh = scheduleGroupRefresh2, playSelectedAnimationGroup = playSelectedAnimationGroup2, getMotionEntriesFromJson = getMotionEntriesFromJson2, startIdleLoop = startIdleLoop2, startIdleLoopC4 = startIdleLoopC42, snoozeIdle = snoozeIdle2, applyPixiLive2dPatches = applyPixiLive2dPatches2, encodeRepoPath = encodeRepoPath2, pathToJsDelivr = pathToJsDelivr2, pathToRaw = pathToRaw2, indexRootName = indexRootName2, findIndexNode = findIndexNode2, listDirFromIndex = listDirFromIndex2, buildRepoPath = buildRepoPath2, renderBreadcrumb = renderBreadcrumb2, getAuthHeaders = getAuthHeaders2;
      const app = new PIXI.Application({
        transparent: true,
        width: 320,
        height: 480
      });
      document.getElementById("model").appendChild(app.view);
      try {
        app.stage.interactive = true;
      } catch {
      }
      const modelContainerEl = document.getElementById("model");
      const dragState = {
        active: false,
        data: null,
        startX: 0,
        startY: 0,
        origX: 0,
        origY: 0,
        target: null
      };
      window.addEventListener("resize", resizeStageToContainer2);
      try {
        const ro = new ResizeObserver(() => resizeStageToContainer2());
        ro.observe(modelContainerEl);
      } catch {
      }
      resizeStageToContainer2();
      const MODELS = [
        // По умолчанию загружаем Cubism2 (.model.json), чтобы не инициализировать Cubism4 на старте
        "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E5%B4%A9%E5%9D%8F%E5%AD%A6%E5%9B%AD2/houraiji/model.json",
        "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)/abeikelongbi_3/abeikelongbi_3.model3.json",
        "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/haru/haru_greeter_t03.model3.json"
      ];
      const LAST_MODEL_KEY = "anime_overlay_last_model_url";
      async function preloadMotionsFromModelJson(modelJsonUrl) {
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
            } catch (e) {
            }
          }
          return groups;
        } catch (e) {
          console.warn("preloadMotionsFromModelJson failed", e);
          return [];
        }
      }
      async function tryLoadModel(url) {
        try {
          const resp = await fetch(url, { method: "GET" });
          if (!resp.ok)
            throw new Error(
              "HTTP " + resp.status + " " + resp.statusText + " for " + url
            );
          let discoveredMotionGroups = [];
          try {
            discoveredMotionGroups = await preloadMotionsFromModelJson(url);
          } catch (e) {
            console.warn(e);
          }
          const model2 = await PIXI.live2d.Live2DModel.from(url);
          try {
            model2.__motionGroups = discoveredMotionGroups;
          } catch (e) {
          }
          return model2;
        } catch (err) {
          throw new Error(
            "Failed to load model from " + url + " \u2014 " + (err && err.message ? err.message : err)
          );
        }
      }
      async function loadSettingsJson(url, forceV4) {
        let useV4 = forceV4 ?? detectUseV4FromUrl2(url);
        const byExt = detectRuntimeByUrl2(url);
        let groups = [];
        try {
          const r = await fetch(url, { headers: { Accept: "application/json" } });
          const txt = await r.text();
          const j = JSON.parse(txt);
          const cloned = JSON.parse(JSON.stringify(j));
          rewriteModelJsonUrls2(url, cloned);
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
          if ((j.model || j.textures || j.motions) && !j.FileReferences)
            isC4 = false;
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
      async function loadModel(appRef, url, forceV4) {
        try {
          await clearPixiCaches2();
          if (window.__live2d_model) {
            try {
              appRef.stage.removeChild(window.__live2d_model);
              window.__live2d_model.destroy?.(true);
            } catch {
            }
          }
          window.__live2d_model = void 0;
        } catch {
        }
        const { urlOrSettings, useV4, originalUrl, groups } = await loadSettingsJson(url, forceV4);
        try {
          const desired = useV4 === true ? "c4" : useV4 === false ? "c2" : null;
          if (desired && window.__loadedRuntime && window.__loadedRuntime !== desired) {
            window.location.href = `index.html?model=${encodeURIComponent(originalUrl)}`;
            throw new Error("Switching runtime requires reload");
          }
        } catch {
        }
        if (useV4 === true) await ensureCubism4();
        else if (useV4 === false) await ensureCubism2();
        else await ensureCubism4();
        let loadedModel = null;
        const ns = useV4 ? window.__live2d_api_c4 || PIXI.live2d : window.__live2d_api_c2 || PIXI.live2d;
        const prevLive2d = PIXI.live2d;
        PIXI.live2d = ns;
        try {
          loadedModel = await PIXI.live2d.Live2DModel.from(
            urlOrSettings,
            {
              motionPreload: "none"
            }
          );
        } catch {
          try {
            loadedModel = await PIXI.live2d.Live2DModel.from(
              urlOrSettings
            );
          } catch {
            if (useV4 === false && typeof urlOrSettings === "string") {
              try {
                const resp = await fetch(String(urlOrSettings), {
                  headers: { Accept: "application/json" }
                });
                const txt = await resp.text();
                const j = JSON.parse(txt);
                const cloned = JSON.parse(JSON.stringify(j));
                rewriteModelJsonUrls2(String(urlOrSettings), cloned);
                loadedModel = await PIXI.live2d.Live2DModel.from(cloned);
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
        try {
          if (loadedModel && loadedModel.anchor && loadedModel.anchor.set)
            loadedModel.anchor.set(0.5, 0.5);
        } catch {
        }
        appRef.stage.addChild(loadedModel);
        try {
          enableDraggingForModel2(loadedModel);
        } catch {
        }
        try {
          window.__live2d_model = loadedModel;
        } catch {
        }
        return { model: loadedModel, groups, fitModel: fitModelToCanvas2 };
      }
      async function tryFindAlternateModelJsonUrl(originalUrl) {
        const baseDir = originalUrl.replace(/[^/]+$/, "");
        const tryCandidates = async (names) => {
          for (const name of names) {
            const cand = baseDir + name;
            try {
              const r = await fetch(cand, { method: "HEAD" });
              if (r.ok) return cand;
            } catch {
            }
          }
          return null;
        };
        const simple = await tryCandidates(["model.json", "model.model.json"]);
        if (simple) return simple;
        try {
          await ensureIndexLoaded();
          const repoPath = urlToRepoPath2(originalUrl);
          if (!repoPath) return null;
          const dir = repoPath.replace(/\/?[^/]*$/, "");
          const node = findIndexNode2(dir);
          const files = node && node.files || [];
          const sorted = files.filter((f) => /\.json$/i.test(f) && !/model3\.json$/i.test(f)).sort((a, b) => a.toLowerCase() === "model.json" ? -1 : 1);
          for (const f of sorted) {
            const url = await resolveModelUrl((dir ? dir + "/" : "") + f);
            try {
              const r = await fetch(url, { method: "HEAD" });
              if (r.ok) return url;
            } catch {
            }
          }
        } catch {
        }
        return null;
      }
      const controls = document.getElementById("controls");
      const select = document.createElement("select");
      select.style.webkitAppRegion = "no-drag";
      MODELS.forEach((url, i) => {
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
        const current = select.value || "";
        const qp = current ? `?model=${encodeURIComponent(current)}` : "";
        window.location.href = `viewer.html${qp}`;
      });
      controls.insertBefore(openInspectorBtn, select);
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
      let model = null;
      let motionEntries = [];
      let availableGroups = [];
      let lipSyncAvailable = false;
      let lipSyncEnabled = true;
      let lipSyncState = {
        stream: null,
        audioContext: null,
        source: null,
        analyser: null,
        data: null,
        raf: null
      };
      let voiceEnabled = true;
      let voiceMode = "audio";
      let preferredVoice = null;
      const tts = {
        pickVoice() {
          try {
            const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
            const ru = voices.find((v) => /ru/i.test(v.lang || ""));
            preferredVoice = ru || voices[0] || null;
          } catch {
          }
        },
        say(text) {
          if (!voiceEnabled) return null;
          try {
            if (!window.speechSynthesis) return;
            if (!preferredVoice) this.pickVoice();
            const u = new SpeechSynthesisUtterance(String(text || ""));
            if (preferredVoice) u.voice = preferredVoice;
            u.lang = preferredVoice && preferredVoice.lang || "ru-RU";
            u.rate = 1;
            u.pitch = 1;
            u.volume = 1;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
            return u;
          } catch {
          }
          return null;
        }
      };
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => tts.pickVoice();
        tts.pickVoice();
      }
      const TTS_PHRASES = {
        start: [
          "\u041D\u0443 \u0434\u0430\u0432\u0430\u0439, \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0445\u043E\u0442\u044F \u0431\u044B \u0440\u0430\u0437 \u043D\u0435 \u043E\u0431\u043E\u0441\u0440\u0430\u0442\u044C\u0441\u044F.",
          "\u0422\u0430\u0439\u043C\u0435\u0440 \u043F\u043E\u0448\u0451\u043B, \u0442\u0430\u043A \u0447\u0442\u043E \u0445\u0432\u0430\u0442\u0438\u0442 \u0447\u0435\u0441\u0430\u0442\u044C \u044F\u0439\u0446\u0430 \u2014 \u0440\u0430\u0431\u043E\u0442\u0430\u0439.",
          "\u0424\u043E\u043A\u0443\u0441, \u0431\u043B\u0438\u043D! \u0422\u044B \u0441\u044E\u0434\u0430 \u043A\u043E\u0434\u0438\u0442\u044C \u043F\u0440\u0438\u0448\u0451\u043B, \u0430 \u043D\u0435 \u0432 \u043F\u043E\u0442\u043E\u043B\u043E\u043A \u043F\u044F\u043B\u0438\u0442\u044C\u0441\u044F.",
          "\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u043C. \u0415\u0441\u043B\u0438 \u043E\u043F\u044F\u0442\u044C \u0432\u0441\u0451 \u043F\u0440\u043E\u0441\u0440\u0451\u0448\u044C \u2014 \u044D\u0442\u043E \u0443\u0436\u0435 \u043D\u0435 \u043C\u043E\u044F \u0432\u0438\u043D\u0430.",
          "\u0420\u0430\u0431\u043E\u0442\u0430 \u043D\u0430\u0447\u0430\u043B\u0430\u0441\u044C. \u0410 \u0442\u044B \u0432\u043E\u043E\u0431\u0449\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0443\u043C\u0435\u0435\u0448\u044C?"
        ],
        finish: [
          "\u041E, \u0441\u043C\u043E\u0442\u0440\u0438-\u043A\u0430, \u0434\u043E\u0436\u0438\u043B! \u042F \u0434\u0443\u043C\u0430\u043B \u0442\u044B \u0441\u0434\u043E\u0445\u043D\u0435\u0448\u044C \u043D\u0430 \u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0435.",
          "\u041F\u043E\u0437\u0434\u0440\u0430\u0432\u043B\u044F\u044E, \u0442\u044B \u0441\u0434\u0435\u043B\u0430\u043B \u0440\u043E\u0432\u043D\u043E \u043D\u0438\u0445\u0440\u0435\u043D\u0430. \u041D\u043E \u043A\u0440\u0430\u0441\u0438\u0432\u043E.",
          "\u0422\u0430\u0439\u043C\u0435\u0440 \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u043B\u0441\u044F. \u0410 \u0442\u043E\u043B\u043A\u0443-\u0442\u043E? \u041A\u043E\u0434 \u0432\u0441\u0451 \u0435\u0449\u0451 \u0433\u043E\u0432\u043D\u043E.",
          "\u041D\u0443 \u0445\u043E\u0442\u044C \u0447\u0442\u043E-\u0442\u043E \u0434\u043E\u0432\u0451\u043B \u0434\u043E \u043A\u043E\u043D\u0446\u0430. \u0427\u0438\u0441\u0442\u043E \u0440\u0435\u043A\u043E\u0440\u0434.",
          "\u041C\u043E\u043B\u043E\u0434\u0435\u0446, \u0433\u0435\u0440\u043E\u0439. \u0418\u0434\u0438 \u043E\u0442\u0434\u043E\u0445\u043D\u0438, \u043F\u043E\u043A\u0430 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u043E\u0445."
        ],
        break: [
          "\u0412\u0441\u0442\u0430\u0432\u0430\u0439, \u0430\u043C\u0451\u0431\u0430. \u0422\u044B \u0441\u043A\u043E\u0440\u043E \u0441\u043E \u0441\u0442\u0443\u043B\u043E\u043C \u0441\u0440\u0430\u0441\u0442\u0451\u0448\u044C\u0441\u044F.",
          "\u0414\u0430 \u0441\u0434\u0435\u043B\u0430\u0439 \u0443\u0436\u0435 \u0440\u0430\u0437\u043C\u0438\u043D\u043A\u0443, \u0430 \u0442\u043E \u0441\u0438\u0434\u0438\u0448\u044C \u043A\u0430\u043A \u0432\u044B\u0441\u043E\u0445\u0448\u0438\u0439 \u0434\u0435\u0434.",
          "\u0421\u0445\u043E\u0434\u0438 \u043F\u043E\u043F\u0435\u0439 \u0432\u043E\u0434\u044B, \u043C\u043E\u0436\u0435\u0442 \u043C\u043E\u0437\u0433 \u043F\u0440\u043E\u043C\u043E\u0435\u0442.",
          "\u041F\u0435\u0440\u0435\u0440\u044B\u0432. \u0425\u043E\u0442\u044F \u0442\u0435\u0431\u0435 \u0431\u044B \u043F\u043E\u0436\u0438\u0437\u043D\u0435\u043D\u043D\u044B\u0439 \u043E\u0444\u043E\u0440\u043C\u0438\u0442\u044C.",
          "\u0413\u043B\u0430\u0437\u0430 \u0437\u0430\u043A\u0440\u044B\u0432\u0430\u0439, \u0430 \u0442\u043E \u0442\u0430\u043A\u0438\u043C\u0438 \u0442\u0435\u043C\u043F\u0430\u043C\u0438 \u0442\u044B \u043E\u0441\u043B\u0435\u043F\u043D\u0435\u0448\u044C, \u0438 \u044F \u043D\u0430\u043A\u043E\u043D\u0435\u0446 \u043E\u0442 \u0442\u0435\u0431\u044F \u043E\u0442\u0434\u043E\u0445\u043D\u0443."
        ],
        xp: [
          "+XP, \u043D\u043E \u0442\u044B \u0432\u0441\u0451 \u0440\u0430\u0432\u043D\u043E \u0438\u0434\u0438\u043E\u0442.",
          "\u041D\u0443 \u0432\u043E\u0442, \u043A\u0430\u0447\u043D\u0443\u043B\u0441\u044F. \u0416\u0430\u043B\u044C, \u0445\u0430\u0440\u0438\u0437\u043C\u044B \u044D\u0442\u043E \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u0438\u0442.",
          "+1 \u043A \u0441\u043A\u0438\u043B\u043B\u0443. \u041F\u0440\u0430\u0432\u0434\u0430, \u0442\u043E\u043B\u043A\u0443 \u043E\u0442 \u0442\u0435\u0431\u044F \u043A\u0430\u043A \u043E\u0442 \u0434\u043E\u0445\u043B\u043E\u0439 \u043C\u044B\u0448\u0438.",
          "\u041F\u043E\u0437\u0434\u0440\u0430\u0432\u043B\u044F\u044E, \u0435\u0449\u0451 \u0448\u0430\u0433 \u043A \u0437\u0432\u0430\u043D\u0438\u044E \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u0439 \u0434\u0435\u0433\u0435\u043D\u0435\u0440\u0430\u0442.",
          "\u041D\u0443 \u0445\u043E\u0442\u044C \u0446\u0438\u0444\u0440\u044B \u0440\u0430\u0441\u0442\u0443\u0442, \u0432 \u043E\u0442\u043B\u0438\u0447\u0438\u0435 \u043E\u0442 \u0442\u0432\u043E\u0435\u0433\u043E \u043C\u043E\u0437\u0433\u0430."
        ],
        fun: [
          "\u041E\u043F\u044F\u0442\u044C \u0434\u0435\u0431\u0430\u0436\u0438\u0448\u044C? \u0422\u044B \u0436\u0435 \u0437\u043D\u0430\u0435\u0448\u044C, \u0447\u0442\u043E \u0440\u0443\u043A\u0438 \u0443 \u0442\u0435\u0431\u044F \u0438\u0437 \u0436\u043E\u043F\u044B.",
          "\u041A\u043E\u0433\u0434\u0430 \u0440\u0435\u043B\u0438\u0437? \u041D\u0438\u043A\u043E\u0433\u0434\u0430. \u041F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E \u0441 \u0442\u043E\u0431\u043E\u0439 \u2014 \u043D\u0435\u0440\u0435\u0430\u043B\u044C\u043D\u043E.",
          "\u0422\u044B \u0443\u0432\u0435\u0440\u0435\u043D, \u0447\u0442\u043E \u044D\u0442\u043E \u043A\u043E\u043C\u043F\u0438\u043B\u0438\u0440\u0443\u0435\u0442\u0441\u044F? \u042F \u0431\u044B \u043D\u0430 \u0442\u0432\u043E\u0451\u043C \u043C\u0435\u0441\u0442\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u043B \u043C\u043E\u043B\u0438\u0442\u0432\u043E\u0439.",
          "\u0421\u0438\u0434\u0438\u0448\u044C \u0442\u0430\u043A\u043E\u0439 \u0443\u043C\u043D\u044B\u0439, \u0430 \u043D\u0430 \u0434\u0435\u043B\u0435 \u2014 \u043A\u043B\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0431\u043E\u043C\u0436.",
          "\u0413\u043B\u0430\u0437\u0430 \u0443 \u0442\u0435\u0431\u044F \u043A\u0440\u0430\u0441\u043D\u044B\u0435\u2026 \u044D\u0442\u043E \u043E\u0442 \u043A\u043E\u0434\u0430 \u0438\u043B\u0438 \u043E\u0442 \u043F\u043E\u0440\u043D\u0445\u0430\u0431\u0430?",
          "\u0421\u043C\u043E\u0442\u0440\u0438, \u043A\u0430\u043A\u043E\u0439 \u043A\u043E\u043C\u043C\u0438\u0442! \u0414\u0430 \u0437\u0430 \u044D\u0442\u043E \u043D\u0430 GitHub \u0441\u043C\u0435\u044F\u0442\u044C\u0441\u044F \u0431\u0443\u0434\u0443\u0442 \u0433\u043E\u0434\u0430\u043C\u0438.",
          "\u0414\u0430-\u0434\u0430, \u0421\u044D\u043C\u043F\u0430\u0439\u2026 \u0440\u0443\u043A\u043E\u0436\u043E\u043F\u044B\u0439 \u0421\u044D\u043C\u043F\u0430\u0439."
        ]
      };
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
          const mergedText = { ...TTS_PHRASES };
          for (const k of Object.keys(mergedAudio)) {
            const v = data[k];
            if (Array.isArray(v)) mergedAudio[k] = v;
            else if (v && Array.isArray(v.audio)) mergedAudio[k] = v.audio;
            if (v && Array.isArray(v.text)) mergedText[k] = v.text;
          }
          VOICE_AUDIO = mergedAudio;
          for (const k of Object.keys(mergedText)) {
            if (Array.isArray(mergedText[k])) TTS_PHRASES[k] = mergedText[k];
          }
        } catch (e) {
        }
      }
      loadPhrasesJson();
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
      async function startLipSync() {
        if (!window.navigator || !navigator.mediaDevices) return;
        if (!model) return;
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
          lipSyncState = {
            stream,
            audioContext,
            source,
            analyser,
            data,
            raf: null
          };
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
              setMouthOpenParam2(window.__live2d_model, amp);
            } catch (e) {
            }
            lipSyncState.raf = requestAnimationFrame(update);
          };
          lipSyncEnabled = true;
          update();
        } catch (e) {
        }
      }
      let cubism2Ready = false;
      let cubism4Ready = false;
      let currentRuntime = null;
      window.__loadedRuntime = window.__loadedRuntime || null;
      async function ensureCubism4() {
        if (currentRuntime === "c4" && PIXI.live2d) return;
        if (!window.Live2DCubismCore) {
          await loadScript(
            "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
          );
        }
        if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
          await loadScript(
            "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js"
          );
        }
        cubism4Ready = true;
        currentRuntime = "c4";
        try {
          if (!window.__live2d_api_c4)
            window.__live2d_api_c4 = PIXI.live2d;
          window.__loadedRuntime = "c4";
          applyPixiLive2dPatches2();
        } catch (e) {
        }
      }
      async function ensureCubism2() {
        if (currentRuntime === "c2" && PIXI.live2d) return;
        if (!window.Live2D) {
          await loadScript(
            "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"
          );
        }
        if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
          await loadScript(
            "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js"
          );
        }
        cubism2Ready = true;
        currentRuntime = "c2";
        try {
          if (!window.__live2d_api_c2)
            window.__live2d_api_c2 = PIXI.live2d;
          window.__loadedRuntime = "c2";
          applyPixiLive2dPatches2();
        } catch (e) {
        }
      }
      async function loadSelectedModel(url) {
        if (model) {
          try {
            app.stage.removeChild(model);
            model.destroy(true);
          } catch (e) {
          }
          if (lipSyncEnabled) stopLipSync2();
        }
        motionEntries = [];
        refreshAnimationsUI2();
        const byExt = detectRuntimeByUrl2(url);
        const res = await loadModel(app, url, byExt);
        model = res && res.model ? res.model : null;
        availableGroups = Array.isArray(res?.groups) ? res.groups : [];
        scheduleGroupRefresh2();
        await new Promise(
          (r) => requestAnimationFrame(() => requestAnimationFrame(r))
        );
        try {
          fitModelToCanvas2();
          if (model) {
            model.alpha = 1;
            model.visible = true;
          }
        } catch {
        }
        try {
          if (currentRuntime === "c4") {
            startIdleLoopC42(model);
          } else {
            startIdleLoop2(
              model,
              Array.from(
                new Set(
                  (motionEntries || []).map((e) => String(e.group || "").trim())
                )
              ).filter(Boolean)
            );
          }
        } catch {
        }
      }
      const urlParams = new URLSearchParams(window.location.search);
      const qpModel = urlParams.get("model");
      if (qpModel) {
        await loadSelectedModel(qpModel);
        if (!Array.from(select.options).some((o) => o.value === qpModel)) {
          const opt = document.createElement("option");
          opt.style.display = "none";
          opt.value = qpModel;
          opt.textContent = "Selected";
          select.appendChild(opt);
        }
        select.value = qpModel;
        try {
          localStorage.setItem(LAST_MODEL_KEY, qpModel);
        } catch (e) {
        }
      } else {
        let saved = null;
        try {
          saved = localStorage.getItem(LAST_MODEL_KEY) || null;
        } catch (e) {
          saved = null;
        }
        const initial = saved && /\.json($|\?)/i.test(saved) ? saved : MODELS[0];
        await loadSelectedModel(initial);
        if (saved && !Array.from(select.options).some((o) => o.value === saved)) {
          const opt = document.createElement("option");
          opt.value = saved;
          opt.textContent = "Saved";
          select.appendChild(opt);
        }
        select.value = initial;
        select.style.display = "none";
      }
      select.addEventListener("change", () => {
        const url = select.value;
        try {
          localStorage.setItem(LAST_MODEL_KEY, url);
        } catch (e) {
        }
        loadSelectedModel(url);
      });
      const modal = document.getElementById("modelInspector");
      const listEl = document.getElementById("inspectorList");
      const breadcrumbEl = document.getElementById("inspectorBreadcrumb");
      const urlInput = document.getElementById("inspectorUrl");
      const loadUrlBtn = document.getElementById("inspectorLoadUrl");
      let currentPath = "";
      let selectedModelPath = "";
      async function resolveModelUrl(repoPath) {
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
      async function buildSyntheticCubism2Json(repoPathToMoc) {
        const key = indexRootName2() + "/" + repoPathToMoc;
        const meta = modelInfoMap[key] || {};
        const dir = repoPathToMoc.replace(/\/?[^/]*$/, "");
        const modelUrl = await resolveModelUrl(repoPathToMoc);
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
          absTextures.push(await resolveModelUrl((dir ? dir + "/" : "") + t));
        const absPhysics = meta.physics ? await resolveModelUrl((dir ? dir + "/" : "") + meta.physics) : void 0;
        const json = { model: modelUrl, textures: absTextures };
        if (absPhysics) json.physics = absPhysics;
        if (Object.keys(motionsObj).length) json.motions = motionsObj;
        return "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
      }
      window.__live2d_model = model;
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
          const saved = localStorage.getItem(stateKey);
          if (saved) state = JSON.parse(saved);
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
          const saved = localStorage.getItem(UI_HIDDEN_KEY) || "0";
          setUIHidden(saved === "1");
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
          const m = window.__live2d_model;
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
          const m = window.__live2d_model;
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
          if (!window.__live2d_model || !motionEntries.length) return;
          const candidates = motionEntries.filter((m) => {
            const g = String(m.group || "").toLowerCase();
            const f = String(m.file || "").toLowerCase();
            return g !== "idle" && !f.includes("idle");
          });
          const list = candidates.length ? candidates : motionEntries;
          const pick = list[Math.floor(Math.random() * list.length)];
          try {
            const mm = window.__live2d_model.internalModel && window.__live2d_model.internalModel.motionManager;
            const pr = getForcePriority2();
            if (mm && typeof mm.startMotion === "function")
              mm.startMotion(pick.group, pick.index, pr);
            else if (mm && typeof mm.startRandomMotion === "function")
              mm.startRandomMotion(pick.group, pr);
          } catch (e) {
          }
        }
        function interruptAndPlayRandomNonIdle3() {
          const m = window.__live2d_model;
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
                if (typeof mm.stopAllMotions === "function") mm.stopAllMotions();
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
            if (Array.isArray(motionEntries) && motionEntries.length) {
              playRandomNonIdle3();
              snoozeIdle2(m, 6e3);
              return;
            }
            if (tryRuntimeGroups()) {
              snoozeIdle2(m, 6e3);
              return;
            }
            try {
              if (typeof tryStartRandomMotion === "function") {
                const ok = tryStartRandomMotion("TapBody");
                if (ok) {
                  snoozeIdle2(m, 6e3);
                  return;
                }
              }
            } catch (e) {
            }
            if (tryModelConvenience()) {
              snoozeIdle2(m, 6e3);
              return;
            }
            if (attempts-- > 0) setTimeout(tryStart, 200);
          };
          tryStart();
        }
        function focusModel() {
          const m = window.__live2d_model;
          if (!m) return;
          m.scale.set(0.55);
        }
        function relaxModel() {
          const m = window.__live2d_model;
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
              const m = window.__live2d_model;
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
        if (window.overlayAPI && window.overlayAPI.onEvent) {
          const processed = /* @__PURE__ */ new Set();
          window.overlayAPI.onEvent((data) => {
            try {
              if (!data || !data.type) return;
              const key = [data.type, data.path || "", data.timestamp || ""].join(
                "|"
              );
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
      img.src = "../cowsay.gif";
      el.appendChild(img);
    }
  })();
  var pinBtn = document.getElementById("pin");
  var opacityInput = document.getElementById("opacity");
  var pinned = false;
  pinBtn.addEventListener("click", async () => {
    pinned = !pinned;
    pinBtn.textContent = pinned ? "Pinned" : "Pin";
    if (window.overlayAPI) await window.overlayAPI.toggleClickThrough(pinned);
  });
  opacityInput.addEventListener("input", () => {
    try {
      const m = window.__live2d_model;
      const base = window.__live2d_base_scale || (m ? m.scale.x : 1);
      const factor = Math.max(
        0.5,
        Math.min(1.5, Number(opacityInput.value) || 1)
      );
      if (m && isFinite(base)) {
        const origX = m.x;
        const origY = m.y;
        m.scale.set(base * factor);
        m.x = origX;
        m.y = origY;
      }
    } catch {
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "F12" && window.overlayAPI && window.overlayAPI.openDevTools)
      window.overlayAPI.openDevTools();
  });
})();
//# sourceMappingURL=index.js.map
