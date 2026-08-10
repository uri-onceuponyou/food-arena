#!/usr/bin/env node
/**
 * HM_AUDIT — EVERY homing weapon against the same arithmetic, and the retirement rule
 * that produced it, priced rather than argued.
 *
 * ── What `ac_homing.mjs` established, and what it left open ─────────────────
 *
 * `c786fd7` found that `sim.ts:stepProjectiles` retires a projectile at
 * `p.traveled >= w.range` — CUMULATIVE PATH LENGTH — and that `speedFor` applies
 * `PLAYER_SPEED` (120 wu/s at the cap) to one role and `AI_CHASE_SPEED` (70) to the other,
 * so **the human always shoots at the slow one and `stepAI` always shoots at the fast one.**
 * `0558bc5` fixed ONE instance of it (`sushi.Catch.speed` 160 -> 280).
 *
 * `ac_homing` reports DELIVERY AT ONE SEPARATION (95 wu). That answers "how much of the
 * press do I collect", and it is the right question for a role split. It does not answer the
 * question a weapon designer has to answer, which is:
 *
 *     >> `range` is TWO different things wearing one number. <<
 *
 *   * `ai.ts:pickWeapon` — `if (adist > (w.range ?? Infinity)) continue;` — treats it as the
 *     PRESS GATE. Both drivers share that line (`driver_guard.mjs` polices the copies), so
 *     `range` is the separation at which a fighter BELIEVES the weapon works.
 *   * `stepProjectiles` treats the same number as the PATH BUDGET. Against a target that is
 *     running, the budget buys `range * (1 - S/v)` of approach and no more.
 *
 * Those two readings coincide only when the target is STATIONARY, and `press_value.mjs`'s
 * 183/183 cells are all stationary. So this tool measures the second one directly and prints
 * it next to the first. The gap, in world units, is the defect.
 *
 *     EFFECTIVE REACH   the largest separation at which one press still delivers, measured
 *                       on the real sim through `ac_homing.fireOnce`, against a target
 *                       receding in a straight line at a named role speed.
 *
 * ── And the analytic column is not decoration ───────────────────────────────
 *
 * `reach = range * (1 - S/v) + hitRadius` is derivable before any code runs, and it is
 * printed beside the measurement for the reason `c786fd7` gives in its own message: two
 * instruments sharing no code, agreeing to the digit, is the evidence standard here. A
 * measured cell that departs from the arithmetic is either a fan wasting path on a turn
 * (expected, and it is why pellet weapons undershoot) or a bug in this tool.
 *
 * ── --rules: is `traveled` the wrong ACCUMULATOR? ───────────────────────────
 *
 * Priced, not changed. `src/game/sim.ts` is not this tool's to edit and the change costs
 * something in all 110 matchups. `--rules` stages PATCHED COPIES of the sim into a temp dir
 * and re-runs the same reach table against each, so the decision in
 * `docs/DECISIONS-FOR-URI.md` carries numbers:
 *
 *   path          shipped. `p.traveled += |move|`, retire at `>= range`.
 *   displacement  retire at `|p - launchPoint| >= range`. The proposal.
 *   relative      the budget is denominated in the TARGET'S frame: the target's motion
 *                 along the projectile's heading is REFUNDED, so a shot gets `range` wu of
 *                 GROUND GAINED rather than `range` wu of ground covered. Needs a hard age
 *                 cap or a shot that cannot gain never dies — that cap is a new constant and
 *                 is part of this option's price.
 *
 * ⚠️ THE STAGED SIMS ARE MEASUREMENT ARTEFACTS. They add untyped scratch fields to
 * `Projectile` and would not survive `tsc`. They exist to put a number on an option, not to
 * be a draft of it.
 *
 *   node tools/tmp/hm_audit.mjs --selftest
 *   node tools/tmp/hm_audit.mjs --sim <worktree>/src/game
 *   node tools/tmp/hm_audit.mjs --sim <worktree>/src/game --rules --from <worktree>
 *
 * ⚠️ NOT A WIN RATE. Every figure here is a deterministic single press with no RNG in it:
 * re-running gives the same digits and there is no sampling floor to clear. The ~9 pp
 * aggregate floor belongs to `roster_lab.mjs` and must not be carried over to this table.
 * A reach is a WORLD-UNIT quantity and its resolution is the 1 wu scan step.
 */

