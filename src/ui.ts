/**
 * ui.ts — DOM UI 更新（被害総額スコアアタック + スピードメーター）
 */

import * as C from './constants';

const ZONE_NAMES: Record<number, string> = {
  0: '住宅街',
  1: '商業区',
  2: 'オフィス街',
};

/** ¥ 表記フォーマット (例: ¥1,250,000) */
function formatYen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export class UIManager {
  private elDistance    = document.getElementById('distance-display')!;
  private elZone        = document.getElementById('zone-display')!;
  private elSpeedFill   = document.getElementById('life-fill')!;
  private elSpeedNumber = document.getElementById('speed-number')!;
  private elTimer       = document.getElementById('timer-display')!;
  private elDamage      = document.getElementById('damage-display')!;
  private elGameover    = document.getElementById('gameover')!;
  private elFinalDist   = document.getElementById('final-wave')!;
  private elFinalBest   = document.getElementById('final-best')!;
  private elFinalStats  = document.getElementById('final-stats')!;
  private elOverlay     = document.getElementById('overlay')!;

  // ワールド座標に固定されたポップアップを追跡
  private activePopups: Array<{ el: HTMLElement; worldX: number; worldY: number; timer: number }> = [];

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  /** レースゲーム風スピードメーター */
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

  /** 被害総額 HUD 更新 (レトロスコアカウンター + パルス演出) */
  setScore(score: number) {
    this.elDamage.textContent = formatYen(score);
    // スコア加算パルス: アニメーション再トリガー
    this.elDamage.classList.remove('pulse');
    void this.elDamage.offsetWidth;
    this.elDamage.classList.add('pulse');
  }

  /** ダメージポップアップ (ワールド座標に固定、スクロール追従) */
  spawnDamagePopup(amount: number, worldX: number, worldY: number, cameraY: number) {
    const el = document.createElement('div');
    el.className = 'damage-popup';
    el.textContent = formatYen(amount);

    // 金額に応じた4段階演出
    if (amount >= 5000)      el.classList.add('mega');
    else if (amount >= 2000) el.classList.add('large');
    else if (amount >= 500)  el.classList.add('big');

    // 初期位置をセット
    const screenX = 180 + worldX;
    const screenY = 290 - (worldY - cameraY);
    el.style.left = `${screenX}px`;
    el.style.top  = `${screenY}px`;

    this.elOverlay.appendChild(el);
    this.activePopups.push({ el, worldX, worldY, timer: C.SCORE_POPUP_DURATION });
  }

  /** 毎フレーム呼び出し: ポップアップ位置をカメラに合わせて更新 */
  updatePopups(cameraY: number, dt: number) {
    for (let i = this.activePopups.length - 1; i >= 0; i--) {
      const p = this.activePopups[i];
      p.timer -= dt;
      if (p.timer <= 0) {
        p.el.remove();
        this.activePopups.splice(i, 1);
        continue;
      }
      // ワールド座標 → スクリーン座標
      const screenY = 290 - (p.worldY - cameraY);
      p.el.style.top = `${screenY}px`;
    }
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
}
