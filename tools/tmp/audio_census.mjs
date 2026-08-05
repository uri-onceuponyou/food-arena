#!/usr/bin/env node
/**
 * EVENT CENSUS — what the audio layer is actually asked to narrate, at the 45 s clock.
 *
 * `docs/LESSONS.md` §10: a slow harness fabricates false negatives, and driving a real
 * hit through gameplay in a browser is unreliable. Everything here runs the REAL
 * `src/game/sim.ts` in Node against the cached arena (`tools/arena.gameplay.json`), the
 * same trick `tools/match-sim.mjs` uses, so a full match costs ~20 ms and 121 matchups
 * can be censused instead of one lucky run.
 *
 * It answers the questions a coverage map needs and code reading cannot:
 *
 *   1. Which `GameEvent` kinds actually OCCUR, and how often, in a 45 s match.
 *   2. How many matches end on the CLOCK (both fighters alive) versus by knockout —
 *      the ending that did not exist when `director.ts` was written.
 *   3. Whether the ring reaches its `MIN_SAFE_RADIUS` floor before the whistle, and when.
 *   4. The worst SIMULTANEITY: the most events, and the most director voice requests,
 *      that ever land in one 16.7 ms tick. That number is the input to the clipping
 *      test — a mix is only safe against sums that really happen.
 *   5. Whether `TRAIL.maxHitsPerTick` is doing its job (this used to be 30 hit events
 *      in one tick, which the audio layer would have met as 30 simultaneous voices).
 *
 * The director's mapping is MIRRORED here rather than imported, deliberately: importing
 * `director.ts` would drag in `AudioEngine` and a Web Audio context that Node does not
 * have. The mirror is small, and `tools/audio-probe.mjs --mode coverage` asserts the two
 * agree on which kinds are voiced, so it cannot silently drift.
 *
 * ── THE DRIVER IS IMPORTED, AND IT USED TO BE A STALE COPY ─────────────────
 *
 * The hand on the controls was a verbatim hand-copy of `tools/match-sim.mjs`'s scripted
 * player, carrying a defect `match-sim.mjs` had already fixed on 2026-08-05: the stuck
 * detector ran during the COUNTDOWN, when `sim.ts:movePlayer` is never called, so it read
 * "1.5 s of walking, 0 wu covered", latched a perpendicular detour and walked it SIDEWAYS
 * at the whistle. Every event RATE below is a function of when contact happens, so the
 * defect was inside the measurement, not beside it (`docs/LESSONS.md` §5).
 *
 * It now comes from `tools/tmp/scripted_player.mjs`. Two changes, different in kind:
 *   * THE FIX — reachable in reverse by `--nav-countdown-bug --decide-during-countdown`.
 *   * A POLICY REDEFINITION — the local hand was none of the shared policies (24 wu /
 *     700 ms detour instead of 45 / 900). `smart` here NEVER meant the `smart` decision
 *     tree; it meant a chase that holds fire out of range. It is kept as an explicit
 *     ALIAS so no recorded "policy=smart" figure changes meaning silently, and it
 *     resolves to `smart2` — the corrected tree, which carries the same firing discipline.
 *     `flee` aliases to the shared `kite`, which is the same idea with tuned constants.
 *
 *   node tools/tmp/audio_census.mjs                    # default sweep
 *   node tools/tmp/audio_census.mjs --policy idle      # matches that reach the whistle
 *   node tools/tmp/audio_census.mjs --json out.json
 *   node tools/tmp/audio_census.mjs --sim /tmp/frozen/src/game --arena /tmp/frozen/tools/arena.gameplay.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng, parseDriverFlags, DRIVER_REV } from './scripted_player.mjs';

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

/** `--sim <dir>` freezes the sim: a peer mid-save in `src/game/` otherwise lands inside a
 *  run, which is exactly how `arena_probe.mjs` contaminated its own audit. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const ARENA_CACHE = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, MIN_SAFE_RADIUS, FOG_TICK_MS, TRAIL, REACH } = RULES;

const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart');
/** 0 = decide every tick, which is what this file has always done. `--react 150` imposes
 *  the reaction cadence the rest of the driver's consumers use. */
const REACT_MS = Number(args.react ?? 0);

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache at ${ARENA_CACHE}. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };

