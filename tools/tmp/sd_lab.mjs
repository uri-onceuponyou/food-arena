#!/usr/bin/env node
/**
 * SD LAB — the acceptance instrument for SUDDEN DEATH (`DECISIONS §2`).
 *
 * > Uri, 2026-08-11: *"no. after 30 seconds reduce the fog to all screen and the one who
 * > has more HP wins. (Sudden Death)"*
 *
 * Three arms, three different floors, because the three claims fail for different reasons.
 *
 * ── `--bitid` — WHAT DID **NOT** CHANGE. Floor: EXACT, 0 differing ticks. ────
 *
 * Sudden death is a deliberate behaviour change from `SUDDEN_DEATH_MS` onward, and it must
 * be **nothing at all** before that. So the claim this arm proves is stated precisely and is
 * narrower than "bit-identical":
 *
 *   **Every tick with `timeRemaining > SUDDEN_DEATH_REMAINING_MS` is identical to the
 *   `--sim-ref` build over the WHOLE state and the returned `GameEvent[]` IN ORDER; and
 *   every match that ends before the trigger is identical end to end.**
 *
 * Matches that reach the trigger are counted and reported separately with what changed —
 * they are the feature, not a regression, and conflating the two would hide either.
 *
 * ⚠️ **THE COUNTDOWN-RESEED TRAP, ANSWERED.** `driver_guard.mjs` exists because a pacing
 * edit once re-seeded every match in the ladder and manufactured a 50 pp "balance result".
 * This change is **outside the seeded path**: the trigger is keyed off `state.timeRemaining`,
 * which is `MATCH_DURATION_MS` for the whole countdown and starts counting at the whistle,
 * so no decision, no rng draw and no reaction offset moves. The first 30 s of play are
 * bit-identical, which is what this arm measures rather than argues.
 *
 * ── `--census` — HOW OFTEN IT FIRES, AND WHAT IT DECIDES. Floor: paired, exact. ──
 *
 * The whole roster through the shared scripted driver. Reports the share of matches that
 * reach 30 s at all, the share `resolveTimeout` still resolves (target: zero), and — on the
 * matches sudden death decides — whether the fighter with more HP at the trigger won.
 *
 * ── `--selftest` — THE KNOWN-BADS. Floor: every row must go RED. ────────────
 *
 * 🚨 **AN UNREACHABILITY ASSERTION IS THE EASIEST KIND TO WRITE TAUTOLOGICALLY.** "The
 * timeout never fires" passes for a fixture that could never have reached it. So every
 * assertion `sim.test.mjs` §30 makes is re-run here against a sim with exactly one line
 * changed, and is REQUIRED to fail. Each patch is checked to have actually applied — a
 * `String.replace` that silently matched nothing is a control that passes for the wrong
 * reason, which is the single most common way an instrument in this repo has lied.
 *
 *   node tools/tmp/sd_lab.mjs --selftest
 *   node tools/tmp/sd_lab.mjs --bitid --seeds 8
 *   node tools/tmp/sd_lab.mjs --bitid --seeds 32 --sim-ref <sha>
 *   node tools/tmp/sd_lab.mjs --census --seeds 8
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
// Two sims side by side
//
// Lifted from `conceal_lab.mjs` / `match-sim.mjs`, deliberately and unchanged in shape:
// `git stash` is forbidden here and a checkout would clobber every peer, so extraction into
// the OS temp dir is the only safe freeze. Writing OUTSIDE the repo is also deliberate — a
// scratch tree of `.ts` under `tools/` is inside `tsconfig.json`'s include and would turn
// `npx tsc --noEmit` red for everyone at once.
//
// ⚠️ The LIVE side reads the WORKING TREE, which is correct (it is the change under test)
// and is only sound while no peer is mid-edit in one of these six files. `--bitid` prints
// `git status --porcelain` for exactly them so the run says so rather than assuming it.
// ─────────────────────────────────────────────────────────────────────────────

const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];

function extractSimAt(ref) {
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: ROOT, encoding: 'utf8' }).trim();
  const root = join(tmpdir(), `fa-sd-simref-${sha}`);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'game'), { recursive: true });
  mkdirSync(join(root, 'arena'), { recursive: true });
  for (const f of SIM_MODULES) {
    writeFileSync(join(root, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
  }
  writeFileSync(join(root, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
  return { dir: join(root, 'game'), sha };
}

/**
 * The working tree's sim with one or more literal source edits applied — the shape every
 * known-bad below takes. `applied` is per-edit booleans so the caller ASSERTS the patch
 * landed instead of assuming it.
 */
