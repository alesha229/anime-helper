import * as PIXI from "pixi.js";
import { PhysicsConfig, PhysicsSettings } from "./physics-config";

export class BonePhysics {
  public bone: any;
  public settings: PhysicsSettings;
  public currentPosition: PIXI.Point;
  public velocity: PIXI.Point;
  public initialLocalPosition: PIXI.Point;
  public currentRotation: number;
  public angleVelocity: number;
  private previousPosition: PIXI.Point;
  private previousRotation: number;
  private isInitialized: boolean;
  private lastHolderPosition: PIXI.Point;
  private holderVelocity: PIXI.Point;
  private physicsConfig: PhysicsConfig;
  private globalSettings: any;
  private originalBoneLength: number;

  private pureAnimationLocalX: number = 0;
  private pureAnimationLocalY: number = 0;
  private pureAnimationLocalRotation: number = 0;
  private pureAnimationLocalScaleX: number = 1;
  private pureAnimationLocalScaleY: number = 1;

  private pureWorldX: number = 0;
  private pureWorldY: number = 0;
  private pureWorldRotation: number = 0;

  private pureBoneLength: number = 0;

  private warmupTime: number = 0;
  private warmupDuration: number = 0.5;
  private isWarmedUp: boolean = false;
  private restPosition: PIXI.Point;
  private restRotation: number;
  private frameCount: number = 0;

  private isHipBone: boolean = false;
  private isAtBone: boolean = false;

  constructor(
    bone: any,
    settings: PhysicsSettings,
    physicsConfig: PhysicsConfig,
    globalSettings: any
  ) {
    this.bone = bone;
    this.settings = settings;
    this.physicsConfig = physicsConfig;
    this.globalSettings = globalSettings;

    const boneName = bone.data?.name || "";
    this.isHipBone = boneName.includes("#") || !boneName;
    this.isAtBone = boneName.includes("@");

    if (this.isHipBone) {
      this.pureAnimationLocalX = bone.data.x;
      this.pureAnimationLocalY = bone.data.y;
      this.pureAnimationLocalRotation = bone.data.rotation;
      this.pureAnimationLocalScaleX = bone.data.scaleX;
      this.pureAnimationLocalScaleY = bone.data.scaleY;
    } else {
      this.pureAnimationLocalX = bone.x;
      this.pureAnimationLocalY = bone.y;
      this.pureAnimationLocalRotation = bone.rotation;
      this.pureAnimationLocalScaleX = bone.scaleX;
      this.pureAnimationLocalScaleY = bone.scaleY;
    }

    this.initialLocalPosition = new PIXI.Point(bone.x, bone.y);
    this.currentPosition = new PIXI.Point(0, 0);
    this.previousPosition = new PIXI.Point(0, 0);
    this.restPosition = new PIXI.Point(0, 0);
    this.velocity = new PIXI.Point(0, 0);
    this.currentRotation = 0;
    this.previousRotation = 0;
    this.restRotation = 0;
    this.angleVelocity = 0;
    this.isInitialized = false;
    this.lastHolderPosition = new PIXI.Point(0, 0);
    this.holderVelocity = new PIXI.Point(0, 0);

    this.computePureBoneLength();
    this.originalBoneLength = this.pureBoneLength;
  }

  private computePureBoneLength() {
    if (!this.bone.parent) {
      this.pureBoneLength = Math.sqrt(
        this.pureAnimationLocalX * this.pureAnimationLocalX +
          this.pureAnimationLocalY * this.pureAnimationLocalY
      );
    } else {
      let parentLocalX = 0;
      let parentLocalY = 0;

      if (this.bone.parent.physics) {
        parentLocalX = this.bone.parent.physics.pureAnimationLocalX;
        parentLocalY = this.bone.parent.physics.pureAnimationLocalY;
      } else {
        parentLocalX = this.bone.parent.x;
        parentLocalY = this.bone.parent.y;
      }

      const dx = this.pureAnimationLocalX - parentLocalX;
      const dy = this.pureAnimationLocalY - parentLocalY;
      this.pureBoneLength = Math.sqrt(dx * dx + dy * dy);
    }

    if (this.pureBoneLength < 1.0) {
      this.pureBoneLength = 1.0;
    }
  }

