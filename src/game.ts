/**
 * game.ts — メインゲームループ + 全システム統合
 *
 * 描画順:
 *  1. 背景クリア
 *  2. 壁・レール・道路・路地
 *  3. 建物
 *  4. 街路家具
 *  5. 人間
 *  6. バンパー
 *  7. フリッパー
 *  8. ボール（トレイル含む）
 *  9. パーティクル
 *  10. フラッシュオーバーレイ
 *  11. UI (DOM)
 */

import * as C from './constants';
import { Renderer, writeInst, INST_F } from './renderer';
import { InputManager } from './input';
import { SoundEngine } from './sound';
import { Ball, Flipper, BuildingManager, FurnitureManager, VehicleManager } from './entities';
import { HumanManager } from './humans';
import { ParticleManager } from './particles';
import { JuiceManager } from './juice';
import { UIManager } from './ui';
import { getStage } from './stages';
import {
  resolveCircleOBB,
  clampSpeed, rand, randInt
} from './physics';
import type { BuildingData } from './entities';

// 静的インスタンスバッファ（再利用でGCゼロ）
// 8000 = 2000人間 + 2000パーティクル + 4000シーン/車両/その他
const SHARED_BUF = new Float32Array(8000 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'stage_clear' | 'game_over';

export class Game {
  private renderer:  Renderer;
  private input:     InputManager;
  private sound:     SoundEngine;
  private humans:    HumanManager;
  private particles: ParticleManager;
  private juice:     JuiceManager;
  private ui:        UIManager;
  private buildings: BuildingManager;
  private furniture: FurnitureManager;
  private vehicles:  VehicleManager;

  private ball:     Ball;
  private flippers: [Flipper, Flipper];

  private score     = 0;
  private ballsLeft = C.INITIAL_BALLS;
  private stage     = 1;
  private state: GameState = 'playing';
  private stateTimer= 0;

  // Background gradient colors (set from stage config)
  private bgTopR = 0.52; private bgTopG = 0.74; private bgTopB = 0.96;
  private bgBottomR = 0.38; private bgBottomG = 0.36; private bgBottomB = 0.33;

  // ===== 坂OBB（静的壁）: フリッパーピボット点に接続 =====
  private readonly SLOPE_L = { cx: -132.5, cy: -155, hw: 73, hh: 6, angle: -0.856 };
  private readonly SLOPE_R = { cx:  132.5, cy: -155, hw: 73, hh: 6, angle:  0.856 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer  = new Renderer(canvas);
    this.input     = new InputManager(canvas);
    this.sound     = new SoundEngine();
    this.humans    = new HumanManager();
    this.particles = new ParticleManager();
    this.juice     = new JuiceManager();
    this.ui        = new UIManager();
    this.buildings = new BuildingManager();
    this.furniture = new FurnitureManager();
    this.vehicles  = new VehicleManager();
    this.ball      = new Ball();
    this.flippers  = [new Flipper(true), new Flipper(false)];

    this.input.registerRestartTap(document.getElementById('gameover')!);
    this.input.onRestart(() => this.restart());

    this.loadStage(1);
    this.ui.setBalls(this.ballsLeft);
    this.ui.setScore(0);

    this.startLoop();
  }

  private loadStage(level: number) {
    const cfg = getStage(level);
    this.buildings.load(cfg.buildings);
    this.furniture.load(cfg.furniture);
    this.vehicles.load(cfg.vehicles);
    this.bgTopR = cfg.bgTopR; this.bgTopG = cfg.bgTopG; this.bgTopB = cfg.bgTopB;
    this.bgBottomR = cfg.bgBottomR; this.bgBottomG = cfg.bgBottomG; this.bgBottomB = cfg.bgBottomB;
    this.humans.reset();
    this.particles.reset();
    this.ball.reset();
  }

  private restart() {
    this.score      = 0;

    this.ballsLeft  = C.INITIAL_BALLS;
    this.stage      = 1;
    this.state      = 'playing';
    this.stateTimer = 0;
    this.ui.hideGameOver();
    this.ui.hideStageClear();
    this.ui.setScore(0);
    this.ui.setBalls(this.ballsLeft);
    this.ui.setStage(1);
    this.loadStage(1);
  }

  // ===== メインループ =====

  private lastTime = 0;

  private startLoop() {
    const loop = (now: number) => {
      const rawDt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.update(rawDt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame((t) => { this.lastTime = t; requestAnimationFrame(loop); });
  }

  // ===== UPDATE =====

  private update(rawDt: number) {
    this.juice.update(rawDt);

    if (this.state === 'game_over') return;

    if (this.state === 'ball_lost') {
      this.stateTimer -= rawDt;
      this.particles.update(rawDt);
      if (this.stateTimer <= 0) {
        this.ball.reset();
        this.state = 'playing';
      }
      return;
    }

    if (this.state === 'stage_clear') {
      this.stateTimer -= rawDt;
      this.particles.update(rawDt);
      this.humans.update(rawDt, this.ball.x, this.ball.y);
      if (this.stateTimer <= 0) {
        this.stage++;
        this.ui.hideStageClear();
        this.loadStage(this.stage);
        this.ui.setStage(this.stage);
        this.state = 'playing';
      }
      return;
    }

    // === playing ===
    const dt = this.juice.getGameDt(rawDt);

    this.flippers[0].setPressed(this.input.leftPressed);
    this.flippers[1].setPressed(this.input.rightPressed);
    this.flippers[0].update(dt);
    this.flippers[1].update(dt);

    if (dt > 0) this.updateBall(dt);

    this.buildings.update(dt);
    this.furniture.update(dt);
    this.vehicles.update(dt);
    this.humans.update(dt, this.ball.x, this.ball.y);
    this.particles.update(dt);

    if (this.buildings.allDestroyed()) {
      this.onStageClear();
    }
  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (!b.active) return;

    const SUB = 4;
    const dts = dt / SUB;

    let wallSoundNeeded    = false;
    let flipperSoundNeeded = false;
    let bldResult: { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null = null;

    for (let s = 0; s < SUB; s++) {
      b.vy -= C.GRAVITY * dts * 60;
      b.x  += b.vx * dts * 60;
      b.y  += b.vy * dts * 60;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);

      if (b.x - C.BALL_RADIUS < C.WORLD_MIN_X) {
        b.x  = C.WORLD_MIN_X + C.BALL_RADIUS;
        b.vx = Math.abs(b.vx) * C.WALL_DAMPING;
        wallSoundNeeded = true;
      }
      if (b.x + C.BALL_RADIUS > C.WORLD_MAX_X) {
        b.x  = C.WORLD_MAX_X - C.BALL_RADIUS;
        b.vx = -Math.abs(b.vx) * C.WALL_DAMPING;
        wallSoundNeeded = true;
      }
      if (b.y + C.BALL_RADIUS > C.WORLD_MAX_Y - 40) {
        b.y  = C.WORLD_MAX_Y - 40 - C.BALL_RADIUS;
        b.vy = -Math.abs(b.vy) * C.WALL_DAMPING;
        wallSoundNeeded = true;
      }

      for (const slope of [this.SLOPE_L, this.SLOPE_R]) {
        const res = resolveCircleOBB(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy, slope);
        if (res) {
          [b.x, b.y, b.vx, b.vy] = res;
          wallSoundNeeded = true;
          break;
        }
      }

      for (const fl of this.flippers) {
        const res = resolveCircleOBB(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy, fl.getOBB());
        if (res) {
          [b.x, b.y, b.vx, b.vy] = res;
          const [nvx, nvy] = fl.applyImpulse(b.vx, b.vy);
          b.vx = nvx; b.vy = nvy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
          flipperSoundNeeded = true;
          break;
        }
      }

      if (!bldResult) {
        const h = this.buildings.checkBallHit(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy);
        if (h) {
          bldResult = h;
          b.x = h.newBx; b.y = h.newBy;
          b.vx = h.newVx; b.vy = h.newVy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
        }
      }

    } // end substep

    if (flipperSoundNeeded) {
      this.sound.flipper();
      this.juice.ballHitFlash();
    } else if (wallSoundNeeded) {
      this.sound.wallHit();
    }

    // ===== 建物ダメージ =====
    if (bldResult) {
      const { bld } = bldResult;
      const destroyed = this.buildings.damage(bld);
      if (destroyed) {
        this.onBuildingDestroyed(bld);
      } else {
        this.score += 10;
        this.ui.setScore(this.score);
        this.sound.buildingHit();
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
        this.juice.ballHitFlash();
        this.particles.spawnSpark(b.x, b.y, 4);
      }
    }

    // ===== 噴水バンパー =====
    const fountainHit = this.furniture.checkFountainBumper(b.x, b.y, C.BALL_RADIUS);
    if (fountainHit) {
      // Bounce like a bumper
      const dx = b.x - fountainHit.x;
      const dy = b.y - fountainHit.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len, ny = dy / len;
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (spd < C.BUMPER_FORCE) {
          b.vx = (b.vx / spd) * C.BUMPER_FORCE;
          b.vy = (b.vy / spd) * C.BUMPER_FORCE;
        }
      }
      this.particles.spawnWater(b.x, b.y, 6);
      this.score += 50;
      this.ui.setScore(this.score);
    }

    // ===== 家具衝突 =====
    const furnitureHit = this.furniture.checkBallHit(b.x, b.y, C.BALL_RADIUS);
    if (furnitureHit) {
      const destroyed = this.furniture.damage(furnitureHit);
      this.score += furnitureHit.score * (destroyed ? 2 : 1);
      this.ui.setScore(this.score);
      // Type-specific particles
      if (furnitureHit.type === 'hydrant' && destroyed) {
        this.particles.spawnWater(b.x, b.y, 12);
      } else if (furnitureHit.type === 'flower_bed' && destroyed) {
        this.particles.spawnFlower(b.x, b.y, 10);
      } else if (furnitureHit.type === 'sign_board' && destroyed) {
        this.particles.spawnConfetti(b.x, b.y, 8);
      } else if (furnitureHit.type === 'power_pole' && destroyed) {
        this.particles.spawnElectric(b.x, b.y, 12);
      } else if (furnitureHit.type === 'garbage' && destroyed) {
        this.particles.spawnFood(b.x, b.y, 6);
      } else if (furnitureHit.type === 'tree' || furnitureHit.type === 'vending') {
        this.particles.spawnDebris(b.x, b.y, 4, 0.5, 0.4, 0.3);
      } else {
        this.particles.spawnSpark(b.x, b.y, 3);
      }
      this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
      // Simple bounce off furniture
      b.vy = Math.abs(b.vy) * C.WALL_DAMPING;
    }

    // ===== 車両衝突 =====
    const vehicleHit = this.vehicles.checkBallHit(b.x, b.y, C.BALL_RADIUS);
    if (vehicleHit) {
      // Reflect ball velocity (simple horizontal bounce)
      b.vx = -b.vx * C.WALL_DAMPING;
      b.vy = Math.abs(b.vy) * C.WALL_DAMPING + 2;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
      const destroyed = this.vehicles.damage(vehicleHit);
      this.score += vehicleHit.score * (destroyed ? 1 : 0) + 30;
      this.ui.setScore(this.score);
      if (destroyed) {
        this.particles.spawnDebris(b.x, b.y, 8, 0.5, 0.5, 0.55);
        this.particles.spawnSpark(b.x, b.y, 6);
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
      } else {
        this.particles.spawnSpark(b.x, b.y, 3);
        this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
      }
      this.juice.ballHitFlash();
    }

    // ===== 人間潰し =====
    const crushed = this.humans.checkCrush(b.x, b.y, C.BALL_RADIUS);
    if (crushed.length > 0) {
      for (const idx of crushed) {
        const [hx, hy] = this.humans.getPos(idx);
        this.particles.spawnBlood(hx, hy, randInt(8, 12));
        this.particles.spawnScorePop(hx, hy);
      }
      this.score += crushed.length * C.HUMAN_CRUSH_SCORE;
      this.ui.setScore(this.score);

      this.sound.humanCrush(1);
      this.juice.shake(C.SHAKE_HUMAN_AMP, C.SHAKE_HUMAN_DUR);
    }

    if (b.y < C.FALLOFF_Y) {
      this.onBallLost();
    }

    b.recordTrail();
  }

  private onBuildingDestroyed(bld: BuildingData) {
    const cx = bld.x + bld.w / 2;
    const cy = bld.y + bld.h / 2;

    this.score += bld.score;
    this.ui.setScore(this.score);
    this.sound.buildingDestroy();

    const isLarge = bld.maxHp >= 3;
    if (isLarge) {
      this.juice.hitstop(C.HITSTOP_LARGE);
      this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5);
      this.juice.flash(1, 1, 1, 0.35);
    } else {
      this.juice.hitstop(C.HITSTOP_SMALL);
      this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);
    }

    const debrisCount = 10 + bld.maxHp * 5;
    // Use debris color matching building type
    const [dr, dg, db] = bld.baseColor;
    this.particles.spawnDebris(cx, cy, debrisCount, dr, dg, db);
    this.particles.spawnSmoke(cx, cy, 4);
    this.particles.spawnSpark(cx, cy, 8);

    // Hospital destroyed: spawn ambulance
    if (bld.size === 'hospital') {
      this.vehicles.spawnAmbulance(cx < 0 ? 190 : -190, C.MAIN_STREET_Y);
    }
    // School destroyed: confetti
    if (bld.size === 'school') {
      this.particles.spawnConfetti(cx, cy, 15);
    }
    // Temple destroyed: extra sparks + flash
    if (bld.size === 'temple') {
      this.particles.spawnElectric(cx, cy, 10);
      this.juice.flash(1.0, 0.7, 0.2, 0.25);
    }
    // Restaurant destroyed: food particles
    if (bld.size === 'restaurant') {
      this.particles.spawnFood(cx, cy, 10);
    }

    const n = randInt(bld.humanMin, bld.humanMax);
    this.humans.spawn(cx, cy, n);
  }

  private onBallLost() {
    this.ball.active = false;
    this.ballsLeft--;
    this.ui.setBalls(this.ballsLeft);
    this.sound.ballLost();
    this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);

    if (this.ballsLeft <= 0) {
      this.onGameOver();
    } else {
      this.state = 'ball_lost';
      this.stateTimer = 1.2;
    }
  }

  private onStageClear() {
    this.state = 'stage_clear';
    this.stateTimer = 3.0;
    this.sound.stageClear();
    this.juice.flash(0, 1, 0, 0.4);
    this.ui.showStageClear(0);
  }

  private onGameOver() {
    this.state = 'game_over';
    this.juice.flash(1, 0, 0, 0.6);
    setTimeout(() => {
      this.ui.showGameOver(this.score);
    }, 800);
  }

  // ===== RENDER =====

  private render() {
    const shake = this.juice.getShake();

    // ------ 1. 背景（芝生単色 - fillWallsで全面塗るので単色クリアのみ） ------
    this.renderer.clear(0.35, 0.65, 0.28);

    // ------ バッチ1: シーン背景 (道路→ビル→家具→車両→電球) ------
    // 同一シェーダーのインスタンスをまとめて1ドローコールで描画
    let n = 0;
    n += this.fillWalls(SHARED_BUF, n);
    n += this.buildings.fillInstances(SHARED_BUF, n);
    n += this.furniture.fillInstances(SHARED_BUF, n);
    n += this.vehicles.fillInstances(SHARED_BUF, n);
    n += this.fillBulbs(SHARED_BUF, n);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    // ------ バッチ2: エンティティ (人間→バンパー→フリッパー→ボール→パーティクル) ------
    n = 0;
    n += this.humans.fillInstances(SHARED_BUF, n);
    n += this.fillFlippers(SHARED_BUF, n);
    n += this.fillBall(SHARED_BUF, n);
    n += this.particles.fillInstances(SHARED_BUF, n);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    // ------ フラッシュオーバーレイ ------
    this.renderer.drawFlash(
      this.juice.flashR, this.juice.flashG, this.juice.flashB,
      this.juice.flashAlpha
    );
  }

  private fillWalls(buf: Float32Array, start: number): number {
    let n = start;
    const W = 360;
    const WC = 0.18;
    const [zrR,zrG,zrB] = C.ZONE_RESIDENTIAL;
    const [zcR,zcG,zcB] = C.ZONE_COMMERCIAL;
    const [zvR,zvG,zvB] = C.ZONE_RIVERSIDE;
    const [zsR,zsG,zsB] = C.ZONE_SLOPE;
    const [plR,plG,plB] = C.PLANTING_COLOR;

    // === ① ゾーン別地面（最背面, 4道路）===
    const htLow = C.HILLTOP_STREET_Y   - C.HILLTOP_STREET_H/2   - C.SIDEWALK_H;
    const maLow = C.MAIN_STREET_Y      - C.MAIN_STREET_H/2      - C.SIDEWALK_H;
    const loLow = C.LOWER_STREET_Y     - C.LOWER_STREET_H/2     - C.SIDEWALK_H;
    const rvLow = C.RIVERSIDE_STREET_Y - C.RIVERSIDE_STREET_H/2 - C.SIDEWALK_H;
    const gf = (y1: number, y2: number, r: number, g: number, b: number) =>
      writeInst(buf, n++, 0, (y1+y2)/2, W, y1-y2, r, g, b, 1);
    // 丘上部〜HILLTOP道路
    writeInst(buf, n++, 0, (C.WORLD_MAX_Y + htLow)/2, W, C.WORLD_MAX_Y - htLow, zrR, zrG, zrB, 1);
    // ブロックA (HILLTOP〜MAIN): 住宅ゾーン
    const maTop = C.MAIN_STREET_Y + C.MAIN_STREET_H/2 + C.SIDEWALK_H;
    gf(htLow,  maTop, zrR, zrG, zrB);
    // ブロックB (MAIN〜LOWER): 商業ゾーン
    const loTop = C.LOWER_STREET_Y + C.LOWER_STREET_H/2 + C.SIDEWALK_H;
    gf(maLow,  loTop, zcR, zcG, zcB);
    // ブロックC (LOWER〜RIVERSIDE): 川沿いゾーン
    const rvTop = C.RIVERSIDE_STREET_Y + C.RIVERSIDE_STREET_H/2 + C.SIDEWALK_H;
    gf(loLow,  rvTop, zvR, zvG, zvB);
    // 坂〜画面下端エリア（川を削除、坂ゾーンで統一）
    gf(rvLow,  C.WORLD_MIN_Y, zsR, zsG, zsB);

    // === ② 坂（緑の斜面 + ガードレール） ===
    const { cx: lcx, cy: lcy, hw: lhw, hh: lhh, angle: la } = this.SLOPE_L;
    writeInst(buf, n++, lcx, lcy, lhw*2, lhh*2, 0.38, 0.58, 0.30, 1, la);
    writeInst(buf, n++, lcx, lcy - lhh - 0.5, lhw*2, 2, 0.85, 0.85, 0.85, 0.5, la);
    const { cx: rcx, cy: rcy, hw: rhw, hh: rhh, angle: ra } = this.SLOPE_R;
    writeInst(buf, n++, rcx, rcy, rhw*2, rhh*2, 0.38, 0.58, 0.30, 1, ra);
    writeInst(buf, n++, rcx, rcy - rhh - 0.5, rhw*2, 2, 0.85, 0.85, 0.85, 0.5, ra);

    // ガター壁
    writeInst(buf, n++, -C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);
    writeInst(buf, n++,  C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);

    // === ③ 5本道路（植栽帯 → 歩道 → 道路） ===
    const [rr,rg,rb] = C.ROAD_COLOR;
    const [sr,sg,sb] = C.SIDEWALK_COLOR;
    const [lr2,lg2,lb2] = C.ROAD_LINE_COLOR;
    const [ar,ag,ab] = C.ALLEY_COLOR;

    const drawRoad = (cy: number, h: number, doubleCenter = false) => {
      const swTop = cy + h/2 + C.SIDEWALK_H/2;
      const swBot = cy - h/2 - C.SIDEWALK_H/2;
      // 植栽帯（歩道の外側）
      writeInst(buf, n++, 0, swTop + C.SIDEWALK_H/2 + 1.5, W, 3, plR, plG, plB, 1);
      writeInst(buf, n++, 0, swBot - C.SIDEWALK_H/2 - 1.5, W, 3, plR, plG, plB, 1);
      // 歩道
      writeInst(buf, n++, 0, swTop, W, C.SIDEWALK_H, sr, sg, sb, 1);
      writeInst(buf, n++, 0, swBot, W, C.SIDEWALK_H, sr, sg, sb, 1);
      // 道路本体
      writeInst(buf, n++, 0, cy, W, h, rr, rg, rb, 1);
      // 中央線
      if (doubleCenter) {
        writeInst(buf, n++, 0, cy + 2, W, 1.5, lr2, lg2, lb2, 1);
        writeInst(buf, n++, 0, cy - 2, W, 1.5, lr2, lg2, lb2, 1);
      } else {
        writeInst(buf, n++, 0, cy, W, 1.5, lr2, lg2, lb2, 1);
      }
    };
    drawRoad(C.HILLTOP_STREET_Y,   C.HILLTOP_STREET_H);
    drawRoad(C.MAIN_STREET_Y,      C.MAIN_STREET_H,  true);
    drawRoad(C.LOWER_STREET_Y,     C.LOWER_STREET_H);
    drawRoad(C.RIVERSIDE_STREET_Y, C.RIVERSIDE_STREET_H);

    // === ④ 縦路地 ===
    const ay  = (C.ALLEY_Y_MIN + C.ALLEY_Y_MAX) / 2;
    const ah  = C.ALLEY_Y_MAX - C.ALLEY_Y_MIN;
    for (const ax of [C.ALLEY_1_X, C.ALLEY_2_X]) {
      writeInst(buf, n++, ax, ay, C.ALLEY_WIDTH, ah, ar, ag, ab, 1);
      writeInst(buf, n++, ax - C.ALLEY_WIDTH/2, ay, 1.5, ah, sr, sg, sb, 0.6);
      writeInst(buf, n++, ax + C.ALLEY_WIDTH/2, ay, 1.5, ah, sr, sg, sb, 0.6);
    }

    // === ⑤ 横断歩道 ===
    const cwW = C.ALLEY_WIDTH - 2;
    const stripeH = 2.5, stripeGap = 4;
    const roads = [
      { cy: C.HILLTOP_STREET_Y,   h: C.HILLTOP_STREET_H },
      { cy: C.MAIN_STREET_Y,      h: C.MAIN_STREET_H },
      { cy: C.LOWER_STREET_Y,     h: C.LOWER_STREET_H },
      { cy: C.RIVERSIDE_STREET_Y, h: C.RIVERSIDE_STREET_H },
    ];
    for (const ax of [C.ALLEY_1_X, C.ALLEY_2_X]) {
      for (const road of roads) {
        for (let sy = road.cy - road.h/2 + 1; sy < road.cy + road.h/2; sy += stripeGap) {
          writeInst(buf, n++, ax, sy, cwW, stripeH, 0.90, 0.90, 0.90, 0.8);
        }
      }
    }

    // === ⑥ 外壁 ===
    writeInst(buf, n++, C.WORLD_MIN_X + 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, C.WORLD_MAX_X - 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 42, W, 4, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 82, W, 2, 0.1, 0.1, 0.2, 0.5);

    return n - start;
  }

  /** 街灯電球（半透明の暖色円） */
  private fillBulbs(buf: Float32Array, start: number): number {
    let n = start;
    const [br, bg, bb, ba] = C.STREETLIGHT_BULB_COLOR;
    const d = C.STREETLIGHT_BULB_R * 2;
    for (const { x, base } of C.STREETLIGHTS) {
      const bcy = base + C.STREETLIGHT_POLE_H + C.STREETLIGHT_BULB_R * 0.5;
      writeInst(buf, n++, x, bcy, d, d, br, bg, bb, ba, 0, 1);
    }
    return n - start;
  }

  private fillFlippers(buf: Float32Array, start: number): number {
    let n = start;
    for (const fl of this.flippers) {
      const isFlash = this.juice.isBallFlashing();
      const gr = isFlash ? 1 : 0.60, gg = isFlash ? 1 : 0.60, gb = isFlash ? 1 : 0.70;
      writeInst(buf, n++, fl.cx, fl.cy, C.FLIPPER_W, C.FLIPPER_H, gr, gg, gb, 1, fl.angle);
      writeInst(buf, n++, fl.pivotX, fl.pivotY, 6, 6, 0.90, 0.55, 0.20, 1, 0, 1);
    }
    return n - start;
  }

  private fillBall(buf: Float32Array, start: number): number {
    const b = this.ball;
    if (!b.active) return 0;
    let n = start;
    const isFl = this.juice.isBallFlashing();

    for (let t = 0; t < C.TRAIL_LEN; t++) {
      const age = t / C.TRAIL_LEN;
      const idx = (b.trailHead - 1 - t + C.TRAIL_LEN) % C.TRAIL_LEN;
      const tx = b.trail[idx * 2];
      const ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.45;
      const sz = C.BALL_RADIUS * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, 0.95, 0.40 - age * 0.2, 0.08, alpha, 0, 1);
    }

    const r = isFl ? 1 : 0.95;
    const g = isFl ? 1 : 0.55;
    const bv = isFl ? 1 : 0.10;
    const d = C.BALL_RADIUS * 2;
    writeInst(buf, n++, b.x, b.y, d, d, r, g, bv, 1, 0, 1);

    return n - start;
  }
}
