#!/usr/bin/env node
/**
 * NAV probe helper — allocation A/B, without ever mutating the working tree.
 *
 * `tools/snapshot.mjs` freezes a COPY of the tree into a temp directory and prints its
 * path. So the before-side of an allocation A/B does not need a checkout, a stash (never)
 * or a peer-visible edit: take the snapshot, overwrite `movement.ts` and `ai.ts` INSIDE the
 * frozen copy with their committed versions from `git show`, and point `perf.mjs` at it.
 * Vite has not served a single module at that point, so nothing is cached and the swap is
 * total. The working tree is never touched, which matters with four peers live.
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const passthrough = process.argv.slice(2);

const snap = spawn('node', [`${ROOT}/tools/snapshot.mjs`, '--json'], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'],
});

let buf = '';
const info = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('snapshot did not print a URL in 180s')), 180_000);
  snap.stdout.on('data', (c) => {
    buf += c.toString();
    const line = buf.split('\n').find((l) => l.trim().startsWith('{'));
    if (line) { clearTimeout(t); res(JSON.parse(line)); }
  });
  snap.on('exit', (code) => { clearTimeout(t); rej(new Error(`snapshot exited ${code}`)); });
});
console.error(`snapshot up at ${info.url}  dir ${info.dir}`);

for (const rel of ['src/game/movement.ts', 'src/game/ai.ts']) {
  const committed = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  writeFileSync(`${info.dir}/${rel}`, committed);
  console.error(`  reverted inside the snapshot: ${rel} (${committed.length} bytes)`);
}

try {
  await new Promise((res, rej) => {
    const p = spawn('node', [`${ROOT}/tools/perf.mjs`, '--url', info.url, ...passthrough], { cwd: ROOT, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`perf.mjs exited ${c}`))));
  });
} finally {
  snap.kill('SIGTERM');
}
process.exit(0);
