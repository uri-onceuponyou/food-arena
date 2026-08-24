#!/usr/bin/env node
/**
 * qx_quit — CAN A PLAYER GET OUT OF A MATCH, AND DOES LEAVING ACTUALLY LEAVE?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Uri asked for "a quit button in gameplay or the pause screen". The affordance was
 * already shipped — chip, sheet, Quit to Home, Escape — and it is in the bundle
 * deployed to GitHub Pages, which is the build he plays. So the request was not for a
 * missing control. It was `CLAUDE.md` rule 4 for the twentieth time: **it was
 * rendering and it was INVISIBLE.** Measured at 390x844, six seats, mid-match: the
 * chip's fill against the pixels immediately around it was **1.026:1**. One is
 * identical.
 *
 * Nothing in the battery could have caught that, and nothing in the battery could
 * have caught the other half either — `chip_probe.mjs` and `thumbzone.mjs` both
 * measure the chip's RECT, and a rect is not a picture and not a behaviour. There was
 * no assertion anywhere that pressing the thing ends the match, tears the session
 * down, or leaves the economy alone. This is that assertion.
 *
 * ── Everything here runs at SIX SEATS, and that is not decoration ────────────
 * `AGENT-BRIEF §4b`: six shipped defects were unreachable below three seats. The exit
 * has its own instance of the class and §I is it — **at two seats a death ENDS the
 * match**, so "the pause chip still works while you are dead" is a sentence with no
 * referent at N=2. At six it is the single most likely moment a player wants out:
 * dead, spectating, up to `MATCH_DURATION_MS` of someone else's match to sit through.
 * §A asserts the seat count FIRST so that no later row can pass vacuously at N=2.
 *
 * ── Sections ────────────────────────────────────────────────────────────────
 *   §A SEATS       six fighters really are in the match          (non-vacuity for §B-§I)
 *   §B HIT-TEST    the chip's own centre hit-tests to the chip   (a rect is not a tap)
 *   §C LEGIBLE     boundary contrast >= 3.0, WCAG 2.1 SC 1.4.11  (the 1.026 defect)
 *   §D ARMING      a tap delivered at Quit's own coordinate the instant the confirm
 *                  opens is INERT — the one accident wording cannot defend against
 *   §E BEHAVIOUR   Quit alone does NOT leave; Leave does; Escape cancels the confirm
 *   §F TEARDOWN    the render loop STOPS  (held ref, see below)
 *   §G ECONOMY     a mid-match quit does not write the profile
 *   §H DESKTOP     no touch, no pointer lock: mouse click and Escape both work
 *   §I SPECTATE    dead, match still 'playing' — the exit is still reachable
 *
 * ── The teardown measurement, and why it needs a HELD REFERENCE ──────────────
 * `GameSession.dispose()` deletes `window.__matchDebug`, so "the property is gone" is
 * evidence about a `delete`, not about the loop. `loop()` publishes `frames` from
 * inside the paused branch too, precisely so that "alive and deliberately not
 * stepping" and "stopped" are distinguishable — so this stashes the debug OBJECT
 * before quitting and reads `frames` off the stash afterwards. A leaked
 * `requestAnimationFrame` keeps mutating that object whether or not the window
 * property still points at it.
 * ⚠️ And the assertion is worthless unless the counter can express the other answer,
 * so §F measures the SAME held reference advancing while the match is live, in the
 * same run, before it ever quits. Without that row, a `frames` that never moved would
 * read as a perfect teardown.
 *
 * ── KNOWN-BAD ARMS — a guard not shown to FAIL is not a guard ────────────────
 *   --arm dark       restores the pre-fix plate (no ring, 0.78 fill).  §C must go RED
 *   --arm passthru   arms Leave immediately, killing the 350ms window. §D must go RED
 *   --arm noconfirm  wires Quit straight to the router.                §E must go RED
 *   --arm alive      skips the Leave click but still asserts teardown. §F must go RED
 *   --arm econ       writes the profile blob ON the leave click.        §G must go RED
 *   --arm cover      drops an overlay across the chip.                 §B must go RED
 * Each arm is a MUTATION OF THE SHIPPED PAGE, not a fixture: the tool is pointed at
 * the same tree in every arm, so a green arm cannot be green because the tool was
 * aimed somewhere harmless (`AGENT-BRIEF §4.4`: --selftest validates logic, never
 * where a tool POINTS).
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/qx_quit.mjs --url '{URL}'
 *   node tools/tmp/qx_quit.mjs --url <base> --arm dark        # must exit 1
 *   node tools/tmp/qx_quit.mjs --url <base> --knownbad        # runs all six arms
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { boundaryContrast } from './qx_contrast.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const A = process.argv.slice(2);
const get = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const has = (k) => A.includes(k);
const BASE = get('--url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const OUT = get('--out', 'tools/tmp/qx_out');
const ARM = get('--arm', 'none');
const DSF = 2;

/** WCAG 2.1 SC 1.4.11, Non-text Contrast. An external published floor, not one
 *  invented here — `CLAUDE.md` rule 10 wants the floor named before the number. */
