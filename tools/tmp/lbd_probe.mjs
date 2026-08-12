#!/usr/bin/env node
/**
 * LBD_PROBE — the two measurements the LOBBY DESIGN rests on, taken before any code.
 *
 * `DECISIONS §74` withdrew §66's "no player can reach it" default and asked for a lobby
 * screen. Two of the design's load-bearing claims are things I read off source and CSS,
 * and this project's record is that reading CSS and reading a rendered frame are
 * different measurements (`CLAUDE.md` rule 3). So both are measured:
 *
 *   §A  WHERE CAN AN AFFORDANCE LIVE ON HOME, IN PORTRAIT?
 *       `home.ts:2124` is `@media (max-width: 700px) { .fa-home .home-mode {
 *       display: none } }`, and `.home-col` (both flanks) goes with it. If that is
 *       really what renders, then the footer's mode block — which is where the
 *       reference plate puts a mode selector, immediately left of the primary CTA —
 *       is INVISIBLE on every phone in `menu_accept_portrait`'s viewport set, i.e. in
 *       the orientation `DECISIONS §74` says Uri actually plays in.
 *
 *   §B  DOES A SEAT COUNT SURVIVE THE ROUTER?
 *       `shell.ts` writes `history.state = { fa: 1, route }` (so `seats` IS stored) but
 *       `parseRoute()` reconstructs only `{ name, player, enemy }` and `routeUrl()`
 *       writes only `screen`/`player`/`enemy`. So a Back into a match should come back
 *       with `seats` GONE. If true, a lobby that navigates with `seats` set produces a
 *       six-player match that silently becomes a duel on the hardware Back button —
 *       which on Android is a button players press constantly.
 *
 * ── VALIDATED AGAINST KNOWN-BAD INPUTS (CLAUDE.md rule 6) ───────────────────
 * Every row here has a companion that must come out the OTHER way, because both
 * measurements are of the shape "X is absent", and "absent" is what a broken probe
 * reports too:
 *
 *   §A  the census must find `[data-el="start"]` VISIBLE in the same pass that finds
 *       `.home-mode` hidden — one selector list, one page, one evaluate. A census that
 *       reports everything hidden has found nothing.
 *   §A  and it must find `.home-mode` VISIBLE at a landscape viewport, so the row is a
 *       measurement of the BREAKPOINT and not of the element.
 *   §B  the seats round-trip is run TWICE: once with `?seats=6` and once without. The
 *       no-seats arm must report `seats: undefined` at BOTH ends — otherwise the
 *       detector is just "seats is always undefined" and proves nothing.
 *
 * ⚠️ **NO SIM, NO HUD, NO FIGHTER COUNT.** `src/ui/hud.ts` is peer-owned and dirty in
 * the working tree right now, so `.hud-fighter` (which `sp6_play.mjs` counts) would be
 * measuring a peer's half-saved file. §B reads `window.__shell.route()` — `shell.ts`,
 * `main.ts` and `brawl.ts` are all clean — and never boots a match to `__gameReady`.
 *
 * ⚠️ **RUN IT ON A DETACHED WORKTREE, NOT THE WORKING TREE.** `AGENT-BRIEF` §3.
 *
 *   git worktree add --detach /tmp/fa-lbd <sha>
 *   ln -s "$PWD/node_modules" /tmp/fa-lbd/node_modules
 *   ln -s "$PWD/reference"    /tmp/fa-lbd/reference
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-lbd -- node tools/tmp/lbd_probe.mjs --url '{URL}'
 */

import { chromium } from 'playwright';

