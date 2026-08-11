/**
 * SILHOUETTE EVENTS — the shared kit for outline appendages.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * `tools/tmp/limbmatch.mjs` measures three things on the character MASK that can
 * also be measured on a Brawl Stars plate, because they are properties of the mask
 * rather than of our renderer: hull deficiency, appendage COUNT and appendage
 * share. Measured in the live match at the shipped camera (58 deg) and the shipped
 * spawn facing (yaw 90, exact profile):
 *
 *   hull deficiency   cast 0.1379 mean   vs   six BS plates: min 0.2007, median 0.2617
 *   appendages        cast 0.5 mean, ZERO on eight of eleven   vs   median 2.5
 *
 * A blind critic, in the same round and without seeing any of that, named the same
 * quantity as its number-one fix: *"Break the circular top-down outline ... roughly
 * a quarter to a third of the outline area should come from non-body parts"* and
 * *"every character in the fox game has 3-5 shape events on its outline — ear
 * points, tail mass, hat corners, weapon. The egg has zero."* Two instruments, one
 * blind and one calibrated, converging on one number.
 *
 * ── The arithmetic that decides what works, and it is NOT intuition ──────────
 * The match camera pitches **58 deg**, so a metre of world offset buys a very
 * different amount of screen depending on its DIRECTION:
 *
 *   straight up (+Y)          x cos 58 = 0.53 of a screen-metre, and it has to
 *                             climb over the food mass first
 *   sideways or fore/aft      x 1.00 (screen-x) or x sin 58 = 0.85 (screen-y),
 *                             and it starts at the mass's WIDEST point
 *
 * That is why the predecessor's pose sweep was worth nothing (rotating a 0.37 m
 * STOUT arm inside a 0.5 m bowl never leaves the mass) and why widening the stance
 * worked. **A silhouette event has to leave the mass HORIZONTALLY.** Every builder
 * here is therefore authored to be aimed outward from the mass's own bounding box,
 * not stacked on top of it.
 *
 * ── What the metric counts, so a feature can be sized to register ────────────
 * `appendages` = connected components of `mask - opening(mask, k)` with area
 * >= 0.6% of the mask, where `k = 0.045 x the silhouette's own bbox height`. At the
 * 180-260 px the cast occupies at match framing that is k ~ 8-12 px, i.e. an
 * appendage must be
 *
 *   THIN     narrower than ~2k across at its neck — roughly 0.18 m of world
 *   PROUD    clear of the core by more than k — roughly 0.10 m
 *   BIG      enough area to pass 0.6% of the mask — a rod ~0.3 m long does it
 *
 * A wide flat skirt fails the first test (the opening keeps it, so it reads as
 * more core) and a 5 cm nub fails the second and third. `soup` is the worked
 * example of the failure: it already carries a ladle, a sling and a bib, and it
 * measured **zero** appendages, because all three sit against the torso UNDER a
 * bowl that the 58 deg camera projects straight down over.
 *
 * ── AZIMUTH IS NOT FREE, and this cost a whole measured round to learn ───────
 * The camera's yaw is fixed and the CHARACTER turns, so at any given facing the
 * mass's four quadrants are not equivalent:
 *
 *   the two azimuths PERPENDICULAR to the view project to screen-X. Nothing the
 *     character owns can be in front of them; they are clear on their first
 *     millimetre.
 *   the two azimuths ALONG the view project to screen-Y — the same axis the mass
 *     above them projects along. A feature there has to out-reach the whole mass
 *     before it appears at all.
 *
 * Round 1 of this pass put soup's crock ears and hamburger's lettuce points on the
 * character's own left and right, which is the natural place for both, and at the
 * SHIPPED spawn facing (yaw 90, exact profile) that is the occluded pair: soup came
 * back with 1 appendage and hamburger with 1, both from the one element that
 * happened to sit elsewhere, while donut, burrito, sushi and hotdog — which all
 * happened to carry something at azimuth ~PI — came back with 3, 5, 2 and 3.
 *
 * So the rule is: **spread the events over at least three azimuths including one
 * near 0 or PI, or put them at the TOP of the mass** (`height01` >= 0.9), where
 * there is nothing left above to project over them. Both work; the second is
 * better when the food only has one plausible place for the feature.
 *
 * ── ⚠️ WHAT THIS KIT DOES NOT BUY, MEASURED AFTER THE FACT ───────────────────
 * Two blind critic rounds were run once the cast cleared the reference floor, both
 * VALID (reference panels scored 8/9 and 7/9, inside the 7-9 band `docs/LESSONS.md`
 * §3 requires). Our panels scored **3, 3** on egg and **2, 2** on burrito, against a
 * previous 3.25 — so a cast-mean hull deficiency of 0.1379 -> 0.2621, from below the
 * weakest Brawl Stars plate to their MEDIAN, moved the perceived number not at all.
 * And burrito, which has the best measured outline in the cast (0.334 / 0.4103),
 * scored the LOWEST of the two.
 *
 * **Hull deficiency and appendage count are necessary and they are not sufficient.**
 * Both critics, independently, on two different characters, named the same missing
 * thing, and it is not an appendage:
 *
 *   egg      "no head/body separation ... carve a head out of the ball, shrink it to
 *             ~0.7-0.75 of the body's width and lift it so a visible notch appears on
 *             BOTH sides of the outline, with a 4-6 px pinch at the neck"
 *   burrito  "invert the mass distribution ... head as a distinct sphere sitting proud
 *             of a real shoulder line with a hard dark occlusion notch under the chin"
 *
 * One finding in two costumes: **the cast has no NECK.** Everything in this file is
 * an event on the OUTSIDE of a single undifferentiated mass; the reference's own
 * device is an INTERNAL break that splits the outline into head and body. It would
 * register on the same metric — a pinch is a concavity, and it can separate the head
 * under the morphological opening — so this is a mechanism this pass did not try
 * rather than a metric that is wrong. It is the ranked next item, and it lives in
 * `rig.ts` (`headMount`, the neck joint) and in each character's own mass.
 *
 * Both rounds also named figure/ground — "pale cream on pastel floor tiles of
 * near-identical value, no dark contour, no rim light, no contact shadow beneath it"
 * — which is the THIRD consecutive round to say so and belongs to
 * `src/render/lighting.ts`, not here.
 *
 * ── Traps these builders are written to avoid ────────────────────────────────
 *  * `CapsuleGeometry` degenerates into a SPHERE whenever `len < 2r`
 *    (`docs/LESSONS.md` §12 — it is how a leg once became two balls in a boot).
 *    **Nothing here uses it.** Rods are `CylinderGeometry`, which has no such mode.
 *  * `setFromUnitVectors` picks the shortest arc and leaves a different residual
 *    ROLL per side, which is how Sushi's eyes ended up with a lazy eye. `aim()`
 *    builds an explicit orthonormal basis instead, so a mirrored pair is mirrored.
 *  * "It isn't there" means it is inside the mass (`docs/LESSONS.md` §1, eighteen
 *    times). `localBounds()` measures the mass that is actually built, so a feature
 *    is placed against MEASURED geometry rather than against a remembered radius.
 */

