#!/usr/bin/env node
/**
 * PRESS VALUE — how much damage ONE PRESS of a weapon actually delivers, at range,
 * measured through the real combat path.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `ai.ts:pickHighestDamageWeapon` (and the scripted player's `bestWeapon` in every
 * instrument in `tools/`) ranks weapons by the AUTHORED `damage` field. That field is
 * per-PELLET, per-PECK and — for a combo weapon — not the damage at all:
 *
 *     Burrito  Topping Swarm   damage 5  x 4 pellets   ranks BELOW  Burrito Disc 10
 *     Egg      Hatch!          damage 5  x 3 pecks     ranks BELOW  Egg Tackle 16
 *     Taco     Double Toss     damage 0  + comboParts 14+9 = 23     ranks BELOW everything
 *
 * So the picker's key and the thing it is trying to maximise are different numbers.
 *
 * ── Why it is not `pellets x damage` ────────────────────────────────────────
 *
 * Because that is not delivered either. `combat.ts` fans pellet `i` out at
 * `(i - (n-1)/2) * spreadDeg`, and `sim.ts:stepProjectiles` only lands a hit inside
 * `HIT_RADIUS_VS_PLAYER` (25.2 wu). A pellet at 27.5 deg is 46 wu off-axis at 100 wu of
 * range — it MISSES a stationary target, and it misses further the further away the
 * target is. Spread, flight time, range expiry and homing all bite, and only the sim
 * knows by how much. `kit_dps.mjs` computes the arithmetic upper bound and says so;
 * this measures the real thing.
 *
 * ── Method ──────────────────────────────────────────────────────────────────
 *
 * Nothing here is a model. The attacker is the ENEMY (so the hit radius is the one the
 * AI's shots are actually tested against), it fires through `combat.ts:attemptAttack`
 * — the same function the game calls — and the projectiles are stepped by the real
 * `stepMatch`, with `phase` parked on `ended` so that the ONLY thing moving in the
 * fixture is the shot under test. Damage is read off `hit-landed` events.
 *
 * Two target behaviours, because they answer different questions:
 *   pinned  — a stationary target dead on the axis. The upper bound the picker is
 *             implicitly assuming when it says "this weapon is worth 10".
 *   strafe  — the target walks perpendicular at PLAYER_SPEED from the moment of the
 *             press. What a weapon is worth against something that is not cooperating,
 *             and the only place homing shows up as a property rather than a flag.
 *
 *   node tools/tmp/press_value.mjs                     # per-character table
 *   node tools/tmp/press_value.mjs --target strafe
 *   node tools/tmp/press_value.mjs --cost              # what the damage-ranking rule costs
 *   node tools/tmp/press_value.mjs --estimator         # validate the ai.ts estimator
 *   node tools/tmp/press_value.mjs --selftest          # known-input validation
 *   node tools/tmp/press_value.mjs --sim /tmp/staged/game
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
const { attemptAttack } = await import(`${SIM_DIR}/combat.ts`);
const R = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH, HIT_RADIUS_VS_PLAYER, PLAYER_SPEED } = R;

const DT = Number(args.dt ?? 16.667);
const TARGET_MODE = String(args.target ?? 'pinned');
/** Long enough for the slowest projectile (80 wu/s) to cross the longest range (140 wu)
 *  and for Egg's three pecks at 500 ms to resolve, with margin. */
const FLIGHT_BUDGET_MS = 4000;

/** Distances the AI actually decides at. Every REACH rung, plus the gaps between them. */
const BANDS = Number.isFinite(Number(args.d))
  ? [Number(args.d)]
  : [40, 58, 70, 84, 98, 116, 128, 140];

function fixture() {
  return {
    id: 'press-value', displayName: 'Press Value',
    width: 4000, height: 4000, center: { x: 2000, y: 2000 },
    maxSafeRadius: 1e6, // no fog: this probe is about one press
    playerSpawn: { x: 2100, y: 2000 }, enemySpawn: { x: 2000, y: 2000 },
    cover: [], hazards: [], build: () => ({}),
  };
}

