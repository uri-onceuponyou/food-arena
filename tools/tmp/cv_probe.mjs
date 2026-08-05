#!/usr/bin/env node
/**
 * CV PROBE — the four facts the concealment sheet cannot be built without.
 *
 * Before anything is drawn, this answers, on a frozen snapshot, at SHIPPED match framing:
 *
 *   1. Can page-side code get a THREE constructor set at all? (decides whether the
 *      candidate patches can be REAL geometry in the real scene, or must be a composite)
 *   2. What are the shipped camera's matrices, so world units can be projected to pixels
 *      by the same transform the renderer used — not by trigonometry, which
 *      `docs/LESSONS.md` §6 records being wrong twice on this exact question.
 *   3. How wide is the visible ground window in world units? "168 wu" is meaningless
 *      until it is a fraction of the frame.
 *   4. How tall is the character in pixels, measured by a hide/show diff (the
 *      `framing.mjs` method) — the control that says this really is shipped framing and
 *      not an isolation view at 3.5x zoom.
 *
 *   node tools/tmp/with_snapshot.mjs -- node tools/tmp/cv_probe.mjs --url {URL}
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const LAUNCH = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const n = process.argv[i + 1];
  if (n === undefined || n.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = n; i++; }
}
const BASE = String(args.url ?? process.env.PREVIEW_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('cv_probe: --url or PREVIEW_BASE required'); process.exit(2); }
const W = Number(args.w ?? 1600);
const H = Number(args.h ?? 900);
const PX = Number(args.px ?? 620);
const PY = Number(args.py ?? 350);
const OUT = String(args.out ?? 'shots/conceal');

const browser = await chromium.launch({ args: LAUNCH });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));

const url = `${BASE}/?screen=match&player=hamburger&enemy=taco&pointerLock=0&simSpeed=0.02&px=${PX}&py=${PY}`;
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction('window.__gameReady === true', null, { timeout: 180000 });
await page.waitForTimeout(2500);
await mkdir(OUT, { recursive: true });

// ── 1. Is THREE reachable from page scope? ────────────────────────────────────
const three = await page.evaluate(async () => {
  const tries = [
    '/node_modules/three/build/three.module.js',
    '/node_modules/.vite/deps/three.js',
  ];
  const out = [];
  for (const p of tries) {
    try {
      const m = await import(/* @vite-ignore */ p);
      out.push({ path: p, ok: true, hasMesh: typeof m.Mesh === 'function', hasCyl: typeof m.CylinderGeometry === 'function', rev: m.REVISION ?? null });
    } catch (e) { out.push({ path: p, ok: false, err: String(e).slice(0, 120) }); }
  }
  return out;
});
console.log('\n══ THREE reachability from page scope ══');
for (const t of three) console.log('  ', JSON.stringify(t));

// ── 2 + 3. Camera + ground window ─────────────────────────────────────────────
const cam = await page.evaluate(() => {
  const st = window.__stage;
  if (!st) return { err: 'no __stage' };
  const c = st.rig.camera;
  c.updateMatrixWorld(true);
  const dpr = st.renderer.getPixelRatio();
  const size = st.renderer.getSize(new c.position.constructor());
  return {
    proj: Array.from(c.projectionMatrix.elements),
    viewInv: Array.from(c.matrixWorldInverse.elements),
    world: Array.from(c.matrixWorld.elements),
    pos: [c.position.x, c.position.y, c.position.z],
    fov: c.fov, aspect: c.aspect, near: c.near, far: c.far,
    pitchDeg: st.rig.pitchDeg, viewWidthUnits: st.rig.viewWidthUnits,
    frameMode: st.rig.frameMode, fairRadiusUnits: st.rig.fairRadiusUnits,
    dpr, rw: size.x, rh: size.y,
    fair: window.__fairView ? window.__fairView() : null,
    canvasRect: (() => { const r = st.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
  };
});
console.log('\n══ shipped camera ══');
console.log(JSON.stringify({ ...cam, proj: undefined, viewInv: undefined, world: undefined }, null, 2));

// ── 4. Character height, hide/show diff (framing.mjs method) ──────────────────
// Shadows off on BOTH renders so the contact shadow does not land in the diff.
const shot = async (name) => {
  const buf = await page.screenshot({ timeout: 120000 });
  await writeFile(`${OUT}/${name}.png`, buf);
  return buf;
};
await page.evaluate(() => {
  const st = window.__stage;
  st.renderer.shadowMap.enabled = false;
  st.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
});
await page.waitForTimeout(600);
const withChar = await shot('_probe_with');
const hidden = await page.evaluate(() => {
  // The player model root: match.ts parents each CharacterModel group under the scene.
  const st = window.__stage;
  const names = [];
  const hit = [];
  st.scene.traverse((o) => { if (o.name) names.push(o.name); });
  return { names: Array.from(new Set(names)).slice(0, 200), hit };
});
console.log('\n══ scene object names (unique, first 200) ══');
console.log(hidden.names.join(', '));

await browser.close();
console.log(`\nwrote ${OUT}/_probe_with.png`);
await writeFile(`${OUT}/_probe_cam.json`, JSON.stringify({ cam, three, PX, PY, W, H }, null, 2));
console.log(`wrote ${OUT}/_probe_cam.json`);
