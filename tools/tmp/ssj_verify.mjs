#!/usr/bin/env node
/**
 * ssj_verify — INDEPENDENT re-derivation of every number that appears in the
 * HP/damage rescale SPEC. Nothing here is copied from the three proposals; every
 * cell is computed from the imported `rules.ts` and every disputed claim is
 * reproduced BOTH ways so a disagreement can be attributed to a population
 * definition rather than to an error.
 *
 * The three proposals disagreed on:
 *   - the weapon count            (32 vs 33)
 *   - the invisible level-up rate (59.9% / 57.4% / 58.9%) and its denominator
 *   - whether ceil(hp/FOG_DAMAGE) is invariant under a common factor
 *   - the admissible band for k
 * Every one of those is settled here by enumerating the population explicitly and
 * printing its SIZE alongside its answer.
 *
 * Read-only. Imports `src/game/rules.ts` via Node type-stripping.
 *
 *   node tools/tmp/ssj_verify.mjs
 *   node tools/tmp/ssj_verify.mjs --selftest
 *   SSJ_ROOT=/tmp/fa-ssj node tools/tmp/ssj_verify.mjs     # point at a worktree
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ⚠️ realpath on BOTH sides. On macOS /tmp -> /private/tmp, so a naive
// `import.meta.url === 'file://'+argv[1]` reads FALSE inside a worktree under /tmp
// and the tool prints nothing while exiting 0. Two peers hit this in this same pass.
const IS_MAIN = (() => {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch { return false; }
})();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SSJ_ROOT ? fs.realpathSync(process.env.SSJ_ROOT) : path.resolve(HERE, '../..');
const R = await import(pathToFileURL(path.join(ROOT, 'src/game/rules.ts')).href);

const argv = process.argv.slice(2);
const SELFTEST = argv.includes('--selftest');

// ───────────────────────────────────────────────────────────────────────────
// POPULATIONS — each one named, sized, and asserted non-empty before use.
// ───────────────────────────────────────────────────────────────────────────

/** Every weapon row on the roster, with its unit decomposition. */
export function weapons() {
  const out = [];
  for (const id of R.CHARACTER_IDS) {
    for (const w of R.CHARACTERS[id].weapons) {
      const pellets = w.pellets ?? 1;
      const pecks = w.peckHits ?? 1;
      const combo = w.comboParts ? w.comboParts.map((p) => p.damage) : null;
      const perPress = combo ? combo.reduce((s, d) => s + d, 0) : w.damage * pellets * pecks;
      out.push({
        id, key: w.key, type: w.type, authored: w.damage, pellets, pecks, combo,
        perPress, cooldown: w.cooldown, healAmount: w.healAmount ?? 0,
        isSelf: w.type === 'self',
      });
    }
  }
  return out;
}

/**
 * DISPLAY UNITS — one entry per distinct floating number the player can read.
 * `hud.ts` spawns one number per `applyDamage`, so a pellet weapon draws `pellets`
 * copies of the SAME value (one entry here), a peck weapon draws `peckHits` copies
 * of the same value (one entry), and a combo weapon draws one number PER PART
 * (two entries for Taco's Double Toss, whose parts differ).
 * `mode` says which multiplier the sim applies at level L.
 */
export function displayUnits() {
  const out = [];
  for (const w of weapons()) {
    if (w.isSelf) { out.push({ id: w.id, key: w.key, base: w.healAmount, mode: 'health' }); continue; }
    if (w.combo) { for (const [i, d] of w.combo.entries()) out.push({ id: w.id, key: `${w.key}#${i}`, base: d, mode: 'damage' }); continue; }
    out.push({ id: w.id, key: w.key, base: w.authored, mode: 'damage' });
  }
  return out;
}

