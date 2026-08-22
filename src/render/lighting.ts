/**
 * Lighting rig.
 *
 * Four lights: a warm directional key from BEHIND the scene that casts the only
 * shadow, a cool near-horizontal FRONT fill on the camera's own axis that carries
 * figure/ground, a hemisphere fill that keeps shadows coloured rather than grey, and
 * a cool back-rim. This rig is shared by the game and every isolated preview so a
 * character judged in preview looks identical in-game.
 *
 * ── WHY THE KEY IS BEHIND THE SCENE, which is the whole shape of this file ──
 * Two independent blind critics named the same #1 defect — "props cast no shadow at
 * all" — and three probes disagreed with them: 470 of 740 arena meshes cast, the
 * frustum is 2.3x wider than the frame, and ablation showed arena shadows changing
 * 5.4-11.4% of the frame at mean |dL| 0.13-0.16. The shadows were real. They were
 * landing where nobody could see them.
 *
 * The old key sat at azimuth +16 deg — measured from +X toward +Z, and the match
 * camera sits at +Z looking toward -Z, so +Z is the CAMERA's own side. A light on
 * the camera's side throws every shadow AWAY from the camera, i.e. behind the object
 * that casts it. Combined with 30 deg of elevation, which throws 1.73x the caster's
 * height, every prop's shadow was a long smear that started behind the prop and ended
 * several metres away across open floor. Read as a stain on the tiles, not as a
 * shadow, and left the base of every object — the one place the eye looks for
 * contact — completely clean.
 *
 * `tools/tmp/contactshadow.mjs` measures exactly that: for every cover-box prop in
 * frame it bins the cast shadow's darkening by d/H, the distance from the prop's own
 * footprint in units of the prop's own height, on a floor mask taken from the shipped
 * frame. Its headline is `contactShadeDL`, the mean darkening in the band d/H <= 0.35
 * on the half the shadow is actually thrown into. Three stations, hamburger:
 *
 *                        contactShadeDL          % of that band past 0.06
 *   shipped (az +16)   0.045 / 0.029 / 0.037     25.1% / 13.6% / 18.8%
 *   this rig (az -31)  0.105 / 0.141 / 0.154     58.2% / 79.1% / 75.5%
 *
 * 0.06 is `arena-scan`'s own "the hero has no value separation" threshold, so the old
 * rig delivered a contact shadow that was measurably present and perceptually absent
 * over four fifths of the band, and this one clears it over three quarters. Where the
 * shadow's darkening MASS sits moved with it, in the same d/H units:
 *
 *                        p50 of the mass          p95 of the mass
 *   shipped            0.64 / 0.61 / 0.38       1.07 / 1.04 / 0.78
 *   this rig           0.34 / 0.31 / 0.32       0.71 / 0.69 / 0.70
 *
 * against reference plates whose props carry a shadow reaching roughly 0.35-0.55 of
 * their own height (measured by hand off three crates and a barrel in
 * `reference/images/curated/gameplay_topdown/bs_04.png`).
 *
 * ELEVATION WAS THE WRONG KNOB, and that is worth recording because it is the obvious
 * one. Raising the key shortens the shadow — but it also swings the light toward the
 * camera axis, so the shorter shadow hides behind its own caster. Swept 20/30/40/50/
 * 60/70 deg at the old azimuth, contactShadeDL went 0.023 / 0.029 / 0.022 / 0.018 /
 * 0.012 / 0.006 — it FALLS monotonically from 30 deg up. Raising the key does not buy
 * contact. Moving it round does.
 */

import * as THREE from 'three';

