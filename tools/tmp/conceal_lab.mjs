#!/usr/bin/env node
/**
 * CONCEAL LAB — the acceptance test for walk-through concealment, in three parts with
 * three different floors.
 *
 * ── PART 1: BIT-IDENTITY. Floor: EXACT, 0 differing ticks. ──────────────────
 *
 * `--bitid` runs 110 matchups x N seeds through the shared scripted driver against TWO
 * sims at once — the working tree and a `git`-extracted `--sim-ref` (default HEAD~1) — and
 * compares the ENTIRE match state after every single tick. Not a summary, not a win rate:
 * every field of both fighters, every projectile, every splat, every trail mark, the ring,
 * the clock, the id counter.
 *
 * This is the only thing that lets a LATER balance delta be attributed to concealment
 * rather than to the plumbing that carries it. It is the same proof `LEVEL_MIN` used
 * ("level 1 is bit-identical to the pre-levels build, proven tick-for-tick"), and it is
 * why the mechanism was built inert first and the regions second. `docs/LESSONS.md` §5's
 * `roster_table` trap is the failure mode it forecloses: an aggregate that moves 0.8 pp —
 * inside its own ~9 pp floor — while 58 of 110 individual matchups move by up to 34.4 pp.
 * If the mechanism is bit-identical when empty, there is nothing to hide.
 *
 * ── PART 2: WALK-THROUGH IS PROVEN, NOT ASSERTED. Floor: EXACT. ─────────────
 *
 * `src/game/sim.test.mjs` §26 owns this half: a fighter is walked across the centre of
 * every concealment box and `tryMove` must return true on every step, the nav grid's
 * passable-cell count must be unchanged with regions present, and the endgame keepout
 * guard must FAIL on a hub-placed box. It lives in the unit suite because it needs no
 * arena cache and must run on every commit.
 *
 * ── PART 3: IS ANYONE EVER IN ONE? Floor: paired, exact. ────────────────────
 *
 * `--occupancy` is the test that decides whether this is a MECHANIC or the second
 * `REGEN_DELAY_MS` — a whole feature, and the sound written for it, firing 0.02 times per
 * match because the delay is 10 s against a 16.2 s mean play length. It injects a
 * candidate region set (this tool's, NOT the arena's — the arena owns its own geometry)
 * and reports:
 *
 *   AREA SHARE     the regions' share of STANDABLE plan area. The null hypothesis.
 *   OCCUPANCY      the share of playing ticks with a fighter inside one.
 *   LIFT           occupancy - area share. Zero means decoration: fighters enter the
 *                  regions exactly as often as they would enter an equal area of paint.
 *   STALE SHARE    the share of playing ticks on which the AI is acting on a belief it
 *                  can no longer see. This is the OUTCOME question rather than the symptom
 *                  one (`docs/LESSONS.md` §13: "AI stalled 0.0%" was true for months while
 *                  the AI was permanently deadlocked). If it is zero, nothing happened.
 *
 * ── VALIDATION ──────────────────────────────────────────────────────────────
 *
 * `--selftest` is a KNOWN-BAD battery, because a bit-identity checker that always prints
 * IDENTICAL is worth less than nothing. It perturbs the state by one field at a time —
 * every mutable field the sim owns, enumerated from a real match rather than from a list
 * someone typed — and requires the differ to catch each one. A field the differ cannot see
 * is a field a divergence could hide in.
 *
 *   node tools/tmp/conceal_lab.mjs --selftest
 *   node tools/tmp/conceal_lab.mjs --bitid --seeds 32
 *   node tools/tmp/conceal_lab.mjs --bitid --seeds 32 --sim-ref <sha> --policies smart2,chase
 *   node tools/tmp/conceal_lab.mjs --occupancy --seeds 8
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

// ─────────────────────────────────────────────────────────────────────────────
// Two sims, side by side
//
// Lifted from `tools/match-sim.mjs:extractSimAt` deliberately — `git stash` is forbidden
// here and a checkout would clobber five peers, so extraction into the OS temp dir is the
// only safe freeze. Writing OUTSIDE the repo is also deliberate: a scratch tree of `.ts`
// under `tools/` is inside `tsconfig.json`'s include and turns `npx tsc --noEmit` red for
// everyone at once.
// ─────────────────────────────────────────────────────────────────────────────

function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `fa-conceal-simref-${sha}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'game'), { recursive: true });
  mkdirSync(join(dir, 'arena'), { recursive: true });
  for (const f of ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']) {
    writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
  }
  writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  return { dir: join(dir, 'game'), sha };
}

async function loadSim(dir) {
  const sim = await import(`${dir}/sim.ts`);
  const rules = await import(`${dir}/rules.ts`);
  const ai = await import(`${dir}/ai.ts`);
  return { createMatch: sim.createMatch, stepMatch: sim.stepMatch, RULES: rules, pressValue: ai.pressValue, dir };
}

const LIVE = await loadSim(`${ROOT}/src/game`);
const { CHARACTER_IDS, MATCH_DURATION_MS, REACH, HIT_RADIUS_VS_PLAYER, HIT_RADIUS_VS_ENEMY } = LIVE.RULES;

// ─────────────────────────────────────────────────────────────────────────────
// Arena
// ─────────────────────────────────────────────────────────────────────────────

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;

/** `arena.maxSafeRadius` is DERIVED from MATCH_DURATION_MS in `arena/shared.ts`, so a
 *  cached dump goes stale the moment the clock moves. Recompute from the same formula —
 *  identical to `roster_lab.mjs`, so a row here is the same match as a row there. */
