#!/usr/bin/env node
/**
 * Home-screen acceptance battery — defined BEFORE round 2 so "better" is a number.
 *
 * Round 1 of the home critic loop scored ours 6.5 / 6.5 against a reference side of
 * 8.5 / 8.0 (valid round: reference inside the 7-9 calibration band). The critic named
 * four fixes. Three of them are directly measurable and this file measures them, so the
 * loop converges instead of oscillating at its own noise floor:
 *
 *   1. HERO CARD STAGING. "The best asset on the screen reads as a cutout pasted on a
 *      colour swatch." Measured as the LUMA VALUE BREAK across the card's blue field:
 *      the band behind the head against the two lower corners. A staged interior has a
 *      real break; a colour swatch has none. Also measures the contact shadow under the
 *      plinth as a dark band relative to the field beside it at the same height.
 *
 *   2. TEXT CONTRAST. "'TAP TO TAUNT' is pale grey on pale blue" and "'3:00 - last one
 *      standing' is thin light text directly on saturated red." Every text run on the
 *      screen is measured against THE PIXELS ACTUALLY BEHIND IT, from the rendered PNG,
 *      not from a computed style — which is the only way an inherited opacity, a
 *      text-shadow or a canvas backdrop is accounted for. LESSONS §1 case 10: the HUD
 *      cooldown wipe was dark-on-dark and three critics across three rounds reported
 *      "no visible cooldown"; a contrast number would have found it in minutes.
 *
 *   3. TYPE HIERARCHY. "The only heavy display type on the whole screen is START GAME
 *      and Hamburger; everything else is 400-weight sans at ~8-11px." Counted as the
 *      number of text runs below 11px, the number at weight < 700, and the distinct
 *      (family, weight, size) tuples in play.
 *
 *   4. DO NOT REGRESS. LESSONS §3: an earlier round drove character width / hero panel
 *      width from 0.26 to 0.68. Read straight off `window.__charStage()`.
 *
 * Usage (snapshot only - LESSONS §5; the server dies with its shell, so chain it):
 *   URL=$(node tools/snapshot.mjs --json | python3 -c "import json,sys;print(json.load(sys.stdin)['url'])") \
 *     && node tools/tmp/home_metrics.mjs --url "$URL" --out shots/home_m/r2 --label after
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true;
    else { out[k] = n; i++; }
  }
  return out;
}

/** sRGB relative luminance, WCAG 2.1. */
function relLum(r, g, b) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = Math.max(a, b);
  const l2 = Math.min(a, b);
  return (l1 + 0.05) / (l2 + 0.05);
}
/** Perceptual-ish luma 0-255, used for the value-break metric. */
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

function hsvSat(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/**
 * Foreground/background split for one text rect, taken from PIXELS.
 *
 * Computed styles cannot answer this: `.home-stage-hint.is-faded` inherits an opacity
 * of 0.35 and the hero card's backdrop is a WebGL canvas, so both the ink and the paper
 * are only knowable after compositing. Quantise to 5 bits/channel, take the modal bin as
 * background, then take the bin whose relative luminance is furthest from it (with at
 * least `minShare` of the rect) as foreground.
 */
function splitFgBg(px, W, x0, y0, w, h, minShare = 0.015) {
  const bins = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = bins.get(key);
      if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += r; e.g += g; e.b += b;
      n++;
    }
  }
  if (n === 0) return null;
  let bg = null;
  for (const e of bins.values()) if (!bg || e.n > bg.n) bg = e;
  const bgc = { r: bg.r / bg.n, g: bg.g / bg.n, b: bg.b / bg.n };
  const bgL = relLum(bgc.r, bgc.g, bgc.b);
  let fg = null; let best = -1;
  for (const e of bins.values()) {
    if (e.n / n < minShare) continue;
    const c = { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n };
    const d = Math.abs(relLum(c.r, c.g, c.b) - bgL);
    if (d > best) { best = d; fg = c; }
  }
  if (!fg) return { bg: bgc, fg: bgc, ratio: 1, share: 0 };
  return {
    bg: bgc,
    fg,
    ratio: contrast(relLum(fg.r, fg.g, fg.b), bgL),
    share: +(bg.n / n).toFixed(3),
  };
}

/** Mean luma + saturation of a rectangle, ignoring pixels that are clearly not the
 *  blue field (the character, the plinth, the nameplate). */
