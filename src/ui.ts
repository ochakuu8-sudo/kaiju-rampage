import * as C from './constants';

export class UIManager {
  score: number = 0;
  combo: number = 0;
  comboTimer: number = 0;
  comboPopupScale: number = 1;
  comboPopupTimer: number = 0;
  ballsRemaining: number = 3;

  addScore(points: number) {
    this.score += points;
  }

  incrementCombo() {
    this.combo = Math.min(this.combo + 1, C.MAX_COMBO);
    this.comboTimer = C.COMBO_TIMEOUT;
    this.comboPopupTimer = 0.5;
    this.comboPopupScale = 1;
  }

  resetCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt: number) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    if (this.comboPopupTimer > 0) {
      this.comboPopupTimer -= dt;
      const progress = 1 - this.comboPopupTimer / 0.5;
      // Scale up then shrink
      this.comboPopupScale = 1 + progress * 0.3 - progress * progress * 0.4;
    }
  }

  getComboMultiplier(): number {
    return C.COMBO_SCORE_MULTIPLIER(this.combo);
  }

  lostBall() {
    this.ballsRemaining = Math.max(0, this.ballsRemaining - 1);
  }

  resetBalls() {
    this.ballsRemaining = 3;
  }

  isGameOver(): boolean {
    return this.ballsRemaining === 0;
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Score (top-left)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`Score: ${this.score}`, 10, 30);

    // Balls remaining (top-right)
    ctx.textAlign = 'right';
    ctx.fillText(`Balls: ${this.ballsRemaining}`, width - 10, 30);
    ctx.textAlign = 'left';

    // Combo display (center)
    if (this.combo > 0) {
      const scale = this.comboPopupScale;
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);

      ctx.fillStyle = this.combo >= 5 ? '#ff6600' : '#ffff00';
      ctx.font = `bold ${60 + this.combo * 5}px Arial`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(`×${this.combo}!`, 0, 0);
      ctx.fillText(`×${this.combo}!`, 0, 0);

      ctx.restore();
    }
  }
}
