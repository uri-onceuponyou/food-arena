#!/usr/bin/env node
/**
 * B6 · THE SCREENS — four screen bugs, each asserted as the PLAYER meets it, test-first.
 *
 * `docs/REVAMP.md` §5 (B2's screen half, left behind because U1 held the files). Every
 * section below was run on the base commit `f65af2c` BEFORE any `src/` edit and its
 * defect rows were RED there — that run IS the known-bad, and the commit that adds this
 * file records the failing values. A row that could not go red on the base would mean
 * the bug is not real (or this file cannot see it), and it would be reported, not fixed.
 *
 *   §M3  META-03 — "changing fighter from the lobby, or from a six-seat pause sheet,
 *        silently turns the match into a 1v1". 🚨 BUILT AT SIX SEATS: at two the duel IS
 *        the configured count, so a two-seat version of every row below passes vacuously
 *        (`docs/AGENT-BRIEF.md` §4b). Asserts the seat count AND the roster — the HUD's
 *        plate names against the rows the lobby displayed — from BOTH entry points, plus
 *        in-app Back, Android Back and a reload on character select, plus the duel path
 *        (home → Start Game → Fight!) as the control that must NOT pick the count up.
 *   §M7  META-07 — the trophy road's drop-rate sheet publishes item rows and names none
 *        of the items. Expected names come from the REAL `containerOdds()` + `ITEMS`
 *        (imported in Node, not retyped); visibility is `checkVisibility()` + a non-empty
 *        rect, because `innerText` of a `display:none` node falls back to `textContent`
 *        (the META-07 verifier's own instrument was fooled by exactly that). A PLANT row
 *        proves the detector can see a name on that surface at all.
 *   §M8  META-08 — two tabs overwrite each other's progress. 🚨 TWO PAGES IN ONE PLAYWRIGHT
 *        CONTEXT, i.e. two HTML *browsing* contexts on one origin sharing `localStorage`.
 *        Two Playwright `BrowserContext`s would be two isolated profiles with separate
 *        storage and could not reproduce this at all. Mutations go through the real UI
 *        only (a road-node click, keystrokes into the name field).
 *   §ML4 ML-4 — browser / Android Back during a LIVE match abandoned it silently, against
 *        `DECISIONS §31` ("Back during a live match opens the pause sheet"). Asserts the
 *        SAME session survives (object identity on `__matchDebug`, not merely "a match
 *        screen"), the sheet opens, nothing banks — and, as the control, that Back after
 *        the whistle still leaves.
 *
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/b6_screens.mjs --url '{URL}' [--only m3,m7,m8,ml4] [--out <png dir>]
 *
 * ⚠️ Never `:5173` (refused below). Exit 0 only when every row passes.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = process.argv.slice(2);
const arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const ONLY = String(arg('--only', 'm7,m8,m3,ml4')).split(',').map((s) => s.trim()).filter(Boolean);
const OUT = arg('--out', null);
const JSON_OUT = arg('--json', null);

if (!BASE) { console.error('b6_screens: --url (or PREVIEW_BASE) is required, and must be a snapshot.'); process.exit(2); }
if (/:5173(\/|$)/.test(BASE)) { console.error(`b6_screens: refusing the shared dev server (${BASE}) — CLAUDE.md rule 2.`); process.exit(2); }
if (OUT) mkdirSync(OUT, { recursive: true });

// The real tables, imported rather than retyped — `src/game/**` imports its siblings with
// explicit `.ts` extensions precisely so Node can load it with no build step.
const ECON = await import(resolve(ROOT, 'src/game/economy/index.ts'));
const RULES = await import(resolve(ROOT, 'src/game/rules.ts'));
const { CHARACTERS, CHARACTER_IDS, ITEMS } = RULES;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
  + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
  + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
  + 'export const ErrorOverlay=class{};export default {};';
const PROFILE_KEY = 'food-arena.profile.v1';

const rows = [];
function ok(sec, id, pass, detail = '') {
  rows.push({ sec, id, pass: !!pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} [${sec}] ${id}${detail ? `   — ${detail}` : ''}`);
  return !!pass;
}
const head = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 76 - t.length))}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lc = (s) => String(s ?? '').trim().toLowerCase();
const sortedNames = (xs) => xs.map(lc).sort().join('|');

const browser = await chromium.launch({ args: LAUNCH_ARGS });

/** A fresh context (fresh storage) with the HMR client stubbed — a reload this file did
 *  not ask for would be indistinguishable from the ones it performs on purpose. */
