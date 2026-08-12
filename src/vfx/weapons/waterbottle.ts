/**
 * Water Bottle weapon VFX.
 *
 * `Glass` (Glass Shards) is converted below as the second of the two reference
 * implementations proving the `WeaponVfx` contract (`./types.ts`) is expressive
 * enough for real per-weapon identity — deliberately the OPPOSITE case from
 * `hamburger.ts`'s `Tomato`: hard, angular, brittle shards that shatter, instead of
 * a soft fruit that splatters. The weapon already carries `effect: 'stun'`
 * (`game/rules.ts`), which drives `game/vfx.ts`'s existing generic orbiting-star
 * status telegraph untouched by this file — `impact()` below only needed to add the
 * instant "crack" moment, not re-implement the ongoing stun indicator.
 *
 * Weapon keys available (`game/rules.ts` -> `CHARACTERS.waterbottle.weapons`):
 * `'Spray'`, `'Glass'` (converted), `'Cap'`, `'Mega'` (converted).
 *
 * ── `Mega` and why it is here ──────────────────────────────────────────────────
 *
 * Uri, on this exact weapon: *"the 4th weapon doesn't even look similar to what it is
 * stated it does."* He is right, and it was measurable rather than a matter of taste —
 * before this block, `Mega` had **no entry in this file at all**. The special slot of
 * the roster's only Legendary drew the generic flat translucent pie-wedge on the floor
 * plus the generic starburst, and nothing else.
 *
 * Its card promises seven things:
 *
 *     "launches himself up (takes a few seconds), his cap becomes a second bottle,
 *      and together they become one giant bottle that dumps water on an enemy for
 *      huge damage and a heavy slow"
 *
 * Four of those are pure PICTURE — the launch, the cap becoming a bottle, the merge,
 * the dump — and the audit that started this work classed them as *"buildable in
 * `src/vfx/weapons/` today"*. They are what `telegraph()` and `cast()` below draw, in
 * that order, as one continuous four-beat gesture. The wind-up ("takes a few seconds")
 * is the sim's `castMs`, and it is the reason this weapon is the one the cast system
 * was built for.
 *
 * ⚠️ Two clauses are NOT closed by any of this and no amount of art will close them:
 * *"a **heavy** slow"* needs a second slow tier (there is exactly one magnitude per
 * role in `rules.ts`), and the damage is `18` flat rather than anything special-cased.
 * Do not read the picture as evidence the mechanic arrived.
 */

import * as THREE from 'three';
import { CHARACTER_HEIGHT, CHARACTER_RADIUS } from '../../units';
import type { CharacterWeaponVfxMap } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Glass Shards — module-scope geometry/material singletons, same discipline as
// `hamburger.ts`'s Tomato Toss (see that file's top-of-block comment for why).
// ─────────────────────────────────────────────────────────────────────────────

const SHARD_RADIUS = 0.09;

/**
 * ── The same defect as `hamburger.ts`, and for the same reason ─────────────────
 *
 * These two files are the original reference conversions and predate the rest of the
 * directory's "every dimension is a fraction of `CHARACTER_HEIGHT`" discipline. Both
 * sized their beats against the PROJECTILE's own radius. Measured at shipped framing
 * (`tools/tmp/vfx_wcov.mjs`, 800x450 readback, peak slice):
 *
 *                        shipped   +nodepth   +scale4   occl    size
 *     Glass.cast             21        21       174    1.00x    8.3x
 *     Glass.impact           78       132       753    1.69x    9.7x
 *
 * against the generic path's 735 / 3,102. The cast is purely SIZE (occlusion 1.00x —
 * four slivers 0.15 m tall). The impact is BOTH: a 1.69x occlusion ratio means ~41%
 * of it never reached the screen, because eleven shards and the crack flash all spawn
 * at `ctx.position` — which is the hit point, i.e. INSIDE the body that was hit — and
 * have to fly out of a silhouette whose visible half-width is ~0.55 m before they can
 * be seen at all. That is `docs/LESSONS.md` §1's repeat offender ("start outside the
 * silhouette, not inside it"), and scaling this up without also moving it out would
 * have produced a bigger invisible effect.
 *
 * So: shards start on the RIM (`IMPACT_RIM`) and are sized in `GLASS_UNIT`s.
 */
