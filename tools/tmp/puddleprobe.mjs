#!/usr/bin/env node
/** Drive the player onto the grease puddle and capture the contact feedback. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = 'http://localhost:5173';
const w = 1300, h = 730;
const TARGET = { x: Number(process.argv[2] ?? 560), y: Number(process.argv[3] ?? 900) };
const OUT = process.argv[4] ?? 'shots/probe/puddle';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
    await page.goto(`${BASE}/?simSpeed=${process.env.SIMSPEED ?? 5}&player=hamburger&enemy=donut`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 30000 });

    const held = new Set();
    const setKeys = async (want) => {
      for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
      for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    };

    let slowed = false; let last = null; let stuck = 0;
    for (let i = 0; i < 400; i++) {
      const st = await page.evaluate(() => window.__vfxDebugFighters?.player ?? null);
      if (!st) break;
      const dx = TARGET.x - st.x, dy = TARGET.y - st.y;
      if (st.terrainSlowFactor < 1) { slowed = true; console.log('SLOWED at', st.x.toFixed(0), st.y.toFixed(0), 'factor', st.terrainSlowFactor, 'iter', i); break; }
      const want = new Set();
      if (dx > 12) want.add('KeyD'); else if (dx < -12) want.add('KeyA');
      if (dy > 12) want.add('KeyS'); else if (dy < -12) want.add('KeyW');
      // anti-stuck: if we barely moved for 5 ticks, sidestep
      if (last && Math.hypot(st.x - last.x, st.y - last.y) < 3) stuck++; else stuck = 0;
      last = { x: st.x, y: st.y };
      if (stuck > 4) {
        // keep pushing toward the target, but add a perpendicular slide to get around cover
        want.add(Math.floor(stuck / 8) % 2 === 0 ? 'KeyW' : 'KeyS');
        if (stuck > 30) stuck = 0;
      }
      if (want.size === 0) { console.log('arrived but not slowed at', st.x.toFixed(0), st.y.toFixed(0)); break; }
      await setKeys(want);
      await page.waitForTimeout(80);
    }
    await setKeys(new Set());
    if (!slowed) {
      const st = await page.evaluate(() => window.__vfxDebugFighters?.player ?? null);
      console.log('final', st);
    }
    const dump = await page.evaluate(() => {
      const stage = window.__stage; if (!stage) return 'no stage';
      stage.scene.updateMatrixWorld(true);
      const rows = [];
      stage.scene.traverse((o) => {
        let chain = []; let q = o.parent; while (q) { if (q.name) chain.push(q.name); q = q.parent; }
        if (chain[0] !== 'vfx_layer') return;
        if (!o.isMesh && !o.isSprite) return;
        const m = o.material;
        rows.push({ type: o.type, geo: o.geometry?.type, visible: o.visible,
          color: m?.color ? '#' + m.color.getHexString() : null, opacity: m?.opacity,
          depthTest: m?.depthTest, renderOrder: o.renderOrder,
          scale: [+o.scale.x.toFixed(2), +o.scale.y.toFixed(2)],
          pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)],
          inScene: !!o.parent });
      });
      return rows.filter((r) => r.visible);
    });
    if (process.env.GARISH) {
      const n = await page.evaluate(() => {
        const stage = window.__stage; let k = 0;
        stage.scene.traverse((o) => {
          if (!o.isSprite) return;
          const m = o.material;
          if (m?.color && '#' + m.color.getHexString() === '#5c8fb0') {
            m.color.setHex(0xff0000);
            o.scale.set(5, 5, 1);
            window.__tintSprites = window.__tintSprites || [];
            window.__tintSprites.push(o);
            k++;
          }
        });
        return k;
      });
      console.log('GARISH slowTint sprites recoloured:', n);
    }
    console.log('--- visible vfx_layer while slowed ---');
    for (const r of (Array.isArray(dump) ? dump : [])) console.log(' ', JSON.stringify(r));

    if (process.env.GARISH) {
      // re-assert every 40ms in case sync() overwrites, and record what survives
      await page.evaluate(() => {
        window.__reassert = setInterval(() => {
          for (const o of window.__tintSprites || []) { o.material.color.setHex(0xff0000); o.scale.set(5, 5, 1); o.material.opacity = 1; }
        }, 20);
      });
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => (window.__tintSprites || []).map((o) => ({
        color: '#' + o.material.color.getHexString(), op: o.material.opacity, sc: o.scale.x, vis: o.visible })));
      console.log('AFTER REASSERT:', JSON.stringify(after));
    }

    // Burst of frames while standing in it
    for (let i = 0; i < 4; i++) {
      await page.screenshot({ path: `${OUT}/p${i}.png` });
      await page.waitForTimeout(60);
    }
    const st = await page.evaluate(() => ({ f: window.__vfxDebugFighters, qa: window.__vfxQaCounts }));
    console.log(JSON.stringify(st));
  } finally { await browser.close(); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
