#!/usr/bin/env node
/**
 * THE SILENT-OCCLUDER SWEEP — a transparent material that still writes depth.
 *
 * `docs/LESSONS.md` §1 names this trap in one line ("transparent materials without
 * `depthWrite: false` still write depth and silently occlude") and then records, in the
 * corollary to case 17, that it is **present project-wide and was never swept for**.
 * This is the sweep, and it exists because the trap had just cost another one:
 *
 *   `src/arena/hazards.ts`'s puddle body was `transparent: true, depthWrite: true` at
 *   y = 0.15. The per-fighter contact decal `src/render/stage.ts` draws at y = 0.09
 *   failed its depth test across the whole disc, so a fighter standing in grease or
 *   water had NO contact shadow — 0.000 of the floor's value on the flank the decal
 *   exists for, against 0.137 on open floor.
 *
 * ── WHAT IT FLAGS, AND WHY THAT DEFINITION AND NOT A BROADER ONE ────────────
 * A transparent depth-writer is only a BUG when something is meant to draw beneath it.
 * Above head height nothing is, so flagging every transparent material in the scene
 * would produce a wall of true-but-useless rows that nobody reads — which is how the
 * project-wide sweep failed to happen for this long. The rule here is narrow and
 * mechanical:
 *
 *   a mesh is an OCCLUDER if its material is `transparent && depthWrite`
 *   AND its world bounding box bottom is at or below `GROUND_CEIL`
 *   AND the box is FLAT (height <= `FLAT_MAX`) — i.e. it is a ground LAYER, the only
 *       thing that can sit between the floor and a decal
 *   AND its TOP is above `LOWEST_DECAL_Y` — because a depth write only buries what is
 *       BELOW it, and below that height there is nothing left to bury.
 *
 * A flat transparent layer lying on the floor that writes depth will bury every decal
 * authored below it, today or in future, whatever that decal's own settings are. That
 * is the whole failure mode, stated as a predicate.
 *
 * ⚠️ THE LAST CLAUSE IS WHAT MAKES THE OUTPUT ACTIONABLE RATHER THAN TRUE-AND-IGNORED.
 * The first draft omitted it and flagged a 5 cm `kpal:dust` mote spanning y -0.025 to
 * +0.025 alongside the two real defects. That mote IS the same authoring mistake, and
 * it cannot bury anything, because everything in the transparent ground stack is above
 * it. Rows like that are how a sweep gets ignored — so they are still PRINTED, under
 * their own heading, and they do not fail the check. `docs/LESSONS.md` §6b in reverse:
 * say what the metric excludes by policy, out loud.
 *
 * ── THE KNOWN-BAD INPUT — this guard is REQUIRED TO FAIL ────────────────────
 * `CLAUDE.md` rule 6: a guard that has not been shown to fail on the bug it guards
 * against is not a guard, and a guard can also be TAUTOLOGICAL — so ask what
 * implementation would fail it. This one runs itself twice in the same page:
 *
 *   PASS RUN     the tree as served. Expected: 0 occluders.
 *   KNOWN-BAD    `depthWrite = true` forced back onto the puddle bodies, live, nothing
 *                else touched — the defect re-injected rather than simulated. Expected:
 *                the sweep NAMES them. If it does not, the predicate is wrong and the
 *                clean run above proved nothing.
 *
 * That second run is why the injection targets the puddle by NAME rather than
 * "whatever is transparent": a control that flips the same flag the check reads on an
 * arbitrary mesh can pass while the check is still looking in the wrong place.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/hc_occluders.mjs
 *   node tools/tmp/hc_occluders.mjs --url http://localhost:5190 --station 560:900
 */
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
const STATION = arg('station', '560:900');
const W = 1600, H = 900;

/** Above this the question does not arise: nothing is authored to draw underneath a
 *  transparent surface a metre off the floor. Set just above the tallest ground layer
 *  (`FLOOR_Y.fine` = 0.25) with room for prop plinths and kicks. */
const GROUND_CEIL = 0.60;
/** A ground LAYER is flat. A transparent BOX at floor level (a glass cabinet front, a
 *  fogged pane) is a different object with different rules, and lumping the two
 *  together is what makes a sweep unreadable. */
const FLAT_MAX = 0.50;
/** The lowest thing in the transparent ground stack that anything can bury: the
 *  per-fighter contact decal, `CONTACT_Y` in `src/render/stage.ts`.
 *  ⚠️ If that constant moves, this must move with it — it is the whole reason the
 *  sweep can tell a real occluder from a harmless one. */
const LOWEST_DECAL_Y = 0.09;

const HMR_STUB = `const noop=()=>{};export const createHotContext=()=>({accept:noop,acceptExports:noop,dispose:noop,prune:noop,invalidate:noop,on:noop,off:noop,send:noop,decline:noop,data:{}});export const injectQuery=(u)=>u;export const updateStyle=noop;export const removeStyle=noop;export const ErrorOverlay=class{};export default {};`;

