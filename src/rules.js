// The whole game, as data and rules. No DOM, no timers, no rendering: a run is a state object and
// `act(state, action)` advances it by one player turn. The browser layer reads `state.events`
// after each turn to animate and play sound; tests call the same functions directly.

import { MAP_W, MAP_H, TILE, PLAYER, OIL, ENEMY, NOISE, lightRadius, SHADE_FEAR_MARGIN, MOTH_SIGHT_BONUS, SHADE_HUNT_RANGE } from './config.js';
import { Rng } from './rng.js';
import { idx, walkable, parseMap, DIRS4 } from './grid.js';
import { generateFloor } from './gen.js';
import { computeFov } from './fov.js';
import { distanceMap, fleeMap, downhill } from './path.js';

const N = MAP_W * MAP_H;

export function createRun(seed, { generate = true } = {}) {
  const s = {
    seed,
    rng: new Rng(seed),
    depth: 0,
    tiles: new Uint8Array(N),
    stairs: null,
    player: { x: 0, y: 0, hp: PLAYER.hp, maxHp: PLAYER.hp, oil: PLAYER.oil },
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

export function makeEnemy(s, kind, x, y) {
  const d = ENEMY[kind];
  return { id: s.nextId++, kind, x, y, hp: d.hp, maxHp: d.hp, target: null };
}

export function enterFloor(s, depth, floor = generateFloor(depth, s.rng)) {
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
// o oil flask, + bandage, > stairs, # wall, . floor.
export function loadMap(s, rows, { depth = 1 } = {}) {
  const { tiles, marks } = parseMap(rows);
  const floor = { depth, tiles, start: { x: 1, y: 1 }, stairs: null, items: [], spawns: [] };
  const kinds = { m: 'moth', s: 'shade', h: 'hound' };
  for (const { c, x, y } of marks) {
    if (c === '@') floor.start = { x, y };
    else if (kinds[c]) floor.spawns.push({ kind: kinds[c], x, y });
    else if (c === 'o') floor.items.push({ kind: 'oil', x, y });
    else if (c === '+') floor.items.push({ kind: 'bandage', x, y });
  }
  rows.forEach((row, y) => { const x = row.indexOf('>'); if (x >= 0) floor.stairs = { x, y }; });
  s.events.length = 0;
  s.log.length = 0;
  enterFloor(s, depth, floor);
  s.events.length = 0;
  return s;
}

export const radius = (s) => lightRadius(s.player.oil);

export function updateVision(s) {
  computeFov(s.tiles, s.player.x, s.player.y, radius(s), s.visible);
  for (let i = 0; i < N; i++) if (s.visible[i]) s.seen[i] = 1;
}

// Is (x, y) lit, within `margin` tiles of the light's edge excluded? Same circle test as the FOV.
export function isLit(s, x, y, margin = 0) {
  const r = radius(s) - margin;
  if (r <= 0 || !s.visible[idx(x, y)]) return false;
  const dx = x - s.player.x;
  const dy = y - s.player.y;
  return dx * dx + dy * dy <= r * r + r;
}

export const enemyAt = (s, x, y) => s.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);
const itemAt = (s, x, y) => s.items.find((i) => i.x === x && i.y === y);

function say(s, text) {
  s.log.push({ text, turn: s.turn });
  if (s.log.length > 8) s.log.shift();
}

// ------------------------------------------------------------------ the player's turn

// action: { type: 'move', dx, dy } | { type: 'wait' }. Returns true if a turn passed.
export function act(s, action) {
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

function pickUp(s) {
  const p = s.player;
  const item = itemAt(s, p.x, p.y);
  if (!item) return;
  s.items.splice(s.items.indexOf(item), 1);
  if (item.kind === 'oil') {
    const before = p.oil;
    p.oil = Math.min(OIL.max, p.oil + OIL.flask);
    say(s, before === 0 ? 'Oil. The wick catches again.' : 'You top up the lantern.');
  } else if (item.kind === 'bandage') {
    p.hp = Math.min(p.maxHp, p.hp + 2);
    say(s, 'You bind your wounds.');
  }
  s.events.push({ type: 'pickup', kind: item.kind, x: p.x, y: p.y });
}

function strike(s, e) {
  e.hp -= 1;
  s.events.push({ type: 'hit', id: e.id, x: e.x, y: e.y });
  if (e.hp > 0) return;
  s.kills += 1;
  s.score += ENEMY[e.kind].points;
  s.events.push({ type: 'kill', id: e.id, kind: e.kind, x: e.x, y: e.y });
  say(s, { moth: 'The moth crumples into ash.', shade: 'The shade comes apart like smoke.', hound: 'The hound goes still.' }[e.kind]);
}

function endTurn(s) {
  const p = s.player;
  s.turn += 1;
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

function enemiesAct(s) {
  const p = s.player;
  const toPlayer = distanceMap(s.tiles, [[p.x, p.y]]);
  let flee = null; // built lazily: only shades need it
  const heard = s.noise ? distanceMap(s.tiles, [[s.noise.x, s.noise.y]]) : null;

  for (const e of s.enemies) {
    if (e.hp <= 0 || s.over) continue;
    const adjacent = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1;
    const d = toPlayer[idx(e.x, e.y)];

    if (e.kind === 'moth') {
      // Moths fly at a burning lantern they can see from a little beyond its glow, erratically.
      const drawn = p.oil > 0 && d >= 0 && d <= radius(s) + MOTH_SIGHT_BONUS;
      if (adjacent) bite(s, e);
      else if (drawn && !s.rng.chance(0.25)) step(s, e, downhill(toPlayer, s.tiles, e.x, e.y, free(s)));
      else if (s.rng.chance(drawn ? 1 : 0.5)) wander(s, e);
    } else if (e.kind === 'shade') {
      // Shades can't stand the bright core of the light. They flee it, stalk just outside it,
      // and only reach you once the lantern is dry.
      if (isLit(s, e.x, e.y, SHADE_FEAR_MARGIN)) {
        flee ??= fleeMap(s.tiles, toPlayer);
        step(s, e, downhill(flee, s.tiles, e.x, e.y, free(s)));
      } else if (adjacent) {
        bite(s, e);
      } else if (d >= 0 && d <= SHADE_HUNT_RANGE) {
        const next = downhill(toPlayer, s.tiles, e.x, e.y, free(s));
        if (next && !isLit(s, next[0], next[1], SHADE_FEAR_MARGIN)) step(s, e, next);
      } else if (s.rng.chance(0.3)) {
        wander(s, e);
      }
    } else if (e.kind === 'hound') {
      // Hounds hunt by sound. A noise reaches a hound if it's within the noise's range measured
      // along the corridors, not through rock. They go to where they heard it, then sniff around.
      if (heard) {
        const hd = heard[idx(e.x, e.y)];
        if (hd >= 0 && hd <= s.noise.r) {
          if (!e.target) s.events.push({ type: 'alert', id: e.id, x: e.x, y: e.y });
          e.target = { x: s.noise.x, y: s.noise.y };
        }
      }
      if (adjacent) bite(s, e);
      else if (e.target) {
        if (e.x === e.target.x && e.y === e.target.y) e.target = null;
        else step(s, e, downhill(distanceMap(s.tiles, [[e.target.x, e.target.y]]), s.tiles, e.x, e.y, free(s)));
      } else if (s.rng.chance(0.2)) {
        wander(s, e);
      }
    }
  }
}

const free = (s) => (x, y) => !(x === s.player.x && y === s.player.y) && !enemyAt(s, x, y);

function step(s, e, to) {
  if (!to) return;
  s.events.push({ type: 'emove', id: e.id, from: { x: e.x, y: e.y }, to: { x: to[0], y: to[1] } });
  e.x = to[0];
  e.y = to[1];
}

function wander(s, e) {
  const options = DIRS4.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => walkable(s.tiles, x, y) && free(s)(x, y));
  if (options.length) step(s, e, s.rng.pick(options));
}

function bite(s, e) {
  const p = s.player;
  const dmg = ENEMY[e.kind].dmg;
  p.hp = Math.max(0, p.hp - dmg);
  s.events.push({ type: 'hurt', id: e.id, kind: e.kind, dmg, x: e.x, y: e.y });
  say(s, { moth: 'A moth singes you.', shade: 'A shade reaches out of the dark. Cold.', hound: 'The hound bites.' }[e.kind]);
  if (p.hp <= 0) {
    s.over = true;
    s.events.push({ type: 'die' });
    say(s, 'The wick burns out.');
  }
}
