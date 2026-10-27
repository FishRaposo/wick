import { MAP_W, MAP_H, TILE, ENEMY } from './config.js';
import { idx } from './grid.js';
import { distanceMap } from './path.js';

// Floor generation: rooms placed by rejection sampling, joined left to right by L-shaped
// corridors (so every room is reachable), plus one or two extra corridors between random rooms
// so the map has loops: loops are what make fleeing and flanking AI interesting.
// The stairs go on the floor tile farthest (by walking distance) from the start.

const center = (r) => [r.x + (r.w >> 1), r.y + (r.h >> 1)];

function overlaps(a, b, margin) {
  return a.x - margin < b.x + b.w && b.x - margin < a.x + a.w && a.y - margin < b.y + b.h && b.y - margin < a.y + a.h;
}

function carve(tiles, x, y) {
  if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) tiles[idx(x, y)] = TILE.FLOOR;
}

function corridor(tiles, a, b, rng) {
  const [x1, y1] = center(a);
  const [x2, y2] = center(b);
  const horizontal = (y, xa, xb) => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) carve(tiles, x, y); };
  const vertical = (x, ya, yb) => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) carve(tiles, x, y); };
  if (rng.chance(0.5)) {
    horizontal(y1, x1, x2);
    vertical(x2, y1, y2);
  } else {
    vertical(x1, y1, y2);
    horizontal(y2, x1, x2);
  }
}

function floorTiles(tiles) {
  const out = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (tiles[idx(x, y)] === TILE.FLOOR) out.push([x, y]);
  return out;
}

export function enemyBudget(depth) {
  return 4 + Math.floor(depth * 2.5);
}

export function generateFloor(depth, rng) {
  const tiles = new Uint8Array(MAP_W * MAP_H); // all walls
  const rooms = [];
  for (let tries = 0; tries < 120 && rooms.length < 10; tries++) {
    const w = rng.int(4, 9);
    const h = rng.int(3, 6);
    const r = { x: rng.int(1, MAP_W - w - 1), y: rng.int(1, MAP_H - h - 1), w, h };
    if (rooms.some((o) => overlaps(r, o, 1))) continue;
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(tiles, x, y);
  }

  const ordered = [...rooms].sort((a, b) => center(a)[0] - center(b)[0]);
  for (let i = 1; i < ordered.length; i++) corridor(tiles, ordered[i - 1], ordered[i], rng);
  const loops = rng.int(1, 2);
  for (let i = 0; i < loops && rooms.length > 3; i++) {
    const a = rng.pick(rooms);
    let b = rng.pick(rooms);
    if (a === b) b = rooms[(rooms.indexOf(a) + 2) % rooms.length];
    corridor(tiles, a, b, rng);
  }

  const startRoom = rng.pick(rooms);
  const [sx, sy] = center(startRoom);
  const dist = distanceMap(tiles, [[sx, sy]]);

  // Stairs: the reachable tile farthest from the start (ties broken by scan order).
  let stairs = [sx, sy];
  let far = -1;
  for (const [x, y] of floorTiles(tiles)) {
    const d = dist[idx(x, y)];
    if (d > far) {
      far = d;
      stairs = [x, y];
    }
  }
  tiles[idx(stairs[0], stairs[1])] = TILE.STAIRS;

  const taken = new Set([idx(sx, sy), idx(stairs[0], stairs[1])]);
  const candidates = floorTiles(tiles);
  const place = (minDist) => {
    const pool = candidates.filter(([x, y]) => !taken.has(idx(x, y)) && dist[idx(x, y)] >= minDist);
    if (!pool.length) return null;
    const spot = rng.pick(pool);
    taken.add(idx(spot[0], spot[1]));
    return spot;
  };

  const items = [];
  const flasks = rng.int(2, 3) + (depth >= 3 ? 1 : 0);
  const bandages = (rng.chance(0.6) ? 1 : 0) + (depth >= 4 && rng.chance(0.5) ? 1 : 0);
  for (let i = 0; i < flasks; i++) { const s = place(3); if (s) items.push({ kind: 'oil', x: s[0], y: s[1] }); }
  for (let i = 0; i < bandages; i++) { const s = place(3); if (s) items.push({ kind: 'bandage', x: s[0], y: s[1] }); }

  const kinds = Object.keys(ENEMY).filter((k) => depth >= ENEMY[k].unlock);
  const spawns = [];
  let budget = enemyBudget(depth);
  // A newly unlocked enemy shows up on its debut floor.
  const debut = kinds.find((k) => ENEMY[k].unlock === depth);
  const queue = debut ? [debut] : [];
  if (debut) budget -= ENEMY[debut].cost;
  for (;;) {
    const affordable = kinds.filter((k) => ENEMY[k].cost <= budget);
    if (!affordable.length) break;
    queue.push(rng.pick(affordable));
    budget -= ENEMY[queue[queue.length - 1]].cost;
  }
  for (const kind of queue) {
    const s = place(8) || place(5);
    if (s) spawns.push({ kind, x: s[0], y: s[1] });
  }

  return { depth, tiles, rooms, start: { x: sx, y: sy }, stairs: { x: stairs[0], y: stairs[1] }, items, spawns };
}
