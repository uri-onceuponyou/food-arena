#!/usr/bin/env node
/**
 * LF_PROBE — is the lobby entry on the home screen a CONTROL you would press, and does
 * anything on that screen tell you your KIT lives behind it?
 *
 * Uri's report is a discoverability failure, not a rendering one: he could not find the
 * loadout. The only route to it is `.home-mode` — a dark plate at the bottom-right
 * reading "KITCHEN RUMBLE / 2:30 - last one standing" beside a large yellow START GAME.
 * "It reads as a status label" is a claim about pixels and about words, so this file
 * measures both, off the RENDERED PNG and off the accessible text, never off a
 * computed style.
 *
 * ── WHAT IT MEASURES, AND WHY EACH ONE IS HERE ──────────────────────────────
 *
 *   A. PLATE SEPARATION. For each control, the WCAG contrast between the modal colour
 *      of its own interior and the modal colour of a 12 px ring immediately OUTSIDE it.
 *      A control that does not separate from its surround is furniture. This is the
 *      `CLAUDE.md` #4 question — "it is rendering and INVISIBLE" — asked of an element
 *      that is unarguably in the DOM and unarguably hit-testable. The match pause chip
 *      shipped working at 1.026:1 against its own background and Uri could not see it.
 *
 *   B. INK CONTRAST, from the pixels actually behind each glyph. Copied from
 *      `home_metrics.mjs`'s `splitFgBg`, INCLUDING its stroked-glyph branch: a
 *      `-webkit-text-stroke` glyph sits on its own stroke and not on the backdrop, and
 *      a stroke-blind model returned 2.53 where the pixels say 16.53 (`cab4662`).
 *
 *   C. SALIENCE, as the control's area in CSS px and its ratio to the primary CTA's.
 *      `home.ts` already records a 3.6x hierarchy inversion it fixed on the *other*
 *      secondary control by SIZE; the same number is the honest way to say "this reads
 *      as a caption", and the same number is how you show it stopped.
 *
 *   D. VOCABULARY. Uri's sentence is "how do i use an item in a game?" — so the
 *      question is not only whether the plate looks pressable but whether ANY visible
 *      text on home names what is behind it. A control that is beautiful and silent
 *      about items does not fix this report. Counted as visible text runs matching
 *      `KIT_WORDS` below, listed verbatim. The pattern is quoted THERE and nowhere
 *      else — a second copy of it in this header is next month's stale one.
 *
 * ── VACUITY GUARDS (§G), RUN BEFORE ANY ROW ────────────────────────────────
 * `[].every()` is true and `[].filter(...).length === 0` reads exactly like "clean".
 *   §G0 `window.__screen === 'home'`. `tools/shoot.mjs --screen lobby` returned a
 *       confident screenshot OF THE HOME SCREEN yesterday — it has no `--screen`
 *       handling at all and the flag is silently ignored. A tool that measured the
 *       wrong screen would pass most of these rows. ABORTS, never records.
 *   §G1 both controls resolve to a visible box of non-zero area. If `.home-mode` is
 *       `display: none` (it WAS, at <=700 px, until 2026-08-12) every per-control row
 *       below would quantify over nothing.
 *   §G2 the text-run set inside each control is non-empty before any ink ratio is
 *       reported as a minimum.
 *   §G3 the outside ring contributed at least 200 sampled pixels, so "separation" is
 *       not a comparison against an empty annulus at the viewport edge.
 *
 * ── KNOWN-BAD (`--knownbad`): a guard not shown to FAIL is not a guard ──────
 * Two mutations of the LIVE DOM of a real home screen, each with a restore that is the
 * positive control proving the red came from the mutation and not from the harness:
 *   KB-A CAMOUFLAGE. Paint `.home-mode` in its own measured surround colour and strip
 *        its border and shadow. Plate separation must COLLAPSE (< 1.20) and come back
 *        on restore. This is the defect the metric exists to catch, planted where it
 *        can express itself — not in a fixture.
 *   KB-B ERASURE. `display: none` on `.home-mode`. §G1 must go RED and the run must
 *        REFUSE, rather than reporting a tidy zero.
 * A run where either mutation leaves the numbers alone means this file is measuring
 * nothing, and it exits 1.
 *
 * ── RESOLUTION FLOOR ────────────────────────────────────────────────────────
 * Contrast ratios here are computed from a modal 5-bit colour bin over a rect whose
 * geometry is text-driven, and `lb_accept.mjs` measured `.home-mode`'s own width
 * drifting 268 -> 266 CSS px between runs on ONE tree. So the plate/ink numbers are NOT
 * exact. `--repeat N` runs the whole capture N times on one URL and prints the spread;
 * quote that spread as the floor rather than assuming one. Area in CSS px and the
 * vocabulary count ARE exact — integer geometry and a string match.
 *
 * ── USE ─────────────────────────────────────────────────────────────────────
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean -- \
 *     node tools/tmp/lf_probe.mjs --url '{URL}' --label before --out tools/tmp/lf/before
 *   node tools/tmp/lf_probe.mjs --url "$URL" --knownbad
 *   node tools/tmp/lf_probe.mjs --selftest     # no browser; validates the MATH only
 *
 * ⚠️ `--selftest` validates this file's LOGIC and says NOTHING about where it is
 * pointed. §G0 is the pointing check and it only runs with a browser.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { settleScreen, waitForFaded, captureSettled } from './settle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? (argv[i + 1] ?? true) : d; };
const has = (k) => argv.includes(`--${k}`);

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/** The two controls the report is about. Keyed by the SELECTOR, never a line number. */
const CONTROLS = {
  mode: '.fa-home .home-mode',
  cta: '.fa-home [data-el="start"]',
};
/** Every word that would tell a player their kit is behind that control. */
// ⚠️ WAS `/item|kit|loadout|equip|gear/i` and the selftest killed it inside a minute:
// `kit` matches **Kit**chen, so the tool would have reported the CURRENT copy
// ("Kitchen Rumble") as already naming the kit — a confident wrong answer on the one
// question this file exists to ask. Kept per the reversed-assertion rule.
const KIT_WORDS = /\b(items?|kits?|loadouts?|equips?|equipped|gear)\b/i;