const FOG_FIRST_CONTACT_MS = 6000;
function withDerivedRing(data) {
  const halfDiag = Math.hypot(data.width / 2, data.height / 2);
  return {
    ...data,
    maxSafeRadius: Math.round(halfDiag / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS)),
    build: () => null,
    update: () => {},
  };
}
const BASE_ARENA = ARENA_DATA ? withDerivedRing(ARENA_DATA) : null;

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 32);
const POLICIES = String(args.policies ?? 'smart2').split(',');

// ─────────────────────────────────────────────────────────────────────────────
// THE DIFFER
//
// A GENERIC deep walk rather than a hand-written field list, and that choice is the whole
// reason `--selftest` can prove coverage. A hand-written list is exactly as complete as
// the person who wrote it remembered to be, and the field it forgets is the field a
// divergence hides in — this repo has caught nineteen instruments returning confident
// wrong answers, several of them by omission. A deep walk covers a field the moment the
// sim gains one, and the selftest enumerates the fields FROM A REAL MATCH and perturbs
// every single one.
//
// `arena` is excluded because both sims are handed the SAME arena object and neither
// mutates it; functions are excluded because `build`/`update` are not state.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * First difference between `a` (the LIVE state) and `b` (the BASELINE state), or null.
 *
 * ── WHAT BIT-IDENTITY MEANS WHEN THE STATE GAINS A FIELD ────────────────────
 *
 * The first full run of this tool reported 3520 of 3520 matches divergent, at tick 1, on
 * `state.player.concealed: present in only one state` — and it was RIGHT to. A published
 * observation is a new field, so a naive set-union walk calls every match divergent
 * forever and the test can never pass, which would have made it worthless exactly when it
 * mattered.
 *
 * So the claim is stated precisely: **every field that existed in the baseline holds the
 * same value at every tick, no baseline field disappears, and any field the live state
 * adds is DECLARED.** Additions are collected into `added` and printed; a field present in
 * the BASELINE and missing from the LIVE state is a removal and is a hard failure, because
 * "tolerate a missing key" is otherwise a hole big enough to hide a deleted field in.
 *
 * Pass `added = null` for STRICT mode, where an addition is itself a difference. The
 * selftest runs both modes against known-bad inputs, because a differ with a tolerance in
 * it has to be shown to still fail on the thing the tolerance does not cover.
 */
function firstDiff(a, b, path, added) {
  if (a === b) return null;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return `${path}: type ${ta} vs ${tb}`;
  if (ta === 'number') {
    // NaN !== NaN, and two NaNs are the same state. Everything else is exact: no epsilon
    // anywhere in this file, because the claim is bit-identity and not similarity.
    if (Number.isNaN(a) && Number.isNaN(b)) return null;
    return `${path}: ${a} !== ${b}`;
  }
  if (ta !== 'object' || a === null || b === null) return `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`, added);
      if (d) return d;
    }
    return null;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (typeof a[k] === 'function' || typeof b[k] === 'function') continue;
    const inA = k in a;
    const inB = k in b;
    if (inA && !inB) {
      if (!added) return `${path}.${k}: present in the LIVE state only`;
      // Index paths collapse to `[i]` so 400 projectiles do not become 400 entries.
      added.add(`${path}.${k}`.replace(/\[\d+\]/g, '[i]'));
      continue;
    }
    if (!inA && inB) return `${path}.${k}: REMOVED from the live state — a baseline field vanished`;
    const d = firstDiff(a[k], b[k], `${path}.${k}`, added);
    if (d) return d;
  }
  return null;
}

/** The comparable half of a MatchState: everything except the shared arena object. */
function comparable(state) {
  const { arena: _arena, ...rest } = state;
  return rest;
}

/** Every leaf path in the comparable state, so `--selftest` can perturb each one. */
function leafPaths(v, path, out) {
  if (v === null || typeof v !== 'object') { out.push(path); return out; }
  if (Array.isArray(v)) { v.forEach((e, i) => leafPaths(e, `${path}[${i}]`, out)); return out; }
  for (const k of Object.keys(v)) {
    if (typeof v[k] === 'function') continue;
    leafPaths(v[k], `${path}.${k}`, out);
  }
  return out;
}

function getPath(root, path) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)
    .reduce((o, k) => (o === undefined || o === null ? o : o[k]), root);
}
function setPath(root, path, value) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  const last = parts.pop();
  const owner = parts.reduce((o, k) => o[k], root);
  owner[last] = value;
}

// ─────────────────────────────────────────────────────────────────────────────
// The driver — imported, never copied (`driver_guard.mjs` fails on a private copy).
// ─────────────────────────────────────────────────────────────────────────────

