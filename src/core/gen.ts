import { MAP_W, MAP_H, TILE } from './config.ts';
import { idx } from './grid.ts';
import { distanceMap } from './path.ts';
import type { Cell, EnemyKind, Floor, GameContent, Item, ItemKind, Room, Spawn } from './types.ts';
import type { Rng } from './rng.ts';

// Floor generation: rooms placed by rejection sampling, joined left to right by L-shaped
// corridors (so every room is reachable), plus one or two extra corridors between random rooms
// so the map has loops: loops are what make fleeing and flanking AI interesting.
// The stairs go on the floor tile farthest (by walking distance) from the start.
// Depth bands, enemy mixes and item tables come from the content registry.

const center = (r: Room): Cell => [r.x + (r.w >> 1), r.y + (r.h >> 1)];

function overlaps(a: Room, b: Room, margin: number): boolean {
  return a.x - margin < b.x + b.w && b.x - margin < a.x + a.w && a.y - margin < b.y + b.h && b.y - margin < a.y + a.h;
}

function carve(tiles: Uint8Array, x: number, y: number): void {
  if (x > 0 && y > 0 && x < MAP_W - 1 && y < MAP_H - 1) tiles[idx(x, y)] = TILE.FLOOR;
}

function corridor(tiles: Uint8Array, a: Room, b: Room, rng: Rng): void {
  const [x1, y1] = center(a);
  const [x2, y2] = center(b);
  const horizontal = (y: number, xa: number, xb: number): void => { for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) carve(tiles, x, y); };
  const vertical = (x: number, ya: number, yb: number): void => { for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) carve(tiles, x, y); };
  if (rng.chance(0.5)) {
    horizontal(y1, x1, x2);
    vertical(x2, y1, y2);
  } else {
    vertical(x1, y1, y2);
    horizontal(y2, x1, x2);
  }
}

function floorTiles(tiles: Uint8Array): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (tiles[idx(x, y)] === TILE.FLOOR) out.push([x, y]);
  return out;
}

export function enemyBudget(depth: number): number {
  return 4 + Math.floor(depth * 2.5);
}

function themeFor(content: GameContent, depth: number) {
  return [...content.depths].sort((a, b) => b.from - a.from).find((t) => depth >= t.from) ?? content.depths[0];
}

function weightedEnemy(rng: Rng, kinds: EnemyKind[], theme: ReturnType<typeof themeFor>): EnemyKind {
  const weight = (k: EnemyKind): number => Math.max(0, theme.enemyWeights[k] ?? 1);
  const total = kinds.reduce((sum, k) => sum + weight(k), 0);
  let roll = rng.float(0, total);
  for (const k of kinds) {
    roll -= weight(k);
    if (roll <= 0) return k;
  }
  return kinds[kinds.length - 1];
}

export function generateFloor(depth: number, rng: Rng, content: GameContent): Floor {
  const theme = themeFor(content, depth);
  const tiles = new Uint8Array(MAP_W * MAP_H); // all walls
  const rooms: Room[] = [];
  for (let tries = 0; tries < 120 && rooms.length < 10; tries++) {
    const w = rng.int(4, 9);
    const h = rng.int(3, 6);
    const r: Room = { x: rng.int(1, MAP_W - w - 1), y: rng.int(1, MAP_H - h - 1), w, h };
    if (rooms.some((o) => overlaps(r, o, 1))) continue;
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(tiles, x, y);
  }

  const ordered = [...rooms].sort((a, b) => center(a)[0] - center(b)[0]);
  for (let i = 1; i < ordered.length; i++) corridor(tiles, ordered[i - 1], ordered[i], rng);
  for (let i = 0; i < theme.loops && rooms.length > 3; i++) {
    const a = rng.pick(rooms);
    let b = rng.pick(rooms);
    if (a === b) b = rooms[(rooms.indexOf(a) + 2) % rooms.length];
    corridor(tiles, a, b, rng);
  }

  const startRoom = rng.pick(rooms);
  const [sx, sy] = center(startRoom);
  const dist = distanceMap(tiles, [[sx, sy]]);

  // Stairs: the reachable tile farthest from the start (ties broken by scan order).
  let stairs: Cell = [sx, sy];
  let far = -1;
  for (const [x, y] of floorTiles(tiles)) {
    const d = dist[idx(x, y)];
    if (d > far) {
      far = d;
      stairs = [x, y];
    }
  }
  tiles[idx(stairs[0], stairs[1])] = TILE.STAIRS;

  const taken = new Set<number>([idx(sx, sy), idx(stairs[0], stairs[1])]);
  const candidates = floorTiles(tiles);
  const place = (minDist: number): Cell | null => {
    const pool = candidates.filter(([x, y]) => !taken.has(idx(x, y)) && dist[idx(x, y)] >= minDist);
    if (!pool.length) return null;
    const spot = rng.pick(pool);
    taken.add(idx(spot[0], spot[1]));
    return spot;
  };

  const itemPool: ItemKind[] = [];
  for (const kind of Object.keys(content.items) as ItemKind[]) {
    const weight = Math.max(0, Math.round(theme.itemWeights[kind] ?? 0));
    for (let i = 0; i < weight; i++) itemPool.push(kind);
  }
  const items: Item[] = [];
  const itemCount = rng.int(3, 4) + (depth >= 3 ? 1 : 0);
  for (let i = 0; i < itemCount; i++) {
    const s = place(3);
    if (!s) break;
    const kind = itemPool.length ? rng.pick(itemPool) : 'oil';
    items.push({ kind, x: s[0], y: s[1] });
  }

  const kinds = (Object.keys(content.enemies) as EnemyKind[]).filter((k) => depth >= content.enemies[k].unlock);
  const spawns: Spawn[] = [];
  let budget = enemyBudget(depth);
  // A newly unlocked enemy shows up on its debut floor.
  const debut = kinds.find((k) => content.enemies[k].unlock === depth);
  const queue: EnemyKind[] = debut ? [debut] : [];
  if (debut) budget -= content.enemies[debut].cost;
  for (;;) {
    const affordable = kinds.filter((k) => content.enemies[k].cost <= budget && (theme.enemyWeights[k] ?? 1) > 0);
    if (!affordable.length) break;
    queue.push(weightedEnemy(rng, affordable, theme));
    budget -= content.enemies[queue[queue.length - 1]].cost;
  }
  for (const kind of queue) {
    const s = place(8) ?? place(5);
    if (s) spawns.push({ kind, x: s[0], y: s[1] });
  }

  return { depth, theme: theme.name, tiles, rooms, start: { x: sx, y: sy }, stairs: { x: stairs[0], y: stairs[1] }, items, spawns };
}
