#!/usr/bin/env node
/**
 * Is the pause chip in ONE place, and is that place free?
 *
 * `tools/tmp/thumbzone.mjs` already answers "is it in the left thumb zone", and it
 * answers it only for the touch DOM state — which is exactly how the chip ended up
 * with two different positions. `matchScreen.ts` moved it out of the bottom-left
 * corner under `html.fa-touch-capable` and left it in the corner otherwise, so the
 * game's one escape hatch lived somewhere different depending on a capability bit no
 * player can see, and a hybrid laptop (touchscreen + mouse — the case `game/input.ts`
 * is explicitly built for) got the touch layout while the player was on the mouse.
 *
 * So this asks three things thumbzone.mjs does not:
 *
 *  1. SAME PLACE. The chip's rect is identical with and without `fa-touch-capable`.
 *     That is the assertion the defect would have failed, and it is the reason this
 *     file exists rather than another line in thumbzone.
 *  2. NOTHING UNDER IT. Zero overlap with every HUD landmark — the player nameplate
 *     in particular, because the raised position sits directly below it and the
 *     nameplate's height is a clamp, so it grows with the viewport and the 96px
 *     offset does not. Reasoning about that gap is exactly what LESSONS §1 warns
 *     against; this measures it.
 *  3. REACHABLE. Fully inside the frame AND inside `env(safe-area-inset-*)`, with
 *     simulated notch insets injected the same way `menu_accept_portrait.mjs` does.
 *
 * PORTRAIT is included, because `menu_accept.mjs`'s five viewports are all landscape
 * and the chip is positioned off `--fa-safe-t`, which is the inset portrait actually
 * has.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/chip_probe.mjs --url {URL}
 */

import { chromium } from 'playwright';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const base = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';

const VIEWPORTS = [
  { name: 'phone-land-844x390', w: 844, h: 390, safe: { t: 0, r: 44, b: 21, l: 44 } },
  { name: 'tablet-1024x768', w: 1024, h: 768, safe: { t: 0, r: 0, b: 0, l: 0 } },
  { name: 'desktop-1600x900', w: 1600, h: 900, safe: { t: 0, r: 0, b: 0, l: 0 } },
  { name: 'portrait-360x800', w: 360, h: 800, safe: { t: 47, r: 0, b: 34, l: 0 } },
  { name: 'portrait-390x844', w: 390, h: 844, safe: { t: 47, r: 0, b: 34, l: 0 } },
  { name: 'portrait-430x932', w: 430, h: 932, safe: { t: 47, r: 0, b: 34, l: 0 } },
];

/** From `src/game/touch.ts` (ZONE_SPLIT) plus the reach thumbzone.mjs settled on. */
const ZONE_SPLIT = 0.5;
const THUMB_BAND = 0.45;

const LANDMARKS = [
  '.hud-fighter--player', '.hud-fighter--enemy', '.hud-clock',
  '.hud-weapons', '.hud-radar', '.hud-zone', '.match-corner',
];

let failures = 0;
const rows = [];
function record(vp, state, check, ok, detail = '') {
  rows.push({ vp, state, check, ok, detail });
  if (!ok) failures++;
}

