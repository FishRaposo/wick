import { createRun, act, updateVision } from './core/rules.ts';
import { Rng } from './core/rng.ts';
import type { Action, Best, Cell, RunEvent, RunState } from './core/types.ts';
import { CONTENT } from './content/index.ts';
import { W, H, T, TOP, TITLE_SETTINGS, TITLE_CONTINUE, drawWorld, drawHud, drawLog, drawTitle, drawOver, COLORS } from './presentation/render.ts';
import type { EntView, View } from './presentation/render.ts';
import { Menus } from './presentation/menus.ts';
import { Sfx } from './platform/audio.ts';
import { loadBest, saveBest, loadSave, saveRun, clearSave, snapshotRun } from './platform/storage.ts';
import type { RunSave } from './platform/storage.ts';
import { loadSettings, saveSettings } from './platform/settings.ts';
import type { Settings } from './platform/settings.ts';

const params = new URLSearchParams(location.search);
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;

const MOVE_KEYS: Record<string, Cell> = {
  ArrowUp: [0, -1], KeyW: [0, -1], KeyK: [0, -1], Numpad8: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1], KeyJ: [0, 1], Numpad2: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], KeyH: [-1, 0], Numpad4: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0], KeyL: [1, 0], Numpad6: [1, 0],
};
const WAIT_KEYS = new Set(['Space', 'Period', 'KeyZ', 'Numpad5']);
const STEP_MS = 85; // fastest a held key or pad direction repeats a move

type Screen = 'title' | 'play' | 'over';

