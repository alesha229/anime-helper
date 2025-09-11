// optimized-bone-visualizer.ts
import * as PIXI from "pixi.js";

export class AdvancedBoneVisualizer {
  private graphics: PIXI.Graphics;
  private textContainer: PIXI.Container;
  private app: PIXI.Application;
  private boneMap: Map<string, any> = new Map();
  private textStyles: Map<string, PIXI.TextStyle> = new Map();
  private visible: boolean = true;
  private debugMode: boolean = false;
  private spineObject: any = null;

  // Пул для переиспользования объектов
  private textPool: PIXI.Text[] = [];
  private usedTexts: PIXI.Text[] = [];

  // Кеш для избежания лишних вычислений
  private screenPositionCache: Map<
    string,
    { x: number; y: number; frame: number }
  > = new Map();
  private currentFrame: number = 0;

  // Флаг для предотвращения множественных обновлений в одном кадре
  private needsUpdate: boolean = false;
  private updateScheduled: boolean = false;

  constructor(app: PIXI.Application, spineObject?: any) {
    this.app = app;
    this.spineObject = spineObject;

    this.graphics = new PIXI.Graphics();
    this.textContainer = new PIXI.Container();

    this.app.stage.addChild(this.graphics);
    this.app.stage.addChild(this.textContainer);

    // Оптимизация интерактивности
    this.graphics.eventMode = "static";
    this.graphics.cursor = "pointer";

    this.initTextStyles();
    this.initEventListeners();

    // Предварительно создаем пул текстовых объектов
    this.initTextPool(50);

    if (this.debugMode) {
      console.log("Оптимизированный визуализатор костей инициализирован");
    }
  }

  private initTextPool(size: number) {
    for (let i = 0; i < size; i++) {
      const text = new PIXI.Text("", this.textStyles.get("boneName"));
      text.visible = false;
      this.textPool.push(text);
      this.textContainer.addChild(text);
    }
  }

  private getTextFromPool(): PIXI.Text | null {
    if (this.textPool.length > 0) {
      const text = this.textPool.pop()!;
      this.usedTexts.push(text);
      return text;
    }
    return null;
  }

  private returnTextToPool(text: PIXI.Text) {
    text.visible = false;
    text.text = "";
    const index = this.usedTexts.indexOf(text);
    if (index > -1) {
      this.usedTexts.splice(index, 1);
      this.textPool.push(text);
    }
  }

  private returnAllTextsToPool() {
    while (this.usedTexts.length > 0) {
      this.returnTextToPool(this.usedTexts[0]);
    }
  }

  private initTextStyles() {
    // Переиспользуем стили вместо создания новых
    if (!this.textStyles.has("boneName")) {
      this.textStyles.set(
        "boneName",
        new PIXI.TextStyle({
          fontSize: 14,
          fill: 0xffffff,
          fontWeight: "bold",
          stroke: 0x000000,
          strokeThickness: 3,
        })
      );
    }

    if (!this.textStyles.has("boneInfo")) {
      this.textStyles.set(
        "boneInfo",
        new PIXI.TextStyle({
          fontSize: 12,
          fill: 0xcccccc,
          stroke: 0x000000,
          strokeThickness: 2,
        })
      );
    }
  }

  private initEventListeners() {
    // Дебаунс для кликов
    let clickTimeout: NodeJS.Timeout | null = null;

    this.graphics.on("click", (event) => {
      if (clickTimeout) {
        clearTimeout(clickTimeout);
      }

      clickTimeout = setTimeout(() => {
        if (this.debugMode) {
          console.log(
            "Клик по визуализатору:",
            event.global.x.toFixed(1),
            event.global.y.toFixed(1)
          );
          this.logBonePositions();
        }
        clickTimeout = null;
      }, 100);
    });
  }

  private logBonePositions() {
    if (!this.debugMode) return;

    console.log("Позиции костей (кеш):");
    this.boneMap.forEach((value, key) => {
      if (value.bone) {
        const cached = this.screenPositionCache.get(key);
        if (cached) {
          console.log(
            `${key}: Screen(${cached.x.toFixed(1)}, ${cached.y.toFixed(
              1
            )}) [frame: ${cached.frame}]`
          );
        }
      }
    });
  }

