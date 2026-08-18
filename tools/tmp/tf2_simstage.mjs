#!/usr/bin/env node
/**
 * TF2_SIMSTAGE — the sim's module closure, **DERIVED**, so nobody types it out again.
 *
 *   node tools/tmp/tf2_simstage.mjs             # the closure at the working tree
 *   node tools/tmp/tf2_simstage.mjs --ref <sha> # the closure as it was at a commit
 *   node tools/tmp/tf2_simstage.mjs --selftest  # the known-bad arms. Run this before believing it
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Eleven tools stage a standalone copy of the sim by copying files named in a
 * HAND-WRITTEN list:
 *
 *     const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];
 *
 * `conceal_lab.mjs` even carried the warning — *"There are FOUR hardcoded copies of this
 * list in the repo … a seventh module under `src/game/` therefore means finding all of
 * them"* — and by the time §76 added a seventh AND an eighth there were eleven copies, not
 * four, and every one of them broke at once. Four went red in `gatecount`; **seven had no
 * gate row and broke in silence.**
 *
 * 🚨 This is `CLAUDE.md`'s most-recorded defect shape: **one rule stated in two places.**
 * Five AI driver bugs, `range` as two quantities in one number, per-pellet `damage`
 * balanced against twice, the 1× map literals, a fog formula duplicated so it *"AGREED BY
 * CONSTRUCTION"*. A hand-written closure agrees with the real one right up until an
 * `import` is added, and then it is wrong everywhere simultaneously and mostly quietly.
 *
 * Adding `'tuningRegistry.ts', 'tuningStore.ts'` to eleven lists fixes today and guarantees
 * the same morning again. This walks the real `import` graph instead.
 *
 * ── 🚨 AND THE TWO-STRING FIX IS NOT MERELY WEAK, IT IS WRONG ───────────────
 *
 * Six of the eleven stage from a **git ref**, not from the working tree, and one of them
 * (`roster_lab.mjs`) is pinned to `099119a` forever, on purpose, so a published 27.2% /
 * 18.8% keeps reproducing. `git show 099119a:src/game/tuningRegistry.ts` **exits 128** —
 * the file did not exist yet. A hardcoded eight-module list therefore turns a tool that is
 * green today (`roster_lab --selftest`, 9/9, measured) RED, and breaks every `--ref`/
 * `--sim-ref` below `c5b9754`, which is exactly what a bisect points at.
 *
 * **So the closure has to be derived AT THE SOURCE BEING STAGED**, which is the whole
 * argument for a function over a constant: `simModulesAtRef('099119a')` returns six and
 * `simModulesFromTree()` returns eight, and both are correct.
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────
 *
 * `c5b9754` recorded a FLAT-IMPORT invariant: everything `rules.ts` transitively imports
 * must be a flat `.ts` file in `src/game/`, because these stagers copy with a single
 * non-recursive pass and write bare filenames. A nested specifier (`./tuning/index.ts`)
 * would stage as a file that cannot resolve — the same silent breakage one level down — so
 * it THROWS here rather than returning a list that stages a broken tree.
 *
 * Likewise an import that leaves `src/game/` is refused unless it is on `EXTERNALS_OK`.
 * Today that is `src/arena/types.ts` and every one of the eleven already stages it by hand
 * alongside the closure. A new one appearing and being silently dropped is this bug again.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);

/** The program's entry point. Everything the sim needs is reachable from here. */
export const SIM_ENTRY = 'sim.ts';
/** The flat directory the closure must live in. */
export const SIM_DIR_REL = 'src/game';
/**
 * Imports allowed to leave `src/game/`. Every stager already writes this file by hand into
 * `<stage>/arena/types.ts`; it is `import type` only, so type-stripping erases it at
 * runtime and it is staged for `tsc`'s benefit. Anything ELSE leaving the directory is a
 * staging bug waiting to happen, so the derivation refuses it loudly.
 */
export const EXTERNALS_OK = ['src/arena/types.ts'];

// ─────────────────────────────────────────────────────────────────────────────
// parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Blank out comments, keeping line count intact.
 *
 * 🚨 **WITHOUT THIS THE DERIVATION READS ITS OWN PROSE.** `tun_scrapes.mjs` shipped a first
 * draft that flagged two comments describing scraping, and the lesson generalises: every
 * file under `src/game/` documents its imports in a header, and a commented-out
 * `import … from './ghost.ts'` is a normal thing to find in a file mid-refactor. Following
 * one would stage a file that does not exist. `--selftest` carries that exact known-bad.
 */
