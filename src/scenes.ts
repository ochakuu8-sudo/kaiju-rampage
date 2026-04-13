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
  // 一戸建て3軒 + 生垣 + 木 + 花壇
  {
    id: 'house_trio_garden', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  size: 'house' },
      { dx: 28, size: 'house' },
      { dx: 48, size: 'house' },
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 3, type: 'tree' },
      { dx: 38, dy: 3, type: 'flower_bed' },
      { dx: 58, dy: 1, type: 'hedge' },
    ],
  },

  // 一戸建て + 角コンビニ
  {
    id: 'house_konbini', tier: 'bot', width: 56,
    buildings: [
      { dx: 8,  size: 'house' },       // edges 0-16
      { dx: 32, size: 'convenience' }, // edges 20-44
    ],
    furniture: [
      { dx: -2, dy: 3, type: 'tree' },
      { dx: 18, dy: 2, type: 'flower_bed' },
      { dx: 48, dy: 3, type: 'vending' },
      { dx: 52, dy: 3, type: 'newspaper_stand' },
      { dx: 56, dy: 3, type: 'bicycle_rack' },
    ],
  },

  // 一戸建て + ガレージ (駐車中の車)
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx: 8,  size: 'house' },  // edges 0-16
      { dx: 30, size: 'garage' }, // edges 20-40
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx: 18, dy: 3, type: 'flower_bed' },
      { dx: 45, dy: 1, type: 'bush' },
    ],
    parkedVehicles: [
      { dx: 30, dy: 1, type: 'car' },
    ],
  },

  // 物置 + ビニールハウス (郊外・農的)
  {
    id: 'garden_shed', tier: 'bot', width: 44,
    buildings: [
      { dx: 8,  size: 'shed' },       // edges 2-14
      { dx: 29, size: 'greenhouse' }, // edges 18-40
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'bush' },
      { dx: 15, dy: 2, type: 'planter' },
      { dx: 42, dy: 3, type: 'flower_bed' },
      { dx: 46, dy: 1, type: 'bush' },
    ],
  },

  // 角コンビニ (自販機・ATM・自転車)
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, size: 'convenience' }, // edges 2-26
    ],
    furniture: [
      { dx: -2, dy: 3, type: 'vending' },
      { dx:  3, dy: 3, type: 'atm' },
      { dx: 28, dy: 3, type: 'garbage' },
      { dx: 33, dy: 3, type: 'newspaper_stand' },
      { dx: 40, dy: 3, type: 'bicycle_rack' },
    ],
  },

  // ラーメン + 居酒屋 (提灯風パラソル)
  {
    id: 'ramen_izakaya', tier: 'bot', width: 50,
    buildings: [
      { dx: 10, size: 'ramen' },   // edges 2-18
      { dx: 34, size: 'izakaya' }, // edges 24-44
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 21, dy: 5, type: 'sign_board' },
      { dx: 34, dy: 3, type: 'parasol' },
      { dx: 48, dy: 3, type: 'vending' },
    ],
  },

  // 花屋 + パン屋
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx: 8,  size: 'florist' }, // w=14, edges 1-15
      { dx: 26, size: 'bakery' },  // w=16, edges 18-34
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 17, dy: 2, type: 'flower_bed' },
      { dx: 38, dy: 3, type: 'parasol' },
    ],
  },

  // ガソリンスタンド
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, size: 'gas_station' }, // w=30, edges 1-31
    ],
    furniture: [
      { dx: -1, dy: 2, type: 'bollard' },
      { dx: 34, dy: 2, type: 'bollard' },
      { dx: 42, dy: 4, type: 'sign_board' },
    ],
    parkedVehicles: [
      { dx: 16, dy: 1, type: 'car' },
    ],
  },

  // ランドリー + 薬局
  {
    id: 'laundromat_pharmacy', tier: 'bot', width: 46,
    buildings: [
      { dx: 10, size: 'laundromat' }, // w=18, edges 1-19
      { dx: 33, size: 'pharmacy' },   // w=20, edges 23-43
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'sign_board' },
      { dx: 21, dy: 3, type: 'bench' },
      { dx: 45, dy: 3, type: 'planter' },
    ],
  },

  // カフェ + 書店 (ブックストア通り)
  {
    id: 'cafe_bookstore', tier: 'bot', width: 44,
    buildings: [
      { dx: 10, size: 'cafe' },      // w=18, edges 1-19
      { dx: 33, size: 'bookstore' }, // w=18, edges 24-42
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 21, dy: 3, type: 'bench' },
      { dx: 44, dy: 3, type: 'newspaper_stand' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ MID tier scenes — 商店街 (max h=30 front, h=32 back for midB)
// ─────────────────────────────────────────────────────────────────

const MID_SCENES: Scene[] = [
  // 商店街・飲食 (4軒並び + パラソル + 看板)
  {
    id: 'shotengai_food', tier: 'mid', width: 74,
    buildings: [
      { dx: 10, size: 'ramen' },   // w=16, edges 2-18
      { dx: 28, size: 'izakaya' }, // w=20, edges 18-38
      { dx: 47, size: 'cafe' },    // w=18, edges 38-56
      { dx: 64, size: 'bakery' },  // w=16, edges 56-72
    ],
    furniture: [
      { dx:  1, dy: 5, type: 'parasol' },
      { dx: 18, dy: 7, type: 'sign_board' },
      { dx: 38, dy: 5, type: 'parasol' },
      { dx: 56, dy: 7, type: 'sign_board' },
      { dx: 73, dy: 5, type: 'parasol' },
    ],
  },

  // 娯楽街 (パチンコ + ゲーセン、コンパクト版)
  {
    id: 'shotengai_game', tier: 'mid', width: 66,
    buildings: [
      { dx: 15, size: 'pachinko' },    // w=30, edges 0-30
      { dx: 50, size: 'game_center' }, // w=28, edges 36-64
    ],
    furniture: [
      { dx:  1, dy: 6, type: 'sign_board' },
      { dx: 15, dy: 5, type: 'street_lamp' },
      { dx: 32, dy: 4, type: 'bicycle_rack' },
      { dx: 50, dy: 5, type: 'street_lamp' },
      { dx: 65, dy: 6, type: 'sign_board' },
    ],
  },

  // カフェ通り (カフェ + 書店 + 薬局)
  {
    id: 'cafe_bookstore_row', tier: 'mid', width: 66,
    buildings: [
      { dx: 10, size: 'cafe' },      // w=18, edges 1-19
      { dx: 32, size: 'bookstore' }, // w=18, edges 23-41
      { dx: 54, size: 'pharmacy' },  // w=20, edges 44-64
    ],
    furniture: [
      { dx: -1, dy: 4, type: 'parasol' },
      { dx: 21, dy: 4, type: 'bench' },
      { dx: 43, dy: 5, type: 'street_lamp' },
      { dx: 65, dy: 3, type: 'planter' },
    ],
  },

  // 商店 × 3 (パラソル・看板が賑やか)
  {
    id: 'shop_parasol_row', tier: 'mid', width: 72,
    buildings: [
      { dx: 11, size: 'shop' },        // w=22, edges 0-22
      { dx: 35, size: 'restaurant' },  // w=20, edges 25-45
      { dx: 59, size: 'shop' },        // w=22, edges 48-70
    ],
    furniture: [
      { dx:  0, dy: 4, type: 'parasol' },
      { dx: 23, dy: 6, type: 'sign_board' },
      { dx: 35, dy: 4, type: 'parasol' },
      { dx: 46, dy: 6, type: 'sign_board' },
      { dx: 71, dy: 4, type: 'parasol' },
    ],
  },

  // 長屋通り (タウンハウス × 3)
  {
    id: 'townhouse_row', tier: 'mid', width: 64,
    buildings: [
      { dx: 10, size: 'townhouse' }, // w=18, edges 1-19
      { dx: 32, size: 'townhouse' }, // edges 23-41
      { dx: 54, size: 'townhouse' }, // edges 45-63
    ],
    furniture: [
      { dx: -1, dy: 4, type: 'power_pole' },
      { dx: 21, dy: 2, type: 'planter' },
      { dx: 43, dy: 2, type: 'bicycle_rack' },
      { dx: 64, dy: 2, type: 'planter' },
    ],
  },

  // 神社群 (神社 + 桜 + 竹 + 狛犬)
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, size: 'shrine' }, // w=26, edges 21-47
    ],
    furniture: [
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 12, dy: 4, type: 'sakura_tree' },
      { dx: 20, dy: 3, type: 'bamboo_cluster' },
      { dx: 34, dy: 5, type: 'statue' },       // 参道の狛犬 (参道中央)
      { dx: 52, dy: 3, type: 'bamboo_cluster' },
      { dx: 60, dy: 4, type: 'sakura_tree' },
      { dx: 68, dy: 4, type: 'sakura_tree' },
    ],
  },

  // 寺の庭 (松・石灯籠・池っぽい植栽)
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, size: 'temple' }, // w=30, edges 7-37
    ],
    furniture: [
      { dx: -2, dy: 4, type: 'pine_tree' },
      { dx:  4, dy: 2, type: 'bush' },
      { dx: 22, dy: 5, type: 'statue' },  // 本堂前の石像
      { dx: 40, dy: 4, type: 'pine_tree' },
      { dx: 50, dy: 2, type: 'planter' },
      { dx: 62, dy: 4, type: 'pine_tree' },
    ],
  },

  // 医療・保育 (クリニック + 保育園 + 生垣)
  {
    id: 'clinic_daycare', tier: 'mid', width: 68,
    buildings: [
      { dx: 13, size: 'clinic' },  // w=26, edges 0-26
      { dx: 46, size: 'daycare' }, // w=28, edges 32-60
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  1, dy: 5, type: 'flag_pole' },
      { dx: 29, dy: 4, type: 'bench' },
      { dx: 30, dy: 3, type: 'flower_bed' },
      { dx: 62, dy: 4, type: 'tree' },
      { dx: 68, dy: 1, type: 'hedge' },
    ],
  },

  // 消防 + 警察 (公共タッグ) — midB only (police h=32)
  {
    id: 'fire_police', tier: 'midB', width: 70,
    buildings: [
      { dx: 15, size: 'fire_station' },    // w=30, edges 0-30
      { dx: 53, size: 'police_station' },  // w=30, edges 38-68
    ],
    furniture: [
      { dx: -2, dy: 3, type: 'bollard' },
      { dx: 15, dy: 6, type: 'flag_pole' },
      { dx: 34, dy: 4, type: 'traffic_light' },
      { dx: 53, dy: 6, type: 'flag_pole' },
      { dx: 70, dy: 4, type: 'sign_board' },
    ],
  },

  // 銀行 + 郵便局 — midB only (bank h=32)
  {
    id: 'bank_post', tier: 'midB', width: 62,
    buildings: [
      { dx: 14, size: 'bank' },        // w=28, edges 0-28
      { dx: 46, size: 'post_office' }, // w=24, edges 34-58
    ],
    furniture: [
      { dx: -2, dy: 3, type: 'bollard' },
      { dx:  2, dy: 3, type: 'atm' },
      { dx: 30, dy: 4, type: 'street_lamp' },
      { dx: 46, dy: 3, type: 'post_box' },
      { dx: 62, dy: 2, type: 'planter' },
    ],
  },

  // 豪邸 + 商店
  {
    id: 'mansion_shop', tier: 'mid', width: 64,
    buildings: [
      { dx: 16, size: 'mansion' }, // w=32, edges 0-32
      { dx: 49, size: 'shop' },    // w=22, edges 38-60
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  4, dy: 4, type: 'pine_tree' },
      { dx: 34, dy: 1, type: 'hedge' },
      { dx: 49, dy: 4, type: 'parasol' },
      { dx: 64, dy: 3, type: 'planter' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ TOP tier scenes — ランドマーク (max h=90)
// ─────────────────────────────────────────────────────────────────

const TOP_SCENES: Scene[] = [
  // 駅前広場 (駅 + バス停)
  {
    id: 'train_station_plaza', tier: 'top', width: 70,
    buildings: [
      { dx: 35, size: 'train_station' }, // w=50, edges 10-60
    ],
    furniture: [
      { dx:  1, dy: 5, type: 'bus_stop' },
      { dx: 12, dy: 5, type: 'bench' },
      { dx: 35, dy: 6, type: 'street_lamp' },
      { dx: 58, dy: 5, type: 'bench' },
      { dx: 69, dy: 5, type: 'bus_stop' },
    ],
    parkedVehicles: [
      { dx:  5, dy: 2, type: 'taxi' },
      { dx: 65, dy: 2, type: 'taxi' },
    ],
  },

  // 中央百貨店 (デパート + 装飾) — 2-cell merged 用の広めシーン
  {
    id: 'dept_store_plaza', tier: 'top', width: 74,
    buildings: [
      { dx: 37, size: 'department_store' }, // w=54, edges 10-64
    ],
    furniture: [
      { dx:  2, dy: 5, type: 'street_lamp' },
      { dx: 12, dy: 5, type: 'bench' },
      { dx: 24, dy: 6, type: 'banner_pole' },
      { dx: 37, dy: 6, type: 'statue' },
      { dx: 50, dy: 6, type: 'banner_pole' },
      { dx: 62, dy: 5, type: 'bench' },
      { dx: 72, dy: 5, type: 'street_lamp' },
    ],
  },

  // 病院 + 救急車駐車
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, size: 'hospital' }, // w=35, edges 10-45
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  3, dy: 5, type: 'flag_pole' },
      { dx: 48, dy: 3, type: 'bollard' },
      { dx: 54, dy: 3, type: 'bollard' },
      { dx: 66, dy: 1, type: 'hedge' },
    ],
    parkedVehicles: [
      { dx: 58, dy: 2, type: 'ambulance' },
    ],
  },

  // 学校 (運動場風)
  {
    id: 'school_grounds', tier: 'top', width: 74,
    buildings: [
      { dx: 36, size: 'school' }, // w=40, edges 16-56
    ],
    furniture: [
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  4, dy: 4, type: 'tree' },
      { dx: 12, dy: 5, type: 'flag_pole' },
      { dx: 60, dy: 4, type: 'sakura_tree' },
      { dx: 70, dy: 4, type: 'tree' },
      { dx: 74, dy: 1, type: 'hedge' },
    ],
  },

  // 市役所 (噴水・旗竿・ベンチのシンメトリー)
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, size: 'city_hall' }, // w=40, edges 12-52
    ],
    furniture: [
      { dx:  2, dy: 6, type: 'flag_pole' },
      { dx: 10, dy: 5, type: 'statue' },
      { dx: 20, dy: 5, type: 'bench' },
      { dx: 32, dy: 7, type: 'fountain' },
      { dx: 44, dy: 5, type: 'bench' },
      { dx: 60, dy: 6, type: 'flag_pole' },
      { dx: 70, dy: 4, type: 'planter' },
    ],
  },

  // オフィスタワー群 (2-cell merged 専用、160 px 想定)
  {
    id: 'office_tower_group', tier: 'top', width: 100,
    buildings: [
      { dx: 15, size: 'office' },     // w=30, edges 0-30
      { dx: 48, size: 'skyscraper' }, // w=28, edges 34-62
      { dx: 82, size: 'tower' },      // w=35, edges 64-99
    ],
    furniture: [
      { dx:  0, dy: 3, type: 'bollard' },
      { dx: 32, dy: 3, type: 'electric_box' },
      { dx: 63, dy: 3, type: 'bollard' },
      { dx: 100, dy: 3, type: 'electric_box' },
    ],
  },

  // 時計塔 + 高層アパート (コンパクト 2 棟)
  {
    id: 'clock_tower_trio', tier: 'top', width: 60,
    buildings: [
      { dx: 10, size: 'clock_tower' },    // w=16, edges 2-18
      { dx: 36, size: 'apartment_tall' }, // w=26, edges 23-49
    ],
    furniture: [
      { dx: 20, dy: 5, type: 'street_lamp' },
      { dx: 50, dy: 4, type: 'bench' },
      { dx: 56, dy: 5, type: 'flag_pole' },
    ],
  },

  // 映画館単体 (図書館は別シーンへ)
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, size: 'movie_theater' }, // w=38, edges 3-41
    ],
    furniture: [
      { dx:  1, dy: 6, type: 'banner_pole' },
      { dx: 22, dy: 5, type: 'sign_board' },
      { dx: 48, dy: 4, type: 'pine_tree' },
      { dx: 58, dy: 4, type: 'bench' },
      { dx: 65, dy: 6, type: 'banner_pole' },
    ],
  },

  // 博物館単体 (参道・松のシンメトリー)
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, size: 'museum' }, // w=40, edges 2-42
    ],
    furniture: [
      { dx: -2, dy: 4, type: 'pine_tree' },
      { dx:  2, dy: 5, type: 'flag_pole' },
      { dx: 42, dy: 5, type: 'statue' },
      { dx: 52, dy: 4, type: 'bench' },
      { dx: 60, dy: 4, type: 'pine_tree' },
    ],
  },

  // スーパー + 駐車場
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, size: 'supermarket' }, // w=40, edges 0-40
    ],
    furniture: [
      { dx: 20, dy: 6, type: 'sign_board' },
      { dx: 40, dy: 2, type: 'bollard' },
      { dx: 72, dy: 2, type: 'bollard' },
    ],
    parkedVehicles: [
      { dx: 46, dy: 1, type: 'car' },
      { dx: 58, dy: 1, type: 'car' },
      { dx: 70, dy: 1, type: 'van' },
    ],
  },

  // スタジアム + 無線塔 (2-cell 専用、160 px 想定)
  {
    id: 'stadium_radio', tier: 'top', width: 90,
    buildings: [
      { dx: 30, size: 'stadium' },     // w=60, edges 0-60
      { dx: 80, size: 'radio_tower' }, // w=10, edges 75-85
    ],
    furniture: [
      { dx: -2, dy: 5, type: 'banner_pole' },
      { dx: 62, dy: 6, type: 'flag_pole' },
      { dx: 68, dy: 5, type: 'bench' },
      { dx: 88, dy: 5, type: 'banner_pole' },
    ],
  },

  // 観覧車ゾーン
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, size: 'ferris_wheel' }, // w=44, edges 0-44
    ],
    furniture: [
      { dx: 46, dy: 4, type: 'bench' },
      { dx: 54, dy: 5, type: 'banner_pole' },
      { dx: 60, dy: 4, type: 'sakura_tree' },
      { dx: 66, dy: 5, type: 'flag_pole' },
    ],
  },

  // 高架水槽 + 高層アパート (工業・住宅混在)
  {
    id: 'water_tower_apartment', tier: 'top', width: 60,
    buildings: [
      { dx: 10, size: 'water_tower' },    // w=18, edges 1-19
      { dx: 42, size: 'apartment_tall' }, // w=26, edges 29-55
    ],
    furniture: [
      { dx: -1, dy: 3, type: 'electric_box' },
      { dx: 24, dy: 3, type: 'electric_box' },
      { dx: 60, dy: 3, type: 'electric_box' },
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
