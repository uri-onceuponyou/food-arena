#!/usr/bin/env node
/**
 * SH_SHAKE — THE ACCEPTANCE TEST FOR THE CAMERA-SHAKE PROXIMITY FALLOFF.
 *
 * Uri, on the deployed six-fighter build:
 *
 *   > "The VFX of screen shaking a bit due to explosions, while playing 6, causes the
 *   >  screen to shake a lot. We need to make sure that the shake only happens when the
 *   >  proximity is close."
 *
 * `sh_dist.mjs` is the DESIGN instrument — it models the kick amplitudes in Node and is
 * therefore a claim about a model. This file is the acceptance test: it plays real matches
 * through the real renderer and reads the shipped accumulators, so it is a claim about the
 * code.
 *
 * ## 🚨 WHY `feel.responses.shake` IS NOT THE METRIC, AND WHY THIS FILE EXISTS
 *
 * The falloff scales AMPLITUDES and skips no kick, so the kick COUNTER is unchanged by it
 * by design. A before/after on `responses.shake` therefore reads as "the fix did nothing"
 * — `AGENT-BRIEF` §4.6, "ask what the metric can express". `match.ts` was given two metre
 * accumulators for this:
 *
 *   `shakeRawSumM`  what the kick sites asked for, after `SHAKE_MAX_M`, BEFORE proximity.
 *                   Identically the pre-change build's delivered amplitude.
 *   `shakeSumM`     what actually reached `rig.shake()`.
 *
 * Their ratio is a **paired before/after inside ONE run on ONE event stream** — exact, not
 * an aggregate over two builds with two seeds, and structurally immune to the `rg_lib`
 * trap where a pinned A/B silently reads the working tree for both arms.
 *
 * ## THE ARMS, AND WHAT MAKES EACH ONE ABLE TO GO RED
 *
 *   1  CURVE (offline)      `shakeProximityScale` is 1.0 at and inside the full radius,
 *                           the floor at and beyond fade, monotone non-increasing, and
 *                           continuous at both joins. KNOWN-BAD: a flat `() => 1` and a
 *                           hard cut are both run through the same assertions and must
 *                           FAIL — otherwise "the curve is fine" only means the checks
 *                           are blind.
 *   2  RADII (offline)      Both radii are re-derived from `camera.ts` and checked to be
 *                           ordered and to bracket the arena. KNOWN-BAD: the fade radius
 *                           is also computed at a single aspect and must come out SMALLER
 *                           than the band max, which is the whole reason the shipped one
 *                           samples the band.
 *   3  FLOOR (offline)      The floor's own derivation: the smallest kick `match.ts` can
 *                           ask for (0.012 m) times the floor must land UNDER the rig's
 *                           own 0.002 m zero-cutoff, and the largest (`SHAKE_MAX_M`) must
 *                           land well OVER it. This is what "quiet, not silent" means as
 *                           a number rather than as an opinion.
 *   4  PLAY (browser)       N=2 and N=6 through the real renderer. N=2 is the CONTROL and
 *                           it is a real one: at two seats every weapon hit is inside
 *                           `MAX_THREAT_REACH` (165.2 wu) of one of the two fighters, so
 *                           it is inside the 199.22 wu full-strength disc and CANNOT be
 *                           attenuated. A falloff that moved N=2 much would be wrong.
 *                           VACUITY GUARDS FIRST: both arms must have produced kicks and
 *                           a non-zero raw sum, and the peak raw kick must have reached
 *                           `SHAKE_MAX_M`, or the ratios below describe nothing
 *                           (`CLAUDE.md` rule 6 — `[].every()` is `true`).
 *                           ORDERS: ratio(N=2) must exceed ratio(N=6). Two arms that
 *                           returned the same number would mean the tool is reading a
 *                           constant.
 *
 * ## USE
 *
 *   node tools/tmp/sh_shake.mjs --selftest                       # arms 1-3, no browser
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/sh_shake.mjs --play --url '{URL}'
 *   node tools/tmp/sh_shake.mjs --play --url $U --n 6            # one seat count only
 *
 * ⚠️ `--selftest` validates this file's LOGIC. It says nothing about whether the browser
 * arm is pointed at the build you think it is — that is what `--url` and a snapshot of a
 * DETACHED WORKTREE are for (`CLAUDE.md` rule 2).
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(k);

const CAMERA = String(arg('--camera', `${ROOT}/src/render/camera.ts`));
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const SPEED = Number(arg('--speed', 6));
const MIN_KICKS = Number(arg('--kicks', 300));
const WALL_MS = Number(arg('--wall', 300_000));
const W = Number(arg('--w', 1280));
const H = Number(arg('--h', 720));

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const CAST = ['hamburger', 'donut', 'taco', 'egg', 'sushi', 'lollipop'];

let fails = 0;
const ok = (cond, label, detail = '') => {
  if (!cond) fails++;
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? '   ' + detail : ''}`);
  return cond;
};

// ── ARMS 1-3: offline ────────────────────────────────────────────────────────
async function offline() {
  const cam = await import(pathToFileURL(CAMERA).href).catch(() => null);
  // 🚨 A PRE-CHANGE TREE HAS NONE OF THIS, AND POINTING THIS FILE AT ONE IS THE POINT:
  // arm 4's camera-displacement table reads `rig.shakeOffset`, which exists on every tree,
  // so the before side of a cross-tree comparison runs here. Skipping loudly rather than
  // throwing — and NEVER counting a skip as a pass, which is the `[].every()` shape.
  if (!cam?.shakeProximityScale || !cam?.SHAKE_PROXIMITY) {
    console.log(`\n══ ARMS 1-3 SKIPPED — no \`shakeProximityScale\` in ${CAMERA} ══`);
    console.log('  (a PRE-CHANGE tree. Arm 4\'s camera-displacement table still applies; its');
    console.log('   shipped-accumulator table will read zero, because those fields do not exist yet.)');
    return null;
  }
  const { shakeProximityScale, SHAKE_PROXIMITY, CameraRig, FAIR_PLAY, SUPPORTED_ASPECT, visibleGroundRadiusUnits } = cam;
  const rig = new CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' });
  const FULL = SHAKE_PROXIMITY.fullRadiusUnits;
  const FADE = rig.shakeFadeRadiusUnits();
  const FLOOR = SHAKE_PROXIMITY.floor;

  console.log(`\n══ ARM 1 — THE CURVE ══   full=${FULL.toFixed(2)} wu  fade=${FADE.toFixed(2)} wu  floor=${FLOOR}`);
  /** The assertions, as a function of a candidate curve, so a known-bad runs the SAME ones. */
  const check = (f) => {
    const ds = [];
    for (let d = 0; d <= FADE * 1.6; d += 1) ds.push(d);
    // 🚨 NON-EMPTY FIRST — every row below filters this ladder.
    if (ds.length === 0) return { empty: true };
    const vs = ds.map(f);
    const inside = ds.map((d, i) => [d, vs[i]]).filter(([d]) => d <= FULL);
    const beyond = ds.map((d, i) => [d, vs[i]]).filter(([d]) => d >= FADE);
    const between = ds.map((d, i) => [d, vs[i]]).filter(([d]) => d > FULL && d < FADE);
    let mono = true, maxStep = 0;
    for (let i = 1; i < vs.length; i++) {
      if (vs[i] > vs[i - 1] + 1e-12) mono = false;
      maxStep = Math.max(maxStep, Math.abs(vs[i] - vs[i - 1]));
    }
    return {
      empty: false,
      nInside: inside.length, nBeyond: beyond.length, nBetween: between.length,
      fullOne: inside.every(([, v]) => v === 1),
      floorAtFade: beyond.every(([, v]) => Math.abs(v - FLOOR) < 1e-12),
      strictlyBetween: between.every(([, v]) => v < 1 && v > FLOOR),
      mono, maxStep,
    };
  };
  const r = check((d) => shakeProximityScale(d, FADE));
  ok(!r.empty && r.nInside > 0 && r.nBetween > 0 && r.nBeyond > 0, 'ladder is non-empty in all three bands',
    `inside=${r.nInside} between=${r.nBetween} beyond=${r.nBeyond}`);
  ok(r.fullOne, 'scale is EXACTLY 1.0 at and inside the full radius (the local seat is untouched)');
  ok(r.floorAtFade, 'scale is EXACTLY the floor at and beyond the fade radius');
  ok(r.strictlyBetween, 'scale is strictly between floor and 1 in the transition band');
  ok(r.mono, 'scale is monotone non-increasing in distance');
  // C1-ish: a hard cut would show a step of (1 - floor) at one radius. 1 wu of travel must
  // never move the scale by more than a few percent, or the boundary POPS.
  ok(r.maxStep < 0.02, 'no step larger than 0.02 per world unit (a hard cut would step by 1-floor)',
    `maxStep=${r.maxStep.toFixed(5)}`);

  console.log('\n  KNOWN-BAD — the same assertions on curves that must FAIL:');
  const flat = check(() => 1);
  ok(!(flat.floorAtFade && flat.strictlyBetween), 'a FLAT `() => 1` is refused',
    `floorAtFade=${flat.floorAtFade} strictlyBetween=${flat.strictlyBetween}`);
  const cut = check((d) => (d <= FULL ? 1 : FLOOR));
  ok(cut.maxStep >= 1 - FLOOR - 1e-9, 'a HARD CUT at the full radius is refused by the step check',
    `maxStep=${cut.maxStep.toFixed(4)}`);
  ok(cut.strictlyBetween === false, 'a HARD CUT is also refused by the transition-band check');

  console.log('\n══ ARM 2 — THE RADII ══');
  ok(FULL === FAIR_PLAY.radiusUnits, 'full radius IS `FAIR_PLAY.radiusUnits`, not a literal', `${FULL}`);
  ok(FADE > FULL, 'fade radius is outside the guaranteed disc', `${FADE.toFixed(2)} > ${FULL.toFixed(2)}`);
  const gw = (a) => { const q = new CameraRig({ pitchDeg: 58, yawDeg: 0, frameMode: 'fair' }); q.setAspect(a); return q.groundWindow(); };
  const g169 = gw(16 / 9);
  ok(FADE > g169.farUnits && FADE > g169.halfWidthUnits,
    'fade radius exceeds both 16:9 ground reaches (it is the frame CORNER, the conservative bound)',
    `far=${g169.farUnits.toFixed(1)} halfW=${g169.halfWidthUnits.toFixed(1)}`);
  // KNOWN-BAD for the band sampling: one aspect is not the band.
  const oneAspect = visibleGroundRadiusUnits(16 / 9, 58, 34, FAIR_PLAY.radiusUnits);
  ok(oneAspect < FADE, 'a SINGLE-ASPECT fade radius is smaller than the band max — which is why the shipped one samples',
    `16:9 ${oneAspect.toFixed(2)} < band ${FADE.toFixed(2)}`);
  let sweepMax = 0, sweepAt = 0;
  for (let a = SUPPORTED_ASPECT.min; a <= SUPPORTED_ASPECT.max + 1e-9; a += 0.002) {
    const v = visibleGroundRadiusUnits(a, 58, 34, FAIR_PLAY.radiusUnits);
    if (v > sweepMax) { sweepMax = v; sweepAt = a; }
  }
  ok(Math.abs(sweepMax - FADE) < 0.05, 'the 32-step sample finds the same max as a 0.002-step sweep',
    `sweep ${sweepMax.toFixed(3)} @ aspect ${sweepAt.toFixed(3)} vs shipped ${FADE.toFixed(3)}`);

  console.log('\n══ ARM 3 — THE FLOOR IS DERIVED, NOT TASTED ══');
  const RIG_ZERO_M = 0.002;      // CameraRig.update: `if (this.shakeAmount < 0.002) …= 0`
  const SMALLEST_KICK_M = 0.012; // match.ts hit-landed clamp minimum
  const LOUDEST_KICK_M = 0.40;   // match.ts SHAKE_MAX_M
  ok(SMALLEST_KICK_M * FLOOR < RIG_ZERO_M,
    'the SMALLEST kick at max range falls under the rig\'s own zero cutoff (chip damage across the map is invisible)',
    `${(SMALLEST_KICK_M * FLOOR).toFixed(5)} m < ${RIG_ZERO_M} m`);
  ok(LOUDEST_KICK_M * FLOOR > RIG_ZERO_M * 10,
    'the LOUDEST kick at max range stays well above it (a six-way brawl still rumbles)',
    `${(LOUDEST_KICK_M * FLOOR).toFixed(4)} m = ${(LOUDEST_KICK_M * FLOOR / RIG_ZERO_M).toFixed(0)}x the cutoff`);
  ok(FLOOR < RIG_ZERO_M / SMALLEST_KICK_M,
    'the floor is under the exact boundary the derivation gives',
    `${FLOOR} < ${(RIG_ZERO_M / SMALLEST_KICK_M).toFixed(4)}`);
  return { FULL, FADE, FLOOR };
}

