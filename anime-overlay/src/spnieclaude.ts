import * as PIXI from "pixi.js";
import { Spine as Spine40 } from "@pixi-spine/runtime-4.0";
import { Spine as Spine41 } from "@pixi-spine/runtime-4.1";

// Type definitions for spine runtimes
type SpineRuntime = "4.0" | "4.1";
type SpineObject = Spine40 | Spine41;

interface SpineBone {
  data?: { name: string };
  name?: string;
  rotation?: number;
  x?: number;
  y?: number;
  worldX?: number;
  worldY?: number;
  parent?: SpineBone;
  worldToLocal?: (point: { x: number; y: number }) => void;
  worldToLocalRotation?: (angle: number) => number;
  shearX?: number;
  shearY?: number;
  updateAppliedTransform?: () => void;
}

interface SpineSkeleton {
  bones?: SpineBone[];
  findBone?: (name: string) => SpineBone | null;
  updateWorldTransform?: () => void;
  transformConstraints?: any[];
  ikConstraints?: any[];
}

interface SpineAnimationState {
  setAnimation: (
    trackIndex: number,
    animationName: string,
    loop: boolean
  ) => any;
  addAnimation: (
    trackIndex: number,
    animationName: string,
    loop: boolean,
    delay: number
  ) => any;
}

class PixiSpineDemo {
  private app!: PIXI.Application;
  private holder!: PIXI.Container;
  private spineboy: SpineObject | null = null;
  private headBone: SpineBone | null = null;
  private lookTargetBone: SpineBone | null = null;
  private pointerPos = { x: 0, y: 0 };
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
  private eyeBones: SpineBone[] = [];
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
  private currentRuntime: SpineRuntime = "4.1";
  private nikkeIndex: any = null;
  private nikkie4Index: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Create PIXI Application
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

    // Setup event handlers
    this.setupEventHandlers();
    this.setupOverlayAPI();

    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    this.nikkeModelKey = params.get("nikke");
    const nikkePath = params.get("nikkePath") || params.get("path");
    this.nikkePathParts = nikkePath
      ? nikkePath
          .split("/")
          .map((p) => p.trim())
          .filter((p) => !!p)
      : null;

    // Load indices
    await this.loadIndices();

    // Load model based on parameters
    await this.loadInitialModel();

    // Setup UI
    this.renderNikkeBrowser();
    this.renderHeadControls();
    this.addUiToggleButton();

