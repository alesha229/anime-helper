// physics-config.ts
export interface PhysicsSettings {
  Shiftiness: number;
  Damping: number;
  SupportSpringShiftiness: number;
  SupportSpringDamping: number;
  ForceMultiplier: number;
  AngleLimit: number;
  StretchLimit: number;
  Mass: number;
  FixPosition: boolean;
  LookAtChild: boolean;
  BoneColor: { r: number; g: number; b: number; a: number };
  SmoothTime: number;
  AngleSmoothDampingEnabled: boolean;
  SmoothDampingEnabled: boolean;
  FixSpringLength: boolean;
  BlendMode: string;
}

export interface PhysicsConfig {
  VersionCode: number;
  FireShakeMinForce: number;
  FireShakeMaxForce: number;
  ForceRandomAngleMin: number;
  ForceRandomAngleMax: number;
  UseRK4: boolean;
  BoneSpringPhysicsSettingCollection: { [boneName: string]: PhysicsSettings };
}
