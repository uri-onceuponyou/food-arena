#!/usr/bin/env node
/**
 * NAV probe helper — extract `src/game/` AS COMMITTED AT HEAD so before/after can be
 * measured in the same session, on the same frozen arena, without a checkout or a stash.
 *
 * Writes to the OS temp directory, NOT into the repo. An earlier version of this put the
 * copy in `tools/tmp/`, which is inside `tsconfig.json`'s `include: ["src", "tools"]` —
 * so a directory of scratch `.ts` files missing one relative import turned `npx tsc
 * --noEmit` red for five other agents at once, over work that was nobody's. That is
 * `docs/LESSONS.md` S5 (measurement contamination) reaching the type checker instead of a
 * render, and the fix is the same one: keep the measurement apparatus out of the shared
 * artefact entirely.
 *
 * Every module under `src/game/` imports its siblings relatively and reaches outside the
 * directory only through `import type`, which type-stripping erases — so the six sim files
 * are a self-contained program once `arena/types.ts` is alongside them for tsc's benefit.
 *
 *   node tools/tmp/nav_baseline_setup.mjs [ref]      # default HEAD
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
export const BASELINE_DIR = join(tmpdir(), 'fa-nav-baseline');

const ref = process.argv[2] ?? 'HEAD';
rmSync(BASELINE_DIR, { recursive: true, force: true });
mkdirSync(join(BASELINE_DIR, 'game'), { recursive: true });
mkdirSync(join(BASELINE_DIR, 'arena'), { recursive: true });

for (const f of ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts']) {
  writeFileSync(join(BASELINE_DIR, 'game', f), execFileSync('git', ['show', `${ref}:src/game/${f}`], { cwd: ROOT, encoding: 'utf8' }));
}
writeFileSync(join(BASELINE_DIR, 'arena', 'types.ts'), execFileSync('git', ['show', `${ref}:src/arena/types.ts`], { cwd: ROOT, encoding: 'utf8' }));
console.error(`baseline (${ref}) -> ${BASELINE_DIR}`);