const DRIVER_FLAGS = parseDriverFlags(args);
const DRIVER = createScriptedPlayer({
  CHARACTERS, REACH, arena: ARENA,
  hazard: (ARENA.hazards ?? []).find((h) => h.kind === 'damage') ?? null,
  ...DRIVER_FLAGS,
});
if (DRIVER.isHistorical) {
  console.log('\n  ⚠️  HISTORICAL DRIVER — reproducing a defect fixed on 2026-08-05. These numbers are NOT current.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// The director's dispatch, mirrored. One line per `GameEvent` kind.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * How many VOICES `MatchAudio.handleEvent` would request for one event, before the
 * engine's retrigger throttle and voice budget get a say. Those two are what the mix
 * test measures; this is what they are given to work with.
 */
function voicesFor(ev, listener = 'player') {
  switch (ev.type) {
    case 'countdown-tick': return 1;
    case 'match-started': return 1;
    case 'match-ended': return 1;
    case 'weapon-fired': return 1;
    case 'heal': return 1;
    case 'death': return 1;
    case 'projectile-destroyed': return ev.reason === 'hit-cover' ? 1 : 0;
    case 'hit-landed':
      // fog is throttled by the director itself; hazard/trail/weapon are one voice,
      // plus a second `hurt` layer when the local player is the target.
      return 1 + (ev.targetRole === listener && ev.source.kind !== 'fog' ? 1 : 0);
    default: return 0; // projectile-spawned / splat-created / trail-mark-created
  }
}
const ALL_KINDS = [
  'countdown-tick', 'match-started', 'match-ended', 'weapon-fired', 'projectile-spawned',
  'projectile-destroyed', 'hit-landed', 'heal', 'death', 'splat-created', 'trail-mark-created',
];

// ─────────────────────────────────────────────────────────────────────────────
// A hand on the controls — the SHARED one. This measures EVENT RATES, not skill.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `smart` and `flee` are ALIASES, not policies. This file's `smart` has always been a
 * chase that holds fire out of range, never the `smart` decision tree, and `flee` was a
 * local retreat-and-heal hand. Re-pointing either name at a different shared policy would
 * silently redefine every figure recorded under it, so the mapping is explicit and
 * `--legacy-smart-as <policy>` re-points it for a sweep.
 *
 * `flee` existed to reach the WHISTLE: the aggressive and idle policies both end every
 * match by knockout well inside 45 s, so neither ever exercises `resolveTimeout` or the
 * ring's `MIN_SAFE_RADIUS` floor — the two sim states this census was written to find.
 * The shared `kite` is the same idea, and is the one the balance tools use.
 */
const POLICY_ALIAS = { smart: String(args['legacy-smart-as'] ?? 'smart2'), flee: 'kite', smartTree: 'smart' };
const resolvePolicy = (p) => POLICY_ALIAS[p] ?? p;

function makePlayer(policy) {
  const name = resolvePolicy(policy);
  const fn = DRIVER.POLICY_FNS[name];
  if (!fn) throw new Error(`unknown policy ${policy} -> ${name} (have: ${DRIVER.POLICY_NAMES.join(', ')})`);
  /** No seeded stream: `makeNav(null)` keeps the historical initial `detourSign` of +1,
   *  so the before/after measures the countdown fix rather than a re-roll. */
  const loop = DRIVER.createDecisionLoop({ decide: fn(null), reactBase: REACT_MS, reactJit: 0, rnd: null });
  return (state) => loop.next(state, DT);
}

// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy) {
  const state = createMatch(ARENA, playerId, enemyId);
  const act = makePlayer(policy);
  const counts = Object.fromEntries(ALL_KINDS.map((k) => [k, 0]));
  const hitBySource = { weapon: 0, trail: 0, hazard: 0, fog: 0 };
  const destroyByReason = { 'hit-target': 0, 'hit-cover': 0, expired: 0 };
  let maxEventsPerTick = 0;
  let maxVoicesPerTick = 0;
  let worstTick = null;
  let maxTrailHitsPerTick = 0;
  let maxWeaponHitsPerTick = 0;
  let ringFlooredAt = null;
  let startedAt = 0;
  let endedAt = null;
  let ending = null;
  let ticks = 0;
  let ticksWithEvents = 0;

  // Guard: run past the clock so a sim that fails to end is visible rather than silent.
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.4 + 8000) / DT);
  while (ticks < maxTicks) {
    ticks++;
    const events = stepMatch(state, DT, act(state));
    // `--immortal` is the only way to reach the whistle: measured below, no policy
    // tried survives past ~31 s of the 45 s clock, so `resolveTimeout` and the ring's
    // MIN_SAFE_RADIUS floor are otherwise unreachable and untestable end to end.
    if (args.immortal && state.phase === 'playing') {
      state.player.hp = state.player.maxHp;
      state.enemy.hp = state.enemy.maxHp;
    }
    if (ringFlooredAt === null && state.phase === 'playing' && state.safeRadius <= MIN_SAFE_RADIUS + 1e-9) {
      ringFlooredAt = state.elapsed;
    }
    let voices = 0;
    let trailHits = 0;
    let weaponHits = 0;
    for (const ev of events) {
      counts[ev.type] = (counts[ev.type] ?? 0) + 1;
      voices += voicesFor(ev);
      if (ev.type === 'hit-landed') {
        hitBySource[ev.source.kind]++;
        if (ev.source.kind === 'trail') trailHits++;
        if (ev.source.kind === 'weapon') weaponHits++;
      }
      if (ev.type === 'projectile-destroyed') destroyByReason[ev.reason]++;
      if (ev.type === 'match-started') startedAt = state.elapsed;
      if (ev.type === 'match-ended') {
        endedAt = state.elapsed;
        ending = state.player.alive && state.enemy.alive ? 'timeout' : 'knockout';
      }
    }
    if (events.length > 0) ticksWithEvents++;
    if (events.length > maxEventsPerTick) maxEventsPerTick = events.length;
    if (voices > maxVoicesPerTick) { maxVoicesPerTick = voices; worstTick = events.map((e) => ({ ...e })); }
    if (trailHits > maxTrailHitsPerTick) maxTrailHitsPerTick = trailHits;
    if (weaponHits > maxWeaponHitsPerTick) maxWeaponHitsPerTick = weaponHits;
    if (state.phase === 'ended') break;
  }

  return {
    playerId, enemyId, ending, endedAt, startedAt, ticks, ticksWithEvents,
    playMs: endedAt === null ? null : endedAt - startedAt,
    counts, hitBySource, destroyByReason,
    maxEventsPerTick, maxVoicesPerTick, maxTrailHitsPerTick, maxWeaponHitsPerTick,
    ringFlooredAt, worstTick,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
const results = [];
for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) results.push(runMatch(p, e, POLICY));

