#!/usr/bin/env node
/**
 * DG_PRICE — what a §80 tuning point costs, across the WHOLE ROSTER, with the aggregate
 * and the paired quantities kept apart.
 *
 * ── WHY A ROSTER-WIDE VIEW AND NOT A WATER BOTTLE VIEW ──────────────────────
 *
 * `STUN_DURATION_MS` and `SLOW_DURATION_MS` are GLOBAL. Measured on the shipped roster:
 * **5 of 11 characters carry a stun weapon and 7 of 11 carry a slow.** Every arm that
 * moves either constant therefore moves most of the cast, and `DECISIONS §80` says so in
 * as many words: *"it must be priced across the whole roster, not just on Water Bottle."*
 * `kt_paired --char waterbottle` answers the confinement question for a per-weapon arm and
 * is the WRONG instrument for a global one — its "NOT waterbottle: 0 moved" line is the
 * headline for a kit trim and is expected to be loud here.
 *
 * ── THE TWO QUANTITIES, AND THEY ARE NEVER ADDED ────────────────────────────
 *
 *   AGGREGATE   per-character strength. Resolution floor ~9 pp (`CLAUDE.md` rule 10). A
 *               delta inside it is printed with `~` and is NOT evidence. 🚨 The Soup arm
 *               moved the aggregate −3.2 pp — inside the floor — while the character went
 *               to 0.6%. An aggregate that looks calm is not evidence of anything.
 *   PAIRED      per-matchup deltas on identical seeds. EXACT, and a DIFFERENT QUANTITY.
 *               Imported from `kt_paired.mjs`, which refuses an unpaired comparison.
 *
 * ⚠️ ROSTER RANGE IS REPORTED AS A RANGE, NOT AS A CHARACTER'S STRENGTH. Those two got
 * confused on this exact programme: `§77` quotes **9.8 pp** as the roster range when 9.8%
 * is Water Bottle's *strength* and the range is 53.9 pp — the same two digits in a
 * different column. Both are labelled here, every time.
 *
 *   node tools/tmp/dg_price.mjs --selftest
 *   node tools/tmp/dg_price.mjs --base /private/tmp/dg_rl_p0.json --arm A=/private/tmp/dg_rl_p1.json --arm B=...
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paired } from './kt_paired.mjs';

/** `CLAUDE.md` rule 10, aggregate win rate. Stated before any delta is acted on. */
const AGG_FLOOR_PP = 9;

const args = (() => {
  const o = { arm: [] };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    const v = n === undefined || n.startsWith('--') ? true : (i++, n);
    if (a === '--arm') o.arm.push(v); else o[a.slice(2)] = v;
  }
  return o;
})();

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pp = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;

/** Roster shape for one policy: who is weakest, who is strongest, how wide the band is. */
export function band(P) {
  const ids = Object.keys(P.perChar);
  const s = ids.map((id) => P.perChar[id].strength);
  const lo = Math.min(...s); const hi = Math.max(...s);
  return {
    rangePP: (hi - lo) * 100, sdPP: P.sd * 100, settled: P.settled, total: P.total,
    weakest: ids[s.indexOf(lo)], weakestStrength: lo,
    strongest: ids[s.indexOf(hi)], strongestStrength: hi,
  };
}

/**
 * Who moved, ranked. A GLOBAL constant change is expected to move many characters; the
 * question Uri needs answered is WHICH and BY HOW MUCH, not a single roster number.
 */
