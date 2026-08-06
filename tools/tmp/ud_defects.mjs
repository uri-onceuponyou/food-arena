#!/usr/bin/env node
/**
 * The four HARD menu defects, measured in DEVICE PIXELS. No critic, no taste.
 *
 * Every row this prints is a fact about a rendered box, and every one of the four was
 * found by a per-element audit (6ebb6d1) that a whole-screen critic had missed for
 * five rounds — because a whole-screen critic averages, and a 14px ellipsis on one of
 * forty elements averages to nothing. `docs/LESSONS.md` §7 is the same shape: the
 * elements each scored 5-7 while the whole scored 4.2.
 *
 *   D1  the hero nameplate OVERLAPS the nav tab bar
 *   D2  eight text runs TRUNCATE with a visible ellipsis
 *   D3  the abilities list is CLIPPED MID-DESCENDER by its own panel
 *   D4  on a landscape phone the home kit is `display:none` — no ability affordance
 *
 * ── WHY THE VIEWPORT LIST IS WHAT IT IS ────────────────────────────────────────
 * `menu_accept`'s five viewports include ONE phone, 844x390, and none of these four
 * defects is worst there. The audit that found them used 852x393 and 852x480 — an
 * iPhone 14/15 landscape and a mid-size Android landscape — and 852x480 is where D2
 * goes from "one row" to "every chest row title AND sub, plus all three ability
 * names". A suite whose viewport list is one phone wide cannot see a defect that only
 * bites on a slightly taller phone, which is `docs/LESSONS.md` §"a defect can be 100%
 * reproducible and still invisible to a suite that never asks".
 *
 * ── WHY EACH MEASUREMENT IS THE ONE IT IS ──────────────────────────────────────
 * D1 is `nameplate.top` against `tabs.bottom`, NOT "does the clamp look right". The
 *    clamp `top: clamp(40px, 12vh, 56px)` resolves to 47.2px at 393px tall while the
 *    tab bar's bottom edge is at y=62, so the guard that exists is 15px SHORT. A rule
 *    that was tuned on one viewport and asserted on none is not a guard.
 *
 * D2 is `scrollWidth > clientWidth` on the nowrap+ellipsis runs, plus the RENDERED
 *    text recovered by binary-searching the widest prefix that fits — so the report
 *    says "2 rewards re..." and not merely "overflow 31px". An ellipsis is a thing a
 *    player SEES; the number has to name what they see.
 *    ⚠️ After the fix the elements WRAP, so `scrollWidth > clientWidth` is no longer
 *    the whole test: a wrapped run can still be clipped VERTICALLY by a fixed-height
 *    ancestor. Both axes are checked, and the vertical one is checked against the
 *    nearest clipping ancestor rather than against the element's own box, because an
 *    element with `overflow:visible` reports no overflow while being cut by its
 *    parent. That is exactly D3.
 *
 * D3 is per-ROW: the bottom of each `.chars-ability` against the client bottom of its
 *    scroll container. "The panel scrolls" is not a defence — a row cut through its
 *    descenders with no scrollbar thumb in view reads as a rendering bug, and the
 *    audit's capture showed exactly that. Reported as `cutPx`, the number of device
 *    pixels of the row that lie below the container's client box.
 *
 * D4 is the computed `display` of `.home-kit` plus the count of ability affordances
 *    reachable on the home screen at that viewport. Zero is a design decision and it
 *    is stated as one.
 *
 *   node tools/tmp/ud_defects.mjs --url <base> [--shots <dir>] [--json <path>]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { settleScreen, captureSettled } from './settle.mjs';

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = arg('--url', process.env.PREVIEW_BASE || 'http://localhost:5173');
const SHOTS = arg('--shots', null);
const JSON_OUT = arg('--json', null);
const ONLY = arg('--only', null);          // home|chars, for a fast re-check of one side

// 852x393 and 852x480 are THE AUDIT'S viewports and are first deliberately: they are
// where all four bite. 844x390 is menu_accept's only phone and is kept so a fix can be
// shown not to have moved the one phone the existing suite does watch. The three
// large ones are the drift control — a fix that repairs a phone and breaks a desktop
// has not repaired anything.
const VIEWPORTS = [
  { name: 'phone-852x393', width: 852, height: 393, audit: true },
  { name: 'phone-852x480', width: 852, height: 480, audit: true },
  { name: 'phone-844x390', width: 844, height: 390, audit: true },
  // ⚠️ THE NOTCH IS A DIFFERENT VIEWPORT, and leaving it out cost a gate failure.
  // `menu_accept` runs every screen twice, once with `--fa-safe-*` set to a landscape
  // iPhone's real insets (44 left, 44 right, 21 bottom), and 88px off the width is a
  // third of a 173px flank. This tool measured six clean viewports and shipped a kit
  // whose tiles were 34x44 on the one phone Apple actually sells — caught by
  // `menu_accept`'s tap-target assertion, not by anything here. A viewport list that
  // omits the insets is measuring a device nobody has.
  { name: 'phone-844x390+notch', width: 844, height: 390, audit: true, safe: { t: 0, r: 44, b: 21, l: 44 } },
  { name: 'phone-852x393+notch', width: 852, height: 393, audit: true, safe: { t: 0, r: 44, b: 21, l: 44 } },
  { name: 'tablet-1024x768', width: 1024, height: 768, audit: false },
  { name: 'laptop-1280x800', width: 1280, height: 800, audit: false },
  { name: 'desktop-1600x900', width: 1600, height: 900, audit: false },
];

// A POPULATED profile. An empty save hides three of the four defects outright: the
// held-chest row is `hidden`, "2 rewards ready" never renders, and the trophy-road
// sub line reads "Play a match" — the SHORTEST string it can ever hold. Measuring the
// shortest possible string and reporting "no overflow" is the known-bad-input failure
// this project has caught nineteen instruments doing.
const SEED = {
  name: 'QA', wins: 9, losses: 3, xp: 400, selected: 'hamburger',
  economy: {
    trophies: 200, bestTrophies: 240, coins: 1000, gems: 40,
    containers: { chest: 2, hamburgerBox: 1, pineappleBox: 0, redBox: 0, fireBox: 0 },
    claimed: [], unlocked: ['hamburger', 'pineapple', 'donut'], winsTowardChest: 1,
    lastMatch: null, seed: 987654, rolls: 0,
  },
};

/**
 * IN-PAGE. Everything below runs in the browser; nothing here may close over Node
 * scope. Kept as one string-free function so it is type-checkable by eye.
 */
