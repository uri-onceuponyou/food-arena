#!/usr/bin/env node
/**
 * MATCH TIMELINE RECORDER — the input half of `tools/tmp/audio_mix.mjs`.
 *
 * Every audio measurement on this project so far renders ONE sound in ISOLATION.
 * `--mode identity` proves the sounds differ from each other; `--mode depth` proves each
 * has layers. A player hears neither of those things: they hear a MIX, produced by a real
 * event stream, through the retrigger throttle, the voice budget, the distance/pan gains
 * and the soft clip, all at once.
 *
 * This file produces the INPUT to that measurement and nothing else: it runs the real
 * `src/game/sim.ts` in Node (the same trick `tools/match-sim.mjs` and
 * `tools/tmp/audio_census.mjs` use) and records, for every tick,
 *
 *   * the `GameEvent[]` the sim emitted, and
 *   * exactly the `MatchState` fields `director.ts` reads — no more, so the recording
 *     cannot accidentally carry gameplay state into an audio measurement.
 *
 * The recording is then replayed IDENTICALLY into every render arm, which is what makes
 * an A/B mean anything: the arms differ only in the audio change under test, never in
 * what happened in the match.
 *
 *   node tools/tmp/audio_mix_record.mjs --player pizza --enemy taco --out /tmp/t.json
 *
 * `-Infinity` is not JSON, and `status.stunnedUntil` starts there. It is encoded as the
 * string "-inf" and restored on the other side; a silent coercion to `null` would make
 * every first status hit read as a REFUSAL, which is exactly the class of instrument bug
 * this pass exists to avoid.
 *
 * ── THIS FILE DECIDED WHEN THE FIRST COMBAT SOUND HAPPENS, AND ITS DRIVER WAS STALE ──
 *
 * `audio_mix.mjs --shape` calls `record()` 121 times and reports the gap between the
 * whistle and the first voice. That is the "the match is silent for 69.9% of its length"
 * figure, and it is the stated justification for the kitchen ambience bed (`35bd115`).
 * The driver that decides WHEN CONTACT HAPPENS was a stale hand-copy of
 * `tools/match-sim.mjs`'s, carrying a defect `match-sim.mjs` had fixed on 2026-08-05:
 * the stuck detector ran during the COUNTDOWN, when `sim.ts:movePlayer` is never called,
 * so it read "1.5 s of walking, 0 wu covered", latched a perpendicular detour, and walked
 * it SIDEWAYS at the whistle. A driver that walks sideways at the whistle changes exactly
 * the quantity `--shape` measures. `docs/LESSONS.md` §5.
 *
 * The driver is now IMPORTED from `tools/tmp/scripted_player.mjs`. Two consequences worth
 * stating plainly, because they are different in kind:
 *
 *   1. THE BUG FIX. `--nav-countdown-bug` reproduces the pre-fix walk, so the effect of
 *      the fix alone is measurable by running `--shape` with and without the flag.
 *   2. A POLICY REDEFINITION. The local `makePlayer` was not any of the shared policies:
 *      it navigated with a 24 wu / 700 ms detour instead of 45 wu / 900 ms, and it held
 *      fire when nothing was in range (`attack: slot !== null`) where the shared `chase`
 *      always presses the trigger. `smart` here has ALWAYS meant this chase-shaped hand,
 *      never the `smart` decision tree, so `smart` is kept as an explicit ALIAS for
 *      `chase` rather than silently re-pointed at a different policy — every recorded
 *      "policy=smart" audio figure refers to a chase. The real trees are reachable as
 *      `smart2` (corrected) and `smartTree` (the historical LOS-before-range one).
 *
 * Flags, all of which also work through `audio_mix.mjs` because they are read off
 * `process.argv` in this module and `audio_mix.mjs` runs in the same process:
 *
 *   --sim <dir>                 freeze the sim (a peer mid-save otherwise lands in a run)
 *   --arena <file>              freeze the arena dump
 *   --react <ms>                impose the 150 ms reaction cadence the rest of the family
 *                               uses; default 0 = decide every tick, as this file always did
 *   --nav-countdown-bug         reproduce the pre-2026-08-05 walk
 *   --decide-during-countdown   reproduce the pre-2026-08-05 decision loop
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

const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
const ARENA_CACHE = String(args.arena ?? `${ROOT}/tools/arena.gameplay.json`);

const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, MATCH_DURATION_MS, REACH } = RULES;

if (!existsSync(ARENA_CACHE)) {
  console.error(`No arena cache at ${ARENA_CACHE}. Run once:  node tools/match-sim.mjs --refresh-arena --url $URL`);
  process.exit(1);
}
const ARENA = { ...JSON.parse(readFileSync(ARENA_CACHE, 'utf8')), build: () => null, update: () => {} };

const DT = Number(args.dt ?? 16.667);
/** 0 = decide every tick, which is what this file has always done. */
const REACT_MS = Number(args.react ?? 0);

