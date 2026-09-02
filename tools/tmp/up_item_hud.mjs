#!/usr/bin/env node
/**
 * THE ITEM BUTTONS — acceptance battery.
 *
 * `docs/ITEMS.md` ships ten items that `combat.ts` resolves, the economy awards and the
 * lobby equips. `state.ts:FighterInput.useItem` is READ by `sim.ts` and, before this
 * pass, was WRITTEN BY NOTHING — there was no button. This measures the button.
 *
 * ── WHAT IT ASSERTS, AND THE DEFECT EACH ROW GUARDS ─────────────────────────
 *   A  STATES     Every authored state is REACHED by planting the situation that
 *                 produces it, not by adding the class. A passive shows AUTO and never
 *                 shows a key cap; an empty slot shows EMPTY; Disposal at two seats
 *                 shows NEED 3 and at six seats goes ready. The defect: a state that
 *                 exists in the stylesheet and is set by nothing — `hud_accept`'s §E
 *                 exists because `.hud-zone.is-danger` was authored in three rules and
 *                 applied by none.
 *   B  GEOMETRY   The cluster overlaps no other HUD landmark and no touch hint, at five
 *                 viewports. The defect this was WRITTEN for: the right edge of a
 *                 landscape phone is already full — 19px between the radar and the
 *                 weapon tray at 844x390 — so the obvious "put it above the tray" lands
 *                 on the radar.
 *   C  REACH      Every item button is at least 44x44 CSS px and inside the safe-area
 *                 insets, with a notch injected. A control you cannot hit is the same
 *                 defect as one that does nothing.
 *   D  CONTRAST   Every mark the cluster draws clears WCAG 2.1 SC 1.4.11's 3.0 floor
 *                 against the pixels actually behind it. The match pause chip shipped
 *                 working at 1.026:1 and Uri could not see it; `src/ui/icons/index.ts`
 *                 records three earlier dark-on-dark shipments.
 *   E  UNCHANGED  With NO loadout — every existing probe, gate and shipped default —
 *                 the cluster has no box, and `.hud-spectate` and `.tch-hint--aim` are
 *                 where they were to the pixel. This is what lets `menu_accept`,
 *                 `lu_land` and `hud_accept` keep their numbers.
 *   F  AGREEMENT  `is-ready` and the badge never contradict each other: a slot that
 *                 reads ready carries no badge, and a slot carrying WAIT / NEED n /
 *                 EMPTY / AUTO is never ready. `combat.ts:itemUsable`'s header — *"a
 *                 button that greys itself out on a copy of the rule is a button that
 *                 will one day disagree with the sim"*.
 *
 * ── KNOWN-BAD INPUTS (`CLAUDE.md` #6) ───────────────────────────────────────
 * `--known-bad` re-runs the whole battery with three plants, each aimed at one section,
 * and REQUIRES the section it targets to fail:
 *   D  the glyph and the badge are re-inked to their own plate colour (ink on ink) —
 *      the exact shape of the pause-chip bug, invisible in the DOM.
 *   B  the cluster is forced into a ROW above the weapon tray in the landscape corner —
 *      the layout this pass actually designed first and threw away, which lands on the
 *      radar. Reinstating the real rejected design is a stronger known-bad than an
 *      invented one: if B stays green under it, B could not have caught the near-miss.
 *   C  every slot is forced to 30x30, under the touch floor.
 * If a targeted section still PASSES, its assertions are tautologies and this exits
 * non-zero saying so.
 *
 * ⚠️ EVERY FILTERED SET IS ASSERTED NON-EMPTY BEFORE IT IS QUANTIFIED OVER —
 * `[].every()` is `true`, and that vacuity has fired three times in three files here.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/up_item_hud.mjs --url '{URL}'
 *   node tools/tmp/up_item_hud.mjs --url <base> --known-bad
 *   node tools/tmp/up_item_hud.mjs --url <base> --shots shots/items      # PNGs to LOOK at
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const a = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[i + 1] ?? true;
}
const BASE = (a.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173').replace(/\/$/, '');
const KNOWN_BAD = a['known-bad'] === true || a['known-bad'] === 'true';
const SHOTS = typeof a.shots === 'string' ? a.shots : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

/* ── WCAG maths ──────────────────────────────────────────────────────────────
   The same formula `tools/tmp/hud_accept.mjs` uses, re-stated here rather than
   imported, and the reason is that file's own shape: it has no exports and no
   `IS_MAIN` guard, so `import`ing it RUNS the battery and launches Chromium — the
   exact trap `docs/AGENT-BRIEF.md` §3 records for `snapsweep` and `da_census`. This
   copy is eleven lines of a published standard, not a second source of truth for a
   project decision. */
const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const relLum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
/** WCAG 2.1 SC 1.4.11, non-text contrast. */
const MARK_FLOOR = 3.0;
/** A colour bin holding less than this share of the sampled box is noise, not a mark. */
const MIN_SHARE = 0.08;

