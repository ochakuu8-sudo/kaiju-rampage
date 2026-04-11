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
import { Ball, Flipper, BuildingManager, FurnitureManager, BumperManager, VehicleManager } from './entities';
import { HumanManager } from './humans';
import { ParticleManager } from './particles';
import { JuiceManager } from './juice';
import { UIManager } from './ui';
import { getStage } from './stages';
import {
  resolveCircleOBB, resolveBumper,
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
  private bumpers:   BumperManager;
  private vehicles:  VehicleManager;

  private ball:     Ball;
  private flippers: [Flipper, Flipper];

  private score     = 0;
  private combo     = 1;
  private comboTimer= 0;
  private ballsLeft = C.INITIAL_BALLS;
  private stage     = 1;
  private state: GameState = 'playing';
  private stateTimer= 0;

  // Background gradient colors (set from stage config)
  private bgTopR = 0.45; private bgTopG = 0.68; private bgTopB = 0.95;
  private bgBottomR = 0.82; private bgBottomG = 0.90; private bgBottomB = 0.96;

  // ===== 坂OBB（静的壁）: フリッパーピボット点に接続 =====
  private readonly SLOPE_L = { cx: -132.5, cy: -131.5, hw: 58, hh: 6, angle: -0.611 };
  private readonly SLOPE_R = { cx:  132.5, cy: -131.5, hw: 58, hh: 6, angle:  0.611 };

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
    this.bumpers   = new BumperManager();
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
    this.bumpers.load(cfg.bumpers);
    this.vehicles.load(cfg.vehicles);
    this.bgTopR = cfg.bgTopR; this.bgTopG = cfg.bgTopG; this.bgTopB = cfg.bgTopB;
    this.bgBottomR = cfg.bgBottomR; this.bgBottomG = cfg.bgBottomG; this.bgBottomB = cfg.bgBottomB;
    this.humans.reset();
    this.particles.reset();
    this.ball.reset();
  }

  private restart() {
    this.score      = 0;
    this.combo      = 1;
    this.comboTimer = 0;
    this.ballsLeft  = C.INITIAL_BALLS;
    this.stage      = 1;
    this.state      = 'playing';
    this.stateTimer = 0;
    this.ui.hideGameOver();
    this.ui.hideStageClear();
    this.ui.setScore(0);
    this.ui.setBalls(this.ballsLeft);
    this.ui.setStage(1);
    this.ui.hideCombo();
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
    this.bumpers.update(dt);
    this.vehicles.update(dt);
    this.humans.update(dt, this.ball.x, this.ball.y);
    this.particles.update(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.ui.hideCombo();
        this.sound.resetComboStep();
      }
    }

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

      // Bumper collision
      const bumpRes = this.bumpers.checkBallHit(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy);
      if (bumpRes) {
        b.x = bumpRes.newBx; b.y = bumpRes.newBy;
        b.vx = bumpRes.newVx; b.vy = bumpRes.newVy;
        [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
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

    // ===== バンパースコア =====
    if (this.bumpers.bumpers.some(bp => bp.flashTimer > 0)) {
      this.score += C.BUMPER_SCORE;
      this.ui.setScore(this.score);
      this.particles.spawnSpark(b.x, b.y, 3);
      this.juice.ballHitFlash();
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
        this.bumpers.addTemporaryBumper(furnitureHit.x, furnitureHit.y, 5.0);
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
      const gained = crushed.length * C.HUMAN_CRUSH_SCORE * this.combo;
      this.score += gained;
      this.ui.setScore(this.score);

      this.combo = Math.min(this.combo + crushed.length, C.COMBO_MAX);
      this.comboTimer = C.COMBO_TIMEOUT;
      this.ui.setCombo(this.combo);
      this.juice.showCombo(this.combo);

      this.sound.humanCrush(this.combo);
      this.juice.shake(C.SHAKE_HUMAN_AMP, C.SHAKE_HUMAN_DUR);

      if (this.combo >= C.COMBO_MAX) {
        this.juice.flash(1, 0.8, 0, 0.4);
      }
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
      this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5);
      this.juice.flash(1, 1, 1, 0.35);
    } else {
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
    this.combo = 1;
    this.comboTimer = 0;
    this.ui.hideCombo();
    this.sound.resetComboStep();

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

    // ------ 1. 背景グラデーション ------
    this.renderer.drawBackground(
      this.bgTopR, this.bgTopG, this.bgTopB,
      this.bgBottomR, this.bgBottomG, this.bgBottomB
    );

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
    n += this.bumpers.fillInstances(SHARED_BUF, n);
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
    const WC = 0.18;
    const W  = C.WORLD_MAX_X * 2; // 360

    // 左壁
    writeInst(buf, n++, C.WORLD_MIN_X + 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC + 0.05, 1);
    // 右壁
    writeInst(buf, n++, C.WORLD_MAX_X - 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC + 0.05, 1);
    // 上壁
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 42, W, 4, WC, WC, WC + 0.05, 1);
    // UI区切り線
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 82, W, 2, 0.1, 0.1, 0.2, 0.5);

    // ===== 坂 =====
    const { cx: lcx, cy: lcy, hw: lhw, hh: lhh, angle: la } = this.SLOPE_L;
    writeInst(buf, n++, lcx, lcy, lhw * 2, lhh * 2, 0.5, 0.5, 0.65, 1, la);
    const { cx: rcx, cy: rcy, hw: rhw, hh: rhh, angle: ra } = this.SLOPE_R;
    writeInst(buf, n++, rcx, rcy, rhw * 2, rhh * 2, 0.5, 0.5, 0.65, 1, ra);

    // ガター外壁
    writeInst(buf, n++, -C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);
    writeInst(buf, n++,  C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);

    // ===== 道路色 =====
    const [rr, rg, rb] = C.ROAD_COLOR;
    const [sr, sg, sb] = C.SIDEWALK_COLOR;
    const [lr, lg, lb] = C.ROAD_LINE_COLOR;
    const [ar, ag, ab] = C.ALLEY_COLOR;

    // ===== 奥の通り (BACK_STREET_Y=240, H=12) =====
    const BSY = C.BACK_STREET_Y, BSH = C.BACK_STREET_H, BSW = C.BACK_SIDEWALK_H;
    writeInst(buf, n++, 0, BSY + BSH / 2 + BSW / 2, W, BSW, sr, sg, sb, 1);  // 上歩道
    writeInst(buf, n++, 0, BSY,                      W, BSH, rr, rg, rb, 1);  // 道路
    writeInst(buf, n++, 0, BSY - BSH / 2 - BSW / 2, W, BSW, sr, sg, sb, 1);  // 下歩道
    writeInst(buf, n++, 0, BSY,                      W, 1.5, lr, lg, lb, 1);  // 中央線

    // ===== メイン道路 (MAIN_STREET_Y=130, H=24) =====
    const MSY = C.MAIN_STREET_Y, MSH = C.MAIN_STREET_H, MSW = C.MAIN_SIDEWALK_H;
    writeInst(buf, n++, 0, MSY + MSH / 2 + MSW / 2, W, MSW, sr, sg, sb, 1);  // 上歩道
    writeInst(buf, n++, 0, MSY,                      W, MSH, rr, rg, rb, 1);  // 道路
    writeInst(buf, n++, 0, MSY - MSH / 2 - MSW / 2, W, MSW, sr, sg, sb, 1);  // 下歩道
    // 中央二重線
    writeInst(buf, n++, 0, MSY + 2, W, 1.5, lr, lg, lb, 1);
    writeInst(buf, n++, 0, MSY - 2, W, 1.5, lr, lg, lb, 1);

    // ===== 手前の通り (FRONT_STREET_Y=40, H=16) =====
    const FSY = C.FRONT_STREET_Y, FSH = C.FRONT_STREET_H, FSW = C.FRONT_SIDEWALK_H;
    writeInst(buf, n++, 0, FSY + FSH / 2 + FSW / 2, W, FSW, sr, sg, sb, 1);  // 上歩道
    writeInst(buf, n++, 0, FSY,                      W, FSH, rr, rg, rb, 1);  // 道路
    writeInst(buf, n++, 0, FSY - FSH / 2 - FSW / 2, W, FSW, sr, sg, sb, 1);  // 下歩道
    writeInst(buf, n++, 0, FSY,                      W, 1.5, lr, lg, lb, 1);  // 中央線

    // ===== 縦路地1 (X=-65, W=20) =====
    const ay1 = (C.ALLEY_Y_MIN + C.ALLEY_Y_MAX) / 2;
    const ah  = C.ALLEY_Y_MAX - C.ALLEY_Y_MIN;
    writeInst(buf, n++, C.ALLEY_1_X, ay1, C.ALLEY_WIDTH, ah, ar, ag, ab, 1);
    // 路地境界線
    writeInst(buf, n++, C.ALLEY_1_X - C.ALLEY_WIDTH / 2, ay1, 1.5, ah, sr, sg, sb, 0.6);
    writeInst(buf, n++, C.ALLEY_1_X + C.ALLEY_WIDTH / 2, ay1, 1.5, ah, sr, sg, sb, 0.6);

    // ===== 縦路地2 (X=65, W=20) =====
    writeInst(buf, n++, C.ALLEY_2_X, ay1, C.ALLEY_WIDTH, ah, ar, ag, ab, 1);
    writeInst(buf, n++, C.ALLEY_2_X - C.ALLEY_WIDTH / 2, ay1, 1.5, ah, sr, sg, sb, 0.6);
    writeInst(buf, n++, C.ALLEY_2_X + C.ALLEY_WIDTH / 2, ay1, 1.5, ah, sr, sg, sb, 0.6);

    // ===== 横断歩道 (交差点) =====
    // 路地×メイン道路 の4交差点
    const cwW = C.ALLEY_WIDTH - 2;
    const stripeH = 2.5;
    const stripeGap = 4;
    for (const ax of [C.ALLEY_1_X, C.ALLEY_2_X]) {
      for (let sy2 = MSY - MSH / 2 + 1; sy2 < MSY + MSH / 2; sy2 += stripeGap) {
        writeInst(buf, n++, ax, sy2, cwW, stripeH, 0.95, 0.95, 0.95, 0.7);
      }
      for (let sy2 = FSY - FSH / 2 + 1; sy2 < FSY + FSH / 2; sy2 += stripeGap) {
        writeInst(buf, n++, ax, sy2, cwW, stripeH, 0.95, 0.95, 0.95, 0.7);
      }
    }

    // ===== 街灯ポール =====
    const [pr, pg, pb] = C.STREETLIGHT_POLE_COLOR;
    for (const { x, base } of C.STREETLIGHTS) {
      const pcy = base + C.STREETLIGHT_POLE_H / 2;
      writeInst(buf, n++, x, pcy, C.STREETLIGHT_POLE_W, C.STREETLIGHT_POLE_H, pr, pg, pb, 1);
    }

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
      const gr = isFlash ? 1 : 0.7, gg = isFlash ? 1 : 0.7, gb = isFlash ? 1 : 0.8;
      writeInst(buf, n++, fl.cx, fl.cy, C.FLIPPER_W, C.FLIPPER_H, gr, gg, gb, 1, fl.angle);
      writeInst(buf, n++, fl.pivotX, fl.pivotY, 6, 6, 1, 0.6, 0.2, 1, 0, 1);
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
      const alpha = (1 - age) * 0.4;
      const sz = C.BALL_RADIUS * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, 1, 0.5 - age * 0.3, 0.1, alpha, 0, 1);
    }

    const r = isFl ? 1 : 1;
    const g = isFl ? 1 : 0.55;
    const bv = isFl ? 1 : 0.1;
    const d = C.BALL_RADIUS * 2;
    writeInst(buf, n++, b.x, b.y, d, d, r, g, bv, 1, 0, 1);

    return n - start;
  }
}
