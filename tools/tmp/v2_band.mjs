#!/usr/bin/env node
/**
 * V2_BAND — the HUD-free centre band, and a LIVE knob sweep priced on ONE frozen frame.
 *
 * ## The question
 *
 * Round 1's critic (item 2, `140d054`) named the remaining gap as **wash**: the play area
 * is bright and weakly chromatic where both reference plates are darker and strongly
 * chromatic. It quoted, on the band `y ∈ [0.35, 0.62]`, full width:
 *
 *     arm            meanSat   meanChroma   meanLuma
 *     ours (AFTER)    0.3810      0.2453      0.5086
 *     bs_02           0.5369      0.3020      0.3970
 *     bs_04           0.5216      0.3006      0.4735
 *
 * ⚠️ **Those are the CRITIC's numbers, not this tool's.** `--plates` and the browser arm
 * re-derive all six through one code path so the comparison is not inherited. Report what
 * this tool measures, never what the brief said it would measure.
 *
 * ## Why the band is read off the GL DRAWING BUFFER and not off a screenshot
 *
 * `locator('canvas').screenshot()` is a page capture clipped to the canvas box, so the DOM
 * HUD lands inside every "canvas" PNG (`docs/AGENT-BRIEF.md` §3). `gl.readPixels` cannot
 * see the DOM at all, so the band is HUD-free **by construction** rather than by choosing a
 * y-window that happens to miss it. The y-window is still the critic's, so the numbers
 * remain comparable to the plates, which have their own HUD and can only be cropped.
 *
 * ## Why a LIVE sweep, and what makes it trustworthy
 *
 * Every knob this tool sweeps is reachable on the running page — the grade's uniforms
 * (`window.__stage.grade`, documented as live in `stage.ts`) and the lighting rig
 * (`Stage.lighting`, a `readonly` field holding the real `THREE.Light` objects). So a whole
 * sweep runs inside ONE frozen frame: nothing in the scene moves between rows, and the
 * difference between two rows is exactly the uniforms named on them.
 *
 * That is only worth anything with three controls, and all three are ASSERTED, not printed:
 *
 *   * **SELF-PAIR** — row `shipped` is run FIRST and LAST with an empty knob set. The two
 *     must agree BIT FOR BIT (raw drawing-buffer hash, not a PNG: a PNG carries an encoder).
 *     Any drift makes every row void and the tool says so.
 *   * **POSITIVE CONTROL** — a row that drives `grade.saturation` to 5.0, which cannot
 *     leave the frame unchanged. 🚨 Without it, a mistyped knob path is SILENT: every row
 *     returns the shipped numbers and the tool reports "the render side has no lever",
 *     which is the most dangerous null there is because a null is a normal outcome
 *     (`docs/AGENT-BRIEF.md` §3, the `--ref` A/B that read the working tree for both arms).
 *   * **RESTORE** — the baseline is snapshotted before row 1 and re-applied before every
 *     row, so rows cannot accumulate. The final `shipped` row is what proves it worked.
 *
 * ## Where the tool is POINTED — `--selftest` cannot answer this and does not pretend to
 *
 * `valuescan` read a perfect selftest with 14 of 18 stations in the wrong quadrant
 * (`CLAUDE.md` #6). So the browser arm asserts, per station, before any number is believed:
 *
 *   P1  the band is NON-EMPTY (`rows[1] > rows[0]`, `n > 0`) — `[].every()` is `true`, and
 *       a mean over zero pixels is `null`, which formats as a blank and reads as "fine".
 *   P2  the band is not FLAT — luma stdev over it must exceed 0.02. A cleared buffer, a
 *       blank canvas and a solid-colour fill all pass every other check here.
 *   P3  at least one `character:*` node PROJECTS into the band's rows. The band exists to
 *       describe the play area the cast stands on; a camera looking at the sky would
 *       otherwise return a perfectly good, perfectly meaningless number — an arm of one
 *       instrument last session photographed the sky and reported PASS for exactly this
 *       reason, because it asserted the rig was reachable and never that anything was in it.
 *   P4  six fighters are in the scene, because the frame this project ships is six-player
 *       (`docs/AGENT-BRIEF.md` §4b) and a two-seat frame is a different picture.
 *
 * ## Use
 *
 *   node tools/tmp/v2_band.mjs --selftest
 *   node tools/tmp/v2_band.mjs --plates                       # no browser
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-x -- \
 *     node tools/tmp/v2_band.mjs --url '{URL}' --label before --out shots/v2band/before --sweep
 *
 *   --known-bad grey|red|blank   plant a frame whose answer is known; every arm must move
 *
 * ⚠️ `--known-bad` is the arm that matters. A tool that cannot be made to fail is not
 * measuring anything (`CLAUDE.md` #6). Run on `70ee682`, 2026-08-22, all three:
 *
 *     grey    sat 0.0000  chroma 0.0000  luma 0.5020 (=128/255)  hueR null   + P2 fires
 *     red     sat 1.0000  chroma 1.0000  luma 0.2126  ch255 1.0000  hueR 1.000  + P2 fires
 *     blank   every quantity 0, draws 0                                       + P2 fires
 *
 * 🚨 AND THE ARM CORRECTED A GUARD CLAIM IN THIS HEADER. It used to say *"blank must FAIL
 * P2 AND P3"*, kept here per `CLAUDE.md`'s reversed-assertion rule. **P3 PASSES on a
 * cleared buffer** — it projects `character:*` nodes through the camera, and clearing the
 * drawing buffer does not move the scene graph, so four characters are still legitimately
 * "in the band". P3 answers *"is the camera aimed at the cast"*; P2 answers *"did anything
 * draw"*. They are different questions and neither substitutes for the other. Writing
 * "P2 and P3" was the exact habit that produced the sky-photographing arm it was written
 * against: assuming a guard covers a failure nobody made it fail on.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const ROOT = resolve(process.argv[1], '../../..');

const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));
const Y0 = Number(get('--y0', 0.35));
const Y1 = Number(get('--y1', 0.62));

// ─────────────────────────────────────────────────────────────────────────────
// THE BAND — one implementation, injected into the page AND used node-side on the
// plates, so "the identical instrument" is a fact about the source and not a claim.
// ─────────────────────────────────────────────────────────────────────────────
const BAND_SRC = String.raw`
function vbBand(rgba, W, H, y0, y1) {
  var r0 = Math.max(0, Math.round(y0 * H));
  var r1 = Math.min(H, Math.round(y1 * H));
  var n = 0, sSum = 0, cSum = 0, lSum = 0, l2Sum = 0;
  var ch255 = 0, ch0 = 0, white = 0, chrom = 0, hx = 0, hy = 0;
  for (var y = r0; y < r1; y++) {
    for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4;
      var r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      var mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
      var mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      var s = mx === 0 ? 0 : (mx - mn) / mx;
      sSum += s;                                   // HSV saturation
      cSum += (mx - mn) / 255;                     // ABSOLUTE chroma
      var L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;   // Rec.709, sRGB-encoded
      lSum += L; l2Sum += L * L;
      // ── the gamut arms. A saturation raise's ONE real risk is pinning a channel,
      //    and stage.ts's own history is two rounds of arguing about which counter to
      //    use. Both are here, plus the near-white one a viewer could actually see.
      if (r === 255 || g === 255 || b === 255) ch255++;
      if (r === 0 || g === 0 || b === 0) ch0++;
      if (r >= 250 && g >= 250 && b >= 250) white++;
      // ── hue, as a UNIT VECTOR SUM over chromatic pixels only. Item 2's standing
      //    finding is that one hue owns the cast frame; a chroma raise must be shown
      //    NOT to concentrate it further. Sat floor 0.15 so near-grey pixels, whose
      //    hue is numerically defined and perceptually meaningless, cannot vote.
      if (s >= 0.15 && mx > mn) {
        var d = mx - mn, hdeg;
        if (mx === r) hdeg = 60 * (((g - b) / d) % 6);
        else if (mx === g) hdeg = 60 * ((b - r) / d + 2);
        else hdeg = 60 * ((r - g) / d + 4);
        if (hdeg < 0) hdeg += 360;
        var rad = hdeg * Math.PI / 180;
        hx += Math.cos(rad); hy += Math.sin(rad); chrom++;
      }
      n++;
    }
  }
  // ⚠️ NON-EMPTY FIRST. A mean over an empty band is null, and null formats as a blank
  // that reads like a small number. Every caller must fault on n === 0 rather than
  // printing it (CLAUDE.md #6: "[].every() returns true").
  if (n === 0) return { n: 0, rows: [r0, r1], sat: null, chroma: null, luma: null, lumaSd: null,
    ch255: null, ch0: null, white: null, nChromatic: 0, hueDeg: null, hueR: null };
  var mL = lSum / n;
  // The hue summary is over the FILTERED set, so it is null when that set is empty —
  // never 0, which would read as "hue 0 degrees, perfectly dispersed".
  var hDeg = null, hR = null;
  if (chrom > 0) {
    hDeg = Math.atan2(hy / chrom, hx / chrom) * 180 / Math.PI;
    if (hDeg < 0) hDeg += 360;
    hR = Math.sqrt(hx * hx + hy * hy) / chrom;
  }
  return {
    n: n, rows: [r0, r1],
    sat: sSum / n, chroma: cSum / n, luma: mL,
    lumaSd: Math.sqrt(Math.max(l2Sum / n - mL * mL, 0)),
    ch255: ch255 / n, ch0: ch0 / n, white: white / n,
    nChromatic: chrom, hueDeg: hDeg, hueR: hR,
  };
}
`;
// eslint-disable-next-line no-eval
const vbBand = (0, eval)(`${BAND_SRC}; vbBand`);

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — validates this tool's LOGIC. ⚠️ It says NOTHING about where the tool is
// pointed; that is P1..P4 in the browser arm and `--known-bad` on a real page.
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  🔴 ${name}  ${detail}`); }
  };
  const fill = (w, h, r, g, b) => {
    const buf = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255; }
    return buf;
  };
  const near = (x, y, t = 1e-9) => x != null && Math.abs(x - y) <= t;

  console.log('§A known answers — the two the critic named as its own controls');
  const grey = vbBand(fill(40, 40, 128, 128, 128), 40, 40, 0, 1);
  ok('flat grey  sat 0.0000', near(grey.sat, 0), `got ${grey.sat}`);
  ok('flat grey  chroma 0.0000', near(grey.chroma, 0), `got ${grey.chroma}`);
  ok('flat grey  luma 128/255', near(grey.luma, 128 / 255, 1e-12), `got ${grey.luma}`);
  const red = vbBand(fill(40, 40, 255, 0, 0), 40, 40, 0, 1);
  ok('pure red   sat 1.0000', near(red.sat, 1), `got ${red.sat}`);
  ok('pure red   chroma 1.0000', near(red.chroma, 1), `got ${red.chroma}`);
  ok('pure red   luma 0.2126', near(red.luma, 0.2126, 1e-12), `got ${red.luma}`);

  console.log('§B the degenerate pixel — max === 0, where (mx-mn)/mx is 0/0');
  const black = vbBand(fill(8, 8, 0, 0, 0), 8, 8, 0, 1);
  ok('pure black sat is 0, not NaN', black.sat === 0, `got ${black.sat}`);
  ok('pure black chroma 0', black.chroma === 0, `got ${black.chroma}`);

  console.log('§C the EMPTY band — this is the vacuity arm');
  const empty = vbBand(fill(8, 8, 128, 128, 128), 8, 8, 0.5, 0.5);
  ok('y0 === y1 gives n === 0', empty.n === 0, `got ${empty.n}`);
  ok('and sat is null, NOT 0 — a caller must be forced to notice', empty.sat === null, `got ${empty.sat}`);
  const inverted = vbBand(fill(8, 8, 128, 128, 128), 8, 8, 0.9, 0.1);
  ok('y0 > y1 gives n === 0 rather than a wrapped band', inverted.n === 0, `got ${inverted.n}`);

  console.log('§D the WINDOW — a mis-cropped band is the failure this tool is most exposed to');
  const win = vbBand(fill(4, 900, 10, 20, 30), 4, 900, 0.35, 0.62);
  ok('900 rows, [0.35,0.62] -> rows [315,558]', win.rows[0] === 315 && win.rows[1] === 558, `got ${JSON.stringify(win.rows)}`);
  ok('and n === 4 * 243', win.n === 4 * 243, `got ${win.n}`);

  console.log('§E it must SEPARATE two populations, not just average them');
  // top half red, bottom half grey; a band on each must disagree.
  const split = new Uint8Array(4 * 100 * 4);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 4; x++) {
    const i = (y * 4 + x) * 4, top = y < 50;
    split[i] = top ? 255 : 128; split[i + 1] = top ? 0 : 128; split[i + 2] = top ? 0 : 128; split[i + 3] = 255;
  }
  const tHalf = vbBand(split, 4, 100, 0, 0.5), bHalf = vbBand(split, 4, 100, 0.5, 1);
  ok('top half reads sat 1', near(tHalf.sat, 1), `got ${tHalf.sat}`);
  ok('bottom half reads sat 0', near(bHalf.sat, 0), `got ${bHalf.sat}`);
  ok('the whole frame reads 0.5 — so a WHOLE-FRAME read would hide both', near(vbBand(split, 4, 100, 0, 1).sat, 0.5), '');

  console.log('§F lumaSd — the P2 flatness guard must be able to FAIL');
  ok('a flat fill has stdev exactly 0', grey.lumaSd === 0, `got ${grey.lumaSd}`);
  ok('the split frame has stdev > 0.02', vbBand(split, 4, 100, 0, 1).lumaSd > 0.02, `got ${vbBand(split, 4, 100, 0, 1).lumaSd}`);

  console.log('§G the three metrics are INDEPENDENT — a scale must move luma and chroma but NOT sat');
  const bright = vbBand(fill(8, 8, 200, 100, 50), 8, 8, 0, 1);
  const dark = vbBand(fill(8, 8, 100, 50, 25), 8, 8, 0, 1);
  ok('halving every channel leaves HSV sat unchanged', near(bright.sat, dark.sat, 1e-9), `${bright.sat} vs ${dark.sat}`);
  ok('...and halves absolute chroma', near(dark.chroma, bright.chroma / 2, 2e-3), `${bright.chroma} vs ${dark.chroma}`);
  ok('...and halves luma', near(dark.luma, bright.luma / 2, 2e-3), `${bright.luma} vs ${dark.luma}`);
  // This is the arithmetic the whole round turns on: luma DOWN + chroma UP requires
  // saturation to rise by MORE than luma falls. Assert it so nobody has to trust it.
  ok('so luma↓ AND chroma↑ is impossible without sat↑ (the shader comment, asserted)',
    dark.chroma < bright.chroma && near(dark.sat, bright.sat, 1e-9), '');

  console.log('§H the GAMUT arms — a saturation raise\'s only real risk, so they must be able to fire');
  ok('flat grey 128 pins nothing', grey.ch255 === 0 && grey.ch0 === 0 && grey.white === 0, '');
  ok('pure red is 100% any-channel-255 AND 100% any-channel-0', red.ch255 === 1 && red.ch0 === 1, `${red.ch255}/${red.ch0}`);
  ok('...but 0% near-WHITE — the two counters are different questions', red.white === 0, `got ${red.white}`);
  const nearWhite = vbBand(fill(8, 8, 252, 251, 253), 8, 8, 0, 1);
  ok('rgb(252,251,253) is near-white but pins no channel', nearWhite.white === 1 && nearWhite.ch255 === 0, `${nearWhite.white}/${nearWhite.ch255}`);

  console.log('§I the HUE arm — and the filtered set must never summarise as a number when empty');
  ok('flat grey has NO chromatic pixels', grey.nChromatic === 0, `got ${grey.nChromatic}`);
  ok('...so hueR is null, NOT 0 (0 would read as "perfectly dispersed")', grey.hueR === null && grey.hueDeg === null, `${grey.hueR}/${grey.hueDeg}`);
  ok('pure red reads hue 0deg, R = 1', near(red.hueDeg, 0, 1e-9) && near(red.hueR, 1, 1e-9), `${red.hueDeg}/${red.hueR}`);
  const green = vbBand(fill(8, 8, 0, 255, 0), 8, 8, 0, 1);
  ok('pure green reads hue 120deg', near(green.hueDeg, 120, 1e-9), `got ${green.hueDeg}`);
  // Two opposite hues in equal measure must give R ~ 0. A LINEAR mean would give 180.
  const opp = new Uint8Array(2 * 4);
  opp.set([255, 0, 0, 255], 0); opp.set([0, 255, 255, 255], 4);
  const oppB = vbBand(opp, 2, 1, 0, 1);
  ok('red + cyan in equal measure gives circular R ~ 0, not a mean of 180deg', oppB.hueR < 1e-9, `got ${oppB.hueR}`);
  ok('and that set is non-empty, so the null branch is not what produced it', oppB.nChromatic === 2, `got ${oppB.nChromatic}`);
  // The sat floor must actually exclude something, or it is decorative.
  const paleRed = vbBand(fill(8, 8, 255, 240, 240), 8, 8, 0, 1);
  ok('a pale pixel (HSV sat 0.059) is EXCLUDED by the 0.15 floor', paleRed.nChromatic === 0, `got ${paleRed.nChromatic}`);

  console.log(`\n${fail === 0 ? '✅' : '🔴'} selftest ${pass}/${pass + fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATES — the same `vbBand`, node-side, on the curated reference.
// 🚨 `reference/` is gitignored and this repo is PUBLIC. Numbers and crop windows are
// numbers and disclose nothing; the artwork is never described. (`CLAUDE.md`, security.)
// ─────────────────────────────────────────────────────────────────────────────
async function plates() {
  const { default: sharp } = await import('sharp');
  const dir = join(ROOT, 'reference/images/curated/gameplay_topdown');
  if (!existsSync(dir)) { console.error(`v2_band: no plate directory at ${dir}`); process.exit(2); }
  const ids = String(get('--plate-ids', 'bs_01,bs_02,bs_03,bs_04,bs_05,bs_06')).split(',');
  const rows = [];
  for (const id of ids) {
    const p = join(dir, `${id}.png`);
    if (!existsSync(p)) { console.log(`   ${id}: MISSING at ${p}`); continue; }
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = vbBand(data, info.width, info.height, Y0, Y1);
    if (!b.n) { console.log(`   ${id}: 🔴 EMPTY BAND`); continue; }
    rows.push({ id, w: info.width, h: info.height, ...b });
  }
  if (!rows.length) { console.error('v2_band: NO plate produced a band — refusing to print a summary over an empty set'); process.exit(1); }
  console.log(`\n── reference plates · band y ${Y0}–${Y1}, full width · n=${rows.length} ──`);
  console.log('  plate      px          sat     chroma      luma     ch255      ch0     white    hueR');
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(8)} ${String(r.w).padStart(5)}x${String(r.h).padStart(4)}  ${r.sat.toFixed(4)}   ${r.chroma.toFixed(4)}   ${r.luma.toFixed(4)}   ${r.ch255.toFixed(4)}   ${r.ch0.toFixed(4)}   ${r.white.toFixed(4)}  ${r.hueR == null ? '   -' : r.hueR.toFixed(3)}`);
  }
  const agg = (k) => { const v = rows.map((r) => r[k]).filter((x) => x != null).sort((x, y) => x - y); return v.length ? [v[0], v[v.length - 1], v.reduce((s, x) => s + x, 0) / v.length] : null; };
  for (const k of ['sat', 'chroma', 'luma', 'ch255', 'ch0', 'white', 'hueR']) {
    const g = agg(k);
    if (!g) { console.log(`  ${k.padEnd(8)} 🔴 no plate produced this quantity`); continue; }
    console.log(`  ${k.padEnd(8)} min ${g[0].toFixed(4)}  max ${g[1].toFixed(4)}  mean ${g[2].toFixed(4)}`);
  }
  console.log('\n  ⚠️ The plates are phone screenshots, upscaled. RESAMPLING DESTROYS HARD 255s, so');
  console.log('     their true ch255 is if anything higher than printed — the bias runs our way and');
  console.log('     `ch255` should be read as a ceiling we are under, never as a target to hit.');
  const out = get('--out', null);
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'plates.json'), JSON.stringify({ y: [Y0, Y1], rows }, null, 2)); }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER ARM
// ─────────────────────────────────────────────────────────────────────────────
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
const OUT = get('--out', 'shots/v2band/run');
const LABEL = get('--label', 'unlabelled');
const KNOWN_BAD = get('--known-bad', null);
const ROSTER = String(get('--roster', 'soup,sushi,taco,donut,egg,pizza')).split(',').filter(Boolean);
const RING_WU = Number(get('--ring', 110));
const STATION_IDS = String(get('--stations', 'pot_south')).split(',');
const EXPECT_SEATS = Number(get('--expect-seats', 6));

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-lcd-text', '--force-device-scale-factor=1', '--hide-scrollbars'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
on:noop,off:noop,send:noop,invalidate:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const CX = ARENA.center.x, CY = ARENA.center.y;
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === CX && h.y === CY);
if (!POT) { console.error('v2_band: no centre damage hazard in arena.gameplay.json — station derivation is broken'); process.exit(2); }
// Derived from `arena.gameplay.json`, never retyped — `CLAUDE.md`'s stale-literal class is
// invisible to every legality check because the 1x playfield is a legal subset of the 4x one.
//
// 🚨 THE FIELD IS `radius`, NOT `r`, AND THE FIRST VERSION OF THIS FILE READ `POT.r`.
// `undefined` propagated to `y: NaN`, the `?fighters=` ring string became
// `soup@1400,NaN;...`, the app silently fell back to its TWO-fighter default, and the tool
// happily measured a frame at some other camera. Every guard bar P4 was GREEN on it:
// non-empty band, structured band, a character in shot, bit-identical self-pair, both
// positive controls moving. **The only thing that caught it was the assertion about where
// the tool was POINTED**, which is `CLAUDE.md` #6's whole point — `--selftest` was 22/22
// at the time. `v2_shot.mjs` uses the same station and reads `POT.radius`; matching it here
// keeps the two tools describing the same frame.
const STATIONS = {
  pot_south: { x: CX, y: CY + Math.round(POT.radius * 2.105), note: 'hub, pot 200wu north — the tile field fills the frame' },
  west_lane: { x: CX - Math.round(POT.radius * 8.421), y: CY, note: 'west combat lane, prep counters + spill decals' },
  centre: { x: CX, y: CY, note: 'arena centre' },
};
for (const [k, v] of Object.entries(STATIONS)) {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) { console.error(`v2_band: station ${k} is not finite (${v.x},${v.y})`); process.exit(2); }
}

/**
 * THE SWEEP. Each row is `{ label, set }`, where `set` is a map of dotted paths on the live
 * page to values. Paths, not code, so a row cannot smuggle in a second change.
 *
 * ⚠️ Row order is load-bearing: `shipped` first, `shipped(again)` LAST. They bracket the
 * sweep and their bit-identity is what makes every row between them believable.
 */