import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireOnce, speedRows } from './ac_homing.mjs';

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
const FROM = String(args.from ?? resolve(SIM_DIR, '../..'));
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { pressValue } = await import(`${SIM_DIR}/ai.ts`);
const { CHARACTERS, CHARACTER_IDS, HIT_RADIUS_VS_ENEMY } = RULES;

/** `fireOnce` fires from the PLAYER seat at the ENEMY seat, so this is the radius in play. */
const HIT_R = HIT_RADIUS_VS_ENEMY;

// ═════════════════════════════════════════════════════════════════════════════
// EFFECTIVE REACH
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The largest separation at which one press of `charId`/`weaponKey` still delivers at
 * least `frac` of `pressValue` against a target receding at `speed` on heading `thetaDeg`.
 *
 * A LINEAR SCAN, not a bisection, and deliberately: delivery is only *approximately*
 * monotone in separation (a pellet fan can clip a target the axis shot misses, and the
 * tick grid quantises everything), so a bisection would silently report whichever side of
 * a one-wu non-monotonicity it happened to land on. The scan takes the MAXIMUM over the
 * whole domain, which is the quantity the name claims. `range` bounds it because
 * `pickWeapon` refuses to press past `range` anyway — a reach beyond the press gate is
 * unreachable in a match and reporting it would overstate the weapon.
 */
function effectiveReach(charId, weaponKey, speed, thetaDeg, frac, step = 1) {
  const w = CHARACTERS[charId].weapons.find((x) => x.key === weaponKey);
  const max = w.range ?? 0;
  let best = 0;
  for (let d = step; d <= max; d += step) {
    const pv = pressValue(w, d);
    if (pv <= 0) continue;
    const { dealt } = fireOnce(charId, weaponKey, d, speed, thetaDeg);
    if (dealt >= frac * pv - 1e-9) best = d;
  }
  return best;
}

/** `range * (1 - S/v) + hitRadius` — the straight-line race, before any code runs. */
function analyticReach(w, speed) {
  const v = w.speed ?? 0;
  if (v <= 0) return 0;
  return Math.max(0, (w.range ?? 0) * (1 - speed / v)) + HIT_R;
}

/** Every `homing: true` weapon in the roster, in `CHARACTER_IDS` order. */
function homingWeapons() {
  const out = [];
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) if (w.homing) out.push({ id, w });
  }
  return out;
}

