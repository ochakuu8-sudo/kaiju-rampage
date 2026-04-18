/**
 * camera.ts — カメラ管理（一定速で上方向スクロール）
 */
import * as C from './constants';

export class Camera {
  y = 0;
  scrollSpeed = C.SCROLL_BASE_SPEED;
  /** 指定 Y でスクロールを停止 (null = 制限なし、number = y がこの値を超えない) */
  lockY: number | null = null;

  addScrollSpeed(delta: number) {
    // 指数ゲイン: 速度が高いほど同じ人数で得られる加速が小さい
    const ratio = this.scrollSpeed / C.SCROLL_MAX;
    const effectiveGain = delta * Math.exp(-ratio * C.SCROLL_GAIN_DECAY);
    this.scrollSpeed += effectiveGain;
  }

  update(dt: number) {
    // 線形減衰: 毎秒一定量ずつ減速
    this.scrollSpeed -= C.SCROLL_LINEAR_DRAIN * dt;
    // 最低速度: 0 以下にはならない
    if (this.scrollSpeed < 0) this.scrollSpeed = 0;
    // 最高速度上限
    if (this.scrollSpeed > C.SCROLL_MAX) this.scrollSpeed = C.SCROLL_MAX;
    this.y += this.scrollSpeed * dt;
    // ロック Y に到達したらスクロール停止
    if (this.lockY !== null && this.y >= this.lockY) {
      this.y = this.lockY;
      this.scrollSpeed = 0;
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
    this.scrollSpeed = C.SCROLL_BASE_SPEED;
    this.lockY = null;
  }
}
