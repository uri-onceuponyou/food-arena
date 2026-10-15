#!/usr/bin/env node
/**
 * u1_clip — the three menu clips the r0 critics named, measured on rendered boxes.
 *
 * `docs/REVAMP.md` §1 / `shots/rv/r0/critics.json`: 6 of 6 select critics and 5 of 6 home
 * critics named a LAYOUT fault, not a taste gap, on the scored phone frames
 * (`home_phone` / `select_phone`, 852x393 CSS @ DPR 3 — `rv_packets.mjs` feeds the PHONE
 * captures to the menu sheets by default):
 *
 *   C1  select — "the '1,590' on the Upgrade button runs past its edge".
 *       Measured: every glyph (text line box or inline SVG) inside the right column must lie
 *       inside the padding box of its nearest BORDERED ancestor. A price drawn across its
 *       own button's ink line is the defect whether or not anything clips it.
 *   C2  select — "the second ability card ('Lettuce Fling') is sliced off mid-text".
 *       Measured over EVERY ability row (not only the first: `ud_defects` D3 asserts the
 *       FIRST row only, by design — "a partially visible second row is itself the
 *       affordance" — and that design is exactly what 5 of 6 critics read as a fault).
 *       A row or glyph is CUT when it is partially inside the clip region formed by every
 *       `overflow != visible` ancestor and the viewport. Fully scrolled-away content is
 *       reported (HIDDEN) but is not this defect; a cut at an edge whose clipping element
 *       carries a `mask-image` fade is reported as FADED, not CUT.
 *   C3  home — "a yellow diamond marker sits on top of the 'Tomato Toss' label".
 *       The kit caption's caret is `.home-kit-cap::before`, a 45-degree-rotated square: an
 *       L1 ball around its centre. FAIL when that diamond (+1px clearance) intersects any
 *       line box of the caption's own text, for EVERY kit tile selected in turn.
 *
 * Every viewport `menu_accept` (landscape) and `menu_accept_portrait` run, plus the scoring
 * capture's 852x393 and the audit's 852x480 — each with zero insets and with that battery's
 * own simulated notch. Every character on select (the scored frame is only the hamburger,
 * but a fix tuned to one fighter's short descriptions is the trap), every kit tile on home.
 * The profile is `q1_capture`'s SEEDED_PROFILE, parsed through `rv_capture`'s exporter, so
 * the prices and levels are the scored frame's.
 *
 * NON-EMPTY FIRST (`CLAUDE.md` rule 6): a run that measured zero rows, zero price glyphs or
 * zero caption lines is a FAIL of the instrument, never a pass.
 *
 * Usage (never `:5173`):
 *   node tools/tmp/sx_snap.mjs --root <worktree> -- node tools/tmp/u1_clip.mjs --url '{URL}'
 *     [--only home|select] [--vp <name,...>] [--json <path>] [--quiet]
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settleScreen } from './settle.mjs';
import { q1SeededProfile } from './rv_capture.mjs';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** Home is measured with these selected: the scored one first, then the extremes. */
const HOME_PICKS = ['hamburger', 'waterbottle', 'donut'];

/** menu_accept.mjs SAFE (landscape) and menu_accept_portrait.mjs SAFE, verbatim values. */
const NOTCH_LAND = { t: 0, r: 44, b: 21, l: 44 };
const NOTCH_PORT = { t: 47, r: 0, b: 34, l: 0 };

export const VIEWPORTS = [
  { name: 'score-852x393', width: 852, height: 393, notch: NOTCH_LAND },
  { name: 'audit-852x480', width: 852, height: 480, notch: NOTCH_LAND },
  { name: 'desktop-1600x900', width: 1600, height: 900, notch: NOTCH_LAND },
  { name: 'laptop-1280x800', width: 1280, height: 800, notch: NOTCH_LAND },
  { name: 'tablet-1024x768', width: 1024, height: 768, notch: NOTCH_LAND },
  { name: 'phone-844x390', width: 844, height: 390, notch: NOTCH_LAND },
  { name: 'ultrawide-2560x1080', width: 2560, height: 1080, notch: NOTCH_LAND },
  { name: 'portrait-360x800', width: 360, height: 800, notch: NOTCH_PORT },
  { name: 'portrait-390x844', width: 390, height: 844, notch: NOTCH_PORT },
  { name: 'portrait-430x932', width: 430, height: 932, notch: NOTCH_PORT },
];

