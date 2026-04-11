export interface ShakeConfig {
  amplitude: number;
  duration: number;
}

export class JuiceManager {
  // Screen shake
  shakeAmplitude: number = 0;
  shakeDuration: number = 0;
  shakeTimer: number = 0;
  shakeFreq: number = 25; // Hz

  // Hit stop (freeze frame)
  hitStopDuration: number = 0;
  hitStopTimer: number = 0;

  // Slow motion
  timeScale: number = 1.0;
  slowDuration: number = 0;
  slowTimer: number = 0;
  slowScale: number = 1.0;

  // Flash overlay
  flashAlpha: number = 0;
  flashDuration: number = 0;
  flashTimer: number = 0;

  update(dt: number) {
    // Update shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    } else {
      this.shakeAmplitude = 0;
    }

    // Update hit stop
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
    }

    // Update slow motion
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      const t = 1 - this.slowTimer / this.slowDuration;
      this.timeScale = 1 + (this.slowScale - 1) * (1 - Math.cos(t * Math.PI) / 2);
    } else {
      this.timeScale = 1.0;
    }

    // Update flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const t = 1 - this.flashTimer / this.flashDuration;
      this.flashAlpha = Math.max(0, 1 - t * t) * 0.3;
    } else {
      this.flashAlpha = 0;
    }
  }

  triggerShake(config: ShakeConfig) {
    this.shakeAmplitude = config.amplitude;
    this.shakeDuration = config.duration;
    this.shakeTimer = config.duration;
  }

  triggerHitStop(duration: number) {
    this.hitStopDuration = duration;
    this.hitStopTimer = duration;
  }

  triggerSlowMotion(duration: number, scale: number = 0.3) {
    this.slowDuration = duration;
    this.slowTimer = duration;
    this.slowScale = scale;
  }

  triggerFlash(duration: number = 0.1) {
    this.flashDuration = duration;
    this.flashTimer = duration;
  }

  getShakeOffset(): [number, number] {
    if (this.shakeAmplitude === 0) return [0, 0];

    const progress = 1 - this.shakeTimer / this.shakeDuration;
    const decay = Math.cos((progress * Math.PI) / 2); // ease-out
    const theta = this.shakeTimer * this.shakeFreq * Math.PI * 2;

    const amp = this.shakeAmplitude * decay;
    return [
      Math.cos(theta) * amp,
      Math.sin(theta) * amp,
    ];
  }

  getTimeScale(): number {
    if (this.hitStopTimer > 0) return 0; // Complete freeze during hitstop
    return this.timeScale;
  }

  getFlashAlpha(): number {
    return this.flashAlpha;
  }
}
