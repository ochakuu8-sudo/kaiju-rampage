/**
 * humans.ts — 人間 SoA 管理 (最大 500 体)
 * Structure of Arrays でキャッシュ効率を最大化
 */

import * as C from './constants';
import { rand, randInt } from './physics';
import { writeInst, INST_F } from './renderer';

const ST_INACTIVE = 0;
const ST_RUNNING  = 1;
const ST_CRUSHED  = 2; // 潰されたフレームのみ

export class HumanManager {
  // SoA
  px:     Float32Array = new Float32Array(C.MAX_HUMANS);
  py:     Float32Array = new Float32Array(C.MAX_HUMANS);
  vx:     Float32Array = new Float32Array(C.MAX_HUMANS);
  vy:     Float32Array = new Float32Array(C.MAX_HUMANS);
  state:  Uint8Array   = new Uint8Array(C.MAX_HUMANS);
  timer:  Float32Array = new Float32Array(C.MAX_HUMANS); // 方向転換タイマー
  speed:  Float32Array = new Float32Array(C.MAX_HUMANS); // 個体速度
  scaleX: Float32Array = new Float32Array(C.MAX_HUMANS); // 潰れアニメ

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
      this.px[i]    = cx + rand(-20, 20);
      this.py[i]    = cy + rand(-5, 5);
      const angle   = Math.random() * Math.PI * 2;
      const spd     = rand(C.HUMAN_BASE_SPEED * 0.7, C.HUMAN_BASE_SPEED * 1.3);
      this.speed[i] = spd;
      this.vx[i]    = Math.cos(angle) * spd;
      this.vy[i]    = Math.sin(angle) * spd;
      this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      this.scaleX[i]= 1;
      spawned++;
    }
    this.activeCount = this._countActive();
  }

  update(dt: number, ballX: number, ballY: number) {
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;

      // ボール接近 → 恐怖ブースト
      const dbx = this.px[i] - ballX;
      const dby = this.py[i] - ballY;
      const dist2 = dbx * dbx + dby * dby;
      const fearR  = C.HUMAN_FEAR_RADIUS * C.HUMAN_FEAR_RADIUS;
      const boost  = dist2 < fearR ? C.HUMAN_FEAR_BOOST : 1.0;

      // 方向転換タイマー
      this.timer[i] -= dt;
      if (this.timer[i] <= 0) {
        const angle   = Math.random() * Math.PI * 2;
        this.vx[i] = Math.cos(angle) * this.speed[i];
        this.vy[i] = Math.sin(angle) * this.speed[i];
        this.timer[i] = rand(C.HUMAN_DIR_CHANGE_MIN, C.HUMAN_DIR_CHANGE_MAX);
      }

      // 移動
      this.px[i] += this.vx[i] * boost * dt;
      this.py[i] += this.vy[i] * boost * dt;

      // Y方向: 道路エリア内でバウンド
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

      // X方向: 画面端まで走って逃走
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

  /**
   * ボールとの衝突判定
   * @returns 潰された人間のインデックス配列
   */
  checkCrush(ballX: number, ballY: number, ballR: number): number[] {
    const crushed: number[] = [];
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;
      // 円 vs AABB (人間)
      const hx = this.px[i] - C.HUMAN_W / 2;
      const hy = this.py[i] - C.HUMAN_H / 2;
      const nearX = Math.max(hx, Math.min(ballX, hx + C.HUMAN_W));
      const nearY = Math.max(hy, Math.min(ballY, hy + C.HUMAN_H));
      const dx = ballX - nearX, dy = ballY - nearY;
      if (dx * dx + dy * dy < ballR * ballR) {
        this.state[i]  = ST_INACTIVE;
        this.scaleX[i] = 0.15; // 潰れ
        crushed.push(i);
      }
    }
    return crushed;
  }

  getPos(i: number): [number, number] {
    return [this.px[i], this.py[i]];
  }

  /** インスタンスバッファへ書き込み */
  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (let i = 0; i < C.MAX_HUMANS; i++) {
      if (this.state[i] !== ST_RUNNING) continue;
      const sx = C.HUMAN_W * this.scaleX[i];
      const sy = C.HUMAN_H * (2 - this.scaleX[i]); // つぶれ時に縦に伸びる
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
