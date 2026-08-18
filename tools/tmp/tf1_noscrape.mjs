#!/usr/bin/env node
/**
 * TF1_NOSCRAPE — the Family-1 gate: no measurement tool may read `src/game/**` as TEXT,
 * and every one of them must TRACK the sim when a `tune()` override moves a constant.
 *
 *   node tools/tmp/tf1_noscrape.mjs             # the gate. exit 1 on any fault
 *   node tools/tmp/tf1_noscrape.mjs --selftest  # the known-bad battery. OFFLINE
 *   node tools/tmp/tf1_noscrape.mjs --static    # §A only, ~0.1 s (no child processes)
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT `tun_scrapes.mjs` ────────────────────
 *
 * `tun_scrapes.mjs` is a LOCATOR and says so in its own header: it finds tools that regex
 * `rules.ts`, prints them, and exits 0. It answered the question "who is affected by §76?"
 * — the right question on the day it was written. It cannot answer "is this still true
 * tomorrow", for three reasons that are all structural rather than sloppy:
 *
 *   1. **It only reports keys the registry KNOWS.** `authoredEntries()` has 18 scalars, so a
 *      scrape of `POT.dangerRadius`, `REACH.meleeHeavy`, `HIT_RADIUS_VS_PLAYER`, `PLAYER_SIZE`
 *      or `MAX_FIGHTERS` is invisible to it — every one of which existed in this family and
 *      every one of which is a `tune()` wrapper away from breaking exactly as the others did.
 *   2. **It cannot see TRANSITIVE breakage.** `kx_seatfair.mjs` and `kx_fogcover.mjs` scrape
 *      nothing at all. Both were dead at `c5b9754` anyway, because they import `sp_place.mjs`,
 *      whose scrape threw at module load. A locator that greps for regexes finds neither.
 *   3. **A regex that still matches is not a regex that is RIGHT.** See §C.
 *
 * So this gate asserts the PROPERTY (§A: nothing reads game source as text; §B: everything
 * still runs; §C: everything tracks an override) rather than enumerating the symptom.
 * `tun_scrapes --strict` remains the right cross-family locator and should be wired into the
 * battery by whoever finishes Family 2 — the two are complements, not duplicates.
 *
 * ── THE FAILURE THIS GATE IS BUILT FROM ─────────────────────────────────────
 *
 * §76 turned `export const MIN_SAFE_RADIUS = 140;` into
 * `export const MIN_SAFE_RADIUS = tune('MIN_SAFE_RADIUS', 140, {…})`. Ten regexes stopped
 * matching and four tools died at import. That is the LOUD half and it cost an afternoon.
 *
 * 🔴 **THE QUIET HALF IS THE ONE THIS GATE EXISTS FOR.** §76 also documented itself, in
 * `rules.ts`'s own header, and line 34 of that header reads — as PROSE, inside a doc block:
 *
 *     * So nothing moved. `export const PLAYER_SPEED = 0.12` became
 *
 * `sp_place.mjs`'s `/export const PLAYER_SPEED = ([\d.]+)/` is unanchored, so it matched
 * **the anecdote on line 34, not the declaration on line 633**, returned `0.12`, and was
 * RIGHT — because the anecdote quotes the pre-§76 value. Under any override it would have
 * gone on reporting the number a comment remembers while the sim ran on the tuned one, with
 * every assertion green. `MIN_RUNWAY_WU = PLAYER_SPEED * 500` hung off that sentence.
 *
 * **That is why §C exists and why §A is not enough.** A scrape that still matches is
 * indistinguishable from a correct import by inspection; it is distinguishable by MOVING a
 * constant and watching whether the tool follows.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));

/**
 * 🚨 THE MAIN PATH IS GUARDED BECAUSE THIS FILE EXPORTS `textReads`/`faults`.
 * `docs/AGENT-BRIEF.md` §3: three tools here made a function importable — the right instinct,
 * so a second tool reuses a validated detector instead of copying it — and thereby made the
 * whole CLI run on import. One of them printed a live `snapsweep` report and would have
 * killed every snapshot server on the box. This one spawns 17 child processes.
 */
const IS_MAIN = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

/**
 * The Family-1 file set — the tools that read `rules.ts` as text before 2026-08-18.
 *
 * `mode` is the cheapest invocation that exercises module load AND at least one assertion.
 * `moves` is an override that MUST change the tool's stdout; `null` means the tool consumes
 * no tunable constant, which is a claim §C checks rather than takes on trust.
 */
