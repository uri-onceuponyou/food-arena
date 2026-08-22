#!/usr/bin/env node
/**
 * HP_BITID6 — the SIX-SEAT scale-quotient lockstep comparator for an HP/damage rescale.
 *
 * ── Why this exists when `sda_bitid` already does ──────────────────────────
 *
 * `sda_bitid` is a fine instrument and it is **TWO-SEAT ONLY**: every one of its
 * matches is `createMatch(arena, playerId, enemyId)`. `MAX_FIGHTERS` is 6
 * (`state.ts`), and six-seat invisibility is this project's dominant defect class —
 * the result card, corpse input, shake proximity, seat order, melee single-target and
 * projectile single-target defects were ALL invisible at two seats and passed every
 * two-seat test for weeks. A rescale verified only at N=2 is verified on the seating
 * that has hidden six defects.
 *
 * 🚨 **AND THIS IS NOT HYPOTHETICAL HERE.** `sda_scale --sabotage fog` — FOG_DAMAGE
 * raised 10% in the new units, a real balance change wearing a renumbering — is
 * reported by `sda_bitid` as **0/110 divergences, ">> EXACT UNIT RESCALE"**. The
 * sabotage is genuinely written to the file (375 -> 412.50000000000006, verified by
 * reading the planted tree). It is not caught because at two seats, on the shipped
 * schedule, **the fog never bites**: two fighters converge on each other near the
 * centre and the ring never reaches them. That is a known-bad planted where the bug
 * CANNOT EXPRESS ITSELF — `CLAUDE.md` rule 6's vacuity class, wearing a green tick.
 * Six fighters spread over six spawns across 2800x2000 is the seating where the fog
 * is load-bearing, so `--sabotage fog` is one of this tool's own arms.
 *
 * ── WHAT IS COMPARED, AND THE ASYMMETRY THAT IS THE WHOLE INSTRUMENT ───────
 *
 * Every HP-DENOMINATED field on the candidate arm is divided by `k` before the
 * comparison; **every other field is compared byte-for-byte, unchanged**. Positions,
 * facings, timers, cooldowns, projectile travel, the safe radius, the clock, the
 * phase, the DEATH ORDER, the winner, the tick count and every non-`amount` event
 * field must be bit-identical. A rescale that moves any of those is not a rescale.
 *
 * The HP-denominated set, enumerated from `state.ts`'s `Fighter` / `Projectile` /
 * `GameEvent`:
 *
 *     Fighter     hp, maxHp
 *     Projectile  damage
 *     GameEvent   hit-landed.amount, heal.amount
 *
 * ⚠️ **THE DEFAULT IS "COMPARE IT EXACTLY", NOT "NORMALISE IT".** The normaliser is a
 * NAMED ALLOW-LIST walked over a full JSON serialisation, so a field added to
 * `Fighter` tomorrow is compared byte-exact automatically and shows up as a
 * divergence rather than being silently forgiven. Over-normalising is the failure
 * that hides a real difference, so the allow-list is asserted to be exactly the five
 * keys above and asserted to have ACTUALLY FIRED (see NON-VACUITY below).
 *
 * ── NON-VACUITY, because `[].every()` is `true` ───────────────────────────
 *
 * Every assertion below runs over a filtered set, and a filtered assertion over an
 * empty set is green by construction. So, asserted BEFORE any comparison is believed:
 *
 *   1. six seats were actually seated        (`fighters.length === 6`, not <= 6)
 *   2. the matches actually ran              (> 200 ticks each)
 *   3. HP-bearing events actually happened   (> 0 hit/heal)
 *   4. fighters actually DIED                (> 0 deaths — a match where nobody dies
 *                                             never exercises the death path, which is
 *                                             where seat order and the result card live)
 *   5. projectiles actually existed          (the `Projectile.damage` arm is reachable)
 *   6. the normaliser actually FIRED         (> 0 fields divided by k — a normaliser
 *                                             pointed at a renamed field would forgive
 *                                             nothing and read as a clean pass on a
 *                                             tree where hp is 25x)
 *   7. k is actually in play                 (`k !== 1`)
 *
 * ── KNOWN-BADS: a guard never shown to FAIL is not a guard ────────────────
 *
 * `--selftest` runs the arms below. Each is an input constructed so a CORRECT
 * instrument MUST report a fault:
 *
 *   SELF-PAIR       ref vs ref -> 0 divergences (the instrument does not cry wolf)
 *   QUOTIENT        a scale-BLIND compare must FAIL at t=0, and the quotient compare
 *                   must SUCCEED at t=0 — proves the normaliser is load-bearing in
 *                   both directions
 *   POKE-NEW        1 NEW unit (= 1/k old HP) subtracted on a chosen tick must be
 *                   caught ON THAT TICK. This is the smallest difference the new
 *                   number system can express; a comparator that cannot see it is
 *                   measuring the OLD resolution while reporting on the new one.
 *   POKE-OLD        1 OLD unit (= k new HP) likewise
 *   NORMALISER      an allow-list with `hp` REMOVED must go red on a real rescale
 *                   (the "pointed at the wrong field" arm)
 *
 * And the plant-side known-bads, driven from the command line against a sabotaged
 * worktree (`sda_scale --sabotage <name>`), which is where the fog result above comes
 * from.
 *
 * ── RESOLUTION FLOOR: THERE ISN'T ONE, AND THAT IS DELIBERATE ─────────────
 *
 * This comparison is **EXACT**. The sim is deterministic and seeded and both arms are
 * stepped in lockstep on the same inputs, so the quantity is a count of exact
 * mismatches, not a sample mean. The ~9 pp aggregate win-rate floor is for BEHAVIOURAL
 * changes and quoting it here would hide a real difference inside a tolerance built
 * for a different question (`CLAUDE.md` rule 10: say what the statistic IS before
 * picking its scale). One differing field is a result.
 *
 * Usage:
 *   node tools/tmp/hp_bitid6.mjs --ref <base>/src/game --sim <cand>/src/game --k 25
 *   node tools/tmp/hp_bitid6.mjs --ref … --sim … --k 25 --level 15
 *   node tools/tmp/hp_bitid6.mjs --selftest --ref … --sim … --k 25
 *
 * ⚠️ `--ref` and `--sim` MUST be real detached worktrees. `AGENT-BRIEF` §3 records a
 * pinning bug that read the working tree for both arms and returned byte-identical
 * numbers on every column, which reads exactly like "the change did nothing".
 */

