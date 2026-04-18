/**
 * humans.ts — 人間 SoA 管理 (最大 500 体)
 * 道路追従移動: 横道路では主にX方向、縦路地ではY方向に移動
 */

import * as C from './constants';
import { rand, randInt } from './physics';
import { writeInst, INST_F } from './renderer';

const ST_INACTIVE = 0;
const ST_RUNNING  = 1;
const ST_CRUSHED  = 2;

// 移動モード
const MODE_HORIZ = 0; // 横道路エリアにロック（エリア内は自由移動）
const MODE_VERT  = 1; // 縦路地エリアにロック（エリア内は自由移動）
const MODE_FREE  = 2; // 自由逃走（道路エリア外を走り回る）

// 初期道路定義 (3本の横道路 — RIVERSIDE は川に変換したので除外)
const INITIAL_H_ROADS: ReadonlyArray<{ y: number; tol: number }> = [
  { y: C.HILLTOP_STREET_Y,   tol: C.HILLTOP_STREET_H   / 2 + 2 },
  { y: C.MAIN_STREET_Y,      tol: C.MAIN_STREET_H      / 2 + 2 },
  { y: C.LOWER_STREET_Y,     tol: C.LOWER_STREET_H     / 2 + 2 },
];

// 路地 X 中心と許容幅
const V_ALLEYS = [
  { x: C.ALLEY_1_X, tol: C.ALLEY_WIDTH / 2 + 2 },
  { x: C.ALLEY_2_X, tol: C.ALLEY_WIDTH / 2 + 2 },
];

// 人間のバリエーションパターン
//   shirt: 上半身の服の色 (常に必須)
//   pants: 下半身の色 (省略可。あれば body の下端をこの色で覆う)
//   hair:  頭部上面に乗る髪の色 (省略可)
//   hat:   髪のさらに上に乗る帽子の色 (省略可)
//   bag:   体の横に持つかばんの色 (省略可)
//   scale: 全体の大きさ倍率 (1.0 デフォルト、0.7 で子供、1.05 で長身の神主など)
//   accent: 胸元のアクセント色 (省略可、ネクタイ・たすき・ネームタグなど)
//   build:  体型 (adult_m/adult_f/child/elderly/infant) — 頭身比と肩幅が変わる
//   hasSkirt: true なら下半身をスカート/着物として描画
type HumanBuild = 'adult_m' | 'adult_f' | 'child' | 'elderly' | 'infant';

interface HumanKind {
  shirt: readonly [number, number, number];
  pants?: readonly [number, number, number];
  hair?: readonly [number, number, number];
  hat?: readonly [number, number, number];
  bag?: readonly [number, number, number];
  scale?: number;
  accent?: readonly [number, number, number];
  build?: HumanBuild;
  hasSkirt?: boolean;
}

