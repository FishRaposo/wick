import { MAP_W, MAP_H } from './config.js';
import { DIRS4, idx, walkable } from './grid.js';

const N = MAP_W * MAP_H;

// Breadth-first distance from one or more sources over walkable tiles (4-directional).
// -1 means unreachable. This is the "Dijkstra map" the AI reads: step to the neighbor with the lowest value.
export function distanceMap(tiles, sources) {
  const dist = new Int16Array(N).fill(-1);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (const [x, y] of sources) {
    if (!walkable(tiles, x, y)) continue;
    const i = idx(x, y);
    if (dist[i] === 0) continue;
    dist[i] = 0;
    queue[tail++] = i;
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % MAP_W;
    const y = (i / MAP_W) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!walkable(tiles, nx, ny)) continue;
      const j = idx(nx, ny);
      if (dist[j] !== -1) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

// Flee map (the Brogue technique): negate and scale the distance-to-player map, then relax it so
// every tile is at most 1 above its lowest neighbor. Walking downhill on it leads away from the
// player while preferring open space over dead ends, because a far corner's low value pulls harder
// than the nearest wall.
export function fleeMap(tiles, playerDist) {
  const f = new Float32Array(N).fill(Infinity);
  for (let i = 0; i < N; i++) if (playerDist[i] >= 0) f[i] = -1.2 * playerDist[i];
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < N; i++) {
      if (f[i] === Infinity) continue;
      const x = i % MAP_W;
      const y = (i / MAP_W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!walkable(tiles, nx, ny)) continue;
        const v = f[idx(nx, ny)] + 1;
        if (v < f[i] - 1e-6) {
          f[i] = v;
          changed = true;
        }
      }
    }
  }
  return f;
}

// The best step downhill from (x, y) on `map`, among tiles `free(nx, ny)` allows.
// Returns [nx, ny], or null when no neighbor is strictly lower.
export function downhill(map, tiles, x, y, free) {
  let best = null;
  let bestV = map[idx(x, y)];
  if (bestV < 0 && map instanceof Int16Array) bestV = Infinity; // unreachable source tile
  for (const [dx, dy] of DIRS4) {
    const nx = x + dx;
    const ny = y + dy;
    if (!walkable(tiles, nx, ny) || !free(nx, ny)) continue;
    const v = map[idx(nx, ny)];
    if (map instanceof Int16Array && v < 0) continue;
    if (v < bestV) {
      bestV = v;
      best = [nx, ny];
    }
  }
  return best;
}
