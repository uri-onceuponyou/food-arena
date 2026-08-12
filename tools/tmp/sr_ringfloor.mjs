#!/usr/bin/env node
/**
 * sr_ringfloor.mjs — DOES THE RING EVER ACTUALLY REACH ITS FLOOR IN A SHIPPED MATCH?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `audio/sounds.ts:ringFloor` and `audio/director.ts:watchZone` are one cue with one
 * firing condition — the moment `safeRadius` lands on `ringFloorFor(N, timeRemaining)`.
 * Both files carried a MEASURED frequency for it (*"0 of 363 matches"*), and both then
 * carried a paragraph saying that measurement had been invalidated and NOT replaced:
 *
 *   > *"⚠️ AND THE 'never happens' MEASUREMENT IS NOT SIMPLY INVERTED, IT IS UNMEASURED."*
 *
 * That paragraph was right, and it stayed right through two more schedule changes. This
 * file replaces the assumption with a number, because the alternative — a comment that
 * says a cue fires at 30 s when it fires at 120 s, or never — is what `docs/LESSONS.md`
 * calls plausible and wrong.
 *
 * It reports, over the SAME corpus `roster_lab` uses (110 matchups x N seeds, policy
 * smart2, the shipped arena dump):
 *
 *   * how many matches reach `FOG_CLOSE_MS` — the instant the ring lands on the floor;
 *   * how many reach `SUDDEN_DEATH_MS`;
 *   * the longest match, so "never" is bounded rather than asserted.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VALIDATION — `--selftest`, offline, no corpus
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The counter is a filter over match rows, and `[].filter().length === 0` is what BOTH
 * "no match reaches the floor" and "the corpus is empty" print. So `--selftest` asserts
 * the corpus is NON-EMPTY first, then drives the classifier against planted rows whose
 * answer is arithmetic — including a row one millisecond either side of each boundary,
 * which is the only known-bad that can separate `>=` from `>`.
 *
 *   node tools/tmp/sr_ringfloor.mjs --selftest
 *   node tools/tmp/sr_ringfloor.mjs [--seeds 8] [--policies smart2]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createScriptedPlayer, rng } from './scripted_player.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);

const RULES = await import(`${ROOT}/src/game/rules.ts`);
const { FOG_CLOSE_MS, SUDDEN_DEATH_MS, MATCH_DURATION_MS, minSafeRadiusFor } = RULES;

/**
 * The classifier. `playMs` is PLAY time — `MATCH_DURATION_MS - timeRemaining` — which is
 * what `fogRadiusAt` keys off; using `elapsed` would fold the countdown in and move every
 * boundary by ~3.7 s. Exported so `--selftest` drives the shipped function, not a copy.
 */
export function classify(playMs) {
  return {
    reachedFloor: playMs >= FOG_CLOSE_MS,
    reachedSuddenDeath: playMs >= SUDDEN_DEATH_MS,
  };
}

