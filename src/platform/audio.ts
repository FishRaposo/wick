// Every sound is synthesized at runtime with WebAudio: no audio files, nothing to license, ~0 KB.

import type { EnemyKind } from '../core/types.ts';

const MUTE_KEY = 'wick.muted.v1';

export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  muted = false;
  volume = 0.5;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage blocked: default unmuted */
    }
  }

  configure(settings: { volume: number; muted: boolean }): void {
    this.volume = Math.max(0, Math.min(1, settings.volume));
    this.muted = settings.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  // Browsers only allow audio after a user gesture, so this runs on the first click/key.
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(c.destination);
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  get live(): boolean {
    return this.ctx !== null && !this.muted && this.ctx.state === 'running';
  }

  envelope(gain: GainNode, t: number, attack: number, dur: number, vol: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.2, delay = 0): void {
    const c = this.ctx;
    const master = this.master;
    if (!this.live || !c || !master) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.envelope(g, t, 0.005, dur, vol);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur: number, f0: number, f1: number, vol = 0.2, q = 1.2, type: BiquadFilterType = 'bandpass', delay = 0): void {
    const c = this.ctx;
    const master = this.master;
    const buffer = this.noiseBuf;
    if (!this.live || !c || !master || !buffer) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.envelope(g, t, 0.004, dur, vol);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  step(): void { this.noise(0.05, 900, 500, 0.05, 1.5); }
  bump(): void { this.tone('sine', 110, 80, 0.08, 0.08); }
  swing(): void { this.noise(0.09, 2200, 900, 0.12, 2); }
  hit(): void { this.tone('square', 220, 140, 0.07, 0.07); this.noise(0.05, 2600, 1200, 0.1, 1); }
  kill(kind: EnemyKind): void {
    if (kind === 'moth') { this.noise(0.18, 3000, 600, 0.12, 1.4); return; }
    if (kind === 'shade') { this.tone('sine', 520, 130, 0.45, 0.08); this.noise(0.4, 1200, 200, 0.1, 0.7, 'lowpass'); return; }
    this.tone('sine', 140, 45, 0.25, 0.3);
  }
  hurt(): void { this.tone('sawtooth', 200, 60, 0.3, 0.14); this.noise(0.2, 600, 120, 0.2, 0.7, 'lowpass'); }
  oil(): void { [0, 1, 2].forEach((i) => this.noise(0.06, 500 + i * 150, 300, 0.12, 4, 'bandpass', i * 0.07)); }
  bandage(): void { this.noise(0.25, 4000, 2000, 0.06, 0.8); }
  alert(): void { this.tone('sawtooth', 70, 95, 0.35, 0.07); }
  dark(): void { this.noise(0.6, 1800, 120, 0.2, 0.6, 'lowpass'); }
  descend(): void { [7, 3, 0, -5].forEach((st, i) => this.tone('triangle', 220 * 2 ** (st / 12), 0, 0.3, 0.08, i * 0.12)); }
  die(): void { [0, -3, -7, -12].forEach((st, i) => this.tone('triangle', 196 * 2 ** (st / 12), 0, 0.5, 0.09, i * 0.2)); }
}
