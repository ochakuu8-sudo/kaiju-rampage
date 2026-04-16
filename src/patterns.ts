/**
 * patterns.ts — 道路パターンライブラリ
 *
 * 初期都市用 1 つ + チャンク用 10 種類。
 * 各パターンは 4 cols × N rows のグリッドに道路と cell 内容を定義する。
 */

import type { RoadPattern } from './grid';

// ─────────────────────────────────────────────────────────────────
// 初期都市パターン
// ─────────────────────────────────────────────────────────────────

// 初期都市は既存の固定道路 (HILLTOP/MAIN/LOWER) に合わせて 3 行構造
// Grid lines (y):
//   line 0: HILLTOP (row 0 の上境界)
//   line 1: MAIN    (row 0 と row 1 の境界)
//   line 2: LOWER   (row 1 と row 2 の境界)
//   line 3: RIVER   (row 2 の下境界、川なので描画しない)
//
// Col lines (x):
//   line 0: 世界左壁
//   line 1: -90
//   line 2: 0
//   line 3: 90
//   line 4: 世界右壁

export const INITIAL_CITY_PATTERN: RoadPattern = {
  id: 'initial_city',
  weight: 1,
  rows: 3,
  cols: 4,
  // 注意: row index は Y 上方向。row 0 = 最下段 (RIVER 側)、row 2 = 最上段 (HILLTOP 側)
  horizontalRoads: [
    // line 0 (y=-80): RIVER (描画は drawRiver 側で)
    // line 1 (y=20): LOWER — 全幅
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
    // line 2 (y=120): MAIN — 全幅 avenue
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'avenue' },
    // line 3 (y=220): HILLTOP — 全幅
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // line 1 (-90): LOWER から HILLTOP まで (川エリアには入らない)
    { gridLine: 1, startCell: 1, endCell: 3, cls: 'street' },
    // line 2 (0): LOWER から MAIN までで終わる (T 字路、神社を避けて上で切れる)
    { gridLine: 2, startCell: 1, endCell: 2, cls: 'street' },
    // line 3 (90): LOWER から HILLTOP まで (川エリアには入らない)
    { gridLine: 3, startCell: 1, endCell: 3, cls: 'street' },
  ],
  cells: [
    // ROW 0 (下段 - 住宅街、RIVER と LOWER の間): 1 cell = 1 街区
    [ 'house_trio_garden', 'ramen_izakaya', 'house_konbini', 'house_garage' ],
    // ROW 1 (中段 - 商業+宗教、LOWER と MAIN の間)
    [ 'shop_parasol_row', 'shrine_complex', 'temple_garden', 'clinic_daycare' ],
    // ROW 2 (上段 - ランドマーク、MAIN と HILLTOP の間): 駅 / 百貨店 (2-cell) / 病院
    [ 'train_station_plaza', 'dept_store_plaza', 'merged_right', 'hospital_scene' ],
  ],
  merges: [
    { row: 2, col: 1, spanCols: 2 }, // 百貨店が 2 cells を占有
  ],
};

// ─────────────────────────────────────────────────────────────────
// チャンクパターン (10 種類)
// ─────────────────────────────────────────────────────────────────

// チャンクは 2 行 × 4 列 (高さ 200 = 2 * cellH)
// Grid lines:
//   line 0: チャンク下端 (他チャンクと共有)
//   line 1: 中央 (row 0 と row 1 の境界)
//   line 2: チャンク上端 (次チャンクと共有)

const FULL_GRID: RoadPattern = {
  id: 'full_grid', weight: 3,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'ramen_izakaya', 'house_garage' ],
    [ 'shop_parasol_row',  'shrine_complex', 'temple_garden', 'clinic_daycare' ],
  ],
};

const PLAZA_CENTER: RoadPattern = {
  id: 'plaza_center', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
    // 中央 gridLine 2 は省略 (広場)
  ],
  cells: [
    [ 'house_trio_garden', 'house_garage', 'house_konbini', 'garden_shed' ],
    [ 'shop_parasol_row', 'shopping_mall_plaza', 'merged_right', 'clinic_daycare' ],
  ],
  merges: [ { row: 1, col: 1, spanCols: 2 } ],
};

const T_JUNCTION_WEST: RoadPattern = {
  id: 't_junction_west', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    // 水平道路は西側 2 cells でのみ (残りは袋小路)
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
  ],
  verticalRoads: [
    // row 0 の境界道路 (merge されていない側)
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' }, // 中央は両行走る (merge 境界)
    { gridLine: 3, startCell: 0, endCell: 1, cls: 'street' },
  ],
  cells: [
    [ 'house_konbini', 'florist_bakery', 'ramen_izakaya', 'cafe_bookstore' ],
    [ 'shotengai_food', 'merged_right', 'shotengai_game', 'merged_right' ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
  ],
};

