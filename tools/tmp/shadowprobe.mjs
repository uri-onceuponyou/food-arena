#!/usr/bin/env node
/**
 * DOES THE ARENA CAST SHADOWS? — probe before you loop (docs/LESSONS.md §2/§3).
 *
 * A blind critic scored the arena 4/10 and named one cause: "props cast no shadow at
 * all while the character casts a long one". §3 says take the symptom and RE-DERIVE
 * the cause, so this reads the shipped scene graph instead of arguing about it:
 * per-object castShadow/receiveShadow, grouped by which arena module built it, plus
 * the shadow light's camera frustum and whether each prop is inside it.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5173');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=570&py=430&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await p.waitForTimeout(1200);

const out = await p.evaluate(() => {
  const stage = window.__stage;
  const scene = stage.scene, renderer = stage.renderer;
  const lights = [];
  scene.traverse((o) => {
    if (o.isLight) lights.push({
      type: o.type, name: o.name, intensity: o.intensity, castShadow: !!o.castShadow,
      pos: o.position ? [o.position.x, o.position.y, o.position.z].map((v) => +v.toFixed(2)) : null,
      target: o.target?.position ? [o.target.position.x, o.target.position.y, o.target.position.z].map((v) => +v.toFixed(2)) : null,
      shadow: o.shadow ? {
        mapSize: [o.shadow.mapSize.width, o.shadow.mapSize.height],
        bias: o.shadow.bias, normalBias: o.shadow.normalBias, radius: o.shadow.radius,
        cam: o.shadow.camera ? { left: o.shadow.camera.left, right: o.shadow.camera.right,
          top: o.shadow.camera.top, bottom: o.shadow.camera.bottom,
          near: o.shadow.camera.near, far: o.shadow.camera.far } : null,
      } : null,
    });
  });
  // Group meshes by the nearest named ancestor, which is how the arena modules label
  // what they build.
  const groups = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let n = o, label = o.name || '(unnamed)';
    while (n) { if (n.name) { label = n.name; } n = n.parent; }
    const g = groups.get(label) ?? { label, meshes: 0, cast: 0, recv: 0, examples: [] };
    g.meshes++; if (o.castShadow) g.cast++; if (o.receiveShadow) g.recv++;
    if (g.examples.length < 3) g.examples.push(o.name || o.geometry?.type || '?');
    groups.set(label, g);
  });
  return {
    shadowsEnabled: renderer.shadowMap.enabled, shadowType: renderer.shadowMap.type,
    lights, groups: [...groups.values()].sort((a, b) => b.meshes - a.meshes),
  };
});
console.log(`renderer.shadowMap.enabled = ${out.shadowsEnabled}   type = ${out.shadowType}`);
console.log('\nLIGHTS');
for (const l of out.lights) console.log(`  ${l.type.padEnd(18)} cast=${l.castShadow}  int=${l.intensity}  pos=${JSON.stringify(l.pos)}  target=${JSON.stringify(l.target)}\n${l.shadow?.cam ? `      shadow cam ${JSON.stringify(l.shadow.cam)}  map ${l.shadow.mapSize}  radius ${l.shadow.radius}` : ''}`);
console.log('\nMESH GROUPS — meshes / castShadow / receiveShadow');
for (const g of out.groups) console.log(`  ${String(g.meshes).padStart(5)}  cast ${String(g.cast).padStart(5)}  recv ${String(g.recv).padStart(5)}   ${g.label}   e.g. ${g.examples.join(', ')}`);
const tot = out.groups.reduce((a, g) => ({ m: a.m + g.meshes, c: a.c + g.cast, r: a.r + g.recv }), { m: 0, c: 0, r: 0 });
console.log(`\n  TOTAL ${tot.m} meshes · ${tot.c} cast (${(100 * tot.c / tot.m).toFixed(1)}%) · ${tot.r} receive (${(100 * tot.r / tot.m).toFixed(1)}%)`);
await b.close();