const total = Object.fromEntries(ALL_KINDS.map((k) => [k, 0]));
const totalHits = { weapon: 0, trail: 0, hazard: 0, fog: 0 };
const totalDestroy = { 'hit-target': 0, 'hit-cover': 0, expired: 0 };
let timeouts = 0; let knockouts = 0; let unresolved = 0;
let ringFloored = 0;
let worst = { maxVoicesPerTick: -1 };
let maxEv = 0; let maxTrail = 0; let maxWeaponHits = 0;
let allTicks = 0; let allBusyTicks = 0;
const durations = [];
for (const r of results) {
  for (const k of ALL_KINDS) total[k] += r.counts[k];
  for (const k of Object.keys(totalHits)) totalHits[k] += r.hitBySource[k];
  for (const k of Object.keys(totalDestroy)) totalDestroy[k] += r.destroyByReason[k];
  if (r.ending === 'timeout') timeouts++;
  else if (r.ending === 'knockout') knockouts++;
  else unresolved++;
  if (r.ringFlooredAt !== null) ringFloored++;
  if (r.maxVoicesPerTick > worst.maxVoicesPerTick) worst = r;
  maxEv = Math.max(maxEv, r.maxEventsPerTick);
  maxTrail = Math.max(maxTrail, r.maxTrailHitsPerTick);
  maxWeaponHits = Math.max(maxWeaponHits, r.maxWeaponHitsPerTick);
  if (r.playMs !== null) durations.push(r.playMs);
  allTicks += r.ticks; allBusyTicks += r.ticksWithEvents;
}
durations.sort((a, b) => a - b);
const median = durations.length ? durations[durations.length >> 1] : 0;
const mean = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

