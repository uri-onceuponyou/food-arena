#!/usr/bin/env node
/**
 * STATUS-GRACE SWEEP — pick `STUN_GRACE_MS` / `SLOW_GRACE_MS` by measurement.
 *
 * `tools/tmp/rules_sweep.mjs` varies exactly ONE constant per run. The grace rule has to
 * keep stun and slow in LOCKSTEP (the whole point is that it is one sentence a player can
 * learn, not two numbers), so the two move together as a multiple of each effect's own
 * duration. That is the only thing this adds over `rules_sweep.mjs`; everything measured
 * is `tools/tmp/status_census.mjs`'s (which is `rules_census.mjs` plus per-role splits, a
 * `smart2` policy and the SHIPPED arena as its default), against a STAGED copy of `rules.ts` so a peer's
 * save can never land inside a row (docs/LESSONS.md §5).
 *
 *   node tools/tmp/status_grace_sweep.mjs --ratios 0,0.25,0.5,0.75,1 --seeds 8 \
 *        --policies smart,chase,kite
 *
 * Row 0 is the CONTROL and it is not "no change": at ratio 0 the no-refresh half of the
 * rule is still in force, which is how much of the fix comes free without any grace at
 * all. To measure against the true BEFORE, pass `--baseline <census json>`.
 *
 * ── DRIVER ──────────────────────────────────────────────────────────────────
 *
 * No driver of its own: every row is a `status_census.mjs` subprocess, so it inherits
 * `tools/tmp/scripted_player.mjs` and both countdown guards. It inherited the DEFECT the
 * same way — until 2026-08-05 the stuck detector ran through the countdown, and every
 * grace row printed before then carries it.
 *
 * ⚠️ `--baseline <census json>` written before that date is NOT comparable with a row
 * produced now: `status_census.mjs` stamps `driverRev` into its JSON, and an unstamped
 * file is pre-fix. Re-run such a baseline with `--nav-countdown-bug
 * --decide-during-countdown` if you need the old comparison back.
 *
 * The grace sweep is the one place where this matters most quietly: the rows differ by
 * a STATUS DURATION, and a driver whose latched detour changes how soon contact happens
 * changes how much status is applied at all.
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

const POLICIES = String(args.policies ?? 'smart,chase');
const SEEDS = String(args.seeds ?? 8);
/** Forwarded verbatim to every census row, so a PRE-FIX sweep can be reproduced end to
 *  end rather than only argued about. Both sides of a comparison must use the same
 *  driver or the sweep is measuring the driver. */
const DRIVER_ARGS = ['nav-countdown-bug', 'decide-during-countdown'].filter((k) => args[k]).map((k) => `--${k}`);
if (DRIVER_ARGS.length) console.error(`⚠️ HISTORICAL DRIVER: ${DRIVER_ARGS.join(' ')} — reproduction only, NOT a current number`);
const STUN_D = 2000, SLOW_D = 2500;

/**
 * Rows are either RATIOS of each effect's own duration (`--ratios 0,0.25,1`) or explicit
 * `stun/slow` pairs (`--pairs 0/0,500/500,1000/1250`). The pair form exists because the
 * value that shipped is a FLAT grace — the same half second for both — which no ratio can
 * express, and a doc comment quoting a table that does not contain the shipped value is
 * the kind of near-miss this repo's git log exists to prevent.
 */
const ROWS = args.pairs
  ? String(args.pairs).split(',').map((p) => { const [a, b] = p.split('/').map(Number); return { stun: a, slow: b, label: `${a}/${b}` }; })
  : String(args.ratios ?? '0,0.25,0.5,0.75,1').split(',').map(Number)
      .map((r) => ({ stun: Math.round(STUN_D * r), slow: Math.round(SLOW_D * r), label: `${r}x ${Math.round(STUN_D * r)}/${Math.round(SLOW_D * r)}` }));

mkdirSync('/tmp/gsweep', { recursive: true });
const rows = [];
for (const { stun, slow, label } of ROWS) {
  const tag = `g${stun}_${slow}`;
  const dir = `/tmp/gsweep/${tag}`;
  execFileSync('node', [`${ROOT}/tools/tmp/stage_rules.mjs`, dir,
    `STUN_GRACE_MS=${stun}`, `SLOW_GRACE_MS=${slow}`], { stdio: 'inherit' });
  const out = `/tmp/gsweep/${tag}.json`;
  execFileSync('node', [`${ROOT}/tools/tmp/status_census.mjs`,
    '--sim', `${dir}/game`, '--seeds', SEEDS, '--policies', POLICIES, '--json', out, ...DRIVER_ARGS], { stdio: 'ignore' });
  rows.push({ label, stun, slow, data: JSON.parse(readFileSync(out, 'utf8')) });
}

const baseline = args.baseline ? JSON.parse(readFileSync(String(args.baseline), 'utf8')) : null;
const pct = (x) => `${(x * 100).toFixed(1)}%`;

for (const policy of POLICIES.split(',')) {
  const ref = baseline?.policies?.[policy] ?? rows[0].data.policies[policy];
  console.log(`\n══ STATUS GRACE · policy=${policy} · ${rows[0].data.policies[policy].n} matches/row ══`);
  console.log(`   Δwin is per-matchup vs ${baseline ? 'the BASELINE census' : 'row 0'}`);
  console.log(`   ${'ratio'.padStart(6)} ${'stun/slow ms'.padStart(13)} ${'stun ms'.padStart(8)} ${'%eng'.padStart(6)} ${'reapply'.padStart(8)} ${'longest'.padStart(8)} ${'slow ms'.padStart(8)} ${'%eng'.padStart(6)} ${'longest'.padStart(8)} ${'p.win'.padStart(7)} ${'Δwin'.padStart(7)} ${'Δmax'.padStart(7)} ${'Δmean'.padStart(7)}`);
  const line = (label, p) => {
    const deltas = Object.keys(ref.matchupRates).map((k) => (p.matchupRates[k] ?? 0) - ref.matchupRates[k]);
    const maxD = deltas.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
    const meanD = deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length;
    console.log(`   ${label.padStart(20)} ${Math.round(p.stunMs).toString().padStart(8)} ${pct(p.stunEngagedShare).padStart(6)} ` +
      `${pct(p.stunLockRate).padStart(8)} ${(p.stunLongestMax / 1000).toFixed(2) + 's'} ${Math.round(p.slowMs).toString().padStart(8)} ` +
      `${pct(p.slowEngagedShare).padStart(6)} ${(p.slowLongestMax / 1000).toFixed(2) + 's'} ${pct(p.playerWinRate).padStart(7)} ` +
      `${((p.playerWinRate - ref.playerWinRate) * 100).toFixed(1).padStart(6)}pp ${(maxD * 100).toFixed(1).padStart(6)}pp ${(meanD * 100).toFixed(2).padStart(6)}pp`);
  };
  if (baseline) line('BEFORE', ref);
  for (const { label, data } of rows) line(label, data.policies[policy]);
}
console.log('');
