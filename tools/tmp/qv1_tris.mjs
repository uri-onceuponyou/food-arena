#!/usr/bin/env node
/**
 * qv1_tris — PER-MESH-NAME geometry census of one character, pinned to a TREE ROOT.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT `rg_lib`.
 * `rg_lib.buildBundle()` hardcodes `REPO = <this file>/../..`, so every tool built on
 * it esbuilds the WORKING TREE no matter which commit it claims to be measuring
 * (`docs/AGENT-BRIEF.md` §3 records the trap: a `--ref`-pinned A/B returns
 * byte-identical numbers on both arms and reads exactly like "the change did nothing").
 * This tool takes `--root` and builds from THERE, so a detached worktree is really the
 * thing measured.
 *
 * WHAT IT ANSWERS.
 * A commit census that reports "meshes 226->228, tris 55965->54773" cannot say WHICH
 * edit inside the commit produced the delta. `062513c` changed two unrelated things —
 * the brows and the head pick — so the aggregate is shared evidence and isolates
 * neither. Grouping the same census BY MESH NAME does isolate them, offline and
 * exactly: no renderer, no SwiftShader, no pixel-ratio, nothing to drift.
 *
 * VALIDATION (rule 6). `--selftest` runs four arms, and one of them is a POINTING arm
 * because `--selftest` never validates where a tool aims:
 *   A NON-EMPTY   the mesh set must be non-empty on BOTH roots before any diff is
 *                 taken. `[].every()` is true and an empty census diffs to "no change",
 *                 which is the exact false-negative this whole probe exists to catch.
 *   B DRIFT       the same root censused twice must be BYTE-identical. A non-zero
 *                 number is not believable until zero has been observed on identical
 *                 input (rule 4).
 *   C KNOWN-BAD   plant a change the tool MUST see: delete one named mesh from the
 *                 after-tree census and require the by-name diff to report it. A guard
 *                 not shown to FAIL is not a guard.
 *   D POINTING    the character actually censused must contain the names this run
 *                 reasons about (`pick_rod`), else exit 3 rather than print zeros.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OWN_REPO = path.resolve(HERE, '..', '..');

function buildFrom(root) {
  const dir = mkdtempSync(path.join(tmpdir(), 'qv1-'));
  const entry = path.join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export { createCharacter } from ${JSON.stringify(path.join(root, 'src/characters/registry'))};`,
    `export * as THREE from 'three';`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(root, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found under --root ${root} (symlink node_modules)`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(root, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  return { out, dir };
}

function triCount(geo) {
  if (!geo) return 0;
  if (geo.index) return geo.index.count / 3;
  const p = geo.attributes && geo.attributes.position;
  return p ? p.count / 3 : 0;
}

/** Census one character out of one tree root. Returns rows keyed by mesh name. */
export async function census(root, id) {
  const { out, dir } = buildFrom(root);
  let mod;
  const warns = [];
  const ow = console.warn, ol = console.log;
  console.warn = (...a) => warns.push(a.join(' '));
  console.log = (...a) => { const s = a.join(' '); if (s.startsWith('[')) warns.push(s); else ol(...a); };
  try {
    mod = await import('file://' + out + '?v=' + Date.now());
    const model = mod.createCharacter(id);
    // `createCharacter` returns a CharacterModel (types.ts:44), NOT an Object3D — its
    // scene graph hangs off `.root`. Calling `.traverse` on the model throws, which is
    // a loud failure and therefore a safe one; a tool that silently censused `{}` would
    // report 0 meshes and diff to "no change".
    const obj = model.root;
    if (!obj || typeof obj.traverse !== 'function') throw new Error('model.root is not an Object3D');
    const rows = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      rows.push({ name: o.name || '(unnamed)', tris: triCount(o.geometry), type: o.geometry?.type || '?' });
    });
    return rows;
  } finally {
    console.warn = ow; console.log = ol;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir */ }
  }
}

