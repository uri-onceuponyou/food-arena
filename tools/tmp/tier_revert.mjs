#!/usr/bin/env node
/**
 * Inside a snapshot directory, put the RENDERER files back to HEAD.
 *
 * The point is a fair before/after. Five peers have uncommitted work in `src/arena/**`
 * and `src/characters/**` this session, so comparing a fresh `perf --mode counts`
 * against `tools/perf/baseline-match-desktop.json` would flag THEIR draw calls as this
 * change's regression. Freezing the tree once and reverting only `src/render/**` inside
 * the frozen copy leaves exactly one variable.
 *
 *   node tools/tmp/tier_revert.mjs <snapshot-dir>                  # src/render/**
 *   node tools/tmp/tier_revert.mjs <snapshot-dir> src/ui/hud.ts   # named files instead
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: tier_revert.mjs <snapshot-dir>'); process.exit(2); }

const named = process.argv.slice(3);
const FILES = named.length ? named : ['src/render/stage.ts', 'src/render/toon.ts', 'src/render/lighting.ts'];
for (const f of FILES) {
  const body = execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(dir, f), body);
  console.log(`reverted ${f} to HEAD (${body.length} bytes)`);
}
if (!named.length) {
  rmSync(join(dir, 'src/render/quality.ts'), { force: true });
  console.log('removed src/render/quality.ts');
}