const HUMAN_KINDS: ReadonlyArray<HumanKind> = [
  // ═══ 0-11: 従来の一般市民 ═════════════════════════════════
  // 0: 会社員 (男性、ダークスーツ + 赤ネクタイ)
  { shirt: [0.18, 0.22, 0.42], pants: [0.10, 0.12, 0.25],
    hair:  [0.08, 0.06, 0.04], bag:   [0.55, 0.35, 0.18],
    accent:[0.82, 0.20, 0.25], build: 'adult_m' },
  // 1: OL (女性、白ブラウス + 紺スカート)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.22, 0.45],
    hair:  [0.35, 0.20, 0.10], bag:   [0.85, 0.30, 0.50],
    build: 'adult_f', hasSkirt: true },
  // 2: 学生 (男性、白シャツ + 紺スラックス)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.28, 0.55],
    hair:  [0.08, 0.06, 0.04], bag:   [0.85, 0.20, 0.18],
    accent:[0.18, 0.28, 0.55], build: 'adult_m' },
  // 3: 子供 (赤シャツ + 黄帽子 + ランドセル、大頭)
  { shirt: [1.00, 0.30, 0.20], pants: [0.20, 0.30, 0.55],
    hair:  [0.30, 0.18, 0.08], hat:   [1.00, 0.85, 0.10],
    bag:   [0.62, 0.18, 0.12], scale: 0.70, build: 'child' },
  // 4: 子供 (黄シャツ、大頭)
  { shirt: [1.00, 0.85, 0.15], pants: [0.20, 0.30, 0.55],
    hair:  [0.10, 0.08, 0.04], scale: 0.68, build: 'child' },
  // 5: 私服男性 — 青シャツ + ジーンズ
  { shirt: [0.20, 0.50, 1.00], pants: [0.20, 0.30, 0.55],
    hair:  [0.20, 0.12, 0.08], build: 'adult_m' },
  // 6: 私服男性 — 緑シャツ + ベージュパンツ
  { shirt: [0.20, 0.85, 0.30], pants: [0.55, 0.45, 0.30],
    hair:  [0.10, 0.08, 0.04], build: 'adult_m' },
  // 7: 私服女性 — 紫シャツ + 黒スカート
  { shirt: [0.78, 0.20, 0.92], pants: [0.18, 0.18, 0.20],
    hair:  [0.10, 0.08, 0.04], build: 'adult_f', hasSkirt: true },
  // 8: ジョガー女性 (ピンクシャツ + 黒タイツ)
  { shirt: [1.00, 0.40, 0.70], pants: [0.15, 0.15, 0.18],
    hair:  [0.25, 0.15, 0.08], hat:   [0.95, 0.95, 0.95],
    build: 'adult_f' },
  // 9: 観光客男性 (アロハ + 麦わら帽子 + バックパック)
  { shirt: [0.95, 0.40, 0.30], pants: [0.65, 0.55, 0.35],
    hair:  [0.30, 0.18, 0.10], hat:   [0.95, 0.85, 0.40], bag: [0.30, 0.20, 0.10],
    build: 'adult_m' },
  // 10: お年寄り (小柄、少し前かがみ、白髪)
  { shirt: [0.58, 0.52, 0.45], pants: [0.40, 0.36, 0.32],
    hair:  [0.92, 0.90, 0.85], scale: 0.88, build: 'elderly' },
  // 11: シェフ (白い服 + コック帽)
  { shirt: [0.95, 0.95, 0.95], pants: [0.95, 0.95, 0.95],
    hair:  [0.08, 0.06, 0.04], hat:   [0.96, 0.96, 0.96],
    build: 'adult_m' },

  // ═══ 12-14: 医療 ══════════════════════════════════════════
  // 12: 看護師 (女性、ワンピース + 帽子 + 赤十字)
  { shirt: [0.96, 0.96, 0.98], pants: [0.96, 0.96, 0.98],
    hair:  [0.30, 0.20, 0.12], hat:   [0.98, 0.85, 0.88],
    accent:[0.90, 0.20, 0.22], build: 'adult_f', hasSkirt: true },
  // 13: 医者 (男性、白衣)
  { shirt: [0.96, 0.96, 0.98], pants: [0.20, 0.22, 0.28],
    hair:  [0.18, 0.10, 0.06], accent: [0.25, 0.40, 0.72],
    build: 'adult_m' },
  // 14: 患者 (水色の病衣、お年寄り寄り)
  { shirt: [0.72, 0.88, 0.92], pants: [0.72, 0.88, 0.92],
    hair:  [0.85, 0.80, 0.72], scale: 0.92, build: 'elderly',
    hasSkirt: true },

  // ═══ 15-16: 公共サービス ══════════════════════════════════
  // 15: 警察官 (男性)
  { shirt: [0.16, 0.20, 0.35], pants: [0.10, 0.12, 0.25],
    hair:  [0.08, 0.06, 0.04], hat:   [0.12, 0.14, 0.22],
    accent:[0.92, 0.78, 0.20], build: 'adult_m' },
  // 16: 消防士 (男性、オレンジ制服 + 赤ヘルメット)
  { shirt: [0.92, 0.52, 0.15], pants: [0.42, 0.42, 0.42],
    hair:  [0.12, 0.08, 0.04], hat:   [0.88, 0.18, 0.15],
    build: 'adult_m' },

  // ═══ 17-18: 商業・サービス ═════════════════════════════════
  // 17: 駅員 (男性、青制服)
  { shirt: [0.22, 0.38, 0.62], pants: [0.16, 0.22, 0.38],
    hair:  [0.10, 0.08, 0.04], hat:   [0.18, 0.28, 0.48],
    accent:[0.92, 0.25, 0.25], build: 'adult_m' },
  // 18: 商店店主 (男性、エプロン + バンダナ)
  { shirt: [0.95, 0.85, 0.72], pants: [0.35, 0.28, 0.18],
    hair:  [0.18, 0.10, 0.06], hat:   [0.85, 0.22, 0.18],
    accent:[0.55, 0.38, 0.22], build: 'adult_m' },

  // ═══ 19-20: 工業・作業員 ══════════════════════════════════
  // 19: 工員 (男性)
  { shirt: [0.28, 0.40, 0.55], pants: [0.22, 0.25, 0.32],
    hair:  [0.08, 0.06, 0.04], hat:   [0.98, 0.82, 0.15],
    accent:[1.00, 0.55, 0.15], build: 'adult_m' },
  // 20: 港湾労働者 (男性)
  { shirt: [0.50, 0.50, 0.52], pants: [0.50, 0.50, 0.52],
    hair:  [0.10, 0.08, 0.04], hat:   [0.92, 0.92, 0.88],
    build: 'adult_m' },

  // ═══ 21-23: 和風 ══════════════════════════════════════════
  // 21: 神主 (男性、白装束 + 烏帽子、長身)
  { shirt: [0.95, 0.92, 0.85], pants: [0.85, 0.20, 0.25],
    hair:  [0.08, 0.06, 0.04], hat:   [0.12, 0.10, 0.15],
    scale: 1.05, build: 'adult_m', hasSkirt: true },             // 袴もスカート扱い
  // 22: 巫女 (女性、白着物 + 緋袴)
  { shirt: [0.96, 0.94, 0.90], pants: [0.82, 0.18, 0.22],
    hair:  [0.08, 0.06, 0.04],
    accent:[0.82, 0.18, 0.22], build: 'adult_f', hasSkirt: true },
  // 23: 町民 (和装お年寄り)
  { shirt: [0.55, 0.38, 0.22], pants: [0.42, 0.30, 0.18],
    hair:  [0.92, 0.90, 0.85], scale: 0.92, build: 'elderly',
    hasSkirt: true },

  // ═══ 24-27: 夜街 ══════════════════════════════════════════
  // 24: ホステス (女性、赤いドレス)
  { shirt: [0.88, 0.15, 0.30], pants: [0.88, 0.15, 0.30],
    hair:  [0.92, 0.78, 0.32], bag: [0.92, 0.78, 0.32],
    build: 'adult_f', hasSkirt: true },
  // 25: バーテン (男性、黒ベスト)
  { shirt: [0.12, 0.12, 0.14], pants: [0.12, 0.12, 0.14],
    hair:  [0.12, 0.08, 0.04], accent: [0.88, 0.15, 0.20],
    build: 'adult_m' },
  // 26: ホスト (男性、金髪 + 白スーツ)
  { shirt: [0.95, 0.95, 0.95], pants: [0.95, 0.95, 0.95],
    hair:  [0.95, 0.80, 0.40], accent: [0.72, 0.25, 0.88],
    build: 'adult_m' },
  // 27: 酔客 (男性、小柄猫背)
  { shirt: [0.68, 0.42, 0.25], pants: [0.35, 0.32, 0.28],
    hair:  [0.20, 0.12, 0.08], bag: [0.22, 0.18, 0.12],
    scale: 0.95, build: 'adult_m' },

  // ═══ 28-31: 祭り ══════════════════════════════════════════
  // 28: 祭り法被 (男性)
  { shirt: [0.22, 0.32, 0.62], pants: [0.92, 0.92, 0.95],
    hair:  [0.08, 0.06, 0.04], hat:   [0.95, 0.95, 0.95],
    accent:[0.92, 0.18, 0.22], build: 'adult_m' },
  // 29: 浴衣娘 (女性、赤い浴衣)
  { shirt: [0.92, 0.30, 0.45], pants: [0.82, 0.22, 0.38],
    hair:  [0.08, 0.06, 0.04],
    accent:[0.95, 0.85, 0.15], build: 'adult_f', hasSkirt: true },
  // 30: 浴衣 (青柄、男性)
  { shirt: [0.28, 0.48, 0.78], pants: [0.22, 0.38, 0.62],
    hair:  [0.22, 0.15, 0.08],
    accent:[0.92, 0.92, 0.95], build: 'adult_m', hasSkirt: true },
  // 31: ピエロ (男性、カラフル)
  { shirt: [0.95, 0.35, 0.60], pants: [0.30, 0.72, 0.45],
    hair:  [0.92, 0.42, 0.18], hat:   [0.98, 0.88, 0.15],
    accent:[0.95, 0.15, 0.18], build: 'adult_m' },

  // ═══ 32-34: 住宅街 ═════════════════════════════════════════
  // 32: 主婦 (女性、エプロン + スカート)
  { shirt: [0.88, 0.72, 0.62], pants: [0.55, 0.42, 0.30],
    hair:  [0.35, 0.22, 0.12], bag: [0.68, 0.52, 0.38],
    accent:[0.95, 0.88, 0.82], build: 'adult_f', hasSkirt: true },
  // 33: 女子高生 (女性、セーラー + 紺スカート)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.22, 0.42],
    hair:  [0.18, 0.12, 0.08], bag: [0.35, 0.22, 0.15],
    accent:[0.20, 0.28, 0.55], build: 'adult_f', hasSkirt: true },
  // 34: 幼児 (頭が超大きい、丸い服)
  { shirt: [0.98, 0.78, 0.88], pants: [0.42, 0.68, 0.92],
    hair:  [0.45, 0.30, 0.18], scale: 0.55, build: 'infant' },
];

/** 重み付き種類選択。比較的「ごく普通の人」を多めに、特殊型を少なめに。 */
const HUMAN_KIND_WEIGHTS: ReadonlyArray<number> = [
  6, 4, 4, 3, 3, 5, 4, 3, 2, 2, 3, 1,           // 0-11 (従来の12種)
  0, 0, 0,                                       // 12-14 医療 (通常は出ない)
  0, 0,                                          // 15-16 警察・消防
  0, 0,                                          // 17-18 駅員・店主
  0, 0,                                          // 19-20 工員・港湾
  0, 0, 0,                                       // 21-23 神主・巫女・和装町民
  0, 0, 0, 0,                                    // 24-27 夜街
  0, 0, 0, 0,                                    // 28-31 祭り
  2, 2, 1,                                       // 32-34 主婦・女子高生・幼児
];
const HUMAN_KIND_TOTAL = HUMAN_KIND_WEIGHTS.reduce((a, b) => a + b, 0);

function pickHumanKind(weights: ReadonlyArray<number> = HUMAN_KIND_WEIGHTS): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// ═══ 建物別の人間ウェイト (テーマ別プール) ═══════════════════════════
// 配列の index は HUMAN_KINDS の index に一致。値が大きいほど出現率 UP。
// 0 のエントリは省略可能 (fill 関数を使わず稀疎配列で OK)
function makeWeights(...pairs: Array<[number, number]>): number[] {
  const arr = new Array(HUMAN_KINDS.length).fill(0);
  for (const [idx, w] of pairs) arr[idx] = w;
  return arr;
}

