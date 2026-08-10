#!/usr/bin/env node
/**
 * WHAT DOES THE PUDDLE WRITE, AND IS THE CHARACTER'S CONTACT DECAL UNDER IT?
 *
 * `cs_charcontact.mjs --ours` measures the contact decal's DELIVERED darkening. It
 * reported the character decal landing 0.074-0.144 of the floor's own value on the
 * opposite flank at three open-floor stations — and `arena-scan`'s `grease_in` was the
 * ONLY one of 18 stations whose dL did not move at all when that decal landed
 * (-0.050 -> -0.050, rank 7 -> 7) while the other seventeen moved -0.024 +/- 0.003.
 *
 * That is a hypothesis about OCCLUSION, and `docs/LESSONS.md` §1 is explicit that the
 * way to settle one is an unmissable probe, not an argument about heights. So this
 * tool does three things and none of them is a judgement:
 *
 *  1. CENSUS. Walks the live scene and prints, for every ground-layer mesh near the
 *     player, its `position.y`, `renderOrder`, `material.transparent`,
 *     `material.depthWrite`, `material.depthTest` and blending. The trap named in
 *     §1's "also, adjacent" paragraph is a TRANSPARENT material with `depthWrite:
 *     true`, which still writes depth and silently occludes whatever sorts after it.
 *
 *  2. THE UNMISSABLE PROBE. The character contact decal's own texture is replaced
 *     with a saturated magenta MULTIPLY (a texel of (255,0,255) kills the floor's
 *     green channel outright) and its scale is left alone. If the frame does not
 *     MOVE inside the puddle, the decal is not reaching those pixels — which is the
 *     §1 test, "require the frame to move", rather than "look at it and decide".
 *
 *  3. THE COUNTERFACTUAL. `depthWrite` is turned off on the puddle body alone, live,
 *     nothing else touched, and the magenta probe is re-rendered. If the magenta
 *     appears, the puddle body's depth write is the occluder and the fix is on the
 *     hazard side.
 *
 * Every count below is a pixel count inside the puddle's own screen disc, so a change
 * outside it (a peer's edit, a VFX frame) cannot be read as this effect.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/hc_probe.mjs --url '{URL}'
 */
import { mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const STATION = arg('station', '560:900');
const OUT = arg('out', 'shots/hc/probe');
const W = 1600, H = 900;

const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const { chromium } = await import('playwright');
const sharp = (await import('sharp')).default;
await mkdir(OUT, { recursive: true });

const [sx, sy] = STATION.split(':').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await p.waitForTimeout(1800);

// ── 1. CENSUS ───────────────────────────────────────────────────────────────
const census = await p.evaluate(() => {
  const st = window.__stage, scene = st.scene, cam = st.rig.camera;
  scene.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const rows = [];
  const wp = new V();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.getWorldPosition(wp);
    if (wp.y > 0.9) return;                    // ground layer only
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    rows.push({
      name: o.name || '(unnamed)', mat: m?.name || m?.type || '?',
      y: +wp.y.toFixed(4), ro: o.renderOrder,
      transparent: !!m?.transparent, depthWrite: !!m?.depthWrite, depthTest: !!m?.depthTest,
      blending: m?.blending, opacity: m?.opacity,
      wx: +wp.x.toFixed(2), wz: +wp.z.toFixed(2),
    });
  });
  const chars = [];
  scene.traverse((o) => { if (o.name && o.name.indexOf('character:') === 0) { const q = new V(); o.getWorldPosition(q); chars.push({ name: o.name.slice(10), x: +q.x.toFixed(2), z: +q.z.toFixed(2) }); } });
  return { rows, chars };
});

// Only the ground-layer meshes within 8 m of the player, and only one row per
// (name, y, flags) family — the tile field is thousands of identical meshes.
const me = census.chars[0];
const near = census.rows.filter((r) => Math.hypot(r.wx - me.x, r.wz - me.z) < 9 && r.y < 0.35);
const seen = new Set();
console.log(`\nGROUND-LAYER CENSUS within 9 m of ${me.name} at (${me.x}, ${me.z})  — station ${STATION}`);
console.log('name                                 mat                  y      ro  transp depthW depthT blend  opac');
for (const r of near.sort((a, c) => a.y - c.y)) {
  const k = `${r.name}|${r.y}|${r.transparent}|${r.depthWrite}|${r.ro}`;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`${r.name.slice(0, 36).padEnd(36)} ${String(r.mat).slice(0, 20).padEnd(20)} ${r.y.toFixed(3).padStart(6)} ${String(r.ro).padStart(3)}  ${String(r.transparent).padStart(6)} ${String(r.depthWrite).padStart(6)} ${String(r.depthTest).padStart(6)} ${String(r.blending).padStart(5)} ${String(r.opacity).padStart(5)}`);
}

