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
      // 裏庭中央の共用物置
      { dx: 28, dy: 36, size: 'shed' },
    ],
    furniture: [
      // 前面: 木塀で敷地を閉じ、各戸の玄関に鉢植えと郵便受け
      { dx: -2, dy:  2, type: 'wood_fence' },
      { dx: 58, dy:  2, type: 'wood_fence' },
      { dx:  8, dy:  4, type: 'potted_plant' },
      { dx: 28, dy:  4, type: 'mailbox' },
      { dx: 48, dy:  4, type: 'potted_plant' },
      // 前庭: 各戸の側面に室外機 (生活感)
      { dx: 16, dy: 22, type: 'ac_unit' },
      { dx: 40, dy: 22, type: 'ac_unit' },
      // 中後層: 物干し竿と縁側の猫
      { dx: 28, dy: 50, type: 'laundry_pole' },
      { dx: 14, dy: 52, type: 'cat' },
      // 裏路地: 電柱 2 本と集積所
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 28, dy: 68, type: 'garbage' },
      { dx: 58, dy: 68, type: 'power_pole' },
      // 最奥: 中央に共用の桜、両脇に低木で締める
      { dx:  8, dy: 86, type: 'bush' },
      { dx: 28, dy: 90, type: 'sakura_tree' },
      { dx: 48, dy: 86, type: 'bush' },
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
      // 住宅の裏庭にある物置
      { dx: 10, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 前面: 住宅は木塀と鉢植え、コンビニは A 型看板とのぼり旗
      { dx: -2, dy:  2, type: 'wood_fence' },
      { dx:  8, dy:  4, type: 'potted_plant' },
      { dx: 22, dy:  4, type: 'a_frame_sign' },
      { dx: 32, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'vending' },
      // 中前層: 住宅の側面に室外機、コンビニ前にカーブミラー
      { dx: 16, dy: 22, type: 'ac_unit' },
      // 中後層: 物干し竿 + コンビニ裏の搬入
      { dx: 10, dy: 50, type: 'laundry_pole' },
      { dx: 42, dy: 50, type: 'dumpster' },
      { dx: 52, dy: 52, type: 'milk_crate_stack' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 58, dy: 68, type: 'power_pole' },
      // 最奥: 中央に木、両脇に低木
      { dx: 10, dy: 88, type: 'bush' },
      { dx: 32, dy: 90, type: 'tree' },
      { dx: 52, dy: 88, type: 'bush' },
    ],
  },

  // コンセプト: 家とガレージの住宅街区。前面は玄関と駐車の車。中層は
  // 裏庭にビニールハウス (家庭菜園)、奥は裏路地で電柱と木立。
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 30, dy:  0, size: 'garage' },
      // 裏の家庭菜園ビニールハウス
      { dx: 20, dy: 36, size: 'greenhouse' },
    ],
    furniture: [
      // 前面: 木塀で敷地を閉じ、玄関に鉢植え、ガレージ前にカラーコーン
      { dx: -2, dy:  2, type: 'wood_fence' },
      { dx: 48, dy:  2, type: 'wood_fence' },
      { dx:  8, dy:  4, type: 'potted_plant' },
      { dx: 30, dy:  4, type: 'traffic_cone' },
      // 前庭: 玄関の郵便受け、ガレージ脇に LP ガスボンベ
      { dx:  8, dy: 14, type: 'mailbox' },
      { dx: 38, dy: 22, type: 'gas_canister' },
      // 中後層: 物干し + ハウス脇の菜園
      { dx:  8, dy: 50, type: 'laundry_pole' },
      { dx: 40, dy: 52, type: 'flower_bed' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 50, dy: 68, type: 'power_pole' },
      // 最奥: 防風林
      { dx:  8, dy: 88, type: 'bush' },
      { dx: 24, dy: 90, type: 'tree' },
      { dx: 40, dy: 88, type: 'bush' },
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
      // 奥の畑にもう 1 棟ビニールハウス
      { dx: 22, dy: 42, size: 'greenhouse' },
    ],
    furniture: [
      // 前面: 木塀で敷地を区切り、農具と農家のシンボル
      { dx: -2, dy:  2, type: 'wood_fence' },
      { dx: 44, dy:  2, type: 'wood_fence' },
      { dx: 18, dy:  4, type: 'sandbags' },        // 土のう (農作業)
      // 前庭: 雨水タンクと畝
      { dx:  4, dy: 22, type: 'water_tank' },
      { dx: 38, dy: 24, type: 'flower_bed' },
      // 中後層: 奥の畑とブルーシート
      { dx: 38, dy: 50, type: 'tarp' },
      { dx:  4, dy: 66, type: 'flower_bed' },
      // 最奥: 防風林
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 22, dy: 90, type: 'tree' },
      { dx: 46, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 単体コンビニの街区。前面に店頭ファサード (自販機, ATM,
  // 看板, 自転車)。中層は裏の搬入エリアで dumpster と recycling。
  // 奥は空き地と電柱・木 1 本で敷地の後端。
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy:  0, size: 'convenience' },
      // 店裏の従業員ガレージ
      { dx: 20, dy: 40, size: 'garage' },
    ],
    furniture: [
      // 店頭: 自販機・看板・のぼり旗で賑やかに
      { dx:  0, dy:  3, type: 'vending' },
      { dx:  6, dy:  4, type: 'a_frame_sign' },
      { dx: 14, dy:  6, type: 'sign_board' },
      { dx: 22, dy:  6, type: 'banner_pole' },
      { dx: 30, dy:  3, type: 'bicycle_rack' },
      // 前庭: 店脇に LP ガスボンベと室外機
      { dx:  0, dy: 22, type: 'gas_canister' },
      { dx: 32, dy: 22, type: 'ac_unit' },
      // 中後層: 搬入のダンプスターと牛乳ケース
      { dx:  6, dy: 52, type: 'dumpster' },
      { dx: 32, dy: 52, type: 'milk_crate_stack' },
      // 奥: 電柱 2 本 + 屋上の猫
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 20, dy: 70, type: 'cat' },
      { dx: 42, dy: 68, type: 'power_pole' },
      // 最奥: 空地の木と低木
      { dx: 14, dy: 88, type: 'tree' },
      { dx: 30, dy: 88, type: 'bush' },
    ],
    parkedVehicles: [
      { dx:  6, dy: 1, type: 'car' },  // 従業員の車
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
      // 2 店共有の業務倉庫 1 棟
      { dx: 22, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 店頭: ラーメン屋の暖簾、居酒屋の提灯、中央に自販機
      { dx: 10, dy:  4, type: 'noren' },
      { dx: 22, dy:  4, type: 'vending' },
      { dx: 34, dy:  4, type: 'noren' },
      // 店上の赤提灯
      { dx:  4, dy: 12, type: 'chouchin' },
      { dx: 16, dy: 12, type: 'chouchin' },
      { dx: 28, dy: 12, type: 'chouchin' },
      { dx: 40, dy: 12, type: 'chouchin' },
      // 中前層: 業務用 LP ガスボンベ + 室外機
      { dx:  4, dy: 22, type: 'gas_canister' },
      { dx: 42, dy: 22, type: 'ac_unit' },
      // 中後層: 搬入のビールケースとダンプスター
      { dx:  6, dy: 50, type: 'milk_crate_stack' },
      { dx: 22, dy: 52, type: 'dumpster' },
      { dx: 42, dy: 50, type: 'milk_crate_stack' },
      // 奥: 電柱と路地裏の猫
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 30, dy: 70, type: 'cat' },
      { dx: 52, dy: 68, type: 'power_pole' },
      // 最奥: 路地の街灯 2 本で framing
      { dx: 10, dy: 88, type: 'street_lamp' },
      { dx: 34, dy: 88, type: 'street_lamp' },
    ],
  },

  // コンセプト: 花屋とパン屋の路面店街区。前面は花の陳列とパラソル。
  // 中層は店裏の小さな搬入口と植栽。奥は電柱と木で裏路地を示す。
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx:  8, dy:  0, size: 'florist' },
      { dx: 26, dy:  0, size: 'bakery' },
      // 花屋の栽培用ビニールハウス
      { dx: 17, dy: 38, size: 'greenhouse' },
    ],
    furniture: [
      // 店頭: 花屋に鉢植え列、パン屋に A 型看板とテント
      { dx: -2, dy:  3, type: 'potted_plant' },
      { dx:  8, dy:  5, type: 'flower_bed' },
      { dx: 17, dy:  4, type: 'a_frame_sign' },
      { dx: 26, dy:  6, type: 'shop_awning' },
      { dx: 38, dy:  3, type: 'potted_plant' },
      // 前庭: パン屋脇に室外機
      { dx: 36, dy: 22, type: 'ac_unit' },
      // 中後層: ハウス脇の植栽トレイと猫
      { dx:  4, dy: 52, type: 'planter' },
      { dx: 30, dy: 54, type: 'cat' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 42, dy: 68, type: 'power_pole' },
      // 最奥: 桜を中央に
      { dx: 17, dy: 90, type: 'sakura_tree' },
    ],
  },

  // コンセプト: ガソリンスタンド街区。前面は給油エリア (価格看板・バナー・
  // ボラード・駐車中の車)。中層は敷地内の油タンクと洗車用設備。
  // 奥はフェンスの外の裏路地を示す電柱と木。
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy:  0, size: 'gas_station' },
      // 整備工場
      { dx: 22, dy: 36, size: 'garage' },
    ],
    furniture: [
      // 給油エリア: ボラード、看板、消火器、カラーコーン
      { dx: -1, dy:  2, type: 'bollard' },
      { dx:  6, dy:  4, type: 'traffic_cone' },
      { dx: 16, dy:  7, type: 'banner_pole' },
      { dx: 26, dy:  4, type: 'traffic_cone' },
      { dx: 34, dy:  2, type: 'bollard' },
      { dx: 42, dy:  3, type: 'fire_extinguisher' },
      // 前庭: タイヤ置場 (土のう代用) と LP ガスボンベ
      { dx:  4, dy: 22, type: 'gas_canister' },
      { dx: 42, dy: 22, type: 'sandbags' },
      // 中後層: 整備工場前の電気設備とブルーシート
      { dx:  4, dy: 52, type: 'electric_box' },
      { dx: 38, dy: 54, type: 'tarp' },
      // 奥: 電柱 2 本 + カーブミラー
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 22, dy: 68, type: 'street_mirror' },
      { dx: 48, dy: 68, type: 'power_pole' },
      // 最奥: 境界の雑木
      { dx: 12, dy: 90, type: 'tree' },
      { dx: 36, dy: 90, type: 'tree' },
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
      // 共用のボイラー室
      { dx: 22, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 店頭: 両店頭に看板、間に自販機、テント風ひさし
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 22, dy:  3, type: 'vending' },
      { dx: 33, dy:  6, type: 'shop_awning' },
      // 前庭: 共用の駐輪
      { dx: 22, dy: 24, type: 'bicycle_rack' },
      // 中前層: ランドリー側の物干し竿、薬局側の室外機
      { dx: 10, dy: 22, type: 'laundry_pole' },
      { dx: 42, dy: 22, type: 'ac_unit' },
      // 中後層: ボイラー配管 + ブルーシート
      { dx:  6, dy: 52, type: 'electric_box' },
      { dx: 42, dy: 54, type: 'tarp' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 48, dy: 68, type: 'power_pole' },
      // 最奥: 住宅との境
      { dx: 10, dy: 88, type: 'tree' },
      { dx: 33, dy: 88, type: 'tree' },
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
      // 裏庭の共用物置
      { dx: 22, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 店頭: カフェのテラスとベンチ、書店の A 型看板と新聞スタンド
      { dx: -1, dy:  3, type: 'parasol' },
      { dx:  4, dy:  4, type: 'bonsai' },          // テラスの盆栽
      { dx: 10, dy:  6, type: 'shop_awning' },
      { dx: 22, dy:  3, type: 'bench' },
      { dx: 33, dy:  4, type: 'a_frame_sign' },
      { dx: 41, dy:  3, type: 'newspaper_stand' },
      // 前庭: 中央の桜と猫
      { dx: 22, dy: 26, type: 'sakura_tree' },
      { dx: 38, dy: 26, type: 'cat' },
      // 中後層: 物置脇の鉢植え
      { dx:  6, dy: 52, type: 'potted_plant' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 46, dy: 68, type: 'power_pole' },
      // 最奥: 中央に桜
      { dx: 22, dy: 90, type: 'sakura_tree' },
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
      // 4 店共有の業務倉庫 2 棟
      { dx: 19, dy: 42, size: 'shed' },
      { dx: 55, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 店前: ラーメン暖簾、居酒屋暖簾、カフェ A 型看板、ベーカリーひさし
      { dx: 10, dy:  4, type: 'noren' },
      { dx: 28, dy:  4, type: 'noren' },
      { dx: 47, dy:  4, type: 'a_frame_sign' },
      { dx: 64, dy:  6, type: 'shop_awning' },
      // 商店街アーケードの赤提灯
      { dx:  4, dy: 13, type: 'chouchin' },
      { dx: 19, dy: 13, type: 'chouchin' },
      { dx: 38, dy: 13, type: 'chouchin' },
      { dx: 55, dy: 13, type: 'chouchin' },
      { dx: 70, dy: 13, type: 'chouchin' },
      // 中前層: 業務用 LP ガスボンベと室外機
      { dx:  4, dy: 24, type: 'gas_canister' },
      { dx: 38, dy: 24, type: 'ac_unit' },
      { dx: 70, dy: 24, type: 'gas_canister' },
      // 中後層: 搬入のビールケース + ダンプスター
      { dx:  4, dy: 56, type: 'milk_crate_stack' },
      { dx: 38, dy: 58, type: 'dumpster' },
      { dx: 70, dy: 56, type: 'milk_crate_stack' },
      // 奥: 路地裏の猫
      { dx: 38, dy: 70, type: 'cat' },
      // 最奥: 裏路地の電柱と街灯で framing
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 24, dy: 88, type: 'street_lamp' },
      { dx: 50, dy: 88, type: 'street_lamp' },
      { dx: 76, dy: 86, type: 'power_pole' },
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
      // スタッフ用車庫
      { dx: 32, dy: 42, size: 'garage' },
    ],
    furniture: [
      // 派手な前面: のぼり旗、提灯、自転車ラック
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 15, dy:  7, type: 'banner_pole' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 50, dy:  7, type: 'banner_pole' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 第 2 列: 大量の赤提灯 (派手な娯楽街区)
      { dx:  6, dy: 14, type: 'chouchin' },
      { dx: 15, dy: 14, type: 'chouchin' },
      { dx: 26, dy: 14, type: 'chouchin' },
      { dx: 38, dy: 14, type: 'chouchin' },
      { dx: 50, dy: 14, type: 'chouchin' },
      { dx: 60, dy: 14, type: 'chouchin' },
      // 中前層: 室外機 + 自販機
      { dx:  6, dy: 24, type: 'ac_unit' },
      { dx: 60, dy: 24, type: 'vending' },
      // 中後層: 搬入ダンプスター 2 つ + 牛乳ケース
      { dx:  6, dy: 56, type: 'dumpster' },
      { dx: 32, dy: 58, type: 'milk_crate_stack' },
      { dx: 60, dy: 56, type: 'dumpster' },
      // 最奥: 裏路地
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 32, dy: 88, type: 'street_lamp' },
      { dx: 68, dy: 86, type: 'power_pole' },
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
      // 店裏の共用倉庫
      { dx: 32, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 店頭: カフェのテラス (パラソル + 盆栽)、書店の A 型看板、薬局のテント
      { dx: -1, dy:  4, type: 'parasol' },
      { dx:  4, dy:  4, type: 'bonsai' },
      { dx: 21, dy:  5, type: 'street_lamp' },
      { dx: 32, dy:  4, type: 'a_frame_sign' },
      { dx: 43, dy:  5, type: 'street_lamp' },
      { dx: 54, dy:  6, type: 'shop_awning' },
      { dx: 65, dy:  3, type: 'potted_plant' },
      // 前庭: 共用駐輪と猫
      { dx: 32, dy: 24, type: 'bicycle_rack' },
      { dx: 18, dy: 26, type: 'cat' },
      // 中前層: 室外機
      { dx: 10, dy: 22, type: 'ac_unit' },
      { dx: 54, dy: 22, type: 'ac_unit' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 68, dy: 68, type: 'power_pole' },
      // 最奥: 桜 2 本で framing
      { dx: 14, dy: 90, type: 'sakura_tree' },
      { dx: 50, dy: 90, type: 'sakura_tree' },
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
      // 店裏の共用倉庫 2 棟
      { dx: 16, dy: 42, size: 'shed' },
      { dx: 54, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 店頭: 雑貨店 A 型看板、レストランのテント + 暖簾、もう 1 軒に看板
      { dx:  0, dy:  4, type: 'parasol' },
      { dx: 11, dy:  4, type: 'a_frame_sign' },
      { dx: 23, dy:  4, type: 'potted_plant' },
      { dx: 35, dy:  6, type: 'shop_awning' },
      { dx: 47, dy:  4, type: 'potted_plant' },
      { dx: 59, dy:  4, type: 'a_frame_sign' },
      { dx: 72, dy:  4, type: 'parasol' },
      // 第 2 列: レストランの暖簾
      { dx: 35, dy: 14, type: 'noren' },
      // 中前層: 室外機
      { dx: 11, dy: 24, type: 'ac_unit' },
      { dx: 59, dy: 24, type: 'ac_unit' },
      // 中後層: 搬入と LP ガスボンベ
      { dx:  4, dy: 56, type: 'dumpster' },
      { dx: 35, dy: 56, type: 'gas_canister' },
      { dx: 68, dy: 56, type: 'dumpster' },
      // 最奥: 裏路地の電柱と街灯で framing
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 24, dy: 88, type: 'street_lamp' },
      { dx: 48, dy: 88, type: 'street_lamp' },
      { dx: 74, dy: 86, type: 'power_pole' },
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
      // 共用の物置
      { dx: 32, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 前面: 木塀で街区を囲み、各戸に鉢植えと郵便受け
      { dx: -1, dy:  2, type: 'wood_fence' },
      { dx: 10, dy:  4, type: 'potted_plant' },
      { dx: 32, dy:  4, type: 'potted_plant' },
      { dx: 54, dy:  4, type: 'potted_plant' },
      { dx: 65, dy:  2, type: 'wood_fence' },
      // 玄関アプローチ: 各戸に郵便受け
      { dx: 10, dy: 14, type: 'mailbox' },
      { dx: 32, dy: 14, type: 'mailbox' },
      { dx: 54, dy: 14, type: 'mailbox' },
      // 中前層: 各戸の側面に室外機
      { dx: 21, dy: 22, type: 'ac_unit' },
      { dx: 43, dy: 22, type: 'ac_unit' },
      // 中後層: 共用の物干し竿と LP ガスボンベ
      { dx: 10, dy: 50, type: 'laundry_pole' },
      { dx: 54, dy: 52, type: 'gas_canister' },
      // 奥: 電柱 2 本 + 縁側の猫
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 32, dy: 70, type: 'cat' },
      { dx: 66, dy: 68, type: 'power_pole' },
      // 最奥: 中央の街灯
      { dx: 32, dy: 90, type: 'street_lamp' },
    ],
  },

  // コンセプト: 神社の境内一区画。前面は参道 (桜の門と狛犬)、中央に
  // 本殿、本殿の背後は cell の縦を深く使った鎮守の森 — 松と竹が
  // 3 層重ねで奥まで続く。境内の奥行きで cell 全体を聖域化。
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy:  0, size: 'shrine' },
      // 奥宮 (神域の深さ)
      { dx: 34, dy: 60, size: 'temple' },
    ],
    furniture: [
      // 参道: 朱色の鳥居 + 左右に狛犬と桜
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 18, dy:  5, type: 'statue' },     // 狛犬
      { dx: 34, dy:  6, type: 'torii' },      // 鳥居
      { dx: 50, dy:  5, type: 'statue' },     // 狛犬
      { dx: 66, dy:  4, type: 'sakura_tree' },
      // 第 2 列: 注連縄と石灯籠
      { dx: 12, dy: 14, type: 'stone_lantern' },
      { dx: 34, dy: 14, type: 'shinto_rope' },
      { dx: 56, dy: 14, type: 'stone_lantern' },
      // 中前層: 賽銭箱と参道脇の竹
      { dx:  8, dy: 24, type: 'bamboo_cluster' },
      { dx: 34, dy: 26, type: 'offering_box' },
      { dx: 60, dy: 24, type: 'bamboo_cluster' },
      // 中後層: 鎮守の森 + 庭石
      { dx:  6, dy: 44, type: 'pine_tree' },
      { dx: 22, dy: 46, type: 'rock' },
      { dx: 46, dy: 46, type: 'rock' },
      { dx: 62, dy: 44, type: 'pine_tree' },
      // 最奥: 中央に松を高く、両脇に竹
      { dx:  4, dy: 88, type: 'bamboo_cluster' },
      { dx: 34, dy: 90, type: 'pine_tree' },
      { dx: 64, dy: 88, type: 'bamboo_cluster' },
    ],
  },

  // コンセプト: 禅寺の一区画。前面に山門と石灯籠、本堂。本堂の
  // 背後は裏山で、松林と竹林が cell の奥まで深く続く。寺の庭と
  // 裏山の境界が曖昧な日本の寺院風景。
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy:  0, size: 'temple' },
      // 茶室 (庭園の奥)
      { dx: 44, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 山門前の庭: 松と石灯籠
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 12, dy:  4, type: 'stone_lantern' },
      { dx: 22, dy:  6, type: 'offering_box' }, // 賽銭箱
      { dx: 32, dy:  4, type: 'stone_lantern' },
      { dx: 60, dy:  4, type: 'pine_tree' },
      // 中前層: 飛石と庭園の竹
      { dx: 10, dy: 24, type: 'bamboo_cluster' },
      { dx: 32, dy: 26, type: 'stepping_stones' },
      // 中後層: 鯉池 + 庭石 + 茶室への飛石
      { dx: 16, dy: 52, type: 'koi_pond' },
      { dx: 32, dy: 54, type: 'rock' },
      // 奥: 裏山の松と庭石
      { dx: -2, dy: 70, type: 'pine_tree' },
      { dx: 22, dy: 72, type: 'rock' },
      { dx: 62, dy: 70, type: 'pine_tree' },
      // 最奥: 中央に竹、両脇に松
      { dx: 10, dy: 88, type: 'pine_tree' },
      { dx: 32, dy: 90, type: 'bamboo_cluster' },
      { dx: 54, dy: 88, type: 'pine_tree' },
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
      // 検査・プレハブ倉庫
      { dx: 30, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 前面: 生垣で敷地を閉じ、両院の看板、保育園にカーブミラー
      { dx: -2, dy:  1, type: 'hedge' },
      { dx: 13, dy:  5, type: 'sign_board' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 60, dy:  4, type: 'street_mirror' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 前庭: 保育園側に桜 + 鉢植え
      { dx: 46, dy: 24, type: 'sakura_tree' },
      { dx: 60, dy: 24, type: 'potted_plant' },
      // 中前層: 室外機
      { dx: 13, dy: 22, type: 'ac_unit' },
      // 中後層: 物干し竿 (検査室の白衣)
      { dx: 13, dy: 52, type: 'laundry_pole' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 68, dy: 68, type: 'power_pole' },
      // 最奥: 中央の街灯
      { dx: 34, dy: 90, type: 'street_lamp' },
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
      // 緊急車両の車庫
      { dx: 34, dy: 42, size: 'garage' },
    ],
    furniture: [
      // 前面: 出動口のバリア、旗竿、中央に信号機、消火栓
      { dx: -2, dy:  3, type: 'bollard' },
      { dx:  4, dy:  4, type: 'hydrant' },
      { dx: 15, dy:  6, type: 'flag_pole' },
      { dx: 34, dy:  5, type: 'traffic_light' },
      { dx: 53, dy:  6, type: 'flag_pole' },
      { dx: 64, dy:  4, type: 'hydrant' },
      { dx: 68, dy:  3, type: 'bollard' },
      // 第 2 列: 訓練用の土のう
      { dx: 15, dy: 14, type: 'sandbags' },
      { dx: 53, dy: 14, type: 'sandbags' },
      // 中後層: 配電箱とブルーシート (訓練用)
      { dx:  4, dy: 58, type: 'electric_box' },
      { dx: 34, dy: 56, type: 'tarp' },
      { dx: 66, dy: 58, type: 'electric_box' },
      // 最奥: 裏路地の電柱と街灯
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 34, dy: 88, type: 'street_lamp' },
      { dx: 72, dy: 86, type: 'power_pole' },
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
      // 仕分け倉庫
      { dx: 30, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 前面: ATM・看板・郵便ポスト・カーブミラー
      { dx:  2, dy:  4, type: 'atm' },
      { dx: 14, dy:  5, type: 'sign_board' },
      { dx: 30, dy:  4, type: 'street_mirror' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 58, dy:  4, type: 'post_box' },
      // 中前層: 室外機
      { dx: 14, dy: 22, type: 'ac_unit' },
      { dx: 46, dy: 22, type: 'ac_unit' },
      // 中後層: 配電箱 2 つ
      { dx:  4, dy: 56, type: 'electric_box' },
      { dx: 58, dy: 56, type: 'electric_box' },
      // 最奥: 電柱と街灯
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 30, dy: 88, type: 'street_lamp' },
      { dx: 64, dy: 86, type: 'power_pole' },
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
      // 豪邸の茶室
      { dx: 20, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 前面: 木塀で豪邸の格、門前に松と石灯籠
      { dx: -2, dy:  2, type: 'wood_fence' },
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 16, dy:  5, type: 'stone_lantern' },
      { dx: 30, dy:  4, type: 'pine_tree' },
      { dx: 34, dy:  2, type: 'wood_fence' },
      { dx: 49, dy:  4, type: 'a_frame_sign' },
      // 前庭: 豪邸側の竹と盆栽、雑貨店側に鉢植え
      { dx:  8, dy: 24, type: 'bamboo_cluster' },
      { dx: 24, dy: 24, type: 'bonsai' },
      { dx: 49, dy: 22, type: 'potted_plant' },
      // 中後層: 茶室前の飛石と石灯籠
      { dx: 12, dy: 54, type: 'stone_lantern' },
      { dx: 32, dy: 56, type: 'stepping_stones' },
      // 奥: 庭園の鯉池と松
      { dx:  4, dy: 68, type: 'pine_tree' },
      { dx: 36, dy: 70, type: 'koi_pond' },
      { dx: 56, dy: 68, type: 'pine_tree' },
      // 最奥: 中央の桜、両脇の松で framing
      { dx: -2, dy: 90, type: 'pine_tree' },
      { dx: 32, dy: 92, type: 'sakura_tree' },
      { dx: 62, dy: 90, type: 'pine_tree' },
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
      // 駅裏の詰所
      { dx: 35, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 広場: 両端にバス停、中央に旗竿、自転車ラック
      { dx: -1, dy:  5, type: 'bus_stop' },
      { dx: 12, dy:  4, type: 'a_frame_sign' },   // 駅前広告
      { dx: 22, dy:  4, type: 'bicycle_rack' },
      { dx: 35, dy:  6, type: 'flag_pole' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 58, dy:  4, type: 'newspaper_stand' },
      { dx: 71, dy:  5, type: 'bus_stop' },
      // 第 2 列: カーブミラー + 駅前提灯 (祭りの名残)
      { dx:  4, dy: 14, type: 'street_mirror' },
      { dx: 22, dy: 14, type: 'chouchin' },
      { dx: 48, dy: 14, type: 'chouchin' },
      // 中前層: 広場中央の銅像
      { dx: 35, dy: 26, type: 'statue' },
      // 中後層: 駅裏の電気設備
      { dx:  4, dy: 56, type: 'electric_box' },
      { dx: 66, dy: 56, type: 'electric_box' },
      // 最奥: 駅裏の桜並木 (両脇に電柱)
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 18, dy: 88, type: 'sakura_tree' },
      { dx: 52, dy: 88, type: 'sakura_tree' },
      { dx: 72, dy: 86, type: 'power_pole' },
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
      // 搬入用の業務ガレージ
      { dx: 37, dy: 46, size: 'garage' },
    ],
    furniture: [
      // 前庭広場: 左右対称に街灯と旗幟、中央に噴水
      { dx:  2, dy:  5, type: 'street_lamp' },
      { dx: 14, dy:  4, type: 'a_frame_sign' },   // セール看板
      { dx: 25, dy:  5, type: 'banner_pole' },
      { dx: 37, dy:  6, type: 'fountain' },
      { dx: 49, dy:  5, type: 'banner_pole' },
      { dx: 60, dy:  4, type: 'a_frame_sign' },
      { dx: 72, dy:  5, type: 'street_lamp' },
      // 第 2 列: 大きなショップアウニング
      { dx: 37, dy: 14, type: 'shop_awning' },
      // 中前層: 植栽帯 + 鉢植え
      { dx: 14, dy: 24, type: 'planter' },
      { dx: 25, dy: 26, type: 'potted_plant' },
      { dx: 49, dy: 26, type: 'potted_plant' },
      { dx: 60, dy: 24, type: 'planter' },
      // 中後層: 室外機 + 電気設備
      { dx:  4, dy: 56, type: 'ac_unit' },
      { dx: 70, dy: 56, type: 'ac_unit' },
      // 最奥: 裏路地の電柱で framing
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 37, dy: 88, type: 'street_lamp' },
      { dx: 76, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 総合病院の街区。前面は生垣で囲まれた正面ロータリー
  // (旗竿・ベンチ・看板・ボラード・消火栓)、救急車入口。
  // 中層は職員駐車場と電気設備、奥は裏庭で街灯と木立。
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, dy:  0, size: 'hospital' },
      // 救急別棟
      { dx:  8, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 正面ロータリー: 生垣で囲み、旗竿と看板、消火栓
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  6, dy:  5, type: 'flag_pole' },
      { dx: 16, dy:  4, type: 'street_mirror' },  // 救急用のミラー
      { dx: 27, dy:  5, type: 'sign_board' },
      { dx: 38, dy:  4, type: 'bollard' },
      { dx: 52, dy:  4, type: 'hydrant' },
      { dx: 66, dy:  1, type: 'hedge' },
      // 前庭: 中央の花壇 + 鉢植え
      { dx: 16, dy: 24, type: 'potted_plant' },
      { dx: 27, dy: 24, type: 'flower_bed' },
      { dx: 38, dy: 24, type: 'potted_plant' },
      // 中前層: 室外機 (病院の大型空調)
      { dx: 52, dy: 22, type: 'ac_unit' },
      // 中後層: 別棟脇の白衣物干しと洗濯 (療養感)
      { dx:  8, dy: 56, type: 'laundry_pole' },
      { dx: 52, dy: 58, type: 'electric_box' },
      // 最奥: 療養のための静かな木立
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 30, dy: 90, type: 'sakura_tree' },
      { dx: 68, dy: 86, type: 'power_pole' },
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
      // 体育館
      { dx: 36, dy: 44, size: 'garage' },
    ],
    furniture: [
      // 校門: 生垣、桜、旗竿、看板
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 10, dy:  5, type: 'flag_pole' },
      { dx: 36, dy:  5, type: 'sign_board' },
      { dx: 62, dy:  5, type: 'flag_pole' },
      { dx: 72, dy:  4, type: 'sakura_tree' },
      { dx: 74, dy:  1, type: 'hedge' },
      // 第 2 列: 校舎前の鉢植えとカーブミラー
      { dx: 18, dy: 14, type: 'potted_plant' },
      { dx: 54, dy: 14, type: 'potted_plant' },
      // 前庭: 二宮金次郎像 (中央)
      { dx: 36, dy: 26, type: 'statue' },
      // 中後層: 体育倉庫脇の土のうと用具
      { dx: 12, dy: 56, type: 'sandbags' },
      { dx: 60, dy: 56, type: 'sandbags' },
      // 最奥: 学校裏の松林 (3 本で森を示唆)
      { dx:  4, dy: 86, type: 'pine_tree' },
      { dx: 36, dy: 90, type: 'pine_tree' },
      { dx: 68, dy: 86, type: 'pine_tree' },
    ],
  },

  // コンセプト: 市役所の街区。前面は左右対称の格式ある広場 (噴水・
  // 旗竿 2 本・銅像 2 体・ベンチ・生垣)。中層は広場の植栽帯。
  // 奥は市役所の裏庭で松林の庭園、最奥に街灯。
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy:  0, size: 'city_hall' },
      // 裏庭の茶室 — 市役所の文化的深さ
      { dx: 32, dy: 60, size: 'temple' },
    ],
    furniture: [
      // 前庭: 左右対称の格式ある広場
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  6, type: 'flag_pole' },
      { dx: 12, dy:  5, type: 'statue' },
      { dx: 32, dy:  7, type: 'fountain' },
      { dx: 52, dy:  5, type: 'statue' },
      { dx: 62, dy:  6, type: 'flag_pole' },
      { dx: 72, dy:  1, type: 'hedge' },
      // 中前層: 植栽帯 (左右対称) + 盆栽
      { dx: 12, dy: 26, type: 'planter' },
      { dx: 32, dy: 24, type: 'bonsai' },
      { dx: 52, dy: 26, type: 'planter' },
      // 中後層: 茶室前の石灯籠と飛石
      { dx: 16, dy: 50, type: 'stone_lantern' },
      { dx: 32, dy: 52, type: 'stepping_stones' },
      { dx: 48, dy: 50, type: 'stone_lantern' },
      // 奥: 庭園の鯉池
      { dx: 32, dy: 76, type: 'koi_pond' },
      // 最奥: 裏庭の桜並木 (左右対称)
      { dx: 14, dy: 90, type: 'sakura_tree' },
      { dx: 50, dy: 90, type: 'sakura_tree' },
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
      // ビル裏の業務倉庫 2 棟
      { dx: 30, dy: 64, size: 'shed' },
      { dx: 68, dy: 64, size: 'shed' },
    ],
    furniture: [
      // 歩道: ボラード、看板、消火栓 (都市インフラ)
      { dx:  0, dy:  3, type: 'bollard' },
      { dx: 15, dy:  5, type: 'sign_board' },
      { dx: 32, dy:  4, type: 'hydrant' },
      { dx: 48, dy:  5, type: 'sign_board' },
      { dx: 65, dy:  4, type: 'hydrant' },
      { dx: 82, dy:  5, type: 'sign_board' },
      { dx:100, dy:  3, type: 'bollard' },
      // 第 2 列: 鉢植えの並木
      { dx: 15, dy: 14, type: 'potted_plant' },
      { dx: 48, dy: 14, type: 'potted_plant' },
      { dx: 82, dy: 14, type: 'potted_plant' },
      // 中前層: ビル前の街灯
      { dx: 15, dy: 26, type: 'street_lamp' },
      { dx: 48, dy: 26, type: 'street_lamp' },
      { dx: 82, dy: 26, type: 'street_lamp' },
      // 中後層: ビル屋上の業務空調 (室外機)
      { dx: 15, dy: 50, type: 'ac_unit' },
      { dx: 48, dy: 52, type: 'ac_unit' },
      { dx: 82, dy: 50, type: 'ac_unit' },
      // 最奥: 都市部の硬質な framing
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 48, dy: 90, type: 'tree' },
      { dx:102, dy: 86, type: 'power_pole' },
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
      // 管理人室
      { dx: 24, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 前面: 生垣、時計塔前に街灯、マンション入口
      { dx: -1, dy:  1, type: 'hedge' },
      { dx: 10, dy:  5, type: 'street_lamp' },
      { dx: 24, dy:  4, type: 'a_frame_sign' },
      { dx: 36, dy:  5, type: 'mailbox' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 61, dy:  1, type: 'hedge' },
      // 第 2 列: 鉢植え
      { dx: 36, dy: 14, type: 'potted_plant' },
      // 中前層: マンション住民の物干し
      { dx: 36, dy: 22, type: 'laundry_pole' },
      // 中後層: 室外機
      { dx: 36, dy: 56, type: 'ac_unit' },
      // 最奥: 住宅地らしい桜並木 + 屋根の上の猫
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 12, dy: 88, type: 'cat' },
      { dx: 24, dy: 90, type: 'sakura_tree' },
      { dx: 62, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 映画館の街区。前面はマーキー (banner_pole) と
  // 待ち客スペース (ベンチ・新聞スタンド・自販機)。中層はロビー
  // 裏の大看板。奥は搬入口 (ダンプスター・電気設備)、最奥は裏路地。
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy:  0, size: 'movie_theater' },
      // 併設図書館 (文化地区)
      { dx: 44, dy: 44, size: 'townhouse' },
    ],
    furniture: [
      // 前面: マーキーのバナー、A 型看板、待ち客設備
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 12, dy:  4, type: 'a_frame_sign' },
      { dx: 22, dy:  5, type: 'sign_board' },
      { dx: 40, dy:  3, type: 'bench' },
      { dx: 54, dy:  3, type: 'vending' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 第 2 列: 提灯 (映画館の和風アクセント)
      { dx: 12, dy: 14, type: 'chouchin' },
      { dx: 32, dy: 14, type: 'chouchin' },
      // 中前層: 室外機 (映画館の業務空調)
      { dx:  4, dy: 22, type: 'ac_unit' },
      // 中後層: 図書館前の盆栽
      { dx: 44, dy: 56, type: 'bonsai' },
      // 最奥: 文化地区らしい桜
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 22, dy: 90, type: 'sakura_tree' },
      { dx: 68, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 博物館の街区。前庭は格式ある庭園 (松のシンメトリー・
  // 銅像・旗竿)、中層は植栽帯、奥は裏庭で松林が cell の最奥まで
  // 深く続く伝統的な公共建築の風景。
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, dy:  0, size: 'museum' },
      // 収蔵庫
      { dx: 22, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 前庭: シンメトリーな松と旗竿、中央に銅像
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  0, dy:  4, type: 'pine_tree' },
      { dx:  8, dy:  5, type: 'flag_pole' },
      { dx: 22, dy:  6, type: 'statue' },
      { dx: 38, dy:  5, type: 'flag_pole' },
      { dx: 46, dy:  4, type: 'pine_tree' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 第 2 列: 石灯籠 (前庭の格式)
      { dx: 22, dy: 14, type: 'stone_lantern' },
      // 中前層: 盆栽 (左右対称)
      { dx:  6, dy: 24, type: 'bonsai' },
      { dx: 38, dy: 24, type: 'bonsai' },
      // 中後層: 庭石 + 飛石
      { dx:  4, dy: 56, type: 'rock' },
      { dx: 22, dy: 56, type: 'stepping_stones' },
      { dx: 40, dy: 56, type: 'rock' },
      // 最奥: 深い松林の庭園
      { dx:  2, dy: 88, type: 'bamboo_cluster' },
      { dx: 22, dy: 90, type: 'pine_tree' },
      { dx: 46, dy: 88, type: 'bamboo_cluster' },
    ],
  },

  // コンセプト: 郊外型スーパーの街区。左は建物、右は駐車場 (3 台)、
  // ボラードで区画分離。中層は駐車場の街灯。奥は搬入口で電気設備と
  // ダンプスター、最奥は裏路地の電柱。
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy:  0, size: 'supermarket' },
      // 生鮮搬入棟
      { dx: 10, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 店頭: 自販機、A 型看板、看板、ショップアウニング
      { dx:  2, dy:  3, type: 'vending' },
      { dx: 10, dy:  4, type: 'a_frame_sign' },
      { dx: 20, dy:  6, type: 'shop_awning' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 40, dy:  3, type: 'bollard' },
      { dx: 72, dy:  3, type: 'bollard' },
      // 第 2 列: 鉢植えと郵便ポスト
      { dx:  2, dy: 14, type: 'potted_plant' },
      { dx: 32, dy: 14, type: 'post_box' },
      // 中前層: 駐車場の街灯
      { dx: 56, dy: 26, type: 'street_lamp' },
      // 中後層: 搬入のダンプスター + 牛乳ケース + ブルーシート
      { dx: 22, dy: 58, type: 'milk_crate_stack' },
      { dx: 40, dy: 58, type: 'dumpster' },
      { dx: 56, dy: 58, type: 'tarp' },
      // 最奥: 裏路地の電柱と木
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 40, dy: 90, type: 'tree' },
      { dx: 74, dy: 86, type: 'power_pole' },
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
      // 選手入場の業務ガレージ
      { dx: 30, dy: 46, size: 'garage' },
    ],
    furniture: [
      // 入場口: バナーとボラード、ロープ柵、A 型看板
      { dx: -1, dy:  5, type: 'banner_pole' },
      { dx: 14, dy:  3, type: 'bollard' },
      { dx: 22, dy:  4, type: 'a_frame_sign' },
      { dx: 30, dy:  6, type: 'sign_board' },
      { dx: 38, dy:  4, type: 'bollard' },
      { dx: 46, dy:  3, type: 'bollard' },
      { dx: 60, dy:  5, type: 'banner_pole' },
      { dx: 80, dy:  4, type: 'sign_board' },
      // 第 2 列: ブルーシート (試合前準備)
      { dx: 14, dy: 14, type: 'sandbags' },
      { dx: 46, dy: 14, type: 'sandbags' },
      // 中前層: 無線塔側の電気設備、スタジアム側の室外機
      { dx: 30, dy: 24, type: 'ac_unit' },
      { dx: 80, dy: 26, type: 'electric_box' },
      // 中後層: 搬入用ブルーシート
      { dx: 12, dy: 56, type: 'tarp' },
      { dx: 56, dy: 58, type: 'milk_crate_stack' },
      // 最奥: 敷地を囲う街路樹
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 30, dy: 90, type: 'tree' },
      { dx: 92, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 観覧車の遊園地一区画。前面は入場口 (バナー・看板)、
  // 待ちエリア (ベンチ・パラソル・露店)、生垣で敷地を囲む。
  // 中層は広場の街灯と植栽、奥は桜の並木と電柱で遊園地の後端。
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy:  0, size: 'ferris_wheel' },
      // 屋台小屋
      { dx: 50, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 入場口: 生垣、バナー、看板、屋台、旗竿
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  5, type: 'banner_pole' },
      { dx: 12, dy:  4, type: 'a_frame_sign' },
      { dx: 22, dy:  6, type: 'sign_board' },
      { dx: 50, dy:  3, type: 'parasol' },
      { dx: 56, dy:  4, type: 'bench' },
      { dx: 65, dy:  5, type: 'flag_pole' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 第 2 列: 屋台前の提灯 (祭りの雰囲気)
      { dx: 22, dy: 14, type: 'chouchin' },
      { dx: 38, dy: 14, type: 'chouchin' },
      { dx: 50, dy: 14, type: 'chouchin' },
      // 中前層: 鉢植えと噴水
      { dx: 14, dy: 24, type: 'potted_plant' },
      { dx: 50, dy: 24, type: 'potted_plant' },
      // 中後層: 屋台脇の牛乳ケース
      { dx: 50, dy: 56, type: 'milk_crate_stack' },
      // 最奥: 園地を囲む桜 3 本
      { dx: 14, dy: 88, type: 'sakura_tree' },
      { dx: 34, dy: 90, type: 'sakura_tree' },
      { dx: 54, dy: 88, type: 'sakura_tree' },
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
      // ポンプ室
      { dx: 10, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 前面: 給水塔の電気設備、マンションの郵便受けと駐輪
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'electric_box' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 26, dy:  4, type: 'street_mirror' },
      { dx: 32, dy:  5, type: 'mailbox' },
      { dx: 42, dy:  4, type: 'bicycle_rack' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 中前層: 給水塔の追加設備、マンションの物干し
      { dx:  2, dy: 22, type: 'water_tank' },
      { dx: 42, dy: 22, type: 'laundry_pole' },
      // 中後層: 室外機 (集合住宅)
      { dx: 42, dy: 56, type: 'ac_unit' },
      // 最奥: 裏路地と街路樹 + 縁側の猫
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 30, dy: 90, type: 'tree' },
      { dx: 50, dy: 88, type: 'cat' },
      { dx: 62, dy: 86, type: 'power_pole' },
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
