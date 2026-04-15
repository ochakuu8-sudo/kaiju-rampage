/**
 * ui.ts — DOM UI 更新（レースゲーム風スピードメーター + 距離表示）
 */

const ZONE_NAMES: Record<number, string> = {
  0: '住宅街',
  1: '商業区',
  2: 'オフィス街',
};

export class UIManager {
  private elDistance    = document.getElementById('distance-display')!;
  private elZone        = document.getElementById('zone-display')!;
  private elSpeedFill   = document.getElementById('life-fill')!;
  private elSpeedNumber = document.getElementById('speed-number')!;
  private elTimer       = document.getElementById('timer-display')!;
  private elQuota       = document.getElementById('quota-display')!;
  private elGameover    = document.getElementById('gameover')!;
  private elFinalDist   = document.getElementById('final-wave')!;
  private elFinalBest   = document.getElementById('final-best')!;
  private elFinalStats  = document.getElementById('final-stats')!;

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  /** レースゲーム風スピードメーター: 現在速度と上限から bar% と数値を更新 */
  setSpeedMeter(speed: number, maxSpeed: number) {
    const pct = maxSpeed > 0 ? Math.min(100, (speed / maxSpeed) * 100) : 0;
    this.elSpeedFill.style.width = `${pct}%`;
    this.elSpeedFill.classList.toggle('low',  pct <= 15);
    this.elSpeedFill.classList.toggle('high', pct >= 80);
    this.elSpeedNumber.textContent = String(Math.round(speed));
  }

  setTimer(seconds: number) {
    const s = Math.max(0, Math.ceil(seconds));
    this.elTimer.textContent = String(s);
    this.elTimer.classList.toggle('low',  s <= 10 && s > 5);
    this.elTimer.classList.toggle('crit', s <= 5);
  }

  setQuota(currentM: number, nextM: number) {
    const remain = Math.max(0, nextM - currentM);
    this.elQuota.textContent = `Next: ${remain} m`;
  }

  showGameOver(distanceM: number, destroys: number, humans: number) {
    this.elFinalDist.textContent  = `${distanceM.toLocaleString()} m`;
    this.elFinalBest.textContent  = `Destroys: ${destroys}`;
    this.elFinalStats.textContent = `Humans: ${humans.toLocaleString()}`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
