#!/usr/bin/env node
/**
 * TF_REACH — does a weapon connect at its own press gate? All 28 ranged weapons,
 * measured on the real sim, against a target that is RUNNING.
 *
 * ── The question, and why `hm_audit --ladder` cannot answer it any more ──────
 *
 * `ai.ts:pickWeapon` refuses to press past `w.range`, so `range` is the separation a
 * fighter BELIEVES the weapon works at. `sim.ts:stepProjectiles` retires the shot on a
 * budget denominated in the same number. Those two readings coincide only when the
 * target is standing still, and `press_value.mjs`'s 183 validated cells are all
 * stationary — so the gap between them was invisible for a year.
 *
 * `hm_audit --ladder` prints the CLOSED FORM of that gap under the shipped rule:
 *
 *     reach = range − S·flight + hitRadius
 *
 * That law is a property of the retirement rule, not of the game. `DECISIONS §50b`
 * changes the retirement rule, so the closed form stops describing the sim — and a
 * table computed from arithmetic would keep printing the OLD answer with total
 * confidence on a tree where it is false. This tool therefore measures the SIM, on
 * whatever `--sim` it is pointed at, and prints the closed form beside it as a control:
 *
 *   * on a tree with the shipped path-length rule the two columns must AGREE (that is
 *     the instrument validating itself against a law two other tools already published);
 *   * on a tree with the target-frame rule they must DIVERGE, and the direction of the
 *     divergence is the whole finding.
 *
 * ── What is measured ────────────────────────────────────────────────────────
 *
 *   EFFECTIVE REACH   the largest separation at which ONE press still delivers, against
 *                     a target receding in a straight line at a named role speed.
 *                     `full` = the whole of `ai.ts:pressValue` (what the driver believes
 *                     it is buying); `any` = a single point of damage.
 *
 * The press rig is `ac_homing.fireOnce` — imported, never copied, for the reason
 * `driver_guard.mjs` exists: it carries 11 assertions against known-bad inputs and a
 * second copy of it would carry none. `--sim` is read from `process.argv`, which the
 * import shares, so pointing this tool at an extracted tree points the rig at the same
 * one with no extra wiring.
 *
 * A LINEAR SCAN, not a bisection: delivery is only approximately monotone in separation
 * (a fan can clip a target the axis shot misses, and the tick grid quantises everything),
 * so a bisection would report whichever side of a one-wu non-monotonicity it landed on.
 *
 *   node tools/tmp/tf_reach.mjs --selftest
 *   node tools/tmp/tf_reach.mjs                       # working tree
 *   node tools/tmp/tf_reach.mjs --sim /tmp/head/src/game --json /tmp/tf.before.json
 *   node tools/tmp/tf_reach.mjs --baseline /tmp/tf.before.json
 *
 * ⚠️ NOT A WIN RATE. Every figure here is a deterministic single press with no RNG in
 * it: re-running gives the same digits and there is no sampling floor to clear. The
 * ~9 pp aggregate floor belongs to `roster_lab.mjs` and must not be carried over. The
 * resolution of a reach is the 1 wu scan step.
 *
 * ⚠️ `durationMs` IS PART OF THE MEASUREMENT AND MUST MATCH ACROSS ARMS. The shipped
 * rule kills every shot inside `range/speed` (1750 ms at worst); the target-frame rule
 * can keep one alive for `range/(speed − PLAYER_SPEED)` = 3500 ms. A window sized for
 * the old rule would clip the new one and report a reach that is really a timeout.
 */

import { resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
import { fireOnce } from './ac_homing.mjs';

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
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { pressValue } = await import(`${SIM_DIR}/ai.ts`);
const {
  CHARACTERS, CHARACTER_IDS, PLAYER_SPEED, AI_CHASE_SPEED, speedFor, HIT_RADIUS_VS_ENEMY,
} = RULES;

/** `fireOnce` fires from the PLAYER seat at the ENEMY seat, so this is the radius in play. */
const HIT_R = HIT_RADIUS_VS_ENEMY;
/** Long enough for the slowest legal chase under EITHER retirement rule. See the header. */
const WINDOW_MS = Number(args.window ?? 5000);
const STEP = Number(args.step ?? 1);

/** The fastest a fighter runs in each role — read off the roster, never hardcoded. */
const topHuman = Math.max(...CHARACTER_IDS.map((id) => speedFor(id, PLAYER_SPEED) * 1000));
const topChase = Math.max(...CHARACTER_IDS.map((id) => speedFor(id, AI_CHASE_SPEED) * 1000));

/** Every ranged weapon in the roster, in roster order. */
function rangedWeapons() {
  const out = [];
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (w.type !== 'ranged' || !w.speed || !w.range) continue;
      out.push({ id, w });
    }
  }
  return out;
}

