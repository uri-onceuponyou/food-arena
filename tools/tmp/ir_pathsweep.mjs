#!/usr/bin/env node
/**
 * ir_pathsweep — WHICH TOOLS WRITE TO A FIXED PATH THAT EVERY AGENT SHARES.
 *
 *   node tools/tmp/ir_pathsweep.mjs              # the table, ranked by blast radius
 *   node tools/tmp/ir_pathsweep.mjs --all        # including the ones nothing reads back
 *   node tools/tmp/ir_pathsweep.mjs --selftest
 *
 * ─── WHY ────────────────────────────────────────────────────────────────────
 * `valuescan --mode gate` defaulted to a shared `shots/vl` and, on 08-09/10, a peer's run
 * landed there BETWEEN two agents' phases — twice — so `chars.json` and `dl.json`
 * described two different trees. The `srcId` audit refused, so nothing wrong was reported;
 * what was lost was hours of SwiftShader. That is fixed (`ir_outclaim.mjs`).
 *
 * The question this answers is the next one: **where else?** ~90 tools in this repo take
 * `--out` with a literal default. Most of them cannot cause the same defect, and saying
 * "90 tools are dangerous" would be as useless as saying none are. The distinction that
 * matters is not "does it share a path" — it is:
 *
 *   ⚠️ IS ITS OUTPUT READ BACK AS AN INPUT TO A LATER VERDICT?
 *
 * A tool that writes a PNG an agent then LOOKS at cannot mislead by colliding: two agents'
 * frames land in one directory, someone opens the wrong one, and it is obviously wrong. A
 * tool that writes JSON another PHASE or another TOOL consumes can produce a verdict
 * assembled from two trees — and that verdict looks exactly like a real one.
 *
 * So every row is classified:
 *   MULTI-PHASE-FIXED fixed default, the tool has separate `--mode` phases, and it reads
 *                     back its own output directory. THE `valuescan` SHAPE — phase 1 writes,
 *                     phase 3 reads, a peer lands in between, and the verdict is assembled
 *                     from two trees. These are the ones that matter.
 *   CROSS-TOOL-FIXED  fixed default AND another tool names the same path in code. Two
 *                     agents overwrite each other and the reader gets whichever landed last.
 *   PER-RUN           the default already carries a timestamp/pid/uuid. Collision needs a
 *                     tie at the default's resolution — stated per row, not assumed away.
 *   FIXED-VIEWED      fixed default, output is pixels a human looks at. Annoying, not
 *                     dangerous.
 *   REQUIRED          `--out` is mandatory; there is no shared default to collide on.
 *
 * 🚨 THIS IS A REPORT, NOT A FIX. It edits nothing. The tools it names are other agents'
 * files and the right move for each is a judgement about how its output is consumed, not
 * a sweep.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);

/** Default-output expressions, in the four spellings this repo actually uses. */
const PATTERNS = [
  /\b(?:const|let)\s+\w+\s*=\s*(?:String\(|resolve\(|join\(ROOT,\s*)*\s*(?:args\.out|args\[['"]out[^\]]*['"]\]|args\.outdir|args\.outDir|(?:get|arg)\(['"](?:--)?out[a-zA-Z-]*['"]\s*,\s*)/,
];
/** The variable the default is bound to — `const OUT = …` -> `OUT`. */
const varOf = (line) => (line.match(/\b(?:const|let)\s+(\w+)\s*=/) ?? [])[1] ?? null;

/**
 * 🚨 THE `valuescan` SHAPE IS SELF-CONSUMPTION THROUGH A VARIABLE, AND LITERAL MATCHING
 * CANNOT SEE IT. `valuescan` reads `join(OUT, 'chars.json')`; the string `shots/vl` never
 * appears anywhere near a read call. An earlier draft of this sweep therefore reported
 * `valuescan` as FIXED-VIEWED — it classified the one tool the whole session is about as
 * harmless. Found by reading the table and noticing the row that had to be there was not.
 *
 * So self-consumption is detected on the VARIABLE: does this file read from a path built
 * out of its own out-variable? That is exactly "a later phase reads what an earlier phase
 * wrote, into a directory whose name neither of them chose".
 */
function readsOwnOut(src, v) {
  if (!v) return false;
  // ⚠️ ONE ALIAS HOP, because the real case needs it. `valuescan` does `const outDir = OUT;`
  // and then `readFile(join(outDir, 'chars.json'))`, so a search for `OUT` next to a read
  // finds nothing — an earlier draft reported valuescan harmless for exactly that reason.
  const names = new Set([v]);
  for (const m of src.matchAll(new RegExp(`\\b(?:const|let)\\s+(\\w+)\\s*=\\s*${v}\\s*;`, 'g'))) names.add(m[1]);
  const n = [...names].join('|');
  // ⚠️ AND IT IS DELIBERATELY NARROW. A looser rule — "a read call anywhere on a line that
  // mentions the variable" — classified `compare.mjs` and thirty others as self-consuming
  // because they read their INPUTS near a line naming their output. The variable must
  // appear in PATH-BUILDING position inside the read's own argument list.
  const re = new RegExp(`(?:readFileSync|readFile|readdirSync)\\s*\\([^)]*(?:join\\(\\s*(?:${n})\\b|\\$\\{(?:${n})\\}|\\b(?:${n})\\s*\\+)`);
  return src.split('\n').some((l) => !/^\s*(\*|\/\/)/.test(l) && re.test(l));
}

/**
 * Read a literal default out of one of those expressions. Returns null when the default is
 * `null`/absent (the tool requires `--out`) or when it cannot be read as a literal — which
 * is reported as UNREADABLE rather than assumed safe.
 */
export function defaultOf(line) {
  // `--out` with no default at all, or an explicit null: nothing to collide on.
  if (/(?:get|arg)\(['"](?:--)?out[a-zA-Z-]*['"]\s*\)/.test(line)) return { kind: 'required' };
  if (/(?:get|arg)\(['"](?:--)?out[a-zA-Z-]*['"]\s*,\s*null\s*\)/.test(line)) return { kind: 'required' };
  if (/(?:args\.out\w*|args\[['"]out[^\]]*['"]\])\s*\?\?\s*null\b/.test(line)) return { kind: 'required' };
  const m = line.match(/(?:\?\?|,)\s*(`[^`]*`|'[^']*'|"[^"]*")/);
  if (!m) return { kind: 'unreadable' };
  const raw = m[1].slice(1, -1);
  // A default that interpolates anything is per-run by construction; say WHAT it varies on.
  const varies = raw.match(/\$\{([^}]*)\}/g);
  if (varies) return { kind: 'per-run', path: raw, varies: varies.join(' ') };
  return { kind: 'fixed', path: raw };
}

/**
 * Which OTHER tools name this exact path in code? Answered by searching, not by intuition.
 *
 * ⚠️ KNOWN LIMIT, stated: it matches literal path text. A consumer that builds the path
 * some other way is invisible here, so the count is a FLOOR, not a census.
 */
/**
 * ⚠️ THE FIRST VERSION OF THIS WAS USELESS AND LOOKED AUTHORITATIVE — the exact failure this
 * whole session is about. It stripped a file default to its parent directory, so
 * `shots/compare.png` became `shots`, and then reported that 68 tools "read back"
 * `compare.mjs`'s output. `/tmp/zoom.png` became `/tmp` and matched 128. A table of
 * confident nonsense. Three corrections, all forced by looking at the output:
 *   · a FILE default is matched on its full text, never on its parent
 *   · a path with one segment, or shorter than 6 characters, is too generic to attribute
 *   · the read call must be within TWO LINES of the mention, not merely somewhere in the
 *     same file — a doc comment naming `shots/vl` is not a consumer of it
 */
function consumers(pathText, files, self) {
  const isFile = /\.\w{2,4}$/.test(pathText);
  const key = isFile ? pathText : pathText.replace(/\/$/, '');
  if (key.length < 6 || key.split('/').filter(Boolean).length < 2) return { hits: [], tooGeneric: true };
  const hits = [];
  for (const [f, src] of files) {
    if (f.endsWith('ir_pathsweep.mjs')) continue;
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(key)) continue;
      // A comment is not a coupling. Everything else is: another tool naming this exact
      // path IN CODE is coupled to it, whether it reads it or writes into it.
      //
      // ⚠️ The read-call-within-two-lines filter this replaced was too strict and dropped a
      // real pair: `baseline_score.mjs` names `shots/review/baseline/assignments.json` on
      // its `const aPath = …` line and reads it forty lines later. Both drafts of the
      // narrower rule reported a coupling that exists as absent.
      if (/^\s*(\*|\/\/)/.test(lines[i])) continue;
      hits.push(f); break;
    }
  }
  // ⚠️ SELF-CONSUMPTION IS THE DANGEROUS CASE, NOT AN EXCLUSION. `valuescan` is the
  // canonical example: `--mode chars` writes, `--mode dl` writes, `--mode gate` READS BOTH
  // BACK, all into one default directory, in three separate processes. An earlier draft
  // excluded `self` as "a tool reading its own output is not a consumer" and thereby
  // dropped the one row this whole sweep exists because of.
  return { hits, tooGeneric: false };
}

/**
 * Does this tool have SEPARATE PHASES that can run as separate processes? That is what
 * turns "reads its own output directory" into the `valuescan` hazard: phase 1 writes,
 * phase 3 reads, and a peer can land between them. A single-process tool that reads back
 * a PNG it wrote 40 ms earlier to composite a sheet is not in that class at all — and an
 * earlier draft that ignored the distinction put 106 of 119 rows into one bucket, which
 * carries no more information than putting none of them there.
 */
const multiPhase = (src) => /--mode\b/.test(src);

export function sweep() {
  const files = [];
  for (const d of ['tools', 'tools/tmp']) {
    for (const e of readdirSync(join(ROOT, d))) {
      if (!e.endsWith('.mjs')) continue;
      const p = join(ROOT, d, e);
      files.push([relative(ROOT, p), readFileSync(p, 'utf8')]);
    }
  }
  const rows = [];
  for (const [f, src] of files) {
    // This tool's own selftest fixtures are literal `--out` lines by construction; sweeping
    // itself would report four defaults nothing has.
    if (f.endsWith('ir_pathsweep.mjs')) continue;
    for (const line of src.split('\n')) {
      if (/^\s*(\*|\/\/)/.test(line)) continue;          // a usage comment is not a default
      if (!PATTERNS.some((re) => re.test(line))) continue;
      const d = defaultOf(line);
      if (d.kind === 'required') { rows.push({ f, class: 'REQUIRED', path: '(--out mandatory)' }); continue; }
      if (d.kind === 'unreadable') { rows.push({ f, class: 'UNREADABLE', path: line.trim().slice(0, 70) }); continue; }
      if (d.kind === 'per-run') { rows.push({ f, class: 'PER-RUN', path: d.path, varies: d.varies }); continue; }
      const { hits, tooGeneric } = consumers(d.path, files, f);
      const others = hits.filter((c) => c !== f);
      const selfConsumed = multiPhase(src) && readsOwnOut(src, varOf(line));
      rows.push({
        f, path: d.path, cons: others, tooGeneric, selfConsumed,
        class: selfConsumed ? 'MULTI-PHASE-FIXED'
          : tooGeneric ? 'FIXED-GENERIC'
            : others.length ? 'CROSS-TOOL-FIXED' : 'FIXED-VIEWED',
      });
    }
  }
  return rows;
}

const ORDER = { 'MULTI-PHASE-FIXED': 0, 'CROSS-TOOL-FIXED': 1, 'FIXED-GENERIC': 2, UNREADABLE: 3, 'PER-RUN': 4, 'FIXED-VIEWED': 5, REQUIRED: 6 };

function report() {
  const rows = sweep().sort((a, b) => (ORDER[a.class] - ORDER[b.class]) || a.f.localeCompare(b.f));
  const show = argv.includes('--all') ? rows : rows.filter((r) => r.class !== 'FIXED-VIEWED' && r.class !== 'REQUIRED');
  console.log('\nTOOLS BY DEFAULT OUTPUT PATH — ranked by blast radius\n');
  console.log('class           tool                                   default');
  for (const r of show) {
    console.log(`${r.class.padEnd(15)} ${r.f.replace('tools/', '').padEnd(38)} ${r.path}`);
    if (r.cons?.length) console.log(`${' '.repeat(16)}READ BACK BY: ${r.cons.map((c) => c.replace('tools/', '')).join(', ')}`);
    if (r.selfConsumed) console.log(`${' '.repeat(16)}READ BACK BY ITSELF, IN A LATER PHASE — the valuescan shape`);
    if (r.tooGeneric) console.log(`${' '.repeat(16)}too generic to attribute a consumer to — judged by hand, not by this tool`);
    if (r.varies) console.log(`${' '.repeat(16)}varies on: ${r.varies}`);
  }
  const by = {};
  for (const r of rows) by[r.class] = (by[r.class] ?? 0) + 1;
  console.log(`\n${rows.length} default-output sites: ${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (!argv.includes('--all')) console.log('(FIXED-VIEWED and REQUIRED hidden — pass --all)');
  console.log('\n⚠️ MULTI-PHASE-FIXED is the `valuescan` shape: separate phases, separate processes,');
  console.log('   one shared directory, and a verdict assembled from whatever is in it. These are the');
  console.log('   rows where a peer landing between two phases produces a number rather than a mess.');
  console.log('⚠️ CROSS-TOOL-FIXED is coupling: another tool names the same literal path in code. It');
  console.log('   cannot silently mix two trees inside one verdict, but two agents WILL overwrite');
  console.log('   each other, and the second tool reads whichever landed last.');
  console.log('⚠️ FIXED-VIEWED collides too. It just cannot lie: the collision is a picture somebody');
  console.log('   looks at. Hidden by default because it would bury the handful that matter.');
  console.log('⚠️ Both searches match LITERAL path text, so every count here is a FLOOR. A consumer');
  console.log('   that builds the path some other way is invisible to this tool.');
  return rows;
}

function selftest() {
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) { pass++; console.log(`  ✓ ${name.padEnd(64)} ${JSON.stringify(got)}`); }
    else { fail++; console.log(`  ✗ ${name.padEnd(64)} got ${JSON.stringify(got)}  want ${JSON.stringify(want)}`); }
  };
  console.log('\nSELFTEST — the parser, on lines copied verbatim out of this repo\n');
  // Every fixture below is a REAL line from a real tool, so a parser that works only on
  // invented input cannot pass.
  check('valuescan: a fixed shared default',
    defaultOf("const OUT = get('--out', 'shots/vl');"), { kind: 'fixed', path: 'shots/vl' });
  check('arena-scan: a default that varies per run',
    defaultOf('const OUT = resolve(args.out ?? `shots/scan/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);').kind, 'per-run');
  check('…and it names WHAT it varies on', /new Date/.test(defaultOf('const OUT = resolve(args.out ?? `shots/scan/${new Date().toISOString()}`);').varies), true);
  check('cr2_sheet: --out with an explicit null default is REQUIRED',
    defaultOf("const OUT = get('--out', null);"), { kind: 'required' });
  check('cr2_crop: --out with no default at all is REQUIRED',
    defaultOf("const A = get('--a'), B = get('--b'), OUT = get('--out');"), { kind: 'required' });
  check('baseline_capture: String(args.out ?? literal)',
    defaultOf("const OUT = String(args.out ?? 'shots/baseline');"), { kind: 'fixed', path: 'shots/baseline' });
  check('cr_packets: resolve(join(ROOT, literal))',
    defaultOf("const OUT = resolve(args.out ?? join(ROOT, 'shots/review/cr1/now'));"), { kind: 'fixed', path: 'shots/review/cr1/now' });
  // THE KNOWN-BAD INPUT for the classifier: a per-run default must NEVER be reported as
  // fixed. That is the direction that matters — calling a safe tool dangerous wastes an
  // agent's time, calling a dangerous one safe is how this whole class of bug survives.
  check('THE BUG — a per-run default is NOT classified fixed',
    defaultOf('const OUT = args.out ?? `shots/x/${process.pid}`;').kind === 'fixed', false);
  check('its PAIR — the same line WITHOUT the interpolation IS fixed',
    defaultOf("const OUT = args.out ?? 'shots/x/';").kind, 'fixed');
  // Not tautological: five inputs, four distinct kinds.
  check('the classifier distinguishes rather than answering one way',
    new Set(["const OUT = get('--out', 'shots/vl');", "const OUT = get('--out', null);",
      'const OUT = args.out ?? `a/${x}`;', 'const OUT = args.out ?? somethingElse;']
      .map((l) => defaultOf(l).kind)).size, 4);
  // And on the REAL tree: the two paths the brief named must both appear, or the sweep is
  // pointed at the wrong files.
  {
    const rows = sweep();
    check('the real sweep finds valuescan\'s shots/vl',
      rows.some((r) => r.f.endsWith('valuescan.mjs') && r.path === 'shots/vl'), true);
    check('the real sweep finds arena-scan and calls it PER-RUN, not fixed',
      rows.find((r) => r.f.endsWith('arena-scan.mjs'))?.class, 'PER-RUN');
    check('at least one CROSS-TOOL-FIXED row exists (else the coupling search is dead)',
      rows.some((r) => r.class === 'CROSS-TOOL-FIXED'), true);
    // A class holding almost everything carries no more information than one holding
    // nothing. An earlier draft put 106 of 119 rows in one bucket and read as a finding.
    const share = rows.filter((r) => r.class === 'MULTI-PHASE-FIXED').length / rows.length;
    check('MULTI-PHASE-FIXED is a MINORITY of rows (a class holding everything says nothing)',
      share < 0.25, true);
    // 🚨 THE ANTI-REGRESSION FOR MY OWN TWO WRONG ANSWERS. Two drafts of this tool
    // classified `valuescan` — the one tool the whole sweep exists because of — as
    // FIXED-VIEWED, i.e. harmless: the first excluded self-consumption, the second could
    // not see it through the `const outDir = OUT;` alias. Both tables looked authoritative.
    check('THE BUG, TWICE — valuescan MUST classify as MULTI-PHASE-FIXED, not FIXED-VIEWED',
      rows.find((r) => r.f.endsWith('valuescan.mjs') && r.path === 'shots/vl')?.class, 'MULTI-PHASE-FIXED');
    check('…and specifically as SELF-consumed, through the alias',
      rows.find((r) => r.f.endsWith('valuescan.mjs') && r.path === 'shots/vl')?.selfConsumed, true);
    check('its PAIR — a writer that never reads its own out is NOT self-consumed',
      rows.find((r) => r.f.endsWith('shoot.mjs'))?.selfConsumed ?? false, false);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (argv.includes('--selftest')) process.exit(selftest());
  report();
}