const SWEEPS = {
  // WAVE 1 — price every lever in the owned file set against each other, at one setting
  // each, so the round is spent on the strongest one rather than on the first one tried.
  wave1: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL sat=5.0', set: { 'grade.saturation': 5.0 } },
    { label: 'POSCTRL key=0', set: { 'lighting.key.intensity': 0 } },
    { label: 'sat .70->.86', set: { 'grade.saturation': 0.86 } },
    { label: 'sat .70->1.10', set: { 'grade.saturation': 1.10 } },
    { label: 'sat .70->1.60', set: { 'grade.saturation': 1.60 } },
    { label: 'toe .28->.40 @.68', set: { 'grade.shadowToe': 0.40, 'grade.toeKnee': 0.68 } },
    { label: 'contrast .72->.82', set: { 'grade.contrast': 0.82 } },
    { label: 'fill .55->.30', set: { 'lighting.fill.intensity': 0.30 } },
    { label: 'fill .55->.15', set: { 'lighting.fill.intensity': 0.15 } },
    { label: 'fill .55->.00', set: { 'lighting.fill.intensity': 0 } },
    { label: 'env .32->.16', set: { 'scene.environmentIntensity': 0.16 } },
    { label: 'env .32->.00', set: { 'scene.environmentIntensity': 0 } },
    { label: 'key 3.5->3.06 (sin39/sin46)', set: { 'lighting.key.intensity': 3.0625 } },
    { label: 'key 3.5->2.80', set: { 'lighting.key.intensity': 2.80 } },
    { label: 'front 2.2->1.4', set: { 'lighting.front.intensity': 1.4 } },
    { label: 'shipped(again)', set: {} },
  ],
  // WAVE 2 — the winner, resolved. `satAmount` is the ONLY lever wave 1 found that buys
  // chroma at zero luma cost (every other one trades them, which the shader's own comment
  // says is arithmetic and not a tuning failure). The rows bracket the setting that lands
  // both axes inside the six-plate band, and add the `satKnee` question: the knee is what
  // stops a raise from pinning a channel, so pushing `satAmount` without pricing the knee
  // is exactly how this grade got into trouble the first time.
  wave2: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL sat=5.0', set: { 'grade.saturation': 5.0 } },
    { label: 'sat 1.00', set: { 'grade.saturation': 1.00 } },
    { label: 'sat 1.10', set: { 'grade.saturation': 1.10 } },
    { label: 'sat 1.19', set: { 'grade.saturation': 1.19 } },
    { label: 'sat 1.25', set: { 'grade.saturation': 1.25 } },
    { label: 'sat 1.35', set: { 'grade.saturation': 1.35 } },
    { label: 'sat 1.50', set: { 'grade.saturation': 1.50 } },
    { label: 'sat 1.19 knee .45', set: { 'grade.saturation': 1.19, 'grade.knee': 0.45 } },
    { label: 'sat 1.19 knee .65', set: { 'grade.saturation': 1.19, 'grade.knee': 0.65 } },
    { label: 'sat 1.19 + contrast .82', set: { 'grade.saturation': 1.19, 'grade.contrast': 0.82 } },
    { label: 'sat 1.19 + env .24', set: { 'grade.saturation': 1.19, 'scene.environmentIntensity': 0.24 } },
    { label: 'sat 1.19 + key 3.06', set: { 'grade.saturation': 1.19, 'lighting.key.intensity': 3.0625 } },
    { label: 'shipped(again)', set: {} },
  ],
  // WAVE 3 — the STOPPING RULE, pre-registered before the rows were run:
  //   *the smallest `satAmount` whose band clears BOTH reference minima (sat >= 0.4377,
  //    chroma >= 0.3005) at EVERY station, with the gamut arms no worse than shipped.*
  // Two stations, because wave 2's winner cleared by +0.0061 / +0.0040 at one station and
  // a margin that thin is a property of the frame, not of the knob.
  wave3: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL sat=5.0', set: { 'grade.saturation': 5.0 } },
    { label: 'sat 1.19', set: { 'grade.saturation': 1.19 } },
    { label: 'sat 1.25', set: { 'grade.saturation': 1.25 } },
    { label: 'sat 1.35', set: { 'grade.saturation': 1.35 } },
    { label: 'sat 1.50', set: { 'grade.saturation': 1.50 } },
    { label: 'shipped(again)', set: {} },
  ],

  // ── WAVE `shadow` — DOES `key.shadow.radius` DO ANYTHING? ──────────────────
  //
  // `140d054` set `key.shadow.radius = 0.4 -> 1.6` as "the SOFTEN half of Uri's
  // sentence", and wrote down the honest prediction that this repo had already
  // measured the knob as close to a no-op ("re-tested at 1.4 and 3.0 ... every
  // metric moved by under 0.001"). Read as a metric problem, that is `LESSONS §6b`
  // backwards — a flat metric is not evidence a change did nothing.
  //
  // 🚨 IT IS NOT A METRIC PROBLEM. `src/render/stage.ts` sets
  // `renderer.shadowMap.type = THREE.PCFSoftShadowMap`, and three 0.180.0's
  // `shadowmap_pars_fragment.glsl.js` references the `shadowRadius` uniform ONLY
  // inside `#if defined( SHADOWMAP_TYPE_PCF )`. The `PCF_SOFT` branch builds its
  // kernel from `texelSize` alone and never reads the uniform. So the value is
  // inert BY CONSTRUCTION on the shipped renderer, and no instrument could ever
  // have seen it move.
  //
  // These rows settle that at the only resolution that cannot be argued with — the
  // raw drawing-buffer hash. Under PCF_SOFT, radius 0 / 1.6 / 20 must come back
  // BIT-IDENTICAL to `shipped`; the moment the type is PCF, the same three values
  // must all differ. Both halves are needed: identical rows alone would also be
  // what a knob path that never resolved looks like, which is why the PCF rows are
  // the positive control for this specific claim rather than the generic `key=0`.
  //
  // ⚠️ A `shadowMap.type` change is a shader DEFINE, so it needs every material
  // recompiled and the shadow map re-rendered. `ROW` does that on EVERY row, not
  // only on these, so that the rows stay symmetric — see the note there. There is
  // deliberately no per-row `recompile` flag: a flag that is never read is
  // indistinguishable from a comment (`CLAUDE.md` #6).
  shadow: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL key=0', set: { 'lighting.key.intensity': 0 } },
    // — the deadness proof: three values of a live-looking knob, one frame apart —
    { label: 'PCF_SOFT radius 0', set: { 'lighting.key.shadow.radius': 0 } },
    { label: 'PCF_SOFT radius 1.6 (shipped)', set: { 'lighting.key.shadow.radius': 1.6 } },
    { label: 'PCF_SOFT radius 20', set: { 'lighting.key.shadow.radius': 20 } },
    // — the positive control: the SAME knob, under a type that reads it —
    { label: 'PCF radius 1.6', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 1.6 } },
    { label: 'PCF radius 4', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 4 } },
    { label: 'PCF radius 8', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 8 } },
    // — the other half of "soften": how deep the cast shadow is allowed to go —
    { label: 'shadow.intensity 0.85', set: { 'lighting.key.shadow.intensity': 0.85 } },
    { label: 'shadow.intensity 0.70', set: { 'lighting.key.shadow.intensity': 0.70 } },
    { label: 'shadow.intensity 0.55', set: { 'lighting.key.shadow.intensity': 0.55 } },
    { label: 'shipped(again)', set: {} },
  ],

  // ── WAVE `shadow2` — the CHOICE, once wave `shadow` settled the fact ───────
  // Run with `--shots`, because the quantity in question is one no statistic in this
  // repo measures: `lighting.ts` says so itself ("no statistic here measures edge
  // softness at all"). The band moves by 0.0001–0.0002 across the whole blur sweep and
  // by 0.0022 across the depth sweep, so the band CANNOT arbitrate this — the PNGs can.
  // Rows are ordered so each PNG differs from `shipped` in exactly one named way.
  shadow2: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL key=0', set: { 'lighting.key.intensity': 0 } },
    { label: 'PCF radius 4', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 4 } },
    { label: 'PCF radius 8', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 8 } },
    { label: 'PCF radius 12', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 12 } },
    { label: 'shadow.intensity 0.55', set: { 'lighting.key.shadow.intensity': 0.55 } },
    { label: 'PCF r8 + intensity 0.55', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 8, 'lighting.key.shadow.intensity': 0.55 } },
    { label: 'PCF r8 + intensity 0.70', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 8, 'lighting.key.shadow.intensity': 0.70 } },
    { label: 'shipped(again)', set: {} },
  ],

  // ── WAVE `shadow3` — PCF BANDS AT WIDE RADII, so price the alternative ─────
  // Read the `shadow2` PNGs at 2x before believing this wave is unnecessary: three's
  // PCF branch takes SEVENTEEN taps over a footprint of `2*radius` texels, so at
  // radius 8 it is sampling 16 texels with 17 points and the penumbra combs. VSM blurs
  // the depth map itself (a separable Gaussian, `blurSamples`) and then reads it with
  // ONE tap — so it is smooth by construction, and its sampling cost is LOWER than the
  // nine taps PCF_SOFT already pays. The blur runs on shadow-map update, and this
  // renderer has `shadowMap.autoUpdate = false`, so that cost is not per frame.
  // ⚠️ three's own note: under VSM every shadow RECEIVER also casts. That changes the
  // caster set, which is a behaviour change and not only a look change — so this wave
  // exists to look at the artefacts, not to adopt it blind.
  shadow3: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL key=0', set: { 'lighting.key.intensity': 0 } },
    { label: 'PCF radius 2', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 2 } },
    { label: 'PCF radius 3', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 3 } },
    { label: 'PCF radius 5', set: { 'renderer.shadowMap.type': 1, 'lighting.key.shadow.radius': 5 } },
    { label: 'VSM radius 4', set: { 'renderer.shadowMap.type': 3, 'lighting.key.shadow.radius': 4, 'lighting.key.shadow.blurSamples': 8 } },
    { label: 'VSM radius 8', set: { 'renderer.shadowMap.type': 3, 'lighting.key.shadow.radius': 8, 'lighting.key.shadow.blurSamples': 8 } },
    { label: 'shipped(again)', set: {} },
  ],

  // ── WAVE `rim2` — the EXPONENT, once it is a uniform ──────────────────────
  // Only runs on a tree whose `applyRimLight` carries `rimPower`; on any older one the
  // knob refuses rather than writing a dead uniform, so a row cannot come back null and
  // be read as "the exponent does not matter".
  // The pair is what is being chosen: `x^p` falls faster for larger `p` EVERYWHERE
  // below 1, so raising the exponent alone only dims the term. Each row therefore names
  // both, and the strengths are set so the peak (rimDot = 1, i.e. exactly the
  // silhouette) rises while every interior sample falls.
  rim2: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL rim x21', set: { 'rim.strengthMult': 21 } },
    { label: 'p2.6 s0.28 (old)', set: { 'rim.power': 2.6, 'rim.strengthMult': 0.28 / 0.95 } },
    { label: 'p4 s0.60', set: { 'rim.power': 4, 'rim.strengthMult': 0.60 / 0.95 } },
    { label: 'p4 s0.95', set: { 'rim.power': 4, 'rim.strengthMult': 1 } },
    { label: 'p5 s0.95', set: { 'rim.power': 5, 'rim.strengthMult': 1 } },
    { label: 'p5 s1.40', set: { 'rim.power': 5, 'rim.strengthMult': 1.40 / 0.95 } },
    { label: 'p6 s1.40', set: { 'rim.power': 6, 'rim.strengthMult': 1.40 / 0.95 } },
    { label: 'p7 s2.00', set: { 'rim.power': 7, 'rim.strengthMult': 2.00 / 0.95 } },
    { label: 'shipped(again)', set: {} },
  ],

  // ── WAVE `rim` — is the Fresnel rim an EDGE or a WASH? ─────────────────────
  // Uri asked for "a rim/fresnel light so each character has a BRIGHT EDGE that lifts
  // it off the background". `140d054`'s own ablation is the reason to doubt we have
  // one: driving the rim to zero moved **1,130,817 px of 1,440,000 at mean 3.86/255**
  // — that is a whole-frame lift of 1.5%, i.e. a wash spread over three quarters of the
  // picture, not an edge. At `pow(rimDot, 2.6)` the term still carries 0.16 of its peak
  // at 37 deg off the silhouette, so most of its energy lands on the BODY.
  //
  // Strength is a live uniform, so the brightness half is sweepable with no code change.
  // The exponent is compile-time and is NOT swept here; what these rows price is
  // "how much more rim can this frame take before it goes white", which is the number
  // that decides whether the narrower-and-brighter rewrite is worth doing at all.
  // ⚠️ `white` (all three channels >= 250) is the column to watch, not `ch255`.
  rim: [
    { label: 'shipped', set: {} },
    { label: 'POSCTRL rim x21', set: { 'rim.strengthMult': 21 } },
    { label: 'rim x0 (ablate)', set: { 'rim.strengthMult': 0 } },
    { label: 'rim x2', set: { 'rim.strengthMult': 2 } },
    { label: 'rim x3', set: { 'rim.strengthMult': 3 } },
    { label: 'rim x4', set: { 'rim.strengthMult': 4 } },
    { label: 'rim x6', set: { 'rim.strengthMult': 6 } },
    { label: 'rim x3 cyan', set: { 'rim.strengthMult': 3, 'rim.colorHex': 0x66ffff } },
    { label: 'rim x3 warm', set: { 'rim.strengthMult': 3, 'rim.colorHex': 0xfff0c0 } },
    { label: 'shipped(again)', set: {} },
  ],
};
const DEFAULT_ROWS = SWEEPS[get('--wave', 'wave1')] ?? SWEEPS.wave1;
if (!SWEEPS[get('--wave', 'wave1')]) { console.error(`v2_band: unknown --wave ${get('--wave', '')}; have ${Object.keys(SWEEPS).join(', ')}`); process.exit(2); }

