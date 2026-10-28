// Verifies that every task in the pack is solvable and that its check means something.
//
// For each task:
//   1. copy the game into a temp folder and apply starting-state.patch (if any) → the task as handed out
//   2. build the copy, then run the task's check                                    → must FAIL
//   3. apply reference-solution.patch, build, run the check again                   → must PASS
//   4. run the copy's unit suite                                                    → must be green
//   5. for bug tasks, require starting + reference to reproduce the repo exactly
//
// Usage: node tasks/verify.mjs [task-id ...]     (no ids = every task)

import { readdirSync, existsSync, mkdtempSync, cpSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS = join(ROOT, 'tasks');
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');

function applyPatch(dir, patch) {
  execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--whitespace=nowarn', patch], { cwd: dir, stdio: 'pipe' });
}

function build(dir) {
  const r = spawnSync(process.execPath, [TSC, '-p', 'tsconfig.json'], { cwd: dir, encoding: 'utf8' });
  if (!r.error && r.status === 0) return null;
  const text = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(0, 2).join(' ');
  return text || `tsc exited ${r.status}`;
}

function runCheck(dir, checkFile) {
  const code = `import(${JSON.stringify(pathToFileURL(checkFile).href)}).then(async (m) => {
    const r = await m.default(${JSON.stringify(pathToFileURL(join(dir, 'dist')).href + '/')});
    process.stdout.write(JSON.stringify(r));
  }).catch((e) => process.stdout.write(JSON.stringify({ pass: false, details: 'check crashed: ' + String(e.message).split('\\n')[0] })));`;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: dir, encoding: 'utf8' });
  try {
    return JSON.parse(out.stdout);
  } catch {
    return { pass: false, details: `no result: ${(out.stderr || '').split('\n')[0]}` };
  }
}

function unitTests(dir) {
  const r = spawnSync(process.execPath, ['--test', 'test/**/*.test.ts'], { cwd: dir, encoding: 'utf8' });
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  const match = /(?:#|ℹ)\s*fail\s+(\d+)/.exec(out);
  const failing = match ? Number(match[1]) : r.status === 0 ? 0 : -1;
  return { failing, status: r.status };
}

function tree(dir) {
  const out = new Map();
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const file = join(current, name);
      if (statSync(file).isDirectory()) walk(file);
      else out.set(relative(dir, file).replaceAll('\\', '/'), readFileSync(file));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

function sameTree(a, b) {
  const left = tree(a);
  const right = tree(b);
  const problems = [];
  for (const [key, value] of left) {
    const other = right.get(key);
    if (!other) problems.push(`missing ${key}`);
    else if (!value.equals(other)) problems.push(`differs ${key}`);
  }
  for (const key of right.keys()) if (!left.has(key)) problems.push(`extra ${key}`);
  return problems;
}

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(TASKS).filter((d) => existsSync(join(TASKS, d, 'check.mjs'))).sort();

let allGood = true;

for (const id of ids) {
  const t = join(TASKS, id);
  const meta = JSON.parse(readFileSync(join(t, 'task.json'), 'utf8'));
  const hasStarting = existsSync(join(t, 'starting-state.patch'));
  const work = mkdtempSync(join(tmpdir(), `wick-${id}-`));
  cpSync(join(ROOT, 'src'), join(work, 'src'), { recursive: true });
  cpSync(join(ROOT, 'test'), join(work, 'test'), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(work, 'package.json'));
  cpSync(join(ROOT, 'tsconfig.json'), join(work, 'tsconfig.json'));
  cpSync(join(ROOT, 'tsconfig.test.json'), join(work, 'tsconfig.test.json'));

  let before;
  let after;
  let units = { failing: -1, status: -1 };
  let fidelity = [];
  try {
    if (hasStarting) applyPatch(work, join(t, 'starting-state.patch'));
    const beforeBuild = build(work);
    before = beforeBuild
      ? { pass: true, details: `starting state does not compile: ${beforeBuild}` }
      : await runCheck(work, join(t, 'check.mjs'));

    applyPatch(work, join(t, 'reference-solution.patch'));
    const afterBuild = build(work);
    after = afterBuild
      ? { pass: false, details: `reference does not compile: ${afterBuild}` }
      : await runCheck(work, join(t, 'check.mjs'));

    units = unitTests(work);
    if (hasStarting) fidelity = sameTree(join(work, 'src'), join(ROOT, 'src')).concat(sameTree(join(work, 'test'), join(ROOT, 'test')));
  } catch (e) {
    before ??= { pass: true, details: `patch failed: ${(e.stderr || e.message).toString().split('\n')[0]}` };
    after ??= { pass: false, details: `patch failed: ${(e.stderr || e.message).toString().split('\n')[0]}` };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const good = !before.pass && after.pass && units.failing === 0 && fidelity.length === 0;
  allGood &&= good;
  const unitText = units.failing === 0 ? 'green' : units.failing === -1 ? 'failed to run' : `${units.failing} failing`;
  console.log(
    `${good ? 'ok  ' : 'FAIL'}  ${id.padEnd(30)} ${meta.kind.padEnd(8)} starting state: ${before.pass ? 'PASS' : 'fail'}  ·  solution: ${after.pass ? 'pass' : 'FAIL'}  ·  unit tests after: ${unitText}${hasStarting ? `  ·  patches: ${fidelity.length === 0 ? 'exact' : 'DRIFTED'}` : ''}`,
  );
  if (fidelity.length) console.log(`      drift: ${fidelity.join(', ')}`);
  console.log(`      before: ${before.details}`);
  console.log(`      after:  ${after.details}`);
}

process.exit(allGood ? 0 : 1);
