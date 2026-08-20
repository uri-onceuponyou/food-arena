#!/usr/bin/env node
/**
 * qv1_bbox — the subject bounding box `charStage.applyFraming()` actually reads, per
 * tree root, WITH ABLATION so one edit inside a two-edit commit can be isolated.
 *
 * WHY THIS IS THE QUESTION. `charStage.ts:932` sets `subjectH = box.max.y - box.min.y`
 * from `new THREE.Box3().setFromObject(model.root)`, and `applyFraming()` turns that
 * into `rig.subjectHeight` / `subjectFill`. So the subject's own bounding box decides
 * how large the character is DRAWN in a fixed panel. A taller model is a SMALLER
 * character on the same canvas — which is a real mechanism for "the character screen
 * seems like the resolution is slightly lower" that has nothing to do with pixel ratio.
 *
 * ABLATION IS THE ISOLATION. `062513c` edits the brows and the head pick together. The
 * brows are decals on the face and cannot touch `max.y`; the pick is the topmost thing
 * on the model. Recomputing the box with every `pick*` mesh removed answers "is the
 * pick what moved the box" without needing the two edits split in source.
 *
 * VALIDATION (rule 6): `--selftest`
 *   A NON-EMPTY   the mesh set and the ablated set are both asserted non-empty before
 *                 any box is taken. An empty set yields an empty Box3, whose height is
 *                 -Infinity or 0 depending on the path — a number, and a lie.
 *   B DRIFT       the same root measured twice must be EXACTLY equal.
 *   C KNOWN-BAD   ablating the topmost mesh MUST lower `max.y`. If it does not, the
 *                 ablation is not reaching the mesh and every isolated number is noise.
 *   D POINTING    the ablation filter must actually match something (>0 meshes removed),
 *                 else it is a filter over an empty set and `[].every()` is true.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const flag = (k) => argv.includes(k);

function buildFrom(root) {
  const dir = mkdtempSync(path.join(tmpdir(), 'qv1b-'));
  const entry = path.join(dir, 'entry.ts');
  writeFileSync(entry, [
    `export { createCharacter } from ${JSON.stringify(path.join(root, 'src/characters/registry'))};`,
    `export * as THREE from 'three';`,
  ].join('\n'));
  const out = path.join(dir, 'bundle.mjs');
  const esbuild = path.join(root, 'node_modules/.bin/esbuild');
  if (!existsSync(esbuild)) throw new Error(`esbuild not found under --root ${root}`);
  execFileSync(esbuild, [entry, '--bundle', '--format=esm', '--platform=node',
    `--alias:three=${path.join(root, 'node_modules/three')}`,
    `--outfile=${out}`, '--log-level=error'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  return { out, dir };
}

/**
 * @param ablate  RegExp; meshes whose name matches are made invisible AND detached, so
 *                `setFromObject` — which walks the graph, not the visible set — cannot
 *                still include them. Setting `.visible = false` alone does NOT shrink a
 *                Box3, which is exactly the kind of vacuous ablation this project keeps
 *                catching (a control that changes nothing reads as "no effect").
 */
export async function boxOf(root, id, ablate = null) {
  const { out, dir } = buildFrom(root);
  const ow = console.warn, ol = console.log;
  console.warn = () => {}; console.log = (...a) => { const s = a.join(' '); if (!s.startsWith('[')) ol(...a); };
  try {
    const mod = await import('file://' + out + '?v=' + Date.now());
    const THREE = mod.THREE;
    const model = mod.createCharacter(id);
    let total = 0, removed = 0;
    if (ablate) {
      const kill = [];
      model.root.traverse((o) => { if (o.isMesh) { total++; if (ablate.test(o.name || '')) kill.push(o); } });
      for (const o of kill) { o.parent.remove(o); removed++; }
    } else {
      model.root.traverse((o) => { if (o.isMesh) total++; });
    }
    model.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model.root);
    // Which named mesh owns the top of the box — the thing framing is fitting to.
    let topName = '(none)', topY = -Infinity;
    model.root.traverse((o) => {
      if (!o.isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.max.y > topY) { topY = b.max.y; topName = o.name || '(unnamed)'; }
    });
    // `charStage.ts:939` does NOT use the raw box width: `subjectW` is TWICE the largest
    // offset from the camera axis, over x AND z, because the portrait sways +/-22 deg
    // and a shallow-but-wide character presents its depth at the extremes. Reproduced
    // here rather than approximated with `box.max.x - box.min.x`, which would be a
    // different number and would answer a question framing never asks.
    const subjectW = 2 * Math.max(0.25,
      Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
    return {
      meshes: total, removed,
      minY: box.min.y, maxY: box.max.y, h: box.max.y - box.min.y,
      subjectW, topName, topY,
    };
  } finally {
    console.warn = ow; console.log = ol;
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
  }
}

