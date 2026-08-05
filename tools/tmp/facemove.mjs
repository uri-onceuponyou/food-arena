#!/usr/bin/env node
/**
 * THROWAWAY read-only probe — DID ANY GEOMETRY MOVE?
 *
 * Built for one question and one question only: four characters (`egg`, `sushi`,
 * `soup`, `waterbottle`) author their face features straight onto `rig.joints.head`
 * instead of onto `rig.joints.face`, which means the character-select framing rule
 * and `chars_metrics.mjs` both fall back to the head box and neither can see a face.
 * The fix is a REPARENT, and a reparent that changes any world transform is a
 * regression, not a fix — so it has to be proved, not asserted.
 *
 * `face` is a direct child of `head`, so moving a feature from `head` to `face` is a
 * no-op **only if `face`'s own local transform is identity**. This probe is what
 * checks that, and it checks it the strongest way available: it dumps the world
 * matrix of EVERY mesh in the model, canonicalises the dump, and hashes it. Two runs
 * with the same hash cannot differ by a millimetre anywhere, in any character, for
 * any reason — including reasons this probe's author did not think of.
 *
 * Also reported, because they are the things the reparent is FOR:
 *   - `faceBox`   world Box3 of the `face` joint's subtree (null when it holds no
 *                 geometry — which is exactly the defect), plus its screen
 *                 projection, so "the framing rule can now see a face" is a number.
 *   - `headBox`   the fallback the framing rule uses today, for comparison.
 *   - a plain (unlit-key, no-post) render, saved as a PNG, so the numeric claim can
 *     be cross-checked against pixels with `tools/tmp/imdiff.mjs`.
 *
 * Usage:
 *   node tools/tmp/facemove.mjs --tag before --out shots/probe/face
 *   node tools/tmp/facemove.mjs --tag after  --out shots/probe/face
 *   node tools/tmp/facemove.mjs --diff shots/probe/face/before.json shots/probe/face/after.json
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);

// ── diff mode: no browser, just compare two dumps ────────────────────────────
if (a.includes('--diff')) {
  const i = a.indexOf('--diff');
  const A = JSON.parse(await readFile(a[i + 1], 'utf8'));
  const B = JSON.parse(await readFile(a[i + 2], 'utf8'));
  let bad = 0;
  for (const id of Object.keys(A)) {
    const x = A[id], y = B[id];
    if (!y) { console.log(`MISSING  ${id}`); bad++; continue; }
    const same = x.geomHash === y.geomHash;
    if (!same) {
      // Name the movers rather than just failing.
      //
      // ── This has to be a MULTISET comparison, not a lookup ────────────────────
      // A first version keyed a Map by `name + geometry signature` and compared
      // one-to-one. Half this cast builds its features in a mirrored `for (const sx
      // of [-1, 1])` loop, so both eyes share a key and the Map kept only the
      // second — every left eye was then compared against the right eye's position
      // and reported as having "moved 0.66 m". The instrument was inventing the
      // exact defect it exists to rule out (`docs/LESSONS.md` §13). Group by key and
      // compare the SORTED list of positions inside each group instead: a pure
      // reparent leaves that list untouched, and a real move changes it.
      const group = (arr) => {
        const g = new Map();
        for (const m of arr) {
          if (!g.has(m.key)) g.set(m.key, []);
          g.get(m.key).push(m.wp.join(','));
        }
        for (const v of g.values()) v.sort();
        return g;
      };
      const gA = group(x.meshes), gB = group(y.meshes);
      const moved = [];
      for (const [k, vb] of gB) {
        const va = gA.get(k);
        if (!va) { moved.push(`${k.split('|')[0]} ADDED x${vb.length}`); continue; }
        if (va.length !== vb.length) { moved.push(`${k.split('|')[0]} count ${va.length}->${vb.length}`); continue; }
        for (let i = 0; i < va.length; i++) {
          if (va[i] === vb[i]) continue;
          const p = va[i].split(',').map(Number), q = vb[i].split(',').map(Number);
          moved.push(`${k.split('|')[0]} moved ${Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]).toFixed(4)}m`);
        }
      }
      for (const k of gA.keys()) if (!gB.has(k)) moved.push(`${k.split('|')[0]} REMOVED`);
      const faceMovers = moved.filter((s) => /eye|brow|lid|mouth|lip|pupil|glint|smile|blush|crease|sclera|face/i.test(s));
      console.log(`CHANGED  ${id.padEnd(12)} ${moved.length} mesh(es) differ; ${faceMovers.length} of them FACE`);
      for (const s of moved.slice(0, 10)) console.log(`            ${s}`);
      if (faceMovers.length) for (const s of faceMovers.slice(0, 10)) console.log(`      FACE  ${s}`);
      bad++;
    } else {
      const fa = x.faceBox ? 'face' : 'NONE';
      const fb = y.faceBox ? 'face' : 'NONE';
      console.log(`IDENTICAL ${id.padEnd(12)} ${x.meshes.length} meshes, hash ${x.geomHash.slice(0, 12)}   faceJoint ${fa} -> ${fb}`
        + (y.faceBox ? `  facePx ${y.facePx ? `${y.facePx.w}x${y.facePx.h}` : '-'}` : ''));
    }
  }
  console.log(bad ? `\n${bad} character(s) CHANGED` : '\nNOTHING MOVED — every world matrix bit-identical');
  process.exit(bad ? 1 : 0);
}

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const OUT = get('--out', 'shots/probe/face');
const TAG = get('--tag', 'dump');
const IDS = get('--ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog').split(',');
const ANIM = get('--anim', 'idle');
const T = Number(get('--t', 1.5));
const W = Number(get('--w', 640)), H = Number(get('--h', 800));
const SHOTS = a.includes('--shots');

const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const DUMP = ({ t, anim }) => {
  const stage = window.__stage, scene = stage.scene;
  window.__preview.frameAt(t, { anim, remount: true });
  let root = null;
  for (const c of scene.children) {
    if (c.isLight || c.name === 'preview_ground' || c.name === 'lighting') continue;
    let has = false; c.traverse((o) => { if (o.name === 'head') has = true; });
    if (has) { root = c; break; }
  }
  root.updateMatrixWorld(true);
  const THREE = window.__THREE ?? null;

  const path = (m) => {
    const names = []; let o = m;
    while (o && o !== root) { if (o.name) names.push(o.name); o = o.parent; }
    return names.reverse().join('/');
  };

  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const f = (v) => +v.toFixed(6);
  const recs = meshes.map((m) => {
    const e = m.matrixWorld.elements;
    // Geometry signature: vertex count + the local bounding box, rounded. Enough to
    // tell two same-named meshes apart without shipping the whole buffer.
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const sig = `${g.attributes.position?.count ?? 0}:${[bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].map((v) => v.toFixed(4)).join(',')}`;
    return {
      key: `${m.name || '?'}|${sig}`,
      parent: m.parent?.name ?? '',
      path: path(m),
      wp: [f(e[12]), f(e[13]), f(e[14])],
      // Full basis, so a pure ROTATION with an unchanged origin cannot slip through.
      wm: [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]].map(f),
    };
  });
  // Canonical: sort by the full record so parent order / traversal order cannot
  // change the hash on its own. A reparent DOES change traversal order; it must not
  // change this.
  const canon = recs
    .map((r) => `${r.key}@${r.wp.join(',')}|${r.wm.join(',')}`)
    .sort()
    .join('\n');

  // Box3 without importing THREE into the page: walk vertices ourselves.
  const subtreeBox = (name) => {
    const j = root.getObjectByName(name);
    if (!j) return null;
    let n = 0;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    j.traverse((o) => {
      const m = o;
      if (!m.isMesh) return;
      const pos = m.geometry?.getAttribute('position');
      if (!pos) return;
      m.updateWorldMatrix(true, false);
      const e = m.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const wx = e[0] * px + e[4] * py + e[8] * pz + e[12];
        const wy = e[1] * px + e[5] * py + e[9] * pz + e[13];
        const wz = e[2] * px + e[6] * py + e[10] * pz + e[14];
        if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
        if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
        if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
        n++;
      }
    });
    return n ? { min: [f(x0), f(y0), f(z0)], max: [f(x1), f(y1), f(z1)], verts: n } : null;
  };

  // Screen projection of a world box, through the camera that would draw it.
  const cam = stage.rig.camera;
  cam.updateMatrixWorld(true);
  const cvW = stage.renderer.domElement.width, cvH = stage.renderer.domElement.height;
  const projectBox = (b) => {
    if (!b) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const p = {
        x: (i & 1) ? b.max[0] : b.min[0],
        y: (i & 2) ? b.max[1] : b.min[1],
        z: (i & 4) ? b.max[2] : b.min[2],
      };
      const v = new cam.position.constructor(p.x, p.y, p.z).project(cam);
      const sx = (v.x * 0.5 + 0.5) * cvW, sy = (0.5 - v.y * 0.5) * cvH;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    }
    return { x: +x0.toFixed(2), y: +y0.toFixed(2), w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2) };
  };

  const faceBox = subtreeBox('face');
  const headBox = subtreeBox('head');
  const faceJoint = root.getObjectByName('face');
  return {
    meshCount: meshes.length,
    meshes: recs,
    canon,
    faceBox, headBox,
    facePx: projectBox(faceBox), headPx: projectBox(headBox),
    faceLocal: faceJoint ? {
      pos: [f(faceJoint.position.x), f(faceJoint.position.y), f(faceJoint.position.z)],
      rot: [f(faceJoint.rotation.x), f(faceJoint.rotation.y), f(faceJoint.rotation.z)],
      scale: [f(faceJoint.scale.x), f(faceJoint.scale.y), f(faceJoint.scale.z)],
      children: faceJoint.children.length,
    } : null,
  };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
await mkdir(OUT, { recursive: true });
const out = {};
for (const id of IDS) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  try {
    await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=${ANIM}&t=${T}&shot=1`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForFunction('window.__previewReady === true', null, { timeout: 120000 });
    const r = await page.evaluate(DUMP, { t: T, anim: ANIM });
    r.geomHash = createHash('sha256').update(r.canon).digest('hex');
    delete r.canon;
    out[id] = r;
    const fb = r.faceBox
      ? `face y[${r.faceBox.min[1]}..${r.faceBox.max[1]}] ${r.facePx.w.toFixed(0)}x${r.facePx.h.toFixed(0)}px`
      : 'face EMPTY (framing falls back to head)';
    console.log(`${id.padEnd(12)} ${String(r.meshCount).padStart(3)} meshes  hash ${r.geomHash.slice(0, 12)}  ${fb}`);
    if (SHOTS) await page.screenshot({ path: `${OUT}/${TAG}-${id}.png` });
  } catch (e) { console.error(`✗ ${id}: ${e}`); out[id] = { error: String(e) }; }
  finally { await page.close(); }
}
await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}/${TAG}.json`);
await browser.close();