import * as THREE from 'three';

/**
 * The bounding box of every mesh under `root`, expressed in ROOT's own local
 * frame.
 *
 * This is the anti-invisibility device. Placing an appendage at `0.9 * R` is a
 * guess about a mass built by a lathe profile, a displaced cylinder or a stack of
 * spheres; placing it against this box is a measurement of the geometry that was
 * actually built, taken after it was built. `docs/LESSONS.md` §1 lists eighteen
 * occasions on which the guess lost.
 *
 * Note `updateWorldMatrix(true, true)`: the parents have to be current too, or the
 * inverse below is taken against a stale matrix and every point lands somewhere
 * plausible and wrong.
 */
/** True if `o` or any ancestor was built by this file. */
function isEvent(o: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n.userData.silhouetteEvent) return true;
  return false;
}

/**
 * True for a mesh that does not really bear the silhouette: steam, glow, a soft
 * translucent wisp.
 *
 * ── This one cost three measured rounds on soup ──────────────────────────────
 * Soup carries three steam wisps at `opacity 0.3` that rise ABOVE the bowl's rim
 * and sit near the bowl's CENTRE. `localBounds` counted them, so the mass box was
 * taller than the food; `height01 0.90` therefore meant "above the rim", where the
 * ray found steam instead of ceramic and anchored two crock ears and a spoon in the
 * middle of the broth. The symptom was the cleanest possible `docs/LESSONS.md` §5
 * tell: enlarging the ears by a quarter, and then adding an entire second utensil,
 * moved this character's hull deficiency by **0.0000 and 0.0000** at yaw 0 while
 * every other number in the same runs moved. Something that does not move when
 * everything else does is not measuring what you think.
 *
 * `matte`-style probes have the same blind spot for the same reason, which is why
 * the threshold is generous: anything under 0.9 opacity is treated as not-there.
 */
