#!/usr/bin/env node
/**
 * V2_SHOT — does a character SEPARATE from the floor it stands on? Both cameras, paired.
 *
 * THROWAWAY INSTRUMENT. Read-only on `src/`. Item 2 of Uri's four-reason list:
 *
 *   > *"The Soup character is cream/yellow on pink and the Sushi is white/orange on pink —
 *   > there's almost no tonal separation, so they read as part of the floor rather than on
 *   > top of it."*
 *
 * The floor he means is `src/arena/floor.ts`'s tile field (`tileLight` / `tileDark`), which
 * is a dusty mauve-pink. So the subject and the ground are measured against each other, on
 * the SHIPPED match path, at BOTH shipped pitches.
 *
 * ── ONE PITCH HERE, AND THAT IS A CORRECTION ─────────────────────────────────
 * `src/ui/screens/charStage.ts` ships the lobby at **pitch 20**; `src/render/camera.ts`
 * defaults the match to **58** (grep `opts.pitchDeg ?? 58` — the line number has moved three
 * times in a day, so it is not quoted). CLAUDE.md #3 requires both.
 *
 * 🚨 **BUT THIS TOOL'S FIRST VERSION FAKED THE SHALLOW ONE AND PHOTOGRAPHED NOTHING.** It
 * set `stage.rig.pitchDeg = 20` on the live match rig and re-rendered, which looks exactly
 * like using the shipped field. Measured: draw calls **329 → 73**, **0 of 2 subjects in
 * shot**. The match rig is `frameMode: 'fair'` and SOLVES its distance and look-ahead from
 * the pitch to hold a fair ground radius, so dropping to 20 pushes the camera out until the
 * subject is a speck off-frame. The lobby is `frameMode: 'subject'` — a different framing of
 * a different scene, not the same camera at another angle.
 * → this tool owns the MATCH camera, on the real pink tile field, at six seats.
 * → the shallow arm is `tools/tmp/cm_shot.mjs`, which builds both rigs properly through the
 *   preview path. Run it on both trees. Do not fake it here.
 *
 * ── WHAT MAKES A FRAME COMPARABLE ACROSS ARMS ────────────────────────────────
 * Three separate stillnesses, and this repo has been bitten by each one alone:
 *   1. **rAF held** — the game loop stops. `docs/LESSONS.md`: freezing the clock is not
 *      freezing the loop.
 *   2. **camera shake zeroed** — `CameraRig.update` only holds its offset at `dt === 0`
 *      (fixed in-tree); this tool renders with `stage.render(0)` AND zeroes `shakeAmount`,
 *      so neither half is relied on alone.
 *   3. **HUD CSS stilled** — CSS animations run on the document timeline, not on rAF, and
 *      `locator('canvas').screenshot()` is a page capture clipped to the canvas box. Not
 *      stilling them put 471,742 px of 1,440,000 into a self-pair with rAF already frozen.
 * The drift control below asserts all three landed: two captures of the identical frame
 * must differ by **exactly zero** bytes. A non-zero self-pair voids every number in the run.
 *
 * ── THE MASK IS FROM THE DIRECT RENDER, NEVER FROM THE POST CHAIN ───────────
 * Two-clear-colour matte (black clear vs white clear, composer bypassed, shadows off), the
 * technique `haloprobe.mjs` established here. A post-processed matte would contain the bloom
 * halo it is being used to measure — measured at 58% halo on a 26,173 px character.
 *
 * ── VACUITY GUARDS (CLAUDE.md #6: `[].every()` is `true`) ────────────────────
 * Every filtered set is asserted NON-EMPTY *before* anything is asserted over it, and the
 * subject is asserted to be IN SHOT rather than merely reachable — one instrument here
 * photographed the sky and reported PASS because it only checked the rig existed:
 *   G1  at least one `character:*` group in the scene
 *   G2  the measured fighter's matte is > `MIN_SUBJECT_PX` pixels
 *   G3  its bbox is inside the viewport, not clipped to an edge
 *   G4  the drift control is exactly 0 px
 *   G5  `--known-bad blank` clears the drawing buffer before the matte is read; G1-G3 must
 *       then FAIL and the tool must exit 3. A guard not shown to fail is not a guard.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/v2_shot.mjs --selftest                       # offline, no browser
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-v2-before -- \
 *     node tools/tmp/v2_shot.mjs --url '{URL}' --out shots/v2/before --label BEFORE
 *   ... --known-bad blank                                       # G1-G3 must fail, exit 3
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { VL, VL_SRC } from './valuelib.mjs';
import { captureSettled } from './settle.mjs';

/**
 * ⚠️ COPIED, NOT IMPORTED, AND THE REASON IS A DEFECT WORTH REPORTING.
 *
 * `tools/tmp/sc_fogstill.mjs` exports `PAGE_STILL_HUD` — three lines that take an
 * rAF-frozen station from 471,742 px of self-pair drift to 0 — and importing it is the
 * right instinct. But **that file has no `IS_MAIN` guard**: `import { PAGE_STILL_HUD }
 * from './sc_fogstill.mjs'` runs its whole CLI path on import and exits the process with
 * `sc_fogstill: need --url or PREVIEW_BASE`, so this tool's own `--selftest` could not
 * run at all. `docs/AGENT-BRIEF.md` §3 records three files with this exact defect
 * (`snapsweep.mjs` printed a live sweep on import, `da_census.mjs` fell through into
 * `runCapture`); this is a fourth. Routed rather than fixed — that file is not in this
 * agent's owned set. The body below is byte-for-byte its export.
 */
