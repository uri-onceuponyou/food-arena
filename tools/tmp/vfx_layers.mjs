#!/usr/bin/env node
/**
 * GROUND-LAYER STACK + SILENT-OCCLUDER CENSUS.
 *
 * Two questions, both of which this project has answered wrong from source before:
 *
 * 1. **What is actually stacked on the ground right now?** `docs/LESSONS.md` quotes
 *    floor pads 0.045-0.048, seams 0.062, baked shadows 0.068-0.07, prop kicks 0.08,
 *    puddle decals 0.15-0.25 — but `floor.ts` and `hazards.ts` are being edited by
 *    other agents today, so those constants are hearsay. This walks the LIVE scene
 *    and reports every renderable whose world-space top sits under 0.7 m, ordered by
 *    height, with its transparency/depth flags. `game/vfx.ts`'s own decal heights
 *    (SPLAT_Y 0.17, TRAIL_Y 0.19, GROUND_VFX_Y 0.24, STATUS_RING_Y 0.30) are printed
 *    inline so the ordering is checkable at a glance instead of by memory.
 *
 * 2. **Which transparent materials still write depth?** A `transparent: true`
 *    material without `depthWrite: false` still writes the depth buffer by three's
 *    own default and silently occludes everything behind it. That is the exact
 *    mechanism behind four of the seventeen invisible-render cases, and a sweep of
 *    the character cast found it present on EVERY transparent material there
 *    (LESSONS §1 corollary). Nobody has swept the arena or the VFX layer.
 *
 *   node tools/tmp/vfx_layers.mjs --url <snapshot-url>
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2); const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) out[k] = true; else { out[k] = n; i++; }
  }
  return out;
}
const args = parseArgs(process.argv);
const BASE = args.url ?? process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = args.out ?? 'shots/vfx/layers';

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`,
  }));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=0.0001&pointerLock=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90000 });
  await page.waitForFunction(() => !!window.__vfxLayer && !!window.__stage, null, { timeout: 90000 });
  await page.waitForTimeout(1500);

  const report = await page.evaluate(() => {
    const stage = window.__stage;
    stage.scene.updateMatrixWorld(true);
    const ground = [];
    const occluders = [];
    const vfxMats = [];
    const box = new (stage.scene.constructor.prototype.constructor === Object ? Object : Object)();
    void box;

    const path = (o) => {
      const parts = [];
      let c = o;
      while (c && c !== stage.scene) { parts.unshift(c.name || c.type); c = c.parent; }
      return parts.join('/');
    };

    stage.scene.traverse((o) => {
      if (!o.isMesh && !o.isSprite && !o.isInstancedMesh && !o.isPoints) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      // World-space vertical extent, computed off the geometry bbox rather than the
      // object origin: a decal's origin can sit at 0 while the plane it draws is
      // somewhere else entirely.
      let top = o.position.y, bot = o.position.y;
      try {
        if (o.geometry) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox;
          const e = o.matrixWorld.elements;
          // Transform all EIGHT corners. The first version scaled the local-Y extent
          // and added it to the world origin, which is only correct for an unrotated
          // mesh — and every ground decal in this project is a CircleGeometry rotated
          // -90 deg about X, so its local Y extent is the disc RADIUS pointing along
          // world Z. That version reported flat decals as spanning +/- their own
          // radius vertically and mis-ordered the whole stack.
          top = -Infinity; bot = Infinity;
          for (let i = 0; i < 8; i++) {
            const x = (i & 1) ? bb.max.x : bb.min.x;
            const y = (i & 2) ? bb.max.y : bb.min.y;
            const z = (i & 4) ? bb.max.z : bb.min.z;
            const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
            if (wy > top) top = wy;
            if (wy < bot) bot = wy;
          }
        }
      } catch { /* keep the origin estimate */ }

      const inVfx = path(o).startsWith('vfx_layer');
      for (const m of mats) {
        if (!m) continue;
        const row = {
          path: path(o).slice(0, 78), top: +top.toFixed(3), bottom: +bot.toFixed(3),
          transparent: !!m.transparent, opacity: +(m.opacity ?? 1).toFixed(2),
          depthWrite: m.depthWrite !== false, depthTest: m.depthTest !== false,
          renderOrder: o.renderOrder, visible: o.visible, type: m.type,
          count: o.isInstancedMesh ? o.count : 1,
        };
        if (inVfx) vfxMats.push(row);
        if (top < 0.7 && o.visible !== false) ground.push(row);
        // The silent occluder: transparent AND still depth-writing.
        if (m.transparent && m.depthWrite !== false) occluders.push(row);
      }
    });
    ground.sort((a, b) => a.top - b.top);
    occluders.sort((a, b) => a.top - b.top);
    return { ground, occluders, vfxMats };
  });

  const VFX_Y = [
    ['arena decal (documented)', 0.15],
    ['SPLAT_Y', 0.17],
    ['TRAIL_Y', 0.19],
    ['GROUND_VFX_Y', 0.24],
    ['impact star decal', 0.27],
    ['STATUS_RING_Y', 0.30],
    ['fogRing GROUND_Y', 0.34],
  ];
  console.log('\n══ GROUND STACK (live scene, everything whose top < 0.7 m) ══════════════════════');
  console.log('  top     bot   trans dW dT  rOrd  n    path');
  const merged = [
    ...report.ground.map((r) => ({ kind: 'scene', ...r })),
    ...VFX_Y.map(([name, y]) => ({ kind: 'MARK', top: y, name })),
  ].sort((a, b) => a.top - b.top);
  for (const r of merged) {
    if (r.kind === 'MARK') { console.log(`  ${r.top.toFixed(3)}  ${'·'.repeat(10)} <<< ${r.name}`); continue; }
    console.log(`  ${r.top.toFixed(3)} ${r.bottom.toFixed(3)}  ${r.transparent ? 'T' : '-'}    ${r.depthWrite ? 'W' : '-'}  ${r.depthTest ? 'T' : '-'}  ${String(r.renderOrder).padStart(4)} ${String(r.count).padStart(4)} ${r.path}`);
  }

  console.log('\n══ SILENT OCCLUDERS: transparent AND depthWrite:true ════════════════════════════');
  if (!report.occluders.length) console.log('  none — every transparent material in the live scene sets depthWrite:false');
  for (const r of report.occluders) {
    console.log(`  top=${r.top.toFixed(3)} op=${r.opacity} rOrd=${String(r.renderOrder).padStart(4)} n=${String(r.count).padStart(4)} ${r.type.padEnd(20)} ${r.path}`);
  }

  console.log('\n══ VFX LAYER MATERIAL CENSUS ════════════════════════════════════════════════════');
  const bad = report.vfxMats.filter((r) => r.transparent && r.depthWrite);
  console.log(`  ${report.vfxMats.length} renderables under vfx_layer; ${bad.length} transparent-and-depth-writing`);
  for (const r of bad) console.log(`  ✗ ${r.path}  ${r.type}`);

  await writeFile(`${OUT}/layers.json`, JSON.stringify(report, null, 1));
  console.log(`\nwrote ${OUT}/layers.json`);
} finally {
  await browser.close();
}
