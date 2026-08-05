#!/usr/bin/env node
/**
 * DRIVER GUARD — the INSTRUMENT side of "the countdown leaves no residue".
 *
 * `src/game/sim.test.mjs` §21 asserts the structural claim on the sim side: nothing in
 * `stepMatch` reads absolute `elapsed`, so the countdown can only translate the clock.
 * That is necessary and it is not sufficient, because the thing that actually re-priced
 * the roster was never in the sim — it was in the DRIVER measuring it.
 *
 * ── The two faults ──────────────────────────────────────────────────────────
 *
 * 1. The scripted player's stuck detector ran during the COUNTDOWN, when
 *    `sim.ts:movePlayer` is not called at all. It read "1.5 s of walking, 0 wu
 *    covered", latched a 900 ms perpendicular detour, and whatever was still latched at
 *    the whistle was walked SIDEWAYS. +567 ms of contact time on a derivable arena.
 *
 * 2. The decision loop DECIDED during the countdown, drawing a fresh `rnd()` for each
 *    reaction interval. `sim.ts` ignores `input` while `phase === 'countdown'`, so those
 *    decisions changed nothing about the match — except that they burned draws, making
 *    the seeded stream at the whistle a function of COUNTDOWN LENGTH. Changing the
 *    countdown therefore re-seeded every match in the ladder, and a paired before/after
 *    stopped being paired. Measured in `tools/tmp/pacing_ladder.mjs`: 38 of 110 matchups
 *    "moved", max |Δ| 50.0 pp, on a change worth +0.01 s of approach.
 *
 * Fault 2 is a general mechanism by which ANY pacing or timing edit can manufacture a
 * large, consistent, reproducible and entirely fictitious balance result. It is not
 * enough to fix it — it has to be impossible to reintroduce quietly.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *
 *   CENSUS     every copy of the driver in `tools/` is registered, and each one is in
 *              the state its registration claims. A SIXTH copy fails the gate.
 *   CADENCE    the decision stream at the whistle is IDENTICAL for a 3.7 s, a 5.7 s and
 *              a 12 s countdown — same offsets, same rnd values, in the same order.
 *   NAV        the stuck detector cannot latch before the whistle.
 *   E2E        through the REAL `stepMatch`, `COUNTDOWN_FROM` 5 vs 3 leaves every match
 *              bit-identical: same winner, same play length, same damage.
 *   DETECTION  the same three checks FAIL when pointed at the historical driver. A guard
 *              that cannot fail on the known-bad input is not a guard (`docs/LESSONS.md`
 *              §13: validate the instrument against a known input first).
 *
 *   node tools/tmp/driver_guard.mjs            # everything (~20 s)
 *   node tools/tmp/driver_guard.mjs --no-e2e   # census + cadence + nav only (~1 s)
 *   node tools/tmp/driver_guard.mjs --strict   # also FAIL on the declared stale copies
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { createScriptedPlayer, rng, DRIVER_REV } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => [a.slice(2), true]));

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else failures.push(`${name}${detail ? `  — ${detail}` : ''}`);
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. CENSUS — every copy of the driver in `tools/`, and what state it is in
// ═════════════════════════════════════════════════════════════════════════════
/**
 * The whole reason this file exists is that the driver was copied. So the registry is
 * the point: a file carrying the nav fingerprint that is NOT here fails the gate, and a
 * registered file that stops matching its own classification fails too.
 *
 *   SHARED              imports `scripted_player.mjs`. The only state to aim for.
 *   INDEPENDENT_FIXED   its own copy, carrying the countdown guard. Owned elsewhere.
 *   GATED_AT_CALLSITE   its own copy with no internal guard, but the driver is never
 *                       CALLED during the countdown, so the fault cannot arise. Both of
 *                       these drive the real browser and gate on the HUD's countdown
 *                       element rather than on `state.phase`.
 *   STALE               its own copy, called during the countdown, defect live. Declared
 *                       debt: listed so it cannot grow silently, and OUTSIDE the file set
 *                       of the pass that wrote this guard. `--strict` fails on these.
 */
