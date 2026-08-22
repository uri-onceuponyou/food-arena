#!/usr/bin/env node
/**
 * SDA_BITID — the SCALE-QUOTIENT lockstep comparator.
 *
 * ── Why `tf_bitid` cannot answer this question ─────────────────────────────
 *
 * `tf_bitid` compares `f.hp` and `f.maxHp` VERBATIM. A unit rescale changes exactly
 * those fields, so `tf_bitid` reports a divergence on tick 1 of every match by
 * construction — for a change that, by hypothesis, moved nothing. **The strongest
 * claim in this project ("0 differing ticks") is not even expressible against a
 * rescale unless the comparator is told what the units are.**
 *
 * So: every HP-DENOMINATED field on the candidate arm is divided by `k` before the
 * comparison, and **every other field is compared byte-for-byte, unchanged**. That
 * asymmetry is the whole instrument. Positions, facings, timers, cooldowns, projectile
 * travel, the safe radius, the clock, the event ORDER and every non-`amount` event
 * field must be bit-identical — a rescale that moves any of those is not a rescale.
 *
 * The HP-denominated set, enumerated from `state.ts`'s `GameEvent` union and `Fighter`:
 *   Fighter    hp, maxHp
 *   Projectile damage
 *   GameEvent  hit-landed.amount, heal.amount
 * Nothing else in `MatchState` is in hit points.
 *
 * ── 🚨 THE KNOWN-BAD IS SCALE-DEPENDENT, AND THAT IS THE POINT ─────────────
 *
 * `tf_bitid`'s known-bad is *"a 1 HP poke on tick 200 is caught on that tick"*. Under
 * a quotient comparator that fixture is ambiguous — 1 HP of WHICH scale?
 *   * 1 OLD unit  = k new units. Trivially catchable, and catching it proves nothing:
 *     a comparator with a tolerance as loose as half a health bar still catches it.
 *   * 1 NEW unit  = 1/k old units. This is the smallest difference the new number
 *     system can express, it is what the whole proposal claims to have bought, and a
 *     comparator that cannot see it is measuring the OLD resolution while reporting on
 *     the new one.
 * **This tool's known-bad is the 1-NEW-UNIT poke**, i.e. the fixture gets k times
 * harder as k grows, which is the correct direction. `--poke-units old|new` runs
 * either, and the selftest requires the new-unit poke to be caught ON ITS TICK.
 *
 *   node tools/tmp/sda_bitid.mjs --selftest --ref /tmp/fa-sda-base/src/game --sim /tmp/fa-sda-k/src/game --k 16
 *   node tools/tmp/sda_bitid.mjs           --ref /tmp/fa-sda-base/src/game --sim /tmp/fa-sda-k/src/game --k 16 --seeds 8
 *
 * ⚠️ `--ref` and `--sim` MUST be real detached worktrees. `AGENT-BRIEF` §3 records a
 * pinning bug that read the working tree for both arms and returned byte-identical
 * numbers on every column, which reads exactly like "the change did nothing".
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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
const REF_DIR = String(args.ref ?? SIM_DIR);
const K = Number(args.k ?? 1);
if (!Number.isFinite(K) || K <= 0) { console.error('sda_bitid: --k must be positive'); process.exit(1); }

const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`), AI: await import(`${REF_DIR}/ai.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`), AI: await import(`${SIM_DIR}/ai.ts`) };

const { CHARACTER_IDS, MATCH_DURATION_MS } = A.RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const FOG_FIRST_CONTACT_MS = 6000;
const derivedMaxSafe = Math.round(
  Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
);
const arena = { ...ARENA_DATA, maxSafeRadius: derivedMaxSafe, build: () => null, update: () => {} };

/**
 * 🚨 THE ARENA IS THE SECOND PLACE HP LIVES, AND IT IS NOT IN `rules.ts`.
 * `tools/arena.gameplay.json` — read by 30+ Node instruments — HARDCODES the central
 * hazard's `damage: 8`. The shipped game does not: `src/arena/kitchen.ts:863` derives it
 * from `POT.damage`. So the two agree today by coincidence and a `rules.ts`-only rescale
 * leaves every OFFLINE balance tool running the pot at 1/k strength while the game runs
 * it at full. That is a stale-but-LEGAL number: it is a valid hazard, it type-checks, and
 * nothing in the battery compares it to its source. `--arena-b <file>` supplies the
 * candidate arm's arena so the two halves of the rescale can be measured apart.
 */
