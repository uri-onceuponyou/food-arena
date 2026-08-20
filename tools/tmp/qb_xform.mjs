#!/usr/bin/env node
/**
 * qb_xform — IS THE CHARACTER SCREEN LEFT PERMANENTLY AT scale(0.992) AFTER A TAP?
 *
 * ── Where this came from ────────────────────────────────────────────────────────
 * `qb_dpr.mjs --nav` reached the character screen the way a player does (home -> tap
 * "Foods") instead of deep-linking `?screen=characters`, and the canvas's CSS box came
 * back **364.064 x 117.691** where the deep link reads **367 x 118.641**. The ratio is
 * 364.064/367 = 0.99200, to five figures, and 117.691/118.641 = 0.99199. That is not
 * noise and it is not a layout difference — it is exactly `fa-screen-in`'s
 * `scale(0.992)`, still applied 2.5 s after a 0.26 s animation.
 *
 * ── Why a 0.8% scale is a RESOLUTION question and not a nitpick ─────────────────
 * `getBoundingClientRect()` includes transforms, which is the trap `settle.mjs` was
 * built for. But a transform that never comes off is not a measurement artefact, it is
 * a live compositing state: a non-integer scale on the screen root means the WHOLE
 * subtree — the crisp 3x DOM text, the card art, and the canvas — is resampled off the
 * device pixel grid by the compositor. On a 3x panel that is a sub-pixel blur applied
 * to everything on the screen, which is a very good fit for *"the resolution is
 * slightly lower, or something else changed"* and for why the CHARACTER screen would
 * be named more specifically than any other.
 *
 * ⚠️ **THAT IS A MECHANISM, NOT A MEASUREMENT.** This tool measures whether the
 * transform is there and whether it is permanent. It does NOT measure that the blur is
 * visible, and it does not measure it on iOS — Safari and Chromium do not have to make
 * the same compositing choice for a non-integer transform. Both are stated as
 * unverified in the report rather than folded into the finding.
 *
 * ── What is asserted, and how it can FAIL ───────────────────────────────────────
 * `CLAUDE.md` rule 6: a check that cannot fail is not a check.
 *   * The DEEP-LINK arm is the control. It must read identity (scale 1.000). If it does
 *     not, this tool is measuring its own harness and every number is void.
 *   * The NAV arm is the subject. If it also reads identity there is no defect.
 *   * A sample series over `--seconds` distinguishes "still animating" from "stuck":
 *     `fa-screen-in` is 0.26 s, so anything still at 0.992 at t = 3 s is not mid-flight.
 *   * NON-EMPTY FIRST — if the selector matches no element the run FAILS. A mean over
 *     an empty set of transforms is a confident number about nothing.
 *
 *   node tools/tmp/qb_xform.mjs --tree <dir> --label live
 */
import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);

const D = devices[get('--device', 'iPhone 15 Pro')];
const SECONDS = Number(get('--seconds', 4));
const BASE_PATH = '/food-arena/';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.txt': 'text/plain',
};

