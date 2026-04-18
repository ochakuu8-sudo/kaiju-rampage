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
  /** 最後に貫通中の建物: その AABB から抜けるまで再衝突しない */
  lastPiercedBld: BuildingData | null = null;
  // トレイル: リングバッファ
  trail: Float32Array = new Float32Array(C.TRAIL_LEN * 2);
  trailHead = 0;
  // 回転 (描画用): 速度から計算される見た目の回転角と角速度
  angle = 0;
  angularVel = 0;

  /** ボール半径 (固定) */
  get radius(): number {
    return C.BALL_RADIUS;
  }

  reset() {
    this.x = C.BALL_START_X;
    this.y = C.BALL_START_Y;
    // 鉄球感: 初速はほぼ 0 にして、重力と坂で自然に転がり出す
    this.vx = 0.5;
    this.vy = 0;
    this.active = true;
    this.lastPiercedBld = null;
    this.angle = 0;
    this.angularVel = 0;
    for (let i = 0; i < C.TRAIL_LEN; i++) {
      this.trail[i * 2]     = C.BALL_START_X;
      this.trail[i * 2 + 1] = C.BALL_START_Y;
    }
    this.trailHead = 0;
  }

  /** ゲーム全体のリセット (再スタート時に使用) */
  fullReset() {
    this.reset();
  }

  /** カメラY位置を考慮したリセット */
  resetWithCamera(cameraY: number) {
    this.reset();
    this.y = cameraY + C.BALL_START_Y;
    for (let i = 0; i < C.TRAIL_LEN; i++) {
      this.trail[i * 2]     = C.BALL_START_X;
      this.trail[i * 2 + 1] = this.y;
    }
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

// 横ビュー ファサード色パレット
const FACADE_RESIDENTIAL: ReadonlyArray<readonly [number,number,number]> = [
  [0.72, 0.42, 0.30], // テラコッタ煉瓦
  [0.80, 0.75, 0.62], // クリーム石
  [0.58, 0.65, 0.72], // ブルーグレー板張り
  [0.65, 0.52, 0.38], // 茶色木材
];
const FACADE_COMMERCIAL: ReadonlyArray<readonly [number,number,number]> = [
  [0.80, 0.76, 0.68], // 砂岩
  [0.62, 0.68, 0.60], // グリーングレー
  [0.70, 0.65, 0.75], // ラベンダー石
];
const FACADE_OFFICE: ReadonlyArray<readonly [number,number,number]> = [
  [0.60, 0.68, 0.80], // スチールブルー
  [0.68, 0.68, 0.65], // コンクリート
  [0.52, 0.65, 0.75], // ガラスブルー
];
const BUILDING_TYPE_COLORS: Partial<Record<C.BuildingSize, readonly [number,number,number]>> = {
  // オリジナル
  school:         [0.85, 0.82, 0.60],
  hospital:       [0.90, 0.90, 0.92],
  temple:         [0.52, 0.30, 0.20],
  parking:        [0.68, 0.68, 0.65],
  // 1-A 住宅系
  mansion:        [0.92, 0.88, 0.78],
  greenhouse:     [0.75, 0.90, 0.84],
  daycare:        [0.92, 0.80, 0.42],
  clinic:         [0.88, 0.92, 0.95],
  shrine:         [0.60, 0.25, 0.20],
  // 1-B 商業系
  cafe:           [0.78, 0.58, 0.38],
  bakery:         [0.90, 0.78, 0.52],
  supermarket:    [0.62, 0.88, 0.52],
  karaoke:        [0.82, 0.28, 0.75],
  pachinko:       [0.88, 0.72, 0.08],
  game_center:    [0.25, 0.52, 0.88],
  pharmacy:       [0.88, 0.95, 0.90],
  // 1-C 公共系
  bank:           [0.82, 0.76, 0.62],
  post_office:    [0.92, 0.68, 0.25],
  library:        [0.62, 0.56, 0.48],
  museum:         [0.80, 0.74, 0.64],
  city_hall:      [0.85, 0.82, 0.72],
  fire_station:   [0.80, 0.22, 0.18],
  police_station: [0.32, 0.42, 0.70],
  train_station:  [0.72, 0.68, 0.60],
  movie_theater:  [0.70, 0.22, 0.55],
  gas_station:    [0.90, 0.88, 0.20],
  // 1-D ランドマーク
  clock_tower:    [0.78, 0.72, 0.58],
  radio_tower:    [0.62, 0.64, 0.68],
  ferris_wheel:   [0.52, 0.72, 0.90],
  stadium:        [0.64, 0.60, 0.56],
  water_tower:      [0.68, 0.60, 0.50],
  // 特大施設
  department_store: [0.92, 0.82, 0.60],
  // Stage 2 夜街 (派手な色で区別)
  snack:            [0.95, 0.52, 0.68],  // ピンク
  love_hotel:       [0.72, 0.38, 0.82],  // 紫
  business_hotel:   [0.88, 0.86, 0.82],  // 白
  mahjong_parlor:   [0.42, 0.58, 0.38],  // 緑
  club:             [0.22, 0.18, 0.22],  // 黒
  capsule_hotel:    [0.78, 0.82, 0.90],  // 薄水色
  // Stage 3 和風
  kura:             [0.95, 0.92, 0.85],  // 白壁 (なまこ壁)
  machiya:          [0.72, 0.58, 0.42],  // 木の色
  onsen_inn:        [0.52, 0.36, 0.28],  // 濃い木 + 煙突
  tahoto:           [0.78, 0.32, 0.22],  // 朱塗り
  dojo:             [0.42, 0.32, 0.22],  // 濃い木 (武道場)
  wagashi:          [0.92, 0.82, 0.68],  // 淡いベージュ
  kimono_shop:      [0.62, 0.42, 0.58],  // 紫 (呉服)
  sushi_ya:         [0.85, 0.72, 0.52],  // 木 + 白のれん
  bungalow:         [0.78, 0.72, 0.58],  // 黄ベージュ (平屋)
  duplex:           [0.88, 0.82, 0.72],  // 明るいクリーム (2 世帯)
  // Stage 5 フィナーレ: ファンタジー城 (テーマパーク風)
  castle:           [0.96, 0.90, 0.92],  // 淡いピンクの漆喰
};

// 建物種別からファサードパレットを選択するヘルパー
function getBuildingPalette(size: C.BuildingSize): ReadonlyArray<readonly [number,number,number]> {
  if (BUILDING_TYPE_COLORS[size]) return [BUILDING_TYPE_COLORS[size]!];
  const residential: C.BuildingSize[] = [
    'house', 'apartment', 'apartment_tall', 'townhouse', 'mansion', 'shed', 'garage',
  ];
  const commercial: C.BuildingSize[] = [
    'shop', 'convenience', 'restaurant', 'cafe', 'bakery', 'bookstore',
    'florist', 'ramen', 'izakaya', 'laundromat',
  ];
  if (residential.includes(size)) return FACADE_RESIDENTIAL;
  if (commercial.includes(size)) return FACADE_COMMERCIAL;
  return FACADE_OFFICE;
}

export interface BuildingData {
  x: number;    // 左端
  y: number;    // 下端（接地点）
  w: number;    // 横幅（当たり判定 & 描画）
  h: number;    // 高さ（当たり判定 & 描画）
  buildingH: number; // 建物高さ（= h、互換用）
  maxHp: number;
  hp: number;
  score: number;
  humanMin: number;
  humanMax: number;
  active: boolean;
  destroyTimer: number;
  flashTimer: number;
  baseColor: readonly [number,number,number];
  size: C.BuildingSize;
  chunkKey: number;  // -1=初期都市, >=0=チャンクID
  // ウェーブシステム拡張
  rubbleTimer: number;  // > 0 かつ active=false: 瓦礫を描画
  spawnTimer: number;   // > 0: スポーンアニメーション進行中
  blockIdx: number;     // 所属ブロックID (0〜14)
  generation: number;   // 再建回数
}

export class BuildingManager {
  buildings: BuildingData[] = [];
  private chunkMap: Map<number, BuildingData[]> = new Map();

  load(defs: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx?: number }>) {
    this.buildings = [];
    this.chunkMap.clear();
    this.chunkMap.set(-1, []);
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      const palette = getBuildingPalette(d.size);
      const pi = Math.abs(Math.floor(d.x * 7 + d.y * 13)) % palette.length;
      const baseColor = palette[pi];
      const buildW = def.w;
      const buildH = def.h; // 横ビュー: 本来の建物高さ
      this.buildings.push({
        x: d.x - buildW / 2,
        y: d.y,
        w: buildW, h: buildH,
        buildingH: def.h,
        maxHp: def.hp, hp: def.hp,
        score: def.score,
        humanMin: def.humanMin,
        humanMax: def.humanMax,
        active: true,
        destroyTimer: 0,
        flashTimer: 0,
        rubbleTimer: 0,
        spawnTimer: 0,
        blockIdx: d.blockIdx ?? 0,
        generation: 0,
        baseColor,
        size: d.size,
        chunkKey: -1,
      });
      this.chunkMap.get(-1)!.push(this.buildings[this.buildings.length - 1]);
    }
  }

  /** チャンクの建物を追加ロード (blockIdx = chunkId) */
  loadChunk(defs: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx?: number }>) {
    const chunkId = defs.length > 0 ? (defs[0].blockIdx ?? -1) : -1;
    if (!this.chunkMap.has(chunkId)) this.chunkMap.set(chunkId, []);
    const bucket = this.chunkMap.get(chunkId)!;
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      const palette = getBuildingPalette(d.size);
      const pi = Math.abs(Math.floor(d.x * 7 + d.y * 13)) % palette.length;
      const b: BuildingData = {
        x: d.x - def.w / 2,
        y: d.y,
        w: def.w, h: def.h,
        buildingH: def.h,
        maxHp: def.hp, hp: def.hp,
        score: def.score,
        humanMin: def.humanMin,
        humanMax: def.humanMax,
        active: true,
        destroyTimer: 0,
        flashTimer: 0,
        rubbleTimer: 0,
        spawnTimer: 0,
        blockIdx: d.blockIdx ?? -1,
        generation: 0,
        baseColor: palette[pi],
        size: d.size,
        chunkKey: chunkId,
      };
      this.buildings.push(b);
      bucket.push(b);
    }
  }

  /** チャンクの建物を一括削除 */
  unloadChunk(chunkId: number) {
    this.buildings = this.buildings.filter(b => b.blockIdx !== chunkId);
    this.chunkMap.delete(chunkId);
  }

  allDestroyed(): boolean {
    return this.buildings.every(b => !b.active);
  }

  /** GOAL チャンクのお城がまだ生きているか (size='castle') */
  isGoalCastleAlive(): boolean {
    for (const b of this.buildings) {
      if (b.size === 'castle' && b.active) return true;
    }
    return false;
  }

  /** GOAL チャンクのお城が存在するか (破壊済みでも、非破壊でも true) */
  hasGoalCastle(): boolean {
    for (const b of this.buildings) {
      if (b.size === 'castle') return true;
    }
    return false;
  }

  /** 新しい建物を追加（再建時）。非アクティブスロットを再利用 */
  addBuilding(centerX: number, baseY: number, size: C.BuildingSize, blockIdx: number, generation: number) {
    const def = C.BUILDING_DEFS[size];
    const palette = getBuildingPalette(size);
    const pi = Math.abs(Math.floor(centerX * 7 + baseY * 13)) % palette.length;
    const baseColor = palette[pi];

    const newBld: BuildingData = {
      x: centerX - def.w / 2,
      y: baseY,
      w: def.w, h: def.h,
      buildingH: def.h,
      maxHp: def.hp, hp: def.hp,
      score: def.score,
      humanMin: def.humanMin,
      humanMax: def.humanMax,
      active: true,
      destroyTimer: 0,
      flashTimer: 0,
      rubbleTimer: 0,
      spawnTimer: C.SPAWN_ANIM_DURATION,
      blockIdx,
      generation,
      baseColor,
      size,
      chunkKey: -1,  // 再建は常に初期都市バケット
    };

    // 非アクティブ & 瓦礫なしのスロットを再利用
    const freeIdx = this.buildings.findIndex(b => !b.active && b.rubbleTimer <= 0);
    if (freeIdx >= 0) {
      this.buildings[freeIdx] = newBld;
    } else {
      this.buildings.push(newBld);
    }
    // chunkMap に追加
    if (!this.chunkMap.has(-1)) this.chunkMap.set(-1, []);
    this.chunkMap.get(-1)!.push(newBld);
  }

  update(dt: number) {
    for (const b of this.buildings) {
      if (b.flashTimer > 0) b.flashTimer -= dt;
      if (b.spawnTimer > 0) b.spawnTimer = Math.max(0, b.spawnTimer - dt);
      if (b.destroyTimer > 0) {
        b.destroyTimer -= dt;
        if (b.destroyTimer <= 0) b.active = false;
      }
      if (b.rubbleTimer > 0) b.rubbleTimer = Math.max(0, b.rubbleTimer - dt);
    }
  }

  /**
   * ボールとの衝突判定
   * @returns ヒットした建物データ or null
   */
  checkBallHit(
    bx: number, by: number, br: number,
    vx: number, vy: number,
    skip: BuildingData | null = null
  ): { bld: BuildingData; newBx: number; newBy: number; newVx: number; newVy: number } | null {
    // ボールが初期都市内かチャンク内かでバケットを絞る
    const keysToCheck: number[] = [];
    if (by < C.WORLD_MAX_Y) {
      keysToCheck.push(-1);
    } else {
      const ballChunk = Math.floor((by - C.WORLD_MAX_Y) / C.CHUNK_HEIGHT);
      keysToCheck.push(ballChunk - 1, ballChunk, ballChunk + 1);
    }
    for (const key of keysToCheck) {
      const list = this.chunkMap.get(key);
      if (!list) continue;
      for (const b of list) {
        if (!b.active || b.destroyTimer > 0) continue;
        if (b === skip) continue; // 貫通中の建物は再衝突しない
        const res = resolveCircleAABB(bx, by, br, vx, vy, b.x, b.y, b.w, b.h);
        if (res) {
          return { bld: b, newBx: res[0], newBy: res[1], newVx: res[2], newVy: res[3] };
        }
      }
    }
    return null;
  }

  /** 建物にダメージを与え、破壊されたら destroyTimer & rubbleTimer セット */
  damage(b: BuildingData, dmg: number = 1): boolean {
    b.hp -= dmg;
    b.flashTimer = 0.08;
    if (b.hp <= 0) {
      b.destroyTimer = 0.2;
      b.rubbleTimer = C.RUBBLE_DURATION + 0.2; // 崩壊アニメ後も瓦礫として残る
      return true; // 破壊
    }
    return false;
  }

  /** 横ビュー: 影→ファサード→種類別ディテール */
  /**
   * 高層ビル系の窓グリッドを描画 (旧シェーダーヒューリスティクスの代替)。
   * 4×6 px 単位セルでファサードに矩形窓を並べる。建物ごとに deterministic な
   * シードを使うので、同じ建物は常に同じパターンになる。
   * - marginTop: 屋根 / 看板用の上余白
   * - marginBot: 1F エントランス用の下余白
   */
  private drawBuildingWindows(
    buf: Float32Array, n: number,
    cx: number, bot: number, bW: number, bH: number,
    cr: number, cg: number, cb: number,
    marginTop: number = 5,
    marginBot: number = 8
  ): number {
    const usableW = bW - 4;
    const usableH = bH - marginTop - marginBot;
    if (usableW < 4 || usableH < 6) return n;
    const cols = Math.max(1, Math.floor(usableW / 4));
    const rows = Math.max(1, Math.floor(usableH / 6));
    const stepX = usableW / cols;
    const stepY = usableH / rows;
    const startX = cx - usableW / 2 + stepX / 2;
    const startY = bot + marginBot + stepY / 2;
    // 建物ごと固定シード (同じ建物は常に同じ窓パターン)
    const seed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
    const winW = Math.min(2.4, stepX * 0.55);
    const winH = Math.min(3.4, stepY * 0.55);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = startX + c * stepX;
        const wy = startY + r * stepY;
        const hv = ((seed * 31 + r * 17 + c * 5) % 97) / 97;
        if (hv > 0.40) {
          // 灯っている窓 (黄色)
          const br = 0.55 + hv * 0.35;
          writeInst(buf, n++, wx, wy, winW, winH,
            0.95 * br, 0.85 * br, 0.45 * br, 1);
        } else {
          // 暗い窓 (室内消灯)
          writeInst(buf, n++, wx, wy, winW, winH,
            cr * 0.50, cg * 0.48, cb * 0.42, 1);
        }
      }
    }
    return n;
  }

  // ===== Miniature detail helpers (T-1) =====
  // 全てインスタンス数を返し、writeInst 経由で1プリミティブずつ積む。
  // 同じ建物で同じ出力になるよう、決定論的シードは呼び出し側 (cx/bot) から引く。

  /** 瓦屋根: 反り帯 + 等間隔筋。variant で棟飾りの有無を切替。 */
  private drawRoofTile(
    buf: Float32Array, n: number,
    cx: number, top: number, bW: number, bH: number,
    cr: number, cg: number, cb: number,
    variant: number = 0
  ): number {
    // 本体 (暗めの瓦)
    writeInst(buf, n++, cx, top - 3, bW + 3, 7,
      cr * 0.42, cg * 0.38, cb * 0.32, 1);
    // 反り帯 (少し明るく)
    writeInst(buf, n++, cx, top - 1, bW + 4, 1.8,
      cr * 0.55, cg * 0.48, cb * 0.40, 1);
    // 等間隔筋 (縦筋 6 本) — 瓦の縦溝
    const cols = 6;
    const stepX = (bW + 1) / cols;
    const startX = cx - (bW + 1) / 2 + stepX / 2;
    for (let c = 0; c < cols; c++) {
      writeInst(buf, n++, startX + c * stepX, top - 3, 0.6, 6,
        cr * 0.30, cg * 0.26, cb * 0.22, 0.85);
    }
    // 棟飾り (variant > 0)
    if (variant > 0) {
      writeInst(buf, n++, cx, top + 0.5, 3, 2,
        cr * 0.28, cg * 0.24, cb * 0.20, 1);
    }
    // バリ (ignore bH to keep signature stable)
    void bH;
    return n;
  }

  /** 陸屋根の屋上クラッター: 室外機 2 基 + 貯水塔 + 鉄柵。 */
  private drawFlatRoofClutter(
    buf: Float32Array, n: number,
    cx: number, top: number, bW: number, seed: number
  ): number {
    // 鉄柵 (屋上の縁取り)
    writeInst(buf, n++, cx, top - 0.5, bW, 1, 0.42, 0.42, 0.44, 0.75);
    // 室外機 2 基
    const unitW = 4.5, unitH = 3;
    writeInst(buf, n++, cx - bW * 0.25, top + unitH * 0.5, unitW, unitH, 0.72, 0.72, 0.70, 1);
    writeInst(buf, n++, cx - bW * 0.25, top + unitH * 0.5, unitW * 0.8, 0.6, 0.50, 0.50, 0.50, 1);
    writeInst(buf, n++, cx + bW * 0.15, top + unitH * 0.5, unitW, unitH, 0.70, 0.70, 0.68, 1);
    writeInst(buf, n++, cx + bW * 0.15, top + unitH * 0.5, unitW * 0.8, 0.6, 0.48, 0.48, 0.48, 1);
    // 貯水塔 (seed % 2 で有り無し)
    if ((seed & 1) === 0) {
      writeInst(buf, n++, cx + bW * 0.34, top + 4, 5, 5.5, 0.60, 0.58, 0.52, 1, 0, 1);
      writeInst(buf, n++, cx + bW * 0.34, top + 1.5, 1.2, 3, 0.40, 0.40, 0.38, 1);
    }
    return n;
  }

  /** 庇: 赤白/青白/緑白のストライプ。hueIdx で色を選択。 */
  private drawAwningStripe(
    buf: Float32Array, n: number,
    cx: number, bot: number, bW: number, bH: number,
    hueIdx: number
  ): number {
    const palette: [number, number, number][] = [
      [0.92, 0.20, 0.18], [0.18, 0.48, 0.90],
      [0.20, 0.72, 0.28], [0.90, 0.65, 0.15], [0.72, 0.28, 0.68],
    ];
    const [hr, hg, hb] = palette[hueIdx % palette.length];
    const y = bot + bH * 0.46;
    // ベース庇
    writeInst(buf, n++, cx, y, bW + 4, 3.5, 0.95, 0.95, 0.92, 0.95);
    // ストライプ 4 本
    const stripes = 4;
    const stepX = (bW + 3) / stripes;
    const startX = cx - (bW + 3) / 2 + stepX / 2;
    for (let i = 0; i < stripes; i++) {
      if ((i & 1) === 0) {
        writeInst(buf, n++, startX + i * stepX, y, stepX * 0.9, 3.2, hr, hg, hb, 0.92);
      }
    }
    return n;
  }

  /** 店舗看板: 角袖 (縦看板) / 水平帯。stacked=true で 2 段積み。 */
  private drawShopSign(
    buf: Float32Array, n: number,
    cx: number, top: number, bW: number,
    hueIdx: number, stacked: boolean = false
  ): number {
    const palette: [number, number, number][] = [
      [0.92, 0.20, 0.18], [0.90, 0.65, 0.15],
      [0.20, 0.62, 0.82], [0.72, 0.28, 0.68], [0.18, 0.62, 0.32],
    ];
    const [sr, sg, sb] = palette[hueIdx % palette.length];
    // 水平看板
    writeInst(buf, n++, cx, top - 2, bW + 1, 4.5, sr, sg, sb, 1);
    // 文字帯 (ロゴの明色線)
    writeInst(buf, n++, cx, top - 2, bW * 0.72, 1.2, 0.98, 0.96, 0.88, 0.92);
    if (stacked) {
      // 角袖 (縦看板) 右端
      writeInst(buf, n++, cx + bW * 0.42, top - 8, 3.5, 10, sr * 0.85, sg * 0.85, sb * 0.85, 1);
      writeInst(buf, n++, cx + bW * 0.42, top - 8, 2.2, 7, 0.98, 0.96, 0.88, 0.85);
    }
    return n;
  }

  /** 室外機 1 個 (壁面用)。 */
  private drawACUnit(
    buf: Float32Array, n: number,
    x: number, y: number
  ): number {
    writeInst(buf, n++, x, y, 3.5, 2.5, 0.70, 0.70, 0.68, 1);
    // 横スリット 2 本
    writeInst(buf, n++, x, y + 0.5, 3.0, 0.4, 0.45, 0.45, 0.45, 0.9);
    writeInst(buf, n++, x, y - 0.5, 3.0, 0.4, 0.45, 0.45, 0.45, 0.9);
    return n;
  }

  /** バルコニー手すり: 縦格子 + プランター。 */
  private drawBalconyRailing(
    buf: Float32Array, n: number,
    cx: number, yBand: number, bW: number
  ): number {
    // 手すり (横線)
    writeInst(buf, n++, cx, yBand, bW * 0.92, 0.6, 0.85, 0.85, 0.82, 0.9);
    writeInst(buf, n++, cx, yBand - 1.8, bW * 0.92, 0.4, 0.75, 0.75, 0.72, 0.85);
    // 縦格子 (5 本)
    const bars = 5;
    const stepX = (bW * 0.85) / bars;
    const startX = cx - (bW * 0.85) / 2 + stepX / 2;
    for (let i = 0; i < bars; i++) {
      writeInst(buf, n++, startX + i * stepX, yBand - 1, 0.4, 2.5, 0.80, 0.80, 0.78, 0.88);
    }
    // プランター (左端)
    writeInst(buf, n++, cx - bW * 0.34, yBand + 0.8, 2.5, 1.5, 0.55, 0.32, 0.20, 1);
    writeInst(buf, n++, cx - bW * 0.34, yBand + 1.8, 2.2, 1.2, 0.32, 0.68, 0.38, 0.95);
    return n;
  }

  /** 外階段: 段々 4 段。 */
  private drawStairs(
    buf: Float32Array, n: number,
    x: number, bot: number, h: number
  ): number {
    const steps = 4;
    const stepH = h / steps;
    for (let i = 0; i < steps; i++) {
      writeInst(buf, n++, x, bot + stepH * (i + 0.5), 4 + i * 0.3, stepH * 0.9,
        0.48, 0.48, 0.50, 1);
    }
    return n;
  }

  /** 軒下の提灯列: 2-5 個の小丸。 */
  private drawChouchinRow(
    buf: Float32Array, n: number,
    cx: number, y: number, bW: number, count: number
  ): number {
    count = Math.max(2, Math.min(5, count));
    const stepX = bW / count;
    const startX = cx - bW / 2 + stepX / 2;
    for (let i = 0; i < count; i++) {
      const px = startX + i * stepX;
      // 吊り紐
      writeInst(buf, n++, px, y + 1.5, 0.3, 2, 0.20, 0.15, 0.10, 0.8);
      // 提灯本体 (円)
      writeInst(buf, n++, px, y - 0.5, 3, 3.5, 0.92, 0.28, 0.18, 1, 0, 1);
      // 中央帯
      writeInst(buf, n++, px, y - 0.5, 2.5, 0.4, 0.10, 0.08, 0.05, 0.85);
    }
    return n;
  }

  /** シャッター: 溝 8 本 + 取手。 */
  private drawShutterSlats(
    buf: Float32Array, n: number,
    cx: number, y: number, bW: number, bH: number,
    cr: number, cg: number, cb: number
  ): number {
    // ベース
    writeInst(buf, n++, cx, y, bW, bH, cr * 0.72, cg * 0.72, cb * 0.72, 1);
    // 溝 (8 本)
    const slats = 8;
    const stepY = bH / slats;
    const startY = y - bH / 2 + stepY / 2;
    for (let i = 0; i < slats; i++) {
      writeInst(buf, n++, cx, startY + i * stepY, bW * 0.95, 0.3,
        cr * 0.45, cg * 0.45, cb * 0.45, 0.9);
    }
    // 取手
    writeInst(buf, n++, cx, y - bH * 0.42, bW * 0.18, 0.8, 0.30, 0.30, 0.30, 1);
    return n;
  }

  /** ドア装飾: ノブ + マット + 表札。type=0 片開き / 1 引き戸 / 2 ガラス */
  private drawDoorDetail(
    buf: Float32Array, n: number,
    cx: number, bot: number, bW: number, type: number
  ): number {
    // マット (玄関前)
    writeInst(buf, n++, cx, bot + 0.5, bW * 0.28, 1, 0.55, 0.32, 0.22, 0.85);
    // ノブ (type 0/2 のみ)
    if (type !== 1) {
      writeInst(buf, n++, cx + bW * 0.05, bot + 4.5, 0.6, 0.6, 0.92, 0.82, 0.30, 1, 0, 1);
    }
    // 表札 (小)
    writeInst(buf, n++, cx - bW * 0.12, bot + 9, 1.8, 0.8, 0.95, 0.92, 0.82, 0.95);
    return n;
  }

  /** 窓枠: 既存窓を縁取る。w/h は窓サイズ。 */
  private drawWindowFrame(
    buf: Float32Array, n: number,
    x: number, y: number, w: number, h: number
  ): number {
    // 上枠
    writeInst(buf, n++, x, y + h * 0.5, w + 0.6, 0.4, 0.32, 0.28, 0.22, 1);
    // 下枠
    writeInst(buf, n++, x, y - h * 0.5, w + 0.6, 0.4, 0.32, 0.28, 0.22, 1);
    // 縦桟
    writeInst(buf, n++, x, y, 0.3, h, 0.32, 0.28, 0.22, 0.95);
    return n;
  }

  /** 瓦屋根の反り (鬼瓦): 両端の上向きカール。 */
  private drawTileRoofCurl(
    buf: Float32Array, n: number,
    cx: number, top: number, bW: number, reverse: boolean = false
  ): number {
    const yOff = reverse ? -1.5 : 1.5;
    // 左端の反り
    writeInst(buf, n++, cx - bW * 0.5 - 1, top + yOff, 2.5, 2.5, 0.22, 0.18, 0.14, 1);
    // 右端の反り
    writeInst(buf, n++, cx + bW * 0.5 + 1, top + yOff, 2.5, 2.5, 0.22, 0.18, 0.14, 1);
    // 中央の棟飾り
    writeInst(buf, n++, cx, top + yOff + 0.8, 3, 1.5, 0.28, 0.22, 0.18, 1);
    return n;
  }

  /** 正面キャノピー + 柱 2 本。 */
  private drawEntranceCanopy(
    buf: Float32Array, n: number,
    cx: number, bot: number, bW: number
  ): number {
    // 屋根帯
    writeInst(buf, n++, cx, bot + 13, bW * 0.72, 2, 0.72, 0.68, 0.60, 0.95);
    // 柱 2 本
    writeInst(buf, n++, cx - bW * 0.30, bot + 7, 1.5, 12, 0.82, 0.78, 0.70, 1);
    writeInst(buf, n++, cx + bW * 0.30, bot + 7, 1.5, 12, 0.82, 0.78, 0.70, 1);
    // キャノピー前面
    writeInst(buf, n++, cx, bot + 12.2, bW * 0.74, 0.6, 0.55, 0.52, 0.45, 1);
    return n;
  }

  /** 壁付け自販機 (青/赤 2 種)。 */
  private drawVendingMachineInset(
    buf: Float32Array, n: number,
    x: number, y: number
  ): number {
    // 本体
    const isRed = ((Math.abs(Math.floor(x * 3 + y * 5))) & 1) === 0;
    const [cr, cg, cb] = isRed ? [0.85, 0.18, 0.18] : [0.18, 0.52, 0.85];
    writeInst(buf, n++, x, y, 3.5, 8, cr, cg, cb, 1);
    // 飲料口 (明色)
    writeInst(buf, n++, x, y + 1.5, 3.0, 3, 0.95, 0.92, 0.82, 0.92);
    // 取出口 (下)
    writeInst(buf, n++, x, y - 2.8, 3.0, 1.2, 0.20, 0.18, 0.16, 1);
    return n;
  }

  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 100;
    const camTop = cameraY + C.WORLD_MAX_Y + 100;
    for (const b of this.buildings) {
      if (b.y > camTop || b.y + b.h < camBot) continue;
      // 瓦礫フェーズ: 非アクティブだが rubbleTimer > 0
      if (!b.active && b.rubbleTimer > 0) {
        const cx = b.x + b.w / 2;
        const fade = Math.min(1, b.rubbleTimer);
        // 平たい瓦礫山
        writeInst(buf, n++, cx, b.y + 3, b.w, 6,
          b.baseColor[0] * 0.45, b.baseColor[1] * 0.40, b.baseColor[2] * 0.35, fade);
        writeInst(buf, n++, cx - b.w * 0.18, b.y + 6.5, b.w * 0.35, 4,
          b.baseColor[0] * 0.52, b.baseColor[1] * 0.48, b.baseColor[2] * 0.40, fade * 0.75);
        writeInst(buf, n++, cx + b.w * 0.22, b.y + 6, b.w * 0.28, 3,
          0.38, 0.34, 0.28, fade * 0.6);
        continue;
      }
      if (!b.active) continue;

      // スポーンアニメ (0→1) or 崩壊アニメ (1→0)
      const scale = b.destroyTimer > 0
        ? Math.max(0, b.destroyTimer / 0.2)
        : b.spawnTimer > 0
          ? 1 - (b.spawnTimer / C.SPAWN_ANIM_DURATION)
          : 1;
      const bW = b.w * scale;
      const bH = b.h * scale;
      const cx = b.x + b.w / 2;
      const cy = b.y + bH / 2;   // ファサード中心
      const top = b.y + bH;       // 屋上
      const bot = b.y;            // 接地点

      // ダメージ色計算
      let cr: number, cg: number, cb: number;
      if (b.flashTimer > 0) {
        cr = cg = cb = 1.0;
      } else {
        const dmg = 1 - b.hp / b.maxHp;
        const dk = 1 - dmg * 0.35;
        cr = Math.min(1, b.baseColor[0] * dk + dmg * 0.10);
        cg = b.baseColor[1] * dk;
        cb = b.baseColor[2] * dk;
      }

      // 影（右下オフセット）
      writeInst(buf, n++, cx + 3, cy - 3, bW, bH, 0, 0, 0, 0.18);
      // ファサード本体（GLSLが窓グリッドを担当）
      writeInst(buf, n++, cx, cy, bW, bH, cr, cg, cb, 1);

      // 種類別ファサードディテール
      switch (b.size) {
        case 'house': {
          // T-2: 瓦屋根強化
          n = this.drawRoofTile(buf, n, cx, top, bW, bH, cr, cg, cb, 1);
          // 煙突
          writeInst(buf, n++, cx + bW * 0.28, top + 2, 2, 4, cr * 0.35, cg * 0.30, cb * 0.24, 1);
          // 左右の窓 + 窓枠
          writeInst(buf, n++, cx - bW * 0.20, bot + bH * 0.52, 4, 5,
            0.78, 0.90, 0.96, 0.90);
          n = this.drawWindowFrame(buf, n, cx - bW * 0.20, bot + bH * 0.52, 4, 5);
          writeInst(buf, n++, cx + bW * 0.20, bot + bH * 0.52, 4, 5,
            0.78, 0.90, 0.96, 0.90);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.20, bot + bH * 0.52, 4, 5);
          // ドア + 装飾
          writeInst(buf, n++, cx, bot + 5, bW * 0.22, 9,
            cr * 0.42, cg * 0.34, cb * 0.25, 1);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          // 門灯 (ドア横)
          writeInst(buf, n++, cx - bW * 0.18, bot + 7, 1.2, 1.2, 0.95, 0.82, 0.30, 0.85, 0, 1);
          break;
        }
        case 'shop': {
          // 看板帯（建物ごとに色変え）
          const si = Math.abs(Math.floor(b.x * 3 + b.y)) % 5;
          // T-3: drawShopSign で看板強化
          n = this.drawShopSign(buf, n, cx, top, bW, si, false);
          // T-3: ストライプ庇
          n = this.drawAwningStripe(buf, n, cx, bot, bW, bH, si);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.72, bH * 0.38,
            0.72, 0.88, 0.96, 0.85);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.42, bW * 0.72, bH * 0.38);
          // ドア + 装飾
          writeInst(buf, n++, cx, bot + 5, bW * 0.18, 9, 0.32, 0.24, 0.18, 1);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          // T-3: 壁面自販機
          n = this.drawVendingMachineInset(buf, n, cx + bW * 0.40, bot + bH * 0.30);
          break;
        }
        case 'apartment': {
          // 窓グリッド (バルコニー帯の下に隠れる部分も含めて埋める)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 4, 12);
          // 各階バルコニー帯 (窓の上に重ねる)
          const flH = bH / 4;
          for (let i = 1; i <= 3; i++) {
            writeInst(buf, n++, cx, bot + flH * i, bW + 3, 2.5,
              Math.max(0, cr - 0.15), Math.max(0, cg - 0.15), Math.max(0, cb - 0.12), 1);
          }
          // エントランス
          writeInst(buf, n++, cx, bot + 6, bW * 0.20, 11, 0.60, 0.82, 0.92, 0.85);
          // T-2: 屋上クラッター + バルコニー手すり + 側面 AC
          const apSeed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
          n = this.drawFlatRoofClutter(buf, n, cx, top, bW, apSeed);
          for (let i = 1; i <= 3; i++) {
            n = this.drawBalconyRailing(buf, n, cx, bot + flH * i + 1.5, bW);
          }
          // 側面 AC (3 階相当)
          for (let i = 0; i < 3; i++) {
            n = this.drawACUnit(buf, n, cx + bW * 0.42, bot + flH * (i + 0.5));
          }
          break;
        }
        case 'office': {
          // 窓グリッド (ロビーより上)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 5, 16);
          // ロビーガラス
          writeInst(buf, n++, cx, bot + 7, bW * 0.48, 13, 0.60, 0.80, 0.92, 0.82);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 1.5, bW, 3, cr * 0.68, cg * 0.68, cb * 0.68, 1);
          break;
        }
        case 'tower': {
          // 窓グリッド
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 8, 18);
          // エントランス
          writeInst(buf, n++, cx, bot + 8, bW * 0.52, 15, 0.55, 0.75, 0.90, 0.80);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 2, bW + 3, 4, cr * 0.65, cg * 0.65, cb * 0.65, 1);
          // 上部セットバック（少し色違い）
          writeInst(buf, n++, cx, top - bH * 0.10, bW * 0.75, bH * 0.18,
            Math.min(1, cr * 0.90), Math.min(1, cg * 0.95), Math.min(1, cb * 1.08), 0.92);
          break;
        }
        case 'skyscraper': {
          // 窓グリッド (ロビーより上)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 5, 20);
          // アンテナ
          writeInst(buf, n++, cx, top + 9, 3, 17, cr * 0.68, cg * 0.68, cb * 0.68, 1);
          // ロビー
          writeInst(buf, n++, cx, bot + 9, bW * 0.52, 17, 0.50, 0.72, 0.90, 0.82);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 2, bW + 3, 4, cr * 0.58, cg * 0.58, cb * 0.58, 1);
          break;
        }
        case 'convenience': {
          // グリーン帯（上部）
          writeInst(buf, n++, cx, top - 4, bW, 8, 0.10, 0.55, 0.28, 1);
          // ホワイト帯
          writeInst(buf, n++, cx, top - 9.5, bW, 4, 0.95, 0.95, 0.95, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.70, bH * 0.36,
            0.70, 0.88, 0.96, 0.85);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.40, bW * 0.70, bH * 0.36);
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.18, 9, 0.28, 0.22, 0.20, 1);
          // T-3: 壁面自販機 + ポスター
          n = this.drawVendingMachineInset(buf, n, cx - bW * 0.40, bot + bH * 0.30);
          n = this.drawVendingMachineInset(buf, n, cx + bW * 0.40, bot + bH * 0.30);
          writeInst(buf, n++, cx - bW * 0.15, bot + bH * 0.58, 3, 4, 0.92, 0.35, 0.35, 0.85); // ポスター
          writeInst(buf, n++, cx + bW * 0.15, bot + bH * 0.58, 3, 4, 0.35, 0.72, 0.92, 0.85);
          // ATM スロット
          writeInst(buf, n++, cx, bot + bH * 0.70, bW * 0.15, 2, 0.25, 0.22, 0.18, 0.95);
          break;
        }
        case 'restaurant': {
          // 看板帯（暖色）
          writeInst(buf, n++, cx, top - 3.5, bW + 1, 7, 0.82, 0.28, 0.18, 1);
          // 庇
          writeInst(buf, n++, cx, bot + bH * 0.52, bW + 4, 4, 0.58, 0.18, 0.12, 0.85);
          // 窓
          writeInst(buf, n++, cx, bot + bH * 0.36, bW * 0.58, bH * 0.28,
            0.78, 0.90, 0.82, 0.82);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.36, bW * 0.58, bH * 0.28);
          // ドア + 装飾
          writeInst(buf, n++, cx, bot + 5, bW * 0.20, 9, 0.28, 0.18, 0.14, 1);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          // T-3: 提灯列 + メニュー看板
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.78, bW * 0.70, 3);
          writeInst(buf, n++, cx - bW * 0.30, bot + bH * 0.20, 2, 3, 0.25, 0.22, 0.18, 0.95); // メニュー看板 L
          writeInst(buf, n++, cx + bW * 0.30, bot + bH * 0.20, 2, 3, 0.25, 0.22, 0.18, 0.95); // メニュー看板 R
          break;
        }
        case 'school': {
          // 窓グリッド (教室の窓)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 7, 14);
          // 上部バンド
          writeInst(buf, n++, cx, top - 3, bW, 5, cr * 0.82, cg * 0.78, cb * 0.55, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 6, bW * 0.24, bH * 0.25, 0.62, 0.82, 0.94, 0.82);
          // T-4: 校旗ポール + 時計 + 屋上クラッター (プール含む)
          writeInst(buf, n++, cx - bW * 0.40, top + 8, 0.8, 16, 0.72, 0.72, 0.72, 1); // 旗竿
          writeInst(buf, n++, cx - bW * 0.40 + 3, top + 13, 5, 3, 0.85, 0.18, 0.18, 1); // 旗
          writeInst(buf, n++, cx, top - 7, 4, 4, 0.95, 0.92, 0.80, 1, 0, 1); // 時計
          writeInst(buf, n++, cx, top - 7, 2.5, 0.4, 0.15, 0.12, 0.10, 0.9);
          writeInst(buf, n++, cx, top - 7, 0.4, 2.5, 0.15, 0.12, 0.10, 0.9);
          // 屋上プール (青矩形)
          writeInst(buf, n++, cx + bW * 0.30, top + 1, bW * 0.35, 3, 0.35, 0.62, 0.82, 0.85);
          const schSeed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
          n = this.drawFlatRoofClutter(buf, n, cx - bW * 0.20, top, bW * 0.35, schSeed);
          break;
        }
        case 'hospital': {
          // 窓グリッド (病室)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 5, 16);
          // 赤十字マーク（中〜上部）
          writeInst(buf, n++, cx, bot + bH * 0.68, 4, bH * 0.32, 0.85, 0.12, 0.12, 1);
          writeInst(buf, n++, cx, bot + bH * 0.68, bW * 0.28, 4, 0.85, 0.12, 0.12, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 7, bW * 0.35, 13, 0.68, 0.88, 0.96, 0.82);
          // T-4: 正面キャノピー + 屋上クラッター + ヘリポート + 救急搬送口
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          const hspSeed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
          n = this.drawFlatRoofClutter(buf, n, cx - bW * 0.25, top, bW * 0.35, hspSeed);
          // ヘリポート (白円)
          writeInst(buf, n++, cx + bW * 0.25, top + 2, 7, 7, 0.92, 0.92, 0.88, 0.92, 0, 1);
          writeInst(buf, n++, cx + bW * 0.25, top + 2, 3.5, 1, 0.30, 0.25, 0.20, 0.9);
          writeInst(buf, n++, cx + bW * 0.25, top + 2, 1, 3.5, 0.30, 0.25, 0.20, 0.9);
          // 救急搬送口 (左下の屋根付き入口)
          writeInst(buf, n++, cx - bW * 0.45, bot + 9, 4, 1.5, 0.42, 0.38, 0.32, 0.95);
          writeInst(buf, n++, cx - bW * 0.45, bot + 5, 3, 7, 0.65, 0.85, 0.95, 0.82);
          break;
        }
        case 'temple': {
          // 庇（屋根のオーバーハング）
          writeInst(buf, n++, cx, top - 5, bW + 8, 10,
            cr * 0.50, cg * 0.45, cb * 0.35, 1);
          // 宝珠（飾り）
          writeInst(buf, n++, cx, top + 2, 5, 5, cr * 0.85, cg * 0.75, cb * 0.28, 1, 0, 1);
          // 山門
          writeInst(buf, n++, cx, bot + 6, bW * 0.30, 11,
            cr * 0.38, cg * 0.28, cb * 0.20, 1);
          // T-5: 瓦筋 + 鬼瓦 + 提灯列 + 石段 + 柱
          n = this.drawRoofTile(buf, n, cx, top - 5, bW + 8, 10, cr * 0.50, cg * 0.45, cb * 0.35, 1);
          n = this.drawTileRoofCurl(buf, n, cx, top - 5, bW + 8, false);
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.78, bW * 0.75, 5);
          // 石段
          for (let i = 0; i < 4; i++) {
            writeInst(buf, n++, cx, bot - 0.5 - i * 1.0, bW * 0.55 - i * 2.2, 1.0, 0.72, 0.68, 0.60, 0.95);
          }
          // 左右の朱塗り柱
          writeInst(buf, n++, cx - bW * 0.20, bot + 8, 1.8, 14, 0.75, 0.28, 0.18, 1);
          writeInst(buf, n++, cx + bW * 0.20, bot + 8, 1.8, 14, 0.75, 0.28, 0.18, 1);
          break;
        }
        case 'parking': {
          // 各階スラブ
          const flH = bH / 3;
          for (let i = 1; i <= 2; i++) {
            writeInst(buf, n++, cx, bot + flH * i, bW + 2, 2.5,
              cr * 0.78, cg * 0.78, cb * 0.75, 1);
          }
          // 両端柱＋中央柱
          for (const xOff of [-bW * 0.38, 0, bW * 0.38]) {
            writeInst(buf, n++, cx + xOff, cy, 3.5, bH,
              cr * 0.72, cg * 0.72, cb * 0.70, 1);
          }
          break;
        }
        // ── 1-A 住宅系 ────────────────────────────────────────────
        case 'townhouse': {
          // T-2: 瓦屋根強化
          n = this.drawRoofTile(buf, n, cx, top, bW, bH, cr, cg, cb, 0);
          // 窓×2 (枠付)
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.52, 4, 5, 0.78, 0.90, 0.96, 0.88);
          n = this.drawWindowFrame(buf, n, cx - bW * 0.22, bot + bH * 0.52, 4, 5);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.52, 4, 5, 0.78, 0.90, 0.96, 0.88);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.22, bot + bH * 0.52, 4, 5);
          // ドア + 装飾
          writeInst(buf, n++, cx, bot + 5, bW * 0.20, 9, cr * 0.40, cg * 0.32, cb * 0.24, 1);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          break;
        }
        case 'mansion': {
          // 屋根コーニス
          writeInst(buf, n++, cx, top - 3, bW + 6, 6, cr * 0.72, cg * 0.68, cb * 0.58, 1);
          // T-2: 正面キャノピー
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          // 左右対称窓
          for (const xOff of [-bW * 0.33, bW * 0.33]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.55, 5, 7, 0.68, 0.88, 0.96, 0.85);
            n = this.drawWindowFrame(buf, n, cx + xOff, bot + bH * 0.55, 5, 7);
          }
          // 屋根のアンテナ
          writeInst(buf, n++, cx + bW * 0.35, top + 5, 0.6, 8, 0.25, 0.22, 0.18, 1);
          break;
        }
        case 'garage': {
          // T-2: シャッター強化
          n = this.drawShutterSlats(buf, n, cx, bot + bH * 0.50, bW * 0.72, bH * 0.72,
            0.55, 0.57, 0.60);
          // 上部の換気窓
          writeInst(buf, n++, cx, top - 2, bW * 0.40, 2.5, 0.68, 0.82, 0.92, 0.80);
          break;
        }
        case 'shed': {
          // T-2: 瓦屋根
          n = this.drawRoofTile(buf, n, cx, top, bW, bH, cr, cg, cb, 0);
          // ドア
          writeInst(buf, n++, cx, bot + 4, bW * 0.35, 7, cr * 0.38, cg * 0.30, cb * 0.22, 1);
          writeInst(buf, n++, cx + bW * 0.08, bot + 4, 0.5, 0.5, 0.85, 0.75, 0.25, 1, 0, 1); // ノブ
          break;
        }
        case 'greenhouse': {
          // ガラス面（明るい全体）
          writeInst(buf, n++, cx, cy, bW - 2, bH - 2, 0.72, 0.95, 0.88, 0.70);
          // フレーム（縦×2）
          writeInst(buf, n++, cx - bW * 0.25, cy, 1.5, bH, cr * 0.55, cg * 0.62, cb * 0.58, 0.9);
          writeInst(buf, n++, cx + bW * 0.25, cy, 1.5, bH, cr * 0.55, cg * 0.62, cb * 0.58, 0.9);
          // T-2: 中の植物葉
          writeInst(buf, n++, cx - bW * 0.10, bot + bH * 0.35, 3, 3, 0.32, 0.72, 0.38, 0.85, 0, 1);
          writeInst(buf, n++, cx + bW * 0.12, bot + bH * 0.40, 2.5, 2.5, 0.28, 0.68, 0.35, 0.85, 0, 1);
          writeInst(buf, n++, cx, bot + bH * 0.25, 2, 2, 0.85, 0.55, 0.25, 0.9, 0, 1); // 果実
          // 屋根の反り
          writeInst(buf, n++, cx, top - 1, bW + 2, 1.2, cr * 0.62, cg * 0.68, cb * 0.64, 0.9);
          break;
        }
        case 'daycare': {
          // カラフルストライプ帯
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.95, 0.35, 0.35, 1);
          writeInst(buf, n++, cx, top - 8, bW, 3, 0.95, 0.90, 0.20, 1);
          // 玄関（丸みある）
          writeInst(buf, n++, cx, bot + 6, bW * 0.28, 11, 0.55, 0.88, 0.96, 0.85);
          // T-2: 砂場 + 風船飾り
          writeInst(buf, n++, cx - bW * 0.30, bot + 2, 4, 1.5, 0.95, 0.82, 0.38, 0.9); // 砂場
          writeInst(buf, n++, cx + bW * 0.30, bot + 2, 4, 1.5, 0.95, 0.82, 0.38, 0.9);
          // 鉄棒
          writeInst(buf, n++, cx + bW * 0.25, bot + 5, 3.5, 0.4, 0.42, 0.42, 0.45, 1);
          writeInst(buf, n++, cx + bW * 0.15, bot + 4, 0.4, 3, 0.42, 0.42, 0.45, 1);
          writeInst(buf, n++, cx + bW * 0.35, bot + 4, 0.4, 3, 0.42, 0.42, 0.45, 1);
          // 風船飾り 3 個
          writeInst(buf, n++, cx - bW * 0.35, top - 12, 1.5, 1.5, 0.92, 0.35, 0.45, 0.9, 0, 1);
          writeInst(buf, n++, cx - bW * 0.22, top - 13, 1.5, 1.5, 0.35, 0.72, 0.92, 0.9, 0, 1);
          writeInst(buf, n++, cx - bW * 0.08, top - 12, 1.5, 1.5, 0.92, 0.82, 0.35, 0.9, 0, 1);
          break;
        }
        case 'clinic': {
          // グリーン十字
          writeInst(buf, n++, cx, top - bH * 0.22, 4, bH * 0.26, 0.15, 0.72, 0.35, 1);
          writeInst(buf, n++, cx, top - bH * 0.22, bW * 0.26, 4, 0.15, 0.72, 0.35, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 6, bW * 0.34, 11, 0.65, 0.88, 0.96, 0.82);
          // T-2: 救急車駐車マーク (白十字)
          writeInst(buf, n++, cx - bW * 0.30, bot + 1.5, 4, 0.5, 0.95, 0.95, 0.92, 0.9);
          writeInst(buf, n++, cx - bW * 0.30, bot + 1.5, 0.5, 4, 0.95, 0.95, 0.92, 0.9);
          // 室外機
          n = this.drawACUnit(buf, n, cx + bW * 0.40, bot + bH * 0.35);
          break;
        }
        case 'shrine': {
          // 大きな庇（鳥居風）
          writeInst(buf, n++, cx, top - 4, bW + 10, 8, cr * 0.48, cg * 0.40, cb * 0.28, 1);
          writeInst(buf, n++, cx, top - 10, bW * 0.85, 3, cr * 0.42, cg * 0.35, cb * 0.22, 1);
          // 鈴（丸）
          writeInst(buf, n++, cx, top - 14, 4, 5, cr * 0.75, cg * 0.65, cb * 0.22, 1, 0, 1);
          // 柱×2
          writeInst(buf, n++, cx - bW * 0.32, bot + bH * 0.45, 3, bH * 0.50, cr * 0.55, cg * 0.28, cb * 0.20, 1);
          writeInst(buf, n++, cx + bW * 0.32, bot + bH * 0.45, 3, bH * 0.50, cr * 0.55, cg * 0.28, cb * 0.20, 1);
          // T-2: 鬼瓦反り + 提灯列
          n = this.drawTileRoofCurl(buf, n, cx, top, bW + 10, false);
          n = this.drawChouchinRow(buf, n, cx, top - 8, bW * 0.6, 3);
          // 注連縄
          writeInst(buf, n++, cx, top - 2, bW + 8, 1, 0.92, 0.85, 0.65, 0.85);
          break;
        }
        case 'apartment_tall': {
          // 窓グリッド
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 4, 14);
          // 各階バルコニー帯（5階相当）
          const atFlH = bH / 5;
          for (let i = 1; i <= 4; i++) {
            writeInst(buf, n++, cx, bot + atFlH * i, bW + 3, 2.5,
              Math.max(0, cr - 0.15), Math.max(0, cg - 0.15), Math.max(0, cb - 0.12), 1);
          }
          writeInst(buf, n++, cx, bot + 7, bW * 0.22, 13, 0.58, 0.82, 0.92, 0.85);
          // T-2: 屋上クラッター + 各階バルコニー手すり + 端階段 + 側面 AC
          const atSeed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
          n = this.drawFlatRoofClutter(buf, n, cx, top, bW, atSeed);
          for (let i = 1; i <= 4; i++) {
            n = this.drawBalconyRailing(buf, n, cx, bot + atFlH * i + 1.5, bW);
          }
          // 外階段 (右端)
          n = this.drawStairs(buf, n, cx + bW * 0.45, bot + 2, bH * 0.7);
          // 側面 AC (各階 1 個)
          for (let i = 0; i < 4; i++) {
            n = this.drawACUnit(buf, n, cx - bW * 0.42, bot + atFlH * (i + 0.5));
          }
          break;
        }
        // ── 1-B 商業系 ────────────────────────────────────────────
        case 'cafe': {
          // 暖色テント
          writeInst(buf, n++, cx, bot + bH * 0.52, bW + 5, 4, 0.72, 0.38, 0.18, 0.90);
          // T-3: 看板強化 + ストライプ庇
          n = this.drawShopSign(buf, n, cx, top, bW, 1, false);
          n = this.drawAwningStripe(buf, n, cx, bot, bW, bH, 1);
          // 窓
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.68, bH * 0.32, 0.78, 0.90, 0.82, 0.80);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.35, bW * 0.68, bH * 0.32);
          // テラス席 (ドア脇小机)
          writeInst(buf, n++, cx + bW * 0.40, bot + 2, 2.5, 1.5, 0.65, 0.45, 0.25, 0.9);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 2);
          break;
        }
        case 'bakery': {
          // 看板（暖色）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.90, 0.70, 0.30, 1);
          n = this.drawShopSign(buf, n, cx, top, bW, 1, false);
          // 丸窓（フランス扉風）
          writeInst(buf, n++, cx, bot + bH * 0.52, bW * 0.50, bH * 0.50, 0.80, 0.90, 0.96, 0.80);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.52, bW * 0.50, bH * 0.50);
          // T-3: パン棚 (水平線 3 本)
          for (let i = 0; i < 3; i++) {
            writeInst(buf, n++, cx, bot + bH * 0.30 + i * 2, bW * 0.48, 0.5, 0.55, 0.35, 0.20, 0.85);
          }
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          break;
        }
        case 'bookstore': {
          // 看板帯（茶）
          n = this.drawShopSign(buf, n, cx, top, bW, 4, false);
          // ショーウィンドウ（本棚イメージ）
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.72, bH * 0.38, 0.75, 0.88, 0.96, 0.80);
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.70, 2, 0.52, 0.38, 0.22, 0.6);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.40, bW * 0.72, bH * 0.38);
          // T-3: 本棚 (水平線 4 本)
          for (let i = 0; i < 4; i++) {
            writeInst(buf, n++, cx, bot + bH * 0.28 + i * 2, bW * 0.68, 0.4, 0.42, 0.28, 0.18, 0.85);
          }
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          break;
        }
        case 'pharmacy': {
          // グリーン十字（薬局）
          writeInst(buf, n++, cx, top - bH * 0.20, 5, bH * 0.25, 0.10, 0.72, 0.30, 1);
          writeInst(buf, n++, cx, top - bH * 0.20, bW * 0.28, 5, 0.10, 0.72, 0.30, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.38, bW * 0.68, bH * 0.34, 0.72, 0.92, 0.96, 0.80);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.38, bW * 0.68, bH * 0.34);
          // T-3: シャッターの基礎 + ロゴ円
          writeInst(buf, n++, cx, bot + 2, bW + 2, 2.5, 0.55, 0.55, 0.52, 1);
          writeInst(buf, n++, cx - bW * 0.28, top - bH * 0.32, 3, 3, 0.95, 0.95, 0.92, 0.9, 0, 1); // 薬
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          break;
        }
        case 'supermarket': {
          // 看板帯（緑）
          writeInst(buf, n++, cx, top - 4, bW, 8, 0.18, 0.60, 0.28, 1);
          writeInst(buf, n++, cx, top - 9, bW, 3, 0.95, 0.95, 0.95, 0.9);
          // 大きなショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.82, bH * 0.40, 0.70, 0.90, 0.96, 0.82);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.42, bW * 0.82, bH * 0.40);
          // 入り口
          writeInst(buf, n++, cx, bot + 6, bW * 0.14, 11, 0.28, 0.22, 0.20, 1);
          // T-3: ストライプ庇 + ショッピングカート列 + ロゴ
          n = this.drawAwningStripe(buf, n, cx, bot, bW, bH, 2);
          for (let i = 0; i < 4; i++) {
            writeInst(buf, n++, cx - bW * 0.35 + i * 2.2, bot + 1, 1.5, 1.2, 0.82, 0.82, 0.82, 0.9);
          }
          writeInst(buf, n++, cx - bW * 0.40, top - 4, 4, 4, 0.92, 0.82, 0.35, 0.9, 0, 1); // ロゴ
          break;
        }
        case 'karaoke': {
          // ネオン帯×2
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.92, 0.22, 0.80, 1);
          writeInst(buf, n++, cx, top - 9, bW, 3, 0.35, 0.22, 0.80, 0.9);
          // T-3: 縦看板 + ネオン輪郭 + LED 3x3
          n = this.drawShopSign(buf, n, cx, top, bW, 3, true);
          // ネオン輪郭 (縦線 2 本)
          writeInst(buf, n++, cx - bW * 0.48, cy, 0.6, bH * 0.85, 0.92, 0.22, 0.80, 0.75);
          writeInst(buf, n++, cx + bW * 0.48, cy, 0.6, bH * 0.85, 0.35, 0.22, 0.80, 0.75);
          // LED 3x3
          for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
              writeInst(buf, n++, cx + i * 3, bot + bH * 0.40 + j * 3, 0.8, 0.8,
                0.92, 0.82, 0.20, 0.85, 0, 1);
            }
          }
          // ドア
          writeInst(buf, n++, cx, bot + 6, bW * 0.18, 11, 0.28, 0.22, 0.18, 1);
          break;
        }
        case 'pachinko': {
          // フラッシュ帯（派手）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.95, 0.75, 0.05, 1);
          writeInst(buf, n++, cx, top - 8, bW, 3, 0.25, 0.25, 0.80, 0.9);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.45, bW * 0.80, bH * 0.42, 0.75, 0.88, 0.96, 0.75);
          // T-3: 縦看板 + ネオン輪郭 + 玉箱スタック
          n = this.drawShopSign(buf, n, cx, top, bW, 1, true);
          writeInst(buf, n++, cx - bW * 0.48, cy, 0.6, bH * 0.85, 0.95, 0.75, 0.05, 0.75);
          writeInst(buf, n++, cx + bW * 0.48, cy, 0.6, bH * 0.85, 0.25, 0.25, 0.80, 0.75);
          // 玉箱 3 段
          for (let i = 0; i < 3; i++) {
            writeInst(buf, n++, cx + bW * 0.40, bot + 2 + i * 2, 3, 1.7, 0.82, 0.22, 0.28, 1);
          }
          break;
        }
        case 'laundromat': {
          // 丸窓×2 (洗濯機のポートホール)
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.45, 7, 7, 0.62, 0.85, 0.96, 0.85, 0, 1);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.45, 7, 7, 0.62, 0.85, 0.96, 0.85, 0, 1);
          // 看板帯
          n = this.drawShopSign(buf, n, cx, top, bW, 2, false);
          // T-3: 壁面自販機
          n = this.drawVendingMachineInset(buf, n, cx + bW * 0.45, bot + bH * 0.25);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 1);
          break;
        }
        case 'florist': {
          // 花飾り帯（カラフル）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.90, 0.42, 0.62, 1);
          writeInst(buf, n++, cx - bW * 0.25, top - 3, 5, 5, 0.95, 0.90, 0.20, 0.9, 0, 1);
          writeInst(buf, n++, cx + bW * 0.25, top - 3, 5, 5, 0.25, 0.80, 0.42, 0.9, 0, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.38, bW * 0.70, bH * 0.34, 0.78, 0.95, 0.80, 0.80);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.38, bW * 0.70, bH * 0.34);
          // T-3: ストライプ庇 + 花スタンド
          n = this.drawAwningStripe(buf, n, cx, bot, bW, bH, 4);
          for (let i = 0; i < 3; i++) {
            writeInst(buf, n++, cx - bW * 0.35 + i * 4, bot + 2, 2.5, 3, 0.42, 0.28, 0.18, 0.95); // 鉢
            writeInst(buf, n++, cx - bW * 0.35 + i * 4, bot + 4, 2.8, 1.5,
              [0.92, 0.45, 0.72][i], [0.45, 0.85, 0.52][i], [0.62, 0.35, 0.82][i], 0.95); // 花
          }
          break;
        }
        case 'ramen': {
          // 看板帯（赤橙）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.88, 0.28, 0.12, 1);
          // のれん（庇下の帯）
          writeInst(buf, n++, cx, bot + bH * 0.65, bW * 0.60, 4, 0.68, 0.18, 0.10, 0.85);
          // 窓
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.55, bH * 0.26, 0.80, 0.88, 0.82, 0.78);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.35, bW * 0.55, bH * 0.26);
          // T-3: 提灯列 + 縦看板 + 蒸気
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.85, bW * 0.70, 4);
          n = this.drawShopSign(buf, n, cx, top, bW, 0, true);
          // カウンターの人影点 (窓の中)
          writeInst(buf, n++, cx - bW * 0.15, bot + bH * 0.32, 1.2, 1.5, 0.15, 0.12, 0.08, 0.85);
          writeInst(buf, n++, cx + bW * 0.10, bot + bH * 0.32, 1.2, 1.5, 0.15, 0.12, 0.08, 0.85);
          // 煙突の蒸気 (円)
          writeInst(buf, n++, cx - bW * 0.35, top + 4, 5, 4, 0.82, 0.82, 0.80, 0.45, 0, 1);
          writeInst(buf, n++, cx - bW * 0.38, top + 7, 6, 5, 0.85, 0.85, 0.82, 0.35, 0, 1);
          break;
        }
        case 'izakaya': {
          // 提灯色帯（暖色）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.82, 0.48, 0.12, 1);
          // 縦看板イメージ
          writeInst(buf, n++, cx - bW * 0.35, cy, 3, bH * 0.55, 0.75, 0.28, 0.12, 1);
          // のれん
          writeInst(buf, n++, cx, bot + bH * 0.62, bW * 0.55, 4, 0.62, 0.30, 0.12, 0.85);
          // T-3: 提灯列多数 + 階段 + 縦看板強化
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.82, bW * 0.75, 5);
          n = this.drawShopSign(buf, n, cx, top, bW, 0, true);
          n = this.drawStairs(buf, n, cx + bW * 0.42, bot + 1, 5);
          break;
        }
        case 'game_center': {
          // ネオンブルー看板
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.18, 0.48, 0.90, 1);
          writeInst(buf, n++, cx, top - 8.5, bW, 3, 0.55, 0.22, 0.88, 0.9);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.75, bH * 0.40, 0.65, 0.85, 0.96, 0.78);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.42, bW * 0.75, bH * 0.40);
          // T-3: 縦看板 + ネオン輪郭 + LED
          n = this.drawShopSign(buf, n, cx, top, bW, 2, true);
          writeInst(buf, n++, cx - bW * 0.48, cy, 0.6, bH * 0.85, 0.18, 0.48, 0.90, 0.80);
          writeInst(buf, n++, cx + bW * 0.48, cy, 0.6, bH * 0.85, 0.55, 0.22, 0.88, 0.80);
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * 3, bot + bH * 0.25, 1, 1,
              0.92, 0.82, 0.20, 0.85, 0, 1);
          }
          break;
        }
        // ── 1-C 公共系 ────────────────────────────────────────────
        case 'bank': {
          // 古典的列柱（横帯×3）
          writeInst(buf, n++, cx, top - 4, bW + 4, 7, cr * 0.88, cg * 0.82, cb * 0.68, 1);
          writeInst(buf, n++, cx, bot + 2, bW + 4, 4, cr * 0.82, cg * 0.76, cb * 0.62, 1);
          writeInst(buf, n++, cx, bot + 7, bW * 0.42, bH * 0.55, 0.68, 0.88, 0.96, 0.78);
          // T-4: 神殿風列柱 4 本 + キャノピー + ATM + ドア詳細
          for (const xOff of [-bW * 0.40, -bW * 0.14, bW * 0.14, bW * 0.40]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.44, 2.4, bH * 0.62, cr * 0.95, cg * 0.90, cb * 0.78, 1);
            writeInst(buf, n++, cx + xOff, bot + bH * 0.75, 3.2, 1.2, cr * 0.75, cg * 0.70, cb * 0.58, 1);
            writeInst(buf, n++, cx + xOff, bot + bH * 0.13, 3.2, 1.2, cr * 0.75, cg * 0.70, cb * 0.58, 1);
          }
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          // ATM (右端)
          writeInst(buf, n++, cx + bW * 0.42, bot + 7, 3, 7, 0.30, 0.32, 0.36, 1);
          writeInst(buf, n++, cx + bW * 0.42, bot + 9, 2.2, 1.2, 0.55, 0.85, 0.95, 0.92);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 2);
          break;
        }
        case 'post_office': {
          // オレンジ看板帯
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.92, 0.62, 0.12, 1);
          // 郵便マーク（丸）
          writeInst(buf, n++, cx + bW * 0.30, top - bH * 0.35, 6, 6, 0.92, 0.62, 0.12, 1, 0, 1);
          // 玄関
          writeInst(buf, n++, cx, bot + 6, bW * 0.30, 11, 0.68, 0.88, 0.96, 0.80);
          // T-4: 縦看板 + バイク駐車 + 郵便ポスト + 窓枠
          n = this.drawShopSign(buf, n, cx, top, bW, 1, false);
          // バイク駐車 (赤)
          writeInst(buf, n++, cx - bW * 0.38, bot + 2, 5, 2, 0.82, 0.22, 0.18, 1);
          writeInst(buf, n++, cx - bW * 0.38 - 1, bot + 1, 1.5, 1.5, 0.15, 0.15, 0.18, 1, 0, 1);
          writeInst(buf, n++, cx - bW * 0.38 + 1, bot + 1, 1.5, 1.5, 0.15, 0.15, 0.18, 1, 0, 1);
          // 郵便ポスト
          writeInst(buf, n++, cx + bW * 0.44, bot + 5, 3, 8, 0.88, 0.28, 0.15, 1);
          writeInst(buf, n++, cx + bW * 0.44, bot + 7, 2.2, 0.8, 0.18, 0.12, 0.10, 0.95);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 0);
          break;
        }
        case 'library': {
          // 格調ある上帯
          writeInst(buf, n++, cx, top - 4, bW + 4, 8, cr * 0.78, cg * 0.72, cb * 0.62, 1);
          // アーチ窓×2
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.50, 8, bH * 0.40, 0.68, 0.88, 0.96, 0.78);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.50, 8, bH * 0.40, 0.68, 0.88, 0.96, 0.78);
          // T-4: 柱 + キャノピー + 左右石段
          for (const xOff of [-bW * 0.42, -bW * 0.05, bW * 0.05, bW * 0.42]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.45, 1.8, bH * 0.60, cr * 0.92, cg * 0.85, cb * 0.70, 1);
          }
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          // 石段 (3段)
          for (let i = 0; i < 3; i++) {
            writeInst(buf, n++, cx, bot - 0.5 - i * 1.0, bW * 0.5 - i * 2, 1.0, cr * 0.70, cg * 0.68, cb * 0.62, 0.95);
          }
          // 窓枠
          n = this.drawWindowFrame(buf, n, cx - bW * 0.25, bot + bH * 0.50, 8, bH * 0.40);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.25, bot + bH * 0.50, 8, bH * 0.40);
          break;
        }
        case 'museum': {
          // 窓グリッド (柱廊の上の階)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 9, bH * 0.55);
          // 柱廊（前面ストライプ）
          for (const xOff of [-bW * 0.35, -bW * 0.12, bW * 0.12, bW * 0.35]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.40, 3, bH * 0.75, cr * 0.90, cg * 0.85, cb * 0.72, 1);
          }
          writeInst(buf, n++, cx, top - 4, bW + 6, 8, cr * 0.85, cg * 0.80, cb * 0.68, 1);
          // T-4: 前面石段 + 左右ブロンズ像 + ペディメント装飾
          for (let i = 0; i < 4; i++) {
            writeInst(buf, n++, cx, bot - 0.5 - i * 1.0, bW * 0.65 - i * 2.4, 1.0, cr * 0.72, cg * 0.68, cb * 0.60, 0.95);
          }
          // ブロンズ像 (左右)
          writeInst(buf, n++, cx - bW * 0.48, bot + 5, 2.2, 8, 0.45, 0.38, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.48, bot + 9.5, 2, 2, 0.50, 0.42, 0.25, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.48, bot + 5, 2.2, 8, 0.45, 0.38, 0.22, 1);
          writeInst(buf, n++, cx + bW * 0.48, bot + 9.5, 2, 2, 0.50, 0.42, 0.25, 1, 0, 1);
          // ペディメント (三角装飾帯)
          writeInst(buf, n++, cx, top - 8.5, bW + 4, 2, cr * 0.62, cg * 0.58, cb * 0.50, 0.9);
          break;
        }
        case 'city_hall': {
          // 窓グリッド (左右翼の窓)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 6, 8);
          // 中央塔
          writeInst(buf, n++, cx, cy + bH * 0.18, bW * 0.35, bH * 0.65, cr * 0.95, cg * 0.92, cb * 0.80, 1);
          // 旗竿（上）
          writeInst(buf, n++, cx, top + 7, 2, 14, cr * 0.62, cg * 0.62, cb * 0.62, 1);
          writeInst(buf, n++, cx + 4, top + 12, 8, 4, 0.85, 0.15, 0.15, 1);
          // コーニス
          writeInst(buf, n++, cx, top - 3, bW + 6, 5, cr * 0.80, cg * 0.76, cb * 0.65, 1);
          // T-4: 中央時計 + 正面キャノピー + 市章 + 屋上アンテナ
          writeInst(buf, n++, cx, cy - bH * 0.05, 5.5, 5.5, 0.95, 0.92, 0.80, 1, 0, 1);
          writeInst(buf, n++, cx, cy - bH * 0.05, 3.5, 0.5, 0.15, 0.12, 0.10, 1);
          writeInst(buf, n++, cx, cy - bH * 0.05, 0.5, 3.5, 0.15, 0.12, 0.10, 1);
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          // 市章 (キャノピー下)
          writeInst(buf, n++, cx, bot + bH * 0.88, 3, 3, 0.92, 0.78, 0.22, 1, 0, 1);
          // 屋上アンテナ
          writeInst(buf, n++, cx - bW * 0.30, top + 6, 1, 10, 0.55, 0.55, 0.55, 1);
          writeInst(buf, n++, cx + bW * 0.30, top + 6, 1, 10, 0.55, 0.55, 0.55, 1);
          break;
        }
        case 'fire_station': {
          // 赤いガレージ扉×2
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.68, 0.18, 0.15, 1);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.68, 0.18, 0.15, 1);
          // 上帯
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.80, 0.22, 0.18, 1);
          // T-4: シャッター横筋 + 消防ホース盤 + サイレン + 署名表札
          n = this.drawShutterSlats(buf, n, cx - bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.82, 0.30, 0.25);
          n = this.drawShutterSlats(buf, n, cx + bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.82, 0.30, 0.25);
          // サイレン (上帯の上)
          writeInst(buf, n++, cx - bW * 0.30, top + 2, 3, 3, 0.92, 0.22, 0.18, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.30, top + 2, 3, 3, 0.92, 0.22, 0.18, 1, 0, 1);
          // 消防ホース盤 (扉の間)
          writeInst(buf, n++, cx, bot + bH * 0.35, 2.2, bH * 0.38, 0.92, 0.82, 0.20, 1);
          writeInst(buf, n++, cx, bot + bH * 0.35, 1.4, 1.4, 0.40, 0.30, 0.20, 1, 0, 1);
          // 署名 (白い小看板)
          writeInst(buf, n++, cx, top + 2, bW * 0.30, 3, 0.95, 0.92, 0.88, 1);
          break;
        }
        case 'police_station': {
          // ダークブルー帯
          writeInst(buf, n++, cx, top - 4, bW, 8, 0.25, 0.35, 0.68, 1);
          // エントランス
          writeInst(buf, n++, cx, bot + 7, bW * 0.36, 13, 0.68, 0.88, 0.96, 0.80);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 2, bW, 3, cr * 0.65, cg * 0.65, cb * 0.65, 1);
          // T-4: 回転灯 + 警察紋章 + ドア + 左右の窓
          writeInst(buf, n++, cx, top + 5, 3.2, 4, 0.95, 0.22, 0.18, 1, 0, 1);
          writeInst(buf, n++, cx, top + 3, 1.4, 2, 0.40, 0.32, 0.25, 1);
          // 警察紋章 (金の丸)
          writeInst(buf, n++, cx, top - 4, 5, 5, 0.95, 0.82, 0.32, 1, 0, 1);
          writeInst(buf, n++, cx, top - 4, 3.2, 3.2, 0.25, 0.35, 0.68, 1, 0, 1);
          // 左右の窓
          writeInst(buf, n++, cx - bW * 0.32, bot + bH * 0.48, 5, bH * 0.35, 0.62, 0.82, 0.94, 0.80);
          writeInst(buf, n++, cx + bW * 0.32, bot + bH * 0.48, 5, bH * 0.35, 0.62, 0.82, 0.94, 0.80);
          n = this.drawWindowFrame(buf, n, cx - bW * 0.32, bot + bH * 0.48, 5, bH * 0.35);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.32, bot + bH * 0.48, 5, bH * 0.35);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 1);
          break;
        }
        case 'train_station': {
          // 大きなキャノピー（屋根庇）
          writeInst(buf, n++, cx, top - 4, bW + 12, 8, cr * 0.80, cg * 0.76, cb * 0.65, 1);
          // 改札口（大きなガラス帯）
          writeInst(buf, n++, cx, bot + bH * 0.45, bW * 0.78, bH * 0.55, 0.65, 0.85, 0.96, 0.78);
          // 柱×3
          for (const xOff of [-bW * 0.35, 0, bW * 0.35]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.28, 3, bH * 0.56, cr * 0.72, cg * 0.68, cb * 0.58, 1);
          }
          // T-4: 駅名標 + 時刻表 + エントランスキャノピー + 時計
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          // 駅名標 (青地白文字風の白帯)
          writeInst(buf, n++, cx, top + 3, bW * 0.65, 4.5, 0.22, 0.38, 0.72, 1);
          writeInst(buf, n++, cx, top + 3, bW * 0.55, 2.5, 0.95, 0.95, 0.95, 0.95);
          // 時計 (駅名標の上)
          writeInst(buf, n++, cx, top + 9, 4.5, 4.5, 0.95, 0.92, 0.80, 1, 0, 1);
          writeInst(buf, n++, cx, top + 9, 3, 0.5, 0.15, 0.12, 0.10, 1);
          writeInst(buf, n++, cx, top + 9, 0.5, 3, 0.15, 0.12, 0.10, 1);
          // 時刻表 (右側)
          writeInst(buf, n++, cx + bW * 0.42, bot + bH * 0.25, 5, 7, 0.30, 0.32, 0.36, 1);
          writeInst(buf, n++, cx + bW * 0.42, bot + bH * 0.25, 4.2, 6.2, 0.95, 0.92, 0.78, 0.92);
          for (let r = 0; r < 3; r++) {
            writeInst(buf, n++, cx + bW * 0.42, bot + bH * 0.25 + 2 - r * 1.5, 3.6, 0.4, 0.15, 0.18, 0.30, 0.85);
          }
          break;
        }
        case 'movie_theater': {
          // マーキー（看板帯）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.75, 0.22, 0.55, 1);
          writeInst(buf, n++, cx, top - 8.5, bW * 0.88, 3, 0.90, 0.85, 0.15, 0.9);
          // エントランス（大きなアーチ）
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.52, bH * 0.52, 0.22, 0.18, 0.15, 1);
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.46, bH * 0.48, 0.68, 0.58, 0.48, 0.85);
          // T-4: マーキー電球輪郭 + 電光ポスター×2 + 縦看板
          // マーキー電球 (水平)
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * bW * 0.13, top - 8.5, 1, 1, 0.98, 0.92, 0.35, 0.95, 0, 1);
          }
          // 電光ポスター 2 枚 (左右)
          writeInst(buf, n++, cx - bW * 0.42, bot + bH * 0.40, 5, bH * 0.50, 0.25, 0.20, 0.28, 1);
          writeInst(buf, n++, cx - bW * 0.42, bot + bH * 0.45, 4.2, bH * 0.42, 0.92, 0.32, 0.48, 0.88);
          writeInst(buf, n++, cx + bW * 0.42, bot + bH * 0.40, 5, bH * 0.50, 0.25, 0.20, 0.28, 1);
          writeInst(buf, n++, cx + bW * 0.42, bot + bH * 0.45, 4.2, bH * 0.42, 0.35, 0.65, 0.92, 0.88);
          // 縦看板 (映画題)
          n = this.drawShopSign(buf, n, cx, top, bW, 3, true);
          break;
        }
        case 'gas_station': {
          // 大型キャノピー（屋根）
          writeInst(buf, n++, cx, top + 2, bW + 14, 5, cr * 0.85, cg * 0.85, cb * 0.20, 1);
          // 給油機（縦棒×2）
          writeInst(buf, n++, cx - bW * 0.28, bot + bH * 0.45, 4, bH * 0.60, 0.55, 0.55, 0.58, 1);
          writeInst(buf, n++, cx + bW * 0.28, bot + bH * 0.45, 4, bH * 0.60, 0.55, 0.55, 0.58, 1);
          // T-4: 価格看板 + 給油機ホース + 壁面自販機 + 屋根裏灯
          // 価格看板 (ポール上)
          writeInst(buf, n++, cx - bW * 0.48, top + 10, 1.5, 18, 0.62, 0.62, 0.65, 1);
          writeInst(buf, n++, cx - bW * 0.48, top + 16, 8, 6, 0.95, 0.92, 0.80, 1);
          writeInst(buf, n++, cx - bW * 0.48, top + 17, 6, 1, 0.85, 0.22, 0.22, 0.92);
          writeInst(buf, n++, cx - bW * 0.48, top + 15, 6, 1, 0.18, 0.25, 0.45, 0.92);
          // 給油ホース
          writeInst(buf, n++, cx - bW * 0.28 + 1, bot + bH * 0.25, 0.5, 6, 0.20, 0.20, 0.22, 0.9);
          writeInst(buf, n++, cx + bW * 0.28 - 1, bot + bH * 0.25, 0.5, 6, 0.20, 0.20, 0.22, 0.9);
          // 屋根裏灯 (黄色)
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.35, top + 0.5, 3, 1, 0.98, 0.92, 0.45, 0.92);
          }
          // 壁面自販機
          n = this.drawVendingMachineInset(buf, n, cx + bW * 0.48, bot + 5);
          break;
        }
        // ── 1-D ランドマーク ───────────────────────────────────────
        case 'clock_tower': {
          // 窓グリッド (時計面の下の塔本体)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, bH * 0.32, 8);
          // 時計面（円）
          writeInst(buf, n++, cx, top - bH * 0.15, bW + 2, bW + 2, cr * 0.92, cg * 0.88, cb * 0.72, 1, 0, 1);
          // 針（水平バー）
          writeInst(buf, n++, cx, top - bH * 0.15, bW * 0.75, 1.5, 0.15, 0.15, 0.15, 1);
          // 塔のセットバック
          writeInst(buf, n++, cx, bot + bH * 0.30, bW - 2, bH * 0.60, cr * 0.88, cg * 0.82, cb * 0.68, 1);
          // ピナクル（尖頭）
          writeInst(buf, n++, cx, top + 6, 3, 12, cr * 0.72, cg * 0.68, cb * 0.54, 1);
          // T-4: 時計文字盤マーク (12/3/6/9) + 分針 + 四隅の小装飾
          // 文字盤マーク
          writeInst(buf, n++, cx, top - bH * 0.15 - bW * 0.38, 1.4, 1.4, 0.15, 0.12, 0.10, 1);
          writeInst(buf, n++, cx, top - bH * 0.15 + bW * 0.38, 1.4, 1.4, 0.15, 0.12, 0.10, 1);
          writeInst(buf, n++, cx - bW * 0.38, top - bH * 0.15, 1.4, 1.4, 0.15, 0.12, 0.10, 1);
          writeInst(buf, n++, cx + bW * 0.38, top - bH * 0.15, 1.4, 1.4, 0.15, 0.12, 0.10, 1);
          // 分針 (縦)
          writeInst(buf, n++, cx, top - bH * 0.15 - bW * 0.18, 1, bW * 0.42, 0.18, 0.15, 0.15, 1);
          // ベランダ (時計面の下)
          writeInst(buf, n++, cx, cy - bH * 0.05, bW + 1, 1.2, cr * 0.62, cg * 0.58, cb * 0.48, 1);
          break;
        }
        case 'radio_tower': {
          // 細い本体（逓減）
          writeInst(buf, n++, cx, bot + bH * 0.40, bW - 2, bH * 0.80, cr * 0.72, cg * 0.74, cb * 0.78, 1);
          writeInst(buf, n++, cx, bot + bH * 0.60, bW - 4, bH * 0.40, cr * 0.65, cg * 0.67, cb * 0.70, 1);
          // アンテナ
          writeInst(buf, n++, cx, top + 12, 2, 22, cr * 0.55, cg * 0.55, cb * 0.58, 1);
          // 横ビーム×3
          for (let i = 1; i <= 3; i++) {
            writeInst(buf, n++, cx, bot + bH * (0.25 * i), bW + 4, 1.5, cr * 0.60, cg * 0.60, cb * 0.62, 0.8);
          }
          break;
        }
        case 'ferris_wheel': {
          // 大きな外輪（円）
          writeInst(buf, n++, cx, top - bH * 0.25, bW * 0.85, bW * 0.85, cr * 0.58, cg * 0.78, cb * 0.95, 0.88, 0, 1);
          // 内輪（少し小さい）
          writeInst(buf, n++, cx, top - bH * 0.25, bW * 0.62, bW * 0.62, cr * 0.48, cg * 0.68, cb * 0.90, 0.75, 0, 1);
          // 支柱（逆V）
          writeInst(buf, n++, cx - bW * 0.32, bot + bH * 0.20, 3, bH * 0.55, cr * 0.52, cg * 0.58, cb * 0.62, 1);
          writeInst(buf, n++, cx + bW * 0.32, bot + bH * 0.20, 3, bH * 0.55, cr * 0.52, cg * 0.58, cb * 0.62, 1);
          // ゴンドラ（小丸×4）
          const fwR = bW * 0.30;
          const fwCy = top - bH * 0.25;
          for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            writeInst(buf, n++, cx + Math.cos(ang) * fwR, fwCy + Math.sin(ang) * fwR * 0.8, 4, 4, 0.88, 0.88, 0.85, 1);
          }
          break;
        }
        case 'stadium': {
          // 曲面スタンド（楕円っぽい帯）
          writeInst(buf, n++, cx, cy, bW - 4, bH - 4, cr * 0.72, cg * 0.68, cb * 0.62, 0.9, 0, 1);
          writeInst(buf, n++, cx, cy, bW - 10, bH - 10, 0.32, 0.55, 0.32, 0.9, 0, 1); // 芝グラウンド
          // 屋根コーニス
          writeInst(buf, n++, cx, top - 3, bW + 8, 6, cr * 0.80, cg * 0.76, cb * 0.70, 1);
          // 照明塔
          writeInst(buf, n++, cx - bW * 0.45, top + 4, 2, 8, 0.52, 0.52, 0.52, 1);
          writeInst(buf, n++, cx + bW * 0.45, top + 4, 2, 8, 0.52, 0.52, 0.52, 1);
          break;
        }
        case 'water_tower': {
          // タンク（上部の丸い部分）
          writeInst(buf, n++, cx, top - bH * 0.20, bW + 4, bH * 0.35, cr * 0.78, cg * 0.70, cb * 0.58, 1, 0, 1);
          writeInst(buf, n++, cx, top - bH * 0.20, bW + 2, bH * 0.33, cr * 0.72, cg * 0.65, cb * 0.52, 1, 0, 1);
          // 脚部（×2）
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.28, 3, bH * 0.55, cr * 0.68, cg * 0.60, cb * 0.48, 1);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.28, 3, bH * 0.55, cr * 0.68, cg * 0.60, cb * 0.48, 1);
          break;
        }
        // ── 港湾・工業 (Stage 4) ─────────────────────────────────
        case 'warehouse': {
          // 倉庫: 横長の低層、波板金属屋根 + シャッター 3 つ
          writeInst(buf, n++, cx, top - 4, bW + 2, 8, cr * 0.60, cg * 0.60, cb * 0.58, 1); // 波板屋根
          for (let i = 0; i < 6; i++) {
            const rx = cx - bW * 0.45 + (bW * 0.9) * (i / 5);
            writeInst(buf, n++, rx, top - 4, 0.6, 8, cr * 0.40, cg * 0.40, cb * 0.38, 0.7);
          }
          // シャッター 3 つ
          for (let i = -1; i <= 1; i++) {
            const dx = cx + i * bW * 0.30;
            writeInst(buf, n++, dx, bot + bH * 0.35, bW * 0.22, bH * 0.60, 0.30, 0.32, 0.36, 1);
            writeInst(buf, n++, dx, bot + bH * 0.35, bW * 0.20, bH * 0.56, 0.55, 0.48, 0.20, 0.85); // 黄警告帯
            for (let j = 0; j < 4; j++) {
              writeInst(buf, n++, dx, bot + bH * 0.10 + j * bH * 0.12, bW * 0.20, 0.6, 0.18, 0.20, 0.24, 0.8);
            }
          }
          // 社名看板
          writeInst(buf, n++, cx, top - 1, bW * 0.40, 3, 0.92, 0.82, 0.18, 1);
          break;
        }
        case 'crane_gantry': {
          // ガントリークレーン: 上部に横長の梁 + 2 本の脚
          writeInst(buf, n++, cx - bW * 0.35, bot + bH * 0.45, 4, bH * 0.88, cr * 0.70, cg * 0.70, cb * 0.72, 1);
          writeInst(buf, n++, cx + bW * 0.35, bot + bH * 0.45, 4, bH * 0.88, cr * 0.70, cg * 0.70, cb * 0.72, 1);
          // 斜めブレース
          writeInst(buf, n++, cx - bW * 0.20, bot + bH * 0.30, 2, bH * 0.45, cr * 0.62, cg * 0.62, cb * 0.64, 0.7);
          writeInst(buf, n++, cx + bW * 0.20, bot + bH * 0.30, 2, bH * 0.45, cr * 0.62, cg * 0.62, cb * 0.64, 0.7);
          // 上部横梁
          writeInst(buf, n++, cx, top - 6, bW + 8, 5, 0.92, 0.72, 0.15, 1); // イエロー
          writeInst(buf, n++, cx, top - 9, bW + 10, 1.5, 0.25, 0.20, 0.15, 0.9);
          // 吊り荷
          writeInst(buf, n++, cx, top - 18, 1.5, 12, 0.20, 0.20, 0.25, 1); // ワイヤー
          writeInst(buf, n++, cx, top - 26, 10, 6, 0.85, 0.30, 0.22, 1);    // コンテナ
          // 操作室
          writeInst(buf, n++, cx + bW * 0.18, top - 14, 7, 6, 0.70, 0.72, 0.80, 1);
          writeInst(buf, n++, cx + bW * 0.18, top - 14, 5, 4, 0.45, 0.70, 0.90, 0.85);
          break;
        }
        case 'container_stack': {
          // コンテナ積み: カラフルな箱を 2x3 スタック
          const colors: Array<[number, number, number]> = [
            [0.85, 0.28, 0.22], [0.22, 0.45, 0.80], [0.85, 0.72, 0.15],
            [0.20, 0.62, 0.35], [0.75, 0.40, 0.18], [0.30, 0.30, 0.35],
          ];
          const cellW = bW * 0.48;
          const cellH = bH * 0.30;
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 2; c++) {
              const col = colors[(r * 2 + c) % colors.length];
              const x = cx - bW * 0.24 + c * cellW;
              const y = bot + cellH * 0.5 + r * cellH;
              writeInst(buf, n++, x, y, cellW - 2, cellH - 2, col[0], col[1], col[2], 1);
              // 縦リブ
              writeInst(buf, n++, x - cellW * 0.30, y, 0.6, cellH - 3, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 0.8);
              writeInst(buf, n++, x + cellW * 0.30, y, 0.6, cellH - 3, col[0] * 0.7, col[1] * 0.7, col[2] * 0.7, 0.8);
              // ドア取っ手
              writeInst(buf, n++, x + cellW * 0.35, y, 0.8, 2, 0.20, 0.20, 0.20, 0.9);
            }
          }
          break;
        }
        case 'factory_stack': {
          // 工場 + 煙突 2 本
          n = this.drawBuildingWindows(buf, n, cx, bot, bW * 0.85, bH * 0.55, cr * 0.80, cg * 0.80, cb * 0.82, 3, 6);
          // 本体屋根 (のこぎり屋根)
          for (let i = 0; i < 4; i++) {
            const rx = cx - bW * 0.35 + (bW * 0.7) * (i / 3);
            writeInst(buf, n++, rx, bot + bH * 0.62, bW * 0.18, 4, cr * 0.65, cg * 0.62, cb * 0.58, 1);
          }
          // 煙突 2 本
          writeInst(buf, n++, cx - bW * 0.25, top - bH * 0.15, 5, bH * 0.55, cr * 0.72, cg * 0.68, cb * 0.58, 1);
          writeInst(buf, n++, cx + bW * 0.25, top - bH * 0.15, 5, bH * 0.55, cr * 0.72, cg * 0.68, cb * 0.58, 1);
          // 赤白帯
          for (let i = 0; i < 3; i++) {
            const y = top - bH * 0.08 - i * 8;
            writeInst(buf, n++, cx - bW * 0.25, y, 5, 1.2, 0.88, 0.18, 0.15, 0.9);
            writeInst(buf, n++, cx + bW * 0.25, y, 5, 1.2, 0.88, 0.18, 0.15, 0.9);
          }
          // 煙
          writeInst(buf, n++, cx - bW * 0.25, top + 4, 9, 6, 0.80, 0.80, 0.82, 0.55, 0, 1);
          writeInst(buf, n++, cx + bW * 0.25 + 2, top + 6, 10, 7, 0.75, 0.75, 0.78, 0.50, 0, 1);
          break;
        }
        case 'silo': {
          // 貯蔵サイロ: 円柱 + 円錐屋根
          writeInst(buf, n++, cx, cy, bW - 2, bH * 0.85, cr * 0.90, cg * 0.88, cb * 0.82, 1, 0, 1);
          writeInst(buf, n++, cx, top - bH * 0.10, bW - 1, bH * 0.15, cr * 0.75, cg * 0.72, cb * 0.65, 1, 0, 1);
          // 縦の継ぎ目
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.25, cy, 0.5, bH * 0.75, cr * 0.60, cg * 0.58, cb * 0.52, 0.8);
          }
          // ロゴ帯
          writeInst(buf, n++, cx, bot + bH * 0.45, bW - 4, 3, 0.22, 0.32, 0.55, 0.85);
          // ハッチ
          writeInst(buf, n++, cx, bot + bH * 0.15, 4, 4, 0.30, 0.30, 0.32, 0.9, 0, 1);
          break;
        }
        // ── 和風・古都 (Stage 3) ─────────────────────────────────
        case 'pagoda': {
          // 五重塔: 段々の屋根 5 層
          const layerH = bH / 5.5;
          for (let i = 0; i < 5; i++) {
            const ly = bot + layerH * 0.5 + i * layerH;
            const lw = bW - i * (bW * 0.12);
            // 本体 (木目朱)
            writeInst(buf, n++, cx, ly, lw * 0.75, layerH * 0.55, 0.75, 0.28, 0.18, 1);
            // 屋根 (反りあり、幅広)
            writeInst(buf, n++, cx, ly + layerH * 0.42, lw, 2.2, 0.25, 0.18, 0.12, 1);
            writeInst(buf, n++, cx, ly + layerH * 0.48, lw + 2, 1.2, 0.35, 0.25, 0.15, 0.85);
            // 窓
            writeInst(buf, n++, cx, ly, lw * 0.35, layerH * 0.38, 0.10, 0.08, 0.06, 0.85);
          }
          // 相輪 (頂上)
          writeInst(buf, n++, cx, top + 3, 1.5, 8, 0.85, 0.70, 0.30, 1);
          writeInst(buf, n++, cx, top + 1, 4, 1.5, 0.88, 0.75, 0.35, 1);
          writeInst(buf, n++, cx, top + 4, 4, 1.5, 0.88, 0.75, 0.35, 1);
          // T-5: 風鐸 (各層の四隅の小装飾) + 下層基壇
          for (let i = 0; i < 5; i++) {
            const ly = bot + (bH / 5.5) * 0.5 + i * (bH / 5.5);
            const lw = bW - i * (bW * 0.12);
            writeInst(buf, n++, cx - lw * 0.5 - 0.5, ly + (bH / 5.5) * 0.42, 1, 2.2, 0.85, 0.70, 0.25, 1);
            writeInst(buf, n++, cx + lw * 0.5 + 0.5, ly + (bH / 5.5) * 0.42, 1, 2.2, 0.85, 0.70, 0.25, 1);
          }
          // 基壇
          writeInst(buf, n++, cx, bot - 0.8, bW + 4, 1.8, 0.72, 0.68, 0.60, 1);
          writeInst(buf, n++, cx, bot - 2.2, bW + 6, 1.4, 0.62, 0.58, 0.52, 1);
          break;
        }
        case 'ryokan': {
          // 旅館: 長い瓦屋根 + 木格子の窓 + 玄関
          // 瓦屋根 (濃い灰青)
          writeInst(buf, n++, cx, top - 4, bW + 6, 9, 0.28, 0.30, 0.34, 1);
          writeInst(buf, n++, cx, top - 1, bW + 8, 2, 0.20, 0.22, 0.26, 1);   // 棟瓦
          // 屋根の筋
          for (let i = 0; i < 12; i++) {
            const rx = cx - bW * 0.45 + (bW * 0.9) * (i / 11);
            writeInst(buf, n++, rx, top - 6, 0.4, 5, 0.18, 0.20, 0.24, 0.7);
          }
          // 上段 障子窓 (明るい)
          writeInst(buf, n++, cx, bot + bH * 0.62, bW * 0.84, bH * 0.22, 0.92, 0.86, 0.62, 0.95);
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * bW * 0.12, bot + bH * 0.62, 0.6, bH * 0.20, 0.55, 0.38, 0.20, 0.85);
          }
          // 下段 木格子
          writeInst(buf, n++, cx, bot + bH * 0.25, bW * 0.84, bH * 0.30, 0.55, 0.38, 0.22, 1);
          for (let i = -4; i <= 4; i++) {
            writeInst(buf, n++, cx + i * bW * 0.09, bot + bH * 0.25, 0.4, bH * 0.28, 0.28, 0.18, 0.10, 0.85);
          }
          // 暖簾玄関
          writeInst(buf, n++, cx, bot + 5, bW * 0.18, 10, 0.20, 0.30, 0.55, 1);
          writeInst(buf, n++, cx, bot + 2, bW * 0.22, 2, 0.35, 0.28, 0.20, 1);
          // T-5: 鬼瓦 + 提灯列 + 縦看板 + 右端の庭石
          n = this.drawTileRoofCurl(buf, n, cx, top - 4, bW + 6, false);
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.88, bW * 0.70, 4);
          n = this.drawShopSign(buf, n, cx, top, bW, 1, true);
          // 庭石 (右)
          writeInst(buf, n++, cx + bW * 0.46, bot + 2, 3, 3, 0.45, 0.42, 0.38, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.46, bot + 4, 1.8, 1.8, 0.32, 0.30, 0.26, 1, 0, 1);
          break;
        }
        case 'kominka': {
          // 古民家: 茅葺き屋根 + 土壁
          writeInst(buf, n++, cx, top - 4, bW + 4, 9, 0.50, 0.38, 0.22, 1); // 茅葺き
          writeInst(buf, n++, cx, top - 2, bW + 5, 1.5, 0.38, 0.28, 0.16, 0.9);
          // 表面ブラシパターン
          for (let i = 0; i < 8; i++) {
            const rx = cx - bW * 0.45 + (bW * 0.9) * (i / 7);
            writeInst(buf, n++, rx, top - 4, 0.4, 7, 0.35, 0.25, 0.14, 0.6);
          }
          // 木戸・窓
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.80, bH * 0.45, 0.82, 0.70, 0.50, 1);
          writeInst(buf, n++, cx, bot + bH * 0.40, 3, bH * 0.40, 0.35, 0.22, 0.14, 0.9);
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.55, 4, 4, 0.60, 0.78, 0.82, 0.85);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.55, 4, 4, 0.60, 0.78, 0.82, 0.85);
          // T-5: 鬼瓦 + 煙突 + 窓枠 + 外階段 + 屋根棟の茅束
          n = this.drawTileRoofCurl(buf, n, cx, top - 4, bW + 4, false);
          // 煙突
          writeInst(buf, n++, cx - bW * 0.25, top + 2, 2, 6, 0.40, 0.32, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.25, top + 5, 2.8, 1, 0.22, 0.18, 0.12, 1);
          // 茅束 (屋根の棟)
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * 4, top - 1, 2.4, 1.4, 0.42, 0.32, 0.18, 0.85);
          }
          n = this.drawWindowFrame(buf, n, cx - bW * 0.25, bot + bH * 0.55, 4, 4);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.25, bot + bH * 0.55, 4, 4);
          n = this.drawStairs(buf, n, cx + bW * 0.42, bot + 1, 4);
          break;
        }
        case 'chaya': {
          // 茶屋: 小ぢんまりした木造 + 大きな暖簾
          writeInst(buf, n++, cx, top - 2, bW + 4, 5, 0.40, 0.30, 0.18, 1); // 屋根
          writeInst(buf, n++, cx, top - 4, bW + 5, 2, 0.28, 0.20, 0.12, 1); // 棟
          // 大暖簾
          writeInst(buf, n++, cx, bot + bH * 0.65, bW * 0.90, 6, 0.25, 0.18, 0.12, 0.9); // 竿
          writeInst(buf, n++, cx - bW * 0.28, bot + bH * 0.52, bW * 0.25, bH * 0.30, 0.85, 0.25, 0.20, 1);
          writeInst(buf, n++, cx,            bot + bH * 0.52, bW * 0.25, bH * 0.30, 0.85, 0.25, 0.20, 1);
          writeInst(buf, n++, cx + bW * 0.28, bot + bH * 0.52, bW * 0.25, bH * 0.30, 0.85, 0.25, 0.20, 1);
          // 縁台
          writeInst(buf, n++, cx, bot + 4, bW * 0.82, 3, 0.45, 0.30, 0.18, 1);
          writeInst(buf, n++, cx - bW * 0.30, bot + 1, 2, 4, 0.35, 0.22, 0.12, 1);
          writeInst(buf, n++, cx + bW * 0.30, bot + 1, 2, 4, 0.35, 0.22, 0.12, 1);
          // T-5: 鬼瓦 + 提灯列 + 軒下看板 + 湯呑のお茶装飾
          n = this.drawTileRoofCurl(buf, n, cx, top - 2, bW + 4, false);
          n = this.drawChouchinRow(buf, n, cx, bot + bH * 0.82, bW * 0.80, 3);
          // 軒下の縦看板 (「茶」)
          writeInst(buf, n++, cx - bW * 0.42, cy + bH * 0.05, 3.5, bH * 0.40, 0.25, 0.18, 0.12, 1);
          writeInst(buf, n++, cx - bW * 0.42, cy + bH * 0.05, 2.8, bH * 0.34, 0.85, 0.75, 0.55, 0.92);
          // 縁台の上の湯呑 (小さな円)
          writeInst(buf, n++, cx - bW * 0.20, bot + 6, 1.5, 1.5, 0.88, 0.82, 0.72, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.20, bot + 6, 1.5, 1.5, 0.88, 0.82, 0.72, 1, 0, 1);
          // 暖簾下端のフリル (既存 3 枚の下)
          for (const xOff of [-bW * 0.28, 0, bW * 0.28]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.37, bW * 0.23, 0.8, 0.70, 0.20, 0.15, 1);
          }
          break;
        }
        // ── テーマパーク・祭り (Stage 5) ──────────────────────────
        case 'carousel': {
          // メリーゴーランド: ドーム屋根 + 柱 + 馬のシルエット
          // ドーム屋根 (縞模様)
          writeInst(buf, n++, cx, top - 4, bW + 4, 10, 0.88, 0.30, 0.35, 1);
          const stripeCol: Array<[number, number, number]> = [
            [0.95, 0.85, 0.25], [0.95, 0.55, 0.70], [0.30, 0.70, 0.90],
          ];
          for (let i = 0; i < 8; i++) {
            const col = stripeCol[i % stripeCol.length];
            const rx = cx - bW * 0.40 + (bW * 0.8) * (i / 7);
            writeInst(buf, n++, rx, top - 4, bW * 0.10, 8, col[0], col[1], col[2], 0.9);
          }
          // 頂点
          writeInst(buf, n++, cx, top + 4, 3, 9, 0.95, 0.80, 0.25, 1);
          writeInst(buf, n++, cx, top + 9, 5, 3, 0.95, 0.55, 0.15, 1);
          // 中央柱
          writeInst(buf, n++, cx, cy, 6, bH * 0.55, 0.85, 0.78, 0.55, 1);
          // 周囲の柱 (4 本)
          for (let i = -1; i <= 1; i += 2) {
            writeInst(buf, n++, cx + i * bW * 0.38, bot + bH * 0.35, 1.8, bH * 0.50, 0.92, 0.72, 0.20, 1);
          }
          // 馬のシルエット (小さな横楕円 3 つ)
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.24, bot + bH * 0.30, 7, 5, 0.95, 0.90, 0.82, 1, 0, 1);
            writeInst(buf, n++, cx + i * bW * 0.24, bot + bH * 0.42, 2, 5, 0.95, 0.90, 0.82, 1);
          }
          break;
        }
        case 'roller_coaster': {
          // ジェットコースター: うねるレール + 支柱 + カート
          // 支柱グリッド
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * bW * 0.20, bot + bH * 0.35, 1.5, bH * 0.70, 0.75, 0.30, 0.30, 1);
          }
          // 横梁
          for (let i = -2; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.20 + bW * 0.10, bot + bH * 0.55, bW * 0.20, 1, 0.75, 0.30, 0.30, 0.7);
          }
          // 主レール (湾曲を短矩形で近似)
          const railPts: Array<[number, number, number, number]> = [
            [-0.40, 0.85, 0.20, 0.02],
            [-0.20, 0.80, 0.22, 0.03],
            [ 0.10, 0.95, 0.30, 0.02],
            [ 0.35, 0.75, 0.22, 0.03],
          ];
          for (const [rx, ry, rw, rh] of railPts) {
            writeInst(buf, n++, cx + rx * bW, bot + ry * bH, rw * bW, Math.max(1.5, rh * bH), 0.30, 0.35, 0.42, 1);
          }
          // カート 3 両 (黄)
          writeInst(buf, n++, cx - bW * 0.15, bot + bH * 0.72, 6, 4, 0.95, 0.80, 0.20, 1);
          writeInst(buf, n++, cx - bW * 0.05, bot + bH * 0.72, 6, 4, 0.95, 0.80, 0.20, 1);
          writeInst(buf, n++, cx + bW * 0.05, bot + bH * 0.72, 6, 4, 0.95, 0.80, 0.20, 1);
          // 地上の客
          writeInst(buf, n++, cx - bW * 0.35, bot + 3, 3, 5, 0.30, 0.50, 0.80, 1);
          writeInst(buf, n++, cx + bW * 0.35, bot + 3, 3, 5, 0.80, 0.30, 0.50, 1);
          break;
        }
        case 'yatai': {
          // 屋台: 木枠 + 赤白テント
          writeInst(buf, n++, cx, top - 2, bW + 4, 5, 0.85, 0.25, 0.20, 1); // 赤屋根
          // 白ストライプ
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.32, top - 2, bW * 0.18, 4, 0.95, 0.92, 0.88, 0.9);
          }
          // カウンター
          writeInst(buf, n++, cx, bot + 3, bW * 0.90, 4, 0.55, 0.38, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.42, bot + 1, 2, 6, 0.40, 0.25, 0.14, 1);
          writeInst(buf, n++, cx + bW * 0.42, bot + 1, 2, 6, 0.40, 0.25, 0.14, 1);
          // メニュー看板
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.35, 4, 0.95, 0.90, 0.30, 1);
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.30, 2, 0.15, 0.10, 0.05, 0.85);
          // 提灯
          writeInst(buf, n++, cx - bW * 0.35, bot + bH * 0.65, 3, 4, 0.92, 0.18, 0.10, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.35, bot + bH * 0.65, 3, 4, 0.92, 0.18, 0.10, 1, 0, 1);
          break;
        }
        case 'big_tent': {
          // 祭り大テント: 三角屋根 + ストライプ壁
          writeInst(buf, n++, cx, top - 6, bW + 6, 12, 0.88, 0.25, 0.22, 1); // 三角風
          writeInst(buf, n++, cx, top + 2, 4, 6, 0.95, 0.85, 0.25, 1);       // 屋根頂旗
          writeInst(buf, n++, cx + 3, top + 4, 6, 3, 0.92, 0.35, 0.20, 0.9);
          // 壁面ストライプ
          const stripes = [
            [0.95, 0.92, 0.88], [0.88, 0.28, 0.22], [0.95, 0.92, 0.88],
            [0.88, 0.28, 0.22], [0.95, 0.92, 0.88], [0.88, 0.28, 0.22],
          ];
          const stripeW = bW * 0.90 / stripes.length;
          for (let i = 0; i < stripes.length; i++) {
            const col = stripes[i];
            const sx = cx - bW * 0.45 + stripeW * (i + 0.5);
            writeInst(buf, n++, sx, bot + bH * 0.35, stripeW - 0.4, bH * 0.60, col[0], col[1], col[2], 1);
          }
          // 中央エントランス
          writeInst(buf, n++, cx, bot + 6, bW * 0.20, 13, 0.25, 0.18, 0.12, 1);
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.28, 3, 0.95, 0.85, 0.25, 0.95);
          break;
        }
        // ── 特大施設 ────────────────────────────────────────────
        case 'department_store': {
          // 屋上看板帯（濃い色）
          writeInst(buf, n++, cx, top - 3.5, bW + 4, 7, cr * 0.50, cg * 0.35, cb * 0.15, 1);
          // 各フロア帯（3階）
          const dsFlH = bH / 4;
          for (let i = 1; i <= 3; i++) {
            writeInst(buf, n++, cx, bot + dsFlH * i, bW + 2, 2, cr * 0.72, cg * 0.60, cb * 0.38, 0.9);
          }
          // 大型ショーウィンドウ（1F）
          writeInst(buf, n++, cx, bot + dsFlH * 0.55, bW * 0.82, dsFlH * 0.75,
            0.72, 0.90, 0.98, 0.85);
          // 2F・3F 連続窓
          writeInst(buf, n++, cx, bot + dsFlH * 1.55, bW * 0.80, dsFlH * 0.65,
            0.65, 0.85, 0.95, 0.80);
          writeInst(buf, n++, cx, bot + dsFlH * 2.55, bW * 0.80, dsFlH * 0.65,
            0.65, 0.85, 0.95, 0.80);
          // 中央エントランス（屋根庇付き）
          writeInst(buf, n++, cx, bot + 6, bW * 0.18, 11, 0.28, 0.22, 0.18, 1);
          writeInst(buf, n++, cx, bot + dsFlH * 0.85, bW * 0.26, 3, cr * 0.60, cg * 0.45, cb * 0.22, 0.9);
          // 屋上旗竿×2
          writeInst(buf, n++, cx - bW * 0.38, top + 5, 1.5, 10, cr * 0.65, cg * 0.55, cb * 0.35, 1);
          writeInst(buf, n++, cx + bW * 0.38, top + 5, 1.5, 10, cr * 0.65, cg * 0.55, cb * 0.35, 1);
          writeInst(buf, n++, cx - bW * 0.38 + 5, top + 9, 8, 4, 0.88, 0.18, 0.18, 1);
          writeInst(buf, n++, cx + bW * 0.38 + 5, top + 9, 8, 4, 0.20, 0.38, 0.88, 1);
          // T-4: 垂れ幕×3 + 屋上広告塔 + 屋上クラッター + エントランスキャノピー
          // 垂れ幕 (SALE/OPEN/NEW)
          const banColors: Array<[number, number, number]> = [[0.92, 0.22, 0.22], [0.20, 0.55, 0.82], [0.92, 0.72, 0.15]];
          for (let i = 0; i < 3; i++) {
            const bcx = cx - bW * 0.30 + i * (bW * 0.30);
            const [br, bg, bb] = banColors[i];
            writeInst(buf, n++, bcx, bot + dsFlH * 2.2, 5, dsFlH * 1.8, br, bg, bb, 0.95);
            writeInst(buf, n++, bcx, bot + dsFlH * 2.2, 4.2, dsFlH * 1.6, 0.98, 0.95, 0.88, 0.85);
            // 垂れ幕下端のフリル
            writeInst(buf, n++, bcx, bot + dsFlH * 2.2 - dsFlH * 0.88, 5, 1.2, br * 0.82, bg * 0.82, bb * 0.82, 1);
          }
          // 屋上広告塔
          writeInst(buf, n++, cx, top + 12, 4, 18, cr * 0.52, cg * 0.42, cb * 0.22, 1);
          writeInst(buf, n++, cx, top + 20, 16, 6, 0.95, 0.22, 0.22, 1);
          writeInst(buf, n++, cx, top + 20, 14, 4, 0.98, 0.95, 0.88, 0.92);
          // 屋上クラッター
          const dsSeed = Math.abs(Math.floor(cx * 13.7 + bot * 7.3));
          n = this.drawFlatRoofClutter(buf, n, cx - bW * 0.30, top, bW * 0.35, dsSeed);
          n = this.drawFlatRoofClutter(buf, n, cx + bW * 0.30, top, bW * 0.35, dsSeed + 7);
          // エントランスキャノピー
          n = this.drawEntranceCanopy(buf, n, cx, bot, bW);
          break;
        }
        // ── Stage 1 ミニチュア追加 ────────────────────────────────
        case 'shotengai_arcade': {
          // 商店街アーケード (薄い屋根帯)。高さ bH=6 を軒屋根として描く
          // 透明アクリルパネル調 (薄青)
          writeInst(buf, n++, cx, cy, bW, bH - 0.8, 0.72, 0.85, 0.95, 0.62);
          // 骨組み (水平梁)
          writeInst(buf, n++, cx, top - 0.5, bW, 1, 0.35, 0.38, 0.42, 1);
          writeInst(buf, n++, cx, bot + 0.5, bW, 1, 0.35, 0.38, 0.42, 1);
          // 縦リブ (10 本)
          for (let i = 0; i < 10; i++) {
            const rx = cx - bW * 0.48 + (bW * 0.96) * (i / 9);
            writeInst(buf, n++, rx, cy, 0.4, bH, 0.45, 0.48, 0.52, 0.85);
          }
          // ぶら下げ看板/提灯
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * bW * 0.13, bot - 2, 3, 3, 0.92, 0.35, 0.18, 1, 0, 1);
          }
          // 上端の店名幕
          writeInst(buf, n++, cx, top + 2, bW * 0.88, 2, 0.88, 0.22, 0.18, 1);
          writeInst(buf, n++, cx, top + 2, bW * 0.82, 1, 0.98, 0.92, 0.65, 0.92);
          break;
        }
        case 'bus_terminal_shelter': {
          // バスターミナル屋根 (長大庇)
          writeInst(buf, n++, cx, top - 2, bW + 8, 4, 0.52, 0.55, 0.60, 1);
          writeInst(buf, n++, cx, top - 4, bW + 10, 1.4, 0.40, 0.42, 0.48, 1);
          // 支柱 4 本
          for (const xOff of [-bW * 0.42, -bW * 0.14, bW * 0.14, bW * 0.42]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.42, 1.6, bH * 0.82, 0.65, 0.65, 0.68, 1);
          }
          // 背面壁 (広告)
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.80, bH * 0.55, 0.92, 0.92, 0.88, 1);
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.72, bH * 0.25, 0.25, 0.55, 0.85, 0.92);
          // ベンチ
          writeInst(buf, n++, cx, bot + 1.5, bW * 0.75, 1.2, 0.45, 0.32, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.34, bot + 0.5, 1.5, 1.5, 0.40, 0.28, 0.18, 1);
          writeInst(buf, n++, cx + bW * 0.34, bot + 0.5, 1.5, 1.5, 0.40, 0.28, 0.18, 1);
          // 路線表示板 (左端支柱)
          writeInst(buf, n++, cx - bW * 0.48, top - 6, 4, 6, 0.20, 0.35, 0.68, 1);
          writeInst(buf, n++, cx - bW * 0.48, top - 6, 3, 5, 0.95, 0.92, 0.88, 0.92);
          break;
        }
        case 'fountain_pavilion': {
          // 噴水パビリオン (中央の円形ドーム)
          // 基壇 (八角形簡略=大きな円)
          writeInst(buf, n++, cx, bot + 1.2, bW, 2, 0.65, 0.62, 0.58, 1, 0, 1);
          writeInst(buf, n++, cx, bot + 2.5, bW * 0.78, 2, 0.78, 0.75, 0.70, 1, 0, 1);
          // 水盤
          writeInst(buf, n++, cx, bot + 4, bW * 0.62, 3, 0.45, 0.72, 0.92, 0.88, 0, 1);
          writeInst(buf, n++, cx, bot + 4, bW * 0.52, 2, 0.65, 0.85, 0.98, 0.82, 0, 1);
          // 中央柱+噴水
          writeInst(buf, n++, cx, bot + 7, 2, 8, 0.72, 0.68, 0.58, 1);
          writeInst(buf, n++, cx, bot + 11, 3, 3, 0.88, 0.85, 0.75, 1, 0, 1);
          // 吹き上がる水 (3 本)
          for (const xOff of [-2, 0, 2]) {
            writeInst(buf, n++, cx + xOff, bot + 13, 0.8, 5, 0.72, 0.90, 0.98, 0.75);
          }
          // ドーム屋根 (4 本柱で支える)
          for (const xOff of [-bW * 0.35, -bW * 0.12, bW * 0.12, bW * 0.35]) {
            writeInst(buf, n++, cx + xOff, top - bH * 0.25, 1.4, bH * 0.55, 0.75, 0.72, 0.65, 1);
          }
          writeInst(buf, n++, cx, top - 2, bW + 2, 3, 0.55, 0.42, 0.28, 1, 0, 1);
          writeInst(buf, n++, cx, top + 1, 3, 4, 0.85, 0.72, 0.28, 1);
          break;
        }
        // ── Stage 2 夜街 ─────────────────────────────────────────
        case 'snack': {
          // ピンクネオン帯 + 小窓 + ママの縦看板
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.95, 0.35, 0.62, 1);
          writeInst(buf, n++, cx, top - 7, bW, 2, 0.85, 0.22, 0.72, 0.9);
          // ハート看板 (上端)
          writeInst(buf, n++, cx, top + 2, 5, 5, 0.98, 0.28, 0.55, 1, 0, 1);
          // 小窓 (2つ)
          writeInst(buf, n++, cx - bW * 0.28, bot + bH * 0.55, bW * 0.28, bH * 0.22, 0.95, 0.72, 0.85, 0.72);
          writeInst(buf, n++, cx + bW * 0.28, bot + bH * 0.55, bW * 0.28, bH * 0.22, 0.95, 0.72, 0.85, 0.72);
          n = this.drawShopSign(buf, n, cx, top, bW, 3, true);
          // ドア (小さく)
          writeInst(buf, n++, cx, bot + 5, bW * 0.22, 9, 0.25, 0.10, 0.18, 1);
          // 鉢植えのバラ (入口)
          writeInst(buf, n++, cx - bW * 0.38, bot + 2, 2, 3, 0.92, 0.28, 0.42, 1);
          break;
        }
        case 'love_hotel': {
          // 紫系派手ネオン + ハート窓 + 城風コーニス
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.92, 0.28, 0.85, 1);
          writeInst(buf, n++, cx, top - 8, bW, 3, 0.62, 0.22, 0.88, 0.9);
          // ハート型ネオン
          writeInst(buf, n++, cx, top + 3, 8, 7, 0.98, 0.35, 0.68, 1, 0, 1);
          writeInst(buf, n++, cx, top + 3, 5, 4, 0.95, 0.82, 0.90, 0.95, 0, 1);
          // 城風の屋根装飾 (3 つの塔頂)
          for (const xOff of [-bW * 0.40, 0, bW * 0.40]) {
            writeInst(buf, n++, cx + xOff, top + 1, 3, 4, 0.78, 0.32, 0.75, 1);
            writeInst(buf, n++, cx + xOff, top + 4, 1.5, 3, 0.92, 0.72, 0.32, 1);
          }
          // 格子状の小窓 (3×5)
          for (let j = 0; j < 3; j++) {
            for (let i = -2; i <= 2; i++) {
              writeInst(buf, n++, cx + i * bW * 0.18, bot + bH * 0.22 + j * bH * 0.20, 2, 2.5,
                0.98, 0.85, 0.62, 0.72);
            }
          }
          // 縦ネオン輪郭
          writeInst(buf, n++, cx - bW * 0.48, cy, 0.8, bH * 0.88, 0.98, 0.35, 0.85, 0.85);
          writeInst(buf, n++, cx + bW * 0.48, cy, 0.8, bH * 0.88, 0.98, 0.35, 0.85, 0.85);
          n = this.drawShopSign(buf, n, cx, top, bW, 1, true);
          // 入口 (低い開口)
          writeInst(buf, n++, cx, bot + 4, bW * 0.28, 7, 0.18, 0.12, 0.22, 1);
          break;
        }
        case 'business_hotel': {
          // 白ボディ + 格子窓多数 + 上端ロゴ
          writeInst(buf, n++, cx, top - 3, bW, 5, 0.92, 0.90, 0.86, 1);
          // 縦ロゴ (青)
          writeInst(buf, n++, cx - bW * 0.40, cy, 2.5, bH * 0.72, 0.22, 0.38, 0.68, 1);
          // 格子窓 (4 列 × 7-8 段)
          const bhRows = Math.floor(bH / 8);
          for (let j = 0; j < bhRows; j++) {
            for (let i = -1.5; i <= 1.5; i += 1) {
              writeInst(buf, n++, cx + i * bW * 0.22, bot + bH * 0.15 + j * 6, 2.4, 3,
                0.98, 0.92, 0.68, 0.78);
            }
          }
          // エントランス (ガラス)
          writeInst(buf, n++, cx, bot + 5, bW * 0.55, 8, 0.62, 0.78, 0.88, 0.72);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 3);
          // 上端のロゴ帯
          writeInst(buf, n++, cx + bW * 0.05, top - 6, bW * 0.45, 3, 0.22, 0.38, 0.68, 0.95);
          break;
        }
        case 'mahjong_parlor': {
          // 緑看板 + 「雀」イメージ + 古い雑居感
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.35, 0.52, 0.32, 1);
          writeInst(buf, n++, cx, top - 7, bW, 2, 0.92, 0.92, 0.22, 0.92);  // 黄色帯
          // 縦看板 (濃緑)
          writeInst(buf, n++, cx - bW * 0.38, cy, 3.5, bH * 0.72, 0.22, 0.42, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.38, cy, 2.5, bH * 0.62, 0.95, 0.92, 0.28, 0.95);
          // 雀卓を思わせるショーウィンドウ (横長)
          writeInst(buf, n++, cx + bW * 0.08, bot + bH * 0.45, bW * 0.52, bH * 0.28, 0.72, 0.88, 0.72, 0.78);
          n = this.drawWindowFrame(buf, n, cx + bW * 0.08, bot + bH * 0.45, bW * 0.52, bH * 0.28);
          // 階段 (2F入口)
          n = this.drawStairs(buf, n, cx + bW * 0.44, bot + 1, 6);
          // 古い看板 (赤錆)
          writeInst(buf, n++, cx, bot + bH * 0.88, bW * 0.65, 2, 0.72, 0.28, 0.18, 1);
          break;
        }
        case 'club': {
          // 黒ボディ + 金色ネオン + 入口ドアマンライト
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.12, 0.10, 0.14, 1);
          writeInst(buf, n++, cx, top - 8, bW, 3, 0.92, 0.72, 0.18, 0.95);  // 金帯
          // 縦金ネオン
          writeInst(buf, n++, cx - bW * 0.45, cy, 0.8, bH * 0.82, 0.95, 0.78, 0.22, 0.92);
          writeInst(buf, n++, cx + bW * 0.45, cy, 0.8, bH * 0.82, 0.95, 0.78, 0.22, 0.92);
          // VIP ドア (金縁)
          writeInst(buf, n++, cx, bot + 8, bW * 0.30, 14, 0.72, 0.55, 0.22, 1);
          writeInst(buf, n++, cx, bot + 8, bW * 0.24, 12, 0.15, 0.10, 0.12, 1);
          // ドアの両脇のライト (赤)
          writeInst(buf, n++, cx - bW * 0.22, bot + 4, 1.5, 2, 0.92, 0.22, 0.22, 1, 0, 1);
          writeInst(buf, n++, cx + bW * 0.22, bot + 4, 1.5, 2, 0.92, 0.22, 0.22, 1, 0, 1);
          // ロゴ帯 (金)
          writeInst(buf, n++, cx, top + 2, bW * 0.75, 3, 0.95, 0.82, 0.32, 1);
          writeInst(buf, n++, cx, top + 2, bW * 0.65, 1.5, 0.15, 0.08, 0.12, 0.95);
          n = this.drawShopSign(buf, n, cx, top, bW, 2, true);
          break;
        }
        case 'capsule_hotel': {
          // 横長 + カプセル型丸窓の蜂の巣配列
          writeInst(buf, n++, cx, top - 3, bW, 5, 0.62, 0.75, 0.88, 1);
          // 蜂の巣窓 (千鳥配置 3 段)
          const colsCap = Math.floor(bW / 7);
          for (let j = 0; j < 3; j++) {
            const offset = (j % 2) * 3.5;
            for (let i = 0; i < colsCap; i++) {
              const rx = cx - bW * 0.46 + offset + i * 7;
              if (rx > cx + bW * 0.46) break;
              writeInst(buf, n++, rx, bot + bH * 0.25 + j * bH * 0.22, 3, 3.5,
                0.92, 0.95, 0.98, 0.78, 0, 1);
            }
          }
          // エントランス
          writeInst(buf, n++, cx, bot + 5, bW * 0.22, 9, 0.35, 0.52, 0.68, 1);
          n = this.drawDoorDetail(buf, n, cx, bot, bW, 1);
          // 上端ロゴ
          writeInst(buf, n++, cx + bW * 0.30, top - 6, bW * 0.32, 2.5, 0.22, 0.42, 0.68, 0.95);
          break;
        }
        // ── Stage 3 和風 ───────────────────────────────────────
        case 'kura': {
          // 土蔵: 白壁 + なまこ壁の黒格子 + 瓦屋根
          // 本体 (白壁はデフォルト色で描画される想定)
          // 瓦屋根 (濃茶)
          writeInst(buf, n++, cx, top - 2, bW + 3, 3.5, 0.42, 0.32, 0.25, 1);
          writeInst(buf, n++, cx, top + 1, bW + 5, 1.5, 0.28, 0.22, 0.18, 1);
          // なまこ壁 (黒格子の斜め模様を水平線で略)
          writeInst(buf, n++, cx, bot + bH * 0.22, bW * 0.85, 1.2, 0.22, 0.18, 0.16, 0.92);
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.85, 1.2, 0.22, 0.18, 0.16, 0.92);
          // 小窓 (格子)
          writeInst(buf, n++, cx, bot + bH * 0.60, bW * 0.32, bH * 0.18, 0.45, 0.35, 0.25, 0.92);
          writeInst(buf, n++, cx, bot + bH * 0.60, bW * 0.28, bH * 0.14, 0.82, 0.72, 0.52, 0.85);
          // 観音扉 (黒く厚い)
          writeInst(buf, n++, cx, bot + 4, bW * 0.38, 8, 0.22, 0.18, 0.16, 1);
          writeInst(buf, n++, cx, bot + 4, 0.5, 8, 0.52, 0.42, 0.32, 1);
          break;
        }
        case 'machiya': {
          // 町家: 2 階建て木造 + 1F 格子戸 + 2F 虫籠窓 + 瓦屋根
          // 瓦屋根 (濃茶、長い庇)
          writeInst(buf, n++, cx, top - 3, bW + 4, 5, 0.32, 0.25, 0.18, 1);
          writeInst(buf, n++, cx, top + 1, bW + 6, 2, 0.22, 0.18, 0.14, 1);
          // 2F 虫籠窓 (格子細かい)
          writeInst(buf, n++, cx, bot + bH * 0.62, bW * 0.80, bH * 0.20, 0.45, 0.32, 0.22, 0.95);
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * bW * 0.16, bot + bH * 0.62, 0.4, bH * 0.18, 0.18, 0.12, 0.08, 0.92);
          }
          // 1F 格子戸 (こうし)
          writeInst(buf, n++, cx, bot + bH * 0.28, bW * 0.82, bH * 0.32, 0.42, 0.28, 0.18, 0.98);
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * bW * 0.12, bot + bH * 0.28, 0.35, bH * 0.28, 0.22, 0.15, 0.08, 0.95);
          }
          // 暖簾 (紺)
          writeInst(buf, n++, cx, bot + bH * 0.44, bW * 0.65, 2.5, 0.22, 0.28, 0.52, 0.95);
          // 玄関の石段
          n = this.drawStairs(buf, n, cx, bot + 1, 4);
          break;
        }
        case 'onsen_inn': {
          // 温泉旅館: 大きな木造 + 煙突 + 湯気 + 暖簾 + 石段
          // 瓦屋根 (濃茶、大庇)
          writeInst(buf, n++, cx, top - 3, bW + 6, 5, 0.25, 0.18, 0.12, 1);
          writeInst(buf, n++, cx, top + 1, bW + 8, 2, 0.18, 0.12, 0.08, 1);
          // 破風 (屋根中央の三角)
          writeInst(buf, n++, cx, top + 4, bW * 0.28, 4, 0.22, 0.15, 0.10, 1);
          // 煙突 (右端) + 湯気
          writeInst(buf, n++, cx + bW * 0.38, top + 6, 2.5, 6, 0.35, 0.28, 0.22, 1);
          writeInst(buf, n++, cx + bW * 0.38, top + 12, 4, 3, 0.88, 0.85, 0.82, 0.42, 0, 1);
          writeInst(buf, n++, cx + bW * 0.36, top + 15, 5, 3.5, 0.82, 0.80, 0.78, 0.32, 0, 1);
          writeInst(buf, n++, cx + bW * 0.40, top + 18, 6, 4, 0.78, 0.75, 0.72, 0.22, 0, 1);
          // 2F 障子窓 (横並び)
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * bW * 0.18, bot + bH * 0.68, bW * 0.12, bH * 0.14,
              0.92, 0.85, 0.62, 0.72);
          }
          // 1F 格子 + 玄関
          writeInst(buf, n++, cx, bot + bH * 0.32, bW * 0.88, bH * 0.30, 0.42, 0.28, 0.18, 0.98);
          // 暖簾 (紺、大きい)
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.50, 3.5, 0.18, 0.25, 0.48, 0.95);
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.44, 2, 0.92, 0.85, 0.62, 0.92);
          // 玄関の石段
          n = this.drawStairs(buf, n, cx, bot + 1, 5);
          // 左右の石灯籠 (組み込み)
          writeInst(buf, n++, cx - bW * 0.46, bot + 3, 2, 5, 0.52, 0.45, 0.38, 1);
          writeInst(buf, n++, cx + bW * 0.46, bot + 3, 2, 5, 0.52, 0.45, 0.38, 1);
          break;
        }
        case 'castle': {
          // ★★★ テーマパークのファンタジー城 (童話の魔法城) ★★★
          // パステル漆喰 + 3 本の尖塔 (円錐屋根) + 星の先端 + バルーンと旗の装飾
          // ──── 基礎: パステル石壁 ────
          writeInst(buf, n++, cx, bot + 6, bW + 4, 12, 0.88, 0.80, 0.82, 1);
          writeInst(buf, n++, cx, bot + 1, bW + 8, 2, 0.72, 0.62, 0.66, 1);
          // 石の継ぎ目 (市松)
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * bW * 0.18, bot + 4, bW * 0.15, 3, 0.92, 0.86, 0.88, 1);
            writeInst(buf, n++, cx + i * bW * 0.18 + bW * 0.09, bot + 9, bW * 0.15, 3, 0.90, 0.84, 0.86, 1);
          }
          // ──── メイン本体 (大きな胴体) ────
          const bodyY = bot + 20;
          const bodyW = bW * 0.82;
          const bodyH = bH * 0.40;
          writeInst(buf, n++, cx, bodyY + bodyH / 2, bodyW, bodyH, cr, cg, cb, 1);
          // 胸壁 (くびれの段差)
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * bodyW * 0.14, bodyY + bodyH - 1, bodyW * 0.10, 2.5, cr * 0.92, cg * 0.88, cb * 0.92, 1);
          }
          // ハート型の窓 2 つ (下段)
          writeInst(buf, n++, cx - bodyW * 0.28, bodyY + bodyH * 0.30, bodyW * 0.14, bodyH * 0.22, 0.42, 0.25, 0.45, 0.92);
          writeInst(buf, n++, cx - bodyW * 0.28, bodyY + bodyH * 0.35, bodyW * 0.10, bodyH * 0.14, 0.88, 0.68, 0.78, 0.85);
          writeInst(buf, n++, cx + bodyW * 0.28, bodyY + bodyH * 0.30, bodyW * 0.14, bodyH * 0.22, 0.42, 0.25, 0.45, 0.92);
          writeInst(buf, n++, cx + bodyW * 0.28, bodyY + bodyH * 0.35, bodyW * 0.10, bodyH * 0.14, 0.88, 0.68, 0.78, 0.85);
          // 星型の窓 (中央上)
          writeInst(buf, n++, cx, bodyY + bodyH * 0.62, bodyW * 0.16, bodyH * 0.20, 0.42, 0.25, 0.45, 0.92);
          writeInst(buf, n++, cx, bodyY + bodyH * 0.62, bodyW * 0.14, bodyH * 0.16, 0.98, 0.88, 0.40, 0.88);
          writeInst(buf, n++, cx, bodyY + bodyH * 0.62, bodyW * 0.10, bodyH * 0.12, 0.95, 0.75, 0.25, 0.85);
          // ──── 3 本の尖塔 (メイン中央 + サイド 2 本) ────
          // --- サイド塔 (西) ---
          const sideLx = cx - bodyW * 0.40;
          const sideBot = bodyY + bodyH + 2;
          const sideW = bW * 0.20;
          const sideH = bH * 0.25;
          writeInst(buf, n++, sideLx, sideBot + sideH / 2, sideW, sideH, cr, cg, cb, 1);
          writeInst(buf, n++, sideLx, sideBot + sideH * 0.55, sideW * 0.42, sideH * 0.36, 0.42, 0.25, 0.45, 0.9);
          writeInst(buf, n++, sideLx, sideBot + sideH * 0.55, sideW * 0.35, sideH * 0.30, 0.88, 0.68, 0.78, 0.85);
          // 西塔の円錐屋根 (紫)
          const sideLconeY = sideBot + sideH + 1;
          writeInst(buf, n++, sideLx, sideLconeY + 4, sideW * 0.85, 8, 0.62, 0.42, 0.75, 1);
          writeInst(buf, n++, sideLx, sideLconeY + 7, sideW * 0.55, 5, 0.72, 0.52, 0.82, 1);
          writeInst(buf, n++, sideLx, sideLconeY + 9, sideW * 0.30, 3, 0.82, 0.62, 0.88, 1);
          // 西塔の先端: 旗
          writeInst(buf, n++, sideLx, sideLconeY + 12, 0.6, 4, 0.92, 0.78, 0.25, 1);
          writeInst(buf, n++, sideLx + 2, sideLconeY + 13, 3, 2, 0.92, 0.32, 0.28, 1);
          // --- サイド塔 (東) ---
          const sideRx = cx + bodyW * 0.40;
          writeInst(buf, n++, sideRx, sideBot + sideH / 2, sideW, sideH, cr, cg, cb, 1);
          writeInst(buf, n++, sideRx, sideBot + sideH * 0.55, sideW * 0.42, sideH * 0.36, 0.42, 0.25, 0.45, 0.9);
          writeInst(buf, n++, sideRx, sideBot + sideH * 0.55, sideW * 0.35, sideH * 0.30, 0.88, 0.68, 0.78, 0.85);
          writeInst(buf, n++, sideRx, sideLconeY + 4, sideW * 0.85, 8, 0.62, 0.42, 0.75, 1);
          writeInst(buf, n++, sideRx, sideLconeY + 7, sideW * 0.55, 5, 0.72, 0.52, 0.82, 1);
          writeInst(buf, n++, sideRx, sideLconeY + 9, sideW * 0.30, 3, 0.82, 0.62, 0.88, 1);
          writeInst(buf, n++, sideRx, sideLconeY + 12, 0.6, 4, 0.92, 0.78, 0.25, 1);
          writeInst(buf, n++, sideRx + 2, sideLconeY + 13, 3, 2, 0.32, 0.78, 0.92, 1);
          // --- 中央大塔 (メイン) ---
          const mainBot = bodyY + bodyH + 1;
          const mainW = bW * 0.42;
          const mainH = bH * 0.40;
          writeInst(buf, n++, cx, mainBot + mainH / 2, mainW, mainH, cr, cg, cb, 1);
          // 中央塔の胸壁 (小段差)
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, cx + i * mainW * 0.18, mainBot + mainH - 1, mainW * 0.12, 2, cr * 0.92, cg * 0.88, cb * 0.92, 1);
          }
          // 中央塔の大窓 (ティアラ型: 半円アーチ)
          writeInst(buf, n++, cx, mainBot + mainH * 0.42, mainW * 0.38, mainH * 0.45, 0.42, 0.25, 0.55, 0.92);
          writeInst(buf, n++, cx, mainBot + mainH * 0.50, mainW * 0.32, mainH * 0.35, 0.85, 0.62, 0.88, 0.85);
          writeInst(buf, n++, cx, mainBot + mainH * 0.55, mainW * 0.22, mainH * 0.18, 0.42, 0.25, 0.55, 0.92); // 窓の内側模様
          // バルコニー (中央塔 中段)
          writeInst(buf, n++, cx, mainBot + mainH * 0.18, mainW * 1.08, 2, 0.78, 0.62, 0.72, 1);
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, cx + i * mainW * 0.14, mainBot + mainH * 0.20, 0.8, 4, 0.68, 0.52, 0.62, 0.9);
          }
          // 中央塔の円錐屋根 (ピンク)
          const mainConeY = mainBot + mainH + 1;
          writeInst(buf, n++, cx, mainConeY + 6, mainW * 0.88, 12, 0.92, 0.42, 0.58, 1);
          writeInst(buf, n++, cx, mainConeY + 11, mainW * 0.60, 8, 0.95, 0.52, 0.68, 1);
          writeInst(buf, n++, cx, mainConeY + 15, mainW * 0.32, 5, 0.98, 0.62, 0.78, 1);
          writeInst(buf, n++, cx, mainConeY + 18, mainW * 0.12, 3, 0.98, 0.72, 0.85, 1);
          // ──── ★ 先端の金の星 ★ ────
          writeInst(buf, n++, cx, mainConeY + 22, 1, 6, 0.78, 0.60, 0.20, 1);             // 支柱
          writeInst(buf, n++, cx, mainConeY + 24, 5, 5, 0.98, 0.85, 0.25, 1, 0, 1);        // 星 (円で近似)
          writeInst(buf, n++, cx, mainConeY + 24, 3.5, 3.5, 1.0, 0.95, 0.55, 0.92, 0, 1);  // 星中央
          writeInst(buf, n++, cx - 3, mainConeY + 24, 1.2, 1.2, 1.0, 0.95, 0.40, 0.92, 0, 1); // 煌き
          writeInst(buf, n++, cx + 3, mainConeY + 24, 1.2, 1.2, 1.0, 0.95, 0.40, 0.92, 0, 1);
          writeInst(buf, n++, cx, mainConeY + 27, 1.2, 1.2, 1.0, 0.95, 0.40, 0.92, 0, 1);
          // ──── 大門 (アーチ + 王冠装飾) ────
          writeInst(buf, n++, cx, bot + 8, bW * 0.24, 14, 0.35, 0.22, 0.30, 1);
          writeInst(buf, n++, cx, bot + 6, bW * 0.22, 11, 0.55, 0.32, 0.48, 0.9);
          writeInst(buf, n++, cx, bot + 14, bW * 0.18, 2.5, 0.88, 0.42, 0.65, 1);          // アーチ上の帯
          // 門の両脇の小旗
          writeInst(buf, n++, cx - bW * 0.16, bot + 16, 0.5, 3, 0.75, 0.60, 0.25, 1);
          writeInst(buf, n++, cx - bW * 0.13, bot + 17, 2, 1.5, 0.42, 0.78, 0.32, 1);
          writeInst(buf, n++, cx + bW * 0.16, bot + 16, 0.5, 3, 0.75, 0.60, 0.25, 1);
          writeInst(buf, n++, cx + bW * 0.13, bot + 17, 2, 1.5, 0.32, 0.52, 0.92, 1);
          // ──── 装飾: 風船 (両脇) + 旗のガーランド ────
          // 風船クラスタ 左
          writeInst(buf, n++, cx - bW * 0.48, bot + 20, 2.5, 2.5, 0.92, 0.32, 0.42, 0.95, 0, 1);
          writeInst(buf, n++, cx - bW * 0.42, bot + 22, 2.2, 2.2, 0.42, 0.72, 0.92, 0.95, 0, 1);
          writeInst(buf, n++, cx - bW * 0.52, bot + 24, 2.0, 2.0, 0.92, 0.78, 0.22, 0.95, 0, 1);
          // 風船クラスタ 右
          writeInst(buf, n++, cx + bW * 0.48, bot + 20, 2.5, 2.5, 0.42, 0.85, 0.42, 0.95, 0, 1);
          writeInst(buf, n++, cx + bW * 0.42, bot + 22, 2.2, 2.2, 0.82, 0.42, 0.92, 0.95, 0, 1);
          writeInst(buf, n++, cx + bW * 0.52, bot + 24, 2.0, 2.0, 0.92, 0.52, 0.22, 0.95, 0, 1);
          // 三角旗ガーランド (胴体の上を横断)
          for (let i = -4; i <= 4; i++) {
            const fx = cx + i * bodyW * 0.11;
            const colors: Array<[number, number, number]> = [
              [0.92, 0.32, 0.42], [0.42, 0.72, 0.92], [0.92, 0.78, 0.22],
              [0.42, 0.85, 0.42], [0.82, 0.42, 0.92],
            ];
            const col = colors[(i + 4) % colors.length];
            writeInst(buf, n++, fx, bodyY - 2, 2.2, 2.4, col[0], col[1], col[2], 1);
          }
          break;
        }
        case 'tahoto': {
          // 多宝塔: 下層方形 + 上層円形の 2 層塔 + 相輪
          // 方形下層 (本体、朱塗り)
          writeInst(buf, n++, cx, bot + bH * 0.22, bW * 0.95, bH * 0.40, 0.72, 0.28, 0.20, 1);
          // 下層の屋根 (濃茶の瓦、広い)
          writeInst(buf, n++, cx, bot + bH * 0.48, bW + 4, 3, 0.32, 0.22, 0.15, 1);
          writeInst(buf, n++, cx, bot + bH * 0.52, bW + 6, 1.5, 0.22, 0.15, 0.10, 1);
          // 亀腹 (白漆喰の円形)
          writeInst(buf, n++, cx, bot + bH * 0.58, bW * 0.60, 3, 0.92, 0.88, 0.82, 1, 0, 1);
          // 上層円筒 (朱塗り)
          writeInst(buf, n++, cx, bot + bH * 0.72, bW * 0.55, bH * 0.24, 0.72, 0.28, 0.20, 1);
          // 上層の屋根
          writeInst(buf, n++, cx, bot + bH * 0.86, bW * 0.85, 2.5, 0.32, 0.22, 0.15, 1);
          // 相輪 (中央の金属棒 + 宝珠)
          writeInst(buf, n++, cx, top - 6, 0.8, 10, 0.62, 0.48, 0.22, 1);
          writeInst(buf, n++, cx, top - 2, 2.5, 2.5, 0.92, 0.72, 0.22, 1, 0, 1);
          writeInst(buf, n++, cx, top + 1, 1.8, 1.8, 0.85, 0.68, 0.18, 1, 0, 1);
          // 下層の扉 (中央)
          writeInst(buf, n++, cx, bot + 4, bW * 0.22, bH * 0.18, 0.32, 0.18, 0.12, 1);
          break;
        }
        case 'dojo': {
          // 道場: 大きな切妻屋根 + 板壁 + 木の引き戸 + 「道」の縦額
          writeInst(buf, n++, cx, top - 3, bW + 5, 5, 0.28, 0.20, 0.14, 1);
          writeInst(buf, n++, cx, top + 1, bW + 7, 2, 0.18, 0.12, 0.08, 1);
          // 破風の三角 (切妻)
          writeInst(buf, n++, cx, top + 4, bW * 0.40, 5, 0.25, 0.18, 0.12, 1);
          // 縦の額 (黒地に金字風)
          writeInst(buf, n++, cx - bW * 0.38, cy, 3.5, bH * 0.55, 0.15, 0.10, 0.08, 1);
          writeInst(buf, n++, cx - bW * 0.38, cy, 2.5, bH * 0.48, 0.82, 0.68, 0.22, 0.92);
          // 板壁の目地 (横線 3 本)
          for (const yOff of [bH * 0.30, bH * 0.50, bH * 0.70]) {
            writeInst(buf, n++, cx, bot + yOff, bW * 0.90, 0.5, 0.22, 0.16, 0.10, 0.85);
          }
          // 引き戸 (格子)
          writeInst(buf, n++, cx + bW * 0.05, bot + bH * 0.32, bW * 0.55, bH * 0.34, 0.52, 0.35, 0.22, 0.95);
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + bW * 0.05 + i * bW * 0.18, bot + bH * 0.32, 0.4, bH * 0.32,
              0.18, 0.12, 0.08, 0.92);
          }
          // 石段
          n = this.drawStairs(buf, n, cx, bot + 1, 4);
          break;
        }
        case 'wagashi': {
          // 和菓子屋: 淡いベージュ壁 + 大きな暖簾 + ショーウィンドウ + 桜紋
          writeInst(buf, n++, cx, top - 3, bW + 3, 4.5, 0.62, 0.48, 0.35, 1);
          writeInst(buf, n++, cx, top + 1, bW + 5, 1.5, 0.45, 0.32, 0.22, 1);
          // 店名の横額
          writeInst(buf, n++, cx, top - 6, bW * 0.80, 3, 0.98, 0.92, 0.82, 0.95);
          writeInst(buf, n++, cx, top - 6, bW * 0.72, 1.5, 0.72, 0.32, 0.42, 0.92);
          // ショーウィンドウ (透明のガラス)
          writeInst(buf, n++, cx, bot + bH * 0.45, bW * 0.70, bH * 0.30, 0.92, 0.85, 0.72, 0.78);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.45, bW * 0.70, bH * 0.30);
          // 和菓子のディスプレイ (窓の中、3 個)
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + i * bW * 0.18, bot + bH * 0.45, 2, 2,
              [0.92, 0.72, 0.45][i+1], [0.42, 0.32, 0.28][i+1], [0.52, 0.68, 0.32][i+1], 0.92, 0, 1);
          }
          // のれん (紅色、大きめ)
          writeInst(buf, n++, cx, bot + bH * 0.72, bW * 0.75, 3.5, 0.78, 0.22, 0.28, 0.95);
          writeInst(buf, n++, cx, bot + bH * 0.72, bW * 0.68, 2, 0.95, 0.88, 0.82, 0.92);
          // ドア
          writeInst(buf, n++, cx, bot + 4, bW * 0.22, 8, 0.35, 0.22, 0.15, 1);
          break;
        }
        case 'kimono_shop': {
          // 呉服屋: 紫壁 + 大きな縦看板 + 着物の反物が見えるショーウィンドウ
          writeInst(buf, n++, cx, top - 3, bW + 3, 4.5, 0.42, 0.28, 0.38, 1);
          // 縦看板 (金字)
          writeInst(buf, n++, cx - bW * 0.42, cy, 4, bH * 0.70, 0.28, 0.18, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.42, cy, 2.8, bH * 0.62, 0.95, 0.78, 0.22, 0.92);
          // 大きなショーウィンドウ (縦長、反物の色縞)
          writeInst(buf, n++, cx + bW * 0.08, bot + bH * 0.50, bW * 0.55, bH * 0.55, 0.92, 0.88, 0.82, 0.82);
          // 反物の色縞 (ショーウィンドウ内に複数の縦ストライプ)
          for (let i = -2; i <= 2; i++) {
            const colors = [[0.82, 0.32, 0.42], [0.42, 0.52, 0.78], [0.92, 0.68, 0.22],
                            [0.48, 0.72, 0.38], [0.72, 0.42, 0.68]];
            writeInst(buf, n++, cx + bW * 0.08 + i * bW * 0.09, bot + bH * 0.50,
              bW * 0.06, bH * 0.50,
              colors[i+2][0], colors[i+2][1], colors[i+2][2], 0.92);
          }
          // のれん (藍色)
          writeInst(buf, n++, cx, bot + bH * 0.82, bW * 0.78, 3, 0.22, 0.28, 0.52, 0.95);
          // 店先の盆 (木)
          writeInst(buf, n++, cx - bW * 0.35, bot + 2, bW * 0.22, 1.5, 0.42, 0.28, 0.18, 0.95);
          break;
        }
        case 'sushi_ya': {
          // 寿司屋: 小さな店 + 赤のれん + 「寿」縦看板 + 木のカウンター
          writeInst(buf, n++, cx, top - 3, bW + 3, 4.5, 0.52, 0.35, 0.22, 1);
          writeInst(buf, n++, cx, top + 1, bW + 5, 1.5, 0.32, 0.22, 0.15, 1);
          // 「寿」縦看板 (赤地)
          writeInst(buf, n++, cx - bW * 0.35, cy, 3, bH * 0.55, 0.78, 0.22, 0.22, 1);
          writeInst(buf, n++, cx - bW * 0.35, cy, 2.2, bH * 0.48, 0.98, 0.92, 0.82, 0.92);
          // ショーウィンドウ (小さい、寿司ケース風)
          writeInst(buf, n++, cx + bW * 0.05, bot + bH * 0.45, bW * 0.50, bH * 0.22, 0.88, 0.92, 0.82, 0.78);
          // 寿司ネタの色点 (窓の中)
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, cx + bW * 0.05 + i * 3.5, bot + bH * 0.45, 1.5, 1.2,
              [0.92, 0.75, 0.32][i+1], [0.45, 0.78, 0.22][i+1], [0.32, 0.42, 0.92][i+1], 0.92);
          }
          // 赤のれん (大きめ)
          writeInst(buf, n++, cx, bot + bH * 0.72, bW * 0.78, 4, 0.82, 0.22, 0.22, 0.95);
          writeInst(buf, n++, cx, bot + bH * 0.72, bW * 0.70, 2.5, 0.98, 0.92, 0.82, 0.92);
          // 赤提灯 (入口上)
          writeInst(buf, n++, cx + bW * 0.38, bot + bH * 0.68, 2.2, 3, 0.92, 0.28, 0.18, 1, 0, 1);
          // ドア
          writeInst(buf, n++, cx, bot + 4, bW * 0.25, 8, 0.28, 0.18, 0.12, 1);
          break;
        }
        case 'bungalow': {
          // 平屋: 横長・背低 + 大きな屋根 + 縁側 + 小さな煙突
          // 大きな寄棟屋根
          writeInst(buf, n++, cx, top - 2, bW + 4, 4, 0.55, 0.42, 0.32, 1);
          writeInst(buf, n++, cx, top + 1, bW + 6, 1.5, 0.42, 0.32, 0.22, 1);
          // 小さな煙突 (左端)
          writeInst(buf, n++, cx - bW * 0.35, top + 4, 1.8, 4, 0.48, 0.38, 0.28, 1);
          // 縁側の大きな窓 (横長)
          writeInst(buf, n++, cx, bot + bH * 0.48, bW * 0.70, bH * 0.38, 0.72, 0.88, 0.95, 0.78);
          n = this.drawWindowFrame(buf, n, cx, bot + bH * 0.48, bW * 0.70, bH * 0.38);
          // 玄関ドア (右端)
          writeInst(buf, n++, cx + bW * 0.35, bot + bH * 0.30, bW * 0.20, bH * 0.55, 0.42, 0.28, 0.18, 1);
          // 縁側の段差 (低い)
          writeInst(buf, n++, cx, bot + 1, bW * 0.80, 1.2, 0.62, 0.48, 0.32, 0.95);
          break;
        }
        case 'duplex': {
          // 二世帯住宅: 縦長 2 階建 + 中央で分割された 2 玄関 + バルコニー
          // 切妻屋根
          writeInst(buf, n++, cx, top - 2, bW + 3, 4, 0.48, 0.38, 0.28, 1);
          writeInst(buf, n++, cx, top + 1, bW + 5, 1.5, 0.32, 0.25, 0.18, 1);
          // 2F バルコニー (横長)
          writeInst(buf, n++, cx, bot + bH * 0.62, bW * 0.85, 1.5, 0.55, 0.42, 0.32, 0.95);
          // 2F 窓 (2 つ、左右)
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.72, bW * 0.30, bH * 0.16, 0.72, 0.88, 0.95, 0.78);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.72, bW * 0.30, bH * 0.16, 0.72, 0.88, 0.95, 0.78);
          // 中央の分割線
          writeInst(buf, n++, cx, cy, 0.6, bH * 0.95, 0.32, 0.22, 0.15, 0.92);
          // 1F 2 玄関 (左右別々)
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.25, bW * 0.18, bH * 0.42, 0.52, 0.35, 0.22, 1);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.25, bW * 0.18, bH * 0.42, 0.52, 0.35, 0.22, 1);
          // 1F 小窓 (各世帯)
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.45, bW * 0.14, bH * 0.12, 0.72, 0.88, 0.95, 0.72);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.45, bW * 0.14, bH * 0.12, 0.72, 0.88, 0.95, 0.72);
          // 2 つの表札
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.08, bW * 0.10, 1.2, 0.92, 0.85, 0.72, 0.95);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.08, bW * 0.10, 1.2, 0.92, 0.85, 0.72, 0.95);
          break;
        }
      }
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

