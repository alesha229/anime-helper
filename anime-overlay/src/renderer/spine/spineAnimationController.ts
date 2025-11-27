import { Spine } from "@pixi-spine/all-4.1";

export class SpineAnimationController {
  private currentIdleAnimation: string = "idle";
  private actionTimeout: any = null;
  private actionPlaying: boolean = false;
  private spineboy: Spine | null = null;

  /**
   * Set the current Spine model
   */
  setSpineModel(spineboy: Spine): void {
    this.spineboy = spineboy;
  }

  /**
   * Set and play idle animation
   */
  setIdleAnimation(animationName: string): void {
    this.currentIdleAnimation = animationName;
    if (this.spineboy && this.spineboy.state.hasAnimation(animationName)) {
      this.spineboy.state.setAnimation(0, animationName, true);
    }
  }

  /**
   * Get current idle animation name
   */
  getCurrentIdleAnimation(): string {
    return this.currentIdleAnimation;
  }

  /**
   * Check if model is aim or cover type
   */
  isAimOrCoverModel(): { isAim: boolean; isCover: boolean } {
    const currentAnim = (this.currentIdleAnimation || "").toLowerCase();
    return {
      isAim: currentAnim.includes("aim"),
      isCover: currentAnim.includes("cover")
    };
  }

  /**
   * Play a fire/hit animation for aim/cover models
   */
  playFireAnimation(): boolean {
    if (!this.spineboy) return false;

    const { isAim, isCover } = this.isAimOrCoverModel();
    if (!isAim && !isCover) return false;

    try {
      const track = this.spineboy.state.getCurrent(4);
      const fireAnimation = isAim ? 'aim_fire' : 'cover_hit';

      if (track && track.animation.name === fireAnimation && !track.isComplete()) {
        return false;
      }

      this.spineboy.state.setAnimation(4, fireAnimation, false);
      this.spineboy.state.timeScale = 0.7;
      this.spineboy.state.addAnimation(4, this.currentIdleAnimation, true, 0);
      
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Schedule next random action animation
   */
  scheduleNextAction(): void {
    try {
      if (this.actionTimeout) clearTimeout(this.actionTimeout);
      const delay = 6000 + Math.floor(Math.random() * 19000);
      this.actionTimeout = setTimeout(() => {
        this.playActionOnce();
      }, delay);
    } catch (e) {}
  }

  /**
   * Play a one-shot action animation
   */
  private playActionOnce(): void {
    try {
      if (!this.spineboy || this.actionPlaying) return;
      if (this.spineboy.state.hasAnimation("action")) {
        const entry = this.spineboy.state.setAnimation(1, "action", false);
        if (entry) {
          this.actionPlaying = true;
          entry.complete = () => {
            try {
              if (this.spineboy) {
                this.spineboy.state.addAnimation(
                  1,
                  this.currentIdleAnimation || "idle",
                  true,
                  0
                );
              }
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

  /**
   * Stop scheduled actions
   */
  stopScheduledActions(): void {
    try {
      if (this.actionTimeout) {
        clearTimeout(this.actionTimeout);
        this.actionTimeout = null;
      }
      this.actionPlaying = false;
    } catch (e) {}
  }

  /**
   * Start action scheduling for idle models
   */
  startActionScheduling(): void {
    const { isAim, isCover } = this.isAimOrCoverModel();
    if (!isAim && !isCover) {
      this.scheduleNextAction();
    }
  }

  /**
   * Reset controller state
   */
  reset(): void {
    this.stopScheduledActions();
    this.currentIdleAnimation = "idle";
    this.spineboy = null;
  }
}
