#!/usr/bin/env node
/**
 * PERSPECTIVE CONSISTENCY — is the service mat's edge on the same ground plane as the
 * tile grid, or is it drawn in a different projection?
 *
 * A blind critic's #1 fix: *"the teal play surface is bounded by a line that is exactly
 * horizontal in screen space along its top... the pink floor immediately above it is
 * drawn in clear perspective, its grout lines run at roughly 20-30 deg. A single ground
 * plane cannot produce both."*
 *
 * That is a claim about projection, not about taste, so it can be settled rather than
 * argued (`docs/LESSONS.md` §3 — take the symptom, re-derive the cause). This projects
 * KNOWN world-space segments through the shipped camera and prints their screen-space
 * angles:
 *
 *   - the hub mat's four edges (axis-aligned rectangle at y = the mat's own height)
 *   - tile grout lines at several depths, along the SAME world axes, on the same plane
 *
 * If the mat's edges and the grout lines at the same depth have the same angle, the mat
 * is on the plane and the critic's mechanism is wrong. If tile lines at DIFFERENT depths
 * disagree with each other, that is ordinary perspective convergence and the difference
 * the critic measured is a property of the camera, not of the geometry.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = process.env.PREVIEW_BASE ?? arg('url', 'http://localhost:5173');
const STATION = arg('station', '570:430');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const [px, py] = STATION.split(':');
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=993&simSpeed=0.02&pointerLock=0`,
  { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 60000 });
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const stage = window.__stage;
  const rig = stage.rig;
  const cam = rig.camera;
  const W = 1600, H = 900;
  const S = 0.05; // WORLD_SCALE

  // Find the real mats and the tile mesh, rather than trusting the source. Read the
  // world matrix directly (elements 0..15, column-major) so this needs no THREE import
  // in the page — the app does not expose one.
  const found = { pad: null, padBasis: null, tileBasis: null, padY: null };
  const basisDeg = (m) => {
    // Angle of the mesh's local +X and +Z axes in the world XZ plane.
    const e = m.elements;
    const ax = (Math.atan2(e[2], e[0]) * 180) / Math.PI;   // local +X
    const az = (Math.atan2(e[10], e[8]) * 180) / Math.PI;  // local +Z
    return [+ax.toFixed(3), +az.toFixed(3)];
  };
  stage.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === 'floor_utility_pad' && !found.pad) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      found.pad = [e[12], e[13], e[14]];
      found.padY = e[13];
      found.padBasis = basisDeg(o.matrixWorld);
    }
    if (o.isInstancedMesh && found.tileBasis === null) {
      o.updateWorldMatrix(true, false);
      found.tileBasis = basisDeg(o.matrixWorld);
    }
  });

  cam.updateMatrixWorld();
  const vp = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements;
  const proj = (wx, wy, wz) => {
    const x = vp[0] * wx + vp[4] * wy + vp[8] * wz + vp[12];
    const y = vp[1] * wx + vp[5] * wy + vp[9] * wz + vp[13];
    const w = vp[3] * wx + vp[7] * wy + vp[11] * wz + vp[15];
    return [((x / w) * 0.5 + 0.5) * W, (-(y / w) * 0.5 + 0.5) * H];
  };
  const angle = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

  // The hub mat is 400x280 wu centred on (700, 500), kerb +6 wu per side => the
  // VISIBLE outline is 412x292 about that centre. Sample its four edges at the mat's
  // own height, and the tile plane's X-parallel and Z-parallel lines at the SAME
  // world z / x as each of those edges plus a couple of others for the convergence
  // check. Tile top face is y = 0.015.
  const cx = 700 * S, cz = 500 * S;
  const hx = (412 / 2) * S, hz = (292 / 2) * S;
  const yPad = found.padY ?? 0.063;
  const yTile = 0.015;

  const rows = [];
  const seg = (label, a, b) => rows.push({ label, deg: +angle(proj(...a), proj(...b)).toFixed(2), a: proj(...a).map((n) => Math.round(n)), b: proj(...b).map((n) => Math.round(n)) });

  seg('MAT  north edge  (X-parallel)', [cx - hx, yPad, cz - hz], [cx + hx, yPad, cz - hz]);
  seg('MAT  south edge  (X-parallel)', [cx - hx, yPad, cz + hz], [cx + hx, yPad, cz + hz]);
  seg('MAT  west  edge  (Z-parallel)', [cx - hx, yPad, cz - hz], [cx - hx, yPad, cz + hz]);
  seg('MAT  east  edge  (Z-parallel)', [cx + hx, yPad, cz - hz], [cx + hx, yPad, cz + hz]);
  // Tile lines at the SAME depth as the mat's north/south edge — the direct comparison.
  seg('TILE X-line at mat north z ', [cx - hx, yTile, cz - hz], [cx + hx, yTile, cz - hz]);
  seg('TILE X-line at mat south z ', [cx - hx, yTile, cz + hz], [cx + hx, yTile, cz + hz]);
  seg('TILE Z-line at mat west  x ', [cx - hx, yTile, cz - hz], [cx - hx, yTile, cz + hz]);
  // Convergence check: the SAME world direction at three other depths.
  seg('TILE X-line 200wu nearer   ', [cx - hx, yTile, cz - hz - 200 * S], [cx + hx, yTile, cz - hz - 200 * S]);
  seg('TILE X-line 200wu further  ', [cx - hx, yTile, cz + hz + 200 * S], [cx + hx, yTile, cz + hz + 200 * S]);
  seg('TILE X-line 400wu further  ', [cx - hx, yTile, cz + hz + 400 * S], [cx + hx, yTile, cz + hz + 400 * S]);

  return { rows, cam: { pitchDeg: rig.pitchDeg, yawDeg: rig.yawDeg, fov: cam.fov }, found };
});

await browser.close();

console.log(`\ncamera  pitch ${out.cam.pitchDeg}deg  yaw ${out.cam.yawDeg}deg  fov ${out.cam.fov}`);
console.log(`mat mesh world rotation  ${out.found.padRot ? out.found.padRot.map((n) => n.toFixed(2)).join(' / ') : 'not found'}   (x/y/z deg)`);
console.log(`tile InstancedMesh rot   ${out.found.tileRot ? out.found.tileRot.map((n) => n.toFixed(2)).join(' / ') : 'not found'}`);
console.log('\nscreen-space angle of a world-space segment (deg; 0 = horizontal right)\n');
for (const r of out.rows) console.log(`  ${r.label}  ${String(r.deg).padStart(8)}   ${JSON.stringify(r.a)} -> ${JSON.stringify(r.b)}`);
console.log('');
