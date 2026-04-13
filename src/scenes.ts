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
      // 裏庭の共用物置 2 棟 (家の間の裏手に)
      { dx: 18, dy: 34, size: 'shed' },
      { dx: 38, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 前面: 生垣で敷地を囲み、玄関前に花壇
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 18, dy:  3, type: 'bush' },      // 敷地境界
      { dx: 28, dy:  4, type: 'flower_bed' },
      { dx: 38, dy:  3, type: 'bush' },      // 敷地境界
      { dx: 48, dy:  4, type: 'flower_bed' },
      { dx: 58, dy:  1, type: 'hedge' },
      // 郵便受け (玄関アプローチ上)
      { dx:  8, dy: 13, type: 'mailbox' },
      { dx: 28, dy: 13, type: 'mailbox' },
      { dx: 48, dy: 13, type: 'mailbox' },
      // 中前層: 裏庭の植栽と自転車置き場
      { dx:  8, dy: 24, type: 'planter' },
      { dx: 28, dy: 26, type: 'bicycle' },
      { dx: 48, dy: 24, type: 'planter' },
      // 中後層: 家庭菜園の畝 (物置間)
      { dx:  8, dy: 48, type: 'flower_bed' },
      { dx: 28, dy: 48, type: 'flower_bed' },
      { dx: 48, dy: 48, type: 'flower_bed' },
      // 裏路地: 共用ゴミ集積所と電柱
      { dx: -2, dy: 64, type: 'power_pole' },
      { dx: 14, dy: 66, type: 'garbage' },
      { dx: 42, dy: 66, type: 'recycling_bin' },
      { dx: 58, dy: 64, type: 'power_pole' },
      // 最奥: 共用の桜と街区の木立
      { dx:  6, dy: 84, type: 'tree' },
      { dx: 28, dy: 86, type: 'sakura_tree' },
      { dx: 50, dy: 84, type: 'tree' },
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
      // 住宅裏の物置と、コンビニ裏のゴミ保管小屋
      { dx:  8, dy: 36, size: 'shed' },
      { dx: 40, dy: 38, size: 'garage' },  // コンビニ搬入ヤード
    ],
    furniture: [
      // 前面: 住宅玄関 + コンビニ店頭
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 19, dy:  3, type: 'bush' },      // 敷地境界
      { dx: 32, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'vending' },
      { dx: 52, dy:  3, type: 'bicycle_rack' },
      // 玄関 / 店頭の第二列
      { dx:  8, dy: 13, type: 'mailbox' },
      { dx: 26, dy: 13, type: 'newspaper_stand' },
      { dx: 38, dy: 14, type: 'atm' },       // 店頭 ATM
      // 中前層: 住宅の側庭 / コンビニ搬入動線
      { dx:  8, dy: 24, type: 'planter' },
      { dx: 20, dy: 26, type: 'bicycle' },
      { dx: 42, dy: 24, type: 'dumpster' },
      { dx: 52, dy: 26, type: 'electric_box' },
      // 中後層: 住宅家庭菜園 + コンビニ裏搬入口
      { dx:  4, dy: 50, type: 'flower_bed' },
      { dx: 20, dy: 50, type: 'flower_bed' },
      { dx: 40, dy: 52, type: 'recycling_bin' },
      // 奥: 裏路地と共用電柱
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 28, dy: 68, type: 'garbage' },
      { dx: 58, dy: 66, type: 'power_pole' },
      // 最奥: 裏の木立で街区後端
      { dx:  8, dy: 84, type: 'tree' },
      { dx: 32, dy: 86, type: 'tree' },
      { dx: 52, dy: 84, type: 'bush' },
    ],
  },

  // コンセプト: 家とガレージの住宅街区。前面は玄関と駐車の車。中層は
  // 裏庭にビニールハウス (家庭菜園)、奥は裏路地で電柱と木立。
  {
    id: 'house_garage', tier: 'bot', width: 48,
    buildings: [
      { dx:  8, dy:  0, size: 'house' },
      { dx: 30, dy:  0, size: 'garage' },
      { dx: 16, dy: 32, size: 'greenhouse' },  // 家庭菜園のビニールハウス
      { dx: 38, dy: 34, size: 'shed' },        // 農具小屋
    ],
    furniture: [
      // 前面: 生垣と玄関
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  8, dy:  4, type: 'flower_bed' },
      { dx: 19, dy:  3, type: 'bush' },      // 敷地境界
      { dx: 48, dy:  1, type: 'hedge' },
      // 玄関ポーチ / ガレージ脇
      { dx:  8, dy: 13, type: 'mailbox' },
      { dx: 20, dy: 14, type: 'bicycle' },
      { dx: 40, dy: 13, type: 'traffic_cone' },   // ガレージ前の目印
      // 中前層: 前庭の畝と物置脇
      { dx:  4, dy: 24, type: 'planter' },
      { dx: 28, dy: 26, type: 'flower_bed' },
      // 中後層: ビニールハウス脇の畝
      { dx:  4, dy: 48, type: 'flower_bed' },
      { dx: 28, dy: 48, type: 'flower_bed' },
      // 奥: 裏路地 + 堆肥置き場
      { dx: -2, dy: 64, type: 'power_pole' },
      { dx: 16, dy: 66, type: 'garbage' },
      { dx: 38, dy: 66, type: 'recycling_bin' },
      { dx: 50, dy: 64, type: 'power_pole' },
      // 最奥: 防風林
      { dx:  8, dy: 84, type: 'tree' },
      { dx: 24, dy: 86, type: 'tree' },
      { dx: 44, dy: 84, type: 'tree' },
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
      // 中段に 2 棟目のビニールハウスを追加 (本格的な農家)
      { dx: 14, dy: 38, size: 'greenhouse' },
      // 最奥に納屋 (藁置き場)
      { dx: 32, dy: 60, size: 'shed' },
    ],
    furniture: [
      // 前面: 敷地境界と前庭の畝
      { dx: -2, dy:  2, type: 'bush' },
      { dx: 18, dy:  4, type: 'flower_bed' },
      { dx: 44, dy:  2, type: 'bush' },
      // 農作業エリア入口
      { dx:  4, dy: 12, type: 'bicycle' },       // 農家の自転車
      { dx: 22, dy: 14, type: 'garbage' },       // 生ゴミ堆肥
      // 中前層: 手前の畝
      { dx:  4, dy: 24, type: 'flower_bed' },
      { dx: 38, dy: 26, type: 'flower_bed' },
      // 中後層: 奥の畝 (ハウス間)
      { dx:  4, dy: 50, type: 'flower_bed' },
      { dx: 30, dy: 52, type: 'flower_bed' },
      // 農具スペース
      { dx: 10, dy: 60, type: 'recycling_bin' }, // 肥料樽
      // 最奥: 防風林と水路の電柱
      { dx: -2, dy: 80, type: 'power_pole' },
      { dx: 14, dy: 84, type: 'tree' },
      { dx: 46, dy: 80, type: 'power_pole' },
      // 最奥列の木立
      { dx:  4, dy: 88, type: 'bush' },
      { dx: 38, dy: 88, type: 'bush' },
    ],
  },

  // コンセプト: 単体コンビニの街区。前面に店頭ファサード (自販機, ATM,
  // 看板, 自転車)。中層は裏の搬入エリアで dumpster と recycling。
  // 奥は空き地と電柱・木 1 本で敷地の後端。
  {
    id: 'konbini_corner', tier: 'bot', width: 40,
    buildings: [
      { dx: 14, dy:  0, size: 'convenience' },
      // 店裏の従業員用ガレージと物置
      { dx:  8, dy: 36, size: 'garage' },
      { dx: 30, dy: 40, size: 'shed' },
    ],
    furniture: [
      // 店頭: 賑やかなコンビニ前
      { dx: -1, dy:  3, type: 'vending' },
      { dx:  4, dy:  5, type: 'atm' },
      { dx: 14, dy:  6, type: 'sign_board' },
      { dx: 28, dy:  3, type: 'bicycle_rack' },
      { dx: 34, dy:  3, type: 'newspaper_stand' },
      // 店頭第 2 列: ゴミ箱と傘立て
      { dx:  0, dy: 12, type: 'garbage' },
      { dx: 14, dy: 13, type: 'bollard' },
      { dx: 22, dy: 12, type: 'newspaper_stand' },
      // 中前層: 搬入動線
      { dx:  4, dy: 22, type: 'dumpster' },
      { dx: 24, dy: 24, type: 'recycling_bin' },
      { dx: 34, dy: 22, type: 'electric_box' },
      // 中後層: 従業員駐車場と駐輪
      { dx: 24, dy: 50, type: 'bicycle_rack' },
      { dx: 38, dy: 52, type: 'traffic_cone' },
      // 奥: 裏路地の電柱と配電
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 20, dy: 68, type: 'electric_box' },
      { dx: 42, dy: 66, type: 'power_pole' },
      // 最奥: 空地と雑木
      { dx: 10, dy: 86, type: 'tree' },
      { dx: 30, dy: 86, type: 'bush' },
    ],
    parkedVehicles: [
      { dx:  8, dy: 1, type: 'car' },  // 従業員の車
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
      // 店裏の業務用冷蔵庫置場と物置
      { dx: 10, dy: 36, size: 'shed' },
      { dx: 34, dy: 36, size: 'shed' },
    ],
    furniture: [
      // 店頭: 提灯と暖簾で賑やか
      { dx: -1, dy:  3, type: 'parasol' },
      { dx: 10, dy:  6, type: 'banner_pole' },
      { dx: 22, dy:  3, type: 'vending' },
      { dx: 34, dy:  3, type: 'parasol' },
      { dx: 34, dy:  6, type: 'banner_pole' },
      { dx: 48, dy:  4, type: 'bicycle' },
      // 店頭第 2 列: 看板と客用ベンチ
      { dx:  4, dy: 13, type: 'sign_board' },
      { dx: 22, dy: 12, type: 'bench' },
      { dx: 42, dy: 13, type: 'sign_board' },
      // 中前層: 搬入動線と業務機器
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 22, dy: 26, type: 'electric_box' },
      { dx: 42, dy: 24, type: 'recycling_bin' },
      // 中後層: 業務用冷蔵庫とビール樽
      { dx:  4, dy: 50, type: 'garbage' },
      { dx: 22, dy: 52, type: 'recycling_bin' },
      { dx: 42, dy: 50, type: 'garbage' },
      // 奥: 路地裏の電柱と換気ダクト
      { dx: -2, dy: 64, type: 'power_pole' },
      { dx: 22, dy: 66, type: 'electric_box' },
      { dx: 52, dy: 64, type: 'power_pole' },
      // 最奥: 路地の照明と雑木
      { dx: 10, dy: 82, type: 'street_lamp' },
      { dx: 34, dy: 82, type: 'street_lamp' },
      { dx: 24, dy: 88, type: 'tree' },
    ],
  },

  // コンセプト: 花屋とパン屋の路面店街区。前面は花の陳列とパラソル。
  // 中層は店裏の小さな搬入口と植栽。奥は電柱と木で裏路地を示す。
  {
    id: 'florist_bakery', tier: 'bot', width: 40,
    buildings: [
      { dx:  8, dy:  0, size: 'florist' },
      { dx: 26, dy:  0, size: 'bakery' },
      // 花屋の栽培用ハウス、パン屋の作業小屋
      { dx:  8, dy: 34, size: 'greenhouse' },
      { dx: 30, dy: 36, size: 'shed' },
    ],
    furniture: [
      // 店頭: 花の陳列と焼き立て看板
      { dx: -2, dy:  3, type: 'flower_bed' },
      { dx:  2, dy:  4, type: 'planter' },
      { dx:  8, dy:  5, type: 'parasol' },
      { dx: 17, dy:  3, type: 'bench' },
      { dx: 26, dy:  5, type: 'parasol' },
      { dx: 38, dy:  3, type: 'flower_bed' },
      // 店頭第 2 列: 看板と黒板
      { dx:  8, dy: 13, type: 'sign_board' },
      { dx: 17, dy: 13, type: 'newspaper_stand' },
      { dx: 26, dy: 13, type: 'sign_board' },
      // 中前層: 店裏の植栽エリア
      { dx:  4, dy: 24, type: 'planter' },
      { dx: 18, dy: 24, type: 'flower_bed' },
      { dx: 36, dy: 24, type: 'garbage' },
      // 中後層: 栽培ハウス脇と搬入
      { dx: 22, dy: 50, type: 'planter' },
      { dx: 38, dy: 52, type: 'recycling_bin' },
      // 奥: 裏路地の電柱
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 18, dy: 68, type: 'electric_box' },
      { dx: 42, dy: 66, type: 'power_pole' },
      // 最奥: 桜と裏の木立
      { dx:  8, dy: 86, type: 'sakura_tree' },
      { dx: 30, dy: 86, type: 'tree' },
    ],
  },

  // コンセプト: ガソリンスタンド街区。前面は給油エリア (価格看板・バナー・
  // ボラード・駐車中の車)。中層は敷地内の油タンクと洗車用設備。
  // 奥はフェンスの外の裏路地を示す電柱と木。
  {
    id: 'gas_station_corner', tier: 'bot', width: 46,
    buildings: [
      { dx: 16, dy:  0, size: 'gas_station' },
      // 整備工場 (奥側)
      { dx: 30, dy: 28, size: 'garage' },
      // 部品倉庫
      { dx: 10, dy: 48, size: 'shed' },
    ],
    furniture: [
      // 給油エリア
      { dx: -1, dy:  2, type: 'bollard' },
      { dx:  2, dy:  6, type: 'sign_board' },
      { dx: 16, dy:  7, type: 'banner_pole' },
      { dx: 34, dy:  2, type: 'bollard' },
      { dx: 42, dy:  3, type: 'fire_extinguisher' },
      // 給油機前の第 2 列
      { dx:  8, dy: 12, type: 'traffic_cone' },
      { dx: 16, dy: 14, type: 'hydrant' },
      { dx: 26, dy: 12, type: 'traffic_cone' },
      // 中前層: 洗車機 / 空気入れエリア
      { dx:  4, dy: 22, type: 'electric_box' },
      { dx: 16, dy: 24, type: 'vending' },
      { dx: 42, dy: 22, type: 'recycling_bin' },
      // 中後層: 整備工場前のツール
      { dx:  4, dy: 48, type: 'bollard' },
      { dx: 22, dy: 48, type: 'traffic_cone' },
      { dx: 42, dy: 50, type: 'dumpster' },
      // 奥: フェンス沿いの設備
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 22, dy: 68, type: 'electric_box' },
      { dx: 48, dy: 66, type: 'power_pole' },
      // 最奥: 境界の雑木
      { dx: 10, dy: 86, type: 'tree' },
      { dx: 36, dy: 86, type: 'tree' },
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
      // ランドリー裏のボイラー室、薬局裏の倉庫
      { dx: 10, dy: 34, size: 'shed' },
      { dx: 33, dy: 34, size: 'shed' },
    ],
    furniture: [
      // 店頭: 待ち客の椅子と看板
      { dx:  0, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 21, dy:  3, type: 'vending' },
      { dx: 33, dy:  5, type: 'sign_board' },
      { dx: 44, dy:  3, type: 'planter' },
      // 店頭第 2 列: 自販機と新聞
      { dx:  2, dy: 13, type: 'newspaper_stand' },
      { dx: 21, dy: 13, type: 'bicycle_rack' },
      { dx: 42, dy: 13, type: 'vending' },
      // 中前層: 駐輪と植栽
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 21, dy: 26, type: 'planter' },
      { dx: 38, dy: 24, type: 'garbage' },
      // 中後層: 業務裏口のボイラー配管
      { dx:  4, dy: 50, type: 'electric_box' },
      { dx: 22, dy: 52, type: 'recycling_bin' },
      { dx: 42, dy: 50, type: 'electric_box' },
      // 奥: 裏路地の電柱と街灯
      { dx: -2, dy: 66, type: 'power_pole' },
      { dx: 22, dy: 68, type: 'street_lamp' },
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
      // 共用の裏庭物置、奥に読書小屋 (作家の離れ)
      { dx: 22, dy: 40, size: 'shed' },
      { dx: 10, dy: 62, size: 'shed' },
    ],
    furniture: [
      // 店頭: テラスと屋外ワゴン
      { dx: -1, dy:  3, type: 'parasol' },
      { dx:  4, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 21, dy:  3, type: 'bench' },
      { dx: 33, dy:  3, type: 'newspaper_stand' },
      { dx: 44, dy:  3, type: 'planter' },
      // 店頭第 2 列: メニュー看板とテラス
      { dx: 10, dy: 13, type: 'planter' },
      { dx: 22, dy: 14, type: 'bench' },
      { dx: 33, dy: 13, type: 'sign_board' },
      // 中前層: 静かな裏庭の入口
      { dx:  4, dy: 24, type: 'planter' },
      { dx: 22, dy: 28, type: 'sakura_tree' },
      { dx: 40, dy: 24, type: 'flower_bed' },
      // 中後層: 物置脇の小径
      { dx:  4, dy: 50, type: 'bush' },
      { dx: 36, dy: 52, type: 'planter' },
      // 奥: 離れを囲む木立
      { dx: 32, dy: 66, type: 'bush' },
      { dx: 44, dy: 64, type: 'power_pole' },
      // 最奥: 読書庭園の奥
      { dx: -2, dy: 84, type: 'power_pole' },
      { dx: 22, dy: 86, type: 'sakura_tree' },
      { dx: 44, dy: 84, type: 'tree' },
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
      // 店裏の業務用倉庫 (食材保管・氷室)
      { dx: 16, dy: 38, size: 'shed' },
      { dx: 40, dy: 38, size: 'shed' },
      { dx: 64, dy: 38, size: 'shed' },
      // 最奥に従業員宿舎 (2 階建てタウンハウス)
      { dx: 36, dy: 64, size: 'townhouse' },
    ],
    furniture: [
      // 店前: パラソルとのぼり旗で賑わう商店街
      { dx:  0, dy:  3, type: 'parasol' },
      { dx: 10, dy:  6, type: 'banner_pole' },
      { dx: 19, dy:  3, type: 'vending' },
      { dx: 28, dy:  6, type: 'banner_pole' },
      { dx: 38, dy:  3, type: 'parasol' },
      { dx: 47, dy:  6, type: 'banner_pole' },
      { dx: 55, dy:  3, type: 'bicycle' },
      { dx: 64, dy:  6, type: 'banner_pole' },
      { dx: 74, dy:  3, type: 'parasol' },
      // 歩道: アーケード街灯と客の椅子
      { dx:  4, dy: 14, type: 'bench' },
      { dx: 19, dy: 14, type: 'sign_board' },
      { dx: 38, dy: 14, type: 'bench' },
      { dx: 55, dy: 14, type: 'sign_board' },
      { dx: 70, dy: 14, type: 'bench' },
      // 中前層: 搬入路と業務設備
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 22, dy: 26, type: 'electric_box' },
      { dx: 38, dy: 24, type: 'electric_box' },
      { dx: 55, dy: 26, type: 'electric_box' },
      { dx: 70, dy: 24, type: 'recycling_bin' },
      // 中後層: 業務倉庫脇の設備
      { dx:  4, dy: 52, type: 'garbage' },
      { dx: 28, dy: 50, type: 'recycling_bin' },
      { dx: 55, dy: 50, type: 'dumpster' },
      { dx: 70, dy: 52, type: 'garbage' },
      // 奥: 宿舎前の共用スペース
      { dx:  4, dy: 68, type: 'bicycle_rack' },
      { dx: 16, dy: 70, type: 'mailbox' },
      { dx: 55, dy: 70, type: 'mailbox' },
      { dx: 70, dy: 68, type: 'bicycle_rack' },
      // 最奥: 裏路地の街灯と電柱
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
      // 店裏の景品倉庫と発電機小屋
      { dx: 15, dy: 38, size: 'shed' },
      { dx: 50, dy: 38, size: 'shed' },
      // 最奥にスタッフ用車庫
      { dx: 32, dy: 62, size: 'garage' },
    ],
    furniture: [
      // 派手なネオン前面
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx:  6, dy:  4, type: 'bicycle' },
      { dx: 15, dy:  7, type: 'banner_pole' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 38, dy:  3, type: 'vending' },
      { dx: 50, dy:  7, type: 'banner_pole' },
      { dx: 60, dy:  4, type: 'bicycle' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 店頭第 2 列: 看板と灰皿 (バリア代用)
      { dx: 15, dy: 14, type: 'sign_board' },
      { dx: 32, dy: 14, type: 'barrier' },
      { dx: 50, dy: 14, type: 'sign_board' },
      // 中前層: 搬入動線と業務設備
      { dx:  6, dy: 24, type: 'dumpster' },
      { dx: 32, dy: 24, type: 'electric_box' },
      { dx: 60, dy: 24, type: 'dumpster' },
      // 中後層: 換気装置と景品搬入
      { dx:  6, dy: 52, type: 'electric_box' },
      { dx: 32, dy: 52, type: 'recycling_bin' },
      { dx: 60, dy: 52, type: 'electric_box' },
      // 奥: スタッフ駐車スペース
      { dx:  6, dy: 68, type: 'bollard' },
      { dx: 20, dy: 70, type: 'traffic_cone' },
      { dx: 48, dy: 70, type: 'traffic_cone' },
      { dx: 60, dy: 68, type: 'bollard' },
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
      // 店裏の共用倉庫 2 棟
      { dx: 18, dy: 36, size: 'shed' },
      { dx: 46, dy: 36, size: 'shed' },
      // 最奥に作家の離れ (読書家の住居)
      { dx: 32, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 店頭: テラスと屋外ベンチ
      { dx: -1, dy:  4, type: 'parasol' },
      { dx:  4, dy:  3, type: 'bench' },
      { dx: 21, dy:  5, type: 'street_lamp' },
      { dx: 32, dy:  3, type: 'newspaper_stand' },
      { dx: 43, dy:  5, type: 'street_lamp' },
      { dx: 54, dy:  5, type: 'sign_board' },
      { dx: 65, dy:  3, type: 'planter' },
      // 店頭第 2 列: メニューワゴンとテラス席
      { dx: 10, dy: 13, type: 'sign_board' },
      { dx: 32, dy: 13, type: 'planter' },
      { dx: 54, dy: 13, type: 'bench' },
      // 中前層: 裏の共用駐輪と植栽
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 32, dy: 26, type: 'planter' },
      { dx: 60, dy: 24, type: 'garbage' },
      // 中後層: 倉庫前の搬入動線
      { dx:  4, dy: 50, type: 'recycling_bin' },
      { dx: 32, dy: 52, type: 'electric_box' },
      { dx: 60, dy: 50, type: 'dumpster' },
      // 奥: 離れの玄関と小庭
      { dx: 18, dy: 68, type: 'flower_bed' },
      { dx: 32, dy: 70, type: 'mailbox' },
      { dx: 46, dy: 68, type: 'flower_bed' },
      // 最奥: 桜と電柱
      { dx: -2, dy: 84, type: 'power_pole' },
      { dx: 14, dy: 86, type: 'sakura_tree' },
      { dx: 50, dy: 86, type: 'sakura_tree' },
      { dx: 68, dy: 84, type: 'power_pole' },
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
      // 店裏の共用倉庫と作業小屋
      { dx: 11, dy: 36, size: 'shed' },
      { dx: 35, dy: 36, size: 'shed' },
      { dx: 59, dy: 36, size: 'shed' },
      // 最奥に店主用の離れタウンハウス
      { dx: 22, dy: 62, size: 'townhouse' },
      { dx: 50, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 店頭: パラソル並び
      { dx:  0, dy:  4, type: 'parasol' },
      { dx: 11, dy:  6, type: 'sign_board' },
      { dx: 23, dy:  3, type: 'vending' },
      { dx: 35, dy:  4, type: 'parasol' },
      { dx: 35, dy:  7, type: 'banner_pole' },
      { dx: 47, dy:  3, type: 'bench' },
      { dx: 59, dy:  6, type: 'sign_board' },
      { dx: 72, dy:  4, type: 'parasol' },
      // 店頭第 2 列: 歩道の植栽
      { dx: 11, dy: 13, type: 'planter' },
      { dx: 35, dy: 14, type: 'bench' },
      { dx: 59, dy: 13, type: 'planter' },
      // 中前層: 搬入路
      { dx:  4, dy: 24, type: 'dumpster' },
      { dx: 23, dy: 26, type: 'electric_box' },
      { dx: 35, dy: 24, type: 'electric_box' },
      { dx: 47, dy: 26, type: 'electric_box' },
      { dx: 68, dy: 24, type: 'dumpster' },
      // 中後層: 倉庫脇の搬入動線
      { dx:  4, dy: 50, type: 'garbage' },
      { dx: 23, dy: 52, type: 'recycling_bin' },
      { dx: 47, dy: 52, type: 'recycling_bin' },
      { dx: 68, dy: 50, type: 'garbage' },
      // 奥: 離れの前の小庭 (郵便受けと花壇)
      { dx:  4, dy: 68, type: 'flower_bed' },
      { dx: 22, dy: 70, type: 'mailbox' },
      { dx: 36, dy: 68, type: 'flower_bed' },
      { dx: 50, dy: 70, type: 'mailbox' },
      { dx: 68, dy: 68, type: 'flower_bed' },
      // 最奥: 裏路地の電柱と街灯
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
      // 裏庭の共用物置 3 棟 (世帯ごとの物置)
      { dx: 10, dy: 36, size: 'shed' },
      { dx: 32, dy: 36, size: 'shed' },
      { dx: 54, dy: 36, size: 'shed' },
      // 最奥に共用のガレージ
      { dx: 32, dy: 62, size: 'garage' },
    ],
    furniture: [
      // 前面: 長屋の玄関並び
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
      // 玄関アプローチ第 2 列: 自転車
      { dx: 10, dy: 13, type: 'bicycle' },
      { dx: 32, dy: 13, type: 'bicycle' },
      { dx: 54, dy: 13, type: 'bicycle' },
      // 中前層: 各戸の裏庭
      { dx: 10, dy: 24, type: 'bicycle_rack' },
      { dx: 21, dy: 26, type: 'planter' },
      { dx: 32, dy: 24, type: 'planter' },
      { dx: 43, dy: 26, type: 'planter' },
      { dx: 54, dy: 24, type: 'garbage' },
      // 中後層: 物置前の家庭菜園
      { dx: 10, dy: 50, type: 'flower_bed' },
      { dx: 32, dy: 50, type: 'flower_bed' },
      { dx: 54, dy: 50, type: 'flower_bed' },
      // 奥: ガレージ前の共用動線
      { dx:  4, dy: 66, type: 'recycling_bin' },
      { dx: 20, dy: 68, type: 'flower_bed' },
      { dx: 44, dy: 68, type: 'flower_bed' },
      { dx: 60, dy: 66, type: 'recycling_bin' },
      // 最奥: 裏路地
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 32, dy: 88, type: 'street_lamp' },
      { dx: 66, dy: 86, type: 'power_pole' },
    ],
  },

  // コンセプト: 神社の境内一区画。前面は参道 (桜の門と狛犬)、中央に
  // 本殿、本殿の背後は cell の縦を深く使った鎮守の森 — 松と竹が
  // 3 層重ねで奥まで続く。境内の奥行きで cell 全体を聖域化。
  {
    id: 'shrine_complex', tier: 'mid', width: 68,
    buildings: [
      { dx: 34, dy:  0, size: 'shrine' },
      // 奥に神職の社務所と神楽殿
      { dx: 14, dy: 42, size: 'shed' },
      { dx: 54, dy: 42, size: 'shed' },
      // 最奥に奥宮 (本殿の後方)
      { dx: 34, dy: 66, size: 'temple' },
    ],
    furniture: [
      // 参道: 桜の門と狛犬
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 18, dy:  5, type: 'statue' },     // 狛犬
      { dx: 34, dy:  4, type: 'flower_bed' },  // 石灯籠前
      { dx: 50, dy:  5, type: 'statue' },     // 狛犬
      { dx: 66, dy:  4, type: 'sakura_tree' },
      // 参道第 2 列: 石灯籠と手水舎 (fountain 流用)
      { dx: 10, dy: 14, type: 'bollard' },    // 石柱
      { dx: 34, dy: 14, type: 'fountain' },   // 手水舎
      { dx: 58, dy: 14, type: 'bollard' },    // 石柱
      // 中前層: 参道を守る竹と石灯籠
      { dx:  8, dy: 22, type: 'bamboo_cluster' },
      { dx: 22, dy: 24, type: 'statue' },
      { dx: 46, dy: 24, type: 'statue' },
      { dx: 60, dy: 22, type: 'bamboo_cluster' },
      // 中後層: 神職の通路と鎮守の森前列
      { dx: 28, dy: 46, type: 'pine_tree' },
      { dx: 40, dy: 46, type: 'pine_tree' },
      // 奥宮周辺
      { dx:  4, dy: 68, type: 'pine_tree' },
      { dx: 64, dy: 68, type: 'pine_tree' },
      // 最奥: 深い鎮守の森
      { dx:  2, dy: 86, type: 'pine_tree' },
      { dx: 18, dy: 88, type: 'bamboo_cluster' },
      { dx: 34, dy: 90, type: 'pine_tree' },
      { dx: 50, dy: 88, type: 'bamboo_cluster' },
      { dx: 66, dy: 86, type: 'pine_tree' },
    ],
  },

  // コンセプト: 禅寺の一区画。前面に山門と石灯籠、本堂。本堂の
  // 背後は裏山で、松林と竹林が cell の奥まで深く続く。寺の庭と
  // 裏山の境界が曖昧な日本の寺院風景。
  {
    id: 'temple_garden', tier: 'mid', width: 62,
    buildings: [
      { dx: 22, dy:  0, size: 'temple' },
      // 境内の鐘楼と納経所
      { dx: 46, dy: 22, size: 'shed' },
      // 庭園の中ほどに茶室
      { dx: 12, dy: 46, size: 'shed' },
      { dx: 40, dy: 50, size: 'shed' },
    ],
    furniture: [
      // 山門前の庭
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 10, dy:  3, type: 'planter' },
      { dx: 22, dy:  6, type: 'statue' },   // 石灯籠
      { dx: 44, dy:  3, type: 'planter' },
      { dx: 60, dy:  4, type: 'pine_tree' },
      // 参道の第 2 列: 手水舎と石柱
      { dx: 10, dy: 14, type: 'fountain' },
      { dx: 22, dy: 14, type: 'bollard' },
      { dx: 34, dy: 14, type: 'bollard' },
      // 中前層: 庭園の竹林
      { dx:  4, dy: 22, type: 'bamboo_cluster' },
      { dx: 22, dy: 24, type: 'bamboo_cluster' },
      // 中後層: 枯山水と石灯籠
      { dx: 24, dy: 48, type: 'statue' },
      { dx: 54, dy: 52, type: 'statue' },
      // 奥: 裏山の前列
      { dx: -2, dy: 68, type: 'pine_tree' },
      { dx: 22, dy: 70, type: 'pine_tree' },
      { dx: 42, dy: 70, type: 'pine_tree' },
      { dx: 62, dy: 68, type: 'pine_tree' },
      // 最奥: 深い山林
      { dx:  4, dy: 88, type: 'bamboo_cluster' },
      { dx: 22, dy: 90, type: 'pine_tree' },
      { dx: 42, dy: 90, type: 'pine_tree' },
      { dx: 60, dy: 88, type: 'bamboo_cluster' },
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
      // 検査室の別棟とプレハブ倉庫
      { dx: 13, dy: 36, size: 'shed' },
      { dx: 46, dy: 36, size: 'shed' },
      // 最奥に職員宿舎
      { dx: 30, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 前面: 生垣と待合ベンチ
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'bench' },
      { dx: 13, dy:  5, type: 'sign_board' },
      { dx: 26, dy:  1, type: 'hedge' },
      { dx: 36, dy:  3, type: 'flower_bed' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 56, dy:  3, type: 'bench' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 第 2 列: ロータリー
      { dx: 13, dy: 13, type: 'bollard' },
      { dx: 26, dy: 14, type: 'hydrant' },
      { dx: 46, dy: 13, type: 'bollard' },
      // 中前層: 園庭と駐輪
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 13, dy: 26, type: 'planter' },
      { dx: 36, dy: 24, type: 'flower_bed' },
      { dx: 46, dy: 26, type: 'sakura_tree' },
      { dx: 62, dy: 24, type: 'bicycle_rack' },
      // 中後層: 診療棟裏の動線
      { dx:  4, dy: 50, type: 'electric_box' },
      { dx: 30, dy: 52, type: 'garbage' },
      { dx: 62, dy: 50, type: 'recycling_bin' },
      // 奥: 職員宿舎前の小庭
      { dx: 14, dy: 68, type: 'flower_bed' },
      { dx: 30, dy: 70, type: 'mailbox' },
      { dx: 48, dy: 68, type: 'flower_bed' },
      // 最奥: 裏の街灯と電柱
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 34, dy: 88, type: 'street_lamp' },
      { dx: 68, dy: 86, type: 'power_pole' },
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
      // 訓練用設備: 消防倉庫・警察車庫
      { dx: 15, dy: 38, size: 'garage' },
      { dx: 53, dy: 38, size: 'garage' },
      // 最奥に職員寮
      { dx: 34, dy: 64, size: 'townhouse' },
    ],
    furniture: [
      // 前面: 出動口のバリアと旗竿
      { dx: -2, dy:  3, type: 'bollard' },
      { dx:  0, dy:  4, type: 'hydrant' },
      { dx: 15, dy:  6, type: 'flag_pole' },
      { dx: 30, dy:  3, type: 'bollard' },
      { dx: 34, dy:  5, type: 'traffic_light' },
      { dx: 38, dy:  3, type: 'bollard' },
      { dx: 53, dy:  6, type: 'flag_pole' },
      { dx: 68, dy:  3, type: 'bollard' },
      // 第 2 列: 表示灯と消火栓
      { dx:  2, dy: 14, type: 'hydrant' },
      { dx: 15, dy: 14, type: 'sign_board' },
      { dx: 34, dy: 14, type: 'fire_extinguisher' },
      { dx: 53, dy: 14, type: 'sign_board' },
      { dx: 66, dy: 14, type: 'hydrant' },
      // 中前層: 職員駐輪と配電
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 15, dy: 26, type: 'electric_box' },
      { dx: 34, dy: 24, type: 'street_lamp' },
      { dx: 53, dy: 26, type: 'electric_box' },
      { dx: 64, dy: 24, type: 'bicycle_rack' },
      // 中後層: 訓練塔周辺の訓練用品
      { dx:  4, dy: 50, type: 'traffic_cone' },
      { dx: 30, dy: 52, type: 'traffic_cone' },
      { dx: 38, dy: 52, type: 'traffic_cone' },
      { dx: 66, dy: 50, type: 'traffic_cone' },
      // 奥: 職員寮前の共用動線
      { dx:  4, dy: 68, type: 'recycling_bin' },
      { dx: 22, dy: 70, type: 'flower_bed' },
      { dx: 46, dy: 70, type: 'flower_bed' },
      { dx: 66, dy: 68, type: 'garbage' },
      // 最奥: 裏路地の電柱
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
      // 金庫室の別棟・郵便仕分け倉庫
      { dx: 14, dy: 38, size: 'shed' },
      { dx: 46, dy: 38, size: 'shed' },
      // 最奥に職員寮
      { dx: 30, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 前面: ATM と郵便ポスト
      { dx:  2, dy:  4, type: 'atm' },
      { dx: 14, dy:  5, type: 'sign_board' },
      { dx: 24, dy:  3, type: 'bench' },
      { dx: 30, dy:  5, type: 'street_lamp' },
      { dx: 40, dy:  4, type: 'post_box' },
      { dx: 46, dy:  5, type: 'sign_board' },
      { dx: 58, dy:  3, type: 'newspaper_stand' },
      // 第 2 列: 歩道の柵と警備ボラード
      { dx:  2, dy: 14, type: 'bollard' },
      { dx: 14, dy: 14, type: 'hydrant' },
      { dx: 30, dy: 14, type: 'bollard' },
      { dx: 46, dy: 14, type: 'hydrant' },
      { dx: 58, dy: 14, type: 'bollard' },
      // 中前層: 職員駐輪と配電
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 14, dy: 26, type: 'atm' },
      { dx: 30, dy: 24, type: 'electric_box' },
      { dx: 46, dy: 26, type: 'post_box' },
      { dx: 58, dy: 24, type: 'bicycle_rack' },
      // 中後層: 警備用車両スペースと電気設備
      { dx:  4, dy: 50, type: 'electric_box' },
      { dx: 30, dy: 52, type: 'traffic_cone' },
      { dx: 58, dy: 50, type: 'electric_box' },
      // 奥: 職員宿舎前の小庭
      { dx: 14, dy: 68, type: 'flower_bed' },
      { dx: 30, dy: 70, type: 'mailbox' },
      { dx: 46, dy: 68, type: 'flower_bed' },
      // 最奥: 裏路地の電柱
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
      // 豪邸の離れ (茶室) と雑貨店裏の倉庫
      { dx:  8, dy: 40, size: 'shed' },
      { dx: 49, dy: 38, size: 'shed' },
      // 最奥に家紋付きの蔵
      { dx: 20, dy: 64, size: 'shed' },
    ],
    furniture: [
      // 前面: 門構えと松
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'pine_tree' },
      { dx: 16, dy:  5, type: 'statue' },
      { dx: 30, dy:  4, type: 'pine_tree' },
      { dx: 34, dy:  1, type: 'hedge' },
      { dx: 49, dy:  4, type: 'parasol' },
      { dx: 58, dy:  3, type: 'bench' },
      // 第 2 列: 門柱と石灯籠
      { dx:  2, dy: 14, type: 'bollard' },
      { dx: 16, dy: 15, type: 'statue' },
      { dx: 30, dy: 14, type: 'bollard' },
      { dx: 49, dy: 14, type: 'sign_board' },
      // 中前層: 豪邸の庭園と雑貨店搬入
      { dx:  8, dy: 24, type: 'bamboo_cluster' },
      { dx: 24, dy: 24, type: 'pine_tree' },
      { dx: 49, dy: 26, type: 'garbage' },
      { dx: 58, dy: 24, type: 'electric_box' },
      // 中後層: 茶室前の飛石と石灯籠
      { dx: 16, dy: 52, type: 'statue' },   // 石灯籠
      { dx: 32, dy: 52, type: 'planter' },  // 飛石の植栽
      { dx: 56, dy: 52, type: 'recycling_bin' },
      // 奥: 深い庭園の奥座敷
      { dx:  4, dy: 68, type: 'pine_tree' },
      { dx: 36, dy: 70, type: 'sakura_tree' },
      { dx: 56, dy: 68, type: 'pine_tree' },
      // 最奥: 家紋の蔵を囲む古木
      { dx: -2, dy: 86, type: 'pine_tree' },
      { dx: 20, dy: 88, type: 'sakura_tree' },
      { dx: 40, dy: 88, type: 'pine_tree' },
      { dx: 62, dy: 86, type: 'pine_tree' },
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
      // 駅裏の信号所、駅員詰所、待合小屋
      { dx:  8, dy: 44, size: 'shed' },
      { dx: 35, dy: 44, size: 'shed' },
      { dx: 62, dy: 44, size: 'shed' },
      // 最奥に駅裏のタクシー営業所
      { dx: 35, dy: 66, size: 'garage' },
    ],
    furniture: [
      // 広場: バス停・タクシー乗り場・駐輪
      { dx: -1, dy:  5, type: 'bus_stop' },
      { dx: 12, dy:  3, type: 'bench' },
      { dx: 22, dy:  4, type: 'bicycle_rack' },
      { dx: 35, dy:  6, type: 'flag_pole' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 58, dy:  3, type: 'bench' },
      { dx: 71, dy:  5, type: 'bus_stop' },
      // 第 2 列: 案内板と街灯
      { dx: 12, dy: 14, type: 'sign_board' },
      { dx: 22, dy: 14, type: 'street_lamp' },
      { dx: 35, dy: 15, type: 'newspaper_stand' },
      { dx: 48, dy: 14, type: 'street_lamp' },
      { dx: 58, dy: 14, type: 'sign_board' },
      // 中前層: 広場中央の銅像と花壇
      { dx:  6, dy: 24, type: 'flower_bed' },
      { dx: 22, dy: 26, type: 'planter' },
      { dx: 35, dy: 22, type: 'statue' },
      { dx: 48, dy: 26, type: 'planter' },
      { dx: 64, dy: 24, type: 'flower_bed' },
      // 駅舎裏の通用口
      { dx:  4, dy: 52, type: 'electric_box' },
      { dx: 22, dy: 52, type: 'post_box' },
      { dx: 48, dy: 52, type: 'atm' },
      { dx: 66, dy: 52, type: 'electric_box' },
      // 奥: 営業所前の駐輪と看板
      { dx:  6, dy: 70, type: 'bicycle_rack' },
      { dx: 20, dy: 72, type: 'traffic_cone' },
      { dx: 50, dy: 72, type: 'traffic_cone' },
      { dx: 64, dy: 70, type: 'bicycle_rack' },
      // 最奥: 駅裏の桜並木
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 14, dy: 88, type: 'sakura_tree' },
      { dx: 35, dy: 90, type: 'sakura_tree' },
      { dx: 56, dy: 88, type: 'sakura_tree' },
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
      // 搬入ヤードの業務棟 2 つ
      { dx: 10, dy: 46, size: 'garage' },
      { dx: 64, dy: 46, size: 'garage' },
      // 最奥に従業員ロッカー棟
      { dx: 37, dy: 66, size: 'shed' },
    ],
    furniture: [
      // 前庭広場: 噴水とバナー
      { dx:  2, dy:  5, type: 'street_lamp' },
      { dx: 14, dy:  3, type: 'bench' },
      { dx: 25, dy:  5, type: 'banner_pole' },
      { dx: 37, dy:  6, type: 'fountain' },
      { dx: 49, dy:  5, type: 'banner_pole' },
      { dx: 60, dy:  3, type: 'bench' },
      { dx: 72, dy:  5, type: 'street_lamp' },
      // 第 2 列: 案内と装飾
      { dx:  2, dy: 14, type: 'planter' },
      { dx: 14, dy: 14, type: 'flower_bed' },
      { dx: 37, dy: 15, type: 'sign_board' },
      { dx: 60, dy: 14, type: 'flower_bed' },
      { dx: 72, dy: 14, type: 'planter' },
      // 中前層: 植栽帯と街灯
      { dx: 14, dy: 24, type: 'planter' },
      { dx: 25, dy: 26, type: 'street_lamp' },
      { dx: 37, dy: 24, type: 'flower_bed' },
      { dx: 49, dy: 26, type: 'street_lamp' },
      { dx: 60, dy: 24, type: 'planter' },
      // 中後層: 搬入ヤード入口
      { dx:  2, dy: 50, type: 'traffic_cone' },
      { dx: 22, dy: 52, type: 'dumpster' },
      { dx: 37, dy: 50, type: 'street_lamp' },
      { dx: 52, dy: 52, type: 'dumpster' },
      { dx: 72, dy: 50, type: 'traffic_cone' },
      // 奥: ロッカー棟前の共用設備
      { dx:  4, dy: 68, type: 'electric_box' },
      { dx: 22, dy: 70, type: 'recycling_bin' },
      { dx: 52, dy: 70, type: 'recycling_bin' },
      { dx: 70, dy: 68, type: 'electric_box' },
      // 最奥: 裏路地の電柱と街灯
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 20, dy: 88, type: 'street_lamp' },
      { dx: 54, dy: 88, type: 'street_lamp' },
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
      // 救急外来棟と霊安室
      { dx:  8, dy: 40, size: 'shed' },
      { dx: 58, dy: 40, size: 'shed' },
      // 最奥に看護師宿舎
      { dx: 30, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 正面ロータリー
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  6, dy:  5, type: 'flag_pole' },
      { dx: 16, dy:  3, type: 'bench' },
      { dx: 27, dy:  5, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'bollard' },
      { dx: 52, dy:  4, type: 'hydrant' },
      { dx: 66, dy:  1, type: 'hedge' },
      // 第 2 列: 歩道の照明と案内
      { dx:  6, dy: 14, type: 'street_lamp' },
      { dx: 16, dy: 14, type: 'planter' },
      { dx: 27, dy: 15, type: 'post_box' },
      { dx: 46, dy: 14, type: 'planter' },
      { dx: 58, dy: 14, type: 'street_lamp' },
      // 中前層: 来客駐車場
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 16, dy: 26, type: 'planter' },
      { dx: 27, dy: 24, type: 'flower_bed' },
      { dx: 38, dy: 26, type: 'traffic_cone' },
      { dx: 52, dy: 24, type: 'electric_box' },
      { dx: 62, dy: 26, type: 'bicycle_rack' },
      // 救急入口と別棟前
      { dx: 20, dy: 48, type: 'hydrant' },
      { dx: 27, dy: 50, type: 'street_lamp' },
      { dx: 40, dy: 48, type: 'fire_extinguisher' },
      // 奥: 宿舎前のリハビリ庭園
      { dx: 10, dy: 68, type: 'flower_bed' },
      { dx: 30, dy: 70, type: 'bench' },
      { dx: 52, dy: 68, type: 'flower_bed' },
      // 最奥: 療養のための静かな木立
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 14, dy: 88, type: 'tree' },
      { dx: 30, dy: 90, type: 'sakura_tree' },
      { dx: 48, dy: 88, type: 'tree' },
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
      // 体育館と部室棟
      { dx: 12, dy: 40, size: 'garage' },
      { dx: 60, dy: 40, size: 'shed' },
      // 最奥にプレハブ校舎 (プレハブ教室)
      { dx: 36, dy: 64, size: 'townhouse' },
    ],
    furniture: [
      // 校門: 生垣と桜
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  4, type: 'sakura_tree' },
      { dx: 10, dy:  5, type: 'flag_pole' },
      { dx: 36, dy:  5, type: 'sign_board' },
      { dx: 62, dy:  5, type: 'flag_pole' },
      { dx: 72, dy:  4, type: 'sakura_tree' },
      { dx: 74, dy:  1, type: 'hedge' },
      // 第 2 列: 校門のプラカードと街灯
      { dx: 10, dy: 14, type: 'bollard' },
      { dx: 36, dy: 15, type: 'statue' },   // 二宮金次郎像
      { dx: 62, dy: 14, type: 'bollard' },
      // 中前層: 校庭 (運動場の設備)
      { dx:  4, dy: 24, type: 'bicycle_rack' },
      { dx: 20, dy: 26, type: 'bench' },
      { dx: 36, dy: 24, type: 'bicycle_rack' },
      { dx: 52, dy: 26, type: 'bench' },
      { dx: 68, dy: 24, type: 'bicycle_rack' },
      // 中後層: 体育倉庫前の用具
      { dx:  4, dy: 50, type: 'traffic_cone' },
      { dx: 24, dy: 52, type: 'bollard' },
      { dx: 48, dy: 52, type: 'bollard' },
      { dx: 68, dy: 50, type: 'traffic_cone' },
      // 奥: プレハブ教室前の花壇
      { dx: 14, dy: 68, type: 'flower_bed' },
      { dx: 36, dy: 70, type: 'planter' },
      { dx: 58, dy: 68, type: 'flower_bed' },
      // 最奥: 学校裏の松林
      { dx:  2, dy: 86, type: 'pine_tree' },
      { dx: 20, dy: 88, type: 'pine_tree' },
      { dx: 36, dy: 90, type: 'pine_tree' },
      { dx: 52, dy: 88, type: 'pine_tree' },
      { dx: 72, dy: 86, type: 'pine_tree' },
    ],
  },

  // コンセプト: 市役所の街区。前面は左右対称の格式ある広場 (噴水・
  // 旗竿 2 本・銅像 2 体・ベンチ・生垣)。中層は広場の植栽帯。
  // 奥は市役所の裏庭で松林の庭園、最奥に街灯。
  {
    id: 'city_hall', tier: 'top', width: 72,
    buildings: [
      { dx: 32, dy:  0, size: 'city_hall' },
      // 議場別館と資料倉庫
      { dx: 10, dy: 42, size: 'shed' },
      { dx: 56, dy: 42, size: 'shed' },
      // 最奥に裏庭の茶室
      { dx: 32, dy: 66, size: 'temple' },
    ],
    furniture: [
      // 前庭: 左右対称の格式ある広場
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  2, dy:  6, type: 'flag_pole' },
      { dx: 12, dy:  5, type: 'statue' },
      { dx: 20, dy:  3, type: 'bench' },
      { dx: 32, dy:  7, type: 'fountain' },
      { dx: 44, dy:  3, type: 'bench' },
      { dx: 52, dy:  5, type: 'statue' },
      { dx: 62, dy:  6, type: 'flag_pole' },
      { dx: 72, dy:  1, type: 'hedge' },
      // 第 2 列: 広場の装飾
      { dx:  2, dy: 14, type: 'bollard' },
      { dx: 12, dy: 14, type: 'flower_bed' },
      { dx: 32, dy: 15, type: 'sign_board' },
      { dx: 52, dy: 14, type: 'flower_bed' },
      { dx: 62, dy: 14, type: 'bollard' },
      // 中前層: 植栽帯と松
      { dx:  6, dy: 24, type: 'planter' },
      { dx: 20, dy: 26, type: 'pine_tree' },
      { dx: 32, dy: 24, type: 'flower_bed' },
      { dx: 44, dy: 26, type: 'pine_tree' },
      { dx: 68, dy: 24, type: 'planter' },
      // 中後層: 別館の前の小庭
      { dx: 22, dy: 50, type: 'statue' },
      { dx: 32, dy: 52, type: 'planter' },
      { dx: 42, dy: 50, type: 'statue' },
      // 奥: 裏庭の松と石灯籠
      { dx:  4, dy: 70, type: 'pine_tree' },
      { dx: 20, dy: 72, type: 'statue' },    // 石灯籠
      { dx: 44, dy: 72, type: 'statue' },
      { dx: 60, dy: 70, type: 'pine_tree' },
      // 最奥: 裏庭の桜並木
      { dx:  2, dy: 86, type: 'bamboo_cluster' },
      { dx: 18, dy: 88, type: 'sakura_tree' },
      { dx: 32, dy: 90, type: 'pine_tree' },
      { dx: 46, dy: 88, type: 'sakura_tree' },
      { dx: 70, dy: 86, type: 'bamboo_cluster' },
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
      // 各ビル裏の業務倉庫 (発電機・空調室)
      { dx: 15, dy: 62, size: 'shed' },
      { dx: 48, dy: 62, size: 'shed' },
      { dx: 82, dy: 62, size: 'shed' },
    ],
    furniture: [
      // 歩道: ボラード、案内看板、ベンチ
      { dx:  0, dy:  3, type: 'bollard' },
      { dx: 15, dy:  5, type: 'sign_board' },
      { dx: 32, dy:  3, type: 'bench' },
      { dx: 48, dy:  5, type: 'sign_board' },
      { dx: 65, dy:  3, type: 'bench' },
      { dx: 82, dy:  5, type: 'sign_board' },
      { dx: 100, dy: 3, type: 'bollard' },
      // 歩道第 2 列: 都市インフラ
      { dx:  6, dy: 14, type: 'hydrant' },
      { dx: 32, dy: 14, type: 'post_box' },
      { dx: 48, dy: 14, type: 'atm' },
      { dx: 65, dy: 14, type: 'newspaper_stand' },
      { dx: 94, dy: 14, type: 'hydrant' },
      // 中前層: ビル前の街灯とプランター
      { dx:  0, dy: 24, type: 'street_lamp' },
      { dx: 15, dy: 26, type: 'planter' },
      { dx: 32, dy: 24, type: 'street_lamp' },
      { dx: 48, dy: 26, type: 'planter' },
      { dx: 65, dy: 24, type: 'street_lamp' },
      { dx: 82, dy: 26, type: 'planter' },
      { dx:100, dy: 24, type: 'street_lamp' },
      // 中後層: 業務用搬入と配電設備
      { dx:  6, dy: 50, type: 'dumpster' },
      { dx: 32, dy: 52, type: 'electric_box' },
      { dx: 48, dy: 50, type: 'recycling_bin' },
      { dx: 65, dy: 52, type: 'electric_box' },
      { dx: 94, dy: 50, type: 'dumpster' },
      // 奥: 業務倉庫前の従業員通路
      { dx:  0, dy: 70, type: 'bicycle_rack' },
      { dx: 32, dy: 72, type: 'garbage' },
      { dx: 65, dy: 72, type: 'garbage' },
      { dx:100, dy: 70, type: 'bicycle_rack' },
      // 最奥: 都市部の硬質な後端
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 20, dy: 88, type: 'tree' },
      { dx: 48, dy: 90, type: 'tree' },
      { dx: 76, dy: 88, type: 'tree' },
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
      // 管理人室とゴミ保管小屋
      { dx: 10, dy: 44, size: 'shed' },
      { dx: 36, dy: 44, size: 'shed' },
      // 最奥に集会所
      { dx: 24, dy: 68, size: 'townhouse' },
    ],
    furniture: [
      // 前面: 広場と入口
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  0, dy:  3, type: 'bench' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 20, dy:  5, type: 'street_lamp' },
      { dx: 36, dy:  5, type: 'mailbox' },
      { dx: 48, dy:  4, type: 'bicycle_rack' },
      { dx: 61, dy:  1, type: 'hedge' },
      // 第 2 列: 広場の装飾
      { dx: 10, dy: 14, type: 'planter' },
      { dx: 36, dy: 15, type: 'post_box' },
      { dx: 48, dy: 14, type: 'flower_bed' },
      // 中前層: 住民用スペース
      { dx:  0, dy: 24, type: 'planter' },
      { dx: 10, dy: 26, type: 'bush' },
      { dx: 24, dy: 24, type: 'bicycle_rack' },
      { dx: 36, dy: 26, type: 'planter' },
      { dx: 52, dy: 24, type: 'bench' },
      // 中後層: 管理棟前の動線
      { dx:  0, dy: 50, type: 'garbage' },
      { dx: 24, dy: 52, type: 'recycling_bin' },
      { dx: 52, dy: 50, type: 'garbage' },
      // 奥: 集会所前の小庭
      { dx: 10, dy: 70, type: 'flower_bed' },
      { dx: 36, dy: 70, type: 'flower_bed' },
      // 最奥: 住宅地らしい桜並木
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 14, dy: 88, type: 'sakura_tree' },
      { dx: 36, dy: 90, type: 'sakura_tree' },
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
      // スクリーン機材庫と映写技師の控室
      { dx: 10, dy: 40, size: 'shed' },
      { dx: 50, dy: 40, size: 'shed' },
      // 最奥に併設図書館 (townhouse 流用)
      { dx: 32, dy: 64, size: 'townhouse' },
    ],
    furniture: [
      // 前面: マーキーと待ち客
      { dx:  0, dy:  6, type: 'banner_pole' },
      { dx: 10, dy:  3, type: 'newspaper_stand' },
      { dx: 22, dy:  5, type: 'sign_board' },
      { dx: 40, dy:  3, type: 'bench' },
      { dx: 54, dy:  3, type: 'vending' },
      { dx: 66, dy:  6, type: 'banner_pole' },
      // 第 2 列: 歩道の装飾と案内
      { dx:  4, dy: 14, type: 'bollard' },
      { dx: 22, dy: 15, type: 'street_lamp' },
      { dx: 40, dy: 14, type: 'flower_bed' },
      { dx: 62, dy: 14, type: 'bollard' },
      // 中前層: ロビー裏の広告とベンチ
      { dx:  4, dy: 24, type: 'bench' },
      { dx: 22, dy: 22, type: 'banner_pole' },
      { dx: 42, dy: 26, type: 'planter' },
      { dx: 62, dy: 24, type: 'bench' },
      // 中後層: 搬入エリア
      { dx:  4, dy: 50, type: 'dumpster' },
      { dx: 30, dy: 52, type: 'electric_box' },
      { dx: 60, dy: 50, type: 'recycling_bin' },
      // 奥: 併設図書館前の小庭
      { dx: 10, dy: 68, type: 'flower_bed' },
      { dx: 32, dy: 70, type: 'bench' },
      { dx: 54, dy: 68, type: 'flower_bed' },
      // 最奥: 文化地区の落ち着いた街並み
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 16, dy: 88, type: 'sakura_tree' },
      { dx: 50, dy: 88, type: 'sakura_tree' },
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
      // 収蔵庫と復元工房
      { dx:  8, dy: 42, size: 'shed' },
      { dx: 36, dy: 42, size: 'shed' },
      // 最奥に学芸員詰所
      { dx: 22, dy: 66, size: 'temple' },
    ],
    furniture: [
      // 前庭: シンメトリーな松
      { dx: -2, dy:  1, type: 'hedge' },
      { dx:  0, dy:  4, type: 'pine_tree' },
      { dx:  8, dy:  5, type: 'flag_pole' },
      { dx: 22, dy:  6, type: 'statue' },
      { dx: 38, dy:  5, type: 'flag_pole' },
      { dx: 46, dy:  4, type: 'pine_tree' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 第 2 列: 前庭の装飾
      { dx:  4, dy: 14, type: 'bollard' },
      { dx: 22, dy: 15, type: 'fountain' },
      { dx: 42, dy: 14, type: 'bollard' },
      // 中前層: 格式ある植栽帯
      { dx:  4, dy: 24, type: 'planter' },
      { dx: 22, dy: 22, type: 'flower_bed' },
      { dx: 42, dy: 24, type: 'planter' },
      // 中後層: 収蔵庫前の石畳と石灯籠
      { dx:  0, dy: 50, type: 'statue' },
      { dx: 22, dy: 52, type: 'planter' },
      { dx: 44, dy: 50, type: 'statue' },
      // 奥: 詰所前の庭園
      { dx: -2, dy: 70, type: 'pine_tree' },
      { dx: 22, dy: 72, type: 'bamboo_cluster' },
      { dx: 46, dy: 70, type: 'pine_tree' },
      // 最奥: 深い松林と竹林
      { dx:  2, dy: 88, type: 'bamboo_cluster' },
      { dx: 22, dy: 90, type: 'pine_tree' },
      { dx: 42, dy: 88, type: 'bamboo_cluster' },
      { dx: 60, dy: 88, type: 'pine_tree' },
    ],
  },

  // コンセプト: 郊外型スーパーの街区。左は建物、右は駐車場 (3 台)、
  // ボラードで区画分離。中層は駐車場の街灯。奥は搬入口で電気設備と
  // ダンプスター、最奥は裏路地の電柱。
  {
    id: 'supermarket_front', tier: 'top', width: 72,
    buildings: [
      { dx: 20, dy:  0, size: 'supermarket' },
      // 冷蔵倉庫 / 生鮮搬入棟
      { dx: 10, dy: 40, size: 'shed' },
      { dx: 30, dy: 44, size: 'garage' },
      // 最奥に従業員休憩棟
      { dx: 56, dy: 66, size: 'townhouse' },
    ],
    furniture: [
      // 店頭: カートと自販機、ボラードで駐車場と仕切り
      { dx:  2, dy:  3, type: 'vending' },
      { dx: 10, dy:  4, type: 'bicycle_rack' },
      { dx: 20, dy:  6, type: 'sign_board' },
      { dx: 32, dy:  3, type: 'bicycle_rack' },
      { dx: 40, dy:  3, type: 'bollard' },
      { dx: 72, dy:  3, type: 'bollard' },
      // 第 2 列: ショッピングカート置場と案内
      { dx:  2, dy: 14, type: 'newspaper_stand' },
      { dx: 20, dy: 14, type: 'banner_pole' },
      { dx: 32, dy: 14, type: 'garbage' },
      { dx: 56, dy: 14, type: 'traffic_cone' },
      // 中前層: 駐車場レーン
      { dx: 10, dy: 24, type: 'flower_bed' },
      { dx: 32, dy: 26, type: 'planter' },
      { dx: 46, dy: 24, type: 'street_lamp' },
      { dx: 68, dy: 24, type: 'traffic_cone' },
      // 中後層: 生鮮搬入エリア
      { dx:  2, dy: 50, type: 'dumpster' },
      { dx: 20, dy: 52, type: 'electric_box' },
      { dx: 46, dy: 50, type: 'recycling_bin' },
      { dx: 68, dy: 52, type: 'dumpster' },
      // 奥: 休憩棟前
      { dx: 10, dy: 70, type: 'bicycle_rack' },
      { dx: 32, dy: 70, type: 'bench' },
      { dx: 68, dy: 70, type: 'bicycle_rack' },
      // 最奥: 裏路地の電柱と木立
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 20, dy: 88, type: 'tree' },
      { dx: 46, dy: 88, type: 'tree' },
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
      // 業務倉庫: VIP 用ロッカーと放送設備室
      { dx: 14, dy: 42, size: 'garage' },
      { dx: 46, dy: 42, size: 'garage' },
      // 最奥に選手宿舎
      { dx: 30, dy: 66, size: 'townhouse' },
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
      // 第 2 列: チケット窓口と案内板
      { dx: 14, dy: 14, type: 'sign_board' },
      { dx: 30, dy: 15, type: 'traffic_cone' },
      { dx: 46, dy: 14, type: 'sign_board' },
      { dx: 80, dy: 14, type: 'bollard' },
      // 中前層: 入場広場の街灯
      { dx:  4, dy: 24, type: 'street_lamp' },
      { dx: 14, dy: 22, type: 'street_lamp' },
      { dx: 30, dy: 24, type: 'bench' },
      { dx: 46, dy: 22, type: 'street_lamp' },
      { dx: 60, dy: 24, type: 'street_lamp' },
      { dx: 80, dy: 22, type: 'electric_box' },
      // 中後層: VIP 駐車スペース
      { dx:  4, dy: 50, type: 'traffic_cone' },
      { dx: 30, dy: 52, type: 'bollard' },
      { dx: 60, dy: 50, type: 'traffic_cone' },
      { dx: 88, dy: 50, type: 'electric_box' },
      // 奥: 選手通用口
      { dx:  4, dy: 70, type: 'bicycle_rack' },
      { dx: 30, dy: 72, type: 'mailbox' },
      { dx: 60, dy: 70, type: 'dumpster' },
      { dx: 88, dy: 70, type: 'dumpster' },
      // 最奥: 敷地を囲う街路樹
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 20, dy: 88, type: 'tree' },
      { dx: 50, dy: 88, type: 'tree' },
      { dx: 78, dy: 88, type: 'tree' },
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
      // 露店 (屋台 shed 流用) と回転木馬小屋
      { dx: 50, dy: 36, size: 'shed' },
      { dx:  8, dy: 44, size: 'shed' },
      // 最奥にメリーゴーランド棟
      { dx: 32, dy: 66, size: 'shrine' },
    ],
    furniture: [
      // 入場口: バナーと旗竿で華やかに
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  5, type: 'banner_pole' },
      { dx: 22, dy:  6, type: 'sign_board' },
      { dx: 46, dy:  3, type: 'parasol' },
      { dx: 56, dy:  3, type: 'bench' },
      { dx: 65, dy:  5, type: 'flag_pole' },
      { dx: 68, dy:  1, type: 'hedge' },
      // 第 2 列: チケット売場と案内
      { dx: 10, dy: 14, type: 'newspaper_stand' },
      { dx: 22, dy: 14, type: 'bollard' },
      { dx: 46, dy: 14, type: 'vending' },
      { dx: 56, dy: 15, type: 'sign_board' },
      // 中前層: 露店広場の街灯と装飾
      { dx:  6, dy: 24, type: 'flag_pole' },
      { dx: 22, dy: 22, type: 'street_lamp' },
      { dx: 38, dy: 24, type: 'planter' },
      { dx: 56, dy: 22, type: 'planter' },
      // 中後層: 屋台前の装飾
      { dx: 22, dy: 48, type: 'parasol' },
      { dx: 38, dy: 50, type: 'banner_pole' },
      { dx: 58, dy: 48, type: 'bench' },
      // 奥: 奥のアトラクション前
      { dx:  6, dy: 70, type: 'flower_bed' },
      { dx: 20, dy: 72, type: 'statue' },
      { dx: 44, dy: 72, type: 'statue' },
      { dx: 58, dy: 70, type: 'flower_bed' },
      // 最奥: 園地を囲む桜並木
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 12, dy: 88, type: 'sakura_tree' },
      { dx: 32, dy: 90, type: 'sakura_tree' },
      { dx: 52, dy: 88, type: 'sakura_tree' },
      { dx: 68, dy: 86, type: 'power_pole' },
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
      // 給水塔のポンプ室、マンション管理棟
      { dx: 10, dy: 38, size: 'shed' },
      { dx: 42, dy: 38, size: 'shed' },
      // 最奥に住民集会所
      { dx: 26, dy: 62, size: 'townhouse' },
    ],
    furniture: [
      // 前面: 給水塔の電気設備とマンション入口
      { dx: -1, dy:  1, type: 'hedge' },
      { dx:  2, dy:  3, type: 'electric_box' },
      { dx: 10, dy:  5, type: 'sign_board' },
      { dx: 20, dy:  3, type: 'electric_box' },
      { dx: 32, dy:  5, type: 'mailbox' },
      { dx: 42, dy:  4, type: 'bicycle_rack' },
      { dx: 54, dy:  3, type: 'bench' },
      { dx: 62, dy:  1, type: 'hedge' },
      // 第 2 列: フェンスとポスト
      { dx:  2, dy: 14, type: 'bollard' },
      { dx: 10, dy: 14, type: 'hydrant' },
      { dx: 32, dy: 14, type: 'post_box' },
      { dx: 42, dy: 15, type: 'sign_board' },
      { dx: 54, dy: 14, type: 'planter' },
      // 中前層: 設備と住民エリア
      { dx:  4, dy: 24, type: 'electric_box' },
      { dx: 20, dy: 26, type: 'bollard' },
      { dx: 32, dy: 24, type: 'flower_bed' },
      { dx: 42, dy: 26, type: 'street_lamp' },
      { dx: 56, dy: 24, type: 'bicycle_rack' },
      // 中後層: ポンプ室脇の配管と管理棟脇
      { dx:  4, dy: 50, type: 'electric_box' },
      { dx: 26, dy: 52, type: 'recycling_bin' },
      { dx: 56, dy: 50, type: 'garbage' },
      // 奥: 集会所前の小庭
      { dx: 10, dy: 68, type: 'flower_bed' },
      { dx: 42, dy: 68, type: 'flower_bed' },
      // 最奥: 裏路地と街路樹
      { dx: -2, dy: 86, type: 'power_pole' },
      { dx: 16, dy: 88, type: 'tree' },
      { dx: 38, dy: 88, type: 'tree' },
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