const REGISTRY = {
  'tools/tmp/scripted_player.mjs': { state: 'SOURCE' },
  'tools/tmp/arena_probe.mjs': { state: 'SHARED' },
  'tools/tmp/status_census.mjs': { state: 'SHARED' },
  'tools/tmp/roster_table.mjs': { state: 'SHARED' },
  'tools/match-sim.mjs': { state: 'INDEPENDENT_FIXED', guard: "state.phase !== 'playing'" },
  'tools/tmp/pacing_ladder.mjs': { state: 'INDEPENDENT_FIXED', guard: "state.phase !== 'playing'" },
  'tools/tmp/nav_probe.mjs': { state: 'INDEPENDENT_FIXED', guard: "state.phase !== 'playing'" },
  'tools/match-play.mjs': { state: 'GATED_AT_CALLSITE', guard: 'if (inFight) {' },
  'tools/tmp/journey.mjs': { state: 'GATED_AT_CALLSITE', guard: 'if (r.countdown === null) {' },
  /**
   * This file. It carries the fingerprint only as the string it searches FOR.
   * Registered rather than special-cased, so the census stays one rule.
   */
  'tools/tmp/driver_guard.mjs': { state: 'GUARD' },
  /**
   * Appeared WHILE this guard was being written, which is the argument for the guard in
   * one line. A peer needed the settled-matchup count and the rarity roll-up, could not
   * edit the five files this pass owns, and did the only remaining thing: lifted the
   * driver a fourteenth time — from `pacing_ladder.mjs`, so correctly, with both
   * countdown guards. Verified by this census, not assumed. It should import
   * `scripted_player.mjs` once both passes have landed.
   * `optional` because it is untracked: a registry that fails when a peer's scratch
   * probe is deleted is a gate that cries wolf.
   */
  'tools/tmp/roster_lab.mjs': {
    // Born INDEPENDENT_FIXED (lifted from pacing_ladder.mjs, correctly, with both
    // countdown guards), then converted to SHARED by its owner. The row was left stale
    // and was UNREACHABLE either way — which is precisely the dead-branch bug fixed
    // below, in miniature: a SHARED file has no `detourUntil`, so the fingerprint sweep
    // never reached this entry to notice it was misclassified.
    state: 'SHARED', optional: true,
    note: 'peer file, born fixed from pacing_ladder.mjs; now imports the shared driver',
  },
  // ── declared debt, outside this pass's file set ───────────────────────────
  // Converted in 47feb9a. `grep -l detourUntil tools/` now returns 7: the source, this
  // guard, 3 INDEPENDENT_FIXED and 2 GATED_AT_CALLSITE. ZERO STALE COPIES REMAIN.
  'tools/tmp/rules_census.mjs': { state: 'SHARED' },
  'tools/tmp/policy_trace.mjs': { state: 'SHARED' },
  'tools/tmp/audio_census.mjs': { state: 'SHARED' },
  'tools/tmp/audio_mix_record.mjs': { state: 'SHARED' },
  'tools/tmp/audio_shrug_census.mjs': { state: 'SHARED' },
};

/** The nav's own name for its latch. Every copy in this repo has carried it verbatim. */
const FINGERPRINT = 'detourUntil';

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = `${dir}/${e}`;
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') walk(p, out); }
    else if (e.endsWith('.mjs') || e.endsWith('.js')) out.push(p);
  }
  return out;
}

const found = [];
for (const abs of walk(`${ROOT}/tools`)) {
  const rel = relative(ROOT, abs);
  const src = readFileSync(abs, 'utf8');
  if (!src.includes(FINGERPRINT)) continue;
  found.push(rel);
  const reg = REGISTRY[rel];
  ok(`census: ${rel} is a REGISTERED copy of the driver`, !!reg,
    'a new copy of the scripted player appeared. Import tools/tmp/scripted_player.mjs '
    + 'instead, or register it here with a state and a reason.');
  if (!reg) continue;
  if (reg.state === 'INDEPENDENT_FIXED' || reg.state === 'GATED_AT_CALLSITE') {
    ok(`census: ${rel} still carries its countdown guard`, src.includes(reg.guard),
      `expected to find \`${reg.guard}\``);
    if (reg.guard2) {
      ok(`census: ${rel} still guards its DECISION loop too`, src.includes(reg.guard2),
        `expected to find \`${reg.guard2}\``);
    }
  }
}
/**
 * SHARED is checked from the REGISTRY, never from the fingerprint sweep.
 *
 * ⚠️ THIS BRANCH USED TO BE DEAD CODE, and it was dead in the one direction that
 * mattered. The sweep above skips any file without `detourUntil` — and a file that
 * CORRECTLY imports `scripted_player.mjs` does not contain that string. So every
 * properly-converted tool dropped out of the census before its SHARED assertions ran,
 * and `arena_probe`, `status_census` and `roster_table` were never once checked by the
 * guard written to protect them.
 *
 * It was caught by an arithmetic tell rather than a failure: when a peer converted
 * `roster_lab.mjs` mid-pass, the assertion count silently fell 49 → 41. A guard whose
 * coverage SHRINKS when you fix something is measuring the bug, not the property.
 */
