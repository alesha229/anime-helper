// import * as spine from "@esotericsoftware/spine-ts";

// // Интерфейсы для конфигурации физики
// interface BoneColor {
//   r: number;
//   g: number;
//   b: number;
//   a: number;
// }

// interface BonePhysicsSettings {
//   Shiftiness: number;
//   Damping: number;
//   SupportSpringShiftiness: number;
//   SupportSpringDamping: number;
//   FixPosition: boolean;
//   LookAtChild: boolean;
//   BoneColor: BoneColor;
//   SmoothTime: number;
//   AngleSmoothDampingEnabled: boolean;
//   SmoothDampingEnabled: boolean;
//   ForceMultiplier: number;
//   AngleLimit: number;
//   StretchLimit: number;
//   FixSpringLength: boolean;
//   BlendMode: string;
//   Mass: number;
// }

// interface PhysicsConfig {
//   VersionCode: number;
//   FireShakeMinForce: number;
//   FireShakeMaxForce: number;
//   ForceRandomAngleMin: number;
//   ForceRandomAngleMax: number;
//   UseRK4: boolean;
//   BoneSpringPhysicsSettingCollection: Record<string, BonePhysicsSettings>;
// }

// // Класс для физического тела кости
// class BonePhysicsBody {
//   bone: spine.Bone;
//   settings: BonePhysicsSettings;

//   // Физические свойства
//   position: spine.Vector2 = new spine.Vector2();
//   velocity: spine.Vector2 = new spine.Vector2();
//   acceleration: spine.Vector2 = new spine.Vector2();

//   // Для сглаживания
//   targetAngle: number = 0;
//   currentAngle: number = 0;
//   angleVelocity: number = 0;

//   // Пружинные силы
//   springForce: spine.Vector2 = new spine.Vector2();
//   supportSpringForce: spine.Vector2 = new spine.Vector2();

//   // Начальное состояние
//   initialPosition: spine.Vector2;
//   initialAngle: number;
//   restLength: number = 0;

//   constructor(bone: spine.Bone, settings: BonePhysicsSettings) {
//     this.bone = bone;
//     this.settings = settings;
//     this.initialPosition = new spine.Vector2(bone.worldX, bone.worldY);
//     this.initialAngle = bone.worldRotationX;
//     this.position.set(bone.worldX, bone.worldY);
//     this.currentAngle = bone.worldRotationX;

//     // Вычисляем длину покоя для пружины
//     if (bone.parent) {
//       this.restLength = spine.MathUtils.distance(
//         bone.parent.worldX,
//         bone.parent.worldY,
//         bone.worldX,
//         bone.worldY
//       );
//     }
//   }

//   // Применение физических сил
//   applyForces(
//     deltaTime: number,
//     globalForce: spine.Vector2,
//     gravity: spine.Vector2
//   ) {
//     if (this.settings.FixPosition) return;

//     this.acceleration.set(0, 0);

//     // Гравитация
//     this.acceleration.add(gravity.x, gravity.y);

//     // Глобальные силы (ветер, толчки)
//     this.acceleration.add(
//       globalForce.x * this.settings.ForceMultiplier,
//       globalForce.y * this.settings.ForceMultiplier
//     );

//     // Пружинная сила к начальной позиции
//     if (this.bone.parent) {
//       const parentWorldX = this.bone.parent.worldX;
//       const parentWorldY = this.bone.parent.worldY;

//       // Целевая позиция относительно родителя
//       const targetX =
//         parentWorldX + this.initialPosition.x - this.bone.parent.worldX;
//       const targetY =
//         parentWorldY + this.initialPosition.y - this.bone.parent.worldY;

//       // Пружинная сила
//       const springX =
//         (targetX - this.position.x) * this.settings.Shiftiness * 0.01;
//       const springY =
//         (targetY - this.position.y) * this.settings.Shiftiness * 0.01;

//       this.springForce.set(springX, springY);
//       this.acceleration.add(springX, springY);
//     }

//     // Поддерживающая пружина (к родительской кости)
//     if (this.bone.parent) {
//       const supportX =
//         (this.bone.parent.worldX - this.position.x) *
//         this.settings.SupportSpringShiftiness *
//         0.01;
//       const supportY =
//         (this.bone.parent.worldY - this.position.y) *
//         this.settings.SupportSpringShiftiness *
//         0.01;

//       this.supportSpringForce.set(supportX, supportY);
//       this.acceleration.add(supportX, supportY);
//     }

//     // Демпфирование
//     this.acceleration.add(
//       -this.velocity.x * this.settings.Damping,
//       -this.velocity.y * this.settings.Damping
//     );

