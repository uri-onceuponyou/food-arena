#!/usr/bin/env node
/**
 * WHAT SITS ABOVE THE BAKED CONTACT DECAL PLANE, AND DOES IT WRITE DEPTH?
 *
 * READ-ONLY PROBE. `src/arena/shared.ts`'s `BAKED_SHADOW_Y = 0.07` is documented as
 * "above the highest opaque floor layer (`floor.ts`'s FINE_Y = 0.062) and below the
 * lowest prop kick (~0.08)". That is a claim about the SOURCE. This asks the scene
 * graph instead: every mesh in `arena:kitchen` whose world-space top lands between
 * the decal plane and 0.5 m, with the two properties that decide whether it can bury
 * anything — `depthWrite` and `transparent`. Only a depth-writing mesh occludes.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/p2_padcensus.mjs --url '{URL}'
 */
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', null) && !arg('url').startsWith('$') ? arg('url') : (process.env.PREVIEW_BASE || 'http://localhost:5173');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const CENSUS = `() => {
  const st = window.__stage, scene = st.scene;
  scene.updateMatrixWorld(true);
  const arena = scene.getObjectByName('arena:kitchen');
  const rows = [];
  const top = (o) => {
    const g = o.geometry; if (!g) return null;
    if (o.isInstancedMesh) o.computeBoundingBox(); else if (!g.boundingBox) g.computeBoundingBox();
    const bb = o.isInstancedMesh ? o.boundingBox : g.boundingBox;
    if (!bb) return null;
    const e = o.matrixWorld.elements;
    let y1 = -1e9, y0 = 1e9;
    for (let i = 0; i < 8; i++) {
      const vx = (i & 1) ? bb.max.x : bb.min.x, vy = (i & 2) ? bb.max.y : bb.min.y, vz = (i & 4) ? bb.max.z : bb.min.z;
      const wy = e[1]*vx + e[5]*vy + e[9]*vz + e[13];
      if (wy > y1) y1 = wy; if (wy < y0) y0 = wy;
    }
    return { y0, y1 };
  };
  arena.traverse((o) => {
    if (!o.isMesh) return;
    const t = top(o); if (!t) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    rows.push({ name: o.name || '(unnamed)', y0: t.y0, y1: t.y1,
      depthWrite: !!m.depthWrite, transparent: !!m.transparent, opacity: m.opacity,
      mat: m.type, matName: m.name || '', visible: o.visible, renderOrder: o.renderOrder });
  });
  return rows;
}`;

const { chromium } = await import('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=570&py=430&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await p.waitForTimeout(1200);
const rows = await p.evaluate(`(${CENSUS})()`);
await b.close();

const DECAL_Y = 0.07;
const groups = new Map();
for (const r of rows) {
  const k = `${r.name}|${r.depthWrite}|${r.transparent}|${r.mat}`;
  if (!groups.has(k)) groups.set(k, { ...r, n: 0, minY1: 1e9, maxY1: -1e9 });
  const g = groups.get(k);
  g.n++; g.minY1 = Math.min(g.minY1, r.y1); g.maxY1 = Math.max(g.maxY1, r.y1);
}
const list = [...groups.values()].sort((a, b2) => b2.maxY1 - a.maxY1);
console.log(`meshes in arena:kitchen  ${rows.length}   distinct (name,depthWrite,transparent,type)  ${list.length}`);
console.log(`\nEVERYTHING WHOSE TOP LANDS ABOVE THE DECAL PLANE (${DECAL_Y}) AND BELOW 0.60 m`);
console.log('  n     topY(min..max)   depthWrite  transparent  op    type                     name');
for (const g of list) {
  if (g.maxY1 <= DECAL_Y || g.minY1 > 0.60) continue;
  console.log(`  ${String(g.n).padStart(4)}  ${g.minY1.toFixed(3)}..${g.maxY1.toFixed(3)}   `
    + `${String(g.depthWrite).padEnd(10)}  ${String(g.transparent).padEnd(11)}  ${String(g.opacity).padEnd(4)}  ${g.mat.padEnd(22)}  ${g.name}`);
}
console.log(`\nOCCLUDERS ONLY (depthWrite true, top above ${DECAL_Y}, bottom below 0.30 — i.e. flat things lying on the floor)`);
let occ = 0;
for (const g of list) {
  if (!g.depthWrite || g.maxY1 <= DECAL_Y || g.minY1 > 0.30) continue;
  occ += g.n;
  console.log(`  ${String(g.n).padStart(4)}  ${g.minY1.toFixed(3)}..${g.maxY1.toFixed(3)}   ${g.mat.padEnd(22)}  ${g.name}`);
}
console.log(`  -> ${occ} depth-writing meshes can bury a decal at y=${DECAL_Y}`);
