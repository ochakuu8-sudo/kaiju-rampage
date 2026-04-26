/**
 * game.ts — メインゲームループ + ウェーブシステム
 */

import * as C from './constants';
import { Renderer, writeInst, INST_F } from './renderer';
import { InputManager } from './input';
import { SoundEngine } from './sound';
import { Ball, Flipper, BuildingManager, FurnitureManager, VehicleManager, VEHICLE_HUMAN_YIELD } from './entities';
import { HumanManager, getHumanWeightsForBuilding } from './humans';
import { ParticleManager } from './particles';
import { JuiceManager } from './juice';
import { UIManager } from './ui';
import { Camera } from './camera';
import { getStage, generateChunk, getInitialCityRoadData, chunkInfoFor, TOTAL_CHUNKS, STAGES } from './stages';
import type { ChunkData, ChunkSpecialArea, ResolvedHorizontalRoad, ResolvedVerticalRoad, GroundTile } from './stages';
import type { Intersection } from './grid';
import { resolveCircleOBB, resolveCircleOBBSlide, resolveCircleCapsule, clampSpeed, rand, randInt, circleAABB } from './physics';
import type { BuildingData, FurnitureType, VehicleType } from './entities';
import { gameplayStart, gameplayStop } from './sdk';

const MUTE_STORAGE_KEY       = 'kaiju-pinball-muted';
const BEST_SCORE_STORAGE_KEY = 'kaiju-pinball-best-score';

function loadBestScore(): number {
  try {
    const raw = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (!raw) return 0;
    const v = parseInt(raw, 10);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try { localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score)); } catch {}
}