// ── colour maths, WCAG 2.1 ──────────────────────────────────────────────────
function relLum(r, g, b) {
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = Math.max(a, b), l2 = Math.min(a, b);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Modal 5-bit colour bin over an arbitrary pixel predicate. Returns null when empty. */
function modalBin(px, W, H, inRect) {
  const bins = new Map();
  let n = 0;
  for (const [x0, y0, w, h] of inRect.rects) {
    for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) {
        if (inRect.exclude && inRect.exclude(x, y)) continue;
        const i = (y * W + x) * 3;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const key = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
        let e = bins.get(key);
        if (!e) bins.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
        e.n++; e.r += r; e.g += g; e.b += b; n++;
      }
    }
  }
  if (n === 0) return null;
  let best = null;
  for (const e of bins.values()) if (!best || e.n > best.n) best = e;
  return {
    r: +(best.r / best.n).toFixed(1), g: +(best.g / best.n).toFixed(1), b: +(best.b / best.n).toFixed(1),
    share: +(best.n / n).toFixed(3), samples: n,
  };
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
  return [...bins.values()].map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, share: e.n / n }))
    .sort((a, b) => b.share - a.share);
}

function parseColor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p[3] === undefined ? 1 : p[3] };
}

/**
 * Foreground/background for one text rect, from PIXELS. Verbatim in behaviour from
 * `home_metrics.mjs` including the stroked-glyph branch — see this file's header B.
 */
function splitFgBg(px, W, x0, y0, w, h, minShare = 0.015, color = null, stroke = null) {
  if (stroke && stroke.width >= 1.5) {
    const paper = { r: stroke.r, g: stroke.g, b: stroke.b };
    const paperL = relLum(paper.r, paper.g, paper.b);
    let ink = color ?? paper;
    if (color) {
      let best = 70;
      for (const b of binsOf(px, W, x0, y0, w, h)) {
        if (b.share < 0.015) continue;
        const d = Math.hypot(b.r - color.r, b.g - color.g, b.b - color.b);
        if (d < best) { best = d; ink = b; }
      }
    }
    return { bg: paper, fg: ink, viaStroke: true, ratio: contrast(relLum(ink.r, ink.g, ink.b), paperL) };
  }
  const bins = binsOf(px, W, x0, y0, w, h);
  if (!bins.length) return null;
  const bgc = bins[0];
  const bgL = relLum(bgc.r, bgc.g, bgc.b);
  let fg = null, best = -1;
  for (const b of bins) {
    if (b.share < minShare) continue;
    const d = Math.abs(relLum(b.r, b.g, b.b) - bgL);
    if (d > best) { best = d; fg = b; }
  }
  if (!fg) return { bg: bgc, fg: bgc, ratio: 1 };
  return { bg: bgc, fg, ratio: contrast(relLum(fg.r, fg.g, fg.b), bgL) };
}

