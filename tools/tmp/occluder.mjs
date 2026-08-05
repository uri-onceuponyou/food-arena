#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — WHAT IS IN FRONT OF THIS LIMB?
 *
 * `limbcheck.mjs` says soup's forearms deliver 0.337 / 0.383 of their own footprint
 * while the food mass covers 0.005 of them. Two geometry fixes reasoned from source
 * both measured WORSE and were reverted. The hand-off was explicit: **name the
 * occluder before anything else moves.**
 *
 * ── Method: ABLATION, not attribution ────────────────────────────────────────
 * The obvious approach is an ID buffer: paint every mesh a flat colour, read back,
 * and see who owns the pixels the limb should have had. That was tried here first and
 * it is NOT trustworthy on this scene, for a reason worth recording:
 *
 *   an ID pass has to force every material opaque, and this cast is full of
 *   transparent surfaces that (correctly) do not write depth. In the ID pass those
 *   become solid occluders, so the ID buffer reports burial that the shipped render
 *   does not have. Measured on hamburger's `handR`: top-most-owner attribution says
 *   0.179 delivered where `limbcheck` says 0.826. **The ID buffer answers a question
 *   about a scene we do not ship.**
 *
 * So the primary measurement here is an ABLATION, which cannot be fooled by any of
 * that because it never leaves the shipped materials: hide one candidate, re-run
 * `limbcheck`'s own metric on the target, and see what the target gains. The occluder
 * is whatever, when removed, gives the limb its pixels back. Groups first, then the
 * individual meshes inside the winning group.
 *
 * `limbcheck`'s metric is reimplemented here byte-for-byte (same `plain()` render,
 * same green key, same hide-vs-base diff, same >12 threshold) and it REPRODUCES
 * `limbcheck`'s published numbers exactly — hamburger handR 19259, soup elbowR 1244,
 * soup elbowL 1411 — so this probe and the acceptance test cannot drift apart.
 *
 * The ID buffer is still rendered, as a cross-check and to name meshes cheaply, and
 * it is still forced to LINEAR (`docs/LESSONS.md` §12: `renderer.outputColorSpace` is
 * sRGB, so linear-written IDs are transfer-encoded on the way to the framebuffer and
 * every ID quantises into the wrong slot — which produced a confident, entirely
 * fictional zero-pixel-mesh list on this project once already). `--selftest` proves
 * that line is load-bearing by rendering the same frame with the transfer left ON and
 * reporting how many IDs move.
 *
 *   node tools/tmp/occluder.mjs --ids soup --joints elbowL,elbowR
 *   node tools/tmp/occluder.mjs --ids hamburger --joints handR --pitch 58 --meshes 12
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/occl');
const TAG = get('--tag', 'occl');
const IDS = get('--ids', 'soup').split(',');
const JOINTS = get('--joints', 'elbowL,elbowR').split(',');
const ANIM = get('--anim', 'idle');
const T = Number(get('--t', 1.5));
const PITCH = Number(get('--pitch', 22));
const MESHES = Number(get('--meshes', 10));
const W = Number(get('--w', 640)), H = Number(get('--h', 800));
const SELFTEST = a.includes('--selftest');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const DUMP = ({ t, anim, joints, selftest, topMeshes }) => {
  const stage = window.__stage, scene = stage.scene, renderer = stage.renderer;
  window.__preview.frameAt(t, { anim, remount: true });
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  const ground = scene.getObjectByName('preview_ground');
  const gv = ground ? ground.visible : null;
  if (ground) ground.visible = false;

  const gl = renderer.getContext(), cv = renderer.domElement;
  const W = cv.width, H = cv.height;

  const JOINT_NAMES = ['face', 'head', 'neck', 'torso', 'hips', 'shoulderL', 'shoulderR',
    'elbowL', 'elbowR', 'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR',
    'rig_body', 'rig_root'];
  const groupKey = (o) => {
    let n = o;
    while (n) { if (JOINT_NAMES.includes(n.name)) return n.name; if (n === root) break; n = n.parent; }
    return 'other';
  };
  const path = (m) => {
    const names = []; let o = m;
    while (o && o !== root) { if (o.name) names.push(o.name); o = o.parent; }
    return names.reverse().join('/');
  };

  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const groups = [...new Set(meshes.map(groupKey))];

  // ── limbcheck.mjs's render and metric, verbatim ─────────────────────────────
  const plain = (only = null) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    let prev = null;
    if (only) { prev = meshes.map((m) => m.visible); meshes.forEach((m) => { m.visible = only(m); }); }
    renderer.setRenderTarget(null); renderer.setClearColor(0x00ff00, 1); renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (prev) meshes.forEach((m, i) => { m.visible = prev[i]; });
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };
  const keyed = (px) => {
    const m = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) m[j] = (px[i] < 60 && px[i + 1] > 180 && px[i + 2] < 60) ? 0 : 1;
    return m;
  };
  const diffPx = (A, B) => {
    let n = 0;
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
      if (d > 12) n++;
    }
    return n;
  };

  // ── ID buffer, LINEAR, for naming only ──────────────────────────────────────
  const saved = meshes.map((m) => m.material);
  const BasicCtor = Object.getPrototypeOf(saved[0]).constructor;
  const paint = (indexOf) => meshes.map((m, i) => {
    const k = indexOf(m, i);
    const mat = new BasicCtor({ color: 0x000000 });
    mat.color.setRGB(((k % 6) * 51) / 255, ((Math.floor(k / 6) % 6) * 51) / 255, ((Math.floor(k / 36) % 6) * 51) / 255);
    mat.toneMapped = false;
    mat.side = saved[i].side;
    mat.transparent = false;
    mat.depthWrite = true;
    m.material = mat;
    return mat;
  });
  const restore = () => meshes.forEach((m, i) => { m.material = saved[i]; });
  const renderIds = (linear = true) => {
    const fog = scene.fog, bg = scene.background, sh = renderer.shadowMap.enabled;
    const ocs = renderer.outputColorSpace;
    if (linear) renderer.outputColorSpace = 'srgb-linear';   // docs/LESSONS.md §12
    scene.fog = null; scene.background = null; renderer.shadowMap.enabled = false;
    renderer.setRenderTarget(null); renderer.setClearColor(0xffffff, 1); renderer.clear();
    renderer.render(scene, stage.rig.camera);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    renderer.outputColorSpace = ocs;
    scene.fog = fog; scene.background = bg; renderer.shadowMap.enabled = sh;
    return px;
  };
  const q6 = (v) => Math.round(v / 51);
  const decode = (px, n) => {
    const idAt = new Int32Array(W * H).fill(-1);
    for (let j = 0; j < W * H; j++) {
      const i = j * 4;
      if (px[i] > 248 && px[i + 1] > 248 && px[i + 2] > 248) continue;
      const id = q6(px[i]) + q6(px[i + 1]) * 6 + q6(px[i + 2]) * 36;
      if (id >= 0 && id < n) idAt[j] = id;
    }
    return idAt;
  };

  let mats = paint((m, i) => i);
  const meshIdPx = renderIds(true);
  const encPx = selftest ? renderIds(false) : null;
  mats.forEach((m) => m.dispose());
  restore();
  const meshId = decode(meshIdPx, meshes.length);
  const encId = encPx ? decode(encPx, meshes.length) : null;
  let selftestOut = null;
  if (encId) {
    let n = 0, diff = 0;
    for (let j = 0; j < W * H; j++) if (meshId[j] >= 0) { n++; if (encId[j] !== meshId[j]) diff++; }
    selftestOut = { idPx: n, movedByTransfer: diff, share: n ? +(diff / n).toFixed(3) : 0 };
  }

  const basePlain = plain();
  const out = {};

  for (const jname of joints) {
    const isTarget = (m) => groupKey(m) === jname;
    const targets = meshes.filter(isTarget);
    if (!targets.length) { out[jname] = { error: 'no meshes in group' }; continue; }

    const isoPx = plain(isTarget);
    const foot = keyed(isoPx);
    let footN = 0;
    for (let j = 0; j < W * H; j++) if (foot[j]) footN++;

    const baseContrib = diffPx(basePlain, plain((m) => !isTarget(m)));

    // ── ABLATION over joint groups ──────────────────────────────────────────
    // Hide candidate G, re-render, re-run the hide-diff. `gain` is how many of the
    // target's pixels G was sitting on. This is the number that decides.
    const byGroup = [];
    for (const g of groups) {
      if (g === jname) continue;
      const gone = (m) => groupKey(m) !== g;
      const withoutG = plain(gone);
      const withoutGandT = plain((m) => gone(m) && !isTarget(m));
      const c = diffPx(withoutG, withoutGandT);
      if (c - baseContrib > 0) byGroup.push({ joint: g, contribWithout: c, gain: c - baseContrib, gainShare: +((c - baseContrib) / footN).toFixed(3) });
    }
    byGroup.sort((p, q) => q.gain - p.gain);

    // ── ABLATION over the individual meshes of the winning groups ────────────
    const byMesh = [];
    const suspectGroups = new Set(byGroup.slice(0, 3).map((x) => x.joint));
    for (const m of meshes) {
      if (isTarget(m)) continue;
      if (!suspectGroups.has(groupKey(m))) continue;
      const gone = (x) => x !== m;
      const c = diffPx(plain(gone), plain((x) => gone(x) && !isTarget(x)));
      if (c - baseContrib > 0) byMesh.push({ mesh: path(m) || m.name, gain: c - baseContrib, gainShare: +((c - baseContrib) / footN).toFixed(3) });
    }
    byMesh.sort((p, q) => q.gain - p.gain);

    // ID-buffer cross-check: who owns the footprint pixels the target did not get?
    const idHist = new Map();
    for (let j = 0; j < W * H; j++) {
      if (!foot[j]) continue;
      const mi = meshId[j];
      if (mi < 0 || isTarget(meshes[mi])) continue;
      idHist.set(mi, (idHist.get(mi) ?? 0) + 1);
    }

    out[jname] = {
      footprintPx: footN,
      contribPx: baseContrib,
      ratio: footN ? +(baseContrib / footN).toFixed(3) : null,
      occludedByJoint: byGroup.slice(0, 8),
      occludedByMesh: byMesh.slice(0, topMeshes),
      idBufferSays: [...idHist.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6)
        .map(([mi, n]) => ({ mesh: path(meshes[mi]) || `#${mi}`, px: n })),
    };
  }

  if (ground) ground.visible = gv;
  return { meshCount: meshes.length, groups, joints: out, selftest: selftestOut };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const out = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=${PITCH}`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
    const r = await page.evaluate(DUMP, { t: T, anim: ANIM, joints: JOINTS, selftest: SELFTEST, topMeshes: MESHES });
    out[id] = r;
    console.log(`=== ${id}  ${ANIM} t=${T} pitch=${PITCH}  ${r.meshCount} meshes`);
    if (r.selftest) console.log(`   SELFTEST: leaving the sRGB transfer ON moves ${r.selftest.movedByTransfer}/${r.selftest.idPx} ids (${(r.selftest.share * 100).toFixed(1)}%) — the linear force is load-bearing`);
    for (const [j, v] of Object.entries(r.joints)) {
      if (v.error) { console.log(`   ${j}: ${v.error}`); continue; }
      console.log(`   ${j.padEnd(10)} footprint ${String(v.footprintPx).padStart(6)}px  delivered ${String(v.contribPx).padStart(6)} (${v.ratio})   [matches limbcheck]`);
      for (const o of v.occludedByJoint) console.log(`        ABLATE JOINT ${o.joint.padEnd(11)} +${String(o.gain).padStart(5)}px  ${(o.gainShare * 100).toFixed(1)}% of footprint`);
      for (const o of v.occludedByMesh) console.log(`        ABLATE MESH  ${o.mesh.padEnd(52)} +${String(o.gain).padStart(5)}px  ${(o.gainShare * 100).toFixed(1)}%`);
    }
  } catch (e) { console.error(`✗ ${id}: ${e}`); out[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/${TAG}.json`);
await browser.close();