/**
 * Damage ONE press of `weapons[wi]` delivers to the player, fired by the enemy from
 * `d` wu away. Returns 0 for a press that connects with nothing (out of range, out of
 * cone, every pellet wide).
 */
function pressValue(attackerId, targetId, wi, d, mode = TARGET_MODE) {
  const state = createMatch(fixture(), targetId, attackerId);
  state.phase = 'playing';
  const ex = 2000, ey = 2000;
  state.enemy.x = ex; state.enemy.y = ey;
  state.player.x = ex + d; state.player.y = ey;
  // Immortal on both sides: this probe measures what a press DELIVERS, and a target
  // that dies half way through a peck chain measures the target's HP instead.
  state.player.hp = 1e9; state.player.maxHp = 1e9;
  state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
  // Aimed. A melee cone that misses because the fixture forgot to face the target is
  // the probe's bug, not the weapon's.
  state.enemy.facing = { x: 1, y: 0 };

  let dealt = 0;
  const take = (evs) => {
    for (const ev of evs) {
      if (ev.type !== 'hit-landed') continue;
      if (ev.targetRole !== 'player') continue;
      if ((ev.source?.kind ?? '') !== 'weapon') continue;
      dealt += ev.amount;
    }
  };

  const fired = [];
  attemptAttack(state, 'enemy', wi, fired);
  take(fired);

  // Park the phase so the playing block — aim, player movement, `stepAI`, the world
  // tick — is skipped entirely, while `stepProjectiles` keeps running (it is
  // deliberately never gated on phase; see sim.ts). Nothing in the fixture moves now
  // except the shot under test and, in strafe mode, the target.
  state.phase = 'ended';
  const noInput = { move: { x: 0, y: 0 }, selectedWeapon: 0, attack: false };
  for (let t = 0; t < FLIGHT_BUDGET_MS; t += DT) {
    if (state.projectiles.length === 0) break;
    if (mode === 'strafe') {
      // Perpendicular to the shot, at the player's real top speed.
      state.player.y = ey + (PLAYER_SPEED * (t + DT)) / 1000;
    } else {
      state.player.x = ex + d; state.player.y = ey;
    }
    take(stepMatch(state, DT, noInput));
  }
  return dealt;
}

/** What the SHIPPED rule ranks by. Verbatim from `ai.ts:pickHighestDamageWeapon`. */
const authoredDamage = (w) => w.damage ?? 0;

/**
 * The candidate ranking key, computed the way `ai.ts` would have to compute it: from
 * the weapon record and the current separation, with no sim. Validated against the
 * measured value by `--estimator`.
 */
