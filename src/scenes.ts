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
      // 前面: 3 戸の玄関前に花壇、両端を生垣で閉じる
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 28, dy:  4, type: 'flower_bed' },
      { dx: 48, dy:  4, type: 'flower_bed' },
      { dx: 58, dy:  1, type: 'hedge' },
      // 前庭: 中央の 1 軒に自転車だけ (全戸に置かず余白を残す)
      { dx: 28, dy: 24, type: 'bicycle' },
      // 裏路地: 電柱 2 本と集積所 1 つで "街区の後端" を最小表現
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 28, dy: 68, type: 'garbage' },
      { dx: 58, dy: 66, type: 'power_pole' },
      // 最奥: 中央に共用の桜、両脇の木で framing
      { dx:  8, dy: 86, type: 'tree' },
      { dx: 28, dy: 88, type: 'sakura_tree' },
      { dx: 48, dy: 86, type: 'tree' },
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
      { dx: 10, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 前面: 住宅は花壇、コンビニは看板と自販機
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 32, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'vending' },
      // 中後層: コンビニ裏の搬入 (ダンプスター 1 つで役割を示す)
      { dx: 42, dy: 50, type: 'dumpster' },
      // 奥: 電柱 2 本のみ
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 58, dy: 66, type: 'power_pole' },
      // 最奥: 中央に 1 本、両脇に低木
      { dx: 10, dy: 86, type: 'bush' },
      { dx: 30, dy: 88, type: 'tree' },
      { dx: 50, dy: 86, type: 'bush' },
    ],
  },

  // コンセプト: 家とガレージの住宅街区。前面は玄関と駐車の車。中層は
  // 裏庭にビニールハウス (家庭菜園)、奥は裏路地で電柱と木立。
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 30, dy:  0, size: 'garage' },
      // 裏の家庭菜園ビニールハウス 1 棟だけ
      { dx: 20, dy: 36, size: 'greenhouse' },
    ],
    furniture: [
      // 前面: 生垣で敷地を閉じ、玄関と駐車スペース
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 48, dy:  1, type: 'hedge' },
      // 前庭: 玄関ポーチの郵便受け 1 つ
      { dx:  8, dy: 14, type: 'mailbox' },
      // 中後層: ハウス脇の菜園
      { dx: 40, dy: 50, type: 'flower_bed' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 50, dy: 66, type: 'power_pole' },
      // 最奥: 防風林 (両脇)
      { dx:  8, dy: 86, type: 'tree' },
      { dx: 40, dy: 86, type: 'tree' },
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
      // 前面: 敷地の境界を bush だけで示す
      { dx: -2, dy:  2, type: 'bush' },
      { dx: 44, dy:  2, type: 'bush' },
      // 前庭の畝 2 つ
      { dx:  6, dy: 24, type: 'flower_bed' },
      { dx: 38, dy: 24, type: 'flower_bed' },
      // 奥の畑 (ハウス脇)
      { dx:  4, dy: 66, type: 'flower_bed' },
      // 最奥: 防風林
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 22, dy: 88, type: 'tree' },
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
      { dx: 20, dy: 38, size: 'garage' },
    ],
    furniture: [
      // 店頭: 左右対称の構成
      { dx:  0, dy:  3, type: 'vending' },
      { dx: 14, dy:  6, type: 'sign_board' },
      { dx: 28, dy:  3, type: 'bicycle_rack' },
      // 中後層: 搬入のダンプスター 1 つ
      { dx:  6, dy: 52, type: 'dumpster' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 42, dy: 66, type: 'power_pole' },
      // 最奥: 空地の木と低木
      { dx: 14, dy: 88, type: 'tree' },
      { dx: 30, dy: 86, type: 'bush' },
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
      // 2 店共有の業務倉庫 1 棟 (中央)
      { dx: 22, dy: 36, size: 'shed' },
    ],
    furniture: [
      // 店頭: 両店の入口にパラソル、中央に自販機
      { dx: 10, dy:  5, type: 'parasol' },
      { dx: 22, dy:  3, type: 'vending' },
      { dx: 34, dy:  5, type: 'parasol' },
      // 提灯 (banner) を店舗の上に 1 本ずつ
      { dx: 10, dy: 13, type: 'banner_pole' },
      { dx: 34, dy: 13, type: 'banner_pole' },
      // 中後層: 搬入のダンプスター 2 つ (両店の裏口を示す)
      { dx:  6, dy: 50, type: 'dumpster' },
      { dx: 42, dy: 50, type: 'dumpster' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
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
      // 店頭: 花の陳列を両端に、パラソルを両店頭に
      { dx: -2, dy:  3, type: 'flower_bed' },
      { dx:  8, dy:  5, type: 'parasol' },
      { dx: 26, dy:  5, type: 'parasol' },
      { dx: 38, dy:  3, type: 'flower_bed' },
      // 中後層: ハウス脇の植栽トレイ 1 つ
      { dx:  4, dy: 54, type: 'planter' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 42, dy: 66, type: 'power_pole' },
      // 最奥: 桜を中央に
      { dx: 17, dy: 88, type: 'sakura_tree' },
    ],
  },

  // コンセプト: ガソリンスタンド街区。前面は給油エリア (価格看板・バナー・
  // ボラード・駐車中の車)。中層は敷地内の油タンクと洗車用設備。
  // 奥はフェンスの外の裏路地を示す電柱と木。
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy:  0, size: 'gas_station' },
      // 整備工場 (裏側)
      { dx: 22, dy: 36, size: 'garage' },
    ],
    furniture: [
      // 給油エリア: ボラード、看板、消火器
      { dx: -1, dy:  2, type: 'bollard' },
      { dx: 16, dy:  7, type: 'banner_pole' },
      { dx: 34, dy:  2, type: 'bollard' },
      { dx: 42, dy:  3, type: 'fire_extinguisher' },
      // 中後層: 整備工場前のツール 1 つ
      { dx:  4, dy: 52, type: 'electric_box' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 48, dy: 68, type: 'power_pole' },
      // 最奥: 境界の雑木 2 本
      { dx: 12, dy: 88, type: 'tree' },
      { dx: 36, dy: 88, type: 'tree' },
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
      // 共用のボイラー室 (中央)
      { dx: 22, dy: 36, size: 'shed' },
    ],
    furniture: [
      // 店頭: 両店頭に看板、間に自販機
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 22, dy:  3, type: 'vending' },
      { dx: 33, dy:  5, type: 'sign_board' },
      // 前庭: 中央に共用の駐輪
      { dx: 22, dy: 24, type: 'bicycle_rack' },
      // 中後層: ボイラー配管 (electric_box 1 つ)
      { dx:  6, dy: 52, type: 'electric_box' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 48, dy: 66, type: 'power_pole' },
      // 最奥: 住宅との境の木立
      { dx: 10, dy: 86, type: 'tree' },
      { dx: 33, dy: 86, type: 'tree' },
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
      // 裏庭の共用物置 1 棟 (中央)
      { dx: 22, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 店頭: パラソル・ベンチ・看板・新聞スタンド
      { dx: -1, dy:  3, type: 'parasol' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 22, dy:  3, type: 'bench' },
      { dx: 33, dy:  3, type: 'newspaper_stand' },
      // 前庭: 中央の桜 (裏庭の入口)
      { dx: 22, dy: 26, type: 'sakura_tree' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 46, dy: 66, type: 'power_pole' },
      // 最奥: 中央に桜
      { dx: 22, dy: 88, type: 'sakura_tree' },
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
      // 4 店共有の業務倉庫 2 棟 (幅が広い商店街なので 2 棟許容)
      { dx: 19, dy: 42, size: 'shed' },
      { dx: 55, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 店前: のぼり旗 4 本 (各店入口) + 両端にパラソル
      { dx:  0, dy:  3, type: 'parasol' },
      { dx: 10, dy:  6, type: 'banner_pole' },
      { dx: 28, dy:  6, type: 'banner_pole' },
      { dx: 47, dy:  6, type: 'banner_pole' },
      { dx: 64, dy:  6, type: 'banner_pole' },
      { dx: 74, dy:  3, type: 'parasol' },
      // 中後層: 搬入 (両端にダンプスター)
      { dx:  4, dy: 58, type: 'dumpster' },
      { dx: 70, dy: 58, type: 'dumpster' },
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
      // スタッフ用車庫 1 棟 (中央裏)
      { dx: 32, dy: 42, size: 'garage' },
    ],
    furniture: [
      // 派手な前面: のぼり旗 4 本 + 自転車
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 15, dy:  7, type: 'banner_pole' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 50, dy:  7, type: 'banner_pole' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 中後層: 搬入ダンプスター 2 つ (両端)
      { dx:  6, dy: 58, type: 'dumpster' },
      { dx: 60, dy: 58, type: 'dumpster' },
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
      // 店裏の共用倉庫 1 棟 (中央)
      { dx: 32, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 店頭: パラソル / 街灯 / 看板を左右対称に
      { dx: -1, dy:  4, type: 'parasol' },
      { dx: 21, dy:  5, type: 'street_lamp' },
      { dx: 32, dy:  3, type: 'newspaper_stand' },
      { dx: 43, dy:  5, type: 'street_lamp' },
      { dx: 65, dy:  4, type: 'parasol' },
      // 前庭: 中央に共用駐輪
      { dx: 32, dy: 24, type: 'bicycle_rack' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 68, dy: 68, type: 'power_pole' },
      // 最奥: 桜 2 本で framing
      { dx: 14, dy: 88, type: 'sakura_tree' },
      { dx: 50, dy: 88, type: 'sakura_tree' },
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
      // 店裏の共用倉庫 2 棟 (幅広店舗 3 連に対して)
      { dx: 16, dy: 42, size: 'shed' },
      { dx: 54, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 店頭: 両端と中央の店前にパラソル、中央のみのぼり旗
      { dx:  0, dy:  4, type: 'parasol' },
      { dx: 11, dy:  6, type: 'sign_board' },
      { dx: 35, dy:  7, type: 'banner_pole' },
      { dx: 59, dy:  6, type: 'sign_board' },
      { dx: 72, dy:  4, type: 'parasol' },
      // 中後層: 搬入 (両端にダンプスター)
      { dx:  4, dy: 58, type: 'dumpster' },
      { dx: 68, dy: 58, type: 'dumpster' },
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
      // 共用の物置 1 棟 (中央)
      { dx: 32, dy: 38, size: 'shed' },
    ],
    furniture: [
      // 前面: 各戸に花壇、両端を生垣で閉じる
      { dx: -1, dy:  1, type: 'hedge' },
      { dx: 10, dy:  3, type: 'flower_bed' },
      { dx: 32, dy:  3, type: 'flower_bed' },
      { dx: 54, dy:  3, type: 'flower_bed' },
      { dx: 65, dy:  1, type: 'hedge' },
      // 玄関アプローチ: 各戸に郵便受け
      { dx: 10, dy: 14, type: 'mailbox' },
      { dx: 32, dy: 14, type: 'mailbox' },
      { dx: 54, dy: 14, type: 'mailbox' },
      // 奥: 電柱 2 本 + 中央の街灯
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 66, dy: 68, type: 'power_pole' },
      // 最奥: 中央の街灯
      { dx: 32, dy: 88, type: 'street_lamp' },
    ],
  },

  // コンセプト: 神社の境内一区画。前面は参道 (桜の門と狛犬)、中央に
  // 本殿、本殿の背後は cell の縦を深く使った鎮守の森 — 松と竹が
  // 3 層重ねで奥まで続く。境内の奥行きで cell 全体を聖域化。
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy:  0, size: 'shrine' },
      // 奥宮 (本殿の後方、神域の深さを表現) — 神社シーンのみ 2 棟許容
      { dx: 34, dy: 60, size: 'temple' },
    ],
    furniture: [
      // 参道: 左右対称に桜と狛犬、中央は手水舎用の花壇
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 18, dy:  5, type: 'statue' },     // 狛犬
      { dx: 50, dy:  5, type: 'statue' },     // 狛犬
      { dx: 66, dy:  4, type: 'sakura_tree' },
      // 中前層: 参道を守る竹 2 箇所
      { dx:  8, dy: 24, type: 'bamboo_cluster' },
      { dx: 60, dy: 24, type: 'bamboo_cluster' },
      // 中後層: 鎮守の森 前列の松
      { dx:  6, dy: 44, type: 'pine_tree' },
      { dx: 62, dy: 44, type: 'pine_tree' },
      // 最奥: 中央の松を高く、両脇に竹で締める
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
      // 茶室 (庭園の奥) 1 棟
      { dx: 44, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 山門前の庭: 松と石灯籠
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 22, dy:  6, type: 'statue' },   // 石灯籠
      { dx: 60, dy:  4, type: 'pine_tree' },
      // 中前層: 庭園の竹 1 箇所
      { dx: 10, dy: 24, type: 'bamboo_cluster' },
      // 中後層: 枯山水の石灯籠
      { dx: 16, dy: 52, type: 'statue' },
      // 奥: 裏山の松 2 本 (framing)
      { dx: -2, dy: 70, type: 'pine_tree' },
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
      // 検査・プレハブ倉庫 (中央)
      { dx: 30, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 前面: 生垣で敷地を閉じ、両院の看板
      { dx: -2, dy:  1, type: 'hedge' },
      { dx: 13, dy:  5, type: 'sign_board' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 前庭: 保育園側に桜 1 本
      { dx: 46, dy: 24, type: 'sakura_tree' },
      // 奥: 電柱 2 本
      { dx: -2, dy: 68, type: 'power_pole' },
      { dx: 68, dy: 68, type: 'power_pole' },
      // 最奥: 中央の街灯
      { dx: 34, dy: 88, type: 'street_lamp' },
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
      // 緊急車両の車庫 (中央)
      { dx: 34, dy: 42, size: 'garage' },
    ],
    furniture: [
      // 前面: 出動口のバリアと旗竿、中央に信号機
      { dx: -2, dy:  3, type: 'bollard' },
      { dx: 15, dy:  6, type: 'flag_pole' },
      { dx: 34, dy:  5, type: 'traffic_light' },
      { dx: 53, dy:  6, type: 'flag_pole' },
      { dx: 68, dy:  3, type: 'bollard' },
      // 中後層: 配電箱 2 つ (両端)
      { dx:  4, dy: 58, type: 'electric_box' },
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
      // 仕分け倉庫 (中央)
      { dx: 30, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 前面: 左に ATM、右に郵便ポスト、中央に街灯
      { dx:  2, dy:  4, type: 'atm' },
      { dx: 14, dy:  5, type: 'sign_board' },
      { dx: 30, dy:  5, type: 'street_lamp' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 58, dy:  4, type: 'post_box' },
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
      // 豪邸の茶室 (中央裏)
      { dx: 20, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 前面: 門松と狛犬像
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 16, dy:  5, type: 'statue' },
      { dx: 30, dy:  4, type: 'pine_tree' },
      { dx: 49, dy:  4, type: 'parasol' },
      // 前庭: 豪邸側の竹林
      { dx:  8, dy: 24, type: 'bamboo_cluster' },
      // 奥: 庭園の松 (左右)
      { dx:  4, dy: 66, type: 'pine_tree' },
      { dx: 56, dy: 66, type: 'pine_tree' },
      // 最奥: 中央の桜、両脇の松で framing
      { dx: -2, dy: 88, type: 'pine_tree' },
      { dx: 32, dy: 90, type: 'sakura_tree' },
      { dx: 62, dy: 88, type: 'pine_tree' },
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
      // 駅裏の詰所 (中央)
      { dx: 35, dy: 46, size: 'shed' },
    ],
    furniture: [
      // 広場: 両端にバス停、中央に旗竿、自転車ラック
      { dx: -1, dy:  5, type: 'bus_stop' },
      { dx: 22, dy:  4, type: 'bicycle_rack' },
      { dx: 35, dy:  6, type: 'flag_pole' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 71, dy:  5, type: 'bus_stop' },
      // 中前層: 広場中央の銅像
      { dx: 35, dy: 26, type: 'statue' },
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
      // 搬入用の業務ガレージ (中央裏)
      { dx: 37, dy: 46, size: 'garage' },
    ],
    furniture: [
      // 前庭広場: 左右対称に街灯と旗幟、中央に噴水
      { dx:  2, dy:  5, type: 'street_lamp' },
      { dx: 25, dy:  5, type: 'banner_pole' },
      { dx: 37, dy:  6, type: 'fountain' },
      { dx: 49, dy:  5, type: 'banner_pole' },
      { dx: 72, dy:  5, type: 'street_lamp' },
      // 中前層: 植栽帯 (左右)
      { dx: 14, dy: 24, type: 'planter' },
      { dx: 60, dy: 24, type: 'planter' },
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
      // 救急別棟 (左裏)
      { dx:  8, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 正面ロータリー: 生垣で囲み、旗竿と看板、右に消火栓
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  6, dy:  5, type: 'flag_pole' },
      { dx: 27, dy:  5, type: 'sign_board' },
      { dx: 52, dy:  4, type: 'hydrant' },
      { dx: 66, dy:  1, type: 'hedge' },
      // 前庭: 中央の花壇
      { dx: 27, dy: 24, type: 'flower_bed' },
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
      // 体育館 (中央裏)
      { dx: 36, dy: 44, size: 'garage' },
    ],
    furniture: [
      // 校門: 生垣で囲み、左右に桜と旗竿
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 10, dy:  5, type: 'flag_pole' },
      { dx: 36, dy:  5, type: 'sign_board' },
      { dx: 62, dy:  5, type: 'flag_pole' },
      { dx: 72, dy:  4, type: 'sakura_tree' },
      { dx: 74, dy:  1, type: 'hedge' },
      // 前庭: 二宮金次郎像 (中央)
      { dx: 36, dy: 26, type: 'statue' },
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
      // 裏庭の茶室 (中央奥) — 市役所の文化的深さ
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
      // 中前層: 植栽帯 (左右対称)
      { dx: 12, dy: 26, type: 'planter' },
      { dx: 52, dy: 26, type: 'planter' },
      // 最奥: 裏庭の桜並木 (左右対称)
      { dx: 14, dy: 88, type: 'sakura_tree' },
      { dx: 32, dy: 90, type: 'pine_tree' },
      { dx: 50, dy: 88, type: 'sakura_tree' },
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
      // ビル裏の業務倉庫 2 棟 (幅広シーン向け)
      { dx: 30, dy: 64, size: 'shed' },
      { dx: 68, dy: 64, size: 'shed' },
    ],
    furniture: [
      // 歩道: ボラードで両端を閉じ、各ビル前に看板
      { dx:  0, dy:  3, type: 'bollard' },
      { dx: 15, dy:  5, type: 'sign_board' },
      { dx: 48, dy:  5, type: 'sign_board' },
      { dx: 82, dy:  5, type: 'sign_board' },
      { dx:100, dy:  3, type: 'bollard' },
      // 中前層: ビル前の街灯 (3 本、各ビル中心)
      { dx: 15, dy: 26, type: 'street_lamp' },
      { dx: 48, dy: 26, type: 'street_lamp' },
      { dx: 82, dy: 26, type: 'street_lamp' },
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
      // 管理人室 (中央)
      { dx: 24, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 前面: 生垣で囲み、時計塔前に街灯、マンション入口に郵便受け
      { dx: -1, dy:  1, type: 'hedge' },
      { dx: 10, dy:  5, type: 'street_lamp' },
      { dx: 36, dy:  5, type: 'mailbox' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 61, dy:  1, type: 'hedge' },
      // 最奥: 住宅地らしい桜並木
      { dx: -2, dy: 86, type: 'power_pole' },
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
      // 併設図書館 (右奥、文化地区)
      { dx: 44, dy: 44, size: 'townhouse' },
    ],
    furniture: [
      // 前面: マーキーのバナー、中央に看板、両端に待ち客設備
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 22, dy:  5, type: 'sign_board' },
      { dx: 40, dy:  3, type: 'bench' },
      { dx: 54, dy:  3, type: 'vending' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 最奥: 文化地区らしい桜 2 本
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
      // 収蔵庫 (中央裏)
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
      // 生鮮搬入棟 (左奥)
      { dx: 10, dy: 44, size: 'shed' },
    ],
    furniture: [
      // 店頭: 自販機、看板、駐車場とボラードで仕切り
      { dx:  2, dy:  3, type: 'vending' },
      { dx: 20, dy:  6, type: 'sign_board' },
      { dx: 40, dy:  3, type: 'bollard' },
      { dx: 72, dy:  3, type: 'bollard' },
      // 中前層: 駐車場に街灯 1 本
      { dx: 56, dy: 26, type: 'street_lamp' },
      // 中後層: 搬入のダンプスター
      { dx: 40, dy: 58, type: 'dumpster' },
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
      // 選手入場の業務ガレージ (スタジアム裏)
      { dx: 30, dy: 46, size: 'garage' },
    ],
    furniture: [
      // 入場口: バナーと看板、ボラードで群衆整理
      { dx: -1, dy:  5, type: 'banner_pole' },
      { dx: 14, dy:  3, type: 'bollard' },
      { dx: 30, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'bollard' },
      { dx: 60, dy:  5, type: 'banner_pole' },
      { dx: 80, dy:  4, type: 'sign_board' },
      // 中前層: 無線塔側の電気設備
      { dx: 80, dy: 26, type: 'electric_box' },
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
      // 屋台小屋 (右側、広場の奥)
      { dx: 50, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 入場口: 生垣、バナー、看板、屋台、旗竿
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  5, type: 'banner_pole' },
      { dx: 22, dy:  6, type: 'sign_board' },
      { dx: 50, dy:  3, type: 'parasol' },
      { dx: 65, dy:  5, type: 'flag_pole' },
      { dx: 68, dy:  1, type: 'hedge' },
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
      // ポンプ室 (給水塔側)
      { dx: 10, dy: 42, size: 'shed' },
    ],
    furniture: [
      // 前面: 給水塔の電気設備、マンションの郵便受けと駐輪
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'electric_box' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 32, dy:  5, type: 'mailbox' },
      { dx: 42, dy:  4, type: 'bicycle_rack' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 最奥: 裏路地と街路樹
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 30, dy: 90, type: 'tree' },
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
