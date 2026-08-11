#!/usr/bin/env node
/**
 * ph_serve.mjs — serve the ARTEFACT WE SHIP, from a pinned commit, for phone probes.
 *
 * ── Why not one of the six servers this repo already has ────────────────────
 *   * `headserve.mjs` archives HEAD but runs `vite` DEV. A dev server ships unbundled
 *     ES modules over hundreds of requests and no minification. `docs/AGENT-BRIEF.md`
 *     §4.8: measure the artefact you SHIP.
 *   * `playtest.mjs` does build the production bundle — but it writes its state to a
 *     FIXED path (`$TMPDIR/fa-playtest.json`) and "re-running replaces the previous
 *     session". Uri or a peer may have one running. Starting one here would kill it.
 *   * `snapshot.mjs` / `with_snapshot.mjs` freeze the WORKING tree, which in a
 *     seven-agent session is seven people's half-saved files.
 *
 * So this one: `git archive <sha>` → `DEPLOY_BASE=./ vite build` → a plain static
 * server on an ephemeral port, state under this session's scratchpad, and it kills
 * **by recorded PID** (never `pkill -f`, CLAUDE.md 8b).
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/ph_serve.mjs --start [--ref <sha>]   # build + detach, prints URL
 *   node tools/tmp/ph_serve.mjs --url                   # print the live URL only
 *   node tools/tmp/ph_serve.mjs --stop                  # kill by PID, delete the dir
 *
 * The build is `DEPLOY_BASE=./` — the relative base `docs/APP.md` §2 says the wrapper
 * payload uses, and the one that also passes at any prefix. That makes this the closest
 * artefact in the repo to what a Capacitor app would actually run.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync,
  writeFileSync, statSync, createReadStream,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize } from 'node:path';
import http from 'node:http';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
// Session scratchpads are cleaned; `docs/AGENT-BRIEF.md` opens with a brief that
// silently vanished from one. So the state path is durable by default and the
// scratchpad is opt-in via PH_SCRATCH.
const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const LOG = join(SCRATCH, 'ph-serve.log');

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const val = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

// ───────────────────────── the detached server child ─────────────────────────
if (argv[0] === '--serve') {
  const dir = argv[1];
  const port = Number(argv[2]);
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = join(dir, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file) || !statSync(file).isFile()) file = join(dir, 'index.html'); // SPA fallback
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      // A phone probe measures decode+parse, not the CDN. Serve identity encoding so a
      // byte figure quoted here is the byte figure the parser sees.
      'access-control-allow-origin': '*',
    });
    createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`ph_serve listening ${port}`));
  // keep alive
} else if (has('stop')) {
  if (!existsSync(STATE)) { console.log('ph_serve: nothing running'); process.exit(0); }
  const s = JSON.parse(readFileSync(STATE, 'utf8'));
  try { process.kill(s.pid, 'SIGTERM'); } catch { /* already gone */ }
  try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  rmSync(STATE, { force: true });
  console.log(`ph_serve: stopped pid ${s.pid}, removed ${s.dir}`);
} else if (has('url')) {
  if (!existsSync(STATE)) { console.error('ph_serve: not running'); process.exit(1); }
  console.log(JSON.parse(readFileSync(STATE, 'utf8')).url);
} else if (has('start')) {
  mkdirSync(SCRATCH, { recursive: true });
  if (existsSync(STATE)) {
    const old = JSON.parse(readFileSync(STATE, 'utf8'));
    try { process.kill(old.pid, 'SIGTERM'); } catch { /* gone */ }
    try { rmSync(old.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  const ref = val('ref', 'HEAD');
  const sha = spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', `${ref}^{commit}`],
    { encoding: 'utf8' }).stdout.trim();
  if (!sha) { console.error(`ph_serve: cannot resolve ${ref}`); process.exit(1); }

  const dir = mkdtempSync(join(tmpdir(), 'fa-ph-'));
  const r = spawnSync('bash', ['-c', `git -C "${ROOT}" archive ${sha} | tar -x -C "${dir}"`],
    { stdio: 'inherit' });
  if (r.status !== 0) { rmSync(dir, { recursive: true, force: true }); process.exit(1); }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

  console.log(`ph_serve: building ${sha.slice(0, 7)} with DEPLOY_BASE=./ …`);
  const b = spawnSync('npx', ['vite', 'build'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, DEPLOY_BASE: './' },
  });
  if (b.status !== 0) {
    console.error(b.stdout, b.stderr);
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }
  const dist = join(dir, 'dist');
  const port = await new Promise((res, rej) => {
    const srv = net.createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => res(port)); });
  });
  const out = openSync(LOG, 'a');
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, '--serve', dist, String(port)],
    { detached: true, stdio: ['ignore', out, out] });
  child.unref();
  const url = `http://127.0.0.1:${port}`;
  writeFileSync(STATE, JSON.stringify({ pid: child.pid, port, url, dir, dist, sha }, null, 2));
  // Wait for the socket rather than guessing.
  const deadline = Date.now() + 20_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    up = await new Promise((res) => {
      const s = net.connect(port, '127.0.0.1');
      s.on('connect', () => { s.destroy(); res(true); });
      s.on('error', () => res(false));
      setTimeout(() => { s.destroy(); res(false); }, 400);
    });
    if (!up) await new Promise((rr) => setTimeout(rr, 300));
  }
  if (!up) { console.error('ph_serve: server did not come up'); process.exit(1); }
  console.log(`ph_serve: ${sha.slice(0, 7)} (production build, base "./") at ${url}   pid ${child.pid}`);
} else {
  console.error('usage: node tools/tmp/ph_serve.mjs --start|--url|--stop [--ref <sha>]');
  process.exit(2);
}
