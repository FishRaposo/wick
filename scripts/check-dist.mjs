import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const errors = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) out.push(...walk(file));
    else out.push(file);
  }
  return out;
}

if (!existsSync(join(dist, 'main.js'))) errors.push('dist/main.js is missing');
if (!existsSync(join(root, 'index.html'))) errors.push('index.html is missing');
else {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  if (!/src=["']dist\/main\.js["']/.test(html)) errors.push('index.html must load dist/main.js with a relative path');
}

const modules = existsSync(dist) ? walk(dist) : [];
const specifier = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const file of modules) {
  const rel = file.slice(dist.length + 1).replaceAll('\\', '/');
  if (file.endsWith('.ts') || file.endsWith('.d.ts')) {
    errors.push(`${rel}: TypeScript file in dist`);
    continue;
  }
  if (extname(file) !== '.js') continue;
  const code = readFileSync(file, 'utf8');
  if (/\brequire\s*\(/.test(code)) errors.push(`${rel}: CommonJS require`);
  if (/\bmodule\.exports\b|\bexports\.[A-Za-z_$]/.test(code)) errors.push(`${rel}: CommonJS exports`);
  for (const match of code.matchAll(specifier)) {
    const spec = match[1] ?? match[2];
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      errors.push(`${rel}: bare specifier "${spec}"`);
      continue;
    }
    if (!spec.endsWith('.js')) errors.push(`${rel}: specifier "${spec}" must end in .js`);
    const target = resolve(dirname(file), spec);
    if (!target.startsWith(dist + sep)) errors.push(`${rel}: specifier "${spec}" escapes dist`);
    else if (!existsSync(target)) errors.push(`${rel}: missing "${spec}"`);
  }
}

if (errors.length) {
  console.error('dist check failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`dist ok: ${modules.filter((f) => f.endsWith('.js')).length} modules`);
