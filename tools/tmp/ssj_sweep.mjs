#!/usr/bin/env node
/**
 * ssj_sweep — the k-feasibility sweep, and the RECONCILIATION of the three proposals'
 * contradictory claims about fog ticks, level-step evenness and the trail boost.
 *
 * The contradiction is not an error in any of them. It is that TWO ROUNDING POLICIES
 * exist for `maxHpFor` and each proposal silently assumed a different one:
 *
 *   OLD-ROUND ("preserve")  hp = k * Math.round(base * h * l)
 *      -> pools are EXACTLY k x today's, so the sim is bit-identical modulo k and
 *         ceil(hp/FOG) is invariant BY CONSTRUCTION at every k.
 *      -> but the uneven per-level step is preserved too: you bought headroom and
 *         immediately re-quantised the pool onto the old lattice.
 *
 *   NEW-ROUND               hp = Math.round(base * k * h * l)
 *      -> pools become what the design actually specifies; the level step can be exact.
 *      -> NOT k x today's, so fog ticks move and the sim is not bit-identical.
 *
 * The sweep finds the k at which the two policies COINCIDE — where Math.round is a
 * no-op in all 330 cells, so there is nothing to disagree about.
 *
 *   node tools/tmp/ssj_sweep.mjs
 *   node tools/tmp/ssj_sweep.mjs --selftest
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SSJ_ROOT ? fs.realpathSync(process.env.SSJ_ROOT) : path.resolve(HERE, '../..');
const R = await import(pathToFileURL(path.join(ROOT, 'src/game/rules.ts')).href);

const ROLES = [['player', R.PLAYER_MAX_HP], ['enemy', R.ENEMY_MAX_HP]];

function exactPool(id, base, L, k) {
  return base * k * R.healthMultiplier(id) * R.levelHealthMultiplier(L);
}

/** All 330 (char, role, level) cells, both rounding policies + the exact value. */
export function cells(k) {
  const out = [];
  for (const id of R.CHARACTER_IDS) {
    for (const [role, base] of ROLES) {
      for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) {
        const exact = exactPool(id, base, L, k);
        out.push({
          id, role, L, exact,
          oldRound: k * Math.round(exactPool(id, base, L, 1)),
          newRound: Math.round(exact),
        });
      }
    }
  }
  return out;
}

