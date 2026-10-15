#!/usr/bin/env node
/**
 * bh_meta_browser — REVIEW-phase browser probe (2026-10-15), META / ECONOMY / ITEMS.
 * Read-only on the tree: it only drives a served snapshot and writes PNG/JSON into
 * `shots/rv/bugs/meta/` (gitignored).
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/bh_meta_browser.mjs --url '{URL}' [--arms items-dead,items-fixed,ko-quit,ko-wait]
 *
 * ── ARMS ─────────────────────────────────────────────────────────────────────────
 *   items-dead   THE SHIPPED PATH at TWO seats (no `?seats=`, no `?items=`): a FRESH profile
 *                (ledger owns only the starter) with `food-arena.loadout.v1` holding two
 *                ACTIVE items. Asserts the loadout reaches the sim (`__matchDebug.loadouts`),
 *                both HUD slots read READY, then presses Q and E and watches the sim's own
 *                cooldown (`is-cooling`/`is-winding`, written only by `attemptItem`).
 *   items-fixed  POSITIVE CONTROL for items-dead: the same session with the served
 *                `src/game/match.ts` rewritten to carry the two routed lines (onUseItem +
 *                useItem). A press MUST land here, or items-dead proves nothing.
 *   ko-quit      SIX seats, seeded profile at 1,500 trophies, local fighter dropped in the
 *                central hazard (`?px=1480&py=1000`, qx_quit §I's recipe). Once it is dead and
 *                the match is still 'playing', Pause -> Quit to Home -> Leave. Reads the blob.
 *   ko-wait      CONTROL for ko-quit: the same setup, but the player waits for the whistle.
 *                The blob must MOVE by the 6th-of-6 delta — proves the probe can see a bank.
 *                Then presses Escape on the RESULT card and reads what the confirm says.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const A = process.argv.slice(2);
const arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const BASE = (arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('--out', 'shots/rv/bugs/meta');
const ARMS = arg('--arms', 'items-dead,items-fixed,ko-quit,ko-wait').split(',');
if (!BASE) { console.error('bh_meta_browser: --url is required'); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const VITE_CLIENT_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';

const rows = [];
const report = { base: BASE, at: new Date().toISOString(), arms: {} };
let faults = 0;
function ok(arm, name, pass, detail = '') {
  rows.push({ arm, name, pass: !!pass, detail });
  if (!pass) faults++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} [${arm}] ${name}${detail ? `  — ${detail}` : ''}`);
}

const SEED_TROPHIES = 1500;
const SEED_PROFILE = {
  name: 'BHMETA', wins: 4, losses: 2, xp: 260, selected: 'hamburger',
  economy: {
    trophies: SEED_TROPHIES, bestTrophies: SEED_TROPHIES, coins: 880, gems: 15,
    containers: { chest: 0, hamburgerBox: 0, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], items: ['springform'], winsTowardChest: 1,
    lastMatch: null, levels: {}, seed: 424242, rolls: 0,
  },
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });

async function open({ profile = null, loadout = null, patchMatch = false, viewport = { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.addInitScript(({ profile, loadout }) => {
    // Guarded: addInitScript runs on EVERY navigation and must not restore a blob the app wrote.
    if (profile && !localStorage.getItem('food-arena.profile.v1')) {
      localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile));
    }
    if (loadout && !localStorage.getItem('food-arena.loadout.v1')) {
      localStorage.setItem('food-arena.loadout.v1', JSON.stringify(loadout));
    }
  }, { profile, loadout });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
  const patch = { applied: 0, hooks: 0, inputs: 0 };
  if (patchMatch) {
    await page.route('**/src/game/match.ts*', async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      const hookRe = /onSelectWeapon:\s*\(index\)\s*=>\s*this\.input\.selectWeapon\(index\)/;
      const inputRe = /return\s*\{\s*move,\s*aim,\s*selectedWeapon:\s*this\.input\.selectedWeapon,\s*attack\s*\}/;
      if (hookRe.test(body)) {
        body = body.replace(hookRe, (m) => `${m},\n      onUseItem: (slot) => this.input.pressItem(slot)`);
        patch.hooks++;
      }
      if (inputRe.test(body)) {
        body = body.replace(inputRe,
          'return { move, aim, selectedWeapon: this.input.selectedWeapon, attack, useItem: playing ? this.input.takeItemPress() : null }');
        patch.inputs++;
      }
      patch.applied++;
      await route.fulfill({ response: res, body });
    });
  }
  return { ctx, page, errors, patch };
}

