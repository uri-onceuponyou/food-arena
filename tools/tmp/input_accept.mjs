#!/usr/bin/env node
/**
 * Acceptance test for DESKTOP INPUT — keyboard movement, mouse aim, firing.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `docs/LESSONS.md` §10: the two most valuable bug reports on this project came from
 * Uri simply playing it — **clicks not firing**, and **the character not facing the
 * cursor**. Both were invisible to `tsc`, to the sim assertions and to every
 * screenshot. Then in 2026-08 a third report of the same shape arrived ("WASD does
 * not move the player"), and there was still nothing that could answer it.
 *
 * The touch pillar does not have this problem: it is proven by 46/46 real CDP touch
 * events read off fighter state. This is that pattern, mirrored for the desktop
 * backend. Everything here is a REAL CDP event through the browser's own hit testing
 * and dispatch, and every assertion is read off SIM STATE (`window.__matchDebug`,
 * `window.__vfxDebugFighters`) — never off a screenshot, and never off the DOM that
 * drew it.
 *
 * ── What it covers, and why each one ────────────────────────────────────────
 *  1. THE SHIPPED PATH.  boot -> opening -> home -> character select -> Fight!, every
 *     step a real click. The 2026-08 report only ever tested `/?player=&enemy=`, and
 *     the shortcut route is not what a player takes.
 *  2. THE DIRECT ROUTE.  `/?player=&enemy=` — because every probe in `tools/` uses it,
 *     so if the two ever diverge, every probe in the repo is measuring a different
 *     game from the one that ships.
 *  3. BOTH KEY SETS.  `MOVE_KEYS` maps WASD and the arrows separately and matches on
 *     `e.code`. A layout-dependent lookup would work for one set and not the other,
 *     so both are driven, on all four axes, independently.
 *  4. THE INPUT -> SIM EDGE, SEPARATELY FROM THE RESULT.  `moveX/moveY` is asserted
 *     as well as displacement. That is the split the 2026-08 report could not make:
 *     input reached `MatchInput.move` perfectly and the SIM refused to move, because
 *     `?px=850&py=500` had teleported the fighter inside a CoverBox and `tryMove` has
 *     no depenetration. A test that only measured position would have called that
 *     "keyboard broken" too.
 *  5. RELEASE AND BLUR.  A key that never clears walks the fighter into a wall for the
 *     rest of the match, and it looks like nothing at all in a screenshot.
 *  6. AIM AND FIRE.  Uri's two original reports, asserted directly: facing must follow
 *     the cursor across the player, and a real mousedown on the canvas must produce a
 *     cast. Plus the mechanism behind them — `#screens`/`.hud-root` must leave the
 *     canvas as the top hit-test target at frame centre (`docs/LESSONS.md` §12).
 *  7. THE POINTER-LOCK BOUNDARY.  Playwright's Chromium refuses `requestPointerLock()`
 *     unconditionally (`docs/LESSONS.md` §10), so the captured cursor model can never
 *     be tested here for real. `?pointerLock=sim` runs the whole state machine with
 *     that one call stubbed, which is as far as any harness in this repo can go — so
 *     this asserts input works up to that boundary AND asserts the boundary is still
 *     where we think it is, rather than leaving it as folklore.
 *  8. THE QA FOOTGUN.  `?px=/?py=` inside cover must announce itself through
 *     `__matchDebug.qaSpawnInsideCover`. This is the check that turns the next
 *     "WASD is dead" report into a one-line answer.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   PREVIEW_BASE=<snapshot-url> node tools/tmp/input_accept.mjs [--quiet]
 *   node tools/tmp/headserve.mjs -- node tools/tmp/input_accept.mjs
 *
 * Measure on a frozen snapshot, never the shared dev server (`docs/LESSONS.md` §5).
 */

import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const QUIET = process.argv.includes('--quiet');
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** Minimum displacement, in world units, that counts as "the fighter moved". A held
 *  key for 1.2 s at PLAYER_SPEED 0.12 wu/ms buys >100 wu on real hardware and >40 wu
 *  under SwiftShader; 8 is far below either and far above float noise. */
const MOVED_WU = 8;

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

const dbg = (p) => p.evaluate(() => window.__matchDebug ?? null);
const fighters = (p) => p.evaluate(() => window.__vfxDebugFighters ?? null);

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => record('page', 'no-page-errors', false, String(e).slice(0, 160)));
  return page;
}

async function waitLiveMatch(page, timeout = 120000) {
  await page.waitForFunction('window.__gameReady === true', null, { timeout });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout });
  await page.waitForTimeout(250);
}