//     // Интегрирование (Эйлер или RK4)
//     this.integrate(deltaTime);

//     // Ограничения
//     this.applyConstraints();
//   }

//   // Численное интегрирование
//   private integrate(deltaTime: number) {
//     // Простое интегрирование Эйлера (можно заменить на RK4)
//     this.velocity.add(
//       this.acceleration.x * deltaTime,
//       this.acceleration.y * deltaTime
//     );

//     this.position.add(this.velocity.x * deltaTime, this.velocity.y * deltaTime);
//   }

//   // Применение ограничений
//   private applyConstraints() {
//     if (!this.bone.parent) return;

//     // Ограничение длины пружины
//     const currentLength = spine.MathUtils.distance(
//       this.bone.parent.worldX,
//       this.bone.parent.worldY,
//       this.position.x,
//       this.position.y
//     );

//     const maxLength = this.restLength * this.settings.StretchLimit;
//     if (currentLength > maxLength) {
//       const ratio = maxLength / currentLength;
//       const parentX = this.bone.parent.worldX;
//       const parentY = this.bone.parent.worldY;

//       this.position.x = parentX + (this.position.x - parentX) * ratio;
//       this.position.y = parentY + (this.position.y - parentY) * ratio;
//     }

//     // Ограничение угла
//     if (this.settings.AngleLimit < 180) {
//       const parentAngle = this.bone.parent.worldRotationX;
//       let targetAngle =
//         Math.atan2(
//           this.position.y - this.bone.parent.worldY,
//           this.position.x - this.bone.parent.worldX
//         ) * spine.MathUtils.radDeg;

//       let angleDiff = targetAngle - parentAngle;
//       while (angleDiff > 180) angleDiff -= 360;
//       while (angleDiff < -180) angleDiff += 360;

//       const maxAngle = this.settings.AngleLimit / 2;
//       if (Math.abs(angleDiff) > maxAngle) {
//         const clampedAngle = parentAngle + Math.sign(angleDiff) * maxAngle;
//         const length = spine.MathUtils.distance(
//           this.bone.parent.worldX,
//           this.bone.parent.worldY,
//           this.position.x,
//           this.position.y
//         );

//         this.position.x =
//           this.bone.parent.worldX +
//           Math.cos(clampedAngle * spine.MathUtils.degRad) * length;
//         this.position.y =
//           this.bone.parent.worldY +
//           Math.sin(clampedAngle * spine.MathUtils.degRad) * length;
//       }
//     }
//   }

//   // Обновление кости
//   updateBone() {
//     if (this.settings.FixPosition) return;

//     // Обновляем позицию кости
//     if (this.bone.parent) {
//       const dx = this.position.x - this.bone.parent.worldX;
//       const dy = this.position.y - this.bone.parent.worldY;

//       // Преобразуем в локальные координаты
//       const parentRotation =
//         this.bone.parent.worldRotationX * spine.MathUtils.degRad;
//       const cos = Math.cos(-parentRotation);
//       const sin = Math.sin(-parentRotation);

//       this.bone.x = dx * cos - dy * sin;
//       this.bone.y = dx * sin + dy * cos;

//       // Обновляем поворот если включено LookAtChild
//       if (this.settings.LookAtChild) {
//         this.bone.rotation =
//           Math.atan2(dy, dx) * spine.MathUtils.radDeg -
//           this.bone.parent.worldRotationX;
//       }
//     }

//     this.bone.updateWorldTransform();
//   }
// }

// // Основной класс системы физики
// export class SpinePhysicsSystem {
//   private physicsBodies: Map<string, BonePhysicsBody> = new Map();
//   private config: PhysicsConfig;
//   private skeleton: spine.Skeleton;

//   // Глобальные силы
//   private globalForce: spine.Vector2 = new spine.Vector2();
//   private gravity: spine.Vector2 = new spine.Vector2(0, -980); // пикселы/с²
//   private wind: spine.Vector2 = new spine.Vector2();

//   // Настройки симуляции
//   private timeAccumulator: number = 0;
//   private fixedTimeStep: number = 1 / 60; // 60 FPS

//   constructor(skeleton: spine.Skeleton, config: PhysicsConfig) {
//     this.skeleton = skeleton;
//     this.config = config;
//     this.initialize();
//   }

//   // Инициализация физических тел
//   private initialize() {
//     for (const [boneName, settings] of Object.entries(
//       this.config.BoneSpringPhysicsSettingCollection
//     )) {
//       const bone = this.skeleton.findBone(boneName.substring(1)); // убираем "@"
//       if (bone) {
//         const physicsBody = new BonePhysicsBody(bone, settings);
//         this.physicsBodies.set(boneName, physicsBody);
//       } else {
//         console.warn(`Bone "${boneName}" not found in skeleton`);
//       }
//     }
//   }

