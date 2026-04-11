/**
 * entities.ts — Ball, Flipper, Building, Bumper, Furniture
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
    const isRising = this.pressed && (
      this.isLeft ? this.angularVel > 0.5 : this.angularVel < -0.5
    );
    if (!isRising) return [vx, vy];

    const s = Math.sin(this.angle);
    const c = Math.cos(this.angle);
    let nx = this.isLeft ? -s :  s;
    let ny = this.isLeft ?  c : -c;
    if (ny < 0.3) ny = 0.3;
    const len = Math.sqrt(nx * nx + ny * ny);
    const power = C.FLIPPER_POWER * (1.0 + Math.abs(this.angularVel) * 0.01);
    return [(nx / len) * power, (ny / len) * power];
  }
}

// ===== BUILDING =====

const BUILDING_PALETTES: ReadonlyArray<readonly [number,number,number]> = [
  [0.92, 0.90, 0.85], // cream white
  [0.85, 0.75, 0.65], // sand beige
  [0.70, 0.82, 0.92], // pastel blue
  [0.80, 0.70, 0.60], // terracotta
  [0.75, 0.85, 0.70], // mint green
  [0.88, 0.82, 0.75], // warm grey
  [0.82, 0.78, 0.90], // lavender
  [0.90, 0.85, 0.70], // butter
  [0.95, 0.88, 0.80], // peach
  [0.78, 0.80, 0.85], // cool grey
];

// Type-specific base colors for new building types
const BUILDING_TYPE_COLORS: Partial<Record<C.BuildingSize, readonly [number,number,number]>> = {
  convenience: [0.95, 0.95, 0.90],
  restaurant:  [0.85, 0.70, 0.55],
  school:      [0.80, 0.85, 0.75],
  hospital:    [0.95, 0.95, 0.98],
  temple:      [0.80, 0.55, 0.35],
  parking:     [0.60, 0.60, 0.65],
};

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
  size: C.BuildingSize;
}

export class BuildingManager {
  buildings: BuildingData[] = [];

  load(defs: Array<{ x: number; y: number; size: C.BuildingSize }>) {
    this.buildings = [];
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      const baseColor = BUILDING_TYPE_COLORS[d.size] ??
        BUILDING_PALETTES[Math.floor(Math.random() * BUILDING_PALETTES.length)];
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
        size: d.size,
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
  tempBumpers: Array<{ x: number; y: number; r: number; ttl: number; flashTimer: number }> = [];

  load(defs: Array<{ x: number; y: number }>) {
    this.bumpers = defs.map(d => ({ x: d.x, y: d.y, r: C.BUMPER_RADIUS, flashTimer: 0 }));
    this.tempBumpers = [];
  }

  addTemporaryBumper(x: number, y: number, duration: number) {
    this.tempBumpers.push({ x, y, r: C.BUMPER_RADIUS, ttl: duration, flashTimer: 0 });
  }

  update(dt: number) {
    for (const b of this.bumpers) {
      if (b.flashTimer > 0) b.flashTimer -= dt;
    }
    for (let i = this.tempBumpers.length - 1; i >= 0; i--) {
      this.tempBumpers[i].ttl -= dt;
      if (this.tempBumpers[i].ttl <= 0) {
        this.tempBumpers.splice(i, 1);
      } else if (this.tempBumpers[i].flashTimer > 0) {
        this.tempBumpers[i].flashTimer -= dt;
      }
    }
  }

  checkBallHit(
    bx: number, by: number, br: number,
    vx: number, vy: number
  ): { bump: BumperData; newBx: number; newBy: number; newVx: number; newVy: number } | null {
    // Check permanent bumpers
    for (const b of this.bumpers) {
      if (circleCircle(bx, by, br, b.x, b.y, b.r)) {
        const [nbx, nby, nvx, nvy] = resolveBumper(bx, by, br, vx, vy, b.x, b.y, b.r, C.BUMPER_FORCE);
        b.flashTimer = 0.1;
        return { bump: b, newBx: nbx, newBy: nby, newVx: nvx, newVy: nvy };
      }
    }
    // Check temporary bumpers
    for (const tb of this.tempBumpers) {
      if (circleCircle(bx, by, br, tb.x, tb.y, tb.r)) {
        const [nbx, nby, nvx, nvy] = resolveBumper(bx, by, br, vx, vy, tb.x, tb.y, tb.r, C.BUMPER_FORCE);
        tb.flashTimer = 0.1;
        return { bump: { x: tb.x, y: tb.y, r: tb.r, flashTimer: tb.flashTimer }, newBx: nbx, newBy: nby, newVx: nvx, newVy: nvy };
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
    for (const tb of this.tempBumpers) {
      const glow = tb.flashTimer > 0 ? 1.0 : 0.0;
      // Temp bumpers are cyan/teal colored
      writeInst(buf, n++, tb.x, tb.y, tb.r * 2, tb.r * 2, 0.2 + glow * 0.6, 0.9, 0.8 + glow * 0.2, 0.85, 0, 1);
    }
    return n - startIdx;
  }
}

// ===== STREET FURNITURE =====

export type FurnitureType = 'tree' | 'vending' | 'bench' | 'car' | 'traffic_light' | 'mailbox' | 'bicycle' | 'flower_bed' | 'parasol' | 'sign_board' | 'garbage' | 'power_pole' | 'hydrant' | 'fountain';

export interface FurnitureItem {
  type: FurnitureType;
  x: number;
  y: number;
  hp: number;
  active: boolean;
  score: number;
  // traffic light
  lightTimer: number;
  lightState: number; // 0=red, 1=yellow, 2=green
}

// AABB half-sizes for each furniture type
const FURNITURE_HW: Record<FurnitureType, number> = {
  tree:          C.TREE_W / 2,
  vending:       C.VENDING_W / 2,
  bench:         C.BENCH_W / 2,
  car:           C.CAR_W / 2,
  traffic_light: C.TRAFFIC_LIGHT_W / 2,
  mailbox:       C.MAILBOX_W / 2,
  bicycle:       5,
  flower_bed:    6,
  parasol:       5,
  sign_board:    3,
  garbage:       3,
  power_pole:    1.5,
  hydrant:       2,
  fountain:      8,
};
const FURNITURE_HH: Record<FurnitureType, number> = {
  tree:          C.TREE_H / 2,
  vending:       C.VENDING_H / 2,
  bench:         C.BENCH_H / 2,
  car:           C.CAR_H / 2,
  traffic_light: C.TRAFFIC_LIGHT_H / 2,
  mailbox:       C.MAILBOX_H / 2,
  bicycle:       3,
  flower_bed:    2.5,
  parasol:       5,
  sign_board:    6,
  garbage:       3,
  power_pole:    9,
  hydrant:       2.5,
  fountain:      5,
};

// Traffic light cycle durations per state (seconds)
const LIGHT_DURATIONS = [3.0, 0.8, 3.0]; // red, yellow, green

export class FurnitureManager {
  items: FurnitureItem[] = [];

  load(defs: Array<{ type: FurnitureType; x: number; y: number; hp?: number; score?: number }>) {
    this.items = [];
    for (const d of defs) {
      this.items.push({
        type: d.type,
        x: d.x,
        y: d.y,
        hp: d.hp ?? 1,
        active: true,
        score: d.score ?? 50,
        lightTimer: LIGHT_DURATIONS[0],
        lightState: 0,
      });
    }
  }

  update(dt: number) {
    for (const item of this.items) {
      if (!item.active) continue;
      if (item.type === 'traffic_light') {
        item.lightTimer -= dt;
        if (item.lightTimer <= 0) {
          item.lightState = (item.lightState + 1) % 3;
          item.lightTimer = LIGHT_DURATIONS[item.lightState];
        }
      }
    }
  }

  checkBallHit(bx: number, by: number, br: number): FurnitureItem | null {
    for (const item of this.items) {
      if (!item.active) continue;
      // Skip trees (non-destructible, but collideable)
      if (item.type === 'tree') continue;
      const hw = FURNITURE_HW[item.type];
      const hh = FURNITURE_HH[item.type];
      // Circle vs AABB
      const nearX = Math.max(item.x - hw, Math.min(bx, item.x + hw));
      const nearY = Math.max(item.y - hh, Math.min(by, item.y + hh));
      const dx = bx - nearX, dy = by - nearY;
      if (dx * dx + dy * dy < br * br) {
        return item;
      }
    }
    return null;
  }

  damage(item: FurnitureItem): boolean {
    item.hp--;
    if (item.hp <= 0) {
      item.active = false;
      return true;
    }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const item of this.items) {
      if (!item.active) continue;

      switch (item.type) {
        case 'tree': {
          // Trunk
          writeInst(buf, n++, item.x, item.y - C.TREE_H * 0.25, 3, C.TREE_H * 0.5,
            0.35, 0.22, 0.10, 1);
          // Foliage (circle)
          const fr = C.TREE_W * 0.7;
          writeInst(buf, n++, item.x, item.y + C.TREE_H * 0.2, fr * 2, fr * 2,
            0.15, 0.45, 0.15, 1, 0, 1);
          break;
        }
        case 'vending': {
          // Body
          writeInst(buf, n++, item.x, item.y, C.VENDING_W, C.VENDING_H,
            0.2, 0.5, 0.8, 1);
          // Front stripe
          writeInst(buf, n++, item.x, item.y - 1, C.VENDING_W, 3,
            1.0, 0.2, 0.2, 1);
          break;
        }
        case 'bench': {
          // Seat
          writeInst(buf, n++, item.x, item.y, C.BENCH_W, 2,
            0.45, 0.30, 0.15, 1);
          // Legs
          writeInst(buf, n++, item.x - C.BENCH_W * 0.3, item.y - 2, 2, 3,
            0.35, 0.22, 0.10, 1);
          writeInst(buf, n++, item.x + C.BENCH_W * 0.3, item.y - 2, 2, 3,
            0.35, 0.22, 0.10, 1);
          break;
        }
        case 'car': {
          // Car body (bottom)
          writeInst(buf, n++, item.x, item.y - 1, C.CAR_W, C.CAR_H * 0.55,
            0.3, 0.55, 0.75, 1);
          // Car top
          writeInst(buf, n++, item.x, item.y + C.CAR_H * 0.2, C.CAR_W * 0.65, C.CAR_H * 0.45,
            0.25, 0.45, 0.65, 1);
          // Windows
          writeInst(buf, n++, item.x, item.y + C.CAR_H * 0.22, C.CAR_W * 0.5, C.CAR_H * 0.3,
            0.65, 0.85, 0.95, 0.8);
          break;
        }
        case 'traffic_light': {
          // Pole
          writeInst(buf, n++, item.x, item.y - C.TRAFFIC_LIGHT_H * 0.1,
            2, C.TRAFFIC_LIGHT_H * 1.2,
            0.3, 0.3, 0.3, 1);
          // Housing
          writeInst(buf, n++, item.x, item.y + C.TRAFFIC_LIGHT_H * 0.3,
            C.TRAFFIC_LIGHT_W, C.TRAFFIC_LIGHT_H,
            0.15, 0.15, 0.15, 1);
          // Light (color depends on state)
          const lr = item.lightState === 0 ? 1.0 : (item.lightState === 1 ? 1.0 : 0.1);
          const lg2 = item.lightState === 0 ? 0.1 : (item.lightState === 1 ? 0.8 : 1.0);
          const lb2 = 0.1;
          writeInst(buf, n++, item.x, item.y + C.TRAFFIC_LIGHT_H * 0.3,
            C.TRAFFIC_LIGHT_W - 1, C.TRAFFIC_LIGHT_W - 1,
            lr, lg2, lb2, 0.95, 0, 1);
          break;
        }
        case 'mailbox': {
          // Body
          writeInst(buf, n++, item.x, item.y, C.MAILBOX_W, C.MAILBOX_H,
            0.8, 0.15, 0.15, 1);
          // Slot stripe
          writeInst(buf, n++, item.x, item.y + 1, C.MAILBOX_W, 1.5,
            0.2, 0.1, 0.1, 1);
          break;
        }
        case 'bicycle': {
          // Frame (horizontal)
          writeInst(buf, n++, item.x, item.y, 10, 3, 0.45, 0.30, 0.18, 1);
          // Wheels
          writeInst(buf, n++, item.x - 4, item.y - 1, 4, 4, 0.25, 0.25, 0.25, 1, 0, 1);
          writeInst(buf, n++, item.x + 4, item.y - 1, 4, 4, 0.25, 0.25, 0.25, 1, 0, 1);
          break;
        }
        case 'flower_bed': {
          // Soil base
          writeInst(buf, n++, item.x, item.y - 1, 12, 3, 0.40, 0.28, 0.18, 1);
          // Green foliage
          writeInst(buf, n++, item.x, item.y + 1, 10, 4, 0.30, 0.70, 0.25, 1);
          // Flower dots
          writeInst(buf, n++, item.x - 3, item.y + 2, 3, 3, 0.95, 0.35, 0.55, 1, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y + 2, 3, 3, 0.95, 0.90, 0.20, 1, 0, 1);
          break;
        }
        case 'parasol': {
          // Pole
          writeInst(buf, n++, item.x, item.y - 2, 2, 12, 0.60, 0.50, 0.40, 1);
          // Canopy (circle)
          writeInst(buf, n++, item.x, item.y + 5, 10, 10, 0.95, 0.40, 0.25, 0.9, 0, 1);
          break;
        }
        case 'sign_board': {
          // Post
          writeInst(buf, n++, item.x, item.y - 3, 2, 8, 0.50, 0.45, 0.40, 1);
          // Board
          writeInst(buf, n++, item.x, item.y + 2, 8, 5, 0.95, 0.90, 0.20, 1);
          break;
        }
        case 'garbage': {
          writeInst(buf, n++, item.x, item.y, 6, 6, 0.25, 0.35, 0.25, 1);
          // Lid
          writeInst(buf, n++, item.x, item.y + 3.5, 7, 2, 0.30, 0.40, 0.30, 1);
          break;
        }
        case 'power_pole': {
          // Pole
          writeInst(buf, n++, item.x, item.y + 1, 3, 18, 0.35, 0.28, 0.22, 1);
          // Cross arm
          writeInst(buf, n++, item.x, item.y + 10, 10, 2, 0.35, 0.28, 0.22, 1);
          break;
        }
        case 'hydrant': {
          // Base
          writeInst(buf, n++, item.x, item.y - 1, 5, 3, 0.85, 0.10, 0.10, 1);
          // Top
          writeInst(buf, n++, item.x, item.y + 1.5, 4, 3, 0.90, 0.15, 0.15, 1);
          // Cap
          writeInst(buf, n++, item.x, item.y + 3, 3, 2, 0.95, 0.80, 0.10, 1);
          break;
        }
        case 'fountain': {
          // Basin
          writeInst(buf, n++, item.x, item.y - 2, 16, 6, 0.55, 0.75, 0.90, 1);
          // Water surface
          writeInst(buf, n++, item.x, item.y, 14, 4, 0.35, 0.65, 0.95, 0.8);
          // Water spout circles
          if (item.hp > 0) {
            writeInst(buf, n++, item.x, item.y + 5, 5, 5, 0.55, 0.85, 1.0, 0.7, 0, 1);
            writeInst(buf, n++, item.x, item.y + 8, 3, 3, 0.75, 0.95, 1.0, 0.5, 0, 1);
          }
          break;
        }
      }
    }
    return n - startIdx;
  }

  /** Check if ball hits an active fountain (acts as bumper) */
  checkFountainBumper(bx: number, by: number, br: number): FurnitureItem | null {
    for (const item of this.items) {
      if (!item.active || item.type !== 'fountain' || item.hp <= 0) continue;
      const hw = FURNITURE_HW[item.type];
      const hh = FURNITURE_HH[item.type];
      const nearX = Math.max(item.x - hw, Math.min(bx, item.x + hw));
      const nearY = Math.max(item.y - hh, Math.min(by, item.y + hh));
      const dx = bx - nearX, dy = by - nearY;
      if (dx * dx + dy * dy < br * br) return item;
    }
    return null;
  }
}

