// The whole game, as data and rules. No DOM, no timers, no rendering: a run is a state object and
// `act(state, action)` advances it by one player turn. The browser layer reads `state.events`
// after each turn to animate and play sound; tests call the same functions directly.
// Enemy and item behaviour comes from the content registry, so adding content never edits this file.

import { MAP_W, MAP_H, TILE, PLAYER, OIL, NOISE, lightRadius } from './config.ts';
import { Rng } from './rng.ts';
import { idx, walkable, parseMap, DIRS4 } from './grid.ts';
import { generateFloor } from './gen.ts';
import { computeFov } from './fov.ts';
import { distanceMap, fleeMap, downhill } from './path.ts';
import type { Action, Cell, Enemy, EnemyContext, EnemyKind, Floor, GameContent, Item, RunState } from './types.ts';

const N = MAP_W * MAP_H;

export function createRun(seed: number, { generate = true, content }: { generate?: boolean; content: GameContent }): RunState {
  const s: RunState = {
    seed,
    rng: new Rng(seed),
    content,
    depth: 0,
    tiles: new Uint8Array(N),
    stairs: { x: -1, y: -1 },
    player: { x: 0, y: 0, hp: PLAYER.hp, maxHp: PLAYER.hp, oil: PLAYER.oil, resin: 0 },
    enemies: [],
    items: [],
    seen: new Uint8Array(N),
    visible: new Uint8Array(N),
    turn: 0,
    kills: 0,
    score: 0,
    noise: null,
    over: false,
    log: [],
    events: [],
    nextId: 1,
  };
  if (generate) enterFloor(s, 1);
  return s;
}

export function makeEnemy(s: RunState, kind: EnemyKind, x: number, y: number): Enemy {
  const d = s.content.enemies[kind];
  return { id: s.nextId++, kind, x, y, hp: d.hp, maxHp: d.hp, target: null };
}

export function enterFloor(s: RunState, depth: number, floor: Floor = generateFloor(depth, s.rng, s.content)): void {
  s.depth = depth;
  s.tiles = floor.tiles;
  s.stairs = floor.stairs;
  s.player.x = floor.start.x;
  s.player.y = floor.start.y;
  s.items = floor.items.map((i) => ({ ...i }));
  s.enemies = floor.spawns.map((sp) => makeEnemy(s, sp.kind, sp.x, sp.y));
  s.seen.fill(0);
  s.noise = null;
  updateVision(s);
  s.events.push({ type: 'floor', depth });
  say(s, depth === 1 ? 'The stair door shuts behind you. Find the way down.' : `Floor ${depth}. The dark is deeper here.`);
}

// Load a hand-written map (tests and the harness). Marks: @ player, m moth, s shade, h hound,
// o oil flask, + bandage, r resin, > stairs, # wall, . floor.
export function loadMap(s: RunState, rows: string[], { depth = 1 }: { depth?: number } = {}): RunState {
  const { tiles, marks } = parseMap(rows);
  const floor: Floor = {
    depth,
    theme: 'test',
    tiles,
    rooms: [],
    start: { x: 1, y: 1 },
    stairs: { x: -1, y: -1 },
    items: [],
    spawns: [],
  };
  const kinds: Record<string, EnemyKind> = { m: 'moth', s: 'shade', h: 'hound', l: 'lurker' };
  for (const { c, x, y } of marks) {
    if (c === '@') floor.start = { x, y };
    else if (kinds[c]) floor.spawns.push({ kind: kinds[c], x, y });
    else if (c === 'o') floor.items.push({ kind: 'oil', x, y });
    else if (c === '+') floor.items.push({ kind: 'bandage', x, y });
    else if (c === 'r') floor.items.push({ kind: 'resin', x, y });
  }
  rows.forEach((row, y) => {
    const x = row.indexOf('>');
    if (x >= 0) floor.stairs = { x, y };
  });
  s.events.length = 0;
  s.log.length = 0;
  enterFloor(s, depth, floor);
  s.events.length = 0;
  return s;
}

export const radius = (s: RunState): number => lightRadius(s.player.oil, s.player.resin > 0 ? 2 : 0);

export function updateVision(s: RunState): void {
  computeFov(s.tiles, s.player.x, s.player.y, radius(s), s.visible);
  for (let i = 0; i < N; i++) if (s.visible[i]) s.seen[i] = 1;
}

// Is (x, y) lit, within `margin` tiles of the light's edge excluded? Same circle test as the FOV.
export function isLit(s: RunState, x: number, y: number, margin = 0): boolean {
  const r = radius(s) - margin;
  if (r <= 0 || !s.visible[idx(x, y)]) return false;
  const dx = x - s.player.x;
  const dy = y - s.player.y;
  return dx * dx + dy * dy <= r * r + r;
}

export const enemyAt = (s: RunState, x: number, y: number): Enemy | undefined =>
  s.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
const itemAt = (s: RunState, x: number, y: number): Item | undefined => s.items.find((i) => i.x === x && i.y === y);

function say(s: RunState, text: string): void {
  s.log.push({ text, turn: s.turn });
  if (s.log.length > 8) s.log.shift();
}

// ------------------------------------------------------------------ the player's turn

