#!/usr/bin/env node
/**
 * ey_pacman — is a pupil a DISC, or a disc with a bite out of it?
 *
 * THROWAWAY, read-only. Measures ONE thing, from pixels, on a capture made by the
 * shipped path: the **solidity** of each dark eye blob.
 *
 * ── WHY SOLIDITY AND NOT THE ARITHMETIC ─────────────────────────────────────
 * `egg.ts`, `pizza.ts` and `hotdog.ts` each fixed this defect by computing, in the
 * eye's own local frame, whether the catchlight's outer edge clears the pupil's rim.
 * That arithmetic is right and it is INCOMPLETE: it is done in the eye's tangent
 * plane, and the glint is authored some distance in FRONT of the pupil, so at any
 * eye whose surface normal is turned away from the camera the glint PARALLAX-SHIFTS
 * outboard before it is seen. `soup.ts` records the same term from the other side
 * (*"the pupil stands 0.062R proud ... so it projects outboard by 0.062R * sin(0.42)
 * = 0.025R before any authored offset applies"*). waterbottle clears its rim by 4.3%
 * of a radius on paper and renders as a Pac-Man, which is that term eating the whole
 * margin. **So the measurement has to happen after projection, i.e. in pixels.**
 *
 * ── THE METRIC ───────────────────────────────────────────────────────────────
 * Threshold dark; take components; FILL HOLES; solidity = filledArea / convexHullArea.
 *   · a round pupil                      -> ~0.98-1.00
 *   · a pupil with the glint fully INSIDE -> also ~0.98-1.00, because a hole is filled
 *     and never touches the outline. That is the discrimination the whole tool is for:
 *     a catchlight is SUPPOSED to be a bright thing on a dark thing.
 *   · a pupil the glint STRADDLES         -> the bite is a notch in the outline, and
 *     the hull spans it with a chord. Donut's geometry predicts 0.865 by hand.
 *
 * ⚠️ It does NOT measure gaze direction, glint size, or whether an eye is any good.
 * It answers "is the dark shape whole", which is the one thing `valuescan`, `sepscan`
 * and `limbmatch` cannot express (none of them describes a SHAPE).
 *
 * ── 🚨 THE THRESHOLD IS THE INSTRUMENT'S OWN KNOWN-BAD, AND IT FIRED ─────────
 * The first version of this tool defaulted to `--dark 0.22` and **reversed the sign of
 * a real fix**: egg's rebuilt eye measured 0.8469 -> 0.8408 (worse) while the 12x crop
 * showed the Pac-Man plainly gone. A pupil is a LIT ELLIPSOID, not a flat swatch: its
 * albedo is 0.045 but its key-lit upper quadrant renders around 0.30-0.45, so a 0.22
 * cut keeps only the SHADED LOBE of the pupil and throws its lit side in with the
 * sclera. Every number was then computed on a crescent that the geometry never had,
 * and the catchlight — correctly inside the pupil — sat on the boundary of that
 * crescent and scored as a notch.
 *
 * The default is 0.55, and the check that it is right is that **the answer stops
 * moving**: dark 0.55 and dark 0.65 agree to four decimals on every character
 * measured, because 0.55 sits on the plateau between the pupil's lit side (~0.45 top)
 * and the sclera (~0.90 bottom). Below 0.45 the answer swings by 0.15. `--sweep` runs
 * that check for you; if two thresholds an octave apart disagree, the number is the
 * threshold's, not the model's.
 *
 * ── KNOWN-BAD INPUTS (`--selftest`), CLAUDE.md #6 ────────────────────────────
 * Six synthetic frames, every expected value derived by hand from circle geometry
 * rather than from a previous run of this tool:
 *   1. a plain disc                    -> exactly 1 component, solidity >= 0.97
 *   2. a disc with an INTERIOR hole    -> still >= 0.97   (proves the fill works;
 *                                         without it this returns ~0.86 and the tool
 *                                         would condemn a CORRECT catchlight)
 *   3. a disc bitten at d=0.762R by a  -> 0.865 +/- 0.02  (donut's own numbers; the
 *      0.4286R glint                       lens/segment derivation is in the code)
 *   4. a disc bitten HARD (d=0.60R,    -> <= 0.80         (must move the right way)
 *      r=0.60R)
 *   5. an empty frame                  -> ZERO components, not one giant one
 *   6. two discs                       -> exactly 2, and both solid
 *   7. a SHADED disc (a linear ramp from 0.05 to 0.42 across it, i.e. a lit pupil)
 *      with an interior hole            -> >= 0.97 at the 0.55 default, and the same
 *      frame scores <= 0.90 at 0.22. **The tool must state the threshold that broke
 *      it, or the next agent re-learns it.** This is the case that fired for real.
 *
 *   node tools/tmp/ey_pacman.mjs --selftest
 *   node tools/tmp/ey_pacman.mjs --in shots/ey/before/donut_p20.png \
 *     --rect 240,590,420,300 --sweep
 */
