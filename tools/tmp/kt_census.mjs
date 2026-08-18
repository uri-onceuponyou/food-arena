#!/usr/bin/env node
/**
 * KT_CENSUS — how many CC weapons does each character hold, and WHICH OTHER CHARACTERS
 * WOULD LOCK A WIND-UP THE SAME WAY IF THEY GOT ONE?
 *
 * `DECISIONS §79` asks a kit-composition question, not a Water Bottle question: *"how many
 * CC weapons may one character hold?"* Water Bottle is the only character with a `castMs`
 * today, so it is the only one the defect bites — but §77 is converting five more ultimates
 * and the next conversion inherits whatever this table says.
 *
 * ── THE DECIDING QUANTITY IS NOT THE COUNT ──────────────────────────────────
 *
 * Measured this pass (`kt_matrix`): dropping **two** of Water Bottle's three CC weapons
 * changed the radial escape by **0.00 wu** and the bearing coverage by **0 of 36**. The
 * count is nearly irrelevant. What decides it is:
 *
 *   1. **Does the kit contain a STUN?** A stun is movement locked to zero, so it defeats
 *      escape at EVERY bearing — 0 of 36 escape under the shipped kit, 23 of 36 with the
 *      one stun removed and BOTH slows still live. One stun is worth more than any number
 *      of slows.
 *   2. **Is ONE slow enough to cover the wind-up?** `SLOW_DURATION_MS` is 2500 and the
 *      longest shipped wind-up is 1100, so the FIRST application covers the whole cast by
 *      itself and a second slow adds nothing (`statusReadyAt` refuses it anyway). So the
 *      threshold is 1 CC weapon, not 3 — which is why "trim to two" is not a policy.
 *
 * So the column that predicts a lock is `stun>=1`, then `slow>=1`, and the count is
 * printed beside them as description rather than as the criterion.
 *
 * ⚠️ THE HOLD IS DERIVED FROM THE SIM'S OWN CONSTANTS, NOT TYPED. `holdMs` is how long
 * one application of the character's best CC pins a target, and `coversMs` compares it
 * against a candidate wind-up. Retyping either would go stale the first time §75(b)'s
 * `PLAYER_SPEED` answer lands.
 *
 *   node tools/tmp/kt_census.mjs --selftest
 *   node tools/tmp/kt_census.mjs
 *   node tools/tmp/kt_census.mjs --sim /tmp/fa-kt-a/src/game --cast 1100
 */
import { resolve } from 'node:path';

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
const R = await import(`${SIM_DIR}/rules.ts`);
const {
  CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, speedFor,
  SLOW_DURATION_MS, STUN_DURATION_MS, SLOW_MOVE_MULTIPLIER,
} = R;

/**
 * The longest single-application movement lock a kit can impose, in ms.
 * A stun is a total lock; a slow is a partial one and is scored as the ms of TRAVEL it
 * removes — `duration * (1 - multiplier)` — so the two are on one axis instead of being
 * compared as if 2500 ms of slow beat 2000 ms of stun.
 */
export function holdMs(weapons, slowDur, stunDur, slowMult) {
  let best = 0;
  for (const w of weapons) {
    if (w.effect === 'stun') best = Math.max(best, stunDur);
    else if (w.effect === 'slow') best = Math.max(best, slowDur * (1 - slowMult));
  }
  return best;
}

/** Unimpeded ms to clear `reach` from `sep0`. */
export function escapeMs(reach, sep0, speedWuPerMs) { return (reach - sep0) / speedWuPerMs; }

/**
 * ── THE EXACT CLEAR TIME UNDER ONE SLOW, AND THE FIRST VERSION WAS WRONG ────
 *
 * The first form here was `esc + slowDur * (1 - mult)`, which treats the slow as stealing
 * travel for its WHOLE duration. It does not: the runner clears the reach and stops caring.
 * At the shipped numbers it predicted **1981 ms** where the truth is **1347 ms** — a 47%
 * overstatement. Both are above 1100 so the verdict happened to be right, which is exactly
 * how a wrong model survives: it agrees with the measurement everywhere except the margin,
 * and the margin is the only place this table gets used.
 *
 * Two regimes, and they agree at the boundary:
 *
 *   the slow outlasts the escape   (esc/m <= D)   T = esc / m
 *   the escape outlasts the slow   (esc/m >  D)   T = esc + D * (1 - m)
 *
 * ⚠️ **VALIDATED AGAINST THE SIM, NOT ASSERTED.** `--selftest` reproduces two arms this
 * pass measured through the real `stepMatch`: `Glass -> none` (slow only, escape 1347 ms,
 * observed HIT at 1100) and `Glass -> none + SLOW_DUR 900` (predicted 1101 ms, observed
 * ESCAPED by 0.42 wu — a knife edge the wrong model could not have located).
 */