async function selftest() {
  const before = arg('--before'), after = arg('--after'), id = arg('--character', 'hamburger');
  if (!before || !after) { console.error('selftest needs --before and --after'); process.exit(2); }
  let fails = 0;
  const ok = (t, c, d) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${t}${d ? '  ' + d : ''}`); if (!c) fails++; };

  const full = await boxOf(after, id);
  ok('A non-empty mesh set', full.meshes > 0, `${full.meshes} meshes`);
  ok('A finite box', Number.isFinite(full.h) && full.h > 0, `h=${full.h.toFixed(4)}`);

  const full2 = await boxOf(after, id);
  ok('B drift = 0', JSON.stringify(full) === JSON.stringify(full2));

  // §D POINTING — the ablation must remove something, or it is a filter over nothing.
  // ⚠️ AND IT MUST REMOVE THE `__outline` SIBLING TOO. The first cut of this arm matched
  // `^pick_rod$` exactly, removed 1 mesh, reported `removed > 0` — and `maxY` did not
  // move, because every solid here carries an inverted-hull `<name>__outline` that is
  // very slightly LARGER and was still holding the top of the box. The ablation looked
  // successful (1 mesh gone, non-empty set, no error) and isolated nothing. That is the
  // vacuity class this file's header is about: a control that changes nothing is
  // indistinguishable from a change that does nothing. Left in as the reason for the
  // `(__outline)?` group rather than silently corrected.
  const base = full.topName.replace(/__outline$/, '');
  const topRe = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(__outline)?$');
  const abl = await boxOf(after, id, topRe);
  ok('D ablation matched meshes', abl.removed > 0, `removed ${abl.removed} (${full.topName})`);
  ok('D ablated set still non-empty', abl.meshes - abl.removed > 0);

  // §C KNOWN-BAD — removing the TOPMOST mesh must LOWER max.y. If it does not, the
  //   ablation is not reaching the graph and every isolated number below is noise.
  ok('C known-bad: top ablation lowers maxY', abl.maxY < full.maxY,
    `${full.maxY.toFixed(4)} -> ${abl.maxY.toFixed(4)}`);

  const b = await boxOf(before, id);
  ok('A before arm non-empty', b.meshes > 0, `${b.meshes} meshes`);

  console.log(fails === 0 ? 'SELFTEST 7/7 PASS' : `SELFTEST ${7 - fails}/7 — ${fails} FAIL`);
  process.exit(fails === 0 ? 0 : 1);
}

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (IS_MAIN) {
  if (flag('--selftest')) { await selftest(); }
  else {
    const before = arg('--before'), after = arg('--after'), id = arg('--character', 'hamburger');
    const ablStr = arg('--ablate', null);
    if (!before || !after) { console.error('usage: --before <root> --after <root> [--ablate <regex>] [--character id]'); process.exit(2); }
    const re = ablStr ? new RegExp(ablStr) : null;
    const b = await boxOf(before, id, re), a = await boxOf(after, id, re);
    if (b.meshes === 0 || a.meshes === 0) { console.error('EXIT 3: empty mesh set'); process.exit(3); }
    if (re && (b.removed === 0 || a.removed === 0)) {
      console.error(`EXIT 3: --ablate /${ablStr}/ matched nothing on one arm (before ${b.removed}, after ${a.removed}) — a filter over an empty set proves nothing`);
      process.exit(3);
    }
    const f = (n) => n.toFixed(5);
    console.log(`character ${id}${re ? `   ABLATING /${ablStr}/ (removed ${b.removed} -> ${a.removed})` : ''}`);
    console.log(`${''.padEnd(10)} ${'minY'.padEnd(11)} ${'maxY'.padEnd(11)} ${'height'.padEnd(11)} top mesh`);
    console.log(`${'BEFORE'.padEnd(10)} ${f(b.minY).padEnd(11)} ${f(b.maxY).padEnd(11)} ${f(b.h).padEnd(11)} ${b.topName} @ ${f(b.topY)}`);
    console.log(`${'AFTER'.padEnd(10)} ${f(a.minY).padEnd(11)} ${f(a.maxY).padEnd(11)} ${f(a.h).padEnd(11)} ${a.topName} @ ${f(a.topY)}`);
    const dh = a.h - b.h;
    console.log(`\nsubjectH  ${f(b.h)} -> ${f(a.h)}   d=${dh >= 0 ? '+' : ''}${f(dh)}  (${(100 * dh / b.h).toFixed(3)}%)`);
    const dw = a.subjectW - b.subjectW;
    console.log(`subjectW  ${f(b.subjectW)} -> ${f(a.subjectW)}   d=${dw >= 0 ? '+' : ''}${f(dw)}  (${(100 * dw / b.subjectW).toFixed(3)}%)`);
    // `applyFraming()`: h' = subjectH + PLINTH_H, w' = max(subjectW, PLINTH_BASE_W);
    // fill = clamp(min(V_FILL, H_FILL*aspect*h'/w'), 0.2, V_FILL). The SIGN is what
    // matters here: a SHORTER subject fills the same panel at a LARGER on-screen scale.
    console.log(dh === 0 ? 'subjectH IDENTICAL — framing cannot have moved from it.'
      : dh < 0 ? 'subjectH SHRANK -> the character is drawn LARGER in the same panel.'
        : 'subjectH GREW -> the character is drawn SMALLER in the same panel.');
  }
}
