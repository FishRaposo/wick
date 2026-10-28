import { createStaticServer } from './serve.mjs';
import { resolve } from 'node:path';

const root = joinRoot();

function joinRoot() {
  return resolve(import.meta.dirname, '..');
}

function arg(name, fallback) {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const prefix = arg('prefix', '/');
const server = createStaticServer({ root, prefix });
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;
const base = `http://127.0.0.1:${port}${prefix === '/' ? '/' : prefix}`;
const indexUrl = new URL('index.html', base).href;
const seen = new Set();
const queue = [indexUrl];
const errors = [];
let count = 0;

const refs = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g;
const specifier = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

try {
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    if (count++ > 500) {
      errors.push('module graph exceeded 500 resources');
      break;
    }
    const res = await fetch(url);
    if (!res.ok) {
      errors.push(`${url} -> HTTP ${res.status}`);
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('text/html')) {
      const html = await res.text();
      for (const match of html.matchAll(refs)) {
        const ref = match[1];
        if (ref.startsWith('data:') || ref.startsWith('http:') || ref.startsWith('https:')) continue;
        queue.push(new URL(ref, url).href);
      }
    } else if (type.includes('javascript')) {
      const code = await res.text();
      for (const match of code.matchAll(specifier)) {
        const spec = match[1] ?? match[2];
        if (!spec.startsWith('.') && !spec.startsWith('/')) {
          errors.push(`${url}: bare specifier "${spec}"`);
          continue;
        }
        queue.push(new URL(spec, url).href);
      }
    }
  }
} finally {
  server.close();
}

if (errors.length) {
  console.error(`module graph failed under ${prefix}:`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`module graph ok: ${count} resources under ${prefix}`);
