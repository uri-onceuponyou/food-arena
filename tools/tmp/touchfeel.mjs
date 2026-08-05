#!/usr/bin/env node
/**
 * TOUCH FEEL — does the stick deliver what the thumb is expressing, and is every
 * place the game invites a thumb a place a thumb actually works?
 *
 * `tools/tmp/touchprobe.mjs` (46/46) proved the touch path EXISTS: a drag moves the
 * fighter, an aim stick sets `Fighter.facing`, a held stick fires. It never asked
 * whether the thing that arrives is the thing the thumb asked for. This does.
 *
 * ── THE ACCEPTANCE TEST, stated before anything was changed ──────────────────
 *   A touch player must be able to express any direction with the same fidelity a
 *   keyboard player gets, and every place the game invites a thumb must be a place a
 *   thumb actually works.
 *
 * Six batteries, in the order `docs/LESSONS.md` §5 ranks them (most likely to hide a
 * defect first):
 *
 *   M0  INSTRUMENT.   The harness really delivers touches, the module's claim decision
 *                     is observable (`defaultPrevented`), and the debug mirror moves on
 *                     a known input. Nothing below is believed until this passes.
 *   M1  DIRECTION.    36 stick bearings at full deflection, read off the INPUT -> SIM
 *                     mirror (`__matchDebug.moveX/moveY`), not off pixels. Bearing
 *                     error, 8-way-clamp detection, and whether full deflection reaches
 *                     the square boundary in every direction.
 *   M2  CURVE.        Deflection swept 0 -> past the rim in px. Dead zone as a fraction
 *                     of travel, the size of the discontinuity at its edge, whether the
 *                     top of the range is reachable, monotonicity.
 *   M3  RECENTRE.     Release must zero movement, and a re-plant must not inherit the
 *                     released stick's base.
 *   M4  INTERRUPTION. `touchcancel`, a second finger in an occupied zone, a finger that
 *                     outlives the one that owned the stick, and blur with a finger down.
 *   M5  HIT MAP.      Which element the browser hit-tests at every point of the two
 *                     thumb bands, at six viewports, judged by `ownsTarget()`'s own
 *                     predicate — a point that fails it is a point where no stick can
 *                     be planted, whatever it looks like. Then a REAL touch at each
 *                     resting-position hint, judged off the sim.
 *   M6  CONTINUITY.   Aim survives the things that happen around it — a weapon-slot tap,
 *                     an unclaimed finger.
 *
 * ── WHAT IS HARNESS-DEPENDENT, said out loud (LESSONS §13) ──────────────────
 *   * `blur` — Playwright's Chromium NEVER blurs a page (LESSONS §10). The blur test
 *     DISPATCHES the event; it proves the handler, not the browser.
 *   * `touchcancel` — CDP's `Input.dispatchTouchEvent` is not a finger. Every cancel
 *     assertion below is gated on the page-side journal actually recording a
 *     `touchcancel` with a non-empty `changedTouches`; if it does not, the result is
 *     reported as UNMEASURED rather than as a pass or a fail.
 *   * Coordinates are CSS px at `deviceScaleFactor: 1`, so a stick radius here is the
 *     same number a phone computes from the same CSS viewport.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/touchfeel.mjs --url {URL}
 *   node tools/tmp/touchfeel.mjs --url <u> --mode direction|curve|recentre|interrupt|hitmap|continuity
 */

import { chromium } from 'playwright';
// The real mapping, imported and compared against what the SIM actually received.
// Node strips the types; `touch.ts` has no imports, so this is the shipping function.
import { squareDeflection } from '../../src/game/touch.ts';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) argv[a.slice(2)] = true;
  else { argv[a.slice(2)] = n; i++; }
}
const BASE = String(argv.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const MODE = argv.mode ?? 'all';
const wants = (m) => MODE === 'all' || MODE === m;

const VP = { width: 844, height: 390 };

const results = [];
let failures = 0;
let unmeasured = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (ok === false) failures++;
  if (ok === null) unmeasured++;
}
/** A finding that is a NUMBER, not a verdict. Printed, never counted. */
const notes = [];
const note = (group, text) => notes.push(`${group.padEnd(10)} ${text}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const finger = (x, y, id = 1) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 12, radiusY: 12, force: 1 });
/**
 * `Input.dispatchTouchEvent` throws "Must send a TouchStart first to start a new touch"
 * whenever the emulator's point set is already empty — which is exactly what a
 * `touchCancel` leaves behind. Swallowing that ONE protocol error keeps a teardown from
 * masquerading as a failure; every other error still surfaces.
 */
async function touch(cdp, type, points) {
  try {
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    return true;
  } catch (e) {
    if (/Must send a TouchStart first/.test(String(e))) return false;
    throw e;
  }
}
const releaseAll = (cdp) => touch(cdp, 'touchEnd', []);

/**
 * The page-side journal. Installed AFTER the match is live and therefore AFTER
 * `touch.ts`'s own window listeners, so its bubble-phase handler runs last and
 * `defaultPrevented` reflects the module's decision rather than preceding it.
 */
async function installJournal(page) {
  await page.evaluate(() => {
    window.__tj = [];
    for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      window.addEventListener(t, (e) => {
        window.__tj.push({
          t,
          changed: e.changedTouches.length,
          active: e.touches.length,
          ids: [...e.changedTouches].map((c) => c.identifier),
          target: e.target instanceof Element ? e.target.tagName : null,
          dp: e.defaultPrevented,
        });
      });
    }
    // Compatibility mouse events synthesised from touch are the quiet way an aim gets
    // taken away from a finger — `input.ts`'s `onMouseMove` calls `touch.clearAim()`.
    window.__mouseSeen = { move: 0, down: 0, up: 0 };
    for (const t of ['mousemove', 'mousedown', 'mouseup']) {
      window.addEventListener(t, () => { window.__mouseSeen[t.slice(5)]++; }, true);
    }
  });
}
const journal = (page) => page.evaluate(() => { const j = window.__tj ?? []; window.__tj = []; return j; });

const dbgNow = (page) => page.evaluate(() => (window.__matchDebug ? { ...window.__matchDebug } : null));

/** Wait for the game loop to consume `n` more frames, then return its debug mirror. */
async function afterFrames(page, n = 3, timeoutMs = 5000) {
  const start = (await dbgNow(page))?.frames ?? 0;
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await dbgNow(page);
    if (last && last.frames >= start + n) return last;
    await sleep(35);
  }
  return last;
}

async function openMatch(browser, { viewport = VP, hasTouch = true, isMobile = true, query = '' } = {}) {
  const context = await browser.newContext({ viewport, hasTouch, isMobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    // `net::ERR_NETWORK_CHANGED` is Chromium reporting that the HOST's network interface
    // changed under it. Against a localhost dev server it cannot be a game fault, and it
    // took a clean run to a false FAIL once. Nothing else is filtered.
    if (m.type() === 'error' && !/ERR_NETWORK_CHANGED/.test(m.text())) errs.push(m.text());
  });
  await page.goto(`${BASE}/?player=hamburger&enemy=donut${query}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 120_000 });
  await sleep(200);
  const cdp = await context.newCDPSession(page);
  await installJournal(page);
  return { context, page, cdp, errs };
}

