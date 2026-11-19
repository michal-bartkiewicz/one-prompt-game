import { SimEvent } from '../game/simulation';

class RetroSynth {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  playEvents(events: SimEvent[]): void {
    if (this.muted || events.length === 0) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i].type;
      switch (ev) {
        case 'gun':
          this.tone(420 + (Math.random() - 0.5) * 45, 160, 0.055, 'square', 0.06);
          break;
        case 'missile':
          this.tone(240, 880, 0.18, 'sawtooth', 0.08);
          break;
        case 'hit':
          this.tone(920, 620, 0.05, 'triangle', 0.07);
          break;
        case 'kill':
          this.noiseBurst(0.26, 480, 0.16);
          this.tone(180, 55, 0.24, 'sawtooth', 0.12);
          break;
        case 'playerHit':
          this.noiseBurst(0.18, 320, 0.18);
          this.tone(130, 70, 0.16, 'square', 0.11);
          break;
        case 'lockComplete':
          this.tone(880, 1320, 0.09, 'square', 0.05);
          break;
        case 'incomingWarning':
          this.tone(660, 440, 0.08, 'square', 0.045);
          break;
        case 'waveClear':
          this.tone(523, 784, 0.16, 'triangle', 0.08);
          break;
        case 'gameover':
          this.tone(220, 75, 0.42, 'sawtooth', 0.14);
          break;
      }
    }
  }

  private tone(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    gainLevel: number,
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  private noiseBurst(duration: number, cutoffHz: number, gainLevel: number): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now);
  }
}

export const retroSynth = new RetroSynth();
