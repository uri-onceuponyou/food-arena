#!/usr/bin/env node
/**
 * GX_CHARS_YAW — how much FACE, HEAD and BODY each character shows to each shipped camera,
 * as a function of FACING.
 *
 * Why: at the match camera a fighter faces wherever it is aiming, so most of the time the
 * camera sees a profile or a back, not the front the character was authored at. A flat
 * "card" head (a ring, a disc, a slice) can collapse to a sliver edge-on. This measures it
 * instead of arguing it.
 *
 * Method — an ID render, not a hide-and-diff: every mesh under `character:<id>` gets a flat
 * unlit class colour (face subtree / head subtree minus face / everything else), outline
 * hulls are hidden, the ground and backdrop are hidden, and ONE direct render (post chain
 * bypassed) is read back. Depth decides who is frontmost, so occlusion is exact.
 * Framing is the preview's `subject` mode with a FIXED subject height, so areas compare
 * across yaw and across characters.
 *
 * Known-bad controls (rule 6), run on every page:
 *   EMPTY     with every class hidden the count must be 0 for all classes (the counter
 *             cannot invent pixels);
 *   MOVES     the face count must CHANGE between yaw 0 and yaw 180 for at least one
 *             character (otherwise the yaw is not reaching the model) — asserted in the
 *             summary;
 *   NONEMPTY  the face subtree must contain >= 1 mesh before any face number is believed.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_chars_yaw.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const OUT = arg('out', 'shots/rv/audit/chars/cap/yaw');
const IDS = String(arg('ids', 'hamburger,donut,taco,burrito,egg,lollipop,pizza,sushi,soup,waterbottle,hotdog')).split(',');
const YAWS = [0, 45, 90, 135, 180, 225, 270, 315];
const PITCHES = [58, 20];
const W = 480, H = 600;

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** In-page. Returns per (pitch,yaw) class counts and an RGB buffer of the ID render. */
const ID_RENDER = (o) => {
  const s = window.__stage;
  if (!s) return { error: 'no __stage' };
  const r = s.renderer, scene = s.scene, rig = s.rig, cam = rig.camera;
  let root = null;
  scene.traverse((x) => { if (!root && /^character:/.test(x.name || '')) root = x; });
  if (!root) return { error: 'no character root' };
  let faceJ = null, headJ = null;
  root.traverse((x) => { if (x.name === 'face' && !faceJ) faceJ = x; if (x.name === 'head' && !headJ) headJ = x; });
  if (!faceJ || !headJ) return { error: `missing joint face=${!!faceJ} head=${!!headJ}` };
  const inFace = new Set(), inHead = new Set();
  faceJ.traverse((x) => inFace.add(x));
  headJ.traverse((x) => inHead.add(x));
  // ShaderMaterial constructor borrowed off an outline hull (the character ink is one).
  let SM = null;
  root.traverse((x) => { if (!SM && x.isMesh && x.material && x.material.uniforms && x.material.uniforms.outlineThickness) SM = x.material.constructor; });
  if (!SM) return { error: 'no ShaderMaterial to borrow' };
  const mk = (c) => new SM({
    uniforms: { c: { value: c } },
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c,1.0); }',
  });
  const mFace = mk([1, 1, 1]), mHead = mk([1, 0, 0]), mBody = mk([0, 0, 1]);
  // ── census (before any material swap): what a fighter costs the renderer ──
  const census = { meshes: 0, hulls: 0, visibleMeshes: 0, shadowCasters: 0, tris: 0, materials: new Set(), types: {} };
  root.traverse((x) => {
    if (!x.isMesh) return;
    census.meshes++;
    const hull = /__outline$/.test(x.name) || !!(x.material && x.material.uniforms && x.material.uniforms.outlineThickness);
    if (hull) census.hulls++;
    let vis = true; let p = x; while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
    if (vis) census.visibleMeshes++;
    if (x.castShadow && vis) census.shadowCasters++;
    const g = x.geometry;
    if (g) census.tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
    const ms = Array.isArray(x.material) ? x.material : [x.material];
    for (const m of ms) { if (!m) continue; census.materials.add(m.uuid); census.types[m.type] = (census.types[m.type] ?? 0) + 1; }
  });
  census.materials = census.materials.size; census.tris = Math.round(census.tris);
  // ── COLOUR census on the character's OWN lit pixels (direct render, post bypassed),
  // exact two-clear-colour matte; done BEFORE any material swap. Hue histogram in 10 deg
  // bins over chromatic px (HSL s >= 0.15, `arena-scan`'s GREY_GATE).
  const colour = {};
  {
    const hiddenC = [];
    const underRoot = new Set(); root.traverse((x) => underRoot.add(x));
    scene.traverse((x) => {
      if (underRoot.has(x)) {
        // the ink hull is not the character's colour; hide it for the census
        const hull = x.isMesh && (/__outline$/.test(x.name) || !!(x.material && x.material.uniforms && x.material.uniforms.outlineThickness));
        if (hull && x.visible) { hiddenC.push(x); x.visible = false; }
        return;
      }
      if ((x.isMesh || x.isPoints || x.isLine || x.isSprite) && x.visible) { hiddenC.push(x); x.visible = false; }
    });
    const bg0 = scene.background, fog0 = scene.fog, sh0 = r.shadowMap.enabled;
    const gl0 = r.getContext();
    const Wc = r.domElement.width, Hc = r.domElement.height;
    const rd = () => { const b = new Uint8Array(Wc * Hc * 4); gl0.readPixels(0, 0, Wc, Hc, gl0.RGBA, gl0.UNSIGNED_BYTE, b); return b; };
    try {
      scene.background = null; scene.fog = null; r.shadowMap.enabled = false; r.setRenderTarget(null);
      for (const p of o.pitches) {
        rig.pitchDeg = p; rig.yawDeg = 0; rig.subjectFill = o.fill; rig.snapTo(0, 0);
        r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam); const A = rd();
        r.setClearColor(0xffffff, 1); r.clear(true, true, true); r.render(scene, cam); const B = rd();
        const hist = new Array(36).fill(0); let n = 0, chrom = 0, Ls = 0, Ss = 0;
        for (let i = 0; i < A.length; i += 4) {
          if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) >= 32) continue;
          const R1 = A[i] / 255, G1 = A[i + 1] / 255, B1 = A[i + 2] / 255;
          const mx = Math.max(R1, G1, B1), mn = Math.min(R1, G1, B1), l = (mx + mn) / 2;
          n++; Ls += 0.2126 * R1 + 0.7152 * G1 + 0.0722 * B1;
          if (mx === mn) continue;
          const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
          Ss += s;
          if (s < 0.15) continue;
          let h; if (mx === R1) h = ((G1 - B1) / d) % 6; else if (mx === G1) h = (B1 - R1) / d + 2; else h = (R1 - G1) / d + 4;
          h *= 60; if (h < 0) h += 360;
          hist[Math.min(35, Math.floor(h / 10))]++; chrom++;
        }
        colour[p] = { px: n, chromShare: chrom / Math.max(1, n), meanL: Ls / Math.max(1, n), meanS: Ss / Math.max(1, n), hist };
      }
    } finally {
      for (const k of hiddenC) k.visible = true;
      scene.background = bg0; scene.fog = fog0; r.shadowMap.enabled = sh0;
    }
  }
  const saved = [];
  let faceMeshes = 0;
  const sceneHidden = [];
  for (const k of scene.children) {
    if (k === root) continue;
    let contains = false; k.traverse((x) => { if (x === root) contains = true; });
    if (contains) continue;
    if (k.visible) { sceneHidden.push(k); k.visible = false; }
  }
  root.traverse((x) => {
    if (!x.isMesh) return;
    saved.push([x, x.material, x.visible]);
    const isHull = /__outline$/.test(x.name) || !!(x.material && x.material.uniforms && x.material.uniforms.outlineThickness);
    if (isHull) { x.visible = false; return; }
    if (inFace.has(x)) { x.material = mFace; faceMeshes++; }
    else if (inHead.has(x)) x.material = mHead;
    else x.material = mBody;
  });
  const bg = scene.background, fog = scene.fog, sh = r.shadowMap.enabled, ac = r.autoClear;
  const out = { faceMeshes, census, colour, cells: [] };
  const gl = r.getContext();
  const Wp = r.domElement.width, Hp = r.domElement.height;
  const read = () => {
    const b = new Uint8Array(Wp * Hp * 4);
    gl.readPixels(0, 0, Wp, Hp, gl.RGBA, gl.UNSIGNED_BYTE, b);
    return b;
  };
  const count = (b) => {
    let face = 0, head = 0, body = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let i = 0, j = 0; i < b.length; i += 4, j++) {
      const R = b[i], G = b[i + 1], B = b[i + 2];
      let cls = 0;
      if (R > 200 && G > 200 && B > 200) { face++; cls = 1; }
      else if (R > 200 && G < 60 && B < 60) { head++; cls = 1; }
      else if (B > 200 && R < 60 && G < 60) { body++; cls = 1; }
      if (cls) { const x = j % Wp, y = (j / Wp) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { face, head, body, bboxH: y1 >= 0 ? y1 - y0 + 1 : 0, bboxW: x1 >= 0 ? x1 - x0 + 1 : 0 };
  };
  try {
    scene.background = null; scene.fog = null; r.shadowMap.enabled = false; r.autoClear = true;
    r.setRenderTarget(null); r.setClearColor(0x000000, 1);
    // EMPTY control: hide the root, the counter must read zero.
    root.visible = false; r.clear(true, true, true); r.render(scene, cam);
    out.empty = count(read());
    root.visible = true;
    const imgs = {};
    for (const p of o.pitches) {
      for (const y of o.yaws) {
        rig.pitchDeg = p; rig.yawDeg = y; rig.subjectFill = o.fill; rig.snapTo(0, 0);
        try { rig.shakeAmount = 0; rig.shakeOffset?.set?.(0, 0, 0); } catch { /* */ }
        r.clear(true, true, true); r.render(scene, cam);
        const b = read();
        out.cells.push({ pitch: p, yaw: y, ...count(b) });
        if (o.keep.includes(`${p}:${y}`)) imgs[`${p}:${y}`] = Array.from(b);
      }
    }
    out.imgs = imgs; out.Wp = Wp; out.Hp = Hp;
  } finally {
    for (const [x, m, v] of saved) { x.material = m; x.visible = v; }
    for (const k of sceneHidden) k.visible = true;
    scene.background = bg; scene.fog = fog; r.shadowMap.enabled = sh; r.autoClear = ac;
  }
  return out;
};

