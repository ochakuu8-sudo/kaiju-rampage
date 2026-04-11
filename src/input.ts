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
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mid  = rect.left + rect.width / 2;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.clientX < mid) this.leftPressed  = true;
      else                  this.rightPressed = true;
    }
  }

  private _onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    // 全タッチを確認してリリース
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mid  = rect.left + rect.width / 2;
    let hasLeft = false, hasRight = false;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.clientX < mid) hasLeft  = true;
      else                  hasRight = true;
    }
    this.leftPressed  = hasLeft;
    this.rightPressed = hasRight;
  }

  onRestart(cb: () => void) {
    this._onRestart = cb;
  }

  registerRestartTap(el: HTMLElement) {
    el.addEventListener('click',     () => this._onRestart?.());
    el.addEventListener('touchstart', (e) => { e.preventDefault(); this._onRestart?.(); }, { passive: false });
  }
}
