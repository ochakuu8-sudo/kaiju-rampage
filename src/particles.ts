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
  noFade:  Uint8Array = new Uint8Array(C.MAX_PARTICLES); // alpha固定、サイズで消える
  rot:  Float32Array = new Float32Array(C.MAX_PARTICLES);
  rotV: Float32Array = new Float32Array(C.MAX_PARTICLES);
  state: Uint8Array = new Uint8Array(C.MAX_PARTICLES);

  // アクティブリスト + フリースタック
  private activeIndices: Uint16Array = new Uint16Array(C.MAX_PARTICLES);
  private activeLen = 0;
  private freeStack: Uint16Array = (() => {
    const a = new Uint16Array(C.MAX_PARTICLES);
    for (let i = 0; i < C.MAX_PARTICLES; i++) a[i] = C.MAX_PARTICLES - 1 - i;
    return a;
  })();
  private freeLen = C.MAX_PARTICLES;

  reset() {
    this.state.fill(ST_DEAD);
    this.activeLen = 0;
    this.freeLen = C.MAX_PARTICLES;
    for (let i = 0; i < C.MAX_PARTICLES; i++) this.freeStack[i] = C.MAX_PARTICLES - 1 - i;
  }

  private alloc(): number {
    if (this.freeLen > 0) {
      return this.freeStack[--this.freeLen];
    }
    // 満杯: activeIndices の先頭を強制解放
    const evict = this.activeIndices[0];
    this.activeIndices[0] = this.activeIndices[--this.activeLen];
    this.state[evict] = ST_DEAD;
    return evict;
  }

  private emit(
    x: number, y: number,
    vx: number, vy: number,
    r: number, g: number, b: number,
    size: number, life: number,
    useGravity: boolean, isCircle: boolean,
    rotV = 0, sizeH = 0, fixedRot?: number, noFade = false
  ) {
    const i = this.alloc();
    this.state[i] = ST_ALIVE;
    this.activeIndices[this.activeLen++] = i;
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
    this.noFade[i]  = noFade ? 1 : 0;
    this.rot[i]     = fixedRot !== undefined ? fixedRot : Math.random() * Math.PI * 2;
    this.rotV[i]    = rotV;
  }

  /** 建物破片 */
  spawnDebris(x: number, y: number, count: number, buildingR: number, buildingG: number, buildingB: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(80, 320);
      this.emit(
        x + rand(-22, 22), y + rand(-16, 16),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(30, 100),
        buildingR * rand(0.45, 1.1), buildingG * rand(0.45, 1.1), buildingB * rand(0.45, 1.1),
        rand(5, 16), rand(0.55, 1.3),
        true, false, rand(-10, 10)
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
      const w     = rand(2, 5);
      const h     = rand(8, 20);
      this.emit(
        x + rand(-3, 3), y + rand(-3, 3),
        vx, vy,
        1.0, 0, 0,
        w, rand(0.25, 0.55),
        true, false,
        0, h, angle + Math.PI * 0.5, true
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
        1.0, 0, 0,
        w, rand(0.08, 0.22),
        false, false,
        0, h, angle + Math.PI * 0.5, true
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
        1.0, 0, 0,
        rand(2, 5), rand(0.4, 0.8),
        true, true,
        0, 0, undefined, true
      );
    }
  }

  /** 火花 */
  spawnSpark(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(120, 420);
      this.emit(
        x + rand(-6, 6), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        1, rand(0.65, 1), rand(0, 0.2),
        rand(2, 5), rand(0.12, 0.32),
        true, true  // 重力あり → 弧を描いて落ちる
      );
    }
  }

  /** 爆発炎 — 3層構成の炎ストリーク */
  spawnFire(x: number, y: number, count: number) {
    // ── Layer 1: 白熱コア (細い縦ストリーク・最速・短命) ──
    const core = Math.ceil(count * 0.28);
    for (let i = 0; i < core; i++) {
      const angle = Math.PI * 0.5 + rand(-0.35, 0.35);
      const spd   = rand(120, 320);
      const w     = rand(2, 5);
      const h     = rand(18, 40);
      this.emit(
        x + rand(-7, 7), y + rand(-5, 5),
        Math.cos(angle) * spd + rand(-20, 20), Math.sin(angle) * spd,
        1.0, rand(0.88, 1.0), rand(0.55, 0.85),   // 白〜黄
        w, rand(0.10, 0.24),
        false, false, 0, h, angle + Math.PI * 0.5, true  // 速度方向ストリーク・noFade
      );
    }

    // ── Layer 2: オレンジ炎ストリーク (中速・中寿命) ──────
    const mid = Math.ceil(count * 0.50);
    for (let i = 0; i < mid; i++) {
      const angle = Math.PI * 0.5 + rand(-0.62, 0.62);
      const spd   = rand(70, 210);
      const w     = rand(3, 9);
      const h     = rand(22, 52);
      this.emit(
        x + rand(-12, 12), y + rand(-8, 8),
        Math.cos(angle) * spd + rand(-40, 40), Math.sin(angle) * spd,
        1.0, rand(0.32, 0.62), rand(0.0, 0.04),   // オレンジ〜赤橙
        w, rand(0.16, 0.36),
        false, false, 0, h, angle + Math.PI * 0.5, true
      );
    }

    // ── Layer 3: 赤い外炎 (遅い・ふわっとした円) ─────────
    const outer = count - core - mid;
    for (let i = 0; i < outer; i++) {
      const angle = Math.PI * 0.5 + rand(-0.85, 0.85);
      const spd   = rand(25, 110);
      this.emit(
        x + rand(-16, 16), y + rand(-10, 10),
        Math.cos(angle) * spd + rand(-45, 45), Math.sin(angle) * spd,
        rand(0.88, 1.0), rand(0.08, 0.25), 0.0,   // 赤
        rand(5, 13), rand(0.18, 0.38),
        false, true   // 丸いグローで輪郭をソフトに
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

  /** 蒸気 — ゆっくり上昇する白/灰色の円 */
  spawnSteam(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const spd = rand(20, 60);
      this.emit(
        x + rand(-8, 8), y,
        rand(-15, 15), spd,
        rand(0.72, 0.90), rand(0.72, 0.90), rand(0.75, 0.92),
        rand(5, 12), rand(0.6, 1.4),
        false, true, 0
      );
    }
  }

  /** 桜の花びら — ピンク/白のゆっくり舞い散る円 */
  spawnSakuraPetals(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(15, 50);
      const r = rand(0.90, 1.0), g = rand(0.65, 0.82), b = rand(0.75, 0.92);
      this.emit(
        x + rand(-20, 20), y + rand(-10, 10),
        Math.cos(angle) * spd + rand(-10, 10), Math.sin(angle) * spd - rand(5, 20),
        r, g, b,
        rand(3, 6), rand(1.0, 2.5),
        true, true, rand(-1.5, 1.5)
      );
    }
  }

  /** 金属破片 — 重い銀/灰色の破片 */
  spawnMetalDebris(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(60, 200);
      const br = rand(0.55, 0.80);
      this.emit(
        x + rand(-15, 15), y + rand(-10, 10),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(20, 60),
        br, br * 0.98, br * 0.95,
        rand(4, 10), rand(0.4, 1.0),
        true, false, rand(-8, 8)
      );
    }
  }

  /** 紙幣 — 緑/白のひらひら舞う紙片 */
  spawnCash(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-0.8, 0.8);
      const spd = rand(40, 120);
      const isGreen = Math.random() < 0.7;
      const r = isGreen ? rand(0.55, 0.72) : 0.95;
      const g = isGreen ? rand(0.72, 0.88) : 0.95;
      const b2 = isGreen ? rand(0.42, 0.58) : 0.88;
      this.emit(
        x + rand(-10, 10), y,
        Math.cos(angle) * spd + rand(-30, 30), Math.sin(angle) * spd,
        r, g, b2,
        rand(5, 9), rand(0.8, 1.6),
        true, false, rand(-4, 4), rand(4, 7)
      );
    }
  }

  /** 本 — 茶/白の矩形が飛び散る */
  spawnBooks(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [0.55, 0.28, 0.12], [0.15, 0.28, 0.65], [0.62, 0.12, 0.15],
      [0.88, 0.85, 0.78], [0.18, 0.48, 0.25],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = rand(50, 180);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-12, 12), y + rand(-8, 8),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(20, 50),
        c[0], c[1], c[2],
        rand(5, 9), rand(0.5, 1.0),
        true, false, rand(-6, 6), rand(3, 7)
      );
    }
  }

  /** 泡 — 半透明の小さい円がゆっくり上昇 */
  spawnBubbles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const spd = rand(20, 60);
      this.emit(
        x + rand(-12, 12), y + rand(-5, 5),
        rand(-20, 20), spd,
        0.62, 0.88, 1.0,
        rand(3, 7), rand(0.5, 1.2),
        false, true
      );
    }
  }

  /** ポップコーン — 白/黄色の小粒が飛び散る */
  spawnPopcorn(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-1.0, 1.0);
      const spd = rand(60, 160);
      const isWhite = Math.random() < 0.6;
      const r = isWhite ? 0.95 : 0.95, g = isWhite ? 0.92 : 0.85, b = isWhite ? 0.85 : 0.35;
      this.emit(
        x + rand(-8, 8), y,
        Math.cos(angle) * spd + rand(-40, 40), Math.sin(angle) * spd,
        r, g, b,
        rand(3, 5), rand(0.6, 1.2),
        true, true
      );
    }
  }

  /** 風船 — カラフルな円がゆっくり上昇 */
  spawnBalloons(x: number, y: number, count: number) {
    const colors: Array<[number,number,number]> = [
      [0.95, 0.22, 0.22], [0.22, 0.52, 0.95], [0.22, 0.88, 0.35],
      [0.95, 0.88, 0.10], [0.88, 0.22, 0.88],
    ];
    for (let i = 0; i < count; i++) {
      const spd = rand(15, 45);
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.emit(
        x + rand(-15, 15), y + rand(-5, 5),
        rand(-15, 15), spd,
        c[0], c[1], c[2],
        rand(6, 11), rand(1.5, 3.0),
        false, true
      );
    }
  }

  update(dt: number) {
    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.state[i] = ST_DEAD;
        this.freeStack[this.freeLen++] = i;
        this.activeIndices[k] = this.activeIndices[--this.activeLen];
        k--;
        continue;
      }
      if (this.gravity[i]) this.vy[i] -= 180 * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.rot[i] += this.rotV[i] * dt;
      this.vx[i] *= 1 - dt * 1.5;
      this.vy[i] *= 1 - dt * 0.8;
    }
  }

  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 50;
    const camTop = cameraY + C.WORLD_MAX_Y + 50;
    for (let k = 0; k < this.activeLen; k++) {
      const i = this.activeIndices[k];
      if (this.py[i] < camBot || this.py[i] > camTop) continue;
      const t = this.life[i] / this.maxLife[i]; // 1→0
      let alpha: number;
      let sz: number;
      let szH: number;
      if (this.noFade[i]) {
        // alpha固定・サイズが縮んで消える
        alpha = 1.0;
        sz  = this.size[i]  * t;
        szH = this.sizeH[i] > 0 ? this.sizeH[i] * t : sz;
      } else {
        alpha = t;
        sz  = this.size[i]  * (0.5 + 0.5 * t);
        szH = this.sizeH[i] > 0 ? this.sizeH[i] * (0.5 + 0.5 * t) : sz;
      }
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