function reachTable(label, { entries = homingWeapons(), thetaDeg = 0, frac = 1 } = {}) {
  console.log(`\n══ HM_AUDIT ══  ${label}`);
  console.log(`   EFFECTIVE REACH — largest separation still delivering ${(frac * 100).toFixed(0)}% of pressValue,`);
  console.log(`   target receding at ${thetaDeg === 0 ? 'θ=0 (straight away)' : `θ=${thetaDeg}°`}.  "gate" is what \`pickWeapon\` lets a driver press from.`);
  console.log('');
  console.log('   character/weapon         v    gate   still  AIchase   AIflee   PLAYER   |  analytic chase/player');
  const rows = [];
  for (const { id, w } of entries) {
    const sp = speedRows(id);
    const byRole = {};
    for (const { s, label: rl } of sp) {
      byRole[rl.split(/\s+/)[0] + (rl.startsWith('AI') ? rl.split(/\s+/)[1] : '')] = {
        s, reach: effectiveReach(id, w.key, s, thetaDeg, frac),
      };
    }
    const still = byRole.stationary;
    const chase = byRole.AIchase;
    const flee = byRole.AIflee;
    const player = byRole.PLAYER;
    rows.push({ id, key: w.key, w, still, chase, flee, player });
    console.log(`   ${`${id}/${w.key}`.padEnd(22)} ${String(w.speed).padStart(5)}`
      + ` ${String(w.range).padStart(6)}`
      + ` ${String(still.reach).padStart(7)}`
      + ` ${String(chase.reach).padStart(8)}`
      + ` ${String(flee.reach).padStart(8)}`
      + ` ${String(player.reach).padStart(8)}`
      + `   |  ${analyticReach(w, chase.s).toFixed(0).padStart(5)} ${analyticReach(w, player.s).toFixed(0).padStart(6)}`);
  }
  console.log('');
  for (const r of rows) {
    const gate = r.w.range;
    console.log(`   >> ${r.id}/${r.key}: a driver may press from ${gate} wu; against a fleeing HUMAN it connects out to`
      + ` ${r.player.reach} wu (${((r.player.reach / gate) * 100).toFixed(0)}% of the gate),`
      + ` against a fleeing AI ${r.chase.reach} wu (${((r.chase.reach / gate) * 100).toFixed(0)}%).`);
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// STAGED RETIREMENT RULES
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ EVERY SUBSTITUTION MUST MATCH EXACTLY ONCE OR THIS THROWS.
 *
 * `stage_weapon.mjs` says why in one line and it is the most expensive failure mode an
 * instrument has here (`docs/LESSONS.md` §13): a sweep that silently changes nothing
 * produces a clean, confident, entirely fictional "no effect" row — and "no effect" is the
 * exact answer this tool exists to test for, so a silent no-op would be indistinguishable
 * from the finding.
 */
function substitute(src, needle, replacement, what) {
  const n = src.split(needle).length - 1;
  if (n !== 1) throw new Error(`hm_audit: "${what}" matched ${n} times, refusing to guess`);
  return src.replace(needle, replacement);
}

const CAPTURE_ORIGIN = `    const p = state.projectiles[i];
    if (p.__ox === undefined) { p.__ox = p.x; p.__oy = p.y; p.__tx = null; p.__age = 0; }`;

const RULE_PATCHES = {
  path: (src) => src,

  displacement: (src) => {
    let s = substitute(src, '    const p = state.projectiles[i];', CAPTURE_ORIGIN, 'origin capture');
    return substitute(s,
      'if (hitWall || p.traveled >= (w.range ?? Infinity)) {',
      'if (hitWall || Math.hypot(p.x - p.__ox, p.y - p.__oy) >= (w.range ?? Infinity)) {',
      'displacement retirement');
  },

  relative: (src) => {
    let s = substitute(src, '    const p = state.projectiles[i];', CAPTURE_ORIGIN, 'origin capture');
    // Refund the target's motion along the projectile's own heading, so `range` is
    // denominated in GROUND GAINED. `Math.max(0, ...)` refunds only a receding target — a
    // target closing on the shot does not have its approach charged to the shot's budget.
    s = substitute(s,
      '    p.traveled += Math.hypot(moveX, moveY);',
      `    {
      const __step = Math.hypot(moveX, moveY);
      let __refund = 0;
      if (p.__tx !== null && __step > 0) {
        __refund = Math.max(0, ((target.x - p.__tx) * moveX + (target.y - p.__ty) * moveY) / __step);
      }
      p.__tx = target.x; p.__ty = target.y;
      p.__age += dt;
      p.traveled += Math.max(0, __step - __refund);
    }`,
      'relative accumulator');
    // The age cap. Without it a shot that cannot gain ground never retires.
    return substitute(s,
      'if (hitWall || p.traveled >= (w.range ?? Infinity)) {',
      'if (hitWall || p.traveled >= (w.range ?? Infinity) || p.__age >= 3 * ((w.range ?? 0) / (w.speed || 1)) * 1000) {',
      'relative retirement + age cap');
  },
};

/**
 * Repoint one weapon's `speed` at a different rung of the `SPEED` table.
 *
 * `tools/tmp/stage_weapon.mjs` is the general tool for this and is what every roster
 * sweep in this session used. It cannot be used HERE for one specific reason worth
 * recording: it locates the field on the SAME LINE as `key: '<Key>'`, and Burrito's
 * Topping Swarm is the roster's only MULTI-LINE weapon literal — `pellets`, `spreadDeg`
 * and `homing` sit on the next line. It fails loudly rather than guessing, which is
 * correct, but it means the fan-width half of this finding is out of its reach.
 *
 * ⚠️ THE NEEDLE MUST BE UNIQUE AND THE FIRST ONE TRIED WAS NOT. `speed: SPEED.maxSlow`
 * matches TWICE — Burrito's Topping Swarm and **Hamburger's Lettuce Fling**, which is a
 * NON-homing weapon sitting on the same rung. `substitute` threw, which is the whole
 * point of it, and the second hit is worth keeping in view: the reach law this tool
 * measures is not a property of homing at all (see `--ladder`).
 */
function stageSpeed(needle, replacement, outdir, what) {
  return stageRule('path', outdir, { rules: (s) => substitute(s, needle, replacement, what) });
}

/** Copy `<from>/src/{game,arena/types}` into `outdir`, apply one rule patch, and go. */
function stageRule(rule, outdir, { rules = null } = {}) {
  const patch = RULE_PATCHES[rule];
  if (!patch) throw new Error(`hm_audit: unknown rule "${rule}"`);
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(`${outdir}/game`, { recursive: true });
  mkdirSync(`${outdir}/arena`, { recursive: true });
  for (const f of readdirSync(`${FROM}/src/game`)) {
    if (f.endsWith('.ts')) copyFileSync(`${FROM}/src/game/${f}`, `${outdir}/game/${f}`);
  }
  copyFileSync(`${FROM}/src/arena/types.ts`, `${outdir}/arena/types.ts`);
  const simPath = `${outdir}/game/sim.ts`;
  writeFileSync(simPath, patch(readFileSync(simPath, 'utf8')));
  if (rules) {
    const rulesPath = `${outdir}/game/rules.ts`;
    writeFileSync(rulesPath, rules(readFileSync(rulesPath, 'utf8')));
  }
  return `${outdir}/game`;
}

/**
 * Run the reach table for one rule IN A CHILD PROCESS.
 *
 * It has to be a child: `ac_homing.mjs` binds its sim at module load from `--sim`, and an
 * ES module is cached per specifier for the life of the process, so a second rule measured
 * in-process would silently reuse the first rule's sim — a fictional "identical" row, which
 * is the one answer this comparison must never manufacture.
 */
async function runRuleChild(simDir, extra = []) {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath,
    [`${ROOT}/tools/tmp/hm_audit.mjs`, '--sim', simDir, '--json', ...extra],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  return JSON.parse(out);
}

// ═════════════════════════════════════════════════════════════════════════════
// THE LADDER CENSUS — the reach tax is a property of the FLIGHT RUNG, not of homing
// ═════════════════════════════════════════════════════════════════════════════
//
// Reduce the measurement to arithmetic and the range CANCELS:
//
//     reach = range * (1 - S/v) + hitRadius        and    v = range / flight
//           = range - S * flight + hitRadius
//
// The penalty for a moving target is `S * flight` and NOTHING ELSE. It does not depend on
// how far the weapon reaches; it depends only on how long the shot is in the air. So a
// rung of `FLIGHT_MS` is a REACH TAX, denominated in world units, and it is the same tax
// for every weapon on that rung however long or short its range is.
//
// `FLIGHT_MS`'s own header authors the ladder for DODGEABILITY — *"what a player actually
// perceives is TIME TO TARGET"*, in units of `EVADE_WINDOW`. That is exactly right and it
// is only half the consequence: the same number that decides how dodgeable a shot is also
// decides how much ground a runner can steal from it, and the second half was never
// written down. `FLIGHT_MS.drift` is 1750 ms; against a 120 wu/s human that is a **210 wu
// tax**, which is more than `REACH.rangedMax` (140) — so a weapon on that rung has
// NEGATIVE reach against a fleeing human at every range on the ladder.
//
// ⚠️ AND IT APPLIES TO EVERY RANGED WEAPON, NOT JUST THE HOMING THREE. A straight shot is
// aimed where the target IS and arrives where the target WAS, so it loses the same race.
// The difference is that homing makes the loss look like it should not be happening: the
// pellets visibly track, and they still expire short.
function ladderCensus() {
  const FLIGHT = RULES.FLIGHT_MS;
  const topHuman = Math.max(...CHARACTER_IDS.map((id) => RULES.speedFor(id, RULES.PLAYER_SPEED) * 1000));
  const topChase = Math.max(...CHARACTER_IDS.map((id) => RULES.speedFor(id, RULES.AI_CHASE_SPEED) * 1000));
  console.log('\n══ HM_AUDIT --ladder ══  reach = range − S·flight + hitRadius, for every RANGED weapon');
  console.log(`   S = the fastest fighter in each role: human ${topHuman.toFixed(0)} wu/s · AI chase ${topChase.toFixed(0)} wu/s.`);
  console.log(`   "gate" is the separation \`pickWeapon\` will press from. Pure arithmetic — no sim in this table.\n`);
  console.log(`   ${'weapon'.padEnd(24)}${'gate'.padStart(6)}${'v'.padStart(6)}${'flight'.padStart(8)}${'rung'.padStart(8)}`
    + `${'reach/AI'.padStart(10)}${'reach/human'.padStart(13)}  homing`);
  const rungOf = (ms) => Object.entries(FLIGHT).find(([, v]) => v === ms)?.[0] ?? '—';
  const rows = [];
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (w.type !== 'ranged' || !w.speed || !w.range) continue;
      const flight = (w.range / w.speed) * 1000;
      rows.push({ id, w, flight, ai: w.range - (topChase * flight) / 1000 + HIT_R, hu: w.range - (topHuman * flight) / 1000 + HIT_R });
    }
  }
  rows.sort((a, b) => a.hu - b.hu);
  for (const r of rows) {
    console.log(`   ${`${r.id}/${r.w.key}`.padEnd(24)}${String(r.w.range).padStart(6)}${String(r.w.speed).padStart(6)}`
      + `${`${r.flight.toFixed(0)}ms`.padStart(8)}${rungOf(Math.round(r.flight)).padStart(8)}`
      + `${r.ai.toFixed(0).padStart(10)}${r.hu.toFixed(0).padStart(13)}  ${r.w.homing ? 'HOMING' : ''}`);
  }
  console.log(`\n   >> ${rows.filter((r) => r.hu < r.w.range).length} of ${rows.length} ranged weapons cannot connect at their own press gate against a fleeing human.`);
  console.log(`   >> ${rows.filter((r) => r.hu <= HIT_R + 1).length} cannot connect at ANY separation beyond the hit radius (${HIT_R} wu).`);
  console.log('');
}

