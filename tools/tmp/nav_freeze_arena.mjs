#!/usr/bin/env node
/**
 * NAV probe helper — take my OWN frozen arena snapshot, once.
 *
 * `tools/snapshot.mjs --json` deliberately never exits (the Vite child keeps the event
 * loop alive so the server dies with its parent shell). The documented one-liner
 * `URL=$(node tools/snapshot.mjs --json | python3 ...)` therefore blocks forever in
 * command substitution, because both `$( )` and `json.load(stdin)` wait for EOF that
 * never comes. This wrapper is the same idea done correctly: spawn the snapshot as a
 * CHILD of this process, read the single JSON line off its stdout, run the arena dump
 * against it, then kill it — all inside one invocation, so the "server dies with its
 * shell" rule is honoured rather than fought.
 *
 * Writes BOTH:
 *   tools/arena.gameplay.json   (the shared cache — contested, peers rewrite it)
 *   tools/tmp/nav-arena.json    (MY private frozen copy — the A/B baseline)
 *
 * Every navigation number in this task is quoted against the private copy, so an
 * arena peer refreshing the shared cache mid-run cannot move my before/after.
 */

import { spawn } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const snap = spawn('node', [`${ROOT}/tools/snapshot.mjs`, '--json'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
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
    const p = spawn('node', [`${ROOT}/tools/match-sim.mjs`, '--refresh-arena', '--url', url], {
      cwd: ROOT, stdio: 'inherit',
    });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`refresh-arena exited ${c}`))));
  });
  copyFileSync(`${ROOT}/tools/arena.gameplay.json`, `${ROOT}/tools/tmp/nav-arena.json`);
  const d = JSON.parse(readFileSync(`${ROOT}/tools/tmp/nav-arena.json`, 'utf8'));
  console.error(`FROZEN -> tools/tmp/nav-arena.json  maxSafeRadius=${d.maxSafeRadius} cover=${d.cover.length} hazards=${d.hazards.length}`);
} finally {
  snap.kill('SIGTERM');
}
process.exit(0);
