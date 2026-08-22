#!/usr/bin/env node
/**
 * SDB_ACC — THE ACCEPTANCE BATTERY FOR A NUMBER-SYSTEM RESCALE, WRITTEN BEFORE THE FIX.
 *
 * Every assertion here is run against FOUR models, three of which are KNOWN-BAD:
 *
 *   TODAY        the shipped constants, unscaled            -> must FAIL AT5
 *   X20          k_HP = k_dmg = 20, the proposal            -> must PASS everything
 *   SPLIT        k_HP = 20, k_dmg = 10 (Uri's words read    -> must FAIL AT2
 *                literally: "1000s for HP, 100s for damage")
 *   DISPLAY      sim untouched, HUD multiplies by 20        -> must PASS AT5, FAIL AT4
 *
 * A guard that has not been shown to FAIL on the bug it guards against is not a guard,
 * and a guard can also pass by having NOTHING LEFT TO CHECK. Every filtered assertion
 * below asserts its set is NON-EMPTY and of the EXPECTED SIZE first.
 *
 * No file is edited to run this. The models are built in memory from the imported
 * constant table, which is why a mis-staged rescale cannot silently make both arms
 * identical (`rg_lib.loadCast`, AGENT-BRIEF section 3) — there are no arms to stage.
 *
 * Usage: node tools/tmp/sdb_acc.mjs --sim <dir>/src/game
 *        node tools/tmp/sdb_acc.mjs --selftest
 */

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function parseArgs(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const e = a.indexOf('=');
    if (e > 0) o[a.slice(2, e)] = a.slice(e + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o[a.slice(2)] = argv[++i];
    else o[a.slice(2)] = true;
  }
  return o;
}

const perPress = (w) => w.comboParts ? w.comboParts.reduce((s, p) => s + p.damage, 0)
  : w.damage * (w.peckHits ?? 1) * (w.pellets ?? 1);

/**
 * Build a candidate model. `kh` scales the HP family, `kd` the damage family, `kdisp`
 * is a pure presentation multiplier applied on top of whatever the sim holds.
 *
 * ⚠️ THE FAMILY SPLIT IS THE WHOLE POINT. `healAmount` is HP-FAMILY (combat.ts:382
 * multiplies it by levelHealthMultiplier, NOT damageMul) even though it sits next to
 * `damage` on the same object. `range`, `cone`, `speed`, `spreadDeg` and every cooldown
 * are NEITHER family and must not move.
 */
