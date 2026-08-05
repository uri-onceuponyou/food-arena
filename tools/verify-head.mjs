#!/usr/bin/env node
/**
 * Verify what is actually COMMITTED, not what happens to be on disk.
 *
 * ## The bug this exists to prevent
 *
 * `src/game/match.ts` was committed with `import ... from './pointerLock'` while
 * `src/game/pointerLock.ts` was never `git add`ed. **HEAD did not build for 24 commits.**
 * Every route 500'd on a fresh clone:
 *
 *     [vite] Internal server error: Failed to resolve import "./pointerLock"
 *
 * The project's standing gates — `npx tsc --noEmit` and `node src/game/sim.test.mjs` —
 * both run against the **working tree**, where an untracked file exists and resolves
 * perfectly. Neither says anything about the tree being pushed. Every "tsc clean, sim
 * 51/51" claim in this repo's history verified something that was not what shipped.
 *
 * It surfaced only by accident: seven agents had the working tree failing to typecheck, so
 * screenshots had to come from a clean checkout — which promptly 500'd.
 *
 * ## What this does
 *
 * Exports HEAD (or any ref) with `git archive` into a temp dir, symlinks `node_modules`,
 * then runs the real gates there:
 *
 *   1. every import in committed code resolves to a committed file
 *   2. `tsc --noEmit`
 *   3. the sim test
 *   4. Vite actually serves `/` without a 500        (--serve)
 *
 * Step 1 is the cheap one and catches this exact class in about a second, so it runs first
 * and independently: a missing file is not a type error, it is an absent file, and only a
 * resolver notices.
 *
 * ## Use
 *
 *   node tools/verify-head.mjs              # committed-import check + tsc + sim
 *   node tools/verify-head.mjs --serve      # also boot Vite and fetch every route
 *   node tools/verify-head.mjs --ref abc123 # verify some other commit
 *
 * Run it BEFORE pushing. It is the only gate here that describes the pushed artefact.
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, extname } from 'node:path';
import net from 'node:net';
import ts from 'typescript';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : 'HEAD';
const doServe = args.includes('--serve');

const dir = mkdtempSync(join(tmpdir(), 'fa-verify-'));
let failed = false;
const fail = (msg) => { failed = true; console.error(`  FAIL  ${msg}`); };
const ok = (msg) => console.log(`  ok    ${msg}`);

console.log(`\nverifying committed tree at ${ref}\n`);

execFileSync('bash', ['-c', `git -C "${ROOT}" archive ${ref} | tar -x -C "${dir}"`]);
symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');

// ── 1. Every relative import in committed code must resolve to a committed file ──────
// This is the check that would have caught pointerLock.ts. Deliberately simple and
// dependency-free: a regex over import/export-from specifiers, resolved against the
// exported tree. It cannot type-check anything and is not trying to.
function walk(d, out = []) {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.mjs', '.js', '.html'].includes(extname(p))) out.push(p);
  }
  return out;
}

const SPEC = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;

/**
 * HTML asset references — `<script src>` and `<link href>`.
 *
 * Added after `tools/arena-dump.html` (COMMITTED) was found loading
 * `/tools/arena-dump.js` (UNTRACKED). On a fresh clone that 404s, so
 * `match-sim.mjs --refresh-arena` hangs until it times out. It is the exact
 * failure this tool exists to catch — HEAD importing something not in HEAD —
 * and it slipped through THREE separate gaps at once:
 *
 *   1. only `src/` was walked, never `tools/`
 *   2. only `.ts/.tsx/.mjs/.js` were read, never `.html`
 *   3. only RELATIVE specifiers matched; this one is root-absolute (`/tools/...`)
 *
 * External URLs and Vite's own virtual paths are skipped rather than guessed at:
 * a lint that cries wolf gets ignored (see the note above, and LESSONS §9).
 */
const HTML_ASSET = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

/**
 * Strip comments before scanning.
 *
 * The first version of this check reported two failures that were both DOC COMMENTS
 * showing `import { audio } from '../../audio'` as a usage example. A lint that cries
 * wolf gets ignored, which is worse than no lint — the same conclusion the CSS-backtick
 * guard reached when it was widened and immediately false-positived on legitimate nested
 * template literals. Both times the mistake was pattern-matching a language rather than
 * parsing it. This is the cheap middle ground: remove comments, then match. It will still
 * mis-read an import specifier written inside a plain string, which is rare enough to
 * accept and loud enough to notice.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments, including /** doc */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // line comments, sparing the // in a URL
}

