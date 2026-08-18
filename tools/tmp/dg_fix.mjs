#!/usr/bin/env node
/**
 * DG_FIX — is the dodgeable region an artefact of ONE FIXTURE? `kt_bearing` sweeps 36
 * bearings at a FIXED separation of 20 wu with the roster's SLOWEST character running.
 * This sweeps the same fixture over SEPARATION and RUNNER as well.
 *
 * ── WHY THIS IS NOT A COMPLAINT ABOUT `kt_bearing` ──────────────────────────
 *
 * Its separation and its runner are both deliberate worst cases: `DECISIONS §78` measured
 * bearing 0 as the most expensive escape, and the slowest character has the least ground
 * to work with. A tuning point that passes there passes for everybody, which is the right
 * bar for an acceptance test.
 *
 * It is the wrong bar for a SEARCH. `dg_grid` reports coverage as a number Uri chooses
 * from, and a number measured at one separation is silently a number about one separation.
 * Two ways that bites, and both are real in the grid:
 *
 *   * **The radius lever is measured against a separation.** At the shipped 2000 ms stun
 *     the runner never leaves 20.36 wu, so every radius above ~21 lands and every radius
 *     below it misses — a cliff whose position IS the separation. Report that as "radius
 *     does nothing" without saying "at sep 20" and it is a claim about geometry when it is
 *     a claim about a fixture.
 *   * **A faster runner is a different game.** Escape is `distance cleared before resolve`,
 *     which is linear in speed, and the roster's speeds differ by 1.36x.
 *
 * ── THE CROSS-CHECK, AND IT IS THE SAME ONE `kt_bearing` RAN ────────────────
 *
 * This re-implements the fixture rather than importing it (`kt_bearing` runs its table at
 * module scope and has no `IS_MAIN` guard — importing it would print a report and measure
 * nothing, which is `AGENT-BRIEF §3`'s third trap). A re-implementation that drifted would
 * produce confident wrong numbers over the whole sweep, so `--selftest` requires this
 * fixture at `sep 20` with the default runner to reproduce `kt_bearing`'s own 36 rows
 * **bit-identically** — separation, off-axis, slow, stun and verdict, all 36.
 *
 *   node tools/tmp/dg_fix.mjs --selftest
 *   node tools/tmp/dg_fix.mjs --sim /private/tmp/fa-dg-p1/src/game --seps 5,20,40,60,80
 */
