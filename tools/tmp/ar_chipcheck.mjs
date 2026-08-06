#!/usr/bin/env node
/**
 * AR_CHIPCHECK — does the ground-debris layer actually reach the SCREEN?
 *
 * ── Why this exists ─────────────────────────────────────────────────────────────
 * `src/arena/floor.ts`'s chip layer was authored across four rounds with a broken
 * fragment shader and NOBODY NOTICED, because the failure mode was a perfect impostor:
 *
 *   `toonMat({ flatShading: true })` -> `applyRimLight` injects a Fresnel term that
 *   reads `vNormal` -> under `FLAT_SHADED` three.js does not declare that varying ->
 *   `THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false ... 'vNormal':
 *   undeclared identifier` -> the program never links -> **every chip draws nothing.**
 *
 * The SHADOW-depth program carries no rim patch, links fine, and kept drawing each
 * chip's little contact shadow. So the floor rendered a field of small dark specks that
 * looked exactly like low-contrast litter. Three palettes were tuned against it. This is
 * `docs/LESSONS.md` §1's "rendering PLAUSIBLY and wrongly" with an object's own shadow
 * standing in for the object, and §4's rule that a console error nobody reads is not a
 * guard.
 *
 * What finally caught it was a KNOWN-BAD INPUT: every chip colour forced to #FF00FF, and
 * the resulting PNG was **byte-identical**. That probe is the third check below, run on
 * every invocation rather than only when something looks wrong.
 *
 * ── The four checks ─────────────────────────────────────────────────────────────
 *   LINK      no material in the scene fails to link. Reported by name, because
 *             `pageerror`/`console` output is discarded by every capture tool here.
 *   PRESENT   both `ground_chip_*` InstancedMeshes exist, are visible, carry a non-null
 *             `instanceColor`, and hold > 0 instances.
 *   PIXELS    force every instance colour to #FF00FF, re-render, and require the frame
 *             to CHANGE. This is the check that would have failed for four rounds.
 *   KNOWN-BAD set `flatShading = true` on the chip material and re-render: the LINK
 *             check must FIRE. A guard that has not been shown to fail on the bug it
 *             guards against is not a guard.
 *
 * Usage:
 *   node tools/tmp/ar_chipcheck.mjs --url http://localhost:PORT
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/ar_chipcheck.mjs --url {URL}
 *
 * Exits non-zero on any failure.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

const LAUNCH_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox',
];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const URL_BASE = String(arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5190')).replace(/\/$/, '');

let pass = 0, fail = 0;
const ck = (n, ok, note) => { if (ok) { pass++; console.log(`  PASS  ${n}  ${note}`); } else { fail++; console.log(`  FAIL  ${n}  ${note}`); } };

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 1 });
const shaderErrors = [];
page.on('console', (m) => {
  const t = m.text();
  if (/VALIDATE_STATUS false|Shader Error|not compiled|undeclared identifier/i.test(t)) shaderErrors.push(t.replace(/\s+/g, ' ').slice(0, 220));
});
page.on('pageerror', (e) => shaderErrors.push('PAGEERROR ' + String(e).slice(0, 200)));
await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));

// A station with open floor in frame; `piece=floor` draws this module and nothing else,
// so anything found here is unambiguously the chip layer's.
await page.goto(`${URL_BASE}/preview.html?piece=floor&tx=400&ty=500&t=0&shot=1`, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForFunction('window.__previewReady === true', null, { timeout: 90_000 });

const md5 = (b) => createHash('md5').update(b).digest('hex');
const shot = async () => md5(await page.screenshot());

// ── LINK ────────────────────────────────────────────────────────────────────────
ck('LINK   no shader failed to link', shaderErrors.length === 0, shaderErrors[0] ?? 'clean');

// ── PRESENT ─────────────────────────────────────────────────────────────────────
const found = await page.evaluate(() => {
  const scene = window.__stage?.scene ?? null;
  if (!scene) return null;
  const out = [];
  scene.traverse((o) => {
    if (o.name?.startsWith('ground_chip')) {
      out.push({ name: o.name, count: o.count, visible: o.visible && (o.parent?.visible !== false), hasColor: !!o.instanceColor });
    }
  });
  return out;
});
ck('PRESENT scene handle reachable', found !== null, found === null ? 'no window.__stage' : 'ok');
ck('PRESENT two ground_chip meshes', (found?.length ?? 0) === 2, JSON.stringify(found));
ck('PRESENT every mesh visible, coloured, non-empty',
  !!found?.length && found.every((f) => f.visible && f.hasColor && f.count > 0),
  found ? found.map((f) => `${f.name}:${f.count}`).join(' ') : '-');

// ── PIXELS — the known-bad input that caught the original bug ───────────────────
const before = await shot();
await page.evaluate(() => {
  window.__stage.scene.traverse((o) => {
    if (!o.name?.startsWith('ground_chip') || !o.instanceColor) return;
    const a = o.instanceColor.array;
    for (let i = 0; i < a.length; i += 3) { a[i] = 1; a[i + 1] = 0; a[i + 2] = 1; }
    o.instanceColor.needsUpdate = true;
  });
  // `frameAt` is the only re-render entry point `preview.ts` exposes, and it renders
  // TWICE because the post chain (SMAA/bloom) needs a settled frame — the same reason
  // `settle.mjs` exists. A single `stage.render(0)` here returns a half-resolved frame
  // and would make this check flaky in the direction that hides a bug.
  window.__preview.frameAt(0);
});
await page.waitForTimeout(400);
const magenta = await shot();
ck('PIXELS magenta instanceColor CHANGES the frame', before !== magenta, `${before.slice(0, 8)} -> ${magenta.slice(0, 8)}`);

// ── KNOWN-BAD: the exact defect this file exists for must be DETECTED ───────────
shaderErrors.length = 0;
await page.evaluate(() => {
  window.__stage.scene.traverse((o) => {
    if (!o.name?.startsWith('ground_chip')) return;
    o.material.flatShading = true;
    o.material.needsUpdate = true;
  });
  window.__preview.frameAt(0);
});
await page.waitForTimeout(600);
ck('KNOWN-BAD flatShading + rim FAILS to link, and LINK sees it',
  shaderErrors.length > 0, shaderErrors[0] ?? 'nothing reported — the LINK check is BLIND');

await browser.close();
console.log(`\n  ar_chipcheck: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
