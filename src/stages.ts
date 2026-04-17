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
import { getScene, SCENES_BY_TIER, type Scene, type GroundType } from './scenes';
import {
  buildBlock,
  horizontalRoadWorld,
  verticalRoadWorld,
  getIntersections,
  type GridBlock,
  type RoadPattern,
  type Intersection,
} from './grid';
import { INITIAL_CITY_PATTERN, PATTERN_BY_ID } from './patterns';

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

export interface StageConfig {
  level: number;
  buildings: BuildingDef[];
  bumpers: BumperDef[];
  furniture: FurnitureDef[];
  vehicles: VehicleDef[];
  grounds: GroundTile[];
  /** 初期都市にシーンが事前配置した humans (ワールド座標) */
  prePlacedHumans: Array<{ x: number; y: number }>;
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

/** セル全体に敷く地面タイル (シーン背景用) */
export interface GroundTile {
  type: GroundType;
  x: number;   // セル中心X
  y: number;   // セル中心Y
  w: number;   // セル幅
  h: number;   // セル高さ
}

/** シーン配置時に生成された pre-placed humans (ワールド座標) */
export interface PrePlacedHumanDef { x: number; y: number; }

export interface ScenePlacement {
  buildings: BuildingDef[];
  furniture: FurnitureDef[];
  grounds?: GroundTile[];
  humans?: PrePlacedHumanDef[];
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
    y: baseY + (b.dy ?? 0),
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
  const humans: PrePlacedHumanDef[] | undefined = scene.prePlacedHumans
    ? scene.prePlacedHumans.map(h => ({ x: leftX + h.dx, y: baseY + h.dy }))
    : undefined;
  return { buildings, furniture, humans };
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

// ===== Grid-based scene placement =====

/** シーン内の建物重心 (center of mass) を計算 */
function sceneBuildingCenterX(scene: Scene): number {
  if (scene.buildings.length === 0) return scene.width / 2;
  let totalW = 0;
  let weighted = 0;
  for (const b of scene.buildings) {
    const bw = C.BUILDING_DEFS[b.size].w;
    weighted += b.dx * bw;
    totalW += bw;
  }
  return totalW > 0 ? weighted / totalW : scene.width / 2;
}

/** シーン内の建物のみの左右端 (家具は含めない) */
function sceneBuildingBounds(scene: Scene): { left: number; right: number } {
  if (scene.buildings.length === 0) return { left: 0, right: scene.width };
  let left = Infinity, right = -Infinity;
  for (const b of scene.buildings) {
    const bw = C.BUILDING_DEFS[b.size].w;
    left = Math.min(left, b.dx - bw / 2);
    right = Math.max(right, b.dx + bw / 2);
  }
  return { left, right };
}

/**
 * GridBlock の各 cell にシーンを配置する。
 * - 建物重心を cell 中心に合わせる (bbox 中心揃えではなく)
 * - merged cell は master cell の scene が span 分の cell 幅にまたがる
 * - セルの使用可能幅を隣接縦道路から計算し、overflow 検知
 */
export function placeGridBlock(
  block: GridBlock,
  pattern: RoadPattern,
  blockIdx: number,
  groundOverride?: GroundType,
  cellOverrides?: Array<{ row: number; col: number; sceneId: string }>,
  groundGrid?: (GroundType | null | undefined)[][]
): ScenePlacement {
  const out: ScenePlacement = { buildings: [], furniture: [], grounds: [], humans: [] };
  const merges = pattern.merges ?? [];
  const ROAD_HALF = 7; // 縦道路の半幅 (14/2)
  const CLEARANCE = 2; // 道路との追加クリアランス

  // overrides を row-col キーの Map 化
  const overrideMap = cellOverrides
    ? new Map(cellOverrides.map(o => [`${o.row}-${o.col}`, o.sceneId]))
    : null;

  // この行の、指定 col 左右に縦道路があるか判定
  const hasVertRoadAt = (gridLine: number, row: number): boolean => {
    return block.verticalRoads.some(v =>
      v.gridLine === gridLine && v.startCell <= row && v.endCell > row
    );
  };

  for (let r = 0; r < block.rows; r++) {
    for (let c = 0; c < block.cols; c++) {
      const cell = block.cells[r][c];
      if (cell.type !== 'scene' && cell.type !== 'scenes') continue;

      const mergeInfo = merges.find(m => m.row === r && m.col === c);
      const spanCols = mergeInfo ? mergeInfo.spanCols : 1;

      const leftColEdge = block.originX + c * block.cellW;
      const rightColEdge = leftColEdge + spanCols * block.cellW;

      const leftHasRoad = hasVertRoadAt(c, r);
      const rightHasRoad = hasVertRoadAt(c + spanCols, r);

      const usableLeft  = leftColEdge  + (leftHasRoad  ? ROAD_HALF + CLEARANCE : 1);
      const usableRight = rightColEdge - (rightHasRoad ? ROAD_HALF + CLEARANCE : 1);
      const usableW = usableRight - usableLeft;
      const usableCenterX = (usableLeft + usableRight) / 2;

      const baseY = block.originY + r * block.cellH + 12;

      // 地面タイル: セル全体 (usable 範囲) を覆う
      const cellCenterY = block.originY + r * block.cellH + block.cellH / 2;

      // overrides が指定されていれば、このセルのシーン ID を差し替える
      const overrideId = overrideMap?.get(`${r}-${c}`);

      // セル毎の ground 優先: groundGrid[r][c] > groundOverride > scene.ground
      const perCellGround = groundGrid?.[r]?.[c] ?? undefined;

      if (cell.type === 'scene') {
        // 単一シーン: 建物重心を usable 中心へ
        const scene = getScene(overrideId ?? cell.sceneId);
        const groundType = perCellGround ?? groundOverride ?? scene.ground;
        if (groundType) {
          out.grounds!.push({
            type: groundType,
            x: usableCenterX,
            y: cellCenterY,
            w: usableW,
            h: block.cellH,
          });
        }
        const comX = sceneBuildingCenterX(scene);
        const bounds = sceneBuildingBounds(scene);
        let leftX = usableCenterX - comX;
        if (leftX + bounds.left < usableLeft) leftX = usableLeft - bounds.left;
        if (leftX + bounds.right > usableRight) leftX = usableRight - bounds.right;
        const p = placeScene(scene, leftX, baseY, blockIdx);
        out.buildings.push(...p.buildings);
        out.furniture.push(...p.furniture);
        if (p.humans) out.humans!.push(...p.humans);
      } else {
        // 複数シーン: 横並びに配置。全シーン合計幅 + gap を usable 内に等分
        // override があれば単一シーンとして差し替え (複数 → 単一に縮約)
        const scenes = overrideId
          ? [getScene(overrideId)]
          : cell.sceneIds.map(id => getScene(id));
        // 地面: セル毎 > groundOverride > 最初のシーンの ground
        const groundType = perCellGround ?? groundOverride ?? scenes[0]?.ground;
        if (groundType) {
          out.grounds!.push({
            type: groundType,
            x: usableCenterX,
            y: cellCenterY,
            w: usableW,
            h: block.cellH,
          });
        }
        const gap = 4;
        let totalW = 0;
        for (let i = 0; i < scenes.length; i++) {
          if (i > 0) totalW += gap;
          const b = sceneBuildingBounds(scenes[i]);
          totalW += (b.right - b.left);
        }
        // 全体を usable 中央に配置
        let cursor = usableCenterX - totalW / 2;
        if (cursor < usableLeft) cursor = usableLeft;
        if (cursor + totalW > usableRight) cursor = usableRight - totalW;
        for (const scene of scenes) {
          const b = sceneBuildingBounds(scene);
          const sceneLeftX = cursor - b.left;
          const p = placeScene(scene, sceneLeftX, baseY, blockIdx);
          out.buildings.push(...p.buildings);
          out.furniture.push(...p.furniture);
          if (p.humans) out.humans!.push(...p.humans);
          cursor += (b.right - b.left) + gap;
        }
      }
    }
  }
  return out;
}

/** RoadPattern の道路を resolved world coords に変換 */
function resolveHorizontalRoads(block: GridBlock): ResolvedHorizontalRoad[] {
  return block.horizontalRoads.map(seg => {
    const w = horizontalRoadWorld(block, seg);
    return {
      cy: w.cy,
      h: seg.thickness ?? (seg.cls === 'avenue' ? 18 : 14),
      xMin: w.xMin,
      xMax: w.xMax,
      cls: seg.cls,
    };
  });
}
function resolveVerticalRoads(block: GridBlock): ResolvedVerticalRoad[] {
  return block.verticalRoads.map(seg => {
    const w = verticalRoadWorld(block, seg);
    return {
      cx: w.cx,
      w: seg.thickness ?? 14,
      yMin: w.yMin,
      yMax: w.yMax,
      cls: seg.cls,
    };
  });
}

/** 全 cell へシーンを配置し、建物と家具を返す (grid ベース) */
export function placeCity(): ScenePlacement {
  // 初期都市 grid:
  //   既存の固定道路 Y (RIVER=-80, LOWER=26, MAIN=133, HILLTOP=240) に合わせて
  //   cellH = 107 で近似 (107 × 3 = 321 ≈ 240 - (-80) = 320)
  //   rows: 3, cols: 4
  //   originX = -180 (世界左壁), originY = -80 (RIVER 中心)
  const block = buildBlock(INITIAL_CITY_PATTERN, -180, -80, C.CELL_W, 107);
  return placeGridBlock(block, INITIAL_CITY_PATTERN, 0);
}

/** 初期都市の resolved roads と交差点 (描画用、fillWalls で使う) */
export function getInitialCityRoadData(): {
  horizontalRoads: ResolvedHorizontalRoad[];
  verticalRoads: ResolvedVerticalRoad[];
  intersections: Intersection[];
} {
  const block = buildBlock(INITIAL_CITY_PATTERN, -180, -80, C.CELL_W, 100);
  // 初期都市の水平道路は固定位置 (RIVER/LOWER/MAIN/HILLTOP) に合わせるため、
  // pattern の gridLine index (0..3) を実際の Y 座標にマッピング
  // gridLine 0 = RIVER (描画しない)、1 = LOWER、2 = MAIN、3 = HILLTOP
  const lineYs = [
    C.RIVERSIDE_STREET_Y,
    C.LOWER_STREET_Y,
    C.MAIN_STREET_Y,
    C.HILLTOP_STREET_Y,
  ];
  const lineHs = [
    C.RIVERSIDE_STREET_H,
    C.LOWER_STREET_H,
    C.MAIN_STREET_H,
    C.HILLTOP_STREET_H,
  ];
  const horizontalRoads: ResolvedHorizontalRoad[] = block.horizontalRoads.map(seg => ({
    cy: lineYs[seg.gridLine],
    h: seg.thickness ?? (seg.cls === 'avenue' ? lineHs[seg.gridLine] : lineHs[seg.gridLine]),
    xMin: -180 + seg.startCell * C.CELL_W,
    xMax: -180 + seg.endCell * C.CELL_W,
    cls: seg.cls,
  }));
  // 垂直道路: gridLine 0..4 → X = -180, -90, 0, 90, 180
  // startCell/endCell は row index で、実際の Y 座標は lineYs 配列から取得
  const verticalRoads: ResolvedVerticalRoad[] = block.verticalRoads.map(seg => ({
    cx: -180 + seg.gridLine * C.CELL_W,
    w: seg.thickness ?? 14,
    // startCell=0 は RIVER 線から、endCell=3 は HILLTOP 線まで
    yMin: lineYs[seg.startCell],
    yMax: lineYs[seg.endCell],
    cls: seg.cls,
  }));
  // 交差点は水平 * 垂直の全組み合わせから生成
  const intersections: Intersection[] = [];
  for (const h of horizontalRoads) {
    for (const v of verticalRoads) {
      if (v.cx >= h.xMin && v.cx <= h.xMax && h.cy >= v.yMin && h.cy <= v.yMax) {
        intersections.push({ x: v.cx, y: h.cy, hThickness: h.h, vThickness: v.w });
      }
    }
  }
  return { horizontalRoads, verticalRoads, intersections };
}

// ===== チャンク生成 =====

export interface ChunkRoad {
  y: number;    // 道路中心Y
  h: number;    // 道路高さ
}

/** 水平道路セグメント (部分幅対応) */
export interface ResolvedHorizontalRoad {
  cy: number;
  h: number;
  xMin: number;
  xMax: number;
  cls: 'avenue' | 'street';
}
/** 垂直道路セグメント (部分高さ対応) */
export interface ResolvedVerticalRoad {
  cx: number;
  w: number;
  yMin: number;
  yMax: number;
  cls: 'avenue' | 'street';
}

export interface ChunkSpecialArea {
  type: 'park' | 'parking_lot';
  y: number;   // center Y
  h: number;   // height (full width = 360)
}

export interface ChunkData {
  chunkId: number;
  baseY: number;            // チャンク下端Y（ワールド座標）
  /** 所属ステージ index (0-4)。TOTAL_CHUNKS 超過時は 0 デフォルト */
  stageIndex: number;
  /** 互換: 全幅水平道路のみ (vehicle lane 用) */
  roads: ChunkRoad[];
  /** 全水平道路 (部分幅含む) — 描画用 */
  horizontalRoads: ResolvedHorizontalRoad[];
  /** 全垂直道路 (部分高さ含む) — 描画用 */
  verticalRoads: ResolvedVerticalRoad[];
  /** 交差点リスト — 描画用 */
  intersections: Intersection[];
  buildings: BuildingDef[];
  furniture: FurnitureDef[];
  specialAreas: ChunkSpecialArea[];
  /** セル地面タイル — 描画用 */
  grounds: GroundTile[];
  /** シーンが事前配置した humans (ワールド座標) — _spawnChunk 時に spawnAt() */
  prePlacedHumans: Array<{ x: number; y: number }>;
}

// ===== 完走型ステージ定義 =====
// 5 つの視覚コンセプトに分かれた手書き固定チャンク。
// 各ステージは patternId + groundOverride (+ isGoal) で構成される ChunkTemplate 配列を持つ。

export interface ChunkTemplate {
  patternId: string;           // patterns.ts の id
  groundOverride?: GroundType; // 指定時: セル地面を強制上書き (シーンの ground を無視)
  isGoal?: boolean;            // 最終チャンク
  /** (row,col) セルのデフォルトシーンを差し替える */
  overrides?: Array<{ row: number; col: number; sceneId: string }>;
  /** セル毎の地面上書き [row][col]。null/undef は groundOverride または scene.ground にフォールバック */
  groundGrid?: (GroundType | null | undefined)[][];
  /** 指定時: grid/pattern/scene を一切使わず raw オブジェクトで直接チャンクを構築 */
  raw?: RawChunkBody;
}

/** オブジェクト単位でチャンク内容を直接記述する型。座標は全てチャンクローカル (dy ∈ [0, CHUNK_HEIGHT]) */
export interface RawChunkBody {
  buildings: Array<{ size: C.BuildingSize; dx: number; dy: number }>;
  furniture: Array<{ type: FurnitureType; dx: number; dy: number }>;
  humans: Array<{ dx: number; dy: number }>;
  grounds: Array<{ type: GroundType; dx: number; dy: number; w: number; h: number }>;
  horizontalRoads: Array<{ dy: number; h: number; xMin: number; xMax: number; cls: 'avenue' | 'street' }>;
  verticalRoads: Array<{ dx: number; w: number; yMinLocal: number; yMaxLocal: number; cls: 'avenue' | 'street' }>;
}

export interface StageDef {
  id: number;
  name: string;
  templates: ChunkTemplate[];
  sidewalkZone: number;
  /** 背景色 (夜景など暗めにシフトしたい場合) */
  bgTop?: readonly [number, number, number];
  bgBottom?: readonly [number, number, number];
}

// ─── Stage 1 raw チャンク用ヘルパー ─────────────────────────
// dx: ワールド座標 (X は -180〜+180)。dy: チャンクローカル (0〜CHUNK_HEIGHT=200)。
const _B = (size: C.BuildingSize, dx: number, dy: number) => ({ size, dx, dy });
const _F = (type: FurnitureType, dx: number, dy: number) => ({ type, dx, dy });
const _H = (dx: number, dy: number) => ({ dx, dy });
const _G = (type: GroundType, dx: number, dy: number, w: number, h: number) => ({ type, dx, dy, w, h });
const _HR = (dy: number, xMin: number, xMax: number, cls: 'street' | 'avenue' = 'street') =>
  ({ dy, h: cls === 'avenue' ? 18 : 14, xMin, xMax, cls });
const _VR = (dx: number, yMinLocal: number, yMaxLocal: number, cls: 'street' | 'avenue' = 'street') =>
  ({ dx, w: cls === 'avenue' ? 18 : 14, yMinLocal, yMaxLocal, cls });
// 全チャンク共通の縦スパイン: x=-90 street, x=0 avenue, x=+90 street
const _SPINE_V = [_VR(-90, 0, 200), _VR(0, 0, 200, 'avenue'), _VR(+90, 0, 200)];
const _MID_HR = _HR(100, -180, 180);       // 中央クロス街路 (全チャンク)
const _TOP_HR = _HR(200, -180, 180);       // 上端クロス街路 (クロスポイントのみ)

// ─── Stage 1: 住宅街ミックス都市 (12 チャンク, 完全手書き raw 配置) ───
// scene/grid/pattern を一切使わず、建物・ファニチャ・人・地面・道路を 1 つ 1 つ
// 座標指定して "超絶ハイクオリティミニチュア" を構成する。
// 縦スパイン (x=-90/0/+90) は全チャンクで連続、道路は決して途切れない。
const STAGE_1_TEMPLATES: ChunkTemplate[] = [
  // 0: 閑静な住宅街入口 — 前後列 + 密な緑化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=25-35 小物)
      _B('shed',-170,20),_B('shed',-145,20),_B('greenhouse',-115,22),
      _B('shed',-55,20),_B('greenhouse',-25,22),
      _B('shed',20,20),_B('greenhouse',55,22),
      _B('shed',105,20),_B('greenhouse',135,22),_B('shed',170,20),
      // 下段 中列 (y=55 中物)
      _B('garage',-155,58),_B('greenhouse',-115,57),
      _B('garage',-55,58),_B('shed',-20,60),
      _B('garage',25,58),_B('shed',60,60),
      _B('garage',110,58),_B('greenhouse',145,57),
      // 下段 後列 (y=80-85 家)
      _B('house',-170,82),_B('house',-140,82),_B('house',-110,82),
      _B('house',-60,82),_B('house',-25,82),
      _B('house',20,82),_B('townhouse',55,80),
      _B('house',108,82),_B('house',140,82),_B('house',170,82),
      // 上段 前列 (y=125 家)
      _B('house',-170,125),_B('house',-140,125),_B('house',-110,125),
      _B('house',-60,125),_B('house',-25,125),
      _B('townhouse',22,129),_B('townhouse',52,129),
      _B('house',108,125),_B('house',140,125),_B('house',170,125),
      // 上段 中列 (y=155)
      _B('garage',-155,155),_B('shed',-120,158),
      _B('garage',-55,155),_B('greenhouse',-20,155),
      _B('garage',25,155),_B('shed',60,158),
      _B('garage',110,155),_B('shed',145,158),
      // 上段 後列 (y=185 小物)
      _B('shed',-170,185),_B('greenhouse',-140,184),_B('shed',-110,185),
      _B('greenhouse',-55,184),_B('shed',-20,185),
      _B('shed',25,185),_B('greenhouse',55,184),
      _B('shed',108,185),_B('greenhouse',140,184),_B('shed',170,185),
    ],
    furniture: [
      _F('tree',-175,8),_F('tree',-145,8),_F('tree',-115,8),
      _F('tree',-55,8),_F('tree',-25,8),_F('tree',20,8),_F('tree',55,8),
      _F('tree',105,8),_F('tree',135,8),_F('tree',170,8),
      _F('hedge',-90,8),_F('hedge',90,8),
      _F('flower_bed',-170,40),_F('flower_bed',-25,40),_F('flower_bed',145,40),
      _F('wood_fence',-90,30),_F('wood_fence',-90,45),_F('wood_fence',90,30),_F('wood_fence',90,45),
      _F('potted_plant',-140,70),_F('potted_plant',-110,70),_F('potted_plant',-60,70),
      _F('potted_plant',20,70),_F('potted_plant',108,70),_F('potted_plant',140,70),
      _F('mailbox',-170,92),_F('mailbox',-25,92),_F('mailbox',170,92),
      _F('bicycle',-140,92),_F('bicycle',60,92),_F('bicycle',140,92),
      _F('tree',-175,118),_F('tree',108,118),_F('tree',170,118),
      _F('potted_plant',-140,115),_F('potted_plant',-60,115),_F('potted_plant',22,115),
      _F('wood_fence',-90,140),_F('wood_fence',-90,155),_F('wood_fence',90,140),_F('wood_fence',90,155),
      _F('laundry_pole',-170,140),_F('laundry_pole',140,140),
      _F('flower_bed',-55,175),_F('flower_bed',108,175),
      _F('tree',-175,195),_F('tree',-145,195),_F('tree',-115,195),
      _F('tree',-55,195),_F('tree',-20,195),_F('tree',22,195),_F('tree',55,195),
      _F('tree',108,195),_F('tree',140,195),_F('tree',170,195),
      _F('hedge',-90,195),_F('hedge',90,195),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('car',-130,92),_F('car',30,92),_F('car',115,92),
      // T-9: 朝の住宅街ディテール追加
      _F('post_letter_box',-170,92),_F('post_letter_box',170,92),
      _F('laundry_balcony',-140,125),_F('laundry_balcony',55,125),_F('laundry_balcony',140,125),
      _F('flower_planter_row',-60,42),_F('flower_planter_row',22,42),_F('flower_planter_row',140,158),
      _F('ac_outdoor_cluster',-108,115),_F('ac_outdoor_cluster',108,158),
      _F('power_line',-90,45),_F('power_line',-90,155),_F('power_line',90,45),_F('power_line',90,155),
      _F('manhole_cover',-45,100),_F('manhole_cover',45,100),
    ],
    humans: [
      _H(-140,45),_H(-25,45),_H(55,45),_H(140,45),
      _H(-120,75),_H(-50,92),_H(40,75),_H(130,80),
      _H(-100,150),_H(80,140),_H(-30,180),_H(140,175),
      _H(0,60),_H(0,160),_H(-170,8),_H(170,8),_H(-170,195),_H(170,195),
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93), _G('grass', 0, 153.5, 360, 93),
      _G('dirt',  -130, 55, 60, 30), _G('dirt', -110, 140, 40, 30),
      _G('concrete', 60, 70, 40, 15), _G('concrete', 150, 75, 30, 20),
      _G('concrete', 30, 170, 50, 20), _G('dirt', 140, 165, 50, 30),
      _G('dirt', 0, 15, 60, 25), _G('dirt', 0, 185, 60, 25),
      _G('concrete', -170, 55, 30, 20), _G('concrete', 170, 155, 30, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 1: 住宅 + コンビニ + ランドロマット (前後 3 列密度) (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列
      _B('shed',-170,20),_B('shed',-140,20),_B('greenhouse',-115,22),
      _B('shed',-55,20),_B('greenhouse',-25,22),
      _B('shed',20,20),_B('shed',55,20),
      _B('greenhouse',105,22),_B('shed',140,20),_B('shed',170,20),
      // 下段 中列
      _B('garage',-155,58),_B('garage',-115,58),
      _B('garage',-55,58),_B('shed',-20,60),
      _B('garage',25,58),_B('shed',60,60),
      _B('garage',108,58),_B('greenhouse',145,57),
      // 下段 後列
      _B('house',-170,82),_B('convenience',-130,82),_B('house',-108,82),
      _B('house',-60,82),_B('laundromat',-25,84),
      _B('house',20,82),_B('convenience',55,82),
      _B('house',108,82),_B('convenience',145,82),_B('house',175,82),
      // 上段 前列
      _B('house',-170,125),_B('mansion',-130,127),
      _B('house',-60,125),_B('house',-25,125),
      _B('townhouse',22,129),_B('house',55,125),
      _B('convenience',115,127),_B('house',155,125),_B('house',178,125),
      // 上段 中列
      _B('garage',-155,155),_B('shed',-120,158),
      _B('garage',-55,155),_B('greenhouse',-20,155),
      _B('garage',25,155),_B('shed',60,158),
      _B('garage',110,155),_B('shed',145,158),
      // 上段 後列
      _B('shed',-170,185),_B('greenhouse',-140,184),_B('shed',-110,185),
      _B('greenhouse',-55,184),_B('shed',-20,185),
      _B('shed',22,185),_B('greenhouse',55,184),
      _B('shed',108,185),_B('greenhouse',140,184),_B('shed',170,185),
    ],
    furniture: [
      _F('tree',-175,8),_F('tree',-145,8),_F('tree',-115,8),
      _F('tree',-55,8),_F('tree',-25,8),_F('tree',22,8),_F('tree',55,8),
      _F('tree',105,8),_F('tree',140,8),_F('tree',170,8),
      _F('hedge',-90,8),_F('hedge',90,8),
      _F('flower_bed',-170,40),_F('flower_bed',-25,40),_F('flower_bed',140,40),
      _F('wood_fence',-90,30),_F('wood_fence',-90,45),_F('wood_fence',90,30),_F('wood_fence',90,45),
      _F('mailbox',-150,92),_F('vending',-45,92),_F('bicycle_rack',-20,92),
      _F('mailbox',135,92),_F('atm',145,92),
      _F('potted_plant',-140,70),_F('potted_plant',-60,70),
      _F('potted_plant',20,70),_F('potted_plant',108,70),
      _F('tree',-175,118),_F('tree',108,118),_F('tree',170,118),
      _F('potted_plant',-140,115),_F('potted_plant',-60,115),_F('potted_plant',22,115),
      _F('wood_fence',-90,140),_F('wood_fence',-90,155),_F('wood_fence',90,140),_F('wood_fence',90,155),
      _F('laundry_pole',-170,140),_F('laundry_pole',140,140),
      _F('flower_bed',-55,175),_F('flower_bed',108,175),
      _F('tree',-175,195),_F('tree',-145,195),_F('tree',-115,195),
      _F('tree',-55,195),_F('tree',-20,195),_F('tree',22,195),_F('tree',55,195),
      _F('tree',108,195),_F('tree',140,195),_F('tree',170,195),
      _F('hedge',-90,195),_F('hedge',90,195),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('car',-140,92),_F('car',60,92),_F('car',155,92),
      // T-9: コンビニ周辺の都市ディテール
      _F('kerbside_vending_pair',-130,92),_F('kerbside_vending_pair',55,92),_F('kerbside_vending_pair',145,92),
      _F('bicycle_row',-108,95),_F('bicycle_row',20,95),_F('bicycle_row',115,95),
      _F('puddle_reflection',-60,100),_F('puddle_reflection',80,100),
      _F('manhole_cover',-30,100),_F('manhole_cover',30,100),_F('manhole_cover',115,100),
      _F('cable_junction_box',-170,100),_F('cable_junction_box',170,100),
      _F('power_line',-90,45),_F('power_line',90,155),
    ],
    humans: [_H(-130,75),_H(-40,92),_H(30,92),_H(120,92),_H(-105,155),_H(75,145),_H(-25,180),_H(140,175),_H(-140,45),_H(30,45),_H(0,60),_H(0,160),_H(-170,8),_H(170,195)],
    grounds: [
      _G('grass',0,46.5,360,93),_G('grass',0,153.5,360,93),
      _G('concrete',-125,72,30,18),_G('concrete',-30,72,30,18),
      _G('concrete',60,75,35,18),_G('concrete',145,72,30,18),
      _G('dirt',-160,60,30,25),_G('dirt',175,165,30,30),
      _G('concrete',115,118,35,16),
      _G('dirt',0,15,60,25),_G('dirt',0,185,60,25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 2: 保育園・診療所・銀行 + 上端クロス (前後 3 列) (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列
      _B('shed',-170,20),_B('greenhouse',-140,22),_B('shed',-110,20),
      _B('shed',-55,20),_B('greenhouse',-20,22),
      _B('shed',22,20),_B('greenhouse',55,22),
      _B('greenhouse',105,22),_B('shed',140,20),_B('shed',170,20),
      // 下段 中列
      _B('garage',-155,58),_B('garage',-115,58),
      _B('garage',-55,58),_B('shed',-20,60),
      _B('garage',25,58),_B('shed',60,60),
      _B('garage',110,58),_B('greenhouse',145,57),
      // 下段 後列
      _B('house',-170,82),_B('daycare',-125,82),
      _B('clinic',-55,79),
      _B('post_office',30,80),_B('house',65,82),
      _B('bank',115,77),_B('house',155,82),_B('shed',178,85),
      // 上段 前列
      _B('house',-170,125),_B('house',-140,125),_B('townhouse',-108,127),
      _B('clinic',-50,123),
      _B('house',22,125),_B('house',55,125),
      _B('house',108,125),_B('garage',145,128),_B('house',175,125),
      // 上段 中列 (上端クロスまで余裕あり y=107~193)
      _B('garage',-155,155),_B('shed',-120,158),
      _B('garage',-55,155),_B('greenhouse',-20,155),
      _B('garage',25,155),_B('shed',60,158),
      _B('garage',110,155),_B('shed',145,158),
      // 上段 後列 (上端 HR y=193 まで、h12 なら y=187 が最大)
      _B('shed',-170,185),_B('greenhouse',-140,184),_B('shed',-110,185),
      _B('greenhouse',-55,184),_B('shed',-20,185),
      _B('shed',25,185),_B('greenhouse',55,184),
      _B('shed',108,185),_B('greenhouse',140,184),_B('shed',170,185),
    ],
    furniture: [
      _F('tree',-175,8),_F('tree',-140,8),_F('tree',-110,8),
      _F('tree',-55,8),_F('tree',-20,8),_F('tree',22,8),_F('tree',55,8),
      _F('tree',105,8),_F('tree',140,8),_F('tree',170,8),
      _F('hedge',-90,8),_F('hedge',90,8),
      _F('flag_pole',-125,92),_F('bicycle_rack',-55,92),
      _F('post_box',30,92),_F('bench',65,92),
      _F('atm',115,92),_F('mailbox',155,92),
      _F('bench',-108,114),_F('flower_bed',-50,112),
      _F('mailbox',170,115),_F('flag_pole',30,115),
      _F('potted_plant',-140,70),_F('potted_plant',-20,70),_F('potted_plant',145,70),
      _F('wood_fence',-90,30),_F('wood_fence',90,30),
      _F('wood_fence',-90,140),_F('wood_fence',90,140),
      _F('tree',-175,165),_F('tree',170,165),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('street_lamp',-90,193),_F('street_lamp',90,193),
      _F('traffic_light',-90,185),_F('traffic_light',90,185),
      _F('car',-130,92),_F('car',65,92),_F('car',155,92),
      // T-9: 保育園/診療所周辺の歩道橋 + 緑化
      _F('pedestrian_bridge',0,145),
      _F('bicycle_row',-125,95),_F('bicycle_row',-55,95),_F('bicycle_row',115,95),
      _F('flower_planter_row',-20,42),_F('flower_planter_row',30,105),_F('flower_planter_row',108,140),
      _F('guardrail_short',-50,100),_F('guardrail_short',50,100),
      _F('manhole_cover',-90,100),_F('manhole_cover',90,100),
      _F('taxi_rank_sign',115,100),
    ],
    humans: [_H(-125,90),_H(-55,92),_H(30,92),_H(115,92),_H(-105,140),_H(75,150),_H(140,175),_H(-30,180),_H(0,60),_H(160,60),_H(-170,8),_H(170,8)],
    grounds: [
      _G('grass',0,46.5,360,93),_G('concrete',0,153.5,360,93),
      _G('tile',-125,75,45,30),_G('tile',-55,72,30,35),
      _G('tile',115,72,35,30),
      _G('concrete',30,75,30,18),
      _G('grass',-108,160,30,30),_G('grass',155,160,40,30),
      _G('dirt',0,15,60,25),_G('grass',0,188,60,20),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // 3: 商店街入口 — 前後 3 列密度 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (小店)
      _B('florist',-170,22),_B('bakery',-140,22),_B('florist',-110,22),
      _B('bakery',-55,22),_B('florist',-20,22),
      _B('bakery',25,22),_B('florist',55,22),
      _B('florist',108,22),_B('bakery',140,22),_B('florist',170,22),
      // 下段 中列
      _B('cafe',-160,58),_B('bookstore',-115,58),
      _B('cafe',-55,58),_B('bookstore',-20,58),
      _B('cafe',25,58),_B('bookstore',60,58),
      _B('cafe',108,58),_B('bookstore',145,58),
      // 下段 後列
      _B('cafe',-165,82),_B('bookstore',-135,81),_B('bakery',-110,82),
      _B('florist',-60,82),_B('pharmacy',-25,80),
      _B('cafe',25,82),_B('bakery',55,82),
      _B('bookstore',108,82),_B('cafe',140,82),_B('florist',170,82),
      // 上段 前列
      _B('cafe',-165,125),_B('ramen',-135,125),_B('izakaya',-110,125),
      _B('bakery',-60,125),_B('bookstore',-25,125),
      _B('pharmacy',25,125),_B('florist',55,125),
      _B('ramen',108,125),_B('izakaya',140,125),_B('cafe',175,125),
      // 上段 中列
      _B('cafe',-160,155),_B('bookstore',-115,155),
      _B('cafe',-55,155),_B('bookstore',-20,155),
      _B('cafe',25,155),_B('bookstore',60,155),
      _B('cafe',108,155),_B('bookstore',145,155),
      // 上段 後列 (小店)
      _B('florist',-170,184),_B('bakery',-140,184),_B('florist',-110,184),
      _B('bakery',-55,184),_B('florist',-20,184),
      _B('bakery',25,184),_B('florist',55,184),
      _B('florist',108,184),_B('bakery',140,184),_B('florist',170,184),
    ],
    furniture: [
      _F('a_frame_sign',-170,40),_F('a_frame_sign',-140,40),_F('parasol',-110,40),
      _F('a_frame_sign',-55,40),_F('parasol',-20,40),
      _F('a_frame_sign',25,40),_F('parasol',55,40),
      _F('parasol',108,40),_F('a_frame_sign',140,40),_F('parasol',170,40),
      _F('shop_awning',-160,75),_F('noren',-115,75),
      _F('shop_awning',-55,75),_F('noren',-20,75),
      _F('shop_awning',25,75),_F('noren',60,75),
      _F('shop_awning',108,75),_F('noren',145,75),
      _F('a_frame_sign',-165,92),_F('potted_plant',-135,92),_F('parasol',-110,92),
      _F('shop_awning',-60,92),_F('a_frame_sign',-25,92),
      _F('parasol',25,92),_F('shop_awning',55,92),_F('potted_plant',108,92),_F('a_frame_sign',140,92),
      _F('chouchin',-165,115),_F('noren',-135,115),_F('shop_awning',-110,115),
      _F('parasol',-60,115),_F('a_frame_sign',-25,115),
      _F('potted_plant',25,115),_F('chouchin',55,115),
      _F('noren',108,115),_F('chouchin',140,115),_F('shop_awning',175,115),
      _F('noren',-160,140),_F('chouchin',-115,140),
      _F('noren',-55,140),_F('chouchin',-20,140),
      _F('noren',25,140),_F('chouchin',60,140),
      _F('noren',108,140),_F('chouchin',145,140),
      _F('a_frame_sign',-170,170),_F('parasol',-140,170),_F('a_frame_sign',-110,170),
      _F('parasol',-55,170),_F('a_frame_sign',-20,170),
      _F('parasol',25,170),_F('a_frame_sign',55,170),
      _F('a_frame_sign',108,170),_F('parasol',140,170),_F('a_frame_sign',170,170),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('bicycle_rack',0,40),_F('bicycle_rack',0,160),
    ],
    humans: [_H(-140,40),_H(-20,40),_H(55,40),_H(140,40),_H(-140,92),_H(-50,92),_H(35,92),_H(120,92),_H(-140,115),_H(-50,115),_H(35,115),_H(120,115),_H(-140,170),_H(55,170),_H(140,170),_H(-170,8),_H(170,8),_H(0,60),_H(0,160)],
    grounds: [
      _G('wood_deck',0,46.5,360,93),_G('wood_deck',0,153.5,360,93),
      _G('tile',-60,75,30,30),_G('tile',-25,75,30,30),
      _G('tile',25,75,30,30),_G('tile',-60,127,30,36),_G('tile',-30,127,30,36),
      _G('asphalt',0,46.5,16,93),_G('asphalt',0,153.5,16,93),
      _G('stone_pavement',175,125,30,30),_G('stone_pavement',-165,125,30,30),
      _G('tile',0,15,120,25),_G('tile',0,184,120,25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 4: ラーメン横丁 — 前後 3 列で賑わい最大密度 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列
      _B('ramen',-170,22),_B('izakaya',-140,22),_B('ramen',-110,22),
      _B('izakaya',-55,22),_B('ramen',-20,22),
      _B('ramen',22,22),_B('izakaya',55,22),
      _B('ramen',108,22),_B('izakaya',140,22),_B('ramen',170,22),
      // 下段 中列
      _B('ramen',-165,55),_B('izakaya',-135,55),_B('ramen',-110,55),
      _B('izakaya',-55,55),_B('ramen',-20,55),
      _B('ramen',20,55),_B('izakaya',55,55),
      _B('ramen',108,55),_B('izakaya',140,55),_B('ramen',170,55),
      // 下段 後列
      _B('ramen',-165,82),_B('izakaya',-135,82),_B('ramen',-110,82),
      _B('game_center',-55,79),_B('izakaya',-20,82),
      _B('ramen',22,82),_B('izakaya',55,82),
      _B('karaoke',115,78),_B('ramen',150,82),_B('izakaya',175,82),
      // 上段 前列
      _B('izakaya',-165,125),_B('ramen',-140,125),_B('ramen',-115,125),
      _B('izakaya',-55,125),_B('ramen',-20,125),
      _B('ramen',22,125),_B('izakaya',55,125),
      _B('game_center',115,127),_B('izakaya',155,125),_B('ramen',178,125),
      // 上段 中列
      _B('ramen',-165,155),_B('izakaya',-135,155),_B('ramen',-110,155),
      _B('izakaya',-55,155),_B('ramen',-20,155),
      _B('ramen',20,155),_B('izakaya',55,155),
      _B('ramen',108,155),_B('izakaya',140,155),_B('ramen',170,155),
      // 上段 後列
      _B('ramen',-170,184),_B('izakaya',-140,184),_B('ramen',-110,184),
      _B('izakaya',-55,184),_B('ramen',-20,184),
      _B('ramen',22,184),_B('izakaya',55,184),
      _B('ramen',108,184),_B('izakaya',140,184),_B('ramen',170,184),
    ],
    furniture: [
      _F('chouchin',-170,40),_F('noren',-140,40),_F('chouchin',-110,40),
      _F('chouchin',-55,40),_F('noren',-20,40),_F('chouchin',22,40),_F('noren',55,40),
      _F('chouchin',108,40),_F('noren',140,40),_F('chouchin',170,40),
      _F('chouchin',-165,70),_F('noren',-135,70),_F('chouchin',-110,70),
      _F('chouchin',-55,70),_F('noren',-20,70),_F('chouchin',22,70),_F('noren',55,70),
      _F('chouchin',108,70),_F('noren',140,70),_F('chouchin',170,70),
      _F('chouchin',-165,92),_F('noren',-135,92),_F('chouchin',-110,92),
      _F('chouchin',-55,92),_F('noren',-20,92),_F('chouchin',22,92),_F('noren',55,92),
      _F('chouchin',115,92),_F('noren',150,92),_F('chouchin',175,92),
      _F('chouchin',-165,115),_F('noren',-140,115),_F('chouchin',-115,115),
      _F('chouchin',-55,115),_F('noren',-20,115),_F('chouchin',22,115),_F('noren',55,115),
      _F('chouchin',115,115),_F('noren',155,115),_F('chouchin',178,115),
      _F('chouchin',-165,140),_F('noren',-135,140),_F('chouchin',-110,140),
      _F('chouchin',-55,140),_F('noren',-20,140),_F('chouchin',20,140),_F('noren',55,140),
      _F('chouchin',108,140),_F('noren',140,140),_F('chouchin',170,140),
      _F('chouchin',-170,170),_F('noren',-140,170),_F('chouchin',-110,170),
      _F('chouchin',-55,170),_F('noren',-20,170),_F('chouchin',22,170),_F('noren',55,170),
      _F('chouchin',108,170),_F('noren',140,170),_F('chouchin',170,170),
      _F('bicycle',0,50),_F('bicycle',0,160),_F('garbage',-90,50),_F('garbage',90,160),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('dumpster',-175,10),_F('dumpster',175,195),
    ],
    humans: [_H(-140,40),_H(-20,40),_H(55,40),_H(140,40),_H(-140,92),_H(-35,92),_H(40,92),_H(130,92),_H(-140,115),_H(-35,115),_H(40,115),_H(130,115),_H(-140,170),_H(55,170),_H(140,170),_H(-80,50),_H(80,160),_H(-170,140),_H(165,60),_H(0,60),_H(0,160)],
    grounds: [
      _G('asphalt',0,46.5,360,93),_G('asphalt',0,153.5,360,93),
      _G('tile',-55,75,35,30),_G('tile',115,73,30,35),
      _G('tile',-55,128,35,33),_G('tile',115,128,30,33),
      _G('concrete',-175,170,30,30),_G('concrete',175,50,30,30),
      _G('stone_pavement',175,170,30,30),
      _G('asphalt',0,15,360,25),_G('asphalt',0,185,360,25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 5: 駅前広場ランドマーク — 前方バスターミナル・後方繁華街で広場を挟む (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (小店・屋台)
      _B('yatai',-170,20),_B('yatai',-140,22),_B('shed',-110,20),
      _B('yatai',-55,22),_B('shed',-20,20),
      _B('yatai',22,22),_B('shed',55,20),
      _B('shed',108,20),_B('yatai',140,22),_B('shed',170,20),
      // 下段 中列 (広場の両脇)
      _B('gas_station',-155,55),_B('convenience',-115,57),
      _B('post_office',-50,55),_B('bank',-20,52),
      _B('cafe',55,55),
      _B('cafe',108,55),_B('bookstore',140,55),_B('florist',170,56),
      // 下段 後列 (駅舎ゾーン)
      _B('gas_station',-160,83),_B('convenience',-125,82),_B('pharmacy',-100,80),
      _B('post_office',-50,82),_B('bank',-20,77),
      _B('train_station',45,75),
      _B('cafe',110,82),_B('bookstore',140,82),_B('florist',170,81),
      // 上段 前列 (百貨店 + ランドマーク)
      _B('clock_tower',-150,135),_B('apartment',-115,125),
      _B('department_store',-30,125),
      _B('movie_theater',50,125),
      _B('hospital',125,128),_B('convenience',170,127),
      // 上段 中列 (オフィス・高層)
      _B('apartment_tall',-150,160),_B('mansion',-115,155),
      _B('apartment_tall',-30,165),
      _B('tower',50,160),
      _B('apartment',115,158),_B('mansion',155,155),
      // 上段 後列 (小店)
      _B('shed',-170,184),_B('yatai',-140,184),_B('shed',-110,184),
      _B('yatai',-55,184),_B('shed',-20,184),
      _B('shed',22,184),_B('yatai',55,184),
      _B('yatai',108,184),_B('shed',140,184),_B('yatai',170,184),
    ],
    furniture: [
      _F('banner_pole',-170,40),_F('banner_pole',-140,40),_F('banner_pole',-55,40),
      _F('banner_pole',22,40),_F('banner_pole',140,40),
      _F('tree',-170,10),_F('tree',170,10),_F('tree',-110,10),_F('tree',108,10),
      _F('sign_board',-160,95),_F('traffic_light',-90,92),_F('traffic_light',90,92),
      _F('bus_stop',-50,92),_F('post_box',-20,92),_F('atm',-20,87),
      _F('bus_stop',45,92),_F('bench',25,90),_F('bench',65,90),
      _F('flag_pole',45,60),_F('statue',45,50),_F('fountain',0,45),
      _F('tree',-175,60),_F('tree',105,60),_F('tree',170,60),_F('tree',-170,70),
      _F('newspaper_stand',30,92),_F('telephone_booth',-55,115),
      _F('flag_pole',-150,110),_F('banner_pole',-150,145),
      _F('flower_bed',-30,115),_F('flower_bed',50,115),
      _F('flower_bed',-30,145),_F('flower_bed',50,145),
      _F('bench',-80,170),_F('bench',80,170),_F('statue',-150,170),
      _F('tree',-175,175),_F('tree',175,175),_F('tree',-108,175),_F('tree',108,175),
      _F('banner_pole',-170,195),_F('banner_pole',-110,195),_F('banner_pole',-55,195),
      _F('banner_pole',22,195),_F('banner_pole',108,195),_F('banner_pole',170,195),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
    ],
    humans: [_H(-120,90),_H(-50,92),_H(0,92),_H(45,90),_H(80,92),_H(130,92),_H(170,92),_H(-120,115),_H(-30,115),_H(50,115),_H(125,115),_H(170,115),_H(0,60),_H(45,50),_H(-80,170),_H(80,170),_H(-140,40),_H(55,40),_H(140,40),_H(-30,175),_H(50,175)],
    grounds: [
      _G('concrete',0,46.5,360,93),_G('tile',0,153.5,360,93),
      _G('asphalt',-160,80,40,25),
      _G('tile',-25,78,50,30),_G('tile',45,75,80,45),
      _G('concrete',-90,46.5,40,93),_G('concrete',90,46.5,40,93),
      _G('tile',-30,125,90,50),_G('tile',50,125,70,50),_G('tile',125,128,60,50),
      _G('stone_pavement',0,130,18,50),
      _G('concrete',0,15,120,30),_G('tile',0,15,80,20),
      _G('tile',0,188,120,25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 6: 商店街後半 — 6 列密度 + 上端クロス (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列
      _B('florist',-170,22),_B('bakery',-140,22),_B('florist',-110,22),
      _B('bakery',-55,22),_B('florist',-20,22),
      _B('bakery',25,22),_B('florist',55,22),
      _B('florist',108,22),_B('bakery',140,22),_B('florist',170,22),
      // 下段 中列
      _B('cafe',-160,55),_B('bookstore',-115,55),
      _B('cafe',-55,55),_B('bookstore',-20,55),
      _B('cafe',25,55),_B('bookstore',60,55),
      _B('cafe',108,55),_B('bookstore',145,55),
      // 下段 後列
      _B('cafe',-160,82),_B('bookstore',-135,81),_B('bakery',-110,82),
      _B('florist',-60,82),_B('pharmacy',-25,80),
      _B('bookstore',25,82),_B('cafe',55,82),
      _B('ramen',108,82),_B('izakaya',140,81),_B('cafe',170,82),
      // 上段 前列
      _B('mansion',-150,125),_B('apartment',-108,125),
      _B('cafe',-60,125),_B('bookstore',-25,125),
      _B('movie_theater',35,125),
      _B('bakery',108,125),_B('florist',138,125),_B('cafe',170,125),
      // 上段 中列
      _B('cafe',-160,155),_B('bookstore',-115,155),
      _B('cafe',-55,155),_B('bookstore',-20,155),
      _B('cafe',25,155),_B('bookstore',60,155),
      _B('cafe',108,155),_B('bookstore',145,155),
      // 上段 後列
      _B('florist',-170,184),_B('bakery',-140,184),_B('florist',-110,184),
      _B('bakery',-55,184),_B('florist',-20,184),
      _B('bakery',25,184),_B('florist',55,184),
      _B('florist',108,184),_B('bakery',140,184),_B('florist',170,184),
    ],
    furniture: [
      _F('a_frame_sign',-170,40),_F('parasol',-140,40),_F('a_frame_sign',-110,40),
      _F('parasol',-55,40),_F('a_frame_sign',-20,40),
      _F('parasol',25,40),_F('a_frame_sign',55,40),
      _F('a_frame_sign',108,40),_F('parasol',140,40),_F('a_frame_sign',170,40),
      _F('shop_awning',-160,75),_F('noren',-115,75),_F('shop_awning',-55,75),
      _F('noren',-20,75),_F('shop_awning',25,75),_F('noren',60,75),
      _F('shop_awning',108,75),_F('noren',145,75),
      _F('a_frame_sign',-160,92),_F('shop_awning',-135,92),_F('potted_plant',-110,92),
      _F('noren',-60,92),_F('a_frame_sign',-25,92),
      _F('shop_awning',25,92),_F('parasol',55,92),
      _F('chouchin',108,92),_F('noren',140,92),_F('a_frame_sign',170,92),
      _F('potted_plant',-60,115),_F('shop_awning',-25,115),
      _F('banner_pole',35,140),_F('banner_pole',35,145),
      _F('a_frame_sign',108,115),_F('parasol',138,115),_F('shop_awning',170,115),
      _F('shop_awning',-160,140),_F('noren',-115,140),_F('shop_awning',-55,140),
      _F('noren',-20,140),_F('shop_awning',25,140),_F('noren',60,140),
      _F('shop_awning',108,140),_F('noren',145,140),
      _F('a_frame_sign',-170,170),_F('parasol',-140,170),_F('a_frame_sign',-110,170),
      _F('parasol',-55,170),_F('a_frame_sign',-20,170),
      _F('parasol',25,170),_F('a_frame_sign',55,170),
      _F('a_frame_sign',108,170),_F('parasol',140,170),_F('a_frame_sign',170,170),
      _F('bicycle_rack',0,50),_F('bicycle_rack',0,160),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('street_lamp',-90,193),_F('street_lamp',90,193),
      _F('traffic_light',-90,185),_F('traffic_light',90,185),
    ],
    humans: [_H(-140,40),_H(-20,40),_H(55,40),_H(140,40),_H(-140,92),_H(-50,92),_H(35,92),_H(125,92),_H(-50,115),_H(-25,115),_H(35,115),_H(125,115),_H(-140,170),_H(55,170),_H(140,170),_H(-170,60),_H(170,60),_H(0,60),_H(0,160)],
    grounds: [
      _G('wood_deck',0,46.5,360,93),_G('tile',0,153.5,360,93),
      _G('concrete',0,46.5,16,93),_G('concrete',0,153.5,16,93),
      _G('asphalt',-90,46.5,30,93),_G('asphalt',90,153.5,30,93),
      _G('stone_pavement',-150,125,30,35),_G('stone_pavement',170,125,30,35),
      _G('wood_deck',-60,125,40,30),_G('wood_deck',170,125,30,30),
      _G('tile',0,15,120,25),_G('wood_deck',0,184,120,25),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // 7: 駅裏飲食 — パチンコとカラオケの雑踏 6 列大密度化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=22)
      _B('ramen',-165,22),_B('izakaya',-138,22),_B('ramen',-110,22),
      _B('izakaya',-55,22),_B('ramen',-25,22),
      _B('izakaya',25,22),_B('ramen',55,22),
      _B('izakaya',110,22),_B('ramen',138,22),_B('izakaya',165,22),
      // 下段 中列 (y=55)
      _B('ramen',-170,55),_B('izakaya',-140,55),_B('ramen',-110,55),
      _B('karaoke',-55,55),_B('ramen',-20,55),
      _B('ramen',20,55),_B('karaoke',55,55),
      _B('izakaya',110,55),_B('ramen',140,55),_B('izakaya',170,55),
      // 下段 後列 (y=78)
      _B('pachinko',-155,78),_B('karaoke',-120,78),
      _B('ramen',-55,80),_B('izakaya',-25,79),
      _B('izakaya',20,79),_B('ramen',50,80),_B('karaoke',75,78),
      _B('pachinko',115,78),_B('ramen',150,80),_B('izakaya',175,79),
      // 上段 前列 (y=125)
      _B('izakaya',-165,125),_B('ramen',-140,125),_B('pachinko',-110,127),
      _B('karaoke',-55,127),_B('ramen',-20,125),
      _B('ramen',20,125),_B('izakaya',50,125),_B('pachinko',80,127),
      _B('game_center',115,127),_B('karaoke',155,127),_B('ramen',178,125),
      // 上段 中列 (y=155)
      _B('ramen',-170,155),_B('izakaya',-140,155),_B('ramen',-110,155),
      _B('izakaya',-55,155),_B('karaoke',-20,155),
      _B('karaoke',20,155),_B('izakaya',55,155),
      _B('ramen',110,155),_B('izakaya',140,155),_B('ramen',170,155),
      // 上段 後列 (y=184)
      _B('ramen',-170,184),_B('izakaya',-140,184),_B('ramen',-110,184),
      _B('izakaya',-55,184),_B('ramen',-25,184),
      _B('izakaya',25,184),_B('ramen',55,184),
      _B('izakaya',110,184),_B('ramen',140,184),_B('izakaya',170,184),
    ],
    furniture: [
      _F('chouchin',-155,10),_F('noren',-120,10),_F('chouchin',-55,10),_F('noren',-25,10),
      _F('chouchin',25,10),_F('noren',55,10),_F('chouchin',110,10),_F('noren',140,10),_F('chouchin',170,10),
      _F('chouchin',-155,40),_F('noren',-120,40),_F('chouchin',-55,40),_F('noren',-20,40),
      _F('chouchin',20,40),_F('noren',55,40),_F('chouchin',110,40),_F('noren',140,40),_F('chouchin',170,40),
      _F('chouchin',-155,70),_F('noren',-120,70),_F('chouchin',-55,70),_F('noren',-25,70),
      _F('chouchin',20,70),_F('noren',50,70),_F('chouchin',75,70),_F('chouchin',115,70),_F('noren',150,70),_F('chouchin',175,70),
      _F('chouchin',-155,115),_F('noren',-120,115),_F('chouchin',-55,115),_F('noren',-20,115),
      _F('chouchin',20,115),_F('noren',50,115),_F('chouchin',80,115),_F('chouchin',115,115),_F('noren',155,115),_F('chouchin',178,115),
      _F('chouchin',-155,140),_F('noren',-120,140),_F('chouchin',-55,140),_F('noren',-20,140),
      _F('chouchin',20,140),_F('noren',55,140),_F('chouchin',110,140),_F('noren',140,140),_F('chouchin',170,140),
      _F('chouchin',-155,170),_F('noren',-120,170),_F('chouchin',-55,170),_F('noren',-25,170),
      _F('chouchin',25,170),_F('noren',55,170),_F('chouchin',110,170),_F('noren',140,170),_F('chouchin',170,170),
      _F('garbage',-175,45),_F('garbage',175,45),_F('garbage',-175,155),_F('garbage',175,155),
      _F('dumpster',-175,15),_F('dumpster',175,15),_F('dumpster',-175,185),_F('dumpster',175,185),
      _F('bicycle',-90,60),_F('bicycle',90,150),_F('bicycle',-30,160),_F('bicycle',30,60),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('vending',-175,90),_F('vending',175,90),_F('vending',-175,110),_F('vending',175,110),
    ],
    humans: [_H(-135,10),_H(-40,10),_H(35,10),_H(130,10),_H(-135,40),_H(-40,40),_H(35,40),_H(130,40),_H(-135,70),_H(-40,70),_H(35,70),_H(130,70),_H(-135,140),_H(-40,140),_H(35,140),_H(130,140),_H(-135,170),_H(-40,170),_H(35,170),_H(130,170)],
    grounds: [
      _G('asphalt',0,46.5,360,93),_G('asphalt',0,153.5,360,93),
      _G('tile',-55,22,40,25),_G('tile',25,22,40,25),_G('tile',140,22,50,25),
      _G('tile',-55,77,30,30),_G('tile',-55,128,30,33),
      _G('tile',115,77,30,30),_G('tile',115,128,30,33),
      _G('tile',-55,184,40,25),_G('tile',25,184,40,25),_G('tile',140,184,50,25),
      _G('concrete',0,46.5,20,93),_G('concrete',0,153.5,20,93),
      _G('stone_pavement',-165,50,30,30),_G('stone_pavement',175,170,30,30),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 8: 町内公園 — 小学校と噴水 + 鯉池 6 列大密度化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=20)
      _B('shed',-170,20),_B('greenhouse',-138,20),_B('shed',-110,20),
      _B('shed',-55,20),_B('greenhouse',-25,20),
      _B('greenhouse',25,20),_B('shed',55,20),
      _B('shed',110,20),_B('greenhouse',138,20),_B('shed',170,20),
      // 下段 中列 (y=55)
      _B('greenhouse',-170,55),_B('shed',-140,55),_B('house',-105,55),
      _B('greenhouse',-55,55),_B('shed',-20,55),
      _B('shed',20,55),_B('greenhouse',55,55),
      _B('house',110,55),_B('shed',140,55),_B('greenhouse',170,55),
      // 下段 後列 (y=82)
      _B('shed',-170,85),_B('greenhouse',-130,84),
      _B('house',-65,80),_B('greenhouse',-25,84),
      _B('greenhouse',25,84),_B('house',65,80),
      _B('shed',108,85),_B('greenhouse',145,84),_B('shed',178,85),
      // 上段 前列 (y=125)
      _B('school',-130,128),
      _B('house',-25,125),
      _B('daycare',25,125),_B('house',65,125),
      _B('house',110,125),_B('house',145,125),_B('shed',178,120),
      // 上段 中列 (y=155)
      _B('greenhouse',-170,155),_B('shed',-140,155),_B('greenhouse',-110,155),
      _B('shed',-55,155),_B('greenhouse',-20,155),
      _B('greenhouse',20,155),_B('shed',55,155),
      _B('shed',110,155),_B('greenhouse',140,155),_B('shed',170,155),
      // 上段 後列 (y=184)
      _B('shed',-170,184),_B('greenhouse',-140,184),_B('shed',-110,184),
      _B('greenhouse',-55,184),_B('shed',-20,184),
      _B('shed',20,184),_B('greenhouse',55,184),
      _B('greenhouse',110,184),_B('shed',140,184),_B('greenhouse',170,184),
    ],
    furniture: [
      _F('tree',-175,10),_F('tree',-150,10),_F('tree',-105,10),_F('tree',-80,10),
      _F('tree',-55,10),_F('tree',0,10),_F('tree',55,10),
      _F('tree',80,10),_F('tree',125,10),_F('tree',160,10),
      _F('tree',-175,45),_F('tree',-105,45),_F('tree',-80,45),
      _F('tree',0,45),_F('tree',80,45),_F('tree',160,45),
      _F('fountain',-55,60),_F('fountain',65,60),
      _F('koi_pond',0,60),_F('stone_lantern',-25,45),_F('stone_lantern',25,45),
      _F('bench',-80,80),_F('bench',80,80),_F('bench',-30,85),_F('bench',30,85),
      _F('flower_bed',-110,55),_F('flower_bed',110,55),
      _F('tree',-170,140),_F('tree',-80,140),_F('tree',-30,140),
      _F('tree',60,140),_F('tree',110,140),_F('tree',175,140),
      _F('tree',-170,170),_F('tree',-80,170),_F('tree',-30,175),
      _F('flag_pole',-130,115),_F('flower_bed',-130,140),
      _F('tree',60,175),_F('tree',110,175),_F('tree',175,170),
      _F('tree',-150,195),_F('tree',-80,195),_F('tree',-30,195),
      _F('tree',60,195),_F('tree',150,195),
      _F('sakura_tree',-90,55),_F('sakura_tree',90,55),
      _F('sakura_tree',-90,155),_F('sakura_tree',90,155),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('bicycle_rack',-30,115),_F('bicycle_rack',30,115),
      _F('bench',-80,170),_F('bench',80,170),
    ],
    humans: [_H(-120,10),_H(-30,10),_H(30,10),_H(120,10),_H(-120,55),_H(-55,85),_H(0,80),_H(55,85),_H(120,55),_H(-130,115),_H(-30,140),_H(30,140),_H(120,170),_H(0,175),_H(-160,60),_H(160,60),_H(-120,155),_H(120,155),_H(-120,195),_H(120,195)],
    grounds: [
      _G('grass',0,46.5,360,93),_G('grass',0,153.5,360,93),
      _G('dirt',-55,60,30,35),_G('dirt',55,60,30,35),_G('dirt',0,55,25,40),
      _G('stone_pavement',0,93,360,6),_G('stone_pavement',0,107,360,6),
      _G('dirt',-130,140,40,40),_G('dirt',30,145,40,40),
      _G('stone_pavement',-170,50,20,90),_G('stone_pavement',170,50,20,90),
      _G('stone_pavement',-130,175,30,30),
      _G('dirt',-80,15,40,15),_G('dirt',80,15,40,15),
      _G('dirt',-80,195,40,15),_G('dirt',80,195,40,15),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 9: 町のシンボル神社 — 神社 + 五重塔 + 鳥居参道 + 上端クロス 6 列大密度化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=22)
      _B('kominka',-170,22),_B('chaya',-140,22),_B('kominka',-110,22),
      _B('chaya',-55,22),_B('kominka',-25,22),
      _B('kominka',25,22),_B('chaya',55,22),
      _B('kominka',110,22),_B('chaya',140,22),_B('kominka',170,22),
      // 下段 中列 (y=55)
      _B('chaya',-170,55),_B('kominka',-140,55),_B('chaya',-110,55),
      _B('kominka',-55,55),_B('chaya',-20,55),
      _B('chaya',20,55),_B('kominka',55,55),
      _B('chaya',110,55),_B('kominka',140,55),_B('chaya',170,55),
      // 下段 後列 (y=78)
      _B('temple',-155,77),
      _B('chaya',-55,80),_B('kominka',-20,81),
      _B('shrine',35,78),
      _B('kominka',108,81),_B('chaya',140,80),_B('kominka',175,81),
      // 上段 前列 (y=125)
      _B('kominka',-165,125),_B('pagoda',-130,145),
      _B('shrine',-55,127),_B('kominka',-20,125),
      _B('ryokan',35,125),
      _B('kominka',108,125),_B('chaya',140,125),_B('kominka',172,125),
      // 上段 中列 (y=158)
      _B('chaya',-170,158),_B('kominka',-140,158),
      _B('chaya',-55,158),_B('kominka',-20,158),
      _B('kominka',20,158),_B('chaya',55,158),
      _B('kominka',110,158),_B('chaya',140,158),_B('kominka',170,158),
      // 上段 後列 (y=184)
      _B('kominka',-170,184),_B('chaya',-140,184),_B('kominka',-110,184),
      _B('chaya',-55,184),_B('kominka',-25,184),
      _B('kominka',25,184),_B('chaya',55,184),
      _B('kominka',110,184),_B('chaya',140,184),_B('kominka',170,184),
    ],
    furniture: [
      _F('torii',0,30),_F('torii',0,60),_F('torii',0,85),
      _F('stone_lantern',-20,45),_F('stone_lantern',20,45),
      _F('stone_lantern',-20,80),_F('stone_lantern',20,80),
      _F('koma_inu',-15,60),_F('koma_inu',15,60),
      _F('sakura_tree',-90,45),_F('sakura_tree',90,45),
      _F('pine_tree',-175,50),_F('pine_tree',175,50),
      _F('offering_box',-55,92),_F('shinto_rope',35,60),
      _F('ema_rack',-55,115),_F('temizuya',-90,150),
      _F('torii',0,175),_F('stone_lantern',-20,170),_F('stone_lantern',20,170),
      _F('sakura_tree',-90,170),_F('sakura_tree',90,170),
      _F('bonsai',-30,115),_F('bonsai',110,115),
      _F('bamboo_fence',-175,120),_F('bamboo_fence',-175,130),
      _F('bamboo_fence',175,120),_F('bamboo_fence',175,130),
      _F('stone_lantern',35,108),_F('stone_lantern',-55,108),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('street_lamp',-90,195),_F('street_lamp',90,195),
      _F('traffic_light',-90,190),_F('traffic_light',90,190),
    ],
    humans: [_H(-155,92),_H(-55,92),_H(0,70),_H(35,92),_H(130,92),_H(-130,115),_H(-55,115),_H(35,115),_H(130,115),_H(0,175),_H(-170,60),_H(170,60)],
    grounds: [
      _G('grass',0,46.5,360,93),_G('stone_pavement',0,46.5,80,93),
      _G('gravel',0,46.5,40,93),
      _G('dirt',-130,140,40,50),
      _G('stone_pavement',0,153.5,360,93),_G('gravel',0,153.5,40,93),
      _G('grass',-175,153.5,30,93),_G('grass',175,153.5,30,93),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // 10: 町家密集 — 消防署と警察署 + 町家連続 6 列大密度化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=22)
      _B('townhouse',-170,22),_B('townhouse',-145,22),_B('townhouse',-120,22),
      _B('townhouse',-55,22),_B('kominka',-25,22),
      _B('kominka',25,22),_B('townhouse',55,22),
      _B('townhouse',105,22),_B('townhouse',130,22),_B('townhouse',155,22),_B('townhouse',178,22),
      // 下段 中列 (y=55)
      _B('kominka',-170,55),_B('townhouse',-140,55),_B('townhouse',-115,55),
      _B('townhouse',-55,55),_B('kominka',-20,55),
      _B('kominka',20,55),_B('townhouse',55,55),
      _B('townhouse',110,55),_B('townhouse',135,55),_B('kominka',170,55),
      // 下段 後列 (y=82)
      _B('townhouse',-165,82),_B('townhouse',-140,82),_B('townhouse',-115,82),
      _B('fire_station',-45,78),
      _B('mansion',35,79),
      _B('police_station',115,77),_B('townhouse',155,82),_B('townhouse',178,82),
      // 上段 前列 (y=125)
      _B('townhouse',-165,125),_B('townhouse',-140,125),_B('townhouse',-115,125),
      _B('kominka',-60,124),_B('townhouse',-25,125),
      _B('mansion',35,127),
      _B('townhouse',105,125),_B('townhouse',130,125),_B('townhouse',155,125),_B('townhouse',178,125),
      // 上段 中列 (y=158)
      _B('kominka',-170,158),_B('townhouse',-140,158),_B('townhouse',-115,158),
      _B('townhouse',-55,158),_B('kominka',-20,158),
      _B('kominka',20,158),_B('townhouse',55,158),
      _B('townhouse',110,158),_B('townhouse',135,158),_B('kominka',170,158),
      // 上段 後列 (y=184)
      _B('townhouse',-170,184),_B('townhouse',-145,184),_B('townhouse',-120,184),
      _B('townhouse',-55,184),_B('kominka',-25,184),
      _B('kominka',25,184),_B('townhouse',55,184),
      _B('townhouse',105,184),_B('townhouse',130,184),_B('townhouse',155,184),_B('townhouse',178,184),
    ],
    furniture: [
      _F('wood_fence',-130,92),_F('wood_fence',-100,92),_F('potted_plant',-165,92),
      _F('post_box',-45,92),_F('flag_pole',-45,60),
      _F('chouchin',35,92),_F('noren',35,95),
      _F('post_box',115,92),_F('flag_pole',115,60),_F('bench',115,90),
      _F('wood_fence',155,92),_F('wood_fence',178,92),
      _F('potted_plant',-165,115),_F('potted_plant',-140,115),_F('potted_plant',-115,115),
      _F('chouchin',-60,115),_F('noren',-25,115),
      _F('banner_pole',35,145),
      _F('potted_plant',105,115),_F('potted_plant',130,115),_F('potted_plant',155,115),_F('potted_plant',178,115),
      _F('tree',-90,45),_F('tree',90,45),_F('tree',-90,170),_F('tree',90,170),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('fire_extinguisher',-45,95),_F('bicycle_rack',115,92),
    ],
    humans: [_H(-130,92),_H(-45,85),_H(35,92),_H(115,85),_H(-130,115),_H(-60,115),_H(-25,115),_H(35,115),_H(120,115),_H(160,115),_H(0,50),_H(0,170)],
    grounds: [
      _G('concrete',0,46.5,360,93),_G('grass',0,153.5,360,93),
      _G('concrete',-45,80,40,25),_G('concrete',115,80,40,25),
      _G('concrete',35,78,40,25),
      _G('concrete',0,153.5,360,20),_G('concrete',0,153.5,360,93),
      _G('dirt',-150,170,50,30),_G('dirt',160,170,40,30),
      _G('grass',-60,180,30,25),_G('grass',60,180,30,25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // 11: Stage 2 への橋渡し — 夜営業のガソスタ・パチンコでネオン予感 6 列大密度化 (raw)
  { patternId: 's1_raw', raw: {
    buildings: [
      // 下段 前列 (y=22)
      _B('ramen',-170,22),_B('izakaya',-140,22),_B('ramen',-110,22),
      _B('izakaya',-55,22),_B('ramen',-25,22),
      _B('ramen',25,22),_B('izakaya',55,22),
      _B('izakaya',110,22),_B('ramen',140,22),_B('izakaya',170,22),
      // 下段 中列 (y=55)
      _B('ramen',-170,55),_B('izakaya',-140,55),_B('convenience',-110,55),
      _B('karaoke',-55,55),_B('ramen',-20,55),
      _B('ramen',20,55),_B('karaoke',55,55),
      _B('convenience',110,55),_B('izakaya',140,55),_B('ramen',170,55),
      // 下段 後列 (y=80)
      _B('ramen',-165,80),_B('izakaya',-140,79),_B('gas_station',-115,83),
      _B('pachinko',-50,78),
      _B('karaoke',30,78),_B('convenience',75,82),
      _B('izakaya',108,79),_B('gas_station',145,83),_B('convenience',175,82),
      // 上段 前列 (y=125)
      _B('izakaya',-165,125),_B('ramen',-140,125),_B('convenience',-110,127),
      _B('karaoke',-55,127),_B('ramen',-20,125),
      _B('pachinko',35,127),
      _B('ramen',108,125),_B('izakaya',140,125),_B('convenience',175,127),
      // 上段 中列 (y=158)
      _B('ramen',-170,158),_B('izakaya',-140,158),_B('ramen',-110,158),
      _B('izakaya',-55,158),_B('karaoke',-20,158),
      _B('karaoke',20,158),_B('izakaya',55,158),
      _B('ramen',110,158),_B('izakaya',140,158),_B('ramen',170,158),
      // 上段 後列 (y=184)
      _B('izakaya',-170,184),_B('ramen',-140,184),_B('izakaya',-110,184),
      _B('ramen',-55,184),_B('izakaya',-25,184),
      _B('izakaya',25,184),_B('ramen',55,184),
      _B('izakaya',110,184),_B('ramen',140,184),_B('izakaya',170,184),
    ],
    furniture: [
      _F('chouchin',-165,92),_F('noren',-140,92),_F('sign_board',-115,92),
      _F('chouchin',-50,92),_F('vending',-85,90),
      _F('chouchin',30,92),_F('sign_board',75,92),
      _F('chouchin',108,92),_F('sign_board',145,92),_F('vending',175,90),
      _F('chouchin',-165,115),_F('noren',-140,115),_F('sign_board',-110,115),
      _F('chouchin',-55,115),_F('noren',-20,115),
      _F('chouchin',35,115),_F('banner_pole',35,145),
      _F('chouchin',108,115),_F('noren',140,115),_F('sign_board',175,115),
      _F('traffic_cone',-115,95),_F('traffic_cone',145,95),
      _F('dumpster',0,50),_F('dumpster',0,160),
      _F('street_lamp',-90,100),_F('street_lamp',90,100),
      _F('telephone_booth',-85,155),_F('telephone_booth',85,50),
      _F('garbage',-170,170),_F('garbage',170,170),
    ],
    humans: [_H(-145,92),_H(-50,92),_H(30,92),_H(120,92),_H(-140,115),_H(-55,115),_H(-20,115),_H(35,115),_H(120,115),_H(170,115),_H(0,60),_H(0,170)],
    grounds: [
      _G('asphalt',0,46.5,360,93),_G('asphalt',0,153.5,360,93),
      _G('concrete',-115,80,40,25),_G('concrete',145,80,40,25),
      _G('tile',-50,77,35,30),_G('tile',30,77,30,30),
      _G('tile',-55,128,35,33),_G('tile',35,128,35,33),
      _G('concrete',75,82,30,20),_G('concrete',175,127,30,30),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
];

// ─── Stage 2: 繁華街・夜の街 (10 チャンク) ────────────────────
const STAGE_2_TEMPLATES: ChunkTemplate[] = [
  { patternId: 'neon_alley',         groundOverride: 'asphalt' },
  { patternId: 'dense_alley',        groundOverride: 'asphalt' },
  { patternId: 'entertainment_block',groundOverride: 'asphalt' },
  { patternId: 't_junction_west',    groundOverride: 'asphalt' },
  { patternId: 'neon_alley',         groundOverride: 'asphalt' },
  { patternId: 'dense_alley',        groundOverride: 'tile' },
  { patternId: 't_junction_east',    groundOverride: 'asphalt' },
  { patternId: 'entertainment_block',groundOverride: 'tile' },
  { patternId: 'neon_alley',         groundOverride: 'asphalt' },
  { patternId: 'dense_alley',        groundOverride: 'asphalt' },
];

// ─── Stage 3: 和風・古都 (12 チャンク) ────────────────────────
// 参道 → 茶屋 → 五重塔 → 古民家と進む。shrine_approach は 2 行 4 列、
// 中央列 (col 1,2) を寺社系に差し替え、外周 (col 0,3) に古民家/茶屋を置く
const STAGE_3_TEMPLATES: ChunkTemplate[] = [
  // 1: 鳥居で参道の導入
  { patternId: 'shrine_approach', groundOverride: 'gravel',
    overrides: [
      { row: 0, col: 0, sceneId: 'tea_house_garden' },
      { row: 0, col: 1, sceneId: 'sando_gate' },
      { row: 0, col: 3, sceneId: 'old_town_alley' },
      { row: 1, col: 1, sceneId: 'sando_gate' },
      { row: 1, col: 3, sceneId: 'tea_house_garden' },
    ] },
  // 2: 古民家路地
  { patternId: 'full_grid', groundOverride: 'stone_pavement',
    overrides: [
      { row: 0, col: 0, sceneId: 'old_town_alley' },
      { row: 0, col: 2, sceneId: 'tea_house_garden' },
      { row: 1, col: 1, sceneId: 'old_town_alley' },
      { row: 1, col: 3, sceneId: 'tea_house_garden' },
    ] },
  // 3: 参道進行
  { patternId: 'shrine_approach', groundOverride: 'gravel',
    overrides: [
      { row: 0, col: 1, sceneId: 'sando_gate' },
      { row: 0, col: 2, sceneId: 'sando_gate' },
      { row: 1, col: 1, sceneId: 'sando_gate' },
      { row: 1, col: 2, sceneId: 'sando_gate' },
      { row: 0, col: 3, sceneId: 'tea_house_garden' },
    ] },
  // 4: 旅館街
  { patternId: 'suburban_calm', groundOverride: 'stone_pavement',
    overrides: [
      { row: 0, col: 0, sceneId: 'ryokan_street' },
      { row: 0, col: 2, sceneId: 'ryokan_street' },
      { row: 1, col: 1, sceneId: 'tea_house_garden' },
    ] },
  // 5: 寺院の庭 (苔)
  { patternId: 'shrine_approach', groundOverride: 'moss',
    overrides: [
      { row: 0, col: 0, sceneId: 'tea_house_garden' },
      { row: 0, col: 1, sceneId: 'five_story_pagoda' },
      { row: 0, col: 3, sceneId: 'old_town_alley' },
      { row: 1, col: 1, sceneId: 'five_story_pagoda' },
      { row: 1, col: 3, sceneId: 'tea_house_garden' },
    ] },
  // 6: 古民家ずらり
  { patternId: 'staggered', groundOverride: 'stone_pavement',
    overrides: [
      { row: 0, col: 0, sceneId: 'old_town_alley' },
      { row: 0, col: 2, sceneId: 'old_town_alley' },
      { row: 1, col: 1, sceneId: 'ryokan_street' },
      { row: 1, col: 3, sceneId: 'tea_house_garden' },
    ] },
  // 7: 参道 + 茶屋
  { patternId: 'shrine_approach', groundOverride: 'gravel',
    overrides: [
      { row: 0, col: 0, sceneId: 'tea_house_garden' },
      { row: 0, col: 1, sceneId: 'sando_gate' },
      { row: 0, col: 3, sceneId: 'tea_house_garden' },
      { row: 1, col: 1, sceneId: 'sando_gate' },
    ] },
  // 8: 五重塔の中央広場
  { patternId: 'plaza_center', groundOverride: 'stone_pavement',
    overrides: [
      { row: 0, col: 0, sceneId: 'five_story_pagoda' },
      { row: 0, col: 3, sceneId: 'five_story_pagoda' },
      { row: 1, col: 1, sceneId: 'ryokan_street' },
    ] },
  // 9: 旅館と茶屋の通り
  { patternId: 'shrine_approach', groundOverride: 'wood_deck',
    overrides: [
      { row: 0, col: 0, sceneId: 'ryokan_street' },
      { row: 0, col: 1, sceneId: 'sando_gate' },
      { row: 0, col: 3, sceneId: 'tea_house_garden' },
      { row: 1, col: 1, sceneId: 'sando_gate' },
      { row: 1, col: 3, sceneId: 'ryokan_street' },
    ] },
  // 10: 古民家街 (落ち葉)
  { patternId: 'full_grid', groundOverride: 'fallen_leaves',
    overrides: [
      { row: 0, col: 0, sceneId: 'old_town_alley' },
      { row: 0, col: 2, sceneId: 'tea_house_garden' },
      { row: 1, col: 1, sceneId: 'old_town_alley' },
      { row: 1, col: 3, sceneId: 'old_town_alley' },
    ] },
  // 11: 五重塔 (苔)
  { patternId: 'shrine_approach', groundOverride: 'moss',
    overrides: [
      { row: 0, col: 1, sceneId: 'five_story_pagoda' },
      { row: 0, col: 3, sceneId: 'tea_house_garden' },
      { row: 1, col: 1, sceneId: 'five_story_pagoda' },
      { row: 1, col: 3, sceneId: 'old_town_alley' },
    ] },
  // 12: 終盤 参道
  { patternId: 'shrine_approach', groundOverride: 'gravel',
    overrides: [
      { row: 0, col: 0, sceneId: 'tea_house_garden' },
      { row: 0, col: 1, sceneId: 'sando_gate' },
      { row: 0, col: 2, sceneId: 'sando_gate' },
      { row: 1, col: 1, sceneId: 'sando_gate' },
      { row: 1, col: 3, sceneId: 'ryokan_street' },
    ] },
];

// ─── Stage 4: 港湾・工業地帯 (10 チャンク) ────────────────────
// harbor_warehouse: rows 2, cols 4, merge(row=1, col=0, span=2)
// 倉庫 → クレーン → 工場 → コンテナヤードの展開
const STAGE_4_TEMPLATES: ChunkTemplate[] = [
  // 1: 倉庫並び導入 (油汚れコンクリ)
  { patternId: 'harbor_warehouse', groundOverride: 'oil_stained_concrete',
    overrides: [
      { row: 0, col: 0, sceneId: 'dock_shack' },
      { row: 0, col: 1, sceneId: 'port_warehouse_row' },
      { row: 0, col: 3, sceneId: 'warehouse_district' },
      { row: 1, col: 0, sceneId: 'warehouse_district' },   // merged
      { row: 1, col: 2, sceneId: 'port_warehouse_row' },
      { row: 1, col: 3, sceneId: 'dock_shack' },
    ] },
  // 2: 工場煙突と埠頭
  { patternId: 'office_district', groundOverride: 'steel_plate',
    overrides: [
      { row: 0, col: 0, sceneId: 'factory_smokestacks' },
      { row: 0, col: 2, sceneId: 'dock_shack' },
      { row: 1, col: 1, sceneId: 'port_warehouse_row' },
      { row: 1, col: 3, sceneId: 'warehouse_district' },
    ] },
  // 3: コンテナヤード + クレーン
  { patternId: 'harbor_warehouse', groundOverride: 'steel_plate',
    overrides: [
      { row: 0, col: 0, sceneId: 'dock_shack' },
      { row: 0, col: 1, sceneId: 'container_yard' },
      { row: 0, col: 2, sceneId: 'container_yard' },
      { row: 0, col: 3, sceneId: 'warehouse_district' },
      { row: 1, col: 0, sceneId: 'container_yard' },   // merged
      { row: 1, col: 2, sceneId: 'factory_smokestacks' },
      { row: 1, col: 3, sceneId: 'dock_shack' },
    ] },
  // 4: 倉庫密集
  { patternId: 'office_district', groundOverride: 'oil_stained_concrete',
    overrides: [
      { row: 0, col: 0, sceneId: 'warehouse_district' },
      { row: 0, col: 2, sceneId: 'port_warehouse_row' },
      { row: 1, col: 1, sceneId: 'warehouse_district' },
      { row: 1, col: 3, sceneId: 'port_warehouse_row' },
    ] },
  // 5: 工場地帯
  { patternId: 'harbor_warehouse', groundOverride: 'oil_stained_concrete',
    overrides: [
      { row: 0, col: 0, sceneId: 'factory_smokestacks' },
      { row: 0, col: 1, sceneId: 'port_warehouse_row' },
      { row: 0, col: 3, sceneId: 'factory_smokestacks' },
      { row: 1, col: 0, sceneId: 'factory_smokestacks' }, // merged
      { row: 1, col: 2, sceneId: 'container_yard' },
      { row: 1, col: 3, sceneId: 'dock_shack' },
    ] },
  // 6: 大倉庫地域
  { patternId: 'full_grid', groundOverride: 'steel_plate',
    overrides: [
      { row: 0, col: 0, sceneId: 'warehouse_district' },
      { row: 0, col: 2, sceneId: 'port_warehouse_row' },
      { row: 1, col: 1, sceneId: 'port_warehouse_row' },
      { row: 1, col: 3, sceneId: 'warehouse_district' },
    ] },
  // 7: クレーン見本市
  { patternId: 'office_district', groundOverride: 'steel_plate',
    overrides: [
      { row: 0, col: 0, sceneId: 'container_yard' },
      { row: 0, col: 2, sceneId: 'container_yard' },
      { row: 1, col: 1, sceneId: 'factory_smokestacks' },
      { row: 1, col: 3, sceneId: 'port_warehouse_row' },
    ] },
  // 8: コンテナずらり
  { patternId: 'harbor_warehouse', groundOverride: 'oil_stained_concrete',
    overrides: [
      { row: 0, col: 0, sceneId: 'dock_shack' },
      { row: 0, col: 1, sceneId: 'container_yard' },
      { row: 0, col: 3, sceneId: 'port_warehouse_row' },
      { row: 1, col: 0, sceneId: 'container_yard' }, // merged
      { row: 1, col: 2, sceneId: 'container_yard' },
      { row: 1, col: 3, sceneId: 'factory_smokestacks' },
    ] },
  // 9: 工場と倉庫の混成
  { patternId: 'office_district', groundOverride: 'oil_stained_concrete',
    overrides: [
      { row: 0, col: 0, sceneId: 'factory_smokestacks' },
      { row: 0, col: 2, sceneId: 'warehouse_district' },
      { row: 1, col: 1, sceneId: 'container_yard' },
      { row: 1, col: 3, sceneId: 'port_warehouse_row' },
    ] },
  // 10: 最終
  { patternId: 'harbor_warehouse', groundOverride: 'steel_plate',
    overrides: [
      { row: 0, col: 0, sceneId: 'dock_shack' },
      { row: 0, col: 1, sceneId: 'container_yard' },
      { row: 0, col: 2, sceneId: 'port_warehouse_row' },
      { row: 0, col: 3, sceneId: 'factory_smokestacks' },
      { row: 1, col: 0, sceneId: 'warehouse_district' }, // merged
      { row: 1, col: 2, sceneId: 'container_yard' },
      { row: 1, col: 3, sceneId: 'dock_shack' },
    ] },
];

// ─── Stage 5: テーマパーク・祭り (フィナーレ 14 チャンク) ─────
// 屋台通り → メリーゴーランド → ジェットコースター → パレード → GOAL
const STAGE_5_TEMPLATES: ChunkTemplate[] = [
  // 1: 入場・屋台通り導入
  { patternId: 'entertainment_block', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 1, sceneId: 'yatai_small' },
      { row: 1, col: 3, sceneId: 'yatai_small' },
    ] },
  // 2: メリーゴーランド広場
  { patternId: 'park_plaza_radial', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 0, sceneId: 'carousel_plaza' }, // merged
      { row: 1, col: 2, sceneId: 'carousel_plaza' }, // merged
    ] },
  // 3: 祭り太鼓の広場
  { patternId: 'entertainment_block', groundOverride: 'red_carpet',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_street' },
      { row: 0, col: 2, sceneId: 'yatai_small' },
      { row: 1, col: 1, sceneId: 'parade_tent' },
      { row: 1, col: 3, sceneId: 'yatai_small' },
    ] },
  // 4: ジェットコースター登場
  { patternId: 'park_plaza_radial', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 0, sceneId: 'coaster_thrill' }, // merged
      { row: 1, col: 2, sceneId: 'carousel_plaza' }, // merged
    ] },
  // 5: 公園休憩
  { patternId: 'park_break' },
  // 6: 屋台大通り
  { patternId: 'entertainment_block', groundOverride: 'red_carpet',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_street' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 1, sceneId: 'yatai_small' },
      { row: 1, col: 3, sceneId: 'yatai_small' },
    ] },
  // 7: 大テント
  { patternId: 'park_plaza_radial', groundOverride: 'red_carpet',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_small' },
      { row: 1, col: 0, sceneId: 'parade_tent' }, // merged
      { row: 1, col: 2, sceneId: 'parade_tent' }, // merged
    ] },
  // 8: 第 2 コースター
  { patternId: 'campus_district', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_street' },
      { row: 0, col: 2, sceneId: 'yatai_small' },
      { row: 1, col: 1, sceneId: 'coaster_thrill' },
      { row: 1, col: 3, sceneId: 'carousel_plaza' },
    ] },
  // 9: メリーゴーランド × 2
  { patternId: 'entertainment_block', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'carousel_plaza' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 1, sceneId: 'carousel_plaza' },
      { row: 1, col: 3, sceneId: 'yatai_small' },
    ] },
  // 10: パレード
  { patternId: 'park_plaza_radial', groundOverride: 'red_carpet',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_small' },
      { row: 1, col: 0, sceneId: 'parade_tent' }, // merged
      { row: 1, col: 2, sceneId: 'coaster_thrill' }, // merged
    ] },
  // 11: 公園休憩
  { patternId: 'park_break' },
  // 12: クライマックス屋台通り
  { patternId: 'entertainment_block', groundOverride: 'red_carpet',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_street' },
      { row: 0, col: 2, sceneId: 'yatai_street' },
      { row: 1, col: 1, sceneId: 'parade_tent' },
      { row: 1, col: 3, sceneId: 'yatai_small' },
    ] },
  // 13: ラストアトラクション
  { patternId: 'park_plaza_radial', groundOverride: 'checker_tile',
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 2, sceneId: 'yatai_small' },
      { row: 1, col: 0, sceneId: 'coaster_thrill' }, // merged
      { row: 1, col: 2, sceneId: 'carousel_plaza' }, // merged
    ] },
  // 14: GOAL
  { patternId: 'goal_final', isGoal: true,
    overrides: [
      { row: 0, col: 0, sceneId: 'yatai_small' },
      { row: 0, col: 3, sceneId: 'yatai_small' },
      { row: 1, col: 0, sceneId: 'parade_tent' },
      { row: 1, col: 2, sceneId: 'carousel_plaza' },
    ] },
];

