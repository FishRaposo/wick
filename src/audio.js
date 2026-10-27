// Every sound is synthesized at runtime with WebAudio: no audio files, nothing to license, ~0 KB.

const MUTE_KEY = 'wick.muted.v1';

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* storage blocked: default unmuted */
    }
  }

  // Browsers only allow audio after a user gesture, so this runs on the first click/key.
  unlock() {
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
      this.master.gain.value = 0.5;
      this.master.connect(comp);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  get live() {
    return this.ctx && !this.muted && this.ctx.state === 'running';
  }

  envelope(gain, t, attack, dur, vol) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(type, f0, f1, dur, vol = 0.2, delay = 0) {
    if (!this.live) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.envelope(g, t, 0.005, dur, vol);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur, f0, f1, vol = 0.2, q = 1.2, type = 'bandpass', delay = 0) {
    if (!this.live) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.envelope(g, t, 0.004, dur, vol);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  step() { this.noise(0.05, 900, 500, 0.05, 1.5); }
  bump() { this.tone('sine', 110, 80, 0.08, 0.08); }
  swing() { this.noise(0.09, 2200, 900, 0.12, 2); }
  hit() { this.tone('square', 220, 140, 0.07, 0.07); this.noise(0.05, 2600, 1200, 0.1, 1); }
  kill(kind) {
    if (kind === 'moth') { this.noise(0.18, 3000, 600, 0.12, 1.4); return; }
    if (kind === 'shade') { this.tone('sine', 520, 130, 0.45, 0.08); this.noise(0.4, 1200, 200, 0.1, 0.7, 'lowpass'); return; }
    this.tone('sine', 140, 45, 0.25, 0.3);
  }
  hurt() { this.tone('sawtooth', 200, 60, 0.3, 0.14); this.noise(0.2, 600, 120, 0.2, 0.7, 'lowpass'); }
  oil() { [0, 1, 2].forEach((i) => this.noise(0.06, 500 + i * 150, 300, 0.12, 4, 'bandpass', i * 0.07)); }
  bandage() { this.noise(0.25, 4000, 2000, 0.06, 0.8); }
  alert() { this.tone('sawtooth', 70, 95, 0.35, 0.07); }
  dark() { this.noise(0.6, 1800, 120, 0.2, 0.6, 'lowpass'); }
  descend() { [7, 3, 0, -5].forEach((st, i) => this.tone('triangle', 220 * 2 ** (st / 12), 0, 0.3, 0.08, i * 0.12)); }
  die() { [0, -3, -7, -12].forEach((st, i) => this.tone('triangle', 196 * 2 ** (st / 12), 0, 0.5, 0.09, i * 0.2)); }
}