function patchedSimDir(tag, edits) {
  const root = join(tmpdir(), `fa-sd-${tag}`);
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
const {
  CHARACTER_IDS, MATCH_DURATION_MS, SUDDEN_DEATH_MS, SUDDEN_DEATH_REMAINING_MS,
  FOG_DAMAGE, AI_SELF_HEAL_HP_FRACTION,
} = LIVE.RULES;

// ─────────────────────────────────────────────────────────────────────────────
// Arena — the ring is DERIVED, never read from the cache
//
// `arena/shared.ts` derives `maxSafeRadius` from `MATCH_DURATION_MS`, so a dump goes stale
// the moment the clock moves. Recomputed here from the same formula, identical to
// `conceal_lab.mjs` and `roster_lab.mjs`, so a row here is the same match as a row there.
// ─────────────────────────────────────────────────────────────────────────────

const ARENA_PATH = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);
const ARENA_DATA = existsSync(ARENA_PATH) ? JSON.parse(readFileSync(ARENA_PATH, 'utf8')) : null;
const FOG_FIRST_CONTACT_MS = 6000;
const BASE_ARENA = ARENA_DATA ? {
  ...ARENA_DATA,
  maxSafeRadius: Math.round(
    Math.hypot(ARENA_DATA.width / 2, ARENA_DATA.height / 2) / (1 - FOG_FIRST_CONTACT_MS / MATCH_DURATION_MS),
  ),
  build: () => null,
  update: () => {},
} : null;

/** A bare synthetic arena: no cover, no hazards, so a fixture's only damage source is the fog. */
const plainArena = (maxSafeRadius = 993, width = 3000, height = 3000) => ({
  id: 'sd_plain',
  displayName: 'sd plain',
  width,
  height,
  center: { x: width / 2, y: height / 2 },
  maxSafeRadius,
  playerSpawn: { x: width / 2 - 200, y: height / 2 },
  enemySpawn: { x: width / 2 + 200, y: height / 2 },
  cover: [],
  hazards: [],
  build: () => null,
  update: () => {},
});

const DT = Number(args.dt ?? 16.667);
const SEEDS = Number(args.seeds ?? 8);
const POLICIES = String(args.policies ?? 'smart2').split(',');
const DRIVER_FLAGS = parseDriverFlags(args);

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok - ${name}`); }
  else { failures.push(`${name}${detail ? `  — ${detail}` : ''}`); console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

// ─────────────────────────────────────────────────────────────────────────────
// THE DIFFER — a generic deep walk, not a hand-written field list
//
// A hand-written list is exactly as complete as whoever typed it, and the field it forgets
// is the field a divergence hides in. A deep walk covers a field the moment the sim gains
// one. `arena` is excluded (both sims are handed the SAME object and neither mutates it);
// functions are excluded (`build`/`update` are not state).
// ─────────────────────────────────────────────────────────────────────────────

function comparable(state) {
  const out = {};
  for (const k of Object.keys(state)) {
    if (k === 'arena') continue;
    if (typeof state[k] === 'function') continue;
    out[k] = state[k];
  }
  return out;
}

function firstDiff(a, b, path) {
  if (a === b) return null;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return `${path}: type ${ta} vs ${tb}`;
  if (ta === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return null;
    return `${path}: ${a} vs ${b}`;
  }
  if (a === null || b === null) return `${path}: ${a} vs ${b}`;
  if (ta !== 'object') return `${path}: ${a} vs ${b}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (!(k in a) || !(k in b)) return `${path}.${k}: present in only one state`;
    if (typeof a[k] === 'function' && typeof b[k] === 'function') continue;
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// The driver — SHARED, never copied (`driver_guard.mjs`'s census)
// ─────────────────────────────────────────────────────────────────────────────