import { resolve } from 'node:path';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

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
const LEVEL = args.level === undefined ? null : Number(args.level);
const SELFTEST = !!args.selftest;
const DT = Number(args.dt ?? 16.667);
const N_SEATS = Number(args.seats ?? 6);
const MAX_ROSTERS = args.rosters === undefined ? Infinity : Number(args.rosters);

if (!Number.isFinite(K) || K <= 0) { console.error('hp_bitid6: --k must be positive'); process.exit(1); }

// ─────────────────────────────────────────────────────────────────────────────
// THE NORMALISER — a NAMED ALLOW-LIST. Default is compare-exactly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keys whose values are denominated in hit points. Everything not named here is
 * compared byte-for-byte. `--drop-key <k>` removes one, which is the "pointed at the
 * wrong field" known-bad.
 */
const HP_KEYS_DEFAULT = ['hp', 'maxHp', 'damage', 'amount'];
const DROP = args['drop-key'] ? String(args['drop-key']) : null;
/** Mutable so `--selftest` can knock a key out and require the comparison to go RED. */
let HP_KEYS = HP_KEYS_DEFAULT.filter((k) => k !== DROP);

/**
 * `amount` and `damage` are only HP-denominated in the right CONTEXT — `amount` on a
 * `hit-landed`/`heal` event and `damage` on a `Projectile`. Normalising a stray
 * `damage` that happens to be a 0..10 card stat would forgive a real difference, so
 * the walk is context-aware: it only divides inside objects that look like the thing.
 */
