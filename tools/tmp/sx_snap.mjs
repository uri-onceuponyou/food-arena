#!/usr/bin/env node
/**
 * SX_SNAP — `with_snapshot.mjs`, but for a root that is not the current working directory.
 *
 * ## Why this exists rather than `tools/tmp/with_snapshot.mjs`
 *
 * `with_snapshot.mjs` spawns `node tools/snapshot.mjs` with **no `cwd`**, so the tree it
 * freezes is whatever directory the shell happens to be in. That is exactly right for the
 * ordinary case (freeze my own working tree so a peer's save cannot land mid-render) and
 * exactly wrong for the case this file was built for:
 *
 *   > `docs/AGENT-BRIEF.md` §3 — *"`snapshot.mjs` copies the WORKING tree — 'frozen' is not
 *   > 'clean.' It stops changes DURING your run; it does not remove peers' half-saved work.
 *   > For any A/B you will quote, snapshot a DETACHED WORKTREE of a known commit."*
 *
 * Three peers are live in `src/render/**`, `src/ui/**` and `src/game/*.ts` while this runs,
 * and the working tree carries their uncommitted edits. A six-fighter acceptance number
 * measured on that tree describes no commit that exists. So the measurement runs against
 * `git worktree add --detach <SHA>` and this file is the launcher that can point at it.
 *
 * ⚠️ **`git archive HEAD` is NOT the alternative** (`DECISIONS §60`): five gates in this repo
 * shell out to `git` and die without a `.git` directory, reporting a wrong CAUSE rather than
 * merely a wrong number. Use a real worktree with `node_modules` AND `reference` symlinked.
 *
 * ## Use
 *
 *   node tools/tmp/sx_snap.mjs --root <dir> -- <cmd> --url '{URL}' [::: <cmd> ...]
 *
 * `{URL}` and `{DIR}` are substituted exactly as `with_snapshot.mjs` does, and `PREVIEW_BASE`
 * is injected into every child, so any tool already written against that env var works.
 *
 * ⚠️ The teardown is `SIGTERM` then `SIGKILL` **on the recorded PID**, never a pattern.
 * `pkill -f snapshot` once killed two peers' servers mid-measurement (CLAUDE.md 8b).
 */
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) {
  console.error('usage: sx_snap.mjs --root <dir> [--keep-going] -- <cmd> [args...] [::: <cmd> ...]');
  process.exit(2);
}
const head = argv.slice(0, sep);
const rootArgIdx = head.indexOf('--root');
const ROOT = resolve(rootArgIdx >= 0 ? head[rootArgIdx + 1] : process.cwd());
const keepGoing = head.includes('--keep-going');

if (!existsSync(`${ROOT}/tools/snapshot.mjs`)) {
  console.error(`sx_snap: no tools/snapshot.mjs under --root ${ROOT}`);
  process.exit(2);
}
if (!existsSync(`${ROOT}/node_modules`)) {
  // Stated rather than left to fail deep inside Vite: `DECISIONS §60` records an attempt
  // where a missing `node_modules` made seven gates die on a missing import and read as
  // seven broken gates.
  console.error(`sx_snap: ${ROOT}/node_modules is missing — symlink it before measuring.`);
  process.exit(2);
}

const rest = argv.slice(sep + 1);
const commands = [];
let cur = [];
for (const a of rest) {
  if (a === ':::') { commands.push(cur); cur = []; } else cur.push(a);
}
if (cur.length) commands.push(cur);

const snap = spawn('node', ['tools/snapshot.mjs', '--json'], {
  cwd: ROOT,                    // ← the whole point of this file
  stdio: ['ignore', 'pipe', 'inherit'],
});
const rl = readline.createInterface({ input: snap.stdout });

const info = await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('snapshot did not print JSON within 180s')), 180_000);
  rl.on('line', (line) => {
    try {
      const o = JSON.parse(line);
      if (o && o.url) { clearTimeout(t); res(o); }
    } catch { /* not the JSON line */ }
  });
  snap.on('exit', (c) => { clearTimeout(t); rej(new Error(`snapshot exited early (${c})`)); });
});

console.log(`[sx_snap] root=${ROOT}`);
console.log(`[sx_snap] url=${info.url} dir=${info.dir} pid=${snap.pid}`);

let failed = 0;
for (const cmd of commands) {
  const args = cmd.map((a) => a.replaceAll('{URL}', info.url).replaceAll('{DIR}', info.dir));
  console.log(`\n[sx_snap] $ ${args.join(' ')}`);
  const code = await new Promise((res) => {
    const p = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, PREVIEW_BASE: info.url, SNAPSHOT_DIR: info.dir },
    });
    p.on('exit', (c) => res(c ?? 1));
  });
  if (code !== 0) {
    failed++;
    console.log(`[sx_snap] exit ${code}`);
    if (!keepGoing) break;
  }
}

snap.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 800));
try { snap.kill('SIGKILL'); } catch { /* already gone */ }
process.exit(failed ? 1 : 0);