async function open({ viewport = { width: 1280, height: 720 }, profile = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await ctx.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  if (profile) {
    // Guarded: an init script runs on EVERY navigation and must never restore a blob the
    // app itself has since written.
    await ctx.addInitScript(({ key, blob }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, blob);
    }, { key: PROFILE_KEY, blob: JSON.stringify(profile) });
  }
  const errors = [];
  const page = await newTab(ctx, errors);
  return { ctx, page, errors };
}
async function newTab(ctx, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e.message ?? e).slice(0, 160)));
  return page;
}

async function waitScreen(page, name, timeout = 90_000) {
  await page.waitForFunction((n) => window.__screen === n && window.__screenReady === true, name, { timeout });
}
/** Whichever of `names` the app lands on first. */
async function waitAnyScreen(page, names, timeout = 120_000) {
  const h = await page.waitForFunction((ns) => (window.__screenReady === true && ns.includes(window.__screen)
    ? window.__screen : null), names, { timeout });
  return h.jsonValue();
}
/** A real click when the element is actionable; a DOM click when Playwright's stability
 *  check cannot pass (the hero FIGHT button pulses forever and the animated rarity cards
 *  never hold still — both recorded by META-03's verifier under SwiftShader). Returns
 *  which path was taken, so a run can be read back. */
