#!/usr/bin/env node
/**
 * IN-MATCH HUD acceptance battery — the numbers that decide whether a HUD change is
 * an improvement, defined before round 1.
 *
 * ── Why this exists, and why it does NOT use tools/tmp/hud_harness.html ──────────
 * The HUD is the only screen the player looks at while the game is being played and it
 * is the one screen that has never had an acceptance pass. Two instruments already
 * claimed to cover parts of it and BOTH return confident wrong answers:
 *
 *  1. `hud_fit.mjs` reports `pill=220px` at every viewport. The game renders that pill
 *     at **196px**. `index.html:15` sets `* { box-sizing: border-box }` globally and
 *     `hud_harness.html` does not, so the harness lays the plate out as
 *     196 content + 18 padding + 6 border = 220. Every geometry number ever taken
 *     through that harness was measured on a plate 12% wider than the shipped one —
 *     which is exactly enough slack to make an overflowing row fit, and is why
 *     `hud.ts`'s own comment claims "Verified 0px overflow at 5 viewports x 3 states"
 *     beside text that visibly sits outside its plate in `shots/hud/r0/desk-late.png`.
 *
 *  2. `hud_fit.mjs` measures overflow as `row.scrollWidth - row.clientWidth`.
 *     `docs/LESSONS.md` and `CLAUDE.md` both record scrollWidth reading clean through
 *     a clip; here the row does not clip, but the metric still cannot see a child whose
 *     ink box crosses its PLATE's border — which is the thing that matters, because the
 *     plate is opaque on purpose (a translucent one let the pot's hazard ring read
 *     through a zone readout).
 *
 * So everything below is measured on the REAL game, at shipped framing, MID-FIGHT.
 * Every previous match capture in this repo (`matchshot.mjs`, the arena stations) uses
 * `simSpeed=0.02`, which freezes the sim on the COUNTDOWN — so the frame carries a
 * 140px orange numeral, no combat, no fog and no danger state. That is not the screen.
 *
 * ── The acceptance test ─────────────────────────────────────────────────────────
 *   A. TEXT CONTRAST. Every visible HUD text run, against THE PIXELS ACTUALLY BEHIND
 *      IT, must clear WCAG AA (4.5, or 3.0 for large text). The menu passes took 65
 *      failures to 0 and a minimum of 1.64 -> 4.91; the HUD has never been held to it.
 *      The split is copied VERBATIM from `home_metrics.mjs` / `screen_metrics.mjs` so
 *      the numbers compare directly to those runs.
 *   B. NON-TEXT MARKS. Every gameplay-critical mark (radar dots, the safe-zone
 *      boundary, weapon icons, cooldown wipe, health fills, the chevron) must clear
 *      3.0 against the pixels it is drawn on. WCAG 1.4.11. LESSONS section 1 case 10
 *      is a HUD cooldown wipe that three critics reported as absent across three
 *      rounds — a contrast number finds that in minutes.
 *   C. FIT. No text may cross its own plate. Measured from client rects against the
 *      plate's BORDER box, never from scrollWidth.
 *   D. NO COLLISIONS. Named HUD landmarks must not overlap each other, and nothing
 *      may be drawn over the clock or the health bars.
 *   E. STATE REACHABILITY. Every authored state class must actually be applied by
 *      `renderZone`/`update` in the state it describes. This exists because
 *      `.hud-zone.is-danger` — the alarm styling for "you are being killed right now"
 *      — is authored in three CSS rules and set by nothing.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────────
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/hud_accept.mjs --url {URL} --out shots/hud/before --label before
 *   node tools/tmp/hud_accept.mjs --url <base> --selftest    # validate the instrument
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// colour, copied verbatim from home_metrics.mjs / screen_metrics.mjs
// ─────────────────────────────────────────────────────────────────────────────

function relLum(r, g, b) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const l1 = Math.max(a, b), l2 = Math.min(a, b); return (l1 + 0.05) / (l2 + 0.05); }

function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] };
}

function binsOf(px, W, x0, y0, w, h) {
  const bins = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = bins.get(key);
      if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += r; e.g += g; e.b += b; n++;
    }
  }
  if (n === 0) return [];
  return [...bins.values()]
    .map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / n }))
    .sort((a, b) => b.share - a.share);
}

/**
 * Foreground/background split for one rect, taken from PIXELS.
 *
 * VERBATIM from `home_metrics.mjs` (which took it verbatim from `screen_metrics.mjs`)
 * including the `-webkit-text-stroke` branch: a stroked glyph sits on its own stroke,
 * not on the backdrop, and a gate that reports a false FAIL gets switched off.
 */
function splitFgBg(px, W, x0, y0, w, h, minShare = 0.015, color = null, stroke = null) {
  if (stroke && stroke.width >= 1.5) {
    const paper = { r: stroke.r, g: stroke.g, b: stroke.b };
    const paperL = relLum(paper.r, paper.g, paper.b);
    let ink = color ?? paper;
    if (color) {
      const bins = binsOf(px, W, x0, y0, w, h);
      let best = 70;
      for (const b of bins) {
        if (b.share < 0.015) continue;
        const d = Math.hypot(b.r - color.r, b.g - color.g, b.b - color.b);
        if (d < best) { best = d; ink = b; }
      }
    }
    return { bg: paper, fg: ink, viaStroke: true, share: 1, ratio: contrast(relLum(ink.r, ink.g, ink.b), paperL) };
  }
  const bins = new Map();
  let n = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = bins.get(key);
      if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += r; e.g += g; e.b += b; n++;
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
  return { bg: bgc, fg, ratio: contrast(relLum(fg.r, fg.g, fg.b), bgL), share: +(bg.n / n).toFixed(3) };
}

