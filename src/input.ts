/**
 * input.ts — タッチ & キーボード入力
 */

export class InputManager {
  leftPressed  = false;
  rightPressed = false;
  private _onRestart: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // タッチ
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    canvas.addEventListener('touchmove',  (e) => e.preventDefault(),     { passive: false });

    // キーボード（デバッグ用）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyZ') this.leftPressed  = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyX') this.rightPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyZ') this.leftPressed  = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyX') this.rightPressed = false;
    });
  }

  private _onTouchStart(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.leftPressed  = true;
      this.rightPressed = true;
    }
  }

  private _onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 0) {
      this.leftPressed  = false;
      this.rightPressed = false;
    }
  }

  onRestart(cb: () => void) {
    this._onRestart = cb;
  }

  registerRestartTap(el: HTMLElement) {
    el.addEventListener('click',     () => this._onRestart?.());
    el.addEventListener('touchstart', (e) => { e.preventDefault(); this._onRestart?.(); }, { passive: false });
  }
}