async function tap(page, sel, timeout = 12_000) {
  try { await page.click(sel, { timeout }); return 'click'; } catch {
    await page.dispatchEvent(sel, 'click');
    return 'dispatch';
  }
}
async function waitMatch(page, { phase = 'playing' } = {}) {
  await page.waitForFunction(() => window.__gameReady === true && window.__matchDebug && window.__matchDebug.frames > 0,
    null, { timeout: 240_000 });
  if (phase) {
    await page.waitForFunction((p) => window.__matchDebug && window.__matchDebug.phase === p, phase, { timeout: 240_000 });
  }
}
const matchFacts = (page) => page.evaluate(() => ({
  screen: window.__screen,
  route: window.__shell ? window.__shell.route() : null,
  search: location.search,
  sim: window.__matchDebug ? window.__matchDebug.loadouts.length : null,
  plates: [...document.querySelectorAll('.hud-fighter .hud-fighter-name')].map((n) => n.textContent.trim()),
}));
/** Plates are written once the HUD has built its roster — poll until they agree with the sim. */
async function settledMatchFacts(page) {
  let f = await matchFacts(page);
  for (let i = 0; i < 60 && !(f.sim && f.plates.length === f.sim && f.plates.every((n) => n)); i++) {
    await sleep(250);
    f = await matchFacts(page);
  }
  return f;
}
const lobbyFacts = (page) => page.evaluate(() => ({
  screen: window.__screen,
  count: document.querySelector('[data-el="count"]')?.textContent?.trim() ?? null,
  pressed: document.querySelector('.lobby-opt[aria-pressed="true"]')?.dataset.seats ?? null,
  rows: [...document.querySelectorAll('.lobby-seat')].map((r) => ({
    char: r.dataset.char, name: r.querySelector('.lobby-seat-name')?.textContent?.trim() ?? '',
  })),
}));
async function shot(page, name) {
  if (!OUT) return;
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 20_000 }).catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════════
// §M7 — the trophy road's drop-rate sheet names the ITEMS in its item rows
// ═════════════════════════════════════════════════════════════════════════════
async function sectionM7() {
  head('§M7 · META-07 — the drop-rate sheet names every item it publishes a rate for');
  // Expected, per container, from the real tables.
  const expect = ECON.CONTAINER_KINDS.map((kind) => {
    const odds = ECON.containerOdds(kind);
    return {
      kind,
      name: ECON.CONTAINERS[kind].name,
      items: odds.filter((r) => r.itemPool && r.itemPool.length > 0)
        .map((r) => ({ label: r.label, names: r.itemPool.map((id) => ITEMS[id].name) })),
      fighters: odds.filter((r) => r.pool && r.pool.length > 0)
        .map((r) => ({ label: r.label, names: r.pool.map((id) => CHARACTERS[id].name) })),
    };
  });
  const itemRowsTotal = expect.reduce((s, e) => s + e.items.length, 0);
  const allItemNames = [...new Set(expect.flatMap((e) => e.items.flatMap((r) => r.names)))];
  const fighterNames = new Set(CHARACTER_IDS.map((id) => CHARACTERS[id].name));
  // Non-vacuity, and the collision guard a substring search needs.
  if (!ok('M7', 'G1  the tables carry item rows to name (asserted non-empty before anything is quantified)',
    itemRowsTotal > 0 && allItemNames.length > 0, `${itemRowsTotal} item rows · ${allItemNames.length} distinct items`)) return;
  ok('M7', 'G2  no item name is also a fighter name (a substring hit cannot be the wrong noun)',
    allItemNames.every((n) => !fighterNames.has(n)));

  for (const vp of [{ name: 'desk', width: 1280, height: 720 }, { name: 'portrait', width: 390, height: 844 },
    { name: 'phoneland', width: 844, height: 390 }]) {
    const s = await open({ viewport: { width: vp.width, height: vp.height } });
    try {
      await s.page.goto(`${BASE}/?screen=trophies&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitScreen(s.page, 'trophies');
      await tap(s.page, '[data-el="oddsbtn"]');
      await s.page.waitForFunction(() => document.querySelectorAll('.tr-odds-block').length > 0, null, { timeout: 30_000 });
      await sleep(400);
      const read = () => s.page.evaluate(() => {
        const vis = (n) => !!n && (typeof n.checkVisibility !== 'function' || n.checkVisibility())
          && [...n.getClientRects()].some((r) => r.width > 0 && r.height > 0);
        const scroller = document.querySelector('.tr-sheet-scroll');
        return {
          blocks: [...document.querySelectorAll('.tr-odds-block')].map((b) => ({
            title: b.querySelector('.tr-odds-title')?.textContent?.trim() ?? '',
            rows: [...b.querySelectorAll('.tr-odds-what')].map((n) => n.textContent.trim()),
            pools: [...b.querySelectorAll('.tr-odds-pool')].filter(vis).map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
          })),
          overflowX: scroller ? scroller.scrollWidth - scroller.clientWidth : null,
        };
      });
      const got = await read();
      if (!ok('M7', `${vp.name} G3  the sheet rendered one block per container`, got.blocks.length === expect.length,
        `${got.blocks.length} blocks vs ${expect.length} containers`)) continue;
      // Positive control on the SAME surface: fighters ARE named here on the base, so a 0 for
      // items below is not a blind selector.
      const fighterHits = expect.reduce((s2, e, i) => s2 + e.fighters.flatMap((r) => r.names)
        .filter((n) => got.blocks[i].pools.join(' ').includes(n)).length, 0);
      ok('M7', `${vp.name} C1  CONTROL: the same pool lines name fighters (the detector can see a name here)`,
        fighterHits > 0, `${fighterHits} fighter names visible`);
      // PLANT: a known item name appended into the sheet's own pool line must be seen exactly once.
      const planted = await s.page.evaluate(() => {
        const p = document.querySelector('.tr-odds-block .tr-odds-pool');
        if (!p) return false;
        const span = document.createElement('span'); span.dataset.b6plant = '1'; span.textContent = ' · Squid Ink';
        p.appendChild(span); return true;
      });
      const plantedRead = planted ? await read() : null;
      await s.page.evaluate(() => document.querySelector('[data-b6plant]')?.remove());
      ok('M7', `${vp.name} C2  PLANT: a name planted in the pool line is seen by the same detector`,
        !!plantedRead && plantedRead.blocks[0].pools.join(' ').includes('Squid Ink'), planted ? '' : 'no pool line to plant into');

      // ── THE DEFECT ──
      let named = 0, total = 0;
      const missing = [];
      expect.forEach((e, i) => {
        const text = got.blocks[i].pools.join(' ');
        for (const r of e.items) for (const n of r.names) {
          total++;
          if (text.includes(n)) named++; else missing.push(`${e.name}:${n}`);
        }
      });
      ok('M7', `${vp.name} M7a  every item in every item row is NAMED in its own container's visible pool line`,
        total > 0 && named === total, `${named}/${total} named${missing.length ? ` · missing e.g. ${missing.slice(0, 3).join(', ')}` : ''}`);
      // ...and named UNAMBIGUOUSLY: keyed by the row's own label, so a reader can tell the item
      // list from the fighter list of the same rarity (the verifier's amendment (2)).
      let keyed = 0, keyTotal = 0;
      expect.forEach((e, i) => {
        const text = got.blocks[i].pools.join(' ');
        for (const r of [...e.items, ...e.fighters]) {
          keyTotal++;
          if (text.includes(`${r.label}: ${r.names.join(', ')}`)) keyed++;
        }
      });
      ok('M7', `${vp.name} M7b  each pool entry is keyed by its row's own label ("Epic item: …", "Rare fighter: …")`,
        keyed === keyTotal, `${keyed}/${keyTotal} keyed`);
      ok('M7', `${vp.name} M7c  the sheet does not scroll sideways`, got.overflowX !== null && got.overflowX <= 0,
        `scrollWidth - clientWidth = ${got.overflowX}`);
      ok('M7', `${vp.name} E   no page errors`, s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
      await shot(s.page, `m7_${vp.name}_sheet`);
    } catch (err) {
      ok('M7', `${vp.name} arm completed`, false, String(err).split('\n')[0]);
    } finally { await s.ctx.close(); }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §M3 — the seat count and the roster survive a fighter change, at SIX seats
// ═════════════════════════════════════════════════════════════════════════════
const SIX = 6;
async function lobbyTo(page, n) {
  await page.goto(`${BASE}/?screen=lobby&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitScreen(page, 'lobby');
  await tap(page, `.lobby-opt[data-seats="${n}"]`);
  await page.waitForFunction((k) => document.querySelector('[data-el="count"]')?.textContent?.trim() === String(k), n, { timeout: 20_000 });
  return lobbyFacts(page);
}
/** View `id` on character select. Returns the hero name shown, so a mis-click is visible. */
async function pickFighter(page, id) {
  await tap(page, `.chars-card[data-char="${id}"]`);
  await page.waitForFunction((nm) => (document.querySelector('[data-el="heroname"]')?.textContent ?? '').includes(nm),
    CHARACTERS[id].name, { timeout: 20_000 }).catch(() => {});
  return page.evaluate(() => document.querySelector('[data-el="heroname"]')?.textContent?.trim() ?? '');
}
const otherThan = (id) => (id === 'pizza' ? 'egg' : 'pizza');

/**
 * After a fighter change, follow the player's path to the match that starts and judge it.
 * The base sends the primary straight into a match; a fix may return to the lobby first —
 * both are followed, and the rows judge the MATCH THAT STARTS, which is what the player meets.
 */
async function judgeAfterChange(s, arm, target) {
  const dest = await tap(s.page, '[data-el="fight"]').then(() => waitAnyScreen(s.page, ['lobby', 'match']));
  let lobby = null;
  if (dest === 'lobby') {
    lobby = await lobbyFacts(s.page);
    await shot(s.page, `m3_${arm}_lobby_after_change`);
    ok('M3', `${arm}  the lobby it returns to still says ${SIX} players, ${SIX} rows, the NEW fighter in seat 1`,
      lobby.count === String(SIX) && lobby.rows.length === SIX && lobby.rows[0]?.char === target,
      `count ${lobby.count} · rows ${lobby.rows.length} · seat 1 ${lobby.rows[0]?.char}`);
    await tap(s.page, '[data-el="start"]');
    await waitScreen(s.page, 'match', 120_000);
  }
  await waitMatch(s.page, { phase: null });
  const f = await settledMatchFacts(s.page);
  await shot(s.page, `m3_${arm}_match`);
  ok('M3', `${arm}  🚨 the match that starts seats ${SIX} (route, URL and sim agree)`,
    f.route?.seats === SIX && f.search.includes(`seats=${SIX}`) && f.sim === SIX,
    `via ${dest} · route ${JSON.stringify(f.route)} · sim ${f.sim} · plates ${f.plates.length}`);
  ok('M3', `${arm}  🚨 ...and its ROSTER is the field the lobby displayed, with the new fighter in seat 1`,
    lobby !== null
      ? f.plates.length === SIX && sortedNames(f.plates) === sortedNames(lobby.rows.map((r) => r.name)) && f.route?.player === target
      : f.plates.length === SIX && f.route?.player === target,
    `plates [${f.plates.join(', ')}]${lobby ? ` · lobby [${lobby.rows.map((r) => r.name).join(', ')}]` : ''}`);
  return { dest, lobby, f };
}

async function sectionM3() {
  head(`§M3 · META-03 — a fighter change keeps the lobby's ${SIX} seats and its roster`);

  // CONTROL — the known-good: lobby 6 -> Start. Proves this file can see six seats and a roster.
  {
    const s = await open();
    try {
      const L = await lobbyTo(s.page, SIX);
      if (!ok('M3', `CTRL  G  the lobby shows ${SIX} rows for "${SIX} players" (non-vacuity)`, L.rows.length === SIX && L.count === String(SIX),
        `count ${L.count} rows ${L.rows.length}`)) return;
      await tap(s.page, '[data-el="start"]');
      await waitScreen(s.page, 'match', 120_000);
      await waitMatch(s.page, { phase: null });
      const f = await settledMatchFacts(s.page);
      ok('M3', `CTRL  lobby ${SIX} -> Start seats ${SIX} (route, URL, sim)`, f.route?.seats === SIX && f.sim === SIX && f.search.includes(`seats=${SIX}`),
        `route ${JSON.stringify(f.route)} sim ${f.sim}`);
      ok('M3', 'CTRL  ...and the HUD plates are exactly the lobby\'s rows (the roster instrument works)',
        f.plates.length === SIX && sortedNames(f.plates) === sortedNames(L.rows.map((r) => r.name)),
        `plates [${f.plates.join(', ')}]`);
      ok('M3', 'CTRL  no page errors', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('M3', 'CTRL completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // A — lobby 6 -> "Change your fighter" -> pick -> primary.
  {
    const s = await open();
    try {
      const L0 = await lobbyTo(s.page, SIX);
      const target = otherThan(L0.rows[0]?.char);
      await tap(s.page, '[data-el="swap"]');
      await waitScreen(s.page, 'characters');
      const hero = await pickFighter(s.page, target);
      ok('M3', `A     precondition: character select is viewing ${target}`, lc(hero).includes(lc(CHARACTERS[target].name)), hero);
      await judgeAfterChange(s, 'A', target);
      ok('M3', 'A     no page errors', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('M3', 'A completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // B — six-seat match -> Pause -> Change Fighter -> Leave -> pick -> primary. The real
  // player path: the six-seat match is started FROM THE LOBBY, and is genuinely mid-match.
  {
    const s = await open();
    try {
      await lobbyTo(s.page, SIX);
      await tap(s.page, '[data-el="start"]');
      await waitScreen(s.page, 'match', 120_000);
      await waitMatch(s.page, { phase: 'playing' });
      const f0 = await settledMatchFacts(s.page);
      ok('M3', `B     precondition: a live ${SIX}-seat match`, f0.sim === SIX, `sim ${f0.sim}`);
      await tap(s.page, '.fa-match .match-chip');
      await s.page.waitForFunction(() => document.querySelector('.match-sheet')?.classList.contains('is-open'), null, { timeout: 20_000 });
      await tap(s.page, '[data-el="change"]');
      await s.page.waitForFunction(() => document.querySelector('[data-el="leave"]')?.disabled === false, null, { timeout: 20_000 });
      await tap(s.page, '[data-el="leave"]');
      await waitScreen(s.page, 'characters');
      const target = otherThan(f0.route?.player);
      await pickFighter(s.page, target);
      await judgeAfterChange(s, 'B', target);
      ok('M3', 'B     no page errors', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('M3', 'B completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // C1 — in-app Back from a lobby-entered character select.
  {
    const s = await open();
    try {
      await lobbyTo(s.page, SIX);
      await tap(s.page, '[data-el="swap"]');
      await waitScreen(s.page, 'characters');
      await tap(s.page, '[data-el="back"]');
      const where = await waitAnyScreen(s.page, ['home', 'lobby']);
      const L = where === 'lobby' ? await lobbyFacts(s.page) : null;
      ok('M3', `C1    in-app Back from a lobby-entered character select returns to the lobby, still at ${SIX}`,
        where === 'lobby' && L?.count === String(SIX) && L.rows.length === SIX, `landed on ${where}${L ? ` · count ${L.count}` : ''}`);
    } catch (err) { ok('M3', 'C1 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // C2 — browser / Android Back from the same place: the lobby re-MOUNTS from history.
  {
    const s = await open();
    try {
      await lobbyTo(s.page, SIX);
      await tap(s.page, '[data-el="swap"]');
      await waitScreen(s.page, 'characters');
      await s.page.goBack({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
      await waitScreen(s.page, 'lobby');
      const L = await lobbyFacts(s.page);
      ok('M3', `C2    Android Back to the lobby re-mounts it at ${SIX}, not at the default`,
        L.count === String(SIX) && L.rows.length === SIX && L.pressed === String(SIX), `count ${L.count} · pressed ${L.pressed}`);
    } catch (err) { ok('M3', 'C2 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // D — a RELOAD on a lobby-entered character select (tab eviction on a phone).
  {
    const s = await open();
    try {
      const L0 = await lobbyTo(s.page, SIX);
      const target = otherThan(L0.rows[0]?.char);
      await tap(s.page, '[data-el="swap"]');
      await waitScreen(s.page, 'characters');
      await s.page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitScreen(s.page, 'characters');
      await pickFighter(s.page, target);
      await judgeAfterChange(s, 'D', target);
    } catch (err) { ok('M3', 'D completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // E — CONTROL that must NOT move: the duel path (home -> Start Game -> Fight!) stays a duel
  // with `seats` ABSENT, even in a tab whose lobby was last set to six. `journey.mjs`,
  // `match-play.mjs` and `np_identity` all stand on this path.
  {
    const s = await open();
    try {
      await lobbyTo(s.page, SIX);
      await tap(s.page, '[data-el="back"]');
      await waitScreen(s.page, 'home');
      await tap(s.page, '[data-el="start"]');
      await waitScreen(s.page, 'characters');
      const dest = await tap(s.page, '[data-el="fight"]').then(() => waitAnyScreen(s.page, ['lobby', 'match']));
      if (dest === 'match') await waitMatch(s.page, { phase: null });
      const f = dest === 'match' ? await settledMatchFacts(s.page) : null;
      ok('M3', 'E     CONTROL: home -> Start Game -> Fight! is still the duel — `seats` absent on route AND URL, two in the sim',
        dest === 'match' && f.route && !('seats' in f.route && f.route.seats !== undefined) && !f.search.includes('seats=') && f.sim === 2,
        `dest ${dest}${f ? ` · route ${JSON.stringify(f.route)} · sim ${f.sim}` : ''}`);
      ok('M3', 'E     no page errors', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('M3', 'E completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §M8 — two tabs of one profile
// ═════════════════════════════════════════════════════════════════════════════
async function sectionM8() {
  head('§M8 · META-08 — two tabs (two browsing contexts, ONE storage area) no longer erase each other');
  const roadNodes = ECON.milestones().map((m) => m.trophies).filter((t) => t <= 70);
  if (!ok('M8', 'G1  at 70 trophies at least two road nodes are claimable (non-vacuity)', roadNodes.length >= 2,
    `claimable thresholds ${roadNodes.join(',')}`)) return;
  const [n1, n2] = roadNodes;
  const econ = ECON.serialize(ECON.createEconomy(424242));
  econ.trophies = 70; econ.bestTrophies = 70;
  const seed = { name: 'Seed', wins: 0, losses: 0, xp: 0, selected: 'hamburger', economy: econ };
  const read = (page) => page.evaluate((k) => {
    const p = JSON.parse(localStorage.getItem(k) ?? 'null');
    if (!p) return null;
    const held = Object.values(p.economy.containers).reduce((a, b) => a + b, 0);
    return { name: p.name, claimed: p.economy.claimed, held, coins: p.economy.coins };
  }, PROFILE_KEY);
  const gotoIn = async (page, screen) => {
    await page.goto(`${BASE}/?screen=${screen}&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await waitScreen(page, screen);
  };
  /** In-app navigation — the SAME document, so the profile instance is not rebuilt. */
  const navIn = async (page, screen) => {
    await page.evaluate((n) => window.__shell.navigate({ name: n }), screen);
    await waitScreen(page, screen);
  };
  const claim = async (page, t) => {
    await page.waitForFunction((th) => document.querySelector(`.tr-node.is-claimable[data-trophies="${th}"]`), t, { timeout: 30_000 });
    await tap(page, `.tr-node.is-claimable[data-trophies="${t}"]`);
    await sleep(400);
    await page.evaluate(() => document.querySelector('[data-el="close"]')?.click());
  };
  const typeName = async (page, name) => {
    await page.fill('[data-el="name"]', name, { timeout: 30_000 });
    await sleep(300);
  };

  // T0 — CONTROL: one document does the claim, then (in-app) the rename. Both must persist.
  {
    const s = await open({ profile: seed });
    try {
      await gotoIn(s.page, 'trophies');
      await claim(s.page, n1);
      await navIn(s.page, 'settings');
      await typeName(s.page, 'OneTab');
      const r = await read(s.page);
      ok('M8', 'T0  CONTROL: one tab, claim then rename — both persist', r?.name === 'OneTab' && r.claimed.includes(n1),
        JSON.stringify(r));
    } catch (err) { ok('M8', 'T0 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // T1..T3 — the race. B boots FIRST (its snapshot predates A's claim) and never reloads.
  {
    const s = await open({ profile: seed });
    try {
      const B = s.page;
      await gotoIn(B, 'settings');
      const tA = await newTab(s.ctx, s.errors);
      await gotoIn(tA, 'trophies');
      await tA.bringToFront();
      await claim(tA, n1);
      const afterA = await read(tA);
      ok('M8', `T1  precondition: tab A's claim of the ${n1} node is in storage`, afterA?.claimed.includes(n1), JSON.stringify(afterA));
      const loadsB = await B.evaluate(() => performance.getEntriesByType('navigation').length);
      // A goes HOME (in-app) so the storage-event half is observable: its name badge.
      await navIn(tA, 'home');
      const originA = await tA.evaluate(() => performance.timeOrigin);
      await B.bringToFront();
      await sleep(500);
      await typeName(B, 'TabB');
      const afterB = await read(B);
      await shot(B, 'm8_tabB_settings');
      ok('M8', `T1  🚨 tab B's rename does NOT undo tab A's claim (B booted before it and never reloaded: ${loadsB} load)`,
        afterB?.name === 'TabB' && afterB.claimed.includes(n1) && afterB.held === afterA.held,
        `after B: ${JSON.stringify(afterB)} · after A: ${JSON.stringify(afterA)}`);
      // T2 — A, which wrote first, is told: its badge follows storage without a reload.
      // ⚠️ 20 s and INTERVAL polling, not 4 s on rAF: the first cut timed out at 4 s on a
      // loaded machine with the badge already reading "TabB" in the PNG taken a moment later —
      // the storage event reaches a BACKGROUND tab as a queued task, and rAF polling does not
      // run until the tab is foregrounded and painting. The elapsed time is printed, so a slow
      // delivery reads as slow rather than as absent. `timeOrigin` proves it is one document.
      await tA.bringToFront();
      const t0 = Date.now();
      const badge = await tA.waitForFunction(() => document.querySelector('[data-el="name"]')?.textContent?.trim() === 'TabB',
        null, { timeout: 20_000, polling: 250 }).then(() => 'TabB')
        .catch(async () => tA.evaluate(() => document.querySelector('[data-el="name"]')?.textContent?.trim()));
      const waited = Date.now() - t0;
      const sameDoc = (await tA.evaluate(() => performance.timeOrigin)) === originA;
      await shot(tA, 'm8_tabA_home');
      ok('M8', 'T2  tab A\'s home badge shows B\'s rename without a reload (it no longer displays a state storage does not hold)',
        badge === 'TabB' && sameDoc, `badge "${badge}" after ${waited} ms · same document ${sameDoc}`);
      // T3 — the REVERSE: A (booted before B's rename, never reloaded) makes the next write.
      await navIn(tA, 'trophies');
      await claim(tA, n2);
      const afterA2 = await read(tA);
      ok('M8', `T3  🚨 tab A's next write (claiming ${n2}) does NOT undo tab B's rename — and keeps both claims`,
        afterA2?.name === 'TabB' && afterA2.claimed.includes(n1) && afterA2.claimed.includes(n2), JSON.stringify(afterA2));
      ok('M8', 'E   no page errors in either tab', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('M8', 'T1-T3 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// §ML4 — Back during a LIVE match opens the pause sheet (DECISIONS §31)
// ═════════════════════════════════════════════════════════════════════════════
async function sectionML4() {
  head('§ML4 · ML-4 — Back during a live match opens the pause sheet; after the whistle it leaves');
  const state = (page) => page.evaluate((k) => ({
    screen: window.__screen,
    same: window.__matchDebug !== undefined && window.__matchDebug === window.__b6mark,
    sheet: !!document.querySelector('.match-sheet')?.classList.contains('is-open'),
    paused: window.__matchDebug ? window.__matchDebug.paused : null,
    phase: window.__matchDebug ? window.__matchDebug.phase : null,
    search: location.search,
    stateRoute: history.state && history.state.route ? history.state.route.name : null,
    blob: localStorage.getItem(k),
  }), PROFILE_KEY);
  /** Back, then give a remount ample time to happen — the curtain alone is 140 ms. */
  const back = async (page) => {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await sleep(2500);
    return state(page);
  };

  // L1/L2 — a duel started the player's way (character select -> Fight!).
  {
    const s = await open();
    try {
      await s.page.goto(`${BASE}/?screen=characters&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitScreen(s.page, 'characters');
      await tap(s.page, '[data-el="fight"]');
      await waitScreen(s.page, 'match', 120_000);
      await waitMatch(s.page, { phase: 'playing' });
      await s.page.evaluate(() => { window.__b6mark = window.__matchDebug; });
      const before = await state(s.page);
      const after = await back(s.page);
      await shot(s.page, 'ml4_duel_after_back');
      ok('ML4', 'L1  🚨 Back during a live duel does NOT leave the match — the SAME session is still mounted',
        after.screen === 'match' && after.same, `screen ${after.screen} · same session ${after.same}`);
      ok('ML4', 'L1  ...it opens the pause sheet and the match is paused', after.sheet && after.paused === true,
        `sheet ${after.sheet} · paused ${after.paused}`);
      ok('ML4', 'L1  ...the address bar and history.state still name the match', after.search.includes('screen=match') && after.stateRoute === 'match',
        `${after.search} · state ${after.stateRoute}`);
      ok('ML4', 'L1  ...and nothing was banked (the profile blob is byte-identical)', after.blob === before.blob,
        `${before.blob === null ? 'absent' : `${before.blob.length} B`} -> ${after.blob === null ? 'absent' : `${after.blob.length} B`}`);
      if (after.screen === 'match' && after.same) {
        const again = await back(s.page);
        ok('ML4', 'L2  a second Back does what Escape does with the sheet open — closes it and resumes, still the same match',
          again.screen === 'match' && again.same && !again.sheet && again.paused === false,
          `screen ${again.screen} · sheet ${again.sheet} · paused ${again.paused}`);
      } else {
        ok('ML4', 'L2  a second Back closes the sheet (not reachable — L1 already left the match)', false, 'skipped: depends on L1');
      }
      ok('ML4', 'L   no page errors', s.errors.length === 0, s.errors.slice(0, 2).join(' | '));
    } catch (err) { ok('ML4', 'L1/L2 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // L3 — the owner's mode: six seats, started from the lobby.
  {
    const s = await open();
    try {
      await lobbyTo(s.page, SIX);
      await tap(s.page, '[data-el="start"]');
      await waitScreen(s.page, 'match', 120_000);
      await waitMatch(s.page, { phase: 'playing' });
      await s.page.evaluate(() => { window.__b6mark = window.__matchDebug; });
      const after = await back(s.page);
      const sim = await s.page.evaluate(() => (window.__matchDebug ? window.__matchDebug.loadouts.length : null));
      ok('ML4', `L3  🚨 Back during a live ${SIX}-seat match keeps it — same session, sheet open, ${SIX} seats`,
        after.screen === 'match' && after.same && after.sheet && sim === SIX, `screen ${after.screen} · same ${after.same} · sheet ${after.sheet} · sim ${sim}`);
    } catch (err) { ok('ML4', 'L3 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }

  // L4 — CONTROL that must not move: after the whistle there is nothing to abandon, the
  // result is banked, and Back leaves exactly as before.
  {
    const s = await open();
    try {
      await s.page.goto(`${BASE}/?screen=characters&pointerLock=0&simSpeed=50`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await waitScreen(s.page, 'characters');
      await tap(s.page, '[data-el="fight"]');
      await waitScreen(s.page, 'match', 120_000);
      await waitMatch(s.page, { phase: 'ended' });
      await sleep(500);
      await s.page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
      const where = await waitAnyScreen(s.page, ['characters', 'home'], 30_000).catch(() => null);
      ok('ML4', 'L4  CONTROL: Back on the RESULT card (match decided) still leaves to the screen that started it',
        where === 'characters', `landed on ${where}`);
    } catch (err) { ok('ML4', 'L4 completed', false, String(err).split('\n')[0]); } finally { await s.ctx.close(); }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
try {
  // Warm the snapshot: its FIRST client eats Vite's dep-optimisation reload (AGENT-BRIEF §3).
  {
    const s = await open();
    await s.page.goto(`${BASE}/?screen=home&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 180_000 }).catch(() => {});
    await s.page.waitForFunction(() => window.__screen === 'home', null, { timeout: 180_000 }).catch(() => {});
    await s.ctx.close();
  }
  if (ONLY.includes('m7')) await sectionM7();
  if (ONLY.includes('m8')) await sectionM8();
  if (ONLY.includes('m3')) await sectionM3();
  if (ONLY.includes('ml4')) await sectionML4();
} finally {
  await browser.close();
}

const failed = rows.filter((r) => !r.pass);
console.log(`\n══ b6_screens: ${rows.length - failed.length}/${rows.length} rows pass  [${ONLY.join(',')}]  ${BASE}`);
for (const sec of [...new Set(rows.map((r) => r.sec))]) {
  const rs = rows.filter((r) => r.sec === sec);
  console.log(`   ${sec.padEnd(4)} ${rs.filter((r) => r.pass).length}/${rs.length}`);
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), only: ONLY, rows }, null, 1));
process.exit(failed.length === 0 ? 0 : 1);