// 子供多め (学校・保育園)
const W_KIDS = makeWeights([3, 10], [4, 10], [34, 3], [2, 3]);
// 医療 (病院・診療所)
const W_MEDICAL = makeWeights([12, 8], [13, 5], [14, 6], [10, 2]);
// 警察
const W_POLICE = makeWeights([15, 10], [0, 1]);
// 消防
const W_FIRE = makeWeights([16, 10], [0, 1]);
// 駅・バスターミナル
const W_STATION = makeWeights([17, 6], [0, 4], [1, 4], [2, 3], [9, 2], [33, 2]);
// 商店
const W_SHOP = makeWeights([18, 5], [11, 3], [32, 3], [0, 2], [5, 2]);
// 工業・港湾
const W_INDUSTRIAL = makeWeights([19, 8], [20, 4], [0, 1]);
// 和風 (神社・寺)
const W_SHRINE = makeWeights([21, 5], [22, 5], [23, 4], [10, 3], [9, 2]);
// 夜街
const W_NIGHTLIFE = makeWeights([24, 4], [25, 3], [26, 3], [27, 4], [0, 3], [1, 3]);
// 祭り・テーマパーク
const W_FESTIVAL = makeWeights(
  [28, 4], [29, 4], [30, 4], [31, 2], [3, 4], [4, 3], [32, 2], [0, 1]
);
// 住宅
const W_RESIDENTIAL = makeWeights(
  [32, 4], [33, 3], [3, 3], [4, 3], [10, 3], [34, 2], [0, 2], [1, 2]
);

/** 建物サイズ → 出現する人間のウェイト配列。未定義ならデフォルト (一般通行人) */
const BUILDING_WEIGHTS: { [key: string]: readonly number[] } = {
  // 医療
  hospital: W_MEDICAL, clinic: W_MEDICAL,
  // 教育 (★ 学校・保育園 → 子供)
  school: W_KIDS, daycare: W_KIDS,
  // 公共サービス
  police_station: W_POLICE,
  fire_station: W_FIRE,
  train_station: W_STATION, bus_terminal_shelter: W_STATION,
  // 神社・寺
  shrine: W_SHRINE, temple: W_SHRINE, pagoda: W_SHRINE, tahoto: W_SHRINE,
  // 和風商店
  chaya: W_SHOP, wagashi: W_SHOP, kimono_shop: W_SHOP, sushi_ya: W_SHOP,
  // 一般商店・飲食
  shop: W_SHOP, restaurant: W_SHOP, convenience: W_SHOP, cafe: W_SHOP,
  bakery: W_SHOP, ramen: W_SHOP, izakaya: W_SHOP, florist: W_SHOP,
  pharmacy: W_SHOP, bookstore: W_SHOP, laundromat: W_SHOP, supermarket: W_SHOP,
  // 夜街
  karaoke: W_NIGHTLIFE, pachinko: W_NIGHTLIFE, snack: W_NIGHTLIFE,
  love_hotel: W_NIGHTLIFE, mahjong_parlor: W_NIGHTLIFE, club: W_NIGHTLIFE,
  capsule_hotel: W_NIGHTLIFE, game_center: W_NIGHTLIFE,
  // 工業
  warehouse: W_INDUSTRIAL, crane_gantry: W_INDUSTRIAL,
  container_stack: W_INDUSTRIAL, factory_stack: W_INDUSTRIAL,
  silo: W_INDUSTRIAL, gas_station: W_INDUSTRIAL, garage: W_INDUSTRIAL,
  // 祭り・テーマパーク
  yatai: W_FESTIVAL, carousel: W_FESTIVAL, roller_coaster: W_FESTIVAL,
  big_tent: W_FESTIVAL, ferris_wheel: W_FESTIVAL, castle: W_FESTIVAL,
  // 住宅
  house: W_RESIDENTIAL, townhouse: W_RESIDENTIAL, mansion: W_RESIDENTIAL,
  apartment: W_RESIDENTIAL, apartment_tall: W_RESIDENTIAL,
  duplex: W_RESIDENTIAL, bungalow: W_RESIDENTIAL,
  kominka: W_RESIDENTIAL, kura: W_RESIDENTIAL, machiya: W_RESIDENTIAL,
  shed: W_RESIDENTIAL, greenhouse: W_RESIDENTIAL, ryokan: W_RESIDENTIAL,
  onsen_inn: W_NIGHTLIFE,
};

/** 建物サイズから対応する人間ウェイトを返す。未定義なら undefined (デフォルトを使う) */
export function getHumanWeightsForBuilding(size: string): readonly number[] | undefined {
  return BUILDING_WEIGHTS[size];
}

// ═══ バリエーション・パレット: 個体差を出すための色・体型・髪型セット ═══════
// 各人間は 16bit の variant seed を持ち、その bit を分割して各パーツの
// バリエーションを決定する。シルエットレベルで違って見えるよう、
// 体型 (太さ/高さ) と髪型 (短髪/ボブ/ポニテ/坊主) も個別化。

// ═══ シャツ/ズボン tint: 16 エントリ (0.55〜1.55 大胆レンジ) ═══
// 白ベース (シェフ・医者) には強く染まり、濃色にも色味変化が十分に出る
const TINT_TABLE: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 1.00, 1.00],  // 0: 標準
  [0.55, 0.55, 0.55],  // 1: 超暗
  [1.50, 1.50, 1.50],  // 2: 超明
  [0.80, 0.80, 0.82],  // 3: やや暗
  [1.25, 1.25, 1.25],  // 4: やや明
  [1.50, 0.75, 0.60],  // 5: 赤強
  [1.20, 0.90, 0.85],  // 6: 赤弱
  [0.55, 0.80, 1.55],  // 7: 青強
  [0.85, 0.95, 1.30],  // 8: 青弱
  [0.60, 1.55, 0.60],  // 9: 緑強
  [0.90, 1.30, 0.90],  // 10: 緑弱
  [1.55, 1.35, 0.50],  // 11: 金/マスタード
  [1.30, 0.60, 1.40],  // 12: マゼンタ
  [0.70, 1.25, 1.40],  // 13: シアン
  [1.45, 1.15, 0.85],  // 14: ピーチ
  [0.80, 0.70, 1.35],  // 15: ラベンダー
];

// ═══ 髪色パレット: 16 段階 (漆黒 → 奇抜な色まで) ═══
const HAIR_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.05, 0.04, 0.03],  // 0: 漆黒
  [0.10, 0.08, 0.05],  // 1: ほぼ黒
  [0.18, 0.12, 0.06],  // 2: 濃茶
  [0.28, 0.18, 0.08],  // 3: 濃茶2
  [0.38, 0.22, 0.10],  // 4: 茶
  [0.52, 0.32, 0.14],  // 5: 中茶
  [0.68, 0.46, 0.22],  // 6: 明茶
  [0.88, 0.72, 0.32],  // 7: 金髪
  [0.92, 0.85, 0.55],  // 8: プラチナ
  [0.85, 0.82, 0.78],  // 9: アッシュ/銀
  [0.92, 0.92, 0.90],  // 10: 白髪
  [0.78, 0.25, 0.18],  // 11: 赤毛
  [0.62, 0.15, 0.38],  // 12: ワインレッド
  [0.92, 0.55, 0.75],  // 13: ピンク (奇抜)
  [0.45, 0.72, 0.92],  // 14: 水色 (奇抜)
  [0.60, 0.35, 0.82],  // 15: 紫 (奇抜)
];

// ═══ 肌色パレット: 8 段階 ═══
const SKIN_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.99, 0.92, 0.85],  // 0: 白い
  [0.98, 0.88, 0.78],  // 1: 明
  [0.95, 0.82, 0.68],  // 2: やや明
  [0.92, 0.75, 0.58],  // 3: 標準
  [0.88, 0.68, 0.48],  // 4: 小麦
  [0.78, 0.58, 0.40],  // 5: 日焼け
  [0.62, 0.45, 0.32],  // 6: 褐色
  [0.42, 0.30, 0.22],  // 7: 濃
];

