#!/usr/bin/env node
/**
 * ch_hamburger_prop — place the SPATULA without editing the source once per candidate.
 *
 * OWNED BY THE HAMBURGER AGENT (`tools/tmp/ch_hamburger_*`). Read-only on `src/`.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * Uri, DECISIONS §37: *"I don't understand what the silver/grey element that is going
 * IN AND OUT of the character."* That it cannot be identified is the finding; *"in and
 * out"* is the mechanism, and it is measurable — the blade's world box spans
 * x 0.361 … 1.096 while the character's own cheese layer reaches x 0.560 at the same
 * height, so **0.20 m of the blade is inside the food mass.** Same class as
 * `docs/LESSONS.md` §1 case 8, where Sushi's correctly-sized blade spawned mid-torso
 * and rendered as two disconnected shards.
 *
 * The prop hangs off `rig.joints.handR`, so its placement is three numbers in that
 * joint's local frame and there is no reason to recompile the character to try one.
 * This builds the real hamburger, re-parents nothing, and just re-writes
 * `spatula.position/rotation/scale` before reading the resulting WORLD boxes.
 *
 * ACCEPTANCE, defined before the sweep (`docs/LESSONS.md` §3):
 *   1. `bladeMinX  >  foodMaxX` at the blade's own height — the blade is OUTSIDE the
 *      food, which is the literal complaint. Margin reported in metres.
 *   2. the blade is FORWARD of the food (`bladeMinZ` positive) so at the lobby camera
 *      it is read against the background rather than against the burger.
 *   3. prop height <= 0.85 m — it was 1.20 m, i.e. 47% of the character.
 *   4. the HANDLE is delivered, which is what makes the blade read as a tool rather
 *      than a shard. Checked separately with `rg_solid`.
 *
 *   node tools/tmp/ch_hamburger_prop.mjs --selftest
 *   node tools/tmp/ch_hamburger_prop.mjs
 */
import { loadCast, captureWarnings, arg, flag, num } from './rg_lib.mjs';

const { THREE, createCharacter } = await loadCast();

function measure({ px, py, pz, rx, ry, rz, s }) {
  const ch = captureWarnings(() => createCharacter('hamburger')).value;
  const root = ch.root ?? ch.body;
  let spat = null;
  root.traverse((o) => { if (o.name === 'spatula') spat = o; });
  if (!spat) throw new Error('no spatula group — the prop was renamed or removed');
  spat.position.set(px, py, pz);
  spat.rotation.set(rx, ry, rz);
  spat.scale.setScalar(s);
  root.updateWorldMatrix(true, true);

  const box = (name) => {
    let m = null;
    root.traverse((o) => { if (o.name === name && !m) m = o; });
    return m ? new THREE.Box3().setFromObject(m) : null;
  };
  const blade = box('spatula_blade');
  const handle = box('spatula_handle');
  const prop = new THREE.Box3().setFromObject(spat);
  // The food's own reach at the blade's height band: whichever stacked layer is
  // widest where the blade actually is. Measured, not assumed — the widest layer is
  // the CHEESE, which overhangs both the patty below it and the tomato above.
  let foodMaxX = 0;
  for (const n of ['patty', 'cheese', 'tomato', 'lettuce_base', 'crown', 'bottom_bun_mesh']) {
    const b = box(n);
    if (!b) continue;
    if (b.max.y < blade.min.y || b.min.y > blade.max.y) continue;   // no vertical overlap
    foodMaxX = Math.max(foodMaxX, b.max.x);
  }
  const size = prop.getSize(new THREE.Vector3());
  return {
    bladeMinX: blade.min.x, bladeCY: blade.getCenter(new THREE.Vector3()).y,
    bladeMinZ: blade.min.z, foodMaxX,
    clear: blade.min.x - foodMaxX,
    propH: size.y, propW: size.x,
    handleTop: handle.max.y, handleBot: handle.min.y,
  };
}