function isGhost(mesh: THREE.Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (!mats.length) return false;
  return mats.every((m) => {
    const mm = m as THREE.Material & { opacity?: number };
    return !!mm && mm.transparent === true && (mm.opacity ?? 1) < 0.9;
  });
}

export function localBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    // Anything this file already built is EXCLUDED, so the box is always the food's
    // and never grows as events are added to it. Without this, a character that
    // mounts two events measures the second one against a box the first one
    // enlarged: water bottle's flip lid asked for 94% of a box whose top was now
    // the nozzle it had just added, found no geometry there, fell back, and shipped
    // as a **908 px floating island**. Same class as the raycast filter in
    // `massAnchor`, one level up.
    if (isEvent(mesh) || isGhost(mesh)) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (!bb) return;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      box.expandByPoint(v.applyMatrix4(m));
    }
  });
  return box;
}

/**
 * Place `obj` at `at` with its own +Y aimed along `dir`, then rolled about that
 * axis by `roll`.
 *
 * Uses an explicit basis rather than `Quaternion.setFromUnitVectors`, which picks
 * the shortest arc from +Y and therefore gives a mirrored pair two DIFFERENT rolls
 * — the exact defect that made Sushi's eyes read as a lazy eye (`docs/LESSONS.md`
 * §12). A flat blade is orientation-sensitive in a way a rod is not, so the basis
 * has to be deterministic.
 */
export function aim(obj: THREE.Object3D, at: THREE.Vector3, dir: THREE.Vector3, roll = 0): void {
  const y = dir.clone().normalize();
  // Reference axis: world up, unless `dir` is nearly parallel to it, in which case
  // use +Z. Without the swap the cross product collapses and the basis is NaN.
  const ref = Math.abs(y.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(ref, y).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  obj.position.copy(at);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  if (roll) obj.rotateY(roll);
  obj.userData.silhouetteEvent = true;
}

/**
 * Both shadow flags on (`types.ts` convention 6) and TAGGED.
 *
 * The tag is load-bearing: `massAnchor` finds the food's surface by casting a ray
 * at it, and a character that mounts four drips in a loop would otherwise have the
 * fourth ray stop on the first drip. Anything this file builds is therefore
 * invisible to that ray.
 */
function solid(mesh: THREE.Mesh): THREE.Mesh {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.silhouetteEvent = true;
  return mesh;
}


/**
 * A tapered rod along +Y with its base at the group origin.
 *
 * `CylinderGeometry`, deliberately, not `CapsuleGeometry`: the capsule collapses to
 * a sphere whenever `len < 2r` and every appendage in this file is short and thick
 * enough to be in range of that. A cylinder has no degenerate mode at all.
 */
export function rod(
  mat: THREE.Material,
  o: { len: number; rBase: number; rTip?: number; seg?: number },
): THREE.Mesh {
  const rTip = o.rTip ?? o.rBase * 0.55;
  const g = new THREE.CylinderGeometry(rTip, o.rBase, o.len, o.seg ?? 9, 1);
  g.translate(0, o.len * 0.5, 0);
  return solid(new THREE.Mesh(g, mat));
}

/** A ball, for a rod's terminal knob (a pick's olive, a wrapper bead, a bobble). */
export function knob(mat: THREE.Material, r: number): THREE.Mesh {
  return solid(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat));
}

/**
 * A flat tapered blade in the XY plane extruded through Z: a leaf, a fin, a shell
 * shard, a peeled corner of foil. Root at the origin, tip at +Y, `halfWidth` at the
 * root narrowing to a point.
 *
 * `curl` bends the tip out of plane (+Z) so a leaf reads as a leaf rather than as a
 * paper triangle. It is applied as a vertex displacement rather than a rotation so
 * the root stays exactly where it was aimed.
 */
