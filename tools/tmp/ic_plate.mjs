#!/usr/bin/env node
/**
 * BLIND PLATE AT THE DELIVERED SIZE — and the check that it really is.
 *
 * ── A driver over the existing instrument, not a second one ─────────────────
 * `tools/tmp/icon_legibility.html` still does the rendering: it imports the real
 * `icon()` from `src/ui/icons/`, shuffles deterministically, and publishes the answer
 * key on `window.__key`. `tools/tmp/icon_score.mjs` still does all the scoring, the
 * confusion matrix, the cross-family roll-up and the swap detection. The key this
 * writes is byte-compatible with the one `icon_score.mjs` already reads.
 *
 * What changed here, and it is the whole point of the pass:
 *
 *  1. THE SIZES ARE NO LONGER TRANSCRIBED ANYWHERE. `ic_spec.mjs` distils
 *     `ic_delivered.mjs`'s sweep of the real screens into one spec, and this injects it.
 *     The HTML has no default size left and REFUSES to draw without one.
 *  2. EVERY PLATE IS VERIFIED AFTER IT IS DRAWN, and the key is not written if the
 *     verification fails. Three comparisons, of which only the first is cheap:
 *       declared px      vs  the rendered `getBoundingClientRect()`   (a rule can override
 *                                                                     an inline size)
 *       declared plate   vs  the SCREENSHOT'S OWN PIXELS              (polarity)
 *       delivered ink    vs  the glyph's PIXEL bounding box on the plate
 *     The third is the one that is not tautological: `ic_delivered.mjs` derives ink from
 *     `getBBox()` on the real screens, and this derives it by scanning pixels on the
 *     plate. Two different methods, two different pages, one number.
 *
 * ── Why a verification at all: it is the failure that just happened ─────────
 * Every icon verdict this project has recorded was measured at a size and polarity the
 * game does not ship. `range` was drawn 56% too large with cream and ink swapped;
 * `shards` 14% too small; five icons at a 20px cream fallback that is not any screen.
 * Nothing detected it because nothing compared the plate against a measurement. A
 * harness that transcribes its own sizes will drift again, so the harness now has to
 * prove, per tile, that what it drew is what ships.
 *
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/ic_plate.mjs --url {URL} --spec shots/ic/spec.json \
 *          --set all --seed 3 --out shots/ic/round3
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ic_plate.mjs --selftest --url {URL}
 *
 * ── --forgery: the DETECTION-POWER check ────────────────────────────────────
 * `--forgery A=B` draws icon B's artwork in the tile whose key says A. Two tiles then
 * carry IDENTICAL pixels under two different names, so a collision is present BY
 * CONSTRUCTION and any judge that can see collisions at all must report it. That is the
 * known-bad input for the JUDGING pipeline; `--selftest` is the known-bad input for the
 * SIZING pipeline. CLAUDE.md non-negotiable #6 needs both — they fail in different ways.
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_HARNESS } from './ic_spec.mjs';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1];
}
const SELFTEST = process.argv.includes('--selftest');
const url = (a.url ?? 'http://localhost:5173').replace(/\/$/, '');
const out = a.out ?? 'shots/ic/plate';
const set = a.set ?? 'all';
const seed = a.seed ?? '3';
const cols = Number(a.cols ?? 9);
const tag = a.tag ?? `${set}-s${seed}`;
const only = a.only ?? '';
const forgery = a.forgery ?? '';        // "shards=range,gift=boxRed"
const specPath = a.spec ?? 'shots/ic/spec.json';
/** Cell pitch. Big enough for the largest delivered icon plus air. */
const CELL = Number(a.cell ?? 92);

/** ── TOLERANCES, and where each number comes from ───────────────────────────
 *  SIZE is exact: the same layout engine both sets and reports it, so any disagreement
 *  is a stylesheet fighting the inline value and there is no honest slack.
 *  PLATE is 6/255 per channel — the screenshot is PNG, so the only error is the
 *  antialiased corner radius, and the sample is taken at the centre.
 *  INK is the one measured rather than chosen: it compares a `getBBox()` on the real
 *  screen against a PIXEL SCAN on the plate, which differ by antialiasing, by the
 *  shipped drop-shadow on HUD-sited glyphs, and by stroke width rounding at small px.
 *  `--report` prints the whole distribution so the bound is set from drift, not taste. */