// action: { type: 'move', dx, dy } | { type: 'wait' }. Returns true if a turn passed.
export function act(s: RunState, action: Action): boolean {
  if (s.over) return false;
  s.events.length = 0;
  const p = s.player;

  if (action.type === 'move') {
    const nx = p.x + action.dx;
    const ny = p.y + action.dy;
    const target = enemyAt(s, nx, ny);
    if (target) {
      strike(s, target);
      s.noise = { x: p.x, y: p.y, r: NOISE.attack };
    } else if (!walkable(s.tiles, nx, ny)) {
      s.events.push({ type: 'bump', x: nx, y: ny });
      return false; // walking into a wall is free: no oil, no enemy turn
    } else {
      const from = { x: p.x, y: p.y };
      p.x = nx;
      p.y = ny;
      s.events.push({ type: 'move', from, to: { x: nx, y: ny } });
      s.noise = { x: nx, y: ny, r: NOISE.move };
      pickUp(s);
      if (s.tiles[idx(nx, ny)] === TILE.STAIRS) {
        s.turn += 1;
        s.score += 100;
        enterFloor(s, s.depth + 1);
        return true;
      }
    }
  } else if (action.type === 'wait') {
    s.noise = null;
    s.events.push({ type: 'wait' });
  } else {
    return false;
  }

  endTurn(s);
  return true;
}

function pickUp(s: RunState): void {
  const p = s.player;
  const item = itemAt(s, p.x, p.y);
  if (!item) return;
  s.items.splice(s.items.indexOf(item), 1);
  s.content.items[item.kind].apply({ state: s, player: p, item, say: (text) => say(s, text) });
  s.events.push({ type: 'pickup', kind: item.kind, x: p.x, y: p.y });
}

function strike(s: RunState, e: Enemy): void {
  e.hp -= 1;
  s.events.push({ type: 'hit', id: e.id, x: e.x, y: e.y });
  if (e.hp > 0) return;
  s.kills += 1;
  s.score += s.content.enemies[e.kind].points;
  s.events.push({ type: 'kill', id: e.id, kind: e.kind, x: e.x, y: e.y });
  const death: Record<EnemyKind, string> = {
    moth: 'The moth crumples into ash.',
    shade: 'The shade comes apart like smoke.',
    hound: 'The hound goes still.',
    lurker: 'The lurker folds back into the dark.',
  };
  say(s, death[e.kind]);
}

function endTurn(s: RunState): void {
  const p = s.player;
  s.turn += 1;
  if (p.resin > 0) {
    p.resin -= 1;
    if (p.resin === 0) say(s, 'The resin burns away.');
  }
  if (s.turn % OIL.burnEvery === 0 && p.oil > 0) {
    p.oil -= 1;
    if (p.oil === 0) {
      say(s, 'The lantern gutters out.');
      s.events.push({ type: 'dark' });
    }
  }
  updateVision(s);
  enemiesAct(s);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  s.noise = null;
}

// ------------------------------------------------------------------ enemies

function enemiesAct(s: RunState): void {
  const p = s.player;
  const toPlayer = distanceMap(s.tiles, [[p.x, p.y]]);
  let flee: Float32Array | null = null; // built lazily: only shades need it
  const getFlee = (): Float32Array => (flee ??= fleeMap(s.tiles, toPlayer));
  const noise = s.noise;
  const heard = noise ? distanceMap(s.tiles, [[noise.x, noise.y]]) : null;
  const freeFn = free(s);

  for (const e of s.enemies) {
    if (e.hp <= 0 || s.over) continue;
    const ctx: EnemyContext = {
      state: s,
      enemy: e,
      player: p,
      toPlayer,
      heard,
      noise,
      free: freeFn,
      step: (enemy, to) => step(s, enemy, to),
      bite: (enemy) => bite(s, enemy),
      wander: (enemy, allowed) => wander(s, enemy, allowed),
      isLit: (x, y, margin = 0) => isLit(s, x, y, margin),
      radius: radius(s),
      getFlee,
    };
    s.content.enemies[e.kind].act(ctx);
  }
}

const free = (s: RunState) => (x: number, y: number): boolean =>
  !(x === s.player.x && y === s.player.y) && !enemyAt(s, x, y);

function step(s: RunState, e: Enemy, to: Cell | null): void {
  if (!to) return;
  s.events.push({ type: 'emove', id: e.id, from: { x: e.x, y: e.y }, to: { x: to[0], y: to[1] } });
  e.x = to[0];
  e.y = to[1];
}

function wander(s: RunState, e: Enemy, allowed: (x: number, y: number) => boolean = () => true): void {
  const options: Cell[] = DIRS4
    .map(([dx, dy]): Cell => [e.x + dx, e.y + dy])
    .filter(([x, y]) => walkable(s.tiles, x, y) && free(s)(x, y) && allowed(x, y));
  if (options.length) step(s, e, s.rng.pick(options));
}

function bite(s: RunState, e: Enemy): void {
  const p = s.player;
  const dmg = s.content.enemies[e.kind].dmg;
  p.hp = Math.max(0, p.hp - dmg);
  s.events.push({ type: 'hurt', id: e.id, kind: e.kind, dmg, x: e.x, y: e.y });
  const lines: Record<EnemyKind, string> = {
    moth: 'A moth singes you.',
    shade: 'A shade reaches out of the dark. Cold.',
    hound: 'The hound bites.',
    lurker: 'Something in the dark takes a bite.',
  };
  say(s, lines[e.kind]);
  if (p.hp <= 0) {
    s.over = true;
    s.events.push({ type: 'die' });
    say(s, 'The wick burns out.');
  }
}
