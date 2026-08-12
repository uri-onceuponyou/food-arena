#!/usr/bin/env node
/**
 * CSX_BITID — is EVERY weapon without a wind-up bit-identical to before the cast system?
 *
 * A fork of `tools/tmp/tf_bitid.mjs` (same lockstep design, same driver contract, same
 * `--ref` semantics) with three changes, each of which exists because the claim being made
 * here is different from the claim that tool was built for:
 *
 *   1. **`Fighter.cast` IS IN THE SERIALISATION.** `tf_bitid`'s `fighterOf` predates the
 *      field, so a divergence that lived only in the cast record would be invisible to it.
 *      `state.ts:591` records the same trap from the other side — a field that is a getter
 *      or absent is dropped by an `Object.keys` differ, which then prints PASS while
 *      comparing nothing. This is *"a differ blinded to a field that had nothing to drop
 *      yet"* (CLAUDE.md #6), and the fix is to name the field.
 *   2. **THE VERDICT IS PARTITIONED, NOT AGGREGATED.** "N of 110 matchups diverged" is the
 *      wrong shape for this question. The claim has two halves that must be checked in
 *      opposite directions:
 *         · every matchup with NO cast weapon in it must be **bit-identical** — the null;
 *         · every matchup that CONTAINS one must **DIVERGE** — the positive control, and
 *           without it a bug that disabled the feature entirely would read as a perfect
 *           result. A determinism proof over a feature that never fired proves nothing.
 *   3. **TICKS COMPARED ARE COUNTED AND REPORTED**, so "0 differing ticks in N" is a
 *      number rather than a boolean.
 *
 *   node tools/tmp/csx_bitid.mjs --selftest
 *   node tools/tmp/csx_bitid.mjs --ref /tmp/fa-cast-head/src/game --seeds 8
 *
 * ⚠️ `--ref` MUST BE A REAL TREE ON DISK. `docs/AGENT-BRIEF.md` §3 records `rg_lib`'s
 * pinning silently reading the WORKING tree for both arms and returning byte-identical
 * numbers on every column — which reads exactly like "the change did nothing", the most
 * dangerous possible null here. Build it with CLAUDE.md rule 8's recipe:
 *
 *   git worktree add --detach /tmp/fa-cast-head <sha>
 *   ln -s "$PWD/node_modules" /tmp/fa-cast-head/node_modules
 *   ln -s "$PWD/reference"    /tmp/fa-cast-head/reference
 *
 * 🚨 AND THE SELFTEST'S FIRST PRINCIPLE, INHERITED FROM `tf_bitid`: **a comparator that
 * cannot report a difference is worthless.** Three known-bads below, and one of them is
 * specifically a `cast`-only difference, because that is the field this fork exists for.
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

const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`) };

const { CHARACTERS, CHARACTER_IDS, REACH, MATCH_DURATION_MS } = B.RULES;

/**
 * Which characters carry a wind-up, read off the CANDIDATE roster.
 *
 * ⚠️ DERIVED, NEVER TYPED. Writing `['waterbottle']` here would keep this tool passing
 * after a second special grew a `castMs` — the new one would land in the "must be
 * bit-identical" arm and the run would report a regression that is actually the feature.
 */
const CAST_CHARS = new Set(
  CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0)),
);

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
if (!ARENA_DATA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
// The opening ring comes from the SHIPPED derivation, not from a copied formula.
// `tools/tmp/cst_interrupt.mjs` records what the copied one cost: the pre-`6d5c4d6`
// clock coupling opened the ring at 1792 instead of 1720.47, and `fs_sched_census`
// counts 47 live copies of it still in the tree.
const openingRadius = B.RULES.fogOpeningRadiusFor(Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2));
const arena = { ...ARENA_DATA, maxSafeRadius: openingRadius, build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICY = String(args.policy ?? 'smart2');
const DRIVER_FLAGS = parseDriverFlags(args);
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena, ...DRIVER_FLAGS });

// ─────────────────────────────────────────────────────────────────────────────
// The comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A stable, total serialisation of one fighter. Listed explicitly rather than
 * `JSON.stringify(f)` for the reason `DECISIONS §52` records: `MatchState` does not survive
 * a JSON round trip — `-Infinity` sentinels flatten to `null`, so several fields would
 * compare EQUAL between an arm that had them and an arm that did not.
 *
 * 🚨 `cast` IS THE LAST FIELD AND IT IS THE POINT OF THIS FORK.
 *
 * ⚠️ **AND `undefined` COLLAPSES TO `'idle'`, WHICH THE FIRST DRAFT REFUSED TO DO AND WAS
 * WRONG ABOUT.** It distinguished them — `'nofield'` for a reference arm that predates the
 * property, `'idle'` for a candidate holding `null` — on the theory that telling them apart
 * made the positive control sharper. Measured: **720 of 720 null-arm matches "diverged" on
 * tick 1 with an EMPTY event set**, i.e. the differ was reporting the EXISTENCE of the new
 * field, not any behaviour of it, and the null arm was unmeasurable. `tf_bitid`'s own
 * header records the identical situation for `tx`/`ty`/`age`: *"the fields are expected to
 * differ, and what is being located is the first tick on which OUTCOMES do."*
 *
 * "No such field" and "the field is null" are the SAME STATE OF THE WORLD — nobody is
 * casting — so they must serialise the same. A candidate that wrongly leaves a cast open
 * still holds an object here and still fires the comparison, so nothing real is hidden;
 * what is hidden is the schema change, which is not an outcome.
 */
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

