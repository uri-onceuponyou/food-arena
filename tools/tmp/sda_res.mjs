#!/usr/bin/env node
/**
 * SDA_RES — the RESOLUTION arithmetic, re-derived from the imported tables.
 *
 * Uri's actual motivation is *"allow small increments in attributes due to levelling
 * up"*. That is a claim about what the number system can EXPRESS, and it is arithmetic,
 * not opinion — so it is computed here rather than asserted anywhere.
 *
 * Three quantities, and they are different:
 *
 *   1. VISIBILITY  — does +1 level change the number the player READS? The sim's level
 *      term is continuous (`applyDamage` never rounds `dealt`); `hud.ts` renders
 *      `Math.round(amount)`. So the ladder is quantised AT THE POINT OF DISPLAY, and a
 *      level-up can be real in the model and invisible on the screen.
 *   2. EXPRESSIBILITY — the smallest difference the AUTHORING surface can state, as a
 *      fraction of a health bar. This is what bounds per-character differentiation and
 *      it is NOT improved by pool size alone if the lever is a fraction of the pool.
 *   3. TRUTHFULNESS — does the displayed number equal what the model computed? Rounding
 *      a continuous quantity to an integer makes the bar and the number disagree by up
 *      to 0.5; that error is 12.5% of a "4" and 0.8% of a "64".
 *
 * ⚠️ NON-VACUITY: every count below is over a filtered set (weapons that deal damage,
 * levels that exist). Each filter asserts its set is NON-EMPTY before reducing over it —
 * `[].every()` is `true` and `[].filter(...).length === 0` reads exactly like "nothing
 * is broken".
 *
 *   node tools/tmp/sda_res.mjs --sim /tmp/fa-sda-base/src/game --k 1 16 10 20
 */
import { resolve } from 'node:path';

const args = (() => { const o = { _: [] }; let key = null; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { key = a.slice(2); o[key] = true; } else if (key) { if (o[key] === true) o[key] = [a]; else o[key].push(a); } else o._.push(a); } return o; })();
const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SIM = Array.isArray(args.sim) ? args.sim[0] : `${ROOT}/src/game`;
const KS = (Array.isArray(args.k) ? args.k : ['1', '16']).map(Number);