class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  view: { scale: number; ox: number; oy: number; dpr: number };
  sfx: Sfx;
  menus: Menus;
  settings: Settings;
  best: Best;
  state: Screen;
  seed: number;
  time: number;
  lastStep = 0;
  queued: Action | null = null;
  padPrev: boolean[] = [];
  padNext = 0;
  padHeld = false;
  last: number;
  overT = 0;
  paused = false;
  save: RunSave | null = null;
  saveLabel: string | null = null;
  s: RunState | null = null;
  v: View | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    const ui = document.getElementById('ui');
    const announcer = document.getElementById('announcer');
    if (!ctx || !ui || !announcer) throw new Error('Wick needs a canvas, #ui and #announcer');
    this.canvas = canvas;
    this.ctx = ctx;
    this.view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
    this.settings = loadSettings();
    this.sfx = new Sfx();
    this.sfx.configure(this.settings);
    this.menus = new Menus(ui, announcer);
    this.best = loadBest();
    this.state = 'title';
    this.seed = FIXED_SEED ?? ((Date.now() ^ 0x5bd1e995) >>> 0);
    this.time = 0;
    this.save = loadSave();
    this.refreshSaveLabel();
    this.resize();
    addEventListener('resize', () => this.resize());
    addEventListener('keydown', (e) => this.onKey(e));
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    canvas.focus();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.canvas.clientWidth || innerWidth;
    const ch = this.canvas.clientHeight || innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    Object.assign(this.view, { scale: s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr });
  }

  refreshSaveLabel(): void {
    const save = this.save;
    if (!save || !this.validSave(save)) {
      this.clearRunSave();
      return;
    }
    this.saveLabel = `continue  floor ${save.depth} · turn ${save.turn}`;
  }

  validSave(save: RunSave): boolean {
    return save.depth >= 1 && save.tiles.length > 0 && Number.isFinite(save.seed) && Number.isFinite(save.rngState);
  }

  clearRunSave(): void {
    clearSave();
    this.save = null;
    this.saveLabel = null;
  }

  persistRun(): void {
    const s = this.s;
    if (!s || s.over || this.state !== 'play') return;
    const save = snapshotRun(s);
    this.save = save;
    this.saveLabel = `continue  floor ${save.depth} · turn ${save.turn}`;
    saveRun(save);
  }

  resumeSave(): void {
    const save = this.save;
    if (!save || !this.validSave(save)) {
      this.clearRunSave();
      return;
    }
    const rng = new Rng(save.seed);
    rng.state = save.rngState;
    const s: RunState = {
      seed: save.seed,
      rng,
      content: CONTENT,
      depth: save.depth,
      tiles: new Uint8Array(save.tiles),
      stairs: { ...save.stairs },
      player: { ...save.player },
      enemies: save.enemies.map((e) => ({ ...e, target: e.target ? { ...e.target } : null })),
      items: save.items.map((i) => ({ ...i })),
      seen: new Uint8Array(save.seen),
      visible: new Uint8Array(save.tiles.length),
      turn: save.turn,
      kills: save.kills,
      score: save.score,
      noise: null,
      over: false,
      log: save.log.map((l) => ({ ...l })),
      events: [],
      nextId: save.nextId,
    };
    updateVision(s);
    this.s = s;
    this.seed = s.seed;
    this.v = {
      player: { x: s.player.x, y: s.player.y },
      ents: new Map<number, EntView>(),
      particles: [],
      floaters: [],
      hurtFlash: 0,
      shake: 0,
      fade: 1,
    };
    this.syncEnts(true);
    this.state = 'play';
    this.queued = null;
    this.paused = false;
    this.sfx.unlock();
    this.menus.announce(`Resumed floor ${s.depth}, turn ${s.turn}`);
  }

  newRun(): void {
    this.clearRunSave();
    this.sfx.unlock();
    this.seed = FIXED_SEED ?? ((Date.now() ^ 0x5bd1e995) >>> 0);
    this.s = createRun(this.seed, { content: CONTENT });
    this.v = {
      player: { x: this.s.player.x, y: this.s.player.y },
      ents: new Map<number, EntView>(),
      particles: [],
      floaters: [],
      hurtFlash: 0,
      shake: 0,
      fade: 1,
    };
    this.syncEnts(true);
    this.state = 'play';
    this.queued = null;
    this.paused = false;
    this.menus.announce(`Floor 1 · seed ${this.seed}`);
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    saveSettings(settings);
    this.sfx.configure(settings);
  }

  toggleFullscreen(): void {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void this.canvas.requestFullscreen?.();
    } catch {
      /* not allowed in this frame */
    }
  }

  copySeed(): void {
    const text = `${location.origin}${location.pathname}?seed=${this.seed}`;
    navigator.clipboard?.writeText(text).then(
      () => this.menus.announce('Seed copied'),
      () => this.menus.announce('Could not copy the seed'),
    );
  }

  openSettings(): void {
    this.sfx.unlock();
    this.menus.openSettings(
      this.settings,
      { onChange: (s) => this.applySettings(s), onFullscreen: () => this.toggleFullscreen() },
      () => {
        if (this.state === 'play') this.paused = false;
      },
    );
  }

  pause(): void {
    if (this.state !== 'play' || this.paused || this.menus.isOpen) return;
    this.paused = true;
    this.menus.announce('Paused');
    // Defer the modal by one task so the Escape keydown that opened it cannot close it.
    setTimeout(() => {
      if (!this.paused || this.menus.isOpen) return;
      this.menus.openPause(this.settings, {
        onChange: (s) => this.applySettings(s),
        onFullscreen: () => this.toggleFullscreen(),
        onResume: () => {
          if (this.state === 'play') {
            this.paused = false;
            this.menus.announce('Resumed');
          }
        },
        onNewRun: () => {
          this.paused = false;
          this.newRun();
        },
      });
    }, 0);
  }

  // ---------------------------------------------------------------- input

  onKey(e: KeyboardEvent): void {
    if (this.menus.isOpen) return;
    const move = MOVE_KEYS[e.code];
    if (move || WAIT_KEYS.has(e.code)) e.preventDefault();
    if (e.code === 'KeyM' && !e.repeat) {
      this.applySettings({ ...this.settings, muted: !this.settings.muted });
      return;
    }
    if (e.code === 'KeyF' && !e.repeat) {
      this.toggleFullscreen();
      return;
    }
    if (e.code === 'KeyO' && !e.repeat) {
      if (this.state === 'play') this.pause();
      else this.openSettings();
      return;
    }
    if (e.code === 'KeyY' && !e.repeat) {
      this.copySeed();
      return;
    }
    if (e.code === 'Escape') {
      if (this.state === 'play') this.pause();
      return;
    }
    if (this.state === 'title') {
      if (e.code === 'KeyC' && this.save) {
        this.resumeSave();
        return;
      }
      if (!e.repeat && e.code !== 'KeyM' && e.code !== 'KeyF' && e.code !== 'KeyO' && e.code !== 'KeyY') this.newRun();
      return;
    }
    if (this.state === 'over') {
      if ((e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') && this.overT > 0.8) this.newRun();
      return;
    }
    if (move) this.request({ type: 'move', dx: move[0], dy: move[1] }, e.repeat);
    else if (WAIT_KEYS.has(e.code)) this.request({ type: 'wait' }, e.repeat);
  }

  onPointer(e: PointerEvent): void {
    if (this.menus.isOpen) return;
    this.canvas.focus();
    const r = this.canvas.getBoundingClientRect();
    const wx = (e.clientX - r.left - this.view.ox) / this.view.scale;
    const wy = (e.clientY - r.top - this.view.oy) / this.view.scale;
    const inRect = (rect: { x: number; y: number; w: number; h: number }): boolean =>
      wx >= rect.x && wx <= rect.x + rect.w && wy >= rect.y && wy <= rect.y + rect.h;

    if (this.state === 'title') {
      if (inRect(TITLE_SETTINGS)) {
        this.openSettings();
        return;
      }
      if (this.save && inRect(TITLE_CONTINUE)) {
        this.resumeSave();
        return;
      }
      this.newRun();
      return;
    }
    if (this.state === 'over') {
      if (inRect(TITLE_SETTINGS)) {
        this.openSettings();
        return;
      }
      if (this.overT > 0.8) this.newRun();
      return;
    }
    const s = this.s;
    if (!s) return;
    // Tap to move: one step toward the tap along its dominant axis; tap yourself to wait.
    const dx = Math.floor(wx / T) - s.player.x;
    const dy = Math.floor((wy - TOP) / T) - s.player.y;
    if (!dx && !dy) this.request({ type: 'wait' });
    else if (Math.abs(dx) >= Math.abs(dy)) this.request({ type: 'move', dx: Math.sign(dx), dy: 0 });
    else this.request({ type: 'move', dx: 0, dy: Math.sign(dy) });
  }

  // Moves are rate-limited so a held key walks at a readable pace; one extra press is queued.
  request(action: Action, repeat = false): void {
    const now = performance.now();
    if (now - this.lastStep < STEP_MS) {
      if (!repeat) this.queued = action;
      return;
    }
    this.lastStep = now;
    this.perform(action);
  }

  pollPad(now: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i: number): boolean => !!b[i] && !this.padPrev[i];
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    let dir: Cell | null = null;
    if (b[12] || ay < -0.6) dir = [0, -1];
    else if (b[13] || ay > 0.6) dir = [0, 1];
    else if (b[14] || ax < -0.6) dir = [-1, 0];
    else if (b[15] || ax > 0.6) dir = [1, 0];
    if (this.state !== 'play') {
      if (edge(1) && this.save) this.resumeSave();
      else if ((edge(0) || edge(9)) && (this.state === 'title' || this.overT > 0.8)) this.newRun();
    } else if (edge(9)) {
      this.pause();
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

  perform(action: Action): boolean {
    const s = this.s;
    if (this.state !== 'play' || !s) return false;
    const passed = act(s, action);
    this.react(s.events, action);
    this.syncEnts(s.events.some((e) => e.type === 'floor'));
    if (s.over) {
      this.state = 'over';
      this.overT = 0;
      this.clearRunSave();
      if (s.score > this.best.score || s.depth > this.best.depth) {
        this.best = { score: Math.max(s.score, this.best.score), depth: Math.max(s.depth, this.best.depth) };
        saveBest(this.best);
      }
      this.menus.announce(`Run over on floor ${s.depth}`);
    } else {
      this.persistRun();
    }
    return passed;
  }

  react(events: RunEvent[], action: Action): void {
    const v = this.v;
    const s = this.s;
    if (!v || !s) return;
    const shake = this.settings.reducedMotion ? 0 : this.settings.shake;
    const flashes = this.settings.reducedMotion ? 0 : this.settings.flashes;
    const at = (x: number, y: number): Cell => [x * T + T / 2, TOP + y * T + T / 2];
    for (const ev of events) {
      switch (ev.type) {
        case 'move': this.sfx.step(); break;
        case 'bump':
          this.sfx.bump();
          if (action.type === 'move') {
            v.player.x += action.dx * 0.18;
            v.player.y += action.dy * 0.18;
          }
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
          this.burst(...at(ev.x, ev.y), 16, ev.kind === 'shade' ? '#3a3050' : ev.kind === 'moth' ? '#d8cfb8' : ev.kind === 'lurker' ? '#2a2230' : '#6e3324');
          break;
        case 'hurt':
          this.sfx.hurt();
          v.hurtFlash = 0.5 * flashes;
          v.shake = 7 * shake;
          this.floater(...at(s.player.x, s.player.y), `-${ev.dmg}`, COLORS.blood);
          break;
        case 'pickup':
          if (ev.kind === 'oil') { this.sfx.oil(); this.floater(...at(ev.x, ev.y), '+oil', COLORS.amber); }
          else if (ev.kind === 'bandage') { this.sfx.bandage(); this.floater(...at(ev.x, ev.y), '+2', COLORS.blood); }
          else { this.sfx.oil(); this.floater(...at(ev.x, ev.y), '+resin', COLORS.amber); }
          break;
        case 'alert': this.sfx.alert(); break;
        case 'dark': this.sfx.dark(); v.shake = 3 * shake; break;
        case 'floor': this.sfx.descend(); v.fade = 1; this.menus.announce(`Floor ${ev.depth}`); break;
        case 'die': this.sfx.die(); v.shake = 10 * shake; break;
      }
    }
  }

  syncEnts(snap: boolean): void {
    const v = this.v;
    const s = this.s;
    if (!v || !s) return;
    if (snap) {
      v.player.x = s.player.x;
      v.player.y = s.player.y;
      v.ents.clear();
    }
    const alive = new Set<number>();
    for (const e of s.enemies) {
      alive.add(e.id);
      if (!v.ents.has(e.id)) v.ents.set(e.id, { x: e.x, y: e.y, flash: 0 });
    }
    for (const id of v.ents.keys()) if (!alive.has(id)) v.ents.delete(id);
  }

  burst(x: number, y: number, n: number, color: string): void {
    if (!this.v) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      const life = 0.3 + Math.random() * 0.5;
      this.v.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: 2 + Math.random() * 2, color, drag: 5 });
    }
  }

  floater(x: number, y: number, textStr: string, color: string): void {
    if (!this.v) return;
    this.v.floaters.push({ x, y: y - 10, text: textStr, color, life: 0.8, max: 0.8 });
  }

  // ---------------------------------------------------------------- loop

  frame(now: number): void {
    const dt = Math.min((now - this.last) / 1000, 1 / 20);
    this.last = now;
    this.time += dt;
    if (!this.paused && !this.menus.isOpen) {
      this.pollPad(now);
      if (this.queued && now - this.lastStep >= STEP_MS) {
        const a = this.queued;
        this.queued = null;
        this.lastStep = now;
        this.perform(a);
      }
      if (this.state === 'over') this.overT += dt;
      if (this.v) this.tick(dt);
    }
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }

  tick(dt: number): void {
    const v = this.v;
    const s = this.s;
    if (!v || !s) return;
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

  render(): void {
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
      drawTitle(ctx, this.time, this.best, { seed: this.seed, saveLabel: this.saveLabel });
    } else {
      const v = this.v;
      const s = this.s;
      if (v && s) {
        ctx.save();
        if (v.shake > 0) ctx.translate((Math.random() - 0.5) * v.shake, (Math.random() - 0.5) * v.shake);
        drawWorld(ctx, s, v, this.time);
        ctx.restore();
        drawLog(ctx, s);
        drawHud(ctx, s, this.best);
        if (v.hurtFlash > 0) {
          ctx.fillStyle = `rgba(200,64,44,${v.hurtFlash * 0.25})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (v.fade > 0) {
          ctx.fillStyle = `rgba(0,0,0,${v.fade})`;
          ctx.fillRect(0, TOP, W, H - TOP);
        }
        if (this.state === 'over') drawOver(ctx, s, this.best, this.overT, this.seed);
      }
    }
    if (this.settings.muted) {
      ctx.fillStyle = 'rgba(232,220,196,0.5)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('muted', W - 10, H - 10);
    }
    ctx.restore();
  }
}

window.__wick = new Game(document.getElementById('game') as HTMLCanvasElement);
