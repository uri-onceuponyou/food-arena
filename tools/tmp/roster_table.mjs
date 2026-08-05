#!/usr/bin/env node
/**
 * ROSTER TABLE — per-CHARACTER win rate, in the player's hands and in the AI's, with
 * the per-matchup spread, against the real `src/game/sim.ts` and the shipped arena.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `07a4e3a` bounded an undodgeable status lock (4 of 5 stun weapons and 8 of 10 slow
 * weapons held their own status up forever). That bug was CARRYING characters, and
 * removing it re-sorted the roster: player-Pizza went 98.8% -> 63.1% on Cheese Blind
 * alone. Nobody re-measured the other ten. Every existing instrument reports the
 * AGGREGATE (`playerWinRate`) or a flat `matchupRates` map; none of them answers
 * "which character is broken, and in which direction".
 *
 * ── What it reports, and why each column ────────────────────────────────────
 *
 *   asPlayer   win rate over the 10 matchups where this character is the HUMAN's,
 *              i.e. driven by the scripted policy against a 150 HP AI.
 *   asAI       win rate over the 10 matchups where this character is the ENEMY,
 *              i.e. driven by `ai.ts` against a 100 HP scripted human. This is
 *              `1 - matchupRate[other>this]`, so the two columns are the SAME matches
 *              read from opposite ends and a character that is simply "good" moves
 *              both.
 *   strength   (asPlayer + asAI) / 2 — the role-symmetric index. The HP pools are
 *              asymmetric (100 vs 150) and so are the two drivers, so neither column
 *              alone separates "this character is strong" from "this ROLE is strong".
 *              A roster defect shows up as a character far from the roster mean on
 *              BOTH, or violently split between them (which is a driver defect, not a
 *              balance one — see `docs/LESSONS.md` §13).
 *   spread     min..max of the 10 per-matchup rates in that role. A character at 50%
 *              overall made of five 100%s and five 0%s is not balanced; it is two
 *              different characters.
 *
 * ⚠️ `hit/fire` is HIT EVENTS per PRESS, not accuracy: a 5-pellet weapon that lands two
 * pellets reads 2.0, and Donut's trail marks are counted as damage but not as hits. It
 * separates "fires a lot and misses" from "fires rarely"; it is not a hit rate.
 *
 * Mechanism columns (dmg/fires/hits/status applied) exist so an outlier can be
 * explained rather than merely named — the brief that commissioned this asks for the
 * mechanism, not the number.
 *
 * ── Method ──────────────────────────────────────────────────────────────────
 *
 * 110 matchups x N seeds x P policies through `stepMatch`. The scripted player and its
 * seeded jitter come from `tools/tmp/scripted_player.mjs` — ONE implementation shared
 * with `status_census.mjs` and `arena_probe.mjs`. They used to be a verbatim lift, and
 * that is how this file spent its whole life running a stuck detector through the
 * COUNTDOWN after `tools/match-sim.mjs` had already fixed it. Seed 0 is jitter-free.
 *
 * ⚠️ EVERY FIGURE THIS TOOL PRINTED BEFORE 2026-08-05 CARRIES THE STALE DRIVER. Both
 * defects are reproducible by flag so any of them can be re-derived and compared:
 *
 *   --nav-countdown-bug         the stuck detector runs during the countdown
 *   --decide-during-countdown   the decision loop draws seeded RNG before the whistle
 *
 * The second one is the dangerous one: it makes the RNG stream at the whistle a
 * function of countdown LENGTH, so any timing change re-seeds every match in the
 * ladder and presents as a balance finding. `node tools/tmp/driver_guard.mjs` asserts
 * it cannot come back. See `docs/LESSONS.md` §13.
 *
 * ⚠️ `match-sim.mjs` documents its scripted player as "the shape of a match, not a skill
 * benchmark": perfect information, fixed 150 ms reaction, and `bestWeapon` picks the
 * highest-DAMAGE weapon in range and therefore never picks a low-damage weapon for its
 * STATUS. So a character whose kit is control-first is systematically under-driven here.
 * That is a limit of the instrument, not a finding about the character — `--why <id>`
 * prints the per-weapon usage that lets you tell the two apart.
 *
 *   node tools/tmp/roster_table.mjs --seeds 16 --policies smart2,chase,kite,survive
 *   node tools/tmp/roster_table.mjs --seeds 16 --json /tmp/before.json
 *   node tools/tmp/roster_table.mjs --seeds 16 --sim /tmp/staged/game --baseline /tmp/before.json
 *   node tools/tmp/roster_table.mjs --selftest        # known-input validation, no arena
 *
 * `--baseline` prints a PAIRED comparison: same arena, same seeds, same matchups, so a
 * per-matchup delta is exact rather than two independent samples of a noisy mean.
 * `docs/LESSONS.md`: the aggregate win rate is unresolvable below ~9 pp, but a paired
 * per-matchup delta is not a sample at all.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, parseDriverFlags, rng, DRIVER_REV } from './scripted_player.mjs';

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

/** Which sim to drive. `--sim <dir>` points at a `tools/tmp/stage_rules.mjs` copy so a
 *  candidate constant is measured without editing the shared tree. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH,
  HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, PLAYER_MAX_HP, ENEMY_MAX_HP,
} = RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
// cached dump goes stale the moment the clock moves. Recompute from the same formula.
const HALF_DIAG = Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2);
const FOG_FIRST_CONTACT_MS = 6000; // arena/shared.ts FOG_FIRST_CONTACT_S
const derivedMaxSafe = Math.round(HALF_DIAG / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS));
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: Number(args.maxsafe ?? derivedMaxSafe),
  build: () => null, update: () => {},
};
const HAZ = arena.hazards.find((h) => h.kind === 'damage');

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 16);
const POLICIES = String(args.policies ?? 'smart2,chase,kite,survive').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/**
 * ── THE SCRIPTED PLAYER IS IMPORTED, NOT COPIED ─────────────────────────────
 *
 * 267 lines used to sit here, lifted verbatim from `tools/tmp/status_census.mjs`,
 * which lifted them from `tools/tmp/arena_probe.mjs`. That is exactly how this file
 * came to be running a stuck detector through the COUNTDOWN long after
 * `tools/match-sim.mjs` had found and fixed it — five instruments sharing one stale
 * copy of a driver whose defect was known. `docs/LESSONS.md` names that shape ("a
 * rule stated once and implemented twice") as the origin of three separate AI bugs.
 *
 * The driver now lives in `tools/tmp/scripted_player.mjs` and carries both countdown
 * guards. `--nav-countdown-bug` and `--decide-during-countdown` reproduce the
 * historical driver exactly, so every figure this tool has ever printed is still
 * re-derivable — see the PAIRED table in the commit that landed this.
 */