const driverFor = (arena) => createScriptedPlayer({
  CHARACTERS: LIVE.RULES.CHARACTERS,
  REACH: LIVE.RULES.REACH,
  arena,
  pressValue: LIVE.pressValue,
  selfHealHpFraction: AI_SELF_HEAL_HP_FRACTION,
  ...DRIVER_FLAGS,
});

const MATCHUPS = (() => {
  const out = [];
  for (const a of CHARACTER_IDS) for (const b of CHARACTER_IDS) if (a !== b) out.push([a, b]);
  return out;
})();

/**
 * ONE DRIVER, TWO SIMS, ONE INPUT OBJECT PER TICK — and the comparison STOPS at the trigger.
 *
 * The driver is held outside the thing under test: decisions are computed from sim A's
 * state and the identical `MatchInput` is handed to both, so the first tick on which the two
 * disagree is attributable to `src/game/**` and to nothing else.
 *
 * ⚠️ **THE WINDOW IS THE WHOLE POINT.** Comparing past the trigger would report every long
 * match as divergent, which is true and useless: the divergence there IS the feature. So the
 * walk runs while `timeRemaining > SUDDEN_DEATH_REMAINING_MS` on the LIVE state and reports
 * `reachedTrigger` separately. A match that ends before the trigger is compared end to end.
 */
function lockstepToTrigger(arena, simA, simB, driver, playerId, enemyId, policy, seed) {
  // Seed formula is `roster_lab.mjs`'s, unchanged — that is what makes a row here the SAME
  // match as a row there.
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + policy.length);
  const stateA = simA.createMatch(arena, playerId, enemyId);
  const stateB = simB.createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20000;
  let tick = 0;
  let comparedTicks = 0;
  let events = 0;
  let reachedTrigger = false;
  while (stateA.phase !== 'ended' && stateA.elapsed < HARD_CAP) {
    const input = loop.next(stateA, DT);
    const evA = simA.stepMatch(stateA, DT, input);
    const evB = simB.stepMatch(stateB, DT, input);
    tick++;
    events += evA.length;
    // ⚠️ THE TEST IS **AFTER** THE STEP, AND IT WAS BEFORE IT FIRST. A step that CROSSES the
    // trigger produces the first collapsed tick, and a pre-step guard compares it: the first
    // run reported 220 of 220 divergent at tick 2020 on `safeRadius: 0 vs 661.64` — the
    // feature, reported as a regression, with `reachedTrigger` stuck at 0 because the diff
    // returned before the guard ever fired. The boundary tick belongs to sudden death.
    if (stateA.timeRemaining <= SUDDEN_DEATH_REMAINING_MS) {
      reachedTrigger = true;
      break;
    }
    let d = firstDiff(comparable(stateA), comparable(stateB), 'state');
    if (!d) d = firstDiff(evA, evB, 'events');
    comparedTicks++;
    if (d) return { tick, comparedTicks, events, diff: d, reachedTrigger };
  }
  if (!reachedTrigger) {
    const d = firstDiff(comparable(stateA), comparable(stateB), 'state');
    if (d) return { tick, comparedTicks, events, diff: d, reachedTrigger };
  }
  return { tick, comparedTicks, events, diff: null, reachedTrigger, winner: stateA.winnerId, playMs: MATCH_DURATION_MS - stateA.timeRemaining };
}

// ─────────────────────────────────────────────────────────────────────────────
// The frozen sudden-death fixture — the same one `sim.test.mjs` §30 uses
//
// Every fighter rooted, every weapon on an unreachable cooldown, `maxHp === hp` so regen
// cannot top anyone up, no hazards, and everyone the same distance from the centre so
// `resolveTimeout`'s rungs 1-3 all tie if it ever runs.
//
// 🚨 **THE 100 wu STAND RADIUS IS THE WHOLE COUNTERFACTUAL AND IT WAS 300 FIRST.** At 300
// the fixture resolves without sudden death too — the legacy ring passes 300 wu at 31.4 s
// and burns them anyway — so the `nocollapse` and `latetrigger` known-bads BOTH came back
// green, i.e. the control failed to be a control. 100 wu is inside `MIN_SAFE_RADIUS` (140),
// so under the pre-§2 rule these fighters sit in the permanent safe annulus for the whole
// match and the clock is the only thing that can end it. Measured, not reasoned: the two
// rows went red the moment the radius moved.
//
// It lives here as well as in the unit suite because a known-bad needs to run it against a
// PATCHED sim, which the unit suite cannot do.
// ─────────────────────────────────────────────────────────────────────────────

