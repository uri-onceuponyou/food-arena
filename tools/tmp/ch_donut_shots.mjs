#!/usr/bin/env node
/**
 * ch_donut_shots — the capture this pass is judged on, at the view Uri judges.
 *
 * A sibling agent's `ch_sushi_shots.mjs` established the shape of this tool and the
 * reasoning is unchanged, so it is restated rather than re-derived:
 *
 *  1. `shoot.mjs --char` renders at the preview's default **22 deg**, which is NOT a
 *     shipped camera. The two shipped cameras are the match's **58 deg**
 *     (`preview.ts:170`) and character select's **20 deg** (`charStage.ts:451`).
 *     `fc4d9ad` is the commit that found this: *"Uri is judging the character-select
 *     screen, which is a 20 deg camera ... nothing here has ever measured the lobby."*
 *  2. A 900x1100 full-body frame puts Donut's face at ~90 px across, and every
 *     "0% of eye pixels above 0.85 luma" finding is a FACE measurement. So each lobby
 *     view also gets a head crop taken from the **same buffer** — provably the same
 *     pixels, and zero extra GPU while ten peers are rendering.
 *
 * ── What is DONUT-specific here, and why it is not the sushi tool re-pointed ──
 * Donut is the STUB archetype and its head is a **torus**. Two consequences:
 *
 *  · The head crop cannot be the top 6-36% of the frame. The ring's HOLE is a real
 *    piece of background inside the head's own bounding box, and the face sits in the
 *    LOWER half of the ring (`donut.ts` moved it below the hole deliberately, because
 *    a critic was reading the hole as the mouth). A crop bracketing "the head" would
 *    be 40% hole. The crop here is 0.14-0.42 of the height, which is the ring's lower
 *    band plus the mouth, and `--crop-band` overrides it.
 *  · The backdrop key therefore has to survive background pixels appearing INSIDE the
 *    crop. It does — the key is the studio colour sampled from the frame corner and
 *    matched per pixel, not a border flood-fill — but it means `facePx` for this
 *    character is legitimately lower than a solid-headed character's and the two must
 *    not be compared. Only donut-vs-donut is meaningful here.
 *
 * ⚠️ KNOWN-BAD-INPUT VALIDATION (CLAUDE.md non-negotiable #6). `--selftest` feeds
 * `summarise()` synthetic fields whose answers are known BY HAND, including the two
 * ways this statistic can lie: a crop that is all backdrop (must report px 0, not a
 * confident bright share) and a two-value field (must report exactly 2 plateaus and an
 * exact `above85`). A run that does not print `selftest: N passed` has not been
 * validated on this tree.
 *
 * Usage:
 *   node tools/tmp/ch_donut_shots.mjs --selftest
 *   node tools/tmp/headserve.mjs --overlay src/characters/donut.ts -- \
 *     node tools/tmp/ch_donut_shots.mjs --out shots/ch/donut/after
 *   ... --views lobby_front,lobby_3q      # fewer page loads when the GPU is busy
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { captureSettled } from './settle.mjs';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const num = (k, d) => Number(get(k, d));

/** pitch 20 = character select (`charStage.ts:451`); pitch 58 = the match camera. */
const ALL_VIEWS = [
  { tag: 'lobby_front', yaw: 0, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_3q', yaw: 32, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: true },
  { tag: 'lobby_side', yaw: 90, pitch: 20, anim: 'idle', t: 1.5, w: 900, h: 1100, crop: false },
  { tag: 'match58_run', yaw: 210, pitch: 58, anim: 'run', t: 1.07, w: 900, h: 1100, crop: false },
];

// ── The statistic, and its known-bad-input proof ─────────────────────────────

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

/**
 * The face-value histogram over a crop of the FULL frame buffer.
 *
 * ⚠️ The backdrop must be excluded by LUMA-INDEPENDENT means, or "share above 0.85"
 * over a crop that catches studio floor is measuring the studio. The key is the mean
 * colour of the frame's top-left 8x8, which is always empty backdrop at every view
 * this tool takes, and matching is per-channel within 14/255.
 */
async function faceStats(buf, x, y, w, h) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
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

function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want, tol = 0) => {
    const g = Array.isArray(got) ? got : [got], w = Array.isArray(want) ? want : [want];
    const ok = g.length === w.length && g.every((v, i) => Math.abs(v - w[i]) <= tol);
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `   got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
    ok ? pass++ : fail++;
  };
  // A. the empty crop — the failure that would otherwise report a confident share.
  check('A1 empty field reports px 0', summarise([]).px, 0);
  check('A2 empty field reports NO above85 key', summarise([]).above85 === undefined ? 1 : 0, 1);
  // B. a two-value field: answers by hand.
  const twoVal = [...new Array(300).fill(0.20), ...new Array(700).fill(0.90)];
  const B = summarise(twoVal);
  check('B1 two plateaus', B.steps, 2);
  check('B2 above85 is exactly 0.70', B.above85, 0.70, 1e-9);
  check('B3 p05 is the dark value', B.p05, 0.20, 1e-9);
  check('B4 p95 is the bright value', B.p95, 0.90, 1e-9);
  check('B5 max is the bright value', B.max, 0.90, 1e-9);
  // C. THE KNOWN-BAD INPUT for this pass's own claim. A face with a white GLINT but no
  //    sclera — 40 bright px in 8000 — must NOT read as a bright face. 0.005 is what
  //    "0% above 0.85" actually looked like on HEAD, and the reference band is 0.31.
  const glintOnly = [...new Array(7961).fill(0.62), ...new Array(39).fill(0.99)];
  const C = summarise(glintOnly);
  // (0.004875 rounded to the 4dp the row prints — the reported number, not the raw one.)
  check('C1 a glint alone is 0.0049 above 0.85, not a bright face', C.above85, 0.0049, 1e-9);
  check('C2 and it does NOT count as a plateau (< 0.5% of px)', C.steps, 1);
  // C3 is the BOUNDARY, and the first version of C2 got it wrong: at exactly 40/8000
  // the bin holds 0.5% and the rule is `>=`, so it DOES count. Written down rather
  // than dodged, because "steps" moving by one between two runs of this pass has to be
  // attributable to the face and not to a tie at the plateau threshold.
  const glintAtEdge = [...new Array(7960).fill(0.62), ...new Array(40).fill(0.99)];
  check('C3 exactly 0.5% DOES count as a plateau (>=, not >)', summarise(glintAtEdge).steps, 2);
  // D. the sub-threshold bright value — the trap where "white" renders at 0.84 and the
  //    metric would read 0 while the eye is plainly there. It MUST read 0.
  const nearMiss = [...new Array(500).fill(0.60), ...new Array(500).fill(0.84)];
  check('D1 0.84 is NOT above 0.85 (strict)', summarise(nearMiss).above85, 0, 1e-9);
  check('D2 but max sees it', summarise(nearMiss).max, 0.84, 1e-9);
  console.log(`\nselftest: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

if (a.includes('--selftest')) process.exit(selftest() ? 0 : 1);

const BASE = (process.env.PREVIEW_BASE ?? get('--url', 'http://localhost:5173')).replace(/\/$/, '');
const OUT = get('--out', 'shots/ch/donut/now');
const ID = get('--id', 'donut');
const WANT = get('--views', null);
const VIEWS = WANT ? ALL_VIEWS.filter((v) => WANT.split(',').includes(v.tag)) : ALL_VIEWS;
// The ring's LOWER band. See the header for why this is not the sushi tool's 0.06-0.36.
//
// ⚠️ MEASURED, AND THE FIRST BAND WAS WRONG. 0.14-0.42 was carried over from the sushi
// tool's "the head is the top third" assumption and, read as a PNG (non-negotiable #3),
// it framed the TOP of the ring and the beanie — not one facial feature was inside it.
// It still returned a confident `>0.85 = 0.0265`, which is the exact shape of
// `docs/LESSONS.md` §13: a crop statistic cannot tell you it is pointed at the wrong
// thing. On the shipped lobby frame (900x1100) the eyes land at y 0.44-0.54 and the
// mouth at 0.61, so the band is 0.38-0.66 and the `.face.png` is written every run so
// the next reader can check the framing the same way.
const BAND_TOP = num('--crop-band', 0.38);
const BAND_H = num('--crop-h', 0.28);

if (!selftest()) { console.error('\n✗ selftest failed — not capturing.'); process.exit(1); }

/**
 * `--restat <dir>` recomputes the face histogram from PNGs ALREADY ON DISK — no
 * browser, no GPU, no page load. It exists because the crop band was wrong on the
 * first run and re-rendering a baseline to fix a CROP would have been a second GPU
 * capture that measured nothing new. The frame is the frame; only the window moved.
 */
const RESTAT = get('--restat', null);
if (RESTAT) {
  const out = [];
  for (const v of VIEWS.filter((v) => v.crop)) {
    const p = `${RESTAT}/${v.tag}.png`;
    const buf = await sharp(p).png().toBuffer();
    const cw = Math.round(v.w * 0.52), cx = Math.round(v.w * 0.24);
    const cy = Math.round(v.h * BAND_TOP), chh = Math.round(v.h * BAND_H);
    await writeFile(`${RESTAT}/${v.tag}.face.png`, await sharp(buf)
      .extract({ left: cx, top: cy, width: cw, height: chh })
      .resize({ width: cw * 2, kernel: 'nearest' }).png().toBuffer());
    out.push({ tag: v.tag, face: await faceStats(buf, cx, cy, cw, chh) });
  }
  console.log(`\n# RESTAT ${RESTAT}   (crop band ${BAND_TOP}..${(BAND_TOP + BAND_H).toFixed(2)})`);
  console.log('view            facePx   p05     p50     p95     max    >0.85   >0.94  steps');
  for (const r of out) {
    const f = r.face;
    console.log(`${r.tag.padEnd(14)} ${String(f.px).padStart(6)}  ${f.p05.toFixed(4)}  ${f.p50.toFixed(4)}  `
      + `${f.p95.toFixed(4)}  ${f.max.toFixed(4)}  ${f.above85.toFixed(4)}  ${f.above94.toFixed(4)}   ${f.steps}`);
  }
  await writeFile(`${RESTAT}/facestats.json`, JSON.stringify(out, null, 2));
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const rows = [];
for (const v of VIEWS) {
  const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`PAGEERROR ${v.tag}`, String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  const url = `${BASE}/preview.html?piece=character&id=${ID}&anim=${v.anim}&yaw=${v.yaw}`
    + `&t=${v.t}&pitch=${v.pitch}&shot=1`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
  await page.waitForTimeout(600);
  const path = `${OUT}/${v.tag}.png`;
  const { buf, stats } = await captureSettled(page, { path, label: v.tag, tool: 'ch_donut_shots' });
  const row = { tag: v.tag, stdev: stats.stdev, mean: stats.mean };

  if (v.crop) {
    const cw = Math.round(v.w * 0.52), cx = Math.round(v.w * 0.24);
    const cy = Math.round(v.h * BAND_TOP), chh = Math.round(v.h * BAND_H);
    const face = await sharp(buf).extract({ left: cx, top: cy, width: cw, height: chh })
      .resize({ width: cw * 2, kernel: 'nearest' }).png().toBuffer();
    await writeFile(`${OUT}/${v.tag}.face.png`, face);
    row.face = await faceStats(buf, cx, cy, cw, chh);
  }
  rows.push(row);
  await page.close();
}
await browser.close();

console.log(`\n# ${ID} @ ${BASE} -> ${OUT}   (crop band ${BAND_TOP}..${(BAND_TOP + BAND_H).toFixed(2)} of frame height)`);
console.log('view            stdev   facePx   p05     p50     p95     max    >0.85   >0.94  steps');
for (const r of rows) {
  const f = r.face;
  console.log(`${r.tag.padEnd(14)} ${String(r.stdev).padStart(6)}  `
    + (f ? `${String(f.px).padStart(6)}  ${f.p05.toFixed(4)}  ${f.p50.toFixed(4)}  ${f.p95.toFixed(4)}  ${f.max.toFixed(4)}  ${f.above85.toFixed(4)}  ${f.above94.toFixed(4)}   ${f.steps}` : '     —  (no face crop at this view)'));
}
console.log('\nreference band for a FACE crop (DECISIONS §42): >0.85 share is 0.311 / 0.341 on the two plates; ours has measured 0.000.');
await writeFile(`${OUT}/facestats.json`, JSON.stringify(rows, null, 2));
