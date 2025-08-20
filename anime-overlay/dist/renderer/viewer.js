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

  // src/renderer/viewer.ts
  var __loadedRuntime = null;
  var __live2d_patches_installed = false;
  async function loadScript(src) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => res();
      s.onerror = (ev) => rej(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }
  function getAlternativeURL(u) {
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
              if (!(e && e.status === 403 && typeof url === "string" && url.includes("jsdelivr"))) {
                throw e;
              }
              console.warn(
                "[viewer] 403 from jsDelivr, switching to alternative URL"
              );
            }
            try {
              context.url = getAlternativeURL(url);
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
      await loadScript(
        "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"
      );
    }
    if (!window.__live2d_api_c4) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js"
      );
      try {
        window.__live2d_api_c4 = PIXI.live2d;
        __loadedRuntime = "c4";
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
      await loadScript(
        "https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"
      );
    }
    if (!window.__live2d_api_c2) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism2.min.js"
      );
      try {
        window.__live2d_api_c2 = PIXI.live2d;
        __loadedRuntime = "c2";
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
  function detectRuntimeByUrl(u) {
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
    const byExt = detectRuntimeByUrl(url);
    try {
      console.debug("[viewer] loadSettingsJson", { url, forceV4, byExt });
    } catch {
    }
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
        try {
          console.debug("[viewer] decided Cubism4 for", url);
        } catch {
        }
        return { urlOrSettings: cloned, useV4, originalUrl: url, groups };
      }
      useV4 = false;
      try {
        console.debug("[viewer] decided Cubism2 for", url);
      } catch {
      }
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
  async function loadModel(app, url, forceV4) {
    const stageDiv = document.getElementById("stage");
    try {
      await clearPixiCaches();
      if (window.__live2d_model) {
        try {
          app.stage.removeChild(window.__live2d_model);
          window.__live2d_model.destroy?.(true);
        } catch {
        }
      }
      window.__live2d_model = void 0;
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
    let model = null;
    const ns = useV4 ? window.__live2d_api_c4 || PIXI.live2d : window.__live2d_api_c2 || PIXI.live2d;
    const prevLive2d = PIXI.live2d;
    PIXI.live2d = ns;
    try {
      model = await PIXI.live2d.Live2DModel.from(urlOrSettings, {
        motionPreload: "none"
      });
    } catch {
      try {
        model = await PIXI.live2d.Live2DModel.from(urlOrSettings);
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
            model = await PIXI.live2d.Live2DModel.from(cloned);
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
      stageDiv.dataset.modelUrl = originalUrl;
    } catch {
    }
    try {
      window.__live2d_model = model;
    } catch {
    }
    try {
      model.anchor && model.anchor.set(0.5, 0.5);
    } catch {
    }
    app.stage.addChild(model);
    const fitModel = () => {
      if (!model) return;
      model.x = app.renderer.width / 2;
      model.y = app.renderer.height / 2;
      try {
        const b = model.getBounds();
        const scale = Math.min(
          0.9,
          app.renderer.width * 0.9 / Math.max(1, b.width),
          app.renderer.height * 0.9 / Math.max(1, b.height)
        );
        if (isFinite(scale) && scale > 0) model.scale.set(scale);
      } catch {
      }
    };
    fitModel();
    return { model, groups, fitModel };
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
    const app = new PIXI.Application({
      transparent: true,
      width: 360,
      height: 420
    });
    stageDiv.appendChild(app.view);
    const onResize = () => {
      try {
        const w = stageDiv.clientWidth || 360;
        const h = stageDiv.clientHeight || 420;
        app.renderer.resize(w, h);
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
    async function resolveModelUrl(repoPath) {
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
      const modelUrl2 = await resolveModelUrl(repoMocPath);
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
        absTextures.push(await resolveModelUrl((dir ? dir + "/" : "") + t));
      const absPhysics = physicsRel ? await resolveModelUrl((dir ? dir + "/" : "") + physicsRel) : void 0;
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
        await loadModel(app, dataUrl);
        return;
      }
      await loadFile(repoPath);
    }
    async function loadFile(repoPath) {
      const initialUrl = await resolveModelUrl(repoPath);
      try {
        localStorage.setItem(config.LAST_MODEL_KEY, initialUrl);
      } catch {
      }
      try {
        window.overlayAPI?.saveLastModel?.(initialUrl);
      } catch {
      }
      const extFlag = detectRuntimeByUrl(initialUrl);
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
            rewriteModelJsonUrls(selectedUrl, cloned);
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
        if (useV4) await ensureCubism4();
        else await ensureCubism2();
        let last = null;
        const queue = tries.filter(
          (u) => typeof u === "string"
        );
        for (const u of queue) {
          try {
            await loadModel(app, u, extFlag);
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
              await loadModel(app, dataUrl, false);
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
      const byExt = detectRuntimeByUrl(modelUrl);
      await loadModel(app, modelUrl, byExt);
    }
  })();
})();
//# sourceMappingURL=viewer.js.map
