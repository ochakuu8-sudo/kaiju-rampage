export class InputManager {
  leftPressed = false;
  rightPressed = false;

  constructor() {
    this.setupTouchListeners();
    this.setupKeyboardListeners();
  }

  private setupTouchListeners() {
    document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  private setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  private handleKeyDown(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    // Left flipper: Z or ArrowLeft
    if (key === 'z' || key === 'arrowleft') {
      this.leftPressed = true;
      e.preventDefault();
    }
    // Right flipper: / or ArrowRight
    if (key === '/' || key === 'arrowright') {
      this.rightPressed = true;
      e.preventDefault();
    }
    // Both flippers: Space
    if (key === ' ') {
      this.leftPressed = true;
      this.rightPressed = true;
      e.preventDefault();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    // Left flipper: Z or ArrowLeft
    if (key === 'z' || key === 'arrowleft') {
      this.leftPressed = false;
      e.preventDefault();
    }
    // Right flipper: / or ArrowRight
    if (key === '/' || key === 'arrowright') {
      this.rightPressed = false;
      e.preventDefault();
    }
    // Both flippers: Space
    if (key === ' ') {
      this.leftPressed = false;
      this.rightPressed = false;
      e.preventDefault();
    }
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
