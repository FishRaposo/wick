import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createStaticServer } from './serve.mjs';

const root = join(import.meta.dirname, '..');
const port = Number(process.argv[2] ?? 8080);

if (!existsSync(join(root, 'dist/main.js'))) {
  console.error('dist/main.js is missing. Run `npm run build` first.');
  process.exit(1);
}

const tsc = spawn(
  process.execPath,
  [join(root, 'node_modules/typescript/bin/tsc'), '-w', '-p', 'tsconfig.json'],
  { cwd: root, stdio: 'inherit' },
);

const server = createStaticServer({ root });
server.listen(port, '127.0.0.1', () => {
  console.log(`serving http://localhost:${port}/ (watching src/)`);
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  tsc.kill();
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 1000).unref();
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
tsc.on('exit', (code) => {
  if (!stopping && code) stop(code);
});