const ARENA_B_PATH = args['arena-b'] ? String(args['arena-b']) : null;
const arenaB = ARENA_B_PATH
  ? (() => { const d = JSON.parse(readFileSync(ARENA_B_PATH, 'utf8')); return { ...d, maxSafeRadius: Math.round(Math.hypot(d.width / 2, d.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)), build: () => null, update: () => {} }; })()
  : arena;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const DRIVER_FLAGS = parseDriverFlags(args);
/**
 * ⚠️ LEVEL 1 IS THE EASY CASE AND IT IS NOT THE WHOLE CASE. At `LEVEL_MIN` every level
 * multiplier is exactly 1.0, so every hp in the sim is an INTEGER and integer arithmetic
 * is exact in a double — a rescale cannot round differently because nothing rounds. At
 * L > 1 `damageMul` is 1 + (L-1)*0.05 and hp goes continuous, which is where a factor
 * that is not a power of two can round differently on the two arms. `--level N` runs both
 * fighters at N so that claim is measured rather than assumed.
 */
const LEVEL = args.level === undefined ? null : Number(args.level);

/**
 * ⚠️ ONE DRIVER PER ARM, BOUND TO THAT ARM'S OWN RULES — and then only ARM A's is ever
 * used to drive. `pressValue` is a `Map` keyed on WEAPON OBJECT IDENTITY, so a driver
 * handed A's map and B's `CHARACTERS` ranks every weapon by the authored fallback and
 * is fault 4 restored by accident (`scripted_player.mjs` throws on exactly that, which
 * is why this is spelled out rather than assumed).
 */
const mkDriver = (S) => createScriptedPlayer({
  CHARACTERS: S.RULES.CHARACTERS, REACH: S.RULES.REACH, arena,
  pressValue: S.AI.pressValue, selfHealHpFraction: S.RULES.AI_SELF_HEAL_HP_FRACTION,
  ...DRIVER_FLAGS,
});
const driverA = mkDriver(A);
const mkDriverB = (S) => createScriptedPlayer({ CHARACTERS: S.RULES.CHARACTERS, REACH: S.RULES.REACH, arena: arenaB, pressValue: S.AI.pressValue, selfHealHpFraction: S.RULES.AI_SELF_HEAL_HP_FRACTION, ...DRIVER_FLAGS });
const driverB = mkDriverB(B);

// ─────────────────────────────────────────────────────────────────────────────
// The comparison
// ─────────────────────────────────────────────────────────────────────────────

/** HP-denominated → old units. Everything else passes through untouched. */
const q = (v) => v / K;

const fighterOf = (f, k) => [
  f.id, k ? q(f.hp) : f.hp, k ? q(f.maxHp) : f.maxHp,
  f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
].join('|');

const projOf = (p, k) => [
  p.id, p.ownerId, p.targetId, p.weapon.key, p.x, p.y, p.vx, p.vy, p.traveled,
  k ? q(p.damage) : p.damage,
  p.arrived, p.peckTimer, p.hitsSoFar,
].join('|');

const stateOf = (s, k) => [
  s.phase, s.elapsed, s.timeRemaining, s.safeRadius, s.winnerId ?? 'none', s.nextId,
  s.fighters.map((f) => fighterOf(f, k)).join(';'),
  s.projectiles.map((p) => projOf(p, k)).join(';'),
  s.trailMarks.map((m) => `${m.id},${m.ownerId},${m.x},${m.y},${m.expiresAt},${m.damagedMask}`).join(';'),
  s.splats.map((sp) => `${sp.id},${sp.x},${sp.y},${sp.expiresAt}`).join(';'),
].join('\n');

