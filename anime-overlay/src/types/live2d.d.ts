// Типы для Live2D моделей

export interface Live2DModel {
  x: number;
  y: number;
  scale: { x: number; y: number };
  anchor?: { set: (x: number, y: number) => void };
  destroy?: (force?: boolean) => void;
  [key: string]: any;
}

export interface Live2DSettings {
  url: string;
  motions?: Record<string, any[]>;
  textures?: string[];
  [key: string]: any;
}