const n = results.length;
console.log(`\n══ event census · ${n} matchups · policy=${POLICY} -> ${resolvePolicy(POLICY)} · clock=${MATCH_DURATION_MS / 1000}s · dt=${DT.toFixed(2)}ms ══`);
console.log(`   driver rev ${DRIVER_REV}${DRIVER.isHistorical ? '  ⚠️ HISTORICAL' : ''} · sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}\n`);
console.log(`endings          knockout ${knockouts}  timeout ${timeouts}  UNRESOLVED ${unresolved}`);
console.log(`PLAY length      mean ${(mean / 1000).toFixed(1)}s  median ${(median / 1000).toFixed(1)}s  max ${(durations[durations.length - 1] / 1000).toFixed(1)}s   (clock ${MATCH_DURATION_MS / 1000}s, excludes the ${(RULES.COUNTDOWN_FROM)}s countdown)`);
console.log(`ring reached its floor (${MIN_SAFE_RADIUS} wu) in ${ringFloored}/${n} matches`);
const floors = results.filter((r) => r.ringFlooredAt !== null).map((r) => r.ringFlooredAt);
if (floors.length) {
  const rel = results.filter((r) => r.ringFlooredAt !== null).map((r) => r.ringFlooredAt - r.startedAt);
  console.log(`  first floor at play-time t=${(Math.min(...rel) / 1000).toFixed(2)}s (schedule: ${((1 - MIN_SAFE_RADIUS / ARENA.maxSafeRadius) * MATCH_DURATION_MS / 1000).toFixed(2)}s)`);
}

console.log(`tick occupancy    ${allBusyTicks}/${allTicks} ticks carry any event at all = ${((allBusyTicks / allTicks) * 100).toFixed(1)}%  (${(100 - (allBusyTicks / allTicks) * 100).toFixed(1)}% are EMPTY)`);
console.log(`\nevents per match (mean over ${n})`);
for (const k of ALL_KINDS) {
  console.log(`  ${k.padEnd(22)} ${(total[k] / n).toFixed(2).padStart(8)}   total ${String(total[k]).padStart(6)}   voices/event ${voicesFor({ type: k, reason: 'hit-cover', source: { kind: 'weapon' }, targetRole: 'enemy' })}`);
}
console.log(`\nhit-landed by source (mean/match)`);
for (const [k, v] of Object.entries(totalHits)) console.log(`  ${k.padEnd(10)} ${(v / n).toFixed(2).padStart(8)}   total ${v}`);
console.log(`projectile-destroyed by reason (mean/match)`);
for (const [k, v] of Object.entries(totalDestroy)) console.log(`  ${k.padEnd(12)} ${(v / n).toFixed(2).padStart(8)}   total ${v}`);

console.log(`\nsimultaneity (worst single 16.7 ms tick across all ${n} matches)`);
console.log(`  max events/tick        ${maxEv}`);
console.log(`  max director voices/tick ${worst.maxVoicesPerTick}   (${worst.playerId} vs ${worst.enemyId})`);
console.log(`  max trail hits/tick    ${maxTrail}   (TRAIL.maxHitsPerTick = ${TRAIL.maxHitsPerTick})`);
console.log(`  max weapon hits/tick   ${maxWeaponHits}`);
console.log(`  worst tick: ${JSON.stringify(worst.worstTick?.map((e) => e.type + (e.source ? `:${e.source.kind}` : '')))}`);

if (args.json) {
  writeFileSync(String(args.json), JSON.stringify({
    policy: POLICY, resolvedPolicy: resolvePolicy(POLICY), driverRev: DRIVER_REV, driverFlags: DRIVER_FLAGS, sim: SIM_DIR,
    clockMs: MATCH_DURATION_MS, n, knockouts, timeouts, unresolved,
    meanMs: mean, medianMs: median, ringFloored, total, totalHits, totalDestroy,
    maxEventsPerTick: maxEv, maxVoicesPerTick: worst.maxVoicesPerTick,
    maxTrailHitsPerTick: maxTrail, maxWeaponHitsPerTick: maxWeaponHits,
    worstTick: worst.worstTick,
  }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
