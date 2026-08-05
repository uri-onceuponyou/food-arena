/**
 * Taco (Rare).
 *
 * Built on the shared ChibiRig — see `donut.ts` for the reference implementation of
 * this pattern. The rig supplies torso, arms, hands, legs, feet and all motion; this
 * file authors only the food mass on `rig.joints.head`, the face and a palette.
 *
 * Identity is fixed by `rules.ts`: Taco, Rare rarity, Filling Toss / Onion Bomb /
 * Double Toss.
 *
 * ── Where this file departs from the written description, and why ────────────
 * The 2D note reads "trapezoid shell, jagged crimped top edge, face floats
 * outside the shell to the side". All three were implemented literally and all
 * three were wrong on screen:
 *
 *   - the TRAPEZOID read as a paper bag; a taco's signature is a crescent, so
 *     the wall outline is now a U with two horns and a dipped mouth;
 *   - the JAGGED crimp read as a crown, because tall spikes are the loudest
 *     thing in any silhouette and became the shape people named. It is a small
 *     ripple now;
 *   - the FLOATING FACE read as a second head — a pale ball with eyes sitting
 *     beside a brown mass, so the eye picked the ball as the character and the
 *     shell as scenery. The face is now front and centre on the near wall.
 *
 * The brief explicitly allows treating these notes as personality guides rather
 * than literal specs. What is kept is the intent behind them: a hard, crisp,
 * fried shape with an open crimped mouth and a cheeky expression.
 */

import * as THREE from 'three';
import { BaseCharacter, type AnimContext } from './types';
import type { CharacterDef } from '../game/rules';
import { PALETTE } from '../game/rules';
import { toonMat, glossyMat, flatMat, outlineGroup, roundedBox } from '../render/toon';
import { ChibiRig } from './rig';
import { bodyType } from './bodies';

// ── Palette ──────────────────────────────────────────────────────────────────
const SHELL = '#F2A73E';       // toasted hard-shell gold — bright, saturated
const SHELL_DARK = '#D07F1E';  // shadow / crease tone
// The cheek pad's tone. Deliberately only a HAIR lighter than SHELL: at a
// bigger gap the pad stopped reading as a swelling in the wall and started
// reading as a separate pale ball sitting inside a container, which put the
// character's identity back on the wrong object again.
const POD = '#F4AE46';
const MEAT = PALETTE.patty;        // '#6B3E26'
const MEAT_DARK = PALETTE.pattyDark; // '#4E2C1B'
const TOMATO = PALETTE.tomato;       // '#E63946'
const LETTUCE = '#8FCB1E';
const LETTUCE_DARK = '#6FA112';
const ONION = '#AD82D6';       // ties visually to the Onion Bomb projectile colour — kept saturated
                                // enough not to read as another tomato bit at a glance
// Limb-only rust family. A second independent art-director pass found Hamburger's
// bun-amber, Donut's dough-tan and Taco's own shell-gold all sitting in the same
// golden-orange hue band despite different heads — the "one templated body" read
// survived per-character geometry because every limb was still the same colour
// family. The HEAD keeps its golden shell (that's the "hard taco shell" read), but
// the limbs shift to a deeper, redder terracotta — extra-crispy fried-edge shell —
// which is a distinctly different hue from both castmates above.
const LIMB_SHELL = '#C1522B';
const LIMB_SHELL_DARK = '#8F3A1D';

/**
 * Shell wall outline: a rounded fold at the bottom rising to a wide open mouth,
 * with a gently SCALLOPED top edge.
 *
 * ── Why this replaced a jagged trapezoid ────────────────────────────────────
 * The first version was a narrow-bottomed trapezoid whose top edge carried
 * sharp triangular teeth 0.30R tall. Rendered as a black silhouette it read as
 * a CROWN, and in colour it read as a torn paper bag — the one thing it never
 * read as was a taco. Two causes, both in this outline:
 *
 *   1. Tall sharp spikes are the loudest thing in a silhouette, so they became
 *      the shape the eye named. A real hard-shell taco has a crimped edge, and
 *      "crimped" is a small repeating WAVE, not a row of fangs. Scallops carry
 *      the same crinkle-fried read at a fraction of the silhouette budget.
 *   2. The bottom came to a near point (0.16R half-width), which is a wedge —
 *      pizza's shape, and pizza is in the same five-character cohort. A taco
 *      folds around a ROUNDED bottom; that curve is the half of the outline
 *      that actually distinguishes the two foods, and it was missing.
 *
 * ── Then it read as a PAPER BAG, and the missing thing was the arc ──────────
 * A blind critic's verdict on the scalloped-trapezoid version was exact: "the
 * shell is a flat rectangular slab with a straight vertical fold — there is no
 * taco arc anywhere in the silhouette." True. Rounding only the bottom left the
 * sides near-vertical for most of their run and the mouth dead flat, which is
 * an envelope. A taco's signature is a CRESCENT: two horns up at the corners,
 * the opening dipping between them, the mass bellying out below.
 *
 * So the top edge now dips parabolically to `dipFrac` of the wall height at
 * centre, and the outer edges bow OUT on their way down before turning into the
 * bowl. That single change is what puts a nameable food shape in the outline —
 * and it also opens a window in the middle of the near wall for the fillings to
 * show through, which no amount of moving the fillings could achieve while the
 * rim was a straight line above them.
 *
 * Baking the crimp into the outline rather than gluing teeth on afterward keeps
 * the whole wall one solid mesh, so no part of it can float off the surface.
 */