const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'sc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const an of document.getAnimations()) { try { an.currentTime = 0; an.pause(); } catch { /* finished */ } }
  return document.getAnimations().length;
};

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const has = (k) => a.includes(k);
const ROOT = resolve(process.argv[1], '../../..');

const W = Number(get('--w', 1600));
const H = Number(get('--h', 900));
/** A matte smaller than this is a speck, not a subject in shot. ~0.1% of 1600×900. */
const MIN_SUBJECT_PX = 1400;

// ─────────────────────────────────────────────────────────────────────────────
// Stations — READ, never retyped. `docs/LESSONS.md` §18: a stale 1× coordinate is
// still a LEGAL coordinate, so no legality check can see it. These ids are
// `tools/arena-scan.mjs`'s own --selftest-validated stations; the coordinates are
// re-read off `tools/arena.gameplay.json`'s centre so a future resize moves them.
// ─────────────────────────────────────────────────────────────────────────────
const ARENA = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const CX = ARENA.center.x, CY = ARENA.center.y;

/**
 * Offsets are expressed from the arena CENTRE, in units of the centre hazard's own
 * radius where a relationship exists, so nothing here is a bare map literal.
 * `pot_south` = arena-scan's (1400,1200) at today's centre; `west_lane` = (600,1000).
 */