/**
 * Hold one key and report BOTH halves of the chain: what reached `MatchInput.move`
 * while it was down, and how far the fighter actually travelled.
 */
async function holdKey(page, code, ms = 1200) {
  const before = (await fighters(page)).player;
  await page.keyboard.down(code);
  // Sampled while held rather than after release, since `moveX` is zero again by then.
  await page.waitForTimeout(Math.min(400, ms));
  const during = await dbg(page);
  await page.waitForTimeout(Math.max(0, ms - 400));
  await page.keyboard.up(code);
  await page.waitForTimeout(150);
  const after = (await fighters(page)).player;
  return {
    axesX: during.moveX, axesY: during.moveY,
    dx: after.x - before.x, dy: after.y - before.y,
  };
}

/** The eight cardinal assertions, WASD and arrows driven independently. */
async function auditMovement(page, group) {
  const CASES = [
    ['KeyA', -1, 0, 'x', -1], ['KeyD', +1, 0, 'x', +1],
    ['KeyW', 0, -1, 'y', -1], ['KeyS', 0, +1, 'y', +1],
    ['ArrowLeft', -1, 0, 'x', -1], ['ArrowRight', +1, 0, 'x', +1],
    ['ArrowUp', 0, -1, 'y', -1], ['ArrowDown', 0, +1, 'y', +1],
  ];
  for (const [code, wantX, wantY, axis, sign] of CASES) {
    const r = await holdKey(page, code);
    record(group, `${code}-reaches-sim`, r.axesX === wantX && r.axesY === wantY,
      `MatchInput.move = (${r.axesX}, ${r.axesY}), want (${wantX}, ${wantY})`);
    const d = axis === 'x' ? r.dx : r.dy;
    record(group, `${code}-moves-fighter`, Math.sign(d) === sign && Math.abs(d) >= MOVED_WU,
      `d${axis} = ${d.toFixed(1)} wu (want ${sign > 0 ? '>=' : '<=-'}${MOVED_WU})`);
  }

  // Diagonal — both axes must survive the same tick, and neither may cancel the other.
  const b = (await fighters(page)).player;
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  const diag = await dbg(page);
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(150);
  const a = (await fighters(page)).player;
  record(group, 'diagonal-reaches-sim', diag.moveX === 1 && diag.moveY === -1,
    `MatchInput.move = (${diag.moveX}, ${diag.moveY}), want (1, -1)`);
  record(group, 'diagonal-moves-both-axes', a.x - b.x > 0 && a.y - b.y < 0,
    `d = (${(a.x - b.x).toFixed(1)}, ${(a.y - b.y).toFixed(1)})`);

  // Opposite keys held together must cancel to a standstill, not pick a winner.
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  const both = await dbg(page);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyD');
  record(group, 'opposite-keys-cancel', both.moveX === 0,
    `MatchInput.move.x = ${both.moveX}`);

  // Release. A key that never clears is a fighter that walks into a wall all match.
  const relBefore = (await fighters(page)).player;
  await page.waitForTimeout(700);
  const relAfter = (await fighters(page)).player;
  const relDbg = await dbg(page);
  record(group, 'keyup-stops-movement',
    relDbg.moveX === 0 && relDbg.moveY === 0 && Math.hypot(relAfter.x - relBefore.x, relAfter.y - relBefore.y) < 1,
    `move=(${relDbg.moveX},${relDbg.moveY}) drift=${Math.hypot(relAfter.x - relBefore.x, relAfter.y - relBefore.y).toFixed(2)} wu`);

  // ── Blur while a key is held ──────────────────────────────────────────────
  // The browser stops sending `keyup` once the window loses focus, so `input.ts`
  // clears its held set on `blur`. Without that the fighter runs into a wall for as
  // long as the player is away, and nothing on screen says so.
  //
  // A SECOND HARNESS BOUNDARY, measured here rather than assumed (see
  // `tools/tmp/blur_boundary_probe.mjs`): Playwright's Chromium NEVER blurs a page.
  // `document.hasFocus()` stayed true, and zero `blur` events arrived, across a
  // same-context tab switch, a cross-context `bringToFront()`, and
  // `Emulation.setFocusEmulationEnabled:false`. Every page always believes it is
  // focused. So the real focus change cannot be produced, and this drives the exact
  // event a real one would deliver — same type, same target, same handler — which is
  // as far as any harness in this repo can go.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  const heldBefore = await dbg(page);
  const canBlur = await page.evaluate(async () => {
    const other = window.open('about:blank');
    await new Promise((r) => setTimeout(r, 250));
    other?.close();
    return document.hasFocus();
  }).then((f) => f === false).catch(() => false);
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
  await page.waitForTimeout(250);
  const heldAfter = await dbg(page);
  await page.keyboard.up('KeyD');
  record(group, 'blur-clears-held-keys', heldBefore.moveX === 1 && heldAfter.moveX === 0,
    `moveX ${heldBefore.moveX} -> ${heldAfter.moveX} on window "blur"` +
    (canBlur ? ' (real focus loss)' : ' (dispatched — this harness never blurs a page)'));

  // Digit keys select weapon slots. The HUD bar is the touch equivalent; this is the
  // desktop half, and it also proves `keydown` carries `e.key` as well as `e.code`.
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  const w2 = (await dbg(page)).selectedWeapon;
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(200);
  const w1 = (await dbg(page)).selectedWeapon;
  record(group, 'digit-keys-select-weapon', w2 === 1 && w1 === 0,
    `slot after "2" = ${w2}, after "1" = ${w1}`);
}