function tacoShellShape(halfW: number, yBot: number, yTop: number, dipFrac: number, crimp: number): THREE.Shape {
  const shape = new THREE.Shape();
  const h = yTop - yBot;
  const dip = h * dipFrac;
  shape.moveTo(-halfW, yTop);
  // Outer edge: sweeps down and slightly OUT before turning into the bowl, so
  // the widest point of the wall is up near the horns rather than at the waist.
  shape.quadraticCurveTo(-halfW * 1.05, yBot + h * 0.36, -halfW * 0.60, yBot + h * 0.04);
  shape.quadraticCurveTo(0, yBot - h * 0.06, halfW * 0.60, yBot + h * 0.04);
  shape.quadraticCurveTo(halfW * 1.05, yBot + h * 0.36, halfW, yTop);
  // Top edge DIPS toward the centre — this is the crescent. Walked right → left
  // as a fine polyline with a small ripple riding on it, which gives the crimped
  // fried edge without the ripple ever becoming the shape the eye names.
  const N = 12;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const x = halfW - 2 * halfW * t;
    const u = x / halfW;
    shape.lineTo(x, yTop - dip * (1 - u * u) + crimp * Math.abs(Math.sin(t * Math.PI * 3)));
  }
  return shape;
}

/**
 * A rounded limb segment, like a capsule but with INDEPENDENT top and bottom
 * radii, hanging DOWN from the joint origin (spans y=0..-len) — the orientation
 * `dressLimbs()` expects. Local to this file; see `hamburger.ts` for the
 * reference copy. Taco's own call sites use a low `radialSegments` and a
 * flattened Z scale so the limb reads as a faceted, crunchy shell shard rather
 * than the smooth rubbery capsule every other character in the cast would get
 * from the same helper at default settings.
 */
function taperedSegment(len: number, rTop: number, rBot: number, radialSegments = 12): THREE.BufferGeometry {
  // Profile MUST be wound bottom-to-top (y increasing), matching every other
  // lathe helper in this cast (`bunDome`, `roundedPuck` in `hamburger.ts`) —
  // LatheGeometry's face winding (and therefore `computeVertexNormals`'s
  // outward-vs-inward call) depends on point order, not just point position. An
  // earlier version of this function built the profile top-to-bottom and every
  // limb using it rendered near-black: inverted normals facing away from the
  // light. The y=0/y=-len hang-down placement is unchanged.
  const capSegs = 4;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -len)];
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot, -len + rBot - Math.cos(a) * rBot));
  }
  const yBotCap = -len + rBot;
  const yTopCap = -rTop;
  if (yTopCap >= yBotCap) {
    const sideSteps = 3;
    for (let i = 1; i <= sideSteps; i++) {
      const t = i / sideSteps;
      pts.push(new THREE.Vector2(THREE.MathUtils.lerp(rBot, rTop, t), THREE.MathUtils.lerp(yBotCap, yTopCap, t)));
    }
  }
  const yTopSafe = Math.max(yTopCap, yBotCap);
  for (let i = 1; i <= capSegs; i++) {
    const a = (Math.PI / 2) * (i / capSegs);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop, yTopSafe + Math.sin(a) * rTop));
  }
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

export class TacoCharacter extends BaseCharacter {
  private rig: ChibiRig;
  private fillings: THREE.Object3D[] = [];
  private fillingBaseRotZ: number[] = [];