// ═══ 靴色パレット: 12 色 ═══
const SHOE_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.08, 0.06, 0.05],  // 0: 黒革靴
  [0.15, 0.10, 0.06],  // 1: 焦茶
  [0.22, 0.14, 0.08],  // 2: 濃茶
  [0.38, 0.26, 0.14],  // 3: ミディアムブラウン
  [0.55, 0.40, 0.25],  // 4: タン
  [0.92, 0.92, 0.88],  // 5: 白スニーカー
  [0.82, 0.22, 0.20],  // 6: 赤スニーカー
  [0.20, 0.45, 0.82],  // 7: 青スニーカー
  [0.25, 0.78, 0.42],  // 8: 緑スニーカー
  [0.92, 0.78, 0.20],  // 9: 黄色スニーカー
  [0.85, 0.40, 0.72],  // 10: ピンクスニーカー
  [0.45, 0.35, 0.55],  // 11: 紫
];

// ═══ 帽子 tint: 4 段階 (kind 固有の帽子色に乗算) ═══
const HAT_TINT: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 1.00, 1.00], [0.85, 0.90, 1.00],
  [1.05, 0.95, 0.85], [0.75, 0.75, 0.75],
];

// ═══ カバン独立色: 8 色 (kind.bag を完全置換する確率あり) ═══
const BAG_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [0.55, 0.35, 0.18],  // 0: 茶革
  [0.15, 0.12, 0.10],  // 1: 黒
  [0.82, 0.22, 0.25],  // 2: 赤
  [0.25, 0.40, 0.75],  // 3: 青
  [0.72, 0.68, 0.62],  // 4: ベージュ
  [0.88, 0.65, 0.82],  // 5: ピンク
  [0.42, 0.65, 0.32],  // 6: 緑
  [0.78, 0.72, 0.22],  // 7: マスタード
];

// ═══ アクセント tint: 4 段階 ═══
const ACCENT_TINT: ReadonlyArray<readonly [number, number, number]> = [
  [1.00, 1.00, 1.00], [0.75, 0.85, 1.05],
  [1.10, 0.90, 0.80], [1.15, 1.15, 0.85],
];

// ═══ 体型倍率 (拡張) ═══
const WIDTH_FACTORS  = [0.72, 0.82, 0.90, 0.96, 1.04, 1.12, 1.22, 1.34] as const;
const HEIGHT_FACTORS = [0.75, 0.85, 0.92, 0.98, 1.04, 1.10, 1.18, 1.28] as const;

// 髪型ID: 0=short (既存), 1=bob (肩までの丸い), 2=ponytail (後ろに長い),
//         3=long (長髪、肩〜背中), 4=buzz (坊主、ほぼ皮膚), 5=spiky (とげとげ)
const HAIR_SHAPE_SHORT    = 0;
const HAIR_SHAPE_BOB      = 1;
const HAIR_SHAPE_PONYTAIL = 2;
const HAIR_SHAPE_LONG     = 3;
const HAIR_SHAPE_BUZZ     = 4;
const HAIR_SHAPE_SPIKY    = 5;

/** variant (32bit) から各パーツのインデックスをデコード。
 * パーツ毎に独立した bit 領域を使い、全パーツを自由に組み合わせられる。
 * 32 bit なので 2^32 = 42 億通り、kind と合わせて事実上無限の個体差。
 * ★ 必ず >>> (unsigned shift) を使い、負のインデックスを絶対に返さない。
 */
function decodeVariant(v: number): {
  shirtTint: number; pantsTint: number; hairColor: number; hairShape: number;
  skinIdx: number;   shoeIdx: number;   widthIdx: number; heightIdx: number;
  accessory: number; hatTint: number;   bagIdx: number;   accentTint: number;
  useBagPalette: boolean; useWildHair: boolean;
} {
  // 全て >>> と & で非負を保証。% は非負引数なので安全。
  return {
    shirtTint: v & 0xF,                                          // bits 0-3: 16
    pantsTint: (v >>> 4) & 0xF,                                  // bits 4-7: 16
    skinIdx:   (v >>> 8) & 0x7,                                  // bits 8-10: 8
    hairColor: (v >>> 11) & 0xF,                                 // bits 11-14: 16
    hairShape: (v >>> 15) & 0x7,                                 // bits 15-17: 8 (mod 6 in render)
    accessory: (v >>> 18) & 0x3,                                 // bits 18-19: 4
    shoeIdx:   ((v >>> 20) & 0xF) % SHOE_PALETTE.length,         // bits 20-23 (mod 12)
    widthIdx:  ((v >>> 24) & 0x7) % WIDTH_FACTORS.length,        // bits 24-26 (mod 8)
    heightIdx: ((v >>> 27) & 0x7) % HEIGHT_FACTORS.length,       // bits 27-29 (mod 8)
    // 残り bits 30-31 は useBagPalette/useWildHair に。
    // hatTint/bagIdx/accentTint は XOR 混合で追加エントロピー
    hatTint:   ((v ^ (v >>> 5))  >>> 0) & 0x3,
    bagIdx:    ((v ^ (v >>> 9))  >>> 0) & 0x7,
    accentTint:((v ^ (v >>> 13)) >>> 0) & 0x3,
    useBagPalette: ((v >>> 30) & 1) === 1,
    useWildHair:   ((v >>> 31) & 1) === 1,
  };
}

export class HumanManager {
  px:       Float32Array = new Float32Array(C.MAX_HUMANS);
  py:       Float32Array = new Float32Array(C.MAX_HUMANS);
  vx:       Float32Array = new Float32Array(C.MAX_HUMANS);
  vy:       Float32Array = new Float32Array(C.MAX_HUMANS);
  state:    Uint8Array   = new Uint8Array(C.MAX_HUMANS);
  timer:    Float32Array = new Float32Array(C.MAX_HUMANS);
  speed:    Float32Array = new Float32Array(C.MAX_HUMANS);
  scaleX:   Float32Array = new Float32Array(C.MAX_HUMANS);
  mode:       Uint8Array   = new Uint8Array(C.MAX_HUMANS); // MODE_*
  kind:       Uint8Array   = new Uint8Array(C.MAX_HUMANS); // HUMAN_KINDS index
  variant:    Uint32Array  = new Uint32Array(C.MAX_HUMANS); // 32bit seed: 色・体型・髪型の個体差 (42億通り)
  blastTimer: Float32Array = new Float32Array(C.MAX_HUMANS); // 吹き飛ばしフェーズ残り時間

  activeCount = 0;
  activeIndices: Uint16Array = new Uint16Array(C.MAX_HUMANS);
  activeLen = 0;

  // 動的道路リスト (チャンクシステムで更新)
  private hRoads: Array<{ y: number; tol: number }> = [...INITIAL_H_ROADS];

  addRoad(y: number, tol: number) {
    this.hRoads.push({ y, tol });
  }

  removeRoadsBelow(minY: number) {
    this.hRoads = this.hRoads.filter(r => r.y >= minY);
  }

  resetRoads() {
    this.hRoads = [...INITIAL_H_ROADS];
  }

  reset() {
    this.state.fill(ST_INACTIVE);
    this.activeLen = 0;
    this.activeCount = 0;
  }

  /** ゲーム開始時: 初期横道路3本に通行人を均等に配置 */
  spawnOnStreets(countPerStreet: number): void {
    for (const road of INITIAL_H_ROADS) {
      for (let i = 0; i < countPerStreet; i++) {
        const cx = rand(C.WORLD_MIN_X + 20, C.WORLD_MAX_X - 20);
        this.spawn(cx, road.y, 1);
      }
    }
  }

