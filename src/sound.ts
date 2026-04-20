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
  //  BGM  "Sunny Kaiju Parade" — 真昼のお日様の下で暴れる怪獣パレード
  // ═══════════════════════════════════════════════════════════════════
  // 32-step ループ = 3.68s/loop @ 115ms/step (約 130 BPM)。
  // アーケードアクション BGM の駆動感を意識したテンポ。
  // 進行: I - V - vi - IV (A - E - F#m - D)  — 王道「四つの和音」進行で
  //        明るく伸びやかなカタルシス。暗さは残さず、昼の光を感じさせる。
  // メジャーペンタトニック中心のリードで「お昼の爽快感」を演出。
  //
  // レイヤー構成:
  //  - サンパッド(sine + 5度) : お日様の暖かい持続音
  //  - サブランブル(sine + LFO) : 怪獣の気配を示す控えめな低域ドローン
  //  - ステップキック(triangle + noise) : 軽快な怪獣の足音
  //  - メガキック(コード頭のみ深いピッチドロップ) : 都市を踏み潰すドッスン
  //  - ベース(square + sub sine) : 跳ねるロックベース
  //  - アルペジオ(square + LP) : off-beat 16分駆動でアーケード疾走感
  //  - リード(square + LP env) : 明るい主旋律
  //  - ハイリード(sine オクターブ上) : 2小節目の感情せり上がり
  //  - ハーモニースタブ(triangle 3声) : コード感
  //  - スネア(ノイズ+sine) : マーチ的スネア
  //  - タムフィル(triangle ピッチ可変) : コード切替前の暴走ドラムフィル
  //  - ハット(HPノイズ) : 8分ドライブ
  //  - ライザー(saw sweep, LP 開放) : ループ末の緊張ビルドアップ
  //  - テンションスタブ(E7add9 triangle 4声) : ループ末の分厚いドミナント
  //  - クラッシュ(HPノイズ長め) : 大見得のクラッシュシンバル
  //  - ベルスパークル(sine 2声) : ループ末のきらめき

  /** ステージごとのキー (root 音)。A3=220Hz 起点。 */
  private static readonly STAGE_ROOT_HZ = [220, 165, 262, 175, 196]; // A3, E3, C4, F3, G3

  // ─── 進行: 8stepごとに A(0) / E(-5) / F#m(-3) / D(-7) ───
  //
  // ベース: ルート/5度/オクターブで跳ねる "pumping 8ths"。
  //   A → E → F#m → D の各 8step で root-5th-oct-5th ループ。
  private static readonly BASS_STEPS = [
    // A (I)            E (V)           F#m (vi)        D (IV)
     0, 0, 7, 0,  0, 7,12, 7,
    -5,-5, 2,-5, -5, 2, 7, 2,
    -3,-3, 4,-3, -3, 4, 9, 4,
    -7,-7, 0,-7, -7, 0, 5, 0,
  ];

  // リード: 2小節の呼びかけ→応答。メジャーペンタトニック中心、
  //   2小節目で高音 A(24 = A5) にタッチして「お日様のピーク」を作る。
  private static readonly LEAD_STEPS = [
    // A: A B C# E | F# E C# B   (ペンタトニック昇降、フックの呼びかけ)
    12,14,16,19, 21,19,16,14,
    // E: C# B G# B | C# B G# E  (E コードトーン中心、やわらかい下降)
    16,14,11,14, 16,14,11, 7,
    // F#m: B C# E F# | E F# A F# (上昇、F#m のセクシーさで高音域へ)
    14,16,19,21, 19,21,24,21,
    // D: E D B A | B A F# A     (解決、ルートAに戻るやさしい着地)
    19,17,14,12, 14,12, 9,12,
  ];

  // ハーモニースタブ: 各コード頭 (step 0/8/16/24) で 3声コード。
  //   chord[0] = ルート (root からのセミトーン)、chord[1] = 3度、chord[2] = 5度。
  //   A / E / D はメジャー (3rd=4)、F#m はマイナー (3rd=3)。
  private static readonly CHORDS: Array<[number, number, number]> = [
    [  0,  4,  7], // A   (A, C#, E)
    [ -5, -1,  2], // E   (E, G#, B)
    [ -3,  0,  4], // F#m (F#, A, C#)
    [ -7, -3,  0], // D   (D, F#, A)
  ];

  // キック: 密な駆動 + シンコペのダブルキック、小節末は 4 連打の爆発フィル。
  private static readonly KICK_PATTERN = [
    // bar 1 (土台だが既に 16 分キック混じりで前進力あり)
    1,0,0,1, 1,0,1,0,  1,0,1,1, 1,0,1,0,
    // bar 2 (ビルドアップ → 末尾 4 連打でカタルシス)
    1,0,0,1, 1,0,1,0,  1,0,1,1, 1,1,1,1,
  ];
  // スネア: 2/4 拍バックビート + ゴーストノートで疾走感、ループ末はフィル。
  private static readonly SNARE_PATTERN = [
    0,0,1,0, 0,1,1,0,  0,0,1,0, 0,0,1,1,
    0,0,1,0, 0,1,1,0,  0,0,1,1, 1,1,1,0,
  ];
  // ハット: フル 16 分刻み (1 = closed, 2 = open)。アクション BGM の疾走感。
  private static readonly HAT_PATTERN = [
    1,1,1,2, 1,1,1,2,  1,1,1,2, 1,1,1,2,
    1,1,1,2, 1,1,1,2,  1,1,1,2, 1,1,2,2,
  ];
  // タムフィル: 0=なし、1=ローtom、2=ハイtom。
  //   コード切替直前 (step 6,7 / 14,15 / 22,23) に"ドタドタ"と駆け込むフィル、
  //   ループ末 (step 28-31) に"タタタタ!"と暴走ドラムフィル。密度を上げて激しさ強化。
  private static readonly TOM_PATTERN = [
    0,0,0,0, 0,1,1,2,  0,0,0,0, 0,1,1,2,
    0,0,0,0, 0,1,1,2,  0,1,0,1, 1,2,1,2,
  ];
  // アルペジオ: コードトーンを off-beat で高速刻み。
  //   0=無音 / 1=root / 2=3rd / 3=5th (各 8step の CHORDS から参照)。
  //   16分の駆動感でアーケードアクション BGM の勢いを付ける。
  private static readonly ARP_PATTERN = [
    0,3,0,2, 0,1,0,2,  0,3,0,2, 0,1,0,3,
    0,3,0,2, 0,1,0,2,  0,3,0,2, 0,1,3,2,
  ];
  // ベルスパークル: ループ末 1 回 (step 28 で発音、2声sineのきらめき)。
  private static readonly BELL_STEP = 28;
  // サンパッド (お日様ドローン): step 0 で持続音をトリガ、ループ全体に渡る。
  private static readonly SUNPAD_STEP = 0;
  // サブランブル (怪獣の気配): ループ先頭で控えめな低域トリガ。
  private static readonly RUMBLE_STEP = 0;
  // メガキック発動ステップ: 各コード頭で深いピッチドロップの踏み潰し。
  private static readonly MEGA_KICK_STEPS = new Set([0, 8, 16, 24]);
  // テンションスタブ: ループ末 step 28 で E7add9 (E-G#-D-F#) を鳴らし、
  //   次ループ頭の A コードに向けて強いドミナント引力を生む。
  private static readonly TENSION_STAB_STEP = 28;
  // ライザー (緊張の溜め): step 24 から 4step かけて saw がピッチ+音量+明るさを上げ、
  //   テンションスタブ (step 28) に向かって "せり上がる" ビルドアップ効果。
  private static readonly RISER_START = 24;
  private static readonly RISER_LEN = 4;
  // ハイリード: 2小節目 (step 16-27) でリードをオクターブ上の sine で重ね、
  //   climax 区間の感情的せり上がりを演出する。
  private static readonly HIGH_LEAD_START = 16;
  private static readonly HIGH_LEAD_END = 28; // exclusive、28 以降はスタブに譲る
  // クラッシュシンバル: step 28 の大見得でドラマチックな頂点を作る。
  private static readonly CRASH_STEP = 28;

  private static readonly STEP_SEC = 0.115;  // 16分音符、約 130 BPM (アーケード疾走感)
  private static readonly PATTERN_LEN = 32;  // 2 小節 = 3.68s ループ

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

    // ── (1) サンパッド: お日様のドローン。ループ先頭で持続音をトリガ ──
    //   root と 5度 (perfect 5th) の sine を重ねた "オープンフィフス" で、
    //   全コード (A/E/F#m/D) に対して共通音になるよう設計。暖かい日差し感。
    if (i === SoundEngine.SUNPAD_STEP) {
      const dur = loopSec + 0.15; // 次ループとなめらかにクロスフェード
      const pitches = [root, root * Math.pow(2, 7 / 12)]; // root + 5th
      const gains = [0.09, 0.06];
      for (let v = 0; v < pitches.length; v++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = pitches[v];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(gains[v], t + 0.35);
        g.gain.setValueAtTime(gains[v], t + dur - 0.25);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }

    // ── (1b) サブランブル: 怪獣が近づく気配。控えめな低域ドローン + LFO ──
    //   root × 0.25 (2oct下) の sine に ±1.2Hz の LFO をかけ、わずかに
    //   揺らして "重さ" を足す。音量は SUNPAD より小さめで輪郭はぼかす。
    if (i === SoundEngine.RUMBLE_STEP) {
      const dur = loopSec + 0.15;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(root * 0.25, t);
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5.0;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.2;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.10, t + 0.4);
      g.gain.setValueAtTime(0.10, t + dur - 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      lfo.start(t); lfo.stop(t + dur);
    }

    // ── (2) キック: triangle 軽いピッチドロップ + 明るいクリック ──
    //   コード頭 (step 0/8/16/24) のみ "メガキック" 発動: より深く長く、
    //   都市を踏み潰すドッスン感を出して緊張感を補強。
    if (SoundEngine.KICK_PATTERN[i]) {
      const mega = SoundEngine.MEGA_KICK_STEPS.has(i);
      const dur = mega ? 0.13 : 0.075;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(mega ? 220 : 185, t);
      o.frequency.exponentialRampToValueAtTime(mega ? 34 : 58, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(mega ? 1.0 : 0.75, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      // click layer (アタック)。メガキックは低域寄りのクリックに。
      const cDur = 0.014;
      const cBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * cDur), ctx.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let k = 0; k < cData.length; k++) cData[k] = Math.random() * 2 - 1;
      const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
      const cLp = ctx.createBiquadFilter();
      cLp.type = 'lowpass'; cLp.frequency.value = mega ? 2800 : 4000;
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(mega ? 0.5 : 0.38, t);
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

    // ── (3b) アルペジオ: コードトーンを off-beat で高速刻み ──
    //   アクション BGM の非停止感を作る "ブリブリ" とした 16 分駆動レイヤー。
    //   リードが休む裏拍に刺さり、テンションを持続させる。
    if (SoundEngine.ARP_PATTERN[i]) {
      const seg = (i >> 3) & 3;                              // 0..3 = コード ID
      const chord = SoundEngine.CHORDS[seg];
      const toneIdx = SoundEngine.ARP_PATTERN[i] - 1;        // 0=root, 1=3rd, 2=5th
      const semi = chord[toneIdx] + 12;                      // 1 オクターブ上で中高域に
      const freq = root * Math.pow(2, semi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      // LP で角を丸めてリードと住み分け
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.45);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.5);
    }

    // ── (4) リード: square + LP エンベロープで "ブリッ" としたチップ音 ──
    {
      const leadSemi = SoundEngine.LEAD_STEPS[i];
      const freq = root * Math.pow(2, leadSemi / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      // LP がアタックで明るく開いてからやわらかく閉じる (お日様的ブライトネス)
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.exponentialRampToValueAtTime(2000, t + step * 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.20, t);
      g.gain.setValueAtTime(0.20, t + step * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.8);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.85);
    }

    // ── (4b) ハイリード: 2小節目の climax 区間 (step 16-27) で
    //   リード音をオクターブ上の sine で重ね、感情のせり上がりを演出 ──
    if (i >= SoundEngine.HIGH_LEAD_START && i < SoundEngine.HIGH_LEAD_END) {
      const leadSemi = SoundEngine.LEAD_STEPS[i];
      // step 16→27 で volume を 0.06 → 0.12 に漸増し、ビルドアップ感
      const progress = (i - SoundEngine.HIGH_LEAD_START) /
        (SoundEngine.HIGH_LEAD_END - SoundEngine.HIGH_LEAD_START);
      const gain = 0.06 + 0.06 * progress;
      const freq = root * Math.pow(2, leadSemi / 12) * 2; // 1 oct up
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.setValueAtTime(gain, t + step * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.85);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + step * 0.9);
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

    // ── (6b) タムフィル: 暴走ドラム的な低中音ロール ──
    //   コード切替前 (step 6,7 / 14,15 / 22,23) と、ループ末 (step 28-31) に
    //   "ドタドタ" と駆け込むフィル。怪獣が突進してくる緊迫感を付与。
    if (SoundEngine.TOM_PATTERN[i]) {
      const isHi = SoundEngine.TOM_PATTERN[i] === 2;
      const dur = 0.09;
      // 足の低音ボディ (triangle、ピッチドロップあり)
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const startHz = isHi ? 240 : 150;
      const endHz   = isHi ? 160 : 95;
      o.frequency.setValueAtTime(startHz, t);
      o.frequency.exponentialRampToValueAtTime(endHz, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur);
      // アタックノイズ (LP でウッド寄りに)
      const cDur = 0.02;
      const cBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * cDur), ctx.sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let k = 0; k < cData.length; k++) cData[k] = Math.random() * 2 - 1;
      const cSrc = ctx.createBufferSource(); cSrc.buffer = cBuf;
      const cLp = ctx.createBiquadFilter();
      cLp.type = 'lowpass'; cLp.frequency.value = isHi ? 3200 : 2200;
      const cG = ctx.createGain();
      cG.gain.setValueAtTime(0.25, t);
      cG.gain.exponentialRampToValueAtTime(0.001, t + cDur);
      cSrc.connect(cLp); cLp.connect(cG); cG.connect(dst);
      cSrc.start(t); cSrc.stop(t + cDur);
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

    // ── (7b) ライザー: ループ末 (step 24-27) で saw が低→高へ駆け上がる溜め ──
    //   LP も同時に開いて音色が明るくなり、volume も上がって緊張をチャージする。
    //   step 28 のテンションスタブ直前で最大に達し、そこにドーン！と落ちる。
    if (i === SoundEngine.RISER_START) {
      const dur = step * SoundEngine.RISER_LEN;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(root * 0.5, t);
      o.frequency.exponentialRampToValueAtTime(root * 4, t + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(700, t);
      lp.frequency.exponentialRampToValueAtTime(6500, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + dur * 0.95);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.04);
      o.connect(lp); lp.connect(g); g.connect(dst);
      o.start(t); o.stop(t + dur + 0.08);
    }

    // ── (8a) テンションスタブ: E7add9 (E-G#-D-F#) の 4 声で分厚い引力 ──
    //   D は V7 の b7、F# は 9th。より広い倍音スペクトルで "どーん！" と
    //   鳴らし、次ループ頭の A メジャーへの解決感をドラマチックに強調。
    if (i === SoundEngine.TENSION_STAB_STEP) {
      const dur = step * 3.0;
      // E(-5), G#(-1), D(5), F#(9) — E7add9 コードトーン
      const stabSemis = [-5, -1, 5, 9];
      const stabGains = [0.18, 0.13, 0.11, 0.10];
      for (let v = 0; v < stabSemis.length; v++) {
        const freq = root * Math.pow(2, stabSemis[v] / 12);
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(stabGains[v], t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }

    // ── (8c) クラッシュシンバル: テンションスタブと同時に鳴らす大見得 ──
    //   HP ノイズの長い余韻 + 初速の強いアタックで "ジャーン！" と爆発感。
    if (i === SoundEngine.CRASH_STEP) {
      const dur = 0.55;
      const bufLen = Math.ceil(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let k = 0; k < bufLen; k++) data[k] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 5200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(0.20, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(hp); hp.connect(g); g.connect(dst);
      src.start(t); src.stop(t + dur);
    }

    // ── (8b) ベルスパークル: ループ末尾で 1 回、"チン♪" と光るきらめき ──
    //   root * 4 (2oct上) と root * 6 (2oct+5th上) の sine 2 声で、
    //   高域の鐘のような倍音を作り、お昼の日差しに似合う爽快感を演出。
    if (i === SoundEngine.BELL_STEP) {
      const dur = 0.7;
      const freqs = [root * 4, root * 6];
      const gains = [0.10, 0.06];
      for (let v = 0; v < freqs.length; v++) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freqs[v];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(gains[v], t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(dst);
        o.start(t); o.stop(t + dur);
      }
    }
  }
}
