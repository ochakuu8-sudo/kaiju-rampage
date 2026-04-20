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

    // キーボード（PC）— 修飾キーなしの任意のキーで両フリッパー同時
    // 設計: 押し間違い防止・学習コスト削減のため、キー割り当てを意識せずに遊べる。
    // preventDefault することで iframe 親ページのスクロールや focus 移動を抑止。
    window.addEventListener('keydown', (e) => {
      if (this._isSkipKey(e)) return;
      this.leftPressed  = true;
      this.rightPressed = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      if (this._isSkipKey(e)) return;
      this.leftPressed  = false;
      this.rightPressed = false;
      e.preventDefault();
    });
  }

  /** browser ナビゲーション・ショートカット・修飾キー操作は温存する */
  private _isSkipKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    if (e.key === 'Tab' || e.key === 'Escape') return true;
    if (/^F\d{1,2}$/.test(e.key)) return true;           // F1-F12
    return false;
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
