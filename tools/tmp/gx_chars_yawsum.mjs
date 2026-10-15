#!/usr/bin/env node
/**
 * GX_CHARS_YAWSUM — summarise `gx_chars_yaw.mjs`'s yaw.json into the tables the audit
 * report quotes. Offline. Refuses if the probe's own controls did not pass.
 *
 *   node tools/tmp/gx_chars_yawsum.mjs shots/rv/audit/chars/cap/yaw/yaw.json
 */
import { readFile } from 'node:fs/promises';

const file = process.argv[2] ?? 'shots/rv/audit/chars/cap/yaw/yaw.json';
const J = JSON.parse(await readFile(file, 'utf8'));
const c = J.controls;
if (!c || !c.nonEmpty || !c.emptyOk || !c.facesOk || !c.moves) {
  console.log('REFUSED: probe controls did not pass', JSON.stringify(c));
  process.exit(1);
}
console.log('controls', JSON.stringify(c));
const ids = Object.keys(J.all);

// 1. facing robustness at the MATCH pitch
console.log('\nA. MATCH PITCH 58 — face / head / total px by facing (yaw 0 = facing the camera)');
console.log('  id            face@0  face@90  face@180 | faceVisibleShare | head@0  head@90  minHead/maxHead | total@0 total@90');
const rowsA = [];
for (const id of ids) {
  const cells = J.all[id].cells.filter((x) => x.pitch === 58);
  const at = (y) => cells.find((x) => x.yaw === y);
  const f0 = at(0).face;
  const vis = cells.filter((x) => x.face >= 0.15 * f0).length / cells.length;
  const heads = cells.map((x) => x.head);
  const tot = (x) => x.face + x.head + x.body;
  const r = { id, f0, f90: at(90).face, f180: at(180).face, vis, h0: at(0).head, h90: at(90).head,
    headRatio: Math.min(...heads) / Math.max(...heads), t0: tot(at(0)), t90: tot(at(90)) };
  rowsA.push(r);
  console.log(`  ${id.padEnd(12)} ${String(r.f0).padStart(7)} ${String(r.f90).padStart(8)} ${String(r.f180).padStart(9)} | ${(r.vis * 100).toFixed(0).padStart(5)}% of 8 yaws | ${String(r.h0).padStart(6)} ${String(r.h90).padStart(8)}  ${r.headRatio.toFixed(2).padStart(6)}          | ${String(r.t0).padStart(7)} ${String(r.t90).padStart(7)}`);
}
const tmax = Math.max(...rowsA.map((r) => r.t0));
console.log('  total@0 as % of largest: ' + rowsA.map((r) => `${r.id} ${(r.t0 / tmax * 100).toFixed(0)}%`).join(' · '));

// 2. lobby pitch
console.log('\nB. LOBBY PITCH 20 — face px and face share of silhouette at yaw 0 / 35-ish (45)');
for (const id of ids) {
  const cells = J.all[id].cells.filter((x) => x.pitch === 20);
  const at = (y) => cells.find((x) => x.yaw === y);
  const tot = (x) => x.face + x.head + x.body;
  console.log(`  ${id.padEnd(12)} face@0 ${String(at(0).face).padStart(6)} (${(at(0).face / tot(at(0)) * 100).toFixed(1)}% of silhouette)  face@45 ${String(at(45).face).padStart(6)}  head share ${(at(0).head / tot(at(0)) * 100).toFixed(0)}%  body share ${(at(0).body / tot(at(0)) * 100).toFixed(0)}%`);
}

// 3. census
console.log('\nC. RENDER CENSUS per fighter (rest pose, preview)');
console.log('  id            meshes  hulls  visible  shadowCasters   tris   materials  types');
let sumVis = 0, sumCast = 0;
for (const id of ids) {
  const s = J.all[id].census;
  sumVis += s.visibleMeshes; sumCast += s.shadowCasters;
  console.log(`  ${id.padEnd(12)} ${String(s.meshes).padStart(6)} ${String(s.hulls).padStart(6)} ${String(s.visibleMeshes).padStart(8)} ${String(s.shadowCasters).padStart(14)} ${String(s.tris).padStart(7)} ${String(s.materials).padStart(10)}  ${JSON.stringify(s.types)}`);
}
console.log(`  mean visible meshes per fighter ${(sumVis / ids.length).toFixed(1)} · mean shadow casters ${(sumCast / ids.length).toFixed(1)}`);

// 4. colour
console.log('\nD. COLOUR on the character\'s own lit pixels (direct render, no post), chromatic = HSL s>=0.15');
for (const p of [58, 20]) {
  console.log(`  pitch ${p}:  id            px      chrom%  meanL  meanS   dominant 30deg window (share of chromatic)   2nd window`);
  for (const id of ids) {
    const col = J.all[id].colour[p];
    const h = col.hist; const n = h.reduce((a, b) => a + b, 0) || 1;
    const win = (s) => h[s % 36] + h[(s + 1) % 36] + h[(s + 2) % 36];
    let best = 0, at = 0; for (let s = 0; s < 36; s++) if (win(s) > best) { best = win(s); at = s; }
    // second window not overlapping the first
    let best2 = 0, at2 = 0; for (let s = 0; s < 36; s++) { const d = Math.min(Math.abs(s - at), 36 - Math.abs(s - at)); if (d < 3) continue; if (win(s) > best2) { best2 = win(s); at2 = s; } }
    console.log(`            ${id.padEnd(12)} ${String(col.px).padStart(7)} ${(col.chromShare * 100).toFixed(0).padStart(6)}% ${col.meanL.toFixed(3)}  ${col.meanS.toFixed(3)}   ${String(at * 10).padStart(3)}-${String(at * 10 + 30).padEnd(3)} ${(best / n * 100).toFixed(0).padStart(3)}%                          ${String(at2 * 10).padStart(3)}-${String(at2 * 10 + 30).padEnd(3)} ${(best2 / n * 100).toFixed(0).padStart(3)}%`);
  }
}
