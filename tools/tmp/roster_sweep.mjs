#!/usr/bin/env node
/**
 * ROSTER SWEEP — stage N candidate `rules.ts` edits, run the full roster table against
 * each, and print them side by side against the shipped tree.
 *
 * This is `tools/tmp/rules_sweep.mjs` for the roster question. That tool sweeps ONE
 * constant and reports the aggregate; a character fix is usually two or three fields at
 * once and has to be judged on the SPREAD, on BOTH roles, and on what it does to the ten
 * characters it was not aimed at. A candidate that fixes its target by re-sorting
 * everyone else is not a fix.
 *
 *   node tools/tmp/roster_sweep.mjs --target lollipop --policies smart2 --seeds 16 \
 *     --cand "dmg14=lollipop.Smash.damage=14" \
 *     --cand "cd600=lollipop.Smash.cooldown=600" \
 *     --cand "both=lollipop.Smash.damage=14 lollipop.Smash.cooldown=600"
 *
 * Every row prints, per policy:
 *   target asPlayer / asAI / strength · roster RANGE and SD · aggregate player win ·
 *   the worst COLLATERAL move among the other ten characters.
 *
 * The collateral column is the one that decides most of these. `docs/LESSONS.md`: 8 of
 * 14 icon "fixes" measured worse and were reverted — a change is not free because it
 * helped the thing it was aimed at.
 *
 * ── DRIVER ──────────────────────────────────────────────────────────────────
 *
 * This file has no driver of its own: every row is a `roster_table.mjs` subprocess, so
 * it inherits `tools/tmp/scripted_player.mjs` and both of its countdown guards. That is
 * also how it inherited the DEFECT — until 2026-08-05 the driver ran its stuck detector
 * through the countdown, and every sweep row this tool has printed carries it.
 *
 * ⚠️ A `--baseline` JSON produced before that date is NOT comparable with a row produced
 * now. `roster_table.mjs` stamps `driverRev` into every JSON precisely so a stale record
 * is identifiable mechanically: an unstamped file is pre-fix. To compare against one
 * anyway, re-run the baseline with `--nav-countdown-bug --decide-during-countdown`.
 *
 * Both sides of every comparison here are already staged copies, so the driver is the
 * only remaining way two rows can differ by something that is not the candidate.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = { cand: [] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2), n = process.argv[i + 1];
  const v = n === undefined || n.startsWith('--') ? true : (i++, n);
  if (k === 'cand') args.cand.push(v); else args[k] = v;
}

const TARGET = String(args.target);
const POLICIES = String(args.policies ?? 'smart2').split(',');
const SEEDS = String(args.seeds ?? 16);
const JOBS = Number(args.jobs ?? 4);
/** Forwarded verbatim to every roster_table row, so a PRE-FIX sweep can be reproduced
 *  end to end. Both sides of a comparison must use the same driver. */
const DRIVER_ARGS = ['nav-countdown-bug', 'decide-during-countdown'].filter((k) => args[k]).map((k) => `--${k}`);
if (DRIVER_ARGS.length) console.error(`⚠️ HISTORICAL DRIVER: ${DRIVER_ARGS.join(' ')} — reproduction only, NOT a current number`);
const OUT = String(args.out ?? '/tmp/rsweep2');
mkdirSync(OUT, { recursive: true });

/** label -> sim dir. The shipped tree is always row 0 and is staged too, so both sides
 *  of every comparison are a frozen copy and a peer's save cannot land inside one run. */
const runs = [{ label: 'shipped', patch: null }];
for (const c of args.cand) {
  const i = String(c).indexOf('=');
  runs.push({ label: String(c).slice(0, i), patch: String(c).slice(i + 1) });
}

for (const r of runs) {
  r.dir = `${OUT}/${r.label.replace(/\W/g, '_')}`;
  // The control row is staged too, with no substitutions — both sides of every
  // comparison must be a frozen copy or a peer's mid-run save lands on one of them.
  const pairs = r.patch ? r.patch.split(/\s+/) : [];
  execFileSync('node', [`${ROOT}/tools/tmp/stage_weapon.mjs`, r.dir, ...pairs], { stdio: 'inherit' });
}

// run every (run x policy) cell, JOBS at a time
const cells = [];
for (const r of runs) for (const p of POLICIES) cells.push({ r, p, json: `${r.dir}.${p}.json` });
const { spawn } = await import('node:child_process');
let cursor = 0;
await new Promise((done) => {
  let active = 0;
  const next = () => {
    if (cursor >= cells.length && active === 0) return done();
    while (active < JOBS && cursor < cells.length) {
      const c = cells[cursor++];
      active++;
      const ch = spawn('node', [`${ROOT}/tools/tmp/roster_table.mjs`,
        '--sim', `${c.r.dir}/game`, '--seeds', SEEDS, '--policies', c.p, '--json', c.json, ...DRIVER_ARGS], { stdio: 'ignore' });
      ch.on('exit', () => { active--; next(); });
    }
  };
  next();
});

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pp = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`;
const load = (c) => JSON.parse(readFileSync(c.json, 'utf8')).policies[c.p];

for (const p of POLICIES) {
  const base = load(cells.find((c) => c.p === p && c.r.label === 'shipped'));
  const ids = Object.keys(base.perChar);
  console.log(`\n══ ROSTER SWEEP · target ${TARGET} · policy ${p} · ${SEEDS} seeds × 110 matchups (${base.n} matches/row) ══`);
  console.log(`  ${'candidate'.padEnd(16)}${`${TARGET}.P`.padStart(9)}${`${TARGET}.AI`.padStart(9)}${'strength'.padStart(10)}${'Δstr'.padStart(8)}` +
    `${'rosterRange'.padStart(12)}${'sd'.padStart(7)}${'agg.win'.padStart(9)}${'Δagg'.padStart(7)}${'worstCollateral'.padStart(22)}`);
  for (const r of runs) {
    const d = load(cells.find((c) => c.p === p && c.r.label === r.label));
    const t = d.perChar[TARGET];
    const vs = ids.map((id) => d.perChar[id].strength);
    const mean = vs.reduce((a, b) => a + b, 0) / vs.length;
    const sd = Math.sqrt(vs.reduce((a, b) => a + (b - mean) ** 2, 0) / vs.length);
    let worst = { id: '—', d: 0 };
    for (const id of ids) {
      if (id === TARGET) continue;
      const delta = d.perChar[id].strength - base.perChar[id].strength;
      if (Math.abs(delta) > Math.abs(worst.d)) worst = { id, d: delta };
    }
    console.log(`  ${r.label.padEnd(16)}${pct(t.asPlayer).padStart(9)}${pct(t.asAI).padStart(9)}${pct(t.strength).padStart(10)}` +
      `${`${pp(t.strength - base.perChar[TARGET].strength)}`.padStart(8)}` +
      `${`${((Math.max(...vs) - Math.min(...vs)) * 100).toFixed(1)}pp`.padStart(12)}${`${(sd * 100).toFixed(1)}`.padStart(7)}` +
      `${pct(d.playerWinRate).padStart(9)}${pp(d.playerWinRate - base.playerWinRate).padStart(7)}` +
      `${`${worst.id} ${pp(worst.d)}pp`.padStart(22)}`);
  }
}
console.log('');
