#!/usr/bin/env node
/**
 * cb_rig — dump the BONE ARITHMETIC behind the bead-necklace defect, in Node, with
 * no renderer, for the four characters CAST-B owns.
 *
 * THROWAWAY, READ-ONLY on src/. It changes nothing; it prints the four numbers that
 * decide whether `taperedSegment` emits a LIMB or a BALL:
 *
 *     len            the bone length the rig hands the dressing
 *     rTop + rBot    the caps the character file asks for
 *     ratio          (rTop + rBot) / len
 *
 * `taperedSegment` (the pre-fix copy, still live in `egg.ts` and `lollipop.ts`) only
 * emits a straight side when `len >= rTop + rBot`, i.e. when ratio <= 1. Below that
 * it takes the `yTopSafe = Math.max(...)` branch, which does NOT shrink the caps — it
 * stacks two FULL hemispheres, producing a sphere wider than the bone whose top cap
 * reaches `(rTop + rBot - len)` ABOVE its own joint origin. That overhang is printed
 * as `pokeUp`, in metres, because it is the number that makes a chain of segments
 * interpenetrate rather than abut.
 *
 * ⚠️ KNOWN-BAD INPUT (`--selftest`, CLAUDE.md #6). The classifier is run against
 * hand-derived cases whose answer is arithmetic, INCLUDING the boundary at exactly
 * ratio = 1 in both directions, and against a case that a naive `len < rTop` test
 * would misclassify. A guard not shown to fail on the bug it guards is not a guard.
 *
 * Usage:
 *   node tools/tmp/cb_rig.mjs [--selftest]
 */
import { createServer } from 'vite';
import * as THREE from 'three';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SELFTEST = process.argv.includes('--selftest');

/**
 * The ONE piece of logic under test: given a bone and the two cap radii a character
 * asks for, does the pre-fix `taperedSegment` emit a side, and by how much does the
 * mesh overhang its own joint origin?
 *
 * Derived directly from the pre-fix source (`egg.ts:583`, `lollipop.ts:304`):
 *   yBotCap = -len + rBot ;  yTopCap = -rTop ;  side emitted iff yTopCap >= yBotCap
 *   => -rTop >= -len + rBot  =>  len >= rTop + rBot
 * and when it is not, `yTopSafe = max(yTopCap, yBotCap) = yBotCap = -len + rBot`, so
 * the top cap's apex sits at `yTopSafe + rTop = rTop + rBot - len` — positive, i.e.
 * ABOVE y=0, which is the joint origin.
 */
function classifyPreFix(len, rTop, rBot) {
  const capSum = rTop + rBot;
  const hasSide = len >= capSum;
  const pokeUp = hasSide ? 0 : capSum - len;
  return { capSum, ratio: capSum / len, hasSide, pokeUp };
}

