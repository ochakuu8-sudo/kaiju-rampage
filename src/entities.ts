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
    this.vx = 2;    // 右方向（坂を滑り降りてフリッパーへ）
    this.vy = -1;
    this.active = true;
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
  pivotX: number;  // 固定ピボット座標（坂との接合点）
  pivotY: number;
  cx: number;      // OBB中心X（動的、ピボット+アーム方向で計算）
  cy: number;      // OBB中心Y（動的）
  angle: number;   // 現在の角度 (radians): アーム方向 = (cos(angle), sin(angle))
  targetAngle: number;
  angularVel = 0;
  pressed = false;

  constructor(isLeft: boolean) {
    this.isLeft = isLeft;
    // ピボットは坂の接合点: 左=(-85,-165), 右=(+85,-165)
    this.pivotX = isLeft ? -C.FLIPPER_PIVOT_X : C.FLIPPER_PIVOT_X;
    this.pivotY = C.FLIPPER_PIVOT_Y;

    // 左: rest=-30°, right: rest=210°(=180-(-30))
    const restDeg = isLeft ? C.FLIPPER_REST_DEG : (180 - C.FLIPPER_REST_DEG);
    this.angle       = restDeg * Math.PI / 180;
    this.targetAngle = this.angle;

    // 初期OBB中心を計算
    const arm = C.FLIPPER_W / 2;
    this.cx = this.pivotX + arm * Math.cos(this.angle);
    this.cy = this.pivotY + arm * Math.sin(this.angle);
  }

  setPressed(v: boolean) {
    this.pressed = v;
    // 左: active=+30°, rest=-30°
    // 右: active=150°(=180-30), rest=210°(=180-(-30))
    const targetDeg = this.isLeft
      ? (v ? C.FLIPPER_ACTIVE_DEG : C.FLIPPER_REST_DEG)
      : (v ? (180 - C.FLIPPER_ACTIVE_DEG) : (180 - C.FLIPPER_REST_DEG));
    this.targetAngle = targetDeg * Math.PI / 180;
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
    // OBB中心をピボット+アーム半分で更新
    const arm = C.FLIPPER_W / 2;
    this.cx = this.pivotX + arm * Math.cos(this.angle);
    this.cy = this.pivotY + arm * Math.sin(this.angle);
  }

  /** OBBを返す（中心は動的計算済み） */
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
    // pressed かつ上向きに振っている間だけ強打ち出し
    // 左: angle増加（-30°→+30°）→ angularVel>0
    // 右: angle減少（210°→150°）→ angularVel<0
    const isRising = this.pressed && (
      this.isLeft ? this.angularVel > 0.5 : this.angularVel < -0.5
    );
    if (!isRising) return [vx, vy];

    // フリッパー上面の法線
    // 左: (-sin(angle),  cos(angle))  = 90°CCW from arm
    // 右: ( sin(angle), -cos(angle))  = 90°CW  from arm
    const s = Math.sin(this.angle);
    const c = Math.cos(this.angle);
    let nx = this.isLeft ? -s :  s;
    let ny = this.isLeft ?  c : -c;
    if (ny < 0.3) ny = 0.3; // 必ず上向き成分を確保
    const len = Math.sqrt(nx * nx + ny * ny);
    const power = C.FLIPPER_POWER * (1.0 + Math.abs(this.angularVel) * 0.01);
    return [(nx / len) * power, (ny / len) * power];
  }
}

// ===== BUILDING =====

const BUILDING_PALETTES: ReadonlyArray<readonly [number,number,number]> = [
  [0.55, 0.55, 0.60], // コンクリートグレー
  [0.45, 0.35, 0.30], // レンガ茶
  [0.30, 0.40, 0.50], // ガラス青
  [0.50, 0.45, 0.35], // サンドベージュ
  [0.60, 0.60, 0.55], // 明るいグレー
  [0.35, 0.35, 0.45], // スレートブルー
  [0.50, 0.38, 0.35], // テラコッタ
];

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
  baseColor: readonly [number,number,number];
}

export class BuildingManager {
  buildings: BuildingData[] = [];

  load(defs: Array<{ x: number; y: number; size: C.BuildingSize }>) {
    this.buildings = [];
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      const baseColor = BUILDING_PALETTES[Math.floor(Math.random() * BUILDING_PALETTES.length)];
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
        baseColor,
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
      const scale = b.destroyTimer > 0 ? Math.max(0, b.destroyTimer / 0.2) : 1;

      let cr: number, cg: number, cb: number;
      if (b.flashTimer > 0) {
        cr = cg = cb = 1.0;
      } else {
        const dmgRatio = 1 - b.hp / b.maxHp;
        const darken   = 1 - dmgRatio * 0.4;
        const redShift = dmgRatio * 0.15;
        cr = Math.min(1, b.baseColor[0] * darken + redShift);
        cg = b.baseColor[1] * darken;
        cb = b.baseColor[2] * darken;
      }

      const drawW = b.w * scale;
      const drawH = b.h * scale;
      const drawX = b.x + b.w / 2;
      const drawY = b.y + b.h / 2;
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

