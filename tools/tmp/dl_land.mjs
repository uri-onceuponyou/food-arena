#!/usr/bin/env node
/**
 * DL_LAND — the OTHER half of `DECISIONS §80`, which no instrument on this programme
 * measures: **does the super still LAND on someone who does not run?**
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `lk_dodge`, `kt_bearing` and `dg_grid` all answer one question — *can the target get
 * away?* — and every one of them scores a HIT as failure. **Optimising that alone has a
 * degenerate solution: make the super miss everybody.** `§77` names the failure in as
 * many words — *"a super nobody presses is the same failure as one nobody survives, and
 * it is quieter"* — and `§79` records it happening to `soup.Dump` (50.3% -> 0.6%).
 *
 * So a §80 tuning point needs BOTH arms and they are not the same experiment:
 *
 *   DODGE   the runner moves from the first tick        -> must ESCAPE   (kt_bearing)
 *   LAND    the target never moves at all               -> must be HIT   (here)
 *   REACT   the target starts running PART WAY through  -> the deadline  (here)
 *
 * The third is the one that decides whether the telegraph is a skill test. A wind-up you
 * can answer at 95% elapsed is a dead button; one you must answer in the first 5% is not
 * counterplay either. **This tool reports the deadline as a number and takes no view.**
 *
 * ── 🚨 THE ASSERTION "A STATIONARY TARGET IS HIT" IS TAUTOLOGICAL UNLESS IT CAN FAIL ──
 *
 * `CLAUDE.md` rule 6: a guard not shown to fail on the bug it guards against is not a
 * guard, and `[].every()` is `true`. The known-bad here is PHYSICAL rather than
 * synthetic — the same stationary target placed OUTSIDE the weapon's reach must NOT be
 * hit. That discriminates on the real quantity (the radius), so the control cannot pass
 * by measuring nothing, and it fails the moment the tool stops tracking `range`.
 *
 * ── AND IT IS CROSS-CHECKED AGAINST THE TOOL IT EXTENDS ─────────────────────
 *
 * This re-implements `kt_bearing`'s fixture with one added parameter (when the runner
 * starts moving) rather than importing it — that file runs its sweep at module scope.
 * A re-implementation that drifted would produce confident wrong numbers, so `--selftest`
 * requires `react(0 ms)` to reproduce `kt_bearing`'s own bearing-0 row, to the digit, on
 * the same tree.
 *
 *   node tools/tmp/dl_land.mjs --selftest --sim /private/tmp/fa-dl-stage/src/game
 *   node tools/tmp/dl_land.mjs --sim /private/tmp/fa-dl-k18/src/game
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

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

// Identical to `kt_bearing`'s arena, deliberately. A different arena would make every
// number here a second, incomparable corpus.
const arena = {
  id: 'dl-land', displayName: 'dl', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

const CASTER = CHARACTER_IDS.find((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
if (!CASTER) { console.error('no weapon on the roster carries a castMs — this tool is vacuous'); process.exit(1); }
const RUNNER = [...CHARACTER_IDS].sort((a, b) => speedFor(a, PLAYER_SPEED) - speedFor(b, PLAYER_SPEED))[0];
const CW = CHARACTERS[CASTER].weapons;
const CAST_I = CW.findIndex((w) => (w.castMs ?? 0) > 0);
const MEGA = CW[CAST_I];

/**
 * One run. `reactMs` is when the target starts moving — `0` is `kt_bearing`'s runner,
 * `Infinity` is a target that never moves at all. `sep0` is the starting separation and
 * exists so the known-bad can place the same stationary target outside the reach.
 */