export function movers(base, arm, policy) {
  const B = base.policies[policy]; const A = arm.policies[policy];
  return Object.keys(B.perChar)
    .map((id) => ({ id, base: B.perChar[id].strength, arm: A.perChar[id].strength, delta: A.perChar[id].strength - B.perChar[id].strength }))
    .sort((a, b) => a.delta - b.delta);
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (IS_MAIN && args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`  FAIL ${n}  ${d}`); } };
  console.log('\n== dg_price SELFTEST ==');

  const mk = (strengths, rates) => ({
    seeds: 32,
    policies: { p: { perChar: Object.fromEntries(Object.entries(strengths).map(([k, v]) => [k, { strength: v }])), sd: 0.1, settled: 3, total: 6, matchupRates: rates } },
  });
  const B = mk({ a: 0.10, b: 0.50, c: 0.64 }, { 'a>b': 0.2, 'b>c': 0.5, 'a>c': 0.1 });
  const A = mk({ a: 0.30, b: 0.48, c: 0.60 }, { 'a>b': 0.5, 'b>c': 0.5, 'a>c': 0.1 });

  // 1. 🚨 THE COLUMN CONFUSION THAT ALREADY HAPPENED ON THIS PROGRAMME, PINNED. §77 quotes
  //    9.8 pp as "the roster range" when 9.8% is Water Bottle's STRENGTH. Here the weakest
  //    character is 10.0% and the range is 54.0 pp; they must never be the same field.
  const bb = band(B.policies.p);
  t('the roster RANGE and the weakest character\'s STRENGTH are separate fields',
    Math.abs(bb.rangePP - 54) < 1e-9 && Math.abs(bb.weakestStrength - 0.10) < 1e-9 && bb.weakest === 'a',
    `range ${bb.rangePP.toFixed(1)} pp · weakest ${bb.weakest} at ${pct(bb.weakestStrength)}`);

  // 2. Movers are ranked worst-first and carry the exact per-character delta.
  const m = movers(B, A, 'p');
  t('movers are ranked most-negative first', m[0].id === 'c' && m[m.length - 1].id === 'a', m.map((x) => x.id).join(''));
  t('a per-character delta is exact', Math.abs(m.find((x) => x.id === 'a').delta - 0.20) < 1e-12);

  // 3. NON-VACUOUS: the floor mark must distinguish, not decorate. 20.0 pp is outside the
  //    ~9 pp floor and 2.0 pp is inside it, and a run where everything printed the same
  //    mark would be a run where the mark says nothing.
  const marks = m.map((x) => (Math.abs(x.delta * 100) < AGG_FLOOR_PP ? '~' : '!'));
  t('NON-VACUOUS: the floor mark separates a real move from one inside the floor',
    new Set(marks).size === 2, `${m.map((x) => `${x.id}${(x.delta * 100).toFixed(1)}`).join(' ')} -> ${marks.join('')}`);

  // 4. The paired half is IMPORTED, not re-derived, and it still refuses an unpaired pair.
  t('paired deltas come from kt_paired and are exact', paired(B, A, 'p').find((r) => r.k === 'a>b').delta === 30);
  let threw = false;
  try { paired({ ...B, seeds: 8 }, A, 'p'); } catch { threw = true; }
  t('KNOWN-BAD: an unpaired comparison still throws through this tool', threw);

  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (IS_MAIN) {
  const base = JSON.parse(readFileSync(String(args.base), 'utf8'));
  const arms = args.arm.map((s) => {
    const i = String(s).indexOf('=');
    return { label: String(s).slice(0, i), j: JSON.parse(readFileSync(String(s).slice(i + 1), 'utf8')) };
  });
  const policies = args.policies ? String(args.policies).split(',') : Object.keys(base.policies);

  console.log(`\n== DG_PRICE ==  base ${args.base} - ${arms.length} arms - ${base.seeds} seeds, paired`);
  console.log(`   AGGREGATE floor ~${AGG_FLOOR_PP} pp (marked ~ when inside it). PAIRED per-matchup deltas are EXACT and are a DIFFERENT QUANTITY.`);

  for (const policy of policies) {
    const bb = band(base.policies[policy]);
    console.log(`\n   -- policy ${policy} --`);
    console.log(`   BASE roster: range ${bb.rangePP.toFixed(1)} pp - sd ${bb.sdPP.toFixed(1)} pp - settled ${bb.settled}/${bb.total} - weakest ${bb.weakest} ${pct(bb.weakestStrength)} - strongest ${bb.strongest} ${pct(bb.strongestStrength)}`);
    const ids = Object.keys(base.policies[policy].perChar);
    console.log(`\n   ${'arm'.padEnd(10)}${'range'.padStart(8)}${'sd'.padStart(7)}${'settled'.padStart(9)}${ids.map((i) => i.slice(0, 6).padStart(8)).join('')}   paired`);
    console.log(`   ${'BASE'.padEnd(10)}${`${bb.rangePP.toFixed(1)}`.padStart(8)}${bb.sdPP.toFixed(1).padStart(7)}${`${bb.settled}/${bb.total}`.padStart(9)}${ids.map((i) => pct(base.policies[policy].perChar[i].strength).padStart(8)).join('')}`);
    for (const { label, j } of arms) {
      const ab = band(j.policies[policy]);
      const m = movers(base, j, policy);
      const byId = Object.fromEntries(m.map((x) => [x.id, x.delta]));
      const rows = paired(base, j, policy);
      const moved = rows.filter((r) => r.delta !== 0);
      const worst = [...moved].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
      const cells = ids.map((i) => `${pp(byId[i])}${Math.abs(byId[i] * 100) < AGG_FLOOR_PP ? '~' : ' '}`.padStart(8)).join('');
      console.log(`   ${label.padEnd(10)}${ab.rangePP.toFixed(1).padStart(8)}${ab.sdPP.toFixed(1).padStart(7)}${`${ab.settled}/${ab.total}`.padStart(9)}${cells}   ${moved.length}/${rows.length} moved, max ${worst ? `${worst.delta.toFixed(1)} pp (${worst.k})` : '-'}`);
    }
    console.log(`\n   (per-character cells are AGGREGATE deltas in pp; "~" = inside the ~${AGG_FLOOR_PP} pp floor and NOT evidence.`);
    console.log(`    "range"/"sd" are the ROSTER BAND in pp, never a character's strength.)`);
  }
  console.log('');
}
