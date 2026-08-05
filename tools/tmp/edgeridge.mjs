#!/usr/bin/env node
/**
 * EDGE RIDGE — does a boundary between two flat regions carry a BRIGHT LINE?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * A blind critic looking at `pot_diagonal` said the pink/teal boundary "is a hard
 * straight edge with a bright cyan rim and reads as a picture-in-picture window
 * pasted over the frame". Two of those three words are opinions; ONE of them is a
 * measurable image property, and it is the one that does the damage:
 *
 *     a RIDGE — a line of pixels brighter than the surface on BOTH sides of it.
 *
 * That is the signature of a stroke around a shape, i.e. of UI, and it is what makes
 * a region read as pasted on rather than as part of the scene. A step between two
 * ground materials is normal (`bs_04`'s mown-grass bands are one); a step with a
 * bright ridge sitting on it is not.
 *
 * So this measures ONE number per boundary crossing:
 *
 *     overshoot = max(luma across the boundary) - max(luma of the two plateaus)
 *
 * and it is designed to be run on OUR frames and on the REFERENCE PLATES with the
 * same code, because the whole question is whether the reference does this too.
 *
 * ── Method ──────────────────────────────────────────────────────────────────────
 * Sample a 1-D profile along a segment that crosses the boundary, averaged over
 * `--band` parallel offsets perpendicular to it (default 9) so a single noisy row
 * cannot invent a ridge. Plateau A = median of the first 20% of the profile,
 * plateau B = median of the last 20%, the ridge is searched in the middle 60%.
 *
 * Luma is `0.2126R + 0.7152G + 0.0722B` on 8-bit sRGB values scaled to 0..1, the
 * same definition `tools/tmp/matcover.mjs` and `tools/arena-scan.mjs` print.
 *
 * ⚠️ `--selftest` FIRST. `docs/LESSONS.md` §13: eleven instruments on this project
 * have returned confident wrong answers. This one is checked against synthetic
 * images whose overshoot is known by construction before it is believed on a frame.
 *
 *   node tools/tmp/edgeridge.mjs --selftest
 *   node tools/tmp/edgeridge.mjs --img shots/x.png --line 930,650,1070,650 --label "hub pad W edge"
 *   node tools/tmp/edgeridge.mjs --spec probes/edges.json
 */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const has = (k) => process.argv.includes('--' + k);

const LUMA = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** HSV saturation on 8-bit sRGB, the definition `matcover` prints. */
function sat(r, g, b) {
  const mx = Math.max(r, g, b);
  return mx ? (mx - Math.min(r, g, b)) / mx : 0;
}

async function loadRGB(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/** Bilinear sample; clamps to the image rather than wrapping. */
function samplePx(img, x, y) {
  const { data, w, h, ch } = img;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const at = (xx, yy, c) => data[(yy * w + xx) * ch + c];
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx;
    const b = at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
  return out;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/**
 * @param img   loaded RGB image
 * @param line  [x0,y0,x1,y1] — must CROSS the boundary, roughly perpendicular to it
 * @param band  number of parallel offsets averaged (odd; centred on the line)
 */
function profile(img, [x0, y0, x1, y1], band = 9) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const n = Math.max(8, Math.round(len));
  const ux = dx / len, uy = dy / len;      // along
  const nx = -uy, ny = ux;                 // perpendicular
  const half = (band - 1) / 2;
  const L = new Float64Array(n + 1);
  const S = new Float64Array(n + 1);
  const RGB = [];
  for (let i = 0; i <= n; i++) {
    let r = 0, g = 0, b = 0;
    for (let k = -half; k <= half; k++) {
      const px = x0 + ux * (i / n) * len + nx * k;
      const py = y0 + uy * (i / n) * len + ny * k;
      const c = samplePx(img, px, py);
      r += c[0]; g += c[1]; b += c[2];
    }
    r /= band; g /= band; b /= band;
    L[i] = LUMA(r, g, b);
    S[i] = sat(r, g, b);
    RGB.push([Math.round(r), Math.round(g), Math.round(b)]);
  }
  return { L, S, RGB, n };
}

function analyse(p) {
  const { L, S, RGB, n } = p;
  const edgeN = Math.max(2, Math.round((n + 1) * 0.2));
  const A = median(Array.from(L.slice(0, edgeN)));
  const B = median(Array.from(L.slice(n + 1 - edgeN)));
  const As = median(Array.from(S.slice(0, edgeN)));
  const Bs = median(Array.from(S.slice(n + 1 - edgeN)));
  const lo = edgeN, hi = n + 1 - edgeN;
  let ridge = -Infinity, ridgeI = lo, trough = Infinity, troughI = lo;
  for (let i = lo; i < hi; i++) {
    if (L[i] > ridge) { ridge = L[i]; ridgeI = i; }
    if (L[i] < trough) { trough = L[i]; troughI = i; }
  }
  const hiPlateau = Math.max(A, B);
  const loPlateau = Math.min(A, B);
  // 10-90 transition width of the underlying STEP, measured on the monotone part
  // between the two plateaus (meaningless when a ridge dominates, so it is reported
  // alongside the overshoot, never instead of it).
  const t10 = loPlateau + 0.1 * (hiPlateau - loPlateau);
  const t90 = loPlateau + 0.9 * (hiPlateau - loPlateau);
  let first = null, last = null;
  for (let i = 0; i <= n; i++) {
    const v = L[i];
    if (v >= t10 && v <= t90) { if (first === null) first = i; last = i; }
  }
  const width = first === null ? 0 : last - first + 1;
  return {
    plateauA: A, plateauB: B, satA: As, satB: Bs,
    step: Math.abs(B - A),
    ridge, ridgeI, overshoot: ridge - hiPlateau,
    trough, troughI, undershoot: loPlateau - trough,
    ridgeRGB: RGB[ridgeI], ridgeSat: S[ridgeI], width, n,
  };
}

function fmt(r, label) {
  const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(4);
  return `${label.padEnd(30)} A ${r.plateauA.toFixed(3)}/s${r.satA.toFixed(2)}  B ${r.plateauB.toFixed(3)}/s${r.satB.toFixed(2)}  step ${r.step.toFixed(3)}` +
    `  RIDGE ${r.ridge.toFixed(3)}/s${r.ridgeSat.toFixed(2)} rgb(${r.ridgeRGB.join(',')})  overshoot ${pct(r.overshoot)}` +
    `  undershoot ${pct(r.undershoot)}  w ${String(r.width).padStart(3)}px`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selftest — synthetic images whose answer is known by construction
// ─────────────────────────────────────────────────────────────────────────────
async function synth(path, spec) {
  const W = 200, H = 60;
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = spec(x);
      const i = (y * W + x) * 3;
      buf[i] = buf[i + 1] = buf[i + 2] = v;
    }
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path);
}

