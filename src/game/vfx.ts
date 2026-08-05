/**
 * Ground-truth VFX layer: projectiles, splats, Donut's sticky trail marks, and every
 * ability/game-feel effect (muzzle flashes, melee sweeps, impact bursts, status
 * telegraphs, deaths, Lollipop's Giant Lollipop).
 *
 * The sim owns projectiles/splats/trailMarks — `sync()` keeps one THREE.Mesh per live
 * entry by id (see `syncPool`). Everything else here is TRANSIENT: one-shot effects
 * the sim has no notion of, driven by explicit `spawn*` calls from `match.ts`'s event
 * handling, advanced each frame by `updateEffects(dt)`. Every transient effect is
 * backed by a small fixed-size pool of pre-built THREE objects (Sprites/Meshes with
 * cached geometry/materials) that get reconfigured and reused — nothing is allocated
 * per frame or per spawn, matching the discipline the projectile/splat/trail pools
 * already established.
 *
 * ── GameEvent kinds this layer deliberately does NOT draw ──────────────────────
 *
 * The event stream has two consumers (this and `audio/`), and they do not have to
 * cover the same set. Recorded here so "no visual" is never mistaken for "nobody
 * looked":
 *
 * - **`match-ended` from `resolveTimeout`** — a match can now end on the clock with
 *   BOTH fighters alive. No world-space VFX, on purpose: every effect in this file is
 *   anchored to a world position (a hit, a cast, a death) and a timeout has none.
 *   `sim.ts` emits no `death` and leaves both fighters `alive`, so a death burst would
 *   be a lie about what happened. The moment is carried by the HUD clock, the
 *   game-over card and audio's own cue. What this layer owes the timeout is to stop
 *   cleanly — see `arena/fogRing.ts`'s `FADE_OUT_SECONDS`, which exists because the
 *   boundary used to vanish in one frame while carrying 27% of the frame's luminance.
 * - **`countdown-tick` / `match-started`** — HUD moments with no world position. Same
 *   reasoning.
 * - **`projectile-destroyed` with reason `expired`** — a projectile fading out at max
 *   range. Not a collision, and it happens on every over-range shot in the game;
 *   marking those would put sparks on the floor several times a second. `audio/` skips
 *   it for the same reason, which is the point: the two consumers of this stream are
 *   allowed to differ, but where they differ it should be on purpose.
 *
 * `projectile-destroyed` with reason `hit-cover` USED to be on this list, labelled
 * *"a GAP, not a decision"*. It is now `spawnCoverScuff` — `audio/director.ts` was
 * already playing `coverThud()` for it, so a shot stopping dead on a counter had a
 * sound and no picture. `hit-target` needs nothing here: `hit-landed` fires alongside
 * it and brings the impact burst.
 */

import * as THREE from 'three';
import type { FighterRole, MatchState, Projectile, Splat, TrailMark, Vec2 } from './state';
import { SPLAT_RADIUS, TRAIL } from './rules';
// The sim's own predicate for "may this status be applied yet", exported by
// `combat.ts` specifically so this layer can render the shrug-off window without
// re-deriving the arithmetic (see its doc comment). Importing it rather than copying
// `until + grace` means a change to the rule cannot silently desync the visual from
// the mechanic — which is how `docs/LESSONS.md` §7 got ten contradicting elements.
import { statusReadyAt } from './combat';
import { CHARACTERS } from './rules';
import type { CharacterId, Weapon } from './rules';
import { CHARACTER_HEIGHT, CHARACTER_RADIUS, groundPos, wu } from '../units';
import { flatMat } from '../render/toon';
// Per-weapon bespoke VFX extension point (see `vfx/weapons/types.ts` for the full
// `WeaponVfx` contract). `getWeaponVfx()` returns `undefined` for any weapon with no
// bespoke entry — every call site below falls back to this file's existing generic
// projectile/impact/cast behaviour in that case, unchanged from before this system
// existed.
import { getWeaponVfx } from '../vfx/weapons';
import type { WeaponVfx, WeaponVfxCtx } from '../vfx/weapons/types';

declare global {
  interface Window {
    /** QA-only counters, bumped once per `spawn*` call below — lets a Playwright
     * driver `waitForFunction` on the exact frame a specific effect fires instead of
     * guessing at screenshot timing for effects that live well under a second.
     * Never read by game logic. */
    __vfxQaCounts?: Record<VfxQaKey, number>;
    /**
     * QA-only: fire one effect on demand at a world position, bypassing the sim
     * entirely. Never called by game logic — it exists because DRIVING a specific
     * effect through real gameplay is unreliable enough to have burned real time:
     * the AI kites, so scripted melee often never connects, and a probe that waits
     * for a hit can time out while the safe zone closes and kills the subject
     * instead. Nine per-weapon VFX agents are queued behind this file, and each of
     * them needs to see its own effect on demand, repeatably, to judge it.
     *
     * Published by `VfxLayer`'s constructor, cleared by `dispose()`.
     */
    __vfxSpawnTest?: (kind: VfxSpawnTestKind, xWU: number, yWU: number, amount?: number, color?: string, who?: CharacterId, weaponKey?: string) => void;
    /**
     * QA-only handle on the live `VfxLayer`, in the same spirit as `window.__stage`
     * and `window.__audio`. Never read by game logic.
     *
     * `__vfxSpawnTest` fires ONE effect and returns nothing; a coverage probe needs
     * to hand-crank `updateEffects()` in exact millisecond slices (see
     * `tools/tmp/lolliv.mjs`'s virtual clock) and to drive `sync()` with a synthetic
     * `MatchState` so the sim-owned pools (projectiles / splats / trail marks) and
     * the status telegraphs (slow ring + tint, stun stars) can be measured without
     * waiting on real gameplay — fighters spawn 1080wu apart and every weapon reaches
     * at most 140wu, so probes that wait for a real hit time out.
     *
     * Published by the constructor, cleared by `dispose()`.
     */
    __vfxLayer?: VfxLayer;
    /** QA-only per-tick fighter snapshot, refreshed every `sync()` call — lets a
     * Playwright driver steer input off real positions/HP/terrain-slow state instead
     * of guessing from rendered pixels (e.g. to script a player walking into a puddle
     * while dodging the AI). Never read by game logic. */
    __vfxDebugFighters?: Record<FighterRole, { x: number; y: number; hp: number; alive: boolean; terrainSlowFactor: number }>;
  }
}

type VfxQaKey = 'cast' | 'meleeArc' | 'impact' | 'death' | 'heal' | 'giantSlam' | 'puddleSplash' | 'coverScuff';

/**
 * Every kind `window.__vfxSpawnTest` can fire. A superset of `VfxQaKey`: the QA
 * counter and the QA spawner covering different subsets is how a coverage audit ends
 * up with blind spots, and this file's own history says the blind spot is where the
 * bug lives (`docs/LESSONS.md` §1). The first version wired only
 * `impact`/`death`/`cast`, so `meleeArc`, `heal`, `giantSlam` and `puddleSplash` —
 * four of the seven counted effects — could not be fired on demand at all and had
 * never been measured.
 *
 * `'weaponFired'` is the one entry that is not a single effect. It runs
 * `spawnWeaponCast`, i.e. exactly what `match.ts` fires for one `weapon-fired` event,
 * so a probe measures the SUM the player sees rather than a composition it assembled
 * itself. Giant Lollipop is on record as three separately-measured passes nobody had
 * ever measured together (`spawnWeaponCast`); a QA hook that can only fire one at a
 * time is how that stays true.
 */
type VfxSpawnTestKind = VfxQaKey | 'weaponFired';

function bumpVfxQaCount(key: VfxQaKey): void {
  window.__vfxQaCounts ??= { cast: 0, meleeArc: 0, impact: 0, death: 0, heal: 0, giantSlam: 0, puddleSplash: 0, coverScuff: 0 };
  window.__vfxQaCounts[key]++;
}

/** Metres off the ground projectiles fly at — roughly chest height on the cast. */
const PROJECTILE_HEIGHT = 0.5;

/**
 * Clearance every flat VFX decal in this file is expressed against, in metres.
 *
 * ── Do not take this number from a comment, including this one ─────────────────
 *
 * The old heights (SPLAT 0.17, TRAIL 0.19, GROUND_VFX 0.24) were chosen against a
 * documented stack of "floor pads 0.045-0.048, seams 0.062, baked shadows
 * 0.068-0.07, prop kicks 0.08, arena decals 0.15-0.25". That stack has moved. Walked
 * live out of the running scene (`tools/tmp/vfx_layers.mjs`, which transforms all
 * eight bbox corners rather than trusting a constant), the arena's floor-level
 * OPAQUE, DEPTH-WRITING geometry now tops out at:
 *
 *     puddle disc          0.150   pipe_foot_step   0.175   cover_plinth   0.200
 *     foot meshes          0.159   debris_veg       0.182   floor_drain    0.230
 *     hub_debris_veg       0.172   cart_wheel       0.190   puddle_wet_rim 0.250
 *                                                           hazard_ring    0.252
 *
 * Counting only in-arena meshes (the apron's 784 pieces sit outside the playfield),
 * the number of opaque depth-writing surfaces standing ABOVE each old decal plane
 * was **62 at SPLAT_Y, 39 at TRAIL_Y, 17 at GROUND_VFX_Y** — every one of them a
 * place where a splat, a sticky-trail mark or a melee arc is silently clipped. At
 * 0.30 the only things left above are raised prop BODIES (pot crate, sack pallet,
 * chalkboard leg), which a ground decal is supposed to go behind.
 *
 * Cost of the lift: a ground decal at height h on a 58-degree camera appears
 * `h / tan(58)` = 0.625h further from the camera than the point it marks, so moving
 * 0.17 -> 0.30 adds 0.081 m ≈ 1.6 world units of registration error — under 4% of a
 * 42 wu character. Cheap against 62 clipping surfaces.
 *
 * The tiny separations between the four planes below are DOCUMENTATION, not
 * z-fighting insurance: every material in this layer sets `depthWrite: false`, so
 * VFX decals cannot occlude or z-fight each other at all, and their mutual layering
 * is decided by `renderOrder` (3/4 status rings, 5 wedges, 6 rings, 10/11 sprites).
 */
const GROUND_CLEAR_Y = 0.30;
/** Ground-decal layer heights. See `GROUND_CLEAR_Y` for how these were derived. */
const SPLAT_Y = GROUND_CLEAR_Y;
const TRAIL_Y = GROUND_CLEAR_Y + 0.01;

// ── Ability VFX layer heights/sizes (metres) ────────────────────────────────────
/** Chest-ish height for impact flashes/shards, so hits read as landing ON the
 * character rather than at their feet. */
const IMPACT_HEIGHT = 1.15;
const CAST_HEIGHT = 1.25;
/** Above splats/trail marks so melee sweeps and impact rings always render on top. */
const GROUND_VFX_Y = GROUND_CLEAR_Y + 0.02;
const STATUS_RING_Y = GROUND_CLEAR_Y + 0.04;
/**
 * Orbiting stun stars — geometry, and why it moved.
 *
 * The old pair (height 1.04x, radius 0.42 m) put three sprites in a 0.42 m circle
 * around a head whose own radius is ~0.48 m: **the whole orbit was inside the head.**
 * That is survivable for an opaque decal and fatal for this one, because these sprites
 * are ADDITIVE and the head is the brightest, warmest surface in the frame — additive
 * `#FFE75E` over a bun at `rgb(254,191,109)` clips to white and disappears into it.
 * `docs/LESSONS.md` §1 names exactly this ("additive blending over this bright warm
 * floor makes a wash, not a core"); nobody had checked it against the CAST.
 *
 * It measured as a spawned-but-unreadable effect, which is the tell: 369 delivered
 * pixels at mean delta 47 against the slow ring's 1,856 at 116 — and an ablation put
 * the occlusion ratio at **1.01x**, i.e. nothing was hiding them. Not buried, washed
 * out. The judgement frame at the stun's own peak showed a completely ordinary
 * character.
 *
 * So the orbit is now WIDER than the head instead of narrower, which puts each star
 * against floor or backdrop for most of its circle. Height stays at the head top and
 * is deliberately NOT raised further: `match.ts`'s floating HP bar sits at
 * `CHARACTER_HEIGHT + 0.35` = 2.45 m, and it is DOM composited over the canvas, so
 * anything drawn up there is behind an opaque pill.
 */
const STUN_STAR_HEIGHT = CHARACTER_HEIGHT;
const STUN_STAR_RADIUS = 0.85;
/**
 * Sprite size in metres, and the star count, both set by measurement rather than by
 * eye — and note the pixel count went DOWN on the way to being readable, which is
 * why "delivered pixels" alone is never the whole test.
 *
 *   before (glowTex, r 0.42, scale 0.34, x3)   369 px, mean delta 47 — invisible in
 *                                              the judgement frame; a soft additive
 *                                              blob composited inside the bun
 *   after  (starTex, r 0.85, scale 0.50, x3)   181 px, mean delta 84 — VISIBLE, two
 *                                              distinct sparkles clear of the body
 *
 * Half the pixels, twice the contrast, and the difference between "measurable" and
 * "readable". `starTex` fills far less of its own quad than `glowTex` does (a 0.16
 * core plus thin spikes against a full radial gradient), so the same footprint buys
 * fewer lit pixels — but they are hard-edged pixels on the floor instead of a
 * gradient dissolving into a clipping highlight.
 *
 * 0.68 m and four stars is then a straight legibility bump on top of that: ~1.85x the
 * area each and a fourth point to close the ring, so it reads as an orbit rather than
 * as two unrelated sparkles. 0.68 m is 32% of a character, the same band the puddle
 * splash (0.58-0.78) was re-scaled to after the same kind of measurement.
 */
const STUN_STAR_SCALE = 0.68;
const STUN_STAR_COUNT = 4;

// ── Status shrug-off ("ward") telegraph ─────────────────────────────────────────
/**
 * `combat.ts` refuses a stun/slow that is already running AND for `STUN_GRACE_MS` /
 * `SLOW_GRACE_MS` (500 ms each) after it expires. That bounded the worst movement lock
 * from 11.02 s to 2.00 s and re-application from 61.2% to 0.0% — and it is invisible.
 *
 * **Nothing is not the same as immune.** A refused stun currently draws no stun ring,
 * which is *correct* and *useless*: a Cheese Blind that visibly does nothing reads as a
 * bug in the game, not as a rule to play around. This is the same failure as
 * `docs/LESSONS.md` §1 case 10, where a dark-on-dark cooldown wipe had three critics
 * across three rounds report "no visible cooldown".
 *
 * So the rule gets TWO signals, and they answer different questions:
 *
 *  - **The STATE** — a dashed band at the feet of any fighter inside a grace window.
 *    This is the one that makes the rule playable: an attacker can see the target is
 *    currently immune *before* spending a stun on them. It is drawn only during GRACE,
 *    never while the status is active, because an active status already has a loud
 *    telegraph of its own (frost ring + body tint, or orbiting stars) and stacking a
 *    third ring on it is clutter, not information.
 *  - **The INSTANT** — the band pops bright, scaled up and tinted to the colour of the
 *    effect that just bounced. This is what separates "shrugged off" from "missed": a
 *    miss produces no `hit-landed` at all and therefore no impact burst; a refused hit
 *    produces the full burst (damage still lands) PLUS this pop.
 *
 * ── Why DASHED, and why achromatic ─────────────────────────────────────────────
 *
 * The visual grammar is "same family, broken ring" = *this effect, not landing*. Broken
 * rather than differently-coloured because every hue on this floor is already claimed
 * (`arena/shared.ts`: rose 330-340 walkable, violet 258-268 blocking, 0-60 cast) and
 * the slow ring already owns near-white. Structure is free; hue is not. The resting
 * band is achromatic and dim, and only the POP borrows the refused effect's colour —
 * so the persistent state costs zero chroma budget and the instant carries the
 * information about *which* effect bounced.
 *
 * It counter-rotates against the slow ring on purpose: the two can be on screen at
 * once (a slow that is active on one fighter, a grace window on the other) and
 * opposite spin is readable at gameplay distance where a radius difference is not.
 */
