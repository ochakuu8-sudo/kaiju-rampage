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
  private elPopupLayer  = document.getElementById('popup-layer')!;

  // HUDスコアのロールアップ演出: displayed が target に徐々に追従する
  private displayedScore = 0;
  private targetScore    = 0;

  constructor() {
    // スピードメーターのグラデーションはメーター実幅 (px) で固定する。
    // こうしないと background-size を % で指定した場合、fill の width に
    // 連動して色の縮尺も動いてしまい、現在速度が読み取れなくなる。
    const wrap = document.getElementById('life-wrap')!;
    this.elSpeedFill.style.backgroundSize = `${wrap.clientWidth}px 100%`;
  }

  setDistance(meters: number) {
    this.elDistance.textContent = `${meters.toLocaleString()} m`;
  }

  setZone(chunkId: number) {
    this.elZone.textContent = ZONE_NAMES[chunkId % 3] ?? '';
  }

  /** レースゲーム風スピードメーター
   *  グラデーションはメーター実幅 (constructor で px 固定) で描画されるので、
   *  fill の width を変えるだけで右端の色 = 現在のスピードの色になる。 */
  setSpeedMeter(speed: number, maxSpeed: number) {
    const pct = maxSpeed > 0 ? Math.min(100, (speed / maxSpeed) * 100) : 0;
    this.elSpeedFill.style.width = `${pct}%`;
    this.elSpeedFill.classList.toggle('high', pct >= 80);
    this.elSpeedNumber.textContent = String(Math.round(speed));
  }

  setTimer(seconds: number) {
    const s = Math.max(0, Math.ceil(seconds));
    this.elTimer.textContent = String(s);
    this.elTimer.classList.toggle('low',  s <= 10 && s > 5);
    this.elTimer.classList.toggle('crit', s <= 5);
  }

  /** 被害総額 HUD 更新: ロールアップ演出のため target だけ記録する。
   *  実際の数値描画は tickScore(dt) が毎フレーム追従させる。 */
  setScore(score: number) {
    this.targetScore = score;
    // スコア加算の "ピカッ" パルスは即時トリガーで維持
    this.elDamage.classList.remove('pulse');
    void this.elDamage.offsetWidth;
    this.elDamage.classList.add('pulse');
  }

  /** 毎フレーム呼ばれ、displayedScore を targetScore に追従させる。 */
  tickScore(dt: number) {
    if (this.displayedScore === this.targetScore) return;
    const diff = this.targetScore - this.displayedScore;
    const step = Math.max(
      C.SCORE_ROLLUP_MIN_STEP,
      Math.ceil(Math.abs(diff) * dt * C.SCORE_ROLLUP_SPEED),
    );
    if (diff > 0) {
      this.displayedScore = Math.min(this.targetScore, this.displayedScore + step);
    } else {
      this.displayedScore = Math.max(this.targetScore, this.displayedScore - step);
    }
    this.elDamage.textContent = formatYen(this.displayedScore);
  }

  /** リスタート時: ¥0 からの逆ロールダウンを防ぐため即時リセット */
  resetScore() {
    this.displayedScore = 0;
    this.targetScore    = 0;
    this.elDamage.textContent = formatYen(0);
    this.elDamage.classList.remove('pulse');
  }

  /** ダメージポップアップ (ワールド座標に固定、コンテナごとスクロール追従) */
  spawnDamagePopup(amount: number, worldX: number, worldY: number, _cameraY: number) {
    const el = document.createElement('div');
    el.className = 'damage-popup';
    el.textContent = formatYen(amount);

    // 金額に応じた4段階演出 + 表示時間
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
    } else {
      dur = C.SCORE_POPUP_DUR_SMALL;
    }

    // CSSアニメーション時間を金額に合わせる
    el.style.animationDuration = `${dur}s`;

    // ワールド座標で配置 (コンテナの translateY がカメラ追従)
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
}
