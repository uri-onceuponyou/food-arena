#!/usr/bin/env node
/**
 * KT_BEARING — `lk_dodge`'s fixture, run at EVERY RUN BEARING instead of only straight away.
 *
 * ── WHY, AND IT IS NOT A COMPLAINT ABOUT THE ACCEPTANCE TEST ────────────────
 *
 * `tools/tmp/lk_dodge.mjs` drives the runner with `move: { x: 1, y: 0 }` — directly away
 * from a caster facing `{ x: 1, y: 0 }`. That is one bearing out of 360, and it is the
 * bearing `DECISIONS §78` measured as the **most expensive** one:
 *
 *     waterbottle.Mega   radial escape, bearing 0     601 ms
 *                        CHEAPEST escape              134 ms  @ sep 20, bearing 130 deg
 *
 * `deliverWeapon` resolves `Mega` against a FROZEN 100 degree cone, so the cheap exit is
 * ANGULAR, and a fixture that only runs radially cannot see it. **This does not make the
 * acceptance test wrong** — it is the worst case, it is the player's natural instinct, and
 * §79 names it as the bar. It makes it INCOMPLETE as a description of "can you dodge this",
 * which is the question Uri actually asked. A trim that passes only the radial test is a
 * bigger nerf than one that gives the player a real escape at some bearing.
 *
 * 🚨 **AND A STUN MAKES BEARING IRRELEVANT.** Stunned is movement locked to zero, so under
 * the shipped kit the runner cannot move in ANY direction and every bearing is identical.
 * That is this tool's known-bad: on the baseline tree the sweep must find **0 of 36**
 * bearings escaping. If it finds one, the fixture is not reproducing the shipped defect.
 *
 * ── CROSS-CHECK AGAINST THE TOOL IT GENERALISES ─────────────────────────────
 *
 * This re-implements `lk_dodge`'s fixture rather than importing it (that file runs its
 * table at module scope and has no `IS_MAIN` guard, so importing it would print a report
 * and measure nothing). A re-implementation that drifted would produce confident wrong
 * numbers, so `--selftest` requires bearing 0 here to reproduce `lk_dodge`'s own `open`
 * row on the SAME tree, to the digit.
 *
 *   node tools/tmp/kt_bearing.mjs --selftest
 *   node tools/tmp/kt_bearing.mjs --sim /tmp/fa-kt-cand/src/game
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
const { CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, speedFor } = RULES;

const TICK = 16.667;
const STEPS = Number(args.steps ?? 36);

// Identical to `lk_dodge`'s arena, deliberately — a different arena would be a second
// variable and the two tools' numbers would stop being comparable.
const arena = {
  id: 'kt-bearing', displayName: 'kt', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

const CASTER = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
const RUNNER = [...CHARACTER_IDS].sort((a, b) => speedFor(a, PLAYER_SPEED) - speedFor(b, PLAYER_SPEED))[0];
if (!CASTER) { console.error('no weapon on the roster carries a castMs — this tool is vacuous'); process.exit(1); }
const CW = CHARACTERS[CASTER].weapons;
const CAST_I = CW.findIndex((w) => (w.castMs ?? 0) > 0);
const MEGA = CW[CAST_I];

/** One run at one bearing. The caster's whole kit is live — this is `lk_dodge`'s `open`. */
function run(bearingDeg) {
  const state = createMatch(arena, RUNNER, CASTER);
  state.phase = 'playing';
  const caster = state.fighters[1];
  const runner = state.fighters[0];
  caster.x = 2000; caster.y = 2000; caster.facing = { x: 1, y: 0 };
  runner.x = 2020; runner.y = 2000;
  runner.hp = 1e9; runner.maxHp = 1e9;
  caster.hp = 1e9; caster.maxHp = 1e9;

  const rad = (bearingDeg * Math.PI) / 180;
  const move = { x: Math.cos(rad), y: Math.sin(rad) };

  const evs = [];
  attemptAttack(state, caster, CAST_I, evs);
  const input = { move, selectedWeapon: 0, attack: false };
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
    megaDealt,
    sep: Math.hypot(dx, dy),
    offAxisDeg: Math.abs((Math.atan2(dy, dx) * 180) / Math.PI),
    slowMs: slowTicks * TICK, stunMs: stunTicks * TICK,
    escaped: megaDealt === 0,
  };
}

