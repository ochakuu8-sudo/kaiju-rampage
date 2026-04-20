/**
 * sound.ts — Web Audio API による手続き的サウンドエンジン
 * 外部ファイル不要。OscillatorNode + GainNode で合成。
 */

const MASTER_VOLUME = 0.28;
const MUSIC_VOLUME  = 0.07;   // SFX を潰さないよう控えめ

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeCount = 0;
  private muted = false;
  private suspended = false;
  private readonly MAX_ACTIVE = 8;

  /** BGM ループ状態 */
  private musicStopFlag = { stopped: true };

  private getCtx(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        this.master.connect(this.ctx.destination);
        // BGM 用サブバス (master の下で独立音量制御)
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = MUSIC_VOLUME;
        this.musicGain.connect(this.master);
      } catch {
        return null;
      }
    }
    // タブ非アクティブ中はリジュームしない (visibilitychange で明示的に復帰させる)
    if (!this.suspended && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** ミュート切替 (true: 消音 / false: 通常音量) */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_VOLUME;
  }

  isMuted(): boolean { return this.muted; }

  /** タブ非アクティブ時に呼ぶ: AudioContext を停止し、後続の自動 resume を抑止 */
  suspend(): void {
    this.suspended = true;
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** タブ復帰時に呼ぶ: 自動 resume 抑止を解除し、AudioContext を再開 */
  resume(): void {
    this.suspended = false;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /** ランダムピッチ変動 (±range) */
  private rp(base: number, range = 0.1): number {
    return base * (1 + (Math.random() * 2 - 1) * range);
  }

  private canPlay(): boolean {
    if (this.activeCount >= this.MAX_ACTIVE) return false;
    return true;
  }

  private schedule(fn: (ctx: AudioContext, master: GainNode) => number) {
    if (this.muted || this.suspended) return;
    const ctx = this.getCtx();
    if (!ctx || !this.master) return;
    if (!this.canPlay()) return;
    this.activeCount++;
    const dur = fn(ctx, this.master);
    setTimeout(() => { this.activeCount = Math.max(0, this.activeCount - 1); }, dur * 1000 + 50);
  }

  // ===== 個別SE =====

  flipper() {
    this.schedule((ctx, dst) => {
      const t = ctx.currentTime;
      const dur = 0.055;
      // triangle波で丸みのある「コン」
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(this.rp(160, 0.06), t);
      o.frequency.exponentialRampToValueAtTime(70, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      // 薄いローパスで篭らせる
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      return dur;
    });
  }

  wallHit() {
    this.schedule((ctx, dst) => {
      const g = ctx.createGain();
      g.connect(dst);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(this.rp(200, 0.1), ctx.currentTime);
      g.gain.setValueAtTime(0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      o.connect(g);
      o.start(); o.stop(ctx.currentTime + 0.03);
      return 0.03;
    });
  }

  buildingHit() {
    this.schedule((ctx, dst) => {
      const dur = 0.08;
      const g = ctx.createGain();
      g.connect(dst);
      // ノイズで「ドゴッ」
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = this.rp(400, 0.15);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(flt); flt.connect(g);
      src.start(); src.stop(ctx.currentTime + dur);
      return dur;
    });
  }

  buildingDestroy() {
    this.schedule((ctx, dst) => {
      const dur = 0.22;
      const g = ctx.createGain();
      g.connect(dst);
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(800, ctx.currentTime);
      flt.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.7, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(flt); flt.connect(g);
      // 低音追加
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(80, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.4, ctx.currentTime);
      og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(og); og.connect(dst);
      src.start(); src.stop(ctx.currentTime + dur);
      o.start();   o.stop(ctx.currentTime + dur);
      return dur;
    });
  }

  humanCrush(_comboMult = 1) {
    // 最優先再生（activeCount上限を無視）
    const ctx = this.getCtx();
    if (!ctx || !this.master) return;
    const t   = ctx.currentTime;
    const pit = this.rp(1.0, 0.12); // ピッチ揺らし

    // === Layer 1: 低音ボディ (sine 90→45Hz) ===
    const dur1 = 0.09;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(90 * pit, t);
    o1.frequency.exponentialRampToValueAtTime(42 * pit, t + dur1);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.55, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + dur1);
    o1.connect(g1); g1.connect(this.master);
    o1.start(t); o1.stop(t + dur1);

    // === Layer 2: 中域スクイッシュノイズ (bandpass ~600Hz) ===
    const dur2 = 0.06;
    const nBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur2), ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let i = 0; i < nData.length; i++) nData[i] = Math.random() * 2 - 1;
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 * pit;
    bp.Q.value = 3.5;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.35, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur2);
    nSrc.connect(bp); bp.connect(g2); g2.connect(this.master);
    nSrc.start(t); nSrc.stop(t + dur2);

    // === Layer 3: 高音ポップ (sine 1800→900Hz, 超短い) ===
    const dur3 = 0.025;
    const o3 = ctx.createOscillator();
    o3.type = 'sine';
    o3.frequency.setValueAtTime(1800 * pit, t);
    o3.frequency.exponentialRampToValueAtTime(900 * pit, t + dur3);
    const g3 = ctx.createGain();
    g3.gain.setValueAtTime(0.18, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + dur3);
    o3.connect(g3); g3.connect(this.master);
    o3.start(t); o3.stop(t + dur3);

    this.activeCount++;
    setTimeout(() => { this.activeCount = Math.max(0, this.activeCount - 1); }, dur1 * 1000 + 50);
  }

  resetComboStep() { /* 廃止 */ }

  bumper() {
    this.schedule((ctx, dst) => {
      const g = ctx.createGain();
      g.connect(dst);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(this.rp(900, 0.1), ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      o.connect(g);
      o.start(); o.stop(ctx.currentTime + 0.05);
      return 0.05;
    });
  }

  ballLost() {
    this.schedule((ctx, dst) => {
      const dur = 0.5;
      const g = ctx.createGain();
      g.connect(dst);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(600, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      o.start(); o.stop(ctx.currentTime + dur);
      return dur;
    });
  }

  stageClear() {
    const ctx = this.getCtx();
    if (!ctx || !this.master) return;
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const g = ctx.createGain();
      g.connect(this.master!);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g);
      o.start(t); o.stop(t + 0.25);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BGM (手続き的チップチューン) — 全ステージ共通テーマ曲
  // ═══════════════════════════════════════════════════════════════════
  //  「街が理不尽に破壊されるパニック映画」モチーフ:
  //   ・D マイナー (悲壮)
  //   ・進行: i - VI - III - V (Dm - Bb - F - A) ループ
  //   ・リードはフィリギア的小2度を多用 (D-Eb 不協和、不安と緊張)
  //   ・ベースは8分行進、迫りくる足音
  //   ・スネアの連打フィルで「逃げ惑う群衆」のパニック感
  //
  //  Pulse1 (square + ビブラート): 旋律
  //  Pulse2 (square + LP):          コード持続音 (持続感ある不協和)
  //  Triangle:                       低音行進ベース (8 分ペダル)
  //  Drums:                          kick 1/3拍 + snare 2/4拍 + hat 8分

  private static readonly THEME = {
    root: 147,             // D3
    stepSec: 0.13,         // 32 steps × 0.13s = 4.16s/loop
    //         |── i (Dm) ────|── VI (Bb) ───|── III (F) ────|── V (A) → i ──|
    lead:    [12,13,12,10,  7, 8, 7, 5,    8, 9, 8,12,  10,12,15,17,    15,17,15,13, 12,10, 8, 7,    7, 8, 7, 5,  3, 5, 7,12 ],
    harm:    [ 7,-1,-1,-1,  -1,-1, 7,-1,    3,-1,-1,-1,  -1,-1, 5,-1,    9,-1,-1,-1,  -1,-1,12,-1,    4,-1, 4,-1,  7,-1, 7,-1 ],
    bass:    [ 0,12, 0,12,   0,12, 0, 0,   -4, 8,-4, 8,  -4, 8,-4,-4,    3,15, 3,15,   3,15, 3, 3,   -2,10,-2,10, -2,10, 0, 0 ],
    kick:    [ 1, 0, 0, 0,   1, 0, 0, 1,    1, 0, 0, 0,   1, 0, 0, 1,    1, 0, 0, 0,   1, 0, 0, 1,    1, 0, 0, 0,  1, 0, 1, 1 ],
    snare:   [ 0, 0, 1, 0,   0, 0, 1, 0,    0, 0, 1, 0,   0, 0, 1, 0,    0, 0, 1, 0,   0, 0, 1, 0,    0, 0, 1, 0,  1, 1, 1, 1 ],
    hat:     [ 1, 1, 1, 1,   2, 1, 1, 1,    1, 1, 1, 1,   2, 1, 1, 1,    1, 1, 1, 1,   2, 1, 1, 1,    1, 1, 1, 1,  2, 1, 2, 2 ],
  };
  private static readonly PATTERN_LEN = 32;

  /** BGM ループを開始 (stageIndex は将来拡張用、現在は単一テーマ) */
  startMusic(_stageIndex: number = 0): void {
    const ctx = this.getCtx();
    if (!ctx || !this.musicGain) return;
    if (!this.musicStopFlag.stopped) return;  // 既に再生中

    const flag = { stopped: false };
    this.musicStopFlag = flag;
    let stepIdx = 0;
    let nextTime = ctx.currentTime + 0.1;

    const schedule = () => {
      if (flag.stopped) return;
      const c = this.ctx;
      if (!c || !this.musicGain) return;
      if (this.muted || this.suspended) {
        // 無音状態では空回しせず、復帰を待つ (100ms ポーリング)
        setTimeout(schedule, 100);
        return;
      }
      const now = c.currentTime;
      // suspend/mute 明けで nextTime が過去に取り残されている場合、現在時刻に合わせ直す
      if (nextTime < now - 0.2) nextTime = now + 0.05;
      // 0.4s 先までスケジュール
      while (nextTime < now + 0.4) {
        this._scheduleStep(c, this.musicGain, nextTime, stepIdx);
        nextTime += SoundEngine.THEME.stepSec;
        stepIdx++;
      }
      setTimeout(schedule, 80);
    };
    schedule();
  }

  /** BGM を即停止 (ゲームオーバー/クリア/タイトルで呼ぶ) */
  stopMusic(): void {
    this.musicStopFlag.stopped = true;
  }

  private _scheduleStep(ctx: AudioContext, dst: GainNode, t: number, stepIdx: number): void {
    const song = SoundEngine.THEME;
    const i = stepIdx % SoundEngine.PATTERN_LEN;
    const step = song.stepSec;
    const root = song.root;

    // ── リード (pulse1, square, 主旋律) ──
    const leadSemi = song.lead[i];
    if (leadSemi !== -1) {
      const freq = root * Math.pow(2, leadSemi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      // 軽いビブラート (LFO) — パニック感の揺らぎ
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.012;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.20, t + 0.008);
      g.gain.setValueAtTime(0.20, t + step * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.92);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.95);
      lfo.start(t); lfo.stop(t + step * 0.95);
    }

    // ── ハーモニー (pulse2, square + LP, 持続音) ──
    const harmSemi = song.harm[i];
    if (harmSemi !== -1) {
      const freq = root * Math.pow(2, harmSemi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 2.2); // 長めにサステイン
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 2.3);
    }

    // ── ベース (triangle, 1 オクターブ下、足音風行進) ──
    const bassSemi = song.bass[i];
    if (bassSemi !== -1) {
      const freq = (root / 2) * Math.pow(2, bassSemi / 12);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.50, t + 0.005);
      g.gain.setValueAtTime(0.50, t + step * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.95);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.98);
    }

    // ── キック (sine pitch-drop、太いドゥーン) ──
    if (song.kick[i]) {
      const dur = 0.10;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(38, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
    }

    // ── スネア (BP ノイズ、群衆のパニック) ──
    if (song.snare[i]) {
      const dur = 0.085;
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 1.3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── ハイハット (HP ノイズ) ──
    if (song.hat[i]) {
      const isOpen = song.hat[i] === 2;
      const dur = isOpen ? 0.12 : 0.04;
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(isOpen ? 0.20 : 0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(hp); hp.connect(g); g.connect(dst);
      src.start(t); src.stop(t + dur);
    }
  }
}
