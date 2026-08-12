#!/usr/bin/env node
/**
 * Q1 CROPS — derive the `cast` sub-frame of OUR side, and nothing else.
 *
 * ── Why this is not `baseline_crops.mjs --ours <new frame>` ─────────────────
 * That tool crops our frame AND re-derives the six `topdown_cast` / `topdown_hud`
 * reference plates into `reference/images/curated/`. Re-deriving them would be
 * harmless-looking and is exactly the wrong move for this round: the reference side
 * of a before/after must be the SAME BYTES the baseline round scored, and the way to
 * guarantee that is not to touch it. **Verified rather than assumed** — all six
 * on-disk `topdown_cast` plates reproduce bit-for-bit from `gameplay_topdown` under
 * `baseline_crops.mjs`'s committed constants (sha256 checked, 6/6 IDENTICAL), so the
 * plates on disk today are the plates of 2026-08-05.
 *
 * ── The crop must be IDENTICAL in geometry to the baseline's ────────────────
 * `compare.mjs` normalises both panels to the same height, so cropping both sides by
 * the same FRACTION of frame height is what keeps subject scale matched. If this file
 * used a different fraction from the one the plates were cut with, our panel would be
 * scored at a different subject scale and the round would measure the crop.
 *
 * So `CAST_FRAC` is not merely copied — this file **parses it out of
 * `baseline_crops.mjs`** and refuses to run if the two disagree. A copied constant is
 * a second source of truth, and this repo has six documented cases of one going stale.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * A derived PNG inherits nothing, and `review.mjs` refuses an image with no
 * `.capture.json`. The sidecar written here INHERITS `painted` from the source
 * capture — a crop of an unpainted frame is still an unpainted frame.
 *
 * Usage:
 *   node tools/tmp/q1_crops.mjs --ours shots/q1/cap/match_donut_taco_05.png \
 *     --out shots/q1/stage --tag primary
 *   node tools/tmp/q1_crops.mjs --selftest
 */

import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const ROOT = resolve(process.argv[1], '../../..');

const CAST_FRAC = 0.45;   // of frame height; box is 16:9

/** 16:9 box of `CAST_FRAC` of frame height, centred on (cx,cy), clamped inside the frame. */
function castBox(w, h, cx, cy) {
  const bh = Math.round(h * CAST_FRAC);
  const bw = Math.min(w, Math.round((bh * 16) / 9));
  const left = Math.max(0, Math.min(w - bw, Math.round(cx * w - bw / 2)));
  const top = Math.max(0, Math.min(h - bh, Math.round(cy * h - bh / 2)));
  return { left, top, width: bw, height: bh };
}

/**
 * The one thing that would silently void the cast arm: this file's crop fraction
 * drifting from the one the reference plates were cut with. Read it back out of the
 * other tool rather than trusting that they still agree.
 */
async function assertFracMatchesBaseline() {
  const src = await readFile(join(ROOT, 'tools/tmp/baseline_crops.mjs'), 'utf8');
  const m = /const\s+CAST_FRAC\s*=\s*([0-9.]+)\s*;/.exec(src);
  if (!m) throw new Error('cannot find CAST_FRAC in baseline_crops.mjs — the plates cannot be vouched for');
  const theirs = Number(m[1]);
  if (theirs !== CAST_FRAC) {
    throw new Error(`CAST_FRAC drift: q1_crops ${CAST_FRAC} vs baseline_crops ${theirs}. `
      + 'The reference plates were cut at theirs; scoring our side at ours would measure the crop.');
  }
  return theirs;
}

