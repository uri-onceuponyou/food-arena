#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — WHY is a limb buried? Dump the world geometry.
 *
 * For each character: every joint's world position, the head/torso mass world
 * bbox, and each limb group's world bbox — so "the pivot is inside the food mass"
 * can be shown as numbers rather than argued about. Also reports transparent /
 * double-sided / depthWrite:false materials, which is the other half of the
 * invisible-render family in docs/LESSONS.md §1.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe');
const IDS = (get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog')).split(',');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const DUMP = () => {
  const stage = window.__stage, scene = stage.scene;
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const V = stage.rig.camera.position.constructor;
  const joints = ['hips', 'torso', 'neck', 'head', 'face', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
  const jp = {};
  root.traverse((o) => {
    if (!joints.includes(o.name) || jp[o.name]) return;
    const p = o.getWorldPosition(new V());
    jp[o.name] = [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)];
  });

  const keyOf = (o) => { let n = o; while (n) { if (joints.includes(n.name)) return n.name; if (n === root) break; n = n.parent; } return 'other'; };

  // world bbox per group, computed by transforming geometry bounding boxes
  const groups = {};
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const k = keyOf(o);
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    bb.applyMatrix4(o.matrixWorld);
    const g = groups[k] ??= { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], n: 0 };
    g.min[0] = Math.min(g.min[0], bb.min.x); g.min[1] = Math.min(g.min[1], bb.min.y); g.min[2] = Math.min(g.min[2], bb.min.z);
    g.max[0] = Math.max(g.max[0], bb.max.x); g.max[1] = Math.max(g.max[1], bb.max.y); g.max[2] = Math.max(g.max[2], bb.max.z);
    g.n++;
    const m = o.material;
    if (m && (m.transparent || m.side !== 0 || m.depthWrite === false)) {
      mats.push({
        part: k, name: o.name || '(unnamed)',
        color: m.color ? '#' + m.color.getHexString() : null,
        transparent: !!m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite,
        bbox: [+bb.min.x.toFixed(2), +bb.min.y.toFixed(2), +bb.min.z.toFixed(2), +bb.max.x.toFixed(2), +bb.max.y.toFixed(2), +bb.max.z.toFixed(2)],
      });
    }
  });
  for (const k of Object.keys(groups)) {
    const g = groups[k];
    groups[k] = { n: g.n, min: g.min.map((v) => +v.toFixed(3)), max: g.max.map((v) => +v.toFixed(3)) };
  }
  return { joints: jp, groups, oddMaterials: mats.slice(0, 20) };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const out = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: 400, height: 500 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
    out[id] = await page.evaluate(DUMP);
    console.log(`✓ ${id}`);
  } catch (e) { console.error(`✗ ${id}: ${e}`); out[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/geom.json`, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/geom.json`);
await browser.close();
