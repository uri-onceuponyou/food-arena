#!/usr/bin/env node
/**
 * `rg_cardgrade` — WHAT THE ROSTER CARD COLOUR ACTUALLY BECOMES ON SCREEN.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `RARITY_CARD_COLORS` in `src/game/rules.ts` is consumed two different ways and
 * only one of them shows you the colour you typed:
 *
 *   • `src/ui/icons/portraits.ts` sets the RAW hex as a CSS field (`--pc`).
 *   • `src/ui/screens/thumbs.ts` sets it as `stage.scene.background` and then the
 *     thumbnail is rendered THROUGH the post chain, so what lands on the card is
 *     the GRADED colour. `thumbs.ts` samples it back into `ThumbMeta.bg` precisely
 *     because it does not match.
 *
 * The seam between the CSS field and the baked thumbnail is only invisible while
 * those two stay close, so a palette pass that authors against the hex is authoring
 * against the wrong number. Measured on the shipped palette, the grade moves HSV
 * saturation by up to +0.261 and luma by up to +0.138. Authoring a "muted" hex and
 * getting a loud card back is the failure this file exists to prevent.
 *
 * ── WHAT IT DOES ─────────────────────────────────────────────────────────────
 * Ports `ToyGradeEffect`'s fragment shader (`src/render/stage.ts`) to JS at the
 * SHIPPED uniforms (`buildPost`, not the class defaults — those are a documented
 * trap and are NOT what ships), so a candidate palette can be priced offline in
 * milliseconds instead of a ~60 s browser round trip.
 *
 * ⚠️ THIS IS A PREDICTION, NOT A MEASUREMENT. It is validated against six real
 * `ThumbMeta.bg` readbacks (`--selftest`), and every palette it prices is still
 * confirmed by an actual `chars_metrics` run before anything is claimed. A model
 * that agrees with six points is not thereby right about a seventh.
 *
 * ── VALIDATION (`--selftest`) ────────────────────────────────────────────────
 * §A MOVES     — the six shipped hexes must predict their six measured readbacks.
 * §B KNOWN-BAD — the IDENTITY grade (no-op) must FAIL §A. A predictor that cannot
 *                be made wrong is not a predictor; this arm is what shows §A is
 *                testing the shader and not just arithmetic that always passes.
 * §C NON-EMPTY — §A asserts over a FILTERED set (chromatic tiers only). `[].every()`
 *                is `true`, so the set is asserted non-empty FIRST.
 * §D ORDERS    — the grade must be monotone in saturation: feeding a more saturated
 *                input must not return a less saturated output.
 *
 * Usage:
 *   node tools/tmp/rg_cardgrade.mjs --selftest
 *   node tools/tmp/rg_cardgrade.mjs '#BEBEBE' '#4A90D9' ...     # price hexes
 *   node tools/tmp/rg_cardgrade.mjs --json <chars_metrics.json> # read real readbacks
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── SHIPPED uniforms. `buildPost` in src/render/stage.ts, NOT the class defaults. ──
export const SHIPPED = {
  satAmount: 1.19, satKnee: 0.55, contrastAmount: 0.72, highlightKnee: 0.82,
  shadowToe: 0.28, toeKnee: 0.60, toeChromaKeep: 0.55,
};
/** The no-op grade — §B's known-bad. */
export const IDENTITY = {
  satAmount: 0, satKnee: 0.55, contrastAmount: 0, highlightKnee: 1e9,
  shadowToe: 0, toeKnee: 0.60, toeChromaKeep: 0.55,
};

const LUMA = [0.2126, 0.7152, 0.0722];
const dot3 = (c, k) => c[0] * k[0] + c[1] * k[1] + c[2] * k[2];
const softKnee = (x, k) => {
  const head = Math.max(1 - k, 1e-4);
  return x < k ? x : k + head * (1 - Math.exp(-(x - k) / head));
};

/**
 * `TOY_GRADE_SHADER`'s `mainImage`, line for line.
 *
 * `ToyGradeEffect` sets `inputColorSpace = THREE.SRGBColorSpace`, so the shader runs
 * on DISPLAY-ENCODED values — there is no linearise/de-linearise around this. Input
 * and output are both sRGB 0..1.
 */