const PAGE_STILL_HUD = () => {
  let n = 0;
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const s = getComputedStyle(el);
    if (s.animationName && s.animationName !== 'none') { el.style.animation = 'none'; n++; }
    if (s.transitionDuration && s.transitionDuration !== '0s') el.style.transition = 'none';
  }
  return n;
};

const FREEZE = (blank) => {
  const w = window;
  w.__vbraf = 0;
  w.requestAnimationFrame = () => { w.__vbraf++; return 0; };
  const stage = w.__stage;
  if (!stage) return { err: 'no window.__stage' };
  try { stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0); } catch { /* older rig */ }
  if (blank) {
    const gl = stage.renderer.getContext();
    stage.render = () => { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); };
  }
  return { ok: true, frames: w.__matchDebug ? w.__matchDebug.frames : null };
};
const FRAMES = () => (window.__matchDebug ? window.__matchDebug.frames : null);

/** Snapshot every knob the sweep can touch, so rows cannot accumulate. */
const SNAPSHOT = () => {
  const st = window.__stage, L = st.lighting, g = st.grade, sc = st.scene;
  return {
    'grade.saturation': g.saturation, 'grade.contrast': g.contrast, 'grade.knee': g.knee,
    'grade.highlightKnee': g.highlightKnee, 'grade.shadowToe': g.shadowToe,
    'grade.toeKnee': g.toeKnee, 'grade.toeChromaKeep': g.toeChromaKeep,
    'lighting.key.intensity': L.key.intensity, 'lighting.fill.intensity': L.fill.intensity,
    'lighting.front.intensity': L.front.intensity, 'lighting.rim.intensity': L.rim.intensity,
    'lighting.ambient.intensity': L.ambient.intensity,
    'scene.environmentIntensity': sc.environmentIntensity,
    // The shadow knobs the `shadow` wave drives. Snapshotted for the same reason as
    // every other one: rows must not accumulate, and `shipped(again)` is what proves it.
    'lighting.key.shadow.radius': L.key.shadow.radius,
    'lighting.key.shadow.intensity': L.key.shadow.intensity,
    'lighting.key.shadow.blurSamples': L.key.shadow.blurSamples,
    'renderer.shadowMap.type': st.renderer.shadowMap.type,
    // The rim's restore is expressed as "put it back", not as 230 numbers — the base
    // values live in `ROW`'s own cache. `null` on the colour means "copy the cached
    // base", so a row that never touched the rim still re-applies the identity.
    'rim.strengthMult': 1,
    'rim.colorHex': null,
    'rim.power': null,
  };
};