  public computePureWorldTransform() {
    this.computePureBoneLength();

    if (!this.bone.parent) {
      this.pureWorldX = this.pureAnimationLocalX;
      this.pureWorldY = this.pureAnimationLocalY;
      this.pureWorldRotation = this.pureAnimationLocalRotation;
      return;
    }

    if (this.isAtBone) {
      const parentWorldX = this.bone.parent.worldX;
      const parentWorldY = this.bone.parent.worldY;
      const parentWorldRotation = this.bone.parent.rotation;

      const localDeltaX =
        this.pureAnimationLocalX - this.initialLocalPosition.x;
      const localDeltaY =
        this.pureAnimationLocalY - this.initialLocalPosition.y;

      const cos = Math.cos(parentWorldRotation);
      const sin = Math.sin(parentWorldRotation);

      this.pureWorldX = parentWorldX + (localDeltaX * cos - localDeltaY * sin);
      this.pureWorldY = parentWorldY + (localDeltaX * sin + localDeltaY * cos);
      this.pureWorldRotation =
        parentWorldRotation + this.pureAnimationLocalRotation;
      return;
    }

    let parentPureWorldX = 0;
    let parentPureWorldY = 0;
    let parentPureWorldRotation = 0;

    if (this.bone.parent.physics) {
      parentPureWorldX = this.bone.parent.physics.pureWorldX;
      parentPureWorldY = this.bone.parent.physics.pureWorldY;
      parentPureWorldRotation = this.bone.parent.physics.pureWorldRotation;
    } else {
      parentPureWorldX = this.bone.parent.worldX;
      parentPureWorldY = this.bone.parent.worldY;
      parentPureWorldRotation = this.bone.parent.rotation;
    }

    const cos = Math.cos(parentPureWorldRotation);
    const sin = Math.sin(parentPureWorldRotation);

    this.pureWorldX =
      parentPureWorldX +
      (this.pureAnimationLocalX * cos - this.pureAnimationLocalY * sin);
    this.pureWorldY =
      parentPureWorldY +
      (this.pureAnimationLocalX * sin + this.pureAnimationLocalY * cos);
    this.pureWorldRotation =
      parentPureWorldRotation + this.pureAnimationLocalRotation;
  }

  get pureAnimationWorldX(): number {
    return this.pureWorldX;
  }
  get pureAnimationWorldY(): number {
    return this.pureWorldY;
  }
  get pureAnimationWorldRotation(): number {
    return this.pureWorldRotation;
  }

  initialize(holderPosition: PIXI.Point) {
    if (!this.isInitialized) {
      this.computePureWorldTransform();

      this.currentPosition.set(
        this.pureAnimationWorldX,
        this.pureAnimationWorldY
      );
      this.previousPosition.set(
        this.pureAnimationWorldX,
        this.pureAnimationWorldY
      );
      this.restPosition.set(this.pureAnimationWorldX, this.pureAnimationWorldY);
      this.currentRotation = this.pureAnimationWorldRotation;
      this.previousRotation = this.pureAnimationWorldRotation;
      this.restRotation = this.pureAnimationWorldRotation;

      this.originalBoneLength = this.pureBoneLength;

      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      this.lastHolderPosition.copyFrom(holderPosition);
      this.holderVelocity.set(0, 0);
      this.isInitialized = true;
      this.warmupTime = 0;
      this.frameCount = 0;
    }
  }

  private shouldApplyPhysics(deltaTime: number): boolean {
    this.frameCount++;
    this.warmupTime += deltaTime;

    if (this.frameCount < 5) return false;

    const animationMovement = Math.sqrt(
      (this.pureAnimationWorldX - this.previousPosition.x) ** 2 +
        (this.pureAnimationWorldY - this.previousPosition.y) ** 2
    );

    const animationRotationChange = Math.abs(
      this.pureAnimationWorldRotation - this.previousRotation
    );

    if (animationMovement > 0.5 || animationRotationChange > 0.01) {
      this.isWarmedUp = true;
      return true;
    }

    const totalMovement = Math.sqrt(
      (this.pureAnimationWorldX - this.restPosition.x) ** 2 +
        (this.pureAnimationWorldY - this.restPosition.y) ** 2
    );

    if (totalMovement > 2.0) {
      this.isWarmedUp = true;
      return true;
    }

    if (this.warmupTime >= this.warmupDuration) {
      this.isWarmedUp = true;
      return true;
    }

    return false;
  }

