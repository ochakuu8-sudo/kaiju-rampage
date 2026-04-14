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
import { Camera } from './camera';
import { getStage, generateChunk, getInitialCityRoadData } from './stages';
import type { ChunkData, ChunkSpecialArea, ResolvedHorizontalRoad, ResolvedVerticalRoad, GroundTile } from './stages';
import type { Intersection } from './grid';
import { resolveCircleOBB, clampSpeed, rand, randInt } from './physics';
import type { BuildingData } from './entities';

const SHARED_BUF = new Float32Array(20000 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'game_over';

export class Game {
  private renderer:  Renderer;
  private input:     InputManager;
  private sound:     SoundEngine;
  private humans:    HumanManager;
  private particles: ParticleManager;
  private juice:     JuiceManager;
  private ui:        UIManager;
  private camera:    Camera;
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

  // チャンク管理
  private loadedChunks: Map<number, ChunkData> = new Map();
  private nextChunkId = 0;
  // 初期都市のセル地面タイル
  private initialCityGrounds: GroundTile[] = [];

  private bgTopR = 0.52; private bgTopG = 0.74; private bgTopB = 0.96;
  private bgBottomR = 0.38; private bgBottomG = 0.36; private bgBottomB = 0.33;

  // 坂のカメラ相対オフセット (スクリーン固定)
  private readonly SLOPE_L_BASE = { cx: -132.5, cy_off: -155, hw: 73, hh: 6, angle: -0.856 };
  private readonly SLOPE_R_BASE = { cx:  132.5, cy_off: -155, hw: 73, hh: 6, angle:  0.856 };

  private getSlopeL() {
    const b = this.SLOPE_L_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }
  private getSlopeR() {
    const b = this.SLOPE_R_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer  = new Renderer(canvas);
    this.input     = new InputManager(canvas);
    this.sound     = new SoundEngine();
    this.humans    = new HumanManager();
    this.particles = new ParticleManager();
    this.juice     = new JuiceManager();
    this.ui        = new UIManager();
    this.camera    = new Camera();
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
    this.lifeTimer     = C.INITIAL_TIME;
    this.waveElapsed   = 0;
    this.totalDestroys = 0;
    this.totalHumans   = 0;
    this.state         = 'playing';
    this.stateTimer    = 0;
    this.ui.setDistance(0);
    this.ui.setZone(0);
    this.ui.setTimer(C.INITIAL_TIME);
    this.ui.setLifeGauge(C.INITIAL_TIME, C.INITIAL_TIME);
  }

  private loadCity() {
    const cfg = getStage(1);
    this.buildings.load(cfg.buildings);
    this.furniture.load(cfg.furniture);
    this.vehicles.load(cfg.vehicles);
    this.initialCityGrounds = cfg.grounds;
    this.bgTopR = cfg.bgTopR; this.bgTopG = cfg.bgTopG; this.bgTopB = cfg.bgTopB;
    this.bgBottomR = cfg.bgBottomR; this.bgBottomG = cfg.bgBottomG; this.bgBottomB = cfg.bgBottomB;
    this.humans.reset();
    this.humans.resetRoads();
    this.particles.reset();
    this.camera.reset();
    this.loadedChunks.clear();
    this.nextChunkId = 0;
    this.ball.resetWithCamera(this.camera.y);
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
        this.ball.resetWithCamera(this.camera.y);
        this.state = 'playing';
      }
      return;
    }

    // === playing ===
    const dt = this.juice.getGameDt(rawDt);

    // カメラ更新（スクロール）
    this.camera.update(dt);

    this.flippers[0].setPressed(this.input.leftPressed);
    this.flippers[1].setPressed(this.input.rightPressed);
    // フリッパーをカメラに追従させる
    for (const fl of this.flippers) {
      fl.pivotY = C.FLIPPER_PIVOT_Y + this.camera.y;
    }
    this.flippers[0].update(dt);
    this.flippers[1].update(dt);

    if (dt > 0) this.updateBall(dt);

    this.buildings.update(dt);
    this.furniture.update(dt);
    this.vehicles.update(dt, this.camera.y);
    this.humans.update(dt, this.ball.x, this.ball.y, this.camera.y);
    this.particles.update(dt);
    this.updateChunks();

    // ライフタイマー減少
    this.lifeTimer -= rawDt;
    this.ui.setTimer(Math.max(0, this.lifeTimer));
    this.ui.setLifeGauge(Math.max(0, this.lifeTimer), C.INITIAL_TIME);
    if (this.lifeTimer <= 0) {
      this.onGameOver();
      return;
    }

    // 距離・ゾーン表示を更新
    this.ui.setDistance(this.camera.distanceMeters);
    this.ui.setZone(this.nextChunkId);

  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (!b.active) return;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const SUB = speed > 15 ? 4 : speed > 8 ? 2 : 1;
    const dts = dt / SUB;
    let wallSoundNeeded = false, flipperSoundNeeded = false;
    let bldResult: { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null = null;

    for (let s = 0; s < SUB; s++) {
      b.vy -= C.GRAVITY * dts * 60;
      b.x  += b.vx * dts * 60;
      b.y  += b.vy * dts * 60;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
      const camTop = this.camera.y + C.WORLD_MAX_Y;
      if (b.x - C.BALL_RADIUS < C.WORLD_MIN_X) { b.x = C.WORLD_MIN_X + C.BALL_RADIUS; b.vx = Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.x + C.BALL_RADIUS > C.WORLD_MAX_X) { b.x = C.WORLD_MAX_X - C.BALL_RADIUS; b.vx = -Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.y + C.BALL_RADIUS > camTop - 40) { b.y = camTop - 40 - C.BALL_RADIUS; b.vy = -Math.abs(b.vy) * C.WALL_DAMPING; wallSoundNeeded = true; }
      for (const slope of [this.getSlopeL(), this.getSlopeR()]) {
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
      // 人間を潰すとカメラ加速（タイマー回復は建物破壊のみ）
      for (let k = 0; k < crushed.length; k++) this.camera.addSpeedBonus();
      this.sound.humanCrush(1);
      this.juice.shake(C.SHAKE_HUMAN_AMP, C.SHAKE_HUMAN_DUR);
    }

    if (b.y < this.camera.y + C.FALLOFF_Y) this.onBallLost();
    b.recordTrail();
  }

  private onBuildingDestroyed(bld: BuildingData) {
    const cx = bld.x + bld.w / 2;
    const cy = bld.y + bld.h / 2;
    this.totalDestroys++;
    this.sound.buildingDestroy();
    // 建物破壊でタイマー加算（スコアに応じて多め）
    this.lifeTimer = Math.min(C.INITIAL_TIME, this.lifeTimer + C.TIME_BUILDING * bld.maxHp);

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

  // ===== チャンク管理 =====

  private updateChunks() {
    const spawnAhead  = C.CHUNK_SPAWN_AHEAD;
    const despawnBehind = C.CHUNK_DESPAWN_BEHIND;
    const spawnThreshold = this.camera.top + spawnAhead;
    const despawnThreshold = this.camera.bottom - despawnBehind;

    // 上方向に新チャンクを先読みスポーン
    while (true) {
      const nextTop = C.WORLD_MAX_Y + (this.nextChunkId + 1) * C.CHUNK_HEIGHT;
      if (nextTop > spawnThreshold) break;
      this._spawnChunk(this.nextChunkId);
      this.nextChunkId++;
    }

    // カメラ下端より遠く離れたチャンクをデスポーン
    for (const [id, chunk] of this.loadedChunks) {
      if (chunk.baseY + C.CHUNK_HEIGHT < despawnThreshold) {
        this._despawnChunk(id);
      }
    }
  }

  private _spawnChunk(chunkId: number) {
    if (this.loadedChunks.has(chunkId)) return;
    const chunk = generateChunk(chunkId);
    this.buildings.loadChunk(chunk.buildings);
    this.furniture.loadChunk(chunkId, chunk.furniture);
    this.vehicles.addChunkLanes(chunkId, chunk.roads);
    for (const road of chunk.roads) {
      this.humans.addRoad(road.y, road.h / 2 + 2);
    }
    this.loadedChunks.set(chunkId, chunk);
  }

  private _despawnChunk(chunkId: number) {
    this.buildings.unloadChunk(chunkId);
    this.furniture.unloadChunk(chunkId);
    this.vehicles.removeChunkLanes(chunkId);
    this.humans.removeRoadsBelow(this.camera.bottom - C.CHUNK_DESPAWN_BEHIND);
    this.loadedChunks.delete(chunkId);
  }

  private onBallLost() {
    this.ball.active = false;
    this.lifeTimer = Math.max(0, this.lifeTimer + C.TIME_BALL_LOST);
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
      this.ui.showGameOver(this.camera.distanceMeters, this.totalDestroys, this.totalHumans);
    }, 800);
  }

  private render() {
    const shake = this.juice.getShake();
    this.renderer.updateProjection(this.camera.y);
    this.renderer.clear(0.35, 0.65, 0.28);

    let n = 0;
    n += this.fillWalls(SHARED_BUF, n);
    n += this.fillChunkRoads(SHARED_BUF, n);
    n += this.fillSpecialAreas(SHARED_BUF, n); // 公園・駐車場は道路の上・路地の下
    n += this.fillIntersections(SHARED_BUF, n); // 交差点ディテールを道路の上に重ねる
    n += this.buildings.fillInstances(SHARED_BUF, n, this.camera.y);
    n += this.furniture.fillInstances(SHARED_BUF, n, this.camera.y);
    n += this.vehicles.fillInstances(SHARED_BUF, n, this.camera.y);
    n += this.fillBulbs(SHARED_BUF, n);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    n = 0;
    n += this.humans.fillInstances(SHARED_BUF, n, this.camera.y);
    n += this.fillFlippers(SHARED_BUF, n);
    n += this.fillBall(SHARED_BUF, n);
    n += this.particles.fillInstances(SHARED_BUF, n, this.camera.y);
    this.renderer.drawInstances(SHARED_BUF, n, shake);

    this.renderer.drawFlash(this.juice.flashR, this.juice.flashG, this.juice.flashB, this.juice.flashAlpha);
  }

  /** 1 タイル分の地面を描画。型別のベース色 + ディテールを出力。 */
  private drawGroundTile(buf: Float32Array, idx: number, tile: GroundTile): number {
    let n = idx;
    const { type, x, y, w, h } = tile;
    switch (type) {
      case 'concrete': {
        writeInst(buf, n++, x, y, w, h, 0.68, 0.66, 0.62, 1);
        // expansion joint lines (水平 2 本)
        writeInst(buf, n++, x, y - h * 0.25, w, 0.5, 0.48, 0.46, 0.42, 0.75);
        writeInst(buf, n++, x, y + h * 0.25, w, 0.5, 0.48, 0.46, 0.42, 0.75);
        // subtle stains
        writeInst(buf, n++, x - w * 0.15, y + h * 0.1, w * 0.18, h * 0.1, 0.58, 0.56, 0.52, 0.4);
        break;
      }
      case 'stone_pavement': {
        writeInst(buf, n++, x, y, w, h, 0.55, 0.50, 0.42, 1);
        // 3x3 stone grid lines
        const hs = h / 3, ws = w / 3;
        for (let i = 1; i < 3; i++) {
          writeInst(buf, n++, x, y - h / 2 + i * hs, w, 0.6, 0.32, 0.28, 0.22, 0.85);
          writeInst(buf, n++, x - w / 2 + i * ws, y, 0.6, h, 0.32, 0.28, 0.22, 0.85);
        }
        // brick-offset highlight (one lighter tile)
        writeInst(buf, n++, x - ws / 2, y - hs / 2, ws * 0.82, hs * 0.82, 0.62, 0.57, 0.48, 0.35);
        writeInst(buf, n++, x + ws / 2, y + hs / 2, ws * 0.82, hs * 0.82, 0.62, 0.57, 0.48, 0.35);
        break;
      }
      case 'asphalt': {
        writeInst(buf, n++, x, y, w, h, 0.30, 0.30, 0.32, 1);
        // lighter specks
        writeInst(buf, n++, x - w * 0.25, y - h * 0.2, 2, 2, 0.48, 0.48, 0.50, 0.5);
        writeInst(buf, n++, x + w * 0.1,  y + h * 0.15, 2, 2, 0.48, 0.48, 0.50, 0.5);
        writeInst(buf, n++, x - w * 0.05, y + h * 0.3, 2, 2, 0.48, 0.48, 0.50, 0.5);
        writeInst(buf, n++, x + w * 0.25, y - h * 0.1, 2, 2, 0.42, 0.42, 0.44, 0.55);
        // faint worn tire track
        writeInst(buf, n++, x, y, w * 0.7, 0.6, 0.24, 0.24, 0.26, 0.55);
        break;
      }
      case 'wood_deck': {
        writeInst(buf, n++, x, y, w, h, 0.60, 0.42, 0.24, 1);
        // plank lines (4 縦)
        for (let i = 1; i < 5; i++) {
          writeInst(buf, n++, x - w / 2 + i * (w / 5), y, 0.5, h, 0.35, 0.22, 0.10, 0.85);
        }
        // 木目ハイライト
        writeInst(buf, n++, x - w * 0.15, y - h * 0.2, w * 0.3, 0.3, 0.75, 0.52, 0.30, 0.4);
        writeInst(buf, n++, x + w * 0.1,  y + h * 0.25, w * 0.35, 0.3, 0.75, 0.52, 0.30, 0.4);
        break;
      }
      case 'tile': {
        writeInst(buf, n++, x, y, w, h, 0.78, 0.74, 0.68, 1);
        // 3x3 grid
        const hs = h / 3, ws = w / 3;
        for (let i = 1; i < 3; i++) {
          writeInst(buf, n++, x, y - h / 2 + i * hs, w, 0.4, 0.55, 0.52, 0.48, 0.8);
          writeInst(buf, n++, x - w / 2 + i * ws, y, 0.4, h, 0.55, 0.52, 0.48, 0.8);
        }
        // 1 枚だけ色違い (accent)
        writeInst(buf, n++, x - ws, y - hs, ws * 0.85, hs * 0.85, 0.85, 0.80, 0.72, 0.5);
        break;
      }
      case 'grass': {
        writeInst(buf, n++, x, y, w, h, 0.32, 0.55, 0.22, 1);
        // darker patches
        writeInst(buf, n++, x - w * 0.2, y - h * 0.2, w * 0.5, h * 0.3, 0.26, 0.48, 0.18, 0.55);
        writeInst(buf, n++, x + w * 0.15, y + h * 0.15, w * 0.35, h * 0.25, 0.38, 0.62, 0.26, 0.55);
        // 草の spikes
        writeInst(buf, n++, x + w * 0.3, y - h * 0.1, 1, 2, 0.52, 0.74, 0.30, 0.8);
        writeInst(buf, n++, x - w * 0.1, y + h * 0.3, 1, 2, 0.52, 0.74, 0.30, 0.8);
        writeInst(buf, n++, x + w * 0.0, y - h * 0.3, 1, 2, 0.52, 0.74, 0.30, 0.8);
        break;
      }
      case 'dirt': {
        writeInst(buf, n++, x, y, w, h, 0.45, 0.33, 0.20, 1);
        // 色ムラ
        writeInst(buf, n++, x - w * 0.2, y, w * 0.4, h * 0.4, 0.38, 0.28, 0.16, 0.55);
        writeInst(buf, n++, x + w * 0.15, y - h * 0.25, w * 0.35, h * 0.3, 0.52, 0.38, 0.24, 0.45);
        writeInst(buf, n++, x - w * 0.1, y + h * 0.25, w * 0.3, h * 0.25, 0.40, 0.30, 0.18, 0.5);
        // 小石
        writeInst(buf, n++, x + w * 0.25, y + h * 0.1, 1.5, 1.5, 0.55, 0.50, 0.42, 0.75, 0, 1);
        writeInst(buf, n++, x - w * 0.25, y - h * 0.15, 1.5, 1.5, 0.55, 0.50, 0.42, 0.75, 0, 1);
        break;
      }
      case 'fallen_leaves': {
        writeInst(buf, n++, x, y, w, h, 0.40, 0.30, 0.18, 1);
        // 色とりどりの落ち葉
        writeInst(buf, n++, x - w * 0.25, y - h * 0.20, 2.5, 2, 0.85, 0.35, 0.12, 0.90, 0, 1);
        writeInst(buf, n++, x + w * 0.15, y - h * 0.30, 2.5, 2, 0.92, 0.70, 0.15, 0.90, 0, 1);
        writeInst(buf, n++, x - w * 0.05, y + h * 0.10, 2.5, 2, 0.78, 0.25, 0.10, 0.90, 0, 1);
        writeInst(buf, n++, x + w * 0.30, y + h * 0.05, 2.5, 2, 0.88, 0.55, 0.20, 0.90, 0, 1);
        writeInst(buf, n++, x - w * 0.20, y + h * 0.30, 2.5, 2, 0.72, 0.42, 0.15, 0.90, 0, 1);
        writeInst(buf, n++, x + w * 0.05, y - h * 0.05, 2.5, 2, 0.95, 0.60, 0.18, 0.90, 0, 1);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.28, 2.5, 2, 0.65, 0.28, 0.08, 0.90, 0, 1);
        writeInst(buf, n++, x - w * 0.12, y - h * 0.12, 2.5, 2, 0.90, 0.50, 0.15, 0.90, 0, 1);
        break;
      }
      case 'gravel': {
        writeInst(buf, n++, x, y, w, h, 0.58, 0.54, 0.48, 1);
        // 枯山水の砂紋 (水平の薄い波線)
        writeInst(buf, n++, x, y - h * 0.15, w * 0.9, 0.4, 0.72, 0.68, 0.60, 0.45);
        writeInst(buf, n++, x, y + h * 0.15, w * 0.9, 0.4, 0.72, 0.68, 0.60, 0.45);
        // 小石
        const gravelPts: [number, number][] = [
          [-0.3, -0.25], [0.1, -0.2], [-0.1, 0.05], [0.25, 0.1], [-0.2, 0.25], [0.3, 0.3],
          [-0.35, 0.05], [0.0, 0.0], [0.35, -0.15],
        ];
        for (const [dxp, dyp] of gravelPts) {
          writeInst(buf, n++, x + w * dxp, y + h * dyp, 1.8, 1.8, 0.45, 0.42, 0.38, 0.85, 0, 1);
        }
        break;
      }
    }
    return n - idx;
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

    // 上部ゾーン: HILLTOP以上はチャンク背景が覆うまで初期色で埋める
    const topFill = Math.max(C.WORLD_MAX_Y, this.camera.top + 50);
    writeInst(buf, n++, 0, (topFill + htLow)/2, W, topFill - htLow, zrR, zrG, zrB, 1);
    const maTop = C.MAIN_STREET_Y + C.MAIN_STREET_H/2 + C.SIDEWALK_H;
    gf(htLow, maTop, zrR, zrG, zrB);
    const loTop = C.LOWER_STREET_Y + C.LOWER_STREET_H/2 + C.SIDEWALK_H;
    gf(maLow, loTop, zcR, zcG, zcB);
    const rvTop = C.RIVERSIDE_STREET_Y + C.RIVERSIDE_STREET_H/2 + C.SIDEWALK_H;
    gf(loLow, rvTop, zvR, zvG, zvB);
    gf(rvLow, C.WORLD_MIN_Y, zsR, zsG, zsB);

    // ── 初期都市セル地面 (ゾーン bg の上、道路の下) ──────────
    for (const tile of this.initialCityGrounds) {
      n += this.drawGroundTile(buf, n, tile);
    }

    const sL = this.getSlopeL(), sR = this.getSlopeR();
    writeInst(buf, n++, sL.cx, sL.cy, sL.hw*2, sL.hh*2, 0.38, 0.58, 0.30, 1, sL.angle);
    writeInst(buf, n++, sL.cx, sL.cy - sL.hh - 0.5, sL.hw*2, 2, 0.85, 0.85, 0.85, 0.5, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy, sR.hw*2, sR.hh*2, 0.38, 0.58, 0.30, 1, sR.angle);
    writeInst(buf, n++, sR.cx, sR.cy - sR.hh - 0.5, sR.hw*2, 2, 0.85, 0.85, 0.85, 0.5, sR.angle);

    const pivY = this.camera.y + C.FLIPPER_PIVOT_Y;
    writeInst(buf, n++, -C.FLIPPER_PIVOT_X, pivY - 20, 6, 40, 0.4, 0.4, 0.55, 1);
    writeInst(buf, n++,  C.FLIPPER_PIVOT_X, pivY - 20, 6, 40, 0.4, 0.4, 0.55, 1);

    const [rr,rg,rb] = C.ROAD_COLOR;
    const [sr,sg,sb] = C.SIDEWALK_COLOR;
    const [lr2,lg2,lb2] = C.ROAD_LINE_COLOR;
    const [cbR,cbG,cbB] = C.CURB_COLOR;
    const [mhR,mhG,mhB] = C.MANHOLE_COLOR;
    const [pvR,pvG,pvB,pvA] = C.PAVING_COLOR;

    type RoadClass = 'avenue' | 'street';

    /**
     * 1 本の横道路セグメントを描画 (xMin/xMax で部分幅対応)。
     * 端点が世界壁なら歩道/縁石は全幅、部分幅なら xMin..xMax の範囲のみ。
     */
    const drawHRoad = (cy: number, h: number, xMin: number, xMax: number, cls: RoadClass = 'street') => {
      const segW = xMax - xMin;
      const segCX = (xMin + xMax) / 2;
      const swH = cls === 'avenue' ? 6 : 4;
      const swTop = cy + h/2 + swH/2;
      const swBot = cy - h/2 - swH/2;

      // 植栽帯 (segment 内のみ)
      writeInst(buf, n++, segCX, swTop + swH/2 + 1.5, segW, 3, plR, plG, plB, 1);
      writeInst(buf, n++, segCX, swBot - swH/2 - 1.5, segW, 3, plR, plG, plB, 1);
      // 歩道
      writeInst(buf, n++, segCX, swTop, segW, swH, sr, sg, sb, 1);
      writeInst(buf, n++, segCX, swBot, segW, swH, sr, sg, sb, 1);
      // 舗装パターン
      for (let x = Math.ceil(xMin/12)*12; x <= xMax; x += 12) {
        writeInst(buf, n++, x, swTop, 1, swH, pvR, pvG, pvB, pvA);
        writeInst(buf, n++, x, swBot, 1, swH, pvR, pvG, pvB, pvA);
      }
      // 縁石
      writeInst(buf, n++, segCX, cy + h/2 + 0.5, segW, 1, cbR, cbG, cbB, 1);
      writeInst(buf, n++, segCX, cy - h/2 - 0.5, segW, 1, cbR, cbG, cbB, 1);
      // 道路本体
      writeInst(buf, n++, segCX, cy, segW, h, rr, rg, rb, 1);
      // 中央線
      if (cls === 'avenue') {
        writeInst(buf, n++, segCX, cy + 2, segW, 1.5, lr2, lg2, lb2, 1);
        writeInst(buf, n++, segCX, cy - 2, segW, 1.5, lr2, lg2, lb2, 1);
        for (let x = Math.ceil(xMin/18)*18; x <= xMax - 12; x += 18) {
          writeInst(buf, n++, x + 6, cy + 5, 10, 1, 0.95, 0.95, 0.95, 0.5);
          writeInst(buf, n++, x + 6, cy - 5, 10, 1, 0.95, 0.95, 0.95, 0.5);
        }
      } else {
        for (let x = Math.ceil(xMin/14)*14; x <= xMax - 10; x += 14) {
          writeInst(buf, n++, x + 5, cy, 8, 1.2, 0.95, 0.95, 0.95, 0.55);
        }
      }
      // マンホール
      for (let x = Math.ceil(xMin/55)*55; x <= xMax - 10; x += 55) {
        writeInst(buf, n++, x, cy, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
      // 端点が世界壁でない場合は袋小路マーカー
      if (xMin > C.WORLD_MIN_X + 1) {
        writeInst(buf, n++, xMin + 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
      if (xMax < C.WORLD_MAX_X - 1) {
        writeInst(buf, n++, xMax - 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
    };

    /**
     * 1 本の縦道路セグメントを描画 (yMin/yMax で部分高さ対応)。
     */
    const drawVRoad = (cx: number, w: number, yMin: number, yMax: number, cls: RoadClass = 'street') => {
      const segH = yMax - yMin;
      const segCY = (yMin + yMax) / 2;
      const swW = cls === 'avenue' ? 6 : 4;
      // 縦道路は左右に歩道
      writeInst(buf, n++, cx - w/2 - swW/2, segCY, swW, segH, sr, sg, sb, 1);
      writeInst(buf, n++, cx + w/2 + swW/2, segCY, swW, segH, sr, sg, sb, 1);
      // 縁石
      writeInst(buf, n++, cx - w/2 - 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      writeInst(buf, n++, cx + w/2 + 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      // 道路本体
      writeInst(buf, n++, cx, segCY, w, segH, rr, rg, rb, 1);
      // 中央破線
      for (let y = Math.ceil(yMin/14)*14; y <= yMax - 10; y += 14) {
        writeInst(buf, n++, cx, y + 5, 1.2, 8, 0.95, 0.95, 0.95, 0.55);
      }
      // マンホール
      for (let y = Math.ceil(yMin/55)*55; y <= yMax - 10; y += 55) {
        writeInst(buf, n++, cx, y, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
    };

    // 初期都市の道路データを grid から取得して描画
    const initialRoadData = getInitialCityRoadData();
    for (const r of initialRoadData.horizontalRoads) {
      drawHRoad(r.cy, r.h, r.xMin, r.xMax, r.cls);
    }
    for (const r of initialRoadData.verticalRoads) {
      drawVRoad(r.cx, r.w, r.yMin, r.yMax, r.cls);
    }

    // ─── リバーサイド = 川 ──────────────────────────────────
    const [rvcR,rvcG,rvcB] = C.RIVER_COLOR;
    const [rvlR,rvlG,rvlB,rvlA] = C.RIVER_LIGHT;
    const [rvbR,rvbG,rvbB] = C.RIVER_BANK;
    const [brR,brG,brB] = C.BRIDGE_COLOR;
    const [brlR,brlG,brlB] = C.BRIDGE_RAIL_COLOR;
    const drawRiver = (cy: number, h: number) => {
      const bankH = 3;
      // 上岸 (遊歩道)
      writeInst(buf, n++, 0, cy + h/2 + bankH/2, W, bankH, rvbR, rvbG, rvbB, 1);
      // 下岸
      writeInst(buf, n++, 0, cy - h/2 - bankH/2, W, bankH, rvbR, rvbG, rvbB, 1);
      // 川本体
      writeInst(buf, n++, 0, cy, W, h, rvcR, rvcG, rvcB, 1);
      // 波紋 (2-3 本の明るい横線)
      writeInst(buf, n++, 0, cy + 2, W, 0.8, rvlR, rvlG, rvlB, rvlA);
      writeInst(buf, n++, 0, cy - 2, W, 0.8, rvlR, rvlG, rvlB, rvlA);
      // 橋 (路地と同じ X 座標に 2 本)
      for (const bx of [C.ALLEY_1_X, C.ALLEY_2_X]) {
        writeInst(buf, n++, bx, cy, C.ALLEY_WIDTH + 4, h + bankH * 2 + 2, brR, brG, brB, 1);
        // 欄干
        writeInst(buf, n++, bx, cy + h/2 + bankH + 1, C.ALLEY_WIDTH + 4, 1, brlR, brlG, brlB, 1);
        writeInst(buf, n++, bx, cy - h/2 - bankH - 1, C.ALLEY_WIDTH + 4, 1, brlR, brlG, brlB, 1);
      }
    };
    drawRiver(C.RIVERSIDE_STREET_Y, C.RIVERSIDE_STREET_H);

    // 側壁・上部ガイド: カメラ追従（スクリーン固定）
    const cy = this.camera.y;
    writeInst(buf, n++, C.WORLD_MIN_X + 2, cy, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, C.WORLD_MAX_X - 2, cy, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, cy + C.WORLD_MAX_Y - 42, W, 4, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, cy + C.WORLD_MAX_Y - 82, W, 2, 0.1, 0.1, 0.2, 0.5);
    return n - start;
  }

  /** チャンク由来の背景・道路を描画 (grid-based) */
  private fillChunkRoads(buf: Float32Array, start: number): number {
    let n = start;
    const W = 360;
    const [rr, rg, rb] = C.ROAD_COLOR;
    const [sw_r, sw_g, sw_b] = C.SIDEWALK_COLOR;
    const [plR, plG, plB] = C.PLANTING_COLOR;
    const [cbR, cbG, cbB] = C.CURB_COLOR;
    const [mhR, mhG, mhB] = C.MANHOLE_COLOR;
    const [pvR, pvG, pvB, pvA] = C.PAVING_COLOR;
    const [lr2, lg2, lb2] = C.ROAD_LINE_COLOR;

    const zoneBg: [number,number,number][] = [
      [C.ZONE_RESIDENTIAL[0], C.ZONE_RESIDENTIAL[1], C.ZONE_RESIDENTIAL[2]],
      [C.ZONE_COMMERCIAL[0],  C.ZONE_COMMERCIAL[1],  C.ZONE_COMMERCIAL[2]],
      [C.ZONE_OFFICE_BG[0],   C.ZONE_OFFICE_BG[1],   C.ZONE_OFFICE_BG[2]],
    ];

    // 水平道路セグメント描画 (部分幅対応)
    const drawH = (cy: number, h: number, xMin: number, xMax: number, cls: 'avenue'|'street') => {
      const segW = xMax - xMin;
      const segCX = (xMin + xMax) / 2;
      const swH = cls === 'avenue' ? 6 : 4;
      const swTop = cy + h/2 + swH/2;
      const swBot = cy - h/2 - swH/2;
      writeInst(buf, n++, segCX, swTop + swH/2 + 1.5, segW, 3, plR, plG, plB, 1);
      writeInst(buf, n++, segCX, swBot - swH/2 - 1.5, segW, 3, plR, plG, plB, 1);
      writeInst(buf, n++, segCX, swTop, segW, swH, sw_r, sw_g, sw_b, 1);
      writeInst(buf, n++, segCX, swBot, segW, swH, sw_r, sw_g, sw_b, 1);
      for (let x = Math.ceil(xMin/12)*12; x <= xMax; x += 12) {
        writeInst(buf, n++, x, swTop, 1, swH, pvR, pvG, pvB, pvA);
        writeInst(buf, n++, x, swBot, 1, swH, pvR, pvG, pvB, pvA);
      }
      writeInst(buf, n++, segCX, cy + h/2 + 0.5, segW, 1, cbR, cbG, cbB, 1);
      writeInst(buf, n++, segCX, cy - h/2 - 0.5, segW, 1, cbR, cbG, cbB, 1);
      writeInst(buf, n++, segCX, cy, segW, h, rr, rg, rb, 1);
      if (cls === 'avenue') {
        writeInst(buf, n++, segCX, cy + 2, segW, 1.5, lr2, lg2, lb2, 1);
        writeInst(buf, n++, segCX, cy - 2, segW, 1.5, lr2, lg2, lb2, 1);
      } else {
        for (let x = Math.ceil(xMin/14)*14; x <= xMax - 10; x += 14) {
          writeInst(buf, n++, x + 5, cy, 8, 1.2, 0.95, 0.95, 0.95, 0.55);
        }
      }
      for (let x = Math.ceil(xMin/55)*55; x <= xMax - 10; x += 55) {
        writeInst(buf, n++, x, cy, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
      // 袋小路マーカー (世界壁でない端点)
      if (xMin > C.WORLD_MIN_X + 1) {
        writeInst(buf, n++, xMin + 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
      if (xMax < C.WORLD_MAX_X - 1) {
        writeInst(buf, n++, xMax - 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
    };

    // 垂直道路セグメント描画 (部分高さ対応)
    const drawV = (cx: number, w: number, yMin: number, yMax: number, cls: 'avenue'|'street') => {
      const segH = yMax - yMin;
      const segCY = (yMin + yMax) / 2;
      const swW = cls === 'avenue' ? 6 : 4;
      writeInst(buf, n++, cx - w/2 - swW/2, segCY, swW, segH, sw_r, sw_g, sw_b, 1);
      writeInst(buf, n++, cx + w/2 + swW/2, segCY, swW, segH, sw_r, sw_g, sw_b, 1);
      writeInst(buf, n++, cx - w/2 - 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      writeInst(buf, n++, cx + w/2 + 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      writeInst(buf, n++, cx, segCY, w, segH, rr, rg, rb, 1);
      for (let y = Math.ceil(yMin/14)*14; y <= yMax - 10; y += 14) {
        writeInst(buf, n++, cx, y + 5, 1.2, 8, 0.95, 0.95, 0.95, 0.55);
      }
      for (let y = Math.ceil(yMin/55)*55; y <= yMax - 10; y += 55) {
        writeInst(buf, n++, cx, y, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
    };

    for (const chunk of this.loadedChunks.values()) {
      const { baseY, chunkId } = chunk;
      const [bgR, bgG, bgB] = zoneBg[chunkId % 3];
      // チャンク背景
      writeInst(buf, n++, 0, baseY + C.CHUNK_HEIGHT / 2, W, C.CHUNK_HEIGHT, bgR, bgG, bgB, 1);
      // セル地面 (背景の上、道路の下)
      for (const tile of chunk.grounds) {
        n += this.drawGroundTile(buf, n, tile);
      }
      // 水平道路
      for (const r of chunk.horizontalRoads) {
        drawH(r.cy, r.h, r.xMin, r.xMax, r.cls);
      }
      // 垂直道路
      for (const r of chunk.verticalRoads) {
        drawV(r.cx, r.w, r.yMin, r.yMax, r.cls);
      }
    }
    return n - start;
  }

  /** 公園・駐車場などの特殊エリア地面を描画 */
  private fillSpecialAreas(buf: Float32Array, start: number): number {
    let n = start;
    const W = 360;
    const camBot = this.camera.bottom - 60;
    const camTop = this.camera.top + 60;
    const [pgR, pgG, pgB] = C.PARK_GROUND_COLOR;
    const [ppR, ppG, ppB] = C.PARK_PATH_COLOR;
    const [plR, plG, plB] = C.PARKING_LOT_COLOR;
    const [lnR, lnG, lnB] = C.PARKING_LINE_COLOR;

    for (const chunk of this.loadedChunks.values()) {
      for (const area of chunk.specialAreas) {
        if (area.y + area.h / 2 < camBot || area.y - area.h / 2 > camTop) continue;

        if (area.type === 'park') {
          // 緑地ベース
          writeInst(buf, n++, 0, area.y, W, area.h, pgR, pgG, pgB, 1);
          // 周囲の低木帯（濃いめの緑）
          writeInst(buf, n++, 0, area.y + area.h / 2 - 4, W, 8,  pgR * 0.82, pgG * 0.82, pgB * 0.72, 1);
          writeInst(buf, n++, 0, area.y - area.h / 2 + 4, W, 8,  pgR * 0.82, pgG * 0.82, pgB * 0.72, 1);
          // 遊歩道（水平）
          writeInst(buf, n++, 0, area.y, W, 4, ppR, ppG, ppB, 0.75);
          // 遊歩道（縦・路地位置）
          writeInst(buf, n++, C.ALLEY_1_X, area.y, 5, area.h, ppR, ppG, ppB, 0.55);
          writeInst(buf, n++, C.ALLEY_2_X, area.y, 5, area.h, ppR, ppG, ppB, 0.55);
          // 中央広場（少し明るい円形）
          writeInst(buf, n++, 0, area.y, 22, 22, pgR * 1.12, pgG * 1.08, pgB * 0.95, 0.7, 0, 1);
        } else if (area.type === 'parking_lot') {
          // アスファルトベース
          writeInst(buf, n++, 0, area.y, W, area.h, plR, plG, plB, 1);
          // 中央仕切り線
          writeInst(buf, n++, 0, area.y, W, 2, lnR, lnG, lnB, 0.6);
          // 縦の駐車スペース区切り線
          for (let xi = -168; xi <= 168; xi += 26) {
            writeInst(buf, n++, xi, area.y, 1.5, area.h * 0.88, lnR, lnG, lnB, 0.45);
          }
          // 駐車場入り口マーク
          writeInst(buf, n++, C.ALLEY_1_X, area.y, C.ALLEY_WIDTH + 2, area.h, plR * 1.05, plG * 1.05, plB * 1.08, 1);
          writeInst(buf, n++, C.ALLEY_2_X, area.y, C.ALLEY_WIDTH + 2, area.h, plR * 1.05, plG * 1.05, plB * 1.08, 1);
        }
      }
    }
    return n - start;
  }

  /**
   * 縦路地を全背景の上に描画し、全横道路との交差点ストライプを生成する。
   * chunk背景の後に呼ぶことで路地が埋もれない。
   */
  /** 交差点描画 (grid-based): 初期都市 + 全チャンクの交差点を描画 */
  private fillIntersections(buf: Float32Array, start: number): number {
    let n = start;
    const [ixR, ixG, ixB] = C.INTERSECTION_COLOR;
    const [cwR, cwG, cwB, cwA] = C.CROSSWALK_COLOR;
    const [slR, slG, slB, slA] = C.STOPLINE_COLOR;

    const drawOne = (ix: Intersection) => {
      const { x, y, hThickness, vThickness } = ix;
      // 明るいアスファルト塊
      writeInst(buf, n++, x, y, vThickness + 4, hThickness + 2, ixR, ixG, ixB, 1);
      // 横断歩道 (縦道路側・左右)
      const cwLenV = vThickness;
      for (let i = 0; i < 3; i++) {
        const yOff = hThickness/2 - 2 - i * 2;
        writeInst(buf, n++, x, y + yOff, cwLenV, 1.5, cwR, cwG, cwB, cwA);
        writeInst(buf, n++, x, y - yOff, cwLenV, 1.5, cwR, cwG, cwB, cwA);
      }
      // 横断歩道 (横道路側・上下)
      const cwLenH = hThickness;
      for (let i = 0; i < 3; i++) {
        const xOff = vThickness/2 - 2 - i * 2;
        writeInst(buf, n++, x + xOff, y, 1.5, cwLenH, cwR, cwG, cwB, cwA);
        writeInst(buf, n++, x - xOff, y, 1.5, cwLenH, cwR, cwG, cwB, cwA);
      }
      // 停止線 (交差点の 4 方向外側)
      const slOffsetX = vThickness / 2 + 1;
      const slOffsetY = hThickness / 2 + 1;
      writeInst(buf, n++, x - slOffsetX, y, 2, hThickness - 2, slR, slG, slB, slA);
      writeInst(buf, n++, x + slOffsetX, y, 2, hThickness - 2, slR, slG, slB, slA);
      writeInst(buf, n++, x, y - slOffsetY, vThickness - 2, 2, slR, slG, slB, slA);
      writeInst(buf, n++, x, y + slOffsetY, vThickness - 2, 2, slR, slG, slB, slA);
    };

    // 初期都市の交差点
    const initialRoadData = getInitialCityRoadData();
    for (const ix of initialRoadData.intersections) {
      drawOne(ix);
    }
    // チャンクの交差点
    for (const chunk of this.loadedChunks.values()) {
      for (const ix of chunk.intersections) {
        drawOne(ix);
      }
    }

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