const CONTRAST_FLOOR = 3.0;
/** `theme.ts:--tap`. Restated as a number only because a probe cannot read a CSS var
 *  that has not been computed yet; asserted against the computed value in §B. */
const MIN_TAP = 44;

const VIEWPORTS = [
  { name: 'portrait-390x844', w: 390, h: 844, safe: { t: 47, r: 0, b: 34, l: 0 }, touch: true },
  { name: 'portrait-360x800', w: 360, h: 800, safe: { t: 47, r: 0, b: 34, l: 0 }, touch: true },
  { name: 'land-844x390', w: 844, h: 390, safe: { t: 0, r: 44, b: 21, l: 44 }, touch: true },
  { name: 'land-932x430', w: 932, h: 430, safe: { t: 0, r: 44, b: 21, l: 44 }, touch: true },
];
const DESKTOP = { name: 'desktop-1280x800', w: 1280, h: 800, safe: { t: 0, r: 0, b: 0, l: 0 }, touch: false };

const MATCH_Q = 'screen=match&player=hamburger&enemy=donut&seats=6&pointerLock=0';

const rows = [];
let faults = 0;
function record(section, where, ok, detail) {
  rows.push({ section, where, ok, detail });
  if (!ok) faults++;
  const tag = ok ? 'ok  ' : 'FAIL';
  console.log(`  ${tag} ${section} ${where}${detail ? `  ${detail}` : ''}`);
}

