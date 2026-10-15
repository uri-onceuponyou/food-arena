#!/usr/bin/env node
/**
 * GX_CHARS_DRAWS — what the CAST costs the renderer in a live match, at 2 and at 6 seats.
 *
 * Draw calls are hardware-independent (`tools/perf.mjs` header), so SwiftShader is fine.
 * Method, one synchronous evaluate per arm so the app's own rAF cannot interleave:
 *   renderer.info.autoReset = false; info.reset(); shadowMap.needsUpdate = true;
 *   stage.render(0)  -> FULL (main + shadow + post passes)
 *   every `character:*` root hidden, same again -> NO-CAST
 *   delta = what the fighters cost. Shadow map forced to re-render in both arms, because
 *   `shadowMap.autoUpdate` is off in this build and an un-forced arm would silently drop
 *   the shadow pass from one side only.
 * Known-bad: a third arm hides NOTHING and must equal FULL exactly (the counter is stable),
 * and the cast count must be > 0 before any delta is believed.
 *
 *   node tools/tmp/sx_snap.mjs --root /private/tmp/fa-rv-head -- \
 *     node tools/tmp/gx_chars_draws.mjs --url '{URL}'
 */
import { chromium } from 'playwright';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const IS_MAIN = (() => {
  try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
})();
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const BASE = String(arg('url', process.env.PREVIEW_BASE ?? '')).replace(/\/$/, '');
const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];

const MEASURE = () => {
  const s = window.__stage;
  if (!s) return { error: 'no __stage' };
  const r = s.renderer;
  const casts = [];
  s.scene.traverse((o) => { if (/^character:/.test(o.name || '')) casts.push(o); });
  if (!casts.length) return { error: 'no character roots' };
  try { s.rig.shakeAmount = 0; s.rig.shakeOffset?.set?.(0, 0, 0); } catch { /* */ }
  const prev = r.info.autoReset;
  r.info.autoReset = false;
  const one = () => {
    r.info.reset(); r.shadowMap.needsUpdate = true; s.render(0);
    return { calls: r.info.render.calls, tris: r.info.render.triangles };
  };
  let full, none, same, noTrans, transMats = 0;
  try {
    full = one();
    same = one();
    const was = casts.map((c) => c.visible);
    casts.forEach((c) => { c.visible = false; });
    none = one();
    casts.forEach((c, i) => { c.visible = was[i]; });
    // TRANSMISSION arm: three.js re-renders every opaque object into a transmission target
    // whenever a transmissive material is in view. Zero every transmission, re-measure, restore.
    const tm = [];
    s.scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m && m.transmission > 0) { tm.push([m, m.transmission]); } });
    for (const [m] of tm) { m.transmission = 0; m.needsUpdate = true; }
    noTrans = one();
    for (const [m, t] of tm) { m.transmission = t; m.needsUpdate = true; }
    transMats = tm.length;
  } finally {
    r.info.autoReset = prev;
  }
  let meshes = 0;
  for (const c of casts) c.traverse((o) => { if (o.isMesh) meshes++; });
  return { casts: casts.length, castMeshes: meshes, full, same, none, noTrans, transMats,
    castCalls: full.calls - none.calls, castTris: full.tris - none.tris,
    shadowMapAutoUpdate: r.shadowMap.autoUpdate };
};

async function main() {
  if (!BASE) { console.error('need --url'); process.exit(2); }
  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  try {
    const warm = await browser.newPage();
    await warm.goto(`${BASE}/preview.html?piece=character&id=egg&t=0.5&shot=1`, { waitUntil: 'networkidle', timeout: 180_000 }).catch(() => {});
    await warm.close();
    const arms = [
      ...(process.argv.includes('--only-clustered') ? [] : [
        ['1v1 hamburger-donut', `/?player=hamburger&enemy=donut&pointerLock=0`],
        ['6 seats (?seats=6, shipped roster)', `/?seats=6&player=hamburger&enemy=donut&pointerLock=0`],
      ]),
      ['6 seats clustered A (no bottle)', `/?fighters=${encodeURIComponent('hamburger@1400,1190;donut@1400,1120;taco@1543,1168;burrito@1488,1247;egg@1312,1247;lollipop@1257,1168')}&pointerLock=0`],
      ['6 seats clustered B', `/?fighters=${encodeURIComponent('pizza@1400,1190;sushi@1400,1120;soup@1543,1168;waterbottle@1488,1247;hotdog@1312,1247;hamburger@1257,1168')}&pointerLock=0`],
    ];
    for (const [label, path] of arms) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      await page.waitForFunction(() => window.__gameReady === true, null, { timeout: 240_000 });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(MEASURE);
      if (m.error) { console.log(label, 'ERROR', m.error); await page.close(); continue; }
      const stable = m.full.calls === m.same.calls;
      console.log(`${label.padEnd(36)} fighters ${m.casts} · cast meshes ${m.castMeshes} · frame draws ${m.full.calls} (repeat ${m.same.calls}${stable ? ' ✓' : ' ✗ UNSTABLE'}) · without cast ${m.none.calls} · CAST COSTS ${m.castCalls} draws (${(m.castCalls / m.full.calls * 100).toFixed(1)}% of frame), ${m.castTris} tris · shadow autoUpdate=${m.shadowMapAutoUpdate} · transmissive mats ${m.transMats}, frame with transmission OFF ${m.noTrans.calls} draws (${m.full.calls - m.noTrans.calls} saved)`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (IS_MAIN) await main();
