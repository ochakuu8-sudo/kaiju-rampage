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
    // 指数減衰 (空気抵抗モデル dv/dt = -DRAG * v): exp は任意 dt で安定
    this.scrollSpeed *= Math.exp(-C.SCROLL_DRAG * dt);
    // 最低速度: ごく小さくなったら完全停止 (演出上の静止)
    if (this.scrollSpeed < 0.5) this.scrollSpeed = 0;
    // 最高速度上限: カメラがボールより速くなる暴走防止
    if (this.scrollSpeed > C.SCROLL_MAX) this.scrollSpeed = C.SCROLL_MAX;
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
