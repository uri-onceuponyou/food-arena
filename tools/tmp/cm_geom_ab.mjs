#!/usr/bin/env node
/**
 * 🧬 BYTE-IDENTITY A/B FOR THE `taperedSegment` MIGRATION — geometry, not pixels.
 *
 * ── What question this answers ───────────────────────────────────────────────
 * The migration in `cm_*` is a REFACTOR: six copies of one function collapse into the
 * shared export from `rig.ts`, and three re-typed derived constants become published
 * `RigMetrics` reads. `rg_taper.mjs` already proved the shared FUNCTION is byte-
 * identical to both legacy dialects (832 comparisons, worst |Δ| exactly 0) — but it
 * says so about the function in isolation. It explicitly disclaims the migration:
 *
 *   > ⚠️ **It is a proof about GEOMETRY, not about MIGRATION.** ... a mistyped
 *   > argument at a call site is a defect this tool cannot see.
 *
 * That is exactly the defect this tool exists to see. It builds the SAME six
 * characters from two independent repo roots and compares **every float of every
 * geometry attribute and every world matrix**, bit for bit.
 *
 * ── Why geometry and not a screenshot ───────────────────────────────────────
 * A rendered A/B is the shipped artefact and is run separately (`cm_shot_ab.mjs`),
 * but it is the WEAKER test for this question, three ways:
 *   · A GPU frame is 8-bit quantised, so a sub-quantum vertex move renders identical.
 *   · SwiftShader is contended on this machine and one frame takes minutes.
 *   · A frame cannot see a vertex the camera does not face. Every vertex is compared
 *     here, including the ones inside the food mass.
 * So: this tool is the acceptance test; the render is the confirmation that the
 * shipped path agrees.
 *
 * ── The drift controls (AGENT-BRIEF §4: a guard not shown to FAIL is not a guard) ──
 *   SELF-PAIR   the before root against ITSELF must report 0 differing floats. A
 *               "no diff" from a comparator that cannot diff is worth nothing, and a
 *               character constructor that used `Math.random()` would show up here.
 *   POISON      `--poison` perturbs ONE float of ONE geometry in arm B by 1 ulp and
 *               REQUIRES the comparison to fail.
 *   MUTANT      `--selftest` writes a copy of the AFTER tree with one call-site
 *               argument mistyped (`0.32` -> `0.320001` on hamburger's upper arm) and
 *               requires exactly that character to differ and the other five not to.
 *               That is the real failure mode of this migration, reproduced.
 *
 * Usage:
 *   node tools/tmp/cm_geom_ab.mjs --before <root> --after <root> [--chars a,b]
 *   node tools/tmp/cm_geom_ab.mjs --before <root> --after <root> --poison
 *   node tools/tmp/cm_geom_ab.mjs --selftest --before <root> --after <root>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const argv = process.argv;
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

/** The six files this migration owns. `soup`/`hotdog`/`pizza`/`sushi` use the
 *  DIFFERENT `taperedLimb` and are deliberately out of scope. */
const CHARS = String(arg('--chars', 'hamburger,taco,burrito,donut,egg,lollipop')).split(',').filter(Boolean);

/**
 * Bundle `src/characters/registry.ts` from an ARBITRARY repo root.
 *
 * Copied from `rg_lib.buildBundle` rather than imported, because that one hard-codes
 * `REPO = resolve(HERE, '..', '..')` — it can only ever bundle the tree it lives in,
 * which is the one thing a two-root A/B cannot accept.
 *
 * ⚠️ `three` and `esbuild` are always taken from the MAIN repo's `node_modules`, for
 * both arms. That is deliberate: `node_modules` is not part of the change, and
 * pinning it isolates the experiment to `src/`.
 */