export function blade(
  mat: THREE.Material,
  o: { len: number; halfWidth: number; thick: number; curl?: number; waist?: number },
): THREE.Mesh {
  const w = o.halfWidth;
  const waist = o.waist ?? 1.15;
  const s = new THREE.Shape();
  s.moveTo(-w * 0.55, 0);
  s.quadraticCurveTo(-w * waist, o.len * 0.42, 0, o.len);
  s.quadraticCurveTo(w * waist, o.len * 0.42, w * 0.55, 0);
  s.lineTo(-w * 0.55, 0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: o.thick, bevelEnabled: true, bevelSize: o.thick * 0.4, bevelThickness: o.thick * 0.4, bevelSegments: 1, curveSegments: 6,
  });
  g.translate(0, 0, -o.thick * 0.5);
  if (o.curl) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = Math.max(0, p.getY(i) / o.len);
      p.setZ(i, p.getZ(i) + o.curl * t * t * o.len);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
  }
  g.computeBoundingBox();
  return solid(new THREE.Mesh(g, mat));
}

/**
 * A partial torus standing in the XZ plane with its opening facing -Y: a crock ear,
 * a bottle carry-loop, a mug handle. The arc's two ends sit on the local X axis, so
 * aiming the group's +Y outward from the mass leaves the handle standing proud with
 * both roots touching the food.
 */
export function loop(
  mat: THREE.Material,
  o: { radius: number; tube: number; arc?: number },
): THREE.Mesh {
  const arc = o.arc ?? Math.PI * 1.25;
  const g = new THREE.TorusGeometry(o.radius, o.tube, 8, 20, arc);
  // `TorusGeometry` sweeps from angle 0 counter-clockwise in the XY plane, so the
  // GAP is centred at `arc/2 + PI` and we want it at 3PI/2 (local -Y, i.e. facing
  // back into the food once `aim` points +Y outward). Hence `PI/2 - arc/2`.
  //
  // The first version of this line was `-(arc - PI)/2 - PI/2`, which simplifies to
  // `-arc/2` — exactly PI/2 away from correct, so every handle's two roots pointed
  // TANGENTIALLY along the mass's surface instead of into it. Measured, not
  // spotted: water bottle's carry loop came back as a **910 px island** floating
  // clear of the bottle, and soup's crock ears arced up over the rim like antennae
  // instead of standing out from it. `docs/LESSONS.md` §1 — it rendered, and it
  // rendered plausibly enough that only the island count caught it.
  g.rotateZ(Math.PI * 0.5 - arc * 0.5);
  return solid(new THREE.Mesh(g, mat));
}

/**
 * A tapered tube swept along a curve — a curl of peel, a wrapper twist, a tail, a
 * sauce drip that hooks as it falls.
 *
 * `TubeGeometry` takes ONE radius, so the taper is applied afterwards by scaling
 * each ring toward the curve; that is cheaper and more predictable than lofting,
 * and it keeps the curve itself authoritative.
 */
export function curl(
  mat: THREE.Material,
  pts: THREE.Vector3[],
  o: { rBase: number; rTip?: number; seg?: number },
): THREE.Mesh {
  const rTip = o.rTip ?? o.rBase * 0.3;
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = o.seg ?? 14;
  const RADIAL = 8;
  const g = new THREE.TubeGeometry(curve, seg, o.rBase, RADIAL, false);
  const p = g.attributes.position;
  const centre = new THREE.Vector3();
  const v = new THREE.Vector3();
  // TubeGeometry lays out (seg+1) rings of (RADIAL+1) vertices, ring-major, so a
  // vertex's ring index is exactly `i / (RADIAL+1)` — no search needed.
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (RADIAL + 1));
    const t = ring / seg;
    curve.getPointAt(Math.min(1, t), centre);
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const k = (rTip / o.rBase - 1) * t + 1;
    v.sub(centre).multiplyScalar(k).add(centre);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  return solid(new THREE.Mesh(g, mat));
}

export interface MassAnchorResult {
  at: THREE.Vector3;
  out: THREE.Vector3;
  /**
   * **True when `at` is a point ON THE MASS'S SURFACE.** False means every ray on
   * this azimuth missed and `at` came from the bounding box, which for any
   * non-convex mass is a point that is provably on no surface at all.
   * `taco.ts` states the consequence correctly: *"a `hit: false` from `massAnchor`
   * is a build failure, not noise."*
   */
  hit: boolean;
  /** True when the ray at the EXACT requested azimuth and height hit. */
  exact: boolean;
  /** The `height01` actually used — equal to the request when `exact`. */
  height01: number;
}