async function bootMatch(page, query, { allowEnded = false } = {}) {
  await page.goto(`${BASE}/?screen=match&pointerLock=0&${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
  await page.waitForFunction((allow) => window.__matchDebug && (window.__matchDebug.phase === 'playing'
    || (allow && window.__matchDebug.phase === 'ended')), allowEnded, { timeout: 180_000 });
}

const slots = (page) => page.evaluate(() => [...document.querySelectorAll('.hud-item-slot')]
  .map((n) => ({ cls: n.className.replace('hud-item-slot', '').trim(), badge: n.querySelector('.hud-item-badge')?.textContent ?? '' })));
const fired = (s) => !!s && (s.cls.includes('is-cooling') || s.cls.includes('is-winding'));
async function watch(page, pred, ms) {
  const t0 = Date.now();
  let last = await slots(page);
  while (Date.now() - t0 < ms) {
    if (pred(last)) return { hit: true, last, ms: Date.now() - t0 };
    await page.waitForTimeout(200);
    last = await slots(page);
  }
  return { hit: pred(last), last, ms: Date.now() - t0 };
}
const readProfile = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('food-arena.profile.v1');
  return raw ? JSON.parse(raw) : null;
});

// ── warm the dev server once (first client eats the dep-optimisation reload) ─────────
{
  const { ctx, page } = await open({});
  try {
    await page.goto(`${BASE}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForTimeout(4000);
  } catch (e) { console.log(`  (warm-up: ${String(e).split('\n')[0]})`); }
  await ctx.close();
}

// ═══════════════════════════════════════════════════════════════════════════════
async function itemsArm(arm, patchMatch) {
  console.log(`\n── ${arm} ─────────────────────────────────────────────`);
  const LOADOUT = ['springform', 'warm_milk'];
  const s = await open({ loadout: LOADOUT, patchMatch });
  const r = { loadoutStored: LOADOUT };
  try {
    // THE SHIPPED DUEL PATH: no seats, no ?items= — the loadout arrives via localStorage.
    await bootMatch(s.page, 'player=hamburger&enemy=donut');
    if (patchMatch) {
      r.patch = s.patch;
      ok(arm, 'the routed two-line hunk was installed into the served match.ts', s.patch.hooks === 1 && s.patch.inputs === 1, JSON.stringify(s.patch));
    }
    const dbg = await s.page.evaluate(() => ({ loadouts: window.__matchDebug.loadouts, seats: window.__matchDebug.loadouts.length }));
    const ledger = await readProfile(s.page);
    r.loadouts = dbg.loadouts; r.ledgerItems = ledger?.economy?.items ?? '(no profile blob yet — fresh ledger: [springform])';
    ok(arm, 'the equipped pair reached the SIM at two seats (warm_milk is NOT in the fresh ledger — the test grant carried it)',
      JSON.stringify(dbg.loadouts[0]) === JSON.stringify(LOADOUT) && dbg.seats === 2, `${JSON.stringify(dbg.loadouts)} · ledger ${JSON.stringify(r.ledgerItems)}`);
    const before = await slots(s.page);
    r.before = before;
    ok(arm, 'both HUD item slots render READY before any press', before.length === 2 && before.every((x) => x.cls.includes('is-ready')),
      before.map((x) => `${x.cls} "${x.badge}"`).join(' | '));
    await s.page.screenshot({ path: `${OUT}/${arm}_before.png` });
    await s.page.keyboard.press('KeyQ');
    const q = await watch(s.page, (x) => fired(x[0]), patchMatch ? 25_000 : 12_000);
    await s.page.keyboard.press('KeyE');
    const e = await watch(s.page, (x) => fired(x[1]), patchMatch ? 25_000 : 12_000);
    r.afterQ = q; r.afterE = e;
    await s.page.screenshot({ path: `${OUT}/${arm}_after.png` });
    if (patchMatch) {
      ok(arm, 'POSITIVE CONTROL: with the hunk, Q LANDS (slot 0 leaves READY for a sim cooldown)', q.hit, `after ${q.ms} ms: ${q.last.map((x) => `${x.cls} "${x.badge}"`).join(' | ')}`);
      ok(arm, 'POSITIVE CONTROL: with the hunk, E LANDS (slot 1)', e.hit, `after ${e.ms} ms: ${e.last.map((x) => `${x.cls} "${x.badge}"`).join(' | ')}`);
    } else {
      ok(arm, 'DEFECT: Q on a READY active slot does NOTHING (no cooldown ever starts)', !q.hit && q.last[0]?.cls.includes('is-ready'),
        `after ${q.ms} ms: ${q.last.map((x) => `${x.cls} "${x.badge}"`).join(' | ')}`);
      ok(arm, 'DEFECT: E on a READY active slot does NOTHING', !e.hit && e.last[1]?.cls.includes('is-ready'),
        `after ${e.ms} ms: ${e.last.map((x) => `${x.cls} "${x.badge}"`).join(' | ')}`);
    }
    r.errors = s.errors;
  } catch (err) {
    ok(arm, 'arm completed', false, String(err).split('\n')[0]);
  } finally {
    report.arms[arm] = r;
    await s.ctx.close();
  }
}