export function grade(rgb01, U = SHIPPED) {
  let c = rgb01.map((v) => Math.max(v, 0));

  // ── Highlight shoulder: scale by the brightest channel's rolloff ──
  const m = Math.max(c[0], c[1], c[2]);
  if (m > U.highlightKnee) {
    const s = softKnee(m, U.highlightKnee) / m;
    c = c.map((v) => v * s);
  }

  // ── Shadow toe: subtract before it scales ──
  {
    const ly = dot3(c, LUMA);
    const t = Math.min(Math.max(ly / Math.max(U.toeKnee, 1e-4), 0), 1);
    const sm = t * t * (3 - 2 * t);
    const k = 1 - ((1 - U.shadowToe) * (1 - sm) + 1 * sm);
    const want = k * ly;
    const mn = Math.min(c[0], c[1], c[2]);
    const off = U.toeChromaKeep * Math.min(want, 0.85 * mn);
    c = c.map((v) => v - off);
    const rest = Math.max(want - off, 0);
    const sc = Math.max(1 - rest / Math.max(ly - off, 1e-4), 0);
    c = c.map((v) => v * sc);
  }

  // ── Bounded contrast ──
  c = c.map((v) => v * (1 - U.contrastAmount) + v * v * (3 - 2 * v) * U.contrastAmount);

  // ── Gamut-limited saturation about luma ──
  const l = dot3(c, LUMA);
  const d = c.map((v) => v - l);
  // `step(d, 0)` is 1 where d <= 0 — GLSL step(edge,x) is x<edge?0:1, so step(d,0.0)
  // is 1 exactly when 0 >= d. mix(a,b,1) = b, so a channel BELOW luma travels toward l.
  const headroom = d.map((dv) => (dv <= 0 ? l : 1 - l));
  const lim = headroom.map((h, i) => h / Math.max(Math.abs(d[i]), 1e-4));
  const avail = Math.max(Math.min(lim[0], lim[1], lim[2]) - 1, 1e-4);
  const tUse = 0.88 * softKnee(U.satAmount / avail, U.satKnee);
  return d.map((dv) => Math.min(Math.max(l + (1 + tUse * avail) * dv, 0), 1));
}

export const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const rgb2hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
/** Predict the on-card 8-bit colour for an authored hex. */
export const gradeHex = (h, U = SHIPPED) => grade(hex2rgb(h).map((v) => v / 255), U).map((v) => v * 255);

// ── colour statistics ────────────────────────────────────────────────────────
export function stats(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const Y = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  const L = (mx + mn) / 2;
  return {
    hue: d > 1e-9 ? h : null,
    chroma: d,                                   // ABSOLUTE chroma, arena-scan's quantity
    hsvSat: mx > 0 ? d / mx : 0,
    hslSat: d < 1e-9 ? 0 : d / (1 - Math.abs(2 * L - 1)),
    value: mx,
    luma: Y,                                     // relative luminance (WCAG / polarity)
    contrastVsWhite: 1.05 / (Y + 0.05),
  };
}
/** Circular concentration R over a hue list; 1 = one hue, 0 = evenly spread. */
export function hueR(hues) {
  const hs = hues.filter((h) => h !== null);
  if (hs.length === 0) return null;
  let x = 0, y = 0;
  for (const h of hs) { x += Math.cos(h * Math.PI / 180); y += Math.sin(h * Math.PI / 180); }
  return Math.hypot(x, y) / hs.length;
}
/** How many DISTINCT 30-degree hue bins the set occupies — pc_pal's bin width. */
export function hueBins(hues) {
  return new Set(hues.filter((h) => h !== null).map((h) => Math.floor(h / 30))).size;
}

// ── the six real readbacks, from `ThumbMeta.bg` on an unmodified HEAD (adc625c) ──
// Captured by `tools/tmp/chars_metrics.mjs --vp desktop` on a detached worktree.
// These are MEASURED PIXELS, and they are what §A holds the port to.
export const MEASURED = [
  ['Normal',    '#BEBEBE', [206, 206, 206]],
  ['Rare',      '#4A90D9', [40, 150, 251]],
  ['Epic',      '#9B6FDE', [164, 97, 251]],
  ['Legendary', '#FFD84D', [253, 219, 27]],
  ['Neon',      '#E63946', [251, 25, 39]],
  ['Cyber',     '#3FD1E0', [5, 234, 250]],
];

