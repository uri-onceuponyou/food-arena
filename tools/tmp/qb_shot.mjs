#!/usr/bin/env node
/**
 * qb_shot — LOOK at the character screen at Uri's device profile, and measure the
 * character's real pixel height in the backing store.
 *
 * `CLAUDE.md` non-negotiable 3: judge rendered pixels, and read the PNG. `qb_dpr.mjs`
 * proved the drawing buffer is 458x202 on a 393x852/dSF3 phone; a number that small
 * only means something once someone has looked at what it draws.
 *
 * Two captures per cell, and they are DIFFERENT QUANTITIES — conflating them is how a
 * resolution claim goes wrong:
 *
 *   `*-buffer.png`  `canvas.toDataURL()` — the drawing buffer at its TRUE size. This is
 *                   every pixel the GPU actually shaded. 458x202.
 *   `*-screen.png`  a page screenshot at deviceScaleFactor 3 — what the panel shows,
 *                   i.e. the buffer above STRETCHED by the compositor. 1179x2556.
 *
 * The gap between them is the defect, and it is visible only in the second.
 *
 * ── The character's pixel height is MEASURED, not derived from `subjectFill` ─────
 * `charStage.ts` asks for `subjectFill: 0.60`, so it is tempting to report
 * `0.60 * 202 = 121 px` and stop. That would be quoting a REQUEST as a MEASUREMENT —
 * the framing solver, the podium and the intro animation all sit between the option and
 * the pixels. So the extent is found by scanning the buffer for rows differing from the
 * flat background colour, and the background is sampled from the frame's own corner
 * rather than assumed.
 *
 * ⚠️ NON-EMPTY FIRST (`CLAUDE.md` rule 6). If no row differs from the background the
 * scan reports FAIL, never "0 px". `[].every()` is `true` and a min/max over an empty
 * row set would silently produce a confident, meaningless number.
 *
 * ── Known-bad arm ───────────────────────────────────────────────────────────────
 * `--knownbad` captures the same cell at `&tier=high` (ratio 2, buffer 734x324). The
 * measured character height MUST grow. A scanner that returns the same height at both
 * tiers is measuring the layout, not the render, and its number is worthless.
 *
 *   node tools/tmp/qb_shot.mjs --tree <dir> --label cur --out <dir> --knownbad
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);

const DEV = { w: Number(get('--w', 393)), h: Number(get('--h', 852)), dsf: Number(get('--dsf', 3)) };
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
 * Grab the drawing buffer AND measure the subject's row extent inside it.
 *
 * Runs page-side so the buffer is read at native size with no compositor in the way.
 * `preserveDrawingBuffer: true` is set on every Stage in this project, which is what
 * makes `toDataURL` return the drawn frame rather than a cleared one.
 */