const DRIVER_FLAGS = parseDriverFlags(args);
const driverFor = (arena, sim) => createScriptedPlayer({
  CHARACTERS: sim.RULES.CHARACTERS,
  REACH: sim.RULES.REACH,
  arena,
  pressValue: sim.pressValue,
  selfHealHpFraction: sim.RULES.AI_SELF_HEAL_HP_FRACTION,
  ...DRIVER_FLAGS,
});

/**
 * ONE DRIVER, TWO SIMS, ONE INPUT OBJECT PER TICK.
 *
 * The alternative — two driver instances, one per sim, each with its own seeded rng — also
 * works while the states agree, but it puts the DRIVER inside the thing being tested. The
 * claim is about `src/game/**`, so the driver is held outside it: decisions are computed
 * from sim A's state and the identical `MatchInput` is handed to both. The first tick on
 * which the two states disagree is therefore attributable to the sim and to nothing else,
 * which is the only reason to run this at all.
 */
function lockstepMatch(arena, simA, simB, driver, playerId, enemyId, policy, seed, added) {
  // Seed formula is `pacing_ladder.mjs`'s / `roster_lab.mjs`'s, unchanged — that is what
  // makes a row here the SAME match as a row there.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const stateA = simA.createMatch(arena, playerId, enemyId);
  const stateB = simB.createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  while (stateA.phase !== 'ended' && stateA.elapsed < HARD_CAP) {
    const input = loop.next(stateA, DT);
    simA.stepMatch(stateA, DT, input);
    simB.stepMatch(stateB, DT, input);
    tick++;
    const d = firstDiff(comparable(stateA), comparable(stateB), 'state', added);
    if (d) return { tick, diff: d, elapsed: stateA.elapsed };
  }
  // The B match must also have ENDED — a B that is still playing when A stops is a
  // divergence the per-tick walk would have caught, but asserting it costs nothing and
  // rules out a differ that silently compares nothing.
  const d = firstDiff(comparable(stateA), comparable(stateB), 'state', added);
  if (d) return { tick, diff: d, elapsed: stateA.elapsed };
  return { tick, diff: null, elapsed: stateA.elapsed };
}

const MATCHUPS = (() => {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
})();

// ─────────────────────────────────────────────────────────────────────────────
// --selftest : the differ must FAIL on every field the sim owns
// ─────────────────────────────────────────────────────────────────────────────

