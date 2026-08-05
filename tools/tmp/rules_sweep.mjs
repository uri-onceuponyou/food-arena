#!/usr/bin/env node
/**
 * CONSTANT SWEEP — drive `tools/tmp/rules_census.mjs` against a STAGED copy of the sim
 * with one `rules.ts` constant rewritten, so a candidate value is chosen by measurement
 * rather than taste, and so the BALANCE cost of the change is measured at the same time.
 *
 *   node tools/tmp/rules_sweep.mjs --vary REGEN_DELAY_MS --values 10_000,5_000,3_000 \
 *        --policies smart,chase --seeds 6 --metric regen
 *
 * Every row prints the metric under test AND the per-matchup win-rate delta against the
 * first (baseline) value: max |delta| over 110 matchups and the mean |delta|. Today's
 * four sim fixes moved player win rate 0.0 pp and that is the standard — a sweep that
 * moves it materially is a BALANCE change and has to be declared, not smuggled in.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
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

const VARY = String(args.vary);                       // e.g. REGEN_DELAY_MS or TRAIL.durationMs
const VALUES = String(args.values).split(',');
const POLICIES = String(args.policies ?? 'smart,chase');
const SEEDS = String(args.seeds ?? 6);
const EXTRA = args.extra ? String(args.extra).split(' ') : [];

mkdirSync('/tmp/rsweep', { recursive: true });
const rows = [];
for (const v of VALUES) {
  const tag = `${VARY.replace(/\W/g, '_')}_${v.replace(/\W/g, '')}`;
  const dir = `/tmp/rsweep/${tag}`;
  execFileSync('node', [`${ROOT}/tools/tmp/stage_rules.mjs`, dir, `${VARY}=${v}`, ...EXTRA], { stdio: 'inherit' });
  const out = `/tmp/rsweep/${tag}.json`;
  execFileSync('node', [`${ROOT}/tools/tmp/rules_census.mjs`,
    '--sim', `${dir}/game`, '--seeds', SEEDS, '--policies', POLICIES, '--json', out], { stdio: 'ignore' });
  rows.push({ v, data: JSON.parse(readFileSync(out, 'utf8')) });
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const s = (ms) => `${(ms / 1000).toFixed(2)}s`;

for (const policy of POLICIES.split(',')) {
  const base = rows[0].data.policies[policy];
  console.log(`\n══ SWEEP ${VARY} · policy=${policy} · ${base.n} matches/row ══`);
  console.log(`   ${'value'.padStart(9)} ${'play'.padStart(7)} ${'engaged'.padStart(8)} ${'regen/f'.padStart(8)} ${'regenAny'.padStart(9)} ${'regenHP'.padStart(8)} ${'regenEng'.padStart(9)} ${'stunMs'.padStart(7)} ${'stun-lock'.padStart(10)} ${'stunLongP90'.padStart(12)} ${'slowMs'.padStart(7)} ${'splatUse'.padStart(9)} ${'fog%'.padStart(6)} ${'pKillFog'.padStart(9)} ${'eKillFog'.padStart(9)} ${'p.win'.padStart(7)} ${'Δwin max'.padStart(9)} ${'Δwin mean'.padStart(10)} ${'timeout'.padStart(8)}`);
  for (const { v, data } of rows) {
    const p = data.policies[policy];
    const deltas = Object.keys(base.matchupRates).map((k) => Math.abs((p.matchupRates[k] ?? 0) - base.matchupRates[k]));
    const maxD = Math.max(...deltas), meanD = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    console.log(`   ${String(v).padStart(9)} ${s(p.meanPlayMs).padStart(7)} ${s(p.meanEngagedMs).padStart(8)} ` +
      `${p.regenTicksPerFighterMatch.toFixed(3).padStart(8)} ${pct(p.regenAnyRate ?? 0).padStart(9)} ${(p.regenHpPerFighterMatch ?? 0).toFixed(2).padStart(8)} ${pct(p.regenEngagedShare ?? 0).padStart(9)} ${Math.round(p.stunMs).toString().padStart(7)} ` +
      `${pct(p.stunLockRate).padStart(10)} ${(Math.round(p.stunLongestP90 ?? 0)+'ms').padStart(12)} ${Math.round(p.slowMs).toString().padStart(7)} ` +
      `${pct(p.splatUseRate).padStart(9)} ${pct(p.fogShare).padStart(6)} ${pct(p.playerKilledByFog ?? 0).padStart(9)} ${pct(p.enemyKilledByFog ?? 0).padStart(9)} ${pct(p.playerWinRate).padStart(7)} ` +
      `${(maxD * 100).toFixed(1).padStart(8)}pp ${(meanD * 100).toFixed(2).padStart(9)}pp ${String(p.timeouts).padStart(8)}`);
  }
}
console.log('');
