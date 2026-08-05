#!/usr/bin/env node
/**
 * Objective acceptance battery for CHARACTER SELECT.
 *
 * `tools/tmp/screen_metrics.mjs` covers settings / opening / trophies and cannot
 * cover this screen for two reasons, both of which have already cost time here:
 *
 *  1. It waits `__screenReady` + 3.2 s. The roster's eleven portraits take 28.9 s to
 *     generate under SwiftShader, and a fixed timeout captured 2-4 cards still
 *     showing the emoji placeholder — a critic scored the blanks TWICE and it was
 *     nearly filed as a defect. `window.__thumbsReady` exists precisely so that
 *     cannot happen. This waits on the flag, never on a clock.
 *  2. The headline number for this screen is not a contrast ratio, it is
 *     FIGURE AREA / CARD AREA in the roster grid. Nothing else measures it.
 *
 * The WCAG half (`relLum` / `binPixels` / `inkVsPapers` / `collect` / `score`) is
 * `screen_metrics.mjs` VERBATIM, so numbers from the two files compare directly. That
 * instrument was wrong twice before it was right (it compared two BACKGROUNDS and
 * called a 7.02:1 label 2.22:1; the repair then made the ink its own background and
 * reported 1.00 everywhere), so it is re-validated on this screen's own pixels —
 * `--validate` prints the three hand-checkable cases.
 *
 * ── How the figure is measured ──────────────────────────────────────────────
 * NOT by keying the composited card: `.chars-card-gloss` lays a radial highlight and
 * a bottom scrim over it, so the "background" is not one colour anywhere. Instead the
 * source PNG is re-decoded in the page (it is a `data:` URL, so no taint), its flat
 * baked background is keyed out at native resolution, and the resulting subject bbox
 * and pixel COUNT are mapped into card space through the element's own object-fit /
 * object-position geometry. That makes the number exact and independent of every
 * overlay drawn on top.
 *
 * Head rects come from `window.__thumbMeta`, which `thumbs.ts` records at generation
 * time by projecting the rig's own `head` joint. Pixels cannot tell a face from a hat.
 *
 * Usage (snapshot only — LESSONS §5):
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/chars_metrics.mjs --url {URL} --out shots/chars_m --label before
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

/** Landscape desktop, landscape phone (the tight case), portrait phone. */
const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

const SEED_PROFILE = {
  name: 'Chef',
  wins: 40,
  losses: 22,
  xp: 4180,
  selected: 'hamburger',
  economy: {
    trophies: 3170, bestTrophies: 3170, coins: 4210, gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger'], winsTowardChest: 1, lastMatch: null,
    seed: 12345, rolls: 7,
  },
};

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

// ── WCAG half: verbatim from tools/tmp/screen_metrics.mjs ───────────────────
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
function binPixels(px, W, x0, y0, w, h) {
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
  if (n === 0) return [];
  return [...bins.values()]
    .map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / n }))
    .sort((a, b) => b.share - a.share);
}
function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s ?? '');
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] };
}
function blend(color, alpha, bg) {
  const a = Math.max(0, Math.min(1, alpha));
  return {
    r: color.r * a + bg.r * (1 - a),
    g: color.g * a + bg.g * (1 - a),
    b: color.b * a + bg.b * (1 - a),
  };
}
const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

function inkVsPapers(px, W, x0, y0, w, h, color, alpha, stroke) {
  const bins = binPixels(px, W, x0, y0, w, h);
  if (bins.length === 0) return null;
  const NEAR = 70;

  if (stroke && stroke.width >= 1.5) {
    const p = { r: stroke.r, g: stroke.g, b: stroke.b, share: 1 };
    let ink = blend(color, alpha, p);
    let best = NEAR;
    for (const b of bins) {
      if (b.share < 0.015) continue;
      const d = dist(b, blend(color, alpha, p));
      if (d < best) { best = d; ink = b; }
    }
    return {
      ratio: contrast(relLum(ink.r, ink.g, ink.b), relLum(p.r, p.g, p.b)),
      paper: p, ink, viaStroke: true,
    };
  }

  let cands = bins.filter((b) => dist(b, color) > NEAR);
  if (cands.length === 0) cands = bins;

  const papers = [cands[0]];
  for (const b of cands.slice(1)) {
    if (b.share < 0.10) break;
    const isInk = papers.some((p) => {
      for (const t of [1, 0.75, 0.5, 0.25]) {
        if (dist(b, blend(color, alpha * t, p)) < NEAR) return true;
      }
      return false;
    });
    if (!isInk) papers.push(b);
  }

  let worst = null;
  for (const p of papers) {
    const predicted = blend(color, alpha, p);
    let ink = predicted;
    let best = NEAR;
    for (const b of bins) {
      if (b.share < 0.015 || b === p) continue;
      const d = dist(b, predicted);
      if (d < best) { best = d; ink = b; }
    }
    const c = contrast(relLum(ink.r, ink.g, ink.b), relLum(p.r, p.g, p.b));
    if (worst === null || c < worst.ratio) worst = { ratio: c, paper: p, ink };
  }
  return worst;
}

