/**
 * VALUE-LADDER METRIC CORE — one source, evaluated in Node AND injected into the page.
 *
 * ── Why a source string rather than an import ────────────────────────────────
 * `docs/LESSONS.md` §13: instruments here have lied twice this session. The defence
 * is `--selftest` on synthetic inputs whose answer is derived by hand — but a selftest
 * only proves anything if it exercises THE SAME CODE the live capture runs. The live
 * capture runs inside `page.evaluate`, which cannot import an ES module. So the core
 * lives in one string that is `new Function`'d in Node and `addInitScript`'d into the
 * page. There is exactly one copy of every formula.
 *
 * ── Spaces and conventions, stated because getting these wrong is the whole risk ──
 *  • LUMA is `0.2126R + 0.7152G + 0.0722B` over 255 on the **sRGB-encoded framebuffer**
 *    — i.e. display luma, not linear. Deliberate: (a) it is the same formula
 *    `arena-scan.mjs` and `tools/tmp/limbcheck.mjs` use, so every number here is
 *    directly comparable to the recorded dL figures; (b) sRGB is roughly perceptually
 *    uniform in value, which is the space a "value ladder" is defined in. A LINEAR luma
 *    ladder would be dominated by highlights and would rate a near-black-to-mid step as
 *    negligible, which is the opposite of how it reads.
 *  • Every mask is TOP-DOWN image space. `gl.readPixels` is bottom-up; the caller flips
 *    before anything in here sees a pixel.
 *  • Masks are `Uint8Array`, 1 = subject.
 */