export const DRIVER_FLAGS = parseDriverFlags(args);
const DRIVER = createScriptedPlayer({
  CHARACTERS, REACH, arena: ARENA,
  hazard: (ARENA.hazards ?? []).find((h) => h.kind === 'damage') ?? null,
  ...DRIVER_FLAGS,
});
export { DRIVER_REV };

/**
 * `smart` is an ALIAS, not a policy. See the header: this file's `smart` has always been
 * a chase. Re-pointing the name at the `smart` decision tree would silently redefine
 * every audio figure ever recorded under `policy=smart`.
 */
const POLICY_ALIAS = {
  /**
   * `smart2` and not `chase`, and the reason is the headline figure itself. The legacy
   * hand held fire when nothing was in range (`attack: slot !== null`); the shared
   * `chase` presses the trigger unconditionally (`attack: true`, whatever its doc comment
   * says), so under `chase` the first `weapon-fired` lands 20 ms after the whistle and
   * "the gap to the first combat sound" collapses to 0.02 s — a measurement of the
   * instrument, not of the game. `smart2` carries the legacy firing discipline
   * (`idx !== null && (los || melee)`) and is the policy the rest of the project measures.
   * `--legacy-smart-as <policy>` re-points it for a sweep.
   */
  smart: String(args['legacy-smart-as'] ?? 'smart2'),
  flee: 'kite',
  smartTree: 'smart',
};
export const resolvePolicy = (p) => POLICY_ALIAS[p] ?? p;

/** JSON-safe encode of a number that may be ±Infinity. */
const enc = (v) => (v === -Infinity ? '-inf' : v === Infinity ? '+inf' : v);

/**
 * A hand on the controls — now the SHARED one. `seed` exists because the shared policies
 * take an rng and the historical hand took none: seed `null` passes `null` through, which
 * gives `makeNav` its historical initial `detourSign` of +1 and keeps the recording
 * deterministic, exactly as it was.
 */
export function makePlayer(policy, seed = null) {
  const name = resolvePolicy(policy);
  const fn = DRIVER.POLICY_FNS[name];
  if (!fn) throw new Error(`unknown policy ${policy} (have: ${DRIVER.POLICY_NAMES.join(', ')})`);
  const rnd = seed === null ? null : rng(seed);
  const decide = fn(rnd);
  const loop = DRIVER.createDecisionLoop({ decide, reactBase: REACT_MS, reactJit: 0, rnd });
  return (state, dt = DT) => loop.next(state, dt);
}

/** One fighter, reduced to exactly the fields `director.ts` reads. */
function snapFighter(f) {
  return {
    role: f.role, characterId: f.characterId,
    x: f.x, y: f.y, hp: f.hp, maxHp: f.maxHp, alive: f.alive,
    status: { stunnedUntil: enc(f.status.stunnedUntil), slowedUntil: enc(f.status.slowedUntil) },
  };
}

export function record(playerId, enemyId, policy = 'smart', opts = {}) {
  const state = createMatch(ARENA, playerId, enemyId);
  const act = makePlayer(policy, opts.seed ?? null);
  const ticks = [];
  const maxTicks = Math.ceil((MATCH_DURATION_MS * 1.4 + 8000) / DT);
  let n = 0;
  while (n < maxTicks) {
    n++;
    const events = stepMatch(state, DT, act(state, DT));
    if (opts.immortal && state.phase === 'playing') {
      state.player.hp = state.player.maxHp;
      state.enemy.hp = state.enemy.maxHp;
    }
    ticks.push({
      t: state.elapsed,
      phase: state.phase,
      safeRadius: state.safeRadius,
      player: snapFighter(state.player),
      enemy: snapFighter(state.enemy),
      ev: events,
    });
    if (state.phase === 'ended') break;
  }
  // A few quiet ticks after the end, so the last voice's tail is inside the render.
  return {
    playerId, enemyId, policy, resolvedPolicy: resolvePolicy(policy), dt: DT, ticks,
    endedAt: state.elapsed, driverRev: DRIVER_REV, driverFlags: DRIVER_FLAGS, sim: SIM_DIR,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (DRIVER.isHistorical) {
    console.log('  ⚠️  HISTORICAL DRIVER — reproducing a defect fixed on 2026-08-05; these numbers are NOT current.');
  }
  const tl = record(String(args.player ?? 'pizza'), String(args.enemy ?? 'taco'), String(args.policy ?? 'smart'), {
    immortal: !!args.immortal,
  });
  const voiced = tl.ticks.reduce((a, t) => a + t.ev.length, 0);
  console.log(`recorded ${tl.playerId} vs ${tl.enemyId} (policy ${tl.policy} -> ${tl.resolvedPolicy}, driver rev ${DRIVER_REV}): ${tl.ticks.length} ticks, ${voiced} events, ends at ${(tl.endedAt / 1000).toFixed(2)}s`);
  if (args.out) { writeFileSync(String(args.out), JSON.stringify(tl)); console.log(`wrote ${args.out}`); }
}
