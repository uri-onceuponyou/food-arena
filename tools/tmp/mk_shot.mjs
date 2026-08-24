#!/usr/bin/env node
/**
 * MK_SHOT — DO MEDIKITS ACTUALLY DRAW? Six seats, the shipped match camera, real pixels.
 *
 *   node tools/tmp/with_snapshot.mjs -- \
 *     node tools/tmp/mk_shot.mjs --url '{URL}' --out tools/tmp/mk_out
 *
 * ⚠️ NEVER `:5173` — every agent save reloads it mid-measurement.
 *
 * ── WHY THIS EXISTS, AND WHY A SCREENSHOT ALONE WOULD NOT DO ────────────────
 *
 * `CLAUDE.md` #4: *"when something isn't there, assume it is rendering and INVISIBLE"* —
 * true **nineteen** times in this repo. `sim.test.mjs` §40 proves the kits exist in the
 * SIM. `vfx.ts` builds a mesh per kit. Neither of those is evidence that a player can see
 * one, and a screenshot with a white box in it is not evidence either: at 1280x720 with a
 * 58° camera over a 2800x2000 arena, "I think I can see it" is exactly the judgement this
 * project has been wrong about most often.
 *
 * So the observable is a DIFFERENCE, and the kits themselves are the only thing that moves:
 *
 *   1  freeze the frame (rAF held, camera shake explicitly zeroed — `CameraRig.update`
 *      re-randomises the shake at `dt = 0`, which drifted 344 of 344 frozen frames once);
 *   2  render and capture;
 *   3  set `visible = false` on every `vfx_medikit` group, render and capture again;
 *   4  restore, render and capture a THIRD time.
 *
 *   A vs B differ  →  the kits are drawing, and the differing pixels ARE their footprint,
 *                     as a number and as a bounding box, not as an opinion.
 *   A vs C same    →  the DRIFT CONTROL. Nothing else changed between the renders, so the
 *                     A/B difference is attributable to the kits and to nothing else. A
 *                     probe without this arm reports "they differ" on a frame where the
 *                     fog happened to tick, and calls it a feature.
 *
 * 🚨 **BOTH ARMS ARE REQUIRED, AND THE SECOND ONE IS THE ONE THAT MAKES THE FIRST MEAN
 * ANYTHING.** A/B differing is not evidence on a live frame; A/C matching is what turns it
 * into evidence.
 *
 * ── NON-VACUITY ─────────────────────────────────────────────────────────────
 *
 * Every row is about a kit on the floor. If no fighter died, there are no kits, the
 * `visible = false` loop runs over an empty set, A and B are trivially identical and the
 * tool would report a defect that is really an empty fixture — `[].forEach` is the same
 * trap as `[].every()`. So the kit count is asserted NON-ZERO first and the tool exits 1
 * with a PNG when it cannot find one.
 *
 * ── CAMERAS ─────────────────────────────────────────────────────────────────
 *
 * The MATCH rig (`render/camera.ts`, grep `opts.pitchDeg ?? 58`) is the one this tool can
 * measure. The lobby rig (`ui/screens/charStage.ts`, grep `pitchDeg: 20`) is a
 * character-select screen with no `MatchState` and no floor to put a kit on, so it cannot
 * be reached from a match at all.
 *
 * 🚨 **`--pitch` EXISTED, WAS INERT-ADJACENT, AND NOW REFUSES. READ THIS BEFORE ADDING IT
 * BACK.** Writing `stage.rig.pitchDeg = 20` and calling `apply()` DOES move the camera —
 * `apply()` reads `this.pitchDeg` live — but `lookAhead` and the fair-play distance solve
 * are computed by `fairSolveAt(aspect, pitchDeg, fov, …)` on construction and on resize,
 * and **are not re-derived**. So a mutated pitch gives a rig with a 20° elevation and a 58°
 * `lookAhead`: a camera nobody designed, whose framing is an artefact. Measured — the kit
 * projected to ndc y = **+2.0039**, two full frames above the top of the screen, and the
 * tool duly reported "0 px, does not draw" about an object that draws perfectly well.
 *
 * That is `CLAUDE.md` #6's second half exactly: *"`--selftest` validates a tool's LOGIC. It
 * never validates where the tool is POINTED."* The flag now exits 2 with this paragraph.
 * Checking a floor prop at the shallow angle needs a rig CONSTRUCTED at 20° — which
 * re-derives distance and lookAhead together — not a field poked after the fact.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
const BASE = (flag('url') ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
const OUT = resolve(flag('out') ?? 'tools/tmp/mk_out');
const TAG = flag('tag') ?? 'run';
const PITCH = null;
if (flag('pitch') !== null) {
  console.error('mk_shot: --pitch is REFUSED. Mutating `rig.pitchDeg` moves the camera but does NOT');
  console.error('  re-derive `lookAhead` or the fair-play distance (both come from `fairSolveAt` at');
  console.error('  construction), so the result is a 20°-elevation / 58°-lookAhead rig nobody designed.');
  console.error('  Measured: the kit projected to ndc y +2.0039 and this tool reported "0 px, does not');
  console.error('  draw" about an object that draws fine. A shallow-angle check needs a rig CONSTRUCTED');
  console.error('  at that pitch. See the header.');
  process.exit(2);
}
const WAIT_MS = Number(flag('wait') ?? 240_000);

if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('mk_shot: --url (or PREVIEW_BASE) is required and must be a SNAPSHOT, never :5173.');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   - ${name}${detail ? ` · ${detail}` : ''}`); }
  else { fail++; console.log(`  FAIL - ${name}${detail ? ` · ${detail}` : ''}`); }
  return ok;
};

const PAGE_INSTALL_RAF = () => {
  const rafReal = window.requestAnimationFrame.bind(window);
  let held = null;
  window.requestAnimationFrame = (cb) => {
    if (held !== null) { held = cb; return -1; }
    return rafReal(cb);
  };
  window.__mkRaf = {
    stop() { if (held === null) held = false; },
    start() { const cb = held; held = null; if (typeof cb === 'function') rafReal(cb); },
  };
};

/** How many medikit groups the VFX layer is currently holding, and where they are. */
const PAGE_KITS = () => {
  const layer = window.__vfxLayer;
  if (!layer || !layer.group) return { ok: false, why: 'no window.__vfxLayer' };
  const kits = [];
  layer.group.traverse((o) => { if (o.name === 'vfx_medikit') kits.push(o); });
  const stage = window.__stage;
  const cam = stage && stage.camera ? stage.camera : null;
  return {
    ok: true,
    n: kits.length,
    world: kits.map((k) => ({ x: +k.position.x.toFixed(3), y: +k.position.y.toFixed(3), z: +k.position.z.toFixed(3) })),
    // Every kit group must carry a body AND a cross, or the "it draws" number below could
    // be a white box with no marking on it — which is a different object.
    parts: kits.map((k) => {
      const names = [];
      k.traverse((o) => { if (o.name && o.name !== 'vfx_medikit') names.push(o.name); });
      return names.join('+');
    }),
    camPitchDeg: cam && stage.rig && stage.rig.pitchDeg !== undefined ? stage.rig.pitchDeg : null,
  };
};

