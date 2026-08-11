/**
 * sc2_lib — the shared half of the SCREEN pass's tools. **EXPORTS ONLY, NO CLI PATH.**
 *
 * 🚨 `docs/AGENT-BRIEF.md` §3: three tools in this repo were made importable and thereby
 * made their whole CLI run on import — importing `snapsweep.mjs` printed a live sweep,
 * importing `da_census.mjs` fell through into `runCapture`. This file therefore has no
 * top-level statement with an effect, reads no `process.argv`, and exits nothing.
 *
 * ── What it provides, and why each piece is not borrowed from an existing tool ──
 *
 *   freeze()      HEAD + a NAMED OVERLAY of this pass's own files. `snapshot.mjs` copies
 *                 the whole working tree — "frozen is not clean" — and in a seven-agent
 *                 session that is six other people's half-saved edits compiled into the
 *                 bundle I am about to quote a number from. `ph_serve.mjs` archives a
 *                 commit and CANNOT see uncommitted work at all, which is the opposite
 *                 problem: the manifest under test is uncommitted. So: everything from
 *                 HEAD, and exactly the declared file set from the working tree.
 *   build()       a real `vite build` at a chosen base, in the frozen tree.
 *   serve()       a host as strict as GitHub Pages: outside the base is a hard 404, and
 *                 a missing ASSET is a hard 404 rather than an SPA fallback. A lenient
 *                 host is how `aud_menu_silence` once reported green on a bundle that
 *                 provably contained a broken literal.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync, existsSync, mkdtempSync, readFileSync, statSync, symlinkSync, mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize, dirname } from 'node:path';
import http from 'node:http';
import net from 'node:net';

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/**
 * The SCREEN pass's owned file set, quoted here so the overlay is a declaration rather
 * than a guess. Anything not on this list comes from HEAD.
 */
export const OWNED = [
  'index.html',
  'preview.html',
  'public/manifest.webmanifest',
  'public/icons',
  'src/render/camera.ts',
];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
/** Extensions that must NEVER be answered by the SPA fallback. */
export const ASSET_EXT = new Set(Object.keys(MIME).filter((e) => e !== '.html'));

export function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

/**
 * `git archive HEAD` into a temp dir, then copy the owned files over the top.
 *
 * @param overlay which of `OWNED` to take from the working tree. `[]` gives pure HEAD,
 *                which is what a BEFORE arm needs.
 */
export function freeze(overlay = OWNED) {
  const dir = mkdtempSync(join(tmpdir(), 'fa-sc2-'));
  const a = spawnSync('sh', ['-c', `git -C ${JSON.stringify(ROOT)} archive HEAD | tar -x -C ${JSON.stringify(dir)}`], { encoding: 'utf8' });
  if (a.status !== 0) throw new Error(`git archive HEAD failed: ${a.stderr}`);
  for (const rel of overlay) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    cpSync(src, join(dir, rel), { recursive: true });
  }
  // `public/audio/` is gitignored-adjacent history: the theme is the one asset Vite does
  // NOT resolve, and a tree without it makes the whole 404 class untestable. Copy it in
  // if the archive did not carry it.
  const theme = join(ROOT, 'public', 'audio');
  if (existsSync(theme) && !existsSync(join(dir, 'public', 'audio'))) {
    cpSync(theme, join(dir, 'public', 'audio'), { recursive: true });
  }
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

/** A real production build of `tree` at `base`. Returns the dist path. */
export function build(tree, base) {
  const r = spawnSync('npx', ['vite', 'build', '--logLevel', 'warn'], {
    cwd: tree, encoding: 'utf8', env: { ...process.env, DEPLOY_BASE: base },
  });
  if (r.status !== 0) throw new Error(`vite build at base ${base} failed:\n${r.stdout}\n${r.stderr}`);
  return join(tree, 'dist');
}

/**
 * A host as strict as GitHub Pages.
 *   1. Outside `base` is a hard 404 — a project site's apex holds nothing.
 *   2. A missing path with an ASSET extension is a hard 404, never `index.html`. A 200
 *      whose body is the shell is a masked 404 and reads as a pass.
 *
 * 🚨 THIS SERVER RUNS ON THE CALLING PROCESS'S EVENT LOOP, SO `spawnSync` DEADLOCKS IT.
 * Cost an hour here: a runner that started this host and then shelled out to `aspect.mjs`,
 * `menu_accept.mjs` and `menu_accept_portrait.mjs` with `spawnSync` got THREE identical
 * `waitUntil: 'networkidle'` timeouts, which reads exactly like "the change broke the app"
 * — three independent gates, one symptom. It was the runner: `spawnSync` blocks the loop,
 * so the server answered the child's first request and then nothing. The same URLs reach
 * networkidle in **~530 ms** when the server's process is not blocked. **Drive children
 * with `spawn`/`await`, or serve from a separate process (`headserve` / `with_snapshot`).**
 */
export async function serve(dir, base) {
  const port = await freePort();
  const b = base === '/' ? '/' : `/${base.replace(/^\/|\/$/g, '')}/`;
  const hits = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (b !== '/') {
      if (p === b.slice(0, -1)) p = '/';
      else if (p.startsWith(b)) p = `/${p.slice(b.length)}`;
      else { hits.push([404, p]); res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`outside base ${b}`); return; }
    }
    const rel = normalize(p).replace(/^(\.\.[/\\])+/, '');
    let file = join(dir, rel);
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { /* below */ }
    if (!existsSync(file)) {
      if (ASSET_EXT.has(extname(rel).toLowerCase())) {
        hits.push([404, p]);
        res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`no such asset: ${rel}`); return;
      }
      file = join(dir, 'index.html');
    }
    const body = readFileSync(file);
    hits.push([200, p]);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'content-length': body.length, 'cache-control': 'no-store',
    });
    res.end(body);
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    origin: `http://127.0.0.1:${port}`,
    base: b,
    url: `http://127.0.0.1:${port}${b}`,
    hits,
    close: () => new Promise((r) => server.close(r)),
  };
}
