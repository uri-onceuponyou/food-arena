#!/usr/bin/env node
/**
 * DV_BITID — driver rev 5 re-bases EXACTLY the matchups that contain a wind-up.
 *
 * The second arm of this pass's known-bad, and the more important one. Teaching the
 * scripted player to see a cast changes what it does; the claim that has to be PROVED,
 * not asserted, is that it changes it **nowhere else**. Without this arm the pass has
 * silently rebaselined every balance number in the project — 32 of the roster's 33
 * weapons carry no `castMs`, and every figure measured against them would quietly stop
 * being comparable to the one before it.
 *
 * ── HOW IT DIFFERS FROM `csx_bitid.mjs`, WHICH IT IS A FORK OF ──────────────
 *
 * `csx_bitid` varies the SIM and holds the driver fixed — one driver, two trees, one
 * input stream fed to both so the arms *cannot* diverge through the driver. This varies
 * the DRIVER and holds the sim fixed, so each arm needs its own state, its own driver and
 * its own input. The seeded stream stays paired because the number of `rnd()` draws is a
 * function of the TICK COUNT and never of what `decide()` returned — the property
 * `driver_guard`'s CADENCE check asserts directly.
 *
 *   rev4   `--no-player-dodge --no-player-cast-budget`, i.e. the driver every published
 *          figure was measured on, reproduced BY FLAG on the same tree in the same
 *          process. No worktree, no `--ref`, so `AGENT-BRIEF` §3's "a pinned A/B that
 *          silently read the working tree for both arms" cannot happen here.
 *   rev5   the shipped default.
 *
 * ── THE TWO ARMS, CHECKED IN OPPOSITE DIRECTIONS ────────────────────────────
 *
 *   NULL ARM      no `castMs` weapon in the matchup  ->  must be BIT-IDENTICAL.
 *   FEATURE ARM   one is present                     ->  must DIVERGE somewhere.
 *
 * 🚨 **BOTH ARMS ARE ASSERTED NON-EMPTY BEFORE ANYTHING IS ASSERTED OVER THEM.**
 * `[].every()` is `true`, and CLAUDE.md #6 records that exact vacuity firing three times
 * in three files in one session. A roster that lost its only wind-up would empty the
 * feature arm and this tool would print a perfect result about nothing.
 *
 *   node tools/tmp/dv_bitid.mjs --selftest
 *   node tools/tmp/dv_bitid.mjs --seeds 8
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createScriptedPlayer, rng, DRIVER_REV } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS, SUDDEN_DEATH_MS, suddenDeathActive } = RULES;

/** DERIVED, never typed — `csx_bitid`'s rule, and for its reason: a second special that
 *  grew a `castMs` would otherwise land in the "must be identical" arm and be reported as
 *  a regression that is actually the feature. */
