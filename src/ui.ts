/**
 * ui.ts — DOM UI 更新（スコア + パワー表示モード）
 */

const ZONE_NAMES: Record<number, string> = {
  0: '住宅街',
  1: '商業区',
  2: 'オフィス街',
};

export class UIManager {
  private elDistance  = document.getElementById('distance-display')!;
  private elZone      = document.getElementById('zone-display')!;
  private elScore     = document.getElementById('timer')!;       // 旧 #timer をスコア表示として再利用
  private elPowerFill = document.getElementById('life-fill')!;   // 旧 #life-fill をパワーバーとして再利用
  private elGameover  = document.getElementById('gameover')!;
  private elFinalDist = document.getElementById('final-wave')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elFinalStats= document.getElementById('final-stats')!;
  private elOverlay   = document.getElementById('overlay')!;
  private _bestScore  = 0;

  constructor() {
    this._bestScore = parseInt(localStorage.getItem('kaiju_best_score') || '0', 10);
  }

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  setScore(score: number) {
    this.elScore.textContent = '¥' + score.toLocaleString();
    this.elScore.classList.remove('danger');
  }

  /** 建物破壊時に浮き上がるスコアポップアップを生成 */
  spawnScorePop(screenX: number, screenY: number, score: number) {
    const el = document.createElement('div');
    el.className = 'score-pop';
    el.textContent = '¥' + score.toLocaleString();
    el.style.left = screenX + 'px';
    el.style.top  = screenY + 'px';
    if (score >= 1200) {
      el.style.fontSize = '26px'; el.style.color = '#ffe000';
    } else if (score >= 600) {
      el.style.fontSize = '21px'; el.style.color = '#ff6a00';
    } else if (score >= 300) {
      el.style.fontSize = '18px'; el.style.color = '#ff8c00';
    } else {
      el.style.fontSize = '15px'; el.style.color = '#ffd24a';
    }
    this.elOverlay.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  setPowerGauge(power: number, maxPower: number) {
    const pct = maxPower > 0 ? Math.min(100, (power / maxPower) * 100) : 0;
    this.elPowerFill.style.width = `${pct}%`;
    this.elPowerFill.classList.toggle('low', pct <= 25);
  }

  showGameOver(score: number, destroys: number, humans: number) {
    if (score > this._bestScore) {
      this._bestScore = score;
      localStorage.setItem('kaiju_best_score', String(score));
    }
    this.elFinalDist.textContent  = `¥${score.toLocaleString()}`;
    this.elFinalBest.textContent  = `Best: ${this._bestScore.toLocaleString()} pts`;
    this.elFinalStats.textContent = `Destroys: ${destroys} | Humans: ${humans.toLocaleString()}`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }
}