/**
 * Apply a knob set, re-render ONE frame, read the band + a raw hash.
 *
 * `known` (the baseline snapshot) is re-applied first, every time. `set` is then applied on
 * top. A path that does not resolve is a FAULT, not a silent no-op — see the positive
 * control's reason at the top of this file.
 */
const ROW = (arg) => {
  const w = window, st = w.__stage;
  const vb = w.VB;
  if (!vb) return { err: 'VB (the band function) was never injected' };
  const targets = {
    'grade': st.grade, 'lighting.key': st.lighting.key, 'lighting.fill': st.lighting.fill,
    'lighting.front': st.lighting.front, 'lighting.rim': st.lighting.rim,
    'lighting.ambient': st.lighting.ambient, 'scene': st.scene,
    'lighting.key.shadow': st.lighting.key.shadow,
    'renderer.shadowMap': st.renderer.shadowMap,
  };
  // ── THE ONE NON-PATH KNOB, AND WHY IT HAS TO BE ONE ───────────────────────
  // The Fresnel rim is not a property of any object reachable from `__stage`: it is a
  // per-MATERIAL uniform written from inside `onBeforeCompile`, i.e. at first render
  // (`toon.ts` `applyRimLight`). There are ~230 of them and no path can name them. So
  // `rim.strengthMult` / `rim.colorHex` walk the scene, exactly as `v2_ablate.mjs`'s
  // arm D does, and are declared here rather than hidden.
  // The BASE value of every uniform is cached on the window the first time it is
  // touched, so `rim.strengthMult: 1` is an exact restore and the baseline snapshot
  // does not have to carry 230 numbers. A material drawn for the first time AFTER the
  // cache is built legitimately has no entry and is reported, not silently skipped.
  const rimEntries = () => {
    if (w.__vbRim) return w.__vbRim;
    const out = [];
    st.scene.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        const u = m && m.userData && m.userData.rimUniforms;
        if (u && u.rimStrength && !out.some((e) => e.u === u)) {
          out.push({
            u, base: u.rimStrength.value, baseColor: u.rimColor.value.clone(),
            basePower: u.rimPower ? u.rimPower.value : null,
          });
        }
      }
    });
    w.__vbRim = out;
    return out;
  };
  const put = (path, v) => {
    if (path === 'rim.strengthMult') {
      const es = rimEntries();
      if (!es.length) return 'rim.strengthMult: NO rim uniforms in the scene — the knob would be a silent no-op';
      for (const e of es) e.u.rimStrength.value = e.base * v;
      return null;
    }
    if (path === 'rim.power') {
      const es = rimEntries();
      if (!es.length) return 'rim.power: NO rim uniforms in the scene — the knob would be a silent no-op';
      // ⚠️ A tree whose `applyRimLight` predates the exponent has no `rimPower` uniform
      // at all, and writing one onto the uniform map would create a dead entry that
      // reads back perfectly while the shader keeps its hard-coded 2.6. Refuse instead:
      // this is exactly the "the knob path never resolved" failure the positive control
      // exists for, and it should be a FAULT rather than a null row.
      // `null` is the RESTORE, and on a tree with no `rimPower` there is nothing to
      // restore — so it is a no-op there rather than a fault. Setting an actual value
      // on such a tree still refuses, which is the case that matters.
      if (!es[0].u.rimPower) {
        if (v == null) return null;
        return 'rim.power: this build has no rimPower uniform — the exponent is still compiled in';
      }
      for (const e of es) e.u.rimPower.value = v == null ? e.basePower : v;
      return null;
    }
    if (path === 'rim.colorHex') {
      const es = rimEntries();
      if (!es.length) return 'rim.colorHex: NO rim uniforms in the scene — the knob would be a silent no-op';
      for (const e of es) { if (v == null) e.u.rimColor.value.copy(e.baseColor); else e.u.rimColor.value.setHex(v); }
      return null;
    }
    const i = path.lastIndexOf('.');
    const obj = targets[path.slice(0, i)];
    const key = path.slice(i + 1);
    if (!obj) return `no target for ${path}`;
    if (!(key in obj)) return `no field ${key} on ${path.slice(0, i)}`;
    obj[key] = v;
    return null;
  };
  const errs = [];
  for (const [p, v] of Object.entries(arg.base)) { const e = put(p, v); if (e) errs.push(e); }
  for (const [p, v] of Object.entries(arg.set)) { const e = put(p, v); if (e) errs.push(e); }
  if (errs.length) return { err: errs.join('; ') };

  const r = st.renderer, gl = r.getContext();
  // ── RECOMPILE ON EVERY ROW, NOT ONLY ON THE ROWS THAT NEED IT ─────────────
  // `renderer.shadowMap.type` is a shader DEFINE (`SHADOWMAP_TYPE_*`), so a row that
  // changes it must invalidate every material's program or the frame keeps the old
  // one and the row is a silent no-op — the exact failure mode this file's positive
  // control exists to catch. Doing it only on those rows would make the rows
  // ASYMMETRIC: `shipped(again)` would run without a recompile that `PCF radius 4`
  // ran with, and any difference between them could then be blamed on either. So it
  // runs unconditionally, which costs one cache lookup per material after the first
  // compile of each define set, and makes `shipped` vs `shipped(again)` a control on
  // the recompile itself as well as on the knobs.
  st.scene.traverse((o) => {
    const m = o.material;
    if (!m) return;
    if (Array.isArray(m)) { for (const mm of m) mm.needsUpdate = true; } else m.needsUpdate = true;
  });
  r.shadowMap.needsUpdate = true;
  r.info.autoReset = false; r.info.reset();
  st.render(0);
  const draws = r.info.render.calls;

  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const buf = new Uint8Array(Wp * Hp * 4);
  gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  // readPixels is bottom-up; flip so the y-window means what it says on screen.
  const up = new Uint8Array(Wp * Hp * 4);
  for (let row = 0; row < Hp; row++) up.set(buf.subarray((Hp - 1 - row) * Wp * 4, (Hp - row) * Wp * 4), row * Wp * 4);

  let src = up;
  if (arg.plant === 'grey' || arg.plant === 'red') {
    // KNOWN-BAD: overwrite the pixels the band will read with an answer we already know.
    // Everything else in the path — the flip, the window, the means — still runs.
    src = new Uint8Array(up);
    const r0 = Math.max(0, Math.round(arg.y0 * Hp)), r1 = Math.min(Hp, Math.round(arg.y1 * Hp));
    for (let y = r0; y < r1; y++) for (let x = 0; x < Wp; x++) {
      const i = (y * Wp + x) * 4;
      src[i] = arg.plant === 'red' ? 255 : 128;
      src[i + 1] = arg.plant === 'red' ? 0 : 128;
      src[i + 2] = arg.plant === 'red' ? 0 : 128;
      src[i + 3] = 255;
    }
  }
  const band = vb(src, Wp, Hp, arg.y0, arg.y1);

  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < buf.length; i++) { h1 = ((h1 ^ buf[i]) * 16777619) >>> 0; h2 = ((h2 + buf[i]) * 31) >>> 0; }

  // The PNG is taken from the CANVAS, in the SAME synchronous task as the render, so the
  // drawing buffer is still intact without `preserveDrawingBuffer` — and it is HUD-free
  // for the same reason `readPixels` is. `locator('canvas').screenshot()` would composite
  // the DOM HUD into it (`docs/AGENT-BRIEF.md` §3).
  const png = arg.shot ? st.renderer.domElement.toDataURL('image/png') : null;

  return { band, draws, png, sha: `${h1.toString(16)}-${h2.toString(16)}-${buf.length}`, wp: Wp, hp: Hp };
};