async function koArm(arm, quit, { extra = '', requireWindow = true } = {}) {
  console.log(`\n── ${arm} ─────────────────────────────────────────────`);
  const s = await open({ profile: SEED_PROFILE });
  const r = {};
  try {
    // `extra` = '&fogRadius=0' for the control: sudden death (50 HP/s on everyone) so the
    // whistle arrives in seconds of sim time even on a machine at load ~150, where the
    // first run's plain six-seat match did not finish inside 420 s of wall clock.
    await bootMatch(s.page, `player=hamburger&enemy=donut&seats=6&px=1480&py=1000&simSpeed=${quit ? 4 : 6}${extra}`,
      { allowEnded: !requireWindow });
    const seats = await s.page.evaluate(() => window.__matchDebug.loadouts.length);
    ok(arm, 'six fighters are really in the match (non-vacuity)', seats === 6, `${seats}`);
    const before = await readProfile(s.page);
    r.before = before?.economy ? { trophies: before.economy.trophies, coins: before.economy.coins, losses: before.losses, xp: before.xp } : null;
    ok(arm, 'the seeded profile is what the app holds', before?.economy?.trophies === SEED_TROPHIES, JSON.stringify(r.before));
    const dead = await s.page.waitForFunction(
      (req) => (window.__matchDebug?.viewSubject !== 0 && window.__matchDebug?.phase === 'playing')
        || (!req && window.__matchDebug?.phase === 'ended'),
      requireWindow, { timeout: 180_000 }).then(() => true).catch(() => false);
    const st = await s.page.evaluate(() => ({ phase: window.__matchDebug?.phase, view: window.__matchDebug?.viewSubject, reason: window.__matchDebug?.viewReason }));
    r.atKo = st;
    if (requireWindow) {
      ok(arm, 'local fighter knocked out while the match is still PLAYING (the six-seat-only state)', dead && st.phase === 'playing', JSON.stringify(st));
      if (!dead) return;
    } else {
      console.log(`    (window not required in this arm; observed ${JSON.stringify(st)}, dead-while-playing=${dead})`);
    }
    await s.page.screenshot({ path: `${OUT}/${arm}_spectating.png` });
    if (quit) {
      await s.page.click('.fa-match .match-chip');
      await s.page.waitForFunction(() => document.querySelector('.match-sheet')?.classList.contains('is-open') === true, null, { timeout: 20_000 });
      await s.page.click('[data-el="quit"]');
      await s.page.waitForFunction(() => document.querySelector('[data-el="leave"]')?.disabled === false, null, { timeout: 20_000 });
      r.confirmText = await s.page.evaluate(() => document.querySelector('[data-el="confirmbody"]')?.textContent ?? '');
      await s.page.screenshot({ path: `${OUT}/${arm}_confirm.png` });
      await s.page.click('[data-el="leave"]');
      await s.page.waitForFunction(() => document.querySelector('.fa-home') !== null, null, { timeout: 30_000 });
      const after = await readProfile(s.page);
      r.after = { trophies: after.economy.trophies, coins: after.economy.coins, losses: after.losses, xp: after.xp };
      ok(arm, 'DEFECT: leaving a DECIDED six-seat result banks nothing — trophies unchanged at the seeded standing',
        after.economy.trophies === SEED_TROPHIES && after.losses === SEED_PROFILE.losses,
        `before ${JSON.stringify(r.before)} → after ${JSON.stringify(r.after)}`);
    } else {
      const ended = await s.page.waitForFunction(() => window.__matchDebug?.phase === 'ended', null, { timeout: 420_000 })
        .then(() => true).catch(() => false);
      ok(arm, 'the match reaches the whistle', ended);
      if (!ended) return;
      await s.page.waitForTimeout(1500);
      const card = await s.page.evaluate(() => ({
        title: document.querySelector('[data-el="gameover-title"]')?.textContent ?? '',
        place: document.querySelector('[data-el="gameover-place"]')?.textContent ?? '',
        payout: document.querySelector('[data-el="gameover-payout"]')?.innerText?.replace(/\s+/g, ' ') ?? '',
      }));
      r.card = card;
      const after = await readProfile(s.page);
      r.after = { trophies: after.economy.trophies, coins: after.economy.coins, losses: after.losses, xp: after.xp, lastMatch: after.economy.lastMatch };
      await s.page.screenshot({ path: `${OUT}/${arm}_card.png` });
      ok(arm, 'CONTROL: waiting it out BANKS the decided result (the probe can see a bank)',
        after.economy.trophies !== SEED_TROPHIES && after.economy.lastMatch?.seats === 6,
        `card ${JSON.stringify(card)} · after ${JSON.stringify({ trophies: r.after.trophies, coins: r.after.coins, losses: r.after.losses, place: after.economy.lastMatch?.place })}`);
      // ── Escape on the RESULT card: does the pause sheet still promise a forfeit? ──
      await s.page.keyboard.press('Escape');
      const sheetOpen = await s.page.waitForFunction(() => document.querySelector('.match-sheet')?.classList.contains('is-open') === true, null, { timeout: 15_000 })
        .then(() => true).catch(() => false);
      r.sheetOpenAfterEnd = sheetOpen;
      if (sheetOpen) {
        await s.page.click('[data-el="quit"]');
        await s.page.waitForTimeout(600);
        r.confirmTextAfterEnd = await s.page.evaluate(() => document.querySelector('[data-el="confirmbody"]')?.textContent ?? '');
        await s.page.screenshot({ path: `${OUT}/${arm}_escape_confirm.png` });
        ok(arm, 'DEFECT (minor): after the whistle, Escape opens the pause sheet and Quit says the match pays NOTHING — it already paid',
          /no trophies, coins or XP/.test(r.confirmTextAfterEnd), JSON.stringify(r.confirmTextAfterEnd));
        await s.page.waitForFunction(() => document.querySelector('[data-el="leave"]')?.disabled === false, null, { timeout: 20_000 });
        await s.page.click('[data-el="leave"]');
        await s.page.waitForFunction(() => document.querySelector('.fa-home') !== null, null, { timeout: 30_000 });
        const after2 = await readProfile(s.page);
        r.afterLeave = { trophies: after2.economy.trophies, coins: after2.economy.coins };
        ok(arm, '...and leaving then neither un-banks nor double-banks (the sentence is false, not the ledger)',
          after2.economy.trophies === after.economy.trophies && after2.economy.coins === after.economy.coins,
          JSON.stringify(r.afterLeave));
      } else {
        ok(arm, 'Escape on the result card opens the pause sheet', false, 'sheet did not open');
      }
    }
    r.errors = s.errors;
  } catch (err) {
    ok(arm, 'arm completed', false, String(err).split('\n')[0]);
  } finally {
    report.arms[arm] = r;
    await s.ctx.close();
  }
}

