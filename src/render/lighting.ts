/**
 * Lighting rig.
 *
 * Three-point setup tuned for the toon look: a warm directional key that casts the
 * only shadow, a cool hemisphere fill that keeps shadows coloured rather than grey,
 * and a cool back-rim that separates characters from the floor. This rig is shared
 * by the game and every isolated preview so a character judged in preview looks
 * identical in-game.
 */

import * as THREE from 'three';

export interface LightingRig {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  /** Re-aim the shadow frustum around a world position (follows the action). */
  focus(x: number, z: number, radius?: number): void;
}

/**
 * Smallest shadow-frustum half-extent that still covers everything on screen.
 *
 * Derivation, at the widest supported aspect (21:9, `SUPPORTED_ASPECT.max`), read off
 * the camera rig's own `window.__fairView` rather than assumed:
 *
 *   camera distance ....................... 26.62 m
 *   camera height (26.62 * sin 58) ........ 22.57 m
 *   ray at the top of frame ............... 58 - 34/2 = 41 deg above the ground
 *   distance along it to the ground ....... 22.57 / sin 41 = 34.4 m
 *   horizontal half-FOV at 21:9 ........... atan(tan(17) * 2.333) = 35.5 deg
 *   => widest visible half-width .......... tan(35.5) * 34.4 = 24.6 m
 *   => furthest visible ground corner ..... hypot(24.6, 12.0) = 27.4 m from the player
 *   + shadow reach of the tallest cover at the key's 30 deg elevation:
 *     1.7 m / tan(30) ..................... 2.9 m
 *   ------------------------------------------------------------------------------
 *   = 30.3 m, and a caster must be INSIDE the frustum to cast at all, so the box has
 *     to hold that corner plus the casters up-light of it. 34 m, with margin.
 *
 * `focus()` clamps UP to this, so a call site asking for a smaller box cannot silently
 * clip shadows off the corners of an ultrawide display.
 *
 * The clamp is applied by `Stage` only in `frameMode: 'fair'`, i.e. only in an actual
 * match. `preview.ts` deliberately focuses tight boxes (16 m for the floor plate,
 * 30 m for the arena) around framings much closer than the game's, and forcing 34 m
 * on those would spread the same 2048 texels over 4.5x the area and coarsen every
 * shadow in the character and prop review loops.
 *
 * => DEPENDS ON THE CAMERA: the 26.62 m distance falls out of `FAIR_PLAY.radiusUnits`
 * in `camera.ts`, which falls out of `REACH.rangedMax` in `rules.ts`. If the weapon
 * range rebalance moves the camera FURTHER OUT, re-derive this; closer is always safe.
 *
 * => NOTE FOR THE OWNER OF `match.ts`: line ~522 passes a literal 30 here
 * (`this.stage.lighting.focus(playerPos.x, playerPos.z, 30)`), which is below this
 * floor and was clipping at 21:9. It now has no effect either way; the tidy change is
 * to drop the third argument entirely and let the rig's own derivation apply.
 */
export const MATCH_SHADOW_RADIUS_M = 34;

