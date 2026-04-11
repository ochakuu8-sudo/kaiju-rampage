// ========== Collision Detection Utilities ==========

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

// Circle vs AABB collision
export function circleAABBCollision(circle: Circle, rect: Rect): boolean {
  const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
  const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;

  return dx * dx + dy * dy < circle.radius * circle.radius;
}

// Circle vs Circle collision
export function circleCollision(c1: Circle, c2: Circle): boolean {
  const dx = c1.x - c2.x;
  const dy = c1.y - c2.y;
  const minDist = c1.radius + c2.radius;
  return dx * dx + dy * dy < minDist * minDist;
}

// Get collision normal from circle to AABB (normalized direction)
export function circleAABBNormal(circle: Circle, rect: Rect): [number, number] {
  const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
  const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 0.001) return [1, 0]; // Default
  return [dx / len, dy / len];
}

// Oriented Bounding Box (simplified OBB) for flipper
export interface OBB {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
}

export function circleOBBCollision(circle: Circle, obb: OBB): boolean {
  // Transform circle to OBB local space
  const cos = Math.cos(-obb.rotation);
  const sin = Math.sin(-obb.rotation);

  const dx = circle.x - obb.x;
  const dy = circle.y - obb.y;

  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // Check AABB collision in local space
  const rect: Rect = {
    x: 0,
    y: 0,
    width: obb.width,
    height: obb.height,
  };

  const closestX = Math.max(-obb.width / 2, Math.min(localX, obb.width / 2));
  const closestY = Math.max(-obb.height / 2, Math.min(localY, obb.height / 2));

  const cdx = localX - closestX;
  const cdy = localY - closestY;

  return cdx * cdx + cdy * cdy < circle.radius * circle.radius;
}

// Get collision normal from circle to OBB (in world space)
export function circleOBBNormal(circle: Circle, obb: OBB): [number, number] {
  // Transform circle to OBB local space
  const cos = Math.cos(-obb.rotation);
  const sin = Math.sin(-obb.rotation);

  const dx = circle.x - obb.x;
  const dy = circle.y - obb.y;

  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // Find closest point in local space
  const closestX = Math.max(-obb.width / 2, Math.min(localX, obb.width / 2));
  const closestY = Math.max(-obb.height / 2, Math.min(localY, obb.height / 2));

  // Collision vector in local space
  let normalLocalX = localX - closestX;
  let normalLocalY = localY - closestY;
  const len = Math.sqrt(normalLocalX * normalLocalX + normalLocalY * normalLocalY);

  if (len < 0.001) return [0, 1]; // Default to up

  normalLocalX /= len;
  normalLocalY /= len;

  // Transform back to world space
  const worldNormalX = normalLocalX * cos + normalLocalY * sin;
  const worldNormalY = -normalLocalX * sin + normalLocalY * cos;

  return [worldNormalX, worldNormalY];
}

// Wall collision - reflect velocity
export function reflectVelocity(vx: number, vy: number, normalX: number, normalY: number, damping: number = 1): [number, number] {
  const dot = vx * normalX + vy * normalY;
  return [
    (vx - 2 * dot * normalX) * damping,
    (vy - 2 * dot * normalY) * damping,
  ];
}

// Clamp point to screen bounds
export function clampToBounds(x: number, y: number, w: number, h: number): [number, number] {
  const minX = -180;
  const maxX = 180;
  const minY = -320;
  const maxY = 320;

  return [
    Math.max(minX + w / 2, Math.min(maxX - w / 2, x)),
    Math.max(minY + h / 2, Math.min(maxY - h / 2, y)),
  ];
}
