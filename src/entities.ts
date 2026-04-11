/**
 * entities.ts — Ball, Flipper, Building, Bumper
 */

import * as C from './constants';
import {
  resolveCircleAABB, resolveCircleOBB, resolveBumper,
  circleAABB, circleOBBOverlap, circleCircle, clampSpeed, rand, randInt
} from './physics';
import { writeInst, INST_F } from './renderer';

// ===== BALL =====

export class Ball {
  x = C.BALL_START_X;
  y = C.BALL_START_Y;
  vx = 0;
  vy = 0;
  active = true;
  // トレイル: リングバッファ
  trail: Float32Array = new Float32Array(C.TRAIL_LEN * 2);
  trailHead = 0;

  reset() {
    this.x = C.BALL_START_X;
    this.y = C.BALL_START_Y;
    this.vx = 0;
    this.vy = 0;
    this.active = true;
    this.trail.fill(C.BALL_START_X);
    for (let i = 0; i < C.TRAIL_LEN; i++) {
      this.trail[i * 2]     = C.BALL_START_X;
      this.trail[i * 2 + 1] = C.BALL_START_Y;
    }
    this.trailHead = 0;
  }

  /** トレイルに現在位置を記録 */
  recordTrail() {
    this.trail[this.trailHead * 2]     = this.x;
    this.trail[this.trailHead * 2 + 1] = this.y;
    this.trailHead = (this.trailHead + 1) % C.TRAIL_LEN;
  }

  /** 速さを返す */
  speed(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }
}

// ===== FLIPPER =====

export class Flipper {
  isLeft: boolean;
  cx: number;
  cy = C.FLIPPER_Y;
  angle: number;           // 現在の角度 (radians)
  targetAngle: number;
  angularVel = 0;
  pressed = false;

  constructor(isLeft: boolean) {
    this.isLeft = isLeft;
    this.cx = isLeft ? C.FLIPPER_LEFT_X : C.FLIPPER_RIGHT_X;
    const restRad = (C.FLIPPER_REST_DEG * Math.PI / 180) * (isLeft ? 1 : -1);
    this.angle       = restRad;
    this.targetAngle = restRad;
  }

  setPressed(v: boolean) {
    this.pressed = v;
    const activeDeg = C.FLIPPER_ACTIVE_DEG * (this.isLeft ? 1 : -1);
    const restDeg   = C.FLIPPER_REST_DEG   * (this.isLeft ? 1 : -1);
    this.targetAngle = (v ? activeDeg : restDeg) * Math.PI / 180;
  }

  update(dt: number) {
    const speedRad = C.FLIPPER_SPEED_DEG * Math.PI / 180;
    const diff = this.targetAngle - this.angle;
    const maxStep = speedRad * dt;
    this.angularVel = Math.sign(diff) * Math.min(Math.abs(diff), maxStep) / dt;
    if (Math.abs(diff) <= maxStep) {
      this.angle = this.targetAngle;
      this.angularVel = 0;
    } else {
      this.angle += Math.sign(diff) * maxStep;
    }
  }

  /** OBBを返す */
  getOBB() {
    return {
      cx:    this.cx,
      cy:    this.cy,
      hw:    C.FLIPPER_W / 2,
      hh:    C.FLIPPER_H / 2,
      angle: this.angle,
    };
  }

  /** ボールにフリッパー速度を付与 */
  applyImpulse(vx: number, vy: number): [number, number] {
    // 上昇中の場合のみ強く打ち出し
    const isRising = this.isLeft
      ? this.angularVel > 10
      : this.angularVel < -10;

    const power = isRising
      ? C.FLIPPER_POWER * (1 + Math.abs(this.angularVel) * 0.015)
      : C.FLIPPER_POWER * 0.6;

    // フリッパー角から打ち出し方向を計算
    const a = this.angle + (this.isLeft ? -Math.PI * 0.1 : Math.PI * 0.1);
    const nx = -Math.sin(a);
    const ny =  Math.cos(a) * (this.isLeft ? 1 : -1) + 1;

    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    const nvx = (nx / len) * power;
    const nvy = Math.abs(ny / len) * power; // 常に上向き成分を保証

    return [nvx, nvy];
  }
}

// ===== BUILDING =====

export interface BuildingData {
  x: number;    // 左端
  y: number;    // 下端
  w: number;
  h: number;
  maxHp: number;
  hp: number;
  score: number;
  humanMin: number;
  humanMax: number;
  active: boolean;
  destroyTimer: number; // >0 = 崩壊アニメ中
  flashTimer: number;   // ヒット時フラッシュ
}

