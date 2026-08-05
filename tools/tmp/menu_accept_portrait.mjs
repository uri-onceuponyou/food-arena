#!/usr/bin/env node
/**
 * PORTRAIT acceptance — the hole that hid three separate layout bugs at HEAD.
 *
 * ── Why this file exists, and why it is NOT part of menu_accept ─────────────
 * `tools/tmp/menu_accept.mjs` runs 315 assertions across five viewports and every one
 * of them is LANDSCAPE (1600x900, 1280x800, 1024x768, 844x390, 2560x1080). In one
 * session three portrait defects were found at committed HEAD that it could not see:
 *
 *   * home laid out at 584 CSS px inside a 430 px viewport — a non-wrapping top bar
 *     set the grid track, and `.home-stage`'s default `min-width: auto` (the
 *     min-content of an aspect-ratio box IS height x ratio) beat `max-width: 100%`;
 *   * trophy road at 490 px inside 430 — same mechanism, `.fa-screen` declares rows
 *     but no columns;
 *   * character select had NO portrait layout at all — its portrait `@media` was
 *     nested inside a landscape one, which is valid CSS meaning
 *     "landscape AND portrait", i.e. never.
 *
 * ── THE MEASUREMENT RULE, and it is the whole point ────────────────────────
 * All three were INVISIBLE to a scroll check. `.fa-root` is `overflow: hidden`, so
 * `document.scrollWidth` reads a clean 430 while elements are laid out 70-154 px too
 * wide and are silently amputated at the frame edge. So:
 *
 *   **measure element rects against the viewport, never `document.scrollWidth`.**
 *
 * Every check below is on `getBoundingClientRect()`. `scrollWidth` is still read, but
 * only to PRINT how blind it is — a detail line reading "doc 430/430 (blind)" next to
 * a 584 px element is the evidence for why this file exists.
 *
 * ── Why it is opt-in rather than folded into the 315 ───────────────────────
 * Two peer agents are mid-flight on `characterSelect.ts` and on a brand-new `shop.ts`,
 * and both run `menu_accept` as their commit gate. Adding portrait failures on THEIR
 * in-progress screens to that gate would block them on work that is not theirs. This
 * runs deliberately, reports every screen pass or fail so the failures can be
 * dispatched to their owners, and is a one-line move into the main gate afterwards.
 *
 * Usage:
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/menu_accept_portrait.mjs
 *   PREVIEW_BASE=<url> node tools/tmp/menu_accept_portrait.mjs [--menus|--hud|--lint] [--quiet]
 */

import { chromium } from 'playwright';
import { readdir, readFile } from 'node:fs/promises';
import { settleScreen } from './settle.mjs';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/**
 * Portrait viewports. Three real phones rather than one, because the two mechanisms
 * that produced today's bugs scale differently: a min-content floor is absolute (a
 * 584 px box is 584 px on all three) while a centred-vs-right-anchored collision is a
 * function of width (see HUD_COLLISION_NOTE).
 */
const VIEWPORTS = [
  { name: 'phone-360x800', width: 360, height: 800 },   // narrowest common Android
  { name: 'phone-390x844', width: 390, height: 844 },   // iPhone 14/15/16
  { name: 'phone-430x932', width: 430, height: 932 },   // iPhone Pro Max
];

/** Simulated notch, PORTRAIT: status bar on top, home indicator at the bottom. */
const SAFE = { t: 47, r: 0, b: 34, l: 0 };

const MIN_TAP = 44;

const SCREENS = ['opening', 'home', 'characters', 'trophies', 'shop', 'settings'];

/** Per-screen control floor, same rule menu_accept uses (a title card has exactly 1). */
const MIN_CONTROLS = { opening: 1, default: 3 };

const results = [];
let failures = 0;