const T_JUNCTION_EAST: RoadPattern = {
  id: 't_junction_east', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    // 水平道路は東側 2 cells でのみ
    { gridLine: 1, startCell: 2, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // row 1 のみ (row 0 は merge されている)
    { gridLine: 1, startCell: 1, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 1, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'shop_parasol_row', 'merged_right', 'cafe_bookstore_row', 'merged_right' ],
    [ 'house_garage', 'house_trio_garden', 'house_konbini', 'garden_shed' ],
  ],
  merges: [
    { row: 0, col: 0, spanCols: 2 },
    { row: 0, col: 2, spanCols: 2 },
  ],
};

const STAGGERED: RoadPattern = {
  id: 'staggered', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // 上下で異なる縦通り配置 (ジグザグ)
    { gridLine: 1, startCell: 1, endCell: 2, cls: 'street' }, // row 1 のみ
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' }, // 全行
    { gridLine: 3, startCell: 0, endCell: 1, cls: 'street' }, // row 0 のみ
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'ramen_izakaya', 'house_garage' ],
    [ 'bank_post', 'cafe_bookstore_row', 'shrine_complex', 'temple_garden' ],
  ],
};

const DIAGONAL_SPLIT: RoadPattern = {
  id: 'diagonal_split', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 1, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'gas_station_corner', 'house_konbini', 'laundromat_pharmacy', 'house_garage' ],
    [ 'townhouse_row', 'merged_right', 'ramen_izakaya', 'garden_shed' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

const DENSE_ALLEY: RoadPattern = {
  id: 'dense_alley', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // row 0 のみ (row 1 は merged)
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' }, // 2 merges の境界は両行
    { gridLine: 3, startCell: 0, endCell: 1, cls: 'street' },
  ],
  cells: [
    [ 'ramen_izakaya', 'konbini_corner', 'florist_bakery', 'cafe_bookstore' ],
    [ 'shotengai_food', 'merged_right', 'shotengai_game', 'merged_right' ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
  ],
};

const PARK_BREAK: RoadPattern = {
  id: 'park_break', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [],  // 中に道路なし (公園)
  verticalRoads: [],    // 縦通りもなし
  cells: [
    [ null, null, null, null ],
    [ null, null, null, null ],
  ],
};

const OFFICE_DISTRICT: RoadPattern = {
  id: 'office_district', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    // row 0 と row 1 で一部異なる (row 1 の merge 内部は除外)
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' }, // row 0 のみ (row 1 merge 内部)
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' }, // 両行 (merge 境界)
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' }, // 両行
  ],
  cells: [
    [ 'bank_post', 'cafe_bookstore_row', 'shop_parasol_row', 'laundromat_pharmacy' ],
    [ 'office_tower_group', 'merged_right', 'clock_tower_trio', 'water_tower_apartment' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

const SUBURBAN_CALM: RoadPattern = {
  id: 'suburban_calm', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // 縦通り少なめ (住宅街)
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'garden_shed' ],
    [ 'townhouse_row', 'mansion_shop', 'house_trio_garden', 'house_konbini' ],
  ],
};

const CAMPUS_DISTRICT: RoadPattern = {
  id: 'campus_district', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'cafe_bookstore_row', 'house_konbini', 'garden_shed' ],
    [ 'university_campus', 'merged_right', 'clock_tower_trio', 'water_tower_apartment' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

const ENTERTAINMENT_BLOCK: RoadPattern = {
  id: 'entertainment_block', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 1, cls: 'street' },
  ],
  cells: [
    [ 'ramen_izakaya', 'florist_bakery', 'cafe_bookstore', 'house_konbini' ],
    [ 'amusement_complex', 'merged_right', 'shopping_mall_plaza', 'merged_right' ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
  ],
};

export const CHUNK_PATTERNS: RoadPattern[] = [
  FULL_GRID,
  PLAZA_CENTER,
  T_JUNCTION_WEST,
  T_JUNCTION_EAST,
  STAGGERED,
  DIAGONAL_SPLIT,
  DENSE_ALLEY,
  PARK_BREAK,
  OFFICE_DISTRICT,
  SUBURBAN_CALM,
  CAMPUS_DISTRICT,
  ENTERTAINMENT_BLOCK,
];
