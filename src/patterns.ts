/**
 * patterns.ts — 道路パターンライブラリ
 *
 * 初期都市用 1 つ + チャンク用パターン。
 * チャンクは 4 rows × 6 cols のグリッド (cellW=60, cellH=60, chunk 高さ=240)。
 * 道路は細身 (street=6, avenue=10) で路地感を演出する。
 *
 * merges は `spanCols` に加えて `spanRows` もサポート。top tier ランドマークは
 * 2×2 merge (120×120 枠) に収容する。
 */

import type { RoadPattern } from './grid';

// ─────────────────────────────────────────────────────────────────
// 初期都市パターン (3 rows × 4 cols、従来どおり cellW=90, cellH=107)
//   ※ cellW/cellH は buildBlock 呼び出し側で別値を渡して維持する
// ─────────────────────────────────────────────────────────────────

export const INITIAL_CITY_PATTERN: RoadPattern = {
  id: 'initial_city',
  weight: 1,
  rows: 3,
  cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 1, endCell: 3, cls: 'street' },
    { gridLine: 2, startCell: 1, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 1, endCell: 3, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'ramen_izakaya', 'house_konbini', 'house_garage' ],
    [ 'shop_parasol_row', 'shrine_complex', 'temple_garden', 'clinic_daycare' ],
    [ 'train_station_plaza', 'dept_store_plaza', null, 'hospital_scene' ],
  ],
  merges: [
    { row: 2, col: 1, spanCols: 2 },
  ],
};

// ─────────────────────────────────────────────────────────────────
// チャンクパターン (6 cols × 4 rows)
// ─────────────────────────────────────────────────────────────────
//
// cellW=60, cellH=60。gridLine index は 0..cols (水平なら 0..rows)。
// 各パターンの cells[row][col] の row 0 = 最下段、row 3 = 最上段。
// 建物シーン id は既存 scenes.ts から参照する:
//   bot (width 40-56): house_*, konbini_corner, ramen_izakaya, gas_station_corner 等
//   mid (width 62-74): 2×1 merge 専用
//   top (width 60-100): 2×2 merge 専用 (ランドマーク)

// ---------------------------------------------------------------
// 1. CITY_BLOCK: 細い十字路 + ランドマーク 1 個 + 連結商店街
// ---------------------------------------------------------------
const CITY_BLOCK: RoadPattern = {
  id: 'city_block', weight: 3,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 6, cls: 'street' },  // 中央
  ],
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },  // 中央縦
  ],
  cells: [
    // row 0 (下段)
    [ 'house_konbini', 'ramen_izakaya', 'house_trio_garden', 'cafe_bookstore', 'house_garage', 'garden_shed' ],
    // row 1
    [ 'shop_parasol_row', null, 'florist_bakery', 'konbini_corner', 'laundromat_pharmacy', 'house_konbini' ],
    // row 2 (ランドマーク 2×2)
    [ 'dept_store_plaza', null, null, null, 'bank_post', null ],
    // row 3 (最上段、ランドマーク上半分)
    [ null, null, null, null, 'clock_tower_trio', null ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },                // 商店街 2×1
    { row: 2, col: 0, spanCols: 2, spanRows: 2 },   // 百貨店 2×2
    { row: 2, col: 4, spanCols: 2 },                // 銀行 2×1
    { row: 3, col: 4, spanCols: 2 },                // 時計塔 2×1
  ],
};

// ---------------------------------------------------------------
// 2. DENSE_GRID: 道路ほぼ無し、建物密度 MAX
// ---------------------------------------------------------------
const DENSE_GRID: RoadPattern = {
  id: 'dense_grid', weight: 3,
  rows: 4, cols: 6,
  horizontalRoads: [],   // 横道路なし
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'garden_shed', 'house_trio_garden', 'house_konbini' ],
    [ 'konbini_corner', 'ramen_izakaya', 'florist_bakery', 'cafe_bookstore', 'laundromat_pharmacy', 'gas_station_corner' ],
    [ 'shotengai_food', null, 'shrine_complex', null, 'clinic_daycare', null ],
    [ 'house_konbini', 'house_garage', 'garden_shed', 'house_konbini', 'mansion_shop', null ],
  ],
  merges: [
    { row: 2, col: 0, spanCols: 2 },  // 商店街
    { row: 2, col: 2, spanCols: 2 },  // 神社
    { row: 2, col: 4, spanCols: 2 },  // クリニック
    { row: 3, col: 4, spanCols: 2 },  // 邸宅
  ],
};

