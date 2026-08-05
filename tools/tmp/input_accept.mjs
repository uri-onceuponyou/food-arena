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
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const { PLAYER_SIZE } = await import(`${ROOT}/src/game/rules.ts`);

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const QUIET = process.argv.includes('--quiet');
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** Minimum displacement, in world units, that counts as "the fighter moved". A held
 *  key for 1.2 s at PLAYER_SPEED 0.12 wu/ms buys >100 wu on real hardware and >40 wu
 *  under SwiftShader; 8 is far below either and far above float noise. */
const MOVED_WU = 8;

/** Game frames a held key is kept down for. At the loop's 50 ms dt clamp one frame is
 *  PLAYER_SPEED x 50 = 6 wu, so 12 frames is 72 wu — comfortably over `MOVED_WU` and
 *  comfortably under the shortest legal spawn runway (84 wu north, see
 *  `tools/tmp/spawn_runway.mjs`), which is what keeps this a test of INPUT and not an
 *  accidental second test of the arena layout. */
const HOLD_FRAMES = 12;

const results = [];
let failures = 0;
function record(group, check, ok, detail = '') {
  results.push({ group, check, ok, detail });
  if (!ok) failures++;
}

const dbg = (p) => p.evaluate(() => window.__matchDebug ?? null);
const fighters = (p) => p.evaluate(() => window.__vfxDebugFighters ?? null);

/**
 * Sample `__matchDebug` until `want()` holds, or until the deadline — then return the LAST
 * sample either way.
 *
 * ── Why this replaced a fixed `waitForTimeout(400)` ─────────────────────────
 * Every `*-reaches-sim` assertion used to read the debug block exactly 400 ms after
 * `keyboard.down`. `MatchInput.move` is written by the game loop, and under SwiftShader
 * that loop runs at ~9-10 fps on a *good* run — so 400 ms is between 3 and 4 frames, and
 * a peer's render work in the same tree pushes it lower. Three consecutive runs of this
 * suite on identical code scored 85/85, 78/85 and 84/85, with the failures moving between
 * `KeyW`, `ArrowLeft`, `ArrowRight`, `ArrowDown`, `Digit1` and `mousedown` — every one of
 * them reporting `move = (0,0)` or `attack = false` while the input was demonstrably held.
 * That is a harness race, and `docs/LESSONS.md` §10 is explicit that a slow harness
 * fabricates false negatives (it already cost this project four of five countdown blips).
 *
 * The assertion is UNCHANGED in strength: the deadline is bounded and the last sample is
 * returned regardless, so an input that genuinely never arrives still fails, with the same
 * message. What is removed is only the assumption that four frames is enough.
 */
