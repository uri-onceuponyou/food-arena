#!/usr/bin/env node
/**
 * `mn_occlude` — IS EVERY TEXT RUN ON A MENU ACTUALLY ON SCREEN?
 *
 * ── The defect class this exists for ─────────────────────────────────────────
 * Uri: *"Menus/Homescreen VFX still doesn't look professional."* Read the phone
 * portrait plates and the loudest thing is not colour and not chroma — it is that
 * FOUR different screens draw a text run underneath something else:
 *
 *   home       the hero's NAME ("Hamburger") sits under the tab bar
 *   home       "TAP TO TAUNT" sits under the START GAME button
 *   settings   "Changes save as you make them" sits under DONE
 *   characters the roster card names sit under the portraits
 *
 * `menu_accept` and `menu_accept_portrait` are 200+ assertions between them and
 * NEITHER can see this: they assert page overflow, 44px tap targets, safe-area
 * insets, hero framing, flow and contrast. Every one of those passes with a label
 * fully hidden behind an opaque button — the label still has its box, its size and
 * its contrast; it is simply not visible. `CLAUDE.md` rule 4 in its usual direction:
 * the thing IS rendering and IS invisible.
 *
 * ── Why NOT `document.elementFromPoint` ──────────────────────────────────────
 * The obvious implementation, and it is WRONG here, in both directions:
 *
 *   • it answers HIT order, not PAINT order. `.home-nameplate` and
 *     `.home-stage-hint` are both `pointer-events: none` BY DESIGN, so the topmost
 *     hit target over them is whatever is behind — every such run would be reported
 *     100% occluded when nothing covers it at all. Two of the four real defects
 *     above live on exactly those two elements, so the instrument would have been
 *     right by accident and wrong about its own reason.
 *   • conversely a `pointer-events: none` overlay PAINTS over text and hit-tests
 *     through it, so a real occluder would be reported as clear.
 *
 * ── What it does instead: ABLATE TO AN UNMISSABLE COLOUR ─────────────────────
 * `docs/AGENT-BRIEF.md` §4.2. Per text run E, two captures of the SAME layout —
 * `visibility` never changes layout, and neither does `color`:
 *
 *   A  E is painted #FF00FF, page otherwise untouched   -> visible magenta px
 *   B  E is painted #FF00FF, everything not on E's own  -> total magenta px
 *      ancestor/descendant chain is `visibility: hidden`
 *
 *   occludedFrac = 1 - A/B
 *
 * B is the "what it would look like with nothing in front of it" control, measured
 * rather than assumed, so a run that is small, clipped by its own `overflow: hidden`
 * or ellipsised does not read as occluded. Both frames are cropped to E's own union
 * rect, so nothing elsewhere on the page can contribute a count.
 *
 * ⚠️ The magenta test is MAGENTA-DOMINANT, not magenta-exact, and a per-page BASE frame
 * is subtracted. The exact version (`R>245 && G<10 && B>245`) is kept in `isMagenta`'s
 * docblock with the reason: it silently excluded every run with `opacity < 1`, which is
 * how the tool reported NOTHING about "Tap to taunt" — one of the two runs it was
 * written to catch.
 *
 * ── The other two detectors ──────────────────────────────────────────────────
 *   CLIP  — an element's box crosses the viewport edge AND no ancestor can scroll to
 *           it. Occlusion cannot see this: the pixels are absent from BOTH captures, so
 *           A/B stays 1.0. Geometry only. ⚠️ The scroller clause is load-bearing —
 *           without it the detector called ~120 below-the-fold runs on shop/settings/
 *           trophies "CLIPPED 100%", against ONE true positive.
 *   WRAP  — a control's text occupies more than one line box, counted with a `Range`
 *           per TEXT NODE (never over the element's contents — that counts the inline
 *           <svg> icon as a second line and flagged seven unwrapped controls), plus an
 *           independent ink-height-vs-line-height test.
 *
 * ── VALIDATION — `--selftest`, 9 arms over all THREE detectors ───────────────
 * Occlusion: HOLDS · MOVES (opaque occluder) · ORDERS (`elementFromPoint` calls the
 * same covered run CLEAR) · SELF-PAIR · OPACITY. WRAP: HOLDS · MOVES. CLIP: HOLDS ·
 * MOVES · SCROLLER. Plus VACUITY — an empty candidate set REFUSES rather than
 * reporting a clean screen (`[].every()` is `true`; that fired three times in three
 * files in one session).
 * ⚠️ The first version validated ONLY occlusion and shipped two unvalidated detectors,
 * which is exactly how ~127 false positives got printed next to 6 real ones.
 *
 * ── Use ──────────────────────────────────────────────────────────────────────
 *   node tools/tmp/mn_occlude.mjs --url '{URL}' --screens home,shop --vp ph-portrait
 *   node tools/tmp/mn_occlude.mjs --url '{URL}' --selftest
 *   node tools/tmp/mn_occlude.mjs --url '{URL}' --json out.json
 *
 * ⚠️ Every capture asserts `window.__screen` is the screen that was asked for: an
 * unknown `?screen=` value lands on the title card SILENTLY (`menu_accept` check 9).
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { settleScreen } from './settle.mjs';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const VIEWPORTS = {
  // The three portrait widths `menu_accept_portrait` runs, plus landscape phone and
  // desktop. 360 and 430 are here because the lobby's tab bar is a WIDTH-bound layout
  // and 390 is neither the narrowest nor the widest phone in the suite — the fit that
  // holds at 390 is not evidence about either neighbour.
  'ph-360': { w: 360, h: 800, touch: true },
  'ph-portrait': { w: 390, h: 844, touch: true },
  'ph-430': { w: 430, h: 932, touch: true },
  'ph-land': { w: 844, h: 390, touch: true },
  desk: { w: 1600, h: 900, touch: false },
};

/** Runs whose occlusion is INTENTIONAL and must not be reported. Kept explicit and
 *  tiny: an exclusion list is how a census quietly stops covering the thing it was
 *  written for, so each entry names why. */