/**
 * A solid mark against WHAT SURROUNDS IT — a different question from splitFgBg.
 *
 * A radar dot, a health fill or a chevron has no "ink and paper" inside its own box;
 * it is one colour, and the thing it has to survive is the pixels immediately outside.
 *
 * ── Why this credits the OUTLINE, and why that is not letting the HUD off ────────
 * The first version compared only the modal colour inside the element's border box
 * against the modal colour of the ring outside it, and reported the player's radar dot
 * at 1.77 — green #16C46F on the cream safe disc. That number is TRUE and it answers
 * the wrong question. The dot carries `box-shadow: 0 0 0 2.5px #FFFFFF, 0 0 0 4px
 * #1a1224` precisely so that a mid-value fill does not have to survive on its own; that
 * is the same rule the aim reticle and the safe-zone chevron are both built on ("a pale
 * mark on this arena needs an ACTUAL dark fill layer behind it"). A gate that scores
 * the fill and ignores the outline would demand the fill be re-keyed, i.e. would
 * prescribe a change the pixels do not need — `docs/LESSONS.md` section 3, take the
 * symptom and re-derive the cause.
 *
 * So the mark's own box is GROWN by its computed box-shadow extent (read off the DOM,
 * not guessed), and the reported ratio is the best separation any bin holding at least
 * `MARK_MIN_SHARE` of that grown box achieves against the modal surround. `coreRatio`
 * — the un-outlined fill — is reported alongside it, because the two disagreeing is
 * itself information: it says the mark is legible only because of its outline.
 */
const MARK_MIN_SHARE = 0.08;

function markVsSurround(px, W, H, r, pad = 6, grow = 0) {
  const gx = r.x - grow, gy = r.y - grow, gw = r.w + grow * 2, gh = r.h + grow * 2;
  const inside = binsOf(px, W, ...clampTo(W, H, gx, gy, gw, gh));
  const core = binsOf(px, W, ...clampTo(W, H, r.x, r.y, r.w, r.h));
  if (!inside.length || !core.length) return null;
  const ringBins = new Map();
  let n = 0;
  const [rx, ry, rw, rh] = clampTo(W, H, gx - pad, gy - pad, gw + pad * 2, gh + pad * 2);
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (x >= gx - 1 && x < gx + gw + 1 && y >= gy - 1 && y < gy + gh + 1) continue;
      const i = (y * W + x) * 3;
      const c = px[i], g = px[i + 1], b = px[i + 2];
      const key = (c >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
      let e = ringBins.get(key);
      if (!e) ringBins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += c; e.g += g; e.b += b; n++;
    }
  }
  if (!n) return null;
  let sur = null;
  for (const e of ringBins.values()) if (!sur || e.n > sur.n) sur = e;
  const s = { r: sur.r / sur.n, g: sur.g / sur.n, b: sur.b / sur.n };
  const sL = relLum(s.r, s.g, s.b);
  let best = null, bestR = -1;
  for (const b of inside) {
    if (b.share < MARK_MIN_SHARE) continue;
    const c = contrast(relLum(b.r, b.g, b.b), sL);
    if (c > bestR) { bestR = c; best = b; }
  }
  if (!best) { best = inside[0]; bestR = contrast(relLum(best.r, best.g, best.b), sL); }
  return {
    mark: best, surround: s, ratio: bestR,
    coreRatio: contrast(relLum(core[0].r, core[0].g, core[0].b), sL),
  };
}

function clampTo(W, H, x, y, w, h) {
  const x0 = Math.max(0, Math.min(W - 1, Math.round(x)));
  const y0 = Math.max(0, Math.min(H - 1, Math.round(y)));
  return [x0, y0, Math.max(1, Math.min(W - x0, Math.round(w))), Math.max(1, Math.min(H - y0, Math.round(h)))];
}

// ─────────────────────────────────────────────────────────────────────────────
// what gets driven
// ─────────────────────────────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'desktop', w: 1600, h: 900, touch: false },
  { name: 'laptop', w: 1280, h: 800, touch: false },
  { name: 'tablet', w: 1024, h: 768, touch: false },
  { name: 'phone-land', w: 844, h: 390, touch: true },
  { name: 'portrait', w: 430, h: 932, touch: false },
];

/**
 * Match states. `?fogRadius=` skips the countdown and rewinds the clock to the moment
 * the ring is that wide, so a fight state is one navigation away instead of 5.7 s of
 * countdown at SwiftShader's ~9 fps.
 *
 * `px/py` are checked against `arena.cover` by `match.ts:checkQaSpawn` and it warns
 * loudly on a bad placement — (1180, 820) is clear (LESSONS section 10: a QA parameter
 * can manufacture a bug that does not exist).
 */
const STATES = [
  { name: 'fight', q: 'fogRadius=700', settle: 4000 },
  { name: 'danger', q: 'fogRadius=300&px=1180&py=820', settle: 2500 },
  // The RESULT CARD. Not "in-match" strictly, but it is `hud.ts`, it is 100% of what
  // the player reads at the end of every match, and it was where a leftover damage
  // number was found printed between "Match time" and the Play Again button. simSpeed
  // fast-forwards a whole 45 s match into a few seconds of wall clock; the wait is on
  // `phase === 'ended'`, not on a duration.
  { name: 'ended', q: 'simSpeed=12', settle: 1200, until: 'ended' },
];

