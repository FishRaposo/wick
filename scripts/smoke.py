"""Headless smoke test: title -> play several floors -> death -> restart, failing on console errors.
Usage: npm start (in another terminal), then: python scripts/smoke.py <screenshot-dir> [base-url]
Needs: pip install playwright && playwright install chromium"""
import sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:8080'
errors = []
STEP = """async () => { const s = window.__wick.s; const { distanceMap } = await import('/src/path.js');
  const d = distanceMap(s.tiles, [[s.stairs.x, s.stairs.y]]); const W = 40;
  const o = [[0,-1,'ArrowUp'],[1,0,'ArrowRight'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft']]
    .map(([dx, dy, k]) => [k, d[(s.player.y + dy) * W + s.player.x + dx]]).filter(a => a[1] >= 0).sort((a, b) => a[1] - b[1]);
  return o.length ? o[0][0] : 'Space'; }"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 720})  # non-native size exercises scaling and tap mapping
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.goto(f'{BASE}/index.html?seed=1234')
    pg.wait_for_timeout(800)
    pg.screenshot(path=f'{OUT}/01-title.png')
    pg.keyboard.press('Space')
    pg.wait_for_timeout(300)
    assert pg.evaluate('window.__wick.state') == 'play'

    # Tap on yourself: waits one turn.
    before = pg.evaluate('window.__wick.s.turn')
    box = pg.evaluate('''() => { const g = window.__wick, v = g.view, s = g.s;
        return [v.ox + (s.player.x * 24 + 12) * v.scale, v.oy + (36 + s.player.y * 24 + 12) * v.scale, 24 * v.scale]; }''')
    pg.mouse.click(box[0], box[1])  # tap on yourself: wait
    pg.wait_for_timeout(150)
    print('tap advanced turns:', pg.evaluate('window.__wick.s.turn') - before)

    for i in range(400):
        if pg.evaluate('window.__wick.state') != 'play':
            break
        pg.keyboard.press(pg.evaluate(STEP))
        pg.wait_for_timeout(90)
    info = pg.evaluate('() => { const g = window.__wick; return { state: g.state, depth: g.s.depth, hp: g.s.player.hp, oil: g.s.player.oil, turn: g.s.turn }; }')
    print('after play:', info)
    pg.screenshot(path=f'{OUT}/02-play.png')

    # Force a death to check the game-over screen and restart.
    pg.evaluate('() => { const g = window.__wick; if (g.state === "play") { g.s.player.oil = 0; g.s.player.hp = 1; } }')
    for i in range(300):
        if pg.evaluate('window.__wick.state') != 'play':
            break
        pg.keyboard.press('Space')
        pg.wait_for_timeout(30)
    pg.wait_for_timeout(1200)
    print('end state:', pg.evaluate('window.__wick.state'))
    pg.screenshot(path=f'{OUT}/03-over.png')
    pg.keyboard.press('KeyR')
    pg.wait_for_timeout(300)
    print('restart:', pg.evaluate('() => ({ state: window.__wick.state, depth: window.__wick.s.depth })'))
    b.close()

print('ERRORS:' if errors else 'no console errors')
for e in errors:
    print(' ', e)
sys.exit(1 if errors else 0)