// ===== VEHICLE =====

export interface VehicleItem {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  score: number;
  speed: number;
  active: boolean;
  flashTimer: number;
  isAmbulance?: boolean;
  ambTimer?: number;
}

interface VehicleDef {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  lane: 'main' | 'front' | 'back';
  direction: 1 | -1;
  speed: number;
  interval: number;
}

const VEHICLE_DEFS_DATA: Record<string, { w: number; h: number; maxHp: number; score: number; speedMin: number; speedMax: number }> = {
  car:       { w: 20, h: 10, maxHp: 1, score: 120, speedMin: 50, speedMax: 70  },
  bus:       { w: 28, h: 12, maxHp: 2, score: 200, speedMin: 35, speedMax: 50  },
  truck:     { w: 24, h: 12, maxHp: 2, score: 180, speedMin: 30, speedMax: 45  },
  ambulance: { w: 22, h: 10, maxHp: 1, score: 500, speedMin: 100, speedMax: 120 },
};

// Car color palette (deterministic by position)
const CAR_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [0.80, 0.20, 0.20],
  [0.20, 0.30, 0.80],
  [0.20, 0.60, 0.20],
  [0.70, 0.70, 0.10],
  [0.50, 0.50, 0.50],
  [0.85, 0.55, 0.20],
  [0.60, 0.20, 0.70],
];

