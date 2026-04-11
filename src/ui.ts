/**
 * ui.ts — DOM UI 更新（スコア・残機・コンボ・ゲームオーバー）
 */

import { COMBO_MAX } from './constants';

export class UIManager {
  private elScore    = document.getElementById('score')!;
  private elHi       = document.getElementById('hi')!;
  private elBalls    = document.getElementById('balls')!;
  private elStage    = document.getElementById('stage')!;
  private elCombo    = document.getElementById('combo')!;
  private elGameover = document.getElementById('gameover')!;
  private elFinalScore= document.getElementById('final-score')!;
  private elFinalBest = document.getElementById('final-best')!;
  private elStageClear= document.getElementById('stageclear')!;
  private elClearBonus= document.getElementById('clear-bonus')!;

  private _score = 0;
  private _hi    = 0;
  private _balls = 3;
  private _combo = 1;
  private _stage = 1;

  constructor() {
    this._hi = parseInt(localStorage.getItem('kaiju_hi') || '0', 10);
    this.updateHi();
  }

  setScore(v: number) {
    this._score = v;
    this.elScore.textContent = `SCORE: ${v.toLocaleString()}`;
    if (v > this._hi) {
      this._hi = v;
      this.updateHi();
    }
  }

  setBalls(v: number) {
    this._balls = v;
    this.elBalls.textContent = '●'.repeat(Math.max(0, v)) + '○'.repeat(Math.max(0, 3 - v));
  }

  setStage(v: number) {
    this._stage = v;
    this.elStage.textContent = `STAGE ${v}`;
  }

  setCombo(combo: number) {
    this._combo = combo;
    if (combo < 2) {
      this.elCombo.style.display = 'none';
      return;
    }
    this.elCombo.style.display = 'block';
    const isMax = combo >= COMBO_MAX;
    const txt = isMax ? `MAX×${combo}!!!` : `×${combo}!`;
    this.elCombo.textContent = txt;
    const base = 40 + combo * 4;
    this.elCombo.style.fontSize = `${Math.min(base, 80)}px`;
    this.elCombo.style.color = combo >= 5 ? (combo >= 8 ? '#ffd700' : '#ff4400') : '#ffff00';
    // アニメーション: スケールを1より大きくして戻す
    this.elCombo.style.transform = `translate(-50%,-50%) scale(${1.0 + combo * 0.04})`;
    setTimeout(() => {
      this.elCombo.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 120);
  }

  hideCombo() {
    this.elCombo.style.display = 'none';
  }

  showGameOver(score: number) {
    this.elFinalScore.textContent = `Score: ${score.toLocaleString()}`;
    this.elFinalBest.textContent  = `Best: ${this._hi.toLocaleString()}`;
    this.elGameover.classList.add('show');
    localStorage.setItem('kaiju_hi', String(this._hi));
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }

  showStageClear(bonusScore: number) {
    this.elClearBonus.textContent = `Bonus: +${bonusScore.toLocaleString()}`;
    this.elStageClear.classList.add('show');
  }

  hideStageClear() {
    this.elStageClear.classList.remove('show');
  }

  private updateHi() {
    this.elHi.textContent = `BEST: ${this._hi.toLocaleString()}`;
  }
}