  private getScreenCoordinates(
    bone: any,
    boneName?: string
  ): { x: number; y: number } {
    // Используем кеш для избежания лишних вычислений
    if (boneName) {
      const cached = this.screenPositionCache.get(boneName);
      if (cached && cached.frame === this.currentFrame) {
        return { x: cached.x, y: cached.y };
      }
    }

    let screenPos: { x: number; y: number };

    if (this.spineObject) {
      // Оптимизированное преобразование координат
      const localPoint = new PIXI.Point(bone.worldX, bone.worldY);
      const globalPoint = this.spineObject.toGlobal(localPoint);
      screenPos = { x: globalPoint.x, y: globalPoint.y };
    } else {
      screenPos = {
        x: this.app.screen.width / 2 + bone.worldX,
        y: this.app.screen.height / 2 - bone.worldY,
      };
    }

    // Кешируем результат
    if (boneName) {
      this.screenPositionCache.set(boneName, {
        x: screenPos.x,
        y: screenPos.y,
        frame: this.currentFrame,
      });
    }

    return screenPos;
  }

  toggleVisibility() {
    this.visible = !this.visible;
    this.graphics.visible = this.visible;
    this.textContainer.visible = this.visible;

    if (!this.visible) {
      // Очищаем кеш при скрытии
      this.clearCache();
    }

    console.log("Визуализатор костей:", this.visible ? "ВКЛ" : "ВЫКЛ");
  }

  addBone(boneName: string, bone: any, physics?: any) {
    this.boneMap.set(boneName, { bone, physics });
    this.invalidateCache(boneName);
    this.scheduleUpdate();

    if (this.debugMode) {
      console.log(`Добавлена кость ${boneName}`);
    }
  }

  updateBone(boneName: string, bone: any, physics?: any) {
    if (!bone) {
      console.warn(`Попытка обновить несуществующую кость: ${boneName}`);
      return;
    }

    this.boneMap.set(boneName, { bone, physics });
    this.invalidateCache(boneName);
    this.scheduleUpdate();
  }

  private invalidateCache(boneName?: string) {
    if (boneName) {
      this.screenPositionCache.delete(boneName);
    } else {
      this.screenPositionCache.clear();
    }
  }

  private clearCache() {
    this.screenPositionCache.clear();
  }

  private scheduleUpdate() {
    this.needsUpdate = true;

    if (!this.updateScheduled) {
      this.updateScheduled = true;
      // Используем requestAnimationFrame для оптимизации
      requestAnimationFrame(() => {
        if (this.needsUpdate) {
          this.performUpdate();
        }
        this.updateScheduled = false;
        this.needsUpdate = false;
      });
    }
  }

  update() {
    this.scheduleUpdate();
  }

  private performUpdate() {
    if (!this.visible) return;

    this.currentFrame++;

    // Очищаем графику один раз
    this.graphics.clear();
    this.returnAllTextsToPool();

    if (this.boneMap.size === 0) {
      if (this.debugMode) {
        this.drawDebugInfo();
      }
      return;
    }

    // Пакетная обработка костей
    const visibleBones: string[] = [];

    // Сначала определяем видимые кости
    this.boneMap.forEach((_, boneName) => {
      const boneData = this.boneMap.get(boneName);
      if (boneData?.bone) {
        const screenPos = this.getScreenCoordinates(boneData.bone, boneName);
        if (this.isOnScreen(screenPos.x, screenPos.y, 100)) {
          visibleBones.push(boneName);
        }
      }
    });

    // Затем рисуем только видимые кости
    visibleBones.forEach((boneName) => {
      this.drawAdvancedBone(boneName, 0x00aaff, 12);
      this.drawBoneDirection(boneName, 0x00ffff, 30);
    });

    // Соединения только для видимых костей
    this.drawConnection("#hip_l", "#hip_l2", 0xffff00, 4);
  }