// ── the puddle's screen disc, so every count below is scoped to it ───────────
// ⚠️ There are TWO puddles and the first draft took the LAST one the traversal found
// — the north water disc, which at `grease_in` projects to (1242, -570), i.e. OFF THE
// TOP OF THE FRAME. Every count below it was then taken over an empty support and
// came back `n:0, tot:0`, which reads exactly like "the probe changed nothing". A zero
// out of zero is not a measurement; the `tot` column is printed for that reason.
const disc = await p.evaluate(`((me) => {
  const st = window.__stage, cam = st.rig.camera, scene = st.scene;
  const V = cam.position.constructor;
  let d = null, best = 1e9;
  scene.traverse((o) => {
    if (!(o.isMesh && o.name === 'puddle')) return;
    const q = new V(); o.getWorldPosition(q);
    const dist = Math.hypot(q.x - me.x, q.z - me.z);
    if (dist < best) { best = dist; d = { x: q.x, z: q.z, r: o.geometry.parameters.radius, dist }; }
  });
  if (!d) return null;
  const toS = (x, y, z) => { const v = new V(x, y, z); v.project(cam); return [(v.x*0.5+0.5)*${W}, (-v.y*0.5+0.5)*${H}]; };
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for (let i=0;i<64;i++){ const t=(i/64)*Math.PI*2; const s=toS(d.x+d.r*Math.cos(t),0.15,d.z+d.r*Math.sin(t)); if(s[0]<x0)x0=s[0]; if(s[0]>x1)x1=s[0]; if(s[1]<y0)y0=s[1]; if(s[1]>y1)y1=s[1]; }
  return { cx:(x0+x1)/2, cy:(y0+y1)/2, rx:(x1-x0)/2, ry:(y1-y0)/2, wr: d.r, dist: d.dist };
})(${JSON.stringify(me)})`);
console.log(`\nnearest puddle screen disc: ${disc ? `centre ${disc.cx.toFixed(0)},${disc.cy.toFixed(0)} radii ${disc.rx.toFixed(0)}x${disc.ry.toFixed(0)} px (world r ${disc.wr} m, ${disc.dist.toFixed(2)} m from the player)` : 'NO PUDDLE IN THE SCENE'}`);
if (!disc) throw new Error('no puddle mesh — every count below would be about nothing');

const canvas = p.locator('canvas');
const raw = async () => sharp(await canvas.screenshot()).removeAlpha().raw().toBuffer();
const shot = async (tag) => { await sharp(await canvas.screenshot()).toFile(`${OUT}/${sx}_${sy}__${tag}.png`); };

// Count pixels inside the puddle disc that differ from `ref` by more than 6/255 on
// any channel. 6 is above SwiftShader's own frame-to-frame jitter (measured 0-2).
const inDisc = (x, y) => disc && Math.hypot((x - disc.cx) / disc.rx, (y - disc.cy) / disc.ry) <= 1;
const diffCount = (a, r) => {
  let n = 0, tot = 0, sum = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inDisc(x, y)) continue;
    tot++;
    const i = (y * W + x) * 3;
    const d = Math.max(Math.abs(a[i] - r[i]), Math.abs(a[i + 1] - r[i + 1]), Math.abs(a[i + 2] - r[i + 2]));
    if (d > 6) { n++; sum += d; }
  }
  // `tot` is the support. If it is zero the comparison is vacuous and `n:0` means
  // "nowhere to look", not "nothing changed" — see the note on `disc` above.
  if (tot === 0) throw new Error('the puddle disc covers 0 px of frame — this comparison would be vacuous');
  return { n, tot, pct: +((100 * n) / tot).toFixed(2), meanD: n ? +(sum / n).toFixed(1) : 0 };
};

const shipped = await raw(); await shot('shipped');

// ── 2. THE UNMISSABLE PROBE ─────────────────────────────────────────────────
// A magenta MULTIPLY: dst*(255,0,255)/255 zeroes the green channel of every pixel it
// reaches. On this warm floor that is a change of >100/255 on green — unmissable, and
// impossible to confuse with a tuning difference.
const PROBE = `(on) => {
  const st = window.__stage;
  const g = st.scene.getObjectByName('contact:shadows');
  if (!g || !g.children.length) return 0;
  const m = g.children[0].material;
  if (on) {
    if (!m.__hcSaved) m.__hcSaved = m.map;
    const N = 64, data = new Uint8Array(N*N*4);
    for (let i = 0; i < N*N; i++) { data[i*4] = 255; data[i*4+1] = 0; data[i*4+2] = 255; data[i*4+3] = 255; }
    const THREE = st.scene.constructor.prototype.constructor;
    const tex = new (m.map.constructor)(data, N, N, m.map.format);
    tex.colorSpace = m.map.colorSpace; tex.minFilter = m.map.minFilter; tex.magFilter = m.map.magFilter;
    tex.wrapS = m.map.wrapS; tex.wrapT = m.map.wrapT; tex.generateMipmaps = false; tex.needsUpdate = true;
    m.map = tex;
  } else if (m.__hcSaved) { m.map = m.__hcSaved; }
  m.needsUpdate = true;
  return g.children.length;
}`;
const nDecals = await p.evaluate(`(${PROBE})(true)`);
await p.waitForTimeout(700);
const probeOn = await raw(); await shot('probe_magenta');
console.log(`\nUNMISSABLE PROBE — contact decal forced to a MAGENTA multiply (${nDecals} decals in the group)`);
console.log(`  pixels changed inside the puddle disc: ${JSON.stringify(diffCount(probeOn, shipped))}`);