const POT = ARENA.hazards.find((h) => h.kind === 'damage' && h.x === CX && h.y === CY);
const STATIONS = {
  pot_south: { x: CX, y: CY + Math.round(POT.radius * 2.105), note: 'hub, pot 200wu north — pink tile field fills the frame' },
  west_lane: { x: CX - Math.round(POT.radius * 8.421), y: CY, note: 'west combat lane, prep counters + spill decals' },
};

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// ─────────────────────────────────────────────────────────────────────────────
// HUE — one implementation, run in Node for the selftest and injected into the page.
// The collapsed axis on the cast frame is HUE, not value: three blind panels all
// prescribed value separation, which already reads at |dL| 65-75 of 255. So hue
// concentration is reported beside dL rather than instead of it.
// ─────────────────────────────────────────────────────────────────────────────
const HUE_SRC = String.raw`
/** sRGB byte triple -> {h in [0,360), s in [0,1], v in [0,1]} */
function v2hsv(r, g, b) {
  var R = r / 255, G = g / 255, B = b / 255;
  var mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  var h = 0;
  if (d > 0) {
    if (mx === R) h = 60 * (((G - B) / d) % 6);
    else if (mx === G) h = 60 * ((B - R) / d + 2);
    else h = 60 * ((R - G) / d + 4);
  }
  if (h < 0) h += 360;
  return { h: h, s: mx === 0 ? 0 : d / mx, v: mx };
}
/**
 * Circular mean direction and concentration R over the CHROMATIC pixels of a masked
 * region. R -> 1 means every hue points the same way (the collapse); R -> 0 means
 * hues are spread. 'satFloor' excludes greys, whose hue is meaningless noise.
 */
function v2hueStat(rgba, mask, W, H, satFloor) {
  var sx = 0, sy = 0, n = 0, sSum = 0, vSum = 0, all = 0;
  for (var j = 0, i = 0; j < W * H; j++, i += 4) {
    if (!mask[j]) continue;
    all++;
    var c = v2hsv(rgba[i], rgba[i + 1], rgba[i + 2]);
    sSum += c.s; vSum += c.v;
    if (c.s < satFloor) continue;
    var t = c.h * Math.PI / 180;
    sx += Math.cos(t); sy += Math.sin(t); n++;
  }
  if (!all) return null;
  if (!n) return { px: all, chromaticPx: 0, meanSat: sSum / all, meanVal: vSum / all, hueDeg: null, R: null };
  var mh = Math.atan2(sy / n, sx / n) * 180 / Math.PI;
  if (mh < 0) mh += 360;
  return {
    px: all, chromaticPx: n,
    meanSat: sSum / all, meanVal: vSum / all,
    hueDeg: mh, R: Math.hypot(sx / n, sy / n),
  };
}
/** Shortest angular separation between two hue angles, in degrees, 0..180. */
function v2hueGap(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
`;
{
  // eslint-disable-next-line no-new-func
  new Function(`${HUE_SRC}; globalThis.V2H = { hsv: v2hsv, hueStat: v2hueStat, hueGap: v2hueGap };`)();
}
const V2H = globalThis.V2H;

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — validates the LOGIC. ⚠️ It never validates where the tool is POINTED;
// that is what the station derivation above and G1-G3 in the live run are for.
// ─────────────────────────────────────────────────────────────────────────────
if (has('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail) => {
    if (cond) { pass++; console.log(`  ok   - ${name}  [${detail}]`); }
    else { fail++; console.log(`  FAIL - ${name}  [${detail}]`); }
  };

  // §A hue arithmetic, by hand
  const red = V2H.hsv(255, 0, 0);
  ok('A1 pure red is hue 0, sat 1', Math.abs(red.h) < 1e-9 && Math.abs(red.s - 1) < 1e-9, `h=${red.h} s=${red.s}`);
  const cy = V2H.hsv(0, 255, 255);
  ok('A2 pure cyan is hue 180', Math.abs(cy.h - 180) < 1e-9, `h=${cy.h}`);
  const gy = V2H.hsv(128, 128, 128);
  ok('A3 grey has sat 0', gy.s === 0, `s=${gy.s}`);
  ok('A4 hueGap wraps the short way', V2H.hueGap(350, 10) === 20, `${V2H.hueGap(350, 10)}`);

  // §B circular stats on a synthetic field whose answer is known
  const mk = (n, fn) => {
    const rgba = new Uint8Array(n * 4), mask = new Uint8Array(n);
    for (let j = 0; j < n; j++) { const [r, g, b] = fn(j); rgba[j * 4] = r; rgba[j * 4 + 1] = g; rgba[j * 4 + 2] = b; mask[j] = 1; }
    return { rgba, mask, n };
  };
  const allRed = mk(100, () => [255, 0, 0]);
  const s1 = V2H.hueStat(allRed.rgba, allRed.mask, 100, 1, 0.15);
  ok('B1 one hue -> R = 1', Math.abs(s1.R - 1) < 1e-9, `R=${s1.R.toFixed(6)}`);
  const opp = mk(100, (j) => (j % 2 ? [255, 0, 0] : [0, 255, 255]));
  const s2 = V2H.hueStat(opp.rgba, opp.mask, 100, 1, 0.15);
  ok('B2 two opposite hues -> R ~ 0', s2.R < 1e-9, `R=${s2.R.toExponential(2)}`);
  const greys = mk(100, () => [128, 128, 128]);
  const s3 = V2H.hueStat(greys.rgba, greys.mask, 100, 1, 0.15);
  ok('B3 an all-grey region reports chromaticPx 0, not a fake hue', s3.chromaticPx === 0 && s3.hueDeg === null, `chromatic=${s3.chromaticPx}`);
  ok('B4 an EMPTY mask returns null, it does not return a clean-looking zero',
    V2H.hueStat(greys.rgba, new Uint8Array(100), 100, 1, 0.15) === null, 'null');

  // §C figure/ground, against valuelib's own implementation on a field built by hand:
  //    a 20x20 white square (luma 1) on a black ground (luma 0).
  {
    const w = 60, h = 60;
    const luma = new Float64Array(w * h), mask = new Uint8Array(w * h);
    for (let y = 20; y < 40; y++) for (let x = 20; x < 40; x++) { mask[y * w + x] = 1; luma[y * w + x] = 1; }
    const fg = VL.figureGround(luma, w, h, mask, { ringFrac: 0.3, edgeR: 2 });
    ok('C1 dL of white-on-black is 1.0', Math.abs(fg.dL - 1) < 1e-6, `dL=${fg.dL}`);
    ok('C2 the figure is 400 px', fg.figurePx === 400, `${fg.figurePx}`);
    ok('C3 dLedge is 1.0 too', Math.abs(fg.dLedge - 1) < 1e-6, `dLedge=${fg.dLedge}`);
  }

  // §D THE VACUITY ARM — the class that caught six instruments in one session.
  {
    const empty = new Uint8Array(60 * 60);
    ok('D1 figureGround on an EMPTY mask returns null, never a passing number',
      VL.figureGround(new Float64Array(60 * 60), 60, 60, empty, {}) === null, 'null');
    // and the guard that consumes it
    const guard = (m) => { let n = 0; for (let j = 0; j < m.length; j++) n += m[j]; return n >= MIN_SUBJECT_PX; };
    ok('D2 the subject-in-shot guard REFUSES an empty matte', guard(empty) === false, 'refused');
    const full = new Uint8Array(60 * 60).fill(1);
    ok('D3 ... and ACCEPTS a real one (so D2 is not vacuously true)', guard(full) === true, `${full.length} px`);
  }

  // §E STATION DERIVATION — the 1× trap. The known-bad is the literal pre-×4 list.
  {
    const inMap = (p) => p.x > 20 && p.x < ARENA.width - 20 && p.y > 20 && p.y < ARENA.height - 20;
    const st = Object.values(STATIONS);
    ok('E1 the station list is NON-EMPTY before anything is asserted over it', st.length > 0, `${st.length}`);
    ok('E2 every station is on the map', st.every(inMap), st.map((s) => `${s.x},${s.y}`).join(' '));
    const quadrant = (p) => `${p.x < CX ? 'W' : 'E'}${p.y < CY ? 'N' : 'S'}`;
    ok('E3 the stations are not all in one quadrant', new Set(st.map(quadrant)).size > 1, [...new Set(st.map(quadrant))].join('+'));
    // known-bad: the pre-6631446 1× coordinates, which are all legal on the ×4 map
    const stale = [{ x: 700, y: 640 }, { x: 160, y: 500 }, { x: 560, y: 900 }];
    ok('E4 known-bad: the 1× list IS still legal (so legality cannot catch it)', stale.every(inMap), 'all legal');
    ok('E5 known-bad: ... and the quadrant test DOES catch it', new Set(stale.map(quadrant)).size === 1, [...new Set(stale.map(quadrant))].join('+'));
  }

  console.log(`\n${fail ? '🔴 FAIL' : '✅ PASS'}  v2_shot --selftest: ${pass}/${pass + fail}`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE
// ─────────────────────────────────────────────────────────────────────────────
const BASE = (process.env.PREVIEW_BASE ?? get('--url', '')).replace(/\/$/, '');
if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
if (BASE.includes(':5173')) { console.error('\n!! --url is the SHARED dev server. Never measure there.\n'); process.exit(2); }

const OUT = get('--out', 'shots/v2/run');
const LABEL = get('--label', 'unlabelled');
const KNOWN_BAD = get('--known-bad', null);
/**
 * The roster, in SLOT order. Slot 0 is what the camera centres on. Six seats, because
 * `docs/HANDOVER.md` records six-seat invisibility as this project's dominant defect
 * class and a separation number measured at two seats is measured on a frame the player
 * mostly does not see. Soup and Sushi lead because they are the two Uri named.
 */
const ROSTER = String(get('--roster', 'soup,sushi,taco,donut,egg,pizza')).split(',').filter(Boolean);
/**
 * Ring radius for slots 1..N, in wu. The camera's ground window at 16:9 is ~579x398 wu
 * — a CAMERA property that did not change when the map quadrupled — so 110 wu keeps
 * every seat inside the frame with room for the fair-view margin.
 */
const RING_WU = Number(get('--ring', 110));
const SEATS = ROSTER.length;
const PLAYER = ROSTER[0];
const ENEMY = ROSTER[1];
const STATION_IDS = String(get('--stations', 'pot_south')).split(',');
/**
 * WHICH fighters are measured. Every requested id must be FOUND — a missing subject is
 * a FAULT, not a quietly shorter list. `[].every()` is `true`, and a filter that
 * silently empties is the exact vacuity that caught six instruments here in one session.
 */
const SUBJECTS = String(get('--subjects', `${ROSTER[0]},${ROSTER[1]}`)).split(',').filter(Boolean);
const DIAG = has('--diag');

mkdirSync(OUT, { recursive: true });

/** Page-side: everything that has to be true before a pixel is read. */
const FREEZE = (blank) => {
  const w = window;
  // 1. hold rAF. Installed as a no-op that still returns an id, so anything that
  //    cancels a handle does not throw. Counted, because a freeze that did not hold is
  //    indistinguishable from a page that was already still — and a "still" result from
  //    a probe whose freeze failed is a lie, not a null.
  w.__v2raf = 0;
  w.requestAnimationFrame = () => { w.__v2raf++; return 0; };
  const stage = w.__stage;
  if (!stage) return { err: 'no window.__stage' };
  // 2. zero the shake explicitly. `stage.render(0)` also holds it (the dt>0 guard in
  //    CameraRig.update), but a probe that relies on ONE of the two is one refactor
  //    from measuring a moving camera, and 344 of 344 frozen frames once drifted.
  try { stage.rig.shakeAmount = 0; stage.rig.shakeOffset.set(0, 0, 0); } catch { /* older rig */ }
  if (blank) {
    // KNOWN-BAD: clear the drawing buffer and leave it cleared. Every in-shot guard
    // below must fail on this.
    const gl = stage.renderer.getContext();
    stage.render = () => { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); };
  }
  return { ok: true, frames: w.__matchDebug ? w.__matchDebug.frames : null };
};

/**
 * 🚨 SWAPPING `requestAnimationFrame` DOES NOT CANCEL THE CALLBACK ALREADY IN FLIGHT.
 *
 * Measured, by this tool's own `--diag`, on the run that found it: `__v2raf` counted **1**
 * call through the stub and `__matchDebug.frames` went **8 -> 9**. Exactly one more game
 * frame ran after the freeze — the one the browser had already scheduled — and it landed
 * between the two halves of the drift control, which duly read MOVED. Both diagnostic arms
 * were green (`readPixels` stable with no render between; two renders in one task
 * identical), so the mover was neither the read nor the renderer.
 *
 * That one frame is enough to void a pixel A/B, and "freeze then immediately measure" is
 * the shape every probe here uses. So the freeze is not complete until the frame counter
 * has STOPPED, and that is asserted rather than slept through.
 */
const FRAMES = () => (window.__matchDebug ? window.__matchDebug.frames : null);

/**
 * WHY THE FREEZE MIGHT NOT HAVE HELD — reported, never inferred. Four reads: two in ONE
 * task with no render between them (is `readPixels` itself stable?), one after a render
 * in the same task, one after a wall-clock gap. Which pair differs names the cause.
 */
const DIAG_READ = () => {
  const w = window;
  const stage = w.__stage;
  const gl = stage.renderer.getContext();
  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const read = () => {
    const buf = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let h = 0x811c9dc5, s = 0;
    for (let i = 0; i < buf.length; i++) { h = ((h ^ buf[i]) * 16777619) >>> 0; s += buf[i]; }
    return `${h.toString(16)}/${s}`;
  };
  const noRender = read();
  const noRender2 = read();
  stage.render(0);
  const afterRender = read();
  stage.render(0);
  const afterRender2 = read();
  return {
    raf: w.__v2raf, frames: w.__matchDebug ? w.__matchDebug.frames : null,
    noRender, noRender2, afterRender, afterRender2,
    readStableWithoutRender: noRender === noRender2,
    renderIsDeterministic: afterRender === afterRender2,
  };
};

/**
 * Page-side measurement. Returns per-character figure/ground + hue against the floor
 * it stands on, at the CURRENT pitch, plus the draw-call count for the frame.
 *
 * `pitch` is applied to `stage.rig.pitchDeg` — the same field `CameraRigOptions.pitchDeg`
 * writes — and the frame is re-rendered before anything is read.
 */
const MEASURE = (opts) => {
  const w = window;
  // VL and V2H arrive by `addInitScript` (see `INJECT` below), not by import: this
  // function is serialised into the page, so every Node-side binding it closes over is
  // undefined there. The first version of this tool referenced `VL` directly and threw
  // `ReferenceError: VL is not defined` — after the drift control had already run, so
  // the run got 24 minutes in before it failed.
  const VL = w.VL, V2H = w.V2H;
  if (!VL || !V2H) return { err: 'VL/V2H not injected into the page' };
  const stage = w.__stage;
  const r = stage.renderer;
  const gl = r.getContext();
  const scene = stage.scene;
  const cam = stage.rig.camera;

  if (opts.pitch != null) stage.rig.pitchDeg = opts.pitch;
  r.info.autoReset = false;
  r.info.reset();
  stage.render(0);
  const draws = { calls: r.info.render.calls, tris: r.info.render.triangles, programs: r.info.programs ? r.info.programs.length : null };

  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const readAll = () => {
    const buf = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out = new Uint8Array(Wp * Hp * 4);
    for (let row = 0; row < Hp; row++) out.set(buf.subarray((Hp - 1 - row) * Wp * 4, (Hp - row) * Wp * 4), row * Wp * 4);
    return out;
  };

  // the SHIPPED, post-processed frame — this is what the eye sees and what dL is read on
  const shipped = readAll();
  const luma = new Float64Array(Wp * Hp);
  for (let j = 0, i = 0; j < Wp * Hp; j++, i += 4) luma[j] = VL.luma(shipped[i], shipped[i + 1], shipped[i + 2]);

  // ── the mattes, from the DIRECT render (composer bypassed, shadows off) ────
  const all = [];
  scene.traverse((o) => { if (/^character:/.test(o.name)) all.push(o); });
  if (!all.length) return { err: 'G1 no character:* group in the scene — every number below would be about nothing' };
  // Measure only the requested subjects — but REFUSE a request that did not resolve.
  // Silently measuring the ones that happened to be present is how a filtered set
  // empties and every assertion over it passes.
  const casts = all.filter((c) => opts.subjects.some((s) => c.name === `character:${s}`));
  const missing = opts.subjects.filter((s) => !all.some((c) => c.name === `character:${s}`));
  if (missing.length) {
    return { err: `G1b requested subject(s) not in the scene: ${missing.join(',')} — present: ${all.map((c) => c.name).join(',')}` };
  }
  if (!casts.length) return { err: 'G1c the subject filter emptied the set' };

  const savedBg = scene.background, savedShadow = r.shadowMap.enabled;
  const savedAutoClear = r.autoClear, savedAlpha = r.getClearAlpha();
  let hidden = [];
  const hideAllBut = (keep) => {
    hidden = [];
    for (const kid of scene.children) { if (kid === keep) continue; if (kid.visible) { hidden.push(kid); kid.visible = false; } }
  };
  const restore = () => { for (const k of hidden) k.visible = true; hidden = []; };
  const topOf = (o) => { let n = o; while (n.parent && n.parent !== scene) n = n.parent; return n; };
  const matte = () => {
    scene.background = null; r.shadowMap.enabled = false; r.autoClear = true; r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const A = readAll();
    r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam);
    const B = readAll();
    const m = new Uint8Array(Wp * Hp);
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      m[j] = d < 32 ? 1 : 0;
    }
    return m;
  };

  // ⚠️ THE UNION MATTE IS OF **ALL** CHARACTERS, NOT OF THE MEASURED SUBSET. At six
  // seats, four fighters this run does not measure still stand in the frame, and any of
  // their pixels inside a subject's ground ring would be read as "the floor beside it".
  // Measuring only the subjects and excluding only the subjects is the subtle version of
  // the same vacuity: the filter shrinks the exclusion set as well as the measured set.
  const allTops = new Set(all.map((c) => topOf(c)));
  hidden = [];
  for (const kid of scene.children) { if (allTops.has(kid)) continue; if (kid.visible) { hidden.push(kid); kid.visible = false; } }
  const castUnion = matte();
  restore();

  const per = [];
  for (const c of casts) {
    hideAllBut(topOf(c));
    const others = [];
    for (const o of all) { if (o !== c && topOf(o) === topOf(c) && o.visible) { others.push(o); o.visible = false; } }
    const m = matte();
    for (const o of others) o.visible = true;
    restore();
    let n = 0; for (let j = 0; j < m.length; j++) n += m[j];
    per.push({ name: c.name, px: n, mask: m });
  }
  scene.background = savedBg; r.shadowMap.enabled = savedShadow;
  r.autoClear = savedAutoClear; r.setClearColor(0x000000, savedAlpha);
  stage.render(0);

  let unionPx = 0; for (let j = 0; j < castUnion.length; j++) unionPx += castUnion[j];

  const rows = [];
  for (const p of per) {
    if (p.px < opts.minPx) { rows.push({ name: p.name, px: p.px, inShot: false }); continue; }
    const bb = VL.bbox(p.mask, Wp, Hp);
    const clipped = bb.x0 <= 0 || bb.y0 <= 0 || bb.x0 + bb.w >= Wp || bb.y0 + bb.h >= Hp;
    // ground = anywhere that is not ANY character
    const ground = new Uint8Array(Wp * Hp);
    for (let j = 0; j < Wp * Hp; j++) ground[j] = castUnion[j] ? 0 : 1;
    const fg = VL.figureGround(luma, Wp, Hp, p.mask, { ringFrac: 0.30, edgeR: 4 });

    // ── CONTOUR METRICS. ⚠️ ADDED AFTER THE FIRST PAIRED RUN, AND SAYING SO ────
    // `dL` and `dLedge` above were the pre-registered pair, and on the first A/B they
    // moved the WRONG WAY on a frame that was visibly better. That is not a surprise
    // once stated: `dLedge` is `mean(inner 4 px) - mean(outer 4 px)`, and an inverted
    // hull is INSIDE the silhouette, so a 1.5 px ink line enters that band as ~38% of
    // it and is averaged against 62% of lit body. The metric cannot express "there is
    // now a contour" — it can only report that the inner band's MEAN moved, which a
    // dark contour and a dimmer character do identically. `docs/LESSONS.md` §6b read
    // backwards: a metric moving the wrong way is not evidence the change was wrong,
    // it is a question about what the metric can see.
    //
    // These three can see it, and the reason each one can is stated:
    //   contourDepth  body interior minus its own edge band. A contour makes the
    //                 boundary darker than the BODY, which no overall dimming does.
    //   edgeMinDrop   how much darker the DARKEST decile of the edge band is than the
    //                 floor beside it. A p10, not a mean, precisely so a 1.5 px line
    //                 inside a 2 px band is not averaged away — the same reason
    //                 `cs_charcontact.mjs` reads contact on a p10 rather than a mean.
    //   dLedge2       the pre-registered statistic at a 2 px band instead of 4, so the
    //                 old and new definitions can be compared on one frame.
    // ⚠️ None of them is the acceptance test. The acceptance test for the ink is the
    // ABLATION in `v2_ablate.mjs`, which was defined before the change and needs no
    // metric at all: hide the hulls, diff the frame.
    const inv = new Uint8Array(Wp * Hp);
    for (let j = 0; j < Wp * Hp; j++) inv[j] = p.mask[j] ? 0 : 1;
    const distIn = VL.distanceField(inv, Wp, Hp, 6);
    const edgeBand = [];
    for (let j = 0; j < Wp * Hp; j++) if (p.mask[j] && distIn[j] > 0 && distIn[j] <= 2) edgeBand.push(luma[j]);
    const fg2 = VL.figureGround(luma, Wp, Hp, p.mask, { ringFrac: 0.30, edgeR: 2 });
    let edgeP10 = null;
    if (edgeBand.length) {
      const s = Float64Array.from(edgeBand); s.sort();
      edgeP10 = VL.quantile(s, 0.10);
    }
    const contourDepth = fg.figureLuma == null || fg2.edgeInLuma == null ? null : +(fg.figureLuma - fg2.edgeInLuma).toFixed(4);
    const edgeMinDrop = edgeP10 == null || fg.groundLuma == null ? null : +(fg.groundLuma - edgeP10).toFixed(4);

    // `sepscan.mjs`'s own metric, so its reference band [0.0072 .. 0.0929], median
    // 0.0249, applies directly. This is the gate on a rim change: the recorded reason
    // the glossy rim was never merged is that it lands on the four characters whose
    // near-white clipping was hardest won.
    let clip = 0, subN = 0;
    for (let j = 0; j < Wp * Hp; j++) if (p.mask[j]) { subN++; if (luma[j] > 0.94) clip++; }
    const clipShare = subN ? clip / subN : null;
    // hue of the subject vs hue of its own local ring
    const dist = VL.distanceField(p.mask, Wp, Hp, Math.max(6, Math.round(0.30 * bb.h)) + 2);
    const ringR = Math.max(4, Math.round(0.30 * bb.h));
    const ring = new Uint8Array(Wp * Hp);
    for (let j = 0; j < Wp * Hp; j++) ring[j] = (!p.mask[j] && ground[j] && dist[j] > 0 && dist[j] <= ringR) ? 1 : 0;
    let ringPx = 0; for (let j = 0; j < ring.length; j++) ringPx += ring[j];
    const hSub = V2H.hueStat(shipped, p.mask, Wp, Hp, 0.15);
    const hRing = ringPx ? V2H.hueStat(shipped, ring, Wp, Hp, 0.15) : null;
    rows.push({
      name: p.name, px: p.px, inShot: true, clipped,
      bbox: [bb.x0, bb.y0, bb.w, bb.h],
      dL: fg.dL, dLedge: fg.dLedge, figureLuma: fg.figureLuma, groundLuma: fg.groundLuma,
      edgeInLuma: fg.edgeInLuma, edgeOutLuma: fg.edgeOutLuma,
      subHueDeg: hSub && hSub.hueDeg, subR: hSub && hSub.R, subSat: hSub && hSub.meanSat,
      ringHueDeg: hRing && hRing.hueDeg, ringR_: hRing && hRing.R, ringSat: hRing && hRing.meanSat,
      hueGap: (hSub && hSub.hueDeg != null && hRing && hRing.hueDeg != null) ? V2H.hueGap(hSub.hueDeg, hRing.hueDeg) : null,
      clipShare, ringPx,
      contourDepth, edgeMinDrop, dLedge2: fg2.dLedge, edgeInLuma2: fg2.edgeInLuma, edgeBandPx: edgeBand.length,
    });
  }
  return { buffer: [Wp, Hp], draws, rows, castUnionPx: unionPx, castCount: all.length };
};

