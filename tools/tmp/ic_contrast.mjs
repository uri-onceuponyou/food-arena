#!/usr/bin/env node
/**
 * IS THE ICON ACTUALLY THERE? — an ABLATION, not a CSS inference.
 *
 * `ic_delivered.mjs` reports the background behind each icon by walking ancestors for
 * the first non-transparent `background-color`. That inference is WRONG whenever the
 * real plate is painted by a gradient, an image or a pseudo-element, because those
 * leave `background-color: rgba(0,0,0,0)` and the walk sails straight past them. Two
 * tiles on the first delivered-size plate came out as solid dark blobs — `check` on
 * settings and `play` on shop, both reported as ink-on-ink — and that is either
 * this project's fourth dark-on-dark shipment or an artefact of that walk.
 *
 * You cannot tell those apart from CSS. So this does what `docs/AGENT-BRIEF.md` §4.2
 * requires: **ablate, and require the frame to MOVE.** Two screenshots of the same
 * settled screen, identical but for `svg.fa-ic { visibility: hidden }`, differenced
 * inside each icon's own measured box.
 *
 *   inkFrac    fraction of the box whose pixels CHANGED when the icon was removed
 *   maxDelta   the largest per-channel change — how loud the icon is against its plate
 *
 * An icon that is drawn but invisible scores inkFrac ~ 0 with a non-zero DOM box. That
 * is exactly the failure CLAUDE.md #4 is about, and no screenshot of the screen can
 * show it, because there is nothing to see.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ic_contrast.mjs --url {URL}
 *   node tools/tmp/ic_contrast.mjs --url ... --selftest      # known-bad input
 *
 * ── --selftest: the known-bad input ─────────────────────────────────────────
 * Re-runs one screen with `svg.fa-ic { opacity: 0.004 }` — every icon still in the DOM,
 * still with a real bounding box, and invisible. Every icon must drop below the
 * INVISIBLE floor. An instrument that still calls those icons present cannot detect the
 * bug it exists to detect (CLAUDE.md non-negotiable #6).
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
}
const BASE = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const OUT = a.out ?? 'shots/ic/contrast.json';

/** Below this share of its own box, an icon has not drawn anything a viewer can see.
 *  Calibrated, not guessed: the thinnest real glyph in the set is `back` (a single
 *  2.8-unit stroke chevron), whose ink covers ~6% of its box. 1% is a sixth of that. */
const INVISIBLE = 0.01;
/** A per-channel step below this is inside PNG/AA noise on a static screen. */
const DELTA = 12;

const SCREENS = ['home', 'characters', 'trophies', 'shop', 'settings'];