/** The stick radius the PAGE computes, read off the element the game itself sized. */
async function liveRadius(page, cdp, plant) {
  await touch(cdp, 'touchStart', [finger(plant.x, plant.y)]);
  await sleep(160);
  const r = await page.evaluate(() => {
    const el = document.querySelector('.tch-stick--move');
    const v = el?.style.getPropertyValue('--r') ?? '';
    return { fromDom: parseFloat(v), shown: el ? getComputedStyle(el).display : 'missing' };
  });
  await touch(cdp, 'touchEnd', []);
  await sleep(120);
  return r;
}

/** Plant, push by (dx,dy), read the SIM's commanded move, release. */
async function push(page, cdp, plant, dx, dy, id = 1) {
  await touch(cdp, 'touchStart', [finger(plant.x, plant.y, id)]);
  await sleep(25);
  if (dx !== 0 || dy !== 0) await touch(cdp, 'touchMove', [finger(plant.x + dx, plant.y + dy, id)]);
  const d = await afterFrames(page, 3);
  await touch(cdp, 'touchEnd', []);
  await afterFrames(page, 2);
  return d;
}

const bearing = (x, y) => (Math.atan2(y, x) * 180) / Math.PI;
const angErr = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });

  // ⚠️ ONE MATCH IS NOT ENOUGH, and finding that out cost a whole `--mode all` run.
  // `MATCH_DURATION_MS` is 45 s. The direction battery alone is 36 plants x ~5
  // SwiftShader frames, which lands right on that edge — so the first full run had the
  // match END partway through and reported `moveX = 0.000` for FOURTEEN checks across
  // four batteries. Every one of them read like a dead input path; all of them were a
  // finished match. `?simSpeed=0.02` is the usual freeze here and is wrong for this
  // probe, because it slows the COUNTDOWN too. So each battery gets a fresh match, and
  // `guardPhase()` below fails loudly rather than silently returning zeros if one ever
  // runs long again.
  let s = null;
  let page = null;
  let cdp = null;
  const allErrs = [];
  async function boot() {
    if (s) { allErrs.push(...s.errs); await s.context.close(); }
    s = await openMatch(browser);
    page = s.page;
    cdp = s.cdp;
    return s;
  }
  /** The match must still be live, or every number above it is a zero from a dead sim. */
  async function guardPhase(battery) {
    const d = await dbgNow(page);
    record(battery, 'the-match-was-still-live-for-every-check-above', d?.phase === 'playing',
      `phase=${d?.phase} after ${d?.frames} frames — anything else invalidates this battery`);
  }
  await boot();

  // A point in the movement zone that the browser actually hit-tests to the canvas.
  // Chosen by measurement, not by eye — the whole point of M5 is that this is not
  // obvious, so the batteries that depend on it must not assume it.
  const PLANT = { x: 211, y: 195 };
  let R = 0;
  const plantHit = await page.evaluate((p) => {
    const el = document.elementFromPoint(p.x, p.y);
    return { tag: el?.tagName ?? null, cls: el?.className?.toString?.().slice(0, 40) ?? '' };
  }, PLANT);

  // ── M0 · INSTRUMENT ───────────────────────────────────────────────────────
  {
    record('M0', 'plant-point-hit-tests-to-the-canvas', plantHit.tag === 'CANVAS',
      `${plantHit.tag} ${plantHit.cls}`);

    await journal(page);
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y)]);
    await sleep(60);
    await touch(cdp, 'touchMove', [finger(PLANT.x + 90, PLANT.y)]);
    await sleep(60);
    const jClaimed = await journal(page);
    await touch(cdp, 'touchEnd', []);
    await afterFrames(page, 2);
    const start = jClaimed.find((e) => e.t === 'touchstart');
    record('M0', 'harness-delivers-a-real-touchstart', !!start && start.changed === 1,
      JSON.stringify(jClaimed.slice(0, 3)));
    record('M0', 'a-claimed-touch-is-preventDefaulted', !!start && start.dp === true,
      `defaultPrevented=${start?.dp} — the module's claim decision is observable`);

    // Known input, known answer: the keyboard already has 81 assertions behind it.
    const k0 = await dbgNow(page);
    await page.keyboard.down('KeyD');
    const k1 = await afterFrames(page, 4);
    await page.keyboard.up('KeyD');
    await afterFrames(page, 3);
    const k2 = await dbgNow(page);
    record('M0', 'debug-mirror-moves-on-a-KNOWN-input',
      k0.moveX === 0 && k1.moveX === 1 && k2.moveX === 0,
      `moveX idle=${k0.moveX} KeyD=${k1.moveX} released=${k2.moveX}`);
  }

  const rad = await liveRadius(page, cdp, PLANT);
  R = rad.fromDom;
  record('M0', 'stick-radius-read-off-the-GAME', Number.isFinite(R) && R > 20,
    `--r = ${R}px at ${VP.width}x${VP.height} (short axis ${Math.min(VP.width, VP.height)})`);
  await guardPhase('M0');

  // ── M1 · DIRECTION FIDELITY ───────────────────────────────────────────────
  if (wants('direction')) {
    await boot();
    const STEP = 10;
    const samples = [];
    for (let deg = 0; deg < 360; deg += STEP) {
      const rad2 = (deg * Math.PI) / 180;
      // 1.7R is deliberately PAST the rim: `deflection()` follows the base, so this is
      // exactly the full-deflection case a thumb at the edge of its travel produces.
      const d = await push(page, cdp, PLANT, Math.cos(rad2) * R * 1.7, Math.sin(rad2) * R * 1.7);
      const exp = squareDeflection(Math.cos(rad2), Math.sin(rad2), { x: 0, y: 0 });
      samples.push({
        deg, x: d.moveX, y: d.moveY,
        err: angErr(bearing(d.moveX, d.moveY), deg),
        sq: Math.max(Math.abs(d.moveX), Math.abs(d.moveY)),
        dev: Math.max(Math.abs(d.moveX - exp.x), Math.abs(d.moveY - exp.y)),
      });
    }
    const worstErr = Math.max(...samples.map((v) => v.err));
    const worstSq = Math.min(...samples.map((v) => v.sq));
    const worstDev = Math.max(...samples.map((v) => v.dev));
    const distinct = new Set(samples.map((v) => `${v.x.toFixed(3)},${v.y.toFixed(3)}`)).size;

    record('M1', 'commanded-bearing-tracks-the-stick', worstErr < 1.5,
      `worst ${worstErr.toFixed(2)}deg over ${samples.length} bearings ` +
      `(worst at ${samples.find((v) => v.err === worstErr).deg}deg)`);
    record('M1', 'no-8-way-clamping', distinct === samples.length,
      `${distinct}/${samples.length} distinct commanded vectors — a stick that snapped to ` +
      `8 directions would score 8`);
    record('M1', 'full-deflection-reaches-the-SQUARE-in-every-direction', worstSq > 0.995,
      `min max(|x|,|y|) = ${worstSq.toFixed(4)} — 1.000 means a touch diagonal is worth ` +
      `exactly W+D, 0.707 would mean 29% slower`);
    record('M1', 'the-SIM-receives-squareDeflection-verbatim', worstDev < 0.01,
      `worst componentwise deviation from the shipping function ${worstDev.toFixed(4)}`);
    note('M1', `bearing errors: ${samples.map((v) => v.err.toFixed(2)).join(' ')}`);

    // ── The AIM stick's half of the same question ───────────────────────────
    // `touchprobe.mjs` checked sim facing at four cardinals and three quadrants. That
    // cannot see a dead sector or a coarse quantisation between them, which is exactly
    // what "the stick clamps to 8 directions" would look like.
    //
    // Asserted on MONOTONICITY and WINDING rather than on an angle-for-angle match,
    // deliberately: the aim path is screen-space push -> aim ring -> NDC -> raycast onto
    // the ground plane -> direction from the player, and under a 58-degree pitched
    // camera a 45-degree SCREEN angle is NOT a 45-degree WORLD angle. What must hold is
    // that the map is a bijection covering the whole circle — every direction reachable,
    // no two thumb angles collapsing onto one facing, no sector where the aim stops
    // responding. The four cardinals ARE exact by symmetry (camera yaw 0), so those are
    // asserted directly as the calibration point.
    await guardPhase('M1');
    await boot(); // 36 more plants does not fit in the same 45 s match
    const aimPlant = { x: Math.round(VP.width * 0.78), y: Math.round(VP.height * 0.5) };
    const aimSamples = [];
    let n = 0;
    for (let deg = 0; deg < 360; deg += STEP) {
      // A fresh match every 15 samples. Without it the sweep outlives the 45 s clock and
      // the tail of it reads a FROZEN facing — which presents as two adjacent thumb
      // angles giving one identical world facing, i.e. exactly the "dead sector" this
      // check exists to find. The watchdog caught it; the fix is here rather than a
      // looser assertion.
      if (n++ % 15 === 14) await boot();
      const rad2 = (deg * Math.PI) / 180;
      await touch(cdp, 'touchStart', [finger(aimPlant.x, aimPlant.y, 71)]);
      await sleep(25);
      await touch(cdp, 'touchMove',
        [finger(aimPlant.x + Math.cos(rad2) * R * 1.7, aimPlant.y + Math.sin(rad2) * R * 1.7, 71)]);
      const d = await afterFrames(page, 3);
      await touch(cdp, 'touchEnd', []);
      await afterFrames(page, 2);
      aimSamples.push({ deg, fx: d.facingX, fy: d.facingY, w: bearing(d.facingX, d.facingY) });
    }
    const aimDistinct = new Set(aimSamples.map((v) => `${v.fx.toFixed(4)},${v.fy.toFixed(4)}`)).size;
    // Unwrap the world bearings in stick order and require a single clean revolution.
    let wind = 0;
    let worstStep = 0;
    for (let i = 1; i <= aimSamples.length; i++) {
      const a = aimSamples[i - 1].w;
      const b = aimSamples[i % aimSamples.length].w;
      const step = ((b - a + 540) % 360) - 180;
      wind += step;
      worstStep = Math.max(worstStep, Math.abs(step));
      if (step <= 0) worstStep = 999; // a reversal or a stall — not a bijection
    }
    record('M1', 'AIM-covers-the-whole-circle-with-no-dead-sector',
      aimDistinct === aimSamples.length && Math.abs(Math.abs(wind) - 360) < 1 && worstStep < 90,
      `${aimDistinct}/${aimSamples.length} distinct world facings, total winding ` +
      `${wind.toFixed(1)}deg, largest single step ${worstStep === 999 ? 'REVERSED/STALLED' : worstStep.toFixed(1) + 'deg'} ` +
      `— a stick clamped to 8 directions would give 8 distinct facings and 45deg steps`);
    const card = [[0, 1, 0], [90, 0, 1], [180, -1, 0], [270, 0, -1]]
      .map(([deg, wx, wy]) => {
        const v = aimSamples.find((sv) => sv.deg === deg);
        return { deg, err: (Math.acos(Math.max(-1, Math.min(1, v.fx * wx + v.fy * wy))) * 180) / Math.PI };
      });
    record('M1', 'AIM-cardinals-hit-the-world-axis-exactly',
      card.every((c) => c.err < 1),
      card.map((c) => `${c.deg}deg->${c.err.toFixed(2)}deg`).join(' '));

    // ── What base-follow actually buys, measured as the property that matters ──
    // The module's header says reversal "is always the same 2R". The first version of
    // this check asserted literally 2R and measured 70 px against 2R = 118 px — and the
    // measurement was right while the assertion was wrong, which is worth writing down.
    // Aim is a DIRECTION: `applyAim` normalises the magnitude away, so the facing snaps
    // to due west the moment the deflection crosses the 10 px aim dead zone on the far
    // side, i.e. after R + deadzone = 69 px, not 2R. 2R is the cost of reversing the
    // DEFLECTION VECTOR, which is a different quantity and not the one a thumb feels.
    //
    // The property that IS load-bearing is CONSTANCY: with base-follow, reversal costs
    // the same no matter how far past the rim the thumb over-travelled. Without it, a
    // thumb that pushed 4R out would have to be dragged 4R back before the aim moved at
    // all — the "stuck stick" feel the base-follow exists to remove. So over-travel by
    // three very different amounts and require one number.
    {
      await guardPhase('M1');
      await boot();
      const costs = [];
      for (const over of [1.5, 2.5, 4]) {
        await touch(cdp, 'touchStart', [finger(aimPlant.x, aimPlant.y, 72)]);
        await touch(cdp, 'touchMove', [finger(aimPlant.x + R * over, aimPlant.y, 72)]);
        const east = await afterFrames(page, 3);
        let flipAt = null;
        for (let back = 10; back <= Math.round(R * (over + 2)); back += 5) {
          await touch(cdp, 'touchMove', [finger(aimPlant.x + R * over - back, aimPlant.y, 72)]);
          const d = await afterFrames(page, 3);
          if (d.facingX < -0.99) { flipAt = back; break; }
        }
        costs.push({ over, flipAt, east: east.facingX });
        await touch(cdp, 'touchEnd', []);
        await afterFrames(page, 2);
      }
      const spread = Math.max(...costs.map((c) => c.flipAt ?? 1e9)) - Math.min(...costs.map((c) => c.flipAt ?? 0));
      record('M1', 'reversal-costs-the-SAME-however-far-the-thumb-over-travelled',
        costs.every((c) => c.flipAt !== null) && spread <= 10,
        costs.map((c) => `${c.over}R out -> flip after ${c.flipAt}px`).join(', ') +
        ` (spread ${spread}px). Without base-follow the 4R case would cost ~3x the 1.5R one.`);
      note('M1', `aim reversal cost ${costs[0].flipAt}px = rim ${R}px + the 10px aim dead zone; ` +
        `2R (${2 * R}px) is the DEFLECTION reversal, which a direction-only aim never charges you for`);
    }
    await guardPhase('M1');
  }

  // ── M2 · RESPONSE CURVE ───────────────────────────────────────────────────
  if (wants('curve')) {
    await boot();
    const ds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55,
      Math.round(R) - 1, Math.round(R), Math.round(R) + 2, Math.round(R) + 20, Math.round(R) * 2];
    const curve = [];
    for (const d of ds) {
      const m = await push(page, cdp, PLANT, d, 0);
      curve.push({ d, x: +m.moveX.toFixed(4) });
    }
    const zeros = curve.filter((c) => c.x === 0).map((c) => c.d);
    const deadEdge = zeros.length ? Math.max(...zeros) : -1;
    const firstLive = curve.find((c) => c.x > 0);
    const satur = curve.find((c) => c.x >= 0.999);
    const monotone = curve.every((c, i) => i === 0 || c.x >= curve[i - 1].x - 1e-6);
    const top = Math.max(...curve.map((c) => c.x));

    record('M2', 'the-top-of-the-range-is-reachable', Math.abs(top - 1) < 1e-3,
      `max commanded |x| = ${top.toFixed(4)}`);
    record('M2', 'response-is-monotonic-in-travel', monotone,
      curve.map((c) => `${c.d}:${c.x}`).join(' '));
    record('M2', 'saturates-AT-the-rim-not-before', satur && Math.abs(satur.d - R) <= 3,
      `first |x|>=0.999 at ${satur ? satur.d : 'never'}px against a ${R}px rim — ` +
      `saturating early would throw away the last of the travel`);
    record('M2', 'dead-zone-under-12%-of-travel', deadEdge / R < 0.12,
      `dead to ${deadEdge}px = ${((deadEdge / R) * 100).toFixed(1)}% of the ${R}px rim`);
    record('M2', 'the-step-out-of-the-dead-zone-is-small', firstLive && firstLive.x <= 0.12,
      `first live command is ${firstLive ? firstLive.x : 'n/a'} — the dead zone is NOT ` +
      `re-normalised, so this is the slowest walk a touch player can ask for`);
    note('M2', `curve px:command  ${curve.map((c) => `${c.d}:${c.x}`).join('  ')}`);
    await guardPhase('M2');
  }

  // ── M3 · RECENTRE ─────────────────────────────────────────────────────────
  if (wants('recentre')) {
    await boot();
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y)]);
    const held = await afterFrames(page, 3);
    await touch(cdp, 'touchEnd', []);
    const rel = await afterFrames(page, 3);
    record('M3', 'release-zeroes-movement-exactly',
      held.moveX > 0.9 && rel.moveX === 0 && rel.moveY === 0,
      `held ${held.moveX.toFixed(3)} -> released (${rel.moveX}, ${rel.moveY})`);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('.tch-stick')].map((el) => getComputedStyle(el).display));
    record('M3', 'released-sticks-stop-being-drawn', hidden.every((d) => d === 'none'),
      hidden.join(','));

    // A re-plant must not inherit the released stick's base. Plant 200px away from the
    // last finger position with NO drag: any residual base would command movement.
    const re = await push(page, cdp, { x: PLANT.x - 60, y: PLANT.y + 60 }, 0, 0);
    record('M3', 're-plant-does-not-inherit-the-old-base', re.moveX === 0 && re.moveY === 0,
      `(${re.moveX}, ${re.moveY}) on a fresh plant 85px from the last finger position`);

    // And the aim stick's opposite contract: direction SURVIVES the lift by design.
    await touch(cdp, 'touchStart', [finger(650, 250, 3)]);
    await touch(cdp, 'touchMove', [finger(650 + R * 1.7, 250, 3)]);
    const aimHeld = await afterFrames(page, 3);
    await touch(cdp, 'touchEnd', []);
    const aimRel = await afterFrames(page, 3);
    record('M3', 'aim-direction-survives-the-lift-but-FIRING-stops',
      aimHeld.attack === true && aimRel.attack === false
      && Math.abs(aimRel.facingX - aimHeld.facingX) < 0.02,
      `attack ${aimHeld.attack}->${aimRel.attack}; facing ` +
      `(${aimHeld.facingX.toFixed(3)},${aimHeld.facingY.toFixed(3)}) -> ` +
      `(${aimRel.facingX.toFixed(3)},${aimRel.facingY.toFixed(3)})`);
    await guardPhase('M3');
  }

  // ── M4 · INTERRUPTION ─────────────────────────────────────────────────────
  if (wants('interrupt')) {
    await boot();
    // (a) touchcancel mid-drag, on BOTH sticks at once.
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 1)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y, 1)]);
    await touch(cdp, 'touchStart', [finger(PLANT.x + R * 1.7, PLANT.y, 1), finger(650, 250, 2)]);
    const both = await afterFrames(page, 3);
    await journal(page);
    await touch(cdp, 'touchCancel', []);
    const cancelled = await afterFrames(page, 3);
    const jc = await journal(page);
    const cancelSeen = jc.find((e) => e.t === 'touchcancel');
    const cancelDelivered = !!cancelSeen && cancelSeen.changed > 0;
    if (!cancelDelivered) {
      record('M4', 'touchcancel-clears-both-sticks', null,
        `UNMEASURED — the harness delivered ${JSON.stringify(jc)}; a real finger's cancel ` +
        `carries changedTouches. Falling back to a DOM-level dispatch below.`);
    } else {
      record('M4', 'touchcancel-clears-both-sticks',
        both.moveX > 0.9 && both.attack === true
        && cancelled.moveX === 0 && cancelled.moveY === 0 && cancelled.attack === false,
        `held (${both.moveX.toFixed(2)}, attack=${both.attack}) -> cancelled ` +
        `(${cancelled.moveX}, attack=${cancelled.attack}); journal ${JSON.stringify(jc.map((e) => `${e.t}/${e.changed}`))}`);
    }
    await releaseAll(cdp);
    await afterFrames(page, 2);

    // The same question at the DOM boundary, which is what a real phone raises. This
    // proves the HANDLER; the browser half is the harness's, not ours.
    {
      await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 7)]);
      await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y, 7)]);
      const pre = await afterFrames(page, 3);
      const dispatched = await page.evaluate(() => {
        const canvas = document.querySelector('#game canvas');
        // Identify the live touch by reading what the module was told, not by guessing:
        // the id we planted is the only one down.
        const mk = (id) => new Touch({ identifier: id, target: canvas, clientX: 0, clientY: 0 });
        let ok = false;
        for (const id of [7]) {
          const ev = new TouchEvent('touchcancel', {
            bubbles: true, cancelable: true,
            changedTouches: [mk(id)], touches: [], targetTouches: [],
          });
          ok = window.dispatchEvent(ev);
        }
        return ok;
      });
      const post = await afterFrames(page, 3);
      record('M4', 'a-DOM-touchcancel-clears-the-stick',
        pre.moveX > 0.9 && post.moveX === 0 && post.moveY === 0,
        `held ${pre.moveX.toFixed(2)} -> ${post.moveX} after a synthesised touchcancel ` +
        `(dispatch returned ${dispatched}) — HANDLER-level, the browser half is the harness's`);
      await touch(cdp, 'touchEnd', []);
      await afterFrames(page, 2);
    }

    // (b) A second finger in an ALREADY-OCCUPIED zone. Ignored is correct. What happens
    //     when the finger that owns the stick lifts and the second one is still down is
    //     the question nobody has asked.
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 11)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y, 11)]);
    const owned = await afterFrames(page, 3);
    await touch(cdp, 'touchStart', [finger(PLANT.x + R * 1.7, PLANT.y, 11), finger(PLANT.x - 40, PLANT.y + 60, 12)]);
    const withSecond = await afterFrames(page, 3);
    record('M4', 'a-second-finger-in-an-occupied-zone-is-ignored',
      Math.abs(withSecond.moveX - owned.moveX) < 0.02 && Math.abs(withSecond.moveY - owned.moveY) < 0.02,
      `(${owned.moveX.toFixed(3)},${owned.moveY.toFixed(3)}) -> ` +
      `(${withSecond.moveX.toFixed(3)},${withSecond.moveY.toFixed(3)})`);

    // Lift ONLY the owner. The other finger is still on the glass, in the movement zone.
    //
    // The survivor is dragged NORTH while the owner was pushing EAST, deliberately: a
    // same-direction drag cannot tell "the survivor re-acquired the stick" from "the
    // owner's lift was never processed and the stick is STUCK at full east". Those are
    // opposite defects and the first version of this check confused them.
    //
    // ⚠️ HARNESS FACT, learned the hard way: `Input.dispatchTouchEvent`'s `touchPoints`
    // for `touchEnd` are the points being RELEASED, not the ones that remain. The first
    // version of this block passed `[secondFinger]` meaning "12 is what's left" and
    // therefore lifted 12 — then read the owner's still-held (1,0) and reported the game
    // stuck. The page-side journal (`ids[12]`) is what caught it. Verified below by
    // asserting the journal names the OWNER's identifier.
    await journal(page);
    await touch(cdp, 'touchEnd', [finger(PLANT.x + R * 1.7, PLANT.y, 11)]);
    const afterOwnerLift = await afterFrames(page, 3);
    const jl = await journal(page);
    record('M4', 'the-harness-really-lifted-the-OWNER',
      jl.some((e) => e.t === 'touchend' && e.ids.includes(11) && e.active === 1),
      `journal ${JSON.stringify(jl.map((e) => `${e.t}/ch${e.changed}/act${e.active}/ids${JSON.stringify(e.ids)}`))}`);
    record('M4', 'lifting-the-stick-owner-RELEASES-the-stick',
      afterOwnerLift.moveX === 0 && afterOwnerLift.moveY === 0,
      `move (${owned.moveX.toFixed(3)},${owned.moveY.toFixed(3)}) -> ` +
      `(${afterOwnerLift.moveX},${afterOwnerLift.moveY}) with one finger still down; ` +
      `journal ${JSON.stringify(jl.map((e) => `${e.t}/ch${e.changed}/act${e.active}/ids${JSON.stringify(e.ids)}`))}`);
    await touch(cdp, 'touchMove', [finger(PLANT.x - 40, PLANT.y + 60 - R * 1.7, 12)]);
    const survivorDrag = await afterFrames(page, 4);
    record('M4', 'a-finger-that-outlives-the-stick-owner-still-drives-the-stick',
      survivorDrag.moveY < -0.5 && Math.abs(survivorDrag.moveX) < 0.3,
      `the surviving finger was dragged NORTH to full deflection and the sim received ` +
      `(${survivorDrag.moveX.toFixed(3)},${survivorDrag.moveY.toFixed(3)}) — ` +
      `(0,-1) means the stick re-acquired it, (0,0) means a finger on the glass drives nothing`);
    await touch(cdp, 'touchCancel', []);
    await releaseAll(cdp);
    await afterFrames(page, 2);

    // (c) blur with a finger down. DISPATCHED — Playwright never blurs (LESSONS §10).
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 21)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y, 21)]);
    const preBlur = await afterFrames(page, 3);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const postBlur = await afterFrames(page, 3);
    record('M4', 'blur-with-a-finger-down-releases-the-stick',
      preBlur.moveX > 0.9 && postBlur.moveX === 0,
      `${preBlur.moveX.toFixed(2)} -> ${postBlur.moveX} — DISPATCHED, not provoked; ` +
      `Playwright's Chromium never blurs`);
    await touch(cdp, 'touchEnd', []);
    await afterFrames(page, 2);

    // (d) The interruption a PHONE actually produces more often than blur: the page
    //     being hidden by the app switcher, a call or the notification shade.
    //
    //     ⚠️ HARNESS-BOUND, and doubly so. Playwright's Chromium never blurs
    //     (LESSONS §10) and nothing available here puts a page into `hidden` either —
    //     so `document.visibilityState` is overridden and the event dispatched. This
    //     proves the HANDLER is wired; the browser half is stated, not measured.
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 31)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R * 1.7, PLANT.y, 31)]);
    const preHide = await afterFrames(page, 3);
    await page.evaluate(() => {
      window.__realVis = 0;
      document.addEventListener('visibilitychange', () => { window.__realVis++; }, { once: true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const postHide = await afterFrames(page, 3);
    await page.evaluate(() => { delete document.visibilityState; });
    record('M4', 'a-hidden-page-releases-the-stick',
      preHide.moveX > 0.9 && postHide.moveX === 0,
      `move ${preHide.moveX.toFixed(2)} -> ${postHide.moveX} — HANDLER-level; ` +
      `visibilityState was OVERRIDDEN because nothing in this harness can hide a page`);
    await touch(cdp, 'touchEnd', []);
    await afterFrames(page, 2);

    // (e) The aim stick's half of the hand-over: firing must resume for a finger that
    //     is still down when the finger that owned the stick lifts.
    await touch(cdp, 'touchStart', [finger(650, 250, 61)]);
    await touch(cdp, 'touchMove', [finger(650 + R * 1.7, 250, 61)]);
    await touch(cdp, 'touchStart', [finger(650 + R * 1.7, 250, 61), finger(700, 300, 62)]);
    const aimTwo = await afterFrames(page, 3);
    await touch(cdp, 'touchEnd', [finger(650 + R * 1.7, 250, 61)]);
    const aimHandover = await afterFrames(page, 4);
    record('M4', 'the-aim-stick-hands-over-too-so-FIRING-does-not-die',
      aimTwo.attack === true && aimHandover.attack === true,
      `attack with both down=${aimTwo.attack}, after the owner lifted=${aimHandover.attack} ` +
      `with a finger still in the fire zone`);
    await touch(cdp, 'touchCancel', []);
    await releaseAll(cdp);
    await afterFrames(page, 2);
    await guardPhase('M4');
  }

  // ── M6 · CONTINUITY ───────────────────────────────────────────────────────
  if (wants('continuity')) {
    await boot();
    // Aim east, lift, then tap a weapon slot. A compatibility mouse event synthesised
    // from that tap would reach `input.ts`'s `onMouseMove` and silently clear the aim.
    await touch(cdp, 'touchStart', [finger(650, 250, 41)]);
    await touch(cdp, 'touchMove', [finger(650 + R * 1.7, 250, 41)]);
    await afterFrames(page, 3);
    await touch(cdp, 'touchEnd', []);
    const aimed = await afterFrames(page, 3);
    const slot = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.hud-weapon-slot')];
      if (els.length < 2) return null;
      const r = els[1].getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, pe: getComputedStyle(els[1]).pointerEvents, n: els.length };
    });
    if (!slot) {
      record('M6', 'aim-survives-a-weapon-slot-tap', null, 'UNMEASURED — no weapon slots found');
    } else {
      await page.evaluate(() => { window.__mouseSeen = { move: 0, down: 0, up: 0 }; });
      await touch(cdp, 'touchStart', [finger(slot.cx, slot.cy, 42)]);
      await touch(cdp, 'touchEnd', []);
      const afterTap = await afterFrames(page, 4);
      const mouse = await page.evaluate(() => window.__mouseSeen);
      record('M6', 'aim-survives-a-weapon-slot-tap',
        Math.abs(afterTap.facingX - aimed.facingX) < 0.02
        && Math.abs(afterTap.facingY - aimed.facingY) < 0.02,
        `facing (${aimed.facingX.toFixed(3)},${aimed.facingY.toFixed(3)}) -> ` +
        `(${afterTap.facingX.toFixed(3)},${afterTap.facingY.toFixed(3)}); ` +
        `slot pointer-events=${slot.pe}; compat mouse events from the tap: ${JSON.stringify(mouse)}`);
      record('M6', 'the-weapon-slot-tap-actually-selected-the-slot', afterTap.selectedWeapon === 1,
        `selectedWeapon = ${afterTap.selectedWeapon} of ${slot.n}`);

      // The regression guard on a WIDENED `ownsTarget`: a touch that lands on a real
      // control must still belong to that control — not preventDefaulted, no stick
      // planted, no movement. This is the one thing loosening the target test could
      // plausibly break, so it is asserted rather than reasoned about.
      await journal(page);
      await touch(cdp, 'touchStart', [finger(slot.cx, slot.cy, 45)]);
      await sleep(120);
      const jSlot = await journal(page);
      const slotState = await page.evaluate(() => ({
        move: getComputedStyle(document.querySelector('.tch-stick--move')).display,
        aim: getComputedStyle(document.querySelector('.tch-stick--aim')).display,
      }));
      const dSlot = await afterFrames(page, 3);
      await touch(cdp, 'touchEnd', []);
      await afterFrames(page, 2);
      const st = jSlot.find((e) => e.t === 'touchstart');
      record('M6', 'a-touch-on-a-REAL-CONTROL-is-not-claimed-by-a-stick',
        !!st && st.dp === false && st.target !== 'CANVAS'
        && slotState.move === 'none' && slotState.aim === 'none'
        && dSlot.moveX === 0 && dSlot.moveY === 0,
        `touchstart target=${st?.target} defaultPrevented=${st?.dp}; sticks ` +
        `move=${slotState.move}/aim=${slotState.aim}; move=(${dSlot.moveX},${dSlot.moveY})`);
    }

    // An UNCLAIMED finger on the game surface (the zone is already occupied). If the
    // browser synthesises compatibility mouse events for it, the aim is taken away.
    await touch(cdp, 'touchStart', [finger(PLANT.x, PLANT.y, 43)]);
    await touch(cdp, 'touchMove', [finger(PLANT.x + R, PLANT.y, 43)]);
    await afterFrames(page, 2);
    const beforeStray = await dbgNow(page);
    await page.evaluate(() => { window.__mouseSeen = { move: 0, down: 0, up: 0 }; });
    await touch(cdp, 'touchStart', [finger(PLANT.x + R, PLANT.y, 43), finger(120, 120, 44)]);
    await touch(cdp, 'touchEnd', [finger(PLANT.x + R, PLANT.y, 43)]);
    const afterStray = await afterFrames(page, 4);
    const strayMouse = await page.evaluate(() => window.__mouseSeen);
    record('M6', 'an-unclaimed-finger-does-not-hijack-the-aim',
      Math.abs(afterStray.facingX - beforeStray.facingX) < 0.02
      && Math.abs(afterStray.facingY - beforeStray.facingY) < 0.02,
      `facing (${beforeStray.facingX.toFixed(3)},${beforeStray.facingY.toFixed(3)}) -> ` +
      `(${afterStray.facingX.toFixed(3)},${afterStray.facingY.toFixed(3)}); ` +
      `compat mouse from the unclaimed touch: ${JSON.stringify(strayMouse)}`);
    await touch(cdp, 'touchEnd', []);
    await afterFrames(page, 2);
    await guardPhase('M6');
  }

  allErrs.push(...s.errs);
  record('M0', 'no-console-errors', allErrs.length === 0, allErrs.slice(0, 2).join(' | '));
  await s.context.close();

  // ── M5 · HIT MAP ──────────────────────────────────────────────────────────
  if (wants('hitmap')) {
    const VIEWPORTS = [
      { name: 'phone-land-844x390', w: 844, h: 390 },
      { name: 'phone-land-932x430', w: 932, h: 430 },
      { name: 'small-land-667x375', w: 667, h: 375 },
      { name: 'tall-land-740x360', w: 740, h: 360 },
      { name: 'tablet-1024x768', w: 1024, h: 768 },
      { name: 'portrait-390x844', w: 390, h: 844 },
    ];
    for (const v of VIEWPORTS) {
      const t = await openMatch(browser, { viewport: { width: v.w, height: v.h } });

      // ⚠️ READ THE HINTS FIRST. `.tch-hint.is-used` is set the moment that stick is
      // touched once, so ANY probe finger placed before this read deletes the very
      // element it is about to measure — the first version of this battery planted its
      // `fa-touch` finger in the movement zone and then reported the move hint at
      // (0,0) with zero size, which then "passed" a plant test at the top-left corner.
      const hints = await t.page.evaluate(() => {
        const g = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (r.width === 0) return null;
          return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width) };
        };
        return { move: g('.tch-hint--move .tch-hint-ring'), aim: g('.tch-hint--aim .tch-hint-ring') };
      });

      // The canvas rect, because it is not the viewport. `stage.ts` letterboxes any
      // aspect outside SUPPORTED_ASPECT, and every pixel outside the canvas rect fails
      // `ownsTarget()` — so it is a place a thumb cannot plant, whatever it looks like.
      const geom = await t.page.evaluate(() => {
        const c = document.querySelector('#game canvas');
        const r = c.getBoundingClientRect();
        return {
          canvas: { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
          vw: innerWidth, vh: innerHeight,
        };
      });

      // `fa-touch` needs a real finger, and it must be placed somewhere that cannot
      // consume a hint: the centre of the canvas.
      const centre = { x: Math.round(geom.canvas.l + geom.canvas.w / 2), y: Math.round(geom.canvas.t + geom.canvas.h / 2) };
      await touch(t.cdp, 'touchStart', [finger(centre.x, centre.y, 1)]);
      await touch(t.cdp, 'touchEnd', []);
      await afterFrames(t.page, 2);
      const faTouch = await t.page.evaluate(() => document.documentElement.classList.contains('fa-touch'));

      // The predicate is `ownsTarget()`'s, mirrored — a point is plantable when the
      // topmost hit-test target is the canvas, inside it, or CONTAINS it. Hard-coding
      // "must be the canvas" instead was this battery's own bug: it kept failing
      // portrait after the fix landed, while the behavioural check three lines down
      // (drag from the hint and read the sim) said the stick worked. When a geometric
      // predicate and a behavioural one disagree, the predicate is the suspect.
      const map = await t.page.evaluate((vv) => {
        const canvas = document.querySelector('#game canvas');
        const cv = canvas.getBoundingClientRect();
        const plantable = (el) => !!el && (el === canvas || canvas.contains(el) || el.contains(canvas));
        const bandTop = Math.round(vv.h * 0.62);
        const cols = 40;
        const rows = 12;
        const out = { total: 0, hud: 0, letterbox: 0, byEl: {}, hudMove: 0, hudAim: 0, lbMove: 0, lbAim: 0 };
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = Math.round(((c + 0.5) / cols) * vv.w);
            const y = Math.round(bandTop + ((r + 0.5) / rows) * (vv.h - bandTop));
            const el = document.elementFromPoint(x, y);
            out.total++;
            const move = x < vv.w * 0.5;
            // Outside the RENDERED image, but still game surface — the letterbox. A
            // measurement, not a failure: DECISIONS §14 owns how big it is.
            if (x < cv.left || x > cv.right || y < cv.top || y > cv.bottom) {
              out.letterbox++; if (move) out.lbMove++; else out.lbAim++;
            }
            if (plantable(el)) continue;
            out.hud++; if (move) out.hudMove++; else out.hudAim++;
            const key = el ? `${el.tagName}.${el.className?.toString?.().split(' ')[0] ?? ''}` : 'null';
            out.byEl[key] = (out.byEl[key] ?? 0) + 1;
          }
        }
        return out;
      }, v);

      const half = map.total / 2;
      const per = (n) => `${((n / half) * 100).toFixed(1)}%`;

      record('hitmap', `${v.name}·fa-touch-set`, faTouch === true, `${faTouch}`);
      record('hitmap', `${v.name}·the-whole-thumb-band-is-plantable`,
        map.hudMove / half < 0.25 && map.hudAim / half < 0.25,
        `move ${per(map.hudMove)} / aim ${per(map.hudAim)} of the bottom 38% of the frame is ` +
        `claimed by a real control; by element ${JSON.stringify(map.byEl)}`);
      note('hitmap', `${v.name} canvas ${geom.canvas.w}x${geom.canvas.h} in a ${geom.vw}x${geom.vh} ` +
        `viewport; ${per(map.lbMove)}/${per(map.lbAim)} of the move/aim thumb bands is letterbox ` +
        `(game surface, outside the rendered image — DECISIONS §14 owns how big that is)`);

      // The hint says "plant here". Prove that a real touch there DOES plant — judged
      // off the SIM, not off a rAF-painted DOM node: reading `.tch-stick` display after
      // a fixed sleep failed at two viewports purely because SwiftShader had not yet
      // run a frame, which is a harness race wearing a defect's clothes.
      for (const [which, h] of Object.entries(hints)) {
        if (!h) { record('hitmap', `${v.name}·${which}-hint-visible`, null, 'UNMEASURED — hint has no box'); continue; }
        const ringClear = await t.page.evaluate((hh) => {
          const canvas = document.querySelector('#game canvas');
          const plantable = (el) => !!el && (el === canvas || canvas.contains(el) || el.contains(canvas));
          const pts = [[hh.cx, hh.cy]];
          for (let a = 0; a < 8; a++) {
            const th = (a / 8) * Math.PI * 2;
            pts.push([Math.round(hh.cx + Math.cos(th) * hh.w * 0.5), Math.round(hh.cy + Math.sin(th) * hh.w * 0.5)]);
          }
          const bad = [];
          for (const [x, y] of pts) {
            const el = document.elementFromPoint(x, y);
            if (plantable(el)) continue;
            bad.push(`${x},${y}=${el ? el.tagName + '.' + (el.className?.toString?.().split(' ')[0] ?? '') : 'null'}`);
          }
          return bad;
        }, h);
        record('hitmap', `${v.name}·${which}-hint-ring-is-plantable`, ringClear.length === 0,
          ringClear.length ? ringClear.join(' ') : `ring at (${h.cx},${h.cy}) d=${h.w} entirely on the game surface`);

        const id = which === 'move' ? 51 : 52;
        const rr = Math.max(44, Math.min(78, Math.min(v.w, v.h) * 0.15));
        // Drag toward the frame centre so the push stays on screen at every viewport.
        const sx = Math.sign(v.w / 2 - h.cx) || 1;
        await touch(t.cdp, 'touchStart', [finger(h.cx, h.cy, id)]);
        await touch(t.cdp, 'touchMove', [finger(h.cx + sx * rr * 1.7, h.cy, id)]);
        const d = await afterFrames(t.page, 4);
        await touch(t.cdp, 'touchEnd', []);
        await afterFrames(t.page, 2);
        const drove = which === 'move'
          ? Math.abs(d.moveX) > 0.9
          : d.attack === true;
        record('hitmap', `${v.name}·${which}-hint-centre-really-drives-the-sim`, drove,
          which === 'move'
            ? `a full-deflection drag from the hint centre gave the sim moveX=${d.moveX.toFixed(3)}`
            : `planting at the hint centre gave the sim attack=${d.attack}`);
      }
      await t.context.close();
    }
  }

  await browser.close();

  const pad = (x, n) => String(x).padEnd(n);
  console.log('');
  for (const r of results) {
    const tag = r.ok === null ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
    console.log(`${tag}  ${pad(r.group, 8)} ${pad(r.check, 56)} ${r.detail}`);
  }
  if (notes.length) {
    console.log('\n── measurements (not verdicts) ──');
    for (const n of notes) console.log(`      ${n}`);
  }
  const passed = results.length - failures - unmeasured;
  console.log(`\n${passed}/${results.length - unmeasured} checks passed` +
    (unmeasured ? `, ${unmeasured} UNMEASURED` : ''));
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