const EXEMPT = [
  // The scroller's own overflow clipping is measured by CLIP, not by occlusion, and a
  // list item scrolled out of a `overflow:auto` box is correct behaviour.
  '.fa-scroll-clipped',
];

/* ── page-side: enumerate candidate text runs ─────────────────────────────── */
function collectFn() {
  const out = [];
  const seen = new Set();
  const vw = window.innerWidth, vh = window.innerHeight;
  const els = document.querySelectorAll('body *');
  for (const el of els) {
    // Only elements that OWN painted text: at least one non-whitespace direct text node.
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\s+/g, ' ').trim();
    if (!own) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none') continue;
    if (parseFloat(st.opacity) < 0.05) continue;
    if (parseFloat(st.fontSize) < 7) continue;
    // The element's own TEXT rects, not its box: a label inside a tall padded button
    // must be judged on its ink.
    //
    // 🚨 TEXT NODES ONLY, AND THE FIRST VERSION DID NOT DO THIS. It ranged over
    // `selectNodeContents(el)`, which includes an inline <svg> icon — and `.fa-btn` and
    // `.fa-tab` both put one beside their label, on its own baseline. Every one of them
    // came back `lineBoxes: 2` and the WRAP detector reported "Home", "Foods", "Shop",
    // "Start Game", "Done", "Fight!" and "Tap to start" as wrapped when NONE of them is.
    // Seven false positives to the one true one ("Trophies"), which is the ratio
    // `CLAUDE.md` records as the reason a guard gets switched off. Ranging per TEXT NODE
    // excludes the icon by construction.
    let rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      rects.push(...[...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1));
    }
    if (rects.length === 0) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const tops = new Set();
    for (const q of rects) {
      x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top);
      x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
      // 2px quantisation: sub-pixel baselines on the SAME line differ by fractions.
      tops.add(Math.round(q.top / 2));
    }
    if ((x1 - x0) * (y1 - y0) < 30) continue;
    // ── CLIP THE INK TO EVERY ANCESTOR THAT HIDES OVERFLOW, BEFORE ANYTHING ELSE ──
    // 🚨 WITHOUT THIS, BOTH PIXEL AND OVERLAP DETECTORS READ A RUN THAT IS NOT ON SCREEN.
    // A card scrolled past the bottom of `.fa-scroll` still HAS a rect, and that rect is
    // in viewport coordinates BELOW the panel — which is exactly where the shop's bottom
    // bar is. So the overlap detector reported six runs "OVERLAP 100% by .fa-btn" that
    // are not drawn at all: the scroller clips them. Same class as the CLIP detector's
    // ~120 below-the-fold false positives, one layer in.
    let cx0 = x0, cy0 = y0, cx1 = x1, cy1 = y1;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s2 = getComputedStyle(n);
      if (s2.overflowX === 'visible' && s2.overflowY === 'visible') continue;
      const q = n.getBoundingClientRect();
      if (s2.overflowX !== 'visible') { cx0 = Math.max(cx0, q.left); cx1 = Math.min(cx1, q.right); }
      if (s2.overflowY !== 'visible') { cy0 = Math.max(cy0, q.top); cy1 = Math.min(cy1, q.bottom); }
    }
    const drawn = (cx1 - cx0) > 1 && (cy1 - cy0) > 1;
    if (!drawn) continue;   // clipped away entirely — CLIP's scroller clause reports it
    // 🚨 CONTENT WRAP, AND IT IS A DIFFERENT QUESTION FROM TEXT WRAP.
    // Ranging over text nodes killed seven false positives AND the one true positive
    // with them, because the defect on `.fa-tab` is not that a WORD wrapped — every tab
    // label is a single unbreakable word. It is that the tab's ICON and its LABEL landed
    // on different lines: at 390px "Trophies" does not fit beside its trophy glyph, so
    // the glyph takes line 1, the word takes line 2, the control grows to 36.6px of ink
    // against 19.0px for its three neighbours, and the whole bar loses its baseline.
    // Detected as a VERTICAL DISJOINTNESS between the ink and each inline sibling box,
    // which is the observable a player sees, rather than as a line-box count.
    let contentWrapped = false;
    for (const ch of el.children) {
      const cs = getComputedStyle(ch);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      const q = ch.getBoundingClientRect();
      if (q.width < 2 || q.height < 2) continue;
      const overlap = Math.min(q.bottom, y1) - Math.max(q.top, y0);
      if (overlap < 0.25 * Math.min(q.height, y1 - y0)) { contentWrapped = true; break; }
    }
    // ── OVERLAP: WHICH element is on top, by geometry and stacking order ──────
    // 🚨 THE PIXEL CENSUS HAS A MEASURED ARTEFACT AND THIS DETECTOR EXISTS TO BOUND IT.
    // The isolated control frame hides every sibling, so the marked glyph antialiases
    // against a WHITE page in frame B and against the app's orange backdrop in frame A.
    // Edge pixels therefore classify differently in the two frames and `occFrac` picks
    // up a few points of pure instrument. Measured on the title card, where the census
    // reports the headline 4.8% occluded and THIS detector reports nothing over it at
    // all: that 4.8% is the artefact, not a defect. So `occFrac` is trustworthy in the
    // large and noise in the small, and the action threshold is set from this number
    // rather than guessed.
    //
    // This detector is exact: rect intersection against elements that (a) paint an
    // opaque fill, (b) are neither ancestor nor descendant, and (c) come later in the
    // painting order. It cannot see a translucent scrim — that is what the pixels are
    // for — but it never invents one, and it NAMES the occluder, which is what turns a
    // percentage into a fix.
    const overlaps = [];
    {
      // 🚨 THE FIRST VERSION TOOK THE MAX z-index UP EACH CHAIN AND WAS WRONG, kept here
      // with the reason. That conflates an element with its ancestors: on home it made
      // the top bar (`.fa-topbar`, z-index 1) and the 3D stage (`.home-stage`, z-index 0)
      // tie at whatever the screen root's z was, and the tie then broke on document
      // order — the stage comes later — so it reported the WebGL canvas as covering the
      // chips and every tab at 100%. Seven false positives on one screen, in a detector
      // added specifically to bound the pixel census's noise.
      //
      // Painting order is decided at the NEAREST COMMON ANCESTOR, between the two
      // children of it that each run descends from, so that is what is compared. Rank
      // follows CSS 2.1 appendix E closely enough for this UI: a positioned box with
      // `z-index: auto` paints at 0, ABOVE a non-positioned in-flow box — which is
      // exactly the relationship `home.ts` documents between `.home-stage` and the rows.
      const rank = (n) => {
        const st2 = getComputedStyle(n);
        const positioned = st2.position !== 'static';
        if (st2.zIndex === 'auto') return positioned ? 0 : -0.5;
        return parseInt(st2.zIndex, 10) || 0;
      };
      const paintsAbove = (lower, upper) => {
        const ca = []; for (let n = lower; n; n = n.parentElement) ca.unshift(n);
        const cb = []; for (let n = upper; n; n = n.parentElement) cb.unshift(n);
        let i = 0;
        while (i < ca.length && i < cb.length && ca[i] === cb[i]) i++;
        const a2 = ca[i], b2 = cb[i];
        if (!a2 || !b2) return false;
        const ra = rank(a2), rb = rank(b2);
        if (ra !== rb) return rb > ra;
        return (a2.compareDocumentPosition(b2) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      };
      for (const o of els) {
        if (o === el || o.contains(el) || el.contains(o)) continue;
        const os = getComputedStyle(o);
        if (os.visibility === 'hidden' || os.display === 'none' || parseFloat(os.opacity) < 0.85) continue;
        const bg = os.backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(bg);
        const alpha = m ? (m[1].split(',')[3] === undefined ? 1 : parseFloat(m[1].split(',')[3])) : 0;
        const opaqueFill = alpha >= 0.85 || /gradient/.test(os.backgroundImage);
        if (!opaqueFill) continue;
        const q = o.getBoundingClientRect();
        const ox = Math.min(q.right, cx1) - Math.max(q.left, cx0);
        const oy = Math.min(q.bottom, cy1) - Math.max(q.top, cy0);
        if (ox <= 0.5 || oy <= 0.5) continue;
        if (!paintsAbove(el, o)) continue;
        overlaps.push({
          by: (o.className && typeof o.className === 'string' ? o.className : o.tagName.toLowerCase()).slice(0, 44),
          frac: +((ox * oy) / ((cx1 - cx0) * (cy1 - cy0))).toFixed(3),
        });
      }
      overlaps.sort((p, q) => q.frac - p.frac);
    }
    // A stable path so the same run can be addressed across two captures.
    const path = (() => {
      const parts = [];
      let n = el;
      while (n && n !== document.body) {
        const p = n.parentElement;
        if (!p) break;
        const i = [...p.children].indexOf(n);
        parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${i + 1})`);
        n = p;
      }
      return `body > ${parts.join(' > ')}`;
    })();
    if (seen.has(path)) continue;
    seen.add(path);
    // CLIP: how much of the ink box falls outside the viewport.
    const ix = Math.max(0, Math.min(x1, vw) - Math.max(x0, 0));
    const iy = Math.max(0, Math.min(y1, vh) - Math.max(y0, 0));
    const boxA = (x1 - x0) * (y1 - y0);
    const clipFrac = boxA > 0 ? 1 - (Math.max(0, ix) * Math.max(0, iy)) / boxA : 0;
    // 🚨 IS THERE A SCROLLER BETWEEN THIS RUN AND THE VIEWPORT? The first version did
    // not ask, and reported 41 of 80 runs on the shop and 38 of 53 on settings as
    // CLIPPED 100% — every one of them simply BELOW THE FOLD of its own `overflow:auto`
    // panel, which is what a scroll region is FOR. That is ~120 false positives against
    // the one true one (the title card's headline, cut by the viewport with no scroller
    // to reach it), i.e. the detector as written was pure noise on three of six screens.
    // `menu_accept` check 1 already asserts the PAGE cannot scroll, so a run outside the
    // viewport with no scrollable ancestor is genuinely unreachable; one inside a
    // scroller is one swipe away.
    let scrollable = false;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const canY = /auto|scroll/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
      const canX = /auto|scroll/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1;
      if (canY || canX) { scrollable = true; break; }
    }
    out.push({
      path,
      text: own.slice(0, 46),
      cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
      rect: { x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0 },
      inkRect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      lineBoxes: tops.size,
      overlaps: overlaps.slice(0, 3),
      overlapFrac: overlaps.length ? overlaps[0].frac : 0,
      contentWrapped,
      lineHeight: parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.2,
      clipFrac,
      inScroller: scrollable,
      nowrap: st.whiteSpace === 'nowrap' || st.whiteSpace === 'pre',
    });
  }
  return out;
}

/** Paint one run magenta. Returns a token used to undo. */
function markFn(path) {
  const el = document.querySelector(path);
  if (!el) return false;
  el.setAttribute('data-mn-mark', '1');
  let s = document.getElementById('mn-mark-style');
  if (!s) { s = document.createElement('style'); s.id = 'mn-mark-style'; document.head.appendChild(s); }
  s.textContent = `[data-mn-mark] , [data-mn-mark] * {
      color: #FF00FF !important;
      -webkit-text-stroke-color: #FF00FF !important;
      text-shadow: none !important;
      -webkit-text-fill-color: #FF00FF !important;
      caret-color: #FF00FF !important;
    }`;
  return true;
}
function unmarkFn() {
  for (const e of document.querySelectorAll('[data-mn-mark]')) e.removeAttribute('data-mn-mark');
  const s = document.getElementById('mn-mark-style');
  if (s) s.textContent = '';
  const i = document.getElementById('mn-iso-style');
  if (i) i.textContent = '';
}
/** Hide everything that is not on the marked run's own chain. `visibility` does not
 *  affect layout, so both captures measure the SAME geometry. */
function isolateFn(path) {
  const el = document.querySelector(path);
  if (!el) return false;
  let i = document.getElementById('mn-iso-style');
  if (!i) { i = document.createElement('style'); i.id = 'mn-iso-style'; document.head.appendChild(i); }
  i.textContent = 'body * { visibility: hidden !important; } [data-mn-keep] { visibility: visible !important; }';
  for (const e of document.querySelectorAll('[data-mn-keep]')) e.removeAttribute('data-mn-keep');
  let n = el;
  while (n && n !== document.documentElement) { n.setAttribute('data-mn-keep', '1'); n = n.parentElement; }
  for (const d of el.querySelectorAll('*')) d.setAttribute('data-mn-keep', '1');
  return true;
}

/* ── node-side: count magenta inside a crop ───────────────────────────────── */
/**
 * 🚨 THE THRESHOLD USED TO BE `R>245 && G<10 && B>245` AND IT WAS A SILENT FALSE
 * NEGATIVE, kept here with the reason per this project's rule on reversed assertions.
 *
 * `.home-stage-hint.is-faded` carries `opacity: 0.88`. Compositing #FF00FF at 0.88 over
 * the lobby's navy gives R ~= 229, which fails `R>245` — so the ISOLATED control frame
 * counted ZERO magenta, `totalPx` came back 0, `occFrac` came back `null`, and the run
 * was dropped from the flagged list. "Tap to taunt" is one of the two runs the whole
 * tool was written to catch and the instrument reported nothing at all about it. An
 * exact-colour test silently excludes every element with `opacity < 1`, a translucent
 * scrim over it, or a blend mode — which is most of a game UI.
 *
 * The test is now RELATIVE (magenta-dominant rather than magenta-exact) and a per-page
 * BASE frame, captured once with nothing marked, is subtracted from the marked count so
 * the app's own purples and pinks cannot be counted as ink.
 */
function isMagenta(r, g, b) {
  return (r - g) > 40 && (b - g) > 40 && r > 55 && b > 55 && Math.abs(r - b) < Math.max(60, 0.45 * Math.max(r, b));
}
async function magentaPx(buf, rect, vp) {
  const pad = 3;
  const left = Math.max(0, Math.floor(rect.x - pad));
  const top = Math.max(0, Math.floor(rect.y - pad));
  const width = Math.min(vp.w - left, Math.ceil(rect.w + pad * 2));
  const height = Math.min(vp.h - top, Math.ceil(rect.h + pad * 2));
  if (width <= 0 || height <= 0) return 0;
  const { data, info } = await sharp(buf).extract({ left, top, width, height })
    .raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let n = 0;
  for (let i = 0; i < data.length; i += ch) {
    if (isMagenta(data[i], data[i + 1], data[i + 2])) n++;
  }
  return n;
}

async function openScreen(browser, vpTag, screen, base) {
  const vp = VIEWPORTS[vpTag];
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  // 🚨 THE TITLE CARD AUTO-ADVANCES AND TWO RUNS SILENTLY MEASURED `home` INSTEAD.
  // `opening.ts` arms `setTimeout(enter, holdMs())` on mount, and under SwiftShader
  // `settleScreen` can outlast the hold — so `?screen=opening` settles onto the LOBBY
  // and every number is measured on the wrong screen. `holdMs()` reads a `?hold=` query
  // param for exactly this, so the probe pins it instead of racing it. The route
  // assertion below stays regardless: a pin that stops working must go red, not quiet.
  const q = screen === 'opening' ? '&hold=900000' : '';
  await page.goto(`${base}/?screen=${screen}${q}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await settleScreen(page, { soft: true, timeout: 60_000, label: `${vpTag}/${screen}` });
  const got = await page.evaluate(() => window.__screen ?? null);
  return { ctx, page, vp, got };
}

async function auditPage(page, vp, opts = {}) {
  const cands = await page.evaluate(collectFn);
  const kept = cands.filter((c) => !EXEMPT.some((x) => c.cls.includes(x.replace('.', ''))));
  // 🚨 VACUITY. Every number below is computed over `kept`; an empty `kept` would make
  // every assertion downstream true by construction.
  if (kept.length === 0) throw new Error('mn_occlude: ZERO text runs collected — refusing to report a clean screen over an empty set');
  const rows = [];
  const limit = opts.limit ?? 80;
  // ONE base frame per page: whatever magenta-dominant pixels the app itself paints in a
  // run's crop are subtracted, so an Epic-purple badge behind a label cannot be counted
  // as that label's ink.
  const baseBuf = await page.screenshot({ timeout: 60_000 });
  for (const c of kept.slice(0, limit)) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await page.evaluate(markFn, c.path);
    if (!ok) continue;
    // eslint-disable-next-line no-await-in-loop
    const aBuf = await page.screenshot({ timeout: 60_000 });
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(isolateFn, c.path);
    // eslint-disable-next-line no-await-in-loop
    const bBuf = await page.screenshot({ timeout: 60_000 });
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(unmarkFn);
    // eslint-disable-next-line no-await-in-loop
    const base = await magentaPx(baseBuf, c.rect, vp);
    // eslint-disable-next-line no-await-in-loop
    const a = Math.max(0, (await magentaPx(aBuf, c.rect, vp)) - base);
    // eslint-disable-next-line no-await-in-loop
    const b = await magentaPx(bBuf, c.rect, vp);
    // Guard the DENOMINATOR rather than trusting it: a run whose control frame carries
    // almost no ink cannot support a ratio, and `occFrac` there is noise wearing a
    // percentage sign. Reported as `null` and never flagged.
    const occ = b >= 20 ? Math.max(0, 1 - a / b) : null;
    // WRAP: distinct text-node line boxes, plus the independent height check — a wrapped
    // run's ink box is taller than its own line-height. Both, because either alone has a
    // failure mode: quantised tops miss a 1px-offset second line, and the height test
    // misses a wrap into a box whose line-height was authored generously.
    const wrapped = c.lineBoxes > 1 || c.inkRect.h > c.lineHeight * 1.55 || c.contentWrapped;
    rows.push({ ...c, basePx: base, visPx: a, totalPx: b, occFrac: occ, wrapped });
  }
  return { rows, collected: cands.length, audited: rows.length };
}

/** A run is FLAGGED when it is occluded, unreachably clipped, or wrapped inside a
 *  control whose whole idiom is a single line. Every threshold here is above the
 *  measured self-pair floor (§D), which is 0.000 pp on a static run. */
/** The pixel census's measured artefact floor. `occFrac` on a run with NOTHING over it
 *  reads 0.2% where the isolated backdrop is close to the page's (a cream panel) and up
 *  to 4.8% where it is not (the title card's orange field) — see the OVERLAP docblock in
 *  `collectFn`. So anything under 6% is instrument, and `OVERLAP` is the exact detector
 *  that carries the small cases. Stated before acting, per `CLAUDE.md` rule 10. */
const OCC_FLOOR = 0.06;
/** Unmistakable: no antialiasing artefact reaches 40 points. */
const OCC_LOUD = 0.40;
/**
 * ⚠️ THE RULE IS A CONJUNCTION, AND THAT IS THE POINT.
 * The pixel census is trustworthy in the large and noisy in the small; the overlap
 * detector is exact but blind to anything translucent. Measured on the title card, whose
 * tagline reads 10.4-13.9% occluded with NOTHING over it — 13px type inside a 2px ink
 * stroke is nearly all edge, and every edge pixel antialiases against a different
 * backdrop in the isolated control frame. A 6% constant floor does NOT bound that, so
 * the mid-range requires BOTH detectors to agree. Only 40%+ stands alone.
 */
function flagsFor(r) {
  const f = [];
  const occ = r.occFrac ?? 0;
  if (occ > OCC_LOUD || (occ > OCC_FLOOR && r.overlapFrac > 0.02)) f.push(`OCCLUDED ${(occ * 100).toFixed(1)}%`);
  if (r.overlapFrac > 0.02) f.push(`OVERLAP ${(r.overlapFrac * 100).toFixed(0)}% by .${r.overlaps[0].by}`);
  if (r.clipFrac > 0.02 && !r.inScroller) f.push(`CLIPPED ${(r.clipFrac * 100).toFixed(1)}%`);
  if (r.wrapped && /\bfa-tab\b|\bfa-btn\b|\bfa-chip\b/.test(r.cls)) {
    f.push(r.contentWrapped
      ? 'WRAP icon and label on different lines'
      : `WRAP ${r.inkRect.h.toFixed(1)}px ink vs ${r.lineHeight.toFixed(1)}px line`);
  }
  return f;
}
function report(tag, screen, rows) {
  const bad = rows.filter((r) => flagsFor(r).length > 0);
  const dimmed = rows.filter((r) => (r.occFrac ?? 0) > 0.02 && (r.occFrac ?? 0) <= OCC_LOUD && r.overlapFrac <= 0.02).length;
  const scrolled = rows.filter((r) => r.clipFrac > 0.02 && r.inScroller).length;
  console.log(`\n── ${tag} · ${screen} · ${rows.length} text run(s) audited · ${bad.length} flagged`
    + (scrolled ? ` · ${scrolled} below the fold of a scroller (not a defect)` : '')
    + (dimmed ? ` · ${dimmed} occluded-but-uncorroborated (under ${(OCC_LOUD * 100).toFixed(0)}%, no overlap — instrument, not defect)` : ''));
  if (bad.length === 0) { console.log('   (clean)'); return bad; }
  for (const r of bad.sort((x, y) => ((y.occFrac ?? 0) + y.clipFrac) - ((x.occFrac ?? 0) + x.clipFrac))) {
    console.log(`   ${flagsFor(r).join(' · ').padEnd(40)} "${r.text}"  [${r.cls || r.path.slice(-40)}]`);
  }
  return bad;
}

/* ── selftest: a KNOWN-BAD, and a HOLD, and a non-empty assertion ─────────── */
async function selftest(browser, base) {
  console.log('\n═══ mn_occlude --selftest ═══');
  let fails = 0;
  const { ctx, page, vp, got } = await openScreen(browser, 'ph-portrait', 'settings', base);
  if (got !== 'settings') { console.log(`  ✗ ROUTE: asked settings, got ${got}`); fails++; }

  // Pick a run with a stable identity that is currently clear.
  const target = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.fa-panel-title')].find((e) => e.textContent.trim());
    if (!el) return null;
    const parts = []; let n = el;
    while (n && n !== document.body) {
      const p = n.parentElement; if (!p) break;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-child(${[...p.children].indexOf(n) + 1})`);
      n = p;
    }
    return { path: `body > ${parts.join(' > ')}`, text: el.textContent.trim() };
  });
  if (!target) { console.log('  ✗ SETUP: no .fa-panel-title on settings'); await ctx.close(); return 1; }

  const measureOne = async () => {
    const all = await page.evaluate(collectFn);
    const c = all.find((x) => x.path === target.path);
    if (!c) return null;
    await page.evaluate(markFn, c.path);
    const aBuf = await page.screenshot({ timeout: 60_000 });
    await page.evaluate(isolateFn, c.path);
    const bBuf = await page.screenshot({ timeout: 60_000 });
    await page.evaluate(unmarkFn);
    const a = await magentaPx(aBuf, c.rect, vp);
    const b = await magentaPx(bBuf, c.rect, vp);
    return { a, b, occ: b > 0 ? Math.max(0, 1 - a / b) : null };
  };

  // §A HOLDS — nothing planted, the run must read clear.
  const clear = await measureOne();
  if (!clear || clear.b < 20) { console.log(`  ✗ §A SETUP: control run has no ink (totalPx=${clear?.b})`); fails++; }
  else if (clear.occ > 0.05) { console.log(`  ✗ §A HOLDS: an unoccluded run read ${(clear.occ * 100).toFixed(1)}% occluded`); fails++; }
  else console.log(`  ✓ §A HOLDS   unoccluded run reads ${(clear.occ * 100).toFixed(1)}% (visPx ${clear.a} / totalPx ${clear.b})`);

  // §B MOVES — plant an OPAQUE occluder exactly over it. This is the bug the tool
  // guards against; if this does not go red the tool is not a guard.
  await page.evaluate((p) => {
    const el = document.querySelector(p);
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.id = 'mn-selftest-occluder';
    d.style.cssText = `position:fixed;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;background:#123456;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(d);
  }, target.path);
  const covered = await measureOne();
  if (!covered || covered.occ < 0.9) { console.log(`  ✗ §B MOVES: a fully covered run read only ${covered ? (covered.occ * 100).toFixed(1) : 'null'}% occluded`); fails++; }
  else console.log(`  ✓ §B MOVES   fully covered run reads ${(covered.occ * 100).toFixed(1)}% (visPx ${covered.a} / totalPx ${covered.b})`);

  // §B2 — and the occluder is POINTER-EVENTS:NONE, so `elementFromPoint` would have
  // said "clear". This is the arm that proves the tool is not the wrong instrument.
  const hitSaysClear = await page.evaluate((p) => {
    const el = document.querySelector(p);
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el || el.contains(top);
  }, target.path);
  if (!hitSaysClear) { console.log('  ✗ §B2: the pointer-events:none occluder DID intercept hit testing — arm is vacuous'); fails++; }
  else console.log('  ✓ §B2 ORDERS elementFromPoint calls the covered run CLEAR; the paint census does not');

  // §C HOLDS AGAIN — remove it, the number must come back.
  await page.evaluate(() => document.getElementById('mn-selftest-occluder')?.remove());
  const restored = await measureOne();
  if (!restored || restored.occ > 0.05) { console.log(`  ✗ §C HOLDS: after removing the occluder the run still reads ${restored ? (restored.occ * 100).toFixed(1) : 'null'}%`); fails++; }
  else console.log(`  ✓ §C HOLDS   occluder removed, run reads ${(restored.occ * 100).toFixed(1)}%`);

  // §D SELF-PAIR — same tree, same page, twice. Anything above this is noise.
  const again = await measureOne();
  const drift = Math.abs((again?.occ ?? 1) - (restored?.occ ?? 0));
  if (drift > 0.01) { console.log(`  ✗ §D SELF-PAIR: same run twice drifted ${(drift * 100).toFixed(2)} pp`); fails++; }
  else console.log(`  ✓ §D SELF-PAIR drift ${(drift * 100).toFixed(3)} pp — the resolution floor of occFrac`);

  // §E OPACITY — the regression that made this tool lie. An `opacity: 0.88` run used to
  // count ZERO magenta in the control frame, so `totalPx` was 0, `occFrac` was `null`,
  // and "Tap to taunt" — one of the two runs the tool exists to catch — was dropped
  // silently. A false NEGATIVE is worse than a false positive: nothing looks wrong.
  await page.evaluate((p) => { document.querySelector(p).style.opacity = '0.6'; }, target.path);
  const faded = await measureOne();
  if (!faded || faded.b < 20) { console.log(`  ✗ §E OPACITY: an opacity:0.6 run counted ${faded?.b} control px — the magenta test is exact-colour again`); fails++; }
  else if (faded.occ > 0.05) { console.log(`  ✗ §E OPACITY: an unoccluded opacity:0.6 run read ${(faded.occ * 100).toFixed(1)}% occluded`); fails++; }
  else console.log(`  ✓ §E OPACITY opacity:0.6 run measurable (totalPx ${faded.b}) and reads ${(faded.occ * 100).toFixed(1)}%`);
  await page.evaluate((p) => { document.querySelector(p).style.opacity = ''; }, target.path);

  // §F WRAP — MOVES then HOLDS. The first version of this detector ranged over the
  // element's whole contents, counted an inline <svg> icon as a second line box, and
  // called SEVEN unwrapped controls wrapped. So the arm plants a real wrap by squeezing
  // a tab, and then requires the unsqueezed bar to come back clean.
  const { ctx: hctx, page: hpage } = await openScreen(browser, 'ph-portrait', 'home', base);
  const wrapPage = hpage;
  // ⚠️ THE FIRST VERSION OF THIS ARM WAS VACUOUS AND PASSED THE TOOL ANYWAY. It squeezed
  // `.fa-tab` to `max-width: 18px` and required a wrap — but every tab label is a SINGLE
  // WORD ("Home"), and CSS does not break one without `word-break`. The ink height stayed
  // 19.0px, the arm went red, and the red was the arm's fault rather than the detector's.
  // `CLAUDE.md` rule 6: "a known-bad planted where the bug CANNOT express itself".
  // The bug that DOES express itself is the icon and the label landing on different
  // lines, so that is what the arm plants: a hard line break between them.
  const wrapEval = async () => wrapPage.evaluate(() => {
    const el = document.querySelector('.fa-tab');
    if (!el) return null;
    let rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      rects.push(...[...r.getClientRects()].filter((q) => q.width > 1 && q.height > 1));
    }
    if (!rects.length) return null;
    const y0 = Math.min(...rects.map((q) => q.top));
    const y1 = Math.max(...rects.map((q) => q.bottom));
    let contentWrapped = false;
    for (const ch of el.children) {
      const cs = getComputedStyle(ch);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      const q = ch.getBoundingClientRect();
      if (q.width < 2 || q.height < 2) continue;
      const ov = Math.min(q.bottom, y1) - Math.max(q.top, y0);
      if (ov < 0.25 * Math.min(q.height, y1 - y0)) { contentWrapped = true; break; }
    }
    const kids = [...el.children].filter((c) => c.getBoundingClientRect().height > 2).length;
    return { contentWrapped, inkTop: y0, inkBottom: y1, kids };
  });
  const wClean = await wrapEval();
  if (!wClean) { console.log('  ✗ §F SETUP: no .fa-tab on home'); fails++; }
  // 🚨 NON-EMPTY BEFORE ASSERTING. A tab with no inline child element has nothing for the
  // disjointness test to compare the ink against, so `contentWrapped` would be `false`
  // BY CONSTRUCTION and both §F arms would be measuring an empty loop.
  else if (wClean.kids === 0) { console.log('  ✗ §F VACUOUS: the tab has ZERO painted inline children — the wrap test compares the ink against nothing'); fails++; }
  else if (wClean.contentWrapped) { console.log(`  ✗ §F HOLDS: the FIRST tab reads wrapped with nothing done to it (ink ${wClean.inkTop.toFixed(1)}-${wClean.inkBottom.toFixed(1)})`); fails++; }
  else console.log(`  ✓ §F HOLDS   an unwrapped tab reads unwrapped (${wClean.kids} inline child(ren) share its ink band)`);
  await wrapPage.evaluate(() => {
    const el = document.querySelector('.fa-tab');
    el.insertBefore(document.createElement('br'), el.lastChild);
  });
  const wSqueezed = await wrapEval();
  if (!wSqueezed || !wSqueezed.contentWrapped) { console.log('  ✗ §F MOVES: a tab with its icon forced onto its own line did NOT read wrapped'); fails++; }
  else console.log(`  ✓ §F MOVES   icon forced onto its own line reads wrapped (ink ${wSqueezed.inkTop.toFixed(1)}-${wSqueezed.inkBottom.toFixed(1)})`);
  await wrapPage.evaluate(() => { const b = document.querySelector('.fa-tab br'); if (b) b.remove(); });
  const wBack = await wrapEval();
  if (!wBack || wBack.contentWrapped) { console.log('  ✗ §F HOLDS-AGAIN: after removing the break the tab still reads wrapped'); fails++; }
  else console.log('  ✓ §F HOLDS-AGAIN break removed, tab reads unwrapped');

  // §G CLIP — MOVES, HOLDS, and the SCROLLER arm. The first version reported ~120 runs
  // as CLIPPED 100% that were merely below the fold of their own `overflow:auto` panel.
  const clipEval = async (sel) => wrapPage.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const ix = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const iy = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const a = r.width * r.height;
    let scrollable = false;
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const st = getComputedStyle(n);
      if ((/auto|scroll/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1)
        || (/auto|scroll/.test(st.overflowX) && n.scrollWidth > n.clientWidth + 1)) { scrollable = true; break; }
    }
    return { clipFrac: a > 0 ? 1 - (ix * iy) / a : 0, inScroller: scrollable };
  }, sel);
  const cClean = await clipEval('.fa-tab');
  if (!cClean || cClean.clipFrac > 0.02) { console.log(`  ✗ §G HOLDS: an in-frame control reads ${(cClean ? cClean.clipFrac * 100 : NaN).toFixed(1)}% clipped`); fails++; }
  else console.log(`  ✓ §G HOLDS   in-frame control reads ${(cClean.clipFrac * 100).toFixed(1)}% clipped`);
  await wrapPage.evaluate(() => { const e = document.querySelector('.fa-tab'); e.style.position = 'fixed'; e.style.left = '-9999px'; e.style.top = '-9999px'; });
  const cGone = await clipEval('.fa-tab');
  if (!cGone || cGone.clipFrac < 0.98) { console.log(`  ✗ §G MOVES: a control moved off-viewport reads only ${(cGone ? cGone.clipFrac * 100 : NaN).toFixed(1)}% clipped`); fails++; }
  else console.log(`  ✓ §G MOVES   control moved off-viewport reads ${(cGone.clipFrac * 100).toFixed(1)}% clipped`);
  await wrapPage.evaluate(() => { const e = document.querySelector('.fa-tab'); e.style.position = ''; e.style.left = ''; e.style.top = ''; });
  await hctx.close();

  // §H SCROLLER — a run below the fold of a real scroller must be recognised as such,
  // or the detector goes back to being ~120 false positives on three screens.
  const { ctx: sctx, page: spage } = await openScreen(browser, 'ph-portrait', 'settings', base);
  const scrollerSeen = await spage.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll('body *')) {
      let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
      if (!own.trim()) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 2) continue;
      const off = r.top > innerHeight || r.bottom < 0;
      if (!off) continue;
      let scrollable = false;
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        const st = getComputedStyle(n);
        if ((/auto|scroll/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1)
          || (/auto|scroll/.test(st.overflowX) && n.scrollWidth > n.clientWidth + 1)) { scrollable = true; break; }
      }
      rows.push(scrollable);
    }
    return { total: rows.length, inScroller: rows.filter(Boolean).length };
  });
  await sctx.close();
  if (scrollerSeen.total === 0) { console.log('  ✗ §H SETUP: settings had NO off-viewport run — the arm is vacuous, it proves nothing'); fails++; }
  else if (scrollerSeen.inScroller < scrollerSeen.total * 0.9) {
    console.log(`  ✗ §H SCROLLER: only ${scrollerSeen.inScroller} of ${scrollerSeen.total} off-viewport runs were recognised as reachable by scrolling`); fails++;
  } else console.log(`  ✓ §H SCROLLER ${scrollerSeen.inScroller} of ${scrollerSeen.total} off-viewport runs on settings are inside a scroller — exempt, not defects`);

  // §J OVERLAP — MOVES, HOLDS, and the BELOW arm. The detector's first version reported
  // the WebGL canvas as covering seven runs it sits BEHIND, so "does it stay quiet about
  // something underneath" is the arm that actually matters here.
  const { ctx: octx, page: opage } = await openScreen(browser, 'ph-portrait', 'home', base);
  const ovlOf = async (sel) => opage.evaluate((s2) => {
    const all = window.__mnRows || [];
    return all.filter((r) => r.cls.includes(s2));
  }, sel);
  await opage.evaluate((fn) => { window.__mnRows = new Function(`return (${fn})()`)(); }, collectFn.toString());
  const tabRows = await ovlOf('fa-tab');
  const nameRows = await ovlOf('home-hero-name');
  if (tabRows.length === 0 || nameRows.length === 0) { console.log(`  ✗ §J SETUP: tabs=${tabRows.length} name=${nameRows.length} — nothing to assert over`); fails++; }
  else {
    const canvasOverTabs = tabRows.filter((r) => r.overlaps.some((o) => /home-stage/.test(o.by))).length;
    if (canvasOverTabs > 0) { console.log(`  ✗ §J BELOW: the 3D stage was reported ON TOP of ${canvasOverTabs} tab(s) it paints behind`); fails++; }
    else console.log(`  ✓ §J BELOW   the 3D stage is not reported over any of the ${tabRows.length} tabs it paints behind`);
    const nameCovered = nameRows[0].overlaps.some((o) => /fa-tabs|fa-topbar/.test(o.by));
    if (!nameCovered) { console.log('  ✗ §J MOVES: the hero name is 80% occluded in the pixels and OVERLAP names no occluder — the detector is blind to the one case it was added for'); fails++; }
    else console.log(`  ✓ §J MOVES   the hero name's occluder is named: .${nameRows[0].overlaps[0].by} at ${(nameRows[0].overlapFrac * 100).toFixed(0)}%`);
  }
  await octx.close();

  // §K SCROLLER-OVERLAP — a run scrolled out of its panel must report NO occluder. The
  // detector's second false-positive class: `.fa-scroll` clips it, but its RECT is still
  // in viewport coordinates, and on the shop that is exactly where the bottom bar sits.
  const { ctx: kctx, page: kpage } = await openScreen(browser, 'ph-portrait', 'shop', base);
  const kRows = await kpage.evaluate(collectFn);
  const below = kRows.filter((r) => r.inkRect.y > 300);
  // NON-EMPTY FIRST: if the shop happened to fit, every assertion below is vacuous.
  if (below.length === 0) { console.log('  ✗ §K VACUOUS: no run sits below y=300 on the shop — the arm proves nothing'); fails++; }
  else {
    const bogus = below.filter((r) => r.overlaps.some((o) => /fa-btn/.test(o.by)) && r.rect.h < 1.5);
    if (bogus.length > 0) { console.log(`  ✗ §K SCROLLER-OVERLAP: ${bogus.length} clipped-away run(s) still name a bottom-bar button as their occluder`); fails++; }
    else console.log(`  ✓ §K SCROLLER-OVERLAP ${below.length} run(s) below y=300 audited, none clipped-away run names a bottom-bar occluder`);
  }
  await kctx.close();

  // §I NON-EMPTY — the vacuity guard itself must fire.
  let vacuityFired = false;
  try {
    await page.evaluate(() => { document.body.innerHTML = '<div></div>'; });
    await auditPage(page, vp);
  } catch (e) { vacuityFired = /ZERO text runs/.test(String(e)); }
  if (!vacuityFired) { console.log('  ✗ §I VACUITY: an empty candidate set did NOT refuse'); fails++; }
  else console.log('  ✓ §I VACUITY empty candidate set refuses instead of reporting "clean"');

  await ctx.close();
  console.log(fails === 0 ? '\n  selftest PASS (16 arms over 4 detectors)' : `\n  selftest FAIL — ${fails} arm(s)`);
  return fails;
}