/** One matchup, both arms, in lockstep, driven by ONE input object built from the BASELINE
 *  arm — so the arms cannot diverge through the driver even in principle. */
function lockstep(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const sa = A.createMatch(arena, playerId, enemyId);
  const sb = B.createMatch(arena, playerId, enemyId);

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  while (sa.phase !== 'ended' && sa.elapsed < HARD_CAP) {
    const input = loop.next(sa, DT);
    const ea = A.stepMatch(sa, DT, input);
    const eb = B.stepMatch(sb, DT, input);
    tick++;
    if (eventsOf(ea) !== eventsOf(eb) || stateOf(sa) !== stateOf(sb)) {
      const kinds = [...new Set([...ea, ...eb].map((e) => e.type))].join(',');
      return { diverged: true, tick, ticks: tick, kinds };
    }
  }
  return { diverged: false, tick: null, ticks: tick, kinds: '' };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a comparator that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ csx_bitid SELFTEST ══  ref ${REF_DIR}\n                         sim ${SIM_DIR}`);

  const pair = (mutate) => {
    const rnd = rng(7919 + 'sushi'.length * 131 + 'donut'.length * 17 + POLICY.length);
    const decide = driver.POLICY_FNS[POLICY](rnd);
    const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: 60, rnd });
    const s1 = A.createMatch(arena, 'sushi', 'donut');
    const s2 = A.createMatch(arena, 'sushi', 'donut');
    for (let i = 0; i < 600 && s1.phase !== 'ended'; i++) {
      if (mutate) mutate(i, s2);
      const input = loop.next(s1, DT);
      const e1 = A.stepMatch(s1, DT, input);
      const e2 = A.stepMatch(s2, DT, input);
      if (eventsOf(e1) !== eventsOf(e2) || stateOf(s1) !== stateOf(s2)) return i;
    }
    return null;
  };

  ok('SELF-PAIR: the reference tree against itself never diverges', pair(null) === null,
    `first divergence ${pair(null)}`);
  ok('KNOWN-BAD: a 1 HP poke on tick 200 is caught on that tick',
    pair((i, s) => { if (i === 200) s.fighters[1].hp -= 1; }) === 200);

  // 🚨 THE ROW THIS FORK EXISTS FOR. `tf_bitid` PASSES this input, because its `fighterOf`
  // never mentions `cast` — so a divergence living only in the cast record is invisible to
  // it and its verdict would be a confident, wrong "identical". A differ that cannot see
  // the field under test is the vacuity class in its purest form.
  const castOnly = pair((i, s) => {
    if (i === 150) s.fighters[0].cast = { weaponIndex: 0, startedAt: 1, resolvesAt: 2 };
  });
  ok('KNOWN-BAD: a `cast`-ONLY difference on tick 150 is caught on that tick',
    castOnly === 150, `caught at ${castOnly}`);

  ok('the cast-character set is DERIVED and non-empty, so the partition below is real',
    CAST_CHARS.size > 0, `[${[...CAST_CHARS].join(', ')}]`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the run
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  const t0 = Date.now();
  const nullArm = [];
  const featureArm = [];
  for (const p of CHARACTER_IDS) {
    for (const e of CHARACTER_IDS) {
      if (p === e) continue;
      for (let s = 0; s < SEEDS; s++) {
        const r = { ...lockstep(p, e, s), p, e, s };
        (CAST_CHARS.has(p) || CAST_CHARS.has(e) ? featureArm : nullArm).push(r);
      }
    }
  }
  const sum = (rows) => rows.reduce((a, r) => a + r.ticks, 0);
  const nullBad = nullArm.filter((r) => r.diverged);
  const featureSame = featureArm.filter((r) => !r.diverged);

  console.log(`\n══ CSX_BITID ══  ${nullArm.length + featureArm.length} matches · policy ${POLICY} · ${SEEDS} seeds · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ref   ${REF_DIR}`);
  console.log(`   sim   ${SIM_DIR}`);
  console.log(`   arena ${arena.width}x${arena.height} maxSafeRadius ${arena.maxSafeRadius}`);
  console.log(`   cast characters (derived): [${[...CAST_CHARS].join(', ')}]\n`);
  console.log(`   NULL ARM      no cast weapon in the matchup`);
  console.log(`     matches                 ${nullArm.length}`);
  console.log(`     ticks compared          ${sum(nullArm).toLocaleString()}`);
  console.log(`     DIVERGED                ${nullBad.length}   <-- must be 0`);
  if (nullBad.length) {
    for (const r of nullBad.slice(0, 8)) console.log(`       ${r.p} vs ${r.e} seed ${r.s} @ tick ${r.tick} (${r.kinds})`);
  }
  console.log(`\n   FEATURE ARM   a cast weapon is present`);
  console.log(`     matches                 ${featureArm.length}`);
  console.log(`     ticks compared          ${sum(featureArm).toLocaleString()}`);
  console.log(`     BIT-IDENTICAL           ${featureSame.length}   <-- must be 0, or the feature never fired`);
  if (featureSame.length) {
    for (const r of featureSame.slice(0, 8)) console.log(`       ${r.p} vs ${r.e} seed ${r.s} never diverged`);
  }

  const verdict = nullBad.length === 0 && featureSame.length === 0;
  console.log(`\n   >> ${verdict
    ? 'PASS — every castless matchup is bit-identical, and every cast matchup moved.'
    : 'FAIL — see the rows above; ONE of the two halves is the interesting one.'}\n`);
  process.exit(verdict ? 0 : 1);
}
