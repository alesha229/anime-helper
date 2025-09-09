import * as PIXI from "pixi.js";
import { Assets } from "@pixi/assets";
import { Spine } from "@pixi-spine/all-4.1";

/**
 * Современный загрузчик Spine для Pixi.js, использующий @pixi/assets (Pixi v7+).
 * Он обрабатывает рантайм Spine 4.1.
 */
export class AssetSpineLoader {
  private static initialized = false;

  /**
   * Инициализирует загрузчик для Spine 4.1.
   * Этот метод следует вызывать один раз при инициализации вашего приложения.
   */
  public static async init() {
    if (this.initialized) {
      console.warn("Загрузчик Spine уже был инициализирован.");
      return;
    }

    // Настройка предпочтений загрузки для лучшей совместимости
    PIXI.Assets.setPreferences({
      preferCreateImageBitmap: false,
    });

    this.initialized = true;
    console.log("Инициализирован загрузчик Spine для v4.1.");
  }

  /**
   * Создает простой графический плейсхолдер для использования в случае сбоя загрузки Spine.
   * @returns Объект PIXI.Graphics, представляющий плейсхолдер.
   */
  private createSpinePlaceholder(): PIXI.Graphics {
    const placeholder = new PIXI.Graphics();
    placeholder.beginFill(0xff0000, 0.5); // Красный, полупрозрачный
    placeholder.drawRect(0, 0, 100, 100);
    placeholder.endFill();
    console.warn(
      "Создан плейсхолдер для ассета Spine, который не удалось загрузить."
    );
    return placeholder;
  }

  /**
   * Загружает модель Spine, создавая и загружая бандл ассетов.
   * @param name - Уникальное имя для бандла ассетов (например, 'my-character').
   * @param paths - Объект, содержащий URL-адреса для файлов skel, atlas и текстуры (png).
   * @returns Промис, который разрешается в PIXI.Container (объект Spine или плейсхолдер).
   */
  public async loadSpineBundle(
    name: string,
    paths: { skel: string; atlas: string; png: string }
  ): Promise<PIXI.Container> {
    if (!AssetSpineLoader.initialized) {
      console.error(
        "Загрузчик Spine не инициализирован. Пожалуйста, вызовите AssetSpineLoader.init() сначала."
      );
      return this.createSpinePlaceholder();
    }

    try {
      // Добавляем бандл ассетов в загрузчик.
      // Assets.addBundle безопасно вызывать повторно с тем же именем.
      Assets.addBundle(name, paths);

      // Загружаем бандл.
      const resources = await Assets.loadBundle(name);

      // В Pixi v7+ парсер напрямую возвращает готовый экземпляр Spine.
      const spineInstance = resources.skel;

      if (!spineInstance || !(spineInstance instanceof Spine)) {
        throw new Error("Загруженный ресурс не является экземпляром Spine.");
      }

      return spineInstance;
    } catch (error) {
      console.error(
        `Не удалось загрузить бандл Spine '${name}'. Создается плейсхолдер.`,
        error
      );
      // Выгружаем бандл, чтобы можно было повторить попытку.
      Assets.unloadBundle(name);
      return this.createSpinePlaceholder();
    }
  }
}
