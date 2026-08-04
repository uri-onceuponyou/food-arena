#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — WHICH MESHES float free of the body?
 *
 * `limbcheck.mjs` reports that a character's silhouette breaks into more than one
 * connected component. That is the detachment half of the window (Finding 7), but it
 * does not say WHAT detached — and reasoning about it from source has already been
 * wrong once on this project.
 *
 * So: render an ID BUFFER. Every mesh gets a unique flat colour on an unlit
 * MeshBasicMaterial (geometry and depth unchanged, so the silhouette is bit-identical
 * to the real one), read it back, label connected components, and histogram the mesh
 * IDs inside each. One extra render names every floating part on every character.
 *
 * Outline hulls are included on purpose — a hull IS part of the silhouette, and a
 * flat panel's inverted hull is its own species of bug (it renders as a black copy of
 * the panel, because a plane's back face is the same plane).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe');
const TAG = get('--tag', 'islands');
const ANIM = get('--anim', 'idle');
const T = Number(get('--t', 1.5));
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const DUMP = ({ t, anim }) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  window.__preview.frameAt(t, { anim, remount: true });
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const ground = scene.getObjectByName('preview_ground');
  const gv = ground ? ground.visible : null;
  if (ground) ground.visible = false;

  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;

  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const saved = meshes.map((m) => m.material);
  const BasicCtor = Object.getPrototypeOf(saved[0]).constructor;
  // Build the ID palette in a colour space the framebuffer round-trips exactly:
  // 6 levels per channel = 216 slots, comfortably more than any character's mesh
  // count, and every level is >= 51/255 apart so no post/AA blend can alias two IDs.
  const idOf = [];
  meshes.forEach((m, i) => {
    const r = (i % 6) * 51, g2 = (Math.floor(i / 6) % 6) * 51, b = (Math.floor(i / 36) % 6) * 51;
    idOf.push([r, g2, b]);
    const mat = new BasicCtor({ color: 0x000000 });
    mat.color.setRGB(r / 255, g2 / 255, b / 255);
    mat.toneMapped = false;
    mat.side = saved[i].side;
    mat.transparent = false;
    mat.depthWrite = true;
    m.material = mat;
  });

  const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
  // ── The IDs came back SCRAMBLED until this line existed ─────────────────────
  // `renderer.outputColorSpace` is sRGB, so a colour written in the linear working
  // space is transfer-encoded on its way to the framebuffer: a mesh given linear
  // 0.2 reads back as 0.484. Every ID was therefore quantising to the wrong slot,
  // and the resulting "this mesh renders at zero pixels" list was fiction. Render
  // the ID pass in LINEAR so the bytes are the bytes.
  const ocs = renderer.outputColorSpace;
  renderer.outputColorSpace = 'srgb-linear';
  scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(null); renderer.setClearColor(0xffffff, 1); renderer.clear();
  renderer.render(scene, stage.rig.camera);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.outputColorSpace = ocs;
  scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
  meshes.forEach((m, i) => { m.material.dispose(); m.material = saved[i]; });
  if (ground) ground.visible = gv;

  // The context is multisampled, so edge pixels blend a mesh colour with the white
  // clear. A dark mesh blended halfway quantises to an ID beyond the mesh count,
  // which as -1 punched holes through the silhouette and split single characters
  // into a dozen "components". So: OCCUPANCY comes from "not white" (robust), and the
  // ID is used only to attribute pixels that quantise to a real mesh.
  const idAt = new Int32Array(W * H).fill(-1);
  const solid = new Uint8Array(W * H);
  const q6 = (v) => Math.round(v / 51);
  for (let j = 0; j < W * H; j++) {
    const i = j * 4;
    if (px[i] > 248 && px[i + 1] > 248 && px[i + 2] > 248) continue;
    solid[j] = 1;
    const id = q6(px[i]) + q6(px[i + 1]) * 6 + q6(px[i + 2]) * 36;
    if (id >= 0 && id < meshes.length) idAt[j] = id;
  }

  const comp = new Int32Array(W * H).fill(-1);
  const stack = new Int32Array(W * H);
  const comps = [];
  for (let j0 = 0; j0 < W * H; j0++) {
    if (!solid[j0] || comp[j0] >= 0) continue;
    const cid = comps.length;
    let sp = 0; stack[sp++] = j0; comp[j0] = cid;
    let n = 0; const hist = new Map();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    while (sp > 0) {
      const p = stack[--sp]; n++;
      if (idAt[p] >= 0) hist.set(idAt[p], (hist.get(idAt[p]) ?? 0) + 1);
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && solid[p - 1] && comp[p - 1] < 0) { comp[p - 1] = cid; stack[sp++] = p - 1; }
      if (x < W - 1 && solid[p + 1] && comp[p + 1] < 0) { comp[p + 1] = cid; stack[sp++] = p + 1; }
      if (y > 0 && solid[p - W] && comp[p - W] < 0) { comp[p - W] = cid; stack[sp++] = p - W; }
      if (y < H - 1 && solid[p + W] && comp[p + W] < 0) { comp[p + W] = cid; stack[sp++] = p + W; }
    }
    comps.push({ n, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], hist });
  }
  comps.sort((p, q) => q.n - p.n);
  const path = (m) => {
    const names = [];
    let o = m;
    while (o && o !== root) { if (o.name) names.push(o.name); o = o.parent; }
    return names.reverse().join('/');
  };

  // Delivered pixels PER MESH, straight off the ID buffer. This is the cheapest
  // possible form of the project's most-repeated bug (`docs/LESSONS.md` §1): a mesh
  // that exists, is positioned, is lit, and reaches the screen at zero pixels.
  const perMesh = new Map();
  for (let j = 0; j < W * H; j++) if (idAt[j] >= 0) perMesh.set(idAt[j], (perMesh.get(idAt[j]) ?? 0) + 1);
  const zero = [];
  for (let i = 0; i < meshes.length; i++) {
    if (meshes[i].name.endsWith('__outline')) continue;
    if (!perMesh.get(i)) zero.push(path(meshes[i]) || `#${i}`);
  }

  return {
    components: comps.filter((c) => c.n >= 30).slice(0, 12).map((c) => ({
      px: c.n, bbox: c.bbox,
      meshes: [...c.hist.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6)
        .map(([id, n]) => `${path(meshes[id]) || `#${id}`}(${n})`),
    })),
    meshCount: meshes.length,
    zeroPixelMeshes: zero,
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const out = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: 640, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
    const r = await page.evaluate(DUMP, { t: T, anim: ANIM });
    out[id] = r;
    console.log(`=== ${id}  ${r.components.length} component(s), ${r.meshCount} meshes`);
    r.components.forEach((c, i) => console.log(`   ${i === 0 ? 'MAIN ' : 'FLOAT'} ${String(c.px).padStart(7)}px  ${c.meshes.join('  ')}`));
    if (r.zeroPixelMeshes.length) console.log(`   ZERO-PIXEL (${r.zeroPixelMeshes.length}): ${r.zeroPixelMeshes.join(', ')}`);
  } catch (e) { console.error(`✗ ${id}: ${e}`); out[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/${TAG}.json`);
await browser.close();
