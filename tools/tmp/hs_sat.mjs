#!/usr/bin/env node
/**
 * HS_SAT — what does putting the HUD in the frame do to the p75-saturation gap?
 *
 * ## The lead, and why it could not be attributed
 *
 * The claim handed down was: *"ours has the lowest 75th-percentile saturation of all
 * seven images (0.510 vs a plate range of 0.551–0.835), with p75 only 0.029 above our
 * own median where one plate steps 0.305 — we appear to have no high-chroma tier at
 * all"*, and that this cannot be attributed because *"the plates' high-chroma tier is
 * largely HUD and combat VFX, both absent from our capture"*.
 *
 * ⚠️ **NO TOOL IN THIS TREE PRODUCES THOSE NUMBERS.** `v1_sat.mjs` computes `s.p75`
 * internally and never reports it (its printer and its `--out` JSON carry p25/p50/p90
 * only); `arena_ladder.mjs` reports p75 of LUMA, not saturation. So the figures are
 * unreproducible as given, and this file measures the quantity rather than inheriting
 * it. Reported as a result, per `CLAUDE.md`'s standing instruction.
 *
 * ## THE DESIGN — one variable, and a null arm that shares the confound
 *
 * Comparing a HUD-bearing directory against a HUD-less one confounds the HUD with the
 * camera, the station and the content. So both frames come from **the same live page,
 * seconds apart**, and the only difference is whether `.hud-root` is visible.
 *
 *   NULL pair       shoot(HUD on) · wait D · shoot(HUD on)
 *   TREATMENT pair  shoot(HUD on) · wait D · shoot(HUD OFF)
 *
 * Identical temporal gap, so the sim's own drift over D sits in BOTH arms. The null
 * pair's |Δp75| is the floor; a treatment |Δp75| inside it means nothing. This is the
 * `DECISIONS §62` shape — a floor built from a null arm rather than guessed.
 *
 * ## 🚨 HIDING THE HUD IS ITSELF A RULE-4 TRAP
 *
 * *"hiding `.hud-root, #screens` also hides the canvas on character-select, where the
 * canvas is a descendant"*. So the HUD-off arm never assumes: `hs_hudguard`'s probe
 * reports `canvasInsideRoot`, and this tool REFUSES to run if the canvas is inside the
 * root. `visibility:hidden` is used rather than `display:none` so layout cannot reflow
 * the canvas either, and the HUD-off frame is asserted still PAINTED afterwards. A
 * blanked control would show a huge, entirely fake saturation delta.
 *
 * ## VALIDATION
 *
 *   CROSS-CHECK  the percentile code is run against a curated plate and must reproduce
 *                `v1_sat.mjs`'s independently-written p25/p50/p90 for that plate to
 *                ±0.002. Two implementations agreeing is evidence; one implementation
 *                with a selftest is not.
 *   ORDERS       three synthetic frames authored at S = 0.20/0.40/0.60 come back in
 *                that order and at those values.
 *   SELF-PAIR    the same bytes twice must be EXACTLY equal.
 *   NON-EMPTY    every statistic asserts its pixel set non-empty and non-degenerate.
 *   GUARD-ARMS   the HUD-on frame must PASS `hs_hudguard` and the HUD-off frame must be
 *                REFUSED by it. If both passed, the two arms are not what they claim.
 *
 * ⚠️ `reference/` is gitignored and this repo is PUBLIC. This file reads plate PIXELS
 * and prints STATISTICS. Numbers disclose nothing; never add a description of a plate.
 *
 *   node tools/tmp/hs_sat.mjs --selftest
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-hs -- \
 *     node tools/tmp/hs_sat.mjs --url '{URL}' --out tools/tmp/hs_r1 --pairs 3
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readdirSync, realpathSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { frameStats, FRAME_FLOOR } from './settle.mjs';
import { hudProbeFn, HUD_SELECTORS, judgeHud, printChecks, hudSidecar } from './hs_hudguard.mjs';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);
// Derived from THIS MODULE's own location, not from `process.argv[1]`. The argv form is
// `undefined` when the module is imported (`node -e`, another tool), and `resolve()`
// throws on it — so a helper that works as a script silently cannot be reused, which is
// the opposite of why it is exported.
const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

// ── The statistic. Deliberately the SAME definition as v1_sat.mjs: HSV on 8-bit RGB,
//    S = (max-min)/max, percentiles from a 1001-bin histogram (exact to 3 decimals).
//    Written out rather than imported because v1_sat does not export it — and because
//    CROSS-CHECK is only evidence if the two are separate pieces of code.
const BINS = 1001;

/**
 * Union mask of a rect list, as a Uint8Array of w*h. Used to EXCLUDE the HUD's own
 * pixels from a single frame — a drift-free companion to the live on/off pair, because
 * the sim keeps running between two captures and a fighter can die in the gap.
 * THROWS on an empty rect list: masking nothing and calling it a control is the vacuity.
 */