if (flag('--selftest')) {
  let pass = 0, fail = 0;
  const ok = (l, c, e = '') => { if (c) { pass++; console.log(`  ok   ${l}${e ? '  ' + e : ''}`); } else { fail++; console.log(`  FAIL ${l}${e ? '  ' + e : ''}`); } };
  console.log('ch_hamburger_prop selftest — known-bad inputs first\n');

  // KNOWN-BAD: drive the prop INTO the body. `clear` must go negative, or the metric
  // cannot see the defect it exists to measure.
  const inside = measure({ px: -0.60, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1 });
  ok('KNOWN-BAD: the prop pushed 0.6 m inboard reads NEGATIVE clearance', inside.clear < -0.1, `clear=${inside.clear.toFixed(3)}m`);

  // KNOWN-GOOD: the same prop pushed far outboard reads positive. Same object, same
  // process, opposite sign — so the number is about position, not about the harness.
  const outside = measure({ px: 0.90, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1 });
  ok('KNOWN-GOOD: the SAME prop pushed 0.9 m outboard reads POSITIVE', outside.clear > 0.1, `clear=${outside.clear.toFixed(3)}m`);

  // DRIFT CONTROL: two builds of the same candidate must agree exactly.
  const a = measure({ px: 0.1, py: 0, pz: 0.1, rx: -0.3, ry: 0.3, rz: -0.5, s: 0.62 });
  const b = measure({ px: 0.1, py: 0, pz: 0.1, rx: -0.3, ry: 0.3, rz: -0.5, s: 0.62 });
  ok('DRIFT CONTROL: the same candidate measured twice is identical', a.clear === b.clear && a.propH === b.propH, `${a.clear.toFixed(4)} vs ${b.clear.toFixed(4)}`);

  // SCALE: halving the prop must halve its height, or `s` is not doing what is claimed.
  const half = measure({ px: 0.1, py: 0, pz: 0.1, rx: -0.3, ry: 0.3, rz: -0.5, s: 0.31 });
  ok('MOVES: halving `scale` halves the prop height', Math.abs(half.propH / a.propH - 0.5) < 0.06, `${a.propH.toFixed(3)} -> ${half.propH.toFixed(3)}`);

  console.log(`\n  ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}

const CANDS = [];
for (const s of [0.58, 0.66, 0.74]) {
  for (const rz of [-0.35, -0.60, -0.85, -1.10]) {
    for (const px of [0.06, 0.14, 0.22]) {
      for (const pz of [0.10, 0.20, 0.30]) {
        CANDS.push({ px, py: num('--py', 0.00), pz, rx: num('--rx', -0.28), ry: num('--ry', 0.34), rz, s });
      }
    }
  }
}
const rows = CANDS.map((c) => ({ c, ...measure(c) }));
// Rank: clearance first (the actual complaint), then forwardness, then compactness.
rows.sort((a, b) => (b.clear - a.clear) || (b.bladeMinZ - a.bladeMinZ));
console.log('\nhamburger spatula placement — world boxes, metres. `clear` = bladeMinX - foodMaxX.');
console.log(`  ${'px'.padStart(5)} ${'pz'.padStart(5)} ${'rz'.padStart(6)} ${'scale'.padStart(5)} | ${'clear'.padStart(7)} ${'bladeZ'.padStart(7)} ${'bladeY'.padStart(7)} ${'propH'.padStart(6)}`);
for (const r of rows.slice(0, Number(arg('--top', 16)))) {
  console.log(`  ${r.c.px.toFixed(2).padStart(5)} ${r.c.pz.toFixed(2).padStart(5)} ${r.c.rz.toFixed(2).padStart(6)} ${r.c.s.toFixed(2).padStart(5)} | ${r.clear.toFixed(3).padStart(7)} ${r.bladeMinZ.toFixed(3).padStart(7)} ${r.bladeCY.toFixed(3).padStart(7)} ${r.propH.toFixed(3).padStart(6)}`);
}
console.log('');
