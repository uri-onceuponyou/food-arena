#!/usr/bin/env node
/**
 * TF_BITID — two sims, ONE driver, stepped in LOCKSTEP, compared after every tick.
 *
 * ── The question this exists to answer ──────────────────────────────────────
 *
 * 🚨 **THE COUNTDOWN-RESEED TRAP.** The scripted driver decides during the countdown from
 * a seeded stream, so **any change to timing re-seeds every match** — and a re-seeded
 * match diverges everywhere for a reason that has nothing to do with the change. Every
 * balance number quoted across such a change is noise wearing a mechanism's clothes.
 * `scripted_player.mjs` fixed that (driver rev 3 guards both the decision loop and the
 * reaction cadence), but "the guard exists" is a claim about code, and this project's own
 * record says not to trust those. So the claim is measured instead:
 *
 *   >> WHERE, EXACTLY, DOES THE FIRST DIFFERENCE APPEAR — and what happened on that tick?
 *
 * A change that is OUTSIDE the reseed path cannot move anything before the first press,
 * so its first divergent tick must be at or after a `projectile-spawned`. A change that is
 * INSIDE it diverges during the countdown, or on the whistle tick, before any shot exists.
 * Those two answers look nothing alike, which is what makes this worth running rather than
 * arguing.
 *
 * ── How ─────────────────────────────────────────────────────────────────────
 *
 * ONE driver instance feeds BOTH sims the identical input object every tick, so the arms
 * cannot diverge through the driver even in principle — if they diverge it is the sim.
 * ⚠️ The driver is fed the state of the BASELINE arm only, deliberately: once the arms
 * differ, "the same driver" stops being well-defined unless one of them is the authority.
 * That makes every tick after the first divergence a comparison of a candidate sim against
 * a baseline TRAJECTORY, which is what a first-divergence report wants.
 *
 * The comparison is over the whole of `MatchState` (fighters, projectiles, trail marks,
 * splats, clock, phase, safe radius, rng-free counters) AND over the returned `GameEvent[]`
 * in order — the same standard `conceal_lab --bitid` and `DECISIONS §58` used.
 *
 *   node tools/tmp/tf_bitid.mjs --selftest
 *   node tools/tmp/tf_bitid.mjs --ref /tmp/head/src/game --seeds 8
 *
 * ⚠️ `--ref` MUST BE A REAL EXTRACTED TREE (`git archive HEAD | tar -x`), not a `--ref`
 * flag on some other tool: `docs/AGENT-BRIEF.md` §3 records `rg_lib`'s pinning silently
 * reading the working tree for BOTH arms and returning byte-identical numbers, which reads
 * exactly like "the change did nothing".
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

const A = {
  ...(await import(`${REF_DIR}/sim.ts`)),
  RULES: await import(`${REF_DIR}/rules.ts`),
};
const B = {
  ...(await import(`${SIM_DIR}/sim.ts`)),
  RULES: await import(`${SIM_DIR}/rules.ts`),
};

const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS, HIT_RADIUS_VS_ENEMY, HIT_RADIUS_VS_PLAYER } = B.RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const FOG_FIRST_CONTACT_MS = 6000;
const derivedMaxSafe = Math.round(
  Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
);
const arena = { ...ARENA_DATA, maxSafeRadius: derivedMaxSafe, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...DRIVER_FLAGS });

// ─────────────────────────────────────────────────────────────────────────────
// The comparison — whole state, then the event stream in order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A stable, total serialisation of one fighter. Listed explicitly rather than
 * `JSON.stringify(f)` for the reason `DECISIONS §52` records: `MatchState` does not
 * survive a JSON round trip — `-Infinity` sentinels flatten to `null`, so seven fields
 * would compare EQUAL between an arm that had them and an arm that did not.
 */
const fighterOf = (f) => [
  f.id, f.hp, f.maxHp, f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
].join('|');

/**
 * …and of one projectile, INCLUDING the new bookkeeping. `tx`/`ty`/`age` are `undefined`
 * on the reference arm, which serialises differently from a number — so this comparison
 * would fire on the added fields alone if the change were nothing else. That is why the
 * report is a FIRST-DIVERGENCE TICK and not a boolean: the fields are expected to differ,
 * and what is being located is the first tick on which OUTCOMES do.
 */
const projOf = (p) => [
  p.id, p.ownerId, p.targetId, p.weapon.key, p.x, p.y, p.vx, p.vy, p.traveled, p.damage,
  p.arrived, p.peckTimer, p.hitsSoFar,
].join('|');

const stateOf = (s) => [
  s.phase, s.elapsed, s.timeRemaining, s.safeRadius, s.winnerId ?? 'none', s.nextId,
  s.fighters.map(fighterOf).join(';'),
  s.projectiles.map(projOf).join(';'),
  s.trailMarks.map((m) => `${m.id},${m.ownerId},${m.x},${m.y},${m.expiresAt},${m.damagedMask}`).join(';'),
  s.splats.map((sp) => `${sp.id},${sp.x},${sp.y},${sp.expiresAt}`).join(';'),
].join('\n');

const eventsOf = (evs) => evs.map((e) => JSON.stringify(e)).join('\n');

/**
 * One matchup, both arms, in lockstep. Returns the first tick on which either the state or
 * the event stream differs, plus what the baseline arm did on that tick and everything the
 * two arms had done up to it.
 */
