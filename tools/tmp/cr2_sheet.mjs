#!/usr/bin/env node
/**
 * cr2_sheet — a THREE-panel blind sheet: BEFORE, AFTER and a REFERENCE plate.
 *
 * THROWAWAY. Read-only on src/.
 *
 * ── WHY THREE AND NOT TWO ────────────────────────────────────────────────────
 * `tools/review.mjs` builds a 2-panel A/B sheet: ours against a plate. That answers
 * "where are we", which this project already knows. It cannot answer "did the cast
 * rebuild move anything", because there is NO per-character baseline in this repo —
 * the recorded 4.33/3.83 is "cast in match", a different quantity (58 degree camera,
 * tiny figures, gameplay_topdown plates).
 *
 * So the BEFORE arm is rendered from a detached worktree at `5b289ae^` — the last
 * commit before any cast work — by the SAME tool, at the SAME camera, from the SAME
 * URL. The three panels then go to ONE critic in ONE sheet, which matters for a
 * reason the audit in review.mjs measured: one critic scoring two panels gave both
 * the same number in 4 of 4 cases, so a round is n=1. Putting BEFORE and AFTER in
 * FRONT of the same critic converts the comparison from between-critic (floor ~1.4
 * each side) to within-critic, where the critic's own offset cancels.
 *
 * The REFERENCE panel is the validity control and is not optional: outside 7-9 the
 * round measured the critic and is discarded before anything is read off it. An
 * invalid round once drove the two largest rewrites the apron ever received.
 *
 * ── THE RUBRIC ───────────────────────────────────────────────────────────────
 * `tools/review.rubric.txt` (canonical v1) is written for TWO panels. It is copied
 * here with exactly two edits — the panel count and the return format. Every
 * anchor, every rule and the scored question itself are byte-identical, and the
 * diff is asserted at run time so the claim cannot rot. It is still a DIFFERENT
 * rubric: scores from this tool are comparable to each other and to nothing else.
 *
 * ── USE ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/cr2_sheet.mjs --before shots/cr2/before/egg.png \
 *     --after shots/cr2/after/egg.png --ref <plate> --out shots/cr2/packets/egg-c1
 */
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { randomInt } from 'node:crypto';
import { frameStats, FRAME_FLOOR } from './settle.mjs';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BEFORE = get('--before', null);
const AFTER = get('--after', null);
const REF = get('--ref', null);
const OUT = get('--out', null);
const HEIGHT = Number(get('--height', 1000));
if (!BEFORE || !AFTER || !REF || !OUT) { console.error('need --before --after --ref --out'); process.exit(2); }

const BG = { r: 22, g: 16, b: 31, alpha: 1 };
const GAP = 24, LABEL_H = 64;

/**
 * Vouch for OUR two panels. The reference plate is a third-party screenshot and is
 * not ours to re-shoot, so it is measured and reported but never refused — the same
 * asymmetry `tools/review.mjs` uses.
 */
async function vouch(png, { refuse }) {
  const p = resolve(png);
  if (!existsSync(p)) { console.error(`no such capture: ${png}`); process.exit(4); }
  const stats = await frameStats(p);
  const sidecarPath = `${p}.capture.json`;
  const sidecar = existsSync(sidecarPath) ? JSON.parse(await readFile(sidecarPath, 'utf8')) : null;
  const problems = [];
  if (stats.stdev < FRAME_FLOOR) problems.push(`frame is FLAT (stdev ${stats.stdev} < ${FRAME_FLOOR})`);
  if (sidecar && sidecar.painted === false) problems.push('its own capture record says the page was NOT PAINTED');
  if (refuse && !sidecar) problems.push('no .capture.json sidecar — nothing vouches for this image');
  console.log(`  ${basename(png).padEnd(16)} stdev ${String(stats.stdev).padEnd(7)} mean ${String(stats.mean).padEnd(7)}`
    + ` sidecar=${sidecar ? `${sidecar.tool} "${sidecar.label}" painted=${sidecar.painted}` : 'NONE'}`);
  if (refuse && problems.length) {
    console.error(`!! CAPTURE REFUSED: ${basename(png)} — ${problems.join('; ')}`);
    process.exit(5);
  }
  return { path: png, stats, provenance: sidecar, problems, verified: !!sidecar && problems.length === 0 };
}

console.log('capture gate:');
const vBefore = await vouch(BEFORE, { refuse: true });
const vAfter = await vouch(AFTER, { refuse: true });
const vRef = await vouch(REF, { refuse: false });