let normalisedFields = 0;
let scaledHazards = 0;

function normalise(node, ctx) {
  if (Array.isArray(node)) return node.map((v) => normalise(v, ctx));
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  const isEvent = typeof node.type === 'string';
  const isHpEvent = isEvent && (node.type === 'hit-landed' || node.type === 'heal');
  for (const [key, v] of Object.entries(node)) {
    let scaled = false;
    if (typeof v === 'number' && HP_KEYS.includes(key)) {
      if (key === 'hp' || key === 'maxHp') scaled = true;
      else if (key === 'amount') scaled = isHpEvent;
      else if (key === 'damage') scaled = ctx === 'projectile';
    }
    if (scaled) { out[key] = v / K; normalisedFields++; }
    else out[key] = normalise(v, key === 'projectiles' ? 'projectile' : ctx);
  }
  return out;
}

/**
 * A comparable, stable serialisation of one tick of one arm.
 *
 * 🚨 **THE ASYMMETRY IS THE INSTRUMENT AND I GOT IT WRONG FIRST.** The first version
 * of this function normalised WHATEVER IT WAS HANDED, so the reference arm was divided
 * by k as well and every tick read `hp/25` vs `hp` — a divergence at t=0 on every
 * roster, for a change that had moved nothing. The selftest's *"the quotient compare
 * does NOT diverge at t=0"* arm is the only reason that was caught in minutes rather
 * than being reported as a real finding: the two poke arms failed with it, and three
 * arms failing together is a broken instrument, not three bugs. **Only the CANDIDATE
 * is normalised.** Kept with the reason, per house style.
 */