const FAMILY = [
  { file: 'tools/tmp/sp_place.mjs', mode: ['--selftest'], moves: { PLAYER_SPEED: 0.24 } },
  { file: 'tools/tmp/sp_gate.mjs', mode: ['--selftest'], moves: { PLAYER_SPEED: 0.24 } },
  { file: 'tools/tmp/x4_layout.mjs', mode: [], moves: { MIN_SAFE_RADIUS: 200 } },
  { file: 'tools/tmp/ap_reach.mjs', mode: ['--selftest'], moves: { MIN_SAFE_RADIUS: 600 } },
  { file: 'tools/tmp/kx_seatfair.mjs', mode: ['--graph'], moves: { MIN_SAFE_RADIUS: 600 } },
  // ⚠️ NOT AN OVERSIGHT AND NOT A VACUOUS ROW. `kx_fogcover.mjs` takes exactly two things
  // from `rules.ts`, both through `sp_place.mjs`: `PLAYER_SIZE` and the `blocked()` predicate
  // built on it. `PLAYER_SIZE` carries no `tune()` entry, so there is no override that can
  // move this tool, and asserting one would be asserting a tautology. §C checks the CLAIM —
  // that `PLAYER_SIZE` really is absent from the registry — and then checks HOLDS only.
  { file: 'tools/tmp/kx_fogcover.mjs', mode: ['--selftest'], moves: null, untunedBecause: 'PLAYER_SIZE' },
];

/**
 * Reads of `src/**` source TEXT that are CORRECT and must not be flagged.
 *
 * `src/arena/**` and `src/render/**` are written with EXTENSIONLESS imports (`from
 * '../render/toon'`), which Vite resolves and Node does not — so `await import()` on them
 * throws `ERR_MODULE_NOT_FOUND` and reading the source is the only mechanism available.
 * §A2 PROVES that rather than believing this comment: it tries the import and requires it
 * to fail. The day `src/arena/**` gains explicit extensions, this allowance goes red and
 * these reads become scrapes like any other.
 *
 * ⚠️ And `kx_fogcover.mjs`'s read of `fogRing.ts` is not a fallback but the STRONGER tool:
 * §D there asks whether `FIELD_OUTER_UNITS`'s right-hand side is a DERIVATION or a literal,
 * and re-evaluates that expression at a different map size. No import can answer that — an
 * import returns the number and throws the expression away.
 */
const ALLOWED_TEXT_PREFIX = ['src/arena/', 'src/render/'];

/**
 * Every name exported by a flat `src/game/*.ts` module — DERIVED, not listed.
 *
 * D2 below flags a regex over `export const <NAME>`, and it has no way to know which file
 * that regex is pointed at. This set is the attribution: `ARENA_W` belongs to
 * `src/arena/shared.ts` and is allowed; `MIN_SAFE_RADIUS` and `MAX_FIGHTERS` belong to
 * `src/game/**` and are not. Typing the list instead of deriving it would be the second copy
 * this whole pass is about.
 *
 * Non-recursive on purpose: `src/game/` being FLAT is a load-bearing invariant of this repo
 * (`tuningRegistry.ts`'s header — seven staging tools copy the directory with a single
 * non-recursive `readdirSync`), so a nested module would be a defect elsewhere first.
 */
