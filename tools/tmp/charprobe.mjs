#!/usr/bin/env node
/**
 * THROWAWAY read-only diagnostic probe — character rendering census.
 *
 * Writes nothing but PNGs/JSON under shots/. Never mutates src/.
 *
 * Modes
 *   --mode lights   dump the live light rig from preview AND from a real match
 *   --mode chars    per character: part occlusion census, ink-blob (eye) metrics,
 *                   rim-light ablation A/B
 *
 * Everything is measured off the LIVE rendered framebuffer, never from source
 * constants (docs/LESSONS.md §6).
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const mode = get('--mode', 'chars');
const OUT = get('--out', 'shots/probe');
const IDS = (get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog')).split(',');
const W = Number(get('--w', 640)), H = Number(get('--h', 800));

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

async function newPage(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.error('!! reload mid-probe'); });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  return page;
}

// ── the in-page toolkit ──────────────────────────────────────────────────────
const TOOLKIT = () => {
  const stage = window.__stage;
  const scene = stage.scene;
  const renderer = stage.renderer;
  const gl = renderer.getContext();
  const cv = renderer.domElement;
  const W = cv.width, H = cv.height;
  const K = {}; window.__K = K;
  K.stage = stage; K.scene = scene; K.W = W; K.H = H;

  K.read = () => { const p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };

  /** Direct render, no post chain, no shadows, flat clear colour. */
  K.plain = (clear = 0x000000) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, 1);
    renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = K.read();
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };

  // character root = the scene child owning a joint named 'head'
  K.root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { K.root = c; break; }
  }
  K.ground = scene.getObjectByName('preview_ground') ?? null;

  K.meshes = () => { const out = []; K.root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };

  K.lights = () => {
    const out = [];
    scene.traverse((o) => {
      if (!o.isLight) return;
      const p = o.getWorldPosition(new o.position.constructor());
      const rec = {
        type: o.type, name: o.name, intensity: +o.intensity.toFixed(4),
        color: '#' + o.color.getHexString(), castShadow: !!o.castShadow,
        pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      };
      if (o.groundColor) rec.groundColor = '#' + o.groundColor.getHexString();
      if (o.target) {
        const t = o.target.getWorldPosition(new o.position.constructor());
        rec.target = [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)];
        const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z;
        const horiz = Math.hypot(dx, dz);
        rec.elevationDeg = +(Math.atan2(dy, horiz) * 180 / Math.PI).toFixed(1);
        rec.azimuthDeg = +(Math.atan2(dz, dx) * 180 / Math.PI).toFixed(1);
      }
      out.push(rec);
    });
    return {
      lights: out,
      envIntensity: scene.environmentIntensity ?? null,
      hasEnv: !!scene.environment,
      bg: scene.background && scene.background.getHexString ? '#' + scene.background.getHexString() : null,
      fog: scene.fog ? { color: '#' + scene.fog.color.getHexString(), near: scene.fog.near, far: scene.fog.far } : null,
      camera: { pitch: stage.rig.pitchDeg, yaw: stage.rig.yawDeg, frameMode: stage.rig.frameMode,
        pos: [+stage.rig.camera.position.x.toFixed(2), +stage.rig.camera.position.y.toFixed(2), +stage.rig.camera.position.z.toFixed(2)] },
      canvas: [W, H],
    };
  };

  /** mask of pixels that are NOT the chroma clear colour (0x00ff00) */
  K.maskFrom = (px) => {
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const isKey = px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60;
      m[j] = isKey ? 0 : 1;
    }
    return m;
  };

  K.bboxOf = (m) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n } : null;
  };

  K.JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR', 'rig_body', 'rig_root'];

  K.groupKey = (o) => {
    let n = o;
    while (n) { if (K.JOINTS.includes(n.name)) return n.name; if (n === K.root) break; n = n.parent; }
    return 'other';
  };
};