export type FurnitureType =
  // オリジナル
  'tree' | 'vending' | 'bench' | 'car' | 'traffic_light' | 'mailbox' | 'bicycle' |
  'flower_bed' | 'parasol' | 'sign_board' | 'garbage' | 'power_pole' | 'hydrant' | 'fountain' |
  // 街路設備
  'street_lamp' | 'bollard' | 'traffic_cone' | 'barrier' | 'guardrail' |
  'telephone_booth' | 'electric_box' | 'newspaper_stand' | 'atm' | 'post_box' |
  'bicycle_rack' | 'dumpster' | 'recycling_bin' | 'fire_extinguisher' | 'bus_stop' |
  'statue' | 'flag_pole' | 'banner_pole' |
  // 植栽
  'bush' | 'hedge' | 'planter' | 'sakura_tree' | 'pine_tree' | 'palm_tree' | 'bamboo_cluster' |
  // ── ミニチュア風ディテール ──
  // 神社・寺社
  'torii' | 'stone_lantern' | 'shinto_rope' | 'offering_box' |
  // 商店街
  'chouchin' | 'noren' | 'a_frame_sign' | 'shop_awning' | 'milk_crate_stack' |
  // 住宅
  'wood_fence' | 'laundry_pole' | 'ac_unit' | 'gas_canister' | 'potted_plant' |
  // 庭園
  'rock' | 'stepping_stones' | 'koi_pond' | 'bonsai' |
  // 街路 / 工事
  'street_mirror' | 'tarp' | 'sandbags' | 'water_tank' |
  // 港湾・工業 (Stage 4)
  'drum_can' | 'cargo_container' | 'forklift' | 'buoy' | 'pallet_stack' |
  // 和風・古都 (Stage 3)
  'koma_inu' | 'ema_rack' | 'bamboo_fence' | 'temizuya' |
  // テーマパーク・祭り (Stage 5)
  'balloon_cluster' | 'ticket_booth' | 'matsuri_drum' | 'popcorn_cart' |
  // キャラクター
  'cat' |
  // ── Stage 1 ミニチュア強化 (T-6) ──
  // 住宅・路地
  'ac_outdoor_cluster' | 'power_line' | 'laundry_balcony' | 'kerbside_vending_pair' |
  'post_letter_box' | 'flower_planter_row' | 'guardrail_short' |
  // 駅前・交通
  'railway_track' | 'platform_edge' | 'railroad_crossing' | 'pedestrian_bridge' |
  'signal_tower' | 'plaza_tile_circle' | 'fountain_large' | 'taxi_rank_sign' |
  // 神社強化
  'sando_stone_pillar' | 'ema_wall' | 'omikuji_stand' | 'shrine_fence_red' |
  'bamboo_water_fountain' |
  // 路面ディテール
  'puddle_reflection' | 'manhole_cover' | 'cable_junction_box' | 'bicycle_row' |
  // ── Act signatures ──
  // Act I: 児童公園
  'play_structure' | 'slide' | 'swing_set' | 'sandbox' |
  // Act II: 銭湯
  'bathhouse_chimney' |
  // Act III: 校庭遊具
  'jungle_gym' |
  // Act IV: 街はずれのランドマーク
  'fire_watchtower' | 'grain_silo';

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
  chunkId: number;    // -1 = static (初期配置), ≥0 = チャンク
}

