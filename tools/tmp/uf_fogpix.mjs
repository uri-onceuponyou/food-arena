#!/usr/bin/env node
/**
 * UF_FOGPIX — WHERE DOES THE FOG *LOOK* LIKE IT STARTS, IN THE PIXELS URI SEES?
 *
 * Uri, playing the deployed build: *"It seems like something in the fog doesn't make
 * sense. It starts decreasing my HP before it reaches me."*
 *
 * The sim's rule (`sim.ts:1002`) is a circle: `hypot(f - arena.center) > safeRadius`.
 * That is bearing-independent by construction. So if the complaint is real, the
 * DRAWN boundary must be bearing-DEPENDENT — and it is drawn by three cooperating
 * layers (`arena/fogRing.ts`), one of which is a horizontal plane 3.2 m in the air
 * that is registered to the ground by a single rigid translation.
 *
 * ── What this measures ─────────────────────────────────────────────────────────
 * For each bearing, at a pinned ring radius, the LUMA DROP the fog contributes at a
 * series of known GROUND RADII, sampled at the screen pixels those ground points
 * project to. Per-layer, by ablation, in one page load with the camera frozen:
 *
 *   shipped                     everything on
 *   canopyOff                   `fog_canopy__no_outline`.visible = false
 *   curtainOff                  `fog_curtain__no_outline`.visible = false
 *   edgeOff                     `fog_edge__no_outline`.visible = false
 *   allOff                      `fog_boundary`.visible = false          <- the reference
 *   canopyGreen                 canopy vertex COLOURS -> pure green, alphas untouched
 *
 * `drop_X(rho) = (luma[X-off] - luma[shipped]) / luma[X-off]` is then layer X's own
 * contribution at ground radius rho, and the radius where it leaves zero is where
 * that layer visually begins.
 *
 * ── Controls, because without them this measures nothing ───────────────────────
 *  SELF-PAIR   two `stage.render(0)` calls with NOTHING touched must differ by 0 px.
 *              rAF is stubbed, the CSS HUD is stilled and hidden, and `dt = 0` holds
 *              the camera shake (`camera.ts:update`'s guard). If this is not 0, every
 *              number below is noise and the tool refuses.
 *  POSITIVE    deep inside must be ~0% drop (fogRing's own acceptance test says
 *              bit-identical) and deep outside must be a large drop (its test says
 *              >= 30%). If those two do not separate, the instrument is blind.
 *  ABLATION    `canopyGreen` must MOVE the frame. "It isn't there" has meant "it is
 *              there and invisible" twenty times here; a violet mass that does not
 *              change when the canopy is recoloured is not the canopy.
 *  PROJECTION  my world->screen is checked against the SHIPPED one
 *              (`__vfxDebugScreen.player`, i.e. `match.ts:projectPointToScreen`) at
 *              every station. Non-zero error aborts.
 *
 * ⚠️ `?fogRadius=` at or below 661.67 wu is SNAPPED to sudden death by
 * `match.ts:applyQaSetup`, silently apart from a console warning. This tool asserts
 * page-side that the radar disc it got back is the radius it asked for.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/uf_fogpix.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('uf_fogpix: need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = resolve(args.out ?? 'shots/uf/fogpix');
const W = Number(args.w ?? 1280), H = Number(args.h ?? 720);
const R = Number(args.fog ?? 900);          // > 661.67, or applyQaSetup snaps to sudden death
const SIM = args.sim ?? '0.02';
const CX = 1400, CY = 1000;                 // asserted against `fog_boundary`.position page-side

/** Player stand-off per bearing, chosen from `uf_recon.mjs`: the frame reaches ~100 wu
 *  toward the camera and ~275 wu away from it along the camera axis, and ~±260 wu
 *  across it. So the player is parked where the R±180 window is actually ON CANVAS. */
const BEARINGS = [
  { id: 'N', ux: 0, uy: -1, d: R - 90 },   // boundary AWAY from the camera (up-screen)
  { id: 'S', ux: 0, uy: 1, d: R + 60 },    // boundary TOWARD the camera (down-screen)
  { id: 'E', ux: 1, uy: 0, d: R - 120 },   // boundary across the camera axis
  { id: 'W', ux: -1, uy: 0, d: R - 120 },
  { id: 'NE', ux: Math.SQRT1_2, uy: -Math.SQRT1_2, d: R - 90 },
  { id: 'SW', ux: -Math.SQRT1_2, uy: Math.SQRT1_2, d: R + 60 },
];

const RHO_FROM = R - 170, RHO_TO = R + 190, RHO_STEP = 10;
const LATERAL = [-120, -100, -80, -60, -40, 40, 60, 80, 100, 120]; // wu, off the bearing line
const KEEP_PX = 46;   // min screen distance from any fighter's ground point
const PATCH = 2;      // half-size of the sampled patch, px (5x5)

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'uf-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
                + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