async function pollDbg(page, want, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  let last = await dbg(page);
  while (Date.now() < deadline) {
    if (last && want(last)) return last;
    await page.waitForTimeout(60);
    last = await dbg(page);
  }
  return last;
}

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
  // Establish an IDLE baseline first. Without it the poll below returns instantly with the
  // PREVIOUS key's value — the loop may not have processed the last `keyup` yet — and the
  // suite reports `ArrowRight -> move = (-1,0)`, which is what the first version of this
  // fix actually produced. With `move` proven to be (0,0) before the press, any non-zero
  // sample afterwards can only have come from this key.
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 2000);
  const before = (await fighters(page)).player;
  const idle = await dbg(page);
  await page.keyboard.down(code);
  // Sampled while held rather than after release, since `moveX` is zero again by then —
  // and POLLED rather than slept, see `pollDbg`.
  const during = await pollDbg(page, (d) => d.moveX !== 0 || d.moveY !== 0, 2000);
  // Held for a number of GAME FRAMES, not for a number of milliseconds. `docs/LESSONS.md`
  // §10: a slow harness fabricates false negatives, and this one did — measured at load
  // average 58 on this box, a 1.2 s hold advanced the loop ONE tick and the fighter moved
  // 6.0 wu, so `KeyD/ArrowUp/ArrowDown-moves-fighter` all failed at exactly the value the
  // real 60c5b92 defect produced. Displacement is `HOLD_FRAMES x step` and nothing else,
  // so the number this returns no longer depends on how busy the machine is.
  await pollDbg(page, (d) => d.frames >= idle.frames + HOLD_FRAMES, Math.max(ms * 8, 12000));
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
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 2000);
  const b = (await fighters(page)).player;
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  const diag = await pollDbg(page, (d) => d.moveX !== 0 && d.moveY !== 0, 1200);
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
  // ⚠️ This is the one case where polling for the assertion's OWN condition would make it
  // vacuous: `moveX === 0` is also true before either key has arrived. So the two presses
  // are staged — KeyA is proven to have reached the sim, then KeyD is given two whole
  // frames of the loop — and only then is the cancellation asserted. If KeyD never arrives,
  // `moveX` is still -1 and this fails exactly as it should.
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 2000);
  await page.keyboard.down('KeyA');
  const solo = await pollDbg(page, (d) => d.moveX === -1, 1200);
  await page.keyboard.down('KeyD');
  const f0 = solo.frames;
  // Two whole frames of the loop, waited for by FRAME COUNT rather than by clock — under
  // load a 1500 ms sleep bought one tick, which is not enough to say the second keydown
  // was seen at all.
  const both = await pollDbg(page, (d) => d.frames >= f0 + 2, 12000);
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyD');
  record(group, 'opposite-keys-cancel', solo.moveX === -1 && both.moveX === 0 && both.frames >= f0 + 2,
    `KeyA alone -> move.x = ${solo.moveX}; +KeyD after ${both.frames - f0} frames -> move.x = ${both.moveX}`);

  // Release. A key that never clears is a fighter that walks into a wall all match.
  // Let the loop actually see the keyup before the drift window opens — otherwise a slow
  // frame applies one more held step INSIDE the measurement and reads as drift.
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 1200);
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
  await pollDbg(page, (d) => d.moveX === 0 && d.moveY === 0, 2000);
  await page.keyboard.down('KeyD');
  const heldBefore = await pollDbg(page, (d) => d.moveX === 1, 1200);
  const canBlur = await page.evaluate(async () => {
    const other = window.open('about:blank');
    await new Promise((r) => setTimeout(r, 250));
    other?.close();
    return document.hasFocus();
  }).then((f) => f === false).catch(() => false);
  await page.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
  const heldAfter = await pollDbg(page, (d) => d.moveX === 0, 1200);
  await page.keyboard.up('KeyD');
  record(group, 'blur-clears-held-keys', heldBefore.moveX === 1 && heldAfter.moveX === 0,
    `moveX ${heldBefore.moveX} -> ${heldAfter.moveX} on window "blur"` +
    (canBlur ? ' (real focus loss)' : ' (dispatched — this harness never blurs a page)'));

  // Digit keys select weapon slots. The HUD bar is the touch equivalent; this is the
  // desktop half, and it also proves `keydown` carries `e.key` as well as `e.code`.
  await page.keyboard.press('Digit2');
  const w2 = (await pollDbg(page, (d) => d.selectedWeapon === 1, 1200)).selectedWeapon;
  await page.keyboard.press('Digit1');
  const w1 = (await pollDbg(page, (d) => d.selectedWeapon === 0, 1200)).selectedWeapon;
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
    // The aim pipeline settles on the frame after the move; poll for the facing to point
    // the way the cursor was put rather than assuming one 260 ms sleep covers a frame.
    const wantX = Math.sign(ox), wantY = Math.sign(oy);
    const d = await pollDbg(page, (s) =>
      (wantX === 0 || Math.sign(s.facingX) === wantX) && (wantY === 0 || Math.sign(s.facingY) === wantY), 1200);
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
  const held = await pollDbg(page, (d) => d.attack === true, 1200);
  await page.waitForTimeout(700);
  await page.mouse.up();
  const released = await pollDbg(page, (d) => d.attack === false, 1200);
  await page.waitForTimeout(250);
  const casts1 = await page.evaluate(() => window.__vfxQaCounts?.cast ?? 0);
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
      await page.waitForSelector(sel, { state: 'visible', timeout: 90000 });
      await page.click(sel, { force: true, timeout: 30000 });
    } catch { /* raced the auto-advance; the wait below is the real assertion */ }
    // 180 s, not 60. Measured: at load average 75-92 on this box (six agents, each with a
    // Vite server and a SwiftShader Chromium) the shipped route timed out at 60 s while the
    // `/?player=&enemy=` route booted fine — i.e. the suite reported "cannot reach a live
    // match" for a game that reaches one. `docs/LESSONS.md` §10, again: a slow harness
    // fabricates false negatives, and a boot timeout is the loudest false negative there is.
    await page.waitForFunction((s) => window.__screen === s, want, { timeout: 180000 });
  };
  try {
    await page.waitForFunction('typeof window.__screen === "string"', null, { timeout: 180000 });
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
  const locked = await pollDbg(page, (d) => d.pointerLocked === true, 3000);
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
 * The QA footgun that produced the 2026-08 "WASD is dead" report — and the fix for it.
 *
 * A `?px=`/`?py=` inside a `CoverBox` buries the 42 wu fighter: overlap is centre distance
 * < (PLAYER_SIZE + w)/2 on both axes, and `?px=`/`?py=` deliberately does not validate
 * against cover, so a QA URL really can bury one.
 *
 * WHAT USED TO HAPPEN: `movement.ts:tryMove` tested only the DESTINATION for overlap and
 * did no depenetration, so every step from inside was refused on both axes, forever,
 * silently — while the input layer was perfect the whole time. The historical numbers, on
 * the pre-60c5b92 layout: `?px=850&py=500` sat 25 wu from the `spice_cart` at
 * (875,500,50,50), and the pinned band along y=500 ran 829 < px < 921 for that cart and
 * 895 < px < 985 for the `supply_barrel` at (940,500,48,46). The boundary landing exactly
 * where burial depth exceeds one step (PLAYER_SPEED 0.12 wu/ms x the loop's 50 ms dt clamp
 * = 6 wu) is what identified the mechanism.
 *
 * WHAT HAPPENS NOW: `tryMove` pushes a fighter that is already inside a box back out along
 * its axis of least penetration before resolving the step, so all three cases below MOVE.
 *
 * ── WHY THE COORDINATES ARE NO LONGER WRITTEN DOWN ──────────────────────────
 * `60c5b92` moved every prop, and those two literals became open floor. The suite went on
 * asserting them, so three checks failed against a layout that was CORRECT — the classic
 * stale instrument, and re-typing the new numbers would only reset the clock on it.
 *
 * Every point below is now DERIVED FROM THE ARENA: pick a CoverBox **by kind**, offset off
 * its centre by a stated fraction of the collision half-sum (so the point is provably
 * inside, by construction, at any size the box ever takes), and assert the live game names
 * THAT BOX back. Three separate things then have to agree before a number is reported:
 *
 *   1. `src/arena/kitchen.ts` vs `tools/arena.gameplay.json` — checked box-for-box by
 *      `arena_probe.mjs --verify` before the browser is even launched.
 *   2. the dump vs the LIVE arena — `qaSpawnInsideCover` must echo back exactly the box
 *      this file aimed at, kind and coordinates and size. A moved prop cannot pass.
 *   3. the derivation vs itself — the chosen point must overlap EXACTLY ONE box, because
 *      `checkQaSpawn()` reports the first match in `arena.cover` order and an ambiguous
 *      point would make assertion 2 a coin flip.
 *
 * TWO ASSERTIONS, AND ONLY ONE OF THEM INVERTED:
 *   * `-cover-flag` still asserts `checkQaSpawn()` WARNS about the two buried cases.
 *     Depenetration rescues the fighter; it does not turn a bad QA coordinate into a good
 *     one, and a probe author still needs to be told.
 *   * `-movement` is inverted: every case must now travel, and the buried ones must also
 *     end up outside the box they started in.
 *
 * The escape is gated on the fighter TRYING to move, which preserves a diagnostic this
 * project has already spent: parking a fighter inside the pot with `?px=`/`?py=` and
 * photographing it is how "a fighter inside the pot is 0.0% visible" was proven. Parked and
 * left alone, it still stays exactly where it was put. `src/game/sim.test.mjs` §15 holds
 * that case, plus the two invariants that stop depenetration becoming its own bug class:
 * a fighter moving in the open gains no lateral drift, and one pressed exactly on a
 * collision boundary is not pushed off it.
 */

/** Every box a fighter CENTRED at (x,y) would overlap. Exactly `movement.ts`'s test. */
const coverHits = (arena, x, y) =>
  arena.cover.filter((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2);

/** `checkQaSpawn()`'s exact string, rebuilt here so the assertion is on identity. */
const boxLabel = (b) => `${b.kind ?? 'cover'} @(${b.x},${b.y}) ${b.w}x${b.h}`;

/**
 * The instance of `kind` nearest the arena's north-west, so the pick is deterministic and
 * does not depend on `addCover` call order.
 *
 * `isolated` additionally requires that the box's INFLATED footprint (its own extent plus
 * a fighter, i.e. the region where a centre is refused) touches no other box's. That is
 * not fussiness, it is the precondition for the assertions below to be meaningful, and it
 * was found by this suite: `?px=88&py=250` buried the fighter in the NW `supply_barrel`,
 * whose inflated box OVERLAPS the NW freezer's by 17 wu. `escapeCover` takes the axis of
 * least penetration, so it pushed the fighter 23 wu east — straight into the freezer —
 * which pushed it 17 wu back west, into the barrel, and the two ping-ponged until
 * `ESCAPE_PASSES` (4) ran out, leaving it stuck at x=94.0, the freezer's own west face.
 * Min-translation depenetration has no exit from the intersection of two inflated boxes,
 * and 18 such pairs exist in this layout (16 of them older than this file's last change).
 * None is reachable in play — every one lies inside cover, where no legal step can put a
 * fighter — so it is a `?px=`/`?py=` hazard and a warning for anyone adding sim-side
 * knockback, a dash or a pull, not a live defect. Recorded rather than worked around
 * silently, because "the fighter did not escape" would otherwise read as a depenetration
 * regression the next time this suite runs.
 */
function boxOfKind(arena, kind, { isolated = false } = {}) {
  const inflatedTouch = (a, b) =>
    (a.w + b.w) / 2 + PLAYER_SIZE - Math.abs(a.x - b.x) > 0 &&
    (a.h + b.h) / 2 + PLAYER_SIZE - Math.abs(a.y - b.y) > 0;
  const all = arena.cover.filter((o) => o.kind === kind).sort((a, b) => (a.x - b.x) || (a.y - b.y));
  const usable = isolated ? all.filter((o) => !arena.cover.some((p) => p !== o && inflatedTouch(o, p))) : all;
  return usable[0] ?? null;
}

/**
 * A point provably inside `box`: offset along +x by `frac` of the collision half-sum. Any
 * `frac` in (0,1) overlaps by construction — 0.55 is chosen to reproduce the SHAPE of the
 * original report (a shallow, off-centre burial, 25 wu into a 50 wu cart) rather than a
 * symmetric one, because min-translation depenetration behaves differently off-centre.
 */
const buriedPoint = (box) => ({ x: Math.round(box.x + 0.55 * ((PLAYER_SIZE + box.w) / 2)), y: box.y });

async function auditQaSpawnGuard(browser) {
  const G = 'qa-spawn';

  // (1) The dump this file derives from must still describe the source. Cheap (~1 s, no
  //     browser) and it fails BEFORE any coordinate is used, which is the whole point.
  let verify = '';
  let verifyOk = false;
  try {
    verify = execFileSync('node', [`${ROOT}/tools/tmp/arena_probe.mjs`, '--verify'], { encoding: 'utf8' });
    verifyOk = /MATCH — the extractor is a faithful second reader/.test(verify);
  } catch (err) { verify = String(err.stdout ?? err); }
  record(G, 'layout-dump-matches-source', verifyOk,
    verifyOk
      ? 'tools/arena.gameplay.json reproduces src/arena/kitchen.ts box-for-box'
      : `arena_probe --verify says NO — every point below would be derived from a stale world:\n${verify.trim().split('\n').slice(-6).join('\n')}`);

  const arena = JSON.parse(readFileSync(`${ROOT}/tools/arena.gameplay.json`, 'utf8'));
  const fryer = boxOfKind(arena, 'fryer_counter');
  const CASES = [
    { kind: 'spice_cart', why: 'the north-westmost spice cart with a clear depenetration exit' },
    { kind: 'supply_barrel', why: 'the north-westmost supply barrel with a clear depenetration exit' },
    // Genuinely open floor, anchored to a named prop rather than to a literal: one box
    // depth clear of the fryer counter's south face. The first draft of this case used a
    // hardcoded (700,760) and the guard immediately caught it — `stacked_pots` was 18 wu
    // away against a 48.5 wu half-sum. That is the same mistake the 2026-08 report made,
    // caught in one run, which is the entire point of the flag.
    {
      open: true,
      at: { x: fryer.x, y: Math.round(fryer.y + fryer.h / 2 + PLAYER_SIZE / 2 + PLAYER_SIZE) },
      why: "open floor one full body clear of the fryer counter's own collision face",
    },
  ];

  for (const c of CASES) {
    let at;
    let box = null;
    if (c.open) {
      at = c.at;
    } else {
      box = boxOfKind(arena, c.kind, { isolated: true });
      if (!box) {
        record(G, `${c.kind}-exists-in-layout`, false,
          `no CoverBox of kind "${c.kind}" with a clear depenetration exit — this suite's premise moved, not the game`);
        continue;
      }
      at = buriedPoint(box);
    }
    // (3) The derivation must be unambiguous, or the identity assertion below is a coin flip.
    const hits = coverHits(arena, at.x, at.y);
    record(G, `${c.open ? 'open-floor' : c.kind}-derivation-is-unambiguous`,
      c.open ? hits.length === 0 : hits.length === 1 && hits[0] === box,
      c.open
        ? `(${at.x},${at.y}) overlaps ${hits.length} box(es) — want 0 (${c.why})`
        : `(${at.x},${at.y}) overlaps ${hits.length} box(es): ${hits.map(boxLabel).join(' + ') || 'none'} — want exactly ${boxLabel(box)}`);

    const page = await newPage(browser);
    await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${at.x}&py=${at.y}&fogRadius=545&pointerLock=0`,
      { waitUntil: 'domcontentloaded', timeout: 90000 });
    try { await waitLiveMatch(page); } catch (err) {
      record(G, `px=${at.x}-reaches-match`, false, String(err).split('\n')[0]);
      await page.close(); continue;
    }
    const d = await dbg(page);
    // (2) UNCHANGED IN INTENT, STRONGER IN FORM: the spawn point is still a bad one and
    //     must still be flagged — and the flag must NAME the box this file aimed at, which
    //     is what makes the dump and the live arena prove each other.
    record(G, `px=${at.x},py=${at.y}-cover-flag`,
      box === null ? d.qaSpawnInsideCover === null : d.qaSpawnInsideCover === boxLabel(box),
      `qaSpawnInsideCover=${d.qaSpawnInsideCover} · want ${box === null ? 'null' : boxLabel(box)} (${c.why})`);

    const r = await holdKey(page, 'KeyA');
    record(G, `px=${at.x},py=${at.y}-input-reaches-sim`, r.axesX === -1,
      `MatchInput.move.x = ${r.axesX} — the input layer was never the problem here`);
    // INVERTED: nothing is frozen any more. The two cases assert different things on
    // purpose, and the difference is the interesting part.
    //
    // Open floor asserts DIRECTION: KeyA must carry the fighter west, because that is the
    // control working.
    //
    // A buried fighter asserts only that it is no longer stuck, because the escape is
    // MINIMUM-TRANSLATION and minimum translation does not care which way you wanted to go.
    // `buriedPoint` puts the fighter EAST of the box centre, so the shortest way out is
    // always east, and the fighter is deposited on the box's east face — where KeyA then
    // presses straight back into it and legitimately moves nothing further. Net
    // displacement is the escape itself, the fighter is free, and demanding a westward dx
    // here would be demanding that depenetration read the player's mind and take the longer
    // exit through more geometry. Direction is asserted on the open case; freedom here.
    const netWu = Math.hypot(r.dx, r.dy);
    record(G, `px=${at.x},py=${at.y}-movement`,
      box ? netWu >= MOVED_WU : r.dx < -MOVED_WU,
      box
        ? `moved ${netWu.toFixed(1)} wu net (want >=${MOVED_WU}) — no longer frozen; escape is min-translation, not player-intent`
        : `dx = ${r.dx.toFixed(1)} wu, want <=-${MOVED_WU}`);
    // And a buried fighter must actually be OUT, not merely jiggling inside the box. The
    // collision test is centre-distance < half-sum, with the real `rules.ts:PLAYER_SIZE`
    // rather than a copy of its value.
    if (box) {
      const p = (await fighters(page)).player;
      const inside = Math.abs(p.x - box.x) < (PLAYER_SIZE + box.w) / 2 &&
        Math.abs(p.y - box.y) < (PLAYER_SIZE + box.h) / 2;
      record(G, `px=${at.x},py=${at.y}-escaped-the-box`, !inside,
        `ended at (${p.x.toFixed(1)},${p.y.toFixed(1)}) vs ${boxLabel(box)} (${c.why})`);
    }
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