/** Everything read out of the mounted screen, in one page.evaluate. */
function collect() {
  const frame = document.querySelector('.fa-root');
  const root = frame;
  if (!root || !frame) return null;

  const vis = (n) => {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = n.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4 && r.bottom > 0 && r.top < innerHeight
      && r.right > 0 && r.left < innerWidth;
  };

  const visibleRect = (n) => {
    const r = n.getBoundingClientRect();
    const cs0 = getComputedStyle(n);
    const bw = (v) => parseFloat(v) || 0;
    let box = {
      l: r.left + bw(cs0.borderLeftWidth), t: r.top + bw(cs0.borderTopWidth),
      rt: r.right - bw(cs0.borderRightWidth), b: r.bottom - bw(cs0.borderBottomWidth),
    };
    for (let p = n.parentElement; p; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'visible' && ps.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      box = {
        l: Math.max(box.l, pr.left), t: Math.max(box.t, pr.top),
        rt: Math.min(box.rt, pr.right), b: Math.min(box.b, pr.bottom),
      };
    }
    box = {
      l: Math.max(box.l, 0), t: Math.max(box.t, 0),
      rt: Math.min(box.rt, innerWidth), b: Math.min(box.b, innerHeight),
    };
    const full = Math.max(1, r.width * r.height);
    const vw2 = Math.max(0, box.rt - box.l);
    const vh2 = Math.max(0, box.b - box.t);
    return { x: box.l, y: box.t, w: vw2, h: vh2, frac: (vw2 * vh2) / full };
  };

  const inheritedOpacity = (n) => {
    let a = 1;
    for (let p = n; p && p !== document.documentElement; p = p.parentElement) {
      const o = Number(getComputedStyle(p).opacity);
      if (Number.isFinite(o)) a *= o;
    }
    return a;
  };

  const runs = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = walk.currentNode; n; n = walk.nextNode()) {
    const own = Array.from(n.childNodes)
      .filter((c) => c.nodeType === 3 && c.textContent.trim().length > 0)
      .map((c) => c.textContent.trim())
      .join(' ');
    if (!own || !vis(n)) continue;
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    const v = visibleRect(n);
    if (v.w < 4 || v.h < 4 || v.frac < 0.3) {
      runs.push({
        text: own.slice(0, 44),
        cls: typeof n.className === 'string' ? n.className : '',
        tag: n.tagName.toLowerCase(),
        clippedOut: true, visibleFrac: +v.frac.toFixed(2),
        fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
        weight: Number(s.fontWeight), size: +parseFloat(s.fontSize).toFixed(1),
      });
      continue;
    }
    runs.push({
      text: own.slice(0, 44),
      cls: typeof n.className === 'string' ? n.className : '',
      tag: n.tagName.toLowerCase(),
      x: Math.round(v.x), y: Math.round(v.y),
      w: Math.round(v.w), h: Math.round(v.h),
      fullW: Math.round(r.width), fullH: Math.round(r.height),
      visibleFrac: +v.frac.toFixed(2),
      fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
      weight: Number(s.fontWeight),
      size: +parseFloat(s.fontSize).toFixed(1),
      color: s.color,
      opacity: +inheritedOpacity(n).toFixed(3),
      strokeWidth: parseFloat(s.webkitTextStrokeWidth) || 0,
      strokeColor: s.webkitTextStrokeColor,
    });
  }

  const PICTO = /\p{Extended_Pictographic}/u;
  const NONASCII = /[^\x00-\x7F]/gu;
  const emoji = [];
  const other = new Map();
  const noteGlyph = (text, where, isEmoji) => {
    if (isEmoji) emoji.push({ text: text.slice(0, 30), where });
    else {
      const k = `${text}|${where}`;
      other.set(k, (other.get(k) ?? 0) + 1);
    }
  };
  const scanString = (str, where) => {
    if (!str) return;
    for (const m of str.match(NONASCII) ?? []) noteGlyph(m, where, PICTO.test(m));
  };
  const walk2 = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = walk2.currentNode; n; n = walk2.nextNode()) {
    if (!vis(n)) continue;
    const where = (typeof n.className === 'string' && n.className.split(' ')[0]) || n.tagName.toLowerCase();
    for (const c of n.childNodes) if (c.nodeType === 3) scanString(c.textContent, where);
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(n, pseudo);
      if (!cs || cs.content === 'none' || cs.content === 'normal') continue;
      scanString(cs.content.replace(/^"|"$/g, ''), `${where}${pseudo}`);
    }
  }

  // `document.scrollWidth` is NOT the test: `.fa-root` is `overflow: hidden`, so
  // anything wider is CLIPPED rather than scrolled and the document reports zero.
  const de = document.documentElement;
  const overflowX = de.scrollWidth - de.clientWidth;
  const overflowY = de.scrollHeight - de.clientHeight;
  const clipped = [];
  const CARES = '.fa-chip, .fa-iconbtn, .fa-btn, .fa-panel, .fa-title, .fa-rarity, .chars-card, .chars-hero, .chars-detail, .chars-equip, .chars-bottom, .fa-stat';
  for (const n of root.querySelectorAll(CARES)) {
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    let inX = false, inY = false;
    for (let p = n.parentElement; p && p !== root; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') inX = true;
      if (ps.overflowY === 'auto' || ps.overflowY === 'scroll') inY = true;
    }
    const outR = inX ? -1 : r.right - de.clientWidth;
    const outL = inX ? -1 : -r.left;
    const outB = inY ? -1 : r.bottom - de.clientHeight;
    if (outR > 1 || outL > 1 || outB > 1) {
      clipped.push({
        cls: (typeof n.className === 'string' ? n.className : n.tagName).slice(0, 40),
        text: (n.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 18),
        left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom),
        axis: outR > 1 || outL > 1 ? 'x' : 'y',
        lostPx: Math.round(Math.max(outR, outL, outB)),
      });
    }
  }
  clipped.sort((a, b) => b.lostPx - a.lostPx);

  const controls = [...root.querySelectorAll('button:not([disabled])')]
    .filter(vis)
    .map((n) => {
      const r = n.getBoundingClientRect();
      return {
        cls: (typeof n.className === 'string' ? n.className : '').split(' ').slice(0, 2).join(' '),
        cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2),
        w: Math.round(r.width), h: Math.round(r.height),
      };
    });

  return {
    runs, emoji,
    otherGlyphs: [...other.entries()].map(([k, n]) => ({ glyph: k.split('|')[0], where: k.split('|')[1], n })),
    overflowX, overflowY, clipped, controls,
    vw: de.clientWidth, vh: de.clientHeight,
  };
}

