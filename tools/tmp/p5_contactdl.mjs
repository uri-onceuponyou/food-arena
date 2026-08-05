#!/usr/bin/env node
/**
 * p5_contactdl — the CONTACT-LOCAL value step at a part boundary, printed next to the
 * whole-part median step that `weakBoundaryPct` actually gates on.
 *
 * `valuelib.vlAdjacency` reports `dL = |p50(A) - p50(B)|`. `tools/tmp/p5_dlprobe.mjs`
 * proves by construction that this is wrong in BOTH directions once a part is not
 * roughly uniform (a hard 0.40 step reported as 0.000; a seamless ramp reported as
 * 0.400). This asks how much of that error is LIVE on the cast.
 *
 * No browser. `valuescan --mode chars` already wrote, per character and yaw:
 *   <tag>.parts.png   one PALETTE colour per owning joint, from the MERGED single-owner
 *                     map, nearest-neighbour upscaled by an integer factor
 *   <tag>.value.png   the same crop's luma as 8-bit grey; 20/0/30 outside the matte
 * Undo the integer upscale and the owner map is exact (lossless PNG) and the luma is
 * exact to 1/255 = 0.0039.
 *
 * ── HOW IT IS VALIDATED, per pair, against a known answer ────────────────────
 *  1. OWNER MAP. The recovered 4-neighbour contact count must equal `contacts` in
 *     `chars.json` EXACTLY. `vlAdjacency` counts contacts on the same merged map, so an
 *     exact match proves the recovery pixel-for-pixel. A pair that does not match is
 *     REFUSED, never printed with a number.
 *  2. LUMA. For every part that survives the merge intact (>= 97% of its own mask), the
 *     re-derived p50 must reproduce `chars.json`'s to within 0.006.
 *
 * ⚠️ `chars.json`'s per-part `px`/`p50` come from the UNMERGED per-group masks, which
 * overlap; the contacts come from the MERGED map where a later joint overwrites an
 * earlier one. That is a real inconsistency inside `vlAdjacency`, not a recovery error,
 * and it is why the `keep%` column exists: pizza's `face` owns 16 px of its own mask and
 * 8 of them survive the merge, so its p50 describes pixels that are not on screen.
 *
 * READ-ONLY probe. Reads two PNGs and a JSON; writes nothing.
 *
 * Usage: node tools/tmp/p5_contactdl.mjs <chars.json> <id> [yawTag=ss.yaw90]
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const [charsPath, ID, TAG = 'ss.yaw90'] = process.argv.slice(2);
if (!charsPath || !ID) { console.error('usage: p5_contactdl.mjs <chars.json> <id> [yawTag]'); process.exit(2); }
const chars = JSON.parse(readFileSync(charsPath, 'utf8'));
const dir = join(dirname(charsPath), 'chars');
const src = chars[ID].ss;
const names = src.parts.map((p) => p.part);

const PAL = [[255, 80, 80], [80, 255, 120], [90, 150, 255], [255, 220, 60], [255, 120, 255],
  [80, 230, 230], [255, 160, 40], [160, 100, 255], [120, 255, 60], [255, 60, 160],
  [60, 200, 160], [200, 200, 200], [140, 90, 40], [40, 90, 140], [240, 140, 140],
  [90, 240, 200], [200, 90, 240]];

const P = await sharp(join(dir, `${ID}.${TAG}.parts.png`)).raw().toBuffer({ resolveWithObject: true });
const V = await sharp(join(dir, `${ID}.${TAG}.value.png`)).raw().toBuffer({ resolveWithObject: true });
if (P.info.width !== V.info.width || P.info.height !== V.info.height) { console.error('size mismatch'); process.exit(2); }
const [, , cw, ch] = src.crop;
const scale = P.info.width / cw;
if (!Number.isInteger(scale) || P.info.height / ch !== scale) { console.error(`non-integer upscale ${scale}`); process.exit(2); }

const owner = new Int16Array(cw * ch).fill(-1);
const luma = new Float64Array(cw * ch).fill(NaN);
const pc = P.info.channels, vc = V.info.channels;
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const s = (y * scale) * P.info.width + x * scale;
  const r = P.data[s * pc], g = P.data[s * pc + 1], b = P.data[s * pc + 2];
  if (r === 24 && g === 24 && b === 30) continue;
  const idx = PAL.findIndex((c) => c[0] === r && c[1] === g && c[2] === b);
  if (idx < 0) continue;
  owner[y * cw + x] = idx;
  const vr = V.data[s * vc], vg = V.data[s * vc + 1], vb = V.data[s * vc + 2];
  if (vr === 20 && vg === 0 && vb === 30) continue;
  luma[y * cw + x] = vr / 255;
}

const q = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const byPart = names.map(() => []);
for (let j = 0; j < cw * ch; j++) { const o = owner[j]; if (o >= 0 && o < names.length && Number.isFinite(luma[j])) byPart[o].push(luma[j]); }

console.log(`# ${ID} ${TAG}  crop ${cw}x${ch} upscale x${scale}  tree ${chars.__meta ? chars.__meta.srcId : 'META ABSENT — UNQUOTABLE'}`);
console.log('part          px(json)  px(merged)  keep    p50(json)  p50(rec)     d    luma check');
let lumaChecked = 0, lumaBad = 0;
for (let i = 0; i < names.length; i++) {
  const j = src.parts[i];
  if (!j.px) continue;
  const keep = byPart[i].length / j.px;
  const rec = q(byPart[i], 0.5);
  const d = rec == null ? NaN : Math.abs(rec - j.p50);
  let verdict = 'n/a (merged away)';
  if (keep >= 0.97) { lumaChecked++; const ok = Number.isFinite(d) && d <= 0.006; if (!ok) lumaBad++; verdict = ok ? 'OK' : '** LUMA MISMATCH'; }
  console.log(`${names[i].padEnd(12)} ${String(j.px).padStart(7)} ${String(byPart[i].length).padStart(10)} ${(100 * keep).toFixed(1).padStart(6)}%   ${String(j.p50).padStart(7)}  ${(rec == null ? '—' : rec.toFixed(4)).padStart(7)}  ${(Number.isFinite(d) ? d.toFixed(4) : '—').padStart(6)}  ${verdict}`);
}
console.log(`luma recovery: ${lumaChecked - lumaBad}/${lumaChecked} parts reproduce chars.json's p50 within 0.006 (8-bit floor 0.0039)`);
if (lumaBad) { console.error('\n✗ REFUSED — the luma channel did not round-trip.'); process.exit(1); }

const acc = new Map();
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const j = y * cw + x, o = owner[j];
  if (o < 0) continue;
  for (const k of [x < cw - 1 ? j + 1 : -1, y < ch - 1 ? j + cw : -1]) {
    if (k < 0) continue;
    const p = owner[k];
    if (p < 0 || p === o) continue;
    const a = Math.min(o, p), b = Math.max(o, p);
    const key = `${a}:${b}`;
    let e = acc.get(key); if (!e) { e = { n: 0, sa: 0, ca: 0, sb: 0, cb: 0 }; acc.set(key, e); }
    e.n++;
    const mine = o === a;
    if (Number.isFinite(luma[j])) { if (mine) { e.sa += luma[j]; e.ca++; } else { e.sb += luma[j]; e.cb++; } }
    if (Number.isFinite(luma[k])) { if (mine) { e.sb += luma[k]; e.cb++; } else { e.sa += luma[k]; e.ca++; } }
  }
}

console.log('\npair                    contacts  rec  dL(p50)  dLcontact   |diff|   verdict @0.10');
let flips = 0;
for (const p of (src.adjacent ?? []).slice().sort((x, y) => y.contacts - x.contacts)) {
  const ai = names.indexOf(p.a), bi = names.indexOf(p.b);
  const e = acc.get(`${Math.min(ai, bi)}:${Math.max(ai, bi)}`);
  const rec = e ? e.n : 0;
  if (rec !== p.contacts) {
    console.log(`${(p.a + '|' + p.b).padEnd(24)} ${String(p.contacts).padStart(6)} ${String(rec).padStart(5)}   ${p.dL.toFixed(4).padStart(7)}   REFUSED — recovered contact count != chars.json's`);
    continue;
  }
  const dc = Math.abs(e.sa / e.ca - e.sb / e.cb);
  const vP = p.dL < 0.10, vC = dc < 0.10;
  if (vP !== vC) flips++;
  console.log(`${(p.a + '|' + p.b).padEnd(24)} ${String(p.contacts).padStart(6)} ${String(rec).padStart(5)}   ${p.dL.toFixed(4).padStart(7)}   ${dc.toFixed(4).padStart(8)}   ${Math.abs(dc - p.dL).toFixed(4).padStart(6)}   p50=${vP ? 'WEAK' : 'ok  '} contact=${vC ? 'WEAK' : 'ok  '}${vP !== vC ? '   <-- VERDICT FLIPS' : ''}`);
}
console.log(`\n${flips} pair(s) get a DIFFERENT verdict from the contact-local step than from the median step.`);