/**
 * ── THE ATTACHMENT BRIDGE, and the WRONG WAY TO MEASURE IT ───────────────────
 *
 * `bodySurfaceX` answers "how far out does the BODY reach, at this exact height and
 * depth" by firing a ray inward from far outside and taking the first hit on a
 * non-limb mesh. `bridge` is then
 *
 *     bodySurfaceX  −  (|jointX| − limbTopRadius)
 *
 * i.e. how far the limb's inner edge sits INSIDE the body. Positive = overlapping;
 * **negative = a visible gap, in metres.** It exists because lollipop's
 * `shoulderWidth`/`stanceWidth` are tuned by a derivation written in that file's own
 * comments, and BOTH of that derivation's inputs had gone stale under it: it uses
 * the RIG's `armRadius` while the call site builds the segment at `size.radius *
 * 0.66`, and it quotes `stickR = 0.32R = 0.230 m` while the code says `R * 0.28`.
 * A comment cannot notice either.
 *
 * 🚨 THE FIRST IMPLEMENTATION OF THIS WAS A VERTEX SCAN AND IT RETURNED A CONFIDENT
 * WRONG ANSWER. It took the largest |x| over every non-limb vertex within a slab of
 * the joint's y and z. It reported lollipop's shoulders attached with a **+0.148 m**
 * bridge while the lobby render shows daylight between every limb and the stick.
 * Two independent causes, both general enough to be worth the words:
 *
 *   1. **A VERTEX SLAB CANNOT SEE A LOW-TESSELLATION BODY.** The stick is
 *      `CylinderGeometry(r, r, h, 16, 1)` — `heightSegments = 1`, so it has vertices
 *      at its two END RINGS AND NOWHERE ELSE. At shoulder height it contributed ZERO
 *      vertices, so the scan did not see the body at all. This is not a lollipop
 *      quirk: it is true of every extruded or lathed body in the cast.
 *   2. **"THE WIDEST NON-LIMB MESH" IS NOT "THE BODY".** What it found instead was
 *      an unnamed `TorusGeometry` — the wrapper collar, a thin ring — at 0.4695. A
 *      thin ring an arm passes beside is not something an arm attaches to.
 *
 * `--selftest` therefore pins BOTH methods against the same synthetic body, and
 * requires the vertex scan to FAIL on it. A guard that has not been shown to fail on
 * the bug it guards against is not a guard (CLAUDE.md #6), and here the bug is the
 * previous version of this very function.
 *
 * ⚠️ AND THIS IS A DIAGNOSTIC, NOT A GATE. It is 3D truth at one (y, z) line; it
 * cannot tell you what the SILHOUETTE does, and a limb can overlap in x and still
 * read detached if it passes in front at a different z. The shipped instrument for
 * "is it attached" is `limbmatch --mode chars` (27 selftests, and a `--mode control`
 * that flings a hand clear and requires the metric to move) — but note that
 * `limbmatch` renders the MATCH camera at 58deg, and at ~190 px of figure it reports
 * lollipop `detach 0 px, isl 1` at BOTH yaw 0 and yaw 90 while the gap is
 * unmistakable at the lobby camera. Steer on the read PNG; use this for the WHY.
 */
const LIMB_RE = /(upperArm|forearm|thigh|shin|hand|foot|arm|leg)/i;
/**
 * `bodyNames` is REQUIRED, and that is the whole correction. "Every non-limb mesh"
 * is not a definition of the body — see the second failure mode above, and note the
 * raycast reproduces it exactly if you let it: fired from outside at lollipop's
 * shoulder it hits the WRAPPER COLLAR's outer wall at 0.50 before it ever reaches
 * the stick at 0.2016. Naming the mesh an arm must attach to is the only statement
 * of intent that a probe cannot get wrong on your behalf.
 */
function bodySurfaceX(THREE, root, bodyNames, sign, worldY, worldZ, far) {
  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (LIMB_RE.test(o.name)) return;
    if (o.name.endsWith('__outline')) return; // the inverted hull is not the body
    if (!bodyNames.some((nm) => o.name === nm || o.name.startsWith(nm))) return;
    targets.push(o);
  });
  if (!targets.length) return { x: 0, mesh: 'NO BODY MESH MATCHED — refusing to guess' };
  const rc = new THREE.Raycaster(
    new THREE.Vector3(sign * far, worldY, worldZ),
    new THREE.Vector3(-sign, 0, 0),
    0, far * 2,
  );
  const hits = rc.intersectObjects(targets, false);
  if (!hits.length) return { x: 0, mesh: null };
  return { x: Math.abs(hits[0].point.x), mesh: hits[0].object.name || `(unnamed:${hits[0].object.geometry.type})` };
}

/** The pre-fix method, kept ONLY so `--selftest` can show it failing. */
function bodyHalfWidthByVertexSlab(THREE, root, worldY, worldZ, slab) {
  const v = new THREE.Vector3();
  let best = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (LIMB_RE.test(o.name) || o.name.endsWith('__outline')) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (Math.abs(v.y - worldY) > slab || Math.abs(v.z - worldZ) > slab * 2) continue;
      if (Math.abs(v.x) > best) best = Math.abs(v.x);
    }
  });
  return best;
}

