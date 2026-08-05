#!/usr/bin/env node
/**
 * STAGE A PATCHED SIM — copy `src/game/*.ts` (+ `src/arena/types.ts`) into a temp dir
 * and rewrite one or more `rules.ts` constants, so a constant can be SWEPT against the
 * real `sim.ts` without editing the shared tree (docs/LESSONS.md §5: never measure a
 * constant change and a peer's save together).
 *
 *   node tools/tmp/stage_rules.mjs <outdir> KEY=VALUE [KEY=VALUE ...]
 *
 * KEY may be a top-level export (`REGEN_DELAY_MS`) or a dotted field of a const object
 * (`TRAIL.durationMs`, `POT.tickMs`). Values are substituted textually on the exact
 * declaration line, and the script FAILS LOUDLY if a key does not match exactly once —
 * a silent no-op sweep is the worst possible outcome here.
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const [outdir, ...pairs] = process.argv.slice(2);
if (!outdir) { console.error('usage: stage_rules.mjs <outdir> KEY=VALUE ...'); process.exit(1); }

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);

let src = readFileSync(`${outdir}/game/rules.ts`, 'utf8');
for (const pair of pairs) {
  const eq = pair.indexOf('=');
  const key = pair.slice(0, eq);
  const val = pair.slice(eq + 1);
  let re;
  if (key.includes('.')) {
    const [, field] = key.split('.');
    re = new RegExp(`^(\\s*${field}:\\s*)([^,\\n]+)(,?)$`, 'm');
  } else {
    re = new RegExp(`^(export const ${key}\\s*=\\s*)([^;]+)(;)`, 'm');
  }
  const hits = src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
  if (!hits || hits.length !== 1) {
    console.error(`stage_rules: "${key}" matched ${hits ? hits.length : 0} times — refusing to guess`);
    process.exit(2);
  }
  src = src.replace(re, `$1${val}$3`);
}
writeFileSync(`${outdir}/game/rules.ts`, src);
console.error(`staged ${outdir} with ${pairs.join(' ')}`);
