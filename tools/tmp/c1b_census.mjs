#!/usr/bin/env node
/**
 * C1B_CENSUS — what a fighter's DRAWS are made of, per rig joint, and which of its meshes
 * actually MOVE relative to their joint. Graphics campaign C1b (`docs/REVAMP.md` §5 C1:
 * "per-joint batching, ≤25 draws per fighter"). Owner of the `c1b_` prefix.
 *
 * Per character (preview.html, the shipped build, no source edit):
 *   meshes      every visible non-hull mesh, attributed to its nearest rig joint
 *   mats        distinct material instances per joint  (= draws after a merge-by-material)
 *   classes     distinct material CLASSES per joint — a class is everything a draw holds
 *               EXCEPT the colour (= draws after a vertex-colour merge)
 *   casters     shadow-casting meshes (each is a second draw in the shadow pass)
 *   animated    meshes whose LOCAL state relative to their joint changes over time in any
 *               of idle/run/attack/hit/death: transform anywhere between it and its joint,
 *               visibility, material identity, or its material's colour/emissive/opacity.
 *               A merged mesh is frozen where it stood, so these may never be merged.
 *
 * Known-bad (CLAUDE.md rule 6): the MOVES arm translates one mesh of the first character
 * page-side between the two snapshots and REQUIRES it to come out animated; and the joint
 * list must be non-empty before any per-joint number is believed.
 *
 *   node tools/tmp/sx_snap.mjs --root <tree> -- node tools/tmp/c1b_census.mjs --url '{URL}' [--ids a,b] [--out f.json]
 */
