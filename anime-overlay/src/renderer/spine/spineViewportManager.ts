import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

export class SpineViewportManager {
  public cameraZoom = 0.3;
  public userAdjustedZoom = false;

  private app: PIXI.Application;
  private holder: PIXI.Container;
  private spineboy: Spine | null = null;

  constructor(app: PIXI.Application, holder: PIXI.Container) {
    this.app = app;
    this.holder = holder;
  }

  /**
   * Set the current Spine model
   */
  setSpineModel(spineboy: Spine): void {
    this.spineboy = spineboy;
  }

  /**
   * Fit content to viewport
   */
  fitToViewport(): void {
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

  /**
   * Set zoom level
   */
  setZoom(zoom: number, userAdjusted: boolean = false): void {
    this.cameraZoom = Math.max(0.01, zoom);
    this.holder.scale.set(this.cameraZoom);
    if (userAdjusted) {
      this.userAdjustedZoom = true;
    }
  }

  /**
   * Center content in viewport
   */
  centerContent(): void {
    this.holder.x = this.app.screen.width / 2;
    this.holder.y = this.app.screen.height / 2;
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.cameraZoom;
  }

  /**
   * Reset zoom state
   */
  resetZoom(): void {
    this.userAdjustedZoom = false;
  }
}