// ═════════════════════════════════════════════════════════════════════════════
// MINIMUM RANGE — the cost of the speed lever, which nothing here had ever looked for
// ═════════════════════════════════════════════════════════════════════════════
//
// `HOMING_TURN_RATE` is a per-MILLISECOND lerp of the direction vector
// (`turnAmount = min(1, 0.006 * dt)`), applied at whatever speed the projectile is
// carrying. It is therefore an ANGULAR rate, and the TURNING RADIUS SCALES WITH SPEED.
//
// A homing pellet launched off-axis has to turn back onto the target. Double its speed
// and you double the radius of that turn — so a pellet that used to curve onto a nearby
// target now sails past it. Raising `speed` to fix a weapon's reach against a FLEEING
// target therefore buys long range and can spend CLOSE range, and the trade is invisible
// to every instrument that fires at one separation.
//
// It is measured against a STATIONARY target on purpose. A hole in the stationary curve
// cannot be a race being lost — the target is not going anywhere — so it isolates the
// geometry from the arithmetic the rest of this tool is about.
function deadBand(charId, weaponKey, { step = 5, speed = 0 } = {}) {
  const w = CHARACTERS[charId].weapons.find((x) => x.key === weaponKey);
  const holes = [];
  for (let d = step; d <= (w.range ?? 0); d += step) {
    const pv = pressValue(w, d);
    if (pv <= 0) continue;
    const { dealt } = fireOnce(charId, weaponKey, d, speed, 0);
    if (dealt < pv - 1e-9) holes.push({ d, frac: dealt / pv });
  }
  return holes;
}