const GLASS_UNIT = CHARACTER_HEIGHT * 0.075; // 0.158 m
/**
 * The impact's own unit, larger than the cast's.
 *
 * Both beats used to share `GLASS_UNIT`, and re-measuring after the rim fix showed
 * why they should not (`tools/tmp/vfx_wcov.mjs`, 800x450 readback, peak slice, against
 * a 300 px floor and the generic impact's 3,098 px):
 *
 *                     shipped  +nodepth  +scale4   occl    size
 *     Glass.cast          459       636    8,978   1.39x   19.6x   ✓ over floor
 *     Glass.impact        264       264    2,935   1.00x   11.1x   ✗ under floor
 *
 * The rim move did its job — occlusion is 1.00x, i.e. NOTHING is hidden any more, so
 * `docs/LESSONS.md` §1's precondition for scaling ("prove it is not buried first") is
 * met and size is the only remaining cause. And unlike every other under-floor row in
 * the roster, Glass Shards is a ONE-pellet weapon (`rules.ts`: no `pellets` field, 7
 * damage, `effect: 'stun'`) — Burrito's Swarm at 113 px fires four at once and Soup's
 * Splash at 312 px fires three, so their per-pellet numbers composite on screen and
 * this one does not. 264 px is what the player actually gets, for the roster's only
 * stun application.
 *
 * 0.10 rather than 0.075 is 1.33x linear ~ 1.78x area on a scatter that measured
 * essentially area-proportional (4x linear -> 11.1x delivered).
 *
 * The CAST keeps `GLASS_UNIT`: it clears the floor already, and `game/vfx.ts`'s
 * subordinate muzzle anchor is deliberately the load-bearing part of a cast beat.
 */
const IMPACT_UNIT = CHARACTER_HEIGHT * 0.10; // 0.210 m
/** Radius the shatter is born on. `CHARACTER_RADIUS` is the sim's collision radius
 * (1.05 m); 0.5 of it puts the shards at the edge of the visible silhouette rather
 * than at its centre, without throwing them so wide they stop reading as this hit. */
const IMPACT_RIM = CHARACTER_RADIUS * 0.5;
/** An octahedron stretched into a thin sliver — angular and faceted, the opposite
 * silhouette language from Tomato's rounded blob geometry. This IS the "hard and
 * brittle" identity; everything else in this file is built to move debris shaped
 * like this convincingly. */
const shardGeo = new THREE.OctahedronGeometry(SHARD_RADIUS, 0);
shardGeo.scale(0.55, 1.7, 0.55);
const glintGeo = new THREE.SphereGeometry(SHARD_RADIUS * 0.24, 6, 6);

/** Small fixed pool of material instances, cycled round-robin — see the identical
 * helper (and its doc comment) in `hamburger.ts`; independently-fading simultaneous
 * shards each need their own `opacity`/`color`, hence a pool instead of one shared
 * material or a `.clone()` per spawn. */
function materialPool<T extends THREE.Material>(size: number, build: () => T): () => T {
  const pool = Array.from({ length: size }, build);
  let i = 0;
  return () => pool[i++ % size];
}

// `depthWrite: false` — THREE defaults it true even on a `transparent` material, so
// without it every shard silently occludes whatever is behind it
// (`docs/LESSONS.md` §1's silent-occluder trap).
const nextShardMat = materialPool(24, () => new THREE.MeshBasicMaterial({ color: '#BFEFFF', transparent: true, opacity: 0.8, depthWrite: false }));
const nextGlintMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#FFFFFF', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false,
}));
const nextFlashMat = materialPool(6, () => new THREE.MeshBasicMaterial({
  color: '#EAFBFF', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
}));

/** A small loose cluster of shards around the origin, plus one bright glint sprite
 * (its own child, tagged via `userData.__glint` so `trail()` can find and animate it
 * without touching the shards). Used for both the in-flight projectile and the cast
 * wind-up puff. */