/**
 * P3/P4 — POINTING. Project every `character:*` node through the live camera and report
 * which land inside the band's rows. This is the check `--selftest` structurally cannot do.
 */
const POINTING = (arg) => {
  const st = window.__stage;
  const cam = st.rig.camera;
  const THREE = st.THREE || null;   // not exported; fall back to hand arithmetic below
  const gl = st.renderer.getContext();
  const Hp = gl.drawingBufferHeight, Wp = gl.drawingBufferWidth;
  const r0 = Math.max(0, Math.round(arg.y0 * Hp)), r1 = Math.min(Hp, Math.round(arg.y1 * Hp));
  const out = [];
  st.scene.updateMatrixWorld(true);
  cam.updateMatrixWorld(true);
  const m = cam.projectionMatrix.elements, v = cam.matrixWorldInverse.elements;
  const proj = (x, y, z) => {
    // view = V * world
    const vx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const vy = v[1] * x + v[5] * y + v[9] * z + v[13];
    const vz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cx = m[0] * vx + m[4] * vy + m[8] * vz + m[12];
    const cy = m[1] * vx + m[5] * vy + m[9] * vz + m[13];
    const cw = m[3] * vx + m[7] * vy + m[11] * vz + m[15];
    if (cw === 0) return null;
    return { ndcX: cx / cw, ndcY: cy / cw, w: cw };
  };
  st.scene.traverse((o) => {
    if (!o.name || o.name.indexOf('character:') !== 0) return;
    const p = o.matrixWorld.elements;
    const q = proj(p[12], p[13], p[14]);
    if (!q) return;
    const py = Math.round((1 - (q.ndcY * 0.5 + 0.5)) * Hp);
    const px = Math.round((q.ndcX * 0.5 + 0.5) * Wp);
    out.push({ name: o.name, px, py, inBand: q.w > 0 && py >= r0 && py < r1 && px >= 0 && px < Wp });
  });
  return { rows: [r0, r1], nodes: out, nInBand: out.filter((o) => o.inBand).length, THREEseen: !!THREE };
};

