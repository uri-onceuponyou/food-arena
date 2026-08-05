#!/usr/bin/env node
/**
 * Objective acceptance battery for the MENU screens that were built and never scored
 * (settings, opening, trophy road) — plus a portrait sweep and a match-screen pass.
 *
 * This is `tools/tmp/home_metrics.mjs` generalised. That file was written for one
 * screen and hard-codes the home hero card's geometry; everything below it that is
 * screen-agnostic is kept verbatim (the WCAG split in particular, so numbers from the
 * two files compare directly), and four checks are added that the home battery had no
 * reason to carry:
 *
 *  1. TEXT CONTRAST, from PIXELS. Every text run measured against the pixels actually
 *     behind it, so an inherited opacity, a text-shadow or a WebGL backdrop counts.
 *     LESSONS §1 case 10: a dark-on-dark HUD cooldown wipe had THREE critics across
 *     three rounds report "no visible cooldown". A contrast number finds it in minutes.
 *
 *  2. TYPE HIERARCHY. Runs below 11px, runs at weight < 700, and — the one the home
 *     pass found by accident — runs rendering in a font nobody chose. A <button> does
 *     NOT inherit font-family, so a control that forgets to name one silently ships in
 *     Arial. Invisible to tsc and to all 315 menu_accept assertions.
 *
 *  3. RAW GLYPHS. The build's headline was "all 60 emoji replaced by authored icons",
 *     and emojiIcon() falls through to the glyph when a token is unmapped. Both text
 *     nodes AND ::before/::after content are scanned, because a CSS content string is
 *     rendered type that no DOM walk can see. Emoji (Extended_Pictographic) are a
 *     FAIL; other non-ASCII marks are reported separately, because an arrow keycap and
 *     a tick are legitimate typography and a lint that cries wolf gets ignored
 *     (LESSONS §9).
 *
 *  4. A CONTROL MUST NOT CONTRADICT ITS OWN LABEL. Specifically the trophy road's
 *     progress bar, which STATE.md records as "reading ~100% while labelled '30 to
 *     next reward'". The fill fraction is measured off the DOM and compared against
 *     the number printed inside it, and — independently — against the segment the
 *     road's own nodes describe (every node carries data-trophies, and the pin carries
 *     the player's count, so the expected fraction is derivable WITHOUT trusting the
 *     code that drew the bar). Same family as a HUD pill saying "safe" over a ring
 *     meaning "lethal"; LESSONS §7 found ten of those.
 *
 * Portrait is a first-class viewport here. menu_accept's five viewports are ALL
 * landscape, and portrait home overflows horizontally at committed HEAD — pre-existing
 * and never caught, because nothing ever looked.
 *
 * Usage (snapshot only — LESSONS §5; the server dies with its shell, so chain it):
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/screen_metrics.mjs --url {URL} --out shots/screen_m/before --label before
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

/** Landscape desktop, landscape phone (the tight case), portrait phone (untested). */
const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900 },
  { name: 'phone-land', w: 844, h: 390 },
  { name: 'phone-portrait', w: 430, h: 932 },
];

const SCREENS = ['settings', 'opening', 'trophies'];

/**
 * A seeded profile, so the trophy road is measured in a state a player is actually in.
 *
 * A default profile sits at 0 trophies, where the progress bar is empty, nothing is
 * claimable, the inventory is empty and the pin is at the far left — i.e. every state
 * this screen has to get right is off screen. 3,170 puts the player 30 trophies from
 * the final bundle with the segment 90% crossed, which is EXACTLY the state STATE.md
 * records the contradiction in ("~100% while labelled 30 to next reward"), and leaves
 * two unclaimed nodes plus two held containers so the claim path and the inventory row
 * both render.
 */
