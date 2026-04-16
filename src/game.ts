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
import { resolveCircleOBB, clampSpeed, rand, randInt, circleAABB } from './physics';
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

  private totalDestroys= 0;
  private totalHumans  = 0;
  private totalScore   = 0;

  private state: GameState = 'playing';
  private stateTimer = 0;

  // タイマー
  private timeRemaining = C.TIMER_INITIAL_SEC;

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

    this.initRun();
    this.loadCity();
    this.startLoop();
  }

  private initRun() {
    this.totalDestroys   = 0;
    this.totalHumans     = 0;
    this.totalScore      = 0;
    this.state           = 'playing';
    this.stateTimer      = 0;
    this.timeRemaining   = C.TIMER_INITIAL_SEC;
    this.ui.setDistance(0);
    this.ui.setZone(0);
    this.ui.setSpeedMeter(0, C.SCROLL_MAX);
    this.ui.setTimer(C.TIMER_INITIAL_SEC);
    this.ui.setScore(0);
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
    this.humans.spawnOnStreets(20);  // 3道路 × 20体 = 60体の初期通行人
    // シーン事前配置の humans (行列・観客・通行人)
    for (const h of cfg.prePlacedHumans) {
      this.humans.spawnAt(h.x, h.y);
    }
    this.particles.reset();
    this.camera.reset();
    this.loadedChunks.clear();
    this.nextChunkId = 0;
    this.ball.fullReset();
    this.ball.resetWithCamera(this.camera.y);
  }

  private restart() {
    this.ui.hideGameOver();
    this.initRun();
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

    // スクロール速度・距離 表示を更新
    this.ui.setSpeedMeter(this.camera.scrollSpeed, C.SCROLL_MAX);
    this.ui.setDistance(this.camera.distanceMeters);
    this.ui.setZone(this.nextChunkId);

    // ポップアップレイヤーをカメラ追従 (コンテナ1つだけ更新)
    this.ui.updatePopupLayer(this.camera.y);

    // タイマー更新 (hitstop で止まらないよう rawDt を使用)
    this.timeRemaining -= rawDt;

    // タイマー切れ → ゲームオーバー
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.ui.setTimer(0);
      this.onGameOver();
      return;
    }

    this.ui.setTimer(this.timeRemaining);
  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (!b.active) return;
    const r = b.radius;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    // 1 substep あたりの移動量を ball 半径未満に抑えてトンネリングを防ぐ
    // (ball radius = 9, 速度 40 でも 7 substep で ~5.7 px/substep)
    const SUB = Math.max(1, Math.min(8, Math.ceil(speed / 6)));
    const dts = dt / SUB;

    // 貫通中の建物から抜けたら lastPiercedBld をクリア
    if (b.lastPiercedBld) {
      const pbld = b.lastPiercedBld;
      if (!pbld.active || pbld.destroyTimer > 0 ||
          !circleAABB(b.x, b.y, r, pbld.x, pbld.y, pbld.w, pbld.h)) {
        b.lastPiercedBld = null;
      }
    }
    let wallSoundNeeded = false, flipperSoundNeeded = false;
    let bldResult: { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null = null;

    for (let s = 0; s < SUB; s++) {
      b.vy -= C.GRAVITY * dts * 60;
      b.x  += b.vx * dts * 60;
      b.y  += b.vy * dts * 60;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
      const camTop = this.camera.y + C.WORLD_MAX_Y;
      if (b.x - r < C.WORLD_MIN_X) { b.x = C.WORLD_MIN_X + r; b.vx = Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.x + r > C.WORLD_MAX_X) { b.x = C.WORLD_MAX_X - r; b.vx = -Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.y + r > camTop - 40) { b.y = camTop - 40 - r; b.vy = -Math.abs(b.vy) * C.WALL_DAMPING; wallSoundNeeded = true; }
      for (const slope of [this.getSlopeL(), this.getSlopeR()]) {
        const res = resolveCircleOBB(b.x, b.y, r, b.vx, b.vy, slope);
        if (res) { [b.x, b.y, b.vx, b.vy] = res; wallSoundNeeded = true; break; }
      }
      for (const fl of this.flippers) {
        const res = resolveCircleOBB(b.x, b.y, r, b.vx, b.vy, fl.getOBB());
        if (res) {
          [b.x, b.y, b.vx, b.vy] = res;
          const [nvx, nvy] = fl.applyImpulse(b.vx, b.vy);
          b.vx = nvx; b.vy = nvy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
          flipperSoundNeeded = true; break;
        }
      }
      if (!bldResult) {
        const h = this.buildings.checkBallHit(b.x, b.y, r, b.vx, b.vy, b.lastPiercedBld);
        // 衝突位置に補正 (建物近傍面)。破壊/非破壊の分岐は post-loop で処理
        if (h) { bldResult = h; b.x = h.newBx; b.y = h.newBy; }
      }
    }

    if (flipperSoundNeeded) { this.sound.flipper(); this.juice.ballHitFlash(); }
    else if (wallSoundNeeded) { this.sound.wallHit(); }

    // ダメージはボール速度だけに依存: dmg = max(1, floor(ballSpeed / DIV))
    const ballSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const dmg = Math.max(1, Math.floor(ballSpd / C.BALL_DAMAGE_DIVISOR));

    if (bldResult) {
      const { bld } = bldResult;
      const hpBefore = bld.hp;
      // 小・中型 (HP ≤ 10) は強制 1 撃破壊。大型のみ通常ダメージで反射あり
      const forceDestroy = hpBefore <= 10;
      const dmgToApply = forceDestroy ? hpBefore : dmg;
      const destroyed = this.buildings.damage(bld, dmgToApply);

      if (destroyed) {
        // 破壊貫通: ボール速度を破壊前 HP に比例して減速 (方向は維持)
        const curSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 0.001;
        const newSpd = Math.max(
          C.BALL_MIN_PIERCE_SPEED,
          curSpd - hpBefore * C.BALL_PIERCE_LOSS_PER_DMG
        );
        const k = newSpd / curSpd;
        b.vx *= k; b.vy *= k;
        // 貫通中フラグで destroyTimer 中の再衝突を防ぐ
        b.lastPiercedBld = bld;
        this.onBuildingDestroyed(bld);
      } else {
        // 非破壊: 反射 (ピンボール挙動)
        const rSpd = Math.sqrt(bldResult.newVx ** 2 + bldResult.newVy ** 2);
        const scale = Math.max(1, C.BALL_MIN_REPEL_SPEED / Math.max(rSpd, 0.01));
        b.vx = bldResult.newVx * scale;
        b.vy = bldResult.newVy * scale;
        b.lastPiercedBld = null;
        this.sound.buildingHit();
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
        this.juice.ballHitFlash();
        this.particles.spawnSpark(b.x, b.y, 4);
      }
    }

    const fountainHit = this.furniture.checkFountainBumper(b.x, b.y, r);
    if (fountainHit) {
      const dx = b.x - fountainHit.x, dy = b.y - fountainHit.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const nx = dx/len, ny = dy/len;
      const dot = b.vx*nx + b.vy*ny;
      if (dot < 0) { b.vx -= 2*dot*nx; b.vy -= 2*dot*ny; const spd = Math.sqrt(b.vx*b.vx+b.vy*b.vy); if (spd < C.BUMPER_FORCE) { b.vx = (b.vx/spd)*C.BUMPER_FORCE; b.vy = (b.vy/spd)*C.BUMPER_FORCE; } }
      this.particles.spawnWater(b.x, b.y, 6);
    }

    const furnitureHit = this.furniture.checkBallHit(b.x, b.y, r);
    if (furnitureHit) {
      const destroyed = this.furniture.damage(furnitureHit, dmg);
      if (!destroyed) {
        // 非破壊: 最小反発
        const rsp = Math.sqrt(b.vx*b.vx+b.vy*b.vy);
        if(rsp < C.BALL_MIN_REPEL_SPEED){const s=C.BALL_MIN_REPEL_SPEED/Math.max(rsp,0.01);b.vx*=s;b.vy*=s;}
      } else {
        this.addScore(furnitureHit.score, b.x, b.y);
      }
      if (furnitureHit.type === 'hydrant' && destroyed) this.particles.spawnWater(b.x, b.y, 12);
      else if (furnitureHit.type === 'flower_bed' && destroyed) this.particles.spawnFlower(b.x, b.y, 10);
      else if (furnitureHit.type === 'sign_board' && destroyed) this.particles.spawnConfetti(b.x, b.y, 8);
      else if (furnitureHit.type === 'power_pole' && destroyed) this.particles.spawnElectric(b.x, b.y, 12);
      else if (furnitureHit.type === 'garbage' && destroyed) this.particles.spawnFood(b.x, b.y, 6);
      else if (furnitureHit.type === 'tree' || furnitureHit.type === 'vending') this.particles.spawnDebris(b.x, b.y, 4, 0.5, 0.4, 0.3);
      else this.particles.spawnSpark(b.x, b.y, 3);
      this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
    }

    const vehicleHit = this.vehicles.checkBallHit(b.x, b.y, r);
    if (vehicleHit) {
      const destroyed = this.vehicles.damage(vehicleHit, dmg);
      if (destroyed) {
        this.addScore(vehicleHit.score, b.x, b.y);
        this.particles.spawnDebris(b.x, b.y, 8, 0.5, 0.5, 0.55);
        this.particles.spawnSpark(b.x, b.y, 6);
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
      } else {
        // 非破壊: 最小反発
        const rsp = Math.sqrt(b.vx*b.vx+b.vy*b.vy);
        if(rsp < C.BALL_MIN_REPEL_SPEED){const s=C.BALL_MIN_REPEL_SPEED/Math.max(rsp,0.01);b.vx*=s;b.vy*=s;}
        this.particles.spawnSpark(b.x, b.y, 3);
        this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
      }
      this.juice.ballHitFlash();
    }

    const crushed = this.humans.checkCrush(b.x, b.y, r);
    if (crushed.length > 0) {
      for (const idx of crushed) {
        const [hx, hy] = this.humans.getPos(idx);
        this.particles.spawnBlood(hx, hy, randInt(18, 28));
      }
      this.totalHumans += crushed.length;
      this.addScore(crushed.length * C.HUMAN_CRUSH_SCORE, b.x, b.y);
      // 人間を食べる → スクロール速度アップ (HUMAN_SCROLL_GAIN px/s per human)
      this.camera.addScrollSpeed(crushed.length * C.HUMAN_SCROLL_GAIN);
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
    this.addScore(bld.score, cx, cy);
    this.sound.buildingDestroy();

    // hp 4段階 → tier 1-4 に正規化してパーティクル数・演出強度に使う
    const sc = Math.ceil(bld.maxHp / 4); // hp4→1, hp8→2, hp11→3, hp13→4
    const isLarge = bld.maxHp >= 11;
    if (isLarge) { this.juice.hitstop(C.HITSTOP_LARGE); this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5); this.juice.flash(1, 1, 1, 0.40); }
    else         { this.juice.hitstop(C.HITSTOP_SMALL);  this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR); this.juice.flash(1, 0.85, 0.4, 0.18); }

    const [dr, dg, db] = bld.baseColor;
    const top = bld.y + bld.h;

    // ── メイン破壊エフェクト ──────────────────────────────
    this.particles.spawnDebris(cx, cy, 18 + sc * 12, dr, dg, db);
    this.particles.spawnSpark (cx, cy, 16 + sc * 10);
    this.particles.spawnFire  (cx, cy, 10 + sc *  7);

    // ── 大型ビル: 頂部からも追加演出 ─────────────────────
    if (isLarge) {
      this.particles.spawnDebris(cx, top, 14, dr, dg, db);
      this.particles.spawnSpark (cx, top, 18);
      this.particles.spawnFire  (cx, top, 14);
    }

    // ── ガラス散乱: 高層・ガラス張りビル ─────────────────
    if (bld.size === 'office'     || bld.size === 'tower'      || bld.size === 'skyscraper' ||
        bld.size === 'apartment_tall' || bld.size === 'city_hall') {
      this.particles.spawnGlass(cx, cy, 14 + sc * 5);
    }

    // ── 爆発: ガソリンスタンド ───────────────────────────
    if (bld.size === 'gas_station') {
      this.particles.spawnFire(cx, cy, 20);
      this.particles.spawnSpark(cx, cy, 20);
    }

    // ── 紙幣: 銀行・百貨店 ───────────────────────────────
    if (bld.size === 'bank' || bld.size === 'department_store') {
      this.particles.spawnCash(cx, cy, 16 + sc * 4);
    }

    // ── 本: 図書館・書店 ─────────────────────────────────
    if (bld.size === 'library' || bld.size === 'bookstore') {
      this.particles.spawnBooks(cx, cy, 14 + sc * 3);
    }

    // ── 花びら: 花屋・温室 ───────────────────────────────
    if (bld.size === 'florist' || bld.size === 'greenhouse') {
      this.particles.spawnFlower(cx, cy, 16);
    }

    // ── 桜吹雪: 神社 ─────────────────────────────────────
    if (bld.size === 'shrine') {
      this.particles.spawnSakuraPetals(cx, cy, 20);
    }

    // ── 電気スパーク: 寺院・ゲームセンター・警察 ──────────
    if (bld.size === 'temple') {
      this.particles.spawnElectric(cx, cy, 16);
      this.juice.flash(1.0, 0.7, 0.2, 0.30);
    }
    if (bld.size === 'game_center' || bld.size === 'police_station') {
      this.particles.spawnElectric(cx, cy, 12);
    }

    // ── 食べ物: 飲食・食料品 ─────────────────────────────
    if (bld.size === 'restaurant' || bld.size === 'cafe'       || bld.size === 'bakery' ||
        bld.size === 'ramen'      || bld.size === 'izakaya'    ||
        bld.size === 'supermarket'|| bld.size === 'convenience') {
      this.particles.spawnFood(cx, cy, 14);
    }

    // ── 蒸気: 熱い食べ物・蒸気機関 ──────────────────────
    if (bld.size === 'ramen' || bld.size === 'izakaya' || bld.size === 'train_station') {
      this.particles.spawnSteam(cx, cy, 12);
    }

    // ── 水しぶき: 貯水タンク ─────────────────────────────
    if (bld.size === 'water_tower') {
      this.particles.spawnWater(cx, cy, 20);
    }

    // ── 泡 + 蒸気: コインランドリー ──────────────────────
    if (bld.size === 'laundromat') {
      this.particles.spawnBubbles(cx, cy, 14);
      this.particles.spawnSteam(cx, cy, 10);
    }

    // ── 紙吹雪: 娯楽・お祝い ────────────────────────────
    if (bld.size === 'school'       || bld.size === 'movie_theater' ||
        bld.size === 'pachinko'     || bld.size === 'karaoke'       ||
        bld.size === 'department_store') {
      this.particles.spawnConfetti(cx, cy, 20);
    }

    // ── 風船: 遊園地・子ども施設 ─────────────────────────
    if (bld.size === 'ferris_wheel' || bld.size === 'stadium' ||
        bld.size === 'daycare'      || bld.size === 'karaoke') {
      this.particles.spawnBalloons(cx, cy, 12);
    }

    // ── ポップコーン: 映画館・スタジアム ─────────────────
    if (bld.size === 'movie_theater' || bld.size === 'stadium') {
      this.particles.spawnPopcorn(cx, cy, 12);
    }

    // ── 救急車: 病院 ─────────────────────────────────────
    if (bld.size === 'hospital') {
      this.vehicles.spawnAmbulance(cx < 0 ? 190 : -190, C.MAIN_STREET_Y);
    }

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
    // シーン事前配置の humans (行列・観客)
    for (const h of chunk.prePlacedHumans) {
      this.humans.spawnAt(h.x, h.y);
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
    this.sound.ballLost();
    this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);
    this.state = 'ball_lost';
    this.stateTimer = 1.0;
  }

  /** スコア加算 + 即時ポップアップ */
  private addScore(pts: number, worldX: number, worldY: number) {
    this.totalScore += pts;
    this.ui.setScore(this.totalScore);
    this.ui.spawnDamagePopup(pts, worldX, worldY, this.camera.y);
  }

  private onGameOver() {
    this.state = 'game_over';
    this.juice.flash(1, 0, 0, 0.6);
    setTimeout(() => {
      this.ui.showGameOver(this.totalScore, this.camera.distanceMeters, this.totalDestroys, this.totalHumans);
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

  /**
   * 1 タイル分の地面を描画。型ごとに異なる描画技法を使用:
   * - 自然物 (grass / dirt / gravel / fallen_leaves) は疑似ランダム配置で
   *   個別の葉・石・草を散らす
   * - 人工物 (wood_deck / tile / stone_pavement) は個別タイルをシェーディング
   * - 街路 (asphalt / concrete) は細かい骨材やヒビを描く
   */
  private drawGroundTile(buf: Float32Array, idx: number, tile: GroundTile): number {
    let n = idx;
    const { type, x, y, w, h } = tile;
    // セル位置で決まる deterministic hash (同じタイルは常に同じパターン)
    const hash = (i: number) => {
      const v = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };

    switch (type) {
      // ─── 石畳: 不規則な石をオフセットして並べる ───────────
      case 'stone_pavement': {
        // 目地の暗い下地
        writeInst(buf, n++, x, y, w, h, 0.32, 0.28, 0.22, 1);
        // 4 行 × 3 列、行ごとに半セル分オフセット (煉瓦積み)
        const rows = 4;
        const cols = 3;
        const sh = h / rows;
        const sw = w / cols;
        for (let r = 0; r < rows; r++) {
          const rowOff = (r % 2) * sw * 0.5;
          for (let c = -1; c <= cols; c++) {
            const sx = x - w / 2 + (c + 0.5) * sw + rowOff;
            const sy = y - h / 2 + (r + 0.5) * sh;
            if (sx < x - w / 2 - sw * 0.15 || sx > x + w / 2 + sw * 0.15) continue;
            const hv = hash(r * 13 + c * 7);
            const shade = 0.50 + hv * 0.15;
            writeInst(buf, n++, sx, sy, sw * 0.88, sh * 0.82,
              shade * 1.05, shade * 0.95, shade * 0.80, 1);
            // 石の上辺ハイライト
            writeInst(buf, n++, sx, sy - sh * 0.32, sw * 0.80, 0.4,
              Math.min(1, shade + 0.15), Math.min(1, shade + 0.10), shade * 0.90, 0.7);
          }
        }
        break;
      }

      // ─── 芝: 多数の草の葉をランダム配置 ──────────────────
      case 'grass': {
        // ベース (中間的な緑)
        writeInst(buf, n++, x, y, w, h, 0.30, 0.52, 0.20, 1);
        // 有機的な色ムラパッチ 2 つ (円)
        writeInst(buf, n++, x - w * 0.22, y - h * 0.18, w * 0.5, h * 0.4,
          0.24, 0.44, 0.16, 0.65, 0, 1);
        writeInst(buf, n++, x + w * 0.20, y + h * 0.22, w * 0.5, h * 0.4,
          0.38, 0.62, 0.24, 0.60, 0, 1);
        // 草の葉を 28 枚ランダム散布 (縦に細長い長方形)
        for (let i = 0; i < 28; i++) {
          const bx = x + (hash(i * 2) - 0.5) * w * 0.92;
          const by = y + (hash(i * 2 + 1) - 0.5) * h * 0.92;
          const bright = 0.55 + hash(i * 3 + 7) * 0.25;
          writeInst(buf, n++, bx, by, 0.6, 1.8,
            0.30 + bright * 0.08, bright + 0.15, 0.18, 0.9);
        }
        // 小さな白花 2 つ (アクセント)
        for (let i = 0; i < 2; i++) {
          const bx = x + (hash(100 + i) - 0.5) * w * 0.85;
          const by = y + (hash(200 + i) - 0.5) * h * 0.85;
          writeInst(buf, n++, bx, by, 1.3, 1.3, 0.96, 0.93, 0.82, 0.9, 0, 1);
        }
        break;
      }

      // ─── 土: 有機的な色ブロブ + 小石 ─────────────────────
      case 'dirt': {
        writeInst(buf, n++, x, y, w, h, 0.46, 0.33, 0.20, 1);
        // 柔らかい色ブロブ 8 個 (円形で有機感)
        for (let i = 0; i < 8; i++) {
          const bx = x + (hash(i * 3) - 0.5) * w * 0.85;
          const by = y + (hash(i * 3 + 1) - 0.5) * h * 0.85;
          const sz = 3.5 + hash(i * 3 + 2) * 6;
          const dark = i % 2 === 0;
          const r = dark ? 0.36 : 0.54;
          const g = dark ? 0.26 : 0.40;
          const bcol = dark ? 0.14 : 0.24;
          writeInst(buf, n++, bx, by, sz, sz * 0.75, r, g, bcol, 0.60, 0, 1);
        }
        // 小石 6 個 (円)
        for (let i = 0; i < 6; i++) {
          const bx = x + (hash(100 + i * 2) - 0.5) * w * 0.9;
          const by = y + (hash(101 + i * 2) - 0.5) * h * 0.9;
          const sz = 1.3 + hash(200 + i) * 0.9;
          writeInst(buf, n++, bx, by, sz, sz,
            0.58 + hash(300 + i) * 0.1, 0.52, 0.44, 0.85, 0, 1);
        }
        break;
      }

      // ─── 玉砂利: 大量の丸い石で敷き詰める ─────────────────
      case 'gravel': {
        // ベース
        writeInst(buf, n++, x, y, w, h, 0.60, 0.56, 0.48, 1);
        // 枯山水の砂紋 (薄い水平線 3 本)
        writeInst(buf, n++, x, y - h * 0.28, w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        writeInst(buf, n++, x, y,              w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        writeInst(buf, n++, x, y + h * 0.28,   w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        // 砂利の石を敷き詰める (32 個、大小さまざま)
        for (let i = 0; i < 32; i++) {
          const bx = x + (hash(i * 4) - 0.5) * w * 0.95;
          const by = y + (hash(i * 4 + 1) - 0.5) * h * 0.95;
          const sz = 1.2 + hash(i * 4 + 2) * 1.6;
          const shade = 0.45 + hash(i * 4 + 3) * 0.22;
          writeInst(buf, n++, bx, by, sz, sz,
            shade, shade - 0.02, shade - 0.08, 0.92, 0, 1);
        }
        break;
      }

      // ─── 落ち葉: 土の上に多色の紅葉を散らす ─────────────
      case 'fallen_leaves': {
        // 湿った土の下地
        writeInst(buf, n++, x, y, w, h, 0.36, 0.26, 0.14, 1);
        // 下地の暗い色ムラ 2 つ
        writeInst(buf, n++, x - w * 0.2, y + h * 0.1, w * 0.5, h * 0.4,
          0.28, 0.20, 0.10, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.15, y - h * 0.2, w * 0.4, h * 0.3,
          0.42, 0.30, 0.16, 0.45, 0, 1);
        // 紅葉を 26 枚散らす (8 色パレット)
        const leafPalette: Array<[number, number, number]> = [
          [0.90, 0.30, 0.10], // 鮮紅
          [0.95, 0.68, 0.15], // 黄
          [0.82, 0.26, 0.08], // 深紅
          [0.88, 0.52, 0.18], // 橙
          [0.72, 0.40, 0.14], // 茶
          [0.96, 0.58, 0.20], // 明橙
          [0.60, 0.22, 0.06], // 暗紅
          [0.85, 0.78, 0.22], // 黄緑
        ];
        for (let i = 0; i < 26; i++) {
          const bx = x + (hash(i * 5) - 0.5) * w * 0.92;
          const by = y + (hash(i * 5 + 1) - 0.5) * h * 0.92;
          const ci = Math.floor(hash(i * 5 + 2) * leafPalette.length);
          const [r, g, bcol] = leafPalette[ci];
          const sz = 1.8 + hash(i * 5 + 3) * 1.4;
          writeInst(buf, n++, bx, by, sz, sz * 0.7, r, g, bcol, 0.92, 0, 1);
        }
        break;
      }

      // ─── アスファルト: 骨材スペックル + タイヤ跡 ──────────
      case 'asphalt': {
        // ベース
        writeInst(buf, n++, x, y, w, h, 0.28, 0.28, 0.30, 1);
        // 暗いムラ 2 つ (円で有機感)
        writeInst(buf, n++, x - w * 0.15, y - h * 0.1, w * 0.45, h * 0.35,
          0.22, 0.22, 0.24, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.1, y + h * 0.2, w * 0.4, h * 0.3,
          0.33, 0.33, 0.35, 0.45, 0, 1);
        // 骨材 (多数の明色小ドット)
        for (let i = 0; i < 26; i++) {
          const bx = x + (hash(i * 6) - 0.5) * w * 0.95;
          const by = y + (hash(i * 6 + 1) - 0.5) * h * 0.95;
          const shade = 0.42 + hash(i * 6 + 2) * 0.18;
          writeInst(buf, n++, bx, by, 0.8, 0.8,
            shade, shade, shade + 0.03, 0.80, 0, 1);
        }
        // タイヤ跡 2 本 (うっすら)
        writeInst(buf, n++, x - w * 0.18, y - h * 0.05, w * 0.72, 0.5, 0.20, 0.20, 0.22, 0.6);
        writeInst(buf, n++, x + w * 0.12, y + h * 0.12, w * 0.60, 0.5, 0.20, 0.20, 0.22, 0.6);
        break;
      }

      // ─── ウッドデッキ: 板目 + 釘 + 節 ────────────────────
      case 'wood_deck': {
        // 板間の暗い目地
        writeInst(buf, n++, x, y, w, h, 0.24, 0.14, 0.05, 1);
        // 5 枚の板 (明暗交互)
        const plankCount = 5;
        const plankW = w / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const px = x - w / 2 + (i + 0.5) * plankW;
          const shade = i % 2 === 0 ? 1.0 : 0.85;
          writeInst(buf, n++, px, y, plankW * 0.92, h * 0.96,
            0.62 * shade, 0.42 * shade, 0.22 * shade, 1);
          // 薄い木目線 (縦 2 本)
          writeInst(buf, n++, px - plankW * 0.2, y, 0.3, h * 0.9,
            0.42 * shade, 0.26 * shade, 0.12 * shade, 0.55);
          writeInst(buf, n++, px + plankW * 0.15, y, 0.3, h * 0.9,
            0.42 * shade, 0.26 * shade, 0.12 * shade, 0.55);
          // 釘 2 本 (板の両端)
          writeInst(buf, n++, px, y - h * 0.40, 0.7, 0.7, 0.18, 0.14, 0.08, 1, 0, 1);
          writeInst(buf, n++, px, y + h * 0.40, 0.7, 0.7, 0.18, 0.14, 0.08, 1, 0, 1);
        }
        // 節 2 つをランダム位置に
        for (let i = 0; i < 2; i++) {
          const kx = x + (hash(10 + i) - 0.5) * w * 0.75;
          const ky = y + (hash(20 + i) - 0.5) * h * 0.75;
          writeInst(buf, n++, kx, ky, 2.4, 1.6, 0.35, 0.20, 0.08, 0.85, 0, 1);
          writeInst(buf, n++, kx, ky, 1.2, 0.8, 0.20, 0.10, 0.04, 0.9, 0, 1);
        }
        break;
      }

      // ─── タイル: 個別タイルをシェーディング ───────────────
      case 'tile': {
        // 目地の暗い下地
        writeInst(buf, n++, x, y, w, h, 0.44, 0.42, 0.38, 1);
        // 4×3 のタイル、各タイルを個別シェード
        const cols = 4, rows = 3;
        const tileW = w / cols;
        const tileH = h / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const tx = x - w / 2 + (c + 0.5) * tileW;
            const ty = y - h / 2 + (r + 0.5) * tileH;
            const hv = hash(r * 17 + c * 5);
            const shade = 0.72 + hv * 0.16;
            writeInst(buf, n++, tx, ty, tileW * 0.90, tileH * 0.84,
              shade, shade - 0.02, shade - 0.06, 1);
            // タイルの上辺ハイライト
            writeInst(buf, n++, tx, ty - tileH * 0.34, tileW * 0.80, 0.4,
              Math.min(1, shade + 0.15), Math.min(1, shade + 0.12), shade, 0.7);
          }
        }
        break;
      }

      // ─── コンクリート: 不定形のヒビ + シミ ────────────────
      case 'concrete': {
        // 微妙にムラのある下地
        writeInst(buf, n++, x, y, w, h, 0.68, 0.66, 0.62, 1);
        // 有機的な色の淡いムラ 2 つ (円)
        writeInst(buf, n++, x - w * 0.22, y - h * 0.15, w * 0.5, h * 0.4,
          0.72, 0.70, 0.66, 0.6, 0, 1);
        writeInst(buf, n++, x + w * 0.18, y + h * 0.2, w * 0.5, h * 0.4,
          0.60, 0.58, 0.54, 0.55, 0, 1);
        // エキスパンションジョイント (水平直線 2 本)
        writeInst(buf, n++, x, y - h * 0.33, w, 0.6, 0.38, 0.36, 0.32, 0.75);
        writeInst(buf, n++, x, y + h * 0.33, w, 0.6, 0.38, 0.36, 0.32, 0.75);
        // 不定形のヒビ (折れ線風の 3 セグメント)
        writeInst(buf, n++, x - w * 0.32, y - h * 0.08, w * 0.28, 0.4,
          0.30, 0.28, 0.24, 0.85);
        writeInst(buf, n++, x - w * 0.05, y + h * 0.02, w * 0.26, 0.4,
          0.30, 0.28, 0.24, 0.85);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.12, w * 0.22, 0.4,
          0.30, 0.28, 0.24, 0.85);
        // 油シミ 1 つ (円形)
        writeInst(buf, n++, x + w * 0.28, y - h * 0.25, w * 0.14, h * 0.1,
          0.48, 0.44, 0.38, 0.7, 0, 1);
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
    const radius = C.BALL_RADIUS; // 固定サイズ

    // スクロール速度に応じた色: orange(base) → red(+50) → electric blue(+100)
    const pt = Math.min(1, (this.camera.scrollSpeed - C.SCROLL_BASE_SPEED) / 100);
    let cr: number, cg: number, cb: number;
    if (pt < 0.5) {
      const s = pt * 2;
      cr = 1.0; cg = 0.55 - s * 0.45; cb = 0.05 + s * 0.05;
    } else {
      const s = (pt - 0.5) * 2;
      cr = 1.0 - s * 0.8; cg = 0.10 + s * 0.40; cb = 0.10 + s * 0.90;
    }

    // トレイル
    for (let ti = 0; ti < C.TRAIL_LEN; ti++) {
      const age = ti / C.TRAIL_LEN;
      const idx = (b.trailHead - 1 - ti + C.TRAIL_LEN) % C.TRAIL_LEN;
      const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.45;
      const sz = radius * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, cr, cg * (1 - age * 0.5), cb, alpha, 0, 1);
    }

    const r = isFl ? 1 : cr, g = isFl ? 1 : cg, bv = isFl ? 1 : cb;
    writeInst(buf, n++, b.x, b.y, radius * 2, radius * 2, r, g, bv, 1, 0, 1);
    return n - start;
  }
}
