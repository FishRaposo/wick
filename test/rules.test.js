import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, loadMap, act, radius, isLit, enemyAt } from '../src/rules.js';
import { generateFloor, enemyBudget } from '../src/gen.js';
import { computeFov } from '../src/fov.js';
import { distanceMap, fleeMap, downhill } from '../src/path.js';
import { parseMap, idx } from '../src/grid.js';
import { Rng } from '../src/rng.js';
import { MAP_W, MAP_H, TILE, ENEMY, lightRadius } from '../src/config.js';

const N = MAP_W * MAP_H;
const move = (dx, dy) => ({ type: 'move', dx, dy });
const WAIT = { type: 'wait' };

// A 38×19 open room inside the border.
const openRoom = (marks = {}) => {
  const rows = [];
  for (let y = 0; y < MAP_H; y++) {
    let row = '';
    for (let x = 0; x < MAP_W; x++) row += x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : marks[`${x},${y}`] || '.';
    rows.push(row);
  }
  return rows;
};

// ------------------------------------------------------------------ generation

test('every generated floor is fully connected, over 300 seeds × 6 depths', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = new Rng(seed);
    for (let depth = 1; depth <= 6; depth++) {
      const f = generateFloor(depth, rng);
      const d = distanceMap(f.tiles, [[f.start.x, f.start.y]]);
      for (let i = 0; i < N; i++) if (f.tiles[i] !== TILE.WALL) assert.ok(d[i] >= 0, `seed ${seed} depth ${depth}: tile ${i} unreachable`);
    }
  }
});

test('the stairs are the farthest reachable tile from the start', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const f = generateFloor(2, new Rng(seed));
    const d = distanceMap(f.tiles, [[f.start.x, f.start.y]]);
    const stairs = d[idx(f.stairs.x, f.stairs.y)];
    assert.ok(stairs > 0);
    for (let i = 0; i < N; i++) assert.ok(d[i] <= stairs);
  }
});

test('spawns respect unlock depth, budget and distance from the start, and never stack', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const depth of [1, 2, 3, 5]) {
      const f = generateFloor(depth, new Rng(seed * 7 + depth));
      const d = distanceMap(f.tiles, [[f.start.x, f.start.y]]);
      const cost = f.spawns.reduce((a, s) => a + ENEMY[s.kind].cost, 0);
      assert.ok(cost <= enemyBudget(depth));
      const spots = new Set();
      for (const s of [...f.spawns, ...f.items]) {
        assert.ok(depth >= (ENEMY[s.kind]?.unlock ?? 1));
        assert.ok(d[idx(s.x, s.y)] >= 3);
        const k = idx(s.x, s.y);
        assert.ok(!spots.has(k), 'two things on one tile');
        spots.add(k);
      }
    }
  }
});

test('same seed, same run', () => {
  const a = createRun(99);
  const b = createRun(99);
  for (let i = 0; i < 40; i++) {
    const m = [move(1, 0), move(0, 1), move(-1, 0), move(0, -1), WAIT][i % 5];
    act(a, m);
    act(b, m);
  }
  assert.deepEqual([a.player, a.enemies.map((e) => [e.x, e.y, e.hp])], [b.player, b.enemies.map((e) => [e.x, e.y, e.hp])]);
});

// ------------------------------------------------------------------ field of view

test('in an open room, the light is a full circle of the expected radius', () => {
  const { tiles } = parseMap(openRoom());
  const out = new Uint8Array(N);
  computeFov(tiles, 19, 10, 5, out);
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const dx = x - 19;
      const dy = y - 10;
      assert.equal(out[idx(x, y)], dx * dx + dy * dy <= 30 ? 1 : 0, `${x},${y}`);
    }
  }
});

test('walls are lit but block what is behind them', () => {
  const marks = {};
  for (let y = 1; y < MAP_H - 1; y++) marks[`22,${y}`] = '#';
  const { tiles } = parseMap(openRoom(marks));
  const out = new Uint8Array(N);
  computeFov(tiles, 19, 10, 7, out);
  assert.equal(out[idx(22, 10)], 1, 'the wall itself is visible');
  for (let x = 23; x < 27; x++) assert.equal(out[idx(x, 10)], 0, `${x},10 behind the wall`);
});

