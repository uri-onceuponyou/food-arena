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
 * 🚨 **AND, SINCE 2026-08-10, THE `GameEvent[]` `stepMatch` RETURNS — IN ORDER.** Until
 * then it compared state ONLY, so the project's "0 differing ticks in 3,283,873" was a
 * STATE-ONLY number and the stream `match.ts` / `game/vfx.ts` / `ui/hud.ts` /
 * `audio/director.ts` are built on was never in it. `--selftest` §E is the proof that the
 * extension does something: a sim whose only difference is that `death` precedes
 * `hit-landed` inside one tick is passed by the old harness and failed by this one.
 *
 * ⚠️ **AND A TICK COUNT IS NOT A CORPUS.** `--corpus normal,timeout,countdown` names three,
 * because matches end by KNOCKOUT and a `normal` sweep therefore barely executes
 * `resolveTimeout`, while the countdown path runs no fighter loop at all. See `CORPORA`.
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

/**
 * The six modules a standalone copy of the sim needs, in ONE place in this file.
 *
 * ⚠️ There are FOUR hardcoded copies of this list in the repo — `match-sim.mjs:76`,
 * `roster_lab.mjs:307`, and (until 2026-08-10) two in this file. A seventh module under
 * `src/game/` therefore means finding all of them, which is why the N-fighter refactor
 * deliberately added none. Two of the four are now one; the other two are not this file's.
 */
const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];

