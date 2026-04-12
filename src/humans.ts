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
const MODE_HORIZ = 0; // 横道路に沿って
const MODE_VERT  = 1; // 縦路地に沿って
const MODE_FREE  = 2; // 自由（ブロック内パニック逃走）

// 道路 Y 中心と許容幅 (4道路)
const H_ROADS = [
  { y: C.HILLTOP_STREET_Y,   tol: C.HILLTOP_STREET_H   / 2 + 2 },
  { y: C.MAIN_STREET_Y,      tol: C.MAIN_STREET_H      / 2 + 2 },
  { y: C.LOWER_STREET_Y,     tol: C.LOWER_STREET_H     / 2 + 2 },
  { y: C.RIVERSIDE_STREET_Y, tol: C.RIVERSIDE_STREET_H / 2 + 2 },
];

// 路地 X 中心と許容幅
const V_ALLEYS = [
  { x: C.ALLEY_1_X, tol: C.ALLEY_WIDTH / 2 + 2 },
  { x: C.ALLEY_2_X, tol: C.ALLEY_WIDTH / 2 + 2 },
];

function onHorizRoad(py: number): boolean {
  return H_ROADS.some(r => Math.abs(py - r.y) <= r.tol);
}

function onVertAlley(px: number): boolean {
  return V_ALLEYS.some(a => Math.abs(px - a.x) <= a.tol);
}

