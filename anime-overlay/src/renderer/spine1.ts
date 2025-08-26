// @ts-nocheck
import * as PIXI from "pixi.js";

// Типы для динамической загрузки Spine
type SpineModule = typeof import("@pixi-spine/all-4.1");
type SpineInstance = SpineModule["Spine"];

class SpinePort {
  private app: PIXI.Application;
  private holder!: PIXI.Container;
  private spineboy: SpineInstance | null = null;

  // --- Все ваши свойства из оригинального класса ---
  private headBone: any | null = null;
  private lookTargetBone: any | null = null;
  private pointerPos = new PIXI.Point();
  private headBaseRotationDeg = 0;
  private baseMaxTurnDeg = 120;
  private maxTurnScale = 1;
  private chainLength = 1;
  private aimAxisOffsetDeg = -90;
  private nikkeModelKey: string | null = null;
  private nikkePathParts: string[] | null = null;
  private static readonly NIKKE_BASE = "https://nikke-db-legacy.pages.dev/l2d/";
  private static readonly DOTGG_BASE = "https://dotgg.gg/nikke/l2d/";
  private loadToken = 0;
  private isOffsetCalibrated = false;
  private candidateOffsets = [-135, -90, -45, 0, 45, 90, 135, 180, -180];
  private baseRotationByBone: Record<string, number> = {};
  private parentMaxRangeDeg = 15;
  private headBaseLocalX = 0;
  private headBaseLocalY = 0;
  private targetBaseRadius = 40;
  private parallaxMaxOffset = 12;
  private parallaxScale = 1;
  private parallaxSmoothX = 0;
  private parallaxSmoothY = 0;
  private parallaxInitialized = false;
  private parallaxLagSeconds = 0.25;
  private rotationLagSeconds = 0.25;
  private headBendScale = 1;
  private headShearMaxXDeg = 8;
  private headShearMaxYDeg = 4;
  private cameraZoom = 0.3;
  private userAdjustedZoom = false;
  private lookTargetBaseX = 0;
  private lookTargetBaseY = 0;
  private parallaxNeutralRadius = 20;
  private eyeBones: any[] = [];
  private eyeBasePosByName: Record<string, { x: number; y: number }> = {};
  private eyeParallaxScale = 2;
  private eyeParallaxMaxX = 6;
  private eyeParallaxMaxY = 4;
  private rotationEasing:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "smoothstep" = "ease-out";
  private isDraggingSpine = false;
  private dragSpineOffsetX = 0;
  private dragSpineOffsetY = 0;
  private currentIdleAnimation: string = "idle";
  private isAimModel: boolean = false;
  private aimXEntry: any = null;
  private aimYEntry: any = null;
  private latestCaret: { x: number; y: number; isScreen?: boolean } | null =
    null;
  private testAimToCursor: boolean = false;
  private isUiHidden: boolean = false;
  private uiToggleButton: HTMLElement | null = null;
  private debugDot: HTMLElement | null = null;
  private debugLogging: boolean = true;
  private currentRepo: "nikke" | "nikkie4" = "nikke";
  private n4ExpandedCharacter: string | null = null;
  private actionTimeout: any = null;
  private actionPlaying: boolean = false;
  private nikkeIndexCache: any = null;
  private nikkie4IndexCache: any = null;

  constructor() {
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      resizeTo: window,
      backgroundColor: 0x000000,
      backgroundAlpha: 0.0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    document.body.appendChild(this.app.view as HTMLCanvasElement);
    this.init();
  }

  private async init() {
    this.holder = new PIXI.Container();
    this.app.stage.addChild(this.holder);
    this.centerHolder();

    const bodyEl = document.body as HTMLBodyElement;
    bodyEl.style.margin = "0";
    bodyEl.style.overflow = "hidden";
    (this.app.view as HTMLCanvasElement).style.imageRendering = "auto";

    try {
      this.nikkeIndexCache = await (await fetch("Nikke.json")).json();
      this.nikkie4IndexCache = await (await fetch("nikkie4.1.json")).json();
    } catch (e) {
      console.error("Не удалось загрузить файлы-индексы:", e);
    }

    const params = new URLSearchParams(window.location.search);
    this.nikkeModelKey = params.get("nikke");
    const nikkePath = params.get("nikkePath") || params.get("path");
    this.nikkePathParts = nikkePath
      ? nikkePath
          .split("/")
          .map((p) => p.trim())
          .filter((p) => !!p)
      : null;

    if (
      this.nikkeIndexCache &&
      this.nikkePathParts &&
      this.nikkePathParts.length
    ) {
      this.tryLoadModelForPath(this.nikkePathParts);
    } else {
      console.log("Путь к модели не указан, загрузка не будет произведена.");
    }

    this.setupEventListeners();

    this.renderNikkeBrowser();
    this.renderHeadControls();
    this.addUiToggleButton();

    this.app.ticker.add(() => this.update());
  }