// ── the per-character measurement, run in page ───────────────────────────────
const MEASURE = () => {
  const K = window.__K;
  const { scene, stage, W, H } = K;
  const all = K.meshes();
  const gv = K.ground ? K.ground.visible : null;

  // ---- silhouette / mask on a chroma-green ground-free render ---------------
  if (K.ground) K.ground.visible = false;
  const isoAll = K.plain(0x00ff00);
  const maskAll = K.maskFrom(isoAll);
  const bboxAll = K.bboxOf(maskAll);

  // ---- part census ---------------------------------------------------------
  const groups = new Map();
  for (const m of all) {
    const k = K.groupKey(m);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const base = K.plain(0x00ff00);           // whole character, ground hidden
  const parts = [];
  for (const [key, meshes] of groups) {
    const set = new Set(meshes);
    const prev = all.map((m) => m.visible);
    // contribution: hide just this part
    meshes.forEach((m) => { m.visible = false; });
    const hid = K.plain(0x00ff00);
    all.forEach((m, i) => { m.visible = prev[i]; });
    let contrib = 0;
    for (let i = 0; i < base.length; i += 4) {
      const d = Math.abs(base[i] - hid[i]) + Math.abs(base[i + 1] - hid[i + 1]) + Math.abs(base[i + 2] - hid[i + 2]);
      if (d > 12) contrib++;
    }
    // footprint: only this part visible
    all.forEach((m) => { m.visible = set.has(m); });
    const iso = K.plain(0x00ff00);
    all.forEach((m, i) => { m.visible = prev[i]; });
    const im = K.maskFrom(iso);
    const ib = K.bboxOf(im);
    parts.push({
      part: key, meshes: meshes.length,
      foot: ib ? ib.n : 0, contrib,
      ratio: ib && ib.n ? +(contrib / ib.n).toFixed(3) : null,
      bbox: ib ? [ib.x0, ib.y0, ib.w, ib.h] : null,
    });
  }

  // ---- head mass footprint (identity mass = meshes under 'head' but not 'face')
  const headMeshes = (groups.get('head') ?? []);
  let headBox = null;
  if (headMeshes.length) {
    const set = new Set(headMeshes);
    const prev = all.map((m) => m.visible);
    all.forEach((m) => { m.visible = set.has(m); });
    const iso = K.plain(0x00ff00);
    all.forEach((m, i) => { m.visible = prev[i]; });
    headBox = K.bboxOf(K.maskFrom(iso));
  }
  // ---- face-part footprints, per mesh (eyes/brows/mouth live here) ----------
  const faceMeshes = (groups.get('face') ?? []);
  const faceParts = [];
  for (const m of faceMeshes) {
    const prev = all.map((x) => x.visible);
    all.forEach((x) => { x.visible = x === m; });
    const iso = K.plain(0x00ff00);
    all.forEach((x, i) => { x.visible = prev[i]; });
    const b = K.bboxOf(K.maskFrom(iso));
    // and how much of it survives in the full render
    m.visible = false;
    const hid = K.plain(0x00ff00);
    m.visible = true;
    let contrib = 0;
    for (let i = 0; i < base.length; i += 4) {
      const d = Math.abs(base[i] - hid[i]) + Math.abs(base[i + 1] - hid[i + 1]) + Math.abs(base[i + 2] - hid[i + 2]);
      if (d > 12) contrib++;
    }
    const col = m.material && m.material.color ? '#' + m.material.color.getHexString() : null;
    faceParts.push({ color: col, foot: b ? b.n : 0, contrib, bbox: b ? [b.x0, b.y0, b.w, b.h] : null });
  }

  // ---- ink blob census on the full render (what a viewer actually sees) -----
  // connected components of dark pixels inside the character mask
  const px = base;
  const lum = new Float32Array(W * H);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) lum[j] = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
  const ink = new Uint8Array(W * H);
  for (let j = 0; j < W * H; j++) ink[j] = maskAll[j] && lum[j] < 0.20 ? 1 : 0;
  const seen = new Uint8Array(W * H);
  const blobs = [];
  const stack = new Int32Array(W * H);
  for (let j = 0; j < W * H; j++) {
    if (!ink[j] || seen[j]) continue;
    let sp = 0; stack[sp++] = j; seen[j] = 1;
    let n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, sx = 0, sy = 0;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % W, y = (p / W) | 0;
      n++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && ink[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < W - 1 && ink[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && ink[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
      if (y < H - 1 && ink[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
    }
    if (n >= 12) blobs.push({ n, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: Math.round(sx / n), cy: Math.round(sy / n), x0, y0 });
  }
  blobs.sort((p, q) => q.n - p.n);

  if (K.ground) K.ground.visible = gv;

  // ---- rim ablation, on the SHIPPED post-processed frame -------------------
  const rim = stage.lighting.rim, key = stage.lighting.key;
  const shot = () => { stage.render(0); stage.render(0); return K.read(); };
  const full = shot();
  const i0 = rim.intensity; rim.intensity = 0;
  const noRim = shot();
  rim.intensity = i0;
  const k0 = key.intensity; key.intensity = 0;
  const noKey = shot();
  key.intensity = k0;

  // edge band: character pixels within 3px of the mask boundary
  const edge = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const j = y * W + x;
    if (!maskAll[j]) continue;
    if (!maskAll[j - 1] || !maskAll[j + 1] || !maskAll[j - W] || !maskAll[j + W]) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const k2 = (y + dy) * W + (x + dx);
        if (k2 >= 0 && k2 < W * H && maskAll[k2]) edge[k2] = 1;
      }
    }
  }
  const stat = (b) => {
    let sBody = 0, nBody = 0, sEdge = 0, nEdge = 0, mx = 0, over4 = 0;
    for (let j = 0; j < W * H; j++) {
      if (!maskAll[j]) continue;
      const i = j * 4;
      const d = (Math.abs(full[i] - b[i]) + Math.abs(full[i + 1] - b[i + 1]) + Math.abs(full[i + 2] - b[i + 2])) / 3;
      sBody += d; nBody++;
      if (d > mx) mx = d;
      if (d > 4) over4++;
      if (edge[j]) { sEdge += d; nEdge++; }
    }
    return {
      bodyMean: +(sBody / Math.max(1, nBody)).toFixed(3),
      edgeMean: +(sEdge / Math.max(1, nEdge)).toFixed(3),
      max: +mx.toFixed(1),
      pctOver4: +(100 * over4 / Math.max(1, nBody)).toFixed(2),
      bodyPx: nBody, edgePx: nEdge,
    };
  };

  return {
    canvas: [W, H],
    charBBox: bboxAll ? [bboxAll.x0, bboxAll.y0, bboxAll.w, bboxAll.h, bboxAll.n] : null,
    headBBox: headBox ? [headBox.x0, headBox.y0, headBox.w, headBox.h, headBox.n] : null,
    parts: parts.sort((p, q) => (p.ratio ?? 9) - (q.ratio ?? 9)),
    faceParts,
    inkBlobs: blobs.slice(0, 10),
    rimAblation: stat(noRim),
    keyAblation: stat(noKey),
  };
};

async function boot(page, url, ready) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.waitForFunction('window.__stage && window.__stage.scene', null, { timeout: 60000 });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });

try {
  if (mode === 'lights') {
    const out = {};
    let page = await newPage(browser, 900, 1100);
    await boot(page, `${BASE}/preview.html?piece=character&id=donut&anim=idle&t=1.5&shot=1`, 'window.__previewReady === true');
    await page.evaluate(TOOLKIT);
    out.preview_character = await page.evaluate(() => window.__K.lights());
    await page.close();

    page = await newPage(browser, 900, 700);
    await boot(page, `${BASE}/preview.html?piece=arena&shot=1`, 'window.__previewReady === true');
    await page.evaluate(TOOLKIT);
    out.preview_arena = await page.evaluate(() => window.__K.lights());
    await page.close();

    page = await newPage(browser, 1300, 740);
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    await page.goto(`${BASE}/?player=donut&enemy=pizza&simSpeed=1&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
    await page.waitForFunction('window.__stage && window.__stage.scene', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.evaluate(TOOLKIT);
    out.match = await page.evaluate(() => window.__K.lights());
    await page.close();

    console.log(JSON.stringify(out, null, 2));
    await writeFile(`${OUT}/lights.json`, JSON.stringify(out, null, 2));
  } else if (mode === 'chars') {
    const results = {};
    for (const id of IDS) {
      const page = await newPage(browser, W, H);
      try {
        await boot(page, `${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1`, 'window.__previewReady === true');
        await page.evaluate(TOOLKIT);
        const r = await page.evaluate(MEASURE);
        results[id] = r;
        console.log(`✓ ${id}  buried:`, r.parts.filter((p) => p.foot > 40 && (p.ratio ?? 1) < 0.15).map((p) => p.part).join(',') || '-',
          ' rim edgeMean:', r.rimAblation.edgeMean, ' key edgeMean:', r.keyAblation.edgeMean);
      } catch (e) {
        console.error(`✗ ${id}: ${e}`);
        results[id] = { error: String(e) };
      } finally { await page.close(); }
    }
    await writeFile(`${OUT}/chars.json`, JSON.stringify(results, null, 2));
    console.log(`wrote ${OUT}/chars.json`);
  }
} finally {
  await browser.close();
}
