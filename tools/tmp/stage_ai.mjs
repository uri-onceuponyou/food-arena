#!/usr/bin/env node
/**
 * STAGE A PATCHED DRIVER — `tools/tmp/stage_rules.mjs` for `ai.ts` instead of a constant.
 *
 * `stage_rules.mjs` and `stage_weapon.mjs` both stage a frozen copy of `src/game` with a
 * textual substitution in `rules.ts`. Neither can stage a change to the DRIVER, and the
 * AI fixes in this pass are code, not constants — so pricing them one at a time (which
 * is the only way to declare "this fix cost X" rather than "these four fixes together
 * cost X") had no instrument at all.
 *
 *   node tools/tmp/stage_ai.mjs <outdir> <path/to/candidate-ai.ts>
 *   node tools/tmp/stage_ai.mjs <outdir>            # unchanged control copy
 *
 * The control form (no candidate) matters: a staged control measured against the live
 * tree would let a peer's save land on one side of a comparison and not the other
 * (`docs/LESSONS.md` §5), and running it through the same code path as the candidates
 * also proves the staging itself is not what moved the number.
 */
import { mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const [outdir, candidate] = process.argv.slice(2);
if (!outdir) {
  console.error('usage: stage_ai.mjs <outdir> [candidate-ai.ts]');
  process.exit(1);
}
if (candidate && !existsSync(candidate)) {
  console.error(`stage_ai: no candidate at ${candidate} — refusing to stage a control by accident`);
  process.exit(2);
}

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);
if (candidate) copyFileSync(candidate, `${outdir}/game/ai.ts`);

console.error(`staged ${outdir} with ai.ts = ${candidate ?? 'src/game/ai.ts (control)'}`);
