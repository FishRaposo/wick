import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const server = createStaticServer({ root });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
const problems = [];

page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

async function scan(label) {
  await page.addScriptTag({ path: resolve(root, 'node_modules/axe-core/axe.min.js') });
  const result = await page.evaluate(async () => {
    const axe = window.axe;
    return axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });
  });
  for (const violation of result.violations) {
    for (const node of violation.nodes) {
      problems.push(`${label}: ${violation.id} (${violation.impact}) at ${node.target.join(' ')} — ${violation.help}`);
    }
  }
  console.log(`${label}: ${result.violations.length} violations, ${result.passes.length} checks passed`);
}

await page.goto(`${base}/index.html`);
await page.waitForFunction(() => !!window.__wick, undefined, { timeout: 15000 });
await scan('title');

await page.keyboard.press('KeyO');
await page.waitForSelector('dialog[open]');
await scan('settings dialog');
await page.locator('dialog .actions button').last().click();

await page.keyboard.press('Space');
await page.waitForFunction(() => window.__wick.state === 'play', undefined, { timeout: 5000 });
await page.keyboard.press('Escape');
await page.waitForSelector('dialog[open]');
await scan('pause dialog');

await context.close();
await browser.close();
server.close();

if (problems.length) {
  console.error('a11y failed:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('a11y ok: no WCAG A/AA violations in the DOM overlays');
