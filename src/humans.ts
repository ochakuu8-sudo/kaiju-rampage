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
interface HumanKind {
  shirt: readonly [number, number, number];
  pants?: readonly [number, number, number];
  hair?: readonly [number, number, number];
  hat?: readonly [number, number, number];
  bag?: readonly [number, number, number];
}

const HUMAN_KINDS: ReadonlyArray<HumanKind> = [
  // 0: 会社員 (黒髪 + ダークスーツ + 茶色のブリーフケース)
  { shirt: [0.18, 0.22, 0.42], pants: [0.10, 0.12, 0.25],
    hair:  [0.08, 0.06, 0.04], bag:   [0.55, 0.35, 0.18] },
  // 1: OL (白ブラウス + 紺スカート + 茶髪 + ハンドバッグ)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.22, 0.45],
    hair:  [0.35, 0.20, 0.10], bag:   [0.85, 0.30, 0.50] },
  // 2: 学生 (白シャツ + 紺スラックス + 黒髪 + 赤い学生鞄)
  { shirt: [0.92, 0.92, 0.95], pants: [0.18, 0.28, 0.55],
    hair:  [0.08, 0.06, 0.04], bag:   [0.85, 0.20, 0.18] },
  // 3: 子供 — 赤シャツ + 黄色い帽子
  { shirt: [1.00, 0.30, 0.20], pants: [0.20, 0.30, 0.55],
    hair:  [0.30, 0.18, 0.08], hat:   [1.00, 0.85, 0.10] },
  // 4: 子供 — 黄シャツ
  { shirt: [1.00, 0.85, 0.15], pants: [0.20, 0.30, 0.55],
    hair:  [0.10, 0.08, 0.04] },
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
  // 10: お年寄り (くすんだ茶 + 白髪)
  { shirt: [0.58, 0.52, 0.45], pants: [0.40, 0.36, 0.32],
    hair:  [0.92, 0.90, 0.85] },
  // 11: シェフ (白い服 + 白いコック帽)
  { shirt: [0.95, 0.95, 0.95], pants: [0.95, 0.95, 0.95],
    hair:  [0.08, 0.06, 0.04], hat:   [0.96, 0.96, 0.96] },
];

/** 重み付き種類選択。比較的「ごく普通の人」を多めに、特殊型を少なめに。 */
const HUMAN_KIND_WEIGHTS: ReadonlyArray<number> = [
  6, // 0 会社員
  4, // 1 OL
  4, // 2 学生
  3, // 3 子供 (赤)
  3, // 4 子供 (黄)
  5, // 5 私服 青
  4, // 6 私服 緑
  3, // 7 私服 紫
  2, // 8 ジョガー
  2, // 9 観光客
  3, // 10 お年寄り
  1, // 11 シェフ
];
const HUMAN_KIND_TOTAL = HUMAN_KIND_WEIGHTS.reduce((a, b) => a + b, 0);

function pickHumanKind(): number {
  let r = Math.random() * HUMAN_KIND_TOTAL;
  for (let i = 0; i < HUMAN_KIND_WEIGHTS.length; i++) {
    r -= HUMAN_KIND_WEIGHTS[i];
    if (r <= 0) return i;
  }
  return HUMAN_KIND_WEIGHTS.length - 1;
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
   *  人数が多いほど散布円が大きくなる (radius ∝ √n) */
  spawnBlast(cx: number, cy: number, n: number) {
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
      this.kind[i]       = pickHumanKind();
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
      const sx = C.HUMAN_W * this.scaleX[i];
      const sy = C.HUMAN_H * (2 - this.scaleX[i]);
      const px = this.px[i];
      const kind = HUMAN_KINDS[this.kind[i]];

      // 1. 上半身 (シャツ)
      const [sr, sg, sb] = kind.shirt;
      writeInst(buf, n++, px, py - sy * 0.15, sx, sy * 0.6, sr, sg, sb, 1, 0, 0);

      // 2. 下半身 (ズボン) — body の下半分にオーバーレイ
      if (kind.pants) {
        const [pr, pg, pb] = kind.pants;
        writeInst(buf, n++, px, py - sy * 0.30, sx, sy * 0.30, pr, pg, pb, 1, 0, 0);
      }

      // 3. かばん — 体の右側に小さく
      if (kind.bag) {
        const [br, bg, bb] = kind.bag;
        writeInst(buf, n++, px + sx * 0.55, py - sy * 0.20, sx * 0.42, sy * 0.42,
          br, bg, bb, 1, 0, 0);
      }

      // 4. 頭 (肌色の円)
      writeInst(buf, n++, px, py + sy * 0.30, sx, sx, 0.95, 0.75, 0.55, 1, 0, 1);

      // 5. 髪 — 頭の上半分にオーバーレイ
      if (kind.hair) {
        const [hr, hg, hb] = kind.hair;
        writeInst(buf, n++, px, py + sy * 0.30 + sx * 0.30, sx * 0.92, sx * 0.45,
          hr, hg, hb, 1, 0, 0);
      }

      // 6. 帽子 — 髪のさらに上
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