import sharp from 'sharp';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);

/** 4-connected components of `mask` over w x h. Returns pixel index lists. */
function components(mask, w, h, minPx) {
  const seen = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    stack.length = 0; stack.push(i); seen[i] = 1;
    const px = [];
    while (stack.length) {
      const p = stack.pop();
      px.push(p);
      const x = p % w;
      if (x > 0 && mask[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (p >= w && mask[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (p < w * (h - 1) && mask[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (px.length >= minPx) out.push(px);
  }
  return out;
}

/**
 * Fill the holes of one component: rasterise it into its own padded bbox, flood the
 * OUTSIDE from the border, and everything unreached is either the shape or a hole.
 * Returns { pts:[[x,y]...], area } in original coordinates.
 */
function fillHoles(px, w) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of px) {
    const x = p % w, y = (p / w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 3, bh = y1 - y0 + 3;          // 1 px of border all round
  const inShape = new Uint8Array(bw * bh);
  for (const p of px) inShape[(((p / w) | 0) - y0 + 1) * bw + ((p % w) - x0 + 1)] = 1;
  const outside = new Uint8Array(bw * bh);
  const st = [0];
  outside[0] = 1;
  while (st.length) {
    const q = st.pop();
    const x = q % bw, y = (q / bw) | 0;
    const push = (r) => { if (!outside[r] && !inShape[r]) { outside[r] = 1; st.push(r); } };
    if (x > 0) push(q - 1);
    if (x < bw - 1) push(q + 1);
    if (y > 0) push(q - bw);
    if (y < bh - 1) push(q + bw);
  }
  const pts = [];
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!outside[y * bw + x]) pts.push([x + x0 - 1, y + y0 - 1]);
    }
  }
  return { pts, x0, y0, x1, y1 };
}

/** Monotone-chain convex hull; input may be unsorted. */
function hull(pts) {
  const p = pts.slice().sort((u, v) => (u[0] - v[0]) || (u[1] - v[1]));
  if (p.length < 3) return p;
  const cross = (o, m, n) => (m[0] - o[0]) * (n[1] - o[1]) - (m[1] - o[1]) * (n[0] - o[0]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const hi = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  lo.pop(); hi.pop();
  return lo.concat(hi);
}

/** Shoelace area of a polygon. Pixels are unit squares, so the hull of a rasterised
 *  disc under-reads by roughly its own perimeter; `+0.5*perimeter` is the standard
 *  correction and it is applied to BOTH arms of every comparison. */
function polyArea(h) {
  let s = 0, per = 0;
  for (let i = 0; i < h.length; i++) {
    const [x1, y1] = h[i], [x2, y2] = h[(i + 1) % h.length];
    s += x1 * y2 - x2 * y1;
    per += Math.hypot(x2 - x1, y2 - y1);
  }
  return Math.abs(s) / 2 + per / 2 + 1;
}

/** The whole measurement, on a raw RGB buffer. */
function measure(buf, w, h, dark, minPx) {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const L = (0.2126 * buf[i * 3] + 0.7152 * buf[i * 3 + 1] + 0.0722 * buf[i * 3 + 2]) / 255;
    mask[i] = L < dark ? 1 : 0;
  }
  const comps = components(mask, w, h, minPx);
  const rows = comps.map((px) => {
    const f = fillHoles(px, w);
    const hu = hull(f.pts);
    const hullA = polyArea(hu);
    const filledA = f.pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of f.pts) { cx += x; cy += y; }
    return {
      raw: px.length, filled: filledA, hull: +hullA.toFixed(1),
      holes: filledA - px.length,
      solidity: +(filledA / hullA).toFixed(4),
      cx: Math.round(cx / f.pts.length), cy: Math.round(cy / f.pts.length),
      bbox: [f.x0, f.y0, f.x1 - f.x0 + 1, f.y1 - f.y0 + 1],
    };
  });
  rows.sort((u, v) => u.cx - v.cx);
  return rows;
}

// ── selftest ────────────────────────────────────────────────────────────────
if (a.includes('--selftest')) {
  const W = 200, H = 200;
  const frame = (draw) => {
    const b = new Uint8Array(W * H * 3).fill(220);
    draw((x, y, v) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 3; b[i] = b[i + 1] = b[i + 2] = v;
    });
    return b;
  };
  const disc = (put, cx, cy, r, v) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, v);
      }
    }
  };
  const R = 40;
  const checks = [];
  const run = (name, buf, fn) => {
    const rows = measure(buf, W, H, 0.55, 60);
    const ok = fn(rows);
    checks.push([name, ok, rows.map((r) => `n=${r.filled} sol=${r.solidity}`).join(' | ') || '(none)']);
  };

  run('1 plain disc: 1 component, solidity >= 0.97',
    frame((p) => disc(p, 100, 100, R, 10)),
    (r) => r.length === 1 && r[0].solidity >= 0.97);

  run('2 disc + INTERIOR hole: still >= 0.97 (the fill is load-bearing)',
    frame((p) => { disc(p, 100, 100, R, 10); disc(p, 100 - R * 0.4, 100 - R * 0.4, R * 0.3, 255); }),
    (r) => r.length === 1 && r[0].solidity >= 0.97 && r[0].holes > 100);

  // Donut's own numbers. Pupil radius R, glint radius 0.4286R centred 0.762R out.
  //   lens (bite) area          = 0.4616 R^2   (two-circle intersection)
  //   pupil cap beyond the chord = 0.0435 R^2
  //   solidity = (pi - 0.4616) / (pi - 0.0435) = 2.6800 / 3.0981 = 0.8650
  run('3 donut bite d=0.762R r=0.4286R: 0.865 +/- 0.02',
    frame((p) => { disc(p, 100, 100, R, 10); disc(p, 100 - R * 0.762 * 0.5, 100 - R * 0.762 * 0.866, R * 0.4286, 255); }),
    (r) => r.length === 1 && Math.abs(r[0].solidity - 0.865) <= 0.02);

  run('4 hard bite d=0.60R r=0.60R: <= 0.80 (moves the right way)',
    frame((p) => { disc(p, 100, 100, R, 10); disc(p, 100 - R * 0.60, 100, R * 0.60, 255); }),
    (r) => r.length === 1 && r[0].solidity <= 0.80);

  run('5 nothing dark: ZERO components',
    frame(() => {}),
    (r) => r.length === 0);

  run('6 two discs: exactly 2, both solid, ordered left-to-right',
    frame((p) => { disc(p, 60, 100, 25, 10); disc(p, 150, 100, 25, 10); }),
    (r) => r.length === 2 && r[0].cx < r[1].cx && r.every((q) => q.solidity >= 0.97));

  // 7. THE ONE THAT FIRED FOR REAL. A pupil is a lit ellipsoid: shade it from 0.05 at
  //    the bottom-right to 0.42 at the top-left and put the catchlight properly INSIDE
  //    it. At the 0.55 default that is one solid blob with a hole. At 0.22 the lit half
  //    is thrown in with the sclera and what is left is a crescent the geometry never
  //    had — which is how this tool reported egg's fixed eye as a REGRESSION.
  const shaded = frame((p) => {
    for (let y = 100 - R; y <= 100 + R; y++) {
      for (let x = 100 - R; x <= 100 + R; x++) {
        if ((x - 100) ** 2 + (y - 100) ** 2 > R * R) continue;
        const t = ((100 - x) + (100 - y)) / (4 * R) + 0.5;      // 0 .. 1 across the disc
        p(x, y, Math.round((0.05 + 0.37 * t) * 255));
      }
    }
    disc(p, 100 - R * 0.30, 100 - R * 0.30, R * 0.34, 250);      // catchlight, INSIDE
  });
  run('7 SHADED pupil + interior catchlight: >= 0.97 at the 0.55 default', shaded,
    (r) => r.length === 1 && r[0].solidity >= 0.97 && r[0].holes > 100);
  // 7b. THE TRAP, STATED AS THE THING THAT CAN BE CHECKED. What went wrong is not that
  //     0.22 gives a lower number — a half-disc is convex and scores WELL, which is why
  //     the mistake was invisible. It is that 0.22 is measuring a DIFFERENT OBJECT: it
  //     keeps only the shaded lobe. So the assertion is on the pixel count, not the
  //     solidity. An implementation that thresholded on the plateau would keep ~all of
  //     it; this one keeps under 60%, and two numbers computed on different objects
  //     must never be compared — which is exactly what reversed egg's verdict.
  {
    const at22 = measure(shaded, W, H, 0.22, 60);
    const at55 = measure(shaded, W, H, 0.55, 60);
    const kept = at22.length && at55.length ? at22[0].filled / at55[0].filled : 0;
    checks.push(['7b …and dark 0.22 keeps under 60% of the same pupil — a DIFFERENT object',
      kept > 0 && kept <= 0.60, `kept ${(kept * 100).toFixed(1)}% (${at22[0]?.filled} of ${at55[0]?.filled} px)`]);
  }

  // 7c. THE STABILITY CHECK `--sweep` runs, asserted here so it cannot rot: on the
  //     plateau the answer must stop moving. 0.55 and 0.65 agree; 0.22 does not.
  {
    const s55 = measure(shaded, W, H, 0.55, 60)[0];
    const s65 = measure(shaded, W, H, 0.65, 60)[0];
    checks.push(['7c 0.55 and 0.65 agree within 0.01 — the plateau is real',
      !!s55 && !!s65 && Math.abs(s55.solidity - s65.solidity) <= 0.01,
      `0.55 -> ${s55?.solidity}   0.65 -> ${s65?.solidity}`]);
  }

  let bad = 0;
  for (const [n, ok, det] of checks) { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}\n       ${det}`); }
  console.log(`\ney_pacman selftest: ${checks.length - bad}/${checks.length}`);
  process.exit(bad ? 1 : 0);
}

// ── measure a capture ───────────────────────────────────────────────────────
const IN = get('--in', null);
if (!IN) { console.error('usage: --in <png> [--rect x,y,w,h] [--dark 0.22] [--min 120]'); process.exit(2); }
/** 0.55, not 0.22 — see the threshold block in the header. `--sweep` proves it. */
const DARK = Number(get('--dark', '0.55'));
const MIN = Number(get('--min', '120'));
const RECT = get('--rect', null);
/**
 * `--pupils` keeps only blobs that could BE a pupil, so a face rect does not have to
 * be hand-tuned per character (which is how a rect ends up chosen to produce a number).
 * The filter is on SHAPE ALONE and is deliberately crude: a bbox between 0.55 and 1.8
 * in aspect, and a fill of at least 0.35 of its own bbox. It excludes the two things a
 * face rect always also contains — the inverted-hull OUTLINES, which are long thin
 * ribbons at 0.05-0.30 solidity, and the MOUTH, which is 3-8x wider than it is tall.
 * ⚠️ It cannot exclude a round dark thing that is not an eye; every candidate is
 * printed, and the bbox is printed with it, so a wrong pick is visible rather than
 * silent.
 */
const PUPILS = a.includes('--pupils');

let img = sharp(IN);
if (RECT) {
  const [x, y, w, h] = RECT.split(',').map(Number);
  const m = await img.metadata();
  img = img.extract({
    left: Math.max(0, x), top: Math.max(0, y),
    width: Math.min(w, m.width - Math.max(0, x)), height: Math.min(h, m.height - Math.max(0, y)),
  });
}
const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (a.includes('--sweep')) {
  // The stability check the header describes: if two thresholds an octave apart do not
  // agree, the number belongs to the threshold and not to the model.
  console.log(`${IN}${RECT ? ` [${RECT}]` : ''}  THRESHOLD SWEEP  (--pupils, min=${MIN})`);
  for (const d of [0.22, 0.35, 0.45, 0.55, 0.65, 0.75]) {
    const rs = measure(data, info.width, info.height, d, MIN)
      .filter((r) => { const [, , bw, bh] = r.bbox; return bw / bh >= 0.55 && bw / bh <= 1.8 && r.filled / (bw * bh) >= 0.35; });
    console.log(`  dark<${d.toFixed(2)}  ` + (rs.map((r) => `${r.solidity.toFixed(4)} (${r.bbox[2]}x${r.bbox[3]}px @${r.cx},${r.cy})`).join('  ') || '(none)'));
  }
  process.exit(0);
}

let rows = measure(data, info.width, info.height, DARK, MIN);
if (PUPILS) {
  rows = rows.filter((r) => {
    const [, , bw, bh] = r.bbox;
    const aspect = bw / bh;
    return aspect >= 0.55 && aspect <= 1.8 && r.filled / (bw * bh) >= 0.35;
  });
}
console.log(`${IN}${RECT ? ` [${RECT}]` : ''}  dark<${DARK}  min=${MIN}px${PUPILS ? '  --pupils' : ''}`);
console.log('  #   px    filled   holes    hull   SOLIDITY   at (x,y)   bbox');
rows.forEach((r, i) => {
  console.log(`  ${i}  ${String(r.raw).padStart(5)}  ${String(r.filled).padStart(6)}  ${String(r.holes).padStart(5)}`
    + `  ${String(r.hull).padStart(7)}    ${r.solidity.toFixed(4)}   ${String(r.cx).padStart(4)},${String(r.cy).padStart(4)}`
    + `   ${r.bbox.join('x')}`);
});