if (SELFTEST) {
  let n = 0, bad = 0;
  const t = (name, ok, got) => { n++; if (!ok) { bad++; console.log(`FAIL  ${name}  -> ${got}`); } else console.log(`PASS  ${name}  (${got})`); };

  // ── Positive controls: a bone LONGER than its caps must emit a side and not poke.
  let r = classifyPreFix(1.0, 0.2, 0.3);
  t('long bone emits a side', r.hasSide === true, r.hasSide);
  t('long bone does not overhang its joint', r.pokeUp === 0, r.pokeUp);

  // ── The bug: donut's own pre-fix numbers from `fb9d9da`'s table (upper arm).
  r = classifyPreFix(0.209, 0.151, 0.130);
  t('0.209 m bone with 0.281 m of cap emits NO side', r.hasSide === false, r.hasSide);
  t('...and overhangs its joint by 0.072 m', Math.abs(r.pokeUp - 0.072) < 5e-4, r.pokeUp.toFixed(4));

  // ── THE BOUNDARY, both directions. A classifier with `>` instead of `>=`, or one
  // off by an epsilon, passes every case above and fails exactly here.
  r = classifyPreFix(0.50, 0.25, 0.25);
  t('ratio exactly 1.0 still emits a side (>=, not >)', r.hasSide === true, r.ratio.toFixed(4));
  r = classifyPreFix(0.50, 0.25, 0.2500001);
  t('a hair over 1.0 does NOT', r.hasSide === false, r.ratio.toFixed(7));

  // ── KNOWN-BAD INPUT: the wrong test. `len < rTop` (or `len < 2*max`) is the
  // plausible mis-derivation. Here len 0.30 > rTop 0.18 and > rBot 0.18, so that
  // wrong test says "fine" — while the real condition (0.36 > 0.30) says BALL.
  r = classifyPreFix(0.30, 0.18, 0.18);
  t('a case `len < rTop` would MISS is caught by rTop+rBot', r.hasSide === false, `ratio ${r.ratio.toFixed(3)}`);
  t('...and its overhang is 0.06 m', Math.abs(r.pokeUp - 0.06) < 1e-9, r.pokeUp.toFixed(4));

  // ── THE BODY-SURFACE PROBE, against a synthetic body whose answer is a constant ──
  // A cylinder of radius 0.2016 (lollipop's own `stickR`), built EXACTLY the way the
  // shipped stick is built — `heightSegments = 1` — so it has vertices only at its
  // two end rings. The probe is fired at its MIDDLE, where those rings are not.
  const STICK_R = 0.2016, STICK_H = 1.0;
  const scene = new THREE.Object3D();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(STICK_R, STICK_R, STICK_H, 16, 1, false));
  body.name = 'synthetic_stick';
  scene.add(body);
  // A thin ring far outside it, at the same height — the wrapper collar's role. The
  // old method returned THIS and called it the body.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.03, 6, 18));
  ring.name = 'wrapper_collar';
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  scene.updateWorldMatrix(true, true);

  const rayHit = bodySurfaceX(THREE, scene, ['synthetic_stick'], 1, 0.0, 0.0, 10);
  // ⚠️ A 16-gon inscribed in a circle: a ray along x at z=0 hits a FLAT FACE whose
  // centre is at the full radius, so the expected answer is exactly STICK_R.
  t('raycast finds the low-tessellation body at its mid-height',
    Math.abs(rayHit.x - STICK_R) < 1e-6, `${rayHit.x.toFixed(6)} on ${rayHit.mesh}`);
  t('...and it is the STICK it found, not the ring outside it',
    rayHit.mesh === 'synthetic_stick', rayHit.mesh);

  // KNOWN-BAD INPUT #1: the ray with the target list widened to "anything that is
  // not a limb" — i.e. the mistake the vertex scan made, reproduced in the NEW code
  // path. It must come back with the ring, not the body. This is what makes
  // `bodyNames` a required argument rather than a convenience.
  const wideHit = bodySurfaceX(THREE, scene, ['synthetic_stick', 'wrapper_collar'], 1, 0.0, 0.0, 10);
  t('a ray allowed to hit the ring reports the RING, not the body (hence bodyNames)',
    Math.abs(wideHit.x - 0.50) < 1e-6, `${wideHit.x.toFixed(4)} on ${wideHit.mesh}`);
  // ...and it must REFUSE rather than answer 0 when nothing matches, because a
  // half-width of 0 silently reads as "the body has no width here" and would make
  // every bridge look catastrophically negative.
  const noHit = bodySurfaceX(THREE, scene, ['no_such_mesh'], 1, 0.0, 0.0, 10);
  t('an unmatched body name REFUSES instead of returning a plausible 0',
    /refusing/i.test(noHit.mesh ?? ''), noHit.mesh);

  // KNOWN-BAD INPUT #2: the method this replaced, on the identical scene. It must
  // FAIL — both by missing the body entirely and by answering with the ring.
  const slabHit = bodyHalfWidthByVertexSlab(THREE, scene, 0.0, 0.0, 0.043);
  t('the OLD vertex-slab method is WRONG here (this assertion fails if it was fine)',
    Math.abs(slabHit - STICK_R) > 0.2, `slab said ${slabHit.toFixed(4)}, truth ${STICK_R}`);
  t('...and specifically it returns the thin ring outside it',
    Math.abs(slabHit - 0.50) < 0.02, slabHit.toFixed(4));

  // Positive control for the slab method, so the assertion above is not simply
  // "this function always disagrees": at the cylinder's own END ring it is correct.
  const slabEnd = bodyHalfWidthByVertexSlab(THREE, scene, -STICK_H / 2, 0.0, 0.005);
  t('...and the slab method IS right at the end ring, so it is height-blind, not broken',
    Math.abs(slabEnd - STICK_R) < 1e-6, slabEnd.toFixed(6));

  // The bridge sign convention, hand-derived: joint at 0.270, limb top radius 0.1178,
  // body at 0.2016 -> inner edge 0.1522, so 0.0494 m INSIDE. And the shipped value
  // (joint 0.340, limb top 0.0818) -> inner edge 0.2582, i.e. 0.0566 m OUTSIDE.
  const bridge = (jointX, rTopA, surf) => surf - (Math.abs(jointX) - rTopA);
  t('bridge is POSITIVE when the limb overlaps', Math.abs(bridge(0.270, 0.1178, 0.2016) - 0.0494) < 5e-5, bridge(0.270, 0.1178, 0.2016).toFixed(4));
  t('bridge is NEGATIVE when it does not', Math.abs(bridge(0.340, 0.0818, 0.2016) + 0.0566) < 5e-5, bridge(0.340, 0.0818, 0.2016).toFixed(4));

  console.log(`\ncb_rig --selftest: ${n - bad}/${n} passed`);
  process.exit(bad ? 1 : 0);
}

