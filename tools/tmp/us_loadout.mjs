#!/usr/bin/env node
/**
 * US_LOADOUT — does the equipped loadout REACH the match, in the shipped browser?
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/us_loadout.mjs --url '{URL}'
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/us_loadout.mjs --url '{URL}'
 *   node tools/tmp/us_loadout.mjs --url <base> --arm nostore    # a known-bad; §A must go RED
 *   node tools/tmp/us_loadout.mjs --url <base> --shot tools/tmp/us_shots
 *
 * ⚠️ `--url` must be a SNAPSHOT, never `:5173` (`CLAUDE.md` #2). The placeholder is
 * literally `{URL}` and MUST BE QUOTED or zsh brace-expands it away.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  WHY THIS EXISTS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Uri: *"how do i use an item in a game?"* — and the answer was **you cannot**.
 * `lobby.ts:LOADOUT_REACHES_MATCH` was `false` and named the two hops: `GameSessionOptions`
 * had no `items` field, and `matchScreen.ts` never called `loadEquipped`. Both are closed.
 *
 * `ul_seam.mjs` §W checks that the CONSTANT agrees with the SOURCE — evidence about text.
 * `sim.test.mjs` §41(i) checks that `createMatch` seats a loadout — evidence about the sim,
 * with no browser in it. **Neither can see the product path**, and the product path is where
 * this feature was dead: `src/ui/**` uses extension-less specifiers and pulls in Three.js
 * plus a module-scope `document.createElement('canvas')`, so `node` cannot load
 * `matchScreen.ts` at all (`sp6_play.mjs`'s header records the 1.2 MB esbuild bridge that
 * died on `ReferenceError: document is not defined`).
 *
 * So this drives the real screens in a real browser and reads
 * **`window.__matchDebug.loadouts`**, which `match.ts:spawnMatch` fills from
 * `Fighter.item.equipped` — the sim's own state after `createFighter` ran, **not** the
 * option that was passed in. A probe reading the option would go green on a tree where
 * `newMatch` dropped the loadout on the floor.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 *  SECTIONS, AND THE ARM THAT TURNS EACH ONE RED
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   §G  NON-VACUITY. The page booted, a match exists, and `loadouts` is a real array with
 *       one entry per seat. **Nothing below runs if §G fails** — every "slot k is empty"
 *       row would otherwise pass over `undefined`.
 *   §A  THE DUEL — the SHIPPED DEFAULT. `seatCountFor(MIN_FIGHTERS)` maps the lobby's 2 to
 *       `seats: undefined`, so this is the branch every navigation lands on and the one a
 *       six-seat-only fix would have left dead. **RED under `--arm nostore`**, which clears
 *       the storage key: the row is falsified by the off-state, which is the only thing
 *       that makes it a measurement of the LOADOUT and not of the number 1.
 *   §B  SIX SEATS. Slot 0 carries it and **the other five do not** — one other seat can be
 *       right by luck; five cannot. **RED under `--arm nostore` as well**, so §B is
 *       falsified by the off-state and not only by §A's.
 *       ⚠️ **THIS ROW USED TO CITE `--arm broadcast`, AN ARM THAT WAS NEVER WRITTEN.** It
 *       was a fabricated citation in a tool built to replace fabricated citations, in the
 *       same file that names `il_seam.mjs` and `ul_accept.mjs` for the same crime. Deleted
 *       and recorded rather than quietly removed. A browser-side leak known-bad would need
 *       `match.ts` mutated under the snapshot; the leak is falsified instead at the sim
 *       level, where it is cheap and exact — `sim.test.mjs` §41(i) known-bad C plants a
 *       leak to EVEN slots and turns exactly the six-seat row red.
 *   §C  🚨 THE HOSTILE BLOB. `state.ts:validateLoadout` THROWS a `RangeError` from inside
 *       `createMatch`, so a hand-edited or format-drifted `localStorage` value could stop a
 *       match starting from a screen with no error surface. Six malformed shapes are
 *       written and the match must START each time. **And the same six are handed to the
 *       raw sim in the page and must THROW** — otherwise this section is asserting that
 *       nothing was ever dangerous.
 *       ⚠️ §C also drives `?items=`, which is the ONLY path that reaches
 *       `match.ts:sanitiseLoadout` unaided: everything from `localStorage` has already been
 *       through `lobby.ts:loadEquipped`, so the storage arms cannot tell a working
 *       `sanitiseLoadout` from an absent one.
 *   §D  THE PRODUCT PATH, END TO END: `?screen=lobby` → tap slot → tap an item → tap Start
 *       → the item is on `Fighter.item.equipped`. No storage written by this tool, no URL
 *       parameter: every hop is a finger.
 *   §E  PIXELS. The frames are written out and MUST BE LOOKED AT (`CLAUDE.md` #3).
 *
 * ⚠️ **RESOLUTION FLOOR: NONE.** Every asserted row is a set equality, an integer equality
 * or a thrown/not-thrown. Nothing here is a measurement with noise in it.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// 🚨 IS_MAIN GUARD — `AGENT-BRIEF §3`: three tools here made a function importable and
// silently ran their whole CLI path on import; one of them launched Chromium.
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const ARM = flag('arm', 'base');
const SHOT = flag('shot', null);

const PLAYER = 'hamburger';
const ENEMY = 'donut';
const KEY = 'food-arena.loadout.v1';

const rows = [];
function check(section, name, pass, evidence = '') {
  rows.push({ section, name, pass, evidence });
  console.log(`  ${pass ? '✓' : '✗'} §${section} ${name}${evidence ? `  — ${evidence}` : ''}`);
  return pass;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page-side reads. Stringified because they run in the browser, which is the only
// place `src/ui/**` resolves.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE OBSERVABLE. `match.ts:spawnMatch` fills `__matchDebug.loadouts` from
 * `fightersOf(state)[k].item.equipped` — the sim's state after `createFighter` and
 * `validateLoadout` ran.
 *
 * 🚨 It is deliberately NOT `GameSessionOptions.items`. `AGENT-BRIEF §4b`: *"measure the
 * observable, not the field you added to measure it with."* An arm reading back the option
 * would be green on a tree where `newMatch` never used it.
 */
