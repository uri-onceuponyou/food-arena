#!/usr/bin/env node
/**
 * CZ SHEET — the before/after contact sheet for the concealment canopy.
 *
 * Two directories of `cz_shot.mjs` stations, paired station-by-station, BEFORE on the
 * left and AFTER on the right, with the station id and pitch burned in. Nothing here is
 * a measurement; it exists so a human (or a critic) sees the two frames side by side
 * instead of alternating between two folders and remembering.
 *
 * 🚨 It refuses to pair anything it cannot pair. A sheet that silently drops a station
 * is the `[].every()` failure with pictures — it would look complete and be a subset.
 *
 *   node tools/tmp/cz_sheet.mjs --before tools/tmp/cz_before --after tools/tmp/cz_after_final \
 *     --out tools/tmp/cz_sheet.png
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const A = String(args.before ?? 'tools/tmp/cz_before');
const B = String(args.after ?? 'tools/tmp/cz_after_final');
const OUT = String(args.out ?? 'tools/tmp/cz_sheet.png');
const CW = Number(args.cell ?? 700);

const manA = JSON.parse(await readFile(`${A}/manifest.json`, 'utf8'));
const manB = JSON.parse(await readFile(`${B}/manifest.json`, 'utf8'));
const ids = manA.rows.map((r) => r.id).filter((id) => manB.rows.some((r) => r.id === id));
const missing = manA.rows.map((r) => r.id).filter((id) => !ids.includes(id));
if (missing.length) { console.error('cz_sheet: unpaired stations', missing); process.exit(2); }
if (ids.length === 0) { console.error('cz_sheet: ZERO paired stations'); process.exit(2); }

const first = await sharp(`${A}/${ids[0]}.png`).metadata();
const CH = Math.round((first.height / first.width) * CW);
const HDR = 34;
const W = CW * 2, H = (CH + HDR) * ids.length;

const layers = [];
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  for (const [dir, col, tag] of [[A, 0, 'BEFORE'], [B, CW, 'AFTER']]) {
    const p = `${dir}/${id}.png`;
    if (!existsSync(p)) { console.error('cz_sheet: missing', p); process.exit(2); }
    layers.push({ input: await sharp(p).resize(CW, CH).toBuffer(), left: col, top: i * (CH + HDR) + HDR });
  }
  const row = manA.rows.find((r) => r.id === id);
  const svg = `<svg width="${W}" height="${HDR}"><rect width="${W}" height="${HDR}" fill="#14161c"/>` +
    `<text x="10" y="23" font-family="monospace" font-size="17" fill="#f2b134">${id}</text>` +
    `<text x="150" y="23" font-family="monospace" font-size="15" fill="#9aa4b2">pitch ${row.pitch}  ·  ${String(row.note).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>` +
    // ⚠️ **THIS WAS THE LITERAL `c471efe` FOR A ROUND.** A sheet is read by a critic who
    // cannot see the tree, so a hardcoded SHA on a re-run silently mislabels which commit
    // the left column is — the `--ref`-pinned-A/B failure (`AGENT-BRIEF §3`) with pictures.
    `<text x="${CW - 200}" y="23" font-family="monospace" font-size="15" fill="#7fd1ae">BEFORE ${String(args.beforesha ?? '(unlabelled)')}</text>` +
    `<text x="${W - 190}" y="23" font-family="monospace" font-size="15" fill="#7fd1ae">AFTER  ${String(args.sha ?? '')}</text></svg>`;
  layers.push({ input: Buffer.from(svg), left: 0, top: i * (CH + HDR) });
}

await sharp({ create: { width: W, height: H, channels: 3, background: '#14161c' } })
  .composite(layers).png().toFile(OUT);
console.log(`cz_sheet: ${ids.length} paired stations -> ${OUT} (${W}x${H})`);
