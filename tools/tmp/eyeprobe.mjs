#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — eye diameter / head width, measured off the rendered frame.
 *
 * Uses LAYERS, not `visible`, to isolate a mesh: `visible` is inherited, so a decal
 * parented to another mesh vanishes with its parent and reports a zero footprint
 * (that is exactly what happened to taco in the first pass). `object.layers` is
 * tested per object, so a child on a rendered layer still draws.
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
const W = Number(get('--w', 640)), H = Number(get('--h', 800));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const MEASURE = () => {
  const stage = window.__stage;
  const scene = stage.scene;
  const renderer = stage.renderer;
  const cam = stage.rig.camera;
  const gl = renderer.getContext();
  const cv = renderer.domElement;
  const W = cv.width, H = cv.height;

  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const ground = scene.getObjectByName('preview_ground');
  if (ground) ground.visible = false;

  const read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const LAYER = 7;

  const renderLayer = (objs) => {
    const saved = objs.map((o) => o.layers.mask);
    objs.forEach((o) => o.layers.set(LAYER));
    const camMask = cam.layers.mask;
    cam.layers.set(LAYER);
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x00ff00, 1);
    renderer.clear();
    renderer.render(scene, cam);
    const px = read();
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    cam.layers.mask = camMask;
    objs.forEach((o, i) => { o.layers.mask = saved[i]; });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const isKey = px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60;
      if (isKey) continue;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n, cx: Math.round((x0 + x1) / 2), cy: Math.round((y0 + y1) / 2) } : null;
  };

  // all meshes
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const joints = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'rig_body', 'rig_root'];
  const keyOf = (o) => { let n = o; while (n) { if (joints.includes(n.name)) return n.name; if (n === root) break; n = n.parent; } return 'other'; };

  const headMeshes = meshes.filter((m) => keyOf(m) === 'head');
  const headBox = headMeshes.length ? renderLayer(headMeshes) : null;
  const allBox = renderLayer(meshes);

  // candidate face features: ink or white material, small, in the head's screen box
  const cands = [];
  for (const m of meshes) {
    const c = m.material && m.material.color ? m.material.color : null;
    if (!c) continue;
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    const isInk = lum < 0.10;
    const isWhite = lum > 0.85;
    if (!isInk && !isWhite) continue;
    m.geometry.computeBoundingSphere();
    const r = m.geometry.boundingSphere.radius * m.getWorldScale(new m.position.constructor()).length() / Math.sqrt(3);
    cands.push({ m, hex: '#' + c.getHexString(), part: keyOf(m), r });
  }
  const out = [];
  for (const c of cands) {
    const b = renderLayer([c.m]);
    if (!b) continue;
    const wp = c.m.getWorldPosition(new c.m.position.constructor());
    out.push({ hex: c.hex, part: c.part, w: b.w, h: b.h, n: b.n, cx: b.cx, cy: b.cy,
      wx: +wp.x.toFixed(3), wy: +wp.y.toFixed(3), wz: +wp.z.toFixed(3) });
  }
  out.sort((p, q) => q.n - p.n);
  if (ground) ground.visible = true;
  return { canvas: [W, H], allBox, headBox, features: out.slice(0, 26) };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const results = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 90000 });
    await page.waitForTimeout(300);
    results[id] = await page.evaluate(MEASURE);
    const r = results[id];
    console.log(`✓ ${id} head ${r.headBox && r.headBox.w}x${r.headBox && r.headBox.h}  feats ${r.features.length}`);
  } catch (e) { console.error(`✗ ${id}: ${e}`); results[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/eyes.json`, JSON.stringify(results, null, 2));
console.log(`wrote ${OUT}/eyes.json`);
await browser.close();