/**
 * swap-flow — does a seat count chosen in the lobby survive the lobby's OWN
 * "Change your fighter" control, and the in-match pause sheet's "Change Fighter"?
 * CONTROL first: lobby -> 6 -> Start must seat SIX (proves the probe can read six).
 */
async function flowArm(arm) {
  console.log(`\n── ${arm} ─────────────────────────────────────────────`);
  const r = {};
  const seatsNow = (page) => page.evaluate(() => ({
    seats: window.__matchDebug?.loadouts?.length ?? null, search: location.search, screen: window.__screen,
  }));
  const lobbyTo6 = async (page) => {
    await page.goto(`${BASE}/?screen=lobby`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__screen === 'lobby' && document.querySelector('.lobby-opt[data-seats="6"]'), null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.click('.lobby-opt[data-seats="6"]', { timeout: 90_000 });
    await page.waitForTimeout(500);
    return page.evaluate(() => document.querySelector('[data-el="count"]')?.textContent ?? '');
  };
  // CONTROL — Start from the lobby with 6 chosen.
  {
    const s = await open({});
    try {
      const shown = await lobbyTo6(s.page);
      r.lobbyKit = await s.page.evaluate(() => ({
        owned: document.querySelector('[data-el="kit-owned"]')?.textContent ?? '',
        note: document.querySelector('[data-el="kit-note"]')?.textContent ?? '',
      }));
      await s.page.screenshot({ path: `${OUT}/${arm}_lobby6.png` });
      console.log(`    lobby kit: "${r.lobbyKit.owned}" · note: "${r.lobbyKit.note}"`);
      await s.page.click('[data-el="start"]');
      await s.page.waitForFunction(() => window.__gameReady === true && window.__matchDebug, null, { timeout: 240_000 });
      r.control = { lobbyShows: shown, ...(await seatsNow(s.page)) };
      ok(arm, 'CONTROL: lobby "Players 6" -> Start seats SIX fighters', shown === '6' && r.control.seats === 6, JSON.stringify(r.control));
    } catch (err) { ok(arm, 'control completed', false, String(err).split('\n')[0]); }
    finally { await s.ctx.close(); }
  }
  // DEFECT A — lobby 6 -> "Change your fighter" -> character select -> Fight!
  {
    const s = await open({});
    try {
      const shown = await lobbyTo6(s.page);
      await s.page.click('[data-el="swap"]', { timeout: 90_000 });
      await s.page.waitForFunction(() => window.__screen === 'characters', null, { timeout: 60_000 });
      await s.page.waitForTimeout(1500);
      // `force`: the hero FIGHT button pulses forever, so Playwright's "stable" check never
      // passes — the precedent is tools/tmp/journey.mjs, which clicks it the same way.
      await s.page.click('[data-el="fight"]', { timeout: 90_000, force: true });
      await s.page.waitForFunction(() => window.__gameReady === true && window.__matchDebug, null, { timeout: 240_000 });
      r.swap = { lobbyShows: shown, ...(await seatsNow(s.page)) };
      await s.page.screenshot({ path: `${OUT}/${arm}_after_swap_fight.png` });
      ok(arm, 'DEFECT: lobby "Players 6" -> Change your fighter -> Fight! starts a TWO-seat duel', shown === '6' && r.swap.seats === 2,
        JSON.stringify(r.swap));
    } catch (err) { ok(arm, 'swap path completed', false, String(err).split('\n').slice(0, 6).join(' / ')); }
    finally { await s.ctx.close(); }
  }
  // DEFECT B — six-seat match -> pause -> Change Fighter -> Leave -> Fight!
  {
    const s = await open({});
    try {
      await bootMatch(s.page, 'player=hamburger&enemy=donut&seats=6');
      const before = await seatsNow(s.page);
      await s.page.waitForTimeout(1500);
      await s.page.click('.fa-match .match-chip', { timeout: 90_000 });
      await s.page.waitForFunction(() => document.querySelector('.match-sheet')?.classList.contains('is-open') === true, null, { timeout: 20_000 });
      await s.page.click('[data-el="change"]', { timeout: 90_000 });
      await s.page.waitForFunction(() => document.querySelector('[data-el="leave"]')?.disabled === false, null, { timeout: 20_000 });
      await s.page.click('[data-el="leave"]');
      await s.page.waitForFunction(() => window.__screen === 'characters', null, { timeout: 60_000 });
      await s.page.waitForTimeout(1500);
      await s.page.click('[data-el="fight"]', { timeout: 90_000, force: true });
      await s.page.waitForFunction(() => window.__gameReady === true && window.__matchDebug && window.__matchDebug.frames > 0, null, { timeout: 240_000 });
      r.pause = { before, after: await seatsNow(s.page) };
      ok(arm, 'DEFECT: six-seat match -> Pause -> Change Fighter -> Fight! comes back as a TWO-seat duel',
        before.seats === 6 && r.pause.after.seats === 2, JSON.stringify(r.pause));
    } catch (err) { ok(arm, 'pause path completed', false, String(err).split('\n').slice(0, 6).join(' / ')); }
    finally { await s.ctx.close(); }
  }
  report.arms[arm] = r;
}

/**
 * odds-sheet — the two drop-rate disclosure surfaces. The shop names every pool member,
 * fighters AND items; does the trophy road's "Drop rates" sheet name the items too?
 * CONTROL: the shop's sheet must contain an item name (proves the probe can see one).
 */
async function oddsArm(arm) {
  console.log(`\n── ${arm} ─────────────────────────────────────────────`);
  const r = {};
  const ITEM_NAMES = ['Tenderiser', 'Springform', 'Warm Milk', 'Pompa', 'Squid Ink', 'Disposal',
    'Blue Cheese', 'Shiitake Shield', 'Liquorice Rope', 'Leftovers'];
  const s = await open({});
  try {
    await s.page.goto(`${BASE}/?screen=shop`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await s.page.waitForFunction(() => window.__screen === 'shop' && document.querySelector('.shop-odds-row'), null, { timeout: 120_000 });
    const shop = await s.page.evaluate(() => ({
      itemRows: [...document.querySelectorAll('.shop-odds-row')].filter((n) => / item/.test(n.textContent)).length,
      pools: [...document.querySelectorAll('.shop-pool-line')].map((n) => n.textContent.trim()).join(' | '),
    }));
    r.shop = { itemRows: shop.itemRows, itemNamesNamed: ITEM_NAMES.filter((n) => shop.pools.includes(n)) };
    ok(arm, 'CONTROL: the SHOP sheet lists item rows AND names the items in them', shop.itemRows > 0 && r.shop.itemNamesNamed.length > 0,
      `${shop.itemRows} item rows · names: ${r.shop.itemNamesNamed.join(', ')}`);
    await s.page.goto(`${BASE}/?screen=trophies`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await s.page.waitForFunction(() => window.__screen === 'trophies' && document.querySelector('[data-el="oddsbtn"]'), null, { timeout: 120_000 });
    await s.page.waitForTimeout(1500);
    await s.page.click('[data-el="oddsbtn"]', { timeout: 90_000 });
    await s.page.waitForFunction(() => document.querySelector('.tr-odds-row'), null, { timeout: 30_000 });
    const road = await s.page.evaluate(() => ({
      itemRows: [...document.querySelectorAll('.tr-odds-row')].filter((n) => / item/.test(n.textContent)).length,
      pools: [...document.querySelectorAll('.tr-odds-pool')].map((n) => n.textContent.trim()).join(' | '),
    }));
    r.road = { itemRows: road.itemRows, itemNamesNamed: ITEM_NAMES.filter((n) => road.pools.includes(n)), poolsSample: road.pools.slice(0, 300) };
    await s.page.screenshot({ path: `${OUT}/${arm}_trophyroad_odds.png` });
    ok(arm, 'DEFECT (minor): the TROPHY ROAD drop-rate sheet publishes item rows but names NONE of the items in them',
      road.itemRows > 0 && r.road.itemNamesNamed.length === 0, `${road.itemRows} item rows · item names named: ${r.road.itemNamesNamed.length}`);
  } catch (err) { ok(arm, 'odds arm completed', false, String(err).split('\n')[0]); }
  finally { await s.ctx.close(); report.arms[arm] = r; }
}

/**
 * two-tabs — two tabs of one profile. Each `PlayerProfile` loads the blob ONCE and every
 * commit writes its WHOLE in-memory snapshot; nothing listens for `storage` events.
 * CONTROL: the same two writes made sequentially in ONE tab must both survive.
 */
async function twoTabsArm(arm) {
  console.log(`\n── ${arm} ─────────────────────────────────────────────`);
  const r = {};
  const seeded = JSON.parse(JSON.stringify(SEED_PROFILE));
  seeded.economy.trophies = 70; seeded.economy.bestTrophies = 70; seeded.name = 'Seed';
  const claimNode30 = async (page) => {
    await page.goto(`${BASE}/?screen=trophies`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__screen === 'trophies' && document.querySelector('.tr-node.is-claimable[data-trophies="30"]'), null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.click('.tr-node.is-claimable[data-trophies="30"]', { timeout: 90_000 });
    await page.waitForTimeout(500);
  };
  const rename = async (page, name) => {
    await page.goto(`${BASE}/?screen=settings`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__screen === 'settings' && document.querySelector('[data-el="name"]'), null, { timeout: 120_000 });
    await page.waitForTimeout(1500);
    await page.fill('[data-el="name"]', name, { timeout: 90_000 });
    await page.waitForTimeout(300);
  };
  const read = (page) => page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('food-arena.profile.v1') ?? 'null');
    return p ? { name: p.name, claimed: p.economy.claimed, chests: p.economy.containers.chest } : null;
  });
  // CONTROL: one tab, claim then rename.
  {
    const s = await open({ profile: seeded });
    try {
      await claimNode30(s.page);
      await rename(s.page, 'OneTab');
      r.control = await read(s.page);
      ok(arm, 'CONTROL: one tab — the claim AND the rename both persist', r.control?.name === 'OneTab'
        && r.control.claimed.includes(30) && r.control.chests === 1, JSON.stringify(r.control));
    } catch (err) { ok(arm, 'control completed', false, String(err).split('\n')[0]); }
    finally { await s.ctx.close(); }
  }
  // DEFECT: tab B opened before tab A's claim overwrites it.
  {
    const s = await open({ profile: seeded });
    try {
      const pageB = await s.ctx.newPage();
      await pageB.route('**/@vite/client*', (rr) => rr.fulfill({ status: 200, contentType: 'text/javascript', body: VITE_CLIENT_STUB }));
      await pageB.goto(`${BASE}/?screen=settings`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await pageB.waitForFunction(() => window.__screen === 'settings' && document.querySelector('[data-el="name"]'), null, { timeout: 120_000 });
      await s.page.bringToFront();                   // a background tab gets no rAF -> no actionability
      await claimNode30(s.page);                     // tab A claims the 30-trophy chest
      r.afterA = await read(s.page);
      await pageB.bringToFront();
      await pageB.waitForTimeout(800);
      await pageB.fill('[data-el="name"]', 'TabB', { timeout: 90_000 });  // tab B, loaded earlier, renames
      await pageB.waitForTimeout(300);
      r.afterB = await read(s.page);
      ok(arm, 'precondition: tab A\'s claim was written', r.afterA?.claimed.includes(30) && r.afterA.chests === 1, JSON.stringify(r.afterA));
      ok(arm, 'DEFECT (minor): tab B\'s unrelated rename silently UNDOES tab A\'s claim (lost update)',
        r.afterB?.name === 'TabB' && !r.afterB.claimed.includes(30) && r.afterB.chests === 0, JSON.stringify(r.afterB));
    } catch (err) { ok(arm, 'two-tab path completed', false, String(err).split('\n').slice(0, 6).join(' / ')); }
    finally { await s.ctx.close(); }
  }
  report.arms[arm] = r;
}

for (const arm of ARMS) {
  if (arm === 'two-tabs') await twoTabsArm(arm);
  if (arm === 'odds-sheet') await oddsArm(arm);
  if (arm === 'swap-flow') await flowArm(arm);
  if (arm === 'items-dead') await itemsArm(arm, false);
  else if (arm === 'items-fixed') await itemsArm(arm, true);
  else if (arm === 'ko-quit') await koArm(arm, true);
  else if (arm === 'ko-wait') await koArm(arm, false);
  else if (arm === 'ko-wait-fog') await koArm(arm, false, { extra: '&fogRadius=0', requireWindow: false });
}
await browser.close();
report.rows = rows; report.faults = faults;
const JSON_OUT = `${OUT}/bh_meta_browser_${ARMS.join('+')}.json`;
writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
console.log(`\nbh_meta_browser: ${rows.length - faults}/${rows.length} rows as expected · ${JSON_OUT}`);
process.exitCode = faults ? 1 : 0;