export const VL_SRC = String.raw`
// ── luma ─────────────────────────────────────────────────────────────────────
function vlLuma(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

/** Linear interpolation quantile of an ASCENDING-sorted array. */
function vlQuantile(s, q) {
  if (!s.length) return null;
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

/**
 * ── THE LADDER ───────────────────────────────────────────────────────────────
 *
 * Input: the display luma of every pixel the subject OWNS (its own matte, nothing else).
 *
 * "How many distinct value steps does this character present, and how far apart?"
 * is turned into two numbers plus a shape:
 *
 *   range   = P95 - P05. Robust value extent. A flat blob is 0; a near-black to
 *             near-white ladder is ~0.9. P05/P95 rather than min/max ON PURPOSE:
 *             one specular pixel must not be able to manufacture a ladder, and this
 *             is checked by hand in the selftest ('specular' case).
 *
 *   steps(J)= how many value PLATEAUS, each holding at least 'massPerSample' of the
 *             subject's pixels, sit at least J apart.
 *
 *             Method: take k = 1/massPerSample quantile samples (default 20 samples of
 *             5% mass each) at (i+0.5)/k. Walk them ascending with an anchor; every
 *             time a sample is >= J above the anchor, that is a new step and the anchor
 *             moves. steps is the count, starting at 1.
 *
 *             This is deliberately a MASS-GATED measure. A histogram-bin count would
 *             report a ladder for a body that is 99% mid-grey with a 1% rim, and a
 *             mode-finder would need smoothing constants nobody can justify. Here a
 *             step must carry real area to exist, which is what "reads as a value
 *             step at a glance" means. The cost is that a smooth ramp also scores
 *             high — so 'range' and 'steps' are always reported together, and the
 *             per-part table below is what separates "a ramp" from "a ladder".
 *
 * J defaults to 0.05 / 0.10 / 0.15. 0.10 is NOT invented: it is this project's own
 * recorded lighting acceptance threshold (figure/ground >= 0.10, |dL| < 0.05 = "no
 * value contrast at all"), so a step counted here is a step the project already
 * agreed is visible.
 */
function vlLadder(lumas, opts) {
  const o = opts || {};
  const jnds = o.jnds || [0.05, 0.10, 0.15];
  const mass = o.massPerSample || 0.05;
  const s = Float64Array.from(lumas); s.sort();
  const n = s.length;
  if (!n) return null;
  const k = Math.round(1 / mass);
  const samples = [];
  for (let i = 0; i < k; i++) samples.push(vlQuantile(s, (i + 0.5) / k));
  const steps = {}, stepValues = {};
  for (const j of jnds) {
    let anchor = samples[0], c = 1;
    const vals = [anchor];
    for (const v of samples) {
      if (v - anchor >= j - 1e-12) { c++; anchor = v; vals.push(v); }
    }
    const key = 'j' + Math.round(j * 100);
    steps[key] = c;
    stepValues[key] = vals.map((v) => +v.toFixed(4));
  }
  let sum = 0, sum2 = 0;
  for (let i = 0; i < n; i++) { sum += s[i]; sum2 += s[i] * s[i]; }
  const meanV = sum / n;
  const p05 = vlQuantile(s, 0.05), p50 = vlQuantile(s, 0.50), p95 = vlQuantile(s, 0.95);
  return {
    px: n,
    min: +s[0].toFixed(4), max: +s[n - 1].toFixed(4),
    p05: +p05.toFixed(4), p25: +vlQuantile(s, 0.25).toFixed(4), p50: +p50.toFixed(4),
    p75: +vlQuantile(s, 0.75).toFixed(4), p95: +p95.toFixed(4),
    mean: +meanV.toFixed(4),
    sd: +Math.sqrt(Math.max(0, sum2 / n - meanV * meanV)).toFixed(4),
    range: +(p95 - p05).toFixed(4),
    steps, stepValues,
    samples: samples.map((v) => +v.toFixed(4)),
  };
}

/** 4-connected distance to the nearest set pixel of 'mask', capped at 'cap'. */
function vlDistanceField(mask, W, H, cap) {
  const dist = new Int32Array(W * H).fill(cap);
  const q = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (let j = 0; j < W * H; j++) if (mask[j]) { dist[j] = 0; q[tail++] = j; }
  while (head < tail) {
    const p = q[head++], d = dist[p] + 1;
    if (d >= cap) continue;
    const x = p % W, y = (p / W) | 0;
    if (x > 0 && dist[p - 1] > d) { dist[p - 1] = d; q[tail++] = p - 1; }
    if (x < W - 1 && dist[p + 1] > d) { dist[p + 1] = d; q[tail++] = p + 1; }
    if (y > 0 && dist[p - W] > d) { dist[p - W] = d; q[tail++] = p - W; }
    if (y < H - 1 && dist[p + W] > d) { dist[p + W] = d; q[tail++] = p + W; }
  }
  return dist;
}

function vlBBox(mask, W, H) {
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue;
    n++;
    const x = j % W, y = (j / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return n ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
}

/**
 * ── HERO vs GROUND, on the EXACT matte ───────────────────────────────────────
 *
 * 'arena-scan.mjs' measures dL as (mean luma of a 3x2 block of a 16x9 grid) minus
 * (mean luma of the annulus of cells around it). MEASURED on the shipped frame: that
 * block is 2400 px of the 320x180 metric grid and the fighter covers ~260 of them, so
 * the recorded number is ~89% GROUND ON BOTH SIDES OF THE SUBTRACTION. It is a true
 * number answering a much narrower question than "does the hero separate from what he
 * stands on" (docs/LESSONS.md §13, the "AI stalled: 0.0%" block, exactly).
 *
 * This version subtracts the two things the sentence names:
 *   figure = every pixel of the character's own two-clear-colour matte
 *   ground = the annulus within 'ringFrac' x (character bbox height) of that matte,
 *            excluding the matte itself
 * and additionally an EDGE-LOCAL form (bands of 'edgeR' px either side of the
 * silhouette), because a hero can separate from the ground 30px away while fusing
 * with the tile directly under him.
 *
 * Both grid and matte forms are reported by the caller so the relationship to every
 * recorded figure stays visible instead of being silently replaced.
 */
function vlFigureGround(luma, W, H, mask, opts) {
  const o = opts || {};
  const bb = vlBBox(mask, W, H);
  if (!bb) return null;
  const ringR = Math.max(4, Math.round((o.ringFrac == null ? 0.30 : o.ringFrac) * bb.h));
  const edgeR = o.edgeR == null ? 4 : o.edgeR;
  const dist = vlDistanceField(mask, W, H, ringR + 2);

  const inAll = [], ringAll = [], inEdge = [], outEdge = [];
  // distance from the OUTSIDE, so an inner edge band can be defined symmetrically
  const inv = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) inv[j] = mask[j] ? 0 : 1;
  const distOut = vlDistanceField(inv, W, H, edgeR + 2);

  for (let j = 0; j < W * H; j++) {
    const L = luma[j];
    if (mask[j]) {
      inAll.push(L);
      if (distOut[j] <= edgeR) inEdge.push(L);
    } else {
      if (dist[j] <= ringR) ringAll.push(L);
      if (dist[j] <= edgeR) outEdge.push(L);
    }
  }
  const stat = (a) => {
    if (!a.length) return { px: 0, mean: null, p50: null };
    const s = Float64Array.from(a); s.sort();
    let sum = 0; for (let i = 0; i < s.length; i++) sum += s[i];
    return { px: s.length, mean: +(sum / s.length).toFixed(4), p50: +vlQuantile(s, 0.5).toFixed(4) };
  };
  const F = stat(inAll), G = stat(ringAll), FE = stat(inEdge), GE = stat(outEdge);
  return {
    bbox: [bb.x0, bb.y0, bb.w, bb.h], figurePx: bb.n, ringR, edgeR,
    figureLuma: F.mean, groundLuma: G.mean, ringPx: G.px,
    dL: +(F.mean - G.mean).toFixed(4),
    dLmedian: +(F.p50 - G.p50).toFixed(4),
    edgeInLuma: FE.mean, edgeOutLuma: GE.mean,
    dLedge: FE.mean == null || GE.mean == null ? null : +(FE.mean - GE.mean).toFixed(4),
  };
}

/**
 * arena-scan's grid dL, reproduced verbatim so this tool can be checked against a
 * KNOWN OUTPUT (the recorded SUMMARY.txt rows) before any of its own numbers are
 * believed. 'data' is raw RGB at 320x180.
 */
function vlGridDL(data, W, H) {
  const COLS = 16, ROWS = 9;
  const n = W * H;
  const luma = new Float32Array(n);
  for (let i = 0; i < n; i++) luma[i] = vlLuma(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  const cellW = W / COLS, cellH = H / ROWS;
  const cells = [];
  for (let cy = 0; cy < ROWS; cy++) for (let cx = 0; cx < COLS; cx++) {
    let sum = 0, cnt = 0;
    const x0 = Math.round(cx * cellW), x1 = Math.round((cx + 1) * cellW);
    const y0 = Math.round(cy * cellH), y1 = Math.round((cy + 1) * cellH);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += luma[y * W + x]; cnt++; }
    cells.push({ cx, cy, mean: sum / cnt });
  }
  const inPlayer = (c) => c.cx >= 7 && c.cx <= 9 && c.cy >= 4 && c.cy <= 5;
  const pc = cells.filter(inPlayer);
  const ring = cells.filter((c) => !inPlayer(c) && c.cx >= 5 && c.cx <= 11 && c.cy >= 2 && c.cy <= 7);
  const pMean = pc.reduce((s, c) => s + c.mean, 0) / pc.length;
  const rMean = ring.reduce((s, c) => s + c.mean, 0) / ring.length;
  return { playerLuma: +pMean.toFixed(3), ringLuma: +rMean.toFixed(3), deltaLuma: +(pMean - rMean).toFixed(3) };
}

/** median / mean / count of 'luma' restricted to 'owned'. */
function vlPartStat(luma, owned, W, H) {
  const a = [];
  for (let j = 0; j < W * H; j++) if (owned[j]) a.push(luma[j]);
  if (!a.length) return { px: 0, p50: null, mean: null, p10: null, p90: null };
  const s = Float64Array.from(a); s.sort();
  let sum = 0; for (let i = 0; i < s.length; i++) sum += s[i];
  return {
    px: s.length, p50: +vlQuantile(s, 0.5).toFixed(4), mean: +(sum / s.length).toFixed(4),
    p10: +vlQuantile(s, 0.10).toFixed(4), p90: +vlQuantile(s, 0.90).toFixed(4),
  };
}

/**
 * ── "does the limb separate from the thing it touches" ───────────────────────
 * For every pair of parts that actually SHARE A SCREEN-SPACE BORDER (a 4-neighbour
 * contact). Contact-gated on purpose: a hand being the same value as a foot is
 * irrelevant; a hand being the same value as the torso it is drawn against is the
 * entire finding.
 *
 * TWO different quantities are reported for every pair, and they are NOT interchangeable:
 *
 *   dL         |p50(A) - p50(B)| over each part's WHOLE mask. The original. Kept
 *              byte-for-byte because peers A/B against it and silently moving a metric
 *              under a running comparison is the fault this instrument exists to stop.
 *
 *   dLcontact  |mean(A's pixels that touch B) - mean(B's pixels that touch A)|, computed
 *              on the SAME merged owner map the 'contacts' count already comes from.
 *
 * ⚠️ THEY ARE THE SAME NUMBER ONLY WHEN BOTH PARTS ARE ROUGHLY UNIFORM, and the cast
 * is not. 'tools/tmp/p5_dlprobe.mjs' proved 'dL' wrong in BOTH directions by
 * construction, and 'valuescan --selftest' section L now carries the proof:
 *   • a part that is half 0.10 and half 0.90, with the 0.90 band against a uniform 0.50
 *     neighbour, is a HARD 0.40 STEP the eye cannot miss — 'dL' reports 0.000.
 *   • two ramps that are CONTINUOUS across the seam — no edge at all — have medians
 *     0.30 and 0.70, so 'dL' reports a confident 0.400.
 * Measured on live HEAD across 4 characters and 35 reported pairs, the two disagree on
 * the 0.10 verdict for 11 of them (31%), including the pair that produces 32.7 of
 * pizza's 41.0 'weakBoundaryPct' points.
 *
 * ⚠️ AND 'weakBoundaryPct' — the gate key built on 'dL' — IS A CLIFF, NOT A BAND. It is a
 * contact-weighted COUNT over a hard 0.10 threshold, so its step size equals the contact
 * share of whichever pair happens to sit near the threshold, not the size of any value
 * change. Measured on real commits: pizza's head|torso moved 0.1095 -> 0.0953 — 0.0142 of
 * luma, 3.6x the 8-bit floor and below anything a player can see — and weakBoundaryPct
 * moved 8.0 -> 41.0. **Never report a weakBoundaryPct move smaller than that character's
 * own cliff (pizza 32.7 pp, waterbottle 36.7, burrito 23.5, sushi 16.0) as a result.**
 * The number to steer on is the per-pair 'dLcontact', whose floor is the 8-bit
 * quantisation of the framebuffer, 1/255 = 0.0039.
 *
 * 'cA'/'cB' (the two contact-band means) and 'cpxA'/'cpxB' (how many pixels each band
 * holds) are reported too, so 'dLcontact' can be audited rather than trusted. A band of a
 * handful of pixels is a weak reading and says so by its own count.
 */
function vlAdjacency(partMasks, names, W, H, luma, minContacts) {
  const minC = minContacts == null ? 8 : minContacts;
  const stats = names.map((nm, i) => vlPartStat(luma, partMasks[i], W, H));
  const owner = new Int16Array(W * H).fill(-1);
  for (let i = 0; i < names.length; i++) {
    const m = partMasks[i];
    for (let j = 0; j < W * H; j++) if (m[j]) owner[j] = i;
  }
  const contacts = new Map();
  const bump = (a, b) => {
    if (a === b || a < 0 || b < 0) return;
    const k = a < b ? a + ':' + b : b + ':' + a;
    contacts.set(k, (contacts.get(k) || 0) + 1);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    if (owner[j] < 0) continue;
    if (x < W - 1) bump(owner[j], owner[j + 1]);
    if (y < H - 1) bump(owner[j], owner[j + W]);
  }

  // ── THE CONTACT BANDS ──────────────────────────────────────────────────────
  // One pass. For each owned pixel, the SET of distinct other owners among its four
  // neighbours; the pixel's luma is added once per distinct neighbour-owner, to the side
  // of that pair it belongs to. Counting once per distinct owner rather than once per
  // touching edge matters: a pixel in a corner touches the same neighbour twice and would
  // otherwise be double-weighted, which is a silent bias toward concave boundaries.
  //
  // 'contacts' above deliberately still counts right/down EDGES and is untouched — it is
  // the weight 'weakBoundaryPct' has always used, and a pair's weight must not move
  // because the tool learned to measure a second thing.
  const band = new Map();
  const nb = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const j = y * W + x;
    const o = owner[j];
    if (o < 0) continue;
    let k = 0;
    if (x > 0) nb[k++] = owner[j - 1];
    if (x < W - 1) nb[k++] = owner[j + 1];
    if (y > 0) nb[k++] = owner[j - W];
    if (y < H - 1) nb[k++] = owner[j + W];
    for (let i = 0; i < k; i++) {
      const p = nb[i];
      if (p < 0 || p === o) continue;
      let dup = false;
      for (let q = 0; q < i; q++) if (nb[q] === p) { dup = true; break; }
      if (dup) continue;
      const key = o < p ? o + ':' + p : p + ':' + o;
      let e = band.get(key);
      if (!e) { e = { sA: 0, nA: 0, sB: 0, nB: 0 }; band.set(key, e); }
      if (o < p) { e.sA += luma[j]; e.nA++; } else { e.sB += luma[j]; e.nB++; }
    }
  }

  const pairs = [];
  for (const [k, c] of contacts) {
    if (c < minC) continue;
    const [a, b] = k.split(':').map(Number);
    if (stats[a].p50 == null || stats[b].p50 == null) continue;
    const e = band.get(k);
    const cA = e && e.nA ? e.sA / e.nA : null;
    const cB = e && e.nB ? e.sB / e.nB : null;
    pairs.push({
      a: names[a], b: names[b], contacts: c,
      dL: +Math.abs(stats[a].p50 - stats[b].p50).toFixed(4),
      dLcontact: cA == null || cB == null ? null : +Math.abs(cA - cB).toFixed(4),
      cA: cA == null ? null : +cA.toFixed(4), cB: cB == null ? null : +cB.toFixed(4),
      cpxA: e ? e.nA : 0, cpxB: e ? e.nB : 0,
    });
  }
  // Sorted by 'dL', UNCHANGED — every recorded reading of this table quotes "the tightest
  // three pairs" in this order, and re-sorting on the new column would silently rewrite
  // what those sentences mean.
  pairs.sort((p, q) => p.dL - q.dL);
  return { pairs, stats };
}

/**
 * MASKED box-downsample. Output pixel = average of the INPUT pixels that belong to the
 * mask inside its block; output mask = 1 where any input pixel belonged.
 *
 * Exists because comparing a 1800px-tall reference character's value ladder to our
 * 136px-tall fighter's would measure resolution, not art (docs/LESSONS.md §6). A plain
 * resize would drag the reference's background into its edge pixels; weighting by the
 * matte cannot.
 */
function vlMaskedDownsample(rgb, mask, W, H, outW, outH) {
  const or_ = new Float64Array(outW * outH), og = new Float64Array(outW * outH), ob = new Float64Array(outW * outH);
  const cnt = new Float64Array(outW * outH);
  for (let y = 0; y < H; y++) {
    const oy = Math.min(outH - 1, Math.floor((y / H) * outH));
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      if (!mask[j]) continue;
      const ox = Math.min(outW - 1, Math.floor((x / W) * outW));
      const k = oy * outW + ox;
      or_[k] += rgb[j * 3]; og[k] += rgb[j * 3 + 1]; ob[k] += rgb[j * 3 + 2]; cnt[k]++;
    }
  }
  const outRgb = new Uint8Array(outW * outH * 3), outMask = new Uint8Array(outW * outH);
  for (let k = 0; k < outW * outH; k++) {
    if (!cnt[k]) continue;
    outMask[k] = 1;
    outRgb[k * 3] = Math.round(or_[k] / cnt[k]);
    outRgb[k * 3 + 1] = Math.round(og[k] / cnt[k]);
    outRgb[k * 3 + 2] = Math.round(ob[k] / cnt[k]);
  }
  return { rgb: outRgb, mask: outMask, w: outW, h: outH };
}

/** Largest 4-connected component of a mask, as a new mask. */
function vlLargestComponent(mask, W, H) {
  const comp = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const sizes = [];
  for (let j0 = 0; j0 < W * H; j0++) {
    if (!mask[j0] || comp[j0] >= 0) continue;
    const id = sizes.length; let sp = 0, n = 0;
    stack[sp++] = j0; comp[j0] = id;
    while (sp > 0) {
      const p = stack[--sp]; n++;
      const x = p % W, y = (p / W) | 0;
      if (x > 0 && mask[p - 1] && comp[p - 1] < 0) { comp[p - 1] = id; stack[sp++] = p - 1; }
      if (x < W - 1 && mask[p + 1] && comp[p + 1] < 0) { comp[p + 1] = id; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - W] && comp[p - W] < 0) { comp[p - W] = id; stack[sp++] = p - W; }
      if (y < H - 1 && mask[p + W] && comp[p + W] < 0) { comp[p + W] = id; stack[sp++] = p + W; }
    }
    sizes.push(n);
  }
  let best = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
  const out = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) if (comp[j] === best) out[j] = 1;
  return { mask: out, components: sizes.length, sizes: sizes.slice().sort((a, b) => b - a).slice(0, 6) };
}

/** Fill holes: anything not reachable from the border through the ZERO region. */
function vlFillHoles(mask, W, H) {
  const out = Uint8Array.from(mask);
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const push = (j) => { if (!seen[j] && !mask[j]) { seen[j] = 1; stack[sp++] = j; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % W, y = (p / W) | 0;
    if (x > 0) push(p - 1);
    if (x < W - 1) push(p + 1);
    if (y > 0) push(p - W);
    if (y < H - 1) push(p + W);
  }
  for (let j = 0; j < W * H; j++) if (!mask[j] && !seen[j]) out[j] = 1;
  return out;
}

/**
 * ── REFERENCE-PLATE SEGMENTATION ─────────────────────────────────────────────
 * Local-tolerance flood fill from the image border. A pixel joins the BACKGROUND when
 * it is within 'tol' (max-channel) of an already-background 4-neighbour, so smooth
 * studio gradients are absorbed while a hard character edge is not.
 *
 * This CANNOT be trusted on its own — it is verified by rendering the matte over the
 * plate and looking at it (non-negotiable #3). Plates it fails on are dropped and said
 * so, never silently kept.
 */
function vlSegmentBorderFlood(rgb, W, H, tol) {
  const t = tol == null ? 26 : tol;
  const bg = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const seed = (j) => { if (!bg[j]) { bg[j] = 1; stack[sp++] = j; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  const close = (a, b) => (
    Math.abs(rgb[a * 3] - rgb[b * 3]) <= t &&
    Math.abs(rgb[a * 3 + 1] - rgb[b * 3 + 1]) <= t &&
    Math.abs(rgb[a * 3 + 2] - rgb[b * 3 + 2]) <= t
  );
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % W, y = (p / W) | 0;
    if (x > 0 && !bg[p - 1] && close(p, p - 1)) seed(p - 1);
    if (x < W - 1 && !bg[p + 1] && close(p, p + 1)) seed(p + 1);
    if (y > 0 && !bg[p - W] && close(p, p - W)) seed(p - W);
    if (y < H - 1 && !bg[p + W] && close(p, p + W)) seed(p + W);
  }
  const fg = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) fg[j] = bg[j] ? 0 : 1;
  const filled = vlFillHoles(fg, W, H);
  const lc = vlLargestComponent(filled, W, H);
  return { mask: vlFillHoles(lc.mask, W, H), components: lc.components, sizes: lc.sizes };
}

/**
 * ── PICKING THE FLOOD TOLERANCE, instead of guessing one ─────────────────────
 * A fixed tolerance does not survive this plate set. At tol 26 the fill crossed the
 * character's anti-aliased edge on all six Brawl Stars plates and consumed the subject,
 * leaving a mask of ~0.1% of the plate that the tool would happily have reported a
 * "value ladder" for. Measured area against tolerance shows the failure is obvious and
 * automatable — there is a wide PLATEAU while only the backdrop is being eaten, then a
 * cliff the moment the fill breaks in:
 *
 *   bs_01  tol 4..14 -> 52.8 .. 52.1 %   then 16 -> 41.6, 22 -> 10.9
 *   bs_02  tol 4..10 -> 47.3 .. 45.9 %   then 12 -> 36.4, 20 -> 10.6
 *   bs_04  tol 4..6  -> 50.3 .. 49.8 %   then  8 -> 41.3, 22 ->  2.0
 *
 * So: walk the tolerance up and stop at the last value before the area falls by more
 * than 'stability'. The chosen tolerance and the whole area/tolerance curve are
 * returned, so the choice is auditable rather than magic — and the mask still has to be
 * looked at.
 */
function vlSegmentAuto(rgb, W, H, opts) {
  const o = opts || {};
  const tols = o.tols || [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20];
  const stability = o.stability == null ? 0.95 : o.stability;
  const areas = [];
  let prev = null, chosen = null, chosenSeg = null;
  for (const t of tols) {
    const seg = vlSegmentBorderFlood(rgb, W, H, t);
    let n = 0;
    for (let j = 0; j < W * H; j++) n += seg.mask[j];
    areas.push({ tol: t, pct: +((100 * n) / (W * H)).toFixed(2) });
    if (prev === null || n >= prev * stability) { chosen = t; chosenSeg = seg; prev = n; }
    else break;
  }
  let n = 0;
  for (let j = 0; j < W * H; j++) n += chosenSeg.mask[j];
  return {
    mask: chosenSeg.mask, components: chosenSeg.components, sizes: chosenSeg.sizes,
    tol: chosen, areas, coveragePct: +((100 * n) / (W * H)).toFixed(2),
  };
}

globalThis.VL = {
  segmentAuto: vlSegmentAuto,
  luma: vlLuma, quantile: vlQuantile, ladder: vlLadder, bbox: vlBBox,
  distanceField: vlDistanceField, figureGround: vlFigureGround, gridDL: vlGridDL,
  partStat: vlPartStat, adjacency: vlAdjacency, maskedDownsample: vlMaskedDownsample,
  largestComponent: vlLargestComponent, fillHoles: vlFillHoles,
  segmentBorderFlood: vlSegmentBorderFlood,
};
`;

// Define the same functions in this process. One source, two runtimes.
new Function(VL_SRC)();
export const VL = globalThis.VL;