if (args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  console.log(`\n══ kt_bearing SELFTEST ══  sim ${SIM_DIR}`);

  // 1. CROSS-CHECK: bearing 0 must reproduce `lk_dodge`'s `open` row on the same tree.
  //    A re-implementation that silently drifted would produce confident wrong numbers
  //    across the whole sweep, and nothing else here would notice.
  const out = execFileSync(process.execPath, [`${ROOT}/tools/tmp/lk_dodge.mjs`, '--sim', SIM_DIR],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  const m = /^\s+open\s+(-?\d+)\s+-?\d+\s+([\d.]+)\s/m.exec(out);
  const mine = run(0);
  ok('bearing 0 reproduces lk_dodge\'s `open` row to the digit',
    !!m && Number(m[1]) === mine.megaDealt && Math.abs(Number(m[2]) - mine.sep) < 0.005,
    m ? `lk_dodge dealt ${m[1]} sep ${m[2]} · here dealt ${mine.megaDealt} sep ${mine.sep.toFixed(2)}` : 'lk_dodge produced no `open` row');

  // 2. NON-VACUOUS: the sweep must actually vary the runner's position, or "no bearing
  //    escapes" would be a statement about a fixture that never moved anybody.
  const seps = [0, 90, 180, 270].map((b) => run(b).sep);
  ok('NON-VACUOUS: different bearings produce different geometry',
    new Set(seps.map((s) => s.toFixed(3))).size > 1, seps.map((s) => s.toFixed(2)).join(' '));

  // 3. The cone is real: a weapon with `cone < 360` must be escapable ANGULARLY by an
  //    UNIMPEDED runner, or the premise of this whole tool is wrong.
  ok('the cast weapon resolves against a cone, not a disc', (MEGA.cone ?? 360) < 360, `cone ${MEGA.cone}`);

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

console.log(`\n══ KT_BEARING ══  sim ${SIM_DIR}`);
console.log(`   ${CASTER}.${MEGA.key} castMs ${MEGA.castMs} · range ${MEGA.range} · cone ${MEGA.cone} deg · runner ${RUNNER} @ ${(speedFor(RUNNER, PLAYER_SPEED) * 1000).toFixed(2)} wu/s`);
console.log(`   kit: ${CW.map((w, i) => `${w.key}:${i === CAST_I ? 'CAST' : (w.effect ?? 'none')}`).join(' ')}\n`);

const rows = [];
for (let i = 0; i < STEPS; i++) rows.push({ deg: (i * 360) / STEPS, ...run((i * 360) / STEPS) });
const esc = rows.filter((r) => r.escaped);

console.log(`   ${'bearing'.padStart(8)}${'sep'.padStart(9)}${'offAxis'.padStart(9)}${'slowed'.padStart(9)}${'stunned'.padStart(9)}   verdict`);
for (const r of rows) {
  if (!args.all && !r.escaped && r.deg % 30 !== 0) continue;
  console.log(`   ${`${r.deg.toFixed(0)}째`.padStart(8)}${r.sep.toFixed(2).padStart(9)}${`${r.offAxisDeg.toFixed(1)}째`.padStart(9)}${`${r.slowMs.toFixed(0)}ms`.padStart(9)}${`${r.stunMs.toFixed(0)}ms`.padStart(9)}   ${r.escaped ? 'ESCAPED' : '** HIT **'}`);
}
console.log(`\n   ${esc.length} of ${rows.length} bearings escape${esc.length ? ` — cheapest ${esc.map((r) => `${r.deg.toFixed(0)}째`).join(' ')}` : ' — the wind-up is UNDODGEABLE AT EVERY BEARING'}`);
console.log('');
