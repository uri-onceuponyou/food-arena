#!/usr/bin/env node
/**
 * CT_LIVECTL — how many known-bad CONTROLS in this repo are pointed at LIVE SOURCE?
 *
 *   node tools/tmp/ct_livectl.mjs             # the table
 *   node tools/tmp/ct_livectl.mjs --all       # every tool, including the clean ones
 *   node tools/tmp/ct_livectl.mjs --selftest  # the known-bad battery for THIS tool
 *
 * ── THE SHAPE, AND WHY IT IS WORTH A CENSUS ────────────────────────────────
 *
 * 🚨 **A CONTROL THAT CAN BE FIXED BY FIXING THE BUG IS NOT A CONTROL.**
 *
 * `tun_scrapes.mjs` validated its detector against `tools/tmp/sp_place.mjs` — a REAL file in
 * the tree that really did scrape `rules.ts`. That was the right instinct: a locator validated
 * only against a string it was handed proves it can read that string and nothing more. It was
 * also the wrong target, because the file's job in that test was TO BE BROKEN, and `fcf6da7`
 * un-broke it. The selftest went **4/4 → 2/4 with the detector still perfectly correct.**
 *
 * That failure is silent in the dangerous direction. A red row that means *"someone fixed the
 * bug"* is indistinguishable from one that means *"the detector broke"*, and the usual reading
 * of a red selftest is the second one — so the cost is an agent debugging an instrument that
 * was never wrong. In the mirror-image case (a control asserting a defect is ABSENT) the same
 * decay produces a GREEN row over an empty set, which is `CLAUDE.md` #6's vacuity class.
 *
 * ── WHAT THIS TOOL COUNTS ──────────────────────────────────────────────────
 *
 * Inside a tool's `--selftest` region, every path under `src/` or `tools/` that the region
 * READS or PATCHES, classified by where the bytes come from:
 *
 *   PIN      the region also runs `git show <sha>:<path>` — the bytes are immutable, so the
 *            control survives the fix. This is the shape to copy (`tf1_noscrape.mjs`).
 *   PATCH    the region rewrites a live `src/` file through a TEXT ANCHOR (a regex or a
 *            string). A distinct failure mode: when the anchor drifts the patch silently
 *            NO-OPS and the "known-bad" arm compares a tree against itself. `conceal_lab.mjs`
 *            guards this by asserting `applied[0]`; a patcher that does not is vacuous.
 *   LIVE     the region reads a live file with no pin — the expiring shape above.
 *
 * ⚠️ **THIS IS A LOCATOR, NOT A VERDICT.** LIVE is not automatically wrong: a NEGATIVE control
 * ("today's fixed file is clean") SHOULD point at live source, because there the decay direction
 * is a loud red. The table prints the line so a human can tell which direction it points in one
 * glance. Deliberately over-collecting, for the same reason `tun_scrapes` does: the entire
 * problem is that nobody knew the coupling existed.
 *
 * ⚠️ **AND IT ONLY EXAMINES TOOLS THAT HAVE A `--selftest`.** A tool with no self-validation at
 * all is a bigger problem than one whose control expired, and it is invisible here by
 * construction. The footer prints that count so the blind spot is stated rather than implied.
 */

import { readFileSync, readdirSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 🚨 THIS FILE EXPORTS `classify()`, AND WITHOUT THIS GUARD IMPORTING IT PRINTED THE WHOLE
 * CENSUS. Caught here by doing exactly that while triaging a row. `docs/AGENT-BRIEF.md` §3
 * records three tools that turned `import` into a full CLI run the same way — one of them
 * would have killed every snapshot server on the box. Guard the main path; keep the exports.
 */
const IS_MAIN = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));

/** Blank out comments, keeping line numbering intact. Prose ABOUT a control is not a control. */
function stripComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n');
}

/** Every `.mjs`/`.js` in `tools/` and `tools/tmp/`. */
function toolFiles() {
  const out = [];
  for (const dir of ['tools', 'tools/tmp']) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (/\.(mjs|js)$/.test(f)) out.push(join(dir, f));
  }
  return out.sort();
}