function buildShardCluster(color: string): THREE.Group {
  const group = new THREE.Group();
  const count = 4;
  for (let i = 0; i < count; i++) {
    const mat = nextShardMat();
    mat.color.set(color);
    const shard = new THREE.Mesh(shardGeo, mat);
    const ang = (i / count) * Math.PI * 2;
    shard.position.set(
      Math.cos(ang) * SHARD_RADIUS * 0.5,
      (Math.random() - 0.5) * SHARD_RADIUS * 0.6,
      Math.sin(ang) * SHARD_RADIUS * 0.5,
    );
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    shard.scale.setScalar(0.6 + Math.random() * 0.5);
    group.add(shard);
  }
  const glint = new THREE.Mesh(glintGeo, nextGlintMat());
  group.add(glint);
  group.userData.__glint = glint;
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mega Splash — the four-beat gesture, module-scope singletons
//
// ⚠️ EVERY DIMENSION HERE IS A FRACTION OF `CHARACTER_HEIGHT`, and every TIME is a
// fraction of `ctx.castMs`. Both matter for a different reason:
//
//   * sizes, because this file's own Glass block records what happens when a beat is
//     sized against a projectile radius instead — 21 delivered pixels, i.e. absent;
//   * times, because `castMs` is per weapon (1100 ms specified for the two
//     `meleeHeavy` ultimates, 1500 for `lollipop.Giant`) and a hook that hard-codes
//     "0.3 s of rising" would be silently wrong the moment anything retunes it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The bottle silhouette's unit. One `MEGA_UNIT` is the height of the bottle that
 * launches; the merged giant is `GIANT` times it.
 *
 * ⚠️ **0.55 FIRST, AND THE RENDERED PNG SAID NO.** At `CHARACTER_HEIGHT * 0.55` the
 * launched bottle stands 1.16 m against a 2.10 m character — on screen it read as two
 * blue pips roughly the size of his own cap, and "he launches HIMSELF up" was not a
 * thing anyone could see happening. This is the size failure this file's Glass block
 * already records twice (a cast beat at 21 delivered pixels, an impact at 264, both
 * because they were authored against a projectile radius). It is now HIS OWN HEIGHT,
 * so the thing in the air is unmistakably him, and the giant is 2.05x that — 4.3 m,
 * roughly twice a fighter, which is what "one giant bottle" has to mean to be worth
 * an ultimate slot.
 */
const MEGA_UNIT = CHARACTER_HEIGHT * 1.0; // 2.100 m

/**
 * A bottle, in three parts, at unit height 1.0 with its base at local y = 0.
 *
 * Built as a small hierarchy rather than one mesh because the CAP has to come OFF —
 * that is the second clause of the card — so it needs its own transform. The shell is
 * deliberately a soft-shouldered cylinder rather than a box: this is the one
 * transmissive character in the cast (`rules.ts` calls the model *"translucent blue
 * bottle, darker cap"*) and the VFX has to read as the same object the player selected
 * in the lobby, or the ultimate looks like it belongs to someone else.
 */
const megaBodyGeo = new THREE.CylinderGeometry(0.30, 0.36, 0.66, 14, 1, false);
const megaShoulderGeo = new THREE.SphereGeometry(0.30, 14, 8);
const megaNeckGeo = new THREE.CylinderGeometry(0.15, 0.24, 0.16, 12, 1, false);
const megaCapGeo = new THREE.CylinderGeometry(0.185, 0.185, 0.14, 12, 1, false);
/** The water INSIDE the shell — an opaque glossy liquid seen through a transmissive
 * one, which is the construction `rules.ts` specifies for the character and the reason
 * this is a second, slightly smaller body rather than a tint on the first. */
const megaFillGeo = new THREE.CylinderGeometry(0.26, 0.31, 0.60, 12, 1, false);
/** One airborne droplet / one rising streak. Stretched on Y at spawn.
 * `0.035` first; at that radius a streak was 0.06 x 0.19 m and delivered nothing —
 * the same authored-but-invisible failure as the bottle above, one order down. */
const megaDropGeo = new THREE.SphereGeometry(CHARACTER_HEIGHT * 0.09, 7, 6);
/** The poured column at the resolve, and the ground splash ring. */
const megaColumnGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
const megaRingGeo = new THREE.RingGeometry(0.72, 1.0, 28);

const nextShellMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#7FD4F5', transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
}));
/**
 * 🚨 THE LIQUID INSIDE THE BOTTLES AND THE AIRBORNE STREAKS ARE SEPARATE POOLS, AND
 * MERGING THEM IS A REAL BUG THAT THIS FILE ALREADY HAD.
 *
 * `materialPool` is round-robin. One gesture builds 2 bottle fills and 16 streaks; with
 * one pool of 10 the streaks wrap round and land on the SAME material instances as the
 * fills. The streak animation drives `opacity` to zero as it rises, so the two bottles'
 * water silently emptied partway through the wind-up — measured as the gesture peaking
 * at 27,174 px at t=900 ms and collapsing to ~730 px of bespoke contribution by t=1100,
 * i.e. **the payoff frame was the emptiest one**. Nothing about the code looked wrong;
 * the sharing is invisible at the call site. Pool sizes here are therefore >= the number
 * of simultaneous users of that pool, per gesture.
 */