export function run({ bearingDeg = 0, reactMs = 0, sep0 = 20 } = {}) {
  const state = createMatch(arena, RUNNER, CASTER);
  state.phase = 'playing';
  const caster = state.fighters[1];
  const runner = state.fighters[0];
  caster.x = 2000; caster.y = 2000; caster.facing = { x: 1, y: 0 };
  runner.x = 2000 + sep0; runner.y = 2000;
  runner.hp = 1e9; runner.maxHp = 1e9;
  caster.hp = 1e9; caster.maxHp = 1e9;

  const rad = (bearingDeg * Math.PI) / 180;
  const move = { x: Math.cos(rad), y: Math.sin(rad) };
  const startX = runner.x; const startY = runner.y;

  const evs = [];
  attemptAttack(state, caster, CAST_I, evs);
  const castOpenedAt = state.elapsed;
  let megaDealt = 0;
  const tally = (list) => {
    for (const e of list) {
      if (e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === MEGA.key) megaDealt += e.amount;
    }
  };
  tally(evs);

  const still = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  const going = { move, selectedWeapon: 0, attack: false };
  const BUDGET = Math.ceil(MEGA.castMs / TICK);
  let movingTicks = 0;
  for (let i = 0; i < BUDGET && caster.cast !== null; i++) {
    const elapsedIntoCast = state.elapsed - castOpenedAt;
    const input = elapsedIntoCast >= reactMs ? going : still;
    if (input === going) movingTicks++;
    tally(stepMatch(state, TICK, input));
  }
  {
    const elapsedIntoCast = state.elapsed - castOpenedAt;
    const input = elapsedIntoCast >= reactMs ? going : still;
    if (input === going) movingTicks++;
    tally(stepMatch(state, TICK, input));
  }
  const dx = runner.x - caster.x; const dy = runner.y - caster.y;
  return {
    megaDealt,
    hit: megaDealt > 0,
    fullDamage: megaDealt >= MEGA.damage,
    sep: Math.hypot(dx, dy),
    travelled: Math.hypot(runner.x - startX, runner.y - startY),
    movingTicks,
  };
}

/**
 * The latest reaction time (ms into the cast) at which the target still escapes, found by
 * bisection on the tick grid. `null` means it never escapes at any reaction time — which
 * includes reacting on the very first tick, i.e. the shipped defect.
 */
export function reactionDeadline(bearingDeg = 0) {
  if (run({ bearingDeg, reactMs: 0 }).hit) return null;
  let lo = 0; let hi = MEGA.castMs + TICK;
  while (hi - lo > TICK) {
    const mid = (lo + hi) / 2;
    if (run({ bearingDeg, reactMs: mid }).hit) hi = mid; else lo = mid;
  }
  return lo;
}

