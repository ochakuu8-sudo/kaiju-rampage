/**
 * physics.ts — 衝突判定ヘルパー
 */

// ===== 基本型 =====
export interface Vec2 { x: number; y: number; }

export interface Circle { x: number; y: number; r: number; }

export interface AABB {
  cx: number; cy: number; // 中心
  hw: number; hh: number; // half-width/height
}

// OBB (Oriented Bounding Box)
export interface OBB {
  cx: number; cy: number;
  hw: number; hh: number;
  angle: number; // radians
}

// ===== 円 vs AABB =====
export function circleAABB(
  bx: number, by: number, br: number,
  ax: number, ay: number, aw: number, ah: number // ax,ay = 左下
): boolean {
  const nearX = Math.max(ax, Math.min(bx, ax + aw));
  const nearY = Math.max(ay, Math.min(by, ay + ah));
  const dx = bx - nearX;
  const dy = by - nearY;
  return dx * dx + dy * dy < br * br;
}

/** 円 vs AABB の衝突解決。 反射後の [vx,vy] を返す */
export function resolveCircleAABB(
  bx: number, by: number, br: number,
  vx: number, vy: number,
  ax: number, ay: number, aw: number, ah: number,
  damping = 0.78
): [number, number, number, number] | null {
  const nearX = Math.max(ax, Math.min(bx, ax + aw));
  const nearY = Math.max(ay, Math.min(by, ay + ah));
  const dx = bx - nearX;
  const dy = by - nearY;
  const dist2 = dx * dx + dy * dy;
  if (dist2 >= br * br) return null;
  const dist = Math.sqrt(dist2) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;
  // 押し返し
  const pen = br - dist;
  const newBx = bx + nx * pen;
  const newBy = by + ny * pen;
  // 反射 (反発係数の適用は呼び出し側で行う。ここは形状的な反射のみ)
  const dot = vx * nx + vy * ny;
  const newVx = (vx - 2 * dot * nx) * damping;
  const newVy = (vy - 2 * dot * ny) * damping;
  return [newBx, newBy, newVx, newVy];
}