/** Every (character, role, level) HP pool cell. 11 x 2 x 15. */
export function poolCells(scale = 1, roundIn = 'old') {
  const out = [];
  for (const id of R.CHARACTER_IDS) {
    for (const [role, base] of [['player', R.PLAYER_MAX_HP], ['enemy', R.ENEMY_MAX_HP]]) {
      for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) {
        const exact = base * scale * R.healthMultiplier(id) * R.levelHealthMultiplier(L);
        const hp = roundIn === 'new'
          ? Math.round(exact)
          : scale * Math.round(base * R.healthMultiplier(id) * R.levelHealthMultiplier(L));
        out.push({ id, role, L, hp, exact });
      }
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// THE QUESTIONS
// ───────────────────────────────────────────────────────────────────────────

/**
 * How many level-ups do NOT move the number the player reads, at scale k?
 * Returns both the display-unit population and the per-weapon-row population so the
 * three proposals' differing denominators can be reconciled rather than argued about.
 */
export function invisibleLevelUps(k = 1) {
  const units = displayUnits();
  if (units.length === 0) throw new Error('VACUOUS: displayUnits() empty');
  let dead = 0, total = 0;
  const perUnit = [];
  for (const u of units) {
    const mul = u.mode === 'health' ? R.levelHealthMultiplier : R.levelDamageMultiplier;
    const seq = [];
    for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) seq.push(Math.round(u.base * k * mul(L)));
    let d = 0;
    for (let i = 1; i < seq.length; i++) { total++; if (seq[i] === seq[i - 1]) { dead++; d++; } }
    perUnit.push({ ...u, seq, dead: d, distinct: new Set(seq).size });
  }
  return { units: units.length, total, dead, pct: (100 * dead) / total, perUnit };
}

/** Same question for HP pools. */
export function invisiblePoolLevelUps(k = 1) {
  const cells = poolCells(k, 'old');
  if (cells.length === 0) throw new Error('VACUOUS: poolCells() empty');
  const byLadder = new Map();
  for (const c of cells) {
    const key = `${c.id}/${c.role}`;
    if (!byLadder.has(key)) byLadder.set(key, []);
    byLadder.get(key)[c.L - R.LEVEL_MIN] = c.hp;
  }
  let dead = 0, total = 0, uneven = 0;
  for (const [, seq] of byLadder) {
    const steps = [];
    for (let i = 1; i < seq.length; i++) { total++; steps.push(seq[i] - seq[i - 1]); if (seq[i] === seq[i - 1]) dead++; }
    if (new Set(steps).size > 1) uneven++;
  }
  return { ladders: byLadder.size, total, dead, uneven };
}

/** Fog ticks to burn a pool down, at scale k. */
export function fogTicks(k = 1) {
  const cells = poolCells(k, 'old');
  const base = poolCells(1, 'old');
  if (cells.length === 0) throw new Error('VACUOUS');
  let moved = 0, maxDelta = 0;
  for (let i = 0; i < cells.length; i++) {
    const a = Math.ceil(base[i].hp / R.FOG_DAMAGE);
    const b = Math.ceil(cells[i].hp / (R.FOG_DAMAGE * k));
    if (a !== b) { moved++; maxDelta = Math.max(maxDelta, Math.abs(a - b)); }
  }
  return { cells: cells.length, moved, maxDelta };
}

/** Admissible band for k under each display rule. */
export function feasibility() {
  const ws = weapons().filter((w) => !w.isSelf);
  const pools = poolCells(1, 'old').map((c) => c.hp);
  const units = displayUnits().filter((u) => u.mode === 'damage');
  const dmgMax = R.levelDamageMultiplier(R.LEVEL_MAX);
  const hpMin = Math.min(...pools), hpMax = Math.max(...pools);
  const pelletMin = Math.min(...units.map((u) => u.base));
  const pelletMax = Math.max(...units.map((u) => u.base)) * dmgMax;
  const pressMin = Math.min(...ws.map((w) => w.perPress));
  const pressMax = Math.max(...ws.map((w) => w.perPress)) * dmgMax;
  return {
    pools: { n: pools.length, min: hpMin, max: hpMax, kMin: 1000 / hpMin, kMax: 9999 / hpMax },
    perPellet: { n: units.length, min: pelletMin, max: pelletMax, kMin: 100 / pelletMin, kMax: 999 / pelletMax },
    perPress: { n: ws.length, min: pressMin, max: pressMax, kMin: 100 / pressMin, kMax: 999 / pressMax },
  };
}

/** Where does maxHpFor's Math.round actually fire, and what does rounding-in-new-units cost? */
export function roundingAudit(k) {
  const oldCells = poolCells(1, 'old');
  const newRound = poolCells(k, 'new');
  const oldRound = poolCells(k, 'old');
  let firesToday = 0, differ = 0, maxDelta = 0, noOpAtK = 0;
  for (let i = 0; i < oldCells.length; i++) {
    const exact1 = R.PLAYER_MAX_HP; // placeholder, real exact below
    void exact1;
    const e = oldCells[i].exact;
    if (Math.abs(e - Math.round(e)) > 1e-9) firesToday++;
    const eK = newRound[i].exact;
    if (Math.abs(eK - Math.round(eK)) < 1e-9) noOpAtK++;
    const d = Math.abs(newRound[i].hp - oldRound[i].hp);
    if (d !== 0) { differ++; maxDelta = Math.max(maxDelta, d); }
  }
  return { cells: oldCells.length, firesToday, noOpAtK, differ, maxDelta };
}

/** TRAIL.damageBoost: authored 1.5, delivered Math.round(damage*1.5)/damage. */
export function trailAudit(k) {
  const ws = weapons().filter((w) => !w.isSelf && w.authored > 0);
  if (ws.length === 0) throw new Error('VACUOUS');
  let wrongNow = 0, wrongAtK = 0, worstNow = 0;
  for (const w of ws) {
    const dNow = Math.round(w.authored * R.TRAIL.damageBoost) / w.authored;
    if (Math.abs(dNow - R.TRAIL.damageBoost) > 1e-9) { wrongNow++; worstNow = Math.max(worstNow, Math.abs(dNow - R.TRAIL.damageBoost)); }
    const a = w.authored * k;
    const dK = Math.round(a * R.TRAIL.damageBoost) / a;
    if (Math.abs(dK - R.TRAIL.damageBoost) > 1e-9) wrongAtK++;
  }
  return { n: ws.length, wrongNow, worstNow, wrongAtK };
}

/** The per-character HP authoring lattice: how many pools can the card express? */
export function cardLattice() {
  const stats = R.CHARACTER_IDS.map((id) => R.CHARACTERS[id].stats.health);
  const distinctStats = new Set(stats).size;
  const pools = R.CHARACTER_IDS.map((id) => R.maxHpFor(id, R.PLAYER_MAX_HP, R.LEVEL_MIN));
  const collisions = [];
  const seen = new Map();
  for (const [i, p] of pools.entries()) {
    if (seen.has(p)) collisions.push([seen.get(p), R.CHARACTER_IDS[i], p]);
    else seen.set(p, R.CHARACTER_IDS[i]);
  }
  return {
    characters: R.CHARACTER_IDS.length,
    distinctStats,
    distinctPools: new Set(pools).size,
    collisions,
    stepFractionOfPool: R.HEALTH_PER_STAT,
    rungs: R.STAT_MAX_DISPLAY + 1,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SELFTEST — every assertion names an implementation that would fail it.
// ───────────────────────────────────────────────────────────────────────────
function selftest() {
  const T = [];
  const ok = (n, c, note = '') => T.push({ n, c, note });

  // A1: the population sizes are what they are, and are non-empty. A filtered-to-empty
  //     population is this repo's most-repeated vacuity; assert size FIRST.
  const ws = weapons();
  ok('weapons() non-empty', ws.length > 0);
  ok('weapons() size is stable', ws.length === 33, `got ${ws.length}`);
  const du = displayUnits();
  ok('displayUnits() non-empty', du.length > 0);

  // A2: KNOWN-BAD — at k=0 every number is 0 forever, so EVERY level-up must be dead.
  //     If invisibleLevelUps() reports anything but 100% here it is not measuring what
  //     it claims. (This is the arm that would catch a comparison against the wrong seq.)
  const kb0 = invisibleLevelUps(0);
  ok('KNOWN-BAD k=0 -> 100% invisible', kb0.dead === kb0.total, `${kb0.dead}/${kb0.total}`);

  // A3: KNOWN-BAD — at k=1e6 nothing can round to the same integer twice.
  const kbBig = invisibleLevelUps(1e6);
  ok('KNOWN-BAD k=1e6 -> 0% invisible', kbBig.dead === 0, `${kbBig.dead}`);

  // A4: today is strictly between the two known-bads. A tool that returned a constant
  //     would pass A2 or A3 but not both plus this.
  const now = invisibleLevelUps(1);
  ok('today is strictly between', now.dead > 0 && now.dead < now.total, `${now.dead}/${now.total}`);

  // A5: the level curve is LINEAR, not geometric. Proposal B flagged its own brief for
  //     claiming 1.05^n; assert the discriminating value.
  ok('levelHealthMultiplier(15) === 1.70', Math.abs(R.levelHealthMultiplier(15) - 1.70) < 1e-9);
  ok('curve is NOT 1.05^14 (=1.9799)', Math.abs(R.levelHealthMultiplier(15) - Math.pow(1.05, 14)) > 0.27);

  // A6: rounding in NEW units is not k x rounding in old units. If this passes with
  //     differ===0 the audit is comparing an arm against itself.
  const ra = roundingAudit(25);
  ok('roundingAudit finds a difference at k=25', ra.differ > 0, `${ra.differ}/${ra.cells}`);
  ok('roundingAudit bound is k/2+1/2', ra.maxDelta <= 25 / 2 + 0.5, `max ${ra.maxDelta}`);

  // A7: fog ticks — the disputed claim. At k=1 it must be trivially 0 moved (self-pair).
  const f1 = fogTicks(1);
  ok('SELF-PAIR fogTicks(1) moves nothing', f1.moved === 0, `${f1.moved}`);

  // A8: trail audit must find today's known-wrong boosts (12 of them per proposal B).
  const t1 = trailAudit(1);
  ok('trailAudit finds wrong boosts today', t1.wrongNow > 0, `${t1.wrongNow}/${t1.n}`);

  // A9: card lattice must find the collisions the roster visibly has.
  const cl = cardLattice();
  ok('cardLattice finds pool collisions', cl.collisions.length > 0, `${cl.collisions.length}`);

  let pass = 0;
  for (const t of T) { if (t.c) pass++; console.log(`${t.c ? '  ok  ' : ' FAIL '} ${t.n}${t.note ? '   [' + t.note + ']' : ''}`); }
  console.log(`\n${pass}/${T.length}`);
  return pass === T.length ? 0 : 1;
}

// ───────────────────────────────────────────────────────────────────────────
function report() {
  const ws = weapons();
  console.log(`ROOT ${ROOT}`);
  console.log(`\n=== WEAPON CENSUS ===`);
  console.log(`rows ${ws.length}  |  self ${ws.filter((w) => w.isSelf).length}  |  combo ${ws.filter((w) => w.combo).length}  |  authored===0 ${ws.filter((w) => w.authored === 0).length}`);
  console.log(`pellets>1 ${ws.filter((w) => w.pellets > 1).length}  pecks>1 ${ws.filter((w) => w.pecks > 1).length}`);
  const dmg = ws.filter((w) => !w.isSelf);
  console.log(`authored damage range  ${Math.min(...dmg.map((w) => w.authored))} .. ${Math.max(...dmg.map((w) => w.authored))}`);
  console.log(`per-press range        ${Math.min(...dmg.map((w) => w.perPress))} .. ${Math.max(...dmg.map((w) => w.perPress))}`);
  console.log(`displayUnits           ${displayUnits().length}`);

  console.log(`\n=== INVISIBLE LEVEL-UPS (displayed damage/heal numbers) ===`);
  for (const k of [1, 2, 5, 10, 16, 20, 25, 32]) {
    const r = invisibleLevelUps(k);
    console.log(`  k=${String(k).padStart(3)}  ${String(r.dead).padStart(4)}/${r.total}  ${r.pct.toFixed(1)}%   (units ${r.units})`);
  }
  const now = invisibleLevelUps(1);
  console.log(`  worst rows:`);
  for (const u of [...now.perUnit].sort((a, b) => b.dead - a.dead).slice(0, 6)) {
    console.log(`    ${(u.id + '/' + u.key).padEnd(24)} base ${String(u.base).padStart(3)}  distinct ${u.distinct}/15  dead ${u.dead}/14   ${u.seq.join(' ')}`);
  }
  // reconcile the three published denominators
  console.log(`  denominators: displayUnits ${displayUnits().length}x14=${displayUnits().length * 14}` +
    `  | non-self weapon ROWS ${dmg.length}x14=${dmg.length * 14}` +
    `  | non-self excl. combo-parents ${dmg.filter((w) => !w.combo).length}x14=${dmg.filter((w) => !w.combo).length * 14}`);

  console.log(`\n=== INVISIBLE LEVEL-UPS (HP pools) ===`);
  for (const k of [1, 10, 20, 25, 32]) {
    const r = invisiblePoolLevelUps(k);
    console.log(`  k=${String(k).padStart(3)}  dead ${r.dead}/${r.total}  ladders ${r.ladders}  UNEVEN step ladders ${r.uneven}/${r.ladders}`);
  }

  console.log(`\n=== FOG TICK INVARIANCE (the disputed claim) ===`);
  for (const k of [1, 10, 16, 20, 25, 32]) {
    const r = fogTicks(k);
    console.log(`  k=${String(k).padStart(3)}  cells ${r.cells}  moved ${r.moved}  max|delta| ${r.maxDelta}`);
  }

  console.log(`\n=== FEASIBILITY BAND FOR k ===`);
  const f = feasibility();
  console.log(`  pools      n=${f.pools.n}  min ${f.pools.min} max ${f.pools.max}   -> k in [${f.pools.kMin.toFixed(2)}, ${f.pools.kMax.toFixed(2)}]  (>=1000, <=9999)`);
  console.log(`  per-pellet n=${f.perPellet.n}  min ${f.perPellet.min} maxL15 ${f.perPellet.max.toFixed(1)} -> k in [${f.perPellet.kMin.toFixed(2)}, ${f.perPellet.kMax.toFixed(2)}]`);
  console.log(`  per-press  n=${f.perPress.n}  min ${f.perPress.min} maxL15 ${f.perPress.max.toFixed(1)} -> k in [${f.perPress.kMin.toFixed(2)}, ${f.perPress.kMax.toFixed(2)}]`);

  console.log(`\n=== maxHpFor ROUNDING ===`);
  for (const k of [10, 16, 20, 25, 32]) {
    const r = roundingAudit(k);
    console.log(`  k=${String(k).padStart(3)}  fires today ${r.firesToday}/${r.cells}  no-op at k ${r.noOpAtK}/${r.cells}  new-vs-old-round differ ${r.differ}  max ${r.maxDelta}`);
  }

  console.log(`\n=== TRAIL.damageBoost (${R.TRAIL.damageBoost}) ===`);
  for (const k of [1, 2, 10, 20, 25, 32]) {
    const r = trailAudit(k);
    console.log(`  k=${String(k).padStart(3)}  weapons ${r.n}  boost WRONG for ${r.wrongAtK}`);
  }
  console.log(`  today worst deviation ${trailAudit(1).worstNow.toFixed(4)} on a nominal ${R.TRAIL.damageBoost}`);

  console.log(`\n=== CARD LATTICE (per-character HP authoring) ===`);
  const cl = cardLattice();
  console.log(`  characters ${cl.characters}  distinct health stats ${cl.distinctStats}  distinct L1 pools ${cl.distinctPools}`);
  console.log(`  card rungs ${cl.rungs}  step = HEALTH_PER_STAT = ${cl.stepFractionOfPool} of the ROLE base (scale-invariant)`);
  for (const c of cl.collisions) console.log(`  COLLISION ${c[0]} == ${c[1]} at ${c[2]} HP`);

  console.log(`\n=== SCALE-SENSITIVE CONSTANTS ===`);
  console.log(`  PLAYER_MAX_HP ${R.PLAYER_MAX_HP}  ENEMY_MAX_HP ${R.ENEMY_MAX_HP}`);
  console.log(`  FOG_DAMAGE ${R.FOG_DAMAGE} / ${R.FOG_TICK_MS} ms = ${(1000 * R.FOG_DAMAGE / R.FOG_TICK_MS).toFixed(1)} HP/s`);
  console.log(`  POT.damage ${R.POT.damage} / ${R.POT.tickMs} ms = ${(1000 * R.POT.damage / R.POT.tickMs).toFixed(1)} HP/s`);
  console.log(`  TRAIL.damage ${R.TRAIL.damage}  REGEN_AMOUNT ${R.REGEN_AMOUNT} / ${R.REGEN_TICK_MS} ms = ${(1000 * R.REGEN_AMOUNT / R.REGEN_TICK_MS).toFixed(1)} HP/s`);
  console.log(`  DPS_PER_DAMAGE_POINT ${R.DPS_PER_DAMAGE_POINT}   HEALTH_PER_STAT ${R.HEALTH_PER_STAT}  SPEED_PER_STAT ${R.SPEED_PER_STAT}`);
  console.log(`  LEVEL_MAX ${R.LEVEL_MAX}  health/level ${R.LEVEL_HEALTH_PER_LEVEL}  damage/level ${R.LEVEL_DAMAGE_PER_LEVEL}`);
  console.log(`  MATCH_DURATION_MS ${R.MATCH_DURATION_MS}  SUDDEN_DEATH_MS ${R.SUDDEN_DEATH_MS}`);

  console.log(`\n=== DAMAGE CARD BAR under an unscaled DPS_PER_DAMAGE_POINT ===`);
  for (const id of R.CHARACTER_IDS) {
    const d = R.kitDps(id);
    console.log(`  ${id.padEnd(13)} kitDps ${d.toFixed(2).padStart(6)}  bar ${R.damageStatFor(id)}  card ${R.CHARACTERS[id].stats.damage}` +
      `   at k=25 bar would be ${Math.max(1, Math.min(R.STAT_MAX_DISPLAY, Math.round(d * 25 / R.DPS_PER_DAMAGE_POINT)))}`);
  }
}

if (IS_MAIN) {
  process.exit(SELFTEST ? selftest() : (report(), 0));
}
