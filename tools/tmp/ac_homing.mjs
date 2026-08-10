#!/usr/bin/env node
/**
 * AC_HOMING — what does a homing volley deliver against a target that is MOVING?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `tools/tmp/ac_engage.mjs --mirror` puts the same character on both sides of a match,
 * `smart2` driving one and `ai.ts:stepAI` the other, so the kit, the pool ratio, the
 * speed ratio and the arena are identical and the ONLY difference is the driver. Sushi
 * comes back at **99.2%** to the scripted player — the largest driver gap in the roster
 * by 30 pp — and the per-weapon breakdown localises essentially all of it to one press:
 *
 *   weapon    P press  P dmg  P d/press  |  A press  A dmg  A d/press  |  pressValue
 *   Catch        2.02   53.6      26.48  |     2.02   25.6      12.65  |        27.0
 *
 * Both sides press Big Catch the same number of times, from the same separation, for the
 * same authored value. The scripted player collects 98% of it and `stepAI` collects 47%.
 * That is not a decision the AI is getting wrong — the decision is identical. It is what
 * happens to the projectile after it leaves, and the two sides are shooting at targets
 * that move at **very different speeds**: `PLAYER_SPEED` is 0.12 wu/ms and
 * `AI_CHASE_SPEED` is 0.07, a fixed 1.71x, so the AI's target is always the fast one.
 *
 * `ai.ts:PRESS_VALUE` prices a homing volley as landing WHOLE — *"the homing term steers
 * every pellet back onto the target, measured and confirmed (Burrito's 4-pellet 55° fan
 * delivers its full 20 at all eight separations)"* — and `sim.test.mjs` §20(b) pins that
 * against the real combat path in all 183 cells. **Every one of those cells is measured
 * against a STATIONARY target.** `tools/tmp/press_value.mjs` fires at eight SEPARATIONS;
 * nothing in the repo has ever fired at a moving one. So the ranking key both drivers
 * share is exact for the geometry it was validated on and silent about the one that
 * decides this matchup.
 *
 * ── What this measures ──────────────────────────────────────────────────────
 *
 * One press of one weapon at one separation, against a target on a prescribed constant
 * velocity — speed `S`, heading `θ` measured from "directly away from the attacker". The
 * target is ROOTED (`status.stunnedUntil` far in the future, which `stepAI` reads as
 * `rooted` and which suppresses movement and nothing else) and its position is written
 * each tick, so its trajectory is exactly the prescribed one rather than a driver's.
 * Delivered damage is read off `hit-landed`, and reported as a fraction of
 * `ai.ts:pressValue(w, d)` — the number both drivers believe they are buying.
 *
 * The mechanism it is testing is arithmetic and can be stated before the run:
 * `sim.ts:stepProjectiles` retires a projectile at `p.traveled >= w.range`, and
 * `traveled` is CUMULATIVE PATH LENGTH, not displacement. Big Catch has `range` 140 and
 * `speed` 160 wu/s, so it exists for **0.875 s and 140 wu of path, whichever comes
 * first** — and a curve spends path without spending separation. Against a target
 * receding at 120 wu/s the closing rate is 40 wu/s, so 140 wu of path buys 47 wu of
 * approach; against one receding at 70 it buys 79.
 *
 *   node tools/tmp/ac_homing.mjs --selftest
 *   node tools/tmp/ac_homing.mjs --char sushi --weapon Catch --sep 95
 *   node tools/tmp/ac_homing.mjs --all-homing
 *
 * ⚠️ NOT A WIN RATE AND NOT COMPARABLE TO ONE. Every figure here is delivered HP from a
 * single deterministic press with no RNG anywhere in it: re-running gives the same digits,
 * so there is no sampling floor to clear. The ~9 pp aggregate floor belongs to
 * `roster_lab.mjs` and must not be carried over to this table.
 */

import { resolve } from 'node:path';

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
const { createMatch, stepMatch } = await import(`${SIM_DIR}/sim.ts`);
const RULES = await import(`${SIM_DIR}/rules.ts`);
const { pressValue } = await import(`${SIM_DIR}/ai.ts`);
const {
  CHARACTERS, CHARACTER_IDS, PLAYER_SPEED, AI_CHASE_SPEED, AI_FLEE_SPEED, speedFor,
} = RULES;