export const STAGES: StageDef[] = [
  { id: 0, name: '住宅街ミックス都市', templates: STAGE_1_TEMPLATES, sidewalkZone: 0,
    bgTop: [0.52, 0.74, 0.96], bgBottom: [0.38, 0.50, 0.38] },
  { id: 1, name: '繁華街・夜の街',     templates: STAGE_2_TEMPLATES, sidewalkZone: 2,
    bgTop: [0.10, 0.08, 0.25], bgBottom: [0.22, 0.14, 0.32] },
  { id: 2, name: '和風・古都',        templates: STAGE_3_TEMPLATES, sidewalkZone: 3,
    bgTop: [0.92, 0.78, 0.82], bgBottom: [0.62, 0.52, 0.44] },
  { id: 3, name: '港湾・工業地帯',     templates: STAGE_4_TEMPLATES, sidewalkZone: 2,
    bgTop: [0.58, 0.62, 0.70], bgBottom: [0.40, 0.42, 0.48] },
  { id: 4, name: 'テーマパーク・祭り', templates: STAGE_5_TEMPLATES, sidewalkZone: 4,
    bgTop: [0.96, 0.72, 0.50], bgBottom: [0.66, 0.48, 0.62] },
];

/** 総チャンク数 (全ステージの templates 合計) */
export const TOTAL_CHUNKS = STAGES.reduce((n, s) => n + s.templates.length, 0);

