#!/usr/bin/env node
/**
 * pu_specifier_guard — the TWO import invariants `src/game/` silently depends on, plus the
 * dual-specifier census, with a known-bad arm for every one.
 *
 * ── WHY THIS EXISTS, AND WHAT IT DELIBERATELY DOES *NOT* CLAIM ──────────────────
 *
 * 🚨 **The story this was commissioned to fix is FALSE, and the measurement is in here so
 * nobody re-derives it.** The claim was: `rules.ts` is imported under two specifiers
 * (`'../game/rules'` and `'../game/rules.ts'`), Vite dev treats those as two module IDs,
 * `rules.ts` therefore executes twice, and `tuningRegistry.ts:claim()` throws
 * `duplicate registry key "MATCH_DURATION_MS"`.
 *
 * Vite dedupes them. Measured on `vite dev` at HEAD, by reading the TRANSFORMED source the
 * dev server actually serves:
 *
 *     src/render/camera.ts   imports '../game/rules.ts'  → from "/src/game/rules.ts?t=1787151750434"
 *     src/game/match.ts      imports './rules'           → from "/src/game/rules.ts?t=1787151750434"
 *     src/game/state.ts      imports './rules.ts'        → from "/src/game/rules.ts?t=1787151750434"
 *
 * Byte-identical module IDs, including the same invalidation stamp. One instance, one
 * `claim()` per key. The dev server boots clean at `?screen=home` AND at `?screen=admin`,
 * and still boots clean after `rules.ts` is touched (Vite full-reloads: nothing in `src/`
 * calls `import.meta.hot.accept`, so a partial re-evaluation cannot happen either).
 *
 * So this tool does NOT assert one specifier per module as a boot-safety rule — that would
 * be a guard against a bug that does not exist, and `CLAUDE.md` #6 is explicit that a guard
 * nobody can name a failing implementation for is "a comment with a tick next to it". It
 * reports the census as INFO. What it ENFORCES is the pair of invariants that really are
 * load-bearing and really are undocumented outside one shim's header:
 *
 *   RULE 1  FLAT. Everything reachable from `src/game/rules.ts` must resolve to a file
 *           directly in `src/game/` or `src/game/economy/`. Seven tracked staging tools
 *           (`stage_rules`, `stage_sim`, `stage_ai`, `stage_kit`, `stage_vitals`,
 *           `stage_weapon`, `rb_stage`) copy `src/game/*.ts` with a single NON-RECURSIVE
 *           `readdirSync`, and the whole balance-measurement layer — `roster_table`,
 *           `roster_lab`, `kit_lab`, `rules_sweep`, and the mandatory pre-commit gate
 *           `driver_guard` — sits on top of them. `src/game/tuning/registry.ts` records
 *           that this was found by `driver_guard` dying on ERR_MODULE_NOT_FOUND.
 *
 *   RULE 2  EXPLICIT `.ts`. Every relative import BETWEEN those files must carry the
 *           extension, because `node src/game/sim.test.mjs` runs with NO BUILD STEP and
 *           bare Node does not do extension resolution for ESM. That is the reason most
 *           gates in this repo can exist at all.
 *
 * ⚠️ These two rules pull in OPPOSITE directions from "just unify the specifiers". Inside
 * `src/game/` the extension is mandatory; outside it, either form works because a bundler
 * is always involved. A sweep that made everything extensionless would break the gates; a
 * sweep that made everything extensioned would be cosmetic. Hence: enforce, do not unify.
 *
 * ── THE KNOWN-BAD ARM ───────────────────────────────────────────────────────────
 *
 * `--selftest` re-runs the whole walk against a synthetic tree carrying one planted fault
 * of each class, and REQUIRES each to be caught. `CLAUDE.md` #6: a guard that has not been
 * shown to FAIL on the bug it guards against is not a guard — and #6 again on vacuity, so
 * the walk asserts it visited a NON-EMPTY set before reporting anything green.
 *
 * Usage:  node tools/tmp/pu_specifier_guard.mjs [--selftest] [--root <dir>]
 */

