#!/usr/bin/env node
/**
 * GX_CHARS_DEMO — "probe before you loop" for two cast-wide levers, WITHOUT editing a source
 * file: the pose is changed page-side on a frozen preview frame, rendered, measured, restored.
 *
 *   LEVER 1  head-yaw bias toward the camera: at a profile/back facing, the `head` joint is
 *            turned up to 35 deg toward the camera (the rig has a yaw axis on `head`; nothing
 *            new is needed to test it).
 *   LEVER 2  donut ring tilt: the `head` joint (the ring) pitched back so its face plane looks
 *            up toward a 58 deg camera — does the HOLE appear?
 *
 * Measured with the same ID classes as `gx_chars_yaw.mjs` (face / head / body) and shot in
 * colour so the PNG can be LOOKED at. Known-bad: the bias=0 arm must reproduce the plain
 * frame's counts exactly (the page-side pose path changes nothing by itself).
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_chars_demo.mjs --url '{URL}'
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
const OUT = arg('out', 'shots/rv/audit/chars/cap/demo');
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

/** In-page: set camera yaw/pitch, apply a head pose delta, render colour + ID, restore. */
const ARM = (o) => {
  const s = window.__stage; const r = s.renderer; const scene = s.scene; const rig = s.rig; const cam = rig.camera;
  let root = null; scene.traverse((x) => { if (!root && /^character:/.test(x.name || '')) root = x; });
  let faceJ = null, headJ = null;
  root.traverse((x) => { if (x.name === 'face' && !faceJ) faceJ = x; if (x.name === 'head' && !headJ) headJ = x; });
  const saved = { rx: headJ.rotation.x, ry: headJ.rotation.y, rz: headJ.rotation.z };
  rig.pitchDeg = o.pitch; rig.yawDeg = o.yaw; rig.subjectFill = 0.6; rig.snapTo(0, 0);
  // camera direction in the character's local frame -> the yaw that would face it
  root.updateMatrixWorld(true);
  const cp = cam.position.clone(); root.worldToLocal(cp);
  const toCam = Math.atan2(cp.x, cp.z);
  const bias = Math.max(-o.maxBias, Math.min(o.maxBias, toCam));
  headJ.rotation.y = saved.ry + bias;
  headJ.rotation.x = saved.rx + (o.tiltX ?? 0);
  root.updateMatrixWorld(true);
  s.render(0); s.render(0);
  const gl = r.getContext(); const W = r.domElement.width, H = r.domElement.height;
  const colour = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, colour);
  // ID pass
  const inFace = new Set(), inHead = new Set();
  faceJ.traverse((x) => inFace.add(x)); headJ.traverse((x) => inHead.add(x));
  let SM = null; root.traverse((x) => { if (!SM && x.isMesh && x.material && x.material.uniforms && x.material.uniforms.outlineThickness) SM = x.material.constructor; });
  const mk = (c) => new SM({ uniforms: { c: { value: c } },
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c,1.0); }' });
  const mF = mk([1, 1, 1]), mH = mk([1, 0, 0]), mB = mk([0, 0, 1]);
  const sw = []; const hid = [];
  const under = new Set(); root.traverse((x) => under.add(x));
  scene.traverse((x) => { if (!under.has(x) && (x.isMesh || x.isPoints || x.isLine || x.isSprite) && x.visible) { hid.push(x); x.visible = false; } });
  root.traverse((x) => {
    if (!x.isMesh) return; sw.push([x, x.material, x.visible]);
    const hull = /__outline$/.test(x.name) || !!(x.material && x.material.uniforms && x.material.uniforms.outlineThickness);
    if (hull) { x.visible = false; return; }
    x.material = inFace.has(x) ? mF : inHead.has(x) ? mH : mB;
  });
  const bg = scene.background, fog = scene.fog, sh = r.shadowMap.enabled;
  let face = 0, head = 0, body = 0;
  try {
    scene.background = null; scene.fog = null; r.shadowMap.enabled = false;
    r.setRenderTarget(null); r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(scene, cam);
    const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
    for (let i = 0; i < b.length; i += 4) {
      const R = b[i], G = b[i + 1], B = b[i + 2];
      if (R > 200 && G > 200 && B > 200) face++; else if (R > 200 && G < 60 && B < 60) head++; else if (B > 200 && R < 60 && G < 60) body++;
    }
  } finally {
    for (const [x, m, v] of sw) { x.material = m; x.visible = v; }
    for (const x of hid) x.visible = true;
    scene.background = bg; scene.fog = fog; r.shadowMap.enabled = sh;
    headJ.rotation.set(saved.rx, saved.ry, saved.rz);
    root.updateMatrixWorld(true);
  }
  return { W, H, colour: Array.from(colour), face, head, body, toCamDeg: +(toCam * 180 / Math.PI).toFixed(1), biasDeg: +(bias * 180 / Math.PI).toFixed(1) };
};

