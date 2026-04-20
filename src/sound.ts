/**
 * sound.ts — Web Audio API による手続き的サウンドエンジン
 * 外部ファイル不要。OscillatorNode + GainNode で合成。
 */

const MASTER_VOLUME = 0.55;
const MUSIC_VOLUME  = 0.14;   // SFX を潰さないよう控えめ

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
  //  BGM  "Kaiju March" — 怪獣が街を踏み潰すB級特撮アーケードBGM
  // ═══════════════════════════════════════════════════════════════════
  // 32-step ループ = 4.0s/loop @ 125ms/step (120 BPM, 16分音符グリッド)。
  // 進行: i - bVII - bVI - V (Am-G-F-E)  — アンダルシア終止で
  //        怪獣映画の派手さ + アーケードのキャッチーさを両立。
  // E コードで G# (Phrygian dominant) を使い B 級特撮っぽい「ヤバさ」を演出。
  //
  // レイヤー構成:
  //  - サブランブル(40Hz sine, LFO揺らし) : 地響き
  //  - ステップキック(triangle 200→30Hz + ノイズ): 怪獣の足音
  //  - ベース(square + sub sine) : 駆動するロックベース
  //  - リード(square + LPフィルター) : チップチューン主旋律
  //  - ハーモニースタブ(triangle 3声) : コード感
  //  - スネア(ノイズ + サイン) : マーチ的スネア
  //  - ハット(HPノイズ) : 8分ドライブ
  //  - 空襲サイレン(saw sweep) : B級特撮的非常感 (ループ末に1回)

  /** ステージごとのキー (root 音)。A3=220Hz 起点。 */
  private static readonly STAGE_ROOT_HZ = [220, 165, 262, 175, 196]; // A3, E3, C4, F3, G3

  // ─── 進行: 8stepごとに Am(0) / G(-2) / F(-4) / E(-5) ───
  //
  // ベース: ルート/5度/オクターブで跳ねる "pumping 8ths" ロックパターン。
  //   Am → G → F → E の各 8step で root-5th-oct-5th ループ。
  private static readonly BASS_STEPS = [
    // Am              G                F                E
     0, 0, 7, 0,  0, 7,12, 7,
    -2,-2, 5,-2, -2, 5,10, 5,
    -4,-4, 3,-4, -4, 3, 8, 3,
    -5,-5, 2,-5, -5, 2, 7, 2,
  ];

  // リード: 2小節の呼びかけ→応答。1小節目は上昇でテンション上げ、
  //   2小節目で高音 E(19 = E5) まで駆け上がり、E コードで Phrygian dominant
  //   (E-F-G#-A-B) の下降で B 級特撮的に決める。
  private static readonly LEAD_STEPS = [
    // Am: A A C D | C D E D   (上昇ジグザグ、フックの呼びかけ)
    12,12,15,17, 15,17,19,17,
    // G: D C Bb C | Bb A G A  (応答、下降開始)
    17,15,13,15, 13,12,10,12,
    // F: A Bb C D | C Bb A G  (再上昇→下降、振り子的勢い)
    12,13,15,17, 15,13,12,10,
    // E: E F G# A | B A G# F  (Phrygian dominant、怪獣マーチ的半音進行)
     7, 8,11,12, 14,12,11, 8,
  ];

  // ハーモニースタブ: 各コード頭 (step 0/8/16/24) で 3声コード。
  //   chord[0] = ルート (root からのセミトーン)、chord[1] = 3度、chord[2] = 5度。
  //   Am(minor 3rd=3) / G,F,E はメジャー (3rd=4)。E の #3 = G# が怪獣マーチの味。
  private static readonly CHORDS: Array<[number, number, number]> = [
    [  0,  3,  7], // Am
    [ -2,  2,  5], // G  (ルート-2、3度=B(+2)、5度=D(+5))
    [ -4,  0,  3], // F  (ルート-4、3度=A(0)、5度=C(+3))
    [ -5, -1,  2], // E  (ルート-5、3度=G#(-1)、5度=B(+2))
  ];

  // キック: ルート/3拍目 + シンコペ、小節末はダブルキックでフィル。
  private static readonly KICK_PATTERN = [
    1,0,0,1, 1,0,0,0,  1,0,0,1, 1,0,1,0,
    1,0,0,1, 1,0,0,0,  1,0,0,1, 1,0,1,1,
  ];
  // スネア: 2/4 拍 + ループ終盤フィル。
  private static readonly SNARE_PATTERN = [
    0,0,1,0, 0,0,1,0,  0,0,1,0, 0,0,1,0,
    0,0,1,0, 0,0,1,0,  0,0,1,1, 1,0,1,0,
  ];
  // ハット: 基本 8 分 (1 = closed, 2 = open)。
  private static readonly HAT_PATTERN = [
    1,0,1,2, 1,0,1,0,  1,0,1,2, 1,0,1,0,
    1,0,1,2, 1,0,1,0,  1,0,1,2, 1,0,2,2,
  ];
  // 空襲サイレン: ループ末 1 回 (step 26 で発音、0.8s のアップダウンスイープ)。
  private static readonly SIREN_STEP = 26;
  // サブランブル (地響き): step 0 で 4 秒ぶんトリガ、次ループで自然に更新。
  private static readonly RUMBLE_STEP = 0;

  private static readonly STEP_SEC = 0.125;   // 16分音符、120 BPM
  private static readonly PATTERN_LEN = 32;   // 2 小節 = 4.0s ループ

  /** BGM ループを開始 (既に再生中なら stageIndex 変更のみ反映) */
  startMusic(stageIndex: number): void {
    const ctx = this.getCtx();
    if (!ctx || !this.musicGain) return;
    this.musicStageIndex = stageIndex;
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
        nextTime += SoundEngine.STEP_SEC;
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
    const i = stepIdx % SoundEngine.PATTERN_LEN;
    const root = SoundEngine.STAGE_ROOT_HZ[this.musicStageIndex] ?? SoundEngine.STAGE_ROOT_HZ[0];
    const step = SoundEngine.STEP_SEC;
    const loopSec = SoundEngine.PATTERN_LEN * step;

    // ── (1) サブランブル: 地響きドローン。ループ先頭で 4s ぶんトリガ ──
    if (i === SoundEngine.RUMBLE_STEP) {
      const dur = loopSec + 0.1; // 次ループとわずかにクロスフェード
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(root * 0.25, t); // root の -2oct = 超低域
      // LFO で微妙に揺らして地揺れ感
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5.5; // 5.5Hz の重い揺れ
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.8;  // ±1.8Hz 振幅
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.30, t + 0.15);
      g.gain.setValueAtTime(0.30, t + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      lfo.start(t); lfo.stop(t + dur);
    }

    // ── (2) キック: triangle 高速ピッチドロップ + ノイズ thump ──
    if (SoundEngine.KICK_PATTERN[i]) {
      const dur = 0.11;
      // pitched body (怪獣の足音的な "ドゥゥン")
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(32, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.95, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      // click layer (アタック強化)
      const cDur = 0.015;
      const cBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * cDur), ctx.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let k = 0; k < cData.length; k++) cData[k] = Math.random() * 2 - 1;
      const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
      const cLp = ctx.createBiquadFilter();
      cLp.type = 'lowpass'; cLp.frequency.value = 2500;
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(0.5, t);
      cG.gain.exponentialRampToValueAtTime(0.001, t + cDur);
      cSrc.connect(cLp); cLp.connect(cG); cG.connect(dst);
      cSrc.start(t); cSrc.stop(t + cDur);
    }

    // ── (3) ベース: square + オクターブ下 sine でパワー駆動 ──
    {
      const bassSemi = SoundEngine.BASS_STEPS[i];
      const baseFreq = (root / 2) * Math.pow(2, bassSemi / 12);
      // メイン square (うねる倍音)
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = baseFreq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1100; // 角を少し丸める
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.34, t);
      g.gain.setValueAtTime(0.34, t + step * 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.85);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.9);
      // sub sine (さらに 1oct 下で重量感)
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = baseFreq * 0.5;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.22, t);
      sg.gain.setValueAtTime(0.22, t + step * 0.55);
      sg.gain.exponentialRampToValueAtTime(0.001, t + step * 0.85);
      sub.connect(sg); sg.connect(dst);
      sub.start(t); sub.stop(t + step * 0.9);
    }

    // ── (4) リード: square + LP エンベロープで "ブリッ" としたチップ音 ──
    {
      const leadSemi = SoundEngine.LEAD_STEPS[i];
      const freq = root * Math.pow(2, leadSemi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      // LP がアタックで開いて閉じる ("カッコイイ" 合成エンベロープ)
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3800, t);
      lp.frequency.exponentialRampToValueAtTime(1400, t + step * 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.20, t);
      g.gain.setValueAtTime(0.20, t + step * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.8);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.85);
    }

    // ── (5) ハーモニースタブ: 8-step ごと (= コード頭) に 3声 triangle コード ──
    if (i % 8 === 0) {
      const chord = SoundEngine.CHORDS[(i / 8) | 0];
      const dur = step * 7.2; // 次コードまで持続
      for (let v = 0; v < 3; v++) {
        const semi = chord[v];
        const freq = root * Math.pow(2, semi / 12);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        // スタブ的にアタック後ゆるやかに減衰
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.025, t + step * 3);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }

    // ── (6) スネア: ノイズ BP + sine body でパンチのあるマーチスネア ──
    if (SoundEngine.SNARE_PATTERN[i]) {
      const dur = 0.08;
      // body (200Hz sine、スネアの "胴鳴り")
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(160, t + dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.22, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(og); og.connect(dst);
      o.start(t); o.stop(t + dur);
      // noise (BP 2kHz)
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.40, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(bp); bp.connect(ng); ng.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── (7) ハット: HP ノイズで 8 分ドライブ (open = 少し長め) ──
    if (SoundEngine.HAT_PATTERN[i]) {
      const isOpen = SoundEngine.HAT_PATTERN[i] === 2;
      const dur = isOpen ? 0.08 : 0.022;
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

    // ── (8) 空襲サイレン: ループ末尾で 1 回、怪獣映画的な "ウィーーン" ──
    if (i === SoundEngine.SIREN_STEP) {
      const dur = 0.75;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      // up→down sweep: 低→高→低 で "警報" 感
      o.frequency.setValueAtTime(root * 1.2, t);
      o.frequency.exponentialRampToValueAtTime(root * 2.4, t + dur * 0.5);
      o.frequency.exponentialRampToValueAtTime(root * 1.1, t + dur);
      // やや潰すためのLP
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.10, t + 0.08);
      g.gain.setValueAtTime(0.10, t + dur - 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
    }
  }
}
