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

// ─── Stage 1: 住宅街から街はずれへ (12 チャンク, raw 配置) ────────
// 【全体の物語】: プレイヤーは怪獣として北→南 (y=0→2400) を進む。4 Acts で構成:
//   Act I  (Chunks 0-2):  閑静な住宅街       — 庭付き一戸建て、物置、温室、桜
//   Act II (Chunks 3-5):  生活と小商店        — コンビニ、クリーニング、保育園
//   Act III(Chunks 6-8):  ローカル商店街     — 小学校、パン屋、本屋、小さな駅
//   Act IV (Chunks 9-11): 街はずれ           — 畑、倉庫、踏切 (Stage 2 handoff)
// 【連続要素】: 主要通り x=0 のファサード連続 / 桜並木 (Chunks 0-5) / 街路樹 (Chunks 6-11) /
//              電柱+電線を奥層 (y=170-195) に散らす / 人流グラデ
// 【設計原則】: scene-like 物語グルーピング (建物に帰属する家具をまとめる) /
//              左右非対称 (偶数個でなく奇数個) / チャンク境界 (y=0, y=200) 近傍は対で繋ぐ
const STAGE_1_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 閑静な住宅街 (Chunks 0-2) ═══════════════════════════════
  // コンセプト: 朝の空気が残る一戸建て住宅街。各戸の庭、物置、車庫、温室で
  // 「それぞれの家に暮らしがある」感を出す。桜並木が Act 全体を貫く。

  // ── Chunk 0: 朝の住宅街 (桜並木起点) ──
  // ● 統一軸 (Act I 全体で連続):
  //   - wood_fence ribbon   x=-178 / +178 に縦連続
  //   - facade ライン       y=22 上段 / y=118 下段 に全家の mailbox + potted_plant
  //   - stone_pavement 歩道 x=-65 幅 24 (C0-C2 で 600px 連続)
  //   - sakura boulevard    x=+125-155 に sakura_tree, その下に fallen_leaves リボン
  //   - dirt 菜園帯         x=-150 縦に家庭菜園
  //   - power_pole 奥層    x=-175 / +178 に電柱+電線
  // ● 独自要素: 朝の静けさ (庭仕事の老人、通勤前の家族)
  // ● C0/C1 境界に「町内小広場」の入口 (ベンチ + 花壇 + tile)
  { patternId: 's1_raw', raw: {
    buildings: [
      // === 上段: 住宅列 (玄関が主要通り x=0 側を向く) ===
      _B('house', -155, 38), _B('house', -120, 42),             // Cell A 家族住宅 2 軒
      _B('shed', -145, 72), _B('greenhouse', -115, 78),
      _B('townhouse', -50, 38),                                 // Cell B 大きな一戸建て
      _B('greenhouse', -20, 72), _B('shed', -75, 78),
      _B('house', 30, 40), _B('garage', 65, 42),                // Cell C 夫婦住宅 + 車庫
      _B('shed', 70, 78),
      _B('townhouse', 108, 40), _B('townhouse', 142, 42),       // Cell D タウンハウス連棟 (3→2 に)
      _B('shed', 118, 78), _B('greenhouse', 162, 78),

      // === 下段: 裏庭と郊外の一戸建て ===
      _B('house', -150, 132), _B('house', -115, 128),           // Cell E 家庭菜園家族
      _B('greenhouse', -155, 170), _B('shed', -120, 178),
      _B('house', -48, 132), _B('shed', -20, 170),              // Cell F 独居老人 (garage 撤去)
      _B('townhouse', 35, 130), _B('house', 70, 138),           // Cell G 小家族
      // (Cell G の garage/shed を撤去 → 町内小広場の入口スペース)
      _B('house', 115, 132), _B('greenhouse', 158, 138),        // Cell H 桜古木の家
      _B('greenhouse', 115, 178), _B('shed', 160, 175),
    ],
    furniture: [
      // ─── 軸 1: wood_fence / hedge リボン (x=±178 縦連続) ───
      _F('wood_fence', -178, 22), _F('wood_fence', 178, 22),
      _F('wood_fence', -178, 118), _F('wood_fence', 178, 118),
      _F('hedge', -178, 160), _F('hedge', 178, 160),

      // ─── 軸 2: facade ライン y=22 (全住宅の玄関側) ───
      _F('mailbox', -155, 22), _F('mailbox', -120, 22),         // Cell A
      _F('potted_plant', -140, 25), _F('bicycle', -100, 24),
      _F('mailbox', -50, 22), _F('potted_plant', -30, 25),      // Cell B (大邸宅)
      _F('flower_bed', -70, 22),
      _F('mailbox', 30, 22), _F('potted_plant', 20, 25),        // Cell C
      _F('mailbox', 108, 22), _F('mailbox', 142, 22),           // Cell D タウンハウス
      _F('potted_plant', 125, 25), _F('potted_plant', 160, 25),

      // ─── 軸 2: facade ライン y=118 (下段全住宅) ───
      _F('mailbox', -150, 118), _F('mailbox', -115, 118),       // Cell E
      _F('potted_plant', -130, 122),
      _F('mailbox', -48, 118), _F('potted_plant', -35, 122),    // Cell F
      _F('mailbox', 35, 118), _F('mailbox', 70, 118),           // Cell G
      _F('potted_plant', 50, 122), _F('bicycle', 15, 118),
      _F('mailbox', 115, 118), _F('potted_plant', 148, 122),    // Cell H

      // ─── 軸 3: 桜並木 (x=+125-155) + 下に fallen_leaves ───
      _F('sakura_tree', 125, 60),                               // ★ 上段桜 (見せ場)
      _F('sakura_tree', 155, 88),                               // 上段 2 本目
      _F('sakura_tree', 108, 150),                              // ★ 下段桜古木

      // ─── 軸 4: 側面・裏の生活感 (エアコン・物干し) ───
      _F('ac_unit', -148, 52), _F('ac_unit', -118, 55),         // Cell A 側面
      _F('laundry_pole', -130, 68),
      _F('ac_unit', -65, 52), _F('cat', -35, 65),               // ★ Cell B 縁側の猫
      _F('ac_unit', 40, 68), _F('car', 65, 55),                 // Cell C 車庫の車
      _F('bicycle', 145, 92),                                   // Cell D
      _F('ac_unit', -58, 148), _F('cat', -30, 158),             // ★ Cell F 2 匹目
      _F('laundry_balcony', -130, 148),                         // Cell E 物干し
      _F('flower_bed', -170, 145), _F('flower_planter_row', 65, 160),
      _F('ac_outdoor_cluster', 48, 148),                        // Cell G
      _F('flower_bed', 140, 152), _F('potted_plant', 175, 155), // Cell H
      _F('bench', 135, 150),                                    // 桜古木前のベンチ

      // ─── 軸 5: 電柱 + 電線 (奥層 x=±175 y=92/195) ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 86),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),

      // ─── ランドマーク: 町内小広場の入口 (C0 下端、C1 へ続く) ───
      _F('bench', 15, 182),                                     // 広場ベンチ 1
      _F('bench', 50, 182),                                     // 広場ベンチ 2
      _F('flower_bed', 82, 190),                                // 広場の花壇
      _F('flower_planter_row', -15, 190),                       // 広場のプランター列
      _F('sakura_tree', 32, 170),                               // 広場の象徴桜 (C1 境界の大木)

      // ─── 主要通り (x=0 avenue) の共通設備 ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('post_letter_box', 0, 22),                             // avenue 入口の郵便ポスト
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
    ],
    humans: [
      _H(-125, 32),                                             // 朝の玄関で見送る妻
      _H(40, 48),                                               // 通勤前の父
      _H(-145, 148),                                            // 家庭菜園の老人
      _H(0, 80),                                                // 主要通りの通勤者 (上段)
      _H(0, 155),                                               // 主要通りの通勤者 (下段)
      _H(32, 178),                                              // 町内小広場のベンチの老人
    ],
    grounds: [
      // ─── ベース (全幅): grass/grass — 住宅街の緑 ───
      _G('grass', 0, 46.5, 360, 93),
      _G('grass', 0, 153.5, 360, 93),

      // ─── 軸 2: stone_pavement 歩道 (x=-65, 2 段、C0-C2 連続) ───
      _G('stone_pavement', -65, 46.5, 24, 93),
      _G('stone_pavement', -65, 153.5, 24, 93),

      // ─── 軸 3: 桜下の fallen_leaves リボン (x=+125-155 縦連続) ───
      _G('fallen_leaves', 128, 68, 54, 38),                     // 上段桜 (見せ場+2 本目)
      _G('fallen_leaves', 115, 150, 50, 42),                    // 下段桜古木
      _G('fallen_leaves', 32, 178, 44, 34),                     // 広場の大桜下

      // ─── 軸 4: dirt 菜園帯 (x=-150 縦連続) ───
      _G('dirt', -150, 70, 50, 32),                             // Cell A 菜園
      _G('dirt', -150, 175, 64, 42),                            // Cell E 家庭菜園 (大)
      _G('dirt', 158, 178, 36, 28),                             // Cell H 温室前の畑

      // ─── 縁側のウッドデッキ (猫の居場所) ───
      _G('wood_deck', -30, 70, 28, 18),                         // Cell B 縁側 (1 匹目)
      _G('wood_deck', -30, 170, 28, 18),                        // Cell F 縁側 (2 匹目)

      // ─── 車庫の舗装 (1 箇所のみ、過剰な driveway 回避) ───
      _G('concrete', 65, 58, 30, 26),                           // Cell C 車庫

      // ─── 町内小広場の tile (C0 下端、C1 へ繋がる) ───
      _G('tile', 30, 190, 100, 20),

      // ─── avenue マーカー (中央通りの起点) ───
      _G('dirt', 0, 15, 60, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 1: 町内小広場 + 角のコンビニ + ランドロマット ──
  // ● C0 境界の小広場が上段に続く (ベンチ + 古桜)
  // ● 角のコンビニ (x=-45) とランドロマット (x=+35) が唯一の商業
  //   - C0 の 2 つめコンビニは撤去 → 純粋な住宅街に戻す
  // ● 下段は asphalt (コンビニ駐車場/マンション駐車) を base にして
  //   Act II (商店街) への気配を先取り
  { patternId: 's1_raw', raw: {
    buildings: [
      // === 上段: 住宅 + 商店 (facade が主要通り側) ===
      _B('house', -155, 38), _B('house', -120, 42),             // Cell A 住宅
      _B('shed', -148, 72), _B('greenhouse', -115, 78),
      _B('convenience', -45, 38),                               // ★ Cell B 角のコンビニ
      _B('garage', -15, 75),                                    // 搬入用 (shed は撤去)
      _B('laundromat', 35, 38),                                 // Cell C ランドロマット
      _B('house', 68, 42), _B('shed', 38, 78),
      _B('house', 115, 40), _B('townhouse', 148, 42),           // Cell D 住宅
      _B('greenhouse', 170, 75), _B('shed', 118, 78),

      // === 下段: マンション + 純住宅 (2 つめコンビニ撤去) ===
      _B('mansion', -130, 132), _B('house', -170, 138),         // Cell E 若夫婦
      _B('garage', -148, 175), _B('shed', -110, 178),
      _B('house', -48, 132),                                    // Cell F 独居老人
      _B('greenhouse', -20, 165), _B('shed', -72, 175),
      _B('townhouse', 28, 130), _B('house', 65, 138),           // Cell G 純住宅 (コンビニ撤去)
      _B('shed', 30, 175),
      _B('townhouse', 108, 132), _B('house', 148, 136),         // Cell H 住宅連
      _B('garage', 115, 175), _B('shed', 160, 178),
    ],
    furniture: [
      // ─── 軸 1: wood_fence / hedge リボン (x=±178) ───
      _F('wood_fence', -178, 22), _F('wood_fence', 178, 22),
      _F('wood_fence', -178, 118), _F('wood_fence', 178, 118),
      _F('hedge', -178, 160), _F('hedge', 178, 160),

      // ★★ Act I シグネチャ: カラフル児童公園 (町内小広場を遊具で彩る) ★★
      _F('play_structure', 40, 20),                             // 中央の複合遊具 (赤/青/黄)
      _F('swing_set', -10, 12),                                 // 左のブランコ
      _F('slide', 85, 15),                                      // 右のすべり台
      _F('sandbox', 110, 22),                                   // 右端の砂場
      _F('sakura_tree', 140, 10),                               // 公園奥の桜
      _F('bench', 0, 32),                                       // 保護者ベンチ
      _F('bench', 80, 32),                                      // 保護者ベンチ
      _F('flower_planter_row', -28, 5),                         // 公園入口プランター
      _F('flower_bed', 155, 22),                                // 奥の花壇
      _F('street_lamp', -35, 15), _F('street_lamp', 125, 8),    // 公園街灯

      // ─── 軸 2: facade ライン y=22 (住宅と商店の混合) ───
      _F('mailbox', -155, 22), _F('mailbox', -120, 22),         // Cell A 住宅
      _F('potted_plant', -137, 25),
      _F('a_frame_sign', -62, 22),                              // Cell B コンビニ前
      _F('kerbside_vending_pair', -30, 22),                     // 歩道の自販機
      _F('bicycle_row', -45, 55),                               // コンビニ前駐輪
      _F('a_frame_sign', 115, 22),                              // Cell C ランドロマット前 (x=35 は広場の光束の陰に入る)
      _F('potted_plant', 148, 25),
      _F('mailbox', 148, 22),                                   // Cell D 住宅

      // ─── 軸 2: facade ライン y=118 (下段全住宅) ───
      _F('mailbox', -170, 118), _F('mailbox', -130, 118),       // Cell E マンション
      _F('potted_plant', -150, 122),
      _F('mailbox', -48, 118), _F('potted_plant', -35, 122),    // Cell F
      _F('bonsai', -60, 140),                                   // ★ 盆栽 (老人の趣味)
      _F('mailbox', 28, 118), _F('mailbox', 65, 118),           // Cell G 純住宅
      _F('potted_plant', 45, 122),
      _F('mailbox', 108, 118), _F('mailbox', 148, 118),         // Cell H
      _F('potted_plant', 128, 122),

      // ─── 軸 3: 桜並木 (x=+125-155) 連続 ───
      _F('sakura_tree', 125, 65),                               // 上段桜 (C0 境界と繋がる)
      _F('sakura_tree', 155, 90),                               // 上段桜 2 本目
      _F('sakura_tree', 130, 155),                              // 下段桜

      // ─── 軸 4: 側面・裏の生活感 ───
      _F('ac_unit', -148, 52), _F('laundry_pole', -130, 62),    // Cell A
      _F('dumpster', -78, 70), _F('milk_crate_stack', -68, 80), // Cell B コンビニ裏
      _F('ac_outdoor_cluster', -30, 52), _F('cable_junction_box', -65, 88),
      _F('laundry_pole', 42, 62), _F('laundry_balcony', 28, 65),// Cell C ランドロマット
      _F('ac_outdoor_cluster', 55, 62),
      _F('ac_unit', 155, 65), _F('cat', 170, 62),               // ★ Cell D 猫
      _F('bicycle', 115, 92),
      _F('ac_unit', -148, 148), _F('car', -150, 158),           // Cell E マンション
      _F('bicycle_row', -115, 150), _F('laundry_balcony', -130, 152),
      _F('potted_plant', -75, 150),                             // Cell F 老人宅
      _F('car', 35, 168),                                       // Cell G 駐車
      _F('ac_unit', 65, 150), _F('flower_planter_row', 130, 160),// Cell G-H
      _F('bicycle', 155, 150),                                  // Cell H

      // ─── 軸 5: 電柱 + 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 86),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),

      // ─── 主要通り (x=0) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('traffic_light', 0, 92),                               // コンビニ近くの信号
      _F('manhole_cover', -15, 100), _F('manhole_cover', 45, 100),
    ],
    humans: [
      _H(-3, 32),                                               // ベンチの保護者
      _H(82, 32),                                               // ベンチの保護者
      _H(50, 27),                                               // 複合遊具で遊ぶ子
      _H(-10, 18),                                              // ブランコの子
      _H(110, 22),                                              // 砂場の子
      _H(-55, 52),                                              // コンビニに向かう通勤者
      _H(-35, 52),                                              // コンビニ前で立ち話
      _H(30, 52),                                               // ランドロマット客
      _H(-130, 148),                                            // マンション前
      _H(0, 80),                                                // 主要通り歩行者 (上段)
      _H(0, 158),                                               // 主要通り歩行者 (下段)
    ],
    grounds: [
      // ─── ベース: 上段 grass / 下段 asphalt (コンビニ駐車帯) ───
      _G('grass', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),

      // ─── 軸 2: stone_pavement 歩道 (x=-65 連続) ───
      _G('stone_pavement', -65, 46.5, 24, 93),
      _G('stone_pavement', -65, 153.5, 24, 93),

      // ─── 町内小広場 tile (C0 から繋がる、児童公園ベース) ───
      _G('tile', 40, 18, 140, 36),                              // 公園の敷石 (拡幅)
      _G('dirt', 110, 22, 18, 12),                              // 砂場エリアの土台

      // ─── 軸 3: 桜下の fallen_leaves リボン ───
      _G('fallen_leaves', 128, 72, 50, 36),                     // 上段桜下
      _G('fallen_leaves', 130, 158, 48, 36),                    // 下段桜下

      // ─── 角のコンビニ・ランドロマット前舗装 ───
      _G('concrete', -45, 60, 44, 32),                          // コンビニ前
      _G('tile', 38, 58, 30, 26),                               // ランドロマット前
      _G('concrete', -15, 78, 32, 22),                          // コンビニ搬入ガレージ

      // ─── 軸 4: dirt 菜園帯 (x=-150 連続) ───
      _G('dirt', -140, 72, 50, 32),                             // Cell A 住宅裏
      _G('dirt', 168, 78, 32, 26),                              // Cell D 温室前
      _G('dirt', 168, 180, 30, 26),                             // Cell H 温室の裏

      // ─── 下段のマンション + 老人宅の舗装/緑 ───
      _G('concrete', -148, 175, 50, 40),                        // マンション駐車場
      _G('tile', -130, 135, 36, 28),                            // マンション玄関
      _G('wood_deck', -48, 170, 26, 18),                        // Cell F 老人縁側 (盆栽の下)
      _G('grass', 35, 170, 50, 32),                             // Cell G 住宅の裏庭 (asphalt 内の緑地)

      // ─── avenue マーカー ───
      _G('dirt', 0, 15, 60, 25),
      _G('grass', 0, 185, 60, 25),                              // 下端は grass (次の chunk 2 の住宅庭へ繋がる)
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 2: 保育園 + 診療所 + 郵便局 (Act I→II 橋渡し) ──
  // ● 公共施設が主要通り沿いに並び、Act II (商店街) へ continuity
  //   - 保育園 (x=-45) → 診療所 (x=+40) → 郵便局 (x=+125) の 3 施設が y=40 一列
  //   - これが Act II の商店 facade の先取りになる
  // ● 桜並木の終端 (x=+155 y=88 で Act I 最後の 1 本)
  // ● 歩道橋は通り沿い全体の公共インフラとして残す
  { patternId: 's1_raw', raw: {
    buildings: [
      // === 上段: 公共施設 3 連 + 住宅 ===
      _B('house', -155, 38), _B('house', -120, 42),             // Cell A 園児の家
      _B('shed', -148, 72), _B('greenhouse', -115, 78),
      _B('daycare', -45, 40),                                   // ★ Cell B 保育園
      _B('shed', -18, 78),                                      // 園具倉庫
      _B('clinic', 40, 40),                                     // ★ Cell C 小児科診療所
      _B('shed', 75, 78),
      _B('post_office', 125, 40),                               // ★ Cell D 郵便局
      _B('house', 168, 42), _B('greenhouse', 115, 78),

      // === 下段: 分院 + 住宅 + 銀行支店 ===
      _B('clinic', -145, 130),                                  // Cell E 分院
      _B('house', -105, 140), _B('garage', -150, 178),
      _B('house', -48, 132), _B('townhouse', -18, 128),         // Cell F 住宅
      _B('shed', -70, 175), _B('greenhouse', -20, 178),
      _B('bank', 45, 128),                                      // Cell G 小さな銀行支店
      _B('house', 78, 136), _B('shed', 30, 178),
      _B('house', 115, 132), _B('house', 148, 138),             // Cell H 住宅
      _B('garage', 170, 178), _B('shed', 118, 175),
    ],
    furniture: [
      // ─── 軸 1: wood_fence / hedge リボン ───
      _F('wood_fence', -178, 22), _F('wood_fence', 178, 22),
      _F('wood_fence', -178, 118), _F('wood_fence', 178, 118),
      _F('hedge', -178, 160), _F('hedge', 178, 160),

      // ─── 軸 2: facade ライン y=22 (住宅 + 公共施設の正面を揃える) ───
      _F('mailbox', -155, 22), _F('mailbox', -120, 22),         // Cell A 住宅
      _F('potted_plant', -138, 25),
      _F('flag_pole', -45, 22), _F('sign_board', -65, 22),      // Cell B 保育園
      _F('flower_planter_row', -20, 22),
      _F('sign_board', 20, 22), _F('sign_board', 62, 22),       // Cell C 診療所看板
      _F('potted_plant', 22, 28), _F('potted_plant', 58, 28),
      _F('post_box', 105, 22), _F('atm', 145, 22),              // Cell D 郵便局
      _F('sign_board', 125, 22), _F('potted_plant', 168, 25),
      _F('mailbox', 168, 22),                                   // Cell D 右端住宅

      // ─── 軸 2: facade ライン y=118 (下段公共 + 住宅) ───
      _F('sign_board', -165, 118), _F('potted_plant', -175, 122),// Cell E 分院
      _F('mailbox', -105, 118), _F('potted_plant', -125, 122),
      _F('mailbox', -48, 118), _F('mailbox', -18, 118),         // Cell F 住宅
      _F('potted_plant', -35, 122),
      _F('atm', 28, 118), _F('sign_board', 45, 118),            // Cell G 銀行
      _F('flower_bed', 78, 118),
      _F('mailbox', 115, 118), _F('mailbox', 148, 118),         // Cell H 住宅
      _F('potted_plant', 130, 122),

      // ─── 軸 3: 桜並木 終端 (Act I 最後の 2 本) ───
      _F('sakura_tree', 155, 88),                               // ★ Act I 桜並木 終端
      _F('sakura_tree', 35, 172),                               // 下段の Act I 桜最終株

      // ─── 軸 4: 側面・裏の生活感 (公共は bicycle_rack / bench が多め) ───
      _F('ac_unit', -148, 52), _F('laundry_pole', -130, 62),    // Cell A
      _F('bicycle_rack', -72, 62), _F('flower_bed', -60, 78),   // Cell B 保育園 (送迎用駐輪)
      _F('bench', -25, 65),
      _F('bicycle_rack', 58, 62), _F('bench', 50, 78),          // Cell C 診療所
      _F('ac_outdoor_cluster', 72, 52),
      _F('flag_pole', 148, 62),                                 // Cell D 郵便局
      _F('bicycle_rack', -115, 148), _F('ac_unit', -160, 148),  // Cell E 分院
      _F('flower_bed', -125, 162),
      _F('ac_unit', -58, 148), _F('laundry_balcony', -28, 152), // Cell F
      _F('cat', -70, 152),                                      // ★ Cell F 猫
      _F('bench', 62, 148), _F('ac_unit', 65, 148),             // Cell G 銀行
      _F('flower_planter_row', 155, 148),                       // Cell H
      _F('car', 168, 158),

      // ─── 軸 5: 電柱 + 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 86),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),

      // ─── 主要通り + 公共インフラ (歩道橋・信号・マンホール) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('street_lamp', -90, 193), _F('street_lamp', 90, 193),
      _F('traffic_light', -90, 92),                             // 保育園前の信号
      _F('guardrail_short', -30, 100), _F('guardrail_short', 30, 100),
      _F('pedestrian_bridge', 0, 145),                          // 小児科近くの歩道橋
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
    ],
    humans: [
      _H(-45, 55), _H(-60, 68),                                 // 保育園の送迎親子 2 組
      _H(40, 62),                                               // 診療所の患者
      _H(125, 55),                                              // 郵便局の客
      _H(-145, 148),                                            // 分院の前
      _H(45, 138),                                              // 銀行の客
      _H(0, 85),                                                // 主要通り歩行者
      _H(0, 160),                                               // 主要通り歩行者
    ],
    grounds: [
      // ─── ベース: 上段 grass / 下段 concrete (Act II へ橋渡し) ───
      _G('grass', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),

      // ─── 軸 2: stone_pavement 歩道 (x=-65 連続、Act I 最後) ───
      _G('stone_pavement', -65, 46.5, 24, 93),
      _G('stone_pavement', -65, 153.5, 24, 93),

      // ─── 公共施設前の tile (保育園/診療所/郵便局) — Act II 店舗 tile の先取り ───
      _G('tile', -45, 55, 55, 50),                              // 保育園の園庭
      _G('tile', 40, 55, 42, 50),                               // 診療所前
      _G('tile', 125, 52, 42, 42),                              // 郵便局前
      _G('tile', -145, 135, 42, 40),                            // 分院前
      _G('tile', 45, 128, 38, 28),                              // 銀行前

      // ─── 軸 3: 桜下の fallen_leaves (Act I 終端) ───
      _G('fallen_leaves', 155, 90, 32, 18),
      _G('fallen_leaves', 35, 172, 32, 22),

      // ─── 軸 4: dirt 菜園帯 (Cell A 最後の畑) ───
      _G('dirt', -165, 72, 30, 28),

      // ─── 緑地: 下段 concrete 内の緑 (小広場的) ───
      _G('grass', -110, 172, 32, 28),                           // バス停脇の緑地

      // ─── avenue マーカー ───
      _G('dirt', 0, 15, 60, 25),
      _G('grass', 0, 188, 60, 20),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act II: 生活と小商店 (Chunks 3-5) ═══════════════════════════════
  // 住宅街からじわじわ小商店が増え、子連れ・買い物客の気配が混ざる。
  // 桜並木は Chunk 5 で終わり、Chunk 6 からは街路樹 (tree) へ切替。

  // ── Chunk 3: 住宅と小商店の混合 ──
  // 中左: 家族住宅 + 裏庭 (Chunk 2 から連続)
  // 中右: コンビニ + クリーニング (生活の要)
  // 下段: パン屋 + 本屋 (朝の買い物) + 住宅
  // 象徴: 猫 1 匹、桜並木継続
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 家族住宅 + 物置 ===
      _B('house', -155, 38), _B('townhouse', -125, 42),
      _B('shed', -150, 72),
      _B('greenhouse', -120, 78),
      // === Cell B (中左上): コンビニ (角地) + 住宅 ===
      _B('convenience', -45, 42),                            // 生活の要
      _B('house', -15, 40),
      _B('shed', -70, 78),
      // === Cell C (中右上): クリーニング + 家族住宅 ===
      _B('laundromat', 35, 40),                              // 朝の洗濯
      _B('house', 68, 42),
      _B('shed', 30, 78),
      // === Cell D (右上): 住宅 + 薬局 ===
      _B('house', 115, 40),
      _B('pharmacy', 150, 40),
      _B('greenhouse', 120, 78),

      // === Cell E (左下): 住宅 + ガレージ (Chunk 2 分院の流れ) ===
      _B('house', -155, 130), _B('townhouse', -125, 132),
      _B('garage', -150, 178),
      _B('shed', -120, 175),
      // === Cell F (中左下): パン屋 + 本屋 (小商店の芽) ===
      _B('bakery', -55, 130),
      _B('bookstore', -20, 132),
      _B('townhouse', -55, 178),
      // === Cell G (中右下): 住宅 + 小 cafe ===
      _B('cafe', 35, 130),
      _B('house', 65, 135),
      _B('shed', 28, 178),
      // === Cell H (右下): 住宅 3 連 + 花屋 ===
      _B('florist', 115, 130),
      _B('house', 150, 135),
      _B('townhouse', 178, 132),
      _B('garage', 168, 178),
    ],
    furniture: [
      // === Cell A: 家族住宅の朝 ===
      _F('mailbox', -155, 22), _F('potted_plant', -125, 24),
      _F('wood_fence', -178, 22),
      _F('ac_unit', -155, 58),
      _F('laundry_pole', -135, 62),
      _F('power_pole', -175, 92),
      // === Cell B: コンビニ前 (朝の活気) ===
      _F('a_frame_sign', -65, 22), _F('sign_board', -30, 22),
      _F('vending', -72, 58),                                // コンビニ前の自販機
      _F('bicycle_rack', -30, 58),                           // 学生の自転車
      _F('potted_plant', -45, 26),
      _F('dumpster', -78, 90),                               // 店裏のごみ置き場
      _F('milk_crate_stack', -65, 90),
      _F('power_pole', -35, 92),
      // === Cell C: クリーニング + 住宅 ===
      _F('a_frame_sign', 22, 22),
      _F('laundry_pole', 42, 58),
      _F('laundry_balcony', 28, 62),                         // 物干し
      _F('ac_outdoor_cluster', 55, 62),
      _F('mailbox', 68, 22), _F('potted_plant', 78, 26),
      // === Cell D: 薬局 + 家族住宅 ===
      _F('sign_board', 138, 22),                             // 薬局の看板
      _F('bicycle_rack', 145, 58),
      _F('potted_plant', 112, 24), _F('mailbox', 115, 22),
      _F('sakura_tree', 168, 88),                            // ★ 桜並木 (Chunk 4 に続く)
      _F('ac_unit', 155, 62),

      // === Cell E: 住宅 + ガレージ ===
      _F('mailbox', -155, 112), _F('potted_plant', -125, 115),
      _F('wood_fence', -178, 112),
      _F('car', -150, 165),                                  // 駐車車両
      _F('ac_unit', -128, 148),
      _F('power_pole', -178, 195),
      // === Cell F: パン屋 + 本屋前 (朝の買い物客) ===
      _F('a_frame_sign', -70, 112),
      _F('shop_awning', -55, 120),
      _F('noren', -55, 116),
      _F('parasol', -20, 120),
      _F('bicycle_rack', -35, 152),
      _F('potted_plant', -75, 115), _F('potted_plant', -8, 115),
      _F('cat', -80, 162),                                   // ★ 象徴的猫 (店裏にたたずむ)
      // === Cell G: 小 cafe ===
      _F('parasol', 35, 112),                                // カフェのパラソル
      _F('shop_awning', 35, 118),
      _F('chouchin', 48, 112),
      _F('potted_plant', 20, 115),
      _F('bench', 52, 150),                                  // 店前ベンチ
      _F('ac_unit', 58, 148),
      _F('sakura_tree', 82, 152),                            // ★ 桜並木
      // === Cell H: 住宅 + 花屋 ===
      _F('flower_planter_row', 115, 112),                    // 花屋前のプランター
      _F('a_frame_sign', 128, 112),
      _F('mailbox', 150, 112), _F('mailbox', 178, 115),
      _F('potted_plant', 140, 115),
      _F('laundry_pole', 160, 150),
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) + 生活の電線 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
    ],
    humans: [
      _H(-45, 55), _H(-30, 62),                              // コンビニ前の通勤者
      _H(-55, 150), _H(-20, 150),                            // パン屋 + 本屋前の客
      _H(35, 150), _H(50, 152),                              // cafe 客
      _H(120, 55),                                           // 薬局客
      _H(0, 60), _H(0, 160),                                 // 主要通りの歩行者
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -45, 55, 30, 45),                           // コンビニ前の舗装
      _G('tile', 35, 55, 25, 40),                            // クリーニング前
      _G('tile', -55, 135, 30, 40),                          // パン屋前
      _G('tile', 35, 135, 25, 40),                           // カフェ前
      _G('concrete', 150, 135, 50, 40),                      // 花屋+住宅前
      _G('dirt', 0, 15, 60, 25), _G('grass', 0, 188, 60, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 4: 家族の買い物道 ──
  // 中左: 花屋 + 本屋 + 住宅 (Chunk 3 から連続した小商店流れ)
  // 中右: スーパー (生活の拠点) — ただし supermarket 1 棟のみ、大型広場は作らない
  // 上下端: 住宅 + 裏庭 (日常)
  // 象徴: 桜並木最終盤、子連れの買い物客
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 住宅 + パン屋 (Chunk 3 パン屋の続き) ===
      _B('house', -155, 38),
      _B('bakery', -125, 42),
      _B('shed', -148, 75),
      _B('greenhouse', -120, 78),
      // === Cell B (中左上): 本屋 + 住宅 ===
      _B('bookstore', -55, 42),
      _B('townhouse', -22, 40),
      _B('shed', -60, 78),
      // === Cell C (中右上): スーパー (Act II 地域拠点、landmark でなく普通サイズ) ===
      _B('supermarket', 50, 42),                             // スーパー 1 棟 (地域の買い物拠点)
      // === Cell D (右上): 住宅 + 薬局 (Chunk 3 と対) ===
      _B('house', 118, 40),
      _B('pharmacy', 152, 42),
      _B('shed', 118, 78),

      // === Cell E (左下): 住宅 3 軒 + 共用庭 ===
      _B('house', -158, 130), _B('house', -128, 132),
      _B('townhouse', -100, 138),
      _B('garage', -152, 180),
      // === Cell F (中左下): 小 cafe + 花屋 ===
      _B('cafe', -55, 130),
      _B('florist', -22, 135),
      _B('shed', -55, 180),
      // === Cell G (中右下): クリーニング分店 + 住宅 ===
      _B('laundromat', 40, 132),
      _B('house', 72, 138),
      _B('shed', 35, 178),
      // === Cell H (右下): 住宅 + ガレージ + 温室 ===
      _B('house', 118, 132), _B('townhouse', 148, 135),
      _B('greenhouse', 175, 138),
      _B('garage', 120, 180),
    ],
    furniture: [
      // === Cell A: パン屋前 + 家族住宅 ===
      _F('a_frame_sign', -138, 22),
      _F('shop_awning', -125, 26),
      _F('mailbox', -155, 22), _F('potted_plant', -168, 24),
      _F('ac_unit', -148, 60),
      _F('power_pole', -178, 92),
      // === Cell B: 本屋前 + 住宅 ===
      _F('sign_board', -70, 22),                             // 本屋の看板
      _F('bicycle_rack', -38, 62),                           // 常連の自転車
      _F('potted_plant', -55, 28),
      _F('mailbox', -22, 22),
      _F('ac_outdoor_cluster', -75, 62),
      // === Cell C: スーパー前 (買い物客の溜まり場) ===
      _F('a_frame_sign', 30, 22),
      _F('sign_board', 72, 22),                              // 店名看板
      _F('bicycle_row', 25, 62),                             // 買い物客の自転車列
      _F('flower_planter_row', 70, 26),                      // 店先プランター列
      _F('dumpster', 30, 90),                                // 店裏のごみ置き場
      _F('milk_crate_stack', 60, 90),
      _F('ac_outdoor_cluster', 75, 62),
      // === Cell D: 薬局 + 住宅 ===
      _F('sign_board', 140, 22),
      _F('bicycle_rack', 158, 58),
      _F('sakura_tree', 175, 60),                            // ★ 桜並木
      _F('mailbox', 118, 22), _F('potted_plant', 125, 26),
      _F('ac_unit', 152, 62),

      // === Cell E: 住宅 3 軒の共用庭 ===
      _F('mailbox', -158, 112), _F('mailbox', -128, 112), _F('mailbox', -100, 118),
      _F('potted_plant', -140, 115), _F('potted_plant', -112, 115),
      _F('laundry_balcony', -128, 150),                      // 物干し
      _F('ac_unit', -158, 150),
      _F('car', -148, 168),                                  // 駐車車両
      _F('power_pole', -178, 195),
      // === Cell F: カフェ + 花屋前 ===
      _F('parasol', -55, 112),
      _F('shop_awning', -55, 118),
      _F('flower_bed', -35, 115),
      _F('flower_planter_row', -15, 115),
      _F('bench', -70, 152),                                 // 常連の待ちベンチ
      _F('bicycle_rack', -30, 152),
      _F('sakura_tree', -85, 152),                           // ★ 桜並木
      _F('cat', -10, 168),                                   // ★ 象徴的猫 (花の影)
      // === Cell G: クリーニング + 銭湯 (★★ Act II シグネチャ) ===
      _F('a_frame_sign', 28, 112),
      _F('laundry_balcony', 42, 150),                        // 物干しバルコニー
      _F('laundry_pole', 58, 150),
      _F('mailbox', 72, 112), _F('potted_plant', 78, 115),
      _F('ac_outdoor_cluster', 48, 152),
      _F('bathhouse_chimney', 92, 162),                      // ★★ 銭湯の煙突 (Act II のランドマーク)
      _F('noren', 92, 148),                                  // 銭湯ののれん
      _F('sign_board', 88, 176),                             // 「ゆ」看板
      // === Cell H: 住宅 + 温室 + 駐車 ===
      _F('mailbox', 118, 112), _F('mailbox', 148, 115),
      _F('potted_plant', 130, 115),
      _F('flower_bed', 175, 115),                            // 温室前の花壇
      _F('laundry_pole', 145, 152),
      _F('car', 120, 168),                                   // 駐車
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('bus_stop', 0, 92),                                 // 主要通りのバス停
    ],
    humans: [
      _H(-125, 55), _H(-125, 62),                            // パン屋の親子
      _H(-55, 55),                                           // 本屋の学生
      _H(45, 55), _H(55, 62), _H(70, 58), _H(35, 68),        // スーパーの買い物客 4 人
      _H(-55, 150), _H(-70, 155),                            // カフェの客
      _H(40, 150),                                           // クリーニングの客
      _H(88, 172),                                           // 銭湯帰りの客
      _H(92, 182),                                           // 銭湯待ちの客
      _H(0, 60), _H(0, 160),                                 // 主要通り
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -125, 55, 30, 40),                          // パン屋前
      _G('tile', -55, 55, 30, 45),                           // 本屋前
      _G('tile', 50, 55, 50, 50),                            // スーパー前 (広め)
      _G('tile', 152, 55, 25, 42),                           // 薬局前
      _G('tile', -55, 135, 30, 40),                          // カフェ前
      _G('tile', 40, 135, 25, 40),                           // クリーニング前
      _G('tile', 92, 165, 24, 32),                           // 銭湯前
      _G('dirt', 0, 15, 60, 25), _G('concrete', 0, 188, 60, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 5: Act II → Act III 橋渡し (小さな地域中心) ──
  // 中左: 銀行 + 郵便局 (地域公共の核) — 派手な広場にはしない
  // 中右: 町内会館 (city_hall を使わず post_office/bank 密度で表現) + カフェ
  // 桜並木は Chunk 5 で終端。Chunk 6 からは tree に切替
  // Act III (ローカル商店街) へ向けて商店密度がじわじわ上がる
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 住宅 + 小 cafe ===
      _B('house', -155, 38),
      _B('cafe', -125, 42),
      _B('shed', -150, 75),
      // === Cell B (中左上): 郵便局 (地域拠点) ===
      _B('post_office', -50, 42),                            // 地域の郵便局
      _B('townhouse', -18, 40),
      _B('shed', -75, 78),
      // === Cell C (中右上): 銀行 + 住宅 ===
      _B('bank', 45, 42),                                    // 地域の銀行支店
      _B('house', 80, 42),
      // === Cell D (右上): 住宅 + パン屋 ===
      _B('house', 118, 40),
      _B('bakery', 150, 42),
      _B('greenhouse', 118, 78),

      // === Cell E (左下): 住宅 + 花屋 ===
      _B('house', -158, 130),
      _B('florist', -130, 132),
      _B('garage', -152, 180),
      _B('shed', -125, 178),
      // === Cell F (中左下): 本屋 + 小 cafe + 薬局 ===
      _B('bookstore', -55, 130),
      _B('cafe', -20, 132),
      _B('pharmacy', -55, 178),
      // === Cell G (中右下): クリーニング + 住宅 ===
      _B('laundromat', 40, 132),
      _B('townhouse', 72, 135),
      _B('shed', 35, 178),
      // === Cell H (右下): 住宅 + 温室 + ガレージ ===
      _B('house', 118, 132), _B('townhouse', 148, 135),
      _B('greenhouse', 175, 138),
      _B('garage', 120, 180),
    ],
    furniture: [
      // === Cell A: 住宅 + カフェ前 ===
      _F('mailbox', -155, 22), _F('potted_plant', -168, 24),
      _F('parasol', -125, 22),
      _F('shop_awning', -125, 28),
      _F('bench', -110, 62),                                 // カフェ前ベンチ
      _F('ac_unit', -155, 60),
      _F('power_pole', -178, 92),
      // === Cell B: 郵便局前 ===
      _F('post_box', -65, 22),                               // ポスト
      _F('sign_board', -35, 22),
      _F('flag_pole', -50, 62),                              // 公共施設の国旗
      _F('bicycle_rack', -75, 62),
      _F('mailbox', -18, 22),
      _F('potted_plant', -8, 24),
      // === Cell C: 銀行 + 住宅 ===
      _F('atm', 28, 22),                                     // 銀行前の ATM
      _F('sign_board', 62, 22),
      _F('bench', 25, 62),                                   // 待ちベンチ
      _F('potted_plant', 78, 24),
      _F('mailbox', 80, 22),
      _F('ac_outdoor_cluster', 60, 62),
      // === Cell D: 住宅 + パン屋 ===
      _F('mailbox', 118, 22), _F('potted_plant', 125, 26),
      _F('a_frame_sign', 138, 22),
      _F('shop_awning', 150, 28),
      _F('sakura_tree', 170, 62),                            // ★ 桜並木 (Stage 1 最終桜)
      _F('ac_unit', 120, 60),

      // === Cell E: 住宅 + 花屋 ===
      _F('mailbox', -158, 112), _F('potted_plant', -168, 115),
      _F('flower_planter_row', -130, 112),
      _F('a_frame_sign', -115, 112),
      _F('flower_bed', -130, 165),
      _F('power_pole', -178, 195),
      // === Cell F: 本屋 + カフェ + 薬局 (小商店の集まり) ===
      _F('shop_awning', -55, 118),
      _F('sign_board', -68, 112),
      _F('parasol', -20, 115),
      _F('a_frame_sign', -5, 115),
      _F('bicycle_row', -35, 152),                           // 学生・買い物客の自転車
      _F('sign_board', -68, 168),                            // 薬局の看板
      _F('potted_plant', -30, 168),
      _F('sakura_tree', -10, 180),                           // ★ 桜並木 (Stage 1 最終桜、終端)
      _F('cat', -70, 195),                                   // ★ 象徴的猫
      // === Cell G: クリーニング + 住宅 ===
      _F('a_frame_sign', 28, 112),
      _F('laundry_balcony', 42, 152),                        // 物干し
      _F('laundry_pole', 58, 152),
      _F('mailbox', 72, 112), _F('potted_plant', 85, 115),
      _F('ac_outdoor_cluster', 50, 152),
      // === Cell H: 住宅 + 温室 ===
      _F('mailbox', 118, 112), _F('mailbox', 148, 115),
      _F('potted_plant', 130, 115),
      _F('flower_bed', 175, 115),
      _F('car', 120, 168),
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) + 公共のざわめき ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('bus_stop', -50, 92),                               // 郵便局前のバス停
      _F('newspaper_stand', 62, 92),                         // 銀行前の新聞
      _F('telephone_booth', -100, 92),                       // 公衆電話
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('traffic_light', -90, 92),                          // 主要通りの信号 (片側)
    ],
    humans: [
      _H(-115, 62),                                          // カフェ客
      _H(-50, 55), _H(-65, 62), _H(-35, 68),                 // 郵便局の客 3 人
      _H(28, 55), _H(62, 58),                                // 銀行の客
      _H(138, 55),                                           // パン屋の客
      _H(-130, 150),                                         // 花屋の客
      _H(-55, 150), _H(-20, 150), _H(-55, 192),              // 本屋+カフェ+薬局の客
      _H(40, 150),                                           // クリーニングの客
      _H(0, 60), _H(0, 160),                                 // 主要通り
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),                      // 公共ゾーン (concrete に切替: Act III への近接)
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -125, 55, 35, 45),                          // カフェ前
      _G('tile', -50, 55, 40, 45),                           // 郵便局前
      _G('tile', 45, 55, 40, 45),                            // 銀行前
      _G('tile', 150, 55, 28, 40),                           // パン屋前
      _G('tile', -130, 135, 30, 40),                         // 花屋前
      _G('tile', -55, 135, 60, 70),                          // 本屋+カフェ+薬局 小商店クラスタ
      _G('tile', 40, 135, 28, 40),                           // クリーニング前
      _G('concrete', 0, 15, 60, 25), _G('concrete', 0, 188, 60, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act III: ローカル商店街 (Chunks 6-8) ═══════════════════════════════
  // 下校の小学生と買い物客で最も賑やかな区画。街路樹 (tree) に切替。
  // 地域ランドマーク: 小学校 (Chunk 6) と地方の小駅舎 (Chunk 8) — 大型広場は置かない。

  // ── Chunk 6: 小学校 + 商店街の始まり ──
  // 中左: 小学校 ★ (Act III 地域ランドマーク) + 校庭フェンス
  // 中右〜下段: 下校路の小商店 (パン屋/本屋/薬局/花屋)
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 住宅 + ガレージ (商店街の裏) ===
      _B('house', -158, 38), _B('townhouse', -128, 40),
      _B('garage', -152, 75),
      // === Cell B (中左上): 小学校 ★ (Act III ランドマーク、セル中央) ===
      _B('school', -50, 45),                                 // ★ 小学校 (40x45)
      // === Cell C (中右上): 校舎隣の住宅 + 小 cafe (常連の老人) ===
      _B('house', 20, 40),
      _B('cafe', 55, 42),
      _B('shed', 20, 80),
      // === Cell D (右上): パン屋 + 文房具 (小商店) ===
      _B('bakery', 115, 42),
      _B('bookstore', 152, 45),
      _B('shed', 118, 80),

      // === Cell E (左下): 校庭フェンス + 住宅 ===
      _B('house', -158, 132), _B('townhouse', -128, 135),
      _B('shed', -155, 178),
      _B('greenhouse', -125, 180),
      // === Cell F (中左下): 本屋 + 薬局 (下校路の小店) ===
      _B('bookstore', -55, 130),
      _B('pharmacy', -20, 132),
      _B('cafe', -55, 180),
      // === Cell G (中右下): 花屋 + 小 cafe ===
      _B('florist', 35, 132),
      _B('cafe', 68, 135),
      _B('shed', 35, 180),
      // === Cell H (右下): 住宅 + ガレージ ===
      _B('townhouse', 115, 132), _B('house', 148, 135),
      _B('garage', 118, 180),
      _B('shed', 148, 180),
    ],
    furniture: [
      // === Cell A: 住宅の裏 (校舎に面した) ===
      _F('mailbox', -158, 22), _F('potted_plant', -128, 24),
      _F('wood_fence', -178, 22),                            // 校舎との境界フェンス
      _F('wood_fence', -178, 60),
      _F('ac_unit', -158, 60),
      _F('power_pole', -175, 92),
      // === Cell B: 小学校 (校庭 + ★★ Act III シグネチャ: ジャングルジム) ===
      _F('flag_pole', -72, 22),                              // 校門の国旗
      _F('sign_board', -30, 22),                             // 校名看板
      _F('jungle_gym', -70, 75),                             // ★★ ジャングルジム (校庭遊具)
      _F('bicycle_row', -28, 78),                            // 通学生の自転車列
      _F('flower_planter_row', -50, 22),                     // 校門前プランター
      _F('wood_fence', 0, 22), _F('wood_fence', 0, 60),      // 校庭フェンス
      // === Cell C: 小 cafe + 住宅 ===
      _F('parasol', 55, 22),
      _F('shop_awning', 55, 28),
      _F('bench', 40, 62),                                   // 常連の老人ベンチ
      _F('mailbox', 20, 22), _F('potted_plant', 30, 24),
      _F('cat', 68, 62),                                     // ★ 象徴的猫 (カフェ前の常連)
      // === Cell D: パン屋 + 本屋 ===
      _F('shop_awning', 115, 28),
      _F('a_frame_sign', 128, 22),
      _F('sign_board', 152, 22),
      _F('tree', 175, 60),                                   // ★ 街路樹 (桜並木から切替、Chunk 6 から開始)
      _F('potted_plant', 165, 22),
      _F('ac_outdoor_cluster', 155, 60),

      // === Cell E: 校庭裏のフェンス + 住宅 ===
      _F('wood_fence', -178, 115), _F('wood_fence', -178, 150),
      _F('mailbox', -158, 112), _F('potted_plant', -128, 115),
      _F('laundry_balcony', -128, 150),
      _F('flower_bed', -155, 168),
      _F('power_pole', -175, 195),
      // === Cell F: 本屋 + 薬局前 (下校の小学生) ===
      _F('shop_awning', -55, 118),
      _F('sign_board', -68, 112),
      _F('parasol', -20, 115),
      _F('a_frame_sign', -5, 115),
      _F('bicycle_row', -35, 152),                           // 下校の自転車
      _F('shop_awning', -55, 168),
      _F('potted_plant', -70, 168),
      _F('tree', -80, 152),                                  // ★ 街路樹
      // === Cell G: 花屋 + 小 cafe ===
      _F('flower_planter_row', 35, 112),
      _F('a_frame_sign', 20, 112),
      _F('parasol', 68, 115),
      _F('shop_awning', 68, 120),
      _F('bench', 52, 152),
      _F('tree', 82, 152),                                   // ★ 街路樹
      // === Cell H: 住宅 + ガレージ ===
      _F('mailbox', 115, 112), _F('mailbox', 148, 115),
      _F('potted_plant', 128, 115),
      _F('car', 118, 168),                                   // 駐車
      _F('ac_unit', 155, 150),
      _F('power_pole', 175, 195),
      // === 主要通り (x=0) 商店街の活気 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('street_lamp', -90, 195), _F('street_lamp', 90, 195),
      _F('traffic_light', 90, 92),                           // 学校前の信号 (片側のみ)
      _F('banner_pole', 0, 100),                             // 商店街のバナー柱
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('bicycle_rack', 0, 62),                             // 主要通りの駐輪場
    ],
    humans: [
      _H(-72, 52), _H(-40, 55), _H(-65, 62), _H(-20, 68),    // 小学校の下校生 4 人
      _H(55, 55), _H(40, 62),                                // カフェの常連
      _H(128, 55), _H(152, 55),                              // パン屋+本屋客
      _H(-55, 148), _H(-20, 148), _H(-35, 155),              // 本屋+薬局の下校生
      _H(35, 148), _H(68, 152),                              // 花屋+カフェ客
      _H(0, 60), _H(0, 160),                                 // 主要通り
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -50, 55, 60, 50),                           // 小学校の校庭 (大きめ)
      _G('tile', 55, 55, 30, 45),                            // カフェ前
      _G('tile', 115, 55, 30, 45), _G('tile', 152, 55, 25, 45),
      _G('tile', -55, 135, 30, 45),                          // 本屋前
      _G('tile', -20, 135, 25, 45),                          // 薬局前
      _G('tile', 35, 135, 30, 45),                           // 花屋前
      _G('tile', 68, 135, 22, 45),                           // カフェ前
      _G('tile', -55, 180, 30, 25),                          // カフェ (下段)
      _G('concrete', 0, 15, 120, 25), _G('concrete', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 7: 商店街の中心 ──
  // 昼下がりの買い物客で最も活気ある区画。小店が連続、路地に小 ramen/izakaya。
  // 象徴: 常連の自転車、街路樹、路地の猫
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 本屋 + 小 cafe ===
      _B('bookstore', -158, 42),
      _B('cafe', -125, 42),
      _B('shed', -155, 80),
      // === Cell B (中左上): パン屋 + 花屋 (商店街の芯) ===
      _B('bakery', -60, 42),
      _B('florist', -25, 42),
      _B('townhouse', -55, 80),
      // === Cell C (中右上): 薬局 + 文房具 (= bookstore) ===
      _B('pharmacy', 35, 42),
      _B('bookstore', 70, 45),
      _B('shed', 35, 80),
      // === Cell D (右上): 住宅 + クリーニング ===
      _B('laundromat', 115, 42),
      _B('house', 148, 42),
      _B('shed', 118, 80),

      // === Cell E (左下): 小 ramen + 住宅 (夕方の店) ===
      _B('ramen', -158, 130),
      _B('house', -128, 135),
      _B('shed', -155, 180),
      // === Cell F (中左下): 小 izakaya + cafe (夕方向け) ===
      _B('izakaya', -55, 132),
      _B('cafe', -20, 135),
      _B('townhouse', -55, 180),
      // === Cell G (中右下): 本屋 + パン屋 ===
      _B('bookstore', 35, 132),
      _B('bakery', 68, 135),
      _B('shed', 35, 180),
      // === Cell H (右下): 住宅 + ガレージ ===
      _B('house', 115, 132), _B('townhouse', 148, 135),
      _B('garage', 118, 180),
      _B('shed', 155, 180),
    ],
    furniture: [
      // === Cell A: 本屋 + カフェ ===
      _F('shop_awning', -158, 28),
      _F('sign_board', -172, 22),
      _F('parasol', -125, 22),
      _F('potted_plant', -140, 24),
      _F('bicycle_rack', -145, 62),
      _F('ac_outdoor_cluster', -155, 62),
      _F('power_pole', -178, 92),
      // === Cell B: パン屋 + 花屋 ===
      _F('a_frame_sign', -75, 22),
      _F('shop_awning', -60, 28),
      _F('flower_planter_row', -25, 22),
      _F('bench', -40, 62),                                  // 商店街の休憩ベンチ
      _F('tree', -90, 60),                                   // ★ 街路樹
      // === Cell C: 薬局 + 本屋 ===
      _F('sign_board', 22, 22),
      _F('shop_awning', 35, 28),
      _F('parasol', 70, 22),
      _F('bicycle_rack', 50, 62),
      _F('potted_plant', 88, 24),
      // === Cell D: クリーニング + 住宅 ===
      _F('a_frame_sign', 102, 22),
      _F('shop_awning', 115, 28),
      _F('laundry_balcony', 118, 60),
      _F('mailbox', 148, 22), _F('potted_plant', 158, 24),
      _F('tree', 90, 60),                                    // ★ 街路樹
      _F('ac_outdoor_cluster', 115, 62),

      // === Cell E: ラーメン屋 (夕方) + 住宅 ===
      _F('chouchin', -158, 112),
      _F('noren', -158, 118),
      _F('ac_outdoor_cluster', -140, 150),
      _F('mailbox', -128, 112), _F('potted_plant', -118, 115),
      _F('power_pole', -178, 195),
      // === Cell F: 小 izakaya + カフェ (商店街の路地) ===
      _F('chouchin', -55, 112),
      _F('noren', -55, 118),
      _F('parasol', -20, 115),
      _F('shop_awning', -20, 120),
      _F('bicycle_row', -35, 152),
      _F('cat', -75, 168),                                   // ★ 象徴的猫 (路地裏)
      _F('dumpster', -72, 180),                              // 店裏のごみ置き場
      _F('ac_outdoor_cluster', -55, 152),
      // === Cell G: 本屋 + パン屋 ===
      _F('sign_board', 22, 112),
      _F('shop_awning', 35, 118),
      _F('a_frame_sign', 55, 115),
      _F('shop_awning', 68, 120),
      _F('bicycle_rack', 50, 152),
      _F('potted_plant', 85, 115),
      _F('tree', 90, 152),                                   // ★ 街路樹
      // === Cell H: 住宅 + ガレージ ===
      _F('mailbox', 115, 112), _F('mailbox', 148, 115),
      _F('potted_plant', 128, 115),
      _F('car', 118, 168),
      _F('ac_unit', 148, 150),
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) 商店街の最大密度 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('banner_pole', -60, 100),
      _F('banner_pole', 60, 100),                            // 商店街バナー
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('vending', -90, 95),                                // 通りの自販機
      _F('newspaper_stand', 90, 95),
      _F('telephone_booth', 0, 92),                          // 主要通りの公衆電話
    ],
    humans: [
      _H(-158, 55), _H(-125, 55), _H(-140, 62),              // 本屋+カフェ客
      _H(-60, 55), _H(-25, 55), _H(-40, 62),                 // パン屋+花屋客
      _H(35, 55), _H(70, 55),                                // 薬局+本屋客
      _H(115, 55), _H(148, 55),                              // クリーニング+住宅
      _H(-55, 148), _H(-20, 148),                            // izakaya+カフェ夕方の客
      _H(35, 148), _H(68, 148),                              // 本屋+パン屋夕方の客
      _H(0, 60), _H(0, 160),                                 // 主要通り
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -158, 55, 28, 45),                          // 本屋前
      _G('tile', -125, 55, 25, 45),                          // カフェ前
      _G('tile', -60, 55, 30, 45),                           // パン屋前
      _G('tile', -25, 55, 25, 45),                           // 花屋前
      _G('tile', 35, 55, 30, 45),                            // 薬局前
      _G('tile', 70, 55, 25, 45),                            // 本屋前
      _G('tile', 115, 55, 30, 45),                           // クリーニング前
      _G('tile', -158, 148, 28, 42),                         // ラーメン前
      _G('tile', -55, 148, 28, 42),                          // 居酒屋前
      _G('tile', -20, 148, 25, 42),                          // カフェ前
      _G('tile', 35, 148, 25, 42),                           // 本屋前
      _G('tile', 68, 148, 25, 42),                           // パン屋前
      _G('concrete', 0, 15, 120, 25), _G('concrete', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 8: 地方の小さな駅 (Act III 終端、Act IV への橋渡し) ──
  // 中左: 地方の小駅舎 ★ (train_station 1 棟のみ、広場は小規模) — Stage 4 港湾駅とは別格
  // 中右: 駅前の小商店 + 郵便局 (地方駅前の生活感)
  // 下段: 住宅が増え始め、Act IV (街はずれ) へ繋がる
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 駅前住宅 + ガレージ ===
      _B('house', -158, 40), _B('townhouse', -128, 42),
      _B('garage', -152, 78),
      // === Cell B (中左上): 地方の小駅舎 ★ (Act III ランドマーク、train_station 50x36) ===
      _B('train_station', -40, 48),                          // ★ 地方の小さな駅 (セル中央)
      // === Cell C (中右上): 駅前コンビニ + 郵便局 ===
      _B('convenience', 50, 42),
      _B('post_office', 88, 42),
      // === Cell D (右上): 住宅 + 小 cafe ===
      _B('house', 145, 40),
      _B('cafe', 178, 42),
      _B('shed', 148, 78),

      // === Cell E (左下): 住宅 + 駐車場 (家族のマイカー) ===
      _B('house', -158, 130),
      _B('townhouse', -128, 135),
      _B('garage', -148, 180),
      _B('shed', -120, 180),
      // === Cell F (中左下): 小 cafe + 本屋 (駅前喫茶) ===
      _B('cafe', -55, 130),
      _B('bookstore', -20, 132),
      _B('townhouse', -55, 180),
      // === Cell G (中右下): パン屋 + 花屋 ===
      _B('bakery', 35, 132),
      _B('florist', 68, 135),
      _B('shed', 35, 180),
      // === Cell H (右下): 住宅 + ガレージ (街はずれへ) ===
      _B('house', 115, 132), _B('house', 148, 135),
      _B('garage', 118, 180),
      _B('shed', 155, 180),
    ],
    furniture: [
      // === Cell A: 駅前住宅 ===
      _F('mailbox', -158, 22), _F('potted_plant', -128, 24),
      _F('wood_fence', -178, 22),
      _F('ac_unit', -158, 60),
      _F('power_pole', -175, 92),
      // === Cell B: 地方駅 (駅前広場スモール) ===
      _F('sign_board', -72, 22),                             // 駅名看板
      _F('flag_pole', -10, 22),                              // 駅前の国旗
      _F('bench', -62, 78), _F('bench', -18, 78),            // 駅前ベンチ 2 脚
      _F('bicycle_row', -38, 78),                            // 通勤者の自転車
      _F('newspaper_stand', 0, 72),                          // 新聞スタンド
      _F('taxi_rank_sign', -72, 78),                         // タクシー乗り場 (1 つのみ)
      // === Cell C: コンビニ + 郵便局 ===
      _F('a_frame_sign', 38, 22),
      _F('sign_board', 72, 22),
      _F('post_box', 88, 22),                                // ポスト
      _F('atm', 105, 22),                                    // 郵便局 ATM
      _F('vending', 50, 62),                                 // コンビニ自販機
      _F('bicycle_rack', 88, 62),
      // === Cell D: 住宅 + 駅前喫茶 ===
      _F('mailbox', 145, 22), _F('potted_plant', 155, 24),
      _F('parasol', 178, 22),                                // カフェのパラソル
      _F('shop_awning', 178, 28),
      _F('tree', 170, 60),                                   // ★ 街路樹

      // === Cell E: 住宅 + 駐車 ===
      _F('mailbox', -158, 112), _F('potted_plant', -128, 115),
      _F('wood_fence', -178, 112),
      _F('laundry_balcony', -128, 150),
      _F('car', -148, 168),                                  // 駐車車両
      _F('power_pole', -175, 195),
      // === Cell F: カフェ + 本屋 ===
      _F('parasol', -55, 112),
      _F('shop_awning', -55, 118),
      _F('sign_board', -35, 112),
      _F('shop_awning', -20, 118),
      _F('bench', -40, 152),
      _F('bicycle_rack', -8, 152),
      _F('cat', -70, 168),                                   // ★ 象徴的猫 (店裏)
      // === Cell G: パン屋 + 花屋 ===
      _F('a_frame_sign', 22, 112),
      _F('shop_awning', 35, 118),
      _F('flower_planter_row', 68, 112),                     // 花屋前プランター
      _F('potted_plant', 82, 115),
      _F('tree', 85, 152),                                   // ★ 街路樹
      // === Cell H: 住宅 + ガレージ ===
      _F('mailbox', 115, 112), _F('mailbox', 148, 115),
      _F('potted_plant', 130, 115),
      _F('car', 118, 168),                                   // 駐車
      _F('ac_unit', 150, 150),
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) + 駅前の交通 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('bus_stop', -40, 92),                               // 駅前バス停
      _F('traffic_light', -90, 92),                          // 駅前信号
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
    ],
    humans: [
      _H(-40, 72), _H(-60, 78), _H(-18, 72), _H(0, 78),      // 駅前の通勤者 4 人 (Act III ピーク)
      _H(50, 55), _H(88, 55), _H(72, 62),                    // コンビニ+郵便局客
      _H(178, 55),                                           // カフェ客
      _H(-55, 148), _H(-20, 148),                            // カフェ+本屋客
      _H(35, 148), _H(68, 148),                              // パン屋+花屋客
      _H(0, 60), _H(0, 160),                                 // 主要通り
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('asphalt', -40, 72, 90, 40),                        // 駅前広場 (小規模)
      _G('stone_pavement', -10, 60, 30, 30),                 // 駅前石畳
      _G('tile', 50, 55, 30, 40),                            // コンビニ前
      _G('tile', 88, 55, 28, 40),                            // 郵便局前
      _G('tile', 178, 55, 20, 40),                           // カフェ前
      _G('tile', -55, 135, 30, 45),                          // カフェ前
      _G('tile', -20, 135, 25, 45),                          // 本屋前
      _G('tile', 35, 135, 30, 45),                           // パン屋前
      _G('tile', 68, 135, 22, 45),                           // 花屋前
      _G('concrete', 0, 15, 120, 25), _G('concrete', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act IV: 街はずれ (Chunks 9-11) ═══════════════════════════════════
  // 商店街を抜け、畑と倉庫が広がる郊外。Chunk 11 で踏切を越え Stage 2 (夜の街) へ。
  // 建物密度を下げ、dirt/puddle/pine_tree で寂寥感。象徴: 野良猫、古い電柱、駐車の軽トラ。

  // ── Chunk 9: 郊外の畑 + 農家 ──
  // 中左: 農家 (大きめの house) + 納屋 + 温室群
  // 中右: 畑 (ground=dirt 大きめ) + 温室
  // 神社ランドマークは Stage 3 (古都) に委ね、Stage 1 から完全撤去
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 農家 + 納屋 ===
      _B('house', -150, 42),                                 // 農家の母屋
      _B('shed', -122, 38),                                  // 納屋
      _B('greenhouse', -148, 78),                            // ビニールハウス
      // === Cell B (中左上): 畑の真ん中の小屋 + 温室 ===
      _B('shed', -65, 42),
      _B('greenhouse', -25, 45),                             // 中央の大温室
      // === Cell C (中右上): 別の農家 + 物置 ===
      _B('house', 50, 42),                                   // 2 軒目の農家
      _B('shed', 80, 40),
      _B('greenhouse', 55, 78),
      // === Cell D (右上): 畑 + 温室連続 ===
      _B('greenhouse', 120, 45),
      _B('greenhouse', 160, 45),
      _B('shed', 130, 78),

      // === Cell E (左下): 農家 + ガレージ + 駐車軽トラ ===
      _B('house', -152, 135),                                // 3 軒目
      _B('garage', -120, 130),                               // 農機具ガレージ
      _B('shed', -148, 180),
      // === Cell F (中左下): 畑のど真ん中 + 小屋 ===
      _B('shed', -50, 138),
      _B('greenhouse', -15, 140),
      _B('shed', -55, 180),
      // === Cell G (中右下): 小さな倉庫 + 畑 ===
      _B('garage', 40, 135),
      _B('greenhouse', 75, 140),
      _B('shed', 38, 180),
      // === Cell H (右下): 住宅 + 畑 ===
      _B('house', 118, 138),
      _B('greenhouse', 150, 138),
      _B('shed', 178, 180),
    ],
    furniture: [
      // === Cell A: 農家の庭 ===
      _F('mailbox', -150, 22), _F('potted_plant', -122, 24),
      _F('wood_fence', -178, 22),
      _F('ac_unit', -150, 62),
      _F('laundry_pole', -122, 62),
      _F('power_pole', -175, 92),
      _F('flower_bed', -180, 62),
      // === Cell B: 畑 (家具で耕作地表現) ===
      _F('flower_planter_row', -65, 22),                     // 苗プランター列
      _F('flower_bed', -40, 22),
      _F('flower_bed', -15, 78),                             // 畑の花壇
      _F('wood_fence', -75, 62), _F('wood_fence', -8, 62),   // 畑のフェンス
      // === Cell C: 2 軒目の農家 + ★★ Act IV シグネチャ: 穀物サイロ ===
      _F('mailbox', 50, 22), _F('potted_plant', 80, 24),
      _F('wood_fence', 30, 62),
      _F('ac_unit', 50, 62),
      _F('grain_silo', 90, 58),                              // ★★ 農家のサイロ (郊外のランドマーク)
      _F('flower_planter_row', 78, 62),
      // === Cell D: 温室群 + ビニールハウス ===
      _F('pine_tree', 180, 60),                              // ★ 街路樹 (郊外らしい pine)
      _F('flower_bed', 135, 22),
      _F('puddle_reflection', 145, 90),                      // 畑の水たまり
      _F('power_pole', 178, 92),

      // === Cell E: 農家 + 軽トラ ===
      _F('mailbox', -152, 112), _F('potted_plant', -140, 115),
      _F('car', -120, 168),                                  // 軽トラ (駐車)
      _F('flower_bed', -180, 155),
      _F('wood_fence', -178, 112),
      _F('power_pole', -175, 195),
      // === Cell F: 畑の大きな水たまり + 鳥よけ ===
      _F('puddle_reflection', -35, 100),                     // 畑の水たまり (大)
      _F('puddle_reflection', -65, 168),
      _F('flower_planter_row', -50, 112),                    // 苗プランター
      _F('flower_bed', -15, 170),
      _F('wood_fence', -75, 150), _F('wood_fence', -8, 150),
      _F('cat', -35, 195),                                   // ★ 野良猫 (畑の主)
      // === Cell G: 倉庫 + 農機具 + 温室 ===
      _F('wood_fence', 22, 150), _F('wood_fence', 58, 150),
      _F('flower_bed', 58, 112),
      _F('potted_plant', 40, 115),
      _F('cable_junction_box', 42, 155),                     // 温室のコントローラ
      // === Cell H: 住宅 + 温室 + 電柱 ===
      _F('mailbox', 118, 112), _F('potted_plant', 130, 115),
      _F('flower_bed', 178, 115),
      _F('pine_tree', 175, 155),                             // ★ 郊外の松
      _F('puddle_reflection', 155, 160),
      _F('power_pole', 178, 195),
      // === 主要通り (x=0) 過疎の静けさ ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', 0, 100),                           // 1 個だけ (郊外は舗装少ない)
      _F('guardrail_short', -30, 100), _F('guardrail_short', 30, 100),
    ],
    humans: [
      _H(-150, 55),                                          // 農家の住人
      _H(-50, 62),                                           // 畑仕事
      _H(50, 55),                                            // 2 軒目の農家
      _H(-152, 150),                                         // 3 軒目の住人
      _H(40, 152),                                           // 畑作業
      _H(118, 155),                                          // 住宅
      _H(0, 60), _H(0, 160),                                 // 主要通り (疎)
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93),
      _G('dirt', -50, 60, 80, 50),                           // 中央の大畑 (土)
      _G('dirt', 120, 60, 80, 50),                           // 右の畑
      _G('grass', 0, 153.5, 360, 93),
      _G('dirt', -50, 160, 80, 50),                          // 下段の畑
      _G('dirt', 40, 160, 80, 50),                           // 下段右の畑
      _G('dirt', 155, 168, 50, 40),
      _G('dirt', 0, 15, 120, 25), _G('dirt', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 10: 郊外倉庫 + 消防分署 ──
  // 中左: 大きな倉庫 ★ (Act IV のシンボル、Stage 4 港湾倉庫とは別格)
  // 中右: 消防分署 (fire_station) — 郊外に不可欠な施設
  // 下段: 警察派出所 + 古い住宅 + ガレージ連続 (寂寥)
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 住宅 + 納屋 ===
      _B('house', -152, 40),
      _B('shed', -120, 38),
      _B('greenhouse', -150, 78),
      // === Cell B (中左上): 大きな倉庫 ★ (Act IV ランドマーク、warehouse 40x36) ===
      _B('warehouse', -30, 48),                              // ★ 郊外の大きな倉庫
      // === Cell C (中右上): 消防分署 + 訓練場 ===
      _B('fire_station', 60, 48),                            // 郊外の消防分署
      _B('shed', 95, 38),
      // === Cell D (右上): 住宅 + 古いガレージ ===
      _B('house', 138, 40),
      _B('garage', 170, 40),
      _B('shed', 140, 78),

      // === Cell E (左下): 住宅 + ガレージ (古い住宅) ===
      _B('townhouse', -155, 130),
      _B('house', -125, 135),
      _B('garage', -150, 180),
      _B('shed', -120, 180),
      // === Cell F (中左下): 警察派出所 + 住宅 ===
      _B('police_station', -35, 132),                        // 郊外の派出所
      _B('townhouse', -5, 138),
      _B('shed', -55, 180),
      // === Cell G (中右下): 倉庫 2 連 ===
      _B('garage', 45, 132),
      _B('garage', 75, 135),
      _B('shed', 60, 180),
      // === Cell H (右下): 住宅 + 空き地風 ===
      _B('townhouse', 118, 132),
      _B('house', 148, 135),
      _B('shed', 178, 138),
      _B('garage', 120, 180),
    ],
    furniture: [
      // === Cell A: 住宅 + 納屋 ===
      _F('mailbox', -152, 22), _F('potted_plant', -120, 24),
      _F('wood_fence', -178, 22),
      _F('ac_unit', -152, 62),
      _F('laundry_pole', -120, 62),
      _F('power_pole', -175, 92),
      // === Cell B: 倉庫の前 (ローディングヤード) ===
      _F('sign_board', -55, 22),                             // 倉庫名看板
      _F('dumpster', -10, 22),                               // ごみ箱
      _F('milk_crate_stack', -50, 72),                       // 搬入用クレート
      _F('car', -5, 72),                                     // 搬入トラック
      _F('puddle_reflection', -30, 90),                      // アスファルトの水たまり
      _F('cable_junction_box', 5, 75),                       // 倉庫の配電
      // === Cell C: 消防分署 + ★★ Act IV シグネチャ: 火の見やぐら ===
      _F('flag_pole', 60, 22),                               // 国旗ポール
      _F('sign_board', 78, 22),                              // 署名看板
      _F('fire_watchtower', 90, 72),                         // ★★ 火の見やぐら (消防分署のシンボル)
      _F('fire_extinguisher', 50, 62),                       // 消火器
      _F('fire_extinguisher', 70, 62),
      _F('wood_fence', 95, 62),
      // === Cell D: 住宅 + ガレージ ===
      _F('mailbox', 138, 22), _F('potted_plant', 148, 24),
      _F('car', 170, 22),                                    // 駐車
      _F('pine_tree', 178, 60),                              // ★ 郊外の松
      _F('power_pole', 178, 92),

      // === Cell E: 古い住宅 + ガレージ ===
      _F('mailbox', -155, 112), _F('potted_plant', -125, 115),
      _F('wood_fence', -178, 112), _F('wood_fence', -178, 150),
      _F('laundry_balcony', -125, 150),
      _F('car', -148, 168),                                  // 古い軽自動車
      _F('power_pole', -175, 195),
      // === Cell F: 派出所 + 住宅 ===
      _F('flag_pole', -35, 112),                             // 派出所の国旗
      _F('sign_board', -55, 112),
      _F('bench', -20, 152),
      _F('potted_plant', -5, 115),
      _F('puddle_reflection', -35, 168),
      _F('cat', -50, 195),                                   // ★ 野良猫 (派出所裏)
      // === Cell G: 倉庫 2 連 (大ぐさり) ===
      _F('sign_board', 45, 112),
      _F('milk_crate_stack', 60, 152),                       // 搬入用クレート
      _F('dumpster', 80, 168),
      _F('cable_junction_box', 75, 155),
      _F('pine_tree', 90, 195),                              // ★ 郊外の松
      // === Cell H: 住宅 + 空き地 ===
      _F('mailbox', 118, 112), _F('potted_plant', 148, 115),
      _F('puddle_reflection', 148, 158),                     // 空き地の水たまり
      _F('wood_fence', 178, 150),
      _F('power_pole', 175, 195),
      // === 主要通り (x=0) 寂寥・疎 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('traffic_light', 90, 92),                           // 郊外の信号 (片側)
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('manhole_cover', 0, 100),
      _F('guardrail_short', -30, 100), _F('guardrail_short', 30, 100),
    ],
    humans: [
      _H(-50, 72),                                           // 倉庫作業員
      _H(-10, 62), _H(5, 72),                                // 搬入員
      _H(60, 62), _H(78, 62),                                // 消防隊員
      _H(138, 55),                                           // 住宅
      _H(-35, 148), _H(-20, 155),                            // 派出所の警官 + 来訪者
      _H(60, 152),                                           // 倉庫
      _H(0, 60), _H(0, 160),                                 // 主要通り (疎)
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),                       // 倉庫前アスファルト
      _G('asphalt', 0, 153.5, 360, 93),
      _G('concrete', -30, 60, 55, 45),                       // 倉庫前ローディング
      _G('concrete', 60, 60, 50, 45),                        // 消防署前
      _G('concrete', -35, 140, 50, 40),                      // 派出所前
      _G('dirt', 60, 155, 50, 50),                           // 倉庫裏の土
      _G('grass', -60, 180, 40, 25),
      _G('asphalt', 0, 15, 120, 25), _G('asphalt', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 11: 踏切 + Stage 2 (繁華街・夜) への handoff ──
  // 中央: 踏切 + 信号塔 (ランドマーク) — 街の終わり、夜の入口
  // 下段: 深夜営業の gas_station + convenience + ramen (夜の灯り予感)
  // 寂寥感: puddle_reflection 多め、pine_tree、古いガレージ
  { patternId: 's1_raw', raw: {
    buildings: [
      // === Cell A (左上): 倉庫 + 古い住宅 ===
      _B('garage', -150, 42),
      _B('townhouse', -118, 40),
      _B('shed', -150, 78),
      // === Cell B (中左上): 深夜ガソスタ ===
      _B('gas_station', -50, 42),                            // 夜営業 (ネオン予感)
      // === Cell C (中右上): 24 時間コンビニ + ラーメン ===
      _B('convenience', 45, 42),
      _B('ramen', 80, 42),                                   // 夜食のラーメン
      // === Cell D (右上): 古い住宅 + ガレージ ===
      _B('townhouse', 138, 40),
      _B('garage', 170, 42),
      _B('shed', 140, 78),

      // === Cell E (左下): 住宅 + 物置 ===
      _B('townhouse', -155, 132),
      _B('house', -125, 135),
      _B('garage', -148, 180),
      _B('shed', -118, 180),
      // === Cell F (中左下): 夜ラーメン + 古いガレージ ===
      _B('ramen', -45, 135),                                 // 夜の ramen
      _B('garage', -10, 132),
      _B('shed', -50, 180),
      // === Cell G (中右下): 2 軒目のコンビニ (夜) + 住宅 ===
      _B('convenience', 45, 135),
      _B('townhouse', 78, 138),
      _B('shed', 45, 180),
      // === Cell H (右下): 住宅 + ガレージ + 空き地 ===
      _B('house', 118, 135),
      _B('garage', 148, 138),
      _B('shed', 175, 180),
    ],
    furniture: [
      // === Cell A: 倉庫 + 住宅 ===
      _F('sign_board', -152, 22),
      _F('mailbox', -118, 22),
      _F('dumpster', -132, 62),
      _F('ac_unit', -118, 62),
      _F('puddle_reflection', -152, 75),
      _F('power_pole', -175, 92),
      // === Cell B: 深夜ガソスタ (ネオン看板の予感) ===
      _F('sign_board', -70, 22),                             // ガソスタ看板
      _F('sign_board', -30, 22),
      _F('chouchin', -50, 28),                               // 提灯 (夜の灯り)
      _F('vending', -70, 72),
      _F('traffic_cone', -60, 72), _F('traffic_cone', -40, 72),
      _F('puddle_reflection', -50, 72),
      // === Cell C: コンビニ + ラーメン (夜の灯り) ===
      _F('a_frame_sign', 30, 22),
      _F('chouchin', 80, 22),
      _F('noren', 80, 28),
      _F('vending', 30, 72),
      _F('bicycle_rack', 62, 62),
      _F('dumpster', 62, 72),
      _F('puddle_reflection', 50, 72),
      // === Cell D: 古い住宅 ===
      _F('mailbox', 138, 22),
      _F('car', 170, 22),                                    // 古い車
      _F('pine_tree', 178, 60),                              // ★ 郊外の松 (Stage 2 への目印)
      _F('power_pole', 178, 92),

      // === Cell E: 古い住宅群 ===
      _F('mailbox', -155, 112), _F('potted_plant', -125, 115),
      _F('wood_fence', -178, 112),
      _F('laundry_balcony', -125, 150),
      _F('car', -148, 168),
      _F('puddle_reflection', -158, 165),
      _F('power_pole', -175, 195),
      // === Cell F: 夜ラーメン ===
      _F('chouchin', -45, 112),
      _F('noren', -45, 118),
      _F('dumpster', -60, 168),
      _F('vending', -10, 152),
      _F('ac_outdoor_cluster', -45, 152),
      _F('puddle_reflection', -30, 168),
      _F('cat', -65, 195),                                   // ★ 野良猫 (夜の店裏)
      // === Cell G: コンビニ + 住宅 ===
      _F('a_frame_sign', 30, 112),
      _F('vending', 60, 152),
      _F('mailbox', 78, 112), _F('potted_plant', 88, 115),
      _F('puddle_reflection', 55, 168),
      // === Cell H: 住宅 + 空き地 ===
      _F('mailbox', 118, 112),
      _F('potted_plant', 130, 115),
      _F('wood_fence', 178, 150),
      _F('pine_tree', 175, 168),                             // ★ 郊外の松
      _F('power_pole', 178, 195),
      // === 踏切 + 信号塔 (Stage 2 への handoff ランドマーク、不変) ===
      _F('railroad_crossing', 0, 95),                        // ★★ 踏切 (Stage 2 handoff)
      _F('signal_tower', -150, 95), _F('signal_tower', 150, 95),
      _F('power_line', -90, 45), _F('power_line', -90, 155),
      _F('power_line', 90, 45), _F('power_line', 90, 155),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('puddle_reflection', -45, 100), _F('puddle_reflection', 45, 100),
      _F('traffic_cone', -30, 100), _F('traffic_cone', 30, 100),
      _F('manhole_cover', 0, 100),
      _F('telephone_booth', -85, 155),                       // 深夜の公衆電話
    ],
    humans: [
      _H(-50, 55),                                           // ガソスタ店員
      _H(45, 55), _H(80, 55),                                // コンビニ + ラーメン客
      _H(-45, 152), _H(-60, 158),                            // 夜ラーメン客
      _H(45, 152),                                           // 深夜コンビニ
      _H(0, 60), _H(0, 160),                                 // 踏切前の通行人 (疎)
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('concrete', -50, 60, 50, 45),                       // ガソスタ
      _G('tile', 45, 55, 30, 45),                            // コンビニ前
      _G('tile', 80, 55, 25, 45),                            // ラーメン前
      _G('concrete', 170, 60, 35, 45),                       // ガレージ前
      _G('tile', -45, 148, 30, 42),                          // ラーメン前
      _G('tile', 45, 148, 30, 42),                           // コンビニ前
      _G('asphalt', 0, 15, 120, 25), _G('asphalt', 0, 188, 120, 20),
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
