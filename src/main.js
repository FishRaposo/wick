import { createRun, act } from './rules.js';
import { W, H, T, TOP, drawWorld, drawHud, drawLog, drawTitle, drawOver, COLORS } from './render.js';
import { Sfx } from './audio.js';
import { loadBest, saveBest } from './storage.js';

const params = new URLSearchParams(location.search);
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;

const MOVE_KEYS = {
  ArrowUp: [0, -1], KeyW: [0, -1], KeyK: [0, -1], Numpad8: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1], KeyJ: [0, 1], Numpad2: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], KeyH: [-1, 0], Numpad4: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0], KeyL: [1, 0], Numpad6: [1, 0],
};
const WAIT_KEYS = new Set(['Space', 'Period', 'KeyZ', 'Numpad5']);
const STEP_MS = 85; // fastest a held key or pad direction repeats a move

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.sfx = new Sfx();
    this.best = loadBest();
    this.state = 'title';
    this.time = 0;
    this.lastStep = 0;
    this.queued = null;
    this.padPrev = [];
    this.padNext = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  newRun() {
    this.sfx.unlock();
    this.s = createRun(FIXED_SEED ?? ((Date.now() ^ 0x5bd1e995) >>> 0));
    this.v = { player: { x: this.s.player.x, y: this.s.player.y }, ents: new Map(), particles: [], floaters: [], hurtFlash: 0, shake: 0, fade: 1 };
    this.syncEnts(true);
    this.state = 'play';
    this.queued = null;
  }

  // ---------------------------------------------------------------- input

  onKey(e) {
    if (MOVE_KEYS[e.code] || WAIT_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyM' && !e.repeat) this.sfx.toggleMute();
    if (this.state === 'title') {
      if (!e.repeat && e.code !== 'KeyM') this.newRun();
      return;
    }
    if (this.state === 'over') {
      if ((e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') && this.overT > 0.8) this.newRun();
      return;
    }
    if (MOVE_KEYS[e.code]) this.request({ type: 'move', dx: MOVE_KEYS[e.code][0], dy: MOVE_KEYS[e.code][1] }, e.repeat);
    else if (WAIT_KEYS.has(e.code)) this.request({ type: 'wait' }, e.repeat);
  }

  onPointer(e) {
    this.canvas.focus();
    if (this.state === 'title') return this.newRun();
    if (this.state === 'over') {
      if (this.overT > 0.8) this.newRun();
      return;
    }
    // Tap to move: one step toward the tap along its dominant axis; tap yourself to wait.
    const r = this.canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left - this.view.ox) / this.view.scale;
    const wy = (e.clientY - r.top - this.view.oy) / this.view.scale;
    const dx = Math.floor(wx / T) - this.s.player.x;
    const dy = Math.floor((wy - TOP) / T) - this.s.player.y;
    if (!dx && !dy) this.request({ type: 'wait' });
    else if (Math.abs(dx) >= Math.abs(dy)) this.request({ type: 'move', dx: Math.sign(dx), dy: 0 });
    else this.request({ type: 'move', dx: 0, dy: Math.sign(dy) });
  }

  // Moves are rate-limited so a held key walks at a readable pace; one extra press is queued.
  request(action, repeat = false) {
    const now = performance.now();
    if (now - this.lastStep < STEP_MS) {
      if (!repeat) this.queued = action;
      return;
    }
    this.lastStep = now;
    this.perform(action);
  }

  pollPad(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !this.padPrev[i];
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    let dir = null;
    if (b[12] || ay < -0.6) dir = [0, -1];
    else if (b[13] || ay > 0.6) dir = [0, 1];
    else if (b[14] || ax < -0.6) dir = [-1, 0];
    else if (b[15] || ax > 0.6) dir = [1, 0];
    if (this.state !== 'play') {
      if ((edge(0) || edge(9)) && (this.state === 'title' || this.overT > 0.8)) this.newRun();
    } else if (dir && now >= this.padNext) {
      this.padNext = now + (this.padHeld ? 160 : 260);
      this.padHeld = true;
      this.request({ type: 'move', dx: dir[0], dy: dir[1] });
    } else if (!dir) {
      this.padHeld = false;
      this.padNext = 0;
      if (edge(0)) this.request({ type: 'wait' });
    }
    this.padPrev = b;
  }

  // ---------------------------------------------------------------- turns → effects

  perform(action) {
    if (this.state !== 'play') return;
    const s = this.s;
    const passed = act(s, action);
    this.react(s.events, action);
    this.syncEnts(s.events.some((e) => e.type === 'floor'));
    if (s.over) {
      this.state = 'over';
      this.overT = 0;
      if (s.score > this.best.score || s.depth > this.best.depth) {
        this.best = { score: Math.max(s.score, this.best.score), depth: Math.max(s.depth, this.best.depth) };
        saveBest(this.best);
      }
    }
    return passed;
  }

  react(events, action) {
    const v = this.v;
    const s = this.s;
    const at = (x, y) => [x * T + T / 2, TOP + y * T + T / 2];
    for (const ev of events) {
      switch (ev.type) {
        case 'move': this.sfx.step(); break;
        case 'bump':
          this.sfx.bump();
          v.player.x += (action.dx || 0) * 0.18;
          v.player.y += (action.dy || 0) * 0.18;
          break;
        case 'hit': {
          this.sfx.hit();
          const ent = v.ents.get(ev.id);
          if (ent) ent.flash = 0.12;
          this.burst(...at(ev.x, ev.y), 6, '#e8dcc4');
          v.player.x += (ev.x - s.player.x) * 0.25;
          v.player.y += (ev.y - s.player.y) * 0.25;
          break;
        }
        case 'kill':
          this.sfx.kill(ev.kind);
          this.burst(...at(ev.x, ev.y), 16, ev.kind === 'shade' ? '#3a3050' : ev.kind === 'moth' ? '#d8cfb8' : '#6e3324');
          break;
        case 'hurt':
          this.sfx.hurt();
          v.hurtFlash = 0.5;
          v.shake = 7;
          this.floater(...at(s.player.x, s.player.y), `-${ev.dmg}`, COLORS.blood);
          break;
        case 'pickup':
          if (ev.kind === 'oil') { this.sfx.oil(); this.floater(...at(ev.x, ev.y), '+oil', COLORS.amber); }
          else { this.sfx.bandage(); this.floater(...at(ev.x, ev.y), '+2', COLORS.blood); }
          break;
        case 'alert': this.sfx.alert(); break;
        case 'dark': this.sfx.dark(); v.shake = 3; break;
        case 'floor': this.sfx.descend(); v.fade = 1; break;
        case 'die': this.sfx.die(); v.shake = 10; break;
      }
    }
  }

  syncEnts(snap) {
    const v = this.v;
    const s = this.s;
    if (snap) {
      v.player.x = s.player.x;
      v.player.y = s.player.y;
      v.ents.clear();
    }
    const alive = new Set();
    for (const e of s.enemies) {
      alive.add(e.id);
      if (!v.ents.has(e.id)) v.ents.set(e.id, { x: e.x, y: e.y, flash: 0 });
    }
    for (const id of v.ents.keys()) if (!alive.has(id)) v.ents.delete(id);
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      const life = 0.3 + Math.random() * 0.5;
      this.v.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: 2 + Math.random() * 2, color, drag: 5 });
    }
  }

  floater(x, y, textStr, color) {
    this.v.floaters.push({ x, y: y - 10, text: textStr, color, life: 0.8, max: 0.8 });
  }

  // ---------------------------------------------------------------- loop

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.time += dt;
    this.pollPad(now);
    if (this.queued && now - this.lastStep >= STEP_MS) {
      const a = this.queued;
      this.queued = null;
      this.lastStep = now;
      this.perform(a);
    }
    if (this.state === 'over') this.overT += dt;
    if (this.v) this.tick(dt);
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  tick(dt) {
    const v = this.v;
    const s = this.s;
    const k = 1 - Math.exp(-22 * dt);
    v.player.x += (s.player.x - v.player.x) * k;
    v.player.y += (s.player.y - v.player.y) * k;
    for (const e of s.enemies) {
      const ent = v.ents.get(e.id);
      if (!ent) continue;
      ent.x += (e.x - ent.x) * k;
      ent.y += (e.y - ent.y) * k;
      ent.flash = Math.max(0, ent.flash - dt);
    }
    for (const p of v.particles) {
      p.life -= dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    v.particles = v.particles.filter((p) => p.life > 0);
    for (const f of v.floaters) f.life -= dt;
    v.floaters = v.floaters.filter((f) => f.life > 0);
    v.hurtFlash = Math.max(0, v.hurtFlash - dt);
    v.shake = Math.max(0, v.shake - dt * 30);
    v.fade = Math.max(0, v.fade - dt * 2.5);
    // Embers drifting up from the lantern.
    if (s.player.oil > 0 && Math.random() < dt * 9) {
      v.particles.push({ x: v.player.x * T + T / 2 + 8 + (Math.random() - 0.5) * 4, y: TOP + v.player.y * T + T / 2, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 25, life: 0.9, max: 0.9, size: 1.5, color: COLORS.ember, drag: 0.5 });
    }
  }

  render() {
    const ctx = this.ctx;
    const vw = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(vw.dpr * vw.scale, 0, 0, vw.dpr * vw.scale, vw.dpr * vw.ox, vw.dpr * vw.oy);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    if (this.state === 'title') {
      drawTitle(ctx, this.time, this.best);
    } else {
      const v = this.v;
      ctx.save();
      if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake, (Math.random() - 0.5) * v.shake);
      drawWorld(ctx, this.s, v, this.time);
      ctx.restore();
      drawLog(ctx, this.s);
      drawHud(ctx, this.s, this.best);
      if (v.hurtFlash > 0) {
        ctx.fillStyle = `rgba(200,64,44,${v.hurtFlash * 0.25})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (v.fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${v.fade})`;
        ctx.fillRect(0, TOP, W, H - TOP);
      }
      if (this.state === 'over') drawOver(ctx, this.s, this.best, this.overT);
    }
    if (this.sfx.muted) {
      ctx.fillStyle = 'rgba(232,220,196,0.5)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('muted', W - 10, H - 10);
    }
    ctx.restore();
  }
}

window.__wick = new Game(document.getElementById('game'));