export function clearMs(reach, sep0, speedWuPerMs, effect, dur, mult) {
  const esc = escapeMs(reach, sep0, speedWuPerMs);
  if (effect === 'stun') return dur > esc ? Infinity : esc;   // zero movement: no progress at all
  if (effect !== 'slow') return esc;
  return esc / mult <= dur ? esc / mult : esc + dur * (1 - mult);
}

/** The worst clear time any single weapon in the kit can impose. */
export function kitClearMs(weapons, reach, sep0, speed, slowDur, stunDur, slowMult) {
  let worst = escapeMs(reach, sep0, speed);
  for (const w of weapons) {
    if (w.effect !== 'slow' && w.effect !== 'stun') continue;
    const d = w.effect === 'stun' ? stunDur : slowDur;
    worst = Math.max(worst, clearMs(reach, sep0, speed, w.effect, d, slowMult));
  }
  return worst;
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  console.log('\n══ kt_census SELFTEST ══');
  t('a stun outscores a slow of the same nominal duration',
    holdMs([{ effect: 'stun' }], 2500, 2500, 0.45) > holdMs([{ effect: 'slow' }], 2500, 2500, 0.45));
  t('an effect-free kit holds for 0 ms', holdMs([{ effect: null }, { effect: undefined }], 2500, 2000, 0.45) === 0);
  t('a slow at multiplier 1.0 holds for 0 ms — the effect is deleted, not weakened',
    holdMs([{ effect: 'slow' }], 2500, 2000, 1) === 0);
  t('a slow at multiplier 0 is worth its full duration — it IS a stun',
    holdMs([{ effect: 'slow' }], 2500, 2000, 0) === 2500);
  // KNOWN-BAD: the census must not score a kit by how MANY CC weapons it has. Two slows
  // hold no longer than one, because `statusReadyAt` refuses the second while the first
  // is live — measured this pass as a 0.00 wu difference. A count-based score would rank
  // a two-slow kit above a one-stun kit, which is backwards.
  t('KNOWN-BAD: two slows do not out-hold one slow (the count is not the quantity)',
    holdMs([{ effect: 'slow' }, { effect: 'slow' }], 2500, 2000, 0.45) === holdMs([{ effect: 'slow' }], 2500, 2000, 0.45));
  t('…and one stun out-holds two slows', holdMs([{ effect: 'stun' }], 2500, 2000, 0.45) > holdMs([{ effect: 'slow' }, { effect: 'slow' }], 2500, 2000, 0.45));
  t('escapeMs is the reach gap over the speed', Math.abs(escapeMs(84, 20, 0.1056) - 606.06) < 0.01, escapeMs(84, 20, 0.1056).toFixed(2));

  // ── VALIDATED AGAINST THE SIM. These two arms were measured through the real
  //    `stepMatch` by `kt_matrix` this pass; the model has to reproduce BOTH verdicts,
  //    including the one that only just passes, or it is not fit to predict a margin.
  const G = (dur) => clearMs(84, 20, 0.1056, 'slow', dur, 0.45);
  t('MEASURED ARM `Glass -> none` (slow only, SLOW_DUR 2500): predicts NO escape in 1100 ms — observed HIT',
    Math.abs(G(2500) - 1346.8) < 1 && G(2500) > 1100, `${G(2500).toFixed(1)} ms to clear`);
  t('MEASURED ARM `Glass -> none + SLOW_DUR 900`: predicts a KNIFE EDGE at 1100 ms — observed ESCAPED by 0.42 wu',
    Math.abs(G(900) - 1101) < 2, `${G(900).toFixed(1)} ms to clear vs an 1100 ms wind-up`);
  t('KNOWN-BAD: the OLD model (esc + dur*(1-m)) does NOT reproduce the 2500 arm — this is the bug that was fixed',
    Math.abs((606.06 + 2500 * 0.55) - G(2500)) > 600, `old ${(606.06 + 2500 * 0.55).toFixed(0)} vs exact ${G(2500).toFixed(0)}`);
  t('a stun shorter than the escape is NOT an infinite lock', clearMs(84, 20, 0.1056, 'stun', 100, 0.45) < Infinity);
  t('…and a stun longer than the escape IS', clearMs(84, 20, 0.1056, 'stun', 2000, 0.45) === Infinity);

  t('NON-VACUOUS: the roster is not empty', CHARACTER_IDS.length > 1, `${CHARACTER_IDS.length} characters`);
  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// The runner used for the escape arithmetic is the SLOWEST human — the worst case, and the
// same one `lk_dodge` derives, so the two tools describe the same fighter.
const RUNNER = [...CHARACTER_IDS].sort((a, b) => speedFor(a, PLAYER_SPEED) - speedFor(b, PLAYER_SPEED))[0];
const RUNNER_SPEED = speedFor(RUNNER, PLAYER_SPEED);
const SEP0 = 20;                       // lk_dodge's fixture separation
const CAST = Number(args.cast ?? 1100); // the wind-up under test

console.log(`\n══ KT_CENSUS ══  sim ${SIM_DIR}`);
console.log(`   SLOW ${SLOW_DURATION_MS}ms @ ${SLOW_MOVE_MULTIPLIER}x · STUN ${STUN_DURATION_MS}ms · runner ${RUNNER} @ ${(RUNNER_SPEED * 1000).toFixed(2)} wu/s`);
console.log(`   unimpeded radial escape from sep ${SEP0} past REACH.meleeHeavy ${REACH.meleeHeavy}: ${escapeMs(REACH.meleeHeavy, SEP0, RUNNER_SPEED).toFixed(0)} ms`);
console.log(`   a wind-up of ${CAST} ms is survivable only if the kit steals less than ${(CAST - escapeMs(REACH.meleeHeavy, SEP0, RUNNER_SPEED)).toFixed(0)} ms of slack\n`);

console.log(`   ${'character'.padEnd(13)}${'CC'.padStart(3)}${'stun'.padStart(6)}${'slow'.padStart(6)}${'clear'.padStart(10)}${'castMs'.padStart(8)}   would lock a ${CAST}ms wind-up?`);
const rows = [];
for (const id of CHARACTER_IDS) {
  const ws = CHARACTERS[id].weapons;
  const castless = ws.filter((w) => (w.castMs ?? 0) === 0);
  const stun = castless.filter((w) => w.effect === 'stun').length;
  const slow = castless.filter((w) => w.effect === 'slow').length;
  const clear = kitClearMs(castless, REACH.meleeHeavy, SEP0, RUNNER_SPEED, SLOW_DURATION_MS, STUN_DURATION_MS, SLOW_MOVE_MULTIPLIER);
  // A kit locks a wind-up of CAST if the runner cannot clear the reach inside it.
  const locks = stun > 0 ? 'YES — STUN, at every bearing' : (clear > CAST ? 'yes — one slow covers it' : 'no');
  const hasCast = ws.some((w) => (w.castMs ?? 0) > 0);
  rows.push({ id, cc: stun + slow, stun, slow, clear, locks, hasCast });
  console.log(`   ${id.padEnd(13)}${String(stun + slow).padStart(3)}${String(stun).padStart(6)}${String(slow).padStart(6)}${(clear === Infinity ? 'never' : `${clear.toFixed(0)}ms`).padStart(10)}${(hasCast ? 'YES' : '—').padStart(8)}   ${locks}`);
}

const withStun = rows.filter((r) => r.stun > 0);
const lockers = rows.filter((r) => r.locks !== 'no');
console.log(`\n   ${lockers.length} of ${rows.length} characters would lock a ${CAST} ms wind-up with their CASTLESS kit alone.`);
console.log(`   ${withStun.length} of ${rows.length} hold a STUN — the term that defeats every bearing: ${withStun.map((r) => r.id).join(', ') || 'none'}`);
console.log(`   Characters with a wind-up TODAY: ${rows.filter((r) => r.hasCast).map((r) => r.id).join(', ') || 'none'}`);
console.log('');