/** Landmarks that must never overlap each other. */
const LANDMARKS = [
  '.hud-fighter--player', '.hud-fighter--enemy', '.hud-clock', '.hud-weapons',
  '.hud-radar', '.hud-mute', '.fa-match .match-chip',
];

/**
 * Elements that must never have another HUD element PAINTED OVER them, checked by
 * DOM order rather than by sampling — because the thing that covered the result card
 * was a 0.85 s damage number, and a sampled check cannot be relied on to be looking
 * when a transient is up (see the note on `overClock`).
 *
 * Everything in `.hud-root` that is declared AFTER the card is drawn on top of it,
 * since they are siblings with no z-index between them.
 */
const MUST_BE_TOPMOST = ['.hud-gameover'];

/**
 * Non-text marks, and what each one has to survive.
 *
 * `mode: 'ink'`   the element contains a mark on its own plate (icons, cooldown wipe)
 * `mode: 'solid'` the element IS the mark and must survive its surround (dots, fills)
 */
const MARKS = [
  { sel: '.hud-radar-safe', mode: 'solid', pad: 7, why: 'where the safe zone is' },
  { sel: '.hud-radar-dot--player', mode: 'solid', pad: 7, why: 'where am I on the map' },
  { sel: '.hud-radar-dot--enemy', mode: 'solid', pad: 7, why: 'where is the enemy' },
  { sel: '.hud-fighter--player .hud-healthbar-fill', mode: 'solid', pad: 5, why: 'my health' },
  { sel: '.hud-fighter--enemy .hud-healthbar-fill', mode: 'solid', pad: 5, why: 'their health' },
  { sel: '.hud-float--player .hud-float-fill', mode: 'solid', pad: 5, why: 'my health, at my feet' },
  { sel: '.hud-weapon-slot.is-selected .hud-weapon-emoji', mode: 'ink', why: 'the armed weapon' },
  { sel: '.hud-weapon-slot:not(.is-ready) .hud-weapon-cooldown', mode: 'ink', why: 'is it usable' },
  { sel: '.hud-zone-bar', mode: 'solid', pad: 4, why: 'how much zone is left' },
  { sel: '.hud-weapon-slot:not(.is-ready) .hud-weapon-timer', mode: 'ink', why: 'seconds until usable' },
  { sel: '.fa-match .match-chip', mode: 'ink', why: 'the escape hatch' },
  // ⚠️ INFORMATIONAL, NOT GATED — and the reason is an instrument limit, not a pass.
  //
  // The chevron is a CSS border triangle inside an element that `renderZone` ROTATES to
  // the direction of safety. `getBoundingClientRect()` returns the axis-aligned bounds
  // of a rotated shape, so most of the box this samples is whatever is behind the
  // arrow, and the share of it that is actually white swings with the angle. Measured
  // on one frame across five viewports: 17.86, 12.81, 9.64, 5.64 and **1.51** — a
  // 12-point spread on identical CSS, with the low reading coming from a frame where a
  // 4x crop (shots/hud/after1/crop-chev.png) shows two plainly white, plainly visible
  // triangles. The 1.51 is the instrument, not the arrow.
  //
  // Left in because the number is still worth seeing move, and removed from the gate
  // because a gate that cries wolf gets switched off (docs/LESSONS.md section 9).
  { sel: '.hud-safearrow-chevron', mode: 'solid', pad: 10, why: 'which way to run', informational: true },
];

const TEXT_ROOTS = ['.hud-root', '.fa-match'];

/**
 * Which elements changed box across the shutter bracket. Keyed the same way the
 * analysis is, so a moved element can be demoted to informational by identity.
 */
function markMoved(a, b) {
  const out = [];
  // POSITION, and only large SIZE changes. A HUD run's text changes constantly — the
  // clock ticks 0:32 -> 0:31, the HP readout 100 / 100 -> 85 / 100 — and none of that
  // invalidates a contrast sample, because the box is still full of the same element.
  // What DOES invalidate one is the box being somewhere else, or having shrunk enough
  // that the rect is now mostly whatever sat behind it. So: refuse a sample whose
  // origin moved more than 2px, or whose area changed by more than a quarter. Keying
  // on class + ordinal rather than on text, for the same reason.
  const cmp = (m, n) => {
    const dpos = Math.max(Math.abs(n.x - m.x), Math.abs(n.y - m.y));
    const am = Math.max(1, m.w * m.h);
    const dArea = Math.abs(n.w * n.h - am) / am;
    return { dpos: +dpos.toFixed(1), dArea: +dArea.toFixed(3), moved: dpos > 2 || dArea > 0.25 };
  };
  const bm = new Map(b.marks.map((m) => [m.sel, m]));
  for (const m of a.marks) {
    const n = bm.get(m.sel);
    if (!n) { out.push({ kind: 'mark', sel: m.sel, why: 'disappeared across the shutter' }); continue; }
    const c = cmp(m, n);
    if (c.moved) out.push({ kind: 'mark', sel: m.sel, ...c });
  }
  const ord = new Map();
  const keyOf = (r, map) => {
    const k = r.cls || r.tag || '?';
    const i = (map.get(k) ?? 0);
    map.set(k, i + 1);
    return `${k}#${i}`;
  };
  const ordB = new Map();
  const bt = new Map(b.runs.map((r) => [keyOf(r, ordB), r]));
  for (const r of a.runs) {
    const k = keyOf(r, ord);
    const n = bt.get(k);
    if (!n) { out.push({ kind: 'text', sel: r.cls, text: r.text, why: 'disappeared across the shutter' }); continue; }
    const c = cmp(r, n);
    if (c.moved) out.push({ kind: 'text', sel: r.cls, text: r.text, ...c });
  }
  return out;
}