async function run() {
  const a = process.argv.slice(2);
  const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const BASE = (get('--url', process.env.PREVIEW_BASE) ?? '').replace(/\/$/, '');
  if (!BASE) { console.error('mn_occlude: need --url or PREVIEW_BASE'); return 2; }
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    if (a.includes('--selftest')) return (await selftest(browser, BASE)) === 0 ? 0 : 1;
    const screens = get('--screens', 'home,shop,opening').split(',').filter(Boolean);
    const vps = get('--vp', 'ph-portrait,ph-land').split(',').filter(Boolean);
    const out = [];
    let flagged = 0;
    for (const vpTag of vps) {
      if (!VIEWPORTS[vpTag]) { console.error(`mn_occlude: unknown viewport ${vpTag}`); return 2; }
      for (const s of screens) {
        const { ctx, page, vp, got } = await openScreen(browser, vpTag, s, BASE);
        if (got !== s && !(s === 'opening' && got === null)) console.log(`  ⚠ ROUTE MISMATCH ${vpTag}/${s}: got ${got}`);
        const { rows, collected, audited } = await auditPage(page, vp);
        const bad = report(`${vpTag} (${vp.w}x${vp.h})`, `${s}${got !== s ? ` [ACTUALLY ${got}]` : ''}`, rows);
        flagged += bad.length;
        out.push({ vp: vpTag, screen: s, got, collected, audited, rows });
        await ctx.close();
      }
    }
    const jsonPath = get('--json', '');
    if (jsonPath) await writeFile(jsonPath, JSON.stringify(out, null, 2));
    console.log(`\nmn_occlude: ${flagged} flagged run(s) across ${out.length} screen-viewport cell(s)`);
    return 0;
  } finally {
    await browser.close();
  }
}

const IS_MAIN = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (IS_MAIN) process.exit(await run());
export { collectFn, auditPage };