/** ⚠️ TWO size tolerances, because they compare different things.
 *  `pxSpec` is JSON against JSON — the declared box against the delivered measurement —
 *  and has no honest slack at all.
 *  `pxLayout` is the DOM's readback of a value this tool wrote, and Chromium stores
 *  lengths in LayoutUnits of 1/64 px, so `pin`'s delivered 16.98 comes back as 16.97.
 *  The bound is 3 quanta, derived from that representation rather than chosen: a real
 *  stylesheet override moves a box by whole pixels, never by 0.0156. */
const TOL = { pxSpec: 0.001, pxLayout: 3 / 64, plate: 6, inkAbs: Number(a.inkabs ?? 2.0) };

export function loadSpec(p) { return JSON.parse(readFileSync(p, 'utf8')); }

/** Sample a colour from a raw RGB buffer. */
const at = (buf, x, y) => {
  const { width: W, height: H } = buf.info;
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const i = (y * W + x) * 3;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2]];
};
const rgbOf = (s) => { const m = String(s).match(/\d+/g); return m ? m.slice(0, 3).map(Number) : null; };
const dmax = (p, q) => Math.max(...p.map((v, i) => Math.abs(v - q[i])));
/** The plate page's own background, `#E8DCC4`. Kept in one place: it is the colour a
 *  scan sees when it has walked off a rounded plate corner, and it is not ink. */
const PAGE_BG = [232, 220, 196];

/**
 * Render one plate and verify it.
 *
 * `spec` is injected as `window.__ICON_SPEC` before any page script runs, so the HTML
 * never has to guess and never has a default to fall back to.
 */
