import * as Phaser from "phaser";
import * as spine from "@esotericsoftware/spine-phaser";

class SpineDemo extends Phaser.Scene {
  private holder!: Phaser.GameObjects.Container;
  private spineboy!: any; // spine.SpineGameObject, kept as any to avoid strict type coupling
  private headBone: any | null = null;
  private lookTargetBone: any | null = null;
  private pointerPos = new Phaser.Math.Vector2();
  private headBaseRotationDeg = 0;
  private aimSmoothing = 0.2; // 0..1
  private baseMaxTurnDeg = 120; // base clamp around rotation
  private maxTurnScale = 1; // scales the base max turn
  private chainLength = 1; // number of parent nodes from head to affect (>=1)
  private aimAxisOffsetDeg = -90; // adjust if rig's head forward axis isn't +X
  private nikkeModelKey: string | null = null;
  private nikkePathParts: string[] | null = null;
  private static readonly NIKKE_BASE = "https://nikke-db-legacy.pages.dev/l2d/";
  private loadToken = 0;
  private isOffsetCalibrated = false;
  private candidateOffsets = [-135, -90, -45, 0, 45, 90, 135, 180, -180];
  private baseRotationByBone: Record<string, number> = {};
  private parentMaxRangeDeg = 15; // base max deviation for neck/parents, scaled by Offset scale
  private headBaseLocalX = 0;
  private headBaseLocalY = 0;
  private targetBaseRadius = 40; // base radius for look-target in parent local, scaled by Offset scale
  private parallaxMaxOffset = 12; // base max head local offset, scaled by Offset scale
  private parallaxScale = 1; // scales head parallax (target distance/head translation)
  private parallaxSmoothX = 0;
  private parallaxSmoothY = 0;
  private parallaxInitialized = false;
  private parallaxLagSeconds = 0.25; // CSS-like transition time constant
  private rotationLagSeconds = 0.25; // rotation transition time constant
  private headBendScale = 1; // scales head shear-based bending
  private headShearMaxXDeg = 8;
  private headShearMaxYDeg = 4;
  private cameraZoom = 0.3;
  private userAdjustedZoom = false;
  private lookTargetBaseX = 0;
  private lookTargetBaseY = 0;
  private parallaxNeutralRadius = 20; // within this radius (in parent-local units) treat parallax as neutral
  private eyeBones: any[] = [];
  private eyeBasePosByName: Record<string, { x: number; y: number }> = {};
  private eyeParallaxScale = 2; // stronger pupil/iris response
  private eyeParallaxMaxX = 6; // base max local offset on X (scaled)
  private eyeParallaxMaxY = 4; // base max local offset on Y (scaled)
  private rotationEasing:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "smoothstep" = "ease-out";
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isDraggingSpine = false;
  private dragSpineOffsetX = 0;
  private dragSpineOffsetY = 0;

  preload() {
    const params = new URLSearchParams(window.location.search);
    window.overlayAPI.setZoomFactor(0.5);
    window.overlayAPI.enterFullscreen();
    this.nikkeModelKey = params.get("nikke");
    const nikkePath = params.get("nikkePath") || params.get("path");
    this.nikkePathParts = nikkePath
      ? nikkePath
          .split("/")
          .map((p) => p.trim())
          .filter((p) => !!p)
      : null;

    this.load.json("nikke-index", "Nikke.json");
    // Local demo (used as fallback)
    this.load.spineBinary("spineboy-data", "./assets/favorite_c550_00.skel");
    this.load.spineAtlas("spineboy-atlas", "./assets/favorite_c550_00.atlas");
  }