async function at(page, screen) {
  await page.goto(`${BASE}/?screen=${screen}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(`window.__screen === ${JSON.stringify(screen)}`, null, { timeout: 60000 });
  try { await settleScreen(page, { label: screen, timeout: 60000 }); } catch { /* measure anyway */ }
  await page.waitForTimeout(400);
}

/** Boxes of every icon that is painted and on screen, in CSS px == image px at dsf 1. */
const BOXES = () => [...document.querySelectorAll('svg.fa-ic')].map((el) => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    name: [...el.classList].find((c) => c.startsWith('fa-ic--'))?.slice(7) ?? '?',
    x: r.x, y: r.y, w: r.width, h: r.height,
    host: el.parentElement?.className || '',
    on: cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.02
      && r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth,
  };
}).filter((b) => b.on);

/** Difference two raw RGB buffers inside one box. */
function diffBox(A, B, W, H, box) {
  const x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(W, Math.ceil(box.x + box.w)), y1 = Math.min(H, Math.ceil(box.y + box.h));
  let changed = 0, total = 0, max = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 3;
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      total++; if (d > max) max = d; if (d >= DELTA) changed++;
    }
  }
  return { inkFrac: total ? changed / total : 0, maxDelta: max, px: total };
}

const browser = await chromium.launch();
// dsf 1 so a CSS px is an image px and no rounding sits between the DOM and the pixels.
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const rows = [];
const errs = [];

/** One screen: settle, shoot, ablate with `css`, shoot again, diff every box.
 *
 *  ⚠️ `pre` is injected AFTER the navigation, never before. The first cut of the
 *  selftest added its blinding style once, up front — and `page.goto` destroys the
 *  document, so the tag went with it and every "blinded" icon was drawn at full
 *  opacity. The selftest reported 58 of 60 icons still visible, which reads exactly
 *  like a broken detector and was in fact a broken *known-bad input*: the instrument
 *  was handed a healthy screen and correctly said so. `docs/AGENT-BRIEF.md` §4.7 —
 *  a baseline is itself a measurement, and so is the poison. */
async function pass(screen, css, label, pre = '') {
  await at(page, screen);
  // ⚠️ Boxes are read BEFORE the blinding, because `BOXES` filters on opacity and the
  // blinding sets opacity — collecting after it returned ZERO boxes and printed a
  // selftest that passed by measuring nothing. A selftest that can pass vacuously is
  // worse than none: it is a tick next to an empty set.
  const boxes = await page.evaluate(BOXES);
  if (!boxes.length) return;
  if (pre) { await page.addStyleTag({ content: pre }); await page.waitForTimeout(250); }
  // ── STABILITY CONTROL, and it is not optional. ─────────────────────────────
  // An ablation attributes every changed pixel to the thing ablated. On a LIVE panel
  // that is false: character select keeps repainting (a 3D portrait render lands, the
  // ability list rebuilds), so three boxes registered inkFrac up to 0.97 in the
  // selftest — where every icon was forced invisible and the true answer was 0.00.
  // Two identical shots, 300 ms apart, with NOTHING ablated, measure that drift
  // directly. A box that is not stable gets `unstable: true` and no verdict, rather
  // than a confident wrong one.
  const before = await page.screenshot({ type: 'png' });
  await page.waitForTimeout(300);
  const control = await page.screenshot({ type: 'png' });
  const tagStyle = await page.addStyleTag({ content: css });
  await page.waitForTimeout(300);
  const after = await page.screenshot({ type: 'png' });
  await page.evaluate((el) => el.remove(), tagStyle).catch(() => {});
  const A = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const C = await sharp(control).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(after).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = A.info;
  for (const b of boxes) {
    const drift = diffBox(A.data, C.data, W, H, b);
    const abl = diffBox(C.data, B.data, W, H, b);
    rows.push({
      label, screen, ...b, ...abl,
      drift: +drift.inkFrac.toFixed(4),
      unstable: drift.inkFrac >= INVISIBLE,
    });
  }
}

if (a.selftest) {
  // KNOWN-BAD INPUT. Every icon still in the DOM with a real box, and invisible.
  // The ablation for the selftest must remove the *already invisible* icons, so it
  // compares "opacity 0.004" against "hidden" — a difference of nothing.
  for (const s of ['settings', 'shop', 'characters']) {
    try {
      await pass(s, 'svg.fa-ic { visibility: hidden !important; }', 'blinded',
        'svg.fa-ic { opacity: 0.004 !important; }');
    } catch (e) { errs.push(`${s}: ${e.message}`); }
  }
  const seen = rows.length;
  const stable = rows.filter((r) => !r.unstable);
  const stillDetected = stable.filter((r) => r.inkFrac >= INVISIBLE);
  console.log(`SELFTEST — every one of ${seen} icons was forced invisible.`);
  console.log(`  boxes on a repainting panel, no verdict: ${seen - stable.length}`);
  console.log(`  detected as present anyway: ${stillDetected.length} of ${stable.length}  (must be 0)`);
  for (const r of stillDetected.slice(0, 10)) console.log(`    FAIL ${r.screen}/${r.name} inkFrac=${r.inkFrac.toFixed(4)}`);
  const worst = Math.max(0, ...stable.map((r) => r.inkFrac));
  console.log(`  worst inkFrac ${worst.toFixed(5)} against the ${INVISIBLE} floor`);
  await browser.close();
  process.exit(stillDetected.length === 0 && stable.length > 50 ? 0 : 1);
}

for (const s of SCREENS) {
  try { await pass(s, 'svg.fa-ic { visibility: hidden !important; }', 'live'); }
  catch (e) { errs.push(`${s}: ${e.message}`); }
}
await browser.close();

rows.sort((x, y) => x.inkFrac - y.inkFrac);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ base: BASE, floor: INVISIBLE, delta: DELTA, errs, rows }, null, 2));

const dead = rows.filter((r) => !r.unstable && r.inkFrac < INVISIBLE);
const shaky = rows.filter((r) => r.unstable);
console.log('ABLATION — how much of its own box does each icon actually paint?\n');
console.log('SCREEN'.padEnd(12) + 'ICON'.padEnd(14) + 'inkFrac'.padStart(9) + 'maxΔ'.padStart(7) + '   host');
for (const r of rows.slice(0, 22)) {
  console.log(r.screen.padEnd(12) + r.name.padEnd(14) + r.inkFrac.toFixed(4).padStart(9)
    + String(r.maxDelta).padStart(7) + '   ' + r.host.slice(0, 34));
}
console.log(`\nNO VERDICT (box repainted between control shots): ${shaky.length} of ${rows.length}`);
for (const r of shaky) console.log(`  ~  ${r.screen}/${r.name} drift=${r.drift} host=${r.host}`);
console.log(`\nINVISIBLE (inkFrac < ${INVISIBLE}): ${dead.length} of ${rows.length - shaky.length} with a verdict`);
for (const r of dead) console.log(`  🚨 ${r.screen}/${r.name}  inkFrac=${r.inkFrac.toFixed(4)} maxΔ=${r.maxDelta}  host=${r.host}`);
if (errs.length) console.log('\nERRORS:\n' + errs.join('\n'));
console.log(`\nwrote ${OUT}`);
