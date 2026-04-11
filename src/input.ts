export class InputManager {
  leftPressed = false;
  rightPressed = false;

  constructor() {
    this.setupTouchListeners();
  }

  private setupTouchListeners() {
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const x = touch.clientX;
      const viewportWidth = window.innerWidth;

      if (x < viewportWidth / 2) {
        this.leftPressed = true;
      } else {
        this.rightPressed = true;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 0) {
      this.leftPressed = false;
      this.rightPressed = false;
    } else {
      // Update based on remaining touches
      let hasLeft = false;
      let hasRight = false;
      const viewportWidth = window.innerWidth;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.clientX < viewportWidth / 2) {
          hasLeft = true;
        } else {
          hasRight = true;
        }
      }

      this.leftPressed = hasLeft;
      this.rightPressed = hasRight;
    }
  }
}
