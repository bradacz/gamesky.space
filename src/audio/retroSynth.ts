// Web Audio API Retro Chip Synthesizer with 5-Band Master EQ & Live Analyser for GameSky.space

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.8;

        // Create 5-Band EQ (60Hz, 250Hz, 1kHz, 4kHz, 16kHz)
        const freqs = [60, 250, 1000, 4000, 16000];
        const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

        this.eqFilters = freqs.map((freq, idx) => {
          const filter = this.ctx!.createBiquadFilter();
          filter.type = types[idx];
          filter.frequency.value = freq;
          filter.gain.value = 0; // 0 dB default
          return filter;
        });

        // Chain filters: Input -> EQ[0] -> EQ[1] -> ... -> EQ[4] -> Analyser -> Destination
        for (let i = 0; i < this.eqFilters.length - 1; i++) {
          this.eqFilters[i].connect(this.eqFilters[i + 1]);
        }
        this.eqFilters[this.eqFilters.length - 1].connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setEqBand(bandIndex: number, gainDb: number): void {
    this.getContext();
    if (this.eqFilters[bandIndex]) {
      this.eqFilters[bandIndex].gain.setValueAtTime(gainDb, this.ctx ? this.ctx.currentTime : 0);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    this.getContext();
    return this.analyser;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.ctx) {
      this.ctx.suspend();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private getDestination(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.eqFilters.length > 0 ? this.eqFilters[0] : (this.analyser ? this.analyser : ctx.destination);
  }

  // Mechanical Hardware Switch Click
  public playSwitchClick(state: boolean): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(state ? 950 : 650, now);
    osc.frequency.exponentialRampToValueAtTime(state ? 400 : 250, now + 0.03);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Mechanical Floppy Disk Head Step sound
  public playFloppySeek(): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const clickTime = now + i * 0.025;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340 - i * 40, clickTime);

      gain.gain.setValueAtTime(0.09, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.015);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(clickTime);
      osc.stop(clickTime + 0.02);
    }
  }

  // UI button blip
  public playBlip(): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Sound Blaster 16 OPL3 FM synth chord
  public playSoundBlasterJingle(): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C major arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      const noteStart = now + idx * 0.09;

      // FM synthesis: Modulator modulates Carrier
      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * 2, noteStart);

      modGain.gain.setValueAtTime(350, noteStart);
      modGain.gain.exponentialRampToValueAtTime(10, noteStart + 0.45);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteStart);

      mod.connect(modGain);
      modGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.14, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.5);

      osc.connect(gain);
      gain.connect(dest);

      mod.start(noteStart);
      osc.start(noteStart);
      mod.stop(noteStart + 0.55);
      osc.stop(noteStart + 0.55);
    });
  }

  // Roland MT-32 Orchestral MIDI Fanfare
  public playRolandFanfare(): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const chords = [
      { notes: [349.23, 440.00, 523.25], duration: 0.16 }, // F maj
      { notes: [392.00, 493.88, 587.33], duration: 0.16 }, // G maj
      { notes: [523.25, 659.25, 783.99, 1046.50], duration: 0.55 }, // C maj high
    ];

    let offset = 0;
    chords.forEach((chord) => {
      const chordStart = now + offset;
      chord.notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, chordStart);

        // Lowpass filter sweep for warm Roland sound
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, chordStart);
        filter.frequency.exponentialRampToValueAtTime(3800, chordStart + chord.duration * 0.5);

        gain.gain.setValueAtTime(0.09, chordStart);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + chord.duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(chordStart);
        osc.stop(chordStart + chord.duration + 0.05);
      });
      offset += chord.duration;
    });
  }

  // Level Complete / Victory Jingle
  public playVictory(): void {
    const ctx = this.getContext();
    const dest = this.getDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.12 },
      { f: 523.25, d: 0.12 },
      { f: 523.25, d: 0.12 },
      { f: 659.25, d: 0.25 },
      { f: 783.99, d: 0.25 },
      { f: 1046.50, d: 0.45 },
    ];

    let t = 0;
    melody.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + t;

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + note.d);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(start);
      osc.stop(start + note.d + 0.02);

      t += note.d * 0.9;
    });
  }

  public playDegauss(): void {
    this.playFloppySeek();
  }

  public playJump(): void {
    this.playBlip();
  }

  public playCoin(): void {
    this.playBlip();
  }
}

export const retroAudio = new RetroAudioEngine();