function estimatePressValue(w, d) {
  if (w.type === 'self') return 0;
  if (w.type === 'melee') return d <= (w.range ?? 0) ? w.damage ?? 0 : 0;
  if (d > (w.range ?? Infinity)) return 0;
  if (w.comboParts) {
    let sum = 0;
    for (const p of w.comboParts) {
      if (Math.abs(d * Math.sin((p.angle * Math.PI) / 180)) < HIT_RADIUS_VS_PLAYER) sum += p.damage;
    }
    return sum;
  }
  const per = (w.damage ?? 0) * (w.peckHits ?? 1);
  const n = w.pellets ?? 1;
  if (n <= 1) return per;
  if (w.homing) return per * n;
  const spread = w.spreadDeg ?? 0;
  let landing = 0;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * spread;
    if (Math.abs(d * Math.sin((off * Math.PI) / 180)) < HIT_RADIUS_VS_PLAYER) landing++;
  }
  return per * landing;
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — validate against KNOWN inputs before believing an unknown one.
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`  FAIL ${name}  ${detail}`); } };
  const idx = (id, key) => CHARACTERS[id].weapons.findIndex((w) => w.key === key);

  // 1. A single-projectile weapon delivers exactly its authored damage.
  const filling = pressValue('taco', 'donut', idx('taco', 'Filling'), 60, 'pinned');
  ok('single projectile == authored damage', filling === 12, `got ${filling} want 12`);

  // 2. A melee swing inside range delivers its authored damage; outside range, zero.
  const smashIn = pressValue('lollipop', 'donut', idx('lollipop', 'Smash'), 60, 'pinned');
  const smashOut = pressValue('lollipop', 'donut', idx('lollipop', 'Smash'), 200, 'pinned');
  ok('melee in range', smashIn === 16, `got ${smashIn} want 16`);
  ok('melee out of range', smashOut === 0, `got ${smashOut} want 0`);

  // 3. peckHits multiply: Egg's Hatch is authored 5 and delivers 3 x 5.
  const hatch = pressValue('egg', 'donut', idx('egg', 'Hatch'), 60, 'pinned');
  ok('peckHits multiply', hatch === 15, `got ${hatch} want 15 (5 x 3)`);

  // 4. A combo weapon authored `damage: 0` delivers its parts.
  const dbl = pressValue('taco', 'donut', idx('taco', 'Double'), 60, 'pinned');
  ok('comboParts deliver despite damage:0', dbl === 23, `got ${dbl} want 23 (14+9)`);

  // 5. Spread bites with distance: a 5-pellet spray delivers strictly less at 98 wu
  //    than at point blank.
  const riceNear = pressValue('sushi', 'donut', idx('sushi', 'Rice'), 40, 'pinned');
  const riceFar = pressValue('sushi', 'donut', idx('sushi', 'Rice'), 98, 'pinned');
  ok('spread bites at range', riceFar < riceNear, `near ${riceNear} far ${riceFar}`);

  // 6. The probe cannot manufacture damage the weapon does not have: an off-cooldown
  //    press against a target 10x past every range delivers nothing, for every weapon.
  let leaked = 0;
  for (const id of CHARACTER_IDS) {
    CHARACTERS[id].weapons.forEach((w, i) => {
      if (w.type === 'self') return;
      if (pressValue(id, 'donut', i, 1500, 'pinned') !== 0) leaked++;
    });
  }
  ok('no damage past every range', leaked === 0, `${leaked} weapons leaked`);

  console.log(`\npress_value selftest: ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// tables
// ─────────────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n, dp = 1) => String(typeof v === 'number' ? v.toFixed(dp) : v).padStart(n);

/** The weapon the SHIPPED rule picks at `d`, and the one that actually delivers most. */
function decideAt(id, d, mode) {
  const ws = CHARACTERS[id].weapons;
  let shipped = null, shippedKey = -Infinity;
  let best = null, bestVal = -Infinity;
  const vals = [];
  ws.forEach((w, i) => {
    if (w.type === 'self') { vals.push(null); return; }
    if (d > (w.range ?? Infinity)) { vals.push(null); return; }
    const a = authoredDamage(w);
    if (a > shippedKey) { shippedKey = a; shipped = i; }
    const v = pressValue(id, 'donut', i, d, mode);
    vals.push(v);
    if (v > bestVal) { bestVal = v; best = i; }
  });
  return { shipped, best, vals, shippedVal: shipped === null ? 0 : vals[shipped] ?? 0, bestVal: best === null ? 0 : bestVal };
}

if (args.cost) {
  console.log(`\nPRESS-VALUE COST OF THE DAMAGE RANKING — target ${TARGET_MODE}, sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
  console.log(`delivered damage per press, at each band the AI can decide in. "lost" = best - shipped.\n`);
  console.log(`${pad('character', 12)}${BANDS.map((d) => String(d).padStart(6)).join('')}   ${'mean lost'.padStart(10)}  bands wrong`);
  const rows = [];
  for (const id of CHARACTER_IDS) {
    const lost = [];
    let wrong = 0;
    for (const d of BANDS) {
      const r = decideAt(id, d, TARGET_MODE);
      const l = r.bestVal - r.shippedVal;
      lost.push(l);
      if (r.shipped !== r.best && l > 1e-9) wrong++;
    }
    const mean = lost.reduce((a, b) => a + b, 0) / lost.length;
    rows.push({ id, lost, mean, wrong });
  }
  rows.sort((a, b) => b.mean - a.mean);
  for (const r of rows) {
    console.log(`${pad(r.id, 12)}${r.lost.map((l) => num(l, 6)).join('')}   ${num(r.mean, 10, 2)}  ${r.wrong}/${BANDS.length}`);
  }
  const agg = rows.reduce((a, r) => a + r.mean, 0) / rows.length;
  console.log(`\nroster mean loss ${agg.toFixed(2)} HP per press · ${rows.filter((r) => r.wrong > 0).length}/11 characters mis-rank in at least one band\n`);

  console.log(`── WHICH WEAPON, WHERE ── shipped pick -> best pick, only where they differ`);
  for (const id of CHARACTER_IDS) {
    const ws = CHARACTERS[id].weapons;
    const lines = [];
    for (const d of BANDS) {
      const r = decideAt(id, d, TARGET_MODE);
      if (r.shipped === r.best || r.bestVal - r.shippedVal <= 1e-9) continue;
      lines.push(`      ${String(d).padStart(4)} wu  ${pad(ws[r.shipped].key, 9)} ${num(r.shippedVal, 5)}  ->  ${pad(ws[r.best].key, 9)} ${num(r.bestVal, 5)}   +${(r.bestVal - r.shippedVal).toFixed(1)}`);
    }
    if (lines.length) { console.log(`\n  ${id}`); lines.forEach((l) => console.log(l)); }
  }
  console.log('');
  process.exit(0);
}

