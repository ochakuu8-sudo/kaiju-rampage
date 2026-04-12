/**
 * ui.ts — DOM UI 更新（ウェーブシステム対応）
 */

export class UIManager {
  private elScore     = document.getElementById('score')!;
  private elHi        = document.getElementById('hi')!;
  private elWaveNum   = document.getElementById('wave-num')!;
  private elTimer     = document.getElementById('timer')!;
  private elQuotaFill = document.getElementById('quota-fill')!;
  private elQuotaText = document.getElementById('quota-text')!;
  private elGameover  = document.getElementById('gameover')!;
  private elFinalWave = document.getElementById('final-wave')!;
  private elFinalScore= document.getElementById('final-score')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elFinalStats= document.getElementById('final-stats')!;
  private elWaveClear = document.getElementById('waveclear')!;
  private elWaveClearSub = document.getElementById('waveclear-sub')!;

  private _hi = 0;

  constructor() {
    this._hi = parseInt(localStorage.getItem('kaiju_hi') || '0', 10);
    this.elHi.textContent = `BEST: ${this._hi.toLocaleString()}`;
  }

  setTotalScore(v: number) {
    this.elScore.textContent = `SCORE: ${v.toLocaleString()}`;
    if (v > this._hi) {
      this._hi = v;
      this.elHi.textContent = `BEST: ${this._hi.toLocaleString()}`;
    }
  }

  setWaveNum(wave: number) {
    this.elWaveNum.textContent = `WAVE ${wave}`;
  }

  setWaveTimer(t: number) {
    const secs = Math.ceil(t);
    this.elTimer.textContent = String(secs);
    if (secs <= 10) {
      this.elTimer.classList.add('danger');
    } else {
      this.elTimer.classList.remove('danger');
    }
  }

  setWaveScore(current: number, quota: number) {
    const pct = quota > 0 ? Math.min(100, (current / quota) * 100) : 0;
    this.elQuotaFill.style.width = `${pct}%`;
    const done = current >= quota;
    this.elQuotaFill.classList.toggle('done', done);
    this.elQuotaText.textContent = `${current.toLocaleString()} / ${quota.toLocaleString()}`;
  }

  showWaveClear(wave: number) {
    this.elWaveClearSub.textContent = `WAVE ${wave} COMPLETE!`;
    this.elWaveClear.classList.add('show');
  }

  hideWaveClear() {
    this.elWaveClear.classList.remove('show');
  }

  showGameOver(wave: number, score: number, destroys: number, humans: number) {
    this.elFinalWave.textContent  = `WAVE ${wave}`;
    this.elFinalScore.textContent = `Score: ${score.toLocaleString()}`;
    this.elFinalBest.textContent  = `Best: ${this._hi.toLocaleString()}`;
    this.elFinalStats.textContent = `Destroys: ${destroys} | Humans: ${humans}`;
    this.elGameover.classList.add('show');
    localStorage.setItem('kaiju_hi', String(this._hi));
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