async function serveTree(root) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length - 1);
    if (p === '/' || p === '') p = '/index.html';
    const file = join(root, p);
    if (!resolve(file).startsWith(resolve(root))) { res.writeHead(403).end(); return; }
    const st = await stat(file).catch(() => null);
    if (!st?.isFile()) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}${BASE_PATH}`, close: () => new Promise((r) => srv.close(r)) };
}

/**
 * Read every transform on the chain from the canvas up to `<html>`, plus any running
 * animations. Walking the ANCESTOR CHAIN rather than one guessed selector is the point:
 * a scale can be applied anywhere above the canvas and only the product is observable,
 * which is the same reason `settle.mjs` computes effective opacity up the chain.
 */
const XFORM = () => {
  const cv = [...document.querySelectorAll('canvas')].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
      && r.left < window.innerWidth && r.top < window.innerHeight;
  }).pop();
  if (!cv) return { error: 'NO ON-SCREEN CANVAS' };

  const chain = [];
  let n = cv;
  let productX = 1; let productY = 1;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    const t = cs.transform;
    let sx = 1; let sy = 1;
    if (t && t !== 'none') {
      const m = t.match(/matrix\(([^)]+)\)/);
      if (m) { const p = m[1].split(',').map(Number); sx = p[0]; sy = p[3]; }
      const m3 = t.match(/matrix3d\(([^)]+)\)/);
      if (m3) { const p = m3[1].split(',').map(Number); sx = p[0]; sy = p[5]; }
    }
    const anims = (n.getAnimations ? n.getAnimations() : []).map((a) => ({
      name: a.animationName ?? a.constructor.name,
      state: a.playState,
      // An INFINITE animation is expected here (`fa-rays-spin` etc.) and is not a defect.
      infinite: a.effect?.getTiming?.().iterations === Infinity,
    }));
    if (t !== 'none' || anims.length) {
      chain.push({
        tag: n.tagName, cls: String(n.className || '').slice(0, 40),
        transform: t, sx: Math.round(sx * 1e5) / 1e5, sy: Math.round(sy * 1e5) / 1e5, anims,
      });
    }
    productX *= sx; productY *= sy;
    n = n.parentElement;
  }
  const r = cv.getBoundingClientRect();
  return {
    productX: Math.round(productX * 1e5) / 1e5,
    productY: Math.round(productY * 1e5) / 1e5,
    cssW: Math.round(r.width * 1e3) / 1e3,
    cssH: Math.round(r.height * 1e3) / 1e3,
    // The canvas's own inline/attribute size, which a transform CANNOT change. The gap
    // between this and cssW is the whole finding.
    offsetW: cv.offsetWidth,
    offsetH: cv.offsetHeight,
    bufW: cv.width,
    bufH: cv.height,
    chain,
    screen: window.__screen,
  };
};

const tree = get('--tree');
const label = get('--label', 'run');
if (!tree) { console.error('need --tree'); process.exit(2); }

const server = await serveTree(tree);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});

async function arm(kind) {
  const ctx = await browser.newContext({
    viewport: D.viewport, screen: D.screen, deviceScaleFactor: D.deviceScaleFactor,
    isMobile: true, hasTouch: true, userAgent: D.userAgent,
  });
  const page = await ctx.newPage();
  if (kind === 'deeplink') {
    await page.goto(`${server.url}?screen=characters`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  } else {
    await page.goto(`${server.url}?screen=home`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForFunction(() => window.__screen === 'home' && window.__screenReady === true, null, { timeout: 120_000 });
    await page.waitForTimeout(1200);
    await page.getByText('Foods', { exact: false }).first().click({ timeout: 30_000 });
  }
  await page.waitForFunction(() => window.__screen === 'characters' && window.__screenReady === true, null, { timeout: 120_000 });

  const series = [];
  for (let t = 0; t <= SECONDS * 1000; t += 500) {
    series.push({ t, ...(await page.evaluate(XFORM)) });
    if (t < SECONDS * 1000) await page.waitForTimeout(500);
  }
  await ctx.close();
  return series;
}

let failures = 0;
const deep = await arm('deeplink');
const nav = await arm('nav');
await browser.close();
await server.close();

function report(name, series) {
  if (series.some((s) => s.error)) { console.log(`FAIL ${name}: ${series.find((s) => s.error).error}`); failures++; return null; }
  const end = series[series.length - 1];
  console.log(`\n── ${label} / ${name} ${'─'.repeat(40)}`);
  for (const s of series) {
    console.log(`  t=${String(s.t).padStart(4)}ms  scale ${s.productX} x ${s.productY}   css ${s.cssW}x${s.cssH}   offset ${s.offsetW}x${s.offsetH}   buffer ${s.bufW}x${s.bufH}`);
  }
  console.log(`  transform chain at t=${end.t}ms:`);
  if (end.chain.length === 0) console.log('    (no transforms, no animations anywhere above the canvas)');
  for (const c of end.chain) {
    console.log(`    <${c.tag} class="${c.cls}"> sx=${c.sx} sy=${c.sy}  transform=${c.transform}`);
    for (const a of c.anims) console.log(`       anim ${a.name} ${a.state}${a.infinite ? ' (infinite — expected)' : ' *** FINITE ***'}`);
  }
  return end;
}

const dEnd = report('DEEP-LINK (control)', deep);
const nEnd = report('NAV home -> tap Foods (subject)', nav);

console.log(`\n── verdict ${'─'.repeat(52)}`);
if (!dEnd || !nEnd) { console.log('  an arm failed — no verdict'); }
else {
  // CONTROL FIRST. If the deep link is not identity, the harness is the thing being
  // measured and the subject arm proves nothing.
  const controlOk = Math.abs(dEnd.productX - 1) < 1e-4 && Math.abs(dEnd.productY - 1) < 1e-4;
  console.log(`  control (deep-link) is identity: ${controlOk ? 'YES' : `NO (${dEnd.productX}) — TOOL INVALID`}`);
  if (!controlOk) failures++;
  const stuck = Math.abs(nEnd.productX - 1) > 1e-4;
  console.log(`  subject (nav) at t=${nEnd.t}ms: scale ${nEnd.productX} -> ${stuck ? '*** PERSISTENT NON-IDENTITY TRANSFORM ***' : 'identity, no defect'}`);
  if (stuck) {
    const finite = nEnd.chain.flatMap((c) => c.anims.filter((a) => !a.infinite));
    console.log(`  still-running FINITE animations: ${finite.length ? finite.map((a) => `${a.name}(${a.state})`).join(', ') : 'NONE — so this is a settled state, not an animation in flight'}`);
    console.log(`  canvas css ${nEnd.cssW}x${nEnd.cssH} vs offset ${nEnd.offsetW}x${nEnd.offsetH}  (buffer ${nEnd.bufW}x${nEnd.bufH} unchanged — the RENDER is fine, the COMPOSITE is scaled)`);
  }
}

const jsonOut = get('--json', null);
if (jsonOut) {
  await mkdir(dirname(jsonOut), { recursive: true });
  await writeFile(jsonOut, JSON.stringify({ label, deep, nav }, null, 2));
  console.log(`wrote ${jsonOut}`);
}
console.log(failures ? `\n${failures} FAILURES` : '');
process.exit(failures ? 1 : 0);