export function rectMask(rects, w, h) {
  if (!Array.isArray(rects) || rects.length === 0) throw new Error('hs_sat: empty rect list — masking nothing is not a control');
  const m = new Uint8Array(w * h);
  let n = 0;
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x)); const x1 = Math.min(w, Math.ceil(r.x + r.width));
    const y0 = Math.max(0, Math.floor(r.y)); const y1 = Math.min(h, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = y * w + x; if (!m[p]) { m[p] = 1; n++; } }
  }
  if (n === 0) throw new Error('hs_sat: the rects covered 0 pixels — masking nothing is not a control');
  return { mask: m, px: n };
}

/**
 * @param exclude optional Uint8Array of w*h; pixels where it is 1 are SKIPPED.
 */
export function satStats(data, w, h, channels, exclude = null) {
  const sHist = new Uint32Array(BINS);
  let n = 0; let sSum = 0;
  const seen = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (exclude && exclude[y * w + x]) continue;
      const i = (y * w + x) * channels;
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
      const mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      const s = mx === 0 ? 0 : (mx - mn) / mx;
      sHist[Math.round(s * (BINS - 1))]++;
      sSum += s; n++;
      if (seen.size < 4096) seen.add((r << 16) | (g << 8) | b);
    }
  }
  // NON-EMPTY, asserted BEFORE anything is reported over the set.
  if (n === 0) throw new Error('hs_sat: empty pixel set — nothing to report over');
  const pct = (p) => { const t = n * p; let acc = 0; for (let i = 0; i < BINS; i++) { acc += sHist[i]; if (acc >= t) return i / (BINS - 1); } return 1; };
  return {
    n,
    distinctColours: seen.size,
    // An all-one-colour frame is a capture failure, not a measurement.
    degenerate: seen.size < 64,
    mean: sSum / n,
    p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), p90: pct(0.90),
  };
}

async function satOf(buf, exclude = null) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const st = satStats(data, info.width, info.height, info.channels, exclude);
  if (st.degenerate) throw new Error(`hs_sat: frame is DEGENERATE (${st.distinctColours} distinct colours) — a capture failure, not a measurement`);
  return st;
}

/**
 * ONE frame, two statistics: whole-frame p75 and p75 over the pixels the HUD does NOT
 * cover. Zero temporal drift by construction, so this is the arm that decides whether
 * the HUD carries a high-chroma tier. The live on/off pair answers the adjacent
 * question — what the frame looks like with the HUD gone and the scene showing through.
 */
async function maskedSat(buf, rects, vp) {
  const { mask, px } = rectMask(rects, vp.w, vp.h);
  const st = await satOf(buf, mask);
  return { ...st, maskedPx: px, maskedFrac: +(px / (vp.w * vp.h)).toFixed(5) };
}

const f3 = (x) => x.toFixed(3);
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const VIEW = { width: 1300, height: 740 };

// ═════════════════════════════════════════════════════════════════════════════
// SELFTEST
// ═════════════════════════════════════════════════════════════════════════════

async function synth(w, h, rgb) {
  const buf = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { buf[i * 3] = rgb[0]; buf[i * 3 + 1] = rgb[1]; buf[i * 3 + 2] = rgb[2]; }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}
const atS = (S) => [255, Math.round(255 * (1 - S)), Math.round(255 * (1 - S))];

