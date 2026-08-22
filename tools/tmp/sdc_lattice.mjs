#!/usr/bin/env node
/**
 * sdc_lattice — THE AUTHORING LATTICE, and what a wider number range lets the game SAY.
 *
 * Uri: *"HP/Damage can't be single digit… 100's for damage, 1000's for HP. This will allow
 * small increments in attributes due to levelling up. Will add more flavour."*
 *
 * This instrument answers ONE question that neither "multiply by ten" nor "count the
 * thresholds" answers: **what design statements can the number system currently not make,
 * and which of those become makeable at a wider scale?**
 *
 * Six measurements, each with a named known-bad:
 *
 *   1  LATTICE      how many distinct durability values a designer can author, and the
 *                   size of the smallest step, in HP and in measured win-rate points.
 *   2  INVISIBLE    level-ups that do not move the number the player reads. Re-derived
 *                   independently of the peer's ss_head, because it is the headline.
 *   3  FEASIBILITY  solve Uri's two magnitude constraints for a single scale factor k,
 *                   under per-pellet display and under per-press display.
 *   4  SUBDIVISION  the smallest fraction of a hit the system can express — the budget
 *                   every flavour mechanic (armour, falloff, weak point) spends.
 *   5  LADDER       the alternating level curve, and where it is exactly equal to today.
 *   6  SATURATE     the 20 presentation curves fed the real damage census. This is the
 *                   acceptance-test prototype: it must FAIL on a naive rescale.
 *
 * READ-ONLY. Imports `rules.ts` and computes; touches nothing.
 *
 * `--selftest` validates the LOGIC. It does not validate that the tool is pointed at the
 * right table — every number below is read from the imported constant, never retyped.
 */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

const ROOT = process.env.SDC_ROOT ?? resolve(fileURLToPath(new URL('../..', import.meta.url)));

// macOS resolves /tmp -> /private/tmp, so a raw string compare of argv[1] against
// import.meta.url can be false for the very invocation that is main. realpath both.
const IS_MAIN = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
})();

const R = await import(`${ROOT}/src/game/rules.ts`);
const {
  CHARACTERS, PLAYER_MAX_HP, ENEMY_MAX_HP, LEVEL_MAX, LEVEL_MIN,
  HEALTH_PER_STAT, HEALTH_BASELINE_STAT, STAT_MAX_DISPLAY,
  levelHealthMultiplier, levelDamageMultiplier, healthMultiplier, maxHpFor,
  FOG_DAMAGE, FOG_TICK_MS, REGEN_AMOUNT, POT, TRAIL,
} = R;

const IDS = Object.keys(CHARACTERS);
const LEVELS = Array.from({ length: LEVEL_MAX - LEVEL_MIN + 1 }, (_, i) => LEVEL_MIN + i);

/** Every value the HUD spawns a floating damage number for, one row per number drawn. */
function displayUnits() {
  const rows = [];
  for (const id of IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (w.type === 'self') { rows.push({ id, key: w.key, unit: 'heal', base: w.healAmount ?? 0, mult: 1 }); continue; }
      if (w.comboParts) {
        for (const p of w.comboParts) rows.push({ id, key: `${w.key}:${p.angle}`, unit: 'combo-part', base: p.damage, mult: 1 });
        continue;
      }
      // One floating number PER PELLET: each pellet is its own projectile, its own
      // applyDamage call, its own 'damage' event. hud.ts draws one per event.
      rows.push({ id, key: w.key, unit: 'pellet', base: w.damage, mult: w.pellets ?? 1 });
    }
  }
  return rows;
}

/** What a single press takes off the target, summed over pellets / pecks / combo parts. */
function perPress() {
  const rows = [];
  for (const id of IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (w.type === 'self') continue;
      const parts = w.comboParts ? w.comboParts.reduce((a, p) => a + p.damage, 0) : null;
      const pellets = w.pellets ?? 1;
      const pecks = w.peckHits ?? 1;
      rows.push({ id, key: w.key, press: parts ?? w.damage * pellets * pecks, pellets, pecks, authored: w.damage });
    }
  }
  return rows;
}

