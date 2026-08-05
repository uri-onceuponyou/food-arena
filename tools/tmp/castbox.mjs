#!/usr/bin/env node
/**
 * castbox — the cast's WORLD-SPACE bounding box, against the collision circle.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 * Two changes are in flight that both widen the cast: a stance/splay pass that
 * spreads the feet to buy silhouette, and a `CHARACTER_HEIGHT` rise that scales
 * every model uniformly. The stated risk is "I look like I should have been hit" —
 * the model growing past the collision footprint the sim actually uses.
 *
 * That risk has a SIGN and nobody had measured which way it points. `units.ts` puts
 * `CHARACTER_RADIUS` at `42 * 0.05 * 0.5 = 1.05 m`, i.e. the collision circle is
 * 2.10 m ACROSS, and the models are nothing like that wide. So:
 *
 *   model half-width < 1.05 m   the player is hit by attacks that visually MISS
 *   model half-width > 1.05 m   attacks pass through the visible model and whiff
 *
 * A cast that is currently far inside the circle can therefore get WIDER and end up
 * MORE honest, up to the point where it crosses. This prints the number, per
 * character, so the width policy is a decision rather than a worry.
 *
 * Read-only. One boot: `preview.html?piece=roster` mounts all eleven at once.
 *
 *   node tools/tmp/headserve.mjs --overlay src/characters -- node tools/tmp/castbox.mjs
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? process.env.HEADSERVE_URL ?? get('--url', 'http://localhost:5173');

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const MEASURE = () => {
  const stage = window.__stage;
  if (!stage || stage.disposed) return { error: 'no live Stage' };
  const scene = stage.scene;
  const roots = [];
  scene.traverse((o) => { if (/^character:/.test(o.name || '')) roots.push(o); });
  if (!roots.length) return { error: 'no character roots' };
  const out = [];
  for (const r of roots) {
    // Each root sits at its own slot in the roster row, so the box has to be taken
    // in the ROOT's own frame — a world box would measure the layout, not the model.
    r.updateWorldMatrix(true, true);
    const inv = r.matrixWorld.clone().invert();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    r.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if ((o.name || '').endsWith('__outline')) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const m = inv.clone().multiply(o.matrixWorld);
      for (let i = 0; i < 8; i++) {
        const v = new (r.position.constructor)(
          i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        v.applyMatrix4(m);
        if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
        if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y;
        if (v.z < z0) z0 = v.z; if (v.z > z1) z1 = v.z;
      }
    });
    // The FOOD MASS on its own, and the widest single mesh. "The model is wider
    // than its hitbox" is only a fair complaint about the part a player aims at:
    // a mitt or a boot tip reaching past the circle is normal in this genre, a
    // BODY reaching past it is not. Measuring them separately is the difference
    // between a decision and a worry.
    let mx = 0, mName = '', fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9;
    for (const jn of ['head', 'neck', 'torso']) {
      const jt = r.getObjectByName(jn);
      if (!jt) continue;
      jt.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if ((o.name || '').endsWith('__outline')) return;
        // Silhouette events hang off `head` too, and they are exactly the things
        // this column exists to EXCLUDE: a ladle handle reaching past the hit
        // radius is a prop, a bowl reaching past it is the complaint.
        for (let n = o; n; n = n.parent) if (n.userData && n.userData.silhouetteEvent) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        if (!bb) return;
        const m = inv.clone().multiply(o.matrixWorld);
        for (let i = 0; i < 8; i++) {
          const v = new (r.position.constructor)(
            i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
          v.applyMatrix4(m);
          if (v.x < fx0) fx0 = v.x; if (v.x > fx1) fx1 = v.x;
          if (v.z < fz0) fz0 = v.z; if (v.z > fz1) fz1 = v.z;
        }
      });
    }
    r.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      if ((o.name || '').endsWith('__outline')) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const m = inv.clone().multiply(o.matrixWorld);
      let h = 0;
      for (let i = 0; i < 8; i++) {
        const v = new (r.position.constructor)(
          i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
        v.applyMatrix4(m);
        h = Math.max(h, Math.abs(v.x), Math.abs(v.z));
      }
      if (h > mx) { mx = h; mName = o.name || o.type; }
    });
    out.push({
      id: r.name.replace(/^character:/, ''), x0, x1, y0, y1, z0, z1,
      massHalf: Math.max(Math.abs(fx0), Math.abs(fx1), Math.abs(fz0), Math.abs(fz1)),
      widestMesh: mName,
    });
  }
  return { rows: out };
};

const browser = await chromium.launch({ args: LAUNCH_ARGS });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await page.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
  page.on('pageerror', (e) => console.error('  PAGEERROR', String(e).slice(0, 220)));
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.error('  ' + m.text().slice(0, 220)); });
  await page.goto(`${BASE}/preview.html?piece=roster`, { waitUntil: 'networkidle', timeout: 180000 });
  await page.waitForFunction('window.__previewReady === true', null, { timeout: 180000 });
  await page.waitForTimeout(600);
  const res = await page.evaluate(MEASURE);
  if (res.error) { console.error(res.error); process.exit(2); }

  const R = 42 * 0.05 * 0.5;          // units.ts CHARACTER_RADIUS — MOVEMENT collision
  const HIT = 42 * 0.6 * 0.05;        // rules.ts HIT_RADIUS_VS_PLAYER — what a shot tests
  console.log(`movement collision radius ${R.toFixed(3)} m   ·   HIT_RADIUS_VS_PLAYER ${HIT.toFixed(3)} m`);
  console.log('the second is the one a player judges a hit by, and it is 20% larger.\n');
  console.log('char          height   widthX   depthZ   halfMax  massHalf  half/HIT  mass/HIT   widest mesh');
  let worst = 0, worstId = '';
  for (const r of res.rows.sort((p, q) => p.id.localeCompare(q.id))) {
    const h = r.y1 - r.y0, wx = r.x1 - r.x0, dz = r.z1 - r.z0;
    const half = Math.max(Math.abs(r.x0), Math.abs(r.x1), Math.abs(r.z0), Math.abs(r.z1));
    if (half > worst) { worst = half; worstId = r.id; }
    console.log(`${r.id.padEnd(12)} ${h.toFixed(3)}    ${wx.toFixed(3)}    ${dz.toFixed(3)}    ${half.toFixed(3)}     ` +
      `${r.massHalf.toFixed(3)}     ${(half / HIT).toFixed(3)}     ${(r.massHalf / HIT).toFixed(3)}     ${r.widestMesh}`);
  }
  const massWorst = Math.max(...res.rows.map((r) => r.massHalf));
  console.log(`\nwidest anything: ${worstId} at ${worst.toFixed(3)} m = ${(worst / HIT).toFixed(3)} of HIT_RADIUS`);
  console.log(`widest FOOD MASS: ${massWorst.toFixed(3)} m = ${(massWorst / HIT).toFixed(3)} of HIT_RADIUS`);
  for (const k of [1.12, 1.19, 1.238]) {
    console.log(`  at CHARACTER_HEIGHT ${(2.1 * k).toFixed(2)} (x${k}): anything ` +
      `${((worst * k) / HIT).toFixed(3)}, food mass ${((massWorst * k) / HIT).toFixed(3)}`);
  }
  console.log('\n>1.000 means that part reaches OUTSIDE the radius a shot is tested against —');
  console.log('an attack that visually connects there whiffs. A MITT or a BOOT past the line is');
  console.log('normal in this genre; a BODY past it is the "that should have hit me" complaint.');
} finally { await browser.close(); }