const argUrl = (() => {
  const i = process.argv.indexOf('--url');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const BASE = argUrl ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) {
  console.error('lbd_probe: no --url and no PREVIEW_BASE. Run under sx_snap.mjs; never :5173.');
  process.exit(2);
}

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const rows = [];
let fails = 0;
function ok(section, name, pass, detail = '') {
  rows.push({ section, name, pass, detail });
  if (!pass) fails++;
}

/** Wait for a named screen to be mounted and past the curtain. `__screenReady` is not a
 *  paint (AGENT-BRIEF §3) but it IS the router's own "the swap finished" flag, which is
 *  the only thing §B asks about. §A additionally waits on `__previewReady`. */
async function waitScreen(page, name, { painted = false } = {}) {
  await page.waitForFunction(
    ([n, p]) => window.__screen === n && window.__screenReady === true
      && (!p || window.__previewReady === true),
    [name, painted],
    { timeout: 60_000 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// §A — the portrait visibility census on home
// ─────────────────────────────────────────────────────────────────────────────

/** Runs in the page. Returns, for each candidate host, whether it renders at all. */
function CENSUS() {
  const out = {};
  const probe = (key, sel) => {
    const el = document.querySelector(sel);
    if (!el) { out[key] = { present: false, visible: false, w: 0, h: 0 }; return; }
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out[key] = {
      present: true,
      visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0,
      display: s.display,
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  };
  probe('mode', '.fa-home .home-mode');
  probe('modeName', '.fa-home .home-mode-name');
  probe('modeSub', '.fa-home .home-mode-sub');
  probe('start', '.fa-home [data-el="start"]');
  probe('bottom', '.fa-home .home-bottom');
  probe('flankLeft', '.fa-home .home-progress');
  probe('flankRight', '.fa-home .home-fighter');
  probe('tabs', '.fa-home .fa-tabs');
  probe('gear', '.fa-home [data-el="settings"]');
  probe('stage', '.fa-home .home-stage');
  out.tabCount = document.querySelectorAll('.fa-home .fa-tab').length;
  // Every control the player can actually press on this screen, with its box — the set
  // a new affordance has to fit into without pushing anything out of the frame.
  out.controls = [...document.querySelectorAll('.fa-home button, .fa-home [role="button"]')]
    .filter((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        cls: String(el.className).split(' ')[0],
        el: el.dataset.el ?? el.dataset.go ?? '',
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top),
      };
    });
  out.vw = document.documentElement.clientWidth;
  out.vh = document.documentElement.clientHeight;
  // The free vertical band between the bottom of the top bar and the top of the footer,
  // which is what a seat list would have to live in if it lives on home at all.
  const bar = document.querySelector('.fa-home .fa-topbar');
  const foot = document.querySelector('.fa-home .home-bottom');
  out.band = bar && foot
    ? Math.round(foot.getBoundingClientRect().top - bar.getBoundingClientRect().bottom)
    : null;
  return out;
}

const VIEWPORTS = [
  { name: 'portrait-390x844', width: 390, height: 844, portrait: true },   // §74's capture shape
  { name: 'portrait-360x800', width: 360, height: 800, portrait: true },   // narrowest Android
  { name: 'portrait-430x932', width: 430, height: 932, portrait: true },   // Pro Max
  { name: 'landscape-1600x900', width: 1600, height: 900, portrait: false },
  { name: 'landscape-844x390', width: 844, height: 390, portrait: false }, // phone, rotated
];

async function sectionA(browser) {
  const census = {};
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 60_000 });
    await waitScreen(page, 'home', { painted: true });
    census[vp.name] = await page.evaluate(CENSUS);
    await ctx.close();
  }

  // The instrument must be able to say VISIBLE. If every row reads hidden the census has
  // found nothing and the headline below would be an artefact of a broken probe.
  const startVisibleEverywhere = VIEWPORTS.every((v) => census[v.name].start.visible);
  ok('A', 'CONTROL: the primary CTA is visible at ALL FIVE viewports (the census can say VISIBLE)',
    startVisibleEverywhere,
    VIEWPORTS.map((v) => `${v.name}:${census[v.name].start.visible ? 'y' : 'n'}`).join(' '));

  // The headline.
  const portraits = VIEWPORTS.filter((v) => v.portrait);
  const modeHiddenPortrait = portraits.every((v) => !census[v.name].mode.visible);
  ok('A', 'HEADLINE: `.home-mode` is NOT RENDERED on any portrait phone',
    modeHiddenPortrait,
    portraits.map((v) => `${v.name}:display=${census[v.name].mode.display ?? '-'}`).join(' '));

  // ...and the same element IS rendered in landscape, so the row above measures the
  // BREAKPOINT rather than the element. Without this the finding is vacuous.
  const modeShownLandscape = census['landscape-1600x900'].mode.visible;
  ok('A', 'CONTROL: the same `.home-mode` IS rendered at 1600x900 (so §A measures the breakpoint)',
    modeShownLandscape,
    `1600x900 ${census['landscape-1600x900'].mode.w}x${census['landscape-1600x900'].mode.h}`);

  // The rotated-phone case: the mode block survives but its SECOND LINE does not
  // (`home.ts:1991`, `@media (max-height: 460px)`). So the footer copy is not durable in
  // either phone orientation.
  ok('A', 'the mode SUBLINE is gone at 844x390 too — the footer copy is not durable on a phone',
    !census['landscape-844x390'].modeSub.visible,
    `844x390 name=${census['landscape-844x390'].modeName.visible ? 'y' : 'n'} `
    + `sub=${census['landscape-844x390'].modeSub.visible ? 'y' : 'n'}`);

  const flanksHidden = portraits.every((v) =>
    !census[v.name].flankLeft.visible && !census[v.name].flankRight.visible);
  ok('A', 'both flanks are hidden in portrait — home has no side rail to host a seat list',
    flanksHidden,
    portraits.map((v) => `${v.name}:L${census[v.name].flankLeft.visible ? 1 : 0}R${census[v.name].flankRight.visible ? 1 : 0}`).join(' '));

  for (const v of VIEWPORTS) {
    const c = census[v.name];
    ok('A', `inventory ${v.name}`, true,
      `${c.controls.length} visible controls · ${c.tabCount} tabs · free band ${c.band}px`);
  }

  return census;
}