function collect(input) {
  const { landmarks, ZONE_SPLIT, THUMB_BAND } = input;
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = de.clientHeight;
  const box = (sel) => {
    const n = document.querySelector(sel);
    if (!n) return null;
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return null;
    const r = n.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return { sel, x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  };
  const chip = box('.fa-match .match-chip');
  const others = landmarks.map(box).filter(Boolean);
  const hits = chip
    ? others
      .map((o) => ({
        sel: o.sel,
        ox: Math.min(chip.r, o.r) - Math.max(chip.x, o.x),
        oy: Math.min(chip.b, o.b) - Math.max(chip.y, o.y),
      }))
      .filter((h) => h.ox > 0.5 && h.oy > 0.5)
    : [];
  const zone = { x1: vw * ZONE_SPLIT, y0: vh * (1 - THUMB_BAND) };
  return {
    vw, vh, chip, hits,
    inZone: !!chip && chip.r > 0 && chip.x < zone.x1 && chip.b > zone.y0,
    zone,
    // The gap to the element directly above it — the number the 96px offset is
    // supposed to buy, printed so a regression is legible instead of merely failing.
    gapUnderNameplate: (() => {
      const np = others.find((o) => o.sel === '.hud-fighter--player');
      return chip && np ? Math.round(chip.y - np.b) : null;
    })(),
    others: others.map((o) => `${o.sel} ${Math.round(o.x)},${Math.round(o.y)} ${Math.round(o.w)}x${Math.round(o.h)}`),
  };
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${base}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&simSpeed=0.02`,
      { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
  } catch (err) {
    record(vp.name, '-', 'match-boots', false, String(err).split('\n')[0]);
    await page.close();
    continue;
  }
  record(vp.name, '-', 'match-boots', true, '');

  // Notch insets, injected exactly as menu_accept_portrait.mjs does — `env()` never
  // resolves in a headless Chromium, so the vars are the only way to exercise them.
  await page.evaluate((s) => {
    const st = document.documentElement.style;
    st.setProperty('--fa-safe-t', `${s.t}px`);
    st.setProperty('--fa-safe-r', `${s.r}px`);
    st.setProperty('--fa-safe-b', `${s.b}px`);
    st.setProperty('--fa-safe-l', `${s.l}px`);
  }, vp.safe);

  const seen = {};
  for (const state of ['pointer', 'touch']) {
    await page.evaluate((m) => {
      document.documentElement.classList.toggle('fa-touch-capable', m === 'touch');
      document.documentElement.classList.toggle('fa-touch', m === 'touch');
    }, state);
    await page.waitForTimeout(220);
    const out = await page.evaluate(collect, { landmarks: LANDMARKS, ZONE_SPLIT, THUMB_BAND });
    seen[state] = out;

    const c = out.chip;
    record(vp.name, state, 'chip-exists', !!c, c ? `${Math.round(c.w)}x${Math.round(c.h)} at ${Math.round(c.x)},${Math.round(c.y)}` : 'not drawn');
    if (!c) continue;
    record(vp.name, state, 'chip-inside-safe-area',
      c.x >= vp.safe.l - 1 && c.y >= vp.safe.t - 1
      && c.r <= out.vw - vp.safe.r + 1 && c.b <= out.vh - vp.safe.b + 1,
      `L${Math.round(c.x)} T${Math.round(c.y)} R${Math.round(out.vw - c.r)} B${Math.round(out.vh - c.b)} vs safe ${JSON.stringify(vp.safe)}`);
    record(vp.name, state, 'chip-tap-target>=44', c.w >= 43.5 && c.h >= 43.5,
      `${Math.round(c.w)}x${Math.round(c.h)}`);
    record(vp.name, state, 'chip-overlaps-nothing', out.hits.length === 0,
      out.hits.map((h) => `${h.sel} ${h.ox}x${h.oy}px`).join(' | ')
      + (out.gapUnderNameplate === null ? '' : `  (gap under nameplate ${out.gapUnderNameplate}px)`));
    record(vp.name, state, 'chip-clear-of-left-thumb-zone', !out.inZone,
      `zone x<${Math.round(out.zone.x1)} y>${Math.round(out.zone.y0)}`);
  }

  // THE assertion this file was written for.
  const a = seen.pointer?.chip;
  const b = seen.touch?.chip;
  record(vp.name, 'both', 'chip-is-in-the-same-place-either-way',
    !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5,
    a && b ? `pointer ${Math.round(a.x)},${Math.round(a.y)}  touch ${Math.round(b.x)},${Math.round(b.y)}` : 'missing a state');

  await page.close();
}

await browser.close();

let vp = null;
for (const r of rows) {
  if (r.vp !== vp) { vp = r.vp; console.log(`\n── ${vp} ──`); }
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.state.padEnd(8)} ${r.check.padEnd(38)} ${r.detail}`);
}
console.log(`\n${rows.length - failures}/${rows.length} checks passed`);
process.exit(failures ? 1 : 0);