function suddenDeathRun(sim, hps, { centre = false } = {}) {
  const arena = plainArena(993);
  const N = hps.length;
  const R = 100;
  const state = sim.createMatch(arena, hps.map((_, i) => ({
    characterId: 'hamburger',
    spawn: centre ? { x: arena.center.x, y: arena.center.y } : {
      x: arena.center.x + R * Math.cos((i / N) * Math.PI * 2),
      y: arena.center.y + R * Math.sin((i / N) * Math.PI * 2),
    },
  })));
  state.phase = 'playing';
  state.fighters.forEach((f, i) => {
    f.hp = f.maxHp = hps[i];
    f.status.stunnedUntil = state.elapsed + 1e9;
    f.lastUsed = f.lastUsed.map(() => Infinity);
  });
  const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  // ⚠️ Bound derived from the clock. A 500-tick loop once ran 50 s of a 45 s match and froze
  // `safeRadius`, so a row passed against the bug it named. `capped` is returned.
  const maxTicks = Math.ceil((MATCH_DURATION_MS + 2000) / DT);
  let ticks = 0;
  let deaths = 0;
  while (state.phase === 'playing' && ticks < maxTicks) {
    for (const e of sim.stepMatch(state, DT, noInput)) if (e.type === 'death') deaths++;
    ticks++;
  }
  return {
    state,
    winnerId: state.winnerId,
    deaths,
    capped: ticks >= maxTicks,
    timedOut: state.phase === 'ended' && state.fighters.every((f) => f.alive),
    winnerAlive: state.winnerId === null ? null : state.fighters[state.winnerId].alive,
    playMs: MATCH_DURATION_MS - state.timeRemaining,
  };
}