  constructor(def: CharacterDef) {
    super(def);

    this.rig = new ChibiRig({
      palette: {
        limb: LIMB_SHELL,
        hand: ONION,  // saturated purple — ties to Onion Bomb, breaks from the cast's
                       // repeated cream/white mitt, per the same review pass above
        foot: SHELL_DARK,
        torso: SHELL,
        limbRoughness: 0.8,
      },
      // Body: STOUT archetype (see `bodies.ts`) — short wide torso, thick short
      // limbs, wide planted stance.
      //
      // This reverses an earlier hand-tune that pushed Taco "lean and angular,
      // longer limbs" via `height: 2.30`, which was the only lever the old rig
      // gave for limb length. A taco shell is a WIDE, low, heavy form; the lean
      // body was fighting the food's own shape class, and the silhouette test
      // showed it landing in the same generic middle as everything else anyway.
      // `headFraction` is raised so the shell (which spans -1.20R to +0.85R, far
      // from the spherical mass the rig assumes) still reaches cast height.
      // `headFraction` is raised because a folded shell is nothing like the ±R
      // sphere the rig assumes: the mass runs from -1.05R to about +0.5R once
      // the walls are tilted back, so R has to grow for the crimp to reach the
      // cast's ~2.10 m standing height. Verified with `shoot.mjs --char taco`,
      // which prints the real bounding height — not guessed.
      proportions: bodyType('stout', { headFraction: 0.52 }),
      // ── Both elbows were tucked INSIDE the shell ────────────────────────────
      // The old -0.75 / -0.85 elbows plus a +0.20 / -0.45 shoulder pair swung both
      // forearms across the body and behind the shell: measured delivery 0.286
      // (left forearm) and 0.000 (right forearm, i.e. every pixel of it occluded),
      // with the right mitt down at 0.344. "Both fists cocked" was authored and
      // never reached the screen.
      //
      // The eager, forward-committed read is carried by `lean` (0.16, still the
      // most forward-committed in the cast) and by the shoulders' remaining
      // asymmetry, not by folding the arms into the food.
      // Leaning forward, eager — weight already committed toward the fight, both
      // fists cocked like she's about to toss filling. An art director's second
      // pass named the cast's identical dead-front symmetric pose as a top gap;
      // this is the most forward-committed lean in this file's cast, matching
      // a character built entirely around throwing things.
      // `headTurn` pushed from -0.05 to -0.24: a wide flat-fronted mass presented
      // dead square to camera reads as a signboard. Turning it a little shows the
      // fold's own thickness and the far wall behind the near one, which is what
      // makes the shape read as a container with a front and a back rather than
      // as a cut-out.
      stance: {
        // -0.05 barely opened at all and the left thigh measured 0.329 delivered with
        // only 0.206 of it covered by the shell — the occluder is the mitt, not the food.
        shoulderL: -0.18, shoulderR: 0.28,
        elbowL: -0.50, elbowR: -0.45,
        twist: 0.05, headTilt: -0.07, headTurn: -0.24,
        hipSway: -0.04, lean: 0.16,
      },
    });
    this.body.add(this.rig.joints.root);
    this.head = this.rig.joints.head;

    const R = this.rig.headRadius;
    const head = this.rig.joints.head;

    // ── Materials ────────────────────────────────────────────────────────────
    // Every filling gets its own roughness so the fold reads as bread + seared meat +
    // wet vegetables rather than one glossy plastic shader repeated in different hues.
    const shellMat = toonMat({ color: SHELL, roughness: 0.8 });        // crisp, dry, fried shell
    const shellDarkMat = toonMat({ color: SHELL_DARK, roughness: 0.8 });
    const podMat = toonMat({ color: POD, roughness: 0.76 });
    const meatMat = toonMat({ color: MEAT, roughness: 0.55 });         // seared, faintly greasy
    const meatDarkMat = toonMat({ color: MEAT_DARK, roughness: 0.5 });
    const tomatoMat = glossyMat({ color: TOMATO, roughness: 0.18 });   // wettest surface on the model
    const lettuceMatA = toonMat({ color: LETTUCE, roughness: 0.6 });   // leafy, satin not shiny
    const lettuceMatB = toonMat({ color: LETTUCE_DARK, roughness: 0.6 });
    const onionMat = glossyMat({ color: ONION, roughness: 0.32 });     // moist, faintly translucent

    // ── Shell ────────────────────────────────────────────────────────────────
    // A wide, jagged-topped trapezoid — the "hard shell taco" read at a glance — but
    // NOT one flat panel. Round 1 built it as a single extruded slab and it disappeared
    // to a thin featureless blade from every angle except near-front (idle_135/210
    // showed nothing but a flat gold triangle). Fixed by splitting it into two full
    // panels hinged at the bottom crease and tilted apart around that hinge like an
    // open book: the front wall leans toward the camera, the back wall leans away.
    // From the front this still reads as a solid shell; from the side/back the "V"
    // itself is now the silhouette, with real width in every direction.
    //
    // ── Head-attachment fix (floating-head defect) ──────────────────────────
    // `ChibiRig.headCentreY` places the head group's own origin at
    // `torsoTopY + 0.86*R`, which assumes a mass extending roughly symmetrically
    // ±R about that origin (true for a sphere-like donut ring or egg shell) —
    // the same trap `hamburger.ts` and `hotdog.ts` document. The shell's hinge
    // crease (its lowest point, at `yBot`) sits at head-local y = `hingeY`, so
    // its ABSOLUTE y is `headCentreY + hingeY`. At the old `yBot = -R*0.85` that
    // put the crease almost exactly ON `torsoTopY` (0.86R - 0.85R ≈ 0.01R) —
    // which looks right IF the torso actually reached its own full nominal
    // height. It doesn't: `dressTorso`'s `size.h` is read off the RIG's default
    // torso mesh bounding box, which only spans ~0.92 of the real torso height
    // (the sphere-derived default tapers before its poles), and this file's own
    // torso fold shape only climbs to ~0.82-0.94 of THAT already-short `size.h`
    // before its crimp teeth. Net effect: the tallest point of the dressed torso
    // fold lands a good 15-20% of the torso height below `torsoTopY` — exactly
    // the visible gap between shell and body the brief calls out, and it was
    // invisible dead-on (idle_0) but opened up at yaw/mid-stride because the
    // hinge crease is a narrow line (`halfWBot` wide), not a flat base, so a
    // small viewing-angle change is enough to see past it into the gap behind.
    // Fix: push the hinge crease further down (more negative `yBot`) so it sinks
    // safely BELOW the torso fold's own tallest crimp teeth instead of sitting
    // exactly at the torso's theoretical (but unreached) full height — the same
    // "anchor the mass's own underside, not the rig's assumed centre" reasoning
    // hamburger's BASE_Y and hotdog's neck block both use. `yTopBase` (the
    // shell's opening/pod region) is untouched, so the visible silhouette above
    // the crease — fillings, pod, face — is unaffected; only the hidden portion
    // below the opening gets longer, self-embedding into the torso fold.
    // Wider and shorter than the first two passes. A taco is a WIDE, low form;
    // at 0.94R half-width over a 1.67R span the shell came out taller than it
    // was broad, which is most of why it kept reading as a container rather
    // than as food.
    const halfWTop = R * 1.06;
    const yBot = -R * 0.95;
    // ── The two walls are DIFFERENT HEIGHTS, and that is the load-bearing part ─
    // Built identical, the near wall's rim always sits higher on screen than
    // anything in the fold behind it — so the fillings, the one thing that says
    // "this is a taco and not a paper bag", were completely occluded and only
    // two stray lettuce tips cleared the crimp. Dropping the FRONT wall and
    // raising the back one opens the mouth toward the camera: meat, tomato and
    // lettuce now stack visibly above the near rim, in that order, with the tall
    // back wall behind them as the backdrop that keeps them reading as contained.
    const frontTopY = R * 0.48;
    const backTopY = R * 0.76;
    const panelThickness = R * 0.17;
    const hingeY = yBot;

    // ── Which way the walls lean, and why it is a LIGHTING decision ──────────
    // Both walls used to splay symmetrically about vertical: front +0.44 rad
    // (top toward camera), back -0.44. Rotating a panel's top toward the camera
    // tips its outward normal DOWN — away from a key light that comes from above
    // — so the front wall, the single largest surface on this character and the
    // one nearest the lens, rendered as a huge flat near-black-brown mass filling
    // the middle of the frame. The bright orange the eye actually found was the
    // BACK wall behind it, which is why the shape read as a crown: the only lit
    // part of the shell was its rear crimp.
    //
    // Both walls now lean BACK, the front only slightly and the back much
    // further. That does three things at once: the front wall's normal tilts UP
    // toward both the key and a camera pitched 58 degrees down, so it is lit and
    // presents its full area; the fold still opens (the walls differ by ~21
    // degrees) but opens up-and-away, which is exactly the direction the gameplay
    // camera looks INTO; and the fillings end up on the far side of the front
    // wall's top edge where they read as sitting IN the shell.
    const frontTilt = -0.26;
    const backTilt = -0.62;

    // The NEAR wall dips hard (0.34) — that dip is the window the fillings read
    // through. The far wall barely dips (0.14) so it stands up behind them as a
    // solid backdrop; give both the same dip and the toppings lose their
    // background and float against the sky.
    const wallGeo = (yTop: number, dipFrac: number): THREE.BufferGeometry => {
      const g = new THREE.ExtrudeGeometry(tacoShellShape(halfWTop, yBot, yTop, dipFrac, R * 0.06), {
        depth: panelThickness, bevelEnabled: false, curveSegments: 8,
      });
      g.translate(0, 0, -panelThickness / 2);
      g.computeVertexNormals();
      return g;
    };

    // Front wall — the dominant, camera-facing panel, and now the surface the
    // FACE lives on. Everything mounted on it inherits its tilt for free.
    const frontPivot = new THREE.Group();
    frontPivot.name = 'shell_front_pivot';
    frontPivot.position.set(0, hingeY, 0);
    frontPivot.rotation.x = frontTilt;
    head.add(frontPivot);
    const frontMesh = new THREE.Mesh(wallGeo(frontTopY, 0.34), shellMat);
    frontMesh.name = 'taco_shell_front';
    frontMesh.position.set(0, -hingeY, 0); // re-centres the shape's own yBot back onto the hinge
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    frontPivot.add(frontMesh);

    // Back wall — same geometry, leaning further back, a shade darker so it reads
    // as the shadowed far wall of the fold rather than a plain duplicate.
    const backPivot = new THREE.Group();
    backPivot.name = 'shell_back_pivot';
    backPivot.position.set(0, hingeY, 0);
    backPivot.rotation.x = backTilt;
    head.add(backPivot);
    const backMesh = new THREE.Mesh(wallGeo(backTopY, 0.14), shellDarkMat);
    backMesh.name = 'taco_shell_back';
    backMesh.position.set(0, -hingeY, 0);
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    backPivot.add(backMesh);

    // Everything loose in the fold rides a pivot bisecting the two walls, so
    // filling positions can be authored in plain "up the trough" coordinates
    // instead of each one needing its own hinge solve.
    const troughPivot = new THREE.Group();
    troughPivot.name = 'taco_trough';
    troughPivot.position.set(0, hingeY, 0);
    troughPivot.rotation.x = (frontTilt + backTilt) / 2;
    head.add(troughPivot);
    /** Back-wall length from the hinge to the crimped mouth. */
    const troughLen = backTopY - yBot;

    // ── Fillings: meat, tomato, lettuce, a wink of onion ────────────────────────
    // Sit in the gap between the two walls (z spans from the back wall toward the
    // front one), embedded into whichever wall they're closest to so nothing reads as
    // floating. Positions are given in "natural" (untilted) head-space coordinates —
    // the fillings themselves stay untilted, independent of either wall, which is
    // exactly right for something loose sitting in the pocket between them.
    // Coordinates are now TROUGH-local: `fy` is a fraction of the wall length
    // from the fold (1.0 = the crimped mouth), `fz` a small offset across the
    // gap between the walls. Authoring in the tilted frame is what lets the
    // stack be layered meat → tomato → lettuce by a single number, and it is
    // self-correcting if either wall angle is ever retuned.
    //
    // The meat band is packed dense and wide on purpose: it is what fills the
    // opening. The previous build left the fold's interior empty, and an empty
    // fold under a downward-facing wall is just a dark hole.
    // The `fy` band is set against the FRONT wall's rim, which in trough
    // coordinates sits at about 0.85 — anything below that is behind the near
    // wall and contributes nothing. Meat starts right at the waterline so a
    // little brown reads under the brighter toppings without the fold looking
    // like it is overflowing with beef.
    const meatSpots: Array<[number, number, number, THREE.Material]> = [
      [-0.62, 0.86, 0.24, meatMat], [-0.30, 0.90, 0.08, meatDarkMat], [0.02, 0.88, 0.28, meatMat],
      [0.34, 0.90, 0.10, meatDarkMat], [0.64, 0.86, 0.24, meatMat], [-0.16, 0.84, 0.34, meatDarkMat],
      [0.48, 0.84, 0.34, meatMat], [-0.48, 0.84, 0.02, meatDarkMat],
    ];
    for (const [fx, fy, fz, mat] of meatSpots) {
      // Smaller than the first pass. At 0.23R the meat blobs were the largest
      // objects in the fold and rendered as a row of chocolate truffles; the
      // toppings should sit UNDER the brighter vegetables, not dominate them.
      const blob = new THREE.Mesh(new THREE.SphereGeometry(R * 0.185, 12, 10), mat);
      blob.name = 'taco_meat';
      blob.scale.set(1.15, 0.85, 0.95);
      blob.position.set(fx * halfWTop, fy * troughLen, fz * R);
      blob.castShadow = true;
      blob.receiveShadow = true;
      troughPivot.add(blob);
      this.fillings.push(blob);
      this.fillingBaseRotZ.push(blob.rotation.z);
    }

    // ── Vary the size, or a filling row is just a row ────────────────────────
    // A critic on the previous build called the toppings "a row of
    // near-identical brown spheres that read as generic lumps". Correct: every
    // meat blob was one radius and every tomato one cube, so the fold read as a
    // texture rather than as ingredients. One dominant tomato wedge now anchors
    // the row and the rest step down from it.
    const tomatoSpots: Array<[number, number, number, number]> = [
      [-0.62, 0.96, 0.20, 1.55], [-0.26, 0.98, 0.06, 0.85], [0.12, 0.97, 0.26, 1.0],
      [0.46, 0.99, 0.08, 0.8], [0.70, 0.94, 0.20, 1.15], [-0.44, 0.94, 0.00, 0.75],
    ];
    for (const [fx, fy, fz, scale] of tomatoSpots) {
      const s = R * 0.17 * scale;
      const bit = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), tomatoMat);
      bit.name = 'taco_tomato';
      bit.position.set(fx * halfWTop, fy * troughLen, fz * R);
      bit.rotation.set(0.3, 0.5, 0.2 + fx);
      bit.castShadow = true;
      bit.receiveShadow = true;
      troughPivot.add(bit);
      this.fillings.push(bit);
      this.fillingBaseRotZ.push(bit.rotation.z);
    }

    // Lettuce is the only filling that clears the crimp, so it is the one that
    // states "this shell is FULL" in silhouette. Kept to the top band.
    // `burst` shreds stand nearly UPRIGHT and reach past the horns; the rest lie
    // across the fold. Two spiky green bursts breaking the outline is what makes
    // the crown of this silhouette specific instead of a flat lumpy line.
    const lettuceSpots: Array<[number, number, number, number, boolean]> = [
      [-0.72, 1.02, 0.12, 0.3, false], [-0.40, 1.05, 0.24, -0.30, true], [-0.10, 1.04, 0.04, 0.25, false],
      [0.22, 1.06, 0.22, -0.34, true], [0.52, 1.04, 0.06, 0.2, false], [0.74, 1.00, 0.16, -0.25, false],
      [-0.56, 1.00, 0.28, 0.1, false], [0.36, 0.99, -0.04, -0.1, false],
    ];
    for (let i = 0; i < lettuceSpots.length; i++) {
      const [fx, fy, fz, tilt2, burst] = lettuceSpots[i];
      const shred = new THREE.Mesh(
        new THREE.CapsuleGeometry(R * (burst ? 0.055 : 0.045), R * (burst ? 0.27 : 0.26), 4, 6),
        i % 2 === 0 ? lettuceMatA : lettuceMatB
      );
      shred.name = 'taco_lettuce';
      shred.position.set(fx * halfWTop, fy * troughLen, fz * R);
      // Bursts stand up but are RAKED, not vertical — two dead-upright green
      // capsules read as candles on a cake rather than as leaves.
      shred.rotation.set(burst ? 0.55 : Math.PI / 2 + tilt2 * 0.6, 0, tilt2 + (burst ? tilt2 * 2.2 : 0));
      shred.castShadow = true;
      shred.receiveShadow = true;
      troughPivot.add(shred);
      this.fillings.push(shred);
      this.fillingBaseRotZ.push(shred.rotation.z);
    }

    // A few onion slivers tucked among the meat — ties visually to the Onion Bomb
    // ability's projectile colour, and the only cool-leaning hue in the fold.
    const onionSpots: Array<[number, number, number]> = [[-0.22, 0.94, 0.30], [0.36, 0.96, 0.30], [0.06, 0.90, 0.34]];
    for (const [fx, fy, fz] of onionSpots) {
      const sliver = new THREE.Mesh(new THREE.TorusGeometry(R * 0.14, R * 0.042, 6, 12, Math.PI * 1.3), onionMat);
      sliver.name = 'taco_onion';
      sliver.position.set(fx * halfWTop, fy * troughLen, fz * R);
      sliver.rotation.set(0.4, 0.7, fx);
      sliver.castShadow = true;
      sliver.receiveShadow = true;
      troughPivot.add(sliver);
      this.fillings.push(sliver);
      this.fillingBaseRotZ.push(sliver.rotation.z);
    }

    // ── Face: ON THE SHELL, not beside it ────────────────────────────────────
    // The brief's 2D note ("the face floats outside the shell to the side") was
    // implemented literally as a separate sphere fused to the shell's right
    // edge. Rendered, that is not a quirk, it is a SECOND HEAD: a smooth pale
    // ball with two eyes and a grin, sitting next to a large brown mass, which
    // the eye reads as the character and the shell as scenery it is carrying.
    // Nothing about "taco" survived that read.
    //
    // The face goes where a character's face goes — front and centre on the
    // biggest surface it owns, which after the lean fix above is the front wall
    // and is now lit. The wall's slight backward tilt aims the face up toward a
    // camera pitched 58 degrees down, so it presents MORE area than a vertical
    // face would, not less. A soft cheek pad keeps the features from sitting on
    // a dead-flat plane.
    // Sits low, in the BOWL of the U, where the wall is solid. The rim above it
    // now dips toward the centre, so a face placed any higher would run out of
    // wall in the middle of its own forehead.
    const faceY = yBot + (frontTopY - yBot) * 0.34;
    const faceZ = panelThickness / 2;

    // Cheek pad: a shallow lens of slightly lighter shell proud of the wall, so
    // the face area has its own soft form under the features instead of reading
    // as decals on a flat card.
    // Domed harder than the first pass (0.20 → 0.34). A critic reading the flat
    // version said the face "looks like a decal rather than a head — no brow,
    // cheek or jaw form under it", which is what a 0.20 lens on a flat panel
    // gives you: features with correct depth sitting on nothing.
    const PAD_R = R * 0.58;
    const PAD = { sx: 1.28, sy: 0.66, sz: 0.26 };
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(PAD_R, 20, 16), podMat);
    cheek.name = 'taco_face_pad';
    cheek.scale.set(PAD.sx, PAD.sy, PAD.sz);
    cheek.position.set(0, faceY, faceZ - R * 0.02);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    frontMesh.add(cheek);

    // `face` normally rides the head's own front surface; nothing in the rig's
    // per-frame animate() ever touches its transform, so re-parenting it onto the
    // front wall (it inherits the fold's tilt) is safe and keeps every feature
    // below in simple wall-local coordinates.
    frontMesh.add(this.rig.joints.face);
    this.rig.joints.face.position.set(0, faceY, faceZ + R * 0.10);
    this.buildFace(PAD_R, { ...PAD, originZ: -R * 0.12 });

    // ── Torso: a second, smaller shell fold, not the rig's bare default ball ──
    // Taco never authored a torso, so it was rendering the shared rig's plain
    // default sphere underneath its shell head — on a cast where every other
    // character dresses its torso, an undressed default ball is exactly the
    // "one templated body" tell a second independent art-director pass warned
    // about, and the most obvious one in the whole roster. This is the same
    // trapezoid, crimped-top fold language as the head shell and the face pod,
    // just smaller, so the body keeps building on the same food identity instead
    // of exposing the shared rig underneath it.
    this.rig.dressTorso((size) => {
      const group = new THREE.Group();
      group.name = 'taco_torso_fold';
      const halfWTopT = size.w * 0.52;
      const toothHT = size.h * 0.05;
      const shapeT = tacoShellShape(halfWTopT, 0, size.h * 0.82, 0.24, toothHT);
      const thicknessT = size.d * 0.85;
      const geoT = new THREE.ExtrudeGeometry(shapeT, { depth: thicknessT, bevelEnabled: false, curveSegments: 1 });
      geoT.translate(0, 0, -thicknessT / 2);
      geoT.computeVertexNormals();
      const mesh = new THREE.Mesh(geoT, shellMat);
      mesh.name = 'taco_torso_fold_mesh';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // ── Costume: serape sash + chili charm ────────────────────────────────
      // A second independent art-director pass named the total absence of any
      // worn costume/accessory layer as the cast's single biggest remaining gap.
      // A striped serape sash slung diagonally across the shell — the classic
      // Mexican-blanket read — breaks the torso's trapezoid silhouette with a
      // hard diagonal line the shape itself doesn't have, and the chili charm
      // dangling off its low end is the small worn detail underneath it.
      const sashColors = ['#C1432B', '#F5EAD6', '#2E8C86', '#C1432B', '#F5EAD6', '#2E8C86', '#C1432B']
        .map((c) => toonMat({ color: c, roughness: 0.72 }));
      // Endpoints pulled in from 0.85/0.68 and lifted off the hip line: with the
      // band's own width added perpendicular to its run, the old anchors put both
      // ends outside the torso silhouette and the low end down among the thighs,
      // so the sash read as a separate object slung over the character rather
      // than as cloth lying on it.
      const sashA = new THREE.Vector3(-halfWTopT * 0.66, size.h * 0.90, thicknessT * 0.56);
      const sashB = new THREE.Vector3(halfWTopT * 0.52, size.h * 0.16, thicknessT * 0.56);
      const sashDir = sashB.clone().sub(sashA);
      const sashLen = sashDir.length();
      sashDir.normalize();
      // Narrowed from 0.30w. At that width the seven-stripe band was wider than
      // the torso is deep and ran the full diagonal of the body, so the serape
      // — an accessory — was the single largest block of colour on the
      // character and covered the shell fold it is supposed to decorate. A sash
      // reads as a sash because it is NARROW against what it crosses.
      const sashWidth = size.w * 0.19;
      const sashQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sashDir);
      const segCount = 7;
      const segLen = (sashLen / segCount) * 1.18; // slight overlap so segments read as one continuous band
      for (let i = 0; i < segCount; i++) {
        const t = (i + 0.5) / segCount;
        const center = sashA.clone().lerp(sashB, t);
        const seg = new THREE.Mesh(
          roundedBox(sashWidth, segLen, thicknessT * 0.14, sashWidth * 0.1, 2),
          sashColors[i % sashColors.length]
        );
        seg.name = 'taco_serape_stripe';
        seg.position.copy(center);
        seg.quaternion.copy(sashQuat);
        seg.castShadow = true;
        seg.receiveShadow = true;
        group.add(seg);
      }
      // Fringe tassels along the sash's low end.
      for (let i = 0; i < 5; i++) {
        const t = (i - 2) / 4;
        const base = sashB.clone().add(new THREE.Vector3(t * sashWidth * 0.85, 0, 0).applyQuaternion(sashQuat));
        const tassel = new THREE.Mesh(new THREE.ConeGeometry(sashWidth * 0.055, sashWidth * 0.42, 6), sashColors[i % sashColors.length]);
        tassel.name = 'taco_serape_tassel';
        tassel.position.copy(base).addScaledVector(sashDir, sashWidth * 0.24);
        tassel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sashDir.clone().negate());
        tassel.castShadow = true;
        group.add(tassel);
      }
      // Chili charm — hangs off the sash's low point on a thin cord.
      const chiliStemMat = toonMat({ color: '#5E8C3B', roughness: 0.6 });
      const chiliMat = toonMat({ color: '#D93A2B', roughness: 0.48 });
      const chiliAnchor = sashB.clone().addScaledVector(sashDir, sashWidth * 0.5);
      const chiliString = new THREE.Mesh(new THREE.CapsuleGeometry(sashWidth * 0.025, size.h * 0.1, 4, 6), chiliStemMat);
      chiliString.name = 'taco_chili_string';
      chiliString.position.copy(chiliAnchor).add(new THREE.Vector3(0, -size.h * 0.06, 0));
      group.add(chiliString);
      const chiliBody = new THREE.Mesh(new THREE.SphereGeometry(sashWidth * 0.22, 10, 8), chiliMat);
      chiliBody.name = 'taco_chili';
      chiliBody.scale.set(0.6, 1.4, 0.6);
      chiliBody.position.copy(chiliAnchor).add(new THREE.Vector3(0, -size.h * 0.15, 0));
      chiliBody.castShadow = true;
      chiliBody.receiveShadow = true;
      group.add(chiliBody);
      const chiliStem = new THREE.Mesh(new THREE.ConeGeometry(sashWidth * 0.06, sashWidth * 0.2, 6), chiliStemMat);
      chiliStem.name = 'taco_chili_stem';
      chiliStem.position.copy(chiliBody.position).add(new THREE.Vector3(0, sashWidth * 0.3, 0));
      chiliStem.castShadow = true;
      group.add(chiliStem);

      return group;
    });

    // ── Limbs: bespoke, not the shared rig defaults ───────────────────────────
    // An independent art director named the rig's identical capsule-arm/ball-hand/
    // wedge-foot kit as the single biggest "template" tell across the whole cast.
    // Taco's limbs are hard shell, not soft dough: faceted (low radial segment
    // count) and flattened into shard-like cross-sections, with a couple of the
    // pod's own crimp teeth glued onto the hand — the same toasted-shell language
    // as the head, not a generic mitt.
    const limbShellMat = toonMat({ color: LIMB_SHELL, roughness: 0.78 });
    const limbShellDarkMat = toonMat({ color: LIMB_SHELL_DARK, roughness: 0.78 });
    const mittMat = glossyMat({ color: ONION, roughness: 0.32 });
    const toothGeoSmall = new THREE.ConeGeometry(R * 0.05, R * 0.12, 4);
    this.rig.dressLimbs((part, size) => {
      switch (part) {
        case 'upperArmL': case 'upperArmR':
        case 'thighL': case 'thighR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 1.05, size.radius * 0.8, 6), limbShellMat);
          m.scale.z = 0.62;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'forearmL': case 'forearmR':
        case 'shinL': case 'shinR': {
          const m = new THREE.Mesh(taperedSegment(size.len, size.radius * 0.8, size.radius * 0.6, 6), limbShellDarkMat);
          m.scale.z = 0.62;
          m.name = `${part}_mesh`;
          m.castShadow = true;
          m.receiveShadow = true;
          return m;
        }
        case 'handL': case 'handR': {
          const g = new THREE.Group();
          const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(size.radius * 0.92, 0), mittMat);
          fist.position.y = -size.radius * 0.9;
          fist.scale.z = 0.75;
          fist.name = `${part}_mesh`;
          fist.castShadow = true;
          fist.receiveShadow = true;
          g.add(fist);
          for (const sx of [-1, 1]) {
            const tooth = new THREE.Mesh(toothGeoSmall, limbShellDarkMat);
            tooth.position.set(sx * size.radius * 0.5, -size.radius * 1.5, size.radius * 0.2);
            tooth.rotation.z = sx * 0.5;
            tooth.castShadow = true;
            g.add(tooth);
          }
          return g;
        }
        case 'footL': case 'footR': {
          // Was a `radius*2.2 x len*0.85 x radius*2.6` slab hung at -len*0.5:
          // 0.45 m across and 0.54 m deep on a 2.1 m character, with its
          // underside 0.21 m BELOW y=0. Two separate defects in one mesh — it
          // read as a house brick rather than a foot, and it broke the "feet at
          // y=0" convention harder than anything else in this cohort (which also
          // inflated every measured height for this character by that 0.21 m).
          const foot = new THREE.Mesh(
            roundedBox(size.radius * 1.85, size.len * 0.55, size.radius * 2.15, size.radius * 0.30, 3),
            limbShellDarkMat
          );
          // Seated on the floor via `size.groundY` (the joint-local y of the world
          // ground, new on `LimbSize`) rather than by eye. `types.ts` convention #1
          // is "feet at y=0" and the whole cast was 0.08-0.25 m under it; `Math.min`
          // keeps the authored droop as the floor for the value so this can only ever
          // raise a foot, never sink one.
          foot.position.set(0, Math.max(size.groundY + size.len * 0.275, -size.len * 0.26), size.radius * 0.5);
          foot.name = `${part}_mesh`;
          foot.castShadow = true;
          foot.receiveShadow = true;
          return foot;
        }
        default:
          return null;
      }
    });

    outlineGroup(this.root);
    this.collectFlashTargets();
    this.rig.restPose();
  }

  /**
   * Oversized, slightly asymmetric eyes plus a crooked grin — a cheeky, spice-loving
   * personality that matches a taco throwing filling and onion bombs. Built as real
   * shaded geometry with depth, not flat decals, per the relaxed face convention.
   */
  private buildFace(F: number, pad: { sx: number; sy: number; sz: number; originZ: number }): void {
    const face = this.rig.joints.face;
    const ink = PALETTE.ink;
    const eyeMat = toonMat({ color: ink, roughness: 0.25 });
    const browMat = toonMat({ color: SHELL_DARK, roughness: 0.7 });

    /**
     * Z of the cheek pad's front surface directly in front of (x, y), in
     * `face`-local space. Every feature is placed against this rather than
     * against a guessed constant — the same discipline the shell's own crimp
     * and the sprinkles on `donut.ts` use. Guessing this offset is what buried
     * a brow inside the old face pod and left the sesame seeds on
     * `hamburger.ts` floating, twice.
     */
    const padZ = (x: number, y: number, proud: number): number => {
      const u = x / (F * pad.sx);
      const v = y / (F * pad.sy);
      const d = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      return pad.originZ + F * pad.sz * d + proud;
    };

    // Round 2 defect: at offset 0.4*podR with radii up to 0.46*podR each, the two eyes'
    // combined radius (0.84*podR) exceeded their 0.8*podR separation and they visually
    // fused into one dark mass. Pushed further apart and shrunk slightly so there's a
    // clear gap of bare "skin" between them.
    // An independent art director flagged mismatched pupil sizes elsewhere in this
    // cast as reading like a placement error rather than a deliberate choice. A
    // ~20% size difference between the two eyes here was exactly that: too subtle
    // to clearly read as a wink, easy to mistake for a mistake. Eyes are now the
    // SAME size on both sides; the single raised eyebrow below (over the left eye
    // only) carries the "mischievous, about to throw something spicy" asymmetry
    // instead, and a raised brow is unambiguous in a way a slightly smaller pupil
    // is not.
    const eyeSize = 0.27;
    for (const sx of [-1, 1]) {
      const ex = sx * F * 0.44;
      const ey = F * 0.08;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(F * eyeSize, 16, 14), eyeMat);
      eye.position.set(ex, ey, padZ(ex, ey, -F * 0.06));
      eye.scale.set(1, 1.2, 0.55);
      eye.castShadow = true;
      face.add(eye);

      const glint = new THREE.Mesh(new THREE.SphereGeometry(F * 0.10, 10, 8), flatMat('#ffffff'));
      glint.position.set(ex - sx * F * 0.09, ey + F * 0.13, padZ(ex, ey, F * 0.06));
      glint.userData.noOutline = true;
      face.add(glint);
    }

    // One eyebrow cocked up over the left eye — a mischievous, "about to throw
    // something spicy" look.
    //
    // Thinner and much closer to the eye than the first pass. Two fat brown
    // ovals sitting high and wide on a round pale pad do not read as brows at
    // all: they read as EARS, and the whole face came back as a teddy bear
    // rather than a taco. A brow reads as a brow by being a thin stroke that
    // nearly touches the eye it belongs to.
    const browX = -F * 0.44;
    const browY = F * 0.40;
    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(F * 0.036, F * 0.32, 4, 8),
      browMat
    );
    brow.name = 'brow';
    brow.position.set(browX, browY, padZ(browX, browY, F * 0.04));
    brow.rotation.z = Math.PI / 2 + 0.35;
    brow.castShadow = true;
    face.add(brow);

    // A second, calmer brow over the right eye — flatter, lower, barely angled. A
    // second independent art-director pass flagged bare, brow-less eyes elsewhere in
    // the cast as reading "unfinished" rather than deliberate; this eye now has a real
    // brow too, it's just NOT the one doing the acting, so the mischievous raise above
    // stays unambiguous instead of reading as two brows that happen to differ.
    const browX2 = F * 0.44;
    const browY2 = F * 0.31;
    const brow2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(F * 0.032, F * 0.30, 4, 8),
      browMat
    );
    brow2.name = 'brow';
    brow2.position.set(browX2, browY2, padZ(browX2, browY2, F * 0.04));
    brow2.rotation.z = Math.PI / 2 - 0.06;
    brow2.castShadow = true;
    face.add(brow2);

    // Crooked, wide-open grin.
    const smileX = F * 0.04;
    const smileY = -F * 0.40;
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(F * 0.40, F * 0.085, 8, 20, Math.PI * 0.8),
      toonMat({ color: ink, roughness: 0.3 })
    );
    smile.position.set(smileX, smileY, padZ(smileX, smileY - F * 0.20, F * 0.02));
    smile.rotation.set(0, 0, Math.PI * 1.08);
    smile.castShadow = true;
    face.add(smile);
  }

  protected onUpdate(ctx: AnimContext): void {
    this.rig.animate({
      elapsed: this.elapsed,
      move01: ctx.moveSpeed01,
      attack01: this.attackT >= 0 ? this.attackT / this.attackDuration : -1,
      hit01: this.hitT >= 0 ? this.hitT / 0.26 : -1,
      dead01: this.deathT >= 0 ? this.deathT / 0.75 : -1,
    });

    // A faint jiggle through the loose fillings while running — cheap life, matches
    // the run bounce cadence from rig.ts (10.5 rad/s). Set relative to each filling's
    // OWN rest rotation every frame (never accumulated) so it settles cleanly back to
    // rest at move=0 instead of drifting.
    const move = THREE.MathUtils.clamp(ctx.moveSpeed01, 0, 1);
    const wobble = Math.sin(this.elapsed * 10.5) * 0.05 * move;
    for (let i = 0; i < this.fillings.length; i++) {
      this.fillings[i].rotation.z = this.fillingBaseRotZ[i] + wobble * (i % 2 === 0 ? 1 : -1);
    }
  }

  /** The rig owns all body motion; the base class's whole-body pass would fight it. */
  protected applyBaseMotion(): void {}
}