/** Aggregate rows into a name -> {count, tris} map, sorted for stable serialisation. */
function group(rows) {
  const m = new Map();
  for (const r of rows) {
    const g = m.get(r.name) || { name: r.name, count: 0, tris: 0 };
    g.count += 1; g.tris += r.tris;
    m.set(r.name, g);
  }
  return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function totals(rows) {
  return { meshes: rows.length, tris: rows.reduce((s, r) => s + r.tris, 0) };
}

async function selftest() {
  const before = arg('--before'), after = arg('--after'), id = arg('--character', 'hamburger');
  if (!before || !after) { console.error('selftest needs --before and --after roots'); process.exit(2); }
  let fails = 0;
  const ok = (tag, cond, detail) => {
    console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${tag}${detail ? '  ' + detail : ''}`);
    if (!cond) fails++;
  };
  const rb = await census(before, id), ra = await census(after, id);

  // §A NON-EMPTY, asserted BEFORE any filtered comparison. `[].every()` is true.
  ok('A non-empty before', rb.length > 0, `${rb.length} meshes`);
  ok('A non-empty after', ra.length > 0, `${ra.length} meshes`);

  // §B DRIFT CONTROL — identical input must diff to EXACTLY zero.
  const rb2 = await census(before, id);
  ok('B drift = 0', JSON.stringify(group(rb)) === JSON.stringify(group(rb2)),
    'same root censused twice');

  // §C KNOWN-BAD — plant a deletion the by-name diff MUST report.
  const planted = ra.filter((r) => r.name !== 'pick_rod');
  const sawPlant = planted.length < ra.length &&
    JSON.stringify(group(planted)) !== JSON.stringify(group(ra));
  ok('C known-bad detected', sawPlant, `dropped pick_rod: ${ra.length} -> ${planted.length}`);

  // §D POINTING — the tool must actually be aimed at a character that HAS a head pick,
  //   else every number about the pick is a true statement about nothing.
  const hasPick = ra.some((r) => r.name === 'pick_rod') && rb.some((r) => r.name === 'pick_rod');
  ok('D pointing (pick_rod present both arms)', hasPick);
  if (!hasPick) { console.error('EXIT 3: not pointed at a character with a head pick'); process.exit(3); }

  console.log(fails === 0 ? 'SELFTEST 5/5 PASS' : `SELFTEST ${5 - fails}/5 — ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (IS_MAIN) {
  if (flag('--selftest')) { await selftest(); }
  else {
    const before = arg('--before'), after = arg('--after'), id = arg('--character', 'hamburger');
    if (!before || !after) {
      console.error('usage: qv1_tris.mjs --before <root> --after <root> [--character hamburger] | --selftest');
      process.exit(2);
    }
    const rb = await census(before, id), ra = await census(after, id);
    if (rb.length === 0 || ra.length === 0) { console.error('EXIT 3: empty census — refusing to diff'); process.exit(3); }
    const gb = new Map(group(rb).map((g) => [g.name, g]));
    const ga = new Map(group(ra).map((g) => [g.name, g]));
    const names = [...new Set([...gb.keys(), ...ga.keys()])].sort();
    const tb = totals(rb), ta = totals(ra);
    console.log(`root BEFORE ${before}\nroot AFTER  ${after}\ncharacter   ${id}\n`);
    console.log(`TOTAL  meshes ${tb.meshes} -> ${ta.meshes} (${ta.meshes - tb.meshes >= 0 ? '+' : ''}${ta.meshes - tb.meshes})   tris ${tb.tris} -> ${ta.tris} (${ta.tris - tb.tris})`);
    console.log(`\n${'name'.padEnd(26)} ${'meshes'.padEnd(12)} ${'tris'.padEnd(20)} dTris`);
    let movedTris = 0;
    for (const n of names) {
      const b = gb.get(n) || { count: 0, tris: 0 }, a = ga.get(n) || { count: 0, tris: 0 };
      if (b.count === a.count && b.tris === a.tris) continue;
      movedTris += Math.abs(a.tris - b.tris);
      console.log(`${n.padEnd(26)} ${String(b.count + ' -> ' + a.count).padEnd(12)} ${String(b.tris + ' -> ' + a.tris).padEnd(20)} ${a.tris - b.tris >= 0 ? '+' : ''}${a.tris - b.tris}`);
    }
    if (movedTris === 0) console.log('(no named mesh moved — check that the roots differ)');
  }
}
