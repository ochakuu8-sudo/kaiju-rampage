/**
 * stages.ts — ウェーブ・都市レイアウト定義
 *
 * 15ブロック (5行×3列) でランダムに建物を配置。
 * ウェーブをまたいで街が維持され、破壊された建物が再建される。
 */

import * as C from './constants';
import type { FurnitureType } from './entities';
import type { BuildingData } from './entities';

export interface BuildingDef {
  x: number;      // 建物中心X
  y: number;      // 建物下端Y (base)
  size: C.BuildingSize;
  blockIdx?: number;
}
export interface BumperDef   { x: number; y: number; }
export interface FurnitureDef { type: FurnitureType; x: number; y: number; hp?: number; score?: number; }
export interface VehicleDef {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  lane: 'hilltop' | 'main' | 'lower' | 'riverside';
  direction: 1 | -1;
  speed: number;
  interval: number;
}
export interface StageConfig {
  level: number;
  buildings: BuildingDef[];
  bumpers: BumperDef[];
  furniture: FurnitureDef[];
  vehicles: VehicleDef[];
  bgTopR: number; bgTopG: number; bgTopB: number;
  bgBottomR: number; bgBottomG: number; bgBottomB: number;
}

// ===== 15ブロック定義 =====

export interface Block {
  id: number;
  xMin: number;   // 左端（路地を除く）
  xMax: number;   // 右端（路地を除く）
  baseY: number;  // 建物下端Y
  pool: C.BuildingSize[];
}

const COLS = [
  { xMin: -177, xMax:  -62 },   // 左列  (世界左端〜路地1左端)
  { xMin:  -38, xMax:   68 },   // 中列  (路地1右端〜路地2左端)
  { xMin:   92, xMax:  177 },   // 右列  (路地2右端〜世界右端)
] as const;

const ROWS: { baseY: number; pool: C.BuildingSize[] }[] = [
  // ===== 上ゾーン: 大型・高耐久・人口密集 =====
  { baseY: C.HILLTOP_BASE, pool: [
    'skyscraper','skyscraper','tower','tower','office','school',
  ]},
  { baseY: C.BLK_A_NEAR, pool: [
    'tower','skyscraper','hospital','school','office','tower',
  ]},
  // ===== 中ゾーン: 中型・中耐久 =====
  { baseY: C.MAIN_BASE, pool: [
    'apartment','office','shop','restaurant','apartment','temple',
  ]},
  { baseY: C.LOWER_BASE, pool: [
    'convenience','shop','restaurant','parking','apartment','shop',
  ]},
  // ===== 下ゾーン: 小型・低耐久・住宅 =====
  { baseY: C.RIVERSIDE_BASE, pool: [
    'house','house','house','shop','convenience','house',
  ]},
];

export const BLOCKS: Block[] = ROWS.flatMap((row, ri) =>
  COLS.map((col, ci) => ({
    id: ri * 3 + ci,
    xMin: col.xMin,
    xMax: col.xMax,
    baseY: row.baseY,
    pool: row.pool,
  }))
);

// ===== ランダム建物配置 =====

/** 1ブロックを左から右へ順次パッキング */
function packBlock(block: Block): BuildingDef[] {
  const defs: BuildingDef[] = [];
  const margin = 4;
  let x = block.xMin + margin;

  while (x < block.xMax - margin) {
    const size = block.pool[Math.floor(Math.random() * block.pool.length)];
    const w = C.BUILDING_DEFS[size].w;
    if (x + w > block.xMax - margin) break;

    defs.push({ x: x + w / 2, y: block.baseY, size, blockIdx: block.id });
    x += w + 2 + Math.floor(Math.random() * 3); // 2〜4px ギャップ
  }
  return defs;
}

/** 全15ブロックに建物を配置してリストを返す */
export function packCity(): BuildingDef[] {
  return BLOCKS.flatMap(packBlock);
}

// ===== ウェーブ進行 =====

/** ウェーブのノルマスコア */
export function getWaveQuota(wave: number): number {
  return wave * 2000;
}

/** 再建クールダウン(秒) — ウェーブが進むほど短縮 */
export function getRebuildCooldown(wave: number): number {
  return Math.max(3, C.REBUILD_BASE_COOLDOWN - (wave - 1) * 1.5);
}

/** 世代ごとに建物サイズをアップグレード */
const SIZE_TIERS: C.BuildingSize[] = [
  'house', 'shop', 'apartment', 'office', 'tower', 'skyscraper'
];
export function getRebuiltSize(generation: number, blockIdx: number): C.BuildingSize {
  const block = BLOCKS[blockIdx];
  const baseSize = block.pool[Math.floor(Math.random() * block.pool.length)];
  if (generation <= 0) return baseSize;
  const baseTier = SIZE_TIERS.indexOf(baseSize);
  if (baseTier < 0) return baseSize;
  const newTier = Math.min(baseTier + Math.floor((generation + 1) / 2), SIZE_TIERS.length - 1);
  return SIZE_TIERS[newTier];
}