/**
 * The roster grid, measured.
 *
 * Runs in the page because the only honest source for "how much of the card is
 * figure" is the source PNG at native resolution, keyed against the flat colour the
 * generator baked behind it. Everything drawn OVER the render (gloss, scrim, name,
 * rarity chip, the sheen animation on Neon/Cyber) is therefore irrelevant to the
 * number, which is the point — those overlays are exactly what defeats keying the
 * composited card.
 */
async function measureRoster() {
  const cards = [...document.querySelectorAll('.chars-card[data-char]')];
  const meta = window.__thumbMeta ?? {};
  const out = [];

  const pct = (token, axis) => {
    if (token.endsWith('%')) return parseFloat(token) / 100;
    if (token === 'left' || token === 'top') return 0;
    if (token === 'right' || token === 'bottom') return 1;
    if (token === 'center') return 0.5;
    // A length: resolve against the free space at call time instead.
    return { px: parseFloat(token) || 0, axis };
  };

  for (const card of cards) {
    const id = card.dataset.char;
    const published = meta[id]?.bg ?? null;
    const cr = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const bw = (v) => parseFloat(v) || 0;
    // overflow:hidden clips to the PADDING box, so that is the visible card area.
    const pad = {
      l: cr.left + bw(cs.borderLeftWidth), t: cr.top + bw(cs.borderTopWidth),
      r: cr.right - bw(cs.borderRightWidth), b: cr.bottom - bw(cs.borderBottomWidth),
    };
    const cardW = pad.r - pad.l, cardH = pad.b - pad.t;

    const img = card.querySelector('.chars-card-render');
    const rec = {
      id,
      card: { x: +cr.x.toFixed(1), y: +cr.y.toFixed(1), w: +cr.width.toFixed(1), h: +cr.height.toFixed(1) },
      inner: { w: +cardW.toFixed(1), h: +cardH.toFixed(1), aspect: +(cardW / cardH).toFixed(3) },
      hasRender: !!(img && img.naturalWidth),
    };
    if (!rec.hasRender) { out.push(rec); continue; }

    const NW = img.naturalWidth, NH = img.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = NW; cv.height = NH;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, NW, NH).data;

    // ── Background model: THE TOP FOUR ROWS, and only those ────────────────────
    // The first version of this sampled the whole 1px border ring, which was correct
    // for a letterboxed full-body render and became WRONG the moment the art started
    // bleeding off the card. With a figure touching three edges the ring is half
    // character, so the "background" mean drifted onto the subject, its spread went up,
    // the 3-sigma threshold went up with it, and the key returned ZERO pixels for four
    // of eleven characters and 0.7% for two more. That is the instrument reporting the
    // change it was built to measure as a catastrophic regression — LESSONS §13.
    //
    // `thumbs.ts` guarantees TOP_PAD (8%) of clear frame above the head and nothing is
    // ever drawn above it, so the top rows are background by construction, at every
    // framing, for every character. `topResidual` re-checks that assumption on the way
    // past: it is the share of those rows that keys as subject, and it must be ~0.
    let br = 0, bg2 = 0, bb = 0, bn = 0;
    const BROWS = 4;
    const XL = Math.floor(NW * 0.22), XR = Math.ceil(NW * 0.78);
    const inStrip = (x) => x < XL || x >= XR;
    for (let y = 0; y < BROWS; y++) {
      for (let x = 0; x < NW; x++) {
        if (!inStrip(x)) continue;
        const i = (y * NW + x) * 4;
        br += d[i]; bg2 += d[i + 1]; bb += d[i + 2]; bn++;
      }
    }
    br /= bn; bg2 /= bn; bb /= bn;
    let vsum = 0;
    for (let y = 0; y < BROWS; y++) {
      for (let x = 0; x < NW; x++) {
        if (!inStrip(x)) continue;
        const i = (y * NW + x) * 4;
        vsum += (d[i] - br) ** 2 + (d[i + 1] - bg2) ** 2 + (d[i + 2] - bb) ** 2;
      }
    }
    // THE GUARD, and it is the whole reason this is a strip and not the top rows.
    // `thumbs.ts` may now slide the frame down over the top of the mass (HEAD_CROP) to
    // lift a low face off the nameplate, so the top-CENTRE rows are no longer
    // guaranteed background — only the corners are. bgStd is what says whether that
    // assumption still holds: measured 4-6 across the cast when the strips are clean,
    // and it jumps immediately if a character reaches into one.
    const bstd = Math.sqrt(vsum / bn);
    // Fixed floor: the grade puts a gentle falloff across the frame, measured at ~5/255
    // corner to corner, so 26 clears it with room while still keying a dark outline.
    let thr = Math.max(26, 3 * bstd);

    // ── THE THIRD BACKGROUND MODEL, and the last one that can ever be needed ────
    // The two before it both keyed the background from a PLACE and both were eventually
    // wrong about that place. The border ring stopped being background when art started
    // bleeding off the card (zero figure pixels for four of eleven). The top corner
    // strips relied on `TOP_PAD` keeping them clear — and they were ALREADY not clear
    // when this file was written: waterbottle's cap reaches x=326 in the top rows, which
    // took its strip std to 46.4 and its threshold to 139.9 against everyone else's 26,
    // i.e. it was keying that one character against a five-times-looser rule than the
    // rest of the cast and reporting the result as a comparable percentage.
    //
    // `thumbs.ts` now publishes the post-grade card colour in `__thumbMeta[id].bg`,
    // sampled from a frame rendered with the model hidden. That is not an assumption
    // about where the background is; it is the background. The strip model is kept and
    // printed beside it as a cross-check — on a character whose strips ARE clean the two
    // must agree to a couple of units, and that is what says the published value is real.
    const stripBg = [Math.round(br), Math.round(bg2), Math.round(bb)];
    let bgSource = 'strip';
    if (published) {
      br = published[0]; bg2 = published[1]; bb = published[2];
      thr = 26;
      bgSource = 'published';
    }

    // Element -> drawn-image geometry, per the object-fit / object-position spec.
    // Solved BEFORE the key, because the headline number counts only the figure pixels
    // that survive the card's crop — a subject bleeding off three edges would otherwise
    // score its off-screen half.
    const er = img.getBoundingClientRect();
    const istyle = getComputedStyle(img);
    const fit = istyle.objectFit;
    const posTokens = istyle.objectPosition.trim().split(/\s+/);
    const sc = fit === 'cover' ? Math.max(er.width / NW, er.height / NH)
      : fit === 'contain' ? Math.min(er.width / NW, er.height / NH)
        : fit === 'none' ? 1
          : Math.min(er.width / NW, er.height / NH);
    const dw = NW * sc, dh = NH * sc;
    const resolve = (tok, free) => {
      const p = pct(tok, 0);
      return typeof p === 'number' ? free * p : p.px;
    };
    const dx = er.left + resolve(posTokens[0] ?? '50%', er.width - dw);
    const dy = er.top + resolve(posTokens[1] ?? '50%', er.height - dh);
    // The window of the SOURCE image the card actually shows.
    const win = {
      x0: (pad.l - dx) / sc, x1: (pad.r - dx) / sc,
      y0: (pad.t - dy) / sc, y1: (pad.b - dy) / sc,
    };

    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0, vis = 0, topHit = 0;
    for (let y = 0; y < NH; y++) {
      const inY = y >= win.y0 && y <= win.y1;
      for (let x = 0; x < NW; x++) {
        const i = (y * NW + x) * 4;
        const dd = Math.hypot(d[i] - br, d[i + 1] - bg2, d[i + 2] - bb);
        if (dd <= thr) continue;
        n++;
        if (inY && x >= win.x0 && x <= win.x1) vis++;
        if (y < BROWS && inStrip(x)) topHit++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    rec.src = {
      w: NW, h: NH, bg: [Math.round(br), Math.round(bg2), Math.round(bb)],
      bgSource, stripBg,
      // How far the two models disagree. Small = the published value is confirmed by an
      // independent measurement; large = the strips are contaminated and always were.
      bgDelta: +Math.hypot(stripBg[0] - br, stripBg[1] - bg2, stripBg[2] - bb).toFixed(1),
      bgStd: +bstd.toFixed(1), thr: +thr.toFixed(1),
      topResidual: +(topHit / bn).toFixed(4),
    };
    if (n === 0) { rec.empty = true; out.push(rec); continue; }
    rec.srcSubject = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, px: n, visiblePx: vis };

    const toCard = (r) => ({
      x: +(dx + r.x * sc).toFixed(1), y: +(dy + r.y * sc).toFixed(1),
      w: +(r.w * sc).toFixed(1), h: +(r.h * sc).toFixed(1),
    });
    const sub = toCard(rec.srcSubject);
    rec.fit = fit;
    rec.objectPosition = istyle.objectPosition;
    rec.scale = +sc.toFixed(4);
    rec.figure = sub;
    rec.figureAreaPx = +(rec.srcSubject.visiblePx * sc * sc).toFixed(0);
    rec.figureAreaPxUncropped = +(rec.srcSubject.px * sc * sc).toFixed(0);
    rec.cardAreaPx = +(cardW * cardH).toFixed(0);
    rec.fillFrac = +(rec.figureAreaPx / (cardW * cardH)).toFixed(4);
    rec.keptFrac = +(rec.srcSubject.visiblePx / rec.srcSubject.px).toFixed(3);
    rec.bboxFillFrac = +((sub.w * sub.h) / (cardW * cardH)).toFixed(4);
    rec.figureHeightFrac = +(sub.h / cardH).toFixed(4);
    // Positive = that many CSS px of figure fall outside the visible card.
    rec.overflow = {
      left: +Math.max(0, pad.l - sub.x).toFixed(1),
      right: +Math.max(0, (sub.x + sub.w) - pad.r).toFixed(1),
      top: +Math.max(0, pad.t - sub.y).toFixed(1),
      bottom: +Math.max(0, (sub.y + sub.h) - pad.b).toFixed(1),
    };

    const m = meta[id];
    if (m) {
      rec.meta = m;
      // The projection is validated here, on this screen, before any number from it
      // is believed (LESSONS §13): `subjectVsKeyed` is the depth-flattened projection
      // of the model's own Box3 against the bbox keyed out of the rendered pixels.
      // They measure the same object two entirely different ways.
      rec.subjectVsKeyed = {
        proj: m.subject,
        keyed: rec.srcSubject,
        dW: +(m.subject.w - rec.srcSubject.w).toFixed(1),
        dH: +(m.subject.h - rec.srcSubject.h).toFixed(1),
      };
      const sMetaX = NW / m.size.w, sMetaY = NH / m.size.h;
      const band = (r) => toCard({ x: r.x * sMetaX, y: r.y * sMetaY, w: r.w * sMetaX, h: r.h * sMetaY });
      const outside = (r) => ({
        left: +Math.max(0, pad.l - r.x).toFixed(1),
        right: +Math.max(0, (r.x + r.w) - pad.r).toFixed(1),
        top: +Math.max(0, pad.t - r.y).toFixed(1),
        bottom: +Math.max(0, (r.y + r.h) - pad.b).toFixed(1),
      });
      if (m.head) {
        rec.head = band(m.head);
        rec.headPx = +rec.head.h.toFixed(1);
        rec.headOverflow = outside(rec.head);
      }
      if (m.face) {
        rec.face = band(m.face);
        rec.facePx = +rec.face.h.toFixed(1);
        rec.faceWPx = +rec.face.w.toFixed(1);
        rec.faceOverflow = outside(rec.face);
      }
    }
    out.push(rec);
  }

  const roster = document.querySelector('.chars-roster');
  const rr = roster ? roster.getBoundingClientRect() : null;
  const cols = roster ? getComputedStyle(roster).gridTemplateColumns.split(' ').length : 0;
  return {
    cards: out,
    roster: rr ? { x: +rr.x.toFixed(1), y: +rr.y.toFixed(1), w: +rr.width.toFixed(1), h: +rr.height.toFixed(1), cols } : null,
    thumbsReady: window.__thumbsReady === true,
    metaCount: Object.keys(meta).length,
  };
}