/**
 * `v1_sat.mjs`'s published figures for the curated plates, read off its own report on
 * this tree. CROSS-CHECK reproduces them with code written independently of it.
 * Numbers only — nothing here describes a plate.
 */
const V1SAT_PUBLISHED = {
  'bs_01.png': { p25: 0.416, p50: 0.467, p90: 0.898 },
  'bs_02.png': { p25: 0.453, p50: 0.478, p90: 0.808 },
  'bs_03.png': { p25: 0.396, p50: 0.524, p90: 0.708 },
  'bs_04.png': { p25: 0.448, p50: 0.524, p90: 0.623 },
  'bs_05.png': { p25: 0.622, p50: 0.731, p90: 0.860 },
  'bs_06.png': { p25: 0.581, p50: 0.591, p90: 0.741 },
};

async function selftest() {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? '  ' + d : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };

  console.log('§A  ORDERS — authored saturations recovered, in order');
  const got = [];
  for (const S of [0.20, 0.40, 0.60]) {
    const st = satStats(...(await (async () => { const { data, info } = await sharp(await synth(64, 64, atS(S))).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return [data, info.width, info.height, info.channels]; })()));
    got.push(st.p50);
    ok(`A S=${S.toFixed(2)} recovered at p50`, Math.abs(st.p50 - S) < 0.005, `p50=${f3(st.p50)}`);
  }
  ok('A monotone', got[0] < got[1] && got[1] < got[2], got.map(f3).join(' < '));

  console.log('\n§B  CROSS-CHECK — reproduce v1_sat.mjs on the same plates, ±0.002');
  const plateDir = join(ROOT, 'reference/images/curated/gameplay_topdown');
  if (!existsSync(plateDir)) { ok('B plate dir present', false, plateDir); }
  else {
    const files = readdirSync(plateDir).filter((f) => /^bs_\d+\.png$/.test(f)).sort();
    ok('B NON-EMPTY the plate loader found plates', files.length >= 4, `${files.length} plates`);
    const seen = [];
    for (const f of files) {
      const want = V1SAT_PUBLISHED[f];
      if (!want) continue;
      const st = await satOf(await sharp(join(plateDir, f)).removeAlpha().png().toBuffer());
      seen.push(st.p50);
      const d = Math.max(Math.abs(st.p25 - want.p25), Math.abs(st.p50 - want.p50), Math.abs(st.p90 - want.p90));
      ok(`B ${f} agrees with v1_sat`, d <= 0.002,
        `mine p25 ${f3(st.p25)} p50 ${f3(st.p50)} p75 ${f3(st.p75)} p90 ${f3(st.p90)} · maxΔ ${d.toFixed(4)}`);
    }
    // SPREAD — if the loader were broken every plate would read identically.
    ok('B SPREAD the plates differ from each other', Math.max(...seen) - Math.min(...seen) > 0.05,
      `p50 range ${f3(Math.min(...seen))}–${f3(Math.max(...seen))}`);
  }

  console.log('\n§C  SELF-PAIR / NON-EMPTY / degeneracy');
  // SELF-PAIR runs on a REAL frame, not a synthetic one: a uniform synthetic is
  // degenerate by construction, so measuring it would exercise the refusal path rather
  // than the drift control. (That is a real bug this arm had on first run.)
  const plate0 = join(ROOT, 'reference/images/curated/gameplay_topdown/bs_01.png');
  if (existsSync(plate0)) {
    const raw = await sharp(plate0).removeAlpha().png().toBuffer();
    const a = await satOf(raw); const b = await satOf(raw);
    ok('C SELF-PAIR same bytes twice, EXACTLY equal', a.p75 === b.p75 && a.mean === b.mean, `p75 ${a.p75}`);
    ok('C SELF-PAIR the frame is NOT degenerate', a.degenerate === false, `${a.distinctColours} distinct colours`);
  } else ok('C plate present for SELF-PAIR', false, plate0);
  let threw = false;
  try { await satOf(await synth(32, 32, [10, 10, 10])); } catch { threw = true; }
  ok('C a degenerate (one-colour) frame THROWS rather than being measured', threw);
  let threw2 = false;
  try { satStats(new Uint8Array(0), 0, 0, 3); } catch { threw2 = true; }
  ok('C NON-EMPTY a 0-pixel set THROWS rather than returning NaN', threw2);

  console.log('\n§E  rectMask — the drift-free arm, and its own vacuity');
  let threw4 = false; try { rectMask([], 8, 8); } catch { threw4 = true; }
  ok('E NON-EMPTY an empty rect list THROWS — masking nothing is not a control', threw4);
  let threw5 = false; try { rectMask([{ x: 100, y: 100, width: 4, height: 4 }], 8, 8); } catch { threw5 = true; }
  ok('E NON-EMPTY rects entirely OFF-frame THROW — 0 px masked is not a control', threw5);
  ok('E MOVES a 4x4 mask in an 8x8 frame covers 16 px', rectMask([{ x: 0, y: 0, width: 4, height: 4 }], 8, 8).px === 16);
  // The mask must actually CHANGE the statistic when it removes a distinct population,
  // and must be a no-op when it removes rows of the SAME population.
  {
    const w = 64; const h = 64; const buf = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = y < 16 ? atS(0.95) : atS(0.20); const i = (y * w + x) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
    const { data, info } = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).raw().toBuffer({ resolveWithObject: true });
    const whole = satStats(data, info.width, info.height, info.channels);
    const cut = satStats(data, info.width, info.height, info.channels, rectMask([{ x: 0, y: 0, width: 64, height: 16 }], w, h).mask);
    ok('E MOVES masking out the high-chroma band LOWERS p90', cut.p90 < whole.p90 - 0.5, `p90 ${f3(whole.p90)} -> ${f3(cut.p90)}`);
    const sameCut = satStats(data, info.width, info.height, info.channels, rectMask([{ x: 0, y: 0, width: 32, height: 16 }], w, h).mask);
    ok('E HOLDS masking half the SAME band leaves the band detectable', sameCut.p90 > 0.5, `p90 ${f3(sameCut.p90)}`);
  }

  console.log('\n§D  MOVES — the statistic must respond to saturation');
  const plate = join(ROOT, 'reference/images/curated/gameplay_topdown/bs_01.png');
  if (existsSync(plate)) {
    const base = await satOf(await sharp(plate).removeAlpha().png().toBuffer());
    const down = await satOf(await sharp(plate).removeAlpha().modulate({ saturation: 0.5 }).png().toBuffer());
    const up = await satOf(await sharp(plate).removeAlpha().modulate({ saturation: 1.5 }).png().toBuffer());
    ok('D desaturating LOWERS p75', down.p75 < base.p75 - 0.02, `${f3(base.p75)} -> ${f3(down.p75)}`);
    ok('D saturating RAISES p75', up.p75 > base.p75 + 0.02, `${f3(base.p75)} -> ${f3(up.p75)}`);
  } else ok('D plate present for MOVES', false, plate);

  console.log(`\n${pass} pass, ${fail} fail`);
  return fail === 0 ? 0 : 1;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE RUN