/** ブロック内の空きスポットを探してセンターXを返す */
export function findEmptySpot(
  buildings: BuildingData[],
  blockIdx: number,
  sizeW: number
): number | null {
  const block = BLOCKS[blockIdx];
  const margin = 4;
  const range = block.xMax - block.xMin - margin * 2 - sizeW;
  if (range <= 0) return null;

  for (let attempt = 0; attempt < 30; attempt++) {
    const leftEdge = block.xMin + margin + Math.random() * range;
    const rightEdge = leftEdge + sizeW;

    const overlaps = buildings.some(
      b => b.active && b.blockIdx === blockIdx &&
           rightEdge > b.x - 2 && leftEdge < b.x + b.w + 2
    );

    if (!overlaps) return leftEdge + sizeW / 2; // センターX
  }
  return null;
}

// ===== 家具・車両 (静的定義) =====

const f = (type: FurnitureType, x: number, y: number): FurnitureDef => ({ type, x, y });

const FURNITURE: FurnitureDef[] = [
  // ── Hilltop sidewalk Y≈247 ───────────────────────────────────────
  f('power_pole',   -175, 247),
  f('tree',         -158, 247), f('tree',   -140, 247), f('tree',  -121, 247),
  f('flower_bed',    -99, 247), f('flower_bed', -79, 247),
  f('bench',         -52, 247),
  f('tree',          -20, 247), f('tree',     0, 247), f('tree',   20, 247),
  f('flower_bed',     38, 247), f('bench',   55, 247),
  f('tree',           68, 247),
  f('tree',           92, 247), f('tree',  108, 247), f('tree',  124, 247),
  f('flower_bed',    143, 247), f('bench',  162, 247),
  f('power_pole',    175, 247),

  // ── Main commercial sidewalk Y≈146 ───────────────────────────────
  f('sign_board',   -155, 146), f('parasol',  -147, 146),
  f('sign_board',   -132, 146), f('garbage',  -126, 146),
  f('vending',      -112, 146), f('sign_board',-104, 146),
  f('garbage',       -85, 146),
  f('traffic_light', -60, 146),
  f('sign_board',    -40, 146), f('parasol',   -24, 146),
  f('vending',       -14, 146),
  f('fountain',        5, 146),
  f('vending',        16, 146), f('parasol',   30, 146),
  f('sign_board',     45, 146), f('garbage',   57, 146),
  f('traffic_light',  71, 146),
  f('vending',        95, 146), f('sign_board',108, 146),
  f('garbage',       122, 146), f('parasol',   140, 146),
  f('sign_board',    153, 146),

  // ── Lower / Station sidewalk Y≈38 ────────────────────────────────
  f('vending',      -172,  38), f('bench',    -152,  38),
  f('sign_board',   -125,  38),
  f('hydrant',      -112,  38), f('garbage',   -95,  38),
  f('traffic_light', -60,  38), f('hydrant',   -45,  38),
  f('bench',         -18,  38), f('vending',     2,  38),
  f('garbage',        22,  38),
  f('traffic_light',  71,  38), f('hydrant',    85,  38),
  f('sign_board',     98,  38), f('bench',     122,  38),
  f('vending',       142,  38), f('garbage',   157,  38),

  // ── Riverside sidewalk Y≈−72 ─────────────────────────────────────
  f('tree',         -155, -72), f('bench',    -132, -72),
  f('tree',         -113, -72),
  f('tree',          -75, -72),
  f('bench',         -40, -72), f('bench',      0, -72),
  f('tree',           40, -72), f('bench',     60, -72),
  f('tree',           90, -72), f('tree',     112, -72),
  f('bench',         132, -72), f('tree',     155, -72),
];

const VEHICLES: VehicleDef[] = [
  { type:'car',       lane:'hilltop',   direction:-1, speed:30,  interval:14.0 },
  { type:'car',       lane:'main',      direction: 1, speed:60,  interval: 3.0 },
  { type:'car',       lane:'main',      direction:-1, speed:55,  interval: 3.5 },
  { type:'bus',       lane:'main',      direction: 1, speed:40,  interval: 7.5 },
  { type:'truck',     lane:'main',      direction:-1, speed:35,  interval:12.0 },
  { type:'ambulance', lane:'main',      direction: 1, speed:70,  interval:20.0 },
  { type:'car',       lane:'lower',     direction: 1, speed:45,  interval: 4.5 },
  { type:'car',       lane:'lower',     direction:-1, speed:42,  interval: 5.0 },
  { type:'truck',     lane:'lower',     direction: 1, speed:30,  interval:10.0 },
  { type:'car',       lane:'riverside', direction:-1, speed:35,  interval: 8.0 },
  { type:'car',       lane:'riverside', direction: 1, speed:38,  interval:11.0 },
];

// ===== ステージ設定 =====

export function getStage(level: number): StageConfig {
  return {
    level,
    buildings: packCity(),   // ランダム配置
    bumpers: [],
    furniture: FURNITURE,
    vehicles: VEHICLES,
    bgTopR: 0.52, bgTopG: 0.74, bgTopB: 0.96,
    bgBottomR: 0.38, bgBottomG: 0.36, bgBottomB: 0.33,
  };
}