/**
 * FIGURE/GROUND per roster card, from the shipped screenshot.
 *
 * The card's baked background is FLAT (`thumbs.ts` renders the subject on
 * `scene.background`), and `ThumbMeta.bg` records what that flat colour graded to. So
 * keying it out at a tolerance is exact for the ground and leaves the figure — which is
 * the only way to compare "the character" against "the thing presenting it".
 *
 * ⚠️ `.chars-card-gloss` lays a radial highlight and a bottom scrim OVER the card, so
 * the composited background is not one colour anywhere and the keyed "figure" set
 * includes scrim-darkened character pixels. That is deliberate: the question is what
 * the player sees, not what the renderer drew. It does mean figure luma reads LOWER
 * than the raw thumbnail's would, and the tolerance is what decides where the scrim
 * stops being background. TOL is reported so a comparison can be checked for using
 * the same one on both sides.
 */
export function figureGround(px, W, cards, TOL = 28) {
  const lum8 = (R, G, B) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(R) + 0.7152 * f(G) + 0.0722 * f(B);
  };
  const rows = [];
  for (const c of cards) {
    if (!c.hasRender || !c.meta || !c.meta.bg) continue;
    const bg = c.meta.bg;
    const bgL = lum8(...bg), bgC = (Math.max(...bg) - Math.min(...bg)) / 255;
    const x0 = Math.round(c.card.x), y0 = Math.round(c.card.y);
    const w = Math.round(c.card.w), h = Math.round(c.card.h);
    let sl = 0, sc = 0, n = 0;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * W + x) * 3, R = px[i], G = px[i + 1], B = px[i + 2];
        if (Math.max(Math.abs(R - bg[0]), Math.abs(G - bg[1]), Math.abs(B - bg[2])) < TOL) continue;
        sl += lum8(R, G, B); sc += (Math.max(R, G, B) - Math.min(R, G, B)) / 255; n++;
      }
    }
    // 🚨 A card whose figure keyed to ZERO pixels must not silently contribute a mean
    // over nothing. Report it as a fault instead — this is the vacuity case.
    rows.push({ id: c.id, n, bg, bgL, bgC, figL: n ? sl / n : null, figC: n ? sc / n : null,
      polarity: n ? sl / n - bgL : null, chromaLead: n ? sc / n - bgC : null });
  }
  return { rows, TOL };
}

