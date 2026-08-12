/**
 * lb_accept — the match lobby's acceptance battery.
 *
 *   PREVIEW_BASE=<snapshot> node tools/tmp/lb_accept.mjs
 *   PREVIEW_BASE=<snapshot> node tools/tmp/lb_accept.mjs --shots <dir>   # also write PNGs
 *
 * ── WHY THIS FILE EXISTS RATHER THAN A ROW IN `menu_accept` ─────────────────
 * `menu_accept.mjs` and `menu_accept_portrait.mjs` carry HARDCODED screen lists
 * (`['opening','home','characters','trophies','shop','settings']`) and both files, plus
 * `docs/TOOLS.md`'s gate table, are owned by other passes. A screen that is not in a
 * battery is a screen nothing checks — so until `lobby` is routed into those lists, this
 * is the battery, and it deliberately measures the things those two structurally cannot:
 *
 *   🚨 `menu_accept_portrait.mjs:416` selects `button:not([disabled])`. **Every disabled
 *   join control on the lobby would therefore get ZERO coverage from its 219 assertions**,
 *   and would be measured for the first time on the day the transport enables them. §L4
 *   below measures them by their own selector.
 *
 * ── THE ROW THIS FILE IS REALLY FOR ────────────────────────────────────────
 * `DECISIONS §74` ships the multiplayer join UI without a transport. `src/net/` is built,
 * tested and inert — no server, no session, and zero files under `src/` import it — so a
 * seat that looks joinable and is not would be the UI-asserts-what-the-model-does-not-do
 * class this project has paid for four times (`DECISIONS §13`'s fictional stat card, the
 * shop's "Epic or better", three menu numbers the model does not compute, and 20 of 34
 * weapon descriptions). §H1 is the assertion that catches it.
 *
 * ── VACUITY, WHICH IS THE FAILURE MODE OF EVERY ROW BELOW ──────────────────
 * `[].every()` is `true`, and that exact shape fired three times in three files in one
 * session here. Every filtered assertion in this file is preceded by a NON-EMPTY check on
 * the set it filters, and every one of those checks is derived from the seat count rather
 * than typed:
 *
 *   * §H1 filters controls to the join-shaped ones. Rename them all and the filtered set
 *     is `[]` and the row passes. → §G2 asserts there are exactly `n - 1` of them FIRST.
 *   * §H5 compares seat names element-wise. A screen that renders no seats passes.
 *     → §G1 asserts `seatRows.length === n` FIRST.
 *   * §L4 measures the disabled set. Same shape. → §G3 asserts it is non-empty FIRST.
 *   * A `?screen=lobby` that silently fell back to home would run every row against home's
 *     DOM and pass most of them. → §G0 asserts `window.__screen === 'lobby'` before any
 *     row runs, and a failure there ABORTS the viewport rather than continuing.
 *   * §H3 asserted only in the off state is a constant with a tick next to it. It is
 *     flipped with `window.__faOpenSeat` and required to move in BOTH directions.
 *
 * ── KNOWN-BAD INPUTS: `--knownbad` ─────────────────────────────────────────
 * A guard that has not been shown to FAIL is not a guard. `--knownbad` mutates the LIVE
 * DOM of a real lobby and requires the named row to go red, then restores and requires it
 * green again — so each row is falsified by a real defect rather than by a fixture, and
 * the restore is the positive control that proves the red was the mutation and not the
 * harness. The source-level mutations that a DOM edit cannot express (`seats: 2`,
 * `parseRoute` reverted) are covered behaviourally instead by §M1/§M5, which read the
 * SHIPPED route object off `window.__shell.route()` after a real navigation.
 *
 * ── RESOLUTION FLOOR ───────────────────────────────────────────────────────
 * Route-shape, navigation and DOM-attribute assertions are **EXACT** — deterministic
 * object/attribute comparison, the same class as draw counts. No floor is quoted for them
 * and none should be. Element boxes are NOT exact: text-driven widths drift ~±2 CSS px
 * between runs on one tree (measured on `.home-mode`, 268 → 266 at 1600×900). So nothing
 * here asserts a text-driven width, and every tap target is checked against a size that
 * comes from CSS.
 *
 * ⚠️ This file states no expected assertion COUNT, and adding one is a gate failure —
 * counts live only in `docs/TOOLS.md`'s gate table (`gatecount.mjs` refuses a second copy
 * even one that agrees).
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { settleScreen, captureSettled } from './settle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] ?? true) : null; };
const SHOTS = arg('shots');
const KNOWNBAD = argv.includes('--knownbad');

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** `menu_accept_portrait`'s three portrait viewports, plus the two landscape extremes. */
const VIEWPORTS = [
  { name: 'portrait-360x800', width: 360, height: 800 },
  { name: 'portrait-390x844', width: 390, height: 844 },
  { name: 'portrait-430x932', width: 430, height: 932 },
  { name: 'desktop-1600x900', width: 1600, height: 900 },
  { name: 'phone-844x390', width: 844, height: 390 },
];