function buildBundle(root) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cm-'));
  const entry = path.join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export { createCharacter } from ${JSON.stringify(path.join(root, 'src/characters/registry'))};`,
    `export * as THREE from 'three';`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(REPO, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found at ${esbuild}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(REPO, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  return out;
}

/** Character constructors log to stderr; capture rather than hide (rg_lib's rule). */
function captureWarnings(fn) {
  const warns = [];
  const origWarn = console.warn, origLog = console.log;
  console.warn = (...a) => warns.push(a.join(' '));
  console.log = (...a) => { const s = a.join(' '); if (s.startsWith('[')) warns.push(s); else origLog(...a); };
  try { return { value: fn(), warns }; } finally { console.warn = origWarn; console.log = origLog; }
}

/**
 * Flatten one character into a comparable record.
 *
 * Traversal order is the scene-graph order, which is construction order and is
 * deterministic — but the node PATH is recorded with each row anyway, so a node
 * inserted or reordered reports as a structural difference rather than silently
 * shifting every subsequent comparison by one.
 */
function dump(THREE, root) {
  root.updateMatrixWorld(true);
  const rows = [];
  root.traverse((o) => {
    const row = {
      path: nodePath(o),
      type: o.type,
      visible: o.visible,
      matrix: Array.from(o.matrixWorld.elements),
      attrs: {},
      index: null,
      mat: null,
    };
    const g = o.geometry;
    if (g) {
      for (const key of Object.keys(g.attributes).sort()) {
        const a = g.attributes[key];
        row.attrs[key] = { n: a.count, itemSize: a.itemSize, data: Array.from(a.array) };
      }
      row.index = g.index ? Array.from(g.index.array) : null;
    }
    const m = o.material;
    if (m) {
      const one = Array.isArray(m) ? m[0] : m;
      row.mat = {
        type: one.type,
        color: one.color ? one.color.getHex() : null,
        emissive: one.emissive ? one.emissive.getHex() : null,
        roughness: one.roughness ?? null,
        metalness: one.metalness ?? null,
        opacity: one.opacity, transparent: one.transparent,
        side: one.side, depthWrite: one.depthWrite,
      };
    }
    rows.push(row);
  });
  return rows;
}

function nodePath(o) {
  const parts = [];
  for (let n = o; n; n = n.parent) parts.push(n.name || `<${n.type}>`);
  return parts.reverse().join('/');
}

/** Every float in one dump, in a fixed order, as a Float64Array for exact compare. */
function floats(rows) {
  const out = [];
  for (const r of rows) {
    out.push(...r.matrix);
    for (const k of Object.keys(r.attrs).sort()) out.push(...r.attrs[k].data);
    if (r.index) out.push(...r.index);
    if (r.mat) out.push(r.mat.color ?? -1, r.mat.emissive ?? -1, r.mat.roughness ?? -1,
      r.mat.metalness ?? -1, r.mat.opacity, r.mat.side);
  }
  return Float64Array.from(out);
}

/** Structural signature — node paths and attribute shapes, independent of values. */
function shape(rows) {
  return rows.map((r) => `${r.path}|${r.type}|${r.visible}|` +
    Object.keys(r.attrs).sort().map((k) => `${k}:${r.attrs[k].n}x${r.attrs[k].itemSize}`).join(',') +
    `|idx:${r.index ? r.index.length : 0}|${r.mat ? r.mat.type : '-'}`).join('\n');
}

async function dumpRoot(root, ids) {
  const mod = await import('file://' + buildBundle(root) + `?v=${Date.now()}`);
  const { createCharacter, THREE } = mod;
  const out = {};
  const { warns } = captureWarnings(() => {
    for (const id of ids) {
      const c = createCharacter(id);
      out[id] = dump(THREE, c.root);
    }
  });
  return { out, warns };
}

/** Compare two dumps. Returns per-character {structOK, nFloats, nDiff, worst, where}. */
function compare(A, B, ids) {
  const res = {};
  for (const id of ids) {
    const sa = shape(A[id]), sb = shape(B[id]);
    if (sa !== sb) {
      const la = sa.split('\n'), lb = sb.split('\n');
      let firstDiff = '(length differs)';
      for (let i = 0; i < Math.max(la.length, lb.length); i++) {
        if (la[i] !== lb[i]) { firstDiff = `row ${i}: ${la[i] ?? '(none)'}  VS  ${lb[i] ?? '(none)'}`; break; }
      }
      res[id] = { structOK: false, nFloats: 0, nDiff: -1, worst: Infinity, where: firstDiff };
      continue;
    }
    const fa = floats(A[id]), fb = floats(B[id]);
    let nDiff = 0, worst = 0, where = '';
    for (let i = 0; i < fa.length; i++) {
      if (fa[i] !== fb[i]) {
        nDiff++;
        const d = Math.abs(fa[i] - fb[i]);
        if (d > worst) { worst = d; where = `float[${i}] ${fa[i]} -> ${fb[i]}`; }
      }
    }
    res[id] = { structOK: true, nFloats: fa.length, nDiff, worst, where };
  }
  return res;
}

function report(title, res, ids) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
  let bad = 0;
  for (const id of ids) {
    const r = res[id];
    const ok = r.structOK && r.nDiff === 0;
    if (!ok) bad++;
    console.log(`  ${ok ? 'IDENTICAL' : '  DIFFERS '}  ${id.padEnd(11)} ` +
      `floats=${String(r.nFloats).padStart(8)}  diff=${String(r.nDiff).padStart(6)}` +
      (ok ? '' : `  worst|Δ|=${r.worst}  ${r.where}`));
  }
  return bad;
}

// ── Known-bad #1: poison one float in arm B ──────────────────────────────────
function poison(B, ids) {
  const id = ids[0];
  for (const r of B[id]) {
    if (r.attrs.position && r.attrs.position.data.length) {
      r.attrs.position.data[0] = Math.nextafter ? Math.nextafter(r.attrs.position.data[0], Infinity)
        : r.attrs.position.data[0] + Number.EPSILON;
      return `${id} ${r.path} position[0]`;
    }
  }
  throw new Error('poison: no position attribute found');
}

// ── Known-bad #2: a mistyped call-site argument, which is the REAL failure mode ──
function makeMutant(afterRoot) {
  const dir = mkdtempSync(path.join(tmpdir(), 'cm-mutant-'));
  cpSync(path.join(afterRoot, 'src'), path.join(dir, 'src'), { recursive: true });
  cpSync(path.join(afterRoot, 'package.json'), path.join(dir, 'package.json'));
  if (existsSync(path.join(afterRoot, 'tsconfig.json'))) cpSync(path.join(afterRoot, 'tsconfig.json'), path.join(dir, 'tsconfig.json'));
  const f = path.join(dir, 'src/characters/hamburger.ts');
  const src = readFileSync(f, 'utf8');
  // hamburger's upper-arm call site: `size.len * 0.32` is the `rise`.
  if (!src.includes('size.len * 0.32')) throw new Error('mutant: hamburger upper-arm rise literal not found');
  writeFileSync(f, src.replace('size.len * 0.32', 'size.len * 0.320001'));
  return dir;
}

// ── main ─────────────────────────────────────────────────────────────────────
const beforeRoot = path.resolve(arg('--before', ''));
const afterRoot = path.resolve(arg('--after', REPO));
if (!existsSync(path.join(beforeRoot, 'src/characters/rig.ts'))) {
  console.error('usage: --before <repo root>  [--after <repo root>]');
  process.exit(2);
}

const selftest = flag('--selftest');
let failures = 0;

console.log(`before: ${beforeRoot}`);
console.log(`after : ${afterRoot}`);
console.log(`chars : ${CHARS.join(', ')}`);

const A = (await dumpRoot(beforeRoot, CHARS)).out;

// SELF-PAIR — the drift control. Must be 0, or nothing below means anything.
const A2 = (await dumpRoot(beforeRoot, CHARS)).out;
const selfBad = report('SELF-PAIR CONTROL (before vs before) — must be 0.000', compare(A, A2, CHARS), CHARS);
if (selfBad) { console.error('\n🔴 SELF-PAIR FAILED — the harness is not deterministic; every number below is void.'); process.exit(1); }
console.log('  ✅ self-pair 0 differing floats on all ' + CHARS.length);

// POISON — the comparator must be able to see a 1-ulp move.
{
  const P = JSON.parse(JSON.stringify(A));
  const site = poison(P, CHARS);
  const res = compare(A, P, CHARS);
  const ok = res[CHARS[0]].nDiff === 1;
  console.log(`\n── POISON CONTROL (1 ulp on ${site}) ${'─'.repeat(10)}`);
  console.log(`  ${ok ? '✅' : '🔴'} comparator reports ${res[CHARS[0]].nDiff} differing float(s) — required exactly 1`);
  if (!ok) { console.error('🔴 POISON CONTROL FAILED — a comparator that cannot see a diff proves nothing.'); process.exit(1); }
}

const B = (await dumpRoot(afterRoot, CHARS)).out;
failures += report('MIGRATION A/B (before vs after) — the acceptance test', compare(A, B, CHARS), CHARS);

if (selftest) {
  const mutantRoot = makeMutant(afterRoot);
  const M = (await dumpRoot(mutantRoot, CHARS)).out;
  const res = compare(A, M, CHARS);
  const mBad = report('MUTANT CONTROL (hamburger rise 0.32 -> 0.320001) — hamburger MUST differ', res, CHARS);
  const ok = res.hamburger && res.hamburger.nDiff > 0 &&
    CHARS.filter((c) => c !== 'hamburger').every((c) => res[c].nDiff === 0);
  console.log(`  ${ok ? '✅' : '🔴'} exactly hamburger differs (${res.hamburger?.nDiff} floats), other ${CHARS.length - 1} identical`);
  if (!ok) { console.error('🔴 MUTANT CONTROL FAILED — a mistyped call-site argument would go unnoticed.'); process.exit(1); }
  void mBad;
}

console.log(failures === 0
  ? `\n✅ PASS — all ${CHARS.length} characters byte-identical across the migration.`
  : `\n🔴 FAIL — ${failures} character(s) moved. Name the vertex and why, or revert.`);
process.exit(failures === 0 ? 0 : 1);