// ═════════════════════════════════════════════════════════════════════════════

const HIDE_CSS = `${HUD_SELECTORS.root.sel}{visibility:hidden!important}`;

async function run(base) {
  const { chromium } = await import('playwright');
  const OUT = arg('out', 'tools/tmp/hs_r1');
  const PAIRS = Number(arg('pairs', '3'));
  const GAP = Number(arg('gap', '1200'));
  const SEATS = Number(arg('seats', '6'));
  const SETTLE = Number(arg('settle', '9000'));
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 160)));

  const q = new URLSearchParams({
    player: 'hamburger', enemy: 'donut',
    px: arg('px', '1400'), py: arg('py', '1000'),
    fogRadius: '1200', simSpeed: '0.30', pointerLock: '0', seats: String(SEATS),
  });
  const url = `${base}/?${q}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 180_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForTimeout(SETTLE);

  // ── The rule-4 precondition, MEASURED. ───────────────────────────────────
  const probe0 = await page.evaluate(hudProbeFn, HUD_SELECTORS);
  if (probe0.canvasInsideRoot) {
    throw new Error('hs_sat: the canvas is a DESCENDANT of .hud-root — hiding the root would blank the scene and the whole delta would be an artefact');
  }
  const g0 = judgeHud(probe0, { seats: SEATS });
  console.log(`\n── the frame under test (seats=${SEATS}) ──`);
  printChecks(g0);
  if (!g0.ok) { await browser.close(); throw new Error('hs_sat: the HUD-on arm does not pass hs_hudguard — refusing to measure'); }

  let hidden = null;
  const setHud = async (on) => {
    if (on) { if (hidden) { await page.evaluate((id) => document.getElementById(id)?.remove(), 'hs-sat-hide'); hidden = null; } }
    else if (!hidden) {
      await page.evaluate(([id, css]) => { const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s); }, ['hs-sat-hide', HIDE_CSS]);
      hidden = true;
    }
  };

  const shoot = async (name, hudOn) => {
    await setHud(hudOn);
    await page.waitForTimeout(120);
    const buf = await page.screenshot({ timeout: 180_000 });
    const fs = await frameStats(buf);
    // Rule 4: a hidden HUD must not have taken the scene with it.
    if (fs.stdev < FRAME_FLOOR) throw new Error(`hs_sat: ${name} is FLAT (stdev ${fs.stdev} < ${FRAME_FLOOR}) — the capture, not the HUD`);
    const sat = await satOf(buf);
    const dom = await page.evaluate(hudProbeFn, HUD_SELECTORS);
    const g = judgeHud(dom, { seats: SEATS });
    // The drift-free arm: only meaningful while the HUD is actually up.
    const masked = hudOn && dom.rects.length ? await maskedSat(buf, dom.rects, dom.viewport) : null;
    await writeFile(`${OUT}/${name}.png`, buf);
    await writeFile(`${OUT}/${name}.png.capture.json`, JSON.stringify({
      tool: 'tools/tmp/hs_sat.mjs', label: `${name} · hud ${hudOn ? 'ON' : 'OFF'} · ${SEATS} seats`,
      url, painted: true, stats: fs, sat, maskedSat: masked, hud: hudSidecar(dom, g),
      takenAt: new Date().toISOString(),
    }, null, 2));
    return { name, hudOn, sat, masked, fs, guardOk: g.ok, coverage: g.coverage?.frac ?? null };
  };

  // ── NULL arm: HUD on, twice, with the same gap the treatment uses. ────────
  console.log(`\n── NULL arm (${PAIRS} pairs, HUD ON both sides, ${GAP} ms apart) ──`);
  const nulls = [];
  for (let i = 0; i < PAIRS; i++) {
    const a = await shoot(`null${i}_a_hudon`, true);
    await page.waitForTimeout(GAP);
    const b = await shoot(`null${i}_b_hudon`, true);
    const d = b.sat.p75 - a.sat.p75;
    nulls.push(d);
    console.log(`  pair ${i}  p75 ${f3(a.sat.p75)} -> ${f3(b.sat.p75)}   Δ ${d >= 0 ? '+' : ''}${d.toFixed(4)}`);
  }

  // ── TREATMENT arm: HUD on -> HUD off, same gap. ──────────────────────────
  console.log(`\n── TREATMENT arm (${PAIRS} pairs, HUD ON -> HUD OFF, ${GAP} ms apart) ──`);
  const treats = [];
  const maskDeltas = [];
  const onRows = []; const offRows = [];
  for (let i = 0; i < PAIRS; i++) {
    const a = await shoot(`treat${i}_a_hudon`, true);
    await page.waitForTimeout(GAP);
    const b = await shoot(`treat${i}_b_hudoff`, false);
    // GUARD-ARMS: the two arms must be distinguishable by the guard, or they are not
    // the two arms this tool claims to be comparing.
    if (!a.guardOk) throw new Error(`hs_sat: HUD-ON frame ${a.name} was REFUSED by hs_hudguard`);
    if (b.guardOk) throw new Error(`hs_sat: HUD-OFF frame ${b.name} PASSED hs_hudguard — the HUD was not actually hidden`);
    onRows.push(a.sat); offRows.push(b.sat);
    const d = a.sat.p75 - b.sat.p75;
    treats.push(d);
    console.log(`  pair ${i}  HUD ON p75 ${f3(a.sat.p75)}  ·  HUD OFF p75 ${f3(b.sat.p75)}   Δ(on-off) ${d >= 0 ? '+' : ''}${d.toFixed(4)}   HUD covers ${((a.coverage ?? 0) * 100).toFixed(2)}%`);
    if (a.masked) {
      const dm = a.sat.p75 - a.masked.p75;
      maskDeltas.push(dm);
      console.log(`           MASKED (same frame, ${(a.masked.maskedFrac * 100).toFixed(2)}% of px removed)  p75 ${f3(a.sat.p75)} -> ${f3(a.masked.p75)}   Δ ${dm >= 0 ? '+' : ''}${dm.toFixed(4)}   ← zero temporal drift`);
    }
  }
  await setHud(true);
  await browser.close();

  const absMax = (a) => Math.max(...a.map(Math.abs));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const FLOOR = absMax(nulls);
  const EFFECT = mean(treats);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  const report = {
    tool: 'tools/tmp/hs_sat.mjs', url, seats: SEATS, pairs: PAIRS, gapMs: GAP,
    statistic: 'p75 of HSV S over the whole frame, 1001-bin histogram (v1_sat.mjs definition)',
    nullDeltas: nulls, floorAbsMax: FLOOR,
    treatmentDeltas: treats, effectMean: EFFECT,
    maskDeltas, maskEffectMean: maskDeltas.length ? mean(maskDeltas) : null,
    hudOn: { p25: med(onRows.map((r) => r.p25)), p50: med(onRows.map((r) => r.p50)), p75: med(onRows.map((r) => r.p75)), p90: med(onRows.map((r) => r.p90)) },
    hudOff: { p25: med(offRows.map((r) => r.p25)), p50: med(offRows.map((r) => r.p50)), p75: med(offRows.map((r) => r.p75)), p90: med(offRows.map((r) => r.p90)) },
    verdict: Math.abs(EFFECT) > FLOOR ? 'ABOVE FLOOR' : 'INSIDE THE FLOOR — not actionable',
    at: new Date().toISOString(),
  };
  await writeFile(`${OUT}/hs_sat.json`, JSON.stringify(report, null, 2));

  console.log('\n══ RESULT ══');
  console.log(`  NULL-ARM FLOOR (max |Δp75| with nothing changed)   ${FLOOR.toFixed(4)}`);
  console.log(`  HUD effect on p75 saturation (mean of ${PAIRS})        ${EFFECT >= 0 ? '+' : ''}${EFFECT.toFixed(4)}   [live on/off]`);
  if (maskDeltas.length) {
    const M = mean(maskDeltas);
    console.log(`  HUD effect, SAME FRAME MASKED (mean of ${maskDeltas.length})       ${M >= 0 ? '+' : ''}${M.toFixed(4)}   [zero temporal drift]`);
  }
  console.log(`  ${report.verdict}`);
  console.log(`\n  HUD ON   p25 ${f3(report.hudOn.p25)}  p50 ${f3(report.hudOn.p50)}  p75 ${f3(report.hudOn.p75)}  p90 ${f3(report.hudOn.p90)}   (p75 - p50 = ${(report.hudOn.p75 - report.hudOn.p50).toFixed(3)})`);
  console.log(`  HUD OFF  p25 ${f3(report.hudOff.p25)}  p50 ${f3(report.hudOff.p50)}  p75 ${f3(report.hudOff.p75)}  p90 ${f3(report.hudOff.p90)}   (p75 - p50 = ${(report.hudOff.p75 - report.hudOff.p50).toFixed(3)})`);
  console.log(`\n  wrote ${OUT}/hs_sat.json`);
  return 0;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();

if (isMain) {
  if (has('selftest')) process.exit(await selftest());
  const BASE = (arg('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('hs_sat: need --url or PREVIEW_BASE'); process.exit(2); }
  if (/:5173(\/|$)/.test(BASE)) { console.error('hs_sat: --url is the SHARED dev server. Never measure there.'); process.exit(2); }
  process.exit(await run(BASE));
}
