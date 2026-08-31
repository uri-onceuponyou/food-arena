/**
 * Per-ITEM VFX contract — the sibling of `vfx/weapons/types.ts`, and deliberately a
 * separate surface rather than an eleventh weapon entry.
 *
 * ── WHY A SECOND EXTENSION POINT AND NOT A REUSE OF `WeaponVfx` ────────────────
 *
 * A weapon hook is keyed by `(characterId, weaponKey)` and fires on the weapon event
 * stream: cast → projectile → trail → impact. Items are keyed by NOBODY's character —
 * any fighter may equip any item — and three of the ten have no impact at all. Two of
 * them (Spore Bloom, Shiitake Shield) are STATES that persist for seconds or for the
 * whole match, which the transient one-shot pipeline cannot express: `spawnTransient`
 * takes a lifetime up front and cannot be told "stop now".
 *
 * So there are exactly two shapes here, and an item may implement either or both:
 *
 *   `burst(ctx)`  — a one-shot, fired from an event, self-disposing. Uses the same
 *                   `spawnTransient` choke point every weapon effect goes through, so
 *                   it inherits `shadeVfxObject` + `litVfxObject` + union shading for
 *                   free and CANNOT become an eleventh unlit family by accident.
 *   `aura(THREE)` — a persistent object owned by one fighter slot, built once, shown
 *                   and hidden and driven by `VfxLayer.sync()`. It does NOT go through
 *                   `spawnTransient`, so it must light itself — see `litItemObject`.
 *
 * ── 🚨 EVERY MATERIAL HERE MUST BE LIT, AND THAT IS THE WHOLE REASON THIS FILE
 *    CARRIES A HOUSE RULE INSTEAD OF LEAVING IT TO TASTE ──────────────────────────
 *
 * This project measured its entire effects layer at **62 `MeshBasicMaterial` plus 6
 * more, ZERO lit**, and that was the literal cause of Uri's *"projectiles and
 * explosions look flat like pasted stickers"*. Ten new items is the single largest
 * opportunity this codebase has ever had to re-commit that mistake at scale.
 *
 *   - SOLID geometry → `toonMat` (a `MeshStandardMaterial`). Never `flatMat`.
 *   - GLOWS and SPRITES are the documented exception: an additive sprite is a light
 *     source, not a surface, and lighting one is meaningless. `flatMat`/`SpriteMaterial`
 *     with `AdditiveBlending` is correct there and only there.
 *   - GROUND MARKS that can PILE UP → the `src = ONE` accumulate blend, never
 *     `NormalBlending`. See `game/vfx.ts:groundMarkMat` and commit `31f481c`:
 *     `NormalBlending` delivers `A·C·V + (1−A)·below` with `V ≤ 1`, so overlapping
 *     members composite DARKER and a pile converges to a dark hole. `src = ONE` makes
 *     it `C·V + below·(1−A)`, which ACCUMULATES toward `C·V/A`. Spore Bloom and the
 *     Lasso both draw stacked ground quads and both use it.
 *
 * ── LEGIBILITY AT THE MATCH CAMERA IS A SIZE CONSTRAINT, NOT A STYLE ONE ───────
 *
 * The shipped match rig is `render/camera.ts`, `opts.pitchDeg ?? 58` — steep and far.
 * The lobby is `ui/screens/charStage.ts`, `pitchDeg: 20`. `CLAUDE.md` #3: the shallow
 * view is the better DETECTOR (interpenetration, limb attachment) and the steep view
 * is where the game is PLAYED. An item effect that only reads up close has failed.
 * Concretely, that pushes every silhouette here toward:
 *
 *   - GROUND-PLANE area over vertical detail. At 58° a horizontal disc is 0.53 of its
 *     own area on screen; a vertical plane of the same size is 0.85 — but the ground
 *     is where the fighters are and where a radius is READ. Both are used, and any
 *     effect whose meaning is "this region is dangerous" (Spore Bloom's damage radius,
 *     the Shield's telegraph) draws the region ON THE GROUND at its true size.
 *   - SILHOUETTE over texture. A 2 m object at match framing is tens of pixels tall.
 *   - MOTION that is not a spin about the view axis. A pure yaw spin is nearly
 *     invisible from above.
 */

