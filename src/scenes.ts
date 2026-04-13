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
  // 一戸建て 3 軒 + 小さな裏庭
  {
    id: 'house_trio_garden', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },
      { dx: 28, dy: 0,  size: 'house' },
      { dx: 48, dy: 0,  size: 'house' },
      { dx: 28, dy: 30, size: 'shed' },  // 共用の裏小屋 1 つ
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 4, type: 'flower_bed' },
      { dx: 38, dy: 4, type: 'flower_bed' },
      { dx: 58, dy: 1, type: 'hedge' },
      { dx: 10, dy: 42, type: 'sakura_tree' },  // 裏庭のランドマーク
      { dx: 46, dy: 40, type: 'power_pole' },
    ],
  },

  // 住宅 + 角コンビニ (看板と自販機で境目がわかる)
  {
    id: 'house_konbini', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },
      { dx: 32, dy: 0,  size: 'convenience' },
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 4, type: 'flower_bed' },
      { dx: 32, dy: 5, type: 'sign_board' },
      { dx: 48, dy: 3, type: 'vending' },
      { dx: 54, dy: 3, type: 'bicycle_rack' },
      { dx: 28, dy: 42, type: 'tree' },
    ],
  },

  // 一戸建て + ガレージ (駐車中の車と裏の家庭菜園)
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx: 8,  dy: 0,  size: 'house' },
      { dx: 30, dy: 0,  size: 'garage' },
      { dx: 22, dy: 32, size: 'greenhouse' },  // 裏のビニールハウス
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 4, type: 'flower_bed' },
      { dx: 48, dy: 1, type: 'hedge' },
      { dx: 22, dy: 44, type: 'tree' },
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
    ],
    furniture: [
      { dx: -2, dy: 2, type: 'bush' },
      { dx: 15, dy: 4, type: 'flower_bed' },
      { dx: 44, dy: 2, type: 'bush' },
      { dx: 22, dy: 42, type: 'tree' },
    ],
  },

  // 角のコンビニ (店頭に自販機と自転車)
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy: 0,  size: 'convenience' },
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'vending' },
      { dx: 14, dy: 6, type: 'sign_board' },
      { dx: 28, dy: 3, type: 'garbage' },
      { dx: 34, dy: 3, type: 'bicycle_rack' },
      { dx: 20, dy: 42, type: 'tree' },
    ],
  },

  // ラーメン + 居酒屋 (提灯とパラソルで夜の匂い)
  {
    id: 'ramen_izakaya', tier: 'bot', width: 50,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 34, dy: 0,  size: 'izakaya' },
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 21, dy: 5, type: 'sign_board' },
      { dx: 34, dy: 3, type: 'parasol' },
      { dx: 48, dy: 3, type: 'vending' },
      { dx: 26, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 花屋 + パン屋 (花と焼きたての香り)
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx: 8,  dy: 0,  size: 'florist' },
      { dx: 26, dy: 0,  size: 'bakery' },
    ],
    furniture: [
      { dx: -2, dy: 3, type: 'flower_bed' },
      { dx:  8, dy: 4, type: 'parasol' },
      { dx: 26, dy: 4, type: 'parasol' },
      { dx: 38, dy: 3, type: 'planter' },
      { dx: 20, dy: 42, type: 'sakura_tree' },
    ],
  },

  // ガソリンスタンド (ポンプ + 価格看板)
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy: 0,  size: 'gas_station' },
    ],
    furniture: [
      { dx: -1, dy: 2, type: 'bollard' },
      { dx:  2, dy: 6, type: 'sign_board' },
      { dx: 34, dy: 2, type: 'bollard' },
      { dx: 42, dy: 3, type: 'vending' },
      { dx: 22, dy: 42, type: 'tree' },
    ],
    parkedVehicles: [
      { dx: 16, dy: 1, type: 'car' },
    ],
  },

  // コインランドリー + 薬局
  {
    id: 'laundromat_pharmacy', tier: 'bot', width: 46,
    buildings: [
      { dx: 10, dy: 0,  size: 'laundromat' },
      { dx: 33, dy: 0,  size: 'pharmacy' },
    ],
    furniture: [
      { dx:  0, dy: 3, type: 'bench' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 21, dy: 3, type: 'vending' },
      { dx: 33, dy: 5, type: 'sign_board' },
      { dx: 22, dy: 42, type: 'tree' },
    ],
  },

  // カフェ + 古本屋 (落ち着いた通り)
  {
    id: 'cafe_bookstore', tier: 'bot', width: 44,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 33, dy: 0,  size: 'bookstore' },
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 21, dy: 3, type: 'bench' },
      { dx: 33, dy: 5, type: 'sign_board' },
      { dx: 22, dy: 42, type: 'sakura_tree' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ MID tier scenes — 商店街 (max h=30 front, h=32 back for midB)
// ─────────────────────────────────────────────────────────────────

const MID_SCENES: Scene[] = [
  // 商店街・飲食 (4軒並び、提灯とパラソル)
  {
    id: 'shotengai_food', tier: 'mid', width: 74,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 28, dy: 0,  size: 'izakaya' },
      { dx: 47, dy: 0,  size: 'cafe' },
      { dx: 64, dy: 0,  size: 'bakery' },
    ],
    furniture: [
      { dx:  1, dy: 3, type: 'parasol' },
      { dx: 18, dy: 6, type: 'banner_pole' },
      { dx: 38, dy: 3, type: 'parasol' },
      { dx: 56, dy: 6, type: 'banner_pole' },
      { dx: 72, dy: 3, type: 'parasol' },
      { dx: 36, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 娯楽街 (パチンコ + ゲーセン、ネオンサイン)
  {
    id: 'shotengai_game', tier: 'mid', width: 66,
    buildings: [
      { dx: 15, dy: 0,  size: 'pachinko' },
      { dx: 50, dy: 0,  size: 'game_center' },
    ],
    furniture: [
      { dx: 15, dy: 6, type: 'banner_pole' },
      { dx: 32, dy: 3, type: 'bicycle_rack' },
      { dx: 50, dy: 6, type: 'banner_pole' },
      { dx: 33, dy: 42, type: 'tree' },
    ],
  },

  // カフェ通り (カフェ + 書店 + 薬局)
  {
    id: 'cafe_bookstore_row', tier: 'mid', width: 66,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 32, dy: 0,  size: 'bookstore' },
      { dx: 54, dy: 0,  size: 'pharmacy' },
    ],
    furniture: [
      { dx: -1, dy: 4, type: 'parasol' },
      { dx: 21, dy: 3, type: 'bench' },
      { dx: 43, dy: 5, type: 'street_lamp' },
      { dx: 65, dy: 3, type: 'planter' },
      { dx: 32, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 商店 × 3 (雑貨・レストラン・雑貨)
  {
    id: 'shop_parasol_row', tier: 'mid', width: 72,
    buildings: [
      { dx: 11, dy: 0,  size: 'shop' },
      { dx: 35, dy: 0,  size: 'restaurant' },
      { dx: 59, dy: 0,  size: 'shop' },
    ],
    furniture: [
      { dx:  0, dy: 4, type: 'parasol' },
      { dx: 23, dy: 6, type: 'sign_board' },
      { dx: 35, dy: 4, type: 'parasol' },
      { dx: 46, dy: 6, type: 'sign_board' },
      { dx: 71, dy: 4, type: 'parasol' },
      { dx: 36, dy: 42, type: 'tree' },
    ],
  },

  // 長屋通り (タウンハウス × 3)
  {
    id: 'townhouse_row', tier: 'mid', width: 64,
    buildings: [
      { dx: 10, dy: 0,  size: 'townhouse' },
      { dx: 32, dy: 0,  size: 'townhouse' },
      { dx: 54, dy: 0,  size: 'townhouse' },
    ],
    furniture: [
      { dx: -1, dy: 1, type: 'hedge' },
      { dx: 21, dy: 4, type: 'flower_bed' },
      { dx: 43, dy: 3, type: 'bicycle_rack' },
      { dx: 65, dy: 1, type: 'hedge' },
      { dx: 32, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 神社 (本殿 + 参道の狛犬 + 桜 + 鎮守の森)
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy: 0,  size: 'shrine' },  // 本殿
    ],
    furniture: [
      { dx:  8, dy: 4, type: 'sakura_tree' },
      { dx: 18, dy: 5, type: 'statue' },    // 狛犬左
      { dx: 50, dy: 5, type: 'statue' },    // 狛犬右
      { dx: 60, dy: 4, type: 'sakura_tree' },
      { dx: 34, dy: 42, type: 'pine_tree' },  // 鎮守の森
    ],
  },

  // 寺 (本堂 + 松と石灯籠の庭)
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy: 0,  size: 'temple' },
    ],
    furniture: [
      { dx:  2, dy: 4, type: 'pine_tree' },
      { dx: 22, dy: 5, type: 'statue' },  // 石灯籠
      { dx: 44, dy: 4, type: 'pine_tree' },
      { dx: 62, dy: 2, type: 'bush' },
      { dx: 34, dy: 42, type: 'bamboo_cluster' },  // 裏山の竹林
    ],
  },

  // 医療・保育 (クリニック + 保育園)
  {
    id: 'clinic_daycare', tier: 'mid', width: 68,
    buildings: [
      { dx: 13, dy: 0,  size: 'clinic' },
      { dx: 46, dy: 0,  size: 'daycare' },
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 13, dy: 5, type: 'sign_board' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 68, dy: 1, type: 'hedge' },
      { dx: 32, dy: 42, type: 'sakura_tree' },
    ],
  },

  // 消防署 + 警察署 (公共の柱、交差点の信号機)
  {
    id: 'fire_police', tier: 'midB', width: 70,
    buildings: [
      { dx: 15, dy: 0,  size: 'fire_station' },
      { dx: 53, dy: 0,  size: 'police_station' },
    ],
    furniture: [
      { dx: 15, dy: 6, type: 'flag_pole' },
      { dx: 34, dy: 5, type: 'traffic_light' },
      { dx: 53, dy: 6, type: 'flag_pole' },
      { dx: 34, dy: 42, type: 'tree' },
    ],
  },

  // 銀行 + 郵便局 (ATM と郵便ポスト)
  {
    id: 'bank_post', tier: 'midB', width: 62,
    buildings: [
      { dx: 14, dy: 0,  size: 'bank' },
      { dx: 46, dy: 0,  size: 'post_office' },
    ],
    furniture: [
      { dx:  2, dy: 4, type: 'atm' },
      { dx: 30, dy: 5, type: 'street_lamp' },
      { dx: 40, dy: 4, type: 'post_box' },
      { dx: 30, dy: 42, type: 'tree' },
    ],
  },

  // 豪邸 + 商店 (黒塀の大きな家と近所の雑貨店)
  {
    id: 'mansion_shop', tier: 'mid', width: 64,
    buildings: [
      { dx: 16, dy: 0,  size: 'mansion' },
      { dx: 49, dy: 0,  size: 'shop' },
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'pine_tree' },
      { dx: 34, dy: 1, type: 'hedge' },
      { dx: 49, dy: 4, type: 'parasol' },
      { dx: 16, dy: 42, type: 'sakura_tree' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ TOP tier scenes — ランドマーク (max h=90)
// ─────────────────────────────────────────────────────────────────

const TOP_SCENES: Scene[] = [
  // 駅前広場 (駅舎 + バス停 + タクシープール)
  {
    id: 'train_station_plaza', tier: 'top', width: 70,
    buildings: [
      { dx: 35, dy: 0,  size: 'train_station' },
    ],
    furniture: [
      { dx: -1, dy: 5, type: 'bus_stop' },
      { dx: 15, dy: 4, type: 'bench' },
      { dx: 35, dy: 6, type: 'flag_pole' },
      { dx: 55, dy: 4, type: 'bench' },
      { dx: 71, dy: 5, type: 'bus_stop' },
      { dx: 35, dy: 48, type: 'sakura_tree' },
    ],
    parkedVehicles: [
      { dx:  5, dy: 2, type: 'taxi' },
      { dx: 65, dy: 2, type: 'taxi' },
    ],
  },

  // 中央百貨店 (装飾と中央噴水)
  {
    id: 'dept_store_plaza', tier: 'top', width: 74,
    buildings: [
      { dx: 37, dy: 0,  size: 'department_store' },
    ],
    furniture: [
      { dx:  2, dy: 5, type: 'street_lamp' },
      { dx: 37, dy: 6, type: 'fountain' },
      { dx: 72, dy: 5, type: 'street_lamp' },
      { dx: 37, dy: 48, type: 'banner_pole' },
    ],
  },

  // 総合病院 (救急車 + 正面ロータリー)
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, dy: 0,  size: 'hospital' },
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  8, dy: 5, type: 'flag_pole' },
      { dx: 27, dy: 5, type: 'sign_board' },
      { dx: 66, dy: 1, type: 'hedge' },
      { dx: 27, dy: 48, type: 'tree' },
    ],
    parkedVehicles: [
      { dx: 58, dy: 2, type: 'ambulance' },
    ],
  },

  // 学校 (校舎 + 校門の桜並木)
  {
    id: 'school_grounds', tier: 'top', width: 74,
    buildings: [
      { dx: 36, dy: 0,  size: 'school' },
    ],
    furniture: [
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 10, dy: 5, type: 'flag_pole' },
      { dx: 36, dy: 20, type: 'statue' },     // 二宮金次郎
      { dx: 72, dy: 4, type: 'sakura_tree' },
      { dx: 36, dy: 48, type: 'tree' },
    ],
  },

  // 市役所 (噴水広場のシンメトリー)
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy: 0,  size: 'city_hall' },
    ],
    furniture: [
      { dx:  2, dy: 6, type: 'flag_pole' },
      { dx: 32, dy: 7, type: 'fountain' },
      { dx: 62, dy: 6, type: 'flag_pole' },
      { dx: 32, dy: 48, type: 'pine_tree' },
    ],
  },

  // オフィス街 (3 棟のタワー)
  {
    id: 'office_tower_group', tier: 'top', width: 100,
    buildings: [
      { dx: 15, dy: 0,  size: 'office' },
      { dx: 48, dy: 0,  size: 'skyscraper' },
      { dx: 82, dy: 0,  size: 'tower' },
    ],
    furniture: [
      { dx:  0, dy: 3, type: 'bollard' },
      { dx: 32, dy: 4, type: 'electric_box' },
      { dx: 65, dy: 4, type: 'tree' },
      { dx: 100, dy: 3, type: 'bollard' },
    ],
  },

  // 時計塔 + 高層マンション
  {
    id: 'clock_tower_trio', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'clock_tower' },
      { dx: 36, dy: 0,  size: 'apartment_tall' },
    ],
    furniture: [
      { dx: 20, dy: 5, type: 'street_lamp' },
      { dx: 50, dy: 4, type: 'bench' },
      { dx: 36, dy: 48, type: 'tree' },
    ],
  },

  // 映画館
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'movie_theater' },
    ],
    furniture: [
      { dx:  2, dy: 5, type: 'banner_pole' },
      { dx: 22, dy: 5, type: 'sign_board' },
      { dx: 50, dy: 4, type: 'bench' },
      { dx: 22, dy: 48, type: 'sakura_tree' },
    ],
  },

  // 博物館 (前庭の銅像と松)
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, dy: 0,  size: 'museum' },
    ],
    furniture: [
      { dx:  0, dy: 4, type: 'pine_tree' },
      { dx: 22, dy: 6, type: 'statue' },
      { dx: 58, dy: 4, type: 'pine_tree' },
      { dx: 22, dy: 48, type: 'sakura_tree' },
    ],
  },

  // スーパー (大きな看板 + 駐車場)
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy: 0,  size: 'supermarket' },
    ],
    furniture: [
      { dx: 20, dy: 6, type: 'sign_board' },
      { dx: 40, dy: 3, type: 'bollard' },
      { dx: 72, dy: 3, type: 'bollard' },
      { dx: 56, dy: 42, type: 'tree' },
    ],
    parkedVehicles: [
      { dx: 46, dy: 1, type: 'car' },
      { dx: 58, dy: 1, type: 'car' },
      { dx: 70, dy: 1, type: 'van' },
    ],
  },

  // スタジアム + 無線塔
  {
    id: 'stadium_radio', tier: 'top', width: 90,
    buildings: [
      { dx: 30, dy: 0,  size: 'stadium' },
      { dx: 80, dy: 0,  size: 'radio_tower' },
    ],
    furniture: [
      { dx: -1, dy: 5, type: 'banner_pole' },
      { dx: 30, dy: 6, type: 'sign_board' },
      { dx: 64, dy: 4, type: 'electric_box' },
      { dx: 30, dy: 48, type: 'tree' },
    ],
  },

  // 遊園地 (観覧車 + 広場)
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'ferris_wheel' },
    ],
    furniture: [
      { dx: 22, dy: 6, type: 'sign_board' },
      { dx: 50, dy: 4, type: 'bench' },
      { dx: 65, dy: 5, type: 'flag_pole' },
      { dx: 50, dy: 48, type: 'sakura_tree' },
    ],
  },

  // 給水塔 + 高層マンション
  {
    id: 'water_tower_apartment', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'water_tower' },
      { dx: 42, dy: 0,  size: 'apartment_tall' },
    ],
    furniture: [
      { dx:  2, dy: 3, type: 'electric_box' },
      { dx: 34, dy: 4, type: 'bicycle_rack' },
      { dx: 60, dy: 3, type: 'electric_box' },
      { dx: 30, dy: 42, type: 'tree' },
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
