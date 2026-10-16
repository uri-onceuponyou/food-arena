#!/usr/bin/env node
/**
 * K1_REACH — how far can the player ACTUALLY see, in the running game, in each direction?
 *
 * `__fairView()` reports the solve's own claim. This reads the LIVE match camera instead:
 *   1. the true ground reach from the player along 8 bearings — binary search on the
 *      projection through `__stage.rig.camera`, the same `project()` `match.ts:groundOnScreen`
 *      uses to decide whether a fighter's HUD exists;
 *   2. 🔴 THE PIXEL PROOF: a flat marker disc is planted on the ground at D wu from the
 *      player toward each of S (toward the camera, the screen's BOTTOM), N, E and W, drawn on
 *      top of everything (depthTest off, so only the frame edge can hide it), and the frame
 *      is diffed with and without it. A marker inside the guaranteed radius that moves 0 px
 *      is a ground point the player is promised and cannot see.
 *   Controls: NULL (two renders with no marker differ by 0 px — otherwise every diff is
 *   noise); POSITIVE (a marker AT the player must move pixels — otherwise the diff cannot
 *   see a marker at all); RESTORE (after all markers, the frame equals the first render).
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/k1_reach.mjs --url '{URL}' \
 *     --out <dir> [--qs 'camPitch=50&camAim=centred'] [--tag name] [--w 1600 --h 900] [--d 150,194]
 *
 * Exit 0 always on a completed measurement (it is an instrument, not a gate); exit 2 when a
 * CONTROL fails, because then nothing it printed means anything.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
if (!BASE || BASE.includes(':5173')) { console.error('k1_reach: need --url of a FROZEN snapshot (never :5173)'); process.exit(2); }
const OUT = resolve(arg('--out', 'shots/k1/reach'));
const QS = arg('--qs', '');
const TAG = arg('--tag', QS ? QS.replace(/[^a-z0-9]+/gi, '_') : 'shipped');
const W = Number(arg('--w', 1600)); const H = Number(arg('--h', 900));
const DS = String(arg('--d', '150,194')).split(',').map(Number);
const PX = Number(arg('--px', 1560)); const PY = Number(arg('--py', 1000));
mkdirSync(OUT, { recursive: true });

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const CLOCK = () => {
  const realNow = performance.now.bind(performance);
  let virt = 0;
  performance.now = () => virt;
  window.__clk = { advance(ms) { virt += ms; } };
  void realNow;
  let seed = 0x9e3779b9 >>> 0;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const PAGE = async ({ ds }) => {
  const stage = window.__stage; const rig = stage.rig; const cam = rig.camera;
  rig.shakeAmount = 0; rig.shakeOffset.set(0, 0, 0); rig.apply(); cam.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const S = 0.05;
  const me = window.__vfxDebugFighters?.slots?.[0];
  const px = me.x * S; const pz = me.y * S;
  const tgt = rig.targetUnits();
  const inFrame = (x, z) => { const p = new V(x, 0, z).project(cam); return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z <= 1; };
  const reach = (dx, dz) => {
    let lo = 0; let hi = 200;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (inFrame(px + dx * m, pz + dz * m)) lo = m; else hi = m; }
    return lo / S;
  };
  const bearings = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0], SE: [Math.SQRT1_2, Math.SQRT1_2], SW: [-Math.SQRT1_2, Math.SQRT1_2], NE: [Math.SQRT1_2, -Math.SQRT1_2], NW: [-Math.SQRT1_2, -Math.SQRT1_2] };
  const trueReach = Object.fromEntries(Object.entries(bearings).map(([k, [dx, dz]]) => [k, +reach(dx, dz).toFixed(1)]));
  const plNdc = new V(px, 0, pz).project(cam);

  // ── pixels ──
  const threeUrl = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/deps\/three(\.module)?\.js/.test(n))
    || performance.getEntriesByType('resource').map((r) => r.name).find((n) => /three/.test(n) && /\.js/.test(n));
  const THREE = await import(threeUrl);
  const cw = stage.canvas.width; const ch = stage.canvas.height;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  const ctx = c2.getContext('2d', { willReadFrequently: true });
  const shot = () => { stage.render(0); ctx.clearRect(0, 0, cw, ch); ctx.drawImage(stage.canvas, 0, 0); return ctx.getImageData(0, 0, cw, ch); };
  const diff = (a, b) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 30) n++; return n; };
  const A = shot(); const B = shot();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false, depthWrite: false, toneMapped: false });
  const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.04, 24);
  const plant = (x, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, 0.03, z); m.renderOrder = 9999; m.frustumCulled = false; stage.scene.add(m); return m; };
  const controls = { NULL: diff(A, B) };
  { const m = plant(px, pz); controls.POSITIVE = diff(A, shot()); stage.scene.remove(m); }
  const markers = [];
  const all = [];
  for (const d of ds) {
    for (const k of ['S', 'N', 'E', 'W']) {
      const [dx, dz] = bearings[k];
      const m = plant(px + dx * d * S, pz + dz * d * S);
      markers.push({ bearing: k, d, px: diff(A, shot()), onScreenByProjection: inFrame(px + dx * d * S, pz + dz * d * S) });
      stage.scene.remove(m);
    }
  }
  for (const k of ['S', 'N', 'E', 'W']) { const [dx, dz] = bearings[k]; all.push(plant(px + dx * ds[0] * S, pz + dz * ds[0] * S)); }
  stage.render(0);
  const withMarkers = stage.canvas.toDataURL('image/png');
  for (const m of all) stage.scene.remove(m);
  controls.RESTORE = diff(A, shot());
  geo.dispose(); mat.dispose();
  return {
    pitchDeg: rig.pitchDeg, aim: rig.aim ?? null, frameMode: rig.frameMode, search: location.search,
    canvas: [cw, ch], player: { x: me.x, y: me.y }, cameraTargetWu: tgt, playerNdc: { x: plNdc.x, y: plNdc.y },
    fairView: window.__fairView ? window.__fairView() : null, trueReach, markers, controls, withMarkers,
  };
};

const browser = await chromium.launch({ args: LAUNCH });
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(CLOCK);
  const q = new URLSearchParams({ player: 'hamburger', enemy: 'donut', px: String(PX), py: String(PY), pointerLock: '0' });
  for (const [k, v] of new URLSearchParams(QS)) q.set(k, v);
  const url = `${BASE}/?${q}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 90_000 });
  await page.evaluate(async () => { for (let i = 0; i < 30; i++) { window.__clk.advance(16.667); await new Promise((r) => requestAnimationFrame(() => r())); } });
  const r = await page.evaluate(PAGE, { ds: DS });
  const png = `${OUT}/${TAG}_${W}x${H}.png`;
  writeFileSync(png, Buffer.from(r.withMarkers.split(',')[1], 'base64'));
  delete r.withMarkers;
  writeFileSync(`${OUT}/${TAG}_${W}x${H}.json`, JSON.stringify({ url, ...r }, null, 1));
  const fv = r.fairView;
  console.log(`\nk1_reach ${TAG} @ ${W}x${H} — rig pitch ${r.pitchDeg} aim ${r.aim} (${r.frameMode}) · search ${r.search}`);
  console.log(`  player ${r.player.x},${r.player.y} · camera target ${r.cameraTargetWu.x.toFixed(1)},${r.cameraTargetWu.y.toFixed(1)} · player on screen at y=${((1 - r.playerNdc.y) / 2).toFixed(3)} of the height`);
  console.log(`  __fairView claims: near ${fv?.nearUnits.toFixed(1)} far ${fv?.farUnits.toFixed(1)} guaranteed ${fv?.guaranteedRadiusUnits.toFixed(1)} wu`);
  console.log(`  TRUE reach (wu):  ${Object.entries(r.trueReach).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  controls: NULL ${r.controls.NULL} px · POSITIVE ${r.controls.POSITIVE} px · RESTORE ${r.controls.RESTORE} px`);
  for (const m of r.markers) console.log(`  marker ${m.bearing} @ ${m.d} wu: ${String(m.px).padStart(5)} px moved · projection says ${m.onScreenByProjection ? 'ON' : 'OFF'} screen${m.px === 0 && m.d <= (fv?.guaranteedRadiusUnits ?? 0) ? '   <- INSIDE the guarantee, INVISIBLE' : ''}`);
  console.log(`  wrote ${png}`);
  if (r.controls.NULL !== 0 || r.controls.POSITIVE === 0 || r.controls.RESTORE !== 0) { console.log('  CONTROL FAILED — nothing above is evidence'); code = 2; }
  await ctx.close();
} finally {
  await browser.close();
}
process.exit(code);