async function main() {
  if (!BASE) { console.error('need --url or PREVIEW_BASE'); process.exit(2); }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const all = {};
  try {
    const warm = await browser.newPage();
    await warm.goto(`${BASE}/preview.html?piece=character&id=egg&t=0.5&shot=1`, { waitUntil: 'networkidle', timeout: 180_000 }).catch(() => {});
    await warm.waitForTimeout(2000); await warm.close();
    for (const id of IDS) {
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=58&fill=0.6`, { waitUntil: 'networkidle', timeout: 120_000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 120_000 });
      const keep = YAWS.map((y) => `58:${y}`);
      const res = await page.evaluate(ID_RENDER, { pitches: PITCHES, yaws: YAWS, fill: 0.6, keep });
      if (res.error) { console.log(id, 'ERROR', res.error); await page.close(); continue; }
      // contact strip of the 58-degree ID renders, for LOOKING at
      const tiles = [];
      for (const k of keep) {
        const raw = Buffer.from(res.imgs[k]);
        // readPixels is bottom-up; flip
        const flipped = await sharp(raw, { raw: { width: res.Wp, height: res.Hp, channels: 4 } }).flip().png().toBuffer();
        tiles.push(flipped);
      }
      const strip = sharp({ create: { width: res.Wp * tiles.length, height: res.Hp, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
        .composite(tiles.map((t, i) => ({ input: t, left: i * res.Wp, top: 0 })));
      await strip.png().toFile(join(OUT, `${id}_id58.png`));
      delete res.imgs;
      all[id] = res;
      const c0 = res.cells.find((c) => c.pitch === 58 && c.yaw === 0);
      const c90 = res.cells.find((c) => c.pitch === 58 && c.yaw === 90);
      const c180 = res.cells.find((c) => c.pitch === 58 && c.yaw === 180);
      console.log(id, `faceMeshes=${res.faceMeshes} empty=${JSON.stringify(res.empty)}`,
        `58/0 f${c0.face} h${c0.head} b${c0.body}`, `58/90 f${c90.face} h${c90.head} b${c90.body}`, `58/180 f${c180.face} h${c180.head} b${c180.body}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  // controls
  const ids = Object.keys(all);
  const nonEmpty = ids.length > 0;
  const emptyOk = ids.every((id) => all[id].empty.face + all[id].empty.head + all[id].empty.body === 0);
  const facesOk = ids.every((id) => all[id].faceMeshes > 0);
  const moves = ids.some((id) => {
    const a = all[id].cells.find((c) => c.pitch === 58 && c.yaw === 0).face;
    const b = all[id].cells.find((c) => c.pitch === 58 && c.yaw === 180).face;
    return a !== b;
  });
  const controls = { nonEmpty, emptyOk, facesOk, moves };
  console.log('controls', JSON.stringify(controls));
  await writeFile(join(OUT, 'yaw.json'), JSON.stringify({ W, H, YAWS, PITCHES, controls, all }, null, 2));
}

if (IS_MAIN) await main();