// ── ARM 4: the browser ───────────────────────────────────────────────────────
const READ = () => {
  const fd = window.__feelDebug ?? null;
  const f = window.__vfxDebugFighters ?? null;
  return {
    ready: !!fd && !!f?.slots,
    n: f?.slots?.length ?? 0,
    slots: f?.slots ?? null,
    kicks: fd?.responses?.shake ?? 0,
    sum: fd?.shakeSumM ?? null,
    rawSum: fd?.shakeRawSumM ?? null,
    peak: fd?.peakShakeM ?? null,
    peakRaw: fd?.peakShakeRawM ?? null,
    frames: fd?.frames ?? 0,
    cam: window.__shSamples ? { ...window.__shSamples } : null,
    phase: window.__matchDebug?.phase ?? null,
    ended: !!document.querySelector('[data-el="gameover"]')
      && document.querySelector('[data-el="gameover"]').style.display === 'flex',
  };
};

async function play(n) {
  const { chromium } = await import('playwright');
  const ids = CAST.slice(0, n);
  const browser = await chromium.launch({ args: LAUNCH });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not reload the page mid-run.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};',
  }));
  // ── THE CAMERA'S OWN DISPLACEMENT, SAMPLED PAGE-SIDE ────────────────────────
  // `shakeSumM`/`shakeRawSumM` are what the kick sites ASKED for. This is what the camera
  // actually DID with it: |shakeOffset| every rAF turn, in metres, straight off the rig.
  // It needs no new field, so it reads the same on a PRE-CHANGE tree — which makes it the
  // one number here that supports a cross-tree before/after as well as a paired one.
  // ⚠️ Installed with `addInitScript` rather than polled through `page.evaluate`:
  // `AGENT-BRIEF` §3, an evaluate hands the page a transient user activation it never
  // received, and one observer per frame beats one sample per 90 ms regardless.
  await page.addInitScript(() => {
    window.__shSamples = { n: 0, sum: 0, peak: 0, moving: 0 };
    const tick = () => {
      try {
        const st = (window.__stages || []).filter((x) => !x.disposed)[0];
        const off = st?.rig?.shakeOffset;
        if (off) {
          const m = Math.hypot(off.x, off.y, off.z);
          const a = window.__shSamples;
          a.n++; a.sum += m; if (m > a.peak) a.peak = m;
          // 0.002 m is `CameraRig.update`'s own zero cutoff: below it the rig discards the
          // shake, so this counts frames on which the camera is displaced AT ALL.
          if (m >= 0.002) a.moving++;
        }
      } catch { /* the stage is not up yet */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const url = `${BASE}/?fighters=${encodeURIComponent(ids.join(';'))}&pointerLock=0&simSpeed=${SPEED}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });

  const held = new Set();
  const KEY = { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' };
  let firing = false, last = null;
  while (Date.now() - t0 < WALL_MS) {
    let r; try { r = await page.evaluate(READ); } catch { break; }
    if (!r.ready) { await page.waitForTimeout(120); continue; }
    last = r;
    if (r.ended || (r.kicks >= MIN_KICKS && r.phase !== 'countdown')) break;
    // Drive slot 0 at the nearest living opponent and hold fire. Not a skilled player —
    // the point is to produce a REALISTIC event stream, not a benchmark.
    const me = r.slots[0];
    if (me?.alive) {
      let best = null, bd = Infinity;
      for (let i = 1; i < r.slots.length; i++) {
        const o = r.slots[i]; if (!o?.alive) continue;
        const d = Math.hypot(o.x - me.x, o.y - me.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        const dx = best.x - me.x, dy = best.y - me.y;
        const want = new Set();
        if (bd > 90) {
          if (dx < -20) want.add(KEY.left); if (dx > 20) want.add(KEY.right);
          if (dy < -20) want.add(KEY.up); if (dy > 20) want.add(KEY.down);
        }
        for (const k of held) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); held.delete(k); }
        for (const k of want) if (!held.has(k)) { await page.keyboard.down(k).catch(() => {}); held.add(k); }
        const mag = Math.hypot(dx, dy) || 1;
        await page.mouse.move(W / 2 + (dx / mag) * 220, H / 2 + (dy / mag) * 180).catch(() => {});
        if (!firing) { await page.mouse.down().catch(() => {}); firing = true; }
      }
    }
    await page.waitForTimeout(90);
  }
  for (const k of held) await page.keyboard.up(k).catch(() => {});
  if (firing) await page.mouse.up().catch(() => {});
  const fin = await page.evaluate(READ).catch(() => last);
  await browser.close();
  return { n, wallMs: Date.now() - t0, errors: errors.slice(0, 4), ...(fin ?? last ?? {}) };
}

async function main() {
  const radii = await offline();
  if (!has('--play')) {
    if (radii === null) { console.log('\nNOTHING WAS CHECKED — a pre-change tree with no --play.'); process.exit(2); }
    console.log(`\n${fails === 0 ? 'ALL OFFLINE ARMS PASS' : `${fails} OFFLINE FAILURE(S)`}`);
    process.exit(fails === 0 ? 0 : 1);
  }
  if (!BASE) { console.error('sh_shake: --play needs --url or PREVIEW_BASE'); process.exit(2); }

  const want = arg('--n', null);
  const seats = want ? [Number(want)] : [2, 6];
  const runs = [];
  for (const n of seats) { console.log(`\n── playing N=${n} … ──`); runs.push(await play(n)); }

  console.log('\n══ ARM 4 — THE SHIPPED ACCUMULATORS ══');
  console.log('  N  kicks   rawSum m   deliveredSum m   ratio    peakRaw m  peak m   frames  wall s');
  for (const r of runs) {
    console.log(`  ${r.n}  ${String(r.kicks).padStart(5)}  ${(r.rawSum ?? 0).toFixed(3).padStart(9)}  ${(r.sum ?? 0).toFixed(3).padStart(14)}  ${((r.sum ?? 0) / (r.rawSum || 1)).toFixed(4).padStart(7)}  ${(r.peakRaw ?? 0).toFixed(3).padStart(10)}  ${(r.peak ?? 0).toFixed(3).padStart(6)}  ${String(r.frames).padStart(6)}  ${(r.wallMs / 1000).toFixed(0).padStart(6)}`);
    if (r.errors?.length) console.log(`      page errors: ${r.errors.join(' | ')}`);
  }
  console.log('\n  camera displacement, |shakeOffset| sampled every rAF turn (works on a pre-change tree too):');
  console.log('  N   rAF turns   frames MOVING   share   mean m   peak m');
  for (const r of runs) {
    const c = r.cam;
    if (!c || !c.n) { console.log(`  ${r.n}   (no samples)`); continue; }
    console.log(`  ${r.n}  ${String(c.n).padStart(10)}  ${String(c.moving).padStart(14)}  ${(100 * c.moving / c.n).toFixed(1).padStart(5)}%  ${(c.sum / c.n).toFixed(5).padStart(7)}  ${c.peak.toFixed(4).padStart(7)}`);
  }

  if (radii === null) { console.log('\n(pre-change tree: no accumulator verdict, camera table above is the comparable half)'); process.exit(0); }

  // 🚨 VACUITY FIRST. Every verdict below divides by these.
  console.log('\n  vacuity guards:');
  for (const r of runs) {
    ok(r.kicks > 0, `N=${r.n}: the run produced kicks at all`, `${r.kicks}`);
    ok((r.rawSum ?? 0) > 0, `N=${r.n}: raw shake sum is non-zero`, `${(r.rawSum ?? 0).toFixed(3)} m`);
    ok(Math.abs((r.peakRaw ?? 0) - 0.40) < 1e-9, `N=${r.n}: the loudest kick reached SHAKE_MAX_M (so the peak row means something)`, `${(r.peakRaw ?? 0).toFixed(4)} m`);
    ok((r.errors?.length ?? 0) === 0, `N=${r.n}: no page errors`);
  }
  if (runs.length === 2 && fails === 0) {
    const [a, b] = runs;
    const ra = a.sum / a.rawSum, rb = b.sum / b.rawSum;
    console.log('\n  verdict:');
    ok(ra > 0.85, `N=2 is essentially unchanged (control)`, `delivered/raw = ${ra.toFixed(4)}`);
    ok(rb < 0.65, `N=6 is substantially reduced`, `delivered/raw = ${rb.toFixed(4)}`);
    ok(ra - rb > 0.2, `ORDERS: the two arms are not the same number`, `${ra.toFixed(4)} vs ${rb.toFixed(4)}`);
  }
  console.log(`\n${fails === 0 ? 'ALL ARMS PASS' : `${fails} FAILURE(S)`}`);
  process.exit(fails === 0 ? 0 : 1);
}

if (IS_MAIN) await main();
