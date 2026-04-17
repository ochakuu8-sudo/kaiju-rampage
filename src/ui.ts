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
  private elDamage         = document.getElementById('damage-display')!;
  private elDamageCurrent  = document.getElementById('damage-current')!;
  private elDamagePending  = document.getElementById('damage-pending')!;
  private elGameover    = document.getElementById('gameover')!;
  private elFinalDist   = document.getElementById('final-wave')!;
  private elFinalBest   = document.getElementById('final-best')!;
  private elFinalStats  = document.getElementById('final-stats')!;
  private elOverlay     = document.getElementById('overlay')!;
  private elPopupLayer  = document.getElementById('popup-layer')!;

  // HUDスコアの2段ロールアップ演出
  // committedTotal: 吸収済みの確定合計 (displayedCurrent のロールアップ先)
  // displayedCurrent: 画面表示中の現在スコア
  // pendingBuffer: 直近の加算をプールしておくバッファ (画面右に "+¥XXX" 表示)
  // absorbTimer: 最後の加算からの経過秒数。SCORE_ABSORB_DELAY 超過で吸収。
  // previousTotal: setScore(total) から delta を割り出すための前回値
  private committedTotal   = 0;
  private displayedCurrent = 0;
  private pendingBuffer    = 0;
  private absorbTimer      = 0;
  private previousTotal    = 0;
  private lastCurrentText  = '¥0';
  private lastPendingText  = '';

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

  /** 被害総額 HUD 更新: 加算分を pendingBuffer に積むだけ。
   *  実際のドラムロールは tickScore(dt) が SCORE_ABSORB_DELAY 後に開始する。 */
  setScore(score: number) {
    const delta = score - this.previousTotal;
    this.previousTotal = score;
    if (delta === 0) return;
    this.pendingBuffer += delta;
    this.absorbTimer = 0;
    // pending 側に小パルス (連打中の "ピコッ" フィードバック)
    this.elDamagePending.classList.remove('pulse-pending');
    void this.elDamagePending.offsetWidth;
    this.elDamagePending.classList.add('pulse-pending');
  }

  /** 毎フレーム: 吸収判定 → ロールアップ → DOM 反映 */
  tickScore(dt: number) {
    // 1. 加算が途切れて一定時間経ったら pendingBuffer を committedTotal に吸収
    if (this.pendingBuffer > 0) {
      this.absorbTimer += dt;
      if (this.absorbTimer >= C.SCORE_ABSORB_DELAY) {
        this.committedTotal += this.pendingBuffer;
        this.pendingBuffer = 0;
        // 吸収の合図に大パルス (ドラムロール開始)
        this.elDamage.classList.remove('pulse');
        void this.elDamage.offsetWidth;
        this.elDamage.classList.add('pulse');
      }
    }

    // 2. displayedCurrent を committedTotal に追従 (既存ロジック)
    if (this.displayedCurrent !== this.committedTotal) {
      const diff = this.committedTotal - this.displayedCurrent;
      const step = Math.max(
        C.SCORE_ROLLUP_MIN_STEP,
        Math.ceil(Math.abs(diff) * dt * C.SCORE_ROLLUP_SPEED),
      );
      if (diff > 0) {
        this.displayedCurrent = Math.min(this.committedTotal, this.displayedCurrent + step);
      } else {
        this.displayedCurrent = Math.max(this.committedTotal, this.displayedCurrent - step);
      }
    }

    // 3. DOM 反映 (テキストが変わった時だけ)
    const curText = formatYen(this.displayedCurrent);
    if (curText !== this.lastCurrentText) {
      this.elDamageCurrent.textContent = curText;
      this.lastCurrentText = curText;
    }
    const pendText = this.pendingBuffer > 0 ? `+${formatYen(this.pendingBuffer)}` : '';
    if (pendText !== this.lastPendingText) {
      this.elDamagePending.textContent = pendText;
      this.lastPendingText = pendText;
    }
  }

  /** リスタート時: 全スコア状態を即時リセット */
  resetScore() {
    this.committedTotal   = 0;
    this.displayedCurrent = 0;
    this.pendingBuffer    = 0;
    this.absorbTimer      = 0;
    this.previousTotal    = 0;
    this.lastCurrentText  = formatYen(0);
    this.lastPendingText  = '';
    this.elDamageCurrent.textContent = this.lastCurrentText;
    this.elDamagePending.textContent = '';
    this.elDamage.classList.remove('pulse');
    this.elDamagePending.classList.remove('pulse-pending');
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
