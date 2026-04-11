/**
 * stages.ts — ステージ定義データ
 * ビルは道路歩道に接地（y = BACK_BASE or FRONT_BASE = 下端Y）
 */

import { BuildingSize, BACK_BASE, FRONT_BASE } from './constants';

export interface BuildingDef {
  x: number;   // 中心X
  y: number;   // 下端Y
  size: BuildingSize;
}

export interface BumperDef {
  x: number;
  y: number;
}

export interface StageConfig {
  level: number;
  buildings: BuildingDef[];
  bumpers: BumperDef[];
  bgR: number; bgG: number; bgB: number;
}

// 接地ヘルパー: 底辺 = baseY のビル定義を返す
function b(x: number, base: number, size: BuildingSize): BuildingDef {
  return { x, y: base, size };
}

export const STAGES: StageConfig[] = [
  // ===== Stage 1: 小〜中ビルの2列 =====
  {
    level: 1,
    buildings: [
      // 奥の通り (base = 179)
      b(-140, BACK_BASE, 'small'),  b(-105, BACK_BASE, 'medium'),
      b( -60, BACK_BASE, 'small'),  b( -25, BACK_BASE, 'medium'),
      b(  25, BACK_BASE, 'small'),  b(  70, BACK_BASE, 'medium'),
      b( 115, BACK_BASE, 'small'),
      // 手前の通り (base = 68)
      b(-120, FRONT_BASE, 'small'),  b(-70, FRONT_BASE, 'medium'),
      b(   0, FRONT_BASE, 'small'),  b( 70, FRONT_BASE, 'medium'),
      b( 120, FRONT_BASE, 'small'),
    ],
    bumpers: [
      { x: -80, y: 15 }, { x: 0, y: 25 }, { x: 80, y: 15 },
    ],
    bgR: 0.06, bgG: 0.06, bgB: 0.10,
  },
  // ===== Stage 2: 中央にタワー =====
  {
    level: 2,
    buildings: [
      // 奥
      b(-140, BACK_BASE, 'medium'), b(-95, BACK_BASE, 'small'),
      b( -55, BACK_BASE, 'medium'), b(-10, BACK_BASE, 'large'),
      b(  40, BACK_BASE, 'medium'), b( 85, BACK_BASE, 'small'),
      b( 130, BACK_BASE, 'medium'),
      // 手前
      b(-130, FRONT_BASE, 'medium'), b(-80, FRONT_BASE, 'small'),
      b( -30, FRONT_BASE, 'medium'), b( 30, FRONT_BASE, 'small'),
      b(  80, FRONT_BASE, 'medium'), b(130, FRONT_BASE, 'small'),
    ],
    bumpers: [
      { x: -100, y: 10 }, { x: 0, y: 25 }, { x: 100, y: 10 },
      { x:  -50, y: 40 }, { x: 50, y: 40 },
    ],
    bgR: 0.06, bgG: 0.04, bgB: 0.10,
  },
  // ===== Stage 3: 大型ビル多め =====
  {
    level: 3,
    buildings: [
      // 奥
      b(-145, BACK_BASE, 'medium'), b(-100, BACK_BASE, 'large'),
      b( -45, BACK_BASE, 'medium'), b(   0, BACK_BASE, 'large'),
      b(  50, BACK_BASE, 'medium'), b( 100, BACK_BASE, 'large'),
      b( 145, BACK_BASE, 'medium'),
      // 手前
      b(-120, FRONT_BASE, 'medium'), b(-65, FRONT_BASE, 'medium'),
      b( -15, FRONT_BASE, 'small'),  b( 30, FRONT_BASE, 'medium'),
      b(  80, FRONT_BASE, 'medium'), b(130, FRONT_BASE, 'small'),
    ],
    bumpers: [
      { x: -110, y: 5 }, { x: -40, y: 28 }, { x: 40, y: 28 }, { x: 110, y: 5 },
      { x: 0, y: 12 },
    ],
    bgR: 0.08, bgG: 0.04, bgB: 0.06,
  },
  // ===== Stage 4: 密集都市 =====
  {
    level: 4,
    buildings: [
      // 奥
      b(-150, BACK_BASE, 'large'),  b(-100, BACK_BASE, 'medium'),
      b( -55, BACK_BASE, 'large'),  b(  -5, BACK_BASE, 'large'),
      b(  50, BACK_BASE, 'large'),  b( 100, BACK_BASE, 'medium'),
      b( 145, BACK_BASE, 'large'),
      // 手前
      b(-140, FRONT_BASE, 'medium'), b(-90, FRONT_BASE, 'medium'),
      b( -40, FRONT_BASE, 'medium'), b( 15, FRONT_BASE, 'small'),
      b(  55, FRONT_BASE, 'medium'), b(100, FRONT_BASE, 'medium'),
      b( 145, FRONT_BASE, 'medium'),
    ],
    bumpers: [
      { x: -120, y: 0 }, { x: -60, y: 32 }, { x: 0, y: 15 }, { x: 60, y: 32 }, { x: 120, y: 0 },
    ],
    bgR: 0.08, bgG: 0.02, bgB: 0.06,
  },
];

export function getStage(level: number): StageConfig {
  if (level <= STAGES.length) return STAGES[level - 1];
  const base = { ...STAGES[STAGES.length - 1] };
  return { ...base, level };
}
