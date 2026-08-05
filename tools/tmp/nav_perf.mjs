#!/usr/bin/env node
/**
 * NAV probe helper — run `tools/perf.mjs` against a private frozen snapshot.
 *
 * Same shape as `nav_freeze_arena.mjs` and for the same reason: `tools/snapshot.mjs --json`
 * never exits (its Vite child keeps the event loop alive so the server dies with its parent
 * shell), so command substitution round it blocks forever. Spawning it as a child of this
 * process, reading the one JSON line, running the measurement and killing it keeps the
 * whole thing inside a single invocation, which is the rule.
 *
 *   node tools/tmp/nav_perf.mjs --mode alloc --scene match --frames 120
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const passthrough = process.argv.slice(2);

const snap = spawn('node', [`${ROOT}/tools/snapshot.mjs`, '--json'], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'],
});

let buf = '';
const url = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('snapshot did not print a URL in 180s')), 180_000);
  snap.stdout.on('data', (c) => {
    buf += c.toString();
    const line = buf.split('\n').find((l) => l.trim().startsWith('{'));
    if (line) { clearTimeout(t); res(JSON.parse(line).url); }
  });
  snap.on('exit', (code) => { clearTimeout(t); rej(new Error(`snapshot exited ${code}`)); });
});
console.error(`snapshot up at ${url}`);

try {
  await new Promise((res, rej) => {
    const p = spawn('node', [`${ROOT}/tools/perf.mjs`, '--url', url, ...passthrough], { cwd: ROOT, stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`perf.mjs exited ${c}`))));
  });
} finally {
  snap.kill('SIGTERM');
}
process.exit(0);
