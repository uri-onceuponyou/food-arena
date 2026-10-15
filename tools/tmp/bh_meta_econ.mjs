#!/usr/bin/env node
/**
 * bh_meta_econ — REVIEW-phase probe (2026-10-15) for the META / ECONOMY / ITEM-LOADOUT
 * dimension. Pure Node, real `src/game/**` modules, no browser, writes NOTHING tracked.
 *
 * It imports the sim and the economy out of `--root` (default: the campaign's clean
 * detached worktree of 1090046), so every number describes a commit that exists.
 *
 *   node tools/tmp/bh_meta_econ.mjs [--root /private/tmp/fa-rv-head] [--out <json>]
 *
 * ── §1 GRANT-ALL — does `ITEM_TEST_GRANT_ALL` reach the ECONOMY LEDGER? ──────────
 *   Reads the flag, then asks the ledger itself: a new player, a pre-items blob, and a
 *   200-chest career on a fresh economy. If the switch had leaked into `createEconomy`/
 *   `deserialize`/`ownedItemSet`, a new player would own 10 and no chest could ever
 *   award a NEW item. Control: the same career with every item pre-owned must award 0
 *   new items (proves the "new item" counter can read zero).
 *
 * ── §2 THE KNOCKOUT WINDOW — can a decided result be abandoned? ───────────────────
 *   Every ordered (player, enemy) pair through `brawlRoster` at N=2 and N=6, all seats
 *   AI-driven (slot 0 is the stand-in for the player). For each match: the tick slot 0
 *   is knocked out, the phase AFTER that tick, slot 0's PROVISIONAL place
 *   (`resolvePlaces` on the state at that tick) and its FINAL place.
 *     * window  = slot 0 dead while `phase === 'playing'` — the state in which
 *                 `matchScreen.ts`'s pause sheet can still Quit, and Quit banks nothing.
 *     * fixed   = provisional place === final place, i.e. the result is already decided.
 *   KNOWN-BADS / CONTROLS, both directions:
 *     * N=2 must show ZERO windows while slot 0 dies in a non-empty set of matches (the
 *       defect class cannot express below three seats — a row that passes there
 *       vacuously is asserted non-empty first).
 *     * a planted SLOT-ORDER resolver (the pre-`7743f08` defect) must BREAK "fixed" on
 *       the same corpus, so "fixed" is shown able to fail.
 *   Then prices it: trophy EV per match, honest vs. "leave whenever the decided delta is
 *   negative", at three standings, through `placementTrophyDelta`/`placementCoins`.
 *
 * ── §3 GHOST LOADOUT — `raw in ITEMS` admits Object.prototype keys ────────────────
 *   `state.ts:validateLoadout` (and `match.ts:sanitiseLoadout`, same predicate) test
 *   membership with `in`. Control: a plain typo must THROW. Defect: `constructor` /
 *   `toString` must not be accepted as an item.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const A = process.argv.slice(2);
const arg = (k, d) => (A.includes(k) ? A[A.indexOf(k) + 1] : d);
const ROOT = resolve(arg('--root', '/private/tmp/fa-rv-head'));
const OUT = resolve(arg('--out', 'shots/rv/bugs/meta/bh_meta_econ.json'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

const rows = [];
let faults = 0;
function ok(sec, name, pass, detail = '') {
  rows.push({ sec, name, pass: !!pass, detail });
  if (!pass) faults++;
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${sec} ${name}${detail ? `  — ${detail}` : ''}`);
}

const E = await imp('src/game/economy/index.ts');
const RULES = await imp('src/game/rules.ts');
const SIM = await imp('src/game/sim.ts');
const ROSTER = await imp('src/game/roster.ts');
const STATE = await imp('src/game/state.ts');
const BRAWL = await imp('src/ui/screens/brawl.ts');
const RAW = JSON.parse(readFileSync(join(ROOT, 'tools/arena.gameplay.json'), 'utf8'));
const ARENA = { ...RAW, build: () => null, update: () => {} };
console.log(`bh_meta_econ  root=${ROOT}`);
const report = { root: ROOT, at: new Date().toISOString() };

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n§1 GRANT-ALL — the switch versus the ledger');
{
  report.ITEM_TEST_GRANT_ALL = E.ITEM_TEST_GRANT_ALL;
  console.log(`    tuning.ts ITEM_TEST_GRANT_ALL = ${E.ITEM_TEST_GRANT_ALL}  · STARTER_ITEM = ${E.STARTER_ITEM}`);
  const fresh = E.createEconomy(12345);
  ok('§1', 'a brand-new ledger owns exactly the starter item',
    fresh.items.length === 1 && fresh.items[0] === E.STARTER_ITEM, JSON.stringify(fresh.items));
  const legacy = E.deserialize({ trophies: 300, coins: 900 });
  ok('§1', 'a pre-items blob deserialises to exactly the starter item',
    legacy.items.length === 1 && legacy.items[0] === E.STARTER_ITEM, JSON.stringify(legacy.items));

  // A 200-chest career on a fresh ledger: count NEW item grants.
  const career = (preOwnAll) => {
    const s = E.createEconomy(777);
    if (preOwnAll) s.items = [...E.ITEM_IDS];
    s.containers.chest = 400; s.containers.hamburgerBox = 100;
    let newItems = 0; let dupItems = 0;
    for (let i = 0; i < 400; i++) {
      const r = E.openContainer(s, i % 4 === 0 ? 'hamburgerBox' : 'chest');
      if (!r) break;
      newItems += r.reward.items.length;
      if (r.duplicateItemOf) dupItems++;
    }
    return { newItems, dupItems, owned: s.items.length };
  };
  const live = career(false);
  const ctrl = career(true);
  report.grantAllCareer = { live, ctrl };
  ok('§1', 'CONTROL: with all ten pre-owned, the same 400 opens award 0 new items (the counter can read zero)',
    ctrl.newItems === 0 && ctrl.dupItems > 0, JSON.stringify(ctrl));
  ok('§1', 'a fresh ledger still ACQUIRES items through the shipped roller (economy untouched by the switch)',
    live.newItems > 0, JSON.stringify(live));
  const src = ['state.ts', 'containers.ts', 'trophyRoad.ts', 'reward.ts', 'levels.ts', 'store.ts']
    .map((f) => [f, readFileSync(join(ROOT, 'src/game/economy', f), 'utf8').includes('ITEM_TEST_GRANT_ALL')]);
  ok('§1', 'no economy logic module reads ITEM_TEST_GRANT_ALL (only the declaration in tuning.ts)',
    src.every(([, has]) => !has), src.filter(([, h]) => h).map(([f]) => f).join(',') || 'none');
  // The comment in tuning.ts claims the opposite — record the claim so the report can cite it.
  const tuningSrc = readFileSync(join(ROOT, 'src/game/economy/tuning.ts'), 'utf8');
  report.tuningClaimsDeserializeApplies = /`deserialize` applies it too/.test(tuningSrc);
  const lobbySrc = readFileSync(join(ROOT, 'src/ui/screens/lobby.ts'), 'utf8');
  report.lobbyAppliesGrant = /if \(ITEM_TEST_GRANT_ALL\) return new Set\(ITEM_IDS\);/.test(lobbySrc);
  ok('§1', 'the grant is applied at the SCREEN (lobby.ts:ownedItems) — which is what matchScreen passes to loadEquipped',
    report.lobbyAppliesGrant, '');
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n§2 THE KNOCKOUT WINDOW — decided result, match still playing');
const { createMatch, stepMatch } = SIM;
const { resolvePlaces } = ROSTER;
const IDS = RULES.CHARACTER_IDS;
const DT = 1000 / 60;

function placementInput(state, eliminated) {
  return {
    seats: state.fighters.map((f, i) => ({
      id: i, alive: f.alive, hp: f.hp, maxHp: f.maxHp, x: f.x, y: f.y, deaths: f.deaths,
    })),
    center: { x: ARENA.center.x, y: ARENA.center.y },
    eliminated: eliminated.slice(),
    winnerId: state.winnerId ?? null,
  };
}
/** The pre-`7743f08` defect: losers in SLOT order. Used only as a known-bad. */
function slotOrderPlaces(input) {
  const alive = input.seats.filter((s) => s.alive && s.hp > 0).map((s) => s.id);
  const dead = input.seats.filter((s) => !(s.alive && s.hp > 0)).map((s) => s.id);
  return [...alive, ...dead];
}

