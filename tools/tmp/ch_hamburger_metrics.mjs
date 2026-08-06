#!/usr/bin/env node
/**
 * ch_hamburger_metrics — the numbers I need to size a face, offline, with no GPU.
 *
 * OWNED BY THE HAMBURGER AGENT (`tools/tmp/ch_hamburger_*`). Read-only on `src/`.
 *
 * Everything here is pure scene-graph geometry, so `rg_lib`'s node harness answers it
 * exactly — `docs/LESSONS.md` §5: six agents share one SwiftShader GPU, and a question
 * about "how big is the eye against the head" is a question about GEOMETRY.
 */
import { loadCast, captureWarnings, arg } from './rg_lib.mjs';

const ID = arg('--id', 'hamburger');
const { THREE, createCharacter } = await loadCast();

const ch = captureWarnings(() => createCharacter(ID)).value;
const root = ch.root ?? ch.body;
root.updateWorldMatrix(true, true);

const rig = ch.rig;
const m = rig?.metrics ?? {};
console.log(`\n${ID} — rig metrics`);
for (const [k, v] of Object.entries(m)) console.log(`  ${k.padEnd(18)} ${typeof v === 'number' ? v.toFixed(4) : v}`);
console.log(`  headRadius         ${rig.headRadius.toFixed(4)}`);
console.log(`  armClearance       ${(rig.armClearance ?? 0).toFixed(4)}`);

// World-space box of every named mesh, so a decal's real size on the model is a
// measured number rather than a guess about what `faceScale` multiplies out to.
const rows = [];
root.traverse((o) => {
  if (!o.isMesh || /__outline$/.test(o.name)) return;
  const b = new THREE.Box3().setFromObject(o);
  const s = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3());
  rows.push({ name: o.name, w: s.x, h: s.y, d: s.z, cx: c.x, cy: c.y, cz: c.z, top: b.max.y, bot: b.min.y });
});
const want = new Set(String(arg('--parts', 'eye,brow,mouth,crown,patty,cheese,tomato,lettuce_base,bottom_bun_mesh,pelvis_mesh,spatula_blade,spatula_handle,spatula_ferrule,hamburger_lettuce_point,apron_bib')).split(','));
console.log(`\nworld-space boxes (metres)`);
console.log(`  ${'mesh'.padEnd(26)} ${'w'.padStart(7)} ${'h'.padStart(7)} ${'d'.padStart(7)}   ${'cx'.padStart(7)} ${'cy'.padStart(7)} ${'cz'.padStart(7)}`);
const seen = new Map();
for (const r of rows) {
  if (!want.has(r.name)) continue;
  const n = (seen.get(r.name) ?? 0) + 1; seen.set(r.name, n);
  console.log(`  ${(r.name + '#' + n).padEnd(26)} ${r.w.toFixed(4).padStart(7)} ${r.h.toFixed(4).padStart(7)} ${r.d.toFixed(4).padStart(7)}   ${r.cx.toFixed(4).padStart(7)} ${r.cy.toFixed(4).padStart(7)} ${r.cz.toFixed(4).padStart(7)}`);
}

// The whole model box, for the "what fraction of the character is the eye" question.
const all = new THREE.Box3().setFromObject(root);
const sz = all.getSize(new THREE.Vector3());
console.log(`\n  model box            w ${sz.x.toFixed(4)}  h ${sz.y.toFixed(4)}  d ${sz.z.toFixed(4)}   y ${all.min.y.toFixed(4)} .. ${all.max.y.toFixed(4)}`);

// Groups: the leaf events and the spatula, which are Groups not Meshes.
for (const gname of ['hamburger_lettuce_point', 'hamburger_pick', 'spatula']) {
  let i = 0;
  root.traverse((o) => {
    if (o.name !== gname || o.isMesh) return;
    i++;
    const b = new THREE.Box3().setFromObject(o);
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    console.log(`  ${(gname + '#' + i).padEnd(26)} ${s.x.toFixed(4).padStart(7)} ${s.y.toFixed(4).padStart(7)} ${s.z.toFixed(4).padStart(7)}   ${c.x.toFixed(4).padStart(7)} ${c.y.toFixed(4).padStart(7)} ${c.z.toFixed(4).padStart(7)}`);
  });
}
console.log('');
