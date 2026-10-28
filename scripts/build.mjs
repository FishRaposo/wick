import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });

const tsc = spawnSync(
  process.execPath,
  [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
  { cwd: root, stdio: 'inherit' },
);
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const styles = join(root, 'styles.css');
if (existsSync(styles)) cpSync(styles, join(dist, 'styles.css'));

const check = spawnSync(process.execPath, [join(root, 'scripts/check-dist.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (check.status !== 0) process.exit(check.status ?? 1);

function total(dir) {
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    bytes += stat.isDirectory() ? total(file) : stat.size;
  }
  return bytes;
}
console.log(`build ok: dist/ ${(total(dist) / 1024).toFixed(1)} KB`);
