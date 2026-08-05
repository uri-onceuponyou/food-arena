#!/usr/bin/env node
/**
 * NAV probe helper — run every snapshot-dependent gate against ONE private frozen tree,
 * inside a single invocation.
 *
 * `tools/aspect.mjs` and `tools/tmp/input_accept.mjs` must not be pointed at the shared
 * dev server: four peers are saving into it and a half-written module reads exactly like a
 * regression (`docs/LESSONS.md` S5). `tools/snapshot.mjs --json` never exits — its Vite
 * child holds the event loop open so the server dies with its parent shell — so the whole
 * chain has to live in one process, which is what this is.
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

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
console.log(`\n### frozen snapshot: ${url}\n`);

const GATES = [
  { name: 'aspect', cmd: ['node', `${ROOT}/tools/aspect.mjs`, '--url', url] },
  { name: 'input_accept', cmd: ['node', `${ROOT}/tools/tmp/input_accept.mjs`], env: { PREVIEW_BASE: url } },
  { name: 'menu_accept', cmd: ['node', `${ROOT}/tools/tmp/menu_accept.mjs`], env: { PREVIEW_BASE: url } },
];

const results = [];
for (const g of GATES) {
  console.log(`\n########## ${g.name}\n`);
  const code = await new Promise((res) => {
    const p = spawn(g.cmd[0], g.cmd.slice(1), { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...(g.env ?? {}) } });
    p.on('exit', res);
  });
  results.push(`${g.name}: exit ${code}`);
}
snap.kill('SIGTERM');
console.log(`\n########## SUMMARY\n${results.join('\n')}\n`);
process.exit(0);
