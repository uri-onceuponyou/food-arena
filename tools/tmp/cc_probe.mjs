#!/usr/bin/env node
/**
 * cc_probe — the body's TRUE silhouette half-width as a function of height, and how
 * far each limb joint stands outside it.
 *
 * THROWAWAY, READ-ONLY on src/. "Probe before you loop" (CLAUDE.md #5, nine for nine).
 *
 * ── THE QUESTION, AND WHY THE OBVIOUS MEASUREMENT ANSWERS IT WRONG ───────────
 * All four lobby renders show limbs standing clear of the body. Two opposite fixes
 * produce that picture and picking wrong costs a round:
 *   · the joint is INSIDE the body and the segment simply stops too low  -> `rise`
 *   · the joint is OUTSIDE the body's surface                            -> lateral
 *
 * ⚠️ **Round 1 of this tool used each body mesh's world AABB as its width and was
 * WRONG in a way that produced a confident, plausible table.** A lathe's AABB
 * half-width is its width at its WIDEST height, not its width at the height you are
 * asking about — so a bottle whose belly is 0.56 m wide reported 0.56 m at the
 * shoulder too, and every limb came back "overlapping" while the render plainly
 * showed 100 px of background. CLAUDE.md #6: the instrument was validated against
 * nothing and it lied.
 *
 * So the width is taken from the VERTICES. Every body mesh's position attribute is
 * transformed to world space and binned by height; `halfW[y]` is the largest |x| of
 * any body vertex in that bin whose |z| is inside `zBand` (so a prop sticking out
 * FORWARD does not count as body width the limb could hide behind).
 *
 * For each limb slot it then prints:
 *   jx      the joint's world x
 *   bodyW   the body's half-width AT THE JOINT'S HEIGHT
 *   gap     jx - bodyW. **Positive means the joint is in mid-air.**
 *   riseTo  the lowest height ABOVE the joint at which the body is wide enough to
 *           cover it, and `riseM` the metres of `rise` that would take. `--` means
 *           the body never gets that wide and only a lateral move can attach it.
 *
 * ── KNOWN-BAD INPUT ─────────────────────────────────────────────────────────
 * `--knownbad shift` pushes every limb joint 0.25 m further out before measuring.
 * Every `gap` MUST grow by ~0.25. A probe that reports the same numbers for a body
 * it has visibly pulled apart is measuring nothing.
 *
 *   PREVIEW_BASE=... node tools/tmp/cc_probe.mjs --ids waterbottle
 *   PREVIEW_BASE=... node tools/tmp/cc_probe.mjs --ids waterbottle --knownbad shift
 */
import { chromium } from 'playwright';

const a = process.argv;
const get = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const BASE = process.env.PREVIEW_BASE ?? get('--url', null);
const IDS = get('--ids', 'waterbottle,pizza,hotdog,hamburger').split(',').filter(Boolean);
const KNOWNBAD = get('--knownbad', null);
if (!BASE) { console.error('need PREVIEW_BASE or --url'); process.exit(2); }

const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'];
const HMR_STUB = `const noop=()=>{};
export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,
  invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});
export const injectQuery=(u)=>u; export const updateStyle=noop; export const removeStyle=noop;
export const ErrorOverlay=class{}; export default {};`;

const browser = await chromium.launch({ args: LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1 });
await page.route('**/@vite/client', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: HMR_STUB }));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