import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const argv = process.argv.slice(2);
const ri = argv.indexOf('--root');
const ROOT = ri >= 0 ? resolve(argv[ri + 1]) : REPO;

/**
 * Every RUNTIME relative specifier in a module: `import … from`, `export … from`, and the
 * bare side-effect form `import '…'` (which `src/game/tuning/index.ts` uses on purpose).
 *
 * 🚨 **`import type` / `export type` ARE EXCLUDED, AND SKIPPING THAT WAS A REAL FALSE
 * POSITIVE THIS TOOL PRODUCED ON ITS FIRST RUN.** It flagged
 * `src/arena/types.ts: import type { ConcealBox } from '../game/movement'` as a bare-node
 * resolution failure. It is not one: a type-only import is ERASED by the transform and no
 * specifier ever reaches Node — `node src/game/sim.test.mjs` passes 621/621 with that line
 * exactly as written. Caught by running the gate the guard claimed was broken, which is
 * `CLAUDE.md` #6's whole point: the instrument gets validated before it gets believed.
 */
/*
 * ⚠️ ANCHORED AT LINE START AND FORBIDDEN FROM CROSSING A `;`. The first draft used
 * `\b(import|export)\b([\s\S]*?)from` and its own selftest caught it: on
 * `export const R = 1;\nimport type { A } from './x'` the `export` of the FIRST statement
 * matched, so the captured middle was ` const R = 1;\nimport type { A } ` — which does not
 * start with `type`, so the type-only exclusion silently did not apply. The tool then
 * reported two faults on a line that emits no runtime import at all. Every import in this
 * repo starts a line, so anchoring costs nothing and closes the class.
 */
const IMPORT_RE = /^[ \t]*(import|export)\b([^;]*?)\bfrom\s*['"](\.[^'"]*)['"]/gm;
const SIDE_EFFECT_RE = /^[ \t]*import\s*['"](\.[^'"]*)['"]/gm;

/**
 * Strip comments and strings before scanning. Without this the walk reads specifiers out of
 * doc comments — `src/game/tuning/index.ts` alone names `'../rules.ts'` in prose — and a
 * census built on those would be wrong in the confident direction.
 */
function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function specifiersOf(file) {
  const src = code(readFileSync(file, 'utf8'));
  const out = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    // `import type {…}` / `export type {…}` — erased, never resolved at run time.
    if (/^\s*type\b/.test(m[2])) continue;
    out.push(m[3]);
  }
  for (const m of src.matchAll(SIDE_EFFECT_RE)) out.push(m[1]);
  return out;
}

/** Bare-Node ESM resolution: NO extension search. Returns null when Node would fail. */
function resolveExact(fromFile, spec) {
  const p = resolve(dirname(fromFile), spec);
  return existsSync(p) && !p.endsWith(sep) ? p : null;
}

