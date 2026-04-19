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

  /** 建物破片 — 中〜小サイズの瓦礫 (粉々に砕ける感) */
  spawnDebris(x: number, y: number, count: number, buildingR: number, buildingG: number, buildingB: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(120, 420);
      // たまに細長い破片を混ぜる (棒状コンクリ片) — 視覚的なバリエーション
      const elongated = Math.random() < 0.35;
      const w  = elongated ? rand(2.5, 5) : rand(5, 14);
      const hH = elongated ? rand(8, 18)  : 0;
      this.emit(
        x + rand(-22, 22), y + rand(-16, 16),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(30, 110),
        buildingR * rand(0.45, 1.1), buildingG * rand(0.45, 1.1), buildingB * rand(0.45, 1.1),
        w, rand(0.7, 1.5),
        true, false, rand(-14, 14), hH
      );
    }
  }

  /** 巨大瓦礫 — 大きな塊が回転しながら飛び散って落下 (建物ごとに数個) */
  spawnRubbleChunks(x: number, y: number, count: number, buildingR: number, buildingG: number, buildingB: number) {
    for (let i = 0; i < count; i++) {
      const angle = rand(-Math.PI, 0); // 主に上向き〜横へ放出
      const spd   = rand(140, 340);
      // 形状を3種混合 — 壁スラブ / 角ばったブロック / 柱の破片
      const shape = Math.random();
      let w: number, h: number;
      if (shape < 0.40) {        // スラブ (横長の壁片)
        w = rand(18, 32);
        h = rand(5, 11);
      } else if (shape < 0.78) { // ブロック (角ばった塊)
        w = rand(10, 18);
        h = rand(10, 18);
      } else {                   // ピラー (柱の破片)
        w = rand(6, 10);
        h = rand(18, 28);
      }
      // 色: 建物色 × コンクリ灰のブレンド (粉塵をかぶった瓦礫感)
      const blend = rand(0.30, 0.65);
      const tone  = rand(0.85, 1.05);
      const gray  = rand(0.50, 0.72);
      const r = (buildingR * tone) * (1 - blend) + gray * blend;
      const g = (buildingG * tone) * (1 - blend) + gray * blend;
      const b = (buildingB * tone) * (1 - blend) + gray * blend * 0.95;
      // ゴロンと残る塊感: 寿命長め + alpha フェード (noFade=false で半サイズまで残る)
      this.emit(
        x + rand(-12, 12), y + rand(-8, 8),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(50, 140),
        r, g, b,
        w, rand(1.4, 2.6),
        true, false, rand(-10, 10), h
      );
    }
    // 各塊から削れた小破片 (リアルな粉砕感)
    const chips = Math.ceil(count * 1.5);
    for (let i = 0; i < chips; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(120, 360);
      const tone  = rand(0.55, 1.0);
      const gray  = rand(0.55, 0.82);
      const blend = rand(0.4, 0.8);
      this.emit(
        x + rand(-10, 10), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(30, 100),
        (buildingR * tone) * (1 - blend) + gray * blend,
        (buildingG * tone) * (1 - blend) + gray * blend,
        (buildingB * tone) * (1 - blend) + gray * blend,
        rand(2, 5), rand(0.5, 1.1),
        true, false, rand(-14, 14)
      );
    }
  }

  /** 衝撃の砂塵リング — 着弾点から放射状に広がる大きな砂煙 */
  spawnImpactBurst(x: number, y: number, count: number) {
    // 外向きに広がる砂塵の輪 (重力なし・大きい円)
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + rand(-0.15, 0.15);
      const spd   = rand(140, 260);
      const br    = rand(0.62, 0.88);
      this.emit(
        x + rand(-3, 3), y + rand(-3, 3),
        Math.cos(angle) * spd, Math.sin(angle) * spd * 0.4,
        br, br * 0.95, br * 0.82,
        rand(10, 20), rand(0.5, 0.9),
        false, true
      );
    }
    // 中心の重い噴煙ドーム
    for (let i = 0; i < Math.ceil(count * 0.5); i++) {
      const v = rand(0.30, 0.55);
      this.emit(
        x + rand(-10, 10), y + rand(-5, 8),
        rand(-30, 30), rand(40, 110),
        v, v, v * 1.05,
        rand(14, 24), rand(0.8, 1.6),
        false, true
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

  /** 黒煙 — もくもくと立ち昇る濃い灰色〜黒の雲 */
  spawnSmoke(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const v = rand(0.18, 0.42);
      this.emit(
        x + rand(-10, 10), y + rand(-5, 5),
        rand(-25, 25), rand(30, 75),
        v, v, v * 1.05,
        rand(8, 16), rand(1.0, 2.2),
        false, true, rand(-0.6, 0.6)
      );
    }
  }

  /** 砂塵 — ベージュ色の粉塵が広がる */
  spawnDust(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd   = rand(40, 130);
      const br    = rand(0.70, 0.92);
      this.emit(
        x + rand(-8, 8), y + rand(-4, 4),
        Math.cos(angle) * spd, Math.sin(angle) * spd * 0.4 + rand(10, 35),
        br, br * 0.92, br * 0.78,
        rand(6, 14), rand(0.5, 1.2),
        false, true
      );
    }
  }

  /** 木っ端 — 茶色の細長い木片が回転しながら散る */
  spawnWoodChips(x: number, y: number, count: number) {
    const tones: Array<[number,number,number]> = [
      [0.55, 0.35, 0.18], [0.62, 0.42, 0.22], [0.45, 0.28, 0.14], [0.72, 0.55, 0.32],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(60, 220);
      const c = tones[Math.floor(Math.random() * tones.length)];
      this.emit(
        x + rand(-10, 10), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(20, 60),
        c[0], c[1], c[2],
        rand(2, 4), rand(0.5, 1.0),
        true, false, rand(-12, 12), rand(6, 14)
      );
    }
  }

  /** 落ち葉 — 緑〜黄〜橙の葉が舞い散る */
  spawnLeaves(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [0.32, 0.62, 0.22], [0.55, 0.75, 0.25], [0.85, 0.55, 0.15],
      [0.92, 0.72, 0.20], [0.70, 0.30, 0.10],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(20, 90);
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-12, 12), y + rand(-6, 8),
        Math.cos(angle) * spd, Math.sin(angle) * spd - rand(5, 25),
        c[0], c[1], c[2],
        rand(4, 7), rand(1.0, 2.2),
        true, false, rand(-3, 3), rand(2, 4)
      );
    }
  }

  /** 燃えさし — ふわふわ昇るオレンジ〜赤の小さな粒 */
  spawnEmbers(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.emit(
        x + rand(-8, 8), y + rand(-4, 4),
        rand(-25, 25), rand(40, 110),
        1.0, rand(0.45, 0.85), rand(0.05, 0.25),
        rand(2, 4), rand(0.7, 1.6),
        false, true
      );
    }
  }

  /** 歯車・ボルト — 銀色の小さな機械片 */
  spawnGears(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(70, 220);
      const br    = rand(0.55, 0.78);
      this.emit(
        x + rand(-8, 8), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(20, 60),
        br, br, br * 1.05,
        rand(3, 6), rand(0.5, 1.0),
        true, false, rand(-12, 12)
      );
    }
  }

  /** ピクセル — カラフルなドット (デジタル機器) */
  spawnPixels(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [1.0, 0.25, 0.45], [0.25, 0.85, 1.0], [0.45, 1.0, 0.35],
      [1.0, 0.85, 0.20], [0.75, 0.35, 1.0], [1.0, 1.0, 1.0],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(60, 220);
      const c = palette[Math.floor(Math.random() * palette.length)];
      const s = rand(2, 4);
      this.emit(
        x + rand(-6, 6), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        s, rand(0.3, 0.7),
        false, false, 0, s, 0
      );
    }
  }

  /** コイン — 金色の円が飛び散って落ちる */
  spawnCoins(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-1.0, 1.0);
      const spd   = rand(70, 180);
      const gold  = rand(0.85, 1.0);
      this.emit(
        x + rand(-8, 8), y,
        Math.cos(angle) * spd + rand(-30, 30), Math.sin(angle) * spd,
        gold, gold * 0.78, rand(0.05, 0.20),
        rand(3, 5), rand(0.8, 1.5),
        true, true
      );
    }
  }

  /** 麻雀牌・タイル — 白い小さな矩形 */
  spawnTiles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(60, 180);
      const tone  = rand(0.88, 0.98);
      this.emit(
        x + rand(-10, 10), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(20, 60),
        tone, tone, tone * 0.95,
        rand(3, 5), rand(0.6, 1.2),
        true, false, rand(-6, 6), rand(4, 6)
      );
    }
  }

  /** 麺 — 黄色い細長いストリーク (ラーメン) */
  spawnNoodles(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(50, 160);
      const w     = rand(1.5, 2.5);
      const h     = rand(8, 18);
      this.emit(
        x + rand(-6, 6), y + rand(-4, 4),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(15, 50),
        rand(0.95, 1.0), rand(0.85, 0.95), rand(0.35, 0.55),
        w, rand(0.5, 1.0),
        true, false, rand(-4, 4), h, angle + Math.PI * 0.5
      );
    }
  }

  /** ハート — ピンクの円 (ラブホ・スナック) */
  spawnHearts(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-0.9, 0.9);
      const spd   = rand(30, 90);
      this.emit(
        x + rand(-10, 10), y + rand(-6, 6),
        Math.cos(angle) * spd + rand(-20, 20), Math.sin(angle) * spd,
        rand(0.95, 1.0), rand(0.30, 0.55), rand(0.55, 0.78),
        rand(4, 7), rand(1.0, 2.0),
        false, true
      );
    }
  }

  /** ネオン破片 — 鮮やかなネオン色のガラス片 */
  spawnNeonShards(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [1.0, 0.20, 0.65], [0.20, 0.95, 1.0], [0.55, 0.20, 1.0],
      [0.20, 1.0, 0.55], [1.0, 0.85, 0.20],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(80, 240);
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-8, 8), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(2, 5), rand(0.4, 0.9),
        true, false, rand(-10, 10)
      );
    }
  }

  /** 米粒 — 白い小さなドット (寿司・和菓子) */
  spawnRice(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(40, 140);
      this.emit(
        x + rand(-5, 5), y + rand(-4, 4),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(10, 40),
        rand(0.94, 1.0), rand(0.94, 1.0), rand(0.86, 0.95),
        rand(1.5, 2.5), rand(0.5, 1.0),
        true, true
      );
    }
  }

  /** リボン・幟 — 細長いひらひらした布 */
  spawnRibbons(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [1.0, 0.25, 0.25], [1.0, 0.85, 0.25], [0.25, 0.65, 1.0],
      [1.0, 1.0, 1.0], [0.95, 0.45, 0.75],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 0.5 + rand(-1.1, 1.1);
      const spd   = rand(40, 120);
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-10, 10), y + rand(-4, 4),
        Math.cos(angle) * spd + rand(-25, 25), Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(2, 4), rand(1.0, 2.0),
        true, false, rand(-3, 3), rand(10, 18)
      );
    }
  }

  /** きらめき星 — 金色のスパークル (ランドマーク・お祝い) */
  spawnSparkle(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(40, 160);
      const palette: Array<[number,number,number]> = [
        [1.0, 0.95, 0.35], [1.0, 1.0, 0.85], [1.0, 0.78, 0.25],
      ];
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-8, 8), y + rand(-6, 6),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(3, 6), rand(0.5, 1.2),
        false, true
      );
    }
  }

  /** 花火 — 大きな多色の爆発 (カーニバル・フィナーレ) */
  spawnFireworks(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [1.0, 0.25, 0.25], [0.25, 0.55, 1.0], [0.95, 0.95, 0.20],
      [0.85, 0.25, 1.0], [0.25, 1.0, 0.55], [1.0, 1.0, 1.0],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(150, 380);
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-4, 4), y + rand(-4, 4),
        Math.cos(angle) * spd, Math.sin(angle) * spd,
        c[0], c[1], c[2],
        rand(3, 5), rand(0.7, 1.4),
        true, true
      );
    }
  }

  /** ピル・カプセル — カラフルな小さな丸薬 (薬局・病院) */
  spawnPills(x: number, y: number, count: number) {
    const palette: Array<[number,number,number]> = [
      [0.95, 0.30, 0.30], [0.30, 0.60, 0.95], [0.95, 0.85, 0.25],
      [0.95, 0.95, 0.95], [0.60, 0.95, 0.55],
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = rand(60, 170);
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.emit(
        x + rand(-6, 6), y + rand(-4, 4),
        Math.cos(angle) * spd, Math.sin(angle) * spd + rand(15, 45),
        c[0], c[1], c[2],
        rand(2.5, 4), rand(0.5, 1.0),
        true, true
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