const DT = Number(args.dt ?? 16.667);
const DEG = Math.PI / 180;

const CLEAR = {
  id: 'ac_homing', displayName: 'ac_homing', width: 4000, height: 4000,
  center: { x: 2000, y: 2000 }, maxSafeRadius: 100000,
  playerSpawn: { x: 1000, y: 2000 }, enemySpawn: { x: 3000, y: 2000 },
  cover: [], hazards: [], build: () => null, update: () => {},
};

/**
 * Fire ONE press of `weaponKey` from a stationary attacker at a target `sep` away that
 * then travels at `speed` wu/s on heading `thetaDeg` (0 = directly away from the
 * attacker, 90 = perpendicular, 180 = straight at it). Returns delivered HP.
 *
 * The target is held alive at a pool far above anything one press can spend, so a volley
 * is never truncated by a death, and the attacker is held alive so the match cannot end
 * underneath the measurement. Both are `rooted`, which `ai.ts` reads as "movement locked
 * and nothing else" — the same flag a stun sets, so the target's own driver contributes
 * no displacement and the prescribed trajectory is the whole trajectory.
 */
function fireOnce(charId, weaponKey, sep, speed, thetaDeg, { durationMs = 4000 } = {}) {
  const ws = CHARACTERS[charId].weapons;
  const idx = ws.findIndex((w) => w.key === weaponKey);
  if (idx < 0) throw new Error(`ac_homing: ${charId} has no weapon "${weaponKey}"`);
  const w = ws[idx];

  const st = createMatch(CLEAR, charId, charId);
  const IDLE = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  while (st.phase !== 'playing') stepMatch(st, DT, IDLE);

  const AX = 2000, AY = 2000;
  const vx = Math.cos(thetaDeg * DEG) * speed;
  const vy = Math.sin(thetaDeg * DEG) * speed;

  let t = 0, dealt = 0, fired = false;
  const HUGE = 1e7;
  while (t < durationMs) {
    // The attacker never moves; the target follows the prescribed line exactly.
    st.player.x = AX; st.player.y = AY;
    st.enemy.x = AX + sep + (vx * t) / 1000;
    st.enemy.y = AY + (vy * t) / 1000;
    st.player.hp = HUGE; st.player.maxHp = HUGE;
    st.enemy.hp = HUGE; st.enemy.maxHp = HUGE;
    // Root BOTH: the target so its driver adds no displacement, the attacker so nothing
    // it does can move it off the origin between the pin and the projectile step.
    st.player.status.stunnedUntil = st.elapsed + HUGE;
    st.enemy.status.stunnedUntil = st.elapsed + HUGE;

    const input = fired
      ? IDLE
      : { move: { x: 0, y: 0 }, aim: { x: st.enemy.x - AX, y: st.enemy.y - AY }, selectedWeapon: idx, attack: true };
    const evs = stepMatch(st, DT, input);
    for (const ev of evs) {
      if (ev.type === 'weapon-fired' && ev.fighterRole === 'player' && ev.weaponKey === weaponKey) fired = true;
      else if (ev.type === 'hit-landed' && ev.targetRole === 'enemy' && ev.source?.weaponKey === weaponKey) {
        dealt += ev.amount;
      }
    }
    t += DT;
  }
  return { dealt, expected: pressValue(w, sep), weapon: w };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest
// ═════════════════════════════════════════════════════════════════════════════
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log(`\n══ ac_homing SELFTEST ══  sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);

  // ── A. AGAINST A STATIONARY TARGET THE FIXTURE REPRODUCES `pressValue` ─────
  //
  // This is the calibration that makes every other cell readable: `press_value.mjs`
  // already proved `pressValue` exact in all 183 weapon-band cells against a stationary
  // target, so at speed 0 this rig must return the same answer or the rig is the thing
  // that is wrong. Run across all three homing weapons AND a non-homing spread, so a
  // fixture that only works for one shape cannot pass.
  for (const [id, key, sep] of [['sushi', 'Catch', 95], ['burrito', 'Swarm', 95],
    ['egg', 'Hatch', 95], ['sushi', 'Rice', 40], ['waterbottle', 'Glass', 100]]) {
    const r = fireOnce(id, key, sep, 0, 0);
    ok(`stationary target: ${id}/${key} at ${sep} wu delivers exactly pressValue`,
      Math.abs(r.dealt - r.expected) < 1e-9, `${r.dealt} vs ${r.expected}`);
  }

  // ── B. THE RIG CAN READ A MISS — and the known-bad input is a target that
  //       simply outruns the projectile.
  {
    const r = fireOnce('sushi', 'Catch', 95, 400, 0);
    ok('a target receding faster than the projectile takes ZERO  <-- the rig can read a miss',
      r.dealt === 0, `${r.dealt} of ${r.expected}`);
    // …and the SAME speed straight at the attacker still lands, so "0" above is about the
    // direction and not about the rig refusing to score fast targets at all.
    const toward = fireOnce('sushi', 'Catch', 95, 400, 180);
    ok('…while the same speed straight AT the attacker still lands in full',
      Math.abs(toward.dealt - toward.expected) < 1e-9, `${toward.dealt} of ${toward.expected}`);
  }

  // ── C. THE TARGET REALLY IS ON THE PRESCRIBED LINE ─────────────────────────
  //
  // If the pin were not holding, the target's own `stepAI` would walk it toward the
  // attacker and every "receding" cell would quietly become a closing one. Asserted by
  // the geometry rather than by inspection: a target moving perpendicular at exactly the
  // projectile's own speed cannot be caught by a turn rate this low, and a stationary one
  // always is.
  {
    const perp = fireOnce('sushi', 'Catch', 95, 160, 90);
    const still = fireOnce('sushi', 'Catch', 95, 0, 90);
    ok('perpendicular flight at the projectile\'s own speed loses ground on a stationary one',
      perp.dealt < still.dealt, `${perp.dealt} vs ${still.dealt}`);
  }
  {
    const a = fireOnce('sushi', 'Catch', 95, 120, 0);
    const b = fireOnce('sushi', 'Catch', 95, 120, 0);
    ok('the rig is deterministic (no RNG anywhere in it)', a.dealt === b.dealt, `${a.dealt} twice`);
  }

  // ── D. IT IS NOT ALWAYS-ZERO AND NOT ALWAYS-FULL ───────────────────────────
  //
  // ⚠️ THE FIRST VERSION OF THIS ASSERTION WAS WRONG AND IS KEPT HERE WITH THE REASON.
  // It read `fireOnce('sushi','Catch',95,120,0)` — 120 wu/s directly away — and required
  // the result to be strictly between 0 and `pressValue`. It FAILED, at 0 of 27, and the
  // failure was the finding rather than a bug: a `PLAYER_SPEED` target running straight
  // away from Big Catch takes NOTHING, not "less". Because a volley is 3 pellets that
  // expire independently, the partial cells are the OFF-AXIS ones, so that is where
  // non-degeneracy has to be asserted. Fixing it by widening the tolerance would have
  // hidden the sharpest number in the table.
  {
    const partial = [
      fireOnce('sushi', 'Catch', 95, 120, 90),   // perpendicular at player speed
      fireOnce('sushi', 'Catch', 95, 85, 45),    // 45° at flee speed
    ];
    ok('some cell IS strictly partial — the rig resolves more than {0, full}',
      partial.every((r) => r.dealt > 0 && r.dealt < r.expected),
      partial.map((r) => `${r.dealt}/${r.expected}`).join('  '));
  }
  // ── E. A NON-HOMING projectile is UNAFFECTED by the target's heading past the
  //       point of no return, because it never re-aims. If this failed, the rig
  //       would be measuring something other than the homing term.
  {
    const away = fireOnce('sushi', 'Seaweed', 60, 120, 0);
    const still = fireOnce('sushi', 'Seaweed', 60, 0, 0);
    ok('a NON-homing shot is degraded by a receding target too (it is a race, not a defect)',
      away.dealt <= still.dealt, `away ${away.dealt} vs still ${still.dealt}`);
  }

  console.log(`\n   ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// The sweep
// ═════════════════════════════════════════════════════════════════════════════

/** The speeds that actually occur in a match, named, so a row is readable as a role. */
function speedRows(charId) {
  const p = speedFor(charId, PLAYER_SPEED) * 1000;
  const c = speedFor(charId, AI_CHASE_SPEED) * 1000;
  const f = speedFor(charId, AI_FLEE_SPEED) * 1000;
  return [
    { s: 0, label: 'stationary' },
    { s: c, label: `AI chase  ${c.toFixed(0)}` },
    { s: f, label: `AI flee   ${f.toFixed(0)}` },
    { s: p, label: `PLAYER    ${p.toFixed(0)}` },
  ];
}

const THETAS = [0, 45, 90, 135, 180];

function sweep(charId, weaponKey, sep) {
  const ws = CHARACTERS[charId].weapons;
  const w = ws.find((x) => x.key === weaponKey);
  const expected = pressValue(w, sep);
  console.log(`\n══ AC_HOMING ══  ${charId} / ${w.name}  ·  separation ${sep} wu`);
  console.log(`   range ${w.range} wu · speed ${w.speed} wu/s · lifetime ${(w.range / w.speed * 1000).toFixed(0)} ms`
    + `${w.homing ? ' · HOMING' : ''} · pressValue here ${expected}`);
  console.log(`\n   target speed        ` + THETAS.map((t) => `${t === 0 ? 'away' : t === 90 ? 'perp' : t === 180 ? 'at' : `${t}°`}`.padStart(9)).join('') + '     mean');
  const rows = [];
  for (const { s, label } of speedRows(charId)) {
    const vals = THETAS.map((t) => fireOnce(charId, weaponKey, sep, s, t).dealt);
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    rows.push({ label, s, vals, m });
    console.log(`   ${label.padEnd(18)}  `
      + vals.map((v) => `${((v / expected) * 100).toFixed(0)}%`.padStart(9)).join('')
      + `${((m / expected) * 100).toFixed(0)}%`.padStart(9));
  }
  const chase = rows.find((r) => r.label.startsWith('AI chase'));
  const player = rows.find((r) => r.label.startsWith('PLAYER'));
  if (chase && player) {
    console.log(`\n   >> a press aimed at a CHASE-speed target is worth ${(chase.m / expected * 100).toFixed(0)}% of ${expected};`
      + ` at a PLAYER-speed target ${(player.m / expected * 100).toFixed(0)}%.`);
    console.log(`      The PLAYER always shoots at the slow one and the AI always shoots at the fast one, so this`);
    console.log(`      weapon is worth ${(chase.m / (player.m || 1)).toFixed(2)}x more in the player's hands with no decision changing.`);
  }
  return { charId, weaponKey, sep, expected, rows };
}

if (args['all-homing']) {
  const out = [];
  for (const id of CHARACTER_IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (!w.homing) continue;
      out.push(sweep(id, w.key, Number(args.sep ?? 95)));
    }
  }
  console.log(`\n══ SUMMARY ══  every homing weapon in the roster, at ${Number(args.sep ?? 95)} wu\n`);
  console.log(`   character / weapon        speed  lifetime   vs CHASE   vs PLAYER    ratio`);
  for (const r of out) {
    const w = CHARACTERS[r.charId].weapons.find((x) => x.key === r.weaponKey);
    const c = r.rows.find((x) => x.label.startsWith('AI chase')).m;
    const p = r.rows.find((x) => x.label.startsWith('PLAYER')).m;
    console.log(`   ${`${r.charId}/${r.weaponKey}`.padEnd(24)} ${String(w.speed).padStart(5)}`
      + ` ${`${(w.range / w.speed * 1000).toFixed(0)}ms`.padStart(9)}`
      + ` ${`${((c / r.expected) * 100).toFixed(0)}%`.padStart(10)} ${`${((p / r.expected) * 100).toFixed(0)}%`.padStart(11)}`
      + ` ${(c / (p || 1)).toFixed(2).padStart(8)}x`);
  }
  console.log('');
} else {
  sweep(String(args.char ?? 'sushi'), String(args.weapon ?? 'Catch'), Number(args.sep ?? 95));
  console.log('');
}
