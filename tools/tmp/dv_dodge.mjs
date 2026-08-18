#!/usr/bin/env node
/**
 * DV_DODGE — does the SCRIPTED PLAYER react to a wind-up, and what does that change?
 *
 * `DECISIONS §79`'s closing caveat: *"`tools/tmp/scripted_player.mjs` contains the string
 * `cast` zero times, so the driver opposite every corpus never dodges a wind-up and never
 * declines to open one."* Driver rev 5 is the fix. This is its acceptance test, and it is
 * built so that PASSING IT REQUIRES THE FEATURE TO HAVE FIRED — the null result and the
 * "it works" result do not look alike here.
 *
 * ── THE KNOWN-BAD IS FREE, AND IT IS THE OTHER ARM OF EVERY ROW ─────────────
 *
 *   rev4   `--no-player-dodge --no-player-cast-budget` — the driver as it stood for every
 *          balance figure this project has published, reproduced by flag rather than by
 *          checkout, so both arms run the same code on the same tree in the same process.
 *   rev5   the shipped default.
 *
 * A row is INTERESTING only when the two disagree. `docs/LESSONS.md`'s vacuity rule is
 * why the sweep asserts its CHANGED set is non-empty BEFORE it reports anything about it,
 * and why the castless control below is a separate arm rather than a footnote.
 *
 * ── WHAT THE THREE OUTCOMES MEAN, BECAUSE TWO OF THEM ARE "NO DAMAGE" ───────
 *
 *   HIT           the wind-up resolved and dealt damage.
 *   ESCAPED       it resolved and missed. This is the one Uri asked for.
 *   INTERRUPTED   the runner STUNNED the caster and cancelled the cast (`combat.ts`
 *                 terminator 1). Also zero damage, and NOT a dodge. Counting the two
 *                 together would let a driver that never moved a step read as a success
 *                 on any character carrying a stun — which is five of eleven.
 *
 * ── THE SWEEP, AND WHY IT IS A GRID AND NOT A FIXTURE ───────────────────────
 *
 * `lk_dodge.mjs`'s fixture drives the runner with a FIXED `{x: 1, y: 0}` — directly away
 * from the caster, which for a melee cast is already the exact direction `castThreat`
 * returns. On that one fixture a dodge-aware driver has nothing to add, and reading it
 * as "the feature does nothing" would be a measurement of the fixture. So this sweeps
 * every runner in the roster over separations and bearings and lets the driver's own
 * ladder pick the intent it would really have had — closing, strafing or backing off.
 *
 *   node tools/tmp/dv_dodge.mjs --selftest
 *   node tools/tmp/dv_dodge.mjs
 *   node tools/tmp/dv_dodge.mjs --sim /tmp/fa-x/src/game
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
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const { attemptAttack } = await import(`${SIM_DIR}/combat.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, PLAYER_SPEED, speedFor, FOG_DPS, SUDDEN_DEATH_MS } = RULES;
const { createScriptedPlayer, rng, DRIVER_REV } = await import('./scripted_player.mjs');

const TICK = 16.667;
const POLICY = String(args.policy ?? 'smart2');

/** No cover, no hazards, and far larger than the ring — so the ONLY thing steering the
 *  runner is the ladder plus (in one arm) the wind-up. */
const arena = {
  id: 'dv-dodge', displayName: 'dv', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 3000,
  playerSpawn: { x: 200, y: 200 }, enemySpawn: { x: 3800, y: 3800 },
  cover: [], hazards: [], build() { return {}; },
};

/** DERIVED, never typed — `csx_bitid`'s rule. A second wind-up must land in this set on
 *  its own or every row below silently measures the old one. */
const CASTERS = CHARACTER_IDS.filter((id) => CHARACTERS[id].weapons.some((w) => (w.castMs ?? 0) > 0));
if (!CASTERS.length) { console.error('no weapon on the roster carries a castMs — this tool is vacuous'); process.exit(1); }
const CASTER = CASTERS[0];
const CW = CHARACTERS[CASTER].weapons;
const CAST_I = CW.findIndex((w) => (w.castMs ?? 0) > 0);
const MEGA = CW[CAST_I];

const REV4 = createScriptedPlayer({ CHARACTERS, REACH, arena, noPlayerDodge: true, noPlayerCastBudget: true });
const REV5 = createScriptedPlayer({ CHARACTERS, REACH, arena });

/**
 * One run. The runner is driven by the REAL decision loop — same cadence, same seeded
 * stream in both arms, because the number of `rnd()` draws is a function of the tick
 * count and never of what `decide()` returned.
 *
 * `arm` is `silent` (every other caster slot held shut by stamping `lastUsed` into the
 * future — the same refusal the cooldown gate already makes, so no new sim path) or
 * `open` (the shipped kit, CC and all). `openCast: false` is the CASTLESS CONTROL: the
 * identical run with no wind-up opened at all, which is the arm that must be identical
 * between the two drivers.
 */
