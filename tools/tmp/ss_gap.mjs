#!/usr/bin/env node
/**
 * ss_gap — does the sudden-death "same fog bucket" assertion still MEAN anything after a
 * rescale, or does it merely still pass?
 *
 * `sim.test.mjs` §30(b) builds the hard case as `suddenDeathRun([100, 100 - gap])` and loops
 * `gap = 1 .. FOG_DAMAGE - 1`. The 100 is an ABSOLUTE HP LITERAL; the loop bound is DERIVED.
 * Scale FOG_DAMAGE and the two stop describing the same scenario:
 *
 *   the named scenario  two fighters in the SAME `ceil(hp / FOG_DAMAGE)` bucket, i.e. both
 *                       survive tick 1 and the ORDER of the killing tick decides the match
 *   what it becomes     both pools are smaller than ONE fog tick, so both die on tick 1 and
 *                       the ascending-HP sort alone decides — the bucket race never happens
 *
 * A "pass" in the second regime is the vacuous-control class: the assertion can no longer
 * FAIL for the reason it was written. This tool measures ticks-to-death per arm so the
 * distinction is a number rather than an argument.
 *
 *   node tools/tmp/ss_gap.mjs --root <worktree>
 *
 * Read-only. Imports the sim from `--root`, so point it at a detached worktree.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IS_MAIN = (() => {
  try { return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]); }
  catch { return false; }
})();

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

async function run() {
  const root = fs.realpathSync(arg('--root', '.'));
  const R = await import(pathToFileURL(path.join(root, 'src/game/rules.ts')).href);
  const FIXTURE_HP = Number(arg('--hp', '100')); // the literal §30(b) hardcodes

  const rows = [];
  let sameBucket = 0, bothDieTick1 = 0, illegal = 0, total = 0;
  for (let gap = 1; gap < R.FOG_DAMAGE; gap++) {
    total++;
    const a = FIXTURE_HP;
    const b = FIXTURE_HP - gap;
    if (b <= 0) { illegal++; continue; }
    const ta = Math.ceil(a / R.FOG_DAMAGE);
    const tb = Math.ceil(b / R.FOG_DAMAGE);
    if (ta === tb) sameBucket++;
    if (ta === 1 && tb === 1) bothDieTick1++;
    if (gap <= 3 || gap === R.FOG_DAMAGE - 1) rows.push(`gap ${gap}: ${a}HP=${ta}tick / ${b}HP=${tb}tick`);
  }

  console.log(`root                ${root}`);
  console.log(`FOG_DAMAGE          ${R.FOG_DAMAGE}   PLAYER_MAX_HP ${R.PLAYER_MAX_HP}`);
  console.log(`fixture HP literal  ${FIXTURE_HP}  (hardcoded in sim.test.mjs §30(b))`);
  console.log(`loop range          gap 1..${R.FOG_DAMAGE - 1}   (${total} cells, DERIVED from FOG_DAMAGE)`);
  console.log(`  cells with an ILLEGAL opponent (hp <= 0)     ${illegal}`);
  console.log(`  cells in the SAME fog bucket                 ${sameBucket}`);
  console.log(`  ...of which BOTH DIE ON TICK 1 (degenerate)  ${bothDieTick1}`);
  console.log(`  cells in DIFFERENT buckets (the negative arm) ${total - illegal - sameBucket}`);
  console.log(`  sample: ${rows.join(' · ')}`);
  const verdict = illegal > 0 || (sameBucket > 0 && bothDieTick1 === sameBucket);
  console.log(`\n${verdict ? '🔴 DEGENERATE' : '🟢 LIVE'} — ${
    illegal > 0 ? `${illegal} cells cannot be built at all; ` : ''}${
    sameBucket > 0 && bothDieTick1 === sameBucket
      ? 'every same-bucket cell is a one-tick wipe, so the multi-tick ORDERING race the assertion is named for is never exercised'
      : 'the multi-tick race is exercised'}`);
}

if (IS_MAIN) run();