function record(vp, screen, check, ok, detail = '') {
  results.push({ vp, screen, check, ok, detail });
  if (!ok) failures++;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATIC — a nested @media is a screen with no portrait layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `@media A { @media B { ... } }` is perfectly valid CSS and means "A AND B". Nest a
 * portrait query inside a landscape one and every rule inside it is DEAD — it can
 * never match on any device. That is exactly what happened to character select's
 * portrait layout, and it is invisible to:
 *
 *   * `tsc` and `menu_accept`'s parser guard — the file is valid TypeScript, and
 *     `docs/LESSONS.md` §9 records this as the known limit of parsing the host
 *     language: the CSS lives in a string, so the TS parser has no opinion about it;
 *   * a landscape screenshot — the rules that ARE reachable still work;
 *   * `document.scrollWidth` — see the header.
 *
 * So it is linted here, on the CSS text itself. The lint FAILS only on a
 * PROVABLY-DEAD nest (contradictory orientation, or disjoint width/height ranges) and
 * merely REPORTS a benign one, because `docs/LESSONS.md` §9 also records that a lint
 * which cries wolf gets ignored — the first version of the backtick guard was widened
 * until it false-positived and stopped being read.
 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Every `@media` in a CSS string, with the media conditions it is nested inside. */
function scanMediaBlocks(css) {
  const found = [];
  const stack = [];
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('@media', i)) {
      const brace = css.indexOf('{', i);
      if (brace < 0) break;
      const cond = css.slice(i + 6, brace).trim().replace(/\s+/g, ' ');
      found.push({ cond, outer: stack.filter((f) => f.cond !== null).map((f) => f.cond) });
      stack.push({ cond });
      i = brace + 1;
      continue;
    }
    const c = css[i];
    if (c === '{') stack.push({ cond: null });
    else if (c === '}') stack.pop();
    i++;
  }
  return found;
}

/**
 * The three features that can make a nest unsatisfiable, parsed conservatively.
 * A comma list or a `not` returns null = "cannot reason about this one", which is
 * reported as benign rather than guessed at.
 */
function parseCond(cond) {
  if (cond.includes(',') || /\bnot\b/.test(cond)) return null;
  const num = (re) => {
    const m = re.exec(cond);
    return m ? parseFloat(m[1]) : null;
  };
  const or = /orientation\s*:\s*(portrait|landscape)/.exec(cond);
  return {
    orientation: or ? or[1] : null,
    minW: num(/min-width\s*:\s*([\d.]+)px/),
    maxW: num(/max-width\s*:\s*([\d.]+)px/),
    minH: num(/min-height\s*:\s*([\d.]+)px/),
    maxH: num(/max-height\s*:\s*([\d.]+)px/),
  };
}

/** Why this nest can never match, or null if it can. */
function deadReason(innerCond, outerCond) {
  const a = parseCond(outerCond);
  const b = parseCond(innerCond);
  if (!a || !b) return null;
  if (a.orientation && b.orientation && a.orientation !== b.orientation) {
    return `orientation ${b.orientation} inside orientation ${a.orientation}`;
  }
  if (b.minW !== null && a.maxW !== null && b.minW > a.maxW) {
    return `min-width ${b.minW} inside max-width ${a.maxW}`;
  }
  if (b.maxW !== null && a.minW !== null && b.maxW < a.minW) {
    return `max-width ${b.maxW} inside min-width ${a.minW}`;
  }
  if (b.minH !== null && a.maxH !== null && b.minH > a.maxH) {
    return `min-height ${b.minH} inside max-height ${a.maxH}`;
  }
  if (b.maxH !== null && a.minH !== null && b.maxH < a.minH) {
    return `max-height ${b.maxH} inside min-height ${a.minH}`;
  }
  return null;
}

/**
 * ── VALIDATE THE INSTRUMENT BEFORE BELIEVING IT (docs/LESSONS.md §13) ───────
 * At the time this landed the lint reported ZERO nests across all 107 modules, which
 * is indistinguishable from a lint that scans nothing — and "a guard that silently
 * matches nothing" is exactly how the backtick hole stayed open. So the scanner is
 * exercised on synthetic CSS carrying the defect it was written for (a portrait block
 * inside a landscape one, verbatim in shape from `characterSelect.ts`) plus the three
 * near-misses that must NOT fire, and every case is asserted before the real scan runs.
 */
