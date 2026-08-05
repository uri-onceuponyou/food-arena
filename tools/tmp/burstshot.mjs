#!/usr/bin/env node
/**
 * THROWAWAY: fire the GENERIC impact burst on top of the player and capture its
 * first frames, using `window.__vfxSpawnTest` (QA-only hook in `game/vfx.ts`).
 *
 * node tools/tmp/burstshot.mjs <outDir> [kind] [amount]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = 'http://localhost:5173';
const OUT = process.argv[2] ?? 'shots/fix/burst';
const KIND = process.argv[3] ?? 'impact';
const AMOUNT = Number(process.argv[4] ?? 14);
const W = 1300, H = 730;

async function freeze(page) {
  await page.evaluate(() => {
    if (!window.__origRAF) window.__origRAF = window.requestAnimationFrame.bind(window);
    window.__pendingRAF = null;
    window.requestAnimationFrame = (cb) => { window.__pendingRAF = cb; return 0; };
  });
}
async function unfreeze(page) {
  await page.evaluate(() => {
    window.requestAnimationFrame = window.__origRAF;
    if (window.__pendingRAF) { const cb = window.__pendingRAF; window.__pendingRAF = null; window.__origRAF(cb); }
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(`${BASE}/?simSpeed=0.0001&player=hotdog&enemy=donut`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });
    await page.waitForFunction(() => typeof window.__vfxSpawnTest === 'function', null, { timeout: 20000 });

    const pos = await page.evaluate(() => window.__vfxDebugFighters.player);
    console.log('player at', pos.x.toFixed(0), pos.y.toFixed(0));

    // Measured world sizes of every element the burst spawns, straight off the
    // scene graph — the number under review, not an impression of it.
    await page.evaluate(([k, a, x, y]) => window.__vfxSpawnTest(k, x, y, a), [KIND, AMOUNT, pos.x, pos.y]);
    await page.waitForTimeout(140);
    const sizes = await page.evaluate(() => {
      const rows = [];
      window.__stage.scene.traverse((o) => {
        let chain = []; let q = o.parent; while (q) { if (q.name) chain.push(q.name); q = q.parent; }
        if (chain[0] !== 'vfx_layer' || !o.visible) return;
        if (o.isSprite) rows.push({ kind: 'sprite', map: o.material.map?.uuid?.slice(0, 4), worldW: +o.scale.x.toFixed(2), worldH: +o.scale.y.toFixed(2) });
        else if (o.isMesh) {
          o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          rows.push({ kind: 'mesh', geo: o.geometry.type, worldW: +((bb.max.x - bb.min.x) * o.scale.x).toFixed(2), worldD: +((bb.max.z - bb.min.z) * o.scale.z).toFixed(2), targetScale: +o.scale.x.toFixed(2) });
        }
      });
      return rows;
    });
    console.log('CHARACTER_HEIGHT = 2.10 m');
    for (const r of sizes) console.log(' ', JSON.stringify(r));

    for (let i = 0; i < 3; i++) {
      await freeze(page);
      await page.screenshot({ path: `${OUT}/b${i}.png` });
      await unfreeze(page);
      await page.waitForTimeout(70);
    }
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