// AABB half-sizes for each furniture type
const FURNITURE_HW: Record<FurnitureType, number> = {
  tree:             C.TREE_W / 2,
  vending:          C.VENDING_W / 2,
  bench:            C.BENCH_W / 2,
  car:              C.CAR_W / 2,
  traffic_light:    C.TRAFFIC_LIGHT_W / 2,
  mailbox:          C.MAILBOX_W / 2,
  bicycle:          5,
  flower_bed:       6,
  parasol:          5,
  sign_board:       3,
  garbage:          3,
  power_pole:       1.5,
  hydrant:          2,
  fountain:         8,
  // 街路設備
  street_lamp:      2,
  bollard:          2,
  traffic_cone:     2,
  barrier:          8,
  guardrail:        10,
  telephone_booth:  3,
  electric_box:     3,
  newspaper_stand:  3,
  atm:              3,
  post_box:         2.5,
  bicycle_rack:     6,
  dumpster:         5,
  recycling_bin:    4,
  fire_extinguisher:2,
  bus_stop:         4,
  statue:           5,
  flag_pole:        2,
  banner_pole:      2,
  // 植栽
  bush:             5,
  hedge:            8,
  planter:          5,
  sakura_tree:      7,
  pine_tree:        5,
  palm_tree:        4,
  bamboo_cluster:   4,
  // ── ミニチュア風ディテール ──
  torii:            8,
  stone_lantern:    3,
  shinto_rope:      8,
  offering_box:     5,
  chouchin:         3,
  noren:            6,
  a_frame_sign:     5,
  shop_awning:      9,
  milk_crate_stack: 4,
  wood_fence:       9,
  laundry_pole:     7,
  ac_unit:          4,
  gas_canister:     3,
  potted_plant:     3,
  rock:             4,
  stepping_stones:  7,
  koi_pond:         9,
  bonsai:           4,
  street_mirror:    4,
  tarp:             7,
  sandbags:         5,
  water_tank:       3,
  // 港湾・工業
  drum_can:         3,
  cargo_container:  8,
  forklift:         7,
  buoy:             3,
  pallet_stack:     7,
  // 和風
  koma_inu:         3.5,
  ema_rack:         7,
  bamboo_fence:     10,
  temizuya:         7,
  // 祭り
  balloon_cluster:  5,
  ticket_booth:     5,
  matsuri_drum:     6,
  popcorn_cart:     5,
  cat:              3,
  // ── Stage 1 ミニチュア強化 (T-6) ──
  ac_outdoor_cluster:   5,
  power_line:           20,
  laundry_balcony:      5,
  kerbside_vending_pair: 6,
  post_letter_box:      1.5,
  flower_planter_row:   8,
  guardrail_short:      6,
  railway_track:        10,
  platform_edge:        15,
  railroad_crossing:    5,
  pedestrian_bridge:    10,
  signal_tower:         2.5,
  plaza_tile_circle:    20,
  fountain_large:       12,
  taxi_rank_sign:       2,
  sando_stone_pillar:   2,
  ema_wall:             9,
  omikuji_stand:        4,
  shrine_fence_red:     8,
  bamboo_water_fountain: 2.5,
  puddle_reflection:    4,
  manhole_cover:        2.5,
  cable_junction_box:   2.5,
  bicycle_row:          12,
  // Act signatures
  play_structure:       10,
  slide:                4,
  swing_set:            9,
  sandbox:              8,
  bathhouse_chimney:    2.5,
  jungle_gym:           8,
  fire_watchtower:      3,
  grain_silo:           5,
};
const FURNITURE_HH: Record<FurnitureType, number> = {
  tree:             C.TREE_H / 2,
  vending:          C.VENDING_H / 2,
  bench:            C.BENCH_H / 2,
  car:              C.CAR_H / 2,
  traffic_light:    C.TRAFFIC_LIGHT_H / 2,
  mailbox:          C.MAILBOX_H / 2,
  bicycle:          3,
  flower_bed:       2.5,
  parasol:          5,
  sign_board:       6,
  garbage:          3,
  power_pole:       9,
  hydrant:          2.5,
  fountain:         5,
  // 街路設備
  street_lamp:      10,
  bollard:          3,
  traffic_cone:     3,
  barrier:          3,
  guardrail:        2,
  telephone_booth:  6,
  electric_box:     4,
  newspaper_stand:  5,
  atm:              5,
  post_box:         4,
  bicycle_rack:     3,
  dumpster:         5,
  recycling_bin:    4,
  fire_extinguisher:4,
  bus_stop:         8,
  statue:           7,
  flag_pole:        10,
  banner_pole:      8,
  // 植栽
  bush:             4,
  hedge:            3,
  planter:          3,
  sakura_tree:      7,
  pine_tree:        8,
  palm_tree:        9,
  bamboo_cluster:   8,
  // ── ミニチュア風ディテール ──
  torii:            6,
  stone_lantern:    5,
  shinto_rope:      2,
  offering_box:     2.5,
  chouchin:         4,
  noren:            3,
  a_frame_sign:     4,
  shop_awning:      2,
  milk_crate_stack: 3,
  wood_fence:       3,
  laundry_pole:     3,
  ac_unit:          3,
  gas_canister:     4,
  potted_plant:     4,
  rock:             3,
  stepping_stones:  2,
  koi_pond:         6,
  bonsai:           3,
  street_mirror:    9,
  tarp:             5,
  sandbags:         3,
  water_tank:       3.5,
  // 港湾・工業
  drum_can:         4,
  cargo_container:  3.5,
  forklift:         5,
  buoy:             3,
  pallet_stack:     3,
  // 和風
  koma_inu:         4,
  ema_rack:         5,
  bamboo_fence:     3,
  temizuya:         4,
  // 祭り
  balloon_cluster:  6,
  ticket_booth:     6,
  matsuri_drum:     5,
  popcorn_cart:     6,
  cat:              2,
  // ── Stage 1 ミニチュア強化 (T-6) ──
  ac_outdoor_cluster:   2,
  power_line:           0.3,
  laundry_balcony:      2.5,
  kerbside_vending_pair: 5,
  post_letter_box:      3,
  flower_planter_row:   2,
  guardrail_short:      1,
  railway_track:        1.5,
  platform_edge:        1,
  railroad_crossing:    5,
  pedestrian_bridge:    4,
  signal_tower:         7.5,
  plaza_tile_circle:    20,
  fountain_large:       12,
  taxi_rank_sign:       5,
  sando_stone_pillar:   5,
  ema_wall:             3,
  omikuji_stand:        3,
  shrine_fence_red:     1.5,
  bamboo_water_fountain: 4,
  puddle_reflection:    2,
  manhole_cover:        2.5,
  cable_junction_box:   3,
  bicycle_row:          3,
  // Act signatures
  play_structure:       9,
  slide:                7,
  swing_set:            4,
  sandbox:              5,
  bathhouse_chimney:    14,
  jungle_gym:           6,
  fire_watchtower:      12,
  grain_silo:           9,
};