test('FOV is symmetric for floor tiles in a cluttered room', () => {
  const rng = new Rng(5);
  const marks = {};
  for (let k = 0; k < 60; k++) marks[`${rng.int(1, 38)},${rng.int(1, 19)}`] = '#';
  const { tiles } = parseMap(openRoom(marks));
  const a = new Uint8Array(N);
  const b = new Uint8Array(N);
  const floors = [];
  for (let i = 0; i < N; i++) if (tiles[i] !== TILE.WALL) floors.push([i % MAP_W, (i / MAP_W) | 0]);
  let asym = 0;
  for (let k = 0; k < 200; k++) {
    const [x1, y1] = rng.pick(floors);
    const [x2, y2] = rng.pick(floors);
    computeFov(tiles, x1, y1, 8, a);
    computeFov(tiles, x2, y2, 8, b);
    if (a[idx(x2, y2)] !== b[idx(x1, y1)]) asym++;
  }
  // Shadowcasting isn't perfectly symmetric at shadow edges; it should be rare.
  assert.ok(asym <= 10, `${asym} asymmetric pairs out of 200`);
});

test('light radius follows the oil', () => {
  assert.equal(lightRadius(100), 7);
  assert.equal(lightRadius(1), 3);
  assert.equal(lightRadius(0), 1);
});

// ------------------------------------------------------------------ paths

test('the flee map leads away from the player and out of dead ends', () => {
  // Shade at the mouth of a dead-end alcove, player in the open: fleeing goes into the open room,
  // because the far side of the room is farther than the alcove's end.
  const rows = openRoom({ '10,10': '#', '10,9': '#', '10,11': '#' });
  const { tiles } = parseMap(rows);
  const toPlayer = distanceMap(tiles, [[12, 10]]);
  const f = fleeMap(tiles, toPlayer);
  let x = 14;
  let y = 10;
  for (let i = 0; i < 10; i++) {
    const n = downhill(f, tiles, x, y, () => true);
    if (!n) break;
    assert.ok(toPlayer[idx(n[0], n[1])] >= toPlayer[idx(x, y)] - 1, 'never steps much closer');
    [x, y] = n;
  }
  assert.ok(toPlayer[idx(x, y)] > 8, `ended ${toPlayer[idx(x, y)]} from the player`);
});

// ------------------------------------------------------------------ turns and rules

test('walking into a wall is free: no turn, no oil, no enemy move', () => {
  const s = createRun(1, { generate: false });
  loadMap(s, openRoom({ '1,1': '@', '10,10': 'h' }));
  const before = { turn: s.turn, oil: s.player.oil, h: [s.enemies[0].x, s.enemies[0].y] };
  assert.equal(act(s, move(-1, 0)), false);
  assert.deepEqual({ turn: s.turn, oil: s.player.oil, h: [s.enemies[0].x, s.enemies[0].y] }, before);
});

test('oil burns one point every two turns, and the light shrinks with it', () => {
  const s = createRun(1, { generate: false });
  loadMap(s, openRoom({ '5,5': '@' }));
  s.player.oil = 21;
  act(s, WAIT);
  assert.equal(s.player.oil, 21);
  act(s, WAIT);
  assert.equal(s.player.oil, 20);
  assert.equal(radius(s), 3);
});

test('picking up oil and bandages', () => {
  const s = createRun(1, { generate: false });
  loadMap(s, openRoom({ '5,5': '@', '6,5': 'o', '7,5': '+' }));
  s.player.oil = 50;
  s.player.hp = 2;
  act(s, move(1, 0));
  assert.equal(s.player.oil, 80);
  act(s, move(1, 0));
  assert.equal(s.player.hp, 4);
  assert.equal(s.items.length, 0);
});