/** The event stream, with `amount` in old units on the scaled arm. */
const eventsOf = (evs, k) => evs.map((e) => JSON.stringify(
  k && (e.type === 'hit-landed' || e.type === 'heal') ? { ...e, amount: q(e.amount) } : e,
)).join('\n');

/**
 * The event stream with the HP AMOUNTS DELETED ENTIRELY. This is the weaker,
 * outcome-only standard: same events, same order, same everything except how much was
 * dealt. A rescale that is exact under `eventsOf` is exact under this too; one that is
 * NOT tells you the difference is confined to magnitudes and did not change what
 * happened. Reported separately so the two are never conflated.
 */
const shapeOf = (evs) => evs.map((e) => JSON.stringify(
  (e.type === 'hit-landed' || e.type === 'heal') ? { ...e, amount: undefined } : e,
)).join('\n');

/** Largest |hp_scaled/k - hp_base| seen anywhere, in OLD units. */
function hpDelta(sa, sb) {
  let m = 0;
  for (let i = 0; i < sa.fighters.length && i < sb.fighters.length; i++) {
    m = Math.max(m, Math.abs(q(sb.fighters[i].hp) - sa.fighters[i].hp));
    m = Math.max(m, Math.abs(q(sb.fighters[i].maxHp) - sa.fighters[i].maxHp));
  }
  return m;
}

function lockstep(playerId, enemyId, seed, opts = {}) {
  const { pokeTick = null, pokeUnits = 'new' } = opts;
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driverA.POLICY_FNS[POLICY](rnd);
  const loop = driverA.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  // The SECOND driver, bound to the candidate's rules AND FED THE CANDIDATE'S STATE.
  // It never drives anything; it exists so "the driver did not change either" is a
  // measurement rather than an argument about monotone ranking keys.
  //
  // 🚨 IT WAS FED THE BASELINE STATE FIRST, AND THAT WAS A FIXTURE BUG THAT MANUFACTURED
  // 80 FALSE POSITIVES — every one of them Hamburger, the only character with a heal.
  // `scripted_player.healWeapon` tests `p.maxHp - p.hp < heal`: with `p` from the
  // OLD-scale arm and `heal` read from the NEW-scale table, the guard compares 70 HP of
  // headroom against a 288 HP heal and refuses forever. The driver was not scale-
  // sensitive; the harness was mixing units. The cross-unit comparison that broke the
  // fixture is exactly the one `ai.ts:512` makes in the real game, which is why
  // k_HP and k_damage have to be the SAME number.
  const rndB = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decideB = driverB.POLICY_FNS[POLICY](rndB);
  const loopB = driverB.createDecisionLoop({ decide: decideB, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd: rndB });

  const LV = LEVEL === null ? undefined : { player: LEVEL, enemy: LEVEL };
  const sa = A.createMatch(arena, playerId, enemyId, LV);
  const sb = B.createMatch(arenaB, playerId, enemyId, LV);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  let firstSpawnTick = null;
  let hits = 0;
  let maxDelta = 0;
  let strictTick = null;
  let firstHitTick = null;
  let shapeTick = null;
  let driverTick = null;

  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP) {
    // The index of the tick ABOUT to be stepped. Divergences are reported against this,
    // not against the post-increment counter, so "poked on tick N, caught on tick N" is
    // literally true rather than off by one — the assertion `tf_bitid` makes and the one
    // thing that distinguishes "the comparator noticed" from "the comparator noticed
    // eventually", which is a different and much weaker claim.
    const idx = tick;
    if (pokeTick !== null && idx === pokeTick) sb.fighters[1].hp -= (pokeUnits === 'old' ? K : 1);
    const input = loop.next(sa, DT);
    const inputB = loopB.next(sb, DT);
    if (driverTick === null && JSON.stringify(input) !== JSON.stringify(inputB)) driverTick = idx;

    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    tick++;
    hits += ea.filter((e) => e.type === 'hit-landed' || e.type === 'heal').length;
    if (firstSpawnTick === null && ea.some((e) => e.type === 'projectile-spawned')) firstSpawnTick = tick;
    maxDelta = Math.max(maxDelta, hpDelta(sa, sb));

    // 🚨 THE BASELINE ARM IS NOT NORMALISED — `eventsOf(ea, 0)`, NOT `eventsOf(ea, K)`.
    // Written the wrong way first, and it reported 220/220 STRICT divergences against a
    // rescale that was in fact exact: dividing BOTH arms by k compares `amount/k` with
    // `amount`, which differs by a factor of k on every hit. The selftest passed 9/9 over
    // it, because every known-bad in it perturbs `hp` and is caught through `stateOf` —
    // **not one assertion reached the event path.** That is the `[].every()` class in a
    // new disguise: an arm of the comparison that no known-bad exercises. Assertion 5
    // below now exercises it explicitly.
    if (strictTick === null && (eventsOf(ea, 0) !== eventsOf(eb, K) || stateOf(sa, 0) !== stateOf(sb, K))) strictTick = idx;
    if (firstHitTick === null && ea.some((e) => e.type === 'hit-landed' || e.type === 'heal')) firstHitTick = idx;
    if (shapeTick === null && (shapeOf(ea) !== shapeOf(eb) || stateOf({ ...sa, fighters: [], projectiles: [] }, 0) !== stateOf({ ...sb, fighters: [], projectiles: [] }, K))) shapeTick = idx;
    if (shapeTick === null) {
      // alive/deaths/position are OUTCOME fields and live on the fighter — compare them
      // without the HP magnitudes at all.
      const shape = (s) => s.fighters.map((f) => `${f.id},${f.alive},${f.deaths},${f.x},${f.y}`).join(';');
      if (shape(sa) !== shape(sb)) shapeTick = idx;
    }
    if (strictTick !== null && shapeTick !== null && driverTick !== null) break;
  }
  return {
    label: `${playerId}>${enemyId}#${seed}`,
    ticks: tick, firstSpawnTick, firstHitTick, hits, maxDelta, strictTick, shapeTick, driverTick,
    winnerA: sa.winnerId ?? null, winnerB: sb.winnerId ?? null,
    elapsedA: sa.elapsed, elapsedB: sb.elapsed,
  };
}


