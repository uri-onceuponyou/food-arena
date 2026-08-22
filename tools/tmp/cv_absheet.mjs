#!/usr/bin/env node
/**
 * CV ABSHEET — the round-3 before/after, at BOTH cameras, on one page.
 *
 * `CLAUDE.md` rule 3: judge rendered pixels, at both pitches, because the shallow view is
 * the better DETECTOR and the steep one is what ships. The two arms are captures of two
 * COMMITS — `cz_shot.mjs` against detached worktrees — so the only difference between a
 * left panel and its right panel is one commit.
 *
 * Numbers on the captions come from `cv_restarea.mjs` at capture time, re-read from its
 * `--json` rather than retyped: `AGENT-BRIEF §2b` — a count written from memory is wrong
 * here at roughly coin-flip rate.
 *
 *   node tools/tmp/cv_absheet.mjs --a tools/tmp/cv_r3_par --b tools/tmp/cv_r3_after \
 *        --stats tools/tmp/cv_r3_restarea.json --out tools/tmp/cv_r3_ab.png
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const A = String(args.a), B = String(args.b);
const OUT = String(args.out ?? 'tools/tmp/cv_ab.png');
const STATS = args.stats ? JSON.parse(readFileSync(String(args.stats), 'utf8')).results : [];

/** medianSD/flat% for a capture path, or nulls. Never invents a number. */
function stat(path) {
  const r = STATS.find((s) => s.src === path);
  return r ? `median cell SD ${r.medianSD}  ·  near-flat ${r.flatPct}%` : 'not measured';
}

const ROWS = [
  { id: 'p1_58', title: 'MATCH CAMERA — pitch 58 (what ships)' },
  { id: 'p1_40', title: 'SHALLOW DETECTOR — pitch 40 (where a flat thing reads flattest)' },
];
const K = 0.5;
const PW = Math.round(1400 * K), PH = Math.round(900 * K);
const CAP = 74, HEAD = 118, GUT = 18;
const W = PW * 2 + GUT * 3;
const H = HEAD + ROWS.length * (CAP + PH + GUT) + 30;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svg = (w, h, body) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
  + `<style>text{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;}</style>${body}</svg>`);

const parts = [];
parts.push({
  input: svg(W, HEAD,
    `<text x="20" y="40" font-size="26" font-weight="700" fill="#F4F6FB">Round 3 — the brushed-metal band swing, 0.50-1.00 grey to 0.30 of it</text>`
    + `<text x="20" y="72" font-size="16" fill="#98A0B4">${esc(basename(A))} (parent) vs ${esc(basename(B))} (shipped) — two detached worktrees, drift control 8/8 byte-identical on both</text>`
    + `<text x="20" y="98" font-size="16" fill="#98A0B4">The median cell SD does NOT move (31.3 -&gt; 31.0). The near-flat share does, and it is the statistic that encodes "somewhere quiet for the eye".</text>`),
  left: 0, top: 0,
});

let y = HEAD;
for (const row of ROWS) {
  const pa = `${A}/${row.id}.png`, pb = `${B}/${row.id}.png`;
  parts.push({ input: svg(W, CAP,
    `<text x="20" y="26" font-size="18" font-weight="700" fill="#FFC24A">${esc(row.title)}</text>`
    + `<text x="20" y="52" font-size="14" fill="#FF9AA2">BEFORE  ${esc(stat(pa))}</text>`
    + `<text x="${PW + GUT * 2}" y="52" font-size="14" fill="#7BE8A8">AFTER   ${esc(stat(pb))}</text>`),
  left: 0, top: y });
  y += CAP;
  parts.push({ input: { create: { width: 1, height: 1, channels: 4, background: '#000' } }, left: 0, top: y });
  parts.pop();
  parts.push({ inputPath: pa, left: GUT, top: y });
  parts.push({ inputPath: pb, left: PW + GUT * 2, top: y });
  y += PH + GUT;
}

const composited = [];
for (const p of parts) {
  if (p.inputPath) composited.push({ input: await sharp(p.inputPath).resize({ width: PW }).png().toBuffer(), left: p.left, top: p.top });
  else composited.push(p);
}

await sharp({ create: { width: W, height: H, channels: 4, background: '#0C0D14' } })
  .composite(composited).png().toFile(OUT);
console.log(`cv_absheet -> ${OUT}  (${W}x${H})`);