function play(n, player, enemy) {
  const roster = BRAWL.brawlRoster(player, enemy, n);
  const configs = roster.map((characterId) => ({ characterId, controller: 'ai' }));
  const state = createMatch(ARENA, configs);
  const eliminated = [];
  let ko = null;
  let ticks = 0;
  const idle = configs.map(() => ({ move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false }));
  while (state.phase !== 'ended' && ticks++ < 200000) {
    const evs = stepMatch(state, DT, idle);
    for (const ev of evs) {
      if (ev.type !== 'death') continue;
      eliminated.push(ev.fighterId);
      if (ev.fighterId === 0 && ko === null) {
        ko = { tick: ticks, elapsed: state.elapsed, eliminatedAtKo: null };
      }
    }
    if (ko && ko.eliminatedAtKo === null) {
      // Snapshot AFTER the tick that killed slot 0 — what the screen could bank right now.
      ko.phaseAfter = state.phase;
      ko.eliminatedAtKo = eliminated.slice();
      const inp = placementInput(state, eliminated);
      ko.provisional = resolvePlaces(inp).indexOf(0);
      ko.provisionalSlotOrder = slotOrderPlaces(inp).indexOf(0);
      ko.aliveAfter = state.fighters.filter((f) => f.alive && f.hp > 0).length;
    }
  }
  const finalInput = placementInput(state, eliminated);
  const finalPlace = resolvePlaces(finalInput).indexOf(0);
  return { n, player, enemy, roster, ended: state.phase === 'ended', ticks, ko, finalPlace,
    finalSlotOrder: slotOrderPlaces(finalInput).indexOf(0), elapsedMs: state.elapsed };
}