import { chromium } from 'playwright';
import { writeFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const IDS_ALL = ['hamburger', 'donut', 'taco', 'burrito', 'egg', 'lollipop', 'pizza', 'sushi', 'soup', 'waterbottle', 'hotdog'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const CENSUS = (o) => {
  const JOINTS = ['rig_body', 'hips', 'torso', 'neck', 'head', 'face', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
    'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
  const P = window.__preview;
  const rootOf = () => { let r = null; window.__stage.scene.traverse((x) => { if (!r && /^character:/.test(x.name || '')) r = x; }); return r; };
  const isHull = (m) => /__outline$/.test(m.name) || !!(m.material && m.material.uniforms && m.material.uniforms.outlineThickness);
  const jointOf = (x) => { let p = x; while (p) { if (JOINTS.includes(p.name)) return p; p = p.parent; } return null; };
  const snap = (root) => {
    const out = [];
    root.traverse((x) => {
      if (JOINTS.includes(x.name)) { out.push(null); return; }
      const ms = x.material ? (Array.isArray(x.material) ? x.material : [x.material]) : [];
      out.push([x.matrix.elements.map((v) => Math.round(v * 1e5)).join(','), x.visible ? 1 : 0,
        ms.map((m) => `${m.uuid}:${m.color ? m.color.getHexString() : ''}:${m.emissive ? m.emissive.getHexString() : ''}:${m.opacity}`).join(';')].join('|'));
    });
    return out;
  };
  const changed = new Set();
  let n0 = -1;
  for (const anim of (o.anims ?? ['idle', 'run', 'attack', 'death'])) {
    P.frameAt(0, { anim, remount: true });
    if (anim === 'idle' || anim === 'run') { /* steady states */ } else P.setAnim(anim);
    const root = rootOf();
    root.updateMatrixWorld(true);
    const s0 = snap(root);
    if (n0 < 0) n0 = s0.length; else if (n0 !== s0.length) return { error: `graph size differs across remounts ${n0} vs ${s0.length}` };
    let moved = null;
    if (o.plant && anim === 'idle') {
      root.traverse((x) => { if (!moved && x.isMesh && !isHull(x) && !JOINTS.includes(x.name)) moved = x; });
    }
    for (const t of [0.06, 0.13, 0.21, 0.34, 0.55, 0.9, 1.4, 2.2, 3.1, 4.3, 5.2, 6.6, 8.1]) {
      P.frameAt(t, { anim });
      if (moved && t === 0.34) moved.position.x += 0.01;
      root.updateMatrixWorld(true);
      const s = snap(root);
      for (let i = 0; i < s.length; i++) if (s[i] !== null && s[i] !== s0[i]) changed.add(i);
    }
    if (moved) moved.position.x -= 0.01;
  }
  // final structural census on a fresh idle mount
  P.frameAt(0, { anim: 'idle', remount: true });
  const root = rootOf();
  const objs = [];
  root.traverse((x) => objs.push(x));
  const animatedObj = new Set([...changed].map((i) => objs[i]));
  const isAnimated = (x) => { const j = jointOf(x); let p = x; while (p && p !== j) { if (animatedObj.has(p)) return true; p = p.parent; } return false; };
  const per = {};
  let meshes = 0, casters = 0, animatedMeshes = 0;
  const allMats = new Set();
  const visibleChain = (x) => { let p = x; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
  for (const x of objs) {
    if (!x.isMesh || isHull(x) || !visibleChain(x)) continue;
    const j = jointOf(x);
    const jn = j ? j.name : '(none)';
    const e = per[jn] ?? (per[jn] = { meshes: 0, mats: new Set(), classes: new Set(), casters: 0, animated: 0, casterMats: new Set(), casterClasses: new Set(), names: [] });
    const ms = Array.isArray(x.material) ? x.material : [x.material];
    const anim = isAnimated(x);
    e.meshes++; meshes++;
    if (anim) { e.animated++; animatedMeshes++; e.names.push(x.name || '(unnamed)'); }
    for (const m of ms) {
      allMats.add(m.uuid);
      const cls = anim ? `ANIM:${x.uuid}` : [m.type, m.transparent ? 1 : 0, +(m.opacity ?? 1).toFixed(3), m.side, m.roughness, m.metalness,
        m.emissive ? m.emissive.getHexString() : '', m.map ? m.map.uuid : '', m.vertexColors ? 1 : 0, m.flatShading ? 1 : 0,
        JSON.stringify(m.userData && m.userData.rim || null), m.depthWrite ? 1 : 0, m.alphaTest, m.blending].join('|');
      e.mats.add(anim ? `ANIM:${x.uuid}` : m.uuid); e.classes.add(cls);
      if (x.castShadow) { e.casterMats.add(anim ? `ANIM:${x.uuid}` : m.uuid); e.casterClasses.add(cls); }
    }
    if (x.castShadow) { e.casters++; casters++; }
  }
  const joints = Object.fromEntries(Object.entries(per).map(([k, e]) => [k, { meshes: e.meshes, mats: e.mats.size, classes: e.classes.size, casters: e.casters,
    casterMats: e.casterMats.size, casterClasses: e.casterClasses.size, animated: e.animated, animatedNames: e.names.slice(0, 12) }]));
  const sum = (f) => Object.values(joints).reduce((a, e) => a + f(e), 0);
  return { meshes, casters, materials: allMats.size, animatedMeshes, joints,
    drawsNow: meshes + casters,
    drawsMergeByMat: sum((e) => e.mats) + sum((e) => e.casterMats),
    drawsMergeByClass: sum((e) => e.classes) + sum((e) => e.casterClasses),
    plantCaught: o.plant ? changed.size > 0 : null };
};

async function main() {
  const BASE = String(arg('--url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
  if (!BASE || BASE.includes(':5173')) { console.error('c1b_census: need --url of a FROZEN snapshot'); process.exit(2); }
  const ids = arg('--ids') ? String(arg('--ids')).split(',') : IDS_ALL;
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const res = {};
  let bad = [];
  try {
    for (const [i, id] of ids.entries()) {
      const page = await browser.newPage({ viewport: { width: 320, height: 400 } });
      await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=0.5&shot=1`, { waitUntil: 'networkidle', timeout: 180_000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 180_000 });
      if (i === 0) {
        // known-bad: a planted page-side translation must be caught as "animated"
        const k = await page.evaluate(CENSUS, { plant: true });
        if (k.error) throw new Error(k.error);
        const clean = await page.evaluate(CENSUS, { plant: false });
        if (!(k.animatedMeshes > clean.animatedMeshes)) bad.push(`MOVES: planted move not caught (${k.animatedMeshes} vs ${clean.animatedMeshes})`);
        res[id] = clean;
      } else {
        const r = await page.evaluate(CENSUS, { plant: false });
        if (r.error) throw new Error(`${id}: ${r.error}`);
        res[id] = r;
      }
      const r = res[id];
      if (!Object.keys(r.joints).length) bad.push(`NONEMPTY ${id}`);
      console.log(`${id.padEnd(12)} meshes ${String(r.meshes).padStart(3)} casters ${String(r.casters).padStart(3)} mats ${String(r.materials).padStart(3)} animated ${String(r.animatedMeshes).padStart(3)} | draws now ${String(r.drawsNow).padStart(3)} · merge-by-mat ${String(r.drawsMergeByMat).padStart(3)} · merge-by-class ${String(r.drawsMergeByClass).padStart(3)}`);
      if (argv.includes('--verbose')) for (const [j, e] of Object.entries(r.joints)) console.log(`   ${j.padEnd(10)} m${e.meshes} mats${e.mats} cls${e.classes} cast${e.casters}/${e.casterMats}/${e.casterClasses} anim${e.animated} ${e.animatedNames.join(',')}`);
      await page.close();
    }
  } finally { await browser.close(); }
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(res, null, 1));
  console.log(bad.length ? `CONTROLS FAILED: ${bad.join('; ')}` : 'controls OK (MOVES planted-and-caught, NONEMPTY)');
  process.exit(bad.length ? 1 : 0);
}

if (IS_MAIN) await main();
