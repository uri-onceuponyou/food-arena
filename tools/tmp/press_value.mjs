#!/usr/bin/env node
/**
 * WHAT ONE PRESS IS ACTUALLY WORTH — delivered damage per press, measured through the
 * REAL combat path, per character, per weapon, per distance band.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * `ai.ts:pickHighestDamageWeapon` ranks by the AUTHORED `Weapon.damage` field, and so
 * does the scripted player in every probe on this project. For a single-projectile
 * weapon that field IS the press. For anything else it is not, and the gap runs both
 * ways:
 *
 *   * MULTI-PELLET: `combat.ts` spawns `pellets` projectiles each carrying the FULL
 *     `damage`, so Burrito's 4-pellet Topping Swarm (authored 5) can deliver 20 and is
 *     ranked below a 10-damage Disc.
 *   * COMBO: Taco's Double Toss authors `damage: 0` and carries its real payload in
 *     `comboParts` (14 + 9 = 23). Under a `w.damage ?? 0` rank it is the WORST weapon
 *     in its own kit — the same shape as the `type === 'self'` bug fixed in `07a4e3a`.
 *   * PECK: Egg's Hatch! authors 5 and strikes `peckHits: 3` times for 15.
 *
 * ── Why it is MEASURED and not computed ─────────────────────────────────────
 *
 * `pellets x damage` is an upper bound, not a value. `spreadDeg` fans pellets by a
 * fixed ANGLE, so the lateral miss distance grows with range: Sushi's 5-pellet Rice
 * Spray (spread 35 deg) puts its outer pellets 35 deg off axis, and at 98 wu that is
 * ~56 wu of lateral offset against a 26 wu hit radius — those pellets cannot hit a
 * target on the axis, ever. `homing: true` reverses the same arithmetic and pulls a
 * 55 deg fan back onto the target. Flight time, hit radius and `traveled >= range`
 * expiry all bite too. None of that is visible in the data table.
 *
 * So every number here comes out of `combat.ts:attemptAttack` + `sim.ts:stepProjectiles`
 * with `hit-landed` events counted, exactly as a match would produce them.
 *
 * ── The model, stated plainly ───────────────────────────────────────────────
 *
 * A STATIONARY target at distance `d`, no cover, no hazards, both immortal, attacker
 * facing the target. That is the BEST CASE for the attacker and it is the right control:
 * it isolates the geometry of the weapon (spread, homing, hit radius, range expiry) from
 * the target's evasion, which is a property of the fight and not of the press. A weapon
 * that under-delivers even here under-delivers everywhere.
 *
 *   node tools/tmp/press_value.mjs                 # full table
 *   node tools/tmp/press_value.mjs --rank          # where the authored rank picks wrong
 *   node tools/tmp/press_value.mjs --sim <dir>     # against a staged counterfactual
 *   node tools/tmp/press_value.mjs --selftest      # known-input validation
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
const R = await import(`${SIM_DIR}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, REACH } = R;

const DT = 16.667;
/** Long enough for the slowest shot to cross `rangedMax` and for 3 pecks at 500 ms. */
const SETTLE_MS = 4000;

/**
 * Every distinct reach in the ladder. A weapon is only rankable against its kit-mates at
 * a distance where more than one of them is in range, so the bands have to be the reach
 * ladder itself rather than a round-number sweep.
 */
const BANDS = [40, REACH.meleeQuick, REACH.meleeStrong, REACH.meleeHeavy,
  REACH.rangedClose, REACH.rangedMid, REACH.rangedLong, REACH.rangedMax, 200, REACH.ultimateSlam];

function arenaFixture() {
  return {
    id: 'press-value', displayName: 'Press Value',
    width: 4000, height: 4000, center: { x: 2000, y: 2000 },
    maxSafeRadius: 1e6, // the ring is not what this measures
    playerSpawn: { x: 1000, y: 2000 }, enemySpawn: { x: 1200, y: 2000 },
    cover: [], hazards: [], build: () => ({}),
  };
}

/**
 * Fire `weaponIndex` ONCE at a stationary target `d` away and return the damage that
 * actually lands, through the shipped path.
 *
 * The enemy is silenced by parking every one of its cooldowns in the far future —
 * `attemptAttack` refuses on `now - lastUsed < cooldown`, and a lastUsed of 1e9 makes
 * that true forever. That is preferred to stunning it, because a stun is exactly the
 * mechanism under repair in this session and using it here would couple two measurements.
 */