/** Injected before any app code runs. Insets, plus whichever known-bad arm is on. */
function initScript({ safe, arm, seed }) {
  const css = [
    `:root{--fa-safe-t:${safe.t}px;--fa-safe-r:${safe.r}px;--fa-safe-b:${safe.b}px;--fa-safe-l:${safe.l}px;}`,
  ];
  if (arm === 'dark') {
    // The plate exactly as it shipped before the fix: clock material, no ring.
    css.push('.fa-match .match-chip{background:rgba(26,18,36,0.78)!important;' +
      'box-shadow:0 3px 0 rgba(0,0,0,0.35)!important;border:3px solid #1a1224!important;}');
  }
  if (arm === 'cover') {
    css.push('.fa-match::after{content:"";position:absolute;inset:0;pointer-events:auto;z-index:9;}');
  }
  const style = document.createElement('style');
  style.textContent = css.join('\n');
  const attach = () => document.head.appendChild(style);
  if (document.head) attach(); else document.addEventListener('DOMContentLoaded', attach);

  if (arm === 'passthru' || arm === 'noconfirm') {
    // Mutate the SHIPPED page rather than a fixture: wait for the sheet, then break it
    // the way the defect would have. `passthru` parks Leave exactly on Quit's rect;
    // `noconfirm` removes the confirm step entirely.
    const tick = setInterval(() => {
      const quit = document.querySelector('[data-el="quit"]');
      const leave = document.querySelector('[data-el="leave"]');
      if (!quit || !leave) return;
      clearInterval(tick);
      if (arm === 'passthru') {
        // Kill the arming window the way the defect would: keep the button live from
        // the instant the confirm appears, so a second tap at Quit's coordinate lands.
        new MutationObserver(() => { if (leave.disabled) leave.disabled = false; })
          .observe(leave, { attributes: true, attributeFilter: ['disabled'] });
        leave.disabled = false;
      } else {
        quit.addEventListener('click', () => {
          window.__shell?.navigate({ name: 'home' });
        }, { capture: true });
      }
    }, 60);
  }
  // `if (!existing)` is load-bearing: `addInitScript` runs on EVERY navigation, so an
  // unguarded seed would restore the blob after any write and make §G pass regardless.
  if (!localStorage.getItem('food-arena.profile.v1')) {
    localStorage.setItem('food-arena.profile.v1', JSON.stringify(seed));
  }

  if (arm === 'econ') {
    // 🚨 THIS ARM WAS ON A 2500ms TIMER AND IT PASSED — the tamper landed BEFORE the
    // row's own "before" read (§C takes five screenshots first), so both samples were
    // the tampered bytes and "byte-identical" was true of the wrong pair. A known-bad
    // that fires at the wrong moment is not a known-bad; it is a second green row.
    // It now fires ON THE LEAVE CLICK, which is the defect being modelled: leaving
    // writes the profile.
    const tick = setInterval(() => {
      const leave = document.querySelector('[data-el="leave"]');
      if (!leave) return;
      clearInterval(tick);
      leave.addEventListener('click', () => {
        const raw = localStorage.getItem('food-arena.profile.v1');
        if (raw) localStorage.setItem('food-arena.profile.v1', raw.replace(/\}$/, ',"qxTamper":1}'));
      }, { capture: true });
    }, 60);
  }
}

/**
 * A profile blob to compare against.
 *
 * 🚨 THIS EXISTS BECAUSE §G's OWN CONTROL CAUGHT §G BEING VACUOUS. A fresh context has
 * no `food-arena.profile.v1` at all, so "the blob is unchanged across a mid-match quit"
 * was comparing `null` to `null` and passing at every viewport — green, and asserting
 * nothing. The control row ("profile readable") is what turned it red. Seeding a real
 * blob is not enough on its own either: a malformed one is silently discarded by
 * `profile.ts:load()` and the comparison goes vacuous again in a way nothing can see,
 * so §G also requires the HOME SCREEN to display this trophy count after the quit —
 * proof that the app read the bytes this row is guarding.
 */