  private drawAdvancedBone(boneName: string, color: number, size: number) {
    const boneData = this.boneMap.get(boneName);
    if (!boneData?.bone) return;

    const { bone, physics } = boneData;
    const screenPos = this.getScreenCoordinates(bone, boneName);
    const screenX = screenPos.x;
    const screenY = screenPos.y;

    if (!this.isOnScreen(screenX, screenY, 100)) {
      return;
    }

    // Рисуем основную точку кости
    this.graphics.beginFill(color, 1.0);
    this.graphics.drawCircle(screenX, screenY, size);
    this.graphics.endFill();

    // Рисуем обводку
    this.graphics.lineStyle(2, 0x000000, 1.0);
    this.graphics.beginFill(0x000000, 0);
    this.graphics.drawCircle(screenX, screenY, size);
    this.graphics.endFill();
    this.graphics.lineStyle(0);

    // Текст
    this.drawBoneText(boneName, screenX, screenY, physics);

    // Вектор скорости
    if (
      physics?.velocity &&
      physics &&
      (Math.abs(physics.velocity.x) > 0.1 || Math.abs(physics.velocity.y) > 0.1)
    ) {
      this.drawVelocityVector(screenX, screenY, physics.velocity, 0x00aaff);
    }
  }

  private isOnScreen(x: number, y: number, margin: number = 100): boolean {
    return (
      x >= -margin &&
      x <= this.app.screen.width + margin &&
      y >= -margin &&
      y <= this.app.screen.height + margin
    );
  }

  private drawBoneText(
    boneName: string,
    screenX: number,
    screenY: number,
    physics?: any
  ) {
    // Используем пул для текста имени
    const nameText = this.getTextFromPool();
    if (nameText) {
      nameText.text = boneName;
      nameText.style = this.textStyles.get("boneName")!;
      nameText.anchor.set(0.5, 1);
      nameText.x = screenX;
      nameText.y = screenY - 15;
      nameText.visible = true;
    }

    // Используем пул для информационного текста
    if (physics && physics.velocity) {
      const infoText = this.getTextFromPool();
      if (infoText) {
        const velocity = Math.sqrt(
          physics.velocity.x * physics.velocity.x +
            physics.velocity.y * physics.velocity.y
        ).toFixed(1);

        const rotation = (physics.currentRotation || 0).toFixed(2);

        infoText.text = `V: ${velocity}\nR: ${rotation}`;
        infoText.style = this.textStyles.get("boneInfo")!;
        infoText.anchor.set(0.5, 0);
        infoText.x = screenX;
        infoText.y = screenY + 20;
        infoText.visible = true;
      }
    }
  }

  private drawBoneDirection(boneName: string, color: number, length: number) {
    const boneData = this.boneMap.get(boneName);
    if (!boneData?.bone) return;

    const { bone } = boneData;
    const screenPos = this.getScreenCoordinates(bone, boneName);
    const screenX = screenPos.x;
    const screenY = screenPos.y;

    if (!this.isOnScreen(screenX, screenY, 100)) return;

    const angle = bone.rotation || 0;
    const endX = screenX + Math.cos(angle) * length;
    const endY = screenY + Math.sin(angle) * length;

    this.graphics.lineStyle(3, color, 0.8);
    this.graphics.moveTo(screenX, screenY);
    this.graphics.lineTo(endX, endY);

    this.drawArrowHead(endX, endY, angle, color);
    this.graphics.lineStyle(0);
  }

  private drawArrowHead(x: number, y: number, angle: number, color: number) {
    this.graphics.lineStyle(2, color, 0.8);

    this.graphics.moveTo(x, y);
    this.graphics.lineTo(
      x - Math.cos(angle - Math.PI / 6) * 10,
      y - Math.sin(angle - Math.PI / 6) * 10
    );

    this.graphics.moveTo(x, y);
    this.graphics.lineTo(
      x - Math.cos(angle + Math.PI / 6) * 10,
      y - Math.sin(angle + Math.PI / 6) * 10
    );

    this.graphics.lineStyle(0);
  }

  private drawVelocityVector(
    screenX: number,
    screenY: number,
    velocity: { x: number; y: number },
    color: number
  ) {
    const scale = 0.3;
    const endX = screenX + velocity.y * scale;
    const endY = screenY - velocity.x * scale;

    this.graphics.lineStyle(4, color, 0.9);
    this.graphics.moveTo(screenX, screenY);
    this.graphics.lineTo(endX, endY);

    const angle = Math.atan2(-velocity.x, velocity.y);

    this.graphics.lineStyle(3, color, 0.9);
    this.graphics.moveTo(endX, endY);
    this.graphics.lineTo(
      endX - Math.cos(angle - Math.PI / 6) * 12,
      endY - Math.sin(angle - Math.PI / 6) * 12
    );

    this.graphics.moveTo(endX, endY);
    this.graphics.lineTo(
      endX - Math.cos(angle + Math.PI / 6) * 12,
      endY - Math.sin(angle + Math.PI / 6) * 12
    );

    this.graphics.lineStyle(0);
  }

