#!/usr/bin/env node
/**
 * ca_geom — dump WORLD-space bounding boxes for a character's named meshes, plus the
 * rig metrics that place them, off the live preview page.
 *
 * THROWAWAY, read-only on src/. Measurement instrument; changes no game code.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * "The arms are detached" is a claim about two numbers — the arm's inner wall and the
 * body's outer wall at the same height — and both are computable. The alternative is
 * to guess a shoulder width, render, look, and guess again, which is how `burrito.ts`
 * acquired a `shoulderWidth` note recording FOUR successive passes each of which moved
 * the shoulder to fix a gap and moved the torso cap after it (the cap was written as a
 * subtraction from the shoulder width). This prints both walls so the straddle can be
 * solved once.
 *
 * ── THE KNOWN-BAD INPUT ──────────────────────────────────────────────────────
 * `--knownbad detach` translates every upper-arm mesh 0.5 m outward in world X before
 * measuring. The tool MUST then report a large positive gap on both arms. A tool that
 * has not been shown to report DETACHED on a detached input is not measuring
 * attachment (CLAUDE.md #6). It also proves the boxes are read AFTER the rest pose and
 * in world space, which is the assumption every number below rests on.
 *
 *   PREVIEW_BASE=http://localhost:5301 node tools/tmp/ca_geom.mjs --id burrito
 *   PREVIEW_BASE=... node tools/tmp/ca_geom.mjs --id burrito --knownbad detach
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const ID = get('--id', 'burrito');
const KNOWNBAD = get('--knownbad', null);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const url = `${BASE}/preview.html?piece=character&id=${ID}&pitch=20&yaw=0&fill=0.60&t=1.5&anim=idle&shot=1&bg=3d2b21`;
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 700, height: 1000 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

const out = await page.evaluate((bad) => {
  const THREE = window.__THREE ?? null;
  const root = (() => {
    for (const c of window.__stage.scene.children) {
      let hit = null;
      c.traverse((o) => { if (o.name === 'head') hit = c; });
      if (hit) return hit;
    }
    return null;
  })();
  if (!root) return { error: 'no character root (no `head` node under any scene child)' };

  if (bad === 'detach') {
    root.traverse((o) => {
      if (o.name === 'shoulderL') o.position.x -= 0.5;
      if (o.name === 'shoulderR') o.position.x += 0.5;
    });
  }
  root.updateWorldMatrix(true, true);

  // Bounding boxes are computed by hand off world-transformed vertices rather than by
  // Box3.setFromObject, so a mesh with a null/stale boundingBox cannot silently
  // contribute nothing.
  const boxOf = (obj) => {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity, n = 0;
    obj.traverseVisible((o) => {
      const g = o.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      const p = g.attributes.position;
      o.updateWorldMatrix(true, false);
      const m = o.matrixWorld.elements;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
        if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
        if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
        n++;
      }
    });
    return n ? { min: [mnx, mny, mnz], max: [mxx, mxy, mxz], verts: n } : null;
  };

  // ⚠️ `dressLimbs` adds a character's mesh UNDER the joint, and the joints are named
  // for the JOINT (`shoulderL`, `elbowL`, `hipL`, `kneeL`) — not for the bone. A first
  // version of this tool matched `/^upperArm[LR]$/` and found nothing on four of six
  // slots, then printed `worst overlap: Infinity -> ATTACHED`, i.e. it reported a PASS
  // out of an empty set. Fixed by walking from the joint and stopping at the next
  // joint, and by failing loudly when a slot yields no geometry.
  const JOINT_FOR = {
    upperArmL: 'shoulderL', upperArmR: 'shoulderR',
    forearmL: 'elbowL', forearmR: 'elbowR',
    handL: 'handL', handR: 'handR',
    thighL: 'hipL', thighR: 'hipR',
    shinL: 'kneeL', shinR: 'kneeR',
    footL: 'footL', footR: 'footR',
  };
  const JOINT_NAMES = new Set(Object.values(JOINT_FOR));
  const byName = {};
  root.traverse((o) => { if (JOINT_NAMES.has(o.name) && !byName[o.name]) byName[o.name] = o; });
  const named = {};
  for (const [bone, joint] of Object.entries(JOINT_FOR)) {
    const j = byName[joint];
    if (!j) continue;
    // A shim object that yields only this bone's own meshes: children of the joint
    // that are not themselves (or under) another joint.
    const own = [];
    j.traverseVisible((o) => {
      if (o === j) return;
      let p = o;
      while (p && p !== j) { if (JOINT_NAMES.has(p.name)) return; p = p.parent; }
      own.push(o);
    });
    named[bone] = { traverseVisible: (fn) => own.forEach(fn), __own: own.length };
  }

  // The body: everything under `torso` that is NOT an arm chain, plus the head mass.
  const torso = (() => { let t = null; root.traverse((o) => { if (o.name === 'torso') t = o; }); return t; })();
  const head = (() => { let t = null; root.traverse((o) => { if (o.name === 'head') t = o; }); return t; })();

  const bodyBox = (() => {
    if (!torso) return null;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity, n = 0;
    torso.traverseVisible((o) => {
      // skip anything inside a limb joint
      let p = o, limb = false;
      while (p && p !== torso) { if (/^(shoulder|elbow|hand|hip|knee|foot)[LR]$/.test(p.name)) limb = true; p = p.parent; }
      if (limb) return;
      const g = o.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      const pos = g.attributes.position;
      o.updateWorldMatrix(true, false);
      const m = o.matrixWorld.elements;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        if (wx < mnx) mnx = wx; if (wx > mxx) mxx = wx;
        if (wy < mny) mny = wy; if (wy > mxy) mxy = wy;
        if (wz < mnz) mnz = wz; if (wz > mxz) mxz = wz;
        n++;
      }
    });
    return n ? { min: [mnx, mny, mnz], max: [mxx, mxy, mxz], verts: n } : null;
  })();

  /**
   * The body's half-width at a given world height, by EDGE CROSSING rather than by
   * sampling vertices in a band.
   *
   * ⚠️ The band version of this returned `null` on four of six rows and the tool then
   * printed those rows as blanks — because the torso here is a LatheGeometry built from
   * six profile points, so its vertices exist at exactly six heights and a ±12 mm band
   * between two of them contains nothing at all. "No samples" is not "no body". Every
   * triangle edge that spans `y` is interpolated instead, which is exact for a mesh
   * and cannot miss a surface that is genuinely there.
   *
   * The scan excludes anything under `head` (burrito's spill drapes hang off the head
   * and reach 0.33 m out on ONE side — a mass that is not at the shoulder and is not
   * symmetric has no business setting a shoulder-height half-width) and anything under
   * a limb joint.
   */
  const halfWidthAt = (y) => {
    if (!torso) return null;
    let w = 0, n = 0;
    torso.traverseVisible((o) => {
      let p = o;
      while (p && p !== torso) {
        if (JOINT_NAMES.has(p.name) || p.name === 'head') return;
        p = p.parent;
      }
      const g = o.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      const pos = g.attributes.position;
      const idx = g.index;
      o.updateWorldMatrix(true, false);
      const m = o.matrixWorld.elements;
      const wx = (i) => m[0] * pos.getX(i) + m[4] * pos.getY(i) + m[8] * pos.getZ(i) + m[12];
      const wy = (i) => m[1] * pos.getX(i) + m[5] * pos.getY(i) + m[9] * pos.getZ(i) + m[13];
      const edge = (i, j) => {
        const y0 = wy(i), y1 = wy(j);
        if ((y0 - y) * (y1 - y) > 0) return;      // both on the same side
        if (y0 === y1) return;
        const t = (y - y0) / (y1 - y0);
        const x = wx(i) + (wx(j) - wx(i)) * t;
        if (Math.abs(x) > w) w = Math.abs(x);
        n++;
      };
      const count = idx ? idx.count : pos.count;
      const at = (k) => (idx ? idx.getX(k) : k);
      for (let k = 0; k + 2 < count; k += 3) {
        const a0 = at(k), b0 = at(k + 1), c0 = at(k + 2);
        edge(a0, b0); edge(b0, c0); edge(c0, a0);
      }
    });
    return n ? { half: w, samples: n } : null;
  };

  const res = { id: root.name || 'root', boxes: {}, body: bodyBox, bands: [] };
  for (const [k, o] of Object.entries(named)) res.boxes[k] = boxOf(o);

  // Report the gap at the height of each upper arm's own widest row.
  for (const side of ['L', 'R']) {
    const ua = named['upperArm' + side];
    if (!ua) continue;
    const b = boxOf(ua);
    if (!b) continue;
    for (const f of [0.10, 0.30, 0.50]) {
      const y = b.max[1] - (b.max[1] - b.min[1]) * f;
      const hw = halfWidthAt(y);
      const inner = side === 'L' ? -b.min[0] : b.max[0];   // distance of the OUTER wall
      // inner wall of the arm, as a distance from the axis:
      const innerWall = side === 'L' ? -b.max[0] : b.min[0];
      res.bands.push({
        side, f, y: +y.toFixed(4),
        bodyHalf: hw ? +hw.half.toFixed(4) : null,
        armInner: +innerWall.toFixed(4),
        armOuter: +inner.toFixed(4),
        overlap: hw ? +(hw.half - innerWall).toFixed(4) : null,
      });
    }
  }
  return res;
}, KNOWNBAD);