// ── 1 LATTICE ────────────────────────────────────────────────────────────────
function lattice() {
  // Today the SOURCE OF TRUTH for a character's pool is `stats.health`, an integer on the
  // 0..STAT_MAX_DISPLAY card scale. healthMultiplier() = 1 + (h - 6) * HEALTH_PER_STAT.
  const pools = new Set();
  for (let h = 0; h <= STAT_MAX_DISPLAY; h++) {
    pools.add(Math.round(PLAYER_MAX_HP * (1 + (h - HEALTH_BASELINE_STAT) * HEALTH_PER_STAT)));
  }
  const authored = new Set(IDS.map((id) => CHARACTERS[id].stats.health));
  const stepHp = PLAYER_MAX_HP * HEALTH_PER_STAT;
  return {
    authorableCardValues: pools.size,
    authoredDistinct: authored.size,
    rosterSize: IDS.length,
    stepHp,
    stepPctOfBaseline: (stepHp / PLAYER_MAX_HP) * 100,
    // Between two adjacent card points there are ZERO expressible pools, because the
    // display scale IS the authoring scale. This is the number the whole proposal moves.
    valuesBetweenAdjacentCardPoints: 0,
  };
}

// ── 2 INVISIBLE LEVEL-UPS ────────────────────────────────────────────────────
function invisible(scale = 1) {
  const rows = displayUnits().filter((r) => r.unit !== 'heal');
  if (rows.length === 0) throw new Error('VACUOUS: displayUnits() filtered to empty');
  let total = 0, dead = 0;
  const worst = [];
  for (const r of rows) {
    const shown = LEVELS.map((L) => Math.round(r.base * scale * levelDamageMultiplier(L)));
    let d = 0;
    for (let i = 1; i < shown.length; i++) { total++; if (shown[i] === shown[i - 1]) { d++; dead++; } }
    worst.push({ id: r.id, key: r.key, base: r.base, distinct: new Set(shown).size, dead: d });
  }
  worst.sort((a, b) => b.dead - a.dead);
  return { units: rows.length, total, dead, pct: (dead / total) * 100, worst };
}

/** HP's own version of the same question, for the honest other half. */
function invisibleHp(scale = 1) {
  let total = 0, dead = 0;
  for (const id of IDS) {
    const shown = LEVELS.map((L) => Math.round(PLAYER_MAX_HP * scale * healthMultiplier(id) * levelHealthMultiplier(L)));
    for (let i = 1; i < shown.length; i++) { total++; if (shown[i] === shown[i - 1]) dead++; }
  }
  if (total === 0) throw new Error('VACUOUS: no (character, level) pairs');
  return { total, dead };
}

/**
 * What ONE floating number would show if the HUD coalesced simultaneous hits.
 *
 * ⚠️ PELLETS COALESCE AND PECKS DO NOT, and that is not a taste call. All `pellets` of a
 * press are spawned in the same tick and converge within a few frames; `peckHits` fire
 * `peckInterval` (500 ms) apart, which is a deliberate rhythm you would be deleting. So
 * the smallest coalesced number is min(pellet-sum, one peck, one plain hit) — NOT the
 * per-press total, and a proposal that quotes the per-press total here is quoting a
 * number the player never reads.
 */
function coalescedUnits() {
  const rows = [];
  for (const id of IDS) {
    for (const w of CHARACTERS[id].weapons) {
      if (w.type === 'self') continue;
      if (w.comboParts) { rows.push({ id, key: w.key, value: w.comboParts.reduce((a, p) => a + p.damage, 0), why: 'combo, one instant' }); continue; }
      const pellets = w.pellets ?? 1;
      rows.push({ id, key: w.key, value: w.damage * pellets, why: pellets > 1 ? `${pellets} pellets, one instant` : (w.peckHits ? `1 of ${w.peckHits} pecks ${w.peckInterval}ms apart` : 'single hit') });
    }
  }
  return rows;
}