// ---------------------------------------------------------------
// 3. FULL_GRID: 正統派グリッド、縦横道路が走る
// ---------------------------------------------------------------
const FULL_GRID: RoadPattern = {
  id: 'full_grid', weight: 3,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 6, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 6, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'street' },
    { gridLine: 4, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'ramen_izakaya', 'cafe_bookstore', 'house_garage', 'garden_shed' ],
    [ 'konbini_corner', 'florist_bakery', 'gas_station_corner', 'laundromat_pharmacy', 'house_konbini', 'house_trio_garden' ],
    [ 'shop_parasol_row', null, 'shrine_complex', null, 'temple_garden', null ],
    [ 'bank_post', null, 'townhouse_row', null, 'clinic_daycare', null ],
  ],
  merges: [
    { row: 2, col: 0, spanCols: 2 },
    { row: 2, col: 2, spanCols: 2 },
    { row: 2, col: 4, spanCols: 2 },
    { row: 3, col: 0, spanCols: 2 },
    { row: 3, col: 2, spanCols: 2 },
    { row: 3, col: 4, spanCols: 2 },
  ],
};

// ---------------------------------------------------------------
// 4. PLAZA_CENTER: 中央に巨大ランドマーク、周囲に小建物
// ---------------------------------------------------------------
const PLAZA_CENTER: RoadPattern = {
  id: 'plaza_center', weight: 2,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 4, endCell: 6, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'street' },
    { gridLine: 4, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'ramen_izakaya', 'cafe_bookstore', 'house_garage', 'garden_shed' ],
    [ 'konbini_corner', 'house_trio_garden', 'florist_bakery', 'laundromat_pharmacy', 'house_konbini', 'gas_station_corner' ],
    [ 'mansion_shop', null, 'train_station_plaza', null, null, null ],
    [ 'townhouse_row', null, null, null, null, null ],
  ],
  merges: [
    { row: 2, col: 0, spanCols: 2 },
    { row: 3, col: 0, spanCols: 2 },
    { row: 2, col: 2, spanCols: 2, spanRows: 2 },  // ランドマーク 2×2
    { row: 2, col: 4, spanCols: 2, spanRows: 2 },  // ランドマーク 2×2
  ],
};

// ---------------------------------------------------------------
// 5. T_JUNCTION_WEST: 西側 T 字路、商店街ベース
// ---------------------------------------------------------------
const T_JUNCTION_WEST: RoadPattern = {
  id: 't_junction_west', weight: 2,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 3, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_konbini', 'ramen_izakaya', 'house_garage', 'florist_bakery', 'konbini_corner', 'cafe_bookstore' ],
    [ 'shop_parasol_row', null, 'laundromat_pharmacy', 'house_konbini', 'gas_station_corner', 'house_trio_garden' ],
    [ 'shotengai_food', null, 'house_trio_garden', 'garden_shed', 'ramen_izakaya', 'house_konbini' ],
    [ 'dept_store_plaza', null, null, null, 'bank_post', null ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 2, col: 0, spanCols: 2 },
    { row: 3, col: 0, spanCols: 2 },
    { row: 3, col: 4, spanCols: 2 },
  ],
};

// ---------------------------------------------------------------
// 6. T_JUNCTION_EAST: 東側 T 字路
// ---------------------------------------------------------------
const T_JUNCTION_EAST: RoadPattern = {
  id: 't_junction_east', weight: 2,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 3, endCell: 6, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'ramen_izakaya', 'cafe_bookstore', 'house_garage', 'garden_shed' ],
    [ 'konbini_corner', 'florist_bakery', 'house_trio_garden', 'laundromat_pharmacy', null, 'house_konbini' ],
    [ 'house_konbini', 'gas_station_corner', 'ramen_izakaya', 'shotengai_game', null, 'shop_parasol_row' ],
    [ 'clinic_daycare', null, 'temple_garden', null, null, null ],
  ],
  merges: [
    { row: 1, col: 4, spanCols: 2 },
    { row: 2, col: 3, spanCols: 2 },
    { row: 3, col: 0, spanCols: 2 },
    { row: 3, col: 2, spanCols: 2 },
    { row: 3, col: 4, spanCols: 2 },
  ],
};