const SWEEP = `(GROUND_CEIL, FLAT_MAX, LOWEST_DECAL_Y) => {
  const st = window.__stage, scene = st.scene;
  scene.updateMatrixWorld(true);
  const out = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const bad = mats.filter((m) => m && m.transparent === true && m.depthWrite === true);
    if (!bad.length) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    // ⚠️ For an InstancedMesh this is the base geometry through the PARENT transform,
    // NOT the union of the instances — three keeps per-instance matrices in an
    // attribute the bounding box does not see. So an instanced field reports the
    // position and size of ONE mote at the origin. It is still surfaced (the material
    // flag is the defect, and the flag is shared), but its y is not to be trusted, and
    // that is why the row is labelled rather than gated on.
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const h = bb.max.y - bb.min.y;
    if (bb.min.y > GROUND_CEIL || h > FLAT_MAX) return;
    out.push({
      name: o.name || '(unnamed)',
      mat: bad.map((m) => m.name || m.type).join('+'),
      minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4),
      w: +(bb.max.x - bb.min.x).toFixed(2), d: +(bb.max.z - bb.min.z).toFixed(2),
      ro: o.renderOrder, opacity: mats[0] && mats[0].opacity,
      instanced: !!o.isInstancedMesh,
      // An instanced field's box is not its extent (see above), so it can never satisfy
      // the "buries something" clause on evidence this tool has. Reported, never gated.
      buries: !o.isInstancedMesh && bb.max.y > LOWEST_DECAL_Y,
    });
  });
  return out;
}`;

const INJECT = `(on) => {
  const st = window.__stage; let n = 0;
  st.scene.traverse((o) => {
    if (!o.isMesh || o.name !== 'puddle') return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.__kbSaved === undefined) m.__kbSaved = m.depthWrite;
    m.depthWrite = on ? true : m.__kbSaved;
    m.needsUpdate = true; n++;
  });
  return n;
}`;

const { chromium } = await import('playwright');
const [sx, sy] = STATION.split(':').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=993&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await p.waitForTimeout(1500);

const show = (rows, title) => {
  console.log(`\n${title}`);
  if (!rows.length) { console.log('  (none)'); return; }
  console.log('  name                                 material              minY   maxY    w x d      ro   opacity');
  for (const r of rows) {
    console.log(`  ${r.name.slice(0, 36).padEnd(36)} ${String(r.mat).slice(0, 20).padEnd(20)} ${r.minY.toFixed(3).padStart(6)} ${r.maxY.toFixed(3).padStart(6)} ${(r.w + 'x' + r.d).padStart(11)} ${String(r.ro).padStart(4)} ${String(r.opacity).padStart(6)}${r.instanced ? '   INSTANCED — box is one instance, not the field' : ''}`);
  }
};

const all = await p.evaluate(`(${SWEEP})(${GROUND_CEIL}, ${FLAT_MAX}, ${LOWEST_DECAL_Y})`);
const clean = all.filter((r) => r.buries);
show(clean, `SILENT OCCLUDERS — flat transparent depth-writers whose top is above y ${LOWEST_DECAL_Y}  (station ${STATION})`);
show(all.filter((r) => !r.buries), `SAME DEFECT, NOTHING BENEATH IT — below y ${LOWEST_DECAL_Y}, so it buries nothing today. Reported, not gated.`);

// ── the known-bad input ─────────────────────────────────────────────────────
const nInjected = await p.evaluate(`(${INJECT})(true)`);
const dirty = (await p.evaluate(`(${SWEEP})(${GROUND_CEIL}, ${FLAT_MAX}, ${LOWEST_DECAL_Y})`)).filter((r) => r.buries);
await p.evaluate(`(${INJECT})(false)`);
show(dirty, `KNOWN-BAD CONTROL — depthWrite forced back onto ${nInjected} puddle bodies`);

await p.close();
await b.close();

let fail = 0;
const ok = (nm, cond, got) => { if (cond) console.log(`  ok   ${nm}`); else { fail++; console.log(`  FAIL ${nm}   got ${got}`); } };
console.log('\nCHECKS');
ok('the shipped tree has no flat transparent depth-writer over a ground decal', clean.length === 0, clean.map((r) => r.name).join(', '));
ok('the known-bad control INJECTED something (otherwise it proves nothing)', nInjected > 0, nInjected);
ok('...and the sweep FIRES on it', dirty.length >= nInjected, `${dirty.length} flagged for ${nInjected} injected`);
ok('...and names the puddle specifically', dirty.some((r) => r.name === 'puddle'), dirty.map((r) => r.name).join(', '));
console.log(`\nhc_occluders  ${4 - fail}/4`);
process.exit(fail ? 1 : 0);
