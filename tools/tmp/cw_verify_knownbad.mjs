#!/usr/bin/env node
/**
 * CONCEALMENT WIRING — the KNOWN-BAD battery for `tools/tmp/arena_probe.mjs --verify`.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `--verify` is the guard that catches "the source extractor and the browser dump
 * disagree about the arena layout". It could not fail on a dropped CONCEALMENT list.
 * Its normaliser was `{w,h,c,msr,ps,es,cover,hz}`, and concealment lives on its own
 * `arena.concealment` array precisely so that nothing reading `cover` can see it — that
 * separation is what makes a plate walk-through. So an arena that declared plates and a
 * dump that had lost them compared EQUAL, and the tool printed
 * *"MATCH — the extractor is a faithful second reader"*.
 *
 * **A guard that has not been shown to FAIL on the bug it guards against is not a
 * guard** (`docs/LESSONS.md` §13; nineteen instruments were caught returning confident
 * wrong answers in one session). So this file does not assert that the fix is present —
 * it feeds the SAME known-bad input to the COMMITTED PRE-FIX COPY of the tool and to the
 * working one, and requires them to disagree:
 *
 *     pre-fix copy  (git show <ref>:tools/tmp/arena_probe.mjs)  ->  MATCH   (blind)
 *     working copy                                             ->  MISMATCH (sees it)
 *
 * The pre-fix copy is materialised INSIDE `tools/tmp/` and deleted afterwards, because
 * it does `import './scripted_player.mjs'` and `resolve(new URL('../..'))` — both of
 * which only resolve from that directory. It is never committed.
 *
 * ── THE SECOND HALF: THE EXTRACTOR ──────────────────────────────────────────
 *
 * No arena declares a concealment list yet, so every registration shape the extractor
 * recognises — and the tripwire for the one it does not — is unexercised by the real
 * `kitchen.ts`. Cases 4-8 drive `--kitchen <path>` with synthetic sources instead: one
 * per supported shape, one in a shape the parser cannot read (must THROW rather than
 * quietly return zero, which is what put the blindness there in the first place), and
 * one that only mentions concealment in a comment (must NOT throw).
 *
 *   node tools/tmp/cw_verify_knownbad.mjs             # 13 assertions
 *   node tools/tmp/cw_verify_knownbad.mjs --ref <sha> # pin the pre-fix copy explicitly
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

/**
 * The commit whose `arena_probe.mjs` is the BLIND one.
 *
 * DERIVED, not pinned, and the derivation matters: "HEAD" is only the pre-fix tree until
 * the fix is committed, and a hardcoded sha rots the moment anyone rebases or the file is
 * touched again. So: walk this ONE file's history newest-first and take the first commit
 * whose copy does not carry the concealment key in its normaliser. That is the definition
 * of "the version that could not see a concealment list", stated as a property of the
 * content rather than as a commit id someone has to keep up to date. `--ref <sha>`
 * overrides it.
 */
