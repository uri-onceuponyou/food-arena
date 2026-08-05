#!/usr/bin/env node
/**
 * PLAYTEST — a build Uri can actually play while six agents are saving files.
 *
 * ── The problem ─────────────────────────────────────────────────────────────
 * `npm run dev` (localhost:5173) is the SHARED dev server. Nothing in `src/` calls
 * `import.meta.hot.accept`, so every save by every agent propagates to a Vite
 * **full page reload**. Nothing in `src/` calls `history.pushState` either, so the URL
 * never changes as you navigate — which means a reload from inside a match re-derives
 * the boot route from the ORIGINAL bare `/` and lands on opening -> home.
 *
 * That is exactly "the game is crashing mid flight and starting over from homescreen".
 * It is not a game defect. It is the dev server doing its job on someone else's file.
 *
 * ── What this does ──────────────────────────────────────────────────────────
 *   1. Freezes the tree (same INCLUDE set as `tools/snapshot.mjs`, node_modules
 *      symlinked) into a temp dir, so later saves cannot reach it.
 *   2. Runs `vite build` on the frozen copy — the SHIPPED artefact. A production
 *      bundle contains no HMR client and opens no websocket at all, so there is no
 *      mechanism by which any file save can reload the page.
 *   3. Serves `dist/` with a plain static server (SPA fallback), on a fixed port.
 *   4. **Detaches it into its own session** (`detached: true` -> `setsid()`), so it
 *      survives the shell that started it. `tools/snapshot.mjs` deliberately does the
 *      opposite (`process.on('exit', cleanup)`), which is why the runbook warns that
 *      a backgrounded snapshot dies — correct for a measurement, useless for a play
 *      session that has to outlive one tool call.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/playtest.mjs            # freeze + build + serve, print the URL, exit
 *   node tools/tmp/playtest.mjs --from head  # build the COMMITTED tree instead
 *   node tools/tmp/playtest.mjs --port 4321
 *   node tools/tmp/playtest.mjs --status
 *   node tools/tmp/playtest.mjs --stop     # stop the server and delete its temp dir
 *
 * Re-running it replaces the previous session, so "give me a fresh build with the
 * latest work in it" is the same one-liner.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { createReadStream, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize } from 'node:path';
import http from 'node:http';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const STATE = join(tmpdir(), 'fa-playtest.json');
const LOG = join(tmpdir(), 'fa-playtest.log');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : (i >= 0 ? true : d);
};

// ───────────────────────── the detached server child ─────────────────────────
// Invoked as `node playtest.mjs --serve <dir> <port>`; never by a human.
if (argv[0] === '--serve') {
  const dir = argv[1];
  const port = Number(argv[2]);
  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary', '.webp': 'image/webp',
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    let file = join(dir, p);
    // SPA fallback: any unknown path is the app's own route, not a 404. (Vite's dev
    // server does the same — `docs/LESSONS.md` §12 notes it returns 200 for anything.)
    if (!existsSync(file) || !statSync(file).isFile()) {
      file = p.startsWith('/preview') ? join(dir, 'preview.html') : join(dir, 'index.html');
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // No caching: a re-run of playtest.mjs must be visible on a plain refresh.
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1', () => console.log(`playtest serving ${dir} on ${port}`));
  process.on('SIGTERM', () => { server.close(); process.exit(0); });
  // Deliberately NO cleanup on exit: this process is meant to outlive everything.
}

// ───────────────────────── control commands ─────────────────────────
function readState() {
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return null; }
}
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function stop() {
  const s = readState();
  if (!s) { console.log('playtest: nothing running (no state file)'); return; }
  if (alive(s.pid)) { try { process.kill(s.pid, 'SIGTERM'); } catch { /* raced */ } }
  try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  try { rmSync(STATE, { force: true }); } catch { /* best effort */ }
  console.log(`playtest: stopped pid ${s.pid}, removed ${s.dir}`);
}