async function collectDom(page) {
  return page.evaluate(({ landmarks, marks, textRoots }) => {
    const vis = (n) => {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return false;
      const r = n.getBoundingClientRect();
      return r.width >= 3 && r.height >= 3 && r.right > 0 && r.bottom > 0
        && r.left < innerWidth && r.top < innerHeight;
    };
    const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };

    // ── text runs ──────────────────────────────────────────────────────────
    // ── Is a full-viewport modal scrim up? ─────────────────────────────────
    // The result card draws `rgba(10,6,16,0.55)` over the whole frame, which is what a
    // scrim is FOR: the chrome behind it is supposed to recede. Measuring that dimmed
    // chrome against AA asks the wrong question and would fail 41 runs and 9 marks
    // whose only sin is being behind a modal — the #F4A300 key badge reads back as
    // rgb(115,77,9), i.e. exactly itself at 55% over black. In the ended state the
    // acceptance question is "is the CARD readable", so everything outside the card is
    // measured and reported but not gated.
    const modal = [...document.querySelectorAll('.hud-gameover')]
      .find((n) => getComputedStyle(n).display !== 'none') ?? null;
    const behindModal = (n) => !!modal && !modal.contains(n);

    const runs = [];
    for (const rootSel of textRoots) {
      const root = document.querySelector(rootSel);
      if (!root) continue;
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      for (let n = walk.currentNode; n; n = walk.nextNode()) {
        const own = Array.from(n.childNodes)
          .filter((c) => c.nodeType === 3 && c.textContent.trim().length > 0)
          .map((c) => c.textContent.trim()).join(' ');
        if (!own || !vis(n)) continue;
        const s = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        // The PLATE this run is supposed to sit on: nearest ancestor with a
        // non-transparent background. Border box, because that is the edge the
        // rounded plate actually draws.
        let plate = null, plateSel = null;
        for (let a = n; a && a !== document.documentElement; a = a.parentElement) {
          const as = getComputedStyle(a);
          const bg = as.backgroundColor;
          const m = /rgba?\(([^)]+)\)/.exec(bg);
          const alpha = m ? (m[1].split(/[,\s/]+/).filter(Boolean).map(Number)[3] ?? 1) : 0;
          if (alpha > 0.5) {
            plate = a.getBoundingClientRect();
            plateSel = (typeof a.className === 'string' ? a.className.split(/\s+/)[0] : a.tagName);
            break;
          }
        }
        runs.push({
          behindModal: behindModal(n),
          text: own.slice(0, 40),
          cls: typeof n.className === 'string' ? n.className : '',
          root: rootSel,
          ...box(n),
          fontFamily: s.fontFamily.split(',')[0].replace(/['"]/g, ''),
          weight: Number(s.fontWeight),
          size: +parseFloat(s.fontSize).toFixed(1),
          color: s.color,
          strokeWidth: parseFloat(s.webkitTextStrokeWidth) || 0,
          strokeColor: s.webkitTextStrokeColor,
          plate: plate ? { x: plate.x, y: plate.y, w: plate.width, h: plate.height, sel: plateSel } : null,
        });
      }
    }

    // ── landmarks ──────────────────────────────────────────────────────────
    const lm = [];
    for (const sel of landmarks) {
      const n = document.querySelector(sel);
      if (n && vis(n)) lm.push({ sel, ...box(n) });
    }

    // ── marks ──────────────────────────────────────────────────────────────
    const mk = [];
    for (const m of marks) {
      const n = document.querySelector(m.sel);
      if (!n || !vis(n)) continue;
      // How far the element's OWN outline reaches past its border box — the extent of
      // its box-shadow (offset + blur + spread), read rather than assumed. This is the
      // authored dark/light backing that makes a mid-value fill findable.
      let grow = 0;
      for (const sh of (getComputedStyle(n).boxShadow || '').split(/,(?![^(]*\))/)) {
        if (!sh || sh === 'none' || /inset/.test(sh)) continue;
        const nums = (sh.match(/-?\d*\.?\d+px/g) ?? []).map(parseFloat);
        if (nums.length >= 3) grow = Math.max(grow, Math.abs(nums[0]) + Math.abs(nums[1]) + nums[2] + (nums[3] ?? 0));
      }
      mk.push({ ...m, ...box(n), behindModal: behindModal(n), grow: Math.min(12, Math.round(grow)) });
    }

    // ── state classes actually applied ─────────────────────────────────────
    const has = (sel, cls) => !!document.querySelector(sel)?.classList.contains(cls);
    const state = {
      zoneDanger: has('.hud-zone', 'is-danger'),
      zoneImminent: has('.hud-zone', 'is-imminent'),
      radarDanger: has('.hud-radar', 'is-danger'),
      fogEdgeOn: has('.hud-fogedge', 'is-on'),
      arrowShown: getComputedStyle(document.querySelector('.hud-safearrow')).display !== 'none',
      playerLow: has('.hud-fighter--player .hud-healthbar', 'is-low'),
      zoneLabel: document.querySelector('[data-el="zone-label"]')?.textContent ?? null,
      zoneValue: document.querySelector('[data-el="zone-value"]')?.textContent ?? null,
      phase: window.__matchDebug?.phase ?? null,
      playerHp: window.__vfxDebugFighters?.player?.hp ?? null,
    };

    // ── damage-number layer: does anything float over the clock or the bars ──
    //
    // ⚠️ THE SAMPLED HALF OF THIS CHECK RACES THE THING IT MEASURES. A `.hud-dmg`
    // lives for 0.85 s and this DOM read happens before the shutter, so a number that
    // is not on screen NOW can be on screen in the PNG — which is exactly what
    // happened: this reported 0 while `shots/hud/after1/...phone-land-danger.png`
    // shows "-15 ZONE" drawn straight over "0:14". So the guarantee is asserted
    // STRUCTURALLY as well, off the geometry that cannot be raced: the damage layer's
    // clip boundary must sit at or below the clock, in which case no damage number can
    // reach the clock at any instant, sampled or not. Keep both — the sample catches
    // the float pills (which persist), the invariant catches the transients.
    const overClock = [];
    const clock = document.querySelector('.hud-clock')?.getBoundingClientRect();
    const pbar = document.querySelector('.hud-fighter--player')?.getBoundingClientRect();
    const ebar = document.querySelector('.hud-fighter--enemy')?.getBoundingClientRect();
    // The damage layer is clipped at --fa-dmg-top, so the part of a number's BOX above
    // that line never reaches the screen. Comparing raw boxes reported a 4,654px2 hit
    // on the clock that the clip had already removed — a box overlap is not a pixel
    // overlap once a clip-path is in play.
    const dlEl = document.querySelector('.hud-dmg-layer');
    const clipTopPx = dlEl ? (parseFloat(getComputedStyle(dlEl).getPropertyValue('--fa-dmg-top')) || 0) : 0;
    for (const d of document.querySelectorAll('.hud-dmg.is-playing, .hud-float')) {
      if (!vis(d)) continue;
      const raw = d.getBoundingClientRect();
      const clipped = d.classList.contains('hud-dmg');
      const r = { left: raw.left, right: raw.right, bottom: raw.bottom, top: clipped ? Math.max(raw.top, clipTopPx) : raw.top };
      if (r.bottom <= r.top) continue;
      for (const [name, t] of [['clock', clock], ['player-bar', pbar], ['enemy-bar', ebar]]) {
        if (!t) continue;
        const ox = Math.min(r.right, t.right) - Math.max(r.left, t.left);
        const oy = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
        if (ox > 0 && oy > 0) {
          overClock.push({ what: typeof d.className === 'string' ? d.className : '?', over: name, area: Math.round(ox * oy) });
        }
      }
    }

    // Which HUD layers are declared after the ones that must be topmost.
    const painters = [];
    for (const sel of ['.hud-gameover']) {
      const n = document.querySelector(sel);
      if (!n || !n.parentElement) continue;
      const kids = [...n.parentElement.children];
      const i = kids.indexOf(n);
      for (const later of kids.slice(i + 1)) {
        painters.push({ sel, over: typeof later.className === 'string' ? later.className.split(/\s+/)[0] : later.tagName });
      }
    }

    const dl = document.querySelector('.hud-dmg-layer');
    const tb = document.querySelector('.hud-topbar')?.getBoundingClientRect();
    const clip = {
      // The computed value of the custom property the HUD publishes, in px.
      topPx: dl ? (parseFloat(getComputedStyle(dl).getPropertyValue('--fa-dmg-top')) || 0) : null,
      clockBottom: clock ? +clock.bottom.toFixed(1) : null,
      topbarBottom: tb ? +tb.bottom.toFixed(1) : null,
      clipPath: dl ? getComputedStyle(dl).clipPath : null,
    };
    return { runs, landmarks: lm, marks: mk, state, overClock, clip, painters, dpr: devicePixelRatio };
  }, { landmarks: LANDMARKS, marks: MARKS, textRoots: TEXT_ROOTS });
}