// ── 3. THE COUNTERFACTUAL ───────────────────────────────────────────────────
const DW = `(on) => {
  const st = window.__stage; let n = 0;
  st.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name !== 'puddle' && o.name !== 'puddle_wet_rim') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.__hcDW === undefined) m.__hcDW = m.depthWrite;
    m.depthWrite = on ? m.__hcDW : false;
    m.needsUpdate = true; n++;
  });
  return n;
}`;
const nOff = await p.evaluate(`(${DW})(false)`);
await p.waitForTimeout(700);
const probeNoDW = await raw(); await shot('probe_magenta_nodepthwrite');
console.log(`\nCOUNTERFACTUAL — puddle body + wet rim depthWrite:false (${nOff} meshes), magenta probe still on`);
console.log(`  vs the magenta frame WITH the puddle writing depth: ${JSON.stringify(diffCount(probeNoDW, probeOn))}`);
console.log(`  vs shipped:                                         ${JSON.stringify(diffCount(probeNoDW, shipped))}`);

// and the same counterfactual with the REAL decal texture, which is the shipped fix
await p.evaluate(`(${PROBE})(false)`);
await p.waitForTimeout(700);
const realNoDW = await raw(); await shot('real_nodepthwrite');
console.log(`\nTHE REAL DECAL with the puddle not writing depth, against shipped:`);
console.log(`  ${JSON.stringify(diffCount(realNoDW, shipped))}`);

// ── 4. THE PUDDLE'S OWN APPEARANCE, WITH THE CHARACTER DECAL TAKEN OUT ──────
// The fix removes a depth write, and a depth write is not only hiding the character's
// decal — it is also hiding the PUDDLE'S OWN grounding AO halo, whose texture is dark
// in the middle. If the halo now leaks through the 0.85-opacity pool, the pool gets
// darker and a carefully-measured value (see `GREASE_BODY_L_DROP`) moves underneath
// this change. That is a different quantity from the contact shadow and it needs its
// own control, so: mean linear-free sRGB triple inside the disc with `contact:shadows`
// hidden entirely. Compare it across a HEAD run and an overlay run — nothing else in
// the frame differs, so any move is this change's doing.
await p.evaluate(`(() => {
  const g = window.__stage.scene.getObjectByName('contact:shadows');
  if (g) g.visible = false;
  return g ? g.children.length : 0;
})()`);
await p.evaluate(`(${DW})(true)`);   // depth writes back to as-authored
await p.waitForTimeout(800);
const noChar = await raw(); await shot('puddle_only');
{
  let r = 0, g2 = 0, bl = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inDisc(x, y)) continue;
    const i = (y * W + x) * 3;
    r += noChar[i]; g2 += noChar[i + 1]; bl += noChar[i + 2]; n++;
  }
  const L = (0.2126 * r + 0.7152 * g2 + 0.0722 * bl) / n / 255;
  console.log(`\nPUDDLE APPEARANCE CONTROL (contact:shadows hidden, ${n} px inside the disc)`);
  console.log(`  mean RGB ${(r / n).toFixed(2)} ${(g2 / n).toFixed(2)} ${(bl / n).toFixed(2)}   mean luma ${L.toFixed(5)}`);
}

// ── 5. ATTRIBUTION for whatever step 4 finds ────────────────────────────────
// Step 4 says IF the pool moved. It does not say WHAT moved it, and the candidate is
// specific: the pool's own AO halo, previously depth-rejected by the pool and now
// drawn underneath it at 15-18% see-through. Hiding the halo as well removes exactly
// that term; if the two builds then agree, the halo is the whole of the difference.
await p.evaluate(`(() => {
  let n = 0;
  window.__stage.scene.traverse((o) => { if (o.isMesh && o.name === 'contact_shadow__no_outline') { o.visible = false; n++; } });
  return n;
})()`);
await p.waitForTimeout(800);
const noHalo = await raw(); await shot('puddle_only_nohalo');
{
  let r = 0, g2 = 0, bl = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inDisc(x, y)) continue;
    const i = (y * W + x) * 3;
    r += noHalo[i]; g2 += noHalo[i + 1]; bl += noHalo[i + 2]; n++;
  }
  const L = (0.2126 * r + 0.7152 * g2 + 0.0722 * bl) / n / 255;
  console.log(`  ...and with the pool's OWN AO halo hidden too: mean luma ${L.toFixed(5)}`);
}

await writeFile(`${OUT}/census.json`, JSON.stringify({ station: STATION, disc, near, chars: census.chars }, null, 1));
console.log(`\nwrote ${OUT}/`);
await p.close();
await b.close();