// Traffic light cycle durations per state (seconds)
const LIGHT_DURATIONS = [3.0, 0.8, 3.0]; // red, yellow, green

export class FurnitureManager {
  items: FurnitureItem[] = [];

  load(defs: Array<{ type: FurnitureType; x: number; y: number; hp?: number; score?: number }>) {
    this.items = [];
    for (const d of defs) {
      this.items.push({
        type: d.type, x: d.x, y: d.y,
        hp: d.hp ?? 2, active: true, score: d.score ?? 50,
        lightTimer: LIGHT_DURATIONS[0], lightState: 0,
        chunkId: -1,
      });
    }
  }

  /** チャンク家具を追加ロード */
  loadChunk(chunkId: number, defs: Array<{ type: FurnitureType; x: number; y: number }>) {
    for (const d of defs) {
      this.items.push({
        type: d.type, x: d.x, y: d.y,
        hp: 1, active: true, score: 5,
        lightTimer: LIGHT_DURATIONS[0], lightState: 0,
        chunkId,
      });
    }
  }

  /** チャンク家具を一括削除 */
  unloadChunk(chunkId: number) {
    this.items = this.items.filter(i => i.chunkId !== chunkId);
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
      if (Math.abs(item.y - by) > 30) continue;
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

  damage(item: FurnitureItem, dmg: number = 1): boolean {
    item.hp -= dmg;
    if (item.hp <= 0) {
      item.active = false;
      return true;
    }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 50;
    const camTop = cameraY + C.WORLD_MAX_Y + 50;
    for (const item of this.items) {
      if (!item.active) continue;
      if (item.y < camBot || item.y > camTop) continue;

      switch (item.type) {
        case 'tree': {
          // 俯瞰: 樹冠の丸 + 影
          writeInst(buf, n++, item.x + 2, item.y - 2, 11, 11, 0, 0, 0, 0.15, 0, 1);
          writeInst(buf, n++, item.x, item.y, 10, 10, 0.22, 0.55, 0.20, 1, 0, 1);
          writeInst(buf, n++, item.x - 1, item.y + 1, 5, 5, 0.35, 0.70, 0.28, 0.5, 0, 1);
          break;
        }
        case 'vending': {
          // 俯瞰: 小さな正方形 + カラーストライプ
          writeInst(buf, n++, item.x + 1, item.y - 1, C.VENDING_W + 1, C.VENDING_W + 1,
            0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, C.VENDING_W, C.VENDING_W, 0.2, 0.5, 0.8, 1);
          writeInst(buf, n++, item.x, item.y + C.VENDING_W * 0.25, C.VENDING_W, 1.5,
            1.0, 0.2, 0.2, 1);
          break;
        }
        case 'bench': {
          // 俯瞰: 細長い横板 + 背もたれ
          writeInst(buf, n++, item.x, item.y, C.BENCH_W, C.BENCH_H, 0.45, 0.30, 0.15, 1);
          writeInst(buf, n++, item.x, item.y - C.BENCH_H * 0.55, C.BENCH_W * 0.85, 1.5,
            0.35, 0.22, 0.10, 0.8);
          break;
        }
        case 'car': {
          // 俯瞰: 車体 + 窓 + 影
          writeInst(buf, n++, item.x + 2, item.y - 2, C.CAR_W, C.CAR_H, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x, item.y, C.CAR_W, C.CAR_H, 0.3, 0.55, 0.75, 1);
          writeInst(buf, n++, item.x, item.y, C.CAR_W * 0.6, C.CAR_H * 0.55,
            0.65, 0.85, 0.95, 0.75);
          break;
        }
        case 'traffic_light': {
          // 俯瞰: ハウジング矩形 + ライトドット
          writeInst(buf, n++, item.x, item.y, C.TRAFFIC_LIGHT_W + 1, C.TRAFFIC_LIGHT_W + 1,
            0.15, 0.15, 0.15, 1);
          const lr = item.lightState === 0 ? 1.0 : (item.lightState === 1 ? 1.0 : 0.1);
          const lg2 = item.lightState === 0 ? 0.1 : (item.lightState === 1 ? 0.8 : 1.0);
          writeInst(buf, n++, item.x, item.y, C.TRAFFIC_LIGHT_W - 0.5, C.TRAFFIC_LIGHT_W - 0.5,
            lr, lg2, 0.1, 0.95, 0, 1);
          break;
        }
        case 'mailbox': {
          // 俯瞰: 赤い小型矩形 + 投函スリット
          writeInst(buf, n++, item.x, item.y, C.MAILBOX_W + 1, C.MAILBOX_W + 1,
            0.8, 0.15, 0.15, 1);
          writeInst(buf, n++, item.x, item.y, C.MAILBOX_W, 1.5, 0.15, 0.05, 0.05, 1);
          break;
        }
        case 'bicycle': {
          // 俯瞰: 前後輪 + フレームバー
          writeInst(buf, n++, item.x - 4, item.y, 5, 5, 0.20, 0.20, 0.20, 1, 0, 1);
          writeInst(buf, n++, item.x + 4, item.y, 5, 5, 0.20, 0.20, 0.20, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 11, 2, 0.45, 0.30, 0.15, 1);
          break;
        }
        case 'flower_bed': {
          // 俯瞰: 楕円花壇 + 花ドット
          writeInst(buf, n++, item.x, item.y, 13, 6, 0.40, 0.28, 0.18, 1);
          writeInst(buf, n++, item.x, item.y, 11, 5, 0.30, 0.70, 0.25, 0.9, 0, 1);
          writeInst(buf, n++, item.x - 3, item.y, 3, 3, 0.95, 0.35, 0.55, 0.9, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y, 3, 3, 0.95, 0.90, 0.20, 0.9, 0, 1);
          break;
        }
        case 'parasol': {
          // 俯瞰: 大きな円（傘の上面）+ 中心ポール点
          writeInst(buf, n++, item.x + 2, item.y - 2, 13, 13, 0, 0, 0, 0.15, 0, 1);
          writeInst(buf, n++, item.x, item.y, 12, 12, 0.95, 0.40, 0.25, 0.85, 0, 1);
          writeInst(buf, n++, item.x, item.y, 2.5, 2.5, 0.55, 0.45, 0.35, 1, 0, 1);
          break;
        }
        case 'sign_board': {
          // 俯瞰: 横向き看板矩形 + 文字帯
          writeInst(buf, n++, item.x + 1, item.y - 1, 10, 5, 0, 0, 0, 0.15);
          writeInst(buf, n++, item.x, item.y, 9, 4, 0.95, 0.90, 0.20, 1);
          writeInst(buf, n++, item.x, item.y, 8, 1.5, 0.55, 0.50, 0.08, 0.8);
          break;
        }
        case 'garbage': {
          // 俯瞰: 丸いゴミ箱 + 蓋
          writeInst(buf, n++, item.x, item.y, 7, 7, 0.25, 0.35, 0.25, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.32, 0.43, 0.30, 1, 0, 1);
          break;
        }
        case 'power_pole': {
          // 俯瞰: 電柱頂部の円 + 十字腕
          writeInst(buf, n++, item.x + 2, item.y - 2, 6, 6, 0, 0, 0, 0.18, 0, 1);
          writeInst(buf, n++, item.x, item.y, 4, 4, 0.30, 0.25, 0.20, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 14, 1.5, 0.35, 0.28, 0.22, 1);
          break;
        }
        case 'hydrant': {
          // 俯瞰: 赤い小円 + 黄色キャップ
          writeInst(buf, n++, item.x, item.y, 6, 6, 0.85, 0.10, 0.10, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 3.5, 3.5, 0.95, 0.80, 0.10, 1, 0, 1);
          break;
        }
        case 'fountain': {
          // 俯瞰: 円形噴水池 + 水面 + 噴射
          writeInst(buf, n++, item.x + 3, item.y - 3, 19, 19, 0, 0, 0, 0.18, 0, 1);
          writeInst(buf, n++, item.x, item.y, 17, 17, 0.50, 0.68, 0.82, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 13, 13, 0.35, 0.65, 0.95, 0.85, 0, 1);
          if (item.hp > 0) {
            writeInst(buf, n++, item.x, item.y, 6, 6, 0.65, 0.90, 1.0, 0.7, 0, 1);
          }
          break;
        }
        // ── 街路設備 ─────────────────────────────────────────────
        case 'street_lamp': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 5, 5, 0, 0, 0, 0.15, 0, 1);
          writeInst(buf, n++, item.x, item.y, 3, 3, 0.28, 0.25, 0.22, 1, 0, 1);  // 頂部灯
          writeInst(buf, n++, item.x, item.y, 1.5, 20, 0.28, 0.25, 0.22, 1);      // ポール
          break;
        }
        case 'bollard': {
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.25, 0.25, 0.28, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 3, 3, 0.90, 0.85, 0.10, 0.9, 0, 1);
          break;
        }
        case 'traffic_cone': {
          writeInst(buf, n++, item.x, item.y, 6, 7, 0.95, 0.42, 0.10, 1);
          writeInst(buf, n++, item.x, item.y + 1, 6, 2, 0.95, 0.95, 0.95, 0.85);
          break;
        }
        case 'barrier': {
          writeInst(buf, n++, item.x, item.y, 17, 5, 0.85, 0.32, 0.12, 1);
          writeInst(buf, n++, item.x, item.y, 17, 1.5, 0.95, 0.95, 0.10, 0.85);
          break;
        }
        case 'guardrail': {
          writeInst(buf, n++, item.x, item.y, 21, 3, 0.68, 0.72, 0.78, 1);
          writeInst(buf, n++, item.x - 9, item.y, 2, 5, 0.68, 0.72, 0.78, 0.9);
          writeInst(buf, n++, item.x + 9, item.y, 2, 5, 0.68, 0.72, 0.78, 0.9);
          break;
        }
        case 'telephone_booth': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 8, 8, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 7, 7, 0.12, 0.55, 0.25, 1);
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.65, 0.90, 0.96, 0.80);
          break;
        }
        case 'electric_box': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 8, 9, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 7, 8, 0.50, 0.52, 0.55, 1);
          writeInst(buf, n++, item.x, item.y + 2, 5, 1.5, 0.32, 0.32, 0.34, 0.8);
          break;
        }
        case 'newspaper_stand': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 8, 8, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 7, 7, 0.72, 0.62, 0.45, 1);
          writeInst(buf, n++, item.x, item.y + 1, 6, 1.5, 0.25, 0.22, 0.18, 0.7);
          break;
        }
        case 'atm': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 8, 12, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 7, 11, 0.18, 0.40, 0.75, 1);
          writeInst(buf, n++, item.x, item.y + 2, 5, 3, 0.65, 0.85, 0.96, 0.80);
          break;
        }
        case 'post_box': {
          writeInst(buf, n++, item.x, item.y, 6, 9, 0.82, 0.10, 0.10, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y + 3, 4, 1.5, 0.10, 0.08, 0.08, 0.8);
          break;
        }
        case 'bicycle_rack': {
          writeInst(buf, n++, item.x, item.y, 13, 2, 0.42, 0.42, 0.45, 1);
          writeInst(buf, n++, item.x - 5, item.y, 1.5, 6, 0.42, 0.42, 0.45, 1);
          writeInst(buf, n++, item.x + 5, item.y, 1.5, 6, 0.42, 0.42, 0.45, 1);
          break;
        }
        case 'dumpster': {
          writeInst(buf, n++, item.x + 2, item.y - 2, 13, 11, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 12, 10, 0.22, 0.42, 0.22, 1);
          writeInst(buf, n++, item.x, item.y + 3, 10, 2, 0.18, 0.35, 0.18, 0.85);
          break;
        }
        case 'recycling_bin': {
          writeInst(buf, n++, item.x, item.y, 9, 9, 0.20, 0.62, 0.58, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 6, 6, 0.15, 0.52, 0.48, 1, 0, 1);
          break;
        }
        case 'fire_extinguisher': {
          writeInst(buf, n++, item.x, item.y, 5, 9, 0.82, 0.15, 0.15, 1);
          writeInst(buf, n++, item.x, item.y + 3, 3, 2, 0.88, 0.80, 0.20, 0.85);
          break;
        }
        case 'bus_stop': {
          writeInst(buf, n++, item.x + 1, item.y - 1, 10, 18, 0, 0, 0, 0.15);
          writeInst(buf, n++, item.x, item.y, 9, 17, 0.25, 0.45, 0.75, 0.88);
          writeInst(buf, n++, item.x, item.y + 5, 7, 1.5, 0.95, 0.95, 0.95, 0.90);
          break;
        }
        case 'statue': {
          writeInst(buf, n++, item.x + 2, item.y - 2, 12, 16, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y - 2, 7, 12, 0.72, 0.70, 0.68, 1);  // 像本体
          writeInst(buf, n++, item.x, item.y + 4, 10, 5, 0.60, 0.58, 0.55, 1);  // 台座
          break;
        }
        case 'flag_pole': {
          writeInst(buf, n++, item.x, item.y, 1.5, 22, 0.52, 0.52, 0.52, 1);
          writeInst(buf, n++, item.x + 4, item.y + 8, 9, 5, 0.90, 0.12, 0.12, 1);
          break;
        }
        case 'banner_pole': {
          writeInst(buf, n++, item.x, item.y, 1.5, 18, 0.48, 0.48, 0.48, 1);
          writeInst(buf, n++, item.x + 4, item.y + 6, 9, 6, 0.20, 0.20, 0.80, 0.90);
          break;
        }
        // ── 植栽 ────────────────────────────────────────────────
        case 'bush': {
          writeInst(buf, n++, item.x + 2, item.y - 2, 12, 9, 0, 0, 0, 0.14, 0, 1);
          writeInst(buf, n++, item.x, item.y, 11, 8, 0.22, 0.52, 0.18, 1, 0, 1);
          writeInst(buf, n++, item.x - 2, item.y + 1, 5, 4, 0.30, 0.62, 0.22, 0.6, 0, 1);
          break;
        }
        case 'hedge': {
          writeInst(buf, n++, item.x, item.y, 17, 7, 0.20, 0.48, 0.16, 1);
          writeInst(buf, n++, item.x - 4, item.y + 1, 4, 4, 0.28, 0.58, 0.22, 0.6, 0, 1);
          writeInst(buf, n++, item.x + 4, item.y + 1, 4, 4, 0.28, 0.58, 0.22, 0.6, 0, 1);
          break;
        }
        case 'planter': {
          writeInst(buf, n++, item.x, item.y, 11, 6, 0.58, 0.42, 0.28, 1);
          writeInst(buf, n++, item.x, item.y + 2, 9, 4, 0.25, 0.60, 0.22, 1, 0, 1);
          break;
        }
        case 'sakura_tree': {
          // ピンクの花冠
          writeInst(buf, n++, item.x + 2, item.y - 2, 16, 16, 0, 0, 0, 0.14, 0, 1);
          writeInst(buf, n++, item.x, item.y, 15, 15, 0.95, 0.72, 0.78, 1, 0, 1);
          writeInst(buf, n++, item.x - 2, item.y + 2, 7, 7, 1.0, 0.82, 0.88, 0.55, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y + 1, 5, 5, 0.95, 0.90, 0.95, 0.45, 0, 1);
          break;
        }
        case 'pine_tree': {
          // 三角錐形
          writeInst(buf, n++, item.x + 2, item.y - 2, 13, 18, 0, 0, 0, 0.15, 0, 1);
          writeInst(buf, n++, item.x, item.y, 12, 17, 0.12, 0.40, 0.18, 1);
          writeInst(buf, n++, item.x, item.y + 3, 7, 10, 0.18, 0.52, 0.22, 0.7);
          break;
        }
        case 'palm_tree': {
          // 幹 + 葉冠
          writeInst(buf, n++, item.x, item.y - 2, 3, 16, 0.62, 0.48, 0.28, 1);
          writeInst(buf, n++, item.x + 2, item.y - 1, 14, 7, 0, 0, 0, 0.14, 0, 1);
          writeInst(buf, n++, item.x, item.y, 13, 6, 0.25, 0.62, 0.22, 1, 0, 1);
          break;
        }
        case 'bamboo_cluster': {
          // 細い竹×3
          writeInst(buf, n++, item.x - 3, item.y, 2, 17, 0.32, 0.60, 0.25, 1);
          writeInst(buf, n++, item.x, item.y + 1, 2, 18, 0.28, 0.58, 0.22, 1);
          writeInst(buf, n++, item.x + 3, item.y, 2, 16, 0.35, 0.62, 0.27, 1);
          writeInst(buf, n++, item.x, item.y, 1.5, 17, 0.40, 0.68, 0.30, 0.5);
          break;
        }
        // ── ミニチュア風ディテール ────────────────────────────────
        case 'torii': {
          // 朱色の鳥居: 笠木 + 島木 + 2 本の柱
          writeInst(buf, n++, item.x + 1, item.y - 1, 17, 13, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y - 4, 16, 2, 0.86, 0.18, 0.10, 1);   // 笠木
          writeInst(buf, n++, item.x, item.y - 2, 14, 1.2, 0.78, 0.14, 0.08, 1); // 島木
          writeInst(buf, n++, item.x - 6, item.y + 2, 1.8, 9, 0.84, 0.16, 0.10, 1);
          writeInst(buf, n++, item.x + 6, item.y + 2, 1.8, 9, 0.84, 0.16, 0.10, 1);
          writeInst(buf, n++, item.x, item.y - 1, 9, 0.6, 0.20, 0.08, 0.05, 0.7); // 額束帯
          break;
        }
        case 'stone_lantern': {
          // 石灯籠: 笠 + 火袋 + 中台 + 基礎
          writeInst(buf, n++, item.x + 1, item.y - 1, 8, 11, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y - 4, 7, 2, 0.62, 0.60, 0.55, 1);   // 笠
          writeInst(buf, n++, item.x, item.y - 1, 4.5, 3, 0.55, 0.52, 0.48, 1); // 火袋
          writeInst(buf, n++, item.x, item.y - 1, 1.8, 1.8, 1.0, 0.85, 0.40, 0.85, 0, 1); // 灯火
          writeInst(buf, n++, item.x, item.y + 2, 5, 1.5, 0.58, 0.55, 0.50, 1); // 中台
          writeInst(buf, n++, item.x, item.y + 4, 7, 2, 0.55, 0.52, 0.48, 1);   // 基礎
          break;
        }
        case 'shinto_rope': {
          // 注連縄: 太い縄 + 紙垂 (zigzag papers)
          writeInst(buf, n++, item.x, item.y - 1, 17, 2.5, 0.92, 0.86, 0.58, 1);
          writeInst(buf, n++, item.x, item.y - 1, 16, 0.8, 0.78, 0.70, 0.40, 0.7);
          writeInst(buf, n++, item.x - 5, item.y + 1.5, 2, 3, 0.97, 0.97, 0.95, 0.95);
          writeInst(buf, n++, item.x,     item.y + 1.5, 2, 3, 0.97, 0.97, 0.95, 0.95);
          writeInst(buf, n++, item.x + 5, item.y + 1.5, 2, 3, 0.97, 0.97, 0.95, 0.95);
          break;
        }
        case 'offering_box': {
          // 賽銭箱: 木製箱 + 上面格子
          writeInst(buf, n++, item.x + 1, item.y - 1, 11, 5, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 10, 4, 0.55, 0.38, 0.20, 1);
          writeInst(buf, n++, item.x - 2, item.y - 0.5, 1, 3, 0.30, 0.18, 0.08, 0.85);
          writeInst(buf, n++, item.x,     item.y - 0.5, 1, 3, 0.30, 0.18, 0.08, 0.85);
          writeInst(buf, n++, item.x + 2, item.y - 0.5, 1, 3, 0.30, 0.18, 0.08, 0.85);
          break;
        }
        case 'chouchin': {
          // 提灯: 赤い丸 + 上下の黒い帯 + 紐
          writeInst(buf, n++, item.x, item.y - 4, 0.8, 2, 0.30, 0.25, 0.20, 1); // 紐
          writeInst(buf, n++, item.x, item.y, 6, 7, 0.92, 0.18, 0.10, 1, 0, 1); // 本体
          writeInst(buf, n++, item.x, item.y - 2.5, 6, 0.8, 0.20, 0.08, 0.05, 0.85);
          writeInst(buf, n++, item.x, item.y + 2.5, 6, 0.8, 0.20, 0.08, 0.05, 0.85);
          writeInst(buf, n++, item.x, item.y + 0.2, 2, 0.6, 0.30, 0.18, 0.08, 0.7); // 文字帯
          break;
        }
        case 'noren': {
          // 暖簾: 上の竿 + 3 枚の藍色パネル
          writeInst(buf, n++, item.x, item.y - 3, 13, 1, 0.30, 0.22, 0.18, 1);
          writeInst(buf, n++, item.x - 4, item.y, 3, 5, 0.18, 0.30, 0.55, 1);
          writeInst(buf, n++, item.x,     item.y, 3, 5, 0.18, 0.30, 0.55, 1);
          writeInst(buf, n++, item.x + 4, item.y, 3, 5, 0.18, 0.30, 0.55, 1);
          writeInst(buf, n++, item.x, item.y, 2, 1.5, 0.95, 0.90, 0.20, 0.85); // 屋号文字
          break;
        }
        case 'a_frame_sign': {
          // A 型看板: 黒板風パネル + 木枠
          writeInst(buf, n++, item.x + 1, item.y - 1, 11, 9, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y - 1, 10, 7, 0.18, 0.16, 0.14, 1); // 黒板
          writeInst(buf, n++, item.x, item.y - 1, 10, 7.5, 0.55, 0.38, 0.20, 0.45); // 木枠ヒント
          writeInst(buf, n++, item.x, item.y - 2, 7, 1, 0.92, 0.92, 0.85, 0.9); // チョーク文字 1
          writeInst(buf, n++, item.x, item.y + 0.5, 5, 0.8, 0.92, 0.85, 0.30, 0.85); // 文字 2
          writeInst(buf, n++, item.x, item.y + 4, 11, 1.5, 0.45, 0.32, 0.18, 0.85); // 脚部
          break;
        }
        case 'shop_awning': {
          // テント型ひさし: 赤白ストライプ
          writeInst(buf, n++, item.x + 1, item.y - 1, 19, 5, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 18, 4, 0.85, 0.30, 0.25, 1);
          writeInst(buf, n++, item.x - 6, item.y, 2, 4, 0.96, 0.92, 0.86, 0.85);
          writeInst(buf, n++, item.x - 2, item.y, 2, 4, 0.96, 0.92, 0.86, 0.85);
          writeInst(buf, n++, item.x + 2, item.y, 2, 4, 0.96, 0.92, 0.86, 0.85);
          writeInst(buf, n++, item.x + 6, item.y, 2, 4, 0.96, 0.92, 0.86, 0.85);
          writeInst(buf, n++, item.x, item.y + 2.5, 18, 0.8, 0.55, 0.18, 0.15, 0.7); // 縁取り
          break;
        }
        case 'milk_crate_stack': {
          // ミルクケース 3 段積み
          writeInst(buf, n++, item.x + 1, item.y + 2, 9, 3, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y + 2, 8, 2.5, 0.85, 0.75, 0.20, 1);
          writeInst(buf, n++, item.x, item.y, 8, 2.5, 0.30, 0.55, 0.85, 1);
          writeInst(buf, n++, item.x, item.y - 2.5, 7, 2.5, 0.80, 0.30, 0.30, 1);
          break;
        }
        case 'wood_fence': {
          // 木塀: 横長板 + 縦スラット
          writeInst(buf, n++, item.x + 1, item.y - 1, 19, 6, 0, 0, 0, 0.16);
          writeInst(buf, n++, item.x, item.y, 18, 5, 0.55, 0.38, 0.22, 1);
          writeInst(buf, n++, item.x, item.y - 2, 18, 0.8, 0.40, 0.26, 0.14, 0.9);
          writeInst(buf, n++, item.x - 7, item.y, 1, 5, 0.40, 0.25, 0.12, 0.7);
          writeInst(buf, n++, item.x - 3, item.y, 1, 5, 0.40, 0.25, 0.12, 0.7);
          writeInst(buf, n++, item.x + 1, item.y, 1, 5, 0.40, 0.25, 0.12, 0.7);
          writeInst(buf, n++, item.x + 5, item.y, 1, 5, 0.40, 0.25, 0.12, 0.7);
          break;
        }
        case 'laundry_pole': {
          // 物干し竿 + 干された服 3 着
          writeInst(buf, n++, item.x, item.y - 2.5, 14, 0.8, 0.62, 0.60, 0.58, 1); // 竿
          writeInst(buf, n++, item.x - 5, item.y + 0.5, 3, 4, 0.96, 0.92, 0.88, 0.95); // 白
          writeInst(buf, n++, item.x - 1, item.y + 0.5, 3, 4, 0.85, 0.42, 0.30, 0.95); // 赤
          writeInst(buf, n++, item.x + 3, item.y + 0.5, 3, 4, 0.30, 0.50, 0.75, 0.95); // 青
          break;
        }
        case 'ac_unit': {
          // 室外機: グレーの箱 + 横スリット
          writeInst(buf, n++, item.x + 1, item.y - 1, 9, 7, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 8, 6, 0.78, 0.78, 0.76, 1);
          writeInst(buf, n++, item.x, item.y, 6, 4, 0.62, 0.62, 0.60, 0.7);
          writeInst(buf, n++, item.x, item.y - 1, 6, 0.5, 0.45, 0.45, 0.43, 0.7);
          writeInst(buf, n++, item.x, item.y + 0.5, 6, 0.5, 0.45, 0.45, 0.43, 0.7);
          writeInst(buf, n++, item.x, item.y + 2, 6, 0.5, 0.45, 0.45, 0.43, 0.7);
          break;
        }
        case 'gas_canister': {
          // LP ガスボンベ: 白い円柱 + バルブ
          writeInst(buf, n++, item.x + 1, item.y - 1, 7, 10, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 6, 9, 0.82, 0.80, 0.74, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y - 4, 3, 1.5, 0.55, 0.52, 0.48, 1);
          writeInst(buf, n++, item.x, item.y, 5, 0.6, 0.62, 0.60, 0.55, 0.7);
          writeInst(buf, n++, item.x, item.y + 2, 5, 0.6, 0.62, 0.60, 0.55, 0.7);
          break;
        }
        case 'potted_plant': {
          // 鉢植え (テラコッタ): 鉢 + 葉
          writeInst(buf, n++, item.x + 1, item.y + 1, 7, 5, 0, 0, 0, 0.16);
          writeInst(buf, n++, item.x, item.y + 2, 6, 4, 0.72, 0.42, 0.25, 1); // 鉢
          writeInst(buf, n++, item.x, item.y - 2, 6, 5, 0.25, 0.55, 0.22, 1, 0, 1); // 葉
          writeInst(buf, n++, item.x - 1, item.y - 1, 0.8, 4, 0.45, 0.28, 0.16, 0.7); // 茎
          break;
        }
        case 'rock': {
          // 庭石: グレーの不定形ブロブ
          writeInst(buf, n++, item.x + 1, item.y - 1, 9, 7, 0, 0, 0, 0.20, 0, 1);
          writeInst(buf, n++, item.x, item.y, 8, 6, 0.55, 0.52, 0.48, 1, 0, 1);
          writeInst(buf, n++, item.x - 1, item.y - 1, 4, 3, 0.68, 0.65, 0.60, 0.7, 0, 1);
          writeInst(buf, n++, item.x + 2, item.y + 1, 2, 1.5, 0.45, 0.42, 0.38, 0.6, 0, 1);
          break;
        }
        case 'stepping_stones': {
          // 飛石: 3 つの小石
          writeInst(buf, n++, item.x - 5, item.y - 1, 4, 3, 0.55, 0.52, 0.48, 1, 0, 1);
          writeInst(buf, n++, item.x,     item.y + 1, 4, 3, 0.55, 0.52, 0.48, 1, 0, 1);
          writeInst(buf, n++, item.x + 5, item.y - 1, 4, 3, 0.55, 0.52, 0.48, 1, 0, 1);
          writeInst(buf, n++, item.x - 5, item.y - 1, 2, 1.5, 0.68, 0.65, 0.60, 0.7, 0, 1);
          writeInst(buf, n++, item.x + 5, item.y - 1, 2, 1.5, 0.68, 0.65, 0.60, 0.7, 0, 1);
          break;
        }
        case 'koi_pond': {
          // 鯉池: 土手 + 水面 + 蓮 + 鯉
          writeInst(buf, n++, item.x + 1, item.y - 1, 21, 14, 0, 0, 0, 0.20, 0, 1);
          writeInst(buf, n++, item.x, item.y, 20, 13, 0.40, 0.32, 0.20, 1, 0, 1); // 土手
          writeInst(buf, n++, item.x, item.y, 17, 10, 0.20, 0.45, 0.55, 1, 0, 1); // 水
          writeInst(buf, n++, item.x, item.y, 14, 8, 0.30, 0.55, 0.65, 0.7, 0, 1); // 内側水
          writeInst(buf, n++, item.x - 4, item.y - 1, 5, 3, 0.25, 0.55, 0.30, 0.85, 0, 1); // 蓮
          writeInst(buf, n++, item.x + 4, item.y + 1, 5, 3, 0.25, 0.55, 0.30, 0.85, 0, 1);
          writeInst(buf, n++, item.x, item.y, 3, 1.5, 0.95, 0.55, 0.18, 0.95); // 鯉橙
          writeInst(buf, n++, item.x + 1, item.y + 2, 3, 1.2, 0.95, 0.95, 0.95, 0.95); // 鯉白
          break;
        }
        case 'bonsai': {
          // 盆栽: 鉢 + 樹冠 + 幹
          writeInst(buf, n++, item.x + 1, item.y + 1, 9, 6, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y + 2, 8, 3, 0.45, 0.30, 0.18, 1); // 鉢
          writeInst(buf, n++, item.x, item.y - 1, 7, 5, 0.20, 0.50, 0.22, 1, 0, 1); // 樹冠
          writeInst(buf, n++, item.x - 1, item.y, 1, 4, 0.35, 0.22, 0.10, 0.8); // 幹
          writeInst(buf, n++, item.x - 2, item.y - 2, 3, 2, 0.30, 0.62, 0.28, 0.7, 0, 1);
          break;
        }
        case 'street_mirror': {
          // カーブミラー: ポール + 円形鏡
          writeInst(buf, n++, item.x, item.y, 1.2, 18, 0.55, 0.55, 0.58, 1);
          writeInst(buf, n++, item.x + 1, item.y - 6, 9, 9, 0, 0, 0, 0.18, 0, 1);
          writeInst(buf, n++, item.x, item.y - 6, 8, 8, 0.92, 0.50, 0.10, 1, 0, 1); // フチ
          writeInst(buf, n++, item.x, item.y - 6, 6, 6, 0.65, 0.78, 0.85, 0.95, 0, 1); // 鏡
          break;
        }
        case 'tarp': {
          // ブルーシート: 青い長方形 + シワ
          writeInst(buf, n++, item.x + 1, item.y - 1, 16, 11, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 15, 10, 0.20, 0.45, 0.78, 1);
          writeInst(buf, n++, item.x - 3, item.y - 2, 7, 0.6, 0.32, 0.58, 0.86, 0.7);
          writeInst(buf, n++, item.x + 2, item.y + 1, 9, 0.6, 0.32, 0.58, 0.86, 0.7);
          writeInst(buf, n++, item.x - 1, item.y + 3, 6, 0.6, 0.32, 0.58, 0.86, 0.7);
          break;
        }
        case 'sandbags': {
          // 土のう: 3 個積み
          writeInst(buf, n++, item.x + 1, item.y, 11, 7, 0, 0, 0, 0.18, 0, 1);
          writeInst(buf, n++, item.x - 3, item.y + 1, 5, 3, 0.78, 0.68, 0.52, 1, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y + 1, 5, 3, 0.78, 0.68, 0.52, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y - 1.5, 5, 3, 0.82, 0.72, 0.56, 1, 0, 1);
          writeInst(buf, n++, item.x - 3, item.y + 1, 1, 0.5, 0.55, 0.45, 0.30, 0.6); // 紐
          writeInst(buf, n++, item.x + 3, item.y + 1, 1, 0.5, 0.55, 0.45, 0.30, 0.6);
          break;
        }
        case 'water_tank': {
          // 雨水タンク: 青い円柱 + 蛇口
          writeInst(buf, n++, item.x + 1, item.y - 1, 7, 8, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 6, 7, 0.30, 0.42, 0.55, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.40, 0.52, 0.65, 0.85, 0, 1);
          writeInst(buf, n++, item.x, item.y - 3, 4, 0.6, 0.55, 0.55, 0.55, 0.7); // 蓋
          writeInst(buf, n++, item.x + 3, item.y + 2, 1.5, 1, 0.45, 0.45, 0.45, 0.9); // 蛇口
          break;
        }
        case 'cat': {
          // 猫: 小さな白い体 + 耳 + 目
          writeInst(buf, n++, item.x, item.y, 6, 4, 0.92, 0.88, 0.82, 1, 0, 1); // 体
          writeInst(buf, n++, item.x - 2, item.y - 2, 1.5, 1.5, 0.92, 0.88, 0.82, 1); // 耳 L
          writeInst(buf, n++, item.x + 2, item.y - 2, 1.5, 1.5, 0.92, 0.88, 0.82, 1); // 耳 R
          writeInst(buf, n++, item.x - 1, item.y - 0.5, 0.5, 0.5, 0.10, 0.08, 0.05, 1); // 目 L
          writeInst(buf, n++, item.x + 1, item.y - 0.5, 0.5, 0.5, 0.10, 0.08, 0.05, 1); // 目 R
          writeInst(buf, n++, item.x + 3, item.y, 2, 0.6, 0.92, 0.88, 0.82, 0.85); // 尾
          break;
        }
        // ── 港湾・工業 (Stage 4) ─────────────────────────────────
        case 'drum_can': {
          // ドラム缶: 青い円柱 + 上下リブ
          writeInst(buf, n++, item.x + 1, item.y - 1, 7, 9, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 6, 8, 0.25, 0.40, 0.65, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y - 3, 6, 0.8, 0.15, 0.25, 0.45, 0.85);
          writeInst(buf, n++, item.x, item.y + 3, 6, 0.8, 0.15, 0.25, 0.45, 0.85);
          writeInst(buf, n++, item.x, item.y, 4, 1, 0.95, 0.92, 0.20, 0.9); // 警告黄帯
          break;
        }
        case 'cargo_container': {
          // 貨物コンテナ: 横長の箱
          writeInst(buf, n++, item.x + 1, item.y - 1, 17, 7, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 16, 6, 0.82, 0.28, 0.22, 1); // 赤
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, item.x + i * 3, item.y, 0.5, 5, 0.55, 0.18, 0.12, 0.7);
          }
          writeInst(buf, n++, item.x + 7, item.y, 1, 2, 0.20, 0.15, 0.12, 0.9); // 取手
          break;
        }
        case 'forklift': {
          // フォークリフト: 黄色い車体 + フォーク
          writeInst(buf, n++, item.x + 1, item.y, 14, 10, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 13, 9, 0.95, 0.78, 0.18, 1);
          writeInst(buf, n++, item.x - 2, item.y - 2, 5, 5, 0.30, 0.40, 0.65, 0.85); // キャブ窓
          // マスト + フォーク
          writeInst(buf, n++, item.x - 5, item.y - 1, 1.2, 10, 0.35, 0.30, 0.25, 1);
          writeInst(buf, n++, item.x - 7, item.y + 3, 4, 1.5, 0.55, 0.50, 0.45, 1);
          // タイヤ
          writeInst(buf, n++, item.x - 4, item.y + 4, 3, 2, 0.10, 0.10, 0.12, 1, 0, 1);
          writeInst(buf, n++, item.x + 4, item.y + 4, 3, 2, 0.10, 0.10, 0.12, 1, 0, 1);
          break;
        }
        case 'buoy': {
          // 係留ブイ: 赤い半球 + 支柱
          writeInst(buf, n++, item.x, item.y, 6, 5, 0.88, 0.25, 0.20, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y + 2, 2, 3, 0.30, 0.25, 0.22, 1);
          writeInst(buf, n++, item.x, item.y - 1.5, 2, 2, 0.95, 0.90, 0.25, 0.85);
          break;
        }
        case 'pallet_stack': {
          // 木製パレット 2 段重ね
          writeInst(buf, n++, item.x + 1, item.y + 1, 15, 5, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y - 1, 14, 2, 0.60, 0.42, 0.24, 1);
          writeInst(buf, n++, item.x, item.y + 2, 14, 2, 0.55, 0.38, 0.20, 1);
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, item.x + i * 5, item.y - 1, 1, 2, 0.38, 0.25, 0.12, 0.8);
            writeInst(buf, n++, item.x + i * 5, item.y + 2, 1, 2, 0.38, 0.25, 0.12, 0.8);
          }
          break;
        }
        // ── 和風・古都 (Stage 3) ─────────────────────────────────
        case 'koma_inu': {
          // 狛犬: 石造りの獅子像
          writeInst(buf, n++, item.x + 1, item.y - 1, 9, 10, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x, item.y, 7, 8, 0.60, 0.58, 0.52, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y - 2.5, 5, 3, 0.55, 0.52, 0.48, 1, 0, 1); // 頭
          writeInst(buf, n++, item.x - 1.5, item.y - 2.8, 0.6, 0.6, 0.15, 0.12, 0.08, 1); // 目
          writeInst(buf, n++, item.x + 1.5, item.y - 2.8, 0.6, 0.6, 0.15, 0.12, 0.08, 1);
          writeInst(buf, n++, item.x, item.y + 4, 8, 2, 0.48, 0.45, 0.40, 1); // 台座
          break;
        }
        case 'ema_rack': {
          // 絵馬掛け: 木枠 + 小さな絵馬 (木札) 群
          writeInst(buf, n++, item.x, item.y - 3, 14, 1.2, 0.50, 0.32, 0.18, 1);
          writeInst(buf, n++, item.x - 6, item.y, 1, 6, 0.45, 0.28, 0.14, 1);
          writeInst(buf, n++, item.x + 6, item.y, 1, 6, 0.45, 0.28, 0.14, 1);
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, item.x + i * 2.8, item.y, 2, 3, 0.85, 0.75, 0.55, 1);
            writeInst(buf, n++, item.x + i * 2.8, item.y - 1.5, 0.4, 1, 0.30, 0.22, 0.12, 0.7);
          }
          break;
        }
        case 'bamboo_fence': {
          // 竹垣: 横棒 2 本 + 縦竹複数本
          writeInst(buf, n++, item.x, item.y - 2, 20, 0.8, 0.42, 0.30, 0.20, 1);
          writeInst(buf, n++, item.x, item.y + 2, 20, 0.8, 0.42, 0.30, 0.20, 1);
          for (let i = -4; i <= 4; i++) {
            writeInst(buf, n++, item.x + i * 2.2, item.y, 0.8, 6, 0.38, 0.58, 0.28, 1);
            writeInst(buf, n++, item.x + i * 2.2, item.y, 0.4, 6, 0.60, 0.78, 0.38, 0.5);
          }
          break;
        }
        case 'temizuya': {
          // 手水舎: 木組屋根 + 石盤 + 柄杓
          writeInst(buf, n++, item.x + 1, item.y - 1, 13, 13, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y - 4, 12, 3, 0.38, 0.28, 0.18, 1); // 屋根
          writeInst(buf, n++, item.x, item.y - 2, 13, 1, 0.28, 0.18, 0.10, 1); // 棟
          writeInst(buf, n++, item.x - 5, item.y + 1, 1, 6, 0.45, 0.32, 0.20, 1); // 柱 L
          writeInst(buf, n++, item.x + 5, item.y + 1, 1, 6, 0.45, 0.32, 0.20, 1); // 柱 R
          writeInst(buf, n++, item.x, item.y + 3, 11, 3, 0.55, 0.52, 0.48, 1);   // 石盤
          writeInst(buf, n++, item.x, item.y + 3, 9, 1.5, 0.30, 0.50, 0.70, 0.85); // 水
          writeInst(buf, n++, item.x - 2, item.y + 2, 3, 1, 0.60, 0.42, 0.22, 0.85); // 柄杓
          break;
        }
        // ── テーマパーク・祭り (Stage 5) ──────────────────────────
        case 'balloon_cluster': {
          // 風船束: 色とりどりの円 + 紐
          writeInst(buf, n++, item.x, item.y + 3, 0.4, 6, 0.25, 0.22, 0.20, 0.8); // 紐
          writeInst(buf, n++, item.x - 2, item.y - 4, 3, 4, 0.92, 0.25, 0.30, 1, 0, 1);
          writeInst(buf, n++, item.x + 2, item.y - 4, 3, 4, 0.30, 0.50, 0.90, 1, 0, 1);
          writeInst(buf, n++, item.x,     item.y - 7, 3, 4, 0.95, 0.85, 0.22, 1, 0, 1);
          writeInst(buf, n++, item.x - 3, item.y - 7, 2.5, 3, 0.95, 0.55, 0.75, 1, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y - 6, 2.5, 3, 0.40, 0.80, 0.40, 1, 0, 1);
          break;
        }
        case 'ticket_booth': {
          // チケット売場: ピンクの小ブース + 屋根 + 窓
          writeInst(buf, n++, item.x + 1, item.y + 1, 11, 13, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 10, 12, 0.95, 0.55, 0.70, 1);
          writeInst(buf, n++, item.x, item.y - 5, 12, 3, 0.85, 0.30, 0.45, 1); // 屋根
          writeInst(buf, n++, item.x, item.y - 1, 7, 4, 0.95, 0.92, 0.80, 0.95); // 窓
          writeInst(buf, n++, item.x, item.y - 1, 0.6, 3, 0.40, 0.28, 0.18, 0.85); // 格子
          writeInst(buf, n++, item.x, item.y + 3, 6, 1.5, 0.95, 0.85, 0.20, 1); // TICKETS 看板
          break;
        }
        case 'matsuri_drum': {
          // 祭り太鼓: 赤い胴 + 支柱
          writeInst(buf, n++, item.x + 1, item.y, 13, 10, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 12, 9, 0.85, 0.25, 0.22, 1, 0, 1);
          writeInst(buf, n++, item.x, item.y, 11, 8, 0.92, 0.82, 0.65, 0.9, 0, 1); // 皮面
          writeInst(buf, n++, item.x - 5, item.y + 5, 1.5, 4, 0.40, 0.28, 0.18, 1);
          writeInst(buf, n++, item.x + 5, item.y + 5, 1.5, 4, 0.40, 0.28, 0.18, 1);
          writeInst(buf, n++, item.x, item.y, 0.6, 7, 0.45, 0.20, 0.12, 0.7); // 正中線
          break;
        }
        case 'popcorn_cart': {
          // ポップコーンカート: 赤白ストライプ + 黄色い中身
          writeInst(buf, n++, item.x + 1, item.y, 11, 13, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y - 3, 10, 4, 0.92, 0.20, 0.18, 1); // 屋根
          // ストライプ
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, item.x + i * 3.2, item.y - 3, 1.5, 4, 0.95, 0.92, 0.88, 0.9);
          }
          writeInst(buf, n++, item.x, item.y, 9, 5, 0.95, 0.92, 0.85, 0.95); // ガラスケース
          writeInst(buf, n++, item.x, item.y, 7, 3, 0.95, 0.82, 0.25, 1, 0, 1); // ポップコーン
          // タイヤ
          writeInst(buf, n++, item.x - 3, item.y + 5, 2.5, 2, 0.12, 0.10, 0.10, 1, 0, 1);
          writeInst(buf, n++, item.x + 3, item.y + 5, 2.5, 2, 0.12, 0.10, 0.10, 1, 0, 1);
          break;
        }
        // ── Stage 1 ミニチュア強化 (T-6) ───────────────────────────
        case 'ac_outdoor_cluster': {
          // 路地の壁際に並ぶ室外機 3 基
          writeInst(buf, n++, item.x + 1, item.y - 1, 11, 5, 0, 0, 0, 0.20);
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, item.x + i * 3.2, item.y, 2.8, 3.5, 0.72, 0.72, 0.70, 1);
            writeInst(buf, n++, item.x + i * 3.2, item.y, 2.4, 0.5, 0.48, 0.48, 0.48, 0.9);
          }
          // 配管 (上部の横帯)
          writeInst(buf, n++, item.x, item.y - 2, 9, 0.6, 0.40, 0.40, 0.38, 0.85);
          break;
        }
        case 'power_line': {
          // 電線: 2 本の水平線 (半透明)
          writeInst(buf, n++, item.x, item.y - 0.3, 40, 0.25, 0.15, 0.12, 0.08, 0.75);
          writeInst(buf, n++, item.x, item.y + 0.3, 40, 0.25, 0.15, 0.12, 0.08, 0.75);
          // 中央のたるみ
          writeInst(buf, n++, item.x, item.y, 12, 0.35, 0.18, 0.14, 0.10, 0.60);
          break;
        }
        case 'laundry_balcony': {
          // 物干し竿 + 4 着の洗濯物
          writeInst(buf, n++, item.x, item.y - 2, 10, 0.5, 0.55, 0.52, 0.48, 1); // 竿
          const palette: [number, number, number][] = [
            [0.95, 0.95, 0.92], [0.72, 0.82, 0.92], [0.92, 0.70, 0.28], [0.85, 0.35, 0.35],
          ];
          for (let i = 0; i < 4; i++) {
            const [r, g, b] = palette[i];
            writeInst(buf, n++, item.x - 3.5 + i * 2.3, item.y + 0.3, 1.8, 3, r, g, b, 0.95);
          }
          break;
        }
        case 'kerbside_vending_pair': {
          // 自販機 2 台並び (青+赤)
          writeInst(buf, n++, item.x + 1, item.y + 1, 13, 11, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x - 3, item.y, 5, 9, 0.18, 0.52, 0.85, 1);
          writeInst(buf, n++, item.x - 3, item.y - 2, 4.2, 3.5, 0.95, 0.92, 0.82, 0.92);
          writeInst(buf, n++, item.x + 3, item.y, 5, 9, 0.85, 0.18, 0.18, 1);
          writeInst(buf, n++, item.x + 3, item.y - 2, 4.2, 3.5, 0.95, 0.92, 0.82, 0.92);
          break;
        }
        case 'post_letter_box': {
          // 住宅用ポスト + 新聞
          writeInst(buf, n++, item.x, item.y + 2, 1, 3, 0.42, 0.38, 0.32, 1); // 柱
          writeInst(buf, n++, item.x, item.y, 3, 2.5, 0.70, 0.32, 0.22, 1); // 箱
          writeInst(buf, n++, item.x, item.y, 2.2, 0.4, 0.20, 0.14, 0.10, 0.85); // 投入口
          writeInst(buf, n++, item.x + 1, item.y + 0.5, 1.5, 0.8, 0.95, 0.92, 0.85, 0.9); // 新聞
          break;
        }
        case 'flower_planter_row': {
          // 花壇列 3 個 (色違い)
          writeInst(buf, n++, item.x, item.y + 1, 16, 4, 0, 0, 0, 0.15);
          const flowers: [number, number, number][] = [
            [0.92, 0.45, 0.65], [0.92, 0.85, 0.35], [0.68, 0.42, 0.85],
          ];
          for (let i = 0; i < 3; i++) {
            const cx = item.x - 5 + i * 5;
            writeInst(buf, n++, cx, item.y, 4.5, 3, 0.55, 0.35, 0.22, 1); // プランター
            const [r, g, b] = flowers[i];
            writeInst(buf, n++, cx, item.y - 0.5, 3.5, 1.8, r, g, b, 0.95); // 花
            writeInst(buf, n++, cx, item.y + 0.5, 3, 0.8, 0.32, 0.62, 0.32, 0.9); // 葉
          }
          break;
        }
        case 'guardrail_short': {
          // 短いガードレール
          writeInst(buf, n++, item.x, item.y, 12, 1.2, 0.85, 0.85, 0.82, 1);
          writeInst(buf, n++, item.x - 4, item.y + 0.2, 0.8, 2, 0.55, 0.55, 0.52, 1);
          writeInst(buf, n++, item.x, item.y + 0.2, 0.8, 2, 0.55, 0.55, 0.52, 1);
          writeInst(buf, n++, item.x + 4, item.y + 0.2, 0.8, 2, 0.55, 0.55, 0.52, 1);
          break;
        }
        case 'railway_track': {
          // 線路: 2 本レール + 枕木 3 本
          writeInst(buf, n++, item.x, item.y, 20, 3, 0.32, 0.28, 0.22, 1); // 砂利
          writeInst(buf, n++, item.x, item.y - 0.8, 20, 0.5, 0.72, 0.72, 0.70, 1); // レール上
          writeInst(buf, n++, item.x, item.y + 0.8, 20, 0.5, 0.72, 0.72, 0.70, 1); // レール下
          for (let i = -1; i <= 1; i++) {
            writeInst(buf, n++, item.x + i * 6, item.y, 1.5, 2.5, 0.42, 0.32, 0.24, 0.95); // 枕木
          }
          break;
        }
        case 'platform_edge': {
          // 駅ホームエッジ (黄色警告線)
          writeInst(buf, n++, item.x, item.y, 30, 2, 0.72, 0.68, 0.62, 1); // ホーム面
          writeInst(buf, n++, item.x, item.y - 0.5, 30, 0.6, 0.92, 0.82, 0.20, 1); // 黄色線
          // 黒い点線
          for (let i = -3; i <= 3; i++) {
            writeInst(buf, n++, item.x + i * 4, item.y - 0.5, 1.5, 0.3, 0.15, 0.12, 0.08, 0.9);
          }
          break;
        }
        case 'railroad_crossing': {
          // 踏切 X 標識 + 赤白遮断機
          writeInst(buf, n++, item.x, item.y + 1, 10, 8, 0.32, 0.28, 0.22, 1); // 地面
          writeInst(buf, n++, item.x, item.y, 9, 1, 0.92, 0.20, 0.18, 1); // 遮断棒
          writeInst(buf, n++, item.x, item.y, 3, 1, 0.95, 0.95, 0.92, 0.9); // 白帯
          writeInst(buf, n++, item.x - 4.5, item.y, 1.5, 2.5, 0.32, 0.28, 0.22, 1); // 支柱
          writeInst(buf, n++, item.x - 4.5, item.y - 2, 3, 3, 0.92, 0.85, 0.20, 1); // X 標識
          break;
        }
        case 'pedestrian_bridge': {
          // 歩道橋 (脚 + デッキ)
          writeInst(buf, n++, item.x + 1, item.y + 1, 22, 10, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x - 8, item.y, 2, 9, 0.55, 0.52, 0.48, 1); // 脚 L
          writeInst(buf, n++, item.x + 8, item.y, 2, 9, 0.55, 0.52, 0.48, 1); // 脚 R
          writeInst(buf, n++, item.x, item.y - 2, 20, 2.5, 0.68, 0.65, 0.58, 1); // デッキ
          writeInst(buf, n++, item.x, item.y - 3.2, 20, 0.5, 0.42, 0.40, 0.36, 0.9); // 手すり
          break;
        }
        case 'signal_tower': {
          // 信号塔 (縦棒 + 3 ランプ)
          writeInst(buf, n++, item.x, item.y, 1.8, 15, 0.38, 0.35, 0.32, 1); // 柱
          writeInst(buf, n++, item.x, item.y - 5, 3, 3, 0.18, 0.18, 0.20, 1); // ハウジング
          writeInst(buf, n++, item.x, item.y - 6, 1.8, 1.8, 0.92, 0.22, 0.18, 1, 0, 1); // 赤
          writeInst(buf, n++, item.x, item.y - 4.5, 1.8, 1.8, 0.92, 0.82, 0.20, 0.7, 0, 1); // 黄
          writeInst(buf, n++, item.x, item.y - 3, 1.8, 1.8, 0.25, 0.85, 0.35, 0.7, 0, 1); // 緑
          break;
        }
        case 'plaza_tile_circle': {
          // 広場の円形タイル模様
          writeInst(buf, n++, item.x, item.y, 40, 40, 0.78, 0.72, 0.62, 1, 0, 1); // 外輪
          writeInst(buf, n++, item.x, item.y, 30, 30, 0.82, 0.76, 0.65, 0.95, 0, 1); // 中輪
          writeInst(buf, n++, item.x, item.y, 18, 18, 0.72, 0.65, 0.55, 0.9, 0, 1); // 内輪
          writeInst(buf, n++, item.x, item.y, 6, 6, 0.55, 0.48, 0.38, 0.85, 0, 1); // 中心
          // 放射状の線 4 本
          writeInst(buf, n++, item.x, item.y, 38, 0.8, 0.62, 0.55, 0.45, 0.7);
          writeInst(buf, n++, item.x, item.y, 0.8, 38, 0.62, 0.55, 0.45, 0.7);
          break;
        }
        case 'fountain_large': {
          // 大噴水
          writeInst(buf, n++, item.x, item.y, 24, 24, 0.55, 0.55, 0.52, 1, 0, 1); // 外輪石
          writeInst(buf, n++, item.x, item.y, 20, 20, 0.35, 0.58, 0.75, 1, 0, 1); // 水面
          writeInst(buf, n++, item.x, item.y, 14, 14, 0.45, 0.68, 0.82, 0.85, 0, 1); // 明部
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.60, 0.58, 0.52, 1, 0, 1); // 中央像台
          writeInst(buf, n++, item.x, item.y - 1, 2.5, 5, 0.82, 0.78, 0.70, 1); // 像
          // 噴射 4 方向
          writeInst(buf, n++, item.x, item.y - 6, 1, 4, 0.85, 0.92, 0.98, 0.75);
          writeInst(buf, n++, item.x, item.y + 6, 1, 4, 0.85, 0.92, 0.98, 0.75);
          writeInst(buf, n++, item.x - 6, item.y, 4, 1, 0.85, 0.92, 0.98, 0.75);
          writeInst(buf, n++, item.x + 6, item.y, 4, 1, 0.85, 0.92, 0.98, 0.75);
          break;
        }
        case 'taxi_rank_sign': {
          // タクシー乗り場 (黄色看板)
          writeInst(buf, n++, item.x, item.y + 3, 1, 4, 0.38, 0.35, 0.32, 1); // 柱
          writeInst(buf, n++, item.x, item.y - 1.5, 3.2, 3, 0.95, 0.82, 0.20, 1); // 看板
          writeInst(buf, n++, item.x, item.y - 1.5, 2.5, 0.6, 0.15, 0.12, 0.08, 0.95); // 文字帯
          break;
        }
        case 'sando_stone_pillar': {
          // 参道の石柱
          writeInst(buf, n++, item.x, item.y + 4, 3, 1.2, 0.55, 0.52, 0.48, 1); // 台座
          writeInst(buf, n++, item.x, item.y - 0.5, 2, 9, 0.70, 0.68, 0.62, 1); // 柱本体
          writeInst(buf, n++, item.x, item.y - 4.5, 2.5, 1, 0.62, 0.58, 0.52, 1); // 上面キャップ
          break;
        }
        case 'ema_wall': {
          // 絵馬の壁
          writeInst(buf, n++, item.x, item.y + 2, 18, 2, 0.42, 0.28, 0.18, 1); // 柵下
          writeInst(buf, n++, item.x, item.y - 1.5, 18, 0.6, 0.55, 0.35, 0.22, 1); // 柵上
          // 絵馬 6 枚 (色違い)
          const emaColors: [number, number, number][] = [
            [0.95, 0.82, 0.55], [0.92, 0.72, 0.55], [0.98, 0.88, 0.62],
            [0.88, 0.65, 0.45], [0.95, 0.78, 0.50], [0.92, 0.85, 0.58],
          ];
          for (let i = 0; i < 6; i++) {
            const [r, g, b] = emaColors[i];
            writeInst(buf, n++, item.x - 7 + i * 2.8, item.y + 0.3, 2.2, 2.2, r, g, b, 0.95);
          }
          break;
        }
        case 'omikuji_stand': {
          // おみくじ結び所
          writeInst(buf, n++, item.x, item.y + 1, 7, 2, 0.42, 0.28, 0.18, 1); // 骨組下
          writeInst(buf, n++, item.x, item.y - 1.5, 7, 0.6, 0.42, 0.28, 0.18, 1); // 骨組上
          writeInst(buf, n++, item.x - 2, item.y + 1, 0.6, 4, 0.35, 0.22, 0.14, 1); // 柱 L
          writeInst(buf, n++, item.x + 2, item.y + 1, 0.6, 4, 0.35, 0.22, 0.14, 1); // 柱 R
          // 紙の房 (白い小矩形多数)
          for (let i = -2; i <= 2; i++) {
            writeInst(buf, n++, item.x + i * 1.5, item.y, 1, 1.8, 0.95, 0.95, 0.92, 0.9);
          }
          break;
        }
        case 'shrine_fence_red': {
          // 朱色の玉垣
          writeInst(buf, n++, item.x, item.y, 16, 2.8, 0.72, 0.22, 0.18, 1); // 横木
          // 柱 4 本
          for (let i = -1.5; i <= 1.5; i++) {
            writeInst(buf, n++, item.x + i * 4, item.y, 1, 2.8, 0.85, 0.28, 0.22, 1);
          }
          writeInst(buf, n++, item.x, item.y - 1, 16, 0.4, 0.95, 0.92, 0.85, 0.85); // 帯
          break;
        }
        case 'bamboo_water_fountain': {
          // 鹿威し
          writeInst(buf, n++, item.x, item.y + 2.5, 4, 1.5, 0.45, 0.55, 0.32, 1); // 石皿
          writeInst(buf, n++, item.x - 0.5, item.y, 3.5, 0.8, 0.62, 0.85, 0.52, 1, 20, 0); // 竹筒
          writeInst(buf, n++, item.x, item.y - 1.5, 0.8, 2.5, 0.55, 0.75, 0.45, 1); // 支柱
          writeInst(buf, n++, item.x + 1, item.y + 2.5, 1.5, 0.5, 0.35, 0.55, 0.82, 0.85); // 水
          break;
        }
        case 'puddle_reflection': {
          // 路面の水たまり
          writeInst(buf, n++, item.x, item.y, 8, 4, 0.25, 0.42, 0.62, 0.55, 0, 1); // 水面
          writeInst(buf, n++, item.x - 1, item.y - 0.5, 4, 1.5, 0.55, 0.72, 0.85, 0.70, 0, 1); // ハイライト
          break;
        }
        case 'manhole_cover': {
          // マンホール
          writeInst(buf, n++, item.x, item.y, 5, 5, 0.28, 0.26, 0.22, 1, 0, 1); // 外円
          writeInst(buf, n++, item.x, item.y, 3.5, 3.5, 0.35, 0.32, 0.28, 1, 0, 1); // 内円
          writeInst(buf, n++, item.x, item.y, 3.5, 0.4, 0.22, 0.20, 0.18, 0.9); // 十字 H
          writeInst(buf, n++, item.x, item.y, 0.4, 3.5, 0.22, 0.20, 0.18, 0.9); // 十字 V
          break;
        }
        case 'cable_junction_box': {
          // 路地の配電ボックス
          writeInst(buf, n++, item.x + 0.5, item.y + 0.5, 5.5, 6.5, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 5, 6, 0.62, 0.60, 0.55, 1); // 灰箱
          writeInst(buf, n++, item.x, item.y - 1.5, 4, 1, 0.92, 0.82, 0.20, 0.95); // 黄警告ラベル
          writeInst(buf, n++, item.x + 1.5, item.y + 1.5, 0.8, 0.8, 0.25, 0.22, 0.18, 1); // 鍵
          break;
        }
        case 'bicycle_row': {
          // 駐輪列 4 台 + 屋根
          writeInst(buf, n++, item.x, item.y - 2, 24, 1.5, 0.55, 0.52, 0.48, 0.85); // 屋根
          const colors: [number, number, number][] = [
            [0.35, 0.55, 0.75], [0.72, 0.42, 0.35], [0.35, 0.62, 0.45], [0.62, 0.52, 0.68],
          ];
          for (let i = 0; i < 4; i++) {
            const [r, g, b] = colors[i];
            const cx = item.x - 9 + i * 6;
            writeInst(buf, n++, cx, item.y + 0.5, 5, 2, r, g, b, 1); // フレーム
            writeInst(buf, n++, cx - 1.5, item.y + 1.5, 1.3, 1.3, 0.15, 0.12, 0.10, 1, 0, 1); // 前輪
            writeInst(buf, n++, cx + 1.5, item.y + 1.5, 1.3, 1.3, 0.15, 0.12, 0.10, 1, 0, 1); // 後輪
          }
          break;
        }
        // ── Act signatures ───────────────────────────────────────
        case 'play_structure': {
          // カラフル複合遊具: 影 + 赤デッキ + 黄屋根 + 青塔 + 橙階段
          writeInst(buf, n++, item.x + 2, item.y + 2, 21, 19, 0, 0, 0, 0.20);
          writeInst(buf, n++, item.x, item.y, 20, 18, 0.90, 0.25, 0.25, 1);          // 赤デッキ
          writeInst(buf, n++, item.x - 5, item.y - 3, 9, 9, 0.20, 0.55, 0.90, 1);    // 青塔
          writeInst(buf, n++, item.x + 4, item.y - 3, 10, 7, 0.95, 0.85, 0.15, 1);   // 黄屋根
          writeInst(buf, n++, item.x + 5, item.y + 5, 5, 5, 1.00, 0.55, 0.15, 1);    // 橙階段
          writeInst(buf, n++, item.x - 5, item.y + 5, 3, 3, 0.30, 0.80, 0.45, 1, 0, 1); // 緑ボタン
          break;
        }
        case 'slide': {
          // すべり台: 階段 + 滑走面 + 着地マット
          writeInst(buf, n++, item.x + 1, item.y + 1, 8, 14, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x - 2, item.y - 4, 3, 6, 0.60, 0.40, 0.25, 1);    // 茶階段
          writeInst(buf, n++, item.x + 1, item.y, 4, 12, 0.30, 0.75, 0.90, 1);       // 水色滑走面
          writeInst(buf, n++, item.x + 1, item.y + 6, 5, 3, 0.95, 0.35, 0.55, 0.9);  // ピンク着地マット
          break;
        }
        case 'swing_set': {
          // ブランコ: フレーム + 座面×2 (赤/黄)
          writeInst(buf, n++, item.x - 8, item.y, 1.5, 8, 0.45, 0.45, 0.50, 1);      // 左支柱
          writeInst(buf, n++, item.x + 8, item.y, 1.5, 8, 0.45, 0.45, 0.50, 1);      // 右支柱
          writeInst(buf, n++, item.x, item.y - 3, 17, 1.2, 0.55, 0.55, 0.60, 1);     // 横バー
          writeInst(buf, n++, item.x - 4, item.y + 2, 3, 1.5, 0.95, 0.25, 0.20, 1);  // 赤座面
          writeInst(buf, n++, item.x + 4, item.y + 2, 3, 1.5, 0.98, 0.85, 0.20, 1);  // 黄座面
          writeInst(buf, n++, item.x - 4, item.y, 0.5, 5, 0.20, 0.20, 0.20, 0.9);    // チェーン L
          writeInst(buf, n++, item.x + 4, item.y, 0.5, 5, 0.20, 0.20, 0.20, 0.9);    // チェーン R
          break;
        }
        case 'sandbox': {
          // 砂場: 木枠 + 砂 + 小バケツ
          writeInst(buf, n++, item.x + 1, item.y + 1, 16, 10, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 15, 9, 0.55, 0.38, 0.22, 1);            // 木枠
          writeInst(buf, n++, item.x, item.y, 13, 7, 0.95, 0.88, 0.62, 1);            // 砂
          writeInst(buf, n++, item.x + 4, item.y - 1, 2, 2, 0.25, 0.65, 0.90, 1, 0, 1); // 青バケツ
          writeInst(buf, n++, item.x - 4, item.y + 1, 1.8, 1.8, 0.95, 0.30, 0.30, 1, 0, 1); // 赤スコップ
          break;
        }
        case 'bathhouse_chimney': {
          // 銭湯の煙突: 赤白縞の高い煙突 + 頂上の煙
          writeInst(buf, n++, item.x + 1, item.y + 1, 5, 28, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x, item.y - 10, 4, 8, 0.95, 0.95, 0.92, 1);        // 白帯
          writeInst(buf, n++, item.x, item.y - 2, 4, 8, 0.85, 0.20, 0.18, 1);         // 赤帯
          writeInst(buf, n++, item.x, item.y + 6, 4, 8, 0.95, 0.95, 0.92, 1);         // 白帯
          writeInst(buf, n++, item.x, item.y - 13, 5, 1.8, 0.30, 0.28, 0.26, 1);      // 頂口
          writeInst(buf, n++, item.x - 1, item.y - 16, 4, 3, 0.82, 0.82, 0.85, 0.65, 0, 1); // 煙
          writeInst(buf, n++, item.x + 1, item.y - 18, 3, 2.5, 0.88, 0.88, 0.90, 0.45, 0, 1);
          break;
        }
        case 'jungle_gym': {
          // ジャングルジム: 銀格子 3x2
          writeInst(buf, n++, item.x + 1, item.y + 1, 16, 12, 0, 0, 0, 0.18);
          writeInst(buf, n++, item.x, item.y, 15, 11, 0.62, 0.65, 0.70, 0.35);        // 下地影
          for (let ix = -1; ix <= 1; ix++) {
            writeInst(buf, n++, item.x + ix * 5, item.y, 1.2, 11, 0.58, 0.62, 0.70, 1); // 縦バー
          }
          writeInst(buf, n++, item.x, item.y - 4, 15, 1.0, 0.60, 0.64, 0.72, 1);       // 横バー上
          writeInst(buf, n++, item.x, item.y, 15, 1.0, 0.60, 0.64, 0.72, 1);           // 横バー中
          writeInst(buf, n++, item.x, item.y + 4, 15, 1.0, 0.60, 0.64, 0.72, 1);       // 横バー下
          break;
        }
        case 'fire_watchtower': {
          // 火の見やぐら: 鉄骨三角 + 頂上の小屋 + 半鐘
          writeInst(buf, n++, item.x + 1, item.y + 1, 6, 24, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x - 2.5, item.y, 0.8, 22, 0.45, 0.35, 0.28, 1);     // 左柱
          writeInst(buf, n++, item.x + 2.5, item.y, 0.8, 22, 0.45, 0.35, 0.28, 1);     // 右柱
          writeInst(buf, n++, item.x, item.y - 6, 5.5, 0.8, 0.50, 0.40, 0.32, 1);      // 筋交 1
          writeInst(buf, n++, item.x, item.y + 0, 5.5, 0.8, 0.50, 0.40, 0.32, 1);      // 筋交 2
          writeInst(buf, n++, item.x, item.y + 6, 5.5, 0.8, 0.50, 0.40, 0.32, 1);      // 筋交 3
          writeInst(buf, n++, item.x, item.y - 10, 6, 4, 0.72, 0.28, 0.22, 1);          // 赤小屋
          writeInst(buf, n++, item.x, item.y - 12, 7, 1.5, 0.30, 0.25, 0.20, 1);        // 屋根
          writeInst(buf, n++, item.x + 2, item.y - 10, 1.2, 1.5, 0.90, 0.82, 0.20, 1); // 半鐘
          break;
        }
        case 'grain_silo': {
          // サイロ: 銀色円筒 + ドーム + 小窓
          writeInst(buf, n++, item.x + 1, item.y + 1, 11, 18, 0, 0, 0, 0.22);
          writeInst(buf, n++, item.x, item.y, 10, 16, 0.72, 0.75, 0.78, 1);            // 本体
          writeInst(buf, n++, item.x, item.y - 8, 10, 4, 0.62, 0.65, 0.68, 1, 0, 1);   // 上ドーム
          writeInst(buf, n++, item.x, item.y - 8, 3, 3, 0.40, 0.42, 0.45, 1, 0, 1);    // 通気口
          writeInst(buf, n++, item.x, item.y + 6, 4, 2, 0.35, 0.32, 0.30, 1);          // 排出口
          writeInst(buf, n++, item.x + 3, item.y - 2, 1.2, 1.2, 0.40, 0.38, 0.32, 1);  // 点検窓
          writeInst(buf, n++, item.x - 3, item.y - 2, 1.2, 1.2, 0.40, 0.38, 0.32, 1);
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
      if (Math.abs(item.y - by) > 30) continue;
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

export type VehicleType = 'car' | 'bus' | 'truck' | 'ambulance' | 'taxi' | 'motorcycle' | 'delivery' | 'van';

export interface VehicleItem {
  type: VehicleType;
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
  type: VehicleType;
  lane: 'hilltop' | 'main' | 'lower' | 'riverside';
  direction: 1 | -1;
  speed: number;
  interval: number;
}

const VEHICLE_DEFS_DATA: Record<VehicleType, { w: number; h: number; maxHp: number; score: number; speedMin: number; speedMax: number }> = {
  car:        { w: 20, h: 10, maxHp: 1, score:  3, speedMin: 50,  speedMax: 70  },
  bus:        { w: 28, h: 12, maxHp: 1, score:  8, speedMin: 35,  speedMax: 50  },
  truck:      { w: 24, h: 12, maxHp: 1, score:  5, speedMin: 30,  speedMax: 45  },
  ambulance:  { w: 22, h: 10, maxHp: 1, score: 50, speedMin: 100, speedMax: 120 },
  taxi:       { w: 20, h: 10, maxHp: 1, score:  3, speedMin: 55,  speedMax: 75  },
  motorcycle: { w: 12, h:  7, maxHp: 1, score:  2, speedMin: 70,  speedMax: 100 },
  delivery:   { w: 22, h: 11, maxHp: 1, score:  3, speedMin: 40,  speedMax: 60  },
  van:        { w: 22, h: 11, maxHp: 1, score:  4, speedMin: 35,  speedMax: 55  },
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
  private dynLanes: Array<{
    chunkId: number; laneY: number; laneH: number;
    timerR: number; timerL: number;
  }> = [];

  load(defs: VehicleDef[]) {
    this.defs = defs;
    this.spawnTimers = defs.map(d => d.interval * Math.random());
    this.vehicles = [];
  }

  addChunkLanes(chunkId: number, roads: { y: number; h: number }[]) {
    for (const road of roads) {
      this.dynLanes.push({
        chunkId,
        laneY: road.y, laneH: road.h,
        timerR: 1 + Math.random() * 4,
        timerL: 2 + Math.random() * 4,
      });
    }
  }

  removeChunkLanes(chunkId: number) {
    this.dynLanes = this.dynLanes.filter(l => l.chunkId !== chunkId);
  }

  update(dt: number, cameraY = 0) {
    const camBottom = cameraY + C.WORLD_MIN_Y;

    // Update static spawn timers (initial city roads)
    for (let i = 0; i < this.defs.length; i++) {
      this.spawnTimers[i] -= dt;
      if (this.spawnTimers[i] <= 0) {
        this.spawnTimers[i] = this.defs[i].interval;
        this.spawnVehicle(this.defs[i]);
      }
    }
    // Update dynamic (chunk) spawn timers — only spawn on visible/near lanes
    const dynTypes: VehicleType[] = ['car', 'car', 'car', 'bus', 'truck', 'taxi', 'motorcycle', 'delivery', 'van'];
    for (const lane of this.dynLanes) {
      if (lane.laneY < camBottom - 50) continue;  // road scrolled off bottom
      lane.timerR -= dt;
      lane.timerL -= dt;
      if (lane.timerR <= 0) {
        lane.timerR = 3 + Math.random() * 5;
        const t = dynTypes[Math.floor(Math.random() * dynTypes.length)];
        this.spawnDynVehicle(lane.laneY, lane.laneH, 1, t);
      }
      if (lane.timerL <= 0) {
        lane.timerL = 3.5 + Math.random() * 5;
        const t = dynTypes[Math.floor(Math.random() * dynTypes.length)];
        this.spawnDynVehicle(lane.laneY, lane.laneH, -1, t);
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
      // Despawn when off-screen horizontally or scrolled below camera
      const margin = 40;
      if (v.x > 180 + margin || v.x < -180 - margin) v.active = false;
      if (v.y < camBottom - 60) v.active = false;
    }
    // Remove inactive
    this.vehicles = this.vehicles.filter(v => v.active);
  }

  private spawnDynVehicle(laneY: number, laneH: number, dir: 1 | -1,
    type: VehicleType) {
    const info = VEHICLE_DEFS_DATA[type];
    const yOff = dir === 1 ? -laneH / 4 : laneH / 4;
    const startX = dir === 1 ? -180 - info.w / 2 : 180 + info.w / 2;
    const spd = (info.speedMin + Math.random() * (info.speedMax - info.speedMin)) * dir;
    this.vehicles.push({
      type, x: startX, y: laneY + yOff,
      w: info.w, h: info.h,
      hp: info.maxHp, maxHp: info.maxHp, score: info.score,
      speed: spd, active: true, flashTimer: 0,
    });
  }

  spawnAmbulance(x: number, y: number) {
    const v: VehicleItem = {
      type: 'ambulance', x, y,
      w: 22, h: 10, hp: 1, maxHp: 1, score: 50,
      speed: 110, active: true, flashTimer: 0,
      isAmbulance: true, ambTimer: 10,
    };
    this.vehicles.push(v);
  }

  private spawnVehicle(def: VehicleDef) {
    const laneY =
      def.lane === 'hilltop'   ? C.HILLTOP_STREET_Y   :
      def.lane === 'main'      ? C.MAIN_STREET_Y      :
      def.lane === 'lower'     ? C.LOWER_STREET_Y     :
      def.lane === 'riverside' ? C.RIVERSIDE_STREET_Y : C.MAIN_STREET_Y;

    const laneH =
      def.lane === 'hilltop'   ? C.HILLTOP_STREET_H   :
      def.lane === 'main'      ? C.MAIN_STREET_H      :
      def.lane === 'lower'     ? C.LOWER_STREET_H     :
      def.lane === 'riverside' ? C.RIVERSIDE_STREET_H : C.MAIN_STREET_H;
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

  damage(v: VehicleItem, dmg: number = 1): boolean {
    v.hp -= dmg;
    v.flashTimer = 0.1;
    if (v.hp <= 0) { v.active = false; return true; }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number, cameraY = 0): number {
    let n = startIdx;
    const camBot = cameraY + C.WORLD_MIN_Y - 50;
    const camTop = cameraY + C.WORLD_MAX_Y + 50;
    for (const v of this.vehicles) {
      if (!v.active) continue;
      if (v.y < camBot || v.y > camTop) continue;
      const isFlash = v.flashTimer > 0;
      let cr: number, cg: number, cb: number;

      if (v.type === 'ambulance') {
        cr = 0.98; cg = 0.98; cb = 0.98;
      } else if (v.type === 'bus') {
        cr = 0.95; cg = 0.80; cb = 0.10;
      } else if (v.type === 'truck') {
        cr = 0.50; cg = 0.55; cb = 0.60;
      } else if (v.type === 'taxi') {
        cr = 0.95; cg = 0.88; cb = 0.05;
      } else if (v.type === 'delivery') {
        cr = 0.92; cg = 0.92; cb = 0.92;
      } else if (v.type === 'van') {
        cr = 0.42; cg = 0.55; cb = 0.68;
      } else {
        // car/motorcycle: deterministic color from spawn position
        const ci = Math.abs(Math.floor(v.y * 31 + Math.floor(v.speed * 0.1))) % CAR_COLORS.length;
        [cr, cg, cb] = CAR_COLORS[ci];
      }

      if (isFlash) { cr = cg = cb = 1; }

      // 俯瞰: 影
      writeInst(buf, n++, v.x + 2, v.y - 2, v.w, v.h, 0, 0, 0, 0.22);
      // 車体
      writeInst(buf, n++, v.x, v.y, v.w, v.h, cr, cg, cb, 1);

      if (v.type === 'truck') {
        const dir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + dir * v.w * 0.28, v.y, v.w * 0.45, v.h * 0.85,
          cr - 0.08, cg - 0.08, cb - 0.08, 1);
        writeInst(buf, n++, v.x + dir * v.w * 0.28, v.y, v.w * 0.30, v.h * 0.5,
          0.65, 0.85, 0.95, 0.7);
      } else if (v.type === 'bus') {
        writeInst(buf, n++, v.x, v.y, v.w * 0.80, v.h * 0.45, 0.65, 0.85, 0.95, 0.7);
        writeInst(buf, n++, v.x, v.y, v.w * 0.78, 1.5, Math.max(0, cr-0.15), 0.55, 0.08, 0.9);
      } else if (v.type === 'ambulance' && !isFlash) {
        writeInst(buf, n++, v.x, v.y, v.w * 0.60, v.h * 0.50, 0.65, 0.85, 0.95, 0.7);
        writeInst(buf, n++, v.x, v.y, 2.5, v.h * 0.65, 0.90, 0.10, 0.10, 1);
        writeInst(buf, n++, v.x, v.y, v.w * 0.50, 2.5, 0.90, 0.10, 0.10, 1);
      } else if (v.type === 'taxi') {
        // タクシー: 黒帯 + 窓
        writeInst(buf, n++, v.x, v.y, v.w * 0.78, 2, 0.10, 0.10, 0.10, 0.9);
        const tdir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + tdir * v.w * 0.18, v.y, v.w * 0.35, v.h * 0.55, 0.65, 0.85, 0.95, 0.75);
      } else if (v.type === 'motorcycle') {
        // バイク: 小さく細い
        writeInst(buf, n++, v.x, v.y, v.w * 0.40, v.h * 0.65, 0.65, 0.85, 0.95, 0.75);
      } else if (v.type === 'delivery') {
        // 配送車: 荷台 + 社名帯
        const ddir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + ddir * v.w * 0.18, v.y, v.w * 0.35, v.h * 0.75,
          cr - 0.08, cg - 0.08, cb - 0.08, 1);
        writeInst(buf, n++, v.x, v.y, v.w * 0.60, 2, 0.92, 0.25, 0.15, 0.85);
      } else if (v.type === 'van') {
        // バン: 大型窓
        writeInst(buf, n++, v.x, v.y, v.w * 0.72, v.h * 0.48, 0.65, 0.85, 0.95, 0.72);
      } else {
        // 乗用車
        const dir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + dir * v.w * 0.20, v.y, v.w * 0.35, v.h * 0.55,
          0.65, 0.85, 0.95, 0.75);
      }
    }
    return n - startIdx;
  }
}
