/**
 * particles.ts — パーティクル SoA (最大 2000 個)
 */

import * as C from './constants';
import { rand } from './physics';
import { writeInst, INST_F } from './renderer';

const ST_DEAD = 0;
const ST_ALIVE = 1;

export class ParticleManager {
  // SoA
  px:   Float32Array = new Float32Array(C.MAX_PARTICLES);
  py:   Float32Array = new Float32Array(C.MAX_PARTICLES);
  vx:   Float32Array = new Float32Array(C.MAX_PARTICLES);
  vy:   Float32Array = new Float32Array(C.MAX_PARTICLES);
  life: Float32Array = new Float32Array(C.MAX_PARTICLES); // 残り寿命 (秒)
  maxLife: Float32Array = new Float32Array(C.MAX_PARTICLES);
  size:  Float32Array = new Float32Array(C.MAX_PARTICLES); // 幅
  sizeH: Float32Array = new Float32Array(C.MAX_PARTICLES); // 高さ (0=正方形)
  r:    Float32Array = new Float32Array(C.MAX_PARTICLES);
  g:    Float32Array = new Float32Array(C.MAX_PARTICLES);
  b:    Float32Array = new Float32Array(C.MAX_PARTICLES);
  gravity: Uint8Array = new Uint8Array(C.MAX_PARTICLES); // 重力あり？
  circle:  Uint8Array = new Uint8Array(C.MAX_PARTICLES); // 円形？
  rot:  Float32Array = new Float32Array(C.MAX_PARTICLES);
  rotV: Float32Array = new Float32Array(C.MAX_PARTICLES);
  state: Uint8Array = new Uint8Array(C.MAX_PARTICLES);

  private head = 0; // 次のスロット検索開始位置

  reset() {
    this.state.fill(ST_DEAD);
  }

  private alloc(): number {
    // 循環探索でデッドスロットを再利用
    for (let tries = 0; tries < C.MAX_PARTICLES; tries++) {
      const i = (this.head + tries) % C.MAX_PARTICLES;
      if (this.state[i] === ST_DEAD) {
        this.head = (i + 1) % C.MAX_PARTICLES;
        return i;
      }
    }
    // 満杯の場合は強制上書き
    const i = this.head;
    this.head = (this.head + 1) % C.MAX_PARTICLES;
    return i;
  }

  private emit(
    x: number, y: number,
    vx: number, vy: number,
    r: number, g: number, b: number,
    size: number, life: number,
    useGravity: boolean, isCircle: boolean,
    rotV = 0, sizeH = 0, fixedRot?: number
  ) {
    const i = this.alloc();
    this.state[i] = ST_ALIVE;
    this.px[i]    = x;
    this.py[i]    = y;
    this.vx[i]    = vx;
    this.vy[i]    = vy;
    this.r[i]     = r;
    this.g[i]     = g;
    this.b[i]     = b;
    this.size[i]  = size;
    this.sizeH[i] = sizeH;
    this.life[i]  = life;
    this.maxLife[i] = life;
    this.gravity[i] = useGravity ? 1 : 0;
    this.circle[i]  = isCircle ? 1 : 0;
    this.rot[i]     = fixedRot !== undefined ? fixedRot : Math.random() * Math.PI * 2;
    this.rotV[i]    = rotV;
  }