/** Interior inset, clamped so a short control still yields a sample. */
function interiorRect(r) {
  const ix = Math.min(10, Math.max(2, Math.floor(r.w / 5)));
  const iy = Math.min(10, Math.max(2, Math.floor(r.h / 5)));
  return [Math.round(r.x + ix), Math.round(r.y + iy), Math.round(r.w - 2 * ix), Math.round(r.h - 2 * iy)];
}
/**
 * The control's own OUTER BAND — the first `t` px inside its border box.
 *
 * ⚠️ THIS EXISTS BECAUSE `plateContrast` ALONE WOULD HAVE MIS-SCORED A REAL FIX.
 * An element can separate from its surround by a bright BORDER while its interior stays
 * the same colour as the backdrop; the interior-vs-surround number barely moves and the
 * eye sees a completely different control. Optimising only the number that is easy to
 * compute is `AGENT-BRIEF §4.6` — "an acceptance test proves you moved the thing you
 * NAMED, not that it was the thing". Both are reported and neither is summed with the
 * other: they are different quantities.
 */
/**
 * ⚠️ MEASURED LIMIT, ADDED AFTER USING IT: `edgeContrast` IS NOT COMPARABLE ACROSS A
 * CHANGE OF PLATE COLOUR, and the A/B that produced this file proved it. The 4 px band
 * straddles the border AND the first pixels of the plate, so which of the two wins the
 * modal bin depends on the plate — at 844x390 it read **7.344 before and 1.699 after**
 * on a change that made the control unmistakably MORE visible, and at 1280x800 it fell
 * 1.799 -> 1.186 on the same change. Its known-bad arm still works (camouflage collapses
 * it 1.607 -> 1.005), so it is not broken; it is answering "how does this border read
 * against the backdrop", which is a WITHIN-design question. Use it to catch a border
 * that has gone invisible inside one design. **Do not read a before/after of it across a
 * restyle, and nothing in this pass was acted on from it** — `plateContrast` is the
 * number that answers the discoverability question.
 */
function edgeRects(r, t) {
  const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
  return {
    rects: [
      [x, y, w, t],                  // top band
      [x, y + h - t, w, t],          // bottom band
      [x, y + t, t, h - 2 * t],      // left band
      [x + w - t, y + t, t, h - 2 * t], // right band
    ],
  };
}

/** A ring OUTSIDE the control, excluding the control's own box. */
function ringRects(r, t = 12) {
  const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
  return {
    rects: [
      [x - t, y - t, w + 2 * t, t],          // above
      [x - t, y + h, w + 2 * t, t],          // below
      [x - t, y - t, t, h + 2 * t],          // left
      [x + w, y - t, t, h + 2 * t],          // right
    ],
    exclude: (px, py) => px >= x && px < x + w && py >= y && py < y + h,
  };
}

