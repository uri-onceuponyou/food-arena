#!/usr/bin/env node
/**
 * BASELINE CROPS — derive the two SUB-FRAME elements (the cast at gameplay scale, and
 * the interface band) from the same match frame and the same reference plates, using
 * the SAME crop fractions on both sides.
 *
 * ── Why crop at all ─────────────────────────────────────────────────────────
 * Two of the five elements are not whole frames. "The cast in match" and "the in-match
 * HUD" both live inside the arena frame, and scoring them by asking the critic a
 * narrower QUESTION is not available: the rubric is worth 2.0 points, measured, so a
 * per-element rubric would put every element on a different scale and the one thing Uri
 * wants — which element is furthest from the bar — would stop being answerable.
 *
 * So the question is held byte-identical and the PIXELS change instead.
 *
 * ── Why the SAME fraction on both sides ─────────────────────────────────────
 * `tools/compare.mjs` normalises both panels to the same HEIGHT, which preserves
 * fraction-of-frame and destroys pixels-on-subject (`tools/tmp/packet_audit.mjs`). Our
 * character is 10.4% of frame height against Shelly's 12.5% in the same plate, so the
 * WHOLE frames are already close to subject-matched. Cropping both sides by the same
 * fraction of frame height therefore keeps them matched — whereas cropping ours to a
 * fixed pixel box and the plates to "whatever looks right" would silently re-open the
 * bust-versus-full-body defect the `fullbody_fair` category was created to close.
 *
 * CAST_FRAC = 0.45 of frame height, 16:9. HUD_FRAC = 0.30 of frame height, full width.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * A derived PNG inherits nothing. `tools/review.mjs` refuses an image with no
 * `.capture.json` beside it, so every crop of OUR frame gets a sidecar recording the
 * source capture's own `painted` flag plus the crop box — a crop of an unpainted frame
 * is still an unpainted frame, and the sidecar must not launder that.
 *
 * ⚠️ Writes under `reference/images/`, which is GITIGNORED and must never be committed.
 *
 * Usage:
 *   node tools/tmp/baseline_crops.mjs --ours shots/baseline2/match_donut_taco_03.png \
 *     --out shots/baseline2 [--check]
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
const OURS = resolve(args.ours ?? join(ROOT, 'shots/baseline2/match_donut_taco_03.png'));
const OUT = resolve(args.out ?? join(ROOT, 'shots/baseline2'));
const CURATED = join(ROOT, 'reference/images/curated');
const SRC_CAT = join(CURATED, 'gameplay_topdown');

const CAST_FRAC = 0.45;   // of frame height; box is 16:9
const HUD_FRAC = 0.30;    // of frame height; box is full width

/**
 * Where the fighters/brawlers are, as a fraction of frame width/height. Ours comes from
 * `__vfxDebugScreen`; the plates were read off the rendered image by eye, which is the
 * honest method here — `limbmatch --mode ref` is documented as unreliable on busy
 * gameplay plates, and inventing a segmenter for six images would be a second
 * instrument to validate.
 */
const PLATE_CENTRES = {
  'bs_01.png': [0.51, 0.52],   // El Primo's super, Dynamike right, Bull below
  'bs_02.png': [0.41, 0.56],   // Piper left, Bibi/Maisie centre, Nita above
  'bs_03.png': [0.63, 0.42],   // Piper above the smoke, Poco right
  'bs_04.png': [0.43, 0.43],   // bork6 / thepapa / mnaw2 / nrb around the crates
  'bs_05.png': [0.54, 0.33],   // Barley left, Shelly right, Bull above the poison
  'bs_06.png': [0.34, 0.72],   // Brock + Griff at the pipe row
};

/** 16:9 box of `frac` of frame height, centred on (cx,cy), clamped inside the frame. */
function castBox(w, h, cx, cy) {
  const bh = Math.round(h * CAST_FRAC);
  const bw = Math.min(w, Math.round((bh * 16) / 9));
  const left = Math.max(0, Math.min(w - bw, Math.round(cx * w - bw / 2)));
  const top = Math.max(0, Math.min(h - bh, Math.round(cy * h - bh / 2)));
  return { left, top, width: bw, height: bh };
}

function hudBox(w, h) {
  return { left: 0, top: 0, width: w, height: Math.round(h * HUD_FRAC) };
}

