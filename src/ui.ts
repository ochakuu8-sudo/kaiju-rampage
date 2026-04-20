/**
 * ui.ts — DOM UI 更新 (燃料ゲージ + ステージ + CLEAR/GAMEOVER)
 */

import * as C from './constants';

export class UIManager {
  private elDistance   = document.getElementById('distance-display')!;
  private elZone       = document.getElementById('zone-display')!;
  private elFuelWrap   = document.getElementById('life-wrap')!;
  private elFuelFill   = document.getElementById('life-fill')!;
  private elGameover   = document.getElementById('gameover')!;
  private elFinalBest  = document.getElementById('final-best')!;
  private elFinalStats = document.getElementById('final-stats')!;
  private elClear      = document.getElementById('clear')!;
  private elClearDist  = document.getElementById('clear-dist')!;
  private elClearStats = document.getElementById('clear-stats')!;
  private elPopupLayer = document.getElementById('popup-layer')!;

  constructor() {
    // 黄色ベースの fill (ピンチ時は CSS class で赤に切り替え)
  }

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  /** ステージ表示: "Stage N — 名称" */
  setZone(stageIndex: number, stageName: string) {
    this.elZone.textContent = `Stage ${stageIndex + 1} — ${stageName}`;
  }

  /** 燃料ゲージ (0-FUEL_MAX): バーの width を % にマップ + 閾値で警告表示 */
  setFuel(fuel: number) {
    const pct = Math.max(0, Math.min(100, (fuel / C.FUEL_MAX) * 100));
    this.elFuelFill.style.width = `${pct}%`;
    const low  = fuel <= C.FUEL_LOW_THRESHOLD && fuel > C.FUEL_LOW_THRESHOLD / 2;
    const crit = fuel <= C.FUEL_LOW_THRESHOLD / 2;
    this.elFuelWrap.classList.toggle('low',  low);
    this.elFuelWrap.classList.toggle('crit', crit);
  }

  /** 毎フレーム1回: ポップアップレイヤー全体をカメラに追従 */
  updatePopupLayer(cameraY: number) {
    this.elPopupLayer.style.transform = `translateY(${cameraY}px)`;
  }

  showGameOver(distanceM: number, destroys: number, humans: number) {
    this.elFinalBest.textContent  = `${distanceM.toLocaleString()} m | ${destroys} DESTROYED`;
    this.elFinalStats.textContent = `${humans.toLocaleString()} STOMPS`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }

  showClear(distanceM: number, destroys: number, humans: number) {
    this.elClearDist.textContent  = `${distanceM.toLocaleString()} m | ${destroys} DESTROYED`;
    this.elClearStats.textContent = `${humans.toLocaleString()} STOMPS`;
    this.elClear.classList.add('show');
  }

  hideClear() {
    this.elClear.classList.remove('show');
  }
}