function minRangeTable() {
  console.log(`\n══ HM_AUDIT --minrange ══  delivery vs separation against a STATIONARY target`);
  console.log('   A hole here is NOT a lost race — the target is not moving. It is the fan failing to');
  console.log('   turn back onto the target, because `HOMING_TURN_RATE` is angular and the turning');
  console.log('   radius scales with projectile speed.\n');
  const seps = [];
  for (let d = 10; d <= 140; d += 10) seps.push(d);
  console.log(`   ${'weapon'.padEnd(22)}${'v'.padStart(5)}${'fan'.padStart(6)}  ` + seps.map((d) => String(d).padStart(5)).join(''));
  for (const { id, w } of homingWeapons()) {
    const cells = seps.map((d) => {
      const pv = pressValue(w, d);
      return pv <= 0 ? '  -' : `${((fireOnce(id, w.key, d, 0, 0).dealt / pv) * 100).toFixed(0)}%`;
    });
    console.log(`   ${`${id}/${w.key}`.padEnd(22)}${String(w.speed).padStart(5)}`
      + `${`${w.spreadDeg ?? 0}°`.padStart(6)}  ` + cells.map((c) => c.padStart(5)).join(''));
  }
  console.log('');
}

// ═════════════════════════════════════════════════════════════════════════════
// --json  (the machine-readable reach table, used by --rules and by --selftest)
// ═════════════════════════════════════════════════════════════════════════════