const GRAB = () => {
  const cv = [...document.querySelectorAll('canvas')].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0
      && r.left < window.innerWidth && r.top < window.innerHeight;
  }).pop();
  if (!cv) return { error: 'NO ON-SCREEN CANVAS — a scan here would be vacuous' };

  const off = document.createElement('canvas');
  off.width = cv.width; off.height = cv.height;
  const g = off.getContext('2d', { willReadFrequently: true });
  g.drawImage(cv, 0, 0);
  const d = g.getImageData(0, 0, off.width, off.height).data;

  // Background sampled from the frame's own top-left, never assumed. The char stage
  // clears to PORTRAIT_BG and the cyclorama fills the top corners.
  const bg = [d[0], d[1], d[2]];
  const TOL = 18; // per-channel; well above SwiftShader's dither, well below any subject
  let top = -1; let bot = -1; let left = -1; let right = -1; let diff = 0;
  for (let y = 0; y < off.height; y++) {
    for (let x = 0; x < off.width; x++) {
      const i = (y * off.width + x) * 4;
      if (Math.abs(d[i] - bg[0]) > TOL || Math.abs(d[i + 1] - bg[1]) > TOL || Math.abs(d[i + 2] - bg[2]) > TOL) {
        diff++;
        if (top < 0) top = y;
        bot = y;
        if (left < 0 || x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return {
    dataUrl: off.toDataURL('image/png'),
    bufW: off.width, bufH: off.height,
    cssW: Math.round(cv.getBoundingClientRect().width * 100) / 100,
    cssH: Math.round(cv.getBoundingClientRect().height * 100) / 100,
    bg, diffPx: diff,
    // NON-EMPTY FIRST: no differing pixel is a FAILURE, not a zero-height subject.
    subject: diff === 0 ? null : { top, bot, left, right, h: bot - top + 1, w: right - left + 1 },
    dpr: window.devicePixelRatio,
    tier: window.__renderTier,
  };
};

const tree = get('--tree');
const label = get('--label', 'run');
const outDir = get('--out', 'tools/tmp/qb_shots');
if (!tree) { console.error('need --tree'); process.exit(2); }
await mkdir(outDir, { recursive: true });

const server = await serveTree(tree);
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
let failures = 0;
const results = [];

async function cell(route, tierQ) {
  const ctx = await browser.newContext({
    viewport: { width: DEV.w, height: DEV.h }, deviceScaleFactor: DEV.dsf,
    isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${server.url}?screen=${route}${tierQ ? `&tier=${tierQ}` : ''}`,
    { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction((w) => window.__screenReady === true && window.__screen === w, route,
    { timeout: 120_000 });
  // The thumbnail generator disposes itself ~1 s in and the screen-in animation is
  // 0.26 s. Both are done well before this; the wait is for a SETTLED layout, and the
  // buffer size was already proven constant across 12 samples by `qb_dpr.mjs`.
  await page.waitForTimeout(2500);

  const g = await page.evaluate(GRAB);
  const tag = `${label}-${route}${tierQ ? `-${tierQ}` : ''}`;
  if (g.error) { console.log(`FAIL ${tag}: ${g.error}`); failures++; await ctx.close(); return null; }
  await writeFile(join(outDir, `${tag}-buffer.png`), Buffer.from(g.dataUrl.split(',')[1], 'base64'));
  await page.screenshot({ path: join(outDir, `${tag}-screen.png`) });
  await ctx.close();

  if (!g.subject) {
    console.log(`FAIL ${tag}: NO PIXEL DIFFERS FROM BACKGROUND — scan is vacuous, not "0 px"`);
    failures++;
    return null;
  }
  const nativeH = Math.round(g.cssH * DEV.dsf);
  const nativeW = Math.round(g.cssW * DEV.dsf);
  console.log(`${tag}: buffer ${g.bufW}x${g.bufH}  css ${g.cssW}x${g.cssH}  panel-native ${nativeW}x${nativeH}`);
  console.log(`   subject ${g.subject.w}x${g.subject.h} px in the buffer  (rows ${g.subject.top}-${g.subject.bot}, ${g.diffPx} px differ from bg ${g.bg})`);
  console.log(`   shortfall: buffer is ${(( g.bufW * g.bufH) / (nativeW * nativeH)).toFixed(3)}x the panel's pixel count, ${(g.bufW / nativeW).toFixed(3)}x linear`);
  results.push({ tag, route, tier: tierQ ?? g.tier, ...g, dataUrl: undefined, nativeW, nativeH });
  return g;
}

for (const route of ['home', 'characters']) {
  const lo = await cell(route, null);
  if (has('--knownbad')) {
    const hi = await cell(route, 'high');
    // The scan must MOVE when the render resolution moves. If it does not, it is
    // reading the layout and cannot support any claim about render resolution.
    if (!lo || !hi) { console.log(`  KNOWN-BAD ${route}: an arm failed — cannot judge`); failures++; }
    else {
      const moved = hi.subject.h !== lo.subject.h || hi.bufH !== lo.bufH;
      console.log(`  KNOWN-BAD ${route}: subject ${lo.subject.h}px @low -> ${hi.subject.h}px @high  => scanner ${moved ? 'SEES it (valid)' : 'BLIND (INVALID)'}`);
      if (!moved) failures++;
    }
  }
}

await browser.close();
await server.close();
await writeFile(join(outDir, `${label}-scan.json`), JSON.stringify(results, null, 2));
console.log(failures ? `\n${failures} FAILURES` : `\nwrote ${results.length} cells to ${outDir}`);
process.exit(failures ? 1 : 0);
