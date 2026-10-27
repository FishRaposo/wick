"""Scripted bot run that produces the README/itch media (video, screenshots, cover).
Usage: npm start (port 8080), then: python scripts/record_media.py <out-dir> [base-url]
The bot plays through real key presses. The only change is that the player can't die, so the footage doesn't end early."""
import sys, base64
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8080'
STEP = """async () => { const g = window.__wick; const s = g.s; const { distanceMap } = await import('/src/path.js');
  s.player.hp = s.player.maxHp;
  const W = 40, at = (x, y) => y * W + x;
  const dirs = [[0,-1,'ArrowUp'],[1,0,'ArrowRight'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft']];
  for (const [dx, dy, k] of dirs) if (s.enemies.some(e => e.x === s.player.x + dx && e.y === s.player.y + dy)) return k;
  const goals = s.items.filter(i => s.visible[at(i.x, i.y)]).map(i => [i.x, i.y]);
  const d = distanceMap(s.tiles, goals.length ? goals : [[s.stairs.x, s.stairs.y]]);
  const o = dirs.map(([dx, dy, k]) => [k, d[at(s.player.x + dx, s.player.y + dy)]]).filter(a => a[1] >= 0).sort((a, b) => a[1] - b[1]);
  return o.length ? o[0][0] : 'Space'; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 960, 'height': 540}, record_video_dir=OUT, record_video_size={'width': 960, 'height': 540})
    pg = ctx.new_page()
    pg.goto(f'{BASE}/index.html?seed=31')
    pg.wait_for_timeout(1800)
    pg.screenshot(path=f'{OUT}/title.png')
    pg.keyboard.press('Space')
    pg.wait_for_timeout(500)
    for i in range(260):
        pg.keyboard.press(pg.evaluate(STEP))
        pg.wait_for_timeout(140)
        if i in (40, 150, 230):
            pg.screenshot(path=f'{OUT}/play-{i}.png')
    data = pg.evaluate('''() => { const c = document.getElementById('game'); const o = document.createElement('canvas'); o.width = 1260; o.height = 1000;
        const x = o.getContext('2d'); x.fillStyle = '#07070a'; x.fillRect(0, 0, 1260, 1000);
        const sw = c.width, sh = c.height; const s = 1000 / sh; x.drawImage(c, (1260 - sw * s) / 2, 0, sw * s, 1000);
        const g = x.createLinearGradient(0, 560, 0, 1000); g.addColorStop(0, 'rgba(7,7,10,0)'); g.addColorStop(1, 'rgba(7,7,10,0.95)'); x.fillStyle = g; x.fillRect(0, 560, 1260, 440);
        x.fillStyle = '#e8dcc4'; x.textAlign = 'center'; x.font = 'bold 150px "Iowan Old Style", Palatino, Georgia, serif';
        if ('letterSpacing' in x) x.letterSpacing = '30px'; x.fillText('WICK', 645, 900);
        return o.toDataURL('image/png'); }''')
    open(f'{OUT}/cover.png', 'wb').write(base64.b64decode(data.split(',')[1]))
    ctx.close()
    b.close()
print('done')