export class BuildingManager {
  buildings: BuildingData[] = [];

  load(defs: Array<{ x: number; y: number; size: C.BuildingSize }>) {
    this.buildings = [];
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      this.buildings.push({
        x: d.x - def.w / 2,
        y: d.y,
        w: def.w, h: def.h,
        maxHp: def.hp, hp: def.hp,
        score: def.score,
        humanMin: def.humanMin,
        humanMax: def.humanMax,
        active: true,
        destroyTimer: 0,
        flashTimer: 0,
      });
    }
  }

  allDestroyed(): boolean {
    return this.buildings.every(b => !b.active);
  }

  update(dt: number) {
    for (const b of this.buildings) {
      if (b.flashTimer > 0) b.flashTimer -= dt;
      if (b.destroyTimer > 0) {
        b.destroyTimer -= dt;
        if (b.destroyTimer <= 0) b.active = false;
      }
    }
  }

  /**
   * ボールとの衝突判定
   * @returns ヒットした建物データ or null
   */
  checkBallHit(
    bx: number, by: number, br: number,
    vx: number, vy: number
  ): { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null {
    for (const b of this.buildings) {
      if (!b.active || b.destroyTimer > 0) continue;
      const res = resolveCircleAABB(bx, by, br, vx, vy, b.x, b.y, b.w, b.h);
      if (res) {
        return { bld: b, newBx: res[0], newBy: res[1], newVx: res[2], newVy: res[3] };
      }
    }
    return null;
  }

  /** 建物にダメージを与え、破壊されたら destroyTimer セット */
  damage(b: BuildingData): boolean {
    b.hp--;
    b.flashTimer = 0.08;
    if (b.hp <= 0) {
      b.destroyTimer = 0.2;
      return true; // 破壊
    }
    return false;
  }

  /** インスタンスバッファへ書き込み、書いた数を返す */
  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const b of this.buildings) {
      if (!b.active) continue;
      const scale = b.destroyTimer > 0
        ? Math.max(0, b.destroyTimer / 0.2)
        : 1;
      // HP で色を暗くする（ヒビ表現）
      const dmgRatio = b.hp / b.maxHp;
      const bright = b.flashTimer > 0 ? 1.0 : (0.45 + dmgRatio * 0.45);
      // 建物サイズで色相を変える
      const hue = (b.w * 3.7 + b.y * 1.1) % 1.0;
      const [cr, cg, cb] = hsvToRgb(hue, 0.55, bright);
      const drawW = b.w * scale;
      const drawH = b.h * scale;
      const drawX = b.x + b.w / 2; // 中心X
      const drawY = b.y + b.h / 2; // 中心Y
      writeInst(buf, n++, drawX, drawY, drawW, drawH, cr, cg, cb, 1, 0, 0);
    }
    return n - startIdx;
  }
}

// ===== BUMPER =====

export interface BumperData {
  x: number;
  y: number;
  r: number;
  flashTimer: number;
}

export class BumperManager {
  bumpers: BumperData[] = [];

  load(defs: Array<{ x: number; y: number }>) {
    this.bumpers = defs.map(d => ({ x: d.x, y: d.y, r: C.BUMPER_RADIUS, flashTimer: 0 }));
  }

  update(dt: number) {
    for (const b of this.bumpers) {
      if (b.flashTimer > 0) b.flashTimer -= dt;
    }
  }

  checkBallHit(
    bx: number, by: number, br: number,
    vx: number, vy: number
  ): { bump: BumperData; newBx: number; newBy: number; newVx: number; newVy: number } | null {
    for (const b of this.bumpers) {
      if (circleCircle(bx, by, br, b.x, b.y, b.r)) {
        const [nbx, nby, nvx, nvy] = resolveBumper(bx, by, br, vx, vy, b.x, b.y, b.r, C.BUMPER_FORCE);
        b.flashTimer = 0.1;
        return { bump: b, newBx: nbx, newBy: nby, newVx: nvx, newVy: nvy };
      }
    }
    return null;
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const b of this.bumpers) {
      const glow = b.flashTimer > 0 ? 1.0 : 0.0;
      writeInst(buf, n++, b.x, b.y, b.r * 2, b.r * 2, 0.3 + glow * 0.6, 0.6 + glow * 0.4, 1.0, 1, 0, 1);
    }
    return n - startIdx;
  }
}

// ===== HSV→RGB ユーティリティ =====
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