const PAIRS = [];
for (const p of IDS) for (const e of IDS) if (p !== e) PAIRS.push([p, e]);
const corpus = {};
for (const n of [STATE.MIN_FIGHTERS, STATE.MAX_FIGHTERS]) {
  const t0 = Date.now();
  corpus[n] = PAIRS.map(([p, e]) => play(n, p, e));
  console.log(`    N=${n}: ${corpus[n].length} matches in ${((Date.now() - t0) / 1000).toFixed(1)} s`
    + ` · unresolved ${corpus[n].filter((m) => !m.ended).length}`);
}

const summary = {};
for (const n of Object.keys(corpus).map(Number)) {
  const ms = corpus[n];
  const koed = ms.filter((m) => m.ko);
  const windows = koed.filter((m) => m.ko.phaseAfter === 'playing');
  const fixed = windows.filter((m) => m.ko.provisional === m.finalPlace);
  const slotOrderFixed = windows.filter((m) => m.ko.provisionalSlotOrder === m.finalSlotOrder
    && m.ko.provisionalSlotOrder === m.finalPlace);
  const placeHist = Array.from({ length: n }, (_, k) => ms.filter((m) => m.finalPlace === k).length);
  summary[n] = { matches: ms.length, slot0KnockedOut: koed.length, windows: windows.length,
    windowsWithFixedPlace: fixed.length, slotOrderKnownBadAgreeing: slotOrderFixed.length,
    finalPlaceHistogram: placeHist,
    windowPlaceHistogram: Array.from({ length: n }, (_, k) => windows.filter((m) => m.finalPlace === k).length),
    meanKoElapsedMs: windows.length ? Math.round(windows.reduce((s, m) => s + m.ko.elapsed, 0) / windows.length) : null,
    meanEndElapsedMs: windows.length ? Math.round(windows.reduce((s, m) => s + m.elapsedMs, 0) / windows.length) : null };
  console.log(`    N=${n}: slot0 KO'd in ${koed.length}/${ms.length} · quit-window (dead & 'playing') in`
    + ` ${windows.length} · place already final in ${fixed.length}/${windows.length}`
    + ` · final-place histogram ${JSON.stringify(placeHist)}`);
}
report.knockoutWindow = summary;

const s2 = summary[2];
const s6 = summary[6];
ok('§2', 'N=2 CONTROL is non-vacuous: slot 0 is knocked out in a non-empty set of duels',
  s2.slot0KnockedOut > 0, `${s2.slot0KnockedOut}/${s2.matches}`);
ok('§2', 'N=2 CONTROL: ZERO quit windows — a duel KO ends the match on the same tick',
  s2.windows === 0, `${s2.windows}`);
ok('§2', 'N=6: the quit window EXISTS — slot 0 dead while the match is still playing',
  s6.windows > 0, `${s6.windows}/${s6.matches}`);
ok('§2', 'N=6: in EVERY window the place is already decided (provisional === final)',
  s6.windows > 0 && s6.windowsWithFixedPlace === s6.windows, `${s6.windowsWithFixedPlace}/${s6.windows}`);
const kbBroken = s6.windows - s6.slotOrderKnownBadAgreeing;
ok('§2', 'KNOWN-BAD: a slot-order resolver BREAKS the "decided" check on the same corpus (the check can fail)',
  kbBroken > 0, `${kbBroken}/${s6.windows} windows disagree under the planted resolver`);