// ── the DOM half ────────────────────────────────────────────────────────────
// ⚠️ ONE PARAMETER, DESTRUCTURED. `page.evaluate(fn, [a, b])` passes the ARRAY as a
// single argument — a two-parameter version received `[object Object]` as its selector
// and Chromium threw `not a valid selector`. Loud, and it could have been silent.
const COLLECT = ([controls, kitWordSrc]) => {
  const KIT = new RegExp(kitWordSrc, 'i');
  const vis = (n) => {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = n.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  };
  const runsIn = (rootEl) => {
    const out = [];
    if (!rootEl) return out;
    const walk = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
    for (let n = walk.currentNode; n; n = walk.nextNode()) {
      const own = Array.from(n.childNodes)
        .filter((c) => c.nodeType === 3 && c.textContent.trim().length > 0)
        .map((c) => c.textContent.trim()).join(' ');
      if (!own || !vis(n)) continue;
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      out.push({
        text: own.slice(0, 60),
        cls: typeof n.className === 'string' ? n.className : '',
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        size: +parseFloat(s.fontSize).toFixed(1),
        weight: Number(s.fontWeight),
        color: s.color,
        strokeWidth: parseFloat(s.webkitTextStrokeWidth) || 0,
        strokeColor: s.webkitTextStrokeColor,
      });
    }
    return out;
  };
  const out = { screen: window.__screen ?? null, controls: {}, vocab: [], allRuns: 0 };
  for (const [key, sel] of Object.entries(controls)) {
    const el = document.querySelector(sel);
    if (!el || !vis(el)) { out.controls[key] = { found: false, sel }; continue; }
    const r = el.getBoundingClientRect();
    out.controls[key] = {
      found: true, sel,
      x: r.x, y: r.y, w: r.width, h: r.height,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      runs: runsIn(el),
    };
  }
  // The slot STATE, as the DOM presents it. Two arms of this file compare these.
  out.slots = Array.from(document.querySelectorAll('.fa-home .home-mode-slot')).map((n) => ({
    filled: n.classList.contains('is-filled'),
    title: n.getAttribute('title'),
    hasSvg: !!n.querySelector('svg'),
  }));
  const home = document.querySelector('.fa-home');
  const all = runsIn(home);
  out.allRuns = all.length;
  out.vocab = all.filter((r) => KIT.test(r.text)).map((r) => ({ text: r.text, cls: r.cls }));
  // The accessible names too — a label a screen reader reads is still not a pixel a
  // player sees, so these are reported SEPARATELY and never summed with the visible set.
  out.ariaVocab = Array.from(document.querySelectorAll('.fa-home [aria-label]'))
    .map((n) => n.getAttribute('aria-label'))
    .filter((s) => KIT.test(s || ''));
  return out;
};

/**
 * The equipped pair lives in `localStorage` under `lobby.ts`'s `LOADOUT_KEY`, not in the
 * profile — so a probe that only ever sees the shipped default measures ONE of the two
 * states this control can be in, and the filled state could render nothing at all
 * without a single number moving. `--equip a,b` seeds it before the load; `--equip ''`
 * is the empty arm. The key is duplicated here deliberately and the duplication is
 * checked: §G4 asserts the seeded ids come back out of the DOM, so a renamed key fails
 * loudly instead of silently measuring the default.
 */
const LOADOUT_KEY = 'food-arena.loadout.v1';