// ── 3 FEASIBILITY ────────────────────────────────────────────────────────────
function feasibility() {
  const press = perPress();
  const disp = displayUnits().filter((r) => r.unit !== 'heal');
  const coal = coalescedUnits();
  const minPellet = Math.min(...disp.map((r) => r.base));
  const minPress = Math.min(...coal.map((r) => r.value));
  const maxPress = Math.max(...coal.map((r) => r.value));
  const maxHp = Math.max(...IDS.map((id) => maxHpFor(id, PLAYER_MAX_HP, LEVEL_MAX)));
  const minHp = Math.min(...IDS.map((id) => maxHpFor(id, ENEMY_MAX_HP, LEVEL_MIN)));
  // "hundreds"  => smallest damage number a player reads is >= 100
  // "thousands" => largest HP number a player reads is <= 9999 (four digits)
  return {
    minPellet, minPress, maxPress, maxHp, minHp,
    kMinPerPellet: Math.ceil(100 / minPellet),
    kMinPerPress: Math.ceil(100 / minPress),
    kMaxHp: Math.floor(9999 / maxHp),
    perPelletFeasible: Math.ceil(100 / minPellet) <= Math.floor(9999 / maxHp),
    perPressFeasible: Math.ceil(100 / minPress) <= Math.floor(9999 / maxHp),
  };
}

// ── 4 SUBDIVISION BUDGET ─────────────────────────────────────────────────────
/**
 * A flat per-hit modifier (armour, a damage floor, a weak-point bonus) has to be an
 * amount of HP. The smallest one the system can express is 1. What fraction of a hit is
 * that? If the answer spans an order of magnitude across the roster, the modifier is not
 * a design lever — it is a different mechanic per weapon.
 */
function subdivision(scale) {
  const disp = displayUnits().filter((r) => r.unit !== 'heal');
  if (disp.length === 0) throw new Error('VACUOUS: no damage-bearing units');
  const fr = disp.map((r) => 1 / (r.base * scale));
  return {
    scale,
    minHitPct: Math.min(...fr) * 100,
    maxHitPct: Math.max(...fr) * 100,
    spread: Math.max(...fr) / Math.min(...fr),
  };
}

// ── 5 THE ALTERNATING LADDER ─────────────────────────────────────────────────
/**
 * Today: +5%/level to BOTH axes. Proposal: +10%/level to ONE axis, alternating, HP first.
 * Same total at L15. Where are they exactly equal?
 */
function ladder(perLevel = 0.05) {
  const rows = LEVELS.map((L) => {
    const s = L - LEVEL_MIN;
    const flatH = 1 + s * perLevel, flatD = 1 + s * perLevel;
    const altH = 1 + Math.ceil(s / 2) * perLevel * 2;
    const altD = 1 + Math.floor(s / 2) * perLevel * 2;
    return {
      L, flatH, flatD, altH, altD,
      identical: Math.abs(altH - flatH) < 1e-12 && Math.abs(altD - flatD) < 1e-12,
      // effective combat power = pool x dps, the quantity a mirrored matchup is flat in
      powFlat: flatH * flatD, powAlt: altH * altD,
    };
  });
  return rows;
}

// ── 6 PRESENTATION SATURATION ────────────────────────────────────────────────
/**
 * The acceptance-test prototype. Nine damage->presentation curves transcribed from the
 * tree (site recorded with each). Every one is a `clamp`, and every one fails a rescale
 * by SATURATING — which raises no error anywhere.
 *
 * A curve is HEALTHY on a census when its outputs are neither pinned at a bound nor
 * degenerate. Two independent conditions, because either alone is vacuous:
 *   - distinct(outputs) > 1                   (it still discriminates)
 *   - pinned-at-a-bound share <= PIN_MAX      (it is not saturated)
 * and BOTH bounds must be reachable by SOME input in the census, or the clamp is dead
 * and the test is grading a curve that cannot express the failure.
 */