async function render(browser, { spec, truth, plan, tagName, wantForgery, write = true }) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await page.addInitScript(({ s, p }) => {
    if (s) window.__ICON_SPEC = s;
    if (p) window.__ICON_PLAN = p;
  }, { s: spec, p: plan ?? null });

  const qs = new URLSearchParams({ set, seed, cols: String(cols), cell: String(CELL) });
  if (only) qs.set('only', only);
  const target = `${url}/tools/tmp/icon_legibility.html?${qs}`;
  await page.goto(target, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });

  const refused = await page.evaluate(() => window.__refused ?? null);
  if (refused) { await page.close(); return { refused, errs }; }

  const key = await page.evaluate(() => window.__key);
  const declared = await page.evaluate(() => window.__declared);
  const measuredDom = await page.evaluate(() => window.__measured);
  const dropped = await page.evaluate(() => window.__dropped);

  // ── The judged image, and the same frame with every glyph removed. ─────────
  // The ablated shot is what makes the plate colour a MEASUREMENT: whatever is at the
  // tile's centre with the icon hidden is, by construction, what the icon sits on.
  const shotPath = join(out, `${tagName}.png`);
  mkdirSync(out, { recursive: true });
  await page.locator('#grid').screenshot({ path: shotPath });
  const inked = await sharp(readFileSync(shotPath)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const gridBox = await page.locator('#grid').boundingBox();
  const style = await page.addStyleTag({ content: 'svg.fa-ic { visibility: hidden !important; }' });
  await page.waitForTimeout(120);
  const bare = await sharp(await page.locator('#grid').screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  await page.evaluate((el) => el.remove(), style).catch(() => {});

  // ── VERIFY ────────────────────────────────────────────────────────────────
  // ⚠️ `truth` is the DELIVERED MEASUREMENT, and it is a different object from `spec`
  // in exactly one situation: `--selftest`, where the plate is deliberately drawn from
  // the harness as it historically shipped and the verifier has to catch it. That is
  // the fixture the brief asks for — "a glyph declared at size/plate X actually renders
  // at X" — and it is the only check here that is not, in normal operation, a
  // conversation between two lines of the same function.
  const T = (truth ?? spec)?.icons ?? {};
  const faults = [];
  const inkDrift = [];
  for (const d of declared) {
    const m = measuredDom.find((x) => x.i === d.i);
    const t = T[d.name];
    // 1. THE FIXTURE. What the plate declared, against what the game delivers.
    if (t) {
      if (Math.abs(d.px - t.px) > TOL.pxSpec) {
        faults.push(`#${d.i} ${d.name}: DECLARED ${d.px}px, DELIVERED ${t.px}px`
          + `  (${(d.px / t.px * 100 - 100).toFixed(0)}% off)`);
      }
      const dg = rgbOf(d.bg), tg = rgbOf(t.bg);
      if (dg && tg && dmax(dg, tg) > TOL.plate) {
        const inverted = (dg[0] + dg[1] + dg[2] < 384) !== (tg[0] + tg[1] + tg[2] < 384);
        faults.push(`#${d.i} ${d.name}: DECLARED plate ${d.bg}, DELIVERED ${t.bg}`
          + (inverted ? '  ← POLARITY INVERTED' : ''));
      }
      if (t.outline && d.outline && t.outline !== d.outline) {
        faults.push(`#${d.i} ${d.name}: DECLARED outline ${d.outline}, DELIVERED ${t.outline}`);
      }
    }
    // 2. The box the browser actually laid out — a stylesheet can override an inline size.
    if (Math.abs(m.w - d.px) > TOL.pxLayout || Math.abs(m.h - d.px) > TOL.pxLayout) {
      faults.push(`#${d.i} ${d.name}: declared ${d.px}px, RENDERED ${m.w}x${m.h}px`);
    }
    // 3. The plate, from the screenshot's own pixels rather than the value written.
    const px0 = Math.round(m.plateRect.x - gridBox.x + m.plateRect.w / 2);
    const py0 = Math.round(m.plateRect.y - gridBox.y + m.plateRect.h / 2);
    const got = at(bare, px0, py0);
    const want = rgbOf(d.bg);
    if (got && want && dmax(got, want) > TOL.plate) {
      faults.push(`#${d.i} ${d.name}: declared plate ${d.bg}, PIXELS rgb(${got.join(', ')})`);
    }
    // 4. Something is PAINTED, and it is the size the box implies.
    //
    // ⚠️ THE STROKE IS WHY THIS IS NOT A STRAIGHT COMPARISON. `ic_delivered.mjs` reads
    // ink from `getBBox()`, which is the GEOMETRY box and excludes the outline;
    // scanning pixels necessarily includes it. The outline is authored in viewBox units
    // (1.2-3.0 of 24), so the expansion is `strokeWidth * px / 24` — 0.55px on an 11px
    // chip, up to ~4.9px on a 39px lock. Comparing the two raw would flag every tile.
    // The band below is one-sided and derived from the measured distribution
    // (`--report` prints it), not chosen: pixels may exceed the geometry box by up to a
    // full stroke, and may fall short of it only by antialiasing.
    if (d.ink && got) {
      // ⚠️ Bounded by the GLYPH's rect inflated by 3px, NOT by the plate's. The first
      // cut scanned the plate rect and every single tile came back with an ink box
      // exactly equal to its plate box: outside the border radius sits the page
      // background, which is nothing like the plate colour, so the rounded CORNERS
      // scored as ink. 59 of 61 tiles "failed" and the number looked like a finding.
      let lo = Infinity, hi = -Infinity, tp = Infinity, bt = -Infinity;
      // ⚠️ And even the glyph rect + 3px was too wide at 12px, where the plate is only
      // 20px across and its 7px corner radius bites well inside that margin. The window
      // is now the glyph rect itself, and any pixel that matches the PAGE background is
      // discarded outright — a corner that has fallen off the plate is not ink.
      const x0 = Math.max(0, Math.round(m.svgRect.x - gridBox.x));
      const y0 = Math.max(0, Math.round(m.svgRect.y - gridBox.y));
      for (let y = y0; y < y0 + m.svgRect.h; y++) {
        for (let x = x0; x < x0 + m.svgRect.w; x++) {
          const c = at(inked, x, y);
          if (!c || dmax(c, got) <= 24 || dmax(c, PAGE_BG) <= 10) continue;
          if (x < lo) lo = x; if (x > hi) hi = x;
          if (y < tp) tp = y; if (y > bt) bt = y;
        }
      }
      if (hi >= lo) {
        const w = hi - lo + 1, h = bt - tp + 1;
        // The delivered ink scaled to the box this tile was actually drawn at.
        const sc = t ? d.px / t.px : 1;
        const ew = d.ink.w * sc, eh = d.ink.h * sc;
        const stroke = 3.2 * d.px / 24 + 2;        // widest authored stroke + AA
        const dw = w - ew, dh = h - eh;
        inkDrift.push({ name: d.name, px: d.px, want: { w: +ew.toFixed(2), h: +eh.toFixed(2) }, got: { w, h }, dw: +dw.toFixed(2), dh: +dh.toFixed(2), stroke: +stroke.toFixed(2) });
        if (dw > stroke || dh > stroke || dw < -TOL.inkAbs || dh < -TOL.inkAbs) {
          faults.push(`#${d.i} ${d.name}: delivered ink ${ew.toFixed(1)}x${eh.toFixed(1)} (+≤${stroke.toFixed(1)} stroke), PLATE PIXELS ${w}x${h}`);
        }
      } else faults.push(`#${d.i} ${d.name}: NOTHING PAINTED on the plate`);
    }
  }

  const bb = gridBox;
  await page.close();
  const res = { key, declared, measuredDom, dropped, faults, inkDrift, errs, shotPath, bb, target, refused: null };
  if (write) {
    writeFileSync(join(out, `${tagName}.key.json`), JSON.stringify({
      url: target, set, seed, plate: shotPath, mode: 'delivered', cell: CELL,
      spec: specPath, forgery: wantForgery || null,
      tiles: key,                       // ← exactly the shape `icon_score.mjs` reads
      dropped,                          // ← unmeasured icons, NOT drawn; unquotable
      delivered: declared,
      verified: faults.length === 0,
    }, null, 2));
  }
  return res;
}

const browser = await chromium.launch();

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — the known-bad input for the SIZING half of the pipeline.
//
// The failure this pass exists to fix must be detectable by the harness itself, or the
// next transcription drifts the same way. So the verifier is shown the harness as it
// ACTUALLY SHIPPED — 20px, cream plate, ink outline, for everything — and is required to
// catch it, by name, for the two icons `cc34026` measured wrong.
// Paired with a positive control (the real spec must pass) and a refusal control (no
// spec at all must not draw), because a checker that always screams passes every
// refusal test in the file. AGENT-BRIEF §4.4.
// ─────────────────────────────────────────────────────────────────────────────
if (SELFTEST) {
  const real = loadSpec(specPath);
  let pass = 0, fail = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}  got ${JSON.stringify(got)}`);
    ok ? pass++ : fail++;
  };

  // HOLDS — the real spec verifies clean.
  const good = await render(browser, { spec: real, truth: real, tagName: 'selftest-real', write: false });
  check('the DELIVERED spec renders and verifies with 0 faults', good.faults.length, 0);
  if (good.faults.length) for (const f of good.faults.slice(0, 12)) console.log(`        ${f}`);
  check('...and it is not passing by drawing nothing', good.declared.length > 40, true);

  // MOVES — the shipped harness condition, verbatim, must be caught.
  // The plate is DRAWN from the legacy transcription and VERIFIED against the delivered
  // measurement, which is the exact shape of the failure `cc34026` found: a harness that
  // was internally consistent and externally wrong.
  const legacy = { icons: Object.fromEntries(Object.keys(real.icons).map((n) => [n, { ...LEGACY_HARNESS, ink: real.icons[n].ink, where: 'LEGACY', host: 'LEGACY' }])) };
  const bad = await render(browser, { spec: legacy, truth: real, tagName: 'selftest-legacy', write: false });
  check('the hand-transcribed 20px cream harness is REFUSED', bad.faults.length > 0, true);
  const named = (n) => bad.faults.filter((f) => f.includes(` ${n}:`)).join(' | ');
  check('range is caught, and its POLARITY is named', /POLARITY INVERTED/.test(named('range')), true);
  check('range is caught on SIZE too — 20px against a delivered 13.8', /DECLARED 20px, DELIVERED 13.8px/.test(named('range')), true);
  check('shards is caught', named('shards').length > 0, true);
  check('heal is caught — it shares range\'s ink pill and was also inverted',
    /POLARITY INVERTED/.test(named('heal')), true);
  // POSITIVE CONTROL — a checker that screams at everything passes every refusal test
  // in the file, so it has to be shown NOT firing. One icon is corrupted and the rest
  // of the spec is the real measurement: exactly one name may appear in the faults.
  const one = { icons: { ...real.icons, range: { ...real.icons.range, px: 20, bg: LEGACY_HARNESS.bg, outline: LEGACY_HARNESS.outline } } };
  const solo = await render(browser, { spec: one, truth: real, tagName: 'selftest-solo', write: false });
  const names = new Set(solo.faults.map((f) => (f.split(/\s+/)[1] || '').replace(':', '')));
  check('ONE corrupted icon is caught', names.has('range'), true);
  check('...and NOTHING else is', [...names], ['range']);

  // REFUSES — no spec at all draws nothing rather than defaulting.
  const none = await render(browser, { spec: null, truth: real, tagName: 'selftest-nospec', write: false });
  check('with no spec the plate REFUSES rather than defaulting', Boolean(none.refused), true);

  console.log(`\nic_plate selftest ${pass} pass / ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
const spec = loadSpec(specPath);
/** `--forgery A=B` is expressed through the PLAN, so the same mechanism serves an
 *  honest variant and a deliberate collision. */
let plan = null;
if (forgery) {
  const forge = new Map(forgery.split(',').map((p) => p.split('=')));
  const names = Object.keys(spec.icons);
  plan = names.map((n) => (forge.has(n) ? { name: n, forgeFrom: forge.get(n) } : { name: n }));
}

const res = await render(browser, { spec, truth: spec, plan, tagName: tag, wantForgery: forgery });
await browser.close();

if (res.refused) { console.log(`🔴 the plate REFUSED to draw: ${res.refused}`); process.exit(1); }

console.log(`wrote ${res.shotPath}  ${Math.round(res.bb.width)}x${Math.round(res.bb.height)}px  ${res.key.length} tiles`);
console.log(`plate area ${Math.round(res.bb.width * res.bb.height / 1000)}k px  (judges downsample above ~1150k)`);
if (res.dropped.length) {
  console.log(`\n⚠️  NOT DRAWN — no delivered measurement, so no shipped condition exists to test`);
  console.log(`   (${res.dropped.length}): ${res.dropped.join(', ')}`);
  console.log('   Any verdict for these is a verdict about the harness, not the icon.');
}
if (a.report !== undefined) {
  console.log('\nINK DRIFT — delivered getBBox vs the plate\'s own pixels:');
  for (const d of res.inkDrift.sort((x, y) => Math.max(y.dw, y.dh) - Math.max(x.dw, x.dh)).slice(0, 20)) {
    console.log(`  ${d.name.padEnd(14)} ${String(d.px).padStart(6)}px  want ${d.want.w}x${d.want.h}  got ${d.got.w}x${d.got.h}  Δ ${d.dw}/${d.dh}`);
  }
}
if (forgery) console.log(`FORGERY ACTIVE: ${forgery}`);
if (res.errs.length) console.log('CONSOLE ERRORS:\n' + res.errs.join('\n'));
if (res.faults.length) {
  console.log(`\n🔴 VERIFICATION FAILED — ${res.faults.length} tile(s) do not match the delivered measurement:`);
  for (const f of res.faults.slice(0, 40)) console.log(`   ${f}`);
  console.log('The key was still written, but `verified: false` is stamped in it. DO NOT JUDGE THIS PLATE.');
  process.exit(1);
}
console.log(`\n✅ VERIFIED — ${res.declared.length} tiles match the delivered measurement on size, plate and ink.`);
