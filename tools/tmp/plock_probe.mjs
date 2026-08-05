#!/usr/bin/env node
/**
 * Pointer-lock / aim-reticle probe.
 *
 * Drives a real match through the whole capture lifecycle and captures a SEQUENCE of
 * frames, because aiming is a feel problem and a single still cannot show whether the
 * reticle tracks, clamps or lags.
 *
 * Usage: node tools/tmp/plock_probe.mjs [--mode stick|free] [--out shots/plock/stick]
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const MODE = arg('mode', 'stick');
const OUT = arg('out', `shots/plock/${MODE}`);
const W = 1280, H = 720;

await mkdir(OUT, { recursive: true });

// Headless Chromium REFUSES requestPointerLock() outright (the request rejects, the
// probe's own `06-state` line proves the fallback path handles it), so the captured
// path can only be exercised in a real window.
const browser = await chromium.launch({
  headless: !args.includes('--headed'),
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
  ],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

// Other agents are saving into this repo live; every save full-reloads the page and
// would wipe the lock state mid-run.
await page.route('**/@vite/client*', (r) => r.fulfill({
  status: 200,
  contentType: 'text/javascript',
  body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
}));

const url = `${BASE}/?player=hamburger&enemy=donut&pointerLock=sim${MODE === 'free' ? '&aimMode=free' : ''}`;
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(400);

const probe = () => page.evaluate(() => {
  const vis = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display === 'none' || r.width === 0 ? null : { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  };
  const stick = document.querySelector('.hud-aim-stick');
  return {
    locked: document.pointerLockElement?.tagName ?? null,
    bar: vis('.plk-bar'),
    toast: vis('.plk-toast'),
    scrim: !!document.querySelector('.plk-root.is-lost'),
    reticle: vis('.hud-aim-reticle'),
    stickW: stick && getComputedStyle(stick).display !== 'none' ? Math.round(parseFloat(stick.style.width)) : null,
    sheetOpen: !!document.querySelector('.match-sheet.is-open'),
    dbg: window.__plockDebug ?? null,
  };
});

const log = [];
/** Reticle centres for every frame written, consumed by
 *  `tools/tmp/reticle_contrast.mjs` — the objective acceptance test. Recorded here
 *  rather than re-derived, because the reticle's position depends on the player's
 *  projected screen point and is not knowable from the PNG alone. */
const centres = [];
const shoot = async (file, s) => {
  await page.screenshot({ path: `${OUT}/${file}` });
  if (s?.reticle) centres.push({ file, x: s.reticle.x, y: s.reticle.y });
};
const step = async (name, doShoot = true) => {
  const s = await probe();
  log.push([name, JSON.stringify(s)]);
  if (doShoot) await shoot(`${name}.png`, s);
};

await step('01-prompt');

// ── Engage from a real click on the capture chip ───────────────────────────
await page.click('[data-el="capture"]');
await page.waitForTimeout(300);
await step('02-captured');

// ── Drive aim in a full circle, plus movement, over several seconds ────────
// Under pointer lock the browser reports movementX/Y only, so this walks the mouse
// and lets the page accumulate the deltas exactly as a player's hand would.
await page.keyboard.down('KeyD');
let px = W / 2, py = H / 2;
const R = 260;
const FRAMES = 12;
for (let i = 0; i < FRAMES; i++) {
  const a = (i / FRAMES) * Math.PI * 2;
  const tx = W / 2 + Math.cos(a) * R;
  const ty = H / 2 + Math.sin(a) * R;
  // Several small steps per frame so the deltas look like a hand, not a teleport.
  for (let k = 1; k <= 4; k++) {
    await page.mouse.move(px + ((tx - px) * k) / 4, py + ((ty - py) * k) / 4);
  }
  px = tx; py = ty;
  await page.waitForTimeout(90);
  const s = await probe();
  log.push([`aim-${String(i).padStart(2, '0')}`, JSON.stringify(s)]);
  if (i % 3 === 0) await shoot(`03-aim-${String(i).padStart(2, '0')}.png`, s);
}
await page.keyboard.up('KeyD');
await step('04-after-sweep');

// ── Wait out the countdown so weapons actually fire ────────────────────────
await page.waitForFunction(
  () => getComputedStyle(document.querySelector('.hud-countdown')).display === 'none',
  null, { timeout: 30000 },
);

// ── Aim in four directions and FIRE ────────────────────────────────────────
// The real end-to-end assertion: if the reticle direction and the weapon's direction
// disagree, the aim pipeline is wrong no matter how good the reticle looks. Each pass
// over-travels well past the ring, which also proves the clamp holds.
const dirs = [['E', 1, 0], ['S', 0, 1], ['W', -1, 0], ['N', 0, -1]];
for (const [name, dx, dy] of dirs) {
  // Walk the cursor to the far edge in that direction, in steps, so the deltas are
  // real. 380 px of travel against a ~112 px ring is 3.4x over-travel.
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(W / 2 + dx * 380 * (k / 8), H / 2 + dy * 300 * (k / 8));
  }
  await page.waitForTimeout(120);
  const before = await probe();
  await page.mouse.down();
  await page.waitForTimeout(260);
  // The reticle does not move while the button is held, so `before` still holds its
  // centre — and this is the frame that matters most, because the muzzle cone is the
  // single worst background the cursor ever has to survive.
  await shoot(`05-fire-${name}.png`, before);
  await page.mouse.up();
  await page.waitForTimeout(120);
  log.push([`fire-${name}`, JSON.stringify({ reticle: before.reticle, stickW: before.stickW })]);
  // Return to centre so the next direction starts from a known place.
  for (let k = 8; k >= 1; k--) {
    await page.mouse.move(W / 2 + dx * 380 * (k / 8), H / 2 + dy * 300 * (k / 8));
  }
  await page.mouse.move(W / 2, H / 2);
  await page.waitForTimeout(80);
}
await step('05-overtravel');

// ── Lose the lock the way a player does ────────────────────────────────────
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await step('06-esc-lost');
const paused = await page.evaluate(() => ({
  scrim: !!document.querySelector('.plk-root.is-lost'),
  lock: document.pointerLockElement?.tagName ?? null,
}));
log.push(['06-state', JSON.stringify(paused)]);

// ── Resume by clicking the scrim ───────────────────────────────────────────
await page.click('.plk-scrim', { position: { x: 200, y: 120 } });
await page.waitForTimeout(400);
await step('07-resumed');

// ── The screen layer's own pause must still work while captured ────────────
await page.click('[data-el="pause"]', { force: true }).catch(() => {});
await page.waitForTimeout(300);
await step('08-screen-pause');

await writeFile(`${OUT}/centres.json`, JSON.stringify(centres, null, 2));

console.log('');
for (const [k, v] of log) console.log(`${k.padEnd(16)} ${v}`);
console.log(`\nerrors: ${errs.length ? errs.slice(0, 4).join(' | ') : 'none'}`);
console.log(`centres: ${centres.length} written to ${OUT}/centres.json`);
console.log(`next:    node tools/tmp/reticle_contrast.mjs ${OUT}`);
await browser.close();