if (args.estimator) {
  console.log(`\nESTIMATOR VALIDATION — analytic estimate vs MEASURED delivery, target ${TARGET_MODE}\n`);
  console.log(`${pad('character', 12)}${pad('weapon', 10)}${BANDS.map((d) => String(d).padStart(13)).join('')}`);
  let n = 0, exact = 0, worstErr = 0, worstAt = '';
  for (const id of CHARACTER_IDS) {
    CHARACTERS[id].weapons.forEach((w, i) => {
      if (w.type === 'self') return;
      const cells = BANDS.map((d) => {
        if (d > (w.range ?? Infinity)) return '        —    ';
        const m = pressValue(id, 'donut', i, d, TARGET_MODE);
        const e = estimatePressValue(w, d);
        n++;
        if (Math.abs(m - e) < 1e-9) exact++;
        if (Math.abs(m - e) > worstErr) { worstErr = Math.abs(m - e); worstAt = `${id}/${w.key}@${d}`; }
        const flag = Math.abs(m - e) < 1e-9 ? ' ' : '!';
        return `${m.toFixed(0).padStart(6)}/${e.toFixed(0).padEnd(5)}${flag}`;
      });
      console.log(`${pad(id, 12)}${pad(w.key, 10)}${cells.join('')}`);
    });
  }
  console.log(`\n${exact}/${n} cells exact · worst |measured - estimate| ${worstErr.toFixed(1)} at ${worstAt}\n`);
  process.exit(0);
}

console.log(`\nPRESS VALUE — delivered damage per press, target ${TARGET_MODE}, sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}`);
console.log(`"auth" is the authored \`damage\` field — the key both drivers rank by.\n`);
console.log(`${pad('character', 12)}${pad('weapon', 10)}${pad('type', 8)}${'rng'.padStart(5)}${'auth'.padStart(6)}${BANDS.map((d) => String(d).padStart(7)).join('')}`);
for (const id of CHARACTER_IDS) {
  CHARACTERS[id].weapons.forEach((w, i) => {
    if (w.type === 'self') return;
    const cells = BANDS.map((d) => (d > (w.range ?? Infinity) ? '     —' : num(pressValue(id, 'donut', i, d, TARGET_MODE), 7)));
    console.log(`${pad(id, 12)}${pad(w.key, 10)}${pad(w.type, 8)}${String(w.range ?? '').padStart(5)}${String(w.damage ?? 0).padStart(6)}${cells.join('')}`);
  });
}
console.log('');