function reachJson({ thetas = [0, 90], frac = 1 } = {}) {
  const out = {};
  for (const { id, w } of homingWeapons()) {
    const sp = speedRows(id);
    const cells = {};
    for (const t of thetas) {
      for (const { s, label } of sp) {
        cells[`${label.split(/\s+/).slice(0, 2).join('')}@${t}`] = effectiveReach(id, w.key, s, t, frac);
      }
    }
    out[`${id}/${w.key}`] = { speed: w.speed, range: w.range, cells };
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════

if (import.meta.main && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ hm_audit SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  // ── A. THE REACH SCAN AGREES WITH THE ARITHMETIC, AND A WRONG ARITHMETIC IS
  //       SHOWN TO DISAGREE. Egg's Hatch! is the calibration case because it is the
  //       ONLY single-projectile homing weapon in the roster — no fan, so no path is
  //       spent on a turn and the closed form has nothing to explain away.
  {
    const w = CHARACTERS.egg.weapons.find((x) => x.key === 'Hatch');
    const chase = speedRows('egg').find((r) => r.label.startsWith('AI chase')).s;
    const measured = effectiveReach('egg', 'Hatch', chase, 0, 1);
    const predicted = analyticReach(w, chase);
    ok('single-projectile homing: measured reach matches range*(1-S/v)+hitRadius within a tick',
      Math.abs(measured - predicted) <= (w.speed * 16.667) / 1000 + 1,
      `measured ${measured} vs predicted ${predicted.toFixed(1)}`);
    // KNOWN-BAD: the same closed form fed a projectile speed twice the real one must NOT
    // agree. Without this, the assertion above passes for any tolerance wide enough.
    const wrong = analyticReach({ ...w, speed: w.speed * 2 }, chase);
    ok('…and the SAME check against a DOUBLED projectile speed FAILS  <-- the tolerance is not slack',
      Math.abs(measured - wrong) > (w.speed * 16.667) / 1000 + 1,
      `measured ${measured} vs wrong-model ${wrong.toFixed(1)}`);
  }

  // ── B. THE SCAN IS SENSITIVE TO THE TARGET'S SPEED AT ALL. A rig that quietly
  //       ignored the prescribed velocity would return the stationary reach in every
  //       column and every conclusion below would be an artefact.
  {
    const still = effectiveReach('burrito', 'Swarm', 0, 0, 1);
    const chase = speedRows('burrito').find((r) => r.label.startsWith('AI chase')).s;
    const player = speedRows('burrito').find((r) => r.label.startsWith('PLAYER')).s;
    const rc = effectiveReach('burrito', 'Swarm', chase, 0, 1);
    const rp = effectiveReach('burrito', 'Swarm', player, 0, 1);
    ok('reach is strictly ordered stationary > AI-chase > PLAYER  <-- the velocity is real',
      still > rc && rc > rp, `${still} > ${rc} > ${rp}`);
    ok('a stationary target is reachable across essentially the whole authored range',
      still >= CHARACTERS.burrito.weapons.find((x) => x.key === 'Swarm').range - 30,
      `${still} of range 140`);
  }

  // ── C. THE PATCHER REFUSES TO GUESS.
  {
    let threw = false;
    try { substitute('a b c', 'zzz', 'q', 'nonexistent needle'); } catch { threw = true; }
    ok('a substitution that matches ZERO times THROWS  <-- no silent no-op row', threw);
    let threw2 = false;
    try { substitute('x x', 'x', 'q', 'ambiguous needle'); } catch { threw2 = true; }
    ok('a substitution that matches TWICE also THROWS', threw2);
  }

  // ── D. THE STAGED RULES ACTUALLY TAKE EFFECT — and this is the assertion the whole
  //       `--rules` comparison rests on, because part of the FINDING is a cell that does
  //       NOT move, and "did not move" must never also be what a failed patch looks like.
  //
  // ⚠️ THE FIRST VERSION OF THE SECOND ASSERTION WAS WRONG AND IS KEPT HERE WITH THE
  // REASON, because the way it was wrong is the finding's actual shape. It read
  // `sushi/Catch` at θ=0 and required `path === displacement` — "displacement cannot help
  // a straight flee, because path and displacement are the same thing along a straight
  // line". It FAILED, 99 -> 104, and the failure was correct: **Big Catch is a 3-pellet 40°
  // FAN.** Its pellets launch off-axis and must turn back onto a target that is running, so
  // there is real curvature even in the cell whose name says "straight". The prediction
  // holds only where there is no fan at all, and the roster has exactly one such weapon —
  // Egg's Hatch! — which is what the assertion now names. Widening a tolerance to absorb
  // the 5 wu would have hidden the one clean measurement of the mechanism.
  {
    const dir = `${ROOT}/tools/tmp/.hm_selftest`;
    const disp = stageRule('displacement', `${dir}/disp`);
    const base = stageRule('path', `${dir}/path`);
    const a = await runRuleChild(base);
    const b = await runRuleChild(disp);
    const cell = (t, k, pat) => t[k].cells[Object.keys(t[k].cells).find((c) => c.startsWith(pat[0]) && c.endsWith(pat[1]))];
    // Fan weapon, perpendicular: maximum curvature, so displacement must buy the most.
    const perpA = cell(a, 'sushi/Catch', ['PLAYER', '@90']);
    const perpB = cell(b, 'sushi/Catch', ['PLAYER', '@90']);
    ok('the staged `displacement` sim CHANGES a perpendicular cell  <-- the patch demonstrably applied',
      perpB > perpA, `path ${perpA} -> displacement ${perpB}`);
    // SINGLE projectile, straight flee: zero curvature, so displacement must buy NOTHING.
    // This is the cell that carries the answer to the parked decision.
    const awayA = cell(a, 'egg/Hatch', ['PLAYER', '@0']);
    const awayB = cell(b, 'egg/Hatch', ['PLAYER', '@0']);
    ok('a NO-FAN homing shot fleeing straight is UNMOVED by displacement  <-- the finding, not a failed patch',
      awayA === awayB, `path ${awayA} = displacement ${awayB}`);
    ok('the control stage (`path`) reproduces the unstaged tree cell-for-cell',
      JSON.stringify(a) === JSON.stringify(reachJson()),
      'staged no-op == live');
    rmSync(dir, { recursive: true, force: true });
  }

  // ── E. THE SPEED LEVER HAS A MINIMUM-RANGE COST, AND IT IS NOT UNIFORM ─────
  //
  // The invariant first: as shipped, no homing weapon has a hole in its delivery curve
  // against a STATIONARY target. That is what makes a hole readable as a defect.
  {
    const bands = homingWeapons().map(({ id, w }) => [`${id}/${w.key}`, deadBand(id, w.key)]);
    ok('AS SHIPPED, no homing weapon drops below 100% on a STATIONARY target at any separation',
      bands.every(([, h]) => h.length === 0),
      bands.map(([k, h]) => `${k} ${h.length}`).join(' · '));
  }
  // …and the known-bad input, which is also the finding. Burrito's Topping Swarm is the
  // roster's WIDEST fan (55°). Move it to the rung that fixed Sushi and the same detector
  // must FIRE — otherwise "no dead band" above is a check that cannot fail.
  {
    const dir = `${ROOT}/tools/tmp/.hm_selftest_speed`;
    const staged = stageSpeed(
      'cooldown: 3000, speed: SPEED.maxSlow', 'cooldown: 3000, speed: SPEED.max',
      dir, "burrito/Swarm's rung maxSlow -> max");
    const { execFileSync } = await import('node:child_process');
    const out = execFileSync(process.execPath,
      [`${ROOT}/tools/tmp/hm_audit.mjs`, '--sim', staged, '--deadband-json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 });
    const holes = JSON.parse(out)['burrito/Swarm'];
    ok('…and moving the roster\'s WIDEST fan (55°) to that same rung OPENS one  <-- turn radius ∝ speed',
      holes.length > 0,
      holes.length ? `${holes.length} holes, e.g. ${holes[0].d} wu at ${(holes[0].frac * 100).toFixed(0)}%` : 'none');
    // Sushi's 40° fan on the SAME rung has none — which is why `0558bc5` was safe and why
    // the rung is not transferable between homing weapons on the strength of that commit.
    const sushi = JSON.parse(out)['sushi/Catch'];
    ok('…while the 40° fan already ON that rung stays clean  <-- the cost scales with fan width',
      sushi.length === 0, `sushi holes ${sushi.length}`);
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n   ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// main
// ═════════════════════════════════════════════════════════════════════════════

if (import.meta.main && args['deadband-json']) {
  const out = {};
  for (const { id, w } of homingWeapons()) out[`${id}/${w.key}`] = deadBand(id, w.key);
  process.stdout.write(JSON.stringify(out));
} else if (import.meta.main && args.json) {
  process.stdout.write(JSON.stringify(reachJson()));
} else if (import.meta.main && args.minrange) {
  minRangeTable();
} else if (import.meta.main && args.ladder) {
  ladderCensus();
} else if (import.meta.main && args.rules) {
  const dir = `${ROOT}/tools/tmp/.hm_rules`;
  const results = {};
  for (const rule of ['path', 'displacement', 'relative']) {
    results[rule] = await runRuleChild(stageRule(rule, `${dir}/${rule}`));
  }
  console.log(`\n══ HM_AUDIT --rules ══  effective reach under three retirement rules  ·  from ${FROM}`);
  console.log('\n   Every cell is the largest separation (wu) at which ONE press still delivers 100% of');
  console.log('   `pressValue`. θ=0 is a straight flee; θ=90 is perpendicular, where a homing shot has');
  console.log('   to TURN and therefore spends path without spending separation.\n');
  const keys = Object.keys(results.path);
  for (const k of keys) {
    console.log(`   ${k}   (speed ${results.path[k].speed} wu/s, range ${results.path[k].range} wu)`);
    const cells = Object.keys(results.path[k].cells);
    console.log(`      ${'cell'.padEnd(18)}${'path'.padStart(8)}${'displ'.padStart(8)}${'relative'.padStart(10)}`);
    for (const c of cells) {
      console.log(`      ${c.padEnd(18)}${String(results.path[k].cells[c]).padStart(8)}`
        + `${String(results.displacement[k].cells[c]).padStart(8)}`
        + `${String(results.relative[k].cells[c]).padStart(10)}`);
    }
    console.log('');
  }
  rmSync(dir, { recursive: true, force: true });
} else if (import.meta.main) {
  reachTable(`${SIM_DIR}`);
  console.log('');
}