function snap(state, events, { scaled = false } = {}) {
  const raw = {
    phase: state.phase,
    elapsed: state.elapsed,
    safeRadius: state.safeRadius,
    fighters: state.fighters.map((f) => ({ ...f })),
    projectiles: state.projectiles.map((p) => ({ ...p })),
    events: events.map((e) => ({ ...e })),
  };
  return JSON.stringify(scaled ? normalise(raw, 'root') : raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD BOTH ARMS
// ─────────────────────────────────────────────────────────────────────────────

const A = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`) };
const B = { ...(await import(`${SIM_DIR}/sim.ts`)), RULES: await import(`${SIM_DIR}/rules.ts`) };

const { CHARACTER_IDS, MATCH_DURATION_MS } = A.RULES;

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
if (!existsSync(ARENA_PATH)) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
const ARENA_DATA = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
const FOG_FIRST_CONTACT_MS = 6000;
const arena = {
  ...ARENA_DATA,
  maxSafeRadius: Math.round(
    Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
  ),
  build: () => null,
  update: () => {},
};

/**
 * 🚨 THE ARENA IS THE SECOND PLACE HP LIVES, AND IT IS NOT IN `rules.ts`.
 *
 * `tools/arena.gameplay.json` — read by 30+ Node instruments — HARDCODES the central
 * hazard's `damage: 8`. The SHIPPED game does not: `src/arena/kitchen.ts:863` builds
 * that hazard as `{ …, kind: 'damage', damage: POT.damage, tickMs: POT.tickMs }`,
 * derived from `rules.ts`. **Verified by reading both, not taken from a doc.** So the
 * two agree today by coincidence, and a `rules.ts`-only rescale leaves every OFFLINE
 * balance tool running the pot at 1/k strength while the game runs it at full.
 *
 * That is a stale-but-LEGAL number: 8 is a valid hazard damage, it type-checks, it is
 * on the map, and nothing in the battery compares it to its source.
 *
 * ⚠️ **AND IT IS INVISIBLE AT TWO SEATS.** This tool's first six-seat run diverged on
 * roster 5 at tick 853 with `hotdog.hp base=92 scaled=2492` and a `hit-landed` whose
 * `source.kind` is `'hazard'` and whose `amount` is **8 on BOTH arms** — the pot, at
 * 1/25 strength on the candidate. `sda_bitid`'s two-seat sweep of the same trees is
 * 0/440 clean, because at two seats nobody stands in the middle of a 2800x2000 map.
 *
 * `--arena-b <file>` supplies the candidate arm's arena so the two halves of the
 * rescale can be measured apart; `--scale-arena` derives it in memory instead, which
 * is what you want when the only HP-denominated field is the hazard damage.
 */
const ARENA_B_PATH = args['arena-b'] ? String(args['arena-b']) : null;
const SCALE_ARENA = !!args['scale-arena'];
const arenaB = (() => {
  if (!ARENA_B_PATH && !SCALE_ARENA) return arena;
  const d = ARENA_B_PATH ? JSON.parse(readFileSync(ARENA_B_PATH, 'utf8')) : JSON.parse(JSON.stringify(ARENA_DATA));
  if (SCALE_ARENA) {
    let n = 0;
    for (const h of d.hazards ?? []) if (h.kind === 'damage' && typeof h.damage === 'number') { h.damage *= K; n++; }
    // NON-VACUITY: scaling nothing and reporting "scaled" is the whole failure class.
    if (n === 0) { console.error('hp_bitid6: --scale-arena found NO damage hazards to scale'); process.exit(1); }
    scaledHazards = n;
  }
  return {
    ...d,
    maxSafeRadius: Math.round(Math.hypot(d.width / 2, d.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
    build: () => null,
    update: () => {},
  };
})();

const SPAWNS = ARENA_DATA.spawns;
if (!Array.isArray(SPAWNS) || SPAWNS.length < N_SEATS) {
  console.error(`hp_bitid6: arena has ${SPAWNS?.length ?? 0} spawns, need ${N_SEATS}`);
  process.exit(1);
}

const MAX_TICKS = Math.ceil((MATCH_DURATION_MS * 1.6 + 20000) / DT);
const NIL = Array.from({ length: N_SEATS }, () => null);

/**
 * The roster set. `CHARACTER_IDS.length` rotating windows of `N_SEATS`, so every
 * character appears in every seat index across the set — seat order is exactly the
 * axis two-seat testing cannot reach. Deterministic; no RNG, no seeds to drift.
 */
function rosters() {
  const ids = CHARACTER_IDS;
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    out.push(Array.from({ length: N_SEATS }, (_, j) => ids[(i + j) % ids.length]));
  }
  return out.slice(0, MAX_ROSTERS);
}

function seatsFor(roster) {
  return roster.map((characterId, i) => ({
    characterId,
    controller: 'ai',
    spawn: SPAWNS[i],
    ...(LEVEL === null ? {} : { level: LEVEL }),
  }));
}

/**
 * Step one six-seat match through both arms in lockstep. Returns the first divergent
 * tick, plus the census the non-vacuity guards need.
 *
 * Lockstep rather than run-then-compare: a divergence at tick 400 of a 9,000-tick
 * match would otherwise be reported as "the whole match differs", which says nothing
 * about what caused it.
 */
function lockstep(roster, { pokeTick = null, pokeUnits = 'new', blind = false } = {}) {
  const sa = A.createMatch(arena, seatsFor(roster));
  const sb = B.createMatch(arenaB, seatsFor(roster));
  const census = {
    seatsA: sa.fighters.length,
    seatsB: sb.fighters.length,
    ticks: 0,
    hpEvents: 0,
    deaths: 0,
    projectiles: 0,
    winnerA: null,
    winnerB: null,
    deathOrderA: [],
    deathOrderB: [],
  };
  let first = null;
  const aliveA = new Set(sa.fighters.filter((f) => f.alive).map((f) => f.id));

  for (let t = 0; t < MAX_TICKS; t++) {
    const ea = A.stepMatch(sa, DT, NIL);
    const eb = B.stepMatch(sb, DT, NIL);
    census.ticks = t + 1;

    // ── the poke: subtract the smallest expressible amount from one live fighter on
    //    the candidate arm only. This is the known-bad, and it is scale-dependent by
    //    design — 1 NEW unit gets k times harder to see as k grows, which is the
    //    correct direction for a comparator that claims to measure the new resolution.
    if (pokeTick !== null && t === pokeTick) {
      const victim = sb.fighters.find((f) => f.alive && f.hp > 1);
      if (victim) victim.hp -= pokeUnits === 'new' ? 1 : K;
    }

    for (const e of ea) {
      if (e.type === 'hit-landed' || e.type === 'heal') census.hpEvents++;
      if (e.type === 'fighter-died' || e.type === 'death') census.deaths++;
    }
    census.projectiles += sa.projectiles.length;
    for (const f of sa.fighters) {
      if (aliveA.has(f.id) && (!f.alive || f.hp <= 0)) { aliveA.delete(f.id); census.deathOrderA.push(f.id); }
    }
    for (const f of sb.fighters) {
      if (!census.deathOrderB.includes(f.id) && (!f.alive || f.hp <= 0)) census.deathOrderB.push(f.id);
    }

    if (first === null) {
      // Reference: ALWAYS raw. Candidate: quotient-normalised, unless `blind`, which is
      // the arm that proves the normaliser is load-bearing.
      const da = snap(sa, ea, { scaled: false });
      const db = snap(sb, eb, { scaled: !blind });
      if (da !== db) first = t;
    }
    if (sa.phase === 'ended' && sb.phase === 'ended') break;
  }
  census.winnerA = sa.fighters.filter((f) => f.alive).map((f) => f.id).sort().join(',');
  census.winnerB = sb.fighters.filter((f) => f.alive).map((f) => f.id).sort().join(',');
  return { first, census };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST — validates the LOGIC. It does NOT validate where the tool is POINTED.
// ─────────────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
  else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
};

if (SELFTEST) {
  console.log(`\n══ hp_bitid6 SELFTEST ══  k=${K}  seats=${N_SEATS}`);
  console.log(`   ref ${REF_DIR}\n   sim ${SIM_DIR}\n`);

  const probe = rosters()[0];
  const base = lockstep(probe);

  // ── NON-VACUITY FIRST. Everything below filters.
  ok('NON-VACUOUS: six seats were actually seated', base.census.seatsA === N_SEATS && base.census.seatsB === N_SEATS,
    `ref ${base.census.seatsA} · sim ${base.census.seatsB}`);
  ok('NON-VACUOUS: the probe match ran > 200 ticks', base.census.ticks > 200, `${base.census.ticks} ticks`);
  ok('NON-VACUOUS: the probe match landed HP events', base.census.hpEvents > 0, `${base.census.hpEvents} hit/heal`);
  ok('NON-VACUOUS: fighters actually DIED', base.census.deathOrderA.length > 0,
    `${base.census.deathOrderA.length} deaths`);
  ok('NON-VACUOUS: projectiles existed', base.census.projectiles > 0, `${base.census.projectiles} projectile-ticks`);
  ok('NON-VACUOUS: k is actually in play', K !== 1, `k=${K}`);
  ok('NON-VACUOUS: the normaliser actually FIRED', normalisedFields > 0, `${normalisedFields} fields divided by k`);

  // ── QUOTIENT IS LOAD-BEARING, in both directions.
  const blind = lockstep(probe, { blind: true });
  ok('KNOWN-BAD: a scale-BLIND compare diverges at t=0', blind.first === 0, `first=${blind.first}`);
  ok('…and the quotient compare does NOT diverge at t=0', base.first === null || base.first > 0,
    `first=${base.first}`);

  // ── THE POKES. The set must be non-empty before it is asserted over.
  for (const units of ['new', 'old']) {
    const poked = lockstep(probe, { pokeTick: 300, pokeUnits: units });
    ok(`KNOWN-BAD: a 1-${units.toUpperCase()}-UNIT poke on tick 300 is caught on that tick`,
      poked.first === 300, `caught at ${poked.first}`);
  }

  // ── NORMALISER POINTED AT THE WRONG FIELD. `--selftest` validates a tool's LOGIC and
  //    never validates where it is POINTED, so the pointing is asserted here explicitly:
  //    knock ONE key out of the allow-list and the comparison must go red on a tree that
  //    really is rescaled. An allow-list that has silently stopped matching (a rename, a
  //    refactor) would otherwise read as a clean pass.
  for (const key of ['hp', 'maxHp', 'amount']) {
    const saved = HP_KEYS;
    HP_KEYS = HP_KEYS_DEFAULT.filter((k) => k !== key);
    const dropped = lockstep(probe);
    HP_KEYS = saved;
    ok(`KNOWN-BAD: dropping "${key}" from the normaliser turns the comparison RED`,
      dropped.first !== null, `first=${dropped.first}`);
  }

  // ── SELF-PAIR: the reference tree against itself must never diverge.
  const selfA = { ...(await import(`${REF_DIR}/sim.ts`)), RULES: await import(`${REF_DIR}/rules.ts`) };
  const s1 = selfA.createMatch(arena, seatsFor(probe));
  const s2 = selfA.createMatch(arena, seatsFor(probe));
  let selfDiff = null;
  for (let t = 0; t < 1200; t++) {
    const e1 = selfA.stepMatch(s1, DT, NIL);
    const e2 = selfA.stepMatch(s2, DT, NIL);
    if (JSON.stringify([e1, s1.fighters]) !== JSON.stringify([e2, s2.fighters])) { selfDiff = t; break; }
  }
  ok('SELF-PAIR: the reference tree against itself never diverges', selfDiff === null, `first=${selfDiff}`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// --why <rosterIndex> — LOCALISE. `first` says WHERE the arms part; this says WHAT.
// "diverged at tick 853" is a symptom; a named field with both raw values is a cause.
// ─────────────────────────────────────────────────────────────────────────────

if (args.why !== undefined) {
  const idx = Number(args.why);
  const roster = rosters()[idx];
  if (!roster) { console.error(`hp_bitid6: --why ${idx} is out of range (0..${rosters().length - 1})`); process.exit(1); }
  const sa = A.createMatch(arena, seatsFor(roster));
  const sb = B.createMatch(arenaB, seatsFor(roster));
  console.log(`\n══ HP_BITID6 --why ══  roster ${idx}: ${roster.join('>')}  k=${K}  level ${LEVEL ?? 'default(1)'}\n`);
  for (let t = 0; t < MAX_TICKS; t++) {
    const ea = A.stepMatch(sa, DT, NIL);
    const eb = B.stepMatch(sb, DT, NIL);
    const rows = [];
    for (let i = 0; i < Math.max(sa.fighters.length, sb.fighters.length); i++) {
      const fa = sa.fighters[i], fb = sb.fighters[i];
      if (!fa || !fb) { rows.push(`fighters[${i}] present on only one arm`); continue; }
      for (const key of Object.keys(fa)) {
        const av = fa[key], bv = fb[key];
        if (typeof av === 'number') {
          const scaled = (key === 'hp' || key === 'maxHp');
          const cmp = scaled ? bv / K : bv;
          if (cmp !== av) {
            rows.push(`fighters[${i}] ${fa.characterId}.${key}  base=${av}  scaled=${bv}${scaled ? `  quotient=${cmp}  residual=${(cmp - av).toPrecision(6)}` : '  (NON-HP — must be byte-equal)'}`);
          }
        } else if (JSON.stringify(av) !== JSON.stringify(bv)) {
          rows.push(`fighters[${i}] ${fa.characterId}.${key}  base=${JSON.stringify(av)}  scaled=${JSON.stringify(bv)}  (NON-HP)`);
        }
      }
    }
    if (sa.projectiles.length !== sb.projectiles.length) rows.push(`projectile COUNT base=${sa.projectiles.length} scaled=${sb.projectiles.length}`);
    const evA = JSON.stringify(ea);
    const evB = snap({ phase: sb.phase, elapsed: sb.elapsed, safeRadius: sb.safeRadius, fighters: [], projectiles: [] }, eb, { scaled: true });
    const evAn = snap({ phase: sa.phase, elapsed: sa.elapsed, safeRadius: sa.safeRadius, fighters: [], projectiles: [] }, ea, { scaled: false });
    if (evAn !== evB) rows.push(`EVENTS/phase/clock\n     base   = ${evAn}\n     scaled = ${evB}`);
    if (rows.length) {
      console.log(`── FIRST DIVERGENCE  tick ${t}  elapsed ${sa.elapsed.toFixed(0)}ms  phase ${sa.phase} ──`);
      for (const r of rows) console.log(`   ${r}`);
      console.log(`   raw events base : ${evA.slice(0, 400)}`);
      process.exit(0);
    }
    if (sa.phase === 'ended' && sb.phase === 'ended') break;
  }
  console.log(`   no divergence in ${sa.elapsed.toFixed(0)}ms\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RUN
// ─────────────────────────────────────────────────────────────────────────────

const t0 = Date.now();
const R = rosters();
const rows = [];
let ticks = 0, hpEvents = 0, deaths = 0, seatFault = 0, winnerDiff = 0, deathOrderDiff = 0;

for (const roster of R) {
  const { first, census } = lockstep(roster);
  ticks += census.ticks;
  hpEvents += census.hpEvents;
  deaths += census.deathOrderA.length;
  if (census.seatsA !== N_SEATS || census.seatsB !== N_SEATS) seatFault++;
  if (census.winnerA !== census.winnerB) winnerDiff++;
  if (census.deathOrderA.join(',') !== census.deathOrderB.join(',')) deathOrderDiff++;
  if (first !== null) rows.push({ roster: roster.join('>'), first });
}

console.log(`\n══ HP_BITID6 ══  k=${K} · seats=${N_SEATS} · level ${LEVEL ?? 'default(1)'} · ${R.length} six-seat matches · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`   ref ${REF_DIR}`);
console.log(`   sim ${SIM_DIR}`);
console.log(`   arena ${ARENA_PATH}\n`);

// NON-VACUITY, printed as assertions rather than left to be discovered.
ok('NON-VACUOUS: every match seated six', seatFault === 0, `${R.length - seatFault}/${R.length} matches at ${N_SEATS} seats`);
ok('NON-VACUOUS: the matches ran', ticks > 200 * R.length, `${ticks.toLocaleString()} ticks`);
ok('NON-VACUOUS: HP-bearing events happened', hpEvents > 0, `${hpEvents.toLocaleString()} hit/heal`);
ok('NON-VACUOUS: fighters died', deaths > 0, `${deaths} deaths`);
ok('NON-VACUOUS: the normaliser fired', normalisedFields > 0, `${normalisedFields.toLocaleString()} fields divided by k`);

console.log(`\n   STRICT (quotient bit-identical)   ${rows.length}/${R.length}`);
console.log(`   survivor set differed             ${winnerDiff}/${R.length}`);
console.log(`   DEATH ORDER differed              ${deathOrderDiff}/${R.length}`);
if (rows.length) {
  const firsts = rows.map((r) => r.first).sort((a, b) => a - b);
  console.log(`   first divergence tick: min ${firsts[0]} · median ${firsts[firsts.length >> 1]} · max ${firsts[firsts.length - 1]}`);
  for (const r of rows.slice(0, 12)) console.log(`     ${r.roster} @${r.first}`);
}

const clean = rows.length === 0 && winnerDiff === 0 && deathOrderDiff === 0 && seatFault === 0;
console.log(`\n   >> ${clean
  ? 'EXACT UNIT RESCALE AT SIX SEATS: every quantity is exactly k x the baseline and nothing else moved.'
  : 'THE GAME MOVED AT SIX SEATS. This is not a pure unit change.'}\n`);
process.exit(fail === 0 && clean ? 0 : 1);