function probeFn() {
  const R = (n) => Math.round(n * 100) / 100;
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: R(r.x), y: R(r.y), w: R(r.width), h: R(r.height), top: R(r.top), bottom: R(r.bottom), left: R(r.left), right: R(r.right) }; };

  /** The nearest ancestor that would CLIP this element, and its client box. */
  const clipper = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.overflowY !== 'visible' || s.overflowX !== 'visible') {
        const r = n.getBoundingClientRect();
        const bt = parseFloat(s.borderTopWidth) || 0;
        const bl = parseFloat(s.borderLeftWidth) || 0;
        return {
          sel: n.className || n.tagName,
          overflowY: s.overflowY,
          // CLIENT box, not border box: the border and the scrollbar gutter are not
          // paintable area, and a row that ends "inside the border" is still cut.
          top: R(r.top + bt),
          bottom: R(r.top + bt + n.clientHeight),
          left: R(r.left + bl),
          right: R(r.left + bl + n.clientWidth),
          scrollTop: R(n.scrollTop),
          scrollH: n.scrollHeight,
          clientH: n.clientHeight,
        };
      }
    }
    return null;
  };

  /**
   * What the player actually READS when a nowrap+ellipsis run is too long.
   *
   * Rendered text cannot be read back from the DOM — `textContent` is always the full
   * string. So: measure the run's own text width with a Range (which respects the
   * real font and letter-spacing), then binary-search the longest prefix that fits
   * inside `clientWidth` minus an ellipsis. That is what is on screen, to within one
   * character.
   */
  const truncatedAs = (el) => {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return null;
    const full = node.textContent;
    const range = document.createRange();
    const widthOf = (n) => { range.setStart(node, 0); range.setEnd(node, n); return range.getBoundingClientRect().width; };
    const avail = el.clientWidth;
    if (widthOf(full.length) <= avail + 0.5) return null;
    // The ellipsis glyph costs room too. Measure it rather than guessing: at 11px
    // Rubik it is ~7px, at 16px ~10px, and guessing 3 chars is wrong at both.
    const probe = document.createElement('span');
    probe.textContent = '…';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    probe.style.font = getComputedStyle(el).font;
    document.body.appendChild(probe);
    const ellW = probe.getBoundingClientRect().width;
    probe.remove();
    let lo = 0; let hi = full.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (widthOf(mid) + ellW <= avail) lo = mid; else hi = mid - 1;
    }
    return { full, shown: full.slice(0, lo) + '…', lostChars: full.length - lo };
  };

  const textRuns = (selectors) => {
    const out = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (el.offsetParent === null && cs.position !== 'fixed') continue;
        const txt = (el.textContent || '').trim();
        if (!txt) continue;
        const clip = clipper(el);
        const r = rect(el);
        // VERTICAL cut by the nearest clipping ancestor. An element with
        // overflow:visible reports scrollHeight === clientHeight while being sliced
        // by its parent, which is precisely how D3 stayed invisible.
        const cutPx = clip ? R(Math.max(0, r.bottom - clip.bottom)) : 0;
        out.push({
          sel,
          text: txt,
          rect: r,
          overflowX: R(el.scrollWidth - el.clientWidth),
          overflowY: R(el.scrollHeight - el.clientHeight),
          whiteSpace: cs.whiteSpace,
          textOverflow: cs.textOverflow,
          fontPx: R(parseFloat(cs.fontSize)),
          lineH: cs.lineHeight,
          cutPx,
          clipSel: clip ? clip.sel : null,
          clipScrollable: clip ? clip.scrollH - clip.clientH : 0,
          ellipsised: truncatedAs(el),
        });
      }
    }
    return out;
  };

  const one = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { sel, display: cs.display, rect: rect(el), topCss: cs.top, present: cs.display !== 'none' };
  };

  const screen = window.__screen;

  if (screen === 'home') {
    const plate = document.querySelector('.home-nameplate');
    const tabs = document.querySelector('.fa-tabs');
    const bar = document.querySelector('.fa-topbar');
    const name = document.querySelector('.home-hero-name');
    const kit = document.querySelector('.home-kit');
    const kitCs = kit ? getComputedStyle(kit) : null;
    const tiles = [...document.querySelectorAll('.home-kit-tile')].filter((t) => t.offsetParent !== null);

    // D1. The overlap is a RECTANGLE INTERSECTION, not a top-edge comparison: the
    // nameplate is centred and full-width while the tab bar is a centred pill, so two
    // boxes can share a y-range and never touch. Both axes, or the number lies.
    let overlapPx = 0; let overlapBox = null;
    if (plate && tabs) {
      const a = rect(plate); const b = rect(tabs);
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 0 && oy > 0) { overlapPx = R(oy); overlapBox = { ox: R(ox), oy: R(oy) }; }
    }
    // The INK overlap matters more than the box overlap: `.fa-title` paints a 4px
    // text-shadow BELOW its line box, so the glyph's visual bottom is lower than the
    // rect's. Measured against the NAME's own box, which is what a player sees.
    let inkGap = null;
    if (name && tabs) inkGap = R(rect(name).top - rect(tabs).bottom);

    return {
      screen,
      d1: {
        nameplate: plate ? rect(plate) : null,
        nameplateTopCss: plate ? getComputedStyle(plate).top : null,
        heroName: name ? rect(name) : null,
        heroNameText: name ? (name.textContent || '').trim() : null,
        tabs: tabs ? rect(tabs) : null,
        topbar: bar ? rect(bar) : null,
        overlapPx,
        overlapBox,
        inkGap,
      },
      d2: textRuns(['.home-track-title', '.home-track-sub', '.home-kit-name', '.home-kit-cap', '.home-mode-name', '.home-mode-sub', '.fa-panel-title', '.home-rec-key']),
      // HOW MUCH ROOM IS THERE? Every candidate fix for D2 and D4 spends vertical
      // space in a flank, and `.home-col` is `overflow: hidden` — it CLIPS rather than
      // scrolls. So a wrap-instead-of-ellipsis fix that does not fit turns a
      // horizontal truncation into a vertical one, which is strictly worse (a cut row
      // gives no signal that anything is missing, an ellipsis at least does). This is
      // the budget, measured, before any of it is spent.
      room: (() => {
        const mid = document.querySelector('.home-middle');
        const cols = [...document.querySelectorAll('.home-col')];
        return {
          middleH: mid ? R(mid.getBoundingClientRect().height) : null,
          cols: cols.map((c) => {
            const cr = c.getBoundingClientRect();
            const bt = parseFloat(getComputedStyle(c).borderTopWidth) || 0;
            const pb = parseFloat(getComputedStyle(c).paddingBottom) || 0;
            const clientBottom = cr.top + bt + c.clientHeight;
            // ⚠️ TWO measurements of the same thing, on purpose.
            //
            // `scrollHeight - clientHeight` is the obvious one and it is a SIGNAL: it
            // asks the engine a question about a box. The per-child one asks about the
            // OUTCOME — is any real element of this panel drawn below the line the
            // panel stops painting at — which is the thing a player experiences, and
            // `docs/LESSONS.md` §13 is explicit about preferring the outcome question.
            // They are checked against each other by `--selftest`; when they disagree
            // the child measurement wins, because a clipped control is a fact and
            // `scrollHeight` on a flex container with `overflow:hidden` is an engine
            // detail.
            let cut = 0; let cutEl = null;
            for (const kid of c.children) {
              const s = getComputedStyle(kid);
              if (s.display === 'none') continue;
              const kb = kid.getBoundingClientRect().bottom;
              // Past the PADDING box — literally the pixels the panel does not paint.
              // An earlier version added the bottom padding back in to charge a child
              // for eating the panel's breathing room, which conflated two different
              // quantities and made every clean column read 8px hot. One number, one
              // meaning: how much of this column is invisible.
              if (kb - clientBottom > cut) { cut = R(kb - clientBottom); cutEl = kid.className; }
            }
            // ⚠️ AND THE THIRD MEASUREMENT, WHICH IS THE ONLY ONE THAT WAS EVER TRUE.
            //
            // `--selftest` pushed 40px of extra content into this column and BOTH of the
            // metrics above reported zero. They were not broken; the column does not
            // overflow. Its children are `<button>`s, and a button's flex
            // `min-height: auto` does NOT resolve to its content-based minimum in
            // Chromium — so an over-subscribed column SQUASHES its cards instead of
            // spilling out of itself, and the text then draws outside the card's own
            // border with the panel looking untouched. Measured on the mutant: the road
            // card went 70.58px -> 52.28px while its content stayed 67px, i.e. 21px of
            // type rendered over its own bottom edge and every column-level number
            // stayed 0.00.
            //
            // Floats, not `scrollHeight - clientHeight`: both of those are integers, so
            // sub-pixel layout gives a 1-2px false floor that would have to be tolerated
            // — and a tolerance is exactly where a real 3px spill hides.
            let squash = 0; let squashEl = null;
            for (const card of c.querySelectorAll('.home-track, .home-kit-tile, .home-kit-cap, .home-rec')) {
              const s = getComputedStyle(card);
              const cr2 = card.getBoundingClientRect();
              // ⚠️ NOT `getComputedStyle(card).display === 'none'`. That reads the
              // element's OWN computed display, which for a child of a display:none
              // ancestor is still 'flex' — so `.home-rec` inside a hidden
              // `.home-record` measured a 5px "squash" at 852x393, on three chips that
              // are not on the screen at all. A zero-area rect is the only reliable
              // statement that an element is not laid out.
              if (s.display === 'none' || (cr2.width === 0 && cr2.height === 0)) continue;
              const contentBottom = cr2.bottom - (parseFloat(s.borderBottomWidth) || 0) - (parseFloat(s.paddingBottom) || 0);
              for (const kid of card.children) {
                if (getComputedStyle(kid).display === 'none') continue;
                const over = kid.getBoundingClientRect().bottom - contentBottom;
                if (over > squash) { squash = R(over); squashEl = `${card.className.split(' ')[0]} > ${kid.className || kid.tagName}`; }
              }
            }
            return {
              cls: c.className.replace('fa-panel home-col ', ''),
              h: R(cr.height),
              clientH: c.clientHeight,
              scrollH: c.scrollHeight,
              clipped: c.scrollHeight - c.clientHeight,
              childCut: Math.max(0, cut),
              childCutEl: cut > 0 ? cutEl : null,
              squash: Math.max(0, squash),
              squashEl,
              // The itemised bill. Without it a 21px overspend is a number with no
              // address, and the first two rounds of this fix were spent trimming
              // 1-2px off things that were not the problem.
              items: [...c.children]
                .filter((k) => { const r = k.getBoundingClientRect(); return r.width > 0 || r.height > 0; })
                .map((k) => `${(k.className || k.tagName).split(' ').pop()}=${R(k.getBoundingClientRect().height)}`),
              slack: mid ? R(mid.getBoundingClientRect().height - cr.height) : null,
              width: R(cr.width),
              contentW: c.clientWidth,
            };
          }),
          trackContentW: (() => { const t = document.querySelector('.home-track'); return t ? t.clientWidth : null; })(),
        };
      })(),
      d4: {
        kitDisplay: kitCs ? kitCs.display : 'absent',
        kitVisible: !!(kit && kit.offsetParent !== null),
        kitRect: kit && kit.offsetParent !== null ? rect(kit) : null,
        tileCount: tiles.length,
        capDisplay: (() => { const c = document.querySelector('.home-kit-cap'); return c ? getComputedStyle(c).display : 'absent'; })(),
        // The OUTCOME question, not the symptom question (LESSONS §13): how many
        // ability affordances can the player see on this screen, at this viewport?
        abilityAffordances: tiles.length,
        // 44x44, the same floor `menu_accept` enforces. Duplicated here on purpose: an
        // ability affordance a thumb cannot hit is not an affordance, so the count above
        // would otherwise report 4 for a row of 34px targets.
        tilesUnder44: tiles
          .map((t) => ({ n: (t.textContent || '').trim().slice(0, 18), w: R(t.getBoundingClientRect().width), h: R(t.getBoundingClientRect().height) }))
          .filter((t) => t.w < 44 || t.h < 44),
        // What is left in the right flank once the kit is gone — is the panel even
        // worth its width?
        fighterPanel: one('.home-fighter'),
        changeBtn: one('.home-change'),
        // THE CARET. `renderKit` writes `--home-cap-x` off the selected tile's box, and
        // the first render happens BEFORE the shell appends the screen, so a version of
        // that code that does not re-run post-mount silently defaults to 50% — visible
        // in the 1600x900 capture as a diamond in the gutter between two tiles. This is
        // the outcome question: is the caret's tip inside the selected tile's x-range?
        caret: (() => {
          const capEl = document.querySelector('.home-kit-cap');
          const onTile = document.querySelector('.home-kit-tile.is-on');
          if (!capEl || !onTile || capEl.offsetParent === null) return null;
          const cr = capEl.getBoundingClientRect();
          const raw = getComputedStyle(capEl).getPropertyValue('--home-cap-x').trim();
          const pct = parseFloat(raw);
          if (!Number.isFinite(pct)) return { raw, inside: false, why: 'unparseable' };
          const x = cr.left + (pct / 100) * cr.width;
          const tr = onTile.getBoundingClientRect();
          return { raw, x: R(x), tileL: R(tr.left), tileR: R(tr.right), inside: x >= tr.left && x <= tr.right };
        })(),
      },
    };
  }

  if (screen === 'characters') {
    const ab = document.querySelector('.chars-abilities');
    const rows = [...document.querySelectorAll('.chars-ability')];
    const clip = ab ? clipper(ab) : null;
    const abBox = ab ? {
      rect: rect(ab),
      clientH: ab.clientHeight,
      scrollH: ab.scrollHeight,
      overflowY: ab.scrollHeight - ab.clientHeight,
      clientBottom: R(ab.getBoundingClientRect().top + (parseFloat(getComputedStyle(ab).borderTopWidth) || 0) + ab.clientHeight),
      clipper: clip,
    } : null;
    const detail = document.querySelector('.chars-detail');
    return {
      screen,
      d3: {
        abilities: abBox,
        detail: detail ? {
          rect: rect(detail), clientH: detail.clientHeight, scrollH: detail.scrollHeight,
          maxH: getComputedStyle(detail).maxHeight, overflowY: getComputedStyle(detail).overflowY,
          // The itemised bill: every pixel of this panel that is NOT the ability list is
          // a pixel the ability list does not have.
          items: [...detail.children]
            .filter((k) => { const r = k.getBoundingClientRect(); return r.width > 0 || r.height > 0; })
            .map((k) => `${(k.className || k.tagName).split(' ').pop()}=${R(k.getBoundingClientRect().height)}`),
        } : null,
        rows: rows.map((r) => {
          const rr = rect(r);
          const container = abBox ? abBox.clientBottom : (clip ? clip.bottom : null);
          const name = r.querySelector('.chars-ability-name');
          const desc = r.querySelector('.chars-ability-desc');
          // The DESCENDER, not the box. A line box's bottom is above the font's
          // descent for most faces, so a row whose rect ends exactly at the container
          // still has "g", "y" and "p" cut. Measured off the last text run's own
          // bounding rect plus the font's descent, via a Range on the text node.
          const lastText = desc || name;
          let inkBottom = rr.bottom;
          if (lastText && lastText.firstChild && lastText.firstChild.nodeType === 3) {
            const rg = document.createRange();
            rg.selectNodeContents(lastText);
            const rb = rg.getBoundingClientRect();
            if (rb.height > 0) inkBottom = R(rb.bottom);
          }
          return {
            name: name ? (name.textContent || '').trim() : '?',
            rect: rr,
            inkBottom,
            cutPx: container === null ? 0 : R(Math.max(0, rr.bottom - container)),
            inkCutPx: container === null ? 0 : R(Math.max(0, inkBottom - container)),
            nameOverflow: name ? R(name.scrollWidth - name.clientWidth) : 0,
            descOverflow: desc ? R(desc.scrollWidth - desc.clientWidth) : 0,
          };
        }),
      },
      d2chars: textRuns(['.chars-ability-name', '.chars-ability-desc', '.chars-fact', '.fa-panel-title']),
    };
  }

  return { screen, note: 'unexpected screen' };
}

