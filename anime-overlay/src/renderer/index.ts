// Глобальные объявления для TS (минимально, без global augmentation)
declare const PIXI: any;

// Загрузка через CDN, можно заменить на локальные ассеты
(async function () {
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res(src);
      s.onerror = (ev) =>
        rej(
          new Error(
            "Failed to load script " +
              src +
              " (" +
              (ev && ev.message ? ev.message : ev) +
              ")"
          )
        );
      document.head.appendChild(s);
    });
  }
  try {
    // PIXI загружен выше; Cubism Core и плагины подключаем лениво
    const app = new PIXI.Application({
      transparent: true,
      width: 320,
      height: 480,
    });
    document.getElementById("model").appendChild(app.view);
    try {
      (app.stage as any).interactive = true;
    } catch {}
    const modelContainerEl = document.getElementById("model");

    // --- Dragging support for the Live2D model ---
    const dragState: any = {
      active: false,
      data: null,
      startX: 0,
      startY: 0,
      origX: 0,
      origY: 0,
      target: null,
    };

    function installStageDragHandlers() {
      try {
        if ((app.stage as any).__dragHandlersInstalled) return;
        (app.stage as any).interactive = true;
        const onMove = (ev: any) => {
          try {
            if (!dragState.active || !dragState.data || !dragState.target)
              return;
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

    function enableDraggingForModel(target: any) {
      if (!target) return;
      installStageDragHandlers();
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

    function fitModelToCanvas() {
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
        // Enlarge a bit to compensate invisible margins in many models
        const fudge = 1.2; // 20% larger than strict fit
        const base = Math.min(
          (app.renderer.width * 0.98) / bw,
          (app.renderer.height * 0.98) / bh
        );
        const baseScale = Math.max(0.1, Math.min(base * fudge, base * 1.4));
        (window as any).__live2d_base_scale = baseScale;
        let factor = 1;
        try {
          const input = document.getElementById(
            "opacity"
          ) as HTMLInputElement | null;
          if (input)
            factor = Math.max(0.5, Math.min(1.5, Number(input.value) || 1));
        } catch {}
        if (isFinite(baseScale) && baseScale > 0)
          model.scale.set(baseScale * factor);
      } catch {}
    }

    function resizeStageToContainer() {
      try {
        const w = (modelContainerEl && modelContainerEl.clientWidth) || 320;
        const h = (modelContainerEl && modelContainerEl.clientHeight) || 480;
        app.renderer.resize(w, h);
        fitModelToCanvas();
      } catch {}
    }

    window.addEventListener("resize", resizeStageToContainer);
    try {
      const ro = new ResizeObserver(() => resizeStageToContainer());
      ro.observe(modelContainerEl);
    } catch {}
    // initial fit
    resizeStageToContainer();

    // Список моделей из репозитория Eikanya (через jsdelivr)
    const MODELS = [
      // По умолчанию загружаем Cubism2 (.model.json), чтобы не инициализировать Cubism4 на старте
      "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E5%B4%A9%E5%9D%8F%E5%AD%A6%E5%9B%AD2/houraiji/model.json",
      "https://raw.githubusercontent.com/Eikanya/Live2d-model/master/%E7%A2%A7%E8%93%9D%E8%88%AA%E7%BA%BF%20Azue%20Lane/Azue%20Lane(JP)/abeikelongbi_3/abeikelongbi_3.model3.json",
      "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model/Live2D/haru/haru_greeter_t03.model3.json",
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
          } catch (e) {}
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
        const model = await PIXI.live2d.Live2DModel.from(url);
        try {
          model.__motionGroups = discoveredMotionGroups;
        } catch (e) {}
        return model;
      } catch (err) {
        throw new Error(
          "Failed to load model from " +
            url +
            " — " +
            (err && err.message ? err.message : err)
        );
      }
    }

    function makeAbsolute(baseUrl, relative) {
      try {
        if (!relative) return relative;
        if (/^https?:\/\//i.test(relative)) return relative;
        const u = new URL(baseUrl);
        const base = baseUrl.replace(/[^/]+$/, "");
        return new URL(relative, base).toString();
      } catch {
        return relative;
      }
    }

    function buildCubism2DataJson(json, baseUrl) {
      const clone = { ...json };
      try {
        if (clone.model) clone.model = makeAbsolute(baseUrl, clone.model);
        if (Array.isArray(clone.textures))
          clone.textures = clone.textures.map((t) => makeAbsolute(baseUrl, t));
        if (clone.physics) clone.physics = makeAbsolute(baseUrl, clone.physics);
        if (clone.pose) clone.pose = makeAbsolute(baseUrl, clone.pose);
        if (Array.isArray(clone.expressions)) {
          clone.expressions = clone.expressions.map((e) => {
            if (typeof e === "string") return makeAbsolute(baseUrl, e);
            const ee = { ...e };
            if (ee.file) ee.file = makeAbsolute(baseUrl, ee.file);
            if (ee.File) ee.File = makeAbsolute(baseUrl, ee.File);
            return ee;
          });
        }
        if (clone.motions || clone.Motions) {
          const motions = clone.motions || clone.Motions;
          const out = {};
          for (const g of Object.keys(motions || {})) {
            out[g] = (motions[g] || []).map((m) => {
              if (typeof m === "string") return makeAbsolute(baseUrl, m);
              const mm = { ...m };
              if (mm.file) mm.file = makeAbsolute(baseUrl, mm.file);
              if (mm.File) mm.File = makeAbsolute(baseUrl, mm.File);
              return mm;
            });
          }
          if (clone.motions) clone.motions = out;
          if (clone.Motions) clone.Motions = out;
        }
      } catch {}
      const data =
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(clone));
      return data;
    }

    // --- Viewer-like helpers for robust model loading ---
    function detectUseV4FromUrl(u: string | null): boolean | null {
      try {
        if (!u) return null;
        const low = u.toLowerCase();
        if (/(^|\/)model3\.json(\?|$)/.test(low)) return true;
        if (/(^|\/)model\.json(\?|$)/.test(low)) return false;
      } catch {}
      return null;
    }
    function detectRuntimeByUrl(u: string | null): boolean | null {
      try {
        if (!u) return null;
        const low = u.toLowerCase();
        if (/\.model3\.json(\?|$)/.test(low) || /\.moc3(\?|$)/.test(low))
          return true; // C4
        if (/\.model\.json(\?|$)/.test(low) || /\.moc(\?|$)/.test(low))
          return false; // C2
        if (/\.json(\?|$)/.test(low)) return false; // default .json → C2
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
            j.FileReferences.Textures = j.FileReferences.Textures.map(
              (t: any) => toAbsoluteAssetUrl(modelJsonUrl, t)
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
          if (j.physics)
            j.physics = toAbsoluteAssetUrl(modelJsonUrl, j.physics);
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
        if (
          j?.FileReferences?.Moc &&
          /\.moc3$/i.test(String(j.FileReferences.Moc))
        )
          isC4 = true;
        if (
          j?.FileReferences?.Moc &&
          /\.moc$/i.test(String(j.FileReferences.Moc))
        )
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
    async function loadModel(
      appRef: any,
      url: string,
      forceV4?: boolean | null
    ) {
      try {
        await clearPixiCaches();
        if ((window as any).__live2d_model) {
          try {
            appRef.stage.removeChild((window as any).__live2d_model);
            (window as any).__live2d_model.destroy?.(true);
          } catch {}
        }
        (window as any).__live2d_model = undefined;
      } catch {}
      const { urlOrSettings, useV4, originalUrl, groups } =
        await loadSettingsJson(url, forceV4);
      try {
        const desired: "c2" | "c4" | null =
          useV4 === true ? "c4" : useV4 === false ? "c2" : null;
        if (
          desired &&
          (window as any).__loadedRuntime &&
          (window as any).__loadedRuntime !== desired
        ) {
          (
            window.location as any
          ).href = `index.html?model=${encodeURIComponent(originalUrl)}`;
          throw new Error("Switching runtime requires reload");
        }
      } catch {}
      if (useV4 === true) await ensureCubism4();
      else if (useV4 === false) await ensureCubism2();
      else await ensureCubism4();

      let loadedModel: any = null;
      const ns = useV4
        ? (window as any).__live2d_api_c4 || (PIXI as any).live2d
        : (window as any).__live2d_api_c2 || (PIXI as any).live2d;
      const prevLive2d = (PIXI as any).live2d;
      (PIXI as any).live2d = ns;
      try {
        loadedModel = await (PIXI as any).live2d.Live2DModel.from(
          urlOrSettings,
          {
            motionPreload: "none",
          }
        );
      } catch {
        try {
          loadedModel = await (PIXI as any).live2d.Live2DModel.from(
            urlOrSettings
          );
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
              loadedModel = await (PIXI as any).live2d.Live2DModel.from(cloned);
            } catch {}
          }
        }
      } finally {
        try {
          (PIXI as any).live2d = prevLive2d;
        } catch {}
      }
      try {
        if (loadedModel && loadedModel.anchor && loadedModel.anchor.set)
          loadedModel.anchor.set(0.5, 0.5);
      } catch {}
      appRef.stage.addChild(loadedModel);
      try {
        enableDraggingForModel(loadedModel);
      } catch {}
      try {
        (window as any).__live2d_model = loadedModel;
      } catch {}
      return { model: loadedModel, groups, fitModel: fitModelToCanvas };
    }

    function urlToRepoPath(url) {
      try {
        const u = new URL(url);
        if (u.hostname === "raw.githubusercontent.com") {
          // /Eikanya/Live2d-model/<ref>/<path>
          const parts = u.pathname.split("/").filter(Boolean);
          return decodeURIComponent(parts.slice(3).join("/"));
        }
        if (u.hostname === "cdn.jsdelivr.net") {
          // /gh/Eikanya/Live2d-model@<ref>/<path>
          const m = u.pathname.match(
            /\/gh\/Eikanya\/Live2d-model@[^/]+\/(.*)$/
          );
          if (m) return decodeURIComponent(m[1]);
        }
      } catch {}
      return null;
    }

    async function tryFindAlternateModelJsonUrl(originalUrl) {
      const baseDir = originalUrl.replace(/[^/]+$/, "");
      const tryCandidates = async (names) => {
        for (const name of names) {
          const cand = baseDir + name;
          try {
            const r = await fetch(cand, { method: "HEAD" });
            if (r.ok) return cand;
          } catch {}
        }
        return null;
      };
      // Simple filename heuristics
      const simple = await tryCandidates(["model.json", "model.model.json"]);
      if (simple) return simple;
      // Use prebuilt index to list directory files
      try {
        await ensureIndexLoaded();
        const repoPath = urlToRepoPath(originalUrl);
        if (!repoPath) return null;
        const dir = repoPath.replace(/\/?[^/]*$/, "");
        const node = findIndexNode(dir);
        const files = (node && node.files) || [];
        // Prefer model.json-like names, exclude model3.json
        const sorted = files
          .filter((f) => /\.json$/i.test(f) && !/model3\.json$/i.test(f))
          .sort((a, b) => (a.toLowerCase() === "model.json" ? -1 : 1));
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

    // select модели
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

    // Add inspector open button
    const openInspectorBtn = document.createElement("button");
    openInspectorBtn.textContent = "Change model💖";
    openInspectorBtn.style.webkitAppRegion = "no-drag";
    openInspectorBtn.className = "btn";
    openInspectorBtn.addEventListener("click", () => {
      const current = select.value || "";
      const qp = current ? `?model=${encodeURIComponent(current)}` : "";
      window.location.href = `viewer.html${qp}`;
    });
    controls.insertBefore(openInspectorBtn, select);

    // Animations UI: list available groups and allow playing one (styled)
    const animSelect = document.createElement("select");
    animSelect.className = "select";
    animSelect.style.webkitAppRegion = "no-drag";
    animSelect.id = "animSelect";
    animSelect.disabled = true;
    const animPlayBtn = document.createElement("button");
    animPlayBtn.className = "btn";
    animPlayBtn.textContent = "▶";
    animPlayBtn.title = "Проиграть выбранную группу";
    animPlayBtn.style.webkitAppRegion = "no-drag";
    animPlayBtn.disabled = true;
    // controls.insertBefore(animPlayBtn, openInspectorBtn);
    // controls.insertBefore(animSelect, openInspectorBtn);

    // Voice TTS toggle
    const voiceBtn = document.createElement("button");
    voiceBtn.className = "btn";
    voiceBtn.textContent = "Voice: Audio";
    voiceBtn.title = "Озвучка фраз (TTS)";
    voiceBtn.style.webkitAppRegion = "no-drag";
    controls.insertBefore(voiceBtn, openInspectorBtn);

    // removed secondary viewer button

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
      raf: null,
    };

    function setMouthOpenParam(targetModel, value) {
      if (!targetModel) return false;
      const v = Math.max(0, Math.min(1, value));
      // Try Cubism4 core
      try {
        const core =
          targetModel.internalModel && targetModel.internalModel.coreModel;
        if (core) {
          if (typeof core.setParameterById === "function") {
            core.setParameterById("ParamMouthOpenY", v);
            return true;
          }
          if (typeof core.setParameterValueById === "function") {
            core.setParameterValueById("ParamMouthOpenY", v);
            return true;
          }
          if (
            typeof core.getParameterIndexById === "function" &&
            typeof core.setParameterValueByIndex === "function"
          ) {
            const idx = core.getParameterIndexById("ParamMouthOpenY");
            if (idx >= 0) {
              core.setParameterValueByIndex(idx, v);
              return true;
            }
          }
        }
      } catch (e) {}
      // Try Cubism2 API
      try {
        const c2 =
          (targetModel.internalModel && targetModel.internalModel.coreModel) ||
          targetModel;
        if (c2 && typeof c2.setParamFloat === "function") {
          c2.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
          return true;
        }
      } catch (e) {}
      // Some wrappers might expose direct method
      try {
        if (typeof targetModel.setParamFloat === "function") {
          targetModel.setParamFloat("PARAM_MOUTH_OPEN_Y", v);
          return true;
        }
      } catch (e) {}
      return false;
    }

    // --- TTS (Voice) ---
    let voiceEnabled = true;
    let voiceMode = "audio"; // 'audio' | 'tts' | 'off'
    let preferredVoice = null;
    const tts = {
      pickVoice() {
        try {
          const voices = window.speechSynthesis
            ? window.speechSynthesis.getVoices()
            : [];
          const ru = voices.find((v) => /ru/i.test(v.lang || ""));
          preferredVoice = ru || voices[0] || null;
        } catch {}
      },
      say(text) {
        if (!voiceEnabled) return null;
        try {
          if (!window.speechSynthesis) return;
          if (!preferredVoice) this.pickVoice();
          const u = new SpeechSynthesisUtterance(String(text || ""));
          if (preferredVoice) u.voice = preferredVoice;
          u.lang = (preferredVoice && preferredVoice.lang) || "ru-RU";
          u.rate = 1.0;
          u.pitch = 1.0;
          u.volume = 1.0;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
          return u;
        } catch {}
        return null;
      },
    };
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => tts.pickVoice();
      tts.pickVoice();
    }

    const TTS_PHRASES = {
      start: [
        "Ну давай, попробуй хотя бы раз не обосраться.",
        "Таймер пошёл, так что хватит чесать яйца — работай.",
        "Фокус, блин! Ты сюда кодить пришёл, а не в потолок пялиться.",
        "Запускаем. Если опять всё просрёшь — это уже не моя вина.",
        "Работа началась. А ты вообще работать умеешь?",
      ],
      finish: [
        "О, смотри-ка, дожил! Я думал ты сдохнешь на середине.",
        "Поздравляю, ты сделал ровно нихрена. Но красиво.",
        "Таймер закончился. А толку-то? Код всё ещё говно.",
        "Ну хоть что-то довёл до конца. Чисто рекорд.",
        "Молодец, герой. Иди отдохни, пока не передох.",
      ],
      break: [
        "Вставай, амёба. Ты скоро со стулом срастёшься.",
        "Да сделай уже разминку, а то сидишь как высохший дед.",
        "Сходи попей воды, может мозг промоет.",
        "Перерыв. Хотя тебе бы пожизненный оформить.",
        "Глаза закрывай, а то такими темпами ты ослепнешь, и я наконец от тебя отдохну.",
      ],
      xp: [
        "+XP, но ты всё равно идиот.",
        "Ну вот, качнулся. Жаль, харизмы это не добавит.",
        "+1 к скиллу. Правда, толку от тебя как от дохлой мыши.",
        "Поздравляю, ещё шаг к званию неполный дегенерат.",
        "Ну хоть цифры растут, в отличие от твоего мозга.",
      ],
      fun: [
        "Опять дебажишь? Ты же знаешь, что руки у тебя из жопы.",
        "Когда релиз? Никогда. Потому что с тобой — нереально.",
        "Ты уверен, что это компилируется? Я бы на твоём месте проверил молитвой.",
        "Сидишь такой умный, а на деле — клавиатурный бомж.",
        "Глаза у тебя красные… это от кода или от порнхаба?",
        "Смотри, какой коммит! Да за это на GitHub смеяться будут годами.",
        "Да-да, Сэмпай… рукожопый Сэмпай.",
      ],
    };

    function sayRandom(list) {
      try {
        if (!Array.isArray(list) || !list.length) return null;
        const pick = list[Math.floor(Math.random() * list.length)];
        return pick;
      } catch {}
      return null;
    }

    // --- Audio files for phrases ---
    const VOICE_AUDIO_DEFAULT = {
      start: [],
      finish: [],
      break: [],
      xp: [],
      fun: [],
    };
    let VOICE_AUDIO = { ...VOICE_AUDIO_DEFAULT };
    const audioCache = new Map();
    function getAudio(url) {
      let a = audioCache.get(url);
      if (!a) {
        a = new Audio(url);
        a.preload = "auto";
        audioCache.set(url, a);
      }
      return a;
    }
    let currentAudio = null;
    function playAudioCategory(cat) {
      return new Promise((resolve) => {
        try {
          const list = (VOICE_AUDIO && VOICE_AUDIO[cat]) || [];
          if (!Array.isArray(list) || !list.length) return resolve(false);
          const pick = list[Math.floor(Math.random() * list.length)];
          if (!pick) return resolve(false);
          if (currentAudio) {
            try {
              currentAudio.pause();
              currentAudio.currentTime = 0;
            } catch (e) {}
          }
          const a = getAudio(pick);
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
    }

    // LipSync driven by phrase playback (audio element) or speech synthesis
    function getForcePriority() {
      try {
        const ns = PIXI.live2d && PIXI.live2d.MotionPriority;
        return (ns && (ns.FORCE || ns.PriorityForce)) || 3;
      } catch (e) {
        return 3;
      }
    }
    function ensureAudioContext() {
      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext || null;
        if (!AudioCtx) return null;
        if (!lipSyncState.audioContext)
          lipSyncState.audioContext = new AudioCtx();
        return lipSyncState.audioContext;
      } catch {
        return null;
      }
    }

    function startLipSyncForAudio(audioEl) {
      if (!audioEl || !model) return;
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        if (lipSyncState.source && lipSyncState.source.disconnect)
          lipSyncState.source.disconnect();
      } catch (e) {}
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
            let min = 255,
              max = 0;
            for (let i = 0; i < data.length; i++) {
              const v = data[i];
              if (v < min) min = v;
              if (v > max) max = v;
            }
            let amp = (max - min) / 255;
            amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
            if (amp > 1) amp = 1;
            setMouthOpenParam(window.__live2d_model, amp);
          } catch (e) {}
          if (audioEl.ended || audioEl.paused) {
            setMouthOpenParam(window.__live2d_model, 0);
            return;
          }
          lipSyncState.raf = requestAnimationFrame(update);
        };
        lipSyncEnabled = true;
        lipSyncState.raf = requestAnimationFrame(update);
      } catch (e) {}
    }

    function startLipSyncForSpeech(utterance) {
      if (!model) return;
      const tick = () => {
        if (!lipSyncEnabled) return;
        const speaking =
          window.speechSynthesis && window.speechSynthesis.speaking;
        if (!speaking) {
          setMouthOpenParam(window.__live2d_model, 0);
          return;
        }
        const t = performance.now() / 1000;
        const amp = Math.max(
          0,
          Math.min(1, (Math.sin(t * 9) + Math.sin(t * 13) * 0.5 + 1) / 2)
        );
        setMouthOpenParam(window.__live2d_model, amp * 0.9);
        lipSyncState.raf = requestAnimationFrame(tick);
      };
      lipSyncEnabled = true;
      lipSyncState.raf = requestAnimationFrame(tick);
      if (utterance) {
        try {
          utterance.onend = () => setMouthOpenParam(window.__live2d_model, 0);
        } catch (e) {}
      }
    }

    async function loadPhrasesJson() {
      try {
        const resp = await fetch("./phrases.json", { cache: "no-cache" });
        if (!resp.ok) return;
        const data = await resp.json();
        // Accept either {cat: [audioUrls]} or {cat: {audio: [...], text: [...]}}
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
      } catch (e) {}
    }
    loadPhrasesJson();

    // Внешние хелперы анимаций для использования из любого места
    function playRandomNonIdle() {
      if (!window.__live2d_model || !motionEntries.length) return;
      const candidates = motionEntries.filter((m) => {
        const g = String(m.group || "").toLowerCase();
        const f = String(m.file || "").toLowerCase();
        return g !== "idle" && !f.includes("idle");
      });
      const list = candidates.length ? candidates : motionEntries;
      const pick = list[Math.floor(Math.random() * list.length)];
      try {
        const mm =
          window.__live2d_model.internalModel &&
          window.__live2d_model.internalModel.motionManager;
        const pr = getForcePriority();
        if (mm && typeof mm.startMotion === "function")
          mm.startMotion(pick.group, pick.index, pr);
        else if (mm && typeof mm.startRandomMotion === "function")
          mm.startRandomMotion(pick.group, pr);
      } catch (e) {}
    }

    function interruptAndPlayRandomNonIdle() {
      const m = window.__live2d_model;
      if (!m) return;
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
      playRandomNonIdle();
      try {
        snoozeIdle(m, 6000);
      } catch (e) {}
    }

    function speakCategory(cat) {
      if (!voiceEnabled || !cat) return;
      if (voiceMode === "audio") {
        playAudioCategory(cat).then((ok) => {
          if (ok && currentAudio) {
            if (lipSyncEnabled) startLipSyncForAudio(currentAudio);
            // trigger animation immediately on voice start
            interruptAndPlayRandomNonIdle();
            try {
              currentAudio.addEventListener(
                "play",
                () => interruptAndPlayRandomNonIdle(),
                { once: true }
              );
              currentAudio.addEventListener(
                "playing",
                () => interruptAndPlayRandomNonIdle(),
                { once: true }
              );
            } catch (e) {}
            if (!currentAudio.paused) {
              setTimeout(() => interruptAndPlayRandomNonIdle(), 0);
            }
          } else if (!ok) {
            // Нет аудио — просто запустим реакцию анимацией
            interruptAndPlayRandomNonIdle();
          }
        });
        return;
      }
      if (voiceMode === "tts") {
        const text = sayRandom(TTS_PHRASES[cat] || []);
        if (text) {
          const u = tts.say(text);
          try {
            if (u) u.onstart = () => interruptAndPlayRandomNonIdle();
          } catch (e) {}
          interruptAndPlayRandomNonIdle();
          if (lipSyncEnabled) startLipSyncForSpeech(u);
        }
        return;
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

    async function startLipSync() {
      if (!window.navigator || !navigator.mediaDevices) return;
      if (!model) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext || null;
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
          raf: null,
        };

        const update = () => {
          if (!lipSyncEnabled) return;
          try {
            analyser.getByteTimeDomainData(data);
            // Compute peak-to-peak amplitude normalized
            let min = 255,
              max = 0;
            for (let i = 0; i < data.length; i++) {
              const v = data[i];
              if (v < min) min = v;
              if (v > max) max = v;
            }
            let amp = (max - min) / 255; // 0..~1
            // Smooth and scale
            amp = Math.pow(Math.max(0, amp - 0.02) * 1.8, 1.2);
            if (amp > 1) amp = 1;
            setMouthOpenParam(window.__live2d_model, amp);
          } catch (e) {}
          lipSyncState.raf = requestAnimationFrame(update);
        };
        lipSyncEnabled = true;

        update();
      } catch (e) {}
    }

    function stopLipSync() {
      try {
        if (lipSyncState && lipSyncState.raf != null) {
          cancelAnimationFrame(lipSyncState.raf as any);
          lipSyncState.raf = null;
        }
      } catch (e) {}
      try {
        if (
          lipSyncState &&
          lipSyncState.source &&
          lipSyncState.source.disconnect
        ) {
          lipSyncState.source.disconnect();
        }
      } catch (e) {}
      try {
        if (lipSyncState && lipSyncState.stream) {
          lipSyncState.stream.getTracks().forEach((t) => t.stop());
        }
      } catch (e) {}
      try {
        setMouthOpenParam(window.__live2d_model, 0);
      } catch (e) {}
    }

    // LipSync всегда включен без UI-кнопки

    function refreshAnimationsUI() {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Анимации";
      animSelect.innerHTML = "";
      animSelect.appendChild(placeholder);

      const entries = Array.isArray(motionEntries) ? motionEntries.slice() : [];

      const niceName = (filePath) => {
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
        entries.forEach((e) => {
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
        animPlayBtn.disabled = false;
        return;
      }

      // Fallback to group-based listing if we have no parsed entries
      const groups = Array.from(new Set([...(availableGroups || [])])).filter(
        (g) => String(g).length > 0
      );
      // Try to synthesize per-index entries from runtime definitions
      let synthesized = false;
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
      animPlayBtn.disabled = !enabled;
    }

    function getGroupsFromManager(mm) {
      try {
        const defs =
          mm && (mm.definitions || mm._definitions || mm._motions || {});
        return Object.keys(defs || {});
      } catch (e) {
        return [];
      }
    }

    function scheduleGroupRefresh() {
      let attempts = 16;
      const poll = () => {
        if (!model) return;
        try {
          const mm = model.internalModel && model.internalModel.motionManager;
          const groups = getGroupsFromManager(mm);
          if (groups && groups.length) {
            availableGroups = Array.from(
              new Set([...(availableGroups || []), ...groups])
            );
            refreshAnimationsUI();
            return;
          }
        } catch (e) {}
        if (--attempts > 0) setTimeout(poll, 250);
      };
      poll();
    }

    function playSelectedAnimationGroup() {
      if (!model) return;
      if (!animSelect.value) return;
      const mm = model.internalModel && model.internalModel.motionManager;

      // If a specific motion (group+index) was selected, prefer that
      const selectedOpt = animSelect.options[animSelect.selectedIndex];
      const hasIndexSel =
        selectedOpt && selectedOpt.dataset && selectedOpt.dataset.index != null;
      let played = false;
      if (hasIndexSel) {
        const grp = selectedOpt.dataset.group || "";
        const idx = parseInt(selectedOpt.dataset.index, 10);
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
          snoozeIdle(window.__live2d_model, 9000);
          return;
        }
      }

      // Otherwise treat value as a group and pick an index
      const group = animSelect.value;
      const pickIndex = () => {
        // Prefer indices from parsed motionEntries
        const candidates = (motionEntries || [])
          .filter((e) => (e.group || "") === group)
          .map((e) => e.index)
          .filter((i) => typeof i === "number" && i >= 0);
        if (candidates.length) {
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
        // Try to inspect runtime definitions
        try {
          const defs =
            (mm && (mm.definitions || mm._definitions || mm._motions)) || null;
          if (defs) {
            if (Array.isArray(defs[group])) return 0;
            if (defs[group] && typeof defs[group].length === "number") return 0;
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
          snoozeIdle(window.__live2d_model, 9000);
          return;
        }
      } catch (e) {}
      try {
        if (mm && typeof mm.startRandomMotion === "function") {
          mm.startRandomMotion(group, getForcePriority());
          snoozeIdle(window.__live2d_model, 9000);
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
          snoozeIdle(window.__live2d_model, 9000);
          return;
        }
      } catch (e) {}
    }

    // animPlayBtn.addEventListener("click", playSelectedAnimationGroup);
    // animSelect.addEventListener("change", () => {
    //   // optional: auto-play on selection
    //   playSelectedAnimationGroup();
    // });

    function getMotionEntriesFromJson(json, baseUrl) {
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
      } catch {}
      try {
        const m4 = (json.FileReferences && json.FileReferences.Motions) || {};
        for (const g of Object.keys(m4)) add(g, m4[g]);
      } catch {}
      return entries;
    }

    function startIdleLoop(model, preferredGroups) {
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
      const hasGroup = (g) => {
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
          if (!window.__live2d_model || window.__live2d_model !== model) {
            clearInterval(model.__idleTimer);
            model.__idleTimer = null;
            return;
          }
          const cur = window.__live2d_model;
          const curMM =
            cur && cur.internalModel && cur.internalModel.motionManager;
          if (curMM && typeof curMM.startRandomMotion === "function") {
            curMM.startRandomMotion(chosen);
          }
        } catch {}
      }, 12000);
    }

    // Cubism 4 often stores motions differently. Prefer explicit Idle motion3 file if present.
    function startIdleLoopC4(model) {
      if (!model) return;
      try {
        if (model.__idleTimer) {
          clearInterval(model.__idleTimer);
          model.__idleTimer = null;
        }
      } catch {}
      const mm = model.internalModel && model.internalModel.motionManager;
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
          if (!window.__live2d_model || window.__live2d_model !== model) {
            clearInterval(model.__idleTimer);
            model.__idleTimer = null;
            return;
          }
          const cur = window.__live2d_model;
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

    // Temporarily pause idle loop and resume later
    function snoozeIdle(modelRef, ms) {
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
            if (currentRuntime === "c4") startIdleLoopC4(modelRef);
            else
              startIdleLoop(
                modelRef,
                Array.from(
                  new Set(
                    (motionEntries || []).map((e) =>
                      String(e.group || "").trim()
                    )
                  )
                ).filter(Boolean)
              );
          } catch (e) {}
        }, Math.max(2000, ms || 8000));
      } catch (e) {}
    }

    // Dependencies loaders (idempotent)
    let cubism2Ready = false;
    let cubism4Ready = false;
    let currentRuntime = null; // 'c2' | 'c4'
    (window as any).__loadedRuntime = (window as any).__loadedRuntime || null;
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
        if (!(window as any).__live2d_api_c4)
          (window as any).__live2d_api_c4 = (PIXI as any).live2d;
        (window as any).__loadedRuntime = "c4";
        applyPixiLive2dPatches();
      } catch (e) {}
    }
    async function ensureCubism2() {
      if (currentRuntime === "c2" && PIXI.live2d) return;
      if (!window.Live2D) {
        await loadScript(
          "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"
        );
      }
      // load cubism2 build of the plugin (safe to load alongside cubism4)
      if (!PIXI.live2d || !PIXI.live2d.Live2DModel) {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js"
        );
      }
      cubism2Ready = true;
      currentRuntime = "c2";
      try {
        if (!(window as any).__live2d_api_c2)
          (window as any).__live2d_api_c2 = (PIXI as any).live2d;
        (window as any).__loadedRuntime = "c2";
        applyPixiLive2dPatches();
      } catch (e) {}
    }

    // ---- Live2D loader/factory patches (based on live2d-viewer-web) ----
    function applyPixiLive2dPatches() {
      const ns = (PIXI as any).live2d;
      if (!ns) return;
      if ((window as any).__live2d_loader_patched) return;
      (window as any).__live2d_loader_patched = true;

      const {
        Live2DLoader,
        XHRLoader,
        Live2DFactory,
        InternalModel,
        Cubism2ModelSettings,
        Cubism4ModelSettings,
      } = ns || {};
      if (!Live2DLoader || !XHRLoader || !Live2DFactory) return;

      const urlUtils = {
        resolve: (baseUrl: string, relative: string) => {
          try {
            return new URL(relative, baseUrl).toString();
          } catch {
            return relative;
          }
        },
      };

      const getAlternativeURL = (url: string) => {
        try {
          if (/jsdelivr/i.test(url)) {
            // https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@master/<path>
            const m = url.match(
              /cdn\.jsdelivr\.net\/gh\/Eikanya\/Live2d-model@([^/]+)\/(.*)$/i
            );
            if (m)
              return `https://raw.githubusercontent.com/Eikanya/Live2d-model/${m[1]}/${m[2]}`;
          }
          if (/raw\.githubusercontent\.com/i.test(url)) {
            // swap to jsdelivr master
            const m = url.match(
              /raw\.githubusercontent\.com\/Eikanya\/Live2d-model\/([^/]+)\/(.*)$/i
            );
            if (m)
              return `https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@${m[1]}/${m[2]}`;
          }
        } catch {}
        return url;
      };

      const ping = async (url: string) => {
        try {
          const r = await fetch(url, { method: "HEAD" });
          return r.ok;
        } catch {
          return false;
        }
      };

      const snakeCaseUpper = (s: string) => {
        if (!s) return s;
        // ParamAngleX -> PARAM_ANGLE_X
        return String(s)
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
          .replace(/[-\s]+/g, "_")
          .toUpperCase();
      };

      const unionBy = <T extends Record<string, any>>(
        arr: T[] | undefined,
        extras: T[],
        key: string
      ): T[] => {
        const out: T[] = Array.isArray(arr) ? arr.slice() : [];
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

      // Replace XHR loader to handle jsDelivr 403 fallback
      try {
        const idx = Live2DLoader.middlewares.indexOf(XHRLoader.loader);
        if (idx >= 0) {
          Live2DLoader.middlewares[idx] = async (context: any, next: any) => {
            const url = context.settings
              ? context.settings.resolveURL(context.url)
              : context.url;
            try {
              await XHRLoader.loader(context, next);
              return;
            } catch (e: any) {
              if (!(e && e.status === 403 && /jsdelivr/i.test(url))) {
                throw e;
              }
              try {
                console.warn(
                  "[live2d] 403 from jsDelivr, switching alternative URL"
                );
              } catch {}
            }
            context.url = getAlternativeURL(url);
            await XHRLoader.loader(context, next);
            return next();
          };
        }
      } catch {}

      // Patches table (subset)
      const patches: Array<{
        search: string;
        replace?: (jsonText: string, url: string) => string;
        patch?: (json: any, url: string) => void | Promise<void>;
        patchInternalModel?: (internalModel: any) => void | Promise<void>;
      }> = [
        {
          search: "魂器学院",
          replace(jsonText: string) {
            return jsonText.replace(/mtn"([^,])/gm, 'mtn","$1');
          },
        },
        {
          search: "少女前线",
          async patch(json: any, url: string) {
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
          },
        },
        {
          search: "アンノウンブライド",
          async patch(json: any, url: string) {
            if (json.FileReferences?.Textures?.length === 0) {
              const exists = await ping(
                urlUtils.resolve(url, "textures/texture_00.png")
              );
              json.FileReferences.Textures.push(
                exists ? "textures/texture_00.png" : "textures/texture_00 .png"
              );
            }
            extractCubism4IdleMotions(json, ["home", "gacha"]);
          },
        },
        {
          search: "凍京",
          async patch(json: any, url: string) {
            const correctTexture = async (tex: string) =>
              (await ping(urlUtils.resolve(url, tex)))
                ? tex
                : tex.replace("/texture", "/android/texture");
            if (
              Cubism2ModelSettings &&
              Cubism2ModelSettings.isValidJSON?.(json)
            ) {
              if (json.textures)
                json.textures = await Promise.all(
                  json.textures.map(correctTexture)
                );
              if (json.motions) {
                for (const grp of Object.values(json.motions) as any[][]) {
                  if (grp?.length)
                    for (const m of grp) {
                      m.file = m.file ?? m.File;
                      delete m.File;
                    }
                }
                if (!json.motions.idle?.length && json.motions[""]) {
                  json.motions.idle = json.motions[""].filter(
                    (m: any) => m.file && m.file.includes("loop")
                  );
                }
              }
            } else if (
              Cubism4ModelSettings &&
              Cubism4ModelSettings.isValidJSON?.(json)
            ) {
              if (json.FileReferences?.Textures)
                json.FileReferences.Textures = await Promise.all(
                  json.FileReferences.Textures.map(correctTexture)
                );
              if (json.FileReferences?.Motions) {
                if (
                  !json.FileReferences.Motions.Idle?.length &&
                  json.FileReferences.Motions[""]
                ) {
                  json.FileReferences.Motions.Idle =
                    json.FileReferences.Motions[""].filter(
                      (m: any) => m.File && m.File.includes("loop")
                    );
                }
              }
            }
          },
        },
        {
          search: "天命之子",
          patch(json: any) {
            if (json.motions?.[""]?.length && !json.motions?.idle?.length)
              json.motions.idle = json.motions[""].map((m: any) => ({ ...m }));
          },
        },
        {
          search: "碧蓝航线",
          patch(json: any) {
            extractCubism4IdleMotions(json, ["idle"]);
          },
        },
        {
          search: "少女咖啡枪",
          patch(json: any) {
            extractCubism4IdleMotions(json, ["stand"]);
          },
          patchInternalModel(internalModel: any) {
            for (const prop of Object.keys(internalModel))
              if (prop.startsWith("idParam"))
                (internalModel as any)[prop] = snakeCaseUpper(
                  (internalModel as any)[prop]
                );
          },
        },
        {
          search: "princesses",
          patch(json: any) {
            extractCubism2IdleMotions(json, ["default", "loop"]);
          },
        },
        {
          search: "崩坏",
          patch(json: any) {
            removeSoundDefs(json);
            if (json.name === "") delete json.name;
          },
        },
        {
          search: "战舰少女",
          patch(json: any) {
            removeSoundDefs(json);
          },
        },
        {
          search: "机动战队",
          patch(json: any) {
            removeSoundDefs(json);
          },
        },
        {
          search: "诺亚幻想",
          patch(json: any) {
            if (json.name === "model") delete json.name;
          },
        },
      ];

      function folderName(url: string) {
        try {
          const u = new URL(url);
          const parts = u.pathname.split("/").filter(Boolean);
          return parts.slice(-2, -1)[0] || "";
        } catch {
          return "";
        }
      }

      function replaceJSONText(jsonText: string, url: string) {
        for (const p of patches)
          if (url.includes(encodeURI(p.search)) && p.replace)
            jsonText = p.replace(jsonText, url);
        return jsonText;
      }
      async function patchJSON(json: any, url: string) {
        for (const p of patches)
          if (url.includes(encodeURI(p.search)) && p.patch)
            await p.patch(json, url);
      }
      async function patchInternalModel(internalModel: any) {
        const url: string = internalModel?.settings?.url || "";
        for (const p of patches)
          if (url.includes(encodeURI(p.search)) && p.patchInternalModel)
            await p.patchInternalModel(internalModel);
      }

      // tolerant JSON parse: try JSON.parse; attempt simple comma fix fallback
      function tolerantParse(text: string) {
        try {
          return JSON.parse(text);
        } catch {}
        try {
          const fixed = text
            .replace(/\r\n/g, "\n")
            .replace(/,\s*(\}|\])/g, "$1");
          return JSON.parse(fixed);
        } catch {}
        return JSON.parse(text); // let it throw
      }

      // Replace urlToJSON
      try {
        const orig = Live2DFactory.urlToJSON;
        const arr =
          Live2DFactory.live2DModelMiddlewares ||
          Live2DFactory.middlewares ||
          [];
        const idxU = arr.indexOf(orig);
        const urlToJSON = async (context: any, next: any) => {
          if (typeof context.source === "string") {
            const url: string = context.source;
            let json: any;
            if (/\.(moc|moc3)(\?|$)/i.test(url)) {
              // synth settings from moc path minimal
              const isV3 = /\.moc3(\?|$)/i.test(url);
              const base = url.replace(/[^/]+$/, "");
              if (isV3) {
                json = {
                  url: urlUtils.resolve(url, "dummy.model3.json"),
                  FileReferences: { Moc: url, Textures: [], Motions: {} },
                };
              } else {
                json = {
                  url: urlUtils.resolve(url, "dummy.model.json"),
                  model: url,
                  textures: [],
                  motions: {},
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
              context.live2dModel &&
                context.live2dModel.emit &&
                context.live2dModel.emit("settingsJSONLoaded", json);
            } catch {}
          }
          return next();
        };
        if (idxU >= 0) arr[idxU] = urlToJSON;
        else Live2DFactory.urlToJSON = urlToJSON;
      } catch {}

      // Patch InternalModel.init
      try {
        const origInit = InternalModel.prototype.init;
        InternalModel.prototype.init = async function patchedInit() {
          try {
            await patchInternalModel(this);
          } catch {}
          return origInit.apply(this, arguments as any);
        };
      } catch {}

      // helpers used by patches
      function setSingleMotionAsIdle(json: any) {
        const motions =
          json && json.FileReferences && json.FileReferences.Motions;
        if (
          motions &&
          !(motions.Idle || [])[0] &&
          Array.isArray(motions[""]) &&
          motions[""].length === 1
        ) {
          motions.Idle = motions[""].map((m: any) => ({ ...m }));
        }
      }
      function extractCubism2IdleMotions(json: any, keywords: string[]) {
        if (json && json.motions) {
          const idle: any[] = [];
          for (const [group, motions] of Object.entries(json.motions as any)) {
            if (group !== "idle" && Array.isArray(motions)) {
              for (const motion of motions as any[])
                for (const kw of keywords)
                  if (
                    motion.file &&
                    String(motion.file).toLowerCase().includes(kw)
                  )
                    idle.push(motion);
            }
          }
          if (idle.length)
            json.motions.idle = unionBy(json.motions.idle, idle, "file");
        }
      }
      function extractCubism4IdleMotions(json: any, keywords: string[]) {
        const ref = json && json.FileReferences && json.FileReferences.Motions;
        if (ref) {
          const idle: any[] = [];
          for (const [group, motions] of Object.entries(ref as any)) {
            if (group !== "Idle" && Array.isArray(motions)) {
              for (const motion of motions as any[])
                for (const kw of keywords)
                  if (
                    motion.File &&
                    String(motion.File).toLowerCase().includes(kw)
                  )
                    idle.push(motion);
            }
          }
          if (idle.length) ref.Idle = unionBy(ref.Idle, idle, "File");
        }
      }
      function removeSoundDefs(json: any) {
        if (json && json.motions) {
          for (const grp of Object.values(json.motions as any))
            if (Array.isArray(grp))
              for (const m of grp as any[]) m.sound = undefined;
        }
      }
    }

    async function loadSelectedModel(url) {
      // remove old
      if (model) {
        try {
          app.stage.removeChild(model);
          model.destroy(true);
        } catch (e) {}
        if (lipSyncEnabled) stopLipSync();
      }
      // reset motions UI and load via viewer-style helper
      motionEntries = [];
      refreshAnimationsUI();
      const byExt = detectRuntimeByUrl(url);
      const res = await loadModel(app, url, byExt);
      model = res && (res as any).model ? (res as any).model : null;
      availableGroups = Array.isArray((res as any)?.groups)
        ? (res as any).groups
        : [];
      scheduleGroupRefresh();
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
      // start Idle loop depending on runtime
      try {
        if (currentRuntime === "c4") {
          startIdleLoopC4(model);
        } else {
          startIdleLoop(
            model,
            Array.from(
              new Set(
                (motionEntries || []).map((e) => String(e.group || "").trim())
              )
            ).filter(Boolean)
          );
        }
      } catch {}
    }

    // Load model from query if provided, otherwise from saved last model
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
      } catch (e) {}
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
      } catch (e) {}
      loadSelectedModel(url);
    });

    // Inspector logic (GitHub API directory browser)
    const modal = document.getElementById("modelInspector");
    const listEl = document.getElementById("inspectorList");
    const breadcrumbEl = document.getElementById("inspectorBreadcrumb");
    const urlInput = document.getElementById("inspectorUrl");
    const loadUrlBtn = document.getElementById("inspectorLoadUrl");

    let currentPath = ""; // path within repo
    let selectedModelPath = ""; // repo path to selected .model3.json

    function encodeRepoPath(path) {
      return (path || "")
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");
    }
    function pathToJsDelivr(repoPath, ref) {
      const encoded = encodeRepoPath(repoPath);
      const suffix = ref ? "@" + ref : "";
      return (
        "https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model" +
        suffix +
        "/" +
        encoded
      );
    }
    function pathToRaw(repoPath, ref) {
      const encoded = encodeRepoPath(repoPath);
      const branch = ref || "master";
      return (
        "https://raw.githubusercontent.com/Eikanya/Live2d-model/" +
        branch +
        "/" +
        encoded
      );
    }
    async function resolveModelUrl(repoPath) {
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

    // Prebuilt models index to avoid GitHub API limits
    const INDEX_URL =
      "https://guansss.github.io/live2d-viewer-web/eikanyalive2d-model.json";
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
      return (modelIndexRoot && modelIndexRoot.name) || "Eikanya/Live2d-model";
    }
    function findIndexNode(path) {
      return indexPathMap[path || ""] || null;
    }
    function listDirFromIndex(path) {
      const node = findIndexNode(path);
      return {
        dirs: (node && node.children) || [],
        files: (node && node.files) || [],
      };
    }
    function buildRepoPath(path, name) {
      return (path ? path + "/" : "") + name;
    }
    async function buildSyntheticCubism2Json(repoPathToMoc) {
      const key = indexRootName() + "/" + repoPathToMoc;
      const meta = modelInfoMap[key] || {};
      const dir = repoPathToMoc.replace(/\/?[^/]*$/, "");
      const modelUrl = await resolveModelUrl(repoPathToMoc);
      const textures = Array.isArray(meta.textures)
        ? meta.textures
        : ["texture_00.png"];
      const motionsObj = {};
      if (meta.motions) {
        for (const g of Object.keys(meta.motions)) {
          motionsObj[g] = (meta.motions[g] || []).map((m) => ({
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
      const json = { model: modelUrl, textures: absTextures };
      if (absPhysics) json.physics = absPhysics;
      if (Object.keys(motionsObj).length) json.motions = motionsObj;
      return (
        "data:application/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(json))
      );
    }

    function renderBreadcrumb(path) {
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
    }

    function getAuthHeaders() {
      try {
        const t = localStorage.getItem("gh_token") || "";
        if (t) return { Authorization: `token ${t}` };
      } catch {}
      return {};
    }

    // Expose model for controls
    window.__live2d_model = model;

    // Pomodoro + RPG logic
    (function () {
      const TIMER_WORK_DEFAULT = 25 * 60; // seconds
      const TIMER_BREAK_DEFAULT = 5 * 60;
      let workDuration = TIMER_WORK_DEFAULT;
      let breakDuration = TIMER_BREAK_DEFAULT;
      let timeLeft = workDuration;
      let running = false;
      let mode = "work"; // 'work' or 'break'

      // RPG stats
      const stateKey = "anime_overlay_rpg_v1";
      let state = { level: 1, xp: 0, tomatoes: 0 };
      try {
        const saved = localStorage.getItem(stateKey);
        if (saved) state = JSON.parse(saved);
      } catch (e) {}

      const $ = (id) => document.getElementById(id);
      // UI toggle helpers
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
          showUIBtn.addEventListener("click", () => setUIHidden(false));
      } catch {}
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
        } catch (e) {}
      }
      function formatTime(s) {
        const mm = Math.floor(s / 60);
        const ss = s % 60;
        return String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
      }
      function updateUI() {
        timerDisplay.textContent = formatTime(timeLeft);
        timerLabel.textContent = mode === "work" ? "Работа" : "Перерыв";
        levelEl.textContent = state.level;
        xpEl.textContent = state.xp;
        tomatoesEl.textContent = state.tomatoes;
      }

      function rewardForWork() {
        state.xp += 10;
        state.tomatoes += 1;
        if (state.xp >= state.level * 100) {
          state.xp -= state.level * 100;
          state.level += 1; // level up
          // celebration animation
          pulseModel(1.3, 600);
          toast("Уровень повышен!");
          speakCategory("xp");
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
          // restore position to avoid shift when scaling
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

      function playRandomNonIdle() {
        if (!window.__live2d_model || !motionEntries.length) return;
        const candidates = motionEntries.filter((m) => {
          const g = String(m.group || "").toLowerCase();
          const f = String(m.file || "").toLowerCase();
          return g !== "idle" && !f.includes("idle");
        });
        const list = candidates.length ? candidates : motionEntries;
        const pick = list[Math.floor(Math.random() * list.length)];
        try {
          const mm =
            window.__live2d_model.internalModel &&
            window.__live2d_model.internalModel.motionManager;
          const pr = getForcePriority();
          if (mm && typeof mm.startMotion === "function")
            mm.startMotion(pick.group, pick.index, pr);
          else if (mm && typeof mm.startRandomMotion === "function")
            mm.startRandomMotion(pick.group, pr);
        } catch (e) {}
      }

      function interruptAndPlayRandomNonIdle() {
        const m = window.__live2d_model;
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
          if (Array.isArray(motionEntries) && motionEntries.length) {
            playRandomNonIdle();
            snoozeIdle(m, 6000);
            return;
          }
          // 2) use runtime groups
          if (tryRuntimeGroups()) {
            snoozeIdle(m, 6000);
            return;
          }
          // 3) last resort: try generic triggers via helper
          try {
            if (typeof tryStartRandomMotion === "function") {
              const ok = tryStartRandomMotion("TapBody");
              if (ok) {
                snoozeIdle(m, 6000);
                return;
              }
            }
          } catch (e) {}
          // 4) model.motion convenience if available
          if (tryModelConvenience()) {
            snoozeIdle(m, 6000);
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
        // no model zoom on timer start
        speakCategory("start");
        // ensure animation triggers even if audio is blocked
        interruptAndPlayRandomNonIdle();
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
        }, 1000);
      }
      function pauseTimer() {
        if (!running) return;
        running = false;
        clearInterval(timerInterval);
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        speakCategory("break");
        interruptAndPlayRandomNonIdle();
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
          toast("Перерыв!"); // model reaction
          speakCategory("break");
          try {
            const m = window.__live2d_model;
            if (
              m &&
              m.internalModel &&
              m.internalModel.motionManager &&
              m.internalModel.motionManager.startRandomMotion
            )
              m.internalModel.motionManager.startRandomMotion("Relax");
          } catch (e) {}
        } else {
          mode = "work";
          timeLeft = workDuration;
          toast("Время работать!");
          speakCategory("finish");
        }
        updateUI();
      }

      // clicks on model grant small XP
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

      // initialize UI
      timeLeft = workDuration;
      updateUI();
      pauseBtn.disabled = true;
      startBtn.disabled = false;
      // subscribe to extension events (deduped)
      if (window.overlayAPI && window.overlayAPI.onEvent) {
        const processed = new Set();
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
                toast("Сохранено: +" + gain + " XP (" + chars + " chars)");
                speakCategory("xp");
                playRandomNonIdle();
              } else {
                // no XP for zero-chars save
                toast("Сохранено (без XP)");
              }
            } else if (data.type === "edit") {
              // edits don't grant XP until saved; just react
              saveState();
              updateUI();
              toast("Правка");
              playRandomNonIdle();
              if (Math.random() < 0.1) speakCategory("fun");
            } else if (data.type === "focus") {
              focusModel();
              toast("Фокус на файле");
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
    el.textContent =
      "Ошибка загрузки модели: " + (e && e.message ? e.message : e);
    // попытаться показать fallback из локальных ассетов
    const img = document.createElement("img");
    img.style.width = "100%";
    img.style.height = "100%";
    img.src = "../cowsay.gif";
    el.appendChild(img);
  }
})();
// controls
const pinBtn = document.getElementById("pin");
const opacityInput = document.getElementById("opacity");
let pinned = false;
pinBtn.addEventListener("click", async () => {
  pinned = !pinned;
  pinBtn.textContent = pinned ? "Pinned" : "Pin";
  if (window.overlayAPI) await window.overlayAPI.toggleClickThrough(pinned);
});

opacityInput.addEventListener("input", () => {
  try {
    const m = (window as any).__live2d_model;
    const base = (window as any).__live2d_base_scale || (m ? m.scale.x : 1);
    const factor = Math.max(
      0.5,
      Math.min(1.5, Number((opacityInput as HTMLInputElement).value) || 1)
    );
    if (m && isFinite(base)) {
      const origX = m.x;
      const origY = m.y;
      m.scale.set(base * factor);
      m.x = origX;
      m.y = origY;
    }
  } catch {}
});
// открыть devtools по F12
window.addEventListener("keydown", (e) => {
  if (e.key === "F12" && window.overlayAPI && window.overlayAPI.openDevTools)
    window.overlayAPI.openDevTools();
});