const nextWaterMat = materialPool(4, () => new THREE.MeshBasicMaterial({
  color: '#BFEFFF', transparent: true, opacity: 0.9, depthWrite: false,
}));
const nextStreakMat = materialPool(20, () => new THREE.MeshBasicMaterial({
  color: '#BFEFFF', transparent: true, opacity: 0.9, depthWrite: false,
}));
const nextCapMat = materialPool(6, () => new THREE.MeshBasicMaterial({
  color: '#1E90D8', transparent: true, opacity: 0.95, depthWrite: false,
}));
/** ⚠️ `#EAFBFF` at 0.9 first, and on the rendered sheet it was a near-white halo the
 * size of the whole footprint — additive white at that scale stops being a highlight and
 * becomes a bloom that eats the telegraph underneath it. Kept additive (this is light on
 * water, and `docs/LESSONS.md` is explicit that desaturating is not the fix here) but
 * pulled back toward the character's own cold blue so it reads as WATER catching light
 * rather than as a generic flare. */
const nextGlowMat = materialPool(8, () => new THREE.MeshBasicMaterial({
  color: '#8FD9F7', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
}));

/**
 * One bottle at unit scale, base at local y=0, NAMED throughout.
 *
 * 🚨 The names are not decoration. An unnamed mesh is invisible to every diagnostic in
 * this repo — ablation, part maps and the coverage probes all key on `name` — and the
 * standing finding this whole effect is measured against (a bespoke sculpt delivering
 * 36 px against a generic path's 686, at a perfectly respectable hue) was only
 * diagnosable because the parts could be addressed individually.
 */
function buildMegaBottle(name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;

  const shellMat = nextShellMat();
  const body = new THREE.Mesh(megaBodyGeo, shellMat);
  body.name = `${name}Body`;
  body.position.y = 0.33;

  const shoulder = new THREE.Mesh(megaShoulderGeo, shellMat);
  shoulder.name = `${name}Shoulder`;
  shoulder.position.y = 0.66;
  shoulder.scale.set(1, 0.62, 1);

  const neck = new THREE.Mesh(megaNeckGeo, shellMat);
  neck.name = `${name}Neck`;
  neck.position.y = 0.80;

  const fill = new THREE.Mesh(megaFillGeo, nextWaterMat());
  fill.name = `${name}Fill`;
  fill.position.y = 0.30;

  const cap = new THREE.Mesh(megaCapGeo, nextCapMat());
  cap.name = `${name}Cap`;
  cap.position.y = 0.93;

  g.add(body, shoulder, neck, fill, cap);
  g.userData.__cap = cap;
  g.userData.__fill = fill;
  return g;
}

