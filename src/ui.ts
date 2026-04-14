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

  showGameOver(destroys: number, humans: number, scrollSpeed: number) {
    this.elFinalDist.textContent  = `Destroys: ${destroys}`;
    this.elFinalBest.textContent  = `Humans: ${humans.toLocaleString()}`;
    this.elFinalStats.textContent = `Speed: ${Math.round(scrollSpeed)} px/s`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