function bins(px, W, x, y, w, h) {
  const m = new Map();
  let n = 0;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * W + xx) * 3;
      const key = (px[i] >> 3) * 1024 + (px[i + 1] >> 3) * 32 + (px[i + 2] >> 3);
      let e = m.get(key);
      if (!e) m.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2]; n++;
    }
  }
  return [...m.values()].map((e) => ({ n: e.n, share: e.n / n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }))
    .sort((p, q) => q.n - p.n);
}
const clamp = (W, H, x, y, w, h) => {
  const x0 = Math.max(0, Math.min(W - 1, Math.round(x)));
  const y0 = Math.max(0, Math.min(H - 1, Math.round(y)));
  return [x0, y0, Math.max(1, Math.min(W - x0, Math.round(w))), Math.max(1, Math.min(H - y0, Math.round(h)))];
};

/**
 * The best separation any real colour inside `r` achieves against the modal colour of
 * the ring around it. `mode: 'ink'` — a mark drawn ON a plate — compares the two loudest
 * bins INSIDE the box instead, because the plate is the background there and the ring
 * outside it is the arena.
 */
function markRatio(px, W, H, r, mode, pad = 6) {
  const [ix, iy, iw, ih] = clamp(W, H, r.x, r.y, r.w, r.h);
  const inside = bins(px, W, ix, iy, iw, ih).filter((b) => b.share >= MIN_SHARE);
  if (!inside.length) return null;
  if (mode === 'ink') {
    if (inside.length < 2) return { ratio: 1, plate: inside[0], ink: inside[0] };
    const plate = inside[0];
    const pl = relLum(plate.r, plate.g, plate.b);
    let best = null, bestR = -1;
    for (const b of inside.slice(1)) {
      const c = contrast(relLum(b.r, b.g, b.b), pl);
      if (c > bestR) { bestR = c; best = b; }
    }
    return { ratio: bestR, plate, ink: best };
  }
  const [rx, ry, rw, rh] = clamp(W, H, r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2);
  const ring = new Map();
  let n = 0;
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      if (x >= ix - 1 && x < ix + iw + 1 && y >= iy - 1 && y < iy + ih + 1) continue;
      const i = (y * W + x) * 3;
      const key = (px[i] >> 3) * 1024 + (px[i + 1] >> 3) * 32 + (px[i + 2] >> 3);
      let e = ring.get(key);
      if (!e) ring.set(key, (e = { n: 0, r: 0, g: 0, b: 0 }));
      e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2]; n++;
    }
  }
  if (!n) return null;
  let sur = null;
  for (const e of ring.values()) if (!sur || e.n > sur.n) sur = e;
  const s = { r: sur.r / sur.n, g: sur.g / sur.n, b: sur.b / sur.n };
  const sl = relLum(s.r, s.g, s.b);
  let best = null, bestR = -1;
  for (const b of inside) {
    const c = contrast(relLum(b.r, b.g, b.b), sl);
    if (c > bestR) { bestR = c; best = b; }
  }
  return { ratio: bestR, plate: s, ink: best };
}

/**
 * INK BY ABLATION: contrast between the pixels a mark ADDS and the pixels underneath it.
 *
 * `a` is the frame with the mark, `b` the identical frame without it. A pixel whose
 * per-channel step exceeds `DELTA` is the mark; everything else in the box is the plate.
 * Returns `null` when nothing moved — which is itself the answer to "is the icon drawn
 * but invisible", the failure no screenshot can show because there is nothing to see.
 */
const DELTA = 12;
function ablationRatio(a, b, r) {
  const W = a.info.width, H = a.info.height;
  const [x0, y0, w, h] = clamp(W, H, r.x, r.y, r.w, r.h);
  let ink = { r: 0, g: 0, b: 0, n: 0 };
  let plate = { r: 0, g: 0, b: 0, n: 0 };
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 3;
      const moved = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2])) > DELTA;
      const t = moved ? ink : plate;
      t.r += a.data[i]; t.g += a.data[i + 1]; t.b += a.data[i + 2]; t.n++;
      if (moved) { plate.r += b.data[i]; plate.g += b.data[i + 1]; plate.b += b.data[i + 2]; plate.n++; }
    }
  }
  if (ink.n === 0 || plate.n === 0) return null;
  const il = relLum(ink.r / ink.n, ink.g / ink.n, ink.b / ink.n);
  const pl = relLum(plate.r / plate.n, plate.g / plate.n, plate.b / plate.n);
  return { ratio: contrast(il, pl), inkFrac: ink.n / (w * h) };
}

/**
 * IS THE READY RING ACTUALLY ON SCREEN? — pixels in the 6px annulus outside a slot's box.
 *
 * 🚨 THIS ROW EXISTS BECAUSE EVERY OTHER ROW WAS GREEN WHILE THE RING WAS MISSING.
 * `.hud-item-slot.is-ready` puts readiness in a spread `box-shadow`, and the first cut
 * reused the weapon tray's `hud-weapon-ready-flash` keyframes — which animate the whole
 * `box-shadow` property and whose 100% frame is the TRAY's shadow. A running animation
 * beats a normal declaration, so for 350ms after an item became usable the ring was
 * deleted by the flash announcing it. Contrast rows could not see it (the ink border
 * underneath carries the 3.0 floor), the DOM could not see it (`is-ready` was correctly
 * set), and only the PNG showed it.
 *
 * So this is sampled TWICE — mid-flash and settled — because "present when settled" was
 * true the whole time the bug existed.
 */