/**
 * Everything that has to exist in the PAGE before `MEASURE` runs. Injected as source,
 * not imported: `page.evaluate` serialises a function and drops every Node-side binding
 * it closed over, which is exactly how the first run of this tool got 24 minutes in and
 * then threw `ReferenceError: VL is not defined`.
 */
const INJECT = `${VL_SRC}\n${HUE_SRC}\nglobalThis.V2H = { hsv: v2hsv, hueStat: v2hueStat, hueGap: v2hueGap };`;

/** A raw drawing-buffer sha, for the drift control. A PNG carries an encoder; this does not. */
const RAWSHA = () => {
  const stage = window.__stage;
  const gl = stage.renderer.getContext();
  stage.render(0);
  const Wp = gl.drawingBufferWidth, Hp = gl.drawingBufferHeight;
  const buf = new Uint8Array(Wp * Hp * 4);
  gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < buf.length; i++) { h1 = ((h1 ^ buf[i]) * 16777619) >>> 0; h2 = ((h2 + buf[i]) * 31) >>> 0; }
  return `${h1.toString(16)}-${h2.toString(16)}-${buf.length}`;
};

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const report = { label: LABEL, base: BASE, viewport: [W, H], seats: SEATS, player: PLAYER, enemy: ENEMY, stations: [], faults: [] };

  for (const id of STATION_IDS) {
    const st = STATIONS[id];
    if (!st) { report.faults.push(`unknown station ${id}`); continue; }
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
    await page.addInitScript(INJECT);
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    // Six fighters, PLACED, on a ring inside the camera's own ground window (~579x398 wu
    // at 16:9 — a CAMERA property, so it did not change when the map quadrupled). Slot 0
    // is the subject the camera centres on. Without explicit spawns the other five stand
    // at map spawn points hundreds of wu away and the frame contains one fighter, which is
    // both the wrong picture and a silently smaller measured set.
    const ring = ROSTER.map((cid, i) => {
      const ang = (i / ROSTER.length) * Math.PI * 2;
      return i === 0 ? `${cid}@${st.x},${st.y}`
        : `${cid}@${Math.round(st.x + Math.cos(ang) * RING_WU)},${Math.round(st.y + Math.sin(ang) * RING_WU)}`;
    }).join(';');
    const q = new URLSearchParams({
      fighters: ring,
      px: String(st.x), py: String(st.y),
      fogRadius: String(ARENA.maxSafeRadius), simSpeed: '0.02', pointerLock: '0',
    });
    console.log(`\n── ${LABEL} · ${id} (${st.x},${st.y}) · roster ${ROSTER.join(',')} · ring ${RING_WU}wu ──`);
    await page.goto(`${BASE}/?${q}`, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
    await page.waitForTimeout(2600);

    const nAnims = await page.evaluate(PAGE_STILL_HUD);
    const fz = await page.evaluate(FREEZE, KNOWN_BAD === 'blank');
    if (fz.err) { report.faults.push(`${id}: ${fz.err}`); await page.close(); continue; }

    // ── DRAIN the in-flight rAF callback, then ASSERT the loop actually stopped ──
    //
    // 🚨 **WAITING IS NOT DRAINING, AND THIS COST TWO RUNS TO PIN DOWN.** The stub cannot
    // cancel the frame the browser has already scheduled. A first version simply polled
    // the counter until it held still: it read `frames` stable at **8 across 2.6 s** and
    // declared the loop held — and the diag then reported **9**, because the pending
    // callback had not fired yet. Headless Chromium THROTTLES `requestAnimationFrame`
    // while nothing is being composited, so the callback sits queued for as long as the
    // page is idle and is delivered the moment something forces a composite — which is
    // exactly what the first `screenshot()` of the measurement does. The stale frame
    // therefore landed *inside* the drift control, every time, and reported as MOVED.
    //
    // So the drain FORCES a composite on each turn (an 8x8 clip, the cheapest one there
    // is) and requires the counter to hold across `STABLE_TURNS` of them. Sleeping longer
    // would never have worked: the callback is not waiting on time, it is waiting on a
    // frame being presented.
    const STABLE_TURNS = 3;
    let f0 = await page.evaluate(FRAMES);
    let stable = 0;
    let turns = 0;
    for (; turns < 20 && stable < STABLE_TURNS; turns++) {
      await page.screenshot({ clip: { x: 0, y: 0, width: 8, height: 8 } });
      // eslint-disable-next-line no-await-in-loop
      const f1 = await page.evaluate(FRAMES);
      if (f1 === f0) stable++; else { stable = 0; f0 = f1; }
    }
    const settled = stable >= STABLE_TURNS;
    if (!settled) report.faults.push(`${id}: the game loop never stopped — frames still advancing across ${turns} forced composites`);
    console.log(`   loop held: ${settled ? `yes, frames stable at ${f0} across ${STABLE_TURNS} forced composites` : `🔴 NO, still moving (${f0})`}`);

    const entry = { id, x: st.x, y: st.y, note: st.note, hudAnimations: nAnims, loopHeld: settled, frames: f0, cams: {} };

    // ── DRIFT CONTROL, before any non-zero number is believed (CLAUDE.md #4) ──
    const s1 = await page.evaluate(RAWSHA);
    await page.waitForTimeout(450);
    const s2 = await page.evaluate(RAWSHA);
    entry.drift = { a: s1, b: s2, identical: s1 === s2, framesAtFreeze: fz.frames };
    console.log(`   drift control: ${s1 === s2 ? 'IDENTICAL ✅' : `🔴 MOVED  ${s1} != ${s2}`}`);
    if (s1 !== s2) report.faults.push(`${id}: drift control moved — every pixel number at this station is void`);
    if (DIAG || s1 !== s2) {
      // ATTRIBUTION, not a guess: which pair of reads differs names the cause.
      const d = await page.evaluate(DIAG_READ);
      entry.diag = d;
      console.log(`   diag: rAF calls held ${d.raf}  matchFrames ${d.frames} (at freeze ${fz.frames})`);
      console.log(`         readPixels stable with NO render between: ${d.readStableWithoutRender ? 'yes' : '🔴 NO — the drawing buffer is not preserved between reads'}`);
      console.log(`         two renders in ONE task agree: ${d.renderIsDeterministic ? 'yes' : '🔴 NO — render() itself is non-deterministic'}`);
    }

    // ── ONE CAMERA HERE, AND THE REASON IS A FINDING, NOT A SIMPLIFICATION ─────
    // 🚨 **YOU CANNOT GET THE LOBBY CAMERA BY WRITING `pitchDeg` ON THE MATCH RIG.**
    // The first version of this tool set `stage.rig.pitchDeg = 20` and re-rendered,
    // exactly as `CameraRigOptions.pitchDeg` would. Measured: draw calls **329 -> 73**
    // and **0 of 2 subjects in shot** — the frame photographed no character at all, and
    // every number it produced would have been about the sky. The match rig runs
    // `frameMode: 'fair'`, so its distance and look-ahead are SOLVED from the pitch to
    // hold a fair ground radius (`camera.ts:fairSolveAt`); dropping the pitch to 20
    // pushes the solve out until the subject is a speck off-frame. `charStage.ts`'s
    // lobby is `frameMode: 'subject'` — a different framing of a different scene, not
    // the same camera at another angle.
    // → the shallow arm is `tools/tmp/cm_shot.mjs`, which builds both rigs properly
    //   through the preview path. Run it on both trees; do not fake it here.
    for (const [key, pitch] of [['match58', null]]) {
      const m = await page.evaluate(MEASURE, { pitch, minPx: MIN_SUBJECT_PX, subjects: SUBJECTS });
      if (m.err) { report.faults.push(`${id}/${key}: ${m.err}`); entry.cams[key] = m; continue; }
      // The PNG the human looks at, and the one a critic scores. Canvas box; the DOM HUD
      // lands in it by construction and is stilled, which is the honest frame — it is
      // what the player sees.
      //
      // ⚠️ Taken through `captureSettled`, not `locator.screenshot()`, for one reason:
      // `tools/review.mjs` REFUSES any PNG with no `<png>.capture.json` sidecar, and a
      // frame with no provenance cannot enter a blind packet. `wait: false` and
      // `enforce: false` because this page is deliberately rAF-frozen — the settle
      // predicate would be waiting on a loop that has been stopped on purpose — and the
      // paint question is answered instead by G2/G3 above, which assert a real subject
      // matte of >= MIN_SUBJECT_PX inside the viewport. The sidecar records `painted`
      // from the DOM either way, so nothing is asserted that was not measured.
      const png = `${OUT}/${id}__${key}.png`;
      const cap = await captureSettled(page, {
        path: png, label: `${LABEL} ${id} ${key}`, tool: 'v2_shot',
        element: page.locator('canvas'), wait: false, enforce: false,
      });
      m.png = png;
      m.capture = { painted: cap.painted, stats: cap.stats, screen: cap.after?.screenName };
      entry.cams[key] = m;
      const inShot = m.rows.filter((r) => r.inShot);
      console.log(`   ${key}: draws ${m.draws.calls}  tris ${m.draws.tris}  subjects in shot ${inShot.length}/${m.rows.length}`);
      for (const r of inShot) {
        console.log(`      ${r.name.replace('character:', '').padEnd(14)} px ${String(r.px).padStart(6)}  h ${String(r.bbox[3]).padStart(4)}px  dL ${String(r.dL).padStart(8)}  dLedge ${String(r.dLedge).padStart(8)}`
          + `  clip ${r.clipShare == null ? '     -' : r.clipShare.toFixed(4).padStart(6)}`
          + `  hue ${r.subHueDeg == null ? '   -' : r.subHueDeg.toFixed(1).padStart(6)}° vs ring ${r.ringHueDeg == null ? '   -' : r.ringHueDeg.toFixed(1).padStart(6)}°`
          + `  gap ${r.hueGap == null ? '  -' : r.hueGap.toFixed(1).padStart(5)}°${r.clipped ? '  ⚠️CLIPPED' : ''}`);
      }
      if (!inShot.length) report.faults.push(`${id}/${key}: G2 NO subject is in shot — the frame photographs no character`);
    }
    report.stations.push(entry);
    await page.close();
  }

  await browser.close();
  writeFileSync(`${OUT}/v2-report.json`, JSON.stringify(report, null, 2));

  // ── the verdict ───────────────────────────────────────────────────────────
  const stations = report.stations;
  console.log('\n── guards ──');
  const g = [];
  g.push(['G1 at least one station produced a frame', stations.length > 0, `${stations.length}`]);
  const allRows = stations.flatMap((s) => Object.values(s.cams).flatMap((c) => c.rows ?? []));
  g.push(['G1b the row set is NON-EMPTY before anything is asserted over it', allRows.length > 0, `${allRows.length} rows`]);
  const inShot = allRows.filter((r) => r.inShot);
  g.push(['G2 at least one subject is IN SHOT (not "the rig was reachable")', inShot.length > 0, `${inShot.length}/${allRows.length}`]);
  g.push(['G3 no in-shot subject is clipped by the viewport edge', inShot.length > 0 && inShot.every((r) => !r.clipped),
    inShot.filter((r) => r.clipped).map((r) => r.name).join(',') || 'none clipped']);
  g.push(['G4 every drift control is byte-identical', stations.length > 0 && stations.every((s) => s.drift.identical),
    stations.map((s) => `${s.id}:${s.drift.identical ? 'ok' : 'MOVED'}`).join(' ')]);
  for (const [n, okv, d] of g) console.log(`  ${okv ? 'ok  ' : 'FAIL'} - ${n}  [${d}]`);

  const allOk = g.every(([, okv]) => okv) && !report.faults.length;
  for (const f of report.faults) console.log(`  🔴 ${f}`);
  console.log(`\n${allOk ? '✅' : '🔴'}  ${LABEL} -> ${OUT}/v2-report.json`);

  if (KNOWN_BAD === 'blank') {
    // G5: the known-bad MUST have broken the in-shot guards. A run that stays green on a
    // cleared drawing buffer is not measuring the drawing buffer.
    const broke = !g[2][1] || !g[3][1];
    console.log(`\n── known-bad 'blank' ──\n  ${broke ? 'ok  ' : 'FAIL'} - clearing the drawing buffer FAILS the in-shot guards  [G2 ${g[2][1] ? 'still green' : 'red'}]`);
    process.exit(broke ? 3 : 1);
  }
  process.exit(allOk ? 0 : 1);
}

await run().catch((e) => { console.error(e); process.exitCode = 1; });