function pressValue(attackerId, weaponIndex, d, { targetId = 'donut' } = {}) {
  const state = createMatch(arenaFixture(), attackerId, targetId === attackerId ? 'taco' : targetId);
  state.phase = 'playing';
  const w = CHARACTERS[attackerId].weapons[weaponIndex];
  const px = 1000, py = 2000;
  const pin = () => {
    state.player.x = px; state.player.y = py;
    state.enemy.x = px + d; state.enemy.y = py;
    state.player.hp = 1e9; state.player.maxHp = 1e9;
    state.enemy.hp = 1e9; state.enemy.maxHp = 1e9;
    state.player.facing = { x: 1, y: 0 };
    for (let i = 0; i < state.enemy.lastUsed.length; i++) state.enemy.lastUsed[i] = 1e9;
  };
  pin();

  let dealt = 0;
  let hits = 0;
  const count = (evs) => {
    for (const ev of evs) {
      if (ev.type !== 'hit-landed') continue;
      if (ev.targetRole !== 'enemy') continue;
      if (ev.source?.kind !== 'weapon' || ev.source.weaponKey !== w.key) continue;
      dealt += ev.amount;
      hits++;
    }
  };

  // The press itself. `selectedWeapon` + `attack: true` is the shipped player path, and
  // it is used rather than calling `attemptAttack` directly so the measurement includes
  // whatever `sim.ts` does around the call (aim, phase, ordering).
  const input = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, selectedWeapon: weaponIndex, attack: true };
  count(stepMatch(state, DT, input));

  input.attack = false;
  for (let t = DT; t < SETTLE_MS; t += DT) {
    pin();
    count(stepMatch(state, DT, input));
  }
  return { dealt, hits };
}

