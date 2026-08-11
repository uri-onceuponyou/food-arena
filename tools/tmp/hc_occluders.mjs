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
 *   AND its world bounding box bottom is at or below `GROUND_CEIL` — it is ROOTED in
 *       the ground stack, rather than floating clear of it
 *   AND its TOP is above `LOWEST_DECAL_Y` — because a depth write only buries what is
 *       BELOW it, and below that height there is nothing left to bury.
 *
 * A transparent surface rooted in the floor that writes depth will bury every decal
 * authored below it, today or in future, whatever that decal's own settings are. That
 * is the whole failure mode, stated as a predicate.
 *
 * ⚠️ THE `FLAT_MAX` CLAUSE WAS A HOLE, AND THE BIGGEST INSTANCE OF THE CLASS WAS IN IT.
 * The wording it replaces is kept verbatim, because it read as obviously right:
 *
 *     AND the box is FLAT (height <= `FLAT_MAX`) — i.e. it is a ground LAYER, the only
 *         thing that can sit between the floor and a decal
 *     ...
 *     A transparent BOX at floor level (a glass cabinet front, a fogged pane) is a
 *     different object with different rules, and lumping the two together is what makes
 *     a sweep unreadable.
 *
 * It is not a different object and the rules are not different. A depth write rejects
 * whatever is drawn AFTER it and BEHIND it anywhere in its SCREEN footprint, and at a
 * 58-degree top-down camera the screen footprint of anything standing on the floor
 * CONTAINS the floor behind it. `hazard:wisp` — seven 1.7 m cones rooted at y -0.82 on
 * the pot's hazard ring, `transparent: true` with `depthWrite` left true — was measured
 * by `tools/tmp/gl_occl_ab.mjs` burying **1,834 delivered px / 96,474 summed delta at
 * `pot_south`, meanD up to 73.6, maxD 132**: 153x the `kpal:dust` field by pixels and
 * 766x by summed delta. THIS GUARD PASSED 4/4 with all seven on screen. The narrowing
 * that made the output readable is what let the defect sit in the gap.
 *
 * ⚠️ AND THE FIX IS THE PROOF, NOT THE ARGUMENT. On `2f05202` — the tree that had it —
 * the widened predicate returns **3/4**, naming nine rows: seven `hazard_wisp`, plus
 * `pot_flame` and `pot_flame_core`, which are the same authoring mistake sealed inside
 * the pot body. With `src/arena/hazards.ts` fixed it returns **4/4** on the same
 * predicate. The failing run was captured BEFORE the fix landed, as
 * `shots/hw/knownbad_hc_occluders_HEAD_2f05202.txt` — local only, because `shots/` is
 * gitignored, so its nine rows are also transcribed into that commit's message, which is
 * the copy that survives. Regenerable from any tree:
 *   node tools/tmp/headserve.mjs --ref 2f05202 -- node tools/tmp/hc_occluders.mjs --station 700:640
 *
 * Readability is kept by CLASSIFYING on `FLAT_MAX` instead of FILTERING on it: the rows
 * print as `flat` (a ground layer, buries what is under it) or `tall` (a volume rooted
 * in the floor, buries the floor behind it). Both are gated. Widening it cost NINE rows
 * on the worst tree this project has had for this class and one row on the fixed one, so
 * the sweep does not drown — the fear the old clause was written against was never
 * measured, and the bug it hid was.
 *
 * ⚠️ THE `LOWEST_DECAL_Y` CLAUSE IS WHAT KEEPS THE OUTPUT ACTIONABLE RATHER THAN
 * TRUE-AND-IGNORED. The first draft omitted it and flagged a 5 cm `kpal:dust` mote
 * spanning y -0.025 to +0.025 alongside the two real defects. That mote IS the same
 * authoring mistake, and it cannot bury anything, because everything in the transparent
 * ground stack is above it. Rows like that are how a sweep gets ignored — so they are
 * still PRINTED, under their own heading, and they do not fail the check.
 * `docs/LESSONS.md` §6b in reverse: say what the metric excludes by policy, out loud.
 *
 * ── THE KNOWN-BAD INPUT — this guard is REQUIRED TO FAIL ────────────────────
 * `CLAUDE.md` rule 6: a guard that has not been shown to fail on the bug it guards
 * against is not a guard, and a guard can also be TAUTOLOGICAL — so ask what
 * implementation would fail it. This one runs itself twice in the same page:
 *
 *   PASS RUN     the tree as served. Expected: 0 occluders.
 *   KNOWN-BAD    `depthWrite = true` forced back onto the puddle bodies AND the seven
 *                hazard wisps, live, nothing else touched — the defect re-injected
 *                rather than simulated. Expected: the sweep NAMES them. If it does not,
 *                the predicate is wrong and the clean run above proved nothing.
 *
 * That second run is why the injection targets its meshes by NAME rather than
 * "whatever is transparent": a control that flips the same flag the check reads on an
 * arbitrary mesh can pass while the check is still looking in the wrong place.
 *
 * ⚠️ AND IT INJECTS ONE OF EACH SHAPE ON PURPOSE. The puddle is `flat`, the wisp is
 * `tall`, and for the whole life of the `FLAT_MAX` filter the puddle injection passed
 * while the tall class was invisible to the predicate. A known-bad input that only
 * exercises the shape the tool already handles proves the tool handles that shape.
 *
 *   node tools/tmp/headserve.mjs -- node tools/tmp/hc_occluders.mjs
 *   node tools/tmp/hc_occluders.mjs --url http://localhost:5190 --station 560:900
 */
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1]; };
const BASE = arg('url', process.env.PREVIEW_BASE ?? 'http://localhost:5173');
// ⚠️ RE-AIMED FOR THE ×4 MAP, 2026-08-11 (`6631446` took the arena 1400×1000 →
// 2800×2000; these defaults did not follow). `560:900` was the 1× grease puddle; `6955c04` then moved the puddle
// itself to (1950,1100), so the default was stale to TWO commits at once.
// Coordinates are `tools/arena-scan.mjs`'s current, --selftest-validated stations for
// the same ids, and `fogRadius` is the shipped `maxSafeRadius` 1985 — the old 993 was
// the 1× value, which puts a death-zone wall through the frame. `tools/tmp/al_guard.mjs`
// fails on the old values.
const STATION = arg('station', '1950:1100');
const W = 1600, H = 900;