const MEDIA_SELFTEST = [
  {
    name: 'portrait-inside-landscape-is-dead',
    css: '.a{color:red}\n@media (orientation: landscape) and (max-height: 460px) {\n'
      + '  .b { gap: 4px; }\n  @media (orientation: portrait) {\n    .c { display: grid; }\n  }\n}\n',
    dead: 1, benign: 0,
  },
  {
    name: 'disjoint-widths-are-dead',
    css: '@media (max-width: 700px) {\n  @media (min-width: 900px) { .x { top: 0 } }\n}',
    dead: 1, benign: 0,
  },
  {
    name: 'narrowing-nest-is-legal',
    css: '@media (max-width: 700px) {\n  @media (max-width: 400px) { .x { top: 0 } }\n}',
    dead: 0, benign: 1,
  },
  {
    name: 'orientation-inside-a-width-is-legal',
    css: '@media (max-width: 480px) {\n  @media (orientation: portrait) { .x { top: 0 } }\n}',
    dead: 0, benign: 1,
  },
  {
    name: 'siblings-are-not-nests',
    css: '@media (orientation: landscape) { .a { top: 0 } }\n@media (orientation: portrait) { .b { top: 0 } }',
    dead: 0, benign: 0,
  },
  {
    name: 'a-comment-cannot-hide-a-nest',
    // The parser's documented limit is the other direction (a comment after a `*/`
    // eating a rule); here a commented-out nest must NOT be reported as real.
    css: '@media (orientation: landscape) {\n  /* @media (orientation: portrait) { .x { top: 0 } } */\n  .y { top: 0 }\n}',
    dead: 0, benign: 0,
  },
  {
    name: 'braces-in-a-selector-block-do-not-shift-depth',
    css: '@media (orientation: landscape) {\n  .a { top: 0 }\n  .b { left: 0 }\n}\n'
      + '@media (orientation: portrait) { .c { top: 0 } }',
    dead: 0, benign: 0,
  },
];

function selftestMediaScanner() {
  const bad = [];
  for (const t of MEDIA_SELFTEST) {
    let dead = 0; let benign = 0;
    for (const m of scanMediaBlocks(stripCssComments(t.css))) {
      if (m.outer.length === 0) continue;
      if (m.outer.map((o) => deadReason(m.cond, o)).find(Boolean)) dead++; else benign++;
    }
    if (dead !== t.dead || benign !== t.benign) {
      bad.push(`${t.name}: got dead=${dead} benign=${benign}, want dead=${t.dead} benign=${t.benign}`);
    }
  }
  record('static', '-', 'media-lint-selftest', bad.length === 0,
    bad.length ? bad.join(' | ') : `${MEDIA_SELFTEST.length} synthetic cases, incl. the real defect shape`);
}