export interface MassAnchorEvent {
  /**
   * `fallback` — the ray found nothing, so the anchor came from the bounding box and
   * is on NO SURFACE.
   *
   * ⚠️ The union deliberately keeps one member. A reverted version also emitted
   * `moved` (the ray missed and a nearby height was used); it is gone because it made
   * donut worse, and the reason is written out at the fallback site. Kept as a union
   * so a future recovery has somewhere to report itself instead of being silent.
   */
  kind: 'fallback';
  root: string;
  azimuth: number;
  /** The height01 asked for. */
  requested: number;
  /** The height01 used. Equal to `requested` for a `fallback`. */
  used: number;
}

/**
 * Every anchor that did NOT land where it was asked to, since module load.
 *
 * 🚨 THE POINT OF THIS ARRAY. The fallback below has always warned, and the warning
 * has always gone to a browser console that nothing reads — donut shipped **two**
 * mis-anchored icing drips behind exactly that warning for as long as it has had
 * them. A console line is not a signal; a value a test can assert on is.
 * `tools/tmp/r2_probe.mjs --mode anchor` reads it back off the construction warnings
 * and gates on an ALLOWLIST: the two known donut entries are named with their fix,
 * anything else fails, and a listed entry that stops firing ALSO fails so the list
 * cannot go stale the way six documented counts did in one session.
 *
 * ⚠️ **READ IT AT CONSTRUCTION TIME, NOT AFTERWARDS.** Calling `massAnchor` again on
 * a finished character does NOT reproduce what it did: by then the tree also carries
 * `outlineGroup`'s baked hulls, which this function's filter does not exclude — and
 * a hull is an inverted shell, so it answers the ray where the food does not. A
 * post-hoc re-run of donut's two failing azimuths reports `exact: true` at a surface
 * **0.05 m from the ring's own axis**, i.e. inside the hole. That is the log's
 * reason for existing rather than a nicety.
 */
const ANCHOR_LOG: MassAnchorEvent[] = [];
export function massAnchorLog(): ReadonlyArray<MassAnchorEvent> { return ANCHOR_LOG; }

/**
 * Where an appendage should start and which way it should point, solved by
 * RAYCASTING the food mass at the requested height.
 *
 * `azimuth` is measured in the mass's local XZ plane — 0 is +Z (the direction the
 * character faces, `types.ts` convention 2), +PI/2 is +X. `height01` walks the
 * mass's own bounding box from its bottom (0) to its top (1). The returned point is
 * on the SURFACE at that height and azimuth, pulled inward by `inset` of the local
 * reach so the appendage's root overlaps the food and reads as attached.
 *
 * ── Why a ray and not the bounding box, which is what round 2 used ───────────
 * The box's half-width is the mass's widest half-width, and almost nothing in this
 * cast is a cylinder: a torus at front/back azimuth and mid height has a HOLE
 * there, a bottle at 94% of its height is a narrow cap inside a box sized by its
 * belly, an ovoid at 70% is well inside its own bulge. Anchoring at a fixed
 * fraction of the box therefore placed five of eleven characters' events in fresh
 * air — measured, `limbmatch` came back with **two islands** on donut, burrito,
 * egg, pizza and waterbottle where the whole cast had had one, which is the
 * detachment failure the shoulder-widening route was rejected for, reintroduced
 * from the other end.
 *
 * A ray asks the geometry instead of guessing at it, at construction time, for
 * free. It is the same principle as `localBounds`, one level finer.
 *
 * `root` must be the joint the appendage will be parented to; everything this file
 * has already built under it is skipped, so a loop that mounts four drips cannot
 * have the fourth land on the first.
 */
