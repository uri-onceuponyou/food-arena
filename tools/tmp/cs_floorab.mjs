#!/usr/bin/env node
/**
 * WHICH FLOOR-LEVEL SOURCE SURVIVES THE ABLATION TEST?
 *
 * `cs_charcontact.mjs --ours` needs a floor level, and the answer is decided by the
 * known-bad input rather than by taste: on the ABLATED frame — the same scene with
 * the character's cast shadow off and nothing else moved — the correct floor source
 * must return coreDL ~ 0. A source that returns 0.48 there is not measuring a shadow.
 *
 *   node tools/tmp/cs_floorab.mjs shots/contact/before/ours.json
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { measure } from './cs_charcontact.mjs';

const rows = JSON.parse(await readFile(process.argv[2] ?? 'shots/contact/before/ours.json', 'utf8')).filter((r) => r.kind === 'char');
const dir = (process.argv[2] ?? 'shots/contact/before/ours.json').replace(/\/[^/]+$/, '');
console.log('station    source            shipped   ABLATED   delta   floorL');
for (const r of rows) {
  const st = r.plate.replace(':', '_');
  const A = await sharp(`${dir}/${st}__shipped.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(`${dir}/${st}__ablated.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = A.info.width, H = A.info.height;
  for (const [name, opts] of [['hand rect', { floorRect: r.floorRect }], ['annulus 2.6-6.0', {}]]) {
    const s = measure(A.data, W, H, r.ellipse, r.shadowDeg, opts);
    const b = measure(B.data, W, H, r.ellipse, r.shadowDeg, opts);
    console.log(`${r.plate.padEnd(10)} ${name.padEnd(17)} ${s.shadeCoreDL.toFixed(4).padStart(8)} ${b.shadeCoreDL.toFixed(4).padStart(9)} ${(s.shadeCoreDL - b.shadeCoreDL).toFixed(4).padStart(7)} ${s.floorL.toFixed(4).padStart(8)}  opp ${s.oppCoreDL.toFixed(4)}/${b.oppCoreDL.toFixed(4)}  fSpread ${s.floorSpread.toFixed(4)}`);
  }
}
