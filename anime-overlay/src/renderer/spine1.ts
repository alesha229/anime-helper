import * as PIXI from "pixi.js";
import { ALPHA_MODES } from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";
import { PhysicsConfig, PhysicsSettings } from "./spine/physics-config";
import { BonePhysics } from "./spine/bonePhysics";
import { AdvancedBoneVisualizer } from "./spine/advancedBoneVisualizer";
import { UIManager } from "./spine/uiManager";
import { SpineModelLoader } from "./spine/spineModelLoader";
import { SpineHeadTracker } from "./spine/spineHeadTracking";
import { SpineAnimationController } from "./spine/spineAnimationController";
import { SpineViewportManager } from "./spine/spineViewportManager";
import { SpineInteractionHandler } from "./spine/spineInteractionHandler";

class PixiSpineDemo {
  private app!: PIXI.Application;
  public holder!: PIXI.Container;
  private spineboy!: Spine;
  private pointerPos = new PIXI.Point();
  private nikkeModelKey: string | null = null;
  public nikkePathParts: string[] | null = null;
  public isUiHidden: boolean = false;
  public clickThroughEnabled: boolean = false;
  public currentRepo: "nikke" | "nikkie4" = "nikke";
  public n4ExpandedCharacter: string | null = null;
  private lastFrameTime = 0;
  private state = {
    spineboy: null as Spine | null,
    physicsBones: [] as BonePhysics[],
    isLoading: false,
    boneVisualizer: null as AdvancedBoneVisualizer | null,
  };

  // Module instances
  private modelLoader!: SpineModelLoader;
  private headTracker!: SpineHeadTracker;
  private animationController!: SpineAnimationController;
  private viewportManager!: SpineViewportManager;
  private interactionHandler!: SpineInteractionHandler;
  public ui!: UIManager;