function run(driver, runnerId, sep, bearingDeg, { arm = 'open', openCast = true, seed = 0, holdRunnerFire = false, policy = POLICY } = {}) {
  const state = createMatch(arena, runnerId, CASTER);
  state.phase = 'playing';
  const runner = state.fighters[0];
  const caster = state.fighters[1];
  const b = (bearingDeg * Math.PI) / 180;
  caster.x = arena.center.x; caster.y = arena.center.y; caster.facing = { x: 1, y: 0 };
  runner.x = caster.x + Math.cos(b) * sep; runner.y = caster.y + Math.sin(b) * sep;
  runner.hp = 1e9; runner.maxHp = 1e9;
  caster.hp = 1e9; caster.maxHp = 1e9;
  if (arm === 'silent') for (let i = 0; i < caster.lastUsed.length; i++) if (i !== CAST_I) caster.lastUsed[i] = 1e9;
  if (holdRunnerFire) for (let i = 0; i < runner.lastUsed.length; i++) runner.lastUsed[i] = 1e9;

  const rnd = rng(seed * 7919 + runnerId.length * 131 + CASTER.length * 17 + policy.length);
  const decide = driver.POLICY_FNS[policy](rnd);
  const loop = driver.createDecisionLoop({ decide, reactBase: 150, reactJit: seed === 0 ? 0 : 60, rnd });

  const evs = [];
  if (openCast) attemptAttack(state, caster, CAST_I, evs);
  else caster.lastUsed[CAST_I] = 1e9;

  let megaDealt = 0;
  let cancelled = null;
  const inputs = [];
  const tally = (list) => {
    for (const e of list) {
      if (e.type === 'hit-landed' && e.source?.kind === 'weapon' && e.source.weaponKey === MEGA.key) megaDealt += e.amount;
      if (e.type === 'cast-cancelled') cancelled = e.reason ?? 'unknown';
    }
  };
  tally(evs);
  const BUDGET = Math.ceil(MEGA.castMs / TICK) + 1;
  for (let i = 0; i < BUDGET; i++) {
    const input = loop.next(state, TICK);
    inputs.push(`${input.move.x},${input.move.y},${input.selectedWeapon},${input.attack ? 1 : 0}`);
    tally(stepMatch(state, TICK, input));
  }
  const outcome = megaDealt > 0 ? 'HIT' : cancelled ? 'INTERRUPTED' : 'ESCAPED';
  return {
    megaDealt,
    outcome,
    cancelled,
    sep: Math.hypot(runner.x - caster.x, runner.y - caster.y),
    inputs: inputs.join('|'),
  };
}

