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
  // コンセプト: 3 軒の住宅街区。前面に玄関 3 つが並び、各戸の奥が
  // 裏庭、さらに奥は共用の裏路地 (電柱と裏の木立) で街区の後端を画す。
  // 前面 dy 0-8, 裏庭 dy 20-45, 裏路地 dy 55-72 と、cell の縦を 3 段で使う。
  {
    id: 'house_trio_garden', tier: 'bot', width: 56,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 28, dy:  0, size: 'house' },
      { dx: 48, dy:  0, size: 'house' },
      { dx: 28, dy: 42, size: 'shed' },    // 裏庭の共用物置
    ],
    furniture: [
      // 前面 (玄関)
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 28, dy:  4, type: 'flower_bed' },
      { dx: 48, dy:  4, type: 'flower_bed' },
      { dx: 58, dy:  1, type: 'hedge' },
      // 家間の小路
      { dx: 18, dy:  3, type: 'bush' },
      { dx: 38, dy:  3, type: 'bush' },
      // 中層 (裏庭)
      { dx:  8, dy: 24, type: 'planter' },
      { dx: 48, dy: 26, type: 'planter' },
      // 裏路地 (街区の後端)
      { dx: -2, dy: 60, type: 'power_pole' },
      { dx: 28, dy: 62, type: 'tree' },
      { dx: 58, dy: 60, type: 'power_pole' },
    ],
  },

  // コンセプト: 住宅地の角にコンビニの街区。前は住宅の玄関と
  // コンビニの店頭。中層は住宅の裏庭とコンビニの搬入動線。
  // 奥は共用裏路地で、電柱と裏庭の木立が街区の後端を作る。
  {
    id: 'house_konbini', tier: 'bot', width: 56,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 32, dy:  0, size: 'convenience' },
    ],
    furniture: [
      // 前面
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 19, dy:  3, type: 'bush' },          // 敷地境界
      { dx: 32, dy:  5, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'vending' },
      { dx: 52, dy:  3, type: 'bicycle_rack' },
      // 中層 (住宅の裏庭 + コンビニ搬入動線)
      { dx:  8, dy: 26, type: 'planter' },
      { dx: 42, dy: 24, type: 'dumpster' },
      // 奥 (裏路地)
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx:  8, dy: 62, type: 'tree' },
      { dx: 58, dy: 58, type: 'power_pole' },
    ],
  },

  // コンセプト: 家とガレージの住宅街区。前面は玄関と駐車の車。中層は
  // 裏庭にビニールハウス (家庭菜園)、奥は裏路地で電柱と木立。
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 30, dy:  0, size: 'garage' },
      { dx: 18, dy: 30, size: 'greenhouse' },  // 裏の家庭菜園
    ],
    furniture: [
      // 前面
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 19, dy:  3, type: 'bush' },
      { dx: 48, dy:  1, type: 'hedge' },
      // 中層 — 菜園の畝
      { dx: 40, dy: 26, type: 'flower_bed' },
      // 奥 — 裏路地
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 24, dy: 62, type: 'tree' },
      { dx: 50, dy: 58, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 30, dy: 1, type: 'car' },
    ],
  },

  // コンセプト: 郊外の農家の一区画。前面に物置とビニールハウスが並び、
  // 敷地の奥は畝 (flower_bed) が手前から奥まで広がる畑地。
  // 最奥は防風林 (tree) と電柱で敷地の後端を示す。
  {
    id: 'garden_shed', tier: 'bot', width: 44,
    buildings: [
      { dx:  8, dy:  0, size: 'shed' },
      { dx: 29, dy:  0, size: 'greenhouse' },
    ],
    furniture: [
      // 敷地境界
      { dx: -2, dy:  2, type: 'bush' },
      { dx: 18, dy:  4, type: 'flower_bed' },
      { dx: 44, dy:  2, type: 'bush' },
      // 中層の畝
      { dx:  6, dy: 24, type: 'flower_bed' },
      { dx: 22, dy: 26, type: 'flower_bed' },
      { dx: 38, dy: 24, type: 'flower_bed' },
      // 奥の畝
      { dx: 14, dy: 44, type: 'flower_bed' },
      { dx: 32, dy: 44, type: 'flower_bed' },
      // 最奥: 防風林と電柱
      { dx: -2, dy: 62, type: 'power_pole' },
      { dx: 22, dy: 64, type: 'tree' },
      { dx: 46, dy: 62, type: 'tree' },
    ],
  },

  // コンセプト: 単体コンビニの街区。前面に店頭ファサード (自販機, ATM,
  // 看板, 自転車)。中層は裏の搬入エリアで dumpster と recycling。
  // 奥は空き地と電柱・木 1 本で敷地の後端。
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy:  0, size: 'convenience' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy:  3, type: 'vending' },
      { dx:  4, dy:  5, type: 'atm' },
      { dx: 14, dy:  6, type: 'sign_board' },
      { dx: 28, dy:  3, type: 'bicycle_rack' },
      { dx: 34, dy:  3, type: 'newspaper_stand' },
      // 中層 — 搬入エリア
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 32, dy: 24, type: 'recycling_bin' },
      // 奥 — 裏路地
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 20, dy: 62, type: 'tree' },
      { dx: 42, dy: 58, type: 'power_pole' },
    ],
  },

  // コンセプト: 飲食店 2 軒の街区。前面は提灯と看板で賑やか、
  // 中層は店の裏口の搬入エリア、奥は路地裏の電柱と裏庭の木で
  // 街区の後端を作る。
  {
    id: 'ramen_izakaya', tier: 'bot', width: 50,
    buildings: [
      { dx: 10, dy:  0, size: 'ramen' },
      { dx: 34, dy:  0, size: 'izakaya' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy:  3, type: 'parasol' },
      { dx: 10, dy:  6, type: 'banner_pole' },
      { dx: 22, dy:  3, type: 'vending' },
      { dx: 34, dy:  3, type: 'parasol' },
      { dx: 34, dy:  6, type: 'banner_pole' },
      { dx: 48, dy:  4, type: 'bicycle' },
      // 中層 — 搬入エリア
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 42, dy: 26, type: 'recycling_bin' },
      // 奥 — 路地裏
      { dx: -2, dy: 60, type: 'power_pole' },
      { dx: 24, dy: 62, type: 'tree' },
      { dx: 52, dy: 60, type: 'power_pole' },
    ],
  },

  // コンセプト: 花屋とパン屋の路面店街区。前面は花の陳列とパラソル。
  // 中層は店裏の小さな搬入口と植栽。奥は電柱と木で裏路地を示す。
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx:  8, dy:  0, size: 'florist' },
      { dx: 26, dy:  0, size: 'bakery' },
    ],
    furniture: [
      // 店頭
      { dx: -2, dy:  3, type: 'flower_bed' },
      { dx:  2, dy:  4, type: 'planter' },
      { dx:  8, dy:  5, type: 'parasol' },
      { dx: 17, dy:  3, type: 'bench' },
      { dx: 26, dy:  5, type: 'parasol' },
      { dx: 38, dy:  3, type: 'flower_bed' },
      // 中層
      { dx:  4, dy: 24, type: 'planter' },
      { dx: 36, dy: 24, type: 'garbage' },
      // 奥
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 20, dy: 62, type: 'tree' },
      { dx: 42, dy: 58, type: 'power_pole' },
    ],
  },

  // コンセプト: ガソリンスタンド街区。前面は給油エリア (価格看板・バナー・
  // ボラード・駐車中の車)。中層は敷地内の油タンクと洗車用設備。
  // 奥はフェンスの外の裏路地を示す電柱と木。
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy:  0, size: 'gas_station' },
    ],
    furniture: [
      // 給油エリア
      { dx: -1, dy:  2, type: 'bollard' },
      { dx:  2, dy:  6, type: 'sign_board' },
      { dx: 16, dy:  7, type: 'banner_pole' },
      { dx: 34, dy:  2, type: 'bollard' },
      { dx: 42, dy:  3, type: 'fire_extinguisher' },
      // 中層 — 敷地内設備
      { dx:  4, dy: 22, type: 'electric_box' },
      { dx: 32, dy: 24, type: 'vending' },
      // 奥 — 裏路地
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 22, dy: 62, type: 'tree' },
      { dx: 48, dy: 58, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 16, dy: 1, type: 'car' },
    ],
  },

  // コンセプト: ランドリーと薬局の街区。前面は客が待つベンチと看板、
  // 中層は共用の駐輪と搬入動線、奥は電柱と木で裏路地を形成。
  {
    id: 'laundromat_pharmacy', tier: 'bot', width: 46,
    buildings: [
      { dx: 10, dy:  0, size: 'laundromat' },
      { dx: 33, dy:  0, size: 'pharmacy' },
    ],
    furniture: [
      // 店頭
      { dx:  0, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 21, dy:  3, type: 'vending' },
      { dx: 33, dy:  5, type: 'sign_board' },
      { dx: 44, dy:  3, type: 'planter' },
      // 中層
      { dx: 10, dy: 24, type: 'bicycle_rack' },
      { dx: 33, dy: 24, type: 'garbage' },
      // 奥
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 22, dy: 62, type: 'tree' },
      { dx: 48, dy: 58, type: 'power_pole' },
    ],
  },

  // コンセプト: カフェと古本屋の静かな路面店街区。前面はテラスと
  // 屋外ワゴン。中層はオーナーの静かな裏庭 (植栽と桜)、奥は
  // 路地の電柱で街区の後端。
  {
    id: 'cafe_bookstore', tier: 'bot', width: 44,
    buildings: [
      { dx: 10, dy:  0, size: 'cafe' },
      { dx: 33, dy:  0, size: 'bookstore' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy:  3, type: 'parasol' },
      { dx:  4, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 21, dy:  3, type: 'bench' },
      { dx: 33, dy:  3, type: 'newspaper_stand' },
      { dx: 44, dy:  3, type: 'planter' },
      // 中層 — 静かな裏庭
      { dx: 22, dy: 28, type: 'sakura_tree' },
      // 奥 — 路地の電柱
      { dx: -2, dy: 58, type: 'power_pole' },
      { dx: 22, dy: 62, type: 'bush' },
      { dx: 46, dy: 58, type: 'power_pole' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ MID tier scenes — 商店街 (max h=30 front, h=32 back for midB)
// ─────────────────────────────────────────────────────────────────

const MID_SCENES: Scene[] = [
  // コンセプト: 古い商店街の 4 店舗が密に並ぶ街区。前面はパラソル・
  // のぼり旗・自販機・客の自転車で賑やか。中層は店裏の搬入路で
  // 電気設備。奥は裏路地で電柱 + 街灯が整然と並ぶ商店街の後端。
  {
    id: 'shotengai_food', tier: 'mid', width: 74,
    buildings: [
      { dx: 10, dy:  0, size: 'ramen' },
      { dx: 28, dy:  0, size: 'izakaya' },
      { dx: 47, dy:  0, size: 'cafe' },
      { dx: 64, dy:  0, size: 'bakery' },
    ],
    furniture: [
      // 店前
      { dx:  0, dy:  3, type: 'parasol' },
      { dx: 10, dy:  6, type: 'banner_pole' },
      { dx: 19, dy:  3, type: 'vending' },
      { dx: 28, dy:  6, type: 'banner_pole' },
      { dx: 38, dy:  3, type: 'parasol' },
      { dx: 47, dy:  6, type: 'banner_pole' },
      { dx: 55, dy:  3, type: 'bicycle' },
      { dx: 64, dy:  6, type: 'banner_pole' },
      { dx: 74, dy:  3, type: 'parasol' },
      // 中層 — 搬入路
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 38, dy: 24, type: 'electric_box' },
      { dx: 70, dy: 22, type: 'recycling_bin' },
      // 奥 — 裏路地
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 24, dy: 58, type: 'street_lamp' },
      { dx: 50, dy: 58, type: 'street_lamp' },
      { dx: 76, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: パチンコとゲーセンのネオン娯楽街区。前面はバナー・
  // 自転車・自販機で派手。中層は業務用搬入路で dumpster と電気設備。
  // 奥は裏路地で電柱と街灯が並ぶ商業地らしい後端。
  {
    id: 'shotengai_game', tier: 'mid', width: 66,
    buildings: [
      { dx: 15, dy:  0, size: 'pachinko' },
      { dx: 50, dy:  0, size: 'game_center' },
    ],
    furniture: [
      // 店前
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx:  6, dy:  4, type: 'bicycle' },
      { dx: 15, dy:  7, type: 'banner_pole' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 38, dy:  3, type: 'vending' },
      { dx: 50, dy:  7, type: 'banner_pole' },
      { dx: 60, dy:  4, type: 'bicycle' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 中層 — 搬入路
      { dx:  6, dy: 24, type: 'dumpster' },
      { dx: 32, dy: 24, type: 'electric_box' },
      { dx: 60, dy: 24, type: 'dumpster' },
      // 奥 — 裏路地
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 32, dy: 58, type: 'street_lamp' },
      { dx: 68, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 3 店舗 (カフェ + 書店 + 薬局) の落ち着いた路面店街区。
  // 前面はテラス席・ワゴン・看板。中層は店裏の共用駐輪と搬入動線。
  // 奥は裏路地の電柱と桜で静かな街区の後端。
  {
    id: 'cafe_bookstore_row', tier: 'mid', width: 66,
    buildings: [
      { dx: 10, dy:  0, size: 'cafe' },
      { dx: 32, dy:  0, size: 'bookstore' },
      { dx: 54, dy:  0, size: 'pharmacy' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy:  4, type: 'parasol' },
      { dx:  4, dy:  3, type: 'bench' },
      { dx: 21, dy:  5, type: 'street_lamp' },
      { dx: 32, dy:  3, type: 'newspaper_stand' },
      { dx: 43, dy:  5, type: 'street_lamp' },
      { dx: 54, dy:  5, type: 'sign_board' },
      { dx: 65, dy:  3, type: 'planter' },
      // 中層 — 裏の共用駐輪
      { dx: 10, dy: 24, type: 'bicycle_rack' },
      { dx: 54, dy: 24, type: 'garbage' },
      // 奥 — 裏路地
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 32, dy: 58, type: 'sakura_tree' },
      { dx: 68, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 雑貨店 + 食堂 + 雑貨店の賑やかな通り街区。前面は
  // パラソルと看板、店間にベンチと自販機。中層は搬入路でダンプスター
  // と電気設備。奥は街灯と電柱が並ぶ裏路地の後端。
  {
    id: 'shop_parasol_row', tier: 'mid', width: 72,
    buildings: [
      { dx: 11, dy:  0, size: 'shop' },
      { dx: 35, dy:  0, size: 'restaurant' },
      { dx: 59, dy:  0, size: 'shop' },
    ],
    furniture: [
      // 店頭
      { dx:  0, dy:  4, type: 'parasol' },
      { dx: 11, dy:  6, type: 'sign_board' },
      { dx: 23, dy:  3, type: 'vending' },
      { dx: 35, dy:  4, type: 'parasol' },
      { dx: 35, dy:  7, type: 'banner_pole' },
      { dx: 47, dy:  3, type: 'bench' },
      { dx: 59, dy:  6, type: 'sign_board' },
      { dx: 72, dy:  4, type: 'parasol' },
      // 中層 — 搬入路
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 35, dy: 24, type: 'electric_box' },
      { dx: 68, dy: 22, type: 'dumpster' },
      // 奥 — 裏路地
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 24, dy: 58, type: 'street_lamp' },
      { dx: 48, dy: 58, type: 'street_lamp' },
      { dx: 74, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 長屋風タウンハウス 3 軒の街区。前面は各戸の玄関
  // (郵便受け・花壇)、中層は共用の裏庭 (物置・駐輪)、奥は裏路地
  // で電柱と街灯。
  {
    id: 'townhouse_row', tier: 'mid', width: 64,
    buildings: [
      { dx: 10, dy:  0, size: 'townhouse' },
      { dx: 32, dy:  0, size: 'townhouse' },
      { dx: 54, dy:  0, size: 'townhouse' },
      { dx: 32, dy: 30, size: 'shed' },
    ],
    furniture: [
      // 前面
      { dx: -1, dy:  1, type: 'hedge' },
      { dx: 10, dy:  3, type: 'flower_bed' },
      { dx: 10, dy:  5, type: 'mailbox' },
      { dx: 21, dy:  3, type: 'bush' },
      { dx: 32, dy:  3, type: 'flower_bed' },
      { dx: 32, dy:  5, type: 'mailbox' },
      { dx: 43, dy:  3, type: 'bush' },
      { dx: 54, dy:  3, type: 'flower_bed' },
      { dx: 54, dy:  5, type: 'mailbox' },
      { dx: 65, dy:  1, type: 'hedge' },
      // 中層 — 裏庭の駐輪
      { dx: 10, dy: 24, type: 'bicycle_rack' },
      { dx: 54, dy: 24, type: 'garbage' },
      // 奥 — 裏路地
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 32, dy: 58, type: 'street_lamp' },
      { dx: 66, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 神社の境内一区画。前面は参道 (桜の門と狛犬)、中央に
  // 本殿、本殿の背後は cell の縦を深く使った鎮守の森 — 松と竹が
  // 3 層重ねで奥まで続く。境内の奥行きで cell 全体を聖域化。
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy:  0, size: 'shrine' },
    ],
    furniture: [
      // 参道
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 18, dy:  5, type: 'statue' },     // 狛犬
      { dx: 34, dy:  4, type: 'flower_bed' },  // 石灯籠前
      { dx: 50, dy:  5, type: 'statue' },     // 狛犬
      { dx: 66, dy:  4, type: 'sakura_tree' },
      // 中層 — 参道を守る竹
      { dx:  8, dy: 20, type: 'bamboo_cluster' },
      { dx: 60, dy: 20, type: 'bamboo_cluster' },
      // 鎮守の森 (前列)
      { dx: 20, dy: 36, type: 'pine_tree' },
      { dx: 48, dy: 36, type: 'pine_tree' },
      // 鎮守の森 (最奥列)
      { dx:  4, dy: 60, type: 'pine_tree' },
      { dx: 24, dy: 62, type: 'pine_tree' },
      { dx: 44, dy: 62, type: 'pine_tree' },
      { dx: 64, dy: 60, type: 'pine_tree' },
    ],
  },

  // コンセプト: 禅寺の一区画。前面に山門と石灯籠、本堂。本堂の
  // 背後は裏山で、松林と竹林が cell の奥まで深く続く。寺の庭と
  // 裏山の境界が曖昧な日本の寺院風景。
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy:  0, size: 'temple' },
    ],
    furniture: [
      // 山門前の庭
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 10, dy:  3, type: 'planter' },
      { dx: 22, dy:  6, type: 'statue' },   // 石灯籠
      { dx: 44, dy:  3, type: 'planter' },
      { dx: 60, dy:  4, type: 'pine_tree' },
      // 中層 — 庭の奥
      { dx: 22, dy: 20, type: 'bamboo_cluster' },
      // 裏山 (前列)
      { dx:  8, dy: 38, type: 'pine_tree' },
      { dx: 44, dy: 38, type: 'pine_tree' },
      // 裏山 (最奥列)
      { dx: -2, dy: 60, type: 'pine_tree' },
      { dx: 22, dy: 62, type: 'bamboo_cluster' },
      { dx: 42, dy: 62, type: 'pine_tree' },
      { dx: 64, dy: 60, type: 'pine_tree' },
    ],
  },

  // コンセプト: クリニックと保育園の公共施設街区。前面は生垣で敷地を
  // 囲み、待合ベンチと看板。中層は保育園の園庭 (桜と駐輪)。
  // 奥は職員駐車場で電気設備と電柱。
  {
    id: 'clinic_daycare', tier: 'mid', width: 68,
    buildings: [
      { dx: 13, dy:  0, size: 'clinic' },
      { dx: 46, dy:  0, size: 'daycare' },
    ],
    furniture: [
      // 前面
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'bench' },
      { dx: 13, dy:  5, type: 'sign_board' },
      { dx: 26, dy:  1, type: 'hedge' },
      { dx: 36, dy:  3, type: 'flower_bed' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 56, dy:  3, type: 'bench' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 中層 — 園庭と駐輪
      { dx: 13, dy: 24, type: 'bicycle_rack' },
      { dx: 46, dy: 26, type: 'sakura_tree' },
      // 奥 — 職員駐車場
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 34, dy: 58, type: 'electric_box' },
      { dx: 68, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 消防署と警察署の公共施設街区。前面は出動口の
  // バリア (bollard + 消火栓 + 信号機) と旗竿。中層は職員
  // 駐車場と設備。奥は裏路地の電柱と街灯。
  {
    id: 'fire_police', tier: 'midB', width: 70,
    buildings: [
      { dx: 15, dy:  0, size: 'fire_station' },
      { dx: 53, dy:  0, size: 'police_station' },
    ],
    furniture: [
      // 前面
      { dx: -2, dy:  3, type: 'bollard' },
      { dx:  0, dy:  4, type: 'hydrant' },
      { dx: 15, dy:  6, type: 'flag_pole' },
      { dx: 30, dy:  3, type: 'bollard' },
      { dx: 34, dy:  5, type: 'traffic_light' },
      { dx: 38, dy:  3, type: 'bollard' },
      { dx: 53, dy:  6, type: 'flag_pole' },
      { dx: 68, dy:  3, type: 'bollard' },
      // 中層
      { dx: 15, dy: 24, type: 'bicycle_rack' },
      { dx: 53, dy: 24, type: 'electric_box' },
      // 奥
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 34, dy: 58, type: 'street_lamp' },
      { dx: 72, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 銀行と郵便局の金融公共街区。前面は ATM と郵便ポスト、
  // 街灯とベンチ。中層は職員通用口で自転車ラックと電気設備。
  // 奥は裏路地の電柱と街灯。
  {
    id: 'bank_post', tier: 'midB', width: 62,
    buildings: [
      { dx: 14, dy:  0, size: 'bank' },
      { dx: 46, dy:  0, size: 'post_office' },
    ],
    furniture: [
      // 前面
      { dx:  2, dy:  4, type: 'atm' },
      { dx: 14, dy:  5, type: 'sign_board' },
      { dx: 24, dy:  3, type: 'bench' },
      { dx: 30, dy:  5, type: 'street_lamp' },
      { dx: 40, dy:  4, type: 'post_box' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 58, dy:  3, type: 'newspaper_stand' },
      // 中層
      { dx: 14, dy: 24, type: 'bicycle_rack' },
      { dx: 46, dy: 24, type: 'electric_box' },
      // 奥
      { dx: -2, dy: 54, type: 'power_pole' },
      { dx: 30, dy: 58, type: 'street_lamp' },
      { dx: 64, dy: 54, type: 'power_pole' },
    ],
  },

  // コンセプト: 黒塀の豪邸と小さな雑貨店の街区。前面は豪邸の門の
  // 松と石像、商店の店頭パラソル。中層は豪邸の伝統的な庭園 (松と竹)。
  // 奥は深い庭園の奥座敷で桜と松林が cell の最奥まで続く。
  {
    id: 'mansion_shop', tier: 'mid', width: 64,
    buildings: [
      { dx: 16, dy:  0, size: 'mansion' },
      { dx: 49, dy:  0, size: 'shop' },
    ],
    furniture: [
      // 前面
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 16, dy:  5, type: 'statue' },
      { dx: 30, dy:  4, type: 'pine_tree' },
      { dx: 34, dy:  1, type: 'hedge' },
      { dx: 49, dy:  4, type: 'parasol' },
      { dx: 58, dy:  3, type: 'bench' },
      // 中層 — 豪邸の庭園
      { dx:  8, dy: 22, type: 'bamboo_cluster' },
      { dx: 24, dy: 24, type: 'pine_tree' },
      // 奥 — 庭園の奥
      { dx:  4, dy: 54, type: 'pine_tree' },
      { dx: 18, dy: 58, type: 'sakura_tree' },
      { dx: 38, dy: 54, type: 'pine_tree' },
      { dx: 60, dy: 58, type: 'tree' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ TOP tier scenes — ランドマーク (max h=90)
// ─────────────────────────────────────────────────────────────────

const TOP_SCENES: Scene[] = [
  // コンセプト: 駅前ロータリーの街区。前面は広場 (バス停・タクシー・
  // 待ちベンチ・駐輪)、中央は駅舎 + 旗竿 + 創設者の銅像。駅舎背後は
  // 駅裏で電気設備と裏手の街灯、最奥は桜並木で駅前の雰囲気。
  {
    id: 'train_station_plaza', tier: 'top', width: 70,
    buildings: [
      { dx: 35, dy:  0, size: 'train_station' },
    ],
    furniture: [
      // 広場
      { dx: -1, dy:  5, type: 'bus_stop' },
      { dx: 12, dy:  3, type: 'bench' },
      { dx: 22, dy:  4, type: 'bicycle_rack' },
      { dx: 35, dy:  6, type: 'flag_pole' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 58, dy:  3, type: 'bench' },
      { dx: 71, dy:  5, type: 'bus_stop' },
      // 中層 — 広場の中心
      { dx: 35, dy: 22, type: 'statue' },
      // 駅裏 — 電気設備
      { dx:  4, dy: 40, type: 'electric_box' },
      { dx: 66, dy: 40, type: 'electric_box' },
      // 最奥 — 桜並木
      { dx: 14, dy: 58, type: 'sakura_tree' },
      { dx: 56, dy: 58, type: 'sakura_tree' },
    ],
    parkedVehicles: [
      { dx:  5, dy: 2, type: 'taxi' },
      { dx: 65, dy: 2, type: 'taxi' },
    ],
  },

  // コンセプト: 中央百貨店街区。前面は象徴的な広場 (噴水・バナー・
  // ベンチ・街灯)、中層は広場の植栽帯、奥は搬入エリアで電気設備、
  // 最奥は裏路地の電柱で街区の後端。
  {
    id: 'dept_store_plaza', tier: 'top', width: 74,
    buildings: [
      { dx: 37, dy:  0, size: 'department_store' },
    ],
    furniture: [
      // 前庭広場
      { dx:  2, dy:  5, type: 'street_lamp' },
      { dx: 14, dy:  3, type: 'bench' },
      { dx: 25, dy:  5, type: 'banner_pole' },
      { dx: 37, dy:  6, type: 'fountain' },
      { dx: 49, dy:  5, type: 'banner_pole' },
      { dx: 60, dy:  3, type: 'bench' },
      { dx: 72, dy:  5, type: 'street_lamp' },
      // 中層 — 植栽帯
      { dx: 14, dy: 22, type: 'planter' },
      { dx: 60, dy: 22, type: 'planter' },
      // 奥 — 搬入エリア
      { dx:  4, dy: 42, type: 'electric_box' },
      { dx: 37, dy: 44, type: 'street_lamp' },
      { dx: 70, dy: 42, type: 'electric_box' },
      // 最奥
      { dx: -2, dy: 60, type: 'power_pole' },
      { dx: 76, dy: 60, type: 'power_pole' },
    ],
  },

  // コンセプト: 総合病院の街区。前面は生垣で囲まれた正面ロータリー
  // (旗竿・ベンチ・看板・ボラード・消火栓)、救急車入口。
  // 中層は職員駐車場と電気設備、奥は裏庭で街灯と木立。
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, dy:  0, size: 'hospital' },
    ],
    furniture: [
      // 正面
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  6, dy:  5, type: 'flag_pole' },
      { dx: 16, dy:  3, type: 'bench' },
      { dx: 27, dy:  5, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'bollard' },
      { dx: 52, dy:  4, type: 'hydrant' },
      { dx: 66, dy:  1, type: 'hedge' },
      // 中層 — 駐車場と設備
      { dx: 16, dy: 22, type: 'planter' },
      { dx: 52, dy: 24, type: 'electric_box' },
      // 奥 — 裏庭
      { dx: -2, dy: 44, type: 'power_pole' },
      { dx: 27, dy: 48, type: 'street_lamp' },
      { dx: 68, dy: 44, type: 'power_pole' },
      // 最奥
      { dx: 14, dy: 62, type: 'tree' },
      { dx: 44, dy: 62, type: 'tree' },
    ],
    parkedVehicles: [
      { dx: 58, dy: 2, type: 'ambulance' },
    ],
  },

  // コンセプト: 学校の街区。前面は校門 (生垣・桜並木・国旗)、校舎前
  // に校長名の看板。中層は校庭 (二宮金次郎像・植栽・駐輪)。奥は
  // 裏山 (松林) で、学校の後方が自然に続く風景。
  {
    id: 'school_grounds', tier: 'top', width: 74,
    buildings: [
      { dx: 36, dy:  0, size: 'school' },
    ],
    furniture: [
      // 校門
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 10, dy:  5, type: 'flag_pole' },
      { dx: 36, dy:  5, type: 'sign_board' },
      { dx: 62, dy:  5, type: 'flag_pole' },
      { dx: 72, dy:  4, type: 'sakura_tree' },
      { dx: 74, dy:  1, type: 'hedge' },
      // 中層 — 校庭
      { dx: 14, dy: 22, type: 'statue' },
      { dx: 36, dy: 24, type: 'bicycle_rack' },
      { dx: 58, dy: 22, type: 'bush' },
      // 奥 — 裏山 (前列)
      { dx:  4, dy: 44, type: 'pine_tree' },
      { dx: 36, dy: 48, type: 'pine_tree' },
      { dx: 70, dy: 44, type: 'pine_tree' },
      // 最奥
      { dx: 18, dy: 64, type: 'pine_tree' },
      { dx: 54, dy: 64, type: 'pine_tree' },
    ],
  },

  // コンセプト: 市役所の街区。前面は左右対称の格式ある広場 (噴水・
  // 旗竿 2 本・銅像 2 体・ベンチ・生垣)。中層は広場の植栽帯。
  // 奥は市役所の裏庭で松林の庭園、最奥に街灯。
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy:  0, size: 'city_hall' },
    ],
    furniture: [
      // 前庭
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  6, type: 'flag_pole' },
      { dx: 12, dy:  5, type: 'statue' },
      { dx: 20, dy:  3, type: 'bench' },
      { dx: 32, dy:  7, type: 'fountain' },
      { dx: 44, dy:  3, type: 'bench' },
      { dx: 52, dy:  5, type: 'statue' },
      { dx: 62, dy:  6, type: 'flag_pole' },
      { dx: 72, dy:  1, type: 'hedge' },
      // 中層
      { dx: 12, dy: 22, type: 'planter' },
      { dx: 52, dy: 22, type: 'planter' },
      // 奥 — 裏庭の松
      { dx:  6, dy: 44, type: 'pine_tree' },
      { dx: 32, dy: 48, type: 'pine_tree' },
      { dx: 58, dy: 44, type: 'pine_tree' },
      // 最奥
      { dx: 18, dy: 64, type: 'sakura_tree' },
      { dx: 46, dy: 64, type: 'sakura_tree' },
    ],
  },

  // コンセプト: 3 棟のオフィスタワー街区 (2-cell)。前面は歩道
  // (ボラード・看板・ベンチ・街灯)、中層はビル前のプランター。
  // 奥は配電設備と街灯、最奥は裏の木立で都会の硬質な後端。
  {
    id: 'office_tower_group', tier: 'top', width: 100,
    buildings: [
      { dx: 15, dy:  0, size: 'office' },
      { dx: 48, dy:  0, size: 'skyscraper' },
      { dx: 82, dy:  0, size: 'tower' },
    ],
    furniture: [
      // 歩道
      { dx:  0, dy:  3, type: 'bollard' },
      { dx: 15, dy:  5, type: 'sign_board' },
      { dx: 32, dy:  3, type: 'bench' },
      { dx: 48, dy:  5, type: 'sign_board' },
      { dx: 65, dy:  3, type: 'bench' },
      { dx: 82, dy:  5, type: 'sign_board' },
      { dx: 100, dy: 3, type: 'bollard' },
      // 中層 — 街灯
      { dx: 15, dy: 22, type: 'street_lamp' },
      { dx: 48, dy: 22, type: 'street_lamp' },
      { dx: 82, dy: 22, type: 'street_lamp' },
      // 奥 — 配電設備
      { dx: 32, dy: 44, type: 'electric_box' },
      { dx: 65, dy: 44, type: 'electric_box' },
      // 最奥 — 街路樹
      { dx: 15, dy: 62, type: 'tree' },
      { dx: 48, dy: 62, type: 'tree' },
      { dx: 82, dy: 62, type: 'tree' },
    ],
  },

  // コンセプト: 時計塔と高層マンションの街区。前面は小広場と
  // マンション入口。中層は住民用スペース (植栽・駐輪)。
  // 奥は裏の木立で街区の後端。
  {
    id: 'clock_tower_trio', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy:  0, size: 'clock_tower' },
      { dx: 36, dy:  0, size: 'apartment_tall' },
    ],
    furniture: [
      // 前面
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  0, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 20, dy:  5, type: 'street_lamp' },
      { dx: 36, dy:  5, type: 'mailbox' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 61, dy:  1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 22, type: 'bush' },
      { dx: 36, dy: 22, type: 'planter' },
      // 奥
      { dx: -2, dy: 44, type: 'power_pole' },
      { dx: 30, dy: 48, type: 'tree' },
      { dx: 62, dy: 44, type: 'power_pole' },
      // 最奥
      { dx: 30, dy: 64, type: 'sakura_tree' },
    ],
  },

  // コンセプト: 映画館の街区。前面はマーキー (banner_pole) と
  // 待ち客スペース (ベンチ・新聞スタンド・自販機)。中層はロビー
  // 裏の大看板。奥は搬入口 (ダンプスター・電気設備)、最奥は裏路地。
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy:  0, size: 'movie_theater' },
    ],
    furniture: [
      // 前面
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 10, dy:  3, type: 'newspaper_stand' },
      { dx: 22, dy:  5, type: 'sign_board' },
      { dx: 40, dy:  3, type: 'bench' },
      { dx: 54, dy:  3, type: 'vending' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 中層
      { dx: 22, dy: 22, type: 'banner_pole' },
      { dx: 50, dy: 22, type: 'street_lamp' },
      // 奥 — 搬入エリア
      { dx:  4, dy: 44, type: 'dumpster' },
      { dx: 54, dy: 44, type: 'electric_box' },
      // 最奥
      { dx: -2, dy: 62, type: 'power_pole' },
      { dx: 30, dy: 64, type: 'tree' },
      { dx: 68, dy: 62, type: 'power_pole' },
    ],
  },

  // コンセプト: 博物館の街区。前庭は格式ある庭園 (松のシンメトリー・
  // 銅像・旗竿)、中層は植栽帯、奥は裏庭で松林が cell の最奥まで
  // 深く続く伝統的な公共建築の風景。
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, dy:  0, size: 'museum' },
    ],
    furniture: [
      // 前庭
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  0, dy:  4, type: 'pine_tree' },
      { dx:  8, dy:  5, type: 'flag_pole' },
      { dx: 22, dy:  6, type: 'statue' },
      { dx: 38, dy:  5, type: 'flag_pole' },
      { dx: 46, dy:  4, type: 'pine_tree' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 中層
      { dx: 22, dy: 22, type: 'planter' },
      // 奥 — 裏庭の松林 (前列)
      { dx:  6, dy: 44, type: 'pine_tree' },
      { dx: 22, dy: 48, type: 'bamboo_cluster' },
      { dx: 38, dy: 44, type: 'pine_tree' },
      // 最奥 — 深い松林
      { dx: -2, dy: 64, type: 'pine_tree' },
      { dx: 22, dy: 66, type: 'pine_tree' },
      { dx: 46, dy: 64, type: 'pine_tree' },
    ],
  },

  // コンセプト: 郊外型スーパーの街区。左は建物、右は駐車場 (3 台)、
  // ボラードで区画分離。中層は駐車場の街灯。奥は搬入口で電気設備と
  // ダンプスター、最奥は裏路地の電柱。
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy:  0, size: 'supermarket' },
    ],
    furniture: [
      // 店頭
      { dx:  2, dy:  3, type: 'vending' },
      { dx: 10, dy:  4, type: 'bicycle_rack' },
      { dx: 20, dy:  6, type: 'sign_board' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 40, dy:  3, type: 'bollard' },
      { dx: 72, dy:  3, type: 'bollard' },
      // 中層 — 駐車場
      { dx: 56, dy: 22, type: 'street_lamp' },
      // 奥 — 搬入口
      { dx: 10, dy: 44, type: 'dumpster' },
      { dx: 56, dy: 44, type: 'electric_box' },
      // 最奥
      { dx: -2, dy: 62, type: 'power_pole' },
      { dx: 32, dy: 64, type: 'tree' },
      { dx: 74, dy: 62, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 46, dy: 1, type: 'car' },
      { dx: 58, dy: 1, type: 'car' },
      { dx: 70, dy: 1, type: 'van' },
    ],
  },

  // コンセプト: 大型スタジアムと無線塔の街区 (2-cell)。前面は
  // スタジアム入場口 (バナー・ボラード・看板) と無線塔の工業エリア
  // (電気ボックス)。中層は広場の街灯。奥は駐車場・搬入口、
  // 最奥は敷地を囲う木立。
  {
    id: 'stadium_radio', tier: 'top', width: 90,
    buildings: [
      { dx: 30, dy:  0, size: 'stadium' },
      { dx: 80, dy:  0, size: 'radio_tower' },
    ],
    furniture: [
      // 入場口
      { dx: -1, dy:  5, type: 'banner_pole' },
      { dx: 14, dy:  3, type: 'bollard' },
      { dx: 30, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'bollard' },
      { dx: 60, dy:  5, type: 'banner_pole' },
      { dx: 72, dy:  3, type: 'electric_box' },
      { dx: 80, dy:  4, type: 'sign_board' },
      { dx: 88, dy:  3, type: 'electric_box' },
      // 中層
      { dx: 14, dy: 22, type: 'street_lamp' },
      { dx: 46, dy: 22, type: 'street_lamp' },
      { dx: 80, dy: 22, type: 'electric_box' },
      // 奥
      { dx:  4, dy: 44, type: 'dumpster' },
      { dx: 46, dy: 44, type: 'electric_box' },
      // 最奥
      { dx: 20, dy: 64, type: 'tree' },
      { dx: 70, dy: 64, type: 'tree' },
    ],
  },

  // コンセプト: 観覧車の遊園地一区画。前面は入場口 (バナー・看板)、
  // 待ちエリア (ベンチ・パラソル・露店)、生垣で敷地を囲む。
  // 中層は広場の街灯と植栽、奥は桜の並木と電柱で遊園地の後端。
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy:  0, size: 'ferris_wheel' },
    ],
    furniture: [
      // 入場口
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  5, type: 'banner_pole' },
      { dx: 22, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'parasol' },
      { dx: 56, dy:  3, type: 'bench' },
      { dx: 65, dy:  5, type: 'flag_pole' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 中層
      { dx: 22, dy: 22, type: 'street_lamp' },
      { dx: 56, dy: 22, type: 'planter' },
      // 奥
      { dx: -2, dy: 44, type: 'power_pole' },
      { dx: 56, dy: 44, type: 'sakura_tree' },
      { dx: 68, dy: 44, type: 'power_pole' },
      // 最奥
      { dx: 22, dy: 64, type: 'sakura_tree' },
      { dx: 48, dy: 64, type: 'sakura_tree' },
    ],
  },

  // コンセプト: 給水塔 (工業) と高層マンション (住宅) の混合街区。
  // 前面は給水塔側が電気設備、マンション側が入口 (郵便受け・駐輪)、
  // 生垣で敷地を分ける。中層は敷地内設備、奥は裏路地の電柱と木。
  {
    id: 'water_tower_apartment', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy:  0, size: 'water_tower' },
      { dx: 42, dy:  0, size: 'apartment_tall' },
    ],
    furniture: [
      // 前面
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'electric_box' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 20, dy:  3, type: 'electric_box' },
      { dx: 32, dy:  5, type: 'mailbox' },
      { dx: 42, dy:  4, type: 'bicycle_rack' },
      { dx: 54, dy:  3, type: 'bench' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 22, type: 'electric_box' },
      { dx: 42, dy: 22, type: 'street_lamp' },
      // 奥
      { dx: -2, dy: 44, type: 'power_pole' },
      { dx: 26, dy: 48, type: 'tree' },
      { dx: 62, dy: 44, type: 'power_pole' },
      // 最奥
      { dx: 26, dy: 64, type: 'tree' },
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
