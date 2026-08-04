/**
 * MATERIAL COVERAGE PASS — which material owns which fraction of the frame?
 *
 * One ID-buffer render (every mesh swapped to a flat unlit colour encoding its
 * material index, tone mapping and output colour conversion disabled so the index
 * survives the write), read back with gl.readPixels, plus one normal composited
 * render averaged through the same masks. Result: for every material, its screen
 * coverage AND the colour it actually arrives at after lighting + the grade.
 *
 * This is the "measure before attributing" step. A palette entry that owns 0.0% of
 * the frame is not worth a single round of argument, however large it looks in the
 * source file.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', 'http://localhost:5189');
const STATIONS = (arg('stations', '700:640,340:500,1150:330,430:240')).split(',');
const TOP = Number(arg('top', '30'));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });

const agg = new Map();
for (const st of STATIONS) {
  const [px, py] = st.split(':');
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=850&simSpeed=0.02&pointerLock=0`,
    { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
  await page.waitForTimeout(1200);

  const res = await page.evaluate(() => {
    const stage = window.__stage;
    const scene = stage.scene, cam = stage.rig.camera, renderer = stage.renderer;
    const gl = renderer.getContext();
    const W = renderer.domElement.width, H = renderer.domElement.height;

    // ---- collect meshes + materials
    const mats = [];
    const idx = new Map();
    const meshes = [];
    let basicProto = null;
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      let vis = true;
      for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      if (m.isMeshBasicMaterial && !basicProto) basicProto = m;
      if (!idx.has(m.uuid)) {
        idx.set(m.uuid, mats.length);
        mats.push({ name: m.name || '(unnamed)', hex: m.color ? '#' + m.color.getHexString().toUpperCase() : '-', type: m.type });
      }
      meshes.push({ o, i: idx.get(m.uuid) });
    });
    if (!basicProto) return { error: 'no MeshBasicMaterial in scene to clone' };
    if (mats.length > 4090) return { error: 'too many materials for 16-bit index: ' + mats.length };

    // ---- normal composited frame first
    stage.render(0.0);
    const normal = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, normal);

    // ---- ID pass
    // Encode the index as three 16-step channel levels (12 bits, 4096 ids) written in
    // SRGB space, so it survives the renderer's output transfer round-trip with a
    // +-7 tolerance per channel. Disabling outputColorSpace outright is not portable
    // across three versions (`'' ` throws in r180), and precision is not needed here.
    const savedTone = renderer.toneMapping;
    renderer.toneMapping = 0;
    const savedBg = scene.background; scene.background = null;
    const idMats = mats.map((_, i) => {
      const mm = basicProto.clone();
      mm.map = null; mm.alphaMap = null; mm.transparent = false; mm.opacity = 1;
      mm.depthWrite = true; mm.depthTest = true; mm.fog = false; mm.side = 0;
      const id = i + 1;
      mm.color.setRGB(((id & 15) * 16 + 8) / 255, (((id >> 4) & 15) * 16 + 8) / 255, (((id >> 8) & 15) * 16 + 8) / 255, 'srgb');
      return mm;
    });
    const saved = meshes.map((e) => e.o.material);
    meshes.forEach((e) => { e.o.material = idMats[e.i]; });
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    const ids = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, ids);
    meshes.forEach((e, k) => { e.o.material = saved[k]; });
    idMats.forEach((m) => m.dispose());
    renderer.toneMapping = savedTone;
    scene.background = savedBg;

    // ---- tally
    const n = W * H;
    const cnt = new Float64Array(mats.length + 1);
    const rs = new Float64Array(mats.length + 1), gs = new Float64Array(mats.length + 1), bs = new Float64Array(mats.length + 1);
    for (let p = 0; p < n; p++) {
      const q = (v) => Math.min(15, Math.max(0, Math.round((v - 8) / 16)));
      const id = q(ids[p * 4]) | (q(ids[p * 4 + 1]) << 4) | (q(ids[p * 4 + 2]) << 8);
      if (id === 0 || id > mats.length) continue;
      const i = id - 1;
      cnt[i]++; rs[i] += normal[p * 4]; gs[i] += normal[p * 4 + 1]; bs[i] += normal[p * 4 + 2];
    }
    return {
      total: n,
      rows: mats.map((m, i) => ({
        name: m.name, hex: m.hex, type: m.type, px: cnt[i],
        rgb: cnt[i] ? [Math.round(rs[i] / cnt[i]), Math.round(gs[i] / cnt[i]), Math.round(bs[i] / cnt[i])] : null,
      })).filter((r) => r.px > 0),
    };
  });
  await page.close();
  if (res.error) { console.error(st, res.error); continue; }
  for (const r of res.rows) {
    const key = r.name + '|' + r.hex;
    const a = agg.get(key) ?? { name: r.name, hex: r.hex, type: r.type, px: 0, r: 0, g: 0, b: 0, tot: 0 };
    a.px += r.px; a.tot += res.total;
    a.r += r.rgb[0] * r.px; a.g += r.rgb[1] * r.px; a.b += r.rgb[2] * r.px;
    agg.set(key, a);
  }
  console.error(`  scanned ${px},${py}: ${res.rows.length} materials on screen`);
}
await browser.close();

const totalFrames = STATIONS.length;
const out = [...agg.values()].map((a) => {
  const r = Math.round(a.r / a.px), g = Math.round(a.g / a.px), b = Math.round(a.b / a.px);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const v = mx / 255, s = mx ? (mx - mn) / mx : 0;
  let h = 0;
  if (mx !== mn) {
    const d = mx - mn;
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { ...a, pct: (a.px / (1600 * 900 * totalFrames)) * 100, rgb: [r, g, b], h: Math.round(h), s: +s.toFixed(2), v: +v.toFixed(2), luma: Math.round(luma) };
}).sort((x, y) => y.pct - x.pct);

console.log(`\nMATERIAL COVERAGE — mean over ${totalFrames} stations, 1600x900\n`);
console.log('  pct%  name                        authored   rendered rgb        hue  sat  val  luma');
for (const r of out.slice(0, TOP)) {
  console.log(`${r.pct.toFixed(2).padStart(6)}  ${r.name.padEnd(26)} ${r.hex.padEnd(9)} rgb(${r.rgb.join(',').padEnd(12)})  ${String(r.h).padStart(4)}° ${r.s.toFixed(2)} ${r.v.toFixed(2)}  ${String(r.luma).padStart(4)}`);
}
const covered = out.reduce((s, r) => s + r.pct, 0);
console.log(`\ntotal geometry coverage ${covered.toFixed(1)}% (rest is background/sky/transparent overdraw)`);