export interface LightingRig {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  /** Near-horizontal light on the camera's own axis. Carries figure/ground. */
  front: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  /** Re-aim the shadow frustum around a world position (follows the action). */
  focus(x: number, z: number, radius?: number): void;
  /**
   * Re-resolution the shadow map, for a live quality-tier change.
   *
   * Not just `key.shadow.mapSize.set(n, n)`. Two things have to happen with it:
   *   1. the existing render target must be DISPOSED, or three keeps drawing into the
   *      old one at the old size and the setting silently does nothing;
   *   2. the focus quantum has to be recomputed. `focus()` snaps the frustum centre to
   *      whole multiples of `SNAP_TEXELS` shadow texels, and the texel size is derived
   *      from `mapSize` — a stale quantum would put the snap grid at the wrong pitch,
   *      which is the shadow-swim artefact the snapping exists to prevent.
   * The cached last-focus is cleared too, so the next `focus()` cannot early-out on
   * coordinates that were snapped against the old grid.
   */
  setShadowMapSize(size: number): void;
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
 *   + shadow reach of the tallest cover at the key's 46 deg elevation:
 *     1.7 m / tan(46) ..................... 1.6 m
 *   ------------------------------------------------------------------------------
 *   = 29.0 m, and a caster must be INSIDE the frustum to cast at all, so the box has
 *     to hold that corner plus the casters up-light of it. 34 m, with margin.
 *
 * ⚠️ The elevation term was `1.7 / tan(39) = 2.1 m` and this sum was `29.5 m`. Both are
 * re-derived here rather than left, because `MATCH_SHADOW_RADIUS_M` is a DERIVED number
 * and a derivation that quietly stops matching its inputs is how a constant becomes
 * folklore. The requirement got SMALLER when the key came up, so 34 m still clears it
 * with more margin than before — no change to the constant, only to the arithmetic that
 * justifies it.
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

/**
 * The key's offset from whatever it is aimed at — 45 m at elevation 46 deg, azimuth
 * -31 deg (measured from +X toward +Z, so a NEGATIVE azimuth is the far side of the
 * camera axis and throws shadows toward the viewer).
 *
 *   x = 45 * cos46 * cos(-31) =  26.79
 *   y = 45 * sin46            =  32.37
 *   z = 45 * cos46 * sin(-31) = -16.10
 *
 * ── ⚠️ THIS WAS 39 DEG. THE OLD VALUES, KEPT, BECAUSE THE ROUND THAT SET THEM
 *    MEASURED 48 DEG AS WORSE AND THAT MEASUREMENT IS NOT WRONG — IT IS STALE ──
 *
 *   x = 45 * cos39 * cos(-31) =  29.98
 *   y = 45 * sin39            =  28.32
 *   z = 45 * cos39 * sin(-31) = -18.01
 *
 * Uri, on the shipped build: *"The current directional shadows are long and offset,
 * which makes characters look like they're floating — keep the directional shadow but
 * soften and shorten it, and let the contact shadow do the work of grounding."*
 *
 * **The second half of that sentence is what makes it a different question from the one
 * 39 deg answered.** The sweep below chose 39 over 48 on `contactShadeDL` and `heroDL`
 * — i.e. on how much CONTACT the cast shadow delivered — at a time when the cast shadow
 * was the only contact cue in the frame. `48e5f6c` then added a centred per-fighter
 * contact decal, and this same commit raises its peak 1.33x and tightens it. So the
 * cast shadow no longer has to buy contact, and the term it was being traded against is
 * the one Uri is naming: LENGTH.
 *
 * 46 deg, not 50 and not 55, because the stopping point is derivable rather than a
 * taste: a cast shadow's ground length is `1/tan(elevation)` of its caster's height, so
 *
 *   39 deg -> 1.235 x the caster's height     46 deg -> 0.966 x     50 deg -> 0.839 x
 *
 * and 46 is the first whole degree where **the shadow is shorter than the thing casting
 * it**. This file already names 1.73x as the length at which "the shadow detaches from
 * its own object and reads as a stain on the floor"; 1.0x is the other side of that
 * same argument and is the last point at which the shadow is unambiguously attached.
 * Going further starts closing on the camera axis, which the sweep below shows hides the
 * shadow under its own caster.
 *
 * The two derived quantities downstream were re-checked, not inherited: the far corner
 * of the 34 m box along this axis is 45 + 34*(0.5953 + 0.3577) = 77.4 m, still inside
 * `shadow.camera.far = 95`, and the nearest in-box caster sits 12.6 m past the near
 * plane (it was 8.7 m at 39 deg, so the clipping headroom went UP).
 *
 * Exported as one constant because `focus()` re-sets `key.position` every frame and
 * used to do it from a hand-copied literal.
 */
export const KEY_OFFSET = new THREE.Vector3(26.79, 32.37, -16.10);

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
  // `let`, not `const`: a live quality-tier change re-resolutions the map, and the
  // focus quantum below is a function of this number. See `setShadowMapSize`.
  let mapSize = opts?.shadowMapSize ?? 2048;

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
  //
  // ⚠️ ONE CLAIM FROM THAT ROUND IS FALSIFIED AND IS LEFT HERE ON PURPOSE. It read:
  // "the lower angle also lengthens every cast shadow to 1.73x the caster's height,
  // which is what makes the light direction legible at a glance." It did the opposite.
  // 1.73x is far enough that the shadow detaches from its own object and reads as a
  // stain on the floor, and two blind critics duly reported "props cast no shadow at
  // all" while 470 arena meshes were casting. Shadow LENGTH is not legibility; contact
  // is. The measurement is at the top of this file.
  //
  // The rest of that round's finding stands: the low angle cuts blown highlights,
  // because up-facing surfaces stop being the ones nearest the ceiling of the range —
  // pixels with a channel pinned at 255 fell from 1.15% at 34 deg to 0.29%.
  //
  // ── AZIMUTH: ROUND 9 MOVED IT 38.1 -> 16.0 FOR MODELLING; ROUND 10 MOVED IT
  //    ACROSS THE CAMERA AXIS TO -31.0 FOR CONTACT ─────────────────────────────
  // Round 9's physics still holds and is why the number is -31 and not -5. For a
  // vertical cylinder the terminator sits at screen-x -sin(azimuth) of its own radius,
  // so the fraction of the visible width in shade is (1 - sin a)/2:
  //
  //   az 38.1 .... 19% shaded      az 0 ....... 50% shaded
  //   az 16.0 .... 36% shaded      az -31 ..... 76% shaded
  //
  // Round 9 walked that from 19% to 36% and stopped at 16 deg because the cost was
  // figure/ground — a more side-on key puts part of the hero in shade too. What made
  // -31 affordable is the FRONT FILL below, which did not exist then: it relights the
  // camera-facing surfaces the swing puts in shade, and it does so 2.9x more
  // efficiently on a rounded character than on the flat floor, which is the opposite
  // bias to every other light in this rig. With it, the same swing that used to cost
  // figure/ground now BUYS it (numbers under `front`).
  //
  // The azimuth SIGN is the contact lever and it is worth stating in one line: the
  // ground shadow direction is (-cos a, -sin a), the camera sits at +Z, so a positive
  // azimuth throws shadows to -Z — away from the camera, behind their own caster —
  // and a negative one throws them to +Z, toward the camera and into the open floor
  // in front of the object. -31 deg puts the shadow down-and-left on screen, which is
  // also the direction the reference plates carry theirs.
  //
  // The regression this could have caused, checked explicitly because this element
  // once dropped to 3/10 from adjacent props' shadows merging into floor-wide haze:
  // it did not happen, and the mechanism is that the shadows got SHORTER, not longer.
  // `contactshadow.mjs`'s d/H profile puts 95% of the shadow's darkening mass inside
  // 0.71 prop-heights of the footprint, against 1.07 shipped.
  //
  // ── ELEVATION 30 -> 39 ─────────────────────────────────────────────────────
  // Round 9 held elevation fixed and its reasoning for 30 deg — that a low light
  // hands a flat floor only sin(e) of its illumination while a rounded form still
  // turns a face into it — is still the reason this is not 60. 39 deg is where the
  // sweep in `contactshadow.mjs` put the joint peak of contactShadeDL and heroDL once
  // the front fill was carrying figure/ground; 48 deg measured WORSE on both
  // (contact 0.088/0.093/0.143 and heroDL 0.091/0.087/0.133 against 39 deg's
  // 0.105/0.141/0.154 and 0.092/0.105/0.150), because past about 45 deg the light
  // starts closing on the camera axis and the shadow hides under its own caster again.
  //
  // The two baked azimuth duplicates in `arena/floor.ts` and `arena/apron.ts` are
  // still on the old 38 deg, are both owned elsewhere, and are both soft fields
  // rather than hard edges. They now disagree with the key by 69 deg rather than 22.
  // Flagged for their owner rather than reached for; measured as costing nothing that
  // any rail in this pass can see.
  const key = new THREE.DirectionalLight(0xfff4de, 3.5);
  // 45 m out, not 19.65. A directional light's shading depends only on its DIRECTION,
  // so pushing it back is free — but its shadow camera sits AT it with `near = 1`, and
  // at 19.65 m the light was inside its own +/-34 m frustum: a caster on the light side
  // of the box fell behind the near plane and silently stopped casting. At the shipped
  // 16:9 that never bit (the visible ground reaches 14.5 m), but at 21:9 it clipped
  // about 2 m off the up-light corner. At 45 m the nearest in-box caster sits 6.9 m
  // downstream of the near plane at any supported aspect.
  key.position.copy(KEY_OFFSET);
  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  // Still 95, re-derived for the new position rather than inherited: the furthest
  // corner of a 34 m box along this light's axis is 45 + 34*(0.666 + 0.400) = 81.3 m,
  // where 0.666 and 0.400 are |axis.x| and |axis.z|. Keeping near/far identical also
  // keeps the ortho depth range identical, so `bias` and `normalBias` below stay valid.
  key.shadow.camera.far = 95;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  // ── 0.4 -> 1.6, THE "SOFTEN" HALF OF URI'S SENTENCE ────────────────────────
  // The history below is kept verbatim because it is the reason to be sceptical of
  // this change, and that scepticism is the honest thing to hand the next reader:
  //
  //   *"Blur radius tightened four times now (3 -> 1.4 -> 0.9 -> 0.6 -> 0.4) chasing a
  //   crisper, more legible cast-shadow edge — see the note above on the decal layer
  //   this stacks with. Re-tested at 1.4 and 3.0 once the shadow was hugging the base,
  //   on the theory that a soft short shadow reads as contact AO: every metric in
  //   `contactshadow.mjs` moved by under 0.001 and the frames were indistinguishable to
  //   look at. Left where four previous rounds put it rather than moved on no
  //   evidence."*
  //
  // ⚠️ So this project has ALREADY measured that this knob is close to a no-op on the
  // instruments it owns, and the honest prediction for the A/B accompanying this commit
  // is that the whole-frame delta attributable to THIS line alone is small. It is
  // changed anyway, and declared, because (a) it is half of an explicit instruction from
  // the owner, (b) the two things it was tested against have both moved underneath it —
  // the key is 7 deg higher and the contact decal is 1.33x deeper, so "a soft short
  // shadow reads as contact AO" is now being asked of a shadow that is 22% shorter and
  // is no longer the only contact cue — and (c) `docs/LESSONS.md` §6b's mirror image
  // applies: a flat metric is not evidence a change did nothing, and no statistic here
  // measures edge softness at all.
  // **If the paired ablation says it is invisible, that is the result and it should be
  // reported as one — not quietly kept because it was asked for.**
  key.shadow.radius = 1.6;
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
  //
  // 0.55, up from 0.50, in the round that moved the key behind the scene: a back key
  // puts more of every camera-facing surface on the shadow side, and this is the light
  // that sets the floor of that shade.
  //
  // ── AND IT IS THE ANSWER TO A CRITIC'S NAMED MECHANISM, WHICH IS TOO SMALL ──
  // Two independent blind critics, on two different frames, both diagnosed the same
  // cause for the same symptom: no terminator on a vertical prop, "the ambient /
  // hemisphere term is dominating the key." Swept 0.28 / 0.40 / 0.55 with everything
  // else held (`tools/tmp/rigs_lg9.json`), a 2x range:
  //
  //                       prop contrast (formRel)   prop contact (coreDL)   heroDL
  //   hemisphere 0.55        1.212 / 1.399           0.059 / 0.111        0.109 / 0.088
  //   hemisphere 0.40        1.222 / 1.407           0.060 / 0.111        0.110 / 0.091
  //   hemisphere 0.28        1.224 / 1.418           0.060 / 0.112        0.110 / 0.090
  //
  // About 1% of prop contrast across the whole range. The mechanism is real in SIGN
  // and an order of magnitude too small to be the cause — at 0.55 against a key of
  // 3.5 this light was never dominating anything. The knob that DOES move a
  // terminator is the front-fill-to-key ratio, and it trades against figure/ground
  // essentially 1:1: `fillInt 0.28, keyInt 4.2, frontInt 1.8` buys formRel
  // 1.276 / 1.546 (+5% / +11%) and coreDL +20%, and pays heroDL 0.109 -> 0.086 and
  // 0.088 -> 0.062, i.e. -21% and -29% of the figure/ground this same pass just took
  // from a cast minimum of -0.0014 to 0.0593. That is a real, mapped, available trade
  // and it is deliberately NOT spent here. Whoever wants a harder terminator is
  // spending figure/ground for it and should say so.
  const fill = new THREE.HemisphereLight(0xd8ecff, 0x6f4322, 0.55);
  group.add(fill);