// ── Rubric: canonical v1, adapted to three panels, with the diff asserted ─────
const CANON_PATH = resolve('tools/review.rubric.txt');
const canon = await readFile(CANON_PATH, 'utf8');
let rubric = canon
  .replace('FOOD ARENA — CANONICAL BLIND REVIEW RUBRIC, v1',
    'FOOD ARENA — CANONICAL BLIND REVIEW RUBRIC, v1 — ADAPTED TO THREE PANELS (v1-3p)')
  .replace('You are shown one sheet containing two panels, labelled A and B.',
    'You are shown one sheet containing three panels, labelled A, B and C.')
  .replace('Score both panels on their own merits. You are NOT required to pick a loser: if both\n    look shipped, give both high scores, and if both look unfinished, give both low ones.',
    'Score every panel on its own merits. You are NOT required to pick a loser or a\n    winner: if they all look shipped, give them all high scores, and if they all look\n    unfinished, give them all low ones. Two panels may deserve the same number.')
  .replace('  A: <score 0-10> — <one sentence: the change that would most raise panel A\'s score>\n  B: <score 0-10> — <one sentence: the change that would most raise panel B\'s score>',
    '  A: <score 0-10> — <one sentence: the change that would most raise panel A\'s score>\n'
    + '  B: <score 0-10> — <one sentence: the change that would most raise panel B\'s score>\n'
    + '  C: <score 0-10> — <one sentence: the change that would most raise panel C\'s score>');

// A claim about a diff that is not asserted is a claim that rots. Four edits, no more.
const EXPECT_EDITS = 4;
let edits = 0;
const canonLines = canon.split('\n'), newLines = rubric.split('\n');
for (const l of canonLines) if (!newLines.includes(l)) edits++;
if (edits !== EXPECT_EDITS) {
  console.error(`!! RUBRIC ADAPTATION DRIFTED: ${edits} canonical lines changed, expected ${EXPECT_EDITS}.`);
  console.error('   tools/review.rubric.txt was edited. Re-derive the adaptation before running a round.');
  process.exit(7);
}

// ── Blind order ──────────────────────────────────────────────────────────────
const panels = [
  { role: 'BEFORE', path: BEFORE }, { role: 'AFTER', path: AFTER }, { role: 'REFERENCE', path: REF },
];
for (let i = panels.length - 1; i > 0; i--) { const j = randomInt(0, i + 1); [panels[i], panels[j]] = [panels[j], panels[i]]; }

const imgs = await Promise.all(panels.map(async (p) => {
  const buf = await sharp(p.path).resize({ height: HEIGHT, fit: 'contain', background: BG }).png().toBuffer();
  const m = await sharp(buf).metadata();
  return { ...p, buf, w: m.width, h: m.height };
}));

const totalW = imgs.reduce((s, i) => s + i.w, 0) + GAP * (imgs.length + 1);
const totalH = HEIGHT + LABEL_H + GAP * 2;
const slots = ['A', 'B', 'C'];
const composites = [];
let x = GAP;
imgs.forEach((img, i) => {
  composites.push({ input: img.buf, left: x, top: GAP + LABEL_H });
  composites.push({
    input: Buffer.from(`<svg width="${img.w}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">`
      + `<text x="${img.w / 2}" y="${LABEL_H * 0.72}" font-family="Helvetica,Arial,sans-serif" font-size="${Math.round(LABEL_H * 0.62)}"`
      + ` font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.92">${slots[i]}</text></svg>`),
    left: x, top: GAP,
  });
  x += img.w + GAP;
});

const outDir = resolve(OUT);
await mkdir(outDir, { recursive: true });
const sheet = join(outDir, 'sheet.png');
await sharp({ create: { width: totalW, height: totalH, channels: 4, background: BG } })
  .composite(composites).png().toFile(sheet);

const key = Object.fromEntries(imgs.map((im, i) => [slots[i], im.role]));
await writeFile(join(outDir, 'key.json'), JSON.stringify({
  key, paths: Object.fromEntries(imgs.map((im, i) => [slots[i], im.path])), sheet,
}, null, 2));
await writeFile(join(outDir, 'RUBRIC.txt'), rubric);
await writeFile(join(outDir, 'manifest.json'), JSON.stringify({
  tool: 'cr2_sheet.mjs',
  rubric: 'tools/review.rubric.txt, canonical v1, adapted to 3 panels (4 lines changed: title, panel count, the not-required-to-pick-a-loser rule, the return format)',
  rubricComparability: 'WITHIN THIS SERIES ONLY. The rubric is worth 2.0 points on identical sheets; '
    + 'no score here may be compared to any previously recorded number in this repo.',
  beforeTree: '5b289ae^ (7b1b813) — the last commit before any cast work: no rim, no hip, no face rebuild',
  afterTree: 'HEAD',
  camera: 'src/ui/screens/charStage.ts — pitch 20, yaw 0, subjectFill 0.60 (the SHIPPED lobby view)',
  plate: basename(REF),
  framingCaveat: 'our two panels are 900x1400 full frames with headroom and floor; the reference plate '
    + 'is a tight crop around its figure. That asymmetry is identical for BEFORE and AFTER, so it '
    + 'cannot bias the delta — it can only depress both of our panels against the plate.',
  captures: { before: vBefore, after: vAfter, reference: vRef },
  order: key,
}, null, 2));

console.log(`\nsheet   ${sheet}`);
console.log(`key     ${join(outDir, 'key.json')}  (orchestrator only)`);
console.log(`order   ${slots.map((s, i) => `${s}=${imgs[i].role}`).join('  ')}`);
