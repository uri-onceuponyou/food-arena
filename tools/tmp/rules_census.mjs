#!/usr/bin/env node
/**
 * RULES CENSUS — every tunable in `rules.ts` that carries a time unit or an implied
 * number-of-uses-per-match, measured against the REAL `src/game/sim.ts`.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * `MATCH_DURATION_MS` went 180 s -> 45 s. Every other constant in `rules.ts` was
 * tuned against the 180 s clock and none of them were swept. Two were already known
 * dead (`REGEN_DELAY_MS`, and `MIN_SAFE_RADIUS`/`resolveTimeout` being unreachable),
 * both found by accident. This is the systematic pass.
 *
 * ── Method ─────────────────────────────────────────────────────────────────
 * 110 matchups x N seeds x 3 policies through `stepMatch`, reading state and the
 * event stream every tick. Nothing here models the sim; it observes it.
 *
 * The scripted player is `tools/tmp/scripted_player.mjs` — IMPORTED, not copied. This
 * file used to carry its own verbatim transcription of `tools/match-sim.mjs`'s driver,
 * and `status_census.mjs` was then copied FROM here, which is how one stale driver
 * reached ten instruments (`docs/LESSONS.md` §5, commit d9753ff). A seeded jitter on
 * reaction time still layers on top so seeds produce genuinely different matches rather
 * than N copies of one deterministic run; seed 0 is jitter-free and reproduces
 * `match-sim.mjs` exactly, which is the instrument's own control.
 *
 * ⚠️ EVERY FIGURE THIS TOOL PRINTED BEFORE 2026-08-05 CARRIES THE COUNTDOWN DETOUR.
 * The stuck detector ran during the COUNTDOWN, when `sim.ts:movePlayer` is not called at
 * all, so it read "1.5 s of walking, 0 wu covered" and latched a 900 ms perpendicular
 * detour that was walked SIDEWAYS at the whistle. The decision loop also DECIDED during
 * the countdown, drawing seeded RNG, so the stream at the whistle was a function of
 * countdown length. Both faults are reproducible by flag:
 *
 *     --nav-countdown-bug --decide-during-countdown
 *
 * which reproduce this tool's pre-fix JSON BYTE-IDENTICALLY on a frozen sim. An UNSTAMPED
 * JSON (no `driverRev`) is pre-fix.
 *
 * ⚠️ `match-sim.mjs` documents its scripted player as "the shape of a match, not a
 * skill benchmark" — perfect information, fixed reaction. So this measures WHAT THE
 * SCRIPT TRIGGERS. Where a mechanic is dead here but plausibly alive against a
 * kiting human, `--report` says so rather than calling it dead.
 *
 *   node tools/tmp/rules_census.mjs --seeds 30
 *   node tools/tmp/rules_census.mjs --seeds 30 --policies smart --json out.json
 *   node tools/tmp/rules_census.mjs --seeds 8 --sim /tmp/frozen/src/game --arena tools/arena.gameplay.json
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

/** Which sim to drive. Defaults to the working tree; `--sim <dir>` points at a staged
 *  copy so a constant sweep can run the same instrument against a patched `rules.ts`. */
const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, MIN_SAFE_RADIUS,
  REGEN_DELAY_MS, REGEN_TICK_MS, REGEN_AMOUNT,
  SLOW_DURATION_MS, STUN_DURATION_MS, SPLAT_DURATION_MS, SPLAT_RADIUS,
  TRAIL, POT, PLAYER_SPEED, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY, REACH,
  COUNTDOWN_FROM, COUNTDOWN_START_FLASH_MS, FOG_DAMAGE, FOG_TICK_MS,
} = RULES;

/**
 * ⚠️ The default used to be `tools/tmp/arena.frozen.json`, which is not in this repo and
 * never has been on `main`: it exists only inside the unmerged WIP commit `b3dda69`. So
 * the tool as committed could not run at all without `--arena`, and `cf3e30d`'s figures
 * — which name that file as their arena, "frozen at 8359a4f" — are not re-derivable from
 * anything on the branch. Default is now the tracked dump every other tool in this family
 * uses; `git show b3dda69:tools/tmp/arena.frozen.json` recovers the old one if a figure
 * from that pass ever has to be reproduced exactly.
 */
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
const SEEDS = Number(args.seeds ?? 12);
const POLICIES = String(args.policies ?? 'idle,smart,chase').split(',');
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ─────────────────────────────────────────────────────────────────────────────
// the hand on the controls — ONE implementation, imported
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `tools/tmp/scripted_player.mjs` owns the policies, the nav and the reaction cadence.
 * This file used to transcribe all three; `status_census.mjs` was then copied from that
 * transcription, and the copy is what kept the countdown defect alive after
 * `match-sim.mjs` had already fixed it. `rng`, `POLICY_FNS`, `makeNav`, `lineOfSight`,
 * `bestWeapon`, `preferredRange` and `axesToward` all now come from there, so this file
 * cannot drift from `match-sim.mjs` again without the drift being a diff in ONE file.
 */