  private getForceMultiplier(): number {
    if (!this.isWarmedUp) return 0;

    const rampTime = 0.5;
    const timeAfterWarmup = Math.max(0, this.warmupTime - this.warmupDuration);

    if (timeAfterWarmup < rampTime) {
      return (timeAfterWarmup / rampTime) * this.settings.ForceMultiplier;
    }

    return this.settings.ForceMultiplier;
  }

  updateHolderVelocity(currentHolderPosition: PIXI.Point, deltaTime: number) {
    if (deltaTime > 0) {
      this.holderVelocity.set(
        (currentHolderPosition.x - this.lastHolderPosition.x) / deltaTime,
        (currentHolderPosition.y - this.lastHolderPosition.y) / deltaTime
      );
      this.lastHolderPosition.copyFrom(currentHolderPosition);
    }
  }

  applyHolderInertia(deltaTime: number) {
    if (this.settings.Mass > 0) {
      const inertiaFactor = 0.5 / this.settings.Mass;
      this.velocity.x += this.holderVelocity.x * inertiaFactor;
      this.velocity.y += this.holderVelocity.y * inertiaFactor;
    }
  }

  applyRandomForce(multiplayer: number = 1000) {
    if (
      !this.settings.FixPosition &&
      this.settings.Mass > 0 &&
      this.isWarmedUp
    ) {
      const force =
        (this.physicsConfig.FireShakeMinForce +
          Math.random() *
            (this.physicsConfig.FireShakeMaxForce -
              this.physicsConfig.FireShakeMinForce)) *
        this.globalSettings.physicsStrengthMultiplier;
      const minAngle = this.physicsConfig.ForceRandomAngleMin * (Math.PI / 180);
      const maxAngle = this.physicsConfig.ForceRandomAngleMax * (Math.PI / 180);
      const angle = minAngle + Math.random() * (maxAngle - minAngle);

      this.velocity.x += Math.cos(angle) * force * multiplayer;
      this.velocity.y += Math.sin(angle) * force * multiplayer;

      const rotationImpulse =
        force * 0.02 * this.globalSettings.physicsStrengthMultiplier;
      this.angleVelocity += (Math.random() - 0.5) * 2 * rotationImpulse;
    }
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  private applyToBone() {
    if (this.bone.parent) {
      let parentWorldX = 0;
      let parentWorldY = 0;
      let parentWorldRotation = 0;

      if (this.isAtBone) {
        parentWorldX = this.bone.parent.worldX;
        parentWorldY = this.bone.parent.worldY;
        parentWorldRotation = this.bone.parent.rotation;
      } else {
        if (this.bone.parent.physics) {
          parentWorldX = this.bone.parent.physics.pureWorldX;
          parentWorldY = this.bone.parent.physics.pureWorldY;
          parentWorldRotation = this.bone.parent.physics.pureWorldRotation;
        } else {
          parentWorldX = this.bone.parent.worldX;
          parentWorldY = this.bone.parent.worldY;
          parentWorldRotation = this.bone.parent.rotation;
        }
      }

      const worldDeltaX = this.currentPosition.x - parentWorldX;
      const worldDeltaY = this.currentPosition.y - parentWorldY;

      const cos = Math.cos(-parentWorldRotation);
      const sin = Math.sin(-parentWorldRotation);

      const localDeltaX = worldDeltaX * cos - worldDeltaY * sin;
      const localDeltaY = worldDeltaX * sin + worldDeltaY * cos;

      if (this.isAtBone) {
        this.bone.x = this.initialLocalPosition.x + localDeltaX * 0.4;
        this.bone.y = this.initialLocalPosition.y + localDeltaY * 0.4;
      } else {
        this.bone.x =
          this.pureAnimationLocalX +
          localDeltaX * (this.globalSettings.physicsStrengthMultiplier / 2);
        this.bone.y =
          this.pureAnimationLocalY +
          localDeltaY * (this.globalSettings.physicsStrengthMultiplier / 2);
      }

      if (this.frameCount % 60 === 0) {
        const boneName = this.bone.data?.name || "unnamed";
        const boneType = this.isHipBone ? "#" : this.isAtBone ? "@" : "unnamed";
      }
    } else {
      this.bone.x =
        this.initialLocalPosition.x +
        (this.currentPosition.x - this.pureAnimationWorldX);
      this.bone.y =
        this.initialLocalPosition.y +
        (this.currentPosition.y - this.pureAnimationWorldY);
    }
  }

  private applyConstraints() {
    if (!this.bone.parent) return;

    let parentWorldX = 0;
    let parentWorldY = 0;
    let parentWorldRotation = 0;

    if (this.isAtBone) {
      parentWorldX = this.bone.parent.worldX;
      parentWorldY = this.bone.parent.worldY;
      parentWorldRotation = this.bone.parent.rotation;
    } else {
      if (this.bone.parent.physics) {
        parentWorldX = this.bone.parent.physics.pureWorldX;
        parentWorldY = this.bone.parent.physics.pureWorldY;
        parentWorldRotation = this.bone.parent.physics.pureWorldRotation;
      } else {
        parentWorldX = this.bone.parent.worldX;
        parentWorldY = this.bone.parent.worldY;
        parentWorldRotation = this.bone.parent.rotation;
      }
    }

    const currentWorldVector = new PIXI.Point(
      this.currentPosition.x - parentWorldX,
      this.currentPosition.y - parentWorldY
    );

    const currentDistance = Math.sqrt(
      currentWorldVector.x * currentWorldVector.x +
        currentWorldVector.y * currentWorldVector.y
    );

    const maxDistance = this.pureBoneLength * this.settings.StretchLimit;

    if (currentDistance > maxDistance && currentDistance > 0.001) {
      const ratio = maxDistance / currentDistance;
      this.currentPosition.set(
        parentWorldX + currentWorldVector.x * ratio,
        parentWorldY + currentWorldVector.y * ratio
      );

      const normal = new PIXI.Point(
        currentWorldVector.x / currentDistance,
        currentWorldVector.y / currentDistance
      );

      const velocityDotNormal =
        this.velocity.x * normal.x + this.velocity.y * normal.y;

      if (velocityDotNormal > 0) {
        this.velocity.x -= velocityDotNormal * normal.x * 0.8;
        this.velocity.y -= velocityDotNormal * normal.y * 0.8;
      }
    }

    if (this.settings.AngleLimit < 180) {
      const relativeRotation = this.normalizeAngle(
        this.currentRotation - parentWorldRotation
      );
      const angleLimit = this.settings.AngleLimit * (Math.PI / 180);

      if (Math.abs(relativeRotation) > angleLimit) {
        const correction = Math.sign(relativeRotation) * angleLimit;
        const oldRotation = this.currentRotation;
        this.currentRotation = parentWorldRotation + correction;

        const rotationDiff = this.currentRotation - oldRotation;
        this.angleVelocity += (rotationDiff / 0.016) * 0.5;
      }
    }

    if (this.settings.FixSpringLength) {
      if (currentDistance > 0.001) {
        const ratio = this.pureBoneLength / currentDistance;
        this.currentPosition.set(
          parentWorldX + currentWorldVector.x * ratio,
          parentWorldY + currentWorldVector.y * ratio
        );
      }
    }
  }

  public update(deltaTime: number) {
    if (deltaTime === 0) return;

    

    if (!this.shouldApplyPhysics(deltaTime)) {
      this.currentPosition.set(
        this.pureAnimationWorldX,
        this.pureAnimationWorldY
      );
      this.currentRotation = this.pureAnimationWorldRotation;
      this.restPosition.set(this.pureAnimationWorldX, this.pureAnimationWorldY);
      this.restRotation = this.pureAnimationWorldRotation;
      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      this.previousPosition.copyFrom(this.currentPosition);
      this.previousRotation = this.currentRotation;
      return;
    }

    // this.updateHolderVelocity(holderPosition, deltaTime);

    if (this.settings.FixPosition) {
      this.currentPosition.set(
        this.pureAnimationWorldX,
        this.pureAnimationWorldY
      );
      this.currentRotation = this.pureAnimationWorldRotation;
      this.velocity.set(0, 0);
      this.angleVelocity = 0;
      return;
    }

    this.applyHolderInertia(deltaTime);
    this.previousPosition.copyFrom(this.currentPosition);
    this.previousRotation = this.currentRotation;

    const targetX = this.pureAnimationWorldX;
    const targetY = this.pureAnimationWorldY;
    const targetRotation = this.pureAnimationWorldRotation;

    const springForceX =
      (targetX - this.currentPosition.x) * this.settings.Shiftiness;
    const springForceY =
      (targetY - this.currentPosition.y) * this.settings.Shiftiness;
    const dampingForceX = -this.velocity.x * this.settings.Damping;
    const dampingForceY = -this.velocity.y * this.settings.Damping;

    const angleSpringForce =
      (targetRotation - this.currentRotation) *
      this.settings.SupportSpringShiftiness;
    const angleDampingForce =
      -this.angleVelocity * this.settings.SupportSpringDamping;

    const forceMultiplier = this.globalSettings.physicsStrengthMultiplier;

    let totalForceX =
      (springForceX + dampingForceX) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalForceY =
      (springForceY + dampingForceY) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;
    let totalAngleForce =
      (angleSpringForce + angleDampingForce) *
      forceMultiplier *
      this.globalSettings.physicsStrengthMultiplier;

    const maxForce = this.globalSettings.maxForce || 10000;
    totalForceX = Math.max(-maxForce, Math.min(maxForce, totalForceX));
    totalForceY = Math.max(-maxForce, Math.min(maxForce, totalForceY));
    totalAngleForce = Math.max(-maxForce, Math.min(maxForce, totalAngleForce));

    this.velocity.x += (totalForceX / this.settings.Mass) * deltaTime;
    this.velocity.y += (totalForceY / this.settings.Mass) * deltaTime;
    this.angleVelocity += (totalAngleForce / this.settings.Mass) * deltaTime;

    const maxSpeed = this.globalSettings.maxSpeed || 1000;
    const speed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y
    );

    if (speed > maxSpeed) {
      this.velocity.x = (this.velocity.x / speed) * maxSpeed;
      this.velocity.y = (this.velocity.y / speed) * maxSpeed;
    }

    this.currentPosition.x += this.velocity.x * deltaTime;
    this.currentPosition.y += this.velocity.y * deltaTime;
    this.currentRotation += this.angleVelocity * deltaTime;
    this.currentRotation = this.normalizeAngle(this.currentRotation);

    this.applyConstraints();

    this.velocity.set(
      (this.currentPosition.x - this.previousPosition.x) / deltaTime,
      (this.currentPosition.y - this.previousPosition.y) / deltaTime
    );
    this.angleVelocity =
      (this.currentRotation - this.previousRotation) / deltaTime;

    const velocityThreshold = 0.1;
    if (Math.abs(this.velocity.x) < velocityThreshold) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < velocityThreshold) this.velocity.y = 0;
    if (Math.abs(this.angleVelocity) < velocityThreshold)
      this.angleVelocity = 0;

