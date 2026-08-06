#!/usr/bin/env node
/**
 * WHAT IS THE CONTACT DECAL ACTUALLY DOING? — the unmissable-probe technique.
 *
 * The first implementation used `THREE.MultiplyBlending` and drew an OPAQUE WHITE
 * QUAD on the floor. Two mutually exclusive causes produce that (the blend mode being
 * ignored, or the texture never uploading), and reasoning cannot separate them —
 * `docs/LESSONS.md` §1's probe technique can: replace the texture with a garish
 * checker and look. A checker means the texture uploads and the blend is being
 * ignored; a flat colour means the texture is not there.
 *
 *   node tools/tmp/cs_decalprobe.mjs --url $URL
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=340&py=500&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await p.waitForTimeout(1500);
const state = await p.evaluate(`(() => {
  const st = window.__stage;
  const g = st.scene.getObjectByName('contact:shadows');
  if (!g) return { found: false };
  const m = g.children[0];
  const mat = m.material, tex = mat.map;
  const px = tex && tex.image && tex.image.data ? Array.from(tex.image.data.slice(0, 4)).concat(Array.from(tex.image.data.slice(((32 * 64 + 32) * 4), ((32 * 64 + 32) * 4) + 4))) : null;
  return { found: true, n: g.children.length, blending: mat.blending, transparent: mat.transparent,
    depthWrite: mat.depthWrite, opacity: mat.opacity, colorHex: mat.color.getHexString(),
    hasMap: !!tex, texSize: tex ? [tex.image.width, tex.image.height] : null,
    texCorner: px && px.slice(0, 4), texCentre: px && px.slice(4),
    renderOrder: m.renderOrder, visible: m.visible, pos: m.position.toArray().map((v) => +v.toFixed(3)),
    scale: m.scale.toArray().map((v) => +v.toFixed(3)),
    version: (window.THREE && window.THREE.REVISION) || 'n/a' };
})()`);
console.log(JSON.stringify(state, null, 1));
// And LOOK at it — a state dump is not a rendered pixel (non-negotiable #3).
const { mkdir } = await import('node:fs/promises');
await mkdir('shots/contact/probe', { recursive: true });
await p.locator('canvas').screenshot({ path: 'shots/contact/probe/decal.png' });
const sharp = (await import('sharp')).default;
const { data, info } = await sharp('shots/contact/probe/decal.png').removeAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * info.width + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
console.log('delivered px  square-corner', px(660, 430), ' square-mid', px(700, 560), ' open floor', px(400, 600), '/', px(1200, 600));
await b.close();