const vite = await createServer({
  // `noDiscovery` for the same reason `ch_sushi_geom.mjs` carries it: Vite's dep
  // SCANNER crawls the WHOLE project, so a peer mid-edit in a file this probe never
  // opens kills it, and the failure presents exactly like your own break.
  root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const { CHARACTERS } = await vite.ssrLoadModule('/src/game/rules.ts');
const mods = {
  egg: ['/src/characters/egg.ts', 'EggCharacter'],
  lollipop: ['/src/characters/lollipop.ts', 'LollipopCharacter'],
  donut: ['/src/characters/donut.ts', 'DonutCharacter'],
  sushi: ['/src/characters/sushi.ts', 'SushiCharacter'],
};

/**
 * The mesh an arm or a leg on this character has to ATTACH TO. Named, not inferred
 * — see `bodySurfaceX`. `startsWith`, so a character that splits its body into
 * `donut_ring_a`/`donut_ring_b` still matches on the stem.
 */
const BODY_MESHES = {
  egg: ['egg_shell', 'egg_torso_shell'],
  lollipop: ['lollipop_stick'],
  donut: ['donut_ring', 'donut_glaze'],
  sushi: ['sushi_rice', 'sushi_torso'],
};

const ATTACH = process.argv.includes('--attach');
const idsArg = process.argv.includes('--ids') ? process.argv[process.argv.indexOf('--ids') + 1] : null;
const ids = (idsArg ? idsArg.split(',') : Object.keys(mods)).filter((i) => mods[i]);

console.log('char      bone        len     armR/legR   ratio(1.0=ball threshold on the PRE-FIX helper)');
for (const id of ids) {
  const [path, cls] = mods[id];
  const mod = await vite.ssrLoadModule(path);
  const ch = new mod[cls](CHARACTERS[id]);
  const m = ch.rig?.metrics ?? ch.rig?.getMetrics?.();
  if (!m) { console.log(`${id}: no rig metrics reachable`); continue; }
  const rows = [
    ['upperArm', m.upperArmLength, m.armRadius],
    ['forearm', m.forearmLength, m.armRadius * 0.92],
    ['thigh', m.thighLength, m.legRadius],
    ['shin', m.shinLength, m.legRadius * 0.9],
  ];
  console.log(`${id}   headR=${m.headRadius.toFixed(3)} shoulderW=${m.shoulderWidth.toFixed(3)} stanceW=${m.stanceWidth.toFixed(3)} armR=${m.armRadius.toFixed(4)} legR=${m.legRadius.toFixed(4)} handR=${m.handRadius.toFixed(4)} hipY=${m.hipY.toFixed(3)} shoulderY=${m.shoulderY.toFixed(3)} armClearance=${(m.armClearance ?? NaN).toFixed?.(4)}`);
  for (const [name, len, rad] of rows) {
    console.log(`   ${name.padEnd(9)} len=${len.toFixed(4)}  rigRadius=${rad.toFixed(4)}  len/(2r)=${(len / (2 * rad)).toFixed(3)}`);
  }

  if (!ATTACH) continue;
  const root = ch.root ?? ch.body;
  root.updateWorldMatrix(true, true);
  const j = ch.rig.joints;
  const wp = new THREE.Vector3();
  // The AUTHORED top radius of the proximal segment, recovered from the BUILT mesh
  // rather than from the call site, so it stays true when the multiplier is retuned.
  const topRadiusOf = (jointName) => {
    const jt = j[jointName];
    if (!jt) return 0;
    let r = 0;
    const v = new THREE.Vector3();
    jt.traverse((o) => {
      if (!o.isMesh || o.name.endsWith('__outline')) return;
      const pos = o.geometry?.attributes?.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (v.y > -1e-3 || v.y < -0.02) continue;  // `taperedSegment` hangs from y=0
        r = Math.max(r, Math.hypot(v.x, v.z));
      }
    });
    return r;
  };
  for (const jointName of ['shoulderL', 'shoulderR', 'hipL', 'hipR']) {
    const jt = j[jointName];
    if (!jt) continue;
    jt.getWorldPosition(wp);
    const rTop = topRadiusOf(jointName);
    const { x: surf, mesh } = bodySurfaceX(THREE, root, BODY_MESHES[id] ?? [], Math.sign(wp.x) || 1, wp.y, wp.z, 12);
    const bridge = surf - (Math.abs(wp.x) - rTop);
    console.log(`   ${jointName.padEnd(9)} jointX=${wp.x.toFixed(4)} y=${wp.y.toFixed(4)} limbTopR=${rTop.toFixed(4)} bodyX=${surf.toFixed(4)} (${mesh}) -> bridge=${bridge >= 0 ? '+' : ''}${bridge.toFixed(4)} m${bridge < 0 ? '   <-- GAP' : ''}`);
  }
}

await vite.close();
