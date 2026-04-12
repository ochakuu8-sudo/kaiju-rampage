/**
 * ui.ts — DOM UI 更新（サバイバルモード）
 */

export class UIManager {
  private elWaveNum   = document.getElementById('wave-num')!;
  private elTimer     = document.getElementById('timer')!;
  private elLifeFill  = document.getElementById('life-fill')!;
  private elGameover  = document.getElementById('gameover')!;
  private elFinalWave = document.getElementById('final-wave')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elFinalStats= document.getElementById('final-stats')!;
  private _bestHumans = 0;

  constructor() {
    this._bestHumans = parseInt(localStorage.getItem('kaiju_best_humans') || '0', 10);
  }

  setWaveNum(wave: number) {
    this.elWaveNum.textContent = `WAVE ${wave}`;
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

  showGameOver(wave: number, destroys: number, humans: number) {
    if (humans > this._bestHumans) {
      this._bestHumans = humans;
      localStorage.setItem('kaiju_best_humans', String(humans));
    }
    this.elFinalWave.textContent  = `WAVE ${wave}`;
    this.elFinalBest.textContent  = `Best: ${this._bestHumans.toLocaleString()} humans`;
    this.elFinalStats.textContent = `Destroys: ${destroys} | Humans: ${humans.toLocaleString()}`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