const HEADLINE = /fa-title|fa-panel-title|fa-btn|fa-chip|fa-iconbtn|chars-card-name|chars-ability-name|chars-equip/;

async function score(dom, shot, meta) {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width, IH = info.height;
  const sx = IW / dom.vw, sy = IH / dom.vh;
  const clampRect = (x, y, w, h) => {
    const x0 = Math.max(0, Math.min(IW - 1, Math.round(x * sx)));
    const y0 = Math.max(0, Math.min(IH - 1, Math.round(y * sy)));
    return [x0, y0, Math.max(1, Math.min(IW - x0, Math.round(w * sx))), Math.max(1, Math.min(IH - y0, Math.round(h * sy)))];
  };

  const measured = dom.runs.filter((r) => !r.clippedOut);
  const rgb = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
  const texts = measured.map((r) => {
    const col = parseColor(r.color);
    const alpha = col.a * (r.opacity ?? 1);
    const sc = parseColor(r.strokeColor);
    const stroke = r.strokeWidth > 0 ? { ...sc, width: r.strokeWidth } : null;
    const w = inkVsPapers(data, IW, ...clampRect(r.x, r.y, r.w, r.h), col, alpha, stroke);
    const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
    const floor = large ? 3.0 : 4.5;
    return {
      ...r,
      ratio: w ? +w.ratio.toFixed(2) : null,
      large, floor,
      pass: w ? w.ratio >= floor : false,
      bg: w ? `${rgb(w.paper)}${w.viaStroke ? ' [text-stroke]' : `@${(w.paper.share * 100).toFixed(0)}%`}` : null,
      ink: w ? `${rgb(w.ink)} (css ${r.color}${(r.opacity ?? 1) < 0.999 ? ` x${r.opacity}` : ''})` : null,
    };
  });
  const fails = texts.filter((t) => !t.pass).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));
  const headlines = measured.filter((r) => HEADLINE.test(r.cls));

  return {
    ...meta,
    shot,
    text: {
      runs: texts.length,
      minRatio: texts.length ? +Math.min(...texts.map((t) => t.ratio ?? 99)).toFixed(2) : null,
      failing: fails.length,
      failures: fails.map((f) => ({ text: f.text, cls: f.cls, size: f.size, weight: f.weight, ratio: f.ratio, floor: f.floor, ink: f.ink, bg: f.bg })),
      rarities: texts.filter((t) => /fa-rarity/.test(t.cls))
        .map((t) => ({ text: t.text, cls: t.cls.split(' ').slice(-1)[0], size: t.size, ratio: t.ratio, pass: t.pass, bg: t.bg, ink: t.ink })),
      all: texts.map((t) => ({ text: t.text, cls: t.cls, size: t.size, weight: t.weight, family: t.fontFamily, ratio: t.ratio, pass: t.pass })),
    },
    type: {
      runs: measured.length,
      clippedOut: dom.runs.filter((r) => r.clippedOut).length,
      below11px: measured.filter((r) => r.size < 11).map((r) => `${r.cls.split(' ')[0]}:${r.size}`),
      below700: measured.filter((r) => r.weight < 700).map((r) => `${r.cls.split(' ')[0]}:${r.weight}`),
      offFace: measured.filter((r) => !/rubik|heebo/i.test(r.fontFamily)).map((r) => `${r.cls || r.tag}:${r.fontFamily}`),
      headlinesOffFace: headlines.filter((r) => !/rubik/i.test(r.fontFamily) || r.weight < 800)
        .map((r) => `${r.cls.split(' ')[0]}:${r.fontFamily}/${r.weight}`),
      headlines: headlines.length,
    },
    emoji: dom.emoji,
    otherGlyphs: dom.otherGlyphs,
    overflow: { x: dom.overflowX, y: dom.overflowY, clipped: dom.clipped.slice(0, 8) },
    smallControls: dom.controls.filter((c) => c.w < 44 || c.h < 44),
  };
}