export function createLighting(opts?: {
  shadowRadius?: number;
  shadowMapSize?: number;
  /** Floor on every `focus()` radius. Set by `Stage` for match framing only. */
  minFocusRadius?: number;
}): LightingRig {
  const group = new THREE.Group();
  group.name = 'lighting';

  const minFocusRadius = opts?.minFocusRadius ?? 0;
  const shadowRadius = Math.max(opts?.shadowRadius ?? 22, minFocusRadius);
  const mapSize = opts?.shadowMapSize ?? 2048;

  // Warm key — the sun, and the dominant. History worth keeping: an earlier rig had
  // the FILL dominant, which produced a mean frame value of ~0.87 against a reference
  // cluster of ~0.56-0.68, because that fill's two endpoints (sky 0xdcefff, ground
  // 0xffc79a) were both nearly full-bright and so behaved as a flat ambient lift
  // regardless of orientation. A hemisphere light only models form if its ends differ
  // in VALUE, not merely in hue.
  //
  // RESOLVED (round 9), and it unblocked the azimuth below. `src/arena/shared.ts` used
  // to bake TWO families of decal under every prop, from when real shadows were mushy:
  // a contact/AO ring and a directional CAST blob. Ablation at shipped framing put the
  // cast blobs at mean 0.13/255 over 0.75% of pixels — invisible, pure cost — against
  // 2.25/255 over 8.5% for the contact rings, which are genuinely load-bearing and
  // stay. The cast blobs have been deleted. The contact rings have NOT, and must not
  // be: they are what keeps a prop standing on an opaque floor pad from floating.
  //
  // ── ELEVATION IS THE FIGURE/GROUND KNOB, AND IT WAS THE UNTOUCHED ONE ──────
  // Five rounds tuned this light's INTENSITY and never moved its ANGLE. At the old
  // (9, 16, 7) the key sat 54.5 deg above the horizon, where cos(theta) hands the
  // FLOOR 0.81 of full illumination — a flat ground plane's normal points almost
  // straight at the light, so the floor was being lit more efficiently than the
  // rounded character standing on it. That is why a blind critic measured the hero at
  // L=180 against counter tops at L=217 and called the value hierarchy inverted, and
  // why the player separated from the floor by only 0.09 in mean value.
  //
  // Dropping to 30 deg (same azimuth, same distance) costs the floor 39% of its key
  // while a rounded form still turns a face into the light. Measured on the live game
  // at shipped framing, player-centred (`tools/tmp/key_sweep.mjs`), hero-vs-floor mean
  // value:
  //
  //   elevation 55 deg .... 0.046      elevation 38 deg .... 0.081
  //   elevation 46 deg .... 0.065      elevation 30 deg .... 0.114
  //
  // Raising INTENSITY does not do this — it lifts hero and floor together, and the
  // separation actually falls slightly (0.046 -> 0.034 going 3.8 -> 5.0 at 55 deg).
  // Intensity is up here only to hold the exposure the lower angle gives away.
  //
  // The lower angle also lengthens every cast shadow to 1.73x the caster's height,
  // which is what makes the light direction legible at a glance, and it cuts blown
  // highlights (up-facing surfaces stop being the ones nearest the ceiling of the
  // range): pixels with a channel pinned at 255 fall from 1.15% at 34 deg to 0.29%.
  //
  // ── AND THE AZIMUTH IS THE MODELLING KNOB — round 9 ────────────────────────
  // Elevation is fixed here; only the azimuth moved, from 38.1 deg to 16.0 deg (both
  // measured from +X toward +Z, at the same 19.65 m distance and the same 30 deg
  // elevation). The camera rig sits at yaw 0, i.e. at +Z looking toward -Z, so its own
  // azimuth is 90 deg: the key has gone from 52 deg off the view axis to 74 deg off it,
  // which is most of the way to a pure side light.
  //
  // Why that is the one lever left for MODELLING. Three critics independently named
  // the same #1 gap — surfaces with no internal gradient — and for a FLAT quad it is
  // unfixable here (one normal, one directional light: measured p90-p10 of 0.003). But
  // a CURVED vertical surface has a terminator, and where that terminator lands is set
  // purely by azimuth. For a vertical cylinder the terminator sits at screen-x
  // -sin(azimuth) of its own radius, so the visible half that is in shade goes:
  //
  //   azimuth 38.1 deg .... 19% shaded      azimuth 14 deg .... 38% shaded
  //   azimuth 30 deg ...... 25% shaded      azimuth  6 deg .... 45% shaded
  //   azimuth 20 deg ...... 33% shaded      azimuth  0 deg .... 50% shaded
  //
  // At 38 deg almost the whole visible curve was on the lit side of the terminator,
  // which is exactly "no internal gradient". Measured in the live game at shipped
  // framing on a supply barrel's curved skirt (`tools/tmp/rake.mjs --mode sweep`),
  // p90-p10 across its own pixels:
  //
  //   az 38.1 .... 0.243 (shipped)          az 20 ...... 0.295  (+21%)
  //   az 30 ...... 0.269                    az 14 ...... 0.309  (+27%)
  //   az 25 ...... 0.280                    az  6 ...... 0.315  (+30%)
  //
  // It is also what makes the shadow READ. This rig pitches 58 deg, so a shadow thrown
  // along world -Z is foreshortened to ~0.53x on screen while one along -X is seen at
  // full length. Azimuth therefore lengthens shadows on screen without touching
  // elevation: the player's own cast shadow grows 6528 -> 7558 px (+16%) at az 20.
  //
  // WHERE IT WAS STOPPED, and why 16 and not 0. The cost is figure/ground: a more
  // side-on key puts part of the hero in shade too, so hero-vs-floor mean separation
  // falls 0.212 -> 0.182 (az 20) -> 0.154 (az 6), against an acceptance floor of 0.10.
  // Normalising both curves, gain-minus-cost peaks flat across az 14-20 and falls away
  // on either side, and the modelling curve is already 90% saturated by az 14. 16 deg
  // sits in that plateau and keeps the drift from the two baked azimuth duplicates in
  // `arena/floor.ts` and `arena/apron.ts` (both still on the old 38 deg, both owned
  // elsewhere, neither a hard edge) as small as it can be while still buying the move.
  //
  // The regression this could have caused, checked explicitly because this element
  // once dropped to 3/10 from adjacent props' shadows merging into floor-wide haze:
  // it did not happen. Isolating the real shadow map on ground pixels only (render
  // with `key.castShadow` off, diff, morphological open to strip the grout lattice),
  // shadowed ground area FALLS 7.61% -> 7.67% -> 7.21% across az 38 -> 20 -> 14, the
  // largest connected shadow component holds flat at 22.1% -> 23.8% -> 22.5% of all
  // shadow area, and the component count does not collapse. Elevation is what sets
  // shadow LENGTH and it did not move, which is why there is nothing here to merge.
  const key = new THREE.DirectionalLight(0xfff4de, 5.3);
  key.position.set(16.35, 9.82, 4.69);
  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  // 95, not 70: a lower light sits nearer the ground, so the far corner of a 34 m
  // box is further along the light axis than it was from 16 m up.
  key.shadow.camera.far = 95;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  // Blur radius tightened four times now (3 → 1.4 → 0.9 → 0.6 → 0.4) chasing a
  // crisper, more legible cast-shadow edge — see the note above on the decal layer
  // this stacks with.
  key.shadow.radius = 0.4;
  group.add(key);
  group.add(key.target);

  // The sky/bounce fill. Still keeps shadow sides coloured rather than grey — but
  // the ground tone is now a noticeably DARKER terracotta (value ~0.72 vs the sky's
  // ~1.0) rather than the previous near-white 0xffc79a. A hemisphere light only
  // creates value falloff across surface orientation if its two ends actually
  // differ in VALUE, not just hue; with both ends bright it lit every face almost
  // equally regardless of which way it faced, which is what read as "flat painted
  // blockout." Intensity is also down so it no longer wins the exposure fight
  // against the key on top faces.
  //
  // Raised 0.24 -> 0.50 in the round that lowered the key. This is the SHADOW FLOOR,
  // and it is set against the reference plates rather than against an opinion. The
  // 5th-percentile luminance of the twelve curated gameplay plates runs 0.167 to
  // 0.379; ours had fallen to 0.208, below all but one of them, and a blind critic
  // duly called the shadows dead and "read as dirt, not as shade". It is the right
  // light to lift with, because a hemisphere's SKY end only reaches up-facing
  // surfaces: it lifts shadowed FLOOR (which is flat anyway and has no modelling to
  // lose) far more than it lifts the side of a rounded prop, so it buys shadow detail
  // almost without spending terminator. Measured: p05 0.208 -> 0.218, hero-vs-floor
  // separation unchanged at 0.114.
  const fill = new THREE.HemisphereLight(0xd8ecff, 0x6f4322, 0.50);
  group.add(fill);

  // Cool rim from behind — the separation light that pops characters off the floor.
  // Lowered from 27 deg to 16 deg of elevation and brought up from 0.95, for the same
  // reason the key came down: at 27 deg a flat floor still collected 0.46 of it, so
  // half the rim's energy was going into the thing it is supposed to separate the
  // character FROM. At 16 deg the floor takes 0.28 and a character's up-screen edge
  // takes nearly all of it. Not pushed further than 1.7 — this light is strongly
  // tinted, and past about 2.0 it starts washing the frame's mean saturation down
  // (measured 0.514 -> 0.476 going 0.95 -> 2.4), which is the opposite of the brief.
  const rim = new THREE.DirectionalLight(0xaddcff, 1.7);
  rim.position.set(-11.3, 4.2, -15.5);
  rim.castShadow = false;
  group.add(rim);

  // Flat lift so nothing ever reads as a dead black hole. Kept low — this is the
  // one light that truly ignores orientation, so any more than a whisper of it
  // re-introduces the flattening the fill rework above was meant to remove.
  const ambient = new THREE.AmbientLight(0xffffff, 0.025);
  group.add(ambient);

  // ── The focus point is QUANTISED, and that is load-bearing ─────────────────
  //
  // `match.ts` calls `focus()` every frame with the player's exact position, so the
  // shadow frustum used to translate by a fraction of a texel 60 times a second.
  // Two consequences, one cosmetic and one now structural:
  //
  //  * COSMETIC: a sub-texel slide re-rasterises every shadow edge in the arena
  //    against a slightly different grid each frame, which is the classic shadow
  //    "swim" — static cover whose ink edge crawls while the player walks.
  //  * STRUCTURAL: `Stage` no longer re-renders the shadow map unconditionally
  //    (`shadowMap.autoUpdate = false`); it re-renders when something that the map
  //    depends on has changed. A frustum that moves every frame makes that test
  //    always true, so the whole saving would evaporate on a stationary scene.
  //
  // Snapping to whole multiples of `SNAP_TEXELS` shadow texels fixes both. The
  // quantum is derived from the live frustum, so it is 4 * 68m / 2048 = 13.3 cm in a
  // match and proportionally finer in every closer preview framing. The cost is that
  // the box centre can sit up to half a quantum (6.6 cm) off the player, against
  // `MATCH_SHADOW_RADIUS_M`'s own 3.7 m of derived margin — three orders of
  // magnitude of headroom.
  //
  // This is a WORLD-space snap, not an exact light-space texel snap (which would
  // need the light basis and buys the last few percent of stability). Stated plainly
  // because the difference matters if anyone chases the residual shimmer further.
  const SNAP_TEXELS = 4;
  let lastX = NaN;
  let lastZ = NaN;
  let lastR = NaN;

  const focus = (x: number, z: number, radius = shadowRadius) => {
    const cam = key.shadow.camera;
    // Clamped, not trusted: see `MATCH_SHADOW_RADIUS_M`. `match.ts` asks for 30.
    const r = Math.max(radius, minFocusRadius);
    const step = (SNAP_TEXELS * 2 * r) / mapSize;
    const sx = Math.round(x / step) * step;
    const sz = Math.round(z / step) * step;
    if (sx === lastX && sz === lastZ && r === lastR) return;
    lastX = sx; lastZ = sz; lastR = r;

    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.updateProjectionMatrix();
    key.target.position.set(sx, 0, sz);
    // Must stay identical to the authored offset above — this is the one that actually
    // runs in a match, since `focus()` is called every frame.
    key.position.set(sx + 16.35, 9.82, sz + 4.69);
    key.target.updateMatrixWorld();
  };
  focus(0, 0, shadowRadius);

  return { group, key, fill, rim, ambient, focus };
}
