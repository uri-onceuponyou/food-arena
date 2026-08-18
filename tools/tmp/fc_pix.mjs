#!/usr/bin/env node
/**
 * FC_PIX — WHERE DOES THE FOG VISUALLY BEGIN, IN PIXELS, VERSUS WHERE THE DAMAGE BEGINS?
 *
 * `sim.ts:1064` burns a fighter whose distance from `arena.center` exceeds
 * `state.safeRadius`. That is a CIRCLE — bearing-independent by construction, and the
 * same predicate `ui/hud.ts:1065` uses to print "▲ OUTSIDE THE ZONE −50 HP/s".
 *
 * `arena/fogRing.ts` draws that circle as three layers, and the DANGER CANOPY —
 * the violet mass a player reads as "the fog" — is a horizontal plane at 3.2 m.
 * A horizontal plane at height h seen from a pitched camera does not project onto the
 * ground point beneath it, so `update()` slides it by `CANOPY_Y / tan(pitch)`.
 *
 * The claim under test, derived from source and NEVER CONFIRMED IN PIXELS:
 *
 *   1. the canopy is authored fully transparent AT the damage line (+12 wu, alpha 0)
 *      and only reaches alpha 0.6 at +44 wu;
 *   2. a RIGID TRANSLATION cannot invert a perspective homothety, so the residual must
 *      depend on the BEARING — near arc and far arc MUST disagree. **If they agree, the
 *      whole diagnosis is wrong and that is the result.**
 *
 * ── METHOD ───────────────────────────────────────────────────────────────────
 * One page load per bearing station. The player is placed ON the boundary at that
 * bearing (`?px=/?py=`), so the camera frames the arc the way a player standing there
 * would see it. Then, in ONE page:
 *
 *   * rAF is stubbed, HUD CSS is stilled, the shake is FORCED TO ZERO (a frozen frame
 *     is not a frozen camera — `AGENT-BRIEF` §3: 344/344 frozen frames drifted).
 *   * six arms are produced by ABLATION, so both sides of every A/B are the same frame
 *     apart from one `visible` flag: shipped · canopyOff · edgeOff · curtainOff ·
 *     allOff · canopyGreen. Plus `shipped2`, a self-pair.
 *   * every arm is drawn with `stage.render(0)` and read with
 *     `renderer.domElement.toDataURL` — the CANVAS, not a page screenshot, because a
 *     `position: fixed` HUD keyframe lands inside a clipped page capture.
 *
 * Then, for rays fanned about the station bearing, walk ground radii outward from the
 * FOG'S OWN CENTRE (read off `fog_boundary.position`, not assumed), project each ground
 * point with the SHIPPED camera, and find the first radius at which a layer's own
 * contribution |luma(armOff) − luma(shipped)| clears a threshold and HOLDS. That radius
 * is where that layer visually begins.
 *
 * ── CONTROLS. A guard that has not been shown to FAIL is not a guard ─────────
 *   SELF-PAIR   two renders, nothing touched → 0.00 luma on every sample.
 *   NON-EMPTY   every filtered ray/sample set is asserted non-empty BEFORE any verdict
 *               is computed over it (`[].every()` is `true` — CLAUDE.md #6).
 *   FORWARD     my world→screen must land on the shipped `__vfxDebugScreen.player`.
 *   INSIDE      deep inside the boundary the whole fog must be bit-identical
 *               (`fogRing.ts`'s own acceptance test says 0.0%).
 *   OUTSIDE     deep outside must be a large delta — the instrument sees the canopy.
 *   ABLATION    canopy → pure green must MOVE the frame. "It isn't there" has meant
 *               "it IS there and is invisible" twenty times on this project.
 *   RADIUS      `state.safeRadius` is read back out of the SHIPPED CURTAIN MESH
 *               (`wall.scale.x / WORLD_SCALE`), because `?fogRadius=` no longer places
 *               the ring: `match.ts:applyQaSetup` inverts the PRE-§72 linear schedule.
 *   HUD FLIP    two extra loads put the player 15 wu inside and 15 wu outside the
 *               READ-BACK radius and assert `.hud-zone-label` flips. That is the damage
 *               line pinned by the page itself rather than by my arithmetic.
 *
 * Usage:
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-fc-head -- \
 *     node tools/tmp/fc_pix.mjs --url '{URL}' --req 900 --out shots/fc/r900
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const has = (k) => argv.includes(`--${k}`);

const BASE = arg('url', process.env.PREVIEW_BASE ?? null);
if (!BASE) { console.error('fc_pix: need --url or PREVIEW_BASE'); process.exit(2); }
const OUT = resolve(arg('out', 'shots/fc/run'));
const W = Number(arg('w', 1280));
const H = Number(arg('h', 720));
const REQ = Number(arg('req', 900));      // what we ASK for; the page tells us what we GOT
const PITCH = arg('pitch', null);          // optional: re-pitch the rig and let the loop re-register
const SIM = arg('sim', '0.02');
const SPREAD = (arg('spread', '-10,-5,0,5,10')).split(',').map(Number);
const STEP = Number(arg('step', 4));       // wu between radius samples
const HOLD = Number(arg('hold', 5));       // consecutive samples the threshold must hold for
const T_ON = Number(arg('t-on', 2.0));     // luma (0-255): "the instrument can see it"
const T_SEE = Number(arg('t-see', 12.0));  // luma: "a player would see this"
const PATCH = 1;                            // 3x3

/** Bearing in DEGREES on the prototype ground plane (x east, y south), the way
 *  `Math.atan2(dy, dx)` measures: 0 = east, 90 = SOUTH, 180 = west, 270 = NORTH.
 *  The match camera is yaw 0, and `camera.ts:apply` puts it at +z = +y = SOUTH of its
 *  target — so a player standing SOUTH of the arena centre is on the NEAR arc (the
 *  boundary sits between the camera and the centre, at the bottom of frame) and a
 *  player standing NORTH of it is on the FAR arc. */