const CAST_CHARS = new Set(
  CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0)),
);
const CAST_MS_OF = (id) => Math.max(0, ...CHARACTERS[id].weapons.map((w) => w.castMs ?? 0));

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
// The opening ring comes from the SHIPPED derivation, never a copied formula.
const openingRadius = RULES.fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2));
const arena = { ...ARENA_DATA, maxSafeRadius: openingRadius, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');

const REV4 = createScriptedPlayer({ CHARACTERS, REACH, arena, noPlayerDodge: true, noPlayerCastBudget: true });
const REV5 = createScriptedPlayer({ CHARACTERS, REACH, arena });

// ─────────────────────────────────────────────────────────────────────────────
// The comparison — `csx_bitid`'s serialisation verbatim, `cast` field and all
// ─────────────────────────────────────────────────────────────────────────────
const fighterOf = (f) => [
  f.id, f.hp, f.maxHp, f.x, f.y, f.facing.x, f.facing.y, f.deaths, f.alive,
  f.trailDropTimer, f.lastDamagedAt, f.regenTimer, f.fogTimer,
  String(f.status.slowedUntil), String(f.status.stunnedUntil),
  f.lastUsed.join(','), f.concealed, f.revealedUntil, f.terrainSlowFactor,
  // eslint-disable-next-line eqeqeq -- `== null` is deliberate: it covers `undefined` too.
  f.cast == null ? 'idle' : `${f.cast.weaponIndex}@${f.cast.startedAt}->${f.cast.resolvesAt}`,
].join('|');

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

const loopFor = (driver, playerId, enemyId, seed) => {
  // The seed formula is `roster_lab.mjs`'s, unchanged, so a row here is the SAME match.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  return driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
};

/**
 * One matchup, two drivers, in lockstep on two independent states.
 *
 * `census` is filled from the REV-5 arm only and answers the vacuity question this tool
 * would otherwise leave open: does either half of rev 5 ever get the chance to fire in a
 * real corpus, or is it live only on a hand-built fixture?
 */
function lockstep(playerId, enemyId, seed, census) {
  const l4 = loopFor(REV4, playerId, enemyId, seed);
  const l5 = loopFor(REV5, playerId, enemyId, seed);
  const s4 = createMatch(arena, playerId, enemyId);
  const s5 = createMatch(arena, playerId, enemyId);
  const ownCastMs = CAST_MS_OF(playerId);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  let diverged = null;
  while (s4.phase !== 'ended' && s4.elapsed < HARD_CAP) {
    const i4 = l4.next(s4, DT);
    const i5 = l5.next(s5, DT);
    if (census && s5.phase === 'playing') {
      census.playTicks++;
      if (suddenDeathActive(s5.timeRemaining)) census.suddenDeathTicks++;
      if (REV5.incomingCast(s5) !== null) census.underTelegraphTicks++;
      if (ownCastMs > 0 && REV5.castBudgetFor(s5) <= ownCastMs) census.budgetRefusalTicks++;
      for (const f of s5.fighters) if (f.cast !== null) { census.castOpenTicks++; break; }
    }
    const e4 = stepMatch(s4, DT, i4);
    const e5 = stepMatch(s5, DT, i5);
    tick++;
    if (diverged === null
      && (eventsOf(e4) !== eventsOf(e5) || stateOf(s4) !== stateOf(s5))) {
      diverged = tick;
      if (!census) return { diverged: true, tick, ticks: tick };
    }
  }
  return { diverged: diverged !== null, tick: diverged, ticks: tick };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a comparator that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log(`\n══ dv_bitid SELFTEST ══  sim ${SIM_DIR}  driver rev ${DRIVER_REV}`);

  ok('the cast-character set is DERIVED and non-empty, so the partition is real',
    CAST_CHARS.size > 0, `[${[...CAST_CHARS].join(', ')}]`);
  ok('the two arms are genuinely different drivers',
    REV4.isHistorical === true && REV5.isHistorical === false
    && REV4.flags.noPlayerCastBudget === true && REV5.flags.noPlayerCastBudget === false);
  ok('…and rev5 resolved its cast terms rather than degrading to nothing',
    REV5.castSource !== null && REV5.hasCastWeapon === true);

  /** Same driver twice, two states, one mutation — the comparator's own known-bad. */
  const pair = (drv, mutate) => {
    const la = loopFor(drv, 'sushi', 'donut', 1);
    const lb = loopFor(drv, 'sushi', 'donut', 1);
    const sa = createMatch(arena, 'sushi', 'donut');
    const sb = createMatch(arena, 'sushi', 'donut');
    for (let i = 0; i < 600 && sa.phase !== 'ended'; i++) {
      if (mutate) mutate(i, sb);
      const ea = stepMatch(sa, DT, la.next(sa, DT));
      const eb = stepMatch(sb, DT, lb.next(sb, DT));
      if (eventsOf(ea) !== eventsOf(eb) || stateOf(sa) !== stateOf(sb)) return i;
    }
    return null;
  };
  ok('SELF-PAIR: rev5 against rev5 on two states never diverges', pair(REV5, null) === null,
    `first divergence ${pair(REV5, null)}`);
  ok('SELF-PAIR: rev4 against rev4 likewise', pair(REV4, null) === null);
  ok('KNOWN-BAD: a 1 HP poke on tick 200 is caught on that tick',
    pair(REV5, (i, s) => { if (i === 200) s.fighters[1].hp -= 1; }) === 200);
  // Inherited from `csx_bitid`: a differ blind to `cast` would print a confident, wrong
  // "identical" for exactly the feature under test.
  ok('KNOWN-BAD: a `cast`-ONLY difference on tick 150 is caught on that tick',
    pair(REV5, (i, s) => {
      if (i === 150) s.fighters[0].cast = { weaponIndex: 0, startedAt: 1, resolvesAt: 2 };
    }) === 150);

  // The partition must be non-empty on BOTH sides, or one of the two verdicts below is vacuous.
  const nullPairs = [];
  const featPairs = [];
  for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) if (p !== e) {
    (CAST_CHARS.has(p) || CAST_CHARS.has(e) ? featPairs : nullPairs).push(`${p}>${e}`);
  }
  ok('NON-EMPTY FIRST: both partitions contain matchups',
    nullPairs.length > 0 && featPairs.length > 0, `null ${nullPairs.length} · feature ${featPairs.length}`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
const t0 = Date.now();
const census = {
  playTicks: 0, suddenDeathTicks: 0, underTelegraphTicks: 0, budgetRefusalTicks: 0, castOpenTicks: 0,
};
const nullArm = [];
const featureArm = [];
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    const feature = CAST_CHARS.has(p) || CAST_CHARS.has(e);
    for (let s = 0; s < SEEDS; s++) {
      const r = { ...lockstep(p, e, s, feature ? census : null), p, e, s };
      (feature ? featureArm : nullArm).push(r);
    }
  }
}

