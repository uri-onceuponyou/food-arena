#!/usr/bin/env node
/**
 * ch_sushi_shots — the ONE capture this pass is allowed, at the view Uri judges.
 *
 * ── Why these four views and not `shoot.mjs --char` ──────────────────────────
 * `shoot.mjs --char` renders 13 frames at the preview's default 22 deg pitch. Two
 * problems for this pass:
 *
 *  1. `docs/TOOLS.md` records that 22 deg is NOT a shipped camera. The two shipped
 *     cameras are the match's **58 deg** (`preview.ts:170`) and character select's
 *     **20 deg** (`charStage.ts:451`), and the brief says Uri is judging the LOBBY —
 *     so 20 is the pitch that decides whether the face reads, and 58 is the pitch
 *     that decides whether the silhouette does. Both, or neither answer is shipped.
 *  2. A 900x1100 full-body frame puts this character's face at roughly 90 px across.
 *     Every "0% of eye pixels above 0.85 luma" finding is a FACE measurement, and it
 *     cannot be read off a frame where the face is 8% of the height. So each lobby
 *     view also gets a head crop, taken from the SAME buffer (not a second render),
 *     so the crop is provably the same pixels and costs no extra GPU.
 *
 * Peers are on the GPU: ONE browser, four page loads, everything else is `sharp` on
 * buffers already in memory.
 *
 * It also prints the face-value histogram the pass is actually steered by — the share
 * of the head crop above luma 0.85 and the number of distinct value plateaus — because
 * `valuescan --mode chars` measures per-JOINT and the whole face is one joint (`face`),
 * so it structurally cannot see "the sclera is not brighter than the rice".
 *
 * Usage:
 *   node tools/tmp/headserve.mjs --overlay src/characters/sushi.ts -- \
 *     node tools/tmp/ch_sushi_shots.mjs --out shots/ch/sushi/after
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { captureSettled } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/ch/sushi/now');
const ID = get('--id', 'sushi');

/** pitch 20 = character select (`charStage.ts:451`); pitch 58 = the match camera. */
const ONLY = get('--only', null);
const VIEWS = ([
  { tag: 'lobby_front', yaw: 0, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_3q', yaw: 32, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_side', yaw: 90, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: false },
  { tag: 'match58_run', yaw: 210, pitch: 58, anim: 'run', t: 1.07, w: 900, h: 1100, crop: false },
]).filter((v) => !ONLY || ONLY.split(',').includes(v.tag));

/**
 * ── KNOWN-BAD INPUTS, run before any pixel is believed ───────────────────────
 * CLAUDE.md #6: a guard that has not been shown to FAIL on the bug it guards against
 * is not a guard. The bug this instrument can have is the one that made the whole cast
 * finding possible in the first place — reporting a healthy-looking bright share off a
 * crop that is mostly BACKDROP, or collapsing a genuine two-value face into "lots of
 * steps" because the bins are too fine. Both are fed here with answers derived by hand.
 */
