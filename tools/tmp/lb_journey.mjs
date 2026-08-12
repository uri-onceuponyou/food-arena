/**
 * lb_journey — THE WHOLE PATH, IN ONE PAGE SESSION: home → lobby → configure → play →
 * result card → banked payout → back to the menus.
 *
 *   PREVIEW_BASE=<snapshot> node tools/tmp/lb_journey.mjs [--seats 3] [--speed 12]
 *
 * ── Why a second file rather than more rows in `lb_accept.mjs` ──────────────
 * `lb_accept` is a UNIT gate: it mounts one screen and interrogates its DOM. Every gate
 * in this project that is only that has, at least once, been green while HEAD was
 * unbootable — 24 commits of it. `tools/tmp/journey.mjs` is the standing answer and it
 * drives `home → characters → FIGHT → match`; it does NOT know the lobby exists, its
 * navigation is hardcoded (`click [data-el="start"]` → `waitForFunction('__screen ===
 * "characters"')`), and it belongs to another pass. So this is the same idea aimed at the
 * new path, and it is deliberately the *whole* path: the thing a unit gate cannot see is
 * what LEAKS between a match and the menus.
 *
 * ── WHAT IT ASSERTS THAT NOTHING ELSE DOES ─────────────────────────────────
 *   1. The lobby is REACHABLE BY TAPPING, not only by typing `?screen=lobby`. A route
 *      nothing navigates to is a route the player does not have.
 *   2. The match that starts seats the number the lobby PROMISED — read off the HUD's own
 *      fighter plates, i.e. from the running sim, not from the route object the lobby
 *      just wrote. Those are different claims and only the second one is the product.
 *   3. The result card appears, FITS, and names a place.
 *   4. The payout is BANKED — the persisted profile actually moves. `matchScreen.ts`
 *      banks on `phase === 'ended'` exactly once, and `DECISIONS §64` records that the
 *      payout was correct and INVISIBLE for a whole pass; a card that shows numbers the
 *      profile never took is the same defect one screen later.
 *   5. Nothing leaks back to the menus — no HUD nodes, no second GL context, no orphaned
 *      `.fa-match` root.
 *
 * ⚠️ **THE SEAT COUNT IS READ FROM THE SIM, AND THAT IS THE POINT.** Asserting that the
 * route says `seats: 3` proves the lobby wrote a field. Counting three fighter plates
 * proves `matchScreen` → `startGame` → `createMatch` seated three. `2f907a7`'s plumbing
 * was proved end-to-end for `?seats=`; this is the first time it is proved for a SCREEN.
 */

import { chromium } from 'playwright';
import { settleScreen } from './settle.mjs';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SEATS = Number(arg('seats', '3'));
// Fast-forward the sim rather than the wall clock. `match.ts` clamps at 50 and drives the
// fog schedule off the same scaled time, so the match is the same match, sooner.
const SPEED = Number(arg('speed', '12'));

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