function lockstep(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const sa = A.createMatch(arena, playerId, enemyId);
  const sb = B.createMatch(arena, playerId, enemyId);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  let firstSpawnTick = null;
  let whistleTick = null;

  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP) {
    // ONE input object, both arms. Built from the BASELINE arm — see the header.
    const input = loop.next(sa, DT);
    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    tick++;
    if (whistleTick === null && ea.some((e) => e.type === 'match-started')) whistleTick = tick;
    if (firstSpawnTick === null && ea.some((e) => e.type === 'projectile-spawned')) firstSpawnTick = tick;

    if (eventsOf(ea) !== eventsOf(eb) || stateOf(sa) !== stateOf(sb)) {
      return {
        diverged: true, tick, whistleTick, firstSpawnTick,
        phase: sa.phase,
        elapsed: sa.elapsed,
        kinds: [...new Set([...ea, ...eb].map((e) => e.type))].join(','),
      };
    }
  }
  return { diverged: false, tick, whistleTick, firstSpawnTick, phase: sa.phase, elapsed: sa.elapsed, kinds: '' };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a comparator that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ tf_bitid SELFTEST ══  ref ${REF_DIR}\n                        sim ${SIM_DIR}`);

  // ── A. SELF-PAIR. The same tree against itself must NEVER diverge. ────────
  //
  // ⚠️ AND THIS IS THE ROW THAT CATCHES A COMPARATOR THAT IS SECRETLY COMPARING ONE TREE
  // WITH ITSELF FOR THE WRONG REASON. It is necessary and NOT sufficient — see B.
  {
    const selfA = { ...A };
    const bad = [];
    for (let s = 0; s < 3; s++) {
      const rnd = rng(s * 7919 + 'sushi'.length * 131 + 'donut'.length * 17 + POLICY.length);
      const decide = driver.POLICY_FNS[POLICY](rnd);
      const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd });
      const s1 = selfA.createMatch(arena, 'sushi', 'donut');
      const s2 = selfA.createMatch(arena, 'sushi', 'donut');
      for (let i = 0; i < 600 && s1.phase !== 'ended'; i++) {
        const input = loop.next(s1, DT);
        const e1 = selfA.stepMatch(s1, DT, input);
        const e2 = selfA.stepMatch(s2, DT, input);
        if (eventsOf(e1) !== eventsOf(e2) || stateOf(s1) !== stateOf(s2)) { bad.push(`seed ${s} tick ${i}`); break; }
      }
    }
    ok('SELF-PAIR: the reference tree against itself never diverges', bad.length === 0, bad.join(' · '));
  }

  // ── B. KNOWN-BAD: THE COMPARATOR MUST FIRE ON A DIFFERENCE IT IS SHOWN ────
  //
  // 🚨 A guard that has not been shown to FAIL is not a guard, and a lockstep comparator
  // is the easiest thing in this repo to write in a form that can only ever say "identical"
  // (`AGENT-BRIEF` §3 records exactly that outcome, byte-identical on every column, from a
  // pinning bug). So one field is perturbed by hand on one arm at a known tick and the
  // comparator is required to notice on that tick and not later.
  {
    const rnd = rng(7919 + 'sushi'.length * 131 + 'donut'.length * 17 + POLICY.length);
    const decide = driver.POLICY_FNS[POLICY](rnd);
    const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: 60, rnd });
    const s1 = A.createMatch(arena, 'sushi', 'donut');
    const s2 = A.createMatch(arena, 'sushi', 'donut');
    const POKE = 200;
    let caught = null;
    for (let i = 0; i < 600 && s1.phase !== 'ended' && caught === null; i++) {
      if (i === POKE) s2.fighters[1].hp -= 1;
      const input = loop.next(s1, DT);
      const e1 = A.stepMatch(s1, DT, input);
      const e2 = A.stepMatch(s2, DT, input);
      if (eventsOf(e1) !== eventsOf(e2) || stateOf(s1) !== stateOf(s2)) caught = i;
    }
    ok(`KNOWN-BAD: a 1 HP poke on tick ${POKE} is caught on that tick`, caught === POKE, `caught at ${caught}`);
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
  const diverged = rows.filter((r) => r.diverged);
  const beforeWhistle = diverged.filter((r) => r.whistleTick === null || r.tick <= r.whistleTick);
  const beforeFirstShot = diverged.filter((r) => r.firstSpawnTick === null || r.tick < r.firstSpawnTick);

  console.log(`\n══ TF_BITID ══  ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ref ${REF_DIR}`);
  console.log(`   sim ${SIM_DIR}`);
  console.log(`   arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius}\n`);
  console.log(`   diverged                       ${diverged.length}/${rows.length}`);
  console.log(`   …of those, BEFORE the whistle  ${beforeWhistle.length}   <-- any non-zero means the countdown moved`);
  console.log(`   …of those, BEFORE the 1st shot ${beforeFirstShot.length}   <-- any non-zero means the change is not the projectile rule`);
  if (diverged.length) {
    const lag = diverged.filter((r) => r.firstSpawnTick !== null).map((r) => r.tick - r.firstSpawnTick);
    lag.sort((a, b) => a - b);
    console.log(`   first-divergence lag after the first shot: min ${lag[0]} · median ${lag[Math.floor(lag.length / 2)]} · max ${lag[lag.length - 1]} ticks`);
    console.log(`   event kinds on the first divergent tick: ${[...new Set(diverged.map((r) => r.kinds))].slice(0, 6).join(' | ')}`);
  }
  console.log(`\n   >> ${beforeWhistle.length === 0 && beforeFirstShot.length === 0
    ? 'OUTSIDE the countdown-reseed path: nothing moves until a projectile exists.'
    : 'INSIDE the reseed path (or something else moved) — every balance number across this change is suspect.'}\n`);
}