const SEED_TROPHIES = 347;
const SEED = {
  name: 'QX', wins: 4, losses: 2, xp: 260, selected: 'hamburger',
  economy: {
    trophies: SEED_TROPHIES, bestTrophies: SEED_TROPHIES, coins: 880, gems: 15,
    containers: { chest: 1, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1,
    lastMatch: null, seed: 424242, rolls: 0,
  },
};

/**
 * Wait for a page-side predicate, and report WHY it timed out rather than throwing.
 *
 * ⚠️ Fixed `waitForTimeout`s do not work here and a 300ms one is what produced four
 * false FAILs on the first run. Under SwiftShader this match renders at roughly
 * **1.4 frames per second** at 844x390 — `__matchDebug` is only republished from
 * inside `loop()`, so a field can lag its true value by most of a second. Every row
 * that reads a published field now waits on the field.
 */
async function until(page, fn, arg, ms = 8000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch { return false; }
}

async function open(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: DSF,
    hasTouch: vp.touch,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript(initScript, { safe: vp.safe, arm: ARM, seed: SEED });
  return { ctx, page, errs };
}

async function bootMatch(page, extra = '') {
  await page.goto(`${BASE}?${MATCH_Q}${extra}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__matchDebug?.phase === 'playing', null, { timeout: 90_000 });
  await page.waitForTimeout(900);
}

/** §A — how many fighters are really in this match. Read from the HUD's own plates,
 *  which is the observable a player has, not from a field a probe added. */
async function seatCount(page) {
  return page.evaluate(() =>
    document.querySelectorAll('.hud-fighter--enemy').length +
    document.querySelectorAll('.hud-fighter--player').length);
}

const rectOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const st = getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
}, sel);

async function runViewport(browser, vp) {
  console.log(`\n── ${vp.name} ${vp.touch ? '(touch)' : '(mouse)'} ────────────────`);
  const { ctx, page, errs } = await open(browser, vp);
  try {
    await bootMatch(page);

    // ── §A SEATS ────────────────────────────────────────────────────────────
    const seats = await seatCount(page);
    record('§A', `${vp.name} seats`, seats === 6,
      `${seats} fighter plates (must be 6 — every row below is a different sentence at 2)`);
    if (seats !== 6) { await ctx.close(); return; }

    // ── §B HIT-TEST ─────────────────────────────────────────────────────────
    const chip = await rectOf(page, '.fa-match .match-chip');
    record('§B', `${vp.name} chip present`, chip !== null, chip ? `${Math.round(chip.x)},${Math.round(chip.y)} ${Math.round(chip.w)}x${Math.round(chip.h)}` : 'absent');
    if (!chip) { await ctx.close(); return; }
    record('§B', `${vp.name} tap target`, chip.w >= MIN_TAP && chip.h >= MIN_TAP,
      `${Math.round(chip.w)}x${Math.round(chip.h)} >= ${MIN_TAP}`);
    const insets = vp.safe;
    const okSafe = chip.x >= insets.l && chip.y >= insets.t
      && chip.x + chip.w <= vp.w - insets.r && chip.y + chip.h <= vp.h - insets.b;
    record('§B', `${vp.name} inside safe area`, okSafe,
      `t${insets.t} r${insets.r} b${insets.b} l${insets.l}`);
    // A rect is not a tap: the chip's own centre must hit-test to the chip.
    const hit = await page.evaluate(({ x, y, w, h }) => {
      const top = document.elementFromPoint(x + w / 2, y + h / 2);
      return top ? (top.closest('.match-chip') ? 'chip' : (top.className || top.tagName)) : 'nothing';
    }, chip);
    record('§B', `${vp.name} hit-test`, hit === 'chip', `elementFromPoint → ${hit}`);

    // ── §C LEGIBLE ──────────────────────────────────────────────────────────
    // Five samples ~220ms apart, MIN taken: in landscape the chip sits over a moving
    // arena, so one frame is a sample and the worst frame is the answer.
    await mkdir(OUT, { recursive: true });
    let worst = Infinity, worstShot = '';
    const seen = [];
    for (let i = 0; i < 5; i++) {
      const shot = `${OUT}/${ARM}-${vp.name}-c${i}.png`;
      await page.screenshot({ path: shot });
      const m = await boundaryContrast(shot, chip, DSF);
      seen.push(m.boundary);
      if (m.boundary < worst) { worst = m.boundary; worstShot = shot; }
      await page.waitForTimeout(220);
    }
    record('§C', `${vp.name} boundary contrast`, worst >= CONTRAST_FLOOR,
      `min ${worst.toFixed(3)} of [${seen.map((v) => v.toFixed(2)).join(' ')}] vs floor ${CONTRAST_FLOOR} (WCAG 1.4.11) — ${worstShot}`);

    // ── §D GEOMETRY + THE ARMING WINDOW ─────────────────────────────────────
    await page.click('.fa-match .match-chip');
    const paused = await until(page, () =>
      document.querySelector('.match-sheet')?.classList.contains('is-open') === true
      && window.__matchDebug?.paused === true);
    record('§D', `${vp.name} chip pauses`, paused, 'sheet open AND sim paused (waited, not slept)');

    const quitRect = await rectOf(page, '[data-el="quit"]');
    const changeRect = await rectOf(page, '[data-el="change"]');
    record('§D', `${vp.name} both exits present`, quitRect !== null && changeRect !== null, '');
    if (!quitRect) { await ctx.close(); return; }

    await page.click('[data-el="quit"]');
    await until(page, () => document.querySelector('[data-el="pane-confirm"]')?.hidden === false);
    const leaveRect = await rectOf(page, '[data-el="leave"]');
    const keepRect = await rectOf(page, '[data-el="keep"]');
    record('§D', `${vp.name} confirm opened`, leaveRect !== null && keepRect !== null,
      leaveRect ? `leave ${Math.round(leaveRect.x)},${Math.round(leaveRect.y)} ${Math.round(leaveRect.w)}x${Math.round(leaveRect.h)}` : 'no confirm');
    if (!leaveRect) { await ctx.close(); return; }

    // The overlap is REPORTED, not asserted, and the reason is the whole point of the
    // temporal guard: at 390x844 Leave lands 6,623px² on top of Quit and at 844x390
    // 4,656px², because both panes centre in the same card. Asserting zero overlap
    // would mean pinning row heights that are `clamp()`s of the viewport — green at the
    // four sizes here and rotten at the fifth.
    const ox = Math.min(quitRect.x + quitRect.w, leaveRect.x + leaveRect.w) - Math.max(quitRect.x, leaveRect.x);
    const oy = Math.min(quitRect.y + quitRect.h, leaveRect.y + leaveRect.h) - Math.max(quitRect.y, leaveRect.y);
    const overlap = ox > 0.5 && oy > 0.5 ? Math.round(ox) * Math.round(oy) : 0;

    // THE ASSERTION: a tap at Quit's own coordinate, delivered immediately, must not
    // leave. This is the accident itself rather than a proxy for it, and it holds at
    // any layout. `page.mouse.click` is used rather than `page.click` because the
    // latter waits for the element to become enabled, i.e. it would wait out exactly
    // the window being measured and then report a pass.
    const armedNow = await page.evaluate(() => document.querySelector('[data-el="leave"]').disabled === false);
    await page.mouse.click(leaveRect.x + leaveRect.w / 2, leaveRect.y + leaveRect.h / 2);
    await page.waitForTimeout(120);
    const survivedPunchThrough = await page.evaluate(() => window.__matchDebug !== undefined);
    record('§D', `${vp.name} tap-through is inert`, survivedPunchThrough && !armedNow,
      `Leave ∩ Quit = ${overlap}px² so the coordinate DOES collide; disabled-on-open=${!armedNow}, still in match=${survivedPunchThrough}`);

    // ...and it must actually arm, or the confirm is a wall rather than a safety.
    const armed = await until(page, () => document.querySelector('[data-el="leave"]').disabled === false, null, 4000);
    record('§D', `${vp.name} Leave arms`, armed, 'disabled → enabled within 4s');
    record('§D', `${vp.name} leave tap target`, leaveRect.h >= MIN_TAP && keepRect.h >= MIN_TAP,
      `leave ${Math.round(leaveRect.h)} keep ${Math.round(keepRect.h)}`);
    // The card must fit the frame — a confirm the player cannot see all of is worse
    // than none. Checked at the SHORTEST landscape, where it is tightest.
    const card = await rectOf(page, '.match-sheet-card');
    record('§D', `${vp.name} card inside frame`, card !== null
      && card.y >= -0.5 && card.y + card.h <= vp.h + 0.5
      && card.x >= -0.5 && card.x + card.w <= vp.w + 0.5,
      card ? `${Math.round(card.w)}x${Math.round(card.h)} at ${Math.round(card.x)},${Math.round(card.y)} in ${vp.w}x${vp.h}` : 'absent');
    await page.screenshot({ path: `${OUT}/${ARM}-${vp.name}-confirm.png` });

    // ── §E BEHAVIOUR ────────────────────────────────────────────────────────
    // Opening the confirm must not have left the match. This is the row `--arm
    // noconfirm` turns red: it wires Quit straight to the router.
    const stillInMatch = await page.evaluate(() => window.__matchDebug !== undefined);
    record('§E', `${vp.name} Quit alone does not leave`, stillInMatch,
      'a confirm the router does not wait for is not a confirm');

    // Escape must back OUT of the confirm, not out of the match.
    await page.keyboard.press('Escape');
    await until(page, () => document.querySelector('[data-el="pane-confirm"]')?.hidden === true);
    const backedOut = await page.evaluate(() => ({
      confirmHidden: document.querySelector('[data-el="pane-confirm"]')?.hidden === true,
      pauseShown: document.querySelector('[data-el="pane-pause"]')?.hidden === false,
      stillPaused: window.__matchDebug?.paused === true,
    }));
    record('§E', `${vp.name} Escape cancels the confirm`,
      backedOut.confirmHidden && backedOut.pauseShown && backedOut.stillPaused,
      JSON.stringify(backedOut));

    // ── §F TEARDOWN ─────────────────────────────────────────────────────────
    // Hold the object, not the property. Resume first so the loop is in its ordinary
    // state, then prove the counter MOVES before asking whether it stops.
    await page.evaluate(() => { window.__qxHeld = window.__matchDebug; });
    await page.keyboard.press('Escape');          // resume out of the pause sheet
    await until(page, () => window.__matchDebug?.paused === false);

    // 🚨 THE STOPPED WINDOW IS DERIVED FROM THE LIVE FRAME RATE, NOT TYPED.
    // The first version waited a flat 800ms and called a still counter "stopped".
    // Under SwiftShader this loop runs at **~1.4 fps** — one run saw ONE frame in
    // 700ms and another saw ZERO — so an 800ms window is inside the live inter-frame
    // interval and "stopped" and "alive" are the same observation. That is a
    // vacuous control that would have passed on a leaked rAF. The interval is now
    // MEASURED here and the post-quit window is 6x it, floored at 2.5s.
    const t0 = Date.now();
    const f0 = await page.evaluate(() => window.__qxHeld?.frames ?? -1);
    // 8s covers three frames at the ~500ms/frame SwiftShader worst case with margin;
    // it was 20s and only ever spent that on an arm that had already left the match.
    const advanced = await until(page, (n) => (window.__qxHeld?.frames ?? -1) > n + 2, f0, 8_000);
    const perFrameMs = advanced ? (Date.now() - t0) / 3 : 8_000;
    const f1 = await page.evaluate(() => window.__qxHeld?.frames ?? -1);
    record('§F', `${vp.name} loop is alive (control)`, advanced,
      `frames ${f0} → ${f1}, ~${perFrameMs.toFixed(0)}ms/frame — without this row a counter that never moves reads as a perfect teardown`);
    const stopWindow = Math.max(2500, Math.round(perFrameMs * 6));

    // ── §G ECONOMY, part 1: the blob before ─────────────────────────────────
    const econBefore = await page.evaluate(() => localStorage.getItem('food-arena.profile.v1'));
    record('§G', `${vp.name} profile readable (control)`, typeof econBefore === 'string' && econBefore.length > 2,
      `${econBefore ? econBefore.length : 0} bytes — an absent blob would make "unchanged" vacuous`);

    // Leave for real.
    await page.click('.fa-match .match-chip');
    await until(page, () => document.querySelector('.match-sheet')?.classList.contains('is-open') === true);
    await page.click('[data-el="quit"]');
    await until(page, () => document.querySelector('[data-el="leave"]')?.disabled === false, null, 4000);
    if (ARM !== 'alive') {
      await page.click('[data-el="leave"]');
      await until(page, () => document.querySelector('.fa-home') !== null, null, 6000);
    }
    await page.waitForTimeout(400);

    const landed = await page.evaluate(() => ({
      home: document.querySelector('.fa-home') !== null,
      matchRoot: document.querySelectorAll('.fa-match').length,
      hud: document.querySelectorAll('.hud-topbar').length,
      debugGone: window.__matchDebug === undefined,
    }));
    record('§E', `${vp.name} Leave routes home`, landed.home && landed.matchRoot === 0 && landed.hud === 0,
      JSON.stringify(landed));

    const g0 = await page.evaluate(() => window.__qxHeld?.frames ?? -1);
    await page.waitForTimeout(stopWindow);
    const g1 = await page.evaluate(() => window.__qxHeld?.frames ?? -1);
    record('§F', `${vp.name} loop STOPPED`, g1 === g0 && g0 > 0,
      `held frames ${g0} → ${g1} over ${stopWindow}ms = 6x the measured ${perFrameMs.toFixed(0)}ms/frame ` +
      `(dispose() deletes the property; this reads the object)`);

    // ── §G ECONOMY, part 2 ──────────────────────────────────────────────────
    const econAfter = await page.evaluate(() => localStorage.getItem('food-arena.profile.v1'));
    record('§G', `${vp.name} profile untouched`, econAfter === econBefore,
      econAfter === econBefore ? 'byte-identical across a mid-match quit' :
        `CHANGED: ${String(econBefore).length} → ${String(econAfter).length} bytes`);

    // ...and the app must be READING that blob, or "untouched" is a statement about a
    // string nothing consumes. The home screen's own trophy readout is the observable.
    const shown = await page.evaluate(() =>
      (document.querySelector('[data-el="trophies"]')?.textContent ?? '').replace(/[^0-9]/g, ''));
    record('§G', `${vp.name} home reads the seeded profile`, Number(shown) === SEED_TROPHIES,
      `home shows ${shown || '(nothing)'} trophies, seed is ${SEED_TROPHIES}`);

    await page.screenshot({ path: `${OUT}/${ARM}-${vp.name}-home.png` });
    record('§B', `${vp.name} no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
  } finally {
    await ctx.close();
  }
}

/** §H — desktop, no touch, no pointer lock. Mouse click and Escape are the two ways
 *  in and they are different code paths: one is a DOM click, one is a window keydown. */
async function runDesktop(browser) {
  console.log(`\n── ${DESKTOP.name} (mouse) ────────────────`);
  const { ctx, page } = await open(browser, DESKTOP);
  try {
    await bootMatch(page);
    const seats = await seatCount(page);
    record('§A', 'desktop seats', seats === 6, `${seats} plates`);

    const chip = await rectOf(page, '.fa-match .match-chip');
    record('§H', 'desktop chip present', chip !== null, chip ? `${Math.round(chip.x)},${Math.round(chip.y)}` : 'absent');
    if (!chip) return;
    await page.mouse.click(chip.x + chip.w / 2, chip.y + chip.h / 2);
    record('§H', 'desktop mouse opens the sheet',
      await until(page, () => window.__matchDebug?.paused === true), 'no touch, no pointer lock');
    await page.keyboard.press('Escape');
    record('§H', 'desktop Escape resumes',
      await until(page, () => window.__matchDebug?.paused === false), '');
    await page.keyboard.press('Escape');
    record('§H', 'desktop Escape re-opens the sheet',
      await until(page, () => document.querySelector('.match-sheet')?.classList.contains('is-open') === true), '');
  } finally {
    await ctx.close();
  }
}

/**
 * §I — SPECTATE. The N=6-only case, and the one a two-seat test cannot express.
 *
 * The local fighter is dropped into the arena's central damage hazard with `?px=/?py=`
 * at an offset chosen from `rules.ts` rather than typed: inside `POT.dangerRadius`
 * (95) and outside the pot's solid box, which holds a fighter's centre at
 * `POT.bodyRadius + PLAYER_SIZE/2` = 73 wu. Anywhere inside 73 and `movement.ts` pins
 * the fighter with no depenetration — the `qaSpawnInsideCover` trap `match.ts`
 * documents.
 *
 * ⚠️ The hazard's real position is the ARENA CENTRE (`tools/arena.gameplay.json`:
 * 1400,1000), NOT `rules.ts:POT.x/POT.y`, which are 450,300 and are read by nothing in
 * `src/` — a dead 1x-era literal, reported for routing, not touched here.
 */
async function runSpectate(browser) {
  const vp = VIEWPORTS[0];
  console.log(`\n── spectate (dead, match still playing) at ${vp.name} ────────────────`);
  const { ctx, page } = await open(browser, vp);
  try {
    await bootMatch(page, '&px=1480&py=1000&simSpeed=4');
    const dead = await page.waitForFunction(
      () => window.__matchDebug?.viewSubject !== 0 && window.__matchDebug?.phase === 'playing',
      null, { timeout: 45_000 }).then(() => true).catch(() => false);
    const state = await page.evaluate(() => ({
      phase: window.__matchDebug?.phase, view: window.__matchDebug?.viewSubject,
      reason: window.__matchDebug?.viewReason,
    }));
    record('§I', 'player died, match continues', dead && state.phase === 'playing',
      `${JSON.stringify(state)} — at N=2 this state does not exist: the kill ends the match`);
    if (!dead) return;

    const chip = await rectOf(page, '.fa-match .match-chip');
    record('§I', 'chip still present while spectating', chip !== null, chip ? `${Math.round(chip.x)},${Math.round(chip.y)}` : 'absent');
    if (!chip) return;
    const hit = await page.evaluate(({ x, y, w, h }) => {
      const top = document.elementFromPoint(x + w / 2, y + h / 2);
      return top ? (top.closest('.match-chip') ? 'chip' : (top.className || top.tagName)) : 'nothing';
    }, chip);
    record('§I', 'chip still hit-tests while spectating', hit === 'chip', `→ ${hit}`);
    await page.click('.fa-match .match-chip');
    await until(page, () => document.querySelector('.match-sheet')?.classList.contains('is-open') === true);
    await page.click('[data-el="quit"]');
    await until(page, () => document.querySelector('[data-el="leave"]')?.disabled === false, null, 4000);
    await page.click('[data-el="leave"]');
    await until(page, () => document.querySelector('.fa-home') !== null, null, 6000);
    record('§I', 'a dead player can leave',
      await page.evaluate(() => document.querySelector('.fa-home') !== null
        && window.__matchDebug === undefined), '');
    await page.screenshot({ path: `${OUT}/${ARM}-spectate-home.png` });
  } finally {
    await ctx.close();
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`qx_quit  base=${BASE}  arm=${ARM}`);
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    // ⚠️ A THROWN ERROR IS A WORSE SIGNAL THAN A RECORDED FAULT, EVEN WHEN THE EXIT
    // CODE AGREES. `--arm cover` originally died on a Playwright click timeout — the
    // overlay it plants intercepts pointer events — so the arm "passed" by crashing
    // before it could print a tally, and an operator reading only the tail saw a stack
    // trace where the evidence should have been. Each stage now converts its own
    // exception into a fault row, so every arm ends with the same shape of answer.
    const stage = async (name, fn) => {
      try { await fn(); }
      catch (err) { record('§X', `${name} threw`, false, String(err).split('\n')[0].slice(0, 180)); }
    };
    for (const vp of VIEWPORTS) await stage(vp.name, () => runViewport(browser, vp));
    await stage('desktop', () => runDesktop(browser));
    await stage('spectate', () => runSpectate(browser));
  } finally {
    await browser.close();
  }
  await writeFile(`${OUT}/${ARM}-rows.json`, JSON.stringify(rows, null, 1));
  const bySection = {};
  for (const r of rows) {
    bySection[r.section] ??= { ok: 0, fail: 0 };
    bySection[r.section][r.ok ? 'ok' : 'fail']++;
  }
  console.log(`\n── qx_quit [${ARM}] ${rows.length} rows, ${faults} faults ──`);
  for (const [s, c] of Object.entries(bySection)) console.log(`  ${s}  ${c.ok} ok / ${c.fail} fail`);
  // NON-EMPTY FIRST: a run that asserted nothing must never exit 0.
  if (rows.length === 0) {
    console.log('FAIL: zero rows — the tool asserted NOTHING and would have exited 0');
    process.exitCode = 2;
    return;
  }
  process.exitCode = faults === 0 ? 0 : 1;
}

if (has('--knownbad')) {
  console.log('run each arm separately; every one must exit 1:');
  for (const a of ['dark', 'passthru', 'noconfirm', 'alive', 'econ', 'cover']) {
    console.log(`  node tools/tmp/qx_quit.mjs --url ${BASE} --arm ${a}`);
  }
} else {
  await main();
}
