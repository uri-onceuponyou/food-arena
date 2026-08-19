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
 * ── `--admin`: THE TUNING PANEL AND THE GAME ON ONE ORIGIN ──────────────────
 *
 * `DECISIONS-FOR-URI.md` §76 shipped a panel over 216 constants. Uri could not reach it,
 * and the reason is not a bug anywhere: **`localStorage` is ORIGIN-SCOPED.** A set tuned
 * at `http://localhost:5173` is invisible at `http://localhost:4321` and at
 * `https://uri-onceuponyou.github.io`. So "tune on the dev server, play on the deploy"
 * cannot work — it is a browser rule, not a defect. `src/admin/gate.ts` says the same
 * thing and names the only two paths that DO work; this flag is the first of them.
 *
 * `--admin` sets `VITE_FA_ADMIN=1` for the build, which is the one input
 * `src/admin/gate.ts:ADMIN_ENABLED` reads. The panel and the game then share ONE origin,
 * so a set applied in the panel is the set the match boots with.
 *
 * 🚨 **AND THE DEFAULT MUST STAY UNREACHABLE.** `tools/tmp/adm_unreachable.mjs` is the
 * control for that (§76 constraint 5): arm A builds with no flag and requires all five
 * navigation paths to REFUSE, arm B builds with the flag and requires all five to REACH.
 * `--admin` here is arm B's environment and nothing else, so it cannot weaken arm A.
 * ⚠️ Do not "simplify" this by defaulting the flag on. The refusal is the feature.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node tools/tmp/playtest.mjs            # freeze + build + serve, print the URL, exit
 *   node tools/tmp/playtest.mjs --admin    # …and carry the §76 tuning panel, same origin
 *   node tools/tmp/playtest.mjs --from head  # build the COMMITTED tree instead
 *   node tools/tmp/playtest.mjs --port 4321
 *   node tools/tmp/playtest.mjs --status
 *   node tools/tmp/playtest.mjs --stop     # stop the server and delete its temp dir
 *
 * Re-running it replaces the previous session, so "give me a fresh build with the
 * latest work in it" is the same one-liner.
 *
 * ── ⚠️ WHY `stop()` NOW WAITS, AND WHY THE SERVER 404s INSTEAD OF THROWING ───
 *
 * Both were measured on this tool's own log, not guessed. The failure a peer reported as
 * *"its frozen tree produced no `dist`"* was nothing of the kind — the build had
 * succeeded and `dist/` was on disk. The sequence in `/tmp/fa-playtest.log` was:
 *
 *   playtest serving …/fa-play-5tdLZC/dist on 4321      <- session N came up fine
 *   Error: listen EADDRINUSE 127.0.0.1:4321             <- session N+1's server died
 *   Error: ENOENT … /fa-play-5tdLZC/dist/index.html     <- session N then died too
 *
 * `stop()` sent SIGTERM and **immediately** `rmSync`'d the directory. The old server had
 * not exited yet, so (a) the replacement lost the port and died, and (b) the old server —
 * now the only one listening — was serving a tree that had just been deleted underneath
 * it, and `createReadStream(...).pipe(res)` with no `error` listener turns a missing file
 * into an **unhandled `error` event that kills the process**. The visible result is a URL
 * that answers once and then refuses connections, which reads exactly like a broken build.
 *
 * Three changes, each of which alone would have prevented it:
 *   1. `stop()` waits for the pid to actually exit (SIGKILL after a grace period) and for
 *      the port to accept a new bind, THEN deletes the directory.
 *   2. The request handler stats the file and 404s a miss; the stream carries an `error`
 *      handler. A missing file is now a 404, never a dead server.
 *   3. `listen` has an `error` handler, so EADDRINUSE prints a diagnosis to the log
 *      instead of an unhandled event, and the parent's readiness probe reports it.
 *
 * ⚠️ The readiness probe also fetches the bundle's main `<script src>`, not just `/`.
 * The SPA fallback returns `index.html` with a 200 for anything it does not hold, so a
 * 200 on `/` proves only that a server is up — `CLAUDE.md` #4, "assume it is rendering and
 * INVISIBLE". A 200 on a hashed asset filename cannot be produced by the fallback.
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
  const isFile = (f) => { try { return statSync(f).isFile(); } catch { return false; } };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p.endsWith('/')) p += 'index.html';
    let file = join(dir, p);
    // SPA fallback: any unknown path is the app's own route, not a 404. (Vite's dev
    // server does the same — `docs/LESSONS.md` §12 notes it returns 200 for anything.)
    if (!isFile(file)) {
      file = p.startsWith('/preview') ? join(dir, 'preview.html') : join(dir, 'index.html');
    }
    // ⚠️ The fallback target can be missing too — that is exactly what happened when a
    // later `stop()` deleted this directory out from under a live server. Answer 410 and
    // SAY SO rather than writing a 200 header and then dying on the stream's `error`
    // event, which is what took the process down and made a working build look broken.
    if (!isFile(file)) {
      res.writeHead(410, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      res.end(`playtest: ${file} is gone — this session's tree was deleted underneath it.\n`
        + 'Run `node tools/tmp/playtest.mjs` again.\n');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // No caching: a re-run of playtest.mjs must be visible on a plain refresh.
      'cache-control': 'no-store',
    });
    const stream = createReadStream(file);
    // Without this listener a read failure is an unhandled 'error' event, i.e. process
    // death. Measured: that is how session N died after session N+1 removed its tree.
    stream.on('error', () => { try { res.destroy(); } catch { /* already gone */ } });
    stream.pipe(res);
  });
  server.on('error', (e) => {
    console.error(`playtest: server could not listen on ${port}: ${e.code ?? e.message}`);
    if (e.code === 'EADDRINUSE') {
      console.error('        another playtest server still holds the port — run --stop, then retry.');
    }
    process.exit(1);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Can a fresh listener take this port right now? The only honest test of "released". */
function portFree(port) {
  return new Promise((res) => {
    const probe = http.createServer();
    probe.once('error', () => res(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => res(true)));
  });
}

/**
 * Stop the recorded session and delete its tree — IN THAT ORDER, waiting in between.
 *
 * 🚨 The old body sent SIGTERM and `rmSync`'d on the next line. Signal delivery is not
 * synchronous, so the tree went away while the server was still serving out of it; see
 * the header for the three-line log that shows it. **Never delete a directory a process
 * you have not confirmed dead is reading from.**
 *
 * ⚠️ Kills the RECORDED PID only — `CLAUDE.md` #8b. A `pkill -f playtest` here would match
 * every agent's copy of this tool.
 */
async function stop() {
  const s = readState();
  if (!s) { console.log('playtest: nothing running (no state file)'); return; }
  if (alive(s.pid)) {
    try { process.kill(s.pid, 'SIGTERM'); } catch { /* raced */ }
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && alive(s.pid)) await sleep(100);
    if (alive(s.pid)) {
      console.log(`playtest: pid ${s.pid} ignored SIGTERM — SIGKILL`);
      try { process.kill(s.pid, 'SIGKILL'); } catch { /* raced */ }
      while (Date.now() < deadline + 2000 && alive(s.pid)) await sleep(100);
    }
  }
  // The socket can outlive the process for a moment. A replacement that binds too early
  // dies on EADDRINUSE and leaves the OLD server as the only listener — which is how a
  // deleted tree ended up being served.
  if (s.port) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && !(await portFree(s.port))) await sleep(100);
  }
  try { rmSync(s.dir, { recursive: true, force: true }); } catch { /* best effort */ }
  try { rmSync(STATE, { force: true }); } catch { /* best effort */ }
  console.log(`playtest: stopped pid ${s.pid}, removed ${s.dir}`);
}