const AMBER = { r: 244, g: 163, b: 0 };
function readyRing(px, W, H, box, band = 6) {
  const [ox, oy, ow, oh] = clamp(W, H, box.x - band, box.y - band, box.w + band * 2, box.h + band * 2);
  const [ix, iy, iw, ih] = clamp(W, H, box.x, box.y, box.w, box.h);
  let amber = 0, n = 0;
  for (let y = oy; y < oy + oh; y++) {
    for (let x = ox; x < ox + ow; x++) {
      if (x >= ix && x < ix + iw && y >= iy && y < iy + ih) continue;
      const i = (y * W + x) * 3;
      n++;
      if (Math.abs(px[i] - AMBER.r) < 42 && Math.abs(px[i + 1] - AMBER.g) < 42 && px[i + 2] < 90) amber++;
    }
  }
  return { amber, n, frac: n ? amber / n : 0 };
}

/* ── the plants ──────────────────────────────────────────────────────────── */

const VIEWPORTS = [
  { name: 'land-844', w: 844, h: 390, touch: true },
  { name: 'land-667', w: 667, h: 375, touch: true },
  { name: 'land-932', w: 932, h: 430, touch: true },
  { name: 'port-390', w: 390, h: 844, touch: true },
  { name: 'desk-1280', w: 1280, h: 800, touch: false },
];

/**
 * Landmarks the cluster must never sit on. `.tch-hint--*` are in `game/touch.ts`'s own
 * layer and are the reason this list is not just `hud_accept`'s: the two files style
 * that corner independently and nothing but a check couples them.
 */
const LANDMARKS = [
  '.hud-weapons', '.hud-radar', '.hud-topbar', '.hud-mute', '.hud-clock',
  '.tch-hint--aim', '.tch-hint--move',
];

const KNOWN_BAD_CSS = `
  /* D: ink on its own plate — the pause-chip bug, invisible to the DOM. */
  .hud-item-glyph .fa-ic { stroke: #EFEAF7 !important; }
  .hud-item-glyph .fa-ic * { fill: #EFEAF7 !important; stroke: #EFEAF7 !important; }
  .hud-item-badge { background: #FFF3DE !important; border-color: #FFF3DE !important; color: #FFF3DE !important; }
  .hud-item-slot.is-empty { border-color: #241a30 !important; }
  /* D2: the ring the flash used to delete. Reinstating the real defect — the tray's
     keyframes, which animate the whole box-shadow property — is the honest known-bad,
     and it must turn the mid-flash row red while the settled row stays green, because
     that asymmetry IS the bug. */
  .hud-item-slot.is-flash { animation: hud-weapon-ready-flash 0.35s ease-out !important; }
  /* B: THE LAYOUT THIS PASS ACTUALLY REJECTED — a ROW directly above the weapon
     cluster in the landscape corner, which is where anyone would put it and which
     up_item_probe.mjs showed lands on the radar (19px of free band at 844x390).
     Reinstating the real rejected design is a stronger known-bad than an invented one:
     if B stays green here, B could not have caught the thing that was almost shipped. */
  html.fa-touch-capable .hud-items { right: calc(var(--fa-safe-r, 0px) + 12px) !important;
    bottom: calc(var(--fa-safe-b, 0px) + 144px) !important; flex-direction: row !important; }
  /* C: under the touch floor. */
  .hud-item-slot { width: 30px !important; height: 30px !important; }
`;

const overlap = (p, q) => p && q && p.w > 0 && p.h > 0 && q.w > 0 && q.h > 0
  && p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;

/**
 * 🚨 `hasTouch` / `isMobile`, NOT A FORCED CLASS — AND THE FIRST CUT OF THIS TOOL GOT IT
 * WRONG IN THE MOST INSTRUCTIVE WAY.
 *
 * It opened a plain page and added `fa-touch-capable` by hand. That is enough for the
 * HUD's own CSS, and it is NOT enough for `game/touch.ts`: `isTouchCapable()` reads
 * `navigator.maxTouchPoints`, a desktop Chromium reports 0, so `createTouchControls`
 * installed NOTHING — no `.tch-root`, no hints, no listeners. `.tch-hint--aim` and
 * `.tch-hint--move` were therefore `null` in every landmark read, `overlap(null, …)` is
 * `false`, and section B reported "the cluster overlaps no landmark" while checking the
 * two landmarks it was written for **against nothing**. A green from a checker is
 * evidence about that checker's question and nothing else — here it was not even asking.
 *
 * `isMobile: true` is what makes `(pointer: coarse)` match, which is what `isPrimaryCoarse`
 * reads and what puts the hints on screen at all. `lu_land.mjs` opens its context the
 * same way, for the same reason.
 */
