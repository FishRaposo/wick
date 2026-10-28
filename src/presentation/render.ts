// Drawing only. Reads the rules state plus a small "view" of tweened positions and effects;
// never changes the rules state.

import { MAP_W, MAP_H, TILE, OIL } from '../core/config.ts';
import { idx } from '../core/grid.ts';
import { radius, isLit } from '../core/rules.ts';
import type { Best, Enemy, Item, RunState } from '../core/types.ts';

export const W = 960;
export const H = 540;
export const T = 24; // tile size in px
export const TOP = 36; // HUD band
const TAU = Math.PI * 2;

export const FONT = {
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

const C = {
  void: '#07070a',
  hud: '#0b0a0e',
  memFloor: '#111118',
  memWall: '#23242f',
  memWallTop: '#2c2e3b',
  amber: '#f2a541',
  ember: '#ffcf7a',
  blood: '#c8402c',
  text: '#e8dcc4',
  dim: '#7d7466',
} as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
}

export interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
}

export interface EntView {
  x: number;
  y: number;
  flash: number;
}

export interface View {
  player: { x: number; y: number };
  ents: Map<number, EntView>;
  particles: Particle[];
  floaters: Floater[];
  hurtFlash: number;
  shake: number;
  fade: number;
}

export interface TextOptions {
  size?: number;
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: string;
  style?: string;
  alpha?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TITLE_SETTINGS: Rect = { x: W - 118, y: 18, w: 96, h: 30 };
export const TITLE_CONTINUE: Rect = { x: W / 2 - 150, y: 498, w: 300, h: 28 };

export interface TitleUi {
  seed: number;
  saveLabel: string | null;
}

const mix = (a: readonly number[], b: readonly number[], t: number): number[] => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c: readonly number[]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const FLOOR_DARK = [22, 19, 24];
const FLOOR_LIT = [112, 84, 54];
const WALL_DARK = [34, 28, 34];
const WALL_LIT = [176, 136, 88];

// A fixed per-tile speck pattern so floors aren't flat.
const speck = new Float32Array(MAP_W * MAP_H).map((_, i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  { size = 14, font = FONT.mono, color = C.text, align = 'left', baseline = 'middle', weight = '', style = '', alpha = 1 }: TextOptions = {},
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${style} ${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawUiButton(ctx: CanvasRenderingContext2D, r: Rect, label: string, active = false): void {
  ctx.fillStyle = active ? '#1d1920' : 'rgba(18,16,22,0.85)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = active ? C.amber : 'rgba(125,102,72,0.6)';
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 12, align: 'center', color: active ? C.ember : C.dim });
}

export function drawWorld(ctx: CanvasRenderingContext2D, s: RunState, v: View, time: number): void {
  const r = radius(s);
  const flick = 0.04 * Math.sin(time * 9.1) + 0.03 * Math.sin(time * 23.7);
  const px = v.player.x;
  const py = v.player.y;

  ctx.fillStyle = C.void;
  ctx.fillRect(0, TOP, W, H - TOP);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      if (!s.seen[i]) continue;
      const t = s.tiles[i];
      const sx = x * T;
      const sy = TOP + y * T;
      if (s.visible[i]) {
        const d = Math.hypot(x - px, y - py) / (r + 0.6);
        const b = Math.max(0.12, Math.min(1, 1 - Math.pow(d, 1.5) + flick));
        if (t === TILE.WALL) {
          ctx.fillStyle = rgb(mix(WALL_DARK, WALL_LIT, b));
          ctx.fillRect(sx, sy, T, T);
          ctx.fillStyle = rgb(mix(WALL_DARK, WALL_LIT, b * 0.6));
          ctx.fillRect(sx, sy + T - 6, T, 6);
        } else {
          ctx.fillStyle = rgb(mix(FLOOR_DARK, FLOOR_LIT, b));
          ctx.fillRect(sx, sy, T, T);
          ctx.fillStyle = `rgba(0,0,0,${0.12 + speck[i] * 0.12})`;
          ctx.fillRect(sx + 4 + speck[i] * 12, sy + 6 + speck[(i + 7) % speck.length] * 10, 2, 2);
          if (t === TILE.STAIRS) drawStairs(ctx, sx, sy, b);
        }
      } else {
        // Remembered but dark: cool, flat, no detail.
        ctx.fillStyle = t === TILE.WALL ? C.memWall : C.memFloor;
        ctx.fillRect(sx, sy, T, T);
        if (t === TILE.WALL) {
          ctx.fillStyle = C.memWallTop;
          ctx.fillRect(sx, sy, T, 3);
        }
        if (t === TILE.STAIRS) drawStairs(ctx, sx, sy, 0.25);
      }
    }
  }