function findBlindRef() {
  const explicit = arg('--ref', null);
  if (explicit) return String(explicit);
  const shas = execFileSync('git', ['log', '-20', '--format=%H', '--', 'tools/tmp/arena_probe.mjs'],
    { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const sha of shas) {
    const src = execFileSync('git', ['show', `${sha}:tools/tmp/arena_probe.mjs`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (!/\bconceal:\s*\[/.test(src)) return sha;
  }
  throw new Error('cw_verify_knownbad: no commit in the last 20 touching arena_probe.mjs '
    + 'predates the concealment normaliser — pass --ref <sha> explicitly.');
}
const REF = findBlindRef();

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? `\n         ${detail}` : ''}`); }
};

const TMP = mkdtempSync(join(tmpdir(), 'cw-knownbad-'));
/** Materialised inside tools/tmp so its relative imports resolve; removed in `finally`. */
const HEAD_PROBE = join(ROOT, 'tools/tmp', `cw_headprobe_${process.pid}.mjs`);

/** Run a probe and return { code, out }. Never throws on a non-zero exit — a non-zero
 *  exit is the SIGNAL here, not an error. */
function run(script, argv) {
  try {
    const out = execFileSync('node', [script, ...argv], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}
const said = (r, s) => r.out.includes(s);
/** "source extraction: 27 cover, 3 hazards, 4 concealment" -> 4. `null` if the tool
 *  never printed the field (which is itself the pre-fix tell). */
function srcConcealCount(out) {
  const m = /source extraction:.*?(\d+) concealment/.exec(out);
  return m ? Number(m[1]) : null;
}

try {
  // ── Fixtures ─────────────────────────────────────────────────────────────
  const REAL_CACHE = join(ROOT, 'tools/arena.gameplay.json');
  const real = JSON.parse(readFileSync(REAL_CACHE, 'utf8'));

  /**
   * THE KNOWN-BAD INPUT: the real committed layout, byte-for-byte, PLUS a concealment
   * list. It stands for "the arena declares plates and the source extractor dropped
   * them" — the one thing this guard is for. Everything else about the two sides is
   * identical, so a MATCH can only mean the concealment list was not compared.
   *
   * The boxes are legal-by-construction so the fixture never has to be re-authored when
   * the arena owner places real plates: 120x120 (well under the ~168 wu AI-search limit)
   * and pushed to the arena's corners, far outside the 248.25 wu endgame keepout.
   */
  const CONCEAL_FIXTURE = [
    { x: 240, y: 200, w: 120, h: 120, kind: 'plate_stack' },
    { x: 1160, y: 200, w: 120, h: 120, kind: 'plate_stack' },
    { x: 240, y: 800, w: 120, h: 120, kind: 'crate' },
    { x: 1160, y: 800, w: 120, h: 120, kind: 'tray_stack' },
  ];
  const DUMP_WITH = join(TMP, 'dump-with-concealment.json');
  const DUMP_WITHOUT = join(TMP, 'dump-without-concealment.json');
  writeFileSync(DUMP_WITH, JSON.stringify({ ...real, concealment: CONCEAL_FIXTURE }, null, 2));
  writeFileSync(DUMP_WITHOUT, JSON.stringify(real, null, 2));

  const PROBE = join(ROOT, 'tools/tmp/arena_probe.mjs');

  console.log('\ncw_verify_knownbad — arena_probe --verify, against inputs it must reject');
  console.log('\n1-3. THE GUARD, on the bug it guards against');

  // ── 1. Control: unmodified cache must still MATCH ────────────────────────
  // Without this, "MISMATCH on the known-bad input" proves nothing — a tool that always
  // says MISMATCH would pass case 2 and be useless.
  const ctl = run(PROBE, ['--verify', '--layout', DUMP_WITHOUT]);
  check('CONTROL: the real layout with no concealment on either side still MATCHes',
    ctl.code === 0 && said(ctl, 'MATCH — the extractor is a faithful second reader'),
    ctl.out.trim().split('\n').slice(-3).join(' | '));

  // ── 2. The known-bad input, through the FIXED tool ───────────────────────
  const bad = run(PROBE, ['--verify', '--layout', DUMP_WITH]);
  check('KNOWN-BAD: a dump carrying 4 concealment boxes against a source with none -> MISMATCH',
    bad.code === 1 && said(bad, 'MISMATCH'),
    `exit ${bad.code}: ${bad.out.trim().split('\n').slice(-3).join(' | ')}`);
  check('…and it NAMES the dropped boxes rather than only reporting a count',
    said(bad, 'conceal') && said(bad, 'plate_stack@240,200,120x120'),
    bad.out.trim().split('\n').slice(-6).join(' | '));

  // ── 3. The same input, through the COMMITTED PRE-FIX copy ────────────────
  // This is the whole point: the ablation is run, not asserted.
  let headProbeAvailable = false;
  try {
    const headSrc = execFileSync('git', ['show', `${REF}:tools/tmp/arena_probe.mjs`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    writeFileSync(HEAD_PROBE, headSrc);
    headProbeAvailable = true;
    const blind = run(HEAD_PROBE, ['--verify', '--layout', DUMP_WITH]);
    const blindIsBlind = blind.code === 0 && said(blind, 'MATCH — the extractor is a faithful second reader');
    check(`ABLATION: the PRE-FIX copy (${REF}) calls the SAME input MATCH — the guard really was blind`,
      blindIsBlind,
      blindIsBlind ? '' : `exit ${blind.code}: ${blind.out.trim().split('\n').slice(-3).join(' | ')}`
        + '\n         (if this reports MISMATCH, --ref already contains the fix: pass the pre-fix sha)');
    check('…and the pre-fix copy did not even PRINT a concealment count',
      srcConcealCount(blind.out) === null);
  } catch (e) {
    check(`ABLATION: pre-fix copy of arena_probe.mjs available at ${REF}`, false, String(e.message ?? e));
    check('…and the pre-fix copy did not even PRINT a concealment count', false, 'skipped');
  }

  // ── 4-8. THE EXTRACTOR, one synthetic source per registration shape ──────
  console.log('\n4-8. THE EXTRACTOR, on sources no real arena has written yet');

  /** Minimum a fixture needs for `extractFromSource` to complete: spawns and one puddle,
   *  in the exact syntax the existing (verified) regexes read. */
  const PREAMBLE = [
    'const playerSpawn = { x: 160, y: 390 };',
    'const enemySpawn = { x: 1240, y: 610 };',
    'const puddleSouth = { x: 560, y: 900, radius: 50 };',
  ].join('\n');
  const kitchenFixture = (body) => {
    const p = join(TMP, `kitchen-${Math.random().toString(36).slice(2, 8)}.ts`);
    writeFileSync(p, `${PREAMBLE}\n${body}\n`);
    return p;
  };
  /**
   * Extraction only — the layout side is pinned to the no-concealment dump so the
   * reported `source extraction: N concealment` is the thing under test.
   *
   * ⚠️ `ok` is "extraction COMPLETED", not "the run exited 0". A fixture kitchen declares
   * no cover, so `--verify` legitimately MISMATCHes on `cover` and exits 1 every time;
   * reading that exit code as the tripwire firing would make three of these cases pass
   * for the wrong reason. The tripwire throws, and a throw never reaches the header line.
   */
  const extractCount = (body) => {
    const r = run(PROBE, ['--verify', '--kitchen', kitchenFixture(body), '--layout', DUMP_WITHOUT]);
    return { n: srcConcealCount(r.out), ok: said(r, 'EXTRACTOR VERIFY'), r };
  };

  const shape1 = extractCount([
    "const concealment: ConcealBox[] = [];",
    "addPlateStack(propsGroup, concealment, M, {",
    "  x: 240, y: 200, w: 120, h: 120, kind: 'plate_stack',",
    "  build: (w, d) => buildPlateStack(M, w, d),",
    '});',
    "addPotLid(propsGroup, concealment, M, {",
    "  x: 1160, y: 800, w: 100, h: 100, kind: 'pot_lid',",
    "  build: (w, d) => buildPotLid(M, w, d),",
    '});',
  ].join('\n'));
  check('SHAPE 1: `addX(propsGroup, concealment, M, { ... build: })` -> 2 boxes',
    shape1.n === 2, `got ${shape1.n}`);

  const shape2 = extractCount([
    "const concealment: ConcealBox[] = [];",
    "concealment.push(",
    "  { x: 240, y: 200, w: 120, h: 120, kind: 'plate_stack' },",
    "  { x: 1160, y: 200, w: 120, h: 120, kind: 'crate' },",
    ');',
  ].join('\n'));
  check('SHAPE 2: `concealment.push({...}, {...})` -> 2 boxes', shape2.n === 2, `got ${shape2.n}`);

  const shape3 = extractCount([
    'const concealment: ConcealBox[] = [',
    "  { x: 240, y: 200, w: 120, h: 120, kind: 'plate_stack' },",
    "  { x: 1160, y: 800, w: 120, h: 120, kind: 'tray_stack' },",
    "  { x: 700, y: 120, w: 120, h: 120, kind: 'crate' },",
    '];',
  ].join('\n'));
  check('SHAPE 3: a plain `const concealment = [ ... ]` array literal -> 3 boxes',
    shape3.n === 3, `got ${shape3.n}`);

  // ── The tripwire. THE MOST IMPORTANT CASE IN THIS FILE. ──────────────────
  // A registration shape the parser cannot read returns zero boxes, which is
  // indistinguishable from "this arena has no plates" — i.e. it silently reinstates the
  // exact blindness the rest of this battery just removed. It must be refused.
  const unknownShape = run(PROBE, ['--verify', '--layout', DUMP_WITHOUT, '--kitchen', kitchenFixture([
    'const concealment: ConcealBox[] = [];',
    'for (const p of PLATE_GRID) {',
    '  concealment.push(makeConcealBox(p));',
    '}',
  ].join('\n'))]);
  check('TRIPWIRE: a source that POPULATES concealment in an unreadable shape THROWS',
    unknownShape.code !== 0 && said(unknownShape, 'parsed ZERO boxes'),
    `exit ${unknownShape.code}: ${unknownShape.out.trim().split('\n').slice(-2).join(' | ')}`);

  // …but the tripwire must not be a hair trigger, or it becomes something people
  // route around. Prose about the mechanic is not a registration.
  const commentOnly = extractCount([
    '// Concealment (plates, pot lids, crates, stacked trays) is not placed in this',
    '// arena yet — see docs/DECISIONS-FOR-URI.md §30. No concealment list here.',
    '/* concealment.push({ x: 1, y: 2, w: 3, h: 4 }); */',
  ].join('\n'));
  check('…and a comment-only MENTION of concealment does not trip it (extraction completes, 0 boxes)',
    commentOnly.ok && commentOnly.n === 0,
    `ok=${commentOnly.ok} n=${commentOnly.n}`);

  const emptyDecl = extractCount('const concealment: ConcealBox[] = [];');
  check('…and an EMPTY declared list is legitimate scaffolding, not a fault',
    emptyDecl.ok && emptyDecl.n === 0,
    `ok=${emptyDecl.ok} n=${emptyDecl.n}`);

  // ── 9. End-to-end: a source WITH plates vs a dump that has them ──────────
  console.log('\n9. Both sides populated');
  const bothSides = run(PROBE, ['--verify', '--layout', DUMP_WITH, '--kitchen', kitchenFixture(
    CONCEAL_FIXTURE.map((c) => `concealment.push({ x: ${c.x}, y: ${c.y}, w: ${c.w}, h: ${c.h}, kind: '${c.kind}' });`).join('\n')
  )]);
  check('a source declaring the same 4 boxes as the dump reports 4, and the CONCEALMENT halves agree',
    srcConcealCount(bothSides.out) === 4 && !said(bothSides, 'conceal  src only') && !said(bothSides, 'conceal  dump only'),
    bothSides.out.trim().split('\n').slice(-6).join(' | '));

  // The cover halves still disagree there (the fixture kitchen declares no cover), which
  // is the second control: it proves the conceal comparison is independent of the cover
  // one rather than piggybacking on it.
  check('…while the COVER halves still disagree, so the two lists are compared independently',
    bothSides.code === 1 && said(bothSides, 'cover    dump only'),
    bothSides.out.trim().split('\n').slice(-4).join(' | '));
} finally {
  if (existsSync(HEAD_PROBE)) rmSync(HEAD_PROBE, { force: true });
  rmSync(TMP, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