/** Uri's two original bug reports, asserted directly. */
async function auditAimAndFire(page, group) {
  // `docs/LESSONS.md` §12 — the mechanism behind both reports was a full-viewport
  // `pointer-events: auto` layer swallowing every event before the canvas saw it.
  const top = await page.evaluate(() => {
    const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : null;
  });
  record(group, 'canvas-is-top-at-centre', top === 'canvas', `elementFromPoint(centre) = ${top}`);

  const at = await page.evaluate(() => window.__vfxDebugScreen?.player ?? null);
  if (!at) { record(group, 'aim-origin-known', false, 'no __vfxDebugScreen.player'); return; }

  const facingAt = async (ox, oy) => {
    await page.mouse.move(at.x + ox, at.y + oy);
    await page.waitForTimeout(260);
    const d = await dbg(page);
    return { x: d.facingX, y: d.facingY };
  };
  const right = await facingAt(200, 0);
  const left = await facingAt(-200, 0);
  const up = await facingAt(0, -200);
  const down = await facingAt(0, 200);
  record(group, 'faces-cursor-x', right.x > 0.5 && left.x < -0.5,
    `facing.x right=${right.x.toFixed(2)} left=${left.x.toFixed(2)}`);
  record(group, 'faces-cursor-y', up.y < -0.3 && down.y > 0.3,
    `facing.y up=${up.y.toFixed(2)} down=${down.y.toFixed(2)}`);

  // Firing. Read off the VFX cast counter, i.e. off a `weapon-fired` event the sim
  // actually emitted — not off the mouse handler and not off a pixel.
  await page.mouse.move(at.x + 200, at.y);
  const casts0 = await page.evaluate(() => window.__vfxQaCounts?.cast ?? 0);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const held = await dbg(page);
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const casts1 = await page.evaluate(() => window.__vfxQaCounts?.cast ?? 0);
  const released = await dbg(page);
  record(group, 'mousedown-reaches-sim', held.attack === true, `MatchInput.attack = ${held.attack}`);
  record(group, 'mousedown-fires-weapon', casts1 > casts0, `cast events ${casts0} -> ${casts1}`);
  record(group, 'mouseup-stops-firing', released.attack === false, `MatchInput.attack = ${released.attack}`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function auditShippedPath(browser) {
  const G = 'shipped';
  const page = await newPage(browser);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // `force` skips Playwright's actionability wait only: these screens animate
  // continuously so "stable" never becomes true, and the title card auto-advances on
  // its own timer and detaches its button mid-click. The event itself is still a real
  // CDP mouse event through the browser's own hit testing.
  const step = async (name, sel, want) => {
    if (await page.evaluate((s) => window.__screen === s, want)) return;
    try {
      await page.waitForSelector(sel, { state: 'visible', timeout: 45000 });
      await page.click(sel, { force: true, timeout: 15000 });
    } catch { /* raced the auto-advance; the wait below is the real assertion */ }
    await page.waitForFunction((s) => window.__screen === s, want, { timeout: 60000 });
  };
  try {
    await page.waitForFunction('typeof window.__screen === "string"', null, { timeout: 60000 });
    await step('opening: Start', '.open-start', 'home');
    await step('home: Start Game', '[data-el="start"]', 'characters');
    await step('characters: Fight!', '[data-el="fight"]', 'match');
    await waitLiveMatch(page);
    record(G, 'reaches-live-match', true, 'opening -> home -> characters -> Fight! -> phase=playing');
  } catch (err) {
    record(G, 'reaches-live-match', false, String(err).split('\n')[0]);
    await page.close();
    return;
  }

  const d = await dbg(page);
  record(G, 'not-paused', d.paused === false, `paused=${d.paused}`);
  record(G, 'no-qa-pin', d.qaSpawnInsideCover === null, `qaSpawnInsideCover=${d.qaSpawnInsideCover}`);
  record(G, 'pointer-lock-not-required', d.pointerLocked === false,
    'movement below is asserted with the mouse UNCAPTURED, which is what a player gets before clicking the capture chip');

  await auditMovement(page, G);
  await auditAimAndFire(page, G);

  // Pause must actually stop the sim, and resume must actually restart it — the pause
  // chip lives on this screen and `pointerLock.engage()` is a no-op until the player
  // opts in, so this must not deadlock the match on a harness that cannot lock.
  const p0 = (await fighters(page)).player;
  await page.click('[data-el="pause"]', { force: true });
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  const p1 = (await fighters(page)).player;
  const paused = await dbg(page);
  record(G, 'pause-freezes-input', paused.paused === true && Math.hypot(p1.x - p0.x, p1.y - p0.y) < 1,
    `paused=${paused.paused} drift=${Math.hypot(p1.x - p0.x, p1.y - p0.y).toFixed(2)} wu`);
  record(G, 'pause-keeps-loop-alive', paused.frames > d.frames, `frames ${d.frames} -> ${paused.frames}`);
  await page.click('[data-el="resume"]', { force: true });
  await page.waitForTimeout(400);
  const r = await holdKey(page, 'KeyA');
  record(G, 'resume-restores-input', r.dx < -MOVED_WU, `dx after resume = ${r.dx.toFixed(1)} wu`);

  await page.close();
}

async function auditDirectRoute(browser) {
  const G = 'direct';
  const page = await newPage(browser);
  await page.goto(`${BASE}/?player=hamburger&enemy=donut`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try {
    await waitLiveMatch(page);
    record(G, 'reaches-live-match', true, '/?player=hamburger&enemy=donut');
  } catch (err) {
    record(G, 'reaches-live-match', false, String(err).split('\n')[0]);
    await page.close();
    return;
  }
  await auditMovement(page, G);
  await auditAimAndFire(page, G);
  await page.close();
}

/**
 * The pointer-lock boundary, and the QA parameter that hides behind it.
 *
 * Everything a harness in this repo CAN reach is asserted; the one thing it cannot is
 * asserted to still be unreachable, so the limitation stays a measurement rather than
 * a remembered anecdote.
 */
async function auditPointerLockBoundary(browser) {
  const G = 'pointerlock';
  const page = await newPage(browser);
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&pointerLock=sim`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await waitLiveMatch(page); } catch (err) {
    record(G, 'reaches-live-match', false, String(err).split('\n')[0]);
    await page.close(); return;
  }
  record(G, 'reaches-live-match', true, '?pointerLock=sim');

  // Capture, through the real chip, with a real click.
  await page.click('[data-el="capture"]', { force: true });
  await page.waitForTimeout(400);
  const locked = await dbg(page);
  record(G, 'sim-capture-engages', locked.pointerLocked === true, `pointerLocked=${locked.pointerLocked}`);

  // Movement must survive capture — the captured cursor model changes AIM, not motion.
  const r = await holdKey(page, 'KeyA');
  record(G, 'keys-work-while-captured', r.axesX === -1 && r.dx < -MOVED_WU,
    `move.x=${r.axesX} dx=${r.dx.toFixed(1)} wu`);

  // Aim while captured comes from movementX/Y deltas through `aimOffsetPx`, which is a
  // different code path from the free cursor's absolute NDC. Drive it and check facing
  // actually swings — this is the half of the aim pipeline the free-cursor test misses.
  await page.mouse.move(500, 310);
  await page.mouse.move(900, 310);
  await page.waitForTimeout(300);
  const f1 = await dbg(page);
  await page.mouse.move(100, 310);
  await page.mouse.move(100, 310);
  await page.waitForTimeout(300);
  const f2 = await dbg(page);
  record(G, 'captured-aim-swings', Math.hypot(f1.facingX - f2.facingX, f1.facingY - f2.facingY) > 0.3,
    `facing (${f1.facingX.toFixed(2)},${f1.facingY.toFixed(2)}) -> (${f2.facingX.toFixed(2)},${f2.facingY.toFixed(2)})`);
  await page.close();

  // THE BOUNDARY ITSELF. `docs/LESSONS.md` §10 and `docs/STATE.md` Part 3 item 1 say
  // Playwright's Chromium refuses `requestPointerLock()` unconditionally. If that ever
  // stops being true, `?pointerLock=sim` stops being necessary and this test should be
  // upgraded to drive the real thing — so the claim is re-measured, not assumed.
  const real = await newPage(browser);
  await real.goto(`${BASE}/?player=hamburger&enemy=donut&pointerLock=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  try { await waitLiveMatch(real); } catch { /* reported below */ }
  await real.click('[data-el="capture"]', { force: true }).catch(() => {});
  await real.waitForTimeout(1200);
  const plk = await real.evaluate(() => window.__plockDebug ?? null);
  const refused = !!plk && plk.locked === false;
  record(G, 'harness-still-refuses-real-lock', refused,
    refused
      ? `requestPointerLock() refused as documented (state=${plk.state}, lastError=${plk.lastError || 'none'}) — the captured cursor model is NOT testable here`
      : `requestPointerLock() SUCCEEDED (${JSON.stringify(plk)}) — docs/LESSONS.md §10 is now stale, upgrade this test`);
  // Refusal must degrade to the paused resume scrim, never to a match running with the
  // player believing they are captured.
  const afterRefusal = await dbg(real);
  record(G, 'refusal-pauses-not-strands', !refused || afterRefusal?.paused === true,
    `paused=${afterRefusal?.paused} state=${plk?.state}`);
  await real.close();
}

/**
 * The QA footgun that produced the 2026-08 "WASD is dead" report.
 *
 * `?px=850&py=500` puts the 42 wu fighter 25 wu from the centre of the `spice_cart`
 * CoverBox at (875,500,50,50) — overlapping, since 25 < (42+50)/2 = 46 — and
 * `movement.ts:tryMove` tests the DESTINATION for overlap with no depenetration, so
 * every step from inside is refused on both axes forever. Input is perfect throughout.
 * Measured band along y=500: pinned for 829 < px < 921 (spice_cart) and 895 < px < 985
 * (`supply_barrel` at (940,500,48,46)); free either side.
 */
async function auditQaSpawnGuard(browser) {
  const G = 'qa-spawn';
  const CASES = [
    { px: 850, py: 500, pinned: true, why: 'inside spice_cart (875,500,50,50)' },
    { px: 960, py: 500, pinned: true, why: 'inside supply_barrel (940,500,48,46)' },
    // Genuinely open floor. The first draft of this case used (700,760) and the guard
    // immediately caught it: `stacked_pots` is at (700,742) 55x55, so 760 is 18 wu from
    // its centre against a 48.5 wu half-sum. That is the same mistake the 2026-08 report
    // made, caught in one run — which is the entire point of the flag.
    { px: 700, py: 950, pinned: false, why: 'open floor south of the fryer counter' },
  ];
  for (const c of CASES) {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${c.px}&py=${c.py}&fogRadius=545&pointerLock=0`,
      { waitUntil: 'domcontentloaded', timeout: 90000 });
    try { await waitLiveMatch(page); } catch (err) {
      record(G, `px=${c.px}-reaches-match`, false, String(err).split('\n')[0]);
      await page.close(); continue;
    }
    const d = await dbg(page);
    record(G, `px=${c.px},py=${c.py}-cover-flag`,
      (d.qaSpawnInsideCover !== null) === c.pinned,
      `qaSpawnInsideCover=${d.qaSpawnInsideCover} (${c.why})`);

    const r = await holdKey(page, 'KeyA');
    record(G, `px=${c.px},py=${c.py}-input-reaches-sim`, r.axesX === -1,
      `MatchInput.move.x = ${r.axesX} — input is fine even when the fighter cannot move`);
    record(G, `px=${c.px},py=${c.py}-movement`,
      c.pinned ? Math.abs(r.dx) < 1 : r.dx < -MOVED_WU,
      `dx = ${r.dx.toFixed(1)} wu, expected ${c.pinned ? 'pinned' : 'moving'}`);
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: LAUNCH });
await auditShippedPath(browser);
await auditDirectRoute(browser);
await auditPointerLockBoundary(browser);
await auditQaSpawnGuard(browser);
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('');
for (const r of results) {
  if (r.ok && QUIET) continue;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.group, 13)} ${pad(r.check, 34)} ${r.detail}`);
}
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures > 0 ? 1 : 0);
