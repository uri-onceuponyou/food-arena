#!/usr/bin/env node
/**
 * cx_eyes — how many pixels each SCLERA delivers, and how far above 0.85 luma they get.
 *
 * THROWAWAY, read-only. Two questions, both of which this project has been answering
 * by eye and by adjective:
 *
 *  1. *"The two eyes are drastically different sizes"* — said by two independent blind
 *     critics about Egg, unprompted. That is a claim about two AREAS and nobody had
 *     measured them. The hypothesis under test is that the whole difference is head
 *     YAW (`stance.headTurn`) foreshortening the far eye, in which case the ratio must
 *     move when the yaw moves and nothing about the eyes themselves needs touching.
 *
 *  2. `docs/DECISIONS-FOR-URI.md` §40 pattern 2: **0% of our eye pixels are above 0.85
 *     luma against the reference's 31.1% / 34.1%.** That number is quoted constantly
 *     and was measured before Egg had a sclera at all. This re-measures it.
 *
 * METHOD. Threshold the frame at `--thresh` (default 0.85 luma), flood-fill 4-connected
 * components, drop anything under `--min` px, and report the largest components sorted
 * left-to-right. On these captures the sclerae are the only near-white masses on the
 * character — the background is a graded backdrop that never reaches 0.85 — so the
 * components ARE the eyes. That assumption is checked, not assumed: `--dump` writes the
 * mask so it can be looked at.
 *
 * ⚠️ KNOWN-BAD INPUT (`--selftest`). A guard that has not been shown to FAIL on the bug
 * it guards against is not a guard (CLAUDE.md #6). Three synthetic frames with answers
 * derived BY HAND:
 *   · two discs of radius 20 and 10 -> areas must come back 2:1 within 2%, ratio 0.25
 *   · one disc -> exactly ONE component (a splitter that halves a blob would fail)
 *   · a frame with nothing above threshold -> ZERO components, not one giant one
 *
 *   node tools/tmp/cx_eyes.mjs --selftest
 *   node tools/tmp/cx_eyes.mjs --in shots/cx/before/egg.png --rect 150,350,660,560
 */
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);

/** Components of `mask` (Uint8Array, 1 = in) over w x h, 4-connected. */
function components(mask, w, h, minPx) {
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    let n = 0, sx = 0, sy = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (n >= minPx) out.push({ n, cx: sx / n, cy: sy / n, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  return out.sort((p, q) => p.cx - q.cx);
}

function maskFromRaw(px, w, h, thresh, below = false) {
  const m = new Uint8Array(w * h);
  let above = 0;
  for (let i = 0; i < w * h; i++) {
    const L = (0.2126 * px[i * 3] + 0.7152 * px[i * 3 + 1] + 0.0722 * px[i * 3 + 2]) / 255;
    if (below ? L < thresh : L > thresh) { m[i] = 1; above++; }
  }
  return { m, above };
}

if (a.includes('--selftest')) {
  const W = 200, H = 120;
  const draw = (discs) => {
    const px = new Uint8Array(W * H * 3).fill(40);
    for (const [cx, cy, r] of discs) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { const i = (y * W + x) * 3; px[i] = px[i + 1] = px[i + 2] = 255; }
      }
    }
    return px;
  };
  let pass = 0, fail = 0;
  const check = (name, got, want) => {
    const ok = got === want;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}  got=${got} want=${want}`);
    ok ? pass++ : fail++;
  };
  // Areas derived by hand: pi*r^2 for r=20 is 1257, for r=14.14 is 628 — exactly 2:1.
  const two = components(maskFromRaw(draw([[50, 60, 20], [150, 60, 14.142]]), W, H, 0.85).m, W, H, 20);
  check('two discs -> 2 components', two.length, 2);
  check('left disc is the bigger one', two[0].n > two[1].n, true);
  check('area ratio is 0.50 within 2%', Math.abs(two[1].n / two[0].n - 0.5) < 0.02, true);
  const one = components(maskFromRaw(draw([[100, 60, 25]]), W, H, 0.85).m, W, H, 20);
  check('THE SPLITTER BUG: one disc stays ONE component', one.length, 1);
  const none = components(maskFromRaw(draw([]), W, H, 0.85).m, W, H, 20);
  check('THE BUG: nothing above threshold -> 0 components', none.length, 0);
  const tiny = components(maskFromRaw(draw([[100, 60, 3]]), W, H, 0.85).m, W, H, 200);
  check('a blob under --min is dropped', tiny.length, 0);
  console.log(`\ncx_eyes selftest: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

const IN = get('--in', null);
if (!IN) { console.error('usage: --in <png> [--rect x,y,w,h] [--thresh 0.85] [--min 60] [--dump out.png]'); process.exit(2); }
const thresh = Number(get('--thresh', '0.85'));
const minPx = Number(get('--min', '60'));
let img = sharp(IN).removeAlpha();
if (a.includes('--rect')) {
  const [x, y, w, h] = get('--rect', '').split(',').map(Number);
  img = img.extract({ left: x, top: y, width: w, height: h });
}
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { m, above } = maskFromRaw(data, info.width, info.height, thresh, a.includes('--below'));
// ⚠️ THE BIGGEST NEAR-WHITE MASS IS NOT AN EYE. On these captures the shell's own
// specular highlight comes back at 293x176 px and 20k area — bigger than both eyes
// put together — so a naive "two largest components" reads the highlight against one
// eye and reports a ratio that means nothing. It was doing exactly that on the first
// run. `--maxdim` rejects anything whose bounding box is larger than an eye can be,
// and the aspect filter rejects the thin bright slivers along the shell's terminator.
const maxDim = Number(get('--maxdim', '190'));
const comps = components(m, info.width, info.height, minPx)
  .filter((c) => c.w <= maxDim && c.h <= maxDim && c.w / c.h > 0.5 && c.w / c.h < 2.0)
  .slice(0, 6);

console.log(`${IN}  ${info.width}x${info.height}  thresh=${thresh}  px>thresh=${above} (${(100 * above / (info.width * info.height)).toFixed(2)}%)`);
for (const c of comps) console.log(`  comp  area=${String(c.n).padStart(6)}  bbox=${c.w}x${c.h}  centre=(${c.cx.toFixed(0)},${c.cy.toFixed(0)})`);
if (comps.length >= 2) {
  const [p, q] = [comps[0].n, comps[1].n];
  console.log(`  EYE AREA RATIO (smaller/larger) = ${(Math.min(p, q) / Math.max(p, q)).toFixed(3)}`);
  console.log(`  EYE WIDTH RATIO                 = ${(Math.min(comps[0].w, comps[1].w) / Math.max(comps[0].w, comps[1].w)).toFixed(3)}`);
}
if (a.includes('--dump')) {
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) { const v = m[i] ? 255 : 0; out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = v; }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toFile(get('--dump', 'mask.png'));
  console.log(`  dumped mask -> ${get('--dump')}`);
}