async function measureOnce(page, base, { W, H, outDir, label, navigate = true, equip = null }) {
  if (equip !== null) {
    // `addInitScript` rather than an `evaluate` after load: the screen reads the store
    // during `render()`, which has already run by the time an `evaluate` could fire.
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, v); } catch { /* private mode */ }
    }, [LOADOUT_KEY, JSON.stringify(equip)]);
  }
  // ⚠️ `navigate: false` IS LOAD-BEARING AND ITS ABSENCE MADE THE KNOWN-BAD VACUOUS.
  // The first version always reloaded, so KB-A's DOM mutation was wiped before the
  // frame that was supposed to show it: camouflage read 1.556 -> 1.556 and the arm
  // reported "the instrument cannot go red" when what it had actually measured was
  // "the instrument never saw the defect". Same shape as a known-bad planted where the
  // bug cannot express itself (`CLAUDE.md` #6).
  if (navigate) {
    await page.goto(`${base}/?screen=home`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction('window.__screen === "home" && window.__screenReady === true', null, { timeout: 60000 });
    await settleScreen(page, { label: 'home' });
    // The taunt hint is a 4200 ms timeout plus a 0.6 s transition — no paint condition can
    // predict it, so the sleep is a FLOOR and the element's own opacity is the condition.
    await page.waitForTimeout(6000);
    await waitForFaded(page, '.fa-home .home-stage-hint').catch(() => {});
  }

  const dom = await page.evaluate(COLLECT, [CONTROLS, KIT_WORDS.source]);

  // §G0 — POINTING. Before any row.
  if (dom.screen !== 'home') {
    throw new Error(`G0 FAILED: measured screen is "${dom.screen}", not "home". Refusing to report.`);
  }

  const shotPath = outDir ? `${outDir}/${label}_${W}x${H}.png` : undefined;
  if (outDir) mkdirSync(outDir, { recursive: true });
  const cap = await captureSettled(page, { path: shotPath, label: `home/${label}`, wait: false, tool: 'lf_probe.mjs' });
  const img = sharp(cap.buf).removeAlpha().raw();
  const { data: px, info } = await img.toBuffer({ resolveWithObject: true });
  const PW = info.width, PH = info.height;
  const scale = PW / W;

  const faults = [];
  const controls = {};
  for (const [key, c] of Object.entries(dom.controls)) {
    // §G1 — non-empty box before anything quantifies over it.
    if (!c.found) { faults.push(`G1: control "${key}" (${c.sel}) not found or not visible`); continue; }
    const r = { x: c.x * scale, y: c.y * scale, w: c.w * scale, h: c.h * scale };
    const [ix, iy, iw, ih] = interiorRect(r);
    const plate = modalBin(px, PW, PH, { rects: [[ix, iy, iw, ih]] });
    const ring = ringRects(r, Math.round(12 * scale));
    const around = modalBin(px, PW, PH, ring);
    if (!plate) { faults.push(`G1: control "${key}" interior sampled 0 px`); continue; }
    // §G3 — the annulus has to be a real sample, not a sliver at the viewport edge.
    if (!around || around.samples < 200) {
      faults.push(`G3: control "${key}" surround ring sampled ${around ? around.samples : 0} px (< 200)`);
      continue;
    }
    // §G2 — a minimum over an empty set is `Infinity`, which reads as excellent.
    if (c.runs.length === 0) { faults.push(`G2: control "${key}" has no visible text run`); continue; }

    const inks = c.runs.map((run) => {
      const stroke = run.strokeWidth >= 1.5
        ? { ...parseColor(run.strokeColor), width: run.strokeWidth } : null;
      const s = splitFgBg(px, PW, Math.round(run.x * scale), Math.round(run.y * scale),
        Math.max(1, Math.round(run.w * scale)), Math.max(1, Math.round(run.h * scale)),
        0.015, parseColor(run.color), stroke);
      return { text: run.text, cls: run.cls, size: run.size, weight: run.weight, ratio: s ? +s.ratio.toFixed(2) : null };
    });

    const edge = modalBin(px, PW, PH, edgeRects(r, Math.max(2, Math.round(4 * scale))));
    controls[key] = {
      sel: c.sel, tag: c.tag, ariaLabel: c.ariaLabel,
      text: c.text,
      box: { x: +c.x.toFixed(1), y: +c.y.toFixed(1), w: +c.w.toFixed(1), h: +c.h.toFixed(1) },
      areaCss: Math.round(c.w * c.h),
      plate, around,
      plateContrast: +contrast(relLum(plate.r, plate.g, plate.b), relLum(around.r, around.g, around.b)).toFixed(3),
      edge,
      edgeContrast: edge
        ? +contrast(relLum(edge.r, edge.g, edge.b), relLum(around.r, around.g, around.b)).toFixed(3) : null,
      inks,
      minInk: +Math.min(...inks.map((i) => i.ratio ?? Infinity)).toFixed(2),
    };
  }

  const rel = (controls.mode && controls.cta)
    ? +(controls.mode.areaCss / controls.cta.areaCss).toFixed(3) : null;

  return {
    label, viewport: { W, H }, png: shotPath ?? null, pngSize: { W: PW, H: PH },
    faults, controls,
    slots: dom.slots,
    modeVsCtaArea: rel,
    vocab: { visible: dom.vocab, aria: dom.ariaVocab, totalRuns: dom.allRuns },
  };
}

