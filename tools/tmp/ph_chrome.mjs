#!/usr/bin/env node
/**
 * ph_chrome.mjs — HOW MUCH OF THE PHONE'S SCREEN DOES THE GAME ACTUALLY GET?
 *
 * Uri, 2026-08-11: *"it's mainly the browser interfering"* — and *"force full screen
 * horizontal on game launch."* This tool turns that into a number, because nobody on
 * this project has one: every viewport figure here is a CSS pair somebody typed
 * (`844x390`), never a fraction of a real phone screen.
 *
 * ── THE BUDGET HAS THREE LOSSES AND THEY ARE INDEPENDENT ────────────────────
 *
 *   1. **Browser chrome.** Safari's URL bar, toolbar and status bar. NOT the game's
 *      fault and NOT fixable from `src/` — see the capability matrix in `docs/PHONE.md`.
 *   2. **Safe-area insets.** In landscape the Dynamic Island / notch bezel takes a
 *      column off BOTH sides, whatever the app does.
 *   3. **The game's own aspect mask.** `SUPPORTED_ASPECT` is 4:3 → 21:9
 *      (`src/render/camera.ts:164`) and `Stage.resize()` hard-masks anything outside
 *      it. In portrait that is the dominant loss by a wide margin, and it is the one
 *      loss that IS ours.
 *
 * ── WHERE THE VIEWPORT NUMBERS COME FROM ────────────────────────────────────
 * Playwright's own device descriptors, which carry BOTH the full screen in CSS px
 * (`screen`) and the visible viewport Safari actually gives a page (`viewport`) — the
 * latter measured on real hardware by the Playwright project. So the chrome cost is a
 * SOURCED constant here, not this agent's recollection. `--list` prints them.
 *
 * ⚠️ **This is Chromium emulating an iPhone's geometry, not an iPhone.** What is exact:
 * the descriptor arithmetic, and the canvas rect the game computes for a given
 * viewport (that is our own layout code, and it is deterministic). What is NOT
 * measured here: `env(safe-area-inset-*)`, which Chromium reports as 0 regardless —
 * so the landscape side-inset loss is taken from the descriptor width delta instead,
 * and flagged.
 *
 *   node tools/tmp/ph_chrome.mjs                  # the table + PNGs into shots/ph/
 *   node tools/tmp/ph_chrome.mjs --list           # just the sourced descriptors
 *   node tools/tmp/ph_chrome.mjs --scene home
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const flag = (k) => argv.includes(`--${k}`);

// Session scratchpads are cleaned; `docs/AGENT-BRIEF.md` opens with a brief that
// silently vanished from one. So the state path is durable by default and the
// scratchpad is opt-in via PH_SCRATCH.
const SCRATCH = process.env.PH_SCRATCH ?? join(tmpdir(), 'fa-ph');
const STATE = join(SCRATCH, 'ph-serve.json');
const BASE = arg('url', null) ?? process.env.PREVIEW_BASE
  ?? (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')).url : null);
if (!BASE) { console.error('ph_chrome: run `node tools/tmp/ph_serve.mjs --start` first.'); process.exit(2); }

const OUT = join(ROOT, 'shots', 'ph');
mkdirSync(OUT, { recursive: true });

const SCENES = {
  match: '/?player=hamburger&enemy=donut',
  home: '/?screen=home',
};
const SCENE = arg('scene', 'match');

/** Devices worth the table. Each pair is the SAME phone, both ways up. */
const PROFILES = [
  'iPhone 14', 'iPhone 14 landscape',
  'iPhone 15', 'iPhone 15 landscape',
  'iPhone 16 Pro', 'iPhone 16 Pro landscape',
  'iPhone 16 Pro Max', 'iPhone 16 Pro Max landscape',
  'Pixel 7', 'Pixel 7 landscape',
];

if (flag('list')) {
  console.log('\nSourced from playwright device descriptors (real-hardware measurements):\n');
  for (const n of PROFILES) {
    const d = devices[n];
    const land = / landscape$/.test(n);
    // `screen` is reported PORTRAIT-ORIENTED by iOS in both orientations, which is
    // exactly why `quality.ts:282` takes the min of width and height. Rotate it here
    // so "full screen" means "the screen as the player is holding it".
    const full = land ? { width: Math.max(d.screen.width, d.screen.height), height: Math.min(d.screen.width, d.screen.height) } : d.screen;
    const vp = d.viewport;
    console.log(`${n.padEnd(28)} screen ${String(full.width).padStart(4)}x${String(full.height).padStart(3)}  viewport ${String(vp.width).padStart(4)}x${String(vp.height).padStart(3)}  `
      + `chrome −${full.height - vp.height}px h, −${full.width - vp.width}px w  ⇒ ${((vp.width * vp.height) / (full.width * full.height) * 100).toFixed(1)}% of screen`);
  }
  process.exit(0);
}

