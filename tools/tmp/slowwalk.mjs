#!/usr/bin/env node
/**
 * THROWAWAY: walk the player INTO the grease puddle and keep them walking while
 * screenshotting, so the distance-cadenced puddle splash (`vfx.ts`'s
 * `spawnPuddleSplash`) is actually alive in the captured frame. The existing
 * `puddleprobe.mjs` stops the moment the sim reports `terrainSlowFactor < 1`, which
 * is exactly when the splash stops firing.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = 'http://localhost:5173';
const OUT = process.argv[2] ?? 'shots/fix/slowwalk';
const TARGET = { x: 560, y: 900 };

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 730 } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(`${BASE}/?simSpeed=5&player=hamburger&enemy=donut`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });

    const held = new Set();
    const setKeys = async (want) => {
      for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    };

    let last = null, stuck = 0;
    for (let i = 0; i < 400; i++) {
      const st = await page.evaluate(() => window.__vfxDebugFighters?.player ?? null);
      if (!st) break;
      if (i % 40 === 0) console.log('at', st.x.toFixed(0), st.y.toFixed(0), st.terrainSlowFactor);
      if (st.terrainSlowFactor < 1) { console.log('entered puddle at', st.x.toFixed(0), st.y.toFixed(0)); break; }
      const dx = TARGET.x - st.x, dy = TARGET.y - st.y;
      const want = new Set();
      if (dx > 12) want.add('KeyD'); else if (dx < -12) want.add('KeyA');
      if (dy > 12) want.add('KeyS'); else if (dy < -12) want.add('KeyW');
      if (last && Math.hypot(st.x - last.x, st.y - last.y) < 3) stuck++; else stuck = 0;
      last = { x: st.x, y: st.y };
      if (stuck > 4) { want.add(Math.floor(stuck / 8) % 2 === 0 ? 'KeyW' : 'KeyS'); if (stuck > 30) stuck = 0; }
      if (want.size === 0) { console.log('arrived not slowed', st.x.toFixed(0), st.y.toFixed(0)); break; }
      await setKeys(want);
      await page.waitForTimeout(80);
    }

    // Keep walking across the puddle and shoot mid-stride.
    let shot = 0;
    for (let pass = 0; pass < 14; pass++) {
      await setKeys(new Set([pass % 2 === 0 ? 'KeyD' : 'KeyA']));
      for (let i = 0; i < 2; i++) {
        await page.waitForTimeout(55);
        const st = await page.evaluate(() => ({
          slow: window.__vfxDebugFighters?.player?.terrainSlowFactor,
          splash: window.__vfxQaCounts?.puddleSplash,
        }));
        if (st.slow < 1) {
          await page.screenshot({ path: `${OUT}/w${shot++}.png` });
          if (shot >= 8) { await setKeys(new Set()); console.log('splashes', st.splash); return; }
        }
      }
    }
    await setKeys(new Set());
    console.log('done, shots:', shot);
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
