/**
 * stages.ts — ステージ定義データ
 */

import { BuildingSize } from './constants';

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
  bgR: number; bgG: number; bgB: number; // 背景色
}

function buildGrid(
  cols: number, rows: number,
  startX: number, startY: number,
  spacingX: number, spacingY: number,
  sizes: BuildingSize[]
): BuildingDef[] {
  const out: BuildingDef[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        size: sizes[(r * cols + c) % sizes.length],
      });
    }
  }
  return out;
}

export const STAGES: StageConfig[] = [
  // ===== Stage 1 =====
  {
    level: 1,
    buildings: [
      ...buildGrid(6, 3, -130, 60, 50, 60, ['small', 'medium', 'small']),
    ],
    bumpers: [
      { x: -80, y: 15 }, { x: 0, y: 25 }, { x: 80, y: 15 },
    ],
    bgR: 0.06, bgG: 0.06, bgB: 0.10,
  },
  // ===== Stage 2 =====
  {
    level: 2,
    buildings: [
      ...buildGrid(6, 3, -130, 60, 50, 60, ['medium', 'large', 'medium']),
      { x: -120, y: 175, size: 'large' }, { x: 120, y: 175, size: 'large' },
    ],
    bumpers: [
      { x: -100, y: 10 }, { x: 0,    y: 25 }, { x: 100, y: 10 },
      { x: -50,  y: 40 }, { x: 50,   y: 40 },
    ],
    bgR: 0.06, bgG: 0.04, bgB: 0.10,
  },
  // ===== Stage 3 =====
  {
    level: 3,
    buildings: [
      ...buildGrid(7, 4, -150, 50, 45, 55, ['large', 'medium', 'large', 'medium']),
    ],
    bumpers: [
      { x: -110, y: 5 }, { x: -40, y: 28 }, { x: 40, y: 28 }, { x: 110, y: 5 },
      { x:    0, y: 12 },
    ],
    bgR: 0.08, bgG: 0.04, bgB: 0.06,
  },
  // ===== Stage 4+ (繰り返し用テンプレ) =====
  {
    level: 4,
    buildings: [
      ...buildGrid(7, 4, -150, 50, 45, 55, ['large', 'large', 'large']),
      { x: 0, y: 210, size: 'large' },
    ],
    bumpers: [
      { x: -120, y: 0 }, { x: -60, y: 32 }, { x: 0, y: 15 }, { x: 60, y: 32 }, { x: 120, y: 0 },
    ],
    bgR: 0.08, bgG: 0.02, bgB: 0.06,
  },
];

export function getStage(level: number): StageConfig {
  if (level <= STAGES.length) return STAGES[level - 1];
  // 最終ステージ以降は最後の定義をベースに建物数・HPを増やす
  const base = { ...STAGES[STAGES.length - 1] };
  return { ...base, level };
}