/** PROPERTIES, each a yes/no on k. Every one is derived from the tree, none is taste. */
export function props(k) {
  const cs = cells(k);
  if (cs.length !== 330) throw new Error(`VACUOUS: expected 330 cells, got ${cs.length}`);

  // P1 exactness: Math.round is a NO-OP in every cell -> the two policies coincide.
  const noOp = cs.filter((c) => Math.abs(c.exact - Math.round(c.exact)) < 1e-9).length;

  // P2 level step is a constant integer on every ladder, under NEW-round.
  const ladders = new Map();
  for (const c of cs) {
    const key = `${c.id}/${c.role}`;
    if (!ladders.has(key)) ladders.set(key, []);
    ladders.get(key)[c.L - R.LEVEL_MIN] = c.newRound;
  }
  if (ladders.size !== 22) throw new Error('VACUOUS: ladder count');
  let evenLadders = 0;
  for (const [, seq] of ladders) {
    const steps = [];
    for (let i = 1; i < seq.length; i++) steps.push(seq[i] - seq[i - 1]);
    if (new Set(steps).size === 1) evenLadders++;
  }

  // P3 TRAIL.damageBoost delivered exactly. combat.ts:469 is
  //     `const boosted = !!w.trailBoosted && isOnOwnTrail(...)`
  //     `const dmg = boosted ? Math.round(w.damage * TRAIL.damageBoost) : w.damage`
  //
  // 🚨 THE POPULATION IS **ONE WEAPON**, NOT 31. Only `trailBoosted: true` weapons ever
  // reach that Math.round, and the roster authors exactly one (donut/Candy, damage 4);
  // only donut has `hasTrail: true` at all. Measuring "the boost is exact" over all 31
  // damaging weapons asserts over 30 rows the code path CANNOT REACH — the mirror image
  // of the `[].every()` vacuity: not an empty set, an over-broad one. It produced a
  // constraint ("k must be EVEN") that looks derived and binds nothing: 4k x 1.5 = 6k is
  // an integer for EVERY integer k. Both populations are reported so the difference is
  // visible rather than argued.
  const live = [], latent = [];
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self' || w.damage <= 0) continue;
    latent.push(w);
    if (w.trailBoosted) live.push(w);
  }
  if (latent.length === 0) throw new Error('VACUOUS: no damaging weapons');
  if (live.length === 0) throw new Error('VACUOUS: no trailBoosted weapon — P3 would be [].every()');
  const ex = (w) => Math.abs(w.damage * k * R.TRAIL.damageBoost - Math.round(w.damage * k * R.TRAIL.damageBoost)) < 1e-9;
  const trailExact = live.filter(ex).length;
  const trailExactLatent = latent.filter(ex).length;

  // P4/P5 magnitude, over the REAL extremes (enemy L1 is the smallest pool a player reads).
  const pools = cs.map((c) => c.newRound);
  const minPool = Math.min(...pools), maxPool = Math.max(...pools);

  const perPress = [];
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self') continue;
    const p = w.comboParts ? w.comboParts.reduce((s, q) => s + q.damage, 0) : w.damage * (w.pellets ?? 1) * (w.peckHits ?? 1);
    perPress.push(p * k);
  }
  const perPellet = [];
  for (const id of R.CHARACTER_IDS) for (const w of R.CHARACTERS[id].weapons) {
    if (w.type === 'self') { perPellet.push(w.healAmount * k); continue; }
    if (w.comboParts) { for (const q of w.comboParts) perPellet.push(q.damage * k); continue; }
    perPellet.push(w.damage * k);
  }

  // P6 zero invisible level-ups on the displayed number.
  let dead = 0, tot = 0;
  for (const base of perPellet) {
    const seq = [];
    for (let L = R.LEVEL_MIN; L <= R.LEVEL_MAX; L++) seq.push(Math.round(base * R.levelDamageMultiplier(L)));
    for (let i = 1; i < seq.length; i++) { tot++; if (seq[i] === seq[i - 1]) dead++; }
  }

  // P7 fog ticks, under NEW-round (under OLD-round it is invariant by construction).
  const base1 = cells(1);
  let fogMoved = 0;
  for (let i = 0; i < cs.length; i++) {
    const a = Math.ceil(base1[i].newRound / R.FOG_DAMAGE);
    const b = Math.ceil(cs[i].newRound / (R.FOG_DAMAGE * k));
    if (a !== b) fogMoved++;
  }

  return {
    k,
    noOp, exact: noOp === 330,
    evenLadders, allEven: evenLadders === 22,
    trailExact, trailLive: live.length, trailExactLatent, trailLatent: latent.length, trailAllExact: trailExact === live.length,
    minPool, maxPool, poolsThousands: minPool >= 1000, poolsUnder5Digits: maxPool <= 9999,
    minPress: Math.min(...perPress), pressHundreds: Math.min(...perPress) >= 100,
    minPellet: Math.min(...perPellet), pelletHundreds: Math.min(...perPellet) >= 100,
    deadLevelUps: dead, totLevelUps: tot,
    fogMoved,
  };
}

function selftest() {
  const T = [];
  const ok = (n, c, note = '') => T.push({ n, c, note });

  // S1 SELF-PAIR: k=1 must reproduce today exactly on every property.
  const p1 = props(1);
  ok('SELF-PAIR k=1 pools are today', p1.minPool === 63 && p1.maxPool === 238, `${p1.minPool}..${p1.maxPool}`);
  ok('SELF-PAIR k=1 fog moves nothing', p1.fogMoved === 0);
  ok('SELF-PAIR k=1 has today\'s dead level-ups', p1.deadLevelUps > 0 && p1.deadLevelUps < p1.totLevelUps, `${p1.deadLevelUps}/${p1.totLevelUps}`);

  // S2 KNOWN-BAD: k=1 must FAIL every magnitude property. A sweep whose predicate is
  //    always true would pass S1 and fail here.
  ok('KNOWN-BAD k=1 fails poolsThousands', p1.poolsThousands === false);
  ok('KNOWN-BAD k=1 fails pressHundreds', p1.pressHundreds === false);
  ok('KNOWN-BAD k=1 is not exact', p1.exact === false, `noOp ${p1.noOp}/330`);

  // S3 KNOWN-BAD: an ODD k must break the trail boost (3 x k x 1.5 is a half-integer
  //    for odd k). If trailAllExact is true at k=25 the predicate is not measuring it.
  const p25 = props(25);
  // 🚨 REVERSED ASSERTION, OLD WORDING KEPT. This read:
  //     ok('KNOWN-BAD odd k=25 breaks TRAIL boost', p25.trailAllExact === false)
  // and it PASSED — over 31 weapons, 30 of which can never be trail-boosted. The LIVE
  // population is one weapon (donut/Candy, damage 4) and 4k x 1.5 = 6k is exact at every
  // integer k, so "k must be even" was never a real constraint. Kept to record that an
  // over-broad population manufactures a derived-looking requirement out of nothing.
  ok('LIVE trail population is exactly 1 weapon', p25.trailLive === 1, `${p25.trailLive}`);
  ok('LIVE TRAIL boost is exact at odd k=25', p25.trailAllExact === true, `${p25.trailExact}/${p25.trailLive}`);
  ok('LATENT population would break at odd k (the old, over-broad answer)',
     p25.trailExactLatent < p25.trailLatent, `${p25.trailExactLatent}/${p25.trailLatent}`);
  const p32 = props(32);
  ok('CONTROL even k=32 keeps TRAIL boost on both populations',
     p32.trailAllExact === true && p32.trailExactLatent === p32.trailLatent);

  // S4 the exactness property must be RARE. A predicate that is true for every k is
  //    a comment with a tick next to it.
  const exactKs = [];
  for (let k = 1; k <= 64; k++) if (props(k).exact) exactKs.push(k);
  ok('exactness is rare (not all k)', exactKs.length > 0 && exactKs.length < 20, `k = ${exactKs.join(',')}`);

  // S5 ORDERING: bigger k can only reduce dead level-ups (monotone), so a
  //    non-monotone answer means the sequence is being built wrong.
  let mono = true, prev = Infinity;
  for (const k of [1, 2, 3, 4, 5, 8, 10, 20, 40]) { const d = props(k).deadLevelUps; if (d > prev) mono = false; prev = d; }
  ok('ORDERS: dead level-ups monotone non-increasing in k', mono);

  let pass = 0;
  for (const t of T) { if (t.c) pass++; console.log(`${t.c ? '  ok  ' : ' FAIL '} ${t.n}${t.note ? '   [' + t.note + ']' : ''}`); }
  console.log(`\n${pass}/${T.length}`);
  return pass === T.length ? 0 : 1;
}

