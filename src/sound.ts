export class SoundEngine {
  audioContext: AudioContext;
  masterGain: GainNode;
  activeOscillators: Set<OscillatorNode> = new Set();
  maxSimultaneousSounds = 8;

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.3; // Master volume
    this.masterGain.connect(this.audioContext.destination);
  }

  private cleanupOscillator(osc: OscillatorNode) {
    this.activeOscillators.delete(osc);
  }

  playSound(type: string, pitch: number = 1) {
    // Limit simultaneous sounds
    if (this.activeOscillators.size >= this.maxSimultaneousSounds) {
      return;
    }

    switch (type) {
      case 'flipper':
        this.playFlipperSound(pitch);
        break;
      case 'wall':
        this.playWallSound(pitch);
        break;
      case 'building_hit':
        this.playBuildingHitSound(pitch);
        break;
      case 'building_destroy':
        this.playBuildingDestroySound(pitch);
        break;
      case 'human_crush':
        this.playHumanCrushSound(pitch);
        break;
      case 'combo':
        this.playComboSound(pitch);
        break;
      case 'bumper':
        this.playBumperSound(pitch);
        break;
      case 'ball_lost':
        this.playBallLostSound();
        break;
      case 'stage_clear':
        this.playStageClearSound();
        break;
    }
  }

  private playFlipperSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.05;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.value = 800 * pitch;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playWallSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.03;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.value = 400 * pitch;
    osc.type = 'triangle';

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playBuildingHitSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.08;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.frequency.value = 150 * pitch;
    osc.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playBuildingDestroySound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.2;

    // Low frequency rumble
    const osc1 = this.audioContext.createOscillator();
    const gain1 = this.audioContext.createGain();

    osc1.frequency.value = 100 * pitch;
    osc1.type = 'sine';

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc1.connect(gain1);
    gain1.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + duration);

    this.activeOscillators.add(osc1);
    osc1.addEventListener('ended', () => this.cleanupOscillator(osc1));

    // High frequency noise
    const osc2 = this.audioContext.createOscillator();
    const gain2 = this.audioContext.createGain();

    osc2.frequency.value = 600 * pitch;
    osc2.type = 'sawtooth';

    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc2.connect(gain2);
    gain2.connect(this.masterGain);

    osc2.start(now);
    osc2.stop(now + duration);

    this.activeOscillators.add(osc2);
    osc2.addEventListener('ended', () => this.cleanupOscillator(osc2));
  }

  private playHumanCrushSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.06;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.setValueAtTime(200 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(80 * pitch, now + duration);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playComboSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.1;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.setValueAtTime(400 * pitch, now);
    osc.frequency.linearRampToValueAtTime(600 * pitch, now + duration);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playBumperSound(pitch: number) {
    const now = this.audioContext.currentTime;
    const duration = 0.05;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.value = 1000 * pitch;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playBallLostSound() {
    const now = this.audioContext.currentTime;
    const duration = 0.5;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + duration);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    this.activeOscillators.add(osc);
    osc.addEventListener('ended', () => this.cleanupOscillator(osc));
  }

  private playStageClearSound() {
    const now = this.audioContext.currentTime;
    const baseFreq = 440;
    const notes = [0, 4, 7, 12]; // Major triad arpeggio
    const noteDuration = 0.15;

    for (let i = 0; i < notes.length; i++) {
      const noteTime = now + i * noteDuration;
      const freq = baseFreq * Math.pow(2, notes[i] / 12);

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.frequency.value = freq;
      osc.type = 'sine';

      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + noteDuration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(noteTime);
      osc.stop(noteTime + noteDuration);

      this.activeOscillators.add(osc);
      osc.addEventListener('ended', () => this.cleanupOscillator(osc));
    }
  }
}