export class VehicleManager {
  vehicles: VehicleItem[] = [];
  private defs: VehicleDef[] = [];
  private spawnTimers: number[] = [];

  load(defs: VehicleDef[]) {
    this.defs = defs;
    this.spawnTimers = defs.map(d => d.interval * Math.random());
    this.vehicles = [];
  }

  update(dt: number) {
    // Update spawn timers
    for (let i = 0; i < this.defs.length; i++) {
      this.spawnTimers[i] -= dt;
      if (this.spawnTimers[i] <= 0) {
        this.spawnTimers[i] = this.defs[i].interval;
        this.spawnVehicle(this.defs[i]);
      }
    }
    // Move vehicles
    for (const v of this.vehicles) {
      if (!v.active) continue;
      v.x += v.speed * dt;
      if (v.flashTimer > 0) v.flashTimer -= dt;
      if (v.ambTimer !== undefined) {
        v.ambTimer -= dt;
        if (v.ambTimer <= 0) v.active = false;
      }
      // Despawn when off-screen
      const margin = 40;
      if (v.x > 180 + margin || v.x < -180 - margin) v.active = false;
    }
    // Remove inactive
    this.vehicles = this.vehicles.filter(v => v.active);
  }

  spawnAmbulance(x: number, y: number) {
    const v: VehicleItem = {
      type: 'ambulance', x, y,
      w: 22, h: 10, hp: 1, maxHp: 1, score: 500,
      speed: 110, active: true, flashTimer: 0,
      isAmbulance: true, ambTimer: 10,
    };
    this.vehicles.push(v);
  }

