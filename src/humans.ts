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

// 道路 Y 中心と許容幅
const H_ROADS = [
  { y: C.FRONT_STREET_Y, tol: C.FRONT_STREET_H / 2 + 2 },
  { y: C.MAIN_STREET_Y,  tol: C.MAIN_STREET_H  / 2 + 2 },
  { y: C.BACK_STREET_Y,  tol: C.BACK_STREET_H  / 2 + 2 },
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

export class HumanManager {
  px:     Float32Array = new Float32Array(C.MAX_HUMANS);
  py:     Float32Array = new Float32Array(C.MAX_HUMANS);
  vx:     Float32Array = new Float32Array(C.MAX_HUMANS);
  vy:     Float32Array = new Float32Array(C.MAX_HUMANS);
  state:  Uint8Array   = new Uint8Array(C.MAX_HUMANS);
  timer:  Float32Array = new Float32Array(C.MAX_HUMANS);
  speed:  Float32Array = new Float32Array(C.MAX_HUMANS);
  scaleX: Float32Array = new Float32Array(C.MAX_HUMANS);
  mode:   Uint8Array   = new Uint8Array(C.MAX_HUMANS); // MODE_*

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
      this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]= 1;
      spawned++;
    }
    this.activeCount = this._countActive();
  }

  update(dt: number, ballX: number, ballY: number) {
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;

      const px = this.px[i];
      const py = this.py[i];

      // ボール接近 → 恐怖ブースト + FREEモードへ
      const dbx = px - ballX;
      const dby = py - ballY;
      const dist2 = dbx * dbx + dby * dby;
      const fearR  = C.HUMAN_FEAR_RADIUS * C.HUMAN_FEAR_RADIUS;
      const boost  = dist2 < fearR ? C.HUMAN_FEAR_BOOST : 1.0;
      if (dist2 < fearR * 0.5) {
        this.mode[i] = MODE_FREE;
      }

      // 方向転換タイマー
      this.timer[i] -= dt;
      if (this.timer[i] <= 0) {
        this._pickNewDirection(i);
        this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      }

      // 位置更新
      this.px[i] += this.vx[i] * boost * dt;
      this.py[i] += this.vy[i] * boost * dt;

      // モードに応じた制約
      const currentMode = this.mode[i];
      if (currentMode === MODE_HORIZ) {
        // Y方向は小さく揺れるだけ
        this.vy[i] *= 0.85;
      } else if (currentMode === MODE_VERT) {
        // X方向は小さく揺れるだけ
        this.vx[i] *= 0.85;
      }

      // 路地に入ったらVERTモードに切り替え可
      if (currentMode === MODE_HORIZ && onVertAlley(this.px[i])) {
        // 交差点: ランダムに路地へ曲がる (20%の確率)
        if (Math.random() < 0.008) {
          this.mode[i] = MODE_VERT;
          this.vy[i]   = (Math.random() > 0.5 ? 1 : -1) * this.speed[i];
          this.vx[i]   = 0;
        }
      }
      // 縦路地から横道路へ曲がれる
      if (currentMode === MODE_VERT && onHorizRoad(this.py[i])) {
        if (Math.random() < 0.008) {
          this.mode[i] = MODE_HORIZ;
          this.vx[i]   = (Math.random() > 0.5 ? 1 : -1) * this.speed[i];
          this.vy[i]   = 0;
        }
      }

      // Y境界（道路範囲外に出ないよう）
      const yMin = C.HUMAN_Y_MIN + C.HUMAN_H / 2;
      const yMax = C.HUMAN_Y_MAX - C.HUMAN_H / 2;
      if (this.py[i] < yMin) {
        this.py[i] = yMin;
        this.vy[i] = Math.abs(this.vy[i]);
      }
      if (this.py[i] > yMax) {
        this.py[i] = yMax;
        this.vy[i] = -Math.abs(this.vy[i]);
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

  private _pickNewDirection(i: number) {
    const spd = this.speed[i];
    const m = this.mode[i];
    if (m === MODE_HORIZ) {
      // 主にX方向、ときどきX方向切り替え
      this.vx[i] = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vy[i] = rand(-8, 8);
    } else if (m === MODE_VERT) {
      this.vy[i] = (Math.random() > 0.5 ? 1 : -1) * spd;
      this.vx[i] = rand(-8, 8);
    } else {
      // FREE: 全方向ランダム
      const angle = Math.random() * Math.PI * 2;
      this.vx[i] = Math.cos(angle) * spd;
      this.vy[i] = Math.sin(angle) * spd;
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
      writeInst(buf, n++, this.px[i], this.py[i], sx, sy, 0.9, 0.75, 0.6, 1, 0, 0);
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