const SELFTEST_MARK = /--selftest|selftest\s*\(|knownBad|KNOWN_BAD/;
const PATH_RE = /['"`]((?:\.\.\/)*(?:src|tools)\/[A-Za-z0-9_./-]+\.(?:ts|mjs|js))['"`]/g;
/**
 * A line that obtains bytes from git rather than from disk.
 *
 * ⚠️ The first version was `/\bgit\b[^\n]*\bshow\b/` and it MISSED `sentinel.mjs`, which
 * wraps the call as `gitShow('9e1061c^', PERF)` — there is no word boundary inside `gitShow`.
 * The tool therefore reported the repo's most carefully pinned control as LIVE. A detector
 * that under-credits the CORRECT shape sends an agent to "fix" a control that is already right.
 */
const PIN_RE = /\bgit\b[^\n]*\bshow\b|\bgit_?show\s*\(|\bgitShow\s*\(/;

/** Helpers that stage a PATCHED copy of a sim module — the anchor-drift family. */
const PATCH_HELPER = /\b(?:patchedSimDir|patchSim|patchedSim|stagePatched|stageArm)\s*\(/;

/**
 * `['ai.ts', <anchor>, <replacement>]` — one edit triple, wherever it is declared.
 *
 * ⚠️ The second element must NOT itself be a module name, or this matches the hand-written
 * `['sim.ts', 'ai.ts', …]` MANIFESTS that `tf2_simstage.mjs` exists to police. That exact
 * confusion reported three module lists as known-bad anchors on an earlier run.
 */
const EDIT_TRIPLE = /\[\s*['"`](?:rules|sim|ai|combat|movement|state)\.ts['"`]\s*,\s*(?!['"`][\w.]+\.ts['"`])(?:\/|['"`])/;

/**
 * The words that mark a line as part of a CONTROL rather than part of the measurement.
 *
 * 🚨 **THESE ARE MATCHED IN COMMENTS AS WELL AS CODE, AND THAT IS DELIBERATE.** In this repo
 * the marker is almost always a comment directly above the control — `conceal_lab.mjs`'s
 * known-bad is three lines of prose followed by a bare `patchedSimDir(...)` call that says
 * nothing about being a control. Requiring the marker in code would miss it entirely.
 */
const CONTROL_MARK = /known[- _]?bad|selftest|self-test|\bcontrol\b|sabotage|planted?\b|mutat|fixture|vacuous/i;
const MARK_BEFORE = 8;   // a marker this far above a line still governs it
const MARK_AFTER = 3;

/**
 * Classify one tool.
 *
 * ⚠️ **THE FIRST VERSION OF THIS FUNCTION SCANNED A "SELFTEST REGION" — FROM THE FIRST CODE
 * LINE MENTIONING `--selftest` TO EOF — AND IT WAS POINTED AT NOTHING.** In `conceal_lab.mjs`
 * the earliest such line is the ARGUMENT-USAGE STRING at :1902, six lines from the end, so the
 * region excluded the file's entire known-bad battery and the tool reported **0 PATCH hits
 * across 613 tools** while printing a confident table. That is `CLAUDE.md` #6 exactly — a
 * selftest validates a tool's LOGIC and never validates where the tool is POINTED — and it was
 * caught by re-deriving a number that looked plausible, not by any assertion here.
 *
 * So: scan the WHOLE file, and require a hit to sit near a CONTROL_MARK. Over-collects by
 * design; every row prints its line so a false positive costs one glance.
 */
export function classify(rel, text) {
  const raw = text.split('\n');                 // markers may live in comments
  const code = stripComments(text).split('\n'); // hits may not
  const hasSelftest = code.some((l) => SELFTEST_MARK.test(l));
  const pinned = code.some((l) => PIN_RE.test(l));

  const marked = (i) => {
    for (let j = Math.max(0, i - MARK_BEFORE); j <= Math.min(raw.length - 1, i + MARK_AFTER); j++) {
      if (CONTROL_MARK.test(raw[j])) return true;
    }
    return false;
  };

  // A path literal bound to a const that a `git show` line later interpolates IS pinned —
  // `const KNOWN_BAD_PATH = '…'; git show `${SHA}:${KNOWN_BAD_PATH}`` is the idiom this repo
  // uses, and reading it as LIVE would report the FIXED shape as the broken one.
  const pinnedPaths = new Set();
  {
    const binds = new Map();
    for (const l of code) {
      const b = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*['"`]((?:\.\.\/)*(?:src|tools)\/[^'"`]+)['"`]/.exec(l);
      if (b) binds.set(b[1], b[2]);
    }
    for (const l of code) {
      if (!PIN_RE.test(l)) continue;
      for (const [name, path] of binds) if (new RegExp(`\\b${name}\\b`).test(l)) pinnedPaths.add(path);
    }
  }

  const hits = [];
  const seen = new Set();
  code.forEach((line, i) => {
    if (!marked(i)) return;
    // A dependency is not a control. `import('…/rules.ts')` and `from '…'` are how a tool
    // LOADS the sim; only a TEXT read or a TEXT patch can be a known-bad INPUT.
    if (/\bimport\s*\(|\bfrom\s+['"]/.test(line)) return;
    const isRead = /read(?:File|FileSync)\s*\(/.test(line) || PIN_RE.test(line);
    // A PATCH anchor: a regex literal on a line that also names a sim module — by bare
    // filename too, because `patchedSimDir` stages modules as `'rules.ts'`.
    // Two shapes. The regex-plus-module-name form alone found ONE of the six tools that call
    // the helper, because the `[module, anchor, replacement]` array is routinely split across
    // lines — so the CALL SITE counts too.
    // ⚠️ A third shape, "a bare `['sim.ts', …]` array", was tried and REMOVED: it matched the
    // hand-written SIM_MODULES lists that `tf2_simstage.mjs` exists to police, reporting three
    // module manifests as known-bad anchors. Over-collection is cheap; a class that is mostly
    // false positives is a table nobody reads twice.
    const isPatch = PATCH_HELPER.test(line)
      || EDIT_TRIPLE.test(line)
      || (/\/[^/\s][^\n]*\/[gimsuy]*\s*,/.test(line) && /\b(rules|sim|ai|combat|movement|state)\.ts\b/.test(line));
    const isBind = /(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*['"`](?:\.\.\/)*(?:src|tools)\//.test(line);
    if (!isRead && !isPatch && !isBind) return;

    let any = false;
    for (const m of line.matchAll(PATH_RE)) {
      const path = m[1].replace(/^(\.\.\/)+/, '');
      if (path === rel) continue;                     // a tool naming ITSELF is not a control
      const key = `${path}|${i + 1}`;
      if (seen.has(key)) continue;
      seen.add(key); any = true;
      const kind = (PIN_RE.test(line) || pinnedPaths.has(m[1])) ? 'PIN' : (isPatch ? 'PATCH' : 'LIVE');
      hits.push({ path, line: i + 1, kind, text: line.trim().slice(0, 110) });
    }
    if (isPatch && !any) {
      const mod = /\b((?:rules|sim|ai|combat|movement|state)\.ts)\b/.exec(line);
      const key = `anchor|${i + 1}`;
      if (!seen.has(key)) { seen.add(key); hits.push({ path: `${mod ? mod[1] : '(anchor)'} [text anchor]`, line: i + 1, kind: 'PATCH', text: line.trim().slice(0, 110) }); }
    }
  });
  return { rel, hasSelftest, pinned, hits };
}

// ═════════════════════════════════════════════════════════════════════════════
// --selftest — MOVES / HOLDS on ONE FILE, out of git
// ═════════════════════════════════════════════════════════════════════════════
if (IS_MAIN && args.has('--selftest')) {
  let pass = 0; let fail = 0;
  const ok = (n, c, d = '') => { if (c) { pass++; console.log(`   PASS  ${n}${d ? `  ${d}` : ''}`); } else { fail++; console.log(`   FAIL  ${n}${d ? `  ${d}` : ''}`); } };
  console.log('\n══ ct_livectl SELFTEST ══\n');

  // The known-bad and the fix are THE SAME FILE at two commits, which is the only pair that
  // proves the classifier discriminates rather than that it likes one file and dislikes another.
  //   5f53bcc — tun_scrapes as shipped, control pointed at live `sp_place.mjs`
  //   HEAD    — the same file, control re-pointed at a pinned blob
  const BAD_SHA = '5f53bcc';
  let bad = null;
  try { bad = execFileSync('git', ['show', `${BAD_SHA}:tools/tmp/tun_scrapes.mjs`], { cwd: ROOT, encoding: 'utf8' }); } catch { bad = null; }
  ok(`the known-bad bytes are readable (${BAD_SHA}:tools/tmp/tun_scrapes.mjs)`,
    typeof bad === 'string' && bad.length > 0,
    bad ? `${bad.split('\n').length} lines` : 'git show FAILED — every arm below is VACUOUS');

  const cBad = bad ? classify('tools/tmp/tun_scrapes.mjs', bad) : { hits: [] };
  ok('KNOWN-BAD: the pre-fix tun_scrapes control is classified LIVE',
    cBad.hits.some((h) => h.kind === 'LIVE' && h.path === 'tools/tmp/sp_place.mjs'),
    cBad.hits.map((h) => `${h.kind}:${h.path}`).join(' ') || 'nothing found');

  const cNow = classify('tools/tmp/tun_scrapes.mjs', readFileSync(join(ROOT, 'tools/tmp/tun_scrapes.mjs'), 'utf8'));
  ok('MOVES: the SAME FILE today, same control re-pointed at a git blob, is classified PIN',
    cNow.hits.some((h) => h.kind === 'PIN' && h.path === 'tools/tmp/sp_place.mjs')
    && !cNow.hits.some((h) => h.kind === 'LIVE' && h.path === 'tools/tmp/sp_place.mjs'),
    cNow.hits.map((h) => `${h.kind}:${h.path}`).join(' ') || 'nothing found');

  // NON-EMPTY FIRST: `[].every()` is true, so the row above would pass over an empty hit list.
  ok('…and that ran over a NON-EMPTY hit list', cNow.hits.length > 0, `${cNow.hits.length} hits`);

  // A tool with no selftest at all must not be silently counted as clean.
  const none = classify('x.mjs', 'const a = 1;\nconsole.log(a);\n');
  ok('a tool with NO --selftest flag is reported as such (and is still scanned for hits)',
    none.hasSelftest === false);

  // ── THE PATCH CLASS, WHICH THIS TOOL ONCE REPORTED AS ZERO ACROSS 613 FILES ──────────────
  // A whole class reading 0 is indistinguishable from a clean repo, and that is how it read
  // for two runs. Synthetic first (does the detector recognise the shape at all), then the
  // corpus (is the class non-empty in reality) — the second is what makes the first meaningful.
  // ⚠️ The fixture names a constant that DOES NOT EXIST in `rules.ts`. An earlier draft used
  // the real `AI_CHASE_SPEED` and this file then appeared in `tun_scrapes.mjs`'s collision
  // table as a tool scraping a tuned constant — a false row in someone else's report, planted
  // by a fixture. A synthetic control should not be findable by a real locator.
  const synth = classify('x.mjs', [
    '// KNOWN-BAD: the anchored edit, held',
    "const { dir } = patchedSimDir('selftest-bad', [",
    "  ['rules.ts', /export const SYNTH_ONLY_FIXTURE = 0\\.07/, 'export const SYNTH_ONLY_FIXTURE = 0.08'],",
    ']);',
  ].join('\n'));
  ok('the PATCH shape (a text anchor into a staged sim module) is recognised',
    synth.hits.some((h) => h.kind === 'PATCH'), synth.hits.map((h) => h.kind).join(' ') || 'none');

  const corpusPatch = toolFiles().filter((rel) => {
    try { return classify(rel, readFileSync(join(ROOT, rel), 'utf8')).hits.some((h) => h.kind === 'PATCH'); }
    catch { return false; }
  });
  ok('…and the class is NON-EMPTY in this repo, so a 0 in the table would be news',
    corpusPatch.length > 0, `${corpusPatch.length} tools: ${corpusPatch.map((r) => r.split('/').pop()).join(' ')}`);

  // NEGATIVE CONTROL for the PATCH class. Without it the detector could flag every array that
  // mentions a sim module and still pass the row above — which is what it did.
  // ⚠️ DERIVED, not typed out. `tun_scrapes.mjs`'s FAMILY 2 flags a hand-written copy of this
  // exact array as a defect — correctly — so writing the fixture as a literal put a FALSE RED
  // in that tool's table under the fix "add the tuning modules". Deriving it keeps the fixture
  // honest in both directions: it is still a manifest, and it is not a second copy.
  const MODS = 'sim ai movement combat state rules'.split(' ').map((m) => `'${m}.ts'`).join(', ');
  const manifest = classify('x.mjs', [
    '// the known-bad module manifest',
    `const HAND = [${MODS}];`,
  ].join('\n'));
  ok('NEGATIVE CONTROL: a hand-written MODULE MANIFEST is not a patch anchor',
    !manifest.hits.some((h) => h.kind === 'PATCH'), manifest.hits.map((h) => h.kind).join(' ') || 'no hits');

  // …and a real edit triple declared away from any helper call still is.
  const triple = classify('x.mjs', [
    '// KNOWN-BAD: the self-pair arm',
    "  'self-pair': [['ai.ts', ' * Enemy AI controller.', ' *  Enemy AI controller.']],",
  ].join('\n'));
  ok('an EDIT TRIPLE declared away from its helper is still a patch anchor',
    triple.hits.some((h) => h.kind === 'PATCH'), triple.hits.map((h) => h.kind).join(' ') || 'no hits');

  // The pin detector must credit BOTH spellings, or it reports a correct control as broken.
  const wrapped = classify('x.mjs', [
    '// KNOWN-BAD, on the real bytes',
    "const PERF = 'tools/perf.mjs';",
    "const before = gitShow('9e1061c^', PERF);",
  ].join('\n'));
  ok('a `gitShow(...)` wrapper counts as a PIN, not as a LIVE read',
    wrapped.hits.every((h) => h.kind === 'PIN') && wrapped.hits.length > 0,
    wrapped.hits.map((h) => `${h.kind}:${h.path}`).join(' ') || 'no hits');

  // The corpus itself must be non-empty, or the table below means nothing.
  ok('NON-EMPTY corpus', toolFiles().length > 0, `${toolFiles().length} tools`);

  console.log(`\n   ${pass}/${pass + fail} assertions passed\n`);
  process.exit(fail ? 1 : 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// the census
// ═════════════════════════════════════════════════════════════════════════════
if (!IS_MAIN) { /* imported for `classify` — run nothing */ } else {
const files = toolFiles();
const results = [];
for (const rel of files) {
  let text; try { text = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; }
  results.push(classify(rel, text));
}

// ⚠️ COUNTED OVER EVERY TOOL, NOT ONLY THOSE WITH A `--selftest`. An earlier draft filtered
// to `hasSelftest` first and dropped `rg2_mutants.mjs` — the §29 known-bad battery, a file
// that is ENTIRELY a control and never needed a `--selftest` flag to be one. Filtering a set
// before asserting over it is this repo's most-repeated instrument bug (`CLAUDE.md` #6).
const withSelftest = results.filter((r) => r.hasSelftest);
const live = results.filter((r) => r.hits.some((h) => h.kind === 'LIVE'));
const patch = results.filter((r) => r.hits.some((h) => h.kind === 'PATCH'));
const pin = results.filter((r) => r.pinned);

console.log('\n══ CT_LIVECTL ══  controls pointed at LIVE SOURCE rather than a pinned blob\n');
console.log(`   tools scanned                     ${results.length}`);
console.log(`   …carrying a --selftest arm        ${withSelftest.length}   (informational — hits are counted on ALL ${results.length})`);
console.log(`   tools naming a PINNED blob        ${pin.length}`);
console.log(`   tools READING live source near a control   ${live.length}`);
console.log(`   tools PATCHING live source (anchor drift)  ${patch.length}\n`);

const show = args.has('--all') ? results : [...new Set([...live, ...patch])];
for (const r of show.sort((a, b) => a.rel.localeCompare(b.rel))) {
  if (!r.hits.length) continue;
  console.log(`   ${r.rel}${r.pinned ? '   [has a git-show pin]' : ''}`);
  for (const h of r.hits) console.log(`     ${h.kind.padEnd(5)} :${String(h.line).padEnd(5)} ${h.path}`);
  console.log('');
}

console.log('   Locator, not a verdict — LIVE is correct for a NEGATIVE control and wrong for a');
console.log('   POSITIVE one. Read the direction off the line before acting on a row.\n');
}
