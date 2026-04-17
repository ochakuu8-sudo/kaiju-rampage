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

// ─────────────────────────────────────────────────────────────────
// ステージ別テーマパターン (コンセプト色の強いレイアウト)
// ─────────────────────────────────────────────────────────────────

// 参道 (ステージ 3 和風): 縦 1 本の太い直線 (鳥居→山門→本堂)、左右は静か
const SHRINE_APPROACH: RoadPattern = {
  id: 'shrine_approach', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    // 中央の参道だけ avenue、他は路地なし
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
  ],
  cells: [
    [ 'house_trio_garden', 'shrine_complex', 'temple_garden', 'garden_shed' ],
    [ 'mansion_shop',      'shrine_complex', 'temple_garden', 'house_trio_garden' ],
  ],
};

// 港湾・工業 (ステージ 4): 広い産業道路の碁盤目、大型施設ベース
const HARBOR_WAREHOUSE: RoadPattern = {
  id: 'harbor_warehouse', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'gas_station_corner', 'laundromat_pharmacy', 'garden_shed',   'house_garage' ],
    [ 'water_tower_apartment', 'merged_right',      'supermarket_front', 'office_tower_group' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

// 夜の繁華街 (ステージ 2): 狭い路地密集 + 中央アーケードの看板店並び
const NEON_ALLEY: RoadPattern = {
  id: 'neon_alley', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'ramen_izakaya',  'konbini_corner', 'ramen_izakaya', 'cafe_bookstore' ],
    [ 'shotengai_game', 'shotengai_food', 'shotengai_game', 'shotengai_food' ],
  ],
};

// テーマパーク広場 (ステージ 5): 中央 2-cell 広場に大型アトラクション、放射状
const PARK_PLAZA_RADIAL: RoadPattern = {
  id: 'park_plaza_radial', weight: 2,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    // 中央 gridLine 2 は省略 (中央広場)
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'ramen_izakaya', 'florist_bakery', 'cafe_bookstore', 'konbini_corner' ],
    [ 'ferris_wheel_zone', 'merged_right', 'stadium_radio',  'merged_right' ],
  ],
  merges: [
    { row: 1, col: 0, spanCols: 2 },
    { row: 1, col: 2, spanCols: 2 },
  ],
};

// GOAL フィナーレ (ステージ 5 最終): 中央に 4-cell の大広場、左右に見送りのアーチ
const GOAL_FINAL: RoadPattern = {
  id: 'goal_final', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [],  // 道路なし (ゴール広場)
  verticalRoads: [],
  cells: [
    [ null, null, null, null ],
    [ null, null, null, null ],
  ],
};

// 住宅街ミックス (ステージ 1): 生活感のある混在、中央メインストリート
const RESIDENTIAL_MIX: RoadPattern = {
  id: 'residential_mix', weight: 3,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'house_trio_garden' ],
    [ 'shopping_mall_plaza', 'merged_right', 'clinic_daycare', 'shop_parasol_row' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

// ─────────────────────────────────────────────────────────────────
// Stage 1 専用パターン — 縦道路 x 座標 (-90, 0, +90) を全 12 チャンクで統一し、
// スクロール中の縦道路が途切れないよう設計する。
// ─────────────────────────────────────────────────────────────────

// s1_suburb_row: 住宅路地。全 3 縦道路を通し、中央だけ avenue。水平は gridLine 1 全幅 street。
const S1_SUBURB_ROW: RoadPattern = {
  id: 's1_suburb_row', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'house_trio_garden' ],
    [ 'house_trio_garden', 'garden_shed', 'house_konbini', 'house_garage' ],
  ],
};

// s1_suburb_row_cross: s1_suburb_row に上端クロス (gridLine 2 全幅) を追加。
// 次チャンク下端 (gridLine 0) と繋ぎ十字路を作る。
const S1_SUBURB_ROW_CROSS: RoadPattern = {
  id: 's1_suburb_row_cross', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'house_trio_garden', 'house_konbini', 'house_garage', 'house_trio_garden' ],
    [ 'townhouse_row', 'merged_right', 'clinic_daycare', 'garden_shed' ],
  ],
  merges: [ { row: 1, col: 0, spanCols: 2 } ],
};