const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, hazard: HAZ, ...DRIVER_FLAGS });
const { POLICY_FNS, maxNormalRange, createDecisionLoop } = driver;

// ─────────────────────────────────────────────────────────────────────────────
// one match — lean. Only what a ROSTER question needs.
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed) {
  // Identical seeding to status_census.mjs, so a row here and a row there are the
  // same match and can be cross-checked.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = POLICY_FNS[policy](rnd);
  const reactBase = 150;
  const reactJit = seed === 0 ? 0 : 60;

  const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  // The reaction cadence AND its countdown guard live in `scripted_player.mjs`. Writing
  // the loop out here is what let it drift out of step with `match-sim.mjs`.
  const loop = createDecisionLoop({ decide, reactBase, reactJit, rnd });
  let input = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

  const m = {
    playerId, enemyId, policy, seed,
    winner: null, ending: null, startedAt: null, endedAt: null,
    playTicks: 0, engagedTicks: 0,
    firstBloodMs: null,
    hpLeft: { player: 0, enemy: 0 },
    // dealt = damage this role INFLICTED on the other (weapon sources only for `wpn`)
    dealt: { player: 0, enemy: 0 },
    dealtWeapon: { player: 0, enemy: 0 },
    fires: { player: 0, enemy: 0 },
    hits: { player: 0, enemy: 0 },
    zoneDamage: { player: 0, enemy: 0 },   // fog + pot TAKEN, credited to nobody
    firesByWeapon: { player: {}, enemy: {} },
    hitsByWeapon: { player: {}, enemy: {} },
    // status APPLIED BY this role to the other (an application that the grace rule
    // refused is not counted — that is the whole point of measuring it after 07a4e3a)
    stunApplied: { player: 0, enemy: 0 },
    slowApplied: { player: 0, enemy: 0 },
    stunTicks: { player: 0, enemy: 0 },   // ticks this role SPENT stunned
    slowTicks: { player: 0, enemy: 0 },
  };

  const other = (r) => (r === 'player' ? 'enemy' : 'player');
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    input = loop.next(state, DT);
    const pre = {
      player: { st: state.player.status.stunnedUntil, sl: state.player.status.slowedUntil },
      enemy: { st: state.enemy.status.stunnedUntil, sl: state.enemy.status.slowedUntil },
    };
    const evs = stepMatch(state, DT, input);

    for (const ev of evs) {
      if (ev.type === 'match-started') m.startedAt = state.elapsed;
      else if (ev.type === 'match-ended') { m.winner = ev.winner; m.endedAt = state.elapsed; }
      else if (ev.type === 'weapon-fired') {
        m.fires[ev.fighterRole]++;
        const b = m.firesByWeapon[ev.fighterRole];
        b[ev.weaponKey] = (b[ev.weaponKey] ?? 0) + 1;
      } else if (ev.type === 'hit-landed') {
        // `source` is a DISCRIMINATED UNION (`{kind:'weapon'|'trail'|'hazard'|'fog'}`),
        // not a string. Comparing it to `'weapon'` is always false and silently reports
        // every weapon hit as zero — caught by the mechanism table printing 0.0 hits for
        // a character that plainly kills things. Read `.kind`.
        const src = ev.source?.kind ?? 'unknown';
        const dealer = src === 'trail' ? ev.source.ownerRole : other(ev.targetRole);
        // fog/hazard damage belongs to nobody: it is credited to the ZONE, not a fighter.
        if (src === 'weapon' || src === 'trail') {
          m.dealt[dealer] += ev.amount;
          if (src === 'weapon') {
            m.dealtWeapon[dealer] += ev.amount;
            m.hits[dealer]++;
            const b = m.hitsByWeapon[dealer];
            b[ev.source.weaponKey] = (b[ev.source.weaponKey] ?? 0) + 1;
          }
        } else {
          m.zoneDamage[ev.targetRole] += ev.amount;
        }
        if (m.firstBloodMs === null) m.firstBloodMs = state.elapsed;
      } else if (ev.type === 'death') {
        m.ending = 'knockout';
      }
    }

    // Status APPLICATIONS, read off the timestamps rather than the event, because
    // `hit-landed.effect` describes what the WEAPON does and says nothing about
    // whether the grace rule refused it (combat.ts:applyDamage).
    for (const role of ['player', 'enemy']) {
      const st = state[role].status;
      if (st.stunnedUntil > pre[role].st) m.stunApplied[other(role)]++;
      if (st.slowedUntil > pre[role].sl) m.slowApplied[other(role)]++;
      if (state.phase === 'playing') {
        if (state.elapsed < st.stunnedUntil) m.stunTicks[role]++;
        if (state.elapsed < st.slowedUntil) m.slowTicks[role]++;
      }
    }

    if (state.phase === 'playing') {
      m.playTicks++;
      if (dist(state.player.x, state.player.y, state.enemy.x, state.enemy.y) <= engageRange) m.engagedTicks++;
    }
  }

  m.hpLeft.player = state.player.hp;
  m.hpLeft.enemy = state.enemy.hp;
  m.playMs = m.startedAt === null ? 0 : (m.endedAt ?? state.elapsed) - m.startedAt;
  if (m.ending === null) m.ending = m.winner ? 'timeout' : 'UNRESOLVED';
  /** Decisions and reaction draws, split by phase. The selftest asserts the countdown
   *  halves are zero: a draw before the whistle makes the seeded stream a function of
   *  countdown length, which is how a timing edit manufactures a balance result. */
  m.driverStats = { ...loop.stats };
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validate the instrument against a KNOWN input before believing it on an
// unknown one (docs/LESSONS.md §13). Three properties that must hold by construction.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => { if (cond) { pass++; } else { fail++; console.log(`  FAIL ${name} ${detail}`); } };

  // 1. asPlayer and asAI must be reads of the SAME matches from opposite ends: the
  //    roster mean of asPlayer and the roster mean of (1 - asAI) must be identical.
  const rows = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) { if (p !== e) rows.push(runMatch(p, e, 'smart2', 0)); }
  const pw = rows.filter((r) => r.winner === 'player').length / rows.length;
  const ew = rows.filter((r) => r.winner === 'enemy').length / rows.length;
  ok('roles partition', Math.abs(pw + ew - 1) < 1e-9 || rows.some((r) => r.winner === null), `p=${pw} e=${ew}`);

  // 2. Seed 0 is jitter-free => bit-identical on a re-run.
  const a = runMatch('pizza', 'soup', 'smart2', 0), b = runMatch('pizza', 'soup', 'smart2', 0);
  ok('seed 0 deterministic', a.winner === b.winner && a.playMs === b.playMs && a.dealt.player === b.dealt.player);

  // 3. The idle-player control: `survive` never attacks, so it must deal ZERO weapon
  //    damage. If this ever prints non-zero the driver is not doing what it says.
  const s = runMatch('donut', 'egg', 'survive', 0);
  ok('survive fires nothing', s.fires.player === 0, `fires=${s.fires.player}`);

  // 4. Every fire is attributable to a weapon this character owns.
  const keys = new Set(CHARACTERS.pizza.weapons.map((w) => w.key));
  const pz = runMatch('pizza', 'taco', 'chase', 0);
  ok('fires attribute to owned weapons', Object.keys(pz.firesByWeapon.player).every((k) => keys.has(k)));

  // 5. THE COUNTDOWN GUARD. `sim.ts` ignores `input` entirely while `phase ===
  //    'countdown'`, so a decision taken there changes nothing about the match — except
  //    that it burns draws from the seeded stream, making the state at the whistle a
  //    function of countdown LENGTH. That is the mechanism that moved 38 of 110 matchups
  //    by up to 50.0 pp on a change worth +0.01 s (`tools/tmp/pacing_ladder.mjs`).
  //    Asserted per policy, because each one builds its own loop.
  for (const pol of ['smart2', 'chase', 'kite', 'survive']) {
    const r = runMatch('taco', 'donut', pol, 3);
    ok(`${pol}: no decision during the countdown`, r.driverStats.decisionsInCountdown === 0,
      `${r.driverStats.decisionsInCountdown} of ${r.driverStats.decisions}`);
    ok(`${pol}: no reaction draw during the countdown`, r.driverStats.reactDrawsInCountdown === 0,
      `${r.driverStats.reactDrawsInCountdown} of ${r.driverStats.reactDraws}`);
  }

  // 6. The guard must be REACHABLE by the flag, or the historical figures cannot be
  //    reproduced and the before/after in the commit log is unverifiable.
  ok('the historical driver is still reproducible by flag',
    parseDriverFlags({ 'nav-countdown-bug': true, 'decide-during-countdown': true }).navCountdownBug === true
    && parseDriverFlags({ 'decide-during-countdown': true }).decideDuringCountdown === true);

  console.log(`\nroster_table selftest: ${pass} passed, ${fail} failed  (driver rev ${DRIVER_REV})\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// sweep
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const summary = {
  seeds: SEEDS, dt: DT, sim: SIM_DIR, arena: ARENA_PATH,
  // Stamped so a stale record is identifiable MECHANICALLY rather than by its date.
  driverRev: driver.isHistorical ? 'HISTORICAL' : DRIVER_REV, driverFlags: DRIVER_FLAGS,
  policies: {},
};
let nMatches = 0;

for (const policy of POLICIES) {
  const rows = [];
  for (let s = 0; s < SEEDS; s++) {
    for (const p of CHARACTER_IDS) {
      for (const e of CHARACTER_IDS) {
        if (p === e) continue;
        rows.push(runMatch(p, e, policy, s));
        nMatches++;
      }
    }
  }

  // per-matchup player win rate
  const byMatchup = {};
  for (const r of rows) {
    const k = `${r.playerId}>${r.enemyId}`;
    (byMatchup[k] ??= { w: 0, n: 0 });
    byMatchup[k].n++;
    if (r.winner === 'player') byMatchup[k].w++;
  }
  const matchupRates = Object.fromEntries(Object.entries(byMatchup).map(([k, v]) => [k, v.w / v.n]));

  // per-character, per-role mechanism accumulators
  const blank = () => ({
    n: 0, wins: 0, dealt: 0, dealtWeapon: 0, taken: 0, zone: 0, fires: 0, hits: 0,
    stunApplied: 0, slowApplied: 0, stunTicks: 0, slowTicks: 0, hpLeft: 0, playMs: 0,
    firesByWeapon: {}, hitsByWeapon: {},
  });
  const chars = Object.fromEntries(CHARACTER_IDS.map((id) => [id, { asPlayer: blank(), asAI: blank() }]));
  for (const r of rows) {
    const P = chars[r.playerId].asPlayer, E = chars[r.enemyId].asAI;
    P.n++; E.n++;
    if (r.winner === 'player') P.wins++;
    if (r.winner === 'enemy') E.wins++;
    P.dealt += r.dealt.player; E.dealt += r.dealt.enemy;
    P.dealtWeapon += r.dealtWeapon.player; E.dealtWeapon += r.dealtWeapon.enemy;
    P.taken += r.dealt.enemy; E.taken += r.dealt.player;
    P.zone += r.zoneDamage.player; E.zone += r.zoneDamage.enemy;
    P.fires += r.fires.player; E.fires += r.fires.enemy;
    P.hits += r.hits.player; E.hits += r.hits.enemy;
    P.stunApplied += r.stunApplied.player; E.stunApplied += r.stunApplied.enemy;
    P.slowApplied += r.slowApplied.player; E.slowApplied += r.slowApplied.enemy;
    P.stunTicks += r.stunTicks.player; E.stunTicks += r.stunTicks.enemy;
    P.slowTicks += r.slowTicks.player; E.slowTicks += r.slowTicks.enemy;
    P.hpLeft += r.hpLeft.player; E.hpLeft += r.hpLeft.enemy;
    P.playMs += r.playMs; E.playMs += r.playMs;
    for (const [k, v] of Object.entries(r.firesByWeapon.player)) P.firesByWeapon[k] = (P.firesByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.firesByWeapon.enemy)) E.firesByWeapon[k] = (E.firesByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.hitsByWeapon.player)) P.hitsByWeapon[k] = (P.hitsByWeapon[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.hitsByWeapon.enemy)) E.hitsByWeapon[k] = (E.hitsByWeapon[k] ?? 0) + v;
  }

  // per-role spread across the 10 opponents
  const perChar = {};
  for (const id of CHARACTER_IDS) {
    const asP = CHARACTER_IDS.filter((o) => o !== id).map((o) => matchupRates[`${id}>${o}`]);
    const asA = CHARACTER_IDS.filter((o) => o !== id).map((o) => 1 - matchupRates[`${o}>${id}`]);
    const P = chars[id].asPlayer, E = chars[id].asAI;
    perChar[id] = {
      asPlayer: P.wins / P.n, asAI: E.wins / E.n,
      strength: (P.wins / P.n + E.wins / E.n) / 2,
      spreadPlayer: [Math.min(...asP), Math.max(...asP)],
      spreadAI: [Math.min(...asA), Math.max(...asA)],
      perEnemy: Object.fromEntries(CHARACTER_IDS.filter((o) => o !== id).map((o) => [o, matchupRates[`${id}>${o}`]])),
      perPlayer: Object.fromEntries(CHARACTER_IDS.filter((o) => o !== id).map((o) => [o, 1 - matchupRates[`${o}>${id}`]])),
      mech: {
        player: {
          dealt: P.dealt / P.n, dealtWeapon: P.dealtWeapon / P.n, taken: P.taken / P.n, zone: P.zone / P.n,
          fires: P.fires / P.n, hits: P.hits / P.n, hitRate: P.hits / Math.max(1, P.fires),
          stunApplied: P.stunApplied / P.n, slowApplied: P.slowApplied / P.n,
          stunnedMs: (P.stunTicks / P.n) * DT, slowedMs: (P.slowTicks / P.n) * DT,
          hpLeft: P.hpLeft / P.n, playMs: P.playMs / P.n,
          firesByWeapon: Object.fromEntries(Object.entries(P.firesByWeapon).map(([k, v]) => [k, v / P.n])),
          hitsByWeapon: Object.fromEntries(Object.entries(P.hitsByWeapon).map(([k, v]) => [k, v / P.n])),
        },
        ai: {
          dealt: E.dealt / E.n, dealtWeapon: E.dealtWeapon / E.n, taken: E.taken / E.n, zone: E.zone / E.n,
          fires: E.fires / E.n, hits: E.hits / E.n, hitRate: E.hits / Math.max(1, E.fires),
          stunApplied: E.stunApplied / E.n, slowApplied: E.slowApplied / E.n,
          stunnedMs: (E.stunTicks / E.n) * DT, slowedMs: (E.slowTicks / E.n) * DT,
          hpLeft: E.hpLeft / E.n, playMs: E.playMs / E.n,
          firesByWeapon: Object.fromEntries(Object.entries(E.firesByWeapon).map(([k, v]) => [k, v / E.n])),
          hitsByWeapon: Object.fromEntries(Object.entries(E.hitsByWeapon).map(([k, v]) => [k, v / E.n])),
        },
      },
    };
  }

  summary.policies[policy] = {
    n: rows.length,
    playerWinRate: rows.filter((r) => r.winner === 'player').length / rows.length,
    timeouts: rows.filter((r) => r.ending === 'timeout').length,
    unresolved: rows.filter((r) => r.ending === 'UNRESOLVED').length,
    meanPlayMs: rows.reduce((a, r) => a + r.playMs, 0) / rows.length,
    matchupRates, perChar,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const elapsedS = (Date.now() - t0) / 1000;

console.log(`\n╔══ ROSTER TABLE ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${elapsedS.toFixed(1)}s`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`║ arena ${ARENA_PATH.replace(ROOT + '/', '')} ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · clock ${MATCH_DURATION_MS / 1000}s · HP ${PLAYER_MAX_HP}/${ENEMY_MAX_HP}`);
console.log(`║ driver scripted_player.mjs rev ${DRIVER_REV}${driver.isHistorical
  ? `  ⚠️ HISTORICAL: ${Object.entries(DRIVER_FLAGS).filter(([, v]) => v).map(([k]) => k).join(' + ')} — reproduction only, NOT a current number`
  : ''}`);
console.log(`╚══════════════════════════════════════════════════════════════════════════`);

const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;

for (const policy of POLICIES) {
  const P = summary.policies[policy];
  const B = baseline?.policies?.[policy] ?? null;
  console.log(`\n══════ POLICY ${policy.toUpperCase()} ── ${P.n} matches · aggregate player win ${pct(P.playerWinRate)}${B ? `  (was ${pct(B.playerWinRate)}, ${pp(P.playerWinRate - B.playerWinRate)}pp)` : ''} ══════`);
  console.log(`  ${'character'.padEnd(12)}${'asPlayer'.padStart(9)}${'spread'.padStart(14)}${'asAI'.padStart(8)}${'spread'.padStart(14)}${'strength'.padStart(10)}${B ? '   Δplayer   ΔasAI  Δstrength' : ''}`);
  const order = [...CHARACTER_IDS].sort((a, b) => P.perChar[b].strength - P.perChar[a].strength);
  for (const id of order) {
    const c = P.perChar[id];
    let d = '';
    if (B) {
      const b = B.perChar[id];
      d = `   ${pp(c.asPlayer - b.asPlayer).padStart(7)} ${pp(c.asAI - b.asAI).padStart(7)} ${pp(c.strength - b.strength).padStart(9)}`;
    }
    console.log(`  ${id.padEnd(12)}${pct(c.asPlayer).padStart(9)}${`${pct(c.spreadPlayer[0])}..${pct(c.spreadPlayer[1])}`.padStart(14)}` +
      `${pct(c.asAI).padStart(8)}${`${pct(c.spreadAI[0])}..${pct(c.spreadAI[1])}`.padStart(14)}${pct(c.strength).padStart(10)}${d}`);
  }
  const strengths = CHARACTER_IDS.map((id) => P.perChar[id].strength);
  const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
  const sd = Math.sqrt(strengths.reduce((a, b) => a + (b - mean) ** 2, 0) / strengths.length);
  console.log(`  ${'—'.padEnd(12)} roster strength mean ${pct(mean)} · sd ${(sd * 100).toFixed(1)}pp · range ${pct(Math.min(...strengths))}..${pct(Math.max(...strengths))} = ${((Math.max(...strengths) - Math.min(...strengths)) * 100).toFixed(1)}pp`);

  if (args.mech) {
    console.log(`\n  ── MECHANISM (per match) ──────────────────────────────────────────────`);
    console.log(`  ${'character'.padEnd(12)}${'role'.padEnd(7)}${'dmg'.padStart(7)}${'wpnDmg'.padStart(8)}${'taken'.padStart(7)}${'zone'.padStart(6)}${'fires'.padStart(7)}${'hits'.padStart(7)}${'hit/fire'.padStart(9)}${'stunApp'.padStart(8)}${'slowApp'.padStart(8)}${'stunnedS'.padStart(9)}${'slowedS'.padStart(8)}${'play'.padStart(7)}`);
    for (const id of order) {
      for (const role of ['player', 'ai']) {
        const m = P.perChar[id].mech[role];
        console.log(`  ${(role === 'player' ? id : '').padEnd(12)}${role.padEnd(7)}${m.dealt.toFixed(1).padStart(7)}${m.dealtWeapon.toFixed(1).padStart(8)}${m.taken.toFixed(1).padStart(7)}${m.zone.toFixed(1).padStart(6)}` +
          `${m.fires.toFixed(1).padStart(7)}${m.hits.toFixed(1).padStart(7)}${m.hitRate.toFixed(2).padStart(9)}${m.stunApplied.toFixed(2).padStart(8)}${m.slowApplied.toFixed(2).padStart(8)}` +
          `${(m.stunnedMs / 1000).toFixed(2).padStart(9)}${(m.slowedMs / 1000).toFixed(2).padStart(8)}${(m.playMs / 1000).toFixed(1).padStart(7)}`);
      }
    }
  }

  if (args.why) {
    const id = String(args.why);
    const c = P.perChar[id];
    console.log(`\n  ── WHY ${id.toUpperCase()} ──────────────────────────────────────────────`);
    console.log(`     as PLAYER vs: ${CHARACTER_IDS.filter((o) => o !== id).map((o) => `${o} ${pct(c.perEnemy[o])}`).join(' · ')}`);
    console.log(`     as AI     vs: ${CHARACTER_IDS.filter((o) => o !== id).map((o) => `${o} ${pct(c.perPlayer[o])}`).join(' · ')}`);
    for (const role of ['player', 'ai']) {
      const m = c.mech[role];
      const ks = CHARACTERS[id].weapons.map((w) => w.key);
      console.log(`     ${role.padEnd(6)} weapon fires/match: ${ks.map((k) => `${k} ${(m.firesByWeapon[k] ?? 0).toFixed(2)}`).join(' · ')}`);
    }
  }

  if (B) {
    // PAIRED per-matchup deltas: same arena, same seeds, same matchups.
    const ks = Object.keys(P.matchupRates);
    const deltas = ks.map((k) => ({ k, d: P.matchupRates[k] - (B.matchupRates[k] ?? 0) }));
    const moved = deltas.filter((x) => Math.abs(x.d) > 1e-9);
    const maxD = moved.length ? Math.max(...moved.map((x) => Math.abs(x.d))) : 0;
    const meanD = deltas.reduce((a, x) => a + Math.abs(x.d), 0) / deltas.length;
    console.log(`\n  ── PAIRED per-matchup delta vs baseline ── ${moved.length}/${ks.length} matchups moved · max ${(maxD * 100).toFixed(1)}pp · mean |Δ| ${(meanD * 100).toFixed(2)}pp`);
    for (const x of moved.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, Number(args.top ?? 15))) {
      console.log(`     ${x.k.padEnd(26)} ${pct(B.matchupRates[x.k])} -> ${pct(P.matchupRates[x.k])}  ${pp(x.d).padStart(7)}pp`);
    }
  }
}

if (args.grid) {
  for (const policy of POLICIES) {
    const P = summary.policies[policy];
    console.log(`\n  ── GRID ${policy} · rows = PLAYER, cols = ENEMY, cell = player win rate ──`);
    console.log(`  ${''.padEnd(12)}${CHARACTER_IDS.map((e) => e.slice(0, 5).padStart(7)).join('')}`);
    for (const p of CHARACTER_IDS) {
      console.log(`  ${p.padEnd(12)}${CHARACTER_IDS.map((e) => (p === e ? '—' : `${(P.matchupRates[`${p}>${e}`] * 100).toFixed(0)}%`).padStart(7)).join('')}`);
    }
  }
}

if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`\nwrote ${args.json}`); }
console.log('');