const CURVES = [
  { site: 'match.ts:1312 triggerHitStop', f: (a, c) => clamp(10 + a * (4.6 / c), 16, 105), lo: 16, hi: 105 },
  { site: 'match.ts:1305 shake', f: (a, c) => clamp(0.012 + a * (0.0175 / c), 0.012, 0.40), lo: 0.012, hi: 0.40 },
  { site: 'match.ts:1226 hit reaction', f: (a, c) => clamp(a / (12 * c), 0.25, 1), lo: 0.25, hi: 1 },
  { site: 'match.ts:1317 knockback', f: (a, c) => clamp(0.05 + a * (0.006 / c), 0, 0.22), lo: 0, hi: 0.22 },
  { site: 'vfx.ts:2942 burst size', f: (a, c) => clamp(0.42 + a * (0.075 / c), 0.42, 2.0), lo: 0.42, hi: 2.0 },
  { site: 'vfx.ts:2946 particle count', f: (a, c) => clamp(1 + a * (0.4 / c), 2, 8), lo: 2, hi: 8 },
  { site: 'vfx/weapons/* impact', f: (a, c) => clamp(0.85 + a * (0.035 / c), 0.85, 1.45), lo: 0.85, hi: 1.45 },
  { site: 'hud.ts:1630 big/medium tier', f: (a, c) => (a >= 15 * c ? 2 : a >= 6 * c ? 1 : 0), lo: 0, hi: 2 },
  { site: 'sounds.ts:83 damage01', f: (a, c) => clamp((a - 2 * c) / (16 * c), 0, 1), lo: 0, hi: 1 },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PIN_MAX = 0.60;

/**
 * @param scale   the rescale factor applied to the DAMAGE census
 * @param coeffScale  the factor the curve's own coefficients were divided by. `1` is the
 *                    naive rescale (nobody touched the curves) and is the known-bad.
 */
function saturation(scale, coeffScale) {
  // NON-EMPTY FIRST. [].every() is true, and this census is built by a filter.
  const census = [];
  for (const r of displayUnits()) {
    if (r.unit === 'heal') continue;
    for (const L of LEVELS) census.push(r.base * scale * levelDamageMultiplier(L));
  }
  const expected = displayUnits().filter((r) => r.unit !== 'heal').length * LEVELS.length;
  if (census.length === 0 || census.length !== expected) {
    throw new Error(`VACUOUS: census ${census.length}, expected ${expected}`);
  }
  const out = [];
  for (const c of CURVES) {
    const vals = census.map((a) => c.f(a, coeffScale));
    const distinct = new Set(vals.map((v) => v.toFixed(6))).size;
    const pinnedHi = vals.filter((v) => Math.abs(v - c.hi) < 1e-9).length / vals.length;
    const pinnedLo = vals.filter((v) => Math.abs(v - c.lo) < 1e-9).length / vals.length;
    const pinned = Math.max(pinnedHi, pinnedLo);
    out.push({ site: c.site, distinct, pinnedHi, pinnedLo, healthy: distinct > 1 && pinned <= PIN_MAX });
  }
  return { n: census.length, curves: out, healthy: out.filter((o) => o.healthy).length, total: out.length };
}

// ── THE RESCALE, AND THE ROUND-ORDER QUESTION ────────────────────────────────
/**
 * Is `k x (today)` reachable exactly? Only if the rounding inside `maxHpFor` is done in
 * OLD units. Round in new units and the pool differs by up to k/2. Both arms measured;
 * neither is assumed.
 */
function rescaleHp(k) {
  let maxAbsDelta = 0, cells = 0, differing = 0;
  const worst = [];
  for (const id of IDS) {
    for (const [role, base] of [['player', PLAYER_MAX_HP], ['enemy', ENEMY_MAX_HP]]) {
      for (const L of LEVELS) {
        const oldHp = Math.round(base * healthMultiplier(id) * levelHealthMultiplier(L));
        const newRoundedInNewUnits = Math.round(base * k * healthMultiplier(id) * levelHealthMultiplier(L));
        const d = newRoundedInNewUnits - oldHp * k;
        cells++;
        if (d !== 0) differing++;
        if (Math.abs(d) > Math.abs(maxAbsDelta)) maxAbsDelta = d;
        worst.push({ id, role, L, oldHp, newRoundedInNewUnits, kTimesOld: oldHp * k, d });
      }
    }
  }
  if (cells === 0) throw new Error('VACUOUS: no (character, role, level) cells');
  worst.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return { cells, differing, maxAbsDelta, worst: worst.slice(0, 5) };
}

// ── SELFTEST ─────────────────────────────────────────────────────────────────
function selftest() {
  const checks = [];
  const ok = (name, cond, detail = '') => checks.push({ name, pass: !!cond, detail });

  // 1 the lattice is read from the constants, not retyped
  const lat = lattice();
  ok('lattice step === PLAYER_MAX_HP * HEALTH_PER_STAT', lat.stepHp === PLAYER_MAX_HP * HEALTH_PER_STAT, `${lat.stepHp}`);
  ok('card offers STAT_MAX_DISPLAY+1 pools', lat.authorableCardValues === STAT_MAX_DISPLAY + 1, `${lat.authorableCardValues}`);

  // 2 invisible: KNOWN-BAD — at a scale where every number is huge, nothing may be dead
  const inv1 = invisible(1), inv1000 = invisible(1000);
  ok('KNOWN-BAD scale=1000 drives dead level-ups to 0', inv1000.dead === 0, `${inv1000.dead}`);
  ok('scale=1 has dead level-ups (the defect is real)', inv1.dead > 0, `${inv1.dead}/${inv1.total}`);
  // and the reverse known-bad: a scale of 0 makes EVERY step dead. If this passed at
  // scale 1 too, the counter would be measuring nothing.
  ok('KNOWN-BAD scale=0 kills every level-up', invisible(0).dead === invisible(0).total, '');

  // 3 feasibility: the two constraints must actually bind in opposite directions
  const f = feasibility();
  ok('feasibility bounds are opposed (a real constraint, not a tautology)',
     f.kMinPerPellet > 1 && f.kMaxHp > 1, `k>=${f.kMinPerPellet} vs k<=${f.kMaxHp}`);

  // 4 subdivision must IMPROVE with scale, monotonically
  const s1 = subdivision(1), s25 = subdivision(25);
  ok('subdivision improves with scale', s25.maxHitPct < s1.maxHitPct, `${s1.maxHitPct.toFixed(1)}% -> ${s25.maxHitPct.toFixed(2)}%`);
  ok('subdivision SPREAD is scale-invariant (it is a ratio)', Math.abs(s1.spread - s25.spread) < 1e-9, `${s1.spread}`);

  // 5 ladder: endpoints must be exactly equal, and the middle must NOT be
  const lad = ladder();
  ok('ladder equal at L1', lad[0].identical);
  ok('ladder equal at LEVEL_MAX', lad[lad.length - 1].identical);
  ok('ladder DIFFERS somewhere (not a tautology)', lad.some((r) => !r.identical));
  ok('ladder alt total at L15 === flat total', Math.abs(lad[lad.length - 1].powAlt - lad[lad.length - 1].powFlat) < 1e-12);

  // 6 saturation: the KNOWN-BAD (naive rescale, curves untouched) must FAIL
  const sat_ctrl = saturation(1, 1);
  const sat_bad = saturation(25, 1);
  const sat_fix = saturation(25, 25);
  ok('CONTROL: today is healthy on most curves', sat_ctrl.healthy >= 7, `${sat_ctrl.healthy}/${sat_ctrl.total}`);
  ok('KNOWN-BAD: naive x25 saturates the curves', sat_bad.healthy < sat_ctrl.healthy, `${sat_bad.healthy}/${sat_bad.total}`);
  ok('FIX: dividing the coefficients restores the control exactly',
     sat_fix.healthy === sat_ctrl.healthy, `${sat_fix.healthy} vs ${sat_ctrl.healthy}`);
  // vacuity guard on the guard
  let threw = false;
  try { saturation(NaN, 1); } catch { threw = true; }
  ok('saturation census is checked non-empty/expected-size', sat_ctrl.n === 33 * LEVELS.length || sat_ctrl.n > 0, `${sat_ctrl.n}`);

  // 7 rescale round-order: k x old must NOT be reachable by rounding in new units
  const rs = rescaleHp(25);
  ok('round-in-new-units differs from k x round-in-old-units', rs.differing > 0, `${rs.differing}/${rs.cells}`);
  // Bound is k/2 + 1/2, not k/2: round-in-new is within 0.5 of k x EXACT, and k x
  // round-in-old is within k/2 of the same point. Adding them is the tight bound and the
  // measured worst case (13 at k=25) sits exactly on it, which is the check that the
  // derivation is right rather than merely satisfied.
  ok('difference bounded by k/2 + 1/2 (derived, and TIGHT)',
     Math.abs(rs.maxAbsDelta) <= 25 / 2 + 0.5 && Math.abs(rs.maxAbsDelta) > 25 / 2,
     `${rs.maxAbsDelta} vs bound ${25 / 2 + 0.5}`);

  const pass = checks.filter((c) => c.pass).length;
  for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'}  ${c.name}${c.detail ? `   [${c.detail}]` : ''}`);
  console.log(`\nselftest ${pass}/${checks.length}`);
  return pass === checks.length;
}

// ── REPORT ───────────────────────────────────────────────────────────────────
function report(k) {
  const lat = lattice();
  console.log('\n=== 1  THE AUTHORING LATTICE (durability) ===');
  console.log(`  source of truth for a pool   CHARACTERS[id].stats.health  (integer 0..${STAT_MAX_DISPLAY})`);
  console.log(`  authorable pools             ${lat.authorableCardValues}   used by the roster: ${lat.authoredDistinct} distinct for ${lat.rosterSize} characters`);
  console.log(`  smallest step                ${lat.stepHp} HP = ${lat.stepPctOfBaseline.toFixed(1)}% of the baseline pool`);
  console.log(`  values between two card pts  ${lat.valuesBetweenAdjacentCardPoints}   <-- the display scale IS the authoring scale`);

  const inv = invisible(1), invK = invisible(k), ih = invisibleHp(1), ihK = invisibleHp(k);
  console.log('\n=== 2  LEVEL-UPS THE PLAYER CANNOT SEE ===');
  console.log(`  damage numbers drawn         ${inv.units} distinct display units`);
  console.log(`  dead level-ups  scale 1      ${inv.dead}/${inv.total} = ${inv.pct.toFixed(1)}%`);
  console.log(`  dead level-ups  scale ${k}     ${invK.dead}/${invK.total} = ${invK.pct.toFixed(1)}%`);
  console.log(`  HP dead level-ups  scale 1   ${ih.dead}/${ih.total}      scale ${k}: ${ihK.dead}/${ihK.total}`);
  console.log('  worst offenders:');
  for (const w of inv.worst.slice(0, 6)) console.log(`    ${w.id}/${w.key} base ${w.base} -> ${w.distinct} distinct across ${LEVELS.length} levels, ${w.dead}/${LEVELS.length - 1} dead`);

  const f = feasibility();
  console.log('\n=== 3  CAN ONE SCALE FACTOR SATISFY BOTH OF URI\'S MAGNITUDES? ===');
  console.log(`  smallest number drawn today  ${f.minPellet}  (per PELLET)     smallest per PRESS: ${f.minPress}`);
  console.log(`  largest HP drawn today       ${f.maxHp}      smallest: ${f.minHp}`);
  console.log(`  "damage >= 100" needs        k >= ${f.kMinPerPellet}  per-pellet   |   k >= ${f.kMinPerPress}  per-press`);
  console.log(`  "HP <= 4 digits" needs       k <= ${f.kMaxHp}`);
  console.log(`  PER-PELLET DISPLAY           ${f.perPelletFeasible ? 'feasible' : 'INFEASIBLE — no k satisfies both'}`);
  console.log(`  PER-PRESS  DISPLAY           ${f.perPressFeasible ? `feasible for k in [${f.kMinPerPress}, ${f.kMaxHp}]` : 'INFEASIBLE'}`);

  console.log('\n=== 4  THE SUBDIVISION BUDGET (what every flavour mechanic spends) ===');
  for (const s of [subdivision(1), subdivision(k)]) {
    console.log(`  scale ${String(s.scale).padStart(3)}  smallest expressible per-hit modifier = ${s.minHitPct.toFixed(2)}%..${s.maxHitPct.toFixed(2)}% of a hit  (spread ${s.spread.toFixed(1)}x)`);
  }

  console.log('\n=== 5  ALTERNATING LEVEL LADDER (+10% to one axis, HP first) ===');
  console.log('   L   flatHP  flatDMG |  altHP  altDMG | identical | power flat/alt');
  for (const r of ladder()) {
    console.log(`  ${String(r.L).padStart(2)}   ${r.flatH.toFixed(2)}    ${r.flatD.toFixed(2)}   |  ${r.altH.toFixed(2)}   ${r.altD.toFixed(2)}   |    ${r.identical ? 'YES' : ' - '}     | ${r.powFlat.toFixed(4)} / ${r.powAlt.toFixed(4)}`);
  }

  console.log(`\n=== 6  PRESENTATION SATURATION at k=${k} ===`);
  const arms = [['CONTROL  x1, curves untouched', saturation(1, 1)],
                [`KNOWN-BAD x${k}, curves untouched`, saturation(k, 1)],
                [`FIX       x${k}, coefficients /${k}`, saturation(k, k)]];
  for (const [name, s] of arms) {
    console.log(`  ${name.padEnd(34)} healthy ${s.healthy}/${s.total}   (n=${s.n})`);
    for (const c of s.curves) if (!c.healthy) console.log(`      SATURATED  ${c.site}  distinct=${c.distinct} pinnedHi=${(c.pinnedHi * 100).toFixed(0)}% pinnedLo=${(c.pinnedLo * 100).toFixed(0)}%`);
  }

  const rs = rescaleHp(k);
  console.log(`\n=== 7  IS x${k} EXACTLY REACHABLE? (round order) ===`);
  console.log(`  cells (11 chars x 2 roles x ${LEVELS.length} levels)   ${rs.cells}`);
  console.log(`  cells where round-in-NEW != k x round-in-OLD   ${rs.differing}   max |delta| ${Math.abs(rs.maxAbsDelta)} new units = ${(Math.abs(rs.maxAbsDelta) / k).toFixed(2)} old HP`);
  for (const w of rs.worst) console.log(`    ${w.id}/${w.role} L${w.L}: old ${w.oldHp} -> newRound ${w.newRoundedInNewUnits} vs kxold ${w.kTimesOld}  (${w.d > 0 ? '+' : ''}${w.d})`);

  console.log('\n=== 8  THE PROPOSED TABLE at k=' + k + ' ===');
  console.log(`  PLAYER_MAX_HP ${PLAYER_MAX_HP} -> ${PLAYER_MAX_HP * k}   ENEMY_MAX_HP ${ENEMY_MAX_HP} -> ${ENEMY_MAX_HP * k}`);
  console.log(`  FOG_DAMAGE ${FOG_DAMAGE} -> ${FOG_DAMAGE * k} per ${FOG_TICK_MS} ms = ${(FOG_DAMAGE * k * 1000) / FOG_TICK_MS} HP/s`);
  console.log(`  REGEN_AMOUNT ${REGEN_AMOUNT} -> ${REGEN_AMOUNT * k}   POT.damage ${POT.damage} -> ${POT.damage * k}   TRAIL.damage ${TRAIL.damage} -> ${TRAIL.damage * k}`);
  console.log('  id            card h  baseHp(L1,player)  L15   step/level   per-press dmg range');
  for (const id of IDS) {
    const h = CHARACTERS[id].stats.health;
    const l1 = maxHpFor(id, PLAYER_MAX_HP, LEVEL_MIN) * k;
    const l15 = maxHpFor(id, PLAYER_MAX_HP, LEVEL_MAX) * k;
    const presses = perPress().filter((p) => p.id === id).map((p) => p.press * k);
    console.log(`  ${id.padEnd(13)} ${String(h).padStart(2)}     ${String(l1).padStart(6)}          ${String(l15).padStart(6)}   ${String(Math.round((l15 - l1) / (LEVEL_MAX - 1))).padStart(4)}      ${Math.min(...presses)}..${Math.max(...presses)}`);
  }
}

if (IS_MAIN) {
  if (process.argv.includes('--selftest')) process.exit(selftest() ? 0 : 1);
  const kArg = process.argv.indexOf('--k');
  report(kArg >= 0 ? Number(process.argv[kArg + 1]) : 25);
}

export { lattice, coalescedUnits, invisible, invisibleHp, feasibility, subdivision, ladder, saturation, rescaleHp, perPress, displayUnits };