  constructor() {
    // Initialize modules that don't need app/holder first
    this.modelLoader = new SpineModelLoader();
    
    this.init();
    
    // Initialize UI after init
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

    // Initialize modules that depend on app/holder
    this.headTracker = new SpineHeadTracker(this.app, this.holder, this.pointerPos);
    this.animationController = new SpineAnimationController();
    this.viewportManager = new SpineViewportManager(this.app, this.holder);
    this.interactionHandler = new SpineInteractionHandler(
      this.app,
      this.holder,
      this.pointerPos,
      this.animationController,
      this.headTracker,
      this.state.physicsBones
    );

    await this.preload();
    this.create();

    this.app.ticker.add((dt: number) => {
      const deltaTime = this.app.ticker.deltaMS / 1000;
      const currentTime = Date.now();

      if (!this.spineboy) return;

      this.update(deltaTime);

      for (const bone of this.state.physicsBones) {
        bone.computePureWorldTransform();
      }

      for (const bone of this.state.physicsBones) {
        bone.update(deltaTime);
      }

      try {
        this.spineboy.skeleton.updateWorldTransform();
      } catch {}

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

    // Load indexes using model loader
    await this.modelLoader.loadIndexes();

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
    this.interactionHandler.setupEventListeners();

    this.ui.renderNikkeBrowser();
    this.ui.renderHeadControls();
    this.ui.addUiToggleButton();

    window.addEventListener("resize", () => {
      this.holder.x = this.app.screen.width / 2;
      this.holder.y = this.app.screen.height / 2;
      this.viewportManager.fitToViewport();
    });
  }

  private async loadInitialModel() {
    try {
      const nikkeData = this.modelLoader.nikkeIndexData;
      if (nikkeData && this.nikkePathParts && this.nikkePathParts.length) {
        await this.tryLoadModelForPath(this.nikkePathParts);
      } else if (nikkeData && this.nikkeModelKey) {
        const resolved = this.modelLoader.resolveNikkeModel(nikkeData, this.nikkeModelKey);
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
      
      this.animationController.setSpineModel(spineboy);
      this.animationController.setIdleAnimation("idle");
      this.viewportManager.setSpineModel(spineboy);
      this.headTracker.reset();
      this.headTracker.setupTracking(spineboy, false);
      this.interactionHandler.setupDragInteraction(spineboy);
      this.viewportManager.fitToViewport();
    } catch (e) {
      console.error("Failed to spawn local model:", e);
    }
  }

  private update(deltaTime: number) {
    this.headTracker.update(deltaTime);
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
    
    this.animationController.stopScheduledActions();
    this.headTracker.reset();
    this.state.physicsBones = [];
    this.interactionHandler.setPhysicsBones(this.state.physicsBones);

    await this.modelLoader.loadModelFromUrls(
      skelUrl,
      atlasUrl,
      scale,
      idle,
      modelName,
      isNikkie4Model,
      (spineboy, physicsConfig, physicsBones) => {
        // Success callback
        this.holder.addChild(spineboy);
        this.spineboy = spineboy;
        this.state.physicsBones = physicsBones;
        this.interactionHandler.setPhysicsBones(this.state.physicsBones);
        
        // Setup modules
        this.animationController.setSpineModel(spineboy);
        this.animationController.setIdleAnimation(idle);
        this.viewportManager.setSpineModel(spineboy);
        
        const isAimModel = (idle || "").toLowerCase().includes("aim");
        if (isAimModel) {
          this.headTracker.setupAimAnimations(spineboy);
        }
        
        this.headTracker.setupTracking(spineboy, isAimModel);
        this.interactionHandler.setupDragInteraction(spineboy);
        this.viewportManager.fitToViewport();
        
        // Schedule actions for non-aim/cover models
        this.animationController.startActionScheduling();
      },
      (error) => {
        // Error callback
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
    );
  }

  private async tryLoadModelForPath(parts: string[]) {
    await this.modelLoader.tryLoadModelForPath(
      parts,
      this.currentRepo,
      (skelUrl, atlasUrl, idle, modelName, isNikkie4) => {
        this.loadModelFromUrls(skelUrl, atlasUrl, 1, idle, modelName, isNikkie4);
      }
    );
  }

  // Getters for UI and other components
  get nikkeIndexData() {
    return this.modelLoader.nikkeIndexData;
  }

  get nikkie4IndexData() {
    return this.modelLoader.nikkie4IndexData;
  }

  get cameraZoom() {
    return this.viewportManager.cameraZoom;
  }

  set cameraZoom(value: number) {
    this.viewportManager.setZoom(value, false);
  }

  get userAdjustedZoom() {
    return this.viewportManager.userAdjustedZoom;
  }

  set userAdjustedZoom(value: boolean) {
    this.viewportManager.userAdjustedZoom = value;
  }

  get maxTurnScale() {
    return this.headTracker.maxTurnScale;
  }

  set maxTurnScale(value: number) {
    this.headTracker.maxTurnScale = value;
  }

  get chainLength() {
    return this.headTracker.chainLength;
  }

  set chainLength(value: number) {
    this.headTracker.chainLength = value;
  }

  get parallaxMaxOffset() {
    return this.headTracker.parallaxMaxOffset;
  }

  set parallaxMaxOffset(value: number) {
    this.headTracker.parallaxMaxOffset = value;
  }

  get parallaxScale() {
    return this.headTracker.parallaxScale;
  }

  set parallaxScale(value: number) {
    this.headTracker.parallaxScale = value;
  }

  get parallaxLagSeconds() {
    return this.headTracker.parallaxLagSeconds;
  }

  set parallaxLagSeconds(value: number) {
    this.headTracker.parallaxLagSeconds = value;
  }

  get rotationLagSeconds() {
    return this.headTracker.rotationLagSeconds;
  }

  set rotationLagSeconds(value: number) {
    this.headTracker.rotationLagSeconds = value;
  }

  get headBendScale() {
    return this.headTracker.headBendScale;
  }

  set headBendScale(value: number) {
    this.headTracker.headBendScale = value;
  }

  get eyeParallaxScale() {
    return this.headTracker.eyeParallaxScale;
  }

  set eyeParallaxScale(value: number) {
    this.headTracker.eyeParallaxScale = value;
  }
}

const style = document.createElement("style");

window.addEventListener("load", () => {
  new PixiSpineDemo();
});