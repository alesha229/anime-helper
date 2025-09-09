import * as PIXI from "pixi.js";

import { ALPHA_MODES } from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

class PixiSpineDemo {
  private app!: PIXI.Application;
  private holder!: PIXI.Container;
  private spineboy!: Spine;
  private headBone: any | null = null;
  private lookTargetBone: any | null = null;
  private pointerPos = new PIXI.Point();
  private headBaseRotationDeg = 0;
  private aimSmoothing = 0.2;
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
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private currentIdleAnimation: string = "idle";
  private isAimModel: boolean = false;
  private aimXEntry: any = null;
  private aimYEntry: any = null;
  private latestCaret: { x: number; y: number; isScreen?: boolean } | null =
    null;
  private testAimToCursor: boolean = false;
  private isUiHidden: boolean = false;
  private clickThroughEnabled: boolean = false;
  private uiToggleButton: HTMLElement | null = null;
  private debugDot: HTMLElement | null = null;
  private debugLogging: boolean = true;
  private currentRepo: "nikke" | "nikkie4" = "nikke";
  private n4ExpandedCharacter: string | null = null;
  private actionTimeout: any = null;
  private actionPlaying: boolean = false;
  private lastFrameTime = 0;

  constructor() {
    this.init();
  }

  private async init() {
    // Initialize PIXI Application
    this.app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: window,
    });

    // Add canvas to DOM
    document.body.appendChild(this.app.view as HTMLCanvasElement);

    // Create main container
    this.holder = new PIXI.Container();
    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
    this.app.stage.addChild(this.holder);

    // Setup viewport and parameters
    await this.preload();
    this.create();

    // Start update loop
    this.app.ticker.add(this.update, this);
  }

  // Добавляем свойства для хранения данных
  private nikkeIndexData: any = null;
  private nikkie4IndexData: any = null;

  private async preload() {
    const params = new URLSearchParams(window.location.search);

    // Setup overlay API if available
    try {
      // (window as any).overlayAPI?.setZoomFactor?.(0.5);
      (window as any).overlayAPI?.enterFullscreen?.();
    } catch {}

    this.nikkeModelKey = params.get("nikke");
    const nikkePath = params.get("nikkePath") || params.get("path");
    this.nikkePathParts = nikkePath
      ? nikkePath
          .split("/")
          .map((p) => p.trim())
          .filter((p) => !!p)
      : null;

    // Load nikke index (древовидная структура)
    try {
      const nikkeResponse = await fetch("./Nikke.json");
      if (nikkeResponse.ok) {
        const nikkeData = await nikkeResponse.json();
        console.log("Loaded Nikke.json:", nikkeData);
        this.nikkeIndexData = nikkeData;
      } else {
        console.warn("Nikke.json not found, using minimal fallback");
        this.nikkeIndexData = { name: "root", children: [], files: [] };
      }
    } catch (e) {
      console.warn("Could not load Nikke.json:", e);
      this.nikkeIndexData = { name: "root", children: [], files: [] };
    }

    // Load nikkie4 index (специальный формат массива)
    try {
      const nikkie4Response = await fetch("./nikkie4.1.json");
      if (nikkie4Response.ok) {
        const rawData = await nikkie4Response.json();
        console.log("Raw nikkie4.1.json:", rawData);

        // Обрабатываем специальный формат nikkie4.1.json
        if (
          Array.isArray(rawData) &&
          rawData.length > 3 &&
          rawData[3] &&
          rawData[3].skins
        ) {
          // Формат: ["$", "$Lb", null, {skins: [...]}]
          this.nikkie4IndexData = rawData[3];
          console.log(
            "Using nikkie4 data from array[3]:",
            this.nikkie4IndexData
          );
        } else if (rawData && rawData.skins) {
          // Обычный формат объекта
          this.nikkie4IndexData = rawData;
          console.log("Using nikkie4 data as object:", this.nikkie4IndexData);
        } else {
          console.warn("Unexpected nikkie4.1.json format, using fallback");
          this.nikkie4IndexData = { skins: [] };
        }
      } else {
        console.warn("nikkie4.1.json not found, using minimal fallback");
        this.nikkie4IndexData = { skins: [] };
      }
    } catch (e) {
      console.warn("Could not load nikkie4.1.json:", e);
      this.nikkie4IndexData = { skins: [] };
    }

    // Add default local model
    PIXI.Assets.add({
      alias: "spineboy-data",
      src: "./assets/favorite_c550_00.skel",
    });

    PIXI.Assets.setPreferences({
      preferCreateImageBitmap: false,
    });
  }

  private create() {
    // Setup full viewport
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    htmlEl.style.height = "100%";
    htmlEl.style.width = "100%";
    bodyEl.style.margin = "0";
    bodyEl.style.padding = "0";
    bodyEl.style.height = "100%";
    bodyEl.style.width = "100%";

    const canvas = this.app.view as HTMLCanvasElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    // Load model based on parameters
    this.loadInitialModel();

    // Setup event listeners
    this.setupEventListeners();

    // Setup UI
    this.renderNikkeBrowser();
    this.renderHeadControls();
    this.addUiToggleButton();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
      this.fitContentToViewport();
    });
  }

  private async loadInitialModel() {
    try {
      // Используем наши локальные данные вместо PIXI.Assets.get()
      const nikkeData = this.nikkeIndexData;

      if (nikkeData && this.nikkePathParts && this.nikkePathParts.length) {
        await this.tryLoadModelForPath(this.nikkePathParts);
      } else if (nikkeData && this.nikkeModelKey) {
        const resolved = this.resolveNikkeModel(nikkeData, this.nikkeModelKey);
        if (resolved) {
          const nameHint = (
            resolved.skelUrl ||
            resolved.atlasUrl ||
            ""
          ).toLowerCase();
          const idleAnim = nameHint.includes("aim")
            ? "aim_idle"
            : nameHint.includes("cover")
            ? "cover_idle"
            : "idle";
          await this.loadModelFromUrls(
            resolved.skelUrl,
            resolved.atlasUrl,
            1,
            idleAnim
          );
        } else {
          await this.spawnLocal();
        }
      } else {
        await this.spawnLocal();
      }
    } catch (e) {
      console.warn("Failed to load initial model, falling back to local:", e);
      await this.spawnLocal();
    }
  }

  private async spawnLocal() {
    try {
      const resource = await PIXI.Assets.load("spineboy-data");
      const spineboy = new Spine(resource.spineData);

      spineboy.x = 0;
      spineboy.y = 400;
      spineboy.scale.set(10);

      this.holder.addChild(spineboy);

      if (spineboy.state.hasAnimation("idle")) {
        spineboy.state.setAnimation(0, "idle", true);
      }

      this.spineboy = spineboy;
      this.baseRotationByBone = {};
      this.setupHeadAndPointer();
      this.setupSpineboyInteraction();
      this.fitContentToViewport();
      this.isOffsetCalibrated = false;
      this.parallaxInitialized = false;
    } catch (e) {
      console.error("Failed to spawn local model:", e);
    }
  }

  private setupEventListeners() {
    // Track pointer position
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });

    this.app.stage.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });

    // Test cursor tracking
    this.testAimToCursor = true;
    window.addEventListener("mousemove", (ev: MouseEvent) => {
      try {
        if (!this.isAimModel) return;
        const x = ev.screenX;
        const y = ev.screenY;
        this.latestCaret = { x, y, isScreen: true };
        this.updateAimTracksFromCaret();
      } catch (e) {}
    });

    // Keyboard events for aim models
    window.addEventListener("keydown", (e) => {
      if (!this.spineboy) return;
      const isAimModel = (this.currentIdleAnimation || "")
        .toLowerCase()
        .includes("aim");
      if (!isAimModel) return;

      try {
        if (this.spineboy.state.hasAnimation("aim_fire")) {
          this.spineboy.state.setAnimation(1, "aim_fire", false);
          this.spineboy.state.addAnimation(
            1,
            this.currentIdleAnimation,
            true,
            0
          );
        }
      } catch (err) {
        // ignore if animation missing
      }

      // Try to get caret position from overlay API
      try {
        if ((window as any).overlayAPI?.getCaretPosition) {
          (window as any).overlayAPI.getCaretPosition().then((pos: any) => {
            if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
              this.pointerPos.set(pos.x, pos.y);
              this.latestCaret = { x: pos.x, y: pos.y };
              this.updateAimTracksFromCaret();
            }
          });
        }
      } catch {}
    });

    // Overlay API events
    try {
      if ((window as any).overlayAPI?.onEvent) {
        (window as any).overlayAPI.onEvent((data: any) => {
          try {
            if (!data) return;
            if (data.type === "caret") {
              if (
                typeof data.screenX === "number" &&
                typeof data.screenY === "number"
              ) {
                this.latestCaret = { x: data.screenX, y: data.screenY };
                this.pointerPos.set(data.screenX, data.screenY);
                this.updateAimTracksFromCaret();
              }
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  private setupSpineboyInteraction() {
    if (!this.spineboy) return;

    this.spineboy.eventMode = "static";
    this.spineboy.cursor = "grab";

    let isDragging = false;
    let dragOffset = new PIXI.Point();

    this.spineboy.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      isDragging = true;
      const globalPos = event.global;
      dragOffset.set(
        this.spineboy.x - globalPos.x,
        this.spineboy.y - globalPos.y
      );
      this.spineboy.cursor = "grabbing";
      console.log("Drag start", globalPos.x, globalPos.y);
    });

    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      if (isDragging && this.spineboy) {
        const globalPos = event.global;
        this.spineboy.x = globalPos.x + dragOffset.x;
        this.spineboy.y = globalPos.y + dragOffset.y;
        console.log("Drag move", this.spineboy.x, this.spineboy.y);
      }
    });

    this.app.stage.on("pointerup", () => {
      if (isDragging) {
        isDragging = false;
        this.spineboy.cursor = "grab";
        console.log("Drag end");
      }
    });

    this.spineboy.on("pointerover", () => {
      if (!isDragging) this.spineboy.cursor = "grab";
    });

    this.spineboy.on("pointerout", () => {
      if (!isDragging) this.spineboy.cursor = "auto";
    });
  }

  private setupHeadAndPointer() {
    if (!this.spineboy) return;

    const skeleton = this.spineboy.skeleton;
    if (!skeleton) return;

    const nameMatches = (n: string) =>
      /head|голов|голова|headbone|neck|nec|skull/i.test(n);

    // Find head bone
    this.headBone =
      skeleton.findBone("head") ||
      skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name)) ||
      null;

    if (this.headBone) {
      this.headBaseRotationDeg = this.headBone.rotation || 0;
    }

    // Capture base rotations for head and parents
    this.baseRotationByBone = {};
    let node: any = this.headBone;
    for (let i = 0; i < 12 && node; i++) {
      const n = node.data?.name || node.name || String(i);
      this.baseRotationByBone[n] = node.rotation || 0;
      node = node.parent;
    }

    // Capture base local position of head for parallax
    if (this.headBone) {
      this.headBaseLocalX = this.headBone.x || 0;
      this.headBaseLocalY = this.headBone.y || 0;
    }
    this.parallaxInitialized = false;

    // Detect eye bones
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

    // Find look target bone
    const targetNames = [
      "crosshair",
      "look",
      "look_target",
      "lookTarget",
      "head_target",
      "headTarget",
      "eye_target",
      "eyes_target",
      "eyeTarget",
      "eyesTarget",
    ];

    this.lookTargetBone = null;
    for (const name of targetNames) {
      const bone = skeleton.findBone(name);
      if (bone) {
        this.lookTargetBone = bone;
        break;
      }
    }

    if (this.lookTargetBone) {
      this.lookTargetBaseX = this.lookTargetBone.x || 0;
      this.lookTargetBaseY = this.lookTargetBone.y || 0;
    } else {
      this.lookTargetBaseX = 0;
      this.lookTargetBaseY = 0;
    }

    // Initialize pointer to current head position to avoid snapping
    const scaleX = this.spineboy.scale.x;
    const scaleY = this.spineboy.scale.y;
    const originX = this.holder.x + this.spineboy.x;
    const originY = this.holder.y + this.spineboy.y;
    const anchor = this.lookTargetBone || this.headBone;

    if (anchor) {
      this.pointerPos.set(
        originX + (anchor.worldX || 0) * scaleX,
        originY + (anchor.worldY || 0) * scaleY
      );
    }
  }

  private update() {
    const currentTime = performance.now();
    const deltaTime = this.lastFrameTime
      ? (currentTime - this.lastFrameTime) / 1000
      : 0;
    this.lastFrameTime = currentTime;

    // Post-update logic (head tracking, parallax, etc.)
    this.postUpdate(deltaTime);
  }

  private postUpdate(deltaTime: number) {
    // If current model is an aim model we must not run head control logic
    if (this.isAimModel) return;
    if (!this.spineboy || !this.spineboy.skeleton) return;

    const skeleton = this.spineboy.skeleton;

    if (!this.headBone) {
      const nameMatches = (n: string) =>
        /head|голов|голова|headbone|neck|nec|skull/i.test(n);
      this.headBone =
        skeleton.findBone("head") ||
        skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name)) ||
        null;

      if (this.headBone) {
        this.headBaseRotationDeg = this.headBone.rotation || 0;
      }
      if (!this.headBone) return;
    }

    const originX = this.holder.x + this.spineboy.x;
    const originY = this.holder.y + this.spineboy.y;

    // Convert pointer from screen space to world space
    const scaleX = this.spineboy.scale.x;
    const scaleY = this.spineboy.scale.y;
    const pointerWorldX = (this.pointerPos.x - originX) / scaleX;
    const pointerWorldY = (this.pointerPos.y - originY) / scaleY;

    // Handle look target bone parallax
    if (this.lookTargetBone && this.lookTargetBone.parent) {
      const pos = { x: pointerWorldX, y: pointerWorldY };
      this.lookTargetBone.parent.worldToLocal(pos);

      // Compute delta from neutral base
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
      const r = Math.hypot(
        desX - this.lookTargetBaseX,
        desY - this.lookTargetBaseY
      );
      const rMax = Math.max(0, this.targetBaseRadius * this.parallaxScale);

      if (r > rMax && r > 0) {
        const k = rMax / r;
        desX = this.lookTargetBaseX + (desX - this.lookTargetBaseX) * k;
        desY = this.lookTargetBaseY + (desY - this.lookTargetBaseY) * k;
      }

      if (!this.parallaxInitialized) {
        this.parallaxSmoothX = this.lookTargetBone.x || 0;
        this.parallaxSmoothY = this.lookTargetBone.y || 0;
        this.parallaxInitialized = true;
      }

      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-deltaTime / tau);
      this.parallaxSmoothX += (desX - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (desY - this.parallaxSmoothY) * alpha;

      this.lookTargetBone.x = this.parallaxSmoothX;
      this.lookTargetBone.y = this.parallaxSmoothY;
    }

    // Handle head bone rotation
    const head = this.headBone;
    const headWorldX = head.worldX || 0;
    const headWorldY = head.worldY || 0;

    const dx = pointerWorldX - headWorldX;
    const dy = pointerWorldY - headWorldY;

    if (dx * dx + dy * dy < 0.0001) return; // deadzone

    let angleDegBase = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Auto-calibrate axis offset
    if (!this.isOffsetCalibrated) {
      const currentLocalTmp = head.rotation || 0;
      let bestOffset = this.aimAxisOffsetDeg;
      let bestAbsDelta = Number.POSITIVE_INFINITY;

      for (const off of this.candidateOffsets) {
        const testDeg = angleDegBase + off;
        const desiredLocalTest = head.worldToLocalRotation
          ? head.worldToLocalRotation(testDeg)
          : testDeg;
        const d = this.shortestDeltaDeg(currentLocalTmp, desiredLocalTest);
        const ad = Math.abs(d);

        if (ad < bestAbsDelta) {
          bestAbsDelta = ad;
          bestOffset = off;
        }
      }

      this.aimAxisOffsetDeg = bestOffset;
      this.isOffsetCalibrated = true;
    }

    const angleDeg = angleDegBase + this.aimAxisOffsetDeg;
    let desiredLocal = head.worldToLocalRotation
      ? head.worldToLocalRotation(angleDeg)
      : angleDeg;

    const offsetFromBase = desiredLocal - this.headBaseRotationDeg;
    desiredLocal =
      this.headBaseRotationDeg + offsetFromBase * this.maxTurnScale;

    const maxTurn = Math.max(0, this.baseMaxTurnDeg * this.maxTurnScale);
    const minDeg = this.headBaseRotationDeg - maxTurn;
    const maxDeg = this.headBaseRotationDeg + maxTurn;
    desiredLocal = Math.max(minDeg, Math.min(maxDeg, desiredLocal));

    const currentLocal = head.rotation || 0;
    const delta = this.shortestDeltaDeg(currentLocal, desiredLocal);
    const tauRot = Math.max(0.001, this.rotationLagSeconds);
    let alphaRot = 1 - Math.exp(-deltaTime / tauRot);
    alphaRot = this.applyRotationEasing(alphaRot, this.rotationEasing);
    const stepBase = delta * alphaRot;

    // Build chain: head + N parents
    const bones: any[] = [];
    let node: any = head;
    for (let i = 0; i < Math.max(1, this.chainLength) && node; i++) {
      bones.push(node);
      node = node.parent;
    }

    const fall = 0.7;
    const weights: number[] = [];
    let sum = 0;
    for (let i = 0; i < bones.length; i++) {
      const w = Math.pow(fall, i);
      weights.push(w);
      sum += w;
    }

    if (sum <= 0) return;

    for (let i = 0; i < bones.length; i++) {
      const add = stepBase * (weights[i] / sum);
      const bone = bones[i];
      const proposed = (bone.rotation || 0) + add;

      if (i === 0) {
        bone.rotation = Math.max(minDeg, Math.min(maxDeg, proposed));
      } else {
        const name = bone.data?.name || bone.name || String(i);
        const base = this.baseRotationByBone[name] ?? (bone.rotation || 0);
        const range = this.parentMaxRangeDeg * this.maxTurnScale;
        const minP = base - range;
        const maxP = base + range;
        bone.rotation = Math.max(minP, Math.min(maxP, proposed));
      }
    }

    // Head bending via shear
    if (head.parent) {
      const locHead = { x: pointerWorldX, y: pointerWorldY };
      head.parent.worldToLocal(locHead);

      const desX =
        this.headBaseLocalX +
        (locHead.x - this.headBaseLocalX) * this.parallaxScale;
      const desY =
        this.headBaseLocalY +
        (locHead.y - this.headBaseLocalY) * this.parallaxScale;
      const dxh = desX - this.headBaseLocalX;
      const dyh = desY - this.headBaseLocalY;
      const dMaxShear = Math.max(
        0.0001,
        this.parallaxMaxOffset * this.parallaxScale
      );
      const nx = Math.max(-1, Math.min(1, dxh / dMaxShear));
      const ny = Math.max(-1, Math.min(1, dyh / dMaxShear));
      const targetShearX = nx * this.headShearMaxXDeg * this.headBendScale;
      const targetShearY = ny * this.headShearMaxYDeg * this.headBendScale;

      const tauShear = Math.max(0.001, this.parallaxLagSeconds);
      const alphaShear = 1 - Math.exp(-deltaTime / tauShear);

      head.shearX =
        (head.shearX || 0) + (targetShearX - (head.shearX || 0)) * alphaShear;
      head.shearY =
        (head.shearY || 0) + (targetShearY - (head.shearY || 0)) * alphaShear;
    }

    // Eye parallax
    if (this.eyeBones.length) {
      const tauEye = Math.max(0.001, this.parallaxLagSeconds);
      const alphaEye = 1 - Math.exp(-deltaTime / tauEye);

      for (const eye of this.eyeBones) {
        const name = eye.data?.name || eye.name || "eye";
        const base = this.eyeBasePosByName[name] || {
          x: eye.x || 0,
          y: eye.y || 0,
        };

        if (eye.parent) {
          const loc = { x: pointerWorldX, y: pointerWorldY };
          eye.parent.worldToLocal(loc);

          let tx = base.x + (loc.x - base.x) * this.eyeParallaxScale;
          let ty = base.y + (loc.y - base.y) * this.eyeParallaxScale;

          const dx = tx - base.x;
          const dy = ty - base.y;
          const a = Math.max(
            0.0001,
            this.eyeParallaxMaxX * this.eyeParallaxScale
          );
          const b = Math.max(
            0.0001,
            this.eyeParallaxMaxY * this.eyeParallaxScale
          );
          const s = (dx * dx) / (a * a) + (dy * dy) / (b * b);

          if (s > 1) {
            const k = 1 / Math.sqrt(s);
            tx = base.x + dx * k;
            ty = base.y + dy * k;
          }

          eye.x = (eye.x || 0) + (tx - (eye.x || 0)) * alphaEye;
          eye.y = (eye.y || 0) + (ty - (eye.y || 0)) * alphaEye;
        }
      }
    }

    // Head parallax translation when no look-target
    if (!this.lookTargetBone && head.parent) {
      const loc = { x: pointerWorldX, y: pointerWorldY };
      head.parent.worldToLocal(loc);

      let dx0 = loc.x - this.headBaseLocalX;
      let dy0 = loc.y - this.headBaseLocalY;
      const r0 = Math.hypot(dx0, dy0);

      if (r0 <= this.parallaxNeutralRadius) {
        dx0 = 0;
        dy0 = 0;
      } else if (r0 > 0) {
        const k0 = (r0 - this.parallaxNeutralRadius) / r0;
        dx0 *= k0;
        dy0 *= k0;
      }

      const px = this.headBaseLocalX + dx0 * this.parallaxScale;
      const py = this.headBaseLocalY + dy0 * this.parallaxScale;

      const dxp = px - this.headBaseLocalX;
      const dyp = py - this.headBaseLocalY;
      const d = Math.hypot(dxp, dyp);
      const dMax = Math.max(0, this.parallaxMaxOffset * this.parallaxScale);
      let tx = px,
        ty = py;

      if (d > dMax && d > 0) {
        const k = dMax / d;
        tx = this.headBaseLocalX + dxp * k;
        ty = this.headBaseLocalY + dyp * k;
      }

      if (!this.parallaxInitialized) {
        this.parallaxSmoothX = head.x || 0;
        this.parallaxSmoothY = head.y || 0;
        this.parallaxInitialized = true;
      }

      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-deltaTime / tau);
      this.parallaxSmoothX += (tx - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (ty - this.parallaxSmoothY) * alpha;

      head.x = this.parallaxSmoothX;
      head.y = this.parallaxSmoothY;
    }
  }

  private shortestDeltaDeg(from: number, to: number) {
    let delta = ((to - from + 180) % 360) - 180;
    if (delta < -180) delta += 360;
    return delta;
  }

  private updateAimTracksFromCaret() {
    if (!this.spineboy || !this.isAimModel || !this.latestCaret) return;

    try {
      // Get canvas and world coordinates
      const canvas = this.app.view as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();

      let clientX = this.latestCaret.x;
      let clientY = this.latestCaret.y;

      if (this.latestCaret.isScreen) {
        try {
          clientX = this.latestCaret.x - (window as any).screenX;
          clientY = this.latestCaret.y - (window as any).screenY;
        } catch {
          clientX = this.latestCaret.x;
          clientY = this.latestCaret.y;
        }
      }

      const canvasClientX = clientX - rect.left;
      const canvasClientY = clientY - rect.top;

      // Map relative to viewport center
      const vw =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        screen.width;
      const vh =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        screen.height;
      const centerX = vw / 2;
      const centerY = vh / 2;

      const nx = Math.max(
        -1,
        Math.min(1, (clientX - centerX) / (centerX || 1))
      );
      const ny = Math.max(
        -1,
        Math.min(1, -(clientY - centerY) / (centerY || 1))
      );
      const tx = Math.max(0, Math.min(1, 0.5 + nx * 0.5));
      const ty = Math.max(0, Math.min(1, 0.5 + ny * 0.5));

      if (this.debugLogging) {
        console.info(
          `[aim] percent X=${Math.round(tx * 100)}% Y=${Math.round(ty * 100)}%`
        );
      }

      // Set track time proportionally to animation duration
      try {
        if (this.aimXEntry && this.aimXEntry.animation) {
          const dur = this.aimXEntry.animation.duration || 1;
          this.aimXEntry.trackTime = tx * dur;
        }
      } catch {}

      try {
        if (this.aimYEntry && this.aimYEntry.animation) {
          const dur = this.aimYEntry.animation.duration || 1;
          this.aimYEntry.trackTime = ty * dur;
        }
      } catch {}

      if (this.debugDot) {
        try {
          this.debugDot.style.left = `${rect.left + canvasClientX}px`;
          this.debugDot.style.top = `${rect.top + canvasClientY}px`;
          this.debugDot.style.display = this.debugLogging ? "block" : "none";
        } catch {}
      }
    } catch (e) {
      console.error("Error in updateAimTracksFromCaret:", e);
    }
  }

  private resolveNikkeModel(
    indexRoot: any,
    key: string
  ): { atlasUrl: string; skelUrl: string } | null {
    if (!indexRoot || !key) return null;
    const lcKey = key.toLowerCase();
    let foundPath: string[] = [];
    let foundFiles: string[] = [];

    const dfs = (node: any, path: string[]) => {
      if (foundPath.length) return;
      const nodeName = (node.name || "").toLowerCase();
      const files: string[] = node.files || [];

      if (
        nodeName === lcKey ||
        files.some((f) => f.toLowerCase().includes(lcKey))
      ) {
        foundPath = path;
        foundFiles = files;
        return;
      }

      for (const child of node.children || [])
        dfs(child, path.concat(child.name));
    };

    dfs(indexRoot, []);
    if (!foundPath || foundPath.length === 0) return null;

    let base = PixiSpineDemo.NIKKE_BASE + foundPath.join("/") + "/";
    if (foundPath[0] && (foundPath[0] as string).toLowerCase() === "dotgg") {
      base = PixiSpineDemo.NIKKE_BASE + foundPath.slice(1).join("/") + "/";
    }

    const pick = (ext: string) => {
      const candidates = foundFiles.filter((f) =>
        f.toLowerCase().endsWith(ext)
      );
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => a.length - b.length);
      return base + candidates[0];
    };

    const atlasUrl = pick(".atlas");
    const skelUrl = pick(".skel");
    if (!atlasUrl || !skelUrl) return null;
    return { atlasUrl, skelUrl };
  }

  private resolveNodeByPath(indexRoot: any, parts: string[]) {
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
    node: any
  ): { atlasUrl: string; skelUrl: string } | null {
    const files: string[] = node.files || [];
    if (!files.length) return null;

    let base =
      PixiSpineDemo.NIKKE_BASE +
      (this.nikkePathParts ? this.nikkePathParts.join("/") + "/" : "");

    if (this.nikkePathParts && this.nikkePathParts[0] === "dotgg") {
      base = PixiSpineDemo.DOTGG_BASE;
      const real = this.nikkePathParts.slice(1);
      if (real.length) base += real.join("/") + "/";
    }

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

  private async loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    scale: number,
    idle: string
  ) {
    // Destroy previous instance
    if (this.spineboy) {
      this.holder.removeChild(this.spineboy);
      this.spineboy.destroy();
    }

    // Clear scheduled actions
    try {
      if (this.actionTimeout) {
        clearTimeout(this.actionTimeout);
        this.actionTimeout = null;
      }
      this.actionPlaying = false;
    } catch (e) {}

    // Reset bone refs
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;
    this.baseRotationByBone = {};

    const localToken = ++this.loadToken;

    try {
      // Load spine assets using PIXI.Assets
      PIXI.Assets.add({ alias: `spine-data-${localToken}`, src: skelUrl });
      const resource = await PIXI.Assets.load(`spine-data-${localToken}`);

      if (localToken !== this.loadToken) return; // stale load

      const spineboy = new Spine(resource.spineData);
      spineboy.x = 0;
      spineboy.y = 1000;
      spineboy.scale.set(scale);

      this.holder.addChild(spineboy);

      if (spineboy.state.hasAnimation(idle)) {
        spineboy.state.setAnimation(0, idle, true);
      }

      this.spineboy = spineboy;
      this.currentIdleAnimation = idle;

      // Detect aim model and prepare aim tracks
      this.isAimModel = (idle || "").toLowerCase().includes("aim");
      if (this.isAimModel) {
        try {
          const ax = this.spineboy.state.setAnimation(1, "aim_x", true);
          if (ax) ax.timeScale = 0;
          this.aimXEntry = ax;
        } catch (e) {}

        try {
          const ay = this.spineboy.state.setAnimation(2, "aim_y", true);
          if (ay) ay.timeScale = 0;
          this.aimYEntry = ay;
        } catch (e) {}

        this.headBone = null;
        this.lookTargetBone = null;
      }

      this.setupHeadAndPointer();
      this.setupSpineboyInteraction();
      this.fitContentToViewport();

      // Schedule random actions for standing models
      try {
        const isAim = (idle || "").toLowerCase().includes("aim");
        const isCover = (idle || "").toLowerCase().includes("cover");
        if (!isAim && !isCover) {
          this.scheduleNextAction();
        }
      } catch (e) {}
    } catch (error) {
      console.error("Failed to load model:", error);
    }
  }

  private async tryLoadModelForPath(parts: string[]) {
    try {
      if (this.currentRepo === "nikkie4" || (parts && parts[0] === "dotgg")) {
        const skin = parts[parts.length - 1];
        if (!skin) return;
        const atlasUrl =
          PixiSpineDemo.DOTGG_BASE + encodeURIComponent(skin) + ".atlas";
        const skelUrl =
          PixiSpineDemo.DOTGG_BASE + encodeURIComponent(skin) + ".skel";
        const nameHint = (skelUrl || atlasUrl || "").toLowerCase();
        const idleAnim = nameHint.includes("aim")
          ? "aim_idle"
          : nameHint.includes("cover")
          ? "cover_idle"
          : "idle";
        await this.loadModelFromUrls(skelUrl, atlasUrl, 1, idleAnim);
        return;
      }
    } catch (e) {}

    // Default: resolve from nikke-index tree
    const indexData = this.nikkeIndexData; // Используем наши локальные данные
    if (!indexData) return;

    const node = this.resolveNodeByPath(indexData, parts);
    const picked = node ? this.pickModelFromNode(node) : null;
    if (!picked) return;

    const nameHint = (picked.skelUrl || picked.atlasUrl || "").toLowerCase();
    const idleAnim = nameHint.includes("aim")
      ? "aim_idle"
      : nameHint.includes("cover")
      ? "cover_idle"
      : "idle";
    await this.loadModelFromUrls(picked.skelUrl, picked.atlasUrl, 1, idleAnim);
  }

  private scheduleNextAction() {
    try {
      if (this.actionTimeout) clearTimeout(this.actionTimeout);
      const delay = 6000 + Math.floor(Math.random() * 19000);
      this.actionTimeout = setTimeout(() => {
        this.playActionOnce();
      }, delay);
    } catch (e) {}
  }

  private playActionOnce() {
    try {
      if (!this.spineboy || this.actionPlaying) return;

      if (this.spineboy.state.hasAnimation("action")) {
        const entry = this.spineboy.state.setAnimation(1, "action", false);
        if (entry) {
          this.actionPlaying = true;
          entry.complete = () => {
            try {
              this.spineboy.state.addAnimation(
                1,
                this.currentIdleAnimation || "idle",
                true,
                0
              );
            } catch (e) {}
            this.actionPlaying = false;
            this.scheduleNextAction();
          };
        } else {
          this.scheduleNextAction();
        }
      } else {
        this.scheduleNextAction();
      }
    } catch (e) {
      this.scheduleNextAction();
    }
  }

  private fitContentToViewport() {
    if (!this.spineboy) return;

    let contentW = 0;
    let contentH = 0;

    try {
      const bounds = this.spineboy.getBounds();
      if (bounds && (bounds.width || bounds.height)) {
        contentW = Math.max(1, bounds.width);
        contentH = Math.max(1, bounds.height);
      }
    } catch {}

    if (!contentW || !contentH) {
      // Fallback to nominal size
      contentW = 1000;
      contentH = 1000;
    }

    const viewW = this.app.screen.width;
    const viewH = this.app.screen.height;
    const padding = 0.9;
    const zoomX = (viewW * padding) / contentW;
    const zoomY = (viewH * padding) / contentH;
    const fitZoom = Math.max(0.01, Math.min(zoomX, zoomY));

    if (!this.userAdjustedZoom) {
      this.cameraZoom = fitZoom;
      this.holder.scale.set(this.cameraZoom);
    }

    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
  }

  private applyRotationEasing(
    x: number,
    mode: typeof this.rotationEasing
  ): number {
    const t = Math.max(0, Math.min(1, x));
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

  private addUiToggleButton() {
    try {
      const existing = document.getElementById("overlay-ui-toggle");
      if (existing) {
        this.uiToggleButton = existing;
        return;
      }

      const btn = document.createElement("button");
      btn.id = "overlay-ui-toggle";
      btn.textContent = "Hide UI";
      btn.style.position = "absolute";
      btn.style.left = "12px";
      btn.style.bottom = "12px";
      btn.style.zIndex = "100000";
      btn.style.padding = "12px 18px";
      btn.style.fontSize = "16px";
      btn.style.minWidth = "140px";
      btn.style.height = "48px";
      btn.style.background = "rgba(0,0,0,0.7)";
      btn.style.color = "#fff";
      btn.style.border = "none";
      btn.style.borderRadius = "10px";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)";

      btn.onclick = () => {
        this.isUiHidden = !this.isUiHidden;
        if (this.isUiHidden) {
          btn.textContent = "Show UI";
          const el = document.getElementById("head-controls");
          if (el) el.style.display = "none";
          const nik = document.getElementById("nikke-browser");
          if (nik) nik.style.display = "none";
          try {
            (window as any).overlayAPI?.toggleClickThrough?.(true);
            this.clickThroughEnabled = true;
          } catch {}
        } else {
          btn.textContent = "Hide UI";
          const el = document.getElementById("head-controls");
          if (el) el.style.display = "block";
          const nik = document.getElementById("nikke-browser");
          if (nik) nik.style.display = "block";
          try {
            (window as any).overlayAPI?.toggleClickThrough?.(false);
            this.clickThroughEnabled = false;
          } catch {}
        }
      };

      document.body.appendChild(btn);
      this.uiToggleButton = btn;

      // Create debug dot
      try {
        const dd = document.createElement("div");
        dd.id = "overlay-debug-dot";
        dd.style.position = "absolute";
        dd.style.width = "12px";
        dd.style.height = "12px";
        dd.style.borderRadius = "50%";
        dd.style.background = "rgba(255,0,0,0.9)";
        dd.style.pointerEvents = "none";
        dd.style.zIndex = "100001";
        dd.style.transform = "translate(-50%, -50%)";
        dd.style.display = "none";
        document.body.appendChild(dd);
        this.debugDot = dd;
      } catch {}
    } catch {}
  }

  private renderNikkeBrowser() {
    const existing = document.getElementById("nikke-browser");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "nikke-browser";
    container.style.position = "absolute";
    container.style.top = "8px";
    container.style.left = "8px";
    container.style.background = "rgba(0,0,0,0.8)";
    container.style.color = "#fff";
    container.style.padding = "12px";
    container.style.borderRadius = "8px";
    container.style.maxWidth = "300px";
    container.style.maxHeight = "400px";
    container.style.overflow = "auto";
    container.style.fontSize = "14px";
    container.style.zIndex = "1000";

    // Repo selector
    const repoWrap = document.createElement("div");
    repoWrap.style.marginBottom = "8px";
    const sel = document.createElement("select");
    sel.style.background = "#333";
    sel.style.color = "#fff";
    sel.style.border = "1px solid #666";
    sel.style.padding = "4px";

    const opt1 = document.createElement("option");
    opt1.value = "nikke";
    opt1.textContent = "Nikke.json";
    const opt2 = document.createElement("option");
    opt2.value = "nikkie4";
    opt2.textContent = "nikkie4.1.json";

    sel.appendChild(opt1);
    sel.appendChild(opt2);
    sel.value = this.currentRepo;

    sel.onchange = () => {
      this.currentRepo = sel.value as any;
      this.nikkePathParts = null;
      this.n4ExpandedCharacter = null;
      this.renderNikkeBrowser();
    };

    repoWrap.appendChild(sel);
    container.appendChild(repoWrap);

    // File list
    const list = document.createElement("div");
    list.className = "nikke-file-list";

    if (this.currentRepo === "nikke") {
      const indexData = this.nikkeIndexData; // Используем наши локальные данные
      if (!indexData) {
        const msg = document.createElement("div");
        msg.textContent = "Nikke index not loaded";
        list.appendChild(msg);
      } else {
        this.renderNikkeFileList(list, indexData);
      }
    } else {
      const n4 = this.nikkie4IndexData; // Используем наши локальные данные
      if (!n4) {
        const msg = document.createElement("div");
        msg.textContent = "nikkie4 index not loaded";
        list.appendChild(msg);
      } else {
        this.renderNikkie4FileList(list, n4);
      }
    }

    container.appendChild(list);
    document.body.appendChild(container);
  }

  private renderNikkeFileList(list: HTMLElement, indexData: any) {
    const node =
      this.nikkePathParts && this.nikkePathParts.length
        ? this.resolveNodeByPath(indexData, this.nikkePathParts) || null
        : indexData;

    // Breadcrumbs
    const crumbs = document.createElement("div");
    crumbs.style.marginBottom = "8px";
    const rootCrumb = document.createElement("a");
    rootCrumb.textContent = "/";
    rootCrumb.style.color = "#4a9eff";
    rootCrumb.style.cursor = "pointer";
    rootCrumb.onclick = (e) => {
      e.preventDefault();
      this.nikkePathParts = null;
      this.renderNikkeBrowser();
    };
    crumbs.appendChild(rootCrumb);

    const parts = this.nikkePathParts || [];
    parts.forEach((part, idx) => {
      crumbs.appendChild(document.createTextNode(" / "));
      const c = document.createElement("a");
      c.textContent = part;
      c.style.color = "#4a9eff";
      c.style.cursor = "pointer";
      c.onclick = (e) => {
        e.preventDefault();
        this.nikkePathParts = parts.slice(0, idx + 1);
        this.renderNikkeBrowser();
      };
      crumbs.appendChild(c);
    });
    list.appendChild(crumbs);

    // Up one level
    if (this.nikkePathParts && this.nikkePathParts.length) {
      const upRow = document.createElement("div");
      upRow.style.padding = "4px";
      upRow.style.cursor = "pointer";
      upRow.style.borderRadius = "4px";
      upRow.innerHTML = '<span style="margin-right: 8px;">⬆️</span>..';
      upRow.onmouseover = () =>
        (upRow.style.background = "rgba(255,255,255,0.1)");
      upRow.onmouseout = () => (upRow.style.background = "");
      upRow.onclick = () => {
        this.nikkePathParts = this.nikkePathParts!.slice(0, -1);
        this.renderNikkeBrowser();
      };
      list.appendChild(upRow);
    }

    // Children directories
    for (const child of node?.children || []) {
      const row = document.createElement("div");
      row.style.padding = "4px";
      row.style.cursor = "pointer";
      row.style.borderRadius = "4px";
      row.innerHTML = '<span style="margin-right: 8px;">📁</span>' + child.name;
      row.onmouseover = () => (row.style.background = "rgba(255,255,255,0.1)");
      row.onmouseout = () => (row.style.background = "");
      row.onclick = () => {
        this.nikkePathParts = [...(this.nikkePathParts || []), child.name];
        this.renderNikkeBrowser();
      };
      list.appendChild(row);
    }

    // Files
    const files: string[] = node?.files || [];
    const modelFiles = files.filter(
      (f) => f.endsWith(".skel") || f.endsWith(".atlas")
    );

    for (const f of modelFiles) {
      const row = document.createElement("div");
      row.style.padding = "4px";
      row.style.borderRadius = "4px";
      const icon = f.endsWith(".skel") ? "🦴" : "🗎";
      row.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${f}`;
      list.appendChild(row);
    }

    if (modelFiles.length) {
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load Model from This Folder";
      loadBtn.style.marginTop = "8px";
      loadBtn.style.padding = "8px 12px";
      loadBtn.style.background = "#4a9eff";
      loadBtn.style.color = "#fff";
      loadBtn.style.border = "none";
      loadBtn.style.borderRadius = "4px";
      loadBtn.style.cursor = "pointer";
      loadBtn.onclick = () => {
        this.tryLoadModelForPath(this.nikkePathParts || []);
      };
      list.appendChild(loadBtn);
    }
  }

  private renderNikkie4FileList(list: HTMLElement, n4: any) {
    let src: any = n4;
    if (!n4.skins && Array.isArray(n4)) {
      const found = n4.find((x: any) => x && x.skins && Array.isArray(x.skins));
      if (found) src = found;
    }

    for (const ch of src.skins || []) {
      const row = document.createElement("div");
      row.style.padding = "4px";
      row.style.cursor = "pointer";
      row.style.borderRadius = "4px";
      row.innerHTML = `<span style="margin-right: 8px;">👤</span>${ch.name}`;

      const skinContainer = document.createElement("div");
      skinContainer.style.display =
        this.n4ExpandedCharacter === ch.name ? "block" : "none";

      for (const s of ch.skins || []) {
        const skinRow = document.createElement("div");
        skinRow.style.padding = "4px 4px 4px 22px";
        skinRow.style.cursor = "pointer";
        skinRow.style.borderRadius = "4px";
        skinRow.innerHTML = `<span style="margin-right: 8px;">📁</span>${s.name} (${s.skin})`;
        skinRow.onmouseover = () =>
          (skinRow.style.background = "rgba(255,255,255,0.1)");
        skinRow.onmouseout = () => (skinRow.style.background = "");
        skinRow.onclick = () => {
          this.nikkePathParts = ["dotgg", ch.name, s.skin];
          this.tryLoadModelForPath(this.nikkePathParts);
        };
        skinContainer.appendChild(skinRow);
      }

      row.onmouseover = () => (row.style.background = "rgba(255,255,255,0.1)");
      row.onmouseout = () => (row.style.background = "");
      row.onclick = () => {
        const open = skinContainer.style.display === "block";
        skinContainer.style.display = open ? "none" : "block";
        this.n4ExpandedCharacter = open ? null : ch.name;
      };

      list.appendChild(row);
      list.appendChild(skinContainer);
    }
  }

  private renderHeadControls() {
    const existing = document.getElementById("head-controls");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "head-controls";
    wrap.style.position = "absolute";
    wrap.style.top = "8px";
    wrap.style.right = "8px";
    wrap.style.background = "rgba(0,0,0,0.8)";
    wrap.style.color = "#fff";
    wrap.style.padding = "12px";
    wrap.style.font = "12px/1.4 monospace";
    wrap.style.borderRadius = "8px";
    wrap.style.zIndex = "1000";
    wrap.style.minWidth = "240px";

    const title = document.createElement("div");
    title.textContent = "Head Controls";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "8px";
    wrap.appendChild(title);

    // Create control sliders
    this.addSlider(
      wrap,
      "Nodes from head",
      this.chainLength,
      1,
      5,
      1,
      (val) => {
        this.chainLength = val;
      }
    );

    this.addSlider(
      wrap,
      "Rotation scale",
      this.maxTurnScale,
      0,
      2,
      0.05,
      (val) => {
        this.maxTurnScale = val;
      }
    );

    this.addSlider(
      wrap,
      "Parallax scale",
      this.parallaxScale,
      0,
      10,
      0.05,
      (val) => {
        this.parallaxScale = val;
      }
    );

    this.addSlider(
      wrap,
      "Bend scale",
      this.headBendScale,
      0,
      2,
      0.05,
      (val) => {
        this.headBendScale = val;
      }
    );

    this.addSlider(
      wrap,
      "Eye parallax",
      this.eyeParallaxScale,
      0,
      10,
      0.1,
      (val) => {
        this.eyeParallaxScale = val;
      }
    );

    this.addSlider(
      wrap,
      "Parallax time (ms)",
      this.parallaxLagSeconds * 1000,
      50,
      1000,
      10,
      (val) => {
        this.parallaxLagSeconds = val / 1000;
      }
    );

    this.addSlider(
      wrap,
      "Rotation time (ms)",
      this.rotationLagSeconds * 1000,
      50,
      1000,
      10,
      (val) => {
        this.rotationLagSeconds = val / 1000;
      }
    );

    this.addSlider(wrap, "Zoom", this.cameraZoom, 0.1, 3, 0.05, (val) => {
      this.cameraZoom = val;
      this.userAdjustedZoom = true;
      this.holder.scale.set(this.cameraZoom);
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
    });

    document.body.appendChild(wrap);
  }

  private addSlider(
    parent: HTMLElement,
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void
  ) {
    const container = document.createElement("div");
    container.style.marginBottom = "8px";

    const labelEl = document.createElement("label");
    labelEl.textContent = `${label}: ${value.toFixed(2)}`;
    labelEl.style.display = "block";
    labelEl.style.marginBottom = "4px";
    container.appendChild(labelEl);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    slider.style.width = "200px";
    slider.style.accentColor = "#4a9eff";

    slider.addEventListener("input", () => {
      const newValue = parseFloat(slider.value);
      onChange(newValue);
      labelEl.textContent = `${label}: ${newValue.toFixed(2)}`;
    });

    container.appendChild(slider);
    parent.appendChild(container);
  }

  private mergeNikkie4IntoIndex(indexRoot: any, n4: any) {
    try {
      const top = indexRoot;
      if (!n4) return;

      let src: any = n4;
      if (!n4.skins && Array.isArray(n4)) {
        const found = n4.find(
          (x: any) => x && x.skins && Array.isArray(x.skins)
        );
        if (found) src = found;
      }

      if (!src.skins || !Array.isArray(src.skins)) return;

      top.children = top.children || [];
      for (const entry of src.skins) {
        const name = entry.name || entry._id || "unknown";
        let folder = top.children.find(
          (c: any) =>
            String(c.name || "").toLowerCase() === String(name).toLowerCase()
        );

        if (!folder) {
          folder = { name, children: [], files: [] };
          top.children.push(folder);
        }

        folder._dotgg = folder._dotgg || [];
        if (entry.skins && Array.isArray(entry.skins)) {
          folder.children = folder.children || [];
          for (const s of entry.skins) {
            folder._dotgg.push({ name: s.name, skin: s.skin });
            const skinFolderName = String(s.skin || s.name);
            const exists = folder.children.some(
              (c: any) =>
                String(c.name || "").toLowerCase() ===
                skinFolderName.toLowerCase()
            );
            if (!exists) {
              folder.children.push({
                name: skinFolderName,
                files: [skinFolderName + ".skel", skinFolderName + ".atlas"],
              });
            }
          }
        }
      }
    } catch (e) {
      // swallow merge errors
    }
  }
}

// Add CSS styles for the UI
const style = document.createElement("style");
style.textContent = `
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: Arial, sans-serif;
  }
  
  .nikke-file-list {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .nikke-file-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .nikke-file-list::-webkit-scrollbar-track {
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
  }
  
  .nikke-file-list::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.3);
    border-radius: 4px;
  }
  
  .nikke-file-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.5);
  }
`;
document.head.appendChild(style);

// Initialize the demo
window.addEventListener("load", () => {
  new PixiSpineDemo();
});
