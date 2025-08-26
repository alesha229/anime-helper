// spineLoader.ts
import * as PIXI from "pixi.js";
import { Spine as Spine40 } from "@pixi-spine/runtime-4.0";
import { Spine as Spine41 } from "@pixi-spine/runtime-4.1";

/**
 * Создаёт Spine-объект нужной версии (4.0 или 4.1)
 */
function createSpine(spineData: any) {
  const version = spineData.skeleton?.spine ?? "";
  console.log(spineData);
  if (version.startsWith("4.0")) return new Spine40(spineData);
  if (version.startsWith("4.1")) return new Spine41(spineData);

  throw new Error(`Unsupported Spine version: ${version}`);
}

/**
 * Загружает текстовый файл (JSON или atlas)
 */
async function loadText(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return await response.text();
}

/**
 * Загружает Spine-модель (.skel + .atlas + .png)
 */
export async function loadSpineModel(paths: {
  skel: string;
  atlas: string;
  png: string;
}) {
  // 1. Загружаем .skel
  const skelText = await loadText(paths.skel);
  let skelData: any;

  try {
    skelData = JSON.parse(skelText);
  } catch {
    // если бинарный .skel, можно использовать ArrayBuffer
    const buffer = new Uint8Array(
      await (await fetch(paths.skel)).arrayBuffer()
    );
    skelData = buffer;
  }

  // 2. Загружаем .atlas
  const atlasText = await loadText(paths.atlas);

  // 3. Загружаем текстуру
  const texture = PIXI.Texture.from(paths.png);

  // 4. Создаём Spine-объект (выбираем версию)
  const spine = createSpine(skelData);

  // 5. Связываем atlas и текстуру
  // В runtime 4.x автоматически ищет текстуру с таким именем, если она совпадает с атласом
  // В большинстве случаев достаточно просто добавить на сцену и обновить
  spine.update(0);

  return spine;
}