export const waterbottleWeaponVfx: CharacterWeaponVfxMap = {
  /**
   * MEGA SPLASH — the card, drawn.
   *
   * ── The four beats, as fractions of `castMs` ─────────────────────────────────
   *
   *     0.00 - 0.38   LAUNCH        he leaves the ground: the bottle rises out of a
   *                                 burst of water at his feet, spinning up
   *     0.22 - 0.62   THE CAP GOES  the cap lifts off the neck, and on the way up it
   *                                 stops being a cap and becomes a second bottle
   *     0.55 - 0.88   THE MERGE     the two converge on one point and scale into ONE
   *                                 bottle, far bigger than either
   *     0.88 - 1.00   THE TIP       the giant fills bright and tilts toward the target
   *
   * The beats OVERLAP on purpose. A strictly sequential wind-up has a dead frame at
   * every seam, and a dead frame is exactly what the sustain floor this effect is
   * measured against exists to catch: `tools/tmp/tg_tele.mjs` reports the MINIMUM
   * 100 ms slice across the whole cast, not the peak, because the failure this project
   * has on record is an authored effect that peaks well and is invisible either side
   * of the peak.
   *
   * ── Why the whole thing is ONE transient ─────────────────────────────────────
   *
   * `game/vfx.ts` tears a telegraph down when the sim cancels the cast (an applied
   * stun, or the caster dying) by removing every transient tagged with the caster. One
   * object with one `onUpdate` means an interrupt removes the gesture whole, mid-beat,
   * which is what being interrupted looks like. Twelve independently-scheduled
   * `spawnTransient` calls would each keep playing out their own timeline and the
   * cancel would only take whichever happened to be alive.
   */
  Mega: {
    telegraph(ctx) {
      const T = ctx.THREE;
      const castSec = Math.max(0.2, (ctx.castMs ?? 1100) / 1000);
      const up = ctx.position.clone();
      // The gesture is built at the caster's FEET and rises; `ctx.position` arrives at
      // muzzle height, so drop to the ground plane and let the animation do the lift.
      up.y -= CHARACTER_HEIGHT * 0.55;

      const root = new T.Group();
      root.name = 'megaTelegraph';
      root.position.copy(up);

      const self = buildMegaBottle('megaSelfBottle');
      const spare = buildMegaBottle('megaCapBottle');
      root.add(self, spare);

      // The burst of water he launches out of. Sixteen streaks is enough to read as a
      // ring at 58 degrees without becoming a fog at 20.
      const streaks: THREE.Mesh[] = [];
      const STREAKS = 16;
      for (let i = 0; i < STREAKS; i++) {
        const m = new T.Mesh(megaDropGeo, nextStreakMat());
        m.name = `megaLaunchStreak${i}`;
        m.scale.set(0.8, 2.6, 0.8);
        streaks.push(m);
        root.add(m);
      }

      // The convergence glow — the "together they become one" moment needs a light at
      // the join or the merge reads as two objects overlapping.
      const glow = new T.Mesh(megaRingGeo, nextGlowMat());
      glow.name = 'megaMergeGlow';
      glow.rotation.x = -Math.PI / 2;
      glow.visible = false;
      root.add(glow);

      const capOf = (g: THREE.Group): THREE.Mesh => g.userData.__cap as THREE.Mesh;
      const fillOf = (g: THREE.Group): THREE.Mesh => g.userData.__fill as THREE.Mesh;

      /** Smoothstep on a named beat window. Every beat below reads its own progress
       * out of this so a retuned `castMs` re-times the whole gesture at once. */
      const beat = (t: number, a: number, b: number): number => {
        const k = T.MathUtils.clamp((t - a) / (b - a), 0, 1);
        return k * k * (3 - 2 * k);
      };

      /**
       * How high he goes, and why it is not higher.
       *
       * The match camera looks down at 58 degrees, so vertical distance from the caster
       * turns into screen distance FAST — at `CHARACTER_HEIGHT * 1.15` with the cap
       * riding 1.5 bottle-heights above that, the cap and the second bottle rendered up
       * near the top of the frame, reading as two unrelated objects floating over the
       * arena rather than as this fighter's own cap coming off. Judged on the PNG.
       * Everything in this gesture now stays inside roughly two character heights of
       * the caster, which is where a viewer will connect it to him.
       */
      const APEX = CHARACTER_HEIGHT * 0.85;
      const GIANT = 2.05;

      // `+ 0.06` so the last authored frame is the FULL giant rather than the frame
      // after it — `game/vfx.ts` runs its own tail underneath for the handoff.
      const drive = (_p: number, elapsed: number): void => {
        const t = T.MathUtils.clamp(elapsed / castSec, 0, 1);
        const launch = beat(t, 0.0, 0.38);
        const capGo = beat(t, 0.22, 0.62);
        const merge = beat(t, 0.55, 0.88);
        const tip = beat(t, 0.88, 1.0);

        // ── 1. LAUNCH ────────────────────────────────────────────────────────────
        const selfY = APEX * launch;
        self.position.set(0, selfY, 0);
        // 🚨 A LEAN, NOT A SPIN. `rotation.y` was the first instinct and it is worth
        // recording as a mistake: this bottle is a surface of revolution, so spinning it
        // about its own axis changes NOTHING on screen. And from a 58 degree camera an
        // upright cylinder is a circle — it read as a blue blob. The lean is what makes
        // the silhouette a BOTTLE, because it is what shows the profile.
        self.rotation.z = 0.24 + 0.09 * Math.sin(t * 7);
        const selfScale = MEGA_UNIT * (0.55 + 0.45 * launch);
        self.scale.setScalar(selfScale);

        for (let i = 0; i < STREAKS; i++) {
          const ang = (i / STREAKS) * Math.PI * 2;
          // Each streak lags the one before it — a ring that leaves together reads as
          // one expanding disc, which is the generic effect this is replacing.
          const lag = (i % 4) * 0.06;
          const k = T.MathUtils.clamp((t - lag) / 0.5, 0, 1);
          const s = streaks[i];
          const rad = CHARACTER_RADIUS * (0.6 + 1.5 * k);
          s.position.set(Math.cos(ang) * rad, CHARACTER_HEIGHT * (0.05 + 1.25 * k), Math.sin(ang) * rad);
          s.scale.set(0.8 * (1 - k * 0.4), 2.6 * (1 - k * 0.5), 0.8 * (1 - k * 0.4));
          (s.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k) * (1 - merge);
        }

        // ── 2. THE CAP BECOMES A SECOND BOTTLE ───────────────────────────────────
        // The cap leaves the neck of the launched bottle and, on the way, the second
        // bottle GROWS OUT OF IT: the cap mesh stays visible and full size while its
        // own bottle scales up underneath it, so there is never a frame where a cap
        // and a bottle are two unrelated objects.
        const cap = capOf(self);
        // Local units, so this is multiplied by `selfScale` on the way to the screen —
        // `+ capGo * 1.5` put the cap 4 m over his head. 0.55 keeps it a hand's reach
        // above the neck it came off.
        cap.position.y = 0.93 + capGo * 0.55;
        cap.visible = capGo < 0.98;

        const spareVisible = capGo > 0.02;
        spare.visible = spareVisible;
        if (spareVisible) {
          const spareScale = MEGA_UNIT * (0.06 + 0.62 * capGo);
          spare.scale.setScalar(spareScale);
          const sideOut = CHARACTER_RADIUS * 1.5 * capGo * (1 - merge);
          spare.position.set(sideOut, selfY + selfScale * 0.95 + capGo * CHARACTER_HEIGHT * 0.42, 0);
          spare.rotation.z = -0.30 - 0.10 * Math.sin(t * 6);
          capOf(spare).visible = capGo > 0.5;
        }

        // ── 3. THE MERGE ─────────────────────────────────────────────────────────
        // Both bodies scale toward ONE size at ONE place. The spare fades as it
        // arrives so the pair resolves into a single silhouette rather than into two
        // coincident meshes z-fighting.
        if (merge > 0) {
          const mergedScale = MEGA_UNIT * T.MathUtils.lerp(1.0, GIANT, merge);
          self.scale.setScalar(mergedScale);
          self.position.set(0, APEX + CHARACTER_HEIGHT * 0.25 * merge, 0);
          spare.position.x *= 1 - merge;
          spare.position.y = self.position.y + mergedScale * 0.55;
          self.rotation.z = (0.24 + 0.09 * Math.sin(t * 7)) * (1 - merge * 0.5);
          const spareOut = MEGA_UNIT * T.MathUtils.lerp(0.62, 0.02, merge);
          spare.scale.setScalar(Math.max(0.001, spareOut));

          glow.visible = merge < 0.99;
          glow.position.set(0, self.position.y + mergedScale * 0.45, 0);
          // `0.5 + 1.1 * merge` put the ring's outer edge at 6.9 m — wider than the
          // 4.2 m hitbox it sits over, so the "merge" beat was drawing a halo bigger
          // than the danger zone and burying it. It is a collar on the join now.
          const gs = mergedScale * (0.22 + 0.30 * merge);
          glow.scale.set(gs, gs, gs);
          (glow.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.sin(Math.PI * merge);
        } else {
          glow.visible = false;
        }

        // ── 4. THE TIP ───────────────────────────────────────────────────────────
        // It leans toward where the blow is going. `ctx.direction` is the caster's
        // frozen facing — the sim roots a caster for the whole wind-up, so this is
        // also the direction the hit will actually resolve in, and the telegraph
        // cannot lie about it.
        const lean = tip * 0.85;
        root.rotation.z = -lean * ctx.direction.x;
        root.rotation.x = lean * ctx.direction.z;

        // The water level rises through the whole gesture and goes bright at the tip —
        // "charged" is a value change, not a size change, so it still reads when the
        // silhouette is already as big as it is going to get.
        const fill = fillOf(self);
        const fl = 0.35 + 0.65 * t;
        fill.scale.set(1, fl, 1);
        fill.position.y = 0.30 * fl;
        (fill.material as THREE.MeshBasicMaterial).opacity = 0.75 + 0.25 * tip;
      };
      // Posed BEFORE it is handed to the layer, for the same reason `game/vfx.ts` drives
      // the generic footprint once at spawn: every mesh above is built at its authoring
      // transform, not at its t=0 transform, and whether the first `updateEffects` tick
      // beats the first `render` is a `match.ts` call-order detail this file must not
      // depend on.
      drive(0, 0);
      ctx.spawnTransient(root, castSec + 0.06, drive);
    },

    /**
     * THE DUMP — fired at the RESOLVE.
     *
     * ⚠️ `cast()` no longer means "the button was pressed" for a weapon with `castMs`:
     * the sim emits `weapon-fired` when the cast RESOLVES, so this is the moment the
     * blow lands. That is exactly right for this weapon — the card's verb is *"dumps"*,
     * and a dump is the payoff, not the wind-up. The wind-up is `telegraph()` above.
     */
    cast(ctx) {
      const T = ctx.THREE;
      const ground = ctx.position.clone();
      ground.y -= CHARACTER_HEIGHT * 0.55;

      // The falling column: a wide open cylinder that arrives from above and lands.
      // Open-ended (`megaColumnGeo` is built with `openEnded`) so the camera can see
      // up into it — a capped tube reads as a solid post, not as pouring water.
      const column = new T.Mesh(megaColumnGeo, nextGlowMat());
      column.name = 'megaPourColumn';
      const colR = CHARACTER_RADIUS * 1.35;
      const colH = CHARACTER_HEIGHT * 2.6;
      column.position.set(ground.x, ground.y + colH * 0.5, ground.z);
      column.scale.set(colR, colH, colR);
      ctx.spawnTransient(column, 0.34, (t) => {
        // Falls fast, then splays as it hits: the widening at the end is what sells it
        // as a volume of water rather than as a beam.
        const drop = Math.min(1, t * 2.4);
        const splay = Math.max(0, (t - 0.42) / 0.58);
        column.position.y = ground.y + colH * 0.5 * (1 - 0.55 * drop);
        column.scale.set(colR * (1 + 1.5 * splay), colH * (1 - 0.5 * drop), colR * (1 + 1.5 * splay));
        (column.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t * t);
      });

      // Two ground rings, offset in time — one splash never reads as a volume landing.
      for (let i = 0; i < 2; i++) {
        const ring = new T.Mesh(megaRingGeo, nextGlowMat());
        ring.name = `megaPourRing${i}`;
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(ground.x, ground.y + 0.05 + i * 0.03, ground.z);
        const delay = i * 0.09;
        ctx.spawnTransient(ring, 0.42 + delay, (t) => {
          const k = Math.max(0, (t * (0.42 + delay) - delay) / 0.42);
          const s = CHARACTER_RADIUS * (0.8 + 3.6 * k);
          ring.scale.set(s, s, s);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        });
      }
    },
  },

  Glass: {
    projectile(ctx) {
      const obj = buildShardCluster(ctx.color);
      obj.position.copy(ctx.position);
      return obj;
    },

    // Each shard tumbles independently (glass doesn't spin as one rigid unit the way
    // a solid ball would) and a bright glint flares on and off as a facet catches
    // the light — the "catching light" cue is what a flat/soft weapon like Tomato
    // has no equivalent of.
    trail(ctx) {
      const obj = ctx.object;
      if (!obj) return;
      const dt = ctx.dt ?? 0;
      const glint = obj.userData.__glint as THREE.Mesh | undefined;

      let shardIndex = 0;
      for (const child of obj.children) {
        if (child === glint) continue;
        const speed = 2 + shardIndex * 0.9;
        child.rotation.x += dt * speed;
        child.rotation.y += dt * speed * 0.75;
        shardIndex++;
      }

      if (glint) {
        const mat = glint.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, mat.opacity - dt * 3.2);
        const timer = ((obj.userData.__glintTimer as number | undefined) ?? 0) - dt;
        if (timer <= 0) {
          obj.userData.__glintTimer = 0.14 + Math.random() * 0.3;
          mat.opacity = 1;
          glint.position.set(
            (Math.random() - 0.5) * SHARD_RADIUS,
            (Math.random() - 0.5) * SHARD_RADIUS,
            (Math.random() - 0.5) * SHARD_RADIUS,
          );
        } else {
          obj.userData.__glintTimer = timer;
        }
      }
    },

    // The shatter: an instant cold-white crack flash (not the generic burst's warm
    // gold pop), then a wide scatter of angular debris flung outward AND downward
    // (glass falls fast, it doesn't drift) — sharp, brief, brittle, in contrast to
    // Tomato's soft settling splatter.
    impact(ctx) {
      const origin = ctx.position;
      /** Scale that turns one `shardGeo` (built at `SHARD_RADIUS`) into one
       * `IMPACT_UNIT`. Everything below is in units, not in shard-radii. */
      const U = IMPACT_UNIT / SHARD_RADIUS;

      // The crack flash: 0.30 -> 0.72 units (~0.11 -> 0.26 m of radius on a 2.10 m
      // character). Was 2 -> 7 GLINT radii = 0.043 -> 0.151 m.
      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(origin);
      flash.scale.setScalar(1.25 * U);
      ctx.spawnTransient(flash, 0.14, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(1.25, 3.0, t) * U);
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      });

      const sizeFactor = THREE.MathUtils.clamp(1 + ctx.damage * 0.06, 1, 2.4);
      const shardCount = 11;
      for (let i = 0; i < shardCount; i++) {
        // Evenly spaced plus jitter rather than fully random: eleven uniform draws
        // clump, and a clumped shatter starting on a rim reads as one blob leaving
        // one side rather than as glass breaking.
        const ang = (i / shardCount) * Math.PI * 2 + Math.random() * 0.5;
        const speed = (1.6 + Math.random() * 2.4) * sizeFactor;
        const mat = nextShardMat();
        mat.color.set(ctx.color);
        const shard = new THREE.Mesh(shardGeo, mat);
        // 0.42 -> 0.85 units per sliver (was 0.4-0.95 SHARD radii).
        const scale = (0.42 + Math.random() * 0.43) * U * sizeFactor;
        shard.scale.setScalar(scale);
        // Born on the rim of the silhouette, not at the hit point inside it.
        const ox = origin.x + Math.cos(ang) * IMPACT_RIM;
        const oy = origin.y;
        const oz = origin.z + Math.sin(ang) * IMPACT_RIM;
        shard.position.set(ox, oy, oz);
        const vy = 1.1 + Math.random() * 1.6;
        const gravity = -9;
        const spinX = (Math.random() - 0.5) * 22;
        const spinY = (Math.random() - 0.5) * 22;
        ctx.spawnTransient(shard, 0.38 + Math.random() * 0.2, (t, elapsed) => {
          shard.position.set(
            ox + Math.cos(ang) * speed * elapsed,
            oy + vy * elapsed + 0.5 * gravity * elapsed * elapsed,
            oz + Math.sin(ang) * speed * elapsed,
          );
          shard.rotation.x = elapsed * spinX;
          shard.rotation.y = elapsed * spinY;
          shard.scale.setScalar(scale * (1 - t * 0.25));
          (shard.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
        });
      }
    },

    // A quick glinting puff at the attacker as the shards materialise/wind up —
    // angular and cold, distinct from the generic soft circular flash (and from
    // Tomato's soft red squeeze cue).
    cast(ctx) {
      // 2.3x the old linear size. `game/vfx.ts`'s subordinate muzzle anchor now
      // carries the "a weapon fired" beat for every bespoke cast, so this only has to
      // read as GLASS on top of it — but at 0.15-0.90 cluster scale the four slivers
      // spanned ~0.15 m total and delivered 21 px, which is not "quiet", it is absent.
      const U = GLASS_UNIT / SHARD_RADIUS;
      const cluster = buildShardCluster(ctx.color);
      cluster.position.copy(ctx.position);
      cluster.scale.setScalar(0.35 * U);
      ctx.spawnTransient(cluster, 0.16, (t) => {
        const grow = Math.min(1, t * 2.2);
        const shrink = t > 0.55 ? 1 - (t - 0.55) * 2.2 : 1;
        cluster.scale.setScalar(THREE.MathUtils.clamp(0.35 + grow * 0.75, 0.1, 1.15) * U * Math.max(0, shrink));
        cluster.rotation.y = t * 5;
      });

      const flash = new THREE.Mesh(glintGeo, nextFlashMat());
      flash.position.copy(ctx.position);
      flash.scale.setScalar(0.8 * U);
      ctx.spawnTransient(flash, 0.12, (t) => {
        flash.scale.setScalar(THREE.MathUtils.lerp(0.8, 1.9, t) * U);
        (flash.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      });
    },
  },
};