  for (const it of s.items) if (s.visible[idx(it.x, it.y)]) drawItem(ctx, it, time);

  for (const e of s.enemies) {
    const ev = v.ents.get(e.id) ?? { x: e.x, y: e.y, flash: 0 };
    if (s.visible[idx(e.x, e.y)]) drawEnemy(ctx, e, ev, time);
    else if (e.kind === 'shade' && s.seen[idx(e.x, e.y)] && Math.hypot(e.x - px, e.y - py) <= r + 3) drawShadeEyes(ctx, ev, time);
  }

  // Lantern glow: an additive radial wash over everything in the light.
  const gx = px * T + T / 2;
  const gy = TOP + py * T + T / 2;
  const gr = (r + 0.8 + flick * 6) * T;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
  g.addColorStop(0, `rgba(255,170,70,${s.player.oil > 0 ? 0.22 : 0.06})`);
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
  ctx.restore();

  drawPlayer(ctx, s, v, time);

  for (const p of v.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const f of v.floaters) {
    text(ctx, f.text, f.x, f.y - 18 * (1 - f.life / f.max), { size: 12, color: f.color, align: 'center', weight: 'bold', alpha: Math.min(1, (f.life / f.max) * 2) });
  }
}

function drawStairs(ctx: CanvasRenderingContext2D, sx: number, sy: number, b: number): void {
  ctx.fillStyle = `rgba(10,8,12,${0.55 + 0.35 * (1 - b)})`;
  ctx.fillRect(sx + 3, sy + 3, T - 6, T - 6);
  ctx.fillStyle = `rgba(232,220,196,${0.25 + 0.5 * b})`;
  for (let k = 0; k < 3; k++) ctx.fillRect(sx + 5 + k * 3, sy + 6 + k * 4, T - 10 - k * 6, 2);
}

function drawItem(ctx: CanvasRenderingContext2D, it: Item, time: number): void {
  const cx = it.x * T + T / 2;
  const cy = TOP + it.y * T + T / 2 + Math.sin(time * 3 + it.x) * 1.2;
  if (it.kind === 'oil') {
    ctx.fillStyle = C.amber;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 5, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - 2, cy - 7, 4, 4);
    ctx.fillStyle = 'rgba(255,230,170,0.7)';
    ctx.fillRect(cx - 3, cy, 2, 3);
  } else {
    ctx.fillStyle = '#efe6d4';
    ctx.fillRect(cx - 6, cy - 2, 12, 4);
    ctx.fillRect(cx - 2, cy - 6, 4, 12);
    ctx.fillStyle = C.blood;
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, ev: EntView, time: number): void {
  const cx = ev.x * T + T / 2;
  const cy = TOP + ev.y * T + T / 2;
  const flash = ev.flash > 0;
  ctx.save();
  ctx.translate(cx, cy);
  if (e.kind === 'moth') {
    const flap = Math.abs(Math.sin(time * 18 + e.id)) * 0.8 + 0.2;
    ctx.fillStyle = flash ? '#fff' : '#d8cfb8';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 5 * flap, -1, 5 * flap, 6, side * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#5a4c3a';
    ctx.fillRect(-1, -5, 2, 10);
  } else if (e.kind === 'shade') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = flash ? '#cfc6ff' : '#14101f';
    ctx.beginPath();
    ctx.moveTo(-9, 9);
    for (let k = 0; k <= 6; k++) ctx.lineTo(-9 + k * 3, 9 - (k % 2) * 3 - Math.sin(time * 6 + k) * 1.5);
    ctx.lineTo(9, -2);
    ctx.quadraticCurveTo(0, -16, -9, -2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4f1ff';
    ctx.fillRect(-4, -4, 2, 3);
    ctx.fillRect(2, -4, 2, 3);
  } else {
    ctx.fillStyle = flash ? '#fff' : '#6e3324';
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-6, -3);
    ctx.lineTo(4, -4);
    ctx.lineTo(10, -8);
    ctx.lineTo(10, 1);
    ctx.lineTo(6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(6, -5, 2, 2);
    if (e.target) text(ctx, '!', 0, -14, { size: 13, color: C.blood, align: 'center', weight: 'bold' });
  }
  ctx.restore();
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    for (let k = 0; k < e.maxHp; k++) {
      ctx.fillStyle = k < e.hp ? C.blood : 'rgba(255,255,255,0.15)';
      ctx.fillRect(cx - e.maxHp * 2.5 + k * 5, cy + 11, 4, 2);
    }
  }
}