// ── known-bad ───────────────────────────────────────────────────────────────
async function knownBad(page, base, opts) {
  const clean = await measureOnce(page, base, { ...opts, label: 'kb-clean' });
  if (clean.faults.length) throw new Error(`known-bad needs a clean baseline; got faults: ${clean.faults.join(' | ')}`);
  const base0 = clean.controls.mode.plateContrast;
  const rows = [];

  // KB-A — CAMOUFLAGE. Paint the plate in its own measured surround colour.
  const { r, g, b } = clean.controls.mode.around;
  await page.evaluate(([sel, col]) => {
    const el = document.querySelector(sel);
    el.dataset.lfSaved = el.getAttribute('style') ?? '';
    el.style.background = col;
    el.style.border = '0';
    el.style.boxShadow = 'none';
  }, [CONTROLS.mode, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`]);
  const camo = await measureOnce(page, base, { ...opts, label: 'kb-camo', navigate: false })
    .catch((e) => ({ error: String(e) }));
  rows.push({ arm: 'KB-A camouflage', before: base0, after: camo.controls?.mode?.plateContrast ?? null });
  rows.push({ arm: 'KB-A camo (edge)', before: clean.controls.mode.edgeContrast, after: camo.controls?.mode?.edgeContrast ?? null });

  // RESTORE IN PLACE — no reload. A reload would also repaint the hero and re-settle the
  // page, so "it came back" could be the reload rather than the undo. Putting the saved
  // `style` attribute back and re-measuring the SAME page makes this a real positive
  // control for the mutation and nothing else.
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const saved = el.dataset.lfSaved ?? '';
    if (saved) el.setAttribute('style', saved); else el.removeAttribute('style');
    delete el.dataset.lfSaved;
  }, CONTROLS.mode);
  const restored = await measureOnce(page, base, { ...opts, label: 'kb-restore', navigate: false });
  rows.push({ arm: 'KB-A restore', before: base0, after: restored.controls.mode.plateContrast });
  rows.push({ arm: 'KB-A rest (edge)', before: clean.controls.mode.edgeContrast, after: restored.controls.mode.edgeContrast });

  // KB-B — ERASURE. §G1 must go red rather than reporting a tidy zero.
  await page.evaluate((sel) => { document.querySelector(sel).style.display = 'none'; }, CONTROLS.mode);
  const erased = await page.evaluate(COLLECT, [CONTROLS, KIT_WORDS.source]);
  rows.push({ arm: 'KB-B erasure', before: 'found', after: erased.controls.mode.found ? 'found' : 'NOT FOUND (G1 red)' });

  const byArm = Object.fromEntries(rows.map((r) => [r.arm, r]));
  const ok = {
    camo: byArm['KB-A camouflage'].after !== null && byArm['KB-A camouflage'].after < 1.20 && base0 >= 1.20,
    camoEdge: byArm['KB-A camo (edge)'].after !== null
      && byArm['KB-A camo (edge)'].after < byArm['KB-A camo (edge)'].before * 0.8,
    restoreEdge: Math.abs(byArm['KB-A rest (edge)'].after - byArm['KB-A rest (edge)'].before)
      / byArm['KB-A rest (edge)'].before < 0.10,
    // The tolerance is the run-to-run floor, not a guess: `--repeat 4` on one tree at
    // 1600x900 spread this number by RUN_TO_RUN_SPREAD (printed by that mode), because
    // the surround ring contains the animated hero stage. 0.10 is comfortably above it
    // and comfortably below the collapse KB-A produces.
    restore: Math.abs(byArm['KB-A restore'].after - base0) / base0 < 0.10,
    erasure: String(byArm['KB-B erasure'].after).startsWith('NOT FOUND'),
  };
  return { base0, rows, ok, pass: ok.camo && ok.camoEdge && ok.restore && ok.restoreEdge && ok.erasure };
}

// ── selftest: the MATH only ─────────────────────────────────────────────────
function selftest() {
  const say = [];
  let bad = 0;
  const t = (name, cond, detail = '') => { say.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) bad++; };

  // A synthetic 40x20 frame: left half black, right half white.
  const W = 40, H = 20, px = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, v = x < 20 ? 0 : 255;
    px[i] = v; px[i + 1] = v; px[i + 2] = v;
  }
  const left = modalBin(px, W, H, { rects: [[0, 0, 20, H]] });
  const right = modalBin(px, W, H, { rects: [[20, 0, 20, H]] });
  t('modalBin reads black', left.r === 0 && left.samples === 400, JSON.stringify(left));
  t('modalBin reads white', right.r === 255, JSON.stringify(right));
  t('contrast(black,white) = 21', Math.abs(contrast(relLum(0, 0, 0), relLum(255, 255, 255)) - 21) < 0.01);
  t('contrast(x,x) = 1', Math.abs(contrast(relLum(30, 20, 60), relLum(30, 20, 60)) - 1) < 1e-9);
  t('modalBin returns null on an empty rect', modalBin(px, W, H, { rects: [[100, 100, 5, 5]] }) === null);

  // ringRects must EXCLUDE the control's own box — if it did not, the "surround" would
  // contain the plate and every separation number would be pulled toward 1.
  const ring = ringRects({ x: 10, y: 5, w: 10, h: 10 }, 4);
  t('ring excludes the control box', ring.exclude(12, 7) === true && ring.exclude(5, 7) === false);
  let inside = 0;
  for (const [x0, y0, w, h] of ring.rects) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (ring.exclude(x, y)) inside++;
  }
  // ⚠️ WAS `inside === 0 || inside > 0` — a tautology with a tick next to it, which is
  // exactly the class `AGENT-BRIEF §4.4` names. The real claim is that the four rects
  // NEVER enter the box, so a mis-derived offset (`y + h` written as `y`) goes red here.
  t('ring rects never enter the control box', inside === 0, `${inside} px of ring inside the box`);

  // interiorRect must stay inside, and must not go empty on a short control.
  const [ix, iy, iw, ih] = interiorRect({ x: 100, y: 200, w: 30, h: 12 });
  t('interiorRect stays inside', ix >= 100 && iy >= 200 && ix + iw <= 130 && iy + ih <= 212, `${ix},${iy},${iw}x${ih}`);
  t('interiorRect non-empty on a 30x12 control', iw > 0 && ih > 0, `${iw}x${ih}`);

  // splitFgBg's stroke branch: ink is the glyph colour, paper is the STROKE, not the plate.
  const s = splitFgBg(px, W, 0, 0, 20, H, 0.015, { r: 255, g: 243, b: 222 }, { r: 20, g: 10, b: 30, width: 2 });
  t('splitFgBg uses the stroke as paper when the stroke is >= 1.5px', s.viaStroke === true && s.bg.r === 20);

  // The vocabulary regex must actually match the words this report is about, and must
  // NOT match the shipped copy it is meant to find missing.
  t('KIT_WORDS matches "Your items"', KIT_WORDS.test('Your items'));
  t('KIT_WORDS matches "Loadout"', KIT_WORDS.test('Loadout'));
  t('KIT_WORDS misses "2:30 - last one standing"', !KIT_WORDS.test('2:30 - last one standing'));
  t('KIT_WORDS misses "Kitchen Rumble"', !KIT_WORDS.test('Kitchen Rumble'));

  console.log(say.join('\n'));
  console.log(bad ? `\nSELFTEST: ${bad} FAILED` : '\nSELFTEST: all ok');
  console.log('⚠️ this validated the MATH. It says nothing about where the tool is pointed — that is §G0, and it needs a browser.');
  return bad === 0 ? 0 : 1;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (has('selftest')) process.exit(selftest());

  const base = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173')).replace(/\/$/, '');
  const W = Number(arg('w', 1600));
  const H = Number(arg('h', 900));
  const label = String(arg('label', 'run'));
  const outDir = arg('out') ? resolve(ROOT, String(arg('out'))) : null;
  const repeat = Number(arg('repeat', 1));

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  let exit = 0;
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    // A fresh snapshot's FIRST client eats a dep-optimisation reload presenting as
    // "execution context was destroyed" — warm it with a cheap load first.
    await page.goto(`${base}/?screen=home`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    if (has('knownbad')) {
      const kb = await knownBad(page, base, { W, H, outDir });
      console.log(`\n══ lf_probe --knownbad @ ${W}x${H} ══\n`);
      console.log(`clean plate separation: ${kb.base0}`);
      for (const r of kb.rows) console.log(`  ${r.arm.padEnd(18)} ${String(r.before).padStart(8)} -> ${r.after}`);
      console.log(`\n  camouflage collapses : ${kb.ok.camo ? 'YES' : 'NO'}`);
      console.log(`  camo drops the EDGE  : ${kb.ok.camoEdge ? 'YES' : 'NO'}`);
      console.log(`  restore recovers     : ${kb.ok.restore ? 'YES' : 'NO'}`);
      console.log(`  restore recovers edge: ${kb.ok.restoreEdge ? 'YES' : 'NO'}`);
      console.log(`  erasure refuses (G1) : ${kb.ok.erasure ? 'YES' : 'NO'}`);
      console.log(kb.pass ? '\nKNOWN-BAD: PASS — the instrument can go red.\n' : '\nKNOWN-BAD: FAIL — this file is measuring nothing.\n');
      if (outDir) writeFileSync(`${outDir}/knownbad.json`, JSON.stringify(kb, null, 2));
      exit = kb.pass ? 0 : 1;
    } else {
      const equipArg = arg('equip');
      const equip = equipArg === null ? null
        : (equipArg === true ? [] : String(equipArg).split(',').map((x) => x.trim()).filter(Boolean));
      const runs = [];
      for (let i = 0; i < repeat; i++) {
        runs.push(await measureOnce(page, base, { W, H, outDir, equip, label: repeat > 1 ? `${label}${i}` : label }));
      }
      // §G4 — POINTING, for the seeded arm. A renamed `LOADOUT_KEY` would leave the
      // screen on its default and every number below would describe the EMPTY state
      // while the label said otherwise. `[].every()` is true, so the length is asserted
      // first and the ids are compared against what was actually asked for.
      if (equip && equip.length) {
        const got = runs[0].slots.filter((s2) => s2.filled);
        if (got.length !== equip.length) {
          runs[0].faults.push(`G4: asked for ${equip.length} equipped item(s), the DOM shows ${got.length}`
            + ` — LOADOUT_KEY may have moved (this file has its own copy: ${LOADOUT_KEY})`);
        }
        const missing = runs[0].slots.filter((s2) => s2.filled && !s2.hasSvg).length;
        if (missing) runs[0].faults.push(`G4: ${missing} filled slot(s) rendered no <svg> — the icon is not drawing`);
      }
      const r = runs[0];
      if (has('json')) {
        console.log(JSON.stringify(repeat > 1 ? runs : r, null, 2));
      } else {
        console.log(`\n══ lf_probe [${label}] ${base} @ ${W}x${H} ══\n`);
        if (r.faults.length) { console.log('FAULTS (vacuity guards):'); for (const f of r.faults) console.log(`  ✗ ${f}`); console.log(''); }
        for (const [k, c] of Object.entries(r.controls)) {
          console.log(`${k.toUpperCase()}  ${c.sel}`);
          console.log(`  text            "${c.text}"`);
          console.log(`  aria-label      ${c.ariaLabel === null ? '(none)' : `"${c.ariaLabel}"`}`);
          console.log(`  box             ${c.box.w}x${c.box.h} at ${c.box.x},${c.box.y}   area ${c.areaCss} css px2`);
          console.log(`  plate           rgb(${c.plate.r},${c.plate.g},${c.plate.b})  share ${c.plate.share}`);
          console.log(`  surround        rgb(${c.around.r},${c.around.g},${c.around.b})  ${c.around.samples} px`);
          console.log(`  SEPARATION      ${c.plateContrast}:1   (interior vs surround)`);
          console.log(`  EDGE            ${c.edgeContrast}:1   (outer 4px band vs surround)`);
          console.log(`  ink (min)       ${c.minInk}:1`);
          for (const i of c.inks) console.log(`      ${String(i.ratio).padStart(6)}:1  ${i.size}px/${i.weight}  "${i.text}"`);
          console.log('');
        }
        console.log(`mode area / cta area   ${r.modeVsCtaArea}`);
        console.log(`item slots             ${r.slots.length ? r.slots.map((s2) => (s2.filled ? `[${s2.title}${s2.hasSvg ? '' : ' NO-ICON'}]` : '[empty]')).join(' ') : '(none rendered)'}`);
        console.log(`kit vocabulary VISIBLE ${r.vocab.visible.length} of ${r.vocab.totalRuns} runs` +
          (r.vocab.visible.length ? `: ${r.vocab.visible.map((v) => `"${v.text}"`).join(', ')}` : '  ← nothing on this screen names the kit'));
        console.log(`kit vocabulary ARIA    ${r.vocab.aria.length}` + (r.vocab.aria.length ? `: ${r.vocab.aria.map((s) => `"${s}"`).join(', ')}` : ''));
        if (repeat > 1) {
          const sep = runs.map((x) => x.controls.mode?.plateContrast).filter((v) => v !== undefined);
          const areas = runs.map((x) => x.controls.mode?.areaCss).filter((v) => v !== undefined);
          console.log(`\nREPEAT ${repeat}: separation ${sep.join(' / ')}  spread ${(Math.max(...sep) - Math.min(...sep)).toFixed(3)}`);
          console.log(`             area ${areas.join(' / ')}  spread ${Math.max(...areas) - Math.min(...areas)}`);
        }
        console.log('');
      }
      if (outDir) writeFileSync(`${outDir}/${label}.json`, JSON.stringify(repeat > 1 ? runs : r, null, 2));
      exit = r.faults.length ? 1 : 0;
    }
  } finally {
    await browser.close();
  }
  process.exit(exit);
}

main().catch((e) => { console.error(e); process.exit(1); });