/**
 * ⚠️ RETRIED, and the retry is not defensive padding.
 *
 * `settleScreen` polls `page.evaluate` every 50ms, and character select mounts a
 * thumbnail generator that can still be swapping the document under it — one run died
 * with "Execution context was destroyed, most likely because of a navigation" on the
 * FOURTH viewport, after three clean ones, which is the signature of a race rather
 * than of a broken page. Swallowing it silently would be the bug; it is retried at
 * most twice and the attempt count is printed, so a page that is genuinely
 * navigation-looping shows up as three failures rather than as a green run.
 */
async function openScreen(browser, vp, route, after = null) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
    await page.addInitScript((seed) => {
      if (!localStorage.getItem('food-arena.profile.v1')) {
        localStorage.setItem('food-arena.profile.v1', JSON.stringify(seed));
      }
    }, SEED);
    try {
      await page.goto(`${BASE}/?screen=${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(`window.__screen === "${route}"`, null, { timeout: 60000 });
      // Same mechanism `menu_accept` uses: `--fa-safe-*` are declared on :root exactly
      // so a test can override them, because `env(safe-area-inset-*)` cannot be faked.
      if (vp.safe) {
        await page.evaluate((safe) => {
          const st = document.documentElement.style;
          for (const k of ['t', 'r', 'b', 'l']) st.setProperty(`--fa-safe-${k}`, `${safe[k]}px`);
        }, vp.safe);
      }
      await settleScreen(page, { label: `${route}@${vp.name}` });
      // ⚠️ THE PROBE RUNS INSIDE THE RETRY, not after it, and the retry is on the SAME
      // page rather than a fresh one.
      //
      // Traced with `framenavigated` + console logging: this snapshot's dev server
      // reloads the document roughly every 13 SECONDS, twice per cycle (load, then an
      // immediate second navigation to the identical URL), for as long as it is up.
      // Six peer agents are running their own snapshots against the same repo, and a
      // Vite dep-optimizer pass in any of them rewrites the shared `node_modules/.vite`
      // cache, which every other server reads as a change and answers with a full
      // reload. Nothing about it is a defect in this screen — but it destroys the
      // execution context under `page.evaluate`, and it presents EXACTLY like a screen
      // that failed to mount.
      //
      // A fresh page per attempt costs ~10s of boot and settle, which is most of the
      // 13s window, so retrying the whole open kept landing back inside a reload. Two
      // levels: this loop re-settles and re-probes on the SAME page (about 2s, which
      // fits the window), and the outer loop is left for genuine mount failures.
      let out = null; let lastInner = null;
      for (let inner = 1; inner <= 6; inner++) {
        try {
          out = after ? await after(page) : null;
          lastInner = null;
          break;
        } catch (e) {
          lastInner = e;
          if (!/Execution context was destroyed|Target closed|Navigation/i.test(String(e))) throw e;
          await page.waitForFunction(`window.__screen === "${route}"`, null, { timeout: 60000 });
          await settleScreen(page, { label: `${route}@${vp.name} reprobe ${inner}` });
        }
      }
      if (lastInner) throw lastInner;
      if (attempt > 1) console.log(`   [retry] ${route}@${vp.name} settled on attempt ${attempt}`);
      return { page, out };
    } catch (e) {
      lastErr = e;
      await page.close().catch(() => {});
    }
  }
  throw lastErr;
}

/** Load every route once so Vite's optimizer reload happens before anything is timed. */
async function warmRoutes(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  for (const route of ['home', 'characters']) {
    try {
      await page.goto(`${BASE}/?screen=${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
    } catch { /* the warm-up is best-effort by definition */ }
  }
  await page.close();
}