  // ── FRONT FILL — the light that made the key's move across the camera axis
  //    affordable, and the most efficient figure/ground light in the rig ────────
  // Near-horizontal (8 deg) on the camera's own azimuth (90 deg = +Z). That geometry
  // is the entire point. A flat floor's normal points straight up, so it collects
  // sin(8) = 0.14 of this light; a character's camera-facing surfaces sit at about
  // 32 deg of elevation (the normal that faces a 58 deg camera) and collect 0.91.
  // 6.6:1 in the FIGURE's favour, against the key's own 0.94:1 at its old 30 deg and
  // the hemisphere fill's 0.84:1. Nothing else in this rig separates a character from
  // the ground it stands on anywhere near this cheaply, which is why moving the key
  // behind the scene — which costs figure/ground on its own — comes out POSITIVE:
  //
  //   hero-vs-ground dL, exact hero matte, 3 stations (`contactshadow.mjs`)
  //     shipped rig ............ 0.075 / 0.107 / 0.132
  //     key at -31, no front ... 0.039 / 0.036 / 0.077   <- the cost, on its own
  //     this rig ............... 0.092 / 0.105 / 0.150
  //
  // It also does what a peer's blind critic asked for in the same round — "the
  // terminator is too hard, raise fill to ~40% of key" — but by relighting the shade
  // side from the front rather than by raising the hemisphere, which would have lifted
  // the floor as fast as the character. The hero's own p05 moves 0.168 -> 0.172 and its
  // p95-p05 range 0.723 -> 0.710, i.e. a softer terminator that stays well inside
  // `valuescan --mode gate`'s reference-derived rails (range >= 0.636, p05 <= 0.180).
  //
  // COOL, not warm, and that is measured rather than taste: the same rig with a warm
  // 0xfff0e0 front scored heroDL 0.090/0.101/0.147 against this one's 0.092/0.105/0.150
  // and a narrower hero range, and a warm light of this strength spends environment
  // chroma into the CAST's own hue band, which `arena-scan`'s `envShareInCastBand` and
  // `hueOverlap` rails both watch.
  //
  // THE PRICE, stated because it is real: this light hits every prop's camera-facing
  // face near head-on, so prop internal contrast — p90-p10 of luma over the standing
  // arena geometry's own pixels, divided by their mean so exposure cannot flatter it —
  // falls 1.27/1.57/1.29 to 1.06/1.21/1.12, about 15%. Swept 1.6 / 2.0 / 2.2 / 3.0:
  // that number recovers monotonically as the front comes down and heroDL falls with
  // it. 2.2 is the point where heroDL is still above the shipped rig at every station.
  const front = new THREE.DirectionalLight(0xeef4ff, 2.2);
  front.position.set(0, 6.26, 44.56);   // 45 m at elevation 8 deg, azimuth 90 deg
  front.castShadow = false;
  group.add(front);
  group.add(front.target);

