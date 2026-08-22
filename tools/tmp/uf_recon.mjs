#!/usr/bin/env node
/**
 * UF_RECON — establish the measuring frame for the fog-registration probe, in the
 * SHIPPED page, before any pixel claim is made.
 *
 * Uri: *"It seems like something in the fog doesn't make sense. It starts decreasing
 * my HP before it reaches me."*
 *
 * `uf_fogpix.mjs` needs to sample canvas pixels at KNOWN GROUND RADII along a bearing.
 * That needs a world->screen projection, and a projection I write myself is exactly the
 * kind of instrument this project keeps catching returning confident wrong answers. So
 * this tool does nothing but validate the frame:
 *
 *   1. my projection vs the SHIPPED one — `match.ts` publishes
 *      `__vfxDebugScreen.player`, which is `projectPointToScreen(f.x, f.y, 0)`: the
 *      player's GROUND point through the same camera. If my `Vector3.project(cam)`
 *      path does not land on it to within a pixel, my projection is wrong and every
 *      radius below it is fiction.
 *   2. the fog CENTRE read out of the scene graph (`fog_boundary`'s own
 *      `position`), not assumed to be (1400,1000).
 *   3. WORLD_SCALE — implied by (1). A wrong metres-per-unit cannot pass (1).
 *   4. which ground radii along each bearing are actually ON CANVAS, so the sweep is
 *      not silently sampling the letterbox.
 *   5. camera height / nadir / pitch, which is what any parallax claim is made of.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/uf_recon.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('uf_recon: need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = resolve(args.out ?? 'shots/uf/recon');
const W = Number(args.w ?? 1280), H = Number(args.h ?? 720);
const FOG_R = Number(args.fog ?? 900);
const SIM = args.sim ?? '0.02';

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

// Bearings in PROTOTYPE ground coords: x east, y south. The match camera sits at
// yaw 0, which `camera.ts:apply()` puts at +z = +y = SOUTH of the player, looking
// north. So "north" is the arc AWAY from the camera and "south" is the near arc.
const BEARINGS = [
  { id: 'N', ux: 0, uy: -1 },
  { id: 'S', ux: 0, uy: 1 },
  { id: 'E', ux: 1, uy: 0 },
  { id: 'W', ux: -1, uy: 0 },
];

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'uf-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

/** Everything the measuring frame is made of, read page-side in ONE evaluate. */
const FRAME = (probe) => {
  const w = window;
  const st = w.__stage;
  if (!st) return { err: 'no __stage' };
  const cam = st.rig.camera;
  const canvas = st.canvas;
  const r = canvas.getBoundingClientRect();
  const v = cam.position.clone();          // a real THREE.Vector3, without importing THREE
  const S = 0.05;                          // WORLD_SCALE — validated below, not trusted
  const toScreen = (xwu, ywu, hM = 0) => {
    v.set(xwu * S, hM, ywu * S).project(cam);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height, z: v.z };
  };
  const fogRoot = st.scene.getObjectByName('fog_boundary');
  const named = [];
  st.scene.traverse((o) => { if (/^fog_/.test(o.name)) named.push({ name: o.name, type: o.type, visible: o.visible, pos: [o.position.x, o.position.y, o.position.z] }); });

  const me = w.__vfxDebugFighters?.player ?? null;
  const shipped = w.__vfxDebugScreen?.player ?? null;
  const mine = me ? toScreen(me.x, me.y, 0) : null;

  // Camera geometry: height, and the ground point directly under the camera (nadir).
  const camPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };

  const onCanvas = (p) => p.x >= r.left && p.x < r.right && p.y >= r.top && p.y < r.bottom;
  const sweeps = {};
  for (const b of probe.bearings) {
    const row = [];
    for (let rad = probe.from; rad <= probe.to; rad += probe.step) {
      const gx = probe.cx + b.ux * rad, gy = probe.cy + b.uy * rad;
      const p = toScreen(gx, gy, 0);
      row.push({ rad, x: Math.round(p.x), y: Math.round(p.y), on: onCanvas(p) });
    }
    sweeps[b.id] = row;
  }

  return {
    canvasRect: { left: r.left, top: r.top, width: r.width, height: r.height },
    dpr: window.devicePixelRatio,
    camPos,
    camNadirWU: { x: camPos.x / S, y: camPos.z / S },
    camHeightM: camPos.y,
    pitchDeg: st.rig.pitchDeg, yawDeg: st.rig.yawDeg,
    fairView: w.__fairView ? w.__fairView() : null,
    fogRootPos: fogRoot ? { x: fogRoot.position.x / S, y: fogRoot.position.z / S } : null,
    fogMeshes: named,
    me, shipped, mine,
    projErr: (shipped && mine) ? { dx: mine.x - shipped.x, dy: mine.y - shipped.y } : null,
    sweeps,
  };
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const out = { base: BASE, viewport: [W, H], fogRadius: FOG_R, stations: [] };
  try {
    for (const b of BEARINGS) {
      // Player parked 150 wu INSIDE the boundary on this bearing, so the character's
      // own 2.1 m silhouette is nowhere near the pixels the sweep cares about.
      const d = FOG_R - 150;
      const px = Math.round(1400 + b.ux * d), py = Math.round(1000 + b.uy * d);
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const warnings = [];
      page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text().slice(0, 200)); });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      const url = `${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=${FOG_R}&simSpeed=${SIM}&pointerLock=0`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(1800);
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(250);
      const running = await page.evaluate(PAGE_STILL_HUD);
      await page.evaluate(() => { for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = 'hidden'; });
      const frame = await page.evaluate(FRAME, {
        cx: 1400, cy: 1000, from: FOG_R - 400, to: FOG_R + 400, step: 25,
        bearings: [b],
      });
      await page.screenshot({ path: join(OUT, `recon_${b.id}.png`) });
      await page.close();
      out.stations.push({ id: b.id, px, py, warnings, animsRunningAfterStill: running, ...frame });

      const s = frame.sweeps?.[b.id] ?? [];
      const on = s.filter((r) => r.on);
      console.log(`\n── bearing ${b.id}  player (${px},${py})  d=${d} wu from centre`);
      console.log(`   canvas ${JSON.stringify(frame.canvasRect)}  dpr ${frame.dpr}  anims running after still: ${running}`);
      console.log(`   camera pitch ${frame.pitchDeg} yaw ${frame.yawDeg}  height ${frame.camHeightM?.toFixed(3)} m  nadir (wu) ${JSON.stringify(frame.camNadirWU && { x: +frame.camNadirWU.x.toFixed(1), y: +frame.camNadirWU.y.toFixed(1) })}`);
      console.log(`   fog root centre (wu) ${JSON.stringify(frame.fogRootPos)}   meshes: ${frame.fogMeshes?.map((m) => m.name).join(', ')}`);
      console.log(`   fighter (${frame.me?.x}, ${frame.me?.y}) hp ${frame.me?.hp}`);
      console.log(`   PROJECTION CHECK  mine ${frame.mine && `${frame.mine.x.toFixed(2)},${frame.mine.y.toFixed(2)}`}  shipped ${frame.shipped && `${frame.shipped.x.toFixed(2)},${frame.shipped.y.toFixed(2)}`}  err ${frame.projErr && `${frame.projErr.dx.toFixed(3)},${frame.projErr.dy.toFixed(3)}`}`);
      console.log(`   on-canvas ground radii: ${on.length ? `${on[0].rad}..${on[on.length - 1].rad} wu (${on.length}/${s.length} samples)` : 'NONE'}`);
      if (warnings.length) console.log(`   console: ${warnings.slice(0, 3).join(' | ')}`);
    }
  } finally { await browser.close(); }
  await writeFile(join(OUT, 'recon.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${join(OUT, 'recon.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