async function lintNestedMedia() {
  selftestMediaScanner();
  const { default: ts } = await import('typescript');
  const paths = [];
  const walk = async (dir) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      const p = `${dir}/${ent.name}`;
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith('.ts')) paths.push(p);
    }
  };
  await walk('src');

  const dead = [];
  const benign = [];
  let literals = 0;
  for (const p of paths) {
    const src = await readFile(p, 'utf8').catch(() => null);
    if (src === null) continue;
    const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    const visit = (node) => {
      let text = null;
      if (ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
      else if (ts.isTemplateExpression(node)) {
        // `${...}` holes are dropped, not kept: an interpolation can contain braces
        // that are not CSS braces, and the depth scan below counts braces.
        text = node.head.text + node.templateSpans.map((s) => s.literal.text).join(' ');
      }
      if (text !== null && text.includes('@media')) {
        literals++;
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        for (const m of scanMediaBlocks(stripCssComments(text))) {
          if (m.outer.length === 0) continue;
          const why = m.outer.map((o) => deadReason(m.cond, o)).find(Boolean);
          const where = `${p}:~${line} @media ${m.cond} inside @media ${m.outer.join(' / ')}`;
          if (why) dead.push(`${where}  [${why}]`);
          else benign.push(where);
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }

  // A guard that matched nothing is how the last hole stayed open — assert it looked.
  record('static', '-', 'media-lint-looked', literals >= 3 && paths.length >= 20,
    `${literals} CSS literals with @media across ${paths.length} modules`);
  record('static', '-', 'no-dead-nested-media', dead.length === 0,
    dead.length ? dead.slice(0, 4).join(' | ')
      : `0 unsatisfiable nests (${benign.length} benign nests seen)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE MENU SCREENS, IN PORTRAIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Everything measured off rects, in one page.evaluate.
 *
 * `insideScroller` is tracked PER AXIS. A horizontal track (the trophy road) is
 * legitimately wider than the frame on x and settings' body is legitimately taller on
 * y; counting either as a defect buries the real ones.
 */
function collectPortrait({ MIN_TAP, safe }) {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;
  const frame = document.querySelector('.fa-root');
  if (!frame) return null;

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const cls = (el) => (typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName);
  const scrollAxes = (el) => {
    let x = false; let y = false;
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === 'auto' || ps.overflowX === 'scroll') x = true;
      if (ps.overflowY === 'auto' || ps.overflowY === 'scroll') y = true;
    }
    return { x, y };
  };

  // ── The headline measurement: what is LAID OUT wider than the viewport ────
  // A generic walk rather than a selector list, because the three bugs this file
  // exists for were in three different elements and only one of them was a control.
  //
  // IN-FLOW ONLY, and that exclusion is measured rather than assumed. The first run of
  // this walk reported `.fa-rays` at 1,973 px inside 430 on all six screens — a 200vmax
  // decorative conic gradient that is DESIGNED to overflow and be clipped, i.e. a lint
  // crying wolf on every screen it looks at (docs/LESSONS.md §9). All three defects
  // this file exists for were in-flow boxes: `.home-stage` and the trophy road's top
  // bar are grid items of `.fa-screen`, and it is the grid TRACK they forced that made
  // every sibling row too wide. `.fa-screen` itself is `position: absolute; inset: 0`,
  // so its own rect is always exactly the frame and could never have shown either bug.
  // The positive control in `layoutProbeFires` proves the walk still fires after this.
  const tooWide = [];
  const walk = (el, depth) => {
    if (depth > 9) return;
    const r = el.getBoundingClientRect();
    const pos = getComputedStyle(el).position;
    const inFlow = pos === 'static' || pos === 'relative' || pos === 'sticky';
    if (inFlow && r.width > 0.5 && !scrollAxes(el).x) {
      const pr = el.parentElement ? el.parentElement.getBoundingClientRect() : r;
      const over = r.width - vw;
      if (over > 1) {
        tooWide.push({
          depth, cls: cls(el), w: Math.round(r.width), over: Math.round(over),
          parentW: Math.round(pr.width), scrollW: el.scrollWidth, clientW: el.clientWidth,
          left: Math.round(r.left), right: Math.round(r.right),
        });
      }
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(frame, 0);
  tooWide.sort((a, b) => b.over - a.over);

  // ── What actually leaves the frame ───────────────────────────────────────
  // `.fa-root` is overflow:hidden, so anything out here is drawn CUT, not scrolled.
  const CARES = '.fa-chip, .fa-iconbtn, .fa-btn, .fa-tab, .fa-panel, .fa-title, .fa-menuitem,'
    + ' .fa-level-track, .set-row, .set-foot, .tr-hero, .tr-bottom, .home-stage, .chars-card,'
    + ' .shop-card, button';
  const clipped = [];
  for (const el of frame.querySelectorAll(CARES)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const sc = scrollAxes(el);
    const outL = sc.x ? -1 : -r.left;
    const outR = sc.x ? -1 : r.right - vw;
    const outT = sc.y ? -1 : -r.top;
    const outB = sc.y ? -1 : r.bottom - vh;
    const lost = Math.max(outL, outR, outT, outB);
    if (lost > 1) {
      clipped.push({
        cls: cls(el), lost: Math.round(lost),
        axis: Math.max(outL, outR) > 1 ? 'x' : 'y',
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 16),
      });
    }
  }
  clipped.sort((a, b) => b.lost - a.lost);

  // ── Controls: tap floor and safe area, same definitions menu_accept uses ──
  const controls = [...frame.querySelectorAll(
    'button:not([disabled]), .fa-menuitem:not([disabled])',
  )].filter(visible);
  const small = controls
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5)
    .map(({ el, r }) => `${cls(el)}[${el.textContent.trim().slice(0, 12)}] ${Math.round(r.width)}x${Math.round(r.height)}`);

  const scrollers = [...frame.querySelectorAll('.fa-scroll')].filter(visible);
  const outside = [...controls.filter((el) => !el.closest('.fa-scroll')), ...scrollers]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.left < safe.l - 1 || r.top < safe.t - 1
      || r.right > vw - safe.r + 1 || r.bottom > vh - safe.b + 1)
    .map(({ el, r }) => `${cls(el)}[${el.textContent.trim().slice(0, 12)}] L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`);

  return {
    vw, vh,
    docScrollW: de.scrollWidth, docClientW: de.clientWidth,
    docScrollH: de.scrollHeight, docClientH: de.clientHeight,
    tooWide: tooWide.slice(0, 6),
    clipped: clipped.slice(0, 6),
    small, outside: outside.slice(0, 6),
    controlCount: controls.length,
  };
}

/**
 * ── POSITIVE CONTROL (docs/LESSONS.md §13) ─────────────────────────────────
 * The width walk skips out-of-flow boxes, and an over-eager exclusion would turn this
 * whole file into a green dashboard that cannot fail — the exact shape of "AI stalled:
 * 0.0%". So an in-flow div 120 px wider than the viewport is injected into the live
 * screen, the walk is asked whether it can see it, and the div is removed again.
 * A run where this does not FIND its own planted defect is a run that proves nothing.
 */
async function layoutProbeFires(page, vp) {
  await page.evaluate(() => {
    const frame = document.querySelector('.fa-root');
    if (!frame) return;
    const d = document.createElement('div');
    d.className = 'qa-portrait-positive-control';
    d.style.cssText = `position: static; width: ${document.documentElement.clientWidth + 120}px;`
      + ' height: 6px; opacity: 0; pointer-events: none;';
    frame.appendChild(d);
  });
  const d = await page.evaluate(collectPortrait, { MIN_TAP, safe: { t: 0, r: 0, b: 0, l: 0 } });
  const seen = (d?.tooWide ?? []).some((t) => t.cls === 'qa-portrait-positive-control');
  await page.evaluate(() => document.querySelector('.qa-portrait-positive-control')?.remove());
  record(vp.name, 'instrument', 'width-walk-finds-a-planted-defect', seen,
    seen ? 'planted +120px in-flow box, reported' : 'PLANTED DEFECT NOT SEEN — the walk is blind');
}

async function auditPortraitScreen(page, vp, screen, safe, label) {
  const d = await page.evaluate(collectPortrait, { MIN_TAP, safe });
  if (!d) { record(vp.name, label, 'screen-mounted', false, 'no .fa-root'); return; }

  // The blindness, printed. `document.scrollWidth` clean while an element is 154px
  // over IS the finding — it is why nothing caught any of this before.
  const blind = d.docScrollW <= d.docClientW + 1 ? 'doc-scroll CLEAN (blind)' : `doc-scroll ${d.docScrollW}/${d.docClientW}`;
  record(vp.name, label, 'layout-fits-viewport', d.tooWide.length === 0,
    d.tooWide.length
      ? `${blind}; ` + d.tooWide.map((t) => `.${t.cls} ${t.w}px in ${d.vw} (+${t.over}, parent ${t.parentW}, scrollW ${t.scrollW})`).slice(0, 3).join(' | ')
      : `${blind}; widest element within ${d.vw}px`);

  record(vp.name, label, 'nothing-clipped-by-frame', d.clipped.length === 0,
    d.clipped.map((c) => `.${c.cls}"${c.text}" -${c.lost}px[${c.axis}]`).slice(0, 3).join(' | '));

  record(vp.name, label, 'tap-targets>=44', d.small.length === 0, d.small.slice(0, 3).join(' | '));
  record(vp.name, label, 'inside-safe-area', d.outside.length === 0, d.outside.slice(0, 3).join(' | '));

  const min = MIN_CONTROLS[screen] ?? MIN_CONTROLS.default;
  record(vp.name, label, 'controls-present', d.controlCount >= min,
    `${d.controlCount} controls (min ${min})`);
}

async function auditMenus(browser) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    let controlDone = false;
    for (const screen of SCREENS) {
      const hold = screen === 'opening' ? '&hold=120000' : '';
      // eslint-disable-next-line no-await-in-loop
      await page.goto(`${BASE}/?screen=${screen}${hold}`, { waitUntil: 'networkidle', timeout: 45000 });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 45000 });
      // NOT a 250ms sleep. `__previewReady` is set two rAFs after mount, i.e. two frames
      // into `.fa-screen`'s 260ms `fa-screen-in`, whose first keyframe is
      // `translateY(10px) scale(0.992)`. `getBoundingClientRect()` INCLUDES transforms,
      // so every rect this file asserts — 44px tap targets, safe-area edges, the HUD
      // collision boxes — would be read 0.8% small and 10px low. This waits for the
      // page's own rendered state instead of a clock. See tools/tmp/settle.mjs.
      // eslint-disable-next-line no-await-in-loop
      await settleScreen(page, { label: vp.name + '/' + screen });

      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(() => {
        for (const k of ['t', 'r', 'b', 'l']) document.documentElement.style.removeProperty(`--fa-safe-${k}`);
      });
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(80);
      if (!controlDone) {
        controlDone = true;
        // eslint-disable-next-line no-await-in-loop
        await layoutProbeFires(page, vp);
      }
      // eslint-disable-next-line no-await-in-loop
      await auditPortraitScreen(page, vp, screen, { t: 0, r: 0, b: 0, l: 0 }, screen);

      // eslint-disable-next-line no-await-in-loop
      await page.evaluate((s) => {
        const st = document.documentElement.style;
        st.setProperty('--fa-safe-t', `${s.t}px`);
        st.setProperty('--fa-safe-r', `${s.r}px`);
        st.setProperty('--fa-safe-b', `${s.b}px`);
        st.setProperty('--fa-safe-l', `${s.l}px`);
      }, SAFE);
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(160);
      // eslint-disable-next-line no-await-in-loop
      await auditPortraitScreen(page, vp, screen, SAFE, `${screen}+notch`);
    }

    record(vp.name, '-', 'no-console-errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE HUD, IN PORTRAIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ── HUD_COLLISION_NOTE — the arithmetic the fix is derived from ─────────────
 * The weapon tray is bottom-CENTRE and the radar is bottom-RIGHT, so they collide
 * whenever the viewport is too narrow to hold both:
 *
 *   tray right edge   = W/2 + (4*46 + 3*10)/2  = W/2 + 107   (slots are 46px <=720px)
 *   radar left edge   = W - safeR - 16 - 105                  (card is 105px <=720px)
 *   collide when        W/2 + 107 > W - 121 - safeR   i.e.  W < 456 + 2*safeR
 *
 * At 390 that is 33 px of overlap, and the card is 90 px tall against a 46 px tray at
 * the same bottom edge, giving 48 px of vertical overlap — slot 4 sits BEHIND the
 * radar. Measured at HEAD, and reproduced by this check before the fix.
 *
 * Both DOM states are exercised, because the two are laid out by different rules:
 *   * `html.fa-touch-capable` — a real phone. The radar moves to the top-right.
 *   * plain — a desktop browser at a portrait window, and every headless probe in
 *     `tools/`, including the shot this bug was reported from.
 */
const HUD_LANDMARKS = [
  '.hud-fighter--player', '.hud-fighter--enemy', '.hud-clock',
  '.hud-weapons', '.hud-radar', '.match-chip',
];

function collectHud(landmarks) {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;
  const boxes = [];
  for (const sel of landmarks) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    boxes.push({ sel, x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom });
  }
  const pairs = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]; const b = boxes[j];
      const ox = Math.min(a.r, b.r) - Math.max(a.x, b.x);
      const oy = Math.min(a.b, b.b) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) {
        pairs.push({ a: a.sel, b: b.sel, ox: Math.round(ox), oy: Math.round(oy) });
      }
    }
  }
  const outside = boxes
    .filter((z) => z.x < -1 || z.y < -1 || z.r > vw + 1 || z.b > vh + 1)
    .map((z) => `${z.sel} L${Math.round(z.x)} T${Math.round(z.y)} R${Math.round(vw - z.r)} B${Math.round(vh - z.b)}`);
  const slots = [...document.querySelectorAll('.hud-weapon-slot')].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), r: Math.round(r.right) };
  });
  return { vw, vh, boxes: boxes.map((z) => `${z.sel} ${Math.round(z.x)},${Math.round(z.y)} ${Math.round(z.w)}x${Math.round(z.h)}`), pairs, outside, slots };
}

async function auditHud(browser) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    let booted = false;
    try {
      await page.goto(`${BASE}/?screen=match&player=hamburger&enemy=donut&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(600);
      booted = true;
    } catch (err) {
      record(vp.name, 'match', 'match-boots', false, String(err).split('\n')[0]);
    }
    if (!booted) { await page.close(); continue; }
    record(vp.name, 'match', 'match-boots', true, '');

    for (const mode of ['pointer', 'touch']) {
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate((m) => {
        document.documentElement.classList.toggle('fa-touch-capable', m === 'touch');
        document.documentElement.classList.toggle('fa-touch', m === 'touch');
      }, mode);
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(150);
      // eslint-disable-next-line no-await-in-loop
      const d = await page.evaluate(collectHud, HUD_LANDMARKS);
      const label = `match:${mode}`;

      const tray = d.pairs.find((p) => (p.a === '.hud-weapons' && p.b === '.hud-radar')
        || (p.a === '.hud-radar' && p.b === '.hud-weapons'));
      record(vp.name, label, 'tray-radar-overlap-0', !tray,
        tray ? `${tray.ox}x${tray.oy} px` : `0 px (${d.slots.length} slots, tray ${d.slots.length ? `${d.slots[0].x}..${d.slots[d.slots.length - 1].r}` : '?'})`);

      const others = d.pairs.filter((p) => p !== tray);
      record(vp.name, label, 'hud-cards-do-not-overlap', others.length === 0,
        others.map((p) => `${p.a} x ${p.b} = ${p.ox}x${p.oy}`).slice(0, 3).join(' | '));

      record(vp.name, label, 'hud-inside-viewport', d.outside.length === 0,
        d.outside.slice(0, 3).join(' | '));
    }

    // Same two, with a portrait notch injected: the radar and the tray are both
    // anchored off `--fa-safe-*`, so the inset is exactly what can push them together.
    await page.evaluate((s) => {
      const st = document.documentElement.style;
      st.setProperty('--fa-safe-t', `${s.t}px`);
      st.setProperty('--fa-safe-r', `${s.r}px`);
      st.setProperty('--fa-safe-b', `${s.b}px`);
      st.setProperty('--fa-safe-l', `${s.l}px`);
      document.documentElement.classList.remove('fa-touch-capable', 'fa-touch');
    }, SAFE);
    await page.waitForTimeout(160);
    const dn = await page.evaluate(collectHud, HUD_LANDMARKS);
    const trayN = dn.pairs.find((p) => (p.a === '.hud-weapons' && p.b === '.hud-radar')
      || (p.a === '.hud-radar' && p.b === '.hud-weapons'));
    record(vp.name, 'match+notch', 'tray-radar-overlap-0', !trayN,
      trayN ? `${trayN.ox}x${trayN.oy} px` : '0 px');
    record(vp.name, 'match+notch', 'hud-cards-do-not-overlap',
      dn.pairs.filter((p) => p !== trayN).length === 0,
      dn.pairs.filter((p) => p !== trayN).map((p) => `${p.a} x ${p.b} = ${p.ox}x${p.oy}`).slice(0, 3).join(' | '));

    record(vp.name, 'match', 'no-console-errors', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  const only = process.argv.filter((a) => ['--menus', '--hud', '--lint'].includes(a));
  const want = (k) => only.length === 0 || only.includes(k);

  if (want('--lint')) await lintNestedMedia();

  if (want('--menus') || want('--hud')) {
    const browser = await chromium.launch({ args: LAUNCH_ARGS });
    if (want('--menus')) await auditMenus(browser);
    if (want('--hud')) await auditHud(browser);
    await browser.close();
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('');
  for (const r of results) {
    if (r.ok && process.argv.includes('--quiet')) continue;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${pad(r.vp, 15)} ${pad(r.screen, 18)} ${pad(r.check, 24)} ${r.detail}`);
  }

  // Per-screen roll-up, because the point of this file is to hand each failure to the
  // agent that owns that screen.
  const byScreen = new Map();
  for (const r of results) {
    const k = r.screen.split('+')[0].split(':')[0];
    const e = byScreen.get(k) ?? { pass: 0, fail: 0, checks: new Set() };
    if (r.ok) e.pass++; else { e.fail++; e.checks.add(r.check); }
    byScreen.set(k, e);
  }
  console.log('\n── portrait state, per screen ──');
  for (const [k, v] of byScreen) {
    console.log(`  ${pad(k, 14)} ${v.fail === 0 ? 'PASS' : `FAIL x${v.fail}`}  ${pad(`${v.pass}/${v.pass + v.fail}`, 8)} ${[...v.checks].join(', ')}`);
  }

  console.log(`\n${results.length - failures}/${results.length} portrait checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