import type * as THREE from 'three';

/**
 * The ten items, by VFX key.
 *
 * 🚨 **THESE KEYS ARE THIS FILE'S OWN, AND `game/rules.ts` DOES NOT YET DEFINE ANY OF
 * THEM.** Phase 1 was briefed as having landed item names, rarity and a visual brief in
 * `rules.ts` + `docs/ITEMS.md`. Re-derived 2026-08-31 on a clean tree: **`docs/ITEMS.md`
 * does not exist and `rules.ts` contains no item type, no item id and none of the ten
 * names** (`grep -rniE 'trampoline|mold|fungus|zombie|pompa' src docs` returns six hits,
 * every one an unrelated comment). So this layer names them itself, keeps the names in
 * ONE place, and the sim-side owner adopts or renames them with a single mapping.
 *
 * The names are derived from what each item DOES, in the game's own food register,
 * because Uri's spec asks for exactly that: *"Figure out names and looks for the items
 * based on what they do"*.
 */
export type ItemVfxKey =
  /** Stacking damage — consecutive hits on one victim compound. */
  | 'tenderiser'
  /** Trampoline — launch yourself toward or away from an enemy. */
  | 'flapjack'
  /** Ranged sleep, longer the farther the target is. */
  | 'warmMilk'
  /** "Pompa" — clogs the victim's weapon for 5 s. */
  | 'plunger'
  /** Ink spray — blots the VICTIM'S OWN SCREEN. See `render/stage.ts:InkBlotEffect`. */
  | 'inkSpritz'
  /** Black hole — swallows a fighter and spits them out beside a different enemy. */
  | 'gravyVortex'
  /** Mold cloud — permanent damaging aura around the holder. */
  | 'sporeBloom'
  /** Fungus shield — wind-up, then 5 s of reflecting damage back at attackers. */
  | 'shiitakeShield'
  /** Zombie power — resurrect once, when your killer is killed. */
  | 'leftovers'
  /** Rope — ties an opponent in place for 5 s. */
  | 'liquoriceLasso';

/** Every key, in the order the ten appear in Uri's spec. Exported so a probe can
 * iterate the registry without hardcoding a list that will go stale. */
export const ITEM_VFX_KEYS: readonly ItemVfxKey[] = [
  'tenderiser', 'flapjack', 'warmMilk', 'plunger', 'inkSpritz',
  'gravyVortex', 'sporeBloom', 'shiitakeShield', 'leftovers', 'liquoriceLasso',
] as const;

/**
 * Everything a one-shot item effect needs. One shape for all of them, same argument as
 * `WeaponVfxCtx`: four bespoke context types is four things to learn.
 */
export interface ItemVfxCtx {
  /** The exact `three` module the renderer uses. */
  THREE: typeof THREE;
  /**
   * World position in Three.js METRES, at GROUND level (y = 0) unless the effect's
   * own doc says otherwise. Ground rather than chest height because seven of the ten
   * items are read off the floor at 58°, and an effect that wants chest height can
   * add `CHARACTER_HEIGHT` itself — the reverse (guessing which height a caller meant)
   * is what put a medikit 0.30 m in the air for a commit.
   */
  position: THREE.Vector3;
  /**
   * A SECOND world position in metres, meaning-per-item and `null` when the item has
   * no second anchor. The vortex's exit, the lasso's anchor, the sleeper's caster.
   * Explicitly nullable so a hook cannot silently draw a rope to the origin.
   */
  target: THREE.Vector3 | null;
  /** Normalised XZ direction in metre space; zero-length when not meaningful. */
  direction: THREE.Vector3;
  /**
   * 0..1, meaning-per-item, and **always a FRACTION of a sim-owned quantity** — never a
   * raw game number. Tenderiser: stacks/max. Warm Milk: distance/max range. Flapjack:
   * launch distance/max. The sim owns the numerator and the denominator; this layer
   * must not re-derive either, which is `docs/LESSONS.md` §7's ten-contradicting-
   * elements failure.
   */
  strength: number;
  /** How long the effect should last, in seconds — derived by the caller from the
   * sim's own duration so a balance change to a 5 s clog cannot leave a 5 s picture. */
  seconds: number;
  /** `VfxLayer.spawnTransientObject`. Everything spawned through it is shaded, lit and
   * union-collected automatically, and removed after `lifetimeSeconds`. */
  spawnTransient(
    object: THREE.Object3D,
    lifetimeSeconds: number,
    onUpdate?: (progress: number, elapsedSeconds: number) => void,
  ): void;
}