/** Build the sample grid page-side, through the SHIPPED camera. */
const BUILD_SAMPLES = (cfg) => {
  const w = window;
  const st = w.__stage;
  const cam = st.rig.camera;
  const r = st.canvas.getBoundingClientRect();
  const S = 0.05;
  const v = cam.position.clone();
  const toScreen = (xwu, ywu) => {
    v.set(xwu * S, 0, ywu * S).project(cam);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  };
  const fogRoot = st.scene.getObjectByName('fog_boundary');
  const centre = { x: fogRoot.position.x / S, y: fogRoot.position.z / S };

  const screens = w.__vfxDebugScreen ?? {};
  const avoid = (screens.slots ?? [screens.player, screens.enemy]).filter(Boolean);

  // 🚨 PROVE THE FRAME IS THE ONE ASKED FOR. `match.ts:applyQaSetup` SNAPS any
  // `?fogRadius=` at or below 661.67 wu to sudden death (radius 0) with only a console
  // warning, and four shipped stations were silently photographing that frame. So read
  // the radius back out of the SHIPPED MESHES: `buildAnnulus.setRadius` writes ring r's
  // first vertex at (cos0 * rm, 0, sin0 * rm), i.e. x = radius in metres. Ring 0 of the
  // canopy is `safeRadius + 12`; ring 1 of the ground band is `safeRadius - 1`.
  const SEG = 128;
  const ringR = (mesh, ring) => mesh.geometry.attributes.position.getX(ring * SEG) / S;
  const canopyMesh = st.scene.getObjectByName('fog_canopy__no_outline');
  const edgeMesh = st.scene.getObjectByName('fog_edge__no_outline');
  const radiusFromMesh = {
    canopyRing0: ringR(canopyMesh, 0),      // = safeRadius + 12
    edgeRing1: ringR(edgeMesh, 1),          // = safeRadius - 1
    canopyOffsetM: { x: canopyMesh.position.x, y: canopyMesh.position.y, z: canopyMesh.position.z },
  };

  const me = w.__vfxDebugFighters?.player ?? null;
  const mine = me ? toScreen(me.x, me.y) : null;
  const shipped = screens.player ?? null;

  const rows = [];
  for (let rho = cfg.from; rho <= cfg.to + 1e-6; rho += cfg.step) {
    const pts = [];
    for (const lat of cfg.lateral) {
      // A point at ground radius `rho`, displaced `lat` wu along the arc.
      const ang = Math.atan2(cfg.uy, cfg.ux) + lat / rho;
      const gx = centre.x + Math.cos(ang) * rho, gy = centre.y + Math.sin(ang) * rho;
      const p = toScreen(gx, gy);
      const on = p.x >= r.left + 4 && p.x < r.right - 4 && p.y >= r.top + 4 && p.y < r.bottom - 4;
      const clear = avoid.every((a) => Math.hypot(p.x - a.x, p.y - a.y) >= cfg.keepPx);
      if (on && clear) pts.push({ x: Math.round(p.x), y: Math.round(p.y), gx: Math.round(gx), gy: Math.round(gy), lat });
    }
    rows.push({ rho: Math.round(rho), pts });
  }
  return {
    rows, centre, radiusFromMesh,
    canvasRect: { left: r.left, top: r.top, width: r.width, height: r.height },
    camHeightM: cam.position.y, pitchDeg: st.rig.pitchDeg, yawDeg: st.rig.yawDeg,
    camNadirWU: { x: cam.position.x / S, y: cam.position.z / S },
    me, mine, shipped,
    projErr: (mine && shipped) ? Math.hypot(mine.x - shipped.x, mine.y - shipped.y) : null,
    zonePill: (() => {
      const el = [...document.querySelectorAll('*')].find((e) => e.textContent === '▲ OUTSIDE THE ZONE');
      return el ? { present: true, visible: getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0' } : { present: false };
    })(),
  };
};

const SET_ARM = (arm) => {
  const st = window.__stage;
  const get = (n) => st.scene.getObjectByName(n);
  const root = get('fog_boundary'), canopy = get('fog_canopy__no_outline');
  const curtain = get('fog_curtain__no_outline'), edge = get('fog_edge__no_outline');
  root.visible = true; canopy.visible = true; curtain.visible = true; edge.visible = true;
  const col = canopy.geometry.attributes.color;
  // restore violet (FIELD_COLOR 0x2A0B47) on every ring; alphas are never touched
  const restore = () => {
    for (let i = 0; i < col.count; i++) col.setXYZW(i, 0x2A / 255, 0x0B / 255, 0x47 / 255, col.getW(i));
    col.needsUpdate = true;
  };
  restore();
  if (arm === 'canopyOff') canopy.visible = false;
  else if (arm === 'curtainOff') curtain.visible = false;
  else if (arm === 'edgeOff') edge.visible = false;
  else if (arm === 'allOff') root.visible = false;
  else if (arm === 'canopyGreen') {
    for (let i = 0; i < col.count; i++) col.setXYZW(i, 0, 1, 0, col.getW(i));
    col.needsUpdate = true;
  }
  st.render(0);   // dt = 0: `rig.update` holds the shake instead of re-rolling it
  return { root: root.visible, canopy: canopy.visible, curtain: curtain.visible, edge: edge.visible };
};

const ARMS = ['shipped', 'canopyOff', 'curtainOff', 'edgeOff', 'allOff', 'canopyGreen'];

const luma = (buf, info, x, y, k) => {
  let s = 0, n = 0;
  for (let dy = -k; dy <= k; dy++) {
    for (let dx = -k; dx <= k; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= info.width || py >= info.height) continue;
      const i = (py * info.width + px) * info.channels;
      s += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
      n++;
    }
  }
  return n ? s / n : NaN;
};
const median = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : NaN; };