const RUNNERS = CHARACTER_IDS;
const SEPS = [20, 40, 60, 80, 100, 130];
const BEARINGS = [0, 30, 60, 90, 120, 180];

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — a probe that cannot report a difference is worthless
// ═════════════════════════════════════════════════════════════════════════════
if (args.selftest) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log(`\n══ dv_dodge SELFTEST ══  sim ${SIM_DIR}  driver rev ${DRIVER_REV}`);

  ok('the caster set is DERIVED and non-empty', CASTERS.length > 0, `[${CASTERS.join(', ')}] · ${MEGA.key} ${MEGA.castMs}ms range ${MEGA.range}`);
  ok('the two arms really are different drivers',
    REV4.flags.noPlayerDodge === true && REV5.flags.noPlayerDodge === false
    && REV4.isHistorical === true && REV5.isHistorical === false);
  ok('…and the rev-5 arm actually resolved its cast terms — a null `castSource` on a kit '
    + 'with a wind-up would make every row below a measurement of nothing',
    REV5.castSource !== null && REV5.hasCastWeapon === true, `castSource ${REV5.castSource}`);

  // SELF-PAIR. Same driver twice must be byte-identical, or every difference below is noise.
  {
    const a = run(REV5, 'soup', 40, 0);
    const b = run(REV5, 'soup', 40, 0);
    ok('SELF-PAIR: rev5 against itself is byte-identical on the input stream and the outcome',
      a.inputs === b.inputs && a.outcome === b.outcome && a.sep === b.sep);
  }
  /**
   * KNOWN-BAD: a target that does not move IS HIT, in BOTH arms.
   *
   * ⚠️ The first draft of this row used `smart2` and it was WRONG — and being wrong is the
   * finding it now records. The rev-4 driver at 20 wu strafes (`band * 0.5` is 35.70 for
   * the slowest runner, so 20 wu is the back-off branch and 36-71 wu the strafe branch),
   * circles to a bearing of ~135 deg and leaves the 100 deg cone. **It ESCAPES a wind-up
   * it cannot see, by accident.** `DECISIONS §78`'s *"the cheapest exit from a wedge is
   * ANGULAR"* from the other seat. So "no damage" proves nothing about a driver unless the
   * driver was standing still — hence `idle`, which is this file's own definition of a
   * target that never acts.
   */
  for (const drv of [['rev4', REV4], ['rev5', REV5]]) {
    const r = run(drv[1], 'soup', 20, 0, { arm: 'silent', holdRunnerFire: true, policy: 'idle' });
    ok(`KNOWN-BAD: an IDLE runner at 20 wu is HIT by the wind-up on the ${drv[0]} driver`,
      r.outcome === 'HIT', `outcome ${r.outcome} sep ${r.sep.toFixed(2)} dealt ${r.megaDealt}`);
  }
  // DETECTION on the OTHER half: the castless control must be identical between the arms.
  // If this ever fails, rev 5 is touching a state it has no business touching.
  {
    const bad = [];
    for (const id of RUNNERS) {
      const a = run(REV4, id, 40, 0, { openCast: false });
      const b = run(REV5, id, 40, 0, { openCast: false });
      if (a.inputs !== b.inputs) bad.push(id);
    }
    ok('CONTROL: with NO wind-up open, the two drivers produce byte-identical input for all 11 runners',
      bad.length === 0, bad.length ? `differed for [${bad.join(', ')}]` : '');
  }
  // …and the positive control for that same comparator: with a wind-up open it MUST differ
  // somewhere, or the comparator above is passing because it compares nothing.
  {
    const moved = RUNNERS.filter((id) => run(REV4, id, 40, 0).inputs !== run(REV5, id, 40, 0).inputs);
    ok('POSITIVE CONTROL: …and WITH one open the same comparator finds a difference',
      moved.length > 0, `moved for [${moved.join(', ')}]`);
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the sweep
// ═════════════════════════════════════════════════════════════════════════════
const t0 = Date.now();
console.log(`\n══ DV_DODGE ══  sim ${SIM_DIR}  ·  driver rev ${DRIVER_REV}  ·  policy ${POLICY}`);
console.log(`   caster ${CASTER}.${MEGA.key}  castMs ${MEGA.castMs}  range ${MEGA.range}  cone ${MEGA.cone ?? 360}`);
console.log(`   grid ${RUNNERS.length} runners x ${SEPS.length} separations x ${BEARINGS.length} bearings = ${RUNNERS.length * SEPS.length * BEARINGS.length} cells per arm\n`);

for (const arm of ['silent', 'open']) {
  const rows = [];
  for (const id of RUNNERS) {
    for (const sep of SEPS) {
      for (const bd of BEARINGS) {
        const a = run(REV4, id, sep, bd, { arm });
        const b = run(REV5, id, sep, bd, { arm });
        rows.push({ id, sep, bd, a: a.outcome, b: b.outcome, aSep: a.sep, bSep: b.sep, same: a.inputs === b.inputs });
      }
    }
  }
  const tally = (rows, k) => {
    const t = { HIT: 0, ESCAPED: 0, INTERRUPTED: 0 };
    for (const r of rows) t[r[k]]++;
    return t;
  };
  const t4 = tally(rows, 'a');
  const t5 = tally(rows, 'b');
  const changed = rows.filter((r) => !r.same);
  const rescued = rows.filter((r) => r.a === 'HIT' && r.b === 'ESCAPED');
  const lost = rows.filter((r) => r.a === 'ESCAPED' && r.b === 'HIT');

  console.log(`   ── ARM "${arm}" ${arm === 'silent' ? '(caster may fire ONLY the wind-up — the geometry, isolated)' : '(the shipped kit — CC live, DECISIONS §79)'}`);
  console.log(`      ${'driver'.padEnd(8)}${'HIT'.padStart(7)}${'ESCAPED'.padStart(10)}${'INTERRUPTED'.padStart(14)}`);
  console.log(`      ${'rev4'.padEnd(8)}${String(t4.HIT).padStart(7)}${String(t4.ESCAPED).padStart(10)}${String(t4.INTERRUPTED).padStart(14)}`);
  console.log(`      ${'rev5'.padEnd(8)}${String(t5.HIT).padStart(7)}${String(t5.ESCAPED).padStart(10)}${String(t5.INTERRUPTED).padStart(14)}`);
  console.log(`      cells whose INPUT STREAM changed   ${changed.length} / ${rows.length}   <-- must be > 0`);
  /**
   * ⚠️ THE FULL TRANSITION MATRIX, BECAUSE THE TWO TOTALS ABOVE DO NOT SUBTRACT.
   * "rev4 HIT 33, rev5 HIT 0" does NOT mean 33 dodges: a repositioned runner also lands
   * its OWN shots differently, and a stun cancels the cast (`combat.ts` terminator 1).
   * HIT -> INTERRUPTED is a real improvement for the runner and it is NOT the mechanic
   * Uri asked for, so it is counted in its own cell rather than folded into the headline.
   */
  const OUT = ['HIT', 'ESCAPED', 'INTERRUPTED'];
  console.log(`      transition  rev4 \\ rev5 ${OUT.map((o) => o.padStart(12)).join('')}`);
  for (const a of OUT) {
    console.log(`      ${a.padEnd(24)}${OUT.map((b) => String(rows.filter((r) => r.a === a && r.b === b).length).padStart(12)).join('')}`);
  }
  console.log(`      HIT -> ESCAPED (the dodge worked)  ${rescued.length}`);
  console.log(`      ESCAPED -> HIT (it backfired)      ${lost.length}`);
  if (rescued.length) {
    console.log(`      first rescued cells: ${rescued.slice(0, 6).map((r) => `${r.id}@${r.sep}/${r.bd}deg`).join('  ')}`);
  }
  if (lost.length) {
    console.log(`      BACKFIRED cells:     ${lost.slice(0, 6).map((r) => `${r.id}@${r.sep}/${r.bd}deg`).join('  ')}`);
  }
  console.log('');
}

// ═════════════════════════════════════════════════════════════════════════════
// FAULT 6 — "do not open a wind-up you cannot finish", on hand-built states
// ═════════════════════════════════════════════════════════════════════════════
/**
 * The budget half cannot be measured by the sweep above: it fires when the CASTER is the
 * scripted player, not the runner. Both situations `stepAI` derives the budget from are
 * built here directly, with the rev-4 arm as the known-bad on every row.
 */
console.log(`   ── FAULT 6  "do not open a wind-up you cannot finish"  (budget = hp*1000/FOG_DPS, FOG_DPS ${FOG_DPS})`);
{
  const mk = () => {
    const s = createMatch(arena, CASTER, CASTER);
    s.phase = 'playing';
    s.fighters[0].x = 2000; s.fighters[0].y = 2000;
    s.fighters[1].x = 2040; s.fighters[1].y = 2000;
    s.fighters[1].facing = { x: -1, y: 0 };
    s.elapsed = 100000;
    for (const f of s.fighters) for (let i = 0; i < f.lastUsed.length; i++) f.lastUsed[i] = -1e9;
    return s;
  };
  const keyOf = (drv, s, d) => {
    const i = drv.bestWeapon(s, d);
    return i === null ? null : CW[i].key;
  };

  // 1. the ordinary case — nothing is wrong, so the budget refuses nothing
  {
    const s = mk();
    console.log(`      ordinary tick                     rev4 ${keyOf(REV4, s, 40)}   rev5 ${keyOf(REV5, s, 40)}   <-- must AGREE`);
  }
  // 2. SUDDEN DEATH with less fog life left than the wind-up costs
  {
    const s = mk();
    s.timeRemaining = 5000;                       // inside sudden death
    s.fighters[0].hp = 40;                        // 40 * 1000 / 50 = 800 ms < castMs 1100
    const b4 = keyOf(REV4, s, 40); const b5 = keyOf(REV5, s, 40);
    console.log(`      sudden death, hp 40 (800ms left)  rev4 ${b4}   rev5 ${b5}   <-- rev5 must NOT be ${MEGA.key}`);
    console.log(`        budget ${(40 * 1000 / FOG_DPS).toFixed(0)}ms vs castMs ${MEGA.castMs}   (sudden death starts at timeRemaining <= ${RULES.MATCH_DURATION_MS - SUDDEN_DEATH_MS})`);
  }
  // 3. SUDDEN DEATH with enough life left — the refusal must be a deadline, not a ban
  {
    const s = mk();
    s.timeRemaining = 5000;
    s.fighters[0].hp = 200;                       // 4000 ms left
    console.log(`      sudden death, hp 200 (4000ms)     rev4 ${keyOf(REV4, s, 40)}   rev5 ${keyOf(REV5, s, 40)}   <-- must AGREE`);
  }
  // 4. standing inside an INCOMING telegraph
  {
    const s = mk();
    const evs = [];
    attemptAttack(s, s.fighters[1], CAST_I, evs);
    const inc = REV5.incomingCast(s);
    console.log(`      inside an incoming telegraph      rev4 ${keyOf(REV4, s, 40)}   rev5 ${keyOf(REV5, s, 40)}   <-- rev5 must NOT be ${MEGA.key}`);
    console.log(`        incomingCast t ${inc ? inc.t.toFixed(3) : 'null'} urgent ${inc ? inc.urgent : 'n/a'} · budget ${REV5.castBudgetFor(s)}`);
  }
}

console.log(`\n   ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