function analyse(dom, px, W, H, vp, st) {
  const rows = [];

  // ── A. text contrast ────────────────────────────────────────────────────
  const texts = dom.runs.map((r) => {
    const sc = parseColor(r.strokeColor);
    const stroke = r.strokeWidth > 0 ? { ...sc, width: r.strokeWidth } : null;
    const s = splitFgBg(px, W, ...clampTo(W, H, r.x, r.y, r.w, r.h), 0.015, parseColor(r.color), stroke);
    const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
    const floor = large ? 3.0 : 4.5;
    return {
      vp: vp.name, st: st.name, text: r.text, cls: r.cls, size: r.size, weight: r.weight,
      ratio: s ? +s.ratio.toFixed(2) : null, floor, large, behindModal: !!r.behindModal,
      pass: r.behindModal ? true : (s ? s.ratio >= floor : false),
      bg: s ? `rgb(${Math.round(s.bg.r)},${Math.round(s.bg.g)},${Math.round(s.bg.b)})${s.viaStroke ? '[stroke]' : ''}` : null,
      fg: s ? `rgb(${Math.round(s.fg.r)},${Math.round(s.fg.g)},${Math.round(s.fg.b)})` : null,
    };
  });

  // ── B. non-text marks ───────────────────────────────────────────────────
  const marks = dom.marks.map((m) => {
    if (m.mode === 'solid') {
      const r = markVsSurround(px, W, H, m, m.pad ?? 6, m.grow ?? 0);
      return {
        vp: vp.name, st: st.name, sel: m.sel, mode: m.mode, why: m.why,
        ratio: r ? +r.ratio.toFixed(2) : null, coreRatio: r ? +r.coreRatio.toFixed(2) : null,
        outlinePx: m.grow ?? 0, floor: 3.0, informational: !!m.informational || !!m.behindModal,
        pass: (m.informational || m.behindModal) ? true : (r ? r.ratio >= 3.0 : false),
        fg: r ? `rgb(${Math.round(r.mark.r)},${Math.round(r.mark.g)},${Math.round(r.mark.b)})` : null,
        bg: r ? `rgb(${Math.round(r.surround.r)},${Math.round(r.surround.g)},${Math.round(r.surround.b)})` : null,
      };
    }
    const s = splitFgBg(px, W, ...clampTo(W, H, m.x, m.y, m.w, m.h), 0.02);
    return {
      vp: vp.name, st: st.name, sel: m.sel, mode: m.mode, why: m.why,
      ratio: s ? +s.ratio.toFixed(2) : null, floor: 3.0, informational: !!m.informational || !!m.behindModal,
      pass: (m.informational || m.behindModal) ? true : (s ? s.ratio >= 3.0 : false),
      fg: s ? `rgb(${Math.round(s.fg.r)},${Math.round(s.fg.g)},${Math.round(s.fg.b)})` : null,
      bg: s ? `rgb(${Math.round(s.bg.r)},${Math.round(s.bg.g)},${Math.round(s.bg.b)})` : null,
    };
  });

  // ── C. fit — every run inside its own plate ─────────────────────────────
  const fits = dom.runs.filter((r) => r.plate).map((r) => {
    const over = Math.max(
      r.x + r.w - (r.plate.x + r.plate.w),   // right
      r.plate.x - r.x,                        // left
      r.y + r.h - (r.plate.y + r.plate.h),   // bottom
      r.plate.y - r.y,                        // top
    );
    return { vp: vp.name, st: st.name, text: r.text, cls: r.cls, plate: r.plate.sel, overflowPx: +over.toFixed(1) };
  });

  // ── D. landmark collisions ──────────────────────────────────────────────
  const hits = [];
  for (let i = 0; i < dom.landmarks.length; i++) {
    for (let j = i + 1; j < dom.landmarks.length; j++) {
      const a = dom.landmarks[i], b = dom.landmarks[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) hits.push({ vp: vp.name, st: st.name, a: a.sel, b: b.sel, w: +ox.toFixed(1), h: +oy.toFixed(1) });
    }
  }

  rows.push(...texts);
  return { texts, marks, fits, hits, state: dom.state, overClock: dom.overClock, clip: dom.clip, painters: dom.painters };
}

