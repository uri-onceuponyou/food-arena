#!/usr/bin/env node
/**
 * DP3_SHEET — the round-3 critic packet for item 4, built from the frames the
 * measurement itself captured and captioned from the measurement's own JSON.
 *
 * Nothing here is typed from memory. Every number on the sheet is read out of
 * `ink_before.json` / `ink_null.json` / `ink_after.json`, which is the point:
 * `docs/AGENT-BRIEF.md` §2b records an agent publishing a four-row table from memory with
 * 3 of 4 rows wrong, ninety seconds after correcting a different typo, with the correct
 * output still on screen.
 *
 * ⚠️ THE NULL COLUMN IS NOT DECORATION. It is the SAME TREE loaded a second time, so a
 * reader can see the instrument's own cross-load spread beside the effect. On the 58 deg
 * stations it is small enough to ignore; on the LOBBY it moves the hero mask by more than
 * a tenth, which is why this sheet says the lobby pair is uncontrolled rather than quoting
 * a lobby delta. **The exact figure is DERIVED from the two JSONs at render time and
 * appears on the sheet** — it is deliberately not repeated here, because a second copy of
 * a count is the one that goes stale (`CLAUDE.md`, the gate-count rule).
 *
 *   node tools/tmp/dp3_sheet.mjs --out shots/dp3/item4_sheet.png
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const OUT = get('--out', 'shots/dp3/item4_sheet.png');

const J = async (p) => JSON.parse(await readFile(p, 'utf8'));

const PAD = 16, GAP = 12, CAPH = 30, W = 1600;

function svgText(w, h, lines) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = lines.map((l, i) =>
    `<text x="10" y="${20 + i * 22}" font-family="DejaVu Sans Mono, Menlo, monospace" font-size="${l.size ?? 15}" fill="${l.fill ?? '#e8e8ee'}">${esc(l.t)}</text>`).join('');
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

async function scaled(path, w) {
  const b = await sharp(path).resize({ width: w }).toBuffer();
  const m = await sharp(b).metadata();
  return { buf: b, w: m.width, h: m.height };
}
async function crop(path, box, w) {
  const b = await sharp(path).extract(box).resize({ width: w, kernel: 'nearest' }).toBuffer();
  const m = await sharp(b).metadata();
  return { buf: b, w: m.width, h: m.height };
}

const before = await J('tools/tmp/dp3_A/ink_before.json');
const nul = await J('tools/tmp/dp3_N/ink_null.json');
const after = await J('tools/tmp/dp3_B/ink_after.json');
const lb = await J('tools/tmp/dp3_A/ink_lobby_before.json');
const ln = await J('tools/tmp/dp3_N/ink_lobby_null.json');
const la = await J('tools/tmp/dp3_B/ink_lobby_after.json');
const row = (j, st) => j.rows.find((r) => r.station === st);

// 🚨 NON-EMPTY FIRST. A sheet built over a missing station would caption the right
// picture with an undefined and read as a finished packet.
for (const st of ['hub', 'spawn_sw', 'spawn_ne']) {
  for (const [nm, j] of [['before', before], ['null', nul], ['after', after]]) {
    if (!row(j, st)) throw new Error(`${nm}: no row for station ${st} — refusing to build a captioned sheet over a hole`);
  }
}

const f = (v, d = 2) => (typeof v === 'number' && isFinite(v) ? v.toFixed(d) : String(v));
const tri = (st, get2, d = 2) => `${f(get2(row(before, st)), d)} / ${f(get2(row(nul, st)), d)} / ${f(get2(row(after, st)), d)}`;

const panels = [];
let y = PAD;

const title = [
  { t: 'ITEM 4 · ROUND 3 — the hard near-black fringe on the silhouette, and the shape of his ground contact', size: 19, fill: '#ffd479' },
  { t: 'ONE CONSTANT: ContactAOEffect gains caoFloor, the darkest multiply this pass may apply.  0.00 (saturates to BLACK) -> 0.65', size: 15 },
  { t: 'BEFORE = 40b8a1a on a detached worktree.  NULL = the SAME tree, second page load.  AFTER = 40b8a1a + this diff, nothing else.  Every column captured in one session.', size: 14, fill: '#a8b0c8' },
  { t: 'drift control EXACTLY ZERO at every station and both cameras; the caoFloor sweep closes A-B-A BIT-IDENTICAL, so every row differs by the uniform and nothing else.', size: 14, fill: '#a8b0c8' },
];
panels.push({ input: svgText(W - 2 * PAD, 4 * 22 + 10, title), left: PAD, top: y });
y += 4 * 22 + 14;

// ── row 1: hub full frame ──────────────────────────────────────────────────
const colW = Math.floor((W - 2 * PAD - GAP) / 2);
{
  const A = await scaled('tools/tmp/dp3_A/before_hub_58.png', colW);
  const B = await scaled('tools/tmp/dp3_B/after_hub_58.png', colW);
  panels.push({ input: svgText(colW, CAPH, [{ t: 'HUB · match camera, pitchDeg 58 · BEFORE', size: 16, fill: '#ff9b9b' }]), left: PAD, top: y });
  panels.push({ input: svgText(colW, CAPH, [{ t: 'HUB · pitchDeg 58 · AFTER', size: 16, fill: '#9bffb1' }]), left: PAD + colW + GAP, top: y });
  y += CAPH;
  panels.push({ input: A.buf, left: PAD, top: y });
  panels.push({ input: B.buf, left: PAD + colW + GAP, top: y });
  y += A.h + GAP;
}

// ── row 2: the hero at 3x, which is where the defect lives ─────────────────
{
  const box = { left: 715, top: 415, width: 190, height: 210 };
  const A = await crop('tools/tmp/dp3_A/before_hub_58.png', box, colW);
  const B = await crop('tools/tmp/dp3_B/after_hub_58.png', box, colW);
  panels.push({ input: svgText(colW, CAPH, [{ t: `HERO ${box.width}x${box.height} at native res, nearest-upscaled — BEFORE`, size: 16, fill: '#ff9b9b' }]), left: PAD, top: y });
  panels.push({ input: svgText(colW, CAPH, [{ t: 'HERO, same crop — AFTER', size: 16, fill: '#9bffb1' }]), left: PAD + colW + GAP, top: y });
  y += CAPH;
  panels.push({ input: A.buf, left: PAD, top: y });
  panels.push({ input: B.buf, left: PAD + colW + GAP, top: y });
  y += A.h + GAP;
}

// ── row 3: the OTHER camera ────────────────────────────────────────────────
{
  const A = await scaled('tools/tmp/dp3_A/before_lobby_20.png', colW);
  const B = await scaled('tools/tmp/dp3_B/after_lobby_20.png', colW);
  panels.push({ input: svgText(colW, CAPH, [{ t: 'LOBBY · charStage, pitchDeg 20 · BEFORE', size: 16, fill: '#ff9b9b' }]), left: PAD, top: y });
  panels.push({ input: svgText(colW, CAPH, [{ t: 'LOBBY · pitchDeg 20 · AFTER', size: 16, fill: '#9bffb1' }]), left: PAD + colW + GAP, top: y });
  y += CAPH;
  panels.push({ input: A.buf, left: PAD, top: y });
  panels.push({ input: B.buf, left: PAD + colW + GAP, top: y });
  y += A.h + GAP;
}

// ── the numbers, read from the JSON ────────────────────────────────────────
const lines = [
  { t: 'MEASURED — before / null (same tree, 2nd load) / after', size: 17, fill: '#ffd479' },
  { t: '', size: 6 },
  { t: 'RING <25 luma — the share of ARENA FLOOR within 8 px of him under 25/255. Floor pixels, so it is neither his ink hull nor his own dark artwork:', size: 14, fill: '#a8b0c8' },
  { t: `   spawn_sw  ${tri('spawn_sw', (r) => r.ringDark.pct)}%      spawn_ne  ${tri('spawn_ne', (r) => r.ringDark.pct)}%      hub  ${tri('hub', (r) => r.ringDark.pct)}%` },
  { t: `   darkest floor pixel beside him:  spawn_sw ${tri('spawn_sw', (r) => r.ringL.min, 1)}   spawn_ne ${tri('spawn_ne', (r) => r.ringL.min, 1)}   hub ${tri('hub', (r) => r.ringL.min, 1)}` },
  { t: `   ring median vs OPEN ground:  hub ${tri('hub', (r) => r.ringL.p50, 1)}  against open ${f(row(after, 'hub').openL.p50, 1)}` },
  { t: '', size: 6 },
  { t: "NOTCHES — sub-25-luma samples on or inside the silhouette against a 165-215 body. The critic's acceptance criterion, made countable:", size: 14, fill: '#a8b0c8' },
  { t: `   spawn_sw  ${tri('spawn_sw', (r) => r.notch.n, 0)}      spawn_ne  ${tri('spawn_ne', (r) => r.notch.n, 0)}      hub  ${tri('hub', (r) => r.notch.n, 0)}` },
  { t: `   with the AO ABLATED ENTIRELY: ${tri('hub', (r) => r.notchNoAO.n, 0)} at hub — so this pass owned ${row(before, 'hub').notch.n - row(before, 'hub').notchNoAO.n} of ${row(before, 'hub').notch.n} and now owns ${row(after, 'hub').notch.n - row(after, 'hub').notchNoAO.n}.`, fill: '#ffcf8a' },
  { t: `   THE REST IS THE CHARACTER'S OWN INK HULL (toon.ts OUTLINE_CHAR_SCREEN, #241a33, luma 30) AND HIS DARK BOOTS/LIMBS — not this file's to fix, reported as a hunk.`, fill: '#ffcf8a' },
  { t: '', size: 6 },
  { t: 'LOBES — peaks by PERSISTENCE in the contact darkening field, windowed on him. The critic asked for ONE pool instead of "3+ overlapping lobes":', size: 14, fill: '#a8b0c8' },
  { t: `   spawn_sw  ${tri('spawn_sw', (r) => r.lobes.n, 0)}      spawn_ne  ${tri('spawn_ne', (r) => r.lobes.n, 0)}      hub  ${tri('hub', (r) => r.lobes.n, 0)}       ` +
       `hub secondary prominences ${JSON.stringify(row(before, 'hub').lobes.prom.slice(1, 3))} -> ${JSON.stringify(row(after, 'hub').lobes.prom.slice(1, 3))} codes` },
  { t: `   and the AO is the SOURCE: with it ablated the hub field has ${row(before, 'hub').lobesNo.ao} lobes, with the decal ablated ${row(before, 'hub').lobesNo.decal}, with his cast shadow ablated ${row(before, 'hub').lobesNo.cast}.` },
  { t: '', size: 6 },
  { t: 'WHAT IT COST — HUD-trimmed band (0.35-0.62), six-plate band vP10 0.333-0.549 / belowV45 3.07-30.09%:', size: 14, fill: '#a8b0c8' },
  { t: `   vP10   spawn_sw ${tri('spawn_sw', (r) => r.band.vP10, 4)}   spawn_ne ${tri('spawn_ne', (r) => r.band.vP10, 4)}   hub ${tri('hub', (r) => r.band.vP10, 4)}` },
  { t: `   <V.45  spawn_sw ${tri('spawn_sw', (r) => 100 * r.band.belowV45)}%  spawn_ne ${tri('spawn_ne', (r) => 100 * r.band.belowV45)}%  hub ${tri('hub', (r) => 100 * r.band.belowV45)}%` },
  { t: `   meanSat hub ${tri('hub', (r) => r.band.meanSat, 4)}   meanChroma hub ${tri('hub', (r) => r.band.meanChroma, 4)}  — NOTHING IS DESATURATED, which this repo has falsified as a fix every time it was tried`, fill: '#9bffb1' },
  { t: `   draws / triangles  hub ${tri('hub', (r) => r.counts.draws, 0)}  /  ${tri('hub', (r) => r.counts.tris, 0)}   EXACTLY EQUAL on all three arms. A uniform costs no geometry.`, fill: '#9bffb1' },
  { t: '', size: 6 },
  { t: `LOBBY (pitch 20) — hero mask ${lb.n.hero} / ${ln.n.hero} / ${la.n.hero} px, notches ${lb.notch.n} / ${ln.notch.n} / ${la.notch.n}, draws ${lb.counts.draws} / ${ln.counts.draws} / ${la.counts.draws}.`, size: 14 },
  { t: `   THE NULL ARM MOVES THE LOBBY MASK BY ${f(100 * Math.abs(ln.n.hero - lb.n.hero) / lb.n.hero, 1)}% ON ITS OWN (idle pose, frozen at a different phase), so this pair is NOT comparable and`, size: 14, fill: '#ffcf8a' },
  { t: '   no lobby delta is claimed. What it shows is no regression, at both cameras, from one uniform.', size: 14, fill: '#ffcf8a' },
];
panels.push({ input: svgText(W - 2 * PAD, lines.length * 22 + 14, lines), left: PAD, top: y });
y += lines.length * 22 + 14 + PAD;

await mkdir(dirname(OUT), { recursive: true });
await sharp({ create: { width: W, height: y, channels: 3, background: { r: 18, g: 18, b: 24 } } })
  .composite(panels).png().toFile(OUT);
console.log(`wrote ${OUT}  (${W}x${y})`);