function codeOnly(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split('\n').map((line) => {
    const i = line.indexOf('//');
    return i >= 0 ? line.slice(0, i) : line;
  }).join('\n');
}

/**
 * Every relative `.ts` specifier in a module — `import`, `import type`, `export … from`,
 * `export *`, and dynamic `import()`.
 *
 * ⚠️ TYPE-ONLY EDGES ARE FOLLOWED ON PURPOSE. Node's type-stripping erases them, so a
 * runtime-only closure would be smaller — but the staged tree is also type-checked, and
 * `state.ts` reaches `movement.ts` through nothing but `import type { ConcealBox }`. The
 * hand-written list these replace was a superset too. A closure that is too small stages a
 * tree that does not compile; one that is too large copies a file nobody imports. The first
 * is a bug and the second is a byte.
 */
function specifiersOf(text) {
  const src = codeOnly(text);
  const out = [];
  // `from '…'` covers import / import type / export … from / export * from.
  for (const m of src.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  // dynamic import('…')
  for (const m of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
  // `import './side-effect.ts'` with no bindings
  for (const m of src.matchAll(/\bimport\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out.filter((s) => s.startsWith('.') && s.endsWith('.ts'));
}

// ─────────────────────────────────────────────────────────────────────────────
// the closure
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk `sim.ts`'s import graph. `read(relPathFromRepoRoot)` returns the file's text, or
 * `null` if it does not exist at this source.
 *
 * Returns `{ modules, external }` where `modules` are bare filenames inside `src/game/`,
 * breadth-first from the entry (so `sim.ts` is always first and the order is stable), and
 * `external` are repo-relative paths outside it.
 *
 * THROWS on: an unreadable entry, an unresolvable specifier, a NESTED specifier (the
 * flat-import invariant), or an external not on `EXTERNALS_OK`. Every one of those would
 * otherwise stage a tree that fails at `import` time in a child process, which is the
 * failure this whole file exists to stop being silent.
 */
export function simClosure(read, { entry = SIM_ENTRY, externalsOk = EXTERNALS_OK } = {}) {
  const entryText = read(posix.join(SIM_DIR_REL, entry));
  if (entryText == null) throw new Error(`tf2_simstage: cannot read the entry ${SIM_DIR_REL}/${entry}`);

  const modules = [];
  const external = [];
  const seen = new Set();
  const queue = [entry];
  seen.add(entry);

  while (queue.length) {
    const name = queue.shift();
    const rel = posix.join(SIM_DIR_REL, name);
    const text = name === entry ? entryText : read(rel);
    if (text == null) throw new Error(`tf2_simstage: ${rel} is imported but cannot be read`);
    modules.push(name);

    for (const spec of specifiersOf(text)) {
      const target = posix.normalize(posix.join(posix.dirname(rel), spec));
      if (target.startsWith(`${SIM_DIR_REL}/`)) {
        const bare = target.slice(SIM_DIR_REL.length + 1);
        if (bare.includes('/')) {
          throw new Error(
            `tf2_simstage: ${rel} imports '${spec}' — a NESTED module. `
            + `${SIM_DIR_REL}/ must stay FLAT: eleven stagers copy it with one non-recursive `
            + `pass and write bare filenames, so '${bare}' would stage as a file that cannot resolve.`);
        }
        if (!seen.has(bare)) { seen.add(bare); queue.push(bare); }
      } else {
        if (!externalsOk.includes(target)) {
          throw new Error(
            `tf2_simstage: ${rel} imports '${spec}' -> ${target}, which is outside ${SIM_DIR_REL}/ `
            + `and not on EXTERNALS_OK (${externalsOk.join(', ')}). Every stager writes the allowed `
            + `externals by hand; a new one silently dropped is the bug this file exists to prevent.`);
        }
        if (!external.includes(target)) external.push(target);
      }
    }
  }
  /**
   * 🚨 POST-CONDITION, so no caller has to write it. `CLAUDE.md` #6: `[].every()` is `true`,
   * and that vacuity fired three times in three files in one session. Callers run
   * `.every()` / `.filter()` / `.includes()` over this list — one of them uses it as a CACHE
   * predicate, where an empty closure would read as "already staged, nothing to do" and the
   * fix would silently never run. An empty closure is unreachable by construction (the entry
   * is always pushed) which is exactly why it is worth asserting: it costs nothing and it
   * makes the vacuous case impossible rather than merely unlikely.
   */
  if (modules.length === 0) throw new Error('tf2_simstage: derived an EMPTY closure — refusing to return a vacuously-true list');
  return { modules, external };
}

/** A reader over the working tree. */
export function readerForTree(root = ROOT) {
  return (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : null);
}

/**
 * A reader over a git ref.
 *
 * ⚠️ A missing path must come back as `null`, not as a thrown `git` error — `simClosure`
 * distinguishes "not imported by anyone" from "imported and unreadable", and only the
 * second is a fault. `git show` exits 128 for both a bad path and a bad ref, so the ref is
 * resolved FIRST and separately: a typo'd ref must not read as an empty closure.
 */
export function readerForRef(ref, root = ROOT) {
  execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return (rel) => {
    try {
      return execFileSync('git', ['show', `${ref}:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { return null; }
  };
}

/** The closure's bare filenames at the working tree — the drop-in for a hardcoded list. */
export function simModulesFromTree(root = ROOT) {
  return simClosure(readerForTree(root)).modules;
}

/** The closure's bare filenames AS THEY WERE at `ref`. Six at `099119a`, eight at HEAD. */
export function simModulesAtRef(ref, root = ROOT) {
  return simClosure(readerForRef(ref, root)).modules;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE CENSUS — refuse a TWELFTH hand-written copy
// ═════════════════════════════════════════════════════════════════════════════
/**
 * `driver_guard.mjs` exists because one DRIVER was copied thirteen times, and it is a
 * mandatory pre-commit gate for one reason: *"it is not enough to fix it — it has to be
 * impossible to reintroduce quietly."* This is the same sentence about a different payload.
 * Deriving the closure fixes the eleven copies that exist; it does nothing about the twelfth,
 * and a twelfth is exactly what the last eleven years of this file's history predicts.
 *
 * ⚠️ **THE THRESHOLD IS 3, AND THAT IS A PRICED MISS, NOT AN OVERSIGHT.** A bracket has to
 * hold three or more quoted bare `*.ts` names that are IN the closure. `['sim.ts','ai.ts']`
 * slips through. Two is where the false positives live — `readdirSync` filters, test
 * fixtures, `['sim.ts', 'rules.ts']` pairs used for a diff — and `tun_scrapes.mjs` already
 * paid for the lesson that a locator nobody trusts is a locator nobody reads.
 *
 * ⚠️ **AND COMMENTS ARE STRIPPED FIRST, WHICH IS LOAD-BEARING ON REAL DATA:** every file
 * this pass fixed now carries the old list verbatim in a `WAS:` comment, because
 * `CLAUDE.md` requires a reversed rule to keep its old wording. Without `codeOnly` this
 * census would report all ten of its own fixes as fresh violations.
 */
export const CENSUS_ALLOW = {
  // A different question with a different answer: `wtx_vocab` asks WHICH FILES READ a
  // weapon field, so its list deliberately includes `match.ts` and `vfx.ts` — neither is in
  // `sim.ts`'s closure — and deliberately omits `rules.ts`, where the fields are declared.
  // It is not a stager and nothing it does breaks when the closure grows.
  // 🚨 It is NOT thereby correct: `tuningRegistry.registerCharacterFields` mutates weapon
  // records, so a field read only there reads as UNREAD. Reported, not fixed — out of set.
  'tools/tmp/wtx_vocab.mjs': 'reader census, not a stager — see the note in CENSUS_ALLOW',
};

/** Every `tools/**.mjs|.js`, matching the sweep `driver_guard.mjs` already uses. */
function toolFiles(root = ROOT) {
  const out = [];
  for (const dir of ['tools', 'tools/tmp']) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      if (f.endsWith('.mjs') || f.endsWith('.js')) out.push(`${dir}/${f}`);
    }
  }
  return out.sort();
}

/** Hand-written copies of the module list, as `{ file, line, names }`. */
export function listCopies(text, closure) {
  const src = codeOnly(text);
  const hits = [];
  for (const m of src.matchAll(/\[[^[\]]*\]/g)) {
    const names = [...m[0].matchAll(/['"]([A-Za-z0-9_]+\.ts)['"]/g)].map((q) => q[1]);
    const inClosure = names.filter((n) => closure.includes(n));
    if (names.length >= 3 && inClosure.length >= 3) {
      hits.push({ line: src.slice(0, m.index).split('\n').length, names });
    }
  }
  return hits;
}

/** The whole-repo census. Returns `{ scanned, offenders }`. */
export function censusRepo(root = ROOT) {
  const closure = simModulesFromTree(root);
  const files = toolFiles(root);
  const offenders = [];
  for (const rel of files) {
    if (rel === 'tools/tmp/tf2_simstage.mjs') continue;   // this file DEFINES the closure
    const hits = listCopies(readFileSync(join(root, rel), 'utf8'), closure);
    if (hits.length) offenders.push({ file: rel, hits, allowed: rel in CENSUS_ALLOW });
  }
  return { scanned: files.length, offenders, closure };
}

// ═════════════════════════════════════════════════════════════════════════════
// CLI — guarded, because an export that runs on import is a live trap here
// (`docs/AGENT-BRIEF.md` §3: importing `snapsweep.mjs` printed a live sweep).
// ═════════════════════════════════════════════════════════════════════════════

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_MAIN) {
  const argv = process.argv.slice(2);

  if (argv.includes('--selftest')) {
    let pass = 0; const fails = [];
    const ok = (name, cond, detail = '') => {
      if (cond) { pass++; console.log(`   PASS  ${name}${detail ? `  ${detail}` : ''}`); }
      else { fails.push(name); console.log(`   FAIL  ${name}${detail ? `  ${detail}` : ''}`); }
    };
    /** A reader over an in-memory tree, so a known-bad costs no disk. */
    const fixture = (files) => (rel) => (rel in files ? files[rel] : null);
    const G = (n) => `${SIM_DIR_REL}/${n}`;
    const threw = (fn) => { try { fn(); return null; } catch (e) { return String(e.message); } };

    console.log('\n══ tf2_simstage --selftest ══  every arm paired with the implementation that fails it\n');

    // ── A. the real tree ──────────────────────────────────────────────────
    const tree = simClosure(readerForTree());
    // 🚨 NON-EMPTY FIRST. `CLAUDE.md` #6: `[].every()` is `true`, and that vacuity fired
    // three times in three files in one session. Every assertion below filters this set.
    ok('A0 the derived closure is NON-EMPTY before anything is asserted over it',
      tree.modules.length > 0, `${tree.modules.length} modules`);
    ok('A1 it contains the six modules the hand-written list named',
      ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'].every((f) => tree.modules.includes(f)),
      tree.modules.join(' '));
    ok('A2 …and the two §76 added, which is the whole bug',
      tree.modules.includes('tuningRegistry.ts') && tree.modules.includes('tuningStore.ts'));
    ok('A3 the entry is first and the order is stable', tree.modules[0] === SIM_ENTRY);
    ok('A4 every module named actually exists on disk',
      tree.modules.every((f) => existsSync(join(ROOT, SIM_DIR_REL, f))));
    ok('A5 the only external is the one every stager already writes by hand',
      tree.external.length === 1 && tree.external[0] === 'src/arena/types.ts', tree.external.join(' '));

    // ── B. THE KNOWN-BAD THIS FILE EXISTS FOR ─────────────────────────────
    // A new module appears in the closure. The derivation must FIND it and the
    // hand-written list must MISS it — both arms, or the test proves nothing.
    {
      const f = fixture({
        [G('sim.ts')]: `import { x } from './state.ts';`,
        [G('state.ts')]: `import { y } from './rules.ts';`,
        [G('rules.ts')]: `import { tune } from './newThing.ts';`,
        [G('newThing.ts')]: `export const tune = 1;`,
      });
      const got = simClosure(f).modules;
      const HAND = ['sim.ts', 'state.ts', 'rules.ts'];
      ok('B1 KNOWN-BAD: a module added to the graph IS found by the derivation',
        got.includes('newThing.ts'), got.join(' '));
      ok('B2 …and the hand-written list MISSES it — the positive control on B1',
        !HAND.includes('newThing.ts'));
    }

    // ── C. it is a CLOSURE, not a readdir ─────────────────────────────────
    {
      const f = fixture({
        [G('sim.ts')]: `import { x } from './state.ts';`,
        [G('state.ts')]: `export const x = 1;`,
        [G('decoy.ts')]: `export const nobodyImportsMe = 1;`,
      });
      const got = simClosure(f).modules;
      ok('C1 an unreachable file in the directory is NOT staged', !got.includes('decoy.ts'), got.join(' '));
      ok('C2 …and the reachable one is — the positive control on C1', got.includes('state.ts'));
    }

    // ── D. prose is not an import (the tun_scrapes trap) ──────────────────
    {
      const f = fixture({
        [G('sim.ts')]: `// import { g } from './ghost.ts';\n/* import { h } from './phantom.ts'; */\nimport { x } from './state.ts';`,
        [G('state.ts')]: `export const x = 1;`,
      });
      const got = simClosure(f).modules;
      ok('D1 a COMMENTED-OUT import is not followed (line comment)', !got.includes('ghost.ts'), got.join(' '));
      ok('D2 …nor a block-commented one', !got.includes('phantom.ts'));
      ok('D3 …while the real import on the next line still is — the positive control',
        got.includes('state.ts'));
    }

    // ── E. the refusals, each with a positive control ─────────────────────
    {
      const nested = fixture({
        [G('sim.ts')]: `import { x } from './tuning/index.ts';`,
        [G('tuning/index.ts')]: `export const x = 1;`,
      });
      const msg = threw(() => simClosure(nested));
      ok('E1 a NESTED import THROWS (the flat-import invariant c5b9754 recorded)',
        msg !== null && /NESTED/.test(msg), msg ?? 'did not throw');
      const flat = fixture({ [G('sim.ts')]: `import { x } from './state.ts';`, [G('state.ts')]: `export const x = 1;` });
      ok('E2 …and a FLAT import does not — the positive control on E1', threw(() => simClosure(flat)) === null);

      const stray = fixture({ [G('sim.ts')]: `import { x } from '../render/stage.ts';`, ['src/render/stage.ts']: `export const x = 1;` });
      const msg2 = threw(() => simClosure(stray));
      ok('E3 an import LEAVING src/game/ that is not on EXTERNALS_OK THROWS',
        msg2 !== null && /EXTERNALS_OK/.test(msg2), msg2 ?? 'did not throw');
      const okExt = fixture({ [G('sim.ts')]: `import type { A } from '../arena/types.ts';` });
      ok('E4 …and `../arena/types.ts` does not — the positive control on E3',
        threw(() => simClosure(okExt)) === null);

      const dangling = fixture({ [G('sim.ts')]: `import { x } from './missing.ts';` });
      ok('E5 an import naming a file that does not exist THROWS rather than staging a hole',
        threw(() => simClosure(dangling)) !== null);
      ok('E6 an unreadable ENTRY throws rather than returning an empty closure',
        threw(() => simClosure(fixture({}))) !== null);
    }

    // ── F. THE ARGUMENT FOR A FUNCTION OVER A CONSTANT ────────────────────
    // `roster_lab.mjs` is pinned to 099119a on purpose. A hardcoded eight-module list
    // would ask git for a file that did not exist yet and turn a green tool red.
    {
      const PINNED = '099119a';
      let atRef = null;
      const e = threw(() => { atRef = simModulesAtRef(PINNED); });
      ok(`F1 the closure at ${PINNED} is derivable`, e === null && atRef !== null, e ?? '');
      if (atRef) {
        ok(`F2 …and it is the SIX, not the eight — the pinned ref predates §76`,
          atRef.length === 6 && !atRef.includes('tuningRegistry.ts'), atRef.join(' '));
        ok('F3 …so the hardcoded-eight fix would have asked git for a file that does not exist',
          (() => { try { execFileSync('git', ['show', `${PINNED}:src/game/tuningRegistry.ts`], { cwd: ROOT, stdio: 'ignore' }); return false; } catch { return true; } })());
      } else { ok('F2 skipped', false); ok('F3 skipped', false); }
      ok('F4 a ref that does not exist THROWS rather than reading as an empty closure',
        threw(() => simModulesAtRef('no-such-ref-000000')) !== null);
    }

    // ── G. THE CENSUS — a guard that has not been shown to FAIL is not a guard ──
    {
      const closure = simModulesFromTree();
      const PLANT = `const SIM_MODULES = ['sim.ts', 'ai.ts', 'movement.ts', 'combat.ts', 'state.ts', 'rules.ts'];`;
      ok('G1 KNOWN-BAD: a twelfth hand-written copy IS flagged',
        listCopies(PLANT, closure).length === 1, JSON.stringify(listCopies(PLANT, closure)));
      ok('G2 …and the SAME list inside a comment is NOT — every file this pass fixed carries one',
        listCopies(`// WAS: ${PLANT}\n/* ${PLANT} */`, closure).length === 0);
      ok('G3 …nor is a two-name array (the priced miss, stated so it is a decision not a bug)',
        listCopies(`const X = ['sim.ts', 'rules.ts'];`, closure).length === 0);
      ok('G4 …nor is an array of names that are not sim modules — the positive control on G1',
        listCopies(`const X = ['stage.ts', 'lighting.ts', 'toon.ts', 'quality.ts'];`, closure).length === 0);

      const c = censusRepo();
      // 🚨 NON-EMPTY FIRST, then the filtered assertion. `CLAUDE.md` #6.
      ok('G5 the census actually scanned a corpus (not a vacuous clean sweep)', c.scanned > 50, `${c.scanned} tool files`);
      const unexpected = c.offenders.filter((o) => !o.allowed);
      ok('G6 no UNALLOWED hand-written copy survives in tools/',
        unexpected.length === 0,
        unexpected.map((o) => `${o.file}:${o.hits.map((h) => h.line).join(',')}`).join(' ') || 'clean');
      /**
       * 🚨 **THIS ROW WAS WRONG AND A CLEAN WORKTREE CAUGHT IT.** It read
       *   `Object.keys(CENSUS_ALLOW).every((f) => c.offenders.some((o) => o.file === f))`
       * — "every allowlisted file is still an offender" — which is right on the working tree
       * and **RED on any committed tree**, because the only entry (`wtx_vocab.mjs`) is a
       * peer's UNTRACKED file. A guard that fails on `git worktree add --detach HEAD` fails
       * the one tree `CLAUDE.md` #1 says to verify. Found by running it there rather than by
       * reasoning about it, which is the whole argument for running it there.
       *
       * The failure it must still catch is a STALE exemption: an entry whose file is present
       * and no longer carries a copy, i.e. a permanent excuse for a problem that is gone.
       * "Absent" is a third state and is legitimate, so it is printed rather than folded into
       * either verdict — an entry cannot go quiet by disappearing.
       */
      const allowState = Object.keys(CENSUS_ALLOW).map((f) => {
        if (!existsSync(join(ROOT, f))) return `${f}=absent`;
        return c.offenders.some((o) => o.file === f) ? `${f}=matches` : `${f}=STALE`;
      });
      ok('G7 …and no allowlist entry is STALE (present, exempted, and no longer matching)',
        !allowState.some((s) => s.endsWith('=STALE')), allowState.join(' ') || 'allowlist empty');
    }

    console.log(`\n   ${pass} passed, ${fails.length} failed\n`);
    process.exit(fails.length ? 1 : 0);
  }

  if (argv.includes('--census') || argv.includes('--strict')) {
    const { scanned, offenders, closure } = censusRepo();
    console.log(`\ntf2_simstage census — ${scanned} tool files, closure ${closure.length}: ${closure.join(' ')}\n`);
    for (const o of offenders) {
      for (const h of o.hits) {
        console.log(`  ${o.allowed ? 'ALLOW' : '✗ COPY'}  ${o.file}:${h.line}  [${h.names.join(' ')}]`);
      }
      if (o.allowed) console.log(`         ↳ ${CENSUS_ALLOW[o.file]}`);
    }
    const bad = offenders.filter((o) => !o.allowed).length;
    console.log(`\n${bad} unallowed hand-written cop${bad === 1 ? 'y' : 'ies'} of the sim module list\n`);
    process.exit(argv.includes('--strict') && bad ? 1 : 0);
  }

  const i = argv.indexOf('--ref');
  const { modules, external } = i >= 0
    ? simClosure(readerForRef(argv[i + 1]))
    : simClosure(readerForTree());
  console.log(`sim closure (${i >= 0 ? argv[i + 1] : 'working tree'}): ${modules.length} modules`);
  for (const m of modules) console.log(`  ${SIM_DIR_REL}/${m}`);
  console.log(`external (staged by hand alongside): ${external.join(', ') || 'none'}`);
}