function drawShadeEyes(ctx: CanvasRenderingContext2D, ev: EntView, time: number): void {
  const cx = ev.x * T + T / 2;
  const cy = TOP + ev.y * T + T / 2;
  const blink = Math.sin(time * 1.7 + ev.x * 3) > 0.92 ? 0.1 : 0.85;
  ctx.fillStyle = `rgba(244,241,255,${blink})`;
  ctx.fillRect(cx - 4, cy - 4, 2, 2);
  ctx.fillRect(cx + 2, cy - 4, 2, 2);
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: RunState, v: View, time: number): void {
  const cx = v.player.x * T + T / 2;
  const cy = TOP + v.player.y * T + T / 2;
  const alive = !s.over;
  ctx.save();
  if (v.hurtFlash > 0 && Math.floor(v.hurtFlash * 20) % 2 === 0) ctx.globalAlpha = 0.5;
  ctx.fillStyle = alive ? '#2a2230' : '#3b3540';
  ctx.beginPath();
  ctx.arc(cx, cy + 1, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e8dcc4';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 3.2, 0, TAU);
  ctx.fill();
  // The lantern, held to one side.
  const lit = s.player.oil > 0;
  ctx.fillStyle = lit ? C.ember : '#5a5048';
  ctx.fillRect(cx + 6, cy - 1 + Math.sin(time * 4) * 0.6, 4, 5);
  if (lit) {
    ctx.fillStyle = 'rgba(255,207,122,0.35)';
    ctx.beginPath();
    ctx.arc(cx + 8, cy + 1, 5 + Math.sin(time * 11) * 0.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, s: RunState, best: Best): void {
  ctx.fillStyle = C.hud;
  ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = 'rgba(242,165,65,0.18)';
  ctx.fillRect(0, TOP - 1, W, 1);

  for (let k = 0; k < s.player.maxHp; k++) {
    ctx.fillStyle = k < s.player.hp ? C.blood : '#2b2228';
    ctx.beginPath();
    ctx.arc(22 + k * 16, 18, 5, 0, TAU);
    ctx.fill();
  }

  const ox = 140;
  text(ctx, 'OIL', ox, 18, { size: 11, color: C.dim, weight: 'bold' });
  ctx.fillStyle = '#1d1a1f';
  ctx.fillRect(ox + 30, 12, 150, 12);
  const k = s.player.oil / OIL.max;
  const grad = ctx.createLinearGradient(ox + 30, 0, ox + 180, 0);
  grad.addColorStop(0, '#8a4b14');
  grad.addColorStop(1, C.amber);
  ctx.fillStyle = grad;
  ctx.fillRect(ox + 30, 12, 150 * k, 12);
  text(ctx, `${s.player.oil}`, ox + 188, 18, { size: 12, color: s.player.oil > 20 ? C.text : C.blood, weight: 'bold' });
  if (s.player.resin > 0) text(ctx, `RESIN ${s.player.resin}`, ox + 222, 18, { size: 11, color: C.amber });

  text(ctx, `FLOOR ${s.depth}`, W / 2, 18, { size: 13, align: 'center', weight: 'bold', color: C.text });

  const last = s.log[s.log.length - 1];
  if (last) text(ctx, last.text, W - 16, 18, { size: 12, align: 'right', color: s.turn - last.turn <= 1 ? C.text : C.dim, font: FONT.serif, style: 'italic' });
}

export function drawLog(ctx: CanvasRenderingContext2D, s: RunState): void {
  const lines = s.log.slice(-3, -1);
  lines.forEach((l, i) => {
    text(ctx, l.text, 12, H - 34 + i * 16, { size: 12, color: C.dim, font: FONT.serif, style: 'italic', alpha: 0.5 + i * 0.25 });
  });
}

export function drawTitle(ctx: CanvasRenderingContext2D, time: number, best: Best, ui: TitleUi): void {
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, W, H);
  const fx = W / 2;
  const fy = 170;
  const g = ctx.createRadialGradient(fx, fy, 4, fx, fy, 260);
  g.addColorStop(0, 'rgba(255,170,70,0.28)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // The flame.
  const sway = Math.sin(time * 5) * 2;
  ctx.fillStyle = C.ember;
  ctx.beginPath();
  ctx.moveTo(fx, fy - 34 + sway * 0.5);
  ctx.quadraticCurveTo(fx + 14 + sway, fy - 6, fx, fy + 8);
  ctx.quadraticCurveTo(fx - 14 + sway, fy - 6, fx, fy - 34 + sway * 0.5);
  ctx.fill();
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.ellipse(fx, fy - 2, 3.5, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2f2a';
  ctx.fillRect(fx - 1, fy + 6, 2, 10);

  text(ctx, 'W I C K', W / 2, 250, { size: 64, align: 'center', font: FONT.serif, weight: 'bold', color: C.text });
  text(ctx, 'the oil is the light. the light is the map.', W / 2, 296, { size: 17, align: 'center', font: FONT.serif, style: 'italic', color: C.dim });
  const rows: [string, string][] = [
    ['move', 'arrows · WASD · d-pad · tap'],
    ['wait', 'space · . · Z · pad A'],
    ['attack', 'walk into it'],
    ['mute', 'M'],
  ];
  rows.forEach(([k, v], i) => {
    text(ctx, k, W / 2 - 12, 346 + i * 22, { size: 12, align: 'right', color: C.dim });
    text(ctx, v, W / 2 + 12, 346 + i * 22, { size: 12, color: C.text });
  });
  text(ctx, 'press any key to descend  ·  O settings', W / 2, 452, { size: 15, align: 'center', font: FONT.serif, style: 'italic', color: C.amber, alpha: 0.55 + 0.45 * Math.sin(time * 3) });
  drawUiButton(ctx, TITLE_SETTINGS, 'settings');
  if (ui.saveLabel) drawUiButton(ctx, TITLE_CONTINUE, ui.saveLabel, true);
  text(ctx, `seed ${ui.seed}`, 16, H - 14, { size: 11, color: C.dim, align: 'left' });
  if (best.depth > 0) text(ctx, `deepest: floor ${best.depth}  ·  best score ${best.score}`, W - 16, H - 14, { size: 11, align: 'right', color: C.dim });
}

export function drawOver(ctx: CanvasRenderingContext2D, s: RunState, best: Best, t: number, seed: number): void {
  ctx.save();
  ctx.globalAlpha = Math.min(1, t * 2) * 0.82;
  ctx.fillStyle = '#050407';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const a = Math.min(1, t * 2);
  drawUiButton(ctx, TITLE_SETTINGS, 'settings');
  text(ctx, 'the wick burns out.', W / 2, 190, { size: 34, align: 'center', font: FONT.serif, style: 'italic', alpha: a });
  text(ctx, `floor ${s.depth}`, W / 2, 250, { size: 40, align: 'center', weight: 'bold', alpha: a, color: C.amber });
  const rows: [string, number][] = [['score', s.score], ['kills', s.kills], ['turns', s.turn]];
  rows.forEach(([k, v], i) => {
    text(ctx, k, W / 2 - 10, 300 + i * 20, { size: 12, align: 'right', color: C.dim, alpha: a });
    text(ctx, `${v}`, W / 2 + 10, 300 + i * 20, { size: 12, alpha: a });
  });
  if (s.score >= best.score && s.score > 0) text(ctx, 'best run yet', W / 2, 372, { size: 12, align: 'center', color: C.amber, weight: 'bold', alpha: a });
  text(ctx, 'R or click to light another  ·  Y copy seed', W / 2, 420, { size: 13, align: 'center', alpha: t > 0.8 ? 1 : 0.3 });
  text(ctx, `seed ${seed}`, 16, H - 14, { size: 11, color: C.dim, align: 'left' });
}

export { C as COLORS, isLit };