// Price it. Honest = bank the final place. Quitter = leave in the window whenever the
// (already decided) trophy delta is negative — Quit banks nothing (matchScreen.ts §abandon).
const price = [];
for (const standing of [50, 500, 1500]) {
  for (const n of [2, 6]) {
    const ms = corpus[n];
    let honestT = 0; let quitT = 0; let honestC = 0; let quitC = 0; let quits = 0;
    for (const m of ms) {
      const d = E.placementTrophyDelta(m.finalPlace, n, standing);
      const c = E.placementCoins(m.finalPlace, n);
      honestT += d; honestC += c;
      const canQuit = m.ko && m.ko.phaseAfter === 'playing';
      if (canQuit && d < 0) { quits++; } else { quitT += d; quitC += c; }
    }
    price.push({ standing, n, matches: ms.length,
      honestTrophiesPerMatch: +(honestT / ms.length).toFixed(3),
      quitterTrophiesPerMatch: +(quitT / ms.length).toFixed(3),
      honestCoinsPerMatch: +(honestC / ms.length).toFixed(2),
      quitterCoinsPerMatch: +(quitC / ms.length).toFixed(2),
      quitRate: +(quits / ms.length).toFixed(3) });
  }
}
report.price = price;
console.log('\n    standing  N  honest tr/match  quitter tr/match  honest coins  quitter coins  quit rate');
for (const r of price) {
  console.log(`    ${String(r.standing).padStart(8)}  ${r.n}  ${String(r.honestTrophiesPerMatch).padStart(15)}`
    + `  ${String(r.quitterTrophiesPerMatch).padStart(16)}  ${String(r.honestCoinsPerMatch).padStart(12)}`
    + `  ${String(r.quitterCoinsPerMatch).padStart(13)}  ${r.quitRate}`);
}
const p1500 = price.find((r) => r.standing === 1500 && r.n === 6);
const p1500n2 = price.find((r) => r.standing === 1500 && r.n === 2);
ok('§2', 'N=2: the quitter strategy changes NOTHING (no window exists)',
  p1500n2.quitterTrophiesPerMatch === p1500n2.honestTrophiesPerMatch, JSON.stringify(p1500n2));
ok('§2', 'N=6 @1500: the quitter strategy RAISES trophy income per match (the loss term is optional)',
  p1500.quitterTrophiesPerMatch > p1500.honestTrophiesPerMatch,
  `${p1500.honestTrophiesPerMatch} -> ${p1500.quitterTrophiesPerMatch} per match`);
// The curve itself, for the report.
report.curve6at1500 = Array.from({ length: 6 }, (_, k) => ({
  place: k + 1, trophies: E.placementTrophyDelta(k, 6, 1500), coins: E.placementCoins(k, 6),
}));
console.log(`    6-seat curve @1500: ${report.curve6at1500.map((r) => `${r.place}:${r.trophies}/${r.coins}c`).join('  ')}`);

// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n§3 GHOST LOADOUT — `raw in ITEMS`');
{
  const { ITEMS } = RULES;
  const ITEM_IDS = E.ITEM_IDS;
  report.ghost = {
    constructorIn: 'constructor' in ITEMS, toStringIn: 'toString' in ITEMS,
    constructorIsItemId: ITEM_IDS.includes('constructor'),
  };
  let typoThrew = false;
  try { createMatch(ARENA, [{ characterId: 'hamburger', items: ['not_an_item'] }, { characterId: 'donut' }]); }
  catch (e) { typoThrew = e instanceof RangeError; }
  ok('§3', 'CONTROL: an ordinary typo is refused with a RangeError (the validator is live)', typoThrew);
  let ghostState = null; let ghostErr = null;
  try {
    ghostState = createMatch(ARENA, [{ characterId: 'hamburger', items: ['constructor', 'toString'] }, { characterId: 'donut' }]);
  } catch (e) { ghostErr = String(e); }
  report.ghost.accepted = ghostState ? ghostState.fighters[0].item.equipped : null;
  ok('§3', 'DEFECT: `constructor`/`toString` are NOT item ids, yet createMatch equips them',
    ghostState !== null && ghostState.fighters[0].item.equipped.includes('constructor'),
    ghostErr ?? `equipped = ${JSON.stringify(report.ghost.accepted)}`);
  if (ghostState) {
    let stepErr = null;
    try {
      for (let i = 0; i < 2000 && ghostState.phase !== 'ended'; i++) {
        stepMatch(ghostState, DT, { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false, useItem: i % 2 });
      }
    } catch (e) { stepErr = String(e).split('\n')[0]; }
    report.ghost.stepError = stepErr;
    console.log(`    2000 ticks pressing the ghost slots: ${stepErr ? `THREW ${stepErr}` : 'no throw (itemUsable refuses: kind is undefined)'}`);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
report.rows = rows;
report.faults = faults;
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`\nbh_meta_econ: ${rows.length - faults}/${rows.length} rows as expected · report ${OUT}`);
process.exitCode = faults ? 1 : 0;
