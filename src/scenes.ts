/**
 * scenes.ts — ミニチュアジオラマ用のシーンライブラリ
 *
 * 各 Scene は「建物 + 周辺家具」を一つの意味的単位としてまとめたもの。
 * dx は scene の左端 (localX=0) を基準にした建物・家具の中心X位置。
 * dy は baseY を基準にした家具の中心Y位置 (建物の y は常に baseY = 0)。
 *
 * tier は建物高さの上限制約:
 *   'bot'  : h ≤ 22 (下段 3 列用)
 *   'mid'  : h ≤ 30 (中段 手前列用)
 *   'midB' : h ≤ 32 (中段 奥列用)
 *   'top'  : h ≤ 90 (上段 ランドマーク)
 */

import type { FurnitureType, VehicleType } from './entities';
import type { BuildingSize } from './constants';

export type SceneTier = 'bot' | 'mid' | 'midB' | 'top';

export interface SceneBuilding {
  dx: number;          // scene 左端からのセンターX
  dy?: number;         // scene baseY からの Y オフセット (undefined=0、奥行き表現に使用)
  size: BuildingSize;
}

export interface SceneFurniture {
  dx: number;
  dy: number;          // baseY からのオフセット
  type: FurnitureType;
}

export interface SceneParkedVehicle {
  dx: number;
  dy: number;
  type: VehicleType;
}

export interface Scene {
  id: string;
  tier: SceneTier;
  width: number;
  buildings: SceneBuilding[];
  furniture: SceneFurniture[];
  parkedVehicles?: SceneParkedVehicle[];
}

// ─────────────────────────────────────────────────────────────────
// ★ BOT tier scenes — 住宅街 (max h=22)
// ─────────────────────────────────────────────────────────────────

