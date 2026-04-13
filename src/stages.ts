/**
 * stages.ts — ウェーブ・都市レイアウト定義
 *
 * 18ブロック (6行×3列) でランダムに建物を配置。
 * 上段1列(ビル) / 中段2列(店) / 下段3列(家)
 * 各行の建物は隣接行と重ならないよう baseY を設計済み。
 */

import * as C from './constants';
import type { FurnitureType, VehicleType } from './entities';
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
  type: VehicleType;
  lane: 'hilltop' | 'main' | 'lower' | 'riverside';
  direction: 1 | -1;
  speed: number;
  interval: number;
}

// ===== ウェイト付きプール =====
export class WeightedPool<T> {
  private items: T[];
  private weights: number[];
  private total: number;

  constructor(entries: ReadonlyArray<readonly [T, number]>) {
    this.items   = entries.map(e => e[0]);
    this.weights = entries.map(e => e[1]);
    this.total   = this.weights.reduce((a, b) => a + b, 0);
  }

  pick(): T {
    let r = Math.random() * this.total;
    for (let i = 0; i < this.items.length; i++) {
      r -= this.weights[i];
      if (r <= 0) return this.items[i];
    }
    return this.items[this.items.length - 1];
  }
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
  // ===== 上段: ビル1列 (baseY=162) =====
  { baseY: C.ZONE_TOP_Y0, pool: [
    'skyscraper','tower','office','hospital','school','skyscraper',
    'city_hall','police_station','train_station','clock_tower',
  ]},
  // ===== 中段: 店2列 =====
  // 奥列 baseY=86, 最大top≈116 (<MAIN下端120) — max h=34
  { baseY: C.ZONE_MID_Y0, pool: [
    'apartment','shop','restaurant','temple','parking','shop',
    'supermarket','bank','library','museum','movie_theater',
  ]},
  // 手前列 baseY=52, 最大top≈82 (<奥列86) — max h=30 (apartment除外)
  { baseY: C.ZONE_MID_Y1, pool: [
    'shop','restaurant','convenience','temple','shop','restaurant',
    'pharmacy','karaoke','pachinko','game_center','cafe','bookstore',
  ]},
  // ===== 下段: 家3列 (max h=22, 各列top<上の列base) =====
  // 奥列 baseY=-12, top≤10 (<LOWER下端14)
  { baseY: C.ZONE_BOT_Y0, pool: [
    'house','convenience','house','house','convenience','house',
    'townhouse','daycare','clinic','bakery','florist','ramen',
  ]},
  // 中列 baseY=-36, top≤-14 (<奥列-12)
  { baseY: C.ZONE_BOT_Y1, pool: [
    'house','house','convenience','house','house','house',
    'townhouse','shed','laundromat','izakaya',
  ]},
  // 手前列 baseY=-60, top≤-40 (<中列-36)
  { baseY: C.ZONE_BOT_Y2, pool: [
    'house','house','house','house','house','house',
    'townhouse','garage','gas_station',
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

// ===== チャンク生成 =====

export interface ChunkRoad {
  y: number;    // 道路中心Y
  h: number;    // 道路高さ
}

export interface ChunkData {
  chunkId: number;
  baseY: number;            // チャンク下端Y（ワールド座標）
  roads: ChunkRoad[];       // 2本の横道路
  buildings: BuildingDef[];
  furniture: FurnitureDef[];
}

// ===== ゾーン別建物プール =====
// 各ゾーンは初期都市に合わせて3段階のプールを持つ
interface ZoneDef {
  bot: C.BuildingSize[];  // 下段 (max h ≤ 22)
  mid: C.BuildingSize[];  // 中段 (max h ≤ 32)
  top: C.BuildingSize[];  // 上段 (max h ≤ 90)
}

const ZONES: ZoneDef[] = [
  // Zone 0: 住宅街
  {
    bot: ['house', 'house', 'townhouse', 'convenience', 'shed', 'garage', 'house'],
    mid: ['house', 'townhouse', 'shop', 'restaurant', 'convenience', 'daycare', 'clinic', 'cafe', 'bakery', 'florist', 'ramen'],
    top: ['apartment', 'apartment_tall', 'shop', 'temple', 'shrine', 'parking', 'mansion', 'library'],
  },
  // Zone 1: 商業区
  {
    bot: ['convenience', 'house', 'shop', 'bakery', 'florist', 'laundromat'],
    mid: ['shop', 'restaurant', 'apartment', 'parking', 'temple', 'cafe', 'pharmacy', 'bookstore',
          'karaoke', 'izakaya', 'game_center', 'ramen', 'pachinko'],
    top: ['apartment', 'apartment_tall', 'school', 'hospital', 'parking', 'supermarket',
          'bank', 'post_office', 'movie_theater', 'museum', 'fire_station', 'police_station'],
  },
  // Zone 2: オフィス街・ランドマーク
  {
    bot: ['house', 'convenience', 'gas_station', 'shed'],
    mid: ['apartment', 'office', 'parking', 'shop', 'bank', 'pharmacy', 'post_office'],
    top: ['office', 'tower', 'skyscraper', 'hospital', 'school', 'apartment_tall',
          'city_hall', 'train_station', 'clock_tower', 'radio_tower',
          'ferris_wheel', 'stadium', 'water_tower'],
  },
];

// 歩道家具のプール (ゾーン別)
const SIDEWALK_FURNITURE: Record<number, Array<FurnitureType>> = {
  0: ['tree', 'tree', 'bench', 'tree', 'power_pole', 'flower_bed', 'bench',
      'bush', 'sakura_tree', 'planter', 'street_lamp', 'bicycle_rack'],
  1: ['sign_board', 'vending', 'garbage', 'bench', 'traffic_light', 'parasol',
      'vending', 'sign_board', 'atm', 'post_box', 'newspaper_stand', 'bus_stop',
      'street_lamp', 'bollard', 'dumpster', 'recycling_bin'],
  2: ['power_pole', 'vending', 'bench', 'garbage', 'sign_board', 'bench', 'vending',
      'street_lamp', 'electric_box', 'fire_extinguisher', 'flag_pole', 'statue',
      'pine_tree', 'palm_tree', 'bamboo_cluster', 'hedge'],
};

/** 歩道に沿って家具を均等配置する */
function generateSidewalkFurniture(
  roadY: number, zoneType: number, chunkId: number
): FurnitureDef[] {
  const items: FurnitureDef[] = [];
  const swY = roadY + 9; // 上側歩道センター Y
  const pool = SIDEWALK_FURNITURE[zoneType];
  const xMin = -168, xMax = 168;
  const gap = 22 + Math.floor(Math.random() * 8); // 22〜30px間隔

  let x = xMin;
  let pi = Math.floor(Math.random() * pool.length);
  while (x < xMax) {
    // 路地付近はスキップ
    const nearAlley = Math.abs(x - C.ALLEY_1_X) < 14 || Math.abs(x - C.ALLEY_2_X) < 14;
    if (!nearAlley) {
      const type: FurnitureType = pool[pi % pool.length];
      items.push({ type, x, y: swY });
      pi++;
    }
    x += gap + Math.floor(Math.random() * 6);
  }
  return items;
}

/** 1ブロック分の建物をパッキングする */
function packRow(baseY: number, pool: C.BuildingSize[], maxH: number, chunkId: number): BuildingDef[] {
  const defs: BuildingDef[] = [];
  const margin = 4;
  for (const col of COLS) {
    let x = col.xMin + margin;
    while (x < col.xMax - margin) {
      // maxH 以下の建物のみ選ぶ
      const candidates = pool.filter(s => C.BUILDING_DEFS[s].h <= maxH);
      if (candidates.length === 0) break;
      const size = candidates[Math.floor(Math.random() * candidates.length)];
      const w = C.BUILDING_DEFS[size].w;
      if (x + w > col.xMax - margin) break;
      defs.push({ x: x + w / 2, y: baseY, size, blockIdx: chunkId });
      x += w + 2 + Math.floor(Math.random() * 3);
    }
  }
  return defs;
}

/** 1チャンク（200px）分のコンテンツを生成する
 *
 *  チャンク内レイアウト（初期都市の100px道路間隔に合わせる）:
 *
 *   baseY+200: [次チャンク下端]
 *     [TOP行: 大型ビル 1列]
 *   Road B  (baseY+135, h=14)
 *     [MID行: 中型建物 2列]
 *   Road A  (baseY+35,  h=14)
 *     [BOT行: 小型建物 1列] ※スペース充分な場合のみ
 *   baseY
 */
export function generateChunk(chunkId: number): ChunkData {
  const baseY    = C.WORLD_MAX_Y + chunkId * C.CHUNK_HEIGHT;
  const roadAH   = 14, roadBH = 14;
  const roadAY   = baseY + 35;
  const roadBY   = baseY + 135;

  // 道路の有効端 (sidewalk込み)
  const swH      = C.SIDEWALK_H;
  const aSwTop   = roadAY + roadAH / 2 + swH; // = baseY + 46
  const aSwBot   = roadAY - roadAH / 2 - swH; // = baseY + 24
  const bSwTop   = roadBY + roadBH / 2 + swH; // = baseY + 146
  const bSwBot   = roadBY - roadBH / 2 - swH; // = baseY + 124

  const zoneType  = chunkId % 3;
  const zone      = ZONES[zoneType];
  const buildings: BuildingDef[] = [];
  const furniture: FurnitureDef[] = [];

  // ─── 下段: roadA下 (初期都市の最下段に対応) ───────────────────
  // Space: baseY → aSwBot (+24). 24px = house(h=20) が入る
  if (aSwBot - baseY >= 20) {
    buildings.push(...packRow(baseY + 4, zone.bot, 18, chunkId));
  }

  // ─── 中段: roadAとroadBの間 ────────────────────────────────────
  // 78px スペース (aSwTop+46 → bSwBot+124) = 78px
  // 初期都市の中段(LOWER↔MAIN)に対応: 2〜3行
  const mid1Base = aSwTop + 12;  // = baseY + 58
  const mid2Base = aSwTop + 40;  // = baseY + 86
  const mid3Base = aSwTop + 64;  // = baseY + 110 (住宅のみ)
  buildings.push(...packRow(mid1Base, zone.bot,  22, chunkId));
  buildings.push(...packRow(mid2Base, zone.mid,  32, chunkId));
  if (zoneType === 0) {
    // 住宅街: 3行目も追加（初期都市下段の3行に対応）
    buildings.push(...packRow(mid3Base, zone.bot, 20, chunkId));
  }

  // ─── 上段: roadB上 (初期都市の上段・ビル列に対応) ────────────────
  // baseY+162 は初期都市の ZONE_TOP_Y0 と同じオフセット
  const topBase = bSwTop + 16; // = baseY + 162
  buildings.push(...packRow(topBase, zone.top, 90, chunkId)); // maxH=90 allows skyscrapers

  // ─── 歩道家具 ─────────────────────────────────────────────────
  furniture.push(...generateSidewalkFurniture(roadAY, zoneType, chunkId));
  furniture.push(...generateSidewalkFurniture(roadBY, zoneType, chunkId));

  return {
    chunkId, baseY,
    roads: [{ y: roadAY, h: roadAH }, { y: roadBY, h: roadBH }],
    buildings,
    furniture,
  };
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

/** 再建時の建物サイズ: 世代に関わらずブロックのプールからランダム選択 */
export function getRebuiltSize(_generation: number, blockIdx: number): C.BuildingSize {
  const block = BLOCKS[blockIdx];
  return block.pool[Math.floor(Math.random() * block.pool.length)];
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
  { type:'car',        lane:'hilltop',   direction:-1, speed:30,  interval:14.0 },
  { type:'motorcycle', lane:'hilltop',   direction: 1, speed:55,  interval:18.0 },
  { type:'car',        lane:'main',      direction: 1, speed:60,  interval: 3.0 },
  { type:'car',        lane:'main',      direction:-1, speed:55,  interval: 3.5 },
  { type:'bus',        lane:'main',      direction: 1, speed:40,  interval: 7.5 },
  { type:'truck',      lane:'main',      direction:-1, speed:35,  interval:12.0 },
  { type:'ambulance',  lane:'main',      direction: 1, speed:70,  interval:20.0 },
  { type:'taxi',       lane:'main',      direction:-1, speed:58,  interval: 5.0 },
  { type:'van',        lane:'main',      direction: 1, speed:42,  interval: 9.0 },
  { type:'car',        lane:'lower',     direction: 1, speed:45,  interval: 4.5 },
  { type:'car',        lane:'lower',     direction:-1, speed:42,  interval: 5.0 },
  { type:'truck',      lane:'lower',     direction: 1, speed:30,  interval:10.0 },
  { type:'taxi',       lane:'lower',     direction:-1, speed:50,  interval: 6.5 },
  { type:'motorcycle', lane:'lower',     direction: 1, speed:75,  interval: 7.0 },
  { type:'delivery',   lane:'lower',     direction:-1, speed:38,  interval:11.0 },
  { type:'car',        lane:'riverside', direction:-1, speed:35,  interval: 8.0 },
  { type:'car',        lane:'riverside', direction: 1, speed:38,  interval:11.0 },
  { type:'van',        lane:'riverside', direction:-1, speed:32,  interval:13.0 },
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