  private drawConnection(
    boneName1: string,
    boneName2: string,
    color: number,
    lineWidth: number
  ) {
    const bone1Data = this.boneMap.get(boneName1);
    const bone2Data = this.boneMap.get(boneName2);

    if (!bone1Data?.bone || !bone2Data?.bone) return;

    const screenPos1 = this.getScreenCoordinates(bone1Data.bone, boneName1);
    const screenPos2 = this.getScreenCoordinates(bone2Data.bone, boneName2);

    // Проверяем видимость обеих костей
    if (
      !this.isOnScreen(screenPos1.x, screenPos1.y, 200) ||
      !this.isOnScreen(screenPos2.x, screenPos2.y, 200)
    ) {
      return;
    }

    this.graphics.lineStyle(lineWidth, color, 0.7);
    this.graphics.moveTo(screenPos1.x, screenPos1.y);
    this.graphics.lineTo(screenPos2.x, screenPos2.y);
    this.graphics.lineStyle(0);
  }

  private drawDebugInfo() {
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    this.graphics.beginFill(0xff0000, 1.0);
    this.graphics.drawCircle(centerX, centerY, 20);
    this.graphics.endFill();

    const testText = this.getTextFromPool();
    if (testText) {
      testText.text = "Визуализатор активен\nНет костей для отображения";
      testText.style = this.textStyles.get("boneName")!;
      testText.anchor.set(0.5);
      testText.x = centerX;
      testText.y = centerY + 40;
      testText.visible = true;
    }

    this.drawCoordinateAxes();
  }

  private drawCoordinateAxes() {
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    this.graphics.lineStyle(2, 0xff0000, 0.5);
    this.graphics.moveTo(centerX - 100, centerY);
    this.graphics.lineTo(centerX + 100, centerY);

    this.graphics.lineStyle(2, 0x00ff00, 0.5);
    this.graphics.moveTo(centerX, centerY - 100);
    this.graphics.lineTo(centerX, centerY + 100);

    this.graphics.lineStyle(0);
  }

  // Публичные методы для управления
  clear() {
    this.graphics.clear();
    this.returnAllTextsToPool();
    this.boneMap.clear();
    this.clearCache();
    this.needsUpdate = false;
  }

  destroy() {
    // Полная очистка при уничтожении
    this.clear();

    // Удаляем все текстовые объекты из пула
    [...this.textPool, ...this.usedTexts].forEach((text) => {
      if (text.parent) {
        text.parent.removeChild(text);
      }
      text.destroy();
    });

    this.textPool = [];
    this.usedTexts = [];

    // Очищаем стили
    // this.textStyles.forEach(style => style.destroy());
    this.textStyles.clear();

    // Удаляем контейнеры
    if (this.graphics.parent) {
      this.graphics.parent.removeChild(this.graphics);
    }
    if (this.textContainer.parent) {
      this.textContainer.parent.removeChild(this.textContainer);
    }

    this.graphics.destroy();
    this.textContainer.destroy();

    console.log("Визуализатор полностью уничтожен");
  }

  hasBone(boneName: string): boolean {
    return this.boneMap.has(boneName);
  }

  getBone(boneName: string) {
    return this.boneMap.get(boneName);
  }

  setSpineObject(spineObject: any) {
    this.spineObject = spineObject;
    this.clearCache(); // Сбрасываем кеш при смене Spine объекта
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled;
    console.log(`Режим отладки: ${enabled ? "ВКЛ" : "ВЫКЛ"}`);
  }

  centerSpineObject() {
    if (this.spineObject) {
      this.spineObject.x = this.app.screen.width / 2;
      this.spineObject.y = this.app.screen.height / 2;
      this.clearCache();
      console.log("Spine объект отцентрирован");
    }
  }

  // Метод для получения статистики производительности
  getPerformanceStats() {
    return {
      bonesCount: this.boneMap.size,
      cacheSize: this.screenPositionCache.size,
      textPoolAvailable: this.textPool.length,
      textPoolInUse: this.usedTexts.length,
      currentFrame: this.currentFrame,
      needsUpdate: this.needsUpdate,
      updateScheduled: this.updateScheduled,
    };
  }
}