/** A 3x contact sheet of the roster cards, so faces can actually be LOOKED at. */
async function contactSheet(shot, cards, outPath, vw, vh) {
  const img = sharp(shot);
  const { width: IW, height: IH } = await img.metadata();
  const sx = IW / vw, sy = IH / vh;
  const tiles = [];
  for (const c of cards) {
    const left = Math.max(0, Math.round(c.card.x * sx));
    const top = Math.max(0, Math.round(c.card.y * sy));
    const w = Math.max(1, Math.min(IW - left, Math.round(c.card.w * sx)));
    const h = Math.max(1, Math.min(IH - top, Math.round(c.card.h * sy)));
    const buf = await sharp(shot).extract({ left, top, width: w, height: h })
      .resize({ width: w * 3, height: h * 3, kernel: 'nearest' }).png().toBuffer();
    tiles.push({ buf, w: w * 3, h: h * 3, id: c.id });
  }
  if (!tiles.length) return null;
  const cols = 4;
  const cw = Math.max(...tiles.map((t) => t.w)) + 8;
  const chh = Math.max(...tiles.map((t) => t.h)) + 8;
  const rows = Math.ceil(tiles.length / cols);
  const canvas = sharp({
    create: { width: cols * cw, height: rows * chh, channels: 3, background: { r: 30, g: 22, b: 40 } },
  });
  const comps = tiles.map((t, i) => ({
    input: t.buf,
    left: (i % cols) * cw + 4,
    top: Math.floor(i / cols) * chh + 4,
  }));
  await canvas.composite(comps).png().toFile(outPath);
  return outPath;
}

