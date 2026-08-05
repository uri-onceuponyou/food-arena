#!/usr/bin/env node
/**
 * Overlay a calibrated percent-of-frame-height ruler so a subject can be measured off
 * a rendered frame instead of estimated.
 *
 * This exists because the project has an OPEN, CONTESTED number steering a shipped
 * constant: how much of frame height a Brawl Stars brawler occupies. A hand pixel
 * measurement said 14-21%, a blind critic eyeballed 10-12%, and an earlier commit
 * "settled" it at 10-13% by measuring OUR frame and asserting the reference band
 * without ever measuring a plate. `docs/LESSONS.md` §6 already records two agents
 * computing our own character's height as 13% and 7% when the truth was ~10.5%, both
 * wrong because they reasoned by trigonometry — "measure sizes off a rendered frame,
 * not by trigonometry" is the standing instruction, and nothing here implemented it
 * for the reference side.
 *
 * Auto-segmentation was tried and rejected upstream (`limbmatch --mode ref` is not
 * reliable on busy gameplay plates), so this does the honest thing: it makes the frame
 * measurable BY EYE to a stated precision, rather than pretending to a precision no
 * segmenter here can deliver. Lines every 2.5% of frame height, labelled, with a
 * heavier line every 10%.
 *
 * Usage:
 *   node tools/tmp/subject_ruler.mjs --in a.png --out b.png [--step 2.5]
 *   node tools/tmp/subject_ruler.mjs --selftest
 */

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

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

function rulerSvg(w, h, step) {
  const lines = [];
  for (let p = 0; p <= 100 + 1e-9; p += step) {
    const y = Math.round((p / 100) * h);
    const major = Math.abs(p % 10) < 1e-9;
    lines.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${major ? '#00ff66' : '#ff00d4'}" `
      + `stroke-width="${major ? 2 : 1}" opacity="${major ? 0.95 : 0.55}"/>`
    );
    if (major) {
      lines.push(
        `<rect x="2" y="${Math.max(0, y - 15)}" width="66" height="22" fill="#000000" opacity="0.72"/>`,
        `<text x="6" y="${Math.max(14, y + 1)}" font-family="Helvetica,Arial" font-size="17" `
        + `font-weight="700" fill="#00ff66">${p.toFixed(0)}%</text>`,
        `<rect x="${w - 70}" y="${Math.max(0, y - 15)}" width="66" height="22" fill="#000000" opacity="0.72"/>`,
        `<text x="${w - 66}" y="${Math.max(14, y + 1)}" font-family="Helvetica,Arial" font-size="17" `
        + `font-weight="700" fill="#00ff66">${p.toFixed(0)}%</text>`
      );
    }
  }
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`);
}

async function apply(inPath, outPath, step) {
  const meta = await sharp(inPath).metadata();
  await mkdir(dirname(resolve(outPath)), { recursive: true });
  await sharp(inPath)
    .composite([{ input: rulerSvg(meta.width, meta.height, step), top: 0, left: 0 }])
    .png().toFile(outPath);
  return { w: meta.width, h: meta.height, pxPerPercent: meta.height / 100 };
}

async function selftest() {
  let pass = 0, fail = 0;
  const t = (n, c, d = '') => { if (c) { pass++; console.log(`  ok   ${n} ${d}`); } else { fail++; console.log(`  FAIL ${n} ${d}`); } };
  const tmp = '/tmp/subject_ruler_selftest';

  // A fixture whose answer is known BY CONSTRUCTION: a black bar from 20% to 50% of
  // frame height, i.e. exactly 30% tall. If a ruler cannot be read back to the right
  // answer on this, it cannot be trusted on a gameplay plate.
  const W = 400, H = 1000;
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect x="150" y="200" width="100" height="300" fill="#000"/></svg>`), top: 0, left: 0 }])
    .png().toFile(`${tmp}_fix.png`);
  const r = await apply(`${tmp}_fix.png`, `${tmp}_ruled.png`, 2.5);
  t('px per percent = h/100', r.pxPerPercent === 10, `${r.pxPerPercent}`);

  // Read the fixture back through raw pixels — the gridline for 20% must land on the
  // bar's top edge and the one for 50% on its bottom.
  const { data, info } = await sharp(`${tmp}_ruled.png`).raw().toBuffer({ resolveWithObject: true });
  const colAt = (x, y) => { const p = (y * info.width + x) * info.channels; return [data[p], data[p + 1], data[p + 2]]; };
  const isMagentaOrGreen = ([rr, gg, bb]) => (rr > 150 && bb > 120 && gg < 120) || (gg > 150 && rr < 120);
  t('a gridline exists at y=200 (20%)', isMagentaOrGreen(colAt(300, 200)), colAt(300, 200).join(','));
  t('a gridline exists at y=500 (50%)', isMagentaOrGreen(colAt(300, 500)), colAt(300, 500).join(','));
  t('no gridline at y=205 (between steps)', !isMagentaOrGreen(colAt(300, 205)), colAt(300, 205).join(','));
  // y=250 is 25% of 1000, i.e. ON a 2.5%-step gridline — the first version of this
  // assertion sampled there and reported the TOOL as broken when the fixture
  // coordinate was the bug. Sample strictly between steps.
  t('subject is unobscured between gridlines', colAt(200, 262).every((c) => c < 40), colAt(200, 262).join(','));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log('Known-answer fixture written to /tmp/subject_ruler_selftest_ruled.png:');
  console.log('  the black bar spans EXACTLY 20%..50% — read it back before trusting any plate reading.');
  process.exit(fail ? 1 : 0);
}

const args = parseArgs(process.argv);
if (args.selftest) await selftest();
else if (args.in && args.out) {
  const r = await apply(resolve(args.in), resolve(args.out), Number(args.step ?? 2.5));
  console.log(`✓ ${args.out}  ${r.w}x${r.h}  ${r.pxPerPercent.toFixed(2)} px per 1% of height`);
} else { console.error('Need --in X --out Y | --selftest'); process.exit(2); }