  // Cool rim from behind — the separation light that pops characters off the floor.
  // Lowered from 27 deg to 16 deg of elevation, for the same reason the key came down:
  // at 27 deg a flat floor still collected 0.46 of it, so half the rim's energy was
  // going into the thing it is supposed to separate the character FROM. At 16 deg the
  // floor takes 0.28 and a character's up-screen edge takes nearly all of it.
  //
  // 1.7 -> 0.9 in the round that moved the key behind the scene, because the key now
  // does most of this light's job: at azimuth -31 it IS a back light for every
  // camera-facing surface, and two back lights plus a front fill was one too many.
  // What the rim still buys at 0.9 is the cool tint on the up-screen edge; what
  // dropping it buys is floor illumination the front fill needs to out-run. Swept
  // 0.4 / 0.8 / 1.4 against the finished rig: contact and heroDL move by under 0.003
  // across the whole range, and the only monotone term is the hero's p05, which rises
  // 0.170 -> 0.179 as the rim goes up. 0.9 keeps the tint and the ladder both.
  const rim = new THREE.DirectionalLight(0xaddcff, 0.9);
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
    // `KEY_OFFSET`, not a second literal. This is the line that actually runs in a
    // match — `focus()` is called every frame — and it used to be a hand-copied
    // duplicate of the authored position, i.e. one edit away from a rig whose preview
    // and match disagree while every gate passes.
    key.position.set(sx + KEY_OFFSET.x, KEY_OFFSET.y, sz + KEY_OFFSET.z);
    key.target.updateMatrixWorld();
  };
  focus(0, 0, shadowRadius);

  const setShadowMapSize = (size: number): void => {
    const n = Math.max(256, Math.round(size));
    if (n === mapSize) return;
    mapSize = n;
    // Order matters: dispose the OLD target while its size is still what three has on
    // the GPU, then set the new size. three reallocates on the next shadow render.
    key.shadow.dispose();
    key.shadow.map = null;
    key.shadow.mapSize.set(n, n);
    lastX = NaN;
    lastZ = NaN;
    lastR = NaN;
  };

  return { group, key, fill, front, rim, ambient, focus, setShadowMapSize };
}
