import * as PIXI from "pixi.js";
import { ALPHA_MODES } from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";
import { PhysicsConfig, PhysicsSettings } from "./spine/physics-config";
import { BonePhysics } from "./spine/bonePhysics";
import { AdvancedBoneVisualizer } from "./spine/advancedBoneVisualizer";
import { UIManager } from "./spine/uiManager";

class PixiSpineDemo {
  private app!: PIXI.Application;
  public holder!: PIXI.Container;
  private spineboy!: Spine;
  private headBone: any | null = null;
  private lookTargetBone: any | null = null;
  private pointerPos = new PIXI.Point();
  private headBaseRotationDeg = 0;
  private aimSmoothing = 0.2;
  private baseMaxTurnDeg = 120;
  public maxTurnScale = 1;
  public chainLength = 1;
  private aimAxisOffsetDeg = -90;
  private nikkeModelKey: string | null = null;
  public nikkePathParts: string[] | null = null;
  private static readonly NIKKE_BASE = "https://nikke-db-legacy.pages.dev/l2d/";
  private static readonly DOTGG_BASE = "https://codeberg.org/alesha229/nikke/src/branch/main";
  private loadToken = 0;
  private isOffsetCalibrated = false;
  private candidateOffsets = [-135, -90, -45, 0, 45, 90, 135, 180, -180];
  private baseRotationByBone: Record<string, number> = {};
  private parentMaxRangeDeg = 15;
  private headBaseLocalX = 0;
  private headBaseLocalY = 0;
  private targetBaseRadius = 40;
  public parallaxMaxOffset = 12;
  public parallaxScale = 1;
  private parallaxSmoothX = 0;
  private parallaxSmoothY = 0;
  private parallaxInitialized = false;
  public parallaxLagSeconds = 0.25;
  public rotationLagSeconds = 0.25;
  public headBendScale = 1;
  private headShearMaxXDeg = 8;
  private headShearMaxYDeg = 4;
  public cameraZoom = 0.3;
  public userAdjustedZoom = false;
  private lookTargetBaseX = 0;
  private lookTargetBaseY = 0;
  private parallaxNeutralRadius = 20;
  private eyeBones: any[] = [];
  private eyeBasePosByName: Record<string, { x: number; y: number }> = {};
  public eyeParallaxScale = 2;
  private eyeParallaxMaxX = 6;
  private eyeParallaxMaxY = 4;
  private rotationEasing:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "smoothstep" = "ease-out";
  private currentIdleAnimation: string = "idle";
  private isAimModel: boolean = false;
  private aimXEntry: any = null;
  private aimYEntry: any = null;
  private latestCaret: { x: number; y: number; isScreen?: boolean } | null =
    null;
  public isUiHidden: boolean = false;
  public clickThroughEnabled: boolean = false;
  public currentRepo: "nikke" | "nikkie4" = "nikke";
  public n4ExpandedCharacter: string | null = null;
  private actionTimeout: any = null;
  private actionPlaying: boolean = false;
  private lastFrameTime = 0;
  private state = {
    spineboy: null as Spine | null,
    physicsBones: [] as BonePhysics[],
    isLoading: false,
    boneVisualizer: null as AdvancedBoneVisualizer | null,
  };

  
  public nikkeIndexData: any = null;
  public nikkie4IndexData: any = null;
  public ui: UIManager;
  
  constructor() {
    this.init();
    this.ui = new UIManager(this);
  }
  
  private async init() {
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
    
    document.body.appendChild(this.app.view as HTMLCanvasElement);
  
    this.holder = new PIXI.Container();
    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
    this.app.stage.addChild(this.holder);
    
    await this.preload();
    this.create();
    
    this.app.ticker.add((dt: number) => {
      const deltaTime = this.app.ticker.deltaMS / 1000;
      const currentTime = Date.now();
     
      if (!this.spineboy) return;
      
      this.update();
      
      for (const bone of this.state.physicsBones) {
        bone.computePureWorldTransform();
      }
      
      for (const bone of this.state.physicsBones) {
        bone.update(deltaTime);
      }
      
      try{this.spineboy.skeleton.updateWorldTransform();
      }catch{}
      
      this.state.boneVisualizer?.update();
    });
  }
  
  private async preload() {
    const params = new URLSearchParams(window.location.search);
    
    try {
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
    
    try {
      const nikkie4Response = await fetch("./nikkie4.2.json");
      if (nikkie4Response.ok) {
        const rawData = await nikkie4Response.json();
        console.log("Raw nikkie4.1.json:", rawData);
        
        if (Array.isArray(rawData) && rawData.length > 3 && rawData[3] && rawData[3].skins) {
          this.nikkie4IndexData = rawData[3];
          console.log("Using nikkie4 data from array[3]:", this.nikkie4IndexData);
        } else if (rawData && rawData.skins) {
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
    
    PIXI.Assets.add({
      alias: "spineboy-data",
      src: "./assets/favorite_c550_00.skel",
    });
    PIXI.Assets.setPreferences({
      preferCreateImageBitmap: false,
    });
  }
  
  private create() {
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
    
    this.loadInitialModel();
    this.setupEventListeners();
    
    this.ui.renderNikkeBrowser();
    this.ui.renderHeadControls();
    this.ui.addUiToggleButton();
    
    window.addEventListener("resize", () => {
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
      this.fitContentToViewport();
    });
  }
  
  private async loadInitialModel() {
    try {
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
            idleAnim,
            'favorive_c550_00'
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
      this.setupSpineboyInteraction();
      this.fitContentToViewport();
      this.isOffsetCalibrated = false;
      this.parallaxInitialized = false;
    } catch (e) {
      console.error("Failed to spawn local model:", e);
    }
  }
  
  private setupEventListeners() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });
    this.app.stage.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });
    
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
    