async function diffPx(a, b) {
  const [A, B] = await Promise.all([a, b].map((p) => sharp(p).raw().toBuffer({ resolveWithObject: true })));
  if (A.info.width !== B.info.width) return -1;
  const ch = A.info.channels, n = A.info.width * A.info.height;
  let px = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) if (A.data[i * ch + c] !== B.data[i * ch + c]) { px++; break; }
  }
  return px;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const out = { base: BASE, viewport: [W, H], fogRadius: R, centre: [CX, CY], stations: [] };
  let refused = null;
  const only = args.only ? String(args.only).split(',') : null;
  try {
    for (const b of BEARINGS) {
      if (only && !only.includes(b.id)) continue;
      const px = Math.round(CX + b.ux * b.d), py = Math.round(CY + b.uy * b.d);
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const warns = [];
      page.on('console', (m) => { const t = m.text(); if (/\[QA\]/.test(t)) warns.push(t.slice(0, 240)); });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      const url = `${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=${R}&simSpeed=${SIM}&pointerLock=0`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(1800);

      // The money shot, HUD STILL VISIBLE — this is the picture of Uri's sentence.
      await page.screenshot({ path: join(OUT, `hud_${b.id}.png`) });

      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(250);
      const animsRunning = await page.evaluate(PAGE_STILL_HUD);
      const grid = await page.evaluate(BUILD_SAMPLES, {
        from: RHO_FROM, to: RHO_TO, step: RHO_STEP, lateral: LATERAL,
        ux: b.ux, uy: b.uy, keepPx: KEEP_PX,
      });
      await page.evaluate(() => { for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = 'hidden'; });

      // ── SELF-PAIR CONTROL, before any arm. Two renders, nothing touched.
      await page.evaluate(SET_ARM, 'shipped');
      const sp0 = join(OUT, `${b.id}_selfpair_0.png`); await page.screenshot({ path: sp0 });
      await page.evaluate(() => window.__stage.render(0));
      const sp1 = join(OUT, `${b.id}_selfpair_1.png`); await page.screenshot({ path: sp1 });
      const selfPair = await diffPx(sp0, sp1);

      const shots = {};
      const vis = {};
      for (const arm of ARMS) {
        vis[arm] = await page.evaluate(SET_ARM, arm);
        const p = join(OUT, `${b.id}_${arm}.png`);
        await page.screenshot({ path: p });
        shots[arm] = p;
      }
      await page.close();

      if (grid.projErr === null || grid.projErr > 0.01) { refused = `${b.id}: projection error ${grid.projErr}`; break; }
      if (selfPair !== 0) { refused = `${b.id}: SELF-PAIR is ${selfPair} px, not 0 — the instrument cannot see "no change"`; break; }
      const rFromCanopy = grid.radiusFromMesh.canopyRing0 - 12, rFromEdge = grid.radiusFromMesh.edgeRing1 + 1;
      if (Math.abs(rFromCanopy - R) > 8 || Math.abs(rFromEdge - R) > 8) {
        refused = `${b.id}: the shipped meshes say safeRadius = ${rFromCanopy.toFixed(1)} / ${rFromEdge.toFixed(1)}, not the ${R} asked for`;
        break;
      }

      const raw = {};
      for (const arm of ARMS) raw[arm] = await sharp(shots[arm]).raw().toBuffer({ resolveWithObject: true });
      const curve = grid.rows.map((row) => {
        const vals = {};
        for (const arm of ARMS) vals[arm] = median(row.pts.map((p) => luma(raw[arm].data, raw[arm].info, p.x, p.y, PATCH)));
        const rel = (ref) => (Number.isFinite(vals[ref]) && vals[ref] > 0 ? (vals[ref] - vals.shipped) / vals[ref] : NaN);
        return {
          rho: row.rho, n: row.pts.length, ...vals,
          dropAll: rel('allOff'), dropCanopy: rel('canopyOff'), dropCurtain: rel('curtainOff'), dropEdge: rel('edgeOff'),
          greenDelta: Number.isFinite(vals.canopyGreen) ? vals.canopyGreen - vals.shipped : NaN,
        };
      });
      const abl = await diffPx(shots.shipped, shots.canopyGreen);
      const ablHide = await diffPx(shots.shipped, shots.canopyOff);

      out.stations.push({
        id: b.id, px, py, d: b.d, selfPair, animsRunning, warns, grid: {
          centre: grid.centre, radiusFromMesh: grid.radiusFromMesh, camHeightM: grid.camHeightM,
          pitchDeg: grid.pitchDeg, yawDeg: grid.yawDeg, camNadirWU: grid.camNadirWU,
          projErr: grid.projErr, zonePill: grid.zonePill, me: grid.me,
        },
        ablationGreenPx: abl, ablationHidePx: ablHide, curve, visibility: vis,
        // The SCREEN points every number above was read at. Dumped so `uf_overlay.mjs`
        // can draw them back onto the frame: a passing selftest is not evidence that
        // the thing it points at is right (CLAUDE.md rule 6).
        samplePoints: grid.rows,
      });

      const cross = (key, thr) => { const r = curve.find((c) => c[key] >= thr); return r ? r.rho : null; };
      console.log(`\n── ${b.id}  player (${px},${py})  selfpair ${selfPair}px  anims ${animsRunning}  projErr ${grid.projErr.toFixed(4)}`);
      console.log(`   nadir ${grid.camNadirWU.x.toFixed(0)},${grid.camNadirWU.y.toFixed(0)}  camH ${grid.camHeightM.toFixed(2)} m  hp ${grid.me?.hp}  zonePill ${JSON.stringify(grid.zonePill)}`);
      console.log(`   safeRadius read back OUT OF THE SHIPPED MESHES: canopy ring0-12 = ${rFromCanopy.toFixed(2)}  ·  edge ring1+1 = ${rFromEdge.toFixed(2)}  (asked ${R}) · canopy translation ${JSON.stringify(grid.radiusFromMesh.canopyOffsetM)} m`);
      console.log(`   ablation: canopy->green moves ${abl} px · canopy hidden moves ${ablHide} px`);
      console.log(`   sample counts ${Math.min(...curve.map((c) => c.n))}..${Math.max(...curve.map((c) => c.n))} per radius`);
      console.log(`   canopy drop crosses  2%: ${cross('dropCanopy', 0.02)}  10%: ${cross('dropCanopy', 0.10)}  20%: ${cross('dropCanopy', 0.20)}   (damage line ${R})`);
      console.log(`   ALL-fog drop crosses 2%: ${cross('dropAll', 0.02)}  10%: ${cross('dropAll', 0.10)}  20%: ${cross('dropAll', 0.20)}`);
      console.log('    rho   dropAll  dropCanopy dropCurtain dropEdge   n');
      for (const c of curve) {
        if ((c.rho - RHO_FROM) % 20) continue;
        const f = (v) => (Number.isFinite(v) ? (v * 100).toFixed(1).padStart(7) : '     --');
        console.log(`   ${String(c.rho).padStart(4)} ${f(c.dropAll)} ${f(c.dropCanopy)} ${f(c.dropCurtain)} ${f(c.dropEdge)}  ${String(c.n).padStart(3)}`);
      }
    }
  } finally { await browser.close(); }

  await writeFile(join(OUT, 'fogpix.json'), JSON.stringify(out, null, 2));
  if (refused) { console.log(`\n✗ REFUSED — ${refused}. No number above may be quoted.`); process.exit(1); }

  console.log('\n── controls ──');
  const bad = out.stations.filter((s) => s.selfPair !== 0);
  console.log(bad.length ? `  ✗ self-pair non-zero at ${bad.map((s) => s.id).join(', ')}` : `  ✓ self-pair 0 px at all ${out.stations.length} stations — the instrument can see "no change".`);
  for (const s of out.stations) {
    const inside = s.curve[0], outside = s.curve[s.curve.length - 1];
    console.log(`  ${s.id}: deep-inside (rho ${inside.rho}) dropAll ${(inside.dropAll * 100).toFixed(2)}%  ·  deep-outside (rho ${outside.rho}) dropAll ${(outside.dropAll * 100).toFixed(2)}%  ·  canopy->green ${s.ablationGreenPx} px`);
  }
  console.log(`\nwrote ${join(OUT, 'fogpix.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