const PAGE_LOADOUTS = () => ({
  loadouts: window.__matchDebug?.loadouts ?? null,
  plates: document.querySelectorAll('.hud-fighter').length,
  phase: window.__matchDebug?.phase ?? null,
  frames: window.__matchDebug?.frames ?? null,
  screen: window.__screen ?? null,
});

/**
 * §C's second half, and the half that makes the first half mean anything.
 *
 * Hands each malformed blob STRAIGHT to the sim, in the page, bypassing every filter, and
 * reports whether `createMatch` threw. If these came back "fine", §C would be asserting
 * that the filtering saved us from nothing.
 */
const PAGE_RAW_SIM = async (blobs) => {
  const S = await import('/src/game/sim.ts');
  const arena = window.__matchArena;
  if (!arena) return { arena: false, results: [] };
  const results = blobs.map((raw) => {
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { return { raw, parseFailed: true, threw: null }; }
    if (!Array.isArray(parsed)) return { raw, notArray: true, threw: null };
    try {
      S.createMatch(arena, [
        { characterId: 'hamburger', items: parsed },
        { characterId: 'donut' },
      ]);
      return { raw, threw: false };
    } catch (e) { return { raw, threw: true, msg: String(e && e.message).slice(0, 60) }; }
  });
  return { arena: true, results };
};

// ─────────────────────────────────────────────────────────────────────────────

async function newPage(browser, { storage = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // A peer's save must not reload the page mid-run. The snapshot freezes the tree; this
  // closes the HMR socket as well.
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));
  // 🚨 SEEDED BEFORE THE APP RUNS, NEVER AFTER. `matchScreen.ts` reads the key at mount;
  // an `evaluate` after `goto` would set it AFTER the match had already been built and the
  // whole run would measure a reload. `addInitScript` also avoids `AGENT-BRIEF §3`'s
  // transient-user-activation trap, since it is not a gesture.
  if (storage !== null) {
    await page.addInitScript(([k, v]) => {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ }
    }, [KEY, storage]);
  }
  return { page, errors };
}

/**
 * Drive BOTH loadout channels at once with DIFFERENT items, and report what arrived.
 *
 * The URL item is chosen as one the stored pair does NOT contain, so "the stored pair won"
 * and "the URL won" are distinguishable answers rather than the same array.
 */