async function auditViewport(page, base, vp, outDir, label) {
  const url = `${base}/?screen=characters&hold=600000&pointerLock=0`;
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  const onMsg = (m) => { if (m.type() === 'error') errors.push(m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onMsg);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction('window.__screen === "characters" && window.__screenReady === true', null, { timeout: 90000 });
  // THE FLAG, never a clock. 28.9 s under SwiftShader with all eleven present; a
  // fixed 2.5 s AND a fixed 15 s both captured emoji placeholders (see header).
  await page.waitForFunction('window.__thumbsReady === true', null, { timeout: 300000 });
  // Only the 0.25 s opacity swap and the entrance transition, now that generation is
  // provably finished.
  await page.waitForTimeout(1500);

  const shot = `${outDir}/${label}-characters-${vp.name}.png`;
  await page.screenshot({ path: shot, timeout: 120_000 });
  const dom = await page.evaluate(collect);
  const grid = await page.evaluate(measureRoster);
  page.off('pageerror', onErr);
  page.off('console', onMsg);
  if (!dom) return { screen: 'characters', vp: vp.name, error: 'no .fa-root' };

  const rep = await score(dom, shot, {
    screen: 'characters', vp: vp.name, viewport: `${vp.w}x${vp.h}`, pageErrors: errors.slice(0, 5),
  });
  rep.grid = grid;
  rep.sheet = await contactSheet(shot, grid.cards, `${outDir}/${label}-cards-${vp.name}.png`, dom.vw, dom.vh);
  return rep;
}

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const outDir = args.out ?? 'shots/chars_m';
  const label = args.label ?? 'run';
  const vps = args.vp
    ? VIEWPORTS.filter((v) => String(args.vp).split(',').includes(v.name))
    : VIEWPORTS;
  await mkdir(resolve(outDir), { recursive: true });

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const reports = [];
  for (const vp of vps) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((profile) => {
      try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile)); } catch { /* private mode */ }
    }, SEED_PROFILE);
    // eslint-disable-next-line no-await-in-loop
    reports.push(await auditViewport(page, base, vp, outDir, label));
    await page.close();
  }
  await browser.close();

  await writeFile(`${outDir}/${label}.json`, JSON.stringify({ label, base, reports }, null, 2));

  let hard = 0;
  for (const r of reports) {
    if (r.error) { console.log(`\n!! ${r.vp}: ${r.error}`); hard++; continue; }
    const g = r.grid;
    console.log(`\n══ character select @ ${r.vp} (${r.viewport}) [${label}] ══`);
    console.log(`  thumbsReady ${g.thumbsReady}   cards ${g.cards.length}   with render ${g.cards.filter((c) => c.hasRender).length}   thumbMeta ${g.metaCount}`);
    const withR = g.cards.filter((c) => c.hasRender && c.fillFrac !== undefined);
    if (withR.length) {
      const mean = withR.reduce((a, c) => a + c.fillFrac, 0) / withR.length;
      const meanBox = withR.reduce((a, c) => a + c.bboxFillFrac, 0) / withR.length;
      const meanH = withR.reduce((a, c) => a + c.figureHeightFrac, 0) / withR.length;
      const heads = withR.filter((c) => c.headPx !== undefined);
      console.log(`  card inner          ${withR[0].inner.w} x ${withR[0].inner.h}  (aspect ${withR[0].inner.aspect})   object-fit ${withR[0].fit} @ ${withR[0].objectPosition}`);
      console.log(`  FIGURE / CARD AREA  ${(mean * 100).toFixed(1)}%    (bbox ${(meanBox * 100).toFixed(1)}%,  figure height ${(meanH * 100).toFixed(1)}% of card)`);
      const faces = withR.filter((c) => c.facePx !== undefined);
      if (heads.length) {
        const mh = heads.reduce((a, c) => a + c.headPx, 0) / heads.length;
        console.log(`  HEAD height on card ${mh.toFixed(1)}px mean   min ${Math.min(...heads.map((c) => c.headPx)).toFixed(1)}  max ${Math.max(...heads.map((c) => c.headPx)).toFixed(1)}`);
      }
      if (faces.length) {
        const mf = faces.reduce((a, c) => a + c.facePx, 0) / faces.length;
        console.log(`  FACE height on card ${mf.toFixed(1)}px mean   min ${Math.min(...faces.map((c) => c.facePx)).toFixed(1)}  max ${Math.max(...faces.map((c) => c.facePx)).toFixed(1)}   (${faces.length}/${withR.length} have a face joint)`);
      }
      const dW = withR.filter((c) => c.subjectVsKeyed).map((c) => Math.abs(c.subjectVsKeyed.dW));
      const dH = withR.filter((c) => c.subjectVsKeyed).map((c) => Math.abs(c.subjectVsKeyed.dH));
      if (dW.length) {
        console.log(`  projection check    projected subject box vs KEYED pixels: max |dW| ${Math.max(...dW).toFixed(0)}px, max |dH| ${Math.max(...dH).toFixed(0)}px of ${withR[0].src.w}x${withR[0].src.h}`);
      }
      for (const c of withR) {
        const o = c.overflow;
        const z = { left: 0, right: 0, top: 0, bottom: 0 };
        const ho = c.headOverflow ?? z;
        const fo = c.faceOverflow ?? z;
        const fmt = (v) => [v.left && `L${v.left}`, v.right && `R${v.right}`, v.top && `T${v.top}`, v.bottom && `B${v.bottom}`].filter(Boolean).join(' ');
        const clip = fmt(o), hclip = fmt(ho), fclip = fmt(fo);
        console.log(`    ${c.id.padEnd(12)} fill ${(c.fillFrac * 100).toFixed(1).padStart(5)}%  kept ${((c.keptFrac ?? 1) * 100).toFixed(0).padStart(3)}%  bbox ${c.figure.w.toFixed(0)}x${c.figure.h.toFixed(0)}`
          + `  face ${(c.facePx ?? 0).toFixed(0).padStart(3)}x${(c.faceWPx ?? 0).toFixed(0).padStart(3)}`
          + `  fig-out[${clip || 'none'}]  FACE-OUT[${fclip || 'none'}]`
          + `  bg ${c.src.bgSource}${c.src.bgSource === 'published' ? ` (strip d${c.src.bgDelta}, std ${c.src.bgStd})` : ` std ${c.src.bgStd}`}`);
        if (fclip) hard++;
      }
      // The strip model's own health, printed whether or not it is being used: a std
      // over ~12 means the top corners hold art, which is exactly the precondition the
      // second background model assumed and the framing is now allowed to break.
      const dirty = withR.filter((c) => c.src.bgStd > 12).map((c) => `${c.id}:${c.src.bgStd}`);
      console.log(`  strip-model health  ${dirty.length ? `CONTAMINATED ${dirty.join(', ')}` : 'clean on all 11'}`
        + `   max |published-strip| ${Math.max(...withR.map((c) => c.src.bgDelta ?? 0)).toFixed(1)}`);
    }
    const noRender = g.cards.filter((c) => !c.hasRender);
    if (noRender.length) { console.log(`  !! NO RENDER: ${noRender.map((c) => c.id).join(', ')}`); hard++; }
    console.log(`  text runs           ${r.text.runs}${r.type.clippedOut ? `  (+${r.type.clippedOut} clipped out, not measured)` : ''}`);
    console.log(`  min contrast        ${r.text.minRatio}`);
    console.log(`  below WCAG AA       ${r.text.failing}`);
    for (const f of r.text.failures.slice(0, 12)) {
      console.log(`    x ${String(f.ratio).padStart(5)} (need ${f.floor})  ${f.size}px/${f.weight}  "${f.text}"  .${f.cls.split(' ').slice(-1)[0]}   ink ${f.ink} on ${f.bg}`);
    }
    console.log(`  RARITY runs         ${r.text.rarities.length}`);
    for (const t of r.text.rarities) {
      console.log(`    ${t.pass ? 'ok ' : 'X  '} ${String(t.ratio).padStart(6)}  ${t.size}px  "${t.text}"  .${t.cls}  on ${t.bg}`);
    }
    console.log(`  runs < 11px         ${r.type.below11px.length}${r.type.below11px.length ? `  ${[...new Set(r.type.below11px)].slice(0, 8).join(', ')}` : ''}`);
    console.log(`  off-face runs       ${r.type.offFace.length}${r.type.offFace.length ? `  ${[...new Set(r.type.offFace)].slice(0, 6).join(', ')}` : ''}`);
    console.log(`  RAW EMOJI           ${r.emoji.length}${r.emoji.length ? `  ${r.emoji.map((e) => `${e.text}@${e.where}`).slice(0, 6).join(', ')}` : ''}`);
    console.log(`  doc overflow x/y    ${r.overflow.x} / ${r.overflow.y}`);
    console.log(`  CLIPPED BY FRAME    ${r.overflow.clipped.length}${r.overflow.clipped.length ? `  ${r.overflow.clipped.slice(0, 4).map((w) => `${w.cls.split(' ')[0]}"${w.text}" -${w.lostPx}px[${w.axis}]`).join(', ')}` : ''}`);
    console.log(`  controls < 44px     ${r.smallControls.length}${r.smallControls.length ? `  ${r.smallControls.slice(0, 4).map((c) => `${c.cls}:${c.w}x${c.h}`).join(', ')}` : ''}`);
    if (r.pageErrors.length) console.log(`  PAGE ERRORS         ${r.pageErrors.slice(0, 2).join(' | ')}`);
    console.log(`  sheet               ${r.sheet}`);
    if (r.text.failing || r.emoji.length || r.overflow.x > 0 || r.overflow.clipped.length || r.smallControls.length) hard++;
  }
  console.log(`\n${hard === 0 ? 'ALL CLEAN' : `${hard} hard failures`}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