/**
 * The largest separation at which one press of `id`/`key` still delivers at least
 * `frac` of `pressValue`, against a target receding at `speed` wu/s on heading
 * `thetaDeg` (0 = directly away from the attacker).
 *
 * Bounded by `range` because `pickWeapon` refuses to press past it: a reach beyond the
 * press gate is unreachable in a match and reporting it would overstate the weapon.
 */
function effectiveReach(id, key, speed, thetaDeg, frac) {
  const w = CHARACTERS[id].weapons.find((x) => x.key === key);
  let best = 0;
  for (let d = STEP; d <= (w.range ?? 0); d += STEP) {
    const pv = pressValue(w, d);
    if (pv <= 0) continue;
    const { dealt } = fireOnce(id, key, d, speed, thetaDeg, { durationMs: WINDOW_MS });
    if (frac > 0 ? dealt >= frac * pv - 1e-9 : dealt > 0) best = d;
  }
  return best;
}

/** `range − S·flight + hitRadius` — the SHIPPED path-length rule, before any code runs. */
function analyticReach(w, S) {
  const flight = (w.range / w.speed) * 1000;
  return w.range - (S * flight) / 1000 + HIT_R;
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — the rig must be able to read a hit, a miss, and the difference
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main && args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ tf_reach SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  // ⚠️ WAS `=== 23`. **23 -> 28 on 2026-08-24**, Uri's kit shape (`rules.ts:WeaponSlot`,
  // 11 characters x 4 slots): six new ranged weapons, minus `waterbottle.Glass` which left
  // the ranged set for the melee slot. 23 + 6 - 1 = 28.
  // 🚨 THIS ROW IS A NON-VACUITY GUARD, NOT THE FINDING, and it is deliberately still a
  // LITERAL rather than `CHARACTERS`-derived: derived, it would agree with the tree by
  // construction and could never notice a weapon silently leaving the scan. The price is
  // that a roster change must re-record it by hand, which is what just happened.
  ok('the roster still has 28 ranged weapons', rangedWeapons().length === 28, `${rangedWeapons().length}`);
  ok('the role speeds are read off the roster, not assumed',
    topHuman > topChase && topHuman > 0, `human ${topHuman.toFixed(1)} · AI ${topChase.toFixed(1)}`);

  // ── A. AGAINST A STATIONARY TARGET REACH IS THE FULL GATE ─────────────────
  //
  // The one cell every retirement rule ever proposed agrees on, which is exactly what
  // makes it the calibration: if a tree disagrees HERE, the change broke the stationary
  // case and nothing else in this table is readable.
  for (const [id, key] of [['hamburger', 'Lettuce'], ['sushi', 'Catch'], ['egg', 'Hatch']]) {
    const w = CHARACTERS[id].weapons.find((x) => x.key === key);
    const r = effectiveReach(id, key, 0, 0, 1);
    ok(`stationary target: ${id}/${key} reaches its full gate (${w.range})`, r === w.range, `${r}`);
  }

  // ── B. KNOWN-BAD: A TARGET THAT SIMPLY OUTRUNS THE SHOT ───────────────────
  //
  // ⚠️ AND THE CONTROL HAS TO BE ABLE TO DISTINGUISH THE ARMS. A target at 400 wu/s
  // outruns EVERY projectile in the roster under EVERY rule proposed, so a green row
  // here says nothing about the retirement rule — it says the rig can read a zero. It is
  // paired with the row below, which is the same speed pointed the other way.
  //
  // ⚠️ AND THE FIRST DRAFT OF THIS ROW ASSERTED `=== 0` AND WAS WRONG ABOUT THE GAME,
  // not about the rig. At 400 wu/s the reach measures **30 wu**, not 0: `fireOnce` pins
  // the target at its position for tick `t` and the projectile then takes its step inside
  // that same tick, so a shot fired from inside "already touching you" lands before the
  // target has a tick to run. That is not a fixture defect — it is true of the game (you
  // cannot outrun a shot fired at 30 wu in the first 17 ms), and asserting `0` would have
  // pinned this row to a lie. The claim that survives is that the reach COLLAPSES to
  // point-blank, stated against the hit radius rather than against a literal.
  {
    const r = effectiveReach('sushi', 'Catch', 400, 0, 0);
    ok(`KNOWN-BAD: a target receding at 400 wu/s collapses the reach to point-blank (<= hitRadius + 5 = ${HIT_R + 5})`,
      r > 0 && r <= HIT_R + 5, `${r} wu`);
    const at95 = fireOnce('sushi', 'Catch', 95, 400, 0, { durationMs: WINDOW_MS }).dealt;
    ok('…and at ac_homing\'s own published 95 wu cell it delivers exactly ZERO', at95 === 0, `${at95}`);
    const toward = effectiveReach('sushi', 'Catch', 400, 180, 1);
    const w = CHARACTERS.sushi.weapons.find((x) => x.key === 'Catch');
    ok('…while the same speed straight AT the attacker still reaches the full gate — so the zero is about DIRECTION',
      toward === w.range, `${toward}`);
  }

  // ── C. THE SCAN IS A MAXIMUM, NOT A FIRST-FAILURE ─────────────────────────
  //
  // `frac: 0` must be >= `frac: 1` for every weapon, since "any damage" is implied by
  // "full damage". A scan that stopped at the first hole would break this on any fan.
  {
    let bad = null;
    for (const { id, w } of rangedWeapons()) {
      const full = effectiveReach(id, w.key, topHuman, 0, 1);
      const any = effectiveReach(id, w.key, topHuman, 0, 0);
      if (any < full) bad = `${id}/${w.key} any ${any} < full ${full}`;
    }
    ok('reach@any >= reach@full for all 23 — the scan takes a maximum over the whole domain', bad === null, bad ?? '');
  }

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the table
// ═════════════════════════════════════════════════════════════════════════════
if (import.meta.main) {
  const t0 = Date.now();
  const rows = [];
  for (const { id, w } of rangedWeapons()) {
    rows.push({
      key: `${id}/${w.key}`,
      range: w.range,
      speed: w.speed,
      flightMs: Math.round((w.range / w.speed) * 1000),
      homing: !!w.homing,
      pellets: w.pellets ?? (w.comboParts ? w.comboParts.length : 1),
      analyticHuman: analyticReach(w, topHuman),
      analyticAI: analyticReach(w, topChase),
      human: effectiveReach(id, w.key, topHuman, 0, 1),
      humanAny: effectiveReach(id, w.key, topHuman, 0, 0),
      ai: effectiveReach(id, w.key, topChase, 0, 1),
      perp: effectiveReach(id, w.key, topHuman, 90, 1),
    });
  }

  const base = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;
  const byKey = base ? Object.fromEntries(base.rows.map((r) => [r.key, r])) : null;

  console.log(`\n══ TF_REACH ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   S = the fastest fighter in each role, read off the roster: human ${topHuman.toFixed(0)} wu/s · AI chase ${topChase.toFixed(0)} wu/s.`);
  console.log(`   "gate" is the separation \`pickWeapon\` will press from. "shipped-law" is \`range − S·flight + hitRadius\`.\n`);
  console.log(`   ${'weapon'.padEnd(22)}${'gate'.padStart(5)}${'v'.padStart(5)}${'shipped-law'.padStart(12)}`
    + `${'reach/human'.padStart(12)}${base ? '  (was)' : ''}${'reach/AI'.padStart(10)}${base ? '  (was)' : ''}${'perp'.padStart(7)}  flags`);
  for (const r of rows) {
    const b = byKey?.[r.key];
    console.log(`   ${r.key.padEnd(22)}${String(r.range).padStart(5)}${String(r.speed).padStart(5)}`
      + `${r.analyticHuman.toFixed(0).padStart(12)}`
      + `${String(r.human).padStart(12)}${b ? `  (${String(b.human).padStart(3)})` : ''}`
      + `${String(r.ai).padStart(10)}${b ? `  (${String(b.ai).padStart(3)})` : ''}`
      + `${String(r.perp).padStart(7)}  ${r.homing ? 'HOMING ' : ''}${r.pellets > 1 ? `x${r.pellets}` : ''}`);
  }

  const shortHuman = rows.filter((r) => r.human < r.range).length;
  const shortAI = rows.filter((r) => r.ai < r.range).length;
  const matchesLaw = rows.filter((r) => Math.abs(r.human - r.analyticHuman) <= 3).length;
  console.log(`\n   >> ${shortHuman} of ${rows.length} ranged weapons cannot connect at their own press gate against a fleeing human.`);
  console.log(`   >> ${shortAI} of ${rows.length} cannot connect at their own press gate against a fleeing AI.`);
  console.log(`   >> ${matchesLaw} of ${rows.length} sit within 3 wu of the SHIPPED path-length law — the control on which rule this tree runs.`);
  console.log('');

  if (args.json) {
    writeFileSync(String(args.json), JSON.stringify({ sim: SIM_DIR, topHuman, topChase, windowMs: WINDOW_MS, rows }, null, 2));
    console.log(`wrote ${args.json}\n`);
  }
}
