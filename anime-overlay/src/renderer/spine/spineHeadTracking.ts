import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

export class SpineHeadTracker {
  // Head tracking
  private headBone: any | null = null;
  private lookTargetBone: any | null = null;
  private headBaseRotationDeg = 0;
  private aimSmoothing = 0.2;
  private baseMaxTurnDeg = 120;
  public maxTurnScale = 1;
  public chainLength = 1;
  private aimAxisOffsetDeg = -90;
  private isOffsetCalibrated = false;
  private candidateOffsets = [-135, -90, -45, 0, 45, 90, 135, 180, -180];
  private baseRotationByBone: Record<string, number> = {};
  private parentMaxRangeDeg = 15;
  private headBaseLocalX = 0;
  private headBaseLocalY = 0;
  private targetBaseRadius = 40;
  
  // Parallax
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
  private lookTargetBaseX = 0;
  private lookTargetBaseY = 0;
  private parallaxNeutralRadius = 20;
  
  // Eyes
  private eyeBones: any[] = [];
  private eyeBasePosByName: Record<string, { x: number; y: number }> = {};
  public eyeParallaxScale = 2;
  private eyeParallaxMaxX = 6;
  private eyeParallaxMaxY = 4;
  
  // Rotation easing
  private rotationEasing:
    | "linear"
    | "ease-in"
    | "ease-out"
    | "ease-in-out"
    | "smoothstep" = "ease-out";

  // Aim model
  private isAimModel: boolean = false;
  private aimXEntry: any = null;
  private aimYEntry: any = null;
  private latestCaret: { x: number; y: number; isScreen?: boolean } | null = null;
  
  private spineboy: Spine | null = null;
  private pointerPos: PIXI.Point;
  private holder: PIXI.Container;
  private app: PIXI.Application;

  constructor(app: PIXI.Application, holder: PIXI.Container, pointerPos: PIXI.Point) {
    this.app = app;
    this.holder = holder;
    this.pointerPos = pointerPos;
  }

  /**
   * Setup head and eye tracking for a Spine model
   */
  setupTracking(spineboy: Spine, isAimModel: boolean = false): void {
    this.spineboy = spineboy;
    this.isAimModel = isAimModel;
    
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

    // Setup eye tracking
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

    // Setup look target
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
    
    this.isOffsetCalibrated = false;
  }

  /**
   * Update tracking based on pointer position
   */
  update(deltaTime: number): void {
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

    // Update look target bone
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

    // Update head rotation
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

    // Head shear (bend)
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

    // Eye tracking
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

    // Head position (if no look target)
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

  /**
   * Update aim model tracks from caret position
   */
  updateAimTracks(): void {
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
      console.error("Error in updateAimTracks:", e);
    }
  }

  /**
   * Setup aim animations (aim_x, aim_y)
   */
  setupAimAnimations(spineboy: Spine): void {
    this.spineboy = spineboy;
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

  /**
   * Set latest caret position for aim tracking
   */
  setCaretPosition(x: number, y: number, isScreen: boolean = false): void {
    this.latestCaret = { x, y, isScreen };
  }

  /**
   * Reset tracking state
   */
  reset(): void {
    this.headBone = null;
    this.lookTargetBone = null;
    this.isOffsetCalibrated = false;
    this.baseRotationByBone = {};
    this.parallaxInitialized = false;
    this.eyeBones = [];
    this.eyeBasePosByName = {};
    this.isAimModel = false;
    this.aimXEntry = null;
    this.aimYEntry = null;
    this.latestCaret = null;
  }

  private shortestDeltaDeg(from: number, to: number): number {
    let delta = ((to - from + 180) % 360) - 180;
    if (delta < -180) delta += 360;
    return delta;
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