/** The 44px floor, from `theme.ts:--tap`. Sub-pixel slack only — see the drift note. */
const MIN_TAP = 44;
const TAP_SLACK = 0.5;

let pass = 0; let fail = 0;
const failures = [];
function ok(label, cond, evidence = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${evidence ? `  — ${evidence}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}  — ${evidence}`); }
  return !!cond;
}
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`); }

// ─────────────────────────────────────────────────────────────────────────────
// The model side, in Node. `brawl.ts` imports with explicit `.ts` extensions precisely
// so a node gate can load it without a build step — the same reason `sp6_seats.mjs`
// does. Nothing else under `src/ui/**` is reachable from node (they drag in Three.js
// and a module-scope `document.createElement('canvas')`).
// ─────────────────────────────────────────────────────────────────────────────
const B = await import(pathToFileURL(join(ROOT, 'src/ui/screens/brawl.ts')).href);
const R = await import(pathToFileURL(join(ROOT, 'src/game/rules.ts')).href);
const S = await import(pathToFileURL(join(ROOT, 'src/game/state.ts')).href);
const { brawlRoster, seatCountFor, SEAT_CHOICES } = B;
const { CHARACTERS } = R;
const { MIN_FIGHTERS, MAX_FIGHTERS } = S;

/** Text that must never appear on a shipped screen — `home.ts`'s standing rule. */
const SOON_RE = /\b(soon|coming|beta|wip|placeholder|tbd)\b/i;
/**
 * What a "this seat could hold a human" control looks like, by its own words.
 *
 * Deliberately WIDER than the label this build ships, so a rename to `Join`, `Invite`,
 * `Host` or `Waiting for player…` is still caught — a rename that escaped the filter
 * would empty it, which is what §G2 refuses.
 *
 * ⚠️ A bare `player` was tried and REMOVED: the seat-count options are labelled
 * `"3 players"` for screen readers, so it matched five controls that have nothing to do
 * with joining and made §G2's `n - 1` count wrong by construction. A filter that catches
 * the wrong things is the same defect as one that catches nothing — it just fails loudly
 * instead of quietly, which is the only reason it was found.
 */
const JOINISH_RE = /join|invite|online|\bopen\b|friend|\broom\b|\bhost\b|waiting for|another player/i;

/** Everything the page needs to answer a row, read in ONE evaluate per state. */
function readLobby() {
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
      && Number(cs.opacity) > 0.01;
  };
  /**
   * 🚨 A CONTROL INSIDE A SCROLLER IS NOT OUT OF BOUNDS, AND THE FIRST VERSION OF THIS
   * FILE SAID IT WAS. At 844×390 with a simulated notch it reported the 4th seat's
   * control at y=379 as an overflow defect; it was simply below the fold of a legitimate
   * y-scroller. `menu_accept_portrait` tracks scrollers per axis for exactly this reason.
   * A row that cannot tell "clipped" from "scrolled" manufactures a defect, which is as
   * expensive as missing one — so the vertical bound is the SCROLLER's content for these,
   * and §L5 asserts separately that scrolling actually reaches them.
   */
  const scrollerOf = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll/.test(cs.overflowY) && p.scrollHeight - p.clientHeight > 1) return p;
    }
    return null;
  };
  const controls = [...document.querySelectorAll('button, [role="button"], a[href]')]
    .filter(vis)
    .map((e) => {
      const r = e.getBoundingClientRect();
      const sc = scrollerOf(e);
      return {
        text: (e.textContent ?? '').trim(),
        aria: e.getAttribute('aria-label') ?? '',
        title: e.getAttribute('title') ?? '',
        disabled: e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true',
        w: r.width, h: r.height, x: r.x, y: r.y,
        scrolled: sc !== null,
        el: e.getAttribute('data-el') ?? '',
      };
    });
  const seatScroller = document.querySelector('.lobby-seats');
  const scrollInfo = seatScroller
    ? {
      scrollable: seatScroller.scrollHeight - seatScroller.clientHeight > 1,
      box: seatScroller.getBoundingClientRect().toJSON(),
      atBottomLastSeatVisible: (() => {
        seatScroller.scrollTop = seatScroller.scrollHeight;
        const last = seatScroller.lastElementChild;
        if (!last) return false;
        const lr = last.getBoundingClientRect();
        const sr = seatScroller.getBoundingClientRect();
        return lr.bottom <= sr.bottom + 1 && lr.top >= sr.top - 1;
      })(),
    }
    : null;
  if (seatScroller) seatScroller.scrollTop = 0;
  // Disabled controls are read from their OWN selector — `menu_accept_portrait` filters
  // them out by construction, so this is the only place they are measured at all.
  const disabledControls = [...document.querySelectorAll('button[disabled], [aria-disabled="true"]')]
    .filter(vis)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        aria: e.getAttribute('aria-label') ?? '', title: e.getAttribute('title') ?? '',
        text: (e.textContent ?? '').trim(), w: r.width, h: r.height, x: r.x, y: r.y,
      };
    });
  const seats = [...document.querySelectorAll('.lobby-seat')].map((e) => {
    const r = e.getBoundingClientRect();
    return {
      slot: Number(e.getAttribute('data-seat')),
      char: e.getAttribute('data-char') ?? '',
      name: (e.querySelector('[data-el="seat-name"]')?.textContent ?? '').trim(),
      tag: (e.querySelector('.lobby-seat-tag')?.textContent ?? '').trim(),
      w: r.width, h: r.height, x: r.x, y: r.y,
    };
  });
  const opts = [...document.querySelectorAll('.lobby-opt')].map((e) => {
    const r = e.getBoundingClientRect();
    return {
      n: Number(e.getAttribute('data-seats')),
      on: e.getAttribute('aria-pressed') === 'true',
      w: r.width, h: r.height,
    };
  });
  const note = document.querySelector('[data-el="note"]');
  // Every visible text run on the screen, for the "no soon" sweep.
  const texts = [...document.querySelectorAll('.fa-lobby *')]
    .filter((e) => e.children.length === 0 && vis(e))
    .map((e) => (e.textContent ?? '').trim())
    .filter(Boolean);
  const de = document.documentElement;
  return {
    screen: window.__screen,
    controls, disabledControls, seats, opts, texts, scrollInfo,
    noteShown: !!note && !note.hasAttribute('hidden') && (note.textContent ?? '').trim().length > 0,
    noteText: (note?.textContent ?? '').trim(),
    pageScrollX: de.scrollWidth - de.clientWidth,
    pageScrollY: de.scrollHeight - de.clientHeight,
    vw: window.innerWidth, vh: window.innerHeight,
  };
}

