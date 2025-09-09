import * as PIXI from "pixi.js";
import { Spine } from "@pixi-spine/all-4.1";

/**
 * Пример правильного использования pixi-spine 4.1
 * Этот файл демонстрирует все основные возможности библиотеки
 */
export class PixiSpineExample {
  private app!: PIXI.Application;
  private spineboy!: Spine;
  private container!: PIXI.Container;

  constructor() {
    this.init();
  }

  /**
   * Инициализация приложения
   */
  private async init() {
    // Создание PIXI приложения
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

    // Добавляем canvas в DOM
    document.body.appendChild(this.app.view as HTMLCanvasElement);

    // Создаём контейнер
    this.container = new PIXI.Container();
    this.app.stage.addChild(this.container);

    // Настройка предпочтений загрузки
    PIXI.Assets.setPreferences({
      preferCreateImageBitmap: false,
    });

    // Загружаем Spine модель
    await this.loadSpineModel();

    // Настраиваем анимации
    this.setupAnimations();

    // Настраиваем события
    this.setupEvents();

    // Настраиваем взаимодействие
    this.setupInteraction();

    // Запускаем игровой цикл
    this.app.ticker.add(this.update, this);
  }

  /**
   * Загрузка Spine модели
   */
  private async loadSpineModel() {
    try {
      // Добавляем ассет
      PIXI.Assets.add({
        alias: "spineboy-data",
        src: "./assets/favorite_c550_00.skel",
      });

      // Загружаем ассет
      const resource = await PIXI.Assets.load("spineboy-data");

      // Создаём Spine объект
      this.spineboy = new Spine(resource.spineData);

      // Позиционируем модель
      this.spineboy.x = this.app.screen.width / 2;
      this.spineboy.y = this.app.screen.height / 2;
      this.spineboy.scale.set(0.5);

      // Добавляем в контейнер
      this.container.addChild(this.spineboy);

      console.log("Spine модель загружена успешно");
    } catch (error) {
      console.error("Ошибка загрузки Spine ассета:", error);
    }
  }

  /**
   * Настройка анимаций
   */
  private setupAnimations() {
    if (!this.spineboy) return;

    // Проверяем доступные анимации
    const animations = this.spineboy.skeleton.data.animations;
    console.log(
      "Доступные анимации:",
      animations.map((a) => a.name)
    );

    // Воспроизводим анимацию idle
    if (this.spineboy.state.hasAnimation("idle")) {
      this.spineboy.state.setAnimation(0, "idle", true);
    }

    // Настраиваем смешивание анимаций
    this.spineboy.state.setMix("idle", "walk", 0.2);
    this.spineboy.state.setMix("walk", "idle", 0.2);
  }

  /**
   * Настройка событий анимации
   */
  private setupEvents() {
    if (!this.spineboy) return;

    this.spineboy.state.addListener({
      start: (entry) => {
        console.log("Анимация началась:", entry.animation.name);
      },
      complete: (entry) => {
        console.log("Анимация завершена:", entry.animation.name);
      },
      event: (entry, event) => {
        console.log("Событие анимации:", event.data.name);
      },
    });
  }

  /**
   * Настройка взаимодействия
   */
  private setupInteraction() {
    if (!this.spineboy) return;

    // Делаем модель интерактивной
    this.spineboy.eventMode = "static";
    this.spineboy.cursor = "pointer";

    // Обработка клика
    this.spineboy.on("pointerdown", () => {
      this.playRandomAnimation();
    });

    // Обработка наведения
    this.spineboy.on("pointerover", () => {
      this.spineboy.scale.set(0.6);
    });

    this.spineboy.on("pointerout", () => {
      this.spineboy.scale.set(0.5);
    });
  }

  /**
   * Воспроизведение случайной анимации
   */
  private playRandomAnimation() {
    if (!this.spineboy) return;

    const animations = this.spineboy.skeleton.data.animations;
    const randomAnimation =
      animations[Math.floor(Math.random() * animations.length)];

    if (this.spineboy.state.hasAnimation(randomAnimation.name)) {
      this.spineboy.state.setAnimation(1, randomAnimation.name, false);

      // Возвращаемся к idle после завершения
      this.spineboy.state.addAnimation(1, "idle", true, 0);
    }
  }

  /**
   * Работа с костями
   */
  public manipulateBones() {
    if (!this.spineboy) return;

    const skeleton = this.spineboy.skeleton;

    // Поиск кости по имени
    const headBone = skeleton.findBone("head");

    if (headBone) {
      // Поворот головы
      headBone.rotation = Math.sin(Date.now() * 0.001) * 30;

      // Обновление трансформаций
      headBone.updateWorldTransform();
    }
  }

  /**
   * Смена скина
   */
  public changeSkin(skinName: string) {
    if (!this.spineboy) return;

    const skeleton = this.spineboy.skeleton;

    // Получение списка скинов
    const skins = skeleton.data.skins;
    console.log(
      "Доступные скины:",
      skins.map((s) => s.name)
    );

    // Установка скина
    if (skeleton.skin) {
      skeleton.setSkin(skinName);
      skeleton.setSlotsToSetupPose();
    }
  }

  /**
   * Управление скоростью анимации
   */
  public setAnimationSpeed(speed: number) {
    if (!this.spineboy) return;
    this.spineboy.state.timeScale = speed;
  }

  /**
   * Включение/выключение отладки
   */
  public toggleDebug(enable: boolean) {
    if (!this.spineboy) return;
    this.spineboy.debug = enable;
  }

  /**
   * Игровой цикл
   */
  private update() {
    // Манипуляции с костями (пример)
    this.manipulateBones();
  }

  /**
   * Очистка ресурсов
   */
  public destroy() {
    if (this.spineboy) {
      this.spineboy.destroy();
    }
    if (this.app) {
      this.app.destroy(true);
    }
  }
}

// Пример использования
// const example = new PixiSpineExample();