/** Bundler resolution: extension search, then `/index.ts`. */
function resolveLoose(fromFile, spec) {
  const p = resolve(dirname(fromFile), spec);
  for (const cand of [p, `${p}.ts`, `${p}.mts`, `${p}.js`, join(p, 'index.ts')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * The two closures, and they have DIFFERENT legal sets — which is the whole reason a single
 * "one specifier per module" sweep would have been the wrong fix.
 *
 *   staged   what the seven `stage_*` tools must be able to copy. `stage_rules.mjs` is the
 *            reference implementation and it copies `readdirSync('src/game')` filtered to
 *            `.ts` — TOP LEVEL ONLY — plus exactly one extra file, `src/arena/types.ts`.
 *            So the legal set here is `src/game/*.ts` + that one file. `src/game/economy/`
 *            is NOT staged and must not appear in this closure.
 *
 *   barenode what `node src/game/sim.test.mjs` and `node src/game/economy/economy.test.mjs`
 *            must be able to resolve with no build step. Same flat-file rule plus
 *            `src/game/economy/*.ts`, because those tests live there and Node resolves
 *            relative paths fine — it is only extension SEARCH that it will not do.
 */
const CLOSURES = {
  staged: {
    roots: ['src/game/rules.ts', 'src/game/sim.ts'],
    legal: (t) => /^src[/\\]game[/\\][^/\\]+\.ts$/.test(t) || t === join('src', 'arena', 'types.ts'),
    why: 'the seven `stage_*` tools copy `src/game/*.ts` non-recursively, plus src/arena/types.ts',
    // Measured 8 at HEAD. A floor rather than an equality: this closure grows legitimately.
    floor: 5,
  },
  barenode: {
    roots: ['src/game/sim.test.mjs', 'src/game/economy/economy.test.mjs'],
    legal: (t) => /^src[/\\]game[/\\][^/\\]+\.ts$/.test(t)
      || /^src[/\\]game[/\\]economy[/\\][^/\\]+\.ts$/.test(t)
      || t === join('src', 'arena', 'types.ts'),
    why: 'the no-build-step gates run these two files under bare `node`',
    // Measured 18 at HEAD.
    floor: 10,
  },
};

function walk(root, closure) {
  const entries = closure.roots.map((r) => join(root, r)).filter((f) => existsSync(f));
  if (!entries.length) return { faults: [`no entry among ${closure.roots.join(', ')}`], visited: [], census: new Map() };

  const faults = [];
  const visited = new Set();
  /** module absolute path → Set of specifier strings it was imported under */
  const census = new Map();
  const queue = [...entries];

  while (queue.length) {
    const file = queue.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    for (const spec of specifiersOf(file)) {
      const loose = resolveLoose(file, spec);
      const rel = relative(root, file);
      if (!loose) { faults.push(`${rel}: '${spec}' resolves to nothing at all`); continue; }

      // RULE 2 — bare Node must be able to resolve it, i.e. the specifier is exact.
      if (!resolveExact(file, spec)) {
        faults.push(
          `RULE 2 (bare-node) ${rel}: '${spec}' needs extension search — `
          + `\`node src/game/sim.test.mjs\` cannot resolve it`);
      }

      // RULE 1 — the target must be inside this closure's legal set.
      const target = relative(root, loose);
      if (!closure.legal(target)) {
        faults.push(`RULE 1 (flat) ${rel}: '${spec}' → ${target} — ${closure.why}`);
      }

      census.set(loose, (census.get(loose) ?? new Set()).add(spec));
      queue.push(loose);
    }
  }
  return { faults, visited: [...visited], census };
}

function report(root, label, closure = CLOSURES.staged) {
  const { faults, visited, census } = walk(root, closure);

  // ⚠️ NON-EMPTY FIRST. `CLAUDE.md` #6: `[].every()` is `true`, and three vacuous guards
  // fired in one session because a fix emptied the set the assertion ran over. A walk that
  // reached one file would otherwise report a clean sheet.
  if (visited.length < (closure.floor ?? 3)) {
    console.error(`${label}: VACUOUS — the walk visited ${visited.length} module(s). Nothing was checked.`);
    return { faults: ['vacuous walk'], visited, census };
  }

  console.log(`${label}: ${visited.length} modules reachable from ${closure.roots.join(' + ')}`);
  const dual = [...census].filter(([, specs]) => new Set([...specs].map((s) => s.replace(/\.ts$/, ''))).size < specs.size);
  if (dual.length) {
    console.log(`  INFO  ${dual.length} module(s) imported under BOTH specifier forms `
      + '(Vite dedupes these — measured; see this file\'s header):');
    for (const [f, specs] of dual) console.log(`          ${relative(root, f)}  ${[...specs].join('  ')}`);
  }
  for (const f of faults) console.log(`  FAULT ${f}`);
  console.log(`  ${faults.length === 0 ? 'PASS' : 'FAIL'} — ${faults.length} fault(s)`);
  return { faults, visited, census };
}

if (argv.includes('--selftest')) {
  // A synthetic tree: one clean arm, then one planted fault of each class.
  const dir = mkdtempSync(join(tmpdir(), 'pu-spec-'));
  const g = join(dir, 'src/game');
  mkdirSync(join(g, 'economy'), { recursive: true });
  mkdirSync(join(g, 'sub'), { recursive: true });
  const write = (p, s) => writeFileSync(join(g, p), s);
  write('rules.ts', "import { a } from './leaf.ts';\nimport { b } from './economy/tuning.ts';\nexport const R = a + b;\n");
  write('leaf.ts', 'export const a = 1;\n');
  write('economy/tuning.ts', 'export const b = 2;\n');
  write('sub/deep.ts', 'export const c = 3;\n');

  let ok = true;
  console.log('\n── selftest ────────────────────────────────────────────────');
  // Padding so the clean arm clears the vacuity floor.
  for (let i = 0; i < 4; i++) {
    write(`pad${i}.ts`, 'export const p = 0;\n');
  }
  write('rules.ts', "import { a } from './leaf.ts';\nimport { b } from './economy/tuning.ts';\n"
    + [0, 1, 2, 3].map((i) => `import { p as p${i} } from './pad${i}.ts';`).join('\n') + '\nexport const R = 1;\n');
  const SYN = {
    roots: ['src/game/rules.ts'],
    legal: (t) => /^src[/\\]game[/\\][^/\\]+\.ts$/.test(t) || /^src[/\\]game[/\\]economy[/\\][^/\\]+\.ts$/.test(t),
    why: 'synthetic fixture',
    floor: 5,
  };
  const clean = report(dir, 'CONTROL  clean tree', SYN);
  if (clean.faults.length !== 0) { console.error('  ✗ the clean arm must PASS — the rest of this selftest means nothing otherwise'); ok = false; }

  const base = readFileSync(join(g, 'rules.ts'), 'utf8');

  write('rules.ts', `${base}import { a as a2 } from './leaf';\n`);   // RULE 2: extensionless
  const r2 = report(dir, 'KNOWN-BAD  extensionless import', SYN);
  if (!r2.faults.some((f) => f.startsWith('RULE 2'))) { console.error('  ✗ RULE 2 was NOT caught'); ok = false; }

  write('rules.ts', `${base}import { c } from './sub/deep.ts';\n`);  // RULE 1: subdirectory
  const r1 = report(dir, 'KNOWN-BAD  subdirectory import', SYN);
  if (!r1.faults.some((f) => f.startsWith('RULE 1'))) { console.error('  ✗ RULE 1 was NOT caught'); ok = false; }

  // ── the `import type` exclusion needs its OWN pair of arms ────────────────────
  // Skipping type-only statements is what stopped a false positive on
  // `src/arena/types.ts`, and an exclusion with no control is how a guard goes quiet.
  // The SAME extensionless specifier must be IGNORED as a type import and CAUGHT as a
  // value import — one arm each, because either alone is satisfiable by doing nothing.
  write('rules.ts', `${base}import type { A } from './sub/deep';\n`);
  const rT = report(dir, 'CONTROL   type-only extensionless import (must be IGNORED)', SYN);
  if (rT.faults.length !== 0) { console.error('  ✗ a type-only import was flagged — the false positive is back'); ok = false; }

  write('rules.ts', `${base}import { A } from './sub/deep';\n`);
  const rV = report(dir, 'KNOWN-BAD value extensionless import of the same path', SYN);
  if (!rV.faults.some((f) => f.startsWith('RULE 2'))) { console.error('  ✗ the VALUE form was not caught — the exclusion is too wide'); ok = false; }

  // Side-effect imports are the form `src/game/tuning/index.ts` uses; they must be walked.
  write('rules.ts', `${base}import './sub/deep.ts';\n`);
  const rS = report(dir, 'KNOWN-BAD side-effect import into a subdirectory', SYN);
  if (!rS.faults.some((f) => f.startsWith('RULE 1'))) { console.error('  ✗ a bare side-effect import was not walked'); ok = false; }

  rmSync(dir, { recursive: true, force: true });
  console.log(`\npu_specifier_guard --selftest: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
}

let faults = 0;
for (const [name, closure] of Object.entries(CLOSURES)) {
  faults += report(ROOT, `pu_specifier_guard [${name}]`, closure).faults.length;
}
console.log(`\npu_specifier_guard: ${faults === 0 ? 'PASS' : 'FAIL'} — ${faults} fault(s) across ${Object.keys(CLOSURES).length} closures`);
process.exit(faults === 0 ? 0 : 1);
