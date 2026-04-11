/**
 * game.ts — メインゲームループ + 全システム統合
 *
 * 描画順（仕様書 9-1 より）:
 *  1. 背景クリア
 *  2. 壁・レール
 *  3. 建物
 *  4. 人間
 *  5. バンパー
 *  6. フリッパー
 *  7. ボール（トレイル含む）
 *  8. パーティクル
 *  9. フラッシュオーバーレイ
 *  10. UI (DOM)
 */

import * as C from './constants';
import { Renderer, writeInst, INST_F } from './renderer';
import { InputManager } from './input';
import { SoundEngine } from './sound';
import { Ball, Flipper, BuildingManager, BumperManager } from './entities';
import { HumanManager } from './humans';
import { ParticleManager } from './particles';
import { JuiceManager } from './juice';
import { UIManager } from './ui';
import { getStage } from './stages';
import {
  resolveCircleOBB,
  clampSpeed, rand, randInt
} from './physics';
import type { BuildingData, BumperData } from './entities';

// 静的インスタンスバッファ（再利用でGCゼロ）
const SHARED_BUF = new Float32Array(3200 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'stage_clear' | 'game_over';

export class Game {
  private renderer: Renderer;
  private input:    InputManager;
  private sound:    SoundEngine;
  private humans:   HumanManager;
  private particles:ParticleManager;
  private juice:    JuiceManager;
  private ui:       UIManager;
  private buildings:BuildingManager;
  private bumpers:  BumperManager;

  private ball:     Ball;
  private flippers: [Flipper, Flipper];

  private score     = 0;
  private combo     = 1;
  private comboTimer= 0;
  private ballsLeft = C.INITIAL_BALLS;
  private stage     = 1;
  private state: GameState = 'playing';
  private stateTimer= 0;

  // ===== 坂OBB（静的壁）: フリッパーピボット点に接続 =====
  // ピボット: (±85, -165)
  // 左坂: (-180, -65) → (-85, -165)  center=(-132.5,-115) angle≈-0.813rad hw≈69
  private readonly SLOPE_L = { cx: -132.5, cy: -115, hw: 69, hh: 6, angle: -0.813 };
  private readonly SLOPE_R = { cx:  132.5, cy: -115, hw: 69, hh: 6, angle:  0.813 };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer  = new Renderer(canvas);
    this.input     = new InputManager(canvas);
    this.sound     = new SoundEngine();
    this.humans    = new HumanManager();
    this.particles = new ParticleManager();
    this.juice     = new JuiceManager();
    this.ui        = new UIManager();
    this.buildings = new BuildingManager();
    this.bumpers   = new BumperManager();
    this.ball      = new Ball();
    this.flippers  = [new Flipper(true), new Flipper(false)];

    // ゲームオーバー画面のタップ → リスタート
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
    this.bumpers.load(cfg.bumpers);
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
      const rawDt = Math.min((now - this.lastTime) / 1000, 0.05); // 最大50ms
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

    // フリッパー入力
    this.flippers[0].setPressed(this.input.leftPressed);
    this.flippers[1].setPressed(this.input.rightPressed);
    this.flippers[0].update(dt);
    this.flippers[1].update(dt);

    // ボール物理
    if (dt > 0) this.updateBall(dt);

    // 建物・バンパー更新
    this.buildings.update(dt);
    this.bumpers.update(dt);

    // 人間更新
    this.humans.update(dt, this.ball.x, this.ball.y);

    // パーティクル更新
    this.particles.update(dt);

    // コンボタイムアウト
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.ui.hideCombo();
        this.sound.resetComboStep();
      }
    }

    // ステージクリア判定
    if (this.buildings.allDestroyed()) {
      this.onStageClear();
    }
  }

  private updateBall(dt: number) {
    const b = this.ball;
    if (!b.active) return;

    // ===== サブステップ物理（トンネリング防止）=====
    // max速度25px/frame ÷ 4 = 6.25px/substep < OBB厚12px → 貫通しない
    const SUB = 4;
    const dts = dt / SUB;

    let wallSoundNeeded    = false;
    let flipperSoundNeeded = false;
    let bldResult: { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null = null;
    let bmpResult: { bump: BumperData;  newBx: number; newBy: number; newVx: number; newVy: number } | null = null;

    for (let s = 0; s < SUB; s++) {
      // 重力・移動
      b.vy -= C.GRAVITY * dts * 60;
      b.x  += b.vx * dts * 60;
      b.y  += b.vy * dts * 60;
      [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);

      // ----- 壁 -----
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

      // ----- 坂（静的OBB）-----
      for (const slope of [this.SLOPE_L, this.SLOPE_R]) {
        const res = resolveCircleOBB(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy, slope);
        if (res) {
          [b.x, b.y, b.vx, b.vy] = res;
          wallSoundNeeded = true;
          break;
        }
      }

      // ----- フリッパー -----
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

      // ----- 建物（初回ヒットのみ位置解決、イベントはループ後）-----
      if (!bldResult) {
        const h = this.buildings.checkBallHit(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy);
        if (h) {
          bldResult = h;
          b.x = h.newBx; b.y = h.newBy;
          b.vx = h.newVx; b.vy = h.newVy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
        }
      }

      // ----- バンパー（初回ヒットのみ位置解決）-----
      if (!bmpResult) {
        const h = this.bumpers.checkBallHit(b.x, b.y, C.BALL_RADIUS, b.vx, b.vy);
        if (h) {
          bmpResult = h;
          b.x = h.newBx; b.y = h.newBy;
          b.vx = h.newVx; b.vy = h.newVy;
        }
      }
    } // end substep

    // ===== サウンド（1フレームに1回）=====
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
    if (bmpResult) {
      this.score += C.BUMPER_SCORE;
      this.ui.setScore(this.score);
      this.sound.bumper();
      this.juice.shake(C.SHAKE_HIT_AMP * 0.7, C.SHAKE_HIT_DUR * 0.7);
      this.juice.ballHitFlash();
      this.particles.spawnSpark(b.x, b.y, 5);
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

    // ===== ボールロスト =====
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

    // パーティクル
    const debrisCount = 10 + bld.maxHp * 5;
    this.particles.spawnDebris(cx, cy, debrisCount, 0.6, 0.6, 0.7);
    this.particles.spawnSmoke(cx, cy, 4);
    this.particles.spawnSpark(cx, cy, 8);

    // 人間スポーン
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
      this.stateTimer = 1.2; // 1.2秒後にボール復活
    }
  }

  private onStageClear() {
    this.state = 'stage_clear';
    this.stateTimer = 3.0;
    this.sound.stageClear();
    this.juice.flash(0, 1, 0, 0.4);

    // 残った人間をすべて逃がしてボーナス（逃がすだけ、スコアはなし）
    const bonusScore = this.humans.activeCount * 0;
    this.ui.showStageClear(bonusScore);
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
    const cfg = getStage(this.stage);
    this.renderer.clear(cfg.bgR, cfg.bgG, cfg.bgB);
    const shake = this.juice.getShake();

    let instCount = 0;

    // ------ 2. 壁・レール ------
    // 左右の斜面（フリッパー横）
    instCount = this.fillWalls(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 3. 建物 ------
    instCount = 0;
    instCount += this.buildings.fillInstances(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 4. 人間 ------
    instCount = 0;
    instCount += this.humans.fillInstances(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 5. バンパー ------
    instCount = 0;
    instCount += this.bumpers.fillInstances(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 6. フリッパー ------
    instCount = 0;
    instCount += this.fillFlippers(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 7. ボール（トレイル + 本体） ------
    instCount = 0;
    instCount += this.fillBall(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 8. パーティクル ------
    instCount = 0;
    instCount += this.particles.fillInstances(SHARED_BUF, 0);
    this.renderer.drawInstances(SHARED_BUF, instCount, shake);

    // ------ 9. フラッシュ ------
    this.renderer.drawFlash(
      this.juice.flashR, this.juice.flashG, this.juice.flashB,
      this.juice.flashAlpha
    );
  }

  private fillWalls(buf: Float32Array, start: number): number {
    let n = start;
    const WC = 0.18;

    // 左壁
    writeInst(buf, n++, C.WORLD_MIN_X + 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    // 右壁
    writeInst(buf, n++, C.WORLD_MAX_X - 2, 0, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    // 上壁
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 42, C.WORLD_MAX_X * 2, 4, WC, WC, WC+0.05, 1);
    // UI区切り線
    writeInst(buf, n++, 0, C.WORLD_MAX_Y - 82, C.WORLD_MAX_X * 2, 2, 0.1, 0.1, 0.2, 0.5);
    // ストリートエリア下境界
    writeInst(buf, n++, 0, C.STREET_Y_MIN - 3, C.WORLD_MAX_X * 2, 2, 0.1, 0.1, 0.2, 0.35);

    // ===== 左坂: (-180,-80) → (-85,-180)  フリッパー外端に接続 =====
    const { cx: lcx, cy: lcy, hw: lhw, hh: lhh, angle: la } = this.SLOPE_L;
    writeInst(buf, n++, lcx, lcy, lhw*2, lhh*2, 0.5, 0.5, 0.65, 1, la);

    // ===== 右坂: (+180,-80) → (+85,-180) =====
    const { cx: rcx, cy: rcy, hw: rhw, hh: rhh, angle: ra } = this.SLOPE_R;
    writeInst(buf, n++, rcx, rcy, rhw*2, rhh*2, 0.5, 0.5, 0.65, 1, ra);

    // フリッパーピボット下の縦仕切り（ガター外壁）
    writeInst(buf, n++, -C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);
    writeInst(buf, n++,  C.FLIPPER_PIVOT_X, C.FLIPPER_PIVOT_Y - 20, 6, 40, 0.4, 0.4, 0.55, 1);

    return n - start;
  }

  private fillFlippers(buf: Float32Array, start: number): number {
    let n = start;
    for (const fl of this.flippers) {
      const isFlash = this.juice.isBallFlashing();
      const gr = isFlash ? 1 : 0.7, gg = isFlash ? 1 : 0.7, gb = isFlash ? 1 : 0.8;
      writeInst(buf, n++, fl.cx, fl.cy, C.FLIPPER_W, C.FLIPPER_H, gr, gg, gb, 1, fl.angle);
      // ピボット点マーク（端点固定）
      writeInst(buf, n++, fl.pivotX, fl.pivotY, 6, 6, 1, 0.6, 0.2, 1, 0, 1);
    }
    return n - start;
  }

  private fillBall(buf: Float32Array, start: number): number {
    const b = this.ball;
    if (!b.active) return 0;
    let n = start;
    const isFl = this.juice.isBallFlashing();

    // トレイル
    for (let t = 0; t < C.TRAIL_LEN; t++) {
      const age = t / C.TRAIL_LEN;
      const idx = (b.trailHead - 1 - t + C.TRAIL_LEN) % C.TRAIL_LEN;
      const tx = b.trail[idx * 2];
      const ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.4;
      const sz = C.BALL_RADIUS * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, 1, 0.5 - age * 0.3, 0.1, alpha, 0, 1);
    }

    // 本体
    const r = isFl ? 1   : 1;
    const g = isFl ? 1   : 0.55;
    const bv= isFl ? 1   : 0.1;
    const d = C.BALL_RADIUS * 2;
    writeInst(buf, n++, b.x, b.y, d, d, r, g, bv, 1, 0, 1);

    return n - start;
  }
}
