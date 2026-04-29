/**
 * camera.ts — カメラ管理 (燃料ゲージ量に連動した可変速スクロール)
 */
import * as C from './constants';

// constants.ts の SCROLL_SPEED_* は一時的にデバッグ用 10x の値になっているため、
// 実際のカメラ移動だけ 0.1 倍に戻す。
const SCROLL_SPEED_SCALE = 0.1;

export class Camera {
  y = 0;
  /** 現在のスクロール速度 (px/s)。ゲーム側で燃料に応じて毎フレーム更新 */
  scrollSpeed = C.SCROLL_SPEED_MAX;
  /** 指定 Y でスクロールを停止 (null = 制限なし、number = y がこの値を超えない) */
  lockY: number | null = null;

  update(dt: number) {
    this.y += this.scrollSpeed * SCROLL_SPEED_SCALE * dt;
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
    this.scrollSpeed = C.SCROLL_SPEED_MAX;
    this.lockY = null;
  }
}