/**
 * ⚠️ THE KNOWN-BAD-INPUT RUN. A guard that has not been shown to FAIL on the bug it
 * guards against is not a guard, and this project has caught nineteen instruments
 * returning confident wrong answers in one session.
 *
 * Every row here mutates the LIVE page into a state whose correct answer is known by
 * construction, and asserts the probe reports it. Four kinds, one per defect, plus the
 * one that motivated the whole file: `slack` came out at EXACTLY 0.00 at 852x480 after
 * the fix, which is either "fits perfectly" or "the cap is hiding an overspend", and
 * nothing in the output distinguished them. Row 5 settles it.
 */
async function selftest(browser) {
  const { page } = await openScreen(browser, VIEWPORTS[1], 'home');   // 852x480
  const rows = [];
  const check = (name, ok, detail) => { rows.push({ name, ok, detail }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

  // 1. TRUNCATION IS DETECTED. Force a nowrap+ellipsis run back onto a title and the
  //    probe must name it. If this passes on the fixed build too, `ellipsised` is
  //    reporting something other than an ellipsis.
  let m = await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'ud-selftest';
    // ⚠️ THE MUTANT HAS TO RESTORE THE WHOLE PRE-FIX LAYOUT, not just the ellipsis.
    // A first version injected only the three text properties and stopped failing the
    // moment the narrow-flank container query reflowed `.home-track` to a grid: the
    // title then owned a full 109px row, so "9 rewards ready" fitted and the mutant
    // reported CLEAN. That is a guard silently ceasing to guard because the code it
    // watches moved — the tautology failure in `docs/LESSONS.md` §13, arriving by the
    // back door. It now reproduces the shipped-before state: flex row, no wrapping, a
    // title that may shrink to nothing, and an ellipsis to hide the consequence.
    s.textContent = [
      '.fa-home .home-track{display:flex}',
      '.fa-home .home-track-top{display:flex;flex-wrap:nowrap}',
      '.fa-home .home-track-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1 1 0}',
    ].join('');
    document.head.appendChild(s);
    return true;
  }) && await page.evaluate(probeFn);
  const t = m.d2.filter((r) => r.ellipsised);
  check('MUTANT: nowrap+ellipsis on the title is reported as truncated',
    t.length > 0, `${t.length} run(s) flagged, e.g. ${t[0] ? `"${t[0].ellipsised.shown}"` : '-'}`);

  // 2. AND THE CLEAN BUILD IS NOT. Same probe, mutation removed — the pair is what
  //    makes row 1 mean anything (a probe that always says "truncated" would pass it).
  m = await page.evaluate(() => { document.getElementById('ud-selftest')?.remove(); return true; })
    && await page.evaluate(probeFn);
  check('CONTROL: the same probe on the unmutated page reports zero truncation',
    m.d2.filter((r) => r.ellipsised).length === 0, `${m.d2.length} runs checked`);

  // 3. OVERLAP IS DETECTED. Drag the nameplate back up under the tabs by hand.
  m = await page.evaluate(() => {
    const p = document.querySelector('.home-nameplate');
    p.style.top = '10px';
    return true;
  }) && await page.evaluate(probeFn);
  check('MUTANT: a nameplate at top:10px is reported as OVERLAPPING the tab bar',
    m.d1.overlapPx > 0, `overlap ${m.d1.overlapPx}px`);
  await page.evaluate(() => { document.querySelector('.home-nameplate').style.top = ''; });

  // 4. A HIDDEN KIT IS DETECTED. This is the exact shipped defect D4 describes.
  m = await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'ud-selftest';
    s.textContent = '.fa-home .home-kit{display:none}';
    document.head.appendChild(s);
    return true;
  }) && await page.evaluate(probeFn);
  check('MUTANT: display:none on .home-kit is reported as zero ability affordances',
    m.d4.abilityAffordances === 0 && m.d4.kitDisplay === 'none', `tiles=${m.d4.tileCount} display=${m.d4.kitDisplay}`);
  await page.evaluate(() => { document.getElementById('ud-selftest')?.remove(); });

  // 5. ⚠️ THE ONE THAT MOTIVATED THE FILE. `slack: 0.00` is ambiguous, so overspend is
  //    measured a second way, per CHILD. Push 40px of extra content into the left
  //    column: `childCut` must go positive. If it does not, every green `childCut=0`
  //    above this line means nothing.
  // ⚠️ SIZED FROM THE MEASURED SLACK, not a fixed 40px. A fixed spacer stopped being a
  // mutant the moment the fix gave that column 44.73px of headroom — 40 < 44.73, so the
  // page absorbed it and the row reported PASS-as-CLEAN, i.e. the guard failed to fail
  // because the thing it guards got better. Anything derived from the live measurement
  // is always an overspend by construction.
  const slackNow = (await page.evaluate(probeFn)).room.cols.find((c) => c.cls.includes('progress')).slack;
  m = await page.evaluate((extra) => {
    const col = document.querySelector('.home-progress');
    const spacer = document.createElement('div');
    spacer.id = 'ud-spacer';
    spacer.style.cssText = `flex:0 0 auto;height:${extra}px`;
    col.appendChild(spacer);
    return true;
  }, Math.ceil(Math.max(0, slackNow) + 40)) && await page.evaluate(probeFn);
  const left = m.room.cols.find((c) => c.cls.includes('progress'));
  check(`MUTANT: ${Math.ceil(Math.max(0, slackNow) + 40)}px of extra content (slack ${slackNow} + 40) is reported as overspent`,
    left.squash > 0.5 || left.childCut > 0.5,
    `squash=${left.squash}px (${left.squashEl}) — the column-level routes said childCut=${left.childCut} clip=${left.clipped}`);
  await page.evaluate(() => { document.getElementById('ud-spacer')?.remove(); });

  // 6. AND THE CONTROL FOR IT.
  m = await page.evaluate(probeFn);
  const left2 = m.room.cols.find((c) => c.cls.includes('progress'));
  check('CONTROL: with the spacer removed the same column reports no overspend',
    left2.squash <= 0.5 && left2.childCut <= 0.5, `squash=${left2.squash}px childCut=${left2.childCut}px slack=${left2.slack}px`);

  await page.close();
  const passed = rows.filter((r) => r.ok).length;
  console.log(`\nselftest ${passed}/${rows.length}`);
  return passed === rows.length;
}

