// Syntax-checks every source module (the DOM-bound ones can't be imported under Node).
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = readdirSync('src').filter((f) => f.endsWith('.js'));
for (const f of files) execFileSync(process.execPath, ['--check', `src/${f}`], { stdio: 'inherit' });
console.log(`syntax ok: ${files.length} modules`);
