// Criteria for pouring oil. Everything is checked through the rules, with the player's real action.
export default async function check(src) {
  const { CONTENT } = await import(src + 'content/index.js');
  const { createRun, loadMap, act, isLit } = await import(src + 'core/rules.js');
  const { MAP_W, MAP_H } = await import(src + 'core/config.js');
  const { idx } = await import(src + 'core/grid.js');
  const room = (marks = {}) => {
    const rows = [];
    for (let y = 0; y < MAP_H; y++) {
      let r = '';
      for (let x = 0; x < MAP_W; x++) r += x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1 ? '#' : marks[`${x},${y}`] || '.';
      rows.push(r);
    }
    return rows;
  };
  const POUR = { type: 'pour' };
  const WAIT = { type: 'wait' };
  const fail = [];

  // 1. Pouring costs 15 oil and a turn, and leaves a pool that lights its surroundings after you walk away.
  const s = createRun(1, { generate: false, content: CONTENT });
  loadMap(s, room({ '10,10': '@' }));
  s.player.oil = 40; // lantern radius 4
  const turned = act(s, POUR);
  if (!turned) fail.push('pour did not take a turn');
  if (s.player.oil !== 25) fail.push(`oil after pouring ${s.player.oil} (want 25)`);
  for (let i = 0; i < 8; i++) act(s, { type: 'move', dx: 1, dy: 0 });
  if (!s.visible[idx(10, 10)] || !s.visible[idx(9, 11)]) fail.push('pool does not light the floor once you walk 8 tiles away');
  if (!isLit(s, 10, 10)) fail.push('pool tile not lit');

  // 2. It burns out: 25 turns after pouring, that floor is dark again.
  for (let i = 0; i < 20; i++) act(s, WAIT);
  if (s.visible[idx(10, 10)]) fail.push('pool still lit 28 turns after pouring (want out after 25)');

  // 3. Refusals cost nothing: not enough oil, or the same tile twice.
  const r = createRun(1, { generate: false, content: CONTENT });
  loadMap(r, room({ '5,5': '@' }));
  r.player.oil = 15;
  const refused = act(r, POUR) === false && r.player.oil === 15 && r.turn === 0;
  if (!refused) fail.push('pouring with 15 oil should be refused for free');
  r.player.oil = 60;
  act(r, POUR);
  const twice = act(r, POUR) === false && r.player.oil === 45;
  if (!twice) fail.push('pouring twice on one tile should be refused for free');

  // 4. Shades fear the pool on their own: pour beside a shade, then take the lantern away entirely.
  const sh = createRun(2, { generate: false, content: CONTENT });
  loadMap(sh, room({ '20,10': '@', '5,10': 's' }));
  sh.player.oil = 60;
  sh.player.x = 6;
  act(sh, POUR); // pool at 6,10, right next to the shade
  sh.player.oil = 0;
  sh.player.x = 36; // far away and dark: only the pool can scare it now
  for (let i = 0; i < 4; i++) act(sh, WAIT);
  const shade = sh.enemies[0];
  const d2 = (shade.x - 6) ** 2 + (shade.y - 10) ** 2;
  if (d2 <= 2) fail.push(`shade stayed in the pool's bright core at ${shade.x},${shade.y}`);

  // 5. Moths go to a pool that is closer than the lantern.
  const m = createRun(3, { generate: false, content: CONTENT });
  loadMap(m, room({ '30,10': '@', '20,10': 'm' }));
  m.player.oil = 60;
  m.player.x = 17;
  act(m, POUR); // pool at 17,10, three tiles from the moth; lantern then walks away east
  m.player.x = 33;
  for (let i = 0; i < 6; i++) act(m, WAIT);
  const moth = m.enemies[0];
  const dPool = Math.abs(moth.x - 17) + Math.abs(moth.y - 10);
  if (dPool > 3) fail.push(`moth ended ${dPool} tiles from the pool (want ≤ 3)`);

  return { pass: fail.length === 0, details: fail.length ? fail.join('; ') : 'cost, light, burn-out, refusals, shade fear and moth pull all match the spec' };
}