const GAME_EXPORTS = (() => {
  const names = new Set();
  for (const f of readdirSync(join(ROOT, 'src/game'))) {
    if (!f.endsWith('.ts')) continue;
    for (const m of readFileSync(join(ROOT, 'src/game', f), 'utf8')
      .matchAll(/^export (?:const|function|let|class|enum) ([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  }
  return names;
})();

/**
 * The commit whose bytes are the known-bad. `eb3e44d` is the last commit BEFORE this pass,
 * so `git show eb3e44d:tools/tmp/sp_place.mjs` is the real, shipped, broken file — not a
 * fixture written to pass. Pinned rather than `HEAD~1` on purpose: a pin cannot drift under
 * a later commit, and `CLAUDE.md` #6 is emphatic that a known-bad must be shown to FAIL.
 */
const KNOWN_BAD_SHA = 'eb3e44d';

// ═════════════════════════════════════════════════════════════════════════════
// THE DETECTOR
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Blank out comments, keeping line numbers intact.
 *
 * 🚨 Without this the gate reports its own documentation — `tun_scrapes.mjs` shipped a first
 * draft that flagged its own header and caught it on a negative control. Every file in this
 * family now carries a block comment QUOTING the regex it deleted, deliberately, so that the
 * next reader can see what went wrong. Those quotes must not be findings.
 */
function stripComments(text) {
  const noBlocks = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.split('\n').map((line) => (/^\s*(\/\/|\*)/.test(line) ? '' : line)).join('\n');
}

/**
 * Every line of `text` that obtains a `src/**` module as a STRING.
 *
 * Two independent detectors, because they fail differently:
 *   D1 — a `readFileSync`/`readFile` whose argument names a `src/…` path. This is how all
 *        ten sites in this family actually did it.
 *   D2 — a regex or string literal containing `export const <CAPS>`. This catches a scrape
 *        whose text arrived some other way (a helper, an argument, a cached blob).
 * D2 alone would miss `/dangerRadius: (\d+)/`; D1 alone would miss a scrape of text read
 * elsewhere. Neither is redundant.
 */
export function textReads(text) {
  const src = stripComments(text);
  const out = [];
  src.split('\n').forEach((line, i) => {
    const m1 = /read(?:File|FileSync)\s*\([^)]*?(src\/[A-Za-z0-9_./-]+)/.exec(line);
    if (m1) out.push({ line: i + 1, path: m1[1], name: null, how: 'readFileSync', text: line.trim() });
    // ⚠️ THE FIRST DRAFT SKIPPED ANY LINE STARTING `export const`, TO AVOID FLAGGING A TOOL'S
    // OWN DECLARATIONS — and that exempted exactly the shape the defect took:
    //   `export const PLAYER_SIZE = num(/export const PLAYER_SIZE = (\d+)/, …);`
    // a scrape ASSIGNED to an exported const. Two of the five sites in the pre-fix
    // `sp_place.mjs` went unreported. The line's own declaration is the one at its first
    // non-space column; every OTHER occurrence is inside a literal.
    const lead = line.length - line.trimStart().length;
    for (const m2 of line.matchAll(/export const\s+([A-Z][A-Z0-9_]*)\s*(?:=|\\s)/g)) {
      if (m2.index === lead) continue;
      out.push({ line: i + 1, path: null, name: m2[1], how: `regex on "export const ${m2[1]}"`, text: line.trim() });
    }
  });
  return out;
}

/**
 * The subset of `textReads` that is NOT covered by the documented allowance.
 *
 * A D1 hit is judged by its PATH; a D2 hit has no path, so it is judged by whether the
 * constant it names is exported by `src/game/**`. That keeps `kx_fogcover`'s legitimate
 * `/^export const ARENA_W = …/` (an `src/arena/shared.ts` name) out of the report while
 * still catching `/export const MAX_FIGHTERS = …/` (a `src/game/state.ts` name).
 */
export function faults(text) {
  return textReads(text).filter((r) => (r.path
    ? !ALLOWED_TEXT_PREFIX.some((p) => r.path.startsWith(p))
    : GAME_EXPORTS.has(r.name)));
}

// ═════════════════════════════════════════════════════════════════════════════

if (!IS_MAIN) { /* imported for `textReads`/`faults` only — no CLI, no child processes */ } else {
  let pass = 0; let fail = 0;
  /**
   * ⚠️ `detail` PRINTS ONLY ON FAILURE, and the first draft printed it on both.
   * Every `detail` here is written as the diagnosis of a fault — *"output is byte-identical
   * with the constant overridden"* — so a green row carrying it read as a red one. An
   * instrument that reads as its own opposite is the failure this whole file is about; `note`
   * is the channel for something true either way.
   */
  const ok = (name, cond, detail = '', note = '') => {
    if (cond) { pass++; console.log(`  ok   - ${name}${note ? `   ${note}` : ''}`); }
    else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
  };

  const runTool = (rel, mode, env = {}) => {
    const r = spawnSync('node', [join(ROOT, rel), ...mode], {
      encoding: 'utf8', cwd: ROOT, env: { ...process.env, ...env },
    });
    return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // §A — STATIC: nothing in the family reads a `src/game/**` module as text
  // ─────────────────────────────────────────────────────────────────────────────
  console.log(`\n== TF1_NOSCRAPE — ${FAMILY.length} Family-1 tools, ${ROOT}`);
  console.log('\n§A — no tool obtains a `src/game/**` module as TEXT');

  // ⚠️ NON-EMPTY BEFORE ANY QUANTIFIER. `[].every()` is `true`, and this exact vacuity has
  // fired five times in this repo (`CLAUDE.md` #6) — always because a fix EMPTIED the set the
  // assertion ran over. A typo in a filename here would empty `FAMILY` of readable files and
  // print a clean green §A over nothing at all.
  ok(`the family is non-empty (${FAMILY.length} tools) and every file exists`,
    FAMILY.length > 0 && FAMILY.every((f) => existsSync(join(ROOT, f.file))),
    FAMILY.filter((f) => !existsSync(join(ROOT, f.file))).map((f) => `MISSING ${f.file}`).join(' '));

  ok('the src/game export set the D2 detector attributes against is non-empty',
    GAME_EXPORTS.size > 0 && GAME_EXPORTS.has('MIN_SAFE_RADIUS') && GAME_EXPORTS.has('MAX_FIGHTERS'),
    'an empty set would silently allow EVERY D2 hit', `${GAME_EXPORTS.size} names`);

  let scanned = 0;
  for (const f of FAMILY) {
    if (!existsSync(join(ROOT, f.file))) continue;
    const text = readFileSync(join(ROOT, f.file), 'utf8');
    scanned += text.split('\n').length;
    const bad = faults(text);
    ok(f.file.replace('tools/tmp/', ''), bad.length === 0,
      bad.map((b) => `:${b.line} ${b.how} — ${b.text.slice(0, 90)}`).join('\n         '));
  }
  ok('…and the detector actually looked at something', scanned > 0, 'zero lines scanned', `${scanned} lines scanned`);

  // §A2 — the `src/arena` allowance is a LIVE claim, not a comment.
  {
    let threw = null;
    try { await import(`${ROOT}/src/arena/shared.ts`); } catch (e) { threw = e.code ?? String(e); }
    ok('the `src/arena/**` text-read allowance still holds: Node CANNOT import that tree',
      threw === 'ERR_MODULE_NOT_FOUND',
      threw === null ? 'src/arena/shared.ts now IMPORTS — the allowance is stale, convert those reads' : `threw ${threw}, expected ERR_MODULE_NOT_FOUND`,
      `(${threw})`);
  }

  if (args.has('--static') && !args.has('--selftest')) {
    console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed  (§A only)\n`);
    process.exit(fail ? 1 : 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §B — RUNTIME: every tool still runs. This is the arm that catches TRANSITIVE
  //      breakage, which no grep over regexes can see.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n§B — every tool loads and runs (catches breakage inherited through an import)');
  const stock = new Map();
  for (const f of FAMILY) {
    const r = runTool(f.file, f.mode);
    stock.set(f.file, r.out);
    const first = (r.out.split('\n').find((l) => /Error|error:/.test(l)) ?? '').trim();
    ok(`${f.file.replace('tools/tmp/', '')} ${f.mode.join(' ') || '<default>'} exits 0`,
      r.code === 0, `exit ${r.code}  ${first.slice(0, 120)}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // §C — TRACKS THE SIM. The arm a scrape cannot pass.
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n§C — MOVES under a `tune()` override, HOLDS under an empty one');
  const T = await import(`${ROOT}/src/game/tuning/index.ts`);
  const registered = new Set(T.authoredEntries().map((e) => e.key));
  ok('the registry is non-empty, so "no override moved it" cannot mean "there are no overrides"',
    registered.size > 0, 'the registry is EMPTY — every MOVES row below is vacuous', `${registered.size} authored keys`);

  for (const f of FAMILY) {
    const name = f.file.replace('tools/tmp/', '');
    const before = stock.get(f.file);

    // HOLDS — an empty override set must be byte-identical to no override set. If this fails,
    // the tool is nondeterministic and every MOVES result below is noise.
    const held = runTool(f.file, f.mode, { FA_TUNING: '{}' });
    ok(`${name} HOLDS under FA_TUNING={}`, held.out === before,
      `${held.out.split('\n').filter((l, i) => l !== before.split('\n')[i]).length} lines differ — the tool is nondeterministic, so every MOVES result is noise`);

    if (f.moves === null) {
      // The claim, checked: this tool consumes no tunable constant.
      ok(`${name} consumes no tunable constant (${f.untunedBecause} is not in the registry) — MOVES would be vacuous`,
        !registered.has(f.untunedBecause), `${f.untunedBecause} IS registered now — give this tool a MOVES arm`);
      continue;
    }
    const key = Object.keys(f.moves)[0];
    ok(`${name}'s override key \`${key}\` is actually registered`, registered.has(key));
    const moved = runTool(f.file, f.mode, { FA_TUNING: JSON.stringify(f.moves) });
    const nDiff = moved.out.split('\n').filter((l, i) => l !== before.split('\n')[i]).length;
    ok(`${name} MOVES under ${JSON.stringify(f.moves)}`, moved.out !== before,
      'output is byte-identical with the constant overridden — this tool is NOT reading the sim',
      `${nDiff} line(s) changed`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // --selftest — the known-bad battery
  // ─────────────────────────────────────────────────────────────────────────────
  if (args.has('--selftest')) {
    console.log('\n§KB — KNOWN-BAD: the detector must FAIL on the bytes it was written for');

    // 1. THE REAL PRE-FIX FILE, out of git. Not a fixture: these bytes shipped.
    let old = null;
    try { old = execFileSync('git', ['show', `${KNOWN_BAD_SHA}:tools/tmp/sp_place.mjs`], { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { old = null; }
    ok(`the known-bad bytes are readable (${KNOWN_BAD_SHA}:tools/tmp/sp_place.mjs)`, old !== null && old.length > 0,
      'git show failed — the pin is unreachable, so the arm below would pass VACUOUSLY',
      `${old ? old.split('\n').length : 0} lines`);
    if (old) {
      const bad = faults(old);
      ok('KNOWN-BAD: the shipped pre-fix sp_place.mjs IS flagged', bad.length > 0,
        'the detector does not catch the exact defect it was written for',
        `caught ${bad.length} — ${bad.map((b) => `:${b.line}`).join(' ')}`);
      for (const b of bad) console.log(`         :${b.line} ${b.how}`);
    }

    // 2. NEGATIVE CONTROL. Without it, a detector that flags every line passes arm 1.
    ok('NEGATIVE CONTROL: today\'s sp_place.mjs is NOT flagged',
      faults(readFileSync(join(ROOT, 'tools/tmp/sp_place.mjs'), 'utf8')).length === 0);

    // 3. MUTATION of today's real content — proves the detector is not keyed to old formatting.
    {
      const cur = readFileSync(join(ROOT, 'tools/tmp/sp_place.mjs'), 'utf8');
      const mutated = cur.replace(
        'const R = await import(`${ROOT}/src/game/rules.ts`);',
        'const RULES_SRC = readFileSync(`${ROOT}/src/game/rules.ts`, \'utf8\');\n'
        + 'const R = { PLAYER_SPEED: Number(/export const PLAYER_SPEED = ([\\d.]+)/.exec(RULES_SRC)[1]) };',
      );
      ok('the mutation actually applied (anchor still present in the file)', mutated !== cur,
        'the anchor moved — this arm would be testing NOTHING');
      ok('KNOWN-BAD: re-inserting ONE scrape into today\'s file is flagged', faults(mutated).length > 0);
    }

    // 4. The allowance is a filter, so it can hide a real fault. Prove it does not hide game reads.
    {
      const arenaOnly = 'const S = readFileSync(`${ROOT}/src/arena/shared.ts`, \'utf8\');';
      const gameToo = 'const S = readFileSync(`${ROOT}/src/game/rules.ts`, \'utf8\');';
      ok('the src/arena allowance passes an arena read', faults(arenaOnly).length === 0);
      ok('…and does NOT pass a src/game read', faults(gameToo).length === 1);
    }

    // 5. 🔴 THE QUIET HALF, DEMONSTRATED. This is the arm that justifies §C existing at all:
    //    a scrape that still MATCHES can still be WRONG, and here it is, on real content.
    {
      const src = readFileSync(join(ROOT, 'src/game/rules.ts'), 'utf8');
      const m = /export const PLAYER_SPEED = ([\d.]+)/.exec(src);
      ok('the pre-fix PLAYER_SPEED regex still MATCHES rules.ts (it never threw — that is the point)',
        m !== null, 'it goes null only if the anecdote in rules.ts\'s header was edited; the lesson stands, this arm does not');
      if (m) {
        const line = src.slice(0, m.index).split('\n').length;
        const decl = src.split('\n').findIndex((l) => /^export const PLAYER_SPEED = /.test(l)) + 1;
        ok(`…and it matches a COMMENT (line ${line}), not the declaration (line ${decl})`, line !== decl,
          'the regex now matches the declaration — this arm no longer demonstrates anything, delete it',
          `comment ${line} vs declaration ${decl}`);
        const r = spawnSync('node', ['--input-type=module', '-e',
          `const R = await import('${ROOT}/src/game/rules.ts'); console.log(R.PLAYER_SPEED);`],
        { encoding: 'utf8', env: { ...process.env, FA_TUNING: '{"PLAYER_SPEED":0.24}' } });
        const tuned = Number(String(r.stdout).trim());
        ok(`…so under an override the scrape says ${m[1]} while the sim runs ${tuned}`,
          Number(m[1]) !== tuned, 'the override did not take — this demonstration is inert',
          'THIS is the failure §A alone cannot see');
      }
    }
  }

  console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