// ── selftest: the geometry, and a known-bad ─────────────────────────────────
if (args.selftest) {
  const checks = [];
  const add = (ok, name, detail) => checks.push({ ok, name, detail });

  const theirs = await assertFracMatchesBaseline().then((v) => v, (e) => e);
  add(theirs === CAST_FRAC, 'CAST_FRAC agrees with baseline_crops.mjs', String(theirs));

  // Geometry, on the shipped viewport.
  const b = castBox(1600, 900, 0.5, 0.5);
  add(b.height === 405, 'box height is 0.45 of frame height', `${b.height} of 900`);
  add(Math.abs(b.width / b.height - 16 / 9) < 0.01, 'box is 16:9', `${b.width}×${b.height}`);
  add(b.left === Math.round(800 - b.width / 2) && b.top === Math.round(450 - b.height / 2),
    'centred on (cx,cy) when it fits', JSON.stringify(b));

  // KNOWN-BAD: a centre outside the frame must CLAMP, not produce a negative offset —
  // sharp throws on a negative `left`, which would look like a tool crash rather than
  // a bad centre, and the clamp is the thing that keeps a fighter near the edge in shot.
  const edge = castBox(1600, 900, 0.99, 0.99);
  add(edge.left >= 0 && edge.top >= 0 && edge.left + edge.width <= 1600 && edge.top + edge.height <= 900,
    'KNOWN-BAD: an out-of-frame centre clamps inside the frame', JSON.stringify(edge));
  add(edge.left !== Math.round(0.99 * 1600 - edge.width / 2),
    'KNOWN-BAD: and the clamp actually MOVED the box (else the check is vacuous)',
    `${edge.left} vs unclamped ${Math.round(0.99 * 1600 - edge.width / 2)}`);

  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} - ${c.name}  [${c.detail}]`);
  const nOk = checks.filter((c) => c.ok).length;
  console.log(`\n${nOk === checks.length ? '✅ PASS' : '🔴 FAIL'}  q1_crops selftest: ${nOk}/${checks.length}`);
  process.exit(nOk === checks.length ? 0 : 1);
}

await assertFracMatchesBaseline();

const OURS = resolve(args.ours ?? '');
const OUT = resolve(args.out ?? join(ROOT, 'shots/q1/stage'));
const TAG = String(args.tag ?? 'primary');
if (!existsSync(OURS)) { console.error(`no --ours ${OURS}`); process.exit(3); }

/**
 * The crop centre comes from the CAPTURE REPORT's own `pScreen`/`eScreen` — the midpoint
 * of the two fighters in screen space, as the renderer projected them. It is derived,
 * not eyeballed, and it is the same quantity `baseline_crops.mjs`'s `--cx/--cy` doc
 * describes ("read off capture-report.json by the caller").
 */
let cx = Number(args.cx ?? NaN);
let cy = Number(args.cy ?? NaN);
if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
  const repPath = join(resolve(OURS, '..'), 'capture-report.json');
  if (!existsSync(repPath)) { console.error(`no capture-report.json beside ${OURS}; pass --cx/--cy`); process.exit(3); }
  const rep = JSON.parse(await readFile(repPath, 'utf8'));
  const [W, H] = rep.viewport;
  const cand = rep.runs.flatMap((r) => r.candidates).find((c) => c.file === basename(OURS));
  if (!cand?.pScreen || !cand?.eScreen) { console.error(`no screen positions recorded for ${basename(OURS)}`); process.exit(3); }
  cx = ((cand.pScreen.x + cand.eScreen.x) / 2) / W;
  cy = ((cand.pScreen.y + cand.eScreen.y) / 2) / H;
  console.log(`centre derived from capture-report: p(${Math.round(cand.pScreen.x)},${Math.round(cand.pScreen.y)}) `
    + `e(${Math.round(cand.eScreen.x)},${Math.round(cand.eScreen.y)}) -> (${cx.toFixed(4)}, ${cy.toFixed(4)})`);
}

await mkdir(OUT, { recursive: true });

const om = await sharp(OURS).metadata();
const dst = join(OUT, `cast_${TAG}.png`);
const box = castBox(om.width, om.height, cx, cy);
await sharp(OURS).extract(box).png().toFile(dst);

const sc = `${OURS}.capture.json`;
const src = existsSync(sc) ? JSON.parse(await readFile(sc, 'utf8')) : null;
await writeFile(`${dst}.capture.json`, JSON.stringify({
  tool: 'q1_crops',
  label: `cast crop of ${basename(OURS)}`,
  takenAt: new Date().toISOString(),
  // Inherit, never assert. A crop of an unpainted frame is still an unpainted frame.
  painted: src ? src.painted === true : false,
  enforced: false,
  derivedFrom: { path: OURS, box, kind: 'cast', castFrac: CAST_FRAC, centre: { cx, cy }, sidecar: src },
  stats: null,
  before: src?.before ?? { ok: false, why: ['no source sidecar'] },
  after: src?.after ?? { ok: false, why: ['no source sidecar'] },
}, null, 2));

console.log(`${dst}  ${JSON.stringify(box)}  from ${om.width}×${om.height}  painted=${src ? src.painted : 'NO SIDECAR'}`);
