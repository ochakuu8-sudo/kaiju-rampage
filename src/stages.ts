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
import { getScene, SCENES_BY_TIER, type Scene } from './scenes';

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

// ===== シーン配置ヘルパー =====

export interface ScenePlacement {
  buildings: BuildingDef[];
  furniture: FurnitureDef[];
}

/** 1 シーンを指定左端に配置する */
export function placeScene(
  scene: Scene,
  leftX: number,
  baseY: number,
  blockIdx: number
): ScenePlacement {
  const buildings: BuildingDef[] = scene.buildings.map(b => ({
    x: leftX + b.dx,
    y: baseY,
    size: b.size,
    blockIdx,
  }));
  const furniture: FurnitureDef[] = scene.furniture.map(f => ({
    type: f.type,
    x: leftX + f.dx,
    y: baseY + f.dy,
  }));
  // 駐車車両は furniture 'car' として統一 (taxi/ambulance も 'car' アイコンで表現)
  if (scene.parkedVehicles) {
    for (const v of scene.parkedVehicles) {
      furniture.push({
        type: 'car',
        x: leftX + v.dx,
        y: baseY + v.dy,
      });
    }
  }
  return { buildings, furniture };
}

/**
 * レシピ (scene id の配列) を 1 ブロック内に左から右へ配置する。
 * シーンの合計幅 + ギャップがブロック幅を超える場合は手前でクリップ。
 * 残った余白は左右対称に中央寄せされる。
 */
export function placeRecipe(
  sceneIds: string[],
  block: Block,
  gap: number = 2
): ScenePlacement {
  const scenes = sceneIds.map(id => getScene(id));
  const innerMargin = 1;
  const availW = (block.xMax - block.xMin) - innerMargin * 2;

  // 入るシーンだけ採用
  const fit: Scene[] = [];
  let totalW = 0;
  for (const s of scenes) {
    const add = (fit.length === 0 ? 0 : gap) + s.width;
    if (totalW + add > availW) break;
    fit.push(s);
    totalW += add;
  }

  // 中央寄せのオフセット
  const startX = block.xMin + innerMargin + Math.max(0, (availW - totalW) / 2);

  const out: ScenePlacement = { buildings: [], furniture: [] };
  let cursor = startX;
  for (let i = 0; i < fit.length; i++) {
    const s = fit[i];
    const p = placeScene(s, cursor, block.baseY, block.id);
    out.buildings.push(...p.buildings);
    out.furniture.push(...p.furniture);
    cursor += s.width + gap;
  }
  return out;
}

// ===== 初期都市レシピ =====
// [row][col] = その 1 ブロックに置くシーン ID 配列
// 高さ制約:
//   ROW0 (top, baseY=162): h ≤ 88
//   ROW1 (midB, baseY=86): h ≤ 32
//   ROW2 (mid,  baseY=52): h ≤ 30
//   ROW3-5 (bot, baseY=-12/-36/-60): h ≤ 22
const INITIAL_CITY_RECIPES: string[][][] = [
  // ─── ROW 0: スカイライン (駅・百貨店・病院) ──────────────────────
  [
    ['train_station_plaza'],
    ['dept_store_plaza'],
    ['hospital_scene'],
  ],
  // ─── ROW 1: 奥の商業と公共施設 ────────────────────────────────
  [
    ['shop_parasol_row'],
    ['shrine_complex'],
    ['clinic_daycare'],
  ],
  // ─── ROW 2: 商店街メインストリート (神社に続く寺) ──────────────
  [
    ['shotengai_food'],
    ['shotengai_game'],
    ['temple_garden'],
  ],
  // ─── ROW 3: 住宅街の裏通り (小規模店・コンビニ) ─────────────────
  [
    ['house_trio_garden', 'konbini_corner'],
    ['florist_bakery', 'ramen_izakaya'],
    ['house_konbini'],
  ],
  // ─── ROW 4: 住宅街中列 (生活感のある混在) ──────────────────────
  [
    ['house_konbini', 'house_garage'],
    ['garden_shed', 'house_trio_garden'],
    ['house_garage'],
  ],
  // ─── ROW 5: 川辺の住宅街 (最手前) ─────────────────────────────
  [
    ['house_trio_garden', 'cafe_bookstore'],
    ['house_konbini', 'laundromat_pharmacy'],
    ['ramen_izakaya'],
  ],
];