  private setupEventListeners() {
    window.addEventListener("resize", () => this.centerHolder());

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
      this.pointerPos.copyFrom(e.global);
    });
    this.app.stage.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
      this.pointerPos.copyFrom(e.global);
    });

    this.testAimToCursor = true;
    window.addEventListener("mousemove", (ev: MouseEvent) => {
      if (!this.isAimModel) return;
      this.latestCaret = { x: ev.screenX, y: ev.screenY, isScreen: true };
    });

    window.addEventListener("keydown", (e) => {
      if (!this.spineboy || !this.isAimModel) return;
      try {
        this.spineboy.state.setAnimation(1, "aim_fire", false);
        this.spineboy.state.addAnimation(1, this.currentIdleAnimation, true, 0);
      } catch (err) {
        /* ignore */
      }
    });
  }

  private update() {
    if (!this.spineboy) return;

    if (this.isAimModel) {
      this.updateAimTracksFromCaret();
    } else {
      this.headAndEyeTracking();
    }
  }

  private centerHolder() {
    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
    this.fitContentToViewport();
  }

  // =========================================================================
  // ЗАГРУЗКА И УПРАВЛЕНИЕ МОДЕЛЯМИ
  // =========================================================================

  private async loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    scale: number,
    idle: string
  ) {
    if (this.spineboy) {
      this.spineboy.destroy();
      this.spineboy = null;
    }
    if (this.actionTimeout) clearTimeout(this.actionTimeout);
    this.actionPlaying = false;
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;

    const localToken = ++this.loadToken;

    try {
      const spineInstance = await this.loadSpineModelWithAutoVersion(skelUrl);
      if (localToken !== this.loadToken) return;

      this.spineboy = spineInstance;
      this.holder.addChild(this.spineboy);
      this.spineboy.state.setAnimation(0, idle, true);
      this.currentIdleAnimation = idle;

      this.isAimModel = (idle || "").toLowerCase().includes("aim");
      if (this.isAimModel) {
        try {
          const ax = this.spineboy.state.setAnimation(2, "aim_x", true);
          if (ax) ax.timeScale = 0;
          this.aimXEntry = ax;
          const ay = this.spineboy.state.setAnimation(3, "aim_y", true);
          if (ay) ay.timeScale = 0;
          this.aimYEntry = ay;
        } catch (e) {}
      } else {
        if (!idle.toLowerCase().includes("cover")) {
          this.scheduleNextAction();
        }
      }

      this.setupHeadAndPointer();
      this.setupSpineboyDrag();
      this.fitContentToViewport();
    } catch (error) {
      console.error(
        "Ошибка при загрузке модели:",
        { skelUrl, atlasUrl },
        error
      );
    }
  }

  private async loadSpineModelWithAutoVersion(
    skelOrJsonUrl: string
  ): Promise<SpineInstance> {
    const jsonUrl = skelOrJsonUrl.replace(/\.skel$/, ".json");

    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error(`Файл модели не найден: ${jsonUrl}`);
    const spineJsonData = await response.json();

    const spineVersion = spineJsonData?.skeleton?.spine;
    if (!spineVersion)
      throw new Error("Не удалось определить версию Spine в файле.");

    let SpinePlugin: SpineModule;
    if (spineVersion.startsWith("4.1")) {
      SpinePlugin = await import("@pixi-spine/all-4.1");
    } else if (spineVersion.startsWith("4.0")) {
      SpinePlugin = await import("@pixi-spine/all-4.0");
    } else {
      throw new Error(`Версия Spine "${spineVersion}" не поддерживается.`);
    }

    const atlasUrl = jsonUrl.replace(/\.json$/, ".atlas");
    const asset = await PIXI.Assets.load({
      src: jsonUrl,
      data: { spineAtlas: atlasUrl },
    });

    return new SpinePlugin.Spine(asset.spineData);
  }

  private tryLoadModelForPath(parts: string[]) {
    try {
      if (this.currentRepo === "nikkie4" || (parts && parts[0] === "dotgg")) {
        const realParts = parts[0] === "dotgg" ? parts.slice(1) : parts;
        const skin = realParts.join("/");
        if (!skin) return;
        const skelUrl = SpinePort.DOTGG_BASE + skin + ".skel";
        const atlasUrl = skelUrl.replace(".skel", ".atlas");
        const idleAnim = skelUrl.includes("aim")
          ? "aim_idle"
          : skelUrl.includes("cover")
          ? "cover_idle"
          : "idle";
        this.loadModelFromUrls(skelUrl, atlasUrl, 1, idleAnim);
        return;
      }
    } catch (e) {}

    const indexData = this.nikkeIndexCache;
    if (!indexData) return;
    const node = this.resolveNodeByPath(indexData, parts);
    const picked = node ? this.pickModelFromNode(node, parts) : null;
    if (!picked) return;
    const idleAnim = picked.skelUrl.includes("aim")
      ? "aim_idle"
      : picked.skelUrl.includes("cover")
      ? "cover_idle"
      : "idle";
    this.loadModelFromUrls(picked.skelUrl, picked.atlasUrl, 1, idleAnim);
  }

  // =========================================================================
  // ЛОГИКА ОТСЛЕЖИВАНИЯ КУРСОРА И ПРИЦЕЛИВАНИЯ
  // =========================================================================

  private headAndEyeTracking() {
    if (!this.spineboy || !this.spineboy.skeleton) return;
    if (!this.headBone) return; // Не выполнять, если нет кости головы

    const skeleton = this.spineboy.skeleton;
    const localPointerPos = this.spineboy.toLocal(this.pointerPos);

    // --- Логика для lookTargetBone ---
    if (
      this.lookTargetBone &&
      this.lookTargetBone.parent &&
      this.lookTargetBone.parent.worldToLocal
    ) {
      const pos = new PIXI.Point();
      this.lookTargetBone.parent.worldToLocal(
        localPointerPos.x,
        localPointerPos.y,
        pos,
        skeleton
      );

      let dx = pos.x - this.lookTargetBaseX;
      let dy = pos.y - this.lookTargetBaseY;
      const r0 = Math.hypot(dx, dy);

      if (r0 <= this.parallaxNeutralRadius) {
        dx = 0;
        dy = 0;
      } else if (r0 > 0) {
        const k0 = (r0 - this.parallaxNeutralRadius) / r0;
        dx *= k0;
        dy *= k0;
      }

      let desX = this.lookTargetBaseX + dx * this.parallaxScale;
      let desY = this.lookTargetBaseY + dy * this.parallaxScale;
      const rMax = this.targetBaseRadius * this.parallaxScale;
      const r = Math.hypot(
        desX - this.lookTargetBaseX,
        desY - this.lookTargetBaseY
      );

      if (r > rMax && r > 0) {
        const k = rMax / r;
        desX = this.lookTargetBaseX + (desX - this.lookTargetBaseX) * k;
        desY = this.lookTargetBaseY + (desY - this.lookTargetBaseY) * k;
      }

      if (!this.parallaxInitialized) {
        this.parallaxSmoothX = this.lookTargetBone.x;
        this.parallaxSmoothY = this.lookTargetBone.y;
        this.parallaxInitialized = true;
      }

      const dt = this.app.ticker.deltaMS / 1000;
      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-dt / tau);
      this.parallaxSmoothX += (desX - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (desY - this.parallaxSmoothY) * alpha;
      this.lookTargetBone.x = this.parallaxSmoothX;
      this.lookTargetBone.y = this.parallaxSmoothY;
    }

    // --- Логика вращения головы ---
    const head = this.headBone as any;
    const dx = localPointerPos.x - head.worldX;
    const dy = localPointerPos.y - head.worldY;
    if (dx * dx + dy * dy < 0.0001) return;

    let angleDegBase = (Math.atan2(dy, dx) * 180) / Math.PI;

    if (!this.isOffsetCalibrated) {
      // Ваша логика автокалибровки
      let bestOffset = this.aimAxisOffsetDeg;
      let bestAbsDelta = Number.POSITIVE_INFINITY;
      for (const off of this.candidateOffsets) {
        const testDeg = angleDegBase + off;
        const desiredLocalTest = head.worldToLocalRotation(testDeg);
        const d = this.shortestDeltaDeg(head.rotation, desiredLocalTest);
        if (Math.abs(d) < bestAbsDelta) {
          bestAbsDelta = Math.abs(d);
          bestOffset = off;
        }
      }
      this.aimAxisOffsetDeg = bestOffset;
      this.isOffsetCalibrated = true;
    }

    const angleDeg = angleDegBase + this.aimAxisOffsetDeg;
    let desiredLocal = head.worldToLocalRotation(angleDeg);

    const offsetFromBase = desiredLocal - this.headBaseRotationDeg;
    desiredLocal =
      this.headBaseRotationDeg + offsetFromBase * this.maxTurnScale;
    const maxTurn = this.baseMaxTurnDeg * this.maxTurnScale;
    desiredLocal = PIXI.utils.clamp(
      desiredLocal,
      this.headBaseRotationDeg - maxTurn,
      this.headBaseRotationDeg + maxTurn
    );

    const delta = this.shortestDeltaDeg(head.rotation, desiredLocal);
    const dtRot = this.app.ticker.deltaMS / 1000;
    const tauRot = Math.max(0.001, this.rotationLagSeconds);
    let alphaRot = 1 - Math.exp(-dtRot / tauRot);
    alphaRot = this.applyRotationEasing(alphaRot, this.rotationEasing);
    const stepBase = delta * alphaRot;

    const bones: any[] = [];
    let node: any = head;
    for (let i = 0; i < Math.max(1, this.chainLength) && node; i++) {
      bones.push(node);
      node = node.parent;
    }

    const fall = 0.7;
    const weights = bones.map((_, i) => Math.pow(fall, i));
    const sum = weights.reduce((a, b) => a + b, 0);

    if (sum > 0) {
      for (let i = 0; i < bones.length; i++) {
        const bone = bones[i];
        const add = stepBase * (weights[i] / sum);
        let proposed = bone.rotation + add;
        if (i === 0) {
          bone.rotation = PIXI.utils.clamp(
            proposed,
            this.headBaseRotationDeg - maxTurn,
            this.headBaseRotationDeg + maxTurn
          );
        } else {
          const name = bone.data?.name || bone.name;
          const base = this.baseRotationByBone[name] ?? bone.rotation;
          const range = this.parentMaxRangeDeg * this.maxTurnScale;
          bone.rotation = PIXI.utils.clamp(
            proposed,
            base - range,
            base + range
          );
        }
      }
    }

    // --- Логика изгиба головы (Shear) ---
    if (head.parent && head.parent.worldToLocal) {
      const locHead = new PIXI.Point();
      head.parent.worldToLocal(
        localPointerPos.x,
        localPointerPos.y,
        locHead,
        skeleton
      );
      const dxh = (locHead.x - this.headBaseLocalX) * this.parallaxScale;
      const dyh = (locHead.y - this.headBaseLocalY) * this.parallaxScale;
      const dMaxShear = this.parallaxMaxOffset * this.parallaxScale;
      const nx = PIXI.utils.clamp(dxh / dMaxShear, -1, 1);
      const ny = PIXI.utils.clamp(dyh / dMaxShear, -1, 1);
      const targetShearX = nx * this.headShearMaxXDeg * this.headBendScale;
      const targetShearY = ny * this.headShearMaxYDeg * this.headBendScale;

      const dtShear = this.app.ticker.deltaMS / 1000;
      const tauShear = Math.max(0.001, this.parallaxLagSeconds);
      const alphaShear = 1 - Math.exp(-dtShear / tauShear);
      head.shearX += (targetShearX - head.shearX) * alphaShear;
      head.shearY += (targetShearY - head.shearY) * alphaShear;
    }

    // --- Логика параллакса глаз ---
    if (this.eyeBones.length) {
      const dtEye = this.app.ticker.deltaMS / 1000;
      const tauEye = Math.max(0.001, this.parallaxLagSeconds);
      const alphaEye = 1 - Math.exp(-dtEye / tauEye);
      for (const eye of this.eyeBones) {
        const name = eye.data?.name || eye.name;
        const base = this.eyeBasePosByName[name] || { x: eye.x, y: eye.y };
        if (eye.parent && eye.parent.worldToLocal) {
          const loc = new PIXI.Point();
          eye.parent.worldToLocal(
            localPointerPos.x,
            localPointerPos.y,
            loc,
            skeleton
          );
          let tx = base.x + (loc.x - base.x) * this.eyeParallaxScale;
          let ty = base.y + (loc.y - base.y) * this.eyeParallaxScale;

          // Эллиптическое ограничение
          const dx = tx - base.x;
          const dy = ty - base.y;
          const a = this.eyeParallaxMaxX * this.eyeParallaxScale;
          const b = this.eyeParallaxMaxY * this.eyeParallaxScale;
          if (a > 0 && b > 0) {
            const s = (dx * dx) / (a * a) + (dy * dy) / (b * b);
            if (s > 1) {
              const k = 1 / Math.sqrt(s);
              tx = base.x + dx * k;
              ty = base.y + dy * k;
            }
          }
          eye.x += (tx - eye.x) * alphaEye;
          eye.y += (ty - eye.y) * alphaEye;
        }
      }
    }

    // Обновляем трансформации после всех манипуляций
    skeleton.updateWorldTransform();
  }

  private updateAimTracksFromCaret() {
    if (!this.spineboy || !this.isAimModel || !this.latestCaret) return;

    let tx = 0.5,
      ty = 0.5;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const centerX = vw / 2,
      centerY = vh / 2;

    let clientPageX: number | null = null,
      clientPageY: number | null = null;
    if (this.latestCaret) {
      clientPageX = this.latestCaret.isScreen
        ? this.latestCaret.x - window.screenX
        : this.latestCaret.x;
      clientPageY = this.latestCaret.isScreen
        ? this.latestCaret.y - window.screenY
        : this.latestCaret.y;
    }

    if (clientPageX != null && clientPageY != null) {
      const nx = PIXI.utils.clamp(
        (clientPageX - centerX) / (centerX || 1),
        -1,
        1
      );
      const ny = PIXI.utils.clamp(
        -(clientPageY - centerY) / (centerY || 1),
        -1,
        1
      );
      tx = PIXI.utils.clamp(0.5 + nx * 0.5, 0, 1);
      ty = PIXI.utils.clamp(0.5 + ny * 0.5, 0, 1);
    }

    try {
      if (this.aimXEntry?.animation)
        this.aimXEntry.trackTime = tx * this.aimXEntry.animation.duration;
      if (this.aimYEntry?.animation)
        this.aimYEntry.trackTime = ty * this.aimYEntry.animation.duration;
    } catch {}
  }

  // =========================================================================
  // ИНТЕРАКТИВНОСТЬ И ХЕЛПЕРЫ
  // =========================================================================

  private setupSpineboyDrag() {
    if (!this.spineboy) return;
    this.spineboy.eventMode = "static";
    this.spineboy.cursor = "grab";

    const onDragStart = (event: PIXI.FederatedPointerEvent) => {
      this.isDraggingSpine = true;
      this.spineboy!.cursor = "grabbing";
      const localPos = this.holder.toLocal(event.global);
      this.dragSpineOffsetX = this.spineboy!.x - localPos.x;
      this.dragSpineOffsetY = this.spineboy!.y - localPos.y;
      this.app.stage.on("pointermove", onDragMove);
      this.app.stage.on("pointerup", onDragEnd);
      this.app.stage.on("pointerupoutside", onDragEnd);
    };

    const onDragMove = (event: PIXI.FederatedPointerEvent) => {
      if (this.isDraggingSpine) {
        const localPos = this.holder.toLocal(event.global);
        this.spineboy!.x = localPos.x + this.dragSpineOffsetX;
        this.spineboy!.y = localPos.y + this.dragSpineOffsetY;
      }
    };

    const onDragEnd = () => {
      this.isDraggingSpine = false;
      if (this.spineboy) this.spineboy.cursor = "grab";
      this.app.stage.off("pointermove", onDragMove);
      this.app.stage.off("pointerup", onDragEnd);
      this.app.stage.off("pointerupoutside", onDragEnd);
    };

    this.spineboy.on("pointerdown", onDragStart);
  }

  private setupHeadAndPointer() {
    if (!this.spineboy) return;
    const skeleton = this.spineboy.skeleton;
    if (!skeleton) return;

    const nameMatches = (n: string) =>
      /head|голов|голова|headbone|neck|nec|skull/i.test(n);
    this.headBone =
      skeleton.findBone("head") ||
      skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name)) ||
      null;
    if (this.headBone) this.headBaseRotationDeg = this.headBone.rotation || 0;

    this.baseRotationByBone = {};
    let node: any = this.headBone;
    for (let i = 0; i < 12 && node; i++) {
      const n = node.data?.name || node.name || String(i);
      this.baseRotationByBone[n] = node.rotation || 0;
      node = node.parent;
    }

    if (this.headBone) {
      this.headBaseLocalX = this.headBone.x || 0;
      this.headBaseLocalY = this.headBone.y || 0;
    }
    this.parallaxInitialized = false;

    this.eyeBones = [];
    this.eyeBasePosByName = {};
    const looksLikeEye = (n: string) =>
      /eye/i.test(n) && !/(lash|brow|lid)/i.test(n);
    for (const b of skeleton.bones || []) {
      const nm = (b.data?.name || b.name || "").toString();
      if (looksLikeEye(nm)) {
        this.eyeBones.push(b);
        this.eyeBasePosByName[nm] = { x: b.x || 0, y: b.y || 0 };
      }
    }

    const targetNames = [
      "crosshair",
      "look",
      "look_target",
      "head_target",
      "eye_target",
    ];
    this.lookTargetBone = null;
    for (const n of targetNames) {
      const b = skeleton.findBone(n);
      if (b) {
        this.lookTargetBone = b;
        break;
      }
    }

    if (this.lookTargetBone) {
      this.lookTargetBaseX = this.lookTargetBone.x || 0;
      this.lookTargetBaseY = this.lookTargetBone.y || 0;
    }
  }

  private fitContentToViewport() {
    if (!this.spineboy) return;

    const bounds = this.spineboy.getBounds();
    const contentW = bounds.width / this.spineboy.scale.x; // Учитываем масштаб
    const contentH = bounds.height / this.spineboy.scale.y;

    if (!contentW || !contentH) return;

    const viewW = this.app.screen.width;
    const viewH = this.app.screen.height;
    const padding = 0.9;
    const zoomX = (viewW * padding) / contentW;
    const zoomY = (viewH * padding) / contentH;
    const fitZoom = Math.max(0.01, Math.min(zoomX, zoomY));

    if (!this.userAdjustedZoom) {
      this.cameraZoom = fitZoom;
      const zoomInput = document.querySelector(
        "#head-controls input[data-control=zoom]"
      ) as HTMLInputElement;
      if (zoomInput) {
        zoomInput.value = String(this.cameraZoom);
        const zoomLabel = zoomInput.previousElementSibling as HTMLLabelElement;
        if (zoomLabel)
          zoomLabel.textContent = `Zoom: ${this.cameraZoom.toFixed(2)}`;
      }
    }
    this.holder.scale.set(this.cameraZoom);
  }

  private scheduleNextAction() {
    if (this.actionTimeout) clearTimeout(this.actionTimeout);
    const delay = 6000 + Math.floor(Math.random() * 19000);
    this.actionTimeout = setTimeout(() => this.playActionOnce(), delay);
  }

  private playActionOnce() {
    if (!this.spineboy || this.actionPlaying) return;
    const state = this.spineboy.state;
    try {
      const entry = state.setAnimation(2, "action", false);
      this.actionPlaying = true;
      entry.listener = {
        complete: () => {
          this.actionPlaying = false;
          this.scheduleNextAction();
        },
      };
    } catch (e) {
      this.scheduleNextAction();
    }
  }

  private shortestDeltaDeg(from: number, to: number) {
    let delta = ((to - from + 180) % 360) - 180;
    if (delta < -180) delta += 360;
    return delta;
  }

  private applyRotationEasing(
    x: number,
    mode: typeof this.rotationEasing
  ): number {
    const t = PIXI.utils.clamp(x, 0, 1);
    switch (mode) {
      case "linear":
        return t;
      case "ease-in":
        return t * t;
      case "ease-out":
        return t * (2 - t);
      case "ease-in-out":
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "smoothstep":
        return t * t * (3 - 2 * t);
      default:
        return t;
    }
  }

  // =========================================================================
  // UI (DOM-ЭЛЕМЕНТЫ) - КОПИРУЮТСЯ БЕЗ ИЗМЕНЕНИЙ
  // =========================================================================

  private addUiToggleButton() {
    try {
      const btn = document.createElement("button");
      btn.id = "overlay-ui-toggle";
      btn.textContent = "Hide UI";
      Object.assign(btn.style, {
        position: "absolute",
        left: "12px",
        bottom: "12px",
        zIndex: "100000",
        padding: "12px 18px",
        fontSize: "16px",
        minWidth: "140px",
        height: "48px",
        background: "rgba(0,0,0,0.7)",
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        cursor: "pointer",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
      });
      btn.onclick = () => {
        this.isUiHidden = !this.isUiHidden;
        const controls = document.getElementById("head-controls");
        const browser = document.getElementById("nikke-browser");
        if (this.isUiHidden) {
          btn.textContent = "Show UI";
          if (controls) controls.style.display = "none";
          if (browser) browser.style.display = "none";
        } else {
          btn.textContent = "Hide UI";
          if (controls) controls.style.display = "block";
          if (browser) browser.style.display = "block";
        }
      };
      document.body.appendChild(btn);
      this.uiToggleButton = btn;
    } catch {}
  }

  private renderNikkeBrowser() {
    const existing = document.getElementById("nikke-browser");
    if (existing) existing.remove();
    const container = document.createElement("div");
    container.id = "nikke-browser";
    // Стили можно добавить здесь, если нужно

    const repoWrap = document.createElement("div");
    repoWrap.style.marginBottom = "8px";
    const sel = document.createElement("select");
    sel.innerHTML = `<option value="nikke">Nikke.json</option><option value="nikkie4">nikkie4.1.json</option>`;
    sel.value = this.currentRepo;
    sel.onchange = () => {
      this.currentRepo = sel.value as any;
      this.nikkePathParts = null;
      this.n4ExpandedCharacter = null;
      this.renderNikkeBrowser();
    };
    repoWrap.appendChild(sel);
    container.appendChild(repoWrap);

    const list = document.createElement("div");
    list.className = "nikke-file-list";

    if (this.currentRepo === "nikke") {
      const indexData = this.nikkeIndexCache;
      if (!indexData) {
        list.textContent = "Nikke index not loaded";
      } else {
        const node = this.nikkePathParts?.length
          ? this.resolveNodeByPath(indexData, this.nikkePathParts)
          : indexData;
        const crumbs = document.createElement("div");
        crumbs.className = "nikke-breadcrumbs";
        const rootCrumb = document.createElement("a");
        rootCrumb.textContent = "/";
        rootCrumb.onclick = (e) => {
          e.preventDefault();
          this.navigateToPath([]);
        };
        crumbs.appendChild(rootCrumb);
        (this.nikkePathParts || []).forEach((part, idx) => {
          crumbs.appendChild(document.createTextNode(" / "));
          const c = document.createElement("a");
          c.textContent = part;
          c.onclick = (e) => {
            e.preventDefault();
            this.navigateToPath((this.nikkePathParts || []).slice(0, idx + 1));
          };
          crumbs.appendChild(c);
        });
        list.appendChild(crumbs);

        if (node?.children) {
          for (const child of node.children) {
            const row = document.createElement("div");
            row.textContent = `📁 ${child.name}`;
            row.onclick = () =>
              this.navigateToPath([...(this.nikkePathParts || []), child.name]);
            list.appendChild(row);
          }
        }
        if (
          node?.files?.some(
            (f: string) => f.endsWith(".skel") || f.endsWith(".atlas")
          )
        ) {
          const loadBtn = document.createElement("button");
          loadBtn.textContent = "Загрузить модель из этой папки";
          loadBtn.onclick = () =>
            this.tryLoadModelForPath(this.nikkePathParts || []);
          list.appendChild(loadBtn);
        }
      }
    } else {
      const n4 = this.nikkie4IndexCache;
      if (!n4) {
        list.textContent = "nikkie4 index not loaded";
      } else {
        const src = Array.isArray(n4)
          ? n4.find((x) => x?.skins) || { skins: [] }
          : n4 || { skins: [] };
        for (const ch of src.skins || []) {
          const row = document.createElement("div");
          row.textContent = `👤 ${ch.name}`;
          const skinContainer = document.createElement("div");
          skinContainer.style.display =
            this.n4ExpandedCharacter === ch.name ? "block" : "none";
          skinContainer.style.paddingLeft = "20px";

          for (const s of ch.skins || []) {
            const skinRow = document.createElement("div");
            skinRow.textContent = `📁 ${s.name} (${s.skin})`;
            skinRow.onclick = (e) => {
              e.stopPropagation();
              this.navigateToPath(["dotgg", ch.name, s.skin]);
            };
            skinContainer.appendChild(skinRow);
          }

          row.onclick = () => {
            const open = skinContainer.style.display === "block";
            skinContainer.style.display = open ? "none" : "block";
            this.n4ExpandedCharacter = open ? null : ch.name;
          };
          list.appendChild(row);
          list.appendChild(skinContainer);
        }
      }
    }

    container.appendChild(list);
    document.body.appendChild(container);

    // Применяем стили (CSS-in-JS для простоты)
    const style = document.createElement("style");
    style.textContent = `
            #nikke-browser { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #fff; padding: 10px; font-family: monospace; border-radius: 6px; z-index: 1000; min-width: 250px; max-height: 80vh; overflow-y: auto; }
            #nikke-browser a { color: #8bf; text-decoration: none; cursor: pointer; }
            #nikke-browser a:hover { text-decoration: underline; }
            .nikke-file-list > div { padding: 4px; cursor: pointer; border-radius: 3px; }
            .nikke-file-list > div:hover { background: rgba(255,255,255,0.1); }
            .nikke-breadcrumbs { margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #555; }
            #nikke-browser button { background: #3a3; border: none; color: white; padding: 8px; margin-top: 10px; border-radius: 4px; cursor: pointer; }
        `;
    document.head.appendChild(style);
  }

  private renderHeadControls() {
    const existing = document.getElementById("head-controls");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "head-controls";
    Object.assign(wrap.style, {
      position: "absolute",
      transformOrigin: "top right",
      transform: "scale(1)",
      top: "8px",
      right: "8px",
      background: "rgba(0,0,0,0.6)",
      color: "#fff",
      padding: "8px",
      font: "12px/1.4 monospace",
      borderRadius: "6px",
      zIndex: "1000",
      minWidth: "200px",
    });

    wrap.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px;">Head Controls</div>
        `;

    const createSlider = (
      label: string,
      min: string,
      max: string,
      step: string,
      value: number,
      controlName: string,
      onInput: (val: number) => void
    ) => {
      const id = `slider-${controlName}`;
      const labelEl = document.createElement("label");
      labelEl.htmlFor = id;
      labelEl.textContent = `${label}: ${value.toFixed(2)}`;
      labelEl.style.display = "block";
      labelEl.style.margin = "8px 0 2px";

      const inputEl = document.createElement("input");
      inputEl.type = "range";
      inputEl.id = id;
      inputEl.min = min;
      inputEl.max = max;
      inputEl.step = step;
      inputEl.value = String(value);
      inputEl.dataset.control = controlName;
      inputEl.style.width = "180px";
      inputEl.addEventListener("input", () => {
        const val = parseFloat(inputEl.value);
        onInput(val);
        labelEl.textContent = `${label}: ${val.toFixed(2)}`;
      });

      wrap.appendChild(labelEl);
      wrap.appendChild(inputEl);
    };

    createSlider(
      "Nodes from head",
      "1",
      "5",
      "1",
      this.chainLength,
      "chainLength",
      (v) => (this.chainLength = v)
    );
    createSlider(
      "Rotation scale",
      "0",
      "2",
      "0.05",
      this.maxTurnScale,
      "maxTurnScale",
      (v) => (this.maxTurnScale = v)
    );
    createSlider(
      "Parallax scale",
      "0",
      "10",
      "0.05",
      this.parallaxScale,
      "parallaxScale",
      (v) => (this.parallaxScale = v)
    );
    createSlider(
      "Bend scale",
      "0",
      "2",
      "0.05",
      this.headBendScale,
      "headBendScale",
      (v) => (this.headBendScale = v)
    );
    createSlider(
      "Eye parallax",
      "0",
      "10",
      "0.1",
      this.eyeParallaxScale,
      "eyeParallaxScale",
      (v) => (this.eyeParallaxScale = v)
    );

    // Sliders for time require a different label update
    const createTimeSlider = (
      label: string,
      min: string,
      max: string,
      step: string,
      valueSec: number,
      onInput: (sec: number) => void
    ) => {
      const labelEl = document.createElement("label");
      labelEl.textContent = `${label}: ${(valueSec * 1000).toFixed(0)} ms`;
      labelEl.style.display = "block";
      labelEl.style.margin = "8px 0 2px";

      const inputEl = document.createElement("input");
      inputEl.type = "range";
      inputEl.min = min;
      inputEl.max = max;
      inputEl.step = step;
      inputEl.value = String(valueSec * 1000);
      inputEl.style.width = "180px";
      inputEl.addEventListener("input", () => {
        const ms = parseInt(inputEl.value);
        onInput(ms / 1000);
        labelEl.textContent = `${label}: ${ms} ms`;
      });
      wrap.appendChild(labelEl);
      wrap.appendChild(inputEl);
    };

    createTimeSlider(
      "Parallax time",
      "50",
      "1000",
      "10",
      this.parallaxLagSeconds,
      (v) => (this.parallaxLagSeconds = v)
    );
    createTimeSlider(
      "Rotation time",
      "50",
      "1000",
      "10",
      this.rotationLagSeconds,
      (v) => (this.rotationLagSeconds = v)
    );

    // Zoom slider
    createSlider("Zoom", "0.1", "3", "0.05", this.cameraZoom, "zoom", (v) => {
      this.cameraZoom = v;
      this.userAdjustedZoom = true;
      this.holder.scale.set(this.cameraZoom);
    });

    document.body.appendChild(wrap);
  }

  private navigateToPath(parts: string[]) {
    this.nikkePathParts = parts;
    const params = new URLSearchParams(window.location.search);
    if (parts.length) params.set("nikkePath", parts.join("/"));
    else params.delete("nikkePath");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);

    this.renderNikkeBrowser();
    this.tryLoadModelForPath(parts);
  }

  private resolveNodeByPath(indexRoot: any, parts: string[]): any {
    const cleanedParts =
      parts && parts.length && parts[0] === "dotgg"
        ? parts.slice(1)
        : parts || [];
    const lower = cleanedParts.map((p) => p.toLowerCase());
    let node = indexRoot;
    for (const part of lower) {
      const next = (node.children || []).find(
        (c: any) => (c.name || "").toLowerCase() === part
      );
      if (!next) return null;
      node = next;
    }
    return node;
  }

  private pickModelFromNode(
    node: any,
    pathParts: string[]
  ): { atlasUrl: string; skelUrl: string } | null {
    const files: string[] = node.files || [];
    if (!files.length) return null;
    let base =
      SpinePort.NIKKE_BASE + (pathParts ? pathParts.join("/") + "/" : "");
    const pick = (ext: string) => {
      const candidates = files.filter((f) => f.toLowerCase().endsWith(ext));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.length - b.length);
      return base + candidates[0];
    };
    const atlasUrl = pick(".atlas");
    const skelUrl = pick(".skel");
    if (!atlasUrl || !skelUrl) return null;
    return { atlasUrl, skelUrl };
  }
}

// Запуск приложения
new SpinePort();
