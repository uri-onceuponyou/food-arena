#!/usr/bin/env node
/**
 * UF_FOGEDGE — the APPARENT GROUND RADIUS of each drawn fog layer, per bearing.
 *
 * Uri: *"It seems like something in the fog doesn't make sense. It starts decreasing
 * my HP before it reaches me."*
 *
 * `sim.ts:1002` burns a fighter whose distance from `arena.center` exceeds
 * `state.safeRadius` — a circle, bearing-independent by construction. So the question
 * is: at what ground radius does each DRAWN layer of `arena/fogRing.ts` appear to
 * start, and does that answer depend on the bearing?
 *
 * ── Why this replaces `uf_fogpix`'s lateral-offset sampler ─────────────────────
 * That sampler took a median over ten points laid ±120 wu across the bearing. At the
 * north station six of the ten landed on a `prep_counter`, which is opaque and
 * OCCLUDES the ground band, so the median said "the crest paints nothing" when the
 * crest was simply behind a prop. A station standing inside a prop is one of the three
 * detectors `al_guard.mjs` exists for; it caught nothing here because these stations
 * are not in any fixture.
 *
 * The canopy is immune to that — it is drawn at 3.2 m with `renderOrder 8` and
 * `depthWrite:false`, i.e. OVER every prop — so its onset radius is measurable
 * everywhere. The ground band is not, and is reported with its occlusion visible
 * (per-bearing spread) rather than averaged into a lie.
 *
 * ── Method ────────────────────────────────────────────────────────────────────
 * One page load per station. rAF stubbed, HUD CSS stilled and hidden, camera frozen
 * (`stage.render(0)` — `camera.ts:update`'s `dt > 0` guard holds the shake).
 * Six arms by ablation in the SAME page, so both sides of every A/B are the same
 * frame apart from one `visible` flag:
 *
 *   shipped · canopyOff · curtainOff · edgeOff · allOff · canopyGreen
 *
 * Then, for each of N bearing rays out of the FOG'S OWN CENTRE (read from
 * `fog_boundary.position`, not assumed), walk ground radii outward and find the first
 * radius at which the layer's own contribution |luma(off) - luma(shipped)| clears a
 * threshold and HOLDS. That radius is where the layer visually begins.
 *
 * ── Controls ──────────────────────────────────────────────────────────────────
 *  SELF-PAIR    two renders, nothing touched, must differ by 0 px.
 *  FORWARD      my world->screen must equal the SHIPPED `__vfxDebugScreen.player`.
 *  INVERSE      unproject(that same screen point) must return the fighter's own world
 *               position — a known-answer check on the ray/ground-plane math.
 *  POSITIVE     deep inside must be 0.0 luma delta (fogRing's own acceptance test says
 *               bit-identical) and deep outside must be a large one.
 *  ABLATION     canopy -> pure green must MOVE the frame.
 *  RADIUS       `safeRadius` is read back out of the shipped MESH vertices, because
 *               `?fogRadius=` <= 661.67 wu is silently snapped to sudden death.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /tmp/fa-clean-072f245 -- \
 *     node tools/tmp/uf_fogedge.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) =>
  a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') === false ? all[i + 1] : true] : []).filter((x) => x.length));
const BASE = args.url ?? process.env.PREVIEW_BASE ?? null;
if (!BASE) { console.error('uf_fogedge: need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = resolve(args.out ?? 'shots/uf/fogedge');
const W = Number(args.w ?? 1280), H = Number(args.h ?? 720);
const R = Number(args.fog ?? 900);
const SIM = args.sim ?? '0.02';
const CX = 1400, CY = 1000;

/** Bearing in DEGREES measured the way `Math.atan2(uy, ux)` does on the prototype
 *  ground plane (x east, y south): 0 = east, 90 = SOUTH (toward the camera), 180 =
 *  west, 270 = NORTH (away from the camera). The match camera is yaw 0, which
 *  `camera.ts:apply` puts at +z = +y = SOUTH of the player. */
