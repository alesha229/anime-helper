import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";
import { SpineAnimationController } from "./spineAnimationController";
import { SpineHeadTracker } from "./spineHeadTracking";
import { BonePhysics } from "./bonePhysics";

export class SpineInteractionHandler {
  private app: PIXI.Application;
  private holder: PIXI.Container;
  private pointerPos: PIXI.Point;
  private spineboy: Spine | null = null;
  private animationController: SpineAnimationController;
  private headTracker: SpineHeadTracker;
  private physicsBones: BonePhysics[];

  constructor(
    app: PIXI.Application,
    holder: PIXI.Container,
    pointerPos: PIXI.Point,
    animationController: SpineAnimationController,
    headTracker: SpineHeadTracker,
    physicsBones: BonePhysics[]
  ) {
    this.app = app;
    this.holder = holder;
    this.pointerPos = pointerPos;
    this.animationController = animationController;
    this.headTracker = headTracker;
    this.physicsBones = physicsBones;
  }

  /**
   * Set physics bones reference
   */
  setPhysicsBones(physicsBones: BonePhysics[]): void {
    this.physicsBones = physicsBones;
  }

  /**
   * Setup drag interaction for Spine model
   */
  setupDragInteraction(spineboy: Spine): void {
    this.spineboy = spineboy;
    if (!this.spineboy) return;
    
    this.spineboy.eventMode = "static";
    this.spineboy.cursor = "grab";
    let isDragging = false;
    let dragOffset = new PIXI.Point();
    
    this.spineboy.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      isDragging = true;
      const globalPos = event.global;
      dragOffset.set(
        this.spineboy!.x - globalPos.x,
        this.spineboy!.y - globalPos.y
      );
      this.spineboy!.cursor = "grabbing";
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
        if (this.spineboy) this.spineboy.cursor = "grab";
      }
    });
    
    this.spineboy.on("pointerover", () => {
      if (!isDragging && this.spineboy) this.spineboy.cursor = "grab";
    });
    
    this.spineboy.on("pointerout", () => {
      if (!isDragging && this.spineboy) this.spineboy.cursor = "auto";
    });
  }

  /**
   * Setup event listeners (keyboard, mouse, etc.)
   */
  setupEventListeners(): void {
    // Setup pointer tracking
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    
    this.app.stage.on("pointermove", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });
    
    this.app.stage.on("pointerdown", (event: PIXI.FederatedPointerEvent) => {
      this.pointerPos.set(event.global.x, event.global.y);
    });

    // Setup keyboard for firing animations
    window.addEventListener("keydown", (e) => {
      if (!this.spineboy) return;

      const { isAim, isCover } = this.animationController.isAimOrCoverModel();
      if (!isAim && !isCover) return;

      // Apply physics force
      this.physicsBones.forEach((bone) => bone.applyRandomForce());

      // Play fire animation
      this.animationController.playFireAnimation();
    });

    // Setup mouse move for aim tracking
    window.addEventListener("mousemove", (ev: MouseEvent) => {
      try {
        const { isAim } = this.animationController.isAimOrCoverModel();
        if (!isAim) return;
        
        const x = ev.screenX;
        const y = ev.screenY;
        this.headTracker.setCaretPosition(x, y, true);
        this.headTracker.updateAimTracks();
      } catch (e) {}
    });

    // Setup overlay API events (if available)
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
                this.headTracker.setCaretPosition(data.screenX, data.screenY);
                this.pointerPos.set(data.screenX, data.screenY);
                this.headTracker.updateAimTracks();
              }
            }
          } catch (e) {}
        });
      }
    } catch (e) {}
  }

  /**
   * Reset interaction state
   */
  reset(): void {
    this.spineboy = null;
  }
}