/**
 * A persistent per-fighter effect: built once per slot, then shown/hidden and driven
 * every `sync()`.
 *
 * ⚠️ **`visible = false` IS NOT "OFF" FOR ANYTHING THAT ACCUMULATES.** An aura that
 * spawns motes has to stop spawning them, not just stop drawing them, or a shield
 * dropped and re-raised pops with a second of stale particles. `update()` is therefore
 * called with `active = false` rather than simply not being called, so the aura can
 * wind itself down deliberately.
 */
export interface ItemAura {
  /** Parent object. The layer adds this to its group once and never re-parents it. */
  root: THREE.Object3D;
  /**
   * @param elapsedMs  the SIM clock (`MatchState.elapsed`), so an aura freezes with
   *                   hit-stop exactly as the fighters do.
   * @param active     is the status currently running on this fighter
   * @param strength   0..1 — for the Shield this is the WIND-UP progress before it is
   *                   up and 1 while it holds, which is what makes the telegraph
   *                   readable to opponents.
   * @param groundPosM ground position in metres (y is ignored)
   */
  update(elapsedMs: number, active: boolean, strength: number, groundPosM: { x: number; z: number }): void;
  /** Release geometry and materials this aura owns exclusively. */
  dispose(): void;
}

export type ItemAuraBuilder = (t: typeof THREE) => ItemAura;

/**
 * One item's complete visual identity, in one object, beside the sentence describing
 * what the item DOES.
 *
 * `does` is not decoration: `docs/LESSONS.md` §7 records ten status elements that had
 * drifted apart from the mechanic they depicted, because the mechanic lived in one file
 * and the picture in another. Keeping the sentence next to the geometry does not
 * prevent drift, but it makes drift VISIBLE in the diff of the file that drew it.
 */
export interface ItemVfxSpec {
  key: ItemVfxKey;
  /** The player-facing name this layer proposes. See `ItemVfxKey`'s note: `rules.ts`
   * does not define these yet, so this is the current single source. */
  name: string;
  /** What the item does, in one line, from Uri's spec. */
  does: string;
  /**
   * The item's identity HUE in degrees, 0..360.
   *
   * 🚨 **THIS FIELD EXISTS BECAUSE OF A MEASUREMENT, NOT BECAUSE PALETTES ARE NICE.**
   * `docs/HANDOVER.md`'s one measured lead: **one hue owns 88% of the cast frame** —
   * 94.34% of chromatic pixels inside a single 35° band, concentration R > 0.995 — and
   * it is a CHARACTER/EFFECTS problem, not an arena one (the arena reads 58.47% across
   * three distinct colour masses). Ten new effects families is the largest single
   * chance to widen that axis, and the largest single chance to narrow it further by
   * defaulting every item to the same food-warm amber everything else already is.
   *
   * ⚠️ The direction is CONSTRAINED and both constraints are live: **never fix anything
   * by desaturating** (falsified four times), and there is **no standing chroma
   * direction in any document** — `CLAUDE.md`'s own chroma paragraph has been wrong
   * twice, in opposite directions. So this is not "add cool" or "add warm". It is
   * SPREAD: ten identities placed deliberately around the circle, stated here as a
   * number so `tools/tmp/iv_shot.mjs` can measure the delivered hue of each item's own
   * pixels against it rather than against a claim.
   */
  hueDeg: number;
  /** One-shot effect. Omit for an item that is purely a persistent state. */
  burst?: (ctx: ItemVfxCtx) => void;
  /** Persistent per-fighter effect. Omit for an item that is purely a one-shot. */
  aura?: ItemAuraBuilder;
}