  /** 建物破片 */
  spawnDebris(x: number, y: number, count: number, buildingR: number, buildingG: number, buildingB: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(40, 160);
      this.emit(
        x + rand(-10, 10), y + rand(-10, 10),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        buildingR * rand(0.7, 1), buildingG * rand(0.7, 1), buildingB * rand(0.7, 1),
        rand(4, 10), rand(0.5, 1.0),
        true, false, rand(-6, 6)
      );
    }
  }

  /** 血しぶき — 速度方向に伸びたストリーク形状 */
  spawnBlood(x: number, y: number, count: number) {
    // 大粒のストリーク（速度方向に長い楕円、重力あり）
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(80, 300);
      const vx    = Math.cos(angle) * spd;
      const vy    = Math.sin(angle) * spd;
      const w     = rand(2, 5);          // 細い幅
      const h     = rand(8, 20);         // 長い長さ
      this.emit(
        x + rand(-3, 3), y + rand(-3, 3),
        vx, vy,
        1.0, rand(0, 0.05), 0,
        w, rand(0.25, 0.55),
        true, false,
        0, h, angle + Math.PI * 0.5    // 速度方向に回転
      );
    }
    // 小粒のストリーク（速度方向に短い楕円、重力なし）
    const tiny = Math.ceil(count * 0.7);
    for (let i = 0; i < tiny; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(200, 520);
      const vx    = Math.cos(angle) * spd;
      const vy    = Math.sin(angle) * spd;
      const w     = rand(1, 2.5);
      const h     = rand(4, 10);
      this.emit(
        x + rand(-5, 5), y + rand(-5, 5),
        vx, vy,
        1.0, rand(0, 0.03), 0,
        w, rand(0.08, 0.22),
        false, false,
        0, h, angle + Math.PI * 0.5
      );
    }
    // 小さい丸い血だまり（ゆっくり落ちる円）
    const drops = Math.ceil(count * 0.3);
    for (let i = 0; i < drops; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(20, 80);
      this.emit(
        x + rand(-6, 6), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        1.0, rand(0, 0.04), 0,
        rand(2, 5), rand(0.4, 0.8),
        true, true
      );
    }
  }

  /** 火花 */
  spawnSpark(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(60, 200);
      this.emit(
        x, y,
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        1, rand(0.7, 1), rand(0, 0.3),
        rand(2, 4), rand(0.1, 0.25),
        false, true
      );
    }
  }

  /** 煙 */
  spawnSmoke(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const v = rand(0.4, 0.7);
      this.emit(
        x + rand(-12, 12), y + rand(-8, 8),
        rand(-20, 20), rand(20, 60),
        v, v, v,
        rand(10, 20), rand(0.5, 1.5),
        false, true
      );
    }
  }

  /** スコアポップアップ (小さい黄色い四角で代用) */
  spawnScorePop(x: number, y: number) {
    for (let i = 0; i < 4; i++) {
      this.emit(
        x + rand(-4, 4), y,
        rand(-10, 10), rand(40, 80),
        1, 1, 0,
        3, 0.8,
        false, true
      );
    }
  }

  /** ガラス破片 */
  spawnGlass(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(50, 180);
      this.emit(
        x + rand(-5, 5), y + rand(-5, 5),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        0.85, 0.95, 1.0,
        rand(2, 5), rand(0.3, 0.7),
        true, false, rand(-4, 4)
      );
    }
  }

  /** 水しぶき */
  spawnWater(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-0.8, 0.8); // mostly upward
      const spd = rand(60, 200);
      this.emit(
        x + rand(-4, 4), y,
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        0.30, 0.65, 1.0,
        rand(3, 6), rand(0.4, 0.9),
        true, true
      );
    }
  }

  /** 花びら */
  spawnFlower(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [0.95, 0.45, 0.70],
      [0.95, 0.90, 0.20],
      [1.00, 1.00, 1.00],
      [0.90, 0.50, 0.80],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(20, 80);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-6, 6), y + rand(-2, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd + 30,
        c[0], c[1], c[2],
        rand(3, 6), rand(0.6, 1.4),
        true, true, rand(-2, 2)
      );
    }
  }

  /** 紙吹雪 */
  spawnConfetti(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [1.0, 0.2, 0.2], [0.2, 0.6, 1.0], [0.2, 0.9, 0.2],
      [1.0, 0.9, 0.1], [0.9, 0.2, 0.9],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-1.2, 1.2);
      const spd = rand(50, 150);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-8, 8), y,
        Math.cos(angle) * spd + rand(-30, 30), Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(3, 6), rand(0.8, 1.5),
        true, false, rand(-5, 5)
      );
    }
  }

  /** 食べ物 */
  spawnFood(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [0.60, 0.35, 0.15], [0.95, 0.95, 0.88], [0.90, 0.20, 0.15], [0.95, 0.85, 0.10],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(40, 140);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-5, 5), y + rand(-5, 5),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(3, 7), rand(0.4, 0.9),
        true, false, rand(-4, 4)
      );
    }
  }

  /** 電気スパーク */
  spawnElectric(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [1.0, 0.95, 0.3], [1.0, 0.60, 0.1], [1.0, 1.0, 1.0],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(80, 250);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-3, 3), y + rand(-3, 3),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(2, 4), rand(0.05, 0.20),
        false, true
      );
    }
  }

  update(dt: number) {
    for (let i = 0; i < C.MAX_PARTICLES; i++) {
      if (this.state[i] === ST_DEAD) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.state[i] = ST_DEAD; continue; }
      if (this.gravity[i]) this.vy[i] -= 180 * dt; // 重力
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.rot[i] += this.rotV[i] * dt;
      // 減速
      this.vx[i] *= 1 - dt * 1.5;
      this.vy[i] *= 1 - dt * 0.8;
    }
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (let i = 0; i < C.MAX_PARTICLES; i++) {
      if (this.state[i] === ST_DEAD) continue;
      const t = this.life[i] / this.maxLife[i]; // 1→0
      const alpha = t;
      const sz = this.size[i] * (0.5 + 0.5 * t);
      const szH = this.sizeH[i] > 0 ? this.sizeH[i] * (0.5 + 0.5 * t) : sz;
      writeInst(buf, n++,
        this.px[i], this.py[i],
        sz, szH,
        this.r[i], this.g[i], this.b[i], alpha,
        this.rot[i], this.circle[i]
      );
    }
    return n - startIdx;
  }
}
