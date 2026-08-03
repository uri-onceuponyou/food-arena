#!/usr/bin/env node
import { chromium } from 'playwright';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

async function main() {
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
    page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
    await page.goto('http://localhost:5173/?simSpeed=1&player=lollipop&enemy=hamburger', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 20000 });

    await page.keyboard.down('1');
    await page.keyboard.up('1');
    await page.mouse.move(500, 325);
    await page.mouse.down();

    await page.waitForFunction(() => (window.__vfxQaCounts?.meleeArc ?? 0) > 0, null, { timeout: 30000, polling: 20 });

    for (let i = 0; i < 8; i++) {
      const info = await page.evaluate(() => {
        const vfx = window.__vfxDebugLayer;
        const wedges = vfx.wedges.map((w) => ({
          active: w.active,
          visible: w.mesh.visible,
          opacity: w.mat.opacity,
          color: w.mat.color.getHexString(),
          pos: [w.mesh.position.x, w.mesh.position.y, w.mesh.position.z],
          rotY: w.mesh.rotation.y,
          life: w.life,
          maxLife: w.maxLife,
          vertCount: w.mesh.geometry.attributes.position.count,
        }));
        const playerPos = vfx.group.parent ? null : null;
        return { wedges, counts: window.__vfxQaCounts };
      });
      console.log(i, JSON.stringify(info));
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