const STATIONS = [
  { id: 'N', deg: 270, d: R - 90 },
  { id: 'NE', deg: 315, d: R - 90 },
  { id: 'E', deg: 0, d: R - 120 },
  { id: 'SE', deg: 45, d: R + 40 },
  { id: 'S', deg: 90, d: R + 60 },
  { id: 'SW', deg: 135, d: R + 40 },
  { id: 'W', deg: 180, d: R - 120 },
  { id: 'NW', deg: 225, d: R - 90 },
];
/** Rays swept about the station bearing, degrees. Narrow: only this much of the arc
 *  is in frame at once, and a ray that leaves the canvas is dropped, not guessed. */
const RAY_SPREAD = [-12, -8, -4, 0, 4, 8, 12];
const RHO_FROM = R - 220, RHO_TO = R + 300, RHO_STEP = 5;
const HOLD = 4;          // consecutive radii the threshold must hold for
const T_ONSET = 2.0;     // luma (0-255). Deep inside is EXACTLY 0, so 2 is well clear.
const T_CLEAR = 12.0;    // "a player would see this"
const PATCH = 1;         // 3x3

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

const BUILD = (cfg) => {
  const w = window, st = w.__stage, cam = st.rig.camera;
  const r = st.canvas.getBoundingClientRect();
  const S = 0.05;
  const v = cam.position.clone();
  const fwd = (xwu, ywu) => {
    v.set(xwu * S, 0, ywu * S).project(cam);
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  };
  // INVERSE: screen -> ground plane, by unprojecting a point on the ray and walking it
  // to y = 0. Checked below against the fighter's own published screen point.
  const inv = (sx, sy) => {
    const ndcX = ((sx - r.left) / r.width) * 2 - 1, ndcY = -(((sy - r.top) / r.height) * 2 - 1);
    v.set(ndcX, ndcY, 0.5).unproject(cam);
    const dx = v.x - cam.position.x, dy = v.y - cam.position.y, dz = v.z - cam.position.z;
    if (Math.abs(dy) < 1e-9) return null;
    const t = -cam.position.y / dy;
    if (t <= 0) return null;
    return { x: (cam.position.x + t * dx) / S, y: (cam.position.z + t * dz) / S };
  };

  const SEG = 128;
  const ringR = (m, ring) => m.geometry.attributes.position.getX(ring * SEG) / S;
  const canopyMesh = st.scene.getObjectByName('fog_canopy__no_outline');
  const edgeMesh = st.scene.getObjectByName('fog_edge__no_outline');
  const fogRoot = st.scene.getObjectByName('fog_boundary');
  const centre = { x: fogRoot.position.x / S, y: fogRoot.position.z / S };
  const safeFromCanopy = ringR(canopyMesh, 0) - 12;
  const safeFromEdge = ringR(edgeMesh, 1) + 1;

  const me = w.__vfxDebugFighters?.player ?? null;
  const shipped = w.__vfxDebugScreen?.player ?? null;
  const mine = me ? fwd(me.x, me.y) : null;
  const back = shipped ? inv(shipped.x, shipped.y) : null;

  const rays = [];
  for (const off of cfg.spread) {
    const th = ((cfg.deg + off) * Math.PI) / 180;
    const pts = [];
    for (let rho = cfg.from; rho <= cfg.to + 1e-6; rho += cfg.step) {
      const gx = centre.x + Math.cos(th) * rho, gy = centre.y + Math.sin(th) * rho;
      const p = fwd(gx, gy);
      const on = p.x >= r.left + 3 && p.x < r.right - 3 && p.y >= r.top + 3 && p.y < r.bottom - 3;
      pts.push({ rho: Math.round(rho * 10) / 10, x: Math.round(p.x), y: Math.round(p.y), on });
    }
    rays.push({ deg: cfg.deg + off, pts });
  }
  return {
    rays, centre, safeFromCanopy, safeFromEdge,
    canopyOffsetM: { x: canopyMesh.position.x, y: canopyMesh.position.y, z: canopyMesh.position.z },
    camPos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    camNadirWU: { x: cam.position.x / S, y: cam.position.z / S },
    pitchDeg: st.rig.pitchDeg, yawDeg: st.rig.yawDeg, fov: cam.fov,
    canvasRect: { left: r.left, top: r.top, width: r.width, height: r.height },
    me, shipped, mine, back,
    fwdErr: mine && shipped ? Math.hypot(mine.x - shipped.x, mine.y - shipped.y) : null,
    invErr: back && me ? Math.hypot(back.x - me.x, back.y - me.y) : null,
    zoneOutside: (() => {
      const el = [...document.querySelectorAll('*')].find((e) => e.textContent === '▲ OUTSIDE THE ZONE');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    })(),
  };
};

