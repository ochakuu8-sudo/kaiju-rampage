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
  // トレイル: リングバッファ
  trail: Float32Array = new Float32Array(C.TRAIL_LEN * 2);
  trailHead = 0;

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
  school:   [0.85, 0.82, 0.60], // 薄黄色
  hospital: [0.90, 0.90, 0.92], // 白
  temple:   [0.52, 0.30, 0.20], // 暗い赤茶
  parking:  [0.68, 0.68, 0.65], // コンクリート
};

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
  // ウェーブシステム拡張
  rubbleTimer: number;  // > 0 かつ active=false: 瓦礫を描画
  spawnTimer: number;   // > 0: スポーンアニメーション進行中
  blockIdx: number;     // 所属ブロックID (0〜14)
  generation: number;   // 再建回数
}

export class BuildingManager {
  buildings: BuildingData[] = [];

  load(defs: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx?: number }>) {
    this.buildings = [];
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      // ファサード色: 種類別パレットからハッシュで選択
      let palette: ReadonlyArray<readonly [number,number,number]>;
      if (BUILDING_TYPE_COLORS[d.size]) {
        palette = [BUILDING_TYPE_COLORS[d.size]!];
      } else if (d.size === 'house' || d.size === 'apartment') {
        palette = FACADE_RESIDENTIAL;
      } else if (d.size === 'shop' || d.size === 'convenience' || d.size === 'restaurant') {
        palette = FACADE_COMMERCIAL;
      } else {
        palette = FACADE_OFFICE;
      }
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
      });
    }
  }

  /** チャンクの建物を追加ロード (chunkId = blockIdx として使用) */
  loadChunk(defs: Array<{ x: number; y: number; size: C.BuildingSize; blockIdx?: number }>) {
    for (const d of defs) {
      const def = C.BUILDING_DEFS[d.size];
      let palette: ReadonlyArray<readonly [number,number,number]>;
      if (BUILDING_TYPE_COLORS[d.size]) {
        palette = [BUILDING_TYPE_COLORS[d.size]!];
      } else if (d.size === 'house' || d.size === 'apartment') {
        palette = FACADE_RESIDENTIAL;
      } else if (d.size === 'shop' || d.size === 'convenience' || d.size === 'restaurant') {
        palette = FACADE_COMMERCIAL;
      } else {
        palette = FACADE_OFFICE;
      }
      const pi = Math.abs(Math.floor(d.x * 7 + d.y * 13)) % palette.length;
      this.buildings.push({
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
      });
    }
  }

  /** チャンクの建物を一括削除 */
  unloadChunk(chunkId: number) {
    this.buildings = this.buildings.filter(b => b.blockIdx !== chunkId);
  }

  allDestroyed(): boolean {
    return this.buildings.every(b => !b.active);
  }

  /** 新しい建物を追加（再建時）。非アクティブスロットを再利用 */
  addBuilding(centerX: number, baseY: number, size: C.BuildingSize, blockIdx: number, generation: number) {
    const def = C.BUILDING_DEFS[size];
    let palette: ReadonlyArray<readonly [number,number,number]>;
    if (BUILDING_TYPE_COLORS[size]) {
      palette = [BUILDING_TYPE_COLORS[size]!];
    } else if (size === 'house' || size === 'apartment') {
      palette = FACADE_RESIDENTIAL;
    } else if (size === 'shop' || size === 'convenience' || size === 'restaurant') {
      palette = FACADE_COMMERCIAL;
    } else {
      palette = FACADE_OFFICE;
    }
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
    };

    // 非アクティブ & 瓦礫なしのスロットを再利用
    const freeIdx = this.buildings.findIndex(b => !b.active && b.rubbleTimer <= 0);
    if (freeIdx >= 0) {
      this.buildings[freeIdx] = newBld;
    } else {
      this.buildings.push(newBld);
    }
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
    for (const b of this.buildings) {
      if (!b.active || b.destroyTimer > 0) continue;
      const res = resolveCircleAABB(bx, by, br, vx, vy, b.x, b.y, b.w, b.h);
      if (res) {
        return { bld: b, newBx: res[0], newBy: res[1], newVx: res[2], newVy: res[3] };
      }
    }
    return null;
  }

  /** 建物にダメージを与え、破壊されたら destroyTimer & rubbleTimer セット */
  damage(b: BuildingData): boolean {
    b.hp--;
    b.flashTimer = 0.08;
    if (b.hp <= 0) {
      b.destroyTimer = 0.2;
      b.rubbleTimer = C.RUBBLE_DURATION + 0.2; // 崩壊アニメ後も瓦礫として残る
      return true; // 破壊
    }
    return false;
  }

  /** 横ビュー: 影→ファサード→種類別ディテール */
  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const b of this.buildings) {
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
          // 各階バルコニー帯
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
          // ロビーガラス
          writeInst(buf, n++, cx, bot + 7, bW * 0.48, 13, 0.60, 0.80, 0.92, 0.82);
          // 基礎帯
          writeInst(buf, n++, cx, bot + 1.5, bW, 3, cr * 0.68, cg * 0.68, cb * 0.68, 1);
          break;
        }
        case 'tower': {
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
          // 上部バンド
          writeInst(buf, n++, cx, top - 3, bW, 5, cr * 0.82, cg * 0.78, cb * 0.55, 1);
          // 玄関ガラス
          writeInst(buf, n++, cx, bot + 6, bW * 0.24, bH * 0.25, 0.62, 0.82, 0.94, 0.82);
          break;
        }
        case 'hospital': {
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

export type FurnitureType = 'tree' | 'vending' | 'bench' | 'car' | 'traffic_light' | 'mailbox' | 'bicycle' | 'flower_bed' | 'parasol' | 'sign_board' | 'garbage' | 'power_pole' | 'hydrant' | 'fountain';

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
}

