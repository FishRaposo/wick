import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const name = pkg.name;
const dist = join(root, 'dist');

if (!existsSync(join(dist, 'main.js'))) {
  console.error('dist/main.js is missing. Run `npm run build` first.');
  process.exit(1);
}

mkdirSync(join(root, '.tmp'), { recursive: true });
const tmp = join(root, '.tmp', `${name}-web.zip`);
rmSync(tmp, { force: true });

let result;
if (process.platform === 'win32') {
  result = spawnSync('tar', ['-a', '-c', '-f', tmp, 'index.html', 'dist'], { cwd: root, stdio: 'inherit' });
} else {
  result = spawnSync('zip', ['-r', '-q', tmp, 'index.html', 'dist'], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    result = spawnSync('tar', ['-a', '-c', '-f', tmp, 'index.html', 'dist'], { cwd: root, stdio: 'inherit' });
  }
}

if (result.error || result.status !== 0) {
  console.error('packaging failed: need `zip` or `tar` on PATH');
  process.exit(1);
}

const final = join(dist, `${name}-web.zip`);
rmSync(final, { force: true });
renameSync(tmp, final);
console.log(`package ok: dist/${name}-web.zip (${(statSync(final).size / 1024).toFixed(1)} KB)`);