const R = await import(`${SIM}/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, LEVEL_MAX, LEVEL_MIN, PLAYER_MAX_HP, ENEMY_MAX_HP,
  levelDamageMultiplier, maxHpFor, healthMultiplier, HEALTH_PER_STAT, STAT_MAX_DISPLAY } = R;

console.log(`\n══ SDA_RES ══  sim ${SIM}  ·  levels ${LEVEL_MIN}..${LEVEL_MAX}\n`);

// ── The set of things that carry a damage number to the player ─────────────
// A weapon row, a combo PART, or the heal. `damage: 0` on a combo parent is not a
// number anyone ever sees, so it is excluded — and the exclusion is COUNTED, because
// silently dropping rows is how a filtered assertion goes vacuous.
const numbers = [];
for (const id of CHARACTER_IDS) {
  for (const w of CHARACTERS[id].weapons) {
    if (w.comboParts) { for (const p of w.comboParts) numbers.push({ id, label: `${id}/${w.key}:part`, v: p.damage }); continue; }
    if (w.healAmount !== undefined && w.healAmount > 0) { numbers.push({ id, label: `${id}/${w.key}:heal`, v: w.healAmount }); continue; }
    if ((w.damage ?? 0) > 0) numbers.push({ id, label: `${id}/${w.key}`, v: w.damage });
  }
}
const excluded = CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons).length - CHARACTER_IDS.flatMap((id) => CHARACTERS[id].weapons.filter((w) => w.comboParts || (w.healAmount ?? 0) > 0 || (w.damage ?? 0) > 0)).length;
if (numbers.length === 0) { console.error('VACUOUS: no damage-bearing numbers found'); process.exit(1); }
console.log(`   damage-bearing numbers on the card/HUD: ${numbers.length}   (weapon rows excluded as pure-0: ${excluded})`);

const STEPS = LEVEL_MAX - LEVEL_MIN;                      // 14 level-ups per number

for (const k of KS) {
  // ── 1. VISIBILITY of a level-up, on the DAMAGE side ─────────────────────
  let invisible = 0, total = 0, worst = null;
  const rows = [];
  for (const n of numbers) {
    const seen = [];
    let inv = 0;
    for (let L = LEVEL_MIN; L <= LEVEL_MAX; L++) seen.push(Math.round(n.v * k * levelDamageMultiplier(L)));
    for (let i = 1; i < seen.length; i++) { total++; if (seen[i] === seen[i - 1]) { invisible++; inv++; } }
    const distinct = new Set(seen).size;
    rows.push({ label: n.label, base: n.v * k, distinct, inv });
    if (!worst || inv > worst.inv) worst = { label: n.label, inv, distinct, base: n.v * k };
  }
  if (total !== numbers.length * STEPS) { console.error(`VACUITY GUARD: expected ${numbers.length * STEPS} level-ups, counted ${total}`); process.exit(1); }

  // ── 2. VISIBILITY on the HP side ────────────────────────────────────────
  let hpInv = 0, hpTotal = 0, unevenChars = 0;
  for (const id of CHARACTER_IDS) {
    const pools = [];
    for (let L = LEVEL_MIN; L <= LEVEL_MAX; L++) pools.push(maxHpFor(id, PLAYER_MAX_HP * k, L));
    const steps = [];
    for (let i = 1; i < pools.length; i++) { hpTotal++; steps.push(pools[i] - pools[i - 1]); if (pools[i] === pools[i - 1]) hpInv++; }
    if (new Set(steps).size > 1) unevenChars++;
  }
  if (hpTotal !== CHARACTER_IDS.length * STEPS) { console.error('VACUITY GUARD: hp level-up count wrong'); process.exit(1); }

  // ── 3. EXPRESSIBILITY: the finest AUTHORED step, as a share of a bar ─────
  const pools = CHARACTER_IDS.map((id) => maxHpFor(id, PLAYER_MAX_HP * k, LEVEL_MIN));
  const minPool = Math.min(...pools), maxPool = Math.max(...pools);
  const oneUnit = [100 / maxPool, 100 / minPool];                  // 1 HP as % of a bar
  const oneCardPoint = HEALTH_PER_STAT * 100;                      // ALWAYS 10% — a fraction
  const perPress = numbers.map((n) => n.v * k);

  // ── 4. TRUTHFULNESS: worst |displayed - modelled| as a share of the number
  let worstErr = 0;
  for (const n of numbers) for (let L = LEVEL_MIN; L <= LEVEL_MAX; L++) {
    const exact = n.v * k * levelDamageMultiplier(L);
    worstErr = Math.max(worstErr, Math.abs(Math.round(exact) - exact) / exact);
  }

  console.log(`\n── k = ${k} ──────────────────────────────────────────────────────`);
  console.log(`   DAMAGE level-ups that change no displayed number   ${invisible}/${total}  (${(100 * invisible / total).toFixed(1)}%)`);
  console.log(`   worst weapon                                       ${worst.label} @ ${worst.base}: ${worst.inv}/${STEPS} invisible, ${worst.distinct}/${LEVEL_MAX} distinct`);
  console.log(`   HP level-ups that change no pool                   ${hpInv}/${hpTotal}  (${(100 * hpInv / hpTotal).toFixed(1)}%)`);
  console.log(`   characters whose per-level HP STEP is uneven       ${unevenChars}/${CHARACTER_IDS.length}`);
  console.log(`   pools at L1                                        ${minPool}..${maxPool}`);
  console.log(`   per-PELLET damage span                             ${Math.min(...perPress)}..${Math.max(...perPress)}`);
  console.log(`   1 unit of damage, as a share of the SMALLEST bar   ${oneUnit[1].toFixed(3)}%   (largest bar ${oneUnit[0].toFixed(3)}%)`);
  console.log(`   1 CARD point of health, as a share of a bar        ${oneCardPoint.toFixed(1)}%   <-- a FRACTION. k does not move it.`);
  console.log(`   worst display error |round(x)-x|/x                 ${(100 * worstErr).toFixed(2)}%`);
}

// ── 5. THE LEVER THAT ACTUALLY BOUNDS PER-CHARACTER DIFFERENTIATION ───────
console.log(`\n── the per-character lever, which is NOT the pool size ──`);
console.log(`   health is authored as an INTEGER 0..${STAT_MAX_DISPLAY} card point x HEALTH_PER_STAT (${HEALTH_PER_STAT})`);
const stats = CHARACTER_IDS.map((id) => CHARACTERS[id].stats.health);
console.log(`   authored values: ${stats.join(', ')}  ->  ${new Set(stats).size} distinct for ${CHARACTER_IDS.length} characters`);
console.log(`   so the finest per-character HP difference expressible is ONE CARD POINT = ${(HEALTH_PER_STAT * 100).toFixed(0)}% of the role pool,`);
console.log(`   at ANY k. Multiplying the pool by k multiplies that step by k too.`);
console.log();