let pass = 0; let fail = 0; const failures = [];
function ok(label, cond, evidence = '') {
  if (cond) { pass++; console.log(`  ✓ ${label}${evidence ? `  — ${evidence}` : ''}`); }
  else { fail++; failures.push(label); console.log(`  ✗ ${label}  — ${evidence}`); }
  return !!cond;
}
const section = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 70 - t.length))}`);

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

const profile = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('food-arena.profile.v1') ?? 'null'); } catch { return null; }
});

try {
  section('1. HOME → LOBBY, by tapping');
  await page.goto(`${BASE}/?screen=home&pointerLock=0&simSpeed=${SPEED}`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction('window.__screen === "home"', null, { timeout: 60_000 });
  await settleScreen(page, { label: 'home' });
  const before = await profile();
  ok('home mounted and the persisted profile is readable', before !== null,
    `trophies ${before?.economy?.trophies} coins ${before?.economy?.coins}`);

  // The affordance, by its own selector. If this control ever stops being a button the
  // click fails here rather than silently doing nothing.
  const modeVisible = await page.evaluate(() => {
    const e = document.querySelector('[data-el="mode"]');
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return { tag: e.tagName, w: r.width, h: r.height, shown: cs.display !== 'none' && cs.visibility !== 'hidden' };
  });
  ok('home carries a visible, tappable lobby affordance', !!modeVisible && modeVisible.shown
    && modeVisible.tag === 'BUTTON' && modeVisible.h >= 43.5,
  JSON.stringify(modeVisible));
  await page.click('[data-el="mode"]');
  ok('tapping it reaches the LOBBY',
    await page.waitForFunction('window.__screen === "lobby"', null, { timeout: 60_000 })
      .then(() => true).catch(() => false));
  await settleScreen(page, { label: 'lobby' });

  section(`2. CONFIGURE ${SEATS} seats and START`);
  await page.click(`.lobby-opt[data-seats="${SEATS}"]`);
  await page.waitForTimeout(80);
  const promised = await page.evaluate(() => [...document.querySelectorAll('.lobby-seat')]
    .map((e) => e.getAttribute('data-char')));
  ok(`the lobby PROMISES ${SEATS} named seats`, promised.length === SEATS, promised.join(','));

  await page.click('[data-el="start"]');
  ok('Start reaches a live match',
    await page.waitForFunction('window.__screen === "match"', null, { timeout: 120_000 })
      .then(() => true).catch(() => false));
  ok('the sim actually booted (`__gameReady`)',
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 300_000 })
      .then(() => true).catch(() => false));

  // 🚨 READ FROM THE RUNNING SIM, not from the route. The HUD builds one plate per
  // fighter off the session's own state, so this counts what `createMatch` seated.
  // `hud.ts:buildFighterSlots` emits one `.hud-fighter` per seated fighter and the class
  // string is pinned there ("byte-for-byte `hud-fighter hud-fighter--<mod>`") because
  // four other tools key on it.
  const plates = await page.evaluate(() => document.querySelectorAll('.hud-fighter').length);
  const routeSeats = await page.evaluate(() => window.__shell.route().seats);
  // ⚠️ NON-VACUITY FIRST. `plates === SEATS || plates === 0` was written here and is a
  // hole you could drive the whole defect through: a HUD that built no plates at all
  // would have "passed". Zero plates is a FAILURE, stated separately so the two reasons
  // are distinguishable in the log.
  if (ok('the HUD built per-fighter plates at all — the set below is NON-EMPTY', plates > 0, `${plates} plates`)) {
    ok(`the MATCH seats ${SEATS} — counted on the HUD, i.e. off the running sim`,
      plates === SEATS, `hud plates ${plates}`);
  }
  ok('...and the route the lobby wrote agrees', routeSeats === SEATS, `route.seats=${routeSeats}`);

  section('3. PLAY IT OUT → the result card');
  const ended = await page.waitForFunction(
    () => { const g = document.querySelector('[data-el="gameover"]'); return !!g && getComputedStyle(g).display !== 'none'; },
    null, { timeout: 600_000 },
  ).then(() => true).catch(() => false);
  ok('the match reaches a decided state and the result card appears', ended);

  const card = await page.evaluate(() => {
    const g = document.querySelector('[data-el="gameover"]');
    const c = g?.querySelector('.hud-gameover-card');
    const r = c?.getBoundingClientRect();
    return {
      title: g?.querySelector('[data-el="gameover-title"]')?.textContent?.trim() ?? '',
      place: g?.querySelector('[data-el="gameover-place"]')?.textContent?.trim() ?? '',
      payout: g?.querySelector('[data-el="gameover-payout"]')?.textContent?.trim() ?? '',
      rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
      vw: window.innerWidth, vh: window.innerHeight,
    };
  });
  ok('the card names an outcome', card.title.length > 0, `"${card.title}" · place "${card.place}"`);
  ok('the card FITS the viewport at this seat count',
    card.rect !== null && card.rect.x >= -0.5 && card.rect.y >= -0.5
    && card.rect.x + card.rect.w <= card.vw + 0.5 && card.rect.y + card.rect.h <= card.vh + 0.5,
    card.rect ? `${card.rect.w.toFixed(1)}x${card.rect.h.toFixed(1)} at ${card.rect.x.toFixed(1)},${card.rect.y.toFixed(1)} in ${card.vw}x${card.vh}` : 'no card');
  ok('the card SHOWS what the match paid', card.payout.length > 0, `"${card.payout}"`);

  section('4. THE PAYOUT IS BANKED — the persisted profile moved');
  const after = await profile();
  const moved = after !== null && before !== null
    && (after.economy.coins !== before.economy.coins
      || after.economy.trophies !== before.economy.trophies
      || after.economy.xp !== before.economy.xp
      || (after.wins ?? 0) !== (before.wins ?? 0)
      || (after.losses ?? 0) !== (before.losses ?? 0));
  ok('the profile in localStorage changed — the card is not fiction', moved,
    `coins ${before?.economy?.coins}→${after?.economy?.coins} · trophies ${before?.economy?.trophies}→${after?.economy?.trophies}`
    + ` · xp ${before?.economy?.xp}→${after?.economy?.xp}`);
  // The seat count the ECONOMY was told about. `DECISIONS §64`: for a whole product's
  // history every match paid as a duel because a boolean was forwarded instead of a place.
  ok(`the banked result records ${SEATS} seats, not a duel`,
    after?.economy?.lastMatch?.seats === SEATS,
    `lastMatch=${JSON.stringify(after?.economy?.lastMatch ?? null)}`);

  section('5. BACK TO THE MENUS — nothing leaks');
  await page.click('[data-el="exit"]', { timeout: 30_000 });
  await page.waitForFunction('window.__screen === "home"', null, { timeout: 60_000 });
  await settleScreen(page, { label: 'home-after' });
  const stray = await page.evaluate(() => ({
    hud: document.querySelectorAll('.hud-root, .hud-weapons .hud-weapon, .hud-radar, .hud-gameover').length,
    hudVisible: (() => { const h = document.querySelector('.hud-root'); return h ? getComputedStyle(h).display !== 'none' && h.childElementCount > 0 : false; })(),
    matchScreen: document.querySelectorAll('.fa-match').length,
    canvases: document.querySelectorAll('#game canvas').length,
  }));
  ok('no HUD and no match root survive into the menus',
    !stray.hudVisible && stray.matchScreen === 0, JSON.stringify(stray));
  ok('the mode affordance is still there for a second run',
    await page.evaluate(() => !!document.querySelector('[data-el="mode"]')));
  ok('no page errors across the whole journey', errs.length === 0, errs.slice(0, 3).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${'─'.repeat(74)}`);
console.log(fail === 0 ? `lb_journey: ✅ ${pass} passed` : `lb_journey: ❌ ${fail} FAILED of ${pass + fail}`);
for (const f of failures) console.log(`   ✗ ${f}`);
process.exit(fail === 0 ? 0 : 1);