function selftest() {
  let fail = 0;
  const ok = (name, cond, detail = '') => {
    console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${detail ? `   ${detail}` : ''}`);
    if (!cond) fail++;
  };
  const maxErr = (U) => Math.max(...MEASURED.map(([, hx, want]) =>
    Math.max(...gradeHex(hx, U).map((v, i) => Math.abs(v - want[i])))));

  console.log('\n§A MOVES — the port reproduces six measured ThumbMeta.bg readbacks');
  for (const [tier, hx, want] of MEASURED) {
    const got = gradeHex(hx).map((v) => Math.round(v));
    const e = Math.max(...got.map((v, i) => Math.abs(v - want[i])));
    ok(`${tier.padEnd(9)} ${hx} -> ${rgb2hex(got)}`, e <= 2, `measured ${rgb2hex(want)}  maxErr ${e}`);
  }
  ok('worst channel error over all six <= 2/255', maxErr(SHIPPED) <= 2, `${maxErr(SHIPPED).toFixed(2)}`);

  console.log('\n§B KNOWN-BAD — the IDENTITY grade must FAIL the assertion §A passes');
  // If §A passed against a no-op too, §A would be testing nothing. It must be possible
  // to be wrong here. (Normal is achromatic and moves least, so this is the weak case
  // deliberately: even IT must break.)
  const idErr = maxErr(IDENTITY);
  ok('identity grade is REJECTED by the <=2/255 bound', idErr > 2, `maxErr ${idErr.toFixed(2)} (must exceed 2)`);
  const idNormal = Math.abs(gradeHex('#BEBEBE', IDENTITY)[0] - 206);
  ok('identity is wrong even on the ACHROMATIC tier', idNormal > 2, `err ${idNormal.toFixed(2)}`);

  console.log('\n§C NON-EMPTY — §D filters to chromatic tiers; assert the set exists first');
  const chromatic = MEASURED.filter(([, hx]) => stats(hex2rgb(hx)).chroma > 0.02);
  ok('chromatic tier set is NON-EMPTY', chromatic.length > 0, `${chromatic.length} of ${MEASURED.length}`);
  ok('and it is not the whole set (Normal is achromatic and must be excluded)',
    chromatic.length < MEASURED.length, `${MEASURED.length - chromatic.length} excluded`);

  console.log('\n§D ORDERS — the grade is monotone in saturation');
  // Same hue and value, rising input saturation: output HSV saturation must not fall.
  // Integer loop: a `for (s = 0.05; s <= 0.95; s += 0.05)` float loop yields 18 stations,
  // not 19, because the accumulated 0.9500000000000001 fails the bound. That is exactly
  // the kind of silently-short set this section exists to refuse, and it caught itself.
  let mono = true, prev = -1, seen = 0;
  for (let i = 1; i <= 19; i++) {
    const s = i * 0.05;
    const rgb = [1 - s, 1 - s * 0.35, 1].map((v) => v * 0.7);   // a blue at rising sat
    const out = stats(grade(rgb).map((v) => v * 255)).hsvSat;
    if (out < prev - 1e-6) mono = false;
    prev = out; seen++;
  }
  ok('sweep produced samples (non-vacuous)', seen === 19, `${seen} stations`);
  ok('output HSV saturation never falls as input saturation rises', mono);

  console.log('\n§E FIGURE/GROUND — validated on a SYNTHETIC card with a hand-computed answer');
  {
    // A 10x10 card: 60 px of flat ground rgb(20,20,20), 40 px of figure rgb(200,180,60).
    // Both luma values are computable by hand, so the polarity is known before the run.
    const W = 10, px = new Uint8Array(W * 10 * 3);
    for (let i = 0; i < 100; i++) {
      const fig = i >= 60;
      px[i * 3] = fig ? 200 : 20; px[i * 3 + 1] = fig ? 180 : 20; px[i * 3 + 2] = fig ? 60 : 20;
    }
    const cards = [{ id: 'synthetic', hasRender: true, meta: { bg: [20, 20, 20] },
      card: { x: 0, y: 0, w: 10, h: 10 } }];
    const { rows } = figureGround(px, W, cards);
    ok('the synthetic card produced a row (non-vacuous)', rows.length === 1, `${rows.length} rows`);
    const r = rows[0];
    ok('keyed exactly the 40 figure pixels', r.n === 40, `n=${r.n}`);
    const want = 0.4508;   // relLum of rgb(200,180,60), hand-computed
    ok('figure luma matches the hand-computed value', Math.abs(r.figL - want) < 0.002, `${r.figL.toFixed(4)} vs ${want}`);
    ok('polarity is POSITIVE and equals figL - bgL', Math.abs(r.polarity - (r.figL - r.bgL)) < 1e-12 && r.polarity > 0, `${r.polarity.toFixed(4)}`);

    // KNOWN-BAD: invert the card so the figure is DARKER than its ground. The sign
    // must flip. A polarity metric that cannot go negative would have reported every
    // one of the seven negative cards on the shipped roster as fine.
    const px2 = new Uint8Array(px);
    for (let i = 0; i < 100; i++) {
      const fig = i >= 60;
      px2[i * 3] = fig ? 20 : 200; px2[i * 3 + 1] = fig ? 20 : 180; px2[i * 3 + 2] = fig ? 20 : 60;
    }
    const inv = figureGround(px2, W, [{ ...cards[0], meta: { bg: [200, 180, 60] } }]).rows[0];
    ok('INVERTED card reports NEGATIVE polarity', inv.polarity < 0, `${inv.polarity.toFixed(4)}`);

    // VACUITY: a card whose ground colour IS the whole card keys to zero figure pixels.
    // It must come back n=0 / null, never a mean over an empty set.
    const flat = figureGround(new Uint8Array(W * 10 * 3), W,
      [{ ...cards[0], meta: { bg: [0, 0, 0] } }]).rows[0];
    ok('an all-ground card reports n=0 and null, not 0.000', flat.n === 0 && flat.figL === null, `n=${flat.n} figL=${flat.figL}`);
  }

  console.log(`\n${fail === 0 ? 'SELFTEST PASS' : `SELFTEST FAIL (${fail})`}  —  5 sections\n`);
  return fail === 0 ? 0 : 1;
}

function priceTable(entries) {
  console.log('\n  tier        authored              -> GRADED (on card)        hue   chroma  HSVsat  luma   vs-white');
  const rows = [];
  for (const [tier, hx] of entries) {
    const g = gradeHex(hx).map((v) => Math.round(v));
    const a = stats(hex2rgb(hx)), s = stats(g);
    rows.push({ tier, hx, g, a, s });
    console.log(`  ${tier.padEnd(11)} ${hx} c${a.chroma.toFixed(3)} L${a.luma.toFixed(3)} -> ${rgb2hex(g)} ` +
      `${String(g).padEnd(15)} ${(s.hue === null ? '  —' : s.hue.toFixed(0).padStart(3))}   ` +
      `${s.chroma.toFixed(3)}   ${s.hsvSat.toFixed(3)}   ${s.luma.toFixed(3)}  ${s.contrastVsWhite.toFixed(2)}`);
  }
  const gh = rows.map((r) => r.s.hue);
  const R = hueR(gh), bins = hueBins(gh);
  const chr = rows.map((r) => r.s.chroma), lum = rows.map((r) => r.s.luma);
  console.log(`\n  GRADED SET:  distinct 30-deg hue bins ${bins}   circular R ${R === null ? '—' : R.toFixed(3)}` +
    `   chroma ${Math.min(...chr).toFixed(3)}..${Math.max(...chr).toFixed(3)}` +
    `   luma ${Math.min(...lum).toFixed(3)}..${Math.max(...lum).toFixed(3)}`);
  const sorted = [...lum].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  console.log(`  luma ladder: min step ${Math.min(...gaps).toFixed(4)}  (six tiers must stay tellable apart)`);
  console.log(`  worst white-type contrast ${Math.min(...rows.map((r) => r.s.contrastVsWhite)).toFixed(2)}:1\n`);
  return rows;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--selftest')) return selftest();

  const ji = argv.indexOf('--json');
  if (ji >= 0) {
    const j = JSON.parse(readFileSync(argv[ji + 1], 'utf8'));
    const seen = new Map();
    for (const r of j.reports) {
      for (const c of r.grid.cards) {
        if (c.meta && c.meta.bg) seen.set(c.id, c.meta.bg);
      }
    }
    if (seen.size === 0) { console.error('rg_cardgrade: NO ThumbMeta.bg in that report — refusing to print over an empty set.'); return 2; }
    const uniq = new Map();
    for (const [id, bg] of seen) if (!uniq.has(String(bg))) uniq.set(String(bg), { bg, ids: [id] });
      else uniq.get(String(bg)).ids.push(id);
    console.log(`\n  MEASURED ThumbMeta.bg — ${seen.size} cards, ${uniq.size} distinct card colours\n`);
    const hues = [];
    for (const { bg, ids } of uniq.values()) {
      const s = stats(bg);
      hues.push(s.hue);
      console.log(`  ${rgb2hex(bg)} ${String(bg).padEnd(16)} hue ${(s.hue === null ? '  —' : s.hue.toFixed(0).padStart(3))}  ` +
        `chroma ${s.chroma.toFixed(3)}  HSVsat ${s.hsvSat.toFixed(3)}  luma ${s.luma.toFixed(3)}  ` +
        `vs-white ${s.contrastVsWhite.toFixed(2)}   ${ids.join(', ')}`);
    }
    console.log(`\n  distinct 30-deg hue bins ${hueBins(hues)}   circular R ${(hueR(hues) ?? 0).toFixed(3)}` +
      `   luma ${Math.min(...[...uniq.values()].map((u) => stats(u.bg).luma)).toFixed(3)}` +
      `..${Math.max(...[...uniq.values()].map((u) => stats(u.bg).luma)).toFixed(3)}\n`);
    return 0;
  }

  const hexes = argv.filter((a) => /^#?[0-9a-fA-F]{6}$/.test(a)).map((a) => (a[0] === '#' ? a : `#${a}`).toUpperCase());
  if (hexes.length === 0) {
    priceTable(MEASURED.map(([t, h]) => [t, h]));
    console.log('  (no hexes given — priced the SHIPPED palette. Pass hexes to price a candidate.)\n');
    return 0;
  }
  priceTable(hexes.map((h, i) => [`#${i + 1}`, h]));
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main());
