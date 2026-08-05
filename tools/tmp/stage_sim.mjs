#!/usr/bin/env node
/**
 * STAGE AN ARBITRARY SIM PATCH — `stage_kit.mjs` reaches `rules.ts`; this reaches any
 * file in `src/game`, so a candidate that lives in `ai.ts` or `sim.ts` can be PRICED
 * without ever being written to the shared tree.
 *
 * That is the point. `docs/LESSONS.md` §5: edit on the shared tree, measure on a frozen
 * copy — and a balance candidate that has to be committed before it can be measured
 * cannot be refused cheaply.
 *
 *   node tools/tmp/stage_sim.mjs /tmp/cand --patch <spec.json>
 *
 * The spec is a list of `{ file, find, replace, label }`. ⚠️ Every `find` must match
 * EXACTLY ONCE or the stager exits non-zero — a substitution that silently changed
 * nothing produces a confident, entirely fictional "this candidate does nothing" row,
 * which is the most expensive failure mode an instrument on this project has
 * (`stage_kit.mjs` carries the same rule for the same reason).
 */
import { mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const outdir = argv.find((a) => !a.startsWith('--'));
const specPath = argv.includes('--patch') ? argv[argv.indexOf('--patch') + 1] : null;
if (!outdir || !specPath) {
  console.error('usage: stage_sim.mjs <outdir> --patch <spec.json>');
  process.exit(1);
}

rmSync(outdir, { recursive: true, force: true });
mkdirSync(`${outdir}/game`, { recursive: true });
mkdirSync(`${outdir}/arena`, { recursive: true });
for (const f of readdirSync(`${ROOT}/src/game`)) {
  if (f.endsWith('.ts')) copyFileSync(`${ROOT}/src/game/${f}`, `${outdir}/game/${f}`);
}
copyFileSync(`${ROOT}/src/arena/types.ts`, `${outdir}/arena/types.ts`);

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const applied = [];
for (const p of spec) {
  const path = `${outdir}/game/${p.file}`;
  const src = readFileSync(path, 'utf8');
  const n = src.split(p.find).length - 1;
  if (n !== 1) {
    console.error(`stage_sim: "${p.label ?? p.find.slice(0, 48)}" matched ${n} times in ${p.file} — refusing to guess`);
    process.exit(2);
  }
  writeFileSync(path, src.replace(p.find, p.replace));
  applied.push(`${p.file}: ${p.label ?? 'patch'}`);
}
console.log(`staged ${outdir}\n  ${applied.join('\n  ')}`);