if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ conceal_lab SELFTEST ══  driver rev ${DRIVER_REV}`);

  const CLEAR = {
    id: 'selftest', displayName: 'selftest', width: 1400, height: 1000,
    center: { x: 700, y: 500 }, maxSafeRadius: 5000,
    playerSpawn: { x: 200, y: 500 }, enemySpawn: { x: 1000, y: 500 },
    cover: [], hazards: [], build: () => null, update: () => {},
  };
  const driver = driverFor(CLEAR, LIVE);

  // ── A. The differ agrees with itself, and disagrees when it must ───────────
  {
    const r = lockstepMatch(CLEAR, LIVE, LIVE, driver, 'pizza', 'soup', 'smart2', 0);
    ok('a sim against ITSELF is bit-identical (the differ is not stuck on FAIL)',
      r.diff === null, `${r.tick} ticks`);
    ok('…and the match actually ran, so the comparison is not vacuous',
      r.tick > 100, `${r.tick} ticks`);
  }

  // ── B. KNOWN-BAD: every leaf field the sim owns, perturbed one at a time ───
  //
  // The state is enumerated from a REAL match rather than from a list, so a field the sim
  // gains tomorrow is covered tomorrow. Booleans flip, numbers move by a value chosen to
  // be representable exactly (1) and by the smallest possible step (1 ULP), strings get a
  // suffix. Every one must be caught. 1 ULP matters: a differ that rounds, or that
  // stringifies through `toFixed`, passes the coarse test and hides real divergence.
  {
    const state = LIVE.createMatch(CLEAR, 'hamburger', 'donut');
    state.phase = 'playing';
    const d2 = LIVE.createMatch(CLEAR, 'hamburger', 'donut');
    d2.phase = 'playing';
    // Step both far enough to populate projectiles, splats and trail marks.
    const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS.smart2(rng(1)), reactBase: 150, reactJit: 0, rnd: rng(1) });
    for (let i = 0; i < 900; i++) {
      const input = loop.next(state, DT);
      LIVE.stepMatch(state, DT, input);
      LIVE.stepMatch(d2, DT, input);
    }
    const baseline = firstDiff(comparable(state), comparable(d2), 'state');
    ok('two identically-driven matches on the SAME sim stay identical for 900 ticks',
      baseline === null, baseline ?? '');

    // Paths are rooted at '' rather than at 'state', because `getPath`/`setPath` walk the
    // comparable object ITSELF — a 'state.' prefix would look up a key that does not exist
    // and every perturbation would silently become a no-op. That is precisely the shape of
    // failure this battery exists to catch, so the count is asserted, not just the misses.
    const paths = leafPaths(comparable(state), '', []);
    const missed = [];
    let perturbed = 0;
    for (const p of paths) {
      const before = getPath(comparable(state), p);
      if (typeof before === 'function') continue;
      const variants = [];
      if (typeof before === 'number') {
        variants.push(before + 1);
        // 1 ULP up — the smallest change a double can express.
        if (Number.isFinite(before) && before !== 0) {
          const buf = new Float64Array([before]);
          const bits = new BigInt64Array(buf.buffer);
          bits[0] += before > 0 ? 1n : -1n;
          variants.push(buf[0]);
        }
      } else if (typeof before === 'boolean') variants.push(!before);
      else if (typeof before === 'string') variants.push(`${before}!`);
      else if (before === null) variants.push(0);
      else continue;
      for (const v of variants) {
        if (v === before) continue;
        perturbed++;
        const mutated = comparable(state);
        setPath(mutated, p, v);
        const caught = firstDiff(mutated, comparable(d2), 'state');
        setPath(mutated, p, before);
        if (!caught) missed.push(`${p}=${before}->${v}`);
      }
    }
    ok('the differ catches EVERY single-field perturbation of a live match state',
      missed.length === 0 && perturbed > 40,
      `${perturbed} perturbations over ${paths.length} leaf fields, ${missed.length} missed${missed.length ? `: ${missed.slice(0, 4).join(', ')}` : ''}`);

    // The three fields this change introduced must be among them, by NAME — coverage by
    // deep walk is only worth something if the new fields are actually in the walk.
    const names = paths.join(' ');
    ok('…and the walk reaches the three fields concealment added',
      names.includes('player.concealed') && names.includes('enemy.concealed')
      && names.includes('aiSighting.x') && names.includes('aiSighting.at'),
      `aiSighting + concealed present in ${paths.length} leaves`);

    // Array LENGTH changes, not just element values: a projectile that exists in one sim
    // and not the other is the divergence most likely to matter and the one a naive
    // element-wise walk skips.
    {
      const mutated = comparable(state);
      const saved = mutated.trailMarks;
      mutated.trailMarks = [...saved, { id: -1, ownerRole: 'player', x: 0, y: 0, expiresAt: 0, damaged: false }];
      const caught = firstDiff(mutated, comparable(d2), 'state');
      mutated.trailMarks = saved;
      ok('the differ catches an EXTRA array element (length, not just values)', !!caught, caught ?? 'MISSED');
    }

    // ── The ADDITIVE tolerance, and the hole it must not open ───────────────
    //
    // `--bitid` compares a state that has gained fields against one that has not, so the
    // walk tolerates a key present only in the LIVE state. A tolerance is a hole until it
    // is shown to be exactly the size claimed, so all three cases are pinned here.
    {
      const live = comparable(state);
      const base = comparable(d2);
      const withExtra = { ...live, brandNewField: 7 };
      const addedSet = new Set();
      ok('ADDITIVE mode tolerates a field the live state has and the baseline does not',
        firstDiff(withExtra, base, 'state', addedSet) === null && addedSet.has('state.brandNewField'),
        `declared: [${[...addedSet].join(', ')}]`);
      ok('…but STRICT mode (added = null) still calls that a difference',
        firstDiff(withExtra, base, 'state', null) !== null);
      // The hole: "ignore a key that is missing on one side" would also hide a DELETION.
      const { winner: _gone, ...withMissing } = live;
      const rm = firstDiff(withMissing, base, 'state', new Set());
      ok('…and a field REMOVED from the live state is fatal in additive mode too',
        rm !== null && rm.includes('REMOVED'), rm ?? 'MISSED');
      // And a shared field with a different value is still caught while additions are on.
      const shifted = { ...live, elapsed: live.elapsed + 1 };
      ok('…and a SHARED field that differs is still caught while additions are tolerated',
        firstDiff(shifted, base, 'state', new Set()) !== null);
    }
  }

  // ── C. KNOWN-BAD: a genuinely different sim must be reported as different ──
  //
  // The strongest control available: run the live sim against a deliberately WRONG one —
  // the same modules with a single balance constant changed. If the harness cannot tell
  // these apart, `--bitid` printing IDENTICAL means nothing.
  {
    const dir = join(tmpdir(), 'fa-conceal-selftest-bad', 'game');
    rmSync(join(tmpdir(), 'fa-conceal-selftest-bad'), { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(tmpdir(), 'fa-conceal-selftest-bad', 'arena'), { recursive: true });
    for (const f of ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']) {
      writeFileSync(join(dir, f), readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
    }
    writeFileSync(join(tmpdir(), 'fa-conceal-selftest-bad', 'arena', 'types.ts'),
      readFileSync(`${ROOT}/src/arena/types.ts`, 'utf8'));
    // One character's speed stat, moved by the smallest step that can matter. Chosen over
    // a damage change because it perturbs POSITION, which is the quantity a "the AI walks
    // to the wrong place" bug would move — i.e. exactly what this harness must catch.
    const rules = readFileSync(join(dir, 'rules.ts'), 'utf8');
    const patched = rules.replace('export const AI_CHASE_SPEED = 0.07;', 'export const AI_CHASE_SPEED = 0.0700001;');
    ok('the known-bad sim was actually patched (a no-op patch would fake this control)',
      patched !== rules);
    writeFileSync(join(dir, 'rules.ts'), patched);
    const BAD = await loadSim(dir);
    const r = lockstepMatch(CLEAR, LIVE, BAD, driver, 'pizza', 'soup', 'smart2', 0);
    ok('a sim whose AI_CHASE_SPEED differs in the 7th digit is caught, and caught EARLY',
      r.diff !== null && r.tick < 800, `first divergence at tick ${r.tick}: ${r.diff}`);
  }

  // ── D. The concealment predicates answer known geometry ───────────────────
  {
    const { isConcealed, isVisibleFrom, concealmentOf, concealmentInsideRadius } =
      await import(`${ROOT}/src/game/movement.ts`);
    const { CONCEAL_REVEAL_RADIUS, concealmentKeepoutRadius } = LIVE.RULES;
    const withBox = { ...CLEAR, concealment: [{ x: 700, y: 500, w: 100, h: 100, kind: 'test' }] };

    ok('an arena with no `concealment` field reads as an empty list',
      concealmentOf(CLEAR).length === 0);
    ok('nothing is concealed in an arena with no regions',
      !isConcealed(700, 500, CLEAR));
    ok('the centre of a region conceals; 1 wu outside its edge does not',
      isConcealed(700, 500, withBox) && !isConcealed(751, 500, withBox)
      && isConcealed(749, 500, withBox));
    ok('an observer beyond CONCEAL_REVEAL_RADIUS cannot see a concealed target',
      !isVisibleFrom(700 + CONCEAL_REVEAL_RADIUS + 1, 500, 700, 500, withBox));
    ok('…and an observer inside it can — concealment is not invisibility',
      isVisibleFrom(700 + CONCEAL_REVEAL_RADIUS - 1, 500, 700, 500, withBox));
    ok('an UNconcealed target is visible from any distance (the rule is region membership)',
      isVisibleFrom(0, 0, 100, 100, withBox));
    // The keepout guard, shown to FAIL. Measured on the SHIPPED ring rather than on
    // `CLEAR`'s deliberately-absurd `maxSafeRadius: 5000` — the keepout is derived from
    // the ring, so a 5000 wu ring keeps out the whole map and the test would pass
    // vacuously in one direction and fail spuriously in the other.
    const RING = BASE_ARENA ? BASE_ARENA.maxSafeRadius : 993;
    const keepout = concealmentKeepoutRadius(RING);
    ok('the keepout is derived from the ring and lands where the endgame is fought',
      keepout > 200 && keepout < 400, `maxSafeRadius ${RING} -> keepout ${keepout.toFixed(2)} wu`);
    ok('the endgame keepout guard FAILS on a hub-placed region (a guard not shown to fail is not a guard)',
      concealmentInsideRadius(withBox, keepout).length === 1, `keepout ${keepout.toFixed(2)} wu`);
    const far = { ...CLEAR, concealment: [{ x: 100, y: 100, w: 60, h: 60 }] };
    ok('…and PASSES a region out on the lanes',
      concealmentInsideRadius(far, keepout).length === 0,
      `region is ${Math.hypot(100 - 700, 100 - 500).toFixed(0)} wu from centre`);
    // NEAREST POINT, not centre: a long band whose CENTRE is legal can still reach the hub.
    const band = { ...CLEAR, concealment: [{ x: 700 - keepout - 100, y: 500, w: 400, h: 60 }] };
    ok('…and catches a BAND whose centre is legal but whose near edge is not',
      concealmentInsideRadius(band, keepout).length === 1,
      `centre ${(keepout + 100).toFixed(0)} wu out, near edge ${(keepout - 100).toFixed(0)} wu out`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --bitid
// ─────────────────────────────────────────────────────────────────────────────

if (args.bitid) {
  if (!BASE_ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const ref = String(args['sim-ref'] ?? 'HEAD');
  const REF = extractSimAt(ref);
  const BASE = await loadSim(REF.dir);
  const driver = driverFor(BASE_ARENA, LIVE);

  console.log(`\n══ BIT-IDENTITY ══  working tree vs ${ref} (${REF.sha})`);
  console.log(`   ${MATCHUPS.length} matchups x ${SEEDS} seeds x ${POLICIES.length} polic${POLICIES.length === 1 ? 'y' : 'ies'}`
    + ` = ${MATCHUPS.length * SEEDS * POLICIES.length} matches, driver rev ${DRIVER_REV}, dt ${DT}`);
  console.log(`   arena ${BASE_ARENA.id} ${BASE_ARENA.width}x${BASE_ARENA.height}, `
    + `${BASE_ARENA.cover.length} cover, ${BASE_ARENA.hazards.length} hazards, `
    + `${(BASE_ARENA.concealment ?? []).length} concealment`);
  console.log('   FLOOR: EXACT. This is not a statistical test — one differing tick is a failure.\n');

  const t0 = Date.now();
  let matches = 0, ticks = 0;
  const failures = [];
  const added = new Set();
  for (const policy of POLICIES) {
    for (const [p, e] of MATCHUPS) {
      for (let s = 0; s < SEEDS; s++) {
        const r = lockstepMatch(BASE_ARENA, LIVE, BASE, driver, p, e, policy, s, added);
        matches++; ticks += r.tick;
        if (r.diff) failures.push(`${policy} ${p}>${e} seed ${s} @ tick ${r.tick} (${(r.elapsed / 1000).toFixed(2)}s): ${r.diff}`);
      }
      if (matches % 550 === 0) {
        process.stderr.write(`   ${matches} matches, ${(ticks / 1e6).toFixed(2)}M ticks, `
          + `${failures.length} divergent, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
      }
    }
  }

  console.log(`\n   matches      ${matches}`);
  console.log(`   ticks        ${ticks.toLocaleString()} compared field-by-field`);
  console.log(`   divergent    ${failures.length}`);
  console.log(`   wall         ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   ADDED FIELDS ${added.size} — present in the live state, absent at ${ref}. Declared, not ignored:`);
  for (const f of [...added].sort()) console.log(`                  ${f}`);
  if (failures.length) {
    console.log('\n   FIRST DIVERGENCES:');
    for (const f of failures.slice(0, 10)) console.log(`     ${f}`);
    console.log(`\n   BIT-IDENTITY: FAIL (${failures.length} of ${matches} matches diverged)`);
    process.exit(1);
  }
  console.log(`\n   BIT-IDENTITY: PASS — 0 differing ticks in ${ticks.toLocaleString()}`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --occupancy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A CANDIDATE region set, generated here rather than authored in the arena.
 *
 * It is deliberately NOT a design proposal — `src/arena/**` owns its own geometry and this
 * tool must not become a second source of truth for it. It exists to answer one question
 * before anybody draws anything: *if regions of roughly this size, count and placement
 * existed, would a fighter ever be inside one?* If the answer is "only as often as chance",
 * the arena agent should know that before spending a day on prop geometry.
 *
 * Shaped by the probe's two hard constraints: lane-aligned BANDS rather than scattered
 * singletons (the reference delivers its density at high spatial frequency — our top-2
 * cover kinds own 74.3% of all cover pixels), and nothing inside the endgame keepout.
 */
function candidateRegions(arena) {
  const { concealmentKeepoutRadius } = LIVE.RULES;
  const keepout = concealmentKeepoutRadius(arena.maxSafeRadius);
  const out = [];
  const W = arena.width, H = arena.height;
  const cx = arena.center.x, cy = arena.center.y;
  const overlapsCover = (x, y, w, h) =>
    arena.cover.some((o) => Math.abs(x - o.x) < (w + o.w) / 2 && Math.abs(y - o.y) < (h + o.h) / 2);
  // A coarse lattice of 80x80 patches, kept where they are clear of cover, outside the
  // keepout, and inside the walls. 80 wu is just under twice a fighter (42), so a patch
  // is a real hiding place and not a decal.
  const S = 80;
  for (let x = S; x < W - S / 2; x += S * 1.5) {
    for (let y = S; y < H - S / 2; y += S * 1.5) {
      if (Math.hypot(x - cx, y - cy) < keepout + S) continue;
      if (overlapsCover(x, y, S, S)) continue;
      out.push({ x, y, w: S, h: S, kind: 'candidate' });
    }
  }
  return out;
}

if (args.occupancy) {
  if (!BASE_ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const { isConcealed, concealmentKeepoutViolations } = await import(`${ROOT}/src/game/movement.ts`);

  const regions = candidateRegions(BASE_ARENA);
  const arenaC = { ...BASE_ARENA, concealment: regions };
  const violations = concealmentKeepoutViolations(arenaC);

  // AREA SHARE, over STANDABLE plan area — a fighter cannot be inside cover, so the
  // denominator must not include it. Sampled on a 5 wu lattice with the fighter's own
  // collision test, which is the same space `movement.ts:navGrid` calls passable.
  const SIZE = LIVE.RULES.PLAYER_SIZE;
  const half = SIZE / 2;
  let standable = 0, standableConcealed = 0;
  for (let x = 0; x <= BASE_ARENA.width; x += 5) {
    for (let y = 0; y <= BASE_ARENA.height; y += 5) {
      if (x < half || x > BASE_ARENA.width - half || y < half || y > BASE_ARENA.height - half) continue;
      if (BASE_ARENA.cover.some((o) => Math.abs(x - o.x) < (SIZE + o.w) / 2 && Math.abs(y - o.y) < (SIZE + o.h) / 2)) continue;
      standable++;
      if (isConcealed(x, y, arenaC)) standableConcealed++;
    }
  }
  const areaShare = standableConcealed / standable;

  const driver = driverFor(arenaC, LIVE);
  const rows = [];
  const t0 = Date.now();
  for (const policy of POLICIES) {
    for (const [p, e] of MATCHUPS) {
      for (let s = 0; s < SEEDS; s++) {
        const rnd = rng(s * 7919 + p.length * 131 + e.length * 17 + policy.length);
        const state = LIVE.createMatch(arenaC, p, e);
        const decide = driver.POLICY_FNS[policy](rnd);
        const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd });
        const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
        let playTicks = 0, eitherIn = 0, playerIn = 0, enemyIn = 0, stale = 0, blindTicks = 0;
        let winner = null;
        while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
          const evs = LIVE.stepMatch(state, DT, loop.next(state, DT));
          for (const ev of evs) if (ev.type === 'match-ended') winner = ev.winner;
          if (state.phase === 'playing') {
            playTicks++;
            const pin = state.player.concealed, ein = state.enemy.concealed;
            if (pin) playerIn++;
            if (ein) enemyIn++;
            if (pin || ein) eitherIn++;
            if (state.aiSighting.at !== state.elapsed) {
              stale++;
              if (state.elapsed - state.aiSighting.at > 500) blindTicks++;
            }
          }
        }
        rows.push({ policy, p, e, s, winner, playTicks, eitherIn, playerIn, enemyIn, stale, blindTicks });
      }
    }
  }

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const playTicks = sum('playTicks');
  const occ = sum('eitherIn') / playTicks;
  const pOcc = sum('playerIn') / playTicks;
  const eOcc = sum('enemyIn') / playTicks;
  const staleShare = sum('stale') / playTicks;
  const blindShare = sum('blindTicks') / playTicks;

  console.log(`\n══ CONCEALMENT OCCUPANCY ══  ${rows.length} matches, ${playTicks.toLocaleString()} playing ticks`);
  console.log(`   candidate regions      ${regions.length} x 80x80 wu, keepout violations ${violations.length}`);
  console.log(`   standable plan area    ${standable.toLocaleString()} lattice cells`);
  console.log('');
  console.log(`   AREA SHARE (null)      ${(areaShare * 100).toFixed(2)}%   the share of standable ground they cover`);
  console.log(`   OCCUPANCY (either)     ${(occ * 100).toFixed(2)}%   playing ticks with a fighter inside one`);
  console.log(`     player               ${(pOcc * 100).toFixed(2)}%`);
  console.log(`     enemy                ${(eOcc * 100).toFixed(2)}%`);
  console.log(`   LIFT                   ${((occ - areaShare) * 100 >= 0 ? '+' : '')}${((occ - areaShare) * 100).toFixed(2)} pp`
    + `   ${Math.abs(occ - areaShare) < 0.01 ? '<- AT CHANCE: this is decoration' : ''}`);
  console.log('');
  console.log(`   AI BELIEF STALE        ${(staleShare * 100).toFixed(2)}% of playing ticks`);
  console.log(`   …stale > 500 ms        ${(blindShare * 100).toFixed(2)}%   the AI is genuinely hunting`);
  console.log(`   wall                   ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({
      regions, areaShare, occ, pOcc, eOcc, staleShare, blindShare, rows,
    }, null, 2));
    console.log(`   json -> ${args.json}`);
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --traffic
//
// THE MEASUREMENT THE ARENA OWNER ACTUALLY NEEDS, and it is the answer to `--occupancy`'s
// finding rather than a second opinion on it.
//
// `--occupancy` measured a candidate region set placed by RULE (clear of cover, outside
// the endgame keepout) and found the player inside one on 1.51% of playing ticks against a
// 17.34% area share — 11x BELOW chance. Placement is not the reason: the set is 14 west /
// 11 east and 6 / 7 near the two spawns. The regions are simply not where anyone walks.
//
// So this runs the same sweep with NO concealment at all and bins every playing tick of
// both fighters into an 80 wu grid, then ranks the cells that are LEGAL to build on. A
// region placed on a top-ranked cell is used by construction; a region placed by eye is
// used by luck. It reports the occupancy those cells WOULD have delivered, which is a
// prediction the arena agent can hold this tool to afterwards.
//
// ⚠️ AND THE HARD LIMIT ON ALL OF IT: `tools/tmp/scripted_player.mjs` has perfect
// information and no concept of concealment, BY DESIGN — its header says so, and giving it
// perception would change every recorded balance number in the project for a reason that
// has nothing to do with the game. So the PLAYER-side numbers here describe where the
// INSTRUMENT walks, which is the best available proxy for where a human walks and is not
// the same thing. The ENEMY-side numbers are the real AI and can be read directly.
//
// ── WHAT IT MEASURED, 880 matches, 631,017 playing ticks, shipped kitchen ────
//
//   ONLY 86 BUILDABLE 80x80 CELLS EXIST AT ALL, of 14x12 = 168 — cover and the 248 wu
//   endgame keepout take the rest. Concealment's legal footprint is half the map before
//   anyone draws anything, and any density target has to be met inside that half.
//
//   AND TRAFFIC IS SPATIALLY SEGREGATED, which is why `--occupancy`'s rule-placed set
//   under-served the player 11x. The two fighters barely share ground:
//
//     player hot cells   (200,360) 5.91%   (280,360) 5.82%    <- its own spawn lane
//     enemy  hot cells   (1000,440) 12.81% (1160,520) 11.95% (1080,440) 7.50%
//     the player is at 0.000% in every one of the enemy's four hottest cells
//
//   => A SINGLE REGION SET CANNOT BE HIGH-TRAFFIC FOR BOTH FIGHTERS. Ranking by MEAN
//   traffic and taking the top 24 predicts player 15.33% / enemy 50.07% against a 27.91%
//   area share — enemy +22.16 pp, player -12.58 pp. Regions have to be placed in BOTH hot
//   zones deliberately, not by one ranking.
//
//   ⚠️ AND THE HOTTEST CELLS ARE NEXT TO THE SPAWNS, which is a design tension rather than
//   a placement instruction: concealment on a spawn is spawn-camping cover. The lanes
//   BETWEEN the hot cells and the hub are the honest target, and they are also where the
//   arena's own rule 1 wants density to be.
// ─────────────────────────────────────────────────────────────────────────────

if (args.traffic) {
  if (!BASE_ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const { concealmentKeepoutRadius, PLAYER_SIZE } = LIVE.RULES;
  const keepout = concealmentKeepoutRadius(BASE_ARENA.maxSafeRadius);
  const CELL = 80;
  const cols = Math.ceil(BASE_ARENA.width / CELL);
  const rows_ = Math.ceil(BASE_ARENA.height / CELL);
  const hitsP = new Float64Array(cols * rows_);
  const hitsE = new Float64Array(cols * rows_);

  const driver = driverFor(BASE_ARENA, LIVE);
  let playTicks = 0;
  const t0 = Date.now();
  for (const policy of POLICIES) {
    for (const [p, e] of MATCHUPS) {
      for (let s = 0; s < SEEDS; s++) {
        const rnd = rng(s * 7919 + p.length * 131 + e.length * 17 + policy.length);
        const state = LIVE.createMatch(BASE_ARENA, p, e);
        const decide = driver.POLICY_FNS[policy](rnd);
        const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: s === 0 ? 0 : 60, rnd });
        const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
        while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
          LIVE.stepMatch(state, DT, loop.next(state, DT));
          if (state.phase !== 'playing') continue;
          playTicks++;
          for (const [f, arr] of [[state.player, hitsP], [state.enemy, hitsE]]) {
            const gx = Math.min(cols - 1, Math.max(0, Math.floor(f.x / CELL)));
            const gy = Math.min(rows_ - 1, Math.max(0, Math.floor(f.y / CELL)));
            arr[gy * cols + gx]++;
          }
        }
      }
    }
  }

  // A cell is BUILDABLE if a fighter's centre can legally sit at its centre, it is clear of
  // cover by the fighter's own collision test, and it is outside the endgame keepout —
  // i.e. exactly the constraints `rules.ts` and `movement.ts` already state.
  const buildable = [];
  for (let gy = 0; gy < rows_; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = (gx + 0.5) * CELL;
      const y = (gy + 0.5) * CELL;
      const half = PLAYER_SIZE / 2;
      if (x < half || x > BASE_ARENA.width - half || y < half || y > BASE_ARENA.height - half) continue;
      if (Math.hypot(x - BASE_ARENA.center.x, y - BASE_ARENA.center.y) < keepout + CELL / 2) continue;
      if (BASE_ARENA.cover.some((o) => Math.abs(x - o.x) < (PLAYER_SIZE + o.w) / 2 && Math.abs(y - o.y) < (PLAYER_SIZE + o.h) / 2)) continue;
      const i = gy * cols + gx;
      buildable.push({ x, y, p: hitsP[i] / playTicks, e: hitsE[i] / playTicks, both: (hitsP[i] + hitsE[i]) / (2 * playTicks) });
    }
  }
  buildable.sort((a, b) => b.both - a.both);

  const N = Number(args.top ?? 24);
  const top = buildable.slice(0, N);
  const chance = 1 / buildable.length;
  console.log(`\n══ TRAFFIC ══  ${MATCHUPS.length * SEEDS * POLICIES.length} matches, ${playTicks.toLocaleString()} playing ticks, no concealment present`);
  console.log(`   ${buildable.length} buildable ${CELL}x${CELL} cells (clear of cover, outside the ${keepout.toFixed(0)} wu keepout)`);
  console.log(`   chance occupancy per cell ${(chance * 100).toFixed(3)}%\n`);
  console.log('   rank   centre        player%   enemy%   mean%    x chance');
  top.forEach((c, i) => {
    console.log(`   ${String(i + 1).padStart(4)}   (${String(Math.round(c.x)).padStart(4)},${String(Math.round(c.y)).padStart(4)})`
      + `   ${(c.p * 100).toFixed(3).padStart(7)}  ${(c.e * 100).toFixed(3).padStart(7)}`
      + `  ${(c.both * 100).toFixed(3).padStart(7)}   ${(c.both / chance).toFixed(2).padStart(6)}x`);
  });
  const topP = top.reduce((a, c) => a + c.p, 0);
  const topE = top.reduce((a, c) => a + c.e, 0);
  console.log(`\n   PREDICTED occupancy if the top ${N} cells were concealment:`);
  console.log(`     player  ${(topP * 100).toFixed(2)}%   enemy ${(topE * 100).toFixed(2)}%   `
    + `area share ${((N / buildable.length) * 100).toFixed(2)}% of buildable ground`);
  console.log(`     LIFT    player ${((topP - N * chance) * 100 >= 0 ? '+' : '')}${((topP - N * chance) * 100).toFixed(2)} pp`
    + `   enemy ${((topE - N * chance) * 100 >= 0 ? '+' : '')}${((topE - N * chance) * 100).toFixed(2)} pp`);
  console.log('\n   ⚠️ The player column is where the SCRIPTED driver walks — perfect information,');
  console.log('      no concept of concealment, by design. It is a proxy for a human, not a human.');
  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({ cell: CELL, keepout, playTicks, buildable }, null, 2));
    console.log(`   json -> ${args.json}`);
  }
  process.exit(0);
}

console.error('conceal_lab: pass one of --selftest, --bitid, --occupancy, --traffic');
process.exit(1);