const SEED_PROFILE = {
  name: 'Chef',
  wins: 40,
  losses: 22,
  xp: 4180,
  selected: 'hamburger',
  economy: {
    trophies: 3170,
    bestTrophies: 3170,
    coins: 4210,
    gems: 96,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    // Everything below 2,650 claimed: two nodes (2,650 and 2,900) stay claimable, so
    // the gold node, the bulk Claim button and the "Ready now" headline all render.
    claimed: [
      10, 25, 42, 60, 85, 107, 130, 160, 190, 220, 260, 300, 345, 400, 455, 510, 580,
      650, 725, 815, 905, 1000, 1105, 1220, 1340, 1485, 1630, 1780, 1980, 2190, 2400,
    ],
    unlocked: ['hamburger'],
    winsTowardChest: 1,
    lastMatch: null,
    seed: 12345,
    rolls: 7,
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

/** sRGB relative luminance, WCAG 2.1. Verbatim from home_metrics.mjs. */
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

/** Colour histogram of a rect, quantised to 5 bits/channel, sorted by share. */
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

/** `rgb(a)` string -> {r,g,b,a}. */
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

/**
 * IDENTIFY the ink by model, MEASURE it from pixels.
 *
 * Two failed instruments preceded this one, and both failures are worth keeping:
 *
 *  1. home_metrics.mjs's version takes the modal bin as paper and the bin furthest
 *     from it in luminance as ink. On a rect with TWO papers it compares the two
 *     papers with each other and never looks at the type: it reported the trophy
 *     road's bar label at 2.22:1 (green fill vs cream trough) where the ink on that
 *     bar measures 7.0:1 by hand.
 *  2. The first repair here dropped the histogram guess and computed the ink
 *     analytically from `color`. That put the ink's OWN pixels into the candidate
 *     background set, so a 28%-coverage keycap glyph became its own background and
 *     every run on every screen posted exactly 1.00.
 *
 * So: the computed `color` (times every inherited opacity) predicts where the ink
 * lands on each candidate paper; the bin nearest that prediction IS the ink and is
 * removed from the paper set; and the ratio is then computed between two MEASURED
 * colours. Model for identification, pixels for measurement — which is what keeps
 * inherited opacity, translucent plates and a WebGL backdrop all accounted for.
 *
 * Validated against three hand-computed cases before use (LESSONS §13):
 *   .fa-level-xp  ink on the bar fill      -> 7.0  (hand 7.02)
 *   .tr-status    white on lettuce at 0.78 -> 2.02 (hand 2.02)
 *   .tr-node-req  ink 0.72 on cream at 0.78-> 3.88 (hand 3.89)
 */
function inkVsPapers(px, W, x0, y0, w, h, color, alpha, stroke) {
  const bins = binPixels(px, W, x0, y0, w, h);
  if (bins.length === 0) return null;
  const NEAR = 70;

  // A stroked glyph does not sit on the backdrop — it sits on its own stroke, which
  // is 3-4px of solid ink around every letter of every headline in this design
  // system. Measuring cream-on-orange for "FOOD FIGHT ARENA" would report 1.9:1 for
  // the most legible object in the frame, and a lint that cries wolf gets ignored
  // (LESSONS §9). So when a text stroke is present and thick enough to enclose the
  // glyph, the stroke IS the paper.
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

  // PASS 1 — remove the element's own ink from the candidate paper set BEFORE
  // choosing a paper. Share cannot do this job: a 3px ink border round a 26px keycap
  // is 40% of the rect and a 40px numeral at weight 900 covers 39% of its own box, so
  // in both cases the modal bin IS the type. What separates them is that the ink is
  // the one colour the CSS already told us about.
  let cands = bins.filter((b) => dist(b, color) > NEAR);
  if (cands.length === 0) cands = bins;

  // PASS 2 — the modal remaining bin is paper; any other bin over 10% is a second
  // paper unless it is this ink composited onto one already accepted (partial alpha
  // and antialiasing both land there).
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
    // The glyph's real pixels, if it formed a bin at all; otherwise the prediction.
    // A 9px run inside a wide rect can antialias across so many bins that none of
    // them clears 1.5%, which is exactly when the prediction is the better estimate.
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

/** Everything read out of one mounted screen, in one page.evaluate.
 *  `scope` narrows to a modal card: a sheet draws a 66%-black scrim over the screen
 *  behind it, so scoring that screen through the scrim measures the scrim. */
function collect(scope) {
  const frame = document.querySelector('.fa-root');
  const root = scope ? document.querySelector(scope) : frame;
  if (!root || !frame) return null;

  const vis = (n) => {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = n.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4 && r.bottom > 0 && r.top < innerHeight
      && r.right > 0 && r.left < innerWidth;
  };

  /**
   * The part of an element that a camera can actually see.
   *
   * Load-bearing, not tidiness: settings' body is a scroll container, and a run that
   * has scrolled past the fold still reports a full `getBoundingClientRect()`. Sampling
   * those pixels measures whatever is drawn over the fold instead — which is how the
   * first run of this battery reported the "Game" panel title at 1.12:1 and "Reduce
   * motion" at 1.08:1, neither of which is a real defect. Both were clipped runs.
   */
  const visibleRect = (n) => {
    const r = n.getBoundingClientRect();
    const cs0 = getComputedStyle(n);
    // The PADDING box, not the border box. A 2.5px ink border round a 26px keycap is
    // 40% of its border box, so sampling the border box hands the histogram a huge
    // slab of pure ink that is not type and is not paper.
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

  /** Product of every `opacity` from the element up to the root. The trophy road dims
   *  claimed nodes with a container opacity, which no computed `color` reports. */
  const inheritedOpacity = (n) => {
    let a = 1;
    for (let p = n; p && p !== document.documentElement; p = p.parentElement) {
      const o = Number(getComputedStyle(p).opacity);
      if (Number.isFinite(o)) a *= o;
    }
    return a;
  };

  // ── Text runs ──────────────────────────────────────────────────────────────
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
    // A run more than 70% hidden is not on screen to be judged. Reported so the count
    // is auditable rather than silently dropped.
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

  // ── Raw glyphs: text nodes AND generated content ───────────────────────────
  // CSS `content` is rendered type that no DOM walk sees; the trophy road draws its
  // claimed tick that way.
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
    for (const m of str.match(NONASCII) ?? []) {
      noteGlyph(m, where, PICTO.test(m));
    }
  };
  const walk2 = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = walk2.currentNode; n; n = walk2.nextNode()) {
    if (!vis(n)) continue;
    const where = (typeof n.className === 'string' && n.className.split(' ')[0]) || n.tagName.toLowerCase();
    for (const c of n.childNodes) {
      if (c.nodeType === 3) scanString(c.textContent, where);
    }
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(n, pseudo);
      if (!cs || cs.content === 'none' || cs.content === 'normal') continue;
      const raw = cs.content.replace(/^"|"$/g, '');
      scanString(raw, `${where}${pseudo}`);
    }
  }

  // ── Overflow ───────────────────────────────────────────────────────────────
  //
  // `document.scrollWidth` is NOT the test, and believing it is why portrait went
  // unexamined. `.fa-root` carries `overflow: hidden`, so anything wider than the
  // frame is silently CLIPPED rather than scrolled: the document reports zero
  // overflow while the player has half a currency chip amputated at the right edge.
  // So the check is "does a control or a labelled surface leave the frame", measured
  // on the elements themselves.
  const de = document.documentElement;
  const overflowX = de.scrollWidth - de.clientWidth;
  const overflowY = de.scrollHeight - de.clientHeight;
  const clipped = [];
  const CARES = '.fa-chip, .fa-iconbtn, .fa-btn, .fa-tab, .fa-panel, .fa-title, .fa-level-track, .fa-menuitem, .tr-hero, .tr-bottom, .set-row, .set-foot, .match-chip';
  for (const n of root.querySelectorAll(CARES)) {
    const r = n.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // Inside a scroller on an axis, being bigger than the frame on that axis is the
    // POINT — that is what a scroller is. Tracked per axis, because settings' body
    // scrolls vertically only and counting its below-the-fold panels as clipped is a
    // false positive that buries the real one.
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

  // Where the width actually comes from. "Everything is 70px too wide" is a symptom;
  // the cause is one box whose min-content forces its whole grid column, and the only
  // way to name it is to walk the tree measuring each box against its own parent.
  const widthChain = [];
  if (!scope && clipped.some((c) => c.axis === 'x')) {
    const walkW = (n, depth) => {
      if (depth > 6) return;
      const r = n.getBoundingClientRect();
      const pr = n.parentElement ? n.parentElement.getBoundingClientRect() : r;
      if (r.width > pr.width + 1 || r.width > de.clientWidth + 1) {
        widthChain.push({
          depth,
          cls: (typeof n.className === 'string' ? n.className : n.tagName).slice(0, 34),
          w: Math.round(r.width), parentW: Math.round(pr.width),
          scrollW: n.scrollWidth, clientW: n.clientWidth,
        });
      }
      for (const c of n.children) walkW(c, depth + 1);
    };
    walkW(frame, 0);
  }

  // ── Trophy-road bar: does the control agree with its own label? ────────────
  let bar = null;
  const track = root.querySelector('.tr-track');
  const fill = root.querySelector('.tr-fill');
  const label = root.querySelector('.tr-track .fa-level-xp');
  if (track && fill) {
    const tr = track.getBoundingClientRect();
    const fr = fill.getBoundingClientRect();
    const measured = tr.width > 0 ? fr.width / tr.width : null;
    const txt = label ? label.textContent.trim() : '';

    // Independent expectation, derived from the ROAD rather than from the bar: every
    // node carries its threshold and the pin carries the player's count, so the
    // segment the bar is supposed to be drawing is knowable without trusting the code
    // that drew it.
    const thresholds = [...root.querySelectorAll('.tr-node[data-trophies]')]
      .map((n) => Number(n.dataset.trophies)).filter(Number.isFinite).sort((a, b) => a - b);
    const pinLabel = root.querySelector('.tr-pin-label');
    const cur = pinLabel ? Number(pinLabel.textContent.replace(/[^0-9]/g, '')) : NaN;
    let expected = null; let segment = null;
    if (Number.isFinite(cur) && thresholds.length) {
      const next = thresholds.find((t) => cur < t) ?? null;
      if (next !== null) {
        const below = thresholds.filter((t) => t <= cur);
        const from = below.length ? below[below.length - 1] : 0;
        segment = { from, to: next, cur };
        expected = next > from ? (cur - from) / (next - from) : 1;
      }
    }
    // What the label CLAIMS. Two accepted forms: "a / b" (a fraction the reader can
    // check against the fill) and a bare "N to ..." (a remaining count, which cannot
    // be checked against a fraction at all — that is the defect).
    const frac = txt.match(/([\d,]+)\s*\/\s*([\d,]+)/);
    const claimed = frac
      ? Number(frac[1].replace(/,/g, '')) / Number(frac[2].replace(/,/g, ''))
      : null;
    bar = {
      label: txt,
      measuredFill: measured === null ? null : +measured.toFixed(4),
      expectedFill: expected === null ? null : +expected.toFixed(4),
      labelClaims: claimed === null ? null : +claimed.toFixed(4),
      labelIsCheckable: claimed !== null,
      segment,
    };
  }

  // Every control's tap rect, so the pause chip's thumb-zone position is a number.
  const controls = [...root.querySelectorAll('button:not([disabled]), .fa-menuitem:not([disabled])')]
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
    runs,
    emoji,
    otherGlyphs: [...other.entries()].map(([k, n]) => ({ glyph: k.split('|')[0], where: k.split('|')[1], n })),
    overflowX, overflowY, clipped, widthChain,
    bar,
    controls,
    vw: de.clientWidth, vh: de.clientHeight,
  };
}

/** Headline roles that must be on the display face at display weight. */
const HEADLINE = /fa-title|fa-panel-title|fa-btn|fa-tab|fa-chip|fa-iconbtn|open-title|tr-hero-num|tr-node-title|tr-status|set-row-title|set-key-action|match-sheet-title|tr-sheet-title|tr-reveal-name|tr-sku-name|tr-open-name/;

/** Turn one collected DOM + one PNG into the scored report for a variant. */
async function score(dom, shot, meta) {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width, IH = info.height;
  // The screenshot is CSS-pixel sized (deviceScaleFactor 1), but be defensive.
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
  const type = {
    runs: measured.length,
    clippedOut: dom.runs.filter((r) => r.clippedOut).length,
    below11px: measured.filter((r) => r.size < 11).map((r) => `${r.cls.split(' ')[0]}:${r.size}`),
    below700: measured.filter((r) => r.weight < 700).map((r) => `${r.cls.split(' ')[0]}:${r.weight}`),
    offFace: measured.filter((r) => !/rubik|heebo/i.test(r.fontFamily))
      .map((r) => `${r.cls || r.tag}:${r.fontFamily}`),
    headlinesOffFace: headlines.filter((r) => !/rubik/i.test(r.fontFamily) || r.weight < 800)
      .map((r) => `${r.cls.split(' ')[0]}:${r.fontFamily}/${r.weight}`),
    headlines: headlines.length,
  };

  return {
    ...meta,
    shot,
    text: {
      runs: texts.length,
      minRatio: texts.length ? +Math.min(...texts.map((t) => t.ratio ?? 99)).toFixed(2) : null,
      failing: fails.length,
      failures: fails.map((f) => ({ text: f.text, cls: f.cls, size: f.size, weight: f.weight, ratio: f.ratio, floor: f.floor, ink: f.ink, bg: f.bg })),
      all: texts.map((t) => ({ text: t.text, cls: t.cls, size: t.size, weight: t.weight, family: t.fontFamily, ratio: t.ratio })),
    },
    type,
    emoji: dom.emoji,
    otherGlyphs: dom.otherGlyphs,
    overflow: { x: dom.overflowX, y: dom.overflowY, clipped: dom.clipped.slice(0, 8), widthChain: (dom.widthChain ?? []).slice(0, 8) },
    bar: dom.bar,
    controls: dom.controls,
  };
}

/**
 * The modal sheets are screens too.
 *
 * Drop rates, the gem store and a reward reveal are three more surfaces with type on
 * them, and no critic and no acceptance test has ever seen any of them — they are
 * behind a tap. The reveal card is also the one place `emojiIcon()` can still fall
 * through to a raw glyph, because `describeReward()` hands back the MODEL's emoji and
 * `CHARACTERS.hamburger.emoji` is not in the translation table at all.
 */
const SHEETS = {
  trophies: [
    { name: 'odds', open: '[data-el="oddsbtn"]' },
    { name: 'store', open: '[data-el="storebtn"]' },
    { name: 'reveal', open: '[data-el="claimall"]' },
  ],
  settings: [{ name: 'confirm', open: '[data-el="reset"]' }],
};

async function auditScreen(page, base, screen, vp, outDir, label, opts = {}) {
  const url = `${base}/?screen=${screen}&hold=600000&pointerLock=0`;
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  const onMsg = (m) => { if (m.type() === 'error') errors.push(m.text()); };
  page.on('pageerror', onErr);
  page.on('console', onMsg);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    `window.__screen === ${JSON.stringify(screen)} && window.__screenReady === true`,
    null, { timeout: 60000 },
  );
  if (opts.touch) await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable'));
  // Past the entrance animation and any hint fade, so what is measured is the steady
  // state — which is the state a critic is shown.
  await page.waitForTimeout(3200);

  const out = [];
  const shot = `${outDir}/${label}-${screen}-${vp.name}.png`;
  await page.screenshot({ path: shot, timeout: 120_000 });
  const dom = await page.evaluate(collect);
  if (!dom) {
    page.off('pageerror', onErr); page.off('console', onMsg);
    return [{ screen, vp: vp.name, error: 'no .fa-root' }];
  }
  out.push(await score(dom, shot, {
    screen, vp: vp.name, viewport: `${vp.w}x${vp.h}`, pageErrors: errors.slice(0, 5),
  }));

  // Sheets, on the widest viewport only — they are the same markup on all three and
  // three extra browser round trips per viewport is not worth what it would add.
  if (vp.name === 'desktop') {
    for (const sheet of SHEETS[screen] ?? []) {
      const btn = await page.$(`.fa-root ${sheet.open}`);
      if (!btn) continue;
      await btn.click();
      await page.waitForTimeout(900);
      const sShot = `${outDir}/${label}-${screen}-${sheet.name}.png`;
      await page.screenshot({ path: sShot, timeout: 120_000 });
      const sDom = await page.evaluate(collect, '.fa-root .tr-sheet-card, .fa-root .set-confirm-card');
      if (sDom) {
        out.push(await score(sDom, sShot, {
          screen: `${screen}:${sheet.name}`, vp: vp.name, viewport: `${vp.w}x${vp.h}`, pageErrors: [],
        }));
      }
      await page.keyboard.press('Escape');
      const close = await page.$('.fa-root [data-el="close"], .fa-root [data-el="cancel"]');
      if (close) await close.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }

  page.off('pageerror', onErr);
  page.off('console', onMsg);
  return out;
}

async function run() {
  const args = parseArgs(process.argv);
  const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
  const outDir = args.out ?? 'shots/screen_m';
  const label = args.label ?? 'run';
  const screens = String(args.screens ?? SCREENS.join(',')).split(',').filter(Boolean);
  const vps = args.vp
    ? VIEWPORTS.filter((v) => String(args.vp).split(',').includes(v.name))
    : VIEWPORTS;
  await mkdir(resolve(outDir), { recursive: true });

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const reports = [];
  for (const vp of vps) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
    await page.addInitScript((profile) => {
      try {
        localStorage.setItem('food-arena.profile.v1', JSON.stringify(profile));
      } catch { /* private mode */ }
    }, SEED_PROFILE);
    for (const screen of screens) {
      // eslint-disable-next-line no-await-in-loop
      reports.push(...await auditScreen(page, base, screen, vp, outDir, label, { touch: !!args.touch }));
    }
    await page.close();
  }
  await browser.close();

  await writeFile(`${outDir}/${label}.json`, JSON.stringify({ label, base, reports }, null, 2));

  let hardFails = 0;
  for (const r of reports) {
    if (r.error) { console.log(`\n!! ${r.screen}@${r.vp}: ${r.error}`); hardFails++; continue; }
    console.log(`\n── ${r.screen} @ ${r.vp} (${r.viewport}) [${label}] ──`);
    console.log(`  text runs           ${r.text.runs}${r.type.clippedOut ? `  (+${r.type.clippedOut} scrolled out of view, not measured)` : ''}`);
    console.log(`  min contrast        ${r.text.minRatio}`);
    console.log(`  below WCAG AA       ${r.text.failing}`);
    for (const f of r.text.failures.slice(0, 10)) {
      console.log(`    x ${String(f.ratio).padStart(5)} (need ${f.floor})  ${f.size}px/${f.weight}  "${f.text}"  .${f.cls.split(' ')[0]}   ink ${f.ink} on ${f.bg}`);
    }
    console.log(`  runs < 11px         ${r.type.below11px.length}${r.type.below11px.length ? `  ${r.type.below11px.slice(0, 6).join(', ')}` : ''}`);
    console.log(`  runs weight < 700   ${r.type.below700.length}${r.type.below700.length ? `  ${r.type.below700.slice(0, 6).join(', ')}` : ''}`);
    console.log(`  off-face runs       ${r.type.offFace.length}${r.type.offFace.length ? `  ${r.type.offFace.slice(0, 6).join(', ')}` : ''}`);
    console.log(`  headlines off-face  ${r.type.headlinesOffFace.length}/${r.type.headlines}${r.type.headlinesOffFace.length ? `  ${r.type.headlinesOffFace.slice(0, 4).join(', ')}` : ''}`);
    console.log(`  RAW EMOJI           ${r.emoji.length}${r.emoji.length ? `  ${r.emoji.map((e) => `${e.text}@${e.where}`).slice(0, 6).join(', ')}` : ''}`);
    if (r.otherGlyphs.length) {
      console.log(`  other non-ascii     ${r.otherGlyphs.map((g) => `${g.glyph}@${g.where}x${g.n}`).slice(0, 8).join(', ')}`);
    }
    console.log(`  doc overflow x/y    ${r.overflow.x} / ${r.overflow.y}`);
    console.log(`  CLIPPED BY FRAME    ${r.overflow.clipped.length}${r.overflow.clipped.length ? `  ${r.overflow.clipped.slice(0, 4).map((w) => `${w.cls.split(' ')[0]}"${w.text}" -${w.lostPx}px[${w.axis}]`).join(', ')}` : ''}`);
    for (const c of r.overflow.widthChain ?? []) {
      console.log(`     width  d${c.depth} .${c.cls.split(' ')[0]}  ${c.w}px in a ${c.parentW}px parent   scrollW ${c.scrollW} clientW ${c.clientW}`);
    }
    if (r.bar) {
      const d = r.bar.measuredFill !== null && r.bar.expectedFill !== null
        ? Math.abs(r.bar.measuredFill - r.bar.expectedFill) : null;
      console.log(`  BAR label           "${r.bar.label}"`);
      console.log(`  BAR fill measured   ${r.bar.measuredFill}   expected-from-road ${r.bar.expectedFill}   delta ${d === null ? '-' : d.toFixed(4)}`);
      console.log(`  BAR label claims    ${r.bar.labelClaims ?? 'NOT CHECKABLE (no denominator)'}`);
      if (r.bar.segment) console.log(`  BAR segment         ${r.bar.segment.from} -> ${r.bar.segment.to}, at ${r.bar.segment.cur}`);
    }
    if (r.pageErrors.length) console.log(`  PAGE ERRORS         ${r.pageErrors.slice(0, 2).join(' | ')}`);
    if (r.text.failing || r.emoji.length || r.overflow.x > 0 || r.overflow.clipped.length) hardFails++;
  }
  console.log(`\n${hardFails === 0 ? 'ALL CLEAN' : `${hardFails} screen/viewport combinations with a hard failure`}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