/** 全 18 ブロックへシーンを配置し、建物と家具を返す */
export function placeCity(): ScenePlacement {
  const out: ScenePlacement = { buildings: [], furniture: [] };
  for (let ri = 0; ri < INITIAL_CITY_RECIPES.length; ri++) {
    for (let ci = 0; ci < INITIAL_CITY_RECIPES[ri].length; ci++) {
      const block = BLOCKS[ri * 3 + ci];
      const p = placeRecipe(INITIAL_CITY_RECIPES[ri][ci], block, 2);
      out.buildings.push(...p.buildings);
      out.furniture.push(...p.furniture);
    }
  }
  return out;
}

// ===== チャンク生成 =====

export interface ChunkRoad {
  y: number;    // 道路中心Y
  h: number;    // 道路高さ
}

export interface ChunkSpecialArea {
  type: 'park' | 'parking_lot';
  y: number;   // center Y
  h: number;   // height (full width = 360)
}

export interface ChunkData {
  chunkId: number;
  baseY: number;            // チャンク下端Y（ワールド座標）
  roads: ChunkRoad[];       // 2本の横道路
  buildings: BuildingDef[];
  furniture: FurnitureDef[];
  specialAreas: ChunkSpecialArea[];
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
          'bank', 'post_office', 'movie_theater', 'museum', 'fire_station', 'police_station',
          'department_store'],
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

/** 公園エリアの家具を生成する */
function generateParkFurniture(centerY: number, chunkId: number): FurnitureDef[] {
  const items: FurnitureDef[] = [];
  // 中央に噴水
  items.push({ type: 'fountain', x: 0, y: centerY });
  // 木々のグリッド（左右に散りばめ）
  const treeTypes: FurnitureType[] = ['tree', 'sakura_tree', 'pine_tree', 'bush', 'planter'];
  const xCols = [-158, -138, -115, -90, -68, -28, 28, 62, 88, 110, 138, 158];
  const yRows = [-22, 0, 22];
  for (const xOff of xCols) {
    for (const yOff of yRows) {
      const nearAlley = Math.abs(xOff - C.ALLEY_1_X) < 14 || Math.abs(xOff - C.ALLEY_2_X) < 14;
      const nearFountain = Math.abs(xOff) < 24 && Math.abs(yOff) < 12;
      if (!nearAlley && !nearFountain) {
        const type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
        items.push({ type, x: xOff, y: centerY + yOff });
      }
    }
  }
  // ベンチ
  for (const x of [-110, -72, 72, 110]) {
    items.push({ type: 'bench', x, y: centerY + 12 });
  }
  // 花壇
  for (const x of [-40, 40]) {
    items.push({ type: 'flower_bed', x, y: centerY - 8 });
  }
  // 旗竿
  items.push({ type: 'flag_pole', x: -155, y: centerY - 20 });
  items.push({ type: 'flag_pole', x:  155, y: centerY - 20 });
  return items;
}

/** 駐車場エリアの家具を生成する (駐車中の車グリッド) */
function generateParkingLotFurniture(centerY: number, chunkId: number): FurnitureDef[] {
  const items: FurnitureDef[] = [];
  const rowYs = [centerY - 16, centerY, centerY + 16];
  // 駐車スペース: X方向に24px間隔
  for (let xi = -156; xi <= 156; xi += 26) {
    for (const y of rowYs) {
      const nearAlley = Math.abs(xi - C.ALLEY_1_X) < 16 || Math.abs(xi - C.ALLEY_2_X) < 16;
      if (!nearAlley && Math.random() < 0.78) {  // 一部空きスペース
        items.push({ type: 'car', x: xi, y });
      }
    }
  }
  return items;
}

// ===== チャンクアーキタイプ =====
// 各アーキタイプは 3 レイヤー × 3 列で構成される。
// 各セルには 1 つ以上のシーン id が入り、左から順に placeRecipe で配置される。
// 'PARK' / 'PARKING_LOT' の特殊値は建物のない特殊エリアを表す。
// null は「そのセルを空ける」意味。

