/**
 * camera.ts — カメラ管理（一定速で上方向スクロール）
 */
import * as C from './constants';

export class Camera {
  y = 0;
  scrollSpeed = C.SCROLL_BASE_SPEED;

  addScrollSpeed(delta: number) {
    this.scrollSpeed += delta;
  }

  update(dt: number) {
    this.y += this.scrollSpeed * dt;
  }

  get distanceMeters(): number {
    return Math.floor(this.y / 10);
  }

  /** カメラ下端（ワールド座標） */
  get bottom(): number { return this.y + C.WORLD_MIN_Y; }
  /** カメラ上端（ワールド座標） */
  get top(): number    { return this.y + C.WORLD_MAX_Y; }

  reset() {
    this.y = 0;
    this.scrollSpeed = C.SCROLL_BASE_SPEED;
  }
}