if (argv.includes('--stop')) { stop(); process.exit(0); }
if (argv.includes('--status')) {
  const s = readState();
  if (!s) { console.log('playtest: not running'); process.exit(1); }
  console.log(`playtest: pid ${s.pid} ${alive(s.pid) ? 'ALIVE' : 'DEAD'}  ${s.url}  built ${s.builtAt}  from ${s.from}\n  dir ${s.dir}\n  log ${LOG}`);
  process.exit(alive(s.pid) ? 0 : 1);
}
if (argv[0] === '--serve') { /* the child above is already listening */ }
else {
  // ───────────────────────── freeze + build + serve ─────────────────────────
  const PORT = Number(arg('port', 4321));
  const FROM = String(arg('from', 'worktree'));   // worktree | head

  const prev = readState();
  if (prev && alive(prev.pid)) {
    console.log(`playtest: replacing the running session (pid ${prev.pid})`);
    stop();
  }

  const dir = mkdtempSync(join(tmpdir(), 'fa-play-'));
  console.log(`playtest: freezing ${FROM} -> ${dir}`);

  if (FROM === 'head') {
    // The committed tree — immune to a peer being mid-save at this exact instant.
    const r = spawnSync('sh', ['-c', `git -C '${ROOT}' archive HEAD | tar -x -C '${dir}'`], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('playtest: git archive failed'); process.exit(1); }
  } else {
    const INCLUDE = ['src', 'public', 'index.html', 'preview.html', 'package.json', 'tsconfig.json'];
    for (const entry of INCLUDE) {
      const from = join(ROOT, entry);
      if (existsSync(from)) cpSync(from, join(dir, entry), { recursive: true, dereference: false });
    }
    for (const cfg of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
      if (existsSync(join(ROOT, cfg))) cpSync(join(ROOT, cfg), join(dir, cfg));
    }
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

  // `npx vite build`, NOT `npm run build` — that script runs `tsc --noEmit` first, and a
  // peer's half-saved file would fail a type check that has nothing to do with playing
  // the game. Vite transpiles without type checking, so only a genuine SYNTAX error can
  // stop this, and that is a real reason to stop.
  console.log('playtest: building (vite build, no typecheck)…');
  const b = spawnSync('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: dir, stdio: 'inherit' });
  if (b.status !== 0) {
    console.error('\nplaytest: BUILD FAILED — a file in the tree is syntactically broken right now.');
    console.error('          Wait a moment and re-run, or use --from head to build the committed tree.');
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  const out = openSync(LOG, 'a');
  const child = spawn(process.execPath, [resolve(new URL(import.meta.url).pathname), '--serve', join(dir, 'dist'), String(PORT)], {
    detached: true,               // setsid(): its own session, so a SIGHUP or a
    stdio: ['ignore', out, out],  // process-group kill aimed at the parent misses it
  });
  child.unref();

  const url = `http://localhost:${PORT}`;
  writeFileSync(STATE, JSON.stringify({ pid: child.pid, port: PORT, url, dir, from: FROM, builtAt: new Date().toISOString() }, null, 2));

  // Do not announce a URL that is not answering yet — that reads as a broken build.
  const deadline = Date.now() + 20_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    up = await new Promise((res) => {
      const req = http.get(`${url}/`, (r) => { r.resume(); res(r.statusCode === 200); });
      req.on('error', () => res(false));
      req.setTimeout(700, () => { req.destroy(); res(false); });
    });
    if (!up) await new Promise((r) => setTimeout(r, 300));
  }
  if (!up) { console.error(`playtest: server did not answer on ${PORT} — see ${LOG}`); process.exit(1); }

  console.log(`\n  ▶  PLAY HERE:  ${url}`);
  console.log(`     production build of the ${FROM === 'head' ? 'COMMITTED' : 'working'} tree, frozen at ${new Date().toLocaleTimeString()}`);
  console.log(`     no HMR client, no websocket — agents can save whatever they like`);
  console.log(`     pid ${child.pid} · survives this shell · log ${LOG}`);
  console.log(`     refresh the build:  node tools/tmp/playtest.mjs`);
  console.log(`     stop it:            node tools/tmp/playtest.mjs --stop\n`);
  process.exit(0);
}