// AABB half-sizes for each furniture type
const FURNITURE_HW: Record<FurnitureType, number> = {
  tree:          C.TREE_W / 2,
  vending:       C.VENDING_W / 2,
  bench:         C.BENCH_W / 2,
  car:           C.CAR_W / 2,
  traffic_light: C.TRAFFIC_LIGHT_W / 2,
  mailbox:       C.MAILBOX_W / 2,
  bicycle:       5,
  flower_bed:    6,
  parasol:       5,
  sign_board:    3,
  garbage:       3,
  power_pole:    1.5,
  hydrant:       2,
  fountain:      8,
};
const FURNITURE_HH: Record<FurnitureType, number> = {
  tree:          C.TREE_H / 2,
  vending:       C.VENDING_H / 2,
  bench:         C.BENCH_H / 2,
  car:           C.CAR_H / 2,
  traffic_light: C.TRAFFIC_LIGHT_H / 2,
  mailbox:       C.MAILBOX_H / 2,
  bicycle:       3,
  flower_bed:    2.5,
  parasol:       5,
  sign_board:    6,
  garbage:       3,
  power_pole:    9,
  hydrant:       2.5,
  fountain:      5,
};

// Traffic light cycle durations per state (seconds)
const LIGHT_DURATIONS = [3.0, 0.8, 3.0]; // red, yellow, green

export class FurnitureManager {
  items: FurnitureItem[] = [];

