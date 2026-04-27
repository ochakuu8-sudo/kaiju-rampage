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
  const placement = placeGridBlock(block, INITIAL_CITY_PATTERN, 0);
  // HILLTOP (y=245 上端) から Stage 1 最初のチャンク (WORLD_MAX_Y=290) までの
  // 約 45 px の歩道帯は concrete ベース。垂直道路は getInitialCityRoadData で
  // 正規の drawVRoad により描画される (他の道路と同じマーキングで一貫)。
  const bandCy = (245 + C.WORLD_MAX_Y) / 2;
  const bandH  = C.WORLD_MAX_Y - 245;
  if (!placement.grounds) placement.grounds = [];
  placement.grounds.push({ type: 'concrete', x: 0, y: bandCy, w: 360, h: bandH });
  return placement;
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
  // HILLTOP から最初のチャンク (WORLD_MAX_Y) までの緩衝帯にもチャンクの
  // _SPINE_V (x=-90/0/90) と揃う垂直道路セグメントを追加して、正規の
  // drawVRoad で描画させる (他の道路と同じレーンマーキング・側線)。
  for (const cx of [-90, 0, 90]) {
    verticalRoads.push({
      cx,
      w: cx === 0 ? 18 : 14,
      yMin: C.HILLTOP_STREET_Y,
      yMax: C.WORLD_MAX_Y,
      cls: cx === 0 ? 'avenue' : 'street',
    });
  }
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

// ═══════════════════════════════════════════════════════════════════
// Semantic Cluster — 配置に視覚的意味を持たせる上位レイヤー (v6.3+)
// 既存の RawChunkBody.buildings/furniture を破壊せず、index 参照で
// 「どれが焦点」「どれが取り巻き」「どれが境界・動線・痕跡」を宣言する。
// 指示書 §3.6 (ヒーロー/アンビエント) / §4 (公園モデル 4 層) に対応。
// ═══════════════════════════════════════════════════════════════════
export type ClusterRole = 'hero' | 'ambient';
export type ClusterCell = 'NW' | 'NE' | 'SW' | 'SE' | 'merged';
/** buildings[i] への参照 */
export type BRef = { kind: 'b'; i: number };
/** furniture[i] への参照 */
export type FRef = { kind: 'f'; i: number };
export type Ref  = BRef | FRef;

export interface SemanticCluster {
  /** Lint レポート用の識別子 (例: 'ch1.SE.park') */
  id: string;
  role: ClusterRole;
  cell: ClusterCell;
  /** 焦点 1 個 (建物 or 家具) */
  focal: Ref;
  /** 取り巻き (hero は 3-5 個目安) — §4 companions */
  companions?: Ref[];
  /** 境界 (hedge / wood_fence / planter 列) — §4 boundary */
  boundary?: Ref[];
  /** 動線 (stepping_stones / lamp / sign 列) — §4 access */
  access?: Ref[];
  /** §6 生活痕跡 (laundry / garbage / bicycle …) */
  livingTrace?: Ref;
  /** §6 隣接チャンクへの連続軸マーカー (桜並木・電線・facade 帯) */
  handoffTo?: 'next' | 'prev';
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
  /** v6.3+ 意味付けクラスタ (オプショナル、Lint と焦点演出で使用) */
  clusters?: SemanticCluster[];
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
  /** v6.3+ 意味付けクラスタ (オプショナル) — buildings/furniture への index 参照 */
  clusters?: SemanticCluster[];
}

export interface StageDef {
  id: number;
  name: string;
  /** 英語表示名 (ゲーム内 UI 用) */
  nameEn: string;
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
// 全チャンク共通の唯一の縦道路: 中央 avenue (x=0、幅18固定)
// 旧 _SPINE_V (x=-90/0/+90) は撤廃。各チャンクが個性的な道路を持つ。
const _AVE = _VR(0, 0, 200, 'avenue');
// 後方互換 (Stage 2-5 がまだ使う)
const _SPINE_V = [_VR(-90, 0, 200), _VR(0, 0, 200, 'avenue'), _VR(+90, 0, 200)];
const _MID_HR = _HR(100, -180, 180);       // 中央クロス街路 (全チャンク共通の唯一の横道路)
const _TOP_HR = _HR(200, -180, 180);       // 上端クロス街路 (クロスポイントのみ)

// ─── 意味付けクラスタ用 DSL (v6.3+) ────────────────────────────────
// 既存の buildings/furniture 配列に push しつつ index 参照を返す。
// 配列途中への挿入は禁止 — 必ず末尾追加で Ref が安定する。
const $B = (out: RawChunkBody, size: C.BuildingSize, dx: number, dy: number): BRef => {
  out.buildings.push({ size, dx, dy });
  return { kind: 'b', i: out.buildings.length - 1 };
};
const $F = (out: RawChunkBody, type: FurnitureType, dx: number, dy: number): FRef => {
  out.furniture.push({ type, dx, dy });
  return { kind: 'f', i: out.furniture.length - 1 };
};
/** 同 dx・複数 dy の家具列を一発で作る (例: hedge を y=130/145/162/178 に並べる) */
const _ROW = (out: RawChunkBody, type: FurnitureType, dx: number, dys: number[]): FRef[] =>
  dys.map(dy => $F(out, type, dx, dy));
/** クラスタ宣言 — RawChunkBody.clusters?? に push */
const _CLUSTER = (out: RawChunkBody, c: SemanticCluster): void => {
  (out.clusters ??= []).push(c);
};

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

  // ═══ Act I: 閑静な住宅街 (Ch0-Ch2) ════════════════════════════════════
  // 桜並木 / 電柱+電線 / 生活歩道 (stone_pavement x=-65) を連続軸として通す。

  // ── S1-Ch0: 日本庭園と縁側のある住宅街入口 ──
  // 焦点: NW を「古民家邸」として一体設計 (kominka 母屋 + 北西の kura 蔵 + 東の chaya 茶屋 + 庭)
  //       東西の現代住宅列は avenue に面しファサードを向ける
  //       下段の裏路地 (dy=178) は各住宅の裏庭物置として帰属
  //       wagashi は SE の街角に立つ近所の和菓子屋 (avenue 通りすがりの客)
  // 物語: 「街道を進むと古民家邸が左手に見える、対岸は新しい家並み、和菓子屋の角」
  { patternId: 's1_raw', raw: {
    buildings: [
      // ─────────────────────────────────────────────────
      // 【NW 街区】古民家邸 (一体設計、grass の上)
      // ─────────────────────────────────────────────────
      _B('kominka', -90, 60),       // 母屋 (邸の中心、grass の上)
      _B('kura', -145, 30),         // 蔵 (邸の北西奥、母屋の裏手)
      _B('chaya', -30, 70),         // 茶室 (邸の南東、avenue 寄り)
      // ─────────────────────────────────────────────────
      // 【NE 街区】avenue に面する現代住宅列 (residential_tile)
      // ─────────────────────────────────────────────────
      _B('townhouse', 30, 30),      // avenue 寄り、間口の狭い町屋風
      _B('house', 80, 30),          // 中型住宅
      _B('mansion', 145, 30),       // 大型ファミリー住宅
      _B('house', 175, 60),         // 邸の角、東端
      // ─────────────────────────────────────────────────
      // 【SW 街区】下段住宅列 + 裏路地
      // ─────────────────────────────────────────────────
      _B('machiya', -150, 130),     // 伝統町家 (SW の主役、古民家邸の対岸)
      _B('house', -90, 130),        // 隣の現代住宅
      _B('townhouse', -45, 130),    // avenue 寄りの町屋
      // SW 裏路地 (各住宅の裏庭、dy=178)
      _B('kura', -150, 178),        // 町家の蔵 (machiya 帰属)
      _B('shed', -110, 178),        // 物置 (house 帰属)
      _B('garage', -65, 178),       // 車庫 (townhouse 帰属)
      // ─────────────────────────────────────────────────
      // 【SE 街区】下段住宅列 + 街角の和菓子屋
      // ─────────────────────────────────────────────────
      _B('house', 35, 130),         // avenue 寄りの現代住宅
      _B('duplex', 85, 130),        // 二世帯住宅
      _B('mansion', 145, 130),      // 大型住宅
      _B('wagashi', 70, 175),       // 街角の和菓子屋 (avenue 通りの客向け)
      // SE 裏路地 (各住宅の裏庭、dy=178)
      _B('shed', 30, 178),          // 物置 (house 帰属)
      _B('greenhouse', 120, 178),   // 温室 (duplex 帰属)
      _B('garage', 165, 178),       // 車庫 (mansion 帰属)
    ],
    furniture: [
      // ═══ 古民家邸 (kominka 邸全体の物語) ═══
      // 母屋の前庭: 鯉の池 (主役焦点)
      _F('koi_pond', -90, 40),
      // 飛び石: 茶屋から母屋へ続く道
      _F('stepping_stones', -65, 75), _F('stepping_stones', -78, 65),
      _F('stepping_stones', -90, 80),
      // 庭の松 (邸の象徴): 北端と東端で「庭の枠」を作る
      _F('pine_tree', -160, 70), _F('pine_tree', -30, 50),
      // 石灯籠: 飛び石路に沿って
      _F('stone_lantern', -110, 78), _F('stone_lantern', -55, 60),
      // 盆栽: 母屋と茶屋の周辺
      _F('bonsai', -78, 30), _F('bonsai', -115, 60), _F('bonsai', -30, 60),
      // 庭石
      _F('rock', -125, 78), _F('rock', -65, 50), _F('rock', -45, 88),
      // 縁側 (kominka 母屋の南、wood_deck 上の猫)
      _F('cat', -100, 88), _F('cat', -78, 90),
      // 蔵 (kura) 帰属: 古い農具の蔵
      _F('wood_fence', -160, 50),
      // 茶屋 (chaya) 帰属: 暖簾と提灯
      _F('noren', -30, 64), _F('chouchin', -30, 62),
      _F('bench', -45, 92),
      // 庭の囲い (邸を avenue から区切る wood_fence)
      _F('wood_fence', -15, 30), _F('wood_fence', -15, 50),
      // ═══ NE 現代住宅列 (各家を 区画線 で完全に囲む + 個性的な庭) ═══
      // ロット1境界: x=53 で townhouse と house を分ける (front→back)
      _F('hedge', 53, 30), _F('hedge', 53, 50),
      // ロット2境界: x=113 で house と mansion を分ける
      // ロット3境界: x=167 で mansion と east house を分ける
      // townhouse(30, 30): 「花好きの家」— 花壇とプランター
      _F('mailbox', 22, 28),
      _F('flower_bed', 30, 64), _F('flower_planter_row', 30, 78),
      // house(80, 30): 「禅の庭の家」— 盆栽と石
      _F('mailbox', 70, 28), _F('bicycle', 90, 22),
      _F('bonsai', 80, 64), _F('rock', 70, 78), _F('stone_lantern', 88, 78),
      // mansion(145, 30): 「邸宅」— 噴水と像で高級感
      _F('mailbox', 130, 28), _F('bicycle', 130, 22),
      _F('laundry_balcony', 145, 50),
      _F('fountain', 145, 75), _F('statue', 130, 78),
      // house(175, 60): 「家庭菜園の家」— 土の畝と植木鉢
      _F('rock', 175, 88),
      // ═══ SW 下段住宅列 (各家を 区画線 で完全に囲む + 個性的な庭) ═══
      // ロット境界: x=-118 (machiya と house) — 伝統 wood_fence
      // ロット境界: x=-65 (house と townhouse) — 現代 hedge
      // machiya(-150, 130): 「伝統の家」— 石灯籠と盆栽の庭
      _F('noren', -150, 118), _F('bonsai', -160, 122),
      _F('stone_lantern', -160, 162), _F('rock', -135, 162), _F('bonsai', -135, 122),
      // house(-90, 130): 「子育て家庭」— 自転車2台と花壇
      _F('bicycle', -100, 122),
      _F('bicycle', -78, 168),
      // townhouse(-45, 130): 「若夫婦の家」— 自転車置き場と多くの植木
      _F('bicycle_rack', -45, 168), _F('flower_planter_row', -45, 175),
      // SW 裏路地家具 (各裏庭の生活痕跡)
      _F('garbage', -150, 168),  // kura 横
      _F('bicycle_rack', -65, 168), _F('traffic_cone', -55, 168),  // garage 帰属
      // ═══ SE 下段住宅列 (各家を 区画線 で完全に囲む + 個性的な庭) ═══
      // ロット境界: x=60 (house と duplex)
      // ロット境界: x=115 (duplex と mansion)
      // house(35, 130): 「ガーデニング好きの家」— 花壇と植木
      // duplex(85, 130): 「二世帯住宅」— 洗濯物多め、自転車多め
      _F('laundry_balcony', 95, 130),
      _F('bicycle', 75, 122),
      _F('laundry_pole', 75, 162), _F('bicycle', 95, 168),
      // mansion(145, 130): 「大邸宅」— 噴水と像
      _F('bicycle', 135, 122),
      _F('fountain', 145, 162), _F('statue', 130, 168),
      // wagashi(70, 175): 街角の和菓子屋 (avenue 寄り)
      _F('noren', 70, 165), _F('shop_awning', 70, 168),
      _F('chouchin', 70, 162), _F('a_frame_sign', 60, 188),
      // SE 裏路地家具
      _F('garbage', 30, 168),                                     // shed 帰属
      _F('bicycle_rack', 165, 168),  // garage 帰属
      // ═══ 連続軸: 桜並木 (avenue 沿いに点在、Ch0-Ch5) ═══
      _F('sakura_tree', -135, 88), _F('sakura_tree', 30, 88),
      _F('sakura_tree', 165, 88),
      // ═══ 連続軸: 電柱+電線 (奥層 4 隅) ═══
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ═══ avenue 沿いの地点小物 ═══
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      // ═══ 縁側猫の延長 (residential 上のリアル感) ═══
    ],
    // ▼ v6.3 cluster: NW = HERO 古民家邸 / NE+SW+SE = AMBIENT 住宅
    // (建物・家具 index は上記配列の出現順)
    clusters: [
      // ★ HERO: NW 古民家邸 (基本形 B = 焦点建物 + 焦点ground)
      { id: 'ch0.NW.kominka_estate', role: 'hero', cell: 'NW',
        focal: { kind: 'f', i: 0 },           // koi_pond (-90,40)
        companions: [
          { kind: 'b', i: 0 },                // kominka 母屋 (-90,60)
          { kind: 'f', i: 4 },                // pine_tree (-160,70)
          { kind: 'f', i: 6 },                // stone_lantern (-110,78)
          { kind: 'f', i: 8 },                // bonsai (-78,30)
        ],
        boundary: [
          { kind: 'f', i: 22 },               // wood_fence (-15,30)
          { kind: 'f', i: 23 },               // wood_fence (-15,50)
          { kind: 'f', i: 24 },               // wood_fence (-15,70)
          { kind: 'f', i: 25 },               // wood_fence (-15,90)
        ],
        livingTrace: { kind: 'f', i: 14 },    // cat (-100,88) 縁側
      },
      // AMBIENT: NE 現代住宅列 (mansion 邸宅を焦点)
      { id: 'ch0.NE.mansion', role: 'ambient', cell: 'NE',
        focal: { kind: 'b', i: 5 },           // mansion (145,30)
        companions: [
          { kind: 'b', i: 3 },                // townhouse (30,30)
          { kind: 'b', i: 4 },                // house (80,30)
          { kind: 'b', i: 6 },                // house (175,60)
        ],
        livingTrace: { kind: 'f', i: 49 },    // bicycle (mansion lot, 130,22)
      },
      // AMBIENT: SW 伝統住宅 (machiya を焦点)
      { id: 'ch0.SW.machiya', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 7 },           // machiya (-150,130)
        companions: [
          { kind: 'b', i: 8 },                // house (-90,130)
          { kind: 'b', i: 9 },                // townhouse (-45,130)
          { kind: 'b', i: 10 },               // kura (-150,178) 裏蔵
        ],
        livingTrace: { kind: 'f', i: 96 },    // bicycle (-100,122) 子育て家庭
      },
      // AMBIENT: SE 街角 (mansion 邸 + wagashi 街角)
      { id: 'ch0.SE.corner', role: 'ambient', cell: 'SE',
        focal: { kind: 'b', i: 15 },          // mansion (145,130)
        companions: [
          { kind: 'b', i: 13 },               // house (35,130)
          { kind: 'b', i: 14 },               // duplex (85,130)
          { kind: 'b', i: 16 },               // wagashi (70,175) 街角
        ],
        livingTrace: { kind: 'f', i: 116 },   // laundry_balcony (95,130)
      },
    ],
    humans: [
      // 古民家邸 (4): 池を眺める / 飛び石 / 縁側 / 蔵
      _H(-90, 50),    
         
      // 茶屋 (1): 客
      _H(-30, 90),
      // NE 現代住宅 (4): 各家の玄関前
           
      _H(165, 80),    
      // SW 下段住宅 (3): 各家の玄関前
         
      // SE 下段住宅 (3): 各家の玄関前
      _H(25, 152),    
         
      // wagashi 客 (1)
      // avenue 通行人 (1)
      _H(0, 100),
    ],
    grounds: [
      // ── v7.1 Ch0 日本庭園: residential_tile + 庭の grass 大 + 縁側 wood_deck ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE
      _G('grass', -90, 60, 180, 100),                            // ★ NW 庭 全面
      _G('grass', 90, 150, 180, 100),                            // ★ SE 庭 全面
      _G('wood_deck', -90, 65, 100, 30),                         // 縁側
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue のみ (静かな住宅街の入口、側道なし)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  } },

  // ── S1-Ch1: 児童公園を中心にした住宅街 ──  (v6.3 パイロット: SemanticCluster 形式)
  // ▼ ヒーロー: SE = 児童公園 (基本形 A・オープンスペース焦点)
  // ▼ アンビエント 3 セル: NW = 商店フロント / NE = kominka 住宅 / SW = mansion 住宅
  // 既存実装の建物・家具・grounds・humans を完全保持。cluster メタを上位で宣言。
  { patternId: 's1_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _HR(130, 10, 180)],
      verticalRoads: [_AVE],
    };

    // ═══════════════════════════════════════════════════════════
    // BUILDINGS (順序保持)
    // ═══════════════════════════════════════════════════════════
    // NW セル: 商店フロント (公園に面した生活店舗)
    const conv     = $B(out, 'convenience', -55, 42);
    const laund    = $B(out, 'laundromat',   35, 40);
    // NE セル: 上段住宅列 (kominka が焦点)
    const tnNW     = $B(out, 'townhouse',  -100, 20);
    const kominka  = $B(out, 'kominka',      80, 20);
    $B(out, 'house',     -160, 32);
    $B(out, 'townhouse',  -25, 40);
    $B(out, 'shed',      -135, 75);
    $B(out, 'greenhouse',  55, 75);
    $B(out, 'mansion',   130, 60);
    $B(out, 'townhouse', 165, 42);
    // SW セル: 下段住宅列 (mansion が焦点)
    $B(out, 'house',      -100, 120);
    const mansionSW = $B(out, 'mansion',    -160, 130);
    $B(out, 'townhouse',   -55, 138);
    $B(out, 'garage',     -130, 178);
    $B(out, 'shed',        -50, 180);
    // SE セル: 公園エリア (建物は周辺の小屋のみ、焦点は家具)
    $B(out, 'kura',        175, 178);
    // タイトパッキング補強 (子ども向け店・道場・住宅店舗)
    $B(out, 'wagashi',     -90, 60);
    $B(out, 'snack',        20, 60);
    $B(out, 'dojo',        100, 60);
    $B(out, 'kura',       -160, 70);
    $B(out, 'kimono_shop', -100, 178);
    $B(out, 'shed',       -160, 180);

    // ═══════════════════════════════════════════════════════════
    // FURNITURE (順序保持)
    // ═══════════════════════════════════════════════════════════
    // ── SE 焦点: 児童公園 (基本形 A) ──
    const playStruct = $F(out, 'play_structure', 90, 145);  // ★ HERO FOCAL
    const swing      = $F(out, 'swing_set',      50, 140);
    const slide      = $F(out, 'slide',         130, 140);
    const sandbox1   = $F(out, 'sandbox',        90, 175);
    $F(out, 'jungle_gym', 155, 175); $F(out, 'sandbox', 60, 178);
    // 公園内のベンチ・遊び場の取り巻き
    const benchNorth = $F(out, 'bench', 30, 125);    // 入口側 (avenue 寄り)
    const benchEast  = $F(out, 'bench', 150, 125);   // 入口側 (kura 寄り)
    $F(out, 'bench', 110, 180); $F(out, 'bench', 50, 180);
    $F(out, 'flower_planter_row', 60, 108);
    $F(out, 'flower_bed', 50, 108); 
    const parkGarbage = $F(out, 'garbage', 30, 145); // ★ park livingTrace
    $F(out, 'garbage', 155, 145);
    $F(out, 'cat', 122, 180); $F(out, 'cat', 70, 130);
    // 公園の外周 (境界)
    const hedgeS1    = $F(out, 'hedge', 30, 195);
    const hedgeS2    = $F(out, 'hedge', 90, 195);
    const hedgeS3    = $F(out, 'hedge', 165, 195);
    $F(out, 'hedge', 30, 165); $F(out, 'hedge', 175, 130);

    // ── NW 商店フロント (コンビニ + ランドロマット) ──
    const convAwning = $F(out, 'shop_awning', -45, 30);  // convenience の屋根
    $F(out, 'shop_awning', 35, 30);
    const convSign   = $F(out, 'a_frame_sign', -62, 24);
    const convVend   = $F(out, 'vending', -32, 24);
    const convBike   = $F(out, 'bicycle_rack', -45, 60); // ★ shop livingTrace
    $F(out, 'newspaper_stand', -28, 56);
    $F(out, 'a_frame_sign', 18, 28); 
    $F(out, 'bicycle', 55, 56); $F(out, 'post_box', -68, 56);

    // ── NE 上段 住宅 facade (kominka 邸とその取り巻き) ──
    $F(out, 'mailbox', -100, 8);
    const kominkaMail = $F(out, 'mailbox', 80, 8);   // ★ kominka facade
    $F(out, 'mailbox', -160, 22); $F(out, 'mailbox', 165, 22);
    const kominkaAc   = $F(out, 'ac_unit', 165, 56);
    const kominkaPot  = $F(out, 'potted_plant', 130, 60);
    const kominkaLaun = $F(out, 'laundry_pole', -135, 90); // ★ NE livingTrace (邸間の物干し)

    // ── SW 下段 住宅 facade (mansion 邸とその取り巻き) ──
    const mansionMail = $F(out, 'mailbox', -160, 122); // ★ mansion facade
    const mansionAc   = $F(out, 'ac_unit', -160, 158);
    $F(out, 'laundry_pole', -160, 158);
    const swLaundry   = $F(out, 'laundry_balcony', -55, 130); // ★ SW livingTrace
    const mansionFb   = $F(out, 'flower_bed', -160, 150);
    $F(out, 'bicycle', -55, 158);

    // ── 連続軸: 桜並木 (Ch0-Ch5、handoff:'next') ──
    $F(out, 'sakura_tree', -135, 30); $F(out, 'sakura_tree', 90, 100);
    $F(out, 'sakura_tree', -170, 170); 

    // ── 連続軸: 電柱+電線 (4 隅、各 power_line と対) ──
    $F(out, 'power_pole', -178, 90); $F(out, 'power_line', -175, 88);
    $F(out, 'power_pole',  178, 90); $F(out, 'power_line',  175, 88);
    $F(out, 'power_pole', -178, 195); $F(out, 'power_line', -175, 192);
    $F(out, 'power_pole',  178, 195); $F(out, 'power_line',  175, 192);

    // ── 動線: avenue 横断地点 (公園入口を avenue から導く) ──
    const manholeAve = $F(out, 'manhole_cover', 0, 100);
    const manhole2   = $F(out, 'manhole_cover', 60, 100);
    const mirrorEW   = $F(out, 'street_mirror', 30, 92);   // park access mirror
    $F(out, 'street_mirror', 150, 92);
    $F(out, 'bollard', -65, 92); $F(out, 'bollard', 62, 92);  // §6 2-5px shift

    // ── 焦点コントラスト維持版 (v6.4): タイトパッキングを撤去し、
    //   各セルに「呼吸」の余地を作る。境界の意味的フェンスのみ残す。
    // ロット境界フェンス (アンビエント NW/NE 間 + SW/SE 間の柔らかい境界)
    $F(out, 'wood_fence', -120, 152); $F(out, 'wood_fence', -120, 175); // SW ロット
    // 路地猫 1-2 匹のみ (5 匹は多すぎ)
    // 各アンビエントセルに最低 1 個の生活痕跡 (cluster.livingTrace と別に)
    $F(out, 'garbage', -160, 88);                            // NW 店裏
    // 焦点 (SE 公園) 周辺の柔らかい境界 (visible park boundary)
    $F(out, 'flower_planter_row', -100, 175);                // SW 住宅前花壇

    // ═══════════════════════════════════════════════════════════
    // CLUSTERS (§3.6 ヒーロー/アンビエント / §4 公園モデル 4 層)
    // ═══════════════════════════════════════════════════════════
    // ★ HERO: SE 児童公園 (オープンスペース焦点 = 基本形 A)
    _CLUSTER(out, {
      id: 'ch1.SE.park',
      role: 'hero',
      cell: 'SE',
      focal: playStruct,
      companions: [swing, slide, sandbox1, benchNorth, benchEast],
      boundary: [hedgeS1, hedgeS2, hedgeS3],
      access: [manholeAve, manhole2, mirrorEW],  // avenue → 公園入口の動線
      livingTrace: parkGarbage,
    });

    // AMBIENT: NW 商店フロント (convenience 焦点)
    _CLUSTER(out, {
      id: 'ch1.NW.shopfront',
      role: 'ambient',
      cell: 'NW',
      focal: conv,
      companions: [convAwning, convSign, convVend],
      livingTrace: convBike,
    });

    // AMBIENT: NE 住宅街 (kominka 邸を焦点とする)
    _CLUSTER(out, {
      id: 'ch1.NE.kominka',
      role: 'ambient',
      cell: 'NE',
      focal: kominka,
      companions: [kominkaMail, kominkaAc, kominkaPot],
      livingTrace: kominkaLaun,
    });

    // AMBIENT: SW 住宅街 (mansion 邸を焦点とする)
    _CLUSTER(out, {
      id: 'ch1.SW.mansion',
      role: 'ambient',
      cell: 'SW',
      focal: mansionSW,
      companions: [mansionMail, mansionAc, mansionFb],
      livingTrace: swLaundry,
    });

    // ═══════════════════════════════════════════════════════════
    // HUMANS
    // ═══════════════════════════════════════════════════════════
    out.humans = [
      // 公園 (子どもと見守る大人)
      _H(90, 175),  _H(155, 178), 
       
      // 商店利用客
      _H(-45, 58), 
      _H(80, 30),
      // 住宅街の生活者
       
      _H(-50, 178), 
    ];

    // ═══════════════════════════════════════════════════════════
    // GROUNDS (ベース → 焦点 → ロット → 動線 の 4 層)
    // ═══════════════════════════════════════════════════════════
    out.grounds = [
      // ── v7.1 Ch1 児童公園: residential_tile + 公園 grass 全面 + 砂場 dirt ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE
      _G('grass', 90, 150, 180, 100),                            // ★ SE 公園 全面 (建物の punch なし)
      _G('dirt', 90, 175, 100, 40),                              // 砂場 大きく
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },

  // ── S1-Ch2: 保育園・診療所・郵便局が並ぶ生活公共区画 ──
  // 焦点: 保育園 + 診療所 + 郵便局の3連公共ファサード、中央に歩道橋
  // 取り巻き: 保育園庭の遊具・送迎の親子、診療所のベンチと待ち人、郵便局のポスト・旗・自転車
  // 境界: 公共施設前の concrete + tile タイル、guardrail と bollard の道路境界
  // 動線: 歩道橋を渡る親子、外来患者の待機列、郵便局利用者、横断地点の通行人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 公共3連
      _B('daycare', -110, 22), _B('clinic', 25, 22), _B('post_office', 130, 22),
      // 公共施設の補助 (奥行き)
      _B('dojo', -75, 68), _B('townhouse', 145, 68), _B('greenhouse', -150, 72),
      _B('wagashi', 60, 70),
      // 下段 住宅街 (公共区画の対岸)
      _B('kominka', -100, 130), _B('duplex', 100, 130),
      _B('house', -170, 138), _B('townhouse', -45, 138), _B('house', 145, 138),
      _B('house', 60, 138),
      _B('garage', -160, 175), _B('shed', -130, 178), _B('greenhouse', 50, 175),
      _B('kura', 145, 170), _B('shed', -45, 178),
      // タイトパッキング補強 (公共圏の周辺商店)
      _B('kimono_shop', -25, 70), _B('wagashi', -45, 70), _B('kura', 165, 70),
      _B('snack', -75, 170), _B('sushi_ya', 100, 170),
    ],
    furniture: [
      // ── 焦点: 保育園庭 (送迎エリア) ──
      _F('swing_set', -140, 70), _F('slide', -80, 80),
      _F('jungle_gym', -130, 82), _F('sandbox', -95, 78),
      _F('flag_pole', -110, 40), _F('flower_planter_row', -110, 40),
      _F('shop_awning', -110, 30),
      // 保育園の境界
      _F('hedge', -150, 60), _F('hedge', -70, 60),
      // ── 焦点: 診療所前 (待合) ──
      _F('bench', 15, 38), _F('bench', -15, 38),
      _F('a_frame_sign', -22, 28),
      _F('bicycle_rack', 30, 60),
      // ── 焦点: 郵便局前 (ポスト・旗) ──
      _F('post_box', 110, 35), _F('post_letter_box', 92, 35),
      _F('flag_pole', 160, 38), _F('mailbox', 132, 35),
      _F('bicycle_rack', 140, 50), _F('bicycle', 132, 50),
      _F('flower_planter_row', 110, 40), _F('shop_awning', 110, 30),
      _F('a_frame_sign', 88, 28),
      // ── 道路境界・歩道橋 ──
      
      _F('traffic_light', -90, 92), _F('traffic_light', 90, 92),
      _F('guardrail_short', -30, 100), _F('guardrail_short', 30, 100),
      _F('bollard', -60, 92), _F('bollard', 60, 92),
      // ── 下段 住宅 facade ──
      _F('mailbox', -170, 120), _F('mailbox', -45, 122),
      _F('laundry_pole', -130, 158), _F('laundry_balcony', 150, 140),
      _F('bicycle', -45, 158),
      // ── 連続軸: 桜並木 (Ch0-Ch5) ──
      _F('sakura_tree', -165, 72), _F('sakura_tree', 165, 72),
      _F('sakura_tree', -45, 180),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 公共施設前の街路ミラー ──
      _F('manhole_cover', 0, 100),
      _F('street_mirror', -150, 92), _F('street_mirror', 150, 92),
      // ── _TOP_HR (Ch3 への接続): 信号・街灯・ガードレール・地面素材の連続 ──
      _F('traffic_light', -90, 192), _F('traffic_light', 90, 192),
      
      _F('guardrail_short', -55, 198), _F('guardrail_short', 55, 198),
      _F('manhole_cover', -30, 198), _F('manhole_cover', 30, 198),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('flower_bed', -75, 60),
      _F('manhole_cover', -100, 108), _F('manhole_cover', 100, 108),
      _F('bollard', -65, 92), _F('bollard', 65, 92),
      _F('garbage', -150, 88), _F('garbage', 150, 88),
      _F('cable_junction_box', -130, 188), _F('cable_junction_box', 130, 188),
      _F('cat', -130, 60), _F('cat', 130, 60),
      // ── 境界・その他 ──
      _F('bench', 130, 150),
    ],
    // ▼ v6.3 cluster: NW+NE = HERO 公共3連 (merged) / SW+SE = AMBIENT 住宅
    clusters: [
      // ★ HERO: 公共3連 (daycare + clinic + post_office) — merged 上段
      { id: 'ch2.merged.civic_trio', role: 'hero', cell: 'merged',
        focal: { kind: 'b', i: 1 },           // clinic 中央
        companions: [
          { kind: 'b', i: 0 },                // daycare
          { kind: 'b', i: 2 },                // post_office
          { kind: 'f', i: 0 },                // swing_set 保育園庭
          { kind: 'f', i: 1 },                // slide
        ],
        livingTrace: { kind: 'f', i: 3 },     // sandbox 保育園 (生活痕跡)
      },
      // AMBIENT: SW 住宅 (kominka が焦点)
      { id: 'ch2.SW.kominka', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 7 },           // kominka (-100,130)
        companions: [
          { kind: 'b', i: 9 },                // house (-170,138)
          { kind: 'b', i: 10 },               // townhouse (-45,138)
          { kind: 'b', i: 14 },               // shed (-130,178) 裏物置
        ],
      },
      // AMBIENT: SE 住宅 (duplex が焦点)
      { id: 'ch2.SE.duplex', role: 'ambient', cell: 'SE',
        focal: { kind: 'b', i: 8 },           // duplex (100,130)
        companions: [
          { kind: 'b', i: 11 },               // house (145,138)
          { kind: 'b', i: 12 },               // house (60,138)
          { kind: 'b', i: 16 },               // kura (145,170) 裏蔵
        ],
      },
    ],
    humans: [
      // 保育園送迎
      _H(-120, 82), 
      // 診療所外来
      _H(15, 38), 
      // 郵便局利用者
       
      // 歩道橋・横断
      _H(0, 60), 
      // 住宅街の住人 + _TOP_HR 横断
       _H(155, 50), 
      
      _H(-170, 138), 
    ],
    grounds: [
      // ── v7.1 Ch2 公共 3 連: residential_tile + 公共 stone_pavement 上段全幅 ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE
      _G('stone_pavement', 0, 60, 360, 100),                     // ★ 上段全幅 公共広場 (Stage 3 流)
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + 公共施設前アクセス道 (T字交差点) + Ch3 への上端接続
    horizontalRoads: [_MID_HR, _TOP_HR, _HR(60, -160, 160)],
    verticalRoads: [_AVE],
  } },

  // ═══ Act II: 生活と小商店 (Ch3-Ch5) ═══════════════════════════════════
  // 桜並木継続。商店街の予兆 (テラス / 銭湯 / civic plaza) を順に。

  // ── S1-Ch3: 3連カフェテラスと小商店の並び ──
  // 焦点: ベーカリー + 本屋 + カフェの3連テラス (オーニング・パラソル・ベンチ・花壇・自転車列)
  // 取り巻き: 各店の a_frame_sign / chouchin / 客 / 自販機・新聞スタンド、上段の生活店舗
  // 境界: wood_deck テラス + concrete 歩道、住宅街から商店街への変化を地面素材で示す
  // 動線: テラス席の客、店前の歩行者、自転車で立ち寄る客、上段ランドリー・薬局利用者
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 3連テラス
      _B('bakery', -112, 122), _B('bookstore', 25, 122), _B('cafe', 112, 122),
      // 商店街の予兆 (上段)
      _B('laundromat', 42, 40), _B('pharmacy', 125, 40), _B('florist', -45, 40),
      _B('shop', -160, 38), _B('shop', 75, 60), _B('cafe', -75, 60),
      // 上段 住宅と生活店
      _B('townhouse', -110, 38), _B('mansion', -100, 64),
      _B('chaya', -160, 70), _B('greenhouse', 155, 72),
      _B('wagashi', -25, 60), _B('sushi_ya', 50, 60),
      // 下段 残り (テラス周辺と端 — 専門店を増やす)
      _B('townhouse', -55, 152), _B('townhouse', 65, 152),
      _B('shed', -170, 178), _B('garage', -45, 178), _B('greenhouse', 55, 178), _B('shed', 165, 178),
      _B('house', 165, 132), _B('house', -160, 132),
      _B('snack', -110, 178), _B('wagashi', 30, 165), _B('kimono_shop', 130, 165),
      _B('chaya', -130, 178),
    ],
    furniture: [
      // ── 焦点: 3連テラスの各店帰属 ──
      // bakery
      _F('shop_awning', -112, 132), _F('a_frame_sign', -112, 144),
      _F('parasol', -132, 154), _F('parasol', -100, 154), _F('parasol', -125, 162),
      _F('bench', -132, 160), _F('bench', -100, 160), _F('bench', -112, 168),
      _F('flower_planter_row', -132, 168),
      _F('chouchin', -112, 122), _F('chouchin', -100, 122), _F('chouchin', -125, 122),
      _F('bicycle', -132, 176), _F('bicycle', -100, 176), _F('bicycle_rack', -120, 176),
      _F('newspaper_stand', -90, 145),
      // bookstore (中央)
      
      _F('parasol', -22, 154), _F('parasol', 22, 154),
      _F('bench', -22, 162), _F('bench', 22, 162),
      _F('newspaper_stand', -22, 144), _F('newspaper_stand', 22, 144),
      _F('bicycle_rack', 22, 176), _F('bicycle', -22, 176),
      _F('chouchin', 18, 122), _F('chouchin', -18, 122),
      // cafe
      _F('shop_awning', 112, 132), _F('a_frame_sign', 112, 144),
      _F('parasol', 92, 154), _F('parasol', 132, 154), _F('parasol', 112, 168),
      _F('bench', 92, 160), _F('bench', 132, 160), _F('bench', 112, 168),
      _F('flower_planter_row', 132, 168),
      _F('chouchin', 112, 122), _F('chouchin', 130, 122), _F('chouchin', 95, 122),
      _F('cat', 148, 172), _F('bicycle', 130, 176), _F('bicycle_rack', 92, 176),
      // ── テラス両端の店 (florist / 生活店) ──
      _F('shop_awning', -160, 132), _F('a_frame_sign', -160, 152),
      _F('newspaper_stand', -170, 170), _F('flower_bed', -150, 168),
      _F('shop_awning', 165, 122), _F('a_frame_sign', 165, 152),
      // ── 上段 商店フロント ──
      _F('shop_awning', 42, 30), _F('shop_awning', 125, 30), _F('shop_awning', -45, 30),
      _F('shop_awning', -75, 50), _F('shop_awning', -160, 30),
      _F('a_frame_sign', 42, 56), _F('a_frame_sign', 125, 56), _F('a_frame_sign', -45, 56),
      _F('a_frame_sign', -75, 72), _F('a_frame_sign', -160, 56),
      _F('vending', 125, 56), _F('vending', -22, 56), _F('vending', 60, 56),
      _F('vending', -75, 72), _F('vending', 100, 56),
      _F('bicycle_rack', 60, 56), _F('bicycle_rack', 145, 56), _F('bicycle_rack', -75, 72),
      _F('newspaper_stand', 100, 30), _F('chouchin', 42, 30), _F('chouchin', 125, 30),
      _F('chouchin', -45, 30), _F('chouchin', -75, 50),
      // ── 上段 住宅 facade ──
      _F('mailbox', -160, 22), _F('mailbox', -110, 22), _F('mailbox', -100, 60),
      _F('hedge', -130, 60), _F('hedge', -90, 60),
      // ── 上段 裏路地 (生活痕跡) ──
      _F('garbage', -150, 88), _F('garbage', 150, 88),
      _F('cable_junction_box', -130, 88), _F('cable_junction_box', 30, 88),
      _F('cat', -130, 32),
      // ── 下段 住宅 facade ──
      _F('laundry_pole', -110, 168), _F('laundry_pole', 40, 168), _F('laundry_balcony', 165, 140),
      _F('laundry_balcony', -160, 140),
      // ── 下段 裏路地 + 生活痕跡 ──
      // ── 連続軸: 桜並木 (Ch0-Ch5) ──
      _F('sakura_tree', -160, 95), _F('sakura_tree', 160, 95),
      _F('sakura_tree', -75, 90),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 街灯 + ガードレール ──
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -65, 92), _F('bollard', 65, 92), _F('bollard', -30, 108), _F('bollard', 30, 108),
      
      _F('street_mirror', -75, 92),
      // ── 境界・植栽 ──
    ],
    // ▼ v6.3 cluster: SW+SE = HERO 3連テラス (merged)
    clusters: [
      // ★ HERO: 3連カフェテラス (基本形 C = 3 棟連続焦点)
      { id: 'ch3.merged.terrace_trio', role: 'hero', cell: 'merged',
        focal: { kind: 'b', i: 1 },           // bookstore 中央 (25,122)
        companions: [
          { kind: 'b', i: 0 },                // bakery (-112,122)
          { kind: 'b', i: 2 },                // cafe (112,122)
          { kind: 'f', i: 0 },                // shop_awning bakery
          { kind: 'f', i: 1 },                // a_frame_sign bakery
        ],
        livingTrace: { kind: 'f', i: 1 },     // a_frame_sign (テラス開店中の痕跡)
      },
      // AMBIENT: NW 住宅+商店 (florist+townhouse)
      { id: 'ch3.NW.residential_shops', role: 'ambient', cell: 'NW',
        focal: { kind: 'b', i: 5 },           // florist (-45,40)
        companions: [
          { kind: 'b', i: 6 },                // shop (-160,38)
          { kind: 'b', i: 9 },                // townhouse (-110,38)
          { kind: 'b', i: 10 },               // mansion (-100,64)
        ],
      },
      // AMBIENT: NE 住宅+商店 (laundromat+pharmacy)
      { id: 'ch3.NE.shops', role: 'ambient', cell: 'NE',
        focal: { kind: 'b', i: 4 },           // pharmacy (125,40)
        companions: [
          { kind: 'b', i: 3 },                // laundromat (42,40)
          { kind: 'b', i: 7 },                // shop (75,60)
          { kind: 'b', i: 12 },               // greenhouse (155,72)
        ],
      },
    ],
    humans: [
      // テラス客 (3連) — 各店3-4人
      _H(-132, 158),  
      _H(-22, 158),  _H(0, 168),
       _H(120, 168),
      // テラス両端
      
      // 上段 商店利用客
      _H(125, 56),  _H(-75, 72),
    ],
    grounds: [
      // ── v7.1 Ch3 朝のカフェテラス: residential_tile + wood_deck テラス全幅 ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE
      _G('wood_deck', 0, 150, 360, 100),                         // ★ 下段全幅 wood_deck (3 連テラス)
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + 北西側の商店搬入路 (商店街裏)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE, _VR(-130, 0, 100)],
  } },

  // ── S1-Ch4: 銭湯風施設と生活商店の交差点 ──
  // 焦点: 銭湯入口 (onsen_inn + bathhouse_chimney + noren + chouchin + 牛乳ケース)
  // 取り巻き: 入口前のベンチ・自販機・湯上がり客、商店フロント (スーパー・薬局・ラーメン)
  // 境界: tile の銭湯入口、asphalt の商店駐車場、residential_tile の住宅街
  // 動線: 銭湯入口の湯上がり客、買い物客、ラーメン店待ち列、住宅前の住人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 銭湯
      _B('onsen_inn', -118, 38),
      // 商店列 (上段)
      _B('supermarket', 45, 42), _B('pharmacy', 120, 42), _B('shop', -75, 42),
      // 焦点周辺 (下段ラーメンと住宅)
      _B('ramen', -40, 122), _B('townhouse', 95, 132),
      // 上段 補助
      _B('chaya', -155, 70), _B('greenhouse', 78, 72), _B('mansion', 165, 60),
      _B('dojo', -75, 68),
      // 下段 住宅街
      _B('house', -160, 132), _B('townhouse', -110, 138), _B('house', 165, 138),
      _B('garage', -160, 178), _B('kura', -75, 178), _B('greenhouse', 50, 178), _B('kura', 145, 178),
      // タイトパッキング補強 (銭湯文化の周辺商店・娯楽)
      _B('kimono_shop', 135, 70),
      _B('mahjong_parlor', -25, 152), _B('sushi_ya', 25, 152),
    ],
    furniture: [
      // ── 焦点: 銭湯入口 ──
      _F('bathhouse_chimney', -145, 72),
      _F('noren', -118, 28), _F('chouchin', -118, 22),
      _F('shop_awning', -118, 30), _F('a_frame_sign', -118, 56),
      _F('bench', -82, 38), _F('bench', -100, 56),
      _F('vending', -150, 32), _F('vending', -90, 56),
      _F('cat', -75, 56), _F('cat', -135, 88),
      _F('bicycle', -82, 56),
      // ── 商店フロント (上段) ──
      _F('shop_awning', 45, 30), _F('shop_awning', 120, 30), _F('shop_awning', -75, 30),
      _F('a_frame_sign', 45, 56), _F('a_frame_sign', 120, 56), _F('a_frame_sign', -75, 56),
      _F('vending', 75, 56), _F('newspaper_stand', 100, 56),
      _F('bicycle_rack', 68, 58), _F('bicycle_rack', 145, 56),
      _F('flower_planter_row', 45, 56),
      _F('mailbox', -75, 22), _F('mailbox', 165, 22),
      // ── ラーメン店 (下段) 帰属 ──
      _F('shop_awning', -40, 132), _F('chouchin', -40, 122), _F('noren', -40, 138),
      _F('a_frame_sign', -40, 148),
      _F('vending', -60, 148), _F('bicycle', -22, 158),
      // ── 下段 住宅 facade ──
      _F('mailbox', -160, 120),
      _F('laundry_balcony', 92, 158), _F('laundry_pole', -160, 158),
      _F('bicycle', 95, 158),
      // ── 連続軸: 桜並木 (Ch0-Ch5) ──
      _F('sakura_tree', -25, 85), _F('sakura_tree', 25, 85),
      _F('sakura_tree', 165, 90),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 街灯・ガードレール ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -65, 92), _F('bollard', 65, 92),
      _F('guardrail_short', 35, 108), _F('guardrail_short', -35, 108),
      _F('street_mirror', -75, 92), _F('street_mirror', 75, 92),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -150, 50), _F('hedge', -75, 50),
      _F('flower_bed', -100, 60),
      _F('flower_planter_row', -45, 175),
      _F('garbage', -150, 88), _F('garbage', 150, 88),
      _F('cable_junction_box', -130, 88), _F('cable_junction_box', 130, 88),
      // ── 境界・植栽 ──
      _F('bench', 65, 152),
    ],
    // ▼ v6.3 cluster: NW = HERO 銭湯
    clusters: [
      // ★ HERO: 銭湯 (onsen_inn + bathhouse_chimney + noren で識別)
      { id: 'ch4.NW.bathhouse', role: 'hero', cell: 'NW',
        focal: { kind: 'b', i: 0 },           // onsen_inn (-118,38)
        companions: [
          { kind: 'f', i: 0 },                // bathhouse_chimney (-145,72)
          { kind: 'f', i: 1 },                // noren
          { kind: 'f', i: 2 },                // chouchin
          { kind: 'f', i: 3 },                // shop_awning
        ],
      },
      // AMBIENT: NE スーパー+薬局
      { id: 'ch4.NE.commerce', role: 'ambient', cell: 'NE',
        focal: { kind: 'b', i: 1 },           // supermarket (45,42)
        companions: [
          { kind: 'b', i: 2 },                // pharmacy (120,42)
          { kind: 'b', i: 7 },                // greenhouse (78,72)
          { kind: 'b', i: 8 },                // mansion (165,60)
        ],
      },
      // AMBIENT: SW ラーメン+住宅
      { id: 'ch4.SW.ramen', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 4 },           // ramen (-40,122)
        companions: [
          { kind: 'b', i: 10 },               // house (-160,132)
          { kind: 'b', i: 11 },               // townhouse (-110,138)
        ],
      },
    ],
    humans: [
      // 銭湯客
      _H(-118, 42),  
      _H(-145, 60), 
      // 商店利用客
       _H(75, 56),
      // ラーメン店
       
      // 住宅街
      _H(95, 138),  
      _H(-160, 138), 
    ],
    grounds: [
      // ── v7.1 Ch4 銭湯+スーパー: residential_tile + concrete 下段全幅 ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE 上段
      _G('concrete', 0, 150, 360, 100),                          // ★ 下段全幅 商店帯
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + 銭湯と商店の境の短い縦路地 (十字交差点感)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE, _VR(-45, 0, 100)],
  } },

  // ── S1-Ch5: 小さな公共広場と civic plaza ──
  // 焦点: 中央広場 (plaza_tile_circle + statue + fountain_large + ベンチ・花壇外周)
  // 取り巻き: 公共施設4連 (郵便局・銀行・市役所・図書館) + 用途差小物 (post_box / atm / 旗)
  // 境界: stone_pavement の広場面、tile の施設前デッキ、grass の外周
  // 動線: 広場で休む人、噴水近くの市民、施設入口の利用客、カフェの客
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 公共施設4連
      _B('post_office', -130, 42), _B('bank', -45, 42), _B('city_hall', 65, 38),
      _B('library', 140, 42),
      // 広場の一角: カフェと小商店
      _B('cafe', 120, 122), _B('shop', -45, 132),
      // 上段 補助
      _B('shop', -100, 60), _B('shed', -160, 78),
      _B('greenhouse', 100, 72),
      // 下段 (広場周辺住宅と店)
      _B('townhouse', -160, 132), _B('house', -100, 138),
      _B('garage', -160, 178), _B('shed', -110, 178), _B('shed', 60, 178), _B('shed', 165, 178),
      _B('shed', -45, 178), _B('townhouse', 80, 175),
      // タイトパッキング補強 (公共施設前のサテライト商店・道場)
      _B('kimono_shop', -75, 60), _B('wagashi', 30, 60),
      _B('sushi_ya', -160, 22), _B('shed', 30, 178), _B('kimono_shop', 175, 38),
    ],
    furniture: [
      // ── 焦点: 中央広場 ──
      _F('fountain_large', 32, 150),
      _F('flower_bed', -40, 145),
      
      // 広場外周のベンチ (滞留)
      _F('bench', -70, 130), _F('bench', 78, 132),
      _F('bench', -110, 178), _F('bench', 110, 178),
      _F('bench', -50, 168), _F('bench', 50, 168),
      _F('cat', -110, 168), _F('cat', 60, 178),
      _F('newspaper_stand', -130, 152), _F('garbage', 130, 168),
      // ── 公共施設の用途差 ──
      // post_office 帰属
      _F('post_box', -150, 30), _F('post_letter_box', -110, 30),
      _F('shop_awning', -130, 30), _F('flag_pole', -150, 62),
      _F('flower_planter_row', -130, 56), _F('mailbox', -120, 35),
      // bank 帰属
      _F('atm', -45, 30), _F('atm', -28, 30),
      _F('shop_awning', -45, 30), _F('flag_pole', -22, 62),
      _F('flower_planter_row', -45, 56), _F('bollard', -65, 60),
      // city_hall 帰属
      _F('shop_awning', 65, 28), _F('flag_pole', 30, 62), _F('flag_pole', 95, 62),
      _F('statue', 65, 60),
      // library 帰属
      _F('shop_awning', 140, 30), _F('flag_pole', 150, 62),
      _F('a_frame_sign', 140, 56),
      _F('bicycle_rack', -75, 56), _F('bicycle_rack', 100, 56), _F('bicycle_rack', 165, 56),
      // ── 下段 cafe 帰属 ──
      _F('parasol', 120, 140), _F('parasol', 100, 152),
      _F('shop_awning', 120, 132), _F('a_frame_sign', 120, 152),
      _F('chouchin', 120, 122),
      // ── 下段 住宅 facade ──
      _F('mailbox', -160, 122), _F('mailbox', -100, 122),
      _F('laundry_pole', -130, 158),
      // ── 連続軸: 桜並木 (Ch0-Ch5) ──
      _F('sakura_tree', -150, 95),
      _F('sakura_tree', 150, 95),
      _F('sakura_tree', -75, 95),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 街灯・ガードレール ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100), _F('manhole_cover', -60, 100),
      _F('bollard', -65, 92), _F('bollard', 65, 92),
      _F('guardrail_short', -45, 108), _F('guardrail_short', 45, 108),
      _F('street_mirror', -75, 92), _F('street_mirror', 75, 92),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -150, 18), _F('hedge', -100, 18),
      _F('garbage', -150, 88),
      _F('cable_junction_box', -130, 188), _F('cable_junction_box', 130, 188),
      _F('bench', -150, 168), _F('bench', 150, 168),
      // ── 境界 ──
    ],
    // ▼ v6.3 cluster: SW+SE = HERO civic plaza (merged) / NW+NE = AMBIENT 公共
    clusters: [
      // ★ HERO: civic plaza (statue + plaza_tile_circle で識別)
      { id: 'ch5.merged.civic_plaza', role: 'hero', cell: 'merged',
        focal: { kind: 'f', i: 1 },           // statue (-8,148)
        companions: [
          { kind: 'f', i: 0 },                // plaza_tile_circle (0,145)
          { kind: 'f', i: 2 },                // fountain_large (32,150)
        ],
      },
      // AMBIENT: NW 公共施設 (post_office + bank)
      { id: 'ch5.NW.public', role: 'ambient', cell: 'NW',
        focal: { kind: 'b', i: 0 },           // post_office (-130,42)
        companions: [
          { kind: 'b', i: 1 },                // bank (-45,42)
          { kind: 'b', i: 6 },                // shop (-100,60)
          { kind: 'b', i: 7 },                // shed (-160,78)
        ],
      },
      // AMBIENT: NE 公共施設 (city_hall + library)
      { id: 'ch5.NE.civic', role: 'ambient', cell: 'NE',
        focal: { kind: 'b', i: 2 },           // city_hall (65,38)
        companions: [
          { kind: 'b', i: 3 },                // library (140,42)
          { kind: 'b', i: 8 },                // greenhouse (100,72)
        ],
      },
    ],
    humans: [
      // 公共施設利用者
      _H(-130, 55),  
      _H(-110, 60), 
      _H(65, 30),
      // 広場で滞留
       _H(50, 168),
      
      _H(30, 145), 
      // カフェ・周辺
       _H(-110, 178), 
       
    ],
    grounds: [
      // ── v7.1 Ch5 civic plaza: ★ 下段全幅 stone_pavement クライマックス ──
      _G('residential_tile', 0, 60, 360, 100),                   // 上段 BASE
      _G('stone_pavement', 0, 150, 360, 100),                    // ★★ 下段全幅 plaza (Act II climax)
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue のみ (広場の面感、側道なしで開けたシビックスペース)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  } },

  // ═══ Act III: ローカル商店街 (Ch6-Ch8) ═══════════════════════════════
  // 連続軸: tree (街路樹) に切り替え。学校 → 商店街 → 駅 へ。

  // ── S1-Ch6: 小学校キャンパスと通学路 ──
  // 焦点: 小学校 (校門・校庭・遊具・国旗・銅像) + 通学路の信号と横断地点
  // 取り巻き: 校門前の旗・植栽、校庭の砂場・ブランコ・滑り台・ジャングルジム、見守り親
  // 境界: dirt の校庭面、grass の外周、tile の玄関ポーチ、guardrail で道路境界
  // 動線: 校門の児童・保護者・横断歩道の通学児・東側商店の客・見守りの大人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 小学校
      _B('school', -70, 38),
      // 学校隣の保育園 (送迎の親子)
      _B('daycare', 95, 42),
      // 東側 商店列
      _B('bookstore', 80, 122), _B('shop', 145, 122), _B('cafe', 35, 122),
      // 上段 補助
      _B('shed', -150, 78), _B('shed', 50, 78), _B('greenhouse', 145, 72),
      _B('mansion', 130, 28), _B('kimono_shop', 165, 38),
      // 下段 住宅街
      _B('house', -150, 132), _B('townhouse', -110, 138), _B('house', -45, 138),
      _B('townhouse', 25, 158),
      _B('kura', -170, 170), _B('garage', -110, 178), _B('shed', -45, 178),
      _B('greenhouse', 60, 175), _B('sushi_ya', 90, 170), _B('kura', 130, 170), _B('wagashi', 170, 158),
      // タイトパッキング補強 (通学路の店と道場)
      _B('dojo', -130, 60), _B('snack', 30, 60),
      _B('shed', -25, 78), _B('shed', 165, 178),
    ],
    furniture: [
      // ── 焦点: 学校玄関と校庭 ──
      _F('flag_pole', -120, 68), _F('flag_pole', -20, 68),
      _F('statue', -70, 76),
      _F('shop_awning', -70, 30), _F('a_frame_sign', -70, 56),
      _F('flower_planter_row', -100, 56), _F('flower_planter_row', -40, 56),
      _F('post_box', -120, 56), _F('bicycle_rack', -20, 56),
      // 校庭の遊具 (児童の遊び場)
      _F('play_structure', -92, 145), _F('swing_set', -135, 145), _F('slide', -50, 145),
      _F('sandbox', -92, 175), _F('jungle_gym', -20, 165), _F('jungle_gym', -135, 175),
      _F('sandbox', -50, 175),
      _F('bench', -150, 162), _F('bench', -20, 145), _F('bench', -90, 110),
      _F('flower_bed', -150, 192),
      _F('cat', -135, 168),
      // ── 通学路 (信号・横断地点) ──
      _F('traffic_light', -90, 92),
      _F('guardrail_short', -35, 100), _F('guardrail_short', 35, 100),
      _F('bollard', -55, 92), _F('bollard', 55, 92),
      _F('street_mirror', -110, 92),
      // ── daycare 帰属 ──
      _F('shop_awning', 95, 30), _F('a_frame_sign', 95, 56),
      _F('flag_pole', 130, 60),
      _F('swing_set', 130, 80), _F('slide', 60, 80),
      _F('sandbox', 95, 78),
      // ── 東側 商店街 (下段) ──
      _F('shop_awning', 80, 132), _F('shop_awning', 145, 132), _F('shop_awning', 35, 132),
      _F('a_frame_sign', 80, 152), _F('a_frame_sign', 145, 152), _F('a_frame_sign', 35, 152),
      _F('chouchin', 80, 122), _F('chouchin', 145, 122), _F('chouchin', 35, 122),
      _F('parasol', 35, 145), _F('bench', 35, 158),
      _F('bicycle_row', 110, 150), _F('vending', 170, 150),
      _F('newspaper_stand', 100, 152), _F('cat', 160, 170),
      // ── 下段 住宅 facade ──
      _F('mailbox', -150, 122), _F('mailbox', -110, 122), _F('mailbox', -45, 122),
      
      _F('laundry_pole', -130, 158), _F('laundry_balcony', -45, 130),
      // ── 連続軸: tree (Ch6-Ch8) ──
      _F('tree', -170, 110), _F('tree', 25, 110), _F('tree', 170, 110),
      _F('tree', -110, 188), _F('tree', 65, 188),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 通学路の街路ミラー ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('street_mirror', -110, 92), _F('street_mirror', 110, 92),
      // ── _TOP_HR (Ch7 への通学路接続): 信号・街灯・ガードレール・地面素材の連続 ──
      _F('traffic_light', -90, 192), _F('traffic_light', 90, 192),
      _F('street_lamp', -150, 195),
      _F('guardrail_short', -55, 198), _F('guardrail_short', 55, 198),
      _F('guardrail_short', -135, 198),
      _F('manhole_cover', -30, 198), _F('manhole_cover', 30, 198),
      _F('bollard', -65, 195), _F('bollard', 65, 195),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -150, 18), _F('hedge', 165, 18),
      _F('manhole_cover', -100, 108), _F('manhole_cover', 100, 108),
      _F('garbage', -150, 88), _F('garbage', 150, 88),
      _F('cable_junction_box', -130, 88), _F('cable_junction_box', 130, 88),
      // ── 境界 ──
    ],
    // ▼ v6.3 cluster: 全マージ HERO 小学校キャンパス
    clusters: [
      // ★ HERO: 小学校 (school + daycare 校門 + 校庭)
      { id: 'ch6.merged.school_campus', role: 'hero', cell: 'merged',
        focal: { kind: 'b', i: 0 },           // school (-70,38)
        companions: [
          { kind: 'b', i: 1 },                // daycare (95,42)
          { kind: 'f', i: 0 },                // jungle_gym (校庭)
          { kind: 'f', i: 1 },                // swing_set
          { kind: 'f', i: 2 },                // slide
        ],
      },
      // AMBIENT: SE 商店列 (3店)
      { id: 'ch6.SE.shops', role: 'ambient', cell: 'SE',
        focal: { kind: 'b', i: 2 },           // bookstore (80,122)
        companions: [
          { kind: 'b', i: 3 },                // shop (145,122)
          { kind: 'b', i: 4 },                // cafe (35,122)
        ],
      },
    ],
    humans: [
      // 校門・校庭 (児童と見守り)
      _H(-120, 68),  _H(-20, 165),
      
      // 通学路・横断
      _H(-90, 92),
      // 保育園 送迎
      
      // 東側 商店利用客
      _H(145, 132), 
      // 住宅街 + _TOP_HR 横断 (通学児)
       
      _H(-30, 192), 
       _H(170, 60), 
    ],
    grounds: [
      // ── v7.1 Ch6 小学校全マージ: concrete 上段 + dirt 校庭下段全幅 ──
      _G('concrete', 0, 60, 360, 100),                           // 上段 校舎前
      _G('dirt', 0, 150, 360, 100),                              // ★★ 下段全幅 校庭 (Act III 名物)
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + 校庭横の縦路地 (下半分のみ) + Ch7 への上端接続
    horizontalRoads: [_MID_HR, _TOP_HR],
    verticalRoads: [_AVE, _VR(-30, 100, 200)],
  } },

  // ── S1-Ch7: 昼の提灯アーケード商店街 ──
  // 焦点: 6連の店舗ファサード (ramen / izakaya / bookstore / cafe / shop / game_center) のアーケード
  // 取り巻き: 提灯アーチ・暖簾・banner_pole・各店の a_frame_sign・自販機・自転車置き場・客
  // 境界: wood_deck のアーケード歩道、tile の店前、residential_tile の裏側住宅街
  // 動線: アーケードを歩く客、店前の客、自転車で立ち寄る客、裏路地の住人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 6連店舗
      _B('ramen', -145, 38), _B('izakaya', -95, 38), _B('bookstore', -35, 38),
      _B('cafe', 35, 38), _B('shop', 95, 38), _B('game_center', 150, 38),
      // 上段 補助 (店舗の奥)
      _B('shed', -125, 78), _B('shed', -25, 78), _B('shed', 55, 78), _B('shed', 165, 78),
      _B('greenhouse', 110, 72), _B('shed', -75, 78), _B('shed', 25, 78),
      // 下段 住宅街 (アーケード裏)
      _B('house', -140, 132),
      _B('townhouse', -100, 138), _B('house', -45, 138), _B('townhouse', 40, 138),
      _B('house', 110, 138), _B('mansion', 165, 138),
      _B('garage', -160, 178), _B('sushi_ya', -45, 178), _B('kura', 110, 178),
      _B('snack', 50, 178), _B('kura', -110, 178),
      _B('mahjong_parlor', -75, 165), _B('kimono_shop', 75, 165), _B('wagashi', 165, 178),
    ],
    furniture: [
      // ── 焦点: アーケードの提灯アーチ ──
      _F('chouchin', -160, 34), _F('chouchin', -132, 34), _F('chouchin', -110, 34),
      _F('chouchin', -88, 34), _F('chouchin', -65, 34), _F('chouchin', -45, 34),
      _F('chouchin', -28, 34),
      _F('chouchin', 28, 34), _F('chouchin', 65, 34), _F('chouchin', 88, 34),
      _F('chouchin', 110, 34), _F('chouchin', 132, 34), _F('chouchin', 142, 34),
      _F('chouchin', 165, 34),
      _F('chouchin', -110, 90), _F('chouchin', -40, 90),
      _F('chouchin', 40, 90), _F('chouchin', 110, 90), _F('chouchin', 150, 90),
      _F('chouchin', -150, 90), _F('chouchin', -75, 90), _F('chouchin', 75, 90),
      _F('banner_pole', -55, 95), _F('banner_pole', 55, 95),
      _F('banner_pole', -150, 60), _F('banner_pole', 150, 60),
      // ── 各店の帰属 (オーニング・暖簾・看板) ──
      // ramen
      _F('shop_awning', -145, 30), _F('noren', -145, 28),
      _F('a_frame_sign', -145, 56), _F('vending', -160, 56),
      _F('bench', -130, 60), _F('bench', -160, 70),
      _F('bicycle', -130, 70),
      // izakaya
      _F('shop_awning', -95, 30), _F('noren', -95, 28),
      _F('a_frame_sign', -95, 56), _F('vending', -120, 56),
      _F('chouchin', -95, 22),
      _F('bench', -75, 56), _F('bicycle', -75, 70),
      // bookstore
      _F('shop_awning', -35, 30), _F('noren', -35, 28),
      _F('a_frame_sign', -35, 56), _F('newspaper_stand', -55, 56),
      _F('bicycle_rack', -22, 60), _F('bicycle', -22, 70), _F('bicycle', -45, 70),
      _F('flower_planter_row', -35, 60),
      // cafe
      _F('shop_awning', 35, 30), _F('a_frame_sign', 35, 56),
      _F('parasol', 22, 56), _F('parasol', 50, 56), _F('parasol', 35, 70),
      _F('bench', 35, 62), _F('flower_planter_row', 35, 60),
      _F('bench', 22, 70), _F('bench', 50, 70),
      _F('chouchin', 35, 22),
      // shop
      _F('shop_awning', 95, 30), _F('a_frame_sign', 95, 56),
      _F('vending', 120, 56), _F('bicycle_rack', 70, 56),
      _F('bicycle', 70, 70), _F('bicycle', 95, 70),
      _F('chouchin', 95, 22),
      // game_center
      _F('shop_awning', 150, 30), _F('a_frame_sign', 150, 56),
      _F('chouchin', 150, 22), _F('vending', 165, 56),
      _F('bicycle_row', 130, 60), _F('bicycle', 130, 70), _F('bicycle', 165, 70),
      _F('newspaper_stand', 165, 70),
      // ── 上段 裏側 (店舗の奥) ──
      _F('garbage', -160, 92), _F('garbage', 160, 92),
      _F('cable_junction_box', -130, 88), _F('cable_junction_box', 130, 88),
      _F('cat', -80, 88), _F('cat', 80, 88),
      // ── 下段 住宅 facade ──
      _F('mailbox', -140, 120), _F('mailbox', -100, 122), _F('mailbox', -45, 122),
      _F('laundry_balcony', 165, 140), _F('laundry_pole', -100, 158),
      _F('laundry_pole', 40, 158), _F('laundry_balcony', -140, 140),
      _F('laundry_pole', 110, 158), _F('laundry_balcony', -45, 130),
      _F('hedge', -120, 130), _F('hedge', 60, 130),
      // ── 下段 裏路地 ──
      _F('bicycle', -100, 168), _F('bicycle', 100, 168),
      _F('bicycle_rack', -22, 168), _F('bicycle_rack', 22, 168),
      // ── 連続軸: tree (Ch6-Ch8) ──
      _F('tree', -170, 110), _F('tree', 170, 110),
      _F('tree', -75, 188), _F('tree', 75, 188), _F('tree', 130, 188),
      _F('tree', -130, 188), _F('tree', 25, 188),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('power_pole', -178, 50), _F('power_line', -175, 48),
      _F('power_pole', 178, 50), _F('power_line', 175, 48),
      // ── avenue 地点小物 + 街灯 + ガードレール ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -65, 92), _F('bollard', 65, 92), _F('bollard', -30, 108), _F('bollard', 30, 108),
      _F('guardrail_short', -45, 92), _F('guardrail_short', 45, 92),
      _F('guardrail_short', -45, 108), _F('guardrail_short', 45, 108),
      _F('street_mirror', -75, 92),
      // ── 境界 ──
      _F('flower_bed', -130, 195),
    ],
    // ▼ v6.3 cluster: NW+NE = HERO 提灯アーケード (merged)
    clusters: [
      // ★ HERO: 提灯アーケード (chouchin 14+ 本のアーチが識別)
      { id: 'ch7.merged.chouchin_arcade', role: 'hero', cell: 'merged',
        focal: { kind: 'b', i: 2 },           // bookstore (-35,38) 中央
        companions: [
          { kind: 'b', i: 0 },                // ramen (-145,38)
          { kind: 'b', i: 1 },                // izakaya (-95,38)
          { kind: 'b', i: 3 },                // cafe (35,38)
          { kind: 'b', i: 5 },                // game_center (150,38)
        ],
      },
      // AMBIENT: SW 住宅+裏路地
      { id: 'ch7.SW.residential', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 13 },          // house (-140,132)
        companions: [
          { kind: 'b', i: 14 },               // townhouse (-100,138)
          { kind: 'b', i: 15 },               // house (-45,138)
        ],
      },
      // AMBIENT: SE 住宅+裏路地
      { id: 'ch7.SE.residential', role: 'ambient', cell: 'SE',
        focal: { kind: 'b', i: 18 },          // mansion (165,138)
        companions: [
          { kind: 'b', i: 16 },               // townhouse (40,138)
          { kind: 'b', i: 17 },               // house (110,138)
        ],
      },
    ],
    humans: [
      // アーケードの客 (各店フロント)
      _H(-145, 55),  _H(95, 55), 
       _H(-160, 70), 
       _H(-22, 70), 
      // アーケードを歩く人
       _H(55, 95), 
      // 裏側 住宅街
      _H(110, 145), 
      _H(40, 145), 
    ],
    grounds: [
      // ── v7.1 Ch7 提灯アーケード: tile アーケード床全幅 + concrete 周辺 ──
      _G('concrete', 0, 100, 360, 200),                          // BASE
      _G('tile', 0, 100, 360, 80),                               // ★★ 中央 80px 全幅 tile (アーケード床)
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue のみ (アーケード歩行帯、車道なしの歩行者専用感)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  } },
  // ── S1-Ch8: 地方の小駅と駅前ロータリー ──
  // 焦点: 駅舎 + プラットフォーム + 線路 + 駅前ロータリー (タクシー乗り場・バス停)
  // 取り巻き: 待ち人・新聞スタンド・自販機・自転車置き場・ベンチ・旗・信号塔
  // 境界: asphalt のロータリー、stone_pavement の駅前広場、tile の店舗フロント
  // 動線: 駅の待ち人・バス待ち・タクシー待ち・店利用客・歩道の通行人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 駅
      _B('train_station', 95, 22),
      // 駅前商店
      _B('bookstore', -120, 42), _B('cafe', -45, 42), _B('shop', -160, 42),
      _B('ramen', 50, 122), _B('convenience', -120, 138),
      // 上段 補助
      _B('shed', -90, 78),
      _B('greenhouse', 35, 38), _B('shed', 165, 78),
      // 下段 住宅街
      _B('townhouse', 130, 132), _B('house', -160, 138), _B('shop', -40, 138),
      _B('house', 165, 138), _B('wagashi', 95, 178),
      _B('garage', -160, 178), _B('sushi_ya', -110, 178), _B('snack', -40, 178),
      _B('kura', 165, 178),
      // タイトパッキング補強 (駅前のバス停と小商店)
      _B('bus_terminal_shelter', -75, 60), _B('wagashi', 25, 178),
      _B('shed', -25, 78), _B('shed', 65, 78), _B('shed', 130, 78),
      _B('kura', 60, 170),
    ],
    furniture: [
      // ── 焦点: 駅舎 + プラットフォーム + 線路 ──
      _F('platform_edge', 95, 72), _F('railway_track', 95, 86), _F('railway_track', 95, 78),
      _F('signal_tower', 95, 95),
      _F('flag_pole', 65, 60), _F('flower_planter_row', 95, 60),
      _F('shop_awning', 95, 30),
      // 駅前ロータリー (バス停・タクシー)
      _F('taxi_rank_sign', 135, 58), _F('taxi_rank_sign', 145, 70),
      _F('bus_stop', 48, 60), _F('bus_stop', 70, 78),
      _F('bench', 70, 62), _F('bench', 110, 62), _F('bench', 50, 78),
      _F('bench', 135, 80),
      _F('newspaper_stand', 145, 42), _F('newspaper_stand', 30, 56),
      _F('vending', 155, 56), _F('vending', 30, 78),
      _F('bicycle_rack', 80, 82), _F('bicycle_row', 130, 90),
      _F('a_frame_sign', 135, 78),
      _F('manhole_cover', 95, 80), _F('bollard', 75, 60),
      _F('bollard', 115, 60),
      // ── 駅前 商店フロント (上段) ──
      _F('shop_awning', -120, 30), _F('shop_awning', -45, 30), _F('shop_awning', -160, 30),
      _F('a_frame_sign', -120, 56), _F('a_frame_sign', -45, 56), _F('a_frame_sign', -160, 56),
      _F('vending', -85, 56), _F('vending', -22, 56),
      _F('newspaper_stand', -160, 70), _F('parasol', -45, 56),
      _F('bicycle_rack', -100, 56),
      _F('chouchin', -45, 22),
      _F('cat', -150, 170),
      // ── ramen 帰属 (下段) ──
      _F('shop_awning', 50, 132), _F('chouchin', 50, 122), _F('noren', 50, 130),
      _F('a_frame_sign', 50, 152),
      _F('vending', 75, 148), _F('bicycle', 35, 158),
      // ── convenience 帰属 ──
      _F('shop_awning', -120, 130), _F('a_frame_sign', -120, 152),
      _F('vending', -100, 152), _F('newspaper_stand', -140, 152),
      _F('bicycle_rack', -100, 162),
      // ── 下段 住宅 facade ──
      _F('mailbox', -160, 120), _F('mailbox', -40, 122), _F('mailbox', 130, 122),
      _F('laundry_pole', 130, 158),
      // ── 連続軸: tree (Ch6-Ch8) → pine_tree へ handoff ──
      _F('tree', -170, 110), _F('tree', -45, 188),
      _F('tree', 65, 188),
      _F('pine_tree', -170, 190), _F('pine_tree', 170, 188),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 駅前ロータリー脇 (x=+90) の街路ミラー ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('street_mirror', 95, 92), _F('street_mirror', 130, 100),
      _F('street_mirror', -100, 92),
      _F('bollard', -65, 92), _F('bollard', 65, 92),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -150, 18), _F('hedge', -100, 18),
      _F('flower_bed', -100, 70),
      _F('flower_planter_row', -130, 65),
      _F('garbage', -150, 88), _F('garbage', 165, 88),
      _F('cable_junction_box', -90, 88), _F('cable_junction_box', 130, 88),
      _F('cat', -130, 60),
      // ── 境界 ──
      _F('guardrail_short', 35, 92), _F('guardrail_short', 155, 92),
    ],
    // ▼ v6.3 cluster: NE = HERO 地方の小駅
    clusters: [
      // ★ HERO: train_station + platform_edge + railway_track 駅
      { id: 'ch8.NE.train_station', role: 'hero', cell: 'NE',
        focal: { kind: 'b', i: 0 },           // train_station (95,22)
        companions: [
          { kind: 'f', i: 0 },                // platform_edge
          { kind: 'f', i: 1 },                // railway_track
          { kind: 'f', i: 3 },                // signal_tower
          { kind: 'b', i: 18 },               // bus_terminal_shelter (-75,60)
        ],
      },
      // AMBIENT: NW 駅前商店
      { id: 'ch8.NW.station_shops', role: 'ambient', cell: 'NW',
        focal: { kind: 'b', i: 1 },           // bookstore (-120,42)
        companions: [
          { kind: 'b', i: 2 },                // cafe (-45,42)
          { kind: 'b', i: 3 },                // shop (-160,42)
        ],
      },
      // AMBIENT: SW 住宅+商店
      { id: 'ch8.SW.residential', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 5 },           // convenience (-120,138)
        companions: [
          { kind: 'b', i: 9 },                // house (-160,138)
          { kind: 'b', i: 10 },               // shop (-40,138)
        ],
      },
    ],
    humans: [
      // 駅の待ち人 (ホーム端)
      _H(95, 62), 
      // バス待ち / タクシー待ち
       _H(70, 78), 
      // 駅前店 (上段)
       _H(-160, 56),
      // 下段 ramen / convenience
      
      // 歩道
      _H(110, 62), 
       _H(165, 138), 
    ],
    grounds: [
      // ── v7.1 Ch8 地方の小駅: concrete + tile ホーム + asphalt 駅裏 ──
      _G('concrete', 0, 100, 360, 200),                          // BASE
      _G('tile', 90, 60, 180, 100),                              // ★ NE 駅+ホーム 全面
      _G('asphalt', 90, 150, 180, 100),                          // ★ SE 駅裏全面
      _G('stone_pavement', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + 駅前ロータリー周回道 (右側のみ、駅とロータリーをつなぐ)
    horizontalRoads: [_MID_HR, _HR(70, 30, 180)],
    verticalRoads: [_AVE],
  } },

  // ═══ Act IV: 街はずれ (Ch9-Ch11) ═══════════════════════════════════════
  // 連続軸: pine_tree に切り替え。郊外感 / 倉庫 / 踏切 で Stage 2 (夜街) へ handoff。

  // ── S1-Ch9: 田園農家と畑のある街はずれ ──
  // 焦点: 古民家農家 + greenhouse + grain_silo + 木柵で囲った畑 + 水タンク
  // 取り巻き: 蓄水・水たまり・農機具 (milk_crate / pallet) ・農作業中の人・農家の猫
  // 境界: grass の田園面、dirt の畑パッチ複数、wood_fence の畑区画
  // 動線: 農作業中の人・農道を歩く人・農家前の人・小商店利用者
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 農家集落
      _B('kominka', 105, 122), _B('greenhouse', 145, 150),
      _B('kura', 70, 155), _B('greenhouse', 95, 75),
      // 街はずれの住宅・小商店 (街の終端)
      _B('house', -135, 42), _B('garage', -90, 60), _B('shop', 40, 42),
      _B('house', -160, 70),
      // 上段 補助
      _B('shed', -50, 78), _B('mansion', 165, 60),
      _B('kominka', -25, 70),
      // 下段 補助 (物置・温室・町家・蔵)
      _B('kura', -160, 138), _B('machiya', -100, 138), _B('kura', -45, 138),
      _B('greenhouse', -130, 178), _B('wagashi', -60, 178), _B('kura', 30, 178),
      _B('kura', 175, 178),
      // タイトパッキング補強 (農地ヤード)
      _B('kura', 60, 60), _B('kura', 130, 60), _B('kura', -160, 178),
      _B('greenhouse', 65, 175),
    ],
    furniture: [
      // ── 焦点: 農家本体 (kominka 帰属) ──
      _F('grain_silo', 150, 130),
      _F('water_tank', 130, 165), _F('water_tank', 165, 110),
      _F('mailbox', 105, 105), _F('laundry_pole', 80, 145),
      _F('cat', 72, 170), _F('cat', 105, 145),
      // 畑の囲い (wood_fence)
      _F('wood_fence', 65, 118), _F('wood_fence', 105, 145), _F('wood_fence', 145, 185),
      // 畑の生活痕跡
      _F('puddle_reflection', 95, 170), _F('puddle_reflection', 130, 195),
      _F('rock', 125, 175), _F('rock', 80, 130), _F('rock', 165, 170),
      _F('pallet_stack', 75, 175), _F('flower_bed', 75, 188),
      _F('flower_planter_row', 95, 165),
      // ── 街の終端: shop / garage 帰属 ──
      _F('shop_awning', 40, 30), _F('a_frame_sign', 40, 56),
      _F('vending', 60, 56), _F('newspaper_stand', 20, 56),
      _F('flower_planter_row', 40, 56),
      _F('barrier', -90, 76), _F('traffic_cone', -120, 76),
      _F('drum_can', -90, 76), _F('cable_junction_box', -65, 88),
      // ── 上段 住宅 facade ──
      _F('mailbox', -160, 22), _F('mailbox', 40, 22),
      _F('laundry_pole', -115, 70),
      // ── 下段 物置・農道沿い ──
      _F('garbage', -100, 158),
      _F('pallet_stack', -130, 168), _F('garbage', -60, 178),
      _F('rock', -120, 188),
      // ── 連続軸: pine_tree (Ch9-Ch11) ──
      _F('pine_tree', -170, 90),
      _F('pine_tree', -130, 188), _F('pine_tree', -45, 188),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ── avenue 地点小物 + 農道脇の街路ミラー ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', -30, 100),
      _F('street_mirror', -100, 92),
      _F('bollard', -65, 92),
      // ── x=+90 側の濡れ路面 (Ch11 踏切までの漸進) ──
      _F('puddle_reflection', 165, 100), _F('puddle_reflection', 130, 90),
      _F('puddle_reflection', 145, 195),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -150, 18), _F('hedge', -100, 18),
      _F('rock', 75, 70), _F('rock', 130, 75),
      _F('cable_junction_box', -45, 88),
      _F('pallet_stack', 60, 88), _F('pallet_stack', -150, 168),
      _F('drum_can', -130, 88),
      // ── 境界 ──
      _F('rock', 130, 195),
    ],
    // ▼ v6.3 cluster: SE = HERO 田園農家
    clusters: [
      // ★ HERO: 農家本体 (kominka + grain_silo + water_tank が識別)
      { id: 'ch9.SE.farmhouse', role: 'hero', cell: 'SE',
        focal: { kind: 'b', i: 0 },           // kominka (105,122)
        companions: [
          { kind: 'b', i: 1 },                // greenhouse (145,150)
          { kind: 'b', i: 2 },                // kura (70,155)
          { kind: 'f', i: 0 },                // grain_silo
          { kind: 'f', i: 1 },                // water_tank
        ],
        livingTrace: { kind: 'f', i: 4 },     // laundry_pole (80,145)
      },
      // AMBIENT: NW 街はずれの住宅
      { id: 'ch9.NW.outskirt_homes', role: 'ambient', cell: 'NW',
        focal: { kind: 'b', i: 4 },           // house (-135,42)
        companions: [
          { kind: 'b', i: 5 },                // garage (-90,60)
          { kind: 'b', i: 7 },                // house (-160,70)
        ],
      },
      // AMBIENT: SW 町家+蔵集落
      { id: 'ch9.SW.machiya', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 12 },          // machiya (-100,138)
        companions: [
          { kind: 'b', i: 11 },               // kura (-160,138)
          { kind: 'b', i: 13 },               // kura (-45,138)
        ],
      },
    ],
    humans: [
      // 農作業中
      _H(105, 140), 
      // 農家前 / 農道
      _H(145, 145),
      // 街の終端 (商店・住宅)
       
      _H(165, 138), 
      // 物置・農道
      
      _H(60, 178),
    ],
    grounds: [
      // ── v7.1 Ch9 田園農家: grass 全面 + dirt 畑大 ──
      _G('grass', 0, 100, 360, 200),                             // ★★ BASE 田園
      _G('dirt', -90, 150, 180, 100),                            // ★ SW 畑全面
      _G('dirt', 90, 150, 180, 100),                             // ★ SE 畑全面
      _G('asphalt', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue のみ (田園の生活道路、側道なしで街の終端感)
    horizontalRoads: [_MID_HR],
    verticalRoads: [_AVE],
  } },

  // ── S1-Ch10: 街はずれの倉庫と消防分署 ──
  // 焦点: warehouse 2連 + fire_station + police_station の作業ヤード
  // 取り巻き: パレット・コンテナ・ドラム缶・コーン・barrier・フォークリフト・作業員
  // 境界: asphalt の作業面、concrete の倉庫前、grass の外周、guardrail の道路境界
  // 動線: 倉庫前の作業員、消防・警察詰所の待機人、道路沿いの通行人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点: 作業ヤード
      _B('warehouse', -120, 42), _B('warehouse', -45, 42),
      _B('fire_station', 65, 42), _B('police_station', 135, 42),
      _B('warehouse', 50, 132),
      // 上段 補助
      _B('shed', -160, 78), _B('shed', 35, 78), _B('shed', 170, 78),
      // 下段 補助 (生活要素を残す)
      _B('garage', -135, 132), _B('house', 95, 132), _B('townhouse', 145, 138),
      _B('kura', -170, 170), _B('kura', -75, 170), _B('garage', 30, 178),
      _B('kura', 95, 170), _B('kura', 165, 170), _B('kura', -120, 170),
      // タイトパッキング補強 (倉庫ヤードと裏側、生活痕跡)
      _B('shed', -85, 60), _B('shed', 30, 60), _B('shed', 110, 60),
      _B('shed', -25, 78), _B('snack', 60, 170), _B('wagashi', -45, 170),
    ],
    furniture: [
      // ── 焦点: 倉庫前ヤード (作業員エリア) ──
      _F('traffic_cone', -155, 62), _F('traffic_cone', -135, 78),
      _F('barrier', -100, 64), _F('barrier', -160, 80),
      _F('pallet_stack', -70, 68), _F('pallet_stack', -120, 76),
      _F('cargo_container', -35, 70),
      _F('drum_can', -150, 70), _F('drum_can', -75, 78),
      _F('forklift', -65, 88), _F('forklift', -25, 80),
      _F('cable_junction_box', -35, 84), _F('cable_junction_box', -100, 84),
      _F('cat', -150, 170),
      // ── 消防分署・警察詰所 ──
      _F('fire_watchtower', 65, 78),
      _F('flag_pole', 92, 60), _F('flag_pole', 135, 60),
      _F('a_frame_sign', 65, 56), _F('a_frame_sign', 135, 56),
      _F('barrier', 65, 62), _F('barrier', 135, 62),
      _F('traffic_cone', 100, 62), _F('traffic_cone', 30, 62), _F('traffic_cone', 165, 62),
      _F('drum_can', 25, 60), _F('bollard', 50, 60),
      // ── 道路境界 ──
      
      _F('guardrail_short', -160, 100), _F('guardrail_short', 160, 100),
      _F('guardrail_short', -30, 100),
      // ── 下段 facade ──
      _F('mailbox', -135, 122), _F('mailbox', 95, 122), _F('mailbox', 145, 122),
      _F('garbage', -100, 178), _F('garbage', -75, 168),
      _F('pallet_stack', -140, 178), _F('barrier', 50, 178),
      _F('drum_can', 70, 158),
      _F('laundry_pole', 95, 158),
      // ── 連続軸: pine_tree (Ch9-Ch11) ──
      _F('pine_tree', -170, 110), _F('pine_tree', 170, 110),
      
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      // ── avenue 地点小物 + 倉庫前の街路ミラー ──
      _F('manhole_cover', 0, 100), _F('manhole_cover', 60, 100),
      _F('street_mirror', -100, 92), _F('street_mirror', 100, 92),
      // ── _TOP_HR (Ch11 への接続): 信号・街灯・ガードレール・地面素材の連続 ──
      _F('traffic_light', -90, 192), _F('traffic_light', 90, 192),
      _F('street_lamp', 150, 195),
      _F('guardrail_short', -55, 198), _F('guardrail_short', 55, 198),
      _F('guardrail_short', 135, 198),
      _F('manhole_cover', -30, 198), _F('manhole_cover', 30, 198),
      _F('bollard', -65, 195), _F('bollard', 65, 195),
      // ── x=+90 側の濡れ路面 (Ch11 踏切への前兆) ──
      _F('puddle_reflection', 130, 180), _F('puddle_reflection', 100, 198),
      _F('puddle_reflection', 165, 165),
      // ── 電柱+電線 (下端、_TOP_HR の奥) ──
      _F('power_pole', -178, 198), _F('power_line', -175, 196),
      _F('power_pole', 178, 198), _F('power_line', 175, 196),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -160, 18), _F('hedge', 165, 18),
      _F('flower_bed', -100, 60),
      _F('drum_can', -30, 62),
      _F('pallet_stack', 60, 70), _F('pallet_stack', -110, 70),
      _F('manhole_cover', -100, 108), _F('manhole_cover', 100, 108),
      _F('flower_planter_row', -150, 175),
      _F('drum_can', -75, 188),
      _F('pallet_stack', 75, 188), _F('pallet_stack', 165, 168),
      _F('cat', -130, 60),
      // ── 境界・植栽 ──
    ],
    // ▼ v6.3 cluster: NW+NE = HERO 倉庫消防 (merged)
    clusters: [
      // ★ HERO: 倉庫+消防分署 (warehouse 3つ + fire_station + police_station)
      { id: 'ch10.merged.warehouse_civic', role: 'hero', cell: 'merged',
        focal: { kind: 'b', i: 2 },           // fire_station (65,42) 中央分署
        companions: [
          { kind: 'b', i: 0 },                // warehouse (-120,42)
          { kind: 'b', i: 1 },                // warehouse (-45,42)
          { kind: 'b', i: 3 },                // police_station (135,42)
          { kind: 'b', i: 4 },                // warehouse (50,132)
        ],
      },
      // AMBIENT: SW 街はずれの住宅
      { id: 'ch10.SW.outskirt', role: 'ambient', cell: 'SW',
        focal: { kind: 'b', i: 8 },           // garage (-135,132)
        companions: [
          { kind: 'b', i: 11 },               // kura (-170,170)
          { kind: 'b', i: 12 },               // kura (-75,170)
          { kind: 'b', i: 16 },               // kura (-120,170)
        ],
      },
    ],
    humans: [
      // 倉庫前 作業員
      _H(-120, 62),  
      // 消防・警察 待機
      _H(65, 62), 
      // 下段 住宅・住人
      _H(95, 145), 
      // 道路通行人 + _TOP_HR 横断 (Ch11 へ)
      _H(-30, 192), 
       _H(60, 178), 
    ],
    grounds: [
      // ── v7.1 Ch10 郊外倉庫: asphalt + concrete 上段 + grass 下段 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('concrete', 0, 60, 360, 100),                           // ★ 上段全幅 倉庫+消防
      _G('grass', -90, 150, 180, 100),                           // ★ SW 空き地芝 (Ch9 から)
      _G('asphalt', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + Ch11 への上端接続 (倉庫搬入路は撤廃して衝突回避)
    horizontalRoads: [_MID_HR, _TOP_HR],
    verticalRoads: [_AVE],
  } },

  // ── S1-Ch11: 踏切と街はずれの終端 ──
  // 焦点: 踏切 (線路2本 + 遮断機 + 警報機 + 信号塔 + ガードレール)
  // 取り巻き: 踏切待ちの人・車止め・濡れた路面・水たまり、ラーメン店の提灯と暖簾
  // 境界: asphalt の路面、線路、tile の店前、grass の街はずれ余白
  // 動線: 踏切待ちの人、コンビニ・ガソリンスタンド利用者、ラーメン店の客、Stage 2 へ向かう人
  { patternId: 's1_raw', raw: {
    buildings: [
      // 焦点周辺: 街はずれの店列
      _B('gas_station', -135, 42), _B('convenience', -45, 42), _B('ramen', 70, 42),
      // 下段 (踏切手前)
      _B('machiya', -120, 132), _B('townhouse', -50, 132), _B('shop', 50, 132),
      _B('house', 145, 132),
      // 上段 補助
      _B('shed', -160, 78), _B('shed', -90, 78), _B('greenhouse', -25, 70),
      _B('shed', 110, 78), _B('mansion', 165, 60),
      _B('shed', 35, 78),
      // 下段 補助 (踏切前の古い蔵と町並み)
      _B('kura', -160, 170), _B('kura', -45, 170), _B('kura', 90, 170),
      _B('kura', 165, 170),
      // タイトパッキング補強 (踏切前のバス停と店)
      _B('bus_terminal_shelter', -75, 60), _B('kimono_shop', 130, 60),
      _B('shed', 65, 78),
    ],
    furniture: [
      // ── 焦点: 踏切 ──
      
      _F('railway_track', -45, 145), _F('railway_track', 45, 160),
      _F('railroad_crossing', -55, 145), _F('railroad_crossing', 55, 145),
      _F('signal_tower', -90, 150), _F('signal_tower', 90, 150),
      _F('barrier', -35, 132), _F('barrier', 35, 132),
      _F('barrier', -35, 168), _F('barrier', 35, 168),
      _F('traffic_cone', -75, 138), _F('traffic_cone', 75, 138),
      _F('traffic_cone', -75, 168), _F('traffic_cone', 75, 168),
      _F('guardrail_short', -135, 165), _F('guardrail_short', 135, 165),
      _F('puddle_reflection', -70, 178), _F('puddle_reflection', 80, 182),
      _F('puddle_reflection', 0, 178), _F('cable_junction_box', -120, 158),
      // ── ガソリンスタンド帰属 ──
      _F('shop_awning', -135, 30), _F('a_frame_sign', -135, 56),
      _F('drum_can', -160, 56), _F('drum_can', -110, 56),
      _F('drum_can', -135, 78), _F('barrier', -120, 60),
      _F('vending', -100, 60),
      // ── コンビニ帰属 ──
      _F('shop_awning', -45, 30), _F('a_frame_sign', -45, 56),
      _F('vending', -45, 58), _F('vending', -75, 58),
      _F('newspaper_stand', -20, 56), _F('bicycle_rack', -65, 60),
      _F('garbage', -22, 60),
      // ── ラーメン店帰属 (夜街予兆) ──
      _F('shop_awning', 70, 30), _F('a_frame_sign', 70, 56),
      _F('chouchin', 70, 58), _F('noren', 70, 52),
      _F('chouchin', 50, 56), _F('chouchin', 90, 56),
      _F('chouchin', 70, 22),
      _F('bench', 90, 60), _F('bicycle', 50, 60),
      _F('vending', 110, 56),
      // ── 下段 facade (踏切待ち付近) ──
      _F('shop_awning', 50, 132), _F('chouchin', 50, 122),
      _F('a_frame_sign', 50, 152),
      _F('mailbox', -120, 120), _F('mailbox', 145, 122), _F('mailbox', -50, 120),
      _F('garbage', -120, 158),
      _F('laundry_pole', -50, 158),
      // ── 連続軸: pine_tree (Ch9-Ch11) ──
      _F('pine_tree', -170, 90), _F('pine_tree', 170, 90),
      _F('pine_tree', -100, 175),
      // ── 連続軸: 電柱+電線 ──
      _F('power_pole', -178, 90), _F('power_line', -175, 88),
      _F('power_pole', 178, 90), _F('power_line', 175, 88),
      // ── タイトパッキング (slim v6.4: 焦点コントラスト確保) ──
      _F('hedge', -160, 18), _F('hedge', -75, 18),
      _F('flower_bed', -45, 60),
      _F('drum_can', 165, 60), _F('drum_can', -100, 70),
      _F('cable_junction_box', -45, 88),
      _F('drum_can', -75, 188), _F('pallet_stack', 130, 188),
      _F('cat', -130, 60), _F('cat', 130, 60),
      // ── avenue 地点小物 + 踏切前の街路ミラー ──
      _F('manhole_cover', 0, 100),
      _F('street_mirror', -100, 130), _F('street_mirror', 100, 130),
      // ── _TOP_HR (Stage 2 接続): 信号・街灯・ガードレール・地面素材の連続 ──
      _F('traffic_light', -90, 192), _F('traffic_light', 90, 192),
      _F('street_lamp', -150, 195), _F('street_lamp', 150, 195),
      _F('guardrail_short', -55, 198), _F('guardrail_short', 55, 198),
      _F('guardrail_short', -135, 198), _F('guardrail_short', 135, 198),
      _F('manhole_cover', -30, 198), _F('manhole_cover', 30, 198),
      _F('bollard', -65, 195), _F('bollard', 65, 195),
      // ── x=+90 側の濡れ路面進行 (Ch9-Ch11 の終端感) ──
      _F('puddle_reflection', 110, 195), _F('puddle_reflection', 145, 178),
      // ── 電柱+電線 (下端、_TOP_HR の奥) ──
      _F('power_pole', -178, 198), _F('power_line', -175, 196),
      _F('power_pole', 178, 198), _F('power_line', 175, 196),
      // ── 境界 ──
    ],
    // ▼ v6.3 cluster: SW+SE = HERO 踏切 (merged) — Stage 1 終端
    clusters: [
      // ★ HERO: 踏切 (railroad_crossing + signal_tower で識別、Stage 1 締め)
      { id: 'ch11.merged.railroad_crossing', role: 'hero', cell: 'merged',
        focal: { kind: 'f', i: 4 },           // railroad_crossing (-55,145)
        companions: [
          { kind: 'f', i: 0 },                // railway_track (0,145)
          { kind: 'f', i: 5 },                // railroad_crossing (55,145)
          { kind: 'f', i: 6 },                // signal_tower (-90,150)
          { kind: 'f', i: 7 },                // signal_tower (90,150)
        ],
      },
      // AMBIENT: NW ガソリンスタンド (gas_station 焦点)
      { id: 'ch11.NW.gas_station', role: 'ambient', cell: 'NW',
        focal: { kind: 'b', i: 0 },           // gas_station (-135,42)
        companions: [
          { kind: 'b', i: 1 },                // convenience (-45,42)
          { kind: 'b', i: 7 },                // shed (-160,78)
        ],
      },
      // AMBIENT: NE ramen + 周辺
      { id: 'ch11.NE.ramen', role: 'ambient', cell: 'NE',
        focal: { kind: 'b', i: 2 },           // ramen (70,42)
        companions: [
          { kind: 'b', i: 11 },               // mansion (165,60)
          { kind: 'b', i: 17 },               // bus_terminal_shelter (-75,60)
        ],
      },
    ],
    humans: [
      // 踏切待ち
      _H(-55, 145), 
      // ガソリンスタンド・コンビニ・ラーメン
      _H(-45, 58), 
      // 下段 住宅・店
      _H(145, 145), 
      // 通行人 + Stage 2 へ向かう人 (_TOP_HR 上)
       _H(-90, 192), 
       _H(0, 178),
    ],
    grounds: [
      // ── v7.1 Ch11 踏切: asphalt + dirt 線路全幅 + Stage 2 oil 予告 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('dirt', 0, 175, 360, 50),                               // ★ 線路の土全幅
      _G('oil_stained_concrete', 0, 145, 200, 30),               // ★ Stage 2 予告
      _G('asphalt', -65, 100, 24, 200),
    ],
    // 道路: 中央 avenue + Stage 2 への上端接続 (線路並行 HR は撤廃して衝突回避)
    horizontalRoads: [_MID_HR, _TOP_HR],
    verticalRoads: [_AVE],
  } },
];

// ─── Stage 2: 夜の歓楽街・飲食街 (v3.0 Stage 1 Ch1 同等密度版) ───────────────────
// 【全体の物語】: 終電後 23:30 の地方駅から朝 05:00 の神社表参道へ、ひと晩を 4 Acts × 12 Chunks で抜ける。
//   Act I  (Ch0-Ch2):  駅前繁華 (23:30-24:30) — 終電駅 / 3 連飲食 / アーケード入口
//   Act II (Ch3-Ch5):  歓楽街最盛期 (24:00-25:30) — 高層雑居 / ★パチンコ+交番交差点 / 横丁 5 連
//   Act III(Ch6-Ch8):  ホテルと屋台 (25:30-27:30) — ラブホ街 / 屋台横丁 (merged) / 映画館深夜上映
//   Act IV (Ch9-Ch11): 静寂への転換 (28:00-05:00) — 駐車場 / 神社の裏 / ★表参道 (Stage 3 handoff)
// 【Stage 2 固有の連続軸】:
//   chouchin / noren が Ch0-Ch7 で連続、Ch9 で 1 本だけ残し、Ch10-11 で消失 (寂寥カーブ)
//   puddle_reflection が全 chunk 2-4 個 (Ch4 = 4 個でピーク、Ch11 = 0 個で消失)
//   oil_stained_concrete が avenue 中央のアクセント、Ch9 駐車場で全面に到達
//   街路樹は Ch0-Ch5 で無し → Ch6 hedge → Ch10 bamboo_fence → Ch11 sakura_tree × 2 (Stage 3 予告)
//   電柱+電線 4 隅固定 (Stage 1 から継承) + cable_junction_box 増 (深夜の電気設備)
//   歩道帯 stone_pavement (x=-65) は Stage 1 から継続、Ch11 で太く展開し Stage 3 へ
// 【密度目安】: Stage 1 Ch1 と同等。建物 18+ / 家具 75+ / humans 12+ / grounds 12+ (上限なし)
// 【座標系】: dx ∈ [-180, +180] / dy ∈ [0, 200] チャンクローカル
const STAGE_2_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 駅前繁華 (Ch0-Ch2) ═══════════════════════════════════════

  // ── S2-Ch0: 終電後の地方駅と北口ロータリー ──  (時刻 23:30、終電直後)
  // ▼ ヒーロー: NE = 駅前広場 (基本形 A・オープンスペース焦点)
  // ▼ アンビエント 3 セル: NW = ビジネスホテル / SW = ramen+izakaya 食事街 / SE = convenience+cafe+bookstore
  // 駅舎の青ネオンとラーメン屋の赤提灯が同居する Stage 2 の入口。歩道帯 x=-65 は Stage 1 から継続。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR],                                          // 駅前は asphalt 大広場、_HR 1 本のみ
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS (spec §9.0 完全準拠) ═══
    // NE 焦点: 駅 (spec x=80, y=22)
    const station   = $B(out, 'train_station',   80, 22);                  // ★ HERO FOCAL 地方駅
    // NE 取り巻き: bus_terminal_shelter (spec x=30, y=65 必須)
    const busTerm   = $B(out, 'bus_terminal_shelter', 30, 65);             // ★ NE 取り巻き spec 必須
    // NW アンビエント: ビジネスホテル (spec x=-130, y=22)
    const hotelNW   = $B(out, 'business_hotel',-130, 22);                  // ★ NW 焦点
    // SW アンビエント: 終電客向け食事街 (spec ramen -160, izakaya -100)
    const ramenSW   = $B(out, 'ramen',         -160, 130);                 // ★ SW 焦点
    const izakaySW  = $B(out, 'izakaya',       -100, 130);                 // SW 取り巻き
    // SE アンビエント: 24h コンビニ + カフェ + 本屋 (spec 130/70/30)
    const convSE    = $B(out, 'convenience',   130, 130);                  // ★ SE 焦点
    const cafeSE    = $B(out, 'cafe',           70, 130);                  // SE 取り巻き (テラス)
    $B(out, 'bookstore',                        30, 130);                  // SE 取り巻き
    // 密度補強 (Stage 2 主役建物のみ、Stage 1 系 townhouse/shed/garage/shop は使わない)
    $B(out, 'capsule_hotel',                  -160, 65);                   // NW カプセル (ホテル裏)
    $B(out, 'snack',                           -50, 138);                  // SW snack (食事街拡張)
    $B(out, 'business_hotel',                 -178, 130);                  // SW 端 ホテル
    $B(out, 'snack',                           175, 22);                   // NE 隅 深夜 snack
    $B(out, 'capsule_hotel',                   175, 70);                   // NE カプセル
    $B(out, 'snack',                           165, 175);                  // SE 端 深夜 snack
    $B(out, 'mahjong_parlor',                 -125, 175);                  // SW 麻雀荘 (深夜営業)
    $B(out, 'snack',                            5, 178);                   // SE 中央 snack
    $B(out, 'capsule_hotel',                  -160, 195);                  // SW 端 カプセル
    $B(out, 'mahjong_parlor',                  175, 195);                  // SE 端 麻雀荘
    $B(out, 'snack',                          -178, 70);                   // NW 端 snack

    // ═══ FURNITURE ═══
    // ── NE 焦点 4 層: 駅前広場 ──
    // 焦点: ホーム + レール + 信号塔 (駅の物理構造)
    const platE     = $F(out, 'platform_edge',  50, 70);                   // ★ プラットホーム西端 (1 番線端)
    const platW     = $F(out, 'platform_edge', 110, 70);                   // プラットホーム東端
    $F(out, 'railway_track',     50, 78);                                  // 線路 1 番線 西
    $F(out, 'railway_track',     80, 80);                                  // 線路 1 番線 中央
    $F(out, 'railway_track',    110, 82);                                  // 線路 1 番線 東 (y=82 で 2px ずらし、レールの傾斜)
    $F(out, 'railway_track',     80, 86);                                  // 線路 2 番線
    const signal    = $F(out, 'signal_tower',  80, 95);                    // 信号塔 (駅前広場の縦アクセント)
    // 取り巻き (駅前広場): bench 4 不揃い + 旗ポール + 花壇 + バスシェルター
    const benchA    = $F(out, 'bench',          20, 85);                   // 西端 bench (avenue 寄り)
    const benchB    = $F(out, 'bench',          65, 85);                   // 西中 bench (45px 間隔)
    const benchC    = $F(out, 'bench',         120, 85);                   // 東中 bench (55px 不揃い)
    const benchD    = $F(out, 'bench',         165, 85);                   // 東端 bench
    $F(out, 'flower_planter_row', 30, 62);                                 // ホーム手前のプランター 西
    $F(out, 'flower_planter_row', 90, 62);                                 // ホーム手前のプランター 中央
    $F(out, 'flower_planter_row',150, 62);                                 // ホーム手前のプランター 東
    const flagA     = $F(out, 'flag_pole',      30, 62);                   // 駅旗 西
    const flagB     = $F(out, 'flag_pole',     130, 62);                   // 駅旗 東 (x=130、x=30 と非対称 ±30/±130)
    // 境界: bollard で avenue 横断帯 (準対称崩し ±2px シフト)
    const bolNW     = $F(out, 'bollard',       -65, 92);                   // 北西横断帯
    const bolNE     = $F(out, 'bollard',        62, 92);                   // 北東横断帯 (-65 vs +62 = §6 2-5px shift)
    const bolSW     = $F(out, 'bollard',      -150, 108);                  // 南西横断帯 (下段)
    $F(out, 'bollard',                         148, 108);                  // 南東横断帯
    // 動線: バス停 + タクシー乗場 + マンホール + 街灯
    const busA      = $F(out, 'bus_stop',       30, 88);                   // バス停 西 (y=88 で MID_HR 直上)
    const busB      = $F(out, 'bus_stop',      130, 88);                   // バス停 東
    $F(out, 'taxi_rank_sign',  145, 88);                                   // タクシー乗場 西
    $F(out, 'taxi_rank_sign',  165, 88);                                   // タクシー乗場 東 (15px 間隔で 2 個)
    const manAve    = $F(out, 'manhole_cover',  50, 100);                  // 駅前マンホール 西
    $F(out, 'manhole_cover',   110, 100);                                  // 駅前マンホール 東
    $F(out, 'manhole_cover',    80, 105);                                  // 駅前マンホール 中央 (3 個でリズム、y=105 ずらし)
    const lampNE_W  = $F(out, 'street_lamp',    30, 88);                   // 街灯 西
    const lampNE_E  = $F(out, 'street_lamp',   165, 88);                   // 街灯 東 (30 vs 165、§6 完全対称崩し)
    const newsNE    = $F(out, 'newspaper_stand', 80, 88);                  // ★ NE livingTrace 駅前新聞スタンド

    // ── NW アンビエント: ビジネスホテル ──
    const hotelSign = $F(out, 'sign_board',  -130, 22);                    // ★ NW facade 青ネオン
    const atmA      = $F(out, 'atm',         -150, 38);                    // ATM 西
    const atmB      = $F(out, 'atm',         -110, 38);                    // ATM 東 (ホテル 1F)
    const hotelMail = $F(out, 'mailbox',     -100, 22);                    // ★ NW livingTrace
    $F(out, 'a_frame_sign',      -110, 60);                                // 立て看板 (チェックイン案内)
    $F(out, 'cable_junction_box',-178, 60);                                // NW 端の配電箱

    // ── SW アンビエント: 終電客向け食事街 ──
    const ramenChouA = $F(out, 'chouchin',  -160, 118);                    // ★ ラーメン提灯 (赤、店前)
    $F(out, 'chouchin',          -100, 118);                               // 居酒屋提灯
    $F(out, 'noren',             -160, 124);                               // ラーメン暖簾
    $F(out, 'noren',             -100, 124);                               // 居酒屋暖簾
    const ramenSign  = $F(out, 'a_frame_sign', -130, 148);                 // 立て看板 (店間)
    const swBike     = $F(out, 'bicycle',    -75, 152);                    // ★ SW livingTrace (店壁傾き)
    $F(out, 'bicycle',           -120, 152);                               // 自転車 2 (店前)
    $F(out, 'garbage',           -100, 178);                               // 飲食店裏のゴミ

    // ── SE アンビエント: コンビニ + カフェ + 本屋 ──
    const cafePara1  = $F(out, 'parasol',     70, 152);                    // カフェテラス傘 1
    $F(out, 'parasol',                50, 158);                            // カフェテラス傘 2 (y を +6 ずらし)
    const seSign     = $F(out, 'a_frame_sign', 30, 148);                   // 本屋立て看板
    const seGarbage  = $F(out, 'garbage',    165, 175);                    // ★ SE livingTrace
    $F(out, 'vending',           110, 138);                                // コンビニ前自販機 1
    $F(out, 'vending',           150, 138);                                // コンビニ前自販機 2 (ペアで明るさ)
    $F(out, 'recycling_bin',     130, 178);                                // コンビニ裏のリサイクル

    // ── 取り巻き 3 パターン ──
    // facade 沿い: sign_board / mailbox 不均等
    $F(out, 'sign_board',           -100, 22);                             // izakaya 看板
    $F(out, 'sign_board',             30, 22);                             // bookstore 看板
    $F(out, 'sign_board',            130, 22);                             // convenience 看板
    $F(out, 'mailbox',                30, 22);                             // SE 郵便受
    $F(out, 'mailbox',               165, 22);                             // SE 端郵便受 (3 個不均等)
    // 歩道沿い: chouchin × 4 上空 (y=15) + puddle
    $F(out, 'chouchin',             -100, 15);                             // 上空提灯 NW
    $F(out, 'chouchin',              -30, 15);                             // 上空提灯 中央西
    $F(out, 'chouchin',               30, 15);                             // 上空提灯 中央東
    $F(out, 'chouchin',              100, 15);                             // 上空提灯 NE (4 個不均等間隔)
    $F(out, 'puddle_reflection',     -50, 168);                            // 濡れた路面 SW
    $F(out, 'puddle_reflection',      70, 175);                            // 濡れた路面 SE (50/70 で対称崩し)

    // ── 連続軸: 電柱・電線・cable ──
    $F(out, 'power_pole',           -178, 92);                             // NW 電柱
    $F(out, 'power_pole',            178, 92);                             // NE 電柱
    $F(out, 'power_pole',           -178, 195);                            // SW 電柱
    $F(out, 'power_pole',            178, 195);                            // SE 電柱
    $F(out, 'power_line',            -90, 92);                             // 電線 NW-NE 上半
    $F(out, 'power_line',             90, 92);                             // 電線 NW-NE
    $F(out, 'cable_junction_box',  -170, 100);                             // 配電箱 西
    // SE 裏の cat
    $F(out, 'cat', 170, 175);                                              // 駅裏 cat
    $F(out, 'cat', -170, 175);                                             // SW 端 cat (酔客の足元)

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    $F(out, 'garbage',           -160, 88);     // SW 端ゴミ
    $F(out, 'recycling_bin',      -75, 92);     // 中央リサイクル
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    // ★ HERO: NE 駅前広場 (基本形 A オープンスペース)
    _CLUSTER(out, {
      id: 'ch0.NE.station',
      role: 'hero',
      cell: 'NE',
      focal: station,
      companions: [platE, platW, signal, benchA, benchB, benchC, benchD, flagA, flagB],
      boundary: [bolNW, bolNE, bolSW],
      access: [busA, busB, manAve],
      livingTrace: newsNE,
    });
    // AMBIENT: NW ビジネスホテル
    _CLUSTER(out, {
      id: 'ch0.NW.hotel',
      role: 'ambient',
      cell: 'NW',
      focal: hotelNW,
      companions: [hotelSign, atmA, atmB],
      livingTrace: hotelMail,
    });
    // AMBIENT: SW 食事街 (ramen を焦点に)
    _CLUSTER(out, {
      id: 'ch0.SW.eatery',
      role: 'ambient',
      cell: 'SW',
      focal: ramenSW,
      companions: [izakaySW, ramenChouA, ramenSign],
      livingTrace: swBike,
    });
    // AMBIENT: SE コンビニ + カフェ
    _CLUSTER(out, {
      id: 'ch0.SE.shopfront',
      role: 'ambient',
      cell: 'SE',
      focal: convSE,
      companions: [cafeSE, cafePara1, seSign],
      livingTrace: seGarbage,
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 駅員 + 終電客
      _H(80, 80),                                                          
       _H(165, 85),                    
      // ホテル
       
      // 食事街 SW
      _H(-160, 145),                          
      // SE カフェ + コンビニ
      _H(130, 145), 
      // avenue 通行人
      
    ];

    // ═══ GROUNDS (4 層: ベース → 焦点 → ロット → 動線) ═══
    out.grounds = [
      // ── v7.1 S2-Ch0 駅前: asphalt + concrete 駅前広場大 + tile ホーム ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE 夜街
      _G('concrete', 0, 60, 360, 100),                           // ★★ 上段全幅 駅前広場
      _G('tile', 80, 50, 200, 30),                               // NE ホーム長帯
      _G('oil_stained_concrete', 0, 100, 60, 20),                // 中央 (Stage 1 から継続)
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },

  // ── S2-Ch1: 終電後の食事街 (ramen + izakaya + karaoke 3 連) ──  (時刻 24:00)
  // ▼ ヒーロー: SW = 3 連飲食店 (基本形 C・横並びクラスター)
  // ▼ アンビエント 3 セル: NW = ホテル / NE = コンビニ + apartment_tall / SE = townhouse 住宅
  // 終電を逃したサラリーマンが集まる「最後の一杯」帯。chouchin × 6 と暖簾 × 3 で店列を視覚的に揃える。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR],
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // SW 焦点: 3 連飲食 (基本形 C・dy=128 揃え)
    const ramen   = $B(out, 'ramen',          -145, 130);                  // ★ HERO FOCAL 中
    const izakaya = $B(out, 'izakaya',         -95, 130);                  // ★ HERO 中央
    const karaoke = $B(out, 'karaoke',         -35, 130);                  // ★ HERO 大カラオケ (店列の終端)
    // NW アンビエント: ホテル + カプセル
    const hotelNW = $B(out, 'business_hotel', -130, 22);                   // ビジネスホテル
    $B(out, 'capsule_hotel',  -160, 60);                                   // カプセル (奥)
    // NE アンビエント: コンビニ + apartment_tall + 麻雀
    const convNE  = $B(out, 'convenience',    110, 22);                    // 24h コンビニ
    const apTNE   = $B(out, 'apartment_tall',  35, 22);                    // ★ NE 焦点 高層集合住宅
    $B(out, 'mahjong_parlor',  175, 60);                                   // 麻雀荘 (奥)
    // SE アンビエント: 町家 + 本屋
    const tnSE    = $B(out, 'townhouse',       80, 130);                   // ★ SE 焦点 町家 1
    $B(out, 'townhouse',      140, 130);                                   // 町家 2
    $B(out, 'bookstore',       30, 130);                                   // 24h 本屋
    // タイトパッキング
    $B(out, 'snack',         -178, 22);                                    // NW 端の小スナック
    $B(out, 'shed',          -160, 175);                                   // SW 物置
    $B(out, 'garage',         110, 175);                                   // SE 駐車
    $B(out, 'pharmacy',       170, 138);                                   // SE 隅薬局
    $B(out, 'shop',           -50, 175);                                   // SW 端の小店
    $B(out, 'shop',           160, 175);                                   // SE 端の小店
    $B(out, 'shed',          -178, 175);                                   // SW 端物置

    // ═══ FURNITURE ═══
    // ── SW 焦点 4 層: 3 連飲食店 ──
    // 取り巻き: chouchin × 6 (各店 2 個、計 6)
    const chouA = $F(out, 'chouchin',         -155, 118);                  // ★ ramen 提灯 西
    $F(out, 'chouchin',                       -135, 118);                  // ramen 提灯 東
    $F(out, 'chouchin',                       -105, 118);                  // izakaya 提灯 西
    $F(out, 'chouchin',                        -85, 118);                  // izakaya 提灯 東
    $F(out, 'chouchin',                        -45, 118);                  // karaoke 提灯 西
    $F(out, 'chouchin',                        -25, 118);                  // karaoke 提灯 東 (3 ペア = 6 個)
    // noren × 3 (各店 1 個)
    const norenA = $F(out, 'noren',           -145, 122);                  // ramen 暖簾
    $F(out, 'noren',                           -95, 122);                  // izakaya 暖簾
    $F(out, 'noren',                           -35, 122);                  // karaoke 暖簾
    // a_frame_sign × 3 (店前看板)
    const aframeA = $F(out, 'a_frame_sign',  -145, 148);                   // ramen 立て看板
    $F(out, 'a_frame_sign',                    -95, 148);                  // izakaya 立て看板
    $F(out, 'a_frame_sign',                    -35, 148);                  // karaoke 立て看板
    // shop_awning × 2 (店間庇)
    $F(out, 'shop_awning',                   -120, 138);                   // ramen-izakaya 間庇
    $F(out, 'shop_awning',                    -65, 138);                   // izakaya-karaoke 間庇
    // 境界: bollard × 2 (横丁入口) + flower_planter × 2 (店間) + wood_fence
    const bolA = $F(out, 'bollard',          -160, 110);                   // 横丁西入口 bollard
    const bolB = $F(out, 'bollard',           -10, 110);                   // 横丁東入口 bollard
    $F(out, 'flower_planter_row',            -120, 130);                   // 店間プランター 1
    $F(out, 'flower_planter_row',             -65, 130);                   // 店間プランター 2
    const wfA  = $F(out, 'wood_fence',       -178, 148);                   // SW 端フェンス
    $F(out, 'wood_fence',                    -178, 168);                   // SW 端フェンス 下
    // 動線: street_lamp × 2 + puddle × 3
    const lampA = $F(out, 'street_lamp',     -120, 130);                   // 横丁中央灯
    const lampB = $F(out, 'street_lamp',      -10, 130);                   // 横丁東灯
    $F(out, 'puddle_reflection',             -145, 148);                   // 濡路面 ramen 前
    $F(out, 'puddle_reflection',              -95, 148);                   // 濡路面 izakaya 前
    $F(out, 'puddle_reflection',              -35, 148);                   // 濡路面 karaoke 前

    // ── NW アンビエント: ホテル + カプセル ──
    const hotelSign = $F(out, 'sign_board',  -130, 22);                    // ★ NW 青ネオン
    $F(out, 'atm',                           -110, 38);                    // ATM
    const hotelMail = $F(out, 'mailbox',     -160, 22);                    // ★ NW livingTrace
    $F(out, 'a_frame_sign',                  -160, 60);                    // カプセル看板
    $F(out, 'recycling_bin',                 -178, 60);                    // ホテル裏リサイクル

    // ── NE アンビエント: コンビニ + apartment_tall + 麻雀 ──
    $F(out, 'vending',                         90, 38);                    // 自販機 西
    $F(out, 'vending',                        130, 38);                    // 自販機 東 (コンビニ前ペア)
    const neBike    = $F(out, 'bicycle_rack',  60, 60);                    // ★ NE livingTrace
    $F(out, 'sign_board',                     110, 22);                    // コンビニ看板
    const neSign    = $F(out, 'sign_board',    35, 22);                    // apartment 看板
    $F(out, 'flag_pole',                       35, 12);                    // apartment 旗
    $F(out, 'a_frame_sign',                   175, 88);                    // 麻雀荘看板
    $F(out, 'chouchin',                       175, 60);                    // 麻雀荘提灯 (奥に小さく)

    // ── SE アンビエント: 町家 + 本屋 ──
    const seCat     = $F(out, 'cat',          170, 175);                   // ★ SE livingTrace 路地猫
    const seMail    = $F(out, 'mailbox',       30, 130);                   // SE 郵便受
    $F(out, 'a_frame_sign',                   140, 148);                   // 駐車場看板
    $F(out, 'laundry_balcony',                 80, 158);                   // 町家ベランダ物干し

    // ── 取り巻き 3 パターン ──
    // facade 沿い: 上空 chouchin × 4
    $F(out, 'chouchin',                      -100, 15);                    // 上空 NW
    $F(out, 'chouchin',                       -30, 15);                    // 上空 中央西
    $F(out, 'chouchin',                        35, 15);                    // 上空 中央東
    $F(out, 'chouchin',                       110, 15);                    // 上空 NE
    // 歩道沿い: manhole × 3
    $F(out, 'manhole_cover',                  -65, 100);                   // 歩道帯
    $F(out, 'manhole_cover',                    0, 100);                   // avenue 中央
    $F(out, 'manhole_cover',                   65, 100);                   // 歩道帯 東
    $F(out, 'street_lamp',                    -65, 88);                    // 歩道帯灯 西
    $F(out, 'street_lamp',                     65, 88);                    // 歩道帯灯 東

    // ── 連続軸: 電柱・電線・cable ──
    $F(out, 'power_pole',                    -178, 92);
    $F(out, 'power_pole',                     178, 92);
    $F(out, 'power_pole',                    -178, 195);
    $F(out, 'power_pole',                     178, 195);
    $F(out, 'power_line',                     -90, 92);
    $F(out, 'power_line',                      90, 92);
    $F(out, 'cable_junction_box',           -170, 195);
    $F(out, 'cable_junction_box',            170, 195);
    // 客引き SW 端
    $F(out, 'a_frame_sign',                  -178, 132);                   // 客引き看板
    // garbage (SW 路地)
    $F(out, 'garbage',                       -130, 175);                   // SW 路地裏 garbage

    // ── タイトパッキング: 居酒屋裏の生活感 ──
    $F(out, 'recycling_bin',      -130, 168);   // 店間リサイクル
    $F(out, 'garbage',             -55, 178);   // SW 端 garbage
    $F(out, 'cat',                 -45, 195);   // 路地猫
    $F(out, 'flower_bed',         -150, 188);   // ロット端花壇

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)
    $F(out, 'cat',                 165, 60);

    // ═══ CLUSTERS ═══
    // ★ HERO: SW 3 連飲食 (izakaya 中央を focal に)
    _CLUSTER(out, {
      id: 'ch1.SW.eatery3',
      role: 'hero',
      cell: 'SW',
      focal: izakaya,
      companions: [ramen, karaoke, chouA, norenA, aframeA, lampA, lampB],
      boundary: [bolA, bolB, wfA],
      access: [lampA, lampB],
      livingTrace: $F(out, 'garbage', -100, 195),                          // SW 端 garbage 追加
    });
    // AMBIENT: NW ホテル
    _CLUSTER(out, {
      id: 'ch1.NW.hotel',
      role: 'ambient',
      cell: 'NW',
      focal: hotelNW,
      companions: [hotelSign],
      livingTrace: hotelMail,
    });
    // AMBIENT: NE コンビニ
    _CLUSTER(out, {
      id: 'ch1.NE.shopfront',
      role: 'ambient',
      cell: 'NE',
      focal: convNE,
      companions: [neSign, apTNE],
      livingTrace: neBike,
    });
    // AMBIENT: SE 住宅 + 本屋
    _CLUSTER(out, {
      id: 'ch1.SE.residential',
      role: 'ambient',
      cell: 'SE',
      focal: tnSE,
      companions: [seMail],
      livingTrace: seCat,
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 飲み客 (各店 2 人)
      _H(-145, 138), 
      _H(-95, 145), 
      // 客引き SW 端
      
      // サラリーマン avenue
      _H(50, 100), 
      // 通行人
      
      // NE コンビニ + 麻雀
      _H(175, 60),
      // SE 路地
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch1 食事街: asphalt + oil_stained_concrete 路地裏全幅 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('oil_stained_concrete', 0, 175, 360, 50),               // ★★ 下段路地裏全幅 (夜街シグネチャ)
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },

  // ── S2-Ch2: 商店街アーケード入口 (NW+NE merged hero) ──  (時刻 24:30)
  // ▼ ヒーロー: NW+NE merged = アーケードゲート (基本形 A 全幅 = 提灯ガーランド)
  // ▼ アンビエント 2 セル: SW = pachinko 予告 / SE = club 予告 (Act II 伏線)
  // chouchin × 14 を avenue 全幅に渡らせる「街全体に屋根を架ける」感。Act 境界 _TOP_HR で予告。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _TOP_HR],                                 // ✅ Act 境界予告 _TOP_HR
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // merged 焦点: アーケードゲート両柱 + 中央 2 棟
    const arcadeW = $B(out, 'shotengai_arcade', -118, 22);                 // ★ HERO 西柱 (アーケード入口)
    const arcadeE = $B(out, 'shotengai_arcade',  118, 22);                 // ★ HERO 東柱
    const pach    = $B(out, 'pachinko',           60, 22);                 // ★ 焦点中央東 (Ch4 大パチンコ予告)
    const karao   = $B(out, 'karaoke',           -60, 22);                 // ★ 焦点中央西
    // NW アンビエント (上段隅、merged の余地に小店)
    const mahNW   = $B(out, 'mahjong_parlor', -178, 60);                   // 麻雀荘 (奥)
    $B(out, 'capsule_hotel',  178, 60);                                    // カプセル (奥)
    // SW アンビエント: pachinko 予告 + business_hotel
    const pachSW  = $B(out, 'pachinko',         -130, 130);                // 小型 pachinko (Ch4 予告)
    const hotelSW = $B(out, 'business_hotel',    -50, 130);                // ビジネスホテル
    // SE アンビエント: club 予告 + townhouse × 2
    const clubSE  = $B(out, 'club',              130, 130);                // 小型 club (Ch6 予告)
    const tnSE    = $B(out, 'townhouse',          70, 130);                // 町家 1
    $B(out, 'townhouse',                          30, 130);                // 町家 2
    // タイトパッキング
    $B(out, 'shop',           -160, 175);                                  // SW 端 小店
    $B(out, 'shop',            165, 175);                                  // SE 端 小店
    $B(out, 'snack',          -100, 175);                                  // SW スナック
    $B(out, 'snack',           100, 175);                                  // SE スナック (左右非対称的に配置)
    $B(out, 'shed',           -178, 192);                                  // SW 端物置
    $B(out, 'shed',            178, 192);                                  // SE 端物置
    $B(out, 'garage',         -130, 175);                                  // SW 駐車
    $B(out, 'garage',          130, 175);                                  // SE 駐車

    // ═══ FURNITURE ═══
    // ── merged 焦点: アーケード提灯帯 ──
    // chouchin × 14 (v8.3 Phase 3: 2 列千鳥 y=20/26 alternating + 黄金比間隔で「提灯トンネル」感)
    const chouA = $F(out, 'chouchin', -162, 20);                           // ★ 提灯 1 (西端、列 A)
    $F(out, 'chouchin',              -130, 26);                            // 提灯 2 (列 B、32px 間隔)
    $F(out, 'chouchin',              -103, 20);                            // 提灯 3 (列 A、27px)
    $F(out, 'chouchin',               -78, 26);                            // 提灯 4 (列 B、25px)
    $F(out, 'chouchin',               -50, 20);                            // 提灯 5 (列 A、28px)
    $F(out, 'chouchin',               -22, 26);                            // 提灯 6 (列 B、28px、中央西)
    $F(out, 'chouchin',                 5, 20);                            // 提灯 7 (列 A、27px、中央東)
    $F(out, 'chouchin',                32, 26);                            // 提灯 8 (列 B、27px)
    $F(out, 'chouchin',                58, 20);                            // 提灯 9 (列 A、26px)
    $F(out, 'chouchin',                88, 26);                            // 提灯 10 (列 B、30px)
    $F(out, 'chouchin',               115, 20);                            // 提灯 11 (列 A、27px)
    $F(out, 'chouchin',               140, 26);                            // 提灯 12 (列 B、25px)
    $F(out, 'chouchin',               165, 20);                            // 提灯 13 (列 A、東端)
    $F(out, 'chouchin',                 0, 32);                            // 提灯 14 (中央二段目、奥行き)
    // banner_pole × 4 (各端)
    const banA = $F(out, 'banner_pole', -150, 28);                         // 旗ガーランド NW
    $F(out, 'banner_pole',             -90, 28);                           // 旗 中央西
    $F(out, 'banner_pole',              90, 28);                           // 旗 中央東
    $F(out, 'banner_pole',             150, 28);                           // 旗 NE
    // 境界: flag_pole × 2 + flower_planter
    const flagA = $F(out, 'flag_pole', -30, 12);                           // 中央上空旗 西
    const flagB = $F(out, 'flag_pole',  30, 12);                           // 中央上空旗 東
    const fpA   = $F(out, 'flower_planter_row', -160, 88);                 // プランター 西端
    $F(out, 'flower_planter_row',      160, 88);                           // プランター 東端
    // 動線: street_lamp × 2 + puddle × 3 + bollard × 4
    const lampA = $F(out, 'street_lamp', -120, 88);                        // 街灯 西
    const lampB = $F(out, 'street_lamp',  120, 88);                        // 街灯 東
    $F(out, 'puddle_reflection',       -50, 105);                          // 濡路面 中央西
    $F(out, 'puddle_reflection',        60, 105);                          // 濡路面 中央東
    $F(out, 'puddle_reflection',         0, 110);                          // 濡路面 中央 (3 個でリズム)
    const bolA  = $F(out, 'bollard',   -65, 92);                           // 横断 NW
    $F(out, 'bollard',                 -25, 92);                           // 横断 中央西
    $F(out, 'bollard',                  25, 92);                           // 横断 中央東
    $F(out, 'bollard',                  65, 92);                           // 横断 NE (4 個 = 横断帯)

    // ── SW アンビエント: pachinko 予告 ──
    const pachSign = $F(out, 'sign_board', -130, 130);                     // ★ 赤ネオン (Ch4 予告)
    const swGarb   = $F(out, 'garbage',     -75, 175);                     // ★ SW livingTrace
    $F(out, 'a_frame_sign',                -130, 168);                     // pachinko 看板
    $F(out, 'recycling_bin',                -50, 168);                     // ホテル裏

    // ── SE アンビエント: club 予告 ──
    const clubSign = $F(out, 'sign_board',  130, 130);                     // 黒+金 (Ch6 予告)
    const seBike   = $F(out, 'bicycle',      70, 175);                     // ★ SE livingTrace
    $F(out, 'bicycle',                      100, 175);                     // 自転車 2
    $F(out, 'parasol',                       30, 158);                     // 町家パラソル
    $F(out, 'a_frame_sign',                 130, 168);                     // club 看板

    // ── 取り巻き 3 パターン ──
    // 歩道沿い: bicycle_rack + vending + manhole
    $F(out, 'bicycle_rack',                 -60, 88);                      // 駐輪場 西
    $F(out, 'bicycle_rack',                  80, 88);                      // 駐輪場 東
    $F(out, 'vending',                     -178, 38);                      // 自販機 西端
    $F(out, 'vending',                      178, 38);                      // 自販機 東端
    $F(out, 'manhole_cover',                -65, 100);                     // 歩道帯
    $F(out, 'manhole_cover',                  0, 100);                     // avenue 中央
    $F(out, 'manhole_cover',                 65, 100);                     // 歩道帯 東
    // facade 沿い: shop_awning (アーケード両柱の庇)
    $F(out, 'shop_awning',                 -118, 38);                      // 西柱の庇
    $F(out, 'shop_awning',                  118, 38);                      // 東柱の庇

    // ── 連続軸 ──
    $F(out, 'power_pole',                  -178, 92);
    $F(out, 'power_pole',                   178, 92);
    $F(out, 'power_pole',                  -178, 195);
    $F(out, 'power_pole',                   178, 195);
    $F(out, 'power_line',                   -90, 195);
    $F(out, 'power_line',                    90, 195);
    $F(out, 'cable_junction_box',          -170, 195);
    $F(out, 'cable_junction_box',           170, 195);
    $F(out, 'cat',                          170, 178);                     // SE 路地猫
    $F(out, 'cat',                         -170, 178);                     // SW 路地猫

    // ── タイトパッキング: アーケード周辺の埋め草 ──
    $F(out, 'hedge',              -170, 88);    // 西端 hedge
    $F(out, 'hedge',               170, 88);    // 東端 hedge
    $F(out, 'hedge',              -150, 60);    // ロット境界 hedge 1
    $F(out, 'garbage',            -178, 178);   // SW 端ゴミ
    $F(out, 'garbage',             178, 178);   // SE 端ゴミ
    $F(out, 'recycling_bin',      -100, 38);    // 上段リサイクル 1

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    // ★ HERO: merged アーケードゲート
    _CLUSTER(out, {
      id: 'ch2.merged.arcade',
      role: 'hero',
      cell: 'merged',
      focal: arcadeW,
      companions: [arcadeE, pach, karao, chouA, banA, lampA, lampB],
      boundary: [flagA, flagB, fpA],
      access: [bolA, lampA, lampB],
      livingTrace: $F(out, 'newspaper_stand', 0, 88),
    });
    // AMBIENT: SW pachinko 予告
    _CLUSTER(out, {
      id: 'ch2.SW.pachinko',
      role: 'ambient',
      cell: 'SW',
      focal: pachSW,
      companions: [pachSign, hotelSW],
      livingTrace: swGarb,
    });
    // AMBIENT: SE club 予告
    _CLUSTER(out, {
      id: 'ch2.SE.club',
      role: 'ambient',
      cell: 'SE',
      focal: clubSE,
      companions: [clubSign, tnSE],
      livingTrace: seBike,
    });
    // AMBIENT: NW 麻雀
    _CLUSTER(out, {
      id: 'ch2.NW.mahjong',
      role: 'ambient',
      cell: 'NW',
      focal: mahNW,
      companions: [],
      livingTrace: $F(out, 'mailbox', -178, 38),
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 商店街客 × 多
      _H(-120, 88),  _H(120, 88),
       
      _H(-30, 88),
      // 客引き
      
      // SW pachinko 予告客
      // SE club 予告客
      _H(130, 138),
      // 通行人
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch2 アーケード: asphalt + tile 床全幅 + red_carpet 予告 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('tile', 0, 100, 360, 80),                               // ★★ アーケード床 全幅
      _G('red_carpet', 0, 175, 360, 50),                         // ★ 下段 Act II 予告 全幅
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },

  // ═══ Act II: 歓楽街最盛期 (Ch3-Ch5) ══════════════════════════════════

  // ── S2-Ch3: 高層雑居ビル (karaoke 街、NE = ヒーロー) ──  (時刻 24:30-25:00)
  // ▼ ヒーロー: NE = 高層 3 棟 (基本形 B 高層、屋上ネオン大)
  // ▼ アンビエント 3 セル: NW = club + capsule / SW = ホテル + 町家 + 麻雀 / SE = mansion + cafe + 薬局
  // 雑居ビル間に裏路地 _VR(-90, 0, 100) を 1 本入れて「ビル間の細い隙間」を表現。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR],
      verticalRoads: [_AVE, _VR(-90, 0, 100)],                             // ✅ NW 雑居ビル間裏路地
    };

    // ═══ BUILDINGS ═══
    // NE 焦点: 高層 3 棟 (v8.2 ジオラマ: 垂直千鳥 dy=8/22/40 で 3 段奥行き)
    const karao   = $B(out, 'karaoke',         142, 22);                    // ★ HERO FOCAL (屋上ネオン、奥)
    const aparT   = $B(out, 'apartment_tall',   88, 22);                   // 高層集合住宅 (中央)
    const clubNE  = $B(out, 'club',             38, 38);                   // 高層 club (avenue 寄り、手前)
    // NW アンビエント: club + capsule (v8.2: facade 千鳥で混雑緩和)
    const clubNW  = $B(out, 'club',           -135, 22);                   // ★ NW club (奥)
    const capNW   = $B(out, 'capsule_hotel',   -78, 28);                   // カプセル (手前気味)
    // SW アンビエント: ホテル + 町家 + 麻雀 (v8.2: dy 千鳥)
    const hotelSW = $B(out, 'business_hotel', -105, 130);                  // ★ SW ビジネスホテル
    $B(out, 'townhouse',                      -162, 138);                  // 町家 (奥)
    $B(out, 'mahjong_parlor',                  -52, 138);                  // 麻雀荘
    // SE アンビエント: mansion × 2 + 薬局 + cafe (v8.2: dy 千鳥)
    const mansSE  = $B(out, 'mansion',          82, 130);                  // ★ SE mansion 1
    $B(out, 'mansion',                         142, 138);                  // mansion 2 (奥)
    $B(out, 'pharmacy',                         28, 138);                  // 24h 薬局
    $B(out, 'cafe',                            168, 130);                  // 隅 cafe
    // タイトパッキング
    $B(out, 'mahjong_parlor', -178, 70);                  // v8.4 snack→mahjong_parlor (高層雑居の上段端を麻雀荘に)
    $B(out, 'karaoke', 178, 70);                  // v8.4 shop→karaoke (高層雑居の東端を karaoke に)
    $B(out, 'club', -158, 192);                  // v8.4 shed→club (SW 端を club に)
    $B(out, 'mahjong_parlor', 162, 198);                  // v8.4 shed→mahjong_parlor (SE 端を麻雀荘に)
    $B(out, 'capsule_hotel', -102, 192);                  // v8.4 garage→capsule_hotel (SW を capsule に)
    $B(out, 'club', 102, 198);                  // v8.4 garage→club (SE を club に)
    $B(out, 'karaoke', 32, 70);                  // v8.4 snack→karaoke (中央上段に karaoke 追加)

    // ═══ FURNITURE ═══
    // ── NE 焦点 4 層 ──
    const karaSign = $F(out, 'sign_board', 130, 8);                        // ★ 屋上ネオン大 (NE 焦点シグネチャ)
    const chouA    = $F(out, 'chouchin',  110, 58);                        // 店前提灯 1
    $F(out, 'chouchin',                   130, 58);                        // 店前提灯 2 (karaoke 前)
    $F(out, 'chouchin',                    80, 58);                        // 店前提灯 3 (apartment 1F)
    $F(out, 'chouchin',                    30, 58);                        // 店前提灯 4 (club 前)
    const afA      = $F(out, 'a_frame_sign', 130, 88);                     // 立て看板 1
    $F(out, 'a_frame_sign',                80, 88);                        // 立て看板 2
    $F(out, 'a_frame_sign',                30, 88);                        // 立て看板 3
    $F(out, 'flag_pole',                  130, 12);                        // karaoke 旗
    $F(out, 'flag_pole',                   80, 12);                        // apartment 旗
    // 境界: bollard × 3 (Q14)
    const bolA = $F(out, 'bollard',        70, 92);                        // NE bollard 西
    const bolB = $F(out, 'bollard',       100, 92);                        // NE bollard 中央
    const bolC = $F(out, 'bollard',       170, 92);                        // NE bollard 東
    // 動線
    const lampA = $F(out, 'street_lamp',   80, 88);                        // 街灯 西
    const lampB = $F(out, 'street_lamp',  170, 88);                        // 街灯 東
    $F(out, 'puddle_reflection',           80, 110);                       // 濡路面 NE 1
    $F(out, 'puddle_reflection',          130, 110);                       // 濡路面 NE 2
    const recyc = $F(out, 'recycling_bin', 165, 75);                       // ★ NE livingTrace

    // ── NW アンビエント: club + capsule ──
    const nwSign = $F(out, 'sign_board', -130, 8);                         // 黒+金ネオン
    $F(out, 'sign_board',                 -75, 8);                         // capsule 看板
    $F(out, 'parasol',                    -75, 38);                        // capsule 入口傘
    const nwTrace = $F(out, 'recycling_bin', -150, 38);                    // ★ NW livingTrace

    // ── SW アンビエント ──
    const swMail = $F(out, 'mailbox',    -160, 130);                       // ★ SW livingTrace
    $F(out, 'a_frame_sign',              -100, 148);                       // ホテル前看板
    $F(out, 'chouchin',                   -50, 122);                       // 麻雀荘提灯
    $F(out, 'noren',                      -50, 128);                       // 麻雀荘暖簾

    // ── SE アンビエント ──
    const seBR = $F(out, 'bicycle_rack',   80, 152);                       // ★ SE livingTrace
    $F(out, 'bicycle_rack',               140, 152);                       // 駐輪 2
    $F(out, 'parasol',                    165, 152);                       // cafe 傘
    $F(out, 'mailbox',                    140, 130);                       // mansion 郵便受
    $F(out, 'a_frame_sign',                30, 158);                       // 薬局看板

    // ── 取り巻き 3 パターン ──
    $F(out, 'sign_board',                 -75, 8);                         // facade NW (capsule 重複ではない y 違い)
    $F(out, 'sign_board',                  30, 8);                         // facade NE 中
    $F(out, 'sign_board',                  80, 8);                         // facade NE
    $F(out, 'puddle_reflection',          -50, 110);                       // 濡路面 中央西
    $F(out, 'puddle_reflection',           50, 110);                       // 濡路面 中央東
    $F(out, 'puddle_reflection',            0, 105);                       // 濡路面 中央 (3 個目)
    $F(out, 'manhole_cover',              -65, 100);                       // 歩道帯
    $F(out, 'manhole_cover',               65, 100);                       // 歩道帯 東
    $F(out, 'manhole_cover',                0, 100);                       // avenue 中央
    // 雑居ビル間裏路地 (x=-90 _VR 沿い)
    $F(out, 'cable_junction_box',         -90, 60);                        // 裏路地 配電箱
    $F(out, 'garbage',                    -90, 75);                        // 裏路地 garbage

    // ── 連続軸 ──
    $F(out, 'power_pole',                -178, 92);
    $F(out, 'power_pole',                 178, 92);
    $F(out, 'power_pole',                -178, 195);
    $F(out, 'power_pole',                 178, 195);
    $F(out, 'power_line',                 -90, 195);
    $F(out, 'power_line',                  90, 195);
    $F(out, 'cable_junction_box',        -170, 195);
    $F(out, 'cat',                       -170, 175);                       // SW 路地猫
    $F(out, 'cat',                        170, 175);                       // SE 路地猫
    $F(out, 'newspaper_stand',              0, 88);                        // 中央スタンド

    // ── タイトパッキング: 雑居ビル裏の生活感 ──
    $F(out, 'garbage',            -178, 60);    // NW 端ゴミ
    $F(out, 'recycling_bin',       -75, 60);    // capsule 前リサイクル
    $F(out, 'recycling_bin',        75, 60);    // ロット端
    $F(out, 'hedge',                30, 60);    // ロット境界 hedge
    $F(out, 'hedge',               -45, 60);    // ロット境界 hedge
    $F(out, 'flower_bed',         -178, 130);   // 端花壇
    $F(out, 'flower_bed',          178, 130);   // 端花壇

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch3.NE.highrise',
      role: 'hero',
      cell: 'NE',
      focal: karao,
      companions: [aparT, clubNE, karaSign, chouA, afA, lampA, lampB],
      boundary: [bolA, bolB, bolC],
      access: [lampA, lampB],
      livingTrace: recyc,
    });
    _CLUSTER(out, {
      id: 'ch3.NW.club',
      role: 'ambient',
      cell: 'NW',
      focal: clubNW,
      companions: [capNW, nwSign],
      livingTrace: nwTrace,
    });
    _CLUSTER(out, {
      id: 'ch3.SW.hotel',
      role: 'ambient',
      cell: 'SW',
      focal: hotelSW,
      companions: [],
      livingTrace: swMail,
    });
    _CLUSTER(out, {
      id: 'ch3.SE.mansion',
      role: 'ambient',
      cell: 'SE',
      focal: mansSE,
      companions: [],
      livingTrace: seBR,
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 飲み客 NE × 5
      _H(130, 38), 
      _H(50, 60),
      // ホスト/ホステス NW × 4
       _H(-75, 60),
      // サラリーマン avenue × 3
       
      // SE mansion + cafe
      _H(165, 145), 
      // 通行人
      
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch3 高層雑居: asphalt + red_carpet 上段全幅 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('red_carpet', 0, 60, 360, 100),                         // ★★ 上段全幅 歓楽街
      _G('oil_stained_concrete', 0, 100, 60, 20),
    ];

    return out;
  })() },

  // ── S2-Ch4: ★ パチンコ + 交番交差点 (merged hero、Stage 2 クライマックス) ──  (時刻 25:00 ピーク)
  // ▼ ヒーロー: 全マージ merged = 街の交差点 (Stage 2 視覚的ピーク)
  // ▼ 周辺セル: NW = snack + love_hotel / NE = snack + club + capsule / SW = mahjong + ホテル + izakaya / SE = ramen + 町家 + アパート
  // pachinko ★ + police ★ + game_center ★ の 3 大焦点を avenue 中央に集中。puddle × 4 + street_mirror × 2 でピークの湿り気。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _TOP_HR],                                 // ✅ 4 方向交差点感
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // merged 焦点: 3 大ランドマーク (v8.3 Phase 3 R: Y字焦点強調、屋上 y=8 と看板 y=22 二段)
    const pach    = $B(out, 'pachinko',       -105, 22);                    // ★ HERO FOCAL (奥、屋上ネオン強調)
    const police  = $B(out, 'police_station',    0, 130);                  // ★ 中央交番 (Y字下点)
    const game    = $B(out, 'game_center',     105, 22);                    // ★ 大型 game_center (奥、屋上)
    // NW アンビエント (Y字の左羽、奥に追放)
    const snackNW = $B(out, 'snack',         -165, 28);                    // 隅 snack (西端、手前)
    const loveNW  = $B(out, 'love_hotel',     -52, 22);                    // love_hotel (Ch6 予告)
    $B(out, 'capsule_hotel',                  -28, 70);                    // カプセル (奥)
    // NE アンビエント (Y字の右羽)
    const snackNE = $B(out, 'snack',          168, 28);                    // 隅 snack (東端、手前)
    const clubNE  = $B(out, 'club',            58, 22);                    // club (奥め)
    $B(out, 'shop',                           148, 70);                    // 小店 (奥)
    // SW アンビエント (Y字下、西重心)
    const mahSW   = $B(out, 'mahjong_parlor',-155, 130);                   // ★ SW 麻雀 (端寄り)
    $B(out, 'business_hotel',                 -95, 138);                   // ホテル (奥)
    $B(out, 'izakaya',                        -42, 130);                   // 居酒屋
    // SE アンビエント (東重心)
    const ramSE   = $B(out, 'ramen',           62, 138);                   // ★ SE ラーメン (奥)
    $B(out, 'townhouse',                      115, 130);                   // 町家
    $B(out, 'apartment',                      168, 138);                   // アパート (端、奥)
    // タイトパッキング (端集中、中央 gutter 空ける)
    $B(out, 'capsule_hotel', -178, 175);                  // v8.4 shed→capsule_hotel (SW 端を capsule に)
    $B(out, 'mahjong_parlor', 178, 175);                  // v8.4 garage→mahjong_parlor (SE 端を麻雀荘に)
    $B(out, 'karaoke', -112, 175);                  // v8.4 snack→karaoke (SW 中段に karaoke)
    $B(out, 'club', 112, 175);                  // v8.4 snack→club (SE 中段に club)
    $B(out, 'love_hotel', -52, 192);                  // v8.4 shop→love_hotel (SW 下段にラブホ)
    $B(out, 'love_hotel', 52, 192);                  // v8.4 shop→love_hotel (SE 下段にラブホ)

    // ═══ FURNITURE ═══
    // ── merged 焦点 4 層 ──
    const pachSign = $F(out, 'sign_board', -100, 8);                       // ★ パチンコ屋上ネオン巨大
    const gameSign = $F(out, 'sign_board',  100, 8);                       // ★ ゲーセン屋上ネオン巨大
    const flagA    = $F(out, 'flag_pole',  -12, 105);                      // 交番旗 西
    const flagB    = $F(out, 'flag_pole',   12, 105);                      // 交番旗 東
    const tcA      = $F(out, 'traffic_cone', -20, 110);                    // 交番前 cone
    const tcB      = $F(out, 'traffic_cone',  20, 110);                    // 交番前 cone
    $F(out, 'traffic_cone',                  -10, 115);                    // cone 3
    $F(out, 'traffic_cone',                   10, 115);                    // cone 4
    // 境界
    const bolA = $F(out, 'bollard',          -65, 92);                     // 横断 NW
    const bolB = $F(out, 'bollard',          -25, 92);                     // 横断 中央西
    const bolC = $F(out, 'bollard',           25, 92);                     // 横断 中央東
    const bolD = $F(out, 'bollard',           65, 92);                     // 横断 NE
    $F(out, 'barrier',                      -100, 38);                     // パチンコ前バリア
    $F(out, 'barrier',                       100, 38);                     // ゲーセン前バリア
    // 動線
    const lampA = $F(out, 'street_lamp',     -65, 100);                    // 街灯 西
    const lampB = $F(out, 'street_lamp',      65, 100);                    // 街灯 東
    $F(out, 'street_mirror',                 -30, 92);                     // 交差点ミラー 西
    $F(out, 'street_mirror',                  30, 92);                     // 交差点ミラー 東
    $F(out, 'puddle_reflection',             -55, 105);                    // ★ Stage 2 最多 puddle 1
    $F(out, 'puddle_reflection',              55, 105);                    // puddle 2
    $F(out, 'puddle_reflection',             -55,  95);                    // puddle 3
    $F(out, 'puddle_reflection',              55,  95);                    // puddle 4 (★ ピーク 4 個)

    // ── アンビエント (狭い) ──
    $F(out, 'sign_board',                  -160, 8);                       // snack NW 赤
    $F(out, 'sign_board',                   160, 8);                       // snack NE ピンク
    $F(out, 'sign_board',                   -55, 8);                       // love_hotel ピンク
    $F(out, 'sign_board',                    60, 8);                       // club 黒+金
    $F(out, 'chouchin',                     -45, 118);                     // izakaya 提灯
    $F(out, 'chouchin',                      60, 118);                     // ramen 提灯
    $F(out, 'noren',                        -45, 122);                     // izakaya 暖簾
    $F(out, 'noren',                         60, 122);                     // ramen 暖簾
    $F(out, 'a_frame_sign',                -150, 148);                     // 麻雀荘看板
    $F(out, 'a_frame_sign',                 110, 148);                     // 町家看板

    // ── 痕跡 (各 ambient cluster) ──
    const nwGarb = $F(out, 'garbage',      -100, 60);                      // ★ NW livingTrace
    const neBike = $F(out, 'bicycle',       110, 175);                     // ★ NE livingTrace
    $F(out, 'bicycle',                      165, 175);                     // 自転車 2
    const swMail = $F(out, 'mailbox',      -160, 130);                     // ★ SW livingTrace
    const seGarb = $F(out, 'garbage',       170, 195);                     // ★ SE livingTrace

    // ── 取り巻き 3 パターン ──
    $F(out, 'newspaper_stand',              -65, 88);
    $F(out, 'newspaper_stand',               65, 88);
    $F(out, 'manhole_cover',                -65, 100);
    $F(out, 'manhole_cover',                  0, 100);
    $F(out, 'manhole_cover',                 65, 100);
    $F(out, 'recycling_bin',               -178, 38);                      // NW 端
    $F(out, 'recycling_bin',                178, 38);                      // NE 端
    $F(out, 'a_frame_sign',                -178, 88);                      // 客引き看板 西
    $F(out, 'a_frame_sign',                 178, 88);                      // 客引き看板 東

    // ── 連続軸 ──
    $F(out, 'power_pole',                  -178, 92);
    $F(out, 'power_pole',                   178, 92);
    $F(out, 'power_pole',                  -178, 195);
    $F(out, 'power_pole',                   178, 195);
    $F(out, 'power_line',                   -90, 195);
    $F(out, 'power_line',                    90, 195);
    $F(out, 'cable_junction_box',          -170, 195);
    $F(out, 'cable_junction_box',           170, 195);
    $F(out, 'cat',                         -170, 175);                     // SW 路地猫
    $F(out, 'cat',                          170, 178);                     // SE 路地猫

    // ── タイトパッキング: クライマックス交差点の混雑感 ──
    $F(out, 'garbage',             -45, 178);   // SW 居酒屋裏
    $F(out, 'garbage',              50, 178);   // SE ramen 裏
    $F(out, 'traffic_cone',       -150, 120);   // 交差点工事 1
    $F(out, 'traffic_cone',        150, 120);   // 交差点工事 2
    $F(out, 'flower_bed',          -65, 195);   // SW 路地端
    $F(out, 'flower_bed',           65, 195);   // SE 路地端

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ── v8.4 オーバーヘッド chouchin キャノピー (★ クライマックスの祭り感) ──
    $F(out, 'chouchin', -150, 8);  $F(out, 'chouchin', -120, 12);  $F(out, 'chouchin',  -90, 8);
    $F(out, 'chouchin',  -60, 12); $F(out, 'chouchin',  -30, 8);   $F(out, 'chouchin',    0, 12);
    $F(out, 'chouchin',   30, 8);  $F(out, 'chouchin',   60, 12);  $F(out, 'chouchin',   90, 8);
    $F(out, 'chouchin',  120, 12); $F(out, 'chouchin',  150, 8);
    // 屋上 sign_board × 4 (4 大ランドマークの上空)
    $F(out, 'sign_board', -105, 4); $F(out, 'sign_board', 105, 4);
    $F(out, 'sign_board',  -55, 4); $F(out, 'sign_board',  55, 4);
    // 追加 puddle (中央の濡路面ピーク)
    $F(out, 'puddle_reflection', -70, 168); $F(out, 'puddle_reflection', 70, 168);
    $F(out, 'puddle_reflection', -40, 110); $F(out, 'puddle_reflection', 40, 110);

    // ═══ CLUSTERS ═══
    // ★ HERO: merged 交差点
    _CLUSTER(out, {
      id: 'ch4.merged.crossing',
      role: 'hero',
      cell: 'merged',
      focal: pach,
      companions: [police, game, pachSign, gameSign, flagA, flagB, tcA, tcB, lampA, lampB],
      boundary: [bolA, bolB, bolC, bolD],
      access: [lampA, lampB, $F(out, 'manhole_cover', 0, 105)],
      livingTrace: nwGarb,
    });
    _CLUSTER(out, {
      id: 'ch4.NW.snack',
      role: 'ambient',
      cell: 'NW',
      focal: snackNW,
      companions: [loveNW],
      livingTrace: nwGarb,
    });
    _CLUSTER(out, {
      id: 'ch4.NE.club',
      role: 'ambient',
      cell: 'NE',
      focal: clubNE,
      companions: [snackNE],
      livingTrace: neBike,
    });
    _CLUSTER(out, {
      id: 'ch4.SW.mahjong',
      role: 'ambient',
      cell: 'SW',
      focal: mahSW,
      companions: [],
      livingTrace: swMail,
    });
    _CLUSTER(out, {
      id: 'ch4.SE.eatery',
      role: 'ambient',
      cell: 'SE',
      focal: ramSE,
      companions: [],
      livingTrace: seGarb,
    });

    // ═══ HUMANS (★ ピーク密度 18 人) ═══
    out.humans = [
      // パチンコ客 × 4
      _H(-100, 38),  
      // ゲーセン客 × 4
      _H(100, 38),  
      // 警察官
      _H(0, 145),
      // 客引き × 3
       
      // 酔客 × 4
      _H(-55, 38),  
      // サラリーマン × 2
      _H(0, 100), 
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch4 ★ 交差点: red_carpet 上段全幅 + oil avenue ピーク ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('red_carpet', 0, 50, 360, 100),                         // ★★★ 上段全幅 red ピーク
      _G('oil_stained_concrete', 0, 100, 100, 24),               // ★ avenue ピーク
      _G('oil_stained_concrete', 0, 175, 360, 50),               // 下段路地全幅
    ];

    return out;
  })() },

  // ── S2-Ch5: 老舗飲み屋横丁 (SW+SE merged hero) ──  (時刻 25:30)
  // ▼ ヒーロー: SW+SE merged = 5 連店並び (横丁の狭い空間に客が密)
  // ▼ アンビエント 2 セル: NW = 銀行 / NE = カプセル
  // 部分幅 _HR(165, -180, 0) を SW 横丁の路地として追加。avenue 以外の横動線。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _HR(165, -180, 0)],                       // ✅ SW 横丁路地
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // SW+SE merged 焦点: 5 連横丁 (v8.3 Phase 3 C: dy 千鳥で「店列がわずかに前後にずれる」)
    const snackA  = $B(out, 'snack',         -158, 130);                   // ★ HERO FOCAL 西端 snack (手前)
    const mahS    = $B(out, 'mahjong_parlor',-102, 130);                   // 麻雀 (奥)
    const izaS    = $B(out, 'izakaya',        -32, 130);                   // 居酒屋 (avenue 寄り、手前)
    $B(out, 'snack',                           62, 138);                   // 東 snack (奥)
    const sushi   = $B(out, 'sushi_ya',       128, 130);                   // 寿司屋 (東端)
    // NW アンビエント: 銀行 (上段 facade 千鳥)
    const bank    = $B(out, 'bank',          -132, 22);                    // ★ 24h ATM 付き銀行 (奥)
    // NE アンビエント: カプセル
    const capNE   = $B(out, 'capsule_hotel',  128, 28);                    // ★ カプセル (手前)
    // タイトパッキング (上段千鳥)
    $B(out, 'business_hotel',                  -78, 28);                   // NW ホテル (手前)
    $B(out, 'apartment',                        72, 22);                   // NE アパート (奥)
    $B(out, 'townhouse',                      -178, 22);                   // NW 端 町家
    $B(out, 'townhouse',                       178, 22);                   // NE 端 町家
    $B(out, 'shed',                          -158, 192);                   // SW 端 物置
    $B(out, 'shed',                           162, 198);                   // SE 端 物置
    $B(out, 'garage',                          -52, 192);                  // SW 駐車
    $B(out, 'garage',                           72, 198);                  // SE 駐車
    $B(out, 'shop',                           -178, 192);                  // SW 端 小店
    $B(out, 'shop',                            178, 198);                  // SE 端 小店
    $B(out, 'snack',                          -132, 70);                   // 中段 snack 西
    $B(out, 'snack',                           128, 70);                   // 中段 snack 東

    // ═══ FURNITURE ═══
    // ── SW+SE merged 焦点 4 層 ──
    // chouchin × 5 (各店前)
    const chouA = $F(out, 'chouchin', -160, 122);                          // ★ snack 西提灯
    $F(out, 'chouchin',               -100, 122);                          // 麻雀提灯
    $F(out, 'chouchin',                -30, 122);                          // 居酒屋提灯
    $F(out, 'chouchin',                 60, 122);                          // snack 東提灯
    $F(out, 'chouchin',                130, 122);                          // 寿司提灯
    // noren × 5
    const norenA = $F(out, 'noren',  -160, 128);
    $F(out, 'noren',                 -100, 128);
    $F(out, 'noren',                  -30, 128);
    $F(out, 'noren',                   60, 128);
    $F(out, 'noren',                  130, 128);
    // a_frame_sign × 4 不揃い
    const afA = $F(out, 'a_frame_sign', -130, 148);
    $F(out, 'a_frame_sign',              -65, 148);
    $F(out, 'a_frame_sign',               30, 148);
    $F(out, 'a_frame_sign',               95, 148);                        // 4 個 (5 でなく) で奇数非対称
    // 境界
    const wfA = $F(out, 'wood_fence',  -178, 120);                         // 横丁西入口
    const wfB = $F(out, 'wood_fence',   178, 120);                         // 横丁東入口
    $F(out, 'hedge',                     20, 145);                         // 中央仕切り
    $F(out, 'wood_fence',              -178, 168);                         // 横丁西 下部
    $F(out, 'wood_fence',               178, 168);                         // 横丁東 下部
    // 動線
    const lampA = $F(out, 'street_lamp', -120, 130);                       // 横丁灯 西
    const lampB = $F(out, 'street_lamp',    0, 130);                       // 横丁灯 中央
    const lampC = $F(out, 'street_lamp',  120, 130);                       // 横丁灯 東
    $F(out, 'puddle_reflection',         -130, 148);                       // 濡路面 西
    $F(out, 'puddle_reflection',          -50, 148);                       // 濡路面 中央西
    $F(out, 'puddle_reflection',           60, 148);                       // 濡路面 中央東
    $F(out, 'puddle_reflection',          130, 148);                       // 濡路面 東 (4 個でリズム)

    // ── NW アンビエント: 銀行 ──
    $F(out, 'flag_pole',                 -130, 12);                        // 銀行旗
    $F(out, 'atm',                       -150, 38);                        // ATM 西
    $F(out, 'atm',                       -110, 38);                        // ATM 東
    const nwMail = $F(out, 'mailbox',    -100, 22);                        // ★ NW livingTrace
    const bankSign = $F(out, 'sign_board',-130, 8);                        // 銀行ネオン

    // ── NE アンビエント: カプセル ──
    const neSign = $F(out, 'sign_board',  130, 8);                         // カプセル看板
    $F(out, 'vending',                    110, 38);                        // 自販機 西
    $F(out, 'vending',                    150, 38);                        // 自販機 東
    const neGarb = $F(out, 'garbage',     165, 60);                        // ★ NE livingTrace

    // ── 取り巻き 3 パターン ──
    $F(out, 'manhole_cover',              -65, 100);
    $F(out, 'manhole_cover',                0, 100);
    $F(out, 'manhole_cover',               65, 100);
    $F(out, 'bollard',                    -65, 95);
    $F(out, 'bollard',                     65, 95);
    $F(out, 'street_lamp',                -65, 88);                        // 歩道灯
    $F(out, 'street_lamp',                 65, 88);                        // 歩道灯

    // ── 痕跡 ──
    const swCat = $F(out, 'cat',         -170, 175);                       // ★ SW livingTrace
    const seCat = $F(out, 'cat',          170, 175);                       // ★ SE livingTrace
    $F(out, 'garbage',                   -160, 175);                       // SW 路地 garbage
    $F(out, 'garbage',                    160, 175);                       // SE 路地 garbage

    // ── 連続軸 ──
    $F(out, 'power_pole',                -178, 92);
    $F(out, 'power_pole',                 178, 92);
    $F(out, 'power_pole',                -178, 195);
    $F(out, 'power_pole',                 178, 195);
    $F(out, 'power_line',                 -90, 195);
    $F(out, 'power_line',                  90, 195);
    $F(out, 'cable_junction_box',        -170, 195);
    $F(out, 'cable_junction_box',         170, 195);
    $F(out, 'newspaper_stand',              0, 88);

    // ── タイトパッキング: 横丁裏の埋め草 ──
    $F(out, 'recycling_bin',      -178, 38);    // NW 端 (bank 裏)
    $F(out, 'recycling_bin',       178, 38);    // NE 端 (capsule 裏)
    $F(out, 'hedge',              -178, 60);    // NW 端 hedge
    $F(out, 'hedge',               178, 60);    // NE 端 hedge

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)
    $F(out, 'cat',                 165, 60);
    $F(out, 'cat',                 -50, 188);

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch5.merged.alley5',
      role: 'hero',
      cell: 'merged',
      focal: mahS,
      companions: [snackA, izaS, sushi, chouA, norenA, afA, lampA, lampB, lampC],
      boundary: [wfA, wfB, $F(out, 'hedge', 20, 165)],
      access: [lampA, lampB, lampC],
      livingTrace: $F(out, 'garbage', -100, 175),
    });
    _CLUSTER(out, {
      id: 'ch5.NW.bank',
      role: 'ambient',
      cell: 'NW',
      focal: bank,
      companions: [bankSign],
      livingTrace: nwMail,
    });
    _CLUSTER(out, {
      id: 'ch5.NE.capsule',
      role: 'ambient',
      cell: 'NE',
      focal: capNE,
      companions: [neSign],
      livingTrace: neGarb,
    });
    _CLUSTER(out, {
      id: 'ch5.SE.eatery',
      role: 'ambient',
      cell: 'SE',
      focal: sushi,
      companions: [],
      livingTrace: seCat,
    });

    // ═══ HUMANS (横丁狭い空間 = 密) ═══
    out.humans = [
      // 飲み客 × 8 (5 店分散)
      _H(-160, 138), 
      _H(130, 138),
       
      // ママさん snack 前
      _H(-160, 132),
      // サラリーマン avenue
      
      // 横丁路地通行人
      _H(90, 168),
      // 銀行 ATM 客
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch5 横丁: asphalt + red_carpet 下段横丁全幅 + oil 路地 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('red_carpet', 0, 145, 360, 80),                         // ★★ 下段全幅 横丁
      _G('oil_stained_concrete', 0, 188, 320, 30),               // 路地裏
    ];

    return out;
  })() },

  // ═══ Act III: ホテルと屋台 (Ch6-Ch8) ══════════════════════════════════

  // ── S2-Ch6: ラブホテル街 (NW = ヒーロー) ──  (時刻 26:00)
  // ▼ ヒーロー: NW = love_hotel × 3 (基本形 B 隔離型、hedge × 5 で目隠し)
  // ▼ アンビエント 3 セル: NE = club × 2 + 麻雀 / SW = snack + 麻雀 + 居酒屋 / SE = 麻雀 + cafe + mansion
  // 匿名性のため hedge を高め目隠しに使い、ラブホ前の red_carpet 大パッチで「特別感」を演出。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR],
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // NW 焦点: love_hotel × 3 (v8.2 ジオラマ: NW 三角形配置で「箱庭」感)
    const loveA = $B(out, 'love_hotel',  -120, 22);                        // ★ HERO FOCAL ラブホ大 1 (奥)
    const loveB = $B(out, 'love_hotel',   -55, 28);                        // ラブホ大 2 (手前)
    const loveC = $B(out, 'love_hotel',  -158, 70);                        // ラブホ小 (奥)
    // NE アンビエント (v8.2: y=22 7棟混雑解消で 3 棟を別 dy へ分散)
    const clubA = $B(out, 'club',         132, 22);                        // ★ NE club 1 (奥)
    const clubB = $B(out, 'club',          72, 38);                        // club 2 (手前)
    $B(out, 'mahjong_parlor',              28, 22);                        // 麻雀 (中央寄り)
    // SW アンビエント (v8.2: dy 千鳥)
    const snackSW = $B(out, 'snack',     -132, 130);                       // ★ SW snack
    $B(out, 'mahjong_parlor',             -75, 138);                       // 麻雀
    $B(out, 'izakaya',                    -22, 130);                       // 居酒屋
    // SE アンビエント
    const mahSE = $B(out, 'mahjong_parlor', 128, 130);                     // ★ SE 麻雀
    $B(out, 'cafe',                         32, 138);                      // cafe
    $B(out, 'mansion',                     168, 138);                      // mansion
    // タイトパッキング
    $B(out, 'capsule_hotel',                70, 130);                      // SE カプセル
    $B(out, 'mahjong_parlor', -178, 192);                  // v8.4 shed→mahjong_parlor (SW 端を麻雀荘に)
    $B(out, 'capsule_hotel', 178, 192);                  // v8.4 shed→capsule_hotel (SE 端を capsule に)
    $B(out, 'club', -100, 192);                  // v8.4 garage→club (SW 駐車を club に)
    $B(out, 'mahjong_parlor', 100, 192);                  // v8.4 garage→mahjong_parlor (SE 駐車を麻雀荘に)
    $B(out, 'love_hotel', -178, 22);                  // v8.4 shop→love_hotel (NW 端にラブホ追加)
    $B(out, 'club', 178, 22);                  // v8.4 shop→club (NE 端を club に)

    // ═══ FURNITURE ═══
    // ── NW 焦点 4 層 ──
    const sigA = $F(out, 'sign_board', -110, 8);                           // ★ ピンクネオン大 1
    $F(out, 'sign_board',               -50, 8);                           // ピンクネオン大 2
    const paraA = $F(out, 'parasol',  -110, 58);                           // 入口傘 1
    $F(out, 'parasol',                 -50, 58);                           // 入口傘 2
    const flagA = $F(out, 'flag_pole',-130, 12);                           // 旗 1
    $F(out, 'flag_pole',               -30, 12);                           // 旗 2
    // 境界: hedge × 5 高め目隠し
    const hgA = $F(out, 'hedge',     -178, 10);                            // 西端 hedge 1
    const hgB = $F(out, 'hedge',     -178, 50);                            // 西端 hedge 2
    const hgC = $F(out, 'hedge',     -178, 90);                            // 西端 hedge 3
    $F(out, 'hedge',                   10, 10);                            // 中央 hedge 1
    $F(out, 'hedge',                   10, 50);                            // 中央 hedge 2
    // 動線
    const lampA = $F(out, 'street_lamp', -150, 88);                        // 街灯
    $F(out, 'puddle_reflection',       -100, 105);                         // 濡路面 1
    $F(out, 'puddle_reflection',        -40, 105);                         // 濡路面 2
    $F(out, 'flower_bed',               -75, 88);                          // 花壇 (入口装飾)

    // ── NE アンビエント: club × 2 + 麻雀 ──
    const sigNE = $F(out, 'sign_board', 130, 8);                           // 黒+金
    $F(out, 'sign_board',                70, 8);                           // 黒+金
    $F(out, 'chouchin',                  30, 58);                          // 麻雀提灯
    const neRecyc = $F(out, 'recycling_bin', 165, 38);                     // ★ NE livingTrace
    $F(out, 'parasol',                  130, 38);                          // club 入口傘

    // ── SW アンビエント ──
    $F(out, 'chouchin',               -130, 122);                          // ピンク提灯
    const swGarb = $F(out, 'garbage', -100, 175);                          // ★ SW livingTrace
    $F(out, 'a_frame_sign',            -75, 148);                          // 居酒屋看板
    $F(out, 'noren',                   -75, 138);                          // 麻雀暖簾

    // ── SE アンビエント ──
    $F(out, 'parasol',                  30, 158);                          // cafe 傘
    const sigSE = $F(out, 'sign_board',130, 130);                          // 緑ネオン
    const seBike = $F(out, 'bicycle',  100, 175);                          // ★ SE livingTrace
    $F(out, 'bicycle',                  60, 175);                          // 自転車 2
    $F(out, 'mailbox',                 165, 130);                          // mansion 郵便受

    // ── 取り巻き 3 パターン ──
    $F(out, 'puddle_reflection',       -50, 110);
    $F(out, 'puddle_reflection',        50, 110);
    $F(out, 'puddle_reflection',         0, 105);
    $F(out, 'bollard',                 -65, 95);
    $F(out, 'bollard',                  65, 95);
    $F(out, 'street_lamp',             -65, 100);
    $F(out, 'street_lamp',              65, 100);
    $F(out, 'manhole_cover',             0, 100);
    $F(out, 'manhole_cover',           -30, 100);

    // ── 連続軸 ──
    $F(out, 'power_pole',             -178, 92);
    $F(out, 'power_pole',              178, 92);
    $F(out, 'power_pole',             -178, 195);
    $F(out, 'power_pole',              178, 195);
    $F(out, 'power_line',              -90, 195);
    $F(out, 'power_line',               90, 195);
    $F(out, 'cable_junction_box',     -170, 195);
    $F(out, 'cable_junction_box',      170, 195);
    $F(out, 'cat',                     170, 175);                          // SE 路地猫
    $F(out, 'cat',                    -170, 175);                          // SW 路地猫
    $F(out, 'newspaper_stand',           0, 88);

    // ── タイトパッキング: ラブホ街の匿名性 + 隠蔽 ──
    $F(out, 'hedge',              -178, 130);   // SW 隠蔽 hedge 1
    $F(out, 'recycling_bin',      -110, 60);    // ラブホ裏 1 (匿名)
    $F(out, 'recycling_bin',       -50, 60);    // ラブホ裏 2
    $F(out, 'garbage',            -130, 195);   // SW snack 裏
    $F(out, 'garbage',             100, 195);   // SE ロット裏
    $F(out, 'flower_bed',          -75, 195);   // 中央花壇

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch6.NW.love_hotel',
      role: 'hero',
      cell: 'NW',
      focal: loveA,
      companions: [loveB, loveC, sigA, paraA, flagA, lampA],
      boundary: [hgA, hgB, hgC],
      access: [lampA, $F(out, 'manhole_cover', -100, 100)],
      livingTrace: $F(out, 'recycling_bin', -178, 60),
    });
    _CLUSTER(out, {
      id: 'ch6.NE.club',
      role: 'ambient',
      cell: 'NE',
      focal: clubA,
      companions: [clubB, sigNE],
      livingTrace: neRecyc,
    });
    _CLUSTER(out, {
      id: 'ch6.SW.snack',
      role: 'ambient',
      cell: 'SW',
      focal: snackSW,
      companions: [],
      livingTrace: swGarb,
    });
    _CLUSTER(out, {
      id: 'ch6.SE.mahjong',
      role: 'ambient',
      cell: 'SE',
      focal: mahSE,
      companions: [sigSE],
      livingTrace: seBike,
    });

    // ═══ HUMANS ═══
    out.humans = [
      // カップル NW × 2 (ラブホ前)
      _H(-110, 38), 
      // ホステス NE × 2
       
      // 酔客 SW snack × 3
      _H(-130, 138), 
      // SE cafe + mansion
      _H(165, 145),
      // 通行人
      
      // 路地通行人
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch6 ラブホ街: asphalt + red_carpet 上段全幅 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('red_carpet', 0, 60, 360, 100),                         // ★★★ 上段全幅 red (ラブホ + club)
      _G('oil_stained_concrete', -75, 175, 200, 50),             // SW 路地
    ];

    return out;
  })() },

  // ── S2-Ch7: 屋台横丁 (NW+NE merged hero、横道路ゼロ) ──  (時刻 26:30)
  // ▼ ヒーロー: NW+NE merged = yatai × 5 中央集約 (基本形 A オープンスペース)
  // ▼ アンビエント 2 セル: SW = 茶屋 + 居酒屋 / SE = ramen + 寿司
  // horizontalRoads: [] で _MID_HR を省略し、avenue を屋台前のオープンスペースとして開放。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [],                                                 // ✅ 横道路ゼロ (Ch7 シグネチャ)
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // merged 焦点: 屋台 × 5 (v8.3 Phase 3 F: 山型 dy で「中央が一番手前」)
    const yA = $B(out, 'yatai', -112, 70);                                 // ★ HERO FOCAL 屋台 1 (奥)
    const yB = $B(out, 'yatai',  -56, 70);                                 // 屋台 2 (中)
    const yC = $B(out, 'yatai',    0, 60);                                 // 中央 (★ 一番手前)
    const yD = $B(out, 'yatai',   55, 70);                                 // 屋台 4 (中)
    const yE = $B(out, 'yatai',  108, 70);                                 // 東端 (奥)
    // merged 上段ロット (千鳥)
    $B(out, 'townhouse',  -152, 22);
    $B(out, 'apartment',   148, 28);
    $B(out, 'mahjong_parlor', -78, 28);                                    // v8.4 shop→mahjong (上段中央西)
    $B(out, 'capsule_hotel',   72, 22);                                    // v8.4 shop→capsule (上段中央東)
    // SW アンビエント (dy 千鳥)
    const chayaSW = $B(out, 'chaya',   -102, 130);                         // ★ SW 茶屋
    $B(out, 'izakaya',                 -158, 138);                         // 居酒屋 (奥)
    // SE アンビエント
    const ramenSE = $B(out, 'ramen',    102, 130);                         // ★ SE ラーメン
    $B(out, 'sushi_ya',                 162, 138);                         // 寿司
    // タイトパッキング
    $B(out, 'mahjong_parlor', -160, 192);                  // v8.4 shed→mahjong_parlor (SW 端を麻雀荘)
    $B(out, 'capsule_hotel', 160, 192);                  // v8.4 shed→capsule_hotel (SE 端を capsule)
    $B(out, 'garage',     -100, 192);                                      // SW 駐車
    $B(out, 'garage',      100, 192);                                      // SE 駐車
    $B(out, 'snack',      -178, 22);                                       // NW 端 スナック
    $B(out, 'snack',       178, 22);                                       // NE 端 スナック

    // ═══ FURNITURE ═══
    // ── merged 焦点 4 層: 屋台 5 連 ──
    // 各屋台 chouchin × 1 上空
    const chouA = $F(out, 'chouchin', -110, 58);                           // ★ 屋台 1 提灯
    $F(out, 'chouchin',                -55, 58);
    $F(out, 'chouchin',                  0, 60);
    $F(out, 'chouchin',                 55, 58);
    $F(out, 'chouchin',                108, 60);
    // parasol × 5
    $F(out, 'parasol',                -110, 78);
    $F(out, 'parasol',                 -55, 78);
    $F(out, 'parasol',                   0, 80);
    $F(out, 'parasol',                  55, 78);
    $F(out, 'parasol',                 108, 80);
    // noren × 5
    $F(out, 'noren',                  -110, 64);
    $F(out, 'noren',                   -55, 64);
    $F(out, 'noren',                     0, 66);
    $F(out, 'noren',                    55, 64);
    $F(out, 'noren',                   108, 66);
    // 客 bench × 5 (準対称、屋台間)
    const benchA = $F(out, 'bench',    -85, 88);
    $F(out, 'bench',                   -28, 88);
    $F(out, 'bench',                    28, 88);
    $F(out, 'bench',                    80, 88);
    $F(out, 'bench',                   130, 88);
    // 境界
    const wfA = $F(out, 'wood_fence', -178, 70);                           // 横丁西入口
    const wfB = $F(out, 'wood_fence',  178, 70);                           // 横丁東入口
    $F(out, 'flower_planter_row',     -150, 88);                           // プランター 西
    $F(out, 'flower_planter_row',      150, 88);                           // プランター 東
    // 動線
    const popA = $F(out, 'popcorn_cart',-150, 60);                         // ポップコーン 西
    $F(out, 'popcorn_cart',             150, 60);                          // ポップコーン 東
    $F(out, 'balloon_cluster',         -100, 30);                          // 風船 西
    $F(out, 'balloon_cluster',            0, 30);                          // 風船 中央
    $F(out, 'balloon_cluster',          100, 30);                          // 風船 東 (祭り感)
    const lampA = $F(out, 'street_lamp', -65, 88);                         // 街灯 西
    const lampB = $F(out, 'street_lamp',  65, 88);                         // 街灯 東

    // ── 上段ロット (取り巻き facade) ──
    $F(out, 'sign_board',             -150, 22);
    $F(out, 'sign_board',              150, 22);
    $F(out, 'sign_board',              -75, 22);
    $F(out, 'sign_board',               75, 22);

    // ── SW アンビエント ──
    $F(out, 'noren',                  -100, 122);                          // 茶屋暖簾
    const swCat = $F(out, 'cat',      -170, 175);                          // ★ SW livingTrace
    $F(out, 'a_frame_sign',           -130, 148);                          // 居酒屋看板
    $F(out, 'chouchin',               -160, 122);                          // 居酒屋提灯

    // ── SE アンビエント ──
    $F(out, 'chouchin',                100, 122);
    $F(out, 'chouchin',                160, 122);
    const seBike = $F(out, 'bicycle',  130, 175);                          // ★ SE livingTrace
    $F(out, 'a_frame_sign',            130, 148);                          // ramen 看板

    // ── 取り巻き 3 パターン ──
    $F(out, 'puddle_reflection',       -50, 105);
    $F(out, 'puddle_reflection',        50, 105);
    $F(out, 'puddle_reflection',         0, 110);
    $F(out, 'manhole_cover',           -65, 100);
    $F(out, 'manhole_cover',             0, 100);
    $F(out, 'manhole_cover',            65, 100);

    // ── 連続軸 ──
    $F(out, 'power_pole',             -178, 92);
    $F(out, 'power_pole',              178, 92);
    $F(out, 'power_pole',             -178, 195);
    $F(out, 'power_pole',              178, 195);
    $F(out, 'power_line',              -90, 195);
    $F(out, 'power_line',               90, 195);
    $F(out, 'cable_junction_box',     -170, 195);
    $F(out, 'cable_junction_box',      170, 195);
    const garbage = $F(out, 'garbage',   0, 90);                           // 屋台周辺ゴミ
    $F(out, 'newspaper_stand',           0, 88);

    // ── タイトパッキング: 屋台周辺の祭り感 ──
    $F(out, 'garbage',            -110, 90);    // 屋台 1 ゴミ
    $F(out, 'garbage',             -55, 90);    // 屋台 2 ゴミ
    $F(out, 'recycling_bin',      -160, 168);   // izakaya 裏
    $F(out, 'recycling_bin',       160, 168);   // sushi 裏
    $F(out, 'flower_bed',         -150, 88);    // 西端花壇
    $F(out, 'flower_bed',          150, 88);    // 東端花壇

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)
    $F(out, 'cat',                 165, 60);
    $F(out, 'cat',                 -50, 188);

    // ── v8.4 オーバーヘッド chouchin キャノピー (祭り感) + balloon × 6 ──
    $F(out, 'chouchin', -160, 6);  $F(out, 'chouchin', -125, 12); $F(out, 'chouchin',  -90, 6);
    $F(out, 'chouchin',  -55, 12); $F(out, 'chouchin',  -20, 6);  $F(out, 'chouchin',   15, 12);
    $F(out, 'chouchin',   50, 6);  $F(out, 'chouchin',   85, 12); $F(out, 'chouchin',  120, 6);
    $F(out, 'chouchin',  155, 12);
    // banner_pole 旗ガーランド
    $F(out, 'banner_pole', -100, 16); $F(out, 'banner_pole',  100, 16);
    $F(out, 'banner_pole',  -50, 20); $F(out, 'banner_pole',   50, 20);
    // balloon_cluster (祭り感)
    $F(out, 'balloon_cluster', -130, 28); $F(out, 'balloon_cluster',   0, 32);
    $F(out, 'balloon_cluster',  130, 28);

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch7.merged.yatai5',
      role: 'hero',
      cell: 'merged',
      focal: yC,
      companions: [yA, yB, yD, yE, chouA, benchA, popA, lampA, lampB],
      boundary: [wfA, wfB, $F(out, 'flower_planter_row', 0, 88)],
      access: [lampA, lampB],
      livingTrace: garbage,
    });
    _CLUSTER(out, {
      id: 'ch7.SW.chaya',
      role: 'ambient',
      cell: 'SW',
      focal: chayaSW,
      companions: [],
      livingTrace: swCat,
    });
    _CLUSTER(out, {
      id: 'ch7.SE.ramen',
      role: 'ambient',
      cell: 'SE',
      focal: ramenSE,
      companions: [],
      livingTrace: seBike,
    });
    _CLUSTER(out, {
      id: 'ch7.NW.shop',
      role: 'ambient',
      cell: 'NW',
      focal: $F(out, 'sign_board', -178, 22),
      companions: [],
      livingTrace: $F(out, 'mailbox', -178, 38),
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 屋台客 各 1
      _H(-110, 88),  _H(108, 88),
      // 屋台店主
       _H(55, 75), 
      // 酔客 SW/SE
       
      // 通行人
      _H(0, 100),
      // SE ramen
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch7 屋台: asphalt + red_carpet 屋台床中央全幅 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('red_carpet', 0, 78, 360, 60),                          // ★★★ 屋台床 全幅 (祭り)
      _G('concrete', 0, 145, 360, 80),                           // ★ 下段全幅 屋台前 (concrete)
    ];

    return out;
  })() },

  // ── S2-Ch8: 映画館 + ミニシアター街 (SE = ヒーロー) ──  (時刻 27:00)
  // ▼ ヒーロー: SE = movie_theater (基本形 B 中型、深夜上映)
  // ▼ アンビエント 3 セル: NW = karaoke + club + snack / NE = pachinko + game_center + snack / SW = mansion × 2 + 麻雀
  // 部分幅 _HR(155, 30, 180) を SE 映画館前のサービス道として追加。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _HR(155, 30, 180)],                       // ✅ SE サービス道
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // SE 焦点 (v8.2 ジオラマ: 映画館を奥め配置で「広場前扇」感)
    const movie = $B(out, 'movie_theater', 132, 138);                      // ★ HERO FOCAL 映画館 (奥)
    const cafeSE = $B(out, 'cafe',          62, 130);                      // 隣 cafe (手前)
    // NW アンビエント (v8.2: facade 千鳥で y=22 6棟混雑解消)
    const karaNW = $B(out, 'karaoke',     -132, 22);                       // ★ NW karaoke (奥)
    $B(out, 'club',                        -78, 28);                       // club (手前)
    $B(out, 'snack',                       -22, 70);                       // snack (中段に降ろす)
    // NE アンビエント
    const pachNE = $B(out, 'pachinko',     132, 22);                       // ★ NE pachinko (奥)
    $B(out, 'game_center',                  72, 28);                       // ゲーセン (手前)
    $B(out, 'snack',                       162, 70);                       // 隅 snack (中段に降ろす)
    // SW アンビエント (v8.2: dy 千鳥)
    const mansSW = $B(out, 'mansion',     -102, 130);                      // ★ SW mansion 1
    $B(out, 'mansion',                     -42, 138);                      // mansion 2 (奥)
    $B(out, 'mahjong_parlor',             -128, 175);                      // 麻雀
    // タイトパッキング
    $B(out, 'capsule_hotel',                30, 70);                       // 中央 上段
    $B(out, 'apartment_tall', -178, 70);                  // v8.4 shop→apartment_tall (NW 端を高層集合住宅に)
    $B(out, 'capsule_hotel', -160, 192);                  // v8.4 shed→capsule_hotel (SW 端を capsule)
    $B(out, 'mahjong_parlor', 178, 192);                  // v8.4 garage→mahjong_parlor (SE 端を麻雀荘)
    $B(out, 'karaoke', 178, 70);                  // v8.4 shop→karaoke (NE 端を karaoke に)
    $B(out, 'club', -178, 192);                  // v8.4 shed→club (SW 端 (2nd) を club)
    $B(out, 'club', 130, 192);                  // v8.4 garage→club (SE 駐車を club)

    // ═══ FURNITURE ═══
    // ── SE 焦点 4 層 ──
    const movieSign = $F(out, 'sign_board', 130, 118);                     // ★ ポスター看板
    const banA = $F(out, 'banner_pole',     100, 120);                     // 壁面飾り 1
    $F(out, 'banner_pole',                  158, 120);                     // 壁面飾り 2
    $F(out, 'banner_pole',                   60, 120);                     // 壁面飾り 3
    const flagA = $F(out, 'flag_pole',     130, 110);                      // 旗 1
    $F(out, 'flag_pole',                    60, 110);                      // 旗 2
    $F(out, 'shop_awning',                 130, 145);                      // 庇 1
    $F(out, 'shop_awning',                  60, 145);                      // 庇 2
    // 境界
    const fpA = $F(out, 'flower_planter_row', 110, 170);
    $F(out, 'flower_planter_row',           170, 170);
    const bolA = $F(out, 'bollard',          80, 140);
    $F(out, 'bollard',                      178, 140);
    $F(out, 'bollard',                       30, 140);
    // 動線
    const lampA = $F(out, 'street_lamp',     65, 100);
    const lampB = $F(out, 'street_lamp',    130, 88);
    $F(out, 'bench',                         90, 152);                     // 待ち客 bench 1
    $F(out, 'bench',                        130, 152);                     // bench 2
    $F(out, 'bench',                        165, 152);                     // bench 3 (3 個で待ち列)
    $F(out, 'puddle_reflection',            100, 168);
    $F(out, 'puddle_reflection',            150, 168);

    // ── NW アンビエント ──
    const sigA = $F(out, 'sign_board',    -130, 8);                        // 黄ネオン
    $F(out, 'sign_board',                  -75, 8);
    $F(out, 'sign_board',                  -25, 8);
    const nwGarb = $F(out, 'garbage',     -160, 60);                       // ★ NW livingTrace
    $F(out, 'a_frame_sign',                -75, 38);                       // club 看板
    $F(out, 'chouchin',                    -25, 38);                       // snack 提灯

    // ── NE アンビエント ──
    $F(out, 'sign_board',                  130, 8);                        // 赤ネオン
    $F(out, 'sign_board',                   70, 8);
    $F(out, 'sign_board',                  165, 8);
    const neBike = $F(out, 'bicycle',      100, 60);                       // ★ NE livingTrace
    $F(out, 'bicycle',                      50, 60);
    $F(out, 'a_frame_sign',                130, 38);                       // pachinko 看板

    // ── SW アンビエント ──
    const swMail = $F(out, 'mailbox',     -100, 130);                      // ★ SW livingTrace
    $F(out, 'chouchin',                   -130, 168);                      // 麻雀提灯
    $F(out, 'mailbox',                     -45, 130);                      // mansion 2 郵便受

    // ── 取り巻き 3 パターン ──
    $F(out, 'puddle_reflection',           -50, 105);
    $F(out, 'puddle_reflection',            50, 105);
    $F(out, 'puddle_reflection',             0, 105);
    $F(out, 'street_lamp',                 -65, 100);
    $F(out, 'manhole_cover',               -65, 100);
    $F(out, 'manhole_cover',                 0, 100);
    $F(out, 'bollard',                     -65, 92);
    $F(out, 'bollard',                      65, 92);

    // ── 連続軸 ──
    $F(out, 'power_pole',                 -178, 92);
    $F(out, 'power_pole',                  178, 92);
    $F(out, 'power_pole',                 -178, 195);
    $F(out, 'power_pole',                  178, 195);
    $F(out, 'power_line',                  -90, 195);
    $F(out, 'power_line',                   90, 195);
    $F(out, 'cable_junction_box',         -170, 195);
    $F(out, 'cable_junction_box',          170, 195);
    $F(out, 'cat',                        -170, 175);                      // SW 路地猫
    $F(out, 'newspaper_stand',               0, 88);

    // ── タイトパッキング: 映画館街の埋め草 ──
    $F(out, 'hedge',               110, 195);   // SE 映画館裏 hedge 1
    $F(out, 'hedge',               170, 195);   // SE 映画館裏 hedge 2
    $F(out, 'hedge',                30, 195);   // SE 中央 hedge
    $F(out, 'recycling_bin',       -75, 60);    // NW club 裏
    $F(out, 'recycling_bin',       -25, 60);    // NW snack 裏
    $F(out, 'garbage',            -160, 175);   // SW 端
    $F(out, 'garbage',             -45, 175);   // SW mansion 裏
    $F(out, 'flower_bed',         -100, 195);   // SW 中央
    $F(out, 'flower_bed',          165, 195);   // SE 端

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)
    $F(out, 'cat',                 165, 60);

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch8.SE.cinema',
      role: 'hero',
      cell: 'SE',
      focal: movie,
      companions: [cafeSE, movieSign, banA, flagA, lampA, lampB],
      boundary: [fpA, $F(out, 'flower_planter_row', 170, 170), bolA],
      access: [lampA, lampB],
      livingTrace: $F(out, 'recycling_bin', 165, 168),
    });
    _CLUSTER(out, {
      id: 'ch8.NW.karaoke',
      role: 'ambient',
      cell: 'NW',
      focal: karaNW,
      companions: [sigA],
      livingTrace: nwGarb,
    });
    _CLUSTER(out, {
      id: 'ch8.NE.pachinko',
      role: 'ambient',
      cell: 'NE',
      focal: pachNE,
      companions: [],
      livingTrace: neBike,
    });
    _CLUSTER(out, {
      id: 'ch8.SW.mansion',
      role: 'ambient',
      cell: 'SW',
      focal: mansSW,
      companions: [],
      livingTrace: swMail,
    });

    // ═══ HUMANS ═══
    out.humans = [
      // 映画客 SE × 5
      _H(130, 145),  _H(60, 145),
      // ホスト NW × 3
       
      // パチンコ客 NE × 3
      _H(130, 38), 
      // SW mansion
      _H(-45, 138),
      // 通行人
      
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.2 S2-Ch8 映画館: asphalt + tile SE 全面 + concrete SW + red_carpet 残照 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('tile', 90, 150, 180, 100),                             // ★★ SE 映画館前全面
      _G('concrete', -90, 150, 180, 100),                        // ★ SW 駐車 (cafe → concrete に変更、wood_deck 撤去)
      _G('red_carpet', 0, 60, 360, 50),                          // ★ 上段 red_carpet 残照 (Act III 後半)
    ];

    return out;
  })() },

  // ═══ Act IV: 静寂への転換 (Ch9-Ch11) ══════════════════════════════════

  // ── S2-Ch9: 駐車場と裏通り (NE = ヒーロー、静寂転換) ──  (時刻 28:00 = 04:00)
  // ▼ ヒーロー: NE = parking + gas_station (基本形 A オープンスペース、孤立感)
  // ▼ アンビエント 3 セル: NW = 古い住宅 / SW = kura + machiya / SE = 町家 + cat × 4
  // chouchin 1 本だけ残し (寂しさ表現)、cat × 多 (静寂の主役)。部分幅 _HR(80, 65, 180) NE パーキング入口専用。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _HR(80, 65, 180)],                        // ✅ NE パーキング入口
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // NE 焦点 (v8.3 Phase 2 I: NE グリッド + 周囲スカスカ)
    const parking = $B(out, 'parking',  140, 70);                          // ★ HERO FOCAL 24h パーキング (奥)
    const gasNE   = $B(out, 'gas_station', 35, 22);                        // 24h ガソスタ (奥)
    // NW アンビエント (静寂感、奥に追放)
    const houseA  = $B(out, 'house',   -135, 22);                          // ★ 古い住宅 1 (奥)
    $B(out, 'house',                    -85, 28);                          // 古い住宅 2 (手前)
    $B(out, 'snack',                    -42, 70);                          // 閉店間際 snack (中段、孤立)
    // SW アンビエント (奥行き)
    const kuraSW  = $B(out, 'kura',    -135, 130);                         // ★ SW 蔵 (奥)
    $B(out, 'machiya',                  -68, 138);                         // 町家 (手前)
    // SE アンビエント (端集中、中央 gutter 空ける)
    const tnSE    = $B(out, 'townhouse',  85, 130);                        // ★ SE 町家 1
    $B(out, 'townhouse',                 145, 138);                        // 町家 2 (奥)
    $B(out, 'apartment',                 105, 175);                        // アパート
    // タイトパッキング (端集中、静寂強調)
    $B(out, 'shed',     -178, 70);                                         // NW 端 物置
    $B(out, 'shed',     -158, 175);                                        // SW 物置
    $B(out, 'garage',    -52, 175);                                        // SW 駐車
    $B(out, 'machiya',  -178, 130);                                        // SW 端 町家
    $B(out, 'kominka',   178, 175);                                        // SE 端 古民家
    $B(out, 'shop',     -162, 192);                                        // SW 端 小店
    $B(out, 'shop',      158, 198);                                        // SE 端 小店

    // ═══ FURNITURE ═══
    // ── NE 焦点 4 層 ──
    const tcA = $F(out, 'traffic_cone',  80, 60);
    $F(out, 'traffic_cone',             130, 60);
    $F(out, 'traffic_cone',             170, 60);
    $F(out, 'traffic_cone',             130, 95);
    const barA = $F(out, 'barrier',      80, 88);
    $F(out, 'barrier',                  178, 88);
    const carA = $F(out, 'car',          80, 80);                          // 駐車車両 1
    $F(out, 'car',                      130, 80);                          // 駐車車両 2
    $F(out, 'car',                      170, 80);                          // 駐車車両 3
    // 境界
    const wfA = $F(out, 'wood_fence',    75, 60);                          // パーキング区画 1
    $F(out, 'wood_fence',                75, 75);                          // 区画 2
    $F(out, 'wood_fence',                75, 90);                          // 区画 3 (3 個で輪郭)
    $F(out, 'hedge',                    178, 30);
    $F(out, 'hedge',                    178, 80);
    // 動線 (寂しい)
    const lampA = $F(out, 'street_lamp',100, 95);                          // 街灯 1 個のみ
    $F(out, 'vending',                   60, 38);                          // 自販機 (孤立)
    const neGarb = $F(out, 'garbage',   165, 45);                          // ★ NE livingTrace

    // ── NW アンビエント: 古い住宅 ──
    $F(out, 'mailbox',                 -130, 22);
    $F(out, 'mailbox',                  -90, 22);
    $F(out, 'mailbox',                  -45, 22);
    const nwMail = $F(out, 'mailbox',     0, 22);                          // ★ NW livingTrace (4 個不揃い)
    $F(out, 'sign_board',                 -45, 8);                         // snack 閉店間際

    // ── SW アンビエント ──
    $F(out, 'wood_fence',              -150, 168);
    $F(out, 'wood_fence',              -120, 168);
    const swGarb = $F(out, 'garbage',  -100, 175);                         // ★ SW livingTrace
    $F(out, 'cat',                     -170, 145);                         // SW 蔵裏猫

    // ── SE アンビエント (cat × 4 静寂の主役) ──
    $F(out, 'cat',                      170, 165);                         // SE cat 1
    const seCat = $F(out, 'cat',         50, 175);                         // ★ SE livingTrace cat 4

    // ── 取り巻き 3 パターン ──
    $F(out, 'puddle_reflection',        -50, 105);
    $F(out, 'puddle_reflection',         50, 105);
    $F(out, 'puddle_reflection',          0, 110);
    $F(out, 'street_lamp',              -65, 100);
    $F(out, 'street_lamp',               65, 100);                         // 歩道灯 (もう少し残ってる)
    $F(out, 'manhole_cover',            -65, 100);
    $F(out, 'manhole_cover',              0, 100);
    $F(out, 'chouchin',                 -45, 38);                          // ★ 寂しさ表現 (1 本だけ残し)

    // ── 連続軸 ──
    $F(out, 'power_pole',              -178, 92);
    $F(out, 'power_pole',               178, 92);
    $F(out, 'power_pole',              -178, 195);
    $F(out, 'power_pole',               178, 195);
    $F(out, 'power_line',               -90, 195);
    $F(out, 'power_line',                90, 195);
    $F(out, 'cable_junction_box',      -170, 195);
    $F(out, 'cable_junction_box',       170, 195);
    $F(out, 'newspaper_stand',          165, 75);

    // ── タイトパッキング: 静寂への移行・古い住宅街 ──
    $F(out, 'hedge',                -5, 130);   // 中央 hedge
    $F(out, 'garbage',             -75, 178);   // SW machiya 裏
    $F(out, 'garbage',             170, 195);   // SE 端
    $F(out, 'recycling_bin',      -130, 60);    // 古い住宅裏
    $F(out, 'flower_bed',          -50, 195);   // SW 路地端
    $F(out, 'flower_bed',           50, 195);   // SE 路地端
    $F(out, 'fallen_leaves' as any, -100, 195); // 落ち葉 (神社予兆)

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    $F(out, 'recycling_bin',      -75, 92);     // 中央リサイクル
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch9.NE.parking',
      role: 'hero',
      cell: 'NE',
      focal: parking,
      companions: [gasNE, tcA, carA, lampA],
      boundary: [wfA, $F(out, 'wood_fence', 75, 105), $F(out, 'hedge', 178, 130)],
      access: [lampA, $F(out, 'manhole_cover', 100, 100)],
      livingTrace: neGarb,
    });
    _CLUSTER(out, {
      id: 'ch9.NW.house',
      role: 'ambient',
      cell: 'NW',
      focal: houseA,
      companions: [],
      livingTrace: nwMail,
    });
    _CLUSTER(out, {
      id: 'ch9.SW.kura',
      role: 'ambient',
      cell: 'SW',
      focal: kuraSW,
      companions: [],
      livingTrace: swGarb,
    });
    _CLUSTER(out, {
      id: 'ch9.SE.townhouse',
      role: 'ambient',
      cell: 'SE',
      focal: tnSE,
      companions: [],
      livingTrace: seCat,
    });

    // ═══ HUMANS (静寂、控えめ) ═══
    out.humans = [
      _H(0, 100),                                                          
      _H(-90, 38),                                                         
      _H(90, 60),                                                          
      _H(-45, 38),
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch9 駐車場: asphalt + oil_stained 駐車場大 + 神社予兆 ──
      _G('asphalt', 0, 100, 360, 200),                           // BASE
      _G('oil_stained_concrete', 90, 80, 180, 130),              // ★★ NE 駐車場全面
      _G('stone_pavement', -90, 150, 180, 100),                  // ★★ SW 神社予兆全面
      _G('fallen_leaves', -130, 180, 100, 30),
    ];

    return out;
  })() },

  // ── S2-Ch10: 古い住宅 + 神社の裏手 (SW = ヒーロー) ──  (時刻 04:30 朝霧)
  // ▼ ヒーロー: SW = kura + shed (神社蔵見立て、stone_pavement 参道予告)
  // ▼ アンビエント 3 セル: NW = 茶屋 + 和菓子 + 古民家 / NE = 町家 + bonsai / SE = shed × 2 + 蔵集落
  // 部分幅 _HR(165, -180, 0) を SW 蔵集落の小道として追加。chouchin 完全消失。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR, _HR(165, -180, 0)],                       // ✅ SW 蔵集落小道
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // SW 焦点
    const kuraSW = $B(out, 'kura',     -100, 130);                         // ★ HERO FOCAL 神社蔵
    const shedSW = $B(out, 'shed',     -160, 130);                         // 摂社見立て
    // NW アンビエント
    const komiNW = $B(out, 'kominka',  -130, 22);                          // ★ NW 古民家
    $B(out, 'chaya',                    -75, 22);                          // 茶屋
    $B(out, 'wagashi',                  -25, 22);                          // 和菓子
    // NE アンビエント
    const tnNE   = $B(out, 'townhouse',  80, 22);                          // ★ NE 町家 1
    $B(out, 'townhouse',                130, 22);                          // 町家 2
    $B(out, 'machiya',                   30, 22);                          // 町家 (avenue 寄り)
    // SE アンビエント
    const shedSE = $B(out, 'shed',       60, 130);                         // ★ SE 蔵集落 1
    $B(out, 'shed',                     130, 130);                         // 蔵 2
    $B(out, 'machiya',                   30, 138);                         // 町家
    $B(out, 'kura',                     165, 175);                         // 蔵 3
    // タイトパッキング
    $B(out, 'kominka',                 -178, 70);                          // NW 端 古民家
    $B(out, 'townhouse',                170, 70);                          // NE 端 町家
    $B(out, 'shop',                     178, 192);                         // SE 端 小店
    $B(out, 'shed',                    -178, 192);                         // SW 端 物置
    $B(out, 'shed',                     130, 192);                         // SE 物置

    // ═══ FURNITURE ═══
    // ── SW 焦点 4 層 ──
    const slA = $F(out, 'stone_lantern', -130, 145);                       // ★ 石灯籠 西
    const slB = $F(out, 'stone_lantern',  -70, 145);                       // 石灯籠 東
    const slC = $F(out, 'stone_lantern', -100, 168);                       // 石灯籠 中央南
    $F(out, 'bamboo_water_fountain',     -70, 158);                        // 手水
    // 境界
    const bfA = $F(out, 'bamboo_fence', -178, 130);                        // 竹垣 西 1
    const bfB = $F(out, 'bamboo_fence', -178, 168);                        // 竹垣 西 2
    const bfC = $F(out, 'bamboo_fence',    0, 130);                        // 竹垣 中央 1
    $F(out, 'bamboo_fence',                0, 168);                        // 竹垣 中央 2
    $F(out, 'hedge',                     -50, 195);
    $F(out, 'hedge',                    -150, 195);

    // ── NW アンビエント ──
    $F(out, 'noren',                  -130, 28);                           // 古民家暖簾
    $F(out, 'noren',                   -75, 28);                           // 茶屋暖簾
    $F(out, 'noren',                   -25, 28);                           // 和菓子暖簾
    const nwMail = $F(out, 'mailbox', -100, 22);                           // ★ NW livingTrace
    $F(out, 'mailbox',                -130, 22);                           // 古民家郵便受

    // ── NE アンビエント ──
    $F(out, 'bonsai',                   80, 38);                           // ★ 町家 bonsai
    const neCat = $F(out, 'cat',       170, 38);                           // ★ NE livingTrace
    $F(out, 'mailbox',                 -25, 22);                           // 町家郵便受

    // ── SE アンビエント ──
    const seGarb = $F(out, 'garbage',  100, 175);                          // ★ SE livingTrace
    $F(out, 'mailbox',                  60, 130);                          // 蔵郵便受
    $F(out, 'wood_fence',               60, 195);                          // 蔵区画
    $F(out, 'wood_fence',              130, 195);

    // ── 取り巻き 3 パターン ──
    $F(out, 'puddle_reflection',       -50, 105);                          // 朝霧
    $F(out, 'puddle_reflection',        50, 105);
    $F(out, 'puddle_reflection',         0, 110);
    $F(out, 'street_lamp',             -65, 100);
    $F(out, 'street_lamp',              65, 100);
    $F(out, 'manhole_cover',           -65, 100);
    $F(out, 'manhole_cover',             0, 100);

    // ── 連続軸 ──
    $F(out, 'power_pole',             -178, 92);
    $F(out, 'power_pole',              178, 92);
    $F(out, 'power_pole',             -178, 195);
    $F(out, 'power_pole',              178, 195);
    $F(out, 'power_line',              -90, 195);
    $F(out, 'power_line',               90, 195);
    $F(out, 'cable_junction_box',     -170, 195);
    $F(out, 'cable_junction_box',      170, 195);
    $F(out, 'cat',                    -170, 175);                          // SW 端 cat
    $F(out, 'cat',                    -150, 195);                          // SW 路地 cat
    $F(out, 'newspaper_stand',           0, 88);

    // ── タイトパッキング: 神社の裏・蔵集落 ──
    $F(out, 'stone_lantern',     -130, 175);    // 蔵集落石灯籠 1
    $F(out, 'stone_lantern',      -50, 175);    // 蔵集落石灯籠 2
    $F(out, 'bonsai',             130, 38);     // 町家 bonsai 1
    $F(out, 'bonsai',              30, 38);     // 町家 bonsai 2
    $F(out, 'bonsai',             170, 38);     // NE 端 bonsai
    $F(out, 'bamboo_cluster',    -178, 145);    // 神社竹林 1
    $F(out, 'bamboo_cluster',     -50, 145);    // 神社竹林 2
    $F(out, 'bamboo_cluster',       0, 195);    // 神社竹林 3
    $F(out, 'hedge',             -130, 88);     // 蔵集落境界 1
    $F(out, 'wood_fence',          60, 195);    // SE 蔵区画 1
    $F(out, 'wood_fence',         130, 195);    // SE 蔵区画 2
    $F(out, 'fallen_leaves' as any, -50, 178);  // 落ち葉
    $F(out, 'fallen_leaves' as any, 100, 195);  // 落ち葉 SE
    $F(out, 'gravel' as any,       60, 178);    // 蔵集落玉砂利
    $F(out, 'flower_bed',           0, 88);     // 中央花壇

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    $F(out, 'garbage',           -160, 88);     // SW 端ゴミ
    $F(out, 'garbage',            156, 88);     // SE 端ゴミ
    $F(out, 'recycling_bin',      -75, 92);     // 中央リサイクル
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch10.SW.shrine_back',
      role: 'hero',
      cell: 'SW',
      focal: kuraSW,
      companions: [shedSW, slA, slB, slC],
      boundary: [bfA, bfB, bfC],
      access: [$F(out, 'stone_lantern', -130, 168), $F(out, 'street_lamp', -100, 145)],
      livingTrace: $F(out, 'mailbox', -130, 130),
    });
    _CLUSTER(out, {
      id: 'ch10.NW.kominka',
      role: 'ambient',
      cell: 'NW',
      focal: komiNW,
      companions: [],
      livingTrace: nwMail,
    });
    _CLUSTER(out, {
      id: 'ch10.NE.townhouse',
      role: 'ambient',
      cell: 'NE',
      focal: tnNE,
      companions: [],
      livingTrace: neCat,
    });
    _CLUSTER(out, {
      id: 'ch10.SE.shed',
      role: 'ambient',
      cell: 'SE',
      focal: shedSE,
      companions: [],
      livingTrace: seGarb,
    });

    // ═══ HUMANS ═══
    out.humans = [
      _H(0, 100),                                                          
      _H(-75, 158),                                                        
      _H(-75, 38),                                                         
      _H(100, 145),                                                        
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch10 神社の裏: residential_tile + stone 神社境内 + grass 古民家庭 ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE 古都
      _G('stone_pavement', -90, 150, 180, 100),                  // ★★ SW 神社境内全面
      _G('moss', -75, 168, 80, 40),
      _G('fallen_leaves', -130, 180, 80, 30),
      _G('gravel', -90, 195, 130, 30),
      _G('grass', -90, 60, 180, 100),                            // ★ NW 古民家庭全面
      _G('grass', 90, 60, 180, 100),                             // ★ NE 庭全面
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },

  // ── S2-Ch11: ★ 神社の表参道 (NE = ヒーロー、Stage 3 への handoff) ──  (時刻 05:00 薄明)
  // ▼ ヒーロー: NE = torii と表参道 (基本形 B + ランドマーク、Stage 3 移行点)
  // ▼ アンビエント 3 セル: NW = 茶屋 + 和菓子 + 古民家 / SW = 蔵 × 2 + 町家 / SE = 古民家 + 茶屋
  // sakura_tree × 2 が Stage 2 唯一の桜 (Stage 3 への handoff)。
  { patternId: 's2_raw', raw: ((): RawChunkBody => {
    const out: RawChunkBody = {
      buildings: [], furniture: [], humans: [], grounds: [],
      horizontalRoads: [_MID_HR],                                          // 参道一直線
      verticalRoads: [_AVE],
    };

    // ═══ BUILDINGS ═══
    // NE 焦点 = torii (furniture)、建物は周辺アンビエントのみ
    // NW アンビエント (v8.2 ジオラマ: facade 千鳥 18/22/32 で「街図」感解消)
    const chayaNW = $B(out, 'chaya',    -102, 22);                         // ★ NW 茶屋 (奥)
    $B(out, 'wagashi',                   -42, 28);                         // 和菓子 (手前)
    $B(out, 'kominka',                   -78, 70);                         // 古民家 (奥)
    // SW アンビエント (v8.2: 蔵集落の奥行き三段)
    const kuraSW1 = $B(out, 'kura',     -132, 130);                        // ★ SW 蔵 1
    $B(out, 'kura',                      -68, 138);                        // 蔵 2 (手前)
    $B(out, 'machiya',                   -22, 138);                        // 町家 (奥)
    // SE アンビエント
    const komiSE  = $B(out, 'kominka',   132, 130);                        // ★ SE 古民家
    $B(out, 'chaya',                      62, 138);                        // 茶屋
    // タイトパッキング (v8.2: 端の facade 千鳥)
    $B(out, 'shed',                      128, 192);                        // SE 物置
    $B(out, 'shop',                      172, 28);                         // NE 端 小店 (手前)
    $B(out, 'shop',                      178, 70);                         // NE 端 小店 2
    $B(out, 'townhouse',                -172, 138);                        // SW 端 町家
    $B(out, 'shed',                     -178, 192);                        // SW 端 物置
    $B(out, 'wagashi',                   168, 175);                        // SE 端 和菓子
    $B(out, 'kominka',                   168, 22);                         // NE 端 古民家 (奥)

    // ═══ FURNITURE ═══
    // ── NE 焦点 4 層: 表参道 ──
    const torii   = $F(out, 'torii',          80, 12);                     // ★ HERO FOCAL ランドマーク (v8.2: 上空シルエット強調 dy=22→12)
    const offBox  = $F(out, 'offering_box',   80, 95);                     // 賽銭箱
    const omiku   = $F(out, 'omikuji_stand',  60, 95);                     // おみくじ
    const emaR    = $F(out, 'ema_rack',      100, 95);                     // 絵馬掛け
    // 取り巻き
    const sspA    = $F(out, 'sando_stone_pillar', 40, 58);                 // 参道石柱 西
    $F(out, 'sando_stone_pillar',                  80, 88);                // 参道石柱 中央
    $F(out, 'sando_stone_pillar',                 120, 58);                // 参道石柱 東
    const slA     = $F(out, 'stone_lantern',  40, 88);                     // 石灯籠 西
    $F(out, 'stone_lantern',                  120, 88);                    // 石灯籠 東
    const koA     = $F(out, 'koma_inu',       60, 68);                     // 狛犬 西
    $F(out, 'koma_inu',                      100, 68);                     // 狛犬 東
    // 境界: bamboo_fence × 6 + shrine_fence_red × 2
    const bfA = $F(out, 'bamboo_fence',  10, 10);                          // 竹垣 西 1
    $F(out, 'bamboo_fence',              10, 50);                          // 竹垣 西 2
    $F(out, 'bamboo_fence',              10, 90);                          // 竹垣 西 3
    $F(out, 'bamboo_fence',             150, 10);                          // 竹垣 東 1
    $F(out, 'bamboo_fence',             150, 50);                          // 竹垣 東 2
    $F(out, 'bamboo_fence',             150, 90);                          // 竹垣 東 3
    const sfA = $F(out, 'shrine_fence_red', 30, 38);                       // 赤柵 西
    $F(out, 'shrine_fence_red',           130, 38);                        // 赤柵 東
    // 動線
    const ropA = $F(out, 'shinto_rope',  80, 22);                          // 注連縄 (鳥居上)
    // ★ Stage 2 唯一の桜 (Stage 3 への handoff)
    $F(out, 'sakura_tree',               -30, 88);                         // 桜 西
    $F(out, 'sakura_tree',                30, 88);                         // 桜 東 (Stage 3 予告)

    // ── NW アンビエント ──
    $F(out, 'noren',                   -100, 28);                          // 茶屋暖簾
    $F(out, 'noren',                    -45, 28);                          // 和菓子暖簾
    const nwBike = $F(out, 'bicycle',   -75, 60);                          // ★ NW livingTrace
    $F(out, 'mailbox',                 -100, 22);

    // ── SW アンビエント ──
    $F(out, 'wood_fence',              -150, 175);
    $F(out, 'wood_fence',              -100, 175);
    $F(out, 'wood_fence',               -50, 175);
    const swGarb = $F(out, 'garbage',  -100, 168);                         // ★ SW livingTrace
    $F(out, 'mailbox',                 -130, 130);                         // 蔵郵便受

    // ── SE アンビエント ──
    const seMail = $F(out, 'mailbox',   130, 130);                         // ★ SE livingTrace
    $F(out, 'cat',                      170, 145);                         // SE 猫 1
    $F(out, 'cat',                      130, 175);                         // SE 猫 2
    $F(out, 'noren',                     60, 148);                         // 茶屋暖簾

    // ── 取り巻き 3 パターン ──
    $F(out, 'noren',                    -75, 75);                          // NW 古民家暖簾
    // chouchin × 2 だけ残す (Stage 3 予告)
    $F(out, 'chouchin',                -100, 22);                          // chouchin 残り 1
    $F(out, 'chouchin',                 130, 22);                          // chouchin 残り 2 (NE 古民家前)
    $F(out, 'puddle_reflection',        -50, 105);                         // 朝霧
    $F(out, 'puddle_reflection',         50, 105);
    $F(out, 'puddle_reflection',          0, 110);
    $F(out, 'street_lamp',              -65, 100);
    $F(out, 'street_lamp',               65, 100);
    $F(out, 'manhole_cover',            -65, 100);
    $F(out, 'manhole_cover',              0, 100);
    $F(out, 'newspaper_stand',           80, 88);                          // ★ NE livingTrace (Stage 3 handoff)

    // ── 連続軸 ──
    $F(out, 'power_pole',              -178, 92);
    $F(out, 'power_pole',               178, 92);
    $F(out, 'power_pole',              -178, 195);
    $F(out, 'power_pole',               178, 195);
    $F(out, 'power_line',               -90, 195);
    $F(out, 'power_line',                90, 195);
    $F(out, 'cable_junction_box',      -170, 195);
    $F(out, 'cable_junction_box',       170, 195);

    // ── タイトパッキング: 表参道周辺の和風 ──
    $F(out, 'stone_lantern',      40, 145);     // 参道石灯籠 西 (下段)
    $F(out, 'stone_lantern',     120, 145);     // 参道石灯籠 東 (下段)
    $F(out, 'bonsai',           -100, 38);      // 茶屋 bonsai
    $F(out, 'bonsai',            -45, 38);      // 和菓子 bonsai
    $F(out, 'bonsai',            130, 138);     // 古民家 bonsai
    $F(out, 'bamboo_cluster',   -178, 168);     // 蔵集落竹林
    $F(out, 'bamboo_cluster',    178, 168);     // SE 端竹林
    $F(out, 'bamboo_cluster',      0, 195);     // 中央竹林
    $F(out, 'hedge',            -130, 168);     // 蔵集落境界
    $F(out, 'hedge',             130, 168);     // SE 古民家境界
    $F(out, 'hedge',             -50, 195);     // 中央南境界
    $F(out, 'wood_fence',         -75, 178);    // 蔵区画
    $F(out, 'mailbox',          -178, 22);      // NW 端郵便受
    $F(out, 'fallen_leaves' as any, -50, 195);  // 落ち葉 SW
    $F(out, 'fallen_leaves' as any,  50, 195);  // 落ち葉 SE

    // ── 夜街シグネチャ補強 (slim v6.4: 焦点コントラスト確保) ──
    // 上空 chouchin 帯 (avenue 全幅、夜街の主光源)
    $F(out, 'chouchin',           -130, 12);    // 上空 chouchin NW
    $F(out, 'chouchin',            -45, 12);    // 上空 chouchin 中央西
    $F(out, 'chouchin',             45, 12);    // 上空 chouchin 中央東
    $F(out, 'chouchin',            130, 12);    // 上空 chouchin NE
    // facade ネオン (各セル代表)
    $F(out, 'sign_board',         -150, 38);    // NW ネオン
    $F(out, 'sign_board',          150, 38);    // NE ネオン
    // 街灯 (歩道帯)
    $F(out, 'street_lamp',        -160, 75);    // NW 街灯
    $F(out, 'street_lamp',         160, 75);    // NE 街灯
    // puddle_reflection (路面湿り気、夜街シグネチャ)
    $F(out, 'puddle_reflection', -130, 165);
    $F(out, 'puddle_reflection',  130, 165);
    // 路地裏のゴミ (各セルに 1 個ずつ)
    $F(out, 'garbage',           -160, 88);     // SW 端ゴミ
    $F(out, 'garbage',            156, 88);     // SE 端ゴミ
    $F(out, 'recycling_bin',      -75, 92);     // 中央リサイクル
    // 路地猫 (Stage 2 では cat × 2 程度に絞る、緑ノイズ削減)

    // ═══ CLUSTERS ═══
    _CLUSTER(out, {
      id: 'ch11.NE.torii',
      role: 'hero',
      cell: 'NE',
      focal: torii,
      companions: [offBox, omiku, emaR, sspA, slA, koA],
      boundary: [bfA, $F(out, 'bamboo_fence', 10, 130), sfA],
      access: [ropA, $F(out, 'sando_stone_pillar', 80, 145)],
      livingTrace: $F(out, 'newspaper_stand', 80, 100),
    });
    _CLUSTER(out, {
      id: 'ch11.NW.chaya',
      role: 'ambient',
      cell: 'NW',
      focal: chayaNW,
      companions: [],
      livingTrace: nwBike,
    });
    _CLUSTER(out, {
      id: 'ch11.SW.kura',
      role: 'ambient',
      cell: 'SW',
      focal: kuraSW1,
      companions: [],
      livingTrace: swGarb,
    });
    _CLUSTER(out, {
      id: 'ch11.SE.kominka',
      role: 'ambient',
      cell: 'SE',
      focal: komiSE,
      companions: [],
      livingTrace: seMail,
    });

    // ═══ HUMANS ═══
    out.humans = [
      _H(80, 100),                                                         
      _H(-100, 38),                                                        
      _H(60, 145),                                                         
      _H(0, 100),                                                          
    ];

    // ═══ GROUNDS ═══
    out.grounds = [
      // ── v7.1 S2-Ch11 表参道: residential_tile + stone NE 全幅 + 玉砂利 + 苔 + 落葉 ──
      _G('residential_tile', 0, 100, 360, 200),                  // BASE
      _G('stone_pavement', 90, 100, 180, 200),                   // ★★★ NE 表参道全幅 (Stage 3 へ)
      _G('gravel', 90, 88, 180, 60),                             // ★ 玉砂利帯
      _G('fallen_leaves', 50, 88, 60, 30),
      _G('fallen_leaves', 130, 88, 60, 30),
      _G('moss', 90, 178, 80, 40),
      _G('grass', -90, 60, 180, 100),                            // NW 茶屋庭全面
      _G('stone_pavement', -90, 150, 180, 100),                  // SW 蔵集落全面
      _G('moss', -90, 178, 80, 40),
      _G('stone_pavement', -65, 100, 24, 200),
    ];

    return out;
  })() },
];

// ─── Stage 3: 都心オフィス・公共中枢 (raw 配置) ─────────────────
// 【全体の物語】: Stage 2 の雑多な夜街から、整然とした都心へ移行する。高層建物・
//   公共施設・駅前・広場・銀行・市役所・病院で、破壊対象のスケールが上がったことを
//   見せる。後半で warehouse / pallet_stack / cargo_container を少量混ぜ Stage 4 へ接続。
// 【連続軸】:
//   中央 avenue と大交差点
//   stone_pavement / tile の公共広場
//   street_lamp / bollard / flag_pole の整列
//   駅前・公共施設前の人流
// 【密度目安】: 建物 18-28 / 家具 65-105 / 人 10-24 (整然とした都心。公共広場)
// ※ 現状チャンク内容は旧 "和風・古都" 仕様。今後 raw を順次差し替える。
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
      _B('machiya', 138, 45),                                   // ★ 町家
      _B('kimono_shop', 170, 42),                               // ★ 呉服屋 (別区画)
      _B('machiya', 145, 78),                                   // 奥の町家

      // === 下段 西: ★ 土蔵と武道場 ===
      _B('kura', -162, 130),                                    // 蔵
      _B('dojo', -130, 138),                                    // ★ 道場 (大きめ)
      _B('shed', -178, 175),
      _B('greenhouse', -109, 178),

      // === 下段 中: 参道続き + 摂社 ===
      _B('shrine', -35, 152),                                   // ★ 小さな摂社 (奥)
      _B('chaya', 20, 132),
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
    horizontalRoads: [_HR(100, -180, 131), _HR(100, 159, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 200, 'avenue'), _VR(90, 0, 200)],
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
      _B('machiya', -45, 76),                                   // 奥の 2F 町家
      _B('shed', 15, 76),

      // === 上段 東: 土産物屋 ===
      _B('machiya', 110, 74),                                   // ★ 2F 町家 (奥)
      _B('wagashi', 135, 42),                                   // ★ 和菓子 (別区画)
      _B('chaya', 168, 40),                                     // 茶屋 (別区画)
      _B('shed', 150, 78),

      // === 下段 西: 旅館入口 ===
      _B('ryokan', -145, 150),                                  // ★ 大きな旅館
      _B('kimono_shop', -109, 132),                             // ★ 呉服屋 (旅館隣)
      _B('kura', -178, 175),                                    // 裏の蔵 (唯一)
      _B('shed', -115, 178),

      // === 下段 中: 路地と料亭 ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画)
      _B('sushi_ya', 18, 138),                                   // ★ 寿司屋 (別区画)
      _B('wagashi', 40, 132),                                   // ★ 和菓子屋 (別区画)
      _B('dojo', -22, 175),                                     // 奥の道場 (別区画)
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
      _B('shed', -16, 78),

      // === 上段 東: 町家クラスタ ===
      _B('machiya', 115, 70),                                   // ★ 町家 (奥)
      _B('kominka', 109, 42),                                   // 古民家 (唯一)
      _B('bookstore', 138, 42),                                 // 古書店
      _B('wagashi', 168, 40),                                   // ★ 和菓子 (別区画)
      _B('shed', 178, 78),

      // === 下段 西: 和風の庭付き家 + 竹林 ===
      _B('kominka', -162, 132),                                 // 古民家 (唯一)
      _B('ryokan', -120, 150),                                  // ★ 小旅館
      _B('kura', -178, 175),
      _B('shed', -104, 178),

      // === 下段 中: 参道の広場 ===
      _B('chaya', -40, 132),                                    // 茶屋 (別区画)
      _B('sushi_ya', 18, 138),                                   // ★ 寿司屋 (別区画)
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
      _B('wagashi', -107, 38),                                  // 旅館隣の和菓子屋
      _B('kura', -172, 78),                                     // 旅館の蔵 (奥)
      _B('shed', -130, 78),

      // === 上段 中: 料亭 (多彩な小店) ===
      _B('sushi_ya', -55, 40),                                  // ★ 寿司屋
      _B('kominka', -25, 44),                                   // 古民家 (唯一)
      _B('kimono_shop', 25, 42),                                // ★ 呉服屋
      _B('chaya', 55, 40),                                      // 茶屋 (唯一、別区画)
      _B('shed', -16, 78),

      // === 上段 東: 2 軒目の旅館 ===
      _B('ryokan', 132, 52),                                    // ★ 2 軒目
      _B('dojo', 170, 44),                                      // ★ 道場
      _B('kura', 107, 78),                                      // 蔵 (奥)
      _B('shed', 165, 78),

      // === 下段 西: 古民家と蔵 (差別化) ===
      _B('kominka', -162, 132),                                 // 古民家 (別区画 1)
      _B('machiya', -132, 148),                                 // ★ 町家 (1 棟のみ)
      _B('wagashi', -107, 132),                                 // ★ 和菓子 (別区画)
      _B('shed', -178, 175),
      _B('greenhouse', -135, 178),

      // === 下段 中: 庭園 (茶屋 1 + 寿司屋) ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画)
      _B('sushi_ya', 38, 132),                                  // ★ 寿司屋 (別区画)
      _B('shed', -15, 178),

      // === 下段 東: 町家と古書店 ===
      _B('machiya', 110, 168),                                  // ★ 町家 (奥)
      _B('bookstore', 148, 168),                                // 古書店 (machiya の隣に変化)
      _B('kominka', 108, 132),                                  // 古民家 (別区画)
      _B('dojo', 138, 136),                                     // ★ 道場 (別区画)
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
      _B('wagashi', -108, 40),                                  // ★ 和菓子屋 (温泉土産)
      _B('kura', -172, 78),                                     // 奥の蔵 (唯一)
      _B('sushi_ya', -128, 20),                                 // ★ 寿司屋
      _B('shed', -104, 80),

      // === 上段 中: ★★ 温泉旅館 ★★ ===
      _B('onsen_inn', 0, 68),                                   // ★ 大温泉 (中央、奥)
      _B('chaya', -55, 38),                                     // 1F の茶屋 (唯一)
      _B('kimono_shop', 55, 42),                                // ★ 1F の呉服屋
      _B('shed', -30, 78),
      _B('shed', 30, 76),

      // === 上段 東: 2 軒目温泉 + 土産物 ===
      _B('onsen_inn', 138, 68),                                 // ★ 2 軒目温泉 (奥)
      _B('wagashi', 108, 38),                                   // ★ 和菓子 (土産)
      _B('bookstore', 178, 42),                                 // 古書店 (旅館の文化)
      _B('kura', 170, 78),                                      // (別区画)

      // === 下段 西: 竹林の小径 (kominka 1 軒) ===
      _B('kominka', -162, 132),                                 // 古民家 (唯一)
      _B('machiya', -128, 148),                                 // ★ 町家 (町並み感)
      _B('dojo', -70, 138),                                    // ★ 道場 (竹林の奥)
      _B('shed', -178, 175),

      // === 下段 中: ★ 露天風呂の庭 (茶屋 1) ===
      _B('chaya', -40, 132),                                    // 茶屋 (別区画)
      _B('kimono_shop', 40, 132),                               // ★ 呉服屋 (別区画)
      _B('shed', -16, 170),
      _B('shed', 15, 175),

      // === 下段 東: 町家の並び (差別化) ===
      _B('machiya', 110, 170),                                  // ★ 町家 (奥)
      _B('ryokan', 148, 162),                                   // ★ 小旅館 (別の奥施設)
      _B('kominka', 108, 132),                                  // 古民家 (別区画)
      _B('sushi_ya', 138, 136),                                 // ★ 寿司屋 (別区画)
      _B('kura', 175, 132),                                     // (別区画)
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
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 48, 'avenue'), _VR(0, 88, 200, 'avenue'), _VR(90, 0, 200)],
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
      // === 上段 西: 古民家集落 (多彩に) ===
      _B('kominka', -162, 40),                                  // 古民家 (唯一)
      _B('dojo', -130, 44),                                     // ★ 道場
      _B('wagashi', -107, 40),                                  // ★ 和菓子屋
      _B('kura', -172, 78),
      _B('greenhouse', -128, 78),

      // === 上段 中: ★ 裏の摂社 + 寺 ===
      _B('shrine', -25, 55),                                    // ★ 摂社 (avenue 左脇)
      _B('temple', 30, 60),                                     // ★ 小さな寺 (avenue 右脇)
      _B('sushi_ya', -62, 42),                                  // ★ 参道脇の寿司屋
      _B('chaya', 62, 38),                                      // 茶屋 (唯一)
      _B('shed', -16, 78),
      _B('shed', 15, 82),

      // === 上段 東: 町家 + 蔵 + 呉服 ===
      _B('machiya', 110, 72),                                   // ★ 町家 (奥、唯一)
      _B('kimono_shop', 138, 42),                               // ★ 呉服屋
      _B('kura', 170, 42),                                      // 蔵 (前、唯一)
      _B('shed', 155, 78),

      // === 下段 西: 旅館裏 + 蔵 ===
      _B('ryokan', -138, 165),                                  // ★ 旅館の裏 (奥)
      _B('kura', -168, 132),                                    // (別区画)
      _B('bookstore', -107, 138),                               // 古書店 (旅館隣)
      _B('shed', -145, 187),

      // === 下段 中: 小茶屋の広場 (差別化) ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画、唯一)
      _B('wagashi', 19, 136),                                    // ★ 和菓子屋 (別区画)
      _B('sushi_ya', 45, 132),                                  // ★ 寿司屋 (別区画)
      _B('shed', -20, 178),
      _B('shed', 22, 178),

      // === 下段 東: 町家集落 (集落感を保ちつつ多彩) ===
      _B('machiya', 110, 170),                                  // ★ (別区画)
      _B('kominka', 138, 132),                                  // 古民家 (別区画)
      _B('dojo', 168, 138),                                     // ★ 道場 (別区画)
      _B('kura', 178, 178),                                     // 蔵 (別区画)
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
      _B('dojo', -58, 44),                                      // ★ 脇の道場
      _B('kominka', 58, 42),                                    // 僧坊 (唯一)
      _B('chaya', -25, 38),                                     // 参拝茶屋 (唯一)
      _B('wagashi', 25, 38),                                    // ★ 参拝の和菓子屋

      // === 上段 東: 僧坊と修行場 (多彩に) ===
      _B('kominka', 108, 40),                                   // 僧坊 (別区画 1)
      _B('dojo', 135, 44),                                      // ★ 修行道場 (別区画)
      _B('machiya', 160, 70),                                   // ★ 町家 (奥)
      _B('kura', 138, 78),

      // === 下段 西: 鐘楼の広場 (差別化) ===
      _B('shrine', -150, 150),                                  // ★ 小さな鐘楼 (奥)
      _B('bookstore', -108, 132),                               // 古書店 (経典)
      _B('kura', -178, 175),
      _B('shed', -115, 178),

      // === 下段 中: 境内の石畳広場 ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画、唯一)
      _B('wagashi', 38, 132),                                   // ★ 和菓子 (別区画)
      _B('shed', -15, 180),
      _B('shed', 18, 180),

      // === 下段 東: 参拝者向け茶屋クラスタ (差別化) ===
      _B('sushi_ya', 108, 132),                                 // ★ 寿司屋 (参拝者向け)
      _B('kimono_shop', 138, 138),                              // ★ 呉服屋
      _B('kominka', 170, 132),                                  // 古民家 (別区画)
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
    horizontalRoads: [_HR(100, -180, -14), _HR(100, 14, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 44, 'avenue'), _VR(0, 120, 200, 'avenue'), _VR(90, 0, 200)],
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
      _B('dojo', -62, 44),                                      // ★ 参道脇の道場
      _B('kominka', 62, 42),                                    // 僧坊 (唯一)
      _B('shed', -30, 78),
      _B('shed', 30, 78),

      // === 上段 東: 庫裏 + 古書 ===
      _B('ryokan', 138, 48),                                    // ★ 庫裏
      _B('bookstore', 108, 42),                                 // 経典を扱う古書店
      _B('wagashi', 178, 42),                                   // ★ 和菓子 (参拝土産)
      _B('kura', 168, 78),

      // === 下段 西: 墓地の竹垣 + 小祠 ===
      _B('shrine', -148, 160),                                  // ★ 小さな祠
      _B('kominka', -108, 132),                                 // 古民家 (別区画)
      _B('kura', -178, 175),
      _B('shed', -125, 178),

      // === 下段 中: 境内広場 + 手水舎 (差別化) ===
      _B('chaya', -38, 132),                                    // 茶屋 (唯一)
      _B('sushi_ya', 38, 132),                                  // ★ 参拝者向け寿司
      _B('shed', -16, 178),
      _B('shed', 18, 178),

      // === 下段 東: 僧坊 + 多彩 ===
      _B('dojo', 110, 138),                                     // ★ 道場 (別区画)
      _B('kimono_shop', 138, 138),                              // ★ 呉服屋
      _B('kominka', 170, 132),                                  // 古民家 (別区画)
      _B('kura', 160, 175),                                     // (別区画)
      _B('machiya', 110, 168),                                  // ★ 奥の町家
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
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 53, 'avenue'), _VR(0, 87, 200, 'avenue'), _VR(90, 0, 200)],
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
      _B('tahoto', -148, 68),                                   // ★ 多宝塔 (奥)
      _B('chaya', -108, 40),
      _B('kominka', -178, 40),
      _B('shed', -120, 78),

      // === 上段 中: 石庭 + 小祠 (多彩に) ===
      _B('shrine', -28, 50),                                    // ★ 小さな shrine
      _B('dojo', -62, 44),                                      // ★ 石庭脇の道場
      _B('kominka', 62, 42),                                    // 古民家 (唯一)
      _B('chaya', 30, 40),                                      // 石庭の茶屋 (唯一)
      _B('shed', -16, 78),

      // === 上段 東: 僧坊 + 庫裏 ===
      _B('ryokan', 140, 50),                                    // ★ 庫裏
      _B('wagashi', 108, 42),                                   // ★ 和菓子 (寺前)
      _B('bookstore', 175, 42),                                 // 古書店
      _B('kura', 165, 78),

      // === 下段 西: 古民家と苔庭 (差別化) ===
      _B('kominka', -162, 132),                                 // 古民家 (別区画 1)
      _B('machiya', -135, 148),                                 // ★ 町家 (変化)
      _B('kura', -108, 132),
      _B('shed', -178, 175),
      _B('greenhouse', -130, 178),

      // === 下段 中: 石庭の続き ===
      _B('sushi_ya', -38, 132),                                 // ★ 寿司屋 (別区画)
      _B('kimono_shop', 38, 132),                               // ★ 呉服屋 (別区画)
      _B('shed', -16, 178),
      _B('shed', 18, 178),

      // === 下段 東: 町家 + 竹林 (差別化) ===
      _B('machiya', 110, 170),                                  // ★ 町家 (別区画 2)
      _B('dojo', 148, 170),                                     // ★ 道場 (差別化)
      _B('kominka', 108, 132),                                  // 古民家 (別区画 2)
      _B('chaya', 138, 138),                                    // 茶屋 (別区画)
      _B('kura', 175, 132),                                     // (別区画)
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
      _B('machiya', -70, 76),                                   // 奥の町家
      _B('kura', -175, 78),

      // === 上段 中: 古料亭 ===
      _B('sushi_ya', -55, 40),                                  // ★ 寿司屋
      _B('wagashi', -22, 42),                                   // ★ 和菓子屋
      _B('chaya', 22, 40),                                      // 茶屋 (唯一)
      _B('kimono_shop', 55, 44),                                // ★ 呉服屋
      _B('shed', -15, 78),
      _B('shed', 18, 78),

      // === 上段 東: 町家続き + 蔵 ===
      _B('machiya', 110, 52),                                   // 町家 1
      _B('dojo', 142, 44),                                      // ★ 道場 (変化)
      _B('kura', 175, 40),                                      // 蔵 (唯一)
      _B('bookstore', 178, 74),                                 // 古書店 (奥)
      _B('shed', 125, 78),

      // === 下段 西: 古民家 + 多様な店 ===
      _B('kominka', -162, 132),                                 // 古民家 (唯一)
      _B('machiya', -135, 148),                                 // ★ 町家 (変化)
      _B('wagashi', -108, 132),                                 // ★ 和菓子
      _B('kura', -178, 175),
      _B('greenhouse', -130, 178),

      // === 下段 中: 紅葉の広場 (多様な茶屋風) ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画、唯一)
      _B('sushi_ya', 18, 138),                                   // ★ 寿司屋
      _B('kimono_shop', 45, 132),                               // ★ 呉服屋
      _B('shed', -20, 178),
      _B('shed', 22, 178),

      // === 下段 東: 町家 + 竹垣 ===
      _B('machiya', 110, 170),                                  // ★ 奥の町家 (別区画)
      _B('kominka', 108, 132),                                  // 古民家 (別区画)
      _B('dojo', 138, 138),                                     // ★ 道場 (変化)
      _B('chaya', 168, 132),                                    // 茶屋 (別区画)
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
      // === 上段 西: 古民家集落 (多彩化) ===
      _B('kominka', -165, 40),                                  // 古民家 (1 棟のみ)
      _B('machiya', -138, 48),                                  // ★ 町家
      _B('wagashi', -112, 40),                                  // ★ 村の和菓子
      _B('dojo', -170, 74),                                     // ★ 奥の道場
      _B('shed', -130, 78),

      // === 上段 中: 広場と井戸 (多彩な小店) ===
      _B('chaya', -55, 42),                                     // 茶屋 (唯一)
      _B('sushi_ya', -22, 40),                                  // ★ 寿司屋
      _B('kimono_shop', 22, 44),                                // ★ 呉服屋
      _B('bookstore', 55, 40),                                  // 古書店
      _B('kura', -19, 78),                                        // 奥の蔵

      // === 上段 東: ★ 土蔵と町家 (蔵 3 → 2 に削減) ===
      _B('kura', 108, 40),                                      // 蔵 (別区画)
      _B('machiya', 135, 46),                                   // ★ 町家 (変化)
      _B('kura', 165, 40),                                      // 蔵 (1 軒ずつ)
      _B('ryokan', 140, 78),                                    // ★ 古い旅館 (奥)

      // === 下段 西: 蔵と古民家 ===
      _B('kominka', -162, 132),                                 // 古民家 (別区画)
      _B('kura', -135, 138),
      _B('dojo', -110, 132),                                    // ★ 道場
      _B('shed', -178, 175),
      _B('greenhouse', -135, 178),

      // === 下段 中: 茶屋の路地 (多様化) ===
      _B('chaya', -38, 132),                                    // 茶屋 (別区画)
      _B('wagashi', 19, 138),                                    // ★ 和菓子
      _B('sushi_ya', 45, 132),                                  // ★ 寿司屋
      _B('shed', -15, 178),
      _B('shed', 22, 178),

      // === 下段 東: 古民家 + 温室 (多様化) ===
      _B('kominka', 108, 132),                                  // 古民家 (別区画)
      _B('kimono_shop', 138, 138),                              // ★ 呉服屋
      _B('machiya', 168, 132),                                  // ★ 町家
      _B('greenhouse', 125, 178),
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
      _B('greenhouse', -109, 40),                               // 農業用温室
      _B('kura', -175, 78),
      _B('greenhouse', -135, 78),                               // 2 棟目温室

      // === 上段 中: 集落の外れ + 小祠 ===
      _B('shrine', -25, 55),                                    // ★ 最後の小祠
      _B('dojo', -62, 42),                                      // ★ 道場
      _B('kominka', 25, 42),                                    // 古民家 (唯一)
      _B('wagashi', 62, 44),                                    // ★ 和菓子
      _B('shed', -15, 78),
      _B('shed', 18, 78),

      // === 上段 東: 集落の境界 (多彩化) ===
      _B('kominka', 108, 42),                                   // 古民家 (別区画 1)
      _B('kura', 138, 40),                                      // 蔵 (唯一)
      _B('sushi_ya', 170, 44),                                  // ★ 寿司屋
      _B('shed', 130, 78),
      _B('machiya', 165, 75),                                   // ★ 町家 (奥)

      // === 下段 西: 畑地 ===
      _B('kominka', -162, 132),                                 // 古民家 (別区画)
      _B('greenhouse', -132, 138),
      _B('kimono_shop', -109, 132),                             // ★ 呉服屋
      _B('shed', -178, 175),
      _B('greenhouse', -138, 178),

      // === 下段 中: 終盤の広場 ===
      _B('chaya', -38, 132),                                    // 茶屋 (唯一)
      _B('bookstore', 38, 132),                                 // 古書店 (別業種で最後を飾る)
      _B('shed', -16, 178),

      // === 下段 東: 港への道の気配 (多彩化) ===
      _B('kura', 108, 132),                                     // 蔵 (別区画)
      _B('dojo', 138, 138),                                     // ★ 道場
      _B('machiya', 168, 132),                                  // ★ 町家
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

// ─── Stage 4: 工業港湾・インフラ地帯 (raw 配置) ────────────
// 【全体の物語】: 都市の裏側を見せる。倉庫、工場、コンテナ、消防、警察、ガソリン、
//   貨物線、港湾端で広い作業場のジオラマを作る。建物密度ではなく、ヤード・フェンス・
//   水たまり・作業導線が品質。後半で stone_pavement / pine_tree / stone_lantern を
//   少量混ぜ、Stage 5 (城下町) へ接続する。
// 【連続軸】:
//   asphalt / concrete の広い作業面
//   cargo_container / pallet_stack / forklift
//   traffic_cone / barrier / guardrail_short
//   power_pole / power_line / cable_junction_box
// 【密度目安】: 建物 14-24 / 家具 60-100 / 人 6-16 (大型施設とヤード。余白も意味)
const STAGE_4_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 漁港 (C0-C2) ═══════════════════════════════════════════
  // コンセプト: Stage 3 の蔵から続く海風の中、小さな漁港が始まる。
  // 上段に「海と桟橋」、下段に「魚市場と倉庫」の二段構成で港の暮らしを描く。

  // ── C0: 朝の漁港 (★★ Stage 3 → Stage 4 handoff: 古い港神社・桟橋・浮標) ──
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 海岸線沿いの古い港 (奥に置いて海を広く見せる) ===
      _B('shrine', -150, 70),                                   // ★ 港神社 (Stage 3 余韻)
      _B('shed', -110, 75),
      _B('kura', -73, 70),                                      // ★ 蔵 (Stage 3 handoff)
      _B('shed', -50, 78),
      _B('garage', 30, 75),                                     // 漁協の物置
      _B('shed', 60, 78),
      _B('warehouse', 130, 70),                                 // ★ 港の冷蔵倉庫 (大)
      _B('shed', 175, 78),
      // === 下段: 漁師町の家並び + 魚市場 ===
      _B('kominka', -160, 132), _B('house', -130, 135),
      _B('shed', -104, 175),
      _B('chaya', -50, 132),                                    // 港の茶屋 (漁師の朝食)
      _B('ramen', -18, 135),                                    // 早朝ラーメン
      _B('shed', -45, 175),
      _B('warehouse', 50, 138),                                 // 魚市場の倉庫
      _B('shed', 76, 178),
      _B('garage', 130, 138),
      _B('kominka', 165, 132), _B('shed', 175, 178),
    ],
    furniture: [
      // ─── ★★ C0 固有: 港神社 (Stage 3 torii の余韻、港版) ★★ ───
      _F('torii', -150, 50),
      _F('koma_inu', -163, 88), _F('koma_inu', -137, 88),
      _F('offering_box', -150, 88),
      _F('shinto_rope', -150, 56), _F('stone_lantern', -150, 30),
      // ─── ★★ 海岸線: 桟橋 + 浮標群 (Act I シグネチャ) ★★ ───
      _F('buoy', -25, 12), _F('buoy', 5, 18), _F('buoy', 35, 14),
      _F('buoy', 90, 16), _F('buoy', 115, 10),
      _F('rock', -20, 28), _F('rock', 50, 32), _F('rock', 105, 28),
      _F('cargo_container', 75, 30),                            // 桟橋の小型コンテナ
      _F('drum_can', 22, 38), _F('drum_can', 48, 36),
      _F('pallet_stack', -10, 42),
      // ─── 港神社まわり ───
      _F('bamboo_cluster', -125, 48),
      _F('rock', -135, 60), _F('rock', -165, 60),
      _F('potted_plant', -110, 55),
      // ─── 蔵まわり (Stage 3 handoff) ───
      _F('wood_fence', -65, 50), _F('bonsai', -78, 52),
      _F('sakura_tree', -55, 58),                               // 最後の桜
      // ─── 冷蔵倉庫まわり ───
      _F('sign_board', 105, 52),
      _F('forklift', 100, 78), _F('forklift', 158, 78),
      _F('pallet_stack', 90, 82), _F('pallet_stack', 165, 82),
      _F('drum_can', 170, 75),
      _F('cargo_container', 145, 85),
      // ─── 下段ファサード ───
      _F('mailbox', -160, 118), _F('potted_plant', -130, 122),
      _F('noren', -50, 128), _F('chouchin', -50, 122),
      _F('noren', -15, 128), _F('chouchin', -15, 122),
      _F('mailbox', 165, 118), _F('potted_plant', 130, 122),
      _F('sign_board', 50, 118),
      // ─── 下段: 魚干し場 (タープを魚網に見立て) + 漁具 ───
      _F('tarp', -130, 165), _F('tarp', -85, 168),
      _F('buoy', -118, 178), _F('buoy', -75, 175),
      _F('rock', -90, 195),
      _F('drum_can', -105, 168), _F('drum_can', -68, 165),
      _F('pallet_stack', 85, 168), _F('pallet_stack', 110, 175),
      _F('drum_can', 70, 175), _F('drum_can', 115, 168),
      _F('cargo_container', 95, 158),
      _F('forklift', 130, 168),
      _F('cat', -120, 195),
      // ─── 軸: guardrail (海岸線の柵) ───
      _F('guardrail_short', -30, 50), _F('guardrail_short', 30, 50),
      _F('guardrail_short', 90, 50),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (avenue) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -60, 100), _F('bollard', 60, 100),
    ],
    humans: [
      _H(-150, 88),                                             // 港神社の参拝者
      _H(0, 28),                                                // 桟橋で浮標点検
      _H(105, 80),                                              // 倉庫前作業員
      _H(-50, 152),                                             // 港の茶屋客
      _H(-100, 175),                                            // 魚干し作業
      _H(95, 168),                                              // 魚市場裏
      _H(155, 152),                                             // 漁師の家
    ],
    grounds: [
      _G('harbor_water', 0, 30, 360, 60),                       // ★★ 海面
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('stone_pavement', -150, 80, 32, 36),                   // 神社参道
      _G('moss', -150, 90, 24, 16),
      _G('dirt', -78, 65, 26, 22),                              // 蔵まわり
      _G('rust_deck', -10, 38, 120, 28),                        // ★ 桟橋本体
      _G('rust_deck', 95, 38, 70, 28),                          // ★ 第二桟橋
      _G('wood_deck', 60, 32, 30, 18),                          // 木の桟橋
      _G('steel_plate', 130, 78, 80, 30),
      _G('tile', -50, 152, 32, 38),
      _G('tile', -15, 152, 24, 38),
      _G('gravel', -100, 178, 80, 38),
      _G('steel_plate', 95, 168, 60, 50),
      _G('oil_stained_concrete', 130, 168, 60, 50),
      _G('dirt', -160, 152, 28, 36), _G('dirt', 165, 152, 28, 36),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C1: 魚市場通り — 冷蔵倉庫が並び、フォークリフトと搬入トラックが行き交う ──
  // 上段: 桟橋から海はさらに広く、巡視艇のような小型コンテナと浮標
  // 下段: 魚市場の倉庫帯、軒先のドラム缶、セリの旗、漁師の作業場
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 海から続く岸壁 + 倉庫の入口 ===
      _B('warehouse', -130, 70),                                // 第一冷蔵倉庫
      _B('shed', -76, 78),
      _B('garage', -55, 75),                                    // 漁協事務所
      _B('warehouse', 36, 70),                                  // 第二冷蔵倉庫
      _B('shed', 70, 78),
      _B('kura', 110, 72),                                      // 古い氷蔵
      _B('shed', 145, 78),
      _B('garage', 175, 75),
      // === 下段: 市場通り (セリ場 + 茶屋 + 漁師の家) ===
      _B('warehouse', -135, 138),                               // ★ セリ場 (市場本館)
      _B('shed', -104, 178),
      _B('chaya', -45, 132),                                    // 市場の茶屋
      _B('ramen', -18, 135),                                    // 漁師ラーメン
      _B('sushi_ya', 18, 132),                                  // ★ 港寿司
      _B('shed', -16, 178),
      _B('warehouse', 56, 138),                                 // 物流倉庫
      _B('shed', 135, 178),
      _B('garage', 170, 138),
    ],
    furniture: [
      // ─── 上段: 海面に浮かぶ浮標 + コンテナ ───
      _F('buoy', -160, 14), _F('buoy', -135, 22), _F('buoy', -100, 18),
      _F('buoy', 0, 16), _F('buoy', 35, 12), _F('buoy', 70, 22),
      _F('cargo_container', -65, 32),                           // 桟橋に置かれた赤コンテナ
      _F('cargo_container', 55, 30),                            // 青コンテナ
      _F('rock', -30, 32), _F('rock', 100, 30),
      _F('drum_can', -45, 42), _F('drum_can', 80, 38),
      _F('pallet_stack', 5, 42),
      // ─── 上段: 倉庫前の作業帯 ───
      _F('forklift', -125, 56), _F('forklift', 35, 56),
      _F('pallet_stack', -160, 60), _F('pallet_stack', -90, 60),
      _F('pallet_stack', 70, 60), _F('pallet_stack', 145, 60),
      _F('drum_can', -55, 60), _F('drum_can', -35, 62),
      _F('drum_can', 110, 62), _F('drum_can', 175, 62),
      _F('cargo_container', -100, 80),                          // 倉庫裏の青コンテナ
      _F('cargo_container', 120, 80),
      _F('sign_board', -130, 52), _F('sign_board', 30, 52),     // 「冷蔵」看板
      _F('flag_pole', -55, 52),                                 // 漁協の旗
      // ─── 下段: 市場通りファサード ───
      _F('sign_board', -135, 118), _F('flag_pole', -160, 118),  // セリ場ののぼり
      _F('a_frame_sign', -90, 118),
      _F('noren', -45, 128), _F('chouchin', -45, 122),          // 市場茶屋
      _F('noren', -15, 128), _F('chouchin', -15, 122),          // 漁師ラーメン
      _F('noren', 18, 128), _F('chouchin', 18, 122),            // 港寿司
      _F('sign_board', 90, 118), _F('a_frame_sign', 135, 118),
      // ─── 下段: 市場裏の漁具 + 作業場 ───
      _F('tarp', -110, 165),                                    // 大きな魚網
      _F('tarp', -75, 172),
      _F('drum_can', -125, 168), _F('drum_can', -160, 175),
      _F('pallet_stack', -90, 168), _F('pallet_stack', 85, 168),
      _F('cargo_container', -65, 158),                          // セリ場裏の黄コンテナ
      _F('cargo_container', 110, 158),                          // 物流倉庫裏の緑コンテナ
      _F('forklift', -95, 168), _F('forklift', 130, 168),
      _F('drum_can', 70, 165), _F('drum_can', 150, 168),
      _F('buoy', 175, 178),
      _F('cat', -35, 195),                                      // 市場の野良猫
      // ─── 軸: guardrail + 鉄柵 ───
      _F('guardrail_short', -30, 50), _F('guardrail_short', 30, 50),
      _F('guardrail_short', 90, 50),
      _F('guardrail_short', -120, 100), _F('guardrail_short', 120, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
      _F('bollard', -30, 100), _F('bollard', 30, 100),
      _F('puddle_reflection', 0, 100),                          // 港の水たまり
    ],
    humans: [
      _H(-65, 32),                                              // 桟橋でセリ準備
      _H(-130, 80),                                             // 倉庫前作業員
      _H(35, 80),                                               // フォークリフト操縦
      _H(-135, 152),                                            // セリ場の競り人
      _H(-45, 152), _H(18, 152),                                // 茶屋客 + 寿司客
      _H(95, 168),                                              // 物流倉庫
      _H(-95, 175),                                             // 漁網作業
    ],
    grounds: [
      _G('harbor_water', 0, 30, 360, 60),                       // 海面 (続く)
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('rust_deck', -130, 38, 90, 30),                        // 第一桟橋
      _G('rust_deck', 25, 38, 90, 30),                          // 第二桟橋
      _G('wood_deck', -65, 32, 22, 18),                         // 古い木の桟橋
      _G('steel_plate', -130, 78, 70, 30),
      _G('steel_plate', 30, 78, 70, 30),
      _G('hazard_stripe', -55, 60, 22, 18),                     // ★ 漁協前 警告線
      _G('tile', -45, 152, 28, 38),
      _G('tile', -15, 152, 24, 38),
      _G('tile', 18, 152, 28, 38),
      _G('steel_plate', -135, 168, 70, 50),                     // セリ場前
      _G('steel_plate', 90, 168, 60, 50),                       // 物流倉庫前
      _G('hazard_stripe', -160, 168, 18, 18),                   // セリ場前 警告線
      _G('hazard_stripe', 150, 168, 18, 18),
      _G('gravel', -75, 178, 30, 30),                           // 漁具置き場の砂利
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C2: 造船所 — 漁港の終端、海の上には組み立て中の船と巨大ブロック ──
  // ★ Act I → Act II の橋渡し: 海の比率が減り、はじめてクレーン (silo で代用) が登場
  // 上段: 海と造船ドック (大型コンテナと crane の予兆 silo)
  // 下段: 造船工 + ガス溶接小屋 + 部品倉庫
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 造船ドック + 部品ヤード ===
      _B('silo', -150, 50),                                     // ★ 造船所の最初のサイロ (ガス)
      _B('warehouse', -100, 70),                                // 部品倉庫 (大)
      _B('shed', -50, 78),
      _B('container_stack', -26, 60),                           // ★ 初めてのコンテナ山
      _B('shed', 30, 78),
      _B('warehouse', 80, 70),                                  // 組み立て倉庫
      _B('silo', 130, 50),                                      // ★ 第二サイロ
      _B('shed', 168, 78),
      // === 下段: 造船工の小屋 + ガス溶接 + 工員寮 ===
      _B('garage', -160, 138),                                  // 部品ガレージ
      _B('shed', -135, 178),
      _B('warehouse', -124, 138),                                // 修理倉庫
      _B('shed', -50, 178),
      _B('factory_stack', -31, 139),                              // ★ 初めての factory (船舶エンジン工場、煙突つき)
      _B('garage', 60, 138),                                    // ガス溶接ガレージ
      _B('shed', 76, 178),
      _B('warehouse', 135, 138),                                // 工員寮兼倉庫
      _B('shed', 175, 178),
    ],
    furniture: [
      // ─── 上段: 造船ドック (海上に浮かぶ船体ブロック) ───
      _F('cargo_container', -55, 30),                           // 船体ブロック見立て (赤)
      _F('cargo_container', 35, 32),                            // (青)
      _F('cargo_container', 100, 28),                           // (緑)
      _F('buoy', -30, 18), _F('buoy', 12, 16), _F('buoy', 70, 22),
      _F('rock', -75, 38),
      _F('drum_can', -130, 32), _F('drum_can', 145, 32),        // ガスドラム
      _F('pallet_stack', -10, 38), _F('pallet_stack', 60, 40),
      // ─── 上段: 倉庫前 ───
      _F('forklift', -100, 56), _F('forklift', 80, 56),
      _F('drum_can', -85, 60), _F('drum_can', -115, 62),
      _F('drum_can', 65, 62), _F('drum_can', 95, 60),
      _F('pallet_stack', -50, 60), _F('pallet_stack', 30, 60),
      _F('cargo_container', -130, 82),                          // サイロ裏のコンテナ
      _F('cargo_container', 168, 82),
      _F('sign_board', -100, 52), _F('sign_board', 80, 52),
      _F('flag_pole', -150, 32),                                // サイロ上部の旗
      // ─── 下段: 工場ファサード (作業の音が聞こえる帯) ───
      _F('sign_board', -160, 118), _F('sign_board', -90, 118),
      _F('sign_board', 0, 118),                                 // 「船舶エンジン工場」看板
      _F('sign_board', 60, 118),
      _F('sign_board', 135, 118),
      _F('a_frame_sign', -130, 118),
      // ─── 下段: 修理倉庫 + 溶接ガレージ周辺 ───
      _F('forklift', -90, 168), _F('forklift', 60, 168),
      _F('drum_can', -110, 165), _F('drum_can', -70, 168),
      _F('drum_can', 35, 168), _F('drum_can', 85, 165),
      _F('pallet_stack', -40, 168), _F('pallet_stack', 110, 168),
      _F('cargo_container', -50, 158),                          // 修理待ちのコンテナ
      _F('cargo_container', 105, 158),
      _F('tarp', -150, 168),                                    // 工員の作業布
      _F('tarp', 165, 168),
      _F('water_tank', 30, 152),                                // 工場の冷却水タンク
      _F('water_tank', 90, 152),
      _F('drum_can', 135, 168), _F('drum_can', 175, 168),
      _F('cat', 175, 195),
      // ─── 軸: guardrail (港側) + hazard 案内 ───
      _F('guardrail_short', -60, 50), _F('guardrail_short', 60, 50),
      _F('guardrail_short', 120, 50),
      _F('guardrail_short', -120, 100), _F('guardrail_short', 120, 100),
      _F('traffic_cone', -30, 100), _F('traffic_cone', 30, 100),
      _F('barrier', 0, 50),                                     // ★ ドック入口の閉鎖バリア
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
      _F('puddle_reflection', -30, 100),
      _F('bollard', 30, 100),
    ],
    humans: [
      _H(-130, 88),                                             // サイロ点検
      _H(-100, 80),                                             // 部品搬入
      _H(80, 80),                                               // 組み立て倉庫前
      _H(-90, 152),                                             // 修理倉庫
      _H(0, 152),                                               // 工場の責任者
      _H(60, 165),                                              // 溶接工
      _H(135, 152),                                             // 工員寮前
    ],
    grounds: [
      _G('harbor_water', 0, 28, 240, 56),                       // ★ 海面 (狭く)
      _G('oil_stained_concrete', -150, 28, 60, 56),             // ドック岸壁
      _G('oil_stained_concrete', 150, 28, 60, 56),
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('rust_deck', -55, 38, 60, 26),                         // 造船桟橋
      _G('rust_deck', 70, 38, 60, 26),
      _G('steel_plate', -100, 78, 70, 30),
      _G('steel_plate', 80, 78, 70, 30),
      _G('hazard_stripe', 0, 50, 30, 22),                       // ★ ドック入口の警告
      _G('hazard_stripe', -150, 78, 22, 18), _G('hazard_stripe', 130, 78, 22, 18),
      _G('steel_plate', -90, 168, 70, 50),                      // 修理倉庫前
      _G('steel_plate', 60, 168, 70, 50),                       // 溶接ガレージ前
      _G('steel_plate', 135, 168, 60, 50),
      _G('hazard_stripe', 0, 152, 30, 18),                      // ★ 工場入口
      _G('hazard_stripe', -50, 168, 18, 18), _G('hazard_stripe', 100, 168, 18, 18),
      _G('concrete', -160, 152, 28, 36),                        // ガレージ前
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 54), _VR(-90, 86, 200), _VR(0, 0, 200, 'avenue'), _VR(90, 0, 54), _VR(90, 86, 200)],
  } },

  // ═══ Act II: コンテナヤード (C3-C5) ════════════════════════════════
  // コンセプト: 海の比率を完全になくし、カラフルなコンテナと巨大クレーンの世界へ。
  // 上段 = 倉庫 + コンテナ、下段 = ヤード + ガントリー。色は赤/青/黄/緑。

  // ── C3: コンテナゲート — ヤード入口、ゲートハウス、警告線、forklift 行進 ──
  // 上段: ゲート + 案内塔 (signal_tower) + 入庫待ちコンテナ
  // 下段: 検査ヤード + ガントリー予兆 (silo + container_stack)
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: ゲートハウス + 入庫倉庫 ===
      _B('garage', -160, 70),                                   // ゲートハウス西
      _B('warehouse', -124, 70),                                // 検査倉庫
      _B('container_stack', -55, 60),                           // ★ 入庫待ちコンテナ
      _B('container_stack', 0, 60),
      _B('container_stack', 50, 60),
      _B('warehouse', 124, 70),                                 // 出荷倉庫
      _B('garage', 160, 70),                                    // ゲートハウス東
      // === 下段: 大型ヤード ===
      _B('container_stack', -140, 132),                         // ★ 大型ヤード (赤)
      _B('container_stack', -90, 132),                          // (青)
      _B('container_stack', -40, 132),                          // (黄)
      _B('container_stack', 30, 132),                           // (緑)
      _B('container_stack', 66, 132),                           // (赤)
      _B('container_stack', 127, 132),                          // (青)
      _B('warehouse', 170, 138),
      _B('shed', -160, 178),
      _B('shed', 60, 178),
    ],
    furniture: [
      // ─── 上段: ゲート構造 (案内塔 + 旗) ───
      _F('signal_tower', -90, 50), _F('signal_tower', 90, 50),  // ★ 案内塔 (左右対の予兆)
      _F('flag_pole', -160, 52), _F('flag_pole', 160, 52),
      _F('sign_board', -160, 52), _F('sign_board', 160, 52),    // 「Container Gate」
      _F('barrier', -90, 100), _F('barrier', 90, 100),          // ゲートバー
      _F('barrier', 0, 50),                                     // 検査停止バリア
      _F('traffic_cone', -120, 100), _F('traffic_cone', -60, 100),
      _F('traffic_cone', 60, 100), _F('traffic_cone', 120, 100),
      // ─── 上段: 入庫コンテナ周辺 ───
      _F('forklift', -75, 78), _F('forklift', 25, 78), _F('forklift', 75, 78),
      _F('drum_can', -30, 80), _F('drum_can', 30, 80),
      _F('pallet_stack', -55, 82), _F('pallet_stack', 50, 82),
      _F('cargo_container', -130, 82),                          // 倉庫脇の追加コンテナ
      _F('cargo_container', 130, 82),
      _F('sign_board', -110, 52), _F('sign_board', 110, 52),
      // ─── 下段: ヤードファサード + 旗 ───
      _F('flag_pole', -170, 118), _F('flag_pole', 170, 118),
      _F('sign_board', -140, 118), _F('sign_board', -90, 118),
      _F('sign_board', -40, 118), _F('sign_board', 30, 118),
      _F('sign_board', 80, 118), _F('sign_board', 130, 118),
      // ─── 下段: ヤード内 forklift 行進 + 補助 ───
      _F('forklift', -115, 168), _F('forklift', -65, 168),
      _F('forklift', -15, 168), _F('forklift', 55, 168),
      _F('forklift', 105, 168), _F('forklift', 155, 168),
      _F('drum_can', -135, 178), _F('drum_can', -85, 178),
      _F('drum_can', -35, 178), _F('drum_can', 35, 178),
      _F('drum_can', 85, 178), _F('drum_can', 135, 178),
      _F('pallet_stack', -115, 195), _F('pallet_stack', 25, 195),
      _F('pallet_stack', 110, 195),
      _F('cargo_container', -160, 158),                         // ヤード奥のコンテナ
      _F('cargo_container', 0, 158),                            // 中央のコンテナ
      _F('cargo_container', 170, 158),
      // ─── 軸: guardrail ───
      _F('guardrail_short', -150, 50), _F('guardrail_short', 150, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (ゲート前) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -60, 100), _F('bollard', 60, 100),
    ],
    humans: [
      _H(-160, 80),                                             // ゲートハウス守衛
      _H(160, 80),                                              // ゲートハウス守衛
      _H(0, 100),                                               // 検査員
      _H(-65, 165), _H(55, 165),                                // フォークリフト操縦
      _H(-115, 175), _H(105, 175),                              // 荷役作業
    ],
    grounds: [
      _G('steel_plate', 0, 46.5, 360, 93),                      // ★ Act II 全面が steel
      _G('steel_plate', 0, 153.5, 360, 93),
      _G('hazard_stripe', 0, 50, 60, 22),                       // ★★ ゲート入口の大警告
      _G('hazard_stripe', -90, 100, 22, 22),                    // ★ ゲートバー左
      _G('hazard_stripe', 90, 100, 22, 22),                     // ★ ゲートバー右
      _G('hazard_stripe', -160, 100, 18, 18),
      _G('hazard_stripe', 160, 100, 18, 18),
      _G('oil_stained_concrete', -90, 168, 60, 50),             // 西ヤード油汚れ
      _G('oil_stained_concrete', 90, 168, 60, 50),
      _G('hazard_stripe', 0, 168, 30, 18),                      // ★ ヤード中央警告
      _G('concrete', -160, 168, 32, 38),
      _G('concrete', 160, 168, 32, 38),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 115), _VR(-90, 149, 200), _VR(0, 0, 43, 'avenue'), _VR(0, 77, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ── C4: ガントリークレーン見本市 ★★ Stage 4 ランドマーク ★★ ──
  // 上段: 巨大な crane_gantry 2 本が空にそびえる (h=78、最も高い建物)
  // 下段: クレーン下のヤード、コンテナ運搬中
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: ガントリー 2 本 + サポート倉庫 ===
      _B('crane_gantry', -130, 30),                             // ★★ 西ガントリー (主)
      _B('crane_gantry', 130, 30),                              // ★★ 東ガントリー (主)
      _B('container_stack', -65, 60),                           // クレーン下のスタック
      _B('container_stack', -26, 60),
      _B('container_stack', 25, 60),
      _B('container_stack', 70, 60),
      _B('shed', -104, 78), _B('shed', 104, 78),
      // === 下段: 大ヤード ===
      _B('container_stack', -150, 132),
      _B('container_stack', -100, 132),
      _B('container_stack', -47, 132),
      _B('container_stack', 0, 132),
      _B('container_stack', 50, 132),
      _B('container_stack', 114, 132),
      _B('container_stack', 150, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── 上段: クレーン下の作業帯 ───
      _F('cargo_container', -130, 80),                          // クレーンが吊る予定のコンテナ群
      _F('cargo_container', 130, 80),
      _F('drum_can', -160, 78), _F('drum_can', 160, 78),
      _F('forklift', -100, 82), _F('forklift', 100, 82),
      _F('pallet_stack', -45, 82), _F('pallet_stack', 45, 82),
      _F('pallet_stack', 0, 82),
      _F('cargo_container', -45, 30),                           // 既に積んだコンテナ (赤)
      _F('cargo_container', 0, 32),                             // (青)
      _F('cargo_container', 50, 30),                            // (緑)
      _F('flag_pole', -130, 12), _F('flag_pole', 130, 12),      // クレーン頂上の旗
      _F('signal_tower', -90, 50), _F('signal_tower', 90, 50),
      // ─── 下段: ヤード ───
      _F('forklift', -125, 168), _F('forklift', -75, 168),
      _F('forklift', -25, 168), _F('forklift', 25, 168),
      _F('forklift', 75, 168), _F('forklift', 125, 168),
      _F('drum_can', -160, 158), _F('drum_can', -110, 158),
      _F('drum_can', -60, 158), _F('drum_can', 0, 158),
      _F('drum_can', 60, 158), _F('drum_can', 110, 158),
      _F('drum_can', 160, 158),
      _F('pallet_stack', -150, 195), _F('pallet_stack', -50, 195),
      _F('pallet_stack', 50, 195), _F('pallet_stack', 150, 195),
      _F('cargo_container', -120, 178),                         // 山の追加 (色違い)
      _F('cargo_container', 120, 178),
      _F('barrier', 0, 178),                                    // ヤードの仕切り
      _F('cat', -180, 195),
      // ─── 軸: guardrail + 安全帯 ───
      _F('guardrail_short', -90, 50), _F('guardrail_short', 90, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('traffic_cone', -90, 100), _F('traffic_cone', 90, 100),
      _F('traffic_cone', -30, 100), _F('traffic_cone', 30, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -60, 100), _F('street_lamp', 60, 100),
      _F('manhole_cover', 0, 100),
      _F('puddle_reflection', -45, 100),
    ],
    humans: [
      _H(-130, 80),                                             // クレーン操縦士 (西)
      _H(130, 80),                                              // クレーン操縦士 (東)
      _H(-90, 100),                                             // 安全監視員
      _H(0, 82),                                                // ホイスト誘導員
      _H(-75, 168), _H(75, 168),                                // フォークリフト
      _H(-150, 175), _H(150, 175),                              // ヤード作業
    ],
    grounds: [
      _G('steel_plate', 0, 46.5, 360, 93),
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('hazard_stripe', -130, 60, 30, 28),                    // ★ 西クレーン基礎の警告
      _G('hazard_stripe', 130, 60, 30, 28),                     // ★ 東クレーン基礎の警告
      _G('hazard_stripe', 0, 100, 90, 22),                      // ★★ クレーン下の通行警告 (大)
      _G('hazard_stripe', 0, 168, 30, 18),
      _G('hazard_stripe', -150, 168, 18, 18),
      _G('hazard_stripe', 150, 168, 18, 18),
      _G('rust_deck', -65, 78, 100, 22),                        // クレーン下の鉄板
      _G('rust_deck', 0, 178, 360, 18),                         // ヤード奥の鉄板帯
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 115), _VR(-90, 154, 200), _VR(0, 0, 115, 'avenue'), _VR(0, 149, 200, 'avenue'), _VR(90, 0, 43), _VR(90, 77, 200)],
  } },

  // ── C5: コンテナ山頂点 — 巨大な貨物車両ヤードと高く積まれたコンテナの森 ──
  // 上段: 大型コンテナ列 + 線路 (railway_track) で港湾鉄道を表現
  // 下段: コンテナの最終スタック地点 + 工場予兆 (silo + drum) — Act III へのブリッジ
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 鉄道引き込み線 + コンテナ列 ===
      _B('container_stack', -160, 60),
      _B('container_stack', -115, 60),
      _B('container_stack', -66, 60),
      _B('container_stack', -25, 60),
      _B('container_stack', 25, 60),
      _B('container_stack', 66, 60),
      _B('container_stack', 115, 60),
      _B('container_stack', 160, 60),
      // === 下段: 第二段スタック + Act III 予兆 ===
      _B('container_stack', -150, 132),
      _B('container_stack', -114, 132),
      _B('silo', -50, 132),                                     // ★ Act III 予兆 (1 本目)
      _B('container_stack', 0, 132),
      _B('container_stack', 50, 132),
      _B('silo', 108, 132),                                     // ★ Act III 予兆 (2 本目)
      _B('container_stack', 150, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
      _B('warehouse', -36, 175),                                  // 巨大倉庫の頭 (奥)
    ],
    furniture: [
      // ─── 上段: 鉄道 (港湾線路) — Stage 4 ★ シグネチャ ───
      _F('railway_track', -145, 90),                            // ★ 線路セグメント (左)
      _F('railway_track', -95, 90),
      _F('railway_track', -45, 90),
      _F('railway_track', 5, 90),
      _F('railway_track', 55, 90),
      _F('railway_track', 105, 90),
      _F('railway_track', 155, 90),
      _F('signal_tower', -160, 50), _F('signal_tower', 160, 50),
      _F('flag_pole', -160, 80), _F('flag_pole', 160, 80),
      // ─── 上段: 山の追加コンテナ + ドラム ───
      _F('cargo_container', -135, 30),                          // 上に乗ったコンテナ (赤)
      _F('cargo_container', -90, 32),                           // (青)
      _F('cargo_container', -45, 30),                           // (黄)
      _F('cargo_container', 0, 32),                             // (緑)
      _F('cargo_container', 45, 30),                            // (赤)
      _F('cargo_container', 90, 32),                            // (青)
      _F('cargo_container', 135, 30),                           // (黄)
      _F('drum_can', -160, 80), _F('drum_can', 160, 80),
      _F('forklift', -120, 82), _F('forklift', 120, 82),
      _F('pallet_stack', 0, 78),
      // ─── 下段: 第二段スタック ───
      _F('cargo_container', -150, 158),
      _F('cargo_container', -100, 158),
      _F('cargo_container', 0, 158),
      _F('cargo_container', 50, 158),
      _F('cargo_container', 150, 158),
      _F('drum_can', -75, 165), _F('drum_can', 75, 165),
      _F('drum_can', -50, 178), _F('drum_can', 100, 178),       // サイロ脇のドラム
      _F('forklift', -125, 168), _F('forklift', 125, 168),
      _F('forklift', -25, 168), _F('forklift', 25, 168),
      _F('pallet_stack', -180, 195), _F('pallet_stack', 180, 195),
      _F('barrier', -90, 178), _F('barrier', 90, 178),
      _F('cat', 0, 195),
      // ─── 軸: guardrail + ハザード ───
      _F('guardrail_short', -90, 50), _F('guardrail_short', 90, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('traffic_cone', -45, 100), _F('traffic_cone', 45, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 中央通り (鉄道横断) ───
      _F('street_lamp', -60, 100), _F('street_lamp', 60, 100),
      _F('manhole_cover', -25, 100), _F('manhole_cover', 25, 100),
    ],
    humans: [
      _H(-150, 80), _H(150, 80),                                // 線路点検
      _H(-50, 100),                                             // 鉄道交差員
      _H(-100, 165), _H(100, 165),                              // ヤード作業
      _H(0, 175),                                               // 中央倉庫
    ],
    grounds: [
      _G('steel_plate', 0, 46.5, 360, 93),
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('rust_deck', 0, 90, 360, 18),                          // ★ 鉄道沿いの錆鉄
      _G('hazard_stripe', -150, 60, 22, 22),
      _G('hazard_stripe', 150, 60, 22, 22),
      _G('hazard_stripe', 0, 60, 22, 22),
      _G('hazard_stripe', -50, 132, 22, 18),                    // 西サイロ警告
      _G('hazard_stripe', 100, 132, 22, 18),                    // 東サイロ警告
      _G('hazard_stripe', -150, 168, 18, 18), _G('hazard_stripe', 150, 168, 18, 18),
      _G('hazard_stripe', 0, 168, 22, 18),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 115, 'avenue'), _VR(0, 149, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ═══ Act III: 重工業地帯 (C6-C8) ═══════════════════════════════════
  // コンセプト: コンテナの世界から、煙突 + サイロ + パイプの森林へ。
  // 上段 = 巨大工場とサイロ群、下段 = 補助設備とドラム缶、人は最も少なく機械的。

  // ── C6: 製鉄所 — 巨大な煙突 + サイロ群、鉄屑 + 溶鉱炉の重工業 ──
  // 上段: factory_stack 2 本 (中心、煙突つき) + silo
  // 下段: 鉄屑置き場 + 補助倉庫 + 倉庫間のドラム缶
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 製鉄所 (巨大煙突) ===
      _B('factory_stack', -130, 38),                            // ★★ 西製鉄所 (h=62)
      _B('silo', -72, 50),                                      // 高炉サイロ
      _B('warehouse', -36, 70),                                 // 鉄屑倉庫
      _B('silo', 25, 50),
      _B('silo', 60, 50),                                       // 連続サイロ
      _B('factory_stack', 130, 38),                             // ★★ 東製鉄所
      _B('shed', 175, 78),
      // === 下段: 鉄屑置き場 + 補助 ===
      _B('warehouse', -150, 138),                               // 鉄鉱石倉庫
      _B('container_stack', -100, 132),                         // 鉄屑コンテナ
      _B('garage', -55, 138),                                   // 機械整備
      _B('factory_stack', 0, 132),                              // ★ 中央炉 (中)
      _B('garage', 55, 138),
      _B('container_stack', 100, 132),
      _B('warehouse', 150, 138),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── 上段: 製鉄所の付属設備 ───
      _F('water_tank', -160, 60),                               // 冷却水タンク
      _F('water_tank', 160, 60),
      _F('drum_can', -100, 78), _F('drum_can', -50, 78),
      _F('drum_can', 50, 78), _F('drum_can', 100, 78),
      _F('pallet_stack', -75, 82), _F('pallet_stack', 75, 82),
      _F('cargo_container', -160, 82),                          // 鉄屑搬入コンテナ
      _F('cargo_container', 160, 82),
      _F('forklift', -55, 82), _F('forklift', 5, 82),
      _F('flag_pole', -130, 12), _F('flag_pole', 130, 12),      // 工場頂上の旗
      _F('signal_tower', 0, 50),                                // 中央の連絡塔
      // ─── 上段: 鉄屑 (rock + drum で見立て) ───
      _F('rock', -160, 32), _F('rock', -100, 30),
      _F('rock', 100, 32), _F('rock', 160, 30),
      _F('drum_can', -130, 12), _F('drum_can', 130, 12),
      // ─── 下段: 倉庫ファサード ───
      _F('sign_board', -150, 118), _F('sign_board', -55, 118),
      _F('sign_board', 0, 118), _F('sign_board', 55, 118),
      _F('sign_board', 150, 118),
      _F('flag_pole', -180, 118), _F('flag_pole', 180, 118),
      // ─── 下段: 鉄屑置き場 + 機械 ───
      _F('forklift', -130, 168), _F('forklift', -75, 168),
      _F('forklift', 75, 168), _F('forklift', 130, 168),
      _F('drum_can', -160, 178), _F('drum_can', -110, 178),
      _F('drum_can', -65, 178), _F('drum_can', -25, 178),
      _F('drum_can', 25, 178), _F('drum_can', 65, 178),
      _F('drum_can', 110, 178), _F('drum_can', 160, 178),
      _F('pallet_stack', -90, 195), _F('pallet_stack', -25, 195),
      _F('pallet_stack', 25, 195), _F('pallet_stack', 90, 195),
      _F('cargo_container', -50, 158),
      _F('cargo_container', 50, 158),
      _F('rock', 0, 195), _F('rock', -180, 192),                // 鉄屑見立て
      _F('water_tank', -180, 152), _F('water_tank', 180, 152),
      _F('cat', 0, 100),                                        // 工場猫
      // ─── 軸: guardrail + ハザード ───
      _F('guardrail_short', -90, 50), _F('guardrail_short', 90, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('barrier', 0, 100),                                    // 中央の排煙バリア
      _F('traffic_cone', -45, 100), _F('traffic_cone', 45, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
    ],
    humans: [
      _H(-130, 100),                                            // 西製鉄所守衛
      _H(130, 100),                                             // 東製鉄所守衛
      _H(-25, 80),                                              // 鉄屑倉庫
      _H(0, 100),                                               // 中央連絡員
      _H(-55, 152), _H(55, 152),                                // 機械整備
      _H(-150, 165), _H(150, 165),                              // 鉱石倉庫
    ],
    grounds: [
      _G('oil_stained_concrete', 0, 46.5, 360, 93),             // ★ Act III は油汚れ基調
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('hazard_stripe', -130, 78, 30, 22),                    // 西製鉄所基礎
      _G('hazard_stripe', 130, 78, 30, 22),
      _G('hazard_stripe', 0, 78, 22, 22),                       // 中央サイロ警告
      _G('hazard_stripe', 0, 100, 60, 22),                      // ★ 中央通り排煙警告 (大)
      _G('hazard_stripe', 0, 152, 22, 18),
      _G('hazard_stripe', -150, 168, 18, 18), _G('hazard_stripe', 150, 168, 18, 18),
      _G('rust_deck', -75, 78, 30, 26),                         // サイロ下の錆鉄
      _G('rust_deck', 25, 78, 30, 26),
      _G('rust_deck', 60, 78, 30, 26),
      _G('steel_plate', -150, 168, 60, 50), _G('steel_plate', 150, 168, 60, 50),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, -23), _HR(100, 23, 180)], verticalRoads: [_VR(-90, 0, 115), _VR(-90, 149, 200), _VR(0, 0, 99, 'avenue'), _VR(0, 165, 200, 'avenue'), _VR(90, 0, 115), _VR(90, 149, 200)],
  } },

  // ── C7: 石油タンク群 — サイロが森のように立ち並び、パイプとドラム缶の海 ──
  // 上段: silo の連続 (8 本) — 工業ジオラマの圧巻ポイント
  // 下段: 石油タンクの基礎、パイプ、ドラム缶の山
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: サイロ 8 本連続 (オイルタンク見立て) ===
      _B('silo', -160, 50),
      _B('silo', -125, 50),
      _B('silo', -72, 50),
      _B('silo', -50, 50),
      _B('silo', 50, 50),
      _B('silo', 72, 50),
      _B('silo', 125, 50),
      _B('silo', 160, 50),
      _B('warehouse', 0, 70),                                   // 中央のオペレーション棟
      // === 下段: タンク基礎 + パイプライン ===
      _B('silo', -160, 132),                                    // 第二段サイロ (短)
      _B('silo', -108, 132),
      _B('silo', 108, 132),
      _B('silo', 160, 132),
      _B('warehouse', -50, 138),                                // パイプライン分岐倉庫
      _B('warehouse', 50, 138),
      _B('garage', 0, 138),                                     // 制御室
      _B('shed', -180, 178), _B('shed', 180, 178),
      _B('container_stack', -26, 180),                            // 中央のタンクローリー
    ],
    furniture: [
      // ─── 上段: サイロ間のパイプ + バルブ + ドラム ───
      _F('water_tank', -142, 80),                               // パイプ分岐
      _F('water_tank', -107, 80),
      _F('water_tank', -70, 80),
      _F('water_tank', 70, 80),
      _F('water_tank', 107, 80),
      _F('water_tank', 142, 80),
      _F('drum_can', -160, 80), _F('drum_can', -125, 78),
      _F('drum_can', -90, 80), _F('drum_can', -50, 78),
      _F('drum_can', 50, 80), _F('drum_can', 90, 78),
      _F('drum_can', 125, 80), _F('drum_can', 160, 78),
      _F('flag_pole', -90, 12), _F('flag_pole', 90, 12),
      _F('signal_tower', -30, 50), _F('signal_tower', 30, 50),
      _F('pallet_stack', 0, 82),
      // ─── 下段: タンク群 + パイプライン ───
      _F('water_tank', -130, 100), _F('water_tank', 130, 100), // 中央通り脇の補助
      _F('water_tank', -50, 158), _F('water_tank', 50, 158),
      _F('water_tank', 0, 158),
      _F('drum_can', -160, 168), _F('drum_can', -130, 178),
      _F('drum_can', -100, 168), _F('drum_can', -75, 168),
      _F('drum_can', -25, 178), _F('drum_can', 25, 178),
      _F('drum_can', 75, 168), _F('drum_can', 100, 168),
      _F('drum_can', 130, 178), _F('drum_can', 160, 168),
      _F('pallet_stack', -90, 195), _F('pallet_stack', 90, 195),
      _F('pallet_stack', 0, 195),
      _F('cargo_container', -75, 158),                          // 補給コンテナ
      _F('cargo_container', 75, 158),
      _F('forklift', -55, 168), _F('forklift', 55, 168),
      _F('barrier', -90, 178), _F('barrier', 90, 178),
      _F('cat', 180, 192),
      // ─── 軸: guardrail + ハザード ───
      _F('guardrail_short', -150, 50), _F('guardrail_short', 150, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('barrier', 0, 100),
      _F('traffic_cone', -60, 100), _F('traffic_cone', 60, 100),
      _F('traffic_cone', -30, 100), _F('traffic_cone', 30, 100),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 中央通り (ハザード盛り) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('manhole_cover', -45, 100), _F('manhole_cover', 45, 100),
    ],
    humans: [
      _H(0, 80),                                                // 中央オペレーション
      _H(-160, 88),                                             // 西タンク点検
      _H(160, 88),                                              // 東タンク点検
      _H(0, 152),                                               // 制御室
      _H(-50, 165), _H(50, 165),                                // パイプライン作業
    ],
    grounds: [
      _G('oil_stained_concrete', 0, 46.5, 360, 93),             // ★★ Act III の油まみれ
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('hazard_stripe', -160, 80, 18, 18), _G('hazard_stripe', -125, 80, 18, 18),
      _G('hazard_stripe', -90, 80, 18, 18), _G('hazard_stripe', -50, 80, 18, 18),
      _G('hazard_stripe', 50, 80, 18, 18), _G('hazard_stripe', 90, 80, 18, 18),
      _G('hazard_stripe', 125, 80, 18, 18), _G('hazard_stripe', 160, 80, 18, 18),
      _G('hazard_stripe', 0, 100, 90, 22),                      // ★★ 中央通り全幅警告
      _G('hazard_stripe', -160, 132, 18, 18), _G('hazard_stripe', -100, 132, 18, 18),
      _G('hazard_stripe', 100, 132, 18, 18), _G('hazard_stripe', 160, 132, 18, 18),
      _G('hazard_stripe', 0, 178, 22, 18),
      _G('rust_deck', -75, 158, 30, 26),                        // タンク基礎の錆鉄
      _G('rust_deck', 75, 158, 30, 26),
      _G('rust_deck', 0, 158, 30, 26),
      _G('steel_plate', -130, 168, 60, 50), _G('steel_plate', 130, 168, 60, 50),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 54, 'avenue'), _VR(0, 86, 129, 'avenue'), _VR(0, 147, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ── C8: 発電所 + 化学工場 — 煙突の森、Act III の最終形 ──
  // 上段: factory_stack 3 本連続 (大煙突)、発電所
  // 下段: 化学工場、補助設備、変電所 (electric_box 群)
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 発電所 (大煙突連続) ===
      _B('factory_stack', -130, 38),                            // ★★ 西大煙突
      _B('silo', -72, 50),                                      // 補助
      _B('factory_stack', -31, 38),                               // ★★ 中央大煙突
      _B('silo', 72, 50),
      _B('factory_stack', 130, 38),                             // ★★ 東大煙突
      _B('shed', -180, 78), _B('shed', 180, 78),
      // === 下段: 化学工場 + 変電所 ===
      _B('warehouse', -150, 138),                               // 化学倉庫西
      _B('silo', -108, 132),                                    // 化学反応塔
      _B('container_stack', -50, 132),                          // 化学コンテナ
      _B('warehouse', 0, 138),                                  // 中央倉庫
      _B('container_stack', 50, 132),
      _B('silo', 108, 132),                                     // 化学反応塔
      _B('warehouse', 150, 138),                                // 化学倉庫東
      _B('shed', -180, 178), _B('shed', 180, 178),
      _B('garage', -20, 178),                                     // 出荷ガレージ
    ],
    furniture: [
      // ─── 上段: 発電所付属 ───
      _F('water_tank', -160, 60), _F('water_tank', 160, 60),
      _F('water_tank', -50, 60), _F('water_tank', 50, 60),
      _F('drum_can', -130, 12), _F('drum_can', 0, 12), _F('drum_can', 130, 12),
      _F('drum_can', -100, 78), _F('drum_can', -25, 78),
      _F('drum_can', 25, 78), _F('drum_can', 100, 78),
      _F('pallet_stack', -75, 82), _F('pallet_stack', 75, 82),
      _F('cargo_container', -160, 82),                          // 廃棄物コンテナ
      _F('cargo_container', 160, 82),
      _F('flag_pole', -130, 12), _F('flag_pole', 130, 12),
      _F('signal_tower', -90, 50), _F('signal_tower', 90, 50),
      _F('forklift', -55, 82), _F('forklift', 55, 82),
      // ─── 下段: 変電所と化学工場の機械 ───
      _F('electric_box', -170, 152),                            // ★★ 変電所 (Act III シグネチャ)
      _F('electric_box', -130, 152),
      _F('electric_box', -90, 152),
      _F('electric_box', 90, 152),
      _F('electric_box', 130, 152),
      _F('electric_box', 170, 152),
      _F('cable_junction_box', -55, 100),
      _F('cable_junction_box', 55, 100),
      _F('water_tank', -50, 158), _F('water_tank', 50, 158),
      _F('drum_can', -160, 178), _F('drum_can', -125, 178),
      _F('drum_can', -90, 178), _F('drum_can', -25, 178),
      _F('drum_can', 25, 178), _F('drum_can', 90, 178),
      _F('drum_can', 125, 178), _F('drum_can', 160, 178),
      _F('pallet_stack', -50, 195), _F('pallet_stack', 50, 195),
      _F('cargo_container', -150, 158),                         // 化学倉庫前
      _F('cargo_container', 150, 158),
      _F('forklift', 0, 168),                                   // ガレージ前
      _F('barrier', -90, 178), _F('barrier', 90, 178),
      _F('cat', -180, 195),
      // ─── 軸: guardrail + 巨大ハザード ───
      _F('guardrail_short', -150, 50), _F('guardrail_short', 150, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('barrier', 0, 100),
      _F('traffic_cone', -75, 100), _F('traffic_cone', 75, 100),
      _F('traffic_cone', -45, 100), _F('traffic_cone', 45, 100),
      _F('traffic_cone', -15, 100), _F('traffic_cone', 15, 100),
      // ─── 軸: 電柱 + 電線 (発電所なので密) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      _F('power_pole', -90, 195), _F('power_line', -85, 192),
      _F('power_pole', 90, 195), _F('power_line', 85, 192),
      _F('cable_junction_box', -170, 100), _F('cable_junction_box', 170, 100),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('fire_extinguisher', -30, 100), _F('fire_extinguisher', 30, 100),
      _F('manhole_cover', -60, 100), _F('manhole_cover', 60, 100),
    ],
    humans: [
      _H(-130, 100),                                            // 発電所西
      _H(0, 100),                                               // 中央発電所
      _H(130, 100),                                             // 発電所東
      _H(-150, 152),                                            // 化学倉庫西
      _H(150, 152),                                             // 化学倉庫東
      _H(0, 152),                                               // 中央倉庫
      _H(-100, 165), _H(100, 165),                              // 化学反応塔
    ],
    grounds: [
      _G('oil_stained_concrete', 0, 46.5, 360, 93),
      _G('oil_stained_concrete', 0, 153.5, 360, 93),
      _G('hazard_stripe', -130, 78, 30, 22), _G('hazard_stripe', 130, 78, 30, 22),
      _G('hazard_stripe', 0, 78, 30, 22),
      _G('hazard_stripe', 0, 100, 120, 22),                     // ★★ 全幅警告 (最強)
      _G('hazard_stripe', -50, 132, 22, 18), _G('hazard_stripe', 50, 132, 22, 18),
      _G('hazard_stripe', 0, 178, 22, 18),
      _G('rust_deck', -75, 78, 30, 26), _G('rust_deck', 75, 78, 30, 26),
      _G('rust_deck', -100, 158, 30, 26), _G('rust_deck', 100, 158, 30, 26),
      _G('steel_plate', -150, 168, 60, 50), _G('steel_plate', 150, 168, 60, 50),
      _G('steel_plate', -180, 152, 30, 36), _G('steel_plate', 180, 152, 30, 36),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 122, 'avenue'), _VR(0, 154, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ═══ Act IV: 出荷場 (C9) → Stage 5 (祭り) handoff ═════════════════
  // コンセプト: 工業地帯の終端、トラックターミナル + 巨大倉庫。遠くの祭り (赤提灯 + 風船)
  // が見え隠れし、Stage 5 への期待が高まる。色調が暖かさを取り戻し始める。

  // ── C9: トラックターミナル + 祭りの予兆 ──
  // 上段: 出荷倉庫 + トラック並び + 出荷ゲート
  // 下段: 廃工場の残骸 + 遠くの祭りの予兆 (chouchin + balloon_cluster)
  { patternId: 's4_raw', raw: {
    buildings: [
      // === 上段: 巨大倉庫 + トラック並び ===
      _B('warehouse', -130, 70),                                // 西出荷倉庫
      _B('container_stack', -66, 60),                           // 出荷待ちコンテナ
      _B('warehouse', -10, 70),                                 // 中央倉庫
      _B('container_stack', 50, 60),
      _B('warehouse', 130, 70),                                 // 東出荷倉庫
      _B('shed', -180, 78), _B('shed', 180, 78),
      // === 下段: 廃工場 + 祭り予兆 ===
      _B('factory_stack', -150, 139),                           // 最後の工場 (廃)
      _B('garage', -108, 138),
      _B('warehouse', -50, 138),                                // ガレージ + 待機トラック倉庫
      _B('yatai', -20, 175),                                      // ★★ 祭り予兆: 屋台 (Stage 5 handoff)
      _B('warehouse', 56, 138),
      _B('garage', 110, 138),
      _B('container_stack', 160, 132),
      _B('shed', 35, 178), _B('shed', -37, 178),
    ],
    furniture: [
      // ─── 上段: 出荷ゲート + トラック行列 (car で代用) ───
      _F('car', -160, 80), _F('car', -140, 82),                 // 西列トラック
      _F('car', -110, 78), _F('car', -90, 82),
      _F('car', 90, 78), _F('car', 110, 82),                    // 東列
      _F('car', 140, 80), _F('car', 160, 82),
      _F('forklift', -50, 82), _F('forklift', 30, 82),
      _F('drum_can', -75, 80), _F('drum_can', 50, 80),
      _F('pallet_stack', -10, 82),
      _F('cargo_container', -75, 30),                           // 上段コンテナ (赤)
      _F('cargo_container', 50, 32),                            // (青)
      _F('flag_pole', -160, 32), _F('flag_pole', 160, 32),
      _F('signal_tower', 0, 50),                                // 出荷管理塔
      _F('sign_board', -130, 52), _F('sign_board', 130, 52),
      _F('sign_board', -10, 52),                                // 「出荷ゲート」
      // ─── ★★ 下段: 祭りの予兆 (Stage 5 handoff シグネチャ) ★★ ───
      _F('chouchin', -25, 162),                                 // ★ 遠くの提灯 1
      _F('chouchin', 25, 162),                                  // ★ 遠くの提灯 2
      _F('chouchin', 0, 158),                                   // ★ 中央提灯
      _F('noren', 0, 168),                                      // ★ 屋台ののれん
      _F('balloon_cluster', -55, 170),                          // ★★ 風船 (祭り)
      _F('balloon_cluster', 55, 170),                           // ★★ 風船
      _F('flag_pole', 0, 158),                                  // 屋台の旗
      _F('matsuri_drum', 30, 178),                              // ★★ 太鼓 (Stage 5 シグネチャ)
      // ─── 下段: 廃工場まわり (寂寥感) ───
      _F('drum_can', -160, 168), _F('drum_can', -125, 178),
      _F('drum_can', 125, 178), _F('drum_can', 160, 168),
      _F('rock', -150, 195), _F('rock', 150, 195),              // 廃材
      _F('puddle_reflection', -120, 168),                       // 水たまり (廃工場の寂寥)
      _F('puddle_reflection', 120, 168),
      _F('cat', -100, 178),                                     // 廃工場の猫
      _F('forklift', 110, 168),                                 // 待機フォークリフト
      _F('pallet_stack', -100, 195), _F('pallet_stack', 100, 195),
      _F('cargo_container', -50, 158),                          // 廃倉庫前
      _F('cargo_container', 60, 158),
      _F('tarp', -180, 168),                                    // 廃材を覆うタープ
      _F('tarp', 180, 168),
      // ─── 軸: guardrail + ゲート ───
      _F('guardrail_short', -90, 50), _F('guardrail_short', 90, 50),
      _F('guardrail_short', -150, 100), _F('guardrail_short', 150, 100),
      _F('barrier', -90, 100), _F('barrier', 90, 100),          // 出荷ゲートバー
      _F('traffic_cone', -45, 100), _F('traffic_cone', 45, 100),
      // ─── 軸: 電柱 + 電線 (薄め、Stage 5 へ受け渡し) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (祭りの灯り入る) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -90, 92), _F('chouchin', 90, 92),          // ★ 提灯 (祭りの予感、街灯と並ぶ)
      _F('manhole_cover', -30, 100), _F('manhole_cover', 30, 100),
      _F('bollard', -60, 100), _F('bollard', 60, 100),
    ],
    humans: [
      _H(-130, 80),                                             // 西出荷倉庫
      _H(130, 80),                                              // 東出荷倉庫
      _H(0, 100),                                               // 出荷ゲート守衛
      _H(0, 168),                                               // ★★ 屋台店主 (Stage 5 予兆)
      _H(-25, 178),                                             // 屋台客 1
      _H(25, 178),                                              // 屋台客 2
      _H(-100, 152),                                            // 廃工場の見回り
      _H(110, 165),                                             // 待機トラック運転手
    ],
    grounds: [
      _G('oil_stained_concrete', 0, 46.5, 360, 93),
      _G('oil_stained_concrete', 0, 153.5, 240, 93),            // 廃工場側 (狭く)
      _G('asphalt', -150, 100, 60, 18),                         // ゲート前車道
      _G('asphalt', 150, 100, 60, 18),
      _G('hazard_stripe', -90, 100, 22, 22),                    // ゲートバー左
      _G('hazard_stripe', 90, 100, 22, 22),                     // ゲートバー右
      _G('hazard_stripe', 0, 100, 30, 22),
      _G('hazard_stripe', -150, 78, 18, 18), _G('hazard_stripe', 150, 78, 18, 18),
      // ★★ Stage 5 予兆: 中央下段に祭りの赤絨毯 + チェッカータイル ★★
      _G('red_carpet', 0, 168, 100, 38),                        // ★★ 屋台広場の赤絨毯
      _G('checker_tile', -55, 168, 28, 38),                     // ★ 祭り予兆チェッカー
      _G('checker_tile', 55, 168, 28, 38),                      // ★ 祭り予兆チェッカー
      _G('rust_deck', -150, 158, 40, 26),                       // 廃工場の錆鉄
      _G('steel_plate', -100, 168, 50, 50),
      _G('steel_plate', 110, 168, 50, 50),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 54, 'avenue'), _VR(0, 86, 200, 'avenue'), _VR(90, 0, 200)],
  } },
];

// ─── Stage 5: 城下町・祭礼・最終決戦 (フィナーレ raw 配置) ──
// 【全体の物語】: 工業地帯から旧街道へ入り、和風商店街、温泉、神社、祭、寺社、城門、
//   本丸前広場を経て castle 破壊へ向かう。密度だけでなく、儀式的な中央軸と城の視認性が最重要。
// 【連続軸】:
//   中央参道: stone_pavement / tile
//   灯籠・提灯: stone_lantern / chouchin
//   和風境界: bamboo_fence / wood_fence / shrine_fence_red
//   祭礼: matsuri_drum / ticket_booth / balloon_cluster / yatai
//   後半: castle へ向かう視線を中央に集める
// 【絶対条件】: castle は視認できること。ボールが到達できる通路を家具で塞がないこと。
//   GOAL / clear 判定を壊さないこと。
// 【密度目安】: 建物 16-26 / 家具 75-120 / 人 10-28 (祭礼と最終決戦。城前は視認性優先)
// ※ 現状チャンク内容は旧 "テーマパーク・祭り" 仕様。今後 raw を順次差し替える。
const STAGE_5_TEMPLATES: ChunkTemplate[] = [

  // ═══ Act I: 祭り入場 (C0-C2) ═══════════════════════════════════════
  // コンセプト: Stage 4 の出荷場から、夕暮れの祭り会場に入る。
  // 上段 = アプローチの屋台、下段 = 参道に沿う屋台。赤絨毯の中央通り。

  // ── C0: 入場ゲート (★★ Stage 4 → Stage 5 handoff: 鳥居型ゲート + 大提灯の海) ──
  // 街区: 上段 = 入場ゲート (tahoto を大鳥居見立て) + 最後の工業残滓、下段 = 屋台通り開幕
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 入場ゲート + 最後の工業 + 祭り倉庫 ===
      _B('warehouse', -150, 70),                                // ★ Stage 4 余韻: 出荷倉庫
      _B('shed', -118, 78),
      _B('big_tent', -58, 50),                                  // ★ 入場テント (左)
      _B('yatai', -20, 38),                                     // 入場直後の屋台
      _B('yatai', 20, 38),
      _B('big_tent', 58, 50),                                   // ★ 入場テント (右)
      _B('shed', 118, 78),
      _B('warehouse', 150, 70),                                 // ★ 倉庫 (祭り運営倉庫)
      // === 下段: 屋台通りの開幕 ===
      _B('yatai', -160, 132),                                   // 屋台 西端
      _B('yatai', -128, 132),
      _B('yatai', -108, 132),
      _B('yatai', -62, 132),
      _B('carousel', -29, 140),                                   // ★★ 入場広場の小メリーゴーランド
      _B('yatai', 60, 132),
      _B('yatai', 108, 132),
      _B('yatai', 128, 132),
      _B('yatai', 160, 132),
      _B('shed', -155, 178),                                    // 裏方: 物置
      _B('shed', 155, 178),
    ],
    furniture: [
      // ─── ★★ 入場ゲート: 鳥居型アーチ + 大提灯 ★★ ───
      _F('torii', 0, 28),                                       // ★ 巨大な鳥居ゲート (祭り版)
      _F('chouchin', -30, 18), _F('chouchin', 30, 18),          // ★ 大提灯 2
      _F('chouchin', -15, 18), _F('chouchin', 15, 18),          // ★ 中提灯 2
      _F('banner_pole', -60, 18), _F('banner_pole', 60, 18),
      _F('flag_pole', -120, 14), _F('flag_pole', 120, 14),
      _F('balloon_cluster', -45, 32), _F('balloon_cluster', 45, 32), // ★★ 風船
      _F('balloon_cluster', 0, 8),                              // ゲート上の風船
      _F('ticket_booth', -30, 62),                              // ★ 入場チケット売り場
      _F('ticket_booth', 30, 62),
      // ─── 入場テント付属 ───
      _F('flag_pole', -60, 32), _F('flag_pole', 60, 32),
      _F('a_frame_sign', -90, 62), _F('a_frame_sign', 90, 62),
      _F('popcorn_cart', -45, 72), _F('popcorn_cart', 45, 72),  // ★ ポップコーン
      _F('matsuri_drum', -75, 82),                              // ★★ 入場太鼓
      _F('bench', -55, 80), _F('bench', 55, 80),
      // ─── Stage 4 余韻: 最後の工業残滓 ───
      _F('drum_can', -175, 82),                                 // 出荷倉庫裏
      _F('cargo_container', 168, 82),                           // 最後のコンテナ
      _F('puddle_reflection', -150, 82),
      // ─── 上段ファサード: 屋台看板 ───
      _F('noren', -15, 28), _F('noren', 18, 28),
      _F('chouchin', -15, 22), _F('chouchin', 18, 22),
      // ─── 下段: 屋台通りの提灯行列 + のれん ───
      _F('chouchin', -160, 122), _F('noren', -160, 128),        // 1 つ目
      _F('chouchin', -128, 122), _F('noren', -128, 128),
      _F('chouchin', -95, 122), _F('noren', -95, 128),
      _F('chouchin', -62, 122), _F('noren', -62, 128),
      _F('chouchin', 60, 122), _F('noren', 60, 128),
      _F('chouchin', 92, 122), _F('noren', 92, 128),
      _F('chouchin', 128, 122), _F('noren', 128, 128),
      _F('chouchin', 160, 122), _F('noren', 160, 128),
      // ─── 下段: 中央メリーゴーランド周辺 ───
      _F('flag_pole', 0, 118),
      _F('balloon_cluster', -25, 155),                          // メリーゴーランド脇の風船
      _F('balloon_cluster', 25, 155),
      _F('bench', -30, 168), _F('bench', 30, 168),
      _F('street_lamp', -25, 160), _F('street_lamp', 25, 160),
      // ─── 下段: 屋台の装飾 + 食事小物 ───
      _F('a_frame_sign', -145, 145), _F('a_frame_sign', 145, 145),
      _F('popcorn_cart', -110, 165), _F('popcorn_cart', 110, 165),
      _F('parasol', -78, 155), _F('parasol', 78, 155),
      _F('bench', -175, 172), _F('bench', 175, 172),
      // ─── 屋台裏の演出 ───
      _F('planter', -160, 175), _F('planter', 160, 175),
      _F('flower_bed', -85, 185), _F('flower_bed', 85, 185),
      // ─── 軸: 電柱 + 電線 (祭りの光明) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (赤絨毯に街灯) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),          // ★ 通りの提灯
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
    ],
    humans: [
      _H(-30, 55),                                              // 入場券購入
      _H(30, 55),
      _H(0, 35),                                                // 鳥居をくぐる
      _H(-75, 75), _H(75, 75),                                  // テント客
      _H(-110, 160), _H(110, 160),                              // 屋台客
      _H(-62, 152), _H(60, 152),                                // 屋台客
      _H(0, 155),                                               // メリーゴーランド見物
      _H(-30, 170), _H(30, 170),
      _H(-145, 165), _H(145, 165),                              // 屋台店主
    ],
    grounds: [
      _G('red_carpet', 0, 46.5, 360, 93),                       // ★★ 上段 赤絨毯 (参道)
      _G('red_carpet', 0, 153.5, 360, 93),                      // ★ 下段 赤絨毯
      _G('checker_tile', 0, 55, 60, 38),                        // ゲート前広場
      _G('checker_tile', 0, 145, 60, 36),                       // 中央メリー周辺
      _G('tile', -60, 62, 40, 30),                              // 左テント床
      _G('tile', 60, 62, 40, 30),                               // 右テント床
      _G('stone_pavement', 0, 25, 80, 20),                      // ゲート石畳
      _G('gravel', -120, 82, 40, 22),                           // 裏方砂利
      _G('gravel', 120, 82, 40, 22),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C1: 屋台通り 1 — 小屋台の密集、わたあめ・たこ焼き・金魚すくいの祭り食 ──
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 屋台 + 休憩テント ===
      _B('yatai', -160, 38), _B('yatai', -130, 38),
      _B('yatai', -108, 38), _B('yatai', -60, 38),
      _B('big_tent', 0, 50),                                    // ★ 中央休憩テント (大)
      _B('yatai', 60, 38), _B('yatai', 108, 38),
      _B('yatai', 130, 38), _B('yatai', 160, 38),
      _B('yatai', -155, 78), _B('yatai', 155, 78),              // 奥にも屋台
      // === 下段: 屋台の第二列 + 遊技場 (chaya 代用で和カフェ) ===
      _B('yatai', -160, 132), _B('yatai', -128, 132),
      _B('yatai', -108, 132),
      _B('chaya', -50, 132),                                    // 甘酒茶屋
      _B('yatai', -20, 132),
      _B('yatai', 20, 132),
      _B('chaya', 50, 132),                                     // もう一軒
      _B('yatai', 108, 132), _B('yatai', 128, 132),
      _B('yatai', 160, 132),
      _B('shed', -165, 178), _B('shed', 165, 178),
    ],
    furniture: [
      // ─── 上段: 屋台行列のシグネチャ ───
      _F('chouchin', -160, 22), _F('noren', -160, 28),
      _F('chouchin', -130, 22), _F('noren', -130, 28),
      _F('chouchin', -95, 22), _F('noren', -95, 28),
      _F('chouchin', -60, 22), _F('noren', -60, 28),
      _F('chouchin', 60, 22), _F('noren', 60, 28),
      _F('chouchin', 95, 22), _F('noren', 95, 28),
      _F('chouchin', 130, 22), _F('noren', 130, 28),
      _F('chouchin', 160, 22), _F('noren', 160, 28),
      // ─── 中央テント ───
      _F('flag_pole', 0, 28),
      _F('banner_pole', -30, 28), _F('banner_pole', 30, 28),
      _F('balloon_cluster', -15, 32), _F('balloon_cluster', 15, 32),
      _F('bench', -25, 78), _F('bench', 0, 78), _F('bench', 25, 78),
      _F('popcorn_cart', 0, 68),
      _F('matsuri_drum', -45, 72),
      // ─── 上段: 屋台小物 ───
      _F('a_frame_sign', -145, 52), _F('a_frame_sign', -112, 52),
      _F('a_frame_sign', -78, 52), _F('a_frame_sign', 78, 52),
      _F('a_frame_sign', 112, 52), _F('a_frame_sign', 145, 52),
      _F('parasol', -170, 68), _F('parasol', 170, 68),
      _F('chouchin', -155, 72), _F('chouchin', 155, 72),
      // ─── 下段ファサード: 提灯+のれん連続 ───
      _F('chouchin', -160, 122), _F('noren', -160, 128),
      _F('chouchin', -128, 122), _F('noren', -128, 128),
      _F('chouchin', -95, 122), _F('noren', -95, 128),
      _F('chouchin', -50, 122), _F('noren', -50, 128),
      _F('chouchin', -18, 122), _F('noren', -18, 128),
      _F('chouchin', 18, 122), _F('noren', 18, 128),
      _F('chouchin', 50, 122), _F('noren', 50, 128),
      _F('chouchin', 95, 122), _F('noren', 95, 128),
      _F('chouchin', 128, 122), _F('noren', 128, 128),
      _F('chouchin', 160, 122), _F('noren', 160, 128),
      // ─── 下段: 屋台小物 ───
      _F('a_frame_sign', -145, 145), _F('a_frame_sign', -112, 145),
      _F('a_frame_sign', -78, 145), _F('a_frame_sign', -35, 145),
      _F('a_frame_sign', 35, 145), _F('a_frame_sign', 78, 145),
      _F('a_frame_sign', 112, 145), _F('a_frame_sign', 145, 145),
      _F('popcorn_cart', -145, 168), _F('popcorn_cart', 145, 168),
      _F('popcorn_cart', -35, 168), _F('popcorn_cart', 35, 168),
      _F('parasol', -112, 168), _F('parasol', 112, 168),
      _F('bench', -78, 168), _F('bench', 78, 168),
      _F('balloon_cluster', 0, 165),
      _F('flower_bed', -175, 195), _F('flower_bed', 175, 195),
      _F('flower_bed', -90, 195), _F('flower_bed', 90, 195),
      _F('planter', -140, 195), _F('planter', 140, 195),
      _F('matsuri_drum', 0, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-160, 55), _H(-130, 55), _H(-95, 55), _H(-60, 55),     // 屋台行列 (西)
      _H(60, 55), _H(95, 55), _H(130, 55), _H(160, 55),         // 屋台行列 (東)
      _H(0, 75),                                                // 中央テント客
      _H(-50, 152), _H(-18, 152), _H(18, 152), _H(50, 152),     // 下段屋台
      _H(0, 165),                                               // 中央通り
    ],
    grounds: [
      _G('red_carpet', 0, 46.5, 360, 93),                       // 赤絨毯続く
      _G('red_carpet', 0, 153.5, 360, 93),
      _G('checker_tile', 0, 55, 60, 38),                        // 中央テント広場
      _G('checker_tile', 0, 168, 80, 36),
      _G('tile', -90, 62, 60, 30),                              // 左屋台前タイル
      _G('tile', 90, 62, 60, 30),                               // 右屋台前タイル
      _G('tile', -90, 148, 60, 30),                             // 下段も
      _G('tile', 90, 148, 60, 30),
      _G('gravel', -170, 82, 22, 22),                           // 屋台裏砂利
      _G('gravel', 170, 82, 22, 22),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 30, 'avenue'), _VR(0, 70, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ── C2: 屋台通り 2 + チケットブース + 飾り通り ──
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 屋台 + チケット小屋 (garage で代用) + 装飾 ===
      _B('yatai', -160, 38), _B('yatai', -130, 38),
      _B('garage', -108, 42),                                    // ★ チケットブース (小屋)
      _B('yatai', -50, 38),
      _B('yatai', 50, 38),
      _B('garage', 72, 42),                                     // ★ チケットブース (小屋)
      _B('yatai', 130, 38), _B('yatai', 160, 38),
      _B('big_tent', -34, 70),                                    // ★ 抽選会テント (奥)
      _B('yatai', -155, 78), _B('yatai', 155, 78),
      // === 下段: 屋台 + 休憩スポット ===
      _B('yatai', -160, 132), _B('yatai', -128, 132),
      _B('yatai', -108, 132),
      _B('yatai', -35, 132),
      _B('chaya', 0, 132),                                      // 中央茶屋
      _B('yatai', 35, 132),
      _B('yatai', 108, 132), _B('yatai', 128, 132),
      _B('yatai', 160, 132),
      _B('fountain_pavilion', -24, 178),                          // ★ 祭り中央噴水パビリオン
      _B('shed', -165, 178), _B('shed', 165, 178),
    ],
    furniture: [
      // ─── 上段: 屋台提灯帯 ───
      _F('chouchin', -160, 22), _F('noren', -160, 28),
      _F('chouchin', -130, 22), _F('noren', -130, 28),
      _F('sign_board', -90, 22),                                // ★ 「整理券」看板
      _F('chouchin', -50, 22), _F('noren', -50, 28),
      _F('chouchin', 50, 22), _F('noren', 50, 28),
      _F('sign_board', 90, 22),                                 // ★ 「当日券」看板
      _F('chouchin', 130, 22), _F('noren', 130, 28),
      _F('chouchin', 160, 22), _F('noren', 160, 28),
      // ─── チケットブース前行列小物 ───
      _F('a_frame_sign', -90, 52), _F('a_frame_sign', 90, 52),
      _F('flag_pole', -90, 30), _F('flag_pole', 90, 30),
      _F('banner_pole', -90, 52), _F('banner_pole', 90, 52),
      _F('bollard', -75, 58), _F('bollard', -105, 58),
      _F('bollard', 75, 58), _F('bollard', 105, 58),
      // ─── 中央抽選会テント ───
      _F('balloon_cluster', -15, 55), _F('balloon_cluster', 15, 55),
      _F('matsuri_drum', -30, 85), _F('matsuri_drum', 30, 85),
      _F('flag_pole', 0, 50),
      // ─── 上段 屋台小物 ───
      _F('a_frame_sign', -145, 52), _F('a_frame_sign', -112, 52),
      _F('a_frame_sign', -35, 52), _F('a_frame_sign', 35, 52),
      _F('a_frame_sign', 112, 52), _F('a_frame_sign', 145, 52),
      _F('popcorn_cart', -170, 68), _F('popcorn_cart', 170, 68),
      _F('parasol', -155, 55), _F('parasol', 155, 55),
      // ─── 下段ファサード ───
      _F('chouchin', -160, 122), _F('noren', -160, 128),
      _F('chouchin', -128, 122), _F('noren', -128, 128),
      _F('chouchin', -95, 122), _F('noren', -95, 128),
      _F('chouchin', -35, 122), _F('noren', -35, 128),
      _F('chouchin', 0, 122), _F('noren', 0, 128),              // 中央茶屋
      _F('chouchin', 35, 122), _F('noren', 35, 128),
      _F('chouchin', 95, 122), _F('noren', 95, 128),
      _F('chouchin', 128, 122), _F('noren', 128, 128),
      _F('chouchin', 160, 122), _F('noren', 160, 128),
      // ─── 中央噴水パビリオン周辺 ───
      _F('flag_pole', -20, 175), _F('flag_pole', 20, 175),
      _F('banner_pole', 0, 168),
      _F('balloon_cluster', -30, 185), _F('balloon_cluster', 30, 185),
      _F('bench', -40, 190), _F('bench', 40, 190),
      _F('matsuri_drum', 0, 185),
      _F('chouchin', -50, 172), _F('chouchin', 50, 172),
      _F('flower_bed', -90, 195), _F('flower_bed', 90, 195),
      // ─── 下段屋台小物 ───
      _F('a_frame_sign', -145, 148), _F('a_frame_sign', -112, 148),
      _F('a_frame_sign', -78, 148), _F('a_frame_sign', 78, 148),
      _F('a_frame_sign', 112, 148), _F('a_frame_sign', 145, 148),
      _F('popcorn_cart', -140, 168), _F('popcorn_cart', 140, 168),
      _F('parasol', -108, 155), _F('parasol', 108, 155),
      _F('bench', -78, 168), _F('bench', 78, 168),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-90, 55), _H(-75, 62),                                 // チケット西列
      _H(90, 55), _H(105, 62),                                  // チケット東列
      _H(0, 85),                                                // 抽選会テント
      _H(-35, 152), _H(0, 152), _H(35, 152),                    // 下段屋台客
      _H(-95, 152), _H(95, 152),
      _H(0, 185),                                               // 噴水前
      _H(-40, 190), _H(40, 190),                                // ベンチ
      _H(-160, 55), _H(160, 55),                                // 屋台行列端
    ],
    grounds: [
      _G('red_carpet', 0, 46.5, 360, 93),
      _G('red_carpet', 0, 153.5, 360, 93),
      _G('checker_tile', -90, 55, 40, 38),                      // 西チケット前
      _G('checker_tile', 90, 55, 40, 38),                       // 東チケット前
      _G('checker_tile', 0, 78, 50, 36),                        // 中央テント前
      _G('checker_tile', 0, 178, 80, 40),                       // 噴水パビリオン周辺
      _G('tile', -145, 62, 70, 28),
      _G('tile', 145, 62, 70, 28),
      _G('tile', -110, 148, 60, 30),
      _G('tile', 110, 148, 60, 30),
      _G('gravel', -172, 90, 18, 22),
      _G('gravel', 172, 90, 18, 22),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 120, 'avenue'), _VR(0, 144, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ═══ Act II: 広場エリア (C3-C5) ═════════════════════════════════════
  // コンセプト: 屋台通りから広場へ。メリーゴーランド・太鼓櫓・公園休憩。
  // 密度は屋台通りより疎に、広々とした祭り広場に。

  // ── C3: メリーゴーランド広場 — 中央に carousel、周囲にベンチと風船 ──
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 屋台 + 観客テント ===
      _B('yatai', -160, 38), _B('yatai', -128, 38),
      _B('big_tent', -58, 50),                                  // 観客席 (左)
      _B('big_tent', 58, 50),                                   // 観客席 (右)
      _B('yatai', 128, 38), _B('yatai', 160, 38),
      _B('yatai', -160, 78), _B('yatai', 160, 78),
      // === 下段: ★★ 中央メリーゴーランド (主役) ★★ ===
      _B('yatai', -165, 132), _B('yatai', -130, 132),
      _B('carousel', -45, 145),                                 // ★★ メリーゴーランド (西)
      _B('carousel', 45, 145),                                  // ★★ メリーゴーランド (東)
      _B('yatai', 130, 132), _B('yatai', 165, 132),
      _B('yatai', -108, 178), _B('yatai', 72, 178),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── 上段 提灯帯 ───
      _F('chouchin', -160, 22), _F('noren', -160, 28),
      _F('chouchin', -128, 22), _F('noren', -128, 28),
      _F('chouchin', 128, 22), _F('noren', 128, 28),
      _F('chouchin', 160, 22), _F('noren', 160, 28),
      // ─── 観客席テント付属 ───
      _F('flag_pole', -70, 32), _F('flag_pole', 70, 32),
      _F('banner_pole', -100, 32), _F('banner_pole', 100, 32),
      _F('bench', -90, 78), _F('bench', -50, 78),
      _F('bench', 50, 78), _F('bench', 90, 78),
      _F('popcorn_cart', -30, 75), _F('popcorn_cart', 30, 75),
      _F('parasol', -100, 68), _F('parasol', 100, 68),
      _F('matsuri_drum', 0, 72),                                // 広場中央 演奏準備
      // ─── 屋台小物 ───
      _F('a_frame_sign', -145, 52), _F('a_frame_sign', 145, 52),
      _F('balloon_cluster', -110, 32), _F('balloon_cluster', 110, 32),
      _F('chouchin', -160, 72), _F('chouchin', 160, 72),
      // ─── ★★ 下段: メリーゴーランド周辺の風船 + ベンチ ★★ ───
      _F('balloon_cluster', -45, 118),                          // ★ メリー上の風船 (西)
      _F('balloon_cluster', 45, 118),                           // ★ メリー上の風船 (東)
      _F('flag_pole', -45, 118), _F('flag_pole', 45, 118),
      _F('banner_pole', 0, 128),
      _F('bench', -90, 155), _F('bench', 0, 155), _F('bench', 90, 155),
      _F('bench', -45, 170), _F('bench', 45, 170),
      _F('street_lamp', -25, 145), _F('street_lamp', 25, 145),
      _F('chouchin', -25, 140), _F('chouchin', 25, 140),
      _F('chouchin', 0, 140),
      _F('popcorn_cart', -110, 160), _F('popcorn_cart', 110, 160),
      _F('ticket_booth', -75, 168), _F('ticket_booth', 75, 168),
      _F('matsuri_drum', -150, 168), _F('matsuri_drum', 150, 168),
      // ─── 下段 屋台行列 ───
      _F('chouchin', -165, 122), _F('noren', -165, 128),
      _F('chouchin', -130, 122), _F('noren', -130, 128),
      _F('chouchin', 130, 122), _F('noren', 130, 128),
      _F('chouchin', 165, 122), _F('noren', 165, 128),
      _F('a_frame_sign', -148, 145), _F('a_frame_sign', 148, 145),
      _F('chouchin', -90, 168), _F('chouchin', 90, 168),        // 奥屋台の提灯
      // ─── 下段 花壇 (広場風) ───
      _F('flower_bed', -170, 195), _F('flower_bed', 170, 195),
      _F('flower_bed', -50, 195), _F('flower_bed', 50, 195),
      _F('planter', -120, 195), _F('planter', 120, 195),
      _F('planter', 0, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-90, 78), _H(0, 78), _H(90, 78),                       // 観客席テント
      _H(-45, 135),                                             // メリー乗客 (西)
      _H(45, 135),                                              // メリー乗客 (東)
      _H(-90, 155), _H(0, 155), _H(90, 155),                    // ベンチの家族
      _H(-45, 170), _H(45, 170),
      _H(-75, 168), _H(75, 168),                                // チケットブース
      _H(-160, 55), _H(160, 55),                                // 屋台客
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),                     // ★ Act II 基調は checker
      _G('checker_tile', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 18),                        // ★ 中央通り赤絨毯
      _G('tile', -70, 62, 60, 30),                              // 観客席前
      _G('tile', 70, 62, 60, 30),
      _G('tile', -45, 165, 50, 50),                             // メリーゴー西床
      _G('tile', 45, 165, 50, 50),                              // メリーゴー東床
      _G('grass', -120, 195, 60, 20),                           // 周囲の芝
      _G('grass', 120, 195, 60, 20),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C4: 盆踊り広場 — 中央に大太鼓櫓、周囲に輪になる踊り手 ──
  // ★ Act II シグネチャ: matsuri_drum 多数 + 観客輪 + 大提灯の群れ
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 観客席テント + 屋台 ===
      _B('yatai', -165, 38), _B('yatai', -135, 38),
      _B('big_tent', -75, 50),                                  // 観客テント 西
      _B('yatai', -35, 38),                                     // 中央手前屋台
      _B('yatai', 35, 38),
      _B('big_tent', 75, 50),                                   // 観客テント 東
      _B('yatai', 135, 38), _B('yatai', 165, 38),
      _B('yatai', -155, 78), _B('yatai', 155, 78),
      // === 下段: ★★ 中央に太鼓櫓 (big_tent で見立て) ★★ ===
      _B('yatai', -165, 132), _B('yatai', -135, 132),
      _B('yatai', -108, 132),
      _B('big_tent', -34, 145),                                   // ★★ 太鼓櫓 (中央)
      _B('yatai', 108, 132),
      _B('yatai', 135, 132), _B('yatai', 165, 132),
      _B('yatai', -108, 178), _B('yatai', 72, 178),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── 上段: 観客+屋台シグネチャ ───
      _F('chouchin', -165, 22), _F('noren', -165, 28),
      _F('chouchin', -135, 22), _F('noren', -135, 28),
      _F('chouchin', -35, 22), _F('noren', -35, 28),
      _F('chouchin', 35, 22), _F('noren', 35, 28),
      _F('chouchin', 135, 22), _F('noren', 135, 28),
      _F('chouchin', 165, 22), _F('noren', 165, 28),
      // ─── 観客テント付属 ───
      _F('flag_pole', -75, 32), _F('flag_pole', 75, 32),
      _F('bench', -95, 78), _F('bench', -55, 78),
      _F('bench', 55, 78), _F('bench', 95, 78),
      _F('parasol', -110, 68), _F('parasol', 110, 68),
      // ─── ★★ 中央太鼓櫓: matsuri_drum 4 台 + 提灯大群 ★★ ───
      _F('matsuri_drum', -20, 148),                             // ★ 太鼓 (左)
      _F('matsuri_drum', 20, 148),                              // ★ 太鼓 (右)
      _F('matsuri_drum', 0, 132),                               // ★ 太鼓 (上)
      _F('matsuri_drum', 0, 165),                               // ★ 太鼓 (下)
      _F('flag_pole', -20, 118), _F('flag_pole', 20, 118),
      _F('flag_pole', 0, 118),
      _F('chouchin', -35, 125), _F('chouchin', 35, 125),        // 太鼓櫓の大提灯
      _F('chouchin', -20, 120), _F('chouchin', 20, 120),
      _F('chouchin', 0, 115),
      _F('banner_pole', -50, 128), _F('banner_pole', 50, 128),
      _F('balloon_cluster', -35, 165), _F('balloon_cluster', 35, 165),
      // ─── 踊り手の輪 (bench が観客、周囲に踊りスペース) ───
      _F('bench', -80, 168), _F('bench', 80, 168),
      _F('bench', -50, 180), _F('bench', 50, 180),
      _F('chouchin', -65, 158), _F('chouchin', 65, 158),
      _F('chouchin', -65, 175), _F('chouchin', 65, 175),
      // ─── 下段屋台 ───
      _F('chouchin', -165, 122), _F('noren', -165, 128),
      _F('chouchin', -135, 122), _F('noren', -135, 128),
      _F('chouchin', -95, 122), _F('noren', -95, 128),
      _F('chouchin', 95, 122), _F('noren', 95, 128),
      _F('chouchin', 135, 122), _F('noren', 135, 128),
      _F('chouchin', 165, 122), _F('noren', 165, 128),
      _F('popcorn_cart', -148, 168), _F('popcorn_cart', 148, 168),
      _F('a_frame_sign', -120, 148), _F('a_frame_sign', 120, 148),
      // ─── 花壇 ───
      _F('flower_bed', -170, 195), _F('flower_bed', 170, 195),
      _F('flower_bed', -120, 195), _F('flower_bed', 120, 195),
      _F('planter', 0, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (太鼓の音で光る提灯帯) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-95, 78), _H(-55, 78), _H(55, 78), _H(95, 78),         // 観客席
      _H(-20, 148), _H(20, 148),                                // 太鼓奏者
      _H(0, 135), _H(0, 165),
      _H(-65, 170), _H(65, 170),                                // 踊り手
      _H(-50, 180), _H(50, 180),
      _H(-80, 168), _H(80, 168),                                // ベンチの客
      _H(-135, 55), _H(135, 55),                                // 屋台客
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('checker_tile', 0, 153.5, 200, 93),
      _G('red_carpet', 0, 100, 360, 18),
      _G('red_carpet', 0, 148, 80, 80),                         // ★★ 太鼓櫓下の赤絨毯
      _G('stone_pavement', 0, 148, 50, 50),                     // ★ 太鼓櫓の石畳中心
      _G('tile', -75, 62, 55, 30), _G('tile', 75, 62, 55, 30),
      _G('grass', -140, 170, 60, 40),                           // 周囲の芝
      _G('grass', 140, 170, 60, 40),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 30), _VR(-90, 70, 200), _VR(0, 0, 200, 'avenue'), _VR(90, 0, 30), _VR(90, 70, 200)],
  } },

  // ── C5: 公園休憩 (park_break) — 既存パターン維持 ──
  // 静かな庭園エリアで一息。Act II の盛り上がりから Act III への溜め。
  { patternId: 'park_break' },

  // ═══ Act III: 大型アトラクション (C6-C9) ═══════════════════════════
  // コンセプト: park_break の静けさを破り、ジェットコースター・観覧車・大テントの
  // 巨大建物が次々と現れる。Stage 4 の重工業と対になる「陽のランドマーク」。

  // ── C6: ジェットコースター登場 ★★ 初の大型ランドマーク ★★ ──
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: ★★ ジェットコースター (中央、巨大) ★★ + 観客屋台 ===
      _B('yatai', -165, 38),
      _B('big_tent', -122, 50),                                 // 観客席テント
      _B('roller_coaster', -40, 60),                            // ★★ ジェットコースター (w=60, h=60)
      _B('roller_coaster', 40, 60),                             // ★★ 第二レール (並列)
      _B('big_tent', 122, 50),
      _B('yatai', 165, 38),
      // === 下段: 関連屋台 + 発券所 + 休憩 ===
      _B('yatai', -165, 132), _B('yatai', -135, 132),
      _B('chaya', -108, 132),                                   // 待機中の休憩カフェ
      _B('garage', -60, 138),                                   // ★ 発券所
      _B('yatai', -20, 132),
      _B('yatai', 20, 132),
      _B('garage', 60, 138),                                    // ★ 発券所
      _B('chaya', 108, 132),
      _B('yatai', 135, 132), _B('yatai', 165, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── ★★ コースターの演出: 旗・風船・信号 ★★ ───
      _F('flag_pole', -30, 28), _F('flag_pole', 30, 28),
      _F('flag_pole', 0, 22),
      _F('banner_pole', -55, 30), _F('banner_pole', 55, 30),
      _F('balloon_cluster', -50, 40), _F('balloon_cluster', 50, 40),
      _F('balloon_cluster', 0, 38),
      _F('chouchin', -15, 38), _F('chouchin', 15, 38),
      _F('signal_tower', -60, 78), _F('signal_tower', 60, 78), // ★ コースター安全灯
      // ─── 上段ファサード ───
      _F('chouchin', -165, 22), _F('noren', -165, 28),
      _F('chouchin', 165, 22), _F('noren', 165, 28),
      // ─── 観客席テント付属 ───
      _F('flag_pole', -120, 32), _F('flag_pole', 120, 32),
      _F('bench', -140, 78), _F('bench', -100, 78),
      _F('bench', 100, 78), _F('bench', 140, 78),
      _F('parasol', -155, 68), _F('parasol', 155, 68),
      _F('popcorn_cart', -90, 72), _F('popcorn_cart', 90, 72),
      _F('matsuri_drum', -170, 82), _F('matsuri_drum', 170, 82),
      // ─── 下段: 発券所まわり + 行列 ───
      _F('a_frame_sign', -60, 118),
      _F('a_frame_sign', 60, 118),
      _F('flag_pole', -60, 120), _F('flag_pole', 60, 120),
      _F('sign_board', -60, 160),                               // 身長制限看板
      _F('sign_board', 60, 160),
      _F('bollard', -45, 160), _F('bollard', -75, 160),
      _F('bollard', 45, 160), _F('bollard', 75, 160),
      _F('ticket_booth', -30, 168), _F('ticket_booth', 30, 168),
      // ─── 下段 屋台行列 ───
      _F('chouchin', -165, 122), _F('noren', -165, 128),
      _F('chouchin', -135, 122), _F('noren', -135, 128),
      _F('chouchin', -100, 122), _F('noren', -100, 128),
      _F('chouchin', -20, 122), _F('noren', -20, 128),
      _F('chouchin', 20, 122), _F('noren', 20, 128),
      _F('chouchin', 100, 122), _F('noren', 100, 128),
      _F('chouchin', 135, 122), _F('noren', 135, 128),
      _F('chouchin', 165, 122), _F('noren', 165, 128),
      _F('balloon_cluster', -150, 168), _F('balloon_cluster', 150, 168),
      _F('bench', -120, 175), _F('bench', 120, 175),
      _F('popcorn_cart', -148, 165), _F('popcorn_cart', 148, 165),
      _F('flower_bed', -175, 195), _F('flower_bed', 175, 195),
      _F('flower_bed', 0, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-30, 75), _H(30, 75),                                  // コースター乗客
      _H(-120, 78), _H(120, 78),                                // 観客席
      _H(-30, 168), _H(30, 168),                                // 発券所行列
      _H(-60, 152), _H(60, 152),
      _H(-100, 152), _H(100, 152),
      _H(-20, 152), _H(20, 152),
      _H(-120, 175), _H(120, 175),                              // ベンチ待機
      _H(0, 165),
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('checker_tile', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 18),
      _G('asphalt', -30, 72, 50, 40),                           // ★ コースターの鉄骨基礎 (西)
      _G('asphalt', 30, 72, 50, 40),                            // ★ コースター基礎 (東)
      _G('tile', -60, 168, 40, 40),                             // 発券所前 (西)
      _G('tile', 60, 168, 40, 40),                              // 発券所前 (東)
      _G('tile', -120, 62, 50, 30),
      _G('tile', 120, 62, 50, 30),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C7: 大観覧車 ★★ Stage 5 最大のランドマーク ★★ ──
  // 中央に巨大な ferris_wheel (w=44 h=48)、周囲に大テントと屋台、風船の海
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 巨大観覧車 (中央) + 補助屋台 ===
      _B('yatai', -165, 38), _B('yatai', -130, 38),
      _B('big_tent', -58, 50),                                  // 観覧車入場テント (西)
      _B('ferris_wheel', 32, 68),                                // ★★ 大観覧車 (中央、奥目)
      _B('big_tent', 80, 50),                                   // 観覧車入場テント (東)
      _B('yatai', 130, 38), _B('yatai', 165, 38),
      // === 下段: 観覧車発券所 + 屋台 ===
      _B('yatai', -165, 132), _B('yatai', -135, 132),
      _B('chaya', -108, 132),                                    // 観覧車待機カフェ
      _B('garage', -45, 138),                                   // ★ 観覧車発券所
      _B('yatai', -20, 132),
      _B('yatai', 20, 132),
      _B('garage', 45, 138),                                    // ★ 観覧車発券所
      _B('chaya', 108, 132),
      _B('yatai', 135, 132), _B('yatai', 165, 132),
      _B('yatai', -72, 178), _B('yatai', 72, 178),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── ★★ 観覧車の装飾 ★★ ───
      _F('flag_pole', -25, 42), _F('flag_pole', 25, 42),
      _F('flag_pole', 0, 30),
      _F('balloon_cluster', -40, 50), _F('balloon_cluster', 40, 50),
      _F('balloon_cluster', 0, 22),                             // 観覧車頂上の風船
      _F('banner_pole', -50, 42), _F('banner_pole', 50, 42),
      _F('chouchin', -15, 48), _F('chouchin', 15, 48),
      // ─── 入場テント ───
      _F('flag_pole', -80, 32), _F('flag_pole', 80, 32),
      _F('bench', -100, 78), _F('bench', -60, 78),
      _F('bench', 60, 78), _F('bench', 100, 78),
      _F('parasol', -115, 68), _F('parasol', 115, 68),
      _F('popcorn_cart', -50, 72), _F('popcorn_cart', 50, 72),
      // ─── 上段ファサード ───
      _F('chouchin', -165, 22), _F('noren', -165, 28),
      _F('chouchin', -130, 22), _F('noren', -130, 28),
      _F('chouchin', 130, 22), _F('noren', 130, 28),
      _F('chouchin', 165, 22), _F('noren', 165, 28),
      _F('matsuri_drum', -160, 82), _F('matsuri_drum', 160, 82),
      // ─── 下段: 発券所まわり ───
      _F('a_frame_sign', -45, 118), _F('a_frame_sign', 45, 118),
      _F('flag_pole', -45, 120), _F('flag_pole', 45, 120),
      _F('sign_board', -45, 160), _F('sign_board', 45, 160),
      _F('bollard', -30, 160), _F('bollard', -60, 160),
      _F('bollard', 30, 160), _F('bollard', 60, 160),
      _F('ticket_booth', -20, 168), _F('ticket_booth', 20, 168),
      // ─── 下段屋台 ───
      _F('chouchin', -165, 122), _F('noren', -165, 128),
      _F('chouchin', -135, 122), _F('noren', -135, 128),
      _F('chouchin', -95, 122), _F('noren', -95, 128),
      _F('chouchin', -10, 122), _F('noren', -10, 128),
      _F('chouchin', 10, 122), _F('noren', 10, 128),
      _F('chouchin', 95, 122), _F('noren', 95, 128),
      _F('chouchin', 135, 122), _F('noren', 135, 128),
      _F('chouchin', 165, 122), _F('noren', 165, 128),
      _F('balloon_cluster', -120, 175), _F('balloon_cluster', 120, 175),
      _F('balloon_cluster', 0, 195),
      _F('bench', -135, 185), _F('bench', 135, 185),
      _F('popcorn_cart', -148, 168), _F('popcorn_cart', 148, 168),
      _F('chouchin', -85, 168), _F('chouchin', 85, 168),
      _F('flower_bed', -175, 195), _F('flower_bed', 175, 195),
      _F('matsuri_drum', -60, 195), _F('matsuri_drum', 60, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(0, 85),                                                // 観覧車に乗る客
      _H(-60, 78), _H(60, 78),                                  // 入場テント前
      _H(-100, 78), _H(100, 78),
      _H(-20, 168), _H(20, 168),                                // 発券所
      _H(-45, 152), _H(45, 152),
      _H(-95, 152), _H(95, 152),                                // カフェ客
      _H(-135, 185), _H(135, 185),                              // ベンチ
      _H(-130, 55), _H(130, 55),                                // 屋台
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('checker_tile', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 18),
      _G('tile', 0, 72, 80, 60),                                // ★ 観覧車の台座タイル
      _G('stone_pavement', 0, 62, 50, 30),                      // 観覧車の石畳中心
      _G('tile', -80, 62, 50, 30), _G('tile', 80, 62, 50, 30),
      _G('tile', -45, 168, 40, 40), _G('tile', 45, 168, 40, 40),
      _G('grass', -150, 195, 50, 20), _G('grass', 150, 195, 50, 20),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 0, 200, 'avenue'), _VR(90, 0, 30), _VR(90, 70, 200)],
  } },

  // ── C8: 第 2 コースター + カーニバルショーテント ──
  // 下段に別のジェットコースターと大テント、上段は屋台帯
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 屋台 + 観客席テント ===
      _B('yatai', -165, 38), _B('yatai', -135, 38),
      _B('yatai', -108, 38),
      _B('big_tent', -50, 50),                                  // 観客席テント (左)
      _B('big_tent', 50, 50),                                   // 観客席テント (右)
      _B('yatai', 108, 38),
      _B('yatai', 135, 38), _B('yatai', 165, 38),
      _B('yatai', -160, 78), _B('yatai', 160, 78),
      // === 下段: コースター + 大テント ===
      _B('yatai', -170, 132),
      _B('roller_coaster', -128, 155),                           // ★★ 第 2 コースター (西)
      _B('carousel', -29, 145),                                   // ★ 中央メリー (彩り)
      _B('roller_coaster', 52, 155),                            // ★★ 第 2 コースター (東)
      _B('yatai', 170, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── 上段 屋台帯 ───
      _F('chouchin', -165, 22), _F('noren', -165, 28),
      _F('chouchin', -135, 22), _F('noren', -135, 28),
      _F('chouchin', -105, 22), _F('noren', -105, 28),
      _F('chouchin', 0, 22), _F('noren', 0, 28),
      _F('chouchin', 105, 22), _F('noren', 105, 28),
      _F('chouchin', 135, 22), _F('noren', 135, 28),
      _F('chouchin', 165, 22), _F('noren', 165, 28),
      // ─── 観客席テント ───
      _F('flag_pole', -50, 32), _F('flag_pole', 50, 32),
      _F('bench', -70, 78), _F('bench', -30, 78),
      _F('bench', 30, 78), _F('bench', 70, 78),
      _F('parasol', -85, 68), _F('parasol', 85, 68),
      _F('popcorn_cart', -35, 75), _F('popcorn_cart', 35, 75),
      _F('matsuri_drum', 0, 78),
      _F('balloon_cluster', -50, 45), _F('balloon_cluster', 50, 45),
      // ─── ★★ 下段: コースター演出 (左右) ★★ ───
      _F('flag_pole', -90, 118), _F('flag_pole', 90, 118),
      _F('banner_pole', -120, 128), _F('banner_pole', 120, 128),
      _F('balloon_cluster', -90, 130), _F('balloon_cluster', 90, 130),
      _F('signal_tower', -60, 150), _F('signal_tower', 60, 150),
      _F('chouchin', -90, 135), _F('chouchin', 90, 135),
      // ─── 中央メリー ───
      _F('balloon_cluster', 0, 125),
      _F('flag_pole', 0, 118),
      _F('chouchin', -15, 140), _F('chouchin', 15, 140),
      _F('street_lamp', -20, 145), _F('street_lamp', 20, 145),
      // ─── 下段 屋台 + 小物 ───
      _F('chouchin', -170, 122), _F('noren', -170, 128),
      _F('chouchin', 170, 122), _F('noren', 170, 128),
      _F('a_frame_sign', -155, 148), _F('a_frame_sign', 155, 148),
      _F('popcorn_cart', -150, 170), _F('popcorn_cart', 150, 170),
      _F('bench', -135, 180), _F('bench', 135, 180),
      _F('bench', -45, 190), _F('bench', 45, 190),
      _F('ticket_booth', -115, 178), _F('ticket_booth', 115, 178),
      _F('chouchin', -115, 168),
      _F('chouchin', 115, 168),
      _F('flower_bed', -175, 195), _F('flower_bed', 175, 195),
      _F('flower_bed', 0, 195),
      _F('matsuri_drum', -45, 195), _F('matsuri_drum', 45, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-70, 78), _H(-30, 78), _H(30, 78), _H(70, 78),         // 観客席
      _H(-90, 168), _H(90, 168),                                // コースター乗客
      _H(0, 140),                                               // メリー乗客
      _H(-115, 178), _H(115, 178),                              // 発券所
      _H(-45, 190), _H(45, 190),                                // ベンチ
      _H(-135, 55), _H(135, 55),                                // 屋台
      _H(0, 55),                                                // 中央屋台
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('checker_tile', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 18),
      _G('asphalt', -90, 168, 60, 40),                          // 西コースター基礎
      _G('asphalt', 90, 168, 60, 40),                           // 東コースター基礎
      _G('tile', 0, 148, 50, 40),                               // 中央メリー台座
      _G('tile', -50, 62, 50, 30), _G('tile', 50, 62, 50, 30),
      _G('grass', -130, 190, 50, 20), _G('grass', 130, 190, 50, 20),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C9: バルーンアーチ + 大テント (ショー会場) ──
  // Act III の締め。大テント主役+バルーンアーチで空を埋め尽くし、Act IV の休憩へ繋ぐ
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 大テント 2 連 + 屋台 ===
      _B('yatai', -165, 38), _B('yatai', -135, 38),
      _B('big_tent', -58, 50),                                  // ★ 大テント (西)
      _B('big_tent', 58, 50),                                   // ★ 大テント (東)
      _B('yatai', 135, 38), _B('yatai', 165, 38),
      _B('yatai', -155, 78), _B('yatai', 155, 78),
      _B('carousel', -29, 124),                                    // 奥にメリーゴーランド
      // === 下段: ★★ 大テントショー会場 ★★ ===
      _B('yatai', -170, 132), _B('yatai', -140, 132),
      _B('big_tent', -75, 155),                                 // ★★ ショーテント (西)
      _B('big_tent', 58, 155),                                  // ★★ ショーテント (東)
      _B('yatai', 140, 132), _B('yatai', 170, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
      _B('fountain_pavilion', -24, 175),                          // ★ 中央噴水
    ],
    furniture: [
      // ─── ★★ バルーンアーチ (上空一面) ★★ ───
      _F('balloon_cluster', -100, 12), _F('balloon_cluster', -60, 10),
      _F('balloon_cluster', -20, 8), _F('balloon_cluster', 20, 8),
      _F('balloon_cluster', 60, 10), _F('balloon_cluster', 100, 12),
      _F('flag_pole', -60, 32), _F('flag_pole', 60, 32),
      _F('flag_pole', 0, 22),
      _F('banner_pole', -90, 32), _F('banner_pole', 90, 32),
      // ─── 上段ファサード ───
      _F('chouchin', -165, 22), _F('noren', -165, 28),
      _F('chouchin', -135, 22), _F('noren', -135, 28),
      _F('chouchin', 135, 22), _F('noren', 135, 28),
      _F('chouchin', 165, 22), _F('noren', 165, 28),
      // ─── 大テント付属 ───
      _F('chouchin', -80, 38), _F('chouchin', -40, 38),
      _F('chouchin', 40, 38), _F('chouchin', 80, 38),
      _F('bench', -85, 78), _F('bench', -35, 78),
      _F('bench', 35, 78), _F('bench', 85, 78),
      _F('popcorn_cart', -60, 78), _F('popcorn_cart', 60, 78),
      _F('parasol', -110, 68), _F('parasol', 110, 68),
      _F('matsuri_drum', 0, 95),                                // 奥メリーの前
      // ─── ★★ 下段ショーテント 演出 ★★ ───
      _F('flag_pole', -75, 118), _F('flag_pole', 75, 118),
      _F('banner_pole', -105, 128), _F('banner_pole', 105, 128),
      _F('balloon_cluster', -75, 132), _F('balloon_cluster', 75, 132),
      _F('chouchin', -90, 140), _F('chouchin', -60, 140),
      _F('chouchin', 60, 140), _F('chouchin', 90, 140),
      _F('bench', -115, 178), _F('bench', -35, 178),
      _F('bench', 35, 178), _F('bench', 115, 178),
      _F('popcorn_cart', -35, 170), _F('popcorn_cart', 35, 170),
      _F('ticket_booth', -115, 170), _F('ticket_booth', 115, 170),
      // ─── 下段屋台 ───
      _F('chouchin', -170, 122), _F('noren', -170, 128),
      _F('chouchin', -140, 122), _F('noren', -140, 128),
      _F('chouchin', 140, 122), _F('noren', 140, 128),
      _F('chouchin', 170, 122), _F('noren', 170, 128),
      _F('a_frame_sign', -155, 148), _F('a_frame_sign', 155, 148),
      // ─── 中央噴水広場 ───
      _F('chouchin', -25, 172), _F('chouchin', 25, 172),
      _F('flag_pole', 0, 165),
      _F('balloon_cluster', 0, 185),
      _F('flower_bed', -170, 195), _F('flower_bed', 170, 195),
      _F('matsuri_drum', -40, 195), _F('matsuri_drum', 40, 195),
      // ─── 軸: 電柱 + 電線 ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -60, 96), _F('chouchin', 60, 96),
      _F('chouchin', -30, 96), _F('chouchin', 30, 96),
      _F('chouchin', 0, 96),
    ],
    humans: [
      _H(-85, 78), _H(-35, 78), _H(35, 78), _H(85, 78),         // 大テント観客
      _H(0, 95),                                                // 奥メリー
      _H(-115, 178), _H(-35, 178), _H(35, 178), _H(115, 178),   // ショーテント観客
      _H(0, 180),                                               // 噴水前
      _H(-75, 168), _H(75, 168),                                // テント入口
      _H(-160, 55), _H(160, 55),                                // 屋台
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('checker_tile', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 18),
      _G('red_carpet', -75, 165, 100, 50),                      // ★ 西テント下 赤絨毯
      _G('red_carpet', 75, 165, 100, 50),                       // ★ 東テント下 赤絨毯
      _G('tile', -60, 62, 60, 30), _G('tile', 60, 62, 60, 30),
      _G('tile', 0, 78, 60, 42),                                // 奥メリー台座
      _G('stone_pavement', 0, 175, 80, 40),                     // 噴水広場
      _G('grass', -150, 195, 50, 20), _G('grass', 150, 195, 50, 20),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, 180)], verticalRoads: [_VR(-90, 0, 135), _VR(-90, 175, 200), _VR(0, 0, 200, 'avenue'), _VR(90, 0, 200)],
  } },

  // ═══ Act IV: フィナーレ (C10-C13) ══════════════════════════════════
  // コンセプト: 最後の休憩 → パレード → 花火ステージ → GOAL。
  // 赤絨毯が中央通りを全面覆い、提灯・風船・太鼓が総動員される。

  // ── C10: 公園休憩 (park_break) — フィナーレ前の静寂 ──
  { patternId: 'park_break' },

  // ── C11: パレード通り — 赤絨毯全面、旗と風船の海、行進する踊り手 ──
  // 上段 + 下段の両方が赤絨毯、建物は小屋台で通りを広く見せる
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: 屋台を通りの両端に寄せ、中央を広々とパレード用に ===
      _B('yatai', -170, 38), _B('yatai', -140, 38),
      _B('yatai', -110, 38), _B('yatai', -72, 38),
      _B('yatai', 72, 38), _B('yatai', 110, 38),
      _B('yatai', 140, 38), _B('yatai', 170, 38),
      _B('yatai', -170, 78), _B('yatai', 170, 78),
      _B('carousel', -29, 76),                                    // ★ 奥に小メリー (パレードの見どころ)
      // === 下段: 屋台+チャヤ、中央はパレード通行 ===
      _B('yatai', -170, 132), _B('yatai', -140, 132),
      _B('yatai', -110, 132),
      _B('chaya', -70, 132),
      _B('chaya', 70, 132),
      _B('yatai', 110, 132),
      _B('yatai', 140, 132), _B('yatai', 170, 132),
      _B('yatai', -170, 178), _B('yatai', 170, 178),
      _B('shed', -153, 178), _B('shed', 153, 178),
    ],
    furniture: [
      // ─── ★★ パレード演出: 旗と風船の海 ★★ ───
      _F('balloon_cluster', -140, 12), _F('balloon_cluster', -100, 14),
      _F('balloon_cluster', -60, 12), _F('balloon_cluster', -20, 14),
      _F('balloon_cluster', 20, 14), _F('balloon_cluster', 60, 12),
      _F('balloon_cluster', 100, 14), _F('balloon_cluster', 140, 12),
      _F('flag_pole', -60, 20), _F('flag_pole', -20, 20),
      _F('flag_pole', 20, 20), _F('flag_pole', 60, 20),
      _F('banner_pole', 0, 18),
      // ─── 上段 屋台 提灯帯 ───
      _F('chouchin', -170, 22), _F('noren', -170, 28),
      _F('chouchin', -140, 22), _F('noren', -140, 28),
      _F('chouchin', -110, 22), _F('noren', -110, 28),
      _F('chouchin', -80, 22), _F('noren', -80, 28),
      _F('chouchin', 80, 22), _F('noren', 80, 28),
      _F('chouchin', 110, 22), _F('noren', 110, 28),
      _F('chouchin', 140, 22), _F('noren', 140, 28),
      _F('chouchin', 170, 22), _F('noren', 170, 28),
      // ─── パレード中央路 (太鼓と演者) ───
      _F('matsuri_drum', -40, 60), _F('matsuri_drum', 0, 60),
      _F('matsuri_drum', 40, 60),
      _F('chouchin', -30, 68), _F('chouchin', 30, 68),
      _F('parasol', -170, 55), _F('parasol', 170, 55),
      // ─── 下段ファサード ───
      _F('chouchin', -170, 122), _F('noren', -170, 128),
      _F('chouchin', -140, 122), _F('noren', -140, 128),
      _F('chouchin', -110, 122), _F('noren', -110, 128),
      _F('chouchin', -70, 122), _F('noren', -70, 128),
      _F('chouchin', 70, 122), _F('noren', 70, 128),
      _F('chouchin', 110, 122), _F('noren', 110, 128),
      _F('chouchin', 140, 122), _F('noren', 140, 128),
      _F('chouchin', 170, 122), _F('noren', 170, 128),
      // ─── 下段 パレード演出 ───
      _F('matsuri_drum', -40, 155), _F('matsuri_drum', 0, 155),
      _F('matsuri_drum', 40, 155),
      _F('balloon_cluster', -60, 145), _F('balloon_cluster', 60, 145),
      _F('flag_pole', -30, 145), _F('flag_pole', 30, 145),
      _F('chouchin', -15, 165), _F('chouchin', 15, 165),
      _F('bench', -140, 155), _F('bench', 140, 155),
      _F('popcorn_cart', -150, 168), _F('popcorn_cart', 150, 168),
      _F('popcorn_cart', -25, 175), _F('popcorn_cart', 25, 175),
      _F('flower_bed', -170, 195), _F('flower_bed', 170, 195),
      _F('flower_bed', -40, 195), _F('flower_bed', 40, 195),
      _F('ticket_booth', -100, 175), _F('ticket_booth', 100, 175),
      // ─── 軸: 電柱 + 電線 (パレードで光が強い) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (赤絨毯 + 提灯の波) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -75, 96), _F('chouchin', 75, 96),
      _F('chouchin', -45, 96), _F('chouchin', 45, 96),
      _F('chouchin', -15, 96), _F('chouchin', 15, 96),
      _F('matsuri_drum', 0, 100),
    ],
    humans: [
      _H(-40, 60), _H(0, 60), _H(40, 60),                       // 上段太鼓奏者
      _H(-40, 155), _H(0, 155), _H(40, 155),                    // 下段太鼓奏者
      _H(-80, 55), _H(80, 55),                                  // 屋台客
      _H(-140, 55), _H(140, 55),
      _H(-70, 152), _H(70, 152),                                // チャヤ客
      _H(-140, 155), _H(140, 155),                              // ベンチ
      _H(0, 105),                                               // パレード通行者
      _H(0, 180),
    ],
    grounds: [
      _G('red_carpet', 0, 46.5, 360, 93),                       // ★★ 全面赤絨毯 (上段)
      _G('red_carpet', 0, 153.5, 360, 93),                      // ★★ 全面赤絨毯 (下段)
      _G('checker_tile', -170, 62, 55, 30), _G('checker_tile', 170, 62, 55, 30),
      _G('checker_tile', -170, 148, 55, 30), _G('checker_tile', 170, 148, 55, 30),
      _G('tile', 0, 80, 60, 40),                                // 奥メリー台座
      _G('gravel', -170, 82, 18, 22),
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C12: 花火ステージ (ショー会場 × フィナーレ前夜) ──
  // 巨大な big_tent が中央、上空は風船+旗の海、下段は観客と音
  { patternId: 's5_raw', raw: {
    buildings: [
      // === 上段: ★★ 中央 big_tent ショー会場 ★★ ===
      _B('yatai', -170, 38), _B('yatai', -140, 38),
      _B('big_tent', -58, 68),                                  // ★★ 花火観覧テント (西)
      _B('big_tent', 58, 68),                                   // ★★ 花火観覧テント (東)
      _B('yatai', 140, 38), _B('yatai', 170, 38),
      _B('yatai', -155, 78), _B('yatai', 155, 78),
      _B('ferris_wheel', -32, 132),                                // ★ 奥に観覧車再登場 (光の演出)
      // === 下段: 観客席+演奏広場 + 花火打ち上げ地点 ===
      _B('yatai', -170, 132), _B('yatai', -140, 132),
      _B('chaya', -108, 132),
      _B('big_tent', -34, 175),                                   // ★★ 花火打ち上げテント (中央奥)
      _B('chaya', 108, 132),
      _B('yatai', 140, 132), _B('yatai', 170, 132),
      _B('shed', -180, 178), _B('shed', 180, 178),
    ],
    furniture: [
      // ─── ★★ 花火演出: 上空風船の大群 + 旗 ★★ ───
      _F('balloon_cluster', -150, 8), _F('balloon_cluster', -110, 6),
      _F('balloon_cluster', -70, 8), _F('balloon_cluster', -30, 6),
      _F('balloon_cluster', 30, 6), _F('balloon_cluster', 70, 8),
      _F('balloon_cluster', 110, 6), _F('balloon_cluster', 150, 8),
      _F('flag_pole', -70, 30), _F('flag_pole', 70, 30),
      _F('flag_pole', 0, 25),
      _F('banner_pole', -100, 28), _F('banner_pole', 100, 28),
      _F('banner_pole', -30, 28), _F('banner_pole', 30, 28),
      // ─── 上段ファサード ───
      _F('chouchin', -170, 22), _F('noren', -170, 28),
      _F('chouchin', -140, 22), _F('noren', -140, 28),
      _F('chouchin', 140, 22), _F('noren', 140, 28),
      _F('chouchin', 170, 22), _F('noren', 170, 28),
      // ─── 観覧テント小物 ───
      _F('bench', -95, 85), _F('bench', -45, 85),
      _F('bench', 45, 85), _F('bench', 95, 85),
      _F('matsuri_drum', -110, 82), _F('matsuri_drum', 110, 82),
      _F('popcorn_cart', -70, 88), _F('popcorn_cart', 70, 88),
      _F('chouchin', -90, 55), _F('chouchin', -50, 55),
      _F('chouchin', 50, 55), _F('chouchin', 90, 55),
      _F('parasol', -155, 55), _F('parasol', 155, 55),
      // ─── 下段 屋台 ───
      _F('chouchin', -170, 122), _F('noren', -170, 128),
      _F('chouchin', -140, 122), _F('noren', -140, 128),
      _F('chouchin', -100, 122), _F('noren', -100, 128),
      _F('chouchin', 100, 122), _F('noren', 100, 128),
      _F('chouchin', 140, 122), _F('noren', 140, 128),
      _F('chouchin', 170, 122), _F('noren', 170, 128),
      _F('a_frame_sign', -100, 148), _F('a_frame_sign', 100, 148),
      // ─── ★★ 下段 花火打ち上げテント 演出 ★★ ───
      _F('flag_pole', -20, 145), _F('flag_pole', 20, 145),
      _F('flag_pole', 0, 135),
      _F('banner_pole', -40, 155), _F('banner_pole', 40, 155),
      _F('balloon_cluster', -40, 175), _F('balloon_cluster', 40, 175),
      _F('balloon_cluster', 0, 145),
      _F('chouchin', -30, 165), _F('chouchin', 30, 165),
      _F('matsuri_drum', -40, 195), _F('matsuri_drum', 40, 195),
      _F('matsuri_drum', 0, 160),
      _F('bench', -60, 195), _F('bench', 60, 195),
      _F('popcorn_cart', -120, 170), _F('popcorn_cart', 120, 170),
      _F('bench', -140, 175), _F('bench', 140, 175),
      _F('flower_bed', -170, 195), _F('flower_bed', 170, 195),
      _F('ticket_booth', -70, 178), _F('ticket_booth', 70, 178),
      // ─── 軸: 電柱 + 電線 (花火の灯り) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -75, 96), _F('chouchin', 75, 96),
      _F('chouchin', -45, 96), _F('chouchin', 45, 96),
      _F('chouchin', -15, 96), _F('chouchin', 15, 96),
    ],
    humans: [
      _H(-95, 85), _H(-45, 85), _H(45, 85), _H(95, 85),         // 観覧テント
      _H(0, 100),                                               // 中央通行
      _H(-100, 152), _H(100, 152),                              // チャヤ客
      _H(-60, 195), _H(60, 195),                                // 花火テント観客
      _H(0, 180),                                               // 花火奏者
      _H(-70, 178), _H(70, 178),                                // 発券所
      _H(-140, 175), _H(140, 175),                              // ベンチ
    ],
    grounds: [
      _G('checker_tile', 0, 46.5, 360, 93),
      _G('red_carpet', 0, 153.5, 360, 93),                      // ★ 下段フィナーレ赤絨毯
      _G('red_carpet', 0, 100, 360, 18),
      _G('red_carpet', -70, 85, 100, 50),                       // ★ 西テント下
      _G('red_carpet', 70, 85, 100, 50),                        // ★ 東テント下
      _G('tile', 0, 75, 60, 44),                                // 奥観覧車台座
      _G('stone_pavement', 0, 170, 80, 50),                     // ★ 中央花火ステージ
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_MID_HR], verticalRoads: [..._SPINE_V],
  } },

  // ── C13: GOAL ★★★ ラスボス: 夢のファンタジー城 ★★★ ──
  // ★ カメラがこのチャンクに到達したらスクロールが止まり、プレイヤーはお城を破壊する。
  // ★ isGoal: true + 中央に castle (w=70, h=110 のパステル童話城)。
  // ★ コンセプト: テーマパーク・祭り — 和風要素は使わない。
  //    風船アーチ / 三角旗 / 観覧車 / メリーゴーランド / 大テント / 太鼓で城を囲む。
  { patternId: 's5_raw', isGoal: true, raw: {
    buildings: [
      // === ★★★ 中央: ファンタジー城 (ラスボス) ★★★ ===
      _B('castle', 0, 40),                                      // ★★★ 夢の城 (w=70 h=110, y=40-150)
      // === 左右: 観覧車・大テント・コースター (城を飾るランドマーク) ===
      _B('big_tent', -140, 50),                                 // ★ 西大テント (客席)
      _B('big_tent', 140, 50),                                  // ★ 東大テント (客席)
      _B('yatai', -175, 38), _B('yatai', 175, 38),              // 上段の端
      _B('yatai', -175, 78), _B('yatai', 175, 78),              // 奥
      // === 下段: 応援ランドマーク + 屋台 ===
      _B('carousel', -117, 145),                                // ★ 西メリーゴーランド (応援)
      _B('carousel', 117, 145),                                 // ★ 東メリーゴーランド (応援)
      _B('yatai', -170, 132), _B('yatai', -147, 132),           // 西端屋台
      _B('yatai', 147, 132), _B('yatai', 170, 132),             // 東端屋台
      _B('yatai', -60, 132), _B('yatai', 60, 132),              // 城前 左右の屋台
      _B('yatai', -170, 178), _B('yatai', 170, 178),
      _B('shed', -153, 178), _B('shed', 153, 178),
    ],
    furniture: [
      // ─── ★★★ 空を埋める花火 (風船の大花束) + 三角旗ガーランド ★★★ ───
      _F('balloon_cluster', -165, 6), _F('balloon_cluster', -125, 6),
      _F('balloon_cluster', -85, 4), _F('balloon_cluster', -45, 6),
      _F('balloon_cluster', 45, 6), _F('balloon_cluster', 85, 4),
      _F('balloon_cluster', 125, 6), _F('balloon_cluster', 165, 6),
      _F('balloon_cluster', -25, 14), _F('balloon_cluster', 25, 14),
      _F('balloon_cluster', 0, 10),
      _F('banner_pole', -100, 16), _F('banner_pole', 100, 16),
      _F('banner_pole', -50, 18), _F('banner_pole', 50, 18),
      _F('banner_pole', 0, 20),                                 // 中央の大バナー
      _F('flag_pole', -85, 18), _F('flag_pole', 85, 18),
      _F('flag_pole', -30, 20), _F('flag_pole', 30, 20),
      // ─── ★★ お城の参道 (チケットブース + ポップコーン + 桜並木) ★★ ───
      _F('ticket_booth', -85, 85),                              // 西入場ゲート (チケット)
      _F('ticket_booth', 85, 85),                               // 東入場ゲート
      _F('popcorn_cart', -100, 72), _F('popcorn_cart', 100, 72),
      _F('parasol', -110, 62), _F('parasol', 110, 62),
      _F('balloon_cluster', -105, 45), _F('balloon_cluster', 105, 45),
      _F('flower_bed', -120, 92), _F('flower_bed', 120, 92),    // 参道の花壇
      _F('flower_bed', -100, 95), _F('flower_bed', 100, 95),
      _F('sakura_tree', -125, 60), _F('sakura_tree', 125, 60),  // 桜の参道
      _F('street_lamp', -90, 85), _F('street_lamp', 90, 85),
      // ─── 大テント周辺 (観客席) ───
      _F('flag_pole', -140, 32), _F('flag_pole', 140, 32),
      _F('chouchin', -160, 38), _F('chouchin', -120, 38),
      _F('chouchin', 120, 38), _F('chouchin', 160, 38),
      _F('bench', -155, 78), _F('bench', -125, 78),
      _F('bench', 125, 78), _F('bench', 155, 78),
      _F('popcorn_cart', -145, 80), _F('popcorn_cart', 145, 80),
      _F('matsuri_drum', -170, 82), _F('matsuri_drum', 170, 82),
      _F('balloon_cluster', -165, 55), _F('balloon_cluster', 165, 55),
      // ─── 上段 屋台衆 ───
      _F('chouchin', -175, 22), _F('noren', -175, 28),
      _F('chouchin', 175, 22), _F('noren', 175, 28),
      _F('chouchin', -175, 62), _F('chouchin', 175, 62),
      // ─── 下段: 屋台通り ファサード ───
      _F('chouchin', -170, 122), _F('noren', -170, 128),
      _F('chouchin', -145, 122), _F('noren', -145, 128),
      _F('chouchin', -60, 122), _F('noren', -60, 128),          // 城前 西屋台
      _F('chouchin', 60, 122), _F('noren', 60, 128),            // 城前 東屋台
      _F('chouchin', 145, 122), _F('noren', 145, 128),
      _F('chouchin', 170, 122), _F('noren', 170, 128),
      // ─── メリーゴーランド周辺 ───
      _F('balloon_cluster', -115, 125), _F('balloon_cluster', 115, 125),
      _F('flag_pole', -115, 118), _F('flag_pole', 115, 118),
      _F('chouchin', -130, 140), _F('chouchin', -100, 140),
      _F('chouchin', 100, 140), _F('chouchin', 130, 140),
      _F('popcorn_cart', -135, 168), _F('popcorn_cart', 135, 168),
      _F('bench', -90, 168), _F('bench', 90, 168),
      _F('ticket_booth', -90, 180), _F('ticket_booth', 90, 180),
      // ─── ★★ 下段中央: 応援太鼓広場 + バルーンアーチ ★★ ───
      _F('matsuri_drum', -25, 165), _F('matsuri_drum', 25, 165),
      _F('matsuri_drum', 0, 175),
      _F('chouchin', -15, 155), _F('chouchin', 15, 155),
      _F('chouchin', 0, 150),
      _F('flag_pole', -20, 145), _F('flag_pole', 20, 145),
      _F('flag_pole', 0, 138),
      _F('balloon_cluster', -35, 155), _F('balloon_cluster', 35, 155),
      _F('balloon_cluster', 0, 165),
      _F('bench', -55, 170), _F('bench', 55, 170),
      _F('parasol', -75, 155), _F('parasol', 75, 155),
      _F('popcorn_cart', -45, 178), _F('popcorn_cart', 45, 178),
      // ─── 最背面: フィナーレ太鼓 + 花壇 + ベンチ ───
      _F('matsuri_drum', -170, 195), _F('matsuri_drum', 170, 195),
      _F('matsuri_drum', -100, 195), _F('matsuri_drum', 100, 195),
      _F('bench', -145, 195), _F('bench', 145, 195),
      _F('flower_bed', -50, 195), _F('flower_bed', 50, 195),
      _F('flower_bed', 0, 195),
      _F('flower_bed', -170, 172), _F('flower_bed', 170, 172),
      // ─── 軸: 電柱 + 電線 (祭りの光) ───
      _F('power_pole', -178, 92), _F('power_line', -175, 88),
      _F('power_pole', 178, 92), _F('power_line', 175, 88),
      _F('power_pole', -178, 195), _F('power_line', -175, 192),
      _F('power_pole', 178, 195), _F('power_line', 175, 192),
      // ─── 中央通り (城の前、提灯の波) ───
      _F('street_lamp', -90, 100), _F('street_lamp', 90, 100),
      _F('chouchin', -75, 96), _F('chouchin', 75, 96),
      _F('chouchin', -45, 96), _F('chouchin', 45, 96),
      _F('chouchin', -15, 96), _F('chouchin', 15, 96),
    ],
    humans: [
      _H(-85, 90), _H(85, 90),                                  // チケットゲート
      _H(-100, 75), _H(100, 75),                                // 参道の観光客
      _H(-140, 80), _H(140, 80),                                // 大テント観客
      _H(-155, 78), _H(155, 78),
      _H(-60, 152), _H(60, 152),                                // 城前屋台客
      _H(-115, 140), _H(115, 140),                              // メリー乗客
      _H(-25, 165), _H(25, 165),                                // 応援太鼓奏者
      _H(0, 178),                                               // 中央儀式
      _H(-55, 170), _H(55, 170),
      _H(-170, 195), _H(170, 195),                              // 裏方
      _H(-100, 195), _H(100, 195),
      _H(0, 100),                                               // 城前通路
    ],
    grounds: [
      _G('red_carpet', 0, 46.5, 360, 93),                       // ★★ 全面赤絨毯 (決戦の舞台)
      _G('red_carpet', 0, 153.5, 360, 93),
      _G('red_carpet', 0, 100, 360, 22),                        // 中央通り赤絨毯強調
      _G('checker_tile', 0, 90, 120, 60),                       // ★★ 城の敷地タイル (パステル)
      _G('checker_tile', -85, 78, 40, 50),                      // ★ 西入場広場
      _G('checker_tile', 85, 78, 40, 50),                       // ★ 東入場広場
      _G('tile', -140, 62, 60, 30),                             // 西テント床
      _G('tile', 140, 62, 60, 30),                              // 東テント床
      _G('grass', -125, 92, 40, 16),                            // 花壇の芝 (西)
      _G('grass', 125, 92, 40, 16),                             // 花壇の芝 (東)
      _G('tile', -115, 158, 50, 50),                            // 西メリー台座
      _G('tile', 115, 158, 50, 50),                             // 東メリー台座
      _G('checker_tile', 0, 170, 80, 50),                       // 応援太鼓広場
      _G('concrete', 0, 15, 80, 20),
    ],
    horizontalRoads: [_HR(100, -180, -37), _HR(100, 37, 180)], verticalRoads: [_VR(-90, 0, 200), _VR(0, 97, 200, 'avenue'), _VR(90, 0, 200)],
  } },
];

// ステージ仕様 (新指示書):
//   Stage 1: 昼の住宅街から街はずれへ
//   Stage 2: 夜の歓楽街・飲食街
//   Stage 3: 都心オフィス・公共中枢       (チャンク再構成は後続作業)
//   Stage 4: 工業港湾・インフラ地帯
//   Stage 5: 城下町・祭礼・最終決戦       (チャンク再構成は後続作業)
export const STAGES: StageDef[] = [
  { id: 0, name: '昼の住宅街',         nameEn: 'SUBURBS',         templates: STAGE_1_TEMPLATES, sidewalkZone: 0,
    bgTop: [0.52, 0.74, 0.96], bgBottom: [0.38, 0.50, 0.38] },
  { id: 1, name: '夜の歓楽街',         nameEn: 'NEON DISTRICT',   templates: STAGE_2_TEMPLATES, sidewalkZone: 5,
    bgTop: [0.10, 0.08, 0.25], bgBottom: [0.22, 0.14, 0.32] },
  { id: 2, name: '都心オフィス街',     nameEn: 'DOWNTOWN',        templates: STAGE_3_TEMPLATES, sidewalkZone: 3,
    bgTop: [0.92, 0.78, 0.82], bgBottom: [0.62, 0.52, 0.44] },
  { id: 3, name: '工業港湾',           nameEn: 'HARBOR',          templates: STAGE_4_TEMPLATES, sidewalkZone: 2,
    bgTop: [0.58, 0.62, 0.70], bgBottom: [0.40, 0.42, 0.48] },
  { id: 4, name: '城下町・祭礼',       nameEn: 'CASTLE TOWN',     templates: STAGE_5_TEMPLATES, sidewalkZone: 4,
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
    clusters: raw.clusters,
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