/**
 * Page-side. Measures one screen region. Pure DOM geometry, no pixels.
 * `rootSel` scopes the glyph census; `rowSel` names the rows whose BOX must not be cut.
 */
export function measureRegion({ rootSels, rowSel, ownBoxRootSel }) {
  const vw = window.innerWidth; const vh = window.innerHeight;
  const EPS = 0.5;
  const clipOf = (node) => {
    let c = { l: 0, t: 0, r: vw, b: vh }; let masked = false; let by = 'viewport'; let scroll = false;
    for (let a = node.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a);
      const ox = s.overflowX !== 'visible'; const oy = s.overflowY !== 'visible';
      if (!ox && !oy) continue;
      const r = a.getBoundingClientRect();
      const pl = r.left + parseFloat(s.borderLeftWidth); const pr = r.right - parseFloat(s.borderRightWidth);
      const pt = r.top + parseFloat(s.borderTopWidth); const pb = r.bottom - parseFloat(s.borderBottomWidth);
      const before = { ...c };
      if (ox) { c.l = Math.max(c.l, pl); c.r = Math.min(c.r, pr); }
      if (oy) { c.t = Math.max(c.t, pt); c.b = Math.min(c.b, pb); }
      if (c.l !== before.l || c.r !== before.r || c.t !== before.t || c.b !== before.b) {
        by = (a.className || a.tagName).toString().split(' ').slice(0, 2).join('.');
        const m = s.maskImage || s.webkitMaskImage || 'none';
        masked = m !== 'none';
        scroll = /auto|scroll/.test(s.overflowX + s.overflowY);
      }
    }
    return { c, masked, by, scroll };
  };
  // A text LINE BOX carries half-leading above and below the ink, so a line box shaved by
  // 1px at a clip edge has lost leading, not glyphs: measured on base, every 1.0px "cut" was
  // an emoji line box (line-height 1.2) at the scroller's top edge with its row whole. 1.5px
  // is the stated tolerance for glyph line boxes; row BOXES (borders are ink) keep EPS.
  const GLYPH_TOL = 1.5;
  const classify = (r, clip, tol = EPS) => {
    const { c } = clip;
    const il = Math.max(r.left, c.l); const ir = Math.min(r.right, c.r);
    const it = Math.max(r.top, c.t); const ib = Math.min(r.bottom, c.b);
    // Wholly outside the clip. Inside a SCROLL container that is "scrolled away" and is
    // what scrolling means; inside an overflow:hidden box nothing can ever bring it back,
    // so it is LOST — worse than a cut (first seen: home's Change button pushed out of the
    // column with Donut selected at 852x480+notch, which the first version filed as hidden).
    if (ir - il <= EPS || ib - it <= EPS) return clip.scroll ? { state: 'hidden', cut: 0 } : { state: 'lost', cut: 0 };
    const cut = Math.max(c.l - r.left, r.right - c.r, c.t - r.top, r.bottom - c.b, 0);
    if (cut <= tol) return { state: 'whole', cut: 0 };
    return { state: clip.masked ? 'faded' : 'cut', cut };
  };
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (node) => (node.className || node.tagName || '').toString().split(' ')[0];
  const out = { glyphs: 0, glyphCut: [], glyphHidden: 0, glyphFaded: 0, ownBox: [], rows: 0, rowCut: [], rowHidden: 0, rowFaded: 0, roots: 0 };
  // LOST items are reported through the CUT lists (they fail the same checks), tagged.
  const roots = rootSels.flatMap((s) => [...document.querySelectorAll(s)]).filter(visible);
  out.roots = roots.length;
  const ownRoot = ownBoxRootSel ? document.querySelector(ownBoxRootSel) : null;
  for (const root of roots) {
    // ── glyphs: text line boxes + inline SVG icons ──
    const items = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const host = n.parentElement;
      if (!host || !visible(host)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const r of rg.getClientRects()) if (r.width > 0.5 && r.height > 0.5) items.push({ r, host, text: n.textContent.trim().slice(0, 24) });
    }
    for (const svg of root.querySelectorAll('svg')) {
      if (!visible(svg)) continue;
      items.push({ r: svg.getBoundingClientRect(), host: svg.parentElement ?? svg, text: '<svg>' });
    }
    for (const it of items) {
      out.glyphs++;
      const k = classify(it.r, clipOf(it.host), it.text === '<svg>' ? EPS : GLYPH_TOL);
      if (k.state === 'hidden') out.glyphHidden++;
      else if (k.state === 'faded') out.glyphFaded++;
      else if (k.state === 'cut') out.glyphCut.push(`${label(it.host)}[${it.text}] ${k.cut.toFixed(1)}px`);
      else if (k.state === 'lost') out.glyphCut.push(`${label(it.host)}[${it.text}] LOST`);
      // own box: nearest ancestor with an ink line on BOTH sides, inside the scoped root
      if (k.state === 'hidden' || k.state === 'lost') continue;
      for (let a = it.host; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        const bl = parseFloat(s.borderLeftWidth); const br = parseFloat(s.borderRightWidth);
        if (bl >= 1 && br >= 1 && s.borderLeftStyle !== 'none') {
          const b = a.getBoundingClientRect();
          const pl = b.left + bl; const pr = b.right - br;
          const pt = b.top + parseFloat(s.borderTopWidth); const pb = b.bottom - parseFloat(s.borderBottomWidth);
          const over = Math.max(pl - it.r.left, it.r.right - pr, 0);
          // vertical: line boxes legitimately exceed a tight pill's padding box (half-leading),
          // so only the HORIZONTAL axis is the defect here; C2 owns the vertical one.
          if (over > EPS && (!ownRoot || ownRoot.contains(a))) {
            out.ownBox.push(`${label(it.host)}[${it.text}] past ${label(a)} by ${over.toFixed(1)}px`);
          }
          void pt; void pb;
          break;
        }
        if (a === root) break;
      }
    }
    // ── rows ──
    if (rowSel) {
      for (const row of root.querySelectorAll(rowSel)) {
        if (getComputedStyle(row).display === 'none') continue;
        out.rows++;
        const k = classify(row.getBoundingClientRect(), clipOf(row));
        if (k.state === 'hidden') out.rowHidden++;
        else if (k.state === 'faded') out.rowFaded++;
        else if (k.state === 'cut' || k.state === 'lost') {
          const name = row.querySelector('[class*="name"]')?.textContent?.trim() ?? label(row);
          out.rowCut.push(`${name} ${k.state === 'lost' ? 'LOST' : `${k.cut.toFixed(1)}px`}`);
        }
      }
    }
  }
  return out;
}