/**
 * Step one matchup to the FIRST tick that carries an HP-bearing event and report the
 * three facts assertion 3b needs. Separate from `lockstep` because `lockstep` stops at
 * the first divergence and this must run to a specific EVENT, which may be later.
 */
function firstHitCompare(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driverA.POLICY_FNS[POLICY](rnd);
  const loop = driverA.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const sa = A.createMatch(arena, playerId, enemyId);
  const sb = B.createMatch(arena, playerId, enemyId);
  for (let t = 0; t < 8000 && sa.phase !== 'ended'; t++) {
    const input = loop.next(sa, DT);
    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    if (ea.some((e) => e.type === 'hit-landed' || e.type === 'heal')) {
      return { tick: t, blindDiffers: eventsOf(ea, 0) !== eventsOf(eb, 0), quotientEqual: eventsOf(ea, 0) === eventsOf(eb, K) };
    }
  }
  return { tick: null, blindDiffers: false, quotientEqual: false };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ sda_bitid SELFTEST ══  k=${K}\n   ref ${REF_DIR}\n   sim ${SIM_DIR}`);

  // ── 0. NON-VACUITY. Everything below asserts over a set of ticks and a set of
  // events. `[].every()` returns true, and a comparator that never saw a hit has
  // nothing to be right about. Assert the sets are NON-EMPTY *first*.
  const probe = lockstep('sushi', 'donut', 1);
  ok('NON-VACUOUS: the probe match ran > 200 ticks', probe.ticks > 200, `${probe.ticks} ticks`);
  ok('NON-VACUOUS: the probe match landed HP events', probe.hits > 0, `${probe.hits} hit/heal events`);
  ok('NON-VACUOUS: a projectile existed', probe.firstSpawnTick !== null, `first spawn tick ${probe.firstSpawnTick}`);
  ok('NON-VACUOUS: k is actually in play', K !== 1 || REF_DIR === SIM_DIR, `k=${K}`);

  // ── 1. KNOWN-BAD, THE HARD ONE: a 1-NEW-UNIT poke = 1/k old units.
  {
    const POKE = 200;
    const r = lockstep('sushi', 'donut', 1, { pokeTick: POKE, pokeUnits: 'new' });
    ok(`KNOWN-BAD: a 1-NEW-UNIT poke (=${(1 / K).toFixed(6)} old HP) on tick ${POKE} is caught on that tick`,
      r.strictTick === POKE, `caught at ${r.strictTick}`);
  }

  // ── 2. KNOWN-BAD, the historical one, kept so the two are never confused.
  {
    const POKE = 200;
    const r = lockstep('sushi', 'donut', 1, { pokeTick: POKE, pokeUnits: 'old' });
    ok(`KNOWN-BAD: a 1-OLD-UNIT poke (=${K} new HP) on tick ${POKE} is caught on that tick`,
      r.strictTick === POKE, `caught at ${r.strictTick}`);
  }

  // ── 3. THE QUOTIENT MUST BE LOAD-BEARING. A scale-BLIND comparator (k=1) must
  // FAIL on a correct rescale. If it does not, the two arms are the same tree and
  // every "identical" this tool prints is the pinning bug from AGENT-BRIEF §3.
  if (REF_DIR !== SIM_DIR && K !== 1) {
    const saveK = K;
    const blindDelta = (() => {
      const sa = A.createMatch(arena, 'sushi', 'donut');
      const sb = B.createMatch(arena, 'sushi', 'donut');
      return stateOf(sa, 0) !== stateOf(sb, 0);
    })();
    ok('QUOTIENT IS LOAD-BEARING: a scale-BLIND compare differs at t=0', blindDelta, `k=${saveK}`);
    const quotientEq = (() => {
      const sa = A.createMatch(arena, 'sushi', 'donut');
      const sb = B.createMatch(arena, 'sushi', 'donut');
      return stateOf(sa, 0) === stateOf(sb, K);
    })();
    ok('…and the quotient compare is EQUAL at t=0', quotientEq);
  } else {
    ok('QUOTIENT IS LOAD-BEARING', false, 'SKIPPED — run with two distinct trees and k != 1');
  }

  // ── 3b. THE EVENT PATH MUST BE EXERCISED BY A KNOWN-BAD OF ITS OWN.
  // Every assertion above perturbs `hp` and is caught through `stateOf`; a comparator
  // whose event arm is wired backwards passes all of them. So: on the tick of the FIRST
  // HP-bearing event, a scale-BLIND event compare must FAIL and the quotient compare
  // must SUCCEED. Non-vacuity is the first half of it — if no such tick exists the
  // assertion is asserting over an empty set and is reported as a FAIL, not skipped.
  if (REF_DIR !== SIM_DIR && K !== 1) {
    const r = firstHitCompare('hamburger', 'donut', 0);
    ok('EVENT PATH: an HP-bearing tick exists to compare', r !== null && r.tick !== null, r ? `tick ${r.tick}` : 'none');
    ok('EVENT PATH: scale-BLIND event compare FAILS on it', !!r && r.blindDiffers, r ? `blindDiffers=${r.blindDiffers}` : '');
    ok('EVENT PATH: quotient event compare SUCCEEDS on it', !!r && r.quotientEqual, r ? `quotientEqual=${r.quotientEqual}` : '');
  } else {
    ok('EVENT PATH known-bad', false, 'SKIPPED — needs two distinct trees and k != 1');
  }

  // ── 4. SELF-PAIR: the reference tree against itself, k=1, never diverges.
  {
    const selfA = { ...A };
    let bad = null;
    const rnd = rng(2 * 7919 + 'sushi'.length * 131 + 'donut'.length * 17 + POLICY.length);
    const decide = driverA.POLICY_FNS[POLICY](rnd);
    const loop = driverA.createDecisionLoop({ decide, reactBase: 150, reactJit: 60, rnd });
    const s1 = selfA.createMatch(arena, 'sushi', 'donut');
    const s2 = selfA.createMatch(arena, 'sushi', 'donut');
    for (let i = 0; i < 600 && s1.phase !== 'ended'; i++) {
      const input = loop.next(s1, DT);
      const e1 = selfA.stepMatch(s1, DT, input);
      const e2 = selfA.stepMatch(s2, DT, input);
      if (eventsOf(e1, 0) !== eventsOf(e2, 0) || stateOf(s1, 0) !== stateOf(s2, 0)) { bad = i; break; }
    }
    ok('SELF-PAIR: the reference tree against itself never diverges', bad === null, bad === null ? '' : `tick ${bad}`);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  const t0 = Date.now();
  const rows = [];
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) rows.push(lockstep(p, e, s));
    }
  }
  const totalTicks = rows.reduce((a, r) => a + r.ticks, 0);
  const totalHits = rows.reduce((a, r) => a + r.hits, 0);
  const strict = rows.filter((r) => r.strictTick !== null);
  const shape = rows.filter((r) => r.shapeTick !== null);
  const drv = rows.filter((r) => r.driverTick !== null);
  const winnerMismatch = rows.filter((r) => r.winnerA !== r.winnerB);
  const maxDelta = rows.reduce((a, r) => Math.max(a, r.maxDelta), 0);

  console.log(`\n══ SDA_BITID ══  k=${K} · level ${LEVEL ?? 'default(1)'} · ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ref ${REF_DIR}`);
  console.log(`   sim ${SIM_DIR}`);
  console.log(`   arena A ${ARENA_PATH}\n   arena B ${ARENA_B_PATH ?? '(same)'}\n`);
  console.log(`   ticks compared                    ${totalTicks.toLocaleString()}`);
  console.log(`   HP-bearing events compared        ${totalHits.toLocaleString()}`);
  console.log(`   ── the three standards, weakest last ──`);
  console.log(`   DRIVER differed                   ${drv.length}/${rows.length}   <-- the input stream itself moved`);
  console.log(`   STRICT  (quotient bit-identical)  ${strict.length}/${rows.length}`);
  console.log(`   OUTCOME (events+positions, no HP) ${shape.length}/${rows.length}`);
  console.log(`   winner differed                   ${winnerMismatch.length}/${rows.length}`);
  console.log(`   max |hp_scaled/k - hp_base|       ${maxDelta.toExponential(3)} old HP`);
  if (strict.length) {
    const t = strict.map((r) => r.strictTick).sort((a, b) => a - b);
    console.log(`   first STRICT divergence tick: min ${t[0]} · median ${t[Math.floor(t.length / 2)]} · max ${t[t.length - 1]}`);
    console.log(`   STRICT rows:  ${strict.slice(0, 12).map((r) => `${r.label}@${r.strictTick}`).join(' · ')}`);
  }
  if (shape.length) console.log(`   OUTCOME rows: ${shape.slice(0, 12).map((r) => `${r.label}@${r.shapeTick}`).join(' · ')}`);
  if (drv.length) {
    const byChar = {};
    for (const r of drv) { const c = r.label.split('>')[0]; byChar[c] = (byChar[c] ?? 0) + 1; }
    console.log(`   DRIVER rows by PLAYER character: ${Object.entries(byChar).map(([c, n]) => `${c} ${n}`).join(' · ')}`);
    console.log(`   DRIVER first-diff tick: min ${Math.min(...drv.map((r) => r.driverTick))} · max ${Math.max(...drv.map((r) => r.driverTick))}`);
  }
  const verdict = drv.length === 0 && strict.length === 0
    ? 'EXACT UNIT RESCALE: every quantity is exactly k x the baseline and nothing else moved.'
    : drv.length === 0 && shape.length === 0
      ? `NOT bit-exact (max ${maxDelta.toExponential(2)} old HP) but OUTCOME-IDENTICAL: no branch flipped in ${totalTicks.toLocaleString()} ticks.`
      : 'THE GAME MOVED. This is not a unit change.';
  console.log(`\n   >> ${verdict}\n`);
}
