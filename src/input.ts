/**
 * input.ts — タッチ & マウス & キーボード入力（左右別 + 両同時補助）
 */

export class InputManager {
  leftPressed  = false;
  rightPressed = false;
  private leftKeys  = new Set<string>();
  private rightKeys = new Set<string>();
  private bothKeys  = new Set<string>();
  private pointerLeft = false;
  private pointerRight = false;
  private _onRestart: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // タッチ（モバイル）: 左右半分で別フリッパー、2本指/中央は両同時
    canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchEnd.bind(this),  { passive: false });
    canvas.addEventListener('touchmove',  this._onTouchStart.bind(this), { passive: false });

    // マウス（PC）: 左半分/右半分で別フリッパー、中央は両同時
    canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mouseup',   this._onMouseUp.bind(this));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // キーボード（PC）: 左右別を基本にし、Space は初心者救済の両同時。
    // preventDefault することで iframe 親ページのスクロールや focus 移動を抑止。
    window.addEventListener('keydown', (e) => {
      if (this._isSkipKey(e)) return;
      if (this._setKey(e.key, true)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (this._isSkipKey(e)) return;
      if (this._setKey(e.key, false)) e.preventDefault();
    });
  }

  /** browser ナビゲーション・ショートカット・修飾キー操作は温存する */
  private _isSkipKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    if (e.key === 'Tab' || e.key === 'Escape') return true;
    if (/^F\d{1,2}$/.test(e.key)) return true;           // F1-F12
    return false;
  }

  private _setKey(key: string, pressed: boolean): boolean {
    const normalized = key.length === 1 ? key.toLowerCase() : key;
    let handled = true;
    if (normalized === 'ArrowLeft' || normalized === 'a') {
      this._setIn(this.leftKeys, normalized, pressed);
    } else if (normalized === 'ArrowRight' || normalized === 'd') {
      this._setIn(this.rightKeys, normalized, pressed);
    } else if (normalized === ' ') {
      this._setIn(this.bothKeys, normalized, pressed);
    } else {
      handled = false;
    }
    if (handled) this._syncPressed();
    return handled;
  }

  private _setIn(set: Set<string>, key: string, pressed: boolean) {
    if (pressed) set.add(key);
    else set.delete(key);
  }

  private _syncPressed() {
    const both = this.bothKeys.size > 0;
    this.leftPressed  = both || this.leftKeys.size  > 0 || this.pointerLeft;
    this.rightPressed = both || this.rightKeys.size > 0 || this.pointerRight;
  }

  private _onTouchStart(e: TouchEvent) {
    e.preventDefault();
    this.pointerLeft = false;
    this.pointerRight = false;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    for (const touch of Array.from(e.touches)) {
      this._applyPointerX(touch.clientX - rect.left, rect.width);
    }
    this._syncPressed();
  }

  private _onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    this.pointerLeft = false;
    this.pointerRight = false;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    for (const touch of Array.from(e.touches)) {
      this._applyPointerX(touch.clientX - rect.left, rect.width);
    }
    this._syncPressed();
  }

  private _onMouseDown(e: MouseEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    this.pointerLeft = false;
    this.pointerRight = false;
    this._applyPointerX(e.clientX - rect.left, rect.width);
    this._syncPressed();
  }

  private _onMouseUp(_e: MouseEvent) {
    this.pointerLeft = false;
    this.pointerRight = false;
    this._syncPressed();
  }

  private _applyPointerX(x: number, width: number) {
    const centerBand = width * 0.16;
    const center = width / 2;
    if (Math.abs(x - center) <= centerBand / 2) {
      this.pointerLeft = true;
      this.pointerRight = true;
    } else if (x < center) {
      this.pointerLeft = true;
    } else {
      this.pointerRight = true;
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
