import { MAP_W, MAP_H, TILE } from './config.js';

export const DIRS4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const idx = (x, y) => y * MAP_W + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

export function walkable(tiles, x, y) {
  return inBounds(x, y) && tiles[idx(x, y)] !== TILE.WALL;
}

// Build a tile grid from rows of text: '#' wall, '.' floor, '>' stairs. Used by tests and the harness.
// Any other character is floor and is reported back with its position, so a map can mark spawns.
export function parseMap(rows) {
  const tiles = new Uint8Array(MAP_W * MAP_H);
  const marks = [];
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