const STATIONS = [
  { id: 'S__near', deg: 90 },
  { id: 'N__far', deg: 270 },
  { id: 'E__side', deg: 0 },
  { id: 'W__side', deg: 180 },
  { id: 'SE__near', deg: 45 },
  { id: 'NW__far', deg: 225 },
];

const ARMS = ['shipped', 'shipped2', 'canopyOff', 'edgeOff', 'curtainOff', 'allOff', 'canopyGreen',
  'canopyFlip', 'canopyExact'];

/** Named radii the controls are evaluated AT, rather than "whichever sample survived".
 *  ⚠️ v1 read the FIRST and LAST valid sample of each ray and called them "deep inside"
 *  and "deep outside". On the far stations the first valid sample was already 8 wu
 *  OUTSIDE the line (everything nearer the camera projects off the bottom of frame) and
 *  the last was on the black void past the apron, where a dark violet canopy over black
 *  is a 0.7-luma no-op. Both controls therefore FAILED while the render was correct —
 *  a control that is not POINTED anywhere real (CLAUDE.md #6). */
const CTL_INSIDE = Number(arg('ctl-inside', -150));
const CTL_OUTSIDE = Number(arg('ctl-outside', 200));

const PAGE_STILL_HUD = () => {
  const s = document.createElement('style');
  s.id = 'fc-still';
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;'
    + 'transition:none!important;caret-color:transparent!important}';
  document.head.appendChild(s);
  for (const a of document.getAnimations()) { try { a.currentTime = 0; a.pause(); } catch { /* finished */ } }
  return document.getAnimations().filter((a) => a.playState === 'running').length;
};