function report() {
  console.log(`ROOT ${ROOT}\n`);
  console.log('k    exact  evenLad  trail   minPool  maxPool  minPress  minPellet  deadLvl  fogMoved(new-round)   VERDICT');
  console.log('---  -----  -------  ------  -------  -------  --------  ---------  -------  -------------------   -------');
  for (let k = 1; k <= 50; k++) {
    const p = props(k);
    const need = [];
    if (!p.poolsThousands) need.push('pool<1000');
    if (!p.poolsUnder5Digits) need.push('pool>9999');
    if (!p.pressHundreds) need.push('press<100');
    if (p.deadLevelUps > 0) need.push('deadLvl');
    if (!p.trailAllExact) need.push('trail');
    if (!p.exact) need.push('inexact');
    const verdict = need.length === 0 ? '*** ALL PASS ***' : need.join(' ');
    if (k <= 12 || k % 1 === 0) {
      console.log(
        `${String(k).padStart(3)}  ${p.exact ? ' YES ' : String(p.noOp).padStart(3) + '  '}  ` +
        `${String(p.evenLadders).padStart(2)}/22   ` +
        `${String(p.trailExactLatent).padStart(2)}/${p.trailLatent}  ` +
        `${String(p.minPool).padStart(7)}  ${String(p.maxPool).padStart(7)}  ` +
        `${String(p.minPress).padStart(8)}  ${String(p.minPellet).padStart(9)}  ` +
        `${String(p.deadLevelUps).padStart(7)}  ${String(p.fogMoved).padStart(19)}   ${verdict}`);
    }
  }
  console.log('\nALL-PASS SET, k in 1..200:');
  const winners = [];
  for (let k = 1; k <= 200; k++) {
    const p = props(k);
    if (p.poolsThousands && p.poolsUnder5Digits && p.pressHundreds && p.deadLevelUps === 0 && p.trailAllExact && p.exact) winners.push(k);
  }
  console.log('  ' + (winners.length ? winners.join(', ') : '(empty)'));
  console.log('\nRELAXING the <=9999 nice-to-have:');
  const w2 = [];
  for (let k = 1; k <= 200; k++) {
    const p = props(k);
    if (p.poolsThousands && p.pressHundreds && p.deadLevelUps === 0 && p.trailAllExact && p.exact) w2.push(k);
  }
  console.log('  ' + w2.slice(0, 20).join(', '));
  console.log('\nRELAXING exactness (allow OLD-round, i.e. bit-identical modulo k):');
  const w3 = [];
  for (let k = 1; k <= 60; k++) {
    const p = props(k);
    if (p.poolsThousands && p.poolsUnder5Digits && p.pressHundreds && p.deadLevelUps === 0 && p.trailAllExact) w3.push(k);
  }
  console.log('  ' + w3.join(', '));
}

if (IS_MAIN) process.exit(process.argv.includes('--selftest') ? selftest() : (report(), 0));