const SET_ARM = (arm) => {
  const st = window.__stage, get = (n) => st.scene.getObjectByName(n);
  const root = get('fog_boundary'), canopy = get('fog_canopy__no_outline');
  const curtain = get('fog_curtain__no_outline'), edge = get('fog_edge__no_outline');
  root.visible = true; canopy.visible = true; curtain.visible = true; edge.visible = true;
  const col = canopy.geometry.attributes.color;
  for (let i = 0; i < col.count; i++) col.setXYZW(i, 0x2A / 255, 0x0B / 255, 0x47 / 255, col.getW(i));
  col.needsUpdate = true;
  if (arm === 'canopyOff') canopy.visible = false;
  else if (arm === 'curtainOff') curtain.visible = false;
  else if (arm === 'edgeOff') edge.visible = false;
  else if (arm === 'allOff') root.visible = false;
  else if (arm === 'canopyGreen') {
    for (let i = 0; i < col.count; i++) col.setXYZW(i, 0, 1, 0, col.getW(i));
    col.needsUpdate = true;
  }
  st.render(0);
  return { root: root.visible, canopy: canopy.visible, curtain: curtain.visible, edge: edge.visible };
};

const ARMS = ['shipped', 'canopyOff', 'curtainOff', 'edgeOff', 'allOff', 'canopyGreen'];

const lumaAt = (b, info, x, y, k) => {
  let s = 0, n = 0;
  for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
    const px = x + dx, py = y + dy;
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) continue;
    const i = (py * info.width + px) * info.channels;
    s += 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]; n++;
  }
  return n ? s / n : NaN;
};

/** First radius at which |delta| >= thr and stays there for `hold` consecutive steps. */
function onset(pts, thr, hold) {
  for (let i = 0; i + hold <= pts.length; i++) {
    let ok = true;
    for (let k = 0; k < hold; k++) if (!(pts[i + k].d >= thr)) { ok = false; break; }
    if (ok) return pts[i].rho;
  }
  return null;
}
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : null; };