// 人間の服の色パレット（鮮やかで視認しやすい色）
const HUMAN_PALETTE: ReadonlyArray<[number,number,number]> = [
  [1.00, 0.20, 0.20], // 赤
  [0.20, 0.50, 1.00], // 青
  [1.00, 0.85, 0.10], // 黄
  [0.20, 0.85, 0.30], // 緑
  [1.00, 0.50, 0.10], // オレンジ
  [0.80, 0.20, 0.95], // 紫
  [0.10, 0.90, 0.90], // シアン
  [1.00, 0.40, 0.70], // ピンク
];

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
  colorIdx:   Uint8Array   = new Uint8Array(C.MAX_HUMANS); // HUMAN_PALETTE index
  blastTimer: Float32Array = new Float32Array(C.MAX_HUMANS); // 吹き飛ばしフェーズ残り時間

  activeCount = 0;

  reset() {
    this.state.fill(ST_INACTIVE);
    this.activeCount = 0;
  }

  /** 指定座標付近に n 体スポーン */
  spawn(cx: number, cy: number, n: number) {
    let spawned = 0;
    for (let i = 0; i < C.MAX_HUMANS && spawned < n; i++) {
      if (this.state[i] !== ST_INACTIVE) continue;
      this.state[i] = ST_RUNNING;

      // スポーン位置: 建物崩壊地点付近 → 近くの道路にスナップ
      let spawnX = cx + rand(-15, 15);
      let spawnY = cy + rand(-5, 5);

      // 最寄り道路にスナップして道路上から逃げる
      let bestDist = Infinity;
      let bestY = spawnY;
      for (const r of H_ROADS) {
        const d = Math.abs(spawnY - r.y);
        if (d < bestDist) { bestDist = d; bestY = r.y; }
      }
      spawnY = bestY + rand(-2, 2);

      this.px[i]    = spawnX;
      this.py[i]    = spawnY;
      const spd     = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.speed[i] = spd;
      this.mode[i]  = MODE_HORIZ; // 最初は横道路を逃げる
      this.vx[i]    = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vy[i]    = rand(-5, 5);
      this.timer[i]    = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]   = 1;
      this.colorIdx[i] = Math.floor(Math.random() * HUMAN_PALETTE.length);
      spawned++;
    }
    this.activeCount = this._countActive();
  }

  /** 建物破壊時: 中心から円状に吹き飛ばしてから逃走
   *  人数が多いほど散布円が大きくなる (radius ∝ √n) */
  spawnBlast(cx: number, cy: number, n: number) {
    // 散布半径: √n × 6  (5人≈13px, 50人≈42px, 300人≈104px)
    const blastR = Math.sqrt(n) * 6;
    let spawned = 0;
    for (let i = 0; i < C.MAX_HUMANS && spawned < n; i++) {
      if (this.state[i] !== ST_INACTIVE) continue;
      this.state[i]      = ST_RUNNING;
      // 初期位置: 中心から blastR 半径の円内にランダム配置
      const initAngle    = Math.random() * Math.PI * 2;
      const initR        = Math.random() * blastR;
      this.px[i]         = cx + Math.cos(initAngle) * initR;
      this.py[i]         = cy + Math.sin(initAngle) * initR;
      const angle        = Math.random() * Math.PI * 2;
      const spd          = rand(180, 380);
      this.vx[i]         = Math.cos(angle) * spd;
      this.vy[i]         = Math.sin(angle) * spd;
      this.speed[i]      = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.mode[i]       = MODE_FREE;
      this.blastTimer[i] = rand(0.30, 0.55);
      this.timer[i]      = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]     = 1;
      this.colorIdx[i]   = Math.floor(Math.random() * HUMAN_PALETTE.length);
      spawned++;
    }
    this.activeCount = this._countActive();
  }

  update(dt: number, ballX: number, ballY: number) {
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;

      // 吹き飛ばしフェーズ: 放射状に飛散して減速
      if (this.blastTimer[i] > 0) {
        this.blastTimer[i] -= dt;
        const damp = Math.max(0, 1 - 4.5 * dt);
        this.vx[i] *= damp;
        this.vy[i] *= damp;
        this.px[i] += this.vx[i] * dt;
        this.py[i] += this.vy[i] * dt;
        this.px[i] = Math.max(C.WORLD_MIN_X + 4, Math.min(C.WORLD_MAX_X - 4, this.px[i]));
        this.py[i] = Math.max(C.HUMAN_Y_MIN, Math.min(C.HUMAN_Y_MAX, this.py[i]));
        if (this.blastTimer[i] <= 0) {
          // blast終了後はFREEで逃走。道路に入ったら出られなくなる
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
        // 道路エリアに入ったら HORIZ へ（以降出られない）
        for (const r of H_ROADS) {
          if (Math.abs(py - r.y) <= r.tol) {
            this.mode[i] = MODE_HORIZ;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }
        // 路地エリアに入ったら VERT へ
        if (this.mode[i] === MODE_FREE) {
          for (const a of V_ALLEYS) {
            if (Math.abs(px - a.x) <= a.tol) {
              this.mode[i] = MODE_VERT;
              this._pickNewDirection(i);
              this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
              break;
            }
          }
        }
        // 全体Y境界クランプ
        this.py[i] = Math.max(C.HUMAN_Y_MIN + C.HUMAN_H, Math.min(C.HUMAN_Y_MAX - C.HUMAN_H, this.py[i]));

      } else if (cm === MODE_HORIZ) {
        // 道路エリア内でランダム移動（Y範囲をクランプ）
        const road = this._findRoad(py);
        if (road) {
          this.py[i] = Math.max(road.y - road.tol, Math.min(road.y + road.tol, this.py[i]));
        }
        // 路地エリアに入ったら VERT に切り替え可（確率的）
        for (const a of V_ALLEYS) {
          if (Math.abs(px - a.x) <= a.tol && Math.random() < 0.008) {
            this.mode[i] = MODE_VERT;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }

      } else if (cm === MODE_VERT) {
        // 路地エリア内でランダム移動（X範囲をクランプ）
        const alley = this._findAlley(px);
        if (alley) {
          this.px[i] = Math.max(alley.x - alley.tol, Math.min(alley.x + alley.tol, this.px[i]));
        }
        // 横道路エリアに入ったら HORIZ に切り替え可
        for (const r of H_ROADS) {
          if (Math.abs(py - r.y) <= r.tol && Math.random() < 0.008) {
            this.mode[i] = MODE_HORIZ;
            this._pickNewDirection(i);
            this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
            break;
          }
        }
        this.py[i] = Math.max(C.HUMAN_Y_MIN + C.HUMAN_H, Math.min(C.HUMAN_Y_MAX - C.HUMAN_H, this.py[i]));
      }

      // X方向: 画面端で逃走完了 → INACTIVE
      if (this.px[i] < C.WORLD_MIN_X + 5 || this.px[i] > C.WORLD_MAX_X - 5) {
        this.state[i] = ST_INACTIVE;
      }

      // 潰れアニメ回復
      if (this.scaleX[i] < 1) {
        this.scaleX[i] = Math.min(1, this.scaleX[i] + dt * 12);
      }
    }
    this.activeCount = this._countActive();
  }

  private _findRoad(py: number): { y: number; tol: number } | null {
    for (const r of H_ROADS) {
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

  private _snapToNearestRoad(i: number) {
    // Find the nearest road and snap to its center Y
    let bestY = H_ROADS[0].y;
    let bestDist = Math.abs(this.py[i] - H_ROADS[0].y);
    for (const r of H_ROADS) {
      const d = Math.abs(this.py[i] - r.y);
      if (d < bestDist) { bestDist = d; bestY = r.y; }
    }
    this.py[i]   = bestY;
    this.vy[i]   = 0;
    this.mode[i] = MODE_HORIZ;
    this.vx[i]   = (Math.random() > 0.5 ? 1 : -1) * this.speed[i];
  }

  private _pickNewDirection(i: number) {
    const spd = this.speed[i];
    const m = this.mode[i];
    if (m === MODE_HORIZ) {
      this.vx[i] = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vy[i] = 0;
    } else if (m === MODE_VERT) {
      this.vy[i] = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vx[i] = 0;
    }
  }

  checkCrush(ballX: number, ballY: number, ballR: number): number[] {
    const crushed: number[] = [];
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;
      const hx = this.px[i] - C.HUMAN_W / 2;
      const hy = this.py[i] - C.HUMAN_H / 2;
      const nearX = Math.max(hx, Math.min(ballX, hx + C.HUMAN_W));
      const nearY = Math.max(hy, Math.min(ballY, hy + C.HUMAN_H));
      const dx = ballX - nearX, dy = ballY - nearY;
      if (dx * dx + dy * dy < ballR * ballR) {
        this.state[i]  = ST_INACTIVE;
        this.scaleX[i] = 0.15;
        crushed.push(i);
      }
    }
    return crushed;
  }

  getPos(i: number): [number, number] {
    return [this.px[i], this.py[i]];
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;
      const sx = C.HUMAN_W * this.scaleX[i];
      const sy = C.HUMAN_H * (2 - this.scaleX[i]);
      const px = this.px[i], py = this.py[i];
      const [cr, cg, cb] = HUMAN_PALETTE[this.colorIdx[i]];
      // 胴体（シャツ色・矩形）
      writeInst(buf, n++, px, py - sy * 0.15, sx, sy * 0.6, cr, cg, cb, 1, 0, 0);
      // 頭（肌色・円）
      writeInst(buf, n++, px, py + sy * 0.30, sx, sx, 0.95, 0.75, 0.55, 1, 0, 1);
    }
    return n - startIdx;
  }

  private _countActive(): number {
    let c = 0;
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] === ST_RUNNING) c++;
    }
    return c;
  }
}