  /**
   * シーン内の指定座標に 1 体配置 (道路スナップなし)。
   * pre-placed scene humans 用 — その場で待機 → ボール接近で逃走開始。
   */
  spawnAt(cx: number, cy: number) {
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_INACTIVE) continue;
      this.state[i] = ST_RUNNING;
      this.activeIndices[this.activeLen++] = i;
      this.px[i]    = cx;
      this.py[i]    = cy;
      const spd     = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.speed[i] = spd;
      // FREE モードで開始: 道路エリアに触れたらロックされる
      this.mode[i]  = MODE_FREE;
      // 初期はゆっくり徘徊
      const angle = Math.random() * Math.PI * 2;
      this.vx[i]    = Math.cos(angle) * spd * 0.3;
      this.vy[i]    = Math.sin(angle) * spd * 0.3;
      this.timer[i]    = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]   = 1;
      this.kind[i]     = pickHumanKind();
      this.variant[i]  = (Math.random() * 0x100000000) >>> 0;
      this.activeCount = this.activeLen;
      return;
    }
  }

  /** 指定座標付近に n 体スポーン */
  spawn(cx: number, cy: number, n: number) {
    let spawned = 0;
    for (let i = 0; i < C.MAX_HUMANS && spawned < n; i++) {
      if (this.state[i] !== ST_INACTIVE) continue;
      this.state[i] = ST_RUNNING;
      this.activeIndices[this.activeLen++] = i;

      let spawnX = cx + rand(-15, 15);
      let spawnY = cy + rand(-5, 5);
      let bestDist = Infinity;
      let bestY = spawnY;
      for (const r of this.hRoads) {
        const d = Math.abs(spawnY - r.y);
        if (d < bestDist) { bestDist = d; bestY = r.y; }
      }
      spawnY = bestY + rand(-2, 2);

      this.px[i]    = spawnX;
      this.py[i]    = spawnY;
      const spd     = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.speed[i] = spd;
      this.mode[i]  = MODE_HORIZ;
      this.vx[i]    = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vy[i]    = rand(-5, 5);
      this.timer[i]    = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]   = 1;
      this.kind[i]     = pickHumanKind();
      this.variant[i]  = (Math.random() * 0x100000000) >>> 0;
      spawned++;
    }
    this.activeCount = this.activeLen;
  }

  /** 建物破壊時: 中心から円状に吹き飛ばしてから逃走
   *  人数が多いほど散布円が大きくなる (radius ∝ √n)
   *  kindWeights を渡すと、その建物固有の人間種類分布 (例: 学校なら子供多め) が使われる */
  spawnBlast(cx: number, cy: number, n: number, kindWeights?: ReadonlyArray<number>) {
    const blastR = Math.sqrt(n) * 6;
    let spawned = 0;
    for (let i = 0; i < C.MAX_HUMANS && spawned < n; i++) {
      if (this.state[i] !== ST_INACTIVE) continue;
      this.state[i]      = ST_RUNNING;
      this.activeIndices[this.activeLen++] = i;
      const initAngle    = Math.random() * Math.PI * 2;
      const initR        = Math.random() * blastR;
      this.px[i]         = cx + Math.cos(initAngle) * initR;
      this.py[i]         = cy + Math.sin(initAngle) * initR;
      const angle        = Math.random() * Math.PI * 2;
      const spd          = rand(180, 380);
      this.vx[i]         = Math.cos(angle) * spd;
      this.vy[i]         = Math.sin(angle) * spd;
      this.speed[i]      = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.mode[i]       = MODE_HORIZ;
      this.blastTimer[i] = rand(0.30, 0.55);
      this.timer[i]      = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]     = 1;
      this.kind[i]       = pickHumanKind(kindWeights);
      this.variant[i]    = (Math.random() * 0x100000000) >>> 0;
      spawned++;
    }
    this.activeCount = this.activeLen;
  }

  update(dt: number, ballX: number, ballY: number, cameraY: number) {
    // カメラ相対の行動範囲 (無限スクロール対応)
    const camBottom = cameraY + C.WORLD_MIN_Y;
    const camTop    = cameraY + C.WORLD_MAX_Y;

    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];

      // カメラ下端を大きく下回った人間は非活性化
      if (this.py[i] < camBottom - 60) {
        this.state[i] = ST_INACTIVE;
        this.activeIndices[k] = this.activeIndices[--this.activeLen];
        k--;
        continue;
      }

      // 吹き飛ばしフェーズ: 放射状に飛散して減速
      if (this.blastTimer[i] > 0) {
        this.blastTimer[i] -= dt;
        const damp = Math.max(0, 1 - 4.5 * dt);
        this.vx[i] *= damp;
        this.vy[i] *= damp;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        // X のみ世界端でクランプ（Y はビル位置に依存するため固定しない）
        this.px[i] = Math.max(C.WORLD_MIN_X + 4, Math.min(C.WORLD_MAX_X - 4, this.px[i]));
        if (this.blastTimer[i] <= 0) {
          // blast終了後: 自由移動開始。道路エリアに入ったら出られなくなる
          this.mode[i] = MODE_FREE;
          this._pickNewDirection(i);
          this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
        }
        continue;
      }

      // ボール接近 → 速度ブーストのみ（モード変更なし）
      const dbx = this.px[i] - ballX;
      const dby = this.py[i] - ballY;
      const dist2 = dbx * dbx + dby * dby;
      const fearR = C.HUMAN_FEAR_RADIUS * C.HUMAN_FEAR_RADIUS;
      const boost = dist2 < fearR ? C.HUMAN_FEAR_BOOST : 1.0;

      // 方向転換タイマー
      this.timer[i] -= dt;
      if (this.timer[i] <= 0) {
        this._pickNewDirection(i);
        this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      }

      // 位置更新
      this.px[i] += this.vx[i] * boost * dt;
      this.py[i] += this.vy[i] * boost * dt;

      const cm = this.mode[i];
      const px = this.px[i];
      const py = this.py[i];

      if (cm === MODE_FREE) {
        // 自由逃走: 道路/路地エリアに触れたら即ロック（以降出られない）
        for (const r of this.hRoads) {
          if (Math.abs(this.py[i] - r.y) <= r.tol) {
            this.mode[i] = MODE_HORIZ;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }
        if (this.mode[i] === MODE_FREE) {
          for (const a of V_ALLEYS) {
            if (Math.abs(this.px[i] - a.x) <= a.tol) {
              this.mode[i] = MODE_VERT;
              this._pickNewDirection(i);
              this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
              break;
            }
          }
        }
      } else if (cm === MODE_HORIZ) {
        // 道路エリア: Y方向の境界で速度反発（エリア外に出られない）
        const road = this._findRoad(py);
        if (road) {
          if (this.py[i] < road.y - road.tol) { this.py[i] = road.y - road.tol; this.vy[i] =  Math.abs(this.vy[i]); }
          if (this.py[i] > road.y + road.tol) { this.py[i] = road.y + road.tol; this.vy[i] = -Math.abs(this.vy[i]); }
        }
        // 路地交差点で確率的に VERT へ乗り換え
        for (const a of V_ALLEYS) {
          if (Math.abs(this.px[i] - a.x) <= a.tol && Math.random() < 0.008) {
            this.mode[i] = MODE_VERT;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }

      } else if (cm === MODE_VERT) {
        // 路地エリア: X方向の境界で速度反発
        const alley = this._findAlley(px);
        if (alley) {
          if (this.px[i] < alley.x - alley.tol) { this.px[i] = alley.x - alley.tol; this.vx[i] =  Math.abs(this.vx[i]); }
          if (this.px[i] > alley.x + alley.tol) { this.px[i] = alley.x + alley.tol; this.vx[i] = -Math.abs(this.vx[i]); }
        }
        // 道路交差点で確率的に HORIZ へ乗り換え
        for (const r of this.hRoads) {
          if (Math.abs(this.py[i] - r.y) <= r.tol && Math.random() < 0.008) {
            this.mode[i] = MODE_HORIZ;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }
      }

      // X方向: 画面端で逃走完了 → INACTIVE
      if (this.px[i] < C.WORLD_MIN_X + 5 || this.px[i] > C.WORLD_MAX_X - 5) {
        this.state[i] = ST_INACTIVE;
        this.activeIndices[k] = this.activeIndices[--this.activeLen];
        k--;
        continue;
      }

      // 潰れアニメ回復
      if (this.scaleX[i] < 1) {
        this.scaleX[i] = Math.min(1, this.scaleX[i] + dt * 12);
      }
    }
    this.activeCount = this.activeLen;
  }

  private _findRoad(py: number): { y: number; tol: number } | null {
    for (const r of this.hRoads) {
      if (Math.abs(py - r.y) <= r.tol + 4) return r;
    }
    return null;
  }

  private _findAlley(px: number): { x: number; tol: number } | null {
    for (const a of V_ALLEYS) {
      if (Math.abs(px - a.x) <= a.tol + 4) return a;
    }
    return null;
  }

  /** blast終了後: 横道路・縦路地のうち最も近いものにスナップ */
  private _snapToNearestRoadOrAlley(i: number) {
    const px = this.px[i], py = this.py[i];
    let bestDist = Infinity;
    let bestType: 'horiz' | 'vert' = 'horiz';
    let bestY = this.hRoads[0].y;
    let bestX = V_ALLEYS[0].x;
    for (const r of this.hRoads) {
      const d = Math.abs(py - r.y);
      if (d < bestDist) { bestDist = d; bestType = 'horiz'; bestY = r.y; }
    }
    for (const a of V_ALLEYS) {
      const d = Math.abs(px - a.x);
      if (d < bestDist) { bestDist = d; bestType = 'vert'; bestX = a.x; }
    }
    const angle = Math.random() * Math.PI * 2;
    if (bestType === 'horiz') {
      this.py[i] = bestY; this.mode[i] = MODE_HORIZ;
    } else {
      this.px[i] = bestX; this.mode[i] = MODE_VERT;
    }
    this.vx[i] = Math.cos(angle) * this.speed[i];
    this.vy[i] = Math.sin(angle) * this.speed[i];
  }

  private _pickNewDirection(i: number) {
    const spd = this.speed[i];
    const angle = Math.random() * Math.PI * 2;
    this.vx[i] = Math.cos(angle) * spd;
    this.vy[i] = Math.sin(angle) * spd;
  }

  checkCrush(ballX: number, ballY: number, ballR: number): number[] {
    const crushed: number[] = [];
    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];
      // 建物破壊で吹き飛ばし中の人間は無敵 (円状に散らばるまでの演出保護)
      if (this.blastTimer[i] > 0) continue;
      const hx = this.px[i] - C.HUMAN_W / 2;
      const hy = this.py[i] - C.HUMAN_H / 2;
      const nearX = Math.max(hx, Math.min(ballX, hx + C.HUMAN_W));
      const nearY = Math.max(hy, Math.min(ballY, hy + C.HUMAN_H));
      const dx = ballX - nearX, dy = ballY - nearY;
      if (dx * dx + dy * dy < ballR * ballR) {
        this.state[i]  = ST_INACTIVE;
        this.scaleX[i] = 0.15;
        crushed.push(i);
        this.activeIndices[k] = this.activeIndices[--this.activeLen];
        k--;
      }
    }
    return crushed;
  }

  getPos(i: number): [number, number] {
    return [this.px[i], this.py[i]];
  }

  /**
   * 細密ドット絵スタイルのミニスプライト描画。
   *
   * レイアウト (scale=1, sx=3, sy=6 基準):
   *   y ≈ +4.1        帽子 (1.1×0.7)
   *   y ≈ +3.6        帽子つば / 髪の頂上 (1.0×0.3)
   *   y ≈ +2.7        頭 (円) — サイズ 0.92sx
   *   y ≈ +2.7 左右   目 (暗色、0.13sx × 0.05sy の 2 点)
   *   y ≈ +2.4        前髪フリンジ (0.88sx × 0.10sy、額を覆う)
   *   y ≈ +2.0        首 (肌色、0.32sx × 0.12sy)
   *   y ≈ +1.3        腕/袖 (シャツ色、左右に ±0.48sx オフセット)
   *   y ≈ +1.3        胴体/シャツ (0.85sx × 0.32sy)
   *   y ≈ +0.8        アクセント (ネクタイ等、細い帯)
   *   y ≈ +0.1        ベルト (暗い帯、0.90sx × 0.08sy)
   *   y ≈ -1.5        両脚 (ズボン色、左右 ±0.23sx、各 0.32sx × 0.35sy、脚の間に隙間)
   *   y ≈ -2.8        両足 (暗い靴、左右 ±0.30sx、各 0.38sx × 0.10sy)
   *   y ≈ -2.95       足下の影 (暗楕円、1.0sx × 0.10sy、半透明)
   *   体側: カバン (0.42sx × 0.42sy、オプション)
   *
   * → 人間 1 体あたり 14-18 インスタンス (従来 6-7 の 2.5 倍)
   */
  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 50;
    const camTop = cameraY + C.WORLD_MAX_Y + 50;
    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];
      const py = this.py[i];
      if (py < camBot || py > camTop) continue;
      const kind = HUMAN_KINDS[this.kind[i]];
      const ks = kind.scale ?? 1.0;
      const build = kind.build ?? 'adult_m';

      // バリエーション・デコード
      const v = decodeVariant(this.variant[i]);
      const bodyW = WIDTH_FACTORS[v.widthIdx];
      const bodyH = HEIGHT_FACTORS[v.heightIdx];
      const sx = C.HUMAN_W * this.scaleX[i] * ks * bodyW;
      const sy = C.HUMAN_H * (2 - this.scaleX[i]) * ks * bodyH;
      const px = this.px[i];

      // === 頭身比 (build による) — 頭サイズ・肩幅・腰位置 ===
      // 大人標準: 頭=sx*1.00、肩幅=sx*0.82、胴体=sy*0.30
      // 子供:     頭=sx*1.35、肩幅=sx*0.72、胴体=sy*0.24 (3-4 頭身)
      // 幼児:     頭=sx*1.55、肩幅=sx*0.62、胴体=sy*0.20 (2 頭身)
      // お年寄り: 頭=sx*0.95、肩幅=sx*0.76、前傾 (少しY offset)
      // 女性:     肩幅 sx*0.70 (細身)、腰広い (スカートあり時)
      let headSize = sx * 1.00;
      let shoulderW = sx * 0.85;
      let torsoH    = sy * 0.30;
      let headOffsetY = 0;          // お年寄り前傾で下がる
      let bodyLeanX   = 0;          // 酔客・お年寄り傾き
      if (build === 'child') {
        headSize = sx * 1.35; shoulderW = sx * 0.72; torsoH = sy * 0.24;
      } else if (build === 'infant') {
        headSize = sx * 1.55; shoulderW = sx * 0.60; torsoH = sy * 0.18;
      } else if (build === 'elderly') {
        headSize = sx * 0.95; shoulderW = sx * 0.78; torsoH = sy * 0.28;
        headOffsetY = -sy * 0.03;  // 前かがみ
        bodyLeanX   = -sx * 0.03;
      } else if (build === 'adult_f') {
        shoulderW = sx * 0.70;     // 細身の肩
      }

      // === 歩行フェーズ (走り姿勢) ===
      // px と variant で位相がばらけ、動いていれば位置変化でアニメ、停止時は静的
      const phase = (this.px[i] * 0.40) + (this.variant[i] * 0.013);
      const swing = Math.sin(phase);
      const legRot = swing * 0.28;        // 脚の振り (~±16°)
      const armRot = -swing * 0.45;       // 腕は脚と逆 (~±26°)
      const strideOffset = swing * sx * 0.04;

      // === 色の決定 ===
      const shirtT = TINT_TABLE[v.shirtTint];
      const pantsT = TINT_TABLE[v.pantsTint];
      const [skinR, skinG, skinB] = SKIN_PALETTE[v.skinIdx];
      // 髪色: 約半分は kind.hair を活かし濃淡だけ変える、残り半分は完全にパレット置換 → 奇抜色含む
      const useKindHair = !!kind.hair && !v.useWildHair;
      const hairBase = useKindHair ? kind.hair! : HAIR_PALETTE[v.hairColor];
      const hairShadeK = useKindHair ? (0.60 + (v.hairColor / 15) * 0.80) : 1.0;
      const hairR = Math.min(1, hairBase[0] * hairShadeK);
      const hairG = Math.min(1, hairBase[1] * hairShadeK);
      const hairB = Math.min(1, hairBase[2] * hairShadeK);
      const [shoeR, shoeG, shoeB] = SHOE_PALETTE[v.shoeIdx];
      const [sr0, sg0, sb0] = kind.shirt;
      const sr = Math.min(1, sr0 * shirtT[0]);
      const sg = Math.min(1, sg0 * shirtT[1]);
      const sb = Math.min(1, sb0 * shirtT[2]);
      const [pr0, pg0, pb0] = kind.pants ?? kind.shirt;
      const pr = Math.min(1, pr0 * pantsT[0]);
      const pg = Math.min(1, pg0 * pantsT[1]);
      const pb = Math.min(1, pb0 * pantsT[2]);

      // === 各 Y 基準点 ===
      const footY    = py - sy * 0.45;
      const kneeY    = py - sy * 0.27;
      const hipY     = py - sy * 0.05;
      const waistY   = py + sy * 0.02;
      const chestY   = py + sy * 0.15;
      const shoulderY = py + sy * 0.28;
      const neckY    = py + sy * 0.35;
      const headY    = py + sy * 0.50 + headOffsetY;
      const hx = px + bodyLeanX;           // 上半身の傾き

      // === ① 足下の影 ===
      writeInst(buf, n++, px, py - sy * 0.49, sx * 1.15, sy * 0.07,
        0.05, 0.05, 0.08, 0.35, 0, 1);

      // === ② 靴/足 (小さな円) — 歩行 stride でずらす ===
      writeInst(buf, n++, px - sx * 0.22 - strideOffset, footY, sx * 0.32, sy * 0.10,
        shoeR, shoeG, shoeB, 1, 0, 1);                           // 左足 (円)
      writeInst(buf, n++, px + sx * 0.22 + strideOffset, footY, sx * 0.32, sy * 0.10,
        shoeR, shoeG, shoeB, 1, 0, 1);                           // 右足 (円)

      // === ③ 脚 — 回転する長方形 ===
      if (kind.hasSkirt) {
        // スカート / 着物: 台形っぽく広がる (2 枚重ね)
        writeInst(buf, n++, hx, hipY - sy * 0.12, sx * 0.78, sy * 0.22,
          pr, pg, pb, 1, 0, 0);
        writeInst(buf, n++, hx, hipY - sy * 0.22, sx * 1.00, sy * 0.18,
          pr * 0.92, pg * 0.92, pb * 0.92, 1, 0, 0);             // 裾広がり (少し暗く)
        // スカート下の素足 / タイツ (膝から下が見える、小円)
        writeInst(buf, n++, px - sx * 0.18 - strideOffset, (kneeY + footY) * 0.5 + sy * 0.05,
          sx * 0.18, sy * 0.18, skinR * 0.92, skinG * 0.92, skinB * 0.92, 1, 0, 0);
        writeInst(buf, n++, px + sx * 0.18 + strideOffset, (kneeY + footY) * 0.5 + sy * 0.05,
          sx * 0.18, sy * 0.18, skinR * 0.92, skinG * 0.92, skinB * 0.92, 1, 0, 0);
      } else {
        // ズボン: 2 本の傾いた脚
        writeInst(buf, n++, px - sx * 0.20 - strideOffset, kneeY, sx * 0.26, sy * 0.34,
          pr, pg, pb, 1, -legRot, 0);
        writeInst(buf, n++, px + sx * 0.20 + strideOffset, kneeY, sx * 0.26, sy * 0.34,
          pr, pg, pb, 1, legRot, 0);
      }

      // === ④ 腰/ベルト ===
      writeInst(buf, n++, hx, waistY - sy * 0.02, sx * 0.78, sy * 0.05,
        pr * 0.5, pg * 0.5, pb * 0.5, 1, 0, 0);

      // === ⑤ 胴体 (やや丸みのあるシルエット、2 重で肩の傾斜を演出) ===
      writeInst(buf, n++, hx, chestY, shoulderW, torsoH,
        sr, sg, sb, 1, 0, 0);
      // 肩の膨らみ (小さな円で両端を丸く = 肩のライン)
      writeInst(buf, n++, hx - shoulderW * 0.48, shoulderY - sy * 0.02,
        sx * 0.24, sy * 0.18, sr, sg, sb, 1, 0, 1);
      writeInst(buf, n++, hx + shoulderW * 0.48, shoulderY - sy * 0.02,
        sx * 0.24, sy * 0.18, sr, sg, sb, 1, 0, 1);

      // === ⑥ 腕 (傾いた長方形、走り姿勢) ===
      const armH = sy * 0.28;
      writeInst(buf, n++, hx - shoulderW * 0.55, chestY - sy * 0.02,
        sx * 0.18, armH, sr * 0.88, sg * 0.88, sb * 0.88, 1, -armRot, 0);
      writeInst(buf, n++, hx + shoulderW * 0.55, chestY - sy * 0.02,
        sx * 0.18, armH, sr * 0.88, sg * 0.88, sb * 0.88, 1, armRot, 0);

      // === ⑦ 手 (小さな円、肌色、腕先端にオフセット) ===
      const handDX = Math.sin(armRot) * armH * 0.5;
      const handDY = -Math.cos(armRot) * armH * 0.45;
      writeInst(buf, n++, hx - shoulderW * 0.55 - handDX, chestY - sy * 0.02 + handDY,
        sx * 0.22, sx * 0.22, skinR, skinG, skinB, 1, 0, 1);
      writeInst(buf, n++, hx + shoulderW * 0.55 + handDX, chestY - sy * 0.02 + handDY,
        sx * 0.22, sx * 0.22, skinR, skinG, skinB, 1, 0, 1);

      // === ⑧ アクセント (tint で色ずらし) ===
      if (kind.accent) {
        const [ar0, ag0, ab0] = kind.accent;
        const at = ACCENT_TINT[v.accentTint];
        const ar = Math.min(1, ar0 * at[0]);
        const ag = Math.min(1, ag0 * at[1]);
        const ab = Math.min(1, ab0 * at[2]);
        writeInst(buf, n++, hx, chestY + sy * 0.02, sx * 0.18, sy * 0.18,
          ar, ag, ab, 1, 0, 0);
      }

      // === ⑨ カバン (50% で完全に BAG_PALETTE から置換 = 更に多様化) ===
      if (kind.bag) {
        const bagBase = v.useBagPalette ? BAG_PALETTE[v.bagIdx] : kind.bag;
        const [br, bg, bb] = bagBase;
        writeInst(buf, n++, hx + sx * 0.60, chestY - sy * 0.18, sx * 0.34, sy * 0.32,
          br, bg, bb, 1, 0, 0);
        writeInst(buf, n++, hx + sx * 0.60, chestY + sy * 0.02, sx * 0.28, sy * 0.04,
          br * 0.5, bg * 0.5, bb * 0.5, 1, 0, 0);
      }

      // === ⑩ 首 (細め) ===
      writeInst(buf, n++, hx, neckY, sx * 0.28, sy * 0.08,
        skinR, skinG, skinB, 1, 0, 0);

      // === ⑪ 頭 (大きな円、主役) ===
      writeInst(buf, n++, hx, headY, headSize, headSize,
        skinR, skinG, skinB, 1, 0, 1);

      // === ⑫ 目 (小円、build で間隔調整) ===
      const eyeSpread = (build === 'infant' || build === 'child') ? 0.22 : 0.19;
      const eyeY = headY + headSize * 0.02;
      const eyeSize = headSize * 0.16;
      writeInst(buf, n++, hx - headSize * eyeSpread, eyeY, eyeSize, eyeSize,
        0.08, 0.06, 0.04, 1, 0, 1);
      writeInst(buf, n++, hx + headSize * eyeSpread, eyeY, eyeSize, eyeSize,
        0.08, 0.06, 0.04, 1, 0, 1);

      // === ⑬ 口 (小さな暗帯) — 大人は一文字、子供・幼児は丸い口 ===
      if (build === 'child' || build === 'infant') {
        writeInst(buf, n++, hx, headY - headSize * 0.22, headSize * 0.14, headSize * 0.10,
          0.45, 0.15, 0.15, 1, 0, 1);                            // 開いた口 (笑)
      } else {
        writeInst(buf, n++, hx, headY - headSize * 0.22, headSize * 0.20, headSize * 0.04,
          0.25, 0.15, 0.12, 1, 0, 0);
      }

      // === ⑭ ほっぺ (子供・幼児のみ、ピンクの丸) ===
      if (build === 'child' || build === 'infant') {
        const cheekR = headSize * 0.14;
        writeInst(buf, n++, hx - headSize * 0.32, headY - headSize * 0.12,
          cheekR, cheekR, 0.98, 0.55, 0.55, 0.5, 0, 1);
        writeInst(buf, n++, hx + headSize * 0.32, headY - headSize * 0.12,
          cheekR, cheekR, 0.98, 0.55, 0.55, 0.5, 0, 1);
      }

      // === ⑮ 顔アクセサリ: メガネ・顎ヒゲ・口ヒゲ (大人のみ) ===
      if (build !== 'child' && build !== 'infant') {
        if (v.accessory === 1) {
          // メガネ (両目をまたぐ暗い横帯 + 橋)
          writeInst(buf, n++, hx, eyeY, headSize * 0.70, headSize * 0.10,
            0.10, 0.08, 0.06, 1, 0, 0);
          writeInst(buf, n++, hx, eyeY, headSize * 0.16, headSize * 0.04,
            0.55, 0.50, 0.40, 0.8, 0, 0);
        } else if (v.accessory === 2) {
          writeInst(buf, n++, hx, headY - headSize * 0.32, headSize * 0.55, headSize * 0.20,
            hairR * 0.7, hairG * 0.7, hairB * 0.7, 1, 0, 1);     // 顎ヒゲ (円っぽく)
        } else if (v.accessory === 3) {
          writeInst(buf, n++, hx, headY - headSize * 0.15, headSize * 0.32, headSize * 0.08,
            hairR * 0.6, hairG * 0.6, hairB * 0.6, 1, 0, 0);     // 口ヒゲ
        }
      }

      // === ⑯ 髪 (形状バリエーション) ===
      const hs = v.hairShape % 6;
      if (hs === HAIR_SHAPE_BUZZ || build === 'infant') {
        // 坊主 or 幼児: 頭頂に薄い暗帯
        writeInst(buf, n++, hx, headY + headSize * 0.30, headSize * 0.88, headSize * 0.16,
          hairR * 0.92, hairG * 0.92, hairB * 0.92, 1, 0, 0);
      } else if (hs === HAIR_SHAPE_BOB) {
        writeInst(buf, n++, hx, headY + headSize * 0.20, headSize * 1.18, headSize * 0.55,
          hairR, hairG, hairB, 1, 0, 1);
        writeInst(buf, n++, hx, headY + headSize * 0.05, headSize * 1.00, headSize * 0.18,
          hairR * 0.85, hairG * 0.85, hairB * 0.85, 1, 0, 0);
      } else if (hs === HAIR_SHAPE_PONYTAIL) {
        writeInst(buf, n++, hx, headY + headSize * 0.28, headSize * 0.95, headSize * 0.40,
          hairR, hairG, hairB, 1, 0, 1);
        writeInst(buf, n++, hx + headSize * 0.15, headY - headSize * 0.35, headSize * 0.24, headSize * 0.85,
          hairR, hairG, hairB, 1, 0.15, 0);
        writeInst(buf, n++, hx, headY + headSize * 0.20, headSize * 0.86, headSize * 0.14,
          hairR * 0.85, hairG * 0.85, hairB * 0.85, 1, 0, 0);
      } else if (hs === HAIR_SHAPE_LONG) {
        writeInst(buf, n++, hx, headY + headSize * 0.18, headSize * 1.12, headSize * 0.50,
          hairR, hairG, hairB, 1, 0, 1);
        writeInst(buf, n++, hx, headY - headSize * 0.30, headSize * 1.05, headSize * 0.75,
          hairR, hairG, hairB, 1, 0, 0);
        writeInst(buf, n++, hx, headY + headSize * 0.10, headSize * 0.90, headSize * 0.16,
          hairR * 0.82, hairG * 0.82, hairB * 0.82, 1, 0, 0);
      } else if (hs === HAIR_SHAPE_SPIKY) {
        writeInst(buf, n++, hx, headY + headSize * 0.26, headSize * 0.98, headSize * 0.30,
          hairR, hairG, hairB, 1, 0, 0);
        writeInst(buf, n++, hx - headSize * 0.28, headY + headSize * 0.50, headSize * 0.22, headSize * 0.34,
          hairR, hairG, hairB, 1, 0.35, 0);
        writeInst(buf, n++, hx,                    headY + headSize * 0.54, headSize * 0.22, headSize * 0.38,
          hairR, hairG, hairB, 1, 0, 0);
        writeInst(buf, n++, hx + headSize * 0.28, headY + headSize * 0.50, headSize * 0.22, headSize * 0.34,
          hairR, hairG, hairB, 1, -0.35, 0);
      } else {
        // short: 頭を丸く包む
        writeInst(buf, n++, hx, headY + headSize * 0.26, headSize * 1.00, headSize * 0.48,
          hairR, hairG, hairB, 1, 0, 1);                         // 円で丸く
        writeInst(buf, n++, hx, headY + headSize * 0.16, headSize * 0.90, headSize * 0.14,
          hairR * 0.85, hairG * 0.85, hairB * 0.85, 1, 0, 0);
      }

      // === ⑰ 帽子 (tint 適用) ===
      if (kind.hat) {
        const [hr0, hg0, hb0] = kind.hat;
        const ht = HAT_TINT[v.hatTint];
        const hr2 = Math.min(1, hr0 * ht[0]);
        const hg2 = Math.min(1, hg0 * ht[1]);
        const hb2 = Math.min(1, hb0 * ht[2]);
        writeInst(buf, n++, hx, headY + headSize * 0.58, headSize * 1.20, headSize * 0.14,
          hr2 * 0.80, hg2 * 0.80, hb2 * 0.80, 1, 0, 0);
        writeInst(buf, n++, hx, headY + headSize * 0.74, headSize * 0.95, headSize * 0.32,
          hr2, hg2, hb2, 1, 0, 1);                               // 円形のてっぺん
      }
    }
    return n - startIdx;
  }

  private _countActive(): number {
    return this.activeLen;
  }
}