/** What the data table SAYS a press is worth — the naive arithmetic, for contrast. */
function authored(w) { return w.damage ?? 0; }
function tableUpperBound(w) {
  if (w.comboParts) return w.comboParts.reduce((a, p) => a + p.damage, 0);
  return (w.damage ?? 0) * (w.pellets ?? 1) * (w.peckHits ?? 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// selftest — known inputs, so a wrong number here is caught before it is believed
// ─────────────────────────────────────────────────────────────────────────────
if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
  };
  // 1. A single-projectile weapon in range delivers exactly its authored damage.
  const hb = pressValue('hamburger', 1, 60); // Tomato Toss, 8, range 98
  ok('single projectile delivers authored damage', hb.dealt === 8, `got ${hb.dealt}`);
  ok('single projectile lands exactly once', hb.hits === 1, `got ${hb.hits}`);
  // 2. Out of range delivers nothing.
  const oor = pressValue('hamburger', 1, 300);
  ok('out of range delivers 0', oor.dealt === 0, `got ${oor.dealt}`);
  // 3. A melee inside its cone and reach delivers its authored damage.
  const mel = pressValue('hamburger', 0, 50); // Patty Smash, 12, range 70, cone 80
  ok('melee in cone delivers authored damage', mel.dealt === 12, `got ${mel.dealt}`);
  // 4. Egg's peck weapon delivers 3 x 5.
  const peck = pressValue('egg', 1, 80); // Hatch!, damage 5, peckHits 3, homing
  ok('peck weapon delivers damage x peckHits', peck.dealt === 15, `got ${peck.dealt}`);
  ok('peck weapon lands peckHits times', peck.hits === 3, `got ${peck.hits}`);
  // 5. Taco's combo authors 0 and must deliver its parts.
  const combo = pressValue('taco', 2, 80); // Double Toss, comboParts 14 + 9
  ok('combo weapon authors 0', authored(CHARACTERS.taco.weapons[2]) === 0);
  ok('combo weapon delivers 23', combo.dealt === 23, `got ${combo.dealt}`);
  console.log(`\npress_value selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log(`\nDELIVERED DAMAGE PER PRESS — stationary target, no cover, real combat path`);
console.log(`sim ${SIM_DIR === `${ROOT}/src/game` ? 'working tree' : SIM_DIR}\n`);

const results = {}; // id -> weaponIndex -> band -> dealt
for (const id of CHARACTER_IDS) {
  results[id] = CHARACTERS[id].weapons.map(() => ({}));
  CHARACTERS[id].weapons.forEach((w, i) => {
    if (w.type === 'self') return;
    for (const d of BANDS) results[id][i][d] = pressValue(id, i, d).dealt;
  });
}

if (!args.rank) {
  console.log(`${pad('character', 12)}${pad('weapon', 16)}${rpad('auth', 5)}${rpad('table', 6)}${BANDS.map((d) => rpad(d, 6)).join('')}`);
  for (const id of CHARACTER_IDS) {
    CHARACTERS[id].weapons.forEach((w, i) => {
      if (w.type === 'self') return;
      const row = BANDS.map((d) => rpad(results[id][i][d], 6)).join('');
      console.log(`${pad(i === 0 ? id : '', 12)}${pad(w.key, 16)}${rpad(authored(w), 5)}${rpad(tableUpperBound(w), 6)}${row}`);
    });
  }
  console.log(`\nauth  = the field ai.ts:pickHighestDamageWeapon ranks by`);
  console.log(`table = pellets x damage x peckHits (or sum of comboParts) — the ARITHMETIC, not the delivery`);
  console.log(`columns are DELIVERED damage at that separation, in wu\n`);
}

// ── Where the authored rank picks the wrong weapon ───────────────────────────
let bandsWithDisagreement = 0, bandsRankable = 0;
const perChar = {};
console.log(`WHERE THE AUTHORED RANK PICKS WRONG — per character, per band\n`);
console.log(`${pad('character', 12)}${rpad('d', 5)}  ${pad('auth picks', 16)}${rpad('gets', 6)}   ${pad('best is', 16)}${rpad('worth', 6)}${rpad('cost', 7)}`);
for (const id of CHARACTER_IDS) {
  const ws = CHARACTERS[id].weapons;
  let lost = 0, worst = 0, nBands = 0, nBad = 0;
  for (const d of BANDS) {
    // In-range, non-self weapons, all cooldowns ready — the state the greedy rule sees.
    const cands = ws.map((w, i) => ({ w, i })).filter(({ w }) => w.type !== 'self' && d <= (w.range ?? Infinity));
    if (cands.length < 2) continue;
    nBands++; bandsRankable++;
    // The authored rule, transcribed: strict `>` so the first weapon wins a tie.
    let pick = cands[0], pickDmg = -Infinity;
    for (const c of cands) { const dm = authored(c.w); if (dm > pickDmg) { pickDmg = dm; pick = c; } }
    let best = cands[0], bestVal = -Infinity;
    for (const c of cands) { const v = results[id][c.i][d]; if (v > bestVal) { bestVal = v; best = c; } }
    const got = results[id][pick.i][d];
    const cost = bestVal - got;
    if (cost > 0) {
      nBad++; bandsWithDisagreement++; lost += cost; if (cost > worst) worst = cost;
      console.log(`${pad(id, 12)}${rpad(d, 5)}  ${pad(pick.w.key, 16)}${rpad(got, 6)}   ${pad(best.w.key, 16)}${rpad(bestVal, 6)}${rpad(`+${cost}`, 7)}`);
    }
  }
  perChar[id] = { nBands, nBad, lost, worst, mean: nBands ? lost / nBands : 0 };
}

console.log(`\nPER-CHARACTER COST — mean damage per press left on the table by the authored rank\n`);
console.log(`${pad('character', 12)}${rpad('bands', 7)}${rpad('wrong', 7)}${rpad('worst', 7)}${rpad('mean', 8)}`);
const order = [...CHARACTER_IDS].sort((a, b) => perChar[b].mean - perChar[a].mean);
for (const id of order) {
  const p = perChar[id];
  console.log(`${pad(id, 12)}${rpad(p.nBands, 7)}${rpad(p.nBad, 7)}${rpad(p.worst ? `+${p.worst}` : '—', 7)}${rpad(p.mean.toFixed(2), 8)}`);
}
console.log(`\nbands = distance bands where 2+ of this kit's weapons are in range (a 1-weapon kit is never rankable)`);
console.log(`wrong = bands where the authored rank does NOT pick the highest-delivering weapon`);
console.log(`VERDICT: ${bandsWithDisagreement} of ${bandsRankable} rankable bands pick a weapon that delivers less than another in-range option.\n`);
