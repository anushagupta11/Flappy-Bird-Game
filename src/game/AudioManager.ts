export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmInterval: any = null;
  private isPlayingBgm: boolean = false;

  private constructor() {
    // Lazy initialized on first interaction due to browser autoplay policy
    this.isMuted = localStorage.getItem("find_my_worm_muted") === "true";
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    if (!this.ctx) {
      // @ts-ignore
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem("find_my_worm_muted", String(this.isMuted));
    
    if (this.isMuted) {
      this.stopBgm();
    } else if (this.isPlayingBgm) {
      this.playBgm();
    }
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  // --- Sound Effects Synths ---

  public playJump(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;
    
    // Create nodes
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "triangle"; // Nice retro sound
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.12);

    gainNode.gain.setValueAtTime(0.15, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.13);
  }

  public playPoint(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "sine";
    // Double tone chime (arpeggio style)
    osc.frequency.setValueAtTime(587.33, time); // D5
    osc.frequency.setValueAtTime(880, time + 0.08); // A5

    gainNode.gain.setValueAtTime(0.1, time);
    gainNode.gain.setValueAtTime(0.1, time + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.005, time + 0.25);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.26);
  }

  public playWormCollect(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;

    // A fast ascending spark sound
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.08, time);
    gainNode.gain.exponentialRampToValueAtTime(0.005, time + 0.3);
    gainNode.connect(this.ctx.destination);

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time + idx * 0.05);
      
      const oscGain = this.ctx.createGain();
      oscGain.gain.setValueAtTime(0.05, time + idx * 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.05 + 0.1);
      
      osc.connect(oscGain);
      oscGain.connect(gainNode);
      
      osc.start(time + idx * 0.05);
      osc.stop(time + idx * 0.05 + 0.11);
    });
  }

  public playHit(): void {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const time = this.ctx.currentTime;

    // 1. Low rumble descend
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.linearRampToValueAtTime(40, time + 0.25);

    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.26);

    // 2. White noise crash burst
    const bufferSize = this.ctx.sampleRate * 0.2; // 0.2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noiseNode.start(time);
    noiseNode.stop(time + 0.2);
  }

  // --- Background Music (BGM) Synth Loop ---

  public playBgm(): void {
    this.isPlayingBgm = true;
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
    }

    let noteIndex = 0;
    // Simple 4-bar retro bass/melody loop
    // Notes: C3, G3, A3, F3 progression in 8th notes
    const bassline = [
      130.81, 130.81, 196.00, 130.81, 146.83, 164.81, 196.00, 164.81, // C-G-D-E
      220.00, 220.00, 329.63, 220.00, 293.66, 261.63, 220.00, 196.00, // A-E-D-C
      174.61, 174.61, 261.63, 174.61, 196.00, 220.00, 261.63, 220.00, // F-C-G-A
      196.00, 196.00, 293.66, 196.00, 174.61, 164.81, 146.83, 130.81  // G-D-F-E
    ];

    const tempo = 130; // BPM
    const stepDuration = 60 / tempo / 2; // 8th notes

    const playStep = () => {
      if (this.isMuted || !this.ctx) return;
      const time = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "triangle";
      const freq = bassline[noteIndex % bassline.length];
      osc.frequency.setValueAtTime(freq, time);

      // Soft bass synth envelope
      gainNode.gain.setValueAtTime(0.04, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + stepDuration - 0.02);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + stepDuration);

      // Play occasional light melody overlay on top of bass
      if (noteIndex % 8 === 0 || noteIndex % 8 === 3 || noteIndex % 8 === 6) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();

        leadOsc.type = "sine";
        // 2 octaves up
        leadOsc.frequency.setValueAtTime(freq * 4, time);
        
        leadGain.gain.setValueAtTime(0.015, time);
        leadGain.gain.exponentialRampToValueAtTime(0.001, time + stepDuration * 1.5);

        leadOsc.connect(leadGain);
        leadGain.connect(this.ctx.destination);

        leadOsc.start(time);
        leadOsc.stop(time + stepDuration * 1.5);
      }

      noteIndex++;
    };

    // Play first step immediately
    playStep();
    this.bgmInterval = setInterval(playStep, stepDuration * 1000);
  }

  public stopBgm(): void {
    this.isPlayingBgm = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}