if (out.error) { console.error('!!', out.error); await browser.close(); process.exit(3); }

console.log(`\n${ID}${KNOWNBAD ? `  [KNOWN-BAD: ${KNOWNBAD}]` : ''}`);
const b = out.body;
if (b) console.log(`body(torso, limbs excluded)  x ${b.min[0].toFixed(3)}..${b.max[0].toFixed(3)}  y ${b.min[1].toFixed(3)}..${b.max[1].toFixed(3)}  (${b.verts} verts)`);
console.log('\npart          x min..max        y min..max        z min..max');
for (const [k, v] of Object.entries(out.boxes)) {
  if (!v) { console.log(`${k.padEnd(12)} (no geometry)`); continue; }
  console.log(`${k.padEnd(12)}  ${v.min[0].toFixed(3)}..${v.max[0].toFixed(3)}    ${v.min[1].toFixed(3)}..${v.max[1].toFixed(3)}    ${v.min[2].toFixed(3)}..${v.max[2].toFixed(3)}`);
}
console.log('\nARM ATTACHMENT — overlap > 0 means the arm wall is INSIDE the body wall');
console.log('side  depth  worldY   bodyHalf  armInner  armOuter  overlap');
let worst = Infinity;
for (const r of out.bands) {
  console.log(`  ${r.side}   ${(r.f * 100).toFixed(0).padStart(3)}%  ${String(r.y).padStart(7)}   ${String(r.bodyHalf).padStart(7)}   ${String(r.armInner).padStart(7)}   ${String(r.armOuter).padStart(7)}   ${String(r.overlap).padStart(7)}`);
  if (r.overlap !== null && r.overlap < worst) worst = r.overlap;
}
if (!out.bands.length || !Number.isFinite(worst)) {
  console.error('\n!! NO ARM BANDS MEASURED — the slot lookup found no geometry. This is a TOOL '
    + 'failure, not a PASS; an empty set has no minimum.');
  await browser.close();
  process.exit(3);
}
console.log(`\nworst overlap: ${worst.toFixed(4)} m  -> ${worst > 0 ? 'ATTACHED' : 'DETACHED'}`);
await browser.close();
process.exit(0);