async function run() {
  if (!BASE) { console.error('v2_band: no --url / PREVIEW_BASE'); process.exit(2); }
  mkdirSync(OUT, { recursive: true });
  const SWEEP = has('--sweep');
  const SHOTS = has('--shots');
  const rows = SWEEP ? DEFAULT_ROWS : [{ label: 'shipped', set: {} }, { label: 'shipped(again)', set: {} }];

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = { label: LABEL, base: BASE, viewport: [W, H], band: [Y0, Y1], knownBad: KNOWN_BAD, stations: [], faults: [] };

  for (const id of STATION_IDS) {
    const st = STATIONS[id];
    if (!st) { report.faults.push(`unknown station ${id}`); continue; }
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
    await page.addInitScript(`${BAND_SRC}\nglobalThis.VB = vbBand;`);
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

    const ring = ROSTER.map((cid, i) => {
      const ang = (i / ROSTER.length) * Math.PI * 2;
      return i === 0 ? `${cid}@${st.x},${st.y}`
        : `${cid}@${Math.round(st.x + Math.cos(ang) * RING_WU)},${Math.round(st.y + Math.sin(ang) * RING_WU)}`;
    }).join(';');
    const q = new URLSearchParams({
      fighters: ring, px: String(st.x), py: String(st.y),
      fogRadius: String(ARENA.maxSafeRadius), simSpeed: '0.02', pointerLock: '0',
    });
    console.log(`\n── ${LABEL} · ${id} (${st.x},${st.y}) · ${ROSTER.length} seats · band y ${Y0}–${Y1} ──`);
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
    await page.waitForTimeout(2600);

    const nAnims = await page.evaluate(PAGE_STILL_HUD);
    const fz = await page.evaluate(FREEZE, KNOWN_BAD === 'blank');
    if (fz.err) { report.faults.push(`${id}: ${fz.err}`); await page.close(); continue; }

    // DRAIN — the stub cannot cancel a callback already scheduled, and headless Chromium
    // holds it until something composites. Force a composite per turn (`140d054`).
    const STABLE_TURNS = 3;
    let f0 = await page.evaluate(FRAMES), stable = 0, turns = 0;
    for (; turns < 20 && stable < STABLE_TURNS; turns++) {
      await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
      // eslint-disable-next-line no-await-in-loop
      const f1 = await page.evaluate(FRAMES);
      if (f1 === f0) stable++; else { stable = 0; f0 = f1; }
    }
    const settled = stable >= STABLE_TURNS;
    if (!settled) report.faults.push(`${id}: the game loop never stopped across ${turns} forced composites`);
    console.log(`   loop held: ${settled ? `yes, frames stable at ${f0}` : `🔴 NO (${f0})`}`);

    const pointing = await page.evaluate(POINTING, { y0: Y0, y1: Y1 });
    const entry = { id, x: st.x, y: st.y, hudAnimations: nAnims, loopHeld: settled, frames: f0, pointing, rows: [] };
    console.log(`   pointing: ${pointing.nodes.length} character nodes, ${pointing.nInBand} projecting INTO band rows ${pointing.rows[0]}–${pointing.rows[1]}`);

    const base = await page.evaluate(SNAPSHOT);
    entry.baseline = base;

    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      const res = await page.evaluate(ROW, { base, set: r.set, y0: Y0, y1: Y1, plant: KNOWN_BAD, shot: SHOTS });
      if (res.err) { report.faults.push(`${id}/${r.label}: ${res.err}`); console.log(`   🔴 ${r.label}: ${res.err}`); continue; }
      if (res.png) {
        const file = join(OUT, `${id}__${r.label.replace(/[^a-z0-9.]+/gi, '_')}.png`);
        writeFileSync(file, Buffer.from(res.png.split(',')[1], 'base64'));
        res.pngPath = file;
        delete res.png;
      }
      entry.rows.push({ label: r.label, set: r.set, ...res });
      delete entry.rows[entry.rows.length - 1].png;
      const b = res.band;
      const f = (v, d = 4) => (v == null ? '  null' : v.toFixed(d));
      console.log(`   ${r.label.padEnd(28)} sat ${f(b.sat)}  chroma ${f(b.chroma)}  luma ${f(b.luma)}  ch255 ${f(b.ch255)}  white ${f(b.white)}  hueR ${f(b.hueR, 3)}  draws ${res.draws}`);
    }
    // restore, so a later probe on the same page is not measuring the last row
    await page.evaluate(ROW, { base, set: {}, y0: Y0, y1: Y1, plant: null, shot: false });
    report.stations.push(entry);
    await page.close();
  }
  await browser.close();

  // ── GUARDS. Every one has a way to fail, and `--known-bad` is how you see it. ──
  console.log('\n── guards ──');
  if (!report.stations.length) { report.faults.push('NO station produced a result'); }
  for (const e of report.stations) {
    const first = e.rows.find((r) => r.label === 'shipped');
    const last = e.rows.filter((r) => r.label === 'shipped(again)').pop();
    // P1 — non-empty, asserted BEFORE anything is averaged over it
    if (!first || !first.band || !first.band.n) {
      report.faults.push(`${e.id}: P1 the band is EMPTY (n=${first && first.band ? first.band.n : 'n/a'}) — every number here is a mean over nothing`);
    } else {
      console.log(`   P1 band non-empty: ${first.band.n} px over rows ${first.band.rows[0]}–${first.band.rows[1]} ✅`);
      // P2 — not flat
      if (!(first.band.lumaSd > 0.02)) report.faults.push(`${e.id}: P2 the band is FLAT (luma sd ${first.band.lumaSd}) — a cleared buffer reads like this`);
      else console.log(`   P2 band has structure: luma sd ${first.band.lumaSd.toFixed(4)} > 0.02 ✅`);
    }
    // P3 — pointed at the play area, not at the sky
    if (!e.pointing || e.pointing.nInBand < 1) report.faults.push(`${e.id}: P3 NO character projects into the band — the instrument may be photographing the sky`);
    else console.log(`   P3 ${e.pointing.nInBand} character node(s) inside the band ✅`);
    // P4 — six seats
    // ⚠️ `EXPECT_SEATS` defaults to SIX and must be passed explicitly to mean anything else.
    // It is an assertion that the scene holds the roster the caller ASKED for, never a
    // licence to measure fewer: the draw-call arm legitimately runs one seat, and the very
    // first run of this tool proved the guard is load-bearing — a `NaN` station silently
    // collapsed a six-seat ring to the app's two-fighter default and P4 was the ONLY check
    // of eight that noticed.
    if (!e.pointing || e.pointing.nodes.length !== EXPECT_SEATS) report.faults.push(`${e.id}: P4 ${e.pointing ? e.pointing.nodes.length : 0} character nodes in the scene, expected ${EXPECT_SEATS} — this is not the frame that was asked for`);
    else console.log(`   P4 ${e.pointing.nodes.length} character nodes in the scene (expected ${EXPECT_SEATS}) ✅`);
    // SELF-PAIR — the sweep's own drift control
    if (first && last) {
      const same = first.sha === last.sha;
      console.log(`   SELF-PAIR shipped vs shipped(again): ${same ? 'BIT-IDENTICAL ✅' : `🔴 MOVED  ${first.sha} != ${last.sha}`}`);
      if (!same) report.faults.push(`${e.id}: SELF-PAIR moved — every row in this sweep is void`);
    } else if (rows.length > 1) {
      report.faults.push(`${e.id}: SELF-PAIR could not run (missing a shipped row)`);
    }
    // POSITIVE CONTROL — if present, it must have MOVED the frame
    const pos = e.rows.filter((r) => r.label.startsWith('POSCTRL'));
    if (pos.length) {
      for (const p of pos) {
        const moved = first && p.sha !== first.sha;
        console.log(`   POSCTRL ${p.label}: ${moved ? 'moved the frame ✅' : '🔴 IDENTICAL to shipped — the knob path never reached the render'}`);
        if (!moved) report.faults.push(`${e.id}: positive control ${p.label} did not move the frame — every null row in this sweep is uninterpretable`);
      }
    } else if (rows.length > 2) {
      report.faults.push(`${e.id}: no positive control in the sweep`);
    }

    // ── THE `shadow` WAVE'S OWN VERDICT — a two-sided claim, asserted both ways ──
    //
    // The claim is "`key.shadow.radius` is inert under `PCFSoftShadowMap`". One side of
    // that is three PCF_SOFT rows agreeing bit-for-bit with `shipped`. On its own that
    // is worthless: a knob path that never resolved looks exactly the same. So the
    // OTHER side is asserted in the same breath — the identical values under
    // `PCFShadowMap` must produce three DISTINCT frames. Only the pair is evidence.
    //
    // ⚠️ Both arms assert their row set is NON-EMPTY first. `[].every()` is `true`, and
    // a wave that stopped emitting these labels would otherwise report a clean pass on
    // zero rows (`CLAUDE.md` #6, the vacuity class).
    const softR = e.rows.filter((r) => /^PCF_SOFT radius/.test(r.label));
    const hardR = e.rows.filter((r) => /^PCF radius/.test(r.label));
    // ⚠️ ASYMMETRIC ON PURPOSE, and the asymmetry is the point. SHADOW-B is a
    // standalone positive result ("this knob moves the frame"), so a wave may carry it
    // alone. SHADOW-A is a NULL, and a null is only evidence next to the control that
    // shows the path works — so a wave carrying PCF_SOFT rows WITHOUT PCF rows is a
    // fault, while the reverse is not.
    if (softR.length || hardR.length) {
      if (softR.length && softR.length < 2) {
        report.faults.push(`${e.id}: the PCF_SOFT radius arm has ${softR.length} row(s) — too few to say anything`);
      } else if (softR.length) {
        const inert = first && softR.every((r) => r.sha === first.sha);
        console.log(`   SHADOW-A radius is INERT under PCF_SOFT: ${inert ? `✅ ${softR.length}/${softR.length} rows bit-identical to shipped` : `🔴 NO — a radius row moved the frame`}`);
        if (!inert) report.faults.push(`${e.id}: SHADOW-A a PCF_SOFT radius row MOVED the frame — the deadness claim is false and must be withdrawn`);
      }
      if (softR.length >= 2 && hardR.length < 2) {
        report.faults.push(`${e.id}: the PCF radius arm has ${hardR.length} row(s) — the inertness arm has no positive control`);
      } else if (hardR.length >= 2) {
        const shas = new Set(hardR.map((r) => r.sha));
        const live = shas.size === hardR.length && first && !shas.has(first.sha);
        console.log(`   SHADOW-B radius is LIVE under PCF:     ${live ? `✅ ${shas.size} distinct frames from ${hardR.length} rows, none equal to shipped` : `🔴 NO — ${shas.size} distinct frames from ${hardR.length} rows`}`);
        if (!live) report.faults.push(`${e.id}: SHADOW-B the same radius values under PCF did NOT produce distinct frames — SHADOW-A's null is uninterpretable`);
      }
    }
  }
  // KNOWN-BAD arms
  if (KNOWN_BAD === 'grey' || KNOWN_BAD === 'red') {
    const want = KNOWN_BAD === 'red' ? 1 : 0;
    let miss = 0, rowsSeen = 0;
    for (const e of report.stations) for (const r of e.rows) {
      const b = r.band;
      rowsSeen++;
      if (!b || b.sat == null || Math.abs(b.sat - want) > 1e-9 || Math.abs(b.chroma - want) > 1e-9) {
        miss++;
        report.faults.push(`${e.id}/${r.label}: KNOWN-BAD ${KNOWN_BAD} should read sat=${want} chroma=${want}, read ${b && b.sat} / ${b && b.chroma}`);
      }
    }
    // ⚠️ NON-EMPTY FIRST, on the arm that exists to prove the guards can fail: a
    // known-bad run over ZERO rows would otherwise print a tick.
    if (!rowsSeen) report.faults.push(`KNOWN-BAD ${KNOWN_BAD} examined NO rows — it proved nothing`);
    //
    // 🚨 THIS VERDICT USED TO READ `report.faults.length`, WHICH IS THE WRONG SET, AND IT
    // CALLED ITS OWN SUCCESSFUL KNOWN-BAD A FAILURE. The old wording is kept per
    // `CLAUDE.md`'s reversed-assertion rule:
    //     `${report.faults.length ? '🔴 did not read its planted answer' : ...}`
    // Planting flat grey makes the band FLAT, so P2 fires — CORRECTLY, that is P2 doing
    // its job — and the total fault count is therefore non-zero on a run where every
    // planted row read exactly 0.0000/0.0000. The verdict must be scoped to the faults
    // THIS arm raised, and P2 firing here is a SECOND piece of evidence rather than a
    // contradiction: on `--known-bad grey` the tool should read the plant AND report the
    // band as structureless.
    console.log(`   KNOWN-BAD ${KNOWN_BAD}: ${miss ? `🔴 ${miss}/${rowsSeen} rows did not read the planted answer` : `all ${rowsSeen} rows read sat=${want}.0000 chroma=${want}.0000 ✅`}`);
    const flat = report.faults.filter((f) => /P2 the band is FLAT/.test(f)).length;
    if (KNOWN_BAD === 'grey') console.log(`   ...and P2 fired on ${flat} station(s) — EXPECTED, a planted flat band IS flat ✅`);
  }
  if (KNOWN_BAD === 'blank') {
    const p2p3 = report.faults.filter((f) => /P2|P3/.test(f)).length;
    console.log(`   KNOWN-BAD blank: P2/P3 faults raised = ${p2p3} ${p2p3 >= 1 ? '✅ (the guards CAN fail)' : '🔴 the guards passed on a cleared buffer'}`);
    if (p2p3 === 0) report.faults.push('KNOWN-BAD blank passed every guard — the guards are decorative');
  }

  writeFileSync(join(OUT, 'v2band.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.faults.length ? `🔴 ${report.faults.length} FAULT(S)` : '✅ no faults'} · ${join(OUT, 'v2band.json')}`);
  for (const f of report.faults) console.log(`   • ${f}`);
  process.exitCode = report.faults.length && KNOWN_BAD == null ? 1 : 0;
}

// ⚠️ IS_MAIN guard: three tools in this repo run work on import (`docs/AGENT-BRIEF.md` §3).
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_MAIN) {
  if (has('--selftest')) selftest();
  else if (has('--plates')) plates();
  else run();
}
export { vbBand, BAND_SRC };