/** Page-side: the kit caption's caret against the caption's own line boxes. */
export function measureCaret() {
  const cap = document.querySelector('.fa-home .home-kit-cap');
  if (!cap) return { error: 'no .home-kit-cap' };
  const capS = getComputedStyle(cap);
  if (capS.display === 'none') return { error: 'caption display:none' };
  const ps = getComputedStyle(cap, '::before');
  const lines = [];
  const tw = document.createTreeWalker(cap, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim()) continue;
    const host = n.parentElement;
    if (!host || getComputedStyle(host).display === 'none') continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) if (r.width > 0.5) lines.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, text: n.textContent.trim().slice(0, 20) });
  }
  if (ps.content === 'none' || ps.display === 'none') return { caret: null, lines: lines.length, hits: [] };
  const cr = cap.getBoundingClientRect();
  const bl = parseFloat(capS.borderLeftWidth); const bt = parseFloat(capS.borderTopWidth);
  const br = parseFloat(capS.borderRightWidth);
  const padW = cr.width - bl - br;
  // The pseudo's own geometry. `left` is the USED value for a positioned box; checked against
  // `--home-cap-x` below so a browser that returns the specified % cannot silently pass.
  const w = parseFloat(ps.width); const h = parseFloat(ps.height);
  const sizing = ps.boxSizing;
  const ow = sizing === 'border-box' ? w : w + parseFloat(ps.borderLeftWidth) + parseFloat(ps.borderRightWidth);
  const oh = sizing === 'border-box' ? h : h + parseFloat(ps.borderTopWidth) + parseFloat(ps.borderBottomWidth);
  const capX = parseFloat(cap.style.getPropertyValue('--home-cap-x') || '50');
  const leftUsed = parseFloat(ps.left);
  const leftFromVar = (capX / 100) * padW;
  const left = Number.isFinite(leftUsed) ? leftUsed : leftFromVar;
  const x0 = cr.left + bl + left + parseFloat(ps.marginLeft || '0');
  const y0 = cr.top + bt + parseFloat(ps.top);
  const cx = x0 + ow / 2; const cy = y0 + oh / 2;
  const rot = ps.transform && ps.transform !== 'none';
  // a square of side s rotated 45deg is the L1 ball of radius s/sqrt(2); unrotated, a box
  const rad = rot ? Math.max(ow, oh) / Math.SQRT2 : null;
  const CLEAR = 1;
  const hits = [];
  for (const L of lines) {
    if (rot) {
      const nx = Math.min(Math.max(cx, L.l), L.r); const ny = Math.min(Math.max(cy, L.t), L.b);
      const d = Math.abs(cx - nx) + Math.abs(cy - ny);
      if (d < rad + CLEAR) hits.push(`${L.text} (L1 ${d.toFixed(1)} < ${(rad + CLEAR).toFixed(1)})`);
    } else if (x0 < L.r + CLEAR && x0 + ow > L.l - CLEAR && y0 < L.b + CLEAR && y0 + oh > L.t - CLEAR) {
      hits.push(`${L.text} (box)`);
    }
  }
  return {
    caret: { cx: +cx.toFixed(1), cy: +cy.toFixed(1), rad: rad && +rad.toFixed(2), leftUsed, leftFromVar: +leftFromVar.toFixed(2) },
    lines: lines.length, hits,
  };
}

