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
 *   node tools/tmp/audio_census.mjs                    # default sweep
 *   node tools/tmp/audio_census.mjs --policy idle      # matches that reach the whistle
 *   node tools/tmp/audio_census.mjs --json out.json
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const ARENA_CACHE = `${ROOT}/tools/arena.gameplay.json`;

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, MIN_SAFE_RADIUS, FOG_TICK_MS, TRAIL } = RULES;

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

const DT = Number(args.dt ?? 16.667);
const POLICY = String(args.policy ?? 'smart');

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };

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
// A hand on the controls. Deliberately simple — this measures EVENT RATES, not skill.
// ─────────────────────────────────────────────────────────────────────────────
function makePlayer(policy) {
  let detourUntil = -1;
  let detourSign = 1;
  const hist = [];
  return (state) => {
    const p = state.player;
    const e = state.enemy;
    if (policy === 'idle') return { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };

    // `flee` exists to reach the WHISTLE. The aggressive and idle policies both end
    // every match by knockout well inside 45 s, so neither ever exercises
    // `resolveTimeout` or the ring's `MIN_SAFE_RADIUS` floor — the two sim states this
    // census was written to find. A player who runs, heals and never shoots is the
    // cheapest way to make a long match happen without falsifying the sim.
    if (policy === 'flee') {
      const away = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      const cx = state.arena.center.x;
      const cy = state.arena.center.y;
      // Run from the enemy, but bias toward the ring centre so the fog does not simply
      // finish the job the enemy could not.
      const fx = ((p.x - e.x) / away) * 0.6 + ((cx - p.x) / 700) * 1.4;
      const fy = ((p.y - e.y) / away) * 0.6 + ((cy - p.y) / 500) * 1.4;
      const fm = Math.max(Math.abs(fx), Math.abs(fy)) || 1;
      const qq = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);
      const selfSlot = CHARACTERS[p.characterId].weapons.findIndex((w) => w.type === 'self');
      const canSelf = selfSlot >= 0 && state.elapsed - p.lastUsed[selfSlot] >= CHARACTERS[p.characterId].weapons[selfSlot].cooldown;
      return {
        move: { x: qq(fx / fm), y: qq(fy / fm) },
        selectedWeapon: canSelf ? selfSlot : 0,
        attack: canSelf,
      };
    }

    hist.push({ t: state.elapsed, x: p.x, y: p.y });
    while (hist.length && state.elapsed - hist[0].t > 1500) hist.shift();
    if (state.elapsed > detourUntil && hist.length > 4 && state.elapsed - hist[0].t > 1200) {
      if (Math.hypot(p.x - hist[0].x, p.y - hist[0].y) < 24) {
        detourUntil = state.elapsed + 700;
        detourSign = -detourSign;
      }
    }
    let dx = e.x - p.x;
    let dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (state.elapsed < detourUntil) { const t = dx; dx = -dy * detourSign; dy = t * detourSign; }
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
    const q = (v) => (v > 0.35 ? 1 : v < -0.35 ? -1 : 0);

    // Pick the highest-damage weapon in range and off cooldown.
    const ws = CHARACTERS[p.characterId].weapons;
    let slot = null; let bestDmg = -Infinity;
    ws.forEach((w, i) => {
      if (w.type === 'self') return;
      if (state.elapsed - p.lastUsed[i] < w.cooldown) return;
      if (d > (w.range ?? Infinity)) return;
      if ((w.damage ?? 0) > bestDmg) { bestDmg = w.damage ?? 0; slot = i; }
    });
    return {
      move: { x: q(dx / m), y: q(dy / m) },
      aim: { x: (e.x - p.x) / d, y: (e.y - p.y) / d },
      selectedWeapon: slot ?? 0,
      attack: slot !== null,
    };
  };
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
console.log(`\n══ event census · ${n} matchups · policy=${POLICY} · clock=${MATCH_DURATION_MS / 1000}s · dt=${DT.toFixed(2)}ms ══\n`);
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
    policy: POLICY, clockMs: MATCH_DURATION_MS, n, knockouts, timeouts, unresolved,
    meanMs: mean, medianMs: median, ringFloored, total, totalHits, totalDestroy,
    maxEventsPerTick: maxEv, maxVoicesPerTick: worst.maxVoicesPerTick,
    maxTrailHitsPerTick: maxTrail, maxWeaponHitsPerTick: maxWeaponHits,
    worstTick: worst.worstTick,
  }, null, 2));
  console.log(`\nwrote ${args.json}`);
}