  private spawnVehicle(def: VehicleDef) {
    const laneY = def.lane === 'main'  ? C.MAIN_STREET_Y  :
                  def.lane === 'front' ? C.FRONT_STREET_Y : C.BACK_STREET_Y;
    const laneH = def.lane === 'main'  ? C.MAIN_STREET_H  :
                  def.lane === 'front' ? C.FRONT_STREET_H : C.BACK_STREET_H;
    const yOffset = def.direction === 1 ? -laneH / 4 : laneH / 4;

    const typeInfo = VEHICLE_DEFS_DATA[def.type];
    const startX = def.direction === 1 ? -180 - typeInfo.w / 2 : 180 + typeInfo.w / 2;
    const speed = (typeInfo.speedMin + Math.random() * (typeInfo.speedMax - typeInfo.speedMin)) * def.direction;

    this.vehicles.push({
      type: def.type,
      x: startX,
      y: laneY + yOffset,
      w: typeInfo.w,
      h: typeInfo.h,
      hp: typeInfo.maxHp,
      maxHp: typeInfo.maxHp,
      score: typeInfo.score,
      speed,
      active: true,
      flashTimer: 0,
    });
  }

  checkBallHit(bx: number, by: number, br: number): VehicleItem | null {
    for (const v of this.vehicles) {
      if (!v.active) continue;
      const hw = v.w / 2, hh = v.h / 2;
      const nearX = Math.max(v.x - hw, Math.min(bx, v.x + hw));
      const nearY = Math.max(v.y - hh, Math.min(by, v.y + hh));
      const dx = bx - nearX, dy = by - nearY;
      if (dx * dx + dy * dy < br * br) return v;
    }
    return null;
  }

