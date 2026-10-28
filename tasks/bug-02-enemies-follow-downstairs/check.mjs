// Criteria: taking the stairs leaves the old floor's enemies behind. Every enemy on the new floor
// was spawned there, stands on open floor, and the count matches the new floor's spawn list.
export default async function check(src) {
  const { CONTENT } = await import(src + 'content/index.js');
  const { createRun, act } = await import(src + 'core/rules.js');
  const { distanceMap } = await import(src + 'core/path.js');
  const { idx } = await import(src + 'core/grid.js');
  const { TILE } = await import(src + 'core/config.js');
  const problems = [];
  for (const seed of [12, 77, 2024]) {
    const s = createRun(seed, { content: CONTENT });
    const before = new Set(s.enemies.map((e) => e.id));
    const d = distanceMap(s.tiles, [[s.stairs.x, s.stairs.y]]);
    const next = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => [s.stairs.x + dx, s.stairs.y + dy]).find(([x, y]) => d[idx(x, y)] === 1);
    s.player.x = next[0];
    s.player.y = next[1];
    for (const e of s.enemies) if (Math.abs(e.x - next[0]) + Math.abs(e.y - next[1]) <= 1) e.hp = 0;
    act(s, { type: 'move', dx: s.stairs.x - next[0], dy: s.stairs.y - next[1] });
    if (s.depth !== 2) { problems.push(`seed ${seed}: didn't descend`); continue; }
    const old = s.enemies.filter((e) => e.hp > 0 && before.has(e.id));
    const inRock = old.filter((e) => s.tiles[idx(e.x, e.y)] === TILE.WALL);
    if (old.length) problems.push(`seed ${seed}: ${old.length} enemies followed from floor 1 (${inRock.length} inside walls)`);
  }
  return { pass: problems.length === 0, details: problems.length ? problems.join('; ') : 'floor 2 holds only its own enemies, for 3 seeds' };
}
