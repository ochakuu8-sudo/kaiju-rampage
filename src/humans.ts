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
interface HumanKind {
  shirt: readonly [number, number, number];
  pants?: readonly [number, number, number];
  hair?: readonly [number, number, number];
  hat?: readonly [number, number, number];
  bag?: readonly [number, number, number];
  scale?: number;
  accent?: readonly [number, number, number];
}

const HUMAN_KINDS: ReadonlyArray<HumanKind> = [
  // ═══ 0-11: 従来の一般市民 ═════════════════════════════════
  // 0: 会社員 (黒髪 + ダークスーツ + 茶色のブリーフケース)
  { shirt: [0.18, 0.22, 0.42], pants: [0.10, 0.12, 0.25],
    hair:  [0.08, 0.06, 0.04], bag:   [0.55, 0.35, 0.18],
    accent:[0.82, 0.20, 0.25] },                                // 赤ネクタイ
  // 1: OL (白ブラウス + 紺スカート + 茶髪 + ハンドバッグ)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.22, 0.45],
    hair:  [0.35, 0.20, 0.10], bag:   [0.85, 0.30, 0.50] },
  // 2: 学生 (白シャツ + 紺スラックス + 黒髪 + 赤い学生鞄)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.28, 0.55],
    hair:  [0.08, 0.06, 0.04], bag:   [0.85, 0.20, 0.18],
    accent:[0.18, 0.28, 0.55] },                                // 紺のリボン
  // 3: 子供 — 赤シャツ + 黄色い帽子 (ランドセル的小鞄)
  { shirt: [1.00, 0.30, 0.20], pants: [0.20, 0.30, 0.55],
    hair:  [0.30, 0.18, 0.08], hat:   [1.00, 0.85, 0.10],
    bag:   [0.62, 0.18, 0.12], scale: 0.70 },                   // 小さい
  // 4: 子供 — 黄シャツ + 短い
  { shirt: [1.00, 0.85, 0.15], pants: [0.20, 0.30, 0.55],
    hair:  [0.10, 0.08, 0.04], scale: 0.68 },
  // 5: 私服 — 青シャツ + ジーンズ
  { shirt: [0.20, 0.50, 1.00], pants: [0.20, 0.30, 0.55],
    hair:  [0.20, 0.12, 0.08] },
  // 6: 私服 — 緑シャツ + ベージュパンツ
  { shirt: [0.20, 0.85, 0.30], pants: [0.55, 0.45, 0.30],
    hair:  [0.10, 0.08, 0.04] },
  // 7: 私服 — 紫シャツ + 黒パンツ
  { shirt: [0.78, 0.20, 0.92], pants: [0.18, 0.18, 0.20],
    hair:  [0.10, 0.08, 0.04] },
  // 8: ジョガー (ピンクシャツ + 黒タイツ + 白ヘッドバンド)
  { shirt: [1.00, 0.40, 0.70], pants: [0.15, 0.15, 0.18],
    hair:  [0.25, 0.15, 0.08], hat:   [0.95, 0.95, 0.95] },
  // 9: 観光客 (アロハ + ベージュ + 麦わら帽 + バックパック)
  { shirt: [0.95, 0.40, 0.30], pants: [0.65, 0.55, 0.35],
    hair:  [0.30, 0.18, 0.10], hat:   [0.95, 0.85, 0.40], bag: [0.30, 0.20, 0.10] },
  // 10: お年寄り (くすんだ茶 + 白髪、少し小柄)
  { shirt: [0.58, 0.52, 0.45], pants: [0.40, 0.36, 0.32],
    hair:  [0.92, 0.90, 0.85], scale: 0.88 },
  // 11: シェフ (白い服 + 白いコック帽)
  { shirt: [0.95, 0.95, 0.95], pants: [0.95, 0.95, 0.95],
    hair:  [0.08, 0.06, 0.04], hat:   [0.96, 0.96, 0.96] },

  // ═══ 12-15: 医療系 (病院・診療所で出現) ═══════════════════
  // 12: 看護師 — 白ワンピース + ピンク帽子 + 赤十字アクセント
  { shirt: [0.96, 0.96, 0.98], pants: [0.96, 0.96, 0.98],
    hair:  [0.30, 0.20, 0.12], hat:   [0.98, 0.85, 0.88],
    accent:[0.90, 0.20, 0.22] },                                // 赤十字
  // 13: 医者 — 白衣 + 聴診器 (青アクセント)
  { shirt: [0.96, 0.96, 0.98], pants: [0.20, 0.22, 0.28],
    hair:  [0.18, 0.10, 0.06], accent: [0.25, 0.40, 0.72] },    // 青の聴診器
  // 14: 患者 — 水色の病衣、スリッパ
  { shirt: [0.72, 0.88, 0.92], pants: [0.72, 0.88, 0.92],
    hair:  [0.85, 0.80, 0.72], scale: 0.92 },

  // ═══ 16-17: 公共サービス (警察・消防) ═════════════════════
  // 15: 警察官 — 濃紺制服 + 黒帽子 + 金バッジ
  { shirt: [0.16, 0.20, 0.35], pants: [0.10, 0.12, 0.25],
    hair:  [0.08, 0.06, 0.04], hat:   [0.12, 0.14, 0.22],
    accent:[0.92, 0.78, 0.20] },                                // 金バッジ
  // 16: 消防士 — オレンジ制服 + 赤ヘルメット
  { shirt: [0.92, 0.52, 0.15], pants: [0.42, 0.42, 0.42],
    hair:  [0.12, 0.08, 0.04], hat:   [0.88, 0.18, 0.15] },

  // ═══ 17-18: 商業・サービス ════════════════════════════════
  // 17: 駅員 — 青制服 + 赤ネクタイ + キャップ
  { shirt: [0.22, 0.38, 0.62], pants: [0.16, 0.22, 0.38],
    hair:  [0.10, 0.08, 0.04], hat:   [0.18, 0.28, 0.48],
    accent:[0.92, 0.25, 0.25] },                                // 赤ネクタイ
  // 18: 商店店主 — エプロン + バンダナ
  { shirt: [0.95, 0.85, 0.72], pants: [0.35, 0.28, 0.18],
    hair:  [0.18, 0.10, 0.06], hat:   [0.85, 0.22, 0.18],
    accent:[0.55, 0.38, 0.22] },                                // 茶色エプロン紐

  // ═══ 19-20: 工業・作業員 ══════════════════════════════════
  // 19: 工員 — 青い作業服 + 黄色いヘルメット + オレンジ安全ベスト
  { shirt: [0.28, 0.40, 0.55], pants: [0.22, 0.25, 0.32],
    hair:  [0.08, 0.06, 0.04], hat:   [0.98, 0.82, 0.15],
    accent:[1.00, 0.55, 0.15] },                                // 安全ベスト
  // 20: 港湾労働者 — 灰色オーバーオール + 白ヘルメット
  { shirt: [0.50, 0.50, 0.52], pants: [0.50, 0.50, 0.52],
    hair:  [0.10, 0.08, 0.04], hat:   [0.92, 0.92, 0.88] },

  // ═══ 21-23: 和風 (神社・古都) ═════════════════════════════
  // 21: 神主 — 白い装束 + 黒い烏帽子 (少し長身)
  { shirt: [0.95, 0.92, 0.85], pants: [0.85, 0.20, 0.25],
    hair:  [0.08, 0.06, 0.04], hat:   [0.12, 0.10, 0.15],
    scale: 1.05 },
  // 22: 巫女 — 白着物 + 緋袴 (赤下半身)
  { shirt: [0.96, 0.94, 0.90], pants: [0.82, 0.18, 0.22],
    hair:  [0.08, 0.06, 0.04],
    accent:[0.82, 0.18, 0.22] },                                // 緋袴紐
  // 23: 町民 (和装) — 茶色着物
  { shirt: [0.55, 0.38, 0.22], pants: [0.42, 0.30, 0.18],
    hair:  [0.92, 0.90, 0.85], scale: 0.92 },

  // ═══ 24-27: 夜街 (繁華街) ═════════════════════════════════
  // 24: ホステス — 赤いドレス + 金髪
  { shirt: [0.88, 0.15, 0.30], pants: [0.88, 0.15, 0.30],
    hair:  [0.92, 0.78, 0.32], bag: [0.92, 0.78, 0.32] },
  // 25: バーテン — 黒ベスト + 白シャツ + 蝶ネクタイ
  { shirt: [0.12, 0.12, 0.14], pants: [0.12, 0.12, 0.14],
    hair:  [0.12, 0.08, 0.04], accent: [0.88, 0.15, 0.20] },    // 赤蝶ネクタイ
  // 26: ホスト — 金髪 + 白スーツ + 紫アクセント
  { shirt: [0.95, 0.95, 0.95], pants: [0.95, 0.95, 0.95],
    hair:  [0.95, 0.80, 0.40], accent: [0.72, 0.25, 0.88] },
  // 27: 酔客 — ラフな服装 + 少し猫背
  { shirt: [0.68, 0.42, 0.25], pants: [0.35, 0.32, 0.28],
    hair:  [0.20, 0.12, 0.08], bag: [0.22, 0.18, 0.12],
    scale: 0.95 },

  // ═══ 28-31: 祭り・テーマパーク ════════════════════════════
  // 28: 祭り参加者 (男) — 青い法被 + 白鉢巻
  { shirt: [0.22, 0.32, 0.62], pants: [0.92, 0.92, 0.95],
    hair:  [0.08, 0.06, 0.04], hat:   [0.95, 0.95, 0.95],
    accent:[0.92, 0.18, 0.22] },                                // 赤い腹帯
  // 29: 祭り参加者 (浴衣の娘) — 赤浴衣
  { shirt: [0.92, 0.30, 0.45], pants: [0.82, 0.22, 0.38],
    hair:  [0.08, 0.06, 0.04],
    accent:[0.95, 0.85, 0.15] },                                // 黄色い帯
  // 30: 浴衣 (青柄)
  { shirt: [0.28, 0.48, 0.78], pants: [0.22, 0.38, 0.62],
    hair:  [0.22, 0.15, 0.08],
    accent:[0.92, 0.92, 0.95] },                                // 白い帯
  // 31: ピエロ (パーク) — カラフル + 赤鼻
  { shirt: [0.95, 0.35, 0.60], pants: [0.30, 0.72, 0.45],
    hair:  [0.92, 0.42, 0.18], hat:   [0.98, 0.88, 0.15],
    accent:[0.95, 0.15, 0.18] },

  // ═══ 32-34: 住宅街 ═════════════════════════════════════════
  // 32: 主婦 — エプロン + カーディガン
  { shirt: [0.88, 0.72, 0.62], pants: [0.55, 0.42, 0.30],
    hair:  [0.35, 0.22, 0.12], bag: [0.68, 0.52, 0.38],
    accent:[0.95, 0.88, 0.82] },                                // 白エプロン
  // 33: 女子高生 — セーラー服 + 紺リボン
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.22, 0.42],
    hair:  [0.18, 0.12, 0.08], bag: [0.35, 0.22, 0.15],
    accent:[0.20, 0.28, 0.55] },                                // セーラー襟
  // 34: 幼児 — ピンク / 青の丸い服 (すごく小さい)
  { shirt: [0.98, 0.78, 0.88], pants: [0.42, 0.68, 0.92],
    hair:  [0.45, 0.30, 0.18], scale: 0.55 },                   // 超小柄
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

  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 50;
    const camTop = cameraY + C.WORLD_MAX_Y + 50;
    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];
      const py = this.py[i];
      if (py < camBot || py > camTop) continue;
      const kind = HUMAN_KINDS[this.kind[i]];
      // 身長スケール (子供は小さく、神主は長身)
      const ks = kind.scale ?? 1.0;
      const sx = C.HUMAN_W * this.scaleX[i] * ks;
      const sy = C.HUMAN_H * (2 - this.scaleX[i]) * ks;
      const px = this.px[i];

      // 1. 上半身 (シャツ)
      const [sr, sg, sb] = kind.shirt;
      writeInst(buf, n++, px, py - sy * 0.15, sx, sy * 0.6, sr, sg, sb, 1, 0, 0);

      // 2. 下半身 (ズボン) — body の下半分にオーバーレイ
      if (kind.pants) {
        const [pr, pg, pb] = kind.pants;
        writeInst(buf, n++, px, py - sy * 0.30, sx, sy * 0.30, pr, pg, pb, 1, 0, 0);
      }

      // 3. アクセント (ネクタイ/たすき/エプロン紐など) — 胸元の細い帯
      if (kind.accent) {
        const [ar, ag, ab] = kind.accent;
        writeInst(buf, n++, px, py - sy * 0.05, sx * 0.40, sy * 0.25, ar, ag, ab, 1, 0, 0);
      }

      // 4. かばん — 体の右側に小さく
      if (kind.bag) {
        const [br, bg, bb] = kind.bag;
        writeInst(buf, n++, px + sx * 0.55, py - sy * 0.20, sx * 0.42, sy * 0.42,
          br, bg, bb, 1, 0, 0);
      }

      // 5. 頭 (肌色の円)
      writeInst(buf, n++, px, py + sy * 0.30, sx, sx, 0.95, 0.75, 0.55, 1, 0, 1);

      // 6. 髪 — 頭の上半分にオーバーレイ
      if (kind.hair) {
        const [hr, hg, hb] = kind.hair;
        writeInst(buf, n++, px, py + sy * 0.30 + sx * 0.30, sx * 0.92, sx * 0.45,
          hr, hg, hb, 1, 0, 0);
      }

      // 7. 帽子 — 髪のさらに上
      if (kind.hat) {
        const [hr2, hg2, hb2] = kind.hat;
        writeInst(buf, n++, px, py + sy * 0.30 + sx * 0.70, sx * 1.05, sx * 0.35,
          hr2, hg2, hb2, 1, 0, 0);
      }
    }
    return n - startIdx;
  }

  private _countActive(): number {
    return this.activeLen;
  }
}