/** Everything the node side needs about the live page, read off the SHIPPED objects. */
const PAGE_FREEZE = (pitchDeg) => {
  const w = window;
  const st = (w.__stages ? [...w.__stages].find((s) => !s.offscreen) : null) || w.__stage;
  if (!st) throw new Error('no Stage');

  // Re-pitch BEFORE freezing, and let the real loop run so `match.ts` calls
  // `fogRing.update()` with the new angles — setting `rig.pitchDeg` and rendering would
  // leave the canopy translated for the OLD pitch, which is a measurement of nothing.
  if (pitchDeg !== null) { st.rig.pitchDeg = Number(pitchDeg); st.rig.apply(); }
  return new Promise((res) => setTimeout(() => {
    // Stub rAF only AFTER the loop has had frames at the new pitch.
    w.requestAnimationFrame = () => 0;
    // 🚨 Zero the shake explicitly. `camera.ts:update` holds it at dt = 0, but it holds
    // whatever random offset it was on when we stopped.
    try { st.rig.shakeOffset.set(0, 0, 0); st.rig.shakeAmount = 0; st.rig.apply(); } catch { /* older rig */ }

    let fog = null;
    st.scene.traverse((o) => { if (!fog && o.name === 'fog_boundary') fog = o; });
    if (!fog) { res({ err: 'no fog_boundary in scene' }); return; }
    const byName = {};
    fog.traverse((o) => { if (o.isMesh) byName[o.name] = o; });
    const curtain = byName['fog_curtain__no_outline'];
    const canopy = byName['fog_canopy__no_outline'];
    const edge = byName['fog_edge__no_outline'];
    if (!curtain || !canopy || !edge) { res({ err: 'fog meshes: ' + Object.keys(byName).join(',') }); return; }

    w.__fc = {
      st, fog, curtain, canopy, edge, greenMat: null, saved: null,
      // The SHIPPED canopy transform, recorded before any arm rewrites it.
      // 🚨 THE SCALE IS PART OF IT AND v1 DID NOT RECORD IT. On the pre-fix build the
      // canopy's scale was always 1, so restoring only the position looked correct
      // forever — and the moment a build placed the canopy WITH a scale, the "shipped"
      // arm silently became a hybrid (right centre, wrong radius) and read +48 wu on
      // every arc where the real build reads +20. The arm that is supposed to be the
      // untouched control is the easiest one to break, because nothing about it looks
      // like a treatment.
      shipPos: { x: canopy.position.x, y: canopy.position.y, z: canopy.position.z },
      shipScale: { x: canopy.scale.x, y: canopy.scale.y, z: canopy.scale.z },
    };

    const S = 0.05;
    const cam = st.rig.camera;
    const el = st.renderer.domElement;
    res({
      // `wall.scale.set(rm, wallH, rm)` with `rm = wu(safeRadius)` — this IS the number
      // `match.ts` handed the boundary, which IS `state.safeRadius`.
      safeRadiusWU: curtain.scale.x / S,
      curtainHeightM: curtain.scale.y,
      centreWU: { x: fog.position.x / S, y: fog.position.z / S },
      canopyLocal: { x: canopy.position.x, y: canopy.position.y, z: canopy.position.z },
      camera: { pitchDeg: st.rig.pitchDeg, yawDeg: st.rig.yawDeg, x: cam.position.x, y: cam.position.y, z: cam.position.z },
      canvas: { w: el.width, h: el.height, cssW: el.clientWidth, cssH: el.clientHeight },
      playerScreen: w.__vfxDebugScreen ? w.__vfxDebugScreen.player : null,
      zoneLabel: (document.querySelector('.hud-zone-label') || {}).textContent ?? null,
      phase: w.__matchDebug ? w.__matchDebug.phase : null,
      frames: w.__feelDebug ? w.__feelDebug.frames : null,
    });
  }, 700));
};

/** Project a list of ground points (world units) to CANVAS BACKING-STORE pixels. */
const PAGE_PROJECT = (pts) => {
  const w = window, st = w.__fc.st, cam = st.rig.camera, el = st.renderer.domElement;
  const S = 0.05;
  const THREE = w.__fc.THREE ?? null;
  const out = [];
  for (const p of pts) {
    // three's Vector3 is not on window; do the projection by hand with the camera's
    // own matrices so nothing here depends on a global that may not exist.
    const m = cam.matrixWorldInverse.elements, q = cam.projectionMatrix.elements;
    const x = p[0] * S, y = 0, z = p[1] * S;
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const cx = q[0] * vx + q[4] * vy + q[8] * vz + q[12];
    const cy = q[1] * vx + q[5] * vy + q[9] * vz + q[13];
    const cw = q[3] * vx + q[7] * vy + q[11] * vz + q[15];
    // 🚨 `cw > 0` IS THE WHOLE GUARD, NOT TIDINESS. A point BEHIND the camera has
    // `cw < 0`, and dividing by it flips both NDC axes — producing a perfectly
    // plausible on-canvas pixel for a ground point that is not in the picture at all.
    // On the NEAR station the sweep runs 340 wu past a boundary the camera sits only
    // ~282 wu outside of, so the tail of every near ray was behind the lens and was
    // being sampled as if it were the far field.
    if (!(cw > 1e-9)) { out.push(null); continue; }
    const ndcX = cx / cw, ndcY = cy / cw;
    out.push([(ndcX * 0.5 + 0.5) * el.width, (-ndcY * 0.5 + 0.5) * el.height]);
  }
  return out;
};