/** The four claims §30 makes, as booleans, so a known-bad can be required to break one. */
function claims(sim) {
  let moreHpWins = 0;
  for (let gap = 1; gap < FOG_DAMAGE; gap++) {
    if (suddenDeathRun(sim, [100, 100 - gap]).winnerId === 0
      && suddenDeathRun(sim, [100 - gap, 100]).winnerId === 1) moreHpWins++;
  }
  // BOTH DIRECTIONS AT SIX SEATS, and the second one is the whole row: with the ladder
  // ascending, the most-HP fighter is ALSO the highest slot, so a pass that walked slots
  // instead of HP would still answer 5 and the row would pass against the bug it names.
  const sixUp = suddenDeathRun(sim, [90, 91, 92, 93, 94, 95]);
  const sixDown = suddenDeathRun(sim, [95, 94, 93, 92, 91, 90]);
  const duel = suddenDeathRun(sim, [100, 93]);
  const big = suddenDeathRun(sim, [238, 231]);
  // One fog tick is `FOG_DAMAGE`; the loser of the duel holds 93, so a single-burn sim needs
  // `ceil(93 / 15)` = 7 ticks and cannot possibly finish before 6 of them have elapsed. A
  // sim burning twice per tick finishes in 4. Derived, so the bound moves with the constant.
  const singleBurnFloorMs = SUDDEN_DEATH_MS + (Math.ceil(93 / FOG_DAMAGE) - 1) * LIVE.RULES.FOG_TICK_MS;
  return {
    /** (b) the fighter with more HP wins at every gap inside one fog tick, in both slots */
    moreHpWins: moreHpWins === FOG_DAMAGE - 1,
    moreHpWinsN: moreHpWins,
    /** (b) at six seats too, with the HP ladder running BOTH ways up the slots */
    sixMoreHpWins: sixUp.winnerId === 5 && sixDown.winnerId === 0,
    /** (c) `resolveTimeout` is unreachable */
    noTimeout: !duel.timedOut && !big.timedOut && !sixUp.timedOut && !duel.capped && !big.capped,
    /** the match ends in the sudden-death window rather than at the clock */
    endsEarly: duel.playMs >= SUDDEN_DEATH_MS && duel.playMs < SUDDEN_DEATH_MS + 4900,
    /** the fog burns ONCE per tick — the `applyWorldTick` guard is doing its job */
    burnRate: duel.playMs >= singleBurnFloorMs,
    /** the winner is alive — the pass stops when the match is decided */
    winnerAlive: sixUp.winnerAlive === true && sixUp.deaths === 5,
    detail: `moreHpWins ${moreHpWins}/${FOG_DAMAGE - 1}, six→${sixUp.winnerId}/${sixDown.winnerId} `
      + `(${sixUp.deaths}d, alive=${sixUp.winnerAlive}), duel ${duel.playMs.toFixed(0)}ms `
      + `(single-burn floor ${singleBurnFloorMs}) timedOut=${duel.timedOut}`,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════

async function selftest() {
  console.log(`SD LAB --selftest  (driver rev ${DRIVER_REV})\n`);

  console.log('A. The live sim satisfies every claim §30 makes');
  const live = claims(LIVE);
  ok('LIVE: the fighter with MORE HP wins at every gap inside one fog tick, in both slots', live.moreHpWins, live.detail);
  ok('LIVE: …at six seats too', live.sixMoreHpWins, live.detail);
  ok('LIVE: `resolveTimeout` is never reached', live.noTimeout, live.detail);
  ok('LIVE: the match ends inside the sudden-death window, not at the clock', live.endsEarly, live.detail);
  ok('LIVE: the fog burns exactly once per tick', live.burnRate, live.detail);
  ok('LIVE: the declared winner is still alive', live.winnerAlive, live.detail);

  // Each known-bad names the ONE line it changes, the claim it must break, and the claims it
  // must LEAVE ALONE — a patch that breaks everything proves nothing about which row is load
  // bearing.
  const BADS = [
    {
      name: 'THE COLLAPSE REMOVED — `safeRadius` keeps the old floored schedule',
      tag: 'nocollapse',
      edits: [['sim.ts',
        'state.safeRadius = suddenDeathActive(state.timeRemaining)\n      ? SUDDEN_DEATH_RADIUS\n      : Math.max(',
        'state.safeRadius = false\n      ? SUDDEN_DEATH_RADIUS\n      : Math.max(']],
      // With no collapse the frozen fixture stands inside the floored ring for the whole
      // match, takes no fog at all, and the clock decides — which is exactly the state
      // §30(c) asserts is unreachable.
      mustBreak: ['noTimeout', 'endsEarly'],
    },
    {
      name: 'THE ORDER REMOVED — the sudden-death fog walks slots instead of HP',
      tag: 'slotorder',
      edits: [['sim.ts',
        'const order = state.fighters.slice().sort((a, b) => (a.hp !== b.hp ? a.hp - b.hp : b.id - a.id));',
        'const order = state.fighters.slice();']],
      // Every fighter inside one fog quantum dies on the same tick, so the survivor is
      // whoever the walk reaches LAST — the highest slot, not the highest HP.
      mustBreak: ['moreHpWins', 'sixMoreHpWins'],
    },
    {
      name: 'THE TIE-BREAK REVERSED — equal HP sorted by ASCENDING id',
      tag: 'tieasc',
      edits: [['sim.ts',
        '(a.hp !== b.hp ? a.hp - b.hp : b.id - a.id)',
        '(a.hp !== b.hp ? a.hp - b.hp : a.id - b.id)']],
      // Only the EXACTLY-level case moves, so "more HP wins" survives. This is the row that
      // proves the tie-break rung is separately load-bearing rather than along for the ride.
      mustBreak: [],
      mustHold: ['moreHpWins', 'sixMoreHpWins', 'noTimeout'],
      extra: (sim) => {
        const level = suddenDeathRun(sim, [100, 100]);
        return { name: 'and the exactly-level duel now goes to the HIGHER slot', broken: level.winnerId === 1, detail: `winner ${level.winnerId}` };
      },
    },
    {
      name: 'THE STOP REMOVED — the fog keeps burning after the match is decided',
      tag: 'nostop',
      edits: [['sim.ts', "    if (state.phase !== 'playing') break;\n", '']],
      // The declared winner dies in the same tick it wins, and `state.winner` names a corpse.
      mustBreak: ['winnerAlive'],
      mustHold: ['moreHpWins', 'noTimeout'],
    },
    {
      name: 'THE DOUBLE-BURN GUARD REMOVED — `applyWorldTick` keeps its own fog pass',
      tag: 'doubleburn',
      edits: [['sim.ts',
        '  if (suddenDeathActive(state.timeRemaining)) return;\n  const distFromCenter =',
        '  const distFromCenter =']],
      // ⚠️ THIS ROW USED TO NAME `moreHpWins`, AND IT CAME BACK GREEN. The duplicate pass
      // runs inside the fighter loop, i.e. BEFORE `applySuddenDeathFog`, so the ordered pass
      // still gets the last word on the killing tick and the outcome guarantee survives. The
      // defect the guard actually prevents is DOUBLE DAMAGE, so that is what the row asserts:
      // the burn-down halves, 7 fog ticks becoming 4. Naming the wrong consequence is how a
      // known-bad quietly stops being one.
      mustBreak: ['burnRate'],
      mustHold: ['noTimeout'],
    },
    {
      name: 'THE TRIGGER PUSHED PAST THE CLOCK — SUDDEN_DEATH_MS = 60 s',
      tag: 'latetrigger',
      edits: [['rules.ts', 'export const SUDDEN_DEATH_MS = 30_000;', 'export const SUDDEN_DEATH_MS = 60_000;']],
      // The constant, not the code: a schedule change alone must be able to put the timeout
      // back in reach, which is why §30 asserts the window against the burn-down rather than
      // asserting "no timeout" on its own.
      mustBreak: ['noTimeout', 'endsEarly'],
    },
  ];

  console.log('\nB. KNOWN-BADS — every one must break the claim it names, and only that claim');
  for (const bad of BADS) {
    const { dir, applied } = patchedSimDir(bad.tag, bad.edits);
    ok(`[${bad.tag}] the patch APPLIED (a replace that matched nothing is not a control)`,
      applied.every(Boolean), `applied ${applied.join(',')}`);
    if (!applied.every(Boolean)) continue;
    const sim = await loadSim(dir);
    const c = claims(sim);
    for (const claim of bad.mustBreak) {
      ok(`[${bad.tag}] BREAKS \`${claim}\` — ${bad.name}`, c[claim] === false, c.detail);
    }
    for (const claim of bad.mustHold ?? []) {
      ok(`[${bad.tag}] …and LEAVES \`${claim}\` alone`, c[claim] === true, c.detail);
    }
    if (bad.extra) {
      const e = bad.extra(sim);
      ok(`[${bad.tag}] ${e.name}`, e.broken, e.detail);
    }
  }

  // ── C. THE DIFFER ITSELF ──────────────────────────────────────────────────
  //
  // `--bitid` is only worth its tick count if the walk can see a change. Every mutable field
  // of a real match is enumerated FROM the match rather than from a list someone typed, and
  // each one is perturbed in turn.
  console.log('\nC. The differ sees every field of a real match, and the event stream in order');
  {
    const arena = plainArena(993);
    const st = LIVE.createMatch(arena, 'hamburger', 'donut');
    for (let i = 0; i < 400; i++) LIVE.stepMatch(st, DT, { move: { x: 1, y: 0 }, selectedWeapon: 0, attack: true });
    const base = comparable(st);
    ok('the perturbation corpus is non-vacuous (a real mid-match state)',
      st.phase === 'playing' && st.projectiles !== undefined, `phase ${st.phase}`);
    const paths = [];
    const walk = (v, p) => {
      if (v === null || typeof v !== 'object') { paths.push(p); return; }
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${p}[${i}]`)); return; }
      for (const k of Object.keys(v)) { if (typeof v[k] === 'function') continue; walk(v[k], `${p}.${k}`); }
    };
    walk(base, 'state');
    let caught = 0;
    for (const p of paths) {
      const clone = structuredClone(base);
      // eslint-disable-next-line no-new-func
      const get = new Function('s', `return ${p.replace(/^state/, 's')};`);
      const set = new Function('s', 'v', `${p.replace(/^state/, 's')} = v;`);
      const v = get(clone);
      const nv = typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : typeof v === 'string' ? `${v}!` : v === null ? 0 : v;
      if (nv === v) continue;
      set(clone, nv);
      if (firstDiff(base, clone, 'state') !== null) caught++;
      else failures.push(`differ MISSED a perturbation at ${p}`);
    }
    ok(`the differ catches a one-field perturbation at every one of ${paths.length} paths`,
      caught > 0 && failures.every((f) => !f.startsWith('differ MISSED')), `${caught} caught of ${paths.length} paths`);
    // KNOWN-BAD for the differ's ORDER sensitivity: same multiset, different order.
    const evA = [{ type: 'hit-landed' }, { type: 'death' }];
    const evB = [{ type: 'death' }, { type: 'hit-landed' }];
    ok('KNOWN-BAD: the differ fails a REORDERED event stream, not just a changed one',
      firstDiff(evA, evB, 'events') !== null);
    ok('…and passes an identical one', firstDiff(evA, structuredClone(evA), 'events') === null);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// --bitid
// ═════════════════════════════════════════════════════════════════════════════

async function bitid() {
  const ref = String(args['sim-ref'] ?? 'HEAD');
  const { dir, sha } = extractSimAt(ref);
  const BASE = await loadSim(dir);
  if (!BASE_ARENA) { console.log(`no arena at ${ARENA_PATH}`); process.exit(1); }

  // The LIVE side is the working tree. Say so, with the evidence, rather than assuming it.
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...SIM_MODULES.map((f) => `src/game/${f}`), 'src/arena/types.ts'], { cwd: ROOT, encoding: 'utf8' }).trim();
  console.log(`SD LAB --bitid   live = working tree, base = ${ref} (${sha})`);
  console.log(`  compared modules dirty in the working tree:\n${dirty ? dirty.split('\n').map((l) => `    ${l}`).join('\n') : '    (only the files this pass owns — see the report)'}`);
  console.log(`  window: every tick with timeRemaining > ${SUDDEN_DEATH_REMAINING_MS} ms (= play < ${SUDDEN_DEATH_MS} ms)\n`);

  let matches = 0;
  let ticks = 0;
  let events = 0;
  let reached = 0;
  const diffs = [];
  for (const policy of POLICIES) {
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const [p, e] of MATCHUPS) {
        const r = lockstepToTrigger(BASE_ARENA, LIVE, BASE, driverFor(BASE_ARENA), p, e, policy, seed);
        matches++;
        ticks += r.comparedTicks;
        events += r.events;
        if (r.reachedTrigger) reached++;
        if (r.diff) diffs.push(`${p}>${e} seed ${seed} ${policy} @tick ${r.tick}: ${r.diff}`);
      }
    }
  }
  console.log(`  ${matches} matches · ${ticks.toLocaleString()} ticks compared · ${events.toLocaleString()} events in order`);
  console.log(`  ${reached} of ${matches} (${((reached / matches) * 100).toFixed(1)}%) reached the ${SUDDEN_DEATH_MS / 1000} s trigger`
    + ` — those are the feature, and are NOT compared past it`);
  ok('0 divergent ticks before the trigger', diffs.length === 0, diffs.slice(0, 5).join(' | '));
  ok('the corpus is not vacuous — matches ended before the trigger AND matches reached it',
    reached > 0 && reached < matches, `${reached}/${matches}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// --census
// ═════════════════════════════════════════════════════════════════════════════

async function census() {
  if (!BASE_ARENA) { console.log(`no arena at ${ARENA_PATH}`); process.exit(1); }
  console.log('SD LAB --census   how often sudden death fires, and what it decides\n');
  const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  let matches = 0;
  let reached = 0;
  let timeouts = 0;
  let moreHpWon = 0;
  let decided = 0;
  let ties = 0;
  let instant = 0;
  const playMs = [];
  for (const policy of POLICIES) {
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const [p, e] of MATCHUPS) {
        const rnd = rng(seed * 7919 + p.length * 131 + e.length * 17 + policy.length);
        const st = LIVE.createMatch(BASE_ARENA, p, e);
        const driver = driverFor(BASE_ARENA);
        const loop = driver.createDecisionLoop({ decide: driver.POLICY_FNS[policy](rnd), reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
        // ⚠️ HP IS SAMPLED BEFORE EVERY STEP, NOT AFTER THE CROSSING ONE — and the first
        // draft sampled after, behind a `phase === 'playing'` guard. Two things are wrong
        // with that and they pull in opposite directions. The collapse fires a fog tick on
        // the CROSSING tick itself (`floor(since/300)` goes -1 -> 0), so a fighter already
        // under `FOG_DAMAGE` dies on the instant sudden death begins and the match is
        // `ended` when the guard looks — those matches were dropped from `reached`
        // entirely, reporting 1.5% against `--bitid`'s 5.0% on the identical 880. And the
        // HP read after that tick is post-fog, not "at the trigger". Sampling the state
        // that goes INTO the crossing step fixes both.
        let hpAtTrigger = null;
        let endedOnCollapse = false;
        const cap = Math.ceil((MATCH_DURATION_MS * 1.6 + 20000) / DT);
        let t = 0;
        while (st.phase !== 'ended' && t < cap) {
          const hpBefore = st.fighters.map((f) => f.hp);
          LIVE.stepMatch(st, DT, loop.next(st, DT));
          t++;
          if (hpAtTrigger === null && st.timeRemaining <= SUDDEN_DEATH_REMAINING_MS) {
            hpAtTrigger = hpBefore;
            endedOnCollapse = st.phase === 'ended';
          }
        }
        matches++;
        if (hpAtTrigger !== null) {
          reached++;
          if (endedOnCollapse) instant++;
          playMs.push(MATCH_DURATION_MS - st.timeRemaining);
          const best = Math.max(...hpAtTrigger);
          const leaders = hpAtTrigger.map((h, i) => (h === best ? i : -1)).filter((i) => i >= 0);
          if (leaders.length > 1) ties++;
          else { decided++; if (st.winnerId === leaders[0]) moreHpWon++; }
        }
        if (st.phase === 'ended' && st.fighters.every((f) => f.alive)) timeouts++;
      }
    }
  }
  const mean = playMs.length ? playMs.reduce((a, b) => a + b, 0) / playMs.length : 0;
  console.log(`  ${matches} matches`);
  console.log(`  reached the trigger : ${reached} (${((reached / matches) * 100).toFixed(1)}%)`);
  console.log(`  mean end of those   : ${(mean / 1000).toFixed(2)} s of play (trigger at ${(SUDDEN_DEATH_MS / 1000).toFixed(0)} s)`);
  console.log(`  ended ON the collapse: ${instant} — a fighter already under ${FOG_DAMAGE} HP dies on the instant`);
  console.log(`  resolveTimeout fired: ${timeouts}`);
  console.log(`  HP leader won       : ${moreHpWon}/${decided} decided (${ties} tied on HP at the trigger)`);
  ok('`resolveTimeout` fired on no real match', timeouts === 0, `${timeouts} timeouts`);
  ok('the census is not vacuous — sudden death actually fires', reached > 0, `${reached}/${matches}`);
  // ⚠️ NOT 100% BY CONSTRUCTION, AND THAT IS CORRECT. Weapons keep working during sudden
  // death, so a fighter can be shot from ahead — see `applySuddenDeathFog`'s stated
  // guarantee, which is about the FOG and not about the match.
  console.log(`\n  ⚠️ "HP leader won" is NOT expected to be 100%: combat continues during sudden death,`);
  console.log('     so a fighter who is behind can still shoot its way back. The exact claim is the');
  console.log('     fog one, and `--selftest` is where it is proved.');
}

const mode = args.selftest ? selftest : args.bitid ? bitid : args.census ? census : null;
if (!mode) {
  console.log('usage: sd_lab.mjs --selftest | --bitid [--sim-ref <sha>] [--seeds N] | --census [--seeds N]');
  process.exit(1);
}
await mode();
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