async function open(browser, vp, query, { notch = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1,
    hasTouch: vp.touch, isMobile: vp.touch,
  });
  const page = await ctx.newPage();
  page.__ctx = ctx;
  if (notch === 'all') {
    await page.addInitScript(() => {
      const s = document.createElement('style');
      s.textContent = ':root{--fa-safe-t:44px;--fa-safe-b:34px;--fa-safe-l:47px;--fa-safe-r:47px;}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    });
  } else if (notch) {
    // ⚠️ THE NOTCH GOES WHERE THE DEVICE PUTS IT, AND THE FIRST CUT PUT IT EVERYWHERE.
    // A phone's cutout is on ONE physical edge; rotating the phone moves it from the top
    // to a side. Injecting 47px on all four edges at once is not a conservative test, it
    // is a device that does not exist — and it manufactured a portrait failure by pulling
    // `game/touch.ts`'s resting hints (left/right: safe + 17%) 47px inboard into a
    // centred control that clears them on every real handset. `lu_land.mjs` row E makes
    // the same distinction in words: *"a landscape phone puts its notch on a SIDE"*.
    // The pathological all-edges case is still measured, below, as an informational row.
    const land = vp.w > vp.h;
    const css = land
      ? ':root{--fa-safe-t:0px;--fa-safe-b:21px;--fa-safe-l:47px;--fa-safe-r:47px;}'
      : ':root{--fa-safe-t:44px;--fa-safe-b:34px;--fa-safe-l:0px;--fa-safe-r:0px;}';
    await page.addInitScript((text) => {
      const s = document.createElement('style');
      s.textContent = text;
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    }, css);
  }
  // `pointerLock=0` — without it the match screen paints its "Capture mouse" prompt
  // across the middle of the frame, which is in front of the cluster in portrait.
  await page.goto(`${BASE}/?screen=match&pointerLock=0&${query}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  if (vp.touch) {
    // `isMobile` already gets `fa-touch-capable` (layout: thumbs occlude the corners
    // from the first frame). `fa-touch` is INTERACTION — the HUD's one opt-in to pointer
    // events — and `game/touch.ts` sets it only on a real finger, which a probe that
    // never touches will not produce. Forced, and only that one.
    await page.evaluate(() => document.documentElement.classList.add('fa-touch'));
  }
  if (KNOWN_BAD) await page.addStyleTag({ content: KNOWN_BAD_CSS });
  return page;
}
const shut = async (page) => { const c = page.__ctx; await page.close(); if (c) await c.close(); };

/** Wait until the sim is actually fighting — `is-ready` cannot exist before that,
 *  because `itemUsable`'s first gate is `phase === 'playing'`. */
async function waitPlaying(page) {
  await page.waitForFunction('window.__matchDebug && window.__matchDebug.phase === "playing"',
    null, { timeout: 60000 });
  await page.waitForTimeout(250);
}

const readSlots = (page) => page.evaluate(() => {
  const box = (n) => { const b = n.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height }; };
  return [...document.querySelectorAll('.hud-item-slot')].map((n) => ({
    cls: n.className,
    badge: n.querySelector('.hud-item-badge')?.textContent ?? '',
    key: getComputedStyle(n.querySelector('.hud-item-key')).display !== 'none'
      ? n.querySelector('.hud-item-key').textContent : null,
    hasGlyph: !!n.querySelector('.hud-item-glyph .fa-ic'),
    pointer: getComputedStyle(n).pointerEvents,
    box: box(n),
    glyph: n.querySelector('.hud-item-glyph .fa-ic') ? box(n.querySelector('.hud-item-glyph')) : null,
    badgeBox: (n.querySelector('.hud-item-badge').textContent ?? '') !== ''
      ? box(n.querySelector('.hud-item-badge')) : null,
  }));
});

const readBoxes = (page, sels) => page.evaluate((ss) => {
  const out = {};
  for (const s of ss) {
    const n = document.querySelector(s);
    if (!n) { out[s] = null; continue; }
    const b = n.getBoundingClientRect();
    out[s] = { x: b.x, y: b.y, w: b.width, h: b.height };
  }
  return out;
}, sels);

/* ── the run ─────────────────────────────────────────────────────────────── */

const results = [];
const ok = (section, name, pass, detail) => {
  results.push({ section, name, pass: !!pass, detail });
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${section}. ${name}${detail ? `  — ${detail}` : ''}`);
};
/** ⚠️ Assert a set is NON-EMPTY before quantifying over it. `[].every()` is true. */
const nonEmpty = (section, name, arr) => {
  const has = Array.isArray(arr) && arr.length > 0;
  if (!has) ok(section, `${name} — SET IS EMPTY, the assertion below would be vacuous`, false, '0 members');
  return has;
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const VP = VIEWPORTS[0];

// ── A. STATES ──────────────────────────────────────────────────────────────
console.log('\nA. STATES — each one reached by planting the situation, never the class');
{
  // A1 a PASSIVE offers no press and says so.
  let page = await open(browser, VP, 'seats=6&player=hamburger&items=tenderiser');
  await waitPlaying(page);
  let s = await readSlots(page);
  if (nonEmpty('A', 'a loadout produces slots', s)) {
    ok('A', 'ITEM_SLOTS buttons are built', s.length === 2, `${s.length} slots`);
    ok('A', 'a passive reads AUTO, never ready', s[0].cls.includes('is-auto')
      && !s[0].cls.includes('is-ready') && s[0].badge === 'AUTO', `${s[0].cls} badge="${s[0].badge}"`);
    ok('A', 'a passive shows no key cap — there is no key that works', s[0].key === null, String(s[0].key));
    ok('A', 'a passive takes no pointer events', s[0].pointer === 'none', s[0].pointer);
    ok('A', 'the unfilled slot reads EMPTY, with no glyph', s[1].cls.includes('is-empty')
      && s[1].badge === 'EMPTY' && !s[1].hasGlyph, `${s[1].cls} badge="${s[1].badge}"`);
  }
  await shut(page);

  // A2 an ACTIVE item goes ready once the match is actually playing.
  //
  // ⚠️ ON THE DESKTOP VIEWPORT, AND THE FIRST CUT OF THIS ROW WAS POINTED AT A PHONE.
  // It asserted "a ready slot shows its key cap" at 844x390 with `fa-touch-capable` on —
  // where `html.fa-touch-capable .hud-item-key { display: none }` is CORRECT, because a
  // legend for a key that does not exist is a small lie about how the game is played. So
  // the row failed on working behaviour. Where a control is drawn is as much a property
  // of the viewport as of the CSS, and a probe has to be aimed at the one that has a
  // keyboard.
  page = await open(browser, VIEWPORTS[4], 'seats=6&player=hamburger&items=springform,warm_milk');
  s = await readSlots(page);
  const beforePlay = s.map((r) => r.badge);
  await waitPlaying(page);
  s = await readSlots(page);
  if (nonEmpty('A', 'active loadout produces slots', s)) {
    ok('A', 'before the bell an active item is NOT ready and says WAIT',
      beforePlay.every((b) => b === 'WAIT'), JSON.stringify(beforePlay));
    ok('A', 'once playing both active slots are ready and carry no badge',
      s.every((r) => r.cls.includes('is-ready') && r.badge === ''),
      s.map((r) => `${r.badge}|${r.cls.includes('is-ready')}`).join(' '));
    ok('A', 'a ready slot shows its key cap', s[0].key === 'Q' && s[1].key === 'E',
      `${s[0].key} ${s[1].key}`);
    ok('A', 'a ready slot draws its glyph', s.every((r) => r.hasGlyph), '');
  }
  await shut(page);

  // A3 `minAlive`. THE SIX-SEAT ROW: Disposal is unavailable below three alive by Uri's
  // own rule, so two seats and six seats must DISAGREE here. A control built at N=2
  // would call this correct in both.
  const two = await open(browser, VP, 'player=hamburger&enemy=taco&items=disposal');
  await waitPlaying(two);
  const s2 = await readSlots(two);
  await shut(two);
  const six = await open(browser, VP, 'seats=6&player=hamburger&items=disposal');
  await waitPlaying(six);
  const s6 = await readSlots(six);
  await shut(six);
  if (nonEmpty('A', 'minAlive slots', s2) && nonEmpty('A', 'minAlive slots at six', s6)) {
    ok('A', 'Disposal at TWO seats is blocked and names the crowd it needs',
      s2[0].cls.includes('is-blocked') && s2[0].badge === 'NEED 3',
      `${s2[0].cls} badge="${s2[0].badge}"`);
    ok('A', 'Disposal at SIX seats is ready', s6[0].cls.includes('is-ready') && s6[0].badge === '',
      `${s6[0].cls} badge="${s6[0].badge}"`);
    ok('A', 'the two seat counts DISAGREE — this row cannot pass vacuously at N=2',
      s2[0].cls !== s6[0].cls, `${s2[0].badge || 'ready'} vs ${s6[0].badge || 'ready'}`);
  }
}

// ── F. AGREEMENT ───────────────────────────────────────────────────────────
console.log('\nF. AGREEMENT — the badge and the ready ring never contradict each other');
{
  const seen = [];
  for (const q of ['items=tenderiser', 'items=springform,warm_milk', 'items=disposal',
    'seats=6&items=disposal,blue_cheese', 'seats=6&items=shiitake,leftovers']) {
    const page = await open(browser, VP, `player=hamburger&${q}`);
    await waitPlaying(page);
    seen.push(...(await readSlots(page)));
    await shut(page);
  }
  if (nonEmpty('F', 'sampled slots', seen)) {
    const ready = seen.filter((r) => r.cls.includes('is-ready'));
    const notReady = seen.filter((r) => !r.cls.includes('is-ready'));
    if (nonEmpty('F', 'ready slots', ready) && nonEmpty('F', 'not-ready slots', notReady)) {
      ok('F', 'every READY slot carries no badge', ready.every((r) => r.badge === ''),
        `${ready.length} ready`);
      ok('F', 'every NOT-READY slot carries a reason', notReady.every((r) => r.badge !== ''),
        `${notReady.length} not ready: ${[...new Set(notReady.map((r) => r.badge))].join(', ')}`);
      ok('F', 'no slot is both ready and empty/auto/blocked/cooling',
        ready.every((r) => !/is-(empty|auto|blocked|cooling|winding)/.test(r.cls)), '');
    }
    ok('F', 'both a passive and an active were sampled — the arms differ',
      seen.some((r) => r.cls.includes('is-auto')) && seen.some((r) => r.cls.includes('is-ready')), '');
  }
}

// ── B/C. GEOMETRY AND REACH ────────────────────────────────────────────────
console.log('\nB. GEOMETRY / C. REACH — five viewports, a real loadout, a notch injected');
{
  let anySlot = 0;
  for (const vp of VIEWPORTS) {
    const page = await open(browser, vp, 'seats=6&player=hamburger&items=disposal,springform',
      { notch: true });
    await waitPlaying(page);
    const slots = await readSlots(page);
    const boxes = await readBoxes(page, [...LANDMARKS, '.hud-items']);
    const insets = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
      return { t: px('--fa-safe-t'), b: px('--fa-safe-b'), l: px('--fa-safe-l'), r: px('--fa-safe-r'),
        W: innerWidth, H: innerHeight };
    });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.name}${KNOWN_BAD ? '-kb' : ''}.png` });
    await shut(page);

    if (!nonEmpty('B', `${vp.name} slots`, slots)) continue;
    anySlot += slots.length;
    const cluster = boxes['.hud-items'];
    // 🚨 THE SET IS ASSERTED PRESENT BEFORE IT IS QUANTIFIED OVER. `overlap(x, null)` is
    // false, so a landmark that is not in the DOM makes its row pass by having nothing
    // to check — which is exactly what happened while this tool opened a plain page and
    // `game/touch.ts` installed no hints at all. The list is named, not counted, because
    // a count going green on the wrong five is the same failure one layer up.
    const present = LANDMARKS.filter((sel) => boxes[sel] && boxes[sel].w > 0);
    const missing = LANDMARKS.filter((sel) => !present.includes(sel));
    const expected = vp.touch ? LANDMARKS : LANDMARKS.filter((s) => !s.startsWith('.tch-'));
    ok('B', `${vp.name}: every landmark this row checks is ACTUALLY IN THE DOM`,
      expected.every((s) => present.includes(s)),
      `present ${present.length}/${expected.length}${missing.length ? ` · missing ${missing.join(', ')}` : ''}`);
    const hit = present.filter((sel) => overlap(cluster, boxes[sel]));
    ok('B', `${vp.name}: the cluster overlaps no landmark`, hit.length === 0,
      hit.length ? `hits ${hit.join(', ')}` : `clear of ${present.length}: ${present.join(' ')}`);
    ok('C', `${vp.name}: every button clears the 44px touch floor`,
      slots.every((r) => r.box.w >= 44 && r.box.h >= 44),
      slots.map((r) => `${Math.round(r.box.w)}x${Math.round(r.box.h)}`).join(' '));
    ok('C', `${vp.name}: every button is inside the safe-area insets`,
      slots.every((r) => r.box.x >= insets.l - 0.5 && r.box.y >= insets.t - 0.5
        && r.box.x + r.box.w <= insets.W - insets.r + 0.5
        && r.box.y + r.box.h <= insets.H - insets.b + 0.5),
      `insets t${insets.t} b${insets.b} l${insets.l} r${insets.r}`);
  }
  ok('B', 'slots were measured at every viewport', anySlot === VIEWPORTS.length * 2, `${anySlot} boxes`);

  // ── INFORMATIONAL: the device that does not exist ─────────────────────────
  // 47px on ALL FOUR edges at once. No handset does this, which is why it is not a
  // gate — but it is the case that caught the portrait geometry when this tool injected
  // it by mistake, and the number is worth watching move: in portrait it drags
  // `game/touch.ts`'s two resting hints 47px inboard each, into a bottom-CENTRE control.
  // Both hints are `pointer-events: none` and are gone for good after the first touch in
  // their own zone (`lu_land` rows B/H make exactly that argument), so the consequence is
  // a clipped ring for the opening seconds, not a control anyone can lose.
  for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
    const page = await open(browser, vp, 'seats=6&player=hamburger&items=disposal,springform',
      { notch: 'all' });
    await waitPlaying(page);
    const boxes = await readBoxes(page, [...LANDMARKS, '.hud-items']);
    await shut(page);
    const hit = LANDMARKS.filter((sel) => boxes[sel] && overlap(boxes['.hud-items'], boxes[sel]));
    console.log(`  i    B. ${vp.name} with a 47px notch on all four edges: ${
      hit.length ? `overlaps ${hit.join(', ')}` : 'still clear'} — informational, see the note`);
  }
}

// ── D. CONTRAST ────────────────────────────────────────────────────────────
console.log('\nD. CONTRAST — WCAG 2.1 SC 1.4.11, floor 3.0, against the pixels behind');
{
  // Two loadouts so every mark this cluster can draw is on screen at once: a ready
  // active (amber ring, glyph, key cap), an AUTO passive (glyph, word badge), an EMPTY
  // socket (dashed rim), and a blocked one (dim glyph + NEED 3).
  const cases = [
    { q: 'seats=6&player=hamburger&items=springform', label: 'ready+empty' },
    { q: 'player=hamburger&enemy=taco&items=disposal,tenderiser', label: 'blocked+auto' },
  ];
  const rows = [];
  for (const c of cases) {
    const page = await open(browser, VP, c.q);
    await waitPlaying(page);
    const slots = await readSlots(page);
    // Two frames of the SAME settled screen, identical but for the glyphs being hidden.
    // 🚨 THE GLYPH ROW IS AN ABLATION, NOT A HISTOGRAM, AND THE HISTOGRAM WAS WRONG.
    // The first cut binned colours inside the glyph box and required an 8% share; a
    // thin-stroke mallet at 26px, spread across bins by antialiasing, never reaches it,
    // so `tenderiser` scored **1.00:1** — "there is only one colour here" — on a glyph
    // that is plainly visible in tools/tmp/up_shots/crop-blocked.png. That is the
    // instrument, not the icon. `docs/AGENT-BRIEF.md` §4.2: ablate, and require the
    // frame to MOVE. Ink is now the pixels that CHANGED when the glyph was removed, and
    // the plate is what was underneath — which is the pair a viewer actually resolves.
    const before = await page.screenshot();
    await page.addStyleTag({ content: '.hud-item-glyph .fa-ic { visibility: hidden !important; }' });
    await page.waitForTimeout(120);
    const after = await page.screenshot();
    if (SHOTS) writeFileSync(`${SHOTS}/contrast-${c.label}${KNOWN_BAD ? '-kb' : ''}.png`, before);
    await shut(page);
    const A = await sharp(before).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = await sharp(after).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = A;
    if (!nonEmpty('D', `${c.label} slots`, slots)) continue;
    slots.forEach((r, i) => {
      // The PLATE against the arena: is the button itself visible at all?
      const plate = markRatio(data, info.width, info.height, r.box, 'solid', 8);
      if (plate) rows.push({ label: `${c.label}[${i}] plate vs arena`, ratio: plate.ratio, cls: r.cls });
      // The GLYPH against its own plate, by ablation.
      if (r.glyph) {
        const g = ablationRatio(A, B, r.glyph);
        if (g) rows.push({ label: `${c.label}[${i}] glyph on plate (ink ${(g.inkFrac * 100).toFixed(1)}%)`,
          ratio: g.ratio, cls: r.cls, inkFrac: g.inkFrac });
      }
      // The BADGE — a word or a number, on its own dark pill.
      if (r.badgeBox) {
        const b = markRatio(data, info.width, info.height, r.badgeBox, 'ink');
        if (b) rows.push({ label: `${c.label}[${i}] badge "${r.badge}"`, ratio: b.ratio, cls: r.cls });
      }
    });
  }
  if (nonEmpty('D', 'measured marks', rows)) {
    for (const r of rows) {
      ok('D', `${r.label}`, r.ratio >= MARK_FLOOR, `${r.ratio.toFixed(2)}:1`);
    }
    // An ablation that moves NOTHING scores a perfect ratio on an empty set. Every glyph
    // row has to have found real ink first.
    const glyphs = rows.filter((r) => r.inkFrac !== undefined);
    if (nonEmpty('D', 'ablated glyphs', glyphs)) {
      ok('D', 'every glyph actually DREW something — the ablation moved the frame',
        glyphs.every((r) => r.inkFrac >= 0.03),
        glyphs.map((r) => `${(r.inkFrac * 100).toFixed(1)}%`).join(' '));
    }
    ok('D', 'a glyph, a badge and a plate were all sampled — no arm is missing',
      rows.some((r) => /glyph/.test(r.label)) && rows.some((r) => /badge/.test(r.label))
      && rows.some((r) => /plate/.test(r.label)), `${rows.length} marks`);
  }

  // ── D2. THE READY RING, MID-FLASH AND SETTLED ────────────────────────────
  {
    const page = await open(browser, VP, 'seats=6&player=hamburger&items=springform,warm_milk');
    // `waitPlaying` already burns 250ms of the 350ms flash, so shoot immediately for the
    // mid-flash frame and again well after it for the settled one.
    await waitPlaying(page);
    const slotsNow = await readSlots(page);
    const mid = await page.screenshot();
    await page.waitForTimeout(900);
    const settled = await page.screenshot();
    await shut(page);
    const M = await sharp(mid).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const S = await sharp(settled).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const ready = slotsNow.filter((r) => r.cls.includes('is-ready'));
    if (nonEmpty('D', 'ready slots for the ring row', ready)) {
      for (const [when, img] of [['mid-flash', M], ['settled', S]]) {
        const rings = ready.map((r) => readyRing(img.data, img.info.width, img.info.height, r.box));
        ok('D', `the READY ring is on screen ${when}`,
          rings.every((g) => g.frac >= 0.05),
          rings.map((g) => `${(g.frac * 100).toFixed(1)}% amber of ${g.n}px`).join(' · '));
      }
    }
  }

  // ── D3. THE SAME QUESTION, ASKED OF THE WEAPON TRAY ──────────────────────
  // ⚠️ INFORMATIONAL, AND IT IS HERE BECAUSE THE ITEM BUTTON'S 2.31:1 WAS NOT A BUG
  // UNIQUE TO THE ITEM BUTTON. `.hud-weapon-slot.is-selected` does the thing that caused
  // it — REPLACES the ink border with #F4A300 rather than adding a ring outside it — so
  // the armed weapon's plate is separated from the arena by amber alone in exactly the
  // state it most needs to be seen. This measures it rather than asserting it: the tray
  // is a shipped, critic-scored control and re-keying it on a hunch would spend somebody
  // else's measurement. If the number is low, it is a routed finding, not a drive-by fix.
  {
    const page = await open(browser, VP, 'seats=6&player=hamburger&items=springform');
    await waitPlaying(page);
    await page.waitForTimeout(900);
    const box = await page.evaluate(() => {
      const n = document.querySelector('.hud-weapon-slot.is-selected');
      if (!n) return null;
      const b = n.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const buf = await page.screenshot();
    await shut(page);
    if (!box) { console.log('  i    D. no selected weapon slot on screen — row skipped'); }
    else {
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const m = markRatio(data, info.width, info.height, box, 'solid', 8);
      console.log(`  i    D. .hud-weapon-slot.is-selected plate vs arena: ${
        m ? m.ratio.toFixed(2) : 'n/a'}:1 (floor 3.0) — informational, see the note`);
    }
  }
}

// ── E. UNCHANGED ───────────────────────────────────────────────────────────
console.log('\nE. UNCHANGED — with no loadout, nothing in this pass has a box');
{
  for (const vp of [VIEWPORTS[0], VIEWPORTS[3]]) {
    const page = await open(browser, vp, 'seats=6&player=hamburger');
    await waitPlaying(page);
    const slots = await readSlots(page);
    const st = await page.evaluate(() => {
      const items = document.querySelector('.hud-items');
      const hint = document.querySelector('.tch-hint--aim');
      const spect = document.querySelector('.hud-spectate');
      return {
        display: items ? getComputedStyle(items).display : 'MISSING',
        box: items ? items.getBoundingClientRect().width * items.getBoundingClientRect().height : -1,
        flag: document.documentElement.classList.contains('fa-items'),
        hintRight: hint ? getComputedStyle(hint).right : null,
        spectBottom: spect ? getComputedStyle(spect).bottom : null,
      };
    });
    await shut(page);
    ok('E', `${vp.name}: no item buttons exist`, slots.length === 0, `${slots.length} slots`);
    ok('E', `${vp.name}: the cluster has no box`, st.display === 'none' && st.box === 0, st.display);
    ok('E', `${vp.name}: the html.fa-items flag is off`, st.flag === false, String(st.flag));
    if (vp.touch && vp.h < vp.w) {
      ok('E', `${vp.name}: the aim hint is still at its pre-pass 194px`,
        st.hintRight === '194px', String(st.hintRight));
    }
  }
  // ...and WITH a loadout the two coupled offsets both move, which is what makes the
  // row above a measurement rather than a tautology.
  const page = await open(browser, VIEWPORTS[0], 'seats=6&player=hamburger&items=springform');
  await waitPlaying(page);
  const withItems = await page.evaluate(() => ({
    flag: document.documentElement.classList.contains('fa-items'),
    hintRight: getComputedStyle(document.querySelector('.tch-hint--aim')).right,
  }));
  await shut(page);
  ok('E', 'CONTROL: with a loadout the flag is on and the hint has stepped aside',
    withItems.flag === true && withItems.hintRight === '260px',
    `flag=${withItems.flag} hint=${withItems.hintRight}`);
}

await browser.close();

/* ── verdict ─────────────────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.pass);
const bySection = (s) => results.filter((r) => r.section === s);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);

if (KNOWN_BAD) {
  // Each plant targets one section; that section MUST go red or its assertions are
  // comments with a tick next to them.
  let tautology = 0;
  for (const s of ['B', 'C', 'D']) {
    const red = bySection(s).some((r) => !r.pass);
    console.log(`  known-bad: section ${s} ${red ? 'went RED (good)' : 'STAYED GREEN — TAUTOLOGY'}`);
    if (!red) tautology++;
  }
  process.exit(tautology === 0 ? 0 : 1);
}
process.exit(failed.length === 0 ? 0 : 1);
