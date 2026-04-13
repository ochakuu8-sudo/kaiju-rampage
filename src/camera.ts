/**
 * camera.ts — カメラ管理（上方向スクロール）
 */
import * as C from './constants';

export class Camera {
  y = 0;
  private _speedBonus = 0;

  get scrollSpeed(): number {
    return C.SCROLL_BASE_SPEED + this._speedBonus;
  }

  update(dt: number) {
    this.y += this.scrollSpeed * dt;
    // 速度に比例した自然減衰
    this._speedBonus = Math.max(0, this._speedBonus * (1 - C.SPEED_DECAY_RATE * dt * 60));
  }

  addSpeedBonus() {
    this._speedBonus += C.HUMAN_SPEED_BONUS;
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
    this._speedBonus = 0;
  }
}