const rows = [];
for (const name of PROFILES) {
  const d = devices[name];
  const land = / landscape$/.test(name);
  const full = land
    ? { width: Math.max(d.screen.width, d.screen.height), height: Math.min(d.screen.width, d.screen.height) }
    : { ...d.screen };

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const ctx = await browser.newContext({ ...d, screen: d.screen });
  const page = await ctx.newPage();
  await page.goto(BASE + SCENES[SCENE], { waitUntil: 'domcontentloaded' });
  const ready = SCENE === 'match' ? 'window.__gameReady === true' : 'window.__screenReady === true';
  await page.waitForFunction(ready, null, { timeout: 120_000 }).catch(() => {});
  if (SCENE === 'match') {
    await page.waitForFunction(`document.querySelector('.hud-countdown')?.style.display === 'none'`,
      null, { timeout: 40_000 }).catch(() => {});
  }
  await page.waitForTimeout(900);

  const m = await page.evaluate(`(() => {
    const cv = [...document.querySelectorAll('canvas')]
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
    const r = cv ? cv.r : null;
    const cs = getComputedStyle(document.documentElement);
    const el = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    return {
      inner: [window.innerWidth, window.innerHeight],
      screen: [window.screen.width, window.screen.height],
      dpr: window.devicePixelRatio,
      tier: (window.__quality && window.__quality.tier) || null,
      canvasCss: r ? [Math.round(r.width), Math.round(r.height)] : null,
      canvasAt: r ? [Math.round(r.x), Math.round(r.y)] : null,
      canvasBuf: cv ? [cv.c.width, cv.c.height] : null,
      safe: ['t', 'r', 'b', 'l'].map((k) => cs.getPropertyValue('--fa-safe-' + k).trim()),
      // Where the on-screen controls actually are, for the placement half of the
      // complaint. Reported, not judged — a peer owns UI placement.
      weapons: el('.hud-weapons') || el('[class*=weapon]'),
      hud: el('.hud') || el('#hud'),
    };
  })()`);

  const shot = join(OUT, `chrome-${SCENE}-${name.replace(/[ +]/g, '_')}.png`);
  await page.screenshot({ path: shot });
  await browser.close();

  const screenPx = full.width * full.height;
  const vpPx = d.viewport.width * d.viewport.height;
  const gamePx = m.canvasCss ? m.canvasCss[0] * m.canvasCss[1] : 0;
  rows.push({ name, land, full, vp: d.viewport, screenPx, vpPx, gamePx, ...m, shot });

  console.log(`\n${name}`);
  console.log(`  screen (as held)   ${full.width} x ${full.height} CSS px          = ${screenPx.toLocaleString()} px²`);
  console.log(`  Safari viewport    ${d.viewport.width} x ${d.viewport.height}  ⇒ browser chrome costs ${(100 - vpPx / screenPx * 100).toFixed(1)}% of the screen`);
  console.log(`  game canvas        ${m.canvasCss?.join(' x ')} at (${m.canvasAt?.join(',')})  buffer ${m.canvasBuf?.join('x')} px, tier ${m.tier}`);
  console.log(`  ⇒ THE GAME GETS ${(gamePx / screenPx * 100).toFixed(1)}% OF THE PHONE'S SCREEN`
    + `   (aspect mask alone costs ${(100 - gamePx / vpPx * 100).toFixed(1)}% of what Safari gave it)`);
  if (m.weapons) console.log(`  weapon selector at (${m.weapons.x},${m.weapons.y}) ${m.weapons.w}x${m.weapons.h}`
    + `  — centre-x ${((m.weapons.x + m.weapons.w / 2) / m.inner[0] * 100).toFixed(0)}%, centre-y ${((m.weapons.y + m.weapons.h / 2) / m.inner[1] * 100).toFixed(0)}% of the viewport`);
  console.log(`  safe-area vars ${JSON.stringify(m.safe)}  ⚠ Chromium reports 0 — real insets need a device`);
  console.log(`  ${shot}`);
}

writeFileSync(join(SCRATCH, `ph_chrome_${SCENE}.json`), JSON.stringify(rows, null, 2));

// ── The projection Uri's request actually asks for ──────────────────────────
console.log(`\n\n── WHAT "FULL SCREEN HORIZONTAL" WOULD BE WORTH ────────────────────────────`);
console.log(`   Projection, not a measurement: a home-screen PWA or a native wrapper removes the`);
console.log(`   BROWSER CHROME only. Safe-area insets survive both. Arithmetic per device:\n`);
for (const r of rows.filter((x) => x.land)) {
  const gainH = r.full.height - r.vp.height;
  const standaloneVp = { width: r.vp.width, height: r.full.height };
  console.log(`   ${r.name.padEnd(28)} landscape viewport ${r.vp.width}x${r.vp.height} → ${standaloneVp.width}x${standaloneVp.height}`
    + `  (+${gainH} px of height, +${(gainH / r.vp.height * 100).toFixed(0)}%)`);
}
for (const r of rows.filter((x) => !x.land)) {
  console.log(`   ${r.name.padEnd(28)} portrait  viewport ${r.vp.width}x${r.vp.height} → ${r.vp.width}x${r.full.height}`
    + `  (+${r.full.height - r.vp.height} px of height) — but the ASPECT MASK still caps the game at 4:3.`);
}