async function selftest() {
  let pass = 0, fail = 0;
  const ok = (name, got, want, tol) => {
    const good = Math.abs(got - want) <= tol;
    good ? pass++ : fail++;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${name.padEnd(46)} got ${got.toFixed(4)} want ${want.toFixed(4)} +-${tol}`);
  };
  const dir = tmpdir();

  // 1. Pure step, no ridge. Grey 77 -> grey 128; overshoot must be 0.
  const a = join(dir, 'edgeridge_step.png');
  await synth(a, (x) => (x < 100 ? 77 : 128));
  let r = analyse(profile(await loadRGB(a), [40, 30, 160, 30]));
  ok('step: plateau A', r.plateauA, 77 / 255, 0.002);
  ok('step: plateau B', r.plateauB, 128 / 255, 0.002);
  ok('step: overshoot is ZERO', r.overshoot, 0, 0.003);
  ok('step: undershoot is ZERO', r.undershoot, 0, 0.003);

  // 2. Same step with a 6px bright bar (204) straddling it — a stroke. The bar is
  //    brighter than both sides, so overshoot must be (204-128)/255 = 0.298.
  const b = join(dir, 'edgeridge_ridge.png');
  await synth(b, (x) => (x >= 97 && x < 103 ? 204 : x < 100 ? 77 : 128));
  r = analyse(profile(await loadRGB(b), [40, 30, 160, 30]));
  ok('ridge: overshoot found', r.overshoot, (204 - 128) / 255, 0.006);
  ok('ridge: plateaus untouched', r.plateauB - r.plateauA, (128 - 77) / 255, 0.004);

  // 3. Same step with a 6px DARK bar (26) — a contact shadow, not a stroke. Overshoot
  //    must stay 0 and undershoot must find it. The two must never be confused.
  const c = join(dir, 'edgeridge_trough.png');
  await synth(c, (x) => (x >= 97 && x < 103 ? 26 : x < 100 ? 77 : 128));
  r = analyse(profile(await loadRGB(c), [40, 30, 160, 30]));
  ok('trough: overshoot stays ZERO', r.overshoot, 0, 0.003);
  ok('trough: undershoot found', r.undershoot, (77 - 26) / 255, 0.006);

  // 4. A soft ramp 20px wide must report a WIDE step and no ridge.
  const d = join(dir, 'edgeridge_ramp.png');
  await synth(d, (x) => (x <= 90 ? 77 : x >= 110 ? 128 : Math.round(77 + (128 - 77) * ((x - 90) / 20))));
  r = analyse(profile(await loadRGB(d), [40, 30, 160, 30]));
  ok('ramp: overshoot is ZERO', r.overshoot, 0, 0.003);
  ok('ramp: 10-90 width ~16px', r.width, 17, 3);

  // 5. Direction invariance — reading the same edge backwards must give the same
  //    overshoot. (A profile tool that is not symmetric is measuring its own scan.)
  r = analyse(profile(await loadRGB(b), [160, 30, 40, 30]));
  ok('reversed: same overshoot', r.overshoot, (204 - 128) / 255, 0.006);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────────────────────
if (has('selftest')) { await selftest(); }

const specPath = arg('spec');
if (specPath) {
  const spec = JSON.parse(await readFile(specPath, 'utf8'));
  const band = Number(arg('band', spec.band ?? 9));
  let lastImg = null, lastPath = null;
  for (const group of spec.groups) {
    console.log(`\n${group.title}`);
    for (const e of group.edges) {
      if (e.img !== lastPath) { lastImg = await loadRGB(e.img); lastPath = e.img; }
      const r = analyse(profile(lastImg, e.line, band));
      console.log('  ' + fmt(r, e.label));
    }
  }
  console.log('');
  process.exit(0);
}

const img = arg('img');
if (!img) { console.error('usage: --img <png> --line x0,y0,x1,y1 | --spec <json> | --selftest'); process.exit(2); }
const line = arg('line').split(',').map(Number);
const p = profile(await loadRGB(img), line, Number(arg('band', 9)));
const r = analyse(p);
console.log(fmt(r, arg('label', img)));
if (has('dump')) {
  for (let i = 0; i <= p.n; i++) {
    console.log(`   ${String(i).padStart(3)}  L ${p.L[i].toFixed(3)}  s ${p.S[i].toFixed(2)}  rgb(${p.RGB[i].join(',')})`);
  }
}