if (has('--selftest')) {
  let pass = 0, fail = 0;
  const t = (name, ok, detail = '') => {
    if (ok) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
  };
  t('the boundaries came from rules.ts and are ordered hold < close < sudden death < whistle',
    FOG_CLOSE_MS < SUDDEN_DEATH_MS && SUDDEN_DEATH_MS < MATCH_DURATION_MS,
    `${FOG_CLOSE_MS} < ${SUDDEN_DEATH_MS} < ${MATCH_DURATION_MS}`);
  t('a match ending one ms BEFORE the close reaches neither',
    !classify(FOG_CLOSE_MS - 1).reachedFloor && !classify(FOG_CLOSE_MS - 1).reachedSuddenDeath);
  t('KNOWN-BAD: a match ending exactly ON the close DOES reach the floor (separates >= from >)',
    classify(FOG_CLOSE_MS).reachedFloor === true);
  t('...and does NOT yet reach sudden death', classify(FOG_CLOSE_MS).reachedSuddenDeath === false);
  t('KNOWN-BAD: a match ending exactly ON sudden death reaches both',
    classify(SUDDEN_DEATH_MS).reachedFloor && classify(SUDDEN_DEATH_MS).reachedSuddenDeath);
  t('CONTROL: the classifier is not simply always-true — a 0 ms match reaches nothing',
    !classify(0).reachedFloor && !classify(0).reachedSuddenDeath);
  // The floor the cue waits for is seat-dependent; if it were not, the whole `ringFloorFor`
  // rewrite this comment block describes would have been unnecessary.
  t('the ring floor rises with seat count (140 / 187.42 / 237.00)',
    minSafeRadiusFor(2) === 140 && Math.abs(minSafeRadiusFor(5) - 187.42) < 0.01
    && Math.abs(minSafeRadiusFor(6) - 237.0) < 0.01,
    `${minSafeRadiusFor(2)} ${minSafeRadiusFor(5)} ${minSafeRadiusFor(6)}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE CORPUS
// ─────────────────────────────────────────────────────────────────────────────
const ARENA_PATH = `${ROOT}/tools/arena.gameplay.json`;
if (!existsSync(ARENA_PATH)) { console.error(`no arena dump at ${ARENA_PATH}`); process.exit(1); }
const DUMP = JSON.parse(readFileSync(ARENA_PATH, 'utf8'));
// DERIVED, not read: `rules.ts:fogOpeningRadiusFor` is the identity on the half-diagonal,
// and a dump that disagrees is the defect this whole pass is about.
const MAX_SAFE = Math.hypot(DUMP.width / 2, DUMP.height / 2);
if (Math.abs(MAX_SAFE - DUMP.maxSafeRadius) > 1e-9) {
  throw new Error(`sr_ringfloor: dump maxSafeRadius ${DUMP.maxSafeRadius} != half-diagonal ${MAX_SAFE}`);
}
const arena = { ...DUMP, maxSafeRadius: MAX_SAFE, build: () => null, update: () => {} };

const { createMatch, stepMatch } = await import(`${ROOT}/src/game/sim.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH } = RULES;
const SEEDS = Number(arg('seeds', 8));
const POLICY = String(arg('policies', 'smart2'));
const DT = 16.667;
const driver = createScriptedPlayer({ CHARACTERS, REACH, arena });

/**
 * ⚠️ THE SEED FORMULA AND THE LOOP SETUP ARE `roster_lab.mjs`'s, VERBATIM AND ON PURPOSE.
 * A row here has to be the SAME MATCH as a row there, or the play lengths this file
 * reports are not the play lengths the pacing numbers were measured on — which is exactly
 * how a second corpus becomes a second source of truth.
 */
function one(playerId, enemyId, seed) {
  const rnd = rng(seed * 7919 + playerId.length * 131 + enemyId.length * 17 + POLICY.length);
  const state = createMatch(arena, playerId, enemyId);
  const decide = driver.POLICY_FNS[POLICY](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });
  const HARD_CAP = MATCH_DURATION_MS * 1.6 + 20_000;
  let ended = null;
  while (state.phase !== 'ended' && state.elapsed < HARD_CAP) {
    for (const ev of stepMatch(state, DT, loop.next(state, DT))) {
      if (ev.type === 'match-ended') ended = MATCH_DURATION_MS - state.timeRemaining;
    }
  }
  return ended ?? MATCH_DURATION_MS - state.timeRemaining;
}

const rows = [];
for (const p of CHARACTER_IDS) {
  for (const e of CHARACTER_IDS) {
    if (p === e) continue;
    for (let s = 0; s < SEEDS; s++) rows.push(one(p, e, s));
  }
}

// 🚨 NON-EMPTY FIRST. "0 of 0" and "0 of 880" print the same headline.
if (rows.length === 0) { console.error('sr_ringfloor: EMPTY corpus — nothing was measured'); process.exit(1); }

const floor = rows.filter((ms) => classify(ms).reachedFloor).length;
const sd = rows.filter((ms) => classify(ms).reachedSuddenDeath).length;
const max = Math.max(...rows);
const mean = rows.reduce((a, b) => a + b, 0) / rows.length;

console.log(`\nsr_ringfloor — ${rows.length} matches · policy ${POLICY} · ${SEEDS} seeds · arena ${DUMP.width}x${DUMP.height}`);
console.log(`  schedule: hold to ${RULES.FOG_HOLD_MS} ms, ring lands on minSafeRadiusFor(N) at ${FOG_CLOSE_MS} ms, sudden death ${SUDDEN_DEATH_MS} ms, whistle ${MATCH_DURATION_MS} ms`);
console.log(`  play length: mean ${(mean / 1000).toFixed(2)} s · LONGEST ${(max / 1000).toFixed(2)} s`);
console.log(`  reached the ring floor (${FOG_CLOSE_MS / 1000} s): ${floor}/${rows.length}`);
console.log(`  reached sudden death   (${SUDDEN_DEATH_MS / 1000} s): ${sd}/${rows.length}`);
console.log(`  headroom: the longest match ended ${((FOG_CLOSE_MS - max) / 1000).toFixed(2)} s before the ring lands\n`);
