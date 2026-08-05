#!/usr/bin/env node
/**
 * RECON, throwaway. Answers the mechanical questions the value-ladder instrument
 * depends on, BEFORE any of it is built:
 *
 *  1. Does `window.__stage` on the live match route expose the match Stage, and can
 *     part visibility be toggled + re-rendered through the post chain there?
 *  2. How many pixels tall is the player at shipped 1600x900, and at 3200x1800?
 *  3. Does `window.__fairView()` return the SAME ground window at both resolutions?
 *     (If not, a supersampled capture is a different framing and is worthless.)
 *  4. How long does one station cost, so 11 x 18 can be costed honestly.
 *
 * Read-only. Writes nothing under src/.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL;
if (!BASE) { console.error('PREVIEW_BASE unset — run under tools/tmp/headserve.mjs'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

/** Two-clear-colour matte of ONE object subtree, at full drawing-buffer resolution. */
const RECON = () => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const r = stage.renderer, scene = stage.scene, cam = stage.rig && stage.rig.camera;
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;

  const casts = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });

  // joints present under each cast root
  const JOINTS = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
  const jointsFound = {};
  for (const c of casts) {
    const seen = new Set();
    let meshes = 0;
    c.traverse((o) => { if (JOINTS.includes(o.name)) seen.add(o.name); if (o.isMesh) meshes++; });
    jointsFound[c.name] = { joints: [...seen].sort(), meshes };
  }

  // matte of a single root
  const shot = () => { const p = new Uint8Array(Wp * Hp * 4); gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
  const matteOf = (roots) => {
    const savedBg = scene.background, savedShadow = r.shadowMap.enabled, savedAlpha = r.getClearAlpha();
    const hidden = [];
    const topRoots = new Set();
    for (const rt of roots) { let n = rt; while (n.parent && n.parent !== scene) n = n.parent; topRoots.add(n); }
    for (const kid of scene.children) { if (!topRoots.has(kid) && kid.visible) { hidden.push(kid); kid.visible = false; } }
    let A, B;
    try {
      scene.background = null; r.shadowMap.enabled = false; r.autoClear = true; r.setRenderTarget(null);
      r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam); A = shot();
      r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam); B = shot();
    } finally {
      for (const k of hidden) k.visible = true;
      scene.background = savedBg; r.shadowMap.enabled = savedShadow; r.setClearColor(0x000000, savedAlpha);
    }
    const m = new Uint8Array(Wp * Hp);
    let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let i = 0, j = 0; i < A.length; i += 4, j++) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
      if (d < 32) { m[j] = 1; n++; const x = j % Wp, y = (j / Wp) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { mask: m, n, bbox: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null };
  };

  const per = casts.map((c) => { const mm = matteOf([c]); return { name: c.name, px: mm.n, bbox: mm.bbox }; });

  // Can we toggle a joint group and see the composited frame change?
  const t0 = performance.now();
  stage.render(0); stage.render(0);
  const before = shot();
  const head = casts.length ? casts[0].getObjectByName('head') : null;
  let changed = null;
  if (head) {
    head.visible = false;
    stage.render(0); stage.render(0);
    const after = shot();
    head.visible = true;
    let diff = 0;
    for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 12) diff++;
    changed = diff;
  }
  const msPerToggle = +((performance.now() - t0) / 3).toFixed(1);

  return {
    buffer: [Wp, Hp],
    cssSize: [r.domElement.clientWidth, r.domElement.clientHeight],
    pixelRatio: r.getPixelRatio(),
    casts: per, jointsFound,
    headHideChangedPx: changed,
    msPerRenderReadTriple: msPerToggle,
    fairView: window.__fairView ? window.__fairView() : null,
  };
};

const OUT = 'shots/vl/recon';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const out = {};
try {
  for (const [tag, W, H, dsf] of [['shipped', 1600, 900, 1], ['ss2', 1600, 900, 2], ['wide', 3200, 1800, 1]]) {
    const t0 = Date.now();
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf });
    page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
    await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
    const url = `${BASE}/?player=hamburger&enemy=donut&px=700&py=640&fogRadius=850&simSpeed=0.02&pointerLock=0`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction('window.__gameReady === true', null, { timeout: 120000 });
    const tReady = Date.now() - t0;
    await page.waitForTimeout(900);
    const t1 = Date.now();
    const r = await page.evaluate(RECON);
    r.msReady = tReady; r.msRecon = Date.now() - t1; r.viewport = [W, H, dsf];
    out[tag] = r;
    console.log(`\n── ${tag} ${W}x${H} dsf${dsf} — ready ${tReady}ms, recon ${r.msRecon}ms`);
    console.log(JSON.stringify(r, null, 2).slice(0, 2600));
    await page.screenshot({ path: `${OUT}/${tag}.png` });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${OUT}/recon.json`, JSON.stringify(out, null, 2));
console.log(`\nwrote ${OUT}/recon.json`);