for (const id of IDS) {
  const url = `${BASE}/preview.html?piece=character&id=${id}&pitch=20&yaw=0&fill=0.60&t=1.5&anim=idle&shot=1&bg=3d2b21`;
  await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForFunction('window.__previewReady === true && !!window.__stage', null, { timeout: 180_000 });

  const res = await page.evaluate(({ knownbad }) => {
    let root = null;
    window.__stage.scene.traverse((o) => { if (!root && o.name === 'head') root = o; });
    while (root && root.parent && root.parent !== window.__stage.scene) root = root.parent;
    if (!root) return { error: 'no character root' };

    const JOINT_OF = {
      upperArmL: 'shoulderL', upperArmR: 'shoulderR', forearmL: 'elbowL', forearmR: 'elbowR',
      thighL: 'hipL', thighR: 'hipR', shinL: 'kneeL', shinR: 'kneeR',
    };
    const byName = {};
    root.traverse((o) => { if (o.name) (byName[o.name] ??= []).push(o); });
    const limbRoots = new Set();
    for (const jn of Object.values(JOINT_OF)) for (const o of byName[jn] ?? []) limbRoots.add(o);
    for (const jn of ['handL', 'handR', 'footL', 'footR']) for (const o of byName[jn] ?? []) limbRoots.add(o);

    if (knownbad === 'shift') {
      for (const jn of ['shoulderL', 'shoulderR', 'hipL', 'hipR']) {
        for (const o of byName[jn] ?? []) o.position.x += (o.position.x >= 0 ? 1 : -1) * 0.25;
      }
    }
    root.updateMatrixWorld(true);

    const isLimb = (o) => { let n = o; while (n) { if (limbRoots.has(n)) return true; n = n.parent; } return false; };

    // ── the body's half-width profile, from VERTICES, binned by height ────────
    const BIN = 0.02;                 // 2 cm bins
    const halfW = new Map();          // binIndex -> max |x| (both sides tracked apart)
    const halfWL = new Map(), halfWR = new Map();
    let yMin = 1e9, yMax = -1e9;
    let bodyVerts = 0, bodyMeshes = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry || isLimb(o)) return;
      const pos = o.geometry.getAttribute('position'); if (!pos) return;
      bodyMeshes++;
      const e = o.matrixWorld.elements;
      const step = pos.count > 20000 ? 3 : 1;
      for (let i = 0; i < pos.count; i += step) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (Math.abs(wz) > 0.30) continue;   // zBand: front/back props are not body WIDTH
        bodyVerts++;
        const b = Math.floor(wy / BIN);
        if (wy < yMin) yMin = wy; if (wy > yMax) yMax = wy;
        const ax = Math.abs(wx);
        if (ax > (halfW.get(b) ?? 0)) halfW.set(b, ax);
        const m = wx >= 0 ? halfWR : halfWL;
        if (ax > (m.get(b) ?? 0)) m.set(b, ax);
      }
    });

    const widthAt = (y, side) => {
      const m = side > 0 ? halfWR : halfWL;
      const b = Math.floor(y / BIN);
      let best = 0;
      for (const d of [-1, 0, 1]) best = Math.max(best, m.get(b + d) ?? 0);
      return best;
    };

    const out = [];
    for (const [slot, jn] of Object.entries(JOINT_OF)) {
      const joint = (byName[jn] ?? [])[0];
      if (!joint) { out.push({ slot, missing: true }); continue; }
      const e = joint.matrixWorld.elements;
      const jx = e[12], jy = e[13];
      const side = jx >= 0 ? 1 : -1;
      const ax = Math.abs(jx);
      const bw = widthAt(jy, side);
      // lowest height above jy at which the body is wide enough to swallow the joint
      let riseTo = null;
      for (let y = jy; y <= yMax + BIN; y += BIN) {
        if (widthAt(y, side) >= ax) { riseTo = y; break; }
      }
      out.push({
        slot, jx: +jx.toFixed(4), jy: +jy.toFixed(4), bodyW: +bw.toFixed(4),
        gap: +(ax - bw).toFixed(4),
        riseTo: riseTo === null ? null : +riseTo.toFixed(3),
        riseM: riseTo === null ? null : +(riseTo - jy).toFixed(3),
      });
    }
    return { rows: out, bodyMeshes, bodyVerts, yMin: +yMin.toFixed(3), yMax: +yMax.toFixed(3) };
  }, { knownbad: KNOWNBAD });

  if (res.error) { console.log(`${id}: ${res.error}`); continue; }
  console.log(`\n=== ${id} ===  bodyMeshes=${res.bodyMeshes} verts=${res.bodyVerts} y=[${res.yMin},${res.yMax}]${KNOWNBAD ? `  KNOWNBAD=${KNOWNBAD}` : ''}`);
  console.log('slot            jx      jy   bodyW     gap   riseTo   riseM');
  for (const r of res.rows) {
    if (r.missing) { console.log(`${r.slot.padEnd(11)} (missing)`); continue; }
    console.log(`${r.slot.padEnd(11)} ${String(r.jx).padStart(7)} ${String(r.jy).padStart(7)} `
      + `${String(r.bodyW).padStart(7)} ${String(r.gap).padStart(7)} `
      + `${String(r.riseTo ?? '--').padStart(7)} ${String(r.riseM ?? '--').padStart(7)}`
      + (r.gap > 0.005 ? '   <- JOINT IN MID-AIR' : ''));
  }
}
await browser.close();
