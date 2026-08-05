#!/usr/bin/env node
/**
 * ACCEPTANCE TEST (objective half) for the cover-props loop.
 *
 * Builds the REAL arena inside the page (dynamic-imports `kitchen.ts` through Vite, so
 * it needs no debug hook in `preview.ts`, which this agent does not own) and reports,
 * per CoverBox kind:
 *   - the SOLID mass height (tallest mesh that is not a garnish/decal),
 *   - the full silhouette height,
 *   - footprint, and height : min-footprint aspect ratio.
 *
 * Pass = solid >= 0.94 x CHARACTER_HEIGHT (2.1m) AND aspect >= 0.40.
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto(`${BASE}/preview.html?piece=arena&shot=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const rows = await page.evaluate(async () => {
  const mod = await import('/src/arena/kitchen.ts');
  const def = mod.createKitchenArena();
  const root = def.build();
  root.updateMatrixWorld(true);

  const corners = (m) => {
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, e = m.matrixWorld.elements, pts = [];
    for (const x of [bb.min.x, bb.max.x])
      for (const y of [bb.min.y, bb.max.y])
        for (const z of [bb.min.z, bb.max.z])
          pts.push([
            e[0] * x + e[4] * y + e[8] * z + e[12],
            e[1] * x + e[5] * y + e[9] * z + e[13],
            e[2] * x + e[6] * y + e[10] * z + e[14],
          ]);
    return pts;
  };

  // Garnish / hardware that must not count toward the SOLID mass.
  const soft = /shadow|herb|leaf|chain|hanging_pan|knife|blade|bowl|rim|rolling|knob|chopped|jar|tray|handle|faucet|basket|vent|onion|tomato|lettuce|burner|coil|tie|backsplash|rack_/i;
  const out = {};
  root.traverse((o) => {
    if (!o.name || !o.name.startsWith('cover:')) return;
    const kind = o.name.slice(6);
    if (out[kind]) return;
    const acc = { sMax: -1e9, fMax: -1e9, xMin: 1e9, xMax: -1e9, zMin: 1e9, zMax: -1e9 };
    o.traverse((m) => {
      if (!m.isMesh || /shadow/i.test(m.name)) return;
      const isSoft = soft.test(m.name);
      for (const [px, py, pz] of corners(m)) {
        acc.fMax = Math.max(acc.fMax, py);
        if (!isSoft) {
          acc.sMax = Math.max(acc.sMax, py);
          acc.xMin = Math.min(acc.xMin, px); acc.xMax = Math.max(acc.xMax, px);
          acc.zMin = Math.min(acc.zMin, pz); acc.zMax = Math.max(acc.zMax, pz);
        }
      }
    });
    out[kind] = { solid: acc.sMax, full: acc.fMax, w: acc.xMax - acc.xMin, d: acc.zMax - acc.zMin };
  });
  return out;
});

await browser.close();

const CH = 2.1;
console.log('kind                 solid    ratio   full     footprint       aspect  verdict');
let fails = 0;
for (const [kind, r] of Object.entries(rows).sort()) {
  const ratio = r.solid / CH;
  const aspect = r.solid / Math.min(r.w, r.d);
  const ok = ratio >= 0.94 && aspect >= 0.4;
  if (!ok) fails++;
  console.log(
    `${kind.padEnd(20)} ${r.solid.toFixed(2)}m   ${ratio.toFixed(2)}x  ${r.full.toFixed(2)}m  ` +
    `${r.w.toFixed(1)}x${r.d.toFixed(1)}m`.padEnd(15) + ` ${aspect.toFixed(2)}    ${ok ? 'PASS' : 'FAIL'}`
  );
}
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`);