// s1_shopping_street: 商店街。中央 avenue + 脇 street。
const S1_SHOPPING_STREET: RoadPattern = {
  id: 's1_shopping_street', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'cafe_bookstore_row', 'florist_bakery', 'laundromat_pharmacy', 'cafe_bookstore' ],
    [ 'shop_parasol_row', 'ramen_izakaya', 'shotengai_food', 'mansion_shop' ],
  ],
};

// s1_shopping_street_cross: 商店街 + 上端クロス。
const S1_SHOPPING_STREET_CROSS: RoadPattern = {
  id: 's1_shopping_street_cross', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'cafe_bookstore', 'shotengai_game', 'ramen_izakaya', 'florist_bakery' ],
    [ 'shotengai_food', 'shop_parasol_row', 'laundromat_pharmacy', 'mansion_shop' ],
  ],
};

// s1_station_plaza: 駅前広場。row1 中央 2 セル merged で大型モール。
// 両脇 (gridLine 1, 3) の縦道路は row1 の merged 部分だけ外す (row 0 は通す)。
const S1_STATION_PLAZA: RoadPattern = {
  id: 's1_station_plaza', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'avenue' },
  ],
  verticalRoads: [
    // 脇道は row 0 のみ (row 1 の merge を避ける)
    { gridLine: 1, startCell: 0, endCell: 1, cls: 'street' },
    // 中央 avenue は row 1 の merge 境界なので全行通す
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 1, cls: 'street' },
  ],
  cells: [
    [ 'gas_station_corner', 'house_konbini', 'laundromat_pharmacy', 'cafe_bookstore' ],
    [ 'shop_parasol_row', 'shopping_mall_plaza', 'merged_right', 'clinic_daycare' ],
  ],
  merges: [ { row: 1, col: 1, spanCols: 2 } ],
};

// s1_park: 町内公園。中央 avenue のみ通し、両脇は park 用の装飾セル。
// row 1 の中央 2 セルは merged で緑地扱い、両脇のセルに遊具/木を overrides で入れる。
const S1_PARK: RoadPattern = {
  id: 's1_park', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
  ],
  cells: [
    [ 'garden_shed', 'temple_garden', 'merged_right', 'garden_shed' ],
    [ 'house_trio_garden', 'temple_garden', 'merged_right', 'house_trio_garden' ],
  ],
  merges: [
    { row: 0, col: 1, spanCols: 2 },
    { row: 1, col: 1, spanCols: 2 },
  ],
};

// s1_shrine_corner: 神社ブロック。shrine を merged、上端クロスで次チャンクと繋ぐ。
const S1_SHRINE_CORNER: RoadPattern = {
  id: 's1_shrine_corner', weight: 1,
  rows: 2, cols: 4,
  horizontalRoads: [
    { gridLine: 1, startCell: 0, endCell: 4, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 4, cls: 'street' },
  ],
  verticalRoads: [
    { gridLine: 1, startCell: 0, endCell: 2, cls: 'street' },
    { gridLine: 2, startCell: 0, endCell: 2, cls: 'avenue' },
    { gridLine: 3, startCell: 0, endCell: 2, cls: 'street' },
  ],
  cells: [
    [ 'temple_garden', 'shrine_complex', 'merged_right', 'house_trio_garden' ],
    [ 'townhouse_row', 'merged_right', 'ramen_izakaya', 'cafe_bookstore' ],
  ],
  merges: [
    { row: 0, col: 1, spanCols: 2 },
    { row: 1, col: 0, spanCols: 2 },
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
  RESIDENTIAL_MIX,
  NEON_ALLEY,
  SHRINE_APPROACH,
  HARBOR_WAREHOUSE,
  PARK_PLAZA_RADIAL,
  GOAL_FINAL,
  // Stage 1 専用
  S1_SUBURB_ROW,
  S1_SUBURB_ROW_CROSS,
  S1_SHOPPING_STREET,
  S1_SHOPPING_STREET_CROSS,
  S1_STATION_PLAZA,
  S1_PARK,
  S1_SHRINE_CORNER,
];

/** id → RoadPattern の lookup */
export const PATTERN_BY_ID: Record<string, RoadPattern> = Object.fromEntries(
  CHUNK_PATTERNS.map(p => [p.id, p])
);