interface ChunkArchetype {
  id: string;
  weight: number;
  mid1: (string[] | null)[];  // baseY+58 に bot tier シーン
  mid2: (string[] | null)[];  // baseY+86 に mid/midB tier シーン
  top:  (string[] | null)[];  // baseY+162 に top tier シーン
  specialArea?: 'park' | 'parking_lot';
}

const CHUNK_ARCHETYPES: ChunkArchetype[] = [
  // 1. 閑静な住宅街
  {
    id: 'suburban_quiet', weight: 3,
    mid1: [['house_trio_garden'],       ['house_konbini'],         ['house_garage']],
    mid2: [['townhouse_row'],           ['clinic_daycare'],        ['mansion_shop']],
    top:  [['school_grounds'],          ['hospital_scene'],        ['city_hall']],
  },
  // 2. 商店街アーケード
  {
    id: 'shotengai_arcade', weight: 3,
    mid1: [['ramen_izakaya', 'konbini_corner'], ['cafe_bookstore'], ['florist_bakery']],
    mid2: [['shotengai_food'],          ['shotengai_game'],        ['cafe_bookstore_row']],
    top:  [['dept_store_plaza'],        ['movie_library'],         ['museum_complex']],
  },
  // 3. 神社・寺の文化区
  {
    id: 'shrine_district', weight: 2,
    mid1: [['garden_shed'],             ['house_trio_garden'],     ['konbini_corner']],
    mid2: [['temple_garden'],           ['shrine_complex'],        ['mansion_shop']],
    top:  [['museum_complex'],          ['ferris_wheel_zone'],     ['train_station_plaza']],
  },
  // 4. オフィス街
  {
    id: 'office_district', weight: 2,
    mid1: [['konbini_corner'],          ['cafe_bookstore'],        ['laundromat_pharmacy']],
    mid2: [['bank_post'],               ['shop_parasol_row'],      ['cafe_bookstore_row']],
    top:  [['office_tower_group'],      ['clock_tower_trio'],      ['water_tower_apartment']],
  },
  // 5. 駅前ハブ
  {
    id: 'station_hub', weight: 1,
    mid1: [['ramen_izakaya'],           ['florist_bakery', 'konbini_corner'], ['cafe_bookstore']],
    mid2: [['shotengai_food'],          ['bank_post'],             ['shop_parasol_row']],
    top:  [['train_station_plaza'],     ['dept_store_plaza'],      ['hospital_scene']],
  },
  // 6. 娯楽街
  {
    id: 'entertainment_zone', weight: 2,
    mid1: [['ramen_izakaya'],           ['konbini_corner'],        ['cafe_bookstore']],
    mid2: [['shotengai_game'],          ['shotengai_food'],        ['shrine_complex']],
    top:  [['ferris_wheel_zone'],       ['stadium_radio'],         ['movie_library']],
  },
  // 7. 工業・郊外
  {
    id: 'industrial_suburb', weight: 1,
    mid1: [['gas_station_corner'],      ['garden_shed', 'house_garage'], ['house_trio_garden']],
    mid2: [['townhouse_row'],           ['mansion_shop'],          ['clinic_daycare']],
    top:  [['water_tower_apartment'],   ['supermarket_front'],     ['stadium_radio']],
  },
  // 8. 公園チャンク (中段は特殊エリアに)
  {
    id: 'park_break', weight: 1,
    mid1: [null, null, null],
    mid2: [null, null, null],
    top:  [['museum_complex'],          ['city_hall'],             ['hospital_scene']],
    specialArea: 'park',
  },
];

const ARCHETYPE_POOL = new WeightedPool<ChunkArchetype>(
  CHUNK_ARCHETYPES.map(a => [a, a.weight] as const)
);
let lastArchetypeId: string | null = null;

function pickArchetype(): ChunkArchetype {
  // 直前と同じは避ける
  for (let tries = 0; tries < 6; tries++) {
    const a = ARCHETYPE_POOL.pick();
    if (a.id !== lastArchetypeId) {
      lastArchetypeId = a.id;
      return a;
    }
  }
  const a = ARCHETYPE_POOL.pick();
  lastArchetypeId = a.id;
  return a;
}

