import { MAP_W, MAP_H, TILE } from './config.ts';
import type { Cell } from './types.ts';

export const DIRS4: Cell[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const idx = (x: number, y: number): number => y * MAP_W + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export function walkable(tiles: Uint8Array, x: number, y: number): boolean {
  return inBounds(x, y) && tiles[idx(x, y)] !== TILE.WALL;
}

export interface MapMark {
  c: string;
  x: number;
  y: number;
}

// Build a tile grid from rows of text: '#' wall, '.' floor, '>' stairs. Used by tests and the harness.
// Any other character is floor and is reported back with its position, so a map can mark spawns.
export function parseMap(rows: string[]): { tiles: Uint8Array; marks: MapMark[] } {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const marks: MapMark[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length && x < MAP_W; x++) {
      const c = row[x];
      if (c === '#') continue;
      tiles[idx(x, y)] = c === '>' ? TILE.STAIRS : TILE.FLOOR;
      if (c !== '.' && c !== '>') marks.push({ c, x, y });
    }
  });
  return { tiles, marks };
}
