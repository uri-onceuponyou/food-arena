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
  // MEASURED CONFLICT, still live: `src/arena/shared.ts` (owned elsewhere) bakes its
  // own soft radial grounding + cast-shadow decals under every prop, from when real
  // shadows were mushy. A/B-toggling them at runtime at shipped framing measures the
  // cast-shadow decals at mean 0.15/255 over 0.57% of pixels — effectively invisible,
  // pure cost — and the grounding decals at 2.31/255 over 8.0%, where they are the
  // symmetric grey halo that muddies this rig's now-crisp directional shadow. See
  // shots/light2/decals/crop_sheet.png. This file cannot change them; the lever here
  // is to make the real shadow long, dark and unambiguous enough to win.
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
  const key = new THREE.DirectionalLight(0xfff4de, 5.3);
  key.position.set(13.4, 9.8, 10.5);
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

  const focus = (x: number, z: number, radius = shadowRadius) => {
    const cam = key.shadow.camera;
    // Clamped, not trusted: see `MATCH_SHADOW_RADIUS_M`. `match.ts` asks for 30.
    const r = Math.max(radius, minFocusRadius);
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.updateProjectionMatrix();
    key.target.position.set(x, 0, z);
    key.position.set(x + 13.4, 9.8, z + 10.5);
    key.target.updateMatrixWorld();
  };
  focus(0, 0, shadowRadius);

  return { group, key, fill, rim, ambient, focus };
}