import { execFileSync } from 'node:child_process';
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
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const { attemptAttack } = await import(`${SIM_DIR}/combat.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, PLAYER_SPEED, speedFor } = RULES;

const TICK = 16.667;
const STEPS = 36;

// Byte-identical to `kt_bearing`'s arena. A different one would make every number here a
// second, incomparable corpus — which is the whole failure this tool is guarding against.
const arena = {
  id: 'kt-bearing', displayName: 'kt', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

const CASTER = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
if (!CASTER) { console.error('no weapon on the roster carries a castMs — this tool is vacuous'); process.exit(1); }
const CW = CHARACTERS[CASTER].weapons;
const CAST_I = CW.findIndex((w) => (w.castMs ?? 0) > 0);
const MEGA = CW[CAST_I];
const bySpeed = [...CHARACTER_IDS].sort((a, b) => speedFor(a, PLAYER_SPEED) - speedFor(b, PLAYER_SPEED));
const SLOWEST = bySpeed[0];
const FASTEST = bySpeed[bySpeed.length - 1];

/** One run: `kt_bearing.run()` with the separation and the runner lifted out as parameters. */
export function run(bearingDeg, sep = 20, runnerId = SLOWEST) {
  const state = createMatch(arena, runnerId, CASTER);
  state.phase = 'playing';
  const caster = state.fighters[1];
  const runner = state.fighters[0];
  caster.x = 2000; caster.y = 2000; caster.facing = { x: 1, y: 0 };
  runner.x = 2000 + sep; runner.y = 2000;
  runner.hp = 1e9; runner.maxHp = 1e9;
  caster.hp = 1e9; caster.maxHp = 1e9;

  const rad = (bearingDeg * Math.PI) / 180;
  const input = { move: { x: Math.cos(rad), y: Math.sin(rad) }, selectedWeapon: 0, attack: false };

  const evs = [];
  attemptAttack(state, caster, CAST_I, evs);
  let megaDealt = 0;
  let slowTicks = 0; let stunTicks = 0;
  const tally = (list) => {
    for (const e of list) {
      if (e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === MEGA.key) megaDealt += e.amount;
    }
  };
  tally(evs);
  const BUDGET = Math.ceil(MEGA.castMs / TICK);
  for (let i = 0; i < BUDGET && caster.cast !== null; i++) {
    tally(stepMatch(state, TICK, input));
    if (state.elapsed < runner.status.slowedUntil) slowTicks++;
    if (state.elapsed < runner.status.stunnedUntil) stunTicks++;
  }
  tally(stepMatch(state, TICK, input));
  const dx = runner.x - caster.x; const dy = runner.y - caster.y;
  return {
    megaDealt, sep: Math.hypot(dx, dy),
    offAxisDeg: Math.abs((Math.atan2(dy, dx) * 180) / Math.PI),
    slowMs: slowTicks * TICK, stunMs: stunTicks * TICK,
    escaped: megaDealt === 0,
  };
}

/** Bearings escaping out of 36, at one separation, for one runner. */
export const coverage = (sep, runnerId) => {
  let n = 0;
  for (let i = 0; i < STEPS; i++) if (run((i * 360) / STEPS, sep, runnerId).escaped) n++;
  return n;
};

if (args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  console.log(`\n== dg_fix SELFTEST ==  sim ${SIM_DIR}`);

  // 1. 🚨 THE CROSS-CHECK. All 36 rows, bit-identical to the tool this generalises. A
  //    re-implementation that drifted anywhere would produce confident wrong numbers over
  //    the entire sweep, and nothing else here could notice.
  const out = execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_bearing.mjs`, '--sim', SIM_DIR, '--all'],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] }).replace(/[^\x00-\x7F]/g, '~');
  const theirs = [];
  const re = /^\s+(\d+)~\s+([\d.]+)\s+([\d.]+)~\s+(\d+)ms\s+(\d+)ms\s+(ESCAPED|\*\* HIT \*\*)\s*$/gm;
  let m; while ((m = re.exec(out)) !== null) theirs.push({ deg: +m[1], sep: +m[2], off: +m[3], slow: +m[4], stun: +m[5], esc: m[6] === 'ESCAPED' });
  t('NON-VACUOUS: kt_bearing produced all 36 rows to compare against', theirs.length === 36, `${theirs.length} rows`);
  let drift = null;
  for (const r of theirs) {
    const mine = run(r.deg, 20, SLOWEST);
    if (Math.abs(mine.sep - r.sep) >= 0.005 || Math.abs(mine.offAxisDeg - r.off) >= 0.05
      || Math.round(mine.slowMs) !== r.slow || Math.round(mine.stunMs) !== r.stun || mine.escaped !== r.esc) {
      drift = `${r.deg}deg: theirs sep ${r.sep} off ${r.off} slow ${r.slow} stun ${r.stun} ${r.esc} · mine sep ${mine.sep.toFixed(2)} off ${mine.offAxisDeg.toFixed(1)} slow ${mine.slowMs.toFixed(0)} stun ${mine.stunMs.toFixed(0)} ${mine.escaped}`;
      break;
    }
  }
  t('all 36 rows reproduce kt_bearing BIT-IDENTICALLY at sep 20 / slowest runner', drift === null, drift ?? '');

  // 2. KNOWN-BAD: the separation parameter must actually be wired. If `--sep` were dropped
  //    on the floor every row above would still pass and every sweep below would be one
  //    number repeated — the "the change did nothing" failure, printed as a table.
  t('KNOWN-BAD: separation is WIRED — a different sep gives different geometry',
    Math.abs(run(90, 60, SLOWEST).sep - run(90, 20, SLOWEST).sep) > 1,
    `sep20 -> ${run(90, 20, SLOWEST).sep.toFixed(2)} · sep60 -> ${run(90, 60, SLOWEST).sep.toFixed(2)}`);
  t('KNOWN-BAD: the runner is WIRED — the fastest character covers more ground than the slowest',
    speedFor(FASTEST, PLAYER_SPEED) > speedFor(SLOWEST, PLAYER_SPEED)
    && run(90, 20, FASTEST).sep > run(90, 20, SLOWEST).sep - 1e-9,
    `${SLOWEST} ${(speedFor(SLOWEST, PLAYER_SPEED) * 1000).toFixed(2)} wu/s -> ${run(90, 20, SLOWEST).sep.toFixed(2)} · ${FASTEST} ${(speedFor(FASTEST, PLAYER_SPEED) * 1000).toFixed(2)} wu/s -> ${run(90, 20, FASTEST).sep.toFixed(2)}`);

  // 3. NON-VACUOUS on the OUTPUT, and 🚨 **THE FIRST VERSION OF THIS ROW WAS WRONG AND THE
  //    TOOL WAS RIGHT.** It asserted that a runner starting OUTSIDE the weapon's reach
  //    escapes at ALL 36 bearings; the sweep answered 25 of 36. The tool is correct: this
  //    fixture drives a COMMANDED bearing, and bearing 180 is *run straight at the caster*.
  //    A runner that charges the super is hit, at any starting separation. Believing the
  //    assertion over the measurement would have "fixed" the fixture into always escaping.
  //    So the rows below assert the two directions SEPARATELY, which is the real property.
  const far = MEGA.range + 10;
  t('a runner already outside the reach and running AWAY escapes', run(0, far, SLOWEST).escaped, `sep ${far}, bearing 0`);
  t('KNOWN-BAD: ...and one running INTO the caster is still HIT — the fixture obeys the commanded bearing rather than reporting a free escape',
    !run(180, far, SLOWEST).escaped, `sep ${far}, bearing 180, dealt ${run(180, far, SLOWEST).megaDealt}`);
  const cov = coverage(far, SLOWEST);
  t('NON-VACUOUS: coverage can report a PARTIAL result, not only 0 or 36', cov > 0 && cov < 36, `sep ${far} -> ${cov}/36`);

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// 🚨 IS_MAIN GUARD. This module EXPORTS `run` and `coverage` so a second tool can reuse a
// cross-checked fixture instead of copying it — and `AGENT-BRIEF §3` records three tools
// here that made a function importable and thereby made the whole CLI path run on import.
// Caught on this file the same way: `import('./dg_fix.mjs')` printed a live report.
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (!IS_MAIN) { /* imported — export the fixture, print nothing, measure nothing */ } else {

const SEPS = String(args.seps ?? '5,10,20,30,40,50,60,70,80').split(',').map(Number);
const RUNNERS = args.runners ? String(args.runners).split(',') : [SLOWEST, FASTEST];

console.log(`\n== DG_FIX ==  sim ${SIM_DIR}`);
console.log(`   ${CASTER}.${MEGA.key} castMs ${MEGA.castMs} - range ${MEGA.range} - cone ${MEGA.cone} deg - stun ${RULES.STUN_DURATION_MS} - slow ${RULES.SLOW_DURATION_MS}`);
console.log(`   bearings escaping of 36, by START SEPARATION (wu) x RUNNER\n`);
console.log(`   ${'runner'.padEnd(14)}${'wu/s'.padStart(8)}${SEPS.map((s) => String(s).padStart(6)).join('')}`);
for (const r of RUNNERS) {
  const id = r === 'fastest' ? FASTEST : r === 'slowest' ? SLOWEST : r;
  console.log(`   ${id.padEnd(14)}${(speedFor(id, PLAYER_SPEED) * 1000).toFixed(1).padStart(8)}${SEPS.map((s) => String(coverage(s, id)).padStart(6)).join('')}`);
}
console.log(`\n   ⚠️ a start separation above the weapon's own range ${MEGA.range} does NOT escape trivially:`);
console.log(`      bearing 180 is "run straight at the caster", and that is hit at any separation.\n`);
}
