#!/usr/bin/env node
/**
 * `dup_census.mjs` — a NORMALISED-FUNCTION-BODY duplication census across `src/`.
 *
 * ── WHY THIS EXISTS, AND WHAT IT IS NOT ────────────────────────────────────────
 * `sentinel.mjs`'s clone census is a WHOLE-FILE census over `tools/**.mjs`, with a
 * 300-line minimum and a 0.90 similarity floor. It is correct at its job and it
 * **structurally cannot** see function-level duplication in `src/`:
 *
 *   · it never reads `src/` at all;
 *   · it compares whole FILES, so a 60-line function copy-pasted into six 1,400-line
 *     character files moves whole-file similarity by almost nothing.
 *
 * MEASURED, on the real bytes at 25665f9 (arms `L1`–`L3` of `--selftest`, which import
 * sentinel's own `comparePair` rather than a local re-implementation, so the claim is
 * about the shipped instrument and not about a copy of it):
 *
 *     hamburger.ts :: burrito.ts        whole-file sim 0.0288   floor 0.90
 *     the HIGHEST of all 15 pairs       whole-file sim 0.0478   floor 0.90
 *     shortest of the six files                    1,191 lines  min  300
 *
 * **Thirty-one times below the floor while carrying a byte-identical 318-token
 * function**, and the size filter is not the reason — every file clears it four times
 * over. No threshold tuning reaches this. It needs a different unit of comparison,
 * which is what this file is.
 *
 * ⚠️ The brief that commissioned this quoted **0.0621** for the highest pair. Measured
 * here it is **0.0478**. Both are an order of magnitude under the floor and the
 * conclusion is unchanged, but the number in the brief is not reproducible and the one
 * above is: `--selftest` recomputes it from `git` on every run.
 *
 * ── 🚨 AND THE REPO'S ACCOUNT OF THE DEFECT IS OFF BY TWO ──────────────────────
 * `rig.ts:143` records that donut derived the cap fix and *"the fix never reached the
 * other five"*. **Measured on the bytes, at `76369eb`, three of the six moved:**
 *
 *     donut  egg  lollipop     7e1b00bbca37 / d8fa47404efc  ->  94a96cbb5540
 *     burrito  hamburger  taco               1de44ac6c8e4  ->  1de44ac6c8e4  (frozen)
 *
 * and the three that were frozen were **still frozen at `a0d0b7a`, eleven commits and
 * weeks later** — they are exactly the "rise" variant that rig.ts's own note calls
 * variant A. It was 3 of 6, not 1 of 6. That is not a softer finding, it is a worse
 * one: the commit that fixed half the family is what created the split. Asserted as
 * `K4`, so this correction cannot go stale silently the way the sentence it corrects
 * did. **The knowledge was written down, correct in outline and wrong in the count,
 * while the FUNCTION stayed duplicated. A comment cannot propagate a fix.**
 *
 * ── 🚨 THE BUG THIS FILE IS FORBIDDEN TO REPEAT ────────────────────────────────
 * `995417e` found that sentinel's census ran DISCOVERY before JUDGEMENT:
 *
 *     for every pair:  if (sim < 0.90) continue;   // discovery
 *     ...then look the pair up in the registry     // judgement
 *
 * so registration bought a pair a BUDGET but **not a SEAT** — and a similarity floor
 * used as a detection threshold means the guard stops looking precisely when the thing
 * it guards against has happened. Its coverage was a WINDOW: caught at +5 novel lines,
 * blind at +112, and the fix that exposed it added +190. **Coverage was inversely
 * proportional to the size of the defect.**
 *
 * So here, and asserted in `--selftest`:
 *
 *   · **REGISTRATION BUYS A SEAT.** Every registered family is measured on EVERY run —
 *     whatever its similarity, whatever its size, above or below any floor. A
 *     registered member whose normalised body has CHANGED is `MUTATED`, which is the
 *     loudest thing this file can say, because it is what "a fix reached one copy"
 *     looks like from the outside.
 *   · **Similarity and the size floor only ever ADD subjects.** That is the one job a
 *     threshold can honestly do. They can never remove one.
 *   · There is no `note`-and-exit-0 branch. That note WAS the bug.
 *
 * ── THE TWO AXES, AND WHY ONE IS NOT ENOUGH ────────────────────────────────────
 *   1. **EXACT** — normalised body hashes are equal. Finds copies even after renaming.
 *   2. **NAME** — the same function name in ≥2 files with ≥2 distinct bodies. This is
 *      the axis that sees a DIVERGED copy, and the exact axis is structurally blind to
 *      it. Asserted as arm `K5`, and it is worse than "the group shrinks": across the
 *      `76369eb` fix the exact axis reports **partition 3/2/1 -> 3/3, distinct bodies
 *      3 -> 2, members in groups 5 -> 6.** A falling count of distinct bodies IS what
 *      consolidation looks like. **Every summary an exact-only census produces moved in
 *      the direction that reads as PROGRESS, on the commit that created the defect.**
 *
 * ── NORMALISATION: WHAT IS COLLAPSED AND WHAT IS DELIBERATELY NOT ──────────────
 * Bodies are parsed (LESSONS §9 — *lint a language by parsing it*), not regexed, and
 * reduced to a token stream in which:
 *
 *   COLLAPSED   whitespace, formatting, ALL comments; and **locally-bound identifiers**
 *               are alpha-renamed to `$0, $1, …` in order of first appearance, so a
 *               rename cannot hide a copy.
 *   KEPT        every numeric and string literal; every FREE identifier; every property
 *               name after a `.`; operators; the parameter list and the return type.
 *
 * The second column is the important one and it is a deliberate narrowing.
 * `Math.min(rBot, len * 0.42)` and `Math.max(rBot, len * 0.43)` are three characters
 * apart and are **different shapes**. A census that collapses every identifier to one
 * token — the obvious implementation — reports them as the same function. Arms `N3`
 * and `N4` are mutants that require this file to REFUSE exactly that.
 *
 * ⚠️ **The price of the narrowing, stated:** two copies that differ only in an
 * IMPORT ALIAS (`import * as THREE` vs `import * as T`) hash differently and are
 * missed by the exact axis. They are still caught by the name axis. This is a known
 * hole, not an unknown one.
 *
 * ── FALSE POSITIVES: the `FLAT_MAX` lesson, taken seriously ────────────────────
 * `hc_occluders` narrowed its predicate to stay readable and grew a hole big enough to
 * hide a live defect. So both floors here are **stated, measured, and their shadows are
 * printed on every run**: `--rank` lists what `MIN_TOKENS` excluded, and lists every
 * name-family `NAME_SIM_MIN` refused *ranked by distance to the floor* — the `995417e`
 * artefact, because `limbcheck` sat twelve novel lines from silence and nobody knew the
 * margin existed.
 *
 * **Neither floor is set by taste. Both sit in a measured GAP in the data at a0d0b7a:**
 *
 *     MIN_TOKENS = 50     largest EXCLUDED group  47t (`ensureStyles ×3`)
 *                         smallest ADMITTED group 55t (`queryNumber ×2`)
 *     NAME_SIM_MIN = 0.55 highest REJECTED family 0.3370 (`trail ×8`)
 *                         lowest  ACCEPTED family 0.5753 (`namespaced ×2`)
 *
 * So anywhere in [48, 55] and anywhere in [0.34, 0.57] gives the identical report.
 * ⚠️ **60 did not.** The first draft used 60 and it hid `materialPool ×11` — an
 * eleven-copy helper — **by two tokens.** A floor picked by taste landed exactly on top
 * of a real finding, which is the `hc_occluders` hole in miniature, found by sweeping
 * the floor rather than by staring at it. Sweep it again before you move it.
 *
 * And neither floor **applies to a registered family** — registration buys a seat,
 * including a seat below both floors (arm `R1`).
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────────
 *     node tools/tmp/dup_census.mjs --rank            # the report, ranked, exit 0
 *     node tools/tmp/dup_census.mjs                   # gate: exit 1 on an unregistered
 *                                                     #   duplicate or a registry fault
 *     node tools/tmp/dup_census.mjs --tree 25665f9    # any commit-ish, read out of git
 *     node tools/tmp/dup_census.mjs --selftest        # CONTROL + KNOWN-BAD, real bytes
 *     node tools/tmp/dup_census.mjs --register        # paste-ready registry entries
 *
 * ⚠️ `--tree` exists because the cast migration is actively DELETING the duplication
 * this file measures. Quote a commit, never the working tree. `--selftest` reads
 * **only** from `git`, so a peer's half-saved character file cannot pass or fail it.
 *
 * ⚠️ **DO NOT PUT A LITERAL NUL IN THIS FILE.** The token separator below is written
 * as the six-character ESCAPE on purpose. An earlier draft carried the raw byte, it ran fine,
 * and `file`, `grep` and `git diff` all silently reclassified it as **binary data** —
 * `grep -n MIN_TOKENS` returned nothing at all, which reads exactly like "the constant
 * isn't there". `docs/LESSONS.md` §1 in a new costume: it WAS there and it was
 * invisible. The escape is byte-identical at runtime, so no hash moved.
 */