const browser = await chromium.launch();
if (SHOTS) await mkdir(SHOTS, { recursive: true });
await warmRoutes(browser);

if (args.includes('--selftest')) {
  const ok = await selftest(browser);
  await browser.close();
  process.exit(ok ? 0 : 1);
}

/**
 * ⚠️ THE STRINGS THIS SCREEN CAN ACTUALLY HOLD, WHICH ARE NOT THE ONES A SEEDED SAVE
 * PRODUCES.
 *
 * A populated profile renders "Tap to claim", "2 more wins", "Waiting to be opened".
 * The code paths in `home.ts` and `economy/tuning.ts` can produce strings 20% longer,
 * and the left column's headroom at 852x480 is 1.42px — so measuring the seed's
 * strings and declaring the layout safe is the known-bad-input failure applied to
 * CONTENT rather than to code. Every value below is the longest output of a real
 * branch, quoted with the branch that produces it:
 *
 *   roadtitle   milestoneFace() on a container reward, CONTAINERS.pineappleBox
 *   roadsub     renderRoad()'s "N trophies to go" at a four-digit milestone
 *   chestsub    renderChest()'s zero-remaining branch
 *   heldtitle   renderHeld() with a two-digit count
 *   kit caption CHARACTERS.donut's Sticky Trail, the longest desc in the cast (52 ch)
 */
