import { chromium, firefox, webkit } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const arg = (name, fallback) => {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const engines = { chromium, firefox, webkit };
const requested = arg('browser', 'all');
const names = requested === 'all' ? ['chromium', 'firefox', 'webkit'] : requested.split(',');
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

const server = createStaticServer({ root });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;

function attach(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
}

async function waitReady(page) {
  await page.waitForFunction(() => !!window.__wick, undefined, { timeout: 15000 });
}

async function firstMove(page) {
  return page.evaluate(async () => {
    const { distanceMap } = await import('/dist/core/path.js');
    const { idx } = await import('/dist/core/grid.js');
    const g = window.__wick;
    const s = g.s;
    const d = distanceMap(s.tiles, [[s.stairs.x, s.stairs.y]]);
    const dirs = [['ArrowUp', 0, -1], ['ArrowRight', 1, 0], ['ArrowDown', 0, 1], ['ArrowLeft', -1, 0]];
    const options = dirs
      .map(([key, dx, dy]) => ({ key, d: d[idx(s.player.x + dx, s.player.y + dy)] }))
      .filter((o) => o.d >= 0)
      .sort((a, b) => a.d - b.d);
    return options.length ? options[0].key : 'Space';
  });
}

let failed = false;

for (const name of names) {
  const engine = engines[name];
  const errors = [];
  if (!engine) {
    console.error(`unknown browser ${name}`);
    failed = true;
    continue;
  }
  let browser;
  try {
    browser = await engine.launch();
  } catch (e) {
    console.error(`FAIL ${name}: launch failed: ${e.message}`);
    console.error(`      run: npx playwright-core install ${name}`);
    failed = true;
    continue;
  }

  let step = 'load';
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await context.newPage();
    attach(page, errors);
    const expect = (ok, message) => { if (!ok) errors.push(message); };

    await page.goto(`${base}/index.html`);
    await waitReady(page);
    await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    await page.reload();
    await waitReady(page);
    expect(await page.evaluate(() => window.__wick.state) === 'title', 'does not start on the title');
    if (shots) await page.screenshot({ path: join(shots, `${name}-title.png`) });

    step = 'settings';
    await page.keyboard.press('KeyO');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Settings', 'settings dialog has the wrong title');
    await page.locator('#wick-reduced').check();
    await page.locator('dialog .actions button').last().click();
    await page.waitForSelector('dialog', { state: 'detached' });
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('wick.settings.v1') || '{}'));
    expect(settings.reducedMotion === true, 'reduced-motion setting did not persist');

    step = 'new run';
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__wick.state === 'play', undefined, { timeout: 5000 });
    const key = await firstMove(page);
    await page.keyboard.press(key);
    await page.waitForTimeout(250);
    const save = await page.evaluate(() => window.__wick.save);
    expect(save && save.turn >= 0, 'run was not saved after a move');
    expect(save && save.seed === (await page.evaluate(() => window.__wick.seed)), 'saved seed differs from the run seed');

    step = 'pause';
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    expect((await page.locator('dialog h2').innerText()) === 'Paused', 'pause dialog has the wrong title');
    await page.locator('dialog .actions button').first().click();
    await page.waitForSelector('dialog', { state: 'detached' });
    expect(await page.evaluate(() => window.__wick.state) === 'play', 'did not resume after pause');

    step = 'reload and continue';
    await page.reload();
    await waitReady(page);
    await page.waitForFunction(() => window.__wick.state === 'title', undefined, { timeout: 5000 });
    expect(await page.evaluate(() => !!window.__wick.saveLabel), 'continue label is missing after reload');
    await page.keyboard.press('KeyC');
    await page.waitForFunction(() => window.__wick.state === 'play', undefined, { timeout: 5000 });
    const resumed = await page.evaluate(() => ({ turn: window.__wick.s.turn, depth: window.__wick.s.depth, seed: window.__wick.seed }));
    expect(resumed.turn === save.turn && resumed.depth === save.depth, 'resumed state differs from the save');
    expect(resumed.seed === save.seed, 'resumed seed differs');

    step = 'pause settings';
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]');
    if (shots) await page.screenshot({ path: join(shots, `${name}-pause.png`) });
    await page.locator('dialog .actions button').first().click();
    await page.waitForSelector('dialog', { state: 'detached' });

    step = 'mobile';
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const mp = await mobile.newPage();
    attach(mp, errors);
    await mp.goto(`${base}/index.html`);
    await waitReady(mp);
    await mp.touchscreen.tap(195, 420);
    await mp.waitForFunction(() => window.__wick.state === 'play', undefined, { timeout: 5000 });
    const before = await mp.evaluate(() => window.__wick.s.turn);
    const player = await mp.evaluate(() => {
      const g = window.__wick;
      const s = g.s;
      return { x: g.view.ox + (s.player.x * 24 + 12) * g.view.scale, y: g.view.oy + (36 + s.player.y * 24 + 12) * g.view.scale };
    });
    await mp.touchscreen.tap(player.x, player.y);
    await mp.waitForTimeout(250);
    const after = await mp.evaluate(() => window.__wick.s.turn);
    expect(after > before, `tap on the player did not take a turn (${before} -> ${after})`);
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(!overflow, 'page overflows horizontally at 390px');
    await mobile.close();
    await context.close();
  } catch (e) {
    errors.push(`journey failed at ${step}: ${String(e.message).split('\n')[0]}`);
  } finally {
    await browser.close();
  }

  if (errors.length) {
    failed = true;
    console.error(`FAIL ${name}`);
    for (const error of errors) console.error(`      ${error}`);
  } else {
    console.log(`ok   ${name}: title, settings, run, save, pause/resume, continue, mobile tap`);
  }
}

server.close();
process.exit(failed ? 1 : 0);