import ts from 'typescript';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// ── The narrowing, in one place ───────────────────────────────────────────────
/**
 * Minimum NORMALISED TOKEN count for the discovery axes. Tokens, not lines: a body
 * reformatted onto one line must not slip under a line floor, and comment volume must
 * not push a trivial body over one.
 *
 * 60 was chosen against the measured distribution rather than by taste — see
 * `--rank`'s `EXCLUDED BY THE FLOOR` block, which prints what this number hides on
 * every single run. `taperedSegment` is 350 tokens, so the known-bad clears it by 5.8x
 * and the floor is not doing any of the work in the arms that matter.
 */
const MIN_TOKENS = 50;

/**
 * Discovery floor for the NAME axis: `update()` exists in a dozen unrelated files, so
 * a bare name match is not evidence. Two same-named bodies are proposed as a family
 * only if some pair of them is at least this similar (Jaccard over normalised
 * token 5-grams).
 *
 * 🚨 **THIS IS A DISCOVERY FLOOR AND NOTHING ELSE.** It can only ADD a family. It is
 * never consulted for a REGISTERED family — that is the whole point of `995417e`.
 */
const NAME_SIM_MIN = 0.55;

const SHINGLE = 5;

// ── THE REGISTRY — the SUBJECT LIST, not a mute button ────────────────────────
/**
 * Every entry is measured on every run. `members` pins (file, name) and the normalised
 * body hash of each member **at the commit named in `pinnedAt`**.
 *
 * `kind`:
 *   'debt'      — these SHOULD be one function; the duplication is acknowledged, dated
 *                 debt. Losing a member is the FIX, so it reports `CONSOLIDATED` and
 *                 passes. A member whose body CHANGED is `MUTATED` and FAILS: that is
 *                 a fix reaching one copy, which is the exact `76369eb` event.
 *                 ⚠️ A rename does not buy silence here — the renamed body still hashes
 *                 the same, so the EXACT axis reports it as an unregistered duplicate.
 *                 Asserted as arm `K5`.
 *   'divergent' — these must NOT be unified; they are near-duplicates with different
 *                 semantics. The PARTITION (which members are body-identical to which)
 *                 is pinned. A member joining or leaving a class FAILS — that is a fix
 *                 reaching some copies and not others, in the family where unifying
 *                 them is the wrong move. A member DISAPPEARING fails `MISSING`,
 *                 because deleting one of these is a semantic decision.
 *   'accepted'  — genuinely intended, permanent duplication. Same rules as 'debt'
 *                 minus the debt language.
 */
const FAMILIES = [
  {
    key: 'taperedSegment',
    kind: 'debt',
    pinnedAt: 'a0d0b7a',
    why:
      'THE KNOWN-BAD OF THIS WHOLE FILE. Copy-pasted into six character files; at 76369eb '
      + 'donut fixed its own copy and the fix reached none of the other five. rig.ts now '
      + 'EXPORTS the union (proved vertex-identical to both variants by tools/tmp/rg_taper.mjs, '
      + '832 comparisons, worst |delta| exactly 0), so every copy below is retireable and a '
      + 'migration is in flight. Losing members is the FIX and reports CONSOLIDATED.',
    // rig.ts is the CANONICAL member, seated with the copies so the name axis does not
    // report the consolidation target as part of the problem. When the six go, `present`
    // falls to 1 and the family reports RESOLVED.
    members: [
      { file: 'src/characters/burrito.ts', name: 'taperedSegment', hash: '1de44ac6c8e4' },   // 318t  variant A "rise"
      { file: 'src/characters/donut.ts', name: 'taperedSegment', hash: '94a96cbb5540' },     // 318t  variant B "capFracs"
      { file: 'src/characters/egg.ts', name: 'taperedSegment', hash: '94a96cbb5540' },       // 318t  variant B
      { file: 'src/characters/hamburger.ts', name: 'taperedSegment', hash: '1de44ac6c8e4' }, // 318t  variant A
      { file: 'src/characters/lollipop.ts', name: 'taperedSegment', hash: '94a96cbb5540' },  // 318t  variant B
      { file: 'src/characters/rig.ts', name: 'taperedSegment', hash: '7a7160eb6fcb' },       // 364t  CANONICAL — the union
      { file: 'src/characters/taco.ts', name: 'taperedSegment', hash: '1de44ac6c8e4' },      // 318t  variant A
    ],
  },
  {
    key: 'taperedLimb',
    kind: 'divergent',
    pinnedAt: 'a0d0b7a',
    why:
      '🚨 DO NOT UNIFY THESE, AND DO NOT UNIFY THEM WITH `taperedSegment`. Four files carry '
      + 'a helper of this name that returns a Mesh. THREE OF THE FOUR set the bottom ring\'s '
      + 'radius to `capBot` rather than to `rBot`, so the authored bottom radius silently '
      + 'collapses to `len * 0.45` whenever that is smaller. `soup.ts` alone writes '
      + '`rBot * cos(a)` and keeps the authored radius. They are genuinely different shapes. '
      + 'The partition is pinned so that a fix reaching SOME of the three still fails — '
      + 'registration here mutes the "these differ" report, never the "they stopped '
      + 'differing in the same way" one. `pinBodies` is ON (the default for `divergent` is '
      + 'OFF) precisely because three of these four CARRY A LIVE BUG: editing one of them '
      + 'must be visible, and a partition check alone would miss a change that leaves a '
      + 'singleton a singleton.',
    pinBodies: true,
    members: [
      { file: 'src/characters/hotdog.ts', name: 'taperedLimb', hash: 'dcdd54e42ecf' },  // 277t  rBot -> capBot
      { file: 'src/characters/pizza.ts', name: 'taperedLimb', hash: 'dcdd54e42ecf' },   // 277t  rBot -> capBot, identical to hotdog
      { file: 'src/characters/soup.ts', name: 'taperedLimb', hash: 'fe222c321778' },    // 272t  KEEPS rBot — the correct one
      { file: 'src/characters/sushi.ts', name: 'taperedLimb', hash: '45fe437cb370' },   // 277t  rBot -> capBot
    ],
  },
];