const DRIVER = createScriptedPlayer({
  CHARACTERS, REACH, arena, hazard: HAZ, ...parseDriverFlags(args),
});
const { POLICY_FNS, maxNormalRange } = DRIVER;

if (DRIVER.isHistorical) {
  console.log('\n  ⚠️  HISTORICAL DRIVER — reproducing a defect fixed on 2026-08-05.');
  console.log(`      ${DRIVER.flags.navCountdownBug ? 'nav-countdown-bug ' : ''}${DRIVER.flags.decideDuringCountdown ? 'decide-during-countdown' : ''}`);
  console.log('      These numbers are NOT current. They exist to re-derive an old figure.\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// one instrumented match
// ─────────────────────────────────────────────────────────────────────────────
function runMatch(playerId, enemyId, policy, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = POLICY_FNS[policy](rnd);
  // Seed 0 is jitter-free: reproduces match-sim.mjs exactly.
  // The cadence — including the countdown guard — lives in the shared driver.
  const loop = DRIVER.createDecisionLoop({
    decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd,
  });

  const pReach = maxNormalRange(playerId), eReach = maxNormalRange(enemyId);
  const engageRange = Math.max(pReach + HIT_RADIUS_VS_ENEMY, eReach + HIT_RADIUS_VS_PLAYER);

  const m = {
    playerId, enemyId, policy, seed,
    startedAt: null, endedAt: null, ending: null, winner: null,
    ticks: 0, playTicks: 0, engagedTicks: 0,
    // status
    stun: { player: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 }, enemy: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 } },
    slow: { player: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 }, enemy: { ticks: 0, applications: 0, reapply: 0, longestMs: 0 } },
    // regen
    regen: {
      player: { eligibleTicks: 0, eligibleEngagedTicks: 0, healTicks: 0, hpHealed: 0, gaps: [], maxGapMs: 0 },
      enemy: { eligibleTicks: 0, eligibleEngagedTicks: 0, healTicks: 0, hpHealed: 0, gaps: [], maxGapMs: 0 },
    },
    selfHeal: { uses: 0, hp: 0 },
    // ground
    splats: { created: 0, maxAlive: 0, aliveTickSum: 0, everUsed: 0, victimTicks: 0 },
    trail: { created: 0, maxAlive: 0, hits: 0, damage: 0, everDamaged: 0 },
    terrainSlowTicks: { player: 0, enemy: 0 },
    // hazards
    fog: { hits: 0, damage: 0, firstMs: null, ticksOutside: { player: 0, enemy: 0 } },
    // Who killed whom. The FATAL hit's source, per role — the only number that
    // separates "the zone applies pressure" from "the zone decides the match".
    deathBySource: { player: null, enemy: null },
    fleeTicks: 0,
    hazard: { hits: 0, damage: 0, ticksInside: { player: 0, enemy: 0 } },
    // ring / clock
    minSafeRadius: Infinity, ringFlooredAt: null, clockLeftMs: null,
    // combat
    fires: { player: {}, enemy: {} },
    hitsByWeapon: { player: {}, enemy: {} },
    damageBySource: {},
    projLifetimes: [], projByReason: { 'hit-target': 0, 'hit-cover': 0, expired: 0 },
    peckHits: 0,
    meleeAttempts: 0,
    // cooldown pressure: ticks a weapon was READY (off cooldown) but unused
    readyTicks: { player: {}, enemy: {} },
    inRangeTicks: { player: {}, enemy: {} },
  };

  const lastDamageAt = { player: null, enemy: null };
  const lastSource = { player: null, enemy: null };
  const damagedOnce = { player: false, enemy: false };
  const stunEnd = { player: -1, enemy: -1 };
  const slowEnd = { player: -1, enemy: -1 };
  const stunRun = { player: 0, enemy: 0 };
  const slowRun = { player: 0, enemy: 0 };
  const projSpawn = new Map();
  const splatSeen = new Set();
  const splatUsed = new Set();
  const trailSeen = new Set();
  const trailDamagedIds = new Set();

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;

  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    const input = loop.next(state, DT);
    const wasPlaying = state.phase === 'playing';
    // Snapshot pre-tick status ends so an application is detectable.
    const pre = {
      player: { st: state.player.status.stunnedUntil, sl: state.player.status.slowedUntil },
      enemy: { st: state.enemy.status.stunnedUntil, sl: state.enemy.status.slowedUntil },
    };

    const evs = stepMatch(state, DT, input);
    m.ticks++;

    for (const ev of evs) {
      switch (ev.type) {
        case 'match-started': m.startedAt = state.elapsed; break;
        case 'match-ended':
          m.endedAt = state.elapsed; m.winner = ev.winner;
          m.ending = state.player.alive && state.enemy.alive ? 'timeout' : 'knockout';
          m.clockLeftMs = state.timeRemaining;
          break;
        case 'weapon-fired': {
          const bucket = m.fires[ev.fighterRole];
          bucket[ev.weaponKey] = (bucket[ev.weaponKey] ?? 0) + 1;
          break;
        }
        case 'hit-landed': {
          const k = ev.source.kind;
          m.damageBySource[k] = (m.damageBySource[k] ?? 0) + ev.amount;
          lastDamageAt[ev.targetRole] = state.elapsed;
          lastSource[ev.targetRole] = k;
          damagedOnce[ev.targetRole] = true;
          if (k === 'weapon') {
            const attacker = ev.targetRole === 'player' ? 'enemy' : 'player';
            const b = m.hitsByWeapon[attacker];
            b[ev.source.weaponKey] = (b[ev.source.weaponKey] ?? 0) + 1;
          } else if (k === 'fog') {
            m.fog.hits++; m.fog.damage += ev.amount;
            if (m.fog.firstMs === null) m.fog.firstMs = state.elapsed;
          } else if (k === 'hazard') {
            m.hazard.hits++; m.hazard.damage += ev.amount;
          } else if (k === 'trail') {
            m.trail.hits++; m.trail.damage += ev.amount;
          }
          break;
        }
        case 'heal': {
          // Regen heals are exactly REGEN_AMOUNT (or less, clamped). A `self` weapon
          // heals healAmount (25). Distinguish by whether the tick also fired a self
          // weapon for the same fighter.
          const selfFired = evs.some((x) => x.type === 'weapon-fired' && x.fighterRole === ev.fighterRole
            && CHARACTERS[state[ev.fighterRole].characterId].weapons.find((w) => w.key === x.weaponKey)?.type === 'self');
          if (selfFired) { m.selfHeal.uses++; m.selfHeal.hp += ev.amount; }
          else { m.regen[ev.fighterRole].healTicks++; m.regen[ev.fighterRole].hpHealed += ev.amount; }
          break;
        }
        case 'death': m.deathBySource[ev.fighterRole] = lastSource[ev.fighterRole]; break;
        case 'projectile-spawned': projSpawn.set(ev.id, state.elapsed); break;
        case 'projectile-destroyed': {
          const t0 = projSpawn.get(ev.id);
          if (t0 !== undefined) { m.projLifetimes.push(state.elapsed - t0); projSpawn.delete(ev.id); }
          m.projByReason[ev.reason]++;
          break;
        }
        case 'splat-created': m.splats.created++; break;
        case 'trail-mark-created': m.trail.created++; break;
        default: break;
      }
    }

    if (wasPlaying) {
      m.playTicks++;
      const p = state.player, e = state.enemy;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d <= engageRange) m.engagedTicks++;

      // status accounting
      for (const role of ['player', 'enemy']) {
        const f = state[role];
        if (f.status.stunnedUntil > pre[role].st) {
          m.stun[role].applications++;
          if (state.elapsed < pre[role].st) m.stun[role].reapply++;
          stunEnd[role] = f.status.stunnedUntil;
        }
        if (f.status.slowedUntil > pre[role].sl) {
          m.slow[role].applications++;
          if (state.elapsed < pre[role].sl) m.slow[role].reapply++;
          slowEnd[role] = f.status.slowedUntil;
        }
        if (state.elapsed < f.status.stunnedUntil) {
          m.stun[role].ticks++;
          stunRun[role] += DT;
          if (stunRun[role] > m.stun[role].longestMs) m.stun[role].longestMs = stunRun[role];
        } else stunRun[role] = 0;
        if (state.elapsed < f.status.slowedUntil) {
          m.slow[role].ticks++;
          slowRun[role] += DT;
          if (slowRun[role] > m.slow[role].longestMs) m.slow[role].longestMs = slowRun[role];
        } else slowRun[role] = 0;
        if ((f.terrainSlowFactor ?? 1) < 1) m.terrainSlowTicks[role]++;

        // regen eligibility, measured directly off the same predicate `sim.ts` uses
        if (state.elapsed - f.lastDamagedAt > REGEN_DELAY_MS && f.hp < f.maxHp && f.hp > 0) {
          m.regen[role].eligibleTicks++;
          // Regen that fires while the two fighters are still within reach of each other
          // is not a reward for DISENGAGING — it is a drip between volleys. Splitting the
          // two is what makes a candidate delay judgeable rather than merely smaller.
          if (dist(f.x, f.y, state[role === 'player' ? 'enemy' : 'player'].x, state[role === 'player' ? 'enemy' : 'player'].y) <= engageRange) {
            m.regen[role].eligibleEngagedTicks++;
          }
        }
        // out-of-combat gap AFTER the fighter has been damaged at all (regen requires
        // hp < maxHp, so the pre-first-damage stretch can never regen).
        if (damagedOnce[role] && f.hp < f.maxHp) {
          const gap = state.elapsed - f.lastDamagedAt;
          if (gap > m.regen[role].maxGapMs) m.regen[role].maxGapMs = gap;
        }
        const dc = dist(f.x, f.y, arena.center.x, arena.center.y);
        if (dc > state.safeRadius) m.fog.ticksOutside[role]++;
        if (role === 'enemy' && f.hp < f.maxHp * RULES.AI_FLEE_HP_FRACTION) m.fleeTicks++;
        if (HAZ && dist(f.x, f.y, HAZ.x, HAZ.y) < HAZ.radius) m.hazard.ticksInside[role]++;
      }

      // splat utilisation
      for (const s of state.splats) {
        splatSeen.add(s.id);
        let used = false;
        for (const role of ['player', 'enemy']) {
          const f = state[role];
          if (Math.hypot(f.x - s.x, f.y - s.y) < SPLAT_RADIUS) { used = true; m.splats.victimTicks++; }
        }
        if (used) splatUsed.add(s.id);
      }
      m.splats.maxAlive = Math.max(m.splats.maxAlive, state.splats.length);
      m.splats.aliveTickSum += state.splats.length;
      m.trail.maxAlive = Math.max(m.trail.maxAlive, state.trailMarks.length);
      for (const t of state.trailMarks) { trailSeen.add(t.id); if (t.damaged) trailDamagedIds.add(t.id); }

      // weapon readiness / in-range pressure
      for (const role of ['player', 'enemy']) {
        const f = state[role];
        const ws = CHARACTERS[f.characterId].weapons;
        const other = state[role === 'player' ? 'enemy' : 'player'];
        const dd = dist(f.x, f.y, other.x, other.y);
        ws.forEach((w, i) => {
          if (state.elapsed - f.lastUsed[i] >= w.cooldown) {
            m.readyTicks[role][w.key] = (m.readyTicks[role][w.key] ?? 0) + 1;
            if (dd <= (w.range ?? Infinity)) m.inRangeTicks[role][w.key] = (m.inRangeTicks[role][w.key] ?? 0) + 1;
          }
        });
      }

      if (state.safeRadius < m.minSafeRadius) m.minSafeRadius = state.safeRadius;
      if (m.ringFlooredAt === null && state.safeRadius <= MIN_SAFE_RADIUS + 1e-9) m.ringFlooredAt = state.elapsed;
    }
  }

  m.splats.everUsed = splatUsed.size;
  m.splats.total = splatSeen.size;
  m.trail.everDamaged = trailDamagedIds.size;
  m.trail.total = trailSeen.size;
  m.playMs = m.startedAt === null ? 0 : (m.endedAt ?? state.elapsed) - m.startedAt;
  m.engagedMs = m.engagedTicks * DT;
  if (m.ending === null) m.ending = 'UNRESOLVED';
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// sweep
// ─────────────────────────────────────────────────────────────────────────────
const t0 = Date.now();
const byPolicy = {};
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
  byPolicy[policy] = rows;
}
const elapsedS = (Date.now() - t0) / 1000;

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** `Math.max(...xs)` blows the stack past ~100k elements — this instrument routinely
 *  collects that many projectile lifetimes. Reduce, never spread. */
