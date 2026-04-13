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
  // コンセプト: 3 軒の家が前面道路に並ぶ住宅街区。各戸に玄関花壇、
  // 家と家の間は細い生垣、裏には共用の物置と電柱、両端は隣家との境界生垣。
  {
    id: 'house_trio_garden', tier: 'bot', width: 56,
    buildings: [
      { dx:  8, dy: 0,  size: 'house' },
      { dx: 28, dy: 0,  size: 'house' },
      { dx: 48, dy: 0,  size: 'house' },
      { dx: 44, dy: 28, size: 'shed' },  // 裏手の物置 (一番奥の家の敷地)
    ],
    furniture: [
      // 前面 — 各戸の玄関前花壇と両端の敷地境界
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  8, dy: 4, type: 'flower_bed' },
      { dx: 28, dy: 4, type: 'flower_bed' },
      { dx: 48, dy: 4, type: 'flower_bed' },
      { dx: 58, dy: 1, type: 'hedge' },
      // 家と家の間の細路 (bush で敷地境界)
      { dx: 18, dy: 3, type: 'bush' },
      { dx: 38, dy: 3, type: 'bush' },
      // 裏手 — 電柱は角に 1 本、裏庭の木
      { dx: 58, dy: 30, type: 'power_pole' },
      { dx: 12, dy: 36, type: 'tree' },
    ],
  },

  // コンセプト: 住宅地の角にコンビニ。左の家は敷地境界の生垣と花壇、
  // 右のコンビニは店頭に自販機・駐輪ラック・看板、裏は搬入口のダンプスター。
  {
    id: 'house_konbini', tier: 'bot', width: 56,
    buildings: [
      { dx:  8, dy: 0,  size: 'house' },
      { dx: 32, dy: 0,  size: 'convenience' },
    ],
    furniture: [
      // 住宅側 (左) — 生垣と花壇
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  8, dy: 4, type: 'flower_bed' },
      { dx: 18, dy: 3, type: 'hedge' },      // 住宅とコンビニの敷地境界
      // コンビニ側 (右) — 店頭
      { dx: 32, dy: 5, type: 'sign_board' },
      { dx: 46, dy: 3, type: 'vending' },
      { dx: 52, dy: 3, type: 'bicycle_rack' },
      // コンビニ裏の搬入口
      { dx: 42, dy: 24, type: 'dumpster' },
      { dx: 56, dy: 30, type: 'power_pole' }, // 電柱 (コンビニ側の敷地角)
      // 住宅側の裏庭の木
      { dx:  8, dy: 36, type: 'tree' },
    ],
  },

  // コンセプト: 家とガレージのある郊外住宅。敷地内に玄関花壇、ガレージ前に
  // 駐車中の車、裏庭に家庭菜園 (ビニールハウス) と 1 本の木。
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx:  8, dy: 0,  size: 'house' },
      { dx: 30, dy: 0,  size: 'garage' },
      { dx: 32, dy: 30, size: 'greenhouse' },  // 裏の家庭菜園
    ],
    furniture: [
      // 前面 — 敷地境界と玄関
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  8, dy: 4, type: 'flower_bed' },
      { dx: 18, dy: 3, type: 'bush' },     // 家とガレージの境界
      { dx: 48, dy: 1, type: 'hedge' },
      // 裏 — 菜園脇の木
      { dx:  8, dy: 32, type: 'flower_bed' }, // 家庭菜園の畝
      { dx: 10, dy: 44, type: 'tree' },
    ],
    parkedVehicles: [
      { dx: 30, dy: 1, type: 'car' },
    ],
  },

  // コンセプト: 畑を耕す農家の一角。物置とビニールハウスが並び、
  // 敷地全体が畑地で、畝 (flower_bed) が手前から奥まで続く。
  // 区画全体が "野良仕事の場所" という農的な佇まい。
  {
    id: 'garden_shed', tier: 'bot', width: 44,
    buildings: [
      { dx:  8, dy: 0,  size: 'shed' },
      { dx: 29, dy: 0,  size: 'greenhouse' },
    ],
    furniture: [
      // 敷地境界
      { dx: -2, dy: 2, type: 'bush' },
      { dx: 44, dy: 2, type: 'bush' },
      // 手前の畝
      { dx: 18, dy: 4, type: 'flower_bed' },
      // 中層の畝
      { dx:  6, dy: 22, type: 'flower_bed' },
      { dx: 22, dy: 22, type: 'flower_bed' },
      { dx: 38, dy: 22, type: 'flower_bed' },
      // 奥の畝と防風林の木
      { dx: 14, dy: 38, type: 'flower_bed' },
      { dx: 34, dy: 38, type: 'flower_bed' },
      { dx: 44, dy: 44, type: 'tree' },
    ],
  },

  // コンセプト: 単体コンビニの区画。前面は店頭の自販機と自転車ラック、
  // 建物脇は ATM と新聞スタンド、裏は搬入口のダンプスターと電柱。
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy: 0,  size: 'convenience' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy: 3, type: 'vending' },
      { dx:  4, dy: 5, type: 'atm' },
      { dx: 14, dy: 6, type: 'sign_board' },
      { dx: 28, dy: 3, type: 'bicycle_rack' },
      { dx: 34, dy: 3, type: 'newspaper_stand' },
      // 搬入口と裏手
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 32, dy: 26, type: 'recycling_bin' },
      { dx: 40, dy: 30, type: 'power_pole' },
    ],
  },

  // コンセプト: 飲食店 2 軒が並ぶ路地。店前に提灯 (parasol)、赤い看板、
  // 客の自転車、路地奥は業務用搬入の勝手口でダンプスターと電柱。
  {
    id: 'ramen_izakaya', tier: 'bot', width: 50,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 34, dy: 0,  size: 'izakaya' },
    ],
    furniture: [
      // 店頭
      { dx: -1, dy: 3, type: 'parasol' },
      { dx: 10, dy: 6, type: 'banner_pole' },
      { dx: 22, dy: 3, type: 'vending' },      // 店間の自販機
      { dx: 34, dy: 3, type: 'parasol' },
      { dx: 34, dy: 6, type: 'banner_pole' },
      { dx: 48, dy: 4, type: 'bicycle' },      // 客の自転車
      // 裏路地の搬入口
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 42, dy: 24, type: 'recycling_bin' },
      { dx: 50, dy: 30, type: 'power_pole' },
    ],
  },

  // コンセプト: 花屋とパン屋が並ぶ路面店。花屋の店頭に鉢植えの花群、
  // パン屋の店頭にパラソル、店と店の間に小さなベンチ。裏は狭い搬入口。
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx:  8, dy: 0,  size: 'florist' },
      { dx: 26, dy: 0,  size: 'bakery' },
    ],
    furniture: [
      // 花屋の店頭ディスプレイ
      { dx: -2, dy: 3, type: 'flower_bed' },
      { dx:  2, dy: 4, type: 'planter' },
      { dx:  8, dy: 5, type: 'parasol' },
      // 店間ベンチと敷地境界
      { dx: 17, dy: 3, type: 'bench' },
      // パン屋の店頭
      { dx: 26, dy: 5, type: 'parasol' },
      { dx: 38, dy: 3, type: 'flower_bed' },
      // 裏口
      { dx: 40, dy: 28, type: 'garbage' },
      { dx: -2, dy: 30, type: 'power_pole' },
    ],
  },

  // コンセプト: ガソリンスタンド。敷地前面の給油エリアに車と価格看板、
  // 敷地境界のボラード (車両誘導)、裏は整備エリアで洗車用自販機と
  // 消火器・油タンク (electric_box で代用)。
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy: 0,  size: 'gas_station' },
    ],
    furniture: [
      // 給油エリア (敷地前面)
      { dx: -1, dy: 2, type: 'bollard' },
      { dx:  2, dy: 6, type: 'sign_board' },  // 価格看板
      { dx: 16, dy: 7, type: 'banner_pole' }, // 大看板
      { dx: 34, dy: 2, type: 'bollard' },
      { dx: 42, dy: 3, type: 'fire_extinguisher' },
      // 整備エリア (建物裏)
      { dx:  4, dy: 22, type: 'electric_box' }, // 油タンク
      { dx: 32, dy: 22, type: 'vending' },      // 洗車用
      { dx: 46, dy: 30, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 16, dy: 1, type: 'car' },
    ],
  },

  // コンセプト: コインランドリーと薬局の生活路面店区画。ランドリーの
  // 前に待ちベンチと自販機、薬局の前は看板と植栽。裏は共用の自転車置場。
  {
    id: 'laundromat_pharmacy', tier: 'bot', width: 46,
    buildings: [
      { dx: 10, dy: 0,  size: 'laundromat' },
      { dx: 33, dy: 0,  size: 'pharmacy' },
    ],
    furniture: [
      // ランドリー前 (待合)
      { dx:  0, dy: 3, type: 'bench' },
      { dx: 10, dy: 5, type: 'sign_board' },
      // 店間の自販機
      { dx: 21, dy: 3, type: 'vending' },
      // 薬局前
      { dx: 33, dy: 5, type: 'sign_board' },
      { dx: 44, dy: 3, type: 'planter' },
      // 裏 — 共用駐輪と電柱
      { dx: 20, dy: 22, type: 'bicycle_rack' },
      { dx: -2, dy: 30, type: 'power_pole' },
    ],
  },

  // コンセプト: 静かな通りのカフェと古本屋。カフェのテラスにパラソルと
  // ベンチ、古本屋の店先には屋外ワゴン (newspaper_stand)、裏は
  // オーナーの自宅裏庭みたいな静かな空間で桜 1 本。
  {
    id: 'cafe_bookstore', tier: 'bot', width: 44,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 33, dy: 0,  size: 'bookstore' },
    ],
    furniture: [
      // カフェテラス
      { dx: -1, dy: 3, type: 'parasol' },
      { dx:  4, dy: 3, type: 'bench' },
      { dx: 10, dy: 5, type: 'sign_board' },
      // 店間
      { dx: 21, dy: 3, type: 'bench' },
      // 古本屋の店頭ワゴン
      { dx: 33, dy: 3, type: 'newspaper_stand' },
      { dx: 44, dy: 3, type: 'planter' },
      // 裏手の静かな一角
      { dx: 22, dy: 36, type: 'sakura_tree' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ MID tier scenes — 商店街 (max h=30 front, h=32 back for midB)
// ─────────────────────────────────────────────────────────────────

const MID_SCENES: Scene[] = [
  // コンセプト: アーケードのない古い商店街。4 店舗が密に並び、各店の前に
  // パラソル・のぼり旗・客の自転車。店と店の間に自販機。裏は細い搬入路で
  // ダンプスターと店同士の電気メーター (electric_box)。
  {
    id: 'shotengai_food', tier: 'mid', width: 74,
    buildings: [
      { dx: 10, dy: 0,  size: 'ramen' },
      { dx: 28, dy: 0,  size: 'izakaya' },
      { dx: 47, dy: 0,  size: 'cafe' },
      { dx: 64, dy: 0,  size: 'bakery' },
    ],
    furniture: [
      // 店前 (賑わい)
      { dx:  0, dy: 3, type: 'parasol' },
      { dx: 10, dy: 6, type: 'banner_pole' },
      { dx: 19, dy: 3, type: 'vending' },      // 店間の自販機
      { dx: 28, dy: 6, type: 'banner_pole' },
      { dx: 38, dy: 3, type: 'parasol' },      // 店間のパラソル
      { dx: 47, dy: 6, type: 'banner_pole' },
      { dx: 55, dy: 3, type: 'bicycle' },      // 客の自転車
      { dx: 64, dy: 6, type: 'banner_pole' },
      { dx: 74, dy: 3, type: 'parasol' },
      // 裏の搬入路
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 38, dy: 22, type: 'electric_box' },
      { dx: 70, dy: 22, type: 'recycling_bin' },
      { dx: -2, dy: 34, type: 'power_pole' },
      { dx: 76, dy: 34, type: 'power_pole' },
    ],
  },

  // コンセプト: パチンコとゲーセンのネオン娯楽街。巨大な看板・バナーが
  // 店前に突き出し、客の自転車が大量に駐輪。店間は大型自販機と看板。
  // 裏は業務用搬入口で電気設備とダンプスター。
  {
    id: 'shotengai_game', tier: 'mid', width: 66,
    buildings: [
      { dx: 15, dy: 0,  size: 'pachinko' },
      { dx: 50, dy: 0,  size: 'game_center' },
    ],
    furniture: [
      // 店前の派手なサイン群
      { dx:  0, dy: 6, type: 'banner_pole' },
      { dx: 15, dy: 7, type: 'banner_pole' },
      { dx: 32, dy: 3, type: 'bicycle_rack' },  // 店間の駐輪
      { dx: 38, dy: 3, type: 'vending' },        // 店間の自販機
      { dx: 50, dy: 7, type: 'banner_pole' },
      { dx: 66, dy: 6, type: 'banner_pole' },
      // 客の自転車
      { dx:  6, dy: 4, type: 'bicycle' },
      { dx: 60, dy: 4, type: 'bicycle' },
      // 裏の業務用搬入口
      { dx:  6, dy: 24, type: 'dumpster' },
      { dx: 32, dy: 24, type: 'electric_box' },
      { dx: 60, dy: 24, type: 'dumpster' },
    ],
  },

  // コンセプト: 落ち着いた 3 店舗の路面店街。カフェはテラス席付き、
  // 書店はショーウィンドウ、薬局は看板付き。店同士の境に街灯と植栽。
  // 裏はオーナー用の駐輪と一本桜の小径。
  {
    id: 'cafe_bookstore_row', tier: 'mid', width: 66,
    buildings: [
      { dx: 10, dy: 0,  size: 'cafe' },
      { dx: 32, dy: 0,  size: 'bookstore' },
      { dx: 54, dy: 0,  size: 'pharmacy' },
    ],
    furniture: [
      // カフェのテラス
      { dx: -1, dy: 4, type: 'parasol' },
      { dx:  4, dy: 3, type: 'bench' },
      // 店間の街灯
      { dx: 21, dy: 5, type: 'street_lamp' },
      // 書店の店頭
      { dx: 32, dy: 3, type: 'newspaper_stand' },
      // 店間の街灯
      { dx: 43, dy: 5, type: 'street_lamp' },
      // 薬局前
      { dx: 54, dy: 5, type: 'sign_board' },
      { dx: 65, dy: 3, type: 'planter' },
      // 裏の小径
      { dx: 32, dy: 22, type: 'bicycle_rack' },
      { dx: 32, dy: 38, type: 'sakura_tree' },
    ],
  },

  // コンセプト: 雑貨店 + 食堂 + 雑貨店が並ぶ賑やかな通り。各店に
  // パラソルまたは看板、店間に自販機や客ベンチ。裏は搬入路で
  // ダンプスターと電柱が並ぶ。
  {
    id: 'shop_parasol_row', tier: 'mid', width: 72,
    buildings: [
      { dx: 11, dy: 0,  size: 'shop' },
      { dx: 35, dy: 0,  size: 'restaurant' },
      { dx: 59, dy: 0,  size: 'shop' },
    ],
    furniture: [
      // 店頭の賑わい
      { dx:  0, dy: 4, type: 'parasol' },
      { dx: 11, dy: 6, type: 'sign_board' },
      // 店間
      { dx: 23, dy: 3, type: 'vending' },
      // 中央の食堂
      { dx: 35, dy: 4, type: 'parasol' },
      { dx: 35, dy: 7, type: 'banner_pole' },
      // 店間
      { dx: 47, dy: 3, type: 'bench' },
      // 右の雑貨店
      { dx: 59, dy: 6, type: 'sign_board' },
      { dx: 72, dy: 4, type: 'parasol' },
      // 裏の搬入路
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 35, dy: 22, type: 'recycling_bin' },
      { dx: 68, dy: 22, type: 'dumpster' },
      { dx: -2, dy: 34, type: 'power_pole' },
    ],
  },

  // コンセプト: 昔ながらの長屋風タウンハウス 3 軒。各戸の玄関前に
  // 郵便受けと花壇、家と家の境界は細い生垣。裏は共用の路地で物置、
  // 電柱、路地を照らす街灯。
  {
    id: 'townhouse_row', tier: 'mid', width: 64,
    buildings: [
      { dx: 10, dy: 0,  size: 'townhouse' },
      { dx: 32, dy: 0,  size: 'townhouse' },
      { dx: 54, dy: 0,  size: 'townhouse' },
      { dx: 54, dy: 30, size: 'shed' },           // 共用物置
    ],
    furniture: [
      // 前面
      { dx: -1, dy: 1, type: 'hedge' },
      { dx: 10, dy: 5, type: 'mailbox' },
      { dx: 21, dy: 3, type: 'bush' },            // 敷地境界
      { dx: 32, dy: 5, type: 'mailbox' },
      { dx: 43, dy: 3, type: 'bush' },
      { dx: 54, dy: 5, type: 'mailbox' },
      { dx: 65, dy: 1, type: 'hedge' },
      // 玄関前の花壇
      { dx: 10, dy: 3, type: 'flower_bed' },
      { dx: 32, dy: 3, type: 'flower_bed' },
      // 裏の共用路地
      { dx: 10, dy: 22, type: 'bicycle_rack' },
      { dx: 32, dy: 22, type: 'street_lamp' },
      { dx: -2, dy: 30, type: 'power_pole' },
    ],
  },

  // コンセプト: 神社の境内。手前は参道で 両脇の桜と狛犬が「門」の
  // 役割。中央の本殿は奥、本殿の前に石灯籠。本殿の背後は鎮守の森
  // (松と竹) が深く茂る。境内全体が "神聖な場" として一貫した
  // 配置 — 参道から本殿、森へと奥行きが明確。
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy: 0,  size: 'shrine' },
    ],
    furniture: [
      // 参道入口 — 桜の門
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 66, dy: 4, type: 'sakura_tree' },
      // 参道の狛犬 (本殿に向き合う)
      { dx: 18, dy: 5, type: 'statue' },
      { dx: 50, dy: 5, type: 'statue' },
      // 本殿前の石灯籠
      { dx: 34, dy: 4, type: 'flower_bed' },
      // 中層: 参道を守る竹と幟
      { dx: 10, dy: 16, type: 'bamboo_cluster' },
      { dx: 58, dy: 16, type: 'bamboo_cluster' },
      // 背後: 鎮守の森 (松を深く)
      { dx:  4, dy: 34, type: 'pine_tree' },
      { dx: 22, dy: 36, type: 'pine_tree' },
      { dx: 46, dy: 36, type: 'pine_tree' },
      { dx: 64, dy: 34, type: 'pine_tree' },
    ],
  },

  // コンセプト: 禅寺の庭園。本堂は中央やや左、手前には枯山水をイメージした
  // 石仏と松、左右対称の盆栽 (planter)。本堂脇に石灯籠、背後は裏山の
  // 松林と竹林。静謐さを保つため要素を 抑制気味に。
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy: 0,  size: 'temple' },
    ],
    furniture: [
      // 山門前の庭
      { dx:  2, dy: 4, type: 'pine_tree' },
      { dx: 10, dy: 3, type: 'planter' },
      // 本堂前の石仏・石灯籠
      { dx: 22, dy: 6, type: 'statue' },
      // 本堂脇
      { dx: 44, dy: 3, type: 'planter' },
      { dx: 50, dy: 4, type: 'pine_tree' },
      // 中層 — 竹の垣
      { dx: 62, dy: 18, type: 'bamboo_cluster' },
      // 裏山 — 松林と竹林
      { dx: 10, dy: 34, type: 'pine_tree' },
      { dx: 34, dy: 36, type: 'pine_tree' },
      { dx: 56, dy: 34, type: 'bamboo_cluster' },
    ],
  },

  // コンセプト: クリニックと保育園が並ぶ公共施設区画。クリニック前は
  // 待合ベンチと看板、保育園前は遊具エリアで花壇と桜 (子供向け)。
  // 両施設とも敷地を生垣で囲んだ安全志向の配置。裏は共用駐輪。
  {
    id: 'clinic_daycare', tier: 'mid', width: 68,
    buildings: [
      { dx: 13, dy: 0,  size: 'clinic' },
      { dx: 46, dy: 0,  size: 'daycare' },
    ],
    furniture: [
      // クリニック前
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 3, type: 'bench' },
      { dx: 13, dy: 5, type: 'sign_board' },
      { dx: 26, dy: 1, type: 'hedge' },  // 敷地境界
      // 保育園前 (園庭)
      { dx: 36, dy: 3, type: 'flower_bed' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 56, dy: 3, type: 'bench' },
      { dx: 68, dy: 1, type: 'hedge' },
      // 中層 — 保育園の園庭の桜
      { dx: 46, dy: 22, type: 'sakura_tree' },
      // 裏 — 共用駐輪と電柱
      { dx: 13, dy: 30, type: 'bicycle_rack' },
      { dx: -2, dy: 34, type: 'power_pole' },
    ],
  },

  // コンセプト: 消防署と警察署が並ぶ公共施設ブロック。両施設とも旗竿で
  // "公的" な佇まい。敷地境界にボラード (車両侵入防止)、間に信号機
  // (出動口の交差点)。裏は職員駐車エリアで電気設備と駐輪ラック。
  {
    id: 'fire_police', tier: 'midB', width: 70,
    buildings: [
      { dx: 15, dy: 0,  size: 'fire_station' },
      { dx: 53, dy: 0,  size: 'police_station' },
    ],
    furniture: [
      // 消防署前 (出動口のバリア)
      { dx: -2, dy: 3, type: 'bollard' },
      { dx:  0, dy: 4, type: 'hydrant' },
      { dx: 15, dy: 6, type: 'flag_pole' },
      { dx: 30, dy: 3, type: 'bollard' },
      // 出動口の信号機
      { dx: 34, dy: 5, type: 'traffic_light' },
      // 警察署前
      { dx: 38, dy: 3, type: 'bollard' },
      { dx: 53, dy: 6, type: 'flag_pole' },
      { dx: 68, dy: 3, type: 'bollard' },
      // 裏の職員エリア
      { dx: 15, dy: 22, type: 'bicycle_rack' },
      { dx: 53, dy: 22, type: 'electric_box' },
      { dx: -2, dy: 34, type: 'power_pole' },
    ],
  },

  // コンセプト: 銀行と郵便局が並ぶ金融公共区画。銀行前の歩道に ATM と
  // 客のベンチ、郵便局前には郵便ポストと新聞ラック。通りの境には街灯。
  // 裏は職員通用口で自転車置き場と電柱。
  {
    id: 'bank_post', tier: 'midB', width: 62,
    buildings: [
      { dx: 14, dy: 0,  size: 'bank' },
      { dx: 46, dy: 0,  size: 'post_office' },
    ],
    furniture: [
      // 銀行前
      { dx:  2, dy: 4, type: 'atm' },
      { dx: 14, dy: 5, type: 'sign_board' },
      { dx: 24, dy: 3, type: 'bench' },
      // 通りの街灯
      { dx: 30, dy: 5, type: 'street_lamp' },
      // 郵便局前
      { dx: 40, dy: 4, type: 'post_box' },
      { dx: 46, dy: 5, type: 'sign_board' },
      { dx: 58, dy: 3, type: 'newspaper_stand' },
      // 裏の通用口
      { dx: 14, dy: 22, type: 'bicycle_rack' },
      { dx: 46, dy: 22, type: 'electric_box' },
      { dx: -2, dy: 34, type: 'power_pole' },
    ],
  },

  // コンセプト: 黒塀の豪邸と隣接する小さな雑貨店。豪邸は敷地全体を
  // 生垣と松で囲った伝統的な庭園、玄関に石像。雑貨店はパラソルと
  // 店頭ベンチ。豪邸の裏庭は深い松林 + 桜の離れ。
  {
    id: 'mansion_shop', tier: 'mid', width: 64,
    buildings: [
      { dx: 16, dy: 0,  size: 'mansion' },
      { dx: 49, dy: 0,  size: 'shop' },
    ],
    furniture: [
      // 豪邸の敷地 (生垣と松)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'pine_tree' },
      { dx: 16, dy: 5, type: 'statue' },       // 玄関の石像
      { dx: 30, dy: 4, type: 'pine_tree' },
      { dx: 34, dy: 1, type: 'hedge' },
      // 商店
      { dx: 49, dy: 4, type: 'parasol' },
      { dx: 58, dy: 3, type: 'bench' },
      // 豪邸の裏庭 (深い松林)
      { dx:  4, dy: 22, type: 'pine_tree' },
      { dx: 22, dy: 24, type: 'bamboo_cluster' },
      { dx: 16, dy: 40, type: 'sakura_tree' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// ★ TOP tier scenes — ランドマーク (max h=90)
// ─────────────────────────────────────────────────────────────────

const TOP_SCENES: Scene[] = [
  // コンセプト: 駅前ロータリー。駅舎中央、両端にバスターミナルと
  // タクシー乗り場。広場中央に旗竿と銅像。駅舎の両脇に駐輪ラック。
  // 駅裏は職員出入口で電気設備と街灯のゾーン。
  {
    id: 'train_station_plaza', tier: 'top', width: 70,
    buildings: [
      { dx: 35, dy: 0,  size: 'train_station' },
    ],
    furniture: [
      // ロータリー (両端)
      { dx: -1, dy: 5, type: 'bus_stop' },
      { dx: 71, dy: 5, type: 'bus_stop' },
      // 待ちベンチと新聞スタンド
      { dx: 12, dy: 3, type: 'bench' },
      { dx: 58, dy: 3, type: 'bench' },
      // 広場中央
      { dx: 35, dy: 6, type: 'flag_pole' },
      { dx: 22, dy: 4, type: 'bicycle_rack' },
      { dx: 48, dy: 4, type: 'bicycle_rack' },
      // 中層 — 広場の街灯
      { dx: 35, dy: 22, type: 'statue' },    // 創設者像
      // 駅裏
      { dx:  4, dy: 34, type: 'electric_box' },
      { dx: 66, dy: 34, type: 'electric_box' },
      { dx: 35, dy: 44, type: 'sakura_tree' },
    ],
    parkedVehicles: [
      { dx:  5, dy: 2, type: 'taxi' },
      { dx: 65, dy: 2, type: 'taxi' },
    ],
  },

  // コンセプト: 中央百貨店 (2-cell) + 前庭広場。建物前に中央噴水、
  // 左右対称に街灯・ベンチ・バナー、敷地の隅に植栽。裏は搬入口で
  // 配送用電気設備と街灯が並ぶ。
  {
    id: 'dept_store_plaza', tier: 'top', width: 74,
    buildings: [
      { dx: 37, dy: 0,  size: 'department_store' },
    ],
    furniture: [
      // 前庭広場 (シンメトリー)
      { dx:  2, dy: 5, type: 'street_lamp' },
      { dx: 14, dy: 3, type: 'bench' },
      { dx: 25, dy: 5, type: 'banner_pole' },
      { dx: 37, dy: 6, type: 'fountain' },
      { dx: 49, dy: 5, type: 'banner_pole' },
      { dx: 60, dy: 3, type: 'bench' },
      { dx: 72, dy: 5, type: 'street_lamp' },
      // 中層 — 広場の植栽
      { dx: 14, dy: 22, type: 'planter' },
      { dx: 60, dy: 22, type: 'planter' },
      // 裏 — 搬入エリア
      { dx:  4, dy: 34, type: 'electric_box' },
      { dx: 70, dy: 34, type: 'electric_box' },
      { dx: 37, dy: 44, type: 'street_lamp' },
    ],
  },

  // コンセプト: 総合病院。正面にロータリー (旗竿と看板)、敷地を生垣で囲み、
  // 救急車入口はボラードで分離、入口横に消火栓。裏は職員駐車場と
  // 設備棟で、電気ボックスと街灯が並ぶ整然とした配置。
  {
    id: 'hospital_scene', tier: 'top', width: 66,
    buildings: [
      { dx: 27, dy: 0,  size: 'hospital' },
    ],
    furniture: [
      // 正面ロータリー
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  6, dy: 5, type: 'flag_pole' },
      { dx: 16, dy: 3, type: 'bench' },
      { dx: 27, dy: 5, type: 'sign_board' },
      // 救急車入口の区切り
      { dx: 46, dy: 3, type: 'bollard' },
      { dx: 52, dy: 4, type: 'hydrant' },
      { dx: 66, dy: 1, type: 'hedge' },
      // 中層 — ロータリーの植栽
      { dx: 16, dy: 22, type: 'planter' },
      // 裏 — 職員駐車場と設備
      { dx:  6, dy: 34, type: 'electric_box' },
      { dx: 27, dy: 34, type: 'street_lamp' },
      { dx: -2, dy: 44, type: 'power_pole' },
    ],
    parkedVehicles: [
      { dx: 58, dy: 2, type: 'ambulance' },
    ],
  },

  // コンセプト: 学校。校門の両脇に桜並木、校舎前に国旗掲揚塔と校庭の
  // 二宮金次郎像。校庭は広く、中央に大きな木。敷地の周囲を生垣で囲む。
  // 裏は部活棟・駐輪エリア。
  {
    id: 'school_grounds', tier: 'top', width: 74,
    buildings: [
      { dx: 36, dy: 0,  size: 'school' },
    ],
    furniture: [
      // 校門前 — 桜並木
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 4, type: 'sakura_tree' },
      { dx: 10, dy: 5, type: 'flag_pole' },
      { dx: 36, dy: 5, type: 'sign_board' },
      { dx: 62, dy: 5, type: 'flag_pole' },
      { dx: 72, dy: 4, type: 'sakura_tree' },
      { dx: 74, dy: 1, type: 'hedge' },
      // 中層 — 校庭
      { dx: 14, dy: 22, type: 'statue' },   // 二宮金次郎
      { dx: 58, dy: 22, type: 'bush' },      // 校庭の植栽
      // 裏 — 部活棟・駐輪
      { dx: 36, dy: 34, type: 'bicycle_rack' },
      { dx:  4, dy: 44, type: 'pine_tree' },
      { dx: 70, dy: 44, type: 'pine_tree' },
    ],
  },

  // コンセプト: 市役所。前庭は左右対称の格式ある広場。中央噴水と 2 本の
  // 旗竿、左右に銅像とベンチ。敷地を生垣で囲む。背後は裏庭の
  // 松林 (公共建築の典型)。
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy: 0,  size: 'city_hall' },
    ],
    furniture: [
      // 前庭広場 (シンメトリー)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  2, dy: 6, type: 'flag_pole' },
      { dx: 12, dy: 5, type: 'statue' },
      { dx: 20, dy: 3, type: 'bench' },
      { dx: 32, dy: 7, type: 'fountain' },
      { dx: 44, dy: 3, type: 'bench' },
      { dx: 52, dy: 5, type: 'statue' },
      { dx: 62, dy: 6, type: 'flag_pole' },
      { dx: 72, dy: 1, type: 'hedge' },
      // 中層 — 植栽帯
      { dx: 12, dy: 22, type: 'planter' },
      { dx: 52, dy: 22, type: 'planter' },
      // 裏庭 — 格式ある松
      { dx: 12, dy: 40, type: 'pine_tree' },
      { dx: 52, dy: 40, type: 'pine_tree' },
    ],
  },

  // コンセプト: オフィス街 (2-cell)。3 棟のタワーが並び、ビル前の歩道に
  // ベンチ・ボラード・電気設備・街灯が整然と配置。裏は共用駐輪と
  // 配電設備で、都会の硬質な佇まい。
  {
    id: 'office_tower_group', tier: 'top', width: 100,
    buildings: [
      { dx: 15, dy: 0,  size: 'office' },
      { dx: 48, dy: 0,  size: 'skyscraper' },
      { dx: 82, dy: 0,  size: 'tower' },
    ],
    furniture: [
      // 歩道の家具
      { dx:  0, dy: 3, type: 'bollard' },
      { dx: 15, dy: 5, type: 'sign_board' },
      { dx: 32, dy: 3, type: 'bench' },
      { dx: 48, dy: 5, type: 'sign_board' },
      { dx: 65, dy: 3, type: 'bench' },
      { dx: 82, dy: 5, type: 'sign_board' },
      { dx: 100, dy: 3, type: 'bollard' },
      // 中層 — 街灯とプランター
      { dx: 15, dy: 22, type: 'street_lamp' },
      { dx: 48, dy: 22, type: 'street_lamp' },
      { dx: 82, dy: 22, type: 'street_lamp' },
      // 裏 — 配電設備
      { dx: 32, dy: 34, type: 'electric_box' },
      { dx: 65, dy: 34, type: 'electric_box' },
    ],
  },

  // コンセプト: 時計塔と高層マンションのペア。時計塔は小さな広場に建ち、
  // ベンチと花壇、マンション前は駐輪と郵便受け。裏は共用の木立。
  {
    id: 'clock_tower_trio', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'clock_tower' },
      { dx: 36, dy: 0,  size: 'apartment_tall' },
    ],
    furniture: [
      // 時計塔前の小広場
      { dx:  0, dy: 3, type: 'bench' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 20, dy: 5, type: 'street_lamp' },
      // マンション前
      { dx: 36, dy: 5, type: 'mailbox' },
      { dx: 48, dy: 4, type: 'bicycle_rack' },
      { dx: 60, dy: 3, type: 'planter' },
      // 中層
      { dx: 36, dy: 22, type: 'bush' },
      // 裏
      { dx: 10, dy: 36, type: 'tree' },
      { dx: 48, dy: 36, type: 'tree' },
    ],
  },

  // コンセプト: 映画館。マーキー (banner_pole) が前面で派手に、
  // 待ち客用のベンチとバナーポール、新聞スタンド、ポスター看板。
  // 裏は搬入口でダンプスターと電気設備。
  {
    id: 'movie_library', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'movie_theater' },
    ],
    furniture: [
      // 前面
      { dx:  0, dy: 6, type: 'banner_pole' },
      { dx: 10, dy: 3, type: 'newspaper_stand' },
      { dx: 22, dy: 5, type: 'sign_board' },
      { dx: 40, dy: 3, type: 'bench' },
      { dx: 54, dy: 3, type: 'vending' },
      { dx: 66, dy: 6, type: 'banner_pole' },
      // 中層 — 大看板
      { dx: 22, dy: 22, type: 'banner_pole' },
      // 裏 — 搬入口
      { dx:  4, dy: 34, type: 'dumpster' },
      { dx: 54, dy: 34, type: 'electric_box' },
    ],
  },

  // コンセプト: 博物館。前庭は格式のある庭園で松のシンメトリー、
  // 中央に銅像。入口両脇に旗竿。裏は庭園がさらに奥まで続き、
  // 松林の背景。
  {
    id: 'museum_complex', tier: 'top', width: 60,
    buildings: [
      { dx: 22, dy: 0,  size: 'museum' },
    ],
    furniture: [
      // 前庭 (シンメトリー)
      { dx: -2, dy: 1, type: 'hedge' },
      { dx:  0, dy: 4, type: 'pine_tree' },
      { dx:  8, dy: 5, type: 'flag_pole' },
      { dx: 22, dy: 6, type: 'statue' },
      { dx: 38, dy: 5, type: 'flag_pole' },
      { dx: 46, dy: 4, type: 'pine_tree' },
      { dx: 58, dy: 1, type: 'hedge' },
      // 中層 — 庭園の植栽
      { dx: 22, dy: 22, type: 'planter' },
      // 裏庭 — 松林
      { dx:  6, dy: 34, type: 'pine_tree' },
      { dx: 38, dy: 34, type: 'pine_tree' },
    ],
  },

  // コンセプト: 郊外型スーパー。建物左、駐車場が右半分を占める。
  // 建物前に大看板と駐輪ラック。駐車場はボラードで車線分離、
  // 入口にカート置場 (bicycle_rack で代用)。裏は搬入口。
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy: 0,  size: 'supermarket' },
    ],
    furniture: [
      // 店頭
      { dx:  2, dy: 3, type: 'vending' },
      { dx: 10, dy: 4, type: 'bicycle_rack' },
      { dx: 20, dy: 6, type: 'sign_board' },
      { dx: 32, dy: 3, type: 'bicycle_rack' },   // カート置場
      // 駐車場の境界
      { dx: 40, dy: 3, type: 'bollard' },
      { dx: 72, dy: 3, type: 'bollard' },
      // 中層 — 駐車場の街灯
      { dx: 56, dy: 22, type: 'street_lamp' },
      // 裏 — 搬入口
      { dx: 10, dy: 34, type: 'dumpster' },
      { dx: 56, dy: 34, type: 'electric_box' },
    ],
    parkedVehicles: [
      { dx: 46, dy: 1, type: 'car' },
      { dx: 58, dy: 1, type: 'car' },
      { dx: 70, dy: 1, type: 'van' },
    ],
  },

  // コンセプト: 大型スタジアムと無線塔 (2-cell)。スタジアム入場口に
  // バナーポールと案内看板、ボラードで人流を区切る。無線塔の足元は
  // 電気設備が集中し、フェンスで囲われた工業的エリア。
  {
    id: 'stadium_radio', tier: 'top', width: 90,
    buildings: [
      { dx: 30, dy: 0,  size: 'stadium' },
      { dx: 80, dy: 0,  size: 'radio_tower' },
    ],
    furniture: [
      // スタジアム入場口
      { dx: -1, dy: 5, type: 'banner_pole' },
      { dx: 14, dy: 3, type: 'bollard' },
      { dx: 30, dy: 6, type: 'sign_board' },
      { dx: 46, dy: 3, type: 'bollard' },
      { dx: 60, dy: 5, type: 'banner_pole' },
      // 無線塔の工業エリア
      { dx: 72, dy: 3, type: 'electric_box' },
      { dx: 80, dy: 4, type: 'sign_board' },
      { dx: 88, dy: 3, type: 'electric_box' },
      // 中層
      { dx: 14, dy: 22, type: 'street_lamp' },
      { dx: 46, dy: 22, type: 'street_lamp' },
      // 裏
      { dx:  4, dy: 34, type: 'dumpster' },
    ],
  },

  // コンセプト: 観覧車のある小さな遊園地の一角。前面に入場口の
  // 看板、待ちベンチと食事用パラソル、敷地を生垣で区切る。
  // 奥は植栽と旗竿で華やかに。
  {
    id: 'ferris_wheel_zone', tier: 'top', width: 66,
    buildings: [
      { dx: 22, dy: 0,  size: 'ferris_wheel' },
    ],
    furniture: [
      // 入場口
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 5, type: 'banner_pole' },
      { dx: 22, dy: 6, type: 'sign_board' },
      { dx: 46, dy: 3, type: 'parasol' },        // 食事エリア
      { dx: 56, dy: 3, type: 'bench' },
      { dx: 65, dy: 5, type: 'flag_pole' },
      { dx: 68, dy: 1, type: 'hedge' },
      // 中層
      { dx: 22, dy: 22, type: 'street_lamp' },
      { dx: 56, dy: 22, type: 'planter' },
      // 奥 — 桜の景観
      { dx: 56, dy: 38, type: 'sakura_tree' },
    ],
  },

  // コンセプト: 給水塔と高層マンションの工業+住宅ミックス。給水塔側は
  // フェンスで囲った設備エリアで電気ボックスが並ぶ。マンション側は
  // 駐輪ラックと郵便受け。敷地境界は生垣。
  {
    id: 'water_tower_apartment', tier: 'top', width: 60,
    buildings: [
      { dx: 10, dy: 0,  size: 'water_tower' },
      { dx: 42, dy: 0,  size: 'apartment_tall' },
    ],
    furniture: [
      // 給水塔の設備エリア
      { dx: -1, dy: 1, type: 'hedge' },
      { dx:  2, dy: 3, type: 'electric_box' },
      { dx: 10, dy: 5, type: 'sign_board' },
      { dx: 20, dy: 3, type: 'electric_box' },
      // マンション前
      { dx: 32, dy: 5, type: 'mailbox' },
      { dx: 42, dy: 4, type: 'bicycle_rack' },
      { dx: 54, dy: 3, type: 'bench' },
      { dx: 62, dy: 1, type: 'hedge' },
      // 中層
      { dx: 10, dy: 22, type: 'electric_box' },
      { dx: 42, dy: 22, type: 'street_lamp' },
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