/** Above this the question does not arise: nothing is authored to draw underneath a
 *  transparent surface a metre off the floor. Set just above the tallest ground layer
 *  (`FLOOR_Y.fine` = 0.25) with room for prop plinths and kicks. */
const GROUND_CEIL = 0.60;
/** ⚠️ NO LONGER A FILTER — it CLASSIFIES. Below this a hit is a ground `flat` layer
 *  (buries what is under it); above it the hit is a `tall` volume rooted in the floor
 *  (buries the floor BEHIND it, which is the same rejection through a different
 *  geometry). It was a filter, `hazard:wisp` spans 1.7 m, and that is exactly how the
 *  class's largest live instance passed this guard 4/4. See the header. */
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
    // ROOTED in the ground stack is the whole test. Height CLASSIFIES the hit, it no
    // longer excludes it — see the header on FLAT_MAX.
    if (bb.min.y > GROUND_CEIL) return;
    out.push({
      name: o.name || '(unnamed)',
      mat: bad.map((m) => m.name || m.type).join('+'),
      shape: h > FLAT_MAX ? 'tall' : 'flat',
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

/** Both shapes, by name. `puddle` is the FLAT ground layer this guard was written for;
 *  `hazard_wisp__no_outline` is the TALL rooted volume the old `FLAT_MAX` filter could
 *  not see. Injecting only the first is what a green 4/4 looked like while the second
 *  was on screen. */
const KB_NAMES = ['puddle', 'hazard_wisp__no_outline'];
const INJECT = `(on, names) => {
  const st = window.__stage; const n = {};
  for (const k of names) n[k] = 0;
  st.scene.traverse((o) => {
    if (!o.isMesh || !names.includes(o.name)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.__kbSaved === undefined) m.__kbSaved = m.depthWrite;
    // The transparent flag too: depthWrite is only consulted for a material in the
    // transparent queue, so re-injecting the flag onto a material that a fix ALSO
    // moved out of that queue would inject nothing and the control would silently
    // prove nothing. Neither of these two is opaque today; this is the guard on that.
    if (m.__kbTrans === undefined) m.__kbTrans = m.transparent;
    m.transparent = on ? true : m.__kbTrans;
    m.depthWrite = on ? true : m.__kbSaved;
    m.needsUpdate = true; n[o.name]++;
  });
  return n;
}`;

const { chromium } = await import('playwright');
const [sx, sy] = STATION.split(':').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.error('PAGEERROR', String(e)));
await p.route('**/@vite/client*', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: HMR_STUB }));
await p.goto(`${BASE}/?player=hamburger&enemy=donut&px=${sx}&py=${sy}&fogRadius=1985&simSpeed=0.02&pointerLock=0`, { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForFunction('window.__gameReady === true', null, { timeout: 90000 });
await p.waitForTimeout(1500);

const show = (rows, title) => {
  console.log(`\n${title}`);
  if (!rows.length) { console.log('  (none)'); return; }
  console.log('  shape  name                                 material              minY   maxY    w x d      ro   opacity');
  for (const r of rows) {
    console.log(`  ${r.shape.padEnd(6)} ${r.name.slice(0, 36).padEnd(36)} ${String(r.mat).slice(0, 20).padEnd(20)} ${r.minY.toFixed(3).padStart(6)} ${r.maxY.toFixed(3).padStart(6)} ${(r.w + 'x' + r.d).padStart(11)} ${String(r.ro).padStart(4)} ${String(r.opacity).padStart(6)}${r.instanced ? '   INSTANCED — box is one instance, not the field' : ''}`);
  }
};

const all = await p.evaluate(`(${SWEEP})(${GROUND_CEIL}, ${FLAT_MAX}, ${LOWEST_DECAL_Y})`);
const clean = all.filter((r) => r.buries);
show(clean, `SILENT OCCLUDERS — transparent depth-writers rooted at or below y ${GROUND_CEIL} whose top is above y ${LOWEST_DECAL_Y}  (station ${STATION})\n  'flat' buries what is UNDER it; 'tall' buries the floor BEHIND it. Both are gated.`);
show(all.filter((r) => !r.buries), `SAME DEFECT, NOTHING BENEATH IT — below y ${LOWEST_DECAL_Y}, so it buries nothing today. Reported, not gated.`);

// ── the known-bad input ─────────────────────────────────────────────────────
const injected = await p.evaluate(`(${INJECT})(true, ${JSON.stringify(KB_NAMES)})`);
const dirty = (await p.evaluate(`(${SWEEP})(${GROUND_CEIL}, ${FLAT_MAX}, ${LOWEST_DECAL_Y})`)).filter((r) => r.buries);
await p.evaluate(`(${INJECT})(false, ${JSON.stringify(KB_NAMES)})`);
const nInjected = Object.values(injected).reduce((a, x) => a + x, 0);
show(dirty, `KNOWN-BAD CONTROL — transparent+depthWrite forced back onto ${KB_NAMES.map((k) => `${injected[k]}x ${k}`).join(' + ')}`);

await p.close();
await b.close();

let fail = 0;
const ok = (nm, cond, got) => { if (cond) console.log(`  ok   ${nm}`); else { fail++; console.log(`  FAIL ${nm}   got ${got}`); } };
console.log('\nCHECKS');
ok('the shipped tree has no transparent depth-writer rooted in the ground stack over a decal', clean.length === 0, clean.map((r) => `${r.name}[${r.shape}]`).join(', '));
ok('the known-bad control INJECTED both shapes (otherwise it proves nothing)', KB_NAMES.every((k) => injected[k] > 0), JSON.stringify(injected));
ok('...and the sweep FIRES on it', dirty.length >= nInjected, `${dirty.length} flagged for ${nInjected} injected`);
// ⚠️ BOTH shapes, in one check, so the count stays 4 and `docs/TOOLS.md`'s gate table
// row does not move. Was `dirty.some(r => r.name === 'puddle')`, which was TRUE for the
// entire life of the `FLAT_MAX` filter while the tall class was invisible.
ok('...and names BOTH the flat puddle and the tall hazard wisp',
  dirty.some((r) => r.name === 'puddle' && r.shape === 'flat') && dirty.some((r) => r.name === 'hazard_wisp__no_outline' && r.shape === 'tall'),
  dirty.map((r) => `${r.name}[${r.shape}]`).join(', '));
console.log(`\nhc_occluders  ${4 - fail}/4`);
process.exit(fail ? 1 : 0);