const vmax = (xs) => xs.reduce((a, b) => (b > a ? b : a), -Infinity);
const vmin = (xs) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const s = (ms) => `${(ms / 1000).toFixed(2)}s`;
function quant(xs, q) { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * q))]; }

console.log(`\n╔══ RULES CENSUS ══ ${nMatches} matches · ${SEEDS} seeds × 110 matchups × ${POLICIES.length} policies · ${elapsedS.toFixed(1)}s`);
console.log(`║ clock ${MATCH_DURATION_MS / 1000}s · arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius} · spawn gap ${Math.round(dist(arena.playerSpawn.x, arena.playerSpawn.y, arena.enemySpawn.x, arena.enemySpawn.y))}wu`);
console.log(`║ sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`║ driver rev ${DRIVER_REV}${DRIVER.isHistorical ? `  ⚠️ HISTORICAL: ${Object.entries(DRIVER.flags).filter(([, v]) => v).map(([k]) => k).join(' ')}` : ''}`);
console.log(`╚══════════════════════════════════════════════════════════════════════════\n`);

/** An UNSTAMPED JSON is pre-2026-08-05 and carries the countdown detour. */
const summary = {
  clockMs: MATCH_DURATION_MS, nMatches, policies: {},
  driverRev: DRIVER_REV, driverFlags: DRIVER.flags, sim: SIM_DIR, arena: ARENA_PATH,
};

for (const policy of POLICIES) {
  const rows = byPolicy[policy];
  const n = rows.length;
  const play = rows.map((r) => r.playMs);
  const eng = rows.map((r) => r.engagedMs);
  const engFrac = mean(rows.map((r) => (r.playTicks ? r.engagedTicks / r.playTicks : 0)));
  const wins = rows.filter((r) => r.winner === 'player').length;
  const timeouts = rows.filter((r) => r.ending === 'timeout').length;
  const unresolved = rows.filter((r) => r.ending === 'UNRESOLVED').length;
  const floored = rows.filter((r) => r.ringFlooredAt !== null).length;

  console.log(`══════ POLICY ${policy.toUpperCase()} ── ${n} matches ══════`);
  console.log(`  PLAY length      mean ${s(mean(play))}  median ${s(quant(play, 0.5))}  p90 ${s(quant(play, 0.9))}  max ${s(vmax(play))}   (clock ${MATCH_DURATION_MS / 1000}s)`);
  console.log(`  ENGAGED          mean ${s(mean(eng))} = ${pct(engFrac)} of play   (dead time ${pct(1 - engFrac)})`);
  console.log(`  endings          knockout ${n - timeouts - unresolved}  TIMEOUT ${timeouts}  unresolved ${unresolved}   ·  player win ${pct(wins / n)}`);
  console.log(`  ring floor       reached in ${floored}/${n} (${pct(floored / n)})   min R seen ${vmin(rows.map((r) => r.minSafeRadius)).toFixed(0)}wu  (floor ${MIN_SAFE_RADIUS})`);

  // ── REGEN ──
  const regEl = rows.flatMap((r) => [r.regen.player.eligibleTicks, r.regen.enemy.eligibleTicks]);
  const regHeal = rows.flatMap((r) => [r.regen.player.healTicks, r.regen.enemy.healTicks]);
  const regHp = rows.flatMap((r) => [r.regen.player.hpHealed, r.regen.enemy.hpHealed]);
  const gaps = rows.flatMap((r) => [r.regen.player.maxGapMs, r.regen.enemy.maxGapMs]);
  console.log(`\n  ── REGEN_DELAY_MS = ${REGEN_DELAY_MS} ────────────────────────────────────`);
  console.log(`     regen ticks/match     ${mean(regHeal).toFixed(3)}   (per FIGHTER; ${regHeal.filter((x) => x > 0).length}/${regHeal.length} fighters ever regened)`);
  console.log(`     HP regained/match     ${mean(regHp).toFixed(2)} per fighter`);
  console.log(`     eligible ticks/match  ${mean(regEl).toFixed(2)} = ${s(mean(regEl) * DT)} of eligibility per fighter`);
  const regEng = rows.flatMap((r) => [r.regen.player.eligibleEngagedTicks, r.regen.enemy.eligibleEngagedTicks]);
  console.log(`     of that eligibility, ${pct(mean(regEng) / Math.max(1e-9, mean(regEl)))} happens while STILL WITHIN REACH of the opponent (a drip, not a reward for disengaging)`);
  console.log(`     longest out-of-combat gap once damaged: mean ${s(mean(gaps))}  p50 ${s(quant(gaps, 0.5))}  p90 ${s(quant(gaps, 0.9))}  max ${s(vmax(gaps))}`);
  const gapSweep = [1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000];
  console.log(`     fighters whose longest gap exceeds a candidate delay:`);
  console.log(`       ${gapSweep.map((g) => `${g / 1000}s`.padStart(6)).join('')}`);
  console.log(`       ${gapSweep.map((g) => pct(gaps.filter((x) => x > g).length / gaps.length).padStart(6)).join('')}`);

  // ── STATUS ──
  const stunTicks = rows.flatMap((r) => [r.stun.player.ticks, r.stun.enemy.ticks]);
  const stunApps = rows.flatMap((r) => [r.stun.player.applications, r.stun.enemy.applications]);
  const stunRe = rows.flatMap((r) => [r.stun.player.reapply, r.stun.enemy.reapply]);
  const slowTicks = rows.flatMap((r) => [r.slow.player.ticks, r.slow.enemy.ticks]);
  const slowApps = rows.flatMap((r) => [r.slow.player.applications, r.slow.enemy.applications]);
  const slowRe = rows.flatMap((r) => [r.slow.player.reapply, r.slow.enemy.reapply]);
  const stunLong = rows.flatMap((r) => [r.stun.player.longestMs, r.stun.enemy.longestMs]);
  const slowLong = rows.flatMap((r) => [r.slow.player.longestMs, r.slow.enemy.longestMs]);
  const engMs = mean(eng) || 1;
  console.log(`\n  ── STUN_DURATION_MS = ${STUN_DURATION_MS} · SLOW_DURATION_MS = ${SLOW_DURATION_MS} ─────────`);
  console.log(`     stun  applications/match ${mean(stunApps).toFixed(2)} per fighter  ·  ${s(mean(stunTicks) * DT)} locked = ${pct((mean(stunTicks) * DT) / mean(play))} of play, ${pct((mean(stunTicks) * DT) / engMs)} of ENGAGED time`);
  console.log(`           re-applied while already stunned: ${mean(stunRe).toFixed(2)}/match (${pct(mean(stunRe) / Math.max(1e-9, mean(stunApps)))} of applications = stun-LOCK)`);
  console.log(`           LONGEST unbroken movement lock: mean ${s(mean(stunLong))}  p90 ${s(quant(stunLong, 0.9))}  max ${s(vmax(stunLong))}   (one application = ${STUN_DURATION_MS}ms)`);
  console.log(`     slow  applications/match ${mean(slowApps).toFixed(2)} per fighter  ·  ${s(mean(slowTicks) * DT)} slowed = ${pct((mean(slowTicks) * DT) / mean(play))} of play, ${pct((mean(slowTicks) * DT) / engMs)} of ENGAGED time`);
  console.log(`           re-applied while already slowed: ${mean(slowRe).toFixed(2)}/match (${pct(mean(slowRe) / Math.max(1e-9, mean(slowApps)))})`);
  console.log(`           LONGEST unbroken slow: mean ${s(mean(slowLong))}  p90 ${s(quant(slowLong, 0.9))}  max ${s(vmax(slowLong))}   (one application = ${SLOW_DURATION_MS}ms)`);

  // ── GROUND EFFECTS ──
  const spCreated = rows.map((r) => r.splats.created);
  const spUsed = rows.map((r) => (r.splats.total ? r.splats.everUsed / r.splats.total : 0));
  const spWith = rows.filter((r) => r.splats.total > 0);
  const trCreated = rows.map((r) => r.trail.created);
  const trRows = rows.filter((r) => r.trail.created > 0);
  console.log(`\n  ── SPLAT_DURATION_MS = ${SPLAT_DURATION_MS} · TRAIL.durationMs = ${TRAIL.durationMs} ─────────`);
  console.log(`     splats created/match  ${mean(spCreated).toFixed(2)}   max alive ${vmax(rows.map((r) => r.splats.maxAlive))}   mean alive ${mean(rows.map((r) => (r.playTicks ? r.splats.aliveTickSum / r.playTicks : 0))).toFixed(2)}`);
  console.log(`     splats that ever slowed anyone: ${pct(mean(spWith.map((r) => r.splats.everUsed / r.splats.total)))}   (${spWith.length} matches had any)`);
  console.log(`     splat victim-ticks/match ${mean(rows.map((r) => r.splats.victimTicks)).toFixed(1)} = ${s(mean(rows.map((r) => r.splats.victimTicks)) * DT)} of fighter-time standing in one`);
  if (trRows.length) {
    console.log(`     trail marks/match     ${mean(trRows.map((r) => r.trail.created)).toFixed(1)}  max alive ${vmax(trRows.map((r) => r.trail.maxAlive))}  (cap = durationMs/dropIntervalMs = ${(TRAIL.durationMs / TRAIL.dropIntervalMs).toFixed(0)})`);
    console.log(`     trail marks that ever bit: ${pct(mean(trRows.map((r) => r.trail.everDamaged / Math.max(1, r.trail.total))))}   hits/match ${mean(trRows.map((r) => r.trail.hits)).toFixed(1)}  damage/match ${mean(trRows.map((r) => r.trail.damage)).toFixed(1)} HP`);
  }
  const terr = rows.flatMap((r) => [r.terrainSlowTicks.player, r.terrainSlowTicks.enemy]);
  console.log(`     terrain slow (puddle+splat) ${s(mean(terr) * DT)} per fighter = ${pct((mean(terr) * DT) / mean(play))} of play`);

  // ── ZONE ──
  const totalDmg = rows.reduce((a, r) => a + Object.values(r.damageBySource).reduce((x, y) => x + y, 0), 0);
  const fogDmg = rows.reduce((a, r) => a + (r.damageBySource.fog ?? 0), 0);
  const hazDmg = rows.reduce((a, r) => a + (r.damageBySource.hazard ?? 0), 0);
  const traDmg = rows.reduce((a, r) => a + (r.damageBySource.trail ?? 0), 0);
  const fogFirst = rows.filter((r) => r.fog.firstMs !== null).map((r) => r.fog.firstMs);
  console.log(`\n  ── FOG (${FOG_DAMAGE}/${FOG_TICK_MS}ms = ${((FOG_DAMAGE / FOG_TICK_MS) * 1000).toFixed(0)} HP/s) · POT (${POT.damage}/${POT.tickMs}ms = ${((POT.damage / POT.tickMs) * 1000).toFixed(0)} HP/s) ──`);
  console.log(`     damage share  fog ${pct(fogDmg / totalDmg)}  ·  hazard ${pct(hazDmg / totalDmg)}  ·  trail ${pct(traDmg / totalDmg)}  ·  weapon ${pct(1 - (fogDmg + hazDmg + traDmg) / totalDmg)}`);
  console.log(`     matches with ANY fog damage ${pct(fogFirst.length / n)}   first fog hit mean ${fogFirst.length ? s(mean(fogFirst)) : '—'}`);
  console.log(`     matches with ANY pot damage ${pct(rows.filter((r) => r.hazard.hits > 0).length / n)}`);
  const kill = (role, kind) => rows.filter((r) => r.deathBySource[role] === kind).length / n;
  console.log(`     WHO KILLED WHOM   player died to: weapon ${pct(kill('player', 'weapon'))} · FOG ${pct(kill('player', 'fog'))} · pot ${pct(kill('player', 'hazard'))} · trail ${pct(kill('player', 'trail'))}`);
  console.log(`                       enemy  died to: weapon ${pct(kill('enemy', 'weapon'))} · FOG ${pct(kill('enemy', 'fog'))} · pot ${pct(kill('enemy', 'hazard'))} · trail ${pct(kill('enemy', 'trail'))}`);
  console.log(`     time OUTSIDE the ring: player ${pct(mean(rows.map((r) => r.fog.ticksOutside.player / Math.max(1, r.playTicks))))} of play · enemy ${pct(mean(rows.map((r) => r.fog.ticksOutside.enemy / Math.max(1, r.playTicks))))}`);
  console.log(`     AI below AI_FLEE_HP_FRACTION (${RULES.AI_FLEE_HP_FRACTION}) for ${pct(mean(rows.map((r) => r.fleeTicks / Math.max(1, r.playTicks))))} of play — and ai.ts's flee vector has NO ring term`);

  // ── PROJECTILES ──
  const lifes = rows.flatMap((r) => r.projLifetimes);
  const reasons = rows.reduce((a, r) => { for (const k of Object.keys(r.projByReason)) a[k] = (a[k] ?? 0) + r.projByReason[k]; return a; }, {});
  const totR = Object.values(reasons).reduce((a, b) => a + b, 0) || 1;
  console.log(`\n  ── PROJECTILE FLIGHT (FLIGHT_MS bands 350/500/875/1750) ──────────────`);
  console.log(`     lifetime  mean ${mean(lifes).toFixed(0)}ms  p50 ${quant(lifes, 0.5).toFixed(0)}ms  p90 ${quant(lifes, 0.9).toFixed(0)}ms  max ${vmax(lifes).toFixed(0)}ms   (n=${lifes.length})`);
  console.log(`     fate      hit ${pct(reasons['hit-target'] / totR)} · cover ${pct(reasons['hit-cover'] / totR)} · fell short ${pct(reasons.expired / totR)}`);

  // Per-matchup player win rate, so any change can be shown NOT to be a balance change.
  const winByMatchup = {};
  for (const r of rows) {
    const k = `${r.playerId}>${r.enemyId}`;
    (winByMatchup[k] ??= { w: 0, n: 0 });
    winByMatchup[k].n++;
    if (r.winner === 'player') winByMatchup[k].w++;
  }
  const matchupRates = Object.fromEntries(Object.entries(winByMatchup).map(([k, v]) => [k, v.w / v.n]));

  summary.policies[policy] = {
    n, meanPlayMs: mean(play), medianPlayMs: quant(play, 0.5), maxPlayMs: vmax(play),
    matchupRates,
    meanEngagedMs: mean(eng), engagedFrac: engFrac, playerWinRate: wins / n,
    timeouts, unresolved, ringFloored: floored,
    regenTicksPerFighterMatch: mean(regHeal), regenHpPerFighterMatch: mean(regHp),
    regenAnyRate: regHeal.filter((x) => x > 0).length / regHeal.length,
    selfHealPerMatch: mean(rows.map((r) => r.selfHeal.uses)),
    trailMarksPerMatch: trRows.length ? mean(trRows.map((r) => r.trail.created)) : 0,
    trailBiteRate: trRows.length ? mean(trRows.map((r) => r.trail.everDamaged / Math.max(1, r.trail.total))) : 0,
    trailDamagePerMatch: trRows.length ? mean(trRows.map((r) => r.trail.damage)) : 0,
    terrainSlowMs: mean(terr) * DT,
    projFateShortfall: reasons.expired / totR, projFateCover: reasons['hit-cover'] / totR,
    maxOutOfCombatGapMs: { mean: mean(gaps), p50: quant(gaps, 0.5), p90: quant(gaps, 0.9), max: vmax(gaps) },
    stunApps: mean(stunApps), stunMs: mean(stunTicks) * DT, stunLockRate: mean(stunRe) / Math.max(1e-9, mean(stunApps)),
    stunLongestMean: mean(stunLong), stunLongestP90: quant(stunLong, 0.9), stunLongestMax: vmax(stunLong),
    slowLongestMean: mean(slowLong), slowLongestP90: quant(slowLong, 0.9), slowLongestMax: vmax(slowLong),
    stunEngagedShare: (mean(stunTicks) * DT) / Math.max(1e-9, mean(eng)),
    slowEngagedShare: (mean(slowTicks) * DT) / Math.max(1e-9, mean(eng)),
    regenEngagedShare: mean(regEng) / Math.max(1e-9, mean(regEl)),
    slowApps: mean(slowApps), slowMs: mean(slowTicks) * DT,
    splatsPerMatch: mean(spCreated), splatUseRate: mean(spWith.map((r) => r.splats.everUsed / r.splats.total)),
    fogShare: fogDmg / totalDmg, hazardShare: hazDmg / totalDmg, trailShare: traDmg / totalDmg,
    playerKilledByFog: rows.filter((r) => r.deathBySource.player === 'fog').length / n,
    enemyKilledByFog: rows.filter((r) => r.deathBySource.enemy === 'fog').length / n,
    playerOutsideRingFrac: mean(rows.map((r) => r.fog.ticksOutside.player / Math.max(1, r.playTicks))),
    enemyOutsideRingFrac: mean(rows.map((r) => r.fog.ticksOutside.enemy / Math.max(1, r.playTicks))),
    projLifeMean: mean(lifes),
  };

  // ── COOLDOWNS: the per-weapon table ──
  console.log(`\n  ── WEAPON COOLDOWNS — uses per match against ${s(mean(play))} play / ${s(mean(eng))} engaged ──`);
  console.log(`     ${'character'.padEnd(12)}${'weapon'.padEnd(10)}${'cd'.padStart(6)}${'fires/m'.padStart(9)}${'hits/m'.padStart(8)}${'cap@play'.padStart(10)}${'cap@eng'.padStart(9)}   ${'verdict'}`);
  const wrows = [];
  for (const id of CHARACTER_IDS) {
    const asP = rows.filter((r) => r.playerId === id);
    const asE = rows.filter((r) => r.enemyId === id);
    for (const w of CHARACTERS[id].weapons) {
      const firesP = mean(asP.map((r) => r.fires.player[w.key] ?? 0));
      const firesE = mean(asE.map((r) => r.fires.enemy[w.key] ?? 0));
      const hitsP = mean(asP.map((r) => r.hitsByWeapon.player[w.key] ?? 0));
      const hitsE = mean(asE.map((r) => r.hitsByWeapon.enemy[w.key] ?? 0));
      const fires = (firesP + firesE) / 2;
      const hits = (hitsP + hitsE) / 2;
      const capPlay = mean(play) / w.cooldown;
      const capEng = mean(eng) / w.cooldown;
      wrows.push({ id, key: w.key, cd: w.cooldown, fires, hits, firesP, firesE, hitsP, hitsE, capPlay, capEng, type: w.type, range: w.range ?? null });
    }
  }
  for (const r of wrows) {
    const verdict = r.fires < 0.5 ? 'RARE (<0.5 uses/match)' : r.fires < 1 ? 'sub-once' : '';
    console.log(`     ${r.id.padEnd(12)}${r.key.padEnd(10)}${String(r.cd).padStart(6)}${r.fires.toFixed(2).padStart(9)}${r.hits.toFixed(2).padStart(8)}${r.capPlay.toFixed(1).padStart(10)}${r.capEng.toFixed(1).padStart(9)}   ${verdict}`);
  }
  summary.policies[policy].weapons = wrows;
  console.log('');
}

// ── cross-policy roll-up on the two headline questions ──
console.log(`\n╔══ HEADLINES ══════════════════════════════════════════════════════════════`);
for (const policy of POLICIES) {
  const p = summary.policies[policy];
  console.log(`║ ${policy.padEnd(6)} play ${s(p.meanPlayMs).padStart(7)} · engaged ${s(p.meanEngagedMs).padStart(7)} (${pct(p.engagedFrac).padStart(6)}) · regen ${p.regenTicksPerFighterMatch.toFixed(3)}/fighter · timeouts ${String(p.timeouts).padStart(4)}/${p.n} · ringFloor ${String(p.ringFloored).padStart(4)}/${p.n} · fog ${pct(p.fogShare).padStart(6)}`);
}
console.log(`╚═══════════════════════════════════════════════════════════════════════════\n`);

if (args.json) { writeFileSync(String(args.json), JSON.stringify(summary, null, 2)); console.log(`wrote ${args.json}`); }
