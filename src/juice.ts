/**
 * juice.ts — 画面シェイク・フラッシュ
 */

export class JuiceManager {
  // ===== 画面シェイク =====
  private shakeAmp  = 0;
  private shakeDur  = 0;
  private shakeTime = 0;
  private shakeRotAmp = 0;
  shakeOffsetX = 0;
  shakeOffsetY = 0;
  shakeRotation = 0;

  // ===== フラッシュ =====
  flashAlpha = 0;
  flashR = 1; flashG = 1; flashB = 1;

  // ===== ボールフラッシュ =====
  ballFlashTimer = 0;

  // ===== ヒットストップ =====
  private hitstopFrames = 0;

  // ===== コンボ表示 =====
  comboDisplay = 0;
  comboDisplayTimer = 0;
  comboDisplayScale = 1;

  shake(amp: number, dur: number, rotAmp = 0.5) {
    if (amp > this.shakeAmp) {
      this.shakeAmp    = amp;
      this.shakeDur    = dur;
      this.shakeTime   = dur;
      this.shakeRotAmp = rotAmp;
    }
  }

  flash(r: number, g: number, b: number, alpha: number) {
    if (alpha > this.flashAlpha) {
      this.flashAlpha = alpha;
      this.flashR = r; this.flashG = g; this.flashB = b;
    }
  }

  ballHitFlash() {
    this.ballFlashTimer = 0.05;
  }

  showCombo(combo: number) {
    this.comboDisplay      = combo;
    this.comboDisplayTimer = 0.5;
    this.comboDisplayScale = 1.0 + combo * 0.05;
  }

  hitstop(frames: number) {
    if (frames > this.hitstopFrames) this.hitstopFrames = frames;
  }

  getGameDt(rawDt: number): number {
    if (this.hitstopFrames > 0) {
      this.hitstopFrames--;
      return 0;
    }
    return rawDt;
  }

  update(rawDt: number) {
    // シェイク
    if (this.shakeTime > 0) {
      this.shakeTime -= rawDt;
      const t = Math.max(0, this.shakeTime / this.shakeDur);
      const amp = this.shakeAmp * t;
      this.shakeOffsetX = (Math.random() * 2 - 1) * amp;
      this.shakeOffsetY = (Math.random() * 2 - 1) * amp;
      this.shakeRotation = (Math.random() * 2 - 1) * this.shakeRotAmp * t * Math.PI / 180;
      if (this.shakeTime <= 0) {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeRotation = 0;
        this.shakeAmp = 0;
      }
    }

    // フラッシュ減衰
    if (this.flashAlpha > 0) {
      this.flashAlpha -= rawDt * 5;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }

    // ボールフラッシュ
    if (this.ballFlashTimer > 0) this.ballFlashTimer -= rawDt;

    // コンボ表示フェードアウト
    if (this.comboDisplayTimer > 0) {
      this.comboDisplayTimer -= rawDt;
      this.comboDisplayScale = Math.max(0.5, this.comboDisplayScale - rawDt * 3);
    }
  }

  getShake(): [number, number] {
    return [this.shakeOffsetX, this.shakeOffsetY];
  }

  isBallFlashing(): boolean {
    return this.ballFlashTimer > 0;
  }

  isComboVisible(): boolean {
    return this.comboDisplayTimer > 0 && this.comboDisplay >= 2;
  }
}