if (argv.includes('--stop')) { await stop(); process.exit(0); }
if (argv.includes('--status')) {
  const s = readState();
  if (!s) { console.log('playtest: not running'); process.exit(1); }
  console.log(`playtest: pid ${s.pid} ${alive(s.pid) ? 'ALIVE' : 'DEAD'}  ${s.url}  built ${s.builtAt}  from ${s.from}`
    + `\n  admin panel: ${s.admin ? `ON  ${s.url}/?screen=admin` : 'off (rebuild with --admin)'}`
    + `\n  dir ${s.dir}\n  log ${LOG}`);
  process.exit(alive(s.pid) ? 0 : 1);
}
if (argv[0] === '--serve') { /* the child above is already listening */ }
else {
  // ───────────────────────── freeze + build + serve ─────────────────────────
  const PORT = Number(arg('port', 4321));
  const FROM = String(arg('from', 'worktree'));   // worktree | head
  const ADMIN = argv.includes('--admin');

  const prev = readState();
  if (prev) {
    // ⚠️ Was `if (prev && alive(prev.pid))`, and `stop()` was called WITHOUT `await`.
    // Both were wrong. A dead session still owns a temp tree that nothing else will ever
    // remove, and the un-awaited call let the freeze/build/spawn run while the previous
    // server was still holding the port — the EADDRINUSE in the header.
    console.log(`playtest: replacing the previous session (pid ${prev.pid}, ${alive(prev.pid) ? 'alive' : 'dead'})`);
    await stop();
  }
  if (!(await portFree(PORT))) {
    console.error(`playtest: port ${PORT} is held by something this tool did not record.`);
    console.error(`          find it with:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN`);
    console.error('          then kill THAT pid — never `pkill -f playtest` (CLAUDE.md #8b).');
    process.exit(1);
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
  console.log(`playtest: building (vite build, no typecheck)${ADMIN ? ' with VITE_FA_ADMIN=1' : ''}…`);
  const b = spawnSync('npx', ['vite', 'build', '--logLevel', 'warn'], {
    cwd: dir,
    stdio: 'inherit',
    // The ONE input `src/admin/gate.ts:ADMIN_ENABLED` reads. Vite inlines `VITE_`-prefixed
    // vars into client code with no `define`; `src/admin/env.d.ts` explains why the read
    // must stay a verbatim member expression for the substitution to fold.
    env: ADMIN ? { ...process.env, VITE_FA_ADMIN: '1' } : process.env,
  });
  if (b.status !== 0) {
    console.error('\nplaytest: BUILD FAILED — a file in the tree is syntactically broken right now.');
    console.error('          Wait a moment and re-run, or use --from head to build the committed tree.');
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  }

  // The bundle's real entry filename, for a readiness probe the SPA fallback cannot fake.
  let mainAsset = null;
  try {
    const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
    mainAsset = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1] ?? null;
  } catch { /* probed below as a plain `/` fetch instead */ }

  const out = openSync(LOG, 'a');
  const child = spawn(process.execPath, [resolve(new URL(import.meta.url).pathname), '--serve', join(dir, 'dist'), String(PORT)], {
    detached: true,               // setsid(): its own session, so a SIGHUP or a
    stdio: ['ignore', out, out],  // process-group kill aimed at the parent misses it
  });
  child.unref();

  const url = `http://localhost:${PORT}`;
  writeFileSync(STATE, JSON.stringify({
    pid: child.pid, port: PORT, url, dir, from: FROM, admin: ADMIN,
    builtAt: new Date().toISOString(),
  }, null, 2));

  // Do not announce a URL that is not answering yet — that reads as a broken build.
  //
  // 🚨 `/` is NOT a sufficient probe. The SPA fallback answers 200 with `index.html` for
  // ANY path it does not hold, so a 200 on `/` is also what a server with a deleted `dist`
  // returns. Probe the hashed entry script instead: the fallback cannot manufacture a
  // `text/javascript` body, so the content-type is the discriminator.
  const probePath = mainAsset ?? '/';
  const deadline = Date.now() + 20_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    up = await new Promise((res) => {
      const req = http.get(`${url}${probePath}`, (r) => {
        r.resume();
        const ok = r.statusCode === 200
          && (!mainAsset || String(r.headers['content-type'] ?? '').includes('javascript'));
        res(ok);
      });
      req.on('error', () => res(false));
      req.setTimeout(700, () => { req.destroy(); res(false); });
    });
    if (!up) await sleep(300);
  }
  if (!up) {
    console.error(`playtest: server did not serve ${probePath} on ${PORT} — see ${LOG}`);
    process.exit(1);
  }

  console.log(`\n  ▶  PLAY HERE:   ${url}`);
  if (ADMIN) console.log(`  ⚙  TUNE HERE:   ${url}/?screen=admin`);
  console.log(`     production build of the ${FROM === 'head' ? 'COMMITTED' : 'working'} tree, frozen at ${new Date().toLocaleTimeString()}`);
  console.log(`     no HMR client, no websocket — agents can save whatever they like`);
  if (ADMIN) {
    console.log(`     ONE ORIGIN — localStorage is origin-scoped, so a set tuned in the panel above`);
    console.log(`     is the set the match on ${url} boots with. Apply & reload, then play.`);
    // ⚠️ The shell form is not decoration: `FA_TUNING` takes INLINE JSON, never a path.
    // `tuningStore.ts` throws on anything that does not start with `{`.
    console.log('     Export → Download .json, then measure that exact set offline with');
    console.log('       FA_TUNING="$(cat fa-tuning-<hash>.json)" node src/game/sim.test.mjs');
  } else {
    console.log(`     no tuning panel in this build — add --admin for the §76 panel`);
  }
  console.log(`     pid ${child.pid} · survives this shell · log ${LOG}`);
  console.log(`     refresh the build:  node tools/tmp/playtest.mjs${ADMIN ? ' --admin' : ''}${FROM === 'head' ? ' --from head' : ''}`);
  console.log(`     stop it:            node tools/tmp/playtest.mjs --stop\n`);
  process.exit(0);
}
