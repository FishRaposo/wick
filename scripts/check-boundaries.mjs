import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const rules = [
  { dir: 'src/core', forbidden: ['/platform/', '/presentation/', '/main.'] },
  { dir: 'src/content', forbidden: ['/platform/', '/presentation/', '/main.'] },
  { dir: 'src/platform', forbidden: ['/presentation/'] },
];
const errors = [];
const importSpec = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) out.push(...walk(file));
    else if (/\.(?:js|ts)$/.test(file) && !file.endsWith('.d.ts')) out.push(file);
  }
  return out;
}

for (const rule of rules) {
  const dir = resolve(root, rule.dir);
  for (const file of walk(dir)) {
    const rel = file.slice(root.length + 1).replaceAll('\\', '/');
    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(importSpec)) {
      const spec = match[1].replaceAll('\\', '/');
      for (const bad of rule.forbidden) {
        if (spec.includes(bad)) errors.push(`${rel}: ${rule.dir} must not import ${bad} (${spec})`);
      }
      if (rule.dir === 'src/core' && !spec.startsWith('.')) {
        errors.push(`${rel}: core must use relative imports (${spec})`);
      }
    }
  }
}

if (errors.length) {
  console.error('boundary check failed:');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log('boundaries ok');
