#!/usr/bin/env node
/**
 * KT_PAIRED — the PAIRED per-matchup delta between two `roster_lab` JSONs, reported as the
 * separate quantity it is.
 *
 * `CLAUDE.md` rule 10: an AGGREGATE win rate is unresolvable below ~9 pp, and a PAIRED
 * per-matchup delta on identical seeds is **EXACT**. They are different quantities and
 * conflating them once hid 58 of 110 matchups moving, max 34.4 pp, behind an aggregate that
 * moved 0.8 pp. This tool never adds them and never prints a "combined" number.
 *
 * 🚨 IT REFUSES AN UNPAIRED COMPARISON. Different seed counts, a different roster, or a
 * different matchup set means the pairing does not hold and every delta below is noise
 * wearing an exact number's clothes.
 *
 *   node tools/tmp/kt_paired.mjs --selftest
 *   node tools/tmp/kt_paired.mjs --base rl_base.json --arm rl_a.json --char waterbottle
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = (() => {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const n = process.argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = n; i++; }
  }
  return o;
})();

/** Paired deltas for one policy. Throws rather than returning a plausible answer. */
export function paired(base, arm, policy) {
  if (base.seeds !== arm.seeds) throw new Error(`UNPAIRED: ${base.seeds} seeds vs ${arm.seeds} — the comparison is not paired`);
  const B = base.policies[policy]?.matchupRates;
  const A = arm.policies[policy]?.matchupRates;
  if (!B || !A) throw new Error(`policy '${policy}' missing from one side`);
  const keys = Object.keys(B);
  if (keys.length !== Object.keys(A).length) throw new Error(`UNPAIRED: ${keys.length} matchups vs ${Object.keys(A).length}`);
  const rows = [];
  for (const k of keys) {
    if (!(k in A)) throw new Error(`UNPAIRED: matchup '${k}' is missing from the arm`);
    rows.push({ k, base: B[k], arm: A[k], delta: (A[k] - B[k]) * 100 });
  }
  return rows;
}

const IS_MAIN = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (IS_MAIN && args.selftest) {
  let pass = 0; let fail = 0;
  const t = (n, ok, d = '') => { if (ok) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  console.log('\n══ kt_paired SELFTEST ══');
  const mk = (seeds, rates) => ({ seeds, policies: { p: { matchupRates: rates } } });
  const b = mk(32, { 'a>b': 0.5, 'a>c': 0.25 });
  const a = mk(32, { 'a>b': 0.75, 'a>c': 0.25 });
  const r = paired(b, a, 'p');
  t('an unchanged matchup has delta exactly 0', r.find((x) => x.k === 'a>c').delta === 0);
  t('a moved matchup reports its exact pp delta', r.find((x) => x.k === 'a>b').delta === 25);
  // KNOWN-BAD: an unpaired comparison must THROW. Returning deltas anyway is the failure —
  // they would look exact and be meaningless, which is worse than no answer.
  let threw = false;
  try { paired(mk(8, { 'a>b': 0.5 }), mk(32, { 'a>b': 0.5 }), 'p'); } catch { threw = true; }
  t('KNOWN-BAD: mismatched seed counts throw rather than returning exact-looking noise', threw);
  let threw2 = false;
  try { paired(mk(32, { 'a>b': 0.5, 'a>c': 0.5 }), mk(32, { 'a>b': 0.5 }), 'p'); } catch { threw2 = true; }
  t('KNOWN-BAD: a different matchup set throws', threw2);
  console.log(`\n  ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

if (IS_MAIN) {
  const base = JSON.parse(readFileSync(String(args.base), 'utf8'));
  const arm = JSON.parse(readFileSync(String(args.arm), 'utf8'));
  const CHAR = args.char ? String(args.char) : null;
  console.log(`\n══ KT_PAIRED ══  ${args.base} -> ${args.arm}  ·  ${base.seeds} seeds, identical`);
  console.log('   PAIRED per-matchup deltas are EXACT. They are NOT an aggregate and are never added to one.\n');
  for (const policy of Object.keys(base.policies)) {
    const rows = paired(base, arm, policy);
    const moved = rows.filter((r) => r.delta !== 0);
    const mine = CHAR ? rows.filter((r) => r.k.includes(CHAR)) : rows;
    const mineMoved = mine.filter((r) => r.delta !== 0);
    const others = rows.filter((r) => !CHAR || !r.k.includes(CHAR));
    const othersMoved = others.filter((r) => r.delta !== 0);
    const worst = [...moved].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
    console.log(`   ${policy}:  ${moved.length}/${rows.length} matchups moved · max |Δ| ${worst ? `${worst.delta.toFixed(1)} pp (${worst.k})` : '—'}`);
    if (CHAR) {
      // 🚨 THE SIGN FLIPS WITH THE SEAT, AND AVERAGING OVER BOTH CANCELS IT TO ~0.
      // `matchupRates` is keyed `PLAYER>ENEMY` and holds the PLAYER's win rate, so a
      // character that got weaker LOWERS `char>X` and RAISES `X>char`. The first version
      // of this block averaged all 20 keys and printed **mean Δ -3.0 pp** for an arm whose
      // character had lost **21.4 pp** — a number that was arithmetically correct, looked
      // reassuring, and described nothing. The seats are reported separately.
      const asPlayer = mine.filter((r) => r.k.startsWith(`${CHAR}>`));
      const asEnemy = mine.filter((r) => r.k.endsWith(`>${CHAR}`));
      const mean = (xs) => (xs.length ? xs.reduce((s, r) => s + r.delta, 0) / xs.length : 0);
      console.log(`      ${CHAR}:  ${mineMoved.length}/${mine.length} moved` +
        `   as PLAYER ${asPlayer.filter((r) => r.delta !== 0).length}/${asPlayer.length} mean Δ ${mean(asPlayer).toFixed(1)} pp` +
        `   as ENEMY ${asEnemy.filter((r) => r.delta !== 0).length}/${asEnemy.length} mean Δ ${mean(asEnemy).toFixed(1)} pp (sign INVERTS — this is the opponent's rate)`);
      console.log(`      NOT ${CHAR}: ${othersMoved.length}/${others.length} moved` +
        `${othersMoved.length === 0 ? '   <= BIT-IDENTICAL: the change is confined to one character' : `   <= LEAKED: ${othersMoved.slice(0, 4).map((r) => `${r.k} ${r.delta.toFixed(1)}`).join(', ')}`}`);
    }
  }
  console.log('');
}