async function p2t(browser, pair) {
  const { page } = await newPage(browser, { storage: JSON.stringify(pair) });
  await page.goto(`${BASE}/?player=${PLAYER}&enemy=${ENEMY}&pointerLock=0`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  const url = await page.evaluate(async (equipped) => {
    const R = await import('/src/game/rules.ts');
    return Object.keys(R.ITEMS).find((id) => !equipped.includes(id)) ?? null;
  }, pair);
  await page.close();
  const { page: p } = await newPage(browser, { storage: JSON.stringify(pair) });
  await goMatch(p, `&items=${url}`);
  const r = await p.evaluate(PAGE_LOADOUTS);
  await p.close();
  return { url, got: r.loadouts?.[0] ?? [] };
}

async function goMatch(page, extra = '') {
  await page.goto(`${BASE}/?player=${PLAYER}&enemy=${ENEMY}&pointerLock=0${extra}`,
    { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  // `__gameReady` is not a match. Wait for the debug mirror to carry a real roster.
  await page.waitForFunction(() => Array.isArray(window.__matchDebug?.loadouts)
    && window.__matchDebug.loadouts.length > 0, null, { timeout: 60_000 });
}

/** A pair that exists in the registry, read from the page rather than typed here. */
async function realPair(page) {
  return page.evaluate(async () => {
    const R = await import('/src/game/rules.ts');
    return Object.keys(R.ITEMS).slice(0, R.ITEM_SLOTS);
  });
}

// ═════════════════════════════════════════════════════════════════════════════

async function run() {
  if (!BASE) {
    console.error('us_loadout: --url is required and must be a SNAPSHOT (never :5173).');
    process.exit(2);
  }
  if (/:5173(\/|$)/.test(BASE)) {
    console.error(`us_loadout: refusing to measure the shared dev server (${BASE}) — CLAUDE.md #2.`);
    process.exit(2);
  }
  if (SHOT) mkdirSync(SHOT, { recursive: true });
  const browser = await chromium.launch();
  console.log(`\n══ US_LOADOUT ══  ${BASE}  arm=${ARM}\n`);

  // ── §G ── NON-VACUITY. Nothing below is interpretable without this.
  let PAIR;
  {
    const { page, errors } = await newPage(browser, { storage: null });
    await goMatch(page);
    PAIR = await realPair(page);
    const r = await page.evaluate(PAGE_LOADOUTS);
    const ok1 = check('G', 'the shipped duel booted and the QA mirror carries one loadout PER SEAT',
      Array.isArray(r.loadouts) && r.loadouts.length === r.plates && r.plates === 2,
      `${r.plates} plates, loadouts ${JSON.stringify(r.loadouts)}, phase ${r.phase}`);
    const ok2 = check('G', 'the registry supplied a real pair to equip (non-empty before anything is quantified)',
      Array.isArray(PAIR) && PAIR.length === 2, JSON.stringify(PAIR));
    const ok3 = check('G', 'no page errors on a clean boot', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
    if (!(ok1 && ok2 && ok3)) { await finish(browser); return; }
  }

  // ── §A ── THE DUEL. The shipped default, and the branch a six-seat-only fix misses.
  {
    // `--arm nostore` clears the key. The row must go RED, or it is measuring nothing.
    const storage = ARM === 'nostore' ? null : JSON.stringify(PAIR);
    const { page, errors } = await newPage(browser, { storage });
    await goMatch(page);
    const r = await page.evaluate(PAGE_LOADOUTS);
    const slot0 = r.loadouts?.[0] ?? [];
    const slot1 = r.loadouts?.[1] ?? [];
    check('A', 'the equipped pair ARRIVES on the local seat\'s `Fighter.item.equipped` (duel path)',
      slot0.length === PAIR.length && slot0.every((id, k) => id === PAIR[k]),
      `slot 0 ${JSON.stringify(slot0)} vs stored ${JSON.stringify(PAIR)}`);
    check('A', '…and the bot seat carries NOTHING — the loadout is the local seat\'s, not the match\'s',
      slot1.length === 0, `slot 1 ${JSON.stringify(slot1)}`);
    check('A', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    if (SHOT) await page.screenshot({ path: `${SHOT}/A-duel-equipped.png` });
    await page.close();
  }

  // ── §B ── SIX SEATS. Five other seats, not one.
  {
    // `--arm nostore` falsifies this section too, not only §A: a six-seat row that could
    // only ever be red for the same reason as a two-seat row is not a six-seat measurement.
    const storage = ARM === 'nostore' ? null : JSON.stringify(PAIR);
    const { page, errors } = await newPage(browser, { storage });
    await goMatch(page, '&seats=6');
    const r = await page.evaluate(PAGE_LOADOUTS);
    const loadouts = r.loadouts ?? [];
    check('B', 'six seats really seated six', r.plates === 6 && loadouts.length === 6,
      `${r.plates} plates, ${loadouts.length} loadouts`);
    check('B', 'slot 0 carries the equipped pair on the ROSTER path too',
      (loadouts[0] ?? []).join(',') === PAIR.join(','), JSON.stringify(loadouts[0]));
    const others = loadouts.slice(1);
    check('B', 'NON-VACUITY: there are five other seats to check',
      others.length === 5, `${others.length}`);
    check('B', '…and none of the five carries anything — a partial leak is invisible at two seats',
      others.length === 5 && others.every((l) => Array.isArray(l) && l.length === 0),
      JSON.stringify(loadouts));
    check('B', 'no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    if (SHOT) await page.screenshot({ path: `${SHOT}/B-six-seats.png` });
    await page.close();
  }

  // ── §C ── 🚨 THE HOSTILE BLOB. Both halves, or neither means anything.
  {
    const BLOBS = [
      'not json at all',
      '{"equipped":["tenderiser"]}',
      JSON.stringify([PAIR[0], PAIR[1], 'liquorice']),   // over-full: validateLoadout THROWS
      JSON.stringify([PAIR[0], PAIR[0]]),                // duplicate: validateLoadout THROWS
      JSON.stringify(['definitely_not_an_item']),        // unknown id: validateLoadout THROWS
      JSON.stringify([17, null, PAIR[0]]),               // non-string members
    ];
    let started = 0;
    let clean = 0;
    const detail = [];
    for (const blob of BLOBS) {
      const { page, errors } = await newPage(browser, { storage: blob });
      let ok = false;
      try {
        await goMatch(page);
        const r = await page.evaluate(PAGE_LOADOUTS);
        ok = Array.isArray(r.loadouts) && r.loadouts.length === 2;
        if (ok) started++;
        if (errors.length === 0) clean++;
        detail.push(`${blob.slice(0, 22)} -> ${JSON.stringify(r.loadouts?.[0] ?? null)}`);
      } catch (e) {
        detail.push(`${blob.slice(0, 22)} -> DID NOT START (${String(e.message).slice(0, 40)})`);
      }
      await page.close();
    }
    check('C', 'NON-VACUITY: six hostile shapes were actually driven',
      BLOBS.length === 6, `${BLOBS.length} blobs`);
    check('C', '🔴 EVERY malformed `localStorage` blob still STARTS a match — the filter is on the way IN',
      started === BLOBS.length, `${started}/${BLOBS.length} started · ${detail.join(' | ')}`);
    check('C', '…and none of them logged a page error',
      clean === BLOBS.length, `${clean}/${BLOBS.length} clean`);

    // 🚨 THE HALF THAT PROVES THE OTHER HALF. If the raw sim accepted these, the rows
    // above would be asserting that we were never in danger.
    const { page } = await newPage(browser, { storage: null });
    await goMatch(page);
    const raw = await page.evaluate(PAGE_RAW_SIM, BLOBS);
    const arrayBlobs = raw.results.filter((x) => x.threw !== null);
    check('C', 'NON-VACUITY: some blobs reach `createMatch` at all (the rest fail JSON/array first)',
      arrayBlobs.length > 0, `${arrayBlobs.length} of ${raw.results.length} are arrays`);
    check('C', '🔴 …and EVERY ONE of those makes the raw sim THROW — `validateLoadout` is NOT weakened',
      arrayBlobs.length > 0 && arrayBlobs.every((x) => x.threw === true),
      arrayBlobs.map((x) => `${x.raw.slice(0, 20)}:${x.threw ? 'THREW' : 'accepted'}`).join(' | '));
    await page.close();

    // 🚨 THE ONLY PATH THAT REACHES `match.ts:sanitiseLoadout` UNAIDED.
    //
    // Every arm above arrives through `localStorage`, and `lobby.ts:loadEquipped` has
    // already dropped anything hostile before `match.ts` sees it — so those rows cannot
    // distinguish a working `sanitiseLoadout` from one that was never called. `?items=`
    // bypasses `loadEquipped` entirely: it is a raw string straight off the URL. This is
    // the row that would go red if that function were deleted.
    const hostileUrl = `${PAIR[0]},${PAIR[0]},nonsense,${PAIR[1]},also_nonsense`;
    const { page: p2, errors: e2 } = await newPage(browser, { storage: null });
    await goMatch(p2, `&items=${hostileUrl}`);
    const r2 = await p2.evaluate(PAGE_LOADOUTS);
    const got = r2.loadouts?.[0] ?? [];
    check('C', '🔴 `?items=` with a duplicate, two unknown ids and an over-full list still STARTS,'
      + ' and lands a LEGAL loadout — this is the only arm that exercises `sanitiseLoadout`',
      Array.isArray(got) && got.length > 0 && got.length <= 2
      && new Set(got).size === got.length && got.every((id) => typeof id === 'string'),
      `?items=${hostileUrl} -> ${JSON.stringify(got)}`);
    check('C', 'no page errors on the `?items=` path', e2.length === 0, e2.slice(0, 2).join(' | '));
    await p2.close();

    // ⚠️ THE PRECEDENCE ROW, AND THE FIRST DRAFT OF IT WAS `check(..., true, 'by
    // construction')` — a comment with a tick next to it, which is the exact shape
    // `AGENT-BRIEF §4.4` says to ask "what implementation would fail this?" about. Nothing
    // would. So it is driven instead: BOTH channels carry a DIFFERENT item and the equipped
    // one has to win, which is red the day `match.ts` flips the `??`.
    const other = await p2t(browser, PAIR);
    check('C', '🔴 a real equipped loadout BEATS `?items=` — a URL that silently overrode the'
      + ' player\'s equipment would be a second source of truth for the loadout',
      other.got.join(',') === PAIR.join(','),
      `stored ${JSON.stringify(PAIR)} + ?items=${other.url} -> ${JSON.stringify(other.got)}`);
  }

  // ── §D ── THE PRODUCT PATH. Every hop is a finger.
  {
    const { page, errors } = await newPage(browser, { storage: null });
    await page.goto(`${BASE}/?screen=lobby&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__screen === 'lobby', null, { timeout: 120_000 });
    // Open the picker on slot 0, then take the first ENABLED row — "first enabled" rather
    // than a typed id, so the row does not go green on a build where that one item stopped
    // being ownable.
    await page.click('[data-el="slot"][data-slot="0"]');
    await page.waitForSelector('[data-item]:not([disabled])', { timeout: 30_000 });
    const picked = await page.evaluate(() => {
      const b = document.querySelector('[data-item]:not([disabled])');
      return b ? b.getAttribute('data-item') : null;
    });
    check('D', 'NON-VACUITY: the picker offered at least one ownable item to tap',
      typeof picked === 'string' && picked.length > 0, String(picked));
    if (picked) {
      await page.click(`[data-item="${picked}"]`);
      await page.click('[data-el="start"]');
      await page.waitForFunction(() => window.__screen === 'match', null, { timeout: 120_000 });
      await page.waitForFunction(() => Array.isArray(window.__matchDebug?.loadouts)
        && window.__matchDebug.loadouts.length > 0, null, { timeout: 120_000 });
      const r = await page.evaluate(PAGE_LOADOUTS);
      check('D', '🔴 LOBBY TAP -> START -> the item is on `Fighter.item.equipped`. No storage written'
        + ' by this tool, no URL parameter — this is the path Uri walks.',
        (r.loadouts?.[0] ?? []).includes(picked),
        `tapped ${picked}, slot 0 ${JSON.stringify(r.loadouts?.[0] ?? null)}`);
      check('D', '…and it still routed through the DUEL (the lobby maps 2 to `seats: undefined`)',
        r.plates === 2, `${r.plates} plates`);
      if (SHOT) await page.screenshot({ path: `${SHOT}/D-after-lobby-tap.png` });
    }
    check('D', 'no page errors on the product path', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
  }

  // ── §E ── PIXELS. Written for a HUMAN to open — `CLAUDE.md` #3.
  if (SHOT) {
    const { page } = await newPage(browser, { storage: JSON.stringify(PAIR) });
    await page.goto(`${BASE}/?screen=lobby&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForFunction(() => window.__screen === 'lobby', null, { timeout: 120_000 });
    await page.screenshot({ path: `${SHOT}/E-lobby-equipped.png` });
    await page.close();
    console.log(`\n  ⚠️  ${SHOT}/*.png written. READ THEM. A green row is not a picture.`);
  }

  await finish(browser);
}

async function finish(browser) {
  await browser.close();
  const bad = rows.filter((r) => !r.pass);
  console.log(`\nus_loadout: ${rows.length} rows, ${rows.length - bad.length} pass, ${bad.length} fault(s)`);
  if (bad.length) console.log(`  failed: ${bad.map((r) => `§${r.section} ${r.name}`).join(' | ')}`);
  if (ARM !== 'base') {
    console.log(`\n  ⚠️  arm=${ARM} is a KNOWN-BAD. A CLEAN SHEET HERE IS THE FAILURE.`);
  }
  process.exitCode = bad.length === 0 ? 0 : 1;
}

if (IS_MAIN) await run();
