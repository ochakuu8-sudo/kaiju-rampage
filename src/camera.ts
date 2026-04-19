/**
 * camera.ts — カメラ管理 (固定速で上方向スクロール)
 */
import * as C from './constants';

export class Camera {
  y = 0;
  /** 指定 Y でスクロールを停止 (null = 制限なし、number = y がこの値を超えない) */
  lockY: number | null = null;

  update(dt: number) {
    this.y += C.SCROLL_SPEED * dt;
    if (this.lockY !== null && this.y >= this.lockY) {
      this.y = this.lockY;
    }
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
    this.lockY = null;
  }
}
