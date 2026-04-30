/**
 * game.ts 窶・繝｡繧､繝ｳ繧ｲ繝ｼ繝繝ｫ繝ｼ繝・+ 繧ｦ繧ｧ繝ｼ繝悶す繧ｹ繝・Β
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

// 60000 instance 蛻・・蜈ｱ譛峨ヰ繝・ヵ繧｡ (renderer.ts 縺ｮ MAX_INST 縺ｨ荳閾ｴ縺輔○繧・
// 1000+ 莠ｺ髢灘酔譎よ緒逕ｻ繧呈Φ螳・ 1500ﾃ・5 instance + particles + scene
const SHARED_BUF = new Float32Array(60000 * INST_F);

type GameState = 'playing' | 'ball_lost' | 'stage_clear' | 'game_over' | 'clear';

// 蟒ｺ迚ｩ縺ｮ邏譚舌・繝ｭ繝輔ぃ繧､繝ｫ 窶・onBuildingDestroyed 縺ｧ蝓ｺ譛ｬ繝代・繝・ぅ繧ｯ繝ｫ繧貞・繧頑崛縺医ｋ縺溘ａ
type BuildingMaterial =
  | 'wood' | 'wood_traditional'
  | 'concrete_small' | 'concrete_medium' | 'glass_tower'
  | 'metal_industrial' | 'landmark' | 'explosive' | 'castle';

const BUILDING_MATERIAL: Partial<Record<C.BuildingSize, BuildingMaterial>> = {
  // 譛ｨ騾邉ｻ
  house: 'wood', townhouse: 'wood', garage: 'wood', shed: 'wood',
  bungalow: 'wood', duplex: 'wood', mansion: 'wood',
  yatai: 'wood', greenhouse: 'wood', florist: 'wood',
  bakery: 'wood', cafe: 'wood', ramen: 'wood', izakaya: 'wood',
  snack: 'wood', kura: 'wood', wagashi: 'wood', sushi_ya: 'wood',

  // 譛ｨ騾莨晉ｵｱ蟒ｺ遽・
  shrine: 'wood_traditional', temple: 'wood_traditional', pagoda: 'wood_traditional',
  tahoto: 'wood_traditional', ryokan: 'wood_traditional', onsen_inn: 'wood_traditional',
  kominka: 'wood_traditional', machiya: 'wood_traditional', chaya: 'wood_traditional',
  dojo: 'wood_traditional', kimono_shop: 'wood_traditional',

  // 蟆丞梛繧ｳ繝ｳ繧ｯ繝ｪ繝ｻ蠎苓・
  shop: 'concrete_small', convenience: 'concrete_small', restaurant: 'concrete_small',
  bookstore: 'concrete_small', pharmacy: 'concrete_small', laundromat: 'concrete_small',
  daycare: 'concrete_small', clinic: 'concrete_small', post_office: 'concrete_small',
  mahjong_parlor: 'concrete_small', shotengai_arcade: 'concrete_small',
  bus_terminal_shelter: 'concrete_small', fountain_pavilion: 'concrete_small',

  // 荳ｭ蝙九さ繝ｳ繧ｯ繝ｪ繝ｻ蜈ｬ蜈ｱ
  apartment: 'concrete_medium', parking: 'concrete_medium', supermarket: 'concrete_medium',
  karaoke: 'concrete_medium', pachinko: 'concrete_medium', game_center: 'concrete_medium',
  bank: 'concrete_medium', library: 'concrete_medium', museum: 'concrete_medium',
  fire_station: 'concrete_medium', police_station: 'concrete_medium',
  movie_theater: 'concrete_medium', school: 'concrete_medium', hospital: 'concrete_medium',
  love_hotel: 'concrete_medium', club: 'concrete_medium', capsule_hotel: 'concrete_medium',

  // 繧ｬ繝ｩ繧ｹ蠑ｵ繧企ｫ伜ｱ､
  office: 'glass_tower', tower: 'glass_tower', skyscraper: 'glass_tower',
  apartment_tall: 'glass_tower', city_hall: 'glass_tower',
  business_hotel: 'glass_tower', department_store: 'glass_tower',
  train_station: 'glass_tower',

  // 蟾･讌ｭ繝ｻ貂ｯ貉ｾ
  warehouse: 'metal_industrial', crane_gantry: 'metal_industrial',
  container_stack: 'metal_industrial', factory_stack: 'metal_industrial',
  silo: 'metal_industrial', water_tower: 'metal_industrial',

  // 繝ｩ繝ｳ繝峨・繝ｼ繧ｯ繝ｻ螽ｯ讌ｽ蟾ｨ螟ｧ譁ｽ險ｭ
  clock_tower: 'landmark', radio_tower: 'landmark', ferris_wheel: 'landmark',
  stadium: 'landmark', carousel: 'landmark', roller_coaster: 'landmark',
  big_tent: 'landmark',

  // 辷・匱邉ｻ
  gas_station: 'explosive',

  // 譛邨ゅ・繧ｹ
  castle: 'castle',
};

const SMALL_PIERCE_BUILDINGS = new Set<C.BuildingSize>([
  'house', 'townhouse', 'garage', 'shed', 'greenhouse', 'bungalow', 'duplex',
  'shop', 'convenience', 'restaurant', 'cafe', 'bakery', 'bookstore', 'pharmacy',
  'laundromat', 'florist', 'ramen', 'izakaya', 'snack', 'yatai', 'kominka',
  'chaya', 'kura', 'dojo', 'wagashi', 'kimono_shop', 'sushi_ya',
]);

const MEDIUM_PIERCE_BUILDINGS = new Set<C.BuildingSize>([
  'apartment', 'parking', 'supermarket', 'karaoke', 'pachinko', 'game_center',
  'bank', 'library', 'museum', 'fire_station', 'police_station', 'movie_theater',
  'love_hotel', 'club', 'capsule_hotel', 'warehouse', 'container_stack', 'ryokan',
  'machiya', 'onsen_inn', 'shotengai_arcade', 'bus_terminal_shelter',
]);

const FUEL_BUILDING_BONUS: Partial<Record<C.BuildingSize, number>> = {
  school: C.FUEL_GAIN_SCHOOL,
  train_station: C.FUEL_GAIN_TRAIN_STATION,
  stadium: C.FUEL_GAIN_STADIUM,
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
  /** 譌ｧ蟆主・貍泌・逕ｨ繝輔Λ繧ｰ縲ゅせ繝・・繧ｸ蛻ｶ縺ｧ縺ｯ髢句ｧ狗峩蠕後°繧峨せ繧ｯ繝ｭ繝ｼ繝ｫ縺吶ｋ縺溘ａ譌｢螳壹・ false縲・*/
  private introActive = false;

  // 辯・侭 (莠ｺ髢薙ｒ雕上・縺ｨ蠅励∴縲∝燕騾ｲ霍晞屬縺ｫ蠢懊§縺ｦ貂帙ｋ縲・ 縺ｯ蛛懈ｭ｢縺ｧ縺ゅ▲縺ｦ繧ｲ繝ｼ繝繧ｪ繝ｼ繝舌・縺ｧ縺ｯ縺ｪ縺・
  private fuel = C.FUEL_INITIAL;

  // 迴ｾ蝨ｨ縺ｮ繧ｹ繝・・繧ｸ (HUD 陦ｨ遉ｺ繝ｻCLEAR 讀懷・逕ｨ)
  private currentStageIndex = 0;
  private pendingStageIndex = 0;
  private clearTriggered = false;

  // 繧ｹ繧ｳ繧｢ (遐ｴ螢雁ｯｾ雎｡縺九ｉ邏ｯ遨・
  private totalScore = 0;
  // 繝上う繧ｹ繧ｳ繧｢ (縺薙ｌ縺ｾ縺ｧ縺ｮ繝吶せ繝・totalScore)
  private bestScore = 0;

  // 繝昴・繧ｺ迥ｶ諷・(update 繧偵せ繧ｭ繝・・縲、udioContext 繧・suspend)
  private paused = false;

  // 繧ｿ繧､繝医Ν逕ｻ髱｢陦ｨ遉ｺ荳ｭ縲る壼ｸｸ繝励Ξ繧､縺ｧ縺ｯ菴ｿ繧上★縲√せ繧ｯ繝ｪ繝ｼ繝ｳ繧ｷ繝ｧ繝・ヨ繝｢繝ｼ繝峨□縺大●豁｢逕ｨ縺ｫ菴ｿ縺・・  private titleActive = true;
  private titleActive = true;

  // 繝懊・繝ｫ蛛懈ｻ樊､懷・ (auto-nudge 逕ｨ)
  private stuckSeconds = 0;
  private pierceChain = 0;

  // 繝√Ε繝ｳ繧ｯ邂｡逅・
  private loadedChunks: Map<number, ChunkData> = new Map();
  private nextChunkId = 0;
  // v6.3 SemanticCluster ambient emit 縺ｮ繝ｬ繝ｼ繝亥宛蠕｡繧｢繧ｭ繝･繝繝ｬ繝ｼ繧ｿ
  private _ambientAccumulator = 0;
  // 蛻晄悄驛ｽ蟶ゅ・繧ｻ繝ｫ蝨ｰ髱｢繧ｿ繧､繝ｫ
  private initialCityGrounds: GroundTile[] = [];

  private bgTopR = 0.52; private bgTopG = 0.74; private bgTopB = 0.96;
  private bgBottomR = 0.38; private bgBottomG = 0.36; private bgBottomB = 0.33;

  // 蝮ゅ・繧ｫ繝｡繝ｩ逶ｸ蟇ｾ繧ｪ繝輔そ繝・ヨ (繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ蝗ｺ螳・
  // 笘・繝輔Μ繝・ヱ繝ｼ rest 隗貞ｺｦ (-30ﾂｰ) 繧医ｊ 8ﾂｰ 諤･縺ｪ -38ﾂｰ 縺ｫ險ｭ螳壹・
  //   螳悟・蟷ｳ陦後□縺ｨ蝮や・繝輔Μ繝・ヱ繝ｼ竊偵ラ繝ｬ繧､繝ｳ繧剃ｸ逶ｴ邱壹↓霆｢縺後▲縺ｦ蜊ｳ關ｽ縺｡縺励※縺励∪縺・◆繧√・
  //   隗貞ｺｦ蟾ｮ縺ｧ縲後く繝｣繝・メ縲阪ｒ菴懊ｊ縲√・繝ｼ繝ｫ縺梧磁轤ｹ縺ｧ蠕ｮ繝舌え繝ｳ繝峨＠縺ｦ貊樒ｩｺ譎る俣繧堤函繧縲・
  //   諤･縺吶℃縺ｪ縺・・縺ｧ荳翫°繧芽誠縺｡縺ｦ縺阪◆譎ゅ・蜉騾溘ｂ遨上ｄ縺九・
  // 笘・hw=55.4, 蜿ｳ荳狗ｫｯ=(-85, camera.y-210) 縺ｧ繝輔Μ繝・ヱ繝ｼ繝斐・繝・ヨ逶ｴ邨舌∝ｷｦ荳顔ｫｯ=(-180, camera.y-153)
  private readonly SLOPE_L_BASE = { cx: -132.5, cy_off: -181.5, hw: 55.4, hh: 6, angle: -0.541 }; // -31ﾂｰ
  private readonly SLOPE_R_BASE = { cx:  132.5, cy_off: -181.5, hw: 55.4, hh: 6, angle:  0.541 };

  private getSlopeL() {
    const b = this.SLOPE_L_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }
  private getSlopeR() {
    const b = this.SLOPE_R_BASE;
    return { cx: b.cx, cy: this.camera.y + b.cy_off, hw: b.hw, hh: b.hh, angle: b.angle };
  }

  constructor(canvas: HTMLCanvasElement, opts?: { screenshotMode?: boolean; screenshotChunkId?: number | null }) {
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

    // 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ繧ｷ繝ｧ繝・ヨ繝｢繝ｼ繝・ UI 繝上Φ繝峨Λ繧定ｲｼ繧峨★縲・
    // 繧ｿ繧､繝医Ν逕ｻ髱｢繧り｡ｨ遉ｺ縺励↑縺・ＵitleActive=true 縺ｮ縺ｾ縺ｾ菫昴▲縺ｦ update 繧呈ｭ｢繧√・
    // render 縺縺大屓縺励※ stage 1 縺ｮ逶､髱｢ (莠ｺ髢薙・霆贋ｸ｡繝ｻ蟒ｺ迚ｩ) 繧帝撕豁｢逕ｻ縺ｨ縺励※陦ｨ遉ｺ縲・
    // 迚ｩ逅・●豁｢縺ｪ縺ｮ縺ｧ蟒ｺ迚ｩ/莠ｺ髢・霆翫ｒ螟ｧ驥剰ｿｽ蜉縺励※繧ゅご繝ｼ繝縺ｫ蠖ｱ髻ｿ縺ｪ縺・竊・鬮伜ｯ・ｺｦ蛹悶☆繧・
    if (opts?.screenshotMode) {
      this.initRun();
      this.loadCity();
      // ?chunk=N 縺梧欠螳壹＆繧後◆繧・ addScreenshotDensity 繧呈椛豁｢縺励…hunk N 縺ｮ逵溘・荳ｭ霄ｫ繧定｡ｨ遉ｺ
      // (Stage 1 竊・Stage 2-5 縺ｮ豈碑ｼ・畑)
      const debugChunkId = opts.screenshotChunkId;
      if (typeof debugChunkId === 'number') {
        // chunkId N 繧貞ｼｷ蛻ｶ spawn (chunk 荳也阜 Y = WORLD_MAX_Y + (N+1)*CHUNK_HEIGHT 縺ｧ荳顔ｫｯ)
        // 繝√Ε繝ｳ繧ｯ荳ｭ螟ｮ繧堤判髱｢荳ｭ螟ｮ (camera.y) 縺ｫ謖√▲縺ｦ縺上ｋ
        const chunkBottom = C.WORLD_MAX_Y + debugChunkId * C.CHUNK_HEIGHT;
        const chunkCenter = chunkBottom + C.CHUNK_HEIGHT / 2;
        this.nextChunkId = Math.max(0, debugChunkId - 1);
        this._spawnChunk(debugChunkId);
        if (debugChunkId > 0) this._spawnChunk(debugChunkId - 1);
        this._spawnChunk(debugChunkId + 1);
        this.camera.y = chunkCenter;
        this.camera.lockY = chunkCenter;
      } else {
        this.addScreenshotDensity();            // stage 1 縺ｮ陦嶺ｸｦ縺ｿ縺ｫ霑ｽ蜉繝薙Ν繝ｻ莠ｺ繝ｻ霆翫ｒ隧ｰ繧∬ｾｼ縺ｿ
      }
      this.ball.active = false;                 // 繝懊・繝ｫ髱櫁｡ｨ遉ｺ
      this.sound.setMuted(true);                // 蠢ｵ縺ｮ縺溘ａ辟｡髻ｳ
      // titleActive 縺ｯ譌｢螳壹〒 true縲Ｖpdate() 縺ｯ蜀帝ｭ縺ｧ early return 縺吶ｋ縺ｮ縺ｧ迚ｩ逅・●豁｢
      this.startLoop();
      return;
    }

    this.input.registerRestartTap(document.getElementById('gameover')!);
    this.input.registerRestartTap(document.getElementById('clear')!);
    this.input.onRestart(() => this.restart());

    this.setupMuteButton();
    this.setupPauseButton();
    this.setupStageClearContinue();
    this.setupVisibilityHandler();

    this.initRun();
    this.loadCity();
    this.setupTitleScreen();
    // CrazyGames gameplayStart 縺ｯ繧ｿ繧､繝医Ν逕ｻ髱｢隗｣髯､譎ゅ↓蜻ｼ縺ｶ (螳溘・繝ｬ繧､髢句ｧ九ち繧､繝溘Φ繧ｰ)
    this.startLoop();
  }

  /** 繧ｿ繧､繝医Ν逕ｻ髱｢: 蛻晏屓襍ｷ蜍墓凾縺ｫ荳蠎ｦ縺縺題｡ｨ遉ｺ縲ゅけ繝ｪ繝・け/繧ｭ繝ｼ縺ｧ隗｣髯､縺励※繧ｲ繝ｼ繝髢句ｧ・*/
  private setupTitleScreen(): void {
    const title = document.getElementById('title');
    const best  = document.getElementById('title-best');
    if (!title) {
      this.titleActive = false;
      gameplayStart();
      return;
    }
    // 繝吶せ繝郁ｨ倬鹸陦ｨ遉ｺ (0 縺ｪ繧蛾國縺・
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

  /** 繝溘Η繝ｼ繝医・繧ｿ繝ｳ: 繧ｯ繝ｪ繝・け縺ｧ master gain 繧偵ヨ繧ｰ繝ｫ縲〕ocalStorage 縺ｫ豌ｸ邯壼喧 */
  private setupMuteButton(): void {
    const btn = document.getElementById('mute-btn');
    if (!btn) return;
    // 蛻晄悄迥ｶ諷九ｒ localStorage 縺九ｉ蠕ｩ蜈・
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
    // 笙ｪ (U+266A) / 這 縺ｧ縺ｯ縺ｪ縺・X 陦ｨ迴ｾ (Press Start 2P 髱槫ｯｾ蠢懷ｭ励ｒ驕ｿ縺代ｋ)
    btn.textContent = muted ? 'X' : '\u266A';
  }

  /** 繝昴・繧ｺ繝懊ち繝ｳ: 繝励Ξ繧､荳ｭ縺ｮ縺ｿ繝昴・繧ｺ蜿ｯ (game_over/clear 荳ｭ縺ｯ辟｡蜉ｹ)
   *  繧ｪ繝ｼ繝舌・繝ｬ繧､繧ｯ繝ｪ繝・け縺ｧ繧ょ・髢九〒縺阪ｋ繧医≧縲｝ause overlay 繧ゅヨ繧ｰ繝ｫ蟇ｾ雎｡縺ｫ */
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
      // 蠕ｩ蟶ｰ譎ゅ・ dt 辷・匱繧帝亟縺・
      this.lastTime = performance.now();
      gameplayStart();
    }
  }

  /** 繧ｿ繝夜撼繧｢繧ｯ繝・ぅ繝匁凾: AudioContext 繧・suspend 縺励√ご繝ｼ繝繝ｫ繝ｼ繝励ｒ螳溯ｳｪ蛛懈ｭ｢
   *  蠕ｩ蟶ｰ譎・ 蜈・・迥ｶ諷九°繧牙・髢・(譛蛻昴・ dt 繧ｯ繝ｩ繝ｳ繝励〒蟾ｨ螟ｧ繝・Ν繧ｿ繧帝亟縺・ */
  private setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sound.suspend();
      } else if (!this.paused) {
        // 謇句虚繝昴・繧ｺ荳ｭ縺ｯ蠕ｩ蟶ｰ譎ゅｂ AudioContext 繧・sustain (荳崎ｦ√↑蜀咲函繧帝∩縺代ｋ)
        this.sound.resume();
        this.lastTime = performance.now();
      }
    });
  }

  private setupStageClearContinue(): void {
    const el = document.getElementById('stage-clear');
    const advance = () => this.continueToNextStage();
    el?.addEventListener('click', advance);
    el?.addEventListener('touchstart', (e) => { e.preventDefault(); advance(); }, { passive: false });
    document.addEventListener('keydown', (e) => {
      if (this.state !== 'stage_clear') return;
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      advance();
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
    this.pendingStageIndex = 0;
    this.clearTriggered   = false;
    this.introActive      = false;
    this.pierceChain      = 0;
    this.bestScore        = loadBestScore();
    this.ui.setDistance(0);
    this.ui.setZone(0, STAGES[0].nameEn);
    this.ui.setFuel(C.FUEL_INITIAL);
    this.ui.setScore(0);
    this.ui.setBest(this.bestScore);
    this.ui.hideStageClear();
  }

  /**
   * 繧ｹ繧ｯ繝ｪ繝ｼ繝ｳ繧ｷ繝ｧ繝・ヨ繝｢繝ｼ繝牙ｰら畑: stage 1 縺ｮ蟒ｺ迚ｩ繧堤ｴ譽・＠縺ｦ縲・
   * 陲ｫ繧翫ｂ遨ｺ逋ｽ繧ゅ↑縺・插荳蟇・ｺｦ縺ｮ繧ｿ繧､繝ｫ迥ｶ繧ｰ繝ｪ繝・ラ縺ｫ蟾ｮ縺玲崛縺医ｋ縲・
   * 迚ｩ逅・●豁｢繝ｻ繝懊・繝ｫ辟｡縺励↑縺ｮ縺ｧ繧ｲ繝ｼ繝繝励Ξ繧､縺ｫ縺ｯ蠖ｱ髻ｿ縺励↑縺・・
   */
  private addScreenshotDensity(): void {
    // 豎ｺ螳夊ｫ也噪謫ｬ莨ｼ荵ｱ謨ｰ (蜷後§繧ｷ繝ｼ繝峨〒蜷後§驟咲ｽｮ)
    let seed = 20241124;
    const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed & 0x7fffffff) / 0x7fffffff; };

    // 謖・ｮ夂ｯ・峇縺ｮ鬮倥＆縺ｫ蜿弱∪繧・BuildingSize 縺縺代ｒ髮・ａ繧九・繝ｫ繝・
    const byH = (minH: number, maxH: number): C.BuildingSize[] => {
      const arr: C.BuildingSize[] = [];
      for (const k of Object.keys(C.BUILDING_DEFS) as C.BuildingSize[]) {
        const h = C.BUILDING_DEFS[k].h;
        if (h >= minH && h <= maxH) arr.push(k);
      }
      return arr.length > 0 ? arr : (['house'] as C.BuildingSize[]);
    };

    // 蜷・｡・ baseY = 陦後・荳狗ｫｯ縲《lotH = 谺｡縺ｮ陦後∪縺ｧ縺ｮ蝙ら峩繧ｹ繝ｭ繝・ヨ (baseY + slotH 縺ｾ縺ｧ
    //   縺昴・陦後・蟒ｺ迚ｩ縺悟庶縺ｾ繧・縲ＩMax = 縺昴・陦後〒險ｱ縺呎怙螟ｧ蟒ｺ迚ｩ鬮・(= slotH - 3px gap)縲・
    //   荳区ｮｵ縺ｻ縺ｩ蟆丞梛縲∽ｸ頑ｮｵ縺ｻ縺ｩ鬮伜ｱ､縲ら判髱｢蜈ｨ菴・y=[-290, 290] 繧・5陦後〒隕・≧縲・
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
      { baseY:  221, slotH: 75 }, // 逕ｻ髱｢荳顔ｫｯ縺ｾ縺ｧ (y<=290)
    ];

    const grid: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx: number }> = [];
    rowDefs.forEach((row, ri) => {
      const hMax = row.slotH - 3;
      const hMin = Math.max(8, hMax - 18);  // 蜷後§陦後・鬮倥＆縺瑚ｿ代＞蟒ｺ迚ｩ縺縺第ｷｷ縺懊ｋ
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

    // 譌｢蟄・stage 1 縺ｮ蟒ｺ迚ｩ繧貞ｻ・｣・＠縺ｦ繧ｰ繝ｪ繝・ラ縺ｧ鄂ｮ謠・(陲ｫ繧顔┌縺励∝插荳蟇・ｺｦ)
    this.buildings.load(grid);

    // 騾夊｡御ｺｺ縺ｯ繝ｪ繧ｻ繝・ヨ縺励※縲∝推陦後・髫咎俣 (驕楢ｷｯ逶ｸ蠖薙・蟶ｯ) 縺ｫ遲蛾俣髫秘・鄂ｮ
    this.humans.reset();
    this.humans.resetRoads();
    rowDefs.forEach(row => {
      const gapY = row.baseY + (row.slotH - 3) + 1; // 蟒ｺ迚ｩ鬆らせ縺ｮ縺吶＄荳・
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
    this.humans.spawnOnStreets(20);  // 3驕楢ｷｯ ﾃ・20菴・= 60菴薙・蛻晄悄騾夊｡御ｺｺ
    // 繧ｷ繝ｼ繝ｳ莠句燕驟咲ｽｮ縺ｮ humans (陦悟・繝ｻ隕ｳ螳｢繝ｻ騾夊｡御ｺｺ)
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
    // 繧ｿ繧､繝医Ν / 繝昴・繧ｺ荳ｭ縺ｯ update 繧貞ｮ悟・繧ｹ繧ｭ繝・・ (貍泌・蛛懈ｭ｢ + ball 蛛懈ｭ｢)
    if (this.titleActive || this.paused) return;
    this.juice.update(rawDt);

    // clear / stage_clear 荳ｭ縺ｯ貍泌・縺縺第峩譁ｰ縺励※繧ｲ繝ｼ繝騾ｲ陦後ｒ豁｢繧√ｋ
    if (this.state === 'clear' || this.state === 'stage_clear') {
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

    // Fuel is forward momentum, not HP: 0 fuel stops camera movement only.
    const fuelRatio = Math.max(0, Math.min(1, this.fuel / C.FUEL_MAX));
    this.camera.scrollSpeed = this.fuel > 0
      ? C.SCROLL_SPEED_MIN + (C.SCROLL_SPEED_MAX - C.SCROLL_SPEED_MIN) * fuelRatio
      : 0;

    // 繧ｫ繝｡繝ｩ譖ｴ譁ｰ (繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ) 窶・蛻晄悄貍泌・荳ｭ縺ｯ蛛懈ｭ｢
    const prevCameraY = this.camera.y;
    if (!this.introActive) this.camera.update(dt);
    const cameraDeltaY = this.camera.y - prevCameraY;

    this.flippers[0].setPressed(this.input.leftPressed);
    this.flippers[1].setPressed(this.input.rightPressed);
    // 繝輔Μ繝・ヱ繝ｼ繧偵き繝｡繝ｩ縺ｫ霑ｽ蠕薙＆縺帙ｋ
    for (const fl of this.flippers) {
      fl.pivotY = C.FLIPPER_PIVOT_Y + this.camera.y;
    }
    this.flippers[0].update(dt);
    this.flippers[1].update(dt);

    if (dt > 0) this.updateBall(dt, cameraDeltaY);

    // 繝懊・繝ｫ隧ｰ縺ｾ繧頑､懷・: 騾溷ｺｦ縺梧･ｵ蟆上・迥ｶ諷九′ 3s 邯壹＞縺溘ｉ閾ｪ蜍・nudge 縺ｧ謨大・
    // (MAX_BALL_SPEED = 22 縺ｮ蠎ｧ讓咏ｳｻ縲Ｔpeed < 3 縺ｯ縺ｻ縺ｼ蛛懈ｭ｢)
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

    // 霍晞屬陦ｨ遉ｺ繧呈峩譁ｰ
    this.ui.setDistance(this.camera.distanceMeters);

    // 谺｡繧ｹ繝・・繧ｸ縺ｮ繝√Ε繝ｳ繧ｯ縺ｸ蜈･縺｣縺溘ｉ縲？UD 蛻・崛縺ｮ蜑阪↓荳ｭ髢薙け繝ｪ繧｢縺ｧ荳譌ｦ豁｢繧√ｋ
    if (this.checkStageClear()) return;

    // 迴ｾ蝨ｨ繧ｹ繝・・繧ｸ繧定ｿｽ霍｡縺励※ HUD / 閭梧勹繧呈峩譁ｰ
    this.updateCurrentStage();

    // 繝昴ャ繝励い繝・・繝ｬ繧､繝､繝ｼ繧偵き繝｡繝ｩ霑ｽ蠕・(繧ｳ繝ｳ繝・リ1縺､縺縺第峩譁ｰ)
    this.ui.updatePopupLayer(this.camera.y);

    // Spend fuel by distance advanced. No movement means no fuel drain.
    if (!this.introActive && cameraDeltaY > 0) {
      this.fuel = Math.max(0, this.fuel - cameraDeltaY * (C.FUEL_DRAIN_PER_100PX / 100));
    }
    this.ui.setFuel(this.fuel);

    // 蛻晄悄貍泌・: 貅繧ｿ繝ｳ縺ｫ縺ｪ縺｣縺溘ｉ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ/繝峨Ξ繧､繝ｳ髢句ｧ・
    if (this.introActive && this.fuel >= C.FUEL_MAX) {
      this.introActive = false;
      this.juice.flash(1, 1, 0.4, 0.50);
      this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR);
    }

    // 笏笏 GOAL 繝√Ε繝ｳ繧ｯ蛻ｰ驕・竊・繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ繝ｭ繝・け (繝ｩ繧ｹ繝懊せ謌ｦ) 笏笏
    // 譛邨ゅメ繝｣繝ｳ繧ｯ縺後せ繝昴・繝ｳ縺輔ｌ縺溽椪髢薙↓繝ｭ繝・け繧剃ｺ育ｴ・ゅき繝｡繝ｩ縺ｯ閾ｪ辟ｶ縺ｫ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺・
    // 繝ｭ繝・け菴咲ｽｮ (goal chunk center) 縺ｫ驕斐＠縺滓凾轤ｹ縺ｧ蛛懈ｭ｢縺吶ｋ縲・
    // 窶ｻ 譛邨ゅメ繝｣繝ｳ繧ｯ縺・loadedChunks 縺ｫ蜈･縺｣縺溷ｾ後↓莠育ｴ・☆繧九％縺ｨ縺ｧ縲√せ繝昴・繝ｳ蜑阪・
    //   misfire 繧帝亟縺・(hasGoalCastle() 縺・false 繧定ｿ斐☆迸ｬ髢薙ｒ驕ｿ縺代ｋ)縲・
    if (this.camera.lockY === null && this.nextChunkId >= TOTAL_CHUNKS) {
      const goalBaseY = C.WORLD_MAX_Y + (TOTAL_CHUNKS - 1) * C.CHUNK_HEIGHT;
      this.camera.lockY = goalBaseY + 100;
    }

    // 笏笏 CLEAR 蛻､螳・笏笏
    // 繧ｫ繝｡繝ｩ縺後Ο繝・け菴咲ｽｮ縺ｫ螳滄圀縺ｫ蛻ｰ驕・+ 蝓弱′遐ｴ螢翫＆繧後◆譎らせ縺ｧ逋ｺ轣ｫ縲・
    // (lockY 莠育ｴ・□縺代〒縺ｯ逋ｺ轣ｫ縺帙★縲√き繝｡繝ｩ縺檎黄逅・噪縺ｫ縺昴％縺ｸ蛻ｰ驕斐☆繧九∪縺ｧ蠕・▽)
    if (!this.clearTriggered && this.camera.lockY !== null &&
        this.camera.y >= this.camera.lockY - 1) {
      // 繧ｫ繝｡繝ｩ縺後Ο繝・け菴咲ｽｮ蛻ｰ驕疲ｸ医∩ 竊・縺雁沁縺ｮ遐ｴ螢翫ｒ蠕・▽
      if (this.buildings.hasGoalCastle()) {
        if (!this.buildings.isGoalCastleAlive()) {
          this.clearTriggered = true;
          this.onClear();
          return;
        }
        // 蝓弱′縺ｾ縺逕溘″縺ｦ縺・ｋ 竊・繧ｯ繝ｪ繧｢縺帙★蠕・ｩ・(繝励Ξ繧､邯夊｡・
      } else {
        // 荳・ｸ GOAL 繝√Ε繝ｳ繧ｯ縺ｫ蝓弱′辟｡縺・ｴ蜷医・縺ｿ蜊ｳ繧ｯ繝ｪ繧｢ (譛ｬ譚･縺ｯ逋ｺ逕溘＠縺ｪ縺・
        this.clearTriggered = true;
        this.onClear();
        return;
      }
    }

  }

  /** 迴ｾ蝨ｨ縺ｮ繝√Ε繝ｳ繧ｯ縺九ｉ謇螻槭せ繝・・繧ｸ繧貞愛螳壹＠縺ｦ HUD / 閭梧勹繧呈峩譁ｰ */
  private updateCurrentStage() {
    // 逕ｻ髱｢荳ｭ螟ｮ縺悟ｱ槭☆繧九メ繝｣繝ｳ繧ｯ繧堤樟蝨ｨ繧ｹ繝・・繧ｸ縺ｨ縺吶ｋ
    const cameraCenterY = this.camera.y;
    const chunkIdx = Math.floor((cameraCenterY - C.WORLD_MAX_Y) / C.CHUNK_HEIGHT);
    const clamped  = Math.max(0, Math.min(TOTAL_CHUNKS - 1, chunkIdx));
    const info = chunkInfoFor(clamped);
    if (info.finished) return;
    if (info.stageIndex !== this.currentStageIndex) {
      this.currentStageIndex = info.stageIndex;
      this.ui.setZone(info.stageIndex, info.stage.nameEn);
      // BGM 縺ｮ繝ｫ繝ｼ繝磯浹繧偵せ繝・・繧ｸ螟画峩縺ｫ蜷医ｏ縺帙※蛻・崛
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

  private updateBall(dt: number, cameraDeltaY = 0) {
    const b = this.ball;
    if (!b.active) return;
    // 笘・繝・ヰ繝・げ: 繝懊・繝ｫ繧偵き繝｡繝ｩ繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ縺ｫ霑ｽ蠕・(逕ｻ髱｢荳翫・菴咲ｽｮ繧堤ｶｭ謖・
    //   縺溘□縺・intro 荳ｭ (game start 蜑・ 繧・camera lock 荳ｭ縺ｯ霑ｽ蠕薙＠縺ｪ縺・
    const cameraIsScrolling = !this.introActive &&
      (this.camera.lockY === null || this.camera.y < this.camera.lockY);
    if (cameraIsScrolling) {
      b.y += cameraDeltaY;
    }
    const r = b.radius;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    // 1 substep 縺ゅ◆繧翫・遘ｻ蜍暮㍼繧・ball 蜊雁ｾ・悴貅縺ｫ謚代∴縺ｦ繝医Φ繝阪Μ繝ｳ繧ｰ繧帝亟縺・
    // (ball radius = 9, 騾溷ｺｦ 40 縺ｧ繧・7 substep 縺ｧ ~5.7 px/substep)
    const SUB = Math.max(1, Math.min(8, Math.ceil(speed / 6)));
    const dts = dt / SUB;

    // 雋ｫ騾壻ｸｭ縺ｮ蟒ｺ迚ｩ縺九ｉ謚懊￠縺溘ｉ lastPiercedBld 繧偵け繝ｪ繧｢
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
      // 蝗櫁ｻ｢: 豌ｴ蟷ｳ騾溷ｺｦ縺ｫ豈比ｾ・(霆｢縺後ｊ縲・・= v / r)縲ょ承縺ｫ騾ｲ繧√・ CW 蝗櫁ｻ｢縲・
      b.angle -= (b.vx / r) * dts * 60;
      const camTop = this.camera.y + C.WORLD_MAX_Y;
      if (b.x - r < C.WORLD_MIN_X) { b.x = C.WORLD_MIN_X + r; b.vx = Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.x + r > C.WORLD_MAX_X) { b.x = C.WORLD_MAX_X - r; b.vx = -Math.abs(b.vx) * C.WALL_DAMPING; wallSoundNeeded = true; }
      if (b.y + r > camTop - 40) { b.y = camTop - 40 - r; b.vy = -Math.abs(b.vy) * C.WALL_DAMPING; wallSoundNeeded = true; }
      // 蝮・ normalDamping=0.22 縺ｧ霍ｳ縺ｭ縺ｫ縺上￥縲》angentFriction=0.965 縺ｧ霆｢縺後ｊ縺ｪ縺後ｉ
      // 縺昴％縺昴％繧ｨ繝阪Ν繧ｮ繝ｼ繧貞炎縺・(蠕蠕ｩ 1 蝗槭￥繧峨＞縺ｧ遨ｴ縺ｫ關ｽ縺｡繧区嫌蜍輔ｒ迢吶≧)縲・
      for (const slope of [this.getSlopeL(), this.getSlopeR()]) {
        const res = resolveCircleOBBSlide(b.x, b.y, r, b.vx, b.vy, slope, 0.22, 0.965);
        if (res) {
          const preSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          [b.x, b.y, b.vx, b.vy] = res;
          const postSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          // 謗･隗ｦ髻ｳ縺ｯ螟ｧ縺阪↑ normal 蜈･蜉帶凾縺ｮ縺ｿ (謫ｦ繧企浹縺ｮ騾｣逋ｺ繧帝∩縺代ｋ)
          if (preSpd - postSpd > 2) wallSoundNeeded = true;
          break;
        }
      }
      // 繝輔Μ繝・ヱ繝ｼ: 繧ｫ繝励そ繝ｫ蛻､螳壹〒蜈育ｫｯ繧剃ｸｸ繧√※蠑輔▲謗帙°繧翫ｒ謗帝勁縲・
      // normalDamping=0.35 縺ｧ霍ｳ縺ｭ縺吶℃縺ｪ縺・ｨ句ｺｦ縺ｫ菫晄戟縲》angentFriction=0.998 縺ｧ縺ｻ縺ｼ辟｡鞫ｩ謫ｦ縲・
      // 謚ｼ縺輔ｌ縺溘ｉ applyImpulse 縺ｧ霑ｽ蜉縺ｮ蠑ｷ謇薙■蜃ｺ縺励・
      for (const fl of this.flippers) {
        // 蜈育ｫｯ縺ｮ蟆上＆縺ｪ蜊雁・遯∬ｵｷ (繝舌Φ繝代・): 繝輔Μ繝・ヱ繝ｼ縺ｮ蜍輔″縺ｨ縺ｯ辟｡髢｢菫ゅ↓
        // 髱呎ｭ｢菴咲ｽｮ縺ｧ蝗ｺ螳壹ゆｽ咲ｽｮ縺ｯ譛蜈育ｫｯ繧医ｊ蜒・°縺ｫ螟門・ (+2 px) 縺ｪ縺ｮ縺ｧ縲・
        // 繝輔Μ繝・ヱ繝ｼ譛ｬ菴謎ｸ翫ｒ謫ｦ繧狗ｨ句ｺｦ縺ｧ縺ｯ蠖薙◆繧峨★縲∵怙蜈育ｫｯ縺ｾ縺ｧ貊代▲縺ｦ縺阪◆譎ゅ↓縺縺大渚蠢懊☆繧九・
        const TIP_BUMP_R = 1;   // 遯∬ｵｷ縺ｮ蜊雁ｾ・(蜊雁・縺ｫ邵ｮ蟆・
        // 遯∬ｵｷ縺ｯ髱呎ｭ｢菴咲ｽｮ縺ｧ蝗ｺ螳・(繝輔Μ繝・ヱ繝ｼ縺梧険縺｣縺ｦ繧ょ虚縺九↑縺・: REST 隗貞ｺｦ繝吶・繧ｹ
        const restRad = (fl.isLeft ? C.FLIPPER_REST_DEG : (180 - C.FLIPPER_REST_DEG)) * Math.PI / 180;
        const rCos = Math.cos(restRad), rSin = Math.sin(restRad);
        const yDirT = fl.isLeft ? 1 : -1;
        const bumpLocalX = C.FLIPPER_W + TIP_BUMP_R;           // 遯∬ｵｷ縺ｮ蜀・・遶ｯ縺梧怙蜈育ｫｯ縺ｫ謠・≧
        const bumpLocalY = (4 + TIP_BUMP_R) * yDirT;           // 縺輔ｉ縺ｫ 1 px 荳九￡繧・
        const tipBX = fl.pivotX + bumpLocalX * rCos - bumpLocalY * rSin;
        const tipBY = fl.pivotY + bumpLocalX * rSin + bumpLocalY * rCos;
        const tdx = b.x - tipBX, tdy = b.y - tipBY;
        const sumR = r + TIP_BUMP_R;
        if (tdx * tdx + tdy * tdy < sumR * sumR) {
          const td = Math.sqrt(tdx * tdx + tdy * tdy) || 0.001;
          const tnx = tdx / td, tny = tdy / td;
          // 謚ｼ縺怜・縺・
          b.x = tipBX + tnx * (sumR + 0.5);
          b.y = tipBY + tny * (sumR + 0.5);
          // 蜿榊ｰ・(restitution = 0.18縲∵而縺医ａ縺ｫ霍ｳ縺ｭ霑斐ｋ)
          const tdot = b.vx * tnx + b.vy * tny;
          if (tdot < 0) {
            const e = 0.18;
            b.vx -= (1 + e) * tdot * tnx;
            b.vy -= (1 + e) * tdot * tny;
            flipperSoundNeeded = true;
          }
          break;  // 繝舌Φ繝代・縺ｧ蜃ｦ逅・＠縺溘・縺ｧ縺薙・繝輔Μ繝・ヱ繝ｼ縺ｮ譛ｬ菴薙・鬟帙・縺・
        }
        const res = resolveCircleCapsule(b.x, b.y, r, b.vx, b.vy, fl.getOBB(), 0.15, 0.998);
        if (res) {
          const preSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          [b.x, b.y, b.vx, b.vy] = res;
          const [nvx, nvy] = fl.applyImpulse(b.vx, b.vy);
          b.vx = nvx; b.vy = nvy;
          [b.vx, b.vy] = clampSpeed(b.vx, b.vy, C.MAX_BALL_SPEED);
          const postSpd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          // 謇薙■蜃ｺ縺玲凾縺ｮ縺ｿ髻ｳ繧帝ｳｴ繧峨☆ (謫ｦ繧企浹縺ｮ騾｣逋ｺ繧帝∩縺代ｋ)
          if (postSpd > preSpd + 2) flipperSoundNeeded = true;
          break;
        }
      }
      if (!bldResult) {
        const h = this.buildings.checkBallHit(b.x, b.y, r, b.vx, b.vy, b.lastPiercedBld);
        // 陦晉ｪ∽ｽ咲ｽｮ縺ｫ陬懈ｭ｣ (蟒ｺ迚ｩ霑大ｍ髱｢)縲らｴ螢・髱樒ｴ螢翫・蛻・ｲ舌・ post-loop 縺ｧ蜃ｦ逅・
        if (h) { bldResult = h; b.x = h.newBx; b.y = h.newBy; }
      }
    }

    if (flipperSoundNeeded) { this.sound.flipper(); this.juice.ballHitFlash(); }
    else if (wallSoundNeeded) { this.sound.wallHit(); }

    // 繝繝｡繝ｼ繧ｸ縺ｯ蟶ｸ縺ｫ 1 (HP 蜊倅ｽ・= 繝偵ャ繝亥屓謨ｰ邂｡逅・
    if (bldResult) {
      const { bld } = bldResult;
      const impactSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

      if (this.canPierceBuilding(bld, impactSpeed)) {
        const destroyed = this.buildings.damage(bld, Math.max(1, bld.hp));
        b.vx *= C.PIERCE_SPEED_DAMPING;
        b.vy *= C.PIERCE_SPEED_DAMPING;
        b.lastPiercedBld = bld;
        this.pierceChain++;
        this.sound.bumper();
        this.juice.hitstop(C.HITSTOP_SMALL);
        this.juice.shake(C.SHAKE_HIT_AMP, C.SHAKE_HIT_DUR);
        this.juice.ballHitFlash();
        this.particles.spawnSpark(b.x, b.y, 12);
        this.particles.spawnRubbleChunks(b.x, b.y, 5, 0.75, 0.78, 0.82);
        this.ui.showWorldPopup(b.x, b.y + 18, `PIERCE x${this.pierceChain}`, 'pierce');
        if (destroyed) this.onBuildingDestroyed(bld, { pierced: true });
      } else {
        this.pierceChain = 0;
        const destroyed = this.buildings.damage(bld, 1);

        if (destroyed) {
          // 遐ｴ螢雁ｾ碁夐℃: 譌｢蟄倥・ lastPiercedBld 謖吝虚縺ｯ谿九☆縲・          b.lastPiercedBld = bld;
          b.lastPiercedBld = bld;
          this.onBuildingDestroyed(bld);
        } else {
          // 蜿榊ｰ・ 蜿咲匱菫よ焚繧帝←逕ｨ縺励※繧ｨ繝阪Ν繧ｮ繝ｼ繧貞､ｱ繧上○繧・(縺ｵ繧薙ｏ繧頑─)
          // 縲御ｸ九°繧牙ｻｺ迚ｩ縺ｮ蠎暮擇縺ｫ蠖薙◆縺｣縺溘・ 繝懊・繝ｫ縺御ｸ雁髄縺・(vy>0) 縺ｧ蜿榊ｰ・ｾ後↓荳句髄縺・(newVy<0) 縺ｮ繧ｱ繝ｼ繧ｹ
          // 縺薙・蝣ｴ蜷医・驩帷峩蜿崎ｻ｢縺檎匱逕溘☆繧九・縺ｧ縲∝ｼｷ繧√↓貂幄｡ｰ縺輔○縺ｦ諤昴＞蛻・ｊ蠑ｾ縺九ｌ繧区─繧呈ｶ医☆
          const isBottomHit = b.vy > 0.5 && bldResult.newVy < 0;
          const restitution = isBottomHit ? C.RESTITUTION_BUILDING_BOTTOM : C.RESTITUTION_BUILDING;
          // resolveCircleAABB 縺ｯ damping=0.78 縺ｧ蜿榊ｰ・ｸ医∩ (= 譌ｧ繧ｳ繝ｼ繝峨・縺薙ｌ繧貞ｷｻ縺肴綾縺励※ 1.0 縺ｫ縺励※縺・◆)縲・          // 莉翫・ preSpd 豈斐〒蜀阪せ繧ｱ繝ｼ繝ｫ縺励※縺九ｉ restitution 繧呈寺縺代※逶ｮ讓吝渚逋ｺ菫よ焚縺ｫ謠・∴繧九・          const preSpd  = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 0.001;
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
        // 蟾･讌ｭ霆贋ｸ｡ (worker_truck) 縺ｯ遐ｴ螢頑凾縺ｫ蜉ｴ蜒崎・ｒ蜷舌￥ 窶・Stage 4 縺ｮ辯・侭陬懃ｵｦ貅・
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
      // 莠ｺ髢薙・辯・侭: 邱壼ｽ｢縺ｫ蝗槫ｾｩ
      this.fuel = Math.min(C.FUEL_MAX, this.fuel + crushed.length * C.FUEL_GAIN_PER_HUMAN);
      this.sound.humanCrush(1);
      this.juice.shake(C.SHAKE_HUMAN_AMP, C.SHAKE_HUMAN_DUR);
    }

    if (b.y < this.camera.y + C.FALLOFF_Y) this.onBallLost();
    b.recordTrail();
  }

  private canPierceBuilding(bld: BuildingData, speed: number): boolean {
    if (bld.size === 'castle' || bld.size === 'gas_station') return false;
    if (SMALL_PIERCE_BUILDINGS.has(bld.size)) return speed >= C.PIERCE_SMALL_SPEED;
    if (MEDIUM_PIERCE_BUILDINGS.has(bld.size)) return speed >= C.PIERCE_MEDIUM_SPEED && bld.maxHp <= 2;
    return false;
  }

  private onBuildingDestroyed(bld: BuildingData, opts: { pierced?: boolean; chain?: boolean } = {}) {
    const cx = bld.x + bld.w / 2;
    const cy = bld.y + bld.h / 2;
    this.totalDestroys++;
    this.addScore(bld.score);
    this.sound.buildingDestroy();

    // hp 4谿ｵ髫・竊・tier 1-4 縺ｫ豁｣隕丞喧縺励※繝代・繝・ぅ繧ｯ繝ｫ謨ｰ繝ｻ貍泌・蠑ｷ蠎ｦ縺ｫ菴ｿ縺・
    const sc = Math.ceil(bld.maxHp / 4); // hp4竊・, hp8竊・, hp11竊・, hp13竊・
    const isLarge = bld.maxHp >= 11;
    if (isLarge) { this.juice.hitstop(C.HITSTOP_LARGE); this.juice.shake(C.SHAKE_LARGE_AMP, C.SHAKE_LARGE_DUR, 1.5); this.juice.flash(1, 1, 1, 0.40); }
    else         { this.juice.hitstop(C.HITSTOP_SMALL);  this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR); this.juice.flash(1, 0.85, 0.4, 0.18); }

    const [dr, dg, db] = bld.baseColor;
    const top = bld.y + bld.h;

    // 笏笏 邏譚仙挨繝吶・繧ｹ遐ｴ螢翫お繝輔ぉ繧ｯ繝・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
    // 蟒ｺ迚ｩ縺ｮ邏譚舌・隕乗ｨ｡縺ｫ蠢懊§縺溷渕譛ｬ繝代・繝・ぅ繧ｯ繝ｫ繧ｻ繝・ヨ繧呈淵繧峨☆
    this.spawnBaseDestructionFx(bld.size, cx, cy, top, sc, isLarge, dr, dg, db);

    // 笏笏 遞ｮ蛻･蛻･繝・・繝槭ヱ繝ｼ繝・ぅ繧ｯ繝ｫ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
    this.spawnThemedDestructionFx(bld.size, cx, cy, sc);

    if (!opts.pierced && !opts.chain) {
      this.ui.showWorldPopup(cx, cy + bld.h * 0.5 + 12, `+${bld.score}`, 'score');
    }

    const fuelBonus = FUEL_BUILDING_BONUS[bld.size] ?? 0;
    if (fuelBonus > 0) {
      this.fuel = Math.min(C.FUEL_MAX, this.fuel + fuelBonus);
      this.ui.setFuel(this.fuel);
      this.ui.showWorldPopup(cx, cy + bld.h * 0.5 + 24, `FUEL +${fuelBonus}`, 'fuel');
      this.juice.flash(0.4, 1, 0.35, 0.18);
    }

    if (bld.size === 'gas_station') {
      this.triggerGasExplosion(bld, cx, cy);
    }

    // 笏笏 謨第･霆・ 逞・劼 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
    if (bld.size === 'hospital') {
      this.vehicles.spawnAmbulance(cx < 0 ? 190 : -190, C.MAIN_STREET_Y);
    }

    // 蟒ｺ迚ｩ遞ｮ蛻･縺ｫ蠢懊§縺滉ｺｺ髢薙・繝ｼ繝ｫ繧貞叙蠕・(蟄ｦ譬｡ 竊・蟄蝉ｾ帙∫羅髯｢ 竊・逵玖ｭｷ蟶ｫ縺ｪ縺ｩ)
    const kindWeights = getHumanWeightsForBuilding(bld.size);
    this.humans.spawnBlast(cx, cy, randInt(bld.humanMin, bld.humanMax), kindWeights);
  }

  private triggerGasExplosion(source: BuildingData, cx: number, cy: number) {
    this.addScore(C.GAS_EXPLOSION_SCORE);
    this.sound.bumper();
    this.juice.hitstop(C.HITSTOP_LARGE);
    this.juice.shake(C.SHAKE_LARGE_AMP * 1.15, C.SHAKE_LARGE_DUR, 1.6);
    this.juice.flash(1, 0.38, 0.08, 0.42);
    this.particles.spawnFire(cx, cy, 52);
    this.particles.spawnSmoke(cx, cy, 22);
    this.particles.spawnSpark(cx, cy, 38);
    this.particles.spawnEmbers(cx, cy, 34);
    this.ui.showWorldPopup(cx, cy + 34, 'BOOM', 'boom');

    for (const b of this.buildings.buildings) {
      if (b === source || !b.active || b.destroyTimer > 0) continue;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const dx = bx - cx;
      const dy = by - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > C.GAS_EXPLOSION_RADIUS) continue;

      const destroyed = this.buildings.damage(b, C.GAS_EXPLOSION_DAMAGE);
      b.flashTimer = 0.16;
      this.particles.spawnSpark(bx, by, 8);
      this.particles.spawnDebris(bx, by, 8, b.baseColor[0], b.baseColor[1], b.baseColor[2]);
      if (destroyed) this.onBuildingDestroyed(b, { chain: true });
    }
  }

  private checkStageClear(): boolean {
    if (this.introActive || this.currentStageIndex >= STAGES.length - 1) return false;
    const chunkIdx = Math.floor((this.camera.y - C.WORLD_MAX_Y) / C.CHUNK_HEIGHT);
    const clamped  = Math.max(0, Math.min(TOTAL_CHUNKS - 1, chunkIdx));
    const info = chunkInfoFor(clamped);
    if (info.finished || info.stageIndex <= this.currentStageIndex) return false;
    this.onStageClear(info.stageIndex);
    return true;
  }

  private onStageClear(nextStageIndex: number): void {
    const clearedStage = STAGES[this.currentStageIndex];
    const nextStage = STAGES[nextStageIndex] ?? STAGES[Math.min(STAGES.length - 1, this.currentStageIndex + 1)];
    this.state = 'stage_clear';
    this.pendingStageIndex = Math.min(STAGES.length - 1, Math.max(nextStageIndex, this.currentStageIndex + 1));
    this.juice.flash(1, 0.9, 0.4, 0.45);
    this.juice.shake(C.SHAKE_LARGE_AMP, 0.22);
    this.sound.stopMusic();
    this.sound.stageClear();
    this.spawnStageClearBurst();
    this.ui.showStageClear(this.currentStageIndex, clearedStage.nameEn, nextStage.nameEn, this.totalScore, this.fuel);
  }

  private continueToNextStage(): void {
    if (this.state !== 'stage_clear') return;
    const nextStageIndex = Math.min(STAGES.length - 1, this.pendingStageIndex);
    const stage = STAGES[nextStageIndex];
    this.currentStageIndex = nextStageIndex;
    this.pendingStageIndex = nextStageIndex;
    this.state = 'playing';
    this.stateTimer = 0;
    this.stuckSeconds = 0;
    this.pierceChain = 0;
    this.fuel = Math.max(this.fuel, C.FUEL_STAGE_START_MIN);
    this.ball.resetWithCamera(this.camera.y);
    this.ui.hideStageClear();
    this.ui.setZone(nextStageIndex, stage.nameEn);
    this.ui.setFuel(this.fuel);
    if (stage.bgTop) {
      this.bgTopR = stage.bgTop[0];
      this.bgTopG = stage.bgTop[1];
      this.bgTopB = stage.bgTop[2];
    }
    if (stage.bgBottom) {
      this.bgBottomR = stage.bgBottom[0];
      this.bgBottomG = stage.bgBottom[1];
      this.bgBottomB = stage.bgBottom[2];
    }
    this.sound.startMusic(nextStageIndex);
    this.juice.flash(0.7, 1, 0.45, 0.25);
  }

  private spawnStageClearBurst(): void {
    const cyBase = this.camera.y + 40;
    const positions = [
      [-70, cyBase + 80],
      [70, cyBase + 20],
      [0, cyBase + 115],
    ];
    positions.forEach(([x, y], i) => {
      setTimeout(() => {
        if (this.state !== 'stage_clear') return;
        this.particles.spawnFireworks(x, y, 30);
        this.juice.shake(2, 0.12);
      }, i * 180);
    });
  }

  /** 邏譚仙挨縺ｮ蝓ｺ譛ｬ遐ｴ螢翫ヱ繝ｼ繝・ぅ繧ｯ繝ｫ 窶・譛ｨ騾 / 繧ｳ繝ｳ繧ｯ繝ｪ / 驥大ｱ・/ 繧ｬ繝ｩ繧ｹ蠑ｵ繧・遲峨〒逡ｰ縺ｪ繧・*/
  private spawnBaseDestructionFx(
    size: C.BuildingSize, cx: number, cy: number, top: number,
    sc: number, isLarge: boolean, dr: number, dg: number, db: number
  ) {
    const profile = BUILDING_MATERIAL[size] ?? 'concrete_small';
    const debrisN = 14 + sc * 10;
    const rubbleN = 4 + sc * 2;          // 螟ｧ縺阪↑蝪・(4-12蛟・
    const p = this.particles;

    switch (profile) {
      case 'wood': // 譛ｨ騾 窶・譛ｨ縺｣遶ｯ螻ｱ逶帙ｊ + 譛ｨ雉ｪ蝪・+ 辯・∴縺輔＠
        p.spawnWoodChips  (cx, cy, 18 + sc * 10);
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.55, 0.38, 0.22);
        p.spawnEmbers     (cx, cy,  6 + sc * 3);
        break;

      case 'wood_traditional': // 莨晉ｵｱ譛ｨ騾 窶・譛ｨ縺｣遶ｯ + 譛ｨ雉ｪ蝪・+ 關ｽ闡・+ 辯・∴縺輔＠
        p.spawnWoodChips  (cx, cy, 16 + sc * 10);
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.50, 0.32, 0.20);
        p.spawnLeaves     (cx, cy, 10 + sc * 4);
        p.spawnEmbers     (cx, cy,  8 + sc * 3);
        break;

      case 'concrete_small': // 蟆丞梛繧ｳ繝ｳ繧ｯ繝ｪ 窶・螟ｧ蝪・+ 邏ｰ迚・+ 轣ｫ闃ｱ
        p.spawnRubbleChunks(cx, cy, rubbleN, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN, dr, dg, db);
        p.spawnSpark       (cx, cy,  8 + sc * 5);
        break;

      case 'concrete_medium': // 荳ｭ蝙九さ繝ｳ繧ｯ繝ｪ 窶・螟ｧ蝪・+ 邏ｰ迚・+ 繧ｬ繝ｩ繧ｹ + 轣ｫ闃ｱ
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnDebris      (cx, cy, debrisN + 4, dr, dg, db);
        p.spawnGlass       (cx, cy,  6 + sc * 3);
        p.spawnSpark       (cx, cy, 10 + sc * 5);
        break;

      case 'glass_tower': // 繧ｬ繝ｩ繧ｹ鬮伜ｱ､ 窶・螟ｧ蝪・+ 繧ｬ繝ｩ繧ｹ螻ｱ逶帙ｊ + 邏ｰ迚・+ 縺阪ｉ繧√″
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnGlass       (cx, cy, 22 + sc * 10);
        p.spawnDebris      (cx, cy, 12 + sc * 8, dr, dg, db);
        p.spawnSparkle     (cx, cy,  6 + sc * 2);
        if (isLarge) {
          p.spawnGlass       (cx, top, 16);
          p.spawnRubbleChunks(cx, top, 4, dr, dg, db);
        }
        break;

      case 'metal_industrial': // 蟾･讌ｭ 窶・驥大ｱ槫､ｧ蝪・+ 驥大ｱ樒援 + 豁ｯ霆・+ 轣ｫ闃ｱ (+ 繧ｹ繝・・繧ｸ4縺ｮ縺ｿ辣・
        p.spawnRubbleChunks(cx, cy, rubbleN, 0.62, 0.62, 0.66);
        p.spawnMetalDebris (cx, cy, 14 + sc * 8);
        if (this.currentStageIndex === 3) p.spawnSmoke(cx, cy, 12 + sc * 5);
        p.spawnSpark       (cx, cy, 12 + sc * 5);
        p.spawnGears       (cx, cy,  6 + sc * 3);
        break;

      case 'landmark': // 繝ｩ繝ｳ繝峨・繝ｼ繧ｯ 窶・螟ｧ蝪・+ 邏ｰ迚・+ 縺阪ｉ繧√″ + 邏吝聖髮ｪ + 轤・
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

      case 'explosive': // 辷・匱 (繧ｬ繧ｽ繧ｹ繧ｿ) 窶・螟ｧ蝪・+ 螟ｧ驥冗ｎ + 辯・∴縺輔＠ + 邏ｰ迚・
        p.spawnRubbleChunks(cx, cy, rubbleN + 2, dr, dg, db);
        p.spawnFire        (cx, cy, 28 + sc * 6);
        p.spawnSpark       (cx, cy, 22 + sc * 6);
        if (this.currentStageIndex === 3) p.spawnSmoke(cx, cy, 18);
        p.spawnEmbers      (cx, cy, 24);
        p.spawnDebris      (cx, cy, 14, dr, dg, db);
        break;

      case 'castle': // 螟ｩ螳磯魅 窶・蟾ｨ螟ｧ逑ｦ遉ｫ髮ｨ + 闃ｱ轣ｫ + 譯・+ 縺阪ｉ繧√″
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

    // 螟ｧ蝙九ン繝ｫ蜈ｱ騾・ 鬆るΚ縺九ｉ繧りｿｽ蜉貍泌・ (蟆ら畑蜃ｦ逅・ｸ医∩縺ｮ繝励Ο繝輔ぃ繧､繝ｫ縺ｯ繧ｹ繧ｭ繝・・)
    if (isLarge && profile !== 'glass_tower' && profile !== 'castle' &&
        profile !== 'explosive' && profile !== 'landmark') {
      this.particles.spawnRubbleChunks(cx, top, 4, dr, dg, db);
      this.particles.spawnDebris      (cx, top, 12, dr, dg, db);
      this.particles.spawnSpark       (cx, top, 12);
    }
  }

  /** 遞ｮ蛻･蛻･繝・・繝槭ヱ繝ｼ繝・ぅ繧ｯ繝ｫ 窶・蟒ｺ迚ｩ縺ｮ逕ｨ騾斐・讌ｭ遞ｮ縺ｫ蠢懊§縺滓ｼ泌・ */
  private spawnThemedDestructionFx(size: C.BuildingSize, cx: number, cy: number, sc: number) {
    const p = this.particles;
    switch (size) {
      // 笏笏 驥題檮繝ｻ迴ｾ驥・笏笏
      case 'bank':              p.spawnCash(cx, cy, 16 + sc * 4); p.spawnCoins(cx, cy, 14); break;
      case 'department_store':  p.spawnCash(cx, cy, 12); p.spawnConfetti(cx, cy, 18); p.spawnBalloons(cx, cy, 8); break;

      // 笏笏 譛ｬ繝ｻ遏･隴・笏笏
      case 'library':           p.spawnBooks(cx, cy, 18 + sc * 3); break;
      case 'bookstore':         p.spawnBooks(cx, cy, 14); break;

      // 笏笏 闃ｱ繝ｻ讀咲黄 笏笏
      case 'florist':           p.spawnFlower(cx, cy, 18); p.spawnLeaves(cx, cy, 8); break;
      case 'greenhouse':        p.spawnFlower(cx, cy, 14); p.spawnLeaves(cx, cy, 14); p.spawnWater(cx, cy, 6); break;

      // 笏笏 蜥碁｢ｨ繝ｻ逾樒､ｾ莉城魅 笏笏
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

      // 笏笏 髮ｻ豌励・繝・ず繧ｿ繝ｫ 笏笏
      case 'game_center':       p.spawnPixels(cx, cy, 18); p.spawnElectric(cx, cy, 10); p.spawnNeonShards(cx, cy, 8); break;
      case 'pachinko':          p.spawnCoins(cx, cy, 16); p.spawnPixels(cx, cy, 14); p.spawnNeonShards(cx, cy, 8); p.spawnConfetti(cx, cy, 10); break;
      case 'police_station':    p.spawnElectric(cx, cy, 12); p.spawnPixels(cx, cy, 6); break;
      case 'fire_station':      p.spawnEmbers(cx, cy, 14); p.spawnSpark(cx, cy, 10); break;

      // 笏笏 鬟滉ｺ九・蝟ｫ闌ｶ 笏笏
      case 'restaurant':
      case 'cafe':
      case 'bakery':            p.spawnFood(cx, cy, 14); p.spawnSteam(cx, cy, 6); break;
      case 'ramen':             p.spawnNoodles(cx, cy, 16); p.spawnSteam(cx, cy, 12); p.spawnFood(cx, cy, 6); break;
      case 'izakaya':           p.spawnFood(cx, cy, 12); p.spawnEmbers(cx, cy, 8); p.spawnSteam(cx, cy, 8); p.spawnRibbons(cx, cy, 6); break;
      case 'supermarket':
      case 'convenience':       p.spawnFood(cx, cy, 16); p.spawnConfetti(cx, cy, 6); break;

      // 笏笏 豌ｴ繝ｻ闥ｸ豌・笏笏
      case 'water_tower':       p.spawnWater(cx, cy, 24); p.spawnBubbles(cx, cy, 12); break;
      case 'laundromat':        p.spawnBubbles(cx, cy, 18); p.spawnSteam(cx, cy, 10); break;
      case 'train_station':     p.spawnSteam(cx, cy, 14); p.spawnGears(cx, cy, 8); p.spawnSpark(cx, cy, 10); break;

      // 笏笏 螽ｯ讌ｽ繝ｻ逾晉･ｭ 笏笏
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

      // 笏笏 蛹ｻ逋・笏笏
      case 'hospital':          p.spawnPills(cx, cy, 14); p.spawnGlass(cx, cy, 8); break;
      case 'clinic':            p.spawnPills(cx, cy, 10); break;
      case 'pharmacy':          p.spawnPills(cx, cy, 16); break;

      // 笏笏 蟾･讌ｭ 笏笏
      case 'factory_stack':     p.spawnGears(cx, cy, 12); p.spawnEmbers(cx, cy, 10); p.spawnFire(cx, cy, 8); break;
      case 'crane_gantry':      p.spawnGears(cx, cy, 14); p.spawnSpark(cx, cy, 12); break;
      case 'warehouse':         p.spawnGears(cx, cy, 8); p.spawnDebris(cx, cy, 6, 0.7, 0.55, 0.40); break;
      case 'silo':              p.spawnFood(cx, cy, 14); p.spawnDebris(cx, cy, 6, 0.85, 0.78, 0.55); break;
      case 'container_stack':   p.spawnGears(cx, cy, 6); break;

      // 笏笏 螟懆｡励・郢∬庄陦・笏笏
      case 'snack':             p.spawnHearts(cx, cy, 10); p.spawnNeonShards(cx, cy, 8); break;
      case 'love_hotel':        p.spawnHearts(cx, cy, 18); p.spawnNeonShards(cx, cy, 10); break;
      case 'business_hotel':    p.spawnGlass(cx, cy, 10); p.spawnCash(cx, cy, 6); break;
      case 'mahjong_parlor':    p.spawnTiles(cx, cy, 18); break;
      case 'club':              p.spawnNeonShards(cx, cy, 16); p.spawnPixels(cx, cy, 14); p.spawnSparkle(cx, cy, 8); break;
      case 'capsule_hotel':     p.spawnGlass(cx, cy, 8); p.spawnPixels(cx, cy, 8); break;

      // 笏笏 蜈ｬ蜈ｱ 笏笏
      case 'museum':            p.spawnSparkle(cx, cy, 14); p.spawnCoins(cx, cy, 8); break;
      case 'city_hall':         p.spawnRibbons(cx, cy, 10); p.spawnConfetti(cx, cy, 14); break;
      case 'post_office':       p.spawnCash(cx, cy, 8); p.spawnConfetti(cx, cy, 8); break;
      case 'clock_tower':       p.spawnGears(cx, cy, 14); p.spawnSparkle(cx, cy, 10); break;
      case 'radio_tower':       p.spawnElectric(cx, cy, 14); p.spawnSparkle(cx, cy, 8); break;

      // 笏笏 蝠・ｺ苓｡励・蜈ｬ蜈ｱ 笏笏
      case 'shotengai_arcade':  p.spawnRibbons(cx, cy, 14); p.spawnConfetti(cx, cy, 8); break;
      case 'fountain_pavilion': p.spawnWater(cx, cy, 18); p.spawnBubbles(cx, cy, 10); p.spawnSparkle(cx, cy, 6); break;
      case 'bus_terminal_shelter': p.spawnGlass(cx, cy, 8); break;
    }
  }

  /** 陦苓ｷｯ險ｭ蛯吶ｒ遐ｴ螢翫＠縺滓凾縺ｮ遞ｮ蛻･蛻･繝代・繝・ぅ繧ｯ繝ｫ */
  private spawnFurnitureFx(type: FurnitureType, x: number, y: number, destroyed: boolean) {
    const p = this.particles;
    // 遐ｴ螢翫＆繧後↑縺・(荳謦・〒螢翫ｌ縺ｪ縺・ 繝偵ャ繝医・蟆上＆繧√・繧ｹ繝代・繧ｯ/遐ょ｡ｵ縺ｧ謗ｧ縺医ａ縺ｫ
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

    // 螳悟・遐ｴ螢頑凾縺ｯ邏譚舌・繝・・繝槭↓蠢懊§縺溘ヱ繝ｼ繝・ぅ繧ｯ繝ｫ
    switch (type) {
      // 笏笏 邱代・讀肴ｽ 笏笏
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

      // 笏笏 豌ｴ 笏笏
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

      // 笏笏 逵区攸繝ｻ繧ｵ繧､繝ｳ 笏笏
      case 'sign_board': case 'a_frame_sign': case 'banner_pole': case 'taxi_rank_sign':
        p.spawnConfetti(x, y, 8); p.spawnWoodChips(x, y, 4); break;

      // 笏笏 髮ｻ豌励・繝阪が繝ｳ 笏笏
      case 'power_pole': case 'power_line':
        p.spawnElectric(x, y, 14); p.spawnSpark(x, y, 6); break;
      case 'electric_box': case 'cable_junction_box':
        p.spawnElectric(x, y, 10); p.spawnMetalDebris(x, y, 4); break;
      case 'signal_tower': case 'railroad_crossing':
        p.spawnElectric(x, y, 8); p.spawnSpark(x, y, 6); break;

      // 笏笏 繧ｴ繝溘・鬟・笏笏
      case 'garbage':
        p.spawnFood(x, y, 10); break;
      case 'dumpster':
        p.spawnFood(x, y, 6); p.spawnMetalDebris(x, y, 6); break;
      case 'recycling_bin':
        p.spawnGlass(x, y, 8); p.spawnMetalDebris(x, y, 4); break;

      // 笏笏 閾ｪ雋ｩ讖溘・ATM繝ｻ髮ｻ隧ｱ繝懊ャ繧ｯ繧ｹ 笏笏
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

      // 笏笏 閾ｪ霆｢霆翫・荵励ｊ迚ｩ 笏笏
      case 'bicycle': case 'bicycle_rack': case 'bicycle_row':
        p.spawnMetalDebris(x, y, 6); p.spawnSpark(x, y, 4); break;
      case 'forklift':
        p.spawnMetalDebris(x, y, 8); p.spawnGears(x, y, 6); p.spawnSpark(x, y, 4); break;

      // 笏笏 陦苓ｷｯ險ｭ蛯吶・驥大ｱ樒ｳｻ 笏笏
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

      // 笏笏 譛ｨ騾繝ｻ莨晉ｵｱ 笏笏
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

      // 笏笏 蟾･讌ｭ繝ｻ貂ｯ貉ｾ 笏笏
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

      // 笏笏 縺顔･ｭ繧翫・繝・・繝・笏笏
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

      // 笏笏 蜍慕黄 笏笏
      case 'cat':
        p.spawnFlower(x, y, 8); p.spawnSparkle(x, y, 4); break;

      // 笏笏 蟒ｺ迚ｩ縺ｮ蟆丞梛迚・笏笏
      case 'kerbside_vending_pair':
        p.spawnGlass(x, y, 6); p.spawnCoins(x, y, 4); break;

      default:
        p.spawnDebris(x, y, 4, 0.55, 0.50, 0.45); p.spawnSpark(x, y, 3);
    }
  }

  /** 霆贋ｸ｡繧堤ｴ螢翫＠縺滓凾縺ｮ霆顔ｨｮ蛻･繝代・繝・ぅ繧ｯ繝ｫ */
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

  // ===== 繝√Ε繝ｳ繧ｯ邂｡逅・=====

  private updateChunks() {
    const spawnAhead  = C.CHUNK_SPAWN_AHEAD;
    const despawnBehind = C.CHUNK_DESPAWN_BEHIND;
    const spawnThreshold = this.camera.top + spawnAhead;
    const despawnThreshold = this.camera.bottom - despawnBehind;

    // 荳頑婿蜷代↓譁ｰ繝√Ε繝ｳ繧ｯ繧貞・隱ｭ縺ｿ繧ｹ繝昴・繝ｳ (TOTAL_CHUNKS 繧定ｶ・∴縺溘ｉ蛛懈ｭ｢)
    while (this.nextChunkId < TOTAL_CHUNKS) {
      const nextTop = C.WORLD_MAX_Y + (this.nextChunkId + 1) * C.CHUNK_HEIGHT;
      if (nextTop > spawnThreshold) break;
      this._spawnChunk(this.nextChunkId);
      this.nextChunkId++;
    }

    // 繧ｫ繝｡繝ｩ荳狗ｫｯ繧医ｊ驕縺城屬繧後◆繝√Ε繝ｳ繧ｯ繧偵ョ繧ｹ繝昴・繝ｳ
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
    // 繧ｷ繝ｼ繝ｳ莠句燕驟咲ｽｮ縺ｮ humans (陦悟・繝ｻ隕ｳ螳｢)
    for (const h of chunk.prePlacedHumans) {
      this.humans.spawnAt(h.x, h.y);
    }
    this.loadedChunks.set(chunkId, chunk);
  }

  private _despawnChunk(chunkId: number) {
    const chunk = this.loadedChunks.get(chunkId);
    // 縺薙・繝√Ε繝ｳ繧ｯ縺ｫ螻槭☆繧句慍髱｢繧ｿ繧､繝ｫ縺ｮ繧ｭ繝｣繝・す繝･繧定ｧ｣謾ｾ
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
   * 蜷・hero 繧ｯ繝ｩ繧ｹ繧ｿ縺ｮ focal 蜻ｨ霎ｺ縺ｧ菴弱Ξ繝ｼ繝医〒迺ｰ蠅・ヱ繝ｼ繝・ぅ繧ｯ繝ｫ繧貞・縺・
   * (kominka竊痴team, sakura_tree竊痴akura, koi_pond竊蜘ater, ...)
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
        // focal 縺ｮ荳也阜蠎ｧ讓吶ｒ蜿門ｾ・
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
        // 逕ｻ髱｢螟悶メ繝｣繝ｳ繧ｯ縺ｯ繧ｹ繧ｭ繝・・
        if (fy > camTop || fy < camBot) continue;
        // focal 遞ｮ蛻･縺九ｉ ambient type 繧呈ｴｾ逕・
        const ambientType = this._ambientTypeFromFocal(c.focal, chunk);
        if (ambientType) {
          this.particles.spawnAmbient(fx, fy, ambientType);
        }
      }
    }
  }

  /** focal 縺ｮ遞ｮ蛻･ (蟒ｺ迚ｩ size or 螳ｶ蜈ｷ type) 縺九ｉ ambient particle 遞ｮ繧呈ｱｺ螳・*/
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
          return null; // 菴丞ｮ・・謗ｧ縺医ａ縺ｫ辟｡縺・
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
          return null; // 雕丞・縺ｯ髱咏噪
        default:
          return null;
      }
    }
  }

  private onBallLost() {
    this.ball.active = false;
    this.sound.ballLost();
    this.juice.shake(C.SHAKE_DEST_AMP, C.SHAKE_DEST_DUR);
    // 遨ｴ縺ｫ關ｽ縺｡縺溘・繝翫Ν繝・ぅ: 辯・侭繧貞ｰ鷹㍼螟ｱ縺・・ 縺ｫ縺ｪ縺｣縺ｦ繧ゅご繝ｼ繝繧ｪ繝ｼ繝舌・縺ｫ縺ｯ縺励↑縺・・    this.fuel = Math.max(0, this.fuel - C.FUEL_BALL_LOST_COST);
    this.fuel = Math.max(0, this.fuel - C.FUEL_BALL_LOST_COST);
    this.ui.setFuel(this.fuel);
    this.state = 'ball_lost';
    this.stateTimer = 1.0;
  }


  private onGameOver() {
    this.state = 'game_over';
    this.juice.flash(1, 0, 0, 0.6);
    this.sound.stopMusic();
    // CrazyGames: 繝励Ξ繧､邨ゆｺ・ｒ騾夂衍 (繧､繝ｳ繧ｿ繝ｼ繧ｹ繝・ぅ繧ｷ繝｣繝ｫ蠎・相縺ｮ蛟呵｣懊ち繧､繝溘Φ繧ｰ)
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
    // 蜍晏茜貍泌・: 繧ｫ繝｡繝ｩ遽・峇蜀・↓闃ｱ轣ｫ繧定､・焚蝗槭せ繝昴・繝ｳ (0縲・.2s 縺ｮ髢薙↓ 5 騾｣逋ｺ)
    this.spawnVictoryFireworks();
    setTimeout(() => {
      this.ui.showClear(this.camera.distanceMeters, this.totalScore, this.totalDestroys, this.totalHumans, this.bestScore);
    }, 1500);
  }

  /** 繧ｯ繝ｪ繧｢逕ｻ髱｢繧貞・縺吝燕縺ｫ逕ｻ髱｢蜈ｨ菴薙↓闃ｱ轣ｫ繧呈淵繧峨☆ */
  private spawnVictoryFireworks(): void {
    const cx = 0; // 繝ｯ繝ｼ繝ｫ繝牙ｺｧ讓咏ｳｻ X 荳ｭ蠢・
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

  /** 繧ｹ繧ｳ繧｢蜉邂励・繝ｫ繝代・: HUD 繧ょ叉譎ょ渚譏 */
  private addScore(delta: number): void {
    this.totalScore += delta;
    this.ui.setScore(this.totalScore);
  }

  /** 繝上う繧ｹ繧ｳ繧｢蛻､螳・ 迴ｾ蝨ｨ繧ｹ繧ｳ繧｢縺後・繧ｹ繝医ｒ雜・∴縺ｦ縺・ｌ縺ｰ菫晏ｭ・+ HUD 譖ｴ譁ｰ */
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
    n += this.fillSpecialAreas(SHARED_BUF, n); // 蜈ｬ蝨偵・鬧占ｻ雁ｴ縺ｯ驕楢ｷｯ縺ｮ荳翫・霍ｯ蝨ｰ縺ｮ荳・
    n += this.fillIntersections(SHARED_BUF, n); // 莠､蟾ｮ轤ｹ繝・ぅ繝・・繝ｫ繧帝％霍ｯ縺ｮ荳翫↓驥阪・繧・
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
   * 1 繧ｿ繧､繝ｫ蛻・・蝨ｰ髱｢繧呈緒逕ｻ縲ょ梛縺斐→縺ｫ逡ｰ縺ｪ繧区緒逕ｻ謚豕輔ｒ菴ｿ逕ｨ:
   * - 閾ｪ辟ｶ迚ｩ (grass / dirt / gravel / fallen_leaves) 縺ｯ逍台ｼｼ繝ｩ繝ｳ繝繝驟咲ｽｮ縺ｧ
   *   蛟句挨縺ｮ闡峨・遏ｳ繝ｻ闕峨ｒ謨｣繧峨☆
   * - 莠ｺ蟾･迚ｩ (wood_deck / tile / stone_pavement) 縺ｯ蛟句挨繧ｿ繧､繝ｫ繧偵す繧ｧ繝ｼ繝・ぅ繝ｳ繧ｰ
   * - 陦苓ｷｯ (asphalt / concrete) 縺ｯ邏ｰ縺九＞鬪ｨ譚舌ｄ繝偵ン繧呈緒縺・
   *
   * 笘・繧ｭ繝｣繝・す繝･: 蜷・ち繧､繝ｫ縺ｯ繝上ャ繧ｷ繝･繝吶・繧ｹ縺ｧ豎ｺ螳夊ｫ也噪縺ｪ縺ｮ縺ｧ縲∽ｸ蠎ｦ險育ｮ励＠縺溘ｉ
   *   蜷後§邨先棡縺悟ｸｸ縺ｫ蠕励ｉ繧後ｋ縲ょ・蝗槭↓蜈ｨ instance 繧・Float32Array 縺ｸ辟ｼ縺崎ｾｼ縺ｿ縲・
   *   莉･蠕後・ buf.set() 縺ｧ繧ｳ繝斐・縺吶ｋ縺縺・(豈弱ヵ繝ｬ繝ｼ繝縺ｮ蜀崎ｨ育ｮ励ｒ逵∫払)縲・
   *   繧ｭ繝｣繝・す繝･繧ｭ繝ｼ縺ｯ (type, x, y, w, h)縲ゅち繧､繝ｫ隴伜挨蟄舌→縺励※蜊∝・縲・
   */
  private groundTileCache = new Map<string, Float32Array>();

  private drawGroundTile(buf: Float32Array, idx: number, tile: GroundTile): number {
    const key = `${tile.type}|${tile.x}|${tile.y}|${tile.w}|${tile.h}`;
    let cached = this.groundTileCache.get(key);
    if (!cached) {
      // 蛻晏屓: 蜊∝・螟ｧ縺阪＞荳譎ゅヰ繝・ヵ繧｡縺ｫ譖ｸ縺崎ｾｼ繧薙〒縺九ｉ蠢・ｦ√し繧､繧ｺ縺ｫ slice
      const TEMP_MAX_INSTANCES = 64;
      const temp = new Float32Array(TEMP_MAX_INSTANCES * INST_F);
      const count = this._computeGroundTileInstances(temp, 0, tile);
      cached = temp.slice(0, count * INST_F);
      this.groundTileCache.set(key, cached);
    }
    // 繧ｭ繝｣繝・す繝･貂医∩: buf 縺ｮ idx 菴咲ｽｮ縺ｫ縺ｾ繧九＃縺ｨ繧ｳ繝斐・
    buf.set(cached, idx * INST_F);
    return cached.length / INST_F;
  }

  /** 螳滄圀縺ｮ繧ｿ繧､繝ｫ謠冗判繝ｭ繧ｸ繝・け (繧ｭ繝｣繝・す繝･繝溘せ譎ゅ・縺ｿ蜻ｼ縺ｰ繧後ｋ) */
  private _computeGroundTileInstances(buf: Float32Array, idx: number, tile: GroundTile): number {
    let n = idx;
    const { type, x, y, w, h } = tile;
    // 繧ｻ繝ｫ菴咲ｽｮ縺ｧ豎ｺ縺ｾ繧・deterministic hash (蜷後§繧ｿ繧､繝ｫ縺ｯ蟶ｸ縺ｫ蜷後§繝代ち繝ｼ繝ｳ)
    const hash = (i: number) => {
      const v = Math.sin(x * 12.9898 + y * 78.233 + i * 37.719) * 43758.5453;
      return v - Math.floor(v);
    };

    switch (type) {
      // 笏笏笏 遏ｳ逡ｳ: 荳崎ｦ丞援縺ｪ遏ｳ繧偵が繝輔そ繝・ヨ縺励※荳ｦ縺ｹ繧・笏笏笏笏笏笏笏笏笏笏笏
      case 'stone_pavement': {
        // 逶ｮ蝨ｰ縺ｮ證励＞荳句慍
        writeInst(buf, n++, x, y, w, h, 0.32, 0.28, 0.22, 1);
        // 4 陦・ﾃ・3 蛻励∬｡後＃縺ｨ縺ｫ蜊翫そ繝ｫ蛻・が繝輔そ繝・ヨ (辣臥逃遨阪∩)
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
            // 遏ｳ縺ｮ荳願ｾｺ繝上う繝ｩ繧､繝・
            writeInst(buf, n++, sx, sy - sh * 0.32, sw * 0.80, 0.4,
              Math.min(1, shade + 0.15), Math.min(1, shade + 0.10), shade * 0.90, 0.7);
          }
        }
        break;
      }

      // 笏笏笏 闃・ 螟壽焚縺ｮ闕峨・闡峨ｒ繝ｩ繝ｳ繝繝驟咲ｽｮ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'grass': {
        // 繝吶・繧ｹ (荳ｭ髢鍋噪縺ｪ邱・
        writeInst(buf, n++, x, y, w, h, 0.30, 0.52, 0.20, 1);
        // 譛画ｩ溽噪縺ｪ濶ｲ繝繝ｩ繝代ャ繝・2 縺､ (蜀・
        writeInst(buf, n++, x - w * 0.22, y - h * 0.18, w * 0.5, h * 0.4,
          0.24, 0.44, 0.16, 0.65, 0, 1);
        writeInst(buf, n++, x + w * 0.20, y + h * 0.22, w * 0.5, h * 0.4,
          0.38, 0.62, 0.24, 0.60, 0, 1);
        // 闕峨・闡峨ｒ 28 譫壹Λ繝ｳ繝繝謨｣蟶・(邵ｦ縺ｫ邏ｰ髟ｷ縺・聞譁ｹ蠖｢)
        for (let i = 0; i < 28; i++) {
          const bx = x + (hash(i * 2) - 0.5) * w * 0.92;
          const by = y + (hash(i * 2 + 1) - 0.5) * h * 0.92;
          const bright = 0.55 + hash(i * 3 + 7) * 0.25;
          writeInst(buf, n++, bx, by, 0.6, 1.8,
            0.30 + bright * 0.08, bright + 0.15, 0.18, 0.9);
        }
        // 蟆上＆縺ｪ逋ｽ闃ｱ 2 縺､ (繧｢繧ｯ繧ｻ繝ｳ繝・
        for (let i = 0; i < 2; i++) {
          const bx = x + (hash(100 + i) - 0.5) * w * 0.85;
          const by = y + (hash(200 + i) - 0.5) * h * 0.85;
          writeInst(buf, n++, bx, by, 1.3, 1.3, 0.96, 0.93, 0.82, 0.9, 0, 1);
        }
        break;
      }

      // 笏笏笏 蝨・ 譛画ｩ溽噪縺ｪ濶ｲ繝悶Ο繝・+ 蟆冗浹 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'dirt': {
        writeInst(buf, n++, x, y, w, h, 0.46, 0.33, 0.20, 1);
        // 譟斐ｉ縺九＞濶ｲ繝悶Ο繝・8 蛟・(蜀・ｽ｢縺ｧ譛画ｩ滓─)
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
        // 蟆冗浹 6 蛟・(蜀・
        for (let i = 0; i < 6; i++) {
          const bx = x + (hash(100 + i * 2) - 0.5) * w * 0.9;
          const by = y + (hash(101 + i * 2) - 0.5) * h * 0.9;
          const sz = 1.3 + hash(200 + i) * 0.9;
          writeInst(buf, n++, bx, by, sz, sz,
            0.58 + hash(300 + i) * 0.1, 0.52, 0.44, 0.85, 0, 1);
        }
        break;
      }

      // 笏笏笏 邇臥ょ茜: 螟ｧ驥上・荳ｸ縺・浹縺ｧ謨ｷ縺崎ｩｰ繧√ｋ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'gravel': {
        // 繝吶・繧ｹ
        writeInst(buf, n++, x, y, w, h, 0.60, 0.56, 0.48, 1);
        // 譫ｯ螻ｱ豌ｴ縺ｮ遐らｴ・(阮・＞豌ｴ蟷ｳ邱・3 譛ｬ)
        writeInst(buf, n++, x, y - h * 0.28, w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        writeInst(buf, n++, x, y,              w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        writeInst(buf, n++, x, y + h * 0.28,   w * 0.92, 0.5, 0.78, 0.72, 0.62, 0.45);
        // 遐ょ茜縺ｮ遏ｳ繧呈聞縺崎ｩｰ繧√ｋ (32 蛟九∝､ｧ蟆上＆縺ｾ縺悶∪)
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

      // 笏笏笏 關ｽ縺｡闡・ 蝨溘・荳翫↓螟夊牡縺ｮ邏・痩繧呈淵繧峨☆ 笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'fallen_leaves': {
        // 貉ｿ縺｣縺溷悄縺ｮ荳句慍
        writeInst(buf, n++, x, y, w, h, 0.36, 0.26, 0.14, 1);
        // 荳句慍縺ｮ證励＞濶ｲ繝繝ｩ 2 縺､
        writeInst(buf, n++, x - w * 0.2, y + h * 0.1, w * 0.5, h * 0.4,
          0.28, 0.20, 0.10, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.15, y - h * 0.2, w * 0.4, h * 0.3,
          0.42, 0.30, 0.16, 0.45, 0, 1);
        // 邏・痩繧・26 譫壽淵繧峨☆ (8 濶ｲ繝代Ξ繝・ヨ)
        const leafPalette: Array<[number, number, number]> = [
          [0.90, 0.30, 0.10], // 魄ｮ邏・
          [0.95, 0.68, 0.15], // 鮟・
          [0.82, 0.26, 0.08], // 豺ｱ邏・
          [0.88, 0.52, 0.18], // 讖・
          [0.72, 0.40, 0.14], // 闌ｶ
          [0.96, 0.58, 0.20], // 譏取ｩ・
          [0.60, 0.22, 0.06], // 證礼ｴ・
          [0.85, 0.78, 0.22], // 鮟・ｷ・
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

      // 笏笏笏 繧｢繧ｹ繝輔ぃ繝ｫ繝・ 鬪ｨ譚舌せ繝壹ャ繧ｯ繝ｫ + 繧ｿ繧､繝､霍｡ 笏笏笏笏笏笏笏笏笏笏
      case 'asphalt': {
        // 繝吶・繧ｹ
        writeInst(buf, n++, x, y, w, h, 0.28, 0.28, 0.30, 1);
        // 證励＞繝繝ｩ 2 縺､ (蜀・〒譛画ｩ滓─)
        writeInst(buf, n++, x - w * 0.15, y - h * 0.1, w * 0.45, h * 0.35,
          0.22, 0.22, 0.24, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.1, y + h * 0.2, w * 0.4, h * 0.3,
          0.33, 0.33, 0.35, 0.45, 0, 1);
        // 鬪ｨ譚・(螟壽焚縺ｮ譏手牡蟆上ラ繝・ヨ)
        for (let i = 0; i < 26; i++) {
          const bx = x + (hash(i * 6) - 0.5) * w * 0.95;
          const by = y + (hash(i * 6 + 1) - 0.5) * h * 0.95;
          const shade = 0.42 + hash(i * 6 + 2) * 0.18;
          writeInst(buf, n++, bx, by, 0.8, 0.8,
            shade, shade, shade + 0.03, 0.80, 0, 1);
        }
        // 繧ｿ繧､繝､霍｡ 2 譛ｬ (縺・▲縺吶ｉ)
        writeInst(buf, n++, x - w * 0.18, y - h * 0.05, w * 0.72, 0.5, 0.20, 0.20, 0.22, 0.6);
        writeInst(buf, n++, x + w * 0.12, y + h * 0.12, w * 0.60, 0.5, 0.20, 0.20, 0.22, 0.6);
        break;
      }

      // 笏笏笏 繧ｦ繝・ラ繝・ャ繧ｭ: 譚ｿ逶ｮ + 驥・+ 遽 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'wood_deck': {
        // 譚ｿ髢薙・證励＞逶ｮ蝨ｰ
        writeInst(buf, n++, x, y, w, h, 0.24, 0.14, 0.05, 1);
        // 5 譫壹・譚ｿ (譏取囓莠､莠・
        const plankCount = 5;
        const plankW = w / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const px = x - w / 2 + (i + 0.5) * plankW;
          const shade = i % 2 === 0 ? 1.0 : 0.85;
          writeInst(buf, n++, px, y, plankW * 0.92, h * 0.96,
            0.62 * shade, 0.42 * shade, 0.22 * shade, 1);
          // 阮・＞譛ｨ逶ｮ邱・(邵ｦ 2 譛ｬ)
          writeInst(buf, n++, px - plankW * 0.2, y, 0.3, h * 0.9,
            0.42 * shade, 0.26 * shade, 0.12 * shade, 0.55);
          writeInst(buf, n++, px + plankW * 0.15, y, 0.3, h * 0.9,
            0.42 * shade, 0.26 * shade, 0.12 * shade, 0.55);
          // 驥・2 譛ｬ (譚ｿ縺ｮ荳｡遶ｯ)
          writeInst(buf, n++, px, y - h * 0.40, 0.7, 0.7, 0.18, 0.14, 0.08, 1, 0, 1);
          writeInst(buf, n++, px, y + h * 0.40, 0.7, 0.7, 0.18, 0.14, 0.08, 1, 0, 1);
        }
        // 遽 2 縺､繧偵Λ繝ｳ繝繝菴咲ｽｮ縺ｫ
        for (let i = 0; i < 2; i++) {
          const kx = x + (hash(10 + i) - 0.5) * w * 0.75;
          const ky = y + (hash(20 + i) - 0.5) * h * 0.75;
          writeInst(buf, n++, kx, ky, 2.4, 1.6, 0.35, 0.20, 0.08, 0.85, 0, 1);
          writeInst(buf, n++, kx, ky, 1.2, 0.8, 0.20, 0.10, 0.04, 0.9, 0, 1);
        }
        break;
      }

      // 笏笏笏 繧ｿ繧､繝ｫ: 蛟句挨繧ｿ繧､繝ｫ繧偵す繧ｧ繝ｼ繝・ぅ繝ｳ繧ｰ 笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'tile': {
        // 逶ｮ蝨ｰ縺ｮ證励＞荳句慍
        writeInst(buf, n++, x, y, w, h, 0.44, 0.42, 0.38, 1);
        // 4ﾃ・ 縺ｮ繧ｿ繧､繝ｫ縲∝推繧ｿ繧､繝ｫ繧貞句挨繧ｷ繧ｧ繝ｼ繝・
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
            // 繧ｿ繧､繝ｫ縺ｮ荳願ｾｺ繝上う繝ｩ繧､繝・
            writeInst(buf, n++, tx, ty - tileH * 0.34, tileW * 0.80, 0.4,
              Math.min(1, shade + 0.15), Math.min(1, shade + 0.12), shade, 0.7);
          }
        }
        break;
      }

      // 笏笏笏 菴丞ｮ・｡励う繝ｳ繧ｿ繝ｼ繝ｭ繝・く繝ｳ繧ｰ: 謗ｧ縺医ａ縺ｫ貂ｩ縺九∩縺ｮ縺ゅｋ繧ｰ繝ｬ繝ｼ邉ｻ繝壹う繝舌・ 笏笏笏
      case 'residential_tile': {
        // 逶ｮ蝨ｰ縺ｮ證励＞繧ｰ繝ｬ繝ｼ荳句慍 (蜒・°縺ｫ證冶牡)
        writeInst(buf, n++, x, y, w, h, 0.45, 0.42, 0.38, 1);
        // 繧ｿ繧､繝ｫ繧ｵ繧､繧ｺ繧呈ｦゅ・荳螳・(竕・0ﾃ・8) 縺ｫ菫昴▽繧医≧縲√ヱ繝・メ縺ｮ繧ｵ繧､繧ｺ縺九ｉ
        // 陦梧焚繝ｻ蛻玲焚繧堤ｮ怜・ (阮・＞蟶ｯ縺ｧ繧ゅち繧､繝ｫ縺梧ｽｰ繧後↑縺・ｈ縺・↓縺吶ｋ)
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
            // 繧ｰ繝ｬ繝ｼ繧偵・繝ｼ繧ｹ縺ｫ縲√ヶ繝ｭ繝・け縺斐→縺ｫ蟆代＠縺壹▽證冶牡繝ｻ蟇定牡縺ｸ謖ｯ縺｣縺ｦ
            // 譌･蟶ｸ菴丞ｮ・｡励・繝壹う繝舌・諢・(邨ｱ荳諢・+ 蠕ｮ螯吶↑蛟区ｧ) 繧貞・縺・
            const shade = 0.70 + hv * 0.10;
            const hueBias = hash(r * 7 + c * 13);
            const warm  = (hueBias - 0.35) * 0.05;    // 證冶牡縲懊ｏ縺壹°縺ｫ蟇定牡
            writeInst(buf, n++, bx, by, bw * 0.92, bh * 0.84,
              shade + warm, shade + warm * 0.3, shade - warm * 0.6, 1);
            // 繝悶Ο繝・け荳願ｾｺ縺ｮ譏弱ｋ縺・ｸ・(遶倶ｽ捺─)
            writeInst(buf, n++, bx, by - bh * 0.34, bw * 0.82, 0.35,
              Math.min(1, shade + 0.15 + warm), Math.min(1, shade + 0.13), Math.min(1, shade + 0.09), 0.75);
          }
        }
        break;
      }

      // 笏笏笏 繧ｳ繝ｳ繧ｯ繝ｪ繝ｼ繝・ 荳榊ｮ壼ｽ｢縺ｮ繝偵ン + 繧ｷ繝・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
      case 'concrete': {
        // 蠕ｮ螯吶↓繝繝ｩ縺ｮ縺ゅｋ荳句慍
        writeInst(buf, n++, x, y, w, h, 0.68, 0.66, 0.62, 1);
        // 譛画ｩ溽噪縺ｪ濶ｲ縺ｮ豺｡縺・Β繝ｩ 2 縺､ (蜀・
        writeInst(buf, n++, x - w * 0.22, y - h * 0.15, w * 0.5, h * 0.4,
          0.72, 0.70, 0.66, 0.6, 0, 1);
        writeInst(buf, n++, x + w * 0.18, y + h * 0.2, w * 0.5, h * 0.4,
          0.60, 0.58, 0.54, 0.55, 0, 1);
        // 繧ｨ繧ｭ繧ｹ繝代Φ繧ｷ繝ｧ繝ｳ繧ｸ繝ｧ繧､繝ｳ繝・(豌ｴ蟷ｳ逶ｴ邱・2 譛ｬ)
        writeInst(buf, n++, x, y - h * 0.33, w, 0.6, 0.38, 0.36, 0.32, 0.75);
        writeInst(buf, n++, x, y + h * 0.33, w, 0.6, 0.38, 0.36, 0.32, 0.75);
        // 荳榊ｮ壼ｽ｢縺ｮ繝偵ン (謚倥ｌ邱夐｢ｨ縺ｮ 3 繧ｻ繧ｰ繝｡繝ｳ繝・
        writeInst(buf, n++, x - w * 0.32, y - h * 0.08, w * 0.28, 0.4,
          0.30, 0.28, 0.24, 0.85);
        writeInst(buf, n++, x - w * 0.05, y + h * 0.02, w * 0.26, 0.4,
          0.30, 0.28, 0.24, 0.85);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.12, w * 0.22, 0.4,
          0.30, 0.28, 0.24, 0.85);
        // 豐ｹ繧ｷ繝・1 縺､ (蜀・ｽ｢)
        writeInst(buf, n++, x + w * 0.28, y - h * 0.25, w * 0.14, h * 0.1,
          0.48, 0.44, 0.38, 0.7, 0, 1);
        break;
      }
      case 'steel_plate': {
        // 驩・攸: 證励＞轣ｰ濶ｲ + 邵樊攸繝代ち繝ｼ繝ｳ
        writeInst(buf, n++, x, y, w, h, 0.38, 0.38, 0.42, 1);
        for (let i = -2; i <= 2; i++) {
          writeInst(buf, n++, x + i * w * 0.18, y - h * 0.25, 1.2, 6, 0.48, 0.48, 0.52, 0.75, 0.5);
          writeInst(buf, n++, x + i * w * 0.18, y + h * 0.15, 1.2, 6, 0.48, 0.48, 0.52, 0.75, 0.5);
        }
        // 繝ｪ繝吶ャ繝・
        for (let cx of [-0.4, 0, 0.4]) {
          for (let cy of [-0.4, 0.4]) {
            writeInst(buf, n++, x + cx * w, y + cy * h, 1.5, 1.5, 0.22, 0.22, 0.25, 0.9, 0, 1);
          }
        }
        // 繧ｵ繝・
        writeInst(buf, n++, x - w * 0.30, y + h * 0.30, w * 0.18, h * 0.12, 0.55, 0.32, 0.20, 0.55, 0, 1);
        break;
      }
      case 'oil_stained_concrete': {
        // 豐ｹ豎壹ｌ繧ｳ繝ｳ繧ｯ繝ｪ: 證励＞繝吶・繧ｹ + 陌ｹ濶ｲ縺ｮ豐ｹ繧ｷ繝溯､・焚
        writeInst(buf, n++, x, y, w, h, 0.45, 0.44, 0.42, 1);
        writeInst(buf, n++, x - w * 0.20, y, w * 0.45, h * 0.30, 0.32, 0.28, 0.24, 0.85, 0, 1);
        writeInst(buf, n++, x + w * 0.25, y - h * 0.10, w * 0.30, h * 0.22, 0.22, 0.22, 0.20, 0.75, 0, 1);
        // 陌ｹ蜈画ｲ｢
        writeInst(buf, n++, x - w * 0.20, y, w * 0.30, h * 0.15, 0.50, 0.35, 0.55, 0.35, 0, 1);
        writeInst(buf, n++, x + w * 0.25, y - h * 0.10, w * 0.18, h * 0.10, 0.40, 0.50, 0.35, 0.35, 0, 1);
        // 繧ｨ繧ｭ繧ｹ繝代Φ繧ｷ繝ｧ繝ｳ繧ｸ繝ｧ繧､繝ｳ繝・
        writeInst(buf, n++, x, y - h * 0.35, w, 0.6, 0.25, 0.22, 0.18, 0.8);
        writeInst(buf, n++, x, y + h * 0.35, w, 0.6, 0.25, 0.22, 0.18, 0.8);
        // 繧ｿ繧､繝､逞・
        writeInst(buf, n++, x - w * 0.05, y, w * 0.75, 1, 0.18, 0.16, 0.14, 0.7);
        break;
      }
      case 'moss': {
        // 闍泌慍: 豺ｱ邱代・繝ｼ繧ｹ + 縺ｵ繧上▲縺ｨ譏弱ｋ縺・桝轤ｹ
        writeInst(buf, n++, x, y, w, h, 0.25, 0.42, 0.25, 1);
        writeInst(buf, n++, x - w * 0.25, y - h * 0.18, w * 0.40, h * 0.32, 0.35, 0.55, 0.30, 0.7, 0, 1);
        writeInst(buf, n++, x + w * 0.22, y + h * 0.22, w * 0.45, h * 0.35, 0.32, 0.50, 0.28, 0.7, 0, 1);
        // 豼・ｷ第桝轤ｹ
        for (let i = 0; i < 5; i++) {
          const dx = ((i * 97) % 80 - 40) / 100;
          const dy = ((i * 53) % 80 - 40) / 100;
          writeInst(buf, n++, x + dx * w, y + dy * h, 3, 2, 0.18, 0.32, 0.18, 0.85, 0, 1);
        }
        // 遏ｳ or 謨ｷ遏ｳ讓｡讒・
        writeInst(buf, n++, x - w * 0.10, y, 6, 4, 0.52, 0.50, 0.46, 0.65, 0, 1);
        writeInst(buf, n++, x + w * 0.30, y - h * 0.10, 5, 3.5, 0.55, 0.52, 0.48, 0.55, 0, 1);
        break;
      }
      case 'red_carpet': {
        // 襍､邨ｨ豈ｯ: 豼・＞襍､ + 驥代・繝輔Μ繝ｳ繧ｸ
        writeInst(buf, n++, x, y, w, h, 0.62, 0.15, 0.18, 1);
        // 荳ｭ螟ｮ繝代ち繝ｼ繝ｳ (闖ｱ蠖｢縺｣縺ｽ縺・Δ繝√・繝・
        writeInst(buf, n++, x, y, w * 0.75, h * 0.6, 0.72, 0.22, 0.22, 0.85);
        writeInst(buf, n++, x, y, w * 0.30, h * 0.30, 0.88, 0.70, 0.25, 0.75, 0, 1);
        // 驥代・邵∝叙繧・
        writeInst(buf, n++, x, y - h * 0.40, w, 1.5, 0.90, 0.72, 0.25, 0.85);
        writeInst(buf, n++, x, y + h * 0.40, w, 1.5, 0.90, 0.72, 0.25, 0.85);
        // 繝輔Μ繝ｳ繧ｸ
        for (let i = -4; i <= 4; i++) {
          writeInst(buf, n++, x + i * w * 0.1, y - h * 0.46, 0.4, 2, 0.95, 0.80, 0.30, 0.9);
          writeInst(buf, n++, x + i * w * 0.1, y + h * 0.46, 0.4, 2, 0.95, 0.80, 0.30, 0.9);
        }
        break;
      }
      case 'checker_tile': {
        // 繝√ぉ繝・き繝ｼ繧ｿ繧､繝ｫ: 2x3 縺ｮ逋ｽ髱偵・繧ｹ
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
        // 繧ｰ繝ｩ繧ｦ繝・
        writeInst(buf, n++, x, y, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y - h * 0.17, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y + h * 0.17, w * 0.98, 0.5, 0.55, 0.52, 0.48, 0.75);
        writeInst(buf, n++, x, y, 0.5, h * 0.95, 0.55, 0.52, 0.48, 0.75);
        break;
      }
      case 'harbor_water': {
        // 貂ｯ縺ｮ豬ｷ: 豺ｱ縺・ｴｺ縺ｮ繝吶・繧ｹ + 螻､迥ｶ縺ｮ濶ｲ繝繝ｩ + 豕｢邏・+ 繝上う繝ｩ繧､繝・
        writeInst(buf, n++, x, y, w, h, 0.10, 0.22, 0.36, 1);
        // 譏取囓縺ｮ讓ｪ邵・(豺ｱ豬・・螻､)
        writeInst(buf, n++, x, y - h * 0.30, w, h * 0.22, 0.14, 0.28, 0.42, 0.7);
        writeInst(buf, n++, x, y + h * 0.18, w, h * 0.26, 0.08, 0.18, 0.30, 0.75);
        // 邱鷹搨縺ｮ繝代ャ繝・(闍斐・阯ｻ)
        writeInst(buf, n++, x - w * 0.28, y + h * 0.10, w * 0.32, h * 0.22, 0.14, 0.34, 0.38, 0.55, 0, 1);
        writeInst(buf, n++, x + w * 0.22, y - h * 0.18, w * 0.28, h * 0.18, 0.18, 0.38, 0.44, 0.55, 0, 1);
        // 豕｢邏・(讓ｪ縺ｫ莨ｸ縺ｳ繧狗ｴｰ縺・ワ繧､繝ｩ繧､繝・5 譛ｬ)
        for (let i = 0; i < 5; i++) {
          const ry = y + (hash(i * 11) - 0.5) * h * 0.85;
          const rx = x + (hash(i * 11 + 3) - 0.5) * w * 0.4;
          writeInst(buf, n++, rx, ry, w * (0.22 + hash(i * 11 + 5) * 0.25), 0.6, 0.58, 0.76, 0.88, 0.72);
        }
        // 邏ｰ縺九＞逋ｽ豕｢ (7 蛟・
        for (let i = 0; i < 7; i++) {
          const bx = x + (hash(i * 7) - 0.5) * w * 0.9;
          const by = y + (hash(i * 7 + 1) - 0.5) * h * 0.88;
          writeInst(buf, n++, bx, by, 1.8 + hash(i * 7 + 2) * 1.4, 0.5, 0.85, 0.92, 0.98, 0.85);
        }
        break;
      }
      case 'rust_deck': {
        // 骭・・縺滄≡螻槭ョ繝・く: 闌ｶ隍占牡繝吶・繧ｹ + 邵ｦ譚ｿ逶ｮ + 骭・・譁・
        writeInst(buf, n++, x, y, w, h, 0.42, 0.26, 0.16, 1);
        // 4 譫壹・邵ｦ譚ｿ (譏取囓)
        const plankCount = 4;
        const plankW = w / plankCount;
        for (let i = 0; i < plankCount; i++) {
          const px = x - w / 2 + (i + 0.5) * plankW;
          const shade = i % 2 === 0 ? 1.0 : 0.85;
          writeInst(buf, n++, px, y, plankW * 0.92, h * 0.94,
            0.48 * shade, 0.30 * shade, 0.18 * shade, 1);
          // 譚ｿ逶ｮ (邵ｦ 1 譛ｬ)
          writeInst(buf, n++, px - plankW * 0.15, y, 0.3, h * 0.9,
            0.30 * shade, 0.18 * shade, 0.08 * shade, 0.6);
          // 遶ｯ縺ｮ繝ｪ繝吶ャ繝・
          writeInst(buf, n++, px, y - h * 0.40, 0.9, 0.9, 0.20, 0.14, 0.08, 1, 0, 1);
          writeInst(buf, n++, px, y + h * 0.40, 0.9, 0.9, 0.20, 0.14, 0.08, 1, 0, 1);
        }
        // 骭・桝 (6 縺､縲∵ｩ呵ｵ､縺ｮ荳崎ｦ丞援縺ｪ螟ｧ縺阪＆)
        for (let i = 0; i < 6; i++) {
          const rx = x + (hash(i * 3) - 0.5) * w * 0.82;
          const ry = y + (hash(i * 3 + 1) - 0.5) * h * 0.82;
          const sz = 2.2 + hash(i * 3 + 2) * 2.6;
          writeInst(buf, n++, rx, ry, sz, sz * 0.7, 0.60, 0.32, 0.14, 0.78, 0, 1);
        }
        // 豼・＞豐ｹ繧ｷ繝・1 縺､
        writeInst(buf, n++, x - w * 0.22, y + h * 0.12, w * 0.18, h * 0.12, 0.18, 0.12, 0.08, 0.7, 0, 1);
        break;
      }
      case 'hazard_stripe': {
        // 隴ｦ蜻翫せ繝医Λ繧､繝・ 鮟・・繝ｼ繧ｹ + 鮟偵・譁懊ａ繧ｹ繝医Λ繧､繝・
        writeInst(buf, n++, x, y, w, h, 0.92, 0.78, 0.12, 1);
        // 譁懊ａ繧ｹ繝医Λ繧､繝励ｒ 6 譛ｬ縲∬ｧ貞ｺｦ 0.6rad (~34ﾂｰ)
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
        // 荳願ｾｺ縺ｮ豼・＞繝ｩ繧､繝ｳ (譫)
        writeInst(buf, n++, x, y - h * 0.45, w * 0.98, 0.7, 0.14, 0.12, 0.10, 0.9);
        writeInst(buf, n++, x, y + h * 0.45, w * 0.98, 0.7, 0.14, 0.12, 0.10, 0.9);
        // 鞫ｩ閠・(譏弱ｋ縺・逃繧・2 縺､)
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

    // 荳企Κ繧ｾ繝ｼ繝ｳ: HILLTOP莉･荳翫・繝√Ε繝ｳ繧ｯ閭梧勹縺瑚ｦ・≧縺ｾ縺ｧ蛻晄悄濶ｲ縺ｧ蝓九ａ繧・
    const topFill = Math.max(C.WORLD_MAX_Y, this.camera.top + 50);
    writeInst(buf, n++, 0, (topFill + htLow)/2, W, topFill - htLow, zrR, zrG, zrB, 1);
    const maTop = C.MAIN_STREET_Y + C.MAIN_STREET_H/2 + C.SIDEWALK_H;
    gf(htLow, maTop, zrR, zrG, zrB);
    const loTop = C.LOWER_STREET_Y + C.LOWER_STREET_H/2 + C.SIDEWALK_H;
    gf(maLow, loTop, zcR, zcG, zcB);
    const rvTop = C.RIVERSIDE_STREET_Y + C.RIVERSIDE_STREET_H/2 + C.SIDEWALK_H;
    gf(loLow, rvTop, zvR, zvG, zvB);
    gf(rvLow, C.WORLD_MIN_Y, zsR, zsG, zsB);

    // 笏笏 蛻晄悄驛ｽ蟶ゅそ繝ｫ蝨ｰ髱｢ (繧ｾ繝ｼ繝ｳ bg 縺ｮ荳翫・％霍ｯ縺ｮ荳・ 笏笏笏笏笏笏笏笏笏笏
    for (const tile of this.initialCityGrounds) {
      n += this.drawGroundTile(buf, n, tile);
    }

    // 蝮ゅ→繝輔Μ繝・ヱ繝ｼ譟ｱ縺ｯ fillSlopes / fillFlippers 縺ｧ隨ｬ 2 繝代せ縺ｫ謠冗判縺吶ｋ
    // (驕楢ｷｯ繝ｻ蟒ｺ迚ｩ縺ｫ隕・ｏ繧後↑縺・ｈ縺・怙蜑埼擇縺ｫ蜃ｺ縺・
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
     * 1 譛ｬ縺ｮ讓ｪ驕楢ｷｯ繧ｻ繧ｰ繝｡繝ｳ繝医ｒ謠冗判 (xMin/xMax 縺ｧ驛ｨ蛻・ｹ・ｯｾ蠢・縲・
     * 遶ｯ轤ｹ縺御ｸ也阜螢√↑繧画ｭｩ驕・邵∫浹縺ｯ蜈ｨ蟷・・Κ蛻・ｹ・↑繧・xMin..xMax 縺ｮ遽・峇縺ｮ縺ｿ縲・
     */
    const drawHRoad = (cy: number, h: number, xMin: number, xMax: number, cls: RoadClass = 'street') => {
      const segW = xMax - xMin;
      const segCX = (xMin + xMax) / 2;
      const swH = cls === 'avenue' ? 6 : 4;
      const swTop = cy + h/2 + swH/2;
      const swBot = cy - h/2 - swH/2;

      // 讀肴ｽ蟶ｯ (segment 蜀・・縺ｿ)
      writeInst(buf, n++, segCX, swTop + swH/2 + 1.5, segW, 3, plR, plG, plB, 1);
      writeInst(buf, n++, segCX, swBot - swH/2 - 1.5, segW, 3, plR, plG, plB, 1);
      // 豁ｩ驕・
      writeInst(buf, n++, segCX, swTop, segW, swH, sr, sg, sb, 1);
      writeInst(buf, n++, segCX, swBot, segW, swH, sr, sg, sb, 1);
      // 闊苓｣・ヱ繧ｿ繝ｼ繝ｳ
      for (let x = Math.ceil(xMin/12)*12; x <= xMax; x += 12) {
        writeInst(buf, n++, x, swTop, 1, swH, pvR, pvG, pvB, pvA);
        writeInst(buf, n++, x, swBot, 1, swH, pvR, pvG, pvB, pvA);
      }
      // 邵∫浹
      writeInst(buf, n++, segCX, cy + h/2 + 0.5, segW, 1, cbR, cbG, cbB, 1);
      writeInst(buf, n++, segCX, cy - h/2 - 0.5, segW, 1, cbR, cbG, cbB, 1);
      // 驕楢ｷｯ譛ｬ菴・
      writeInst(buf, n++, segCX, cy, segW, h, rr, rg, rb, 1);
      // 荳ｭ螟ｮ邱・
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
      // 繝槭Φ繝帙・繝ｫ
      for (let x = Math.ceil(xMin/55)*55; x <= xMax - 10; x += 55) {
        writeInst(buf, n++, x, cy, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
      // 遶ｯ轤ｹ縺御ｸ也阜螢√〒縺ｪ縺・ｴ蜷医・陲句ｰ剰ｷｯ繝槭・繧ｫ繝ｼ
      if (xMin > C.WORLD_MIN_X + 1) {
        writeInst(buf, n++, xMin + 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
      if (xMax < C.WORLD_MAX_X - 1) {
        writeInst(buf, n++, xMax - 1, cy, 2, h, cbR, cbG, cbB, 1);
      }
    };

    /**
     * 1 譛ｬ縺ｮ邵ｦ驕楢ｷｯ繧ｻ繧ｰ繝｡繝ｳ繝医ｒ謠冗判 (yMin/yMax 縺ｧ驛ｨ蛻・ｫ倥＆蟇ｾ蠢・縲・
     */
    const drawVRoad = (cx: number, w: number, yMin: number, yMax: number, cls: RoadClass = 'street') => {
      const segH = yMax - yMin;
      const segCY = (yMin + yMax) / 2;
      const swW = cls === 'avenue' ? 6 : 4;
      // 邵ｦ驕楢ｷｯ縺ｯ蟾ｦ蜿ｳ縺ｫ豁ｩ驕・
      writeInst(buf, n++, cx - w/2 - swW/2, segCY, swW, segH, sr, sg, sb, 1);
      writeInst(buf, n++, cx + w/2 + swW/2, segCY, swW, segH, sr, sg, sb, 1);
      // 邵∫浹
      writeInst(buf, n++, cx - w/2 - 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      writeInst(buf, n++, cx + w/2 + 0.5, segCY, 1, segH, cbR, cbG, cbB, 1);
      // 驕楢ｷｯ譛ｬ菴・
      writeInst(buf, n++, cx, segCY, w, segH, rr, rg, rb, 1);
      // 荳ｭ螟ｮ遐ｴ邱・
      for (let y = Math.ceil(yMin/14)*14; y <= yMax - 10; y += 14) {
        writeInst(buf, n++, cx, y + 5, 1.2, 8, 0.95, 0.95, 0.95, 0.55);
      }
      // 繝槭Φ繝帙・繝ｫ
      for (let y = Math.ceil(yMin/55)*55; y <= yMax - 10; y += 55) {
        writeInst(buf, n++, cx, y, 4, 4, mhR, mhG, mhB, 1, 0, 1);
      }
    };

    // 蛻晄悄驛ｽ蟶ゅ・驕楢ｷｯ繝・・繧ｿ繧・grid 縺九ｉ蜿門ｾ励＠縺ｦ謠冗判
    const initialRoadData = getInitialCityRoadData();
    for (const r of initialRoadData.horizontalRoads) {
      drawHRoad(r.cy, r.h, r.xMin, r.xMax, r.cls);
    }
    for (const r of initialRoadData.verticalRoads) {
      drawVRoad(r.cx, r.w, r.yMin, r.yMax, r.cls);
    }

    // 笏笏笏 繝ｪ繝舌・繧ｵ繧､繝・= 蟾・笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏笏
    const [rvcR,rvcG,rvcB] = C.RIVER_COLOR;
    const [rvlR,rvlG,rvlB,rvlA] = C.RIVER_LIGHT;
    const [rvbR,rvbG,rvbB] = C.RIVER_BANK;
    const [brR,brG,brB] = C.BRIDGE_COLOR;
    const [brlR,brlG,brlB] = C.BRIDGE_RAIL_COLOR;
    const drawRiver = (cy: number, h: number) => {
      const bankH = 3;
      // 荳雁ｲｸ (驕頑ｭｩ驕・
      writeInst(buf, n++, 0, cy + h/2 + bankH/2, W, bankH, rvbR, rvbG, rvbB, 1);
      // 荳句ｲｸ
      writeInst(buf, n++, 0, cy - h/2 - bankH/2, W, bankH, rvbR, rvbG, rvbB, 1);
      // 蟾晄悽菴・
      writeInst(buf, n++, 0, cy, W, h, rvcR, rvcG, rvcB, 1);
      // 豕｢邏・(2-3 譛ｬ縺ｮ譏弱ｋ縺・ｨｪ邱・
      writeInst(buf, n++, 0, cy + 2, W, 0.8, rvlR, rvlG, rvlB, rvlA);
      writeInst(buf, n++, 0, cy - 2, W, 0.8, rvlR, rvlG, rvlB, rvlA);
      // 讖・(霍ｯ蝨ｰ縺ｨ蜷後§ X 蠎ｧ讓吶↓ 2 譛ｬ)
      for (const bx of [C.ALLEY_1_X, C.ALLEY_2_X]) {
        writeInst(buf, n++, bx, cy, C.ALLEY_WIDTH + 4, h + bankH * 2 + 2, brR, brG, brB, 1);
        // 谺・ｹｲ
        writeInst(buf, n++, bx, cy + h/2 + bankH + 1, C.ALLEY_WIDTH + 4, 1, brlR, brlG, brlB, 1);
        writeInst(buf, n++, bx, cy - h/2 - bankH - 1, C.ALLEY_WIDTH + 4, 1, brlR, brlG, brlB, 1);
      }
    };
    drawRiver(C.RIVERSIDE_STREET_Y, C.RIVERSIDE_STREET_H);

    // 蛛ｴ螢√・荳企Κ繧ｬ繧､繝・ 繧ｫ繝｡繝ｩ霑ｽ蠕難ｼ医せ繧ｯ繝ｪ繝ｼ繝ｳ蝗ｺ螳夲ｼ・
    const cy = this.camera.y;
    writeInst(buf, n++, C.WORLD_MIN_X + 2, cy, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, C.WORLD_MAX_X - 2, cy, 4, C.WORLD_MAX_Y * 2, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, cy + C.WORLD_MAX_Y - 42, W, 4, WC, WC, WC+0.05, 1);
    writeInst(buf, n++, 0, cy + C.WORLD_MAX_Y - 82, W, 2, 0.1, 0.1, 0.2, 0.5);
    return n - start;
  }

  /** 繝√Ε繝ｳ繧ｯ逕ｱ譚･縺ｮ閭梧勹繝ｻ驕楢ｷｯ繧呈緒逕ｻ (grid-based, 繧ｹ繝・・繧ｸ蛻･繝代Ξ繝・ヨ) */
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

      // 繝√Ε繝ｳ繧ｯ閭梧勹
      writeInst(buf, n++, 0, baseY + C.CHUNK_HEIGHT / 2, W, C.CHUNK_HEIGHT, bgR, bgG, bgB, 1);
      // 繧ｻ繝ｫ蝨ｰ髱｢ (閭梧勹縺ｮ荳翫・％霍ｯ縺ｮ荳・
      for (const tile of chunk.grounds) {
        n += this.drawGroundTile(buf, n, tile);
      }

      // 豌ｴ蟷ｳ驕楢ｷｯ
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

      // 蝙ら峩驕楢ｷｯ
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

  /** 蜈ｬ蝨偵・鬧占ｻ雁ｴ縺ｪ縺ｩ縺ｮ迚ｹ谿翫お繝ｪ繧｢蝨ｰ髱｢繧呈緒逕ｻ */
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
          // 邱大慍繝吶・繧ｹ
          writeInst(buf, n++, 0, area.y, W, area.h, pgR, pgG, pgB, 1);
          // 蜻ｨ蝗ｲ縺ｮ菴取惠蟶ｯ・域ｿ・＞繧√・邱托ｼ・
          writeInst(buf, n++, 0, area.y + area.h / 2 - 4, W, 8,  pgR * 0.82, pgG * 0.82, pgB * 0.72, 1);
          writeInst(buf, n++, 0, area.y - area.h / 2 + 4, W, 8,  pgR * 0.82, pgG * 0.82, pgB * 0.72, 1);
          // 驕頑ｭｩ驕難ｼ域ｰｴ蟷ｳ・・
          writeInst(buf, n++, 0, area.y, W, 4, ppR, ppG, ppB, 0.75);
          // 驕頑ｭｩ驕難ｼ育ｸｦ繝ｻ霍ｯ蝨ｰ菴咲ｽｮ・・
          writeInst(buf, n++, C.ALLEY_1_X, area.y, 5, area.h, ppR, ppG, ppB, 0.55);
          writeInst(buf, n++, C.ALLEY_2_X, area.y, 5, area.h, ppR, ppG, ppB, 0.55);
          // 荳ｭ螟ｮ蠎・ｴ・亥ｰ代＠譏弱ｋ縺・・蠖｢・・
          writeInst(buf, n++, 0, area.y, 22, 22, pgR * 1.12, pgG * 1.08, pgB * 0.95, 0.7, 0, 1);
        } else if (area.type === 'parking_lot') {
          // 繧｢繧ｹ繝輔ぃ繝ｫ繝医・繝ｼ繧ｹ
          writeInst(buf, n++, 0, area.y, W, area.h, plR, plG, plB, 1);
          // 荳ｭ螟ｮ莉募・繧顔ｷ・
          writeInst(buf, n++, 0, area.y, W, 2, lnR, lnG, lnB, 0.6);
          // 邵ｦ縺ｮ鬧占ｻ翫せ繝壹・繧ｹ蛹ｺ蛻・ｊ邱・
          for (let xi = -168; xi <= 168; xi += 26) {
            writeInst(buf, n++, xi, area.y, 1.5, area.h * 0.88, lnR, lnG, lnB, 0.45);
          }
          // 鬧占ｻ雁ｴ蜈･繧雁哨繝槭・繧ｯ
          writeInst(buf, n++, C.ALLEY_1_X, area.y, C.ALLEY_WIDTH + 2, area.h, plR * 1.05, plG * 1.05, plB * 1.08, 1);
          writeInst(buf, n++, C.ALLEY_2_X, area.y, C.ALLEY_WIDTH + 2, area.h, plR * 1.05, plG * 1.05, plB * 1.08, 1);
        }
      }
    }
    return n - start;
  }

  /**
   * 邵ｦ霍ｯ蝨ｰ繧貞・閭梧勹縺ｮ荳翫↓謠冗判縺励∝・讓ｪ驕楢ｷｯ縺ｨ縺ｮ莠､蟾ｮ轤ｹ繧ｹ繝医Λ繧､繝励ｒ逕滓・縺吶ｋ縲・
   * chunk閭梧勹縺ｮ蠕後↓蜻ｼ縺ｶ縺薙→縺ｧ霍ｯ蝨ｰ縺悟沂繧ゅｌ縺ｪ縺・・
   */
  /** 莠､蟾ｮ轤ｹ謠冗判 (grid-based): 蛻晄悄驛ｽ蟶・+ 蜈ｨ繝√Ε繝ｳ繧ｯ縺ｮ莠､蟾ｮ轤ｹ繧呈緒逕ｻ */
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

    // 蛻晄悄驛ｽ蟶ゅ・莠､蟾ｮ轤ｹ (繝・ヵ繧ｩ繝ｫ繝・Stage 1 繝代Ξ繝・ヨ)
    const initialRoadData = getInitialCityRoadData();
    const defaultPal = C.getStagePalette(0);
    for (const ix of initialRoadData.intersections) {
      drawOne(ix, defaultPal.intersection, defaultPal.crosswalk);
    }
    // 繝√Ε繝ｳ繧ｯ縺ｮ莠､蟾ｮ轤ｹ (繧ｹ繝・・繧ｸ蛻･繝代Ξ繝・ヨ)
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

  /** 蝮・(蟾ｦ蜿ｳ) 繧呈怙蜑埼擇繝ｬ繧､繝､縺ｧ謠冗判縲ょｻｺ迚ｩ繝ｻ驕楢ｷｯ縺ｫ隕・ｏ繧後↑縺・ｈ縺・ｬｬ 2 繝代せ縺ｧ蜻ｼ縺ｶ */
  private fillSlopes(buf: Float32Array, start: number): number {
    let n = start;
    const sL = this.getSlopeL(), sR = this.getSlopeR();
    // 譛ｬ菴・(邱・
    writeInst(buf, n++, sL.cx, sL.cy, sL.hw * 2, sL.hh * 2, 0.38, 0.58, 0.30, 1, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy, sR.hw * 2, sR.hh * 2, 0.38, 0.58, 0.30, 1, sR.angle);
    // 荳願ｾｺ繝上う繝ｩ繧､繝・(繝懊・繝ｫ縺梧ｻ代ｋ髱｢繧堤､ｺ縺吶∫區繝ｩ繧､繝ｳ)
    writeInst(buf, n++, sL.cx, sL.cy + sL.hh - 0.5, sL.hw * 2, 1.2, 0.92, 0.92, 0.88, 0.85, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy + sR.hh - 0.5, sR.hw * 2, 1.2, 0.92, 0.92, 0.88, 0.85, sR.angle);
    // 荳玖ｾｺ縺ｮ蠖ｱ (遶倶ｽ捺─縲∵囓)
    writeInst(buf, n++, sL.cx, sL.cy - sL.hh + 0.5, sL.hw * 2, 1.0, 0.22, 0.34, 0.18, 0.85, sL.angle);
    writeInst(buf, n++, sR.cx, sR.cy - sR.hh + 0.5, sR.hw * 2, 1.0, 0.22, 0.34, 0.18, 0.85, sR.angle);
    return n - start;
  }

  private fillFlippers(buf: Float32Array, start: number): number {
    let n = start;
    const N = 10;             // 荳芽ｧ貞ｽ｢霑台ｼｼ縺ｮ蛻・牡謨ｰ
    const BASE_THICK = 12;    // 譬ｹ譛ｬ縺ｮ螟ｪ縺・
    const TIP_THICK  = 1.5;   // 蜈育ｫｯ縺ｮ螟ｪ縺・(縺ｻ縺ｼ轤ｹ)
    for (const fl of this.flippers) {
      const isFlash = this.juice.isBallFlashing();
      const gr = isFlash ? 1 : 0.60, gg = isFlash ? 1 : 0.60, gb = isFlash ? 1 : 0.70;
      const hw = C.FLIPPER_W / 2;
      const cosA = Math.cos(fl.angle), sinA = Math.sin(fl.angle);
      const segLen = C.FLIPPER_W / N;
      // 蜷・そ繧ｰ繝｡繝ｳ繝医ｒ邱壼ｽ｢繝・・繝代・ + 荳企擇 (ball-facing 髱｢) 縺ｯ逶ｴ邱壹・縺ｾ縺ｾ菫昴▽縲・
      // 荳企擇縺檎峩邱・= 蜷・そ繧ｰ繝｡繝ｳ繝医・ top edge 縺悟酔荳縺ｮ local Y 縺ｫ縺ゅｋ
      // 竊・繧ｻ繧ｰ繝｡繝ｳ繝井ｸｭ蠢・ｒ local Y 譁ｹ蜷代↓ (BASE_THICK - segH) / 2 縺縺代が繝輔そ繝・ヨ縲・
      // 蟾ｦ繝輔Μ繝・ヱ繝ｼ縺ｮ local +Y 譁ｹ蜷代′ world 荳雁髄縺阪∝承縺ｯ騾・↑縺ｮ縺ｧ isLeft 縺ｧ隨ｦ蜿ｷ繧貞渚霆｢縲・
      const yDir = fl.isLeft ? 1 : -1;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;
        const segH = BASE_THICK * (1 - t) + TIP_THICK * t;
        const localX = -hw + (i + 0.5) * segLen;
        const localY = ((BASE_THICK - segH) / 2) * yDir;
        // local (x, y) 繧・fl.angle 縺ｧ蝗櫁ｻ｢縺励※ world 菴咲ｽｮ縺ｫ
        const segCx = fl.cx + localX * cosA - localY * sinA;
        const segCy = fl.cy + localX * sinA + localY * cosA;
        writeInst(buf, n++, segCx, segCy, segLen * 1.04, segH, gr, gg, gb, 1, fl.angle);
      }
      // 蜈育ｫｯ縺ｮ蟆上＆縺ｪ蜊雁・遯∬ｵｷ (迚ｩ逅・・縺ｨ蜷御ｽ咲ｽｮ繝ｻ髱呎ｭ｢蝗ｺ螳・
      const restRadV = (fl.isLeft ? C.FLIPPER_REST_DEG : (180 - C.FLIPPER_REST_DEG)) * Math.PI / 180;
      const rCosV = Math.cos(restRadV), rSinV = Math.sin(restRadV);
      const bumpLocalY_v = 5 * yDir;                 // 縺輔ｉ縺ｫ 1 px 荳九￡繧・
      const bumpLocalX_v = C.FLIPPER_W + 1;          // 遯∬ｵｷ縺ｮ蜀・・遶ｯ縺梧怙蜈育ｫｯ
      const bumpVX = fl.pivotX + bumpLocalX_v * rCosV - bumpLocalY_v * rSinV;
      const bumpVY = fl.pivotY + bumpLocalX_v * rSinV + bumpLocalY_v * rCosV;
      writeInst(buf, n++, bumpVX, bumpVY, 2, 2, gr * 0.9, gg * 0.9, gb * 1.05, 1, 0, 1);
      // 繝斐・繝・ヨ縺ｮ逶ｮ蜊ｰ (繧ｪ繝ｬ繝ｳ繧ｸ縺ｮ蟆丈ｸｸ)
      writeInst(buf, n++, fl.pivotX, fl.pivotY, 6, 6, 0.90, 0.55, 0.20, 1, 0, 1);
    }
    return n - start;
  }

  /** 繧ｷ繝ｳ繝励Ν縺ｪ繝懊・繝ｫ謠冗判縲・
   * - 譛ｬ菴・ 蜊倩牡縺ｮ蜀・(繧ｹ繧ｯ繝ｭ繝ｼ繝ｫ騾溷ｺｦ縺ｧ orange 竊・red 竊・blue 縺ｫ螟牙喧)
   * - 繝医Ξ繧､繝ｫ: 谿句ワ縺ｮ蜀・
   * - 蝗櫁ｻ｢繝槭・繧ｫ繝ｼ: 蟇ｾ遘ｰ縺ｮ證励ラ繝・ヨ 2 轤ｹ (ball.angle 縺ｧ蝗櫁ｻ｢)
   * - 繝上う繝ｩ繧､繝・ 蟾ｦ荳翫・逋ｽ縺・ｰ丞・ (遶倶ｽ捺─)
   * 蠖薙◆繧雁愛螳壹・蜊雁ｾ・BALL_RADIUS 縺ｮ蜀・・
   */
  private fillBall(buf: Float32Array, start: number): number {
    const b = this.ball;
    if (!b.active) return 0;
    let n = start;
    const isFl = this.juice.isBallFlashing();
    const radius = C.BALL_RADIUS;

    // 繝懊・繝ｫ濶ｲ: 蝗ｺ螳壹・繧ｪ繝ｬ繝ｳ繧ｸ
    const cr = 1.0, cg = 0.55, cb = 0.05;

    // 繝医Ξ繧､繝ｫ
    for (let ti = 0; ti < C.TRAIL_LEN; ti++) {
      const age = ti / C.TRAIL_LEN;
      const idx = (b.trailHead - 1 - ti + C.TRAIL_LEN) % C.TRAIL_LEN;
      const tx = b.trail[idx * 2], ty = b.trail[idx * 2 + 1];
      const alpha = (1 - age) * 0.45;
      const sz = radius * 2 * (1 - age * 0.6);
      writeInst(buf, n++, tx, ty, sz, sz, cr, cg * (1 - age * 0.5), cb, alpha, 0, 1);
    }

    // 譛ｬ菴・
    const r = isFl ? 1 : cr, g = isFl ? 1 : cg, bv = isFl ? 1 : cb;
    writeInst(buf, n++, b.x, b.y, radius * 2, radius * 2, r, g, bv, 1, 0, 1);

    // 蝗櫁ｻ｢繝槭・繧ｫ繝ｼ: 蟇ｾ遘ｰ縺ｮ證励ラ繝・ヨ 2 轤ｹ (ball.angle 縺ｧ蝗櫁ｻ｢縺励∬ｻ｢縺後ｊ繧定ｦ冶ｦ壼喧)
    const markerR = radius * 0.55;
    const mx1 = b.x + Math.cos(b.angle) * markerR;
    const my1 = b.y + Math.sin(b.angle) * markerR;
    const mx2 = b.x - Math.cos(b.angle) * markerR;
    const my2 = b.y - Math.sin(b.angle) * markerR;
    const mR = r * 0.35, mG = g * 0.35, mB = bv * 0.35;
    writeInst(buf, n++, mx1, my1, radius * 0.45, radius * 0.45, mR, mG, mB, 0.85, 0, 1);
    writeInst(buf, n++, mx2, my2, radius * 0.45, radius * 0.45, mR, mG, mB, 0.85, 0, 1);

    // 繝上う繝ｩ繧､繝・(蝗ｺ螳壹∝ｷｦ荳雁ｯ・ｊ縺ｮ逋ｽ縺・ｰ丞・縺ｧ遶倶ｽ捺─)
    writeInst(buf, n++, b.x - radius * 0.35, b.y + radius * 0.35,
      radius * 0.5, radius * 0.5,
      Math.min(1, r + 0.35), Math.min(1, g + 0.35), Math.min(1, bv + 0.35),
      0.7, 0, 1);

    return n - start;
  }
}
