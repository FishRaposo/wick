// Verifies that every task in the pack is solvable and that its check means something.
//
// For each task:
//   1. copy src/ and test/ into a temp folder, apply starting-state.patch (if any) → the task as handed out
//   2. run the task's check against that copy                                      → must FAIL
//   3. apply reference-solution.patch                                               → the solved task
//   4. run the check again, and the copy's own unit tests                           → must PASS
//
// Wick's rules are plain modules with no DOM, so checks run in Node against the same code the
// browser runs. Each check runs in a fresh process so module caches never leak between states.
//
// Usage: node tasks/verify.mjs [task-id ...]     (no ids = every task)

import { readdirSync, existsSync, mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS = join(ROOT, 'tasks');

function runCheck(work, checkFile) {
  const code = `import(${JSON.stringify(pathToFileURL(checkFile).href)}).then(async (m) => {
    const r = await m.default(${JSON.stringify(pathToFileURL(join(work, 'src')).href + '/')});
    process.stdout.write(JSON.stringify(r));
  }).catch((e) => process.stdout.write(JSON.stringify({ pass: false, details: 'check crashed: ' + String(e.message).split('\\n')[0] })));`;
  const out = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: work, encoding: 'utf8' });
  try {
    return JSON.parse(out.stdout);
  } catch {
    return { pass: false, details: `no result: ${(out.stderr || '').split('\n')[0]}` };
  }
}

function unitTests(work) {
  const r = spawnSync(process.execPath, ['--test'], { cwd: work, encoding: 'utf8' });
  const fail = /# fail (\d+)/.exec(r.stdout);
  return fail ? Number(fail[1]) : -1;
}

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(TASKS).filter((d) => existsSync(join(TASKS, d, 'check.mjs'))).sort();

let allGood = true;
for (const id of ids) {
  const t = join(TASKS, id);
  const meta = JSON.parse(readFileSync(join(t, 'task.json'), 'utf8'));
  const work = mkdtempSync(join(tmpdir(), `wick-${id}-`));
  cpSync(join(ROOT, 'src'), join(work, 'src'), { recursive: true });
  cpSync(join(ROOT, 'test'), join(work, 'test'), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(work, 'package.json'));

  let before;
  let after;
  let failingTests = -1;
  try {
    if (existsSync(join(t, 'starting-state.patch'))) execFileSync('git', ['apply', join(t, 'starting-state.patch')], { cwd: work, stdio: 'pipe' });
    before = runCheck(work, join(t, 'check.mjs'));
    execFileSync('git', ['apply', join(t, 'reference-solution.patch')], { cwd: work, stdio: 'pipe' });
    after = runCheck(work, join(t, 'check.mjs'));
    failingTests = unitTests(work);
  } catch (e) {
    before ??= { pass: true, details: `patch failed: ${e.stderr || e.message}` };
    after ??= { pass: false, details: `patch failed: ${e.stderr || e.message}` };
  }
  rmSync(work, { recursive: true, force: true });

  const good = !before.pass && after.pass && failingTests === 0;
  allGood &&= good;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${id.padEnd(30)} ${meta.kind.padEnd(8)} starting state: ${before.pass ? 'PASS' : 'fail'}  ·  solution: ${after.pass ? 'pass' : 'FAIL'}  ·  unit tests after: ${failingTests === 0 ? 'green' : `${failingTests} failing`}`);
  console.log(`      before: ${before.details}`);
  console.log(`      after:  ${after.details}`);
}
process.exit(allGood ? 0 : 1);