// 60000 instance 分の共有バッファ (renderer.ts の MAX_INST と一致させる)
// 1000+ 人間同時描画を想定: 1500×25 instance + particles + scene
const SHARED_BUF = new Float32Array(60000 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'game_over' | 'clear';

// 建物の素材プロファイル — onBuildingDestroyed で基本パーティクルを切り替えるため
type BuildingMaterial =
  | 'wood' | 'wood_traditional'
  | 'concrete_small' | 'concrete_medium' | 'glass_tower'
  | 'metal_industrial' | 'landmark' | 'explosive' | 'castle';

const BUILDING_MATERIAL: Partial<Record<C.BuildingSize, BuildingMaterial>> = {
  // 木造系
  house: 'wood', townhouse: 'wood', garage: 'wood', shed: 'wood',
  bungalow: 'wood', duplex: 'wood', mansion: 'wood',
  yatai: 'wood', greenhouse: 'wood', florist: 'wood',
  bakery: 'wood', cafe: 'wood', ramen: 'wood', izakaya: 'wood',
  snack: 'wood', kura: 'wood', wagashi: 'wood', sushi_ya: 'wood',

  // 木造伝統建築
  shrine: 'wood_traditional', temple: 'wood_traditional', pagoda: 'wood_traditional',
  tahoto: 'wood_traditional', ryokan: 'wood_traditional', onsen_inn: 'wood_traditional',
  kominka: 'wood_traditional', machiya: 'wood_traditional', chaya: 'wood_traditional',
  dojo: 'wood_traditional', kimono_shop: 'wood_traditional',

  // 小型コンクリ・店舗
  shop: 'concrete_small', convenience: 'concrete_small', restaurant: 'concrete_small',
  bookstore: 'concrete_small', pharmacy: 'concrete_small', laundromat: 'concrete_small',
  daycare: 'concrete_small', clinic: 'concrete_small', post_office: 'concrete_small',
  mahjong_parlor: 'concrete_small', shotengai_arcade: 'concrete_small',
  bus_terminal_shelter: 'concrete_small', fountain_pavilion: 'concrete_small',

  // 中型コンクリ・公共
  apartment: 'concrete_medium', parking: 'concrete_medium', supermarket: 'concrete_medium',
  karaoke: 'concrete_medium', pachinko: 'concrete_medium', game_center: 'concrete_medium',
  bank: 'concrete_medium', library: 'concrete_medium', museum: 'concrete_medium',
  fire_station: 'concrete_medium', police_station: 'concrete_medium',
  movie_theater: 'concrete_medium', school: 'concrete_medium', hospital: 'concrete_medium',
  love_hotel: 'concrete_medium', club: 'concrete_medium', capsule_hotel: 'concrete_medium',

  // ガラス張り高層
  office: 'glass_tower', tower: 'glass_tower', skyscraper: 'glass_tower',
  apartment_tall: 'glass_tower', city_hall: 'glass_tower',
  business_hotel: 'glass_tower', department_store: 'glass_tower',
  train_station: 'glass_tower',

  // 工業・港湾
  warehouse: 'metal_industrial', crane_gantry: 'metal_industrial',
  container_stack: 'metal_industrial', factory_stack: 'metal_industrial',
  silo: 'metal_industrial', water_tower: 'metal_industrial',

  // ランドマーク・娯楽巨大施設
  clock_tower: 'landmark', radio_tower: 'landmark', ferris_wheel: 'landmark',
  stadium: 'landmark', carousel: 'landmark', roller_coaster: 'landmark',
  big_tent: 'landmark',

  // 爆発系
  gas_station: 'explosive',

  // 最終ボス
  castle: 'castle',
};

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

  private state: GameState = 'playing';
  private stateTimer = 0;
  /** 初期演出: true の間はスクロールとドレインが止まる。燃料が 100% になると解除 */
  private introActive = true;

  // 燃料 (時間で減少、人間を踏むと回復)
  private fuel = C.FUEL_INITIAL;

  // 現在のステージ (HUD 表示・CLEAR 検出用)
  private currentStageIndex = 0;
  private clearTriggered = false;

  // スコア (破壊対象から累積)
  private totalScore = 0;
  // ハイスコア (これまでのベスト totalScore)
  private bestScore = 0;

  // ポーズ状態 (update をスキップ、AudioContext を suspend)
  private paused = false;

  // タイトル画面表示中 (初回起動のみ。restart では再表示しない)
  private titleActive = true;

  // ボール停滞検出 (auto-nudge 用)
  private stuckSeconds = 0;

  // チャンク管理
  private loadedChunks: Map<number, ChunkData> = new Map();
  private nextChunkId = 0;
  // v6.3 SemanticCluster ambient emit のレート制御アキュムレータ
  private _ambientAccumulator = 0;
  // 初期都市のセル地面タイル
  private initialCityGrounds: GroundTile[] = [];

  private bgTopR = 0.52; private bgTopG = 0.74; private bgTopB = 0.96;
  private bgBottomR = 0.38; private bgBottomG = 0.36; private bgBottomB = 0.33;

  // 坂のカメラ相対オフセット (スクリーン固定)
  // ★ フリッパー rest 角度 (-30°) より 8° 急な -38° に設定。
  //   完全平行だと坂→フリッパー→ドレインを一直線に転がって即落ちしてしまうため、
  //   角度差で「キャッチ」を作り、ボールが接点で微バウンドして滞空時間を生む。
  //   急すぎないので上から落ちてきた時の加速も穏やか。
  // ★ hw=55.4, 右下端=(-85, camera.y-210) でフリッパーピボット直結、左上端=(-180, camera.y-153)
  private readonly SLOPE_L_BASE = { cx: -132.5, cy_off: -181.5, hw: 55.4, hh: 6, angle: -0.541 }; // -31°
  private readonly SLOPE_R_BASE = { cx:  132.5, cy_off: -181.5, hw: 55.4, hh: 6, angle:  0.541 };

  private getSlopeL() {
    const b = this.SLOPE_L_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }
  private getSlopeR() {
    const b = this.SLOPE_R_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }

  constructor(canvas: HTMLCanvasElement, opts?: { screenshotMode?: boolean }) {
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

    // スクリーンショットモード: UI ハンドラを貼らず、
    // タイトル画面も表示しない。titleActive=true のまま保って update を止め、
    // render だけ回して stage 1 の盤面 (人間・車両・建物) を静止画として表示。
    // 物理停止なので建物/人間/車を大量追加してもゲームに影響なし → 高密度化する
    if (opts?.screenshotMode) {
      this.initRun();
      this.loadCity();
      this.addScreenshotDensity();              // stage 1 の街並みに追加ビル・人・車を詰め込み
      this.ball.active = false;                 // ボール非表示
      this.sound.setMuted(true);                // 念のため無音
      // titleActive は既定で true。update() は冒頭で early return するので物理停止
      this.startLoop();
      return;
    }

    this.input.registerRestartTap(document.getElementById('gameover')!);
    this.input.registerRestartTap(document.getElementById('clear')!);
    this.input.onRestart(() => this.restart());

    this.setupMuteButton();
    this.setupPauseButton();
    this.setupVisibilityHandler();

    this.initRun();
    this.loadCity();
    this.setupTitleScreen();
    // CrazyGames gameplayStart はタイトル画面解除時に呼ぶ (実プレイ開始タイミング)
    this.startLoop();
  }

  /** タイトル画面: 初回起動時に一度だけ表示。クリック/キーで解除してゲーム開始 */
  private setupTitleScreen(): void {
    const title = document.getElementById('title');
    const best  = document.getElementById('title-best');
    if (!title) {
      this.titleActive = false;
      gameplayStart();
      return;
    }
    // ベスト記録表示 (0 なら隠す)
    if (best) {
      if (this.bestScore > 0) {
        best.textContent = `BEST ${this.bestScore.toLocaleString()}`;
        best.classList.remove('hidden');
      } else {
        best.classList.add('hidden');
      }
    }
    title.classList.add('show');

    let dismissed = false;
    const dismiss = (e?: Event) => {
      if (dismissed) return;
      dismissed = true;
      e?.preventDefault();
      title.classList.remove('show');
      this.titleActive = false;
      this.lastTime = performance.now();
      gameplayStart();
      this.sound.startMusic(this.currentStageIndex);
    };
    title.addEventListener('click', dismiss, { once: true });
    title.addEventListener('touchstart', dismiss, { once: true, passive: false });
    const onKey = (e: KeyboardEvent) => {
      if (this.titleActive && !e.ctrlKey && !e.metaKey && !e.altKey) {
        dismiss(e);
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  /** ミュートボタン: クリックで master gain をトグル、localStorage に永続化 */
  private setupMuteButton(): void {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    // 初期状態を localStorage から復元
    let muted = false;
    try { muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1'; } catch {}
    this.sound.setMuted(muted);
    this.applyMuteBtnState(btn, muted);
    const toggle = (e: Event) => {
      e.preventDefault();
      const next = !this.sound.isMuted();
      this.sound.setMuted(next);
      this.applyMuteBtnState(btn, next);
      try { localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0'); } catch {}
    };
    btn.addEventListener('click', toggle);
    btn.addEventListener('touchstart', toggle, { passive: false });
  }

  private applyMuteBtnState(btn: HTMLElement, muted: boolean): void {
    btn.classList.toggle('muted', muted);
    // ♪ (U+266A) / 🔇 ではなく X 表現 (Press Start 2P 非対応字を避ける)
    btn.textContent = muted ? 'X' : '\u266A';
  }

  /** ポーズボタン: プレイ中のみポーズ可 (game_over/clear 中は無効)
   *  オーバーレイクリックでも再開できるよう、pause overlay もトグル対象に */
  private setupPauseButton(): void {
    const btn = document.getElementById('pause-btn');
    const overlay = document.getElementById('pause');
    const toggle = (e: Event) => {
      e.preventDefault();
      if (this.state === 'game_over' || this.state === 'clear') return;
      this.setPaused(!this.paused);
    };
    if (btn) {
      btn.addEventListener('click', toggle);
      btn.addEventListener('touchstart', toggle, { passive: false });
    }
    if (overlay) {
      overlay.addEventListener('click', toggle);
      overlay.addEventListener('touchstart', toggle, { passive: false });
    }
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.ui.setPauseVisible(paused);
    if (paused) {
      this.sound.suspend();
      gameplayStop();
    } else {
      this.sound.resume();
      // 復帰時の dt 爆発を防ぐ
      this.lastTime = performance.now();
      gameplayStart();
    }
  }

  /** タブ非アクティブ時: AudioContext を suspend し、ゲームループを実質停止
   *  復帰時: 元の状態から再開 (最初の dt クランプで巨大デルタを防ぐ) */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sound.suspend();
      } else if (!this.paused) {
        // 手動ポーズ中は復帰時も AudioContext を sustain (不要な再生を避ける)
        this.sound.resume();
        this.lastTime = performance.now();
      }
    });
  }

  private initRun() {
    this.totalDestroys    = 0;
    this.totalHumans      = 0;
    this.totalScore       = 0;
    this.state            = 'playing';
    this.stateTimer       = 0;
    this.fuel             = C.FUEL_INITIAL;
    this.currentStageIndex = 0;
    this.clearTriggered   = false;
    this.introActive      = true;
    this.bestScore        = loadBestScore();
    this.ui.setDistance(0);
    this.ui.setZone(0, STAGES[0].nameEn);
    this.ui.setFuel(C.FUEL_INITIAL);
    this.ui.setScore(0);
    this.ui.setBest(this.bestScore);
  }

  /**
   * スクリーンショットモード専用: stage 1 の建物を破棄して、
   * 被りも空白もない均一密度のタイル状グリッドに差し替える。
   * 物理停止・ボール無しなのでゲームプレイには影響しない。
   */
  private addScreenshotDensity(): void {
    // 決定論的擬似乱数 (同じシードで同じ配置)
    let seed = 20241124;
    const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed & 0x7fffffff) / 0x7fffffff; };

    // 指定範囲の高さに収まる BuildingSize だけを集めるヘルパ
    const byH = (minH: number, maxH: number): C.BuildingSize[] => {
      const arr: C.BuildingSize[] = [];
      for (const k of Object.keys(C.BUILDING_DEFS) as C.BuildingSize[]) {
        const h = C.BUILDING_DEFS[k].h;
        if (h >= minH && h <= maxH) arr.push(k);
      }
      return arr.length > 0 ? arr : (['house'] as C.BuildingSize[]);
    };

    // 各行: baseY = 行の下端、slotH = 次の行までの垂直スロット (baseY + slotH まで
    //   その行の建物が収まる)。hMax = その行で許す最大建物高 (= slotH - 3px gap)。
    //   下段ほど小型、上段ほど高層。画面全体 y=[-290, 290] を15行で覆う。
    const rowDefs = [
      { baseY: -286, slotH: 25 },
      { baseY: -261, slotH: 25 },
      { baseY: -236, slotH: 25 },
      { baseY: -211, slotH: 28 },
      { baseY: -183, slotH: 28 },
      { baseY: -155, slotH: 32 },
      { baseY: -123, slotH: 32 },
      { baseY:  -91, slotH: 34 },
      { baseY:  -57, slotH: 34 },
      { baseY:  -23, slotH: 36 },
      { baseY:   13, slotH: 40 },
      { baseY:   53, slotH: 45 },
      { baseY:   98, slotH: 55 },
      { baseY:  153, slotH: 68 },
      { baseY:  221, slotH: 75 }, // 画面上端まで (y<=290)
    ];

    const grid: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx: number }> = [];
    rowDefs.forEach((row, ri) => {
      const hMax = row.slotH - 3;
      const hMin = Math.max(8, hMax - 18);  // 同じ行は高さが近い建物だけ混ぜる
      const pool = byH(hMin, hMax);
      const gapX = 1;
      let x = -180;
      const xEnd = 180;
      while (x < xEnd) {
        const size = pool[Math.floor(rand() * pool.length)];
        const def = C.BUILDING_DEFS[size];
        if (x + def.w > xEnd) break;
        grid.push({ x: x + def.w / 2, y: row.baseY, size, blockIdx: 9900 + ri });
        x += def.w + gapX;
      }
    });

    // 既存 stage 1 の建物を廃棄してグリッドで置換 (被り無し、均一密度)
    this.buildings.load(grid);

    // 通行人はリセットして、各行の隙間 (道路相当の帯) に等間隔配置
    this.humans.reset();
    this.humans.resetRoads();
    rowDefs.forEach(row => {
      const gapY = row.baseY + (row.slotH - 3) + 1; // 建物頂点のすぐ上
      const N = 14;
      for (let i = 0; i < N; i++) {
        const x = -170 + (340 / (N - 1)) * i + (rand() - 0.5) * 8;
        this.humans.spawnAt(x, gapY);
      }
    });
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
    this.groundTileCache.clear();
    this.nextChunkId = 0;
    this.ball.fullReset();
    this.ball.resetWithCamera(this.camera.y);
  }

  private restart() {
    this.ui.hideGameOver();
    this.ui.hideClear();
    this.initRun();
    this.loadCity();
    this.stuckSeconds = 0;
    gameplayStart();
    this.sound.startMusic(this.currentStageIndex);
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
    // タイトル / ポーズ中は update を完全スキップ (演出停止 + ball 停止)
    if (this.titleActive || this.paused) return;
    this.juice.update(rawDt);

    // clear 中は花火演出のためパーティクルだけ更新する
    if (this.state === 'clear') {
      this.particles.update(rawDt);
      return;
    }
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

    // 燃料ゲージ比率 (0..1) に応じたスクロール速度とドレイン倍率を算出
    const fuelRatio = Math.max(0, Math.min(1, this.fuel / C.FUEL_MAX));
    this.camera.scrollSpeed = C.SCROLL_SPEED_MIN + (C.SCROLL_SPEED_MAX - C.SCROLL_SPEED_MIN) * fuelRatio;
    const drainMult = C.FUEL_DRAIN_MULT_MIN + (C.FUEL_DRAIN_MULT_MAX - C.FUEL_DRAIN_MULT_MIN) * fuelRatio;

    // カメラ更新 (スクロール) — 初期演出中は停止
    if (!this.introActive) this.camera.update(dt);

    this.flippers[0].setPressed(this.input.leftPressed);
    this.flippers[1].setPressed(this.input.rightPressed);
    // フリッパーをカメラに追従させる
    for (const fl of this.flippers) {
      fl.pivotY = C.FLIPPER_PIVOT_Y + this.camera.y;
    }
    this.flippers[0].update(dt);
    this.flippers[1].update(dt);

    if (dt > 0) this.updateBall(dt);

    // ボール詰まり検出: 速度が極小の状態が 3s 続いたら自動 nudge で救出
    // (MAX_BALL_SPEED = 22 の座標系。speed < 3 はほぼ停止)
    if (!this.introActive && this.state === 'playing') {
      if (this.ball.speed() < 3) {
        this.stuckSeconds += rawDt;
        if (this.stuckSeconds >= 3.0) {
          this.ball.vy += 16;
          this.ball.vx += (Math.random() * 2 - 1) * 8;
          this.stuckSeconds = 0;
          this.sound.bumper();
          this.juice.shake(2, 0.12);
        }
      } else {
        this.stuckSeconds = 0;
      }
    }

    this.buildings.update(dt);
    this.furniture.update(dt);
    this.vehicles.update(dt, this.camera.y);
    this.humans.update(dt, this.ball.x, this.ball.y, this.camera.y);
    this.particles.update(dt);
    this._updateAmbient(dt);
    this.updateChunks();

    // 距離表示を更新
    this.ui.setDistance(this.camera.distanceMeters);

    // 現在ステージを追跡して HUD / 背景を更新
    this.updateCurrentStage();

    // ポップアップレイヤーをカメラ追従 (コンテナ1つだけ更新)
    this.ui.updatePopupLayer(this.camera.y);

    // 燃料ドレイン — ゲージ量に応じた倍率を掛ける (100% で最大、0% で最小)
    if (!this.introActive) {
      this.fuel = Math.max(0, this.fuel - rawDt * C.FUEL_DRAIN_PER_SEC * drainMult);
    }
    this.ui.setFuel(this.fuel);

    // 初期演出: 満タンになったらスクロール/ドレイン開始
    if (this.introActive && this.fuel >= C.FUEL_MAX) {
      this.introActive = false;
      this.juice.flash(1, 1, 0.4, 0.50);
      this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR);
    }

    // 燃料切れ → ゲームオーバー (初期演出中はペナルティで 0 になっても終わらない)
    if (!this.introActive && this.fuel <= 0) {
      this.onGameOver();
      return;
    }

    // ── GOAL チャンク到達 → スクロールロック (ラスボス戦) ──
    // 最終チャンクがスポーンされた瞬間にロックを予約。カメラは自然にスクロールし
    // ロック位置 (goal chunk center) に達した時点で停止する。
    // ※ 最終チャンクが loadedChunks に入った後に予約することで、スポーン前の
    //   misfire を防ぐ (hasGoalCastle() が false を返す瞬間を避ける)。
    if (this.camera.lockY === null && this.nextChunkId >= TOTAL_CHUNKS) {
      const goalBaseY = C.WORLD_MAX_Y + (TOTAL_CHUNKS - 1) * C.CHUNK_HEIGHT;
      this.camera.lockY = goalBaseY + 100;
    }

    // ── CLEAR 判定 ──
    // カメラがロック位置に実際に到達 + 城が破壊された時点で発火。
    // (lockY 予約だけでは発火せず、カメラが物理的にそこへ到達するまで待つ)
    if (!this.clearTriggered && this.camera.lockY !== null &&
        this.camera.y >= this.camera.lockY - 1) {
      // カメラがロック位置到達済み → お城の破壊を待つ
      if (this.buildings.hasGoalCastle()) {
        if (!this.buildings.isGoalCastleAlive()) {
          this.clearTriggered = true;
          this.onClear();
          return;
        }
        // 城がまだ生きている → クリアせず待機 (プレイ続行)
      } else {
        // 万一 GOAL チャンクに城が無い場合のみ即クリア (本来は発生しない)
        this.clearTriggered = true;
        this.onClear();
        return;
      }
    }

  }

  /** 現在のチャンクから所属ステージを判定して HUD / 背景を更新 */
  private updateCurrentStage() {
    // 画面中央が属するチャンクを現在ステージとする
    const cameraCenterY = this.camera.y;
    const chunkIdx = Math.floor((cameraCenterY - C.WORLD_MAX_Y) / C.CHUNK_HEIGHT);
    const clamped  = Math.max(0, Math.min(TOTAL_CHUNKS - 1, chunkIdx));
    const info = chunkInfoFor(clamped);
    if (info.finished) return;
    if (info.stageIndex !== this.currentStageIndex) {
      this.currentStageIndex = info.stageIndex;
      this.ui.setZone(info.stageIndex, info.stage.nameEn);
      // BGM のルート音をステージ変更に合わせて切替
      this.sound.startMusic(info.stageIndex);
      if (info.stage.bgTop) {
        this.bgTopR = info.stage.bgTop[0];
        this.bgTopG = info.stage.bgTop[1];
        this.bgTopB = info.stage.bgTop[2];
      }
      if (info.stage.bgBottom) {
        this.bgBottomR = info.stage.bgBottom[0];
        this.bgBottomG = info.stage.bgBottom[1];
        this.bgBottomB = info.stage.bgBottom[2];
      }
    }
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
      // 回転: 水平速度に比例 (転がり、ω = v / r)。右に進めば CW 回転。
      b.angle -= (b.vx / r) * dts * 60;
      const camTop = this.camera.y + C.WORLD_MAX_Y;
      if (b.x - r < C.WORLD_MIN_X) { b.x = C.WORLD_MIN_X + r; b.vx = Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.x + r > C.WORLD_MAX_X) { b.x = C.WORLD_MAX_X - r; b.vx = -Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.y + r > camTop - 40) { b.y = camTop - 40 - r; b.vy = -Math.abs(b.vy) * C.WALL_DAMPING; wallSoundNeeded = true; }
      // 坂: normalDamping=0.22 で跳ねにくく、tangentFriction=0.965 で転がりながら
      // そこそこエネルギーを削ぐ (往復 1 回くらいで穴に落ちる挙動を狙う)。
      for (const slope of [this.getSlopeL(), this.getSlopeR()]) {
        const res = resolveCircleOBBSlide(b.x, b.y, r, b.vx, b.vy, slope, 0.22, 0.965);
        if (res) {
          const preSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          [b.x, b.y, b.vx, b.vy] = res;
          const postSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          // 接触音は大きな normal 入力時のみ (擦り音の連発を避ける)
          if (preSpd - postSpd > 2) wallSoundNeeded = true;
          break;
        }
      }
      // フリッパー: カプセル判定で先端を丸めて引っ掛かりを排除。
      // normalDamping=0.35 で跳ねすぎない程度に保持、tangentFriction=0.998 でほぼ無摩擦。
      // 押されたら applyImpulse で追加の強打ち出し。
      for (const fl of this.flippers) {
        // 先端の小さな半円突起 (バンパー): フリッパーの動きとは無関係に
        // 静止位置で固定。位置は最先端より僅かに外側 (+2 px) なので、
        // フリッパー本体上を擦る程度では当たらず、最先端まで滑ってきた時にだけ反応する。
        const TIP_BUMP_R = 1;   // 突起の半径 (半分に縮小)
        // 突起は静止位置で固定 (フリッパーが振っても動かない): REST 角度ベース
        const restRad = (fl.isLeft ? C.FLIPPER_REST_DEG : (180 - C.FLIPPER_REST_DEG)) * Math.PI / 180;
        const rCos = Math.cos(restRad), rSin = Math.sin(restRad);
        const yDirT = fl.isLeft ? 1 : -1;
        const bumpLocalX = C.FLIPPER_W + TIP_BUMP_R;           // 突起の内側端が最先端に揃う
        const bumpLocalY = (4 + TIP_BUMP_R) * yDirT;           // さらに 1 px 下げる
        const tipBX = fl.pivotX + bumpLocalX * rCos - bumpLocalY * rSin;
        const tipBY = fl.pivotY + bumpLocalX * rSin + bumpLocalY * rCos;
        const tdx = b.x - tipBX, tdy = b.y - tipBY;
        const sumR = r + TIP_BUMP_R;
        if (tdx * tdx + tdy * tdy < sumR * sumR) {
          const td = Math.sqrt(tdx * tdx + tdy * tdy) || 0.001;
          const tnx = tdx / td, tny = tdy / td;
          // 押し出し
          b.x = tipBX + tnx * (sumR + 0.5);
          b.y = tipBY + tny * (sumR + 0.5);
          // 反射 (restitution = 0.18、控えめに跳ね返る)
          const tdot = b.vx * tnx + b.vy * tny;
          if (tdot < 0) {
            const e = 0.18;
            b.vx -= (1 + e) * tdot * tnx;
            b.vy -= (1 + e) * tdot * tny;
            flipperSoundNeeded = true;
          }
          break;  // バンパーで処理したのでこのフリッパーの本体は飛ばす
        }
        const res = resolveCircleCapsule(b.x, b.y, r, b.vx, b.vy, fl.getOBB(), 0.35, 0.998);
        if (res) {
          const preSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          [b.x, b.y, b.vx, b.vy] = res;
          const [nvx, nvy] = fl.applyImpulse(b.vx, b.vy);
          b.vx = nvx; b.vy = nvy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
          const postSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          // 打ち出し時のみ音を鳴らす (擦り音の連発を避ける)
          if (postSpd > preSpd + 2) flipperSoundNeeded = true;
          break;
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

    // ダメージは常に 1 (HP 単位 = ヒット回数管理)
    if (bldResult) {
      const { bld } = bldResult;
      const destroyed = this.buildings.damage(bld, 1);

      if (destroyed) {
        // 貫通: 速度そのまま通過 (減速なし)
        b.lastPiercedBld = bld;
        this.onBuildingDestroyed(bld);
      } else {
        // 反射: 反発係数を適用してエネルギーを失わせる (ふんわり感)
        // 「下から建物の底面に当たった」= ボールが上向き (vy>0) で反射後に下向き (newVy<0) のケース
        // この場合は鉛直反転が発生するので、強めに減衰させて思い切り弾かれる感を消す
        const isBottomHit = b.vy > 0.5 && bldResult.newVy < 0;
        const restitution = isBottomHit ? C.RESTITUTION_BUILDING_BOTTOM : C.RESTITUTION_BUILDING;
        // resolveCircleAABB は damping=0.78 で反射済み (= 旧コードはこれを巻き戻して 1.0 にしていた)。
        // 今は preSpd 比で再スケールしてから restitution を掛けて目標反発係数に揃える。
        const preSpd  = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 0.001;
        const postSpd = Math.sqrt(bldResult.newVx ** 2 + bldResult.newVy ** 2) || 0.001;
        const k = (preSpd / postSpd) * restitution;
        b.vx = bldResult.newVx * k;
        b.vy = bldResult.newVy * k;
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
      const destroyed = this.furniture.damage(furnitureHit, 1);
      this.spawnFurnitureFx(furnitureHit.type, b.x, b.y, destroyed);
      this.juice.shake(C.SHAKE_HIT_AMP * 0.5, C.SHAKE_HIT_DUR * 0.5);
      if (destroyed) this.addScore(furnitureHit.score);
    }

    const vehicleHit = this.vehicles.checkBallHit(b.x, b.y, r);
    if (vehicleHit) {
      const destroyed = this.vehicles.damage(vehicleHit, 1);
      if (destroyed) {
        this.spawnVehicleFx(vehicleHit.type, b.x, b.y);
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
        this.addScore(vehicleHit.score);
        // 工業車両 (worker_truck) は破壊時に労働者を吐く — Stage 4 の燃料補給源
        const yield_ = VEHICLE_HUMAN_YIELD[vehicleHit.type];
        if (yield_) {
          this.humans.spawnBlast(vehicleHit.x, vehicleHit.y, randInt(yield_[0], yield_[1]));
        }
      }
      this.juice.ballHitFlash();
    }

    const crushed = this.humans.checkCrush(b.x, b.y, r);
    if (crushed.length > 0) {
      for (const idx of crushed) {
        const [hx, hy] = this.humans.getPos(idx);
        this.particles.spawnBlood(hx, hy, randInt(18, 28));
        this.particles.spawnBloodPool(hx, hy);
      }
      this.totalHumans += crushed.length;
      // 人間は燃料: 線形に回復
      this.fuel = Math.min(C.FUEL_MAX, this.fuel + crushed.length * C.FUEL_GAIN_PER_HUMAN);
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
    this.addScore(bld.score);
    this.sound.buildingDestroy();

    // hp 4段階 → tier 1-4 に正規化してパーティクル数・演出強度に使う
    const sc = Math.ceil(bld.maxHp / 4); // hp4→1, hp8→2, hp11→3, hp13→4
    const isLarge = bld.maxHp >= 11;
    if (isLarge) { this.juice.hitstop(C.HITSTOP_LARGE); this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5); this.juice.flash(1, 1, 1, 0.40); }
    else         { this.juice.hitstop(C.HITSTOP_SMALL);  this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR); this.juice.flash(1, 0.85, 0.4, 0.18); }

    const [dr, dg, db] = bld.baseColor;
    const top = bld.y + bld.h;

    // ── 素材別ベース破壊エフェクト ────────────────────────
    // 建物の素材・規模に応じた基本パーティクルセットを散らす
    this.spawnBaseDestructionFx(bld.size, cx, cy, top, sc, isLarge, dr, dg, db);

    // ── 種別別テーマパーティクル ─────────────────────────
    this.spawnThemedDestructionFx(bld.size, cx, cy, sc);

    // ── 救急車: 病院 ─────────────────────────────────────
    if (bld.size === 'hospital') {
      this.vehicles.spawnAmbulance(cx < 0 ? 190 : -190, C.MAIN_STREET_Y);
    }

    // 建物種別に応じた人間プールを取得 (学校 → 子供、病院 → 看護師など)
    const kindWeights = getHumanWeightsForBuilding(bld.size);
    this.humans.spawnBlast(cx, cy, randInt(bld.humanMin, bld.humanMax), kindWeights);
  }

  /** 素材別の基本破壊パーティクル — 木造 / コンクリ / 金属 / ガラス張り 等で異なる */
  private spawnBaseDestructionFx(
    size: C.BuildingSize, cx: number, cy: number, top: number,
    sc: number, isLarge: boolean, dr: number, dg: number, db: number
  ) {
    const profile = BUILDING_MATERIAL[size] ?? 'concrete_small';
    const debrisN = 14 + sc * 10;
    const rubbleN = 4 + sc * 2;          // 大きな塊 (4-12個)
    const p = this.particles;

    switch (profile) {
      case 'wood': // 木造 — 木っ端山盛り + 木質塊 + 燃えさし
        p.spawnWoodChips  (cx, cy, 18 + sc * 10);
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.55, 0.38, 0.22);
        p.spawnEmbers     (cx, cy,  6 + sc * 3);
        break;

      case 'wood_traditional': // 伝統木造 — 木っ端 + 木質塊 + 落葉 + 燃えさし
        p.spawnWoodChips  (cx, cy, 16 + sc * 10);
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.50, 0.32, 0.20);
        p.spawnLeaves     (cx, cy, 10 + sc * 4);
        p.spawnEmbers     (cx, cy,  8 + sc * 3);
        break;

      case 'concrete_small': // 小型コンクリ — 大塊 + 細片 + 火花
        p.spawnRubbleChunks(cx, cy, rubbleN, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN, dr, dg, db);
        p.spawnSpark       (cx, cy,  8 + sc * 5);
        break;

      case 'concrete_medium': // 中型コンクリ — 大塊 + 細片 + ガラス + 火花
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN + 4, dr, dg, db);
        p.spawnGlass       (cx, cy,  6 + sc * 3);
        p.spawnSpark       (cx, cy, 10 + sc * 5);
        break;

      case 'glass_tower': // ガラス高層 — 大塊 + ガラス山盛り + 細片 + きらめき
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnGlass       (cx, cy, 22 + sc * 10);
        p.spawnDebris      (cx, cy, 12 + sc * 8, dr, dg, db);
        p.spawnSparkle     (cx, cy,  6 + sc * 2);
        if (isLarge) {
          p.spawnGlass       (cx, top, 16);
          p.spawnRubbleChunks(cx, top, 4, dr, dg, db);
        }
        break;

      case 'metal_industrial': // 工業 — 金属大塊 + 金属片 + 歯車 + 火花 (+ ステージ4のみ煙)
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.62, 0.62, 0.66);
        p.spawnMetalDebris (cx, cy, 14 + sc * 8);
        if (this.currentStageIndex === 3) p.spawnSmoke(cx, cy, 12 + sc * 5);
        p.spawnSpark       (cx, cy, 12 + sc * 5);
        p.spawnGears       (cx, cy,  6 + sc * 3);
        break;

      case 'landmark': // ランドマーク — 大塊 + 細片 + きらめき + 紙吹雪 + 炎
        p.spawnRubbleChunks(cx, cy, rubbleN + 3, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN, dr, dg, db);
        p.spawnSparkle     (cx, cy, 14 + sc * 5);
        p.spawnConfetti    (cx, cy, 12 + sc * 4);
        p.spawnFire        (cx, cy,  8 + sc * 3);
        if (isLarge) {
          p.spawnRubbleChunks(cx, top, 4, dr, dg, db);
          p.spawnSparkle     (cx, top, 12);
          p.spawnConfetti    (cx, top, 10);
        }
        break;

      case 'explosive': // 爆発 (ガソスタ) — 大塊 + 大量炎 + 燃えさし + 細片
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnFire        (cx, cy, 28 + sc * 6);
        p.spawnSpark       (cx, cy, 22 + sc * 6);
        if (this.currentStageIndex === 3) p.spawnSmoke(cx, cy, 18);
        p.spawnEmbers      (cx, cy, 24);
        p.spawnDebris      (cx, cy, 14, dr, dg, db);
        break;

      case 'castle': // 天守閣 — 巨大瓦礫雨 + 花火 + 桜 + きらめき
        p.spawnRubbleChunks(cx, cy, 16, dr, dg, db);
        p.spawnRubbleChunks(cx, top, 12, dr, dg, db);
        p.spawnFireworks   (cx, cy, 50);
        p.spawnSakuraPetals(cx, cy, 30);
        p.spawnSparkle     (cx, cy, 24);
        p.spawnDebris      (cx, cy, 30, dr, dg, db);
        p.spawnFireworks   (cx, top, 40);
        p.spawnFireworks   (cx + 30, top - 10, 30);
        p.spawnFireworks   (cx - 30, top - 10, 30);
        break;

      default:
        p.spawnRubbleChunks(cx, cy, rubbleN, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN, dr, dg, db);
        p.spawnSpark       (cx, cy, 12 + sc * 5);
    }

    // 大型ビル共通: 頂部からも追加演出 (専用処理済みのプロファイルはスキップ)
    if (isLarge && profile !== 'glass_tower' && profile !== 'castle' &&
        profile !== 'explosive' && profile !== 'landmark') {
      this.particles.spawnRubbleChunks(cx, top, 4, dr, dg, db);
      this.particles.spawnDebris      (cx, top, 12, dr, dg, db);
      this.particles.spawnSpark       (cx, top, 12);
    }
  }

  /** 種別別テーマパーティクル — 建物の用途・業種に応じた演出 */
  private spawnThemedDestructionFx(size: C.BuildingSize, cx: number, cy: number, sc: number) {
    const p = this.particles;
    switch (size) {
      // ── 金融・現金 ──
      case 'bank':              p.spawnCash(cx, cy, 16 + sc * 4); p.spawnCoins(cx, cy, 14); break;
      case 'department_store':  p.spawnCash(cx, cy, 12); p.spawnConfetti(cx, cy, 18); p.spawnBalloons(cx, cy, 8); break;

      // ── 本・知識 ──
      case 'library':           p.spawnBooks(cx, cy, 18 + sc * 3); break;
      case 'bookstore':         p.spawnBooks(cx, cy, 14); break;

      // ── 花・植物 ──
      case 'florist':           p.spawnFlower(cx, cy, 18); p.spawnLeaves(cx, cy, 8); break;
      case 'greenhouse':        p.spawnFlower(cx, cy, 14); p.spawnLeaves(cx, cy, 14); p.spawnWater(cx, cy, 6); break;

      // ── 和風・神社仏閣 ──
      case 'shrine':            p.spawnSakuraPetals(cx, cy, 22); p.spawnRibbons(cx, cy, 8); break;
      case 'temple':            p.spawnSakuraPetals(cx, cy, 14); p.spawnEmbers(cx, cy, 10); this.juice.flash(1.0, 0.7, 0.2, 0.30); break;
      case 'pagoda':            p.spawnSakuraPetals(cx, cy, 18); p.spawnEmbers(cx, cy, 12); break;
      case 'tahoto':            p.spawnSakuraPetals(cx, cy, 14); p.spawnSparkle(cx, cy, 10); break;
      case 'ryokan':
      case 'onsen_inn':         p.spawnSteam(cx, cy, 14); p.spawnSakuraPetals(cx, cy, 8); p.spawnRibbons(cx, cy, 6); break;
      case 'kominka':
      case 'machiya':
      case 'kura':              p.spawnLeaves(cx, cy, 8); p.spawnRice(cx, cy, 6); break;
      case 'chaya':             p.spawnSteam(cx, cy, 8); p.spawnRibbons(cx, cy, 6); break;
      case 'dojo':              p.spawnWoodChips(cx, cy, 10); p.spawnRibbons(cx, cy, 6); break;
      case 'wagashi':           p.spawnRice(cx, cy, 12); p.spawnFlower(cx, cy, 8); break;
      case 'kimono_shop':       p.spawnRibbons(cx, cy, 14); p.spawnSakuraPetals(cx, cy, 8); break;
      case 'sushi_ya':          p.spawnRice(cx, cy, 14); p.spawnFood(cx, cy, 8); break;

      // ── 電気・デジタル ──
      case 'game_center':       p.spawnPixels(cx, cy, 18); p.spawnElectric(cx, cy, 10); p.spawnNeonShards(cx, cy, 8); break;
      case 'pachinko':          p.spawnCoins(cx, cy, 16); p.spawnPixels(cx, cy, 14); p.spawnNeonShards(cx, cy, 8); p.spawnConfetti(cx, cy, 10); break;
      case 'police_station':    p.spawnElectric(cx, cy, 12); p.spawnPixels(cx, cy, 6); break;
      case 'fire_station':      p.spawnEmbers(cx, cy, 14); p.spawnSpark(cx, cy, 10); break;

      // ── 食事・喫茶 ──
      case 'restaurant':
      case 'cafe':
      case 'bakery':            p.spawnFood(cx, cy, 14); p.spawnSteam(cx, cy, 6); break;
      case 'ramen':             p.spawnNoodles(cx, cy, 16); p.spawnSteam(cx, cy, 12); p.spawnFood(cx, cy, 6); break;
      case 'izakaya':           p.spawnFood(cx, cy, 12); p.spawnEmbers(cx, cy, 8); p.spawnSteam(cx, cy, 8); p.spawnRibbons(cx, cy, 6); break;
      case 'supermarket':
      case 'convenience':       p.spawnFood(cx, cy, 16); p.spawnConfetti(cx, cy, 6); break;

      // ── 水・蒸気 ──
      case 'water_tower':       p.spawnWater(cx, cy, 24); p.spawnBubbles(cx, cy, 12); break;
      case 'laundromat':        p.spawnBubbles(cx, cy, 18); p.spawnSteam(cx, cy, 10); break;
      case 'train_station':     p.spawnSteam(cx, cy, 14); p.spawnGears(cx, cy, 8); p.spawnSpark(cx, cy, 10); break;

      // ── 娯楽・祝祭 ──
      case 'school':            p.spawnConfetti(cx, cy, 20); p.spawnBalloons(cx, cy, 8); break;
      case 'movie_theater':     p.spawnConfetti(cx, cy, 18); p.spawnPopcorn(cx, cy, 14); p.spawnBalloons(cx, cy, 6); break;
      case 'karaoke':           p.spawnConfetti(cx, cy, 14); p.spawnBalloons(cx, cy, 10); p.spawnNeonShards(cx, cy, 8); break;
      case 'ferris_wheel':      p.spawnBalloons(cx, cy, 18); p.spawnSparkle(cx, cy, 14); p.spawnFireworks(cx, cy, 16); break;
      case 'stadium':           p.spawnConfetti(cx, cy, 24); p.spawnBalloons(cx, cy, 14); p.spawnPopcorn(cx, cy, 14); p.spawnRibbons(cx, cy, 10); break;
      case 'daycare':           p.spawnBalloons(cx, cy, 14); p.spawnConfetti(cx, cy, 10); p.spawnFlower(cx, cy, 8); break;
      case 'carousel':          p.spawnBalloons(cx, cy, 14); p.spawnSparkle(cx, cy, 12); p.spawnConfetti(cx, cy, 10); break;
      case 'roller_coaster':    p.spawnSparkle(cx, cy, 16); p.spawnConfetti(cx, cy, 14); p.spawnFireworks(cx, cy, 18); break;
      case 'big_tent':          p.spawnConfetti(cx, cy, 22); p.spawnBalloons(cx, cy, 12); p.spawnRibbons(cx, cy, 12); p.spawnPopcorn(cx, cy, 10); break;
      case 'yatai':             p.spawnPopcorn(cx, cy, 8); p.spawnSteam(cx, cy, 6); p.spawnRibbons(cx, cy, 6); break;

      // ── 医療 ──
      case 'hospital':          p.spawnPills(cx, cy, 14); p.spawnGlass(cx, cy, 8); break;
      case 'clinic':            p.spawnPills(cx, cy, 10); break;
      case 'pharmacy':          p.spawnPills(cx, cy, 16); break;

      // ── 工業 ──
      case 'factory_stack':     p.spawnGears(cx, cy, 12); p.spawnEmbers(cx, cy, 10); p.spawnFire(cx, cy, 8); break;
      case 'crane_gantry':      p.spawnGears(cx, cy, 14); p.spawnSpark(cx, cy, 12); break;
      case 'warehouse':         p.spawnGears(cx, cy, 8); p.spawnDebris(cx, cy, 6, 0.7, 0.55, 0.40); break;
      case 'silo':              p.spawnFood(cx, cy, 14); p.spawnDebris(cx, cy, 6, 0.85, 0.78, 0.55); break;
      case 'container_stack':   p.spawnGears(cx, cy, 6); break;

      // ── 夜街・繁華街 ──
      case 'snack':             p.spawnHearts(cx, cy, 10); p.spawnNeonShards(cx, cy, 8); break;
      case 'love_hotel':        p.spawnHearts(cx, cy, 18); p.spawnNeonShards(cx, cy, 10); break;
      case 'business_hotel':    p.spawnGlass(cx, cy, 10); p.spawnCash(cx, cy, 6); break;
      case 'mahjong_parlor':    p.spawnTiles(cx, cy, 18); break;
      case 'club':              p.spawnNeonShards(cx, cy, 16); p.spawnPixels(cx, cy, 14); p.spawnSparkle(cx, cy, 8); break;
      case 'capsule_hotel':     p.spawnGlass(cx, cy, 8); p.spawnPixels(cx, cy, 8); break;

      // ── 公共 ──
      case 'museum':            p.spawnSparkle(cx, cy, 14); p.spawnCoins(cx, cy, 8); break;
      case 'city_hall':         p.spawnRibbons(cx, cy, 10); p.spawnConfetti(cx, cy, 14); break;
      case 'post_office':       p.spawnCash(cx, cy, 8); p.spawnConfetti(cx, cy, 8); break;
      case 'clock_tower':       p.spawnGears(cx, cy, 14); p.spawnSparkle(cx, cy, 10); break;
      case 'radio_tower':       p.spawnElectric(cx, cy, 14); p.spawnSparkle(cx, cy, 8); break;

      // ── 商店街・公共 ──
      case 'shotengai_arcade':  p.spawnRibbons(cx, cy, 14); p.spawnConfetti(cx, cy, 8); break;
      case 'fountain_pavilion': p.spawnWater(cx, cy, 18); p.spawnBubbles(cx, cy, 10); p.spawnSparkle(cx, cy, 6); break;
      case 'bus_terminal_shelter': p.spawnGlass(cx, cy, 8); break;
    }
  }

  /** 街路設備を破壊した時の種別別パーティクル */
  private spawnFurnitureFx(type: FurnitureType, x: number, y: number, destroyed: boolean) {
    const p = this.particles;
    // 破壊されない (一撃で壊れない) ヒットは小さめのスパーク/砂塵で控えめに
    if (!destroyed) {
      switch (type) {
        case 'tree': case 'bush': case 'hedge': case 'sakura_tree': case 'pine_tree':
        case 'palm_tree': case 'bamboo_cluster': case 'bonsai':
          p.spawnLeaves(x, y, 3); break;
        case 'hydrant': case 'fountain': case 'koi_pond': case 'water_tank':
        case 'fountain_large': case 'temizuya': case 'bamboo_water_fountain':
        case 'puddle_reflection':
          p.spawnWater(x, y, 4); break;
        case 'flower_bed': case 'planter': case 'potted_plant': case 'flower_planter_row':
          p.spawnFlower(x, y, 3); break;
        case 'power_pole': case 'electric_box': case 'cable_junction_box':
        case 'power_line': case 'signal_tower':
          p.spawnElectric(x, y, 4); break;
        case 'wood_fence': case 'bench': case 'bamboo_fence': case 'pallet_stack':
        case 'torii': case 'shrine_fence_red': case 'ema_rack': case 'ema_wall':
        case 'sando_stone_pillar':
          p.spawnWoodChips(x, y, 3); break;
        case 'rock': case 'stone_lantern': case 'stepping_stones': case 'koma_inu':
        case 'statue': case 'sandbags': case 'manhole_cover':
          p.spawnDebris(x, y, 3, 0.62, 0.58, 0.50); break;
        default:
          p.spawnSpark(x, y, 3);
      }
      return;
    }

    // 完全破壊時は素材・テーマに応じたパーティクル
    switch (type) {
      // ── 緑・植栽 ──
      case 'tree': case 'pine_tree':
        p.spawnLeaves(x, y, 12); p.spawnWoodChips(x, y, 6); break;
      case 'sakura_tree':
        p.spawnSakuraPetals(x, y, 14); p.spawnWoodChips(x, y, 4); break;
      case 'palm_tree':
        p.spawnLeaves(x, y, 10); p.spawnWoodChips(x, y, 4); break;
      case 'bush': case 'hedge':
        p.spawnLeaves(x, y, 12); break;
      case 'bamboo_cluster': case 'bamboo_fence':
        p.spawnLeaves(x, y, 8); p.spawnWoodChips(x, y, 8); break;
      case 'bonsai': case 'planter': case 'potted_plant':
        p.spawnLeaves(x, y, 6); p.spawnFlower(x, y, 4); p.spawnDebris(x, y, 4, 0.55, 0.42, 0.32); break;
      case 'flower_bed': case 'flower_planter_row':
        p.spawnFlower(x, y, 12); p.spawnLeaves(x, y, 4); break;

      // ── 水 ──
      case 'hydrant':
        p.spawnWater(x, y, 14); p.spawnBubbles(x, y, 4); break;
      case 'fountain': case 'fountain_large':
        p.spawnWater(x, y, 18); p.spawnBubbles(x, y, 6); p.spawnSparkle(x, y, 4); break;
      case 'koi_pond':
        p.spawnWater(x, y, 14); p.spawnBubbles(x, y, 8); p.spawnLeaves(x, y, 4); break;
      case 'water_tank':
        p.spawnWater(x, y, 16); p.spawnMetalDebris(x, y, 6); break;
      case 'temizuya': case 'bamboo_water_fountain':
        p.spawnWater(x, y, 10); p.spawnWoodChips(x, y, 4); break;
      case 'puddle_reflection':
        p.spawnWater(x, y, 6); break;

      // ── 看板・サイン ──
      case 'sign_board': case 'a_frame_sign': case 'banner_pole': case 'taxi_rank_sign':
        p.spawnConfetti(x, y, 8); p.spawnWoodChips(x, y, 4); break;

      // ── 電気・ネオン ──
      case 'power_pole': case 'power_line':
        p.spawnElectric(x, y, 14); p.spawnSpark(x, y, 6); break;
      case 'electric_box': case 'cable_junction_box':
        p.spawnElectric(x, y, 10); p.spawnMetalDebris(x, y, 4); break;
      case 'signal_tower': case 'railroad_crossing':
        p.spawnElectric(x, y, 8); p.spawnSpark(x, y, 6); break;

      // ── ゴミ・食 ──
      case 'garbage':
        p.spawnFood(x, y, 10); break;
      case 'dumpster':
        p.spawnFood(x, y, 6); p.spawnMetalDebris(x, y, 6); break;
      case 'recycling_bin':
        p.spawnGlass(x, y, 8); p.spawnMetalDebris(x, y, 4); break;

      // ── 自販機・ATM・電話ボックス ──
      case 'vending':
        p.spawnGlass(x, y, 6); p.spawnMetalDebris(x, y, 6); p.spawnCoins(x, y, 6); break;
      case 'atm':
        p.spawnCash(x, y, 12); p.spawnCoins(x, y, 8); p.spawnGlass(x, y, 4); break;
      case 'telephone_booth':
        p.spawnGlass(x, y, 12); p.spawnSpark(x, y, 4); break;
      case 'newspaper_stand':
        p.spawnConfetti(x, y, 8); p.spawnWoodChips(x, y, 4); break;
      case 'post_box': case 'post_letter_box': case 'mailbox':
        p.spawnCash(x, y, 6); p.spawnMetalDebris(x, y, 4); break;

      // ── 自転車・乗り物 ──
      case 'bicycle': case 'bicycle_rack': case 'bicycle_row':
        p.spawnMetalDebris(x, y, 6); p.spawnSpark(x, y, 4); break;
      case 'forklift':
        p.spawnMetalDebris(x, y, 8); p.spawnGears(x, y, 6); p.spawnSpark(x, y, 4); break;

      // ── 街路設備・金属系 ──
      case 'street_lamp':
        p.spawnGlass(x, y, 6); p.spawnSpark(x, y, 6); break;
      case 'traffic_light':
        p.spawnGlass(x, y, 4); p.spawnSpark(x, y, 6); p.spawnMetalDebris(x, y, 4); break;
      case 'bollard': case 'traffic_cone':
        p.spawnDebris(x, y, 6, 0.85, 0.55, 0.20); break;
      case 'barrier': case 'guardrail': case 'guardrail_short': case 'platform_edge':
      case 'pedestrian_bridge': case 'railway_track':
        p.spawnMetalDebris(x, y, 8); p.spawnSpark(x, y, 4); break;
      case 'fire_extinguisher':
        p.spawnSpark(x, y, 6); p.spawnMetalDebris(x, y, 6);
        if (this.currentStageIndex === 3) p.spawnSmoke(x, y, 8);
        break;
      case 'bus_stop':
        p.spawnGlass(x, y, 10); p.spawnMetalDebris(x, y, 4); break;
      case 'flag_pole':
        p.spawnRibbons(x, y, 8); break;
      case 'street_mirror':
        p.spawnGlass(x, y, 12); break;
      case 'manhole_cover':
        p.spawnMetalDebris(x, y, 6); p.spawnSpark(x, y, 6); break;

      // ── 木造・伝統 ──
      case 'wood_fence': case 'bench': case 'pallet_stack': case 'milk_crate_stack':
      case 'play_structure': case 'slide': case 'swing_set': case 'jungle_gym':
      case 'sandbox':
        p.spawnWoodChips(x, y, 10); p.spawnDebris(x, y, 3, 0.55, 0.42, 0.30); break;
      case 'parasol': case 'shop_awning':
        p.spawnConfetti(x, y, 6); p.spawnRibbons(x, y, 4); break;
      case 'noren': case 'shinto_rope': case 'tarp': case 'laundry_pole':
      case 'laundry_balcony':
        p.spawnRibbons(x, y, 10); break;
      case 'chouchin':
        p.spawnEmbers(x, y, 8); p.spawnRibbons(x, y, 4); break;
      case 'torii': case 'shrine_fence_red':
        p.spawnWoodChips(x, y, 8); p.spawnSakuraPetals(x, y, 4); break;
      case 'ema_rack': case 'ema_wall': case 'omikuji_stand':
        p.spawnWoodChips(x, y, 4); p.spawnConfetti(x, y, 6); break;
      case 'offering_box':
        p.spawnWoodChips(x, y, 6); p.spawnCoins(x, y, 8); break;
      case 'stone_lantern': case 'koma_inu': case 'sando_stone_pillar':
      case 'rock': case 'stepping_stones': case 'statue':
        p.spawnRubbleChunks(x, y, 3, 0.55, 0.52, 0.48); p.spawnDebris(x, y, 8, 0.5, 0.5, 0.5); break;
      case 'sandbags':
        p.spawnDebris(x, y, 14, 0.78, 0.65, 0.42); break;

      // ── 工業・港湾 ──
      case 'drum_can':
        p.spawnFire(x, y, 8); p.spawnMetalDebris(x, y, 4); p.spawnEmbers(x, y, 6);
        if (this.currentStageIndex === 3) p.spawnSmoke(x, y, 6);
        break;
      case 'cargo_container':
        p.spawnMetalDebris(x, y, 10); p.spawnSpark(x, y, 4); break;
      case 'buoy':
        p.spawnWater(x, y, 8); p.spawnDebris(x, y, 4, 0.95, 0.20, 0.20); break;
      case 'gas_canister':
        p.spawnFire(x, y, 10); p.spawnSpark(x, y, 8); p.spawnEmbers(x, y, 6);
        if (this.currentStageIndex === 3) p.spawnSmoke(x, y, 6);
        break;
      case 'ac_unit': case 'ac_outdoor_cluster':
        p.spawnMetalDebris(x, y, 8); p.spawnSpark(x, y, 4); p.spawnSteam(x, y, 4); break;

      // ── お祭り・テーマ ──
      case 'balloon_cluster':
        p.spawnBalloons(x, y, 14); p.spawnConfetti(x, y, 6); break;
      case 'ticket_booth':
        p.spawnConfetti(x, y, 10); p.spawnCash(x, y, 6); break;
      case 'matsuri_drum':
        p.spawnWoodChips(x, y, 10); p.spawnRibbons(x, y, 6); break;
      case 'popcorn_cart':
        p.spawnPopcorn(x, y, 14); p.spawnSteam(x, y, 6); break;
      case 'plaza_tile_circle':
        p.spawnDebris(x, y, 10, 0.7, 0.65, 0.55); break;
      case 'bathhouse_chimney':
        p.spawnEmbers(x, y, 8); p.spawnDebris(x, y, 10, 0.55, 0.30, 0.20);
        if (this.currentStageIndex === 3) p.spawnSmoke(x, y, 8);
        break;
      case 'fire_watchtower':
        p.spawnWoodChips(x, y, 10); p.spawnEmbers(x, y, 6); break;
      case 'grain_silo':
        p.spawnFood(x, y, 12); p.spawnDebris(x, y, 6, 0.85, 0.78, 0.55); break;

      // ── 動物 ──
      case 'cat':
        p.spawnFlower(x, y, 8); p.spawnSparkle(x, y, 4); break;

      // ── 建物の小型版 ──
      case 'kerbside_vending_pair':
        p.spawnGlass(x, y, 6); p.spawnCoins(x, y, 4); break;

      default:
        p.spawnDebris(x, y, 4, 0.55, 0.50, 0.45); p.spawnSpark(x, y, 3);
    }
  }

  /** 車両を破壊した時の車種別パーティクル */
  private spawnVehicleFx(type: VehicleType, x: number, y: number) {
    const p = this.particles;
    switch (type) {
      case 'car':
        p.spawnMetalDebris(x, y, 8); p.spawnGlass(x, y, 6); p.spawnSpark(x, y, 6);
        p.spawnEmbers(x, y, 4); break;
      case 'taxi':
        p.spawnMetalDebris(x, y, 8); p.spawnGlass(x, y, 6); p.spawnCash(x, y, 6);
        p.spawnSpark(x, y, 4); break;
      case 'bus':
        p.spawnMetalDebris(x, y, 14); p.spawnGlass(x, y, 12); p.spawnEmbers(x, y, 8);
        p.spawnSpark(x, y, 6); break;
      case 'truck':
        p.spawnMetalDebris(x, y, 12); p.spawnDebris(x, y, 10, 0.55, 0.42, 0.30);
        p.spawnEmbers(x, y, 6); p.spawnGears(x, y, 4); break;
      case 'delivery': case 'van':
        p.spawnMetalDebris(x, y, 10); p.spawnGlass(x, y, 4); p.spawnFood(x, y, 6);
        p.spawnSpark(x, y, 4); break;
      case 'motorcycle':
        p.spawnMetalDebris(x, y, 6); p.spawnGears(x, y, 4); p.spawnSpark(x, y, 8);
        p.spawnFire(x, y, 4); break;
      case 'ambulance':
        p.spawnMetalDebris(x, y, 10); p.spawnGlass(x, y, 8); p.spawnPills(x, y, 10);
        p.spawnElectric(x, y, 4); break;
      case 'worker_truck':
        p.spawnMetalDebris(x, y, 14); p.spawnGears(x, y, 8); p.spawnSpark(x, y, 8);
        p.spawnGlass(x, y, 6); p.spawnEmbers(x, y, 4); break;
      default:
        p.spawnDebris(x, y, 8, 0.5, 0.5, 0.55); p.spawnSpark(x, y, 6);
    }
  }

  // ===== チャンク管理 =====

  private updateChunks() {
    const spawnAhead  = C.CHUNK_SPAWN_AHEAD;
    const despawnBehind = C.CHUNK_DESPAWN_BEHIND;
    const spawnThreshold = this.camera.top + spawnAhead;
    const despawnThreshold = this.camera.bottom - despawnBehind;

    // 上方向に新チャンクを先読みスポーン (TOTAL_CHUNKS を超えたら停止)
    while (this.nextChunkId < TOTAL_CHUNKS) {
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
    this.vehicles.addChunkLanes(chunkId, chunk.roads, chunk.stageIndex);
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
    const chunk = this.loadedChunks.get(chunkId);
    // このチャンクに属する地面タイルのキャッシュを解放
    if (chunk) {
      for (const tile of chunk.grounds) {
        const key = `${tile.type}|${tile.x}|${tile.y}|${tile.w}|${tile.h}`;
        this.groundTileCache.delete(key);
      }
    }
    this.buildings.unloadChunk(chunkId);
    this.furniture.unloadChunk(chunkId);
    this.vehicles.removeChunkLanes(chunkId);
    this.humans.removeRoadsBelow(this.camera.bottom - C.CHUNK_DESPAWN_BEHIND);
    this.loadedChunks.delete(chunkId);
  }

  /**
   * v6.3 SemanticCluster ambient emit
   * 各 hero クラスタの focal 周辺で低レートで環境パーティクルを出す
   * (kominka→steam, sakura_tree→sakura, koi_pond→water, ...)
   */
  private _updateAmbient(dt: number) {
    this._ambientAccumulator += dt;
    if (this._ambientAccumulator < 0.2) return;  // ~5 emission opportunities/sec (v2: 5x density)
    this._ambientAccumulator = 0;

    const camTop = this.camera.top + 30;
    const camBot = this.camera.bottom - 30;

    for (const chunk of this.loadedChunks.values()) {
      if (!chunk.clusters) continue;
      for (const c of chunk.clusters) {
        if (c.role !== 'hero') continue;
        // focal の世界座標を取得
        let fx: number, fy: number;
        if (c.focal.kind === 'b') {
          const b = chunk.buildings[c.focal.i];
          if (!b) continue;
          fx = b.x; fy = b.y;
        } else {
          const f = chunk.furniture[c.focal.i];
          if (!f) continue;
          fx = f.x; fy = f.y;
        }
        // 画面外チャンクはスキップ
        if (fy > camTop || fy < camBot) continue;
        // focal 種別から ambient type を派生
        const ambientType = this._ambientTypeFromFocal(c.focal, chunk);
        if (ambientType) {
          this.particles.spawnAmbient(fx, fy, ambientType);
        }
      }
    }
  }

  /** focal の種別 (建物 size or 家具 type) から ambient particle 種を決定 */
  private _ambientTypeFromFocal(
    focal: { kind: 'b' | 'f'; i: number },
    chunk: ChunkData
  ): 'sakura' | 'steam' | 'water' | 'dust' | 'firefly' | null {
    if (focal.kind === 'b') {
      const size = chunk.buildings[focal.i]?.size;
      switch (size) {
        case 'kominka':
        case 'onsen_inn':
        case 'train_station':
          return 'steam';
        case 'gas_station':
        case 'school':
        case 'warehouse':
          return 'dust';
        case 'mansion':
        case 'machiya':
        case 'duplex':
          return null; // 住宅は控えめに無し
        default:
          return null;
      }
    } else {
      const type = chunk.furniture[focal.i]?.type;
      switch (type) {
        case 'koi_pond':
        case 'fountain':
        case 'fountain_large':
        case 'temizuya':
          return 'water';
        case 'bathhouse_chimney':
          return 'steam';
        case 'sakura_tree':
        case 'cherry_blossom' as any:
          return 'sakura';
        case 'play_structure':
        case 'sandbox':
        case 'jungle_gym':
          return 'dust';
        case 'statue':
        case 'plaza_tile_circle':
          return 'firefly';
        case 'grain_silo':
          return 'dust';
        case 'railroad_crossing':
          return null; // 踏切は静的
        default:
          return null;
      }
    }
  }

  private onBallLost() {
    this.ball.active = false;
    this.sound.ballLost();
    this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);
    // 穴に落ちたペナルティ: 燃料 20% (FUEL_MAX の 20%) を失う
    this.fuel = Math.max(0, this.fuel - C.FUEL_MAX * 0.20);
    this.ui.setFuel(this.fuel);
    this.state = 'ball_lost';
    this.stateTimer = 1.0;
  }


  private onGameOver() {
    this.state = 'game_over';
    this.juice.flash(1, 0, 0, 0.6);
    this.sound.stopMusic();
    // CrazyGames: プレイ終了を通知 (インタースティシャル広告の候補タイミング)
    gameplayStop();
    this.updateBestScore();
    setTimeout(() => {
      this.ui.showGameOver(this.camera.distanceMeters, this.totalScore, this.totalDestroys, this.totalHumans, this.bestScore);
    }, 800);
  }

  private onClear() {
    this.state = 'clear';
    this.juice.flash(1, 0.9, 0.5, 0.7);
    this.sound.stopMusic();
    gameplayStop();
    this.updateBestScore();
    // 勝利演出: カメラ範囲内に花火を複数回スポーン (0〜1.2s の間に 5 連発)
    this.spawnVictoryFireworks();
    setTimeout(() => {
      this.ui.showClear(this.camera.distanceMeters, this.totalScore, this.totalDestroys, this.totalHumans, this.bestScore);
    }, 1500);
  }

  /** クリア画面を出す前に画面全体に花火を散らす */
  private spawnVictoryFireworks(): void {
    const cx = 0; // ワールド座標系 X 中心
    const cyBase = this.camera.y + C.CANVAS_HEIGHT * 0.45;
    const positions = [
      [cx - 80, cyBase + 60],
      [cx + 80, cyBase - 40],
      [cx - 40, cyBase - 10],
      [cx + 50, cyBase + 90],
      [cx, cyBase + 30],
    ];
    positions.forEach(([x, y], i) => {
      setTimeout(() => {
        this.particles.spawnFireworks(x, y, 40);
        this.sound.stageClear();
        this.juice.shake(3, 0.15);
      }, i * 240);
    });
  }

  /** スコア加算ヘルパー: HUD も即時反映 */
  private addScore(delta: number): void {
    this.totalScore += delta;
    this.ui.setScore(this.totalScore);
  }

  /** ハイスコア判定: 現在スコアがベストを超えていれば保存 + HUD 更新 */
  private updateBestScore(): void {
    if (this.totalScore > this.bestScore) {
      this.bestScore = this.totalScore;
      saveBestScore(this.bestScore);
      this.ui.setBest(this.bestScore);
    }
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
    n += this.fillSlopes(SHARED_BUF, n);
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
   *
   * ★ キャッシュ: 各タイルはハッシュベースで決定論的なので、一度計算したら
   *   同じ結果が常に得られる。初回に全 instance を Float32Array へ焼き込み、
   *   以後は buf.set() でコピーするだけ (毎フレームの再計算を省略)。
   *   キャッシュキーは (type, x, y, w, h)。タイル識別子として十分。
   */
  private groundTileCache = new Map<string, Float32Array>();

  private drawGroundTile(buf: Float32Array, idx: number, tile: GroundTile): number {
    const key = `${tile.type}|${tile.x}|${tile.y}|${tile.w}|${tile.h}`;
    let cached = this.groundTileCache.get(key);
    if (!cached) {
      // 初回: 十分大きい一時バッファに書き込んでから必要サイズに slice
      const TEMP_MAX_INSTANCES = 64;
      const temp = new Float32Array(TEMP_MAX_INSTANCES * INST_F);
      const count = this._computeGroundTileInstances(temp, 0, tile);
      cached = temp.slice(0, count * INST_F);
      this.groundTileCache.set(key, cached);
    }
    // キャッシュ済み: buf の idx 位置にまるごとコピー
    buf.set(cached, idx * INST_F);
    return cached.length / INST_F;
  }

  /** 実際のタイル描画ロジック (キャッシュミス時のみ呼ばれる) */
  private _computeGroundTileInstances(buf: Float32Array, idx: number, tile: GroundTile): number {
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

      // ─── 住宅街インターロッキング: 控えめに温かみのあるグレー系ペイバー ───
      case 'residential_tile': {
        // 目地の暗いグレー下地 (僅かに暖色)
        writeInst(buf, n++, x, y, w, h, 0.45, 0.42, 0.38, 1);
        // タイルサイズを概ね一定 (≈90×18) に保つよう、パッチのサイズから
        // 行数・列数を算出 (薄い帯でもタイルが潰れないようにする)
        const targetTileW = 90;
        const targetTileH = 18;
        const cols = Math.max(1, Math.round(w / targetTileW));
        const rows = Math.max(1, Math.round(h / targetTileH));
        const bw = w / cols;
        const bh = h / rows;
        for (let r = 0; r < rows; r++) {
          const rowOff = (r % 2) * bw * 0.5;
          for (let c = -1; c <= cols; c++) {
            const bx = x - w / 2 + (c + 0.5) * bw + rowOff;
            const by = y - h / 2 + (r + 0.5) * bh;
            if (bx < x - w / 2 - bw * 0.2 || bx > x + w / 2 + bw * 0.2) continue;
            const hv = hash(r * 11 + c * 23 + 3);
            // グレーをベースに、ブロックごとに少しずつ暖色・寒色へ振って
            // 日常住宅街のペイバー感 (統一感 + 微妙な個性) を出す
            const shade = 0.70 + hv * 0.10;
            const hueBias = hash(r * 7 + c * 13);
            const warm  = (hueBias - 0.35) * 0.05;    // 暖色〜わずかに寒色
            writeInst(buf, n++, bx, by, bw * 0.92, bh * 0.84,
              shade + warm, shade + warm * 0.3, shade - warm * 0.6, 1);
            // ブロック上辺の明るい縁 (立体感)
            writeInst(buf, n++, bx, by - bh * 0.34, bw * 0.82, 0.35,
              Math.min(1, shade + 0.15 + warm), Math.min(1, shade + 0.13), Math.min(1, shade + 0.09), 0.75);
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
      case 'steel_plate': {
        // 鉄板: 暗い灰色 + 縞板パターン
        writeInst(buf, n++, x, y, w, h, 0.38, 0.38, 0.42, 1);
        for (let i = -2; i <= 2; i++) {
          writeInst(buf, n++, x + i * w * 0.18, y - h * 0.25, 1.2, 6, 0.48, 0.48, 0.52, 0.75, 0.5);
          writeInst(buf, n++, x + i * w * 0.18, y + h * 0.15, 1.2, 6, 0.48, 0.48, 0.52, 0.75, 0.5);
        }
        // リベット
        for (let cx of [-0.4, 0, 0.4]) {
          for (let cy of [-0.4, 0.4]) {
            writeInst(buf, n++, x + cx * w, y + cy * h, 1.5, 1.5, 0.22, 0.22, 0.25, 0.9, 0, 1);
          }
        }
        // サビ
        writeInst(buf, n++, x - w * 0.30, y + h * 0.30, w * 0.18, h * 0.12, 0.55, 0.32, 0.20, 0.55, 0, 1);
        break;
      }
      case 'oil_stained_concrete': {
        // 油汚れコンクリ: 暗いベース + 虹色の油シミ複数
        writeInst(buf, n++, x, y, w, h, 0.45, 0.44, 0.42, 1);
        writeInst(buf, n++, x - w * 0.20, y, w * 0.45, h * 0.30, 0.32, 0.28, 0.24, 0.85, 0, 1);
        writeInst(buf, n++, x + w * 0.25, y - h * 0.10, w * 0.30, h * 0.22, 0.22, 0.22, 0.20, 0.75, 0, 1);
        // 虹光沢
        writeInst(buf, n++, x - w * 0.20, y, w * 0.30, h * 0.15, 0.50, 0.35, 0.55, 0.35, 0, 1);
        writeInst(buf, n++, x + w * 0.25, y - h * 0.10, w * 0.18, h * 0.10, 0.40, 0.50, 0.35, 0.35, 0, 1);
        // エキスパンションジョイント
        writeInst(buf, n++, x, y - h * 0.35, w, 0.6, 0.25, 0.22, 0.18, 0.8);
        writeInst(buf, n++, x, y + h * 0.35, w, 0.6, 0.25, 0.22, 0.18, 0.8);
        // タイヤ痕
        writeInst(buf, n++, x - w * 0.05, y, w * 0.75, 1, 0.18, 0.16, 0.14, 0.7);
        break;
      }
      case 'moss': {
        // 苔地: 深緑ベース + ふわっと明るい斑点
        writeInst(buf, n++, x, y, w, h, 0.25, 0.42, 0.25, 1);
        writeInst(buf, n++, x - w * 0.25, y - h * 0.18, w * 0.40, h * 0.32, 0.35, 0.55, 0.30, 0.7, 0, 1);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.22, w * 0.45, h * 0.35, 0.32, 0.50, 0.28, 0.7, 0, 1);
        // 濃緑斑点
        for (let i = 0; i < 5; i++) {
          const dx = ((i * 97) % 80 - 40) / 100;
          const dy = ((i * 53) % 80 - 40) / 100;
          writeInst(buf, n++, x + dx * w, y + dy * h, 3, 2, 0.18, 0.32, 0.18, 0.85, 0, 1);
        }
        // 石 or 敷石模様
        writeInst(buf, n++, x - w * 0.10, y, 6, 4, 0.52, 0.50, 0.46, 0.65, 0, 1);
        writeInst(buf, n++, x + w * 0.30, y - h * 0.10, 5, 3.5, 0.55, 0.52, 0.48, 0.55, 0, 1);
        break;
      }
      case 'red_carpet': {
        // 赤絨毯: 濃い赤 + 金のフリンジ
        writeInst(buf, n++, x, y, w, h, 0.62, 0.15, 0.18, 1);
        // 中央パターン (菱形っぽいモチーフ)
        writeInst(buf, n++, x, y, w * 0.75, h * 0.6, 0.72, 0.22, 0.22, 0.85);
        writeInst(buf, n++, x, y, w * 0.30, h * 0.30, 0.88, 0.70, 0.25, 0.75, 0, 1);
        // 金の縁取り
        writeInst(buf, n++, x, y - h * 0.40, w, 1.5, 0.90, 0.72, 0.25, 0.85);
        writeInst(buf, n++, x, y + h * 0.40, w, 1.5, 0.90, 0.72, 0.25, 0.85);
        // フリンジ
        for (let i = -4; i <= 4; i++) {
          writeInst(buf, n++, x + i * w * 0.1, y - h * 0.46, 0.4, 2, 0.95, 0.80, 0.30, 0.9);
          writeInst(buf, n++, x + i * w * 0.1, y + h * 0.46, 0.4, 2, 0.95, 0.80, 0.30, 0.9);
        }
        break;
      }
      case 'checker_tile': {
        // チェッカータイル: 2x3 の白青マス
        writeInst(buf, n++, x, y, w, h, 0.92, 0.88, 0.82, 1);
        const colors: Array<[number, number, number]> = [
          [0.30, 0.55, 0.85], [0.95, 0.92, 0.88],
        ];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 2; c++) {
            const col = colors[(r + c) % 2];
            writeInst(buf, n++, x - w * 0.25 + c * w * 0.5, y - h * 0.33 + r * h * 0.33, w * 0.48, h * 0.30, col[0], col[1], col[2], 1);
          }
        }
        // グラウト
        writeInst(buf, n++, x, y, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y - h * 0.17, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y + h * 0.17, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y, 0.5, h * 0.95, 0.55, 0.52, 0.48, 0.75);
        break;
      }
      case 'harbor_water': {
        // 港の海: 深い紺のベース + 層状の色ムラ + 波紋 + ハイライト
        writeInst(buf, n++, x, y, w, h, 0.10, 0.22, 0.36, 1);
        // 明暗の横縞 (深浅の層)
        writeInst(buf, n++, x, y - h * 0.30, w, h * 0.22, 0.14, 0.28, 0.42, 0.7);
        writeInst(buf, n++, x, y + h * 0.18, w, h * 0.26, 0.08, 0.18, 0.30, 0.75);
        // 緑青のパッチ (苔・藻)
        writeInst(buf, n++, x - w * 0.28, y + h * 0.10, w * 0.32, h * 0.22, 0.14, 0.34, 0.38, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.22, y - h * 0.18, w * 0.28, h * 0.18, 0.18, 0.38, 0.44, 0.55, 0, 1);
        // 波紋 (横に伸びる細いハイライト 5 本)
        for (let i = 0; i < 5; i++) {
          const ry = y + (hash(i * 11) - 0.5) * h * 0.85;
          const rx = x + (hash(i * 11 + 3) - 0.5) * w * 0.4;
          writeInst(buf, n++, rx, ry, w * (0.22 + hash(i * 11 + 5) * 0.25), 0.6, 0.58, 0.76, 0.88, 0.72);
        }
        // 細かい白波 (7 個)
        for (let i = 0; i < 7; i++) {
          const bx = x + (hash(i * 7) - 0.5) * w * 0.9;
          const by = y + (hash(i * 7 + 1) - 0.5) * h * 0.88;
          writeInst(buf, n++, bx, by, 1.8 + hash(i * 7 + 2) * 1.4, 0.5, 0.85, 0.92, 0.98, 0.85);
        }
        break;
      }
      case 'rust_deck': {
        // 錆びた金属デッキ: 茶褐色ベース + 縦板目 + 錆の斑
        writeInst(buf, n++, x, y, w, h, 0.42, 0.26, 0.16, 1);
        // 4 枚の縦板 (明暗)
        const plankCount = 4;
        const plankW = w / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const px = x - w / 2 + (i + 0.5) * plankW;
          const shade = i % 2 === 0 ? 1.0 : 0.85;
          writeInst(buf, n++, px, y, plankW * 0.92, h * 0.94,
            0.48 * shade, 0.30 * shade, 0.18 * shade, 1);
          // 板目 (縦 1 本)
          writeInst(buf, n++, px - plankW * 0.15, y, 0.3, h * 0.9,
            0.30 * shade, 0.18 * shade, 0.08 * shade, 0.6);
          // 端のリベット
          writeInst(buf, n++, px, y - h * 0.40, 0.9, 0.9, 0.20, 0.14, 0.08, 1, 0, 1);
          writeInst(buf, n++, px, y + h * 0.40, 0.9, 0.9, 0.20, 0.14, 0.08, 1, 0, 1);
        }
        // 錆斑 (6 つ、橙赤の不規則な大きさ)
        for (let i = 0; i < 6; i++) {
          const rx = x + (hash(i * 3) - 0.5) * w * 0.82;
          const ry = y + (hash(i * 3 + 1) - 0.5) * h * 0.82;
          const sz = 2.2 + hash(i * 3 + 2) * 2.6;
          writeInst(buf, n++, rx, ry, sz, sz * 0.7, 0.60, 0.32, 0.14, 0.78, 0, 1);
        }
        // 濃い油シミ 1 つ
        writeInst(buf, n++, x - w * 0.22, y + h * 0.12, w * 0.18, h * 0.12, 0.18, 0.12, 0.08, 0.7, 0, 1);
        break;
      }
      case 'hazard_stripe': {
        // 警告ストライプ: 黄ベース + 黒の斜めストライプ
        writeInst(buf, n++, x, y, w, h, 0.92, 0.78, 0.12, 1);
        // 斜めストライプを 6 本、角度 0.6rad (~34°)
        const stripeAngle = 0.6;
        const stripeW = Math.max(w, h) * 1.6;
        const stripeH = 3.2;
        const step = 6.5;
        const count = Math.ceil(Math.max(w, h) / step) + 2;
        for (let i = -count; i <= count; i++) {
          const ox = (i * step);
          writeInst(buf, n++, x + ox * Math.cos(stripeAngle), y + ox * Math.sin(stripeAngle),
            stripeW, stripeH, 0.14, 0.12, 0.10, 0.95, stripeAngle);
        }
        // 上辺の濃いライン (枠)
        writeInst(buf, n++, x, y - h * 0.45, w * 0.98, 0.7, 0.14, 0.12, 0.10, 0.9);
        writeInst(buf, n++, x, y + h * 0.45, w * 0.98, 0.7, 0.14, 0.12, 0.10, 0.9);
        // 摩耗 (明るい擦れ 2 つ)
        writeInst(buf, n++, x - w * 0.12, y, w * 0.2, 1.0, 0.98, 0.88, 0.40, 0.55);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.08, w * 0.15, 1.0, 0.98, 0.88, 0.40, 0.55);
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

    // 坂とフリッパー柱は fillSlopes / fillFlippers で第 2 パスに描画する
    // (道路・建物に覆われないよう最前面に出す)
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

  /** チャンク由来の背景・道路を描画 (grid-based, ステージ別パレット) */
  private fillChunkRoads(buf: Float32Array, start: number): number {
    let n = start;
    const W = 360;
    const [plR, plG, plB] = C.PLANTING_COLOR;
    const [pvR, pvG, pvB, pvA] = C.PAVING_COLOR;
    const [mhR, mhG, mhB] = C.MANHOLE_COLOR;

    const zoneBg: [number,number,number][] = [
      [C.ZONE_RESIDENTIAL[0], C.ZONE_RESIDENTIAL[1], C.ZONE_RESIDENTIAL[2]],
      [C.ZONE_COMMERCIAL[0],  C.ZONE_COMMERCIAL[1],  C.ZONE_COMMERCIAL[2]],
      [C.ZONE_OFFICE_BG[0],   C.ZONE_OFFICE_BG[1],   C.ZONE_OFFICE_BG[2]],
    ];

    for (const chunk of this.loadedChunks.values()) {
      const { baseY, chunkId, stageIndex } = chunk;
      const pal = C.getStagePalette(stageIndex);
      const [rr, rg, rb] = pal.road;
      const [sw_r, sw_g, sw_b] = pal.sidewalk;
      const [cbR, cbG, cbB] = pal.curb;
      const [lr2, lg2, lb2] = pal.line;
      const [bgR, bgG, bgB] = zoneBg[chunkId % 3];

      // チャンク背景
      writeInst(buf, n++, 0, baseY + C.CHUNK_HEIGHT / 2, W, C.CHUNK_HEIGHT, bgR, bgG, bgB, 1);
      // セル地面 (背景の上、道路の下)
      for (const tile of chunk.grounds) {
        n += this.drawGroundTile(buf, n, tile);
      }

      // 水平道路
      for (const r of chunk.horizontalRoads) {
        const { cy, h, xMin, xMax, cls } = r;
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
            writeInst(buf, n++, x + 5, cy, 8, 1.2, lr2, lg2, lb2, 0.7);
          }
        }
        for (let x = Math.ceil(xMin/55)*55; x <= xMax - 10; x += 55) {
          writeInst(buf, n++, x, cy, 4, 4, mhR, mhG, mhB, 1, 0, 1);
        }
        if (xMin > C.WORLD_MIN_X + 1) {
          writeInst(buf, n++, xMin + 1, cy, 2, h, cbR, cbG, cbB, 1);
        }
        if (xMax < C.WORLD_MAX_X - 1) {
          writeInst(buf, n++, xMax - 1, cy, 2, h, cbR, cbG, cbB, 1);
        }
      }

      // 垂直道路
      for (const r of chunk.verticalRoads) {
        const { cx, w, yMin, yMax, cls } = r;
        const segH = yMax - yMin;
        const segCY = (yMin + yMax) / 2;
        const swW = cls === 'avenue' ? 6 : 4;
        writeInst(buf, n++, cx - w/2 - swW/2, segCY, swW, segH, sw_r, sw_g, sw_b, 1);
        writeInst(buf, n++, cx + w/2 + swW/2, segCY, swW, segH, sw_r, sw_g, sw_b, 1);
        writeInst(buf, n++, cx - w/2 - 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
        writeInst(buf, n++, cx + w/2 + 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
        writeInst(buf, n++, cx, segCY, w, segH, rr, rg, rb, 1);
        for (let y = Math.ceil(yMin/14)*14; y <= yMax - 10; y += 14) {
          writeInst(buf, n++, cx, y + 5, 1.2, 8, lr2, lg2, lb2, 0.7);
        }
        for (let y = Math.ceil(yMin/55)*55; y <= yMax - 10; y += 55) {
          writeInst(buf, n++, cx, y, 4, 4, mhR, mhG, mhB, 1, 0, 1);
        }
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
    const [slR, slG, slB, slA] = C.STOPLINE_COLOR;

    const drawOne = (
      ix: Intersection,
      ixCol: readonly [number, number, number, number],
      cwCol: readonly [number, number, number, number],
    ) => {
      const { x, y, hThickness, vThickness } = ix;
      const [ixR, ixG, ixB] = ixCol;
      const [cwR, cwG, cwB, cwA] = cwCol;
      writeInst(buf, n++, x, y, vThickness + 4, hThickness + 2, ixR, ixG, ixB, 1);
      const cwLenV = vThickness;
      for (let i = 0; i < 3; i++) {
        const yOff = hThickness/2 - 2 - i * 2;
        writeInst(buf, n++, x, y + yOff, cwLenV, 1.5, cwR, cwG, cwB, cwA);
        writeInst(buf, n++, x, y - yOff, cwLenV, 1.5, cwR, cwG, cwB, cwA);
      }
      const cwLenH = hThickness;
      for (let i = 0; i < 3; i++) {
        const xOff = vThickness/2 - 2 - i * 2;
        writeInst(buf, n++, x + xOff, y, 1.5, cwLenH, cwR, cwG, cwB, cwA);
        writeInst(buf, n++, x - xOff, y, 1.5, cwLenH, cwR, cwG, cwB, cwA);
      }
      const slOffsetX = vThickness / 2 + 1;
      const slOffsetY = hThickness / 2 + 1;
      writeInst(buf, n++, x - slOffsetX, y, 2, hThickness - 2, slR, slG, slB, slA);
      writeInst(buf, n++, x + slOffsetX, y, 2, hThickness - 2, slR, slG, slB, slA);
      writeInst(buf, n++, x, y - slOffsetY, vThickness - 2, 2, slR, slG, slB, slA);
      writeInst(buf, n++, x, y + slOffsetY, vThickness - 2, 2, slR, slG, slB, slA);
    };

    // 初期都市の交差点 (デフォルト Stage 1 パレット)
    const initialRoadData = getInitialCityRoadData();
    const defaultPal = C.getStagePalette(0);
    for (const ix of initialRoadData.intersections) {
      drawOne(ix, defaultPal.intersection, defaultPal.crosswalk);
    }
    // チャンクの交差点 (ステージ別パレット)
    for (const chunk of this.loadedChunks.values()) {
      const pal = C.getStagePalette(chunk.stageIndex);
      for (const ix of chunk.intersections) {
        drawOne(ix, pal.intersection, pal.crosswalk);
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

  /** 坂 (左右) を最前面レイヤで描画。建物・道路に覆われないよう第 2 パスで呼ぶ */
  private fillSlopes(buf: Float32Array, start: number): number {
    let n = start;
    const sL = this.getSlopeL(), sR = this.getSlopeR();
    // 本体 (緑)
    writeInst(buf, n++, sL.cx, sL.cy, sL.hw * 2, sL.hh * 2, 0.38, 0.58, 0.30, 1, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy, sR.hw * 2, sR.hh * 2, 0.38, 0.58, 0.30, 1, sR.angle);
    // 上辺ハイライト (ボールが滑る面を示す、白ライン)
    writeInst(buf, n++, sL.cx, sL.cy + sL.hh - 0.5, sL.hw * 2, 1.2, 0.92, 0.92, 0.88, 0.85, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy + sR.hh - 0.5, sR.hw * 2, 1.2, 0.92, 0.92, 0.88, 0.85, sR.angle);
    // 下辺の影 (立体感、暗)
    writeInst(buf, n++, sL.cx, sL.cy - sL.hh + 0.5, sL.hw * 2, 1.0, 0.22, 0.34, 0.18, 0.85, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy - sR.hh + 0.5, sR.hw * 2, 1.0, 0.22, 0.34, 0.18, 0.85, sR.angle);
    return n - start;
  }

  private fillFlippers(buf: Float32Array, start: number): number {
    let n = start;
    const N = 10;             // 三角形近似の分割数
    const BASE_THICK = 12;    // 根本の太さ
    const TIP_THICK  = 1.5;   // 先端の太さ (ほぼ点)
    for (const fl of this.flippers) {
      const isFlash = this.juice.isBallFlashing();
      const gr = isFlash ? 1 : 0.60, gg = isFlash ? 1 : 0.60, gb = isFlash ? 1 : 0.70;
      const hw = C.FLIPPER_W / 2;
      const cosA = Math.cos(fl.angle), sinA = Math.sin(fl.angle);
      const segLen = C.FLIPPER_W / N;
      // 各セグメントを線形テーパー + 上面 (ball-facing 面) は直線のまま保つ。
      // 上面が直線 = 各セグメントの top edge が同一の local Y にある
      // → セグメント中心を local Y 方向に (BASE_THICK - segH) / 2 だけオフセット。
      // 左フリッパーの local +Y 方向が world 上向き、右は逆なので isLeft で符号を反転。
      const yDir = fl.isLeft ? 1 : -1;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;
        const segH = BASE_THICK * (1 - t) + TIP_THICK * t;
        const localX = -hw + (i + 0.5) * segLen;
        const localY = ((BASE_THICK - segH) / 2) * yDir;
        // local (x, y) を fl.angle で回転して world 位置に
        const segCx = fl.cx + localX * cosA - localY * sinA;
        const segCy = fl.cy + localX * sinA + localY * cosA;
        writeInst(buf, n++, segCx, segCy, segLen * 1.04, segH, gr, gg, gb, 1, fl.angle);
      }
      // 先端の小さな半円突起 (物理側と同位置・静止固定)
      const restRadV = (fl.isLeft ? C.FLIPPER_REST_DEG : (180 - C.FLIPPER_REST_DEG)) * Math.PI / 180;
      const rCosV = Math.cos(restRadV), rSinV = Math.sin(restRadV);
      const bumpLocalY_v = 5 * yDir;                 // さらに 1 px 下げる
      const bumpLocalX_v = C.FLIPPER_W + 1;          // 突起の内側端が最先端
      const bumpVX = fl.pivotX + bumpLocalX_v * rCosV - bumpLocalY_v * rSinV;
      const bumpVY = fl.pivotY + bumpLocalX_v * rSinV + bumpLocalY_v * rCosV;
      writeInst(buf, n++, bumpVX, bumpVY, 2, 2, gr * 0.9, gg * 0.9, gb * 1.05, 1, 0, 1);
      // ピボットの目印 (オレンジの小丸)
      writeInst(buf, n++, fl.pivotX, fl.pivotY, 6, 6, 0.90, 0.55, 0.20, 1, 0, 1);
    }
    return n - start;
  }

  /** シンプルなボール描画。
   * - 本体: 単色の円 (スクロール速度で orange → red → blue に変化)
   * - トレイル: 残像の円
   * - 回転マーカー: 対称の暗ドット 2 点 (ball.angle で回転)
   * - ハイライト: 左上の白い小円 (立体感)
   * 当たり判定は半径 BALL_RADIUS の円。
   */
  private fillBall(buf: Float32Array, start: number): number {
    const b = this.ball;
    if (!b.active) return 0;
    let n = start;
    const isFl = this.juice.isBallFlashing();
    const radius = C.BALL_RADIUS;

    // ボール色: 固定のオレンジ
    const cr = 1.0, cg = 0.55, cb = 0.05;

    // トレイル
    for (let ti = 0; ti < C.TRAIL_LEN; ti++) {
      const age = ti / C.TRAIL_LEN;
      const idx = (b.trailHead - 1 - ti + C.TRAIL_LEN) % C.TRAIL_LEN;
      const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.45;
      const sz = radius * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, cr, cg * (1 - age * 0.5), cb, alpha, 0, 1);
    }

    // 本体
    const r = isFl ? 1 : cr, g = isFl ? 1 : cg, bv = isFl ? 1 : cb;
    writeInst(buf, n++, b.x, b.y, radius * 2, radius * 2, r, g, bv, 1, 0, 1);

    // 回転マーカー: 対称の暗ドット 2 点 (ball.angle で回転し、転がりを視覚化)
    const markerR = radius * 0.55;
    const mx1 = b.x + Math.cos(b.angle) * markerR;
    const my1 = b.y + Math.sin(b.angle) * markerR;
    const mx2 = b.x - Math.cos(b.angle) * markerR;
    const my2 = b.y - Math.sin(b.angle) * markerR;
    const mR = r * 0.35, mG = g * 0.35, mB = bv * 0.35;
    writeInst(buf, n++, mx1, my1, radius * 0.45, radius * 0.45, mR, mG, mB, 0.85, 0, 1);
    writeInst(buf, n++, mx2, my2, radius * 0.45, radius * 0.45, mR, mG, mB, 0.85, 0, 1);

    // ハイライト (固定、左上寄りの白い小円で立体感)
    writeInst(buf, n++, b.x - radius * 0.35, b.y + radius * 0.35,
      radius * 0.5, radius * 0.5,
      Math.min(1, r + 0.35), Math.min(1, g + 0.35), Math.min(1, bv + 0.35),
      0.7, 0, 1);

    return n - start;
  }
}