// ── tree loading ──────────────────────────────────────────────────────────────

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
}

/** Every `.ts` under `dir` in the working tree. */
function walkWorktree(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walkWorktree(p, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * `rev` is `'worktree'` or any commit-ish. Returns `Map<path, text>`.
 *
 * ⚠️ A missing fixture THROWS. `995417e`'s corollary: a skipped arm turns every refusal
 * into a pass, which is the `driver_guard` 49 -> 41 shape.
 */
function loadTree(rev, sub = 'src') {
  const files = new Map();
  if (rev === 'worktree') {
    for (const p of walkWorktree(sub)) files.set(p, readFileSync(join(ROOT, p), 'utf8'));
  } else {
    const names = git(['ls-tree', '-r', '--name-only', rev, '--', sub])
      .split('\n').filter((p) => p.endsWith('.ts') && !p.endsWith('.d.ts'));
    if (!names.length) throw new Error(`loadTree: ${rev}:${sub} has no .ts files — fixture missing, refusing to skip`);
    // One `cat-file --batch` for the whole tree; 109 spawns is a second of nothing.
    const blob = execFileSync('git', ['cat-file', '--batch'], {
      cwd: ROOT, input: names.map((n) => `${rev}:${n}`).join('\n') + '\n',
      encoding: 'latin1', maxBuffer: 1 << 28,
    });
    let i = 0;
    for (const name of names) {
      const nl = blob.indexOf('\n', i);
      const header = blob.slice(i, nl).split(' ');
      const size = Number(header[2]);
      if (!Number.isFinite(size)) throw new Error(`loadTree: bad cat-file header for ${rev}:${name}: ${blob.slice(i, nl)}`);
      const raw = blob.slice(nl + 1, nl + 1 + size);
      files.set(name, Buffer.from(raw, 'latin1').toString('utf8'));
      i = nl + 1 + size + 1;
    }
  }
  if (!files.size) throw new Error(`loadTree: ${rev} produced no files`);
  return files;
}

// ── normalisation ─────────────────────────────────────────────────────────────

const FN_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction, ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor, ts.SyntaxKind.GetAccessor, ts.SyntaxKind.SetAccessor,
]);

function bindingNames(name, out) {
  if (!name) return;
  if (ts.isIdentifier(name)) { out.add(name.text); return; }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) if (ts.isBindingElement(el)) bindingNames(el.name, out);
  }
}

/** Names BOUND inside this function — the only ones an alpha-rename may touch. */
function localNames(fn) {
  const out = new Set();
  const visit = (n) => {
    if (ts.isParameter(n) || ts.isVariableDeclaration(n) || ts.isBindingElement(n)) bindingNames(n.name, out);
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) out.add(n.name.text);
    else if (ts.isTypeParameterDeclaration(n)) out.add(n.name.text);
    else if (ts.isCatchClause(n) && n.variableDeclaration) bindingNames(n.variableDeclaration.name, out);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  return out;
}

/**
 * An identifier in a PROPERTY position names a member, not a binding. Renaming those is
 * what turns `Math.min` into `Math.max` — the mutation arms `N3`/`N4` exist to refuse it.
 */
function isPropertyPosition(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === n) return true;
  if (ts.isQualifiedName(p) && p.right === n) return true;
  if (ts.isPropertyAssignment(p) && p.name === n) return true;
  if (ts.isBindingElement(p) && p.propertyName === n) return true;
  if (ts.isImportSpecifier(p) && p.propertyName === n) return true;
  if (ts.isExportSpecifier(p) && p.propertyName === n) return true;
  if ((ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isPropertyDeclaration(p)
    || ts.isPropertySignature(p) || ts.isEnumMember(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p))
    && p.name === n) return true;
  return false;
}

/** Byte offsets of identifiers that may be alpha-renamed. */
function renameSites(fn, sf, locals) {
  const sites = new Set();
  const visit = (n) => {
    if (ts.isIdentifier(n) && locals.has(n.text) && !isPropertyPosition(n)) sites.add(n.getStart(sf));
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(fn, visit);
  return sites;
}

/**
 * The normalised token stream for one function: from its parameter list (so a changed
 * SIGNATURE is a changed body — donut's fix changed both) through the end of its body.
 * Comments and whitespace are trivia and never reach the stream.
 */
function normaliseTokens(fn, sf) {
  const locals = localNames(fn);
  const sites = renameSites(fn, sf, locals);
  const start = (fn.typeParameters ?? fn.parameters)?.pos ?? fn.body.pos;
  const end = fn.body.end;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest, /* skipTrivia */ true, ts.LanguageVariant.Standard,
    sf.text, undefined, start, end - start,
  );
  const out = [];
  const alias = new Map();
  for (let guard = 0; guard < 400000; guard++) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    const pos = scanner.getTokenStart ? scanner.getTokenStart() : scanner.getTokenPos();
    const text = scanner.getTokenText();
    if (sites.has(pos)) {
      let a = alias.get(text);
      if (a === undefined) { a = `$${alias.size}`; alias.set(text, a); }
      out.push(a);
    } else {
      out.push(text);
    }
  }
  return out;
}

function nameOf(fn, sf) {
  if (fn.kind === ts.SyntaxKind.Constructor) return 'constructor';
  if (fn.name && (ts.isIdentifier(fn.name) || ts.isStringLiteral(fn.name))) return fn.name.text;
  const p = fn.parent;
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return p.name.text;
  if (p && ts.isPropertyDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isBinaryExpression(p) && ts.isPropertyAccessExpression(p.left)) return p.left.name.text;
  return `<anon@${sf.getLineAndCharacterOfPosition(fn.getStart(sf)).line + 1}>`;
}

function sha(s) { return createHash('sha1').update(s).digest('hex').slice(0, 12); }