/** チャンク行用の仮 Block を作ってシーンを配置する */
function placeChunkRow(
  cellRecipes: (string[] | null)[],
  baseY: number,
  chunkId: number
): ScenePlacement {
  const out: ScenePlacement = { buildings: [], furniture: [] };
  for (let ci = 0; ci < COLS.length; ci++) {
    const ids = cellRecipes[ci];
    if (!ids || ids.length === 0) continue;
    const fakeBlock: Block = {
      id: chunkId,
      xMin: COLS[ci].xMin,
      xMax: COLS[ci].xMax,
      baseY,
      pool: [],
    };
    const p = placeRecipe(ids, fakeBlock, 2);
    out.buildings.push(...p.buildings);
    out.furniture.push(...p.furniture);
  }
  return out;
}

/** 1 チャンク（200px）分のコンテンツを生成する */
export function generateChunk(chunkId: number): ChunkData {
  const baseY    = C.WORLD_MAX_Y + chunkId * C.CHUNK_HEIGHT;
  const roadAH   = 14, roadBH = 14;
  const roadAY   = baseY + 35;
  const roadBY   = baseY + 135;

  const swH      = C.SIDEWALK_H;
  const aSwTop   = roadAY + roadAH / 2 + swH; // baseY + 46
  const bSwTop   = roadBY + roadBH / 2 + swH; // baseY + 146

  const buildings: BuildingDef[] = [];
  const furniture: FurnitureDef[] = [];
  const specialAreas: ChunkSpecialArea[] = [];

  const arch = pickArchetype();

  // ─── 中段: road A と road B の間 ──────────────────────────────
  const mid1Base = aSwTop + 12;  // baseY + 58
  const mid2Base = aSwTop + 40;  // baseY + 86
  const midCenterY = baseY + 88;
  const midH = 72;

  if (arch.specialArea === 'park') {
    specialAreas.push({ type: 'park', y: midCenterY, h: midH });
    furniture.push(...generateParkFurniture(midCenterY, chunkId));
  } else if (arch.specialArea === 'parking_lot') {
    specialAreas.push({ type: 'parking_lot', y: midCenterY, h: midH });
    furniture.push(...generateParkingLotFurniture(midCenterY, chunkId));
  } else {
    const p1 = placeChunkRow(arch.mid1, mid1Base, chunkId);
    buildings.push(...p1.buildings);
    furniture.push(...p1.furniture);
    const p2 = placeChunkRow(arch.mid2, mid2Base, chunkId);
    buildings.push(...p2.buildings);
    furniture.push(...p2.furniture);
  }

  // ─── 上段: road B 上 ─────────────────────────────────────────
  const topBase = bSwTop + 16; // baseY + 162
  const pTop = placeChunkRow(arch.top, topBase, chunkId);
  buildings.push(...pTop.buildings);
  furniture.push(...pTop.furniture);

  // ─── 歩道家具 (ゾーン感覚で選ぶ) ──────────────────────────────
  // アーキタイプ id から歩道ゾーンを決める
  const zoneType =
    arch.id === 'suburban_quiet' || arch.id === 'industrial_suburb' ? 0 :
    arch.id === 'office_district' ? 2 : 1;
  furniture.push(...generateSidewalkFurniture(roadAY, zoneType, chunkId));
  furniture.push(...generateSidewalkFurniture(roadBY, zoneType, chunkId));

  return {
    chunkId, baseY,
    roads: [{ y: roadAY, h: roadAH }, { y: roadBY, h: roadBH }],
    buildings,
    furniture,
    specialAreas,
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
  // RIVERSIDE は川に変換したため車両レーンを削除
  // 代わりに main/lower に追加して総台数を維持
  { type:'car',        lane:'main',      direction:-1, speed:52,  interval: 6.0 },
  { type:'van',        lane:'lower',     direction: 1, speed:40,  interval: 9.0 },
];

// ===== ステージ設定 =====

export function getStage(level: number): StageConfig {
  const city = placeCity();
  return {
    level,
    buildings: city.buildings,
    bumpers: [],
    // 静的な歩道家具 + シーン付属家具
    furniture: [...FURNITURE, ...city.furniture],
    vehicles: VEHICLES,
    bgTopR: 0.52, bgTopG: 0.74, bgTopB: 0.96,
    bgBottomR: 0.38, bgBottomG: 0.36, bgBottomB: 0.33,
  };
}