async function main() {
  if (!BASE) { console.error('need --url'); process.exit(2); }
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const rows = [];
  const tag = arg('tag', 'demo');
  try {
    // --plan '<json>' overrides: [[id, [[yaw, maxBiasRad, tiltXRad, pitch?], ...]], ...]
    const plan = arg('plan', null) ? JSON.parse(arg('plan')) : [
      ['donut', [[90, 0, 0], [90, 0.61, 0], [0, 0, -0.75], [90, 0, -0.75], [180, 0, -0.75], [90, 0.61, -0.75]]],
      ['lollipop', [[90, 0, 0], [90, 0.61, 0], [0, 0, -0.6], [90, 0.61, -0.6]]],
      ['pizza', [[90, 0, 0], [90, 0.61, 0]]],
      ['sushi', [[90, 0, 0], [90, 0.61, 0]]],
    ];
    for (const [id, arms] of plan) {
      const page = await browser.newPage({ viewport: { width: 480, height: 600 }, deviceScaleFactor: 1 });
      await page.goto(`${BASE}/preview.html?piece=character&id=${id}&anim=idle&t=1.5&shot=1&pitch=58&fill=0.6`, { waitUntil: 'networkidle', timeout: 180_000 });
      await page.waitForFunction('window.__previewReady === true', null, { timeout: 180_000 });
      // known-bad / self-pair: the bias=0 arm twice must be identical
      const a0 = await page.evaluate(ARM, { pitch: 58, yaw: 90, maxBias: 0 });
      const a1 = await page.evaluate(ARM, { pitch: 58, yaw: 90, maxBias: 0 });
      const selfPair = a0.face === a1.face && a0.head === a1.head && a0.body === a1.body;
      const tiles = [];
      for (const [yaw, maxBias, tiltX, pitchArm] of arms) {
        const res = await page.evaluate(ARM, { pitch: pitchArm ?? 58, yaw, maxBias, tiltX });
        const png = await sharp(Buffer.from(res.colour), { raw: { width: res.W, height: res.H, channels: 4 } }).flip().png().toBuffer();
        tiles.push(png);
        const row = { id, pitch: pitchArm ?? 58, yaw, maxBiasDeg: +(maxBias * 180 / Math.PI).toFixed(0), tiltXDeg: +(tiltX * 180 / Math.PI).toFixed(0), face: res.face, head: res.head, body: res.body, biasDeg: res.biasDeg, selfPair };
        rows.push(row);
        console.log(JSON.stringify(row));
      }
      const W = 480, H = 600;
      await sharp({ create: { width: W * tiles.length, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
        .composite(tiles.map((t, i) => ({ input: t, left: i * W, top: 0 }))).png().toFile(join(OUT, `${id}_${tag}.png`));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(OUT, `${tag}.json`), JSON.stringify(rows, null, 2));
}

if (IS_MAIN) await main();
