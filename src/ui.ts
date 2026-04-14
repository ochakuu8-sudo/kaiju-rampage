/**
 * ui.ts — DOM UI 更新（スクロール速度 + 距離表示モード）
 */

const ZONE_NAMES: Record<number, string> = {
  0: '住宅街',
  1: '商業区',
  2: 'オフィス街',
};

export class UIManager {
  private elDistance  = document.getElementById('distance-display')!;
  private elZone      = document.getElementById('zone-display')!;
  private elPowerFill = document.getElementById('life-fill')!;
  private elTimer     = document.getElementById('timer-display')!;
  private elQuota     = document.getElementById('quota-display')!;
  private elGameover  = document.getElementById('gameover')!;
  private elFinalDist = document.getElementById('final-wave')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elFinalStats= document.getElementById('final-stats')!;

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  setPowerGauge(bonus: number, maxBonus: number) {
    const pct = maxBonus > 0 ? Math.min(100, (bonus / maxBonus) * 100) : 0;
    this.elPowerFill.style.width = `${pct}%`;
    this.elPowerFill.classList.toggle('low', pct <= 25);
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
