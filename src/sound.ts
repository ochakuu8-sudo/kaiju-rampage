/**
 * sound.ts — Web Audio API による手続き的サウンドエンジン
 * 外部ファイル不要。OscillatorNode + GainNode で合成。
 */

const MASTER_VOLUME = 0.9;
const MUSIC_VOLUME  = 0.025;  // SE 中心、BGM は控えめな背景レベル

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
  private musicStageIndex = -1;

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
  //  BGM  "Kaiju March" フルバージョン — 8 セクション × 32 step = 256 step ループ
  // ═══════════════════════════════════════════════════════════════════
  // 32 秒で一巡。A1 (Verse A) のメロディを基本として 0-6 は共通、
  // レイヤーの足し引きだけで盛り上げていく。最後の Section 7 で初めて
  // 1 オクターブ上の大きな音程変化を解放してクライマックスにする。
  //
  // 進行: Am-G-F-E (アンダルシア終止)、各セクション 8 step × 4 コード。

  /** ステージごとのキー (root 音)。A3=220Hz 起点。 */
  private static readonly STAGE_ROOT_HZ = [220, 165, 262, 175, 196];

  private static readonly STEP_SEC = 0.125;   // 16 分、120 BPM
  private static readonly STEPS_PER_SECTION = 32;
  private static readonly SECTION_COUNT = 8;
  private static readonly PATTERN_LEN = 256;  // 8 × 32 = 256 step = 32 秒

  // ───── ベース: A1 (Verse A) を基本とし、0-6 は全部同じ。
  //   変化は全部レイヤー側で付ける。7 だけ最後のクライマックス用に少し変化。
  private static readonly BASS_A1 = [
    // Am: root-root-5-root / root-5-oct-5
     0, 0, 7, 0,  0, 7,12, 7,
    // G
    -2,-2, 5,-2, -2, 5,10, 5,
    // F
    -4,-4, 3,-4, -4, 3, 8, 3,
    // E
    -5,-5, 2,-5, -5, 2, 7, 2,
  ];
  // セクション 7 (CLIMAX) のみ: 上行アルペジオで最後の盛り上げ
  private static readonly BASS_CLIMAX = [
     0, 7,12,15,  0, 7,12,15,
    -2, 5,10,13, -2, 5,10,13,
    -4, 3, 8,12, -4, 3, 8,12,
    -5, 2, 7,11,  7, 2, 0, 0,
  ];

  // ───── リード: A1 が軸。0 は間引き版、1-6 は同じ A1 を使用、
  //   7 だけ +12 (1 オクターブ上) で最後のクライマックス。
  private static readonly LEAD_A1 = [
    // Am: A C E C | D C A C
    12,15,19,15, 17,15,12,15,
    // G:  G Bb D Bb | C Bb G Bb
    10,13,17,13, 15,13,10,13,
    // F:  F A C A | Bb A F A
     8,12,15,12, 13,12, 8,12,
    // E:  E G# B G# | A G# E G#
     7,11,14,11, 12,11, 7,11,
  ];
  // セクション 0 (INTRO) 用: A1 の骨格音だけ、隙間多め
  private static readonly LEAD_INTRO = [
    12,-1,-1,-1, 17,-1,-1,-1,  10,-1,-1,-1, 15,-1,-1,-1,
     8,-1,-1,-1, 13,-1,-1,-1,   7,-1,-1,-1, 12,-1,-1,-1,
  ];
  // セクション 7 (CLIMAX) 用: A1 を +12 (1 オクターブ上) のクライマックス版
  //   末尾だけ 12 = A4 に落として次ループ INTRO の 12 へスムーズ接続
  private static readonly LEAD_CLIMAX = [
    24,27,31,27, 29,27,24,27,
    22,25,29,25, 27,25,22,25,
    20,24,27,24, 25,24,20,24,
    19,23,26,23, 24,23,19,12,
  ];

  // ───── アルペジオ: 裏拍で和音トーンを刻む。セクション有効時のみ ─────
  //   0=無音 / 1=root / 2=3rd / 3=5th / 4=octave
  private static readonly ARP_PATTERN = [
    0,3,0,2, 0,4,0,2,  0,3,0,2, 0,4,0,3,
    0,3,0,2, 0,4,0,2,  0,3,0,2, 0,4,0,1,
  ];
  // 各セクションのコード (root 基準の root/3rd/5th/oct セミトーン)
  private static readonly CHORDS: Array<[number, number, number, number]> = [
    [  0,  3,  7, 12], // Am  (A C E A)
    [ -2,  1,  5, 10], // G   (G B D G)  ※ メジャー 3rd = B = +2 from G = 1 from A。ただし自然短音階なので Bb = 1、調性に合わせ B♭扱い
    [ -4,  0,  3,  8], // F   (F A C F)
    [ -5, -1,  2,  7], // E   (E G# B E)  Phrygian dom
  ];

  // ───── ドラム: 全セクション共通 32 step、プロフィールで gate ─────
  private static readonly KICK_PATTERN = [
    1,0,0,1, 1,0,0,0,  1,0,0,1, 1,0,1,0,
    1,0,0,1, 1,0,0,0,  1,0,0,1, 1,0,1,1,
  ];
  private static readonly SNARE_PATTERN = [
    0,0,1,0, 0,0,1,0,  0,0,1,0, 0,0,1,0,
    0,0,1,0, 0,0,1,0,  0,0,1,0, 0,0,1,1,
  ];
  private static readonly HAT_PATTERN = [
    1,0,1,2, 1,0,1,0,  1,0,1,2, 1,0,1,0,
    1,0,1,2, 1,0,1,0,  1,0,1,2, 1,0,2,2,
  ];
  // タムフィル (セクション末尾 step 28-31 のみで発火)
  private static readonly TOM_FILL = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0,
                                       0,0,0,0, 0,0,0,0, 0,0,0,0, 1,2,1,2];

  // ───── セクション別レイヤープロファイル (右肩上がりで加算) ─────
  //   セクション番号が上がるほどレイヤー追加、音量 UP。下げなし。
  private static readonly SECTION_PROFILE = [
    // 0 INTRO: bass + lead のみ、ドラムなし (最小編成)
    { kick:false, snare:false, hat:false, arp:false, stab:false, pad:false, crash:false, fill:false, leadGain:0.18, bassGain:0.26 },
    // 1 VERSE A: + kick/snare/hat (基本ドラム in)
    { kick:true,  snare:true,  hat:true,  arp:false, stab:false, pad:false, crash:true,  fill:false, leadGain:0.20, bassGain:0.30 },
    // 2 VERSE A': + arp (off-beat 刻み追加)
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:false, pad:false, crash:false, fill:false, leadGain:0.22, bassGain:0.32 },
    // 3 VERSE B: + stab (コード頭スタブ)、fill で chorus への橋渡し
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:true,  pad:false, crash:false, fill:true,  leadGain:0.24, bassGain:0.34 },
    // 4 CHORUS A: + pad、リードオクターブ上
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:true,  pad:true,  crash:true,  fill:false, leadGain:0.26, bassGain:0.36 },
    // 5 CHORUS B: 全レイヤー継続、密度アップ
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:true,  pad:true,  crash:false, fill:false, leadGain:0.28, bassGain:0.37 },
    // 6 FINAL: 最高音域、全レイヤー、crash 頭
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:true,  pad:true,  crash:true,  fill:false, leadGain:0.30, bassGain:0.38 },
    // 7 PEAK/TRANSITION: 最大密度維持、末尾に fill で次ループへ
    { kick:true,  snare:true,  hat:true,  arp:true,  stab:true,  pad:true,  crash:false, fill:true,  leadGain:0.30, bassGain:0.38 },
  ];

  /** BGM ループを開始 (既に再生中なら stageIndex 変更のみ反映) */
  startMusic(stageIndex: number): void {
    const ctx = this.getCtx();
    if (!ctx || !this.musicGain) return;
    this.musicStageIndex = stageIndex;
    if (!this.musicStopFlag.stopped) return;

    const flag = { stopped: false };
    this.musicStopFlag = flag;
    let stepIdx = 0;
    let nextTime = ctx.currentTime + 0.1;

    const schedule = () => {
      if (flag.stopped) return;
      const c = this.ctx;
      if (!c || !this.musicGain) return;
      if (this.muted || this.suspended) {
        setTimeout(schedule, 100);
        return;
      }
      const now = c.currentTime;
      if (nextTime < now - 0.2) nextTime = now + 0.05;
      while (nextTime < now + 0.4) {
        this._scheduleStep(c, this.musicGain, nextTime, stepIdx);
        nextTime += SoundEngine.STEP_SEC;
        stepIdx++;
      }
      setTimeout(schedule, 80);
    };
    schedule();
  }

  /** BGM を即停止 */
  stopMusic(): void {
    this.musicStopFlag.stopped = true;
  }

  private _scheduleStep(ctx: AudioContext, dst: GainNode, t: number, stepIdx: number): void {
    const overall = stepIdx % SoundEngine.PATTERN_LEN;
    const sectionIdx = Math.floor(overall / SoundEngine.STEPS_PER_SECTION);
    const i = overall % SoundEngine.STEPS_PER_SECTION;          // セクション内位置
    const profile = SoundEngine.SECTION_PROFILE[sectionIdx];
    const root = SoundEngine.STAGE_ROOT_HZ[this.musicStageIndex] ?? SoundEngine.STAGE_ROOT_HZ[0];
    const step = SoundEngine.STEP_SEC;
    const chordIdx = Math.floor(i / 8);                         // 0..3 = Am/G/F/E
    const chord = SoundEngine.CHORDS[chordIdx];

    // ── Crash (セクション冒頭の HP ノイズ、金属的な "シャーン") ──
    if (profile.crash && i === 0) {
      const dur = 0.9;
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(hp); hp.connect(g); g.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── Pad (サステインコード、コード頭で発音し次コードまで持続) ──
    if (profile.pad && i % 8 === 0) {
      const dur = step * 7.8;
      for (let v = 0; v < 3; v++) {
        const semi = chord[v];
        const freq = root * Math.pow(2, semi / 12);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.065, t + 0.2);
        g.gain.setValueAtTime(0.065, t + step * 6);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }

    // ── Stab (コード頭のスタブ、短いアタック) ──
    if (profile.stab && i % 8 === 0) {
      const dur = step * 1.2;
      for (let v = 0; v < 3; v++) {
        const semi = chord[v];
        const freq = root * Math.pow(2, semi / 12);
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = freq;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.10, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(lp); lp.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }

    // ── Bass (square + オクターブ下 sine で厚み) ──
    //   0 = INTRO (A1 同じ)、7 = CLIMAX (アルペジオ)、それ以外は A1 共通
    const bassPattern = sectionIdx === 7 ? SoundEngine.BASS_CLIMAX : SoundEngine.BASS_A1;
    {
      const bassSemi = bassPattern[i];
      const baseFreq = (root / 2) * Math.pow(2, bassSemi / 12);
      // メイン square
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(profile.bassGain, t);
      g.gain.setValueAtTime(profile.bassGain, t + step * 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.85);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.9);
      // sub sine (さらに 1oct 下で重量感)
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = baseFreq * 0.5;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(profile.bassGain * 0.5, t);
      sg.gain.setValueAtTime(profile.bassGain * 0.5, t + step * 0.55);
      sg.gain.exponentialRampToValueAtTime(0.001, t + step * 0.85);
      sub.connect(sg); sg.connect(dst);
      sub.start(t); sub.stop(t + step * 0.9);
    }

    // ── Lead (square + LP envelope) ──
    //   0 = INTRO (間引き版)、7 = CLIMAX (+12 octave up)、それ以外は A1 共通
    const leadPattern =
      sectionIdx === 0 ? SoundEngine.LEAD_INTRO :
      sectionIdx === 7 ? SoundEngine.LEAD_CLIMAX :
                         SoundEngine.LEAD_A1;
    {
      const leadSemi = leadPattern[i];
      if (leadSemi >= 0) {
        const freq = root * Math.pow(2, leadSemi / 12);
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = freq;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(4200, t);
        lp.frequency.exponentialRampToValueAtTime(1600, t + step * 0.7);
        const g = ctx.createGain();
        g.gain.setValueAtTime(profile.leadGain, t);
        g.gain.setValueAtTime(profile.leadGain, t + step * 0.55);
        g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.8);
        o.connect(lp); lp.connect(g); g.connect(dst);
        o.start(t); o.stop(t + step * 0.85);
      }
    }

    // ── Arp (off-beat 16 分でコードトーン刻み) ──
    if (profile.arp && SoundEngine.ARP_PATTERN[i]) {
      const toneIdx = SoundEngine.ARP_PATTERN[i] - 1; // 0..3
      const semi = chord[toneIdx] + 12;               // 1 オクターブ上
      const freq = root * Math.pow(2, semi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.45);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.5);
    }

    // ── Kick (triangle ピッチドロップ + noise click) ──
    if (profile.kick && SoundEngine.KICK_PATTERN[i]) {
      const dur = 0.09;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(195, t);
      o.frequency.exponentialRampToValueAtTime(42, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      // click
      const cDur = 0.013;
      const cBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * cDur), ctx.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let k = 0; k < cData.length; k++) cData[k] = Math.random() * 2 - 1;
      const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
      const cLp = ctx.createBiquadFilter();
      cLp.type = 'lowpass'; cLp.frequency.value = 3200;
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(0.42, t);
      cG.gain.exponentialRampToValueAtTime(0.001, t + cDur);
      cSrc.connect(cLp); cLp.connect(cG); cG.connect(dst);
      cSrc.start(t); cSrc.stop(t + cDur);
    }

    // ── Snare (ノイズ BP + triangle body) ──
    if (profile.snare && SoundEngine.SNARE_PATTERN[i]) {
      const dur = 0.075;
      // body
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(170, t + dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.22, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(og); og.connect(dst);
      o.start(t); o.stop(t + dur);
      // noise
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.38, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(ng); ng.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── Hat (HP noise、8 分 closed / open) ──
    if (profile.hat && SoundEngine.HAT_PATTERN[i]) {
      const isOpen = SoundEngine.HAT_PATTERN[i] === 2;
      const dur = isOpen ? 0.07 : 0.022;
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(isOpen ? 0.14 : 0.20, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(hp); hp.connect(g); g.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── Tom fill (セクション末尾 step 28-31 のみ) ──
    if (profile.fill && SoundEngine.TOM_FILL[i]) {
      const isHi = SoundEngine.TOM_FILL[i] === 2;
      const dur = 0.09;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const startHz = isHi ? 240 : 150;
      const endHz = isHi ? 160 : 95;
      o.frequency.setValueAtTime(startHz, t);
      o.frequency.exponentialRampToValueAtTime(endHz, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
    }
  }
}