/**
 * Radii, and a note that this file earned the hard way TWICE IN ONE SESSION.
 *
 * First cut was 0.40-0.56 m, sized by eye as "a small band at the feet". Measured:
 * **2 delivered pixels, and 128 with depth testing off — a 64x occlusion ratio.** The
 * band was drawn entirely underneath the fighter standing on it, exactly like the heal
 * pulse and the puddle splash repaired a few hundred lines above. A ground ring at a
 * character's feet has to clear the character, and on this camera that means outside
 * ~0.6 m, not inside it.
 *
 * 0.70-0.92 sits just outside the slow ring's 0.64-0.86, which is the pair already
 * proven to deliver (1,850 px at a 1.06x occlusion ratio). The two are never active on
 * the same fighter — the band draws only during GRACE, after the status has expired —
 * so the near-identical radius costs nothing, and on two different fighters at once
 * the dashes and the opposite spin carry the distinction.
 */
const WARD_RING_INNER = 0.70;
const WARD_RING_OUTER = 0.92;
const WARD_DASHES = 7;
/** Fraction of each dash cell that is solid. 0.55 keeps the gaps unmistakable at
 * gameplay distance — a finer dash reads as a solid ring and loses the whole cue. */
const WARD_DASH_DUTY = 0.55;
/** Resting alpha of the band. 0.6 against the ACTIVE slow ring's 0.9 — the grace
 * state is real information but it is not urgent, and a resting band as loud as an
 * active status would flatten the difference between "you are stunned" and "a stun
 * would not land right now". */
const WARD_RESTING_OPACITY = 0.6;
/** Seconds the refusal pop takes to fall back to the resting band. Deliberately
 * shorter than `STUN_GRACE_MS` so the pop reads as an event inside the state rather
 * than as the state itself. */
const WARD_POP_SECONDS = 0.32;
const WARD_NEUTRAL = new THREE.Color('#F2F6FF');

// ── Slow feedback (design change) ───────────────────────────────────────────────
// The arena's grease/water puddles used to carry a whole "make this shout HAZARD"
// visual language of their own (glow halo, bold accent ring, warning icons — see
// `arena/hazards.ts`), chasing an accent colour that could mean "you'll be slowed
// here" without colliding with an existing genre convention. Five critic rounds
// plateaued at 6/10 doing that; every hue was already claimed by something else
// (magenta = lethal, violet = loot, green = heal/toxic, yellow = ordinary floor,
// cyan = water itself). Uri's fix: stop asking the PUDDLE's colour to carry that
// meaning at all. A puddle just has to look like a puddle (see `hazards.ts`); the
// "you are currently slowed" feedback moves onto the CHARACTER instead, where the
// player is already looking. It has to read identically regardless of which of the
// two slow sources caused it — a puddle underfoot (`Fighter.terrainSlowFactor`, the
// sim's read-only per-tick observation) or a weapon's own `status.slowedUntil`
// timer — so both are treated as one `slowed` signal below (see `sync()`).
/**
 * Cool blue wash — reads as "wet/cold/dragging" at a glance without competing with
 * any character's own palette.
 *
 * Brighter and more chromatic than the first pass (`#5C8FB0`), for a compositing
 * reason rather than a taste one. Alpha-blending a MID-value blue over a bright warm
 * character just averages toward grey — the result loses saturation but never gains a
 * cool cast, so it reads as "slightly dirty", not "chilled". To flip the hue the tint
 * has to be brighter in blue than the character is: our warmest cast member's bun sits
 * near `rgb(254,191,109)` (B=109), so a tint at B≈224 pulls the composited blue above
 * the composited red and the character visibly turns cold.
 */
const SLOW_TINT_COLOR = new THREE.Color('#63A8E0');
/**
 * Tint-sprite footprint, in metres. It reuses `glowTex` (a soft RADIAL gradient,
 * hottest dead-centre, fading equally toward every edge) stretched non-uniformly via
 * `Sprite.scale`, so its visual "hot zone" is concentrated right at the sprite's own
 * centre — sizing/centring this to the rig's actual HEAD mass (see `characters/rig.ts`:
 * the head is ~46% of total height and, from this game's steep top-down camera, is
 * almost the entire visible silhouette) matters more than covering the full body.
 * First pass centred this too high and too tall (spanned well above the head into
 * empty air, reading as a floating smudge with the actual head barely darkened) —
 * centred on the rig's own `headCentreY` instead, sized just past the head's own
 * diameter plus the torso peeking out beneath it, not the full body/legs. Kept at a
 * moderate-high peak opacity (see `sync()`) so a character's own colours still read
 * through rather than being fully overwritten.
 */
const SLOW_TINT_WIDTH = CHARACTER_HEIGHT * 0.62;
const SLOW_TINT_HEIGHT = CHARACTER_HEIGHT * 0.66;
const SLOW_TINT_CENTER_Y = CHARACTER_HEIGHT * 0.62;
/** Peak alpha of the tint wash. High enough that the composite actually flips the
 * character cool (see `SLOW_TINT_COLOR`), low enough that its own colours and face
 * still read through — a status effect, not a repaint. */
const SLOW_TINT_PEAK_OPACITY = 0.58;
/**
 * Ground telegraph ring at a slowed fighter's feet — TWO concentric rings, a dark
 * base and a bright frost band on top of it.
 *
 * The single ring this replaces was `#6FE0FF`: the same cyan as the water puddle it
 * is most often standing in, so the one place the cue mattered most was the one place
 * it could not be seen. Picking a different single hue only moves that problem, since
 * this ring has to read on warm brown tile, on an amber grease pool AND on a blue
 * water pool. A bright band with a dark band under it reads on all three by VALUE, the
 * same reason this file already mixes melee arcs toward `INK` — contrast that does not
 * depend on guessing the background.
 */
const SLOW_RING_BRIGHT = '#EAF4FF';
const SLOW_RING_DARK = '#1D2740';
/** World-unit distance a fighter must travel (accumulated only while terrain-slowed)
 * between puddle-splash bursts — a footstep-like cadence tied to actual movement,
 * not a timer, so it naturally speeds up or stops with the fighter's own motion. */
const PUDDLE_SPLASH_DIST_WU = 18;

// ═══════════════════════════════════════════════════════════════════════════════
// THE HUE CONTRACT FOR VFX — measured, and it is NOT the one people assume
// ═══════════════════════════════════════════════════════════════════════════════
//
// The arena splits the wheel three ways (`arena/shared.ts` ~L362):
//   WALKABLE  rose-mauve 330-340 (tile field) + teal-blue 198-206 (mats/pads)
//   BLOCKING  violet 258-268 — every CoverBox body, skirt and plinth
//   CAST      0-60 deg
//
// The standing assumption is that 0-60 is "reserved for the cast" and that VFX should stay
// out of it. **It is not.** `arena/shared.ts` L601 and `arena/hazards.ts` L241 both
// state the grant in the same words: *0-60 deg is reserved for the cast, the HAZARDS
// and the VFX.* What must stay out of the warm band is the ENVIRONMENT, and it does —
// measured `envWarmShare` 0.1102, `envShareInCastBand` 0.1148.
//
// So hue cannot be the axis that separates an effect from a character: by contract
// they share it. **VALUE is the axis.** Measured on the shipped frame at shipped
// framing (`tools/tmp/vfx_hue.mjs`, cast matte 1.44% of frame — inside arena-scan's
// 0.2-3% validity band):
//
//     population   hue    sat     luma
//     CAST         358    0.478   0.302     warm share of its own chroma 0.466
//     ENV          240    0.397   0.337     warm share 0.052
//
// The cast lives at luma 0.302. Every transient effect in this file lands ABOVE it:
//
//     effect            hue    luma   |dL vs cast|   % of the CAST's pixels it repaints
//     cast flash        17    0.685      0.383            2.8%
//     impact  (dmg 6)   29    0.582      0.280           19.7%
//     impact  (dmg 18)  17    0.497      0.195           29.4%
//     death            346    0.532      0.230           47.6%
//     heal              67    0.563      0.261            0.9%
//     melee arc         39    0.520      0.218            1.9%
//     puddle splash    353    0.585      0.283            0.5%
//     giant slam       352    0.709      0.407           85.3%   <-- see below
//
// ── THE RULE, and it is checkable ──────────────────────────────────────────────
//
//  1. A transient combat effect MAY sit in 0-60. It must clear the cast's measured
//     luma (0.302) by >= 0.15 in HSL lightness, UPWARD. Every effect above does, by
//     0.195-0.407. This is why flashes/rings/streaks are mixed toward `WHITE` and
//     `SPARK_COLOR` is a pale gold rather than a saturated one — the white-mix is not
//     decoration, it is what buys the separation.
//  2. An effect may not repaint more than ~1/3 of the cast's own pixels unless it is
//     a death or an ultimate. Ordinary hits measure 0.5-29.4%; death 47.6% is earned.
//  3. PERSISTENT ground marks (splats, trail marks) are environment, not transients,
//     and the grant reaches them only because they are HAZARDS. They must be spent
//     DARK: `arena/shared.ts` measured the trade-off curve and found a warm surface
//     only competes with the cast when it shares the cast's VALUE as well as its hue.
//     `splatMat` at luma 0.44 honours that; `trailMats.enemy` (#FFD27A, luma 0.74)
//     does not, and `trailMats.player` (#FF9EC4, hue 336) sits in the WALKABLE rose
//     family while meaning "this ground damages you". Both are left alone on purpose:
//     the same two hexes are duplicated in `match.ts:colorForDamageSource` to tint the
//     damage numbers, so changing them here alone would desync the two. Flagged, not
//     fixed.
//  4. Nothing in this file may enter BLOCKING violet 258-268. Nothing does — `INK`
//     (264) is only ever a MIX TARGET at 0.14 strength, never a fill.
//
// Verified with `node tools/arena-scan.mjs --url $URL --baseline
// tools/scan/colour-baseline.json`: no colour regressions, and hue overlap /
// env-in-cast-band both moved TOWARD target.
// ═══════════════════════════════════════════════════════════════════════════════

const WHITE = new THREE.Color('#ffffff');
/** Deep desaturated ink, matching `render/toon.ts`'s outline colour (kept as a local
 * literal rather than an import — this module has no other reason to depend on the
 * character outline module). Mixing ground-plane fills toward this instead of using
 * a weapon's raw (often pale/warm) colour at low opacity is what keeps melee arcs and
 * AOE fills legible against the arena's bright cream floor. */
const INK = new THREE.Color('#241a33');
/**
 * Universal "hit spark" colour — a warm pale gold, deliberately NOT tinted per-weapon
 * like the flash/decal/rings are. Real brawler VFX almost always give flying impact
 * debris a neutral bright colour regardless of the attack's own theme colour, exactly
 * so the sparks/shards read as a distinct visual LAYER on top of the colour-graded
 * flash+decal rather than blending into it — a critic pass repeatedly perceived this
 * whole burst as "one flat coloured sprite" when every element shared the same
 * near-white/weapon-colour palette.
 */
const SPARK_COLOR = new THREE.Color('#FFE79A');

/**
 * Keep `pool` (id -> mesh) in sync with `items` (id-bearing sim records): create a
 * mesh for any new id via `create`, refresh every live mesh via `update`, and remove
 * meshes whose id no longer appears in `items`.
 */
function syncPool<T extends { id: number }>(
  pool: Map<number, THREE.Object3D>,
  group: THREE.Group,
  items: readonly T[],
  create: (item: T) => THREE.Object3D,
  update: (obj: THREE.Object3D, item: T) => void,
): void {
  const seen = new Set<number>();
  for (const item of items) {
    seen.add(item.id);
    let obj = pool.get(item.id);
    if (!obj) {
      obj = create(item);
      group.add(obj);
      pool.set(item.id, obj);
    }
    update(obj, item);
  }
  for (const [id, obj] of pool) {
    if (!seen.has(id)) {
      group.remove(obj);
      pool.delete(id);
    }
  }
}

/**
 * Turn off depth writing on a transparent material and say so at the call site.
 *
 * `render/toon.ts`'s `flatMat` has no `depthWrite` option, and three's default is
 * `true` — so every `flatMat(..., { transparent: true })` in this project is a silent
 * occluder until something like this is applied. Kept as a named helper rather than
 * an inline assignment so the sweep is greppable: `noDepthWrite(` should appear on
 * every transparent `flatMat` in this file, and a new one without it is a bug.
 */
function noDepthWrite<T extends THREE.Material>(mat: T): T {
  mat.depthWrite = false;
  return mat;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Normalize a (vx, vy) velocity into a unit direction, `{0,0}` for a ~stationary
 * vector. Shared by every bespoke-projectile call site below (`ctx.direction`). */
function normalizedDir(vx: number, vy: number): { x: number; y: number } {
  const mag = Math.hypot(vx, vy);
  return mag > 1e-6 ? { x: vx / mag, y: vy / mag } : { x: 0, y: 0 };
}

/** Soft radial glow, generated once and shared by every particle sprite (flashes,
 * shards, heal sparkle). A hard-edged square sprite would read as a blocky decal;
 * this is what lets additive particles look like actual light instead of confetti. */
function buildRadialGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft-edged disc with a FLAT alpha plateau — opaque out to ~62% of the radius, then
 * a smooth ramp to nothing. Used only by the slow tint (see `SLOW_TINT_COLOR`).
 *
 * The tint used to reuse `glowTex`, whose alpha peaks at a single point and is already
 * down to ~0.5 at 60% of the radius. Composited over a character that is only ~13% of
 * the frame height, that means the wash is at full strength on a handful of pixels
 * dead-centre and effectively absent across the rest of the silhouette — which is
 * exactly what a measurement found: a slowed Hamburger's bun still read `rgb(254,191,109)`,
 * pure warm orange, with no cooling at all. The compositing was never broken (forcing
 * the tint red at 5x proved it lands); the ALPHA PROFILE was wrong for the job. A tint
 * has to cover a silhouette evenly; a glow has to fall off from a hot core. They are
 * different shapes and this one needed its own.
 */
function buildSoftDiscTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.62, 'rgba(255,255,255,1)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * 8-point sparkle/star flash — soft radial core plus radiating spikes (alternating
 * long/short) drawn with additive-friendly alpha falloff. A plain soft circle (the
 * radial-glow texture above) reads as a blur once scaled up big; the spikes are what
 * make a flash read as a CONCENTRATED burst of light — matching the starburst shapes
 * in the Brawl Stars reference plates — rather than a fog patch. Used for the
 * first-frame "pop" on every impact and the big ultimate/death flashes.
 */
function buildStarburstTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Small, bright core — kept deliberately SMALL relative to round 1 (was 0.32 of the
  // canvas). A critic pass twice read this whole texture as "a single soft circular
  // bloom" with the spikes invisible at normal render size; a big soft core is what
  // was drowning them out. Long, high-alpha spikes below now do the actual shape
  // work.
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.16);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // 4 long cardinal spikes reaching almost to the edge (a classic "sparkle/lens
  // flare" cross) + 4 shorter diagonal spikes, all kept near-full alpha along most
  // of their length so the STAR SILHOUETTE itself is unmistakable, not just a
  // brightness gradient that blurs back into a circle.
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const long = i % 2 === 0;
    const len = size * (long ? 0.48 : 0.26);
    const halfWidth = size * (long ? 0.045 : 0.028);
    const ang = (i / spikes) * Math.PI * 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(ang);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -halfWidth);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, halfWidth);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Thin directional glow streak — bright along its centreline, tapering to transparent
 * at both ends AND top/bottom. Rotated per-spawn via `SpriteMaterial.rotation` so one
 * texture can fire "hit spark" rays radiating out of an impact at any angle, instead
 * of needing a pre-rotated texture per direction.
 */
function buildStreakTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const along = ctx.createLinearGradient(0, 0, w, 0);
  along.addColorStop(0, 'rgba(255,255,255,0)');
  along.addColorStop(0.5, 'rgba(255,255,255,1)');
  along.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, w, h);

  // Clip to a vertical taper (independent of x) so the ray narrows to a point at
  // both ends rather than reading as a hard-edged bar.
  ctx.globalCompositeOperation = 'destination-in';
  const across = ctx.createLinearGradient(0, 0, 0, h);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Vertical gradient mapped onto a melee wedge's UV.y (apex→rim): faint/transparent
 * near the pivot, rising to a hot white-edged band right at the swept rim. A critic
 * pass called the melee cone out as "a flat, hard-edged" fill with zero internal
 * shading — this is what turns it into a directional swoosh with a bright leading
 * edge (like a blade catching light) instead of one uniform flat colour.
 */
