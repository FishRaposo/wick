import { TILE } from './config.ts';
import { idx, inBounds } from './grid.ts';

// Recursive shadowcasting (Björn Bergström's algorithm): scan each of the eight octants row by row,
// narrowing the visible slope range every time a wall casts a shadow. Walls themselves are visible;
// what's behind them is not. Radius uses r² + r, which gives rounder circles than r².
//
// Octant transforms: [xx, xy, yx, yy] for each of the 8 octants.
type Octant = [number, number, number, number];

const OCTANTS: Octant[] = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

const opaque = (tiles: Uint8Array, x: number, y: number): boolean => !inBounds(x, y) || tiles[idx(x, y)] === TILE.WALL;

export function computeFov(tiles: Uint8Array, ox: number, oy: number, radius: number, out: Uint8Array): Uint8Array {
  out.fill(0);
  if (inBounds(ox, oy)) out[idx(ox, oy)] = 1;
  for (const [xx, xy, yx, yy] of OCTANTS) castLight(tiles, ox, oy, 1, 1, 0, radius, xx, xy, yx, yy, out);
  return out;
}

function castLight(
  tiles: Uint8Array,
  cx: number,
  cy: number,
  row: number,
  start: number,
  end: number,
  radius: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
  out: Uint8Array,
): void {
  if (start < end) return;
  const r2 = radius * radius + radius;
  let newStart = 0;
  for (let j = row; j <= radius; j++) {
    let dx = -j - 1;
    const dy = -j;
    let blocked = false;
    while (dx <= 0) {
      dx += 1;
      const X = cx + dx * xx + dy * xy;
      const Y = cy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (start < rSlope) continue;
      if (end > lSlope) break;
      if (dx * dx + dy * dy <= r2 && inBounds(X, Y)) out[idx(X, Y)] = 1;
      const wall = opaque(tiles, X, Y);
      if (blocked) {
        if (wall) {
          newStart = rSlope;
        } else {
          blocked = false;
          start = newStart;
        }
      } else if (wall && j < radius) {
        blocked = true;
        castLight(tiles, cx, cy, j + 1, start, lSlope, radius, xx, xy, yx, yy, out);
        newStart = rSlope;
      }
    }
    if (blocked) break;
  }
}