    window.addEventListener("keydown", (e) => {
      if (!this.spineboy) return;
      
      const currentAnim = (this.currentIdleAnimation || "").toLowerCase();
      const isAimModel = currentAnim.includes("aim");
      const isCoverModel = currentAnim.includes("cover");
      
      if (!isAimModel && !isCoverModel) return;
      
      try {
        const track = this.spineboy.state.getCurrent(4);
        
        const fireAnimation = isAimModel ? 'aim_fire' : 'cover_hit';
        
        if (track && track.animation.name === fireAnimation && !track.isComplete()) return;
        
        this.state.physicsBones.forEach((bone) => bone.applyRandomForce());
        
        this.spineboy.state.setAnimation(4, fireAnimation, false);
        this.spineboy.state.timeScale = 0.7;
        
        this.spineboy.state.addAnimation(4, this.currentIdleAnimation, true, 0);
      } catch (err) {
        // ignore if animation missing
      }
    });
    
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
    });
    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      if (isDragging && this.spineboy) {
        const globalPos = event.global;
        this.spineboy.x = globalPos.x + dragOffset.x;
        this.spineboy.y = globalPos.y + dragOffset.y;
      }
    });
    this.app.stage.on("pointerup", () => {
      if (isDragging) {
        isDragging = false;
        this.spineboy.cursor = "grab";
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
    
    this.headBone =
      skeleton.findBone("head") ||
      skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name)) ||
      null;
    if (this.headBone) {
      this.headBaseRotationDeg = this.headBone.rotation || 0;
    }
    
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
    this.postUpdate(deltaTime);
  }
  
  private postUpdate(deltaTime: number) {
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
    const scaleX = this.spineboy.scale.x;
    const scaleY = this.spineboy.scale.y;
    const pointerWorldX = (this.pointerPos.x - originX) / scaleX;
    const pointerWorldY = (this.pointerPos.y - originY) / scaleY;
    
    if (this.lookTargetBone && this.lookTargetBone.parent) {
      const pos = { x: pointerWorldX, y: pointerWorldY };
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
      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-deltaTime / tau);
      this.parallaxSmoothX += (desX - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (desY - this.parallaxSmoothY) * alpha;
      this.lookTargetBone.x = this.parallaxSmoothX;
      this.lookTargetBone.y = this.parallaxSmoothY;
    }
    
    const head = this.headBone;
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
    const tauRot = Math.max(0.001, this.rotationLagSeconds);
    let alphaRot = 1 - Math.exp(-deltaTime / tauRot);
    alphaRot = this.applyRotationEasing(alphaRot, this.rotationEasing);
    const stepBase = delta * alphaRot;
    
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
  
  private async loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    scale: number,
    idle: string,
    modelName: string,
    isNikkie4Model: boolean = false
  ): Promise<void> {
    if (this.spineboy) {
      this.holder.removeChild(this.spineboy);
      this.spineboy.destroy();
    }
    try {
      if (this.actionTimeout) {
        clearTimeout(this.actionTimeout);
        this.actionTimeout = null;
      }
      this.actionPlaying = false;
    } catch (e) {}
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;
    this.baseRotationByBone = {};
    const localToken = ++this.loadToken;
    
    try {
      PIXI.Assets.add({ alias: `spine-data-${localToken}`, src: skelUrl });
      const resource = await PIXI.Assets.load(`spine-data-${localToken}`);
      PIXI.Assets.setPreferences({ preferCreateImageBitmap: false });
      
      if (localToken !== this.loadToken) return;
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
      
      let physicsFile: string;
      
      if (isNikkie4Model) {
        const parts = modelName.split('/');
        let fileName = parts[parts.length - 1] || modelName;
        const nameParts = fileName.split('_');
        let typeIndex = -1;
        for (let i = 0; i < nameParts.length; i++) {
          const part = nameParts[i].toLowerCase();
          if (part === 'aim' || part === 'cover') {
            typeIndex = i;
            break;
          }
        }
        
        if (typeIndex !== -1) {
          nameParts.splice(typeIndex, 1);
          if (typeIndex > 0) {
            const previousPart = nameParts[typeIndex - 1];
            if (/^\d+$/.test(previousPart)) {
              nameParts.splice(typeIndex);
            }
          }
        }
        
        const cleanedName = nameParts.join('_');
        physicsFile = `${idle.includes('aim') ? 'aim' : idle.includes('cover') ? 'cover' : 'idle'}-physics-${cleanedName}.json`;
      } else {
        const type = modelName.includes("_cover_") ? "cover" : "aim";
        const base = modelName.replace(/_(aim|cover)_/, "_").replace(/^_+|_+$/g, '');
        physicsFile = `${type}-physics-${base}.json`;
      }
      
      console.log("Loading physics file:", physicsFile);
      const physicsConfig: PhysicsConfig = await fetch(
        'physics' + `/${physicsFile}`
      )
        .then((r) => r.json())
        .catch(() => ({} as PhysicsConfig));
      const physicsBoneNames = Object.keys(
        physicsConfig.BoneSpringPhysicsSettingCollection || {}
      );
      const allBoneNames = this.spineboy.skeleton.bones.map((bone) => bone.data.name);
      const matchingBones = allBoneNames.filter((boneName) =>
        physicsBoneNames.includes(boneName)
      );
      const globalSettings = {
        maxForce: 6000,
        maxSpeed: 3000,
        physicsStrengthMultiplier: 0.6,
      };
      for (const bone of this.spineboy.skeleton.bones) {
        const boneName = bone.data.name;
        if (physicsBoneNames.includes(boneName)) {
          const settings =
            physicsConfig.BoneSpringPhysicsSettingCollection[boneName];
          const bonePhysics = new BonePhysics(
            bone,
            settings,
            physicsConfig,
            globalSettings
          );
          this.state.physicsBones.push(bonePhysics);
          console.log(`[MODEL] Bone "${boneName}" added to physics.`);
        }
      }
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
      
      try {
        const isAim = (idle || "").toLowerCase().includes("aim");
        const isCover = (idle || "").toLowerCase().includes("cover");
        if (!isAim && !isCover) {
          this.scheduleNextAction();
        }
      } catch (e) {}
      
    } catch (error) {
      console.error("Failed to load model:", error);
      console.error("URLs:", { skelUrl, atlasUrl });
      
      if (modelName.includes("_")) {
        const parts = modelName.split("_");
        if (parts.length >= 2) {
          const characterName = parts[0];
          const skinName = parts.slice(1).join("_");
          
          const baseUrl = "https://codeberg.org/alesha229/nikke/raw/branch/main";
          const altSkelUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${encodeURIComponent(skinName)}.skel`;
          const altAtlasUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${encodeURIComponent(skinName)}.atlas`;
          
          console.log("Trying alternative URLs:", { altSkelUrl, altAtlasUrl });
          
          try {
            PIXI.Assets.add({ alias: `spine-data-${localToken}`, src: altSkelUrl });
            const resource = await PIXI.Assets.load(`spine-data-${localToken}`);
            
            if (localToken !== this.loadToken) return;
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
            
            console.log("Successfully loaded from alternative location");
            return;
          } catch (altError) {
            console.error("Alternative load failed:", altError);
          }
        }
      }
      
      const errorMsg = document.createElement('div');
      errorMsg.style.position = 'fixed';
      errorMsg.style.top = '20px';
      errorMsg.style.left = '50%';
      errorMsg.style.transform = 'translateX(-50%)';
      errorMsg.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
      errorMsg.style.color = 'white';
      errorMsg.style.padding = '10px 20px';
      errorMsg.style.borderRadius = '5px';
      errorMsg.style.zIndex = '100000';
      errorMsg.textContent = `Failed to load model: ${error.message || error}`;
      document.body.appendChild(errorMsg);
      
      setTimeout(() => {
        document.body.removeChild(errorMsg);
      }, 5000);
    }
  }
  
  private async tryLoadModelForPath(parts: string[]) {
    try {
      if (this.currentRepo === "nikkie4" || (parts && parts[0] === "dotgg")) {
        if (parts.length < 3) return;
        
        const characterName = parts[1];
        const skinName = parts[2];
        if (!characterName || !skinName) return;
        let subfolder = "";
        if (skinName.toLowerCase().includes("aim")) {
          subfolder = "aim/";
        } else if (skinName.toLowerCase().includes("cover")) {
          subfolder = "cover/";
        }
        const baseUrl = "https://codeberg.org/alesha229/nikke/raw/branch/main";
        const atlasUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${subfolder}${encodeURIComponent(skinName)}.atlas`;
        const skelUrl = `${baseUrl}/${encodeURIComponent(characterName)}/${subfolder}${encodeURIComponent(skinName)}.skel`;
        
        const nameHint = skinName.toLowerCase();
        const idleAnim = nameHint.includes("aim")
          ? "aim_idle"
          : nameHint.includes("cover")
          ? "cover_idle"
          : "idle";
        
        await this.loadModelFromUrls(skelUrl, atlasUrl, 1, idleAnim, skinName, true);
        return;
      }
    } catch (e) {
      console.error("Error loading nikkie4 model:", e);
    }
    
    const indexData = this.nikkeIndexData;
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
    
    let modelName = nameHint.split('/').pop()?.split('.').slice(0, -1).join('.') || '';
    await this.loadModelFromUrls(picked.skelUrl, picked.atlasUrl, 1, idleAnim, modelName, false);
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
  

  


  

}

const style = document.createElement("style");


window.addEventListener("load", () => {
  new PixiSpineDemo();
});