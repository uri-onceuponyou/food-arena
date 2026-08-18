#!/usr/bin/env node
/**
 * PORTRAIT acceptance — the hole that hid three separate layout bugs at HEAD.
 *
 * ── Why this file exists, and why it is NOT part of menu_accept ─────────────
 * `tools/tmp/menu_accept.mjs` runs its whole battery across five viewports and every
 * one of them is LANDSCAPE (1600x900, 1280x800, 1024x768, 844x390, 2560x1080) — the
 * count lives in `docs/TOOLS.md`'s gate table and nowhere else. In one
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
 * ── Why it is opt-in rather than folded into the landscape battery ─────────
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
import { routeChecks, CONDITIONAL_SCREENS } from './mc_routes.mjs';

/**
 * How long a screen is allowed to take to paint. See the twin note in
 * `menu_accept.mjs`: this is the budget for the first paint (chiefly `#boot` coming
 * down after the 3D stage builds), NOT a margin on the 260 ms entry animation, which
 * `settleScreen` watches directly. Measured 23 ms .. 11.9 s across screens under a
 * contended SwiftShader; 60 s is a ceiling, not a wait.
 */
const SETTLE_MS = 60_000;

/**
 * Settle, and turn a failure into a RECORDED FAILURE rather than a crashed battery.
 * A guard that replaces 219 assertions with a stack trace is a guard someone deletes.
 * Records only on failure, so a healthy run's count is unchanged.
 */
async function settled(page, vpName, screen, label) {
  try {
    await settleScreen(page, { label, timeout: SETTLE_MS });
    return true;
  } catch (err) {
    record(vpName, screen, 'screen-painted', false,
      String(err.message ?? err).split('\n')[0].slice(0, 150));
    return false;
  }
}

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

/**
 * 44 px, for EVERY screen here including `admin` — and that is deliberate.
 *
 * `menu_accept.mjs` lowers the floor to 24 (WCAG 2.2 SC 2.5.8, the pointer bar) for
 * `admin` alone, because `src/admin/styles.ts` only raises its controls to 44 under
 * `@media (max-width: 760px)` and every landscape viewport there is ≥ 844 wide.
 * **Every viewport in THIS file is ≤ 430 wide, so all three meet that query** — which
 * means the touch floor is not waived for the tuning panel, it is asserted HERE, where a
 * thumb is what is holding it. Measured on a snapshot 2026-08-18: admin's eight controls
 * are 31–38 px tall at 1280×800 and exactly 44.0 px at 390×844.
 *
 * ⚠️ 44.0 against a 43.5 filter is **0.5 px of margin**, which is why this file waits on
 * `settleScreen` and not a clock: mid-`fa-screen-in` the same control measures 43.648.
 */
const MIN_TAP = 44;

/**
 * ⚠️ **THE SCREEN LIST WAS A HARDCODED SIX HERE TOO, AND IT WENT TWO BEHIND.**
 * `lobby` shipped in `2d4840e` and `admin` in `eb3e44d`; neither joined this file or
 * `menu_accept.mjs`, because **a screen does not join a gate by existing** — somebody
 * has to edit a list, and nothing tells them to. Two identical hand-written copies is
 * also the `a11dab7` shape (eleven copies of one module list, all drifting at once).
 *
 * It now comes off the router via `tools/tmp/mc_routes.mjs`, which both batteries share,
 * so the two can no longer disagree with each other or with `src/`.
 *
 * 🚨 **URI PLAYS PORTRAIT** — both phone captures are 384×848 (`DECISIONS §74`) — and
 * this file is **opt-in, not folded into `menu_accept`**, so it must be run explicitly.
 * A new screen therefore joins the landscape gate and this one at the same moment, which
 * is the only reason a portrait-only defect on a new screen gets seen at all.
 */
let SCREENS = [];

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
    let x = false; let y = false; let node = null;
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      const ps = getComputedStyle(p);
      const sx = ps.overflowX === 'auto' || ps.overflowX === 'scroll';
      const sy = ps.overflowY === 'auto' || ps.overflowY === 'scroll';
      if ((sx || sy) && !node) node = p;
      if (sx) x = true;
      if (sy) y = true;
    }
    return { x, y, node };
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

  // 🚨 **A SCROLL REGION IS COMPUTED OVERFLOW, NOT A CLASS NAME.** This line used to read
  // `controls.filter((el) => !el.closest('.fa-scroll'))` — the game screens' own scroller
  // class — while `tooWide` and `clipped` above already used `scrollAxes`. So the three
  // checks in this file disagreed about what a scroller is, and only this one was wrong.
  // `admin`'s tab bar is `.adm-tabs { overflow-x: auto }`, so at 360–430 px its 3rd–5th
  // tabs are SCROLLED AWAY — and the class test reported them as safe-area violations on
  // the ZERO-inset pass, where there is no inset to violate. Measured before the change:
  // 6 rows across the three viewports, every one a FALSE FAILURE.
  // ⚠️ PER AXIS: a horizontally scrolling tab bar excuses its children on x, never on y.
  const nested = controls.map((el) => scrollAxes(el).node).filter(Boolean);
  const scrollers = [...new Set([...frame.querySelectorAll('.fa-scroll'), ...nested])].filter(visible);
  const violates = (r, ax) =>
    (!ax.x && (r.left < safe.l - 1 || r.right > vw - safe.r + 1))
    || (!ax.y && (r.top < safe.t - 1 || r.bottom > vh - safe.b + 1));
  const outside = [
    ...controls.map((el) => ({ el, r: el.getBoundingClientRect(), ax: scrollAxes(el) })),
    // The scroller itself is measured on BOTH axes — it is what the layout must keep
    // inside the safe area, and nothing excuses it.
    ...scrollers.map((el) => ({ el, r: el.getBoundingClientRect(), ax: { x: false, y: false } })),
  ]
    .filter(({ r, ax }) => violates(r, ax))
    .map(({ el, r }) => `${cls(el)}[${el.textContent.trim().slice(0, 12)}] L${Math.round(r.left)} T${Math.round(r.top)} R${Math.round(vw - r.right)} B${Math.round(vh - r.bottom)}`);

  return {
    vw, vh,
    docScrollW: de.scrollWidth, docClientW: de.clientWidth,
    docScrollH: de.scrollHeight, docClientH: de.clientHeight,
    tooWide: tooWide.slice(0, 6),
    clipped: clipped.slice(0, 6),
    small, outside: outside.slice(0, 6),
    // 🚨 NON-EMPTY BEFORE THE ASSERTION (CLAUDE.md #6). `outside` is a FILTERED set and
    // the scroller exclusion just got wider, so a screen whose every control sits inside
    // some scroller would report `0 violations` having checked nothing — `[].every()` is
    // `true`. This is what the rule actually ran over, and the verdict requires it > 0.
    checked: controls.filter((el) => { const a = scrollAxes(el); return !a.x || !a.y; }).length
      + scrollers.length,
    controlCount: controls.length,
    // A layout fingerprint over every control's rect. Used only by SAFE_AREA_EXEMPT, to
    // prove the injected insets DID NOT MOVE an exempt screen. See the note there.
    sig: controls.reduce((h, el) => {
      const r = el.getBoundingClientRect();
      for (const v of [r.left, r.top, r.width, r.height]) {
        h = (Math.imul(h ^ Math.round(v), 0x01000193) >>> 0);
      }
      return h;
    }, 0x811c9dc5),
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

/**
 * ── POSITIVE **AND** NEGATIVE CONTROL FOR THE SAFE-AREA RULE ────────────────
 *
 * Twin of `menu_accept.mjs`'s. The scroller exclusion moved from the class `.fa-scroll`
 * to computed overflow, i.e. it got WIDER — and a widened exclusion is how an assertion
 * quietly stops asserting. So both directions are proved on the live screen through the
 * real `collectPortrait`: a plain in-flow control planted in the inset band must be
 * REPORTED, and the same control scrolled 4000 px inside an `overflow-x: auto` box must
 * NOT be (that is the false failure this change removed — 6 of them, on `admin`).
 * ⚠️ The HOLDS arm is x-only on purpose: a horizontal scroller excuses x, never y.
 */
async function safeAreaProbeFires(page, vp) {
  const SAFE_PROBE = { t: 60, r: 60, b: 60, l: 60 };
  const plant = (mode) => page.evaluate((m) => {
    document.querySelectorAll('.qa-safe-probe, .qa-safe-probe-child').forEach((n) => n.remove());
    const frame = document.querySelector('.fa-root');
    if (!frame) return;
    const btn = document.createElement('button');
    btn.textContent = 'probe';
    if (m === 'plain') {
      btn.className = 'qa-safe-probe';
      btn.style.cssText = 'position: absolute; left: 2px; top: 2px; width: 48px; height: 48px;';
      frame.appendChild(btn);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'qa-safe-probe';
      wrap.style.cssText = 'position: absolute; left: 90px; top: 100px; width: 110px;'
        + ' height: 60px; overflow-x: auto; overflow-y: hidden; white-space: nowrap;';
      btn.className = 'qa-safe-probe-child';
      btn.style.cssText = 'display: inline-block; margin-left: 4000px; width: 48px; height: 48px;';
      wrap.appendChild(btn);
      frame.appendChild(wrap);
    }
  }, mode);
  const named = (d, cls) => (d?.outside ?? []).some((s) => s.startsWith(cls));

  await plant('plain');
  await page.waitForTimeout(60);
  const seen = await page.evaluate(collectPortrait, { MIN_TAP, safe: SAFE_PROBE });
  record(vp.name, 'instrument', 'safe-area-rule-reports-a-planted-violation',
    named(seen, 'qa-safe-probe['),
    named(seen, 'qa-safe-probe[') ? 'planted a 48px button at 2,2 inside a 60px band — reported'
      : `PLANTED VIOLATION NOT SEEN — the rule is blind (${seen?.checked} checked)`);

  await plant('scrolled');
  await page.waitForTimeout(60);
  const hid = await page.evaluate(collectPortrait, { MIN_TAP, safe: SAFE_PROBE });
  record(vp.name, 'instrument', 'safe-area-rule-excuses-a-scrolled-away-child',
    !named(hid, 'qa-safe-probe-child'),
    named(hid, 'qa-safe-probe-child')
      ? 'a child scrolled 4000px inside an overflow-x:auto box was reported — the FALSE FAILURE is back'
      : 'scrolled-away child not reported; its scroller still is');

  await page.evaluate(() => document.querySelectorAll('.qa-safe-probe, .qa-safe-probe-child')
    .forEach((n) => n.remove()));
}

/**
 * ── THE ONE ROW `admin` IS EXEMPT FROM, EARNED AGAIN ON EVERY RUN ───────────
 *
 * The full reasoning, the measurement (5 false failures at 482/487 before it existed)
 * and the one-line remedy are in `menu_accept.mjs`'s twin note. Short version:
 * `src/admin/styles.ts` pads with raw `env(safe-area-inset-*)` rather than
 * `var(--fa-safe-*)`, and `env()` is 0 in headless Chromium and cannot be set by any
 * test — so injecting `--fa-safe-*` provably does not reach this screen and a violation
 * reported against it would be a FALSE FAILURE (`docs/LESSONS.md` §10).
 *
 * ⚠️ It is not a waiver: what is asserted in its place is the exemption's PRECONDITION —
 * every control's rect is hashed with the insets removed and again with them injected,
 * and the two must be IDENTICAL. Fix `styles.ts` and this row goes red asking to be
 * deleted. The zero-inset `inside-safe-area` row is untouched on every screen.
 */
const SAFE_AREA_EXEMPT = {
  admin: 'src/admin/styles.ts pads with raw env(safe-area-inset-*), not var(--fa-safe-*), '
    + 'and env() is 0 in headless Chromium — the injection cannot reach this screen',
};

async function auditPortraitScreen(page, vp, screen, safe, label, baseline = null) {
  const d = await page.evaluate(collectPortrait, { MIN_TAP, safe });
  if (!d) { record(vp.name, label, 'screen-mounted', false, 'no .fa-root'); return null; }

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

  const notchPass = safe.t + safe.r + safe.b + safe.l > 0;
  const exemptWhy = SAFE_AREA_EXEMPT[screen];
  if (exemptWhy && notchPass) {
    const unmoved = baseline !== null && d.sig === baseline;
    record(vp.name, label, 'safe-area-exemption-earned', unmoved,
      baseline === null ? 'no zero-inset baseline was captured — cannot earn the exemption'
        : unmoved
          ? `layout bit-identical with --fa-safe-* injected (sig ${d.sig}) — ${exemptWhy}`
          : `LAYOUT MOVED (sig ${baseline} -> ${d.sig}): "${screen}" now honours --fa-safe-*, `
            + `so the exemption is STALE — delete SAFE_AREA_EXEMPT['${screen}'] and let `
            + 'inside-safe-area assert it again');
  } else {
    record(vp.name, label, 'inside-safe-area', d.outside.length === 0 && d.checked > 0,
      d.checked === 0 ? 'VACUOUS: every element was excluded, so nothing was checked'
        : `${d.checked} elements checked${d.outside.length ? `; ${d.outside.slice(0, 3).join(' | ')}` : ''}`);
  }

  const min = MIN_CONTROLS[screen] ?? MIN_CONTROLS.default;
  record(vp.name, label, 'controls-present', d.controlCount >= min,
    `${d.controlCount} controls (min ${min})`);
  return d.sig;
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
      // NOT a 250ms sleep. `__previewReady` is set two rAFs after mount — measured at
      // 0-26 ms into `.fa-screen`'s 260 ms `fa-screen-in`, whose first keyframe is
      // `translateY(10px) scale(0.992)` — so the sleep expired between 10 ms BEFORE
      // and 16 ms after the animation ended. `getBoundingClientRect()` INCLUDES
      // transforms, so every rect this file asserts (44px tap targets, safe-area
      // edges, HUD collision boxes) was read at whichever side of that coin landed.
      // Measured in `settle_geom_ab.mjs`: 43.648 px against a 43.5 floor, screen top
      // up to 11.84 px against a +/-1 px tolerance, and one cell in nine reporting a
      // safe-area violation that does not exist. This file scored 219/219 both before
      // and after on THIS machine — the exposure was the margin, not a flipped
      // verdict here, and a margin is not something to keep betting on.
      // This waits for the page's own rendered state instead of a clock.
      // eslint-disable-next-line no-await-in-loop
      await settled(page, vp.name, screen, `${vp.name}/${screen}`);

      // 🚨 `bootRoute` does NOT error on an unknown `?screen=` — it returns the TITLE
      // CARD. So a route with no branch in `main.ts`'s ladder mounts `opening`, sets
      // `__previewReady`, and every rect below is measured on the wrong screen under the
      // right label. `admin` is additionally gated (`src/admin/gate.ts`), and this row is
      // what says "the build gated it off" instead of silently measuring the title card.
      // eslint-disable-next-line no-await-in-loop
      const landed = await page.evaluate(() => window.__screen ?? '(none)');
      record(vp.name, screen, 'screen-is-the-one-requested', landed === screen,
        landed === screen ? `?screen=${screen}` : `?screen=${screen} mounted "${landed}"`
          + (CONDITIONAL_SCREENS[screen] ? ` — gated on ${CONDITIONAL_SCREENS[screen]}` : ''));

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
        // eslint-disable-next-line no-await-in-loop
        await safeAreaProbeFires(page, vp);
      }
      // The zero-inset layout fingerprint. Only SAFE_AREA_EXEMPT screens use it, and it
      // is what makes their exemption a measurement instead of a waiver.
      // eslint-disable-next-line no-await-in-loop
      const zeroSig = await auditPortraitScreen(page, vp, screen, { t: 0, r: 0, b: 0, l: 0 }, screen);

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
      await auditPortraitScreen(page, vp, screen, SAFE, `${screen}+notch`, zeroSig);
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

  // Derived, not typed — see the note on SCREENS. Recorded under `--lint` because it is
  // the other static guard in this file and runs without a browser.
  const derived = await routeChecks();
  SCREENS = derived.screens;
  if (want('--lint')) {
    for (const r of derived.checks) record('static', 'routes', r.check, r.ok, r.detail);
    await lintNestedMedia();
  }

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