/**
 * A page with a transport injected. A SEPARATE page, not `addInitScript` on a shared one:
 * init scripts ACCUMULATE per page and cannot be removed, so a shared page would carry a
 * growing stack of them and the "off" arm would depend on registration order.
 */
async function openerPage(browser, vp = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport: vp });
  await page.addInitScript(() => {
    window.__faOpenSeat = (slot) => { window.__faOpened = slot; };
  });
  return page;
}

async function gotoLobby(page, { seats = null } = {}) {
  // `pointerLock=0` for the same reason `match-play.mjs` passes it: Chromium refuses
  // `requestPointerLock()` unconditionally under automation. It rides through
  // `routeUrl`'s preserve-everything-else rule into the match URL, so the match arm
  // below gets it too without a second navigation.
  await page.goto(`${BASE}/?screen=lobby&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60_000 });
  // 🚨 Wait on the screen's NAME. A reload of a bare `/` re-derives the boot route and
  // lands on `opening`; waiting on "some screen is ready" once made a capture labelled
  // `home` photograph a different screen entirely.
  await page.waitForFunction('window.__screen === "lobby"', null, { timeout: 60_000 });
  await settleScreen(page, { label: 'lobby' });
  if (seats !== null) {
    await page.click(`.lobby-opt[data-seats="${seats}"]`);
    await page.waitForTimeout(60);
  }
  return page.evaluate(readLobby);
}

// ─────────────────────────────────────────────────────────────────────────────
async function auditViewport(page, vp) {
  section(`${vp.name} — the lobby, offline (the shipped state)`);
  const n = 4; // a middle count: exercises "some seats, not all" at every viewport
  const st = await gotoLobby(page, { seats: n });

  // ── §G — THE NON-VACUITY GUARDS. Nothing below runs unless these hold. ──────
  if (!ok('G0. `?screen=lobby` mounted the LOBBY (not a silent fallback to home)',
    st.screen === 'lobby', `__screen=${st.screen}`)) return;
  if (!ok(`G1. exactly ${n} seat rows are rendered — the set §H5 compares is NON-EMPTY`,
    st.seats.length === n, `${st.seats.length} rows`)) return;
  const joinish = st.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`));
  if (!ok(`G2. exactly ${n - 1} join-shaped controls exist — the set §H1 filters is NON-EMPTY`,
    joinish.length === n - 1, `${joinish.length} of ${st.controls.length} controls`)) return;
  if (!ok('G3. the disabled-control set is NON-EMPTY — the set §L4 measures exists',
    st.disabledControls.length > 0, `${st.disabledControls.length} disabled`)) return;

  // ── §H — HONESTY ───────────────────────────────────────────────────────────
  const live = joinish.filter((c) => !c.disabled);
  ok('H1. NO enabled control on this screen leads to online play',
    live.length === 0, live.map((c) => c.aria || c.text).join(' | ') || 'all join controls disabled');

  const unexplained = st.disabledControls.filter(
    (c) => !c.title.trim() || !c.aria.trim() || !/not connected yet/i.test(c.aria));
  ok('H2. every disabled control states its reason on BOTH `title` and `aria-label`',
    unexplained.length === 0,
    unexplained.map((c) => `[${c.aria}|${c.title}]`).join(' ') || `${st.disabledControls.length} explained`);

  ok('H4. no "soon"/"coming"/"placeholder" anywhere in the visible text',
    !st.texts.some((t) => SOON_RE.test(t)),
    st.texts.filter((t) => SOON_RE.test(t)).join(' | ') || `${st.texts.length} runs clean`);

  // §H5 — the seat list IS the match, not a decoration of it. Seat 1 is rolled per
  // mount, so the expected list is recomputed from the two ids the page reports rather
  // than from a literal; the row above already proved the list is the right LENGTH.
  const want = brawlRoster(st.seats[0].char, st.seats[1].char, n);
  ok('H5a. every seat renders a REAL character name from `rules.ts:CHARACTERS`',
    st.seats.every((s) => CHARACTERS[s.char] && s.name === CHARACTERS[s.char].name),
    st.seats.map((s) => `${s.char}:${s.name}`).join(' '));
  ok('H5b. the seat list equals `brawlRoster(player, enemy, n)` ELEMENT-WISE',
    st.seats.map((s) => s.char).join(',') === want.join(','),
    `page [${st.seats.map((s) => s.char).join(',')}] vs node [${want.join(',')}]`);
  ok('H5c. slot 0 is YOU and every other slot says BOT — no seat claims to be a human',
    /\bYou\b/.test(st.seats[0].tag) && st.seats.slice(1).every((s) => /\bBot\b/.test(s.tag)),
    st.seats.map((s) => s.tag).join(' | '));

  // ── §L — LAYOUT ────────────────────────────────────────────────────────────
  // Horizontal bounds apply to EVERY control — `.fa-scroll` is `overflow-x: hidden`, so
  // an x overflow is never legitimate. Vertical bounds apply to the ones outside a
  // scroller; §L5 covers the rest.
  const fixed = st.controls.filter((c) => !c.scrolled);
  ok('L1z. the un-scrolled control set is NON-EMPTY — L1a/L3 are not filtering to nothing',
    fixed.length > 0, `${fixed.length} of ${st.controls.length} outside a scroller`);
  const overflow = st.controls.filter(
    (c) => c.x < -0.5 || c.x + c.w > st.vw + 0.5
      || (!c.scrolled && (c.y < -0.5 || c.y + c.h > st.vh + 0.5)));
  ok('L1a. every control is inside the viewport (scroller children: horizontally)', overflow.length === 0,
    overflow.map((c) => `${c.el || c.aria}@${c.x.toFixed(0)},${c.y.toFixed(0)} ${c.w.toFixed(0)}x${c.h.toFixed(0)}`).join(' '));
  ok('L1b. the page itself does not scroll — content scrolls inside `.fa-scroll`',
    st.pageScrollX <= 0 && st.pageScrollY <= 0, `x${st.pageScrollX} y${st.pageScrollY}`);

  const smallRows = st.seats.filter((s) => s.h < MIN_TAP - TAP_SLACK);
  ok(`L2a. every seat row is at least ${MIN_TAP}px tall`, smallRows.length === 0,
    smallRows.map((s) => `slot${s.slot} ${s.h.toFixed(1)}px`).join(' ')
    || `min ${Math.min(...st.seats.map((s) => s.h)).toFixed(1)}px`);
  const smallOpts = st.opts.filter((o) => o.w < MIN_TAP - TAP_SLACK || o.h < MIN_TAP - TAP_SLACK);
  ok(`L2b. every seat-count option is at least ${MIN_TAP}×${MIN_TAP}`, smallOpts.length === 0,
    smallOpts.map((o) => `${o.n}:${o.w.toFixed(1)}x${o.h.toFixed(1)}`).join(' ')
    || `${st.opts.length} options, min ${Math.min(...st.opts.map((o) => Math.min(o.w, o.h))).toFixed(1)}px`);

  // §L4 — THE ROW `menu_accept_portrait` STRUCTURALLY CANNOT HAVE. Its control census
  // selects `button:not([disabled])`, so the join controls are invisible to it. If they
  // are never measured while off, the first time anyone learns their box is wrong is the
  // day the transport turns them on.
  const badDisabled = st.disabledControls.filter(
    (c) => c.w < MIN_TAP - TAP_SLACK || c.h < MIN_TAP - TAP_SLACK
      || c.x < -0.5 || c.x + c.w > st.vw + 0.5);
  ok('L4. the DISABLED controls are measured too — tap floor and width, by their own selector',
    badDisabled.length === 0,
    badDisabled.map((c) => `${c.w.toFixed(1)}x${c.h.toFixed(1)}@${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' ')
    || `${st.disabledControls.length} disabled controls measured`);

  // §L5 — a scroller is only an acceptable answer if it REACHES. A list that clips its
  // last seat while the header says "Players 4" is the same defect as a wrong number,
  // however correct the overflow rule is.
  ok('L5. the seat list reaches its last seat — clipped is not the same as scrolled',
    st.scrollInfo !== null && st.scrollInfo.atBottomLastSeatVisible,
    st.scrollInfo === null ? 'no seat scroller found'
      : `scrollable=${st.scrollInfo.scrollable} lastSeatVisibleAtBottom=${st.scrollInfo.atBottomLastSeatVisible}`);

  // ── §L3 — the simulated notch. `--fa-safe-*` are declared on :root precisely so this
  // is testable without a device, and it is the same pass `menu_accept` runs.
  await page.evaluate(() => {
    const s = document.documentElement.style;
    s.setProperty('--fa-safe-t', '44px'); s.setProperty('--fa-safe-b', '34px');
    s.setProperty('--fa-safe-l', '48px'); s.setProperty('--fa-safe-r', '48px');
  });
  await page.waitForTimeout(120);
  const notched = await page.evaluate(readLobby);
  const outsideSafe = notched.controls.filter(
    (c) => c.x < 47.5 || c.x + c.w > notched.vw - 47.5
      || (!c.scrolled && (c.y < 43.5 || c.y + c.h > notched.vh - 33.5)));
  ok('L3. every control stays inside a simulated notch/home-indicator',
    outsideSafe.length === 0,
    outsideSafe.map((c) => `${c.el || c.aria}@${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' ')
    || `${notched.controls.length} controls inside 48/44/48/34`);
  await page.evaluate(() => {
    for (const k of ['t', 'r', 'b', 'l']) document.documentElement.style.removeProperty(`--fa-safe-${k}`);
  });

  // ── The WORST case for layout: a full house. Run again at MAX_FIGHTERS, because every
  // number above was taken at 4 and "it fits at four" is not a claim about six.
  const full = await gotoLobby(page, { seats: MAX_FIGHTERS });
  ok(`L6a. ${MAX_FIGHTERS} seats render ${MAX_FIGHTERS} rows`, full.seats.length === MAX_FIGHTERS,
    `${full.seats.length} rows`);
  const fullBad = full.controls.filter(
    (c) => c.x < -0.5 || c.x + c.w > full.vw + 0.5
      || (!c.scrolled && (c.y < -0.5 || c.y + c.h > full.vh + 0.5)));
  ok(`L6b. at ${MAX_FIGHTERS} seats nothing leaves the frame`, fullBad.length === 0,
    fullBad.map((c) => `${c.el || c.aria}@${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' '));
  ok(`L6c. at ${MAX_FIGHTERS} seats the list still reaches its last seat`,
    full.scrollInfo !== null && full.scrollInfo.atBottomLastSeatVisible,
    `scrollable=${full.scrollInfo?.scrollable}`);
  ok(`L6d. at ${MAX_FIGHTERS} seats the page still does not scroll`,
    full.pageScrollX <= 0 && full.pageScrollY <= 0, `x${full.pageScrollX} y${full.pageScrollY}`);

  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.waitForTimeout(150);
    await captureSettled(page, {
      path: join(SHOTS, `lobby6_${vp.name}.png`), label: `lobby6/${vp.name}`, tool: 'lb_accept.mjs',
    });
    await gotoLobby(page, { seats: 4 });
    await page.waitForTimeout(150);
    await captureSettled(page, {
      path: join(SHOTS, `lobby_${vp.name}.png`), label: `lobby/${vp.name}`, tool: 'lb_accept.mjs',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function auditCapabilityBothWays(page, onPage) {
  section('H3. the banner is present IFF there is no transport — BOTH directions');
  const off = await gotoLobby(page, { seats: 3 });
  const on = await gotoLobby(onPage, { seats: 3 });

  ok('H3a. OFFLINE (shipped): the banner is shown and names the state',
    off.noteShown && /not connected yet/i.test(off.noteText), off.noteText.slice(0, 90));
  ok('H3b. OFFLINE: every join control carries `disabled`',
    off.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`)).every((c) => c.disabled));
  // 🚨 THE OTHER DIRECTION. Without it "the banner is there" is a constant, not a
  // measurement — and the whole capability could be a hardcoded `false` with a comment.
  ok('H3c. WITH a transport injected: the banner is GONE',
    !on.noteShown, `note="${on.noteText.slice(0, 40)}"`);
  const onJoin = on.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`));
  ok('H3d. WITH a transport injected: the join controls come ALIVE with no source edit',
    onJoin.length === 2 && onJoin.every((c) => !c.disabled),
    `${onJoin.filter((c) => !c.disabled).length}/${onJoin.length} enabled`);
  ok('H3e. ...and an enabled join control actually CALLS the transport',
    await onPage.evaluate(() => {
      document.querySelector('[data-el="open"]')?.click();
      return window.__faOpened;
    }) === 1, 'slot 1 reported');
}

/** Poll the shipped route until a predicate holds, then return it either way. */
async function pollRoute(page, pred, timeout = 60_000) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeout) {
    // eslint-disable-next-line no-await-in-loop
    last = await page.evaluate(() => (window.__shell ? window.__shell.route() : null)).catch(() => null);
    if (last && pred(last)) return last;
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(150);
  }
  return last;
}

// ─────────────────────────────────────────────────────────────────────────────
async function auditModel(page) {
  section('M. THE MODEL — what the Start button actually navigates with');

  ok('M2. the count control offers exactly `MAX_FIGHTERS - MIN_FIGHTERS + 1` options, DERIVED',
    (await gotoLobby(page)).opts.map((o) => o.n).join(',')
      === SEAT_CHOICES.join(','),
    `SEAT_CHOICES=[${SEAT_CHOICES.join(',')}] from MIN=${MIN_FIGHTERS} MAX=${MAX_FIGHTERS}`);

  for (const n of SEAT_CHOICES) {
    await gotoLobby(page, { seats: n });
    await page.click('[data-el="start"]');
    await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 });
    const got = await page.evaluate(() => ({
      route: window.__shell.route(),
      keys: Object.keys(window.__shell.route()).sort(),
      url: location.search,
    }));
    // 🚨 `2` MUST BE `undefined`, NOT `2`. The duel has ONE path (`brawl.ts`), and that
    // is what keeps it bit-identical to every match this product has ever played.
    const wantSeats = seatCountFor(n);
    ok(`M1. n=${n} navigates with seats=${wantSeats === undefined ? 'undefined' : wantSeats}`,
      got.route.name === 'match' && got.route.seats === wantSeats,
      `route=${JSON.stringify(got.route)}`);
    ok(`M1b. n=${n} — the URL agrees with the route object`,
      wantSeats === undefined
        ? !got.url.includes('seats=')
        : got.url.includes(`seats=${wantSeats}`),
      got.url);
    // M3 — shape equality against a frozen key list, not a subset check. A `level` or a
    // `spawn` sneaking onto the route is the defect; a subset check cannot see an extra.
    ok(`M3. n=${n} — the route carries EXACTLY name/player/enemy/seats (no level, no spawn, no roster)`,
      got.keys.join(',') === 'enemy,name,player,seats', got.keys.join(','));
  }

  section('M5. the shell ROUND-TRIPS `seats` — the Android back button case');
  await gotoLobby(page, { seats: MAX_FIGHTERS });
  await page.click('[data-el="start"]');
  await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 });
  const before = await page.evaluate(() => window.__shell.route());
  await page.goBack();
  await page.waitForFunction('window.__screen === "lobby"', null, { timeout: 60_000 });
  await page.goForward();
  await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 });
  const after = await page.evaluate(() => window.__shell.route());
  ok('M5a. back + forward preserves `seats` (this was RED before the shell fix)',
    after.seats === MAX_FIGHTERS, `${before.seats} → back → forward → ${after.seats}`);
  // The positive control: a field known to survive must also survive, or a green above
  // could mean the round trip never happened.
  ok('M5b. ...and `player` survives too, so M5a is not measuring a no-op navigation',
    after.player === before.player, `${before.player} → ${after.player}`);

  // A reload of the match URL — `routeFromSearch`, the other parse path.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 });
  ok('M5c. a RELOAD of the match URL re-enters the same seat count',
    (await page.evaluate(() => window.__shell.route())).seats === MAX_FIGHTERS);

  // KNOWN-BAD for the parse path: `history.state` outlives the build that wrote it, so
  // an out-of-range `seats` must be REFUSED rather than passed through.
  const BAD = MAX_FIGHTERS + 90;
  await page.evaluate((bad) => {
    const st = { fa: 1, route: { name: 'match', player: 'hamburger', enemy: 'sushi', seats: bad } };
    history.replaceState(st, '', location.href);
    history.pushState({ fa: 1, route: { name: 'home' } }, '', '?screen=home');
    history.back();
  }, BAD);
  const injected = await pollRoute(page, (r) => r.name === 'match' && r.enemy === 'sushi');
  ok('M5d. KNOWN-BAD: an out-of-range `seats` off `history.state` is REFUSED, not honoured',
    injected !== null && injected.enemy === 'sushi' && injected.seats === undefined,
    `injected seats=${BAD} → route ${JSON.stringify(injected)}`);

  section('M6. a lobby that REFUSES TO BUILD must not kill the router');
  // "One bad screen constructor used to kill the router permanently" — `shell.ts` latched
  // `swapping = true` behind an opaque curtain and every later navigation became a silent
  // no-op. That hardening exists; what this proves is that the NEW screen is inside it
  // rather than beside it, using the fault-injection seam already built for the purpose.
  await page.goto(`${BASE}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction('window.__screen === "home"', null, { timeout: 60_000 });
  await page.evaluate(() => { window.__shellFault = { build: 1 }; window.__shell.navigate({ name: 'lobby' }); });
  const fellBack = await pollRoute(page, (r) => r.name === 'home', 20_000);
  ok('M6a. a lobby constructor that THROWS falls back to home rather than a dead curtain',
    fellBack !== null && fellBack.name === 'home', `route=${JSON.stringify(fellBack)}`);
  await page.evaluate(() => { window.__shellFault = null; window.__shell.navigate({ name: 'lobby' }); });
  const recovered = await pollRoute(page, (r) => r.name === 'lobby', 20_000);
  ok('M6b. ...and the router still WORKS afterwards — navigation did not latch',
    recovered !== null && recovered.name === 'lobby'
    && (await page.evaluate(() => document.querySelectorAll('.lobby-seat').length)) >= MIN_FIGHTERS,
    `route=${JSON.stringify(recovered)}`);

  section('M4. source census — pointed at a file that EXISTS and is non-empty');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(join(ROOT, 'src/ui/screens/lobby.ts'), 'utf8');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const clean = strip(src);
  if (ok('M4a. the census FOUND `screens/lobby.ts` and it is non-trivial',
    clean.length > 2000, `${clean.length} chars after comment strip`)) {
    ok('M4b. the lobby never mentions a spawn — placement stays `src/arena/**`\'s truth',
      !/\bspawn\b/.test(clean));
    ok('M4c. the lobby does not import `net/lobby.ts` — no second seat vocabulary, and no'
      + ' `LobbySeat.level`, which would be a second place levels are set',
      !/from '.*net\//.test(clean) && !/LobbySeat/.test(clean));
    ok('M4d. the bot level is CALLED, not echoed — `enemyLevelFor` appears and is invoked',
      /enemyLevelFor\(/.test(clean));
    ok('M4e. the seat range is IMPORTED, never retyped — `SEAT_CHOICES`/`seatCountFor` from `brawl.ts`',
      /SEAT_CHOICES/.test(clean) && /seatCountFor\(/.test(clean)
      && !/\[\s*2\s*,\s*3\s*,\s*4\s*,\s*5\s*,\s*6\s*\]/.test(clean));
    // ⚠️ NOT "no Math.random". The lobby rolls seat 1 exactly as the duel path does; what
    // matters is that there is ONE roll and it is that one, and that `brawl.ts` — the
    // file the whole seat rule lives in — still has none.
    const rolls = clean.match(/Math\.random/g) ?? [];
    ok('M4f. exactly ONE `Math.random` in the lobby, and it is seat 1',
      rolls.length === 1 && /function pickOpponent[\s\S]{0,200}Math\.random/.test(clean),
      `${rolls.length} occurrence(s)`);
    const brawlSrc = strip(readFileSync(join(ROOT, 'src/ui/screens/brawl.ts'), 'utf8'));
    ok('M4g. ...and `brawl.ts` still has NONE — the field rule stays deterministic',
      !/Math\.random/.test(brawlSrc));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KNOWN-BAD INPUTS. Each mutates the LIVE DOM of a real lobby, requires the named row to
// go RED, restores, and requires it GREEN again. The restore is the positive control: a
// row that stays red after the restore was never measuring the mutation.
// ─────────────────────────────────────────────────────────────────────────────
async function auditKnownBad(page) {
  section('KNOWN-BAD — every row above, falsified by a real defect');
  const n = 4;

  const rows = {
    G1: (st) => st.seats.length === n,
    G2: (st) => st.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`)).length === n - 1,
    H1: (st) => st.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`)).every((c) => c.disabled),
    H2: (st) => st.disabledControls.every(
      (c) => c.title.trim() && c.aria.trim() && /not connected yet/i.test(c.aria)),
    H4: (st) => !st.texts.some((t) => SOON_RE.test(t)),
    H5b: (st) => st.seats.length >= 2
      && st.seats.map((s) => s.char).join(',')
        === brawlRoster(st.seats[0].char, st.seats[1].char, st.seats.length).join(','),
    H5a: (st) => st.seats.every((s) => CHARACTERS[s.char] && s.name === CHARACTERS[s.char].name),
    L2a: (st) => st.seats.every((s) => s.h >= MIN_TAP - TAP_SLACK),
  };

  const MUTATIONS = [
    ['drop `disabled` from one join control', 'H1',
      () => document.querySelector('[data-el="open"]').removeAttribute('disabled'),
      () => document.querySelector('[data-el="open"]').setAttribute('disabled', '')],
    ['relabel every join control so the FILTER empties (the vacuity case)', 'G2',
      () => document.querySelectorAll('[data-el="open"]').forEach((e, i) => {
        e.dataset.lbAria = e.getAttribute('aria-label'); e.dataset.lbTitle = e.getAttribute('title');
        e.setAttribute('aria-label', `seat ${i}`); e.setAttribute('title', 'seat');
      }),
      () => document.querySelectorAll('[data-el="open"]').forEach((e) => {
        e.setAttribute('aria-label', e.dataset.lbAria); e.setAttribute('title', e.dataset.lbTitle);
      })],
    ['blank a join control\'s `title`', 'H2',
      () => { const e = document.querySelector('[data-el="open"]'); e.dataset.lbTitle = e.getAttribute('title'); e.setAttribute('title', ''); },
      () => { const e = document.querySelector('[data-el="open"]'); e.setAttribute('title', e.dataset.lbTitle); }],
    ['strip the reason out of a join control\'s `aria-label`', 'H2',
      () => { const e = document.querySelector('[data-el="open"]'); e.dataset.lbAria = e.getAttribute('aria-label'); e.setAttribute('aria-label', 'Open to a player'); },
      () => { const e = document.querySelector('[data-el="open"]'); e.setAttribute('aria-label', e.dataset.lbAria); }],
    // ⚠️ WAS `e.textContent = 'Taco'`, and it went GREEN — because seat 1 is rolled per
    // mount, so on the runs where slot 2 genuinely IS Taco the "mutation" changed
    // nothing. A known-bad planted where the bug cannot express itself, which is the
    // exact trap `CLAUDE.md` rule 6 records firing three times in one session. It now
    // writes ANOTHER SEAT's name over this one — a real character name in the wrong seat,
    // which is precisely the decorative-list defect — and that can never be a no-op
    // because `brawlRoster` guarantees the roster is distinct.
    ['render a seat with another seat\'s name — a decorative list', 'H5a',
      () => {
        const a = document.querySelector('.lobby-seat[data-seat="1"] [data-el="seat-name"]');
        const e = document.querySelector('.lobby-seat[data-seat="2"] [data-el="seat-name"]');
        e.dataset.lbT = e.textContent; e.textContent = a.textContent;
      },
      () => { const e = document.querySelector('.lobby-seat[data-seat="2"] [data-el="seat-name"]'); e.textContent = e.dataset.lbT; }],
    ['reorder the seat list — slot order IS placement', 'H5b',
      () => { const l = document.querySelector('.lobby-seats'); l.insertBefore(l.children[3], l.children[1]); },
      () => { const l = document.querySelector('.lobby-seats'); l.insertBefore(l.children[1], l.children[3].nextSibling); }],
    ['drop a seat row so the compared set shrinks', 'G1',
      () => { const l = document.querySelector('.lobby-seats'); l.dataset.lbHeld = ''; l.lastElementChild.remove(); },
      null],
    ['add a "coming soon" run', 'H4',
      () => { const p = document.createElement('p'); p.id = 'lb-soon'; p.textContent = 'Coming soon'; document.querySelector('.lobby-body').appendChild(p); },
      () => document.getElementById('lb-soon').remove()],
    ['shrink a seat row below the 44px tap floor', 'L2a',
      () => { const e = document.querySelector('.lobby-seat'); e.style.minHeight = '40px'; e.style.height = '40px'; },
      () => { const e = document.querySelector('.lobby-seat'); e.style.minHeight = ''; e.style.height = ''; }],
  ];

  for (const [name, row, mutate, restore] of MUTATIONS) {
    await gotoLobby(page, { seats: n });
    const clean = await page.evaluate(readLobby);
    if (!rows[row](clean)) { ok(`KNOWN-BAD control: §${row} is GREEN before "${name}"`, false, 'row already red'); continue; }
    await page.evaluate(mutate);
    await page.waitForTimeout(60);
    const broken = await page.evaluate(readLobby);
    ok(`KNOWN-BAD: "${name}" is CAUGHT by §${row}`, !rows[row](broken),
      // Evidence on BOTH outcomes: a known-bad that goes green with no evidence line is
      // indistinguishable from one that was never applied.
      `seats=[${broken.seats.map((s) => `${s.char}:${s.name}`).join(' ')}]`
      + ` joinish=${broken.controls.filter((c) => JOINISH_RE.test(`${c.text} ${c.aria}`)).length}`);
    if (restore) {
      await page.evaluate(restore);
      await page.waitForTimeout(60);
      const fixed = await page.evaluate(readLobby);
      ok(`  ...and §${row} goes GREEN again once it is undone (the red was the mutation)`, rows[row](fixed));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ args: LAUNCH_ARGS });
console.log(`\nlb_accept · ${BASE}${KNOWNBAD ? ' · KNOWN-BAD' : ''}\n`);
try {
  if (KNOWNBAD) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await auditKnownBad(page);
  } else {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      await auditViewport(page, vp);
      ok(`${vp.name}: no page errors and no console errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const onPage = await openerPage(browser);
    await auditCapabilityBothWays(page, onPage);
    await onPage.close();
    await auditModel(page);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(78)}`);
console.log(fail === 0 ? `lb_accept: ✅ ${pass} passed` : `lb_accept: ❌ ${fail} FAILED of ${pass + fail}`);
if (fail) for (const f of failures) console.log(`   ✗ ${f}`);
process.exit(fail === 0 ? 0 : 1);