const BOT_SCENES: Scene[] = [
  // 一戸建て3軒 + 庭 + 裏庭の木立 (ジオラマ風 3 層構成)
  {
    id: 'house_trio_garden', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },
      { dx: 28, dy: 0,  size: 'house' },
      { dx: 48, dy: 0,  size: 'house' },
      { dx: 18, dy: 30, size: 'shed' },      // 裏の物置
      { dx: 40, dy: 28, size: 'shed' },      // 隣の裏庭にも
    ],
    furniture: [
      // 前庭 (dy 0-5)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  8, dy: 4, type: 'flower_bed' },
      { dx: 18, dy: 3, type: 'planter' },
      { dx: 28, dy: 4, type: 'flower_bed' },
      { dx: 38, dy: 3, type: 'planter' },
      { dx: 48, dy: 4, type: 'flower_bed' },
      { dx: 58, dy: 1, type: 'hedge' },
      // 家の間の路地 (dy 8-15)
      { dx: 18, dy: 12, type: 'bush' },
      { dx: 38, dy: 12, type: 'bush' },
      // 裏庭の中層 (dy 18-28)
      { dx:  8, dy: 22, type: 'tree' },
      { dx: 28, dy: 20, type: 'bush' },
      { dx: 48, dy: 22, type: 'tree' },
      // 電柱と背景木 (dy 35-45)
      { dx: -2, dy: 38, type: 'power_pole' },
      { dx: 30, dy: 42, type: 'sakura_tree' },
      { dx: 58, dy: 38, type: 'power_pole' },
    ],
  },

  // 住宅 + 角コンビニ (コンビニ前の自販機群 + 裏に住宅街)
  {
    id: 'house_konbini', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },       // 前列の家
      { dx: 32, dy: 0,  size: 'convenience' }, // 前列のコンビニ
      { dx: 20, dy: 30, size: 'shed' },        // 裏の物置
      { dx: 42, dy: 28, size: 'house' },       // 裏の家
    ],
    furniture: [
      // 前列
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 3, type: 'flower_bed' },
      { dx: 46, dy: 3, type: 'vending' },
      { dx: 50, dy: 3, type: 'newspaper_stand' },
      { dx: 54, dy: 3, type: 'garbage' },
      { dx: 32, dy: 5, type: 'sign_board' },
      // コンビニ側の自転車
      { dx: 26, dy: 5, type: 'bicycle_rack' },
      // 中層
      { dx:  8, dy: 14, type: 'bush' },
      { dx: 32, dy: 14, type: 'atm' },
      // 裏庭
      { dx:  0, dy: 25, type: 'tree' },
      { dx: 12, dy: 40, type: 'power_pole' },
      { dx: 34, dy: 42, type: 'tree' },
      { dx: 56, dy: 38, type: 'power_pole' },
    ],
  },

  // 一戸建て + ガレージ (駐車中の車、裏庭に物置と家庭菜園)
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },
      { dx: 30, dy: 0,  size: 'garage' },
      { dx: 40, dy: 30, size: 'greenhouse' }, // 裏のビニールハウス (家庭菜園)
      { dx: 10, dy: 32, size: 'shed' },
    ],
    furniture: [
      // 前庭
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 3, type: 'flower_bed' },
      { dx: 48, dy: 1, type: 'hedge' },
      { dx: 20, dy: 4, type: 'planter' },
      // 玄関側の生活感
      { dx:  8, dy: 6, type: 'bicycle' },
      // 中層
      { dx: 18, dy: 14, type: 'bush' },
      { dx: 30, dy: 14, type: 'garbage' },
      // 裏庭
      { dx: 24, dy: 24, type: 'flower_bed' },
      { dx: -2, dy: 40, type: 'power_pole' },
      { dx: 18, dy: 42, type: 'tree' },
      { dx: 48, dy: 40, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 30, dy: 1, type: 'car' },
    ],
  },

  // 郊外の家庭菜園 (物置 + ビニールハウス + 畑)
  {
    id: 'garden_shed', tier: 'bot', width: 44,
    buildings: [
      { dx: 8,  dy: 0,  size: 'shed' },
      { dx: 29, dy: 0,  size: 'greenhouse' },
      { dx: 16, dy: 30, size: 'greenhouse' }, // 奥の小さめハウス
      { dx: 38, dy: 32, size: 'shed' },
    ],
    furniture: [
      // 前庭の畑 (花壇で表現)
      { dx: -2, dy: 1, type: 'bush' },
      { dx:  4, dy: 4, type: 'flower_bed' },
      { dx: 15, dy: 3, type: 'planter' },
      { dx: 20, dy: 4, type: 'flower_bed' },
      { dx: 42, dy: 3, type: 'flower_bed' },
      { dx: 46, dy: 1, type: 'bush' },
      // 中層: 水道と植栽
      { dx:  8, dy: 13, type: 'bush' },
      { dx: 29, dy: 14, type: 'planter' },
      // 裏: 畑と木々
      { dx: 30, dy: 22, type: 'flower_bed' },
      { dx:  2, dy: 42, type: 'tree' },
      { dx: 22, dy: 44, type: 'pine_tree' },
      { dx: 44, dy: 42, type: 'tree' },
    ],
  },

  // 角のコンビニ (自販機・ATM・自転車ラック + 裏駐車場)
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy: 0,  size: 'convenience' },
      { dx: 30, dy: 32, size: 'shed' }, // 裏の倉庫
    ],
    furniture: [
      // 店頭
      { dx: -2, dy: 3, type: 'vending' },
      { dx:  3, dy: 3, type: 'atm' },
      { dx: 14, dy: 5, type: 'sign_board' },
      { dx: 24, dy: 3, type: 'newspaper_stand' },
      { dx: 28, dy: 3, type: 'garbage' },
      { dx: 33, dy: 3, type: 'bicycle_rack' },
      { dx: 38, dy: 3, type: 'post_box' },
      // 客
      { dx:  8, dy: 6, type: 'bicycle' },
      // 中層: 屋根の設備
      { dx: 14, dy: 14, type: 'electric_box' },
      // 裏
      { dx:  6, dy: 24, type: 'dumpster' },
      { dx: 10, dy: 42, type: 'power_pole' },
      { dx: 20, dy: 42, type: 'tree' },
      { dx: 38, dy: 40, type: 'power_pole' },
    ],
  },

  // ラーメン + 居酒屋 (提灯とパラソルで夜の匂い、裏に物置)
  {
    id: 'ramen_izakaya', tier: 'bot', width: 50,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 34, dy: 0,  size: 'izakaya' },
      { dx: 22, dy: 32, size: 'shed' }, // 裏の倉庫
    ],
    furniture: [
      // 店前の賑わい
      { dx: -1, dy: 3, type: 'parasol' },
      { dx:  4, dy: 5, type: 'sign_board' },
      { dx: 10, dy: 6, type: 'banner_pole' },
      { dx: 21, dy: 3, type: 'vending' },
      { dx: 26, dy: 5, type: 'sign_board' },
      { dx: 34, dy: 3, type: 'parasol' },
      { dx: 40, dy: 6, type: 'banner_pole' },
      { dx: 48, dy: 3, type: 'garbage' },
      // 客
      { dx: 16, dy: 6, type: 'bicycle' },
      // 中層
      { dx: 10, dy: 14, type: 'electric_box' },
      { dx: 34, dy: 14, type: 'bush' },
      // 裏手 (dumpster と配送用)
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 42, dy: 24, type: 'recycling_bin' },
      { dx:  0, dy: 42, type: 'power_pole' },
      { dx: 50, dy: 42, type: 'power_pole' },
      { dx: 26, dy: 44, type: 'sakura_tree' },
    ],
  },

  // 花屋 + パン屋 (花と焼きたての香り、裏はスタッフ駐車場)
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx: 8,  dy: 0,  size: 'florist' },
      { dx: 26, dy: 0,  size: 'bakery' },
      { dx: 18, dy: 32, size: 'shed' },
    ],
    furniture: [
      // 店頭
      { dx: -2, dy: 3, type: 'flower_bed' },
      { dx:  2, dy: 4, type: 'planter' },
      { dx:  8, dy: 4, type: 'parasol' },
      { dx: 14, dy: 5, type: 'sign_board' },
      { dx: 20, dy: 4, type: 'flower_bed' },
      { dx: 26, dy: 4, type: 'parasol' },
      { dx: 32, dy: 5, type: 'sign_board' },
      { dx: 38, dy: 3, type: 'planter' },
      // 客
      { dx:  4, dy: 7, type: 'bicycle' },
      // 中層
      { dx:  8, dy: 14, type: 'bush' },
      { dx: 26, dy: 14, type: 'vending' },
      // 裏手
      { dx:  0, dy: 24, type: 'garbage' },
      { dx: 36, dy: 24, type: 'recycling_bin' },
      { dx: -2, dy: 40, type: 'power_pole' },
      { dx: 20, dy: 42, type: 'sakura_tree' },
      { dx: 40, dy: 40, type: 'power_pole' },
    ],
  },

  // ガソリンスタンド (ポンプ + 看板 + 洗車スペース、裏に整備小屋)
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy: 0,  size: 'gas_station' },
      { dx: 36, dy: 30, size: 'shed' }, // 整備小屋
    ],
    furniture: [
      // 給油所
      { dx: -1, dy: 2, type: 'bollard' },
      { dx:  2, dy: 5, type: 'sign_board' }, // 価格表示
      { dx: 16, dy: 6, type: 'banner_pole' },
      { dx: 34, dy: 2, type: 'bollard' },
      { dx: 42, dy: 5, type: 'sign_board' },
      { dx: 38, dy: 3, type: 'fire_extinguisher' },
      // 洗車エリア
      { dx: 42, dy: 3, type: 'vending' },
      // 中層
      { dx: 16, dy: 14, type: 'bollard' },
      // 裏
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 20, dy: 24, type: 'garbage' },
      { dx:  0, dy: 40, type: 'power_pole' },
      { dx: 18, dy: 42, type: 'tree' },
      { dx: 46, dy: 40, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 16, dy: 1, type: 'car' },
    ],
  },

  // コインランドリー + 薬局 (生活感のある商店、裏手に自転車置き場)
  {
    id: 'laundromat_pharmacy', tier: 'bot', width: 46,
    buildings: [
      { dx: 10, dy: 0,  size: 'laundromat' },
      { dx: 33, dy: 0,  size: 'pharmacy' },
      { dx: 20, dy: 30, size: 'shed' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy: 4, type: 'sign_board' },
      { dx:  4, dy: 3, type: 'bench' },      // 待ちベンチ
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 16, dy: 3, type: 'vending' },
      { dx: 22, dy: 5, type: 'sign_board' },
      { dx: 33, dy: 5, type: 'sign_board' },
      { dx: 40, dy: 3, type: 'planter' },
      { dx: 46, dy: 3, type: 'bench' },
      // 中層
      { dx: 10, dy: 13, type: 'bicycle_rack' },
      { dx: 33, dy: 14, type: 'bush' },
      // 裏
      { dx:  2, dy: 24, type: 'garbage' },
      { dx: 44, dy: 24, type: 'recycling_bin' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 38, dy: 42, type: 'tree' },
      { dx: 48, dy: 40, type: 'power_pole' },
    ],
  },

  // カフェ + 古本屋 (落ち着いた通り、裏にオーナーの物置)
  {
    id: 'cafe_bookstore', tier: 'bot', width: 44,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 33, dy: 0,  size: 'bookstore' },
      { dx: 22, dy: 32, size: 'shed' },
    ],
    furniture: [
      // 店頭テラス
      { dx: -1, dy: 3, type: 'parasol' },
      { dx:  4, dy: 3, type: 'bench' },
      { dx: 10, dy: 4, type: 'sign_board' },
      { dx: 16, dy: 3, type: 'planter' },
      { dx: 22, dy: 3, type: 'bench' },
      { dx: 28, dy: 3, type: 'newspaper_stand' },
      { dx: 33, dy: 5, type: 'sign_board' },
      { dx: 44, dy: 3, type: 'planter' },
      // 客
      { dx:  6, dy: 6, type: 'bicycle' },
      // 中層
      { dx: 10, dy: 14, type: 'bush' },
      { dx: 33, dy: 14, type: 'bush' },
      // 裏
      { dx:  2, dy: 24, type: 'garbage' },
      { dx: -2, dy: 40, type: 'power_pole' },
      { dx: 22, dy: 44, type: 'sakura_tree' },
      { dx: 46, dy: 40, type: 'power_pole' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ MID tier scenes — 商店街 (max h=30 front, h=32 back for midB)
// ─────────────────────────────────────────────────────────────────

const MID_SCENES: Scene[] = [
  // 商店街・飲食 (4軒並び、アーケード風、裏通りに倉庫と自転車)
  {
    id: 'shotengai_food', tier: 'mid', width: 74,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 28, dy: 0,  size: 'izakaya' },
      { dx: 47, dy: 0,  size: 'cafe' },
      { dx: 64, dy: 0,  size: 'bakery' },
      { dx: 20, dy: 34, size: 'shed' },       // 裏の倉庫
      { dx: 54, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 店前の通り (提灯・看板が密集)
      { dx:  1, dy: 3, type: 'parasol' },
      { dx:  5, dy: 5, type: 'sign_board' },
      { dx: 10, dy: 6, type: 'banner_pole' },
      { dx: 18, dy: 5, type: 'sign_board' },
      { dx: 22, dy: 3, type: 'vending' },
      { dx: 28, dy: 6, type: 'banner_pole' },
      { dx: 38, dy: 3, type: 'parasol' },
      { dx: 42, dy: 5, type: 'sign_board' },
      { dx: 47, dy: 6, type: 'banner_pole' },
      { dx: 56, dy: 5, type: 'sign_board' },
      { dx: 60, dy: 3, type: 'vending' },
      { dx: 64, dy: 6, type: 'banner_pole' },
      { dx: 72, dy: 3, type: 'parasol' },
      // 自転車
      { dx: 14, dy: 7, type: 'bicycle' },
      { dx: 50, dy: 7, type: 'bicycle' },
      // 中層 (街灯と看板のアーチ)
      { dx:  8, dy: 16, type: 'street_lamp' },
      { dx: 30, dy: 16, type: 'street_lamp' },
      { dx: 52, dy: 16, type: 'street_lamp' },
      { dx: 70, dy: 16, type: 'street_lamp' },
      // 裏通り
      { dx:  4, dy: 26, type: 'dumpster' },
      { dx: 38, dy: 26, type: 'recycling_bin' },
      { dx: 70, dy: 26, type: 'dumpster' },
      { dx:  0, dy: 42, type: 'power_pole' },
      { dx: 36, dy: 44, type: 'sakura_tree' },
      { dx: 74, dy: 42, type: 'power_pole' },
    ],
  },

  // 娯楽街 (パチンコ + ゲーセン、ネオン街、裏に駐車場)
  {
    id: 'shotengai_game', tier: 'mid', width: 66,
    buildings: [
      { dx: 15, dy: 0,  size: 'pachinko' },
      { dx: 50, dy: 0,  size: 'game_center' },
      { dx: 32, dy: 34, size: 'shed' }, // 裏の倉庫
    ],
    furniture: [
      // ド派手な店頭
      { dx:  1, dy: 6, type: 'banner_pole' },
      { dx:  4, dy: 4, type: 'sign_board' },
      { dx: 15, dy: 6, type: 'banner_pole' },
      { dx: 28, dy: 4, type: 'sign_board' },
      { dx: 32, dy: 3, type: 'bicycle_rack' },
      { dx: 36, dy: 4, type: 'vending' },
      { dx: 50, dy: 6, type: 'banner_pole' },
      { dx: 60, dy: 4, type: 'sign_board' },
      { dx: 65, dy: 6, type: 'banner_pole' },
      // 常連客の自転車
      { dx:  6, dy: 7, type: 'bicycle' },
      { dx: 42, dy: 7, type: 'bicycle' },
      { dx: 58, dy: 7, type: 'bicycle' },
      // 中層の街灯
      { dx:  6, dy: 18, type: 'street_lamp' },
      { dx: 32, dy: 18, type: 'street_lamp' },
      { dx: 60, dy: 18, type: 'street_lamp' },
      // 裏通り
      { dx:  4, dy: 26, type: 'dumpster' },
      { dx: 60, dy: 26, type: 'dumpster' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 18, dy: 44, type: 'tree' },
      { dx: 48, dy: 44, type: 'tree' },
      { dx: 68, dy: 42, type: 'power_pole' },
    ],
  },

  // カフェ通り (カフェ + 書店 + 薬局) — 落ち着いた路面店
  {
    id: 'cafe_bookstore_row', tier: 'mid', width: 66,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 32, dy: 0,  size: 'bookstore' },
      { dx: 54, dy: 0,  size: 'pharmacy' },
      { dx: 22, dy: 34, size: 'shed' },
      { dx: 48, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 店頭テラス
      { dx: -1, dy: 4, type: 'parasol' },
      { dx:  4, dy: 3, type: 'bench' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 16, dy: 3, type: 'planter' },
      { dx: 22, dy: 3, type: 'newspaper_stand' },
      { dx: 32, dy: 5, type: 'sign_board' },
      { dx: 38, dy: 3, type: 'bench' },
      { dx: 44, dy: 3, type: 'planter' },
      { dx: 54, dy: 5, type: 'sign_board' },
      { dx: 60, dy: 3, type: 'vending' },
      { dx: 65, dy: 4, type: 'parasol' },
      // 自転車
      { dx:  6, dy: 7, type: 'bicycle' },
      { dx: 50, dy: 7, type: 'bicycle' },
      // 中層: 街灯 + 植栽
      { dx: 10, dy: 17, type: 'street_lamp' },
      { dx: 32, dy: 17, type: 'street_lamp' },
      { dx: 54, dy: 17, type: 'street_lamp' },
      // 裏手
      { dx:  0, dy: 26, type: 'garbage' },
      { dx: 66, dy: 26, type: 'recycling_bin' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 34, dy: 44, type: 'sakura_tree' },
      { dx: 68, dy: 42, type: 'power_pole' },
    ],
  },

  // 商店 × 3 (雑貨・レストラン・雑貨) — 賑やかな通り
  {
    id: 'shop_parasol_row', tier: 'mid', width: 72,
    buildings: [
      { dx: 11, dy: 0,  size: 'shop' },
      { dx: 35, dy: 0,  size: 'restaurant' },
      { dx: 59, dy: 0,  size: 'shop' },
      { dx: 24, dy: 34, size: 'shed' },
      { dx: 48, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 店先の賑わい
      { dx:  0, dy: 4, type: 'parasol' },
      { dx:  4, dy: 5, type: 'sign_board' },
      { dx: 11, dy: 6, type: 'banner_pole' },
      { dx: 16, dy: 3, type: 'vending' },
      { dx: 23, dy: 5, type: 'sign_board' },
      { dx: 29, dy: 3, type: 'bench' },
      { dx: 35, dy: 4, type: 'parasol' },
      { dx: 41, dy: 3, type: 'bench' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 52, dy: 3, type: 'newspaper_stand' },
      { dx: 59, dy: 6, type: 'banner_pole' },
      { dx: 65, dy: 5, type: 'sign_board' },
      { dx: 71, dy: 4, type: 'parasol' },
      // 中層
      { dx: 11, dy: 17, type: 'street_lamp' },
      { dx: 35, dy: 17, type: 'street_lamp' },
      { dx: 59, dy: 17, type: 'street_lamp' },
      // 裏
      { dx:  4, dy: 26, type: 'dumpster' },
      { dx: 65, dy: 26, type: 'recycling_bin' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 36, dy: 44, type: 'tree' },
      { dx: 74, dy: 42, type: 'power_pole' },
    ],
  },

  // 長屋通り (タウンハウス × 3) — 昔ながらの住宅通り
  {
    id: 'townhouse_row', tier: 'mid', width: 64,
    buildings: [
      { dx: 10, dy: 0,  size: 'townhouse' },
      { dx: 32, dy: 0,  size: 'townhouse' },
      { dx: 54, dy: 0,  size: 'townhouse' },
      { dx: 20, dy: 34, size: 'shed' },
      { dx: 44, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 前庭
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  4, dy: 4, type: 'flower_bed' },
      { dx: 10, dy: 5, type: 'mailbox' },
      { dx: 16, dy: 3, type: 'planter' },
      { dx: 21, dy: 3, type: 'bicycle' },
      { dx: 26, dy: 4, type: 'flower_bed' },
      { dx: 32, dy: 5, type: 'mailbox' },
      { dx: 38, dy: 3, type: 'planter' },
      { dx: 43, dy: 3, type: 'bicycle_rack' },
      { dx: 48, dy: 4, type: 'flower_bed' },
      { dx: 54, dy: 5, type: 'mailbox' },
      { dx: 65, dy: 1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 16, type: 'bush' },
      { dx: 32, dy: 16, type: 'bush' },
      { dx: 54, dy: 16, type: 'bush' },
      // 裏庭
      { dx:  4, dy: 24, type: 'garbage' },
      { dx: 60, dy: 24, type: 'garbage' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 32, dy: 44, type: 'sakura_tree' },
      { dx: 66, dy: 42, type: 'power_pole' },
    ],
  },

  // 神社 (本殿 + 参道 + 桜と狛犬、奥には鎮守の森)
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy: 0,  size: 'shrine' },      // 本殿
      { dx:  6, dy: 32, size: 'shed' },        // 奥の社務所小屋
      { dx: 62, dy: 32, size: 'shed' },
    ],
    furniture: [
      // 参道入口の桜と狛犬
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 10, dy: 4, type: 'sakura_tree' },
      { dx: 18, dy: 6, type: 'statue' },       // 狛犬左
      { dx: 18, dy: 3, type: 'bamboo_cluster' },
      { dx: 26, dy: 4, type: 'flower_bed' },
      // 本殿前 (灯籠と賽銭箱)
      { dx: 34, dy: 7, type: 'statue' },       // 石灯籠
      { dx: 30, dy: 3, type: 'planter' },
      { dx: 38, dy: 3, type: 'planter' },
      // 参道出口
      { dx: 42, dy: 4, type: 'flower_bed' },
      { dx: 50, dy: 6, type: 'statue' },       // 狛犬右
      { dx: 50, dy: 3, type: 'bamboo_cluster' },
      { dx: 58, dy: 4, type: 'sakura_tree' },
      { dx: 66, dy: 4, type: 'sakura_tree' },
      { dx: 70, dy: 1, type: 'hedge' },
      // 中層: 参道の幟と杉
      { dx: 10, dy: 14, type: 'flag_pole' },
      { dx: 58, dy: 14, type: 'flag_pole' },
      { dx: 20, dy: 16, type: 'pine_tree' },
      { dx: 48, dy: 16, type: 'pine_tree' },
      // 鎮守の森 (背景の杉・桜)
      { dx: -2, dy: 26, type: 'pine_tree' },
      { dx: 34, dy: 24, type: 'bamboo_cluster' },
      { dx: 70, dy: 26, type: 'pine_tree' },
      { dx: 16, dy: 42, type: 'sakura_tree' },
      { dx: 34, dy: 44, type: 'pine_tree' },
      { dx: 52, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 寺 (本堂 + 松の庭 + 石仏、裏山)
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy: 0,  size: 'temple' }, // 本堂
      { dx: 50, dy: 32, size: 'shed' },   // 裏の道具小屋
    ],
    furniture: [
      // 山門手前
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  0, dy: 4, type: 'pine_tree' },
      { dx:  6, dy: 6, type: 'statue' },  // 石仏
      { dx: 10, dy: 3, type: 'planter' },
      // 本堂前の石段・灯籠
      { dx: 14, dy: 4, type: 'flower_bed' },
      { dx: 22, dy: 7, type: 'statue' },  // 大きな石灯籠
      { dx: 30, dy: 4, type: 'flower_bed' },
      // 山門の反対側
      { dx: 38, dy: 3, type: 'planter' },
      { dx: 44, dy: 6, type: 'statue' },  // 石仏
      { dx: 48, dy: 3, type: 'bush' },
      { dx: 56, dy: 4, type: 'pine_tree' },
      { dx: 62, dy: 1, type: 'hedge' },
      // 中層: 枝垂れ桜と松
      { dx:  6, dy: 16, type: 'pine_tree' },
      { dx: 22, dy: 14, type: 'flag_pole' },
      { dx: 44, dy: 16, type: 'sakura_tree' },
      // 裏山 (背景の松林と竹)
      { dx: -2, dy: 26, type: 'pine_tree' },
      { dx: 14, dy: 24, type: 'bamboo_cluster' },
      { dx: 30, dy: 26, type: 'bamboo_cluster' },
      { dx: 62, dy: 26, type: 'pine_tree' },
      { dx:  8, dy: 44, type: 'pine_tree' },
      { dx: 26, dy: 44, type: 'pine_tree' },
      { dx: 50, dy: 44, type: 'pine_tree' },
    ],
  },

  // 医療・保育 (クリニック + 保育園、園庭の遊具と木々)
  {
    id: 'clinic_daycare', tier: 'mid', width: 68,
    buildings: [
      { dx: 13, dy: 0,  size: 'clinic' },
      { dx: 46, dy: 0,  size: 'daycare' },
      { dx: 30, dy: 34, size: 'shed' },
    ],
    furniture: [
      // クリニック前
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  1, dy: 5, type: 'flag_pole' },
      { dx:  6, dy: 4, type: 'bench' },
      { dx: 13, dy: 5, type: 'sign_board' },
      { dx: 20, dy: 4, type: 'flower_bed' },
      // 保育園前
      { dx: 26, dy: 3, type: 'hedge' },
      { dx: 32, dy: 5, type: 'flag_pole' },
      { dx: 38, dy: 4, type: 'bench' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 54, dy: 4, type: 'flower_bed' },
      { dx: 60, dy: 4, type: 'bench' },
      { dx: 68, dy: 1, type: 'hedge' },
      // 駐輪・駐車
      { dx: 13, dy: 7, type: 'bicycle_rack' },
      // 中層: 園庭
      { dx: 13, dy: 15, type: 'bush' },
      { dx: 46, dy: 16, type: 'tree' },
      { dx: 60, dy: 16, type: 'planter' },
      // 裏庭
      { dx:  2, dy: 26, type: 'garbage' },
      { dx: 66, dy: 26, type: 'recycling_bin' },
      { dx:  0, dy: 42, type: 'power_pole' },
      { dx: 16, dy: 44, type: 'sakura_tree' },
      { dx: 50, dy: 44, type: 'tree' },
      { dx: 68, dy: 42, type: 'power_pole' },
    ],
  },

  // 消防署 + 警察署 (公共の柱、交差点の信号機も)
  {
    id: 'fire_police', tier: 'midB', width: 70,
    buildings: [
      { dx: 15, dy: 0,  size: 'fire_station' },
      { dx: 53, dy: 0,  size: 'police_station' },
      { dx: 34, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 消防署前 (バリア + 消火栓)
      { dx: -2, dy: 3, type: 'bollard' },
      { dx:  0, dy: 4, type: 'hydrant' },
      { dx:  8, dy: 4, type: 'bollard' },
      { dx: 15, dy: 6, type: 'flag_pole' },
      { dx: 22, dy: 4, type: 'bollard' },
      { dx: 28, dy: 3, type: 'fire_extinguisher' },
      // 交差点の信号機
      { dx: 34, dy: 5, type: 'traffic_light' },
      { dx: 34, dy: 3, type: 'bollard' },
      // 警察署前
      { dx: 40, dy: 4, type: 'bollard' },
      { dx: 46, dy: 3, type: 'sign_board' },
      { dx: 53, dy: 6, type: 'flag_pole' },
      { dx: 60, dy: 4, type: 'bollard' },
      { dx: 66, dy: 4, type: 'post_box' },
      { dx: 70, dy: 3, type: 'hydrant' },
      // 中層
      { dx: 15, dy: 16, type: 'bush' },
      { dx: 53, dy: 16, type: 'bush' },
      // 裏 (訓練スペース)
      { dx:  0, dy: 26, type: 'dumpster' },
      { dx: 70, dy: 26, type: 'dumpster' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 34, dy: 44, type: 'tree' },
      { dx: 72, dy: 42, type: 'power_pole' },
    ],
  },

  // 銀行 + 郵便局 (金融と公共、ATM と郵便ポスト)
  {
    id: 'bank_post', tier: 'midB', width: 62,
    buildings: [
      { dx: 14, dy: 0,  size: 'bank' },
      { dx: 46, dy: 0,  size: 'post_office' },
      { dx: 30, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 銀行前
      { dx: -2, dy: 3, type: 'bollard' },
      { dx:  2, dy: 4, type: 'atm' },
      { dx:  8, dy: 4, type: 'atm' },
      { dx: 14, dy: 5, type: 'sign_board' },
      { dx: 20, dy: 3, type: 'bench' },
      { dx: 26, dy: 3, type: 'bollard' },
      // 郵便局前
      { dx: 34, dy: 4, type: 'bollard' },
      { dx: 40, dy: 3, type: 'post_box' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 52, dy: 3, type: 'post_box' },
      { dx: 58, dy: 3, type: 'newspaper_stand' },
      { dx: 62, dy: 3, type: 'bollard' },
      // 中層
      { dx: 14, dy: 16, type: 'street_lamp' },
      { dx: 46, dy: 16, type: 'street_lamp' },
      // 裏
      { dx:  0, dy: 26, type: 'garbage' },
      { dx: 62, dy: 26, type: 'recycling_bin' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 30, dy: 44, type: 'tree' },
      { dx: 64, dy: 42, type: 'power_pole' },
    ],
  },

  // 豪邸 + 商店 (黒塀の大きな家と近所の雑貨店)
  {
    id: 'mansion_shop', tier: 'mid', width: 64,
    buildings: [
      { dx: 16, dy: 0,  size: 'mansion' },
      { dx: 49, dy: 0,  size: 'shop' },
      { dx: 16, dy: 34, size: 'shed' },  // 裏の離れ
    ],
    furniture: [
      // 豪邸の前庭 (門 + 松 + 生垣)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'pine_tree' },
      { dx: 10, dy: 3, type: 'bush' },
      { dx: 16, dy: 5, type: 'statue' },  // 玄関の石像
      { dx: 22, dy: 3, type: 'bush' },
      { dx: 28, dy: 4, type: 'pine_tree' },
      { dx: 34, dy: 1, type: 'hedge' },
      // 商店前
      { dx: 40, dy: 3, type: 'planter' },
      { dx: 49, dy: 4, type: 'parasol' },
      { dx: 55, dy: 5, type: 'sign_board' },
      { dx: 62, dy: 3, type: 'vending' },
      // 中層: 庭の奥
      { dx:  4, dy: 14, type: 'sakura_tree' },
      { dx: 16, dy: 16, type: 'flag_pole' }, // 庭の旗竿
      { dx: 26, dy: 14, type: 'bamboo_cluster' },
      { dx: 49, dy: 16, type: 'bush' },
      // 背景: 庭の奥の松林
      { dx:  6, dy: 26, type: 'pine_tree' },
      { dx: 26, dy: 26, type: 'pine_tree' },
      { dx: -2, dy: 42, type: 'power_pole' },
      { dx: 40, dy: 42, type: 'sakura_tree' },
      { dx: 64, dy: 42, type: 'power_pole' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ TOP tier scenes — ランドマーク (max h=90)
// ─────────────────────────────────────────────────────────────────

const TOP_SCENES: Scene[] = [
  // 駅前広場 (駅舎 + タクシープール + バスターミナル + 時計塔)
  {
    id: 'train_station_plaza', tier: 'top', width: 70,
    buildings: [
      { dx: 35, dy: 0,  size: 'train_station' },
      { dx:  8, dy: 46, size: 'shed' },         // 駅裏の倉庫
      { dx: 62, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 広場 (バス停 + 待合ベンチ + 時計台)
      { dx: -1, dy: 5, type: 'bus_stop' },
      { dx:  6, dy: 4, type: 'bench' },
      { dx: 12, dy: 4, type: 'bench' },
      { dx: 18, dy: 3, type: 'newspaper_stand' },
      { dx: 24, dy: 4, type: 'planter' },
      { dx: 30, dy: 3, type: 'flower_bed' },
      { dx: 35, dy: 6, type: 'flag_pole' },   // 駅前の旗竿
      { dx: 40, dy: 3, type: 'flower_bed' },
      { dx: 46, dy: 4, type: 'planter' },
      { dx: 52, dy: 3, type: 'newspaper_stand' },
      { dx: 58, dy: 4, type: 'bench' },
      { dx: 64, dy: 4, type: 'bench' },
      { dx: 71, dy: 5, type: 'bus_stop' },
      // 中層
      { dx:  3, dy: 18, type: 'street_lamp' },
      { dx: 18, dy: 18, type: 'street_lamp' },
      { dx: 35, dy: 22, type: 'statue' },      // 駅前の銅像
      { dx: 52, dy: 18, type: 'street_lamp' },
      { dx: 67, dy: 18, type: 'street_lamp' },
      // 背景: 駅裏の電柱と樹木
      { dx:  0, dy: 28, type: 'electric_box' },
      { dx: 70, dy: 28, type: 'electric_box' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 20, dy: 52, type: 'sakura_tree' },
      { dx: 52, dy: 52, type: 'sakura_tree' },
      { dx: 72, dy: 50, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx:  5, dy: 2, type: 'taxi' },
      { dx: 65, dy: 2, type: 'taxi' },
    ],
  },

  // 中央百貨店 (ショーウィンドウ + 装飾 + 中央噴水)
  {
    id: 'dept_store_plaza', tier: 'top', width: 74,
    buildings: [
      { dx: 37, dy: 0,  size: 'department_store' },
      { dx:  8, dy: 46, size: 'shed' },  // 搬入口の倉庫
      { dx: 66, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 広場の装飾と噴水
      { dx:  2, dy: 5, type: 'street_lamp' },
      { dx:  8, dy: 4, type: 'flower_bed' },
      { dx: 14, dy: 4, type: 'bench' },
      { dx: 20, dy: 5, type: 'banner_pole' },
      { dx: 26, dy: 4, type: 'planter' },
      { dx: 32, dy: 3, type: 'flower_bed' },
      { dx: 37, dy: 7, type: 'fountain' },   // 中央噴水
      { dx: 42, dy: 3, type: 'flower_bed' },
      { dx: 48, dy: 4, type: 'planter' },
      { dx: 54, dy: 5, type: 'banner_pole' },
      { dx: 60, dy: 4, type: 'bench' },
      { dx: 66, dy: 4, type: 'flower_bed' },
      { dx: 72, dy: 5, type: 'street_lamp' },
      // 中層
      { dx: 14, dy: 18, type: 'statue' },
      { dx: 37, dy: 18, type: 'banner_pole' },
      { dx: 60, dy: 18, type: 'statue' },
      // 背景
      { dx:  0, dy: 28, type: 'electric_box' },
      { dx: 74, dy: 28, type: 'electric_box' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 24, dy: 52, type: 'sakura_tree' },
      { dx: 50, dy: 52, type: 'sakura_tree' },
      { dx: 76, dy: 50, type: 'power_pole' },
    ],
  },

  // 総合病院 (救急車駐車 + 正面ロータリー + 裏の職員駐車場)
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, dy: 0,  size: 'hospital' },
      { dx: 56, dy: 46, size: 'shed' },  // 裏の設備棟
    ],
    furniture: [
      // 正面ロータリー
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'flower_bed' },
      { dx:  8, dy: 5, type: 'flag_pole' },
      { dx: 14, dy: 3, type: 'planter' },
      { dx: 20, dy: 4, type: 'bench' },
      { dx: 27, dy: 5, type: 'sign_board' },
      { dx: 34, dy: 4, type: 'bench' },
      { dx: 40, dy: 3, type: 'planter' },
      { dx: 46, dy: 5, type: 'flag_pole' },
      // 救急車動線
      { dx: 50, dy: 3, type: 'bollard' },
      { dx: 56, dy: 3, type: 'bollard' },
      { dx: 62, dy: 3, type: 'hydrant' },
      { dx: 66, dy: 1, type: 'hedge' },
      // 中層 (植栽帯)
      { dx:  4, dy: 16, type: 'bush' },
      { dx: 27, dy: 20, type: 'statue' },  // 創設者像
      { dx: 50, dy: 16, type: 'bush' },
      // 背景: 職員駐車場の樹木
      { dx:  0, dy: 28, type: 'electric_box' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 20, dy: 52, type: 'tree' },
      { dx: 40, dy: 52, type: 'sakura_tree' },
      { dx: 68, dy: 50, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 58, dy: 2, type: 'ambulance' },
    ],
  },

  // 学校 (校舎 + 校庭 + 桜並木 + 体育館)
  {
    id: 'school_grounds', tier: 'top', width: 74,
    buildings: [
      { dx: 36, dy: 0,  size: 'school' },
      { dx:  8, dy: 46, size: 'shed' },  // 体育倉庫
      { dx: 64, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 校門 + 桜並木
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 10, dy: 5, type: 'flag_pole' },
      { dx: 14, dy: 3, type: 'bush' },
      { dx: 22, dy: 4, type: 'sakura_tree' },
      { dx: 30, dy: 4, type: 'flower_bed' },
      { dx: 36, dy: 5, type: 'sign_board' },
      { dx: 44, dy: 4, type: 'flower_bed' },
      { dx: 52, dy: 4, type: 'sakura_tree' },
      { dx: 60, dy: 3, type: 'bush' },
      { dx: 66, dy: 5, type: 'flag_pole' },
      { dx: 72, dy: 4, type: 'sakura_tree' },
      { dx: 74, dy: 1, type: 'hedge' },
      // 駐輪場
      { dx: 36, dy: 7, type: 'bicycle_rack' },
      // 中層: 校庭の遊具・像
      { dx: 10, dy: 18, type: 'statue' },  // 二宮金次郎
      { dx: 36, dy: 20, type: 'bush' },
      { dx: 60, dy: 18, type: 'planter' },
      // 背景: 裏山
      { dx:  0, dy: 28, type: 'pine_tree' },
      { dx: 74, dy: 28, type: 'pine_tree' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 20, dy: 52, type: 'tree' },
      { dx: 50, dy: 52, type: 'tree' },
      { dx: 76, dy: 50, type: 'power_pole' },
    ],
  },

  // 市役所 (噴水広場 + 旗竿 + 銅像、左右対称)
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy: 0,  size: 'city_hall' },
      { dx:  6, dy: 46, size: 'shed' },  // 資料庫
      { dx: 60, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 前庭広場 (シンメトリー)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 6, type: 'flag_pole' },
      { dx:  6, dy: 4, type: 'flower_bed' },
      { dx: 12, dy: 5, type: 'statue' },
      { dx: 18, dy: 4, type: 'bench' },
      { dx: 24, dy: 4, type: 'planter' },
      { dx: 32, dy: 7, type: 'fountain' },   // 中央噴水
      { dx: 40, dy: 4, type: 'planter' },
      { dx: 46, dy: 4, type: 'bench' },
      { dx: 52, dy: 5, type: 'statue' },
      { dx: 58, dy: 4, type: 'flower_bed' },
      { dx: 62, dy: 6, type: 'flag_pole' },
      { dx: 70, dy: 4, type: 'planter' },
      { dx: 72, dy: 1, type: 'hedge' },
      // 中層: 広場の街灯
      { dx: 12, dy: 18, type: 'street_lamp' },
      { dx: 32, dy: 20, type: 'banner_pole' },
      { dx: 52, dy: 18, type: 'street_lamp' },
      // 背景: 裏の庭園
      { dx:  2, dy: 28, type: 'pine_tree' },
      { dx: 62, dy: 28, type: 'pine_tree' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 20, dy: 52, type: 'sakura_tree' },
      { dx: 44, dy: 52, type: 'sakura_tree' },
      { dx: 74, dy: 50, type: 'power_pole' },
    ],
  },

  // オフィス街 (3 棟のタワー、歩道に電気設備、2-cell merged 専用)
  {
    id: 'office_tower_group', tier: 'top', width: 100,
    buildings: [
      { dx: 15, dy: 0,  size: 'office' },
      { dx: 48, dy: 0,  size: 'skyscraper' },
      { dx: 82, dy: 0,  size: 'tower' },
    ],
    furniture: [
      // ビル前広場
      { dx:  0, dy: 3, type: 'bollard' },
      { dx:  4, dy: 4, type: 'planter' },
      { dx:  9, dy: 3, type: 'bench' },
      { dx: 15, dy: 5, type: 'sign_board' },
      { dx: 22, dy: 3, type: 'bench' },
      { dx: 28, dy: 4, type: 'planter' },
      { dx: 32, dy: 3, type: 'electric_box' },
      { dx: 40, dy: 4, type: 'planter' },
      { dx: 48, dy: 5, type: 'sign_board' },
      { dx: 55, dy: 3, type: 'bench' },
      { dx: 62, dy: 4, type: 'planter' },
      { dx: 68, dy: 3, type: 'bollard' },
      { dx: 75, dy: 3, type: 'bench' },
      { dx: 82, dy: 5, type: 'sign_board' },
      { dx: 90, dy: 4, type: 'planter' },
      { dx: 96, dy: 3, type: 'electric_box' },
      { dx: 100, dy: 3, type: 'bollard' },
      // 中層: 街路樹と街灯
      { dx: 15, dy: 18, type: 'street_lamp' },
      { dx: 32, dy: 18, type: 'tree' },
      { dx: 48, dy: 18, type: 'street_lamp' },
      { dx: 65, dy: 18, type: 'tree' },
      { dx: 82, dy: 18, type: 'street_lamp' },
    ],
  },

  // 時計塔 + 高層マンション (前にロータリー風装飾)
  {
    id: 'clock_tower_trio', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'clock_tower' },
      { dx: 36, dy: 0,  size: 'apartment_tall' },
      { dx: 16, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 時計塔前
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'flower_bed' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 16, dy: 4, type: 'bench' },
      { dx: 22, dy: 3, type: 'planter' },
      { dx: 28, dy: 5, type: 'street_lamp' },
      // マンション前
      { dx: 32, dy: 4, type: 'bush' },
      { dx: 36, dy: 3, type: 'mailbox' },
      { dx: 42, dy: 4, type: 'bicycle_rack' },
      { dx: 48, dy: 4, type: 'planter' },
      { dx: 54, dy: 5, type: 'flag_pole' },
      { dx: 61, dy: 1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 20, type: 'bush' },
      { dx: 36, dy: 22, type: 'bush' },
      // 背景
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 24, dy: 52, type: 'sakura_tree' },
      { dx: 46, dy: 52, type: 'tree' },
      { dx: 62, dy: 50, type: 'power_pole' },
    ],
  },

  // 映画館 (マーキー + 待ち客エリア、裏にスクリーン倉庫)
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'movie_theater' },
      { dx: 50, dy: 40, size: 'shed' },
    ],
    furniture: [
      // マーキー前
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 5, type: 'banner_pole' },
      { dx:  8, dy: 4, type: 'bench' },
      { dx: 14, dy: 3, type: 'newspaper_stand' },
      { dx: 22, dy: 5, type: 'sign_board' },
      { dx: 30, dy: 3, type: 'vending' },
      { dx: 36, dy: 4, type: 'bench' },
      { dx: 42, dy: 4, type: 'planter' },
      { dx: 50, dy: 5, type: 'banner_pole' },
      { dx: 58, dy: 4, type: 'bench' },
      { dx: 65, dy: 5, type: 'sign_board' },
      // 客
      { dx: 16, dy: 7, type: 'bicycle' },
      // 中層: 大看板
      { dx: 22, dy: 22, type: 'banner_pole' },
      { dx: 50, dy: 22, type: 'street_lamp' },
      // 背景
      { dx:  0, dy: 30, type: 'pine_tree' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 22, dy: 52, type: 'tree' },
      { dx: 68, dy: 50, type: 'power_pole' },
    ],
  },

  // 博物館 (前庭の銅像と噴水、松のシンメトリー)
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, dy: 0,  size: 'museum' },
      { dx: 50, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 前庭
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  0, dy: 4, type: 'pine_tree' },
      { dx:  6, dy: 5, type: 'flag_pole' },
      { dx: 12, dy: 4, type: 'flower_bed' },
      { dx: 18, dy: 4, type: 'bench' },
      { dx: 22, dy: 6, type: 'statue' },  // 中央銅像
      { dx: 28, dy: 4, type: 'bench' },
      { dx: 34, dy: 4, type: 'flower_bed' },
      { dx: 40, dy: 5, type: 'flag_pole' },
      { dx: 46, dy: 6, type: 'statue' },
      { dx: 52, dy: 4, type: 'planter' },
      { dx: 58, dy: 4, type: 'pine_tree' },
      { dx: 62, dy: 1, type: 'hedge' },
      // 中層
      { dx:  6, dy: 20, type: 'banner_pole' },
      { dx: 22, dy: 22, type: 'fountain' },
      { dx: 46, dy: 20, type: 'banner_pole' },
      // 背景
      { dx:  0, dy: 32, type: 'pine_tree' },
      { dx: 62, dy: 32, type: 'pine_tree' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 22, dy: 52, type: 'sakura_tree' },
      { dx: 62, dy: 50, type: 'power_pole' },
    ],
  },

  // スーパー (大きな看板 + 広い駐車場 + カート置き場)
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy: 0,  size: 'supermarket' },
      { dx: 58, dy: 40, size: 'shed' },  // 搬入口倉庫
    ],
    furniture: [
      // 店頭
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 3, type: 'bollard' },
      { dx:  8, dy: 4, type: 'vending' },
      { dx: 14, dy: 4, type: 'bicycle_rack' },
      { dx: 20, dy: 6, type: 'sign_board' }, // 大看板
      { dx: 28, dy: 4, type: 'bench' },
      { dx: 34, dy: 3, type: 'recycling_bin' },
      { dx: 40, dy: 3, type: 'bollard' },
      // 駐車場
      { dx: 46, dy: 4, type: 'bollard' },
      { dx: 52, dy: 4, type: 'bollard' },
      { dx: 58, dy: 4, type: 'bollard' },
      { dx: 66, dy: 5, type: 'street_lamp' },
      { dx: 72, dy: 3, type: 'bollard' },
      // 中層
      { dx: 20, dy: 18, type: 'banner_pole' },
      { dx: 58, dy: 18, type: 'street_lamp' },
      // 背景
      { dx: -2, dy: 44, type: 'power_pole' },
      { dx: 20, dy: 52, type: 'tree' },
      { dx: 74, dy: 44, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 46, dy: 1, type: 'car' },
      { dx: 58, dy: 1, type: 'car' },
      { dx: 70, dy: 1, type: 'van' },
    ],
  },

  // スタジアム + 無線塔 (入場口の装飾、2-cell merged 専用)
  {
    id: 'stadium_radio', tier: 'top', width: 90,
    buildings: [
      { dx: 30, dy: 0,  size: 'stadium' },
      { dx: 80, dy: 0,  size: 'radio_tower' },
    ],
    furniture: [
      // 入場エリア
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 5, type: 'banner_pole' },
      { dx:  8, dy: 4, type: 'bench' },
      { dx: 14, dy: 3, type: 'bollard' },
      { dx: 20, dy: 4, type: 'vending' },
      { dx: 30, dy: 6, type: 'sign_board' },
      { dx: 40, dy: 4, type: 'vending' },
      { dx: 46, dy: 3, type: 'bollard' },
      { dx: 52, dy: 4, type: 'bench' },
      { dx: 58, dy: 5, type: 'banner_pole' },
      // 無線塔周辺
      { dx: 64, dy: 4, type: 'electric_box' },
      { dx: 70, dy: 5, type: 'flag_pole' },
      { dx: 76, dy: 4, type: 'bench' },
      { dx: 80, dy: 5, type: 'sign_board' },
      { dx: 86, dy: 4, type: 'electric_box' },
      { dx: 92, dy: 1, type: 'hedge' },
      // 中層
      { dx: 14, dy: 20, type: 'street_lamp' },
      { dx: 30, dy: 22, type: 'banner_pole' },
      { dx: 46, dy: 20, type: 'street_lamp' },
      // 背景
      { dx:  0, dy: 44, type: 'tree' },
      { dx: 30, dy: 46, type: 'sakura_tree' },
      { dx: 92, dy: 44, type: 'tree' },
    ],
  },

  // 遊園地 (観覧車 + 露店 + ベンチ広場)
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'ferris_wheel' },
      { dx: 54, dy: 46, size: 'shed' },  // 倉庫
    ],
    furniture: [
      // 入場エリア
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 5, type: 'banner_pole' },
      { dx:  6, dy: 4, type: 'vending' },
      { dx: 14, dy: 3, type: 'newspaper_stand' },
      { dx: 22, dy: 6, type: 'sign_board' },
      { dx: 30, dy: 3, type: 'bench' },
      { dx: 38, dy: 3, type: 'parasol' },  // 露店
      // 広場 (ベンチと植栽)
      { dx: 46, dy: 4, type: 'bench' },
      { dx: 52, dy: 3, type: 'planter' },
      { dx: 58, dy: 4, type: 'bench' },
      { dx: 62, dy: 3, type: 'flower_bed' },
      { dx: 66, dy: 5, type: 'flag_pole' },
      { dx: 68, dy: 1, type: 'hedge' },
      // 中層
      { dx: 22, dy: 24, type: 'banner_pole' },
      { dx: 54, dy: 22, type: 'street_lamp' },
      // 背景
      { dx:  0, dy: 34, type: 'sakura_tree' },
      { dx: 68, dy: 34, type: 'sakura_tree' },
      { dx: -2, dy: 50, type: 'power_pole' },
      { dx: 54, dy: 52, type: 'tree' },
      { dx: 68, dy: 50, type: 'power_pole' },
    ],
  },

  // 給水塔 + 高層マンション (工業と住宅の混在、設備が散在)
  {
    id: 'water_tower_apartment', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'water_tower' },
      { dx: 42, dy: 0,  size: 'apartment_tall' },
      { dx: 22, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 給水塔周辺 (フェンスと電気設備)
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 3, type: 'electric_box' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 16, dy: 3, type: 'bollard' },
      { dx: 22, dy: 4, type: 'electric_box' },
      // マンション前
      { dx: 28, dy: 3, type: 'bollard' },
      { dx: 34, dy: 4, type: 'bicycle_rack' },
      { dx: 42, dy: 5, type: 'sign_board' },
      { dx: 48, dy: 3, type: 'mailbox' },
      { dx: 54, dy: 4, type: 'bench' },
      { dx: 60, dy: 3, type: 'electric_box' },
      { dx: 62, dy: 1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 22, type: 'electric_box' },
      { dx: 42, dy: 20, type: 'bush' },
      // 背景
      { dx: -2, dy: 34, type: 'power_pole' },
      { dx: 30, dy: 36, type: 'tree' },
      { dx: 62, dy: 34, type: 'power_pole' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// 統合
// ─────────────────────────────────────────────────────────────────

export const SCENES: Map<string, Scene> = new Map(
  [...BOT_SCENES, ...MID_SCENES, ...TOP_SCENES].map(s => [s.id, s])
);

export function getScene(id: string): Scene {
  const s = SCENES.get(id);
  if (!s) throw new Error(`Unknown scene: ${id}`);
  return s;
}

/** tier ごとのシーン id 一覧 (ランダム選択用) */
export const SCENES_BY_TIER: Record<SceneTier, string[]> = {
  bot:  BOT_SCENES.map(s => s.id),
  mid:  MID_SCENES.filter(s => s.tier === 'mid').map(s => s.id),
  midB: MID_SCENES.filter(s => s.tier === 'midB' || s.tier === 'mid').map(s => s.id),
  top:  TOP_SCENES.map(s => s.id),
};
