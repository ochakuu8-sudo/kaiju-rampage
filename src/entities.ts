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
  /** 人間を食べた累積パワー (0..BALL_POWER_MAX) */
  power = 0;
  // トレイル: リングバッファ
  trail: Float32Array = new Float32Array(C.TRAIL_LEN * 2);
  trailHead = 0;

  /** 現在のボール半径 (パワーに比例して大きくなる) */
  get radius(): number {
    const p = Math.min(this.power, C.BALL_POWER_MAX);
    return Math.min(C.BALL_RADIUS_MAX, C.BALL_RADIUS + p * C.BALL_RADIUS_GROWTH);
  }

  /** 1 ヒットで与えるダメージ。パワー BALL_DAMAGE_STEP ごとに +1。
   *  初期 (power=0) は 1 ダメージ。HP=2 以上のものは一撃で壊せない。 */
  get damage(): number {
    return 1 + Math.floor(Math.min(this.power, C.BALL_POWER_MAX) / C.BALL_DAMAGE_STEP);
  }

  /** 人間を食べたときに呼ぶ */
  addPower(amount: number = C.BALL_POWER_PER_HUMAN) {
    this.power = Math.min(C.BALL_POWER_MAX, this.power + amount);
  }

  /** ボールロスト時にパワーを一部失う */
  losePowerOnBallLost() {
    this.power = Math.floor(this.power * C.BALL_POWER_LOSS_ON_LOST);
  }

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

  /** ゲーム全体のリセット (再スタート時に使用) */
  fullReset() {
    this.power = 0;
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
    vx: number, vy: number
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
          // 屋根帯（暗め）
          writeInst(buf, n++, cx, top - 4, bW + 2, 8,
            cr * 0.50, cg * 0.46, cb * 0.40, 1);
          // 左右の窓
          writeInst(buf, n++, cx - bW * 0.20, bot + bH * 0.52, 4, 5,
            0.78, 0.90, 0.96, 0.90);
          writeInst(buf, n++, cx + bW * 0.20, bot + bH * 0.52, 4, 5,
            0.78, 0.90, 0.96, 0.90);
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.22, 9,
            cr * 0.42, cg * 0.34, cb * 0.25, 1);
          break;
        }
        case 'shop': {
          // 看板帯（建物ごとに色変え）
          const si = Math.abs(Math.floor(b.x * 3 + b.y)) % 3;
          const [sgR, sgG, sgB] = si === 0 ? [0.92, 0.20, 0.18] :
                                   si === 1 ? [0.18, 0.48, 0.90] : [0.20, 0.72, 0.28];
          writeInst(buf, n++, cx, top - 3.5, bW, 7, sgR, sgG, sgB, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.72, bH * 0.38,
            0.72, 0.88, 0.96, 0.85);
          // 庇
          writeInst(buf, n++, cx, bot + bH * 0.38, bW + 4, 4,
            sgR * 0.68, sgG * 0.68, sgB * 0.68, 0.90);
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.18, 9, 0.32, 0.24, 0.18, 1);
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
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.18, 9, 0.28, 0.22, 0.20, 1);
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
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.20, 9, 0.28, 0.18, 0.14, 1);
          break;
        }
        case 'school': {
          // 窓グリッド (教室の窓)
          n = this.drawBuildingWindows(buf, n, cx, bot, bW, bH, cr, cg, cb, 7, 14);
          // 上部バンド
          writeInst(buf, n++, cx, top - 3, bW, 5, cr * 0.82, cg * 0.78, cb * 0.55, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 6, bW * 0.24, bH * 0.25, 0.62, 0.82, 0.94, 0.82);
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
          // 屋根帯（急勾配）
          writeInst(buf, n++, cx, top - 5, bW + 2, 9, cr * 0.45, cg * 0.40, cb * 0.35, 1);
          // 窓×2
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.52, 4, 5, 0.78, 0.90, 0.96, 0.88);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.52, 4, 5, 0.78, 0.90, 0.96, 0.88);
          // ドア
          writeInst(buf, n++, cx, bot + 5, bW * 0.20, 9, cr * 0.40, cg * 0.32, cb * 0.24, 1);
          break;
        }
        case 'mansion': {
          // 中央ポルティコ（列柱）
          writeInst(buf, n++, cx, bot + bH * 0.55, bW * 0.42, bH * 0.52, 0.95, 0.95, 0.92, 0.85);
          // 屋根コーニス
          writeInst(buf, n++, cx, top - 3, bW + 6, 6, cr * 0.72, cg * 0.68, cb * 0.58, 1);
          // 左右対称窓
          for (const xOff of [-bW * 0.33, bW * 0.33]) {
            writeInst(buf, n++, cx + xOff, bot + bH * 0.55, 5, 7, 0.68, 0.88, 0.96, 0.85);
          }
          break;
        }
        case 'garage': {
          // 大型シャッタードア
          writeInst(buf, n++, cx, bot + bH * 0.50, bW * 0.72, bH * 0.72, 0.50, 0.52, 0.55, 0.9);
          writeInst(buf, n++, cx, bot + bH * 0.52, bW * 0.70, 1.5, cr * 0.60, cg * 0.60, cb * 0.60, 1);
          break;
        }
        case 'shed': {
          // 屋根のみ（小屋）
          writeInst(buf, n++, cx, top - 4, bW + 3, 7, cr * 0.48, cg * 0.42, cb * 0.36, 1);
          break;
        }
        case 'greenhouse': {
          // ガラス面（明るい全体）
          writeInst(buf, n++, cx, cy, bW - 2, bH - 2, 0.72, 0.95, 0.88, 0.70);
          // フレーム（縦×2）
          writeInst(buf, n++, cx - bW * 0.25, cy, 1.5, bH, cr * 0.55, cg * 0.62, cb * 0.58, 0.9);
          writeInst(buf, n++, cx + bW * 0.25, cy, 1.5, bH, cr * 0.55, cg * 0.62, cb * 0.58, 0.9);
          break;
        }
        case 'daycare': {
          // カラフルストライプ帯
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.95, 0.35, 0.35, 1);
          writeInst(buf, n++, cx, top - 8, bW, 3, 0.95, 0.90, 0.20, 1);
          // 玄関（丸みある）
          writeInst(buf, n++, cx, bot + 6, bW * 0.28, 11, 0.55, 0.88, 0.96, 0.85);
          break;
        }
        case 'clinic': {
          // グリーン十字
          writeInst(buf, n++, cx, top - bH * 0.22, 4, bH * 0.26, 0.15, 0.72, 0.35, 1);
          writeInst(buf, n++, cx, top - bH * 0.22, bW * 0.26, 4, 0.15, 0.72, 0.35, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 6, bW * 0.34, 11, 0.65, 0.88, 0.96, 0.82);
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
          break;
        }
        // ── 1-B 商業系 ────────────────────────────────────────────
        case 'cafe': {
          // 暖色テント
          writeInst(buf, n++, cx, bot + bH * 0.52, bW + 5, 4, 0.72, 0.38, 0.18, 0.90);
          // 看板帯
          writeInst(buf, n++, cx, top - 3, bW, 6, cr * 1.15, cg * 0.85, cb * 0.55, 1);
          // 窓
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.68, bH * 0.32, 0.78, 0.90, 0.82, 0.80);
          break;
        }
        case 'bakery': {
          // 看板（暖色）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.90, 0.70, 0.30, 1);
          // 丸窓（フランス扉風）
          writeInst(buf, n++, cx, bot + bH * 0.52, bW * 0.50, bH * 0.50, 0.80, 0.90, 0.96, 0.80);
          break;
        }
        case 'bookstore': {
          // 看板帯（茶）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.52, 0.38, 0.22, 1);
          // ショーウィンドウ（本棚イメージ）
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.72, bH * 0.38, 0.75, 0.88, 0.96, 0.80);
          writeInst(buf, n++, cx, bot + bH * 0.40, bW * 0.70, 2, 0.52, 0.38, 0.22, 0.6);
          break;
        }
        case 'pharmacy': {
          // グリーン十字（薬局）
          writeInst(buf, n++, cx, top - bH * 0.20, 5, bH * 0.25, 0.10, 0.72, 0.30, 1);
          writeInst(buf, n++, cx, top - bH * 0.20, bW * 0.28, 5, 0.10, 0.72, 0.30, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.38, bW * 0.68, bH * 0.34, 0.72, 0.92, 0.96, 0.80);
          break;
        }
        case 'supermarket': {
          // 看板帯（緑）
          writeInst(buf, n++, cx, top - 4, bW, 8, 0.18, 0.60, 0.28, 1);
          writeInst(buf, n++, cx, top - 9, bW, 3, 0.95, 0.95, 0.95, 0.9);
          // 大きなショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.82, bH * 0.40, 0.70, 0.90, 0.96, 0.82);
          // 入り口
          writeInst(buf, n++, cx, bot + 6, bW * 0.14, 11, 0.28, 0.22, 0.20, 1);
          break;
        }
        case 'karaoke': {
          // ネオン帯×2
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.92, 0.22, 0.80, 1);
          writeInst(buf, n++, cx, top - 9, bW, 3, 0.35, 0.22, 0.80, 0.9);
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
          break;
        }
        case 'laundromat': {
          // 丸窓×2 (洗濯機のポートホール)
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.45, 7, 7, 0.62, 0.85, 0.96, 0.85, 0, 1);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.45, 7, 7, 0.62, 0.85, 0.96, 0.85, 0, 1);
          // 看板帯
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.25, 0.55, 0.85, 1);
          break;
        }
        case 'florist': {
          // 花飾り帯（カラフル）
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.90, 0.42, 0.62, 1);
          writeInst(buf, n++, cx - bW * 0.25, top - 3, 5, 5, 0.95, 0.90, 0.20, 0.9, 0, 1);
          writeInst(buf, n++, cx + bW * 0.25, top - 3, 5, 5, 0.25, 0.80, 0.42, 0.9, 0, 1);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.38, bW * 0.70, bH * 0.34, 0.78, 0.95, 0.80, 0.80);
          break;
        }
        case 'ramen': {
          // 看板帯（赤橙）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.88, 0.28, 0.12, 1);
          // のれん（庇下の帯）
          writeInst(buf, n++, cx, bot + bH * 0.65, bW * 0.60, 4, 0.68, 0.18, 0.10, 0.85);
          // 窓
          writeInst(buf, n++, cx, bot + bH * 0.35, bW * 0.55, bH * 0.26, 0.80, 0.88, 0.82, 0.78);
          break;
        }
        case 'izakaya': {
          // 提灯色帯（暖色）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.82, 0.48, 0.12, 1);
          // 縦看板イメージ
          writeInst(buf, n++, cx - bW * 0.35, cy, 3, bH * 0.55, 0.75, 0.28, 0.12, 1);
          // のれん
          writeInst(buf, n++, cx, bot + bH * 0.62, bW * 0.55, 4, 0.62, 0.30, 0.12, 0.85);
          break;
        }
        case 'game_center': {
          // ネオンブルー看板
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.18, 0.48, 0.90, 1);
          writeInst(buf, n++, cx, top - 8.5, bW, 3, 0.55, 0.22, 0.88, 0.9);
          // ショーウィンドウ
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.75, bH * 0.40, 0.65, 0.85, 0.96, 0.78);
          break;
        }
        // ── 1-C 公共系 ────────────────────────────────────────────
        case 'bank': {
          // 古典的列柱（横帯×3）
          writeInst(buf, n++, cx, top - 4, bW + 4, 7, cr * 0.88, cg * 0.82, cb * 0.68, 1);
          writeInst(buf, n++, cx, bot + 2, bW + 4, 4, cr * 0.82, cg * 0.76, cb * 0.62, 1);
          writeInst(buf, n++, cx, bot + 7, bW * 0.42, bH * 0.55, 0.68, 0.88, 0.96, 0.78);
          break;
        }
        case 'post_office': {
          // オレンジ看板帯
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.92, 0.62, 0.12, 1);
          // 郵便マーク（丸）
          writeInst(buf, n++, cx + bW * 0.30, top - bH * 0.35, 6, 6, 0.92, 0.62, 0.12, 1, 0, 1);
          // 玄関
          writeInst(buf, n++, cx, bot + 6, bW * 0.30, 11, 0.68, 0.88, 0.96, 0.80);
          break;
        }
        case 'library': {
          // 格調ある上帯
          writeInst(buf, n++, cx, top - 4, bW + 4, 8, cr * 0.78, cg * 0.72, cb * 0.62, 1);
          // アーチ窓×2
          writeInst(buf, n++, cx - bW * 0.25, bot + bH * 0.50, 8, bH * 0.40, 0.68, 0.88, 0.96, 0.78);
          writeInst(buf, n++, cx + bW * 0.25, bot + bH * 0.50, 8, bH * 0.40, 0.68, 0.88, 0.96, 0.78);
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
          break;
        }
        case 'fire_station': {
          // 赤いガレージ扉×2
          writeInst(buf, n++, cx - bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.68, 0.18, 0.15, 1);
          writeInst(buf, n++, cx + bW * 0.22, bot + bH * 0.42, bW * 0.38, bH * 0.56, 0.68, 0.18, 0.15, 1);
          // 上帯
          writeInst(buf, n++, cx, top - 3, bW, 6, 0.80, 0.22, 0.18, 1);
          break;
        }
        case 'police_station': {
          // ダークブルー帯
          writeInst(buf, n++, cx, top - 4, bW, 8, 0.25, 0.35, 0.68, 1);
          // エントランス
          writeInst(buf, n++, cx, bot + 7, bW * 0.36, 13, 0.68, 0.88, 0.96, 0.80);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 2, bW, 3, cr * 0.65, cg * 0.65, cb * 0.65, 1);
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
          break;
        }
        case 'movie_theater': {
          // マーキー（看板帯）
          writeInst(buf, n++, cx, top - 3.5, bW, 7, 0.75, 0.22, 0.55, 1);
          writeInst(buf, n++, cx, top - 8.5, bW * 0.88, 3, 0.90, 0.85, 0.15, 0.9);
          // エントランス（大きなアーチ）
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.52, bH * 0.52, 0.22, 0.18, 0.15, 1);
          writeInst(buf, n++, cx, bot + bH * 0.42, bW * 0.46, bH * 0.48, 0.68, 0.58, 0.48, 0.85);
          break;
        }
        case 'gas_station': {
          // 大型キャノピー（屋根）
          writeInst(buf, n++, cx, top + 2, bW + 14, 5, cr * 0.85, cg * 0.85, cb * 0.20, 1);
          // 給油機（縦棒×2）
          writeInst(buf, n++, cx - bW * 0.28, bot + bH * 0.45, 4, bH * 0.60, 0.55, 0.55, 0.58, 1);
          writeInst(buf, n++, cx + bW * 0.28, bot + bH * 0.45, 4, bH * 0.60, 0.55, 0.55, 0.58, 1);
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
  // キャラクター
  'cat';

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
  cat:              3,
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
  cat:              2,
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
        hp: 2, active: true, score: 50,
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
  car:        { w: 20, h: 10, maxHp: 2, score: 120, speedMin: 50,  speedMax: 70  },
  bus:        { w: 28, h: 12, maxHp: 3, score: 200, speedMin: 35,  speedMax: 50  },
  truck:      { w: 24, h: 12, maxHp: 3, score: 180, speedMin: 30,  speedMax: 45  },
  ambulance:  { w: 22, h: 10, maxHp: 2, score: 500, speedMin: 100, speedMax: 120 },
  taxi:       { w: 20, h: 10, maxHp: 2, score: 150, speedMin: 55,  speedMax: 75  },
  motorcycle: { w: 12, h:  7, maxHp: 2, score: 100, speedMin: 70,  speedMax: 100 },
  delivery:   { w: 22, h: 11, maxHp: 2, score: 140, speedMin: 40,  speedMax: 60  },
  van:        { w: 22, h: 11, maxHp: 3, score: 160, speedMin: 35,  speedMax: 55  },
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
      w: 22, h: 10, hp: 1, maxHp: 1, score: 500,
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
