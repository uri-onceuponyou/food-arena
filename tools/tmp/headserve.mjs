#!/usr/bin/env node
/**
 * Serve a PRISTINE `git archive HEAD` and run a command against it.
 *
 * `tools/snapshot.mjs` freezes the WORKING TREE, which is the right tool when you are
 * measuring your own uncommitted change. It is the wrong tool when the question is
 * "does the shipped game do X", because three peers are mid-edit in `hud.ts`,
 * `home.ts` and `arena-scan.mjs` right now and `home.ts` is ON the shipped path.
 *
 * Usage — the command runs with PREVIEW_BASE set, and the server dies with it:
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/kbdverdict.mjs
 *   node tools/tmp/headserve.mjs --ref HEAD -- node tools/tmp/input_accept.mjs
 *
 * Passing `--worktree` serves the working tree instead (same contract, so the same
 * probe can be pointed at both without editing it).
 *
 * `--overlay <path>` copies ONE working-tree path over the pristine checkout. That is
 * the combination this investigation needed: HEAD everywhere (three peers are mid-edit
 * in `hud.ts`, `home.ts` and `arena-scan.mjs`) plus exactly the files under test.
 *
 *   node tools/tmp/headserve.mjs --overlay src/game/match.ts -- node tools/tmp/input_accept.mjs
 *
 * Why a wrapper rather than `URL=$(... --json)`: that documented idiom DEADLOCKS here.
 * The node process stays alive holding its Vite child, so its stdout never EOFs and the
 * command substitution never returns. Running the measurement as a CHILD of the server
 * process sidesteps both that and `docs/LESSONS.md` §12's "snapshot servers die with the
 * shell that started them".
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, existsSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0) {
  console.error('usage: node tools/tmp/headserve.mjs [--ref <ref>] [--worktree] -- <cmd> [args...]');
  process.exit(2);
}
const flags = argv.slice(0, sep);
const cmd = argv.slice(sep + 1);
const useWorktree = flags.includes('--worktree');
const refIdx = flags.indexOf('--ref');
const ref = refIdx >= 0 ? flags[refIdx + 1] : 'HEAD';
const overlays = flags.reduce((acc, f, i) => (f === '--overlay' ? [...acc, flags[i + 1]] : acc), []);

const dir = mkdtempSync(join(tmpdir(), useWorktree ? 'fa-wt-' : 'fa-head-'));

if (useWorktree) {
  for (const entry of ['src', 'tools', 'public', 'index.html', 'preview.html', 'package.json', 'tsconfig.json']) {
    const from = join(ROOT, entry);
    if (existsSync(from)) cpSync(from, join(dir, entry), { recursive: true, dereference: false });
  }
  for (const cfg of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
    if (existsSync(join(ROOT, cfg))) cpSync(join(ROOT, cfg), join(dir, cfg));
  }
} else {
  // `git archive` writes exactly what is COMMITTED — the artefact a player would get.
  const r = spawnSync('bash', ['-c', `git -C "${ROOT}" archive ${ref} | tar -x -C "${dir}"`], { stdio: 'inherit' });
  if (r.status !== 0) { rmSync(dir, { recursive: true, force: true }); process.exit(1); }
}

for (const rel of overlays) {
  const from = join(ROOT, rel);
  if (!existsSync(from)) { console.error(`--overlay: no such path: ${rel}`); rmSync(dir, { recursive: true, force: true }); process.exit(1); }
  cpSync(from, join(dir, rel), { recursive: true, dereference: false });
}

symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

const port = await new Promise((res, rej) => {
  const srv = net.createServer();
  srv.on('error', rej);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); });
});

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  cwd: dir, stdio: 'ignore',
});

const url = `http://localhost:${port}`;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { vite.kill('SIGTERM'); } catch { /* gone */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
process.on('exit', cleanup);

const deadline = Date.now() + 90_000;
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
if (!up) { console.error(`headserve: vite did not come up on ${port}`); cleanup(); process.exit(1); }

console.log(`headserve: serving ${useWorktree ? 'WORKING TREE' : `git ${ref}`}${overlays.length ? ` + live ${overlays.join(', ')}` : ''} at ${url}\n`);

const child = spawn(cmd[0], cmd.slice(1), {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, PREVIEW_BASE: url, HEADSERVE_URL: url },
});
child.on('exit', (code, sig) => { cleanup(); process.exit(sig ? 1 : (code ?? 1)); });