  create() {
    const holder = this.add.container(
      this.cameras.main.centerX,
      this.cameras.main.centerY
    );

    this.holder = holder;

    // Ensure full-viewport canvas and no body margins/scrollbars
    const htmlEl = document.documentElement as HTMLElement;
    const bodyEl = document.body as HTMLBodyElement;
    htmlEl.style.height = "100%";
    htmlEl.style.width = "100%";
    bodyEl.style.margin = "0";
    bodyEl.style.padding = "0";
    bodyEl.style.height = "100%";
    bodyEl.style.width = "100%";
    const canvasEl1 = this.game.canvas as HTMLCanvasElement;
    canvasEl1.style.display = "block";
    canvasEl1.style.width = "100%";
    canvasEl1.style.height = "100%";

    const indexData = this.cache.json.get("nikke-index");

    // Prefer explicit path navigation, then key search, else local fallback
    if (indexData && this.nikkePathParts && this.nikkePathParts.length) {
      this.tryLoadModelForPath(this.nikkePathParts);
    } else if (indexData && this.nikkeModelKey) {
      const resolved = this.resolveNikkeModel(indexData, this.nikkeModelKey);
      if (resolved)
        this.loadModelFromUrls(resolved.skelUrl, resolved.atlasUrl, 1, "idle");
      else this.spawnLocal(holder);
    } else {
      this.spawnLocal(holder);
    }

    // Keep centered on resize and refit content
    this.scale.on("resize", () => {
      holder.x = this.cameras.main.centerX;
      holder.y = this.cameras.main.centerY;
      this.fitContentToViewport();
    });

    // Track pointer position in screen space
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.pointerPos.set(p.x, p.y);
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.pointerPos.set(p.x, p.y);
    });

    // Drag & Drop для модели
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.spineboy) return;
      // Проверяем, попал ли клик по модели (простая проверка по bounding box)
      const local = this.spineboy.getLocalPoint(pointer.x, pointer.y);
      const bounds = (this.spineboy as any).getBounds?.();
      if (bounds) {
        const minX = this.holder.x + this.spineboy.x + bounds.x;
        const minY = this.holder.y + this.spineboy.y + bounds.y;
        const maxX = minX + bounds.width;
        const maxY = minY + bounds.height;
        if (
          pointer.x >= minX &&
          pointer.x <= maxX &&
          pointer.y >= minY &&
          pointer.y <= maxY
        ) {
          this.isDragging = true;
          this.dragOffsetX = this.holder.x + this.spineboy.x - pointer.x;
          this.dragOffsetY = this.holder.y + this.spineboy.y - pointer.y;
          document.body.style.cursor = "grabbing";
          console.log("Drag start", pointer.x, pointer.y);
        }
      }
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && this.spineboy) {
        const newX = pointer.x + this.dragOffsetX;
        const newY = pointer.y + this.dragOffsetY;
        this.spineboy.x = newX - this.holder.x;
        this.spineboy.y = newY - this.holder.y;
        console.log("Drag move", newX, newY);
      }
    });
    this.input.on("pointerup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        document.body.style.cursor = "";
        console.log("Drag end");
      }
    });

    // If running on Canvas, improve downscale quality like in the referenced solution
    const ctx =
      this.game.canvas && this.game.canvas.getContext
        ? (this.game.canvas.getContext("2d") as any)
        : null;
    if (ctx && typeof ctx.imageSmoothingQuality !== "undefined") {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high"; // https://stackoverflow.com/questions/61946774/phaser-3-image-is-pixelated-when-scaled-down
    }

    // Ensure CSS doesn't force pixelated scaling on the canvas element
    const canvasEl = this.game.canvas as HTMLCanvasElement;
    if (canvasEl && canvasEl.style) {
      canvasEl.style.removeProperty("image-rendering");
      canvasEl.style.imageRendering = "auto";
    }

    // Render a minimal Nikke index browser to navigate directories
    if (indexData) this.renderNikkeBrowser(indexData);
    // Render head control sliders
    this.renderHeadControls();
  }

  private setupSpineboyDrag() {
    if (!this.spineboy) return;
    this.spineboy.setInteractive({ cursor: "grab" });
    this.spineboy.on("pointerover", () => {
      document.body.style.cursor = "grab";
    });
    this.spineboy.on("pointerout", () => {
      if (!this.isDraggingSpine) document.body.style.cursor = "";
    });
    this.spineboy.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.isDraggingSpine = true;
      // Координаты pointer в системе сцены
      const localX = pointer.x / this.cameras.main.zoom;
      const localY = pointer.y / this.cameras.main.zoom;
      this.dragSpineOffsetX =
        this.spineboy.x - (localX - this.cameras.main.scrollX);
      this.dragSpineOffsetY =
        this.spineboy.y - (localY - this.cameras.main.scrollY);
      document.body.style.cursor = "grabbing";
      console.log("Spine drag start", localX, localY);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingSpine && this.spineboy) {
        const localX = pointer.x / this.cameras.main.zoom;
        const localY = pointer.y / this.cameras.main.zoom;
        this.spineboy.x =
          localX - this.cameras.main.scrollX + this.dragSpineOffsetX;
        this.spineboy.y =
          localY - this.cameras.main.scrollY + this.dragSpineOffsetY;
        console.log("Spine drag move", this.spineboy.x, this.spineboy.y);
      }
    });
    this.input.on("pointerup", () => {
      if (this.isDraggingSpine) {
        this.isDraggingSpine = false;
        document.body.style.cursor = "";
        console.log("Spine drag end");
      }
    });
  }

  private spawnLocal(holder: Phaser.GameObjects.Container) {
    const spineboy = this.add.spine(0, 400, "spineboy-data", "spineboy-atlas");
    spineboy.scale = 10;
    holder.add(spineboy);
    spineboy.animationState.setAnimation(1, "idle", true);
    this.spineboy = spineboy;
    this.baseRotationByBone = {};
    this.setupHeadAndPointer();
    this.setupSpineboyDrag();
    this.fitContentToViewport();
    this.isOffsetCalibrated = false;
    this.parallaxInitialized = false;
  }

  private setupHeadAndPointer() {
    if (!this.spineboy) return;
    // Detect head and optional look-target bones
    const skeleton = this.spineboy.skeleton as any;
    if (!skeleton) return;

    const nameMatches = (n: string) =>
      /head|голов|голова|headbone|neck|nec|skull/i.test(n);
    this.headBone =
      (skeleton.findBone && skeleton.findBone("head")) ||
      (skeleton.bones &&
        skeleton.bones.find((b: any) => nameMatches(b.data?.name || b.name))) ||
      null;
    if (this.headBone) this.headBaseRotationDeg = this.headBone.rotation || 0;

    // Capture base rotations for head and parents (used for per-bone clamps)
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

    // Detect eye bones and capture their base local positions
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
    if (skeleton.findBone) {
      for (const n of targetNames) {
        const b = skeleton.findBone(n);
        if (b) {
          this.lookTargetBone = b;
          break;
        }
      }
    }
    if (!this.lookTargetBone) {
      const looksLikeHead = (n: string) =>
        /look|aim|target|head|eye/i.test(n || "");
      const pickConstraintTarget = (arr: any[]) => {
        for (const c of arr || []) {
          if (!c || !c.target) continue;
          const bones = c.bones || [];
          const hasHeadLike = bones.some((b: any) =>
            looksLikeHead(b?.data?.name || b?.name)
          );
          if (looksLikeHead(c.name) || hasHeadLike) return c.target;
        }
        return null;
      };
      this.lookTargetBone =
        pickConstraintTarget((skeleton as any).transformConstraints) ||
        pickConstraintTarget((skeleton as any).ikConstraints) ||
        null;
    }

    // Capture base pos for look-target (if present) to define neutral center
    if (this.lookTargetBone) {
      this.lookTargetBaseX = this.lookTargetBone.x || 0;
      this.lookTargetBaseY = this.lookTargetBone.y || 0;
    } else {
      this.lookTargetBaseX = 0;
      this.lookTargetBaseY = 0;
    }

    // Initialize pointer to current head/target screen position to avoid first-frame snapping
    const scaleX = this.spineboy.scaleX ?? this.spineboy.scale ?? 1;
    const scaleY = this.spineboy.scaleY ?? this.spineboy.scale ?? 1;
    const originX = this.holder.x + this.spineboy.x;
    const originY = this.holder.y + this.spineboy.y;
    const anchor = (this.lookTargetBone as any) || (this.headBone as any);
    this.pointerPos.set(
      originX + (anchor?.worldX || 0) * scaleX,
      originY + (anchor?.worldY || 0) * scaleY
    );
  }

  update() {}

  // Run after animations are applied so our manual rotation persists this frame
  private postUpdate = () => {
    if (!this.spineboy || !this.spineboy.skeleton) return;

    const skeleton = this.spineboy.skeleton as any;
    if (!this.headBone) {
      const nameMatches = (n: string) =>
        /head|голов|голова|headbone|neck|nec|skull/i.test(n);
      this.headBone =
        (skeleton.findBone && skeleton.findBone("head")) ||
        (skeleton.bones &&
          skeleton.bones.find((b: any) =>
            nameMatches(b.data?.name || b.name)
          )) ||
        null;
      if (this.headBone) this.headBaseRotationDeg = this.headBone.rotation || 0;
      if (!this.headBone) return;
    }

    const originX = this.holder.x + this.spineboy.x;
    const originY = this.holder.y + this.spineboy.y;

    // Convert pointer from screen space to world space (accounts for camera zoom/scroll)
    const cam = this.cameras.main;
    const worldPoint = cam.getWorldPoint(this.pointerPos.x, this.pointerPos.y);

    // Map from world space to skeleton (root) space
    const scaleX = this.spineboy.scaleX ?? this.spineboy.scale ?? 1;
    const scaleY = this.spineboy.scaleY ?? this.spineboy.scale ?? 1;
    const pointerWorldX = (worldPoint.x - originX) / scaleX;
    const pointerWorldY = (worldPoint.y - originY) / scaleY;

    if (
      this.lookTargetBone &&
      this.lookTargetBone.parent &&
      this.lookTargetBone.parent.worldToLocal
    ) {
      const pos: any = { x: pointerWorldX, y: pointerWorldY };
      this.lookTargetBone.parent.worldToLocal(pos);
      // Compute delta from neutral base
      let dx = pos.x - this.lookTargetBaseX;
      let dy = pos.y - this.lookTargetBaseY;
      const r0 = Math.hypot(dx, dy);
      // Inside neutral radius: no parallax
      if (r0 <= this.parallaxNeutralRadius) {
        dx = 0;
        dy = 0;
      } else if (r0 > 0) {
        // Donut attenuation: subtract neutral radius along the vector, keep direction
        const k0 = (r0 - this.parallaxNeutralRadius) / r0;
        dx *= k0;
        dy *= k0;
      }
      // Scale by parallax and clamp to max radius
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
      // Smooth virtual target (CSS-like transition): exponential toward desired
      if (!this.parallaxInitialized) {
        this.parallaxSmoothX = this.lookTargetBone.x || 0;
        this.parallaxSmoothY = this.lookTargetBone.y || 0;
        this.parallaxInitialized = true;
      }
      const dt = Math.max(0, (this.game.loop.delta || 0) / 1000);
      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-dt / tau);
      this.parallaxSmoothX += (desX - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (desY - this.parallaxSmoothY) * alpha;
      this.lookTargetBone.x = this.parallaxSmoothX;
      this.lookTargetBone.y = this.parallaxSmoothY;
      if ((this.lookTargetBone as any).updateAppliedTransform)
        (this.lookTargetBone as any).updateAppliedTransform();
      if (skeleton.updateWorldTransform) skeleton.updateWorldTransform();
      // Do not return; also apply head/chain rotation so sliders take effect even with look-target rigs
    }

    const head = this.headBone as any;
    const headWorldX = head.worldX || 0;
    const headWorldY = head.worldY || 0;

    const dx = pointerWorldX - headWorldX;
    const dy = pointerWorldY - headWorldY;
    if (dx * dx + dy * dy < 0.0001) return; // deadzone
    let angleDegBase = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Auto-calibrate axis offset on first significant move for rigs with different forward axes
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

    // Convert desired world rotation to local bone rotation
    let desiredLocal = head.worldToLocalRotation
      ? head.worldToLocalRotation(angleDeg)
      : angleDeg;

    // First: scale deviation from base pose by Offset scale
    const offsetFromBase = desiredLocal - this.headBaseRotationDeg;
    desiredLocal =
      this.headBaseRotationDeg + offsetFromBase * this.maxTurnScale;

    // Clamp around base rotation to avoid extreme twisting (scaled by user slider)
    const maxTurn = Math.max(0, this.baseMaxTurnDeg * this.maxTurnScale);
    const minDeg = this.headBaseRotationDeg - maxTurn;
    const maxDeg = this.headBaseRotationDeg + maxTurn;
    desiredLocal = Math.max(minDeg, Math.min(maxDeg, desiredLocal));

    // Smooth rotation using shortest-arc interpolation
    const currentLocal = head.rotation || 0;
    const delta = this.shortestDeltaDeg(currentLocal, desiredLocal);
    // Time-based smoothing (CSS-like transition): exponential toward desired
    const dtRot = Math.max(0, (this.game.loop.delta || 0) / 1000);
    const tauRot = Math.max(0.001, this.rotationLagSeconds);
    let alphaRot = 1 - Math.exp(-dtRot / tauRot);
    alphaRot = Phaser.Math.Clamp(alphaRot, 0, 1);
    alphaRot = this.applyRotationEasing(alphaRot, this.rotationEasing);
    const stepBase = delta * alphaRot;

    // Build chain: head + N parents
    const bones: any[] = [];
    let node: any = head;
    for (let i = 0; i < Math.max(1, this.chainLength) && node; i++) {
      bones.push(node);
      node = node.parent;
    }
    // Normalized geometric falloff weights so total step is preserved
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
      // Clamp per bone: head by head limits, parents by their base limits scaled by Offset scale
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

    // Head bending via shear toward smoothed parallax target
    if (head.parent && head.parent.worldToLocal) {
      const locHead: any = { x: pointerWorldX, y: pointerWorldY };
      head.parent.worldToLocal(locHead);
      // Desired local target with parallax scale and clamp
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
      const nx = Phaser.Math.Clamp(dxh / dMaxShear, -1, 1);
      const ny = Phaser.Math.Clamp(dyh / dMaxShear, -1, 1);
      const targetShearX = nx * this.headShearMaxXDeg * this.headBendScale;
      const targetShearY = ny * this.headShearMaxYDeg * this.headBendScale;
      const dtShear = Math.max(0, (this.game.loop.delta || 0) / 1000);
      const tauShear = Math.max(0.001, this.parallaxLagSeconds);
      const alphaShear = 1 - Math.exp(-dtShear / tauShear);
      head.shearX =
        (head.shearX || 0) + (targetShearX - (head.shearX || 0)) * alphaShear;
      head.shearY =
        (head.shearY || 0) + (targetShearY - (head.shearY || 0)) * alphaShear;
    }

    // Apply extra parallax to eye bones (pupils/iris) toward pointer
    if (this.eyeBones.length) {
      const dtEye = Math.max(0, (this.game.loop.delta || 0) / 1000);
      const tauEye = Math.max(0.001, this.parallaxLagSeconds);
      const alphaEye = 1 - Math.exp(-dtEye / tauEye);
      for (const eye of this.eyeBones) {
        const name = eye.data?.name || eye.name || "eye";
        const base = this.eyeBasePosByName[name] || {
          x: eye.x || 0,
          y: eye.y || 0,
        };
        if (eye.parent && eye.parent.worldToLocal) {
          const loc: any = { x: pointerWorldX, y: pointerWorldY };
          eye.parent.worldToLocal(loc);
          let tx = base.x + (loc.x - base.x) * this.eyeParallaxScale;
          let ty = base.y + (loc.y - base.y) * this.eyeParallaxScale;
          const dx = tx - base.x;
          const dy = ty - base.y;
          // Elliptical clamp for finer control (separate X/Y limits)
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
          if ((eye as any).updateAppliedTransform)
            (eye as any).updateAppliedTransform();
        }
      }
    }

    // Apply head parallax translation toward pointer when no look-target, using base local position and Offset scale
    if (!this.lookTargetBone && head.parent && head.parent.worldToLocal) {
      const loc: any = { x: pointerWorldX, y: pointerWorldY };
      head.parent.worldToLocal(loc);
      // Compute delta from neutral base in head-parent local
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
      // Clamp head local offset from base by scaled max
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
      // Smooth virtual target in head-parent local
      if (!this.parallaxInitialized) {
        this.parallaxSmoothX = head.x || 0;
        this.parallaxSmoothY = head.y || 0;
        this.parallaxInitialized = true;
      }
      const dt = Math.max(0, (this.game.loop.delta || 0) / 1000);
      const tau = Math.max(0.001, this.parallaxLagSeconds);
      const alpha = 1 - Math.exp(-dt / tau);
      this.parallaxSmoothX += (tx - this.parallaxSmoothX) * alpha;
      this.parallaxSmoothY += (ty - this.parallaxSmoothY) * alpha;
      head.x = this.parallaxSmoothX;
      head.y = this.parallaxSmoothY;
    }

    // Sync applied transforms for all modified bones
    for (let i = 0; i < bones.length; i++) {
      if (bones[i].updateAppliedTransform) bones[i].updateAppliedTransform();
    }

    if (head.updateAppliedTransform) head.updateAppliedTransform();
    if (skeleton.updateWorldTransform) skeleton.updateWorldTransform();
  };

  private shortestDeltaDeg(from: number, to: number) {
    let delta = ((to - from + 180) % 360) - 180;
    if (delta < -180) delta += 360;
    return delta;
  }

  // Hook lifecycle events
  init() {
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
  }
  destroy() {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
  }

  private resolveNikkeModel(
    indexRoot: any,
    key: string
  ): { atlasUrl: string; skelUrl: string } | null {
    if (!indexRoot || !key) return null;
    const lcKey = key.toLowerCase();
    let foundPath: string[] | null = null;
    let foundFiles: string[] = [];
    const dfs = (node: any, path: string[]) => {
      if (foundPath) return;
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
    if (!foundPath) return null;
    const base =
      SpineDemo.NIKKE_BASE +
      (foundPath.length ? foundPath.join("/") + "/" : "");
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
    const lower = parts.map((p) => p.toLowerCase());
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
    const base =
      SpineDemo.NIKKE_BASE +
      (this.nikkePathParts ? this.nikkePathParts.join("/") + "/" : "");
    const pick = (ext: string) => {
      const candidates = files.filter((f) => f.toLowerCase().endsWith(ext));
      if (candidates.length === 0) return null;
      // prefer shortest filename (usually base skin)
      candidates.sort((a, b) => a.length - b.length);
      return base + candidates[0];
    };
    const atlasUrl = pick(".atlas");
    const skelUrl = pick(".skel");
    if (!atlasUrl || !skelUrl) return null;
    return { atlasUrl, skelUrl };
  }

  private renderNikkeBrowser(indexRoot: any) {
    const existing = document.getElementById("nikke-browser");
    if (existing) existing.remove();
    const container = document.createElement("div");
    container.id = "nikke-browser";

    // --- BREADCRUMBS ---
    const breadcrumbs = document.createElement("div");
    breadcrumbs.className = "nikke-breadcrumbs";
    const pathParts = this.nikkePathParts || [];
    const fullPath: string[] = [];
    // Корень
    const rootCrumb = document.createElement("a");
    rootCrumb.textContent = "/";
    rootCrumb.onclick = (e) => {
      e.preventDefault();
      console.log("Breadcrumb click:", []);
      this.navigateToPath([]);
    };
    breadcrumbs.appendChild(rootCrumb);
    // Остальные части пути
    pathParts.forEach((part, idx) => {
      breadcrumbs.appendChild(document.createTextNode(" / "));
      const crumb = document.createElement("a");
      fullPath.push(part);
      crumb.textContent = part;
      crumb.onclick = (e) => {
        e.preventDefault();
        const to = pathParts.slice(0, idx + 1);
        console.log("Breadcrumb click:", to);
        this.navigateToPath(to);
      };
      breadcrumbs.appendChild(crumb);
    });
    container.appendChild(breadcrumbs);

    // --- FILE LIST ---
    const node =
      this.nikkePathParts && this.nikkePathParts.length
        ? this.resolveNodeByPath(indexRoot, this.nikkePathParts)
        : indexRoot;
    const list = document.createElement("div");
    list.className = "nikke-file-list";

    // Up one level
    if (this.nikkePathParts && this.nikkePathParts.length) {
      const upRow = document.createElement("div");
      upRow.className = "nikke-file-row folder";
      upRow.innerHTML = '<span class="icon">⬆️</span> ..';
      upRow.onclick = () => {
        const upParts = this.nikkePathParts!.slice(0, -1);
        console.log("Navigate to:", upParts);
        this.navigateToPath(upParts);
      };
      list.appendChild(upRow);
    }

    // Children dirs
    for (const child of node?.children || []) {
      const row = document.createElement("div");
      row.className = "nikke-file-row folder";
      row.innerHTML = '<span class="icon">📁</span>' + child.name;
      row.onclick = () => {
        const parts = [...(this.nikkePathParts || []), child.name];
        console.log("Navigate to:", parts);
        this.navigateToPath(parts);
      };
      list.appendChild(row);
    }

    // Files (модели и прочее)
    const files: string[] = node?.files || [];
    const modelFiles = files.filter(
      (f) => f.endsWith(".skel") || f.endsWith(".atlas")
    );
    const otherFiles = files.filter(
      (f) => !f.endsWith(".skel") && !f.endsWith(".atlas")
    );
    // Модели
    for (const f of modelFiles) {
      const row = document.createElement("div");
      row.className = "nikke-file-row file";
      let icon = f.endsWith(".skel") ? "🦴" : "🗎";
      row.innerHTML = `<span class="icon">${icon}</span>${f}`;
      row.onclick = () => {
        // ничего не делаем, загрузка только кнопкой ниже
      };
      list.appendChild(row);
    }
    // Прочие файлы
    for (const f of otherFiles) {
      const row = document.createElement("div");
      row.className = "nikke-file-row file";
      row.innerHTML = `<span class="icon">📄</span>${f}`;
      row.onclick = () => {};
      list.appendChild(row);
    }

    // Кнопка загрузки модели, если есть .skel/.atlas
    if (modelFiles.length) {
      const loadBtn = document.createElement("button");
      loadBtn.className = "nikke-load-btn";
      loadBtn.textContent = "Загрузить модель из этой папки";
      loadBtn.onclick = () => {
        console.log("Load model:", this.nikkePathParts || []);
        this.tryLoadModelForPath(this.nikkePathParts || []);
      };
      list.appendChild(loadBtn);
    }

    container.appendChild(list);
    document.body.appendChild(container);
  }

  private renderHeadControls() {
    const existing = document.getElementById("head-controls");
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = "head-controls";
    wrap.style.position = "absolute";
    wrap.style.transformOrigin = "top right";
    wrap.style.transform = "scale(2)";
    wrap.style.top = "8px";
    wrap.style.right = "8px";
    wrap.style.background = "rgba(0,0,0,0.6)";
    wrap.style.color = "#fff";
    wrap.style.padding = "8px";
    wrap.style.font = "12px/1.4 monospace";
    wrap.style.borderRadius = "6px";
    wrap.style.zIndex = "1000";
    wrap.style.minWidth = "200px";

    const title = document.createElement("div");
    title.textContent = "Head Controls";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "6px";
    wrap.appendChild(title);

    // Chain length slider
    const chainLabel = document.createElement("label");
    chainLabel.textContent = `Nodes from head: ${this.chainLength}`;
    chainLabel.style.display = "block";
    chainLabel.style.marginBottom = "2px";
    wrap.appendChild(chainLabel);

    const chainInput = document.createElement("input");
    chainInput.type = "range";
    chainInput.min = "1";
    chainInput.max = "5";
    chainInput.step = "1";
    chainInput.value = String(this.chainLength);
    chainInput.style.width = "180px";
    chainInput.addEventListener("input", () => {
      this.chainLength = Math.max(
        1,
        Math.min(5, parseInt(chainInput.value || "1", 10))
      );
      chainLabel.textContent = `Nodes from head: ${this.chainLength}`;
    });
    wrap.appendChild(chainInput);

    // Rotation scale slider (affects deviation/clamps)
    const rotLabel = document.createElement("label");
    rotLabel.textContent = `Rotation scale: ${this.maxTurnScale.toFixed(2)}`;
    rotLabel.style.display = "block";
    rotLabel.style.margin = "8px 0 2px";
    wrap.appendChild(rotLabel);

    const rotInput = document.createElement("input");
    rotInput.type = "range";
    rotInput.min = "0";
    rotInput.max = "2";
    rotInput.step = "0.05";
    rotInput.value = String(this.maxTurnScale);
    rotInput.style.width = "180px";
    rotInput.addEventListener("input", () => {
      this.maxTurnScale = Math.max(
        0,
        Math.min(2, parseFloat(rotInput.value || "1"))
      );
      rotLabel.textContent = `Rotation scale: ${this.maxTurnScale.toFixed(2)}`;
    });
    wrap.appendChild(rotInput);

    // Parallax scale slider (affects look-target distance and head translation)
    const parLabel = document.createElement("label");
    parLabel.textContent = `Parallax scale: ${this.parallaxScale.toFixed(1)}`;
    parLabel.style.display = "block";
    parLabel.style.margin = "8px 0 2px";
    wrap.appendChild(parLabel);

    const parInput = document.createElement("input");
    parInput.type = "range";
    parInput.min = "0";
    parInput.max = "10";
    parInput.step = "0.05";
    parInput.value = String(this.parallaxScale);
    parInput.style.width = "180px";
    parInput.addEventListener("input", () => {
      this.parallaxScale = Math.max(
        0,
        Math.min(10, parseFloat(parInput.value || "1"))
      );
      parLabel.textContent = `Parallax scale: ${this.parallaxScale.toFixed(1)}`;
    });
    wrap.appendChild(parInput);

    // Bend scale slider (shear strength)
    const bendLabel = document.createElement("label");
    bendLabel.textContent = `Bend scale: ${this.headBendScale.toFixed(2)}`;
    bendLabel.style.display = "block";
    bendLabel.style.margin = "8px 0 2px";
    wrap.appendChild(bendLabel);

    const bendInput = document.createElement("input");
    bendInput.type = "range";
    bendInput.min = "0";
    bendInput.max = "2";
    bendInput.step = "0.05";
    bendInput.value = String(this.headBendScale);
    bendInput.style.width = "180px";
    bendInput.addEventListener("input", () => {
      this.headBendScale = Math.max(
        0,
        Math.min(2, parseFloat(bendInput.value || "1"))
      );
      bendLabel.textContent = `Bend scale: ${this.headBendScale.toFixed(2)}`;
    });
    wrap.appendChild(bendInput);

    // Eye parallax scale slider (stronger pupil reaction)
    const eyeLabel = document.createElement("label");
    eyeLabel.textContent = `Eye parallax: ${this.eyeParallaxScale.toFixed(1)}`;
    eyeLabel.style.display = "block";
    eyeLabel.style.margin = "8px 0 2px";
    wrap.appendChild(eyeLabel);

    const eyeInput = document.createElement("input");
    eyeInput.type = "range";
    eyeInput.min = "0";
    eyeInput.max = "10";
    eyeInput.step = "0.1";
    eyeInput.value = String(this.eyeParallaxScale);
    eyeInput.style.width = "180px";
    eyeInput.addEventListener("input", () => {
      this.eyeParallaxScale = Math.max(
        0,
        Math.min(10, parseFloat(eyeInput.value || "2"))
      );
      eyeLabel.textContent = `Eye parallax: ${this.eyeParallaxScale.toFixed(
        1
      )}`;
    });
    wrap.appendChild(eyeInput);

    // Parallax smoothing time (CSS-like transition)
    const smLabel = document.createElement("label");
    smLabel.textContent = `Parallax time: ${
      (this.parallaxLagSeconds * 1000) | 0
    } ms`;
    smLabel.style.display = "block";
    smLabel.style.margin = "8px 0 2px";
    wrap.appendChild(smLabel);

    const smInput = document.createElement("input");
    smInput.type = "range";
    smInput.min = "50";
    smInput.max = "1000";
    smInput.step = "10";
    smInput.value = String((this.parallaxLagSeconds * 1000) | 0);
    smInput.style.width = "180px";
    smInput.addEventListener("input", () => {
      const ms = Math.max(
        50,
        Math.min(1000, parseInt(smInput.value || "250", 10))
      );
      this.parallaxLagSeconds = ms / 1000;
      smLabel.textContent = `Parallax time: ${ms} ms`;
    });
    wrap.appendChild(smInput);

    // Rotation smoothing time
    const rotTLabel = document.createElement("label");
    rotTLabel.textContent = `Rotation time: ${
      (this.rotationLagSeconds * 1000) | 0
    } ms`;
    rotTLabel.style.display = "block";
    rotTLabel.style.margin = "8px 0 2px";
    wrap.appendChild(rotTLabel);

    const rotTInput = document.createElement("input");
    rotTInput.type = "range";
    rotTInput.min = "50";
    rotTInput.max = "1000";
    rotTInput.step = "10";
    rotTInput.value = String((this.rotationLagSeconds * 1000) | 0);
    rotTInput.style.width = "180px";
    rotTInput.addEventListener("input", () => {
      const ms = Math.max(
        50,
        Math.min(1000, parseInt(rotTInput.value || "250", 10))
      );
      this.rotationLagSeconds = ms / 1000;
      rotTLabel.textContent = `Rotation time: ${ms} ms`;
    });
    wrap.appendChild(rotTInput);

    // Zoom slider
    const zoomLabel = document.createElement("label");
    zoomLabel.textContent = `Zoom: ${this.cameraZoom.toFixed(2)}`;
    zoomLabel.style.display = "block";
    zoomLabel.style.margin = "8px 0 2px";
    wrap.appendChild(zoomLabel);

    const zoomInput = document.createElement("input");
    zoomInput.type = "range";
    zoomInput.min = "0.1";
    zoomInput.max = "3";
    zoomInput.step = "0.05";
    zoomInput.value = String(this.cameraZoom);
    zoomInput.style.width = "180px";
    zoomInput.addEventListener("input", () => {
      this.cameraZoom = Math.max(
        0.1,
        Math.min(3, parseFloat(zoomInput.value || "0.3"))
      );
      this.userAdjustedZoom = true;
      zoomLabel.textContent = `Zoom: ${this.cameraZoom.toFixed(2)}`;
      this.cameras.main.setZoom(this.cameraZoom);
      this.holder.x = this.cameras.main.centerX;
      this.holder.y = this.cameras.main.centerY;
    });
    wrap.appendChild(zoomInput);

    document.body.appendChild(wrap);
  }

  private applyRotationEasing(
    x: number,
    mode: typeof this.rotationEasing
  ): number {
    const t = Phaser.Math.Clamp(x, 0, 1);
    switch (mode) {
      case "linear":
        return t;
      case "ease-in": // quad in
        return t * t;
      case "ease-out": // quad out
        return t * (2 - t);
      case "ease-in-out": // cubic in-out
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      case "smoothstep": // 3t^2 - 2t^3
        return t * t * (3 - 2 * t);
      default:
        return t;
    }
  }

  private buildPathHref(parts: string[]) {
    const params = new URLSearchParams(window.location.search);
    if (parts.length) params.set("nikkePath", parts.join("/"));
    else params.delete("nikkePath");
    const qs = params.toString();
    return `${window.location.origin}${window.location.pathname}${
      qs ? "?" + qs : ""
    }`;
  }

  private appendPathLink(
    parent: HTMLElement,
    text: string,
    parts: string[],
    bold: boolean
  ) {
    const a = document.createElement("a");
    a.href = this.buildPathHref(parts);
    a.textContent = text;
    a.style.display = "block";
    if (bold) a.style.fontWeight = "bold";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      this.navigateToPath(parts);
    });
    parent.appendChild(a);
  }

  private navigateToPath(parts: string[]) {
    // Update state
    this.nikkePathParts = parts;
    // Update URL without reload
    const params = new URLSearchParams(window.location.search);
    if (parts.length) params.set("nikkePath", parts.join("/"));
    else params.delete("nikkePath");
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? "?" + qs : ""}`;
    window.history.replaceState(null, "", newUrl);

    // Re-render browser and attempt load
    const indexData = this.cache.json.get("nikke-index");
    this.renderNikkeBrowser(indexData);
    this.tryLoadModelForPath(parts);
  }

  private tryLoadModelForPath(parts: string[]) {
    const indexData = this.cache.json.get("nikke-index");
    if (!indexData) return;
    const node = this.resolveNodeByPath(indexData, parts);
    const picked = node ? this.pickModelFromNode(node) : null;
    if (!picked) return;
    this.loadModelFromUrls(picked.skelUrl, picked.atlasUrl, 1, "idle");
  }

  private loadModelFromUrls(
    skelUrl: string,
    atlasUrl: string,
    scale: number,
    idle: string
  ) {
    // Destroy previous instance if any
    if (this.spineboy) {
      this.spineboy.destroy();
      this.spineboy = null as any;
    }
    // Reset bone refs so they re-init for the new skeleton
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;
    this.baseRotationByBone = {};

    // Token-guard this load to avoid late handlers from previous loads
    const localToken = ++this.loadToken;

    // Unique keys per load
    const dataKey = `nikke-data-${localToken}`;
    const atlasKey = `nikke-atlas-${localToken}`;

    this.load.removeAllListeners();
    this.load.spineBinary(dataKey, skelUrl);
    this.load.spineAtlas(atlasKey, atlasUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (localToken !== this.loadToken) return; // stale load, ignore
      const spineboy = this.add.spine(0, 1000, dataKey, atlasKey);
      this.holder.add(spineboy);
      spineboy.animationState.setAnimation(1, idle, true);
      this.spineboy = spineboy;
      this.setupHeadAndPointer();
      this.setupSpineboyDrag();
      this.fitContentToViewport();
    });
    this.load.start();
  }

  private fitContentToViewport() {
    if (!this.spineboy) return;
    const cam = this.cameras.main;
    // Measure content bounds
    let contentW = 0;
    let contentH = 0;
    try {
      const b = (this.spineboy as any).getBounds?.();
      if (b && (b.width || b.height)) {
        contentW = Math.max(1, b.width);
        contentH = Math.max(1, b.height);
      }
    } catch {}
    if (!contentW || !contentH) {
      const w =
        (this.spineboy as any).displayWidth ?? (this.spineboy as any).width;
      const h =
        (this.spineboy as any).displayHeight ?? (this.spineboy as any).height;
      if (w && h) {
        contentW = Math.max(1, w);
        contentH = Math.max(1, h);
      } else {
        // Fallback to a nominal size if unknown
        contentW = 1000;
        contentH = 1000;
      }
    }

    // Compute auto-fit zoom with padding
    const viewW = this.scale.width || window.innerWidth;
    const viewH = this.scale.height || window.innerHeight;
    const padding = 0.9;
    const zoomX = (viewW * padding) / (contentW || 1);
    const zoomY = (viewH * padding) / (contentH || 1);
    const fitZoom = Math.max(0.01, Math.min(zoomX, zoomY));

    // Use auto-fit until the user changes the zoom manually
    if (!this.userAdjustedZoom) this.cameraZoom = fitZoom;
    cam.setZoom(this.cameraZoom);

    // Ensure holder centered
    this.holder.x = cam.centerX;
    this.holder.y = cam.centerY;
  }
}

const config = {
  type: Phaser.WEBGL,
  width: window.innerWidth,
  height: window.innerHeight,
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  resolution: 4,
  render: {
    transparent: true,
    antialias: true,
    antialiasGL: true,
    desynchronized: false,
    pixelArt: false,
    roundPixels: false,
    clearBeforeRender: true,
    preserveDrawingBuffer: false,
    premultipliedAlpha: true,
    failIfMajorPerformanceCaveat: false,
    powerPreference: "default", // 'high-performance', 'low-power' or 'default'
    batchSize: 4096,
    maxLights: 10,
    maxTextures: -1,
    mipmapFilter: "LINEAR", // 'NEAREST', 'LINEAR', 'NEAREST_MIPMAP_NEAREST', 'LINEAR_MIPMAP_NEAREST', 'NEAREST_MIPMAP_LINEAR', 'LINEAR_MIPMAP_LINEAR'
    autoMobilePipeline: true,
    defaultPipeline: "MultiPipeline",
    // https://stackoverflow.com/questions/61946774/phaser-3-image-is-pixelated-when-scaled-down
  },
  parent: "body",
  scene: [SpineDemo],

  plugins: {
    scene: [
      { key: "spine.SpinePlugin", plugin: spine.SpinePlugin, mapping: "spine" },
    ],
  },
};

new Phaser.Game(config);
