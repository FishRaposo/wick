import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const versionFile = existsSync(join(root, 'src/version.ts')) ? join(root, 'src/version.ts') : join(root, 'src/version.js');
const versionSource = readFileSync(versionFile, 'utf8');
const version = /VERSION\s*=\s*['"]([^'"]+)['"]/.exec(versionSource)?.[1];
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const allowDirty = process.argv.includes('--allow-dirty');
const allowUnreleased = process.argv.includes('--allow-unreleased');
const errors = [];

if (!version) errors.push('src/version file has no VERSION constant');
else if (version !== pkg.version) errors.push(`version mismatch: package ${pkg.version}, source ${version}`);
if (!allowUnreleased) {
  const escaped = pkg.version.replaceAll('.', '\\.');
  if (!new RegExp(`^## \\[?${escaped}\\]?`, 'm').test(changelog)) {
    errors.push(`CHANGELOG.md has no entry for ${pkg.version}`);
  }
}

if (!allowDirty) {
  const git = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (git.status !== 0) errors.push(`git status failed: ${git.stderr.trim()}`);
  else if (git.stdout.trim()) errors.push('working tree is not clean');
}

if (!process.argv.includes('--skip-gates')) {
  const gates = process.platform === 'win32'
    ? spawnSync('npm run verify', { cwd: root, stdio: 'inherit', shell: true })
    : spawnSync('npm', ['run', 'verify'], { cwd: root, stdio: 'inherit' });
  if (gates.error) errors.push(`verify failed to start: ${gates.error.message}`);
  else if (gates.status !== 0) errors.push(`verify failed (exit ${gates.status})`);
}

if (errors.length) {
  console.error('release check failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`release check ok: ${pkg.name} ${pkg.version}`);
