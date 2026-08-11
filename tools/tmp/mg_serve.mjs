#!/usr/bin/env node
/**
 * mg_serve.mjs — serve the SHIPPED bundle of "HEAD plus exactly my owned files".
 *
 * ── Why not `ph_serve.mjs`, which already does 90% of this ───────────────────
 * `ph_serve` builds `git archive <sha>`, i.e. a COMMITTED tree. Measuring a change
 * before committing it therefore has only two options, and both are wrong:
 *   * build the WORKING tree (`snapshot.mjs`) — in a seven-agent session that is
 *     six other people's half-saved files in the bundle, and AGENT-BRIEF §3 says so;
 *   * commit first and measure after — which makes the commit message's numbers
 *     necessarily about a different commit.
 *
 * So this takes `git archive HEAD` — a known, clean, committed tree — and copies
 * ONLY this agent's owned file set over it. Nothing any peer has touched can reach
 * the bundle, and the diff between this build and `ph_serve --ref HEAD` is exactly
 * the patch under test.
 *
 * State and PID live under this agent's own prefix, so `--stop` here can never kill
 * a peer's `ph_serve` (CLAUDE.md 8b: kill by PID, never by pattern).
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/mg_serve.mjs --start        # build + detach, prints URL
 *   node tools/tmp/mg_serve.mjs --url
 *   node tools/tmp/mg_serve.mjs --stop
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync,
  writeFileSync, statSync, createReadStream, cpSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize, dirname } from 'node:path';
import http from 'node:http';
import net from 'node:net';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SCRATCH = process.env.MG_SCRATCH ?? join(tmpdir(), 'fa-mg');
const STATE = join(SCRATCH, 'mg-serve.json');
const LOG = join(SCRATCH, 'mg-serve.log');

/** THE OWNED FILE SET, and nothing else, is allowed to differ from HEAD. */
const OWNED = ['src/render/stage.ts', 'src/render/toon.ts', 'src/arena'];

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

if (argv[0] === '--serve') {
  const dir = argv[1];
  const port = Number(argv[2]);
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    let file = join(dir, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!existsSync(file) || !statSync(file).isFile()) file = join(dir, 'index.html');
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store', 'access-control-allow-origin': '*',
    });
    createReadStream(file).pipe(res);
  }).listen(port, '127.0.0.1', () => console.log(`mg_serve listening ${port}`));
} else if (has('stop')) {
  if (!existsSync(STATE)) { console.log('mg_serve: nothing running'); process.exit(0); }
  const s = JSON.parse(readFileSync(STATE, 'utf8'));
  try { process.kill(s.pid, 'SIGTERM'); } catch { /* already gone */ }
  try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  rmSync(STATE, { force: true });
  console.log(`mg_serve: stopped pid ${s.pid}, removed ${s.dir}`);
} else if (has('url')) {
  if (!existsSync(STATE)) { console.error('mg_serve: not running'); process.exit(1); }
  console.log(JSON.parse(readFileSync(STATE, 'utf8')).url);
} else if (has('start')) {
  mkdirSync(SCRATCH, { recursive: true });
  if (existsSync(STATE)) {
    const old = JSON.parse(readFileSync(STATE, 'utf8'));
    try { process.kill(old.pid, 'SIGTERM'); } catch { /* gone */ }
    try { rmSync(old.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  const sha = spawnSync('git', ['-C', ROOT, 'rev-parse', '--verify', 'HEAD^{commit}'],
    { encoding: 'utf8' }).stdout.trim();
  const dir = mkdtempSync(join(tmpdir(), 'fa-mg-'));
  const r = spawnSync('bash', ['-c', `git -C "${ROOT}" archive ${sha} | tar -x -C "${dir}"`], { stdio: 'inherit' });
  if (r.status !== 0) { rmSync(dir, { recursive: true, force: true }); process.exit(1); }
  for (const rel of OWNED) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    cpSync(src, join(dir, rel), { recursive: true });
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

  console.log(`mg_serve: building ${sha.slice(0, 7)} + [${OWNED.join(' ')}] with DEPLOY_BASE=./ …`);
  const b = spawnSync('npx', ['vite', 'build'], { cwd: dir, encoding: 'utf8', env: { ...process.env, DEPLOY_BASE: './' } });
  if (b.status !== 0) { console.error(b.stdout, b.stderr); rmSync(dir, { recursive: true, force: true }); process.exit(1); }

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
  if (!up) { console.error('mg_serve: server did not come up'); process.exit(1); }
  console.log(`mg_serve: ${sha.slice(0, 7)}+owned (production build, base "./") at ${url}   pid ${child.pid}`);
} else {
  console.error('usage: node tools/tmp/mg_serve.mjs --start|--url|--stop');
  process.exit(2);
}