function model({ kh, kd, kdisp = 1 }, RULES) {
  const { CHARACTERS, CHARACTER_IDS, PLAYER_MAX_HP, ENEMY_MAX_HP, FOG_DAMAGE,
    POT, TRAIL, REGEN_AMOUNT, LEVEL_MAX, LEVEL_MIN, HEALTH_PER_STAT,
    HEALTH_BASELINE_STAT, DPS_PER_DAMAGE_POINT, STAT_MAX_DISPLAY } = RULES;
  const ids = [...CHARACTER_IDS];
  const hm = (id) => 1 + (CHARACTERS[id].stats.health - HEALTH_BASELINE_STAT) * HEALTH_PER_STAT;
  const lm = (L) => 1 + (Math.max(LEVEL_MIN, Math.min(LEVEL_MAX, L)) - LEVEL_MIN) * 0.05;
  const weapons = (id) => CHARACTERS[id].weapons.map((w) => ({
    ...w,
    damage: w.damage * kd,
    healAmount: w.healAmount === undefined ? undefined : w.healAmount * kh,
    comboParts: w.comboParts ? w.comboParts.map((p) => ({ ...p, damage: p.damage * kd })) : undefined,
  }));
  return {
    ids, kh, kd, kdisp,
    playerBase: PLAYER_MAX_HP * kh,
    enemyBase: ENEMY_MAX_HP * kh,
    fogDamage: FOG_DAMAGE * kd,
    potDamage: POT.damage * kd,
    trailDamage: TRAIL.damage * kd,
    trailBoost: TRAIL.damageBoost,
    regenAmount: REGEN_AMOUNT * kh,
    dpsPerPoint: DPS_PER_DAMAGE_POINT * kd,
    statMax: STAT_MAX_DISPLAY,
    levelMax: LEVEL_MAX,
    weapons,
    pool: (id, roleBase, L) => Math.round(roleBase * hm(id) * lm(L)),
    lm,
    /** what the player actually reads for one landed hit, per pellet */
    shownPerPellet: (base, L) => Math.round(kdisp * base * lm(L)),
    /** what the player would read if the HUD coalesced one press into one number */
    shownPerPress: (w, L) => Math.round(kdisp * perPress(w) * lm(L)),
    kitDps: (id) => weapons(id).filter((w) => w.type !== 'self')
      .reduce((s, w) => s + (perPress(w) / w.cooldown) * 1000, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ASSERTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AT1 — UNIT CENSUS. Every authored number is in the family it claims, and the
 * per-pellet semantics of `damage` has NOT changed.
 *
 * `kitDps` must scale by EXACTLY kd. If a rescale "helpfully" collapsed a pellet weapon
 * to one per-press number, kitDps would move by pellets x kd and this fails — which is
 * the check that would have caught the 50.6 pp `bestWeapon` fault before it shipped.
 *
 * RESOLUTION FLOOR: exact. These are ratios of exactly-representable products.
 * VACUOUS IF: the weapon list is empty or the self weapon is filtered out and nothing
 * is left. Both are asserted against a hard expected count first.
 */
function AT1(m, base, expect) {
  const notes = [];
  const nW = m.ids.reduce((s, id) => s + m.weapons(id).length, 0);
  if (nW !== expect.weapons) return { pass: false, why: `NON-EMPTY/SIZE GUARD: ${nW} weapons, expected ${expect.weapons}` };
  const selfW = m.ids.flatMap((id) => m.weapons(id)).filter((w) => w.type === 'self');
  if (selfW.length !== expect.selfWeapons) return { pass: false, why: `SIZE GUARD: ${selfW.length} self weapons, expected ${expect.selfWeapons}` };

  for (const id of m.ids) {
    const got = m.kitDps(id), want = base.kitDps(id) * m.kd;
    if (Math.abs(got - want) > 1e-9) { notes.push(`${id} kitDps ${got.toFixed(3)} != ${want.toFixed(3)} (per-pellet semantics moved)`); }
  }
  for (const w of selfW) {
    if (w.healAmount === undefined) notes.push(`self weapon ${w.key} has no healAmount`);
  }
  // cooldowns / reach must NOT have moved
  for (const id of m.ids) for (const [i, w] of m.weapons(id).entries()) {
    const b = base.weapons(id)[i];
    if (w.cooldown !== b.cooldown) notes.push(`${id}/${w.key} cooldown moved`);
    if ((w.range ?? null) !== (b.range ?? null)) notes.push(`${id}/${w.key} range moved`);
    if ((w.pellets ?? 1) !== (b.pellets ?? 1)) notes.push(`${id}/${w.key} pellets moved`);
  }
  return { pass: notes.length === 0, why: notes.slice(0, 3).join(' | ') || `${nW} weapons, ${selfW.length} self, all families intact` };
}

/**
 * AT2 — EXCHANGE-RATIO INVARIANCE. The quantity that decides a fight is pool / damage,
 * and it must not move. This is the assertion that catches k_HP != k_dmg.
 *
 * RESOLUTION FLOOR: 1.0%. Today's `maxHpFor` rounding already perturbs the ratio by up
 * to 0.79% (measured, see sdb_res section 7), so a tighter epsilon fails the CORRECT
 * implementation. Anything below 1.0% is invisible to this test — which is why AT3 (a
 * paired per-matchup sim delta, EXACT) is not optional.
 *
 * VACUOUS IF: the (char x role x level x weapon) grid is filtered to nothing. Asserted
 * against a computed expected size before any comparison runs.
 */
function AT2(m, base, eps = 0.01) {
  let cells = 0, bad = 0, worst = 0, worstKey = null;
  for (const id of m.ids) {
    for (const [roleName, mb, bb] of [['player', m.playerBase, base.playerBase], ['enemy', m.enemyBase, base.enemyBase]]) {
      for (let L = 1; L <= m.levelMax; L++) {
        const pm = m.pool(id, mb, L), pb = base.pool(id, bb, L);
        for (const [i, w] of m.weapons(id).entries()) {
          const dm = w.type === 'self' ? w.healAmount : perPress(w);
          const bw = base.weapons(id)[i];
          const db = bw.type === 'self' ? bw.healAmount : perPress(bw);
          if (!dm || !db) continue;
          cells++;
          const rel = Math.abs((pm / dm) / (pb / db) - 1);
          if (rel > worst) { worst = rel; worstKey = `${id}/${w.key} ${roleName} L${L}`; }
          if (rel > eps) bad++;
        }
      }
    }
    // fog / pot / trail / regen are rates against the pool and belong to the same claim
  }
  const expected = m.ids.reduce((s, id) => s + m.weapons(id).length, 0) * 2 * m.levelMax;
  if (cells === 0) return { pass: false, why: 'VACUOUS: 0 cells compared' };
  if (cells !== expected) return { pass: false, why: `SIZE GUARD: ${cells} cells, expected ${expected} — a weapon was silently skipped` };
  // the environmental damage sources, same claim, separate rows
  const envRows = [
    ['FOG', m.fogDamage, base.fogDamage], ['POT', m.potDamage, base.potDamage],
    ['TRAIL', m.trailDamage, base.trailDamage], ['REGEN', m.regenAmount, base.regenAmount],
  ];
  for (const [name, mv, bv] of envRows) {
    const rel = Math.abs((m.playerBase / mv) / (base.playerBase / bv) - 1);
    if (rel > worst) { worst = rel; worstKey = `${name} vs pool`; }
    if (rel > eps) bad++;
    cells++;
  }
  return { pass: bad === 0, why: `${cells} cells, ${bad} outside ${(eps * 100).toFixed(1)}%, worst ${(worst * 100).toFixed(2)}% @ ${worstKey}` };
}

/**
 * AT3 — FOG TICK COUNT. `ceil(pool / FOG_DAMAGE)` decides how long the closing zone
 * takes to kill, and sudden death is built on it (sim.test 30's inequality breaks at a
 * k_HP/k_dmg ratio of ~3.09).
 *
 * 🚨 THE OBVIOUS FORM OF THIS ASSERTION — "the tick count is IDENTICAL" — IS WRONG, AND
 * IT IS THE FORM THE GROUND-TRUTH DOCUMENT ASSERTS. `ceil(k*h / k*F) == ceil(h/F)` holds
 * only when the rescaled pool is EXACTLY k times the old pool, and `maxHpFor` rounds, so
 * it is not. Measured on the real roster: 8 of 1650 cells move, always by exactly 1 tick,
 * always because today's pool carries a rounding residue the rescale removes. Asserting
 * equality would turn a CORRECT rescale red and send somebody debugging the fog.
 *
 * RESOLUTION FLOOR: EXACT (integer count), but the admissible band is +/-1 tick and that
 * band is DERIVED, not chosen: one fog tick is the granularity of the quantity itself.
 * VACUOUS IF: the grid is empty. Size-asserted.
 */
function AT3(m, base) {
  let cells = 0, moved = 0, over = 0, examples = [];
  for (const id of m.ids) for (const [mb, bb] of [[m.playerBase, base.playerBase], [m.enemyBase, base.enemyBase]]) {
    for (let L = 1; L <= m.levelMax; L++) {
      cells++;
      const tm = Math.ceil(m.pool(id, mb, L) / m.fogDamage);
      const tb = Math.ceil(base.pool(id, bb, L) / base.fogDamage);
      if (tm !== tb) { moved++; if (Math.abs(tm - tb) > 1) over++; if (examples.length < 3) examples.push(`${id} L${L}: ${tb}->${tm}`); }
    }
  }
  const expected = m.ids.length * 2 * m.levelMax;
  if (cells !== expected) return { pass: false, why: `SIZE GUARD: ${cells} != ${expected}` };
  return {
    pass: over === 0,
    why: `${cells} cells, ${moved} moved, ${over} moved by MORE than 1 tick${examples.length ? ' — ' + examples.join(', ') : ''}`,
  };
}

/**
 * AT4 — LEVEL VISIBILITY. Uri's actual ask. Every level-up must change the number the
 * player reads, for every displayed number in the game.
 *
 * RESOLUTION FLOOR: EXACT — it is a count of integer comparisons.
 * VACUOUS IF: `displayed` is empty (no weapon yields a number) OR the ladder is built
 * over a single level. Both asserted: the comparison count must equal
 * (numbers x (LEVEL_MAX - 1)).
 */
function AT4(m, expectNumbers) {
  let cmp = 0, invisible = 0, worst = null, worstN = -1, numbers = 0;
  for (const id of m.ids) for (const w of m.weapons(id)) {
    const bases = w.type === 'self' ? [{ b: w.healAmount, l: 'heal' }]
      : w.comboParts ? w.comboParts.map((p, i) => ({ b: p.damage, l: `combo${i + 1}` }))
        : [{ b: w.damage, l: 'hit' }];
    for (const { b, l } of bases) {
      numbers++;
      let inv = 0;
      for (let L = 2; L <= m.levelMax; L++) {
        cmp++;
        if (m.shownPerPellet(b, L) === m.shownPerPellet(b, L - 1)) { inv++; invisible++; }
      }
      if (inv > worstN) { worstN = inv; worst = `${id}/${w.key} ${l} base ${b}`; }
    }
  }
  if (numbers !== expectNumbers) return { pass: false, why: `SIZE GUARD: ${numbers} displayed numbers, expected ${expectNumbers}` };
  if (cmp !== numbers * (m.levelMax - 1)) return { pass: false, why: `VACUOUS: ${cmp} comparisons` };
  return { pass: invisible === 0, why: `${invisible} / ${cmp} level-ups invisible (${(100 * invisible / cmp).toFixed(1)}%), worst ${worstN} @ ${worst}` };
}

/**
 * AT5 — AUTHORING RESOLUTION. The finest edit a designer can make must land inside the
 * balance floor, on BOTH axes.
 *
 * The HP arm is the one that a constant factor cannot fix on its own: with the 0-10
 * card as the source of truth, the finest HP edit is HEALTH_PER_STAT of the pool at
 * every k. It passes only if the model authors HP DIRECTLY.
 *
 * RESOLUTION FLOOR: the pp conversion is a MODEL (1% of pool ~ 1.35-2.79 pp, from the
 * measured HEALTH_PER_STAT ladder), not a measurement. Treat the verdict as ordinal.
 * VACUOUS IF: the kit has no non-self weapon. Guarded.
 */
function AT5(m, { directHp }) {
  const notes = [];
  // CALIBRATION: one card point = HEALTH_PER_STAT = 10% of pool, MEASURED at 13.5-27.9 pp.
  // Therefore 1% of pool = 1.35-2.79 pp. The upper end is used, because a lever that is
  // too coarse on the most sensitive character is too coarse.
  // ⚠️ The first version of this line divided by 10 again and reported 2.79 pp for a whole
  // card point — a 10x-optimistic answer that made the "card is the source" known-bad PASS.
  const hpStepPct = directHp ? 100 / m.playerBase : 10;   // 10 = HEALTH_PER_STAT as a %
  const hpPp = hpStepPct * 2.79;
  if (hpPp > 4.5) notes.push(`HP step ${hpStepPct.toFixed(3)}% of pool = up to ${hpPp.toFixed(2)} pp > 4.5`);
  let worstKit = 0, worstId = null;
  for (const id of m.ids) {
    const ws = m.weapons(id).filter((w) => w.type !== 'self');
    if (ws.length === 0) { notes.push(`${id} has no offence weapon — cannot evaluate`); continue; }
    const kd = m.kitDps(id);
    if (kd <= 0) { notes.push(`${id} kitDps 0`); continue; }
    let best = Infinity;
    for (const w of ws) {
      const dPer = w.comboParts ? 1 : (w.pellets ?? 1) * (w.peckHits ?? 1);
      best = Math.min(best, (dPer / w.cooldown) * 1000);
    }
    const pct = 100 * best / kd;
    if (pct > worstKit) { worstKit = pct; worstId = id; }
  }
  if (worstId === null) return { pass: false, why: 'VACUOUS: no character evaluated' };
  const dmgPp = worstKit * 2.79;
  if (dmgPp > 4.5) notes.push(`offence step ${worstKit.toFixed(2)}% of kit (${worstId}) = up to ${dmgPp.toFixed(2)} pp > 4.5`);
  return { pass: notes.length === 0, why: notes.join(' | ') || `HP ${hpStepPct.toFixed(3)}%/${hpPp.toFixed(2)}pp · offence ${worstKit.toFixed(2)}%/${dmgPp.toFixed(2)}pp (${worstId})` };
}

/**
 * AT6 — PRESENTATION HEADROOM. 20 curves in match.ts / vfx / hud / audio consume the raw
 * `amount` from the event stream against absolute thresholds. If `amount` grows and they
 * do not, every one of them SATURATES — which raises no error anywhere.
 *
 * Modelled here on the two that are exactly specified in `hud.ts` (big >= 15, medium >= 6)
 * and the hit-stop clamp (16..105 ms from 10 + amount*4.6). The assertion is that the
 * roster still SPANS the curve rather than pinning at one end.
 *
 * ⚠️ WHAT THIS IS NOT. It samples the CENSUS of authorable amounts (every weapon x every
 * level), not the EMPIRICAL distribution of landed hits. The shipped hit-stop curve was
 * fitted to a real census (p25 4, median 6, p75 9, p95 16) and a census is weighted by
 * what a fight actually throws, not by what the table contains. The shipping form of this
 * assertion must read `hit-landed` amounts off the event stream. This form is the cheap
 * offline lower bound: anything that saturates HERE saturates there too.
 *
 * RESOLUTION FLOOR: exact on the tier census; the hit-stop range is in ms and exact.
 * VACUOUS IF: the amount sample is empty or has one distinct value — a single-valued
 * sample yields range 0 and FAILS, which is the safe direction, but the count is
 * asserted anyway. `minSample` is a parameter so a small fixture cannot pass the vacuity
 * guard by accident AND cannot make a known-bad arm "fail" for the wrong reason.
 */
function AT6(m, thresholds, minSample = 100) {
  const amounts = [];
  for (const id of m.ids) for (const w of m.weapons(id)) {
    if (w.type === 'self') continue;
    const bases = w.comboParts ? w.comboParts.map((p) => p.damage) : [w.damage];
    for (const b of bases) for (let L = 1; L <= m.levelMax; L++) amounts.push(b * m.lm(L));
  }
  if (amounts.length < minSample) return { pass: false, why: `VACUOUS: only ${amounts.length} amounts sampled (need ${minSample})` };
  if (new Set(amounts).size < 2) return { pass: false, why: 'VACUOUS: one distinct amount' };
  const { bigAt, mediumAt, hitStopMax, hitStopCoef } = thresholds;
  const tiers = { small: 0, medium: 0, big: 0 };
  for (const a of amounts) tiers[a >= bigAt ? 'big' : a >= mediumAt ? 'medium' : 'small']++;
  const stops = amounts.map((a) => Math.min(hitStopMax, Math.max(16, 10 + a * hitStopCoef)));
  const pinned = stops.filter((s) => s >= hitStopMax - 1e-9).length / stops.length;
  const allThree = tiers.small > 0 && tiers.medium > 0 && tiers.big > 0;
  return {
    pass: allThree && pinned < 0.5,
    why: `tiers s/m/b = ${tiers.small}/${tiers.medium}/${tiers.big} · hit-stop pinned at max ${(100 * pinned).toFixed(1)}%`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SELFTEST
// ─────────────────────────────────────────────────────────────────────────────
function selftest() {
  const R = [];
  const ok = (n, c, note = '') => R.push({ n, pass: !!c, note });
  // A tiny synthetic roster so the assertions can be driven with planted faults.
  const mk = (kh, kd, kdisp = 1) => {
    const ids = ['a', 'b'];
    // ⚠️ FIXTURE SHAPE IS LOAD-BEARING. The first version gave `a` a single fast pellet
    // weapon, whose finest lever is 50% of the kit at x1 and still 2.5% at x20 — so the
    // "card is the source of truth" known-bad (S12) FAILED ON THE OFFENCE ARM and never
    // exercised the HP arm it exists to test. A known-bad planted where the bug cannot
    // express itself is the vacuity class in disguise. `s` gives `a` a slow second weapon
    // so the offence arm passes at x20 and the HP arm is the only thing left to fail.
    const W = {
      a: [{ key: 'p', type: 'ranged', damage: 2 * kd, cooldown: 700, pellets: 5, range: 100 },
      { key: 's', type: 'ranged', damage: 12 * kd, cooldown: 800, range: 120 },
      { key: 'h', type: 'self', damage: 0, healAmount: 18 * kh, cooldown: 6000 }],
      b: [{ key: 'm', type: 'melee', damage: 12 * kd, cooldown: 800, range: 70 }],
    };
    const lm = (L) => 1 + (L - 1) * 0.05;
    return {
      ids, kh, kd, kdisp, levelMax: 15,
      playerBase: 100 * kh, enemyBase: 90 * kh,
      fogDamage: 15 * kd, potDamage: 8 * kd, trailDamage: 3 * kd, regenAmount: 2 * kh,
      weapons: (id) => W[id], lm,
      pool: (id, rb, L) => Math.round(rb * (id === 'a' ? 0.7 : 1.4) * lm(L)),
      shownPerPellet: (b, L) => Math.round(kdisp * b * lm(L)),
      kitDps: (id) => W[id].filter((w) => w.type !== 'self').reduce((s, w) => s + (perPress(w) / w.cooldown) * 1000, 0),
    };
  };
  const base = mk(1, 1), good = mk(20, 20), split = mk(20, 10), disp = mk(1, 1, 20);
  const EXPECT = { weapons: 4, selfWeapons: 1 };
  const NNUM = 4;   // 3 offence numbers + 1 heal

  ok('S1  AT1 passes on a common-factor rescale', AT1(good, base, EXPECT).pass);
  ok('S2  KNOWN-BAD AT1 fails on a wrong weapon count',
     !AT1(good, base, { weapons: 99, selfWeapons: 1 }).pass);
  ok('S3  AT2 passes on a common factor', AT2(good, base).pass, AT2(good, base).why);
  ok('S4  KNOWN-BAD AT2 FAILS on k_HP != k_dmg', !AT2(split, base).pass, AT2(split, base).why);
  ok('S5  AT2 MOVES: split worst >= 90%', /worst (9\d|1\d\d)\./.test(AT2(split, base).why), AT2(split, base).why);
  ok('S6  AT3 tolerates the +/-1 tick a correct rescale causes', AT3(good, base).pass, AT3(good, base).why);
  ok('S6b AT3 MOVES: a correct rescale DOES move some cells (the residue is real)',
     /(\d+) moved/.exec(AT3(good, base).why)?.[1] !== '0', AT3(good, base).why);
  ok('S7  KNOWN-BAD AT3 fails on the split', !AT3(split, base).pass, AT3(split, base).why);
  ok('S8  KNOWN-BAD AT4 FAILS on today (base 2 pellet)', !AT4(base, NNUM).pass, AT4(base, NNUM).why);
  ok('S9  AT4 passes at x20', AT4(good, NNUM).pass, AT4(good, NNUM).why);
  ok('S10 AT4 passes on DISPLAY-ONLY too — it is NOT a discriminator', AT4(disp, NNUM).pass, AT4(disp, NNUM).why);
  ok('S11 KNOWN-BAD AT4 vacuity guard fires on a wrong number count', !AT4(good, 999).pass);
  ok('S12 KNOWN-BAD AT5 fails with the 0-10 card as source', !AT5(good, { directHp: false }).pass, AT5(good, { directHp: false }).why);
  ok('S12b KNOWN-BAD S12 fails on the HP ARM, not the offence arm',
     /HP step/.test(AT5(good, { directHp: false }).why) && !/offence step/.test(AT5(good, { directHp: false }).why),
     AT5(good, { directHp: false }).why);
  ok('S13 AT5 passes with DIRECT hp authoring at x20', AT5(good, { directHp: true }).pass, AT5(good, { directHp: true }).why);
  ok('S14 KNOWN-BAD AT5 fails at x1 even with direct authoring', !AT5(base, { directHp: true }).pass, AT5(base, { directHp: true }).why);
  const TH = { bigAt: 15, mediumAt: 6, hitStopMax: 105, hitStopCoef: 4.6 };
  const MIN = 20;   // fixture-sized vacuity guard; the real run uses 100
  ok('S15 AT6 passes on today thresholds at x1', AT6(base, TH, MIN).pass, AT6(base, TH, MIN).why);
  ok('S16 KNOWN-BAD AT6 FAILS at x20 with unscaled thresholds — on SATURATION, not vacuity',
     !AT6(good, TH, MIN).pass && !/VACUOUS/.test(AT6(good, TH, MIN).why), AT6(good, TH, MIN).why);
  ok('S17 AT6 passes at x20 with thresholds scaled',
     AT6(good, { bigAt: 300, mediumAt: 120, hitStopMax: 105, hitStopCoef: 4.6 / 20 }, MIN).pass,
     AT6(good, { bigAt: 300, mediumAt: 120, hitStopMax: 105, hitStopCoef: 4.6 / 20 }, MIN).why);
  ok('S17b KNOWN-BAD AT6 vacuity guard fires below minSample', /VACUOUS/.test(AT6(good, TH, 10000).why));
  ok('S18 SELF-PAIR: identical models compare clean', AT2(base, base).pass && AT3(base, base).pass);

  const p = R.filter((r) => r.pass).length;
  for (const r of R) console.log(`  ${r.pass ? 'ok  ' : 'FAIL'} ${r.n}${r.note ? '\n         [' + r.note + ']' : ''}`);
  console.log(`\n  ${p}/${R.length} ${p === R.length ? 'PASS' : 'FAIL'}`);
  return p === R.length ? 0 : 1;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.selftest) { process.exitCode = selftest(); return; }
  const SIM_DIR = String(args.sim ?? `${ROOT}/src/game`);
  const RULES = await import(`${SIM_DIR}/rules.ts`);

  const base = model({ kh: 1, kd: 1 }, RULES);
  const cands = [
    ['TODAY        k=1', model({ kh: 1, kd: 1 }, RULES), { directHp: false }],
    ['DISPLAY-ONLY x20 in the HUD', model({ kh: 1, kd: 1, kdisp: 20 }, RULES), { directHp: false }],
    ['X10          k_HP=k_dmg=10', model({ kh: 10, kd: 10 }, RULES), { directHp: true }],
    ['X20          k_HP=k_dmg=20  <- PROPOSAL', model({ kh: 20, kd: 20 }, RULES), { directHp: true }],
    ['X20 card-src k=20, card still source', model({ kh: 20, kd: 20 }, RULES), { directHp: false }],
    ['SPLIT        HP x20, dmg x10', model({ kh: 20, kd: 10 }, RULES), { directHp: true }],
  ];
  const nW = base.ids.reduce((s, id) => s + base.weapons(id).length, 0);
  const nSelf = base.ids.flatMap((id) => base.weapons(id)).filter((w) => w.type === 'self').length;
  const nNumbers = base.ids.reduce((s, id) => s + base.weapons(id).reduce((t, w) =>
    t + (w.type === 'self' ? 1 : w.comboParts ? w.comboParts.length : 1), 0), 0);
  const EXPECT = { weapons: nW, selfWeapons: nSelf };
  const TH1 = { bigAt: 15, mediumAt: 6, hitStopMax: 105, hitStopCoef: 4.6 };

  console.log(`SDB_ACC — acceptance battery    sim=${SIM_DIR}`);
  console.log(`CENSUS: ${base.ids.length} characters · ${nW} weapons (${nSelf} self) · ${nNumbers} displayed numbers\n`);

  for (const [name, m, opt] of cands) {
    // AT6's thresholds scale with the SIM's damage, not the display's.
    const th = m.kd === 1 ? TH1 : { bigAt: TH1.bigAt * m.kd, mediumAt: TH1.mediumAt * m.kd, hitStopMax: 105, hitStopCoef: TH1.hitStopCoef / m.kd };
    const thUnscaled = TH1;
    const rows = [
      ['AT1 unit census / per-pellet intact', AT1(m, base, EXPECT)],
      ['AT2 exchange ratio (eps 1.0%)', AT2(m, base)],
      ['AT3 fog tick count', AT3(m, base)],
      ['AT4 level visibility', AT4(m, nNumbers)],
      ['AT5 authoring resolution', AT5(m, opt)],
      ['AT6 presentation, thresholds UNSCALED', AT6(m, thUnscaled)],
      ['AT6 presentation, thresholds SCALED', AT6(m, th)],
    ];
    const nPass = rows.filter((r) => r[1].pass).length;
    console.log(`${'-'.repeat(78)}\n${name}    ${nPass}/${rows.length}`);
    for (const [n, r] of rows) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${n.padEnd(40)} ${r.why}`);
  }
}

if (IS_MAIN) await main();