    // Start update loop
    this.app.ticker.add(this.update, this);
  }

  private setupEventHandlers() {
    // Pointer tracking
    this.app.stage.interactive = true;
    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.x = event.global.x;
      this.pointerPos.y = event.global.y;
    });

    this.app.stage.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.x = event.global.x;
      this.pointerPos.y = event.global.y;
      this.handlePointerDown(event);
    });

    this.app.stage.on("pointerup", () => {
      this.handlePointerUp();
    });

    // Window resize
    window.addEventListener("resize", () => {
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
      this.fitContentToViewport();
    });

    // Keyboard events for aim models
    window.addEventListener("keydown", (e) => {
      if (!this.spineboy) return;
      const isAimModel = (this.currentIdleAnimation || "")
        .toLowerCase()
        .includes("aim");
      if (!isAimModel) return;

      try {
        // Play aim_fire animation
        const state = this.getSpineAnimationState();
        if (state) {
          state.setAnimation(1, "aim_fire", false);
          state.addAnimation(1, this.currentIdleAnimation, true, 0);
        }
      } catch (err) {
        // ignore if animation missing
      }

      this.updateCaretPosition();
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
  }

  private setupOverlayAPI() {
    try {
      if ((window as any).overlayAPI) {
        (window as any).overlayAPI.setZoomFactor?.(0.5);
        (window as any).overlayAPI.enterFullscreen?.();

        if (typeof (window as any).overlayAPI.onEvent === "function") {
          (window as any).overlayAPI.onEvent((data: any) => {
            try {
              if (!data) return;
              if (data.type === "caret") {
                if (
                  typeof data.screenX === "number" &&
                  typeof data.screenY === "number"
                ) {
                  this.latestCaret = { x: data.screenX, y: data.screenY };
                  this.pointerPos.x = data.screenX;
                  this.pointerPos.y = data.screenY;
                  this.updateAimTracksFromCaret();
                }
              }
            } catch (e) {}
          });
        }
      }
    } catch (e) {}
  }

  private async loadIndices() {
    try {
      const nikkeResponse = await fetch("Nikke.json");
      this.nikkeIndex = await nikkeResponse.json();
    } catch (e) {
      console.warn("Failed to load Nikke.json");
    }

    try {
      const nikkie4Response = await fetch("nikkie4.1.json");
      this.nikkie4Index = await nikkie4Response.json();
    } catch (e) {
      console.warn("Failed to load nikkie4.1.json");
    }
  }

  private async loadInitialModel() {
    if (this.nikkeIndex && this.nikkePathParts && this.nikkePathParts.length) {
      await this.tryLoadModelForPath(this.nikkePathParts);
    } else if (this.nikkeIndex && this.nikkeModelKey) {
      const resolved = this.resolveNikkeModel(
        this.nikkeIndex,
        this.nikkeModelKey
      );
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
          idleAnim
        );
      } else {
        await this.spawnLocal();
      }
    } else {
      await this.spawnLocal();
    }
  }

  private async spawnLocal() {
    try {
      // Load local demo model
      const spine = await this.loadSpineModel(
        "./assets/favorite_c550_00.skel",
        "./assets/favorite_c550_00.atlas",
        "4.1"
      );
      if (spine) {
        spine.scale.set(10);
        spine.y = 400;
        this.holder.addChild(spine);
        this.spineboy = spine;
        this.baseRotationByBone = {};
        this.setupHeadAndPointer();
        this.setupSpineDrag();
        this.fitContentToViewport();
        this.isOffsetCalibrated = false;
        this.parallaxInitialized = false;

        const state = this.getSpineAnimationState();
        if (state) {
          state.setAnimation(1, "idle", true);
        }
      }
    } catch (e) {
      console.error("Failed to load local model:", e);
    }
  }

  private detectSpineVersion(skelUrl: string, atlasUrl: string): SpineRuntime {
    // Simple heuristic - you may need to adjust based on your models
    const url = (skelUrl + atlasUrl).toLowerCase();

    // Check for version indicators in URL or filename
    if (url.includes("4.0") || url.includes("v40")) {
      return "4.0";
    }

    // Default to 4.1 for newer models
    return "4.1";
  }

  private async loadSpineModel(
    skelUrl: string,
    atlasUrl: string,
    runtime?: SpineRuntime
  ): Promise<SpineObject | null> {
    try {
      const detectedRuntime =
        runtime || this.detectSpineVersion(skelUrl, atlasUrl);
      this.currentRuntime = detectedRuntime;

      // Load atlas texture and data
      const atlasResponse = await fetch(atlasUrl);
      const atlasText = await atlasResponse.text();

      const skelResponse = await fetch(skelUrl);
      const skelBuffer = await skelResponse.arrayBuffer();

      if (detectedRuntime === "4.0") {
        // Use spine 4.0 runtime
        const {
          TextureAtlas,
          AtlasAttachmentLoader,
          SkeletonBinary,
          Skeleton,
          AnimationStateData,
          AnimationState,
        } = await import("@pixi-spine/runtime-4.0");

        const atlas = new TextureAtlas(atlasText, (path: string) => {
          const baseUrl = atlasUrl.substring(0, atlasUrl.lastIndexOf("/") + 1);
          return PIXI.Texture.from(baseUrl + path);
        });

        const attachmentLoader = new AtlasAttachmentLoader(atlas);
        const skelBinary = new SkeletonBinary(attachmentLoader);
        const skeletonData = skelBinary.readSkeletonData(
          new Uint8Array(skelBuffer)
        );

        const skeleton = new Skeleton(skeletonData);
        const stateData = new AnimationStateData(skeletonData);
        const animationState = new AnimationState(stateData);

        const spine = new Spine40(skeletonData);
        spine.skeleton = skeleton;
        spine.state = animationState;

        return spine;
      } else {
        // Use spine 4.1 runtime
        const {
          TextureAtlas,
          AtlasAttachmentLoader,
          SkeletonBinary,
          Skeleton,
          AnimationStateData,
          AnimationState,
        } = await import("@pixi-spine/runtime-4.1");

        const atlas = new TextureAtlas(atlasText, (path: string) => {
          const baseUrl = atlasUrl.substring(0, atlasUrl.lastIndexOf("/") + 1);
          return PIXI.Texture.from(baseUrl + path);
        });

        const attachmentLoader = new AtlasAttachmentLoader(atlas);
        const skelBinary = new SkeletonBinary(attachmentLoader);
        const skeletonData = skelBinary.readSkeletonData(
          new Uint8Array(skelBuffer)
        );

        const skeleton = new Skeleton(skeletonData);
        const stateData = new AnimationStateData(skeletonData);
        const animationState = new AnimationState(stateData);

        const spine = new Spine41(skeletonData);
        spine.skeleton = skeleton;
        spine.state = animationState;

        return spine;
      }
    } catch (error) {
      console.error("Failed to load spine model:", error);
      return null;
    }
  }

  private getSpineSkeleton(): SpineSkeleton | null {
    if (!this.spineboy) return null;
    return (this.spineboy as any).skeleton;
  }

  private getSpineAnimationState(): SpineAnimationState | null {
    if (!this.spineboy) return null;
    return (this.spineboy as any).state;
  }

  private setupHeadAndPointer() {
    if (!this.spineboy) return;
    const skeleton = this.getSpineSkeleton();
    if (!skeleton) return;

    const nameMatches = (n: string) =>
      /head|голов|голова|headbone|neck|nec|skull/i.test(n);
    this.headBone =
      (skeleton.findBone && skeleton.findBone("head")) ||
      (skeleton.bones &&
        skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name))) ||
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

    // Look for look target bone
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
    if (skeleton.findBone) {
      for (const n of targetNames) {
        const b = skeleton.findBone(n);
        if (b) {
          this.lookTargetBone = b;
          break;
        }
      }
    }

    if (this.lookTargetBone) {
      this.lookTargetBaseX = this.lookTargetBone.x || 0;
      this.lookTargetBaseY = this.lookTargetBone.y || 0;
    } else {
      this.lookTargetBaseX = 0;
      this.lookTargetBaseY = 0;
    }

    // Initialize pointer position
    const anchor = this.lookTargetBone || this.headBone;
    this.pointerPos.x =
      this.holder.x +
      (this.spineboy.x || 0) +
      ((anchor as any)?.worldX || 0) * (this.spineboy.scale?.x || 1);
    this.pointerPos.y =
      this.holder.y +
      (this.spineboy.y || 0) +
      ((anchor as any)?.worldY || 0) * (this.spineboy.scale?.y || 1);
  }

  private setupSpineDrag() {
    if (!this.spineboy) return;

    this.spineboy.interactive = true;
    this.spineboy.cursor = "grab";

    this.spineboy.on("pointerover", () => {
      document.body.style.cursor = "grab";
    });

    this.spineboy.on("pointerout", () => {
      if (!this.isDragging) {
        document.body.style.cursor = "";
      }
    });

    this.spineboy.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      this.isDragging = true;
      this.dragOffsetX = this.spineboy!.x - event.global.x + this.holder.x;
      this.dragOffsetY = this.spineboy!.y - event.global.y + this.holder.y;
      document.body.style.cursor = "grabbing";
    });
  }

  private handlePointerDown(event: PIXI.FederatedPointerEvent) {
    this.pointerPos.x = event.global.x;
    this.pointerPos.y = event.global.y;
  }

  private handlePointerUp() {
    if (this.isDragging) {
      this.isDragging = false;
      document.body.style.cursor = "";
    }
  }

  private update() {
    // Handle dragging
    if (this.isDragging && this.spineboy) {
      this.spineboy.x = this.pointerPos.x + this.dragOffsetX - this.holder.x;
      this.spineboy.y = this.pointerPos.y + this.dragOffsetY - this.holder.y;
    }

    // Update head tracking
    this.updateHeadTracking();
  }

  private updateHeadTracking() {
    if (this.isAimModel) return;
    if (!this.spineboy || !this.headBone) return;

    const skeleton = this.getSpineSkeleton();
    if (!skeleton) return;

    // Convert pointer position to model space
    const originX = this.holder.x + this.spineboy.x;
    const originY = this.holder.y + this.spineboy.y;
    const scaleX = this.spineboy.scale?.x || 1;
    const scaleY = this.spineboy.scale?.y || 1;

    const pointerWorldX = (this.pointerPos.x - originX) / scaleX;
    const pointerWorldY = (this.pointerPos.y - originY) / scaleY;

    // Update look target if present
    if (
      this.lookTargetBone &&
      this.lookTargetBone.parent &&
      this.lookTargetBone.parent.worldToLocal
    ) {
      const pos: any = { x: pointerWorldX, y: pointerWorldY };
      this.lookTargetBone.parent.worldToLocal(pos);

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

      const dt = this.app.ticker.deltaMS / 1000;
      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-dt / tau);
      this.parallaxSmoothX += (desX - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (desY - this.parallaxSmoothY) * alpha;

      this.lookTargetBone.x = this.parallaxSmoothX;
      this.lookTargetBone.y = this.parallaxSmoothY;

      if (this.lookTargetBone.updateAppliedTransform) {
        this.lookTargetBone.updateAppliedTransform();
      }
      if (skeleton.updateWorldTransform) {
        skeleton.updateWorldTransform();
      }
    }

    // Head rotation logic
    const head = this.headBone as any;
    const headWorldX = head.worldX || 0;
    const headWorldY = head.worldY || 0;

    const dx = pointerWorldX - headWorldX;
    const dy = pointerWorldY - headWorldY;

    if (dx * dx + dy * dy < 0.0001) return;

    let angleDegBase = (Math.atan2(dy, dx) * 180) / Math.PI;

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
    const dtRot = this.app.ticker.deltaMS / 1000;
    const tauRot = Math.max(0.001, this.rotationLagSeconds);
    let alphaRot = 1 - Math.exp(-dtRot / tauRot);
    alphaRot = this.clamp(alphaRot, 0, 1);
    alphaRot = this.applyRotationEasing(alphaRot, this.rotationEasing);
    const stepBase = delta * alphaRot;

    // Apply to bone chain
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

    // Update transforms
    for (const bone of bones) {
      if (bone.updateAppliedTransform) {
        bone.updateAppliedTransform();
      }
    }

    if (skeleton.updateWorldTransform) {
      skeleton.updateWorldTransform();
    }
  }

  private updateAimTracksFromCaret() {
    if (!this.spineboy || !this.isAimModel || !this.latestCaret) return;

    try {
      // Convert caret position to normalized coordinates (0-1)
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

      let clientPageX: number | null = null;
      let clientPageY: number | null = null;

      if (this.latestCaret.isScreen) {
        try {
          clientPageX = this.latestCaret.x - (window as any).screenX;
          clientPageY = this.latestCaret.y - (window as any).screenY;
        } catch {
          clientPageX = this.latestCaret.x;
          clientPageY = this.latestCaret.y;
        }
      } else {
        clientPageX = this.latestCaret.x;
        clientPageY = this.latestCaret.y;
      }

      if (clientPageX != null && clientPageY != null) {
        const nx = this.clamp((clientPageX - centerX) / (centerX || 1), -1, 1);
        const ny = this.clamp(-(clientPageY - centerY) / (centerY || 1), -1, 1);
        const tx = this.clamp(0.5 + nx * 0.5, 0, 1);
        const ty = this.clamp(0.5 + ny * 0.5, 0, 1);

        // Set track time proportionally to animation duration
        try {
          if (this.aimXEntry && typeof this.aimXEntry.animation === "object") {
            const dur = this.aimXEntry.animation.duration || 1;
            this.aimXEntry.trackTime = tx * dur;
          }
        } catch {}

        try {
          if (this.aimYEntry && typeof this.aimYEntry.animation === "object") {
            const dur = this.aimYEntry.animation.duration || 1;
            this.aimYEntry.trackTime = ty * dur;
          }
        } catch {}
      }
    } catch (e) {
      console.warn("Error updating aim tracks:", e);
    }
  }

  private updateCaretPosition() {
    try {
      if (
        (window as any).overlayAPI &&
        typeof (window as any).overlayAPI.getCaretPosition === "function"
      ) {
        (window as any).overlayAPI.getCaretPosition().then((pos: any) => {
          try {
            if (pos && typeof pos.x === "number" && typeof pos.y === "number") {
              this.pointerPos.x = pos.x;
              this.pointerPos.y = pos.y;
              this.latestCaret = { x: pos.x, y: pos.y };
              this.updateAimTracksFromCaret();
            }
          } catch {}
        });
      }
    } catch {}
  }

  private shortestDeltaDeg(from: number, to: number): number {
    let delta = ((to - from + 180) % 360) - 180;
    if (delta < -180) delta += 360;
    return delta;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private applyRotationEasing(
    x: number,
    mode: typeof this.rotationEasing
  ): number {
    const t = this.clamp(x, 0, 1);
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

      for (const child of node.children || []) {
        dfs(child, path.concat(child.name));
      }
    };

    dfs(indexRoot, []);

    if (!foundPath || foundPath.length === 0) return null;

    let base = PixiSpineDemo.NIKKE_BASE + foundPath.join("/") + "/";
    if (foundPath[0] && foundPath[0].toLowerCase() === "dotgg") {
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

        await this.loadModelFromUrls(skelUrl, atlasUrl, idleAnim);
        return;
      }
    } catch (e) {}

    const indexData = this.nikkeIndex;
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

    await this.loadModelFromUrls(picked.skelUrl, picked.atlasUrl, idleAnim);
  }

  private async loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    idle: string
  ) {
    // Destroy previous instance
    if (this.spineboy) {
      this.holder.removeChild(this.spineboy);
      this.spineboy.destroy();
      this.spineboy = null;
    }

    // Clear scheduled actions
    try {
      if (this.actionTimeout) {
        clearTimeout(this.actionTimeout);
        this.actionTimeout = null;
      }
      this.actionPlaying = false;
    } catch (e) {}

    // Reset bone references
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;
    this.baseRotationByBone = {};

    const localToken = ++this.loadToken;

    try {
      const spine = await this.loadSpineModel(skelUrl, atlasUrl);

      if (localToken !== this.loadToken) return; // Stale load

      if (spine) {
        spine.y = 1000;
        this.holder.addChild(spine);

        const state = this.getSpineAnimationState();
        if (state) {
          state.setAnimation(1, idle, true);
        }

        this.spineboy = spine;
        this.currentIdleAnimation = idle;

        // Detect aim model and prepare aim tracks
        this.isAimModel = (idle || "").toLowerCase().includes("aim");
        if (this.isAimModel) {
          try {
            const ax = state?.setAnimation(2, "aim_x", true);
            if (ax) (ax as any).timeScale = 0;
            this.aimXEntry = ax;
          } catch (e) {}

          try {
            const ay = state?.setAnimation(3, "aim_y", true);
            if (ay) (ay as any).timeScale = 0;
            this.aimYEntry = ay;
          } catch (e) {}

          this.headBone = null;
          this.lookTargetBone = null;
        }

        this.setupHeadAndPointer();
        this.setupSpineDrag();
        this.fitContentToViewport();

        // Schedule random actions for standing models
        try {
          const isAim = (idle || "").toLowerCase().includes("aim");
          const isCover = (idle || "").toLowerCase().includes("cover");
          if (!isAim && !isCover) {
            this.scheduleNextAction();
          }
        } catch (e) {}
      }
    } catch (error) {
      console.error("Failed to load model:", error);
    }
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

      const state = this.getSpineAnimationState();
      if (!state) return;

      try {
        const entry = state.setAnimation(2, "action", false);
        if (entry) {
          this.actionPlaying = true;
          (entry as any).listener = {
            complete: () => {
              try {
                state.addAnimation(
                  2,
                  this.currentIdleAnimation || "idle",
                  true,
                  0
                );
              } catch (e) {}
              this.actionPlaying = false;
              this.scheduleNextAction();
            },
          };
        } else {
          this.scheduleNextAction();
        }
      } catch (e) {
        this.scheduleNextAction();
      }
    } catch (e) {}
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
    }

    this.app.stage.scale.set(this.cameraZoom);
    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
  }

  // UI Methods
  private renderNikkeBrowser() {
    const existing = document.getElementById("nikke-browser");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "nikke-browser";
    container.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      width: 300px;
      max-height: 400px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
    `;

    // Repository selector
    const repoWrap = document.createElement("div");
    repoWrap.style.marginBottom = "8px";

    const sel = document.createElement("select");
    sel.style.width = "100%";

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
      this.renderNikkeIndex(list);
    } else {
      this.renderNikkie4Index(list);
    }

    container.appendChild(list);
    document.body.appendChild(container);
  }

  private renderNikkeIndex(list: HTMLElement) {
    const indexData = this.nikkeIndex;
    if (!indexData) {
      const msg = document.createElement("div");
      msg.textContent = "Nikke index not loaded";
      list.appendChild(msg);
      return;
    }

    const node =
      this.nikkePathParts && this.nikkePathParts.length
        ? this.resolveNodeByPath(indexData, this.nikkePathParts) || null
        : indexData;

    // Breadcrumbs
    const crumbs = document.createElement("div");
    crumbs.style.marginBottom = "10px";
    crumbs.style.fontSize = "11px";

    const rootCrumb = document.createElement("a");
    rootCrumb.textContent = "/";
    rootCrumb.href = "#";
    rootCrumb.style.color = "#4CAF50";
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
      c.href = "#";
      c.style.color = "#4CAF50";
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
      upRow.style.cssText = "padding: 2px; cursor: pointer; color: #FFC107;";
      upRow.innerHTML = "⬆️ ..";
      upRow.onclick = () => {
        this.nikkePathParts = this.nikkePathParts!.slice(0, -1);
        this.renderNikkeBrowser();
      };
      list.appendChild(upRow);
    }

    // Children directories
    for (const child of node?.children || []) {
      const row = document.createElement("div");
      row.style.cssText = "padding: 2px; cursor: pointer; color: #2196F3;";
      row.innerHTML = "📁 " + child.name;
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
      row.style.cssText = "padding: 2px; color: #FF9800;";
      const icon = f.endsWith(".skel") ? "🦴" : "🗎";
      row.innerHTML = `${icon} ${f}`;
      list.appendChild(row);
    }

    if (modelFiles.length) {
      const loadBtn = document.createElement("button");
      loadBtn.textContent = "Load Model";
      loadBtn.style.cssText = `
        width: 100%;
        padding: 5px;
        margin-top: 5px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      `;
      loadBtn.onclick = () => {
        this.tryLoadModelForPath(this.nikkePathParts || []);
      };
      list.appendChild(loadBtn);
    }
  }

  private renderNikkie4Index(list: HTMLElement) {
    const n4 = this.nikkie4Index;
    if (!n4) {
      const msg = document.createElement("div");
      msg.textContent = "nikkie4 index not loaded";
      list.appendChild(msg);
      return;
    }

    let src: any = n4;
    if (!n4.skins && Array.isArray(n4)) {
      const found = n4.find((x: any) => x && x.skins && Array.isArray(x.skins));
      if (found) src = found;
    }

    for (const ch of src.skins || []) {
      const row = document.createElement("div");
      row.style.cssText = "padding: 2px; cursor: pointer; color: #E91E63;";
      row.innerHTML = `👤 ${ch.name}`;

      const skinContainer = document.createElement("div");
      skinContainer.style.display =
        this.n4ExpandedCharacter === ch.name ? "block" : "none";
      skinContainer.style.marginLeft = "20px";

      for (const s of ch.skins || []) {
        const skinRow = document.createElement("div");
        skinRow.style.cssText =
          "padding: 2px; cursor: pointer; color: #9C27B0;";
        skinRow.innerHTML = `📁 ${s.name} (${s.skin})`;
        skinRow.onclick = () => {
          this.nikkePathParts = ["dotgg", ch.name, s.skin];
          this.tryLoadModelForPath(this.nikkePathParts);
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

  private renderHeadControls() {
    const existing = document.getElementById("head-controls");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "head-controls";
    wrap.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 5px;
      z-index: 1000;
      min-width: 250px;
    `;

    const title = document.createElement("div");
    title.textContent = "Head Controls";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "10px";
    wrap.appendChild(title);

    // Create sliders for various parameters
    this.createSlider(
      wrap,
      "Chain Length",
      this.chainLength,
      1,
      5,
      1,
      (value) => {
        this.chainLength = value;
      }
    );

    this.createSlider(
      wrap,
      "Rotation Scale",
      this.maxTurnScale,
      0,
      2,
      0.05,
      (value) => {
        this.maxTurnScale = value;
      }
    );

    this.createSlider(
      wrap,
      "Parallax Scale",
      this.parallaxScale,
      0,
      10,
      0.05,
      (value) => {
        this.parallaxScale = value;
      }
    );

    this.createSlider(
      wrap,
      "Bend Scale",
      this.headBendScale,
      0,
      2,
      0.05,
      (value) => {
        this.headBendScale = value;
      }
    );

    this.createSlider(
      wrap,
      "Eye Parallax",
      this.eyeParallaxScale,
      0,
      10,
      0.1,
      (value) => {
        this.eyeParallaxScale = value;
      }
    );

    this.createSlider(
      wrap,
      "Parallax Time (ms)",
      this.parallaxLagSeconds * 1000,
      50,
      1000,
      10,
      (value) => {
        this.parallaxLagSeconds = value / 1000;
      }
    );

    this.createSlider(
      wrap,
      "Rotation Time (ms)",
      this.rotationLagSeconds * 1000,
      50,
      1000,
      10,
      (value) => {
        this.rotationLagSeconds = value / 1000;
      }
    );

    this.createSlider(wrap, "Zoom", this.cameraZoom, 0.1, 3, 0.05, (value) => {
      this.cameraZoom = value;
      this.userAdjustedZoom = true;
      this.app.stage.scale.set(this.cameraZoom);
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
    });

    document.body.appendChild(wrap);
  }

  private createSlider(
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
    labelEl.textContent = `${label}: ${
      typeof value === "number" ? value.toFixed(2) : value
    }`;
    labelEl.style.display = "block";
    labelEl.style.marginBottom = "2px";
    container.appendChild(labelEl);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.style.width = "100%";

    input.addEventListener("input", () => {
      const newValue =
        step === 1 ? parseInt(input.value) : parseFloat(input.value);
      onChange(newValue);
      labelEl.textContent = `${label}: ${
        typeof newValue === "number" ? newValue.toFixed(2) : newValue
      }`;
    });

    container.appendChild(input);
    parent.appendChild(container);
  }

  private addUiToggleButton() {
    const existing = document.getElementById("overlay-ui-toggle");
    if (existing) {
      this.uiToggleButton = existing;
      return;
    }

    const btn = document.createElement("button");
    btn.id = "overlay-ui-toggle";
    btn.textContent = "Hide UI";
    btn.style.cssText = `
      position: absolute;
      left: 12px;
      bottom: 12px;
      z-index: 100000;
      padding: 12px 18px;
      font-size: 16px;
      min-width: 140px;
      height: 48px;
      background: rgba(0,0,0,0.7);
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    `;

    btn.onclick = () => {
      this.isUiHidden = !this.isUiHidden;
      if (this.isUiHidden) {
        btn.textContent = "Show UI";
        const headControls = document.getElementById("head-controls");
        if (headControls) headControls.style.display = "none";
        const nikkeBrowser = document.getElementById("nikke-browser");
        if (nikkeBrowser) nikkeBrowser.style.display = "none";

        try {
          (window as any).overlayAPI?.toggleClickThrough?.(true);
          this.clickThroughEnabled = true;
        } catch {}
      } else {
        btn.textContent = "Hide UI";
        const headControls = document.getElementById("head-controls");
        if (headControls) headControls.style.display = "block";
        const nikkeBrowser = document.getElementById("nikke-browser");
        if (nikkeBrowser) nikkeBrowser.style.display = "block";

        try {
          (window as any).overlayAPI?.toggleClickThrough?.(false);
          this.clickThroughEnabled = false;
        } catch {}
      }
    };

    document.body.appendChild(btn);
    this.uiToggleButton = btn;
  }
}

// Initialize the application
const demo = new PixiSpineDemo();

// Export for debugging
(window as any).spineDemo = demo;