// ─────────────────────────────────────────────────────────────────────────────
// §B — does `seats` survive the router?
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One arm: boot the match route (with or without `?seats=`), read the route, navigate to
 * home, press Back, read the route again.
 *
 * ⚠️ Match is NOT waited to `__gameReady` — `__screen === 'match'` plus `__screenReady`
 * is the router's own statement that the route mounted, which is the whole question, and
 * booting a real sim would drag in `hud.ts`, which a peer is mid-edit in.
 */
async function seatsRoundTrip(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=donut&pointerLock=0${query}`,
    { waitUntil: 'networkidle', timeout: 60_000 });
  await waitScreen(page, 'match');

  const before = await page.evaluate(() => ({
    route: window.__shell.route(),
    search: location.search,
    state: history.state,
  }));

  // Leave, then come back the way a player does.
  await page.evaluate(() => window.__shell.navigate({ name: 'home' }));
  await waitScreen(page, 'home');
  await page.goBack();
  await waitScreen(page, 'match');

  const after = await page.evaluate(() => ({
    route: window.__shell.route(),
    search: location.search,
    state: history.state,
  }));

  await ctx.close();
  return { before, after, errs };
}

/**
 * The arm that actually models the LOBBY: no `seats` anywhere in the boot URL, the route
 * is set by a SCREEN calling `navigate()`. This is the case the affordance produces and
 * it is not the same as the QA-parameter case — `routeUrl()` copies the current
 * `location.search` forward, so `?seats=6` in the boot URL is preserved by accident,
 * while a navigate-supplied `seats` was never in the URL to preserve.
 */
async function lobbyShapedNav(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/?screen=home&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60_000 });
  await waitScreen(page, 'home', { painted: true });

  await page.evaluate(() =>
    window.__shell.navigate({ name: 'match', player: 'hamburger', enemy: 'donut', seats: 6 }));
  await waitScreen(page, 'match');
  const before = await page.evaluate(() => ({
    route: window.__shell.route(), search: location.search, state: history.state,
  }));

  await page.evaluate(() => window.__shell.navigate({ name: 'home' }));
  await waitScreen(page, 'home');
  await page.goBack();
  await waitScreen(page, 'match');
  const after = await page.evaluate(() => ({
    route: window.__shell.route(), search: location.search, state: history.state,
  }));

  // ...and what a RELOAD of that URL boots, which is the other way a player re-enters.
  await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
  await waitScreen(page, 'match');
  const reloaded = await page.evaluate(() => ({
    route: window.__shell.route(), search: location.search,
  }));

  await ctx.close();
  return { before, after, reloaded, errs };
}

async function sectionB(browser) {
  const six = await seatsRoundTrip(browser, '&seats=6');
  const duel = await seatsRoundTrip(browser, '');
  const lobby = await lobbyShapedNav(browser);

  ok('B', 'CONTROL: `?seats=6` is honoured on the FIRST mount (the flag works at all)',
    six.before.route.seats === 6, `route.seats=${JSON.stringify(six.before.route.seats)}`);

  ok('B', 'HEADLINE: after ONE Back, `route.seats` is GONE — a 6-seat match returns as a duel',
    six.after.route.seats === undefined,
    `before=${JSON.stringify(six.before.route.seats)} after=${JSON.stringify(six.after.route.seats)}`);

  // ⚠️ WAS: `'the URL never carried it: routeUrl() writes screen/player/enemy only'`,
  // asserting `!/[?&]seats=/` on the search string. **It failed, and the assertion was
  // wrong, not the code.** `routeUrl()` seeds itself from `new URLSearchParams(
  // window.location.search)` and only OVERWRITES `screen`/`player`/`enemy`, so a `seats`
  // that arrived as a boot parameter is preserved forward exactly like `simSpeed` and
  // `fogRadius` — which `shell.ts`'s header says is deliberate and load-bearing for the
  // tool suite. The old wording is kept per CLAUDE.md's rule on reversed assertions,
  // because the correction is the finding: the seat count was sitting in BOTH the URL and
  // `history.state` and `parseRoute()` discarded it anyway.
  ok('B', 'the boot URL PRESERVES `seats` across the round trip (routeUrl copies unknown params)',
    /[?&]seats=6/.test(six.before.search) && /[?&]seats=6/.test(six.after.search),
    `before "${six.before.search}" → after "${six.after.search}"`);

  const storedBefore = six.before.state?.route?.seats;
  ok('B', '`history.state` carried it at BOTH ends — the sole loss is `parseRoute()`',
    storedBefore === 6 && six.after.state?.route?.seats === 6,
    `history.state.route.seats before=${JSON.stringify(storedBefore)} `
    + `after=${JSON.stringify(six.after.state?.route?.seats)}`);

  // The vacuity control. Without this arm, "seats is undefined after Back" is equally
  // consistent with a probe that can only ever read undefined.
  ok('B', 'CONTROL: the no-seats arm reads `undefined` at BOTH ends (the detector is not stuck)',
    duel.before.route.seats === undefined && duel.after.route.seats === undefined,
    `before=${JSON.stringify(duel.before.route.seats)} after=${JSON.stringify(duel.after.route.seats)}`);

  // ── The lobby-shaped arm ────────────────────────────────────────────────────
  ok('B', 'LOBBY ARM: `navigate({…, seats: 6})` mounts with the seat count intact',
    lobby.before.route.seats === 6, `route.seats=${JSON.stringify(lobby.before.route.seats)}`);

  ok('B', 'LOBBY ARM: and the seat count is ABSENT FROM THE URL — nothing to fall back on',
    !/[?&]seats=/.test(lobby.before.search), `search "${lobby.before.search}"`);

  ok('B', 'LOBBY ARM HEADLINE: after Back the seat count is gone AND unrecoverable',
    lobby.after.route.seats === undefined && !/[?&]seats=/.test(lobby.after.search),
    `route.seats=${JSON.stringify(lobby.after.route.seats)} search "${lobby.after.search}"`);

  ok('B', 'LOBBY ARM: a RELOAD of that URL also comes back as a duel',
    lobby.reloaded.route.seats === undefined,
    `route.seats=${JSON.stringify(lobby.reloaded.route.seats)} search "${lobby.reloaded.search}"`);

  ok('B', 'no page errors on any arm',
    six.errs.length === 0 && duel.errs.length === 0 && lobby.errs.length === 0,
    [...six.errs, ...duel.errs, ...lobby.errs].slice(0, 2).join(' | '));

  return { six, duel, lobby };
}

// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  // A fresh snapshot's first client eats a dep-optimisation reload (AGENT-BRIEF §3).
  const warm = await browser.newPage();
  await warm.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 60_000 })
    .catch(() => {});
  await warm.close();

  const census = await sectionA(browser);
  const trip = await sectionB(browser);

  let last = '';
  for (const r of rows) {
    if (r.section !== last) { console.log(`\n── §${r.section} ${'─'.repeat(60)}`); last = r.section; }
    console.log(`${r.pass ? '  ok  ' : ' FAIL '} ${r.name}${r.detail ? `\n         ${r.detail}` : ''}`);
  }
  console.log(`\n${rows.length - fails}/${rows.length} rows passed, ${fails} failed.`);
  if (process.argv.includes('--json')) {
    console.log('\nJSON\n' + JSON.stringify({ base: BASE, rows, census, trip }, null, 2));
  }
} finally {
  await browser.close();
}
process.exit(fails === 0 ? 0 : 1);
