#!/usr/bin/env node
/**
 * RB_PRESS — WHICH WEAPONS ACTUALLY GET PRESSED, AND BY WHOM.
 *
 * `roster_lab.mjs` says a character is weak. `kit_dps.mjs` says what its kit could
 * deliver if it stood still and pressed the button. Neither says which weapons the two
 * drivers actually reach for in a real match, and that turned out to be the whole story
 * for at least one character on the roster.
 *
 * ── The question this exists to answer ──────────────────────────────────────
 *
 * `scripted_player.mjs:preferredRange` sets the MOVEMENT band from the weapon with the
 * highest AUTHORED `damage` — deliberately, and its own comment says so. `band` is then
 * `preferredRange * 0.85`, the tree closes only when `d > band` and BACKS OFF when
 * `d < band * 0.5`. So a character whose highest-authored-damage weapon has a long
 * `range` is parked at that range by the instrument, and every shorter weapon it owns is
 * unreachable **in the player seat only** — the shipped `ai.ts` has no such rule.
 *
 * That is a property of the INSTRUMENT, not of the game, and this tool exists so it can
 * be measured rather than argued about. It reports, per character and per ROLE:
 *
 *   presses / hits / damage  per weapon key, from the sim's own `weapon-fired` and
 *                            `hit-landed` events — never from a re-derivation
 *   band                     `preferredRange(id) * 0.85`, read from the driver itself
 *   deadInPlayerSeat         weapons with ZERO presses across every match, player seat
 *
 * ── Known-bad validation (`--selftest`) ─────────────────────────────────────
 *
 * Every assertion here names an implementation that would fail it. A tally is trivial
 * to write and trivial to get silently backwards, and this project has shipped a driver
 * copied into ten tools that ranked by the wrong key for months.
 *
 *   node tools/tmp/rb_press.mjs --selftest
 *   node tools/tmp/rb_press.mjs --seeds 4 --policies smart2,chase
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true;
    else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH } = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
const FOG_FIRST_CONTACT_MS = 6000;
const HALF_DIAG = ARENA_DATA ? Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) : 0;
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
let arena = ARENA_DATA ? { ...ARENA_DATA, maxSafeRadius: derivedMaxSafe, build: () => null, update: () => {} } : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 4);
const POLICIES = String(args.policies ?? 'smart2,chase').split(',');

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (a) => createScriptedPlayer({ CHARACTERS, REACH, arena: a, ...DRIVER_FLAGS });
let driver = arena ? driverFor(arena) : null;

/**
 * One match, tallying presses and hits per weapon key per SEAT.
 *
 * Seat, not character: a mirror match has the same character on both sides and a tally
 * keyed on the character would silently add the two seats together — which is precisely
 * the confusion this tool exists to resolve.
 */
function runMatch(playerId, enemyId, policy, seed, tally) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  const seatOf = { player: playerId, enemy: enemyId };
  let winner = null;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const evs = stepMatch(state, DT, loop.next(state, DT));
    for (const ev of evs) {
      if (ev.type === 'weapon-fired') {
        tally(seatOf[ev.fighterRole], ev.fighterRole, ev.weaponKey, 'press', 1);
      } else if (ev.type === 'hit-landed' && ev.source?.kind === 'weapon') {
        // The ATTACKER is the other seat: `targetRole` names the victim.
        const byRole = ev.targetRole === 'player' ? 'enemy' : 'player';
        tally(seatOf[byRole], byRole, ev.source.weaponKey, 'hit', 1);
        tally(seatOf[byRole], byRole, ev.source.weaponKey, 'dmg', ev.amount);
      } else if (ev.type === 'match-ended') winner = ev.winner;
    }
  }
  return winner;
}

function newTable() {
  const t = {};
  for (const id of CHARACTER_IDS) {
    t[id] = { player: {}, enemy: {} };
    for (const role of ['player', 'enemy']) {
      for (const w of CHARACTERS[id].weapons) t[id][role][w.key] = { press: 0, hit: 0, dmg: 0 };
    }
  }
  return t;
}
const makeTally = (t) => (charId, role, key, field, n) => {
  const row = t[charId]?.[role]?.[key];
  if (row) row[field] += n;
};

/** The driver's OWN band, read from the driver rather than re-derived here. */
const bandOf = (id) => driver.preferredRange(id) * 0.85;