function buildWedgeGradientTexture(): THREE.CanvasTexture {
  const w = 8;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Canvas Y grows downward; texture V=0 (apex) should be the image's TOP row so it
  // maps to v=0 with THREE's default flipY, keeping v=1 (rim) at the bottom row.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.86, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.94, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0.65)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  // Disable the automatic vertical flip so UV.y maps directly to the canvas rows as
  // drawn above (v=0 -> row 0 -> apex-faint, v=1 -> row h -> rim-bright) — with the
  // default flipY this directional gradient would come out inverted.
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Angular crystal/shard silhouette — a hard-edged faceted polygon with a bright
 * off-centre highlight facet, NOT another soft circle. A critic pass specifically
 * flagged every particle in this layer as "just a soft additive circle... no shape
 * vocabulary — no shards, sparks, or debris". Reusing the radial-glow dot for impact
 * debris is exactly that complaint; this is a deliberately different silhouette so
 * flying debris reads as actual broken-off chunks.
 */
function buildShardTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // A slightly irregular 6-point crystal outline (not a regular hexagon) so it
  // doesn't read as a generic gem icon.
  const points: Array<[number, number]> = [
    [0.5, 0.02], [0.78, 0.32], [0.68, 0.98], [0.32, 0.98], [0.22, 0.32], [0.5, 0.02],
  ];
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    const x = px * size;
    const y = py * size;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const grad = ctx.createLinearGradient(size * 0.3, 0, size * 0.6, size);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0.55)');
  ctx.fillStyle = grad;
  ctx.fill();

  // A brighter off-centre facet highlight so the shape reads as faceted crystal
  // catching light, not a flat cutout.
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.05);
  ctx.lineTo(size * 0.62, size * 0.34);
  ctx.lineTo(size * 0.5, size * 0.5);
  ctx.lineTo(size * 0.4, size * 0.3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dashed annulus in the XZ plane — `dashes` arcs of `duty` fill each, centred on the
 * origin. Built as geometry rather than as a texture on a `RingGeometry` because
 * three's ring UVs map over the bounding SQUARE, not around the circumference, so a
 * striped texture would come out radial instead of angular.
 */
function buildDashedAnnulusGeometry(inner: number, outer: number, dashes: number, duty: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const cell = (Math.PI * 2) / dashes;
  const span = cell * duty;
  const seg = 6;
  let v = 0;
  for (let d = 0; d < dashes; d++) {
    const a0 = d * cell;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * span;
      positions.push(Math.sin(a) * inner, 0, Math.cos(a) * inner);
      positions.push(Math.sin(a) * outer, 0, Math.cos(a) * outer);
    }
    for (let i = 0; i < seg; i++) {
      const b = v + i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    v += (seg + 1) * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flat filled wedge (pie-slice), apex at the local origin, spanning `coneDeg`
 * symmetrically about local +Z, out to `radiusM`. `coneDeg = 360` degenerates into a
 * full disc — exactly what Lollipop's Giant Lollipop (cone: 360) needs. Built in the
 * XZ plane directly (not rotated from a Y-up ring) so a mesh using this geometry can
 * be oriented purely by `rotation.y = atan2(facing.x, facing.y)`, matching the same
 * convention `match.ts` uses for character facing.
 */
function buildWedgeGeometry(radiusM: number, coneDeg: number): THREE.BufferGeometry {
  const half = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(coneDeg, 1, 360)) / 2;
  const segments = Math.max(8, Math.round(coneDeg / 8));
  const positions: number[] = [0, 0, 0];
  // UV.y = radial distance from the apex (0 at the pivot, 1 at the swept rim), UV.x =
  // angle across the sweep — lets `wedgeGradientTex` paint a bright leading edge at
  // the rim fading back to the pivot, instead of the wedge being one flat fill.
  const uvs: number[] = [0.5, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -half + (i / segments) * half * 2;
    positions.push(Math.sin(a) * radiusM, 0, Math.cos(a) * radiusM);
    uvs.push(i / segments, 1);
  }
  const indices: number[] = [];
  for (let i = 1; i < segments + 1; i++) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Flat jagged star polygon (a fan alternating outer/inner radius per point), lying in
 * the XZ plane like `buildWedgeGeometry`. This is what an impact's ground-mark decal
 * uses instead of another soft round particle — two critic rounds in a row read every
 * particle in this layer as "a soft circular bloom, no shape vocabulary"; a properly
 * sized (comparable to a fighter's own footprint) hard-edged star SHAPE is legible at
 * normal gameplay-camera distance in a way a handful of small sprite particles are
 * not, no matter how angular their own texture is.
 */
function buildStarPolygonGeometry(radiusM: number, points = 8, innerRatio = 0.45): THREE.BufferGeometry {
  const spikes = points * 2;
  const positions: number[] = [0, 0, 0];
  for (let i = 0; i <= spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    const r = i % 2 === 0 ? radiusM : radiusM * innerRatio;
    positions.push(Math.sin(a) * r, 0, Math.cos(a) * r);
  }
  const indices: number[] = [];
  for (let i = 1; i < spikes + 1; i++) indices.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transient particle pool — flashes, shards, heal sparkle. Every slot owns its own
// Sprite + SpriteMaterial (created once, mutated forever) so spawning never allocates.
// ─────────────────────────────────────────────────────────────────────────────

interface ParticleSlot {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  endOpacity: number;
  fadeEase: number;
  /** Height/width ratio applied on top of the (uniform) scale animation — 1 for every
   * ordinary glow dot/flash, < 1 for a hit-spark streak so it reads as a thin ray
   * rather than a square blob. Reset to 1 by `allocParticle` for every new use. */
  aspect: number;
}

// Bumped up from the original 64/10 once impacts gained a pop-flash + hit-spark
// streaks on top of the flash/shards they already had — a single big hit now
// allocates well over a dozen particles, and rings are used in pairs (bright inner
// rim + soft outer glow) for every burst.
const PARTICLE_POOL_SIZE = 96;
// Bumped from 6 — this pool now also serves the impact "star decal" ground mark
// (see `spawnImpactStarDecal`), not just melee-arc sweeps, so it needs headroom for
// both to be live at once.
const WEDGE_POOL_SIZE = 10;
const RING_POOL_SIZE = 16;

interface WedgeSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  startOpacity: number;
}

interface RingSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  startScale: number;
  targetScale: number;
  startOpacity: number;
}

interface StatusVisual {
  slowRing: THREE.Mesh;
  /** Dark band drawn just outside/under `slowRing` so the pair reads on any
   * background — see `SLOW_RING_BRIGHT`/`SLOW_RING_DARK`. */
  slowRingDark: THREE.Mesh;
  /** Camera-facing colour-shift sprite over the character's own body — see the
   * "Slow feedback" design note above `SLOW_TINT_COLOR`. */
  slowTint: THREE.Sprite;
  stunStars: THREE.Sprite[];
  /** Dashed "this fighter is shrugging status off" band — see the `WARD_*` block. */
  wardRing: THREE.Mesh;
  wardMat: THREE.MeshBasicMaterial;
  /** Seconds left on the refusal pop; 0 = resting. Advanced by `updateEffects` on the
   * hit-stop-free clock, exactly like every other one-shot in this layer, so the pop
   * still reads during the freeze a solid hit causes. */
  wardPop: number;
  /** Colour the current pop is tinted to — the refused effect's own. */
  wardPopColor: THREE.Color;
}

export class VfxLayer {
  private readonly group = new THREE.Group();
  private readonly projectilePool = new Map<number, THREE.Object3D>();
  private readonly splatPool = new Map<number, THREE.Object3D>();
  private readonly trailPool = new Map<number, THREE.Object3D>();
  private readonly materialCache = new Map<string, THREE.Material>();

  // ── Bespoke per-weapon VFX support (`vfx/weapons/`) ────────────────────────
  /** Short-lived custom `Object3D`s spawned by a `WeaponVfx` hook via
   * `ctx.spawnTransient` (see `spawnTransientObject`/`updateEffects`). Unlike the
   * fixed-size pools above, this is a plain growable list — bespoke weapon VFX fire
   * at ability-cooldown cadence (roughly once a second per weapon), not every frame,
   * so pooling the *wrapper* list itself would add bookkeeping this doesn't need;
   * the discipline this system asks authors to hold is caching their own geometry/
   * material at module scope (see `vfx/weapons/types.ts`), not this list. */
  private readonly transientEffects: Array<{
    object: THREE.Object3D;
    life: number;
    maxLife: number;
    onUpdate?: (progress: number, elapsedSeconds: number) => void;
  }> = [];
  /** `state.elapsed` (sim ms) as of the previous `sync()` call — lets `sync()`
   * derive a SIM-time delta to hand bespoke `trail()` hooks as `ctx.dt`, so a
   * projectile's own per-frame animation freezes during hit-stop right along with
   * its position, matching every other projectile-flight behaviour. Reset to 0 in
   * `clear()` so a match restart never reads a huge bogus first-frame delta. */
  private lastSyncElapsedMs = 0;

  // Shared geometry — every instance of a given kind reuses the same buffers.
  private readonly projectileGeo = new THREE.SphereGeometry(wu(10), 10, 8);
  private readonly splatGeo = new THREE.CircleGeometry(wu(SPLAT_RADIUS), 20);
  private readonly trailGeo = new THREE.CircleGeometry(wu(TRAIL.radius), 16);

  // Splat/trail records don't carry a source colour (see `state.ts`), so these use one
  // fixed tint each rather than trying to recover the weapon that made them.
  //
  // ⚠️ `noDepthWrite()` is LOAD-BEARING, not tidiness. `render/toon.ts`'s `flatMat`
  // takes `transparent`/`opacity`/`doubleSide` and never touches `depthWrite`, so a
  // `transparent: true` material built through it keeps three's default of `true` —
  // the exact silent-occluder trap `docs/LESSONS.md` §1 records, which was found
  // present on every transparent material in the character cast and had never been
  // swept for here. These three were carrying it.
  //
  // What it cost: three sorts transparent objects by `renderOrder` first, and splats
  // and trail marks are created by `syncPool` with the default renderOrder 0, so they
  // draw BEFORE `contact_shadow` and `apron_grounding` (both renderOrder 1, both at
  // 0.00-0.07 m). A depth-writing splat therefore punched a hole in the contact
  // shadows and prop-grounding decals underneath it — and buried prop grounding is
  // itself a bug this project already found and deliberately reversed a decision over
  // (LESSONS §1 case 3, "63% of prop grounding buried").
  //
  // A material-level census could not catch it either: these meshes only exist while
  // the sim holds live splats/trail marks, so a scene walk on a fresh match reports
  // "0 transparent-and-depth-writing in the VFX layer" and is telling the truth about
  // an empty pool.
  private readonly splatMat = noDepthWrite(flatMat('#C2461F', { transparent: true, opacity: 0.55 }));
  private readonly trailMats: Record<FighterRole, THREE.Material> = {
    player: noDepthWrite(flatMat('#FF9EC4', { transparent: true, opacity: 0.6 })),
    enemy: noDepthWrite(flatMat('#FFD27A', { transparent: true, opacity: 0.6 })),
  };

  // ── Ability VFX pools ──────────────────────────────────────────────────────
  private readonly glowTex = buildRadialGlowTexture();
  private readonly softDiscTex = buildSoftDiscTexture();
  private readonly starTex = buildStarburstTexture();
  private readonly streakTex = buildStreakTexture();
  private readonly shardTex = buildShardTexture();
  private readonly wedgeGradientTex = buildWedgeGradientTexture();
  private readonly particles: ParticleSlot[] = [];
  private readonly wedges: WedgeSlot[] = [];
  private readonly rings: RingSlot[] = [];
  private readonly wedgeGeoCache = new Map<string, THREE.BufferGeometry>();
  // Thickened from (0.8, 1) — a thin band read as a faint outline at the wider
  // camera framing this game uses versus the shipped references it's judged
  // against; a thicker band reads unmistakably as a shockwave rim instead.
  private readonly ringUnitGeo = new THREE.RingGeometry(0.62, 1, 40);
  /** One shared dashed annulus for both roles' ward bands — see the `WARD_*` block. */
  private readonly wardGeo = buildDashedAnnulusGeometry(WARD_RING_INNER, WARD_RING_OUTER, WARD_DASHES, WARD_DASH_DUTY);

  private readonly statusByRole: Record<FighterRole, StatusVisual>;
  /** Per-fighter footstep-distance tracking for puddle splashes (see
   * `PUDDLE_SPLASH_DIST_WU`) — `lastX`/`lastY` start at `NaN` so the very first
   * `sync()` call after construction/restart never reads a bogus huge "jump"
   * distance from an uninitialised position. */
  private readonly slowSplashState: Record<FighterRole, { lastX: number; lastY: number; distAccum: number }> = {
    player: { lastX: NaN, lastY: NaN, distAccum: 0 },
    enemy: { lastX: NaN, lastY: NaN, distAccum: 0 },
  };

  /**
   * Last `sync()`'s answer to "could a stun/slow have landed on this fighter", plus
   * where they were standing.
   *
   * `spawnImpactBurst` is called from `match.ts`'s `hit-landed` handler, which knows
   * the weapon (and therefore its authored `effect`) but not the target's timers;
   * `sync()` knows the timers but not the weapon. This is the one field that lets the
   * two meet, and it needs no change to `match.ts` or to the event payload.
   *
   * The role lookup is EXACT, not a nearest-neighbour guess: `combat.ts:applyDamage`
   * pushes `hit-landed` with `x: target.x, y: target.y`, so the hit's coordinates are
   * the target's own position for that tick.
   */
  private statusSnapshot: Record<FighterRole, { x: number; y: number; stunReady: boolean; slowReady: boolean }> = {
    player: { x: NaN, y: NaN, stunReady: true, slowReady: true },
    enemy: { x: NaN, y: NaN, stunReady: true, slowReady: true },
  };

  constructor(scene: THREE.Scene) {
    this.group.name = 'vfx_layer';
    scene.add(this.group);

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 10;
      this.group.add(sprite);
      this.particles.push({
        sprite, mat, active: false, life: 0, maxLife: 1,
        vx: 0, vy: 0, vz: 0, gravity: 0,
        startScale: 1, endScale: 1, startOpacity: 1, endOpacity: 0, fadeEase: 1, aspect: 1,
      });
    }

    for (let i = 0; i < WEDGE_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, map: this.wedgeGradientTex, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(buildWedgeGeometry(0.01, 10), mat);
      mesh.visible = false;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.wedges.push({ mesh, mat, active: false, life: 0, maxLife: 1, startOpacity: 0.6 });
    }

    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.ringUnitGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, active: false, life: 0, maxLife: 1, startScale: 0.1, targetScale: 1, startOpacity: 0.9 });
    }

    const buildStatusVisual = (): StatusVisual => {
      // Dark base band first (wider on both sides), bright frost band on top of it.
      const darkMat = new THREE.MeshBasicMaterial({
        color: SLOW_RING_DARK, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const slowRingDark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.95, 28), darkMat);
      slowRingDark.rotation.x = -Math.PI / 2;
      slowRingDark.visible = false;
      slowRingDark.renderOrder = 3;
      this.group.add(slowRingDark);

      const ringMat = new THREE.MeshBasicMaterial({
        color: SLOW_RING_BRIGHT, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const slowRing = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.86, 28), ringMat);
      slowRing.rotation.x = -Math.PI / 2;
      slowRing.visible = false;
      slowRing.renderOrder = 4;
      this.group.add(slowRing);

      // Colour-shift sprite over the character's own body (see the design note above
      // `SLOW_TINT_COLOR`). Reuses `glowTex` (the same soft radial dot every other
      // particle in this layer uses) stretched non-uniformly via `scale`, rather than
      // authoring a bespoke silhouette texture — a soft falloff reads fine at gameplay
      // distance and this is not trying to be a precise cutout. `depthTest: false` is
      // deliberate: the sprite's single flat plane sits at one depth, but the chibi
      // rig's real silhouette is not flat, so testing against the real depth buffer
      // would clip the tint unevenly (visible on one side of the body, missing on the
      // other) instead of reading as one even wash over the character.
      const tintMat = new THREE.SpriteMaterial({
        map: this.softDiscTex,
        color: SLOW_TINT_COLOR,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      const slowTint = new THREE.Sprite(tintMat);
      slowTint.scale.set(SLOW_TINT_WIDTH, SLOW_TINT_HEIGHT, 1);
      slowTint.visible = false;
      slowTint.renderOrder = 8;
      this.group.add(slowTint);

      const stunStars: THREE.Sprite[] = [];
      for (let i = 0; i < STUN_STAR_COUNT; i++) {
        const mat = new THREE.SpriteMaterial({
          // `starTex`, not `glowTex`. These are called stun STARS and were drawing as
          // soft round dots — the "every particle is a soft additive circle, no shape
          // vocabulary" complaint this file already answered everywhere else. The
          // starburst texture exists three fields up; a spiked silhouette also
          // survives the additive wash far better than a radial blob, because its
          // spikes carry hard edges instead of a gradient that fades into whatever is
          // behind it.
          map: this.starTex, color: '#FFE75E', transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const star = new THREE.Sprite(mat);
        star.scale.set(STUN_STAR_SCALE, STUN_STAR_SCALE, 1);
        star.visible = false;
        star.renderOrder = 11;
        this.group.add(star);
        stunStars.push(star);
      }

      const wardMat = new THREE.MeshBasicMaterial({
        color: WARD_NEUTRAL, transparent: true, opacity: 0,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const wardRing = new THREE.Mesh(this.wardGeo, wardMat);
      wardRing.visible = false;
      // Below the slow ring's pair (3/4) — during a slow's own grace the two can be
      // adjacent, and the ACTIVE telegraph must win.
      wardRing.renderOrder = 2;
      this.group.add(wardRing);

      return {
        slowRing, slowRingDark, slowTint, stunStars,
        wardRing, wardMat, wardPop: 0, wardPopColor: new THREE.Color(WARD_NEUTRAL),
      };
    };

    this.statusByRole = { player: buildStatusVisual(), enemy: buildStatusVisual() };

    // QA-only on-demand spawn — see the `__vfxSpawnTest` declaration above.
    window.__vfxSpawnTest = (kind, xWU, yWU, amount = 14, color = '#FFC93C', who, weaponKey) => {
      // Resolve a real Weapon up front: BOTH the impact and cast paths consult the
      // bespoke registry through it, and passing nothing means every QA spawn silently
      // falls back to the generic burst. A first version of this hook wired only the cast
      // path, so `kind:'impact'` still could not reach anything in `vfx/weapons/` — which
      // is the single most common thing a per-weapon agent needs to look at.
      const qaId = who ?? 'hamburger';
      const qaWeapon = weaponKey ? CHARACTERS[qaId]?.weapons?.find((w: Weapon) => w.key === weaponKey) : undefined;

      if (kind === 'impact') {
        this.spawnImpactBurst(xWU, yWU, color, amount, qaWeapon ? { weapon: qaWeapon, characterId: qaId } : undefined);
      }
      else if (kind === 'death') this.spawnDeathBurst(xWU, yWU, color);
      else if (kind === 'heal') this.spawnHealPulse(xWU, yWU);
      else if (kind === 'puddleSplash') {
        // Takes METRES (it is called from `sync()` with an already-converted
        // position), unlike every other entry here — convert so one probe can use
        // one coordinate convention throughout.
        const m = groundPos(xWU, yWU);
        this.spawnPuddleSplash(m.x, m.z);
      }
      else if (kind === 'meleeArc') {
        this.spawnMeleeArc(
          xWU, yWU, { x: 1, y: 0 },
          qaWeapon?.range ?? 70, qaWeapon?.cone ?? 80,
          qaWeapon?.color ?? color,
        );
      }
      else if (kind === 'giantSlam') {
        // The raw generic shockwave, with no arbitration — this is the attribution
        // probe for "what does this pass alone cost". `'weaponFired'` below is the
        // one that measures what actually ships.
        this.spawnGiantSlamShockwave(xWU, yWU, qaWeapon?.color ?? color, qaWeapon?.range ?? 400);
      }
      else if (kind === 'coverScuff') {
        this.spawnCoverScuff(xWU, yWU, qaWeapon?.color ?? color, 1, 0);
      }
      else if (kind === 'weaponFired') {
        const weapon = qaWeapon ?? ({ key: 'qa', name: 'qa', type: 'ranged', range: 100, damage: amount, cooldown: 1, color, effect: null } as unknown as Weapon);
        this.spawnWeaponCast(xWU, yWU, { x: 1, y: 0 }, weapon, qaId);
      }
      else {
        // `who`/`weaponKey` let a probe drive a SPECIFIC character's bespoke hook. Without
        // them this falls back to a synthetic 'qa' weapon on 'hamburger', which is the
        // pre-existing behaviour. Driving a real hit through gameplay is not a workable
        // alternative: fighters spawn 1080wu apart, every weapon reaches at most 140wu,
        // and probes have timed out waiting for the AI to close.
        const weapon = qaWeapon ?? ({ key: 'qa', name: 'qa', type: 'ranged', range: 100, damage: amount, cooldown: 1, color, effect: null } as unknown as Weapon);
        this.spawnCastFlash(xWU, yWU, { x: 1, y: 0 }, weapon, qaId);
      }
    };
    window.__vfxLayer = this;
  }

  sync(state: MatchState): void {
    window.__vfxDebugFighters = {
      player: {
        x: state.player.x, y: state.player.y, hp: state.player.hp,
        alive: state.player.alive, terrainSlowFactor: state.player.terrainSlowFactor,
      },
      enemy: {
        x: state.enemy.x, y: state.enemy.y, hp: state.enemy.hp,
        alive: state.enemy.alive, terrainSlowFactor: state.enemy.terrainSlowFactor,
      },
    };

    // SIM-time delta since the last `sync()` call, in seconds — handed to bespoke
    // `trail()` hooks as `ctx.dt` (see `lastSyncElapsedMs`'s field comment for why
    // this is sim time, not real time). Computed once per call, before the
    // projectile pool below runs.
    const frameDtSeconds = Math.max(0, (state.elapsed - this.lastSyncElapsedMs) / 1000);
    this.lastSyncElapsedMs = state.elapsed;

    syncPool<Projectile>(
      this.projectilePool,
      this.group,
      state.projectiles,
      (p) => {
        // Bespoke-VFX lookup (`vfx/weapons/`): a weapon with its own `projectile()`
        // hook gets a fully custom Object3D instead of the generic tinted sphere.
        // The matched `WeaponVfx` (or `undefined`) is stashed on `userData` so the
        // `update` callback below — which only receives the pool's `Object3D`, not
        // the weapon that made it — knows which path to take without a second
        // lookup or a parallel id-keyed map.
        const owner = state[p.ownerRole];
        const bespoke = getWeaponVfx(owner.characterId, p.weapon.key);
        if (bespoke?.projectile) {
          const pos = groundPos(p.x, p.y);
          const dir = normalizedDir(p.vx, p.vy);
          const ctx: WeaponVfxCtx = {
            THREE,
            position: new THREE.Vector3(pos.x, PROJECTILE_HEIGHT, pos.z),
            direction: new THREE.Vector3(dir.x, 0, dir.y),
            color: p.color,
            damage: p.damage,
            weapon: p.weapon,
            characterId: owner.characterId,
            spawnTransient: (obj, life, onUpdate) => this.spawnTransientObject(obj, life, onUpdate),
          };
          const obj = bespoke.projectile(ctx);
          obj.userData.weaponVfx = bespoke;
          return obj;
        }
        const mesh = new THREE.Mesh(this.projectileGeo, this.materialFor(p.color));
        return mesh;
      },
      (obj, p) => {
        const owner = state[p.ownerRole];
        const bespoke = obj.userData.weaponVfx as WeaponVfx | undefined;
        const pos = groundPos(p.x, p.y);

        if (!bespoke) {
          // ── Generic path — unchanged from before this system existed. ──────────
          const mesh = obj as THREE.Mesh;
          mesh.material = this.materialFor(p.color);
          // Egg's Hatch!: once the projectile has arrived and is pecking in place
          // (`p.arrived`), pulse its scale on each peck interval instead of just
          // sitting still, so the repeated hits read as an actual attack rather than
          // a ball resting on the target.
          if (p.arrived) {
            const peckT = (p.peckTimer ?? 0) / 500;
            const pulse = 1 + Math.sin(peckT * Math.PI) * 0.5;
            mesh.scale.setScalar(pulse);
          } else {
            mesh.scale.setScalar(1);
          }
          mesh.position.set(pos.x, PROJECTILE_HEIGHT, pos.z);
          return;
        }

        // ── Bespoke path ────────────────────────────────────────────────────────
        obj.position.set(pos.x, PROJECTILE_HEIGHT, pos.z);
        const dir = normalizedDir(p.vx, p.vy);
        // Default orientation (face travel direction), same convention `match.ts`
        // uses for character facing — a `trail()` hook is free to override this.
        if (dir.x !== 0 || dir.y !== 0) obj.rotation.y = Math.atan2(dir.x, dir.y);
        if (bespoke.trail) {
          const ctx: WeaponVfxCtx = {
            THREE,
            position: obj.position.clone(),
            direction: new THREE.Vector3(dir.x, 0, dir.y),
            color: p.color,
            damage: p.damage,
            weapon: p.weapon,
            characterId: owner.characterId,
            spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
            object: obj,
            dt: frameDtSeconds,
          };
          bespoke.trail(ctx);
        }
      },
    );

    syncPool<Splat>(
      this.splatPool,
      this.group,
      state.splats,
      () => {
        const mesh = new THREE.Mesh(this.splatGeo, this.splatMat);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      (obj, s) => {
        const pos = groundPos(s.x, s.y);
        obj.position.set(pos.x, SPLAT_Y, pos.z);
      },
    );

    syncPool<TrailMark>(
      this.trailPool,
      this.group,
      state.trailMarks,
      (t) => {
        const mesh = new THREE.Mesh(this.trailGeo, this.trailMats[t.ownerRole]);
        mesh.rotation.x = -Math.PI / 2;
        return mesh;
      },
      (obj, t) => {
        const pos = groundPos(t.x, t.y);
        // Donut's Sticky Trail: a slow glaze-like shimmer (gentle scale pulse) so a
        // trail of marks reads as a distinct hazard rather than a static decal,
        // matching the splatter/impact language used everywhere else in this layer.
        const phase = (state.elapsed + t.id * 137) * 0.004;
        const pulse = 1 + Math.sin(phase) * 0.08;
        obj.position.set(pos.x, TRAIL_Y, pos.z);
        obj.scale.setScalar(pulse);
      },
    );

    // ── Status telegraphs: slow (character tint + ground ring + puddle splash) /
    // stun (orbiting stars) ────────────────────────────────────────────────────
    (['player', 'enemy'] as const).forEach((role) => {
      const fighter = state[role];
      const vis = this.statusByRole[role];
      const pos = groundPos(fighter.x, fighter.y);

      // Two independent slow SOURCES — a puddle underfoot (`terrainSlowFactor`, the
      // sim's read-only per-tick observation; 1 = unaffected, see `state.ts`) and a
      // weapon's own `status.slowedUntil` timer — deliberately read as one identical
      // `slowed` signal below. The player shouldn't have to decode which source is
      // active; see the design note above `SLOW_TINT_COLOR`.
      const terrainSlowed = fighter.alive && fighter.terrainSlowFactor < 1;
      const weaponSlowed = fighter.alive && state.elapsed < fighter.status.slowedUntil;
      const slowed = terrainSlowed || weaponSlowed;

      vis.slowRing.visible = slowed;
      vis.slowRingDark.visible = slowed;
      vis.slowTint.visible = slowed;
      if (slowed) {
        const pulse = 0.9 + Math.sin(state.elapsed * 0.0035) * 0.12;
        const spin = state.elapsed * 0.0012;
        // Dark band sits a hair lower so it never z-fights the bright one.
        vis.slowRingDark.position.set(pos.x, STATUS_RING_Y - 0.01, pos.z);
        vis.slowRingDark.scale.setScalar(pulse);
        vis.slowRingDark.rotation.z = spin;
        (vis.slowRingDark.material as THREE.MeshBasicMaterial).opacity = 0.5;

        vis.slowRing.position.set(pos.x, STATUS_RING_Y, pos.z);
        vis.slowRing.scale.setScalar(pulse);
        vis.slowRing.rotation.z = spin;
        (vis.slowRing.material as THREE.MeshBasicMaterial).opacity = 0.9;

        vis.slowTint.position.set(pos.x, SLOW_TINT_CENTER_Y, pos.z);
        const tintPulse = SLOW_TINT_PEAK_OPACITY + Math.sin(state.elapsed * 0.006) * 0.08;
        (vis.slowTint.material as THREE.SpriteMaterial).opacity = tintPulse;
      }

      // Splash particles at the feet — ONLY while a puddle is the cause (not a
      // weapon slow) and only while actually moving through it, so this reads as
      // "wading through liquid" rather than a generic status particle. Distance-
      // accumulated rather than timer-based so the cadence tracks however fast the
      // fighter is actually moving (and stops the instant they stop, even if still
      // standing in the puddle).
      const splash = this.slowSplashState[role];
      if (terrainSlowed) {
        if (Number.isFinite(splash.lastX)) {
          splash.distAccum += Math.hypot(fighter.x - splash.lastX, fighter.y - splash.lastY);
          while (splash.distAccum >= PUDDLE_SPLASH_DIST_WU) {
            splash.distAccum -= PUDDLE_SPLASH_DIST_WU;
            this.spawnPuddleSplash(pos.x, pos.z);
          }
        }
      } else {
        splash.distAccum = 0;
      }
      splash.lastX = fighter.x;
      splash.lastY = fighter.y;

      // ── Status shrug-off band (see the `WARD_*` block) ──────────────────────
      // `statusReadyAt` is the sim's own predicate, imported rather than copied.
      const stunReady = state.elapsed >= statusReadyAt(fighter, 'stun');
      const slowReady = state.elapsed >= statusReadyAt(fighter, 'slow');
      this.statusSnapshot[role] = { x: fighter.x, y: fighter.y, stunReady, slowReady };

      // GRACE only — the window where the effect has expired but cannot be re-applied
      // and nothing else is telegraphing. While a status is ACTIVE its own telegraph
      // (frost ring + tint, or orbiting stars) already says "this is running", so the
      // band would be a third ring saying the same thing.
      const inStunGrace = fighter.alive && !stunReady && state.elapsed >= fighter.status.stunnedUntil;
      const inSlowGrace = fighter.alive && !slowReady && state.elapsed >= fighter.status.slowedUntil;
      const warded = inStunGrace || inSlowGrace;
      const popT = vis.wardPop > 0 ? vis.wardPop / WARD_POP_SECONDS : 0;
      vis.wardRing.visible = warded || popT > 0;
      if (vis.wardRing.visible) {
        vis.wardRing.position.set(pos.x, STATUS_RING_Y - 0.02, pos.z);
        // Counter-rotating against the slow ring's `+state.elapsed * 0.0012`.
        //
        // ⚠️ `rotation.Y`, not `.z`. The slow rings are `RingGeometry` — authored in
        // the XY plane and laid flat with `rotation.x = -PI/2` — so their LOCAL z has
        // become world up and spinning them about z turns them in the ground plane.
        // This band is `buildDashedAnnulusGeometry`, authored directly in XZ with no
        // rotation at all, so its local y IS world up. Copying the slow ring's
        // `rotation.z` here tipped a horizontal disc onto its edge and it measured
        // **37 delivered pixels against an expected ~740** — near-zero projected area,
        // which reads exactly like an occlusion bug and is not one. Sibling of the
        // Euler trap in `docs/LESSONS.md` §12.
        vis.wardRing.rotation.y = -state.elapsed * 0.0019;
        // The pop scales the band up and fades it back down onto the resting state.
        vis.wardRing.scale.setScalar(1 + 0.5 * popT);
        vis.wardMat.opacity = warded
          ? WARD_RESTING_OPACITY + (1 - WARD_RESTING_OPACITY) * popT
          : popT;
        vis.wardMat.color.copy(WARD_NEUTRAL).lerp(vis.wardPopColor, popT);
      }

      const stunned = fighter.alive && state.elapsed < fighter.status.stunnedUntil;
      vis.stunStars.forEach((star, i) => {
        star.visible = stunned;
        if (!stunned) return;
        const ang = state.elapsed * 0.006 + (i * Math.PI * 2) / vis.stunStars.length;
        star.position.set(
          pos.x + Math.cos(ang) * STUN_STAR_RADIUS,
          STUN_STAR_HEIGHT + Math.sin(state.elapsed * 0.01 + i) * 0.05,
          pos.z + Math.sin(ang) * STUN_STAR_RADIUS,
        );
        star.material.opacity = 0.95;
      });
    });
  }

  /**
   * Advance every one-shot effect (flashes, shards, melee sweeps, shockwave rings).
   * Deliberately takes its OWN `dt`, separate from `sync()`'s sim-driven state — call
   * this with a dt that is NOT slowed by hit-stop, so impact feedback stays snappy
   * and instantly readable even while the sim (and character animation) is frozen.
   * That's the whole point of hit-stop: the WORLD pauses, the HIT still pops.
   */
  updateEffects(dtSeconds: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dtSeconds;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.life / p.maxLife;
      p.vy += p.gravity * dtSeconds;
      p.sprite.position.x += p.vx * dtSeconds;
      p.sprite.position.y += p.vy * dtSeconds;
      p.sprite.position.z += p.vz * dtSeconds;
      const scale = THREE.MathUtils.lerp(p.startScale, p.endScale, easeOutCubic(t));
      p.sprite.scale.set(scale, scale * p.aspect, 1);
      p.mat.opacity = Math.max(0, THREE.MathUtils.lerp(p.startOpacity, p.endOpacity, Math.pow(t, p.fadeEase)));
    }

    for (const w of this.wedges) {
      if (!w.active) continue;
      w.life += dtSeconds;
      if (w.life >= w.maxLife) {
        w.active = false;
        w.mesh.visible = false;
        continue;
      }
      const t = w.life / w.maxLife;
      // Hold near-full opacity through the first ~60% of life, then drop fast — a
      // swept cone should read as a clean, held shape, not something dissolving
      // from the instant it appears.
      w.mat.opacity = w.startOpacity * (1 - Math.pow(t, 1.8));
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life += dtSeconds;
      if (r.life >= r.maxLife) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.life / r.maxLife;
      const s = THREE.MathUtils.lerp(r.startScale, r.targetScale, easeOutCubic(t));
      r.mesh.scale.set(s, s, s);
      r.mat.opacity = r.startOpacity * (1 - t);
    }

    // Ward-band refusal pops. On this clock, not `sync()`'s, for the same reason
    // every other one-shot here is: a solid hit triggers hit-stop, and the feedback
    // for that hit must not freeze along with the world.
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      if (vis.wardPop > 0) vis.wardPop = Math.max(0, vis.wardPop - dtSeconds);
    }

    // Bespoke per-weapon transients (`vfx/weapons/` hooks via `ctx.spawnTransient`)
    // — advanced on the same not-slowed-by-hit-stop clock as every pool above, so a
    // bespoke impact/cast effect stays exactly as snappy as the generic burst it's
    // standing in for. Iterated back-to-front so mid-loop removal is safe.
    for (let i = this.transientEffects.length - 1; i >= 0; i--) {
      const eff = this.transientEffects[i];
      eff.life += dtSeconds;
      if (eff.life >= eff.maxLife) {
        this.group.remove(eff.object);
        this.transientEffects.splice(i, 1);
        continue;
      }
      eff.onUpdate?.(eff.life / eff.maxLife, eff.life);
    }
  }

  /** `ctx.spawnTransient` for every `WeaponVfx` hook (see `vfx/weapons/types.ts`):
   * adds `object` to the VFX layer and removes it again after `lifetimeSeconds`,
   * calling `onUpdate(progress, elapsedSeconds)` once per `updateEffects` tick in
   * between so an author can fade/scale/move it over its life. */
  private spawnTransientObject(
    object: THREE.Object3D,
    lifetimeSeconds: number,
    onUpdate?: (progress: number, elapsedSeconds: number) => void,
  ): void {
    this.group.add(object);
    this.transientEffects.push({ object, life: 0, maxLife: Math.max(0.001, lifetimeSeconds), onUpdate });
  }

  // ── Spawn API — called from match.ts's event handling ─────────────────────────

  /**
   * EVERYTHING one `weapon-fired` event draws, arbitrated in ONE place.
   *
   * ── Why this function exists ───────────────────────────────────────────────────
   *
   * `match.ts` used to fire up to three independent effects for a single shot —
   * `spawnCastFlash`, `spawnMeleeArc` and `spawnGiantSlamShockwave` — each authored,
   * tuned and MEASURED alone. `docs/LESSONS.md` §7 ("local optima fight each other;
   * watch the sum") predicts what that produces, and Giant Lollipop is the recorded
   * proof: measured together at shipped framing, the three repainted **272,651 px =
   * 75.7% of the frame**, and `spawnGiantSlamShockwave`'s own comment said the melee
   * arc *"already makes this screen-filling on its own"* — written before
   * `vfx/weapons/lollipop.ts` existed and never revisited after it did.
   *
   * The individual pieces (readback 800x450, hamburger self-cast, peak slice):
   *
   *     bespoke lollipop.Giant.cast   267,217 px    74.2% of frame
   *     generic 360-degree melee wedge 262,797 px    73.0% of frame
   *     generic giant-slam shockwave  161,800 px    44.9% of frame
   *     ALL THREE, as shipped         272,651 px    75.7% of frame
   *
   * Three overlapping full-frame washes is not three times the information; the
   * judgement PNGs show it is *less*, because the wedge is a flat featureless red
   * disc with its edge off screen and the shockwave's epicentre flash sits on top of
   * the caster. Whoever adds the next `weapon-fired` beat must add it HERE, where the
   * sum is visible, not next to it in `match.ts`.
   *
   * `match.ts` keeps only the non-VFX consequences of a giant slam (HUD flash, camera
   * shake, hit-stop) because those are not this layer's to own.
   */
  spawnWeaponCast(xWU: number, yWU: number, facing: Vec2, weapon: Weapon, characterId: CharacterId): void {
    const bespokeCast = !!getWeaponVfx(characterId, weapon.key)?.cast;

    this.spawnCastFlash(xWU, yWU, facing, weapon, characterId);

    if (weapon.type === 'melee') {
      // ── The one case where the generic wedge is SKIPPED ────────────────────────
      // The wedge's job is to telegraph the hitbox, and it does that by having an
      // EDGE and a DIRECTION. A `giantSlam` has neither on screen: 360 degrees means
      // no direction, and `REACH.ultimateSlam` (400 wu) is twice the radius the camera
      // guarantees is visible, so the edge is off frame by construction (see
      // `render/camera.ts`). What actually renders is a flat 20 m red disc at 0.88
      // opacity covering the whole floor — 262,797 px of information-free wash that
      // erases the arena the player is trying to read.
      //
      // A bespoke `cast()` on a `giantSlam` weapon is drawing that same reach itself
      // (lollipop's AOE fill is the weapon's true `range`, with a hard two-tone
      // boundary and a racing rim — a strictly better hitbox indicator than a
      // borderless flat disc). So the wedge stands down for it, and ONLY for it: with
      // no bespoke cast the wedge is still the only reach indicator a `giantSlam` has,
      // and every ordinary melee weapon (80-150 degree cones, 58-84 wu) keeps it —
      // those measured 5,447-11,648 px composited, with 1.8-6.0% cast repaint.
      if (!(weapon.giantSlam && bespokeCast)) {
        this.spawnMeleeArc(xWU, yWU, facing, weapon.range ?? 0, weapon.cone ?? 360, weapon.color);
      }
    }

    if (weapon.giantSlam) {
      this.spawnGiantSlamShockwave(xWU, yWU, weapon.color, weapon.range ?? 0, { bespokeOwnsGround: bespokeCast });
    }
  }

  /** Muzzle/cast flash at the attacker, tinted the weapon's colour. Fires for every
   * `weapon-fired` event (melee wind-up, ranged muzzle, or a self-cast heal). Looks
   * up this weapon's bespoke `cast()` hook first (`vfx/weapons/`); the bespoke hook
   * adds this weapon's identity ON TOP OF a subordinate muzzle anchor — see
   * `castMuzzle` for the measurement that made the anchor unconditional. */
  spawnCastFlash(xWU: number, yWU: number, facing: Vec2, weapon: Weapon, characterId: CharacterId): void {
    bumpVfxQaCount('cast');
    const origin = groundPos(xWU, yWU);
    const mag = Math.hypot(facing.x, facing.y) || 1;
    const fx = facing.x / mag;
    const fy = facing.y / mag;
    const offM = 0.7;
    const color = weapon.color;

    const bespoke = getWeaponVfx(characterId, weapon.key)?.cast;
    this.castMuzzle(origin.x + fx * offM, origin.z + fy * offM, color, bespoke ? 'subordinate' : 'primary');
    if (!bespoke) return;

    const ctx: WeaponVfxCtx = {
      THREE,
      position: new THREE.Vector3(origin.x + fx * offM, CAST_HEIGHT, origin.z + fy * offM),
      direction: new THREE.Vector3(fx, 0, fy),
      color,
      damage: weapon.damage,
      weapon,
      characterId,
      spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
    };
    bespoke(ctx);
  }

  /**
   * The muzzle beat, and why every weapon now gets one.
   *
   * `'primary'` is the generic cast flash, byte-for-byte what shipped before the
   * bespoke system existed. `'subordinate'` is the same sprite at 62% linear size and
   * a shorter life, spawned UNDER a bespoke `cast()`.
   *
   * ── The measurement that made this unconditional ───────────────────────────────
   *
   * A bespoke `cast()` used to REPLACE the flash entirely. `tools/tmp/vfx_wcov.mjs`
   * measured all 33 weapons x both paths at shipped framing, and the cast column has
   * one shape: **the generic flash delivers 735 px and FIFTEEN of the twenty-two
   * bespoke casts deliver under 300** —
   *
   *     hamburger.Tomato    18      egg.Shards       89      taco.Onion    149
   *     waterbottle.Glass   21      sushi.Rice       97      pizza.Cheese  171
   *     pizza.Dough         66      hotdog.Ketchup  108      burrito.Swarm 180
   *     soup.Noodle         73      taco.Filling    147      taco.Double   231
   *     pizza.Tomato        89                              donut.Candy   235
   *                                                         sushi.Catch   283
   *
   * and the ablation says why: occlusion 0.98-1.36x (nothing is hiding them) against
   * size ratios of 6-15x. They are simply SMALL — every one of them was authored as a
   * detail beat (a puff of flour, four glass slivers, six grains of rice) at
   * 0.15-0.35 m against the generic flash's 1.3 m, because the brief for each was
   * "not the generic pale circular flash". Correct instinct, wrong conclusion: the
   * generic flash was never the generic weapon's *flavour*, it was the MUZZLE, and
   * every weapon has one. Eighteen pixels is not a quiet cast, it is a cast the player
   * cannot see fire.
   *
   * Fixing this in eleven weapon files by scaling their detail up is exactly the move
   * `docs/LESSONS.md` §1 warns against (three of the five invisibility bugs the last
   * round fixed were burial, and scaling them would have made bigger invisible
   * effects) — and it would also mean eleven separate re-derivations of one number.
   *
   * ── Why 0.75 and not 1.0, and not 0.5 ─────────────────────────────────────────
   *
   * The anchor has to be SUBORDINATE (the bespoke detail is the point of the system)
   * and still clear the floor on its own, because the weakest bespoke cast contributes
   * 18 px and cannot be relied on for any of it. A radial sprite's delivered area goes
   * as the square of its scale, so against the primary flash's measured 735 px:
   *
   *     0.50x -> ~184 px   under the 300 px floor on its own — no
   *     0.62x -> ~282 px   inside measurement noise of the floor — no
   *     0.75x -> ~413 px   clears it with margin, and is 56% of the primary's area
   *
   * 0.75 it is: at 0.98 m against a 2.10 m character it reads as a muzzle rather than
   * as the whole event, and every bespoke cast in the directory throws its detail
   * OUTWARD (droplets, shards, grains, crumbs) so the detail is not competing for the
   * same pixels anyway.
   */
  private castMuzzle(xM: number, zM: number, color: string, role: 'primary' | 'subordinate'): void {
    const k = role === 'primary' ? 1 : 0.75;
    const p = this.allocParticle();
    p.active = true;
    p.life = 0;
    p.maxLife = role === 'primary' ? 0.16 : 0.13;
    p.sprite.visible = true;
    p.sprite.position.set(xM, CAST_HEIGHT, zM);
    p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
    p.startScale = 0.75 * k; p.endScale = 1.3 * k;
    // Full opacity in both roles. The anchor is made subordinate by SIZE, not by
    // dimming: rule 1 of the colour contract above requires every transient to clear
    // the cast's luma 0.302 by >= 0.15 upward, and a half-opacity additive sprite over
    // this floor lands under that — a dim anchor is just the invisible-effect bug
    // again with extra steps.
    p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1.6;
    p.mat.color.set(color).lerp(WHITE, 0.4);
  }

  /**
   * Swept melee cone matching the weapon's REAL `cone`/`range` exactly — this is what
   * makes a melee swing visible at all (previously nothing telegraphed the hitbox).
   * Fires on every melee `weapon-fired`, whether or not it actually connects, exactly
   * like a real swing animation would.
   */
  spawnMeleeArc(xWU: number, yWU: number, facing: Vec2, rangeWU: number, coneDeg: number, color: string): void {
    bumpVfxQaCount('meleeArc');
    const origin = groundPos(xWU, yWU);
    const radiusM = wu(rangeWU);
    const key = `${Math.round(coneDeg)}_${radiusM.toFixed(3)}`;
    let geo = this.wedgeGeoCache.get(key);
    if (!geo) {
      geo = buildWedgeGeometry(radiusM, coneDeg);
      this.wedgeGeoCache.set(key, geo);
    }
    const w = this.allocWedge();
    w.active = true;
    w.life = 0;
    w.maxLife = 0.3;
    w.startOpacity = 0.88;
    w.mesh.visible = true;
    w.mesh.geometry = geo;
    w.mesh.rotation.y = Math.atan2(facing.x, facing.y);
    w.mesh.position.set(origin.x, GROUND_VFX_Y, origin.z);
    // Mix toward ink rather than using the weapon's raw colour at low opacity — a
    // pale weapon colour (e.g. Patty Smash's yellow) alpha-blended over the arena's
    // equally pale floor is nearly invisible; darkening it first guarantees contrast
    // regardless of what's underneath, matching how the reference bar's AOE
    // indicators are bold saturated shapes, not a light tint. Mixed only lightly now
    // (was 0.3) — a critic pass flagged melee arcs as reading dull/muddy next to how
    // saturated the reference bar's AOE shapes are; a hint of ink is still enough to
    // guarantee contrast on the pale floor without flattening the colour.
    w.mat.color.set(color).lerp(INK, 0.14);
    w.mat.opacity = w.startOpacity;
  }

  /**
   * Flat jagged star ground-mark at a hit location, sized comparable to a fighter's
   * own footprint. A repeated critic complaint was that every impact particle reads
   * as "a single soft circular bloom" — true even after giving shard/streak sprites
   * an angular texture, because at normal gameplay-camera distance small sprites
   * blur back into glow regardless of their own silhouette. This sidesteps that
   * entirely: a hard-edged, big-enough-to-matter SHAPE (the same flat-mesh approach
   * the melee arc uses, which the critic explicitly liked) rather than another
   * particle.
   */
  private spawnImpactStarDecal(origin: { x: number; z: number }, color: string, radiusM: number, life: number): void {
    const key = `star_${radiusM.toFixed(3)}`;
    let geo = this.wedgeGeoCache.get(key);
    if (!geo) {
      geo = buildStarPolygonGeometry(radiusM, 8, 0.42);
      this.wedgeGeoCache.set(key, geo);
    }
    const w = this.allocWedge();
    w.active = true;
    w.life = 0;
    w.maxLife = life;
    w.startOpacity = 0.9;
    w.mesh.visible = true;
    w.mesh.geometry = geo;
    w.mesh.rotation.y = Math.random() * Math.PI * 2;
    w.mesh.position.set(origin.x, GROUND_VFX_Y + 0.03, origin.z);
    // No UV on this geometry (see `buildStarPolygonGeometry`) — a flat fill, not the
    // melee arc's apex→rim gradient map. Kept close to the weapon's own SATURATED
    // colour (barely lifted toward white) rather than near-white — this needs to
    // read as a distinct coloured MARK sitting under/around the white flash, not
    // another white shape that optically fuses with it.
    w.mat.map = null;
    w.mat.needsUpdate = true;
    w.mat.color.set(color).lerp(WHITE, 0.05);
    w.mat.opacity = w.startOpacity;
  }

  /** Bright impact burst at a hit location: pop + expanding flash + double ground
   * ring + hit-spark streaks + radial shards, tinted by the damage source and scaled
   * by how hard the hit was. Sized to read as clearly BIGGER than the fighters
   * themselves for any hit that isn't trivial chip damage — matching the reference
   * bar, where combat VFX dominate the frame rather than politely sitting beside the
   * characters.
   *
   * `source`, when provided, identifies the weapon that caused this hit
   * (`combat.ts`'s `DamageSource.kind === 'weapon'` — trail/hazard/fog hits have no
   * weapon and so never look up bespoke VFX, exactly like they never had a `cast`
   * either). When that weapon has a bespoke `impact()` hook (`vfx/weapons/`), it
   * fully replaces the generic burst below; otherwise this falls back to the exact
   * generic burst that ran here before this system existed. `fromXWU`/`fromYWU`
   * (the attacker's position) are optional and only used to give the bespoke hook a
   * meaningful `ctx.direction` (attacker → hit); omit them and it's just zero. */
  spawnImpactBurst(
    xWU: number,
    yWU: number,
    color: string,
    amount: number,
    source?: { weapon: Weapon; characterId: CharacterId; fromXWU?: number; fromYWU?: number },
  ): void {
    bumpVfxQaCount('impact');
    const origin = groundPos(xWU, yWU);

    // ── Was this hit's STATUS shrugged off? ─────────────────────────────────────
    // Runs before the bespoke branch on purpose: a weapon with its own `impact()`
    // hook must still show the refusal, and no author of a bespoke hook should have
    // to know this rule exists.
    //
    // `applyDamage` deals full damage whether or not the status lands and emits the
    // same `hit-landed` either way — "the event describes what the weapon DOES, and
    // whether the target happened to be immune is read off the target's own timers".
    // So this is the only place the two facts are both available.
    if (source?.weapon.effect === 'stun' || source?.weapon.effect === 'slow') {
      this.flagStatusRefused(xWU, yWU, source.weapon.effect, source.weapon.color);
    }

    const bespoke = source && getWeaponVfx(source.characterId, source.weapon.key)?.impact;
    if (bespoke && source) {
      let dirX = 0;
      let dirY = 0;
      if (source.fromXWU !== undefined && source.fromYWU !== undefined) {
        const d = normalizedDir(xWU - source.fromXWU, yWU - source.fromYWU);
        dirX = d.x; dirY = d.y;
      }
      const ctx: WeaponVfxCtx = {
        THREE,
        position: new THREE.Vector3(origin.x, IMPACT_HEIGHT, origin.z),
        direction: new THREE.Vector3(dirX, 0, dirY),
        color,
        damage: amount,
        weapon: source.weapon,
        characterId: source.characterId,
        spawnTransient: (o, life, onUpdate) => this.spawnTransientObject(o, life, onUpdate),
      };
      bespoke(ctx);
      return;
    }

    // ── Generic path ────────────────────────────────────────────────────────────
    // `sizeFactor` is the ONE knob every element of `burst()` is multiplied by, so
    // it is also the one number that decides whether a hit is readable. It has been
    // wrong in both directions:
    //
    // Four critic rounds judged our combat VFX against Brawl Stars plates shot on a
    // much closer camera, so the same world-space effect filled far less of OUR
    // frame — and the response was to keep scaling the world-space effect up (base
    // 0.85 → 1.2, cap 3.4 → 4.4). That over-corrected past the point of absurdity:
    // measured against the current camera, the star ground-mark reached **4.4m** on
    // a **2.1m** character and each individual shard sprite reached 2.6m, i.e. a
    // single piece of debris was larger than the fighter it came off. On screen the
    // burst spanned ~270px against a ~55px character and completely swallowed it —
    // during a hit the only things still legible were the HP bar and the damage
    // number, which are HUD, not the character. An effect that hides the thing it is
    // giving feedback about has stopped being feedback.
    //
    // Re-derived against `CHARACTER_HEIGHT` rather than against a reference plate's
    // framing, so it stays anchored if the camera moves again: at typical weapon
    // damage the burst's largest opaque element is about ONE character height across
    // and every element is sized as a fraction of that (see `burst`). The character
    // stays readable through its own hit; the burst still dominates the tile it
    // lands on.
    //
    // This is load-bearing beyond this call site: nine per-weapon `vfx/weapons/*`
    // agents each tune a bespoke effect against this generic recipe as their
    // reference for "how big is a hit", so an error here gets paid for nine times.
    const sizeFactor = THREE.MathUtils.clamp(0.85 + amount * 0.035, 0.85, 2.0);
    // Fewer, bigger shards (see the shard loop's comment in `burst`) — round 2 used
    // up to 11 small ones per hit; they averaged into more glow instead of reading as
    // individual debris.
    this.burst(origin, color, sizeFactor, Math.round(THREE.MathUtils.clamp(3 + amount * 0.16, 3, 6)));
  }

  /**
   * Pop the ward band if this hit's status was refused by `combat.ts`'s grace rule.
   *
   * Resolves the target by position: `applyDamage` pushes `hit-landed` with the
   * target's own `x`/`y`, and `sync()` cached both fighters' positions from the same
   * tick, so the match is exact rather than a nearest-neighbour guess. A 1 wu
   * tolerance covers nothing but float noise — if neither fighter matches (a stale
   * snapshot on the very first tick, when both are NaN), this does nothing, which is
   * the correct failure: no signal beats a wrong one.
   *
   * The pop is tinted to the WEAPON's colour, not to a fixed per-effect colour. The
   * player's question at that instant is "which of my attacks just bounced", and the
   * weapon colour is the one they already associate with it — the same colour the
   * impact burst around it is wearing.
   */
  private flagStatusRefused(xWU: number, yWU: number, effect: 'stun' | 'slow', weaponColor: string): void {
    for (const role of ['player', 'enemy'] as const) {
      const snap = this.statusSnapshot[role];
      if (!Number.isFinite(snap.x)) continue;
      if (Math.hypot(snap.x - xWU, snap.y - yWU) > 1) continue;
      const ready = effect === 'stun' ? snap.stunReady : snap.slowReady;
      if (ready) return; // it landed — nothing to say
      const vis = this.statusByRole[role];
      vis.wardPop = WARD_POP_SECONDS;
      vis.wardPopColor.set(weaponColor).lerp(WHITE, 0.35);
      return;
    }
  }

  /** Bigger burst + scatter + a bright pop for a death — the biggest non-ultimate
   * moment in a match, so it deliberately outsizes even a hard hit. 2.6 against
   * `spawnImpactBurst`'s 2.0 cap keeps that ordering after the burst rescale (see the
   * note there); it is not an independent number, it is "a bit more than the hardest
   * possible hit". */
  spawnDeathBurst(xWU: number, yWU: number, color: string): void {
    bumpVfxQaCount('death');
    const origin = groundPos(xWU, yWU);
    this.burst(origin, color, 2.6, 9, { life: 1.35 });
  }

  /**
   * Rising sparkle column for a heal (Hamburger's Onion Ring).
   *
   * ── This was an INVISIBLE-RENDER instance and it is fixed by geometry, not size ──
   *
   * Measured at shipped framing on a frozen clock (`tools/tmp/vfx_ablate.mjs`), the
   * previous version delivered **37 changed pixels** at 800x450 — about 150 px at
   * 1600x900, spread over five particles, i.e. roughly a 5x5 px smudge each — and it
   * fell below the visibility floor before the first 16 ms slice. The judgement frame
   * showed two faint green specks on the character's left edge and nothing else.
   *
   * The ablation says *why*, which matters because the two causes need opposite fixes:
   *
   *     shipped 37 px | depthTest off 179 px (4.84x) | scale x4 717 px (19.4x)
   *
   * A 4.84x jump from disabling depth alone means the sparkles were **inside the
   * fighter**. They were: the ring radius was 0.25-0.60 m and the outward drift added
   * only 0.3 m/s x 0.95 s, so no particle ever left a body whose visible half-width is
   * ~0.55 m; and the rise (vy 0.8-1.2, gravity +0.15) totalled ~0.83 m from a 0.85 m
   * start, topping out at ~1.7 m against a 2.1 m character — under the head the whole
   * time. Scaling them up, which is the obvious reading of "37 px", would have made a
   * BIGGER invisible effect: additive green composited inside a warm orange bun clips
   * to white and reads as nothing.
   *
   * So the ring now starts OUTSIDE the silhouette and the column finishes ABOVE the
   * head, where the sparkles sit against floor and sky instead of against the
   * character they are describing. Size is raised too (the puddle-splash precedent
   * below says ~0.5 m is the floor of legibility at this camera), but the geometry is
   * the actual repair.
   */
  spawnHealPulse(xWU: number, yWU: number): void {
    bumpVfxQaCount('heal');
    const origin = groundPos(xWU, yWU);
    const count = 7;
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      // Outside the body's visible half-width (~0.55 m) from the first frame, so no
      // particle ever has to survive being composited over the character.
      const r = 0.66 + Math.random() * 0.3;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.72 + Math.random() * 0.22;
      p.sprite.visible = true;
      // Start low (knee height) and end above the head: a column that travels the
      // fighter's whole height reads as "being healed" in a way a cloud hovering at
      // chest height does not, and it spends most of its life clear of the silhouette.
      p.sprite.position.set(origin.x + Math.cos(ang) * r, CHARACTER_HEIGHT * 0.22, origin.z + Math.sin(ang) * r);
      p.vx = Math.cos(ang) * 0.22;
      p.vz = Math.sin(ang) * 0.22;
      p.vy = 2.0 + Math.random() * 0.45;
      p.gravity = -0.45; // rises fast, gently loses momentum — never falls back
      p.startScale = 0.46 + Math.random() * 0.14; p.endScale = 0.14;
      p.startOpacity = 0.95; p.endOpacity = 0; p.fadeEase = 1;
      // Mint green: hue 150, luma 0.66. Outside the cast's 0-60 band, outside the
      // arena's walkable rose (330-340) and blocking violet (255-285), and 0.36 of
      // lightness above the measured cast luma of 0.302 — see the hue-contract note
      // at the head of this file's colour block.
      p.mat.color.set('#6FE0A8');
    }
  }

  /**
   * Small splash burst at a fighter's feet — the "wading through liquid" motion cue
   * for terrain slow (see `sync()`'s distance-accumulated splash cadence). Reuses the
   * shared particle pool exactly like every other one-shot effect in this layer, so
   * nothing new is allocated per spawn. Deliberately one neutral bright droplet
   * colour for both puddles (not per-kind grease/water tinted) — this motion cue's
   * job is "you're moving through liquid," not re-litigating which hazard this is.
   *
   * Spawn height starts at `STATUS_RING_Y` (0.3m), NOT ground level: the puddle disc
   * itself (`hazards.ts`'s `buildPuddleVisual`) sits at `FLOOR_Y.decal`/`FLOOR_Y.fine`
   * (0.15-0.25m) using `glossyMat`/`flatMat`, neither of which sets `depthWrite:
   * false` — a `transparent: true` material still writes the depth buffer by THREE's
   * own default unless told otherwise, so a particle spawned BELOW that plane (this
   * used 0.06m originally) gets depth-tested against it and is silently culled for
   * its entire life, everywhere the puddle disc covers it. Verified by temporarily
   * blowing the particles up to multi-second lifetimes and still seeing nothing
   * render — confirms occlusion, not a timing/capture artifact.
   *
   * ── AND THAT FIX WAS NOT ENOUGH: the second occluder was the FIGHTER ─────────────
   *
   * This is `docs/LESSONS.md` §1 case 17 exactly — a fix for an invisibility bug that
   * was never closed out by measuring delivered pixels, so the same class re-landed.
   * Clearing the puddle disc solved the puddle disc and nothing else. Measured at
   * shipped framing on a frozen clock (`tools/tmp/vfx_ablate.mjs`):
   *
   *     shipped 44 px | depthTest off 620 px (14.1x) | scale x4 3706 px (84x)
   *
   * **14x.** 93% of this effect never reached the screen, and the judgement frame at
   * its own peak millisecond contained no droplet at all. The cause is arithmetic: the
   * ring radius was 0.05-0.13 m and the outward speed 0.6 m/s over a 0.30-0.42 s life,
   * so the furthest any droplet ever got from the fighter's centre was ~0.38 m —
   * inside a body whose visible half-width is ~0.55 m, seen from a camera pitched 58
   * degrees down onto it. The particles were fine. They were behind the character,
   * every single one, for their entire lives.
   *
   * The repair is the same as the heal pulse's: **start on the RIM of the footprint,
   * not at its centre, and leave fast enough to stay clear.** A splash you kick up
   * belongs beside your feet anyway, not inside your shins.
   */
  private spawnPuddleSplash(xM: number, zM: number): void {
    bumpVfxQaCount('puddleSplash');
    const count = 5;
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      const ang = (i / count) * Math.PI * 2 + Math.random() * 1.0;
      // Rim of the fighter's own footprint. `CHARACTER_RADIUS` is the sim's collision
      // radius (1.05 m); 0.6 of it clears the visible silhouette without throwing the
      // droplets so wide they stop reading as this fighter's splash.
      const r = CHARACTER_RADIUS * (0.58 + Math.random() * 0.16);
      p.active = true;
      p.life = 0;
      p.maxLife = 0.3 + Math.random() * 0.12;
      p.sprite.visible = true;
      p.sprite.position.set(xM + Math.cos(ang) * r, STATUS_RING_Y, zM + Math.sin(ang) * r);
      // 2.2 m/s outward (was 0.6): over the same life that is another 0.7-0.9 m, so a
      // droplet ENDS at ~1.4 m from centre instead of ~0.38 m. The whole arc is now
      // outside the silhouette rather than the whole arc being inside it.
      const outward = 2.2 + Math.random() * 0.6;
      p.vx = Math.cos(ang) * outward;
      p.vz = Math.sin(ang) * outward;
      p.vy = 1.1 + Math.random() * 0.5;
      p.gravity = -5.5;
      // ~3x the first pass (was 0.20-0.26 shrinking to 0.03). Measured against the
      // current camera those droplets spanned 0.03-0.04m for most of their life —
      // about TWO PIXELS — with a 0.22m peak on the first frame, so the splash was
      // present, correct and completely sub-perceptual. This is not the old depth bug
      // (fixed: see the spawn-height note above); it is a scale failure against a
      // camera that moved out from under it. At 0.6m a droplet is ~29% of a
      // character's height, which is a readable splash without becoming a smoke plume.
      p.startScale = 0.58 + Math.random() * 0.2;
      p.endScale = 0.12;
      p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1;
      // Additive blending (this whole pool's material — see the constructor) washes
      // a pale colour out to near-white against a bright background rather than
      // reading as a distinct hue; that's fine here since these only need to read as
      // bright droplets of light catching a splash, not carry any colour meaning of
      // their own (this design deliberately put NO meaning on colour any more — see
      // the file header). Lifted toward white instead of fighting the blend mode.
      p.mat.color.set('#E8F8FF');
    }
  }

  /**
   * A shot that stops dead on a counter — `projectile-destroyed` with reason
   * `hit-cover`.
   *
   * ── The gap this closes ────────────────────────────────────────────────────────
   *
   * The event stream has two consumers, this layer and `audio/`, and they disagreed:
   * `audio/director.ts` plays `coverThud()` for `hit-cover` and this layer drew
   * **nothing at all** — `syncPool` removed the mesh and the projectile blinked out
   * mid-air. The header block above lists the kinds this layer deliberately does not
   * draw (`countdown-tick`, `match-started`, `match-ended` — all HUD moments with no
   * world position) and explicitly separated this one out as *"a GAP, not a
   * decision"*. A shot that vanishes with no visual is indistinguishable from a
   * rendering fault, and it is the one piece of feedback that teaches a player that
   * cover blocks shots.
   *
   * `expired` stays silent, on purpose and in step with audio's own reasoning: that
   * is a projectile fading out at max range, not a collision, and it happens on every
   * over-range shot in the game. Marking those would put a spark on the floor several
   * times a second.
   *
   * ── Why it is built the way it is ──────────────────────────────────────────────
   *
   *  - **Quieter than a hit, by construction.** A miss must never read as a hit, so
   *    this gets ~2.5 m of streak against the impact burst's flash + double ring +
   *    star decal + shards, and no ground decal at all. Rule 3 of the colour contract
   *    reserves persistent ground marks for HAZARDS; a scuff is not one, so it is
   *    purely transient.
   *  - **The sparks come back TOWARD the shooter.** They are mirrored about the wall
   *    normal-ish `-direction`, which is what sells "it stopped here" rather than
   *    "it carried on through". The direction is reconstructed in `match.ts` from the
   *    projectile's spawn and destroy positions, because the event carries neither
   *    velocity nor weapon.
   *  - **Chest height, not ground.** `PROJECTILE_HEIGHT` is where the shot actually
   *    was; a mark at the feet would point at the wrong place. Cover bodies are the
   *    arena's violet 258-268 BLOCKING band and this draws warm sparks over them, so
   *    the scuff separates from the thing it is hitting by both hue and value.
   */
  spawnCoverScuff(xWU: number, yWU: number, color: string, dirX: number, dirY: number): void {
    bumpVfxQaCount('coverScuff');
    const origin = groundPos(xWU, yWU);
    const mag = Math.hypot(dirX, dirY);
    // Back along the flight line — see the doc comment. Zero-length (a projectile
    // destroyed on its own spawn tick) falls back to straight up-screen, which is
    // still a legible scatter rather than a degenerate point.
    const bx = mag > 1e-4 ? -dirX / mag : 0;
    const bz = mag > 1e-4 ? -dirY / mag : -1;

    // The contact pop. Small — 0.85 m against the generic impact flash's 0.5-1.15x
    // sizeFactor (1.4-3.2 m for a real hit) — and short.
    const flash = this.allocParticle();
    flash.active = true; flash.life = 0; flash.maxLife = 0.12;
    flash.sprite.visible = true;
    flash.sprite.position.set(origin.x, PROJECTILE_HEIGHT, origin.z);
    flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
    flash.startScale = 0.42; flash.endScale = 0.85;
    flash.startOpacity = 0.95; flash.endOpacity = 0; flash.fadeEase = 1.4;
    flash.mat.color.set(color).lerp(WHITE, 0.45);

    // Sparks fanning back off the surface, within +/-60 degrees of the reflected
    // direction so they read as a deflection rather than an explosion.
    for (let i = 0; i < 5; i++) {
      const spread = (Math.random() - 0.5) * (Math.PI * 2 / 3);
      const c = Math.cos(spread), s = Math.sin(spread);
      const ax = bx * c - bz * s;
      const az = bx * s + bz * c;
      const p = this.allocParticle();
      p.mat.map = this.streakTex;
      p.mat.rotation = Math.atan2(az, ax);
      p.aspect = 0.22;
      p.active = true; p.life = 0; p.maxLife = 0.22 + Math.random() * 0.1;
      p.sprite.visible = true;
      // Start ON the surface, offset a little back along the flight line so the
      // sparks are not born inside the cover box they just hit — the same
      // "start outside the silhouette" repair the heal pulse and puddle splash needed.
      p.sprite.position.set(origin.x + bx * 0.22, PROJECTILE_HEIGHT, origin.z + bz * 0.22);
      p.vx = ax * (2.4 + Math.random() * 1.6);
      p.vz = az * (2.4 + Math.random() * 1.6);
      p.vy = 0.9 + Math.random() * 0.7;
      p.gravity = -7.5;
      p.startScale = 0.55 + Math.random() * 0.25;
      p.endScale = 0.12;
      p.startOpacity = 0.9; p.endOpacity = 0; p.fadeEase = 1.2;
      p.mat.color.set(SPARK_COLOR);
    }
  }

  /**
   * Lollipop's Giant Lollipop — an 8s-cooldown ultimate that per the ability text
   * "grows huge and hits the whole map".
   *
   * ── `bespokeOwnsGround`, and the comment that used to be here ──────────────────
   *
   * This function's original comment read: *"The normal melee-arc call already draws
   * its true cone/range (360°/huge radius already makes this screen-filling on its
   * own); this layers a racing shockwave ring + a big white flash + heavy scatter on
   * top."* That was true when written and stopped being true when
   * `vfx/weapons/lollipop.ts` landed a bespoke `cast()` that draws the SAME 20 m disc
   * with a swirl, a hard boundary and a racing rim of its own. Nobody re-read the
   * comment, so a third full-frame pass went on top of two others — see
   * `spawnWeaponCast` for the measured sum.
   *
   * `bespokeOwnsGround` is that arbitration, and the split is by ANCHOR, not by taste:
   *
   *   - The GROUND beats (two 17-21 m expanding rings) and the EPICENTRE beats
   *     (starburst pop at 5.2, flash sprite to 3.5 m, ten 4.5 m spark rays) are what
   *     a bespoke `cast()` already covers, and the epicentre pair is what actually
   *     erased the caster: the shockwave alone repainted **81.6%** of the fighter's
   *     own pixels — more than either of the two visually LARGER passes — because a
   *     3.5 m additive flash centred on a 2.1 m character is a whiteout of exactly
   *     that character.
   *   - The SHARDS stay in both modes. They are the only part of this effect anchored
   *     to nothing but the epicentre's own debris, they cost ~1 m of screen each, and
   *     the bespoke hook has no equivalent.
   */
  spawnGiantSlamShockwave(
    xWU: number,
    yWU: number,
    color: string,
    rangeWU: number,
    opts?: { bespokeOwnsGround?: boolean },
  ): void {
    bumpVfxQaCount('giantSlam');
    const origin = groundPos(xWU, yWU);
    const radiusM = wu(rangeWU);
    const bespokeOwnsGround = opts?.bespokeOwnsGround ?? false;

    if (!bespokeOwnsGround) {
      // Bright inner shockwave rim, racing out to the ability's true (huge) radius...
      const ring = this.allocRing();
      ring.active = true; ring.life = 0; ring.maxLife = 0.65;
      ring.startScale = 0.3; ring.targetScale = radiusM * 1.05;
      ring.startOpacity = 1;
      ring.mesh.visible = true;
      ring.mesh.position.set(origin.x, GROUND_VFX_Y + 0.02, origin.z);
      ring.mesh.scale.setScalar(ring.startScale);
      ring.mat.color.set(color).lerp(WHITE, 0.3);
      ring.mat.opacity = ring.startOpacity;

      // ...plus a second, softer ring trailing just behind it, so the shockwave reads
      // as a THICK expanding band rather than a single thin line racing outward.
      const ring2 = this.allocRing();
      ring2.active = true; ring2.life = 0; ring2.maxLife = 0.8;
      ring2.startScale = 0.15; ring2.targetScale = radiusM * 0.85;
      ring2.startOpacity = 0.6;
      ring2.mesh.visible = true;
      ring2.mesh.position.set(origin.x, GROUND_VFX_Y + 0.01, origin.z);
      ring2.mesh.scale.setScalar(ring2.startScale);
      ring2.mat.color.set(color);
      ring2.mat.opacity = ring2.startOpacity;

      // Starburst flash — the sparkle silhouette, not just a soft circle, is what
      // makes an 8-second ultimate read as a genuinely special event. Pulled back
      // slightly from round 1 (was scale 6.5 / flash-white 0.55) — big enough to
      // dominate the frame, but not so bright it fuses with the shard debris below
      // into one indistinct white mass, which a critic pass explicitly called out
      // ("zero debris/sparks" — they WERE there, just visually swallowed).
      this.spawnStarPop(origin, IMPACT_HEIGHT * 1.5, color, 5.2, 0.38);

      const flash = this.allocParticle();
      flash.active = true; flash.life = 0; flash.maxLife = 0.3;
      flash.sprite.visible = true;
      flash.sprite.position.set(origin.x, IMPACT_HEIGHT * 1.5, origin.z);
      flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
      flash.startScale = 1.8; flash.endScale = 3.5;
      flash.startOpacity = 0.9; flash.endOpacity = 0; flash.fadeEase = 1.2;
      flash.mat.color.set(color).lerp(WHITE, 0.4);

      // Long hit-spark rays punching outward from the epicentre, on top of the ring —
      // SPARK_COLOR (not the weapon colour) so they read as their own bright layer.
      this.spawnStreaks(origin, IMPACT_HEIGHT * 0.6, '#FFE79A', 10, 4.5, 0.55);
    }

    // Shards only — the dedicated flash+rings above already cover this cast's
    // "flash" and "shockwave rim" beats; a second overlapping flash/ring from the
    // shared burst helper just stacked additive brightness into a full whiteout.
    // These now render as angular crystal debris (see `burst`'s shard loop), not
    // more soft dots, so this is where the ultimate gets actual particle craft.
    this.burst(origin, color, 3.2, 14, { life: 0.9, speedMult: 1.7, skipFlash: true, skipRing: true, skipStreaks: true, skipDecal: true });
  }

  /** Shared flash+ring+decal+streaks+shards burst used by impact/death/giant-slam. */
  private burst(
    origin: { x: number; z: number },
    color: string,
    sizeFactor: number,
    shardCount: number,
    opts?: { life?: number; speedMult?: number; skipFlash?: boolean; skipRing?: boolean; skipStreaks?: boolean; skipDecal?: boolean },
  ): void {
    const life = opts?.life ?? 1;
    const speedMult = opts?.speedMult ?? 1;

    // Round 3 added a starburst "pop" here on top of the star-shaped ground decal
    // below — both pale/white, both roughly star-ish, both centred on the same
    // point, so a critic pass kept reading the two of them AS ONE shape ("a single
    // flat additive starburst sprite"). Cut entirely for the ordinary hit/death case
    // — the softer round `flash` a few lines down already covers "bright core", and
    // giant-slam keeps its OWN dedicated big pop (a real once-per-8s event, not
    // fighting a decal for the same silhouette). One star per burst, not two.

    // Ground-level jagged star mark, sized to at least match a fighter's own
    // footprint — see `spawnImpactStarDecal`'s comment for why this exists. Now the
    // ONLY star-shaped element in an ordinary hit, and deliberately outlives the
    // flash/shards by a good margin so it reads as a mark LEFT BEHIND, not part of
    // the initial pop.
    if (!opts?.skipDecal) {
      // Radius, so ~1m here is a ~2m mark — about one character height across at
      // typical weapon damage. See `spawnImpactBurst`'s note for why every
      // multiplier in this function is now expressed against the character rather
      // than against a reference plate's framing.
      this.spawnImpactStarDecal(origin, color, THREE.MathUtils.clamp(0.65 * sizeFactor, 0.55, 1.5), (0.55 + sizeFactor * 0.08) * life);
    }

    if (!opts?.skipFlash) {
      const flash = this.allocParticle();
      flash.active = true; flash.life = 0; flash.maxLife = (0.16 + sizeFactor * 0.04) * life;
      flash.sprite.visible = true;
      flash.sprite.position.set(origin.x, IMPACT_HEIGHT, origin.z);
      flash.vx = 0; flash.vy = 0; flash.vz = 0; flash.gravity = 0;
      flash.startScale = 0.5 * sizeFactor; flash.endScale = 1.15 * sizeFactor;
      flash.startOpacity = 1; flash.endOpacity = 0; flash.fadeEase = 1.4;
      flash.mat.color.set(color).lerp(WHITE, 0.3);
    }

    if (!opts?.skipRing) {
      // Bright inner rim...
      const ring = this.allocRing();
      ring.active = true; ring.life = 0; ring.maxLife = (0.24 + sizeFactor * 0.06) * life;
      ring.startScale = 0.15; ring.targetScale = 0.6 * sizeFactor + 0.35;
      ring.startOpacity = 0.95;
      ring.mesh.visible = true;
      ring.mesh.position.set(origin.x, GROUND_VFX_Y, origin.z);
      ring.mesh.scale.setScalar(ring.startScale);
      ring.mat.color.set(color).lerp(WHITE, 0.25);
      ring.mat.opacity = ring.startOpacity;

      // ...plus a softer, slightly larger companion ring right behind it, so the
      // shockwave reads as a band with body rather than a single thin line. It is
      // allowed to outrun the character's own footprint — a thin expanding rim
      // doesn't hide anything, unlike the opaque star mark above.
      const ring2 = this.allocRing();
      ring2.active = true; ring2.life = 0; ring2.maxLife = (0.32 + sizeFactor * 0.08) * life;
      ring2.startScale = 0.1; ring2.targetScale = (0.6 * sizeFactor + 0.35) * 1.35;
      ring2.startOpacity = 0.55;
      ring2.mesh.visible = true;
      ring2.mesh.position.set(origin.x, GROUND_VFX_Y - 0.01, origin.z);
      ring2.mesh.scale.setScalar(ring2.startScale);
      ring2.mat.color.set(color);
      ring2.mat.opacity = ring2.startOpacity;
    }

    // Hit-spark rays — deliberately SPARK_COLOR (a universal warm gold), not the
    // weapon's own colour, so they read as a distinct bright layer flying OVER the
    // colour-graded flash/decal rather than another same-hued shape fusing into them.
    if (!opts?.skipStreaks) {
      const streakCount = Math.max(4, Math.round(shardCount * 0.7));
      this.spawnStreaks(origin, IMPACT_HEIGHT, '#FFE79A', streakCount, (0.5 + sizeFactor * 0.5) * speedMult, 0.26 * life);
    }

    // Angular crystal-shard debris, NOT more soft glow dots (that was the critic's
    // repeated complaint across four rounds: "no shape vocabulary... reads as a
    // single flat sprite"). SPARK_COLOR, for the same reason as the streaks above —
    // every earlier round kept shards in the weapon's own hue, which is exactly what
    // let them optically merge into the flash/decal instead of reading as a separate
    // kind of thing. Sized up hard again this round (was 0.55x, now 0.95x) and, new
    // this round, each shard's `mat.rotation` is aligned to ITS OWN flight direction
    // (elongated via `aspect` along that axis) rather than a random spin — a still
    // screenshot can't show real motion, but a chunk visibly ELONGATED pointing away
    // from the epicentre reads as "flung outward" even frozen, the same trick 2D
    // hit-effect sprites have always used for exactly this problem. Pre-offset from
    // the epicentre so they read as already-scattered from the very first frame.
    // 0.4x, not 0.95x. At the old value a single shard sprite measured 2.6m against a
    // 2.1m character — one chip of debris bigger than the fighter it flew off, which
    // is most of why a hit read as one undifferentiated bloom rather than as debris.
    const shardBaseScale = 0.4 * sizeFactor;
    for (let i = 0; i < shardCount; i++) {
      const s = this.allocParticle();
      s.mat.map = this.shardTex;
      const ang = Math.random() * Math.PI * 2;
      s.mat.rotation = ang;
      s.aspect = 0.4 + Math.random() * 0.15;
      const speed = (2.6 + Math.random() * 2.8) * (0.6 + sizeFactor * 0.4) * speedMult;
      const startOffset = 0.18 + Math.random() * 0.24;
      s.active = true; s.life = 0; s.maxLife = (0.36 + Math.random() * 0.22 + sizeFactor * 0.06) * life;
      s.sprite.visible = true;
      s.sprite.position.set(
        origin.x + Math.cos(ang) * startOffset,
        IMPACT_HEIGHT,
        origin.z + Math.sin(ang) * startOffset,
      );
      s.vx = Math.cos(ang) * speed;
      s.vz = Math.sin(ang) * speed;
      s.vy = 1.3 + Math.random() * 1.8;
      s.gravity = -6.2;
      s.startScale = shardBaseScale * (0.8 + Math.random() * 0.5);
      s.endScale = shardBaseScale * 0.2;
      s.startOpacity = 1; s.endOpacity = 0; s.fadeEase = 0.85;
      s.mat.color.set(SPARK_COLOR);
    }
  }

  /**
   * Grab a free (or, failing that, closest-to-death) particle slot, reset to its
   * default look (soft glow, unrotated) so nothing a PRIOR occupant configured (a
   * star/streak texture, a rotation) leaks into this new use. Callers that want
   * something other than a plain glow dot (see `spawnStarPop`/`spawnStreaks`) set
   * `mat.map`/`mat.rotation` themselves right after allocating.
   */
  private allocParticle(): ParticleSlot {
    let best: ParticleSlot | null = null;
    for (const p of this.particles) {
      if (!p.active) { best = p; break; }
    }
    if (!best) {
      let bestRatio = -Infinity;
      for (const p of this.particles) {
        const r = p.life / p.maxLife;
        if (r > bestRatio) { bestRatio = r; best = p; }
      }
    }
    const slot = best!;
    slot.mat.map = this.glowTex;
    slot.mat.rotation = 0;
    slot.aspect = 1;
    return slot;
  }

  /** Single bright starburst pop — the instant, punchy "frame 1" flash of an impact,
   * separate from the softer colour-tinted afterglow flash that follows it. */
  private spawnStarPop(origin: { x: number; z: number }, height: number, color: string, scale: number, life: number): void {
    const p = this.allocParticle();
    p.mat.map = this.starTex;
    p.active = true; p.life = 0; p.maxLife = life;
    p.sprite.visible = true;
    p.sprite.position.set(origin.x, height, origin.z);
    p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
    p.startScale = scale * 0.5; p.endScale = scale;
    p.startOpacity = 1; p.endOpacity = 0; p.fadeEase = 1.7;
    // Kept the colour more saturated (was 0.6 toward white) — a fully white-hot pop
    // at this size was blowing out the debris/streaks sharing the same space.
    p.mat.color.set(color).lerp(WHITE, 0.45);
  }

  /** Radiating hit-spark rays out of an impact point — thin bright streaks at random
   * angles, reusing one texture via per-sprite `SpriteMaterial.rotation`. This is
   * what separates a "concentrated hit" from a generic puff of particles. */
  private spawnStreaks(origin: { x: number; z: number }, height: number, color: string, count: number, length: number, life: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.allocParticle();
      p.mat.map = this.streakTex;
      p.mat.rotation = Math.random() * Math.PI * 2;
      p.aspect = 0.22;
      p.active = true; p.life = 0; p.maxLife = life * (0.8 + Math.random() * 0.4);
      p.sprite.visible = true;
      p.sprite.position.set(origin.x, height, origin.z);
      p.vx = 0; p.vy = 0; p.vz = 0; p.gravity = 0;
      p.startScale = length * (0.7 + Math.random() * 0.3); p.endScale = length * 1.35;
      p.startOpacity = 0.95; p.endOpacity = 0; p.fadeEase = 1.3;
      p.mat.color.set(color).lerp(WHITE, 0.3);
    }
  }

  /** This pool is shared between melee-arc sweeps (which want `wedgeGradientTex`'s
   * apex→rim gradient, keyed to their own UVs) and the impact star decal (a UV-less
   * flat polygon, which wants a solid flat fill) — reset to the melee-arc default on
   * every allocation so a star decal's `map = null` never leaks into the next arc. */
  private allocWedge(): WedgeSlot {
    let slot: WedgeSlot | undefined;
    for (const w of this.wedges) if (!w.active) { slot = w; break; }
    if (!slot) slot = this.wedges.reduce((a, b) => (a.life / a.maxLife >= b.life / b.maxLife ? a : b));
    if (slot.mat.map !== this.wedgeGradientTex) {
      slot.mat.map = this.wedgeGradientTex;
      slot.mat.needsUpdate = true;
    }
    return slot;
  }

  private allocRing(): RingSlot {
    for (const r of this.rings) if (!r.active) return r;
    return this.rings.reduce((a, b) => (a.life / a.maxLife >= b.life / b.maxLife ? a : b));
  }

  /** Drop every tracked mesh AND reset one-shot effects — call on match restart so
   * stale VFX (a burst mid-fade, a status ring) doesn't linger into the next match. */
  clear(): void {
    for (const pool of [this.projectilePool, this.splatPool, this.trailPool]) {
      for (const obj of pool.values()) this.group.remove(obj);
      pool.clear();
    }
    for (const p of this.particles) { p.active = false; p.sprite.visible = false; }
    for (const w of this.wedges) { w.active = false; w.mesh.visible = false; }
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    // Bespoke per-weapon transients (`vfx/weapons/`) — a burst mid-fade from a
    // bespoke `impact()`/`cast()` hook is exactly the kind of stale VFX this method
    // exists to drop; see `lastSyncElapsedMs`'s own reset just below for why the
    // sim-time-delta tracking resets here too.
    for (const eff of this.transientEffects) this.group.remove(eff.object);
    this.transientEffects.length = 0;
    this.lastSyncElapsedMs = 0;
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      vis.slowRing.visible = false;
      vis.slowRingDark.visible = false;
      vis.slowTint.visible = false;
      vis.stunStars.forEach((s) => { s.visible = false; });
      vis.wardRing.visible = false;
      vis.wardPop = 0;
      // A stale snapshot carried into a fresh match would let the first hit of the
      // new match consult the previous match's timers.
      this.statusSnapshot[role] = { x: NaN, y: NaN, stunReady: true, slowReady: true };
      // Reset footstep-distance tracking too — see the `slowSplashState` field
      // comment: stale `lastX`/`lastY` from the match just ended, carried into a
      // fresh spawn position, would otherwise read as one huge instantaneous "jump"
      // and could fire a splash burst on the very first tick of the new match.
      const splash = this.slowSplashState[role];
      splash.lastX = NaN;
      splash.lastY = NaN;
      splash.distAccum = 0;
    }
  }

  dispose(): void {
    this.clear();
    delete window.__vfxSpawnTest;
    if (window.__vfxLayer === this) delete window.__vfxLayer;
    this.projectileGeo.dispose();
    this.splatGeo.dispose();
    this.trailGeo.dispose();
    this.splatMat.dispose();
    Object.values(this.trailMats).forEach((m) => m.dispose());
    this.materialCache.forEach((m) => m.dispose());
    this.materialCache.clear();

    this.glowTex.dispose();
    this.softDiscTex.dispose();
    this.starTex.dispose();
    this.streakTex.dispose();
    this.shardTex.dispose();
    this.wedgeGradientTex.dispose();
    for (const p of this.particles) p.mat.dispose();
    for (const w of this.wedges) w.mat.dispose();
    for (const r of this.rings) r.mat.dispose();
    this.wedgeGeoCache.forEach((g) => g.dispose());
    this.wedgeGeoCache.clear();
    this.ringUnitGeo.dispose();
    this.wardGeo.dispose();
    for (const role of ['player', 'enemy'] as const) {
      const vis = this.statusByRole[role];
      (vis.slowRing.material as THREE.Material).dispose();
      vis.slowRing.geometry.dispose();
      (vis.slowRingDark.material as THREE.Material).dispose();
      vis.slowRingDark.geometry.dispose();
      (vis.slowTint.material as THREE.Material).dispose();
      vis.stunStars.forEach((s) => (s.material as THREE.Material).dispose());
      vis.wardMat.dispose();
    }
  }

  private materialFor(color: string): THREE.Material {
    let mat = this.materialCache.get(color);
    if (!mat) {
      mat = flatMat(color);
      this.materialCache.set(color, mat);
    }
    return mat;
  }
}
