#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — where does the FOOD MASS sit relative to the HIPS?
 *
 * `docs/LESSONS.md` §12: "`ChibiRig.headCentreY` assumes a head mass extending ~±R
 * about its origin; non-spherical masses float or sink." Raising `legFraction`
 * moves every head, so the whole cast needs re-checking against it — and the limb
 * measurement points straight at the same place: `hipR`'s screen overlap with the
 * mass is **1.000 at every stride phase** on egg, i.e. the right thigh is inside
 * the shell always, not at one pose.
 *
 * Reports, per character, in the character's own local frame (feet at y = 0):
 *   hipY        the hip pivot — the top of the legs
 *   massMinY    the LOWEST point of the food mass (head + face + neck + torso)
 *   sit         massMinY - hipY. Negative means the mass hangs BELOW the hip line
 *               and is burying the thighs from the moment they start.
 *   massHalfW   the mass's half-width measured in a slab at hip height
 *   stance      the hip pivot's own x offset
 *   over        massHalfW - stance. Positive means the mass overhangs the thigh by
 *               that much and no amount of leg length fixes it.
 *
 * Read-only: it hides meshes to isolate groups and puts them all back.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/limb2');
const TAG = get('--tag', 'masssit');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const MEASURE = () => {
  const THREE = window.__THREE;
  const stage = window.__stage, scene = stage.scene;
  window.__preview.frameAt(1.5, { anim: 'idle', remount: true });
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  root.updateMatrixWorld(true);

  const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'rig_body', 'rig_root'];
  const groupKey = (o) => {
    let n = o;
    while (n) { if (JOINTS.includes(n.name)) return n.name; if (n === root) break; n = n.parent; }
    return 'other';
  };
  const named = (name) => { let f = null; root.traverse((o) => { if (!f && o.name === name) f = o; }); return f; };
  const localOf = (obj) => { const v = new THREE.Vector3(); v.setFromMatrixPosition(obj.matrixWorld); return root.worldToLocal(v); };

  const hips = named('hips'), hipL = named('hipL'), hipR = named('hipR');
  const hipY = +localOf(hips).y.toFixed(4);
  const stance = +Math.abs(localOf(hipL).x - localOf(hipR).x).toFixed(4) / 2;

  // The food mass: everything parented to head/face/neck/torso/hips that is NOT a
  // limb. `hips` itself carries character-authored skirts/aprons on some bodies, so
  // it counts — those are exactly the things that bury a thigh.
  const MASS = ['head', 'face', 'neck', 'torso', 'hips'];
  let minY = 1e9, maxY = -1e9, halfW = 0, halfWAtHip = 0, nMass = 0;
  const p = new THREE.Vector3();
  /** Per-mesh, so "the mass hangs below the hips" names the mesh that does it. */
  const perMesh = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    if (!MASS.includes(groupKey(o))) return;
    nMass++;
    const g = o.geometry;
    const pos = g.attributes.position;
    let mMin = 1e9, mW = 0, mWHip = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      o.localToWorld(p);
      root.worldToLocal(p);
      if (p.y < minY) minY = p.y;
      if (p.y < mMin) mMin = p.y;
      if (p.y > maxY) maxY = p.y;
      const ax = Math.abs(p.x);
      if (ax > halfW) halfW = ax;
      if (ax > mW) mW = ax;
      // A slab one leg-radius tall centred on the hip line.
      if (Math.abs(p.y - hipY) < 0.09) {
        if (ax > halfWAtHip) halfWAtHip = ax;
        if (ax > mWHip) mWHip = ax;
      }
    }
    perMesh.push({ name: o.name || '(unnamed)', group: groupKey(o), minY: +mMin.toFixed(3), halfW: +mW.toFixed(3), halfWAtHip: +mWHip.toFixed(3) });
  });
  perMesh.sort((x, y) => x.minY - y.minY);

  return {
    hipY, stance: +stance.toFixed(4), nMassMeshes: nMass,
    massMinY: +minY.toFixed(4), massMaxY: +maxY.toFixed(4),
    sit: +(minY - hipY).toFixed(4),
    massHalfW: +halfW.toFixed(4),
    lowest: perMesh.slice(0, 6),
    widestAtHip: [...perMesh].sort((x, y) => y.halfWAtHip - x.halfWAtHip).slice(0, 4),
    massHalfWAtHip: +halfWAtHip.toFixed(4),
    over: +(halfWAtHip - stance).toFixed(4),
    modelH: window.__preview.info().height,
    footY: window.__preview.info().footY,
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const results = {};
try {
  for (const id of IDS) {
    const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    try {
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
      // The probe needs a THREE handle; the preview does not export one, so pull it
      // off the module graph rather than duplicating vector maths by hand.
      await page.evaluate(async () => {
        window.__THREE = await import('/node_modules/.vite/deps/three.js?v=0').catch(() => import('three'));
      }).catch(() => {});
      const ok = await page.evaluate(() => !!(window.__THREE && window.__THREE.Vector3));
      if (!ok) {
        await page.addScriptTag({ type: 'module', content: `import * as T from 'three'; window.__THREE = T; window.__THREE_READY = 1;` });
        await page.waitForFunction('window.__THREE_READY === 1', null, { timeout: 30000 });
      }
      results[id] = await page.evaluate(MEASURE);
      const r = results[id];
      console.log(
        `${id.padEnd(12)} hipY ${String(r.hipY).padStart(7)}  massMinY ${String(r.massMinY).padStart(7)}  ` +
        `sit ${(r.sit >= 0 ? '+' : '') + r.sit}`.padEnd(18) +
        `  halfW@hip ${String(r.massHalfWAtHip).padStart(6)}  stance ${String(r.stance).padStart(6)}  ` +
        `over ${(r.over >= 0 ? '+' : '') + r.over}`.padEnd(14) +
        `  modelH ${r.modelH}  footY ${r.footY}`
      );
    } catch (e) {
      console.error(`x ${id}: ${e}`);
      results[id] = { error: String(e) };
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(results, null, 2));
console.log(`\nwrote ${OUT}/${TAG}.json`);