export function massAnchor(
  root: THREE.Object3D,
  box: THREE.Box3,
  o: { azimuth: number; height01: number; inset?: number },
): MassAnchorResult {
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const inset = o.inset ?? 0.25;
  const sx = Math.sin(o.azimuth), cz = Math.cos(o.azimuth);
  const out = new THREE.Vector3(sx, 0, cz).normalize();
  const span = Math.max(s.x, s.z) * 1.5 + 1e-3;

  root.updateWorldMatrix(true, true);
  const dir = out.clone().negate().transformDirection(root.matrixWorld).normalize();
  const shoot = (h01: number): THREE.Vector3 | null => {
    const y = box.min.y + s.y * h01;
    const from = new THREE.Vector3(c.x + sx * span, y, c.z + cz * span);
    const rc = new THREE.Raycaster(root.localToWorld(from.clone()), dir.clone(), 0, span * 2.2);
    const hits = rc.intersectObject(root, true)
      .filter((hh) => !isEvent(hh.object) && !isGhost(hh.object as THREE.Mesh));
    return hits.length ? root.worldToLocal(hits[0].point.clone()) : null;
  };

  const finish = (surface: THREE.Vector3, h01: number, exact: boolean): MassAnchorResult => {
    const reach = Math.hypot(surface.x - c.x, surface.z - c.z);
    return { at: surface.addScaledVector(out, -inset * Math.max(reach, 1e-3)), out, hit: true, exact, height01: h01 };
  };

  const direct = shoot(o.height01);
  if (direct) return finish(direct, o.height01, true);

  // ── 🔴 THE MASS IS NOT ON THAT RAY, AND THE BOX POINT IS IN MID-AIR ─────────
  // Donut is the worked example and it is arithmetic, not bad luck: its head is a
  // TORUS whose hole faces +Z, so at a front or back azimuth the ray fired through
  // the mass's own centre travels **down the hole** and leaves the far side having
  // touched nothing, at every height between the hole's two lips. Two of its four
  // icing drips (azimuth 0.90PI at height01 0.48, and -0.86PI at 0.40) are anchored
  // that way on a point that is on no surface, and until now nothing but a console
  // line said so.
  //
  // ── ⚠️ A SEARCH WAS BUILT HERE, RENDERED, AND REVERTED. THE NUMBER THAT ─────
  // ── KILLED IT IS IN `shots/r2/after/donut_p58.png` ──────────────────────────
  // It held the azimuth and swept `height01` nearest-first in 0.02 steps until a ray
  // hit — which is exactly the recovery `burrito.ts` writes BY HAND at its own call
  // site, so it looked like promoting a decision the cast had already made. It
  // worked, by its own contract: both of donut's anchors landed ON the surface, 0.04
  // of the mass's height from where they were asked for, and `massAnchorLog()` went
  // to zero fallbacks.
  //
  // **And it made the character worse.** The surface a hole-axis ray first meets is
  // the hole's INNER LIP — measured 0.007 m and 0.033 m from the ring's own axis —
  // so the drips were relocated INTO the hole and, at the match camera looking down
  // into it, render as a pink shard with a dark socket at its root standing in the
  // middle of the donut. 6,615 px moved at pitch 20 and 6,629 at pitch 58, and the
  // p58 frame is unambiguous next to `shots/r2/before/donut_p58.png`. That is
  // donut.ts's own documented "horn" read, arriving from the one direction the lobby
  // views cannot see, plus the uncapped-tube socket its `curl` comment already warns
  // about.
  //
  // So the honest position is the one this file already had, minus the silence:
  // **there is no mass on that ray, a bounding-box point is the only thing left, and
  // the FIX belongs to the caller** — donut should ask for those two drips at an
  // azimuth where its ring exists, which is a character-file decision. What changes
  // here is that the failure is now a value a test asserts on rather than a console
  // line: see `massAnchorLog()` and `tools/tmp/r2_probe.mjs --mode anchor`.
  //
  // `docs/LESSONS.md` §13: an instrument that fails quietly is worse than none.
  ANCHOR_LOG.push({
    kind: 'fallback', root: root.name || '(unnamed)', azimuth: o.azimuth, requested: o.height01, used: o.height01,
  });
  console.warn(`[appendages] NO MASS at azimuth ${o.azimuth.toFixed(2)} height01 `
    + `${o.height01.toFixed(2)} on ${root.name || '(unnamed)'} — anchor fell back to the bounding `
    + 'box and is NOT ON ANY SURFACE. Move the azimuth to where this mass exists.');
  const y = box.min.y + s.y * o.height01;
  return {
    at: new THREE.Vector3(c.x + sx * s.x * 0.5 * (1 - inset), y, c.z + cz * s.z * 0.5 * (1 - inset)),
    out,
    hit: false,
    exact: false,
    height01: o.height01,
  };
}