/** Every function-like node with a body, including nested ones. */
function harvestFile(path, text) {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = [];
  const visit = (n) => {
    if (FN_KINDS.has(n.kind) && n.body) {
      let toks;
      try { toks = normaliseTokens(n, sf); } catch { toks = null; }
      if (toks && toks.length) {
        out.push({
          file: path,
          name: nameOf(n, sf),
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          tokens: toks.length,
          hash: sha(toks.join('\u0000')),
          shingles: shingleSet(toks),
        });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function shingleSet(toks) {
  const s = new Set();
  if (toks.length < SHINGLE) { s.add(sha(toks.join('\u0000'))); return s; }
  for (let i = 0; i + SHINGLE <= toks.length; i++) s.add(sha(toks.slice(i, i + SHINGLE).join('\u0000')));
  return s;
}

function jaccard(a, b) {
  let inter = 0;
  const [s, l] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of s) if (l.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 1;
}

function harvestTree(files) {
  const fns = [];
  for (const [p, text] of files) fns.push(...harvestFile(p, text));
  return fns;
}

// ── the census ────────────────────────────────────────────────────────────────

/**
 * ⚠️ ORDER MATTERS AND IT IS THE POINT. Registered families are seated FIRST, from the
 * registry, before any threshold is consulted. Discovery runs afterwards and may only
 * ADD. `995417e` inverted exactly this and that inversion was the bug.
 */
function census(fns, families = FAMILIES) {
  const byKey = new Map();          // `${file}::${name}` -> fn (first wins; ties are same-file overloads)
  for (const f of fns) {
    const k = `${f.file}::${f.name}`;
    if (!byKey.has(k)) byKey.set(k, f);
  }

  const findings = [];
  const seated = new Set();         // `${file}::${name}` already accounted for by a registration

  // ── 1. REGISTRATION BUYS A SEAT ─────────────────────────────────────────────
  for (const fam of families) {
    const present = [];
    const missing = [];
    const mutated = [];
    for (const m of fam.members) {
      const k = `${m.file}::${m.name}`;
      seated.add(k);
      const fn = byKey.get(k);
      if (!fn) { missing.push(m); continue; }
      present.push({ ...m, now: fn });
      if (fn.hash !== m.hash) mutated.push({ ...m, now: fn });
    }

    const faults = [];
    // `pinBodies` defaults ON. It is what makes a registration a SEAT rather than a mute:
    // the registered bodies are compared to the pin on every run, so a fix reaching ONE
    // copy fires. Turning it OFF is a deliberate narrowing for a family whose members are
    // SUPPOSED to be individually authored (11 per-character `onUpdate` hooks, say) — and
    // it costs exactly this: an edit to one member becomes invisible unless it changes the
    // PARTITION. Say so in `why` whenever you set it.
    const pinBodies = fam.pinBodies ?? (fam.kind !== 'divergent');
    if (pinBodies && mutated.length) {
      faults.push({
        kind: 'MUTATED',
        detail: `${mutated.length} of ${fam.members.length} registered bodies CHANGED since ${fam.pinnedAt} `
          + `while ${present.length - mutated.length} did not — this is what "a fix reached one copy" looks like`,
        members: mutated.map((m) => `${m.file}::${m.name} ${m.hash} -> ${m.now.hash}`),
      });
    }
    if (missing.length) {
      if (fam.kind === 'divergent') {
        faults.push({
          kind: 'MISSING',
          detail: `${missing.length} registered member(s) renamed or deleted from a family registered as `
            + `MUST-NOT-UNIFY — deleting one of these is a semantic decision and must look like one`,
          members: missing.map((m) => `${m.file}::${m.name}`),
        });
      }
      // 'debt'/'accepted': losing a member IS the fix. Reported, never failed.
      // A RENAME does not buy silence: the body still hashes the same, so the exact
      // axis below reports it as an UNREGISTERED DUPLICATE (arm K5).
    }
    if (fam.kind === 'divergent' && !missing.length) {
      const pinned = partitionKey(fam.members.map((m) => m.hash));
      const nowP = partitionKey(present.map((m) => m.now.hash));
      if (pinned !== nowP) {
        faults.push({
          kind: 'PARTITION-CHANGED',
          detail: `the equivalence classes moved: ${pinned} -> ${nowP}. These are near-duplicates that are `
            + `NOT safe to unify, so a member joining or leaving a class is a fix reaching some copies and `
            + `not others`,
          members: present.map((m) => `${m.file}::${m.name} ${m.now.hash}`),
        });
      }
    }

    findings.push({
      axis: 'registered',
      key: fam.key,
      kind: fam.kind,
      why: fam.why,
      pinnedAt: fam.pinnedAt,
      registered: fam.members.length,
      present: present.length,
      missing: missing.length,
      tokens: present.length ? Math.max(...present.map((m) => m.now.tokens)) : 0,
      members: present.map((m) => m.now),
      status: faults.length ? 'FAIL'
        : missing.length ? (present.length <= 1 ? 'RESOLVED' : 'CONSOLIDATED')
          : 'OK',
      faults,
    });
  }

  // ── 2. DISCOVERY — may only ADD ─────────────────────────────────────────────
  const byHash = new Map();
  for (const f of fns) {
    if (f.tokens < MIN_TOKENS) continue;
    if (!byHash.has(f.hash)) byHash.set(f.hash, []);
    byHash.get(f.hash).push(f);
  }
  const excludedByFloor = [];
  {
    const small = new Map();
    for (const f of fns) {
      if (f.tokens >= MIN_TOKENS) continue;
      if (!small.has(f.hash)) small.set(f.hash, []);
      small.get(f.hash).push(f);
    }
    for (const [h, ms] of small) if (ms.length > 1) excludedByFloor.push({ hash: h, members: ms });
    excludedByFloor.sort((a, b) => b.members.length * b.members[0].tokens - a.members.length * a.members[0].tokens);
  }

  for (const [h, members] of byHash) {
    if (members.length < 2) continue;
    const allSeated = members.every((m) => seated.has(`${m.file}::${m.name}`));
    if (allSeated) continue;                       // already judged, at full strength, above
    findings.push({
      axis: 'exact',
      key: `${members[0].name} ×${members.length} [${h.slice(0, 6)}]`,
      hash: h,
      tokens: members[0].tokens,
      members,
      status: 'FAIL',
      faults: [{
        kind: 'UNREGISTERED DUPLICATE',
        detail: `${members.length} functions share a byte-identical normalised body of ${members[0].tokens} tokens `
          + `across ${new Set(members.map((m) => m.file)).size} file(s)`,
        members: members.map((m) => `${m.file}:${m.line} ${m.name}`),
      }],
    });
  }

  // NAME axis: same name, ≥2 files, ≥2 distinct bodies, and plausibly copies.
  const rejectedByNameSim = [];
  const byName = new Map();
  for (const f of fns) {
    if (f.name.startsWith('<anon@')) continue;
    if (f.tokens < MIN_TOKENS) continue;
    if (!byName.has(f.name)) byName.set(f.name, []);
    byName.get(f.name).push(f);
  }
  for (const [name, all] of byName) {
    const uniq = [];
    const seen = new Set();
    for (const f of all) { const k = `${f.file}::${f.name}`; if (!seen.has(k)) { seen.add(k); uniq.push(f); } }
    if (new Set(uniq.map((f) => f.file)).size < 2) continue;
    if (new Set(uniq.map((f) => f.hash)).size < 2) continue;     // identical -> the exact axis owns it
    if (uniq.every((f) => seated.has(`${f.file}::${f.name}`))) continue;
    // ⚠️ Measured over pairs with DIFFERENT bodies only. Taking the max over all pairs
    // returns 1.0000 the moment any two members are identical, which says nothing about
    // whether the DIVERGENT ones are related — the question this axis is asking.
    let best = 0;
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        if (uniq[i].hash === uniq[j].hash) continue;
        best = Math.max(best, jaccard(uniq[i].shingles, uniq[j].shingles));
      }
    }
    if (best < NAME_SIM_MIN) { rejectedByNameSim.push({ name, n: uniq.length, sim: best, members: uniq }); continue; }
    findings.push({
      axis: 'name',
      key: `${name} ×${uniq.length}`,
      tokens: Math.max(...uniq.map((f) => f.tokens)),
      sim: +best.toFixed(4),
      members: uniq,
      status: 'FAIL',
      faults: [{
        kind: 'DIVERGED COPY',
        detail: `\`${name}\` exists in ${new Set(uniq.map((f) => f.file)).size} files with `
          + `${new Set(uniq.map((f) => f.hash)).size} distinct bodies (max pairwise sim ${best.toFixed(4)}) — `
          + `either a copy that a fix reached unevenly, or an intended divergence that needs registering`,
        members: uniq.map((m) => `${m.file}:${m.line} ${m.hash} ${m.tokens}t`),
      }],
    });
  }

  findings.sort((a, b) => rank(b) - rank(a));
  rejectedByNameSim.sort((a, b) => b.sim - a.sim);
  return { findings, excludedByFloor, rejectedByNameSim, total: fns.length };
}

function partitionKey(hashes) {
  const counts = new Map();
  for (const h of hashes) counts.set(h, (counts.get(h) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a).join('/');
}

/** Duplicated tokens: what you would delete by consolidating. */
function rank(f) { return (f.members.length - 1) * f.tokens; }

// ── reporting ─────────────────────────────────────────────────────────────────

function report(res, { rev, rankOnly }) {
  const fails = res.findings.filter((f) => f.status === 'FAIL');
  console.log(`\ndup_census @ ${rev} — ${res.total} function bodies parsed from src/\n`);
  console.log(`  floors: MIN_TOKENS=${MIN_TOKENS} (discovery only) · NAME_SIM_MIN=${NAME_SIM_MIN} (discovery only)`);
  console.log(`  registered families: ${FAMILIES.length} — each SEATED before any floor is consulted\n`);

  const hdr = 'axis        status        rank    n  tok  key';
  console.log(hdr);
  console.log('-'.repeat(hdr.length + 30));
  for (const f of res.findings) {
    if (rankOnly || f.status === 'FAIL' || f.axis === 'registered') {
      console.log(
        `${f.axis.padEnd(11)} ${f.status.padEnd(13)} ${String(rank(f)).padStart(5)} `
        + `${String(f.members.length).padStart(4)} ${String(f.tokens).padStart(4)}  ${f.key}`,
      );
    }
  }

  // A registered family that has been consolidated away must say so IN WORDS and name
  // the edit. `995417e`: retiring a registration is a decision and should look like one —
  // but for a `debt` family it is the SUCCESS path, so it is loud at exit 0, not exit 1.
  for (const f of res.findings) {
    if (f.axis !== 'registered') continue;
    if (f.status === 'CONSOLIDATED') {
      console.log(`\n  → REGISTERED ${f.key}: CONSOLIDATED ${f.registered} → ${f.present}. `
        + `${f.missing} copy(ies) are gone; the debt is shrinking, and this is the intended direction.`);
      console.log(`      Re-pin with:  node tools/tmp/dup_census.mjs --register --tree <the commit that landed it>`);
    } else if (f.status === 'RESOLVED') {
      console.log(`\n  ✅ REGISTERED ${f.key}: RESOLVED — ${f.registered} members registered, ${f.present} left.`);
      console.log(`      The duplication this family recorded is GONE. DELETE the '${f.key}' entry from FAMILIES;`);
      console.log(`      a registration nobody can violate is a comment with a tick next to it (LESSONS §13).`);
    }
  }

  for (const f of res.findings) {
    if (!f.faults.length) continue;
    console.log(`\n  ✗ ${f.axis.toUpperCase()} ${f.key}`);
    for (const flt of f.faults) {
      console.log(`      ${flt.kind}: ${flt.detail}`);
      for (const m of flt.members) console.log(`        · ${m}`);
    }
  }

  if (rankOnly) {
    for (const f of res.findings) {
      if (f.faults.length) continue;
      console.log(`\n  · ${f.axis.toUpperCase()} ${f.key} — ${f.status}`);
      for (const m of f.members) console.log(`      ${m.file}:${m.line} ${m.name} ${m.tokens}t ${m.hash}`);
    }
    console.log(`\n  ── EXCLUDED BY THE FLOOR (MIN_TOKENS=${MIN_TOKENS}) — what this census CANNOT see ──`);
    console.log(`  ${res.excludedByFloor.length} duplicate group(s) sit under the token floor.`);
    for (const g of res.excludedByFloor.slice(0, 8)) {
      console.log(`    ×${g.members.length}  ${String(g.members[0].tokens).padStart(3)}t  `
        + `${g.members[0].name}  (${g.members.map((m) => m.file.replace(/^src\//, '')).slice(0, 4).join(', ')}`
        + `${g.members.length > 4 ? ', …' : ''})`);
    }
    console.log(`  ⚠️ Raising MIN_TOKENS hides more of these; lowering it floods the report. The number is`);
    console.log(`     printed every run so the hole is VISIBLE rather than silent — the hc_occluders lesson.`);

    // The `995417e` artefact, for the OTHER floor: every rejected name-family ranked by
    // DISTANCE TO THE FLOOR. `limbcheck` sat twelve novel lines from silence and nobody
    // knew the margin existed. This block is that margin, printed.
    console.log(`\n  ── REJECTED BY NAME_SIM_MIN=${NAME_SIM_MIN}, RANKED BY DISTANCE TO THE FLOOR ──`);
    console.log(`  ${res.rejectedByNameSim.length} same-name multi-file family(ies) were proposed and refused.`);
    for (const r of res.rejectedByNameSim.slice(0, 8)) {
      console.log(`    sim ${r.sim.toFixed(4)}  margin ${(r.sim - NAME_SIM_MIN).toFixed(4)}  ×${r.n}  ${r.name}`
        + `  (${[...new Set(r.members.map((m) => m.file.replace(/^src\//, '')))].slice(0, 3).join(', ')})`);
    }
    console.log(`  ⚠️ The one at the top is the next false negative if the floor moves up, and the next`);
    console.log(`     false positive if it moves down. Registration is not affected by this number at all.`);
  }

  console.log(`\n  ${fails.length} FAIL, ${res.findings.length - fails.length} OK\n`);
  return fails.length;
}

// ── --register ────────────────────────────────────────────────────────────────

function registerDump(rev) {
  const fns = harvestTree(loadTree(rev));
  const out = [];
  for (const fam of FAMILIES) {
    const ms = fns.filter((f) => f.name === fam.key)
      .sort((a, b) => a.file.localeCompare(b.file));
    const seen = new Set();
    out.push(`  // ${fam.key} @ ${rev}`);
    for (const m of ms) {
      const k = `${m.file}::${m.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`      { file: '${m.file}', name: '${m.name}', hash: '${m.hash}' },   // ${m.tokens}t`);
    }
  }
  console.log(out.join('\n'));
}

// ── --selftest ────────────────────────────────────────────────────────────────
//
// CONTROL and KNOWN-BAD in one invocation, on the bytes that actually occurred.
//   25665f9  = 76369eb^   six copies of `taperedSegment`, donut's UNFIXED
//   76369eb              donut's copy FIXED — "the fix never reached the other five"
//
// ⚠️ Every arm names an implementation that would FAIL it. `LESSONS.md` §13: a guard can
// be tautological as well as blind, and the tautological one passes loudly forever.

const PRE = '25665f9';
const POST = '76369eb';
/** The commit the `taperedLimb` arms are measured at — never the working tree. */
const DIV = 'a0d0b7a';
const SIX = ['burrito', 'donut', 'egg', 'hamburger', 'lollipop', 'taco']
  .map((c) => `src/characters/${c}.ts`);

let pass = 0, fail = 0;
function t(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${label}${detail ? `   ${detail}` : ''}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? `   ${detail}` : ''}`); }
}

/** Pull one named function's body text out of a tree, or THROW. Never skip an arm. */
function fnIn(files, path, name) {
  const text = files.get(path);
  if (text === undefined) throw new Error(`selftest fixture missing: ${path}`);
  const hit = harvestFile(path, text).find((f) => f.name === name);
  if (!hit) throw new Error(`selftest fixture missing: ${name} in ${path}`);
  return hit;
}

function hashOfSource(src) {
  const f = harvestFile('mutant.ts', src);
  if (!f.length) throw new Error('mutation produced no function — fixture broken');
  return f[0].hash;
}

async function selftest() {
  console.log('\ndup_census --selftest — CONTROL and KNOWN-BAD on the bytes that occurred\n');

  const pre = loadTree(PRE, 'src/characters');
  const post = loadTree(POST, 'src/characters');

  // ── N. NORMALISATION: what it collapses, and what it must REFUSE to collapse ──
  console.log('  ── N: the normalisation itself, mutated against the real donut body ──');
  const donutPre = files_fn_source(pre, 'src/characters/donut.ts', 'taperedSegment');
  const baseHash = hashOfSource(donutPre);

  const renamed = donutPre
    .replace(/\blen\b/g, 'LENGTH').replace(/\brBot\b/g, 'bottomRadius')
    .replace(/\brTop\b/g, 'topRadius').replace(/\bpts\b/g, 'profile')
    .replace(/\bcapBot\b/g, 'cb').replace(/\bcapTop\b/g, 'ct');
  t('N1 a pure LOCAL RENAME hashes IDENTICAL — a rename cannot hide a copy',
    hashOfSource(renamed) === baseHash,
    `${baseHash} (a raw-text or line-hash census FAILS this)`);

  const reflowed = donutPre.replace(/\/\/[^\n]*/g, '').replace(/\n\s*/g, '\n ').replace(/  +/g, ' ');
  t('N2 comments and reformatting hash IDENTICAL',
    hashOfSource(reflowed) === baseHash,
    `${donutPre.split('\n').length} lines -> ${reflowed.split('\n').length}, same hash`);

  const minmax = donutPre.replace('Math.min(rBot', 'Math.max(rBot');
  t('N3 `Math.min` -> `Math.max` hashes DIFFERENT — property names are NOT collapsed',
    minmax !== donutPre && hashOfSource(minmax) !== baseHash,
    'the obvious "all identifiers -> one token" implementation FAILS this');

  // ⚠️ `len * 0.42`, not `0.42`. The first bare `0.42` in this body is inside a COMMENT,
  // and comments are trivia — mutating one produced an identical hash and failed this arm
  // on the first run. The arm was right; the mutation was not a mutation.
  const lit = donutPre.replace('len * 0.42', 'len * 0.43');
  t('N4 a LITERAL change 0.42 -> 0.43 hashes DIFFERENT — literals are NOT collapsed',
    lit !== donutPre && hashOfSource(lit) !== baseHash,
    'a census that normalised literals would call donut\'s two cap constants the same shape');

  t('N5 ...and N1 is not vacuous: the rename really changed the SOURCE',
    renamed !== donutPre && hashOfSource(donutPre) === baseHash,
    'so N1 is a claim about normalisation, not about a no-op edit');

  // ── L. THE LEGACY CENSUS, on the same real bytes — the negative control ───────
  console.log('\n  ── L: what sentinel\'s WHOLE-FILE census sees on this input ──');
  // ⚠️ THE REAL ARTICLE, IMPORTED — not a local re-implementation. A local copy would
  // make L1–L3 a claim about MY arithmetic rather than about the shipped census, and
  // `driver_guard` exists because copied drivers drift. The cost is that this arm dies
  // if a peer breaks `sentinel.mjs` mid-edit; it THROWS with that named, rather than
  // skipping, because a skipped arm turns every refusal into a pass.
  let comparePair;
  try { ({ comparePair } = await import('./sentinel.mjs')); } catch (e) {
    throw new Error(`L-arms cannot load tools/tmp/sentinel.mjs (a peer may be mid-edit): ${e.message}`);
  }
  if (typeof comparePair !== 'function') throw new Error('sentinel.mjs no longer exports comparePair — L-arms cannot run');
  const cHam = comparePair(pre.get('src/characters/hamburger.ts'), pre.get('src/characters/burrito.ts'));
  t('L1 hamburger.ts :: burrito.ts whole-file similarity is FIFTEEN TIMES below the 0.90 floor',
    cHam.sim < 0.09,
    `sim ${cHam.sim} — and both files carry a byte-identical taperedSegment`);
  let worst = 0, worstPair = '';
  for (let i = 0; i < SIX.length; i++) {
    for (let j = i + 1; j < SIX.length; j++) {
      const s = comparePair(pre.get(SIX[i]), pre.get(SIX[j])).sim;
      if (s > worst) { worst = s; worstPair = `${SIX[i]} :: ${SIX[j]}`; }
    }
  }
  t('L2 🚨 the HIGHEST whole-file similarity among all six is still far below 0.90 — no threshold reaches it',
    worst < 0.90,
    `max ${worst.toFixed(4)} (${worstPair.replace(/src\/characters\//g, '')})`);
  t('L3 ...and every one of the six files clears sentinel\'s 300-line minimum, so the SIZE filter is not the reason',
    SIX.every((f) => pre.get(f).split('\n').length >= 300),
    `min ${Math.min(...SIX.map((f) => pre.get(f).split('\n').length))} lines`);

  // ── K. THE KNOWN-BAD: `taperedSegment`, before and after donut's fix ──────────
  console.log('\n  ── K: the known-bad — six copies, and a fix that reached one of them ──');
  const preFns = harvestTree(pre);
  const postFns = harvestTree(post);
  const preTS = preFns.filter((f) => f.name === 'taperedSegment');
  const postTS = postFns.filter((f) => f.name === 'taperedSegment');

  t('K1 CONTROL 25665f9: the census finds SIX copies of `taperedSegment`, in six files',
    preTS.length === 6 && new Set(preTS.map((f) => f.file)).size === 6,
    `${preTS.map((f) => f.file.replace('src/characters/', '')).sort().join(' ')}`);

  const prePart = partitionKey(preTS.map((f) => f.hash));
  t('K2 ...and they are NOT all identical — the six had already diverged into 3 classes',
    prePart === '3/2/1',
    `partition ${prePart}: {burrito,hamburger,taco} {egg,lollipop} {donut} — asserted so K1 is not vacuous`);

  const preExact = census(preFns, []).findings.filter((f) => f.axis === 'exact' && f.key.startsWith('taperedSegment'));
  t('K3 the EXACT axis reports the 3-group and the 2-group at 25665f9',
    preExact.length === 2 && preExact.map((f) => f.members.length).sort().join(',') === '2,3',
    `groups of ${preExact.map((f) => f.members.length).sort().join(' and ')}`);

  const postPart = partitionKey(postTS.map((f) => f.hash));
  const postExact = census(postFns, []).findings.filter((f) => f.axis === 'exact' && f.key.startsWith('taperedSegment'));

  // ⚠️ THE REPO'S OWN WRITTEN ACCOUNT OF THIS DEFECT IS OFF BY TWO, AND THE BYTES SAY SO.
  // `rig.ts:143` records donut deriving the cap fix and *"the fix never reached the other
  // five"*. Measured here: at 76369eb **donut, egg AND lollipop** all moved to the same new
  // body, and **burrito, hamburger and taco** did not — and had still not, 11 commits later
  // at a0d0b7a. So it was 3 of 6, not 1 of 6, and the three left behind are exactly the
  // "rise" variant that rig.ts's own note calls variant A. The finding is not weakened by
  // this; it is worse. Three copies were frozen at the pre-fix shape by the very commit
  // that fixed the other three.
  const movers = SIX.filter((f) => preTS.find((x) => x.file === f).hash !== postTS.find((x) => x.file === f).hash)
    .map((f) => f.replace('src/characters/', '').replace('.ts', ''));
  const stayers = SIX.filter((f) => preTS.find((x) => x.file === f).hash === postTS.find((x) => x.file === f).hash)
    .map((f) => f.replace('src/characters/', '').replace('.ts', ''));
  t('K4 🚨 KNOWN-BAD 76369eb: the fix reached THREE of the six and froze the other three — '
    + 'and the repo\'s written account says "the fix never reached the other FIVE"',
    movers.join(',') === 'donut,egg,lollipop' && stayers.join(',') === 'burrito,hamburger,taco',
    `moved {${movers.join(' ')}}  ·  frozen {${stayers.join(' ')}}`);

  const preMembers = preExact.reduce((a, f) => a + f.members.length, 0);
  const postMembers = postExact.reduce((a, f) => a + f.members.length, 0);
  t('K5 🚨 ...and EVERY summary an exact-only census produces moved in the direction that reads as '
    + 'PROGRESS on the commit that created the defect',
    prePart === '3/2/1' && postPart === '3/3' && postMembers > preMembers && postExact.length === preExact.length,
    `partition ${prePart} -> ${postPart}; distinct bodies 3 -> 2; members in exact groups ${preMembers} -> ${postMembers}. `
    + `A shrinking set of distinct bodies IS what consolidation looks like — THIS IS WHY THE NAME AXIS `
    + `AND THE REGISTRY EXIST`);

  const donutPreH = preTS.find((f) => f.file.endsWith('donut.ts')).hash;
  const donutPostH = postTS.find((f) => f.file.endsWith('donut.ts')).hash;

  const famPre = {
    key: 'taperedSegment', kind: 'debt', pinnedAt: PRE, why: 'selftest',
    members: preTS.map((f) => ({ file: f.file, name: f.name, hash: f.hash })),
  };
  const rPre = census(preFns, [famPre]).findings.find((f) => f.axis === 'registered');
  t('K6 CONTROL: the registered family PASSES at the commit it was pinned at',
    rPre.status === 'OK' && rPre.present === 6, `${rPre.status}, 6/6 present`);

  const rPost = census(postFns, [famPre]).findings.find((f) => f.axis === 'registered');
  t('K7 🚨 KNOWN-BAD: the registered family FAILS `MUTATED` at 76369eb',
    rPost.status === 'FAIL' && rPost.faults.some((f) => f.kind === 'MUTATED'),
    `${rPost.faults.map((f) => f.kind).join(',')}`);
  const mut = rPost.faults.find((f) => f.kind === 'MUTATED');
  t('K8 ...and it names the THREE bodies that moved and, by omission, the three that did not — '
    + 'which is the whole content of the defect and is exactly what a discovery-only census cannot say',
    donutPreH !== donutPostH && mut.members.length === 3
    && ['donut', 'egg', 'lollipop'].every((c) => mut.members.some((m) => m.includes(`${c}.ts`)))
    && !['burrito', 'hamburger', 'taco'].some((c) => mut.members.some((m) => m.includes(`${c}.ts`))),
    `3/6 MUTATED: ${mut.members.map((m) => m.split('/').pop().split('.')[0]).join(' ')}`);

  // ── R. REGISTRATION BUYS A SEAT, NOT A BUDGET ───────────────────────────────
  console.log('\n  ── R: registration is a SEAT — the 995417e failure, refused ──');
  const tinyFam = {
    key: 'taperedSegment', kind: 'debt', pinnedAt: PRE, why: 'selftest',
    members: preTS.map((f) => ({ file: f.file, name: f.name, hash: f.hash })),
  };
  const shrunk = postFns.map((f) => (f.name === 'taperedSegment' ? { ...f, tokens: 3 } : f));
  const rShrunk = census(shrunk, [tinyFam]).findings.find((f) => f.axis === 'registered');
  t('R1 a registered body shrunk FAR under MIN_TOKENS is still judged — the discovery floor does not '
    + 'apply to a registration',
    rShrunk.status === 'FAIL' && rShrunk.faults.some((f) => f.kind === 'MUTATED'),
    `3 tokens vs MIN_TOKENS=${MIN_TOKENS}, still FAIL`);

  const renamedTree = new Map(post);
  renamedTree.set('src/characters/burrito.ts',
    post.get('src/characters/burrito.ts').replace(/taperedSegment/g, 'zzTaper'));
  const renFns = harvestTree(renamedTree);
  const rRen = census(renFns, [tinyFam]);
  const renReg = rRen.findings.find((f) => f.axis === 'registered');
  const renExact = rRen.findings.filter((f) => f.axis === 'exact'
    && f.members.some((m) => m.file.endsWith('burrito.ts') && m.name === 'zzTaper'));
  t('R2 a RENAME does not buy silence: the family loses a member, and the EXACT axis picks the body '
    + 'straight back up as an UNREGISTERED DUPLICATE',
    renReg.missing === 1 && renExact.length === 1 && renExact[0].members.length === 3,
    `family 6 -> ${renReg.present}, exact group of ${renExact[0]?.members.length} incl. burrito::zzTaper`);

  const deletedTree = new Map(post);
  for (const c of ['burrito', 'donut', 'egg', 'hamburger', 'lollipop', 'taco']) {
    deletedTree.set(`src/characters/${c}.ts`, stripFn(post.get(`src/characters/${c}.ts`), 'taperedSegment'));
  }
  const delRes = census(harvestTree(deletedTree), [tinyFam]);
  const delReg = delRes.findings.find((f) => f.axis === 'registered');
  const delAny = delRes.findings.filter((f) => f.key.startsWith('taperedSegment') && f.axis !== 'registered');
  t('R3 THE FIX MAKES THE FINDING GO AWAY: with all six copies consolidated out, the family reports '
    + 'RESOLVED and NOTHING is discovered',
    delReg.status === 'RESOLVED' && delAny.length === 0 && delReg.present === 0,
    `${delReg.status}, ${delAny.length} discovery findings — a census that said the same before and after `
    + `a real fix would be measuring nothing`);

  // ── D. THE DIVERGENT FAMILY — `taperedLimb`, which must NOT be unified ───────
  console.log('\n  ── D: `taperedLimb` — registration that mutes "they differ", never "they stopped differing" ──');
  // ⚠️ PINNED TO A COMMIT, NOT THE WORKING TREE. The cast migration is live in five
  // character files right now; a selftest that read `worktree` would pass or fail on a
  // peer's half-saved edit. This is the snapshot rule applied to a Node-only instrument.
  const wt = loadTree(DIV, 'src/characters');
  const tl = harvestTree(wt).filter((f) => f.name === 'taperedLimb');
  t('D1 `taperedLimb` is a DIFFERENT function living in 4 files, and the census finds it',
    tl.length === 4 && new Set(tl.map((f) => f.file)).size === 4,
    tl.map((f) => f.file.replace('src/characters/', '')).sort().join(' '));
  const tlPart = partitionKey(tl.map((f) => f.hash));
  t('D2 ...and they are NOT one shape: hotdog and pizza are byte-identical, sushi and soup are each their own',
    tlPart === '2/1/1', `partition ${tlPart} @ ${DIV} — soup.ts alone keeps the authored rBot`);

  const tlFam = {
    key: 'taperedLimb', kind: 'divergent', pinnedAt: DIV, why: 'selftest', pinBodies: true,
    members: tl.map((f) => ({ file: f.file, name: f.name, hash: f.hash })),
  };
  const dOk = census(harvestTree(wt), [tlFam]).findings.find((f) => f.axis === 'registered');
  t('D3 registered as `divergent`, the family PASSES while its partition holds',
    dOk.status === 'OK', `${dOk.status}, partition ${tlPart}`);

  // Make two of them identical — a "fix" reaching some copies and not others.
  const soupTxt = wt.get('src/characters/soup.ts');
  const sushiTxt = wt.get('src/characters/sushi.ts');
  const merged = new Map(wt);
  merged.set('src/characters/sushi.ts',
    replaceFn(sushiTxt, 'taperedLimb', extractFn(soupTxt, 'taperedLimb')));
  const dBad = census(harvestTree(merged), [tlFam]).findings.find((f) => f.axis === 'registered');
  t('D4 🚨 ...and FAILS the moment a "fix" reaches SOME of them: the partition moves and registration '
    + 'does NOT mute it',
    dBad.status === 'FAIL' && dBad.faults.some((f) => f.kind === 'PARTITION-CHANGED' || f.kind === 'MUTATED'),
    `${dBad.faults.map((f) => f.kind).join(',')} — a blanket allow-list would have passed this`);

  const dGone = new Map(wt);
  dGone.set('src/characters/soup.ts', stripFn(soupTxt, 'taperedLimb'));
  const dMiss = census(harvestTree(dGone), [tlFam]).findings.find((f) => f.axis === 'registered');
  t('D5 deleting one of a MUST-NOT-UNIFY family fails MISSING — unlike a `debt` family, where losing a '
    + 'member is the fix',
    dMiss.status === 'FAIL' && dMiss.faults.some((f) => f.kind === 'MISSING'),
    `${dMiss.faults.map((f) => f.kind).join(',')}`);

  // ── F. FIXTURES MUST THROW, NEVER SKIP ──────────────────────────────────────
  console.log('\n  ── F: a missing fixture THROWS rather than turning a refusal into a pass ──');
  let threw = false;
  try { loadTree('25665f9', 'src/does-not-exist'); } catch { threw = true; }
  t('F1 loadTree on a missing subtree THROWS', threw, 'a skipped arm turns every refusal into a pass');
  threw = false;
  try { fnIn(pre, 'src/characters/donut.ts', 'noSuchFunction'); } catch { threw = true; }
  t('F2 a missing named fixture THROWS', threw);

  // ⚠️ GATE CONTRACT — do not reformat this line. `gatecount` parses it, and it captures
  // the NUMERATOR deliberately: `SLASH_ASSERT`-style denominator capture would let a
  // failing `25/26` satisfy a documented 26, which is a failing guard reported as an
  // intact one. That exact trap is written up next to `hc_occluders` in gatecount.mjs.
  console.log(`\n  ${pass}/${pass + fail} selftest arms passed\n`);
  return fail;
}

/** The exact source text of a top-level `function <name>(...)` block, or throw. */
function extractFn(text, name) {
  const sf = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let hit = null;
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === name && n.body) hit = n;
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!hit) throw new Error(`extractFn: ${name} not found — fixture missing, refusing to skip`);
  return text.slice(hit.getStart(sf), hit.end);
}

function files_fn_source(files, path, name) {
  const text = files.get(path);
  if (text === undefined) throw new Error(`fixture missing: ${path}`);
  return extractFn(text, name);
}

function stripFn(text, name) {
  const body = extractFn(text, name);
  return text.replace(body, `/* ${name} consolidated away */`);
}

function replaceFn(text, name, replacement) {
  const body = extractFn(text, name);
  return text.replace(body, replacement);
}

// ── main ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const rev = arg('--tree', 'worktree');

if (argv.includes('--selftest')) {
  process.exit((await selftest()) ? 1 : 0);
} else if (argv.includes('--register')) {
  registerDump(rev);
} else {
  const res = census(harvestTree(loadTree(rev)));
  const fails = report(res, { rev, rankOnly: argv.includes('--rank') });
  process.exit(argv.includes('--rank') ? 0 : (fails ? 1 : 0));
}
