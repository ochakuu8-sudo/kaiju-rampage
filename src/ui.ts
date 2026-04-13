/**
 * ui.ts — DOM UI 更新（自動スクロールモード）
 */

const ZONE_NAMES: Record<number, string> = {
  0: '住宅街',
  1: '商業区',
  2: 'オフィス街',
};

export class UIManager {
  private elDistance  = document.getElementById('distance-display')!;
  private elZone      = document.getElementById('zone-display')!;
  private elTimer     = document.getElementById('timer')!;
  private elLifeFill  = document.getElementById('life-fill')!;
  private elGameover  = document.getElementById('gameover')!;
  private elFinalDist = document.getElementById('final-wave')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elFinalStats= document.getElementById('final-stats')!;
  private _bestDist   = 0;

  constructor() {
    this._bestDist = parseInt(localStorage.getItem('kaiju_best_dist') || '0', 10);
  }

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  setTimer(t: number) {
    const secs = Math.ceil(t);
    this.elTimer.textContent = String(secs);
    this.elTimer.classList.toggle('danger', secs <= 10);
  }

  setLifeGauge(current: number, max: number) {
    const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    this.elLifeFill.style.width = `${pct}%`;
    this.elLifeFill.classList.toggle('low', pct <= 30);
  }

  showGameOver(distanceMeters: number, destroys: number, humans: number) {
    if (distanceMeters > this._bestDist) {
      this._bestDist = distanceMeters;
      localStorage.setItem('kaiju_best_dist', String(distanceMeters));
    }
    this.elFinalDist.textContent  = `${distanceMeters.toLocaleString()} m`;
    this.elFinalBest.textContent  = `Best: ${this._bestDist.toLocaleString()} m`;
    this.elFinalStats.textContent = `Destroys: ${destroys} | Humans: ${humans.toLocaleString()}`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