if (a.includes('--selftest')) {
  let n = 0, bad = 0;
  const t = (name, ok, got) => { n++; if (!ok) { bad++; console.log(`FAIL ${name}  got ${got}`); } else console.log(`PASS ${name}  (${got})`); };

  // 1. A TWO-VALUE FIELD — the exact defect §42 describes ("our faces carry two values
  //    total"). 800 px at 0.20 and 200 px at 0.90, so 200/1000 = 0.20 above 0.85.
  //    (This assertion was first written as 0.25 — 200/800 — and the selftest CAUGHT
  //    it, which is the whole reason it exists. Kept as a note, not deleted.)
  const two = [...Array(800).fill(0.20), ...Array(200).fill(0.90)];
  const s2 = summarise(two);
  t('two-value field reports exactly 2 plateaus', s2.steps === 2, s2.steps);
  t('two-value field reports above85 = 0.2000', Math.abs(s2.above85 - 0.20) < 1e-9, s2.above85);

  // 2. THE KNOWN-BAD: a field with NO bright pixels at all must report 0.0000, not a
  //    small positive number. A rounding bug here would have hidden the cast defect.
  const dark = summarise(Array(1000).fill(0.42));
  t('flat mid field reports above85 = 0 (known-bad: any positive is a false pass)', dark.above85 === 0, dark.above85);
  t('flat field reports exactly 1 plateau', dark.steps === 1, dark.steps);

  // 3. A field that is ALL bright must report 1.0000 — the opposite rail.
  const bright = summarise(Array(500).fill(0.97));
  t('all-bright field reports above85 = 1', bright.above85 === 1, bright.above85);

  // 4. BACKDROP REJECTION, the instrument's own §13 risk. A 64x64 image whose left half
  //    is backdrop (30,30,40) and right half is white (255,255,255): if the backdrop
  //    leaked in, above85 would read 0.5; correctly keyed out it must read 1.0 over
  //    exactly 2048 px.
  const W = 64, H = 64, px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y * W + x) * 3;
    const v = x < W / 2 ? [30, 30, 40] : [255, 255, 255];
    px[s] = v[0]; px[s + 1] = v[1]; px[s + 2] = v[2];
  }
  const img = await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const fs4 = await faceStats(img, 0, 0, W, H);
  t('backdrop keyed out: 4096 px in, 2048 counted', fs4.px === 2048, fs4.px);
  t('backdrop keyed out: above85 = 1, not 0.5', fs4.above85 === 1, fs4.above85);

  // 5. THE KEY'S OWN LIMIT, asserted rather than assumed. A frame with NO backdrop —
  //    every pixel the same value as the corner sample — is keyed away ENTIRELY, so
  //    `px` is 0 and there is nothing to report. That is the honest failure mode and it
  //    is why every row prints `facePx`: a `facePx` near 0 means the crop missed the
  //    subject or the harness lost its backdrop, NOT that the face has no bright pixels.
  const solid = await sharp(Buffer.alloc(W * H * 3, 200), { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const fs5 = await faceStats(solid, 0, 0, W, H);
  t('a backdrop-less frame reports px=0 (the key\'s stated limit, not a silent 100%)', fs5.px === 0, fs5.px);

  console.log(`\n${n - bad}/${n} selftest checks passed`);
  process.exit(bad ? 1 : 0);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};';

for (const v of VIEWS) {
  let page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`PAGEERROR ${v.tag}`, String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript', body: HMR_STUB,
  }));
  const url = `${BASE}/preview.html?piece=character&id=${ID}&anim=${v.anim}&yaw=${v.yaw}`
    + `&t=${v.t}&pitch=${v.pitch}&shot=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(600);
  const path = `${OUT}/${v.tag}.png`;
  // ⚠️ RETRIED, AND THE RETRY IS NOT PAPERING OVER THE GUARD. Under a contended
  // SwiftShader (peers measuring on the same box) a page occasionally presents an
  // all-zero frame: `captureSettled` refused one at `stdev 0, mean 0`, correctly, and
  // killed a four-view run three views in. The guard stays — a flat frame is never
  // accepted — but a transient is retried on a FRESH page rather than being allowed to
  // cost the whole capture. If every attempt is flat, it throws exactly as before.
  let buf, stats, attempt = 0;
  for (;;) {
    try {
      ({ buf, stats } = await captureSettled(page, { path, label: v.tag, tool: 'ch_sushi_shots' }));
      break;
    } catch (e) {
      if (++attempt > 3) throw e;
      console.error(`  retry ${attempt}/3 on ${v.tag}: ${e.message.split('\n')[0]}`);
      await page.close();
      page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
      await page.waitForTimeout(1200);
    }
  }
  const row = { tag: v.tag, stdev: stats.stdev, mean: stats.mean, attempts: attempt + 1 };

  if (v.crop) {
    // Head crop from the SAME buffer. The preview frames the subject at fill 0.66
    // centred on `targetHeight = CHARACTER_HEIGHT * 0.5`, so the head sits in the
    // upper third; 0.06-0.36 of the height brackets it with margin at both pitches.
    const cw = Math.round(v.w * 0.52), cx = Math.round(v.w * 0.24);
    const cy = Math.round(v.h * 0.06), chh = Math.round(v.h * 0.30);
    const face = await sharp(buf).extract({ left: cx, top: cy, width: cw, height: chh })
      .resize({ width: cw * 2, kernel: 'nearest' }).png().toBuffer();
    await writeFile(`${OUT}/${v.tag}.face.png`, face);
    row.face = await faceStats(buf, cx, cy, cw, chh);
  }
  rows.push(row);
  await page.close();
}
await browser.close();

/**
 * The face-value histogram, on the crop's pixels.
 *
 * ⚠️ VALIDATED AGAINST A KNOWN-BAD INPUT, because a "share above 0.85" over a crop that
 * accidentally includes the studio backdrop measures the backdrop. The backdrop is
 * excluded by luma-independent means (it is the mode colour of the frame border), and
 * `--selftest` below feeds the same code a synthetic crop whose answers are known by
 * hand: a 2-value field must report 2 plateaus and an exact bright share.
 */
async function faceStats(buf, x, y, w, h) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  // Backdrop key: the top-left 8x8 of the FULL frame is always empty studio.
  let br = 0, bg = 0, bb = 0, bn = 0;
  for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) {
    const s = (yy * info.width + xx) * ch;
    br += data[s]; bg += data[s + 1]; bb += data[s + 2]; bn++;
  }
  br /= bn; bg /= bn; bb /= bn;
  const lumas = [];
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const s = (yy * info.width + xx) * ch;
    const r = data[s], g = data[s + 1], b = data[s + 2];
    if (Math.abs(r - br) < 14 && Math.abs(g - bg) < 14 && Math.abs(b - bb) < 14) continue;
    lumas.push((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
  }
  return summarise(lumas);
}

function summarise(lumas) {
  if (!lumas.length) return { px: 0 };
  const s = Float64Array.from(lumas).sort();
  const q = (p) => s[Math.min(s.length - 1, Math.round((s.length - 1) * p))];
  const above = (t) => s.reduce((n, v) => n + (v > t ? 1 : 0), 0) / s.length;
  // Distinct value plateaus: 20 bins, a bin counts if it holds >= 0.5% of the pixels.
  const bins = new Array(20).fill(0);
  for (const v of s) bins[Math.min(19, Math.floor(v * 20))]++;
  const steps = bins.filter((n) => n / s.length >= 0.005).length;
  return {
    px: s.length,
    p05: +q(0.05).toFixed(4), p50: +q(0.5).toFixed(4), p95: +q(0.95).toFixed(4),
    max: +s[s.length - 1].toFixed(4),
    above85: +above(0.85).toFixed(4), above94: +above(0.94).toFixed(4),
    steps,
  };
}

console.log(`\n# ${ID} @ ${BASE} -> ${OUT}`);
console.log('view            stdev   facePx   p05     p50     p95     max    >0.85   >0.94  steps');
for (const r of rows) {
  const f = r.face;
  console.log(`${r.tag.padEnd(14)} ${String(r.stdev).padStart(6)}  `
    + (f ? `${String(f.px).padStart(6)}  ${f.p05.toFixed(4)}  ${f.p50.toFixed(4)}  ${f.p95.toFixed(4)}  ${f.max.toFixed(4)}  ${f.above85.toFixed(4)}  ${f.above94.toFixed(4)}   ${f.steps}` : '     —  (no face crop at this view)'));
}
console.log('\nreference band for a FACE crop (DECISIONS §42): >0.85 share is 0.311 / 0.341 on the two plates; ours has measured 0.000.');
await writeFile(`${OUT}/facestats.json`, JSON.stringify(rows, null, 2));
