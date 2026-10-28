// Criteria: footsteps carry 5 steps *along walkable tiles*. A hound behind solid rock, close in a
// straight line but far by any path, stays asleep; a hound within 5 steps of open floor wakes.
export default async function check(src) {
  const { CONTENT } = await import(src + 'content/index.js');
  const { createRun, loadMap, act } = await import(src + 'core/rules.js');
  const { MAP_W, MAP_H } = await import(src + 'core/config.js');
  const room = () => {
    const rows = [];
    for (let y = 0; y < MAP_H; y++) {
      let r = '';
      for (let x = 0; x < MAP_W; x++) r += x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : '.';
      rows.push(r);
    }
    return rows;
  };
  const put = (rows, x, y, c) => { rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1); };

  // Through rock: a wall from the top almost to the bottom between player (6,10) and hound (10,10).
  const rock = room();
  for (let y = 1; y < MAP_H - 2; y++) put(rock, 8, y, '#');
  put(rock, 6, 10, '@');
  put(rock, 10, 10, 'h');
  const a = createRun(1, { generate: false, content: CONTENT });
  loadMap(a, rock);
  act(a, { type: 'move', dx: 0, dy: -1 });
  const woke = !!a.enemies[0].target;

  // Open floor: same distance, nothing in between.
  const open = room();
  put(open, 6, 10, '@');
  put(open, 10, 10, 'h');
  const b = createRun(1, { generate: false, content: CONTENT });
  loadMap(b, open);
  act(b, { type: 'move', dx: 0, dy: -1 });
  const heard = !!b.enemies[0].target;

  return { pass: !woke && heard, details: `hound behind rock ${woke ? 'woke (want: asleep)' : 'stayed asleep'}; hound in the open ${heard ? 'heard it' : 'stayed asleep (want: woke)'}` };
}