  load(defs: Array<{ type: FurnitureType; x: number; y: number; hp?: number; score?: number }>) {
    this.items = [];
    for (const d of defs) {
      this.items.push({
        type: d.type,
        x: d.x,
        y: d.y,
        hp: d.hp ?? 1,
        active: true,
        score: d.score ?? 50,
        lightTimer: LIGHT_DURATIONS[0],
        lightState: 0,
      });
    }
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

  damage(item: FurnitureItem): boolean {
    item.hp--;
    if (item.hp <= 0) {
      item.active = false;
      return true;
    }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const item of this.items) {
      if (!item.active) continue;

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
      }
    }
    return n - startIdx;
  }

  /** Check if ball hits an active fountain (acts as bumper) */
  checkFountainBumper(bx: number, by: number, br: number): FurnitureItem | null {
    for (const item of this.items) {
      if (!item.active || item.type !== 'fountain' || item.hp <= 0) continue;
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

export interface VehicleItem {
  type: 'car' | 'bus' | 'truck' | 'ambulance';
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
  type: 'car' | 'bus' | 'truck' | 'ambulance';
  lane: 'hilltop' | 'main' | 'lower' | 'riverside';
  direction: 1 | -1;
  speed: number;
  interval: number;
}

const VEHICLE_DEFS_DATA: Record<string, { w: number; h: number; maxHp: number; score: number; speedMin: number; speedMax: number }> = {
  car:       { w: 20, h: 10, maxHp: 1, score: 120, speedMin: 50, speedMax: 70  },
  bus:       { w: 28, h: 12, maxHp: 2, score: 200, speedMin: 35, speedMax: 50  },
  truck:     { w: 24, h: 12, maxHp: 2, score: 180, speedMin: 30, speedMax: 45  },
  ambulance: { w: 22, h: 10, maxHp: 1, score: 500, speedMin: 100, speedMax: 120 },
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

  load(defs: VehicleDef[]) {
    this.defs = defs;
    this.spawnTimers = defs.map(d => d.interval * Math.random());
    this.vehicles = [];
  }

  update(dt: number) {
    // Update spawn timers
    for (let i = 0; i < this.defs.length; i++) {
      this.spawnTimers[i] -= dt;
      if (this.spawnTimers[i] <= 0) {
        this.spawnTimers[i] = this.defs[i].interval;
        this.spawnVehicle(this.defs[i]);
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
      // Despawn when off-screen
      const margin = 40;
      if (v.x > 180 + margin || v.x < -180 - margin) v.active = false;
    }
    // Remove inactive
    this.vehicles = this.vehicles.filter(v => v.active);
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

  damage(v: VehicleItem): boolean {
    v.hp--;
    v.flashTimer = 0.1;
    if (v.hp <= 0) { v.active = false; return true; }
    return false;
  }

  fillInstances(buf: Float32Array, startIdx: number): number {
    let n = startIdx;
    for (const v of this.vehicles) {
      if (!v.active) continue;
      const isFlash = v.flashTimer > 0;
      let cr: number, cg: number, cb: number;

      if (v.type === 'ambulance') {
        cr = 0.98; cg = 0.98; cb = 0.98;
      } else if (v.type === 'bus') {
        cr = 0.95; cg = 0.80; cb = 0.10;
      } else if (v.type === 'truck') {
        cr = 0.50; cg = 0.55; cb = 0.60;
      } else {
        // car: deterministic color from spawn position
        const ci = Math.abs(Math.floor(v.y * 31 + Math.floor(v.speed * 0.1))) % CAR_COLORS.length;
        [cr, cg, cb] = CAR_COLORS[ci];
      }

      if (isFlash) { cr = cg = cb = 1; }

      // 俯瞰: 影
      writeInst(buf, n++, v.x + 2, v.y - 2, v.w, v.h, 0, 0, 0, 0.22);
      // 車体
      writeInst(buf, n++, v.x, v.y, v.w, v.h, cr, cg, cb, 1);

      if (v.type === 'truck') {
        // トラック: キャブ（前方1/3）+ 荷台（後方2/3）
        const dir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + dir * v.w * 0.28, v.y, v.w * 0.45, v.h * 0.85,
          cr - 0.08, cg - 0.08, cb - 0.08, 1);
        writeInst(buf, n++, v.x + dir * v.w * 0.28, v.y, v.w * 0.30, v.h * 0.5,
          0.65, 0.85, 0.95, 0.7);
      } else if (v.type === 'bus') {
        // バス: 窓列ストライプ
        writeInst(buf, n++, v.x, v.y, v.w * 0.80, v.h * 0.45, 0.65, 0.85, 0.95, 0.7);
        writeInst(buf, n++, v.x, v.y, v.w * 0.78, 1.5, Math.max(0, cr-0.15), 0.55, 0.08, 0.9);
      } else if (v.type === 'ambulance' && !isFlash) {
        // 救急車: 窓 + 赤十字
        writeInst(buf, n++, v.x, v.y, v.w * 0.60, v.h * 0.50, 0.65, 0.85, 0.95, 0.7);
        writeInst(buf, n++, v.x, v.y, 2.5, v.h * 0.65, 0.90, 0.10, 0.10, 1);
        writeInst(buf, n++, v.x, v.y, v.w * 0.50, 2.5, 0.90, 0.10, 0.10, 1);
      } else {
        // 乗用車: フロントガラス + リアガラス
        const dir = v.speed >= 0 ? 1 : -1;
        writeInst(buf, n++, v.x + dir * v.w * 0.20, v.y, v.w * 0.35, v.h * 0.55,
          0.65, 0.85, 0.95, 0.75);
      }
    }
    return n - startIdx;
  }
}
