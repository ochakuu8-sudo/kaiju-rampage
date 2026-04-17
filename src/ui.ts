/**
 * ui.ts — DOM UI 更新 (被害総額スコアアタック + スピードメーター + 燃料ゲージ + ステージ + CLEAR)
 */

import * as C from './constants';

/** ¥ 表記フォーマット (例: ¥1,250,000) */
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export class UIManager {
  private elDistance    = document.getElementById('distance-display')!;
  private elZone        = document.getElementById('zone-display')!;
  private elSpeedFill   = document.getElementById('life-fill')!;
  private elSpeedNumber = document.getElementById('speed-number')!;
  private elFuelWrap    = document.getElementById('fuel-wrap')!;
  private elFuelFill    = document.getElementById('fuel-fill')!;
  private elDamage      = document.getElementById('damage-display')!;
  private elGameover    = document.getElementById('gameover')!;
  private elFinalDist   = document.getElementById('final-wave')!;
  private elFinalBest   = document.getElementById('final-best')!;
  private elFinalStats  = document.getElementById('final-stats')!;
  private elClear       = document.getElementById('clear')!;
  private elClearScore  = document.getElementById('clear-score')!;
  private elClearDist   = document.getElementById('clear-dist')!;
  private elClearStats  = document.getElementById('clear-stats')!;
  private elOverlay     = document.getElementById('overlay')!;
  private elPopupLayer  = document.getElementById('popup-layer')!;

  constructor() {
    // スピードメーターのグラデーションはメーター実幅 (px) で固定する。
    const wrap = document.getElementById('life-wrap')!;
    this.elSpeedFill.style.backgroundSize = `${wrap.clientWidth}px 100%`;
  }

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  /** ステージ表示: "Stage N — 名称" */
  setZone(stageIndex: number, stageName: string) {
    this.elZone.textContent = `Stage ${stageIndex + 1} — ${stageName}`;
  }

  /** レースゲーム風スピードメーター */
  setSpeedMeter(speed: number, maxSpeed: number) {
    const pct = maxSpeed > 0 ? Math.min(100, (speed / maxSpeed) * 100) : 0;
    this.elSpeedFill.style.width = `${pct}%`;
    this.elSpeedFill.classList.toggle('high', pct >= 80);
    this.elSpeedNumber.textContent = String(Math.round(speed));
  }

  /** 燃料ゲージ (0-FUEL_MAX): バーの width を % にマップ + 閾値で色を切り替え */
  setFuel(fuel: number) {
    const pct = Math.max(0, Math.min(100, (fuel / C.FUEL_MAX) * 100));
    this.elFuelFill.style.width = `${pct}%`;
    const low  = fuel <= C.FUEL_LOW_THRESHOLD && fuel > C.FUEL_LOW_THRESHOLD / 2;
    const crit = fuel <= C.FUEL_LOW_THRESHOLD / 2;
    this.elFuelWrap.classList.toggle('low',  low);
    this.elFuelWrap.classList.toggle('crit', crit);
  }

  /** 被害総額 HUD 更新: 即時反映 + 小パルスのみ。 */
  setScore(score: number) {
    this.elDamage.textContent = formatYen(score);
    this.elDamage.classList.remove('pulse');
    void this.elDamage.offsetWidth;
    this.elDamage.classList.add('pulse');
  }

  resetScore() {
    this.elDamage.textContent = formatYen(0);
    this.elDamage.classList.remove('pulse');
  }

  /** ダメージポップアップ (ワールド座標に固定、コンテナごとスクロール追従) */
  spawnDamagePopup(amount: number, worldX: number, worldY: number, _cameraY: number) {
    const el = document.createElement('div');
    el.className = 'damage-popup';
    el.textContent = formatYen(amount);

    let dur: number;
    if (amount >= 5000) {
      el.classList.add('mega');
      dur = C.SCORE_POPUP_DUR_MEGA;
    } else if (amount >= 2000) {
      el.classList.add('large');
      dur = C.SCORE_POPUP_DUR_LARGE;
    } else if (amount >= 500) {
      el.classList.add('big');
      dur = C.SCORE_POPUP_DUR_BIG;
    } else if (amount < 50) {
      el.classList.add('tiny');
      dur = C.SCORE_POPUP_DUR_SMALL;
    } else {
      dur = C.SCORE_POPUP_DUR_SMALL;
    }

    el.style.animationDuration = `${dur}s`;
    el.style.left = `${180 + worldX}px`;
    el.style.top  = `${290 - worldY}px`;

    this.elPopupLayer.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000);
  }

  /** 毎フレーム1回: ポップアップレイヤー全体をカメラに追従 */
  updatePopupLayer(cameraY: number) {
    this.elPopupLayer.style.transform = `translateY(${cameraY}px)`;
  }

  showGameOver(score: number, distanceM: number, destroys: number, humans: number) {
    this.elFinalDist.textContent  = formatYen(score);
    this.elFinalBest.textContent  = `${distanceM.toLocaleString()} m | ${destroys} 破壊`;
    this.elFinalStats.textContent = `${humans.toLocaleString()} 人踏み`;
    this.elGameover.classList.add('show');
  }

  hideGameOver() {
    this.elGameover.classList.remove('show');
  }

  showClear(score: number, distanceM: number, destroys: number, humans: number) {
    this.elClearScore.textContent = formatYen(score);
    this.elClearDist.textContent  = `${distanceM.toLocaleString()} m | ${destroys} 破壊`;
    this.elClearStats.textContent = `${humans.toLocaleString()} 人踏み`;
    this.elClear.classList.add('show');
  }

  hideClear() {
    this.elClear.classList.remove('show');
  }
}