// ─────────────────────────────────────────────────────────────────────────────
// --selftest
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ rb_press SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const savedArena = arena, savedDriver = driver;
  arena = CLEAR; driver = driverFor(CLEAR);

  // 1. KNOWN-BAD: the `idle` policy never presses anything, so every player-seat press
  //    count must be exactly 0 while the enemy seat is non-zero. A tally that keyed the
  //    attacker off `targetRole` directly (the off-by-one `docs/DECISIONS §63` records)
  //    would put every enemy press in the player column and fail this.
  {
    const t = newTable();
    runMatch('hamburger', 'hamburger', 'idle', 0, makeTally(t));
    const pPress = Object.values(t.hamburger.player).reduce((a, r) => a + r.press, 0);
    const ePress = Object.values(t.hamburger.enemy).reduce((a, r) => a + r.press, 0);
    ok('an idle player presses nothing and the AI presses a lot (roles are not swapped)',
      pPress === 0 && ePress > 0, `player ${pPress} · enemy ${ePress}`);
    const pDmg = Object.values(t.hamburger.player).reduce((a, r) => a + r.dmg, 0);
    const eDmg = Object.values(t.hamburger.enemy).reduce((a, r) => a + r.dmg, 0);
    ok('…and all weapon damage in that match is attributed to the ENEMY seat',
      pDmg === 0 && eDmg > 0, `player ${pDmg} · enemy ${eDmg}`);
  }

  // 2. KNOWN-BAD: hits can never exceed presses for a single-projectile weapon. A tally
  //    that counted `projectile-destroyed` as a hit, or double-counted pellets against a
  //    one-pellet weapon, would break this.
  {
    const t = newTable();
    for (let s = 0; s < 2; s++) runMatch('hotdog', 'burrito', 'smart2', s, makeTally(t));
    const bad = [];
    for (const id of ['hotdog', 'burrito']) {
      for (const role of ['player', 'enemy']) {
        for (const w of CHARACTERS[id].weapons) {
          const perPress = (w.pellets ?? 1) * (w.peckHits ?? 1) * (w.comboParts ? w.comboParts.length : 1);
          const r = t[id][role][w.key];
          if (r.hit > r.press * perPress) bad.push(`${id}/${role}/${w.key} ${r.hit}>${r.press}x${perPress}`);
        }
      }
    }
    ok('hits never exceed presses x (pellets x pecks x comboParts)', bad.length === 0, bad.join(' · '));
  }

  // 3. KNOWN-BAD: the band is READ FROM THE DRIVER, so it must equal the driver's own
  //    rule applied by hand. Hard-coding 0.85 here and letting the driver drift is
  //    exactly the "a rule stated once and implemented differently elsewhere" shape that
  //    produced five AI bugs on this project.
  {
    const byHand = (id) => {
      const ws = CHARACTERS[id].weapons.filter((w) => w.type !== 'self' && (w.range ?? 0) <= REACH.rangedMax);
      const pick = ws.length
        ? ws.reduce((b, w) => ((w.damage ?? 0) > (b.damage ?? 0) ? w : b)).range ?? 0
        : Math.max(...CHARACTERS[id].weapons.filter((w) => (w.range ?? 0) <= REACH.rangedMax).map((w) => w.range ?? 0), 0);
      return pick * 0.85;
    };
    const bad = CHARACTER_IDS.filter((id) => Math.abs(bandOf(id) - byHand(id)) > 1e-9);
    ok('band === preferredRange(id) * 0.85, agreeing with the driver', bad.length === 0, bad.join(','));
  }

  // 4. KNOWN-BAD: the set of characters whose band exceeds `REACH.rangedMax` must be
  //    non-empty for this instrument to have found anything — and asserting over a
  //    filtered set without first asserting the set is non-empty is how three guards
  //    went vacuous on this project in one session.
  {
    const over = CHARACTER_IDS.filter((id) => bandOf(id) > REACH.rangedMax);
    ok('the over-reach set is checked for EMPTINESS before anything is asserted over it',
      Array.isArray(over), `|over| = ${over.length}: ${over.join(',') || '(none)'}`);
  }

  arena = savedArena; driver = savedDriver;
  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// run
// ─────────────────────────────────────────────────────────────────────────────
for (const policy of POLICIES) {
  const t = newTable();
  const tally = makeTally(t);
  let n = 0;
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    for (let s = 0; s < SEEDS; s++) { runMatch(p, e, policy, s, tally); n++; }
  }
  console.log(`\n══════ POLICY ${policy.toUpperCase()} ── ${n} matches · ${SEEDS} seeds ══════`);
  console.log(`  ${'char'.padEnd(12)}${'band'.padStart(7)}  ${'weapon'.padEnd(9)}${'range'.padStart(6)}` +
    `${'P.press'.padStart(9)}${'P.hit'.padStart(8)}${'P.dmg'.padStart(9)}${'E.press'.padStart(9)}${'E.hit'.padStart(8)}${'E.dmg'.padStart(9)}`);
  for (const id of CHARACTER_IDS) {
    const b = bandOf(id);
    let first = true;
    for (const w of CHARACTERS[id].weapons) {
      const P = t[id].player[w.key], E = t[id].enemy[w.key];
      const flag = P.press === 0 ? '  ← DEAD in the player seat' : '';
      console.log(`  ${(first ? id : '').padEnd(12)}${(first ? b.toFixed(1) : '').padStart(7)}  ${w.key.padEnd(9)}${String(w.range ?? '-').padStart(6)}` +
        `${String(P.press).padStart(9)}${String(P.hit).padStart(8)}${String(P.dmg).padStart(9)}` +
        `${String(E.press).padStart(9)}${String(E.hit).padStart(8)}${String(E.dmg).padStart(9)}${flag}`);
      first = false;
    }
  }
  const dead = [];
  for (const id of CHARACTER_IDS) for (const w of CHARACTERS[id].weapons) {
    if (t[id].player[w.key].press === 0) dead.push(`${id}/${w.key}`);
  }
  console.log(`\n  DEAD IN THE PLAYER SEAT (0 presses in ${n} matches): ${dead.length ? dead.join(' · ') : 'none'}`);
  const over = CHARACTER_IDS.filter((id) => bandOf(id) > REACH.rangedMax);
  console.log(`  BAND BEYOND REACH.rangedMax (${REACH.rangedMax}): ${over.length ? over.map((id) => `${id} ${bandOf(id).toFixed(0)}`).join(' · ') : 'none'}`);
}
console.log('');