    this.applyToBone();
  }

  public resetPhysics() {
    this.warmupTime = 0;
    this.frameCount = 0;
    this.isWarmedUp = false;
    this.isInitialized = false;
    this.velocity.set(0, 0);
    this.angleVelocity = 0;
  }

  public forceActivatePhysics() {
    this.isWarmedUp = true;
    this.warmupTime = this.warmupDuration + 1;
    this.frameCount = 10;
  }

  public get isPhysicsActive(): boolean {
    return this.isWarmedUp;
  }

  public get currentBoneLength(): number {
    if (this.bone.parent) {
      let parentWorldX = 0;
      let parentWorldY = 0;

      if (this.bone.parent.physics) {
        parentWorldX = this.bone.parent.physics.currentPosition.x;
        parentWorldY = this.bone.parent.physics.currentPosition.y;
      } else {
        parentWorldX = this.bone.parent.worldX;
        parentWorldY = this.bone.parent.worldY;
      }

      const deltaX = this.currentPosition.x - parentWorldX;
      const deltaY = this.currentPosition.y - parentWorldY;
      return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
    return 0;
  }

  public get initialBoneLength(): number {
    return this.pureBoneLength;
  }

  public getDebugInfo(): any {
    const boneName = this.bone.data?.name || "unnamed";
    const boneType = this.isHipBone ? "#" : this.isAtBone ? "@" : "unnamed";

    return {
      boneName: boneName,
      boneType: boneType,
      isInitialized: this.isInitialized,
      isWarmedUp: this.isWarmedUp,
      frameCount: this.frameCount,
      warmupTime: this.warmupTime,
      originalBoneLength: this.originalBoneLength,
      currentBoneLength: this.currentBoneLength,
      stretchLimit: this.settings.StretchLimit,
      maxAllowedLength: this.originalBoneLength * this.settings.StretchLimit,
      currentPosition: { x: this.currentPosition.x, y: this.currentPosition.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      pureAnimationPosition: {
        x: this.pureAnimationWorldX,
        y: this.pureAnimationWorldY,
      },
      boneLocalPosition: { x: this.bone.x, y: this.bone.y },
      settings: this.settings,
    };
  }
}