async function sidecarFor(srcPng, dstPng, box, kind) {
  const sc = `${srcPng}.capture.json`;
  let src = null;
  if (existsSync(sc)) src = JSON.parse(await readFile(sc, 'utf8'));
  await writeFile(`${dstPng}.capture.json`, JSON.stringify({
    tool: 'baseline_crops',
    label: `${kind} crop of ${basename(srcPng)}`,
    takenAt: new Date().toISOString(),
    // A crop of an unpainted frame is still an unpainted frame. Inherit, never assert.
    painted: src ? src.painted === true : false,
    enforced: false,
    derivedFrom: { path: srcPng, box, kind, sidecar: src },
    stats: null,
    before: src?.before ?? { ok: false, why: ['no source sidecar'] },
    after: src?.after ?? { ok: false, why: ['no source sidecar'] },
  }, null, 2));
}

if (!existsSync(OURS)) { console.error(`no ${OURS}`); process.exit(3); }
if (!existsSync(SRC_CAT)) { console.error(`no ${SRC_CAT}`); process.exit(3); }

await mkdir(OUT, { recursive: true });

// ── ours ─────────────────────────────────────────────────────────────────────
const om = await sharp(OURS).metadata();
// Our fighters, in frame fractions. Defaults are read off `capture-report.json` by the
// caller; `--cx/--cy` overrides for a different frame.
const cx = Number(args.cx ?? 0.56);
const cy = Number(args.cy ?? 0.62);

const ourCast = join(OUT, 'ours_cast.png');
const cb = castBox(om.width, om.height, cx, cy);
await sharp(OURS).extract(cb).png().toFile(ourCast);
await sidecarFor(OURS, ourCast, cb, 'cast');
console.log(`ours_cast.png   ${JSON.stringify(cb)}  from ${om.width}x${om.height}`);

const ourHud = join(OUT, 'ours_hud.png');
const hb = hudBox(om.width, om.height);
await sharp(OURS).extract(hb).png().toFile(ourHud);
await sidecarFor(OURS, ourHud, hb, 'hud');
console.log(`ours_hud.png    ${JSON.stringify(hb)}`);

// ── the plates ───────────────────────────────────────────────────────────────
for (const cat of ['topdown_cast', 'topdown_hud']) await mkdir(join(CURATED, cat), { recursive: true });

for (const [file, [pcx, pcy]] of Object.entries(PLATE_CENTRES)) {
  const src = join(SRC_CAT, file);
  if (!existsSync(src)) { console.error(`MISSING PLATE ${src}`); process.exit(4); }
  const m = await sharp(src).metadata();
  const cbox = castBox(m.width, m.height, pcx, pcy);
  await sharp(src).extract(cbox).png().toFile(join(CURATED, 'topdown_cast', file));
  const hbox = hudBox(m.width, m.height);
  await sharp(src).extract(hbox).png().toFile(join(CURATED, 'topdown_hud', file));
  console.log(`plate ${file}  ${m.width}x${m.height}  cast ${JSON.stringify(cbox)}  hud ${JSON.stringify(hbox)}`);
}

const idx = [
  '# topdown_cast / topdown_hud — derived from `gameplay_topdown`',
  '',
  'Built by `tools/tmp/baseline_crops.mjs`. Both categories are crops of the SIX Brawl',
  'Stars top-down plates, taken at the SAME fraction of frame height as the matching crop',
  'of our own frame, so `compare.mjs`\'s equal-height normalisation keeps subject scale',
  'matched instead of quietly re-opening the bust-vs-full-body defect.',
  '',
  `* \`topdown_cast\` — ${CAST_FRAC} of frame height, 16:9, centred on the brawler cluster.`,
  `* \`topdown_hud\`  — the top ${HUD_FRAC} of frame height, full width: each game's status`,
  '  chrome (nameplates, health bars, timer) plus a slice of world so the interface is not',
  '  judged floating in a void.',
  '',
  '⚠️ Gitignored. Never commit.',
  '',
];
await writeFile(join(CURATED, 'topdown_cast', 'INDEX.md'), `${idx.join('\n')}\n`);
await writeFile(join(CURATED, 'topdown_hud', 'INDEX.md'), `${idx.join('\n')}\n`);
console.log('\ndone');