  damage(v: VehicleItem): boolean {
    v.hp--;
    v.flashTimer = 0.1;
    if (v.hp <= 0) { v.active = false; return true; }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const v of this.vehicles) {
      if (!v.active) continue;
      const isFlash = v.flashTimer > 0;
      let cr: number, cg: number, cb: number;

      if (v.type === 'ambulance') {
        cr = 0.98; cg = 0.98; cb = 0.98;
      } else if (v.type === 'bus') {
        cr = 0.95; cg = 0.80; cb = 0.10;
      } else if (v.type === 'truck') {
        cr = 0.50; cg = 0.55; cb = 0.60;
      } else {
        const ci = Math.abs(Math.floor(v.x * 7 + v.y * 13)) % CAR_COLORS.length;
        [cr, cg, cb] = CAR_COLORS[ci];
      }

      if (isFlash) { cr = cg = cb = 1; }

      // Vehicle body
      writeInst(buf, n++, v.x, v.y, v.w, v.h, cr, cg, cb, 1);

      // Windows (darker top strip)
      writeInst(buf, n++, v.x, v.y + 2, v.w * 0.7, v.h * 0.4, 0.65, 0.85, 0.95, 0.8);

      // Wheels (2 small circles)
      writeInst(buf, n++, v.x - v.w / 2 + 3, v.y - v.h / 2 + 1, 4, 4, 0.12, 0.12, 0.12, 1, 0, 1);
      writeInst(buf, n++, v.x + v.w / 2 - 3, v.y - v.h / 2 + 1, 4, 4, 0.12, 0.12, 0.12, 1, 0, 1);

      // Ambulance: red cross
      if (v.type === 'ambulance' && !isFlash) {
        writeInst(buf, n++, v.x, v.y, 3, 9, 0.90, 0.10, 0.10, 1);
        writeInst(buf, n++, v.x, v.y, 9, 3, 0.90, 0.10, 0.10, 1);
      }
    }
    return n - startIdx;
  }
}
