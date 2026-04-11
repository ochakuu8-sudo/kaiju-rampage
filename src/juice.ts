/**
 * juice.ts — 画面シェイク・ヒットストップ・スローモーション・フラッシュ
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

  // ===== ヒットストップ =====
  private hitStopFrames = 0;

  // ===== スローモーション =====
  private slowTimer = 0;
  private slowScale = 1.0;

  // ===== フラッシュ =====
  flashAlpha = 0;
  flashR = 1; flashG = 1; flashB = 1;

  // ===== ボールフラッシュ =====
  ballFlashTimer = 0;

  // ===== コンボ表示 =====
  comboDisplay = 0;     // 表示するコンボ数
  comboDisplayTimer = 0;
  comboDisplayScale = 1;

  // ===== ステージクリアスロー =====
  private stageClearTimer = 0;

  shake(amp: number, dur: number, rotAmp = 0.5) {
    if (amp > this.shakeAmp) {
      this.shakeAmp    = amp;
      this.shakeDur    = dur;
      this.shakeTime   = dur;
      this.shakeRotAmp = rotAmp;
    }
  }

  hitStop(frames: number) {
    if (frames > this.hitStopFrames) this.hitStopFrames = frames;
  }

  slowMo(duration: number, scale = 0.3) {
    this.slowTimer = duration;
    this.slowScale = scale;
  }

  stageClearSlow() {
    this.stageClearTimer = 1.0;
    this.slowScale = 0.2;
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

  /** ヒットストップ中は dt=0 を返す。スローは dt*scale を返す。 */
  getGameDt(rawDt: number): number {
    if (this.hitStopFrames > 0) return 0;
    let dt = rawDt;
    if (this.slowTimer > 0) dt *= this.slowScale;
    if (this.stageClearTimer > 0) dt *= this.slowScale;
    return dt;
  }

  update(rawDt: number) {
    // ヒットストップ（フレームカウント）
    if (this.hitStopFrames > 0) {
      this.hitStopFrames--;
      // シェイク・フラッシュは進める
    }

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

    // スローモーション
    if (this.slowTimer > 0) {
      this.slowTimer -= rawDt;
      if (this.slowTimer <= 0) this.slowScale = 1.0;
    }
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= rawDt;
      if (this.stageClearTimer <= 0) this.slowScale = 1.0;
    }

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
