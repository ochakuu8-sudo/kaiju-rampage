/**
 * input.ts — タッチ & マウス & キーボード入力
 */

export class InputManager {
  leftPressed  = false;
  rightPressed = false;
  private _onRestart: (() => void) | null = null;
  private _canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;

    // タッチ（モバイル）
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    canvas.addEventListener('touchmove',  (e) => e.preventDefault(),     { passive: false });

    // マウス（PC）— 左半分=左フリッパー、右半分=右フリッパー、それ以外=両方
    canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mouseup',   this._onMouseUp.bind(this));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // キーボード（PC）— ←/Z=左、→/X=右、Space=両方
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyZ')   this.leftPressed  = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyX')   this.rightPressed = true;
      if (e.code === 'Space') {
        this.leftPressed  = true;
        this.rightPressed = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyZ')   this.leftPressed  = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyX')   this.rightPressed = false;
      if (e.code === 'Space') {
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
    // 左クリック=左フリッパー、右クリック=右フリッパー、中クリック=両方
    if (e.button === 0) {
      // 左クリックはキャンバスの左右位置で振り分け
      const rect = this._canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 2) {
        this.leftPressed = true;
      } else {
        this.rightPressed = true;
      }
    } else if (e.button === 2) {
      this.rightPressed = true;
    } else {
      this.leftPressed  = true;
      this.rightPressed = true;
    }
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