async function diffPx(a, b) {
  const [A, B] = await Promise.all([a, b].map((p) => sharp(p).raw().toBuffer({ resolveWithObject: true })));
  const ch = A.info.channels, n = A.info.width * A.info.height; let px = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) if (A.data[i * ch + c] !== B.data[i * ch + c]) { px++; break; }
  return px;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
  });
  const only = args.only ? String(args.only).split(',') : null;
  const out = { base: BASE, viewport: [W, H], fogRadius: R, stations: [] };
  let refused = null;
  try {
    for (const s of STATIONS) {
      if (only && !only.includes(s.id)) continue;
      const th = (s.deg * Math.PI) / 180;
      const px = Math.round(CX + Math.cos(th) * s.d), py = Math.round(CY + Math.sin(th) * s.d);
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const warns = [];
      page.on('console', (m) => { const t = m.text(); if (/\[QA\]/.test(t)) warns.push(t.slice(0, 240)); });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      await page.goto(`${BASE}/?player=hamburger&enemy=donut&px=${px}&py=${py}&fogRadius=${R}&simSpeed=${SIM}&pointerLock=0`,
        { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: join(OUT, `hud_${s.id}.png`) });
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; });
      await page.waitForTimeout(250);
      const anims = await page.evaluate(PAGE_STILL_HUD);
      const g = await page.evaluate(BUILD, { deg: s.deg, spread: RAY_SPREAD, from: RHO_FROM, to: RHO_TO, step: RHO_STEP });
      await page.evaluate(() => { for (const e of document.querySelectorAll('.hud-root, #screens')) e.style.visibility = 'hidden'; });

      await page.evaluate(SET_ARM, 'shipped');
      const sp0 = join(OUT, `${s.id}_sp0.png`); await page.screenshot({ path: sp0 });
      await page.evaluate(() => window.__stage.render(0));
      const sp1 = join(OUT, `${s.id}_sp1.png`); await page.screenshot({ path: sp1 });
      const selfPair = await diffPx(sp0, sp1);

      const shots = {};
      for (const arm of ARMS) { await page.evaluate(SET_ARM, arm); const p = join(OUT, `${s.id}_${arm}.png`); await page.screenshot({ path: p }); shots[arm] = p; }
      await page.close();

      if (!(g.fwdErr <= 0.01)) { refused = `${s.id}: forward projection error ${g.fwdErr}`; break; }
      if (!(g.invErr <= 0.5)) { refused = `${s.id}: INVERSE projection error ${g.invErr} wu — the ray/ground math is wrong`; break; }
      if (selfPair !== 0) { refused = `${s.id}: self-pair ${selfPair} px, not 0`; break; }
      if (Math.abs(g.safeFromCanopy - R) > 8 || Math.abs(g.safeFromEdge - R) > 8) {
        refused = `${s.id}: shipped meshes say safeRadius ${g.safeFromCanopy.toFixed(1)}/${g.safeFromEdge.toFixed(1)}, not ${R}`; break;
      }

      const raw = {};
      for (const arm of ARMS) raw[arm] = await sharp(shots[arm]).raw().toBuffer({ resolveWithObject: true });
      const ablGreen = await diffPx(shots.shipped, shots.canopyGreen);

      const rayRows = g.rays.map((ray) => {
        const on = ray.pts.filter((p) => p.on);
        const series = (armOff) => on.map((p) => ({
          rho: p.rho,
          d: Math.abs(lumaAt(raw[armOff].data, raw[armOff].info, p.x, p.y, PATCH)
                    - lumaAt(raw.shipped.data, raw.shipped.info, p.x, p.y, PATCH)),
        }));
        const cs = series('canopyOff'), es = series('edgeOff'), ws = series('curtainOff'), as = series('allOff');
        const deepIn = as.filter((p) => p.rho <= R - 120).map((p) => p.d);
        const deepOut = as.filter((p) => p.rho >= R + 150).map((p) => p.d);
        return {
          deg: ray.deg, nOn: on.length,
          rhoRange: on.length ? [on[0].rho, on[on.length - 1].rho] : null,
          canopyOnset: onset(cs, T_ONSET, HOLD), canopyClear: onset(cs, T_CLEAR, HOLD),
          edgeOnset: onset(es, T_ONSET, HOLD), curtainOnset: onset(ws, T_ONSET, HOLD),
          allOnset: onset(as, T_ONSET, HOLD), allClear: onset(as, T_CLEAR, HOLD),
          ctlDeepInMax: deepIn.length ? Math.max(...deepIn) : null,
          ctlDeepOutMed: deepOut.length ? med(deepOut) : null,
          canopySeries: cs, allSeries: as,
        };
      });

      out.stations.push({ id: s.id, deg: s.deg, px, py, d: s.d, selfPair, anims, warns,
        safeFromCanopy: g.safeFromCanopy, safeFromEdge: g.safeFromEdge, canopyOffsetM: g.canopyOffsetM,
        camNadirWU: g.camNadirWU, camPos: g.camPos, pitchDeg: g.pitchDeg, yawDeg: g.yawDeg, fov: g.fov,
        fwdErr: g.fwdErr, invErr: g.invErr, zoneOutside: g.zoneOutside, me: g.me,
        ablationGreenPx: ablGreen, rays: rayRows });

      const safeR = g.safeFromCanopy;
      const ok = rayRows.filter((r) => r.canopyOnset !== null);
      console.log(`\n── ${s.id} (bearing ${s.deg}deg, 90=toward camera)  player (${px},${py})  hp ${g.me?.hp}  zoneOutside ${g.zoneOutside}`);
      console.log(`   selfpair ${selfPair}px · fwdErr ${g.fwdErr.toFixed(4)}px · invErr ${g.invErr.toFixed(3)}wu · anims ${anims} · canopy->green ${ablGreen}px`);
      console.log(`   safeRadius from shipped meshes ${safeR.toFixed(2)} / ${g.safeFromEdge.toFixed(2)} · canopy translation z ${g.canopyOffsetM.z.toFixed(3)} m · nadir ${g.camNadirWU.x.toFixed(0)},${g.camNadirWU.y.toFixed(0)}`);
      console.log('     ray   onCanvas rho      canopyOnset  canopyClear   edgeOnset  allOnset   ctlIn  ctlOut');
      for (const r of rayRows) {
        const f = (v) => (v === null ? '     --' : String(v).padStart(7));
        const g2 = (v) => (v === null ? '   --' : v.toFixed(1).padStart(6));
        console.log(`   ${String(r.deg).padStart(5)}  ${r.rhoRange ? `${String(r.rhoRange[0]).padStart(5)}..${String(r.rhoRange[1]).padStart(5)}` : '   none   '}  ${f(r.canopyOnset)}      ${f(r.canopyClear)}    ${f(r.edgeOnset)}   ${f(r.allOnset)}  ${g2(r.ctlDeepInMax)}${g2(r.ctlDeepOutMed)}`);
      }
      const mc = med(rayRows.map((r) => r.canopyOnset));
      const mcl = med(rayRows.map((r) => r.canopyClear));
      const ma = med(rayRows.map((r) => r.allOnset));
      console.log(`   >> median canopy onset ${mc}  (${mc === null ? '--' : (mc - safeR).toFixed(1)} wu vs the damage line ${safeR.toFixed(1)})`);
      console.log(`   >> median canopy CLEAR ${mcl}  (${mcl === null ? '--' : (mcl - safeR).toFixed(1)} wu)`);
      console.log(`   >> median ANY-fog onset ${ma}  (${ma === null ? '--' : (ma - safeR).toFixed(1)} wu)`);
    }
  } finally { await browser.close(); }

  await writeFile(join(OUT, 'fogedge.json'), JSON.stringify(out, null, 2));
  if (refused) { console.log(`\n✗ REFUSED — ${refused}`); process.exit(1); }

  console.log('\n──────── SUMMARY: apparent ground radius of each layer, minus the damage line ────────');
  console.log('  bearing  (90 = toward the camera, 270 = away)   canopy_onset  canopy_clear  any_fog_onset');
  for (const st of out.stations) {
    const safeR = st.safeFromCanopy;
    const mc = med(st.rays.map((r) => r.canopyOnset));
    const mcl = med(st.rays.map((r) => r.canopyClear));
    const ma = med(st.rays.map((r) => r.allOnset));
    const d = (v) => (v === null ? '      --' : (v - safeR >= 0 ? '+' : '') + (v - safeR).toFixed(0).padStart(6));
    console.log(`   ${st.id.padEnd(3)} ${String(st.deg).padStart(4)}deg                                ${d(mc)} wu   ${d(mcl)} wu   ${d(ma)} wu`);
  }
  const ctlIn = out.stations.flatMap((s) => s.rays.map((r) => r.ctlDeepInMax)).filter((v) => v !== null);
  const ctlOut = out.stations.flatMap((s) => s.rays.map((r) => r.ctlDeepOutMed)).filter((v) => v !== null);
  console.log(`\n  control  deep-INSIDE  max |delta| over all rays: ${Math.max(...ctlIn).toFixed(2)} luma   (fogRing's own acceptance test says bit-identical)`);
  console.log(`  control  deep-OUTSIDE med |delta| over all rays: ${med(ctlOut).toFixed(2)} luma`);
  console.log(`  control  self-pair: ${out.stations.map((s) => `${s.id} ${s.selfPair}px`).join(' · ')}`);
  console.log(`\nwrote ${join(OUT, 'fogedge.json')}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
