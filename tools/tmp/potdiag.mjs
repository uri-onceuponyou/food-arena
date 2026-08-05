#!/usr/bin/env node
/**
 * Pot-occlusion diagnostic — step 0: what is actually in the scene, where is the
 * camera, and which Object3D is the player's model?
 *
 * Run against a SNAPSHOT url (never the shared dev server).
 *   PREVIEW_BASE=<url> node tools/tmp/potdiag.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_BASE ?? 'http://localhost:5173';
const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
];

const url = `${BASE}/?player=hamburger&enemy=donut&px=700&py=500&fogRadius=545&simSpeed=0.02&pointerLock=0&aimMode=free`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const st = window.__stage;
  const out = { hasStage: !!st, children: [], camera: null, fighters: window.__vfxDebugFighters ?? null };
  if (!st) return out;
  const cam = st.rig.camera;
  out.camera = {
    pos: [cam.position.x, cam.position.y, cam.position.z],
    fov: cam.fov,
    aspect: cam.aspect,
  };
  const dir = new (window.THREE_V ?? Object)();
  for (const c of st.scene.children) {
    let meshes = 0;
    let names = [];
    c.traverse((o) => { if (o.isMesh) { meshes++; if (names.length < 4) names.push(o.name || '(anon)'); } });
    out.children.push({
      name: c.name || '(anon)', type: c.type, visible: c.visible,
      pos: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)],
      meshes, sample: names,
    });
  }
  return out;
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
