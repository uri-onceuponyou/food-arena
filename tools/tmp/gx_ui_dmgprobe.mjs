#!/usr/bin/env node
/**
 * GX_UI_DMGPROBE — can the capture pipeline photograph a floating damage number at all?
 *
 * Question: nine canonical 1v1 action frames show ZERO damage numbers while HP falls
 * 132 -> 10. Is that the game (numbers not spawned / invisible), or the CAMERA (a CSS
 * animation of 0.85 s wall-clock against a multi-second SwiftShader screenshot)?
 *
 * Method — three arms per trial, same page, same pooled element, same position:
 *   A  LIVE      : arm a number exactly the way `hud.ts:spawnDamageNumber` does
 *                  (class reset, reflow, `is-playing`), then screenshot immediately.
 *   B  HELD      : same, then PAUSE its animation at 200 ms (inside the 14%-30% full-
 *                  opacity plateau) before the screenshot.  POSITIVE CONTROL: if B is not
 *                  visible, the pipeline cannot see numbers even when they are on screen,
 *                  and A's result means nothing.
 *   C  NONE      : no number armed.  NEGATIVE CONTROL for the pixel detector.
 * The detector counts pixels in a box around the spawn point whose colour is within a
 * tolerance of the `--big` fill (#FF6B5C). After each screenshot the animation's
 * currentTime and playState are read back, so a miss is explained, not inferred.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_ui_dmgprobe.mjs --url '{URL}' --out shots/rv/audit/ui/dmg
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = resolve(arg('--out', 'shots/rv/audit/ui/dmg'));
const TRIALS = Number(arg('--trials', 4));
mkdirSync(OUT, { recursive: true });
const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const W = 1600, H = 900;
const PX = { x: 800, y: 300 };     // spawn point: open floor above the player, below the top bar

async function detect(png) {
  const box = { left: PX.x - 70, top: PX.y - 90, width: 140, height: 120 };
  const { data, info } = await sharp(png).extract(box).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // #FF6B5C fill (and its anti-aliased neighbours), excluding the pink floor (~C0 60 80).
    if (r > 225 && g > 70 && g < 140 && b > 55 && b < 120) n++;
  }
  return n;
}

const out = { base: BASE, trials: [] };
if (BASE) {
  const browser = await chromium.launch({ args: LAUNCH });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript',
      body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};' }));
    await page.goto(`${BASE}/?player=donut&enemy=taco&pointerLock=0`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
    await page.waitForTimeout(1500);
    const arm = (args) => page.evaluate(({ x, y, hold }) => {
      const el = document.querySelector('.hud-dmg');
      el.style.setProperty('--x', `${x}px`);
      el.style.setProperty('--y', `${y}px`);
      el.textContent = '-15';
      el.className = 'hud-dmg hud-dmg--big';
      void el.offsetWidth;
      el.classList.add('is-playing');
      const a = el.getAnimations()[0];
      if (hold && a) { a.currentTime = 200; a.pause(); }
      window.__gxArmT = performance.now();
      return a ? { t: a.currentTime, ps: a.playState } : null;
    }, args);
    const readBack = () => page.evaluate(() => {
      const el = document.querySelector('.hud-dmg');
      const a = el.getAnimations()[0];
      return { t: a ? Math.round(Number(a.currentTime)) : null, ps: a ? a.playState : 'none',
        op: Number(getComputedStyle(el).opacity), sinceArmMs: Math.round(performance.now() - (window.__gxArmT ?? 0)) };
    });
    const disarm = () => page.evaluate(() => {
      const el = document.querySelector('.hud-dmg');
      for (const a of el.getAnimations()) a.cancel();
      el.className = 'hud-dmg';
    });
    for (let i = 0; i < TRIALS; i++) {
      for (const armName of ['A_live', 'B_held', 'C_none']) {
        await disarm();
        await page.waitForTimeout(300);
        const armed = armName === 'C_none' ? null : await arm({ ...PX, hold: armName === 'B_held' });
        const t0 = Date.now();
        const png = `${OUT}/t${i}_${armName}.png`;
        await page.screenshot({ path: png, timeout: 180_000 });
        const ms = Date.now() - t0;
        const back = await readBack();
        const px = await detect(png);
        out.trials.push({ trial: i, arm: armName, armed, screenshotMs: ms, back, numberPixels: px });
        console.log(`trial ${i} ${armName.padEnd(7)} shot ${String(ms).padStart(5)} ms  anim after: t=${back.t} ${back.ps} op=${back.op.toFixed(2)}  number pixels=${px}`);
        writeFileSync(`${OUT}/dmgprobe.json`, JSON.stringify(out, null, 2));
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
}