function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dir = join(tmpdir(), `fa-conceal-simref-${sha}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'game'), { recursive: true });
  mkdirSync(join(dir, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) {
    writeFileSync(join(dir, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
  }
  writeFileSync(join(dir, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  return { dir: join(dir, 'game'), sha };
}

/**
 * A copy of the WORKING TREE's sim with one or more literal source edits applied — the
 * shape every known-bad control in `--selftest` takes.
 *
 * `edits` is `[file, from, to]` triples. Each one is required to actually change the
 * source: a control built on a replacement that silently matched nothing is a control that
 * passes for the wrong reason, which is the single most common way an instrument in this
 * repo has lied. Returns `{ dir, applied }` where `applied` is per-edit booleans, so the
 * caller asserts the patch landed rather than assuming it.
 */
function patchedSimDir(tag, edits) {
  const root = join(tmpdir(), `fa-conceal-${tag}`);
  const dir = join(root, 'game');
  rmSync(root, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) writeFileSync(join(dir, f), readFileSync(`${ROOT}/src/game/${f}`, 'utf8'));
  writeFileSync(join(root, 'arena', 'types.ts'), readFileSync(`${ROOT}/src/arena/types.ts`, 'utf8'));
  const applied = [];
  for (const [file, from, to] of edits) {
    const before = readFileSync(join(dir, file), 'utf8');
    const after = before.replace(from, to);
    applied.push(after !== before);
    writeFileSync(join(dir, file), after);
  }
  return { dir, applied };
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

/**
 * ⚠️ `--levels p:e` — AND WITHOUT IT THIS TOOL CANNOT SEE A MIS-RESOLVED ATTACKER.
 *
 * `createMatch`'s levels default to `LEVEL_MIN`, where `levelDamageMultiplier` is EXACTLY
 * 1.0 on both sides. `combat.ts:applyDamage` multiplies every weapon and trail hit by the
 * ATTACKER's `damageMul` — so at level 1 a sim that identified the wrong attacker would
 * deal identical damage and this harness would print PASS. That is precisely the shape of
 * hole `docs/LESSONS.md` §15c is about: a large tick count attached to a claim the corpus
 * cannot express.
 *
 * The N-fighter refactor replaced `state[otherRole(targetRole)]` with
 * `state.fighters[source.attackerId]`, which is exactly that resolution — so it must be
 * measured at levels where the two multipliers DIFFER. `--levels 15:1` gives 1.70 against
 * 1.00, and any mis-attribution moves a damage number on the first hit.
 *
 * Empty (the default) keeps the historical corpus: both sides at LEVEL_MIN.
 */
const LEVELS = (() => {
  if (!args.levels || args.levels === true) return {};
  const [p, e] = String(args.levels).split(':').map(Number);
  return { player: p, enemy: e };
})();

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
 *
 * `ignore(path) -> boolean` masks a path out of the comparison entirely. It exists for
 * `--ablate` and for nothing else: an ablation deliberately perturbs one field and asks
 * whether ANYTHING ELSE moved, so the perturbed field itself must not be reported. It is
 * `null` on every other path through this file, including `--bitid`.
 */
function firstDiff(a, b, path, added, ignore) {
  if (ignore && ignore(path)) return null;
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
      const d = firstDiff(a[i], b[i], `${path}[${i}]`, added, ignore);
      if (d) return d;
    }
    return null;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (typeof a[k] === 'function' || typeof b[k] === 'function') continue;
    if (ignore && ignore(`${path}.${k}`)) continue;
    const inA = k in a;
    const inB = k in b;
    if (inA && !inB) {
      if (!added) return `${path}.${k}: present in the LIVE state only`;
      // Index paths collapse to `[i]` so 400 projectiles do not become 400 entries.
      added.add(`${path}.${k}`.replace(/\[\d+\]/g, '[i]'));
      continue;
    }
    if (!inA && inB) return `${path}.${k}: REMOVED from the live state — a baseline field vanished`;
    const d = firstDiff(a[k], b[k], `${path}.${k}`, added, ignore);
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
 *
 * ── 🚨 IT COMPARES THE RETURNED EVENTS TOO, AND UNTIL 2026-08-10 IT DID NOT ──
 *
 * `stepMatch` returns a `GameEvent[]`. That array is HALF the sim's contract and it is the
 * half `match.ts`, `game/vfx.ts`, `ui/hud.ts` and `audio/director.ts` actually consume —
 * every explosion, every damage number, every note of the score is driven off it and off
 * nothing else. This function used to compare `comparable(state)` and throw the events on
 * the floor, so the famous **"0 differing ticks in 3,283,873" was a STATE-ONLY number**:
 * a change that reordered two events inside a tick, or dropped one entirely, would have
 * been reported as bit-identical. Quoting that figure for a change that touches the event
 * protocol would be quoting a number for a claim it does not support — exactly the failure
 * `docs/LESSONS.md` §15c exists to prevent.
 *
 * The extension is validated the same way the state differ is: `--selftest` §E builds a sim
 * whose ONLY difference is that a killing blow emits `death` BEFORE `hit-landed` instead of
 * after — every field of every object identical at every tick, only the order inside one
 * array changed. **The state-only harness passes it and the extended one fails it.** If it
 * could not, the extension would be decoration.
 *
 * Order is significant, deliberately: `audio/director.ts` and `game/vfx.ts` both react to
 * the stream in the order they receive it, so "same multiset, different order" is a real
 * behavioural difference and not a formatting one.
 *
 * `opts.events === false` selects the OLD, state-only behaviour. It exists for one purpose
 * — being the control the known-bad above is measured against — and nothing else uses it.
 * `opts.pin(stateA, stateB, tick)` runs after every step on BOTH states identically, which
 * is how the forced-immortal and countdown-only corpora are built without a second harness.
 * `opts.maxTicks` caps the loop for a corpus that has no natural end.
 */
function lockstepMatch(arena, simA, simB, driver, playerId, enemyId, policy, seed, added, opts = {}) {
  const cmpEvents = opts.events !== false;
  const ignore = opts.ignore ?? null;
  // Seed formula is `pacing_ladder.mjs`'s / `roster_lab.mjs`'s, unchanged — that is what
  // makes a row here the SAME match as a row there.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const levels = opts.levels ?? LEVELS;
  const stateA = simA.createMatch(arena, playerId, enemyId, levels);
  const stateB = simB.createMatch(arena, playerId, enemyId, levels);
  if (opts.pin) opts.pin(stateA, stateB, 0);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  const maxTicks = opts.maxTicks ?? Infinity;
  let tick = 0;
  // Bookkeeping so a corpus can be shown to be NON-VACUOUS by its own output rather than
  // by argument: a run that compared a million ticks and never saw a death has not tested
  // the death path, and a run whose `playTicks` is 0 has not tested the fighter loop.
  let events = 0, deaths = 0, playTicks = 0, endTicks = 0, countdownTicks = 0;
  while (stateA.phase !== 'ended' && stateA.elapsed < HARD_CAP && tick < maxTicks) {
    const input = loop.next(stateA, DT);
    const phaseBefore = stateA.phase;
    const evA = simA.stepMatch(stateA, DT, input);
    const evB = simB.stepMatch(stateB, DT, input);
    tick++;
    events += evA.length;
    for (const e of evA) if (e.type === 'death') deaths++;
    if (phaseBefore === 'countdown') countdownTicks++;
    else if (phaseBefore === 'playing') playTicks++;
    else endTicks++;
    let d = firstDiff(comparable(stateA), comparable(stateB), 'state', added, ignore);
    if (!d && cmpEvents) d = firstDiff(evA, evB, 'events', added, ignore);
    if (d) return { tick, diff: d, elapsed: stateA.elapsed, events, deaths, playTicks, countdownTicks, endTicks, state: stateA };
    if (opts.pin) opts.pin(stateA, stateB, tick);
  }
  // The B match must also have ENDED — a B that is still playing when A stops is a
  // divergence the per-tick walk would have caught, but asserting it costs nothing and
  // rules out a differ that silently compares nothing.
  const d = firstDiff(comparable(stateA), comparable(stateB), 'state', added, ignore);
  if (d) return { tick, diff: d, elapsed: stateA.elapsed, events, deaths, playTicks, countdownTicks, endTicks, state: stateA };
  return { tick, diff: null, elapsed: stateA.elapsed, events, deaths, playTicks, countdownTicks, endTicks, state: stateA };
}

const MATCHUPS = (() => {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
})();

/** Flip between the only two values a two-valued legacy field can hold. */
const flip = (v, a, b) => (v === a ? b : a);

/**
 * `path` masks, as predicates. ⚠️ EVERY ALIAS OF A PERTURBED FIELD MUST BE MASKED:
 * `state.player` IS `state.fighters[0]`, so a perturbation of one is visible at both paths
 * and a mask that named only one would report the ablation as its own result.
 */
const ABLATIONS = [
  {
    name: 'Fighter.id (swapped)',
    expect: { state: 'live', events: 'live' },
    why: 'read by opponentOf, sightingIndex, fighterBit, spawnProjectile and applyDamage',
    perturb: (st) => { st.fighters[0].id = 1; st.fighters[1].id = 0; },
    mask: (p) => /^state\.(fighters\[\d+\]|player|enemy)\.id$/.test(p),
  },
  {
    name: 'Fighter.controller (swapped)',
    expect: { state: 'live', events: 'live' },
    why: "sim.ts's fighter loop branches on it — swapping puts the AI in the human's seat",
    perturb: (st) => {
      st.fighters[0].controller = 'ai';
      st.fighters[1].controller = 'human';
    },
    mask: (p) => /^state\.(fighters\[\d+\]|player|enemy)\.controller$/.test(p),
  },
  {
    name: 'Fighter.hitRadius (+1 on both)',
    expect: { state: 'live', events: 'live' },
    why: 'the field that replaced stepProjectiles\' targetRole ternary; if it were dead the ternary would still be there',
    perturb: (st) => { for (const f of st.fighters) f.hitRadius += 1; },
    mask: (p) => /^state\.(fighters\[\d+\]|player|enemy)\.hitRadius$/.test(p),
  },
  {
    name: 'Fighter.role (swapped) — the WHOLE mirror closure',
    expect: { state: 'dead', events: 'live' },
    why: 'no gameplay decision reads any *Role mirror; the event protocol still carries them',
    perturb: (st) => { for (const f of st.fighters) f.role = flip(f.role, 'player', 'enemy'); },
    // ⚠️ THE MASK IS THE CLOSURE, NOT THE FIELD, AND THE FIRST VERSION WAS THE FIELD.
    // It masked `fighters[*].role` alone and reported FAULT — live in state — on
    // `projectiles[3].ownerRole: "player" !== "enemy"`. That was not behaviour: it is
    // `spawnProjectile` copying `owner.role` into the projectile's own mirror, i.e. the
    // perturbation flowing into a SECOND mirror rather than into a decision. The claim
    // being tested is "no `*Role` mirror anywhere is read by a gameplay decision", so the
    // mask has to cover every place a role is mirrored TO. `winnerId` is deliberately left
    // UNMASKED beside `winner`, so a genuinely different outcome still fails.
    mask: (p) => /^state\.(fighters\[\d+\]|player|enemy)\.role$/.test(p)
      || /^state\.projectiles\[\d+\]\.(ownerRole|targetRole)$/.test(p)
      || /^state\.trailMarks\[\d+\]\.ownerRole$/.test(p)
      || p === 'state.winner',
  },
  {
    name: 'sightings[0] — the (0,0) DIAGONAL cell',
    expect: { state: 'dead', events: 'dead' },
    why: 'a fighter does not need to remember where it saw itself; the diagonal exists to keep the index one expression',
    perturb: (st) => { st.sightings[0].x += 1; st.sightings[0].y -= 1; st.sightings[0].at += 1; },
    mask: (p) => /^state\.sightings\[0\]\./.test(p),
  },
  {
    name: 'sightings[1] — the UNUSED observer row (human on AI)',
    expect: { state: 'dead', events: 'dead' },
    why: 'there is deliberately no perception for a human; the scripted driver has perfect information BY DESIGN',
    perturb: (st) => { st.sightings[1].x += 1; st.sightings[1].y -= 1; st.sightings[1].at += 1; },
    mask: (p) => /^state\.sightings\[1\]\./.test(p),
  },
  {
    name: 'sightings[3] — the (1,1) DIAGONAL cell',
    expect: { state: 'dead', events: 'dead' },
    why: 'as sightings[0]',
    perturb: (st) => { st.sightings[3].x += 1; st.sightings[3].y -= 1; st.sightings[3].at += 1; },
    mask: (p) => /^state\.sightings\[3\]\./.test(p),
  },
  {
    name: 'sightings[2] — the read cell, on the SHIPPED arena',
    expect: { state: 'dead', events: 'dead' },
    // ⚠️ THIS ONE WAS DECLARED `live` AND CAME BACK `dead`, AND THE INSTRUMENT WAS RIGHT.
    // On an arena with NO concealment regions `isVisibleFrom` is true on every tick, so
    // `stepAI` OVERWRITES this cell with the target's true position at the top of its own
    // body — before it reads `tx, ty` from it. A perturbation therefore cannot survive into
    // a decision. That is the *whole* concealment inertness claim, restated on the matrix:
    // with no regions, the belief is refreshed before use on 2.5M playing ticks. It is a
    // property of the ARENA, not of the container, which is why the row below re-runs the
    // same perturbation on an arena that has regions and REQUIRES it to be live.
    why: 'with no concealment the belief is refreshed before it is read, on every tick',
    perturb: (st) => { st.sightings[2].x += 1; },
    // `aiSighting` is the SAME OBJECT as `sightings[2]`, so both paths carry the change.
    mask: (p) => /^state\.(sightings\[2\]|aiSighting)\./.test(p),
  },
  {
    name: 'sightings[2] — the read cell, on an arena WITH concealment',
    expect: { state: 'live', events: 'live' },
    why: "the AI's whole perception; if this were dead, stepAI would not be reading the matrix at all",
    arena: 'conceal',
    perturb: (st) => { st.sightings[2].x += 1; },
    mask: (p) => /^state\.(sightings\[2\]|aiSighting)\./.test(p),
  },
  {
    name: 'MatchState.winnerId',
    expect: { state: 'dead', events: 'dead' },
    why: 'written by the sim, read by nothing in it; the events recompute it from the fighter',
    perturb: (st) => { st.winnerId = 7; },
    mask: (p) => p === 'state.winnerId',
  },
  {
    name: 'Projectile.ownerRole / targetRole (flipped)',
    expect: { state: 'dead', events: 'dead' },
    why: 'legacy mirrors of ownerId/targetId; stepProjectiles resolves the victim by slot',
    perturb: (st) => {
      for (const pr of st.projectiles) {
        pr.ownerRole = flip(pr.ownerRole, 'player', 'enemy');
        pr.targetRole = flip(pr.targetRole, 'player', 'enemy');
      }
    },
    mask: (p) => /^state\.projectiles\[\d+\]\.(ownerRole|targetRole)$/.test(p),
  },
  {
    name: 'TrailMark.ownerRole (flipped)',
    expect: { state: 'dead', events: 'dead' },
    why: 'legacy mirror of ownerId; the trail loop matches on the slot',
    perturb: (st) => { for (const m of st.trailMarks) m.ownerRole = flip(m.ownerRole, 'player', 'enemy'); },
    mask: (p) => /^state\.trailMarks\[\d+\]\.ownerRole$/.test(p),
  },
  {
    name: 'TrailMark.damaged (flipped) — the legacy boolean',
    expect: { state: 'dead', events: 'dead' },
    why: 'replaced by damagedMask; kept only because a REMOVED field is a hard failure in the differ',
    perturb: (st) => { for (const m of st.trailMarks) m.damaged = !m.damaged; },
    mask: (p) => /^state\.trailMarks\[\d+\]\.damaged$/.test(p),
  },
  {
    name: 'TrailMark.damagedMask (low bits flipped)',
    expect: { state: 'live', events: 'live' },
    why: 'the field that replaced the boolean; a spent mark becomes unspent and bites again',
    perturb: (st) => { for (const m of st.trailMarks) m.damagedMask ^= 3; },
    mask: (p) => /^state\.trailMarks\[\d+\]\.(damagedMask|damaged)$/.test(p),
  },
];

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
    // One character's speed stat, moved by the smallest step that can matter. Chosen over
    // a damage change because it perturbs POSITION, which is the quantity a "the AI walks
    // to the wrong place" bug would move — i.e. exactly what this harness must catch.
    const { dir, applied } = patchedSimDir('selftest-bad', [
      ['rules.ts', 'export const AI_CHASE_SPEED = 0.07;', 'export const AI_CHASE_SPEED = 0.0700001;'],
    ]);
    ok('the known-bad sim was actually patched (a no-op patch would fake this control)', applied[0]);
    const BAD = await loadSim(dir);
    const r = lockstepMatch(CLEAR, LIVE, BAD, driver, 'pizza', 'soup', 'smart2', 0);
    ok('a sim whose AI_CHASE_SPEED differs in the 7th digit is caught, and caught EARLY',
      r.diff !== null && r.tick < 800, `first divergence at tick ${r.tick}: ${r.diff}`);
  }

  // ── E. KNOWN-BAD: AN EVENT-ONLY DIVERGENCE, WHICH THE OLD HARNESS COULD NOT SEE ──
  //
  // 🚨 THE HOLE THIS CLOSES. Until 2026-08-10 `lockstepMatch` compared `comparable(state)`
  // and threw away the `GameEvent[]` that `stepMatch` returns — so the project's
  // "0 differing ticks in 3,283,873" was a STATE-ONLY number, and the event stream that
  // `match.ts`, `game/vfx.ts`, `ui/hud.ts` and `audio/director.ts` are built on was
  // unmeasured. A change that reordered, dropped or duplicated an event would have printed
  // BIT-IDENTITY: PASS.
  //
  // The control is the smallest possible event-only difference: `combat.ts:applyDamage`
  // emits `hit-landed` BEFORE the death block. Patched, a killing blow emits
  // `death`, `match-ended`, `hit-landed` instead of `hit-landed`, `death`, `match-ended`.
  // Same multiset, same fields, same values — only the order inside one array. Every field
  // of every fighter, projectile, splat, mark, the ring, the clock and the id counter is
  // untouched, which is what makes this a test of the EXTENSION and not of the state walk.
  //
  // Both directions are asserted, because either alone proves nothing:
  //   * the STATE-ONLY harness (`events: false`) must PASS it — if it failed, the
  //     difference would not be event-only and the control would be measuring the wrong
  //     thing;
  //   * the extended harness must FAIL it, at the tick the death happens.
  // And the run is required to have contained a death at all: a corpus with no killing blow
  // could not express this difference, so a green pair would be vacuous.
  {
    // ⚠️ THE ANCHOR IS DELIBERATELY SHORT AND PAYLOAD-INDEPENDENT. A first version quoted
    // the whole `hit-landed` push, and the N-fighter change (which added `targetId` to it)
    // stopped it matching — the `applied[0]` assertion below caught that loudly, which is
    // what it is for, but a control that needs editing every time an event gains a field is
    // a control that will one day be edited into a no-op. `events.pop()` takes whatever
    // `hit-landed` currently looks like and re-pushes it verbatim after the death block, so
    // the ONLY thing this sim differs by is the order of two entries in one array.
    const { dir, applied } = patchedSimDir('selftest-evorder', [
      ['combat.ts',
        `  if (target.hp === 0) {
    target.alive = false;
    events.push({ type: 'death',`,
        `  if (target.hp === 0) {
    target.alive = false;
    const __hitEv = events.pop();
    events.push({ type: 'death',`],
      ['combat.ts',
        `    if (state.phase === 'playing') {
      // \u26a0\ufe0f THE KNOCKOUT WINNER`,
        `    events.push(__hitEv);
    if (state.phase === 'playing') {
      // \u26a0\ufe0f THE KNOCKOUT WINNER`],
    ]);
    ok('the event-order known-bad was actually patched into combat.ts (both edits landed)',
      applied[0] && applied[1], `applied ${JSON.stringify(applied)}`);
    const EVBAD = await loadSim(dir);
    const stateOnly = lockstepMatch(CLEAR, LIVE, EVBAD, driver, 'pizza', 'soup', 'smart2', 0, undefined, { events: false });
    const withEvents = lockstepMatch(CLEAR, LIVE, EVBAD, driver, 'pizza', 'soup', 'smart2', 0);
    ok('the corpus this control runs on actually contains a killing blow (not vacuous)',
      stateOnly.deaths >= 1, `${stateOnly.deaths} death events in ${stateOnly.tick} ticks`);
    ok('KNOWN-BAD: the OLD state-only harness reports a reordered event stream as IDENTICAL',
      stateOnly.diff === null, stateOnly.diff ?? `${stateOnly.tick} ticks, ${stateOnly.events} events, state-only`);
    ok('…and the EXTENDED harness catches it, in the event array',
      withEvents.diff !== null && withEvents.diff.startsWith('events'),
      `tick ${withEvents.tick}: ${withEvents.diff}`);
    // Order-only is the subtle case; a MISSING and an EXTRA event are the obvious ones and
    // are pinned directly on the differ so the claim does not rest on one patched sim.
    {
      const a = [{ type: 'death', fighterRole: 'player' }];
      const b = [{ type: 'death', fighterRole: 'player' }, { type: 'heal', fighterRole: 'enemy', amount: 3 }];
      ok('the event differ catches a MISSING event (array length)', firstDiff(a, b, 'events', new Set()) !== null);
      ok('…and an event whose payload differs by one field',
        firstDiff([{ type: 'heal', fighterRole: 'enemy', amount: 3 }],
          [{ type: 'heal', fighterRole: 'enemy', amount: 4 }], 'events', new Set()) !== null);
      ok('…and two identical streams are still reported identical',
        firstDiff(b, b.map((e) => ({ ...e })), 'events', new Set()) === null);
    }
  }

  // ── G. THE CORPUS ITSELF CAN BE BLIND, AND `--levels` IS WHY ──────────────
  //
  // 🚨 A TICK COUNT IS A CLAIM ABOUT WHAT THE CORPUS CAN EXPRESS, NOT ABOUT ITS SIZE.
  //
  // `createMatch`'s levels default to `LEVEL_MIN`, where `levelDamageMultiplier` is exactly
  // 1.0 for BOTH fighters. `combat.ts:applyDamage` multiplies every weapon and trail hit by
  // the ATTACKER's `damageMul` — so at level 1 a sim that resolved the WRONG attacker deals
  // the identical number and 15.6M bit-identical ticks would say nothing about it. The
  // N-fighter refactor replaced `state[otherRole(targetRole)]` with
  // `state.fighters[source.attackerId]`, which is that exact resolution.
  //
  // The control is a sim that scales damage by the TARGET's multiplier instead of the
  // attacker's — the smallest possible mis-attribution. It must be INVISIBLE at 1v1 levels
  // and CAUGHT at 15-vs-1, and both halves are asserted: the first is what proves the
  // default corpus is blind here, the second is what proves `--levels` fixes it.
  {
    const { dir, applied } = patchedSimDir('selftest-attacker', [
      ['combat.ts',
        'const dealt = attacker ? amount * attacker.damageMul : amount;',
        'const dealt = attacker ? amount * target.damageMul : amount;'],
    ]);
    ok('the wrong-attacker known-bad was actually patched into combat.ts', applied[0]);
    const ATK = await loadSim(dir);
    const flat = lockstepMatch(CLEAR, LIVE, ATK, driver, 'pizza', 'soup', 'smart2', 0, undefined, { levels: {} });
    const tilted = lockstepMatch(CLEAR, LIVE, ATK, driver, 'pizza', 'soup', 'smart2', 0, undefined, { levels: { player: 15, enemy: 1 } });
    ok('KNOWN-BAD: at LEVEL_MIN the corpus is BLIND to a wrong-attacker resolution',
      flat.diff === null, flat.diff ?? `${flat.tick} ticks, ${flat.events} events`);
    ok('…and `--levels 15:1` catches the same sim, because the two multipliers now differ',
      tilted.diff !== null, `tick ${tilted.tick}: ${tilted.diff}`);
    // …and the tilted corpus must not be reporting a difference for some OTHER reason:
    // the unpatched sim against itself at the same levels has to stay identical.
    const control = lockstepMatch(CLEAR, LIVE, LIVE, driver, 'pizza', 'soup', 'smart2', 0, undefined, { levels: { player: 15, enemy: 1 } });
    ok('…and the same levels against the UNPATCHED sim are still bit-identical (drift control)',
      control.diff === null, control.diff ?? `${control.tick} ticks`);
  }

  // ── F. THE ABLATION BATTERY'S OWN MACHINERY ───────────────────────────────
  //
  // `--ablate` proves fields dead by perturbing them and finding nothing. That is a shape
  // of test that passes beautifully when it is broken: a mask that matched every path, or a
  // perturbation that never fired, would report the whole table dead and green. So the two
  // parts that could silently do nothing are pinned here.
  {
    const a = { x: 1, y: 2 };
    const b = { x: 9, y: 2 };
    ok('an ignore mask suppresses the path it names',
      firstDiff(a, b, 'state', undefined, (p) => p === 'state.x') === null);
    ok('…and does NOT suppress anything else',
      firstDiff(a, { x: 1, y: 3 }, 'state', undefined, (p) => p === 'state.x') !== null);
    ok('…and with no mask the same difference is still caught (the mask is what changed it)',
      firstDiff(a, b, 'state', undefined, null) !== null);

    // A table of nothing but "dead" expectations cannot fail. Half of these must be LIVE,
    // and each mask must be a mask on ONE field rather than on the state.
    const live = ABLATIONS.filter((x) => x.expect.state === 'live' || x.expect.events === 'live');
    ok('the ablation table carries POSITIVE controls, not only dead-field claims',
      live.length >= 4 && live.length < ABLATIONS.length,
      `${live.length} live of ${ABLATIONS.length}`);
    const total = ABLATIONS.filter((x) => ['state.elapsed', 'state.phase', 'state.fighters[0].hp']
      .some((p) => x.mask(p)));
    ok('…and no mask swallows a path it has no business hiding',
      total.length === 0, total.map((x) => x.name).join(', '));
    // And the perturbations must actually change something: a no-op perturb would make
    // every row "dead" for the wrong reason.
    {
      const probe = LIVE.createMatch(CLEAR, 'donut', 'donut');
      probe.projectiles.push({
        id: 1, ownerId: 0, targetId: 1, ownerRole: 'player', targetRole: 'enemy',
        weapon: LIVE.RULES.CHARACTERS.donut.weapons[0], x: 0, y: 0, vx: 0, vy: 0,
        traveled: 0, damage: 1, color: '#fff', emoji: 'x',
      });
      probe.trailMarks.push({
        id: 2, ownerId: 0, ownerRole: 'player', x: 0, y: 0, expiresAt: 1e9,
        damagedMask: 0, damaged: false,
      });
      const noops = [];
      for (const ab of ABLATIONS) {
        const before = JSON.stringify(comparable(probe));
        ab.perturb(probe);
        if (JSON.stringify(comparable(probe)) === before) noops.push(ab.name);
        ab.perturb(probe); // most are involutions; the rest are restored by the fresh probe
      }
      ok('every ablation perturbation actually changes the state it is handed',
        noops.length === 0, noops.join(', ') || `${ABLATIONS.length} perturbations`);
    }
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

/**
 * THE THREE CORPORA, AND WHY ONE OF THEM IS NOT ENOUGH.
 *
 * A tick count is not a corpus. `normal` runs matches to their natural end, and matches end
 * by KNOCKOUT — so `sim.ts:resolveTimeout` is barely executed by it, and the countdown
 * phase is ~230 of a ~900-tick match. Quoting one big number from `normal` for a change
 * that rewrites the timeout tiebreak, or that sits inside the `phase === 'playing'` gate,
 * attaches the number to a claim it does not support.
 *
 *   normal     natural end. KO-dominated. Exercises the fighter loop, combat, projectiles,
 *              ground effects and the death path. Barely touches `resolveTimeout`.
 *   timeout    FORCED-IMMORTAL. Both fighters get `hp = maxHp = 1e9` at tick 0 — the
 *              `tools/match-sim.mjs:768` idiom — so no killing blow can land inside the
 *              45 s clock and every match is decided by `resolveTimeout`. Reports which
 *              tiebreak RUNG each match landed on, because a corpus that only ever reaches
 *              rung 1 has not tested rungs 2 and 3.
 *   countdown  `countdownTick` is pinned to 0 in BOTH sims after every step, so the
 *              countdown never elapses and `phase` never leaves `'countdown'` — asserted,
 *              not assumed. 10 s per match of the path that runs NO fighter loop at all.
 *              This is the half of `stepMatch` an N-fighter change cannot reach, and
 *              proving it untouched is a different claim from proving the other half equal.
 *
 * Every pin is applied to A and B identically, from the harness, so it can never itself be
 * a divergence.
 */
const CORPORA = {
  normal: { pin: null, maxTicks: undefined },
  timeout: {
    // ONCE, at tick 0 — not every tick. Damage still lands and still moves the HP
    // FRACTION, which is what rung 1 compares; it simply cannot reach zero in 45 s. A
    // per-tick re-pin would force every match onto rung 2 and hide rung 1 entirely.
    pin: (a, b, tick) => {
      if (tick !== 0) return;
      for (const st of [a, b]) {
        for (const f of [st.player, st.enemy]) { f.hp = 1e9; f.maxHp = 1e9; }
      }
    },
    maxTicks: undefined,
  },
  countdown: {
    // The counter is allowed to RUN — it is rewound one step before it would reach 0, so
    // `stepCountdown` keeps crossing its 1000 ms boundary and keeps emitting real
    // `countdown-tick` events, while `phase` never reaches `'playing'`. Pinning
    // `countdownTick` to 0 instead would freeze the branch and produce a corpus with zero
    // events in it, which would compare the event stream against nothing.
    pin: (a, b) => {
      for (const st of [a, b]) if (st.countdownValue <= 1) st.countdownValue = 3;
    },
    maxTicks: 600, // 10.0 s at dt 16.667
  },
};

if (args.bitid) {
  if (!BASE_ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  const ref = String(args['sim-ref'] ?? 'HEAD');
  const REF = extractSimAt(ref);
  const BASE = await loadSim(REF.dir);
  const driver = driverFor(BASE_ARENA, LIVE);
  const corpora = String(args.corpus ?? 'normal').split(',');
  for (const c of corpora) {
    if (!CORPORA[c]) { console.error(`unknown --corpus ${c}; one of ${Object.keys(CORPORA).join(',')}`); process.exit(1); }
  }

  console.log(`\n══ BIT-IDENTITY ══  working tree vs ${ref} (${REF.sha})`);
  console.log(`   ${MATCHUPS.length} matchups x ${SEEDS} seeds x ${POLICIES.length} polic${POLICIES.length === 1 ? 'y' : 'ies'}`
    + ` = ${MATCHUPS.length * SEEDS * POLICIES.length} matches per corpus, driver rev ${DRIVER_REV}, dt ${DT}`);
  console.log(`   arena ${BASE_ARENA.id} ${BASE_ARENA.width}x${BASE_ARENA.height}, `
    + `${BASE_ARENA.cover.length} cover, ${BASE_ARENA.hazards.length} hazards, `
    + `${(BASE_ARENA.concealment ?? []).length} concealment`);
  console.log(`   corpora ${corpora.join(', ')}`);
  console.log(`   levels  ${LEVELS.player === undefined ? 'default (LEVEL_MIN both sides — damageMul 1.0, see --levels)'
    : `player ${LEVELS.player} vs enemy ${LEVELS.enemy}`}`);
  console.log('   COMPARED PER TICK: the whole MatchState (minus the shared arena object)');
  console.log('                      AND the GameEvent[] stepMatch returns, in order.');
  console.log('   FLOOR: EXACT. This is not a statistical test — one differing tick is a failure.\n');

  const added = new Set();
  let anyFail = 0;
  const summary = [];
  for (const corpus of corpora) {
    const { pin, maxTicks } = CORPORA[corpus];
    const t0 = Date.now();
    let matches = 0, ticks = 0, events = 0, deaths = 0;
    let playTicks = 0, countdownTicks = 0, endTicks = 0;
    // Which timeout rung decided each match, recovered from the FINAL state rather than
    // from inside the sim: equal HP fractions means rung 1 could not decide it.
    const rungs = [0, 0, 0];
    let timeouts = 0;
    const failures = [];
    for (const policy of POLICIES) {
      for (const [p, e] of MATCHUPS) {
        for (let s = 0; s < SEEDS; s++) {
          const r = lockstepMatch(BASE_ARENA, LIVE, BASE, driver, p, e, policy, s, added, { pin, maxTicks });
          matches++; ticks += r.tick; events += r.events; deaths += r.deaths;
          playTicks += r.playTicks; countdownTicks += r.countdownTicks; endTicks += r.endTicks;
          if (corpus === 'timeout' && r.diff === null) {
            const st = r.state;
            if (st && r.deaths === 0 && st.winner !== null) {
              timeouts++;
              const pf = st.player.hp / st.player.maxHp;
              const ef = st.enemy.hp / st.enemy.maxHp;
              const pd = Math.hypot(st.player.x - BASE_ARENA.center.x, st.player.y - BASE_ARENA.center.y);
              const ed = Math.hypot(st.enemy.x - BASE_ARENA.center.x, st.enemy.y - BASE_ARENA.center.y);
              rungs[pf !== ef ? 0 : pd !== ed ? 1 : 2]++;
            }
          }
          if (r.diff) failures.push(`${corpus} ${policy} ${p}>${e} seed ${s} @ tick ${r.tick} (${(r.elapsed / 1000).toFixed(2)}s): ${r.diff}`);
          // The corpus must be what it says it is. `countdown` claims `phase` never reaches
          // `'playing'`; if it did, the corpus would silently become a short `normal` run
          // and its whole point — covering the path that runs NO fighter loop — would be
          // gone while still printing a large tick count.
          else if (corpus === 'countdown' && r.playTicks > 0) {
            failures.push(`${corpus} ${policy} ${p}>${e} seed ${s}: phase reached 'playing' for ${r.playTicks} ticks — corpus is not countdown-only`);
          } else if (corpus === 'timeout' && r.deaths > 0) {
            failures.push(`${corpus} ${policy} ${p}>${e} seed ${s}: ${r.deaths} deaths — the forced-immortal pin did not hold`);
          }
        }
        if (matches % 550 === 0) {
          process.stderr.write(`   [${corpus}] ${matches} matches, ${(ticks / 1e6).toFixed(2)}M ticks, `
            + `${failures.length} divergent, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
        }
      }
    }
    console.log(`   ── corpus ${corpus} ─────────────────────────────────────────────`);
    console.log(`      matches      ${matches}`);
    console.log(`      ticks        ${ticks.toLocaleString()}  (countdown ${countdownTicks.toLocaleString()} / playing ${playTicks.toLocaleString()} / ended ${endTicks.toLocaleString()})`);
    console.log(`      events       ${events.toLocaleString()} compared in order, ${deaths} of them deaths`);
    if (corpus === 'timeout') {
      console.log(`      timeouts     ${timeouts} matches decided by resolveTimeout`
        + `  — rung1 HP-fraction ${rungs[0]}, rung2 zone ${rungs[1]}, rung3 slot ${rungs[2]}`);
    }
    console.log(`      divergent    ${failures.length}`);
    console.log(`      wall         ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    if (failures.length) {
      console.log('      FIRST DIVERGENCES:');
      for (const f of failures.slice(0, 10)) console.log(`        ${f}`);
    }
    anyFail += failures.length;
    summary.push({ corpus, matches, ticks, events, deaths, failures: failures.length });
  }

  console.log(`\n   ADDED FIELDS ${added.size} — present in the live state/events, absent at ${ref}. Declared, not ignored:`);
  for (const f of [...added].sort()) console.log(`                  ${f}`);
  const totalTicks = summary.reduce((a, r) => a + r.ticks, 0);
  const totalEvents = summary.reduce((a, r) => a + r.events, 0);
  if (anyFail) {
    console.log(`\n   BIT-IDENTITY: FAIL (${anyFail} divergent matches)`);
    process.exit(1);
  }
  console.log(`\n   BIT-IDENTITY: PASS — 0 differing ticks in ${totalTicks.toLocaleString()}`
    + `, over BOTH the per-tick state AND the ${totalEvents.toLocaleString()} events in order`);
  console.log(`   corpora: ${summary.map((r) => `${r.corpus} ${r.matches}m/${r.ticks.toLocaleString()}t/${r.events.toLocaleString()}e`).join('  ·  ')}`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// --ablate : DEAD-STATE ABLATION
//
// 🚨 THE ARGUMENT THIS REPLACES IS "UNREAD STATE CANNOT CHANGE BEHAVIOUR", AND THAT IS AN
// ARGUMENT FROM CODE READING.
//
// The N-fighter container adds fields that are claimed to be inert at N=2 — the `sightings`
// diagonal, the unused observer row, `Fighter.role`, `winnerId`, and the `*Role` mirrors on
// projectiles and trail marks. `CLAUDE.md` #6 is explicit that a claim like that is exactly
// what not to trust: nineteen instruments in this repo have returned confident wrong
// answers, and "I read the code and nothing reads it" is how every one of them started.
//
// So each field is perturbed BEHAVIOURALLY, on every tick, in one of two otherwise
// identical sims, with that field alone masked out of the comparison — and the whole corpus
// must come back with zero differing ticks in state AND events.
//
// ── AND HALF THE TABLE IS A POSITIVE CONTROL, WHICH IS THE POINT ────────────
//
// A battery that only ever asserts "nothing happened" passes just as well when it is
// broken: a harness that forgot to apply its own perturbation, or that masked the whole
// state instead of one path, reports every field dead. So every entry carries a DECLARED
// expectation, and the LIVE ones must diverge:
//
//   * `id`, `controller`, `hitRadius` and `damagedMask` are load-bearing and must be caught.
//     `hitRadius` in particular is the proof that `Fighter.hitRadius` really did replace
//     `sim.ts`'s `targetRole === 'player' ? ... : ...` ternary rather than sitting beside it.
//   * `role` is the interesting one: DEAD in the state and LIVE in the events. That is a
//     precise statement of what the legacy mirrors are for — no gameplay decision reads
//     them, and the event protocol still carries them for four out-of-set consumers.
//
// Each entry is therefore run TWICE: once with the event comparison off (does the STATE
// move?) and once with it on (does anything at all move?).
// ─────────────────────────────────────────────────────────────────────────────

if (args.ablate) {
  if (!BASE_ARENA) { console.error(`no arena at ${ARENA_PATH}`); process.exit(1); }
  // Two arenas, because one ablation is VACUOUS on the shipped map — see the two
  // `sightings[2]` rows. The concealment arena is `--occupancy`'s own candidate set, so it
  // is the same geometry that tool already reports on rather than a second invention.
  const ARENAS = {
    shipped: BASE_ARENA,
    conceal: { ...BASE_ARENA, concealment: candidateRegions(BASE_ARENA) },
  };
  const DRIVERS = { shipped: driverFor(ARENAS.shipped, LIVE), conceal: driverFor(ARENAS.conceal, LIVE) };
  const seeds = Number(args.seeds ?? 2);
  const only = args.only ? String(args.only) : null;
  const table = ABLATIONS.filter((a) => !only || a.name.includes(only));

  console.log('\n══ DEAD-STATE ABLATION ══  the live sim against ITSELF, one field perturbed every tick');
  console.log(`   ${MATCHUPS.length} matchups x ${seeds} seeds x ${POLICIES.length} polic${POLICIES.length === 1 ? 'y' : 'ies'}`
    + ` = ${MATCHUPS.length * seeds * POLICIES.length} matches per field per pass, 2 passes`);
  console.log('   FLOOR: EXACT. A field declared DEAD must produce 0 differing ticks; one declared');
  console.log('          LIVE must produce at least one. Both directions are failures.\n');
  console.log('   field                                                      state    events   verdict');

  let faults = 0;
  const t0 = Date.now();
  for (const ab of table) {
    // Two passes: state-only, then state+events. `stopEarly` short-circuits a field we
    // EXPECT to be live — the first divergence answers the question and the remaining
    // matches cost minutes.
    const arenaKey = ab.arena ?? 'shipped';
    const arena = ARENAS[arenaKey];
    const driver = DRIVERS[arenaKey];
    const run = (withEvents) => {
      let divergent = 0, first = null, matches = 0, ticks = 0;
      for (const policy of POLICIES) {
        for (const [p, e] of MATCHUPS) {
          for (let s = 0; s < seeds; s++) {
            const r = lockstepMatch(arena, LIVE, LIVE, driver, p, e, policy, s, undefined, {
              events: withEvents,
              ignore: ab.mask,
              // Perturb B ONLY, after every step, so a field that is overwritten by the sim
              // each tick (the live sighting cell) stays perturbed instead of washing out.
              pin: (_a, b) => ab.perturb(b),
            });
            matches++; ticks += r.tick;
            if (r.diff) {
              divergent++;
              if (!first) first = `${p}>${e} s${s} @${r.tick}: ${r.diff}`;
              const expectLive = (withEvents ? ab.expect.events : ab.expect.state) === 'live';
              if (expectLive) return { divergent, first, matches, ticks, early: true };
            }
          }
        }
      }
      return { divergent, first, matches, ticks, early: false };
    };
    const stateRun = run(false);
    const bothRun = run(true);
    const stateVerdict = stateRun.divergent > 0 ? 'live' : 'dead';
    // "events" here means "anything the state pass did not already see".
    const eventsVerdict = bothRun.divergent > 0 ? 'live' : 'dead';
    const ok = stateVerdict === ab.expect.state && eventsVerdict === ab.expect.events;
    if (!ok) faults++;
    console.log(`   ${ab.name.padEnd(58)} ${stateVerdict.padEnd(8)} ${eventsVerdict.padEnd(8)} `
      + `${ok ? 'OK' : `FAULT — expected ${ab.expect.state}/${ab.expect.events}`}`);
    console.log(`     ${ab.why}`);
    console.log(`     state pass ${stateRun.matches} matches / ${stateRun.ticks.toLocaleString()} ticks, `
      + `${stateRun.divergent} divergent${stateRun.early ? ' (stopped early)' : ''}`
      + `${stateRun.first ? ` — ${stateRun.first}` : ''}`);
    if (eventsVerdict !== stateVerdict) {
      console.log(`     +events   ${bothRun.matches} matches / ${bothRun.ticks.toLocaleString()} ticks, `
        + `${bothRun.divergent} divergent${bothRun.early ? ' (stopped early)' : ''}`
        + `${bothRun.first ? ` — ${bothRun.first}` : ''}`);
    }
  }
  console.log(`\n   ${table.length - faults} of ${table.length} fields matched their declared expectation`
    + `   wall ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(faults > 0 ? 1 : 0);
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