async function run() {
  const args = parseArgs(process.argv);
  const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
  const OUT = String(args.out ?? 'shots/hud/accept');
  const LABEL = String(args.label ?? 'run');
  mkdirSync(OUT, { recursive: true });
  if (!BASE) { console.error('need --url (a tools/snapshot.mjs server)'); process.exit(2); }
  if (BASE.includes(':5173')) console.error('\n!! --url is the SHARED dev server. Use tools/snapshot.mjs.\n');

  const only = args.vp ? String(args.vp).split(',') : null;
  const vps = only ? VIEWPORTS.filter((v) => only.includes(v.name)) : VIEWPORTS;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const all = { texts: [], marks: [], fits: [], hits: [], states: [], overClock: [], clips: [] };
  all.painters = [];
  const allMoved = [];
  const errors = [];

  for (const vp of vps) {
    for (const st of STATES) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
      page.on('pageerror', (e) => errors.push(`${vp.name}/${st.name}: ${e}`));
      const url = `${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&${st.q}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      if (vp.touch) await page.evaluate(() => document.documentElement.classList.add('fa-touch-capable', 'fa-touch'));
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 240_000 });
      if (st.until) await page.waitForFunction(`window.__matchDebug?.phase === ${JSON.stringify(st.until)}`, null, { timeout: 300_000 });
      await page.waitForTimeout(st.settle);

      // SELFTEST: break one run on purpose and prove the battery reports it. An
      // instrument that has never returned a FAIL on a known-bad input is not an
      // instrument (docs/LESSONS.md section 13 — nine of them lied this session).
      if (args.selftest) {
        await page.evaluate(() => {
          const t = document.querySelector('[data-el="timer"]');
          // ink == paper, opaquely, with every rescuing effect off. A run whose glyphs
          // are literally the same colour as the plate they sit on MUST come back at
          // ratio ~1.0; if it does not, nothing else this file prints can be believed.
          t.style.background = '#3a2b4e';
          t.style.borderColor = '#3a2b4e';
          t.style.color = '#3a2b4e';
          t.style.textShadow = 'none';
          t.style.webkitTextStroke = '0';
          t.style.boxShadow = 'none';
        });
        await page.waitForTimeout(200);
      }

      // ── BRACKET THE SHUTTER ────────────────────────────────────────────────
      // Every rect below is read from the DOM and then used to index into a PNG taken
      // afterwards, and the sim does not stop for either. Anything anchored to a
      // moving fighter — `.hud-float-*`, `.hud-safearrow*`, `.hud-dmg` — can be
      // somewhere else by the time the shutter opens, and then the "mark" being
      // measured is whatever the arena put in that box instead.
      //
      // It is not hypothetical: the player's floating HP fill came back at 1.56 with a
      // mark colour of rgb(190,198,220) and a surround of rgb(179,147,194) — neither of
      // which is the #3FCB86 fill or the #10060F pill. The player was at 55 HP and
      // moving, so the rect was 37px of real green somewhere the capture no longer had
      // it. Reported as a HUD failure it would have sent a fix to an element that is
      // fine (docs/LESSONS.md section 13, and section 3's "re-derive the cause").
      //
      // So: read, shoot, read again, and refuse any element whose box moved more than
      // a pixel across the bracket. This is the same discipline `settle.mjs`'s
      // `captureSettled` applies to the page's paint state, for the same reason.
      const dom = await collectDom(page);
      const shot = `${OUT}/${LABEL}-${vp.name}-${st.name}.png`;
      await page.screenshot({ path: shot, timeout: 180_000 });
      const dom2 = await collectDom(page);
      await page.close();

      const moved = markMoved(dom, dom2);
      const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const r = analyse(dom, data, info.width, info.height, vp, st);
      allMoved.push(...moved.map((m) => ({ vp: vp.name, st: st.name, ...m })));
      const movedMarks = new Set(moved.filter((m) => m.kind === 'mark').map((m) => m.sel));
      const movedTexts = new Set(moved.filter((m) => m.kind === 'text').map((m) => m.sel + '|' + m.text));
      for (const m of r.marks) if (movedMarks.has(m.sel)) { m.informational = true; m.pass = true; m.movedAcrossShutter = true; }
      for (const t of r.texts) if (movedTexts.has(t.cls + '|' + t.text)) { t.movedAcrossShutter = true; t.pass = true; }
      all.texts.push(...r.texts);
      all.marks.push(...r.marks);
      all.fits.push(...r.fits);
      all.hits.push(...r.hits);
      all.overClock.push(...r.overClock.map((o) => ({ vp: vp.name, st: st.name, ...o })));
      all.states.push({ vp: vp.name, st: st.name, ...r.state });
      all.clips.push({ vp: vp.name, st: st.name, ...r.clip });
      all.painters.push(...r.painters.map((p) => ({ vp: vp.name, st: st.name, ...p })));
      console.log(`  ${vp.name}/${st.name}: ${r.texts.length} runs, min ${Math.min(...r.texts.map((t) => t.ratio ?? 99)).toFixed(2)}, ${r.texts.filter((t) => !t.pass).length} fail`);
    }
  }
  await browser.close();

  // ── verdict ─────────────────────────────────────────────────────────────
  const textFails = all.texts.filter((t) => !t.pass).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));
  const markFails = all.marks.filter((m) => !m.pass).sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0));
  const overflows = all.fits.filter((f) => f.overflowPx > 0.5).sort((a, b) => b.overflowPx - a.overflowPx);
  // Moved samples are excluded from the headline minimum as well as from the gate: a
  // number taken through a stale rect is not a conservative reading, it is a reading of
  // something else.
  const steadyTexts = all.texts.filter((t) => !t.movedAcrossShutter && !t.behindModal);
  const minText = steadyTexts.length ? Math.min(...steadyTexts.map((t) => t.ratio ?? 99)) : null;
  const gated = all.marks.filter((m) => !m.informational);
  const minMark = gated.length ? Math.min(...gated.map((m) => m.ratio ?? 99)) : null;

  // D2. The structural half: no damage number can reach the clock, ever.
  const clipBugs = [];
  for (const c of all.clips) {
    if (c.topPx === null) continue;
    if (!/inset/.test(c.clipPath ?? '')) clipBugs.push(`${c.vp}/${c.st}: .hud-dmg-layer has no inset clip (${c.clipPath})`);
    else if (c.topPx < c.clockBottom) clipBugs.push(`${c.vp}/${c.st}: damage layer clips at ${c.topPx}px, the clock ends at ${c.clockBottom}px — a rising number can cover it`);
    else if (c.topPx < c.topbarBottom) clipBugs.push(`${c.vp}/${c.st}: damage layer clips at ${c.topPx}px, the top bar ends at ${c.topbarBottom}px`);
  }

  // D3. Nothing may be declared after an element that must be topmost.
  const paintBugs = [...new Set(all.painters.map((p) => `${p.sel} is painted over by ${p.over}`))];

  // E. state reachability — checked against the state the URL put the game in.
  const stateBugs = [];
  for (const s of all.states) {
    if (s.st === 'danger') {
      if (!s.zoneDanger) stateBugs.push(`${s.vp}/danger: .hud-zone is MISSING is-danger (label "${s.zoneLabel}" / "${s.zoneValue}")`);
      if (!s.radarDanger) stateBugs.push(`${s.vp}/danger: .hud-radar is MISSING is-danger`);
      if (!s.fogEdgeOn) stateBugs.push(`${s.vp}/danger: .hud-fogedge is MISSING is-on`);
    }
    if (s.st === 'fight' && s.zoneDanger) stateBugs.push(`${s.vp}/fight: .hud-zone has is-danger while inside the ring`);
  }

  const report = {
    label: LABEL, url: BASE, viewports: vps.map((v) => v.name), states: STATES.map((s) => s.name),
    summary: {
      textRuns: all.texts.length, textMeasured: steadyTexts.length, textFails: textFails.length, minTextRatio: minText === null ? null : +minText.toFixed(2),
      marks: gated.length, markFails: markFails.length, minMarkRatio: minMark === null ? null : +minMark.toFixed(2),
      overflows: overflows.length, worstOverflowPx: overflows.length ? overflows[0].overflowPx : 0,
      landmarkCollisions: all.hits.length,
      drawnOverClockOrBars: all.overClock.length,
      clipInvariantBugs: clipBugs.length,
      paintOrderBugs: paintBugs.length,
      stateBugs: stateBugs.length,
      pageErrors: errors.length,
    },
    textFails, markFails, overflows, collisions: all.hits, overClock: all.overClock, clipBugs, clips: all.clips,
    stateBugs, paintBugs, states: all.states, allTexts: all.texts, allMarks: all.marks, movedAcrossShutter: allMoved, errors,
  };
  writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify(report, null, 2));

  const S = report.summary;
  console.log(`\n══ HUD acceptance [${LABEL}] ══`);
  const behind = all.texts.filter((t) => t.behindModal);
  console.log(` A. text runs            ${S.textRuns}   gated ${S.textMeasured}   below AA: ${S.textFails}   min ratio ${S.minTextRatio}`);
  if (behind.length) {
    const worst = Math.min(...behind.map((t) => t.ratio ?? 99));
    console.log(`      (${behind.length} run(s) behind the result card's scrim — reported, not gated; worst ${worst.toFixed(2)})`);
  }
  if (allMoved.length) {
    const byWhat = [...new Set(allMoved.map((m) => m.sel))];
    console.log(`      (${allMoved.length} sample(s) refused — the element moved across the shutter: ${byWhat.slice(0, 5).join(', ')})`);
  }
  for (const f of textFails.slice(0, 14)) {
    console.log(`      x ${String(f.ratio).padStart(5)} (need ${f.floor})  ${f.size}px/${f.weight}  "${f.text}"  ${f.cls}  [${f.vp}/${f.st}]  ${f.fg} on ${f.bg}`);
  }
  const info = all.marks.filter((m) => m.informational);
  console.log(` B. non-text marks       ${S.marks}   below 3.0: ${S.markFails}   min ratio ${S.minMarkRatio}   (${info.length} informational, not gated)`);
  if (info.length) console.log(`      i ${info.map((m) => m.ratio).join(', ')}  ${info[0].sel}  — see the note in MARKS`);
  for (const f of markFails.slice(0, 14)) {
    console.log(`      x ${String(f.ratio).padStart(5)}  ${f.sel}  (${f.why})  [${f.vp}/${f.st}]  ${f.fg} on ${f.bg}${f.coreRatio !== undefined ? `  core ${f.coreRatio} outline ${f.outlinePx}px` : ''}`);
  }
  console.log(` C. text outside plate   ${S.overflows}   worst ${S.worstOverflowPx}px`);
  for (const f of overflows.slice(0, 10)) console.log(`      x ${String(f.overflowPx).padStart(6)}px  "${f.text}" out of .${f.plate}  [${f.vp}/${f.st}]`);
  console.log(` D. landmark collisions  ${S.landmarkCollisions}`);
  for (const h of all.hits.slice(0, 10)) console.log(`      x ${h.a} <-> ${h.b}  ${h.w}x${h.h}px  [${h.vp}/${h.st}]`);
  console.log(`    over clock/bars      ${S.drawnOverClockOrBars}   (sampled — races transients)`);
  console.log(`    dmg-clip invariant   ${S.clipInvariantBugs} bug(s)   clip ${all.clips.map((c) => c.topPx).join('/')}px vs clock ${all.clips.map((c) => c.clockBottom).join('/')}px`);
  for (const b of clipBugs.slice(0, 8)) console.log(`      x ${b}`);
  for (const o of all.overClock.slice(0, 10)) console.log(`      x ${o.what} over ${o.over} (${o.area}px^2)  [${o.vp}/${o.st}]`);
  console.log(`    paint order          ${S.paintOrderBugs} bug(s)  (${MUST_BE_TOPMOST.join(', ')} must be last in .hud-root)`);
  for (const b of paintBugs.slice(0, 8)) console.log(`      x ${b}`);
  console.log(` E. state reachability   ${S.stateBugs} bug(s)`);
  for (const b of stateBugs.slice(0, 10)) console.log(`      x ${b}`);
  if (errors.length) console.log(` PAGE ERRORS: ${errors.slice(0, 3).join(' | ')}`);
  console.log('');

  const clean = S.textFails === 0 && S.markFails === 0 && S.overflows === 0
    && S.landmarkCollisions === 0 && S.stateBugs === 0 && S.pageErrors === 0
    && S.clipInvariantBugs === 0 && S.paintOrderBugs === 0;
  if (args.selftest) {
    const caught = textFails.some((f) => f.cls.includes('hud-timer'));
    console.log(caught
      ? ' SELFTEST PASS — the battery reported the deliberately broken .hud-timer run.'
      : ' SELFTEST FAIL — a run with ink == paper was NOT reported. Do not trust this tool.');
    process.exit(caught ? 0 : 1);
  }
  process.exit(clean ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
