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

// ═══════════════════════════════════════════════════════════════════
// 【ステージ設計ガイド — ステージ単位コンセプト & ミニチュア原則】
//
// 各ステージは「一連のチャンクの集合」ではなく「一つの物語」として設計する。
// 以下 7 原則を共通ルールとし、raw 形式 (直接オブジェクト配置) で手書きする。
//
// 1. Act 構造
//    チャンクを 3〜4 幕で構成: 導入 (Act I) → 盛り上がり (Act II-III) → 離脱 (Act IV)。
//    各 Act は 2〜4 チャンクを担当し、テーマと密度を緩やかにシフト。
//
// 2. 連続軸 (Spine)
//    ステージ全体を貫く 2-3 本の連続要素 (並木/電線/ファサード/水路/提灯帯)
//    をチャンク境界を跨いで配置。handoff チャンクで次ステージへ緩やかに受け渡す。
//
// 3. セル単位の物語グルーピング
//    4 列 × 2 段 ≒ 8 セル (A-H) を意識し、各セルに「誰が住むか/何の店か」の
//    キャラを付与。建物に帰属する家具 (エアコン/看板/自転車) をセル内にまとめる。
//
// 4. Y レイヤ構造
//    y=20-30   facade 上段 (看板/郵便受/のれん)
//    y=35-80   建物帯 上段
//    y=88-102  中央道路 (avenue) — _MID_HR の周辺
//    y=115-125 facade 下段
//    y=130-180 建物帯 下段
//    y=185-200 背景家具 (電線/電柱)
//
// 5. 左右非対称
//    対になる位置 (±X) に同じ家具を並べない。奇数個で構成し整然としすぎない。
//
// 6. ミニチュア密度目安 (1 チャンク)
//    buildings 15-25 / furniture 50-80 / humans 5-10。
//    建物の隙間にも家具を置き、「ただ立つだけの空間」を作らない。
//
// 7. 歩道家具の自動配置
//    generateSidewalkFurniture() が水平道路沿いに家具を自動配置するため、
//    raw.furniture では街路定番家具 (自販機/街灯) を中央道路沿いに重ね置きしない。
//    ステージ固有の歩道感は `sidewalkZone` で選択 (0:住宅/1:商業/2:工業/3:和風/4:祭/5:夜街)。
// ═══════════════════════════════════════════════════════════════════

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

  // ── Chunk 0: 古民家の庭園 (★★ C0 固有: 日本庭園の朝) ──
  // ● Act I 連続軸 (桜並木 / stone_pavement 歩道 / 電柱): 継続
  // ● C0 固有: Cell B+F に日本庭園 (koi_pond + 飛び石 + 盆栽 + 松)
  //   facade の mailbox 行進を解除し、庭の物語に場所を譲る
  { patternId: 's1_raw', raw: {
    buildings: [
      // === 上段: 古民家中心の住宅列 ===
      _B('house', -155, 38), _B('house', -120, 42),             // Cell A 家族住宅
      _B('shed', -145, 72), _B('greenhouse', -115, 78),
      _B('townhouse', -50, 38),                                 // Cell B ★ 古民家 (庭園が裏)
      _B('shed', -75, 78),
      _B('house', 30, 40), _B('garage', 65, 42),                // Cell C 夫婦住宅 + 車庫
      _B('shed', 70, 78),
      _B('townhouse', 108, 40), _B('townhouse', 142, 42),       // Cell D タウンハウス連棟
      _B('shed', 118, 78), _B('greenhouse', 162, 78),

      // === 下段: 古民家続き + 菜園 ===
      _B('house', -150, 132), _B('house', -115, 128),           // Cell E 家庭菜園家族
      _B('greenhouse', -155, 170), _B('shed', -120, 178),
      _B('house', -48, 132),                                    // Cell F ★ 古民家の続き (縁側)
      _B('townhouse', 35, 130), _B('house', 70, 138),           // Cell G 小家族
      _B('house', 115, 132), _B('greenhouse', 158, 138),        // Cell H 桜古木の家
      _B('greenhouse', 115, 178), _B('shed', 160, 175),
    ],
    furniture: [
      // ─── ★★ C0 固有: 古民家の日本庭園 (Cell B 上段・Cell F 下段) ★★ ───
      _F('koi_pond', -30, 62),                                  // ★ 鯉の池
      _F('stepping_stones', -12, 72),                           // 飛び石
      _F('rock', -45, 66), _F('rock', -18, 78),                 // 庭石
      _F('bonsai', -55, 60), _F('bonsai', -10, 62),             // 盆栽 2 鉢
      _F('pine_tree', -68, 82),                                 // ★ 松
      _F('water_tank', 5, 78),                                  // 井戸風
      _F('cat', -35, 68),                                       // 縁側の猫 (鯉を見る)
      // Cell F 下段: 庭園の続き
      _F('bonsai', -58, 150),                                   // 盆栽
      _F('stepping_stones', -35, 162),                          // 飛び石
      _F('rock', -22, 168),
      _F('pine_tree', -75, 178),                                // 松 2 本目
      _F('cat', -28, 158),                                      // ★ 2 匹目の猫

      // ─── 軸: wood_fence (反復せず、庭園フレーム用のみ) ───
      _F('wood_fence', -178, 22), _F('wood_fence', 178, 22),
      _F('wood_fence', -80, 90),                                // 庭園のフレーム (Stage 1 語彙)
      _F('wood_fence', -80, 140),

      // ─── facade (減らす: 4 mailbox のみ) ───
      _F('mailbox', -155, 22), _F('mailbox', 108, 22),          // 上段 2 箇所
      _F('mailbox', -150, 118), _F('mailbox', 115, 118),        // 下段 2 箇所
      _F('potted_plant', -120, 25), _F('potted_plant', 142, 25),
      _F('post_letter_box', 0, 22),                             // avenue 入口ポスト

      // ─── 軸: 桜並木 (連続) ───
      _F('sakura_tree', 125, 60),
      _F('sakura_tree', 155, 88),
      _F('sakura_tree', 108, 150),

      // ─── 生活感 (エアコン・物干し・菜園小物) ───
      _F('ac_unit', -148, 52),
      _F('laundry_pole', -130, 68),
      _F('ac_unit', 40, 68), _F('car', 65, 55),
      _F('laundry_balcony', -130, 148),
      _F('flower_bed', -170, 145), _F('flower_planter_row', 65, 160),
      _F('ac_outdoor_cluster', 48, 148),
      _F('flower_bed', 140, 152),
      _F('bench', 135, 150),                                    // 桜古木前のベンチ

      // ─── 電柱 + 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 86),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),

      // ─── 町内小広場の入口 (C1 へ続く) ───
      _F('bench', 15, 182), _F('bench', 50, 182),
      _F('flower_bed', 82, 190),
      _F('sakura_tree', 32, 170),

      // ─── avenue ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
    ],
    humans: [
      _H(-30, 68),                                              // 鯉に餌やる老人
      _H(-40, 158),                                             // 縁側で新聞を読む老人
      _H(40, 48),                                               // 通勤前の父
      _H(-145, 148),                                            // 家庭菜園の老人
      _H(0, 80),                                                // avenue 通勤者
      _H(32, 178),                                              // 広場のベンチの老人
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93),
      _G('grass', 0, 153.5, 360, 93),

      // ─── 軸: stone_pavement 歩道 ───
      _G('stone_pavement', -65, 46.5, 24, 93),
      _G('stone_pavement', -65, 153.5, 24, 93),

      // ─── ★ C0 固有: 日本庭園ベース (砂利=concrete + 池周り wood_deck) ───
      _G('wood_deck', -45, 62, 52, 30),                         // ★ 縁側 (大幅拡張)
      _G('wood_deck', -45, 162, 52, 30),                        // ★ 下段縁側
      _G('dirt', -5, 82, 20, 16),                               // 庭園の砂利エリア

      // ─── 桜下の fallen_leaves リボン ───
      _G('fallen_leaves', 128, 68, 54, 38),
      _G('fallen_leaves', 115, 150, 50, 42),
      _G('fallen_leaves', 32, 178, 44, 34),

      // ─── dirt 菜園帯 ───
      _G('dirt', -150, 70, 50, 32),
      _G('dirt', -150, 175, 64, 42),
      _G('dirt', 158, 178, 36, 28),

      // ─── 車庫 ───
      _G('concrete', 65, 58, 30, 26),

      // ─── 町内小広場 tile ───
      _G('tile', 30, 190, 100, 20),

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
  // ── Chunk 3: 朝のカフェテラス (★★ C3 固有: 連続テラス席) ──
  // ● Cell F+G の下段をパン屋+本屋+カフェのテラス席で連結
  //   3 店舗の前に 4 本のパラソル・4 連ベンチ・プランターで一つの「朝のテラス」として読ませる
  //   Act II 共通の shop_awning / chouchin は使うが、パラソル密集が C3 固有
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

      // === Cell E (左下): 住宅 + ガレージ ===
      _B('house', -155, 130), _B('townhouse', -125, 132),
      _B('garage', -150, 178),
      _B('shed', -120, 175),
      // === Cell F-G (中下段): ★ パン屋 + 本屋 + カフェ 3 連テラス ★ ===
      _B('bakery', -55, 130),
      _B('bookstore', -20, 132),
      _B('cafe', 20, 130),
      _B('townhouse', -55, 178),
      _B('house', 50, 178),
      // === Cell G 右: 住宅 ===
      _B('house', 75, 138),
      _B('shed', 78, 178),
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
      _F('mailbox', 68, 22),
      // === Cell D: 薬局 + 家族住宅 ===
      _F('sign_board', 138, 22),                             // 薬局の看板
      _F('bicycle_rack', 145, 58),
      _F('sakura_tree', 168, 88),                            // ★ 桜並木 (Chunk 4 に続く)
      _F('ac_unit', 155, 62),

      // === Cell E: 住宅 + ガレージ ===
      _F('mailbox', -155, 112), _F('potted_plant', -125, 115),
      _F('car', -150, 165),                                  // 駐車車両
      _F('ac_unit', -128, 148),
      _F('power_pole', -178, 195),
      // ─── ★★ C3 固有: 3 連テラス席 (パン屋 + 本屋 + カフェ) ★★ ───
      _F('shop_awning', -55, 120),
      _F('shop_awning', -20, 120),
      _F('shop_awning', 20, 120),
      _F('noren', -55, 116),
      _F('a_frame_sign', -72, 112),
      _F('a_frame_sign', 0, 112),
      _F('a_frame_sign', 35, 112),
      // テラス: パラソル 4 連 (連続感を出す)
      _F('parasol', -50, 150), _F('parasol', -25, 150),
      _F('parasol', 0, 150),    _F('parasol', 25, 150),
      // ベンチ (朝食の常連)
      _F('bench', -38, 162), _F('bench', -12, 162),
      _F('bench', 12, 162),
      _F('flower_planter_row', -38, 140), _F('flower_planter_row', 12, 140),
      _F('bicycle_row', -55, 172),                           // 客の自転車
      _F('cat', 38, 168),                                    // ★ テラスの猫

      // === Cell G 右 + Cell H: 住宅 + 花屋 ===
      _F('mailbox', 75, 122),
      _F('sakura_tree', 95, 152),                            // ★ 桜並木
      _F('flower_planter_row', 115, 112),                    // 花屋前のプランター
      _F('a_frame_sign', 128, 112),
      _F('mailbox', 150, 112),
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
      _H(-38, 158), _H(-12, 158), _H(12, 158),               // テラス席の朝食客 3
      _H(-38, 170), _H(12, 170),                             // ベンチの常連 2
      _H(120, 55),                                           // 薬局客
      _H(0, 60), _H(0, 160),                                 // 主要通りの歩行者
    ],
    grounds: [
      _G('grass', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -45, 55, 30, 45),                           // コンビニ前の舗装
      _G('tile', 35, 55, 25, 40),                            // クリーニング前
      // ─── ★ C3 固有: 3 連テラスの tile (連続) ───
      _G('tile', -15, 140, 100, 50),                         // テラス広場 (幅広)
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
      _F('bicycle_rack', -75, 62),
      _F('potted_plant', -8, 24),
      // ─── ★★ C5 固有: 地域公共広場 (郵便局 × 銀行の間の civic plaza) ★★ ───
      _F('plaza_tile_circle', 0, 78),                        // ★ 広場の中央円 (大)
      _F('statue', 0, 72),                                   // ★ 地域創設者の像 (モニュメント)
      _F('fountain', -20, 80),                               // 小さな噴水
      _F('flag_pole', -12, 88),                              // 国旗 1
      _F('flag_pole', 12, 88),                               // 国旗 2
      _F('bench', -18, 92), _F('bench', 18, 92),             // 広場ベンチ 2
      _F('flower_bed', -30, 82),                             // 広場花壇
      _F('flower_bed', 30, 82),
      _F('flower_planter_row', 0, 62),                       // 広場入口プランター列
      _F('street_lamp', -22, 72), _F('street_lamp', 22, 72), // 広場の街灯
      // === Cell C: 銀行 + 住宅 ===
      _F('atm', 28, 22),                                     // 銀行前の ATM
      _F('sign_board', 62, 22),
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
      _H(-50, 55), _H(-65, 62),                              // 郵便局の客 2 人
      _H(28, 55), _H(62, 58),                                // 銀行の客
      _H(-18, 90), _H(18, 90),                               // 広場ベンチの 2 人
      _H(0, 80),                                             // 広場で像を見る人
      _H(138, 55),                                           // パン屋の客
      _H(-130, 150),                                         // 花屋の客
      _H(-55, 150), _H(-20, 150), _H(-55, 192),              // 本屋+カフェ+薬局の客
      _H(40, 150),                                           // クリーニングの客
      _H(0, 160),                                            // 主要通り下段
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),                      // 公共ゾーン
      _G('concrete', 0, 153.5, 360, 93),
      _G('tile', -125, 55, 35, 45),                          // カフェ前
      _G('tile', -50, 55, 40, 45),                           // 郵便局前
      _G('tile', 45, 55, 40, 45),                            // 銀行前
      // ─── ★ C5 固有: 地域広場の中央円 ───
      _G('tile', 0, 78, 60, 36),                             // ★ 広場の円形相当 (tile 大)
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

  // ── Chunk 6: ★★★ 小学校キャンパス (Act III 最上位ランドマーク) ──
  // 上段全域を小学校が占有 (校門+本校舎+体育館+プール+校庭+裏山)
  // 下段のみ下校路の小商店列 (Act II 商店街からの連続)
  { patternId: 's1_raw', raw: {
    buildings: [
      // === 上段: 小学校キャンパス (Cell A-D を貫く大ランドマーク) ===
      _B('school', -90, 42),                                 // ★ 本校舎 (左翼)
      _B('school', -20, 42),                                 // ★ 本校舎 (右翼) — 連結校舎
      _B('school', 55, 42),                                  // ★ 体育館 (校舎 BuildingSize 流用)
      _B('garage', 108, 42),                                 // プール棟
      _B('shed', 145, 42),                                   // 器具庫
      // 校舎裏: 倉庫 + 裏山の境
      _B('shed', -150, 78), _B('shed', -120, 82),
      _B('shed', 55, 80),                                    // 体育倉庫
      _B('greenhouse', 108, 80),                             // 温室 (理科教材)

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
      // ══════════════════════════════════════════════════════════
      // ★★★ 上段: 小学校キャンパス (Act III 最上位ランドマーク)
      // ══════════════════════════════════════════════════════════
      // ─── 校門 (y=22 avenue 沿い、全幅): 生垣+国旗+校名+二宮金次郎 ───
      _F('hedge', -178, 22), _F('hedge', -145, 22),          // 校門左サイド生垣
      _F('sakura_tree', -120, 25),                           // 校門脇の桜
      _F('flag_pole', -95, 22),                              // 国旗
      _F('flag_pole', -78, 22),                              // 校旗
      _F('sign_board', -55, 22),                             // 校名看板
      _F('statue', -20, 28),                                 // ★ 二宮金次郎像
      _F('flower_planter_row', 10, 22),
      _F('flag_pole', 35, 22),                               // 体育館前旗
      _F('sakura_tree', 72, 25),                             // 校門右サイド桜
      _F('hedge', 95, 22),                                   // 生垣
      // ─── 校庭 (y=60-95): フル遊具スイート + 裏山 ───
      _F('play_structure', -110, 65),                        // 複合遊具
      _F('swing_set', -75, 68),                              // ブランコ
      _F('slide', -40, 65),                                  // すべり台
      _F('sandbox', -10, 72),                                // 砂場
      _F('jungle_gym', 25, 70),                              // ★ ジャングルジム (Act III シグネチャ)
      _F('bench', -125, 62),                                 // 校庭ベンチ
      _F('bench', -95, 62),
      _F('bench', 45, 62),
      _F('flower_bed', -55, 62),
      _F('bicycle_row', -150, 65),                           // 駐輪場 (登校生)
      _F('bicycle_row', -55, 95),                            // 駐輪場 2
      _F('potted_plant', -35, 62), _F('potted_plant', 10, 62),
      // ─── プール + 体育館脇 ───
      _F('koi_pond', 108, 62),                               // プール (koi_pond 流用)
      _F('hedge', 135, 65),                                  // プールフェンス
      _F('water_tank', 145, 68),                             // 給水タンク
      // ─── 裏山 (y=85-95 最奥): 松林 ───
      _F('pine_tree', -165, 90),
      _F('pine_tree', -135, 92),
      _F('pine_tree', 78, 90),
      _F('pine_tree', 162, 88),
      // ─── 周辺フェンス (校庭境界) ───
      _F('wood_fence', -178, 60), _F('wood_fence', 178, 60),
      _F('wood_fence', -178, 90),
      _F('power_pole', -175, 95), _F('power_pole', 175, 95),

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
      // 校門前: 登校の児童列 (y=30 avenue 沿い)
      _H(-95, 30), _H(-75, 30), _H(-55, 30), _H(-30, 30), _H(-10, 30),
      _H(15, 30), _H(40, 30), _H(72, 30),
      // 校庭: 遊んでいる児童
      _H(-108, 75), _H(-75, 78), _H(-40, 75), _H(-10, 80), _H(25, 78),
      _H(-125, 68), _H(45, 68),                              // ベンチの児童
      _H(108, 72),                                           // プール見学
      // 下段商店街
      _H(-55, 148), _H(-20, 148), _H(-35, 155),              // 本屋+薬局の下校生
      _H(35, 148), _H(68, 152),                              // 花屋+カフェ客
      _H(0, 160),                                            // 主要通り
    ],
    grounds: [
      _G('concrete', 0, 46.5, 360, 93),
      _G('concrete', 0, 153.5, 360, 93),
      // ★ 校庭全体: 超大型 dirt 校庭 + tile punctuation
      _G('dirt', -50, 72, 300, 55),                          // ★ 校庭全体 (dirt, 300×55)
      _G('tile', -60, 22, 240, 16),                          // 校門前 tile 歩道
      _G('tile', 110, 65, 35, 25),                           // プール周辺 tile
      _G('tile', -150, 65, 20, 25),                          // 駐輪場 tile
      _G('grass', -165, 92, 28, 20), _G('grass', 160, 92, 28, 20),  // 裏山 grass
      _G('grass', -135, 92, 20, 18), _G('grass', 78, 92, 20, 18),
      // 下段商店街
      _G('tile', -55, 135, 30, 45),
      _G('tile', -20, 135, 25, 45),
      _G('tile', 35, 135, 30, 45),
      _G('tile', 68, 135, 22, 45),
      _G('tile', -55, 180, 30, 25),
      _G('concrete', 0, 15, 120, 25), _G('concrete', 0, 188, 120, 20),
    ],
    horizontalRoads: [_MID_HR, _TOP_HR], verticalRoads: [..._SPINE_V],
  } },
  // ── Chunk 7: 提灯アーケード商店街 (★★ C7 固有: avenue 両脇の提灯連) ──
  // ● C7 固有: 主要通り (x=0 avenue) の両側 y=86/114 に chouchin を連続 14 本ぶら下げる
  //   商店街の天蓋効果を作り、C6 校門 / C8 駅前から視覚的に異質化
  // ● banner_pole を 4 本に増やし、通り全体を祭日前のような賑わいに
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
      // === ★★ C7 固有: 提灯アーケード (avenue 両脇に 14 本 + banner 4 本) ★★ ===
      _F('chouchin', -90, 92), _F('chouchin', -60, 92), _F('chouchin', -30, 92),
      _F('chouchin', 0, 92),   _F('chouchin', 30, 92),   _F('chouchin', 60, 92),
      _F('chouchin', 90, 92),
      _F('chouchin', -90, 108), _F('chouchin', -60, 108), _F('chouchin', -30, 108),
      _F('chouchin', 0, 108),   _F('chouchin', 30, 108),  _F('chouchin', 60, 108),
      _F('chouchin', 90, 108),
      _F('banner_pole', -120, 100), _F('banner_pole', -60, 100),
      _F('banner_pole', 60, 100),   _F('banner_pole', 120, 100),
      // === 主要通り (x=0) 商店街の最大密度 ===
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
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

// ─── Stage 2: 繁華街・夜の街 (10 チャンク, raw 配置) ──────────────
// 【全体の物語】: プレイヤーは Stage 1 の踏切を越え、駅前の繁華街に入り、
// 歓楽街の最奥を抜け、夜明け前の神社裏手から古都 (Stage 3) へ抜ける。
//   Act I  (C0-C2):  駅前繁華     — 駅舎・サラリーマン動線・アーケード入口
//   Act II (C3-C5):  歓楽街の極み — カラオケ・パチンコ・雑居ビル
//   Act III(C6-C8):  深夜の路地   — スナック街・屋台・裏路地
//   Act IV (C9):     朝の気配     — 神社の裏手、Stage 3 への handoff
// 【連続軸】: 電線+電柱 (y=92, 195) / ネオン提灯帯 (facade y=20-30) /
//           asphalt 中央 avenue / puddle_reflection の夜の湿り気
// 【設計原則】: セル物語グルーピング / 左右非対称 / 歩道家具は Zone 5 (自動配置)
const STAGE_2_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 駅前繁華 (C0-C2) ═══════════════════════════════════════

  // ── C0: 駅前ロータリー — 小さな駅舎 + タクシー + バス乗り場 ──
  // Stage 1 終端の踏切から駅北口へ。帰宅サラリーマンと駅員が主役。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列ファサード (Y をずらす) ===
      _B('ramen', -148, 42),                                    // Cell A 駅前ラーメン
      _B('snack', -115, 38),
      _B('train_station', -25, 52),                             // ★ Cell B 駅舎 (奥に構える)
      _B('convenience', 55, 40),
      _B('cafe', 90, 44),
      _B('business_hotel', 135, 68),                            // ★ 背が高いため奥
      _B('shop', 172, 40),
      // === 上段 ─ 奥列 (小屋/物置/人力車置き場) ===
      _B('shed', -170, 76),                                     // 駅裏の倉庫
      _B('garage', -128, 80),
      _B('greenhouse', -78, 78),                                // 花屋の温室
      _B('shed', 30, 72),
      _B('garage', 78, 74),
      _B('shed', 110, 76),
      _B('shed', 168, 80),
      // === 下段 ─ 前列ファサード ===
      _B('mahjong_parlor', -150, 132),                          // ★ 麻雀荘
      _B('izakaya', -118, 138),
      _B('bus_terminal_shelter', -55, 142),                     // Cell F バス乗り場 (長庇)
      _B('bakery', 38, 130),
      _B('karaoke', 78, 144),                                   // 少し奥
      _B('capsule_hotel', 135, 146),                            // ★ カプセル (横長、少し奥)
      _B('apartment', 175, 148),
      // === 下段 ─ 奥列 (駐輪場/物置/タクシー溜まり) ===
      _B('shed', -170, 172),
      _B('garage', -128, 178),                                  // タクシー車庫
      _B('shed', -90, 174),
      _B('yatai', -22, 170),                                    // ★ 駅前の夜鳴き屋台
      _B('shed', 12, 176),
      _B('garage', 100, 178),
      _B('shed', 158, 172),
      _B('house', 195, 170),                                    // 駅前の古い家
    ],
    furniture: [
      // ─── 軸: ネオン提灯帯 (facade y=22 上段) ───
      _F('chouchin', -148, 22), _F('noren', -148, 28),
      _F('chouchin', -115, 22), _F('noren', -115, 28),
      _F('sign_board', -25, 22),                                // 駅名標
      _F('a_frame_sign', -55, 22), _F('a_frame_sign', 55, 22),
      _F('chouchin', 90, 22), _F('kerbside_vending_pair', 120, 25),
      // ─── 駅前設備 ───
      _F('newspaper_stand', -5, 75), _F('post_box', 8, 75),
      _F('telephone_booth', -38, 72),
      _F('taxi_rank_sign', 32, 75), _F('bus_stop', -55, 75),
      _F('plaza_tile_circle', -25, 80),                         // 駅前広場の石畳
      // ─── 軸: 電線・電柱 (全チャンク共通) ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 軸: 提灯帯 (facade y=118 下段) ───
      _F('chouchin', -150, 118), _F('noren', -150, 124),
      _F('chouchin', -118, 118), _F('noren', -118, 124),
      _F('a_frame_sign', -55, 118), _F('chouchin', 72, 118), _F('noren', 72, 124),
      _F('a_frame_sign', 38, 118), _F('sign_board', 118, 118),
      // ─── ロータリー (下段中央) ───
      _F('car', -28, 170), _F('car', 32, 170),                  // 停車タクシー
      _F('bicycle_row', -90, 170), _F('bicycle_rack', 68, 172),
      _F('dumpster', -150, 172), _F('manhole_cover', 0, 165),
      // ─── 軸: puddle_reflection (夜街シグネチャ) ───
      _F('puddle_reflection', -130, 72), _F('puddle_reflection', 60, 78),
      _F('puddle_reflection', -50, 168), _F('puddle_reflection', 70, 170),
      _F('puddle_reflection', 0, 100),
      // ─── 街灯 (avenue 両側) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-25, 55),                                              // 駅員
      _H(-5, 78), _H(-38, 75),                                  // 駅前通行人
      _H(-40, 170), _H(60, 170),                                // タクシー乗客
      _H(-115, 55), _H(90, 55),                                 // 帰宅サラリーマン
      _H(38, 152),                                              // 深夜コンビニ客
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -25, 65, 55, 40),                              // 駅舎前石畳
      _G('tile', -55, 158, 42, 42),                             // バス乗り場
      _G('tile', 35, 165, 38, 35),                              // タクシーレーン
      _G('asphalt', 0, 15, 180, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C1: サラリーマン動線 — 夜食と一杯の多彩な小店 ──
  // 帰宅サラリーマンが夜食を取る帯。同系統の店が被らないよう 1 チャンク内で
  // 全て異なる業種を並べる (ラーメン/牛丼/立ち飲み/スナック/麻雀/ブックカフェ等)。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列ファサード (y=38-46、業種で Y を少しずらす) ===
      _B('ramen', -156, 42),                                    // Cell A ラーメン
      _B('snack', -128, 38),                                    // 前方 (小さく手前)
      _B('bakery', -102, 44),                                   // 奥めに
      _B('izakaya', -62, 40),                                   // Cell B 立ち飲み
      _B('shop', -28, 46),                                      // 牛丼 (見立て)
      _B('cafe', 5, 38),
      _B('convenience', 40, 44),                                // Cell C 24h
      _B('pharmacy', 72, 40),
      _B('bookstore', 105, 42),                                 // Cell D
      _B('karaoke', 142, 48),                                   // ★ カラオケ (奥めに、背が高い)
      // === 上段 ─ 奥列 (y=65-85) 物置/室外機小屋/小さな店 ===
      _B('shed', -170, 72),                                     // 路地裏の物置
      _B('garage', -115, 78),                                   // 車庫
      _B('shed', -78, 74),
      _B('yatai', -42, 68),                                     // ★ 路地に置かれた屋台
      _B('shed', 22, 76),
      _B('garage', 85, 80),                                     // 奥の車庫
      _B('shed', 125, 72),
      _B('house', 172, 68),                                     // ★ 奥の古い家
      // === 下段 ─ 前列ファサード (y=128-138) ===
      _B('mahjong_parlor', -160, 132),                          // ★ Cell E 麻雀荘
      _B('laundromat', -128, 138),
      _B('florist', -102, 130),
      _B('gas_station', -60, 136),                              // Cell F 深夜ガソスタ (少し奥)
      _B('post_office', -18, 132),
      _B('business_hotel', 30, 150),                            // ★ Cell G (背が高いため少し奥)
      _B('clinic', 72, 128),                                    // Cell H
      _B('restaurant', 102, 134),
      _B('snack', 132, 130),                                    // ★ スナック 2 軒目
      // === 下段 ─ 奥列 (y=160-180) ===
      _B('shed', -175, 170),
      _B('garage', -128, 178),                                  // 麻雀荘の裏
      _B('shed', -90, 174),
      _B('greenhouse', -48, 172),                               // ★ 深夜営業の八百屋風
      _B('shed', 5, 168),
      _B('yatai', 58, 170),                                     // ★ 駐車場脇の屋台
      _B('shed', 118, 176),
      _B('apartment', 170, 168),                                // Cell H 駅前アパート (背景)
      _B('shed', 195, 172),
    ],
    furniture: [
      // ─── 上段 facade (業種別に看板を変える) ───
      _F('chouchin', -156, 22), _F('noren', -156, 28),           // ramen
      _F('sign_board', -128, 22),                                // snack ピンク看板
      _F('a_frame_sign', -102, 22),                              // bakery
      _F('chouchin', -62, 22), _F('noren', -62, 28),             // izakaya
      _F('a_frame_sign', -28, 22),                               // shop
      _F('shop_awning', 5, 28),                                  // cafe
      _F('sign_board', 40, 22),                                  // convenience
      _F('a_frame_sign', 72, 22),                                // pharmacy (+ 十字)
      _F('flag_pole', 72, 25),
      _F('banner_pole', 105, 22),                                // bookstore
      _F('sign_board', 140, 22),                                 // karaoke 大看板
      _F('mailbox', 175, 22),                                    // house
      // ─── 中間小物 ───
      _F('kerbside_vending_pair', -85, 72),
      _F('bicycle_row', -45, 72), _F('bicycle_rack', 55, 75),
      _F('dumpster', 90, 75), _F('dumpster', 125, 75),
      _F('milk_crate_stack', -130, 72),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 下段 facade (業種別) ───
      _F('sign_board', -160, 118),                               // mahjong_parlor 緑看板
      _F('a_frame_sign', -130, 118),                             // laundromat
      _F('shop_awning', -105, 124),                              // florist
      _F('sign_board', -60, 118),                                // gas_station
      _F('flag_pole', -60, 115),
      _F('post_box', -20, 122),                                  // post_office
      _F('sign_board', -20, 118),
      _F('banner_pole', 28, 118),                                // business_hotel
      _F('a_frame_sign', 68, 118),                               // clinic
      _F('chouchin', 102, 118), _F('noren', 102, 124),           // restaurant
      _F('sign_board', 130, 118),                                // snack 2
      _F('mailbox', 170, 118),                                   // apartment
      // ─── 下段小物 ───
      _F('bicycle_row', -100, 172), _F('bicycle_rack', 45, 172),
      _F('dumpster', -45, 170), _F('dumpster', 85, 170),
      _F('kerbside_vending_pair', -85, 170),
      _F('traffic_cone', -58, 172), _F('traffic_cone', -48, 172), // ガソスタ前
      _F('car', -60, 170),                                       // 給油中
      _F('milk_crate_stack', 155, 172),
      // ─── 軸: 水たまり ───
      _F('puddle_reflection', -70, 72), _F('puddle_reflection', 40, 78),
      _F('puddle_reflection', -110, 168), _F('puddle_reflection', 80, 170),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-156, 55), _H(-62, 55),                                // ラーメン・居酒屋客
      _H(5, 55), _H(72, 55),                                     // カフェ・ドラッグ客
      _H(140, 55),                                               // カラオケ客
      _H(-160, 152),                                             // 麻雀客
      _H(-60, 152),                                              // 給油待ち
      _H(102, 152),                                              // レストラン客
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -125, 58, 70, 42),                             // ラーメン通り前タイル
      _G('tile', 22, 58, 80, 42),                               // 夜カフェ前タイル
      _G('tile', -28, 158, 45, 42),                             // pachinko 前
      _G('tile', 62, 158, 70, 42),
      _G('asphalt', 0, 15, 200, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C2: アーケード入口 — shotengai_arcade + 提灯ガーランド ──
  // Act II 歓楽街への扉。提灯が避ける間もなく連続し、ネオンが近づく。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列 (アーケード + 多様小店) ===
      _B('shotengai_arcade', -110, 48),                         // ★ 大型アーケード (奥)
      _B('bookstore', -30, 40),
      _B('cafe', 0, 44),
      _B('izakaya', 30, 38),
      _B('ramen', 60, 42),
      _B('pachinko', 108, 46),                                  // ★ Act II 予兆
      _B('snack', 148, 40),
      _B('shop', 175, 42),
      // === 上段 ─ 奥列 (小屋/物置/花屋の温室など) ===
      _B('shed', -170, 74),
      _B('garage', -60, 78),
      _B('florist', -25, 75),                                   // 花屋 (小さく)
      _B('shed', 40, 82),
      _B('greenhouse', 85, 76),
      _B('shed', 135, 74),
      _B('garage', 168, 80),
      // === 下段 ─ 前列 ===
      _B('mahjong_parlor', -160, 132),
      _B('ramen', -128, 138),
      _B('snack', -95, 130),
      _B('bookstore', -62, 134),
      _B('karaoke', -15, 144),                                  // ★ 奥に
      _B('shotengai_arcade', 105, 140),                         // ★ 下段大型アーケード
      _B('shop', 35, 130),
      _B('cafe', 60, 136),
      // === 下段 ─ 奥列 ===
      _B('shed', -175, 170),
      _B('garage', -140, 176),
      _B('shed', -78, 172),
      _B('yatai', -32, 168),                                    // ★ 屋台
      _B('shed', 18, 176),
      _B('garage', 48, 172),
      _B('shed', 165, 178),
    ],
    furniture: [
      // ─── ★★ Act I→II 遷移シグネチャ: 提灯ガーランド全幅連続 ★★ ───
      // y=12 の高さに x=-170 から x=170 まで点々と提灯を 12 個並べる
      _F('chouchin', -170, 12), _F('chouchin', -140, 10), _F('chouchin', -110, 12),
      _F('chouchin', -80, 10), _F('chouchin', -50, 12), _F('chouchin', -20, 10),
      _F('chouchin', 10, 12), _F('chouchin', 40, 10), _F('chouchin', 70, 12),
      _F('chouchin', 100, 10), _F('chouchin', 130, 12), _F('chouchin', 160, 10),
      // ─── 上段 facade ───
      _F('shop_awning', -110, 30),                              // アーケード庇
      _F('banner_pole', -140, 22), _F('banner_pole', -80, 22),  // 商店街幟
      _F('noren', -30, 28), _F('a_frame_sign', 0, 22),
      _F('noren', 30, 28), _F('noren', 60, 28),
      _F('sign_board', 108, 22),                                // pachinko 看板
      _F('chouchin', 148, 28), _F('noren', 148, 32),
      // ─── 上段中間 ───
      _F('kerbside_vending_pair', -50, 72), _F('kerbside_vending_pair', 135, 72),
      _F('bicycle_row', 0, 72), _F('dumpster', 70, 75),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 下段 facade ───
      _F('shop_awning', 105, 128),
      _F('banner_pole', 75, 118), _F('banner_pole', 140, 118),
      _F('chouchin', -160, 118), _F('noren', -160, 124),
      _F('chouchin', -128, 118), _F('chouchin', -95, 118), _F('noren', -95, 124),
      _F('a_frame_sign', -62, 118),
      _F('sign_board', -15, 118),                                // karaoke 看板
      _F('a_frame_sign', 35, 118), _F('chouchin', 60, 118), _F('noren', 60, 124),
      // ─── 下段小物 ───
      _F('bicycle_row', 145, 172), _F('bicycle_rack', -115, 172),
      _F('dumpster', -35, 170), _F('dumpster', 45, 172),
      _F('milk_crate_stack', -160, 170),
      // ─── 軸: puddle + manhole ───
      _F('puddle_reflection', -40, 75), _F('puddle_reflection', 120, 78),
      _F('puddle_reflection', -80, 170), _F('puddle_reflection', 100, 170),
      _F('manhole_cover', 0, 165),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-110, 62),                                              // アーケード通行客
      _H(0, 55), _H(60, 55),                                     // カフェ・ラーメン客
      _H(108, 55),                                               // pachinko 開店待ち
      _H(-95, 152), _H(-15, 152),                                // 横丁客 + カラオケ客
      _H(105, 158),                                              // アーケード出口
      _H(35, 152),
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -110, 65, 120, 45),                             // アーケード上段床
      _G('tile', 105, 162, 130, 40),                             // アーケード下段床
      _G('tile', -15, 158, 40, 42),                              // karaoke 前
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ═══ Act II: 歓楽街の極み (C3-C5) ════════════════════════════════

  // ── C3: 高層雑居ビル街 — カラオケ 1 棟 + 多様な大型店 ──
  // 歓楽街の入り口。高層雑居ビル・ホテル・ラウンジが天を衝くが、カラオケは
  // 1 棟に絞り、club / love_hotel / business_hotel などで多様性を出す。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列 (小店で facade を揺らす) ===
      _B('karaoke', -150, 50),                                  // ★ 唯一のカラオケ (奥に)
      _B('snack', -115, 38),                                    // 前方
      _B('club', -58, 46),                                      // ★ クラブ (少し奥)
      _B('izakaya', -22, 40),
      _B('bookstore', 10, 44),
      _B('cafe', 95, 38),
      _B('bank', 128, 46),
      _B('shop', 165, 42),
      // === 上段 ─ 奥列 (高層ビル + 物置) ===
      _B('apartment_tall', -108, 78),                           // ★ 高層 (奥)
      _B('tower', 55, 82),                                      // ★ 雑居タワー (奥)
      _B('love_hotel', 168, 80),                                // ★ ラブホ (奥)
      _B('shed', -170, 70),
      _B('garage', -82, 74),
      _B('shed', 25, 68),
      _B('shed', 105, 76),
      _B('greenhouse', 138, 72),
      // === 下段 ─ 前列 ===
      _B('snack', -115, 132),
      _B('ramen', -82, 138),
      _B('mahjong_parlor', 20, 134),
      _B('pharmacy', 100, 130),
      _B('laundromat', 175, 134),
      // === 下段 ─ 奥列 (高層/大型はここ) ===
      _B('business_hotel', -150, 160),                          // ★ ビジネスホテル (奥)
      _B('office', -22, 158),
      _B('movie_theater', 62, 162),                             // ★ ミニシアター
      _B('capsule_hotel', 145, 165),                            // ★ カプセルホテル
      _B('shed', -175, 175),
      _B('garage', -45, 172),
      _B('yatai', 50, 170),                                     // ★ 屋台
      _B('shed', 120, 178),
    ],
    furniture: [
      // ─── ★★ シグネチャ: 巨大カラオケ看板の連続 ★★ ───
      _F('sign_board', -150, 22),                               // Cell A karaoke 大看板
      _F('sign_board', -55, 22),                                // Cell B karaoke 看板
      _F('sign_board', 68, 118),                                // Cell G karaoke 看板
      _F('sign_board', -150, 118),                              // Cell E karaoke 看板
      _F('banner_pole', -130, 22), _F('banner_pole', 88, 22),
      // ─── ネオン提灯帯 (上段) ───
      _F('chouchin', -20, 22), _F('noren', -20, 28),
      _F('chouchin', 10, 22), _F('chouchin', 95, 22), _F('noren', 95, 28),
      _F('chouchin', 122, 22), _F('noren', 122, 28),
      _F('a_frame_sign', 55, 22),                               // タワー 1F 案内
      // ─── 上段中間 ───
      _F('kerbside_vending_pair', -80, 72),
      _F('bicycle_rack', 35, 75), _F('bicycle_rack', 138, 75),
      _F('dumpster', -180, 72), _F('dumpster', 180, 72),
      _F('street_mirror', -95, 62),                             // 歓楽街の街角ミラー
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 提灯帯 (下段) ───
      _F('chouchin', -110, 118), _F('noren', -110, 124),
      _F('chouchin', -80, 118), _F('noren', -80, 124),
      _F('chouchin', 32, 118), _F('noren', 32, 124),
      _F('sign_board', -18, 118), _F('sign_board', 128, 118),
      _F('chouchin', 172, 118), _F('noren', 172, 124),
      // ─── 下段小物 (夜の路駐) ───
      _F('bicycle_row', -50, 172), _F('bicycle_row', 100, 172),
      _F('dumpster', -180, 170), _F('dumpster', 180, 170),
      _F('car', 10, 172),                                       // 路駐タクシー
      _F('kerbside_vending_pair', 60, 172),
      // ─── 水たまり + 街灯 ───
      _F('puddle_reflection', -85, 75), _F('puddle_reflection', 85, 75),
      _F('puddle_reflection', -40, 170), _F('puddle_reflection', 50, 170),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-150, 72), _H(-55, 72),                                // カラオケ客
      _H(68, 162), _H(-150, 162),
      _H(55, 88),                                               // タワー雑居帰り
      _H(-20, 55), _H(95, 55),                                  // 居酒屋客
      _H(-18, 172),                                             // オフィス残業帰り
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -100, 65, 140, 45),                            // カラオケ街タイル
      _G('tile', 60, 75, 60, 30),                               // タワー前
      _G('tile', -110, 158, 100, 42),                           // カラオケ下段
      _G('tile', 68, 162, 50, 38),
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C4: ゲーセンとパチンコのメイン通り — 交番 + 多業種混在 ──
  // Stage 2 の最盛期。パチンコとゲーセンは各 1 軒に絞り、周囲を多業種で彩る。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列 ===
      _B('pachinko', -148, 46),                                 // ★ 唯一のパチンコ
      _B('game_center', -108, 40),                              // ★ ゲーセン
      _B('karaoke', -65, 50),                                   // 少し奥
      _B('police_station', -10, 52),                            // ★ 交番 (奥)
      _B('club', 38, 48),                                       // ★ クラブ
      _B('bookstore', 78, 40),
      _B('izakaya', 158, 38),
      _B('ramen', 180, 42),
      // === 上段 ─ 奥列 ===
      _B('movie_theater', 115, 78),                             // 映画館 (奥)
      _B('shed', -175, 72),
      _B('garage', -130, 78),
      _B('shed', -85, 74),
      _B('greenhouse', -35, 76),
      _B('shed', 18, 72),
      _B('yatai', 60, 70),                                      // ★ 屋台
      _B('shed', 138, 78),
      // === 下段 ─ 前列 ===
      _B('bank', -150, 148),                                    // 少し奥
      _B('mahjong_parlor', -115, 132),
      _B('cafe', -35, 138),
      _B('pharmacy', 42, 130),
      _B('snack', 75, 134),
      _B('bakery', 155, 132),
      // === 下段 ─ 奥列 ===
      _B('love_hotel', -75, 160),                               // ★ 奥
      _B('capsule_hotel', 5, 165),                              // ★ 奥 (横長)
      _B('business_hotel', 112, 168),                           // ★ 奥 (縦長)
      _B('apartment', 180, 158),
      _B('shed', -178, 172),
      _B('garage', -30, 175),
      _B('shed', 45, 178),
      _B('shed', 145, 172),
    ],
    furniture: [
      // ─── ★★ シグネチャ: パチンコ大看板 5 連 ★★ ───
      _F('sign_board', -145, 22), _F('sign_board', -55, 22),
      _F('sign_board', 55, 22),
      _F('sign_board', -148, 118), _F('sign_board', -15, 118),
      // ─── 交番の看板 + 赤色灯 ───
      _F('a_frame_sign', 0, 22),                                // KOBAN 案内板
      _F('flag_pole', -10, 24), _F('flag_pole', 10, 24),
      _F('traffic_cone', -15, 75), _F('traffic_cone', 15, 75),  // 交番前のコーン
      // ─── 上段提灯帯 + 看板 ───
      _F('banner_pole', -120, 22), _F('banner_pole', 80, 22),
      _F('chouchin', -100, 22), _F('noren', -100, 28),
      _F('chouchin', 105, 22), _F('noren', 105, 28),
      _F('chouchin', 155, 22), _F('noren', 155, 28),
      _F('chouchin', 178, 22),
      // ─── 上段小物 (パチンコ出玉) ───
      _F('bicycle_row', -145, 72), _F('bicycle_row', -55, 72),
      _F('bicycle_row', 55, 72), _F('dumpster', -175, 72),
      _F('kerbside_vending_pair', -30, 72), _F('kerbside_vending_pair', 78, 72),
      _F('milk_crate_stack', 130, 72),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 下段 facade ───
      _F('sign_board', -108, 118),                              // ゲーセン看板
      _F('sign_board', -55, 118),                               // 銀行看板
      _F('chouchin', 30, 118), _F('noren', 30, 124),
      _F('chouchin', 55, 118), _F('noren', 55, 124),
      _F('sign_board', 105, 118),                               // ゲーセン看板
      _F('chouchin', 155, 118), _F('noren', 155, 124),
      _F('chouchin', 178, 118),
      // ─── 下段小物 ───
      _F('bicycle_row', -148, 172), _F('bicycle_row', -15, 172),
      _F('bicycle_row', 105, 172),
      _F('dumpster', -175, 170), _F('dumpster', 175, 170),
      _F('kerbside_vending_pair', -85, 170),
      _F('atm', -55, 168),                                       // 銀行前 ATM
      _F('traffic_cone', 78, 172), _F('traffic_cone', 85, 172),
      // ─── 水たまり + 街灯 ───
      _F('puddle_reflection', -125, 72), _F('puddle_reflection', 25, 78),
      _F('puddle_reflection', 125, 72),
      _F('puddle_reflection', -130, 170), _F('puddle_reflection', 85, 170),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-145, 72), _H(-55, 72), _H(55, 72),                    // パチンコ行列 3 箇所
      _H(-148, 172), _H(-15, 172), _H(105, 172),                // 下段パチンコ
      _H(0, 72),                                                 // 交番前の警官
      _H(-100, 55), _H(155, 55),                                 // ゲーセン + 居酒屋客
      _H(-55, 170),                                              // ATM 利用者
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -145, 65, 80, 45),                             // パチンコ街タイル
      _G('tile', 55, 65, 70, 45),
      _G('tile', 0, 72, 40, 38),                                // 交番前
      _G('tile', -145, 158, 80, 42),
      _G('tile', -15, 162, 40, 38),
      _G('tile', 105, 162, 60, 38),
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C5: 雑居ビル + 飲み屋横丁 — 3 つの区画で街を構成 ──
  // 街区分け:
  //   上段 西 (x=-180〜-97): 老舗飲み屋横丁 (snack/麻雀/居酒屋が密集)
  //   上段 中 (x=-83〜+83): メインのビジネスホテル区画 (奥に高層、表に 1F 店)
  //   上段 東 (x=+97〜+180): 銀行 + カプセルホテル区画
  //   下段 西: ラブホテル + クラブの派手区画
  //   下段 中: パチンコ + カラオケの娯楽区画
  //   下段 東: ミニシアター + 1F 店の映画街区
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 西 (x=-180〜-97): 老舗飲み屋横丁 ===
      _B('snack', -160, 38),                                    // ピンクの小さなママの店
      _B('mahjong_parlor', -130, 44),                           // 緑看板の老舗雀荘
      _B('izakaya', -105, 40),                                  // 隣の老舗居酒屋
      _B('shed', -172, 76),                                     // 横丁の店裏 (3 軒共用)
      _B('garage', -130, 80),                                   // 古い車庫

      // === 上段 中 (x=-83〜+83): ビジネスホテル区画 ===
      _B('business_hotel', -10, 80),                            // ★ メインのホテル (奥、高層)
      _B('cafe', -60, 40),                                      // ホテル隣のカフェ (1F)
      _B('bookstore', 30, 44),                                  // ホテル隣の書店 (1F)
      _B('ramen', 60, 38),                                      // 反対側のラーメン (1F)
      _B('shed', -45, 75),                                      // ホテル裏の物置
      _B('garage', 50, 78),                                     // ホテル裏の駐車場

      // === 上段 東 (x=+97〜+180): 銀行 + カプセルホテル区画 ===
      _B('bank', 108, 46),                                      // 落ち着いた銀行
      _B('capsule_hotel', 155, 80),                             // ★ 横長カプセル (奥)
      _B('shop', 178, 40),                                      // 角の小売店
      _B('shed', 125, 76),                                      // 銀行裏

      // === 下段 西 (x=-180〜-97): ラブホテル + クラブ派手区画 ===
      _B('love_hotel', -150, 168),                              // ★ 紫派手 (奥)
      _B('club', -108, 170),                                    // ★ 黒金クラブ (奥)
      _B('pharmacy', -110, 132),                                // 24h ドラッグ (表)
      _B('shed', -178, 175),                                    // ラブホ裏
      _B('garage', -160, 178),                                  // ラブホ駐車場

      // === 下段 中 (x=-83〜+83): パチンコ + カラオケ娯楽区画 ===
      _B('pachinko', -50, 142),                                 // ★ メインのパチンコ
      _B('karaoke', 25, 144),                                   // ★ 隣のカラオケ
      _B('restaurant', -10, 132),                               // 娯楽帰りのレストラン
      _B('shed', 60, 175),                                      // 娯楽店裏

      // === 下段 東 (x=+97〜+180): 映画街区 ===
      _B('movie_theater', 130, 168),                            // ★ 奥にシアター
      _B('bakery', 105, 132),                                   // 映画館前のパン屋
      _B('laundromat', 165, 132),                               // ランドリー
      _B('shed', 178, 175),                                     // シアター裏
    ],
    furniture: [
      // ─── 上段 facade (業種ごとに違う看板) ───
      _F('sign_board', -150, 22),                               // office
      _F('banner_pole', -112, 22),                              // apartment_tall
      _F('sign_board', -75, 22),                                // snack ピンク
      _F('sign_board', -48, 22),                                // mahjong_parlor 緑
      _F('chouchin', -20, 22), _F('noren', -20, 28),            // izakaya (唯一)
      _F('sign_board', 15, 22),                                 // club (金)
      _F('chouchin', 55, 22), _F('noren', 55, 28),              // ramen
      _F('sign_board', 98, 22),                                 // bank
      _F('banner_pole', 150, 22),                               // business_hotel
      _F('shop_awning', 178, 28),                               // cafe
      // ─── 上段中間 ───
      _F('kerbside_vending_pair', -90, 72),
      _F('bicycle_row', 30, 75), _F('bicycle_rack', 130, 75),
      _F('dumpster', -180, 72), _F('dumpster', 125, 72),
      _F('milk_crate_stack', -35, 72),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 下段 facade (業種ごと) ───
      _F('sign_board', -148, 118),                              // love_hotel 紫
      _F('a_frame_sign', -110, 118),                            // pharmacy
      _F('flag_pole', -115, 115),
      _F('sign_board', -78, 118),                               // pachinko 派手
      _F('chouchin', -40, 118), _F('noren', -40, 124),          // restaurant
      _F('banner_pole', -12, 118),                              // bookstore
      _F('sign_board', 20, 118),                                // karaoke
      _F('sign_board', 62, 118),                                // movie_theater
      _F('a_frame_sign', 102, 118),                             // bakery
      _F('banner_pole', 138, 118),                              // capsule_hotel
      _F('a_frame_sign', 175, 118),                             // laundromat
      // ─── 下段小物 ───
      _F('bicycle_row', -78, 172), _F('bicycle_row', 62, 172),
      _F('bicycle_rack', 102, 172),
      _F('dumpster', -180, 170), _F('dumpster', 180, 170),
      _F('kerbside_vending_pair', -40, 170),
      _F('car', -148, 170),                                     // ラブホ前のタクシー
      _F('milk_crate_stack', 20, 172),
      // ─── 水たまり ───
      _F('puddle_reflection', -50, 75), _F('puddle_reflection', 60, 75),
      _F('puddle_reflection', 135, 75),
      _F('puddle_reflection', -120, 170), _F('puddle_reflection', 35, 170),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-75, 55),                                              // スナック客
      _H(-20, 55), _H(55, 55),                                  // 居酒屋 + ラーメン客
      _H(15, 55),                                               // クラブ入場
      _H(-150, 82),                                             // オフィス残業帰り
      _H(-148, 172),                                            // ラブホ前
      _H(-78, 152),                                             // パチンコ帰り
      _H(20, 152), _H(62, 152),                                 // カラオケ + 映画客
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -55, 60, 80, 42),                              // 立ち飲み列タイル
      _G('tile', 92, 72, 40, 32),                               // 銀行前
      _G('tile', -88, 158, 180, 42),                            // 横丁全幅タイル
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ═══ Act III: 深夜の路地 (C6-C8) ══════════════════════════════════

  // ── C6: ホテルとキャバレーの街 — 6 区画でホテル街を構成 ──
  // 街区分け:
  //   上段 西: ラブホテル区画 (love_hotel + snack 2 軒)
  //   上段 中: カプセルホテル + 1F 店区画
  //   上段 東: クラブ街区画
  //   下段 西: ビジネスホテル + 1F コンビニ区画
  //   下段 中: パチンコ + 麻雀の娯楽区画
  //   下段 東: ミニシアター街区
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 西: ラブホテル区画 ===
      _B('love_hotel', -150, 70),                               // ★ メインのラブホ (奥、派手)
      _B('snack', -108, 38),                                    // 客引きスナック
      _B('snack', -180, 38),                                    // ★ 端のスナック (色違い隣接 OK)
      _B('garage', -130, 78),                                   // ラブホ駐車場

      // === 上段 中: カプセルホテル + 1F 店区画 ===
      _B('capsule_hotel', -10, 80),                             // ★ 横長カプセル (奥)
      _B('cafe', -60, 40),                                      // 1F カフェ
      _B('bookstore', 30, 44),                                  // 1F 書店
      _B('bakery', 60, 40),                                     // 1F パン屋
      _B('shed', 50, 75),                                       // ホテル裏

      // === 上段 東: クラブ街区画 ===
      _B('club', 145, 70),                                      // ★ 黒金クラブ (奥)
      _B('izakaya', 108, 40),                                   // クラブ隣の老舗居酒屋
      _B('mahjong_parlor', 178, 40),                            // 雀荘
      _B('shed', 130, 78),                                      // クラブ裏
      _B('garage', 175, 78),                                    // クラブ裏

      // === 下段 西: ビジネスホテル + 1F コンビニ区画 ===
      _B('business_hotel', -150, 168),                          // ★ 高層 (奥)
      _B('convenience', -110, 132),                             // 1F コンビニ
      _B('ramen', -180, 132),                                   // 端のラーメン
      _B('shed', -130, 178),                                    // ホテル裏
      _B('garage', -88, 175),                                   // 駐車場

      // === 下段 中: 娯楽区画 (パチンコ + 麻雀) ===
      _B('pachinko', -28, 142),                                 // ★ メイン
      _B('game_center', 12, 138),                               // 隣のゲーセン
      _B('shop', 50, 132),                                      // 駐車場前の小店
      _B('shed', 35, 175),                                      // 娯楽店裏

      // === 下段 東: ミニシアター街区 ===
      _B('movie_theater', 132, 168),                            // ★ 奥にシアター
      _B('pharmacy', 105, 132),                                 // シアター前の 24h ドラッグ
      _B('florist', 165, 132),                                  // 花屋
      _B('shed', 175, 178),                                     // シアター裏
    ],
    furniture: [
      // ─── ★★ シグネチャ: 提灯密集 (全幅連続) ★★ ───
      // 上段 facade を提灯で覆い尽くす
      _F('chouchin', -162, 22), _F('chouchin', -138, 22),
      _F('chouchin', -115, 22), _F('chouchin', -92, 22),
      _F('chouchin', -65, 22), _F('chouchin', -40, 22),
      _F('chouchin', -15, 22), _F('chouchin', 12, 22),
      _F('chouchin', 40, 22), _F('chouchin', 65, 22),
      _F('chouchin', 92, 22), _F('chouchin', 118, 22),
      _F('chouchin', 145, 22), _F('chouchin', 172, 22),
      // 下段 facade も同様に提灯列
      _F('chouchin', -168, 118), _F('chouchin', -142, 118),
      _F('chouchin', -115, 118), _F('chouchin', -90, 118),
      _F('chouchin', -62, 118), _F('chouchin', -38, 118),
      _F('chouchin', -12, 118), _F('chouchin', 15, 118),
      _F('chouchin', 42, 118), _F('chouchin', 68, 118),
      _F('chouchin', 95, 118), _F('chouchin', 120, 118),
      _F('chouchin', 148, 118), _F('chouchin', 175, 118),
      // ─── のれん (中央列に絞る) ───
      _F('noren', -115, 28), _F('noren', -40, 28),
      _F('noren', 40, 28), _F('noren', 118, 28),
      _F('noren', -115, 124), _F('noren', -38, 124),
      _F('noren', 42, 124), _F('noren', 120, 124),
      // ─── 上段小物 ───
      _F('milk_crate_stack', -140, 72), _F('milk_crate_stack', 70, 72),
      _F('bicycle_row', -40, 72), _F('bicycle_row', 80, 72),
      _F('dumpster', -180, 72), _F('dumpster', 180, 72),
      _F('a_frame_sign', 0, 32), _F('a_frame_sign', -95, 32),
      _F('a_frame_sign', 95, 32),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 下段小物 ───
      _F('milk_crate_stack', -90, 172), _F('milk_crate_stack', 120, 172),
      _F('bicycle_row', -150, 172), _F('bicycle_row', 50, 172),
      _F('dumpster', -180, 172), _F('dumpster', 180, 172),
      _F('kerbside_vending_pair', -10, 172), _F('kerbside_vending_pair', 95, 172),
      _F('cat', 65, 195),                                       // ★ 路地の野良猫
      // ─── 水たまり + 街灯 ───
      _F('puddle_reflection', -70, 75), _F('puddle_reflection', 35, 75),
      _F('puddle_reflection', 125, 75),
      _F('puddle_reflection', -100, 172), _F('puddle_reflection', 80, 172),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-115, 55), _H(-40, 55), _H(65, 55),                    // 上段スナック客
      _H(-90, 152), _H(15, 152), _H(95, 152),                   // 下段スナック客
      _H(-140, 172),                                            // よろめく酔客
      _H(120, 55),                                              // 呼び込み
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -60, 60, 280, 42),                             // スナック街上段タイル
      _G('tile', -60, 158, 280, 42),                            // スナック街下段タイル
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C7: 屋台横丁 — 屋台 4-5 台が中央に集約された夜店通り ──
  // 街区分け: 屋台クラスタを中央 (上段中心) に集約し、その周りを夜店で囲む。
  // 背景にはラブホ・ビジネスホテルが奥に控える「夜の終わり」感。
  //   上段 西: 横丁入口 (ramen + snack + 屋台 1)
  //   上段 中: ★ 屋台横丁の核 (yatai 3 台密集 + 立ち飲み)
  //   上段 東: 横丁出口 (bookstore + 居酒屋 + バー)
  //   下段 西: 娯楽区画 (karaoke + game_center)
  //   下段 中: 大型ホテル区画 (love_hotel + business_hotel が奥)
  //   下段 東: ガソリンスタンド + 帰路区画
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 西: 横丁入口 ===
      _B('ramen', -160, 40),                                    // 横丁角のラーメン
      _B('yatai', -130, 32),                                    // ★ 入口の屋台 (手前)
      _B('snack', -105, 44),                                    // ピンクスナック
      _B('shed', -175, 76),                                     // 入口裏

      // === 上段 中: ★ 屋台横丁の核 (yatai 3 台密集) ===
      _B('yatai', -55, 30),                                     // ★ 1 台目 (手前)
      _B('yatai', -25, 30),                                     // ★ 2 台目 (隣接)
      _B('yatai', 5, 30),                                       // ★ 3 台目 (隣接)
      _B('izakaya', 35, 42),                                    // 屋台奥の立ち飲み
      _B('cafe', 65, 38),                                       // 横の夜カフェ
      _B('shed', -25, 76),                                      // 屋台共用倉庫

      // === 上段 東: 横丁出口 (静かな店) ===
      _B('mahjong_parlor', 108, 44),                            // 雀荘
      _B('bookstore', 138, 40),                                 // ブックバー
      _B('pharmacy', 175, 38),                                  // 24h ドラッグ
      _B('garage', 130, 78),                                    // 出口裏

      // === 下段 西: 娯楽区画 ===
      _B('karaoke', -160, 144),                                 // ★ カラオケ
      _B('game_center', -118, 138),                             // ゲーセン
      _B('shed', -175, 178),                                    // 娯楽店裏
      _B('garage', -135, 175),                                  // 駐車場

      // === 下段 中: ★ 大型ホテル区画 (奥に並ぶ) ===
      _B('love_hotel', -55, 168),                               // ★ ラブホ (奥)
      _B('business_hotel', 0, 172),                             // ★ ビジネスホテル (奥)
      _B('club', 50, 170),                                      // ★ クラブ (奥)
      _B('restaurant', -25, 132),                               // 1F レストラン (表)
      _B('snack', 30, 132),                                     // 1F スナック (表、別区画)

      // === 下段 東: ガソリンスタンド + 帰路 ===
      _B('gas_station', 105, 135),                              // ガソスタ
      _B('capsule_hotel', 150, 168),                            // ★ カプセル (奥)
      _B('convenience', 178, 132),                              // 帰路コンビニ
      _B('shed', 130, 178),                                     // ガソスタ裏
    ],
    furniture: [
      // ─── 屋台の湯気 ── noren + chouchin ───
      _F('noren', -120, 22), _F('chouchin', -120, 16),
      _F('noren', -95, 22), _F('chouchin', -95, 16),
      _F('noren', -25, 22), _F('chouchin', -25, 16),
      _F('noren', 45, 22), _F('chouchin', 45, 16),
      _F('noren', 170, 22), _F('chouchin', 170, 16),
      _F('noren', -100, 118), _F('chouchin', -100, 112),
      _F('noren', 20, 118), _F('chouchin', 20, 112),
      // ─── 通常 facade ───
      _F('chouchin', -155, 22), _F('chouchin', -58, 22), _F('chouchin', 10, 22),
      _F('chouchin', 80, 22),
      _F('chouchin', -160, 118), _F('chouchin', -130, 118),
      _F('chouchin', -65, 118), _F('chouchin', -38, 118),
      _F('chouchin', -10, 118), _F('chouchin', 55, 118),
      _F('chouchin', 172, 118),
      _F('sign_board', 135, 22),                                // 高層看板
      // ─── ★★ シグネチャ: 倒れ物 + ゴミ袋 (終電後の荒れ) ★★ ───
      _F('bicycle', -78, 78),                                   // 倒れ自転車
      _F('bicycle', 65, 78),
      _F('bicycle', -80, 172),                                  // 倒れ自転車
      _F('dumpster', -40, 72), _F('dumpster', 30, 72),
      _F('dumpster', -55, 170), _F('dumpster', 95, 170),
      _F('milk_crate_stack', -155, 72), _F('milk_crate_stack', 100, 72),
      _F('milk_crate_stack', 85, 172),
      _F('garbage', 0, 75), _F('garbage', -120, 172),
      _F('garbage', 145, 170),
      _F('traffic_cone', -50, 78), _F('traffic_cone', 55, 78),
      _F('traffic_cone', 60, 172),
      // ─── 上段中間 ───
      _F('kerbside_vending_pair', 115, 72),
      // ─── 電線 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 水たまり + 街灯 ───
      _F('puddle_reflection', -90, 75), _F('puddle_reflection', 40, 78),
      _F('puddle_reflection', 130, 75),
      _F('puddle_reflection', -70, 172), _F('puddle_reflection', 30, 172),
      _F('puddle_reflection', 140, 170),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -45, 100), _F('manhole_cover', 45, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('cat', -120, 80),                                      // ★ 屋台裏の野良猫
      _F('cat', 50, 195),
    ],
    humans: [
      _H(-120, 55), _H(-95, 55),                                // 屋台客 2 組
      _H(-25, 55), _H(45, 55),                                  // 屋台客
      _H(-100, 150), _H(20, 150),                               // 下段屋台客
      _H(-78, 72),                                              // 倒れた酔客
      _H(130, 172),                                             // よろめく通行人
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('tile', -120, 60, 50, 42),                             // 屋台街タイル
      _G('tile', 10, 60, 70, 42),
      _G('tile', -100, 158, 50, 42),
      _G('tile', 10, 158, 50, 42),
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C8: 駐車場と裏通り — 賑わいが消えた静かな区画 ──
  // 街区分け:
  //   上段 西: シャッター古商店街 (snack 閉店、古いアパート)
  //   上段 中: ★ 中央コインパーキング (大広場)
  //   上段 東: 古い雑居ビル + ガレージ
  //   下段 西: ★ もう 1 つの大駐車場 (連結)
  //   下段 中: 雑居オフィスビル + 1F コンビニ
  //   下段 東: 高層雑居 + 端の倉庫
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 西: シャッター街 (廃れた商店) ===
      _B('snack', -160, 38),                                    // 閉店のスナック (シャッター)
      _B('apartment', -125, 78),                                // 古いアパート (奥)
      _B('shop', -108, 38),                                     // 古い小売店 (閉)
      _B('shed', -175, 76),                                     // 店裏

      // === 上段 中: ★ 中央コインパーキング (広場) ===
      _B('parking', -25, 50),                                   // ★ メイン駐車場 (表に大広場)
      _B('shed', -65, 75),                                      // 駐車場脇の物置
      _B('shed', 25, 78),                                       // 駐車場脇

      // === 上段 東: 古い雑居ビル + ガレージ ===
      _B('office', 130, 78),                                    // ★ 古い雑居 (奥)
      _B('mahjong_parlor', 105, 42),                            // 古い雀荘
      _B('garage', 155, 40),                                    // 1F ガレージ
      _B('shed', 175, 78),                                      // 端の倉庫

      // === 下段 西: ★ もう 1 つの大駐車場 (連結) ===
      _B('parking', -130, 148),                                 // ★ 大駐車場
      _B('shed', -178, 178),                                    // 駐車場端
      _B('garage', -85, 175),                                   // 駐車場脇

      // === 下段 中: 雑居オフィスビル + 1F コンビニ ===
      _B('office', -25, 170),                                   // ★ 古い雑居 (奥)
      _B('convenience', 5, 132),                                // 1F の 24h コンビニ (孤独に明かり)
      _B('pharmacy', -55, 132),                                 // 隣の 24h ドラッグ
      _B('shed', 30, 175),                                      // ビル裏

      // === 下段 東: 高層雑居 + 倉庫 ===
      _B('apartment_tall', 150, 175),                           // ★ 高層 (奥)
      _B('cafe', 105, 132),                                     // 1F カフェ
      _B('garage', 175, 132),                                   // ガレージ
      _B('shed', 178, 178),                                     // 倉庫
    ],
    furniture: [
      // ─── 上段 facade (オフィスの看板 + 夜閉まった店) ───
      _F('sign_board', -150, 22), _F('sign_board', 30, 22),
      _F('sign_board', 85, 22),                                 // 高層看板
      _F('a_frame_sign', -45, 22),                              // 駐車場案内
      _F('sign_board', -108, 22),                               // アパート看板
      _F('chouchin', 140, 22),                                  // 倉庫の明かり
      // ─── ★★ シグネチャ: 室外機の唸り + ゴミ山 ★★ ───
      _F('ac_outdoor_cluster', -150, 72),
      _F('ac_outdoor_cluster', 30, 72),
      _F('ac_outdoor_cluster', -108, 72),
      _F('ac_outdoor_cluster', -40, 168),
      _F('ac_outdoor_cluster', 15, 168),
      _F('ac_outdoor_cluster', 150, 178),
      _F('dumpster', -180, 72), _F('dumpster', -15, 72),
      _F('dumpster', 65, 72), _F('dumpster', 180, 72),
      _F('dumpster', -180, 170), _F('dumpster', 50, 172),
      _F('dumpster', 180, 172),
      _F('garbage', -75, 75), _F('garbage', 125, 75),
      _F('garbage', -60, 172), _F('garbage', 120, 172),
      _F('recycling_bin', 5, 75), _F('recycling_bin', -5, 172),
      // ─── コインパーキング (車並び) ───
      _F('car', -55, 65), _F('car', -35, 65), _F('car', -55, 80),
      _F('car', -145, 160), _F('car', -115, 160),
      _F('car', -145, 178), _F('car', -115, 178),
      _F('car', 70, 160), _F('car', 90, 160),
      _F('car', 70, 178), _F('car', 90, 178),
      _F('traffic_cone', -35, 78), _F('traffic_cone', -75, 78),
      _F('traffic_cone', 50, 172), _F('traffic_cone', 110, 172),
      // ─── 電線 + 電柱 ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      _F('electric_box', -55, 102), _F('electric_box', 55, 102),
      // ─── 下段 facade ───
      _F('a_frame_sign', -130, 118),                            // 駐車場案内
      _F('a_frame_sign', 80, 118),
      _F('sign_board', -40, 118), _F('sign_board', 15, 118),
      _F('sign_board', 150, 118),
      _F('chouchin', 175, 118),
      // ─── 野良猫 (静けさの演出) ───
      _F('cat', -75, 78), _F('cat', 45, 195),
      _F('cat', 160, 172),
      // ─── 水たまり ───
      _F('puddle_reflection', -110, 78), _F('puddle_reflection', 75, 78),
      _F('puddle_reflection', -80, 172), _F('puddle_reflection', 130, 172),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
    ],
    humans: [
      _H(-55, 70),                                              // 深夜の駐車場利用者
      _H(80, 160),                                              // もう一人
      _H(-150, 82),                                             // オフィス残業
      _H(15, 152),                                              // コンビニ帰り (見立て)
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 360, 93),
      _G('asphalt', 0, 153.5, 360, 93),
      _G('concrete', -45, 72, 60, 40),                          // パーキング上段床
      _G('concrete', -130, 170, 120, 50),                       // パーキング下段床
      _G('concrete', 80, 170, 60, 50),
      _G('asphalt', 0, 15, 360, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ═══ Act IV: 朝の気配 (C9) — Stage 3 への handoff ═══════════════

  // ── C9: 小さな神社の裏手 — 夜明け前、石灯籠の気配 ──
  // 歓楽街の騒めきが消え、神社の裏手で夜明けを待つ。次ステージ (和風古都) への
  // 予兆として鳥居・石灯籠・松・古民家を配置。人影まばら、野良猫が主役。
  { patternId: 's2_raw', raw: {
    buildings: [
      // === 上段 ─ 前列 (古民家の並びと神社) ===
      _B('kominka', -158, 40),
      _B('kominka', -130, 44),
      _B('shrine', -75, 48),                                    // ★ 小さな神社 (奥)
      _B('chaya', -30, 38),
      _B('kominka', 0, 42),
      _B('apartment', 55, 52),                                  // 古アパート (奥)
      _B('kominka', 105, 40),
      _B('chaya', 130, 44),
      // === 上段 ─ 奥列 (物置/小屋/温室) ===
      _B('shed', -175, 70),
      _B('greenhouse', -115, 74),                               // 古い温室
      _B('shed', -60, 78),
      _B('shed', 25, 72),
      _B('shed', 80, 76),
      _B('greenhouse', 148, 78),
      _B('shed', 175, 70),
      // === 下段 ─ 前列 (境内 + 古民家) ===
      _B('kominka', -160, 132),
      _B('kominka', -135, 138),
      _B('shrine', -75, 146),                                   // ★ 摂社 (奥)
      _B('kominka', -25, 132),
      _B('chaya', 5, 138),
      _B('kominka', 48, 130),
      _B('house', 75, 134),
      _B('kominka', 120, 132),
      _B('kominka', 148, 138),
      // === 下段 ─ 奥列 (物置/小さな家) ===
      _B('shed', -178, 172),
      _B('greenhouse', -105, 178),
      _B('shed', -45, 174),
      _B('garage', 25, 172),
      _B('shed', 88, 178),
      _B('shed', 175, 174),
    ],
    furniture: [
      // ─── ★★ シグネチャ: 鳥居 + 石灯籠の列 (Stage 3 予兆) ★★ ───
      _F('torii', -75, 22),                                     // ★ 上段神社の鳥居
      _F('torii', -75, 118),                                    // ★ 下段摂社の鳥居
      _F('stone_lantern', -95, 72), _F('stone_lantern', -55, 72),
      _F('stone_lantern', -95, 170), _F('stone_lantern', -55, 170),
      _F('stone_lantern', 90, 72), _F('stone_lantern', 120, 172),
      _F('shinto_rope', -75, 28),                               // しめ縄
      _F('shinto_rope', -75, 124),
      _F('offering_box', -75, 75),                              // 賽銭箱
      _F('koma_inu', -90, 78), _F('koma_inu', -60, 78),         // 狛犬
      // ─── 松 + 桜 (和風の縦軸) ───
      _F('pine_tree', -170, 80), _F('pine_tree', 175, 80),
      _F('pine_tree', -170, 175), _F('pine_tree', 175, 175),
      _F('sakura_tree', -105, 165),                             // 桜古木
      _F('sakura_tree', 60, 65),
      // ─── 古民家 facade (提灯は消え、mailbox と wood_fence) ───
      _F('wood_fence', -178, 22), _F('wood_fence', 178, 22),
      _F('wood_fence', -178, 118), _F('wood_fence', 178, 118),
      _F('mailbox', -158, 22), _F('mailbox', -130, 22),
      _F('mailbox', 0, 22), _F('mailbox', 105, 22), _F('mailbox', 130, 22),
      _F('mailbox', -160, 118), _F('mailbox', -135, 118),
      _F('mailbox', 48, 118), _F('mailbox', 120, 118), _F('mailbox', 148, 118),
      _F('noren', -30, 28), _F('noren', 5, 124),                // 茶屋ののれん
      // ─── 境内の装飾 ───
      _F('bonsai', -95, 30), _F('bonsai', 95, 172),
      _F('bamboo_cluster', 55, 75), _F('bamboo_cluster', 75, 168),
      _F('potted_plant', -158, 30), _F('potted_plant', 0, 28),
      _F('potted_plant', -25, 120), _F('potted_plant', 148, 120),
      // ─── ゴミ収集車が来る朝 (handoff 演出) ───
      _F('car', 160, 172),                                      // ゴミ収集車 (見立て)
      _F('dumpster', -180, 172), _F('dumpster', 180, 172),
      _F('garbage', 170, 170),
      // ─── 電線 (街の気配の最後) ───
      _F('power_pole', -175, 92), _F('power_line', -178, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -175, 195), _F('power_line', -178, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 野良猫の時間 (★★ Stage 2 最後の主役) ★★ ───
      _F('cat', -70, 80),                                       // 賽銭箱の前
      _F('cat', -70, 170),                                      // 摂社の前
      _F('cat', 40, 195),                                       // 境内奥
      _F('cat', 150, 190),
      // ─── 水たまり (まだ夜の痕跡) ───
      _F('puddle_reflection', -110, 100), _F('puddle_reflection', 110, 100),
      _F('puddle_reflection', 0, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      // ─── 朝の手水 (Stage 3 への予兆) ───
      _F('temizuya', -60, 65),                                  // 手水舎
      _F('bamboo_water_fountain', -55, 165),                    // 竹の鹿威し
      _F('sando_stone_pillar', -178, 100),                      // 参道の石柱
      _F('sando_stone_pillar', 178, 100),
    ],
    humans: [
      _H(-75, 78),                                              // 早朝の参拝者
      _H(-75, 172),                                             // 境内の老人
      _H(160, 170),                                             // ゴミ収集業者
      _H(5, 152),                                               // 茶屋の女将
      _H(-30, 55),                                              // 朝の散歩
    ],
    grounds: [
      _G('asphalt', 0, 46.5, 180, 93),                          // 左半は asphalt (街の名残)
      _G('gravel', 90, 46.5, 180, 93),                          // ★ 右半は玉砂利 (Stage 3 予兆)
      _G('gravel', 0, 153.5, 360, 93),                          // 下段は全面玉砂利
      _G('stone_pavement', -75, 65, 50, 40),                    // 神社の参道
      _G('stone_pavement', -75, 170, 50, 55),                   // 摂社の参道
      _G('moss', 40, 180, 40, 20),                              // 苔 (古都の気配)
      _G('asphalt', 0, 15, 120, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
];

// ─── Stage 3: 和風・古都 (12 チャンク, raw 配置) ─────────────────
// 【全体の物語】: Stage 2 の神社裏手を越え、古都の参道から寺院境内を経て
// 古民家集落を抜け、Stage 4 (港湾) へ。
//   Act I  (C0-C2):  参道の始まり — 大鳥居 → 門前町 → 茶屋街
//   Act II (C3-C5):  旅館街・温泉街
//   Act III(C6-C8):  寺院境内 — 五重塔 → 本堂 → 多宝塔
//   Act IV (C9-C11): 古民家集落 → Stage 4 handoff
// 【連続軸】: 中央 avenue の玉砂利参道 + 石灯籠の並び /
//           桜並木 (Act I-II) → 松並木 (Act III-IV) /
//           竹垣 + 古い塀
const STAGE_3_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 参道の始まり (C0-C2) ═══════════════════════════════

  // ── C0: 大鳥居 + 参道の入口 ──
  // 街区分け:
  //   上段 西: 茶屋街入口 (chaya/kominka)
  //   上段 中: ★ 大鳥居 (torii) + 参道の導入 + 狛犬
  //   上段 東: 古民家の並び (kominka + machiya 奥)
  //   下段 西: 土蔵の並び (kura クラスタ)
  //   下段 中: 参道続き + 小さな摂社
  //   下段 東: 茶屋 + 多宝塔 (ランドマーク予告)
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 茶屋街入口 (和菓子+寿司+茶屋) ===
      _B('chaya', -160, 40),                                    // 茶屋 (唯一)
      _B('wagashi', -132, 46),                                  // ★ 和菓子屋
      _B('sushi_ya', -106, 40),                                 // ★ 寿司屋
      _B('kura', -170, 78),                                     // 奥に蔵
      _B('shed', -125, 76),

      // === 上段 中: ★ 大鳥居 + 参道 (茶店と土産) ===
      _B('chaya', -60, 38),                                     // 参道脇の茶店
      _B('kimono_shop', -30, 42),                               // ★ 呉服屋
      _B('wagashi', 30, 44),                                    // ★ 和菓子 2 軒目は別区画
      _B('sushi_ya', 62, 38),                                   // ★ 寿司屋 (離れた位置)
      _B('kura', -50, 78),                                      // 奥の蔵
      _B('shed', 55, 78),

      // === 上段 東: 古民家と町家の並び ===
      _B('kominka', 108, 42),                                   // 古民家 (唯一)
      _B('machiya', 138, 48),                                   // ★ 町家
      _B('kimono_shop', 170, 42),                               // ★ 呉服屋 (別区画)
      _B('machiya', 145, 78),                                   // 奥の町家

      // === 下段 西: ★ 土蔵と武道場 ===
      _B('kura', -162, 130),                                    // 蔵
      _B('dojo', -130, 138),                                    // ★ 道場 (大きめ)
      _B('shed', -178, 175),
      _B('greenhouse', -100, 178),

      // === 下段 中: 参道続き + 摂社 ===
      _B('shrine', -35, 152),                                   // ★ 小さな摂社 (奥)
      _B('chaya', 5, 132),
      _B('wagashi', 42, 136),                                   // ★ 参道の和菓子屋
      _B('shed', 20, 178),

      // === 下段 東: 茶屋 + 多宝塔 ===
      _B('sushi_ya', 105, 132),                                 // ★ 寿司屋
      _B('kominka', 138, 138),                                  // 古民家 (別区画 1 軒のみ)
      _B('tahoto', 168, 170),                                   // ★ 多宝塔 (奥、ランドマーク予告)
      _B('shed', 125, 178),
    ],
    furniture: [
      // ─── ★★ シグネチャ: 大鳥居 + しめ縄 (中央) ★★ ───
      _F('torii', 0, 30),                                       // ★ 大鳥居
      _F('shinto_rope', 0, 38),
      _F('koma_inu', -22, 82), _F('koma_inu', 22, 82),          // 狛犬
      _F('sando_stone_pillar', -80, 100),
      _F('sando_stone_pillar', 80, 100),
      // ─── 軸: 石灯籠の参道帯 (avenue 沿い、全チャンク共通) ───
      _F('stone_lantern', -80, 90), _F('stone_lantern', 80, 90),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 桜並木 (Act I-II 前半のしるし) ───
      _F('sakura_tree', -170, 65), _F('sakura_tree', 170, 65),
      _F('sakura_tree', -60, 95), _F('sakura_tree', 60, 95),
      _F('sakura_tree', -170, 162), _F('sakura_tree', 170, 162),
      // ─── 茶屋の装飾 (上段 西) ───
      _F('noren', -160, 28), _F('noren', -132, 34),
      _F('chouchin', -160, 22),
      _F('bonsai', -108, 30),
      _F('potted_plant', -132, 28),
      _F('bamboo_fence', -95, 48),
      // ─── 参道脇の装飾 ───
      _F('bamboo_fence', -80, 50), _F('bamboo_fence', 80, 50),
      _F('offering_box', -22, 80),
      // ─── 古民家区画 (上段東) ───
      _F('bamboo_cluster', 108, 30), _F('bamboo_cluster', 138, 30),
      _F('potted_plant', 168, 32),
      _F('wood_fence', 180, 42),
      // ─── 下段 西 (蔵) ───
      _F('bamboo_fence', -165, 118),
      _F('rock', -170, 115),
      _F('stone_lantern', -108, 120),
      // ─── 下段 中 (摂社) ───
      _F('torii', -35, 128),                                    // 摂社の小鳥居
      _F('stone_lantern', -58, 168), _F('stone_lantern', -15, 168),
      _F('ema_rack', -35, 172),
      _F('temizuya', -5, 165),
      _F('shinto_rope', -35, 140),
      // ─── 下段 東 (茶屋+塔) ───
      _F('bonsai', 108, 122),
      _F('noren', 108, 128),
      _F('bamboo_cluster', 170, 160),
      _F('stone_lantern', 155, 168),
      _F('rock', 178, 165),
      _F('sando_stone_pillar', 178, 180),
    ],
    humans: [
      _H(-160, 55),                                             // 茶屋客
      _H(-132, 60),
      _H(0, 82),                                                 // 参道の参拝者
      _H(108, 55),
      _H(-35, 168),                                             // 摂社の参拝者
      _H(5, 152),
      _H(108, 155),
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),                            // ★ 中央の玉砂利参道 (全幅)
      _G('stone_pavement', -140, 60, 80, 42),                   // 茶屋街の石畳 (上段西)
      _G('stone_pavement', 140, 60, 80, 42),                    // 古民家街の石畳 (上段東)
      _G('stone_pavement', -140, 160, 80, 42),                  // 蔵街の石畳 (下段西)
      _G('moss', -35, 165, 55, 40),                             // 摂社の苔
      _G('stone_pavement', 140, 160, 80, 42),                   // 茶屋街の石畳 (下段東)
      _G('gravel', 0, 15, 220, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C1: 門前町 — 茶屋と土産物屋が並ぶ商店街 ──
  // 街区分け:
  //   上段 西: 茶屋の並び + 和菓子屋
  //   上段 中: 門前町のメインストリート (chaya 密集 + kominka)
  //   上段 東: 土産物屋 (machiya + kominka)
  //   下段 西: 旅館の入口 (ryokan + kura)
  //   下段 中: 路地と小さな料亭
  //   下段 東: 茶屋の奥座敷 + 小さな祠
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 茶屋 + 和菓子屋 ===
      _B('chaya', -162, 40),                                    // 茶屋 (唯一)
      _B('wagashi', -132, 44),                                  // ★ 和菓子屋
      _B('bookstore', -108, 40),                                // 古書店 (和風アレンジ)
      _B('kura', -172, 78),                                     // 蔵 (奥)
      _B('shed', -130, 76),

      // === 上段 中: 門前町メイン (多彩な小店) ===
      _B('sushi_ya', -62, 42),                                  // ★ 寿司屋
      _B('kominka', -30, 40),                                   // 古民家 (唯一)
      _B('kimono_shop', 30, 44),                                // ★ 呉服屋
      _B('dojo', 62, 40),                                       // ★ 道場
      _B('machiya', -45, 78),                                   // 奥の 2F 町家
      _B('shed', 15, 76),

      // === 上段 東: 土産物屋 ===
      _B('machiya', 108, 74),                                   // ★ 2F 町家 (奥)
      _B('wagashi', 135, 42),                                   // ★ 和菓子 (別区画)
      _B('chaya', 168, 40),                                     // 茶屋 (別区画)
      _B('shed', 150, 78),

      // === 下段 西: 旅館入口 ===
      _B('ryokan', -145, 150),                                  // ★ 大きな旅館
      _B('kimono_shop', -100, 132),                             // ★ 呉服屋 (旅館隣)
      _B('kura', -178, 175),                                    // 裏の蔵 (唯一)
      _B('shed', -115, 178),

      // === 下段 中: 路地と料亭 ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画)
      _B('sushi_ya', 5, 138),                                   // ★ 寿司屋 (別区画)
      _B('wagashi', 40, 132),                                   // ★ 和菓子屋 (別区画)
      _B('dojo', -20, 175),                                     // 奥の道場 (別区画)
      _B('shed', 58, 178),

      // === 下段 東: 茶屋の奥 + 祠 ===
      _B('kominka', 108, 132),                                  // 古民家 (別区画)
      _B('machiya', 138, 138),                                  // 町家 (別区画)
      _B('shrine', 168, 160),                                   // ★ 奥の小さな祠
      _B('shed', 125, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠の参道帯 ───
      _F('stone_lantern', -80, 90), _F('stone_lantern', 80, 90),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      _F('sando_stone_pillar', -80, 100),
      _F('sando_stone_pillar', 80, 100),
      // ─── 軸: 桜並木 ───
      _F('sakura_tree', -170, 62), _F('sakura_tree', 170, 62),
      _F('sakura_tree', 0, 92),                                 // 参道の中央
      _F('sakura_tree', -170, 160), _F('sakura_tree', 170, 160),
      // ─── 門前町の提灯ガーランド (横丁感) ───
      _F('chouchin', -160, 22), _F('chouchin', -130, 22),
      _F('chouchin', -60, 28), _F('chouchin', -30, 28),
      _F('chouchin', 30, 28), _F('chouchin', 60, 28),
      _F('chouchin', 138, 28),
      // ─── 茶屋の装飾 ───
      _F('noren', -162, 28), _F('noren', -132, 34),
      _F('noren', -62, 30), _F('noren', 30, 30),
      _F('noren', 168, 28),
      _F('noren', -38, 122), _F('noren', 138, 128),
      _F('bonsai', -108, 30), _F('bonsai', 108, 122),
      _F('potted_plant', -30, 30), _F('potted_plant', 62, 30),
      _F('a_frame_sign', -108, 32),                             // 土産物の立て看板
      _F('a_frame_sign', 108, 132),
      // ─── 竹垣 + 小物 ───
      _F('bamboo_fence', -95, 50), _F('bamboo_fence', 95, 50),
      _F('bamboo_fence', -95, 150), _F('bamboo_fence', 95, 150),
      _F('bamboo_cluster', -172, 32), _F('bamboo_cluster', 172, 35),
      _F('bamboo_cluster', 170, 150),
      _F('rock', 135, 162),
      // ─── 旅館の装飾 (下段 西) ───
      _F('stone_lantern', -145, 130),
      _F('noren', -145, 138),
      _F('chouchin', -145, 132),
      _F('shinto_rope', -145, 124),
      // ─── 祠 (下段 東) ───
      _F('torii', 168, 148),
      _F('offering_box', 168, 170),
      _F('stone_lantern', 155, 170),
      _F('ema_rack', 178, 168),
      // ─── 歩き石 ───
      _F('stepping_stones', -20, 165),
      _F('stepping_stones', 80, 165),
    ],
    humans: [
      _H(-132, 55),                                             // 和菓子屋客
      _H(-30, 60),                                              // 門前町通り
      _H(62, 60),
      _H(-145, 170),                                            // 旅館受付
      _H(-38, 152),                                             // 料亭客
      _H(138, 158),                                             // 奥座敷
      _H(168, 172),                                             // 祠参拝
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),                            // 中央参道
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', 140, 60, 80, 42),
      _G('stone_pavement', -140, 160, 80, 42),
      _G('stone_pavement', 140, 160, 80, 42),
      _G('wood_deck', 0, 60, 120, 42),                          // ★ 中央の木道 (門前町)
      _G('wood_deck', 0, 160, 120, 42),
      _G('gravel', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C2: 茶屋街深部 + 小さな神社 ──
  // 街区分け:
  //   上段 西: 茶屋密集 (chaya クラスタ)
  //   上段 中: 山門風の小さな神社 (shrine + 石庭)
  //   上段 東: 町家の並び (machiya クラスタ)
  //   下段 西: 古民家と竹林
  //   下段 中: 参道の広場 + 手水舎
  //   下段 東: 土蔵の裏路地
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 茶屋 + 呉服 + 寿司 (多彩な小店) ===
      _B('chaya', -162, 40),                                    // 茶屋 (唯一)
      _B('kimono_shop', -132, 46),                              // ★ 呉服屋
      _B('sushi_ya', -108, 42),                                 // ★ 寿司屋
      _B('kura', -170, 78),                                     // 蔵
      _B('shed', -130, 76),

      // === 上段 中: ★ 山門風の小さな神社 ===
      _B('shrine', -22, 55),                                    // ★ 神社 (avenue 脇)
      _B('shrine', 22, 55),                                     // 対の摂社
      _B('wagashi', -55, 42),                                   // ★ 参道脇の和菓子屋
      _B('dojo', 55, 44),                                       // ★ 参道脇の道場
      _B('shed', -10, 78),

      // === 上段 東: 町家クラスタ ===
      _B('machiya', 115, 70),                                   // ★ 町家 (奥)
      _B('kominka', 105, 42),                                   // 古民家 (唯一)
      _B('bookstore', 138, 42),                                 // 古書店
      _B('wagashi', 168, 40),                                   // ★ 和菓子 (別区画)
      _B('shed', 178, 78),

      // === 下段 西: 和風の庭付き家 + 竹林 ===
      _B('kominka', -162, 132),                                 // 古民家 (唯一)
      _B('ryokan', -120, 150),                                  // ★ 小旅館
      _B('kura', -178, 175),
      _B('shed', -100, 178),

      // === 下段 中: 参道の広場 ===
      _B('chaya', -40, 132),                                    // 茶屋 (別区画)
      _B('sushi_ya', 5, 138),                                   // ★ 寿司屋 (別区画)
      _B('wagashi', 45, 132),                                   // ★ 和菓子 (別区画)
      _B('dojo', 22, 175),                                      // 奥の道場 (別区画)

      // === 下段 東: 土蔵と町家の裏路地 ===
      _B('kura', 108, 130),                                     // 蔵 (唯一)
      _B('kimono_shop', 138, 136),                              // ★ 呉服屋 (別区画)
      _B('machiya', 170, 170),                                  // ★ 奥の町家 (別区画)
      _B('shed', 125, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠の参道帯 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 100), _F('stone_lantern', 40, 100),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      _F('sando_stone_pillar', -80, 102),
      _F('sando_stone_pillar', 80, 102),
      // ─── 軸: 桜並木 ───
      _F('sakura_tree', -170, 62), _F('sakura_tree', 170, 62),
      _F('sakura_tree', -60, 95), _F('sakura_tree', 60, 95),
      _F('sakura_tree', -170, 160), _F('sakura_tree', 170, 160),
      // ─── ★ 中央の神社 (上段中) ───
      _F('torii', -22, 40), _F('torii', 22, 40),                // 双鳥居
      _F('koma_inu', -35, 80), _F('koma_inu', 35, 80),
      _F('offering_box', 0, 82),
      _F('shinto_rope', -22, 48), _F('shinto_rope', 22, 48),
      _F('omikuji_stand', -22, 72),
      _F('ema_wall', 22, 72),
      _F('shrine_fence_red', -55, 55),
      _F('shrine_fence_red', 55, 55),
      // ─── 茶屋の装飾 (上段 西) ───
      _F('noren', -162, 28), _F('noren', -132, 34),
      _F('noren', -108, 30),
      _F('chouchin', -162, 22), _F('chouchin', -108, 22),
      _F('bonsai', -132, 30),
      // ─── 町家の装飾 (上段 東) ───
      _F('noren', 105, 30), _F('noren', 135, 30),
      _F('chouchin', 105, 22),
      _F('bamboo_cluster', 178, 32),
      _F('wood_fence', 180, 70),
      // ─── ★ 竹林クラスタ (下段 西) ───
      _F('bamboo_cluster', -178, 120),
      _F('bamboo_cluster', -162, 122),
      _F('bamboo_cluster', -162, 175),
      _F('bamboo_fence', -95, 150),
      // ─── 参道の手水 + 石 (下段 中) ───
      _F('temizuya', -22, 150),                                 // ★ 手水舎
      _F('bamboo_water_fountain', 22, 155),                     // ★ 鹿威し
      _F('stepping_stones', 0, 165),
      _F('rock', -45, 162), _F('rock', 45, 162),
      _F('bonsai', 5, 122),
      // ─── 下段 東 (蔵の裏路地) ───
      _F('bamboo_fence', 108, 118),
      _F('bamboo_fence', 138, 118),
      _F('rock', 170, 160),
      _F('stone_lantern', 155, 168),
    ],
    humans: [
      _H(-162, 55), _H(-108, 55),                               // 茶屋客
      _H(-22, 82),                                              // 神社参拝
      _H(22, 82),
      _H(115, 75),                                              // 町家住人
      _H(-135, 152),                                            // 古民家路地
      _H(-22, 155),                                             // 手水舎で清めの人
      _H(108, 152),                                             // 蔵前
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),                            // 中央参道
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', -22, 70, 90, 22),                    // 神社の石畳
      _G('stone_pavement', 22, 70, 90, 22),
      _G('stone_pavement', 140, 60, 80, 42),
      _G('moss', -22, 82, 70, 30),                              // ★ 神社の苔庭
      _G('stone_pavement', -140, 160, 80, 42),
      _G('moss', 0, 160, 90, 42),                               // ★ 中央広場の苔
      _G('stone_pavement', 140, 160, 80, 42),
      _G('gravel', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act II: 旅館街・温泉街 (C3-C5) ═══════════════════════════════

  // ── C3: 老舗旅館通り ──
  // 街区分け:
  //   上段 西: 老舗旅館 (ryokan メイン + 表の茶屋)
  //   上段 中: 料亭と居酒屋 (chaya 密集)
  //   上段 東: 2 軒目の旅館 (ryokan + kura)
  //   下段 西: 古民家と蔵 (kominka + kura)
  //   下段 中: 庭園 (koi_pond 中心の茶屋)
  //   下段 東: 町家の並び (machiya クラスタ)
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: ★ 老舗旅館 ===
      _B('ryokan', -148, 50),                                   // ★ 大きな旅館
      _B('chaya', -105, 38),
      _B('kura', -172, 78),                                     // 旅館の蔵 (奥)
      _B('shed', -130, 78),

      // === 上段 中: 料亭 ===
      _B('chaya', -55, 40),
      _B('kominka', -25, 44),
      _B('chaya', 25, 40),
      _B('kominka', 55, 44),
      _B('shed', 0, 78),

      // === 上段 東: 2 軒目の旅館 ===
      _B('ryokan', 132, 52),                                    // ★ 2 軒目
      _B('chaya', 170, 38),
      _B('kura', 100, 78),                                      // 蔵 (奥)
      _B('shed', 165, 78),

      // === 下段 西: 古民家と蔵 ===
      _B('kominka', -162, 132),
      _B('kominka', -132, 138),
      _B('kura', -105, 132),
      _B('shed', -178, 175),
      _B('greenhouse', -135, 178),

      // === 下段 中: 庭園の茶屋 ===
      _B('chaya', -38, 132),
      _B('chaya', 38, 132),                                     // 対の茶屋
      _B('kominka', 5, 138),
      _B('shed', -15, 178),

      // === 下段 東: 町家クラスタ ===
      _B('machiya', 108, 168),                                  // ★ 町家 (奥)
      _B('machiya', 148, 170),                                  // ★
      _B('kominka', 108, 132),
      _B('chaya', 138, 136),
      _B('kura', 175, 132),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 桜並木 ───
      _F('sakura_tree', -170, 62), _F('sakura_tree', 170, 62),
      _F('sakura_tree', -60, 95), _F('sakura_tree', 60, 95),
      _F('sakura_tree', -170, 160), _F('sakura_tree', 170, 160),
      // ─── 旅館の装飾 (上段 西) ───
      _F('stone_lantern', -148, 72),
      _F('noren', -148, 38),
      _F('chouchin', -148, 30), _F('chouchin', -105, 30),
      _F('shinto_rope', -148, 22),
      _F('bonsai', -105, 30),
      _F('stepping_stones', -130, 82),
      // ─── 料亭の装飾 (上段 中) ───
      _F('noren', -55, 30), _F('noren', 25, 30),
      _F('chouchin', -25, 30), _F('chouchin', 55, 30),
      _F('potted_plant', 0, 30),
      _F('bamboo_cluster', -15, 50),
      // ─── 2 軒目旅館 (上段 東) ───
      _F('stone_lantern', 132, 72),
      _F('noren', 132, 38),
      _F('chouchin', 132, 30), _F('chouchin', 170, 30),
      _F('shinto_rope', 132, 22),
      _F('bamboo_fence', 95, 50),
      // ─── 古民家・蔵 (下段 西) ───
      _F('bamboo_fence', -162, 118),
      _F('bamboo_fence', -105, 118),
      _F('potted_plant', -132, 122),
      _F('stone_lantern', -140, 168),
      // ─── ★ 庭園 (下段 中) ───
      _F('koi_pond', 0, 162),                                   // ★ 鯉の池
      _F('stepping_stones', -18, 170),
      _F('stepping_stones', 18, 170),
      _F('rock', -25, 172), _F('rock', 25, 172),
      _F('bonsai', -38, 122), _F('bonsai', 38, 122),
      _F('sakura_tree', -8, 175),
      _F('bamboo_water_fountain', 20, 158),
      _F('stone_lantern', -50, 170),
      // ─── 町家区画 (下段 東) ───
      _F('bamboo_fence', 95, 150),
      _F('bonsai', 108, 122), _F('bonsai', 138, 124),
      _F('wood_fence', 180, 170),
      _F('sakura_tree', 170, 150),
    ],
    humans: [
      _H(-148, 82),                                             // 旅館受付
      _H(-25, 60),                                              // 料亭客
      _H(25, 60),
      _H(132, 82),                                              // 2 軒目旅館
      _H(-132, 152),                                            // 古民家住人
      _H(0, 172),                                               // 庭園で鯉に餌
      _H(108, 152),                                             // 町家前
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),
      _G('wood_deck', -148, 72, 50, 42),                        // 旅館縁側
      _G('wood_deck', 132, 72, 50, 42),                         // 2 軒目旅館縁側
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', 140, 60, 80, 42),
      _G('stone_pavement', 0, 60, 100, 42),                     // 中央石畳
      _G('stone_pavement', -140, 160, 80, 42),
      _G('moss', 0, 168, 120, 32),                              // ★ 庭園の苔
      _G('stone_pavement', 140, 160, 80, 42),
      _G('gravel', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C4: ★ 温泉街 ──
  // 街区分け:
  //   上段 西: 小さな旅館 + 蔵 (kura クラスタ)
  //   上段 中: ★ 温泉旅館 (onsen_inn メイン、湯気の煙突)
  //   上段 東: 2 軒目の温泉旅館 + 土産物
  //   下段 西: 竹林の小径
  //   下段 中: 露天風呂風の庭 (koi_pond + 石庭)
  //   下段 東: 町家の並び
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 小旅館 + 蔵 ===
      _B('ryokan', -150, 46),
      _B('kura', -108, 40),                                     // 隣の蔵
      _B('kura', -172, 78),                                     // 奥の蔵
      _B('kura', -128, 78),
      _B('shed', -95, 80),

      // === 上段 中: ★★ 温泉旅館 ★★ ===
      _B('onsen_inn', 0, 68),                                   // ★ 大温泉 (中央、奥)
      _B('chaya', -55, 38),                                     // 1F の茶屋
      _B('chaya', 55, 42),
      _B('shed', -30, 78),
      _B('shed', 30, 76),

      // === 上段 東: 2 軒目温泉 + 土産物 ===
      _B('onsen_inn', 138, 68),                                 // ★ 2 軒目温泉 (奥)
      _B('kominka', 108, 38),                                   // 土産物
      _B('chaya', 178, 42),
      _B('kura', 170, 78),

      // === 下段 西: 竹林の小径 ===
      _B('kominka', -162, 132),
      _B('kominka', -135, 136),
      _B('chaya', -108, 138),
      _B('shed', -178, 175),

      // === 下段 中: ★ 露天風呂風の庭 ===
      _B('chaya', -40, 132),                                    // 茶屋
      _B('chaya', 40, 132),
      _B('shed', -10, 170),
      _B('shed', 15, 175),

      // === 下段 東: 町家の並び ===
      _B('machiya', 108, 170),                                  // ★ 町家 (奥)
      _B('machiya', 148, 172),
      _B('kominka', 108, 132),
      _B('chaya', 138, 138),
      _B('kura', 175, 132),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 桜並木 ───
      _F('sakura_tree', -170, 62), _F('sakura_tree', 170, 62),
      _F('sakura_tree', -170, 160), _F('sakura_tree', 170, 160),
      // ─── ★ 温泉街のしるし (暖簾 + 湯気は onsen_inn 内) ───
      _F('noren', 0, 30),                                       // 大きな藍染のれん
      _F('chouchin', -20, 22), _F('chouchin', 20, 22),
      _F('shinto_rope', 0, 14),
      _F('stone_lantern', -22, 78), _F('stone_lantern', 22, 78),
      // ─── 西クラスタ (蔵の装飾) ───
      _F('bamboo_fence', -150, 32),
      _F('bamboo_fence', -105, 32),
      _F('rock', -128, 65),
      _F('stone_lantern', -150, 70),
      // ─── 中クラスタ (1F 茶屋) ───
      _F('noren', -55, 28), _F('noren', 55, 32),
      _F('bamboo_cluster', -70, 50), _F('bamboo_cluster', 70, 50),
      _F('bonsai', -30, 30),
      _F('potted_plant', 30, 30),
      // ─── 東クラスタ (2 軒目温泉) ───
      _F('noren', 138, 30),
      _F('chouchin', 108, 22), _F('chouchin', 178, 22),
      _F('bamboo_fence', 120, 50),
      _F('stone_lantern', 138, 78),
      // ─── ★ 竹林の小径 (下段 西) ───
      _F('bamboo_cluster', -178, 120),
      _F('bamboo_cluster', -170, 125),
      _F('bamboo_cluster', -160, 175),
      _F('bamboo_cluster', -120, 175),
      _F('bamboo_fence', -95, 150),
      // ─── ★★ 露天風呂の庭 (下段 中) ★★ ───
      _F('koi_pond', -8, 158),                                  // ★ 露天池
      _F('rock', -28, 160), _F('rock', 28, 162),
      _F('stepping_stones', 0, 170),
      _F('bamboo_water_fountain', -28, 172),                    // ★ 鹿威し
      _F('sakura_tree', 0, 182),
      _F('stone_lantern', -40, 168), _F('stone_lantern', 40, 168),
      _F('bonsai', 40, 122),
      // ─── 東クラスタ (町家) ───
      _F('bamboo_fence', 95, 150),
      _F('wood_fence', 180, 170),
      _F('bonsai', 108, 122), _F('bonsai', 138, 124),
    ],
    humans: [
      _H(-150, 60),                                             // 小旅館客
      _H(0, 82),                                                // 温泉帰り (浴衣)
      _H(-55, 55),
      _H(138, 82),                                              // 2 軒目温泉
      _H(-108, 152),                                            // 竹林散歩
      _H(-8, 168),                                              // 露天風呂の縁で
      _H(108, 152),
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),
      _G('stone_pavement', -140, 60, 80, 42),
      _G('wood_deck', 0, 60, 100, 42),                          // 温泉旅館の縁側
      _G('stone_pavement', 140, 60, 80, 42),
      _G('wood_deck', 138, 72, 50, 30),                         // 2 軒目縁側
      _G('moss', -140, 160, 80, 42),                            // ★ 竹林の苔
      _G('moss', 0, 160, 120, 42),                              // ★ 露天庭の苔
      _G('stone_pavement', 140, 160, 80, 42),
      _G('gravel', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C5: 裏路地の摂社 + 古民家 ──
  // 街区分け:
  //   上段 西: 古民家の並び (kominka クラスタ)
  //   上段 中: ★ 裏の摂社 (shrine + 石庭)
  //   上段 東: 町家 + 蔵
  //   下段 西: 旅館の裏手 + 蔵
  //   下段 中: 小さな茶屋の広場
  //   下段 東: 町家集落 + 竹垣
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 古民家クラスタ ===
      _B('kominka', -162, 40),
      _B('kominka', -132, 44),
      _B('kominka', -108, 40),                                  // 古民家 3 連
      _B('kura', -172, 78),
      _B('greenhouse', -128, 78),

      // === 上段 中: ★ 裏の摂社 ===
      _B('shrine', -25, 55),                                    // ★ 摂社 (avenue 左脇)
      _B('temple', 30, 60),                                     // ★ 小さな寺 (avenue 右脇)
      _B('kominka', -62, 42),
      _B('chaya', 62, 38),
      _B('shed', -10, 78),
      _B('shed', 15, 78),

      // === 上段 東: 町家 + 蔵 ===
      _B('machiya', 108, 72),                                   // ★ 町家 (奥)
      _B('kominka', 138, 40),
      _B('kura', 170, 42),                                      // 蔵 (前)
      _B('shed', 155, 78),

      // === 下段 西: 旅館裏 + 蔵 ===
      _B('ryokan', -138, 165),                                  // ★ 旅館の裏 (奥)
      _B('kura', -168, 132),
      _B('kura', -102, 138),
      _B('shed', -145, 178),

      // === 下段 中: 小茶屋の広場 ===
      _B('chaya', -38, 132),
      _B('chaya', 5, 136),
      _B('chaya', 45, 132),                                     // 茶屋 3 連
      _B('shed', -20, 178),
      _B('shed', 22, 178),

      // === 下段 東: 町家集落 ===
      _B('machiya', 108, 170),                                  // ★
      _B('kominka', 138, 132),
      _B('kominka', 168, 138),
      _B('kura', 178, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 桜並木 (Act II 最後の華) ───
      _F('sakura_tree', -170, 62), _F('sakura_tree', 170, 62),
      _F('sakura_tree', -60, 95), _F('sakura_tree', 60, 95),
      _F('sakura_tree', -170, 160), _F('sakura_tree', 170, 160),
      // ─── ★ 中央の摂社 + 寺 ───
      _F('torii', -25, 42),
      _F('koma_inu', -38, 80), _F('koma_inu', -12, 80),
      _F('offering_box', -25, 82),
      _F('shinto_rope', -25, 48),
      _F('ema_rack', 30, 48),
      _F('stone_lantern', 30, 82),
      _F('shrine_fence_red', -50, 55),
      _F('shrine_fence_red', 50, 55),
      _F('omikuji_stand', 45, 78),
      // ─── 西クラスタ (古民家) ───
      _F('bamboo_fence', -95, 50),
      _F('potted_plant', -162, 30), _F('potted_plant', -132, 30),
      _F('bonsai', -108, 30),
      _F('stepping_stones', -140, 60),
      // ─── 東クラスタ (町家+蔵) ───
      _F('bamboo_fence', 95, 50),
      _F('noren', 138, 30),
      _F('wood_fence', 180, 70),
      _F('bonsai', 108, 122),
      // ─── 旅館裏 (下段 西) ───
      _F('stone_lantern', -138, 145),
      _F('bamboo_fence', -100, 150),
      _F('koi_pond', -162, 175),                                // 旅館の裏庭の池
      _F('rock', -170, 178),
      _F('stepping_stones', -150, 172),
      // ─── 茶屋の広場 (下段 中) ───
      _F('noren', -38, 122), _F('noren', 5, 126),
      _F('noren', 45, 122),
      _F('chouchin', -38, 116), _F('chouchin', 45, 116),
      _F('bonsai', -20, 170),
      _F('bamboo_cluster', -45, 160),
      // ─── 東集落 (下段) ───
      _F('bamboo_fence', 95, 150),
      _F('bamboo_cluster', 178, 155),
      _F('bonsai', 138, 124),
      _F('stone_lantern', 155, 168),
    ],
    humans: [
      _H(-132, 55),                                             // 古民家住人
      _H(-25, 82),                                              // 摂社参拝
      _H(30, 85),                                               // 寺参拝
      _H(108, 82),                                              // 町家前
      _H(-138, 182),                                            // 旅館裏
      _H(5, 152),                                               // 茶屋広場
      _H(138, 152),
    ],
    grounds: [
      _G('gravel', 0, 100, 360, 40),
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', -25, 70, 80, 22),                    // 摂社の石畳
      _G('moss', -25, 82, 60, 30),                              // 摂社の苔庭
      _G('moss', 30, 80, 60, 30),                               // 寺の苔庭
      _G('stone_pavement', 140, 60, 80, 42),
      _G('stone_pavement', -140, 160, 80, 42),
      _G('wood_deck', 0, 160, 120, 42),                         // 茶屋広場の木道
      _G('stone_pavement', 140, 160, 80, 42),
      _G('gravel', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act III: 寺院境内 (C6-C8) ═══════════════════════════════════
  // ここから松並木に切り替わり、寺院の厳かさを演出。

  // ── C6: ★ 五重塔 (ランドマーク) ──
  // 街区分け:
  //   上段 西: 参道入口の茶屋 + 蔵
  //   上段 中: ★★ 五重塔 (pagoda、中央に高くそびえる)
  //   上段 東: 僧坊 (kominka 複数)
  //   下段 西: 鐘楼の広場 (小さな shrine + 石段)
  //   下段 中: 境内の石畳広場
  //   下段 東: 参拝者向け茶屋クラスタ
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 参道入口 ===
      _B('chaya', -162, 40),
      _B('chaya', -135, 44),
      _B('kura', -108, 40),                                     // 蔵
      _B('shed', -172, 78),
      _B('kominka', -125, 78),                                  // 僧坊 (奥)

      // === 上段 中: ★★ 五重塔 ★★ ===
      _B('pagoda', 0, 82),                                      // ★★ 五重塔 (中央、avenue 少し上)
      _B('kominka', -58, 42),                                   // 脇の僧坊
      _B('kominka', 58, 42),
      _B('chaya', -25, 38),                                     // 参拝茶屋
      _B('chaya', 25, 38),

      // === 上段 東: 僧坊 ===
      _B('kominka', 108, 40),
      _B('kominka', 135, 44),
      _B('kominka', 160, 40),                                   // 僧坊 3 連
      _B('kura', 178, 78),

      // === 下段 西: 鐘楼の広場 ===
      _B('shrine', -150, 150),                                  // ★ 小さな鐘楼 (奥)
      _B('kominka', -108, 132),
      _B('kura', -178, 175),
      _B('shed', -115, 178),

      // === 下段 中: 境内の石畳広場 ===
      _B('chaya', -38, 132),
      _B('chaya', 38, 132),                                     // 対の茶屋
      _B('shed', -15, 180),
      _B('shed', 18, 180),

      // === 下段 東: 参拝者向け茶屋クラスタ ===
      _B('chaya', 108, 132),
      _B('chaya', 138, 138),
      _B('kominka', 170, 132),
      _B('tahoto', 170, 175),                                   // ★ 小塔 (奥の多宝塔、C8 との連続性)
      _B('shed', 135, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── ★ 軸切り替え: 桜 → 松並木 (Act III の厳かさ) ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── ★★ 五重塔の装飾 (中央) ★★ ───
      _F('koma_inu', -25, 60), _F('koma_inu', 25, 60),
      _F('offering_box', 0, 48),
      _F('shinto_rope', 0, 56),
      _F('stone_lantern', -25, 82), _F('stone_lantern', 25, 82),
      _F('stone_lantern', -35, 52), _F('stone_lantern', 35, 52),
      _F('bamboo_fence', -75, 48), _F('bamboo_fence', 75, 48),
      _F('sando_stone_pillar', -60, 100),
      _F('sando_stone_pillar', 60, 100),
      // ─── 参道入口 (上段 西) ───
      _F('noren', -162, 28), _F('noren', -135, 34),
      _F('chouchin', -162, 22),
      _F('bonsai', -108, 30),
      _F('bamboo_fence', -95, 50),
      _F('sakura_tree', -170, 32),                              // 最後の桜
      // ─── 僧坊 (上段 東) ───
      _F('wood_fence', 180, 42),
      _F('bamboo_cluster', 108, 30), _F('bamboo_cluster', 160, 30),
      _F('rock', 135, 65),
      // ─── 鐘楼の広場 (下段 西) ───
      _F('torii', -150, 138),
      _F('stone_lantern', -150, 172),
      _F('ema_rack', -108, 120),
      _F('shinto_rope', -150, 144),
      _F('rock', -130, 175),
      // ─── 境内の石畳広場 (下段 中) ───
      _F('stepping_stones', -20, 165),
      _F('stepping_stones', 20, 165),
      _F('koi_pond', 0, 175),                                   // 境内の池
      _F('rock', -38, 170), _F('rock', 38, 170),
      _F('bonsai', -38, 122), _F('bonsai', 38, 122),
      _F('noren', -38, 128), _F('noren', 38, 128),
      // ─── 参拝茶屋 (下段 東) ───
      _F('noren', 108, 128), _F('noren', 138, 132),
      _F('chouchin', 108, 122), _F('chouchin', 138, 126),
      _F('bamboo_cluster', 170, 160),
      _F('stone_lantern', 155, 168),
    ],
    humans: [
      _H(-135, 55),                                             // 参道入口の茶屋
      _H(0, 65),                                                // ★ 五重塔の参拝者
      _H(-25, 55), _H(25, 55),                                  // 脇の茶屋
      _H(135, 55),                                              // 僧坊
      _H(-150, 172),                                            // 鐘楼参拝
      _H(0, 175),                                               // 境内
      _H(108, 152),                                             // 参拝茶屋
    ],
    grounds: [
      _G('stone_pavement', 0, 100, 360, 40),                    // ★ 境内の石畳 (玉砂利から切替)
      _G('moss', 0, 70, 140, 40),                               // ★ 五重塔周りの苔
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', 140, 60, 80, 42),
      _G('stone_pavement', -140, 160, 80, 42),
      _G('moss', 0, 160, 140, 42),                              // ★ 境内広場の苔
      _G('stone_pavement', 140, 160, 80, 42),
      _G('stone_pavement', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C7: 寺院本堂 (temple) ──
  // 街区分け:
  //   上段 西: 山門の脇 + 古民家
  //   上段 中: ★★ 大きな本堂 (temple) + 鐘楼
  //   上段 東: 庫裏 (ryokan) + 僧坊
  //   下段 西: 墓地の竹垣 + 小さな祠
  //   下段 中: 境内広場 + 大きな手水舎
  //   下段 東: 僧坊の並び (kominka クラスタ)
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 山門脇 + 古民家 ===
      _B('kominka', -162, 42),
      _B('kominka', -135, 40),
      _B('kura', -108, 38),                                     // 山門脇の蔵
      _B('shed', -172, 78),
      _B('greenhouse', -130, 78),

      // === 上段 中: ★★ 本堂 ★★ ===
      _B('temple', 0, 70),                                      // ★★ 大本堂 (中央、奥)
      _B('kominka', -62, 42),
      _B('kominka', 62, 42),
      _B('shed', -30, 78),
      _B('shed', 30, 78),

      // === 上段 東: 庫裏 (ryokan 見立て) ===
      _B('ryokan', 138, 48),                                    // ★ 庫裏
      _B('kominka', 108, 42),
      _B('kominka', 178, 42),
      _B('kura', 168, 78),

      // === 下段 西: 墓地の竹垣 + 小祠 ===
      _B('shrine', -148, 160),                                  // ★ 小さな祠
      _B('kominka', -108, 132),
      _B('kura', -178, 175),
      _B('shed', -125, 178),

      // === 下段 中: 境内広場 + 手水舎 ===
      _B('chaya', -38, 132),
      _B('chaya', 38, 132),
      _B('shed', -10, 178),
      _B('shed', 18, 178),

      // === 下段 東: 僧坊クラスタ ===
      _B('kominka', 108, 132),
      _B('kominka', 138, 138),
      _B('kominka', 170, 132),                                  // 僧坊 3 連
      _B('kura', 160, 175),
      _B('machiya', 108, 168),                                  // ★ 奥の町家
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 松並木 ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── ★★ 本堂の装飾 ★★ ───
      _F('koma_inu', -30, 50), _F('koma_inu', 30, 50),
      _F('offering_box', 0, 40),
      _F('shinto_rope', 0, 48),
      _F('stone_lantern', -40, 50), _F('stone_lantern', 40, 50),
      _F('sando_stone_pillar', -65, 100),
      _F('sando_stone_pillar', 65, 100),
      _F('shrine_fence_red', -90, 55),
      _F('shrine_fence_red', 90, 55),
      // ─── 山門脇 (上段 西) ───
      _F('bamboo_fence', -95, 50),
      _F('rock', -135, 62), _F('rock', -108, 62),
      _F('stone_lantern', -140, 72),
      _F('sakura_tree', -170, 30),                              // 最後の桜
      // ─── 庫裏 (上段 東) ───
      _F('noren', 138, 38),
      _F('stone_lantern', 138, 72),
      _F('wood_fence', 180, 45),
      _F('bamboo_cluster', 165, 30),
      // ─── 墓地 (下段 西) ───
      _F('torii', -148, 148),
      _F('stone_lantern', -168, 172),
      _F('stone_lantern', -130, 172),
      _F('bamboo_fence', -95, 150),
      _F('rock', -140, 178),
      // ─── 境内広場 (下段 中) ───
      _F('temizuya', -8, 168),                                  // ★ 大きな手水舎
      _F('bamboo_water_fountain', 20, 168),
      _F('stepping_stones', 0, 155),
      _F('koi_pond', -38, 172),
      _F('rock', 40, 170),
      _F('bonsai', -38, 122), _F('bonsai', 38, 122),
      _F('noren', -38, 128), _F('noren', 38, 128),
      // ─── 僧坊 (下段 東) ───
      _F('bamboo_fence', 95, 150),
      _F('bonsai', 108, 122), _F('bonsai', 138, 124),
      _F('potted_plant', 170, 122),
      _F('stone_lantern', 155, 168),
      _F('bamboo_cluster', 178, 160),
    ],
    humans: [
      _H(-135, 55),                                             // 山門脇
      _H(0, 82),                                                // ★ 本堂参拝
      _H(-30, 60),
      _H(138, 78),                                              // 庫裏
      _H(-148, 180),                                            // 墓参り
      _H(-8, 168),                                              // 手水で清め
      _H(138, 152),                                             // 僧坊
    ],
    grounds: [
      _G('stone_pavement', 0, 100, 360, 40),
      _G('moss', 0, 75, 160, 50),                               // ★ 本堂の苔庭
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', 140, 60, 80, 42),
      _G('moss', -140, 160, 80, 42),                            // 墓地の苔
      _G('moss', 0, 165, 140, 40),                              // 境内の苔
      _G('stone_pavement', 140, 160, 80, 42),
      _G('stone_pavement', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C8: 多宝塔 + 石庭 + 摂社 ──
  // 街区分け:
  //   上段 西: ★ 多宝塔 (tahoto) + 参道
  //   上段 中: 石庭 (枯山水) + 小さな shrine
  //   上段 東: 僧坊 + 庫裏
  //   下段 西: 古民家と苔庭
  //   下段 中: 石庭の続き + 茶屋
  //   下段 東: 町家と竹林
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: ★ 多宝塔 ===
      _B('tahoto', -148, 70),                                   // ★ 多宝塔 (奥)
      _B('chaya', -108, 40),
      _B('kominka', -178, 40),
      _B('shed', -120, 78),

      // === 上段 中: 石庭 + 小祠 ===
      _B('shrine', -28, 50),                                    // ★ 小さな shrine
      _B('kominka', -62, 42),
      _B('kominka', 62, 42),
      _B('chaya', 30, 40),                                      // 石庭の茶屋
      _B('shed', 0, 78),

      // === 上段 東: 僧坊 + 庫裏 ===
      _B('ryokan', 140, 50),                                    // ★ 庫裏
      _B('kominka', 108, 40),
      _B('kominka', 175, 42),
      _B('kura', 165, 78),

      // === 下段 西: 古民家と苔庭 ===
      _B('kominka', -162, 132),
      _B('kominka', -135, 138),
      _B('kura', -108, 132),
      _B('shed', -178, 175),
      _B('greenhouse', -130, 178),

      // === 下段 中: 石庭の続き ===
      _B('chaya', -38, 132),
      _B('chaya', 38, 132),
      _B('shed', -10, 178),
      _B('shed', 18, 178),

      // === 下段 東: 町家 + 竹林 ===
      _B('machiya', 108, 170),                                  // ★
      _B('machiya', 148, 172),                                  // ★ 町家 2 棟
      _B('kominka', 108, 132),
      _B('chaya', 138, 138),
      _B('kura', 175, 132),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 松並木 ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── ★ 多宝塔の装飾 (上段 西) ───
      _F('stone_lantern', -148, 50), _F('stone_lantern', -128, 50),
      _F('bamboo_fence', -100, 50),
      _F('shinto_rope', -148, 44),
      _F('offering_box', -148, 56),
      _F('sando_stone_pillar', -165, 100),
      _F('rock', -108, 65),
      // ─── ★★ 枯山水の石庭 (上段 中) ★★ ───
      _F('torii', -28, 38),
      _F('koma_inu', -40, 80), _F('koma_inu', -16, 80),
      _F('offering_box', -28, 80),
      _F('rock', 10, 72), _F('rock', 45, 75), _F('rock', 70, 72),   // 石庭の石
      _F('bamboo_fence', 60, 50),
      _F('stepping_stones', 30, 75),
      // ─── 庫裏 (上段 東) ───
      _F('noren', 140, 38),
      _F('stone_lantern', 140, 72),
      _F('wood_fence', 180, 45),
      _F('bamboo_cluster', 155, 32),
      _F('bonsai', 108, 30),
      // ─── 古民家 + 苔庭 (下段 西) ───
      _F('bamboo_fence', -95, 150),
      _F('potted_plant', -162, 122),
      _F('bonsai', -135, 122),
      _F('koi_pond', -138, 172),                                // 古民家の裏庭池
      _F('rock', -148, 176),
      _F('stepping_stones', -115, 168),
      // ─── 石庭続き (下段 中) ───
      _F('rock', -10, 170), _F('rock', 15, 170), _F('rock', 35, 175),
      _F('bamboo_water_fountain', -30, 172),                    // 鹿威し
      _F('bonsai', -38, 122), _F('bonsai', 38, 122),
      _F('stepping_stones', 0, 160),
      _F('sakura_tree', 45, 175),
      _F('noren', -38, 128), _F('noren', 38, 128),
      // ─── 町家 + 竹林 (下段 東) ───
      _F('bamboo_cluster', 178, 155),
      _F('bamboo_cluster', 170, 180),
      _F('bamboo_fence', 95, 150),
      _F('wood_fence', 180, 170),
      _F('bonsai', 108, 122),
    ],
    humans: [
      _H(-148, 85),                                             // 多宝塔参拝
      _H(-28, 82),                                              // 石庭参拝
      _H(30, 85),                                               // 石庭の茶屋
      _H(140, 82),                                              // 庫裏
      _H(-135, 152),                                            // 古民家住人
      _H(-38, 152),                                             // 茶屋客
      _H(108, 182),                                             // 町家住人
    ],
    grounds: [
      _G('stone_pavement', 0, 100, 360, 40),
      _G('stone_pavement', -140, 60, 80, 42),
      _G('dirt', 30, 75, 110, 35),                              // ★ 枯山水 (乾いた砂)
      _G('stone_pavement', 140, 60, 80, 42),
      _G('moss', -140, 160, 80, 42),                            // 苔庭 (西)
      _G('dirt', 0, 170, 140, 32),                              // ★ 枯山水続き
      _G('stone_pavement', 140, 160, 80, 42),
      _G('stone_pavement', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
  // ═══ Act IV: 古民家集落 → Stage 4 handoff (C9-C11) ═══════════════

  // ── C9: 町家の並び (落ち葉の街) ──
  // 街区分け:
  //   上段 西: 町家集落 (machiya クラスタ)
  //   上段 中: 古い料亭 (chaya + kominka)
  //   上段 東: 町家続き + 蔵
  //   下段 西: 古民家 + 庭
  //   下段 中: 紅葉の石畳広場
  //   下段 東: 町家 + 竹垣
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: ★ 町家集落 ===
      _B('machiya', -160, 52),                                  // ★ 町家 3 軒連続
      _B('machiya', -125, 54),
      _B('machiya', -95, 78),                                   // 奥の町家
      _B('kura', -175, 78),

      // === 上段 中: 古料亭 ===
      _B('chaya', -55, 40),
      _B('kominka', -22, 42),
      _B('chaya', 22, 40),
      _B('kominka', 55, 44),
      _B('shed', -15, 78),
      _B('shed', 18, 78),

      // === 上段 東: 町家続き + 蔵 ===
      _B('machiya', 108, 52),
      _B('machiya', 142, 54),                                   // ★ 町家続き
      _B('kura', 175, 40),
      _B('kura', 178, 78),
      _B('shed', 125, 78),

      // === 下段 西: 古民家 + 庭 ===
      _B('kominka', -162, 132),
      _B('kominka', -135, 138),
      _B('kominka', -108, 132),
      _B('kura', -178, 175),
      _B('greenhouse', -130, 178),

      // === 下段 中: 紅葉の広場 ===
      _B('chaya', -38, 132),
      _B('chaya', 5, 138),
      _B('chaya', 45, 132),
      _B('shed', -20, 178),
      _B('shed', 22, 178),

      // === 下段 東: 町家 + 竹垣 ===
      _B('machiya', 108, 170),                                  // ★ 奥の町家
      _B('kominka', 108, 132),
      _B('kominka', 138, 138),
      _B('chaya', 168, 132),
      _B('shed', 178, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠 ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      _F('stone_lantern', -80, 108), _F('stone_lantern', 80, 108),
      // ─── 軸: 松 + 紅葉 ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── 町家の装飾 (上段 西・東) ───
      _F('noren', -160, 36), _F('noren', -125, 38),
      _F('chouchin', -160, 22), _F('chouchin', -125, 22),
      _F('bamboo_fence', -95, 50),
      _F('bonsai', -160, 32),
      _F('potted_plant', -125, 32),
      _F('wood_fence', -180, 40),
      _F('noren', 108, 36), _F('noren', 142, 38),
      _F('chouchin', 108, 22), _F('chouchin', 142, 22),
      _F('bamboo_fence', 95, 50),
      _F('wood_fence', 180, 40),
      // ─── 古料亭 (上段 中) ───
      _F('noren', -55, 30), _F('noren', 22, 30),
      _F('chouchin', -22, 30), _F('chouchin', 55, 30),
      _F('bamboo_cluster', 0, 50),
      _F('potted_plant', -22, 30),
      // ─── 古民家区画 (下段 西) ───
      _F('bamboo_fence', -95, 150),
      _F('potted_plant', -162, 122), _F('potted_plant', -108, 122),
      _F('bonsai', -135, 122),
      _F('sakura_tree', -162, 178),                             // 紅葉風の木 (sakura で代用)
      // ─── 紅葉の広場 (下段 中) ───
      _F('stepping_stones', 0, 165),
      _F('rock', -25, 170), _F('rock', 25, 170),
      _F('bonsai', -38, 122), _F('bonsai', 38, 122),
      _F('noren', -38, 128), _F('noren', 45, 128),
      _F('bamboo_water_fountain', -10, 170),
      // ─── 町家 (下段 東) ───
      _F('bamboo_fence', 95, 150),
      _F('bonsai', 108, 122), _F('bonsai', 138, 124),
      _F('wood_fence', 180, 168),
      _F('potted_plant', 168, 122),
    ],
    humans: [
      _H(-160, 72),                                             // 町家住人
      _H(-22, 60),                                              // 古料亭客
      _H(108, 72),                                              // 町家住人
      _H(-135, 152),                                            // 古民家路地
      _H(5, 152),                                               // 紅葉広場の散歩
      _H(108, 152),
    ],
    grounds: [
      _G('fallen_leaves', 0, 100, 360, 40),                     // ★ 中央に落ち葉の参道
      _G('stone_pavement', -140, 60, 80, 42),
      _G('wood_deck', 0, 60, 120, 42),                          // 古料亭の木道
      _G('stone_pavement', 140, 60, 80, 42),
      _G('fallen_leaves', -140, 160, 80, 42),                   // ★ 落ち葉
      _G('fallen_leaves', 0, 160, 140, 42),                     // ★ 紅葉広場
      _G('fallen_leaves', 140, 160, 80, 42),
      _G('fallen_leaves', 0, 15, 240, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C10: 古民家集落 + 蔵 ──
  // 街区分け:
  //   上段 西: 古民家密集 (kominka × 4)
  //   上段 中: 広場と井戸 (小さな chaya)
  //   上段 東: 土蔵群 (kura クラスタ)
  //   下段 西: 蔵と古民家の混合
  //   下段 中: 茶屋の路地
  //   下段 東: 古民家 + 温室
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 古民家密集 ===
      _B('kominka', -165, 40),
      _B('kominka', -138, 44),
      _B('kominka', -112, 40),                                  // 古民家 3 連
      _B('kominka', -170, 78),                                  // 奥の古民家
      _B('shed', -130, 78),

      // === 上段 中: 広場と井戸 ===
      _B('chaya', -55, 42),
      _B('kominka', -22, 40),
      _B('kominka', 22, 44),
      _B('chaya', 55, 40),
      _B('kura', 0, 78),                                        // 奥の蔵

      // === 上段 東: ★ 土蔵群 ===
      _B('kura', 108, 40),
      _B('kura', 135, 44),
      _B('kura', 165, 40),                                      // ★ 蔵 3 連
      _B('kura', 108, 78), _B('kura', 175, 78),                 // 奥に 2 つ

      // === 下段 西: 蔵と古民家の混合 ===
      _B('kominka', -162, 132),
      _B('kura', -135, 138),
      _B('kominka', -108, 132),
      _B('shed', -178, 175),
      _B('greenhouse', -135, 178),

      // === 下段 中: 茶屋の路地 ===
      _B('chaya', -38, 132),
      _B('chaya', 5, 138),
      _B('chaya', 45, 132),                                     // 茶屋 3 連
      _B('shed', -15, 178),
      _B('shed', 22, 178),

      // === 下段 東: 古民家 + 温室 ===
      _B('kominka', 108, 132),
      _B('kominka', 138, 138),
      _B('kominka', 168, 132),
      _B('greenhouse', 125, 178),                               // 古い温室
      _B('shed', 165, 178),
    ],
    furniture: [
      // ─── 軸: 石灯籠 (最後) ───
      _F('stone_lantern', -80, 92), _F('stone_lantern', 80, 92),
      _F('stone_lantern', -40, 98), _F('stone_lantern', 40, 98),
      // ─── 軸: 松 ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── 古民家密集 (上段 西) ───
      _F('bamboo_fence', -95, 50),
      _F('potted_plant', -165, 30), _F('potted_plant', -138, 30),
      _F('bonsai', -112, 30),
      _F('wood_fence', -180, 42),
      // ─── 広場 (上段 中) ───
      _F('fountain', 0, 55),                                    // ★ 古い井戸 (fountain で代用)
      _F('rock', -15, 65), _F('rock', 15, 65),
      _F('bamboo_cluster', -70, 50),
      _F('noren', -55, 30), _F('noren', 55, 30),
      _F('stepping_stones', 0, 70),
      // ─── 土蔵群 (上段 東) ───
      _F('bamboo_fence', 95, 50),
      _F('rock', 108, 62), _F('rock', 165, 62),
      _F('wood_fence', 180, 45),
      _F('stone_lantern', 135, 72),
      // ─── 蔵と古民家混合 (下段 西) ───
      _F('bamboo_fence', -95, 150),
      _F('potted_plant', -162, 122), _F('potted_plant', -108, 122),
      _F('sakura_tree', -162, 178),                             // 最後の桜
      _F('koi_pond', -140, 172),
      // ─── 茶屋の路地 (下段 中) ───
      _F('noren', -38, 128), _F('noren', 5, 132),
      _F('noren', 45, 128),
      _F('chouchin', -38, 122), _F('chouchin', 5, 126),
      _F('chouchin', 45, 122),
      _F('bonsai', -20, 170),
      _F('stepping_stones', 22, 170),
      // ─── 古民家 (下段 東) ───
      _F('bamboo_fence', 95, 150),
      _F('bonsai', 108, 122), _F('bonsai', 138, 124),
      _F('potted_plant', 168, 122),
      _F('wood_fence', 180, 155),
    ],
    humans: [
      _H(-138, 55),                                             // 古民家住人
      _H(0, 70),                                                // 井戸で水汲み
      _H(135, 60),                                              // 蔵の前
      _H(-135, 152),
      _H(5, 152),                                               // 茶屋路地
      _H(138, 152),
      _H(125, 182),                                             // 温室で野菜を摘む
    ],
    grounds: [
      _G('stone_pavement', 0, 100, 360, 40),                    // 石畳
      _G('stone_pavement', -140, 60, 80, 42),
      _G('stone_pavement', 0, 60, 100, 42),                     // 広場
      _G('stone_pavement', 140, 60, 80, 42),                    // 土蔵前
      _G('stone_pavement', -140, 160, 80, 42),
      _G('wood_deck', 0, 160, 120, 42),                         // 茶屋路地の木道
      _G('stone_pavement', 140, 160, 80, 42),
      _G('stone_pavement', 0, 15, 220, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C11: 石畳の終端 → Stage 4 への気配 ──
  // 街区分け:
  //   上段 西: 古い農家 (kominka + greenhouse)
  //   上段 中: 集落の外れ (小さな祠 + 野菜畑)
  //   上段 東: 集落の境界 (蔵 + 小屋)
  //   下段 西: 畑地と小屋
  //   下段 中: 終盤の広場
  //   下段 東: 港へ続く道の気配 (kura + 小屋)
  { patternId: 's3_raw', raw: {
    buildings: [
      // === 上段 西: 古い農家 ===
      _B('kominka', -162, 42),
      _B('kominka', -132, 44),
      _B('greenhouse', -105, 40),                               // 農業用温室
      _B('kura', -175, 78),
      _B('greenhouse', -135, 78),                               // 2 棟目温室

      // === 上段 中: 集落の外れ + 小祠 ===
      _B('shrine', -25, 55),                                    // ★ 最後の小祠
      _B('kominka', -62, 42),
      _B('kominka', 25, 42),
      _B('kominka', 62, 44),
      _B('shed', -15, 78),
      _B('shed', 18, 78),

      // === 上段 東: 集落の境界 ===
      _B('kominka', 108, 42),
      _B('kura', 138, 40),
      _B('kominka', 170, 44),
      _B('shed', 130, 78),
      _B('kura', 170, 78),

      // === 下段 西: 畑地 ===
      _B('kominka', -162, 132),
      _B('greenhouse', -130, 138),                              // 野菜温室
      _B('kura', -105, 132),
      _B('shed', -178, 175),
      _B('greenhouse', -138, 178),                              // 温室

      // === 下段 中: 終盤の広場 ===
      _B('chaya', -38, 132),
      _B('chaya', 38, 132),                                     // 最後の茶屋 2 軒
      _B('shed', 0, 178),

      // === 下段 東: 港への道の気配 ===
      _B('kura', 108, 132),                                     // 蔵
      _B('kominka', 138, 138),
      _B('kominka', 168, 132),
      _B('shed', 125, 178),
      _B('kura', 175, 175),                                     // ★ 港へ続く蔵 (Stage 4 handoff)
    ],
    furniture: [
      // ─── 軸: 石灯籠 (控えめ、終盤) ───
      _F('stone_lantern', -80, 95), _F('stone_lantern', 80, 95),
      _F('stone_lantern', -40, 102), _F('stone_lantern', 40, 102),
      // ─── 軸: 松 (最後の松並木) ───
      _F('pine_tree', -170, 62), _F('pine_tree', 170, 62),
      _F('pine_tree', -60, 95), _F('pine_tree', 60, 95),
      _F('pine_tree', -170, 160), _F('pine_tree', 170, 160),
      // ─── 農家 (上段 西) ───
      _F('bamboo_fence', -95, 50),
      _F('rock', -130, 65),
      _F('potted_plant', -162, 30),
      _F('wood_fence', -180, 42),
      // ─── ★ 小祠 (上段 中) ───
      _F('torii', -25, 42),
      _F('koma_inu', -40, 80), _F('koma_inu', -10, 80),
      _F('offering_box', -25, 80),
      _F('shinto_rope', -25, 48),
      _F('stone_lantern', -25, 70),
      _F('bamboo_cluster', 40, 50),
      _F('noren', 62, 32),
      // ─── 集落境界 (上段 東) ───
      _F('bamboo_fence', 95, 50),
      _F('wood_fence', 180, 45),
      _F('bonsai', 108, 30),
      _F('rock', 148, 62),
      // ─── 畑地 (下段 西) ───
      _F('bamboo_fence', -95, 150),
      _F('rock', -145, 165),
      _F('potted_plant', -162, 122),
      _F('flower_bed', -120, 165),                              // 野菜畑の見立て
      _F('flower_bed', -145, 175),
      // ─── 終盤の広場 (下段 中) ───
      _F('fountain_large', 0, 160),                             // ★ 村の中央噴水 (大きい)
      _F('stepping_stones', -20, 170),
      _F('stepping_stones', 20, 170),
      _F('sakura_tree', -8, 180),                               // 最後の桜
      _F('rock', -25, 175), _F('rock', 25, 175),
      _F('noren', -38, 128), _F('noren', 38, 128),
      // ─── 港への道 (下段 東) ───
      _F('bamboo_fence', 95, 150),
      _F('wood_fence', 180, 155),
      _F('bonsai', 138, 124),
      _F('rock', 175, 165),                                     // ★ 港石の気配
      _F('buoy', 178, 185),                                     // ★★ Stage 4 予兆: 浮標
    ],
    humans: [
      _H(-132, 55),                                             // 農家
      _H(-25, 82),                                              // 小祠参拝
      _H(-105, 62),                                             // 温室作業
      _H(108, 55),                                              // 集落境界
      _H(-130, 152),                                            // 畑仕事
      _H(0, 170),                                               // 広場の噴水
      _H(175, 182),                                             // 港方面へ
    ],
    grounds: [
      _G('stone_pavement', 0, 100, 360, 40),
      _G('stone_pavement', -140, 60, 80, 42),
      _G('moss', -25, 82, 50, 30),                              // 小祠の苔
      _G('dirt', 0, 60, 100, 42),                               // ★ 集落外れの土
      _G('stone_pavement', 140, 60, 80, 42),
      _G('dirt', -140, 160, 80, 42),                            // ★ 畑の土
      _G('stone_pavement', 0, 160, 140, 42),
      _G('stone_pavement', 140, 160, 80, 42),
      _G('stone_pavement', 0, 15, 220, 25),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },
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
  { id: 1, name: '繁華街・夜の街',     templates: STAGE_2_TEMPLATES, sidewalkZone: 5,
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
  // Zone 5: 夜街・繁華街 — ネオン看板・提灯・自販機・公衆電話
  5: ['chouchin', 'a_frame_sign', 'vending', 'sign_board', 'chouchin', 'noren',
      'vending', 'kerbside_vending_pair', 'newspaper_stand', 'post_box',
      'telephone_booth', 'atm', 'chouchin', 'dumpster', 'bicycle_rack',
      'cable_junction_box', 'street_lamp', 'bollard'],
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
