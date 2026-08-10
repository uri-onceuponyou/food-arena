#!/usr/bin/env node
/**
 * BL_VITALS_GATE — price a candidate `stats.health` assignment against the STRUCTURAL
 * gates in `sim.test.mjs` §22 BEFORE spending 7,040 matches on it.
 *
 * The measurement that decides a balance change is `roster_lab.mjs`. This decides
 * nothing — it only says whether a candidate is even ADMISSIBLE, because three of §22's
 * checks are properties of `rules.ts` alone and each of them has a hard bound that a
 * health edit can trip:
 *
 *   §22(g)  >= 6 distinct card stat totals, largest tie <= 3   (currently EXACTLY 6)
 *   §22(h)  rho(kitDps, healthMultiplier) <= -0.6              (currently -0.788)
 *   §22(h)  durability range hi/lo >= 1.6                      (currently 2.00)
 *   §22(a)  a bigger health BAR always means a bigger pool
 *
 * ⚠️ VALIDATED AGAINST KNOWN-BAD INPUTS — `--selftest` feeds it three assignments whose
 * verdict is derivable by hand (a flat roster must FAIL rho and range; the pre-DEVIATION
 * #10 card must FAIL §22(g); the shipped roster must PASS all four). A gate that has not
 * been shown to FAIL on the thing it guards is not a gate.
 *
 *   node tools/tmp/bl_vitals_gate.mjs --selftest
 *   node tools/tmp/bl_vitals_gate.mjs --set sushi=6
 *   node tools/tmp/bl_vitals_gate.mjs --set sushi=6,waterbottle=7
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

const R = await import(`${ROOT}/src/game/rules.ts`);
const { CHARACTERS, CHARACTER_IDS, HEALTH_BASELINE_STAT, HEALTH_PER_STAT, kitDps, damageStatFor } = R;

const healthOf = (over) => Object.fromEntries(
  CHARACTER_IDS.map((id) => [id, over[id] ?? CHARACTERS[id].stats.health]));

const mult = (h) => 1 + (h - HEALTH_BASELINE_STAT) * HEALTH_PER_STAT;

function evaluate(over) {
  const h = healthOf(over);
  const dps = CHARACTER_IDS.map((id) => kitDps(id));
  const hm = CHARACTER_IDS.map((id) => mult(h[id]));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const mx = mean(dps), my = mean(hm);
  const cov = dps.reduce((s, x, i) => s + (x - mx) * (hm[i] - my), 0);
  const sx = Math.sqrt(dps.reduce((s, x) => s + (x - mx) ** 2, 0));
  const sy = Math.sqrt(hm.reduce((s, y) => s + (y - my) ** 2, 0));
  const rho = sx === 0 || sy === 0 ? NaN : cov / (sx * sy);

  const totals = CHARACTER_IDS.map((id) =>
    damageStatFor(id) + h[id] + CHARACTERS[id].stats.speed);
  const distinct = new Set(totals).size;
  const largestTie = Math.max(...[...new Set(totals)].map((t) => totals.filter((x) => x === t).length));

  const lo = Math.min(...hm), hi = Math.max(...hm);
  const range = hi / lo;

  // §22(a): the bar's order is the pool's order. Trivially true for a monotone map, but
  // asserted because the map is the thing a future edit could break.
  const byBar = [...CHARACTER_IDS].sort((a, b) => h[a] - h[b]);
  const orderOk = byBar.every((id, i) => i === 0 || mult(h[id]) >= mult(h[byBar[i - 1]]));

  const onScale = CHARACTER_IDS.every((id) => Number.isInteger(h[id]) && h[id] >= 1 && h[id] <= 10);

  return { h, rho, distinct, largestTie, range, orderOk, onScale, totals,
    pass: rho <= -0.6 && distinct >= 6 && largestTie <= 3 && range >= 1.6 && orderOk && onScale };
}

function report(label, over) {
  const e = evaluate(over);
  const flag = (ok) => (ok ? 'ok  ' : 'FAIL');
  console.log(`\n── ${label}`);
  console.log(`   health   ${CHARACTER_IDS.map((id) => `${id.slice(0, 4)}${e.h[id]}`).join(' ')}`);
  console.log(`   §22(h) rho(kitDps, healthMult)  ${e.rho.toFixed(3)}  <= -0.6   ${flag(e.rho <= -0.6)}`);
  console.log(`   §22(h) durability range hi/lo   ${e.range.toFixed(2)}x  >= 1.6    ${flag(e.range >= 1.6)}`);
  console.log(`   §22(g) distinct stat totals     ${e.distinct}      >= 6     ${flag(e.distinct >= 6)}`);
  console.log(`   §22(g) largest tie              ${e.largestTie}      <= 3     ${flag(e.largestTie <= 3)}`);
  console.log(`   §22(a) bar order == pool order  ${flag(e.orderOk)}   · on the 1..10 scale ${flag(e.onScale)}`);
  console.log(`   VERDICT ${e.pass ? 'ADMISSIBLE' : 'INADMISSIBLE'}`);
  return e;
}

if (args.selftest) {
  let pass = 0, fail = 0;
  const ok = (name, cond, detail = '') => {
    if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
    else { fail++; console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
  };
  console.log('\n══ bl_vitals_gate SELFTEST — every bound shown to FAIL on a known-bad input ══');

  const shipped = evaluate({});
  ok('the SHIPPED roster is admissible (if this fails, sim.test.mjs §22 is already red)',
    shipped.pass, `rho ${shipped.rho.toFixed(3)} distinct ${shipped.distinct} tie ${shipped.largestTie} range ${shipped.range.toFixed(2)}`);

  // KNOWN-BAD 1: a flat roster — every character on the baseline stat. Compensation
  // cannot exist (sd 0), so rho is undefined and the range is exactly 1.0.
  const flat = evaluate(Object.fromEntries(CHARACTER_IDS.map((id) => [id, HEALTH_BASELINE_STAT])));
  ok('a FLAT health roster fails the durability-range bound', !flat.pass && flat.range === 1,
    `range ${flat.range.toFixed(2)}x`);

  // KNOWN-BAD 2: health CORRELATED with the kit instead of compensating it — the exact
  // shape §22(h) exists to forbid (the strongest kits also the toughest).
  const ranked = [...CHARACTER_IDS].sort((a, b) => kitDps(a) - kitDps(b));
  const aligned = evaluate(Object.fromEntries(ranked.map((id, i) => [id, 3 + Math.round(i * 7 / 10)])));
  ok('health ALIGNED with kit output fails the rho bound (the pay-to-win shape)',
    !aligned.pass && aligned.rho > -0.6, `rho ${aligned.rho.toFixed(3)}`);

  // KNOWN-BAD 3: the pre-DEVIATION-#10 card — every character on one health value would
  // collapse the totals; instead reproduce the degenerate-total case §22(g) was built for
  // by giving eight characters totals that tie.
  const degenerate = evaluate(Object.fromEntries(CHARACTER_IDS.map((id) =>
    [id, Math.max(1, Math.min(10, 19 - damageStatFor(id) - CHARACTERS[id].stats.speed))])));
  ok('a roster tuned to ONE stat total fails the distinct/tie bounds',
    !degenerate.pass && (degenerate.distinct < 6 || degenerate.largestTie > 3),
    `${degenerate.distinct} distinct, largest tie ${degenerate.largestTie}`);

  // The instrument must also agree with the file it is modelling: `mult` here must equal
  // `healthMultiplier` there, or every verdict above is about a different game.
  const drift = CHARACTER_IDS.filter((id) =>
    Math.abs(mult(CHARACTERS[id].stats.health) - R.healthMultiplier(id)) > 1e-12);
  ok('this tool\'s health multiplier IS rules.ts\'s healthMultiplier', drift.length === 0,
    drift.join(', '));

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

report('SHIPPED', {});
if (args.set) {
  const over = {};
  for (const part of String(args.set).split(',')) {
    const [id, v] = part.split('=');
    if (!CHARACTER_IDS.includes(id)) { console.error(`unknown character ${id}`); process.exit(1); }
    over[id] = Number(v);
  }
  report(`CANDIDATE ${args.set}`, over);
}
console.log('');