const sleepFrames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function setInsets(page, safe) {
  await page.evaluate((s) => {
    const st = document.documentElement.style;
    for (const k of ['t', 'r', 'b', 'l']) {
      if (s) st.setProperty(`--fa-safe-${k}`, `${s[k]}px`); else st.removeProperty(`--fa-safe-${k}`);
    }
  }, safe);
  await page.waitForTimeout(160);
  await sleepFrames(page);
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const BASE = arg('--url', process.env.PREVIEW_BASE);
  if (!BASE || /:5173\b/.test(BASE)) { console.error('u1_clip: --url <snapshot> required — never :5173'); process.exit(2); }
  const only = arg('--only', null);
  const vpOnly = arg('--vp', null);
  const quiet = argv.includes('--quiet');
  const jsonOut = arg('--json', null);
  const profile = q1SeededProfile();
  const vps = vpOnly ? VIEWPORTS.filter((v) => vpOnly.split(',').some((n) => v.name.includes(n))) : VIEWPORTS;
  if (!vps.length) throw new Error(`--vp ${vpOnly} matched no viewport`);

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  let fails = 0;
  let homeMeasured = 0;
  const rec = (vp, pass, screen, subject, ok, detail) => {
    rows.push({ vp: vp.name, pass, screen, subject, ok, detail });
    if (!ok) fails++;
    if (!ok || !quiet) console.log(`${ok ? 'PASS' : 'FAIL'}  ${vp.name.padEnd(20)} ${pass.padEnd(5)} ${screen.padEnd(6)} ${subject.padEnd(22)} ${detail}`);
  };
  try {
    for (const vp of vps) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch {} }, profile);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));

      // ── select ──
      if (!only || only === 'select') {
        await page.goto(`${BASE}/?screen=characters`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForFunction('window.__previewReady === true', null, { timeout: 60000 });
        await settleScreen(page, { label: `${vp.name}/characters`, timeout: 90000 });
        const ids = await page.evaluate(() => [...document.querySelectorAll('.fa-chars .chars-card[data-char]')].map((c) => c.dataset.char));
        rec(vp, '-', 'select', 'roster non-empty', ids.length >= 11, `${ids.length} cards`);
        for (const pass of ['zero', 'notch']) {
          await setInsets(page, pass === 'notch' ? vp.notch : null);
          let priceGlyphs = 0; let anyRows = 0; let captions = 0;
          for (const id of ids) {
            await page.click(`.fa-chars .chars-card[data-char="${id}"]`);
            await sleepFrames(page);
            // Every ability's caption, not only the first: a kit shows ONE description at a
            // time, so a long one that is cut would hide behind the default tile.
            const nAbl = await page.evaluate(() => document.querySelectorAll('.fa-chars .chars-abl').length);
            const picks = nAbl ? [...Array(nAbl).keys()] : [null];
            for (const k of picks) {
              if (k !== null) {
                await page.evaluate((i) => document.querySelector(`.fa-chars .chars-abl[data-abl="${i}"]`)?.click(), k);
                await sleepFrames(page);
                captions++;
              }
              const tag = k === null ? id : `${id}#${k}`;
              const m = await page.evaluate(measureRegion, {
                rootSels: ['.fa-chars .chars-detail', '.fa-chars .chars-level', '.fa-chars .chars-bottom'],
                rowSel: '.chars-ability, .chars-abl',
                ownBoxRootSel: null,
              });
              const price = await page.evaluate(() => {
                const b = document.querySelector('.fa-chars [data-el="upgrade"]');
                return b ? { n: b.querySelectorAll('.chars-lv-price').length, txt: b.textContent.trim().replace(/\s+/g, ' ') } : null;
              });
              if (price?.n) priceGlyphs++;
              anyRows += m.rows;
              const priceOver = m.ownBox.filter((s) => /chars-lv|upgrade|ds-btn/.test(s));
              rec(vp, pass, 'select', `${tag} C1 text-in-box`, m.ownBox.length === 0,
                m.ownBox.length ? m.ownBox.slice(0, 3).join(' | ') + (priceOver.length ? '  <PRICE>' : '') : `${m.glyphs} glyphs inside their boxes${price ? ` · "${price.txt}"` : ''}`);
              rec(vp, pass, 'select', `${tag} C2 rows+glyphs`, m.rowCut.length === 0 && m.glyphCut.length === 0,
                `rows ${m.rows} (cut ${m.rowCut.length}, hidden ${m.rowHidden}, faded ${m.rowFaded})`
                + ` · glyphs ${m.glyphs} (cut ${m.glyphCut.length}, hidden ${m.glyphHidden}, faded ${m.glyphFaded})`
                + (m.rowCut.length ? ` · ROW ${m.rowCut.slice(0, 2).join(' | ')}` : '')
                + (m.glyphCut.length ? ` · GLYPH ${m.glyphCut.slice(0, 2).join(' | ')}` : ''));
            }
          }
          rec(vp, pass, 'select', 'non-empty (rows, price)', anyRows > 0 && priceGlyphs > 0,
            `rows measured ${anyRows}, measurements with a price ${priceGlyphs}, kit captions opened ${captions}`);
        }
        await setInsets(page, null);
      }

      // ── home ──
      // The seeded hamburger is the scored frame; Water Bottle carries the cast's longest
      // descriptions (to 180 characters) and Donut the most abilities (5). Home shows the
      // SELECTED fighter's kit, so a caption bug that only a long description triggers is
      // invisible to a run that only ever selects the hamburger.
      if (!only || only === 'home') {
        for (const pick of HOME_PICKS) {
          let hctx = ctx; let hpage = page;
          if (pick !== profile.selected) {
            hctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
            await hctx.addInitScript((p) => { try { localStorage.setItem('food-arena.profile.v1', JSON.stringify(p)); } catch {} }, { ...profile, selected: pick });
            hpage = await hctx.newPage();
            hpage.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
          }
          try {
            await hpage.goto(`${BASE}/?screen=home`, { waitUntil: 'networkidle', timeout: 120000 });
            await hpage.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
            await settleScreen(hpage, { label: `${vp.name}/home/${pick}`, timeout: 120000 });
          } catch (err) {
            // A load that never settles is a RECORDED failure of this cell, not a crash that
            // throws away every row already measured (it happened once under contention).
            rec(vp, '-', 'home', `${pick} load`, false, String(err.message ?? err).split('\n')[0].slice(0, 120));
            if (hctx !== ctx) await hctx.close();
            continue;
          }
          for (const pass of ['zero', 'notch']) {
            await setInsets(hpage, pass === 'notch' ? vp.notch : null);
            // Portrait hides BOTH side columns by design (`home.ts`, max-width 700px:
            // '.home-col { display: none }'), so there is no kit and no caption to measure.
            // That is a SKIP, counted below, never a pass of C3.
            const n = await hpage.evaluate(() => [...document.querySelectorAll('.fa-home .home-kit-tile')]
              .filter((t) => t.getBoundingClientRect().width > 0).length);
            if (n === 0) {
              rows.push({ vp: vp.name, pass, screen: 'home', subject: `${pick} C3 SKIP`, ok: true, detail: 'kit not displayed at this viewport' });
              if (!quiet) console.log(`SKIP  ${vp.name.padEnd(20)} ${pass.padEnd(5)} home   ${pick} C3 — kit not displayed at this viewport`);
              continue;
            }
            if (pick === profile.selected) homeMeasured++;
            for (let i = 0; i < n; i++) {
              await hpage.click(`.fa-home .home-kit-tile[data-kit="${i}"]`);
              await sleepFrames(hpage);
              const c = await hpage.evaluate(measureCaret);
              if (c.error) { rec(vp, pass, 'home', `${pick}#${i} C3 caret`, false, c.error); continue; }
              const ok = c.lines > 0 && c.hits.length === 0;
              rec(vp, pass, 'home', `${pick}#${i} C3 caret`, ok,
                c.lines === 0 ? 'caption has NO text lines — instrument pointed at nothing'
                  : c.caret ? `${c.hits.length ? 'ON TEXT: ' + c.hits.join(' | ') : 'clear of'} ${c.lines} line(s) · centre ${c.caret.cx},${c.caret.cy} r ${c.caret.rad} · left used ${c.caret.leftUsed} var ${c.caret.leftFromVar}`
                    : `no caret · ${c.lines} line(s)`);
              const m = await hpage.evaluate(measureRegion, { rootSels: ['.fa-home .home-fighter'], rowSel: '.home-kit-tile', ownBoxRootSel: null });
              rec(vp, pass, 'home', `${pick}#${i} col text-in-box`, m.ownBox.length === 0, m.ownBox.length ? m.ownBox.slice(0, 3).join(' | ') : `${m.glyphs} glyphs inside their boxes`);
              rec(vp, pass, 'home', `${pick}#${i} col cut`, m.glyphCut.length === 0 && m.rowCut.length === 0,
                `tiles ${m.rows} (cut ${m.rowCut.length}) · glyphs ${m.glyphs} (cut ${m.glyphCut.length}, hidden ${m.glyphHidden}, faded ${m.glyphFaded})`
                + (m.glyphCut.length ? ` · ${m.glyphCut.slice(0, 2).join(' | ')}` : ''));
            }
          }
          if (hctx !== ctx) await hctx.close(); else await setInsets(hpage, null);
        }
      }
      rec(vp, '-', '-', 'no page errors', errs.length === 0, errs.slice(0, 2).join(' | ') || '0');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  // NON-EMPTY: C3 must have measured every landscape viewport it ran (both passes); only
  // portrait may skip. A run where the kit vanished everywhere is an instrument fault.
  if (!only || only === 'home') {
    const landPasses = vps.filter((v) => v.width > v.height).length * 2;
    const ok = homeMeasured >= landPasses;
    rows.push({ vp: '*', pass: '-', screen: 'home', subject: 'C3 non-empty', ok, detail: `${homeMeasured} viewport-passes measured, ${landPasses} landscape required` });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${'*'.padEnd(20)} -     home   C3 non-empty           ${homeMeasured}/${landPasses} landscape viewport-passes measured`);
    if (!ok) fails++;
  }
  const total = rows.length;
  console.log(`\nu1_clip: ${total - fails}/${total} passed, ${fails} failed`);
  if (jsonOut) await writeFile(jsonOut, JSON.stringify({ base: BASE, rows }, null, 1));
  process.exit(fails ? 1 : 0);
}

const isMain = (() => {
  try { return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) await main();