if (IS_MAIN && args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  // ⚠️ `CLAUDE.md` rule 6: `--selftest` validates a tool's LOGIC, never where it is
  // POINTED. This header is not decoration — it caught `--sim` aimed at a staging
  // worktree still holding the PREVIOUS arm (castMs 3000, PLAYER_SPEED 0.09) while every
  // row below went green, because each row cross-checks against the same tree.
  console.log(`\n== dl_land SELFTEST ==  sim ${SIM_DIR}`);
  console.log(`   POINTED AT: ${CASTER}.${MEGA.key} castMs ${MEGA.castMs} - range ${MEGA.range} - damage ${MEGA.damage} - kit ${CW.map((w, i) => `${w.key}:${i === CAST_I ? 'CAST' : (w.effect ?? 'none')}`).join(' ')} - runner ${(speedFor(RUNNER, PLAYER_SPEED) * 1000).toFixed(2)} wu/s`);

  // 1. DRIFT GUARD: `react(0)` is `kt_bearing`'s runner. If this fixture has drifted from
  //    the one every published §79/§80 number was measured on, every number below is a
  //    second corpus wearing the first one's labels.
  const out = execFileSync(process.execPath, [`${ROOT}/tools/tmp/kt_bearing.mjs`, '--sim', SIM_DIR, '--all'],
    { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'] });
  const txt = out.replace(/[^\x00-\x7F]/g, '~');
  const m = /^\s+0~\s+([\d.]+)\s+[\d.]+~\s+\d+ms\s+\d+ms\s+(ESCAPED|\*\* HIT \*\*)\s*$/m.exec(txt);
  const mine = run({ bearingDeg: 0, reactMs: 0 });
  t('DRIFT GUARD: react(0) reproduces kt_bearing\'s bearing-0 row to the digit',
    !!m && Math.abs(Number(m[1]) - mine.sep) < 0.005 && (m[2] === 'ESCAPED') === !mine.hit,
    m ? `kt_bearing sep ${m[1]} ${m[2]} - here sep ${mine.sep.toFixed(2)} ${mine.hit ? 'HIT' : 'ESCAPED'}` : 'kt_bearing printed no bearing-0 row');

  // 2. THE CONTROL ITSELF: a target that never moves is hit for the full damage.
  const stood = run({ reactMs: Infinity });
  t('CONTROL: a target that never moves takes the FULL super',
    stood.fullDamage, `dealt ${stood.megaDealt} of ${MEGA.damage}, sep ${stood.sep.toFixed(2)}`);

  // 3. NON-VACUITY: it really did not move. Without this, "a stationary target is hit"
  //    could be true of a fixture whose input was ignored for some other reason.
  t('NON-VACUOUS: the stationary arm really never moved (0.00 wu travelled, 0 moving ticks)',
    stood.travelled === 0 && stood.movingTicks === 0, `travelled ${stood.travelled.toFixed(4)} wu, ${stood.movingTicks} moving ticks`);

  // 4. 🚨 KNOWN-BAD, PHYSICAL: the SAME stationary target placed outside the reach must
  //    NOT be hit. This is what stops row 2 being a tautology — it discriminates on the
  //    radius, which is the quantity `§80`'s lever 1 moves.
  const far = run({ reactMs: Infinity, sep0: MEGA.range + 40 });
  t('KNOWN-BAD: the same stationary target OUTSIDE the reach is NOT hit',
    !far.hit && far.travelled === 0, `dealt ${far.megaDealt} at sep ${far.sep.toFixed(2)} vs range ${MEGA.range}`);

  // 5. …and the boundary is the weapon's own `range`, not a number typed here.
  const inside = run({ reactMs: Infinity, sep0: MEGA.range - 2 });
  const outside = run({ reactMs: Infinity, sep0: MEGA.range + 2 });
  t('the hit boundary tracks the weapon\'s own `range` field, not a literal',
    inside.hit && !outside.hit, `sep ${(MEGA.range - 2).toFixed(0)} ${inside.hit ? 'HIT' : 'miss'} - sep ${(MEGA.range + 2).toFixed(0)} ${outside.hit ? 'HIT' : 'miss'}`);

  // 6. NON-VACUITY of the deadline: it must be able to return BOTH a number and `null`.
  //    A tree where no reaction time escapes returns `null`; one where reacting at 0 works
  //    returns a finite deadline inside the cast.
  const d = reactionDeadline(0);
  t('the reaction deadline is either null (never escapable) or inside the cast window',
    d === null || (d >= 0 && d <= MEGA.castMs + TICK), `${d === null ? 'null' : `${d.toFixed(0)} ms`} of ${MEGA.castMs} ms`);

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (IS_MAIN) {
  console.log(`\n== DL_LAND ==  sim ${SIM_DIR}`);
  console.log(`   ${CASTER}.${MEGA.key} castMs ${MEGA.castMs} - range ${MEGA.range} - cone ${MEGA.cone} deg - damage ${MEGA.damage} - cooldown ${MEGA.cooldown}`);
  console.log(`   kit: ${CW.map((w, i) => `${w.key}:${i === CAST_I ? 'CAST' : (w.effect ?? 'none')}`).join(' ')}`);
  console.log(`   runner ${RUNNER} @ ${(speedFor(RUNNER, PLAYER_SPEED) * 1000).toFixed(2)} wu/s - wind-up is ${((MEGA.castMs / MEGA.cooldown) * 100).toFixed(0)}% of its own cooldown\n`);

  const stood = run({ reactMs: Infinity });
  const ran = run({ reactMs: 0 });
  const far = run({ reactMs: Infinity, sep0: MEGA.range + 40 });
  console.log(`   ${'arm'.padEnd(34)}${'dealt'.padStart(7)}${'sep'.padStart(9)}${'moved'.padStart(9)}   verdict`);
  const row = (n, r, want) => console.log(`   ${n.padEnd(34)}${String(r.megaDealt).padStart(7)}${r.sep.toFixed(2).padStart(9)}${r.travelled.toFixed(2).padStart(9)}   ${r.hit ? '** HIT **' : 'ESCAPED'}${want ? `   ${want}` : ''}`);
  row('STAND — never moves', stood, stood.fullDamage ? 'CONTROL OK: the super still lands' : '🔴 DEAD BUTTON: it misses a target that never moved');
  row('RUN   — moves from tick 0', ran, ran.hit ? '🔴 UNDODGEABLE at bearing 0' : 'DODGE OK: lk_dodge\'s `open` arm escapes');
  row(`KNOWN-BAD — stands at sep ${(MEGA.range + 40).toFixed(0)}`, far, far.hit ? '🔴 the control cannot fail — it is a tautology' : 'the control discriminates');

  console.log(`\n   REACTION DEADLINE — the latest moment the target may start running and still escape`);
  console.log(`   ${'bearing'.padStart(9)}${'deadline'.padStart(11)}${'of cast'.padStart(10)}   `);
  for (const b of [0, 45, 90, 135, 180]) {
    const d = reactionDeadline(b);
    console.log(`   ${`${b}deg`.padStart(9)}${(d === null ? 'never' : `${d.toFixed(0)} ms`).padStart(11)}${(d === null ? '-' : `${((d / MEGA.castMs) * 100).toFixed(0)}%`).padStart(10)}`);
  }
  console.log('');
}
