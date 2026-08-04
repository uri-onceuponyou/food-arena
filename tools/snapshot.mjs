#!/usr/bin/env node
/**
 * Frozen snapshot server — the fix for measurement contamination in a multi-agent session.
 *
 * ## The problem this exists for
 *
 * Single-owner file sets stop agents from CLOBBERING each other. They do nothing about
 * measurement, because any render of this game includes the whole tree — so every probe
 * an agent runs against the shared dev server also includes every other agent's
 * half-finished edits. That has produced, repeatedly:
 *
 *   - a whole-arena scan silently contaminated by ~40 concurrent saves to `floor.ts`
 *   - `menu_accept` failing with "execution context destroyed" (a peer's save reloads
 *     the page mid-run) and being reported as a regression when it was not
 *   - one agent's syntax error 500ing the dev server for every other agent at once
 *   - probes reading a `__stage` that a peer's screen had already disposed
 *
 * None of these are write conflicts. All of them are one shared, mutating server.
 *
 * ## What this does
 *
 * Copies the tree to a temp directory, symlinks `node_modules` (so there is no install
 * and no duplicated 200MB), starts Vite on its OWN free port, and prints the URL. The
 * copy is a point-in-time freeze: peers may save whatever they like afterwards and this
 * server will not see it. Measurements become reproducible and attributable.
 *
 * ## Use
 *
 * ⚠️ THE SERVER DIES WITH THE SHELL THAT STARTED IT. Backgrounding it in one tool call
 * and measuring in the next does NOT work — the process is reaped when its spawning shell
 * exits, and the death presents as ERR_CONNECTION_REFUSED, which reads exactly like a
 * broken build. That cost one agent two full render batches. **Start the snapshot and run
 * the measurement in the SAME invocation:**
 *
 *   URL=$(node tools/snapshot.mjs --json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])") \
 *     && node tools/arena-scan.mjs --url "$URL" --out shots/scan/x
 *
 * (that form works because --json exits after printing, leaving Vite parented to the same
 * shell; keep the whole chain in one command.)
 *
 *   node tools/snapshot.mjs                 # freeze + serve, print URL, hold until Ctrl-C
 *   node tools/snapshot.mjs --json          # machine-readable {url, port, dir}
 *   node tools/snapshot.mjs --swap src/arena/floor.ts   # freeze, but keep this file LIVE
 *
 * `--swap` is the controlled-A/B mode: everything frozen except the named file(s), which
 * are symlinked back to the working tree. That lets one agent measure ONLY its own change
 * against a stationary background — which is exactly the experiment that showed
 * "desaturate the environment" was the wrong instruction.
 *
 * Then point any tool at it:
 *
 *   node tools/arena-scan.mjs --url http://localhost:PORT --out shots/scan/x
 *   node tools/perf.mjs --mode counts --url http://localhost:PORT
 *   PREVIEW_BASE=http://localhost:PORT node tools/tmp/menu_accept.mjs
 *
 * ## Why not a git worktree
 *
 * Worktrees are the heavier tool: a fresh checkout needs its own `node_modules` (or the
 * same symlink anyway), pulls uncommitted work into scope, and adds merge coordination —
 * for a problem that is entirely about *serving*, not about version control. This copies
 * the working tree exactly as it is, including uncommitted edits, which is precisely what
 * an agent needs to measure.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, symlinkSync, existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import net from 'node:net';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const swaps = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--swap') swaps.push(args[++i]);
}

/**
 * Ask the OS for a free port rather than guessing — two agents guessing collide, which
 * is the same class of bug this whole tool exists to remove.
 *
 * Must await `listening`: `listen()` is asynchronous, so `address()` is still null on the
 * next line and destructuring it throws.
 */
function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

// Everything Vite needs to build this app. `node_modules` is symlinked, not copied;
// `shots/` and `.git` are deliberately excluded (large, and irrelevant to serving).
const INCLUDE = [
  'src', 'tools', 'public', 'index.html', 'preview.html',
  'package.json', 'tsconfig.json',
];

const dir = mkdtempSync(join(tmpdir(), 'fa-snap-'));

for (const entry of INCLUDE) {
  const from = join(ROOT, entry);
  if (!existsSync(from)) continue;
  cpSync(from, join(dir, entry), { recursive: true, dereference: false });
}
for (const cfg of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
  if (existsSync(join(ROOT, cfg))) cpSync(join(ROOT, cfg), join(dir, cfg));
}

// Symlink rather than copy: an install would take minutes and a copy ~200MB, per agent.
symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

// --swap: point named paths back at the LIVE tree, so exactly one thing moves.
for (const rel of swaps) {
  const target = join(ROOT, rel);
  const link = join(dir, rel);
  if (!existsSync(target)) {
    console.error(`--swap: no such file: ${rel}`);
    process.exit(1);
  }
  rmSync(link, { force: true, recursive: true });
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link);
}

const port = await freePort();
const vite = spawn(
  'npx',
  ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
  { cwd: dir, stdio: asJson ? 'ignore' : 'inherit' }
);

const url = `http://localhost:${port}`;

function cleanup() {
  try { vite.kill('SIGTERM'); } catch { /* already gone */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', cleanup);

// Wait for Vite to actually accept connections before announcing the URL — an agent
// that races the server sees ECONNREFUSED and usually misreports it as a broken build.
const deadline = Date.now() + 60_000;
let up = false;
while (Date.now() < deadline && !up) {
  up = await new Promise((res) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.on('connect', () => { sock.destroy(); res(true); });
    sock.on('error', () => res(false));
    setTimeout(() => { sock.destroy(); res(false); }, 500);
  });
  if (!up) await new Promise((r) => setTimeout(r, 400));
}
if (!up) {
  console.error(`snapshot: vite did not come up on ${port} within 60s`);
  cleanup();
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify({ url, port, dir, swaps }));
} else {
  console.log(`\n  frozen snapshot serving at  ${url}`);
  console.log(`  dir: ${dir}`);
  if (swaps.length) console.log(`  LIVE (not frozen): ${swaps.join(', ')}`);
  console.log(`  peers may save freely; this server will not see it.`);
  console.log(`  Ctrl-C to stop and clean up.\n`);
}