/** ステージ開始チャンク ID の累積配列 (prefix sum) */
const STAGE_OFFSETS: number[] = (() => {
  const out: number[] = [0];
  for (const s of STAGES) out.push(out[out.length - 1] + s.templates.length);
  return out;
})();

export type ChunkInfo =
  | { finished: true }
  | { finished: false; stage: StageDef; stageIndex: number; template: ChunkTemplate;
      inStageIndex: number; isGoal: boolean };

/** chunkId から所属ステージ・テンプレートを解決 */
export function chunkInfoFor(chunkId: number): ChunkInfo {
  if (chunkId < 0 || chunkId >= TOTAL_CHUNKS) return { finished: true };
  for (let si = 0; si < STAGES.length; si++) {
    if (chunkId < STAGE_OFFSETS[si + 1]) {
      const inStageIndex = chunkId - STAGE_OFFSETS[si];
      const template = STAGES[si].templates[inStageIndex];
      return {
        finished: false,
        stage: STAGES[si],
        stageIndex: si,
        template,
        inStageIndex,
        isGoal: !!template.isGoal,
      };
    }
  }
  return { finished: true };
}

// 歩道家具のプール (ゾーン別)
const SIDEWALK_FURNITURE: Record<number, Array<FurnitureType>> = {
  // Zone 0: 住宅街 — 緑と生活感
  0: ['tree', 'tree', 'bench', 'tree', 'power_pole', 'flower_bed', 'bench',
      'bush', 'sakura_tree', 'planter', 'street_lamp', 'bicycle_rack'],
  // Zone 1: 商業区 — 看板・自販機密集
  1: ['sign_board', 'vending', 'garbage', 'bench', 'traffic_light', 'parasol',
      'vending', 'sign_board', 'atm', 'post_box', 'newspaper_stand', 'bus_stop',
      'street_lamp', 'bollard', 'dumpster', 'recycling_bin'],
  // Zone 2: オフィス・工業 — 金属・コンクリ
  2: ['power_pole', 'vending', 'bench', 'garbage', 'sign_board', 'bench', 'vending',
      'street_lamp', 'electric_box', 'fire_extinguisher', 'flag_pole', 'statue',
      'pine_tree', 'palm_tree', 'bamboo_cluster', 'hedge'],
  // Zone 3: 和風 — 石灯籠・鳥居・桜・竹
  3: ['stone_lantern', 'sakura_tree', 'pine_tree', 'bamboo_cluster', 'planter',
      'stone_lantern', 'bonsai', 'sakura_tree', 'bush', 'rock', 'shinto_rope',
      'stone_lantern', 'pine_tree', 'potted_plant'],
  // Zone 4: 祭り・テーマパーク — 提灯・幟・屋台飾り
  4: ['chouchin', 'flag_pole', 'banner_pole', 'sign_board', 'chouchin', 'parasol',
      'noren', 'vending', 'chouchin', 'a_frame_sign', 'flag_pole', 'parasol',
      'bench', 'street_lamp'],
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
  // 公園設備: 自販機・パラソル・像で壊しがい追加
  items.push({ type: 'vending', x: -130, y: centerY - 18 });
  items.push({ type: 'vending', x:  130, y: centerY - 18 });
  items.push({ type: 'parasol', x: -50, y: centerY + 14 });
  items.push({ type: 'parasol', x:  50, y: centerY + 14 });
  items.push({ type: 'statue', x: -140, y: centerY });
  items.push({ type: 'statue', x:  140, y: centerY });
  items.push({ type: 'street_lamp', x: -90, y: centerY + 18 });
  items.push({ type: 'street_lamp', x:  90, y: centerY + 18 });
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

// ===== Grid-based chunk generation =====

/** 空のチャンクデータ (TOTAL_CHUNKS 超過時の安全弁) */
function emptyChunk(chunkId: number): ChunkData {
  const baseY = C.WORLD_MAX_Y + chunkId * C.CHUNK_HEIGHT;
  return {
    chunkId, baseY,
    stageIndex: 0,
    roads: [],
    horizontalRoads: [],
    verticalRoads: [],
    intersections: [],
    buildings: [],
    furniture: [],
    specialAreas: [],
    grounds: [],
    prePlacedHumans: [],
  };
}

/** 1 チャンク分のコンテンツを手書きステージテンプレートから生成する */
/** raw チャンクを ChunkData に変換 */
function buildRawChunk(
  chunkId: number,
  baseY: number,
  stageIndex: number,
  sidewalkZone: number,
  raw: RawChunkBody
): ChunkData {
  const buildings: BuildingDef[] = raw.buildings.map(b => ({
    size: b.size, x: b.dx, y: baseY + b.dy, blockIdx: chunkId,
  }));
  const furniture: FurnitureDef[] = raw.furniture.map(f => ({
    type: f.type, x: f.dx, y: baseY + f.dy,
  }));
  const prePlacedHumans = raw.humans.map(h => ({ x: h.dx, y: baseY + h.dy }));
  const grounds: GroundTile[] = raw.grounds.map(g => ({
    type: g.type, x: g.dx, y: baseY + g.dy, w: g.w, h: g.h,
  }));
  const horizontalRoads: ResolvedHorizontalRoad[] = raw.horizontalRoads.map(r => ({
    cy: baseY + r.dy, h: r.h, xMin: r.xMin, xMax: r.xMax, cls: r.cls,
  }));
  const verticalRoads: ResolvedVerticalRoad[] = raw.verticalRoads.map(r => ({
    cx: r.dx, w: r.w,
    yMin: baseY + r.yMinLocal, yMax: baseY + r.yMaxLocal, cls: r.cls,
  }));

  const intersections: Intersection[] = [];
  for (const h of horizontalRoads) {
    for (const v of verticalRoads) {
      if (v.cx >= h.xMin && v.cx <= h.xMax && h.cy >= v.yMin && h.cy <= v.yMax) {
        intersections.push({ x: v.cx, y: h.cy, hThickness: h.h, vThickness: v.w });
      }
    }
  }
  const roads: ChunkRoad[] = horizontalRoads
    .filter(r => r.xMin <= -179 && r.xMax >= 179)
    .map(r => ({ y: r.cy, h: r.h }));
  // 歩道ファニチャ (全幅水平道路のみ)
  for (const r of horizontalRoads) {
    if (r.xMin <= -179 && r.xMax >= 179) {
      furniture.push(...generateSidewalkFurniture(r.cy, sidewalkZone, chunkId));
    }
  }

  return {
    chunkId, baseY,
    stageIndex,
    roads,
    horizontalRoads,
    verticalRoads,
    intersections,
    buildings,
    furniture,
    specialAreas: [],
    grounds,
    prePlacedHumans,
  };
}

export function generateChunk(chunkId: number): ChunkData {
  const info = chunkInfoFor(chunkId);
  if (info.finished) return emptyChunk(chunkId);

  const baseY = C.WORLD_MAX_Y + chunkId * C.CHUNK_HEIGHT;

  // raw チャンク: grid/pattern/scene を使わず直接オブジェクト配置
  if (info.template.raw) {
    return buildRawChunk(chunkId, baseY, info.stageIndex, info.stage.sidewalkZone, info.template.raw);
  }

  const pattern = PATTERN_BY_ID[info.template.patternId];
  if (!pattern) {
    console.warn(`[stages] unknown patternId "${info.template.patternId}" @ chunk ${chunkId}`);
    return emptyChunk(chunkId);
  }

  const buildings: BuildingDef[] = [];
  const furniture: FurnitureDef[] = [];
  const grounds: GroundTile[] = [];
  const specialAreas: ChunkSpecialArea[] = [];
  const horizontalRoads: ResolvedHorizontalRoad[] = [];
  const verticalRoads: ResolvedVerticalRoad[] = [];
  const prePlacedHumans: Array<{ x: number; y: number }> = [];

  // park_break は特殊エリア化
  if (pattern.id === 'park_break') {
    const centerY = baseY + C.CHUNK_HEIGHT / 2;
    specialAreas.push({ type: 'park', y: centerY, h: C.CHUNK_HEIGHT - 20 });
    furniture.push(...generateParkFurniture(centerY, chunkId));
  } else {
    // grid block を生成してシーン配置
    const block = buildBlock(pattern, -180, baseY, C.CELL_W, C.CELL_H);
    const p = placeGridBlock(block, pattern, chunkId, info.template.groundOverride, info.template.overrides, info.template.groundGrid);
    buildings.push(...p.buildings);
    furniture.push(...p.furniture);
    if (p.grounds) grounds.push(...p.grounds);
    if (p.humans) prePlacedHumans.push(...p.humans);

    // 水平道路を resolve
    for (const seg of pattern.horizontalRoads) {
      const cy = baseY + seg.gridLine * C.CELL_H;
      const xMin = -180 + seg.startCell * C.CELL_W;
      const xMax = -180 + seg.endCell * C.CELL_W;
      horizontalRoads.push({
        cy,
        h: seg.thickness ?? (seg.cls === 'avenue' ? 18 : 14),
        xMin, xMax,
        cls: seg.cls,
      });
    }
    // 垂直道路を resolve
    for (const seg of pattern.verticalRoads) {
      const cx = -180 + seg.gridLine * C.CELL_W;
      const yMin = baseY + seg.startCell * C.CELL_H;
      const yMax = baseY + seg.endCell * C.CELL_H;
      verticalRoads.push({
        cx,
        w: seg.thickness ?? 14,
        yMin, yMax,
        cls: seg.cls,
      });
    }
  }

  // 交差点を自動生成
  const intersections: Intersection[] = [];
  for (const h of horizontalRoads) {
    for (const v of verticalRoads) {
      if (v.cx >= h.xMin && v.cx <= h.xMax && h.cy >= v.yMin && h.cy <= v.yMax) {
        intersections.push({
          x: v.cx, y: h.cy,
          hThickness: h.h, vThickness: v.w,
        });
      }
    }
  }

  // 互換: vehicle lane 用に全幅水平道路だけ roads に
  const roads: ChunkRoad[] = horizontalRoads
    .filter(r => r.xMin <= -179 && r.xMax >= 179)
    .map(r => ({ y: r.cy, h: r.h }));

  // 歩道家具: 水平道路のみ対象 (全幅のみ) — ステージ別ゾーン
  for (const r of horizontalRoads) {
    if (r.xMin <= -179 && r.xMax >= 179) {
      furniture.push(...generateSidewalkFurniture(r.cy, info.stage.sidewalkZone, chunkId));
    }
  }

  return {
    chunkId, baseY,
    stageIndex: info.stageIndex,
    roads,
    horizontalRoads,
    verticalRoads,
    intersections,
    buildings,
    furniture,
    specialAreas,
    grounds,
    prePlacedHumans,
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
    grounds: city.grounds ?? [],
    prePlacedHumans: city.humans ?? [],
    bgTopR: 0.52, bgTopG: 0.74, bgTopB: 0.96,
    bgBottomR: 0.38, bgBottomG: 0.36, bgBottomB: 0.33,
  };
}
