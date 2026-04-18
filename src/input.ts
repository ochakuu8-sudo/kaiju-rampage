/**
 * input.ts — タッチ & マウス & キーボード入力（両フリッパー同時操作）
 */

export class InputManager {
  leftPressed  = false;
  rightPressed = false;
  private _onRestart: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // タッチ（モバイル）
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    canvas.addEventListener('touchmove',  (e) => e.preventDefault(),     { passive: false });

    // マウス（PC）— 任意のボタンで両フリッパー
    canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mouseup',   this._onMouseUp.bind(this));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // キーボード（PC）— 任意のキーで両フリッパー
    window.addEventListener('keydown', (e) => {
      if (
        e.code === 'Space' ||
        e.code === 'Enter' ||
        e.code === 'ArrowLeft'  || e.code === 'ArrowRight' ||
        e.code === 'ArrowUp'    || e.code === 'ArrowDown'  ||
        e.code === 'KeyZ'       || e.code === 'KeyX'
      ) {
        this.leftPressed  = true;
        this.rightPressed = true;
        if (e.code === 'Space') e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (
        e.code === 'Space' ||
        e.code === 'Enter' ||
        e.code === 'ArrowLeft'  || e.code === 'ArrowRight' ||
        e.code === 'ArrowUp'    || e.code === 'ArrowDown'  ||
        e.code === 'KeyZ'       || e.code === 'KeyX'
      ) {
        this.leftPressed  = false;
        this.rightPressed = false;
      }
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

  private _onMouseDown(e: MouseEvent) {
    e.preventDefault();
    this.leftPressed  = true;
    this.rightPressed = true;
  }

  private _onMouseUp(_e: MouseEvent) {
    this.leftPressed  = false;
    this.rightPressed = false;
  }

  onRestart(cb: () => void) {
    this._onRestart = cb;
  }

  registerRestartTap(el: HTMLElement) {
    el.addEventListener('click',     () => this._onRestart?.());
    el.addEventListener('touchstart', (e) => { e.preventDefault(); this._onRestart?.(); }, { passive: false });
  }
}