// ===== 円 vs 円 =====
export function circleCircle(
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean {
  const dx = ax - bx, dy = ay - by;
  const rad = ar + br;
  return dx * dx + dy * dy < rad * rad;
}

/** バンパー衝突解決: ボールを押し返し、速度を強制付与 */
export function resolveBumper(
  bx: number, by: number, br: number,
  vx: number, vy: number,
  cx: number, cy: number, cr: number,
  force: number
): [number, number, number, number] {
  const dx = bx - cx, dy = by - cy;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
  const nx = dx / dist, ny = dy / dist;
  const overlap = br + cr - dist;
  const newBx = bx + nx * (overlap + 0.5);
  const newBy = by + ny * (overlap + 0.5);
  // 強制的に押し出し速度付与
  const newVx = nx * force;
  const newVy = ny * force;
  return [newBx, newBy, newVx, newVy];
}

// ===== 円 vs OBB (フリッパー用) =====
/** OBB ローカル座標へ変換 */
function worldToOBBLocal(px: number, py: number, obb: OBB): [number, number] {
  const dx = px - obb.cx, dy = py - obb.cy;
  const c = Math.cos(-obb.angle), s = Math.sin(-obb.angle);
  return [c * dx - s * dy, s * dx + c * dy];
}

export function circleOBBOverlap(
  bx: number, by: number, br: number,
  obb: OBB
): boolean {
  const [lx, ly] = worldToOBBLocal(bx, by, obb);
  const nearX = Math.max(-obb.hw, Math.min(lx, obb.hw));
  const nearY = Math.max(-obb.hh, Math.min(ly, obb.hh));
  const dx = lx - nearX, dy = ly - nearY;
  return dx * dx + dy * dy < br * br;
}

/** 円 vs OBB 衝突解決。法線はワールド座標で返す。
 * 接近中 (dot < 0) のみ反射、既に離れている場合は押し出しのみ
 * (擦り挙動=毎フレーム反射を防ぐ) */
export function resolveCircleOBB(
  bx: number, by: number, br: number,
  vx: number, vy: number,
  obb: OBB,
  damping = 0.78
): [number, number, number, number] | null {
  const [lx, ly] = worldToOBBLocal(bx, by, obb);
  const nearX = Math.max(-obb.hw, Math.min(lx, obb.hw));
  const nearY = Math.max(-obb.hh, Math.min(ly, obb.hh));
  const dlx = lx - nearX, dly = ly - nearY;
  const dist2 = dlx * dlx + dly * dly;
  if (dist2 >= br * br) return null;
  const dist = Math.sqrt(dist2) || 0.001;
  // ローカル法線 → ワールド法線
  const lnx = dlx / dist, lny = dly / dist;
  const c = Math.cos(obb.angle), s = Math.sin(obb.angle);
  const nx = c * lnx - s * lny;
  const ny = s * lnx + c * lny;
  // 押し返し
  const pen = br - dist;
  const newBx = bx + nx * (pen + 0.5);
  const newBy = by + ny * (pen + 0.5);
  // 反射: 接近中のみ (dot < 0 = 面に向かう向き)。離脱中は速度維持。
  const dot = vx * nx + vy * ny;
  let newVx = vx, newVy = vy;
  if (dot < 0) {
    newVx = (vx - 2 * dot * nx) * damping;
    newVy = (vy - 2 * dot * ny) * damping;
  }
  return [newBx, newBy, newVx, newVy];
}

/** 円 vs OBB 衝突を「滑走」として解決。
 * ボールは坂の面に沿って流れる: tangent (接線) 成分は保存、normal (法線) 成分のみ
 * 強めに減衰。tangentFriction で接線方向にも摩擦 (1.0 = 無摩擦、0.99 = 1% 減衰/接触)
 * 結果としてピンボールらしく滑らかに坂を下る。 */
export function resolveCircleOBBSlide(
  bx: number, by: number, br: number,
  vx: number, vy: number,
  obb: OBB,
  normalDamping = 0.15,
  tangentFriction = 1.0
): [number, number, number, number] | null {
  const [lx, ly] = worldToOBBLocal(bx, by, obb);
  const nearX = Math.max(-obb.hw, Math.min(lx, obb.hw));
  const nearY = Math.max(-obb.hh, Math.min(ly, obb.hh));
  const dlx = lx - nearX, dly = ly - nearY;
  const dist2 = dlx * dlx + dly * dly;
  if (dist2 >= br * br) return null;
  const dist = Math.sqrt(dist2) || 0.001;
  const lnx = dlx / dist, lny = dly / dist;
  const c = Math.cos(obb.angle), s = Math.sin(obb.angle);
  const nx = c * lnx - s * lny;
  const ny = s * lnx + c * lny;
  const pen = br - dist;
  const newBx = bx + nx * (pen + 0.5);
  const newBy = by + ny * (pen + 0.5);
  // 法線・接線に分解
  const vNormal = vx * nx + vy * ny;      // + = 離脱向き / - = 接近向き
  // 接線成分に摩擦を適用 (1.0 = 無摩擦)
  const vTx = (vx - vNormal * nx) * tangentFriction;
  const vTy = (vy - vNormal * ny) * tangentFriction;
  // 接近中なら小さく跳ね、離脱中なら法線成分ゼロに
  const newVNormal = vNormal < 0 ? -vNormal * normalDamping : 0;
  const newVx = vTx + newVNormal * nx;
  const newVy = vTy + newVNormal * ny;
  return [newBx, newBy, newVx, newVy];
}

/** 円 vs カプセル (丸端矩形) 衝突解決 — 両端が hh 半径で丸められた OBB。
 * フリッパーのように先端角の引っ掛かりを回避したい場合に使う。
 * 内部的には「中心軸セグメント (長さ 2*(hw-hh)) への最短点 + ボール/hh 合算半径」の円-円判定。 */
export function resolveCircleCapsule(
  bx: number, by: number, br: number,
  vx: number, vy: number,
  obb: OBB,
  normalDamping = 0.15,
  tangentFriction = 1.0
): [number, number, number, number] | null {
  const [lx, ly] = worldToOBBLocal(bx, by, obb);
  // 中心軸セグメントは local 座標の (-(hw-hh), 0) 〜 (+(hw-hh), 0)
  const segHalf = Math.max(0, obb.hw - obb.hh);
  const nearX = Math.max(-segHalf, Math.min(lx, segHalf));
  const nearY = 0;
  const dlx = lx - nearX, dly = ly - nearY;
  const dist2 = dlx * dlx + dly * dly;
  const combinedR = br + obb.hh;
  if (dist2 >= combinedR * combinedR) return null;
  const dist = Math.sqrt(dist2) || 0.001;
  const lnx = dlx / dist, lny = dly / dist;
  const c = Math.cos(obb.angle), s = Math.sin(obb.angle);
  const nx = c * lnx - s * lny;
  const ny = s * lnx + c * lny;
  const pen = combinedR - dist;
  const newBx = bx + nx * (pen + 0.5);
  const newBy = by + ny * (pen + 0.5);
  const vNormal = vx * nx + vy * ny;
  const vTx = (vx - vNormal * nx) * tangentFriction;
  const vTy = (vy - vNormal * ny) * tangentFriction;
  const newVNormal = vNormal < 0 ? -vNormal * normalDamping : 0;
  const newVx = vTx + newVNormal * nx;
  const newVy = vTy + newVNormal * ny;
  return [newBx, newBy, newVx, newVy];
}

/** 速度制限 */
export function clampSpeed(vx: number, vy: number, maxSpeed: number): [number, number] {
  const spd = Math.sqrt(vx * vx + vy * vy);
  if (spd > maxSpeed) {
    const k = maxSpeed / spd;
    return [vx * k, vy * k];
  }
  return [vx, vy];
}

/** ランダム float */
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** ランダム int (inclusive) */
export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
