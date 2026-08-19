import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
// `--root <dir>` and `--base /prefix/` — because a DEPLOY build is not servable at `/`.
// `DEPLOY_BASE=/food-arena/ vite build` writes `src="/food-arena/assets/..."`, so serving
// dist at root 404s every asset. That is exactly what happened on 2026-08-19 and the
// symptom was NOT a 404: see the fallback note below.
const ARGV = process.argv.slice(2);
const argOf = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 && ARGV[i + 1] ? ARGV[i + 1] : d; };
const ROOT = argOf('--root', '/Users/uribishansky/claude-code/food-arena/dist');
/** URL prefix the bundle was built for. Must match `DEPLOY_BASE`, or nothing resolves. */
const BASE = argOf('--base', '/').replace(/\/*$/, '/');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.woff2':'font/woff2', '.png':'image/png', '.mp3':'audio/mpeg', '.webmanifest':'application/manifest+json' };
const srv = createServer((q, r) => {
  let rel = decodeURIComponent(q.url.split('?')[0]);
  if (BASE !== '/' && rel.startsWith(BASE)) rel = '/' + rel.slice(BASE.length);
  let p = join(ROOT, rel);
  // 🚨 A MISSING ASSET MUST 404, NOT FALL BACK TO index.html. The old line was
  // `if (!existsSync(p) || p.endsWith('/')) p = index.html` — unconditional, so a
  // base-prefixed bundle served at the wrong base got HTML for every `.js` and the
  // browser reported "Expected a JavaScript module but the server responded with
  // text/html". A configuration mistake wearing a MIME error's clothes, and it cost
  // real time to read. SPA fallback is for EXTENSIONLESS routes only.
  const isAsset = extname(p) !== '';
  if (!existsSync(p) || p.endsWith('/')) {
    if (isAsset) { r.writeHead(404, { 'content-type': 'text/plain' }); r.end(`404 ${rel}`); return; }
    p = join(ROOT, 'index.html');
  }
  r.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
  r.end(readFileSync(p));
}).listen(0);
const port = srv.address().port;
const b = await chromium.launch();
const pg = await b.newPage();
const errs = [];
pg.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message.split('\n')[0]));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)); });
await pg.goto(`http://localhost:${port}${BASE}`, { waitUntil: 'load' });
await pg.waitForTimeout(6000);
const screen = await pg.evaluate(() => window.__screen ?? null);
const ready = await pg.evaluate(() => window.__screenReady ?? null);
console.log(`  boot: __screen=${screen}  __screenReady=${ready}`);
console.log(errs.length ? '  🔴 ' + errs.length + ' error(s):\n    ' + errs.slice(0,5).join('\n    ') : '  ✅ zero page errors');
await b.close(); srv.close();