// ---------------------------------------------------------------
// 7. OFFICE_DISTRICT: オフィス街、大型ビル中心
// ---------------------------------------------------------------
const OFFICE_DISTRICT: RoadPattern = {
  id: 'office_district', weight: 2,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 6, cls: 'avenue' },
  ],
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'gas_station_corner', 'konbini_corner', 'cafe_bookstore', 'laundromat_pharmacy', 'ramen_izakaya', 'florist_bakery' ],
    [ 'bank_post', null, 'cafe_bookstore_row', null, 'shop_parasol_row', null ],
    [ 'office_tower_group', null, null, null, 'clock_tower_trio', null ],
    [ null, null, null, null, null, null ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
    { row: 1, col: 4, spanCols: 2 },
    { row: 2, col: 0, spanCols: 2, spanRows: 2 },
    { row: 2, col: 2, spanCols: 2, spanRows: 2 },
    { row: 2, col: 4, spanCols: 2, spanRows: 2 },
  ],
};

// ---------------------------------------------------------------
// 8. SUBURBAN_CALM: 住宅街、道路少なめ
// ---------------------------------------------------------------
const SUBURBAN_CALM: RoadPattern = {
  id: 'suburban_calm', weight: 2,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 6, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 3, startCell: 0, endCell: 4, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'garden_shed', 'house_trio_garden', 'house_konbini' ],
    [ 'konbini_corner', 'house_garage', 'house_trio_garden', 'garden_shed', 'house_konbini', 'house_trio_garden' ],
    [ 'townhouse_row', null, 'mansion_shop', null, 'house_trio_garden', 'house_konbini' ],
    [ 'clinic_daycare', null, 'shrine_complex', null, 'house_garage', 'garden_shed' ],
  ],
  merges: [
    { row: 2, col: 0, spanCols: 2 },
    { row: 2, col: 2, spanCols: 2 },
    { row: 3, col: 0, spanCols: 2 },
    { row: 3, col: 2, spanCols: 2 },
  ],
};

// ---------------------------------------------------------------
// 9. STATION_HUB: 駅を中心とした密集街
// ---------------------------------------------------------------
const STATION_HUB: RoadPattern = {
  id: 'station_hub', weight: 1,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 6, cls: 'avenue' },
  ],
  verticalRoads: [],
  cells: [
    [ 'ramen_izakaya', 'konbini_corner', 'florist_bakery', 'cafe_bookstore', 'laundromat_pharmacy', 'house_konbini' ],
    [ 'shotengai_food', null, 'shotengai_game', null, 'cafe_bookstore_row', null ],
    [ 'house_garage', 'train_station_plaza', null, 'ferris_wheel_zone', null, 'house_konbini' ],
    [ 'garden_shed', null, null, null, null, 'house_trio_garden' ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
    { row: 1, col: 4, spanCols: 2 },
    { row: 2, col: 1, spanCols: 2, spanRows: 2 },
    { row: 2, col: 3, spanCols: 2, spanRows: 2 },
  ],
};

// ---------------------------------------------------------------
// 10. ENTERTAINMENT: 娯楽街、大型施設
// ---------------------------------------------------------------
const ENTERTAINMENT: RoadPattern = {
  id: 'entertainment', weight: 1,
  rows: 4, cols: 6,
  horizontalRoads: [
    { gridLine: 2, startCell: 0, endCell: 6, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 4, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'ramen_izakaya', 'konbini_corner', 'florist_bakery', 'cafe_bookstore', 'laundromat_pharmacy', 'gas_station_corner' ],
    [ 'house_konbini', 'ramen_izakaya', 'house_trio_garden', 'cafe_bookstore', 'konbini_corner', 'florist_bakery' ],
    [ 'house_garage', 'stadium_radio', null, 'movie_library', null, 'house_trio_garden' ],
    [ 'garden_shed', null, null, null, null, 'house_konbini' ],
  ],
  merges: [
    { row: 2, col: 1, spanCols: 2, spanRows: 2 },
    { row: 2, col: 3, spanCols: 2, spanRows: 2 },
  ],
};

export const CHUNK_PATTERNS: RoadPattern[] = [
  CITY_BLOCK,
  DENSE_GRID,
  FULL_GRID,
  PLAZA_CENTER,
  T_JUNCTION_WEST,
  T_JUNCTION_EAST,
  OFFICE_DISTRICT,
  SUBURBAN_CALM,
  STATION_HUB,
  ENTERTAINMENT,
];