//   // Главный метод обновления
//   update(deltaTime: number) {
//     this.timeAccumulator += deltaTime;

//     // Фиксированный шаг времени для стабильности физики
//     while (this.timeAccumulator >= this.fixedTimeStep) {
//       this.physicsUpdate(this.fixedTimeStep);
//       this.timeAccumulator -= this.fixedTimeStep;
//     }

//     // Интерполяция для плавности
//     const alpha = this.timeAccumulator / this.fixedTimeStep;
//     this.interpolatePhysics(alpha);
//   }

//   // Обновление физики с фиксированным шагом
//   private physicsUpdate(deltaTime: number) {
//     // Обновляем все физические тела
//     for (const physicsBody of this.physicsBodies.values()) {
//       physicsBody.applyForces(deltaTime, this.globalForce, this.gravity);
//     }

//     // Обновляем кости
//     for (const physicsBody of this.physicsBodies.values()) {
//       physicsBody.updateBone();
//     }

//     // Затухание глобальных сил
//     this.globalForce.scale(0.95);
//   }

//   // Интерполяция для плавности
//   private interpolatePhysics(alpha: number) {
//     // Здесь можно добавить интерполяцию между состояниями
//     // для еще более плавной анимации
//   }

//   // Применение импульсной силы
//   applyImpulse(force: spine.Vector2, position?: spine.Vector2) {
//     if (position) {
//       // Применяем силу к ближайшим костям
//       for (const physicsBody of this.physicsBodies.values()) {
//         const distance = spine.MathUtils.distance(
//           physicsBody.position.x,
//           physicsBody.position.y,
//           position.x,
//           position.y
//         );

//         if (distance < 200) {
//           // радиус воздействия
//           const falloff = Math.max(0, 1 - distance / 200);
//           physicsBody.velocity.add(force.x * falloff, force.y * falloff);
//         }
//       }
//     } else {
//       // Глобальная сила
//       this.globalForce.add(force.x, force.y);
//     }
//   }

//   // Установка ветра
//   setWind(windForce: spine.Vector2) {
//     this.wind.set(windForce.x, windForce.y);
//     this.globalForce.add(this.wind.x, this.wind.y);
//   }

//   // Встряхивание (из конфига FireShake)
//   fireShake() {
//     const force = spine.MathUtils.random(
//       this.config.FireShakeMinForce,
//       this.config.FireShakeMaxForce
//     );

//     const angle =
//       spine.MathUtils.randomTriangular(
//         this.config.ForceRandomAngleMin,
//         this.config.ForceRandomAngleMax
//       ) * spine.MathUtils.degRad;

//     const shakeForce = new spine.Vector2(
//       Math.cos(angle) * force,
//       Math.sin(angle) * force
//     );

//     this.applyImpulse(shakeForce);
//   }

//   // Сброс физики
//   reset() {
//     for (const physicsBody of this.physicsBodies.values()) {
//       physicsBody.position.set(
//         physicsBody.initialPosition.x,
//         physicsBody.initialPosition.y
//       );
//       physicsBody.velocity.set(0, 0);
//       physicsBody.acceleration.set(0, 0);
//       physicsBody.currentAngle = physicsBody.initialAngle;
//       physicsBody.updateBone();
//     }

//     this.globalForce.set(0, 0);
//     this.timeAccumulator = 0;
//   }

//   // Получение физического тела по имени кости
//   getPhysicsBody(boneName: string): BonePhysicsBody | undefined {
//     return this.physicsBodies.get(boneName);
//   }

//   // Включение/выключение физики для конкретной кости
//   setBonePhysicsEnabled(boneName: string, enabled: boolean) {
//     const physicsBody = this.physicsBodies.get(boneName);
//     if (physicsBody) {
//       if (enabled) {
//         // Восстанавливаем настройки
//         physicsBody.settings =
//           this.config.BoneSpringPhysicsSettingCollection[boneName];
//       } else {
//         // Фиксируем кость
//         physicsBody.settings.FixPosition = true;
//       }
//     }
//   }
// }

// // Пример использования
// export function createPhysicsFromConfig(
//   skeleton: spine.Skeleton,
//   configJson: string
// ): SpinePhysicsSystem {
//   const config: PhysicsConfig = JSON.parse(configJson);
//   return new SpinePhysicsSystem(skeleton, config);
// }
