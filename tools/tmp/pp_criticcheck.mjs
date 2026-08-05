/**
 * pp_criticcheck — INSTRUMENT VALIDATION for one per-part critic round.
 *
 * A blind critic scores two PNGs. Before believing either score, this checks the
 * things that have invalidated rounds on this project before:
 *   1. both panels sit on the SAME flat field (else the pair measures the backdrop)
 *   2. the figure is LIGHTER than the field on BOTH sides — the SHIPPED polarity.
 *      docs/LESSONS.md §13: the old cyan preview backdrop inverted this sign and
 *      every character packet ever judged here was scored against a relationship
 *      the player never sees.
 *   3. the two figures are scaled to the SAME height (else it is a zoom A/B)
 *   4. neither panel is clipped by its own frame
 *
 * KNOWN-BAD-INPUT VALIDATION (`--selftest`): the same code is run against three
 * synthesised panels that are each wrong in one specific way — inverted polarity,
 * a mismatched field, and a half-scale figure. If it does not FLAG all three it
 * is not an instrument. Read-only; writes nothing.
 */
import sharp from 'sharp';

const FIELD_TOL = 14; // sum |dr|+|dg|+|db| below this counts as field

const srgb = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const luma = (r, g, b) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

async function measure(bufOrPath, label) {
  const im = sharp(bufOrPath);
  const { width: W, height: H } = await im.metadata();
  const { data, info } = await im.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  // field = modal border colour, taken from the 4 corners
  const corner = (x, y) => { const i = (y * W + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  const F = corner(0, 0);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, fig = 0, figL = 0, gnd = 0, gndL = 0;
  let sat = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * ch, r = data[i], g = data[i + 1], b = data[i + 2];
    const d = Math.abs(r - F[0]) + Math.abs(g - F[1]) + Math.abs(b - F[2]);
    const L = luma(r, g, b);
    if (d > FIELD_TOL) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      fig++; figL += L;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx === 0 ? 0 : (mx - mn) / mx;
    } else { gnd++; gndL += L; }
  }
  const fL = figL / fig, gL = gndL / gnd;
  return {
    label, W, H, field: F, bbox: [minX, minY, maxX, maxY],
    figH: maxY - minY + 1, figW: maxX - minX + 1, figPx: fig,
    cover: fig / (W * H), figLuma: fL, gndLuma: gL,
    contrast: fL - gL, weber: (fL - gL) / gL, meanSat: sat / fig,
    clipped: minX <= 0 || minY <= 0 || maxX >= W - 1 || maxY >= H - 1,
  };
}

function verdict(a, b) {
  const flags = [];
  const dField = Math.abs(a.field[0] - b.field[0]) + Math.abs(a.field[1] - b.field[1]) + Math.abs(a.field[2] - b.field[2]);
  if (dField > 6) flags.push(`FIELD MISMATCH: ${a.field} vs ${b.field} (sum d=${dField})`);
  if (a.contrast <= 0) flags.push(`${a.label} POLARITY INVERTED: figure darker than field (${a.contrast.toFixed(4)})`);
  if (b.contrast <= 0) flags.push(`${b.label} POLARITY INVERTED: figure darker than field (${b.contrast.toFixed(4)})`);
  const hRatio = a.figH / b.figH;
  if (hRatio < 0.93 || hRatio > 1.07) flags.push(`SCALE MISMATCH: figure heights ${a.figH} vs ${b.figH} (ratio ${hRatio.toFixed(3)})`);
  if (a.clipped) flags.push(`${a.label} CLIPPED by frame`);
  if (b.clipped) flags.push(`${b.label} CLIPPED by frame`);
  return flags;
}

function show(m) {
  console.log(`${m.label}  ${m.W}x${m.H}  field=rgb(${m.field.join(',')})`);
  console.log(`   bbox=[${m.bbox.join(', ')}]  figure ${m.figW}x${m.figH}px  cover=${(100 * m.cover).toFixed(1)}%  clipped=${m.clipped}`);
  console.log(`   figLuma=${m.figLuma.toFixed(4)}  fieldLuma=${m.gndLuma.toFixed(4)}  contrast=${m.contrast >= 0 ? '+' : ''}${m.contrast.toFixed(4)}  weber=${m.weber.toFixed(3)}  meanSat=${m.meanSat.toFixed(3)}`);
}

async function synth({ figLum, field, scale }) {
  const W = 400, H = 800;
  const fh = Math.round(600 * scale);
  const bg = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) { bg[i * 3] = field[0]; bg[i * 3 + 1] = field[1]; bg[i * 3 + 2] = field[2]; }
  const rect = Buffer.alloc(200 * fh * 3, figLum);
  return sharp(bg, { raw: { width: W, height: H, channels: 3 } })
    .composite([{ input: rect, raw: { width: 200, height: fh, channels: 3 }, top: Math.round((H - fh) / 2), left: 100 }])
    .png().toBuffer();
}

if (process.argv.includes('--selftest')) {
  const GOOD = { figLum: 200, field: [93, 86, 87], scale: 1 };
  const cases = [
    ['inverted polarity', { figLum: 20, field: [93, 86, 87], scale: 1 }],
    ['field mismatch', { figLum: 200, field: [57, 183, 232], scale: 1 }],
    ['half-scale figure', { figLum: 200, field: [93, 86, 87], scale: 0.5 }],
  ];
  let pass = 0, total = 0;
  const ok = await measure(await synth(GOOD), 'CTRL-A');
  const ok2 = await measure(await synth(GOOD), 'CTRL-B');
  total++;
  const f0 = verdict(ok, ok2);
  if (f0.length === 0) { pass++; console.log('SELFTEST ok  known-GOOD pair -> no flags'); }
  else console.log(`SELFTEST FAIL known-GOOD pair flagged: ${f0.join(' | ')}`);
  for (const [name, bad] of cases) {
    total++;
    const m = await measure(await synth(bad), 'BAD');
    const flags = verdict(m, ok2);
    if (flags.length) { pass++; console.log(`SELFTEST ok  ${name} -> FLAGGED: ${flags.join(' | ')}`); }
    else console.log(`SELFTEST FAIL ${name} -> not flagged. NOT A GUARD.`);
  }
  console.log(`\nselftest ${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

const [ours, ref] = process.argv.slice(2);
const a = await measure(ours, 'OURS');
const b = await measure(ref, 'REF ');
show(a); show(b);
const flags = verdict(a, b);
console.log(flags.length ? `\nFLAGS:\n  ${flags.join('\n  ')}` : '\nFLAGS: none — pair is comparable');