test('a moth flies at a burning lantern, ignores a dry one', () => {
  const s = createRun(3, { generate: false });
  loadMap(s, openRoom({ '5,10': '@', '14,10': 'm' }));
  const start = Math.abs(s.enemies[0].x - 5);
  for (let i = 0; i < 6; i++) act(s, WAIT);
  assert.ok(Math.abs(s.enemies[0].x - 5) < start - 2, 'closed in');

  const t = createRun(3, { generate: false });
  loadMap(t, openRoom({ '5,10': '@', '14,10': 'm' }));
  t.player.oil = 0;
  let closest = 9;
  for (let i = 0; i < 6; i++) {
    act(t, WAIT);
    closest = Math.min(closest, Math.abs(t.enemies[0].x - 5) + Math.abs(t.enemies[0].y - 10));
  }
  assert.ok(closest >= 4, 'no beeline in the dark');
});

test('a shade in the bright core flees, waits outside it, and strikes only when the lantern is dry', () => {
  const s = createRun(4, { generate: false });
  loadMap(s, openRoom({ '19,10': '@', '22,10': 's' }));
  assert.ok(isLit(s, 22, 10, 2));
  for (let i = 0; i < 8; i++) act(s, WAIT);
  const e = s.enemies[0];
  assert.ok(!isLit(s, e.x, e.y, 2), 'left the core');
  assert.equal(s.player.hp, 6, 'never struck while lit');

  s.player.oil = 0;
  for (let i = 0; i < 25 && s.player.hp === 6; i++) act(s, WAIT);
  assert.ok(s.player.hp < 6, 'struck once the light was out');
});

test('a hound hears footsteps along the corridors, then comes to where it heard them', () => {
  const s = createRun(5, { generate: false });
  loadMap(s, openRoom({ '5,10': '@', '9,10': 'h' }));
  act(s, move(0, 1)); // noise 5, hound 4 steps away
  assert.ok(s.enemies[0].target, 'heard it');
  const t = createRun(5, { generate: false });
  loadMap(t, openRoom({ '5,10': '@', '9,10': 'h' }));
  act(t, WAIT); // silent
  assert.equal(t.enemies[0].target, null, 'waiting makes no sound');
});

test('a hound does not hear through solid rock', () => {
  // Hound 4 tiles away in a straight line, but behind a wall that takes 20+ steps to walk around.
  const rows = openRoom();
  for (let y = 1; y < MAP_H - 2; y++) rows[y] = rows[y].slice(0, 8) + '#' + rows[y].slice(9);
  rows[10] = rows[10].slice(0, 6) + '@' + rows[10].slice(7, 10) + 'h' + rows[10].slice(11);
  const s = createRun(6, { generate: false });
  loadMap(s, rows);
  act(s, move(0, -1));
  assert.equal(s.enemies[0].target, null);
});

test('taking the stairs builds a new floor with its own enemies', () => {
  const s = createRun(12);
  const firstIds = new Set(s.enemies.map((e) => e.id));
  // Teleport next to the stairs and step on.
  const d = distanceMap(s.tiles, [[s.stairs.x, s.stairs.y]]);
  const [nx, ny] = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [s.stairs.x + dx, s.stairs.y + dy]).find(([x, y]) => d[idx(x, y)] === 1);
  s.player.x = nx;
  s.player.y = ny;
  for (const e of s.enemies) if (Math.abs(e.x - nx) + Math.abs(e.y - ny) <= 1) e.x = e.y = -10;
  act(s, move(s.stairs.x - nx, s.stairs.y - ny));
  assert.equal(s.depth, 2);
  assert.ok(s.enemies.length > 0);
  for (const e of s.enemies) {
    assert.ok(!firstIds.has(e.id));
    assert.notEqual(s.tiles[idx(e.x, e.y)], TILE.WALL);
  }
});

test('bumping an enemy attacks it; killing scores', () => {
  const s = createRun(7, { generate: false });
  loadMap(s, openRoom({ '5,10': '@', '6,10': 'h' }));
  act(s, move(1, 0));
  act(s, move(1, 0));
  act(s, move(1, 0));
  assert.equal(enemyAt(s, 6, 10), undefined);
  assert.equal(s.kills, 1);
  assert.equal(s.score, ENEMY.hound.points);
});