const sum = (rows) => rows.reduce((a, r) => a + r.ticks, 0);
const nullBad = nullArm.filter((r) => r.diverged);
const featureMoved = featureArm.filter((r) => r.diverged);

console.log(`\n══ DV_BITID ══  ${nullArm.length + featureArm.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`   sim   ${SIM_DIR}`);
console.log(`   arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius.toFixed(2)}`);
console.log(`   arms  rev${DRIVER_REV} (default)  vs  rev4 (--no-player-dodge --no-player-cast-budget)`);
console.log(`   cast characters (derived): [${[...CAST_CHARS].join(', ')}]\n`);

console.log(`   NULL ARM      no cast weapon in the matchup`);
console.log(`     matches                 ${nullArm.length}`);
console.log(`     ticks compared          ${sum(nullArm).toLocaleString()}`);
console.log(`     DIVERGED                ${nullBad.length}   <-- must be 0`);
for (const r of nullBad.slice(0, 8)) console.log(`       ${r.p} vs ${r.e} seed ${r.s} @ tick ${r.tick}`);

console.log(`\n   FEATURE ARM   a cast weapon is present`);
console.log(`     matches                 ${featureArm.length}`);
console.log(`     ticks compared          ${sum(featureArm).toLocaleString()}`);
console.log(`     DIVERGED                ${featureMoved.length}   <-- must be > 0, or rev 5 never fired`);
console.log(`     bit-identical           ${featureArm.length - featureMoved.length}`);

console.log(`\n   REACHABILITY CENSUS  (rev-5 arm, feature matchups only — is either half live in a REAL corpus?)`);
const pct = (n) => `${((n / Math.max(1, census.playTicks)) * 100).toFixed(3)}%`;
console.log(`     playing ticks                          ${census.playTicks.toLocaleString()}`);
console.log(`     …with a wind-up open somewhere         ${census.castOpenTicks.toLocaleString()}  ${pct(census.castOpenTicks)}`);
console.log(`     …the driver INSIDE one (dodge live)    ${census.underTelegraphTicks.toLocaleString()}  ${pct(census.underTelegraphTicks)}`);
console.log(`     …inside sudden death                   ${census.suddenDeathTicks.toLocaleString()}  ${pct(census.suddenDeathTicks)}`);
console.log(`     …budget would REFUSE the driver's own  ${census.budgetRefusalTicks.toLocaleString()}  ${pct(census.budgetRefusalTicks)}`);

const verdict = nullBad.length === 0 && featureMoved.length > 0;
console.log(`\n   >> ${verdict
  ? 'PASS — every castless matchup is bit-identical to rev 4, and the cast matchups moved.'
  : 'FAIL — see the rows above; ONE of the two halves is the interesting one.'}\n`);
process.exit(verdict ? 0 : 1);