/** Draw one ablation arm and hand back its canvas PNG. */
const PAGE_ARM = (arm) => {
  const f = window.__fc, st = f.st;
  const set = (m, v) => { m.visible = v; };
  // Restore first, so arms cannot accumulate.
  set(f.canopy, true); set(f.edge, true); set(f.curtain, true);
  if (f.saved) { f.canopy.material = f.saved; f.saved = null; }
  f.canopy.position.set(f.shipPos.x, f.shipPos.y, f.shipPos.z);
  f.canopy.scale.set(f.shipScale.x, f.shipScale.y, f.shipScale.z);

  if (arm === 'canopyFlip') {
    // CANDIDATE FIX A — the shipped translation with its SIGN REVERSED.
    // ⚠️ Only meaningful on a build whose shipped placement IS that translation. On a
    // build that already places the canopy correctly this arm flips the CORRECT offset
    // and is nonsense by construction; read it only in the pre-fix column.
    f.canopy.position.set(-f.shipPos.x, f.shipPos.y, -f.shipPos.z);
    f.canopy.scale.set(1, 1, 1);
  } else if (arm === 'canopyExact') {
    // CANDIDATE FIX B — the closed-form inverse. An elevated point at height h projects
    // onto the ground by a HOMOTHETY about the camera's ground position with ratio
    // Cy/(Cy−h); its inverse is the same homothety with ratio k = (Cy−h)/Cy, which is a
    // scale AND a centre shift, not a translation.
    const cam = st.rig.camera, h = f.shipPos.y, k = (cam.position.y - h) / cam.position.y;
    f.canopy.position.set((1 - k) * (cam.position.x - f.fog.position.x), h,
      (1 - k) * (cam.position.z - f.fog.position.z));
    f.canopy.scale.set(k, 1, k);
  } else if (arm === 'canopyOff') set(f.canopy, false);
  else if (arm === 'edgeOff') set(f.edge, false);
  else if (arm === 'curtainOff') set(f.curtain, false);
  else if (arm === 'allOff') { set(f.canopy, false); set(f.edge, false); set(f.curtain, false); }
  else if (arm === 'canopyGreen') {
    if (!f.greenMat) {
      const m = f.canopy.material.clone();
      m.vertexColors = false;
      m.transparent = false;
      m.opacity = 1;
      m.color.setRGB(0, 1, 0);
      m.depthWrite = false;
      f.greenMat = m;
    }
    f.saved = f.canopy.material;
    f.canopy.material = f.greenMat;
  }
  st.render(0);
  return st.renderer.domElement.toDataURL('image/png');
};

// ─────────────────────────────────────────────────────────────────────────────

async function raw(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function lumaAt(img, x, y) {
  const xi = Math.round(x), yi = Math.round(y);
  if (!(xi >= PATCH && yi >= PATCH && xi < img.w - PATCH && yi < img.h - PATCH)) return null;
  let s = 0, n = 0;
  for (let dy = -PATCH; dy <= PATCH; dy++) {
    for (let dx = -PATCH; dx <= PATCH; dx++) {
      const i = ((yi + dy) * img.w + (xi + dx)) * 4;
      s += 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2];
      n++;
    }
  }
  return s / n;
}

/** First radius at which |a − b| ≥ t and stays there for HOLD consecutive samples. */
function onset(rhos, deltas, t) {
  for (let i = 0; i + HOLD <= rhos.length; i++) {
    let ok = true;
    for (let k = 0; k < HOLD; k++) if (!(deltas[i + k] !== null && Math.abs(deltas[i + k]) >= t)) { ok = false; break; }
    if (ok) return rhos[i];
  }
  return null;
}

const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