function fieldStats(px, W, x0, y0, w, h) {
  let sum = 0, sat = 0, n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      // Blue field only.
      //
      // The obvious filter (`b > r`) is WRONG and cost a whole baseline run: the ink the
      // nameplate is stroked in is `#1a1224`, whose blue channel is already above its
      // red, so the darkest ink on the card counted as "backdrop" and credited the field
      // with a value break and a horizon step that were both text. This wants a
      // recognisably blue, recognisably lit pixel: blue clearly dominant, green above
      // red (cyan, not violet), and not near-black.
      if (b <= r + 20 || b < 70 || g <= r) continue;
      sum += luma(r, g, b);
      sat += hsvSat(r, g, b);
      n++;
    }
  }
  return n === 0 ? null : { luma: +(sum / n).toFixed(2), sat: +(sat / n).toFixed(4), n };
}

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const outDir = args.out ?? 'shots/home_m';
  const label = args.label ?? 'run';
  const W = Number(args.w ?? 1600);
  const H = Number(args.h ?? 900);
  await mkdir(resolve(outDir), { recursive: true });
  const shot = `${outDir}/${label}.png`;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${base}/?screen=home`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 45000 });
  // Past the 4.2s hint fade AND past the entrance animation, so what is measured is the
  // screen's steady state — which is the state a critic is shown.
  await page.waitForTimeout(6000);

  const dom = await page.evaluate(() => {
    const vis = (n) => {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = n.getBoundingClientRect();
      return r.width >= 4 && r.height >= 4;
    };
    const runs = [];
    const stage = document.querySelector('.fa-home .home-stage');
    const walk = document.createTreeWalker(document.querySelector('.fa-home'), NodeFilter.SHOW_ELEMENT);
    const seen = new Set();
    for (let n = walk.currentNode; n; n = walk.nextNode()) {
      if (seen.has(n)) continue;
      seen.add(n);
      const own = Array.from(n.childNodes)
        .filter((c) => c.nodeType === 3 && c.textContent.trim().length > 0)
        .map((c) => c.textContent.trim())
        .join(' ');
      if (!own) continue;
      if (!vis(n)) continue;
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      runs.push({
        text: own.slice(0, 40),
        cls: n.className && typeof n.className === 'string' ? n.className : '',
        tag: n.tagName.toLowerCase(),
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height),
        fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
        weight: Number(s.fontWeight),
        size: +parseFloat(s.fontSize).toFixed(1),
        color: s.color,
      });
    }
    const sr = stage ? stage.getBoundingClientRect() : null;
    return {
      runs,
      stage: sr ? { x: Math.round(sr.x), y: Math.round(sr.y), w: Math.round(sr.width), h: Math.round(sr.height) } : null,
      charStage: window.__charStage ? window.__charStage() : null,
    };
  });

  await page.screenshot({ path: shot, timeout: 90_000 });
  await browser.close();

  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width;
  const clampRect = (x, y, w, h) => {
    const x0 = Math.max(0, Math.min(IW - 1, x));
    const y0 = Math.max(0, Math.min(info.height - 1, y));
    return [x0, y0, Math.max(1, Math.min(IW - x0, w)), Math.max(1, Math.min(info.height - y0, h))];
  };

  // ── 1. Hero card staging ────────────────────────────────────────────────────
  const st = dom.stage;
  const staging = {};
  if (st) {
    const pick = (fx, fy, fw, fh) => fieldStats(data, IW, ...clampRect(
      Math.round(st.x + st.w * fx), Math.round(st.y + st.h * fy),
      Math.round(st.w * fw), Math.round(st.h * fh),
    ));
    // Behind the head: the two flanks of the upper band. Taken at the flanks and not at
    // the centre because the centre IS the character.
    //
    // The lower corners start at 84% and not at 78%: the key light's long cast shadow
    // lands on the ground around 71-80% of the card on the LEFT, and sampling it as if
    // it were the backdrop credits the field with a value break the field does not have.
    // This is the same class of error as LESSONS §3's "do not take a critic's stated
    // mechanism at face value" — the sample has to exclude the thing being claimed.
    const headL = pick(0.04, 0.10, 0.16, 0.22);
    const headR = pick(0.80, 0.10, 0.16, 0.22);
    // ...and they stop at 93%, because the "TAP TO TAUNT" pill sits in the bottom-right
    // corner and its translucent navy plate is, pixel for pixel, indistinguishable from
    // a darkened backdrop. Sampling it made the lower-right corner look staged when it
    // was a UI chip.
    const lowL = pick(0.03, 0.84, 0.15, 0.09);
    const lowR = pick(0.82, 0.84, 0.15, 0.09);
    const head = (headL.luma + headR.luma) / 2;
    const low = (lowL.luma + lowR.luma) / 2;
    staging.headBandLuma = +head.toFixed(2);
    staging.lowerCornerLuma = +low.toFixed(2);
    staging.valueBreakPct = +(((head - low) / head) * 100).toFixed(1);
    staging.headBandSat = +((headL.sat + headR.sat) / 2).toFixed(4);
    staging.lowerCornerSat = +((lowL.sat + lowR.sat) / 2).toFixed(4);
    staging.fieldSat = +((headL.sat + headR.sat + lowL.sat + lowR.sat) / 4).toFixed(4);

    // Contact shadow under the plinth. Scan the vertical strip under the disc centre for
    // the darkest blue-field row between 78% and 99% of the card, and compare it with the
    // field at the same row out at the card's edge. A real contact shadow is a measurable
    // dark band; "there is a shadow" is otherwise a guess.
    let bestDrop = 0, bestY = null;
    for (let fy = 0.76; fy < 0.99; fy += 0.01) {
      const mid = fieldStats(data, IW, ...clampRect(
        Math.round(st.x + st.w * 0.36), Math.round(st.y + st.h * fy),
        Math.round(st.w * 0.28), Math.max(3, Math.round(st.h * 0.012)),
      ));
      const edge = fieldStats(data, IW, ...clampRect(
        Math.round(st.x + st.w * 0.03), Math.round(st.y + st.h * fy),
        Math.round(st.w * 0.10), Math.max(3, Math.round(st.h * 0.012)),
      ));
      if (!mid || !edge || mid.n < 40) continue;
      const drop = (edge.luma - mid.luma) / edge.luma;
      if (drop > bestDrop) { bestDrop = drop; bestY = +fy.toFixed(2); }
    }
    staging.contactShadowDropPct = +(bestDrop * 100).toFixed(1);
    staging.contactShadowAtY = bestY;

    // WHERE THE DISC ACTUALLY IS, measured rather than assumed. The staging layers are
    // anchored off `charStage.info().feet` plus a calibrated drop, and a drop that is
    // 2% out puts the contact shadow on the disc's face instead of under it. The disc
    // is warm (gold top, brown side) on a cool field, so its lowest row is just the
    // lowest warm pixel in the middle of the card.
    let discY = null;
    for (let fy = 0.99; fy > 0.55; fy -= 0.004) {
      const y = Math.round(st.y + st.h * fy);
      let warm = 0;
      for (let x = Math.round(st.x + st.w * 0.28); x < st.x + st.w * 0.72; x++) {
        const i = (Math.max(0, Math.min(info.height - 1, y)) * IW + Math.max(0, Math.min(IW - 1, x))) * 3;
        if (data[i] > data[i + 2] + 24 && data[i] > 90) warm++;
      }
      if (warm > st.w * 0.06) { discY = +fy.toFixed(3); break; }
    }
    staging.discBaseMeasured = discY;
    staging.contactShadowError = discY !== null && bestY !== null ? +(bestY - discY).toFixed(3) : null;

    // Whole-field spread: the flat-swatch signature is a small range across the field.
    const grid = [];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        const s = pick(0.02 + gx * 0.192, 0.16 + gy * 0.15, 0.14, 0.12);
        if (s && s.n > 200) grid.push(s.luma);
      }
    }
    staging.fieldLumaMin = +Math.min(...grid).toFixed(2);
    staging.fieldLumaMax = +Math.max(...grid).toFixed(2);
    staging.fieldLumaRange = +(Math.max(...grid) - Math.min(...grid)).toFixed(2);

    // STRUCTURE, not just value. A smooth top-to-bottom ramp and a staged interior can
    // post the same value break; what separates them is whether the field has an EDGE
    // anywhere — a horizon. Scan the two flank columns row by row and report the largest
    // single-step luma change as a percentage of the field mean. A swatch has none.
    let step = 0, stepY = null;
    let prev = null;
    for (let fy = 0.20; fy < 0.93; fy += 0.01) {
      const l = fieldStats(data, IW, ...clampRect(
        Math.round(st.x + st.w * 0.03), Math.round(st.y + st.h * fy),
        Math.round(st.w * 0.16), Math.max(3, Math.round(st.h * 0.01)),
      ));
      const r = fieldStats(data, IW, ...clampRect(
        Math.round(st.x + st.w * 0.81), Math.round(st.y + st.h * fy),
        Math.round(st.w * 0.16), Math.max(3, Math.round(st.h * 0.01)),
      ));
      if (!l || !r) { prev = null; continue; }
      const cur = (l.luma + r.luma) / 2;
      if (prev !== null && Math.abs(cur - prev) > step) { step = Math.abs(cur - prev); stepY = +fy.toFixed(2); }
      prev = cur;
    }
    staging.horizonStepPct = +((step / ((staging.headBandLuma + staging.lowerCornerLuma) / 2)) * 100).toFixed(2);
    staging.horizonAtY = stepY;
  }

  // ── 2. Text contrast, against real pixels ───────────────────────────────────
  const texts = dom.runs.map((r) => {
    const s = splitFgBg(data, IW, ...clampRect(r.x, r.y, r.w, r.h));
    const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
    const floor = large ? 3.0 : 4.5;
    return {
      ...r,
      ratio: s ? +s.ratio.toFixed(2) : null,
      large,
      floor,
      pass: s ? s.ratio >= floor : false,
      bg: s ? `rgb(${Math.round(s.bg.r)},${Math.round(s.bg.g)},${Math.round(s.bg.b)})` : null,
      fg: s ? `rgb(${Math.round(s.fg.r)},${Math.round(s.fg.g)},${Math.round(s.fg.b)})` : null,
    };
  });
  const fails = texts.filter((t) => !t.pass).sort((a, b) => a.ratio - b.ratio);

  // ── 3. Type hierarchy ───────────────────────────────────────────────────────
  const tuples = new Map();
  for (const r of dom.runs) {
    const k = `${r.fontFamily}/${r.weight}/${r.size}`;
    tuples.set(k, (tuples.get(k) ?? 0) + 1);
  }
  // "The only heavy display type on the whole screen is START GAME and Hamburger."
  // Every run whose ROLE is a headline must be the display face at display weight.
  const HEADLINE = /fa-panel-title|home-track-title|home-kit-name|home-rec-val|home-mode-name|home-hero-name|fa-btn|fa-tab|fa-chip|home-track-pill|home-cap-name/;
  const headlines = dom.runs.filter((r) => HEADLINE.test(r.cls));
  const badHeadlines = headlines.filter((r) => !/rubik/i.test(r.fontFamily) || r.weight < 800);
  const type = {
    runs: dom.runs.length,
    distinctTuples: tuples.size,
    below11px: dom.runs.filter((r) => r.size < 11).length,
    below700weight: dom.runs.filter((r) => r.weight < 700).length,
    nonRubik: dom.runs.filter((r) => !/rubik/i.test(r.fontFamily)).length,
    headlines: headlines.length,
    headlinesOffFace: badHeadlines.map((r) => `${r.cls}:${r.fontFamily}/${r.weight}`),
    tuples: Object.fromEntries([...tuples.entries()].sort((a, b) => b[1] - a[1])),
  };

  // ── 4. Do not regress the hero fill (LESSONS §3) ────────────────────────────
  const cs = dom.charStage;
  const heroFill = cs && cs.left && cs.right ? +(cs.right.x - cs.left.x).toFixed(3) : null;

  const report = {
    label,
    url: base,
    viewport: `${W}x${H}`,
    shot,
    pageErrors: errors,
    staging,
    heroFillFrac: heroFill,
    charStage: cs,
    text: {
      runs: texts.length,
      minRatio: texts.length ? +Math.min(...texts.map((t) => t.ratio ?? 99)).toFixed(2) : null,
      failing: fails.length,
      failures: fails.map((f) => ({ text: f.text, cls: f.cls, size: f.size, weight: f.weight, ratio: f.ratio, floor: f.floor, fg: f.fg, bg: f.bg })),
      all: texts.map((t) => ({ text: t.text, cls: t.cls, size: t.size, weight: t.weight, ratio: t.ratio })),
    },
    type,
  };
  await writeFile(`${outDir}/${label}.json`, JSON.stringify(report, null, 2));

  const line = (k, v) => console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(`\n── home metrics [${label}] ${W}x${H} ──`);
  console.log(' STAGING');
  line('head-band luma', staging.headBandLuma);
  line('lower-corner luma', staging.lowerCornerLuma);
  line('VALUE BREAK %', staging.valueBreakPct);
  line('field luma range', staging.fieldLumaRange);
  line('contact shadow drop %', `${staging.contactShadowDropPct} @ y=${staging.contactShadowAtY}`);
  line('disc base (measured)', `${staging.discBaseMeasured}  (shadow offset ${staging.contactShadowError})`);
  line('horizon step %', `${staging.horizonStepPct} @ y=${staging.horizonAtY}`);
  line('field mean saturation', staging.fieldSat);
  console.log(' TEXT CONTRAST');
  line('runs measured', report.text.runs);
  line('min ratio', report.text.minRatio);
  line('below AA floor', report.text.failing);
  for (const f of fails.slice(0, 12)) {
    console.log(`   ✗ ${String(f.ratio).padStart(5)} (need ${f.floor})  ${f.size}px/${f.weight}  "${f.text}"  ${f.cls}`);
  }
  console.log(' TYPE');
  line('text runs', type.runs);
  line('distinct f/w/s tuples', type.distinctTuples);
  line('runs < 11px', type.below11px);
  line('runs weight < 700', type.below700weight);
  line('headlines off-face', `${type.headlinesOffFace.length}/${type.headlines}${type.headlinesOffFace.length ? ` (${type.headlinesOffFace.slice(0, 4).join(', ')})` : ''}`);
  console.log(' HERO');
  line('char w / panel w', heroFill);
  if (errors.length) console.log(` PAGE ERRORS: ${errors.slice(0, 3).join(' | ')}`);
  console.log('');
}

run().catch((e) => { console.error(e); process.exit(1); });