/**
 * PARSE the module, do not pattern-match it. `docs/LESSONS.md` §9.
 *
 * The regex version of this check walked `tools/` for the first time and immediately
 * cried wolf on `tools/tmp/capture_audit.mjs`, which is a CLASSIFIER: its selftest
 * fixtures are template literals containing example source, so they hold text like
 * `import { stepMatch } from '../../src/game/sim.js'` as DATA. Three false failures,
 * on a tool whose whole job is parsing other tools.
 *
 * That is exactly the failure §9 records twice already — a comment-stripping regex
 * reporting two doc comments, and a CSS backtick guard that false-positived on nested
 * template literals — and its recorded conclusion is that a lint which cries wolf gets
 * ignored, which is worse than no lint.
 *
 * `typescript` is already a dependency, `ts.createSourceFile` parses `.mjs`/`.js` fine,
 * and two other tools here already use it. A string literal that happens to contain an
 * import statement is simply not an ImportDeclaration node, so this cannot be fooled by
 * fixtures, examples or documentation — and it needs no comment-stripping either.
 */
function moduleSpecifiers(file, source) {
  const out = [];
  const kind = ['.ts', '.tsx'].includes(extname(file)) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, /* parents */ false, kind);
  const take = (node) => {
    if (node && ts.isStringLiteral(node) && node.text.startsWith('.')) out.push(node.text);
  };
  const visit = (node) => {
    // static `import x from '…'` and `export … from '…'`
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) take(node.moduleSpecifier);
    // dynamic `import('…')`
    else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) take(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

let missing = 0;

/** Resolve a specifier the way Vite would: `/x` against the root, `./x` against the file. */
function resolveSpec(file, spec) {
  return spec.startsWith('/') ? join(dir, spec.slice(1)) : resolve(dirname(file), spec);
}
function resolves(base) {
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`,
          join(base, 'index.ts'), join(base, 'index.js')].some(existsSync);
}

// `tools/` is walked as well as `src/`: arena-dump.html lives there, and a committed
// tool importing an untracked scratch probe out of tools/tmp/ is the same bug.
for (const root of ['src', 'tools']) {
  for (const file of walk(join(dir, root))) {
    const raw = readFileSync(file, 'utf8');
    const rel = file.slice(dir.length + 1);

    if (extname(file) === '.html') {
      for (const [, spec] of raw.matchAll(HTML_ASSET)) {
        // Skip anything not resolvable to a file on disk at build time.
        if (/^(?:https?:)?\/\//i.test(spec) || spec.startsWith('data:') || spec.startsWith('#')) continue;
        if (!spec.startsWith('/') && !spec.startsWith('.')) continue; // bare/virtual — Vite's business
        if (!resolves(resolveSpec(file, spec))) {
          fail(`${rel} loads '${spec}' — NOT IN THE COMMITTED TREE`);
          missing++;
        }
      }
      continue;
    }

    for (const spec of moduleSpecifiers(file, raw)) {
      if (!resolves(resolveSpec(file, spec))) {
        fail(`${rel} imports '${spec}' — NOT IN THE COMMITTED TREE`);
        missing++;
      }
    }
  }
}
if (!missing) ok('every relative import resolves to a committed file');

// ── 2 & 3. The standing gates, but against the exported tree ────────────────────────
for (const [label, cmd, cmdArgs] of [
  ['tsc --noEmit', 'npx', ['tsc', '--noEmit']],
  ['sim.test.mjs', 'node', ['src/game/sim.test.mjs']],
]) {
  try {
    execFileSync(cmd, cmdArgs, { cwd: dir, stdio: 'pipe' });
    ok(label);
  } catch (e) {
    fail(`${label}\n${(e.stdout || e.stderr || '').toString().split('\n').slice(0, 12).join('\n')}`);
  }
}

// ── 4. Optional: does it actually SERVE? A resolvable, type-correct tree can still 500 ──
if (doServe) {
  const port = await new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
  });
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  vite.stdout.on('data', (d) => { log += d; });
  vite.stderr.on('data', (d) => { log += d; });

  const deadline = Date.now() + 60_000;
  let up = false;
  while (Date.now() < deadline && !up) {
    up = await new Promise((res) => {
      const sock = net.connect(port, '127.0.0.1');
      sock.on('connect', () => { sock.destroy(); res(true); });
      sock.on('error', () => res(false));
      setTimeout(() => { sock.destroy(); res(false); }, 400);
    });
    if (!up) await new Promise((r) => setTimeout(r, 400));
  }

  for (const route of ['/', '/preview.html', '/src/main.ts']) {
    try {
      const body = execFileSync('curl', ['-s', '--max-time', '30', `http://localhost:${port}${route}`]).toString();
      // Vite reports a transform failure as a 200 with the error in the body, so a status
      // code alone proves nothing — the same lesson the snapshot tool's freeze test taught.
      if (/Internal server error|Failed to resolve import/i.test(body)) fail(`serve ${route} — ${body.slice(0, 160)}`);
      else ok(`serve ${route}`);
    } catch {
      fail(`serve ${route} — request failed`);
    }
  }
  if (/Internal server error/i.test(log)) fail('vite logged an internal server error');
  vite.kill('SIGTERM');
}

rmSync(dir, { recursive: true, force: true });
console.log(failed ? '\nFAILED — the committed tree is broken\n' : '\nOK — the committed tree builds\n');
process.exit(failed ? 1 : 0);