async function openPage(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const warnings = [];
  page.on('console', (m) => { if (/\[QA\]/.test(m.text())) warnings.push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?player=hamburger&enemy=donut&simSpeed=${SIM}${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gameReady === true', null, { timeout: 180_000 });
  await page.waitForFunction(
    `(() => { const d = window.__matchDebug; return d && d.phase === 'playing'; })()`,
    null, { timeout: 60_000 },
  ).catch(() => {});
  await page.waitForTimeout(900);
  return { ctx, page, warnings };
}

// ── 0. one probe load: what radius did we actually GET? ──────────────────────
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
await mkdir(OUT, { recursive: true });
const report = { base: BASE, req: REQ, pitch: PITCH, stations: [], controls: [], hudFlip: null };

try {
  const probe = await openPage(browser, `&fogRadius=${REQ}`);
  await probe.page.evaluate(PAGE_STILL_HUD);
  const info0 = await probe.page.evaluate(PAGE_FREEZE, PITCH);
  await probe.ctx.close();
  if (info0.err) throw new Error('probe: ' + info0.err);

  const R = info0.safeRadiusWU;
  const C = info0.centreWU;
  report.actualRadiusWU = R;
  report.centreWU = C;
  report.probeCamera = info0.camera;
  report.probeCanopyLocal = info0.canopyLocal;
  report.qaWarnings = probe.warnings;

  console.log(`\n══ fc_pix — requested ?fogRadius=${REQ}, the page is drawing ${R.toFixed(2)} wu ══`);
  console.log(`   centre ${C.x.toFixed(1)},${C.y.toFixed(1)} wu · camera pitch ${info0.camera.pitchDeg}° yaw ${info0.camera.yawDeg}°`
    + ` · canopy local offset (${info0.canopyLocal.x.toFixed(3)}, ${info0.canopyLocal.y.toFixed(3)}, ${info0.canopyLocal.z.toFixed(3)}) m`
    + ` = ${(Math.hypot(info0.canopyLocal.x, info0.canopyLocal.z) / 0.05).toFixed(1)} wu of slide`);
  console.log(`   curtain height ${info0.curtainHeightM.toFixed(2)} m · phase ${info0.phase} · canvas ${info0.canvas.w}x${info0.canvas.h}`);
  if (Math.abs(R - REQ) > 1) {
    console.log(`   ⚠️  the request MOVED by ${(R - REQ).toFixed(2)} wu — `
      + `match.ts:applyQaSetup inverts the PRE-§72 linear schedule, so ?fogRadius= no longer places the ring.`);
  }

  // ── 1. HUD FLIP: pin the damage line with the page's own predicate ─────────
  const flip = [];
  for (const d of [-15, +15]) {
    const px = Math.round(C.x + Math.cos(Math.PI / 2) * (R + d));   // due SOUTH of centre
    const py = Math.round(C.y + Math.sin(Math.PI / 2) * (R + d));
    const p = await openPage(browser, `&fogRadius=${REQ}&px=${px}&py=${py}`);
    await p.page.evaluate(PAGE_STILL_HUD);
    const label = await p.page.evaluate(`(() => (document.querySelector('.hud-zone-label')||{}).textContent ?? null)()`);
    const hp = await p.page.evaluate(`(() => { const e = document.querySelector('[data-el="hp-fill"],.hud-hp-fill'); return e ? e.style.width : null; })()`);
    flip.push({ offsetWU: d, px, py, label, hpWidth: hp, warnings: p.warnings });
    await p.ctx.close();
  }
  report.hudFlip = flip;
  const inLbl = flip[0].label, outLbl = flip[1].label;
  const flipped = inLbl !== outLbl && /OUTSIDE/i.test(outLbl ?? '');
  console.log(`\n   HUD FLIP  ${flipped ? '✅' : '🚨'}  ${R.toFixed(1)}−15 wu → "${inLbl}"   |   ${R.toFixed(1)}+15 wu → "${outLbl}"`);
  report.controls.push(['HUD FLIP pins the damage line', `${inLbl} / ${outLbl}`, flipped]);

  // ── 2. the bearing stations ────────────────────────────────────────────────
  const RHOS = [];
  for (let r = Math.max(20, R - 260); r <= R + 340; r += STEP) RHOS.push(r);
  if (RHOS.length < 20) throw new Error(`radius sweep is degenerate (${RHOS.length} samples)`);

  for (const stn of STATIONS) {
    const th = (stn.deg * Math.PI) / 180;
    const px = Math.round(C.x + Math.cos(th) * R);
    const py = Math.round(C.y + Math.sin(th) * R);
    const p = await openPage(browser, `&fogRadius=${REQ}&px=${px}&py=${py}`);
    await p.page.evaluate(PAGE_STILL_HUD);
    const info = await p.page.evaluate(PAGE_FREEZE, PITCH);
    if (info.err) { console.log(`   ${stn.id}: ${info.err}`); await p.ctx.close(); continue; }

    // FORWARD control: my projection of the player's own world point must land on the
    // screen point the SHIPPED code publishes for it.
    const fwd = (await p.page.evaluate(PAGE_PROJECT, [[px, py]]))[0];
    let fwdErr = null;
    if (fwd && info.playerScreen) {
      const dpr = info.canvas.w / Math.max(1, info.canvas.cssW);
      fwdErr = Math.hypot(fwd[0] / dpr - info.playerScreen.x, fwd[1] / dpr - info.playerScreen.y);
    }

    // Ray fan, projected once.
    const rays = SPREAD.map((off) => {
      const a = th + (off * Math.PI) / 180;
      return RHOS.map((r) => [C.x + Math.cos(a) * r, C.y + Math.sin(a) * r]);
    });
    const proj = await p.page.evaluate(PAGE_PROJECT, rays.flat());

    // Arms.
    const imgs = {};
    for (const arm of ARMS) {
      const url = await p.page.evaluate(PAGE_ARM, arm);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      await writeFile(join(OUT, `${stn.id}__${arm}.png`), buf);
      imgs[arm] = await raw(buf);
    }
    await p.ctx.close();

    // ── sample ──
    const perRay = [];
    for (let ri = 0; ri < rays.length; ri++) {
      const base = ri * RHOS.length;
      const rows = RHOS.map((rho, k) => {
        const sp = proj[base + k];
        if (!sp) return null;
        const l = {};
        for (const arm of ARMS) l[arm] = lumaAt(imgs[arm], sp[0], sp[1]);
        if (Object.values(l).some((v) => v === null)) return null;
        return { rho, l, sx: sp[0], sy: sp[1] };
      });
      const good = rows.filter(Boolean);
      if (good.length < HOLD + 5) continue;               // NON-EMPTY, asserted before use
      const rh = good.map((g) => g.rho);
      const dCan = good.map((g) => g.l.shipped - g.l.canopyOff);
      const dAll = good.map((g) => g.l.shipped - g.l.allOff);
      const dEdge = good.map((g) => g.l.shipped - g.l.edgeOff);
      const dCur = good.map((g) => g.l.shipped - g.l.curtainOff);
      const dSelf = good.map((g) => g.l.shipped - g.l.shipped2);
      // The two candidate fixes, measured the SAME way: each arm against `canopyOff`,
      // so "where does THIS canopy visually begin" is one question asked three times.
      const dFlip = good.map((g) => g.l.canopyFlip - g.l.canopyOff);
      const dExact = good.map((g) => g.l.canopyExact - g.l.canopyOff);
      // Named-radius controls. `at()` returns null when that radius is not on canvas for
      // this ray, and the caller asserts the surviving set is non-empty before judging.
      const at = (target) => {
        let best = null, bd = Infinity;
        for (let i = 0; i < rh.length; i++) {
          const d = Math.abs(rh[i] - target);
          if (d < bd) { bd = d; best = i; }
        }
        return bd <= STEP * 1.5 ? best : null;
      };
      const iIn = at(R + CTL_INSIDE), iOut = at(R + CTL_OUTSIDE);
      perRay.push({
        offDeg: SPREAD[ri], n: good.length,
        canopyOnset: onset(rh, dCan, T_ON), canopySeen: onset(rh, dCan, T_SEE),
        fogOnset: onset(rh, dAll, T_ON), fogSeen: onset(rh, dAll, T_SEE),
        edgeOnset: onset(rh, dEdge, T_ON), curtainOnset: onset(rh, dCur, T_ON),
        flipOnset: onset(rh, dFlip, T_ON), flipSeen: onset(rh, dFlip, T_SEE),
        exactOnset: onset(rh, dExact, T_ON), exactSeen: onset(rh, dExact, T_SEE),
        selfMax: Math.max(...dSelf.map(Math.abs)),
        ctlInside: iIn === null ? null : dAll[iIn],
        ctlOutside: iOut === null ? null : dCan[iOut],
        rows: good.map((g, i) => ({
          rho: g.rho, sx: Math.round(g.sx), sy: Math.round(g.sy),
          dCan: dCan[i], dAll: dAll[i], dEdge: dEdge[i], dCur: dCur[i], dFlip: dFlip[i], dExact: dExact[i],
        })),
      });
    }
    if (perRay.length === 0) { console.log(`   ${stn.id}: NO USABLE RAY — every sample left the canvas`); continue; }

    // Ablation: canopy → green must MOVE the frame.
    let moved = 0, tot = 0;
    const a = imgs.shipped, b = imgs.canopyGreen;
    for (let i = 0; i < a.w * a.h; i++) {
      tot++;
      if (Math.abs(a.data[i * 4] - b.data[i * 4]) + Math.abs(a.data[i * 4 + 1] - b.data[i * 4 + 1])
        + Math.abs(a.data[i * 4 + 2] - b.data[i * 4 + 2]) > 12) moved++;
    }
    // Self-pair over the WHOLE frame, not only the samples.
    let selfPx = 0;
    const s2 = imgs.shipped2;
    for (let i = 0; i < a.w * a.h; i++) {
      if (a.data[i * 4] !== s2.data[i * 4] || a.data[i * 4 + 1] !== s2.data[i * 4 + 1]
        || a.data[i * 4 + 2] !== s2.data[i * 4 + 2]) selfPx++;
    }

    const pick = (k) => {
      const v = perRay.map((r) => r[k]).filter((x) => x !== null && x !== undefined);
      return v.length ? { med: med(v) - R, lo: Math.min(...v) - R, hi: Math.max(...v) - R, n: v.length } : null;
    };
    const row = {
      id: stn.id, deg: stn.deg, px, py, rays: perRay.length,
      fwdErrPx: fwdErr, zoneLabel: info.zoneLabel, phase: info.phase,
      canopyOnset: pick('canopyOnset'), canopySeen: pick('canopySeen'),
      fogOnset: pick('fogOnset'), fogSeen: pick('fogSeen'),
      edgeOnset: pick('edgeOnset'), curtainOnset: pick('curtainOnset'),
      flipOnset: pick('flipOnset'), flipSeen: pick('flipSeen'),
      exactOnset: pick('exactOnset'), exactSeen: pick('exactSeen'),
      selfMaxLuma: Math.max(...perRay.map((r) => r.selfMax)),
      selfPx, movedPx: moved, totPx: tot,
      ctlInside: perRay.map((r) => r.ctlInside).filter((v) => v !== null),
      ctlOutside: perRay.map((r) => r.ctlOutside).filter((v) => v !== null),
      camera: info.camera, canopyLocal: info.canopyLocal, safeRadiusWU: info.safeRadiusWU,
      perRay,
    };
    report.stations.push(row);
    const f = (o) => (o ? `${o.med >= 0 ? '+' : ''}${o.med.toFixed(1)} [${o.lo.toFixed(0)},${o.hi.toFixed(0)}]` : '  —  ');
    console.log(`   ${stn.id.padEnd(9)} rays ${String(row.rays).padStart(2)}  `
      + `canopy first-seen ${f(row.canopyOnset).padStart(18)}  alpha-visible ${f(row.canopySeen).padStart(18)}  `
      + `whole fog ${f(row.fogOnset).padStart(18)}  self ${row.selfPx} px  green-ablation ${(100 * moved / tot).toFixed(1)}%`);
  }
  // ── 3. THE PICTURE ────────────────────────────────────────────────────────
  // One image of a fighter on ground that looks clear, with a HUD saying it is burning.
  // FULL PAGE here, not the canvas: the HUD is the point, and the CSS is stilled so the
  // "document timeline, not rAF" trap (AGENT-BRIEF §3) cannot animate under the capture.
  const MONEY = (arg('money', '270:40,270:90,90:-60,90:40')).split(',').map((s) => {
    const [d, o] = s.split(':').map(Number);
    return { deg: d, off: o };
  });
  report.money = [];
  for (const ms of MONEY) {
    const th = (ms.deg * Math.PI) / 180;
    const px = Math.round(report.centreWU.x + Math.cos(th) * (report.actualRadiusWU + ms.off));
    const py = Math.round(report.centreWU.y + Math.sin(th) * (report.actualRadiusWU + ms.off));
    const p = await openPage(browser, `&fogRadius=${REQ}&px=${px}&py=${py}`);
    await p.page.evaluate(PAGE_STILL_HUD);
    const before = await p.page.evaluate(`(() => ({
      zone: (document.querySelector('.hud-zone-label')||{}).textContent ?? null,
      val: (document.querySelector('.hud-zone-value')||{}).textContent ?? null,
      inCover: window.__matchDebug ? window.__matchDebug.qaSpawnInsideCover : 'n/a',
    }))()`);
    const file = join(OUT, `MONEY_${ms.deg}deg_${ms.off >= 0 ? 'plus' : 'minus'}${Math.abs(ms.off)}wu.png`);
    await p.page.screenshot({ path: file });
    await p.ctx.close();
    report.money.push({ ...ms, px, py, ...before, file });
    console.log(`   MONEY ${String(ms.deg).padStart(3)}° ${(ms.off >= 0 ? '+' : '') + ms.off} wu`
      + `   HUD "${before.zone}" ${before.val}   cover:${before.inCover}   → ${file}`);
  }
} finally {
  await browser.close();
}

// ── verdicts ─────────────────────────────────────────────────────────────────
const S = report.stations;
if (S.length === 0) { console.log('\n🚨 NO STATION PRODUCED DATA — nothing below may be quoted.'); process.exit(1); }

const near = S.filter((s) => s.id.endsWith('near'));
const far = S.filter((s) => s.id.endsWith('far'));
const side = S.filter((s) => s.id.endsWith('side'));

const ctl = (name, val, ok, note = '') => {
  report.controls.push([name, String(val), ok]);
  console.log(`   ${ok ? '✅' : '🚨'} ${name.padEnd(46)} ${String(val).padEnd(30)} ${note}`);
  return ok;
};
console.log('\n── CONTROLS ──────────────────────────────────────────────────────────');
ctl('SELF-PAIR: two renders, nothing touched', `${Math.max(...S.map((s) => s.selfPx))} px worst`, S.every((s) => s.selfPx === 0));
ctl('ABLATION: canopy → green MOVES the frame', `${Math.min(...S.map((s) => 100 * s.movedPx / s.totPx)).toFixed(1)}% worst`, S.every((s) => s.movedPx / s.totPx > 0.02));
ctl('FORWARD: my projection = shipped player point', `${Math.max(...S.map((s) => s.fwdErrPx ?? 999)).toFixed(2)} px worst`, S.every((s) => s.fwdErrPx !== null && s.fwdErrPx < 3));
// 🚨 NON-EMPTY FIRST. `[].every()` is `true`, and both control sets below are FILTERED
// (a named radius that is off-canvas for a ray contributes nothing). Judging them
// without this line is the vacuous-control class CLAUDE.md #6 records three times.
const inAll = S.flatMap((s) => s.ctlInside);
const outAll = S.flatMap((s) => s.ctlOutside);
ctl(`NON-EMPTY: control samples exist at R${CTL_INSIDE}/R+${CTL_OUTSIDE}`,
  `${inAll.length} inside · ${outAll.length} outside`, inAll.length >= S.length && outAll.length >= S.length);
ctl(`INSIDE (R${CTL_INSIDE} wu): the whole fog is bit-identical`,
  inAll.length ? `${Math.max(...inAll.map(Math.abs)).toFixed(3)} luma worst` : 'NO SAMPLES',
  inAll.length > 0 && Math.max(...inAll.map(Math.abs)) < 1.0);
ctl(`OUTSIDE (R+${CTL_OUTSIDE} wu): the canopy is a large delta`,
  outAll.length ? `${Math.min(...outAll.map(Math.abs)).toFixed(1)} luma worst` : 'NO SAMPLES',
  outAll.length > 0 && Math.min(...outAll.map(Math.abs)) > 8);
ctl('NON-EMPTY: every station has usable rays', `${Math.min(...S.map((s) => s.rays))} worst`, S.every((s) => s.rays >= 3));

console.log('\n── THE ANSWER ────────────────────────────────────────────────────────');
const m = (set, k) => {
  const v = set.map((s) => s[k]).filter(Boolean).map((o) => o.med);
  return v.length ? med(v) : null;
};
const nearC = m(near, 'canopySeen'), farC = m(far, 'canopySeen'), sideC = m(side, 'canopySeen');
console.log(`   canopy alpha-visible (Δ ≥ ${T_SEE} luma), as an offset from the DAMAGE LINE:`);
console.log(`      NEAR arc ${nearC === null ? '—' : (nearC >= 0 ? '+' : '') + nearC.toFixed(1) + ' wu'}`
  + `   ·   SIDE arcs ${sideC === null ? '—' : (sideC >= 0 ? '+' : '') + sideC.toFixed(1) + ' wu'}`
  + `   ·   FAR arc ${farC === null ? '—' : (farC >= 0 ? '+' : '') + farC.toFixed(1) + ' wu'}`);
if (nearC !== null && farC !== null) {
  const spread = Math.abs(farC - nearC);
  console.log(`   NEAR/FAR SPREAD  ${spread.toFixed(1)} wu`);
  // ⚠️ THE VERDICT DEPENDS ON WHICH BUILD IS UNDER TEST, AND v1's WORDING DID NOT.
  // It printed "🚨 FALSIFIED: the bearing dependence is ABSENT" for a spread of 0 —
  // which is the DEFECT's signature being absent, i.e. exactly what a fixed build must
  // print. A verdict string that reads as a failure on the passing build is a trap for
  // whoever reads the log next, so it now says what it means and leaves the judgement
  // to the caller who knows which tree the snapshot came from.
  console.log(`      > on a build with the RIGID-TRANSLATION canopy, a large spread is the DEFECT.`);
  console.log(`      > on a build with the closed-form canopy, ~0 is the FIX landing.`);
  console.log(`      > either way the number is bearing dependence in world units, nothing else.`);
  report.nearFarSpreadWU = spread;
  if (nearC < 0) console.log(`   🔴 AND THE NEAR ARC IS NEGATIVE (${nearC.toFixed(1)} wu): the canopy is darkening SAFE GROUND — `
    + `"the one error a zone visual must never make", by fogRing.ts:update's own words.`);
}

// ── the two candidate fixes, measured in the same frames ────────────────────
console.log('\n── CANDIDATE FIXES, same frames, same threshold ───────────────────────');
const armRow = (label, key) => {
  const n = m(near, key), s = m(side, key), f = m(far, key);
  const sp = (n !== null && f !== null) ? Math.abs(f - n) : null;
  console.log(`   ${label.padEnd(34)} NEAR ${(n === null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1)).padStart(7)}`
    + `   SIDE ${(s === null ? '—' : (s >= 0 ? '+' : '') + s.toFixed(1)).padStart(7)}`
    + `   FAR ${(f === null ? '—' : (f >= 0 ? '+' : '') + f.toFixed(1)).padStart(7)}`
    + `   spread ${sp === null ? '—' : sp.toFixed(1).padStart(6)} wu`);
  return { near: n, side: s, far: f, spread: sp };
};
report.arms = {
  shipped: armRow('shipped (translate AWAY)', 'canopySeen'),
  flip: armRow('FIX A — same slide, sign flipped', 'flipSeen'),
  exact: armRow('FIX B — closed-form homothety', 'exactSeen'),
};
console.log(`   (authored: the canopy ramp starts at +12 wu and reaches alpha 0.6 at +44 wu,`
  + ` so a REGISTERED canopy reads ~+12…+44 on every arc.)`);

report.summary = { nearC, sideC, farC };
await writeFile(join(OUT, 'fc_pix.json'), JSON.stringify(report, null, 2));
console.log(`\n   PNGs + fc_pix.json in ${OUT} — READ THEM.`);