/**
 * The whole measurement, in ONE synchronous evaluate. Nothing — not rAF, not the sim, not
 * a CSS keyframe — runs between the three renders, which is the only condition under which
 * "A and C are identical" says anything at all.
 */
const PAGE_MEASURE = (pitch) => {
  const stage = window.__stage;
  const layer = window.__vfxLayer;
  if (!stage || !stage.rig || !stage.canvas) return { ok: false, why: 'no window.__stage' };
  if (!layer || !layer.group) return { ok: false, why: 'no window.__vfxLayer' };

  const kits = [];
  layer.group.traverse((o) => { if (o.name === 'vfx_medikit') kits.push(o); });
  if (kits.length === 0) return { ok: false, why: 'no medikit in the scene graph' };

  if (typeof pitch === 'number' && Number.isFinite(pitch)) stage.rig.pitchDeg = pitch;

  const W = stage.canvas.width;
  const H = stage.canvas.height;
  const scratch = document.createElement('canvas');
  scratch.width = W; scratch.height = H;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });

  // ── WHERE IS THE KIT ON SCREEN, BEFORE ANYTHING IS HIDDEN ────────────────
  //
  // 🚨 THIS BLOCK EXISTS BECAUSE THE FIRST RUN OF THIS TOOL REPORTED **0 px** AND THAT WAS
  // AN HONEST ANSWER TO THE WRONG QUESTION. Two kits were in the scene graph and hiding
  // them changed nothing — which reads exactly like `CLAUDE.md` #4, "it is rendering and
  // INVISIBLE" — but the kits were 1,253 wu away in a 2800x2000 arena and the camera was
  // following the local seat. **Off screen and invisible are different findings and only
  // one of them is a bug.** The projection below separates them, and the FOCUS arm then
  // asks the question that was meant: when a kit IS in frame, does it draw?
  // ⚠️ `rig.camera`, NOT `stage.camera` — `stage.camera` is UNDEFINED and the first
  // version of this block read it, which is a `TypeError` rather than a wrong answer,
  // i.e. the cheap direction to be wrong in. `stage.ts:Stage` exposes `readonly rig`
  // and `RenderPass` is constructed with `this.rig.camera`.
  const cam = stage.rig.camera;
  cam.updateMatrixWorld();
  const project = (o) => {
    const v = o.getWorldPosition(o.position.clone());
    v.project(cam);
    return {
      ndc: { x: +v.x.toFixed(4), y: +v.y.toFixed(4), z: +v.z.toFixed(4) },
      px: { x: Math.round((v.x * 0.5 + 0.5) * W), y: Math.round((-v.y * 0.5 + 0.5) * H) },
      onScreen: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z > -1 && v.z < 1,
    };
  };
  const projected = kits.map(project);
  const anyOnScreen = projected.some((p) => p.onScreen);

  // FOCUS ARM: if nothing is in frame, point the rig at the first kit's ground position and
  // ask again. `rig.target` is what the camera looks at (`camera.ts:snapTo`/`follow` both
  // write it), and rAF is held, so nothing lerps it back before the render.
  let focused = false;
  if (!anyOnScreen) {
    const k0 = kits[0];
    // `snapTo` rather than writing `target` directly: it sets target AND desired and then
    // calls the rig's own `apply()`, so the camera transform is recomputed here instead of
    // depending on `stage.render(0)` happening to do it. ⚠️ Metres — `rig.targetUnits()`
    // is the one that converts.
    if (typeof stage.rig.snapTo === 'function') stage.rig.snapTo(k0.position.x, k0.position.z);
    else {
      stage.rig.target.set(k0.position.x, 0, k0.position.z);
      if (stage.rig.desired && stage.rig.desired.set) stage.rig.desired.set(k0.position.x, 0, k0.position.z);
    }
    focused = true;
  }

  const still = () => {
    const rig = stage.rig;
    rig.shakeAmount = 0;
    if (rig.shakeOffset && rig.shakeOffset.set) rig.shakeOffset.set(0, 0, 0);
  };
  const grab = () => {
    still();
    stage.render(0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(stage.canvas, 0, 0);
    return ctx.getImageData(0, 0, W, H).data;
  };
  const url = () => { still(); stage.render(0); return stage.canvas.toDataURL(); };

  grab();                                   // warm-up: the first render after a freeze is not the second
  const A = grab();
  const urlA = url();
  for (const k of kits) k.visible = false;
  const B = grab();
  const urlB = url();
  for (const k of kits) k.visible = true;
  const C = grab();

  // Differing pixels, and where they are. THRESH is 8 per channel: a value below the
  // 8-bit dither floor would count compression noise as a medikit.
  const THRESH = 8;
  let diffAB = 0; let diffAC = 0;
  let minX = W; let minY = H; let maxX = -1; let maxY = -1;
  for (let i = 0, p = 0; i < A.length; i += 4, p++) {
    const dAB = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (dAB > THRESH) {
      diffAB++;
      const x = p % W; const y = (p / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const dAC = Math.abs(A[i] - C[i]) + Math.abs(A[i + 1] - C[i + 1]) + Math.abs(A[i + 2] - C[i + 2]);
    if (dAC > THRESH) diffAC++;
  }

  // A magnified crop of the footprint, exported so a human can look at the thing itself
  // rather than at a pixel count. `CLAUDE.md` #3: judge rendered pixels.
  let cropUrl = null;
  if (maxX >= 0) {
    const pad = 40;
    const cx = Math.max(0, minX - pad); const cy = Math.max(0, minY - pad);
    const cw = Math.min(W - cx, maxX - minX + 1 + pad * 2);
    const ch = Math.min(H - cy, maxY - minY + 1 + pad * 2);
    const zoom = Math.max(1, Math.min(8, Math.floor(700 / Math.max(cw, ch))));
    const crop = document.createElement('canvas');
    crop.width = cw * zoom; crop.height = ch * zoom;
    const cc = crop.getContext('2d');
    cc.imageSmoothingEnabled = false;
    still(); stage.render(0);
    cc.drawImage(stage.canvas, cx, cy, cw, ch, 0, 0, cw * zoom, ch * zoom);
    cropUrl = crop.toDataURL();
  }

  cam.updateMatrixWorld();
  const projectedAfter = kits.map(project);

  return {
    ok: true,
    kits: kits.length,
    W, H,
    diffAB, diffAC,
    projected, projectedAfter, focused, anyOnScreen,
    total: W * H,
    box: maxX >= 0 ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
    urlA, urlB, cropUrl,
    pitchDeg: stage.rig.pitchDeg ?? null,
  };
};

const png = (dataUrl, path) => {
  if (!dataUrl) return;
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
};

async function main() {
  console.log(`mk_shot [${TAG}] — six seats, played until a body drops its kits`);
  console.log(`  base ${BASE}${PITCH === null ? '' : `  pitch ${PITCH}°`}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/@vite/client*', (r) => r.fulfill({
    status: 200, contentType: 'text/javascript',
    body: 'const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,'
      + 'dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});'
      + 'export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;'
      + 'export const ErrorOverlay=class{};export default {};',
  }));

  // `?seats=6` is the PRODUCT path, the build Uri plays. `simSpeed` only compresses wall
  // clock — it does not change the sim, which steps on its own fixed `dt`.
  const url = `${BASE}/?seats=6&simSpeed=6&pointerLock=0`;
  await page.addInitScript(PAGE_INSTALL_RAF);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 180_000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => {});

  // ── wait for a body to drop its kits ────────────────────────────────────────
  const t0 = Date.now();
  let kits = { ok: true, n: 0 };
  while (Date.now() - t0 < WAIT_MS) {
    kits = await page.evaluate(PAGE_KITS);
    if (kits.ok && kits.n > 0) break;
    await page.waitForTimeout(120);
  }
  const waited = ((Date.now() - t0) / 1000).toFixed(1);

  // 🚨 NON-VACUITY, AND IT IS THE FIRST ROW FOR A REASON. With zero kits the hide/show
  // loop runs over an empty array, A and B come back identical, and the tool reports
  // "the medikits do not draw" about a match in which none ever dropped.
  if (!check('1 a body dropped its kits and the VFX layer is holding them (NON-VACUITY)',
    kits.ok && kits.n > 0, kits.ok ? `${kits.n} kit group(s) after ${waited}s` : kits.why)) {
    await page.screenshot({ path: `${OUT}/${TAG}-FAIL-nokits.png` });
    await browser.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }
  check('2 every kit group carries a BODY and a CROSS, not just a white box',
    kits.parts.every((p) => p.includes('vfx_medikit_body') && p.includes('vfx_medikit_cross')),
    kits.parts[0]);

  await page.evaluate(() => window.__mkRaf.stop());
  const m = await page.evaluate(PAGE_MEASURE, PITCH);
  if (!m.ok) {
    check('3 the frozen measurement ran', false, m.why);
    await browser.close();
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
  }

  png(m.urlA, `${OUT}/${TAG}-A-with-kits.png`);
  png(m.urlB, `${OUT}/${TAG}-B-kits-hidden.png`);
  png(m.cropUrl, `${OUT}/${TAG}-C-crop.png`);

  // OFF SCREEN vs INVISIBLE. Reported before the headline because a "0 px" result means
  // opposite things on the two sides of this row, and the first version of this tool did
  // not have it and filed the wrong finding.
  console.log(`  projection (natural frame): ${JSON.stringify(m.projected)}`);
  if (m.focused) {
    console.log(`  ⚠️  NO kit was in the natural frame — the rig was pointed at kit 0 for the`);
    console.log(`      measurement below. That is NOT a defect: the camera follows the local`);
    console.log(`      seat and the body fell elsewhere. Re-projected: ${JSON.stringify(m.projectedAfter)}`);
  }
  check('3a the kit is IN FRAME for the measurement — otherwise "0 px" means off-screen, not invisible',
    m.projectedAfter.some((p) => p.onScreen),
    m.projectedAfter.map((p) => `ndc(${p.ndc.x},${p.ndc.y})`).join(' '));

  // THE DRIFT CONTROL, reported FIRST because it is what licenses the headline.
  check('3b DRIFT CONTROL — hiding and restoring returns the frame BIT-IDENTICALLY',
    m.diffAC === 0, `${m.diffAC} px differ between the first and third render`);
  check('4 🔴 THE KITS DRAW — hiding them changes the frame',
    m.diffAB > 0, `${m.diffAB} px of ${m.total} = ${((100 * m.diffAB) / m.total).toFixed(4)}% of the frame`);
  check('5 …and their footprint is big enough for a person to see',
    m.box !== null && m.box.w >= 6 && m.box.h >= 6,
    m.box ? `${m.box.w}x${m.box.h} px at (${m.box.minX},${m.box.minY})` : 'no footprint');
  check('6 no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log(`\n  kits ${m.kits} · canvas ${m.W}x${m.H} · rig pitch ${m.pitchDeg}°`);
  console.log(`  world positions: ${JSON.stringify(kits.world)}`);
  console.log(`  PNGs in ${OUT}`);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
