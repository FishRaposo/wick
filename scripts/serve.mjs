import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

// Serve the repo root (or a built artifact) at an optional project prefix.
// `npm start` uses `/`; CI uses `/thaw/` to prove GitHub Pages base paths.
export function createStaticServer({ root = process.cwd(), prefix = '/' } = {}) {
  const base = resolve(root);
  const mount = prefix === '/' ? '/' : prefix.endsWith('/') ? prefix : `${prefix}/`;

  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400).end('bad path');
      return;
    }
    if (!pathname.startsWith(mount)) {
      res.writeHead(404).end('not found');
      return;
    }
    let rel = pathname.slice(mount.length);
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = resolve(base, rel);
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end(`not found: ${rel}`);
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(readFileSync(file));
  });
}

function arg(name, fallback) {
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(arg('root', '.'));
  const prefix = arg('prefix', '/');
  const port = Number(arg('port', '8080'));
  if (!existsSync(resolve(root, 'dist/main.js'))) {
    console.error('dist/main.js is missing. Run `npm run build` first.');
    process.exit(1);
  }
  const server = createStaticServer({ root, prefix });
  server.listen(port, '127.0.0.1', () => {
    console.log(`serving ${root} at http://localhost:${port}${prefix === '/' ? '/' : prefix}`);
  });
}
