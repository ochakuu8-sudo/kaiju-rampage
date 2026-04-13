/**
 * game.ts — メインゲームループ + ウェーブシステム
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
import { resolveCircleOBB, clampSpeed, rand, randInt } from './physics';
import type { BuildingData } from './entities';

const SHARED_BUF = new Float32Array(16000 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'game_over';

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
  private ball:      Ball;
  private flippers:  [Flipper, Flipper];

  // サバイバルシステム
  private wave         = 1;
  private lifeTimer    = C.WAVE_TIME;   // ライフタイマー (0でゲームオーバー)
  private waveElapsed  = 0;             // ウェーブ内経過秒 (WAVE_DURATIONでwave++)
  private totalDestroys= 0;
  private totalHumans  = 0;

  private state: GameState = 'playing';
  private stateTimer = 0;

  private bgTopR = 0.52; private bgTopG = 0.74; private bgTopB = 0.96;
  private bgBottomR = 0.38; private bgBottomG = 0.36; private bgBottomB = 0.33;

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

    this.initWave1();
    this.loadCity();
    this.startLoop();
  }

  private initWave1() {
    this.wave          = 1;
    this.lifeTimer     = C.WAVE_TIME;
    this.waveElapsed   = 0;
    this.totalDestroys = 0;
    this.totalHumans   = 0;
    this.state         = 'playing';
    this.stateTimer    = 0;
    this.ui.setWaveNum(1);
    this.ui.setTimer(C.WAVE_TIME);
    this.ui.setLifeGauge(C.WAVE_TIME, C.WAVE_TIME);
  }

  private loadCity() {
    const cfg = getStage(1);
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
    this.ui.hideGameOver();
    this.initWave1();
    this.loadCity();
  }

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

    // ライフタイマー減少
    this.lifeTimer -= rawDt;
    this.ui.setTimer(Math.max(0, this.lifeTimer));
    this.ui.setLifeGauge(Math.max(0, this.lifeTimer), C.WAVE_TIME);
    if (this.lifeTimer <= 0) {
      this.onGameOver();
      return;
    }

    // ウェーブ自動進行 (WAVE_DURATION秒ごと)
    this.waveElapsed += rawDt;
    if (this.waveElapsed >= C.WAVE_DURATION) {
      this.waveElapsed -= C.WAVE_DURATION;
      this.wave++;
      this.ui.setWaveNum(this.wave);
      this.juice.flash(0.5, 0.8, 1.0, 0.3);
    }

  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (!b.active) return;
    const SUB = 4;
    const dts = dt / SUB;
    let wallSoundNeeded = false, flipperSoundNeeded = false;
    let bldResult: { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null = null;

    for (let s = 0; s < SUB; s++) {
      b.vy -= C.GRAVITY * dts * 60;
      b.x  += b.vx * dts * 60;
      b.y  += b.vy * dts * 60;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
      if (b.x - C.BALL_RADIUS < C.WORLD_MIN_X) { b.x = C.WORLD_MIN_X + C.BALL_RADIUS; b.vx = Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.x + C.BALL_RADIUS > C.WORLD_MAX_X) { b.x = C.WORLD_MAX_X - C.BALL_RADIUS; b.vx = -Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.y + C.BALL_RADIUS > C.WORLD_MAX_Y - 40) { b.y = C.WORLD_MAX_Y - 40 - C.BALL_RADIUS; b.vy = -Math.abs(b.vy) * C.WALL_DAMPING; wallSoundNeeded = true; }
      for (const slope of [this.SLOPE_L, this.SLOPE_R]) {
        const res = resolveCircleOBB(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy, slope);
        if (res) { [b.x, b.y, b.vx, b.vy] = res; wallSoundNeeded = true; break; }
      }
      for (const fl of this.flippers) {
        const res = resolveCircleOBB(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy, fl.getOBB());
        if (res) {
          [b.x, b.y, b.vx, b.vy] = res;
          const [nvx, nvy] = fl.applyImpulse(b.vx, b.vy);
          b.vx = nvx; b.vy = nvy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
          flipperSoundNeeded = true; break;
        }
      }
      if (!bldResult) {
        const h = this.buildings.checkBallHit(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy);
        if (h) { bldResult = h; b.x = h.newBx; b.y = h.newBy; b.vx = h.newVx; b.vy = h.newVy; [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED); }
      }
    }

    if (flipperSoundNeeded) { this.sound.flipper(); this.juice.ballHitFlash(); }
    else if (wallSoundNeeded) { this.sound.wallHit(); }

    if (bldResult) {
      const { bld } = bldResult;
      const destroyed = this.buildings.damage(bld);
      if (destroyed) {
        this.onBuildingDestroyed(bld);
      } else {
        this.sound.buildingHit();
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
        this.juice.ballHitFlash();
        this.particles.spawnSpark(b.x, b.y, 4);
      }
    }

    const fountainHit = this.furniture.checkFountainBumper(b.x, b.y, C.BALL_RADIUS);
    if (fountainHit) {
      const dx = b.x - fountainHit.x, dy = b.y - fountainHit.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = dx/len, ny = dy/len;
      const dot = b.vx*nx + b.vy*ny;
      if (dot < 0) { b.vx -= 2*dot*nx; b.vy -= 2*dot*ny; const spd = Math.sqrt(b.vx*b.vx+b.vy*b.vy); if (spd < C.BUMPER_FORCE) { b.vx = (b.vx/spd)*C.BUMPER_FORCE; b.vy = (b.vy/spd)*C.BUMPER_FORCE; } }
      this.particles.spawnWater(b.x, b.y, 6);
    }

    const furnitureHit = this.furniture.checkBallHit(b.x, b.y, C.BALL_RADIUS);
    if (furnitureHit) {
      const destroyed = this.furniture.damage(furnitureHit);
      if (furnitureHit.type === 'hydrant' && destroyed) this.particles.spawnWater(b.x, b.y, 12);
      else if (furnitureHit.type === 'flower_bed' && destroyed) this.particles.spawnFlower(b.x, b.y, 10);
      else if (furnitureHit.type === 'sign_board' && destroyed) this.particles.spawnConfetti(b.x, b.y, 8);
      else if (furnitureHit.type === 'power_pole' && destroyed) this.particles.spawnElectric(b.x, b.y, 12);
      else if (furnitureHit.type === 'garbage' && destroyed) this.particles.spawnFood(b.x, b.y, 6);
      else if (furnitureHit.type === 'tree' || furnitureHit.type === 'vending') this.particles.spawnDebris(b.x, b.y, 4, 0.5, 0.4, 0.3);
      else this.particles.spawnSpark(b.x, b.y, 3);
      this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
      b.vy = Math.abs(b.vy) * C.WALL_DAMPING;
    }

    const vehicleHit = this.vehicles.checkBallHit(b.x, b.y, C.BALL_RADIUS);
    if (vehicleHit) {
      b.vx = -b.vx * C.WALL_DAMPING; b.vy = Math.abs(b.vy) * C.WALL_DAMPING + 2;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
      const destroyed = this.vehicles.damage(vehicleHit);
      if (destroyed) { this.particles.spawnDebris(b.x, b.y, 8, 0.5, 0.5, 0.55); this.particles.spawnSpark(b.x, b.y, 6); this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR); }
      else { this.particles.spawnSpark(b.x, b.y, 3); this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5); }
      this.juice.ballHitFlash();
    }

    const crushed = this.humans.checkCrush(b.x, b.y, C.BALL_RADIUS);
    if (crushed.length > 0) {
      for (const idx of crushed) {
        const [hx, hy] = this.humans.getPos(idx);
        this.particles.spawnBlood(hx, hy, randInt(18, 28));
      }
      this.totalHumans += crushed.length;
      // 人間を潰すとライフタイマー回復
      this.lifeTimer = Math.min(C.WAVE_TIME, this.lifeTimer + crushed.length * C.TIME_PER_HUMAN);
      this.sound.humanCrush(1);
      this.juice.shake(C.SHAKE_HUMAN_AMP, C.SHAKE_HUMAN_DUR);
    }

    if (b.y < C.FALLOFF_Y) this.onBallLost();
    b.recordTrail();
  }

  private onBuildingDestroyed(bld: BuildingData) {
    const cx = bld.x + bld.w / 2;
    const cy = bld.y + bld.h / 2;
    this.totalDestroys++;
    this.sound.buildingDestroy();

    const isLarge = bld.maxHp >= 3;
    const sc = bld.maxHp; // 1=小 2=中 3-4=大
    if (isLarge) { this.juice.hitstop(C.HITSTOP_LARGE); this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5); this.juice.flash(1, 1, 1, 0.40); }
    else         { this.juice.hitstop(C.HITSTOP_SMALL);  this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR); this.juice.flash(1, 0.85, 0.4, 0.18); }

    const [dr, dg, db] = bld.baseColor;
    const top = bld.y + bld.h;

    // ── メイン破壊エフェクト ──────────────────────────────
    this.particles.spawnDebris(cx, cy,  18 + sc * 12, dr, dg, db);
    this.particles.spawnSpark (cx, cy,  16 + sc * 10);
    this.particles.spawnFire  (cx, cy,  10 + sc * 7);
    this.particles.spawnDust  (cx, bld.y, bld.w, 6 + sc * 4);

    // ── 大型ビル: 頂部からも追加演出 ─────────────────────
    if (isLarge) {
      this.particles.spawnDebris(cx, top, 14, dr, dg, db);
      this.particles.spawnSpark (cx, top, 18);
      this.particles.spawnFire  (cx, top, 14);
    }

    // ── ガラス散乱: オフィス系 ───────────────────────────
    if (bld.size === 'office' || bld.size === 'tower' || bld.size === 'skyscraper') {
      this.particles.spawnGlass(cx, cy, 14 + sc * 6);
    }

    // ── 特殊建物 ─────────────────────────────────────────
    if (bld.size === 'hospital')   this.vehicles.spawnAmbulance(cx < 0 ? 190 : -190, C.MAIN_STREET_Y);
    if (bld.size === 'school')     this.particles.spawnConfetti(cx, cy, 22);
    if (bld.size === 'temple')     { this.particles.spawnElectric(cx, cy, 16); this.juice.flash(1.0, 0.7, 0.2, 0.30); }
    if (bld.size === 'restaurant') this.particles.spawnFood(cx, cy, 14);

    this.humans.spawnBlast(cx, cy, randInt(bld.humanMin, bld.humanMax));
  }

  private onBallLost() {
    this.ball.active = false;
    this.lifeTimer = Math.max(0, this.lifeTimer - C.BALL_LOST_PENALTY);
    this.sound.ballLost();
    this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);
    if (this.lifeTimer <= 0) { this.onGameOver(); return; }
    this.state = 'ball_lost';
    this.stateTimer = 1.0;
  }

  private onGameOver() {
    this.state = 'game_over';
    this.juice.flash(1, 0, 0, 0.6);
    setTimeout(() => {
      this.ui.showGameOver(this.wave, this.totalDestroys, this.totalHumans);
    }, 800);
  }

  private render() {
    const shake = this.juice.getShake();
    this.renderer.clear(0.35, 0.65, 0.28);

    let n = 0;
    n += this.fillWalls(SHARED_BUF, n);
    n += this.buildings.fillInstances(SHARED_BUF, n);
    n += this.furniture.fillInstances(SHARED_BUF, n);
    n += this.vehicles.fillInstances(SHARED_BUF, n);
    n += this.fillBulbs(SHARED_BUF, n);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    n = 0;
    n += this.humans.fillInstances(SHARED_BUF, n);
    n += this.fillFlippers(SHARED_BUF, n);
    n += this.fillBall(SHARED_BUF, n);
    n += this.particles.fillInstances(SHARED_BUF, n);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    this.renderer.drawFlash(this.juice.flashR, this.juice.flashG, this.juice.flashB, this.juice.flashAlpha);
  }

  private fillWalls(buf: Float32Array, start: number): number {
    let n = start;
    const W = 360, WC = 0.18;
    const [zrR,zrG,zrB] = C.ZONE_RESIDENTIAL;
    const [zcR,zcG,zcB] = C.ZONE_COMMERCIAL;
    const [zvR,zvG,zvB] = C.ZONE_RIVERSIDE;
    const [zsR,zsG,zsB] = C.ZONE_SLOPE;
    const [plR,plG,plB] = C.PLANTING_COLOR;

    const htLow = C.HILLTOP_STREET_Y   - C.HILLTOP_STREET_H/2   - C.SIDEWALK_H;
    const maLow = C.MAIN_STREET_Y      - C.MAIN_STREET_H/2      - C.SIDEWALK_H;
    const loLow = C.LOWER_STREET_Y     - C.LOWER_STREET_H/2     - C.SIDEWALK_H;
    const rvLow = C.RIVERSIDE_STREET_Y - C.RIVERSIDE_STREET_H/2 - C.SIDEWALK_H;
    const gf = (y1: number, y2: number, r: number, g: number, b: number) =>
      writeInst(buf, n++, 0, (y1+y2)/2, W, y1-y2, r, g, b, 1);

    writeInst(buf, n++, 0, (C.WORLD_MAX_Y + htLow)/2, W, C.WORLD_MAX_Y - htLow, zrR, zrG, zrB, 1);
    const maTop = C.MAIN_STREET_Y + C.MAIN_STREET_H/2 + C.SIDEWALK_H;
    gf(htLow, maTop, zrR, zrG, zrB);
    const loTop = C.LOWER_STREET_Y + C.LOWER_STREET_H/2 + C.SIDEWALK_H;
    gf(maLow, loTop, zcR, zcG, zcB);
    const rvTop = C.RIVERSIDE_STREET_Y + C.RIVERSIDE_STREET_H/2 + C.SIDEWALK_H;
    gf(loLow, rvTop, zvR, zvG, zvB);
    gf(rvLow, C.WORLD_MIN_Y, zsR, zsG, zsB);

    const { cx: lcx, cy: lcy, hw: lhw, hh: lhh, angle: la } = this.SLOPE_L;
    writeInst(buf, n++, lcx, lcy, lhw*2, lhh*2, 0.38, 0.58, 0.30, 1, la);
    writeInst(buf, n++, lcx, lcy - lhh - 0.5, lhw*2, 2, 0.85, 0.85, 0.85, 0.5, la);
    const { cx: rcx, cy: rcy, hw: rhw, hh: rhh, angle: ra } = this.SLOPE_R;
    writeInst(buf, n++, rcx, rcy, rhw*2, rhh*2, 0.38, 0.58, 0.30, 1, ra);
    writeInst(buf, n++, rcx, rcy - rhh - 0.5, rhw*2, 2, 0.85, 0.85, 0.85, 0.5, ra);

    writeInst(buf, n++, -C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);
    writeInst(buf, n++,  C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);

    const [rr,rg,rb] = C.ROAD_COLOR;
    const [sr,sg,sb] = C.SIDEWALK_COLOR;
    const [lr2,lg2,lb2] = C.ROAD_LINE_COLOR;
    const [ar,ag,ab] = C.ALLEY_COLOR;

    const drawRoad = (cy: number, h: number, doubleCenter = false) => {
      const swTop = cy + h/2 + C.SIDEWALK_H/2;
      const swBot = cy - h/2 - C.SIDEWALK_H/2;
      writeInst(buf, n++, 0, swTop + C.SIDEWALK_H/2 + 1.5, W, 3, plR, plG, plB, 1);
      writeInst(buf, n++, 0, swBot - C.SIDEWALK_H/2 - 1.5, W, 3, plR, plG, plB, 1);
      writeInst(buf, n++, 0, swTop, W, C.SIDEWALK_H, sr, sg, sb, 1);
      writeInst(buf, n++, 0, swBot, W, C.SIDEWALK_H, sr, sg, sb, 1);
      writeInst(buf, n++, 0, cy, W, h, rr, rg, rb, 1);
      if (doubleCenter) {
        writeInst(buf, n++, 0, cy + 2, W, 1.5, lr2, lg2, lb2, 1);
        writeInst(buf, n++, 0, cy - 2, W, 1.5, lr2, lg2, lb2, 1);
      } else {
        writeInst(buf, n++, 0, cy, W, 1.5, lr2, lg2, lb2, 1);
      }
    };
    drawRoad(C.HILLTOP_STREET_Y,   C.HILLTOP_STREET_H);
    drawRoad(C.MAIN_STREET_Y,      C.MAIN_STREET_H, true);
    drawRoad(C.LOWER_STREET_Y,     C.LOWER_STREET_H);
    drawRoad(C.RIVERSIDE_STREET_Y, C.RIVERSIDE_STREET_H);

    const ay = (C.ALLEY_Y_MIN + C.ALLEY_Y_MAX) / 2;
    const ah = C.ALLEY_Y_MAX - C.ALLEY_Y_MIN;
    for (const ax of [C.ALLEY_1_X, C.ALLEY_2_X]) {
      writeInst(buf, n++, ax, ay, C.ALLEY_WIDTH, ah, ar, ag, ab, 1);
      writeInst(buf, n++, ax - C.ALLEY_WIDTH/2, ay, 1.5, ah, sr, sg, sb, 0.6);
      writeInst(buf, n++, ax + C.ALLEY_WIDTH/2, ay, 1.5, ah, sr, sg, sb, 0.6);
    }

    const cwW = C.ALLEY_WIDTH - 2;
    const stripeH = 2.5, stripeGap = 4;
    const roads = [
      { cy: C.HILLTOP_STREET_Y, h: C.HILLTOP_STREET_H },
      { cy: C.MAIN_STREET_Y,    h: C.MAIN_STREET_H },
      { cy: C.LOWER_STREET_Y,   h: C.LOWER_STREET_H },
      { cy: C.RIVERSIDE_STREET_Y, h: C.RIVERSIDE_STREET_H },
    ];
    for (const ax of [C.ALLEY_1_X, C.ALLEY_2_X]) {
      for (const road of roads) {
        for (let sy = road.cy - road.h/2 + 1; sy < road.cy + road.h/2; sy += stripeGap) {
          writeInst(buf, n++, ax, sy, cwW, stripeH, 0.90, 0.90, 0.90, 0.8);
        }
      }
    }

    writeInst(buf, n++, C.WORLD_MIN_X + 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, C.WORLD_MAX_X - 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 42, W, 4, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 82, W, 2, 0.1, 0.1, 0.2, 0.5);
    return n - start;
  }

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
      const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.45;
      const sz = C.BALL_RADIUS * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, 0.95, 0.40 - age * 0.2, 0.08, alpha, 0, 1);
    }
    const r = isFl ? 1 : 0.95, g = isFl ? 1 : 0.55, bv = isFl ? 1 : 0.10;
    writeInst(buf, n++, b.x, b.y, C.BALL_RADIUS * 2, C.BALL_RADIUS * 2, r, g, bv, 1, 0, 1);
    return n - start;
  }
}