for (const [rel, v] of Object.entries(REGISTRY)) {
  if (v.optional && !existsSync(`${ROOT}/${rel}`)) continue;  // untracked peer scratch
  ok(`census: registered file ${rel} exists`, existsSync(`${ROOT}/${rel}`),
    'registered but missing — delete the entry or restore the file');
  if (v.state !== 'SHARED' || !existsSync(`${ROOT}/${rel}`)) continue;
  const src = readFileSync(`${ROOT}/${rel}`, 'utf8');
  ok(`census: ${rel} still imports the shared driver`, src.includes("scripted_player.mjs"),
    'a SHARED tool stopped importing the one driver implementation');
  ok(`census: ${rel} carries no private copy of the nav`, !/function makeNav\s*\(/.test(src),
    'a local makeNav reappeared beside the import');
}
const stale = Object.entries(REGISTRY).filter(([, v]) => v.state === 'STALE').map(([k]) => k);
if (args.strict) for (const rel of stale) ok(`census(strict): ${rel} is fixed`, false, REGISTRY[rel].note);

// ═════════════════════════════════════════════════════════════════════════════
// 2. CADENCE — the decision stream at the whistle must not depend on countdown length
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Pure instrument test: no sim, no arena, no seeds — a fake `state` whose `phase` flips
 * at `whistleMs`. The property under test is exactly the one fault 2 broke, and stating
 * it without the sim is what makes it cheap enough to run every time.
 */
const FAKE_ARENA = { width: 1400, height: 1000, center: { x: 700, y: 500 }, cover: [], hazards: [] };
const FAKE_CHARS = {
  a: { weapons: [{ key: 'w', type: 'ranged', range: 120, damage: 10, cooldown: 800 }] },
};
const REACH_STUB = { rangedMax: 140 };

function cadenceTrace({ whistleMs, decideDuringCountdown, playMs = 10000, dt = 10 }) {
  // Equal PLAYING windows, not equal total ticks — otherwise a longer countdown simply
  // yields fewer decisions and the comparison fails for a reason that is not the fault.
  // `dt` is 10 rather than the tools' 16.667 so every whistle lands EXACTLY on a tick
  // boundary: with a fractional dt the playing window differs by one tick between
  // countdown lengths, which would make this fail for a reason that is not the fault
  // either. The property under test is a property of the driver, not of the step size.
  const ticks = Math.round((whistleMs + playMs) / dt);
  const drv = createScriptedPlayer({
    CHARACTERS: FAKE_CHARS, REACH: REACH_STUB, arena: FAKE_ARENA, decideDuringCountdown,
  });
  const draws = [];
  const seeded = rng(12345);
  const rnd = () => { const v = seeded(); draws.push(v); return v; };
  const decisions = [];
  let elapsed = 0;
  const state = {
    phase: 'countdown', elapsed, safeRadius: 900,
    player: { x: 300, y: 500, characterId: 'a', lastUsed: [-Infinity] },
    enemy: { x: 1100, y: 500, characterId: 'a', lastUsed: [-Infinity] },
  };
  const loop = drv.createDecisionLoop({
    decide: (s) => { decisions.push(Math.round(s.elapsed - whistleMs)); return { move: { x: 0, y: 0 } }; },
    reactBase: 150, reactJit: 60, rnd,
  });
  for (let i = 0; i < ticks; i++) {
    state.phase = elapsed >= whistleMs ? 'playing' : 'countdown';
    state.elapsed = elapsed;
    loop.next(state, dt);
    elapsed += dt;
  }
  return { decisions, draws, stats: loop.stats };
}

for (const decideDuringCountdown of [false, true]) {
  const label = decideDuringCountdown ? 'HISTORICAL' : 'fixed';
  const t = [3700, 5700, 12000].map((whistleMs) => cadenceTrace({ whistleMs, decideDuringCountdown }));
  const same = JSON.stringify(t[0].decisions) === JSON.stringify(t[1].decisions)
    && JSON.stringify(t[1].decisions) === JSON.stringify(t[2].decisions)
    && JSON.stringify(t[0].draws) === JSON.stringify(t[1].draws)
    && JSON.stringify(t[1].draws) === JSON.stringify(t[2].draws);
  if (!decideDuringCountdown) {
    ok('cadence: the decision stream at the whistle is IDENTICAL at 3.7 / 5.7 / 12.0 s of countdown', same,
      `offsets ${t.map((x) => x.decisions.slice(0, 3).join(',')).join('  vs  ')}`);
    for (const [i, x] of t.entries()) {
      ok(`cadence: no decision during a ${[3.7, 5.7, 12.0][i]} s countdown`, x.stats.decisionsInCountdown === 0,
        `${x.stats.decisionsInCountdown} of ${x.stats.decisions}`);
      ok(`cadence: no seeded draw during a ${[3.7, 5.7, 12.0][i]} s countdown`, x.stats.reactDrawsInCountdown === 0,
        `${x.stats.reactDrawsInCountdown} of ${x.stats.reactDraws}`);
    }
  } else {
    // DETECTION. If this ever passes, the check above has stopped being able to fail.
    ok(`detection: the ${label} decision loop DOES re-seed on countdown length`, !same,
      'the historical driver no longer reproduces the fault, so the assertion above proves nothing');
    ok(`detection: the ${label} decision loop decides before the whistle`, t[1].stats.decisionsInCountdown > 0,
      `${t[1].stats.decisionsInCountdown}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. NAV — the stuck detector cannot latch before the whistle
// ═════════════════════════════════════════════════════════════════════════════
/**
 * The player is MOTIONLESS during the countdown by construction, which is precisely the
 * input the detector mistakes for "jammed". Held at a fixed position for 5.7 s, a
 * correct nav must return the straight-line move on every tick; the historical one
 * latches a perpendicular detour and returns something else.
 */
function navTrace({ countdownStuckBug, whistleMs = 5700, ticks = 400, dt = 16.667 }) {
  const drv = createScriptedPlayer({
    CHARACTERS: FAKE_CHARS, REACH: REACH_STUB, arena: FAKE_ARENA, navCountdownBug: countdownStuckBug,
  });
  const nav = drv.makeNav(null);
  const state = {
    phase: 'countdown', elapsed: 0, safeRadius: 900,
    player: { x: 300, y: 500, characterId: 'a', lastUsed: [-Infinity] },
    enemy: { x: 1100, y: 500, characterId: 'a', lastUsed: [-Infinity] },
  };
  const straight = drv.axesToward(300, 500, 1100, 500);
  let deviations = 0, atWhistle = null;
  for (let i = 0; i < ticks; i++) {
    state.elapsed = i * dt;
    state.phase = state.elapsed >= whistleMs ? 'playing' : 'countdown';
    const mv = nav(state, 1100, 500);
    if (state.elapsed < whistleMs && (mv.x !== straight.x || mv.y !== straight.y)) deviations++;
    if (atWhistle === null && state.phase === 'playing') atWhistle = mv;
  }
  return { deviations, atWhistle, straight };
}

{
  const fixed = navTrace({ countdownStuckBug: false });
  ok('nav: never deviates from the straight line during the countdown', fixed.deviations === 0,
    `${fixed.deviations} ticks off-line`);
  ok('nav: the FIRST playing tick walks straight at the target',
    fixed.atWhistle.x === fixed.straight.x && fixed.atWhistle.y === fixed.straight.y,
    `got ${JSON.stringify(fixed.atWhistle)} want ${JSON.stringify(fixed.straight)}`);

  // DETECTION — the historical nav must still reproduce the sideways walk.
  const buggy = navTrace({ countdownStuckBug: true });
  ok('detection: the historical nav DOES latch a detour during the countdown', buggy.deviations > 0,
    'the reproduction flag no longer reproduces anything');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. E2E — through the real `stepMatch`, a countdown change must move NOTHING
// ═════════════════════════════════════════════════════════════════════════════
if (!args['no-e2e']) {
  const ARENA_PATH = `${ROOT}/tools/arena.gameplay.json`;
  if (!existsSync(ARENA_PATH)) {
    ok('e2e: arena dump present', false, `no ${ARENA_PATH}`);
  } else {
    const dirs = {};
    for (const n of [5, 3]) {
      dirs[n] = `/tmp/driver_guard/cd${n}`;
      execFileSync('node', [`${ROOT}/tools/tmp/stage_rules.mjs`, dirs[n], `COUNTDOWN_FROM=${n}`], { stdio: 'ignore' });
    }

    async function ladder(simDir, { navCountdownBug, decideDuringCountdown }) {
      const { createMatch, stepMatch } = await import(`${simDir}/game/sim.ts`);
      const RULES = await import(`${simDir}/game/rules.ts`);
      const { CHARACTERS, CHARACTER_IDS, MATCH_DURATION_MS, REACH } = RULES;
      const A = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
      const HALF = Math.hypot(A.width / 2, A.height / 2);
      const arena = {
        ...A,
        maxSafeRadius: Math.round(HALF / (1 - 6000 / MATCH_DURATION_MS)),
        build: () => null, update: () => {},
      };
      const drv = createScriptedPlayer({
        CHARACTERS, REACH, arena, hazard: arena.hazards.find((h) => h.kind === 'damage'),
        navCountdownBug, decideDuringCountdown,
      });
      const out = {};
      for (const p of CHARACTER_IDS) for (const e of CHARACTER_IDS) {
        if (p === e) continue;
        const seed = 1;
        const rnd = rng(seed * 7919 + p.length * 131 + e.length * 17 + 'smart2'.length);
        const state = createMatch(arena, p, e);
        const loop = drv.createDecisionLoop({
          decide: drv.POLICY_FNS.smart2(rnd), reactBase: 150, reactJit: 60, rnd,
        });
        let winner = null, dealt = 0;
        const CAP = MATCH_DURATION_MS * 1.6 + 20000;
        while (state.phase !== 'ended' && state.elapsed < CAP) {
          const evs = stepMatch(state, 16.667, loop.next(state, 16.667));
          for (const ev of evs) {
            if (ev.type === 'match-ended') winner = ev.winner;
            else if (ev.type === 'hit-landed') dealt += ev.amount;
          }
        }
        // The MATCH CLOCK, not `elapsed` — `elapsed` carries the countdown by definition
        // and comparing it across countdown lengths would be a tautology, not a test.
        out[`${p}>${e}`] = `${winner}|${Math.round(MATCH_DURATION_MS - state.timeRemaining)}|${dealt}`;
      }
      return out;
    }

    const diff = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

    const fixed5 = await ladder(dirs[5], { navCountdownBug: false, decideDuringCountdown: false });
    const fixed3 = await ladder(dirs[3], { navCountdownBug: false, decideDuringCountdown: false });
    const moved = diff(fixed5, fixed3);
    ok('e2e: COUNTDOWN_FROM 5 -> 3 moves 0 of 110 matchups through the real stepMatch',
      moved.length === 0, `${moved.length} moved: ${moved.slice(0, 5).join(', ')}`);

    // DETECTION — the historical driver must still manufacture the artefact, or the
    // assertion above is only proving that nothing is being measured.
    const hist5 = await ladder(dirs[5], { navCountdownBug: true, decideDuringCountdown: true });
    const hist3 = await ladder(dirs[3], { navCountdownBug: true, decideDuringCountdown: true });
    const histMoved = diff(hist5, hist3);
    ok('detection: the HISTORICAL driver manufactures a countdown "balance result"',
      histMoved.length > 0, 'the reproduction flags no longer reproduce the artefact');
    console.log(`\n  e2e · fixed driver: ${moved.length}/110 matchups moved on COUNTDOWN_FROM 5 -> 3`);
    console.log(`  e2e · historical driver: ${histMoved.length}/110 moved on the SAME edit — every one of them RNG alignment, not the game\n`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// report
// ═════════════════════════════════════════════════════════════════════════════
console.log(`── DRIVER CENSUS ── ${found.length} copies of the scripted player in tools/`);
for (const [rel, v] of Object.entries(REGISTRY)) {
  const mark = { SOURCE: '★', GUARD: '☆', SHARED: '✓', INDEPENDENT_FIXED: '✓', GATED_AT_CALLSITE: '✓', STALE: '✗' }[v.state];
  console.log(`  ${mark} ${v.state.padEnd(18)} ${rel}${v.note ? `   ${v.note}` : ''}`);
}
if (stale.length) {
  console.log(`\n  ⚠️ ${stale.length} STALE copies remain.`);
  console.log(`     They are LISTED so the debt cannot grow silently; \`--strict\` fails on them.`);
  console.log(`     Every figure they have printed carries the countdown detour.`);
}

for (const f of failures) console.log(`  FAIL ${f}`);
console.log(`\ndriver_guard: ${pass} passed, ${failures.length} failed  (driver rev ${DRIVER_REV})\n`);
process.exit(failures.length ? 1 : 0);