const STRESS = {
  roadtitle: '3 Purple Pineapple Boxes',
  roadsub: '1,250 trophies to go',
  chestsub: 'Ready on your next win',
  heldtitle: '12 chests held',
  kitcapname: 'Candy Barrage',
  kitcapdesc: 'Leaves a filling trail - hurts enemies, speeds him up',
};

async function applyStress(page) {
  return page.evaluate((S) => {
    const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    set('[data-el="roadtitle"]', S.roadtitle);
    set('[data-el="roadsub"]', S.roadsub);
    set('[data-el="chestsub"]', S.chestsub);
    set('[data-el="heldtitle"]', S.heldtitle);
    const cap = document.querySelector('[data-el="kitcap"]');
    if (cap) {
      const n = cap.querySelector('.home-kit-capname');
      if (n) n.textContent = S.kitcapname;
      const d = cap.lastElementChild;
      if (d && d !== n) d.textContent = S.kitcapdesc;
    }
    return true;
  }, STRESS);
}

const results = [];
let fails = 0;
const bad = (s) => { fails++; return s; };

for (const vp of VIEWPORTS) {
  if (ONLY !== 'chars') {
    // The CAPTURE is inside the retried callback too. It calls `settleScreen` again
    // internally, so a reload landing between the probe and the shutter throws from a
    // different stack and would otherwise escape the retry entirely — which is exactly
    // how the first version of this died on viewport 2 of 6.
    const { page, out: m } = await openScreen(browser, vp, 'home', async (p) => {
      if (args.includes('--stress')) await applyStress(p);
      const probed = await p.evaluate(probeFn);
      if (SHOTS) await captureSettled(p, { path: `${SHOTS}/home-${vp.name}.png`, label: `home@${vp.name}`, tool: 'ud_defects' });
      return probed;
    });
    results.push({ viewport: vp.name, route: 'home', ...m });

    const d1 = m.d1;
    const d1bad = d1.overlapPx > 0;
    console.log(`\n=== HOME ${vp.name} ${vp.width}x${vp.height} ===`);
    console.log(`D1 nameplate top=${d1.nameplate?.top} (css ${d1.nameplateTopCss})  tabs.bottom=${d1.tabs?.bottom}  `
      + `overlap=${d1.overlapPx}px  nameInkGap=${d1.inkGap}px  ${d1bad ? bad('OVERLAP') : 'clear'}`);
    if (d1bad) console.log(`   overlap box: ${JSON.stringify(d1.overlapBox)}  name="${d1.heroNameText}"`);

    const trunc = m.d2.filter((r) => r.ellipsised);
    const vcut = m.d2.filter((r) => r.cutPx > 0.5);
    console.log(`D2 ${trunc.length ? bad(`${trunc.length} TRUNCATED`) : '0 truncated'}   ${vcut.length ? bad(`${vcut.length} VERT-CUT`) : '0 vert-cut'}   (${m.d2.length} runs checked)`);
    for (const r of trunc) console.log(`   ${r.sel.padEnd(22)} "${r.ellipsised.full}" -> "${r.ellipsised.shown}"  (-${r.ellipsised.lostChars} chars, box ${r.rect.w}x${r.rect.h}, ${r.fontPx}px)`);
    for (const r of vcut) console.log(`   ${r.sel.padEnd(22)} "${r.text.slice(0, 34)}" cut ${r.cutPx}px by .${r.clipSel}`);

    const d4 = m.d4;
    const d4bad = d4.abilityAffordances === 0;
    const caretBad = d4.caret && !d4.caret.inside;
    const small = d4.tilesUnder44 || [];
    console.log(`D4 .home-kit display=${d4.kitDisplay}  tiles=${d4.tileCount}  cap=${d4.capDisplay}  ${d4bad ? bad('NO ABILITY AFFORDANCE') : 'present'}`
      + (small.length ? `  ${bad(`${small.length} TILE(S) UNDER 44px`)} ${small.map((t) => `${t.n} ${t.w}x${t.h}`).join(', ')}` : '')
      + (d4.caret ? `  caret=${d4.caret.raw} x=${d4.caret.x} in [${d4.caret.tileL}..${d4.caret.tileR}] ${caretBad ? bad('CARET OFF ITS TILE') : 'on-tile'}` : ''));
    const rm = m.room;
    const overspent = rm.cols.filter((c) => c.clipped > 0.5 || c.childCut > 0.5 || c.squash > 0.5);
    console.log(`ROOM middle=${rm.middleH}  trackContentW=${rm.trackContentW}  `
      + rm.cols.map((c) => `[${c.cls} ${c.width}w h=${c.h} slack=${c.slack} clip=${c.clipped} childCut=${c.childCut} squash=${c.squash}]`).join(' ')
      + (overspent.length ? `  ${bad('COLUMN OVERSPENT')}` : ''));
    for (const c of overspent) {
      if (c.childCut > 0.5) console.log(`   ${c.cls}: "${c.childCutEl}" is ${c.childCut}px below the panel's paint line`);
      if (c.squash > 0.5) console.log(`   ${c.cls}: SQUASHED — ${c.squashEl} draws ${c.squash}px outside its own card`);
      console.log(`   ${c.cls} bill: ${c.items.join('  ')}`);
    }
    if (args.includes('--bill')) for (const c of rm.cols) console.log(`   ${c.cls} bill: ${c.items.join('  ')}`);
    await page.close();
  }

  if (ONLY !== 'home') {
    const { page, out: m } = await openScreen(browser, vp, 'characters', async (p) => {
      const probed = await p.evaluate(probeFn);
      if (SHOTS) await captureSettled(p, { path: `${SHOTS}/chars-${vp.name}.png`, label: `chars@${vp.name}`, tool: 'ud_defects' });
      return probed;
    });
    results.push({ viewport: vp.name, route: 'characters', ...m });
    const d3 = m.d3;
    const cut = d3.rows.filter((r) => r.inkCutPx > 0.5);
    // ⚠️ THE ACCEPTANCE TEST IS THE FIRST ROW, NOT EVERY ROW, and stating it up front
    // is the point of `docs/LESSONS.md`'s "define a measurable acceptance test BEFORE
    // round 1". A scroll region with four rows and room for two WILL cut the third —
    // that is what scrolling means, and demanding zero cuts would make the metric
    // unsatisfiable and therefore useless. What is a DEFECT is a region so short that
    // the FIRST row is sliced through its own descenders with no signal that a list
    // exists at all: 28 CSS px of viewport onto 384 px of content, which is what the
    // audit photographed. Floor: the first ability is whole at every viewport.
    // ⚠️ THE BOX, NOT THE INK. The first pass of this fix reported "first row whole"
    // with the row's ink 35px clear of the container — and 1.34px of the row's own 2.5px
    // ink BORDER still cut, because the box is taller than the text inside it. A card
    // whose bottom border is shaved is exactly the "unfinished" read the audit named;
    // the ink test would have passed it forever.
    const firstCut = d3.rows.length ? Math.max(d3.rows[0].cutPx, d3.rows[0].inkCutPx) : 0;
    console.log(`=== CHARS ${vp.name} ===`);
    console.log(`D3 .chars-abilities ${d3.abilities?.rect.w}x${d3.abilities?.rect.h}  clientH=${d3.abilities?.clientH} scrollH=${d3.abilities?.scrollH} `
      + `overflowY=${d3.abilities?.overflowY}  detail h=${d3.detail?.rect.h}  `
      + `${firstCut > 0.5 ? bad(`FIRST ROW CUT ${firstCut}px`) : 'first row whole'}  (${cut.length}/${d3.rows.length} rows cut)`);
    console.log(`   detail bill: ${d3.detail?.items.join('  ')}`);
    for (const r of d3.rows) {
      const flag = r.inkCutPx > 0.5 ? `cut ${r.inkCutPx}px` : 'whole';
      console.log(`   ${String(r.name).padEnd(18)} h=${r.rect.h} bottom=${r.rect.bottom} ink=${r.inkBottom} container=${d3.abilities?.clientBottom}  ${flag}`);
    }
    const tc = m.d2chars.filter((r) => r.ellipsised);
    if (tc.length) { bad('x'); for (const r of tc) console.log(`   TRUNC ${r.sel} "${r.ellipsised.full}" -> "${r.ellipsised.shown}"`); }
    await page.close();
  }
}

await browser.close();
if (JSON_OUT) await writeFile(JSON_OUT, JSON.stringify(results, null, 2));
console.log(`\n${fails === 0 ? 'ALL CLEAN' : `${fails} DEFECT ROW(S)`}`);
process.exit(fails ? 1 : 0);
