/**
 * Per-weapon VFX contract.
 *
 * `game/vfx.ts` is a GENERIC "hit burst" recipe reused for every weapon — one tinted
 * sphere projectile, one shard/ring/flash impact burst, one circular cast flash. That
 * plateaued at 3.5/10 in critique because it was judged against reference plates that
 * are bespoke per-ability: a tomato should splatter, glass should shatter, a lettuce
 * leaf should flutter. This module is the extension point that lets each weapon
 * override any of that with authored behaviour reflecting what it actually IS —
 * without the 11 characters' worth of authors ever touching the same file.
 *
 * ── The file-ownership boundary ─────────────────────────────────────────────────
 * One file per character under `src/vfx/weapons/` (`hamburger.ts`, `donut.ts`, ...),
 * each exporting only ITS OWN weapons, registered once in `index.ts`. An agent
 * authoring Hamburger's VFX never opens `donut.ts`, `waterbottle.ts`, `game/vfx.ts`,
 * or this file — the contract below, plus their own character file, is the whole
 * surface they need.
 *
 * Every hook is OPTIONAL. Implement only the ones a weapon actually needs — an
 * omitted hook falls back to `game/vfx.ts`'s existing generic effect exactly as it
 * behaves today (generic tinted-sphere projectile / shard-and-ring impact burst /
 * circular cast flash). A character file with zero weapon entries — or a weapon
 * entry with zero hooks — is a legal, working stub: everything just renders exactly
 * as it did before this system existed.
 */

import type * as THREE from 'three';
import type { CharacterId, Weapon } from '../../game/rules';

/**
 * Everything a hook needs to build or animate its effect. One shared shape across
 * all four hooks (rather than four bespoke ctx types) so there is exactly one thing
 * to learn — `object`/`dt` are simply `undefined` outside `trail()`.
 */
export interface WeaponVfxCtx {
  /** The exact `three` module the renderer uses. Provided mostly as a convenience —
   * `three` is an ordinary singleton package, so `import * as THREE from 'three'` at
   * the top of your own character file (see every file under `src/characters/`)
   * works identically and is what the two reference conversions
   * (`hamburger.ts`/`waterbottle.ts`) do. */
  THREE: typeof THREE;
  /** World position in Three.js METRES (x right, z into screen, y up), already at a
   * sensible height for this call: muzzle height for `cast`, chest height for
   * `impact`, flight height for `projectile`/`trail`. A fresh `THREE.Vector3` per
   * call — safe to read or mutate freely. */
  position: THREE.Vector3;
  /** Normalized direction in the same metre space: travel direction for
   * `projectile`/`trail`, the attacker's facing for `cast`, and (when known) the
   * attacker→hit direction for `impact`. Zero-length when not meaningful. */
  direction: THREE.Vector3;
  /** This weapon's `Weapon.color` (`game/rules.ts`) — the one deliberate hook into
   * the frozen game design every bespoke effect should key off of, so re-skinning a
   * weapon's colour in `rules.ts` doesn't require touching this file too. */
  color: string;
  /**
   * Damage carried by this instance: `Weapon.damage` for `cast`/`projectile`, the
   * resolved per-hit amount for `impact` (`amount * attacker.damageMul`, so character
   * levels and the trail boost both reach here).
   *
   * ⚠️ **SEVEN FILES CARRY A STALE COPY OF THE GENERIC SIZE CURVE. NOT FIXED — READ
   * THIS BEFORE TOUCHING ANY OF THEM.**
   *
   * `donut`, `burrito`, `egg`, `hotdog`, `sushi`, `pizza` and `taco` each define
   *
   *     impactScale(d) = clamp(0.85 + d * 0.035, 0.85, CAP)
   *
   * and each documents it, in near-identical words, as *"deliberately the same curve
   * `game/vfx.ts` re-derived for the generic burst"*. **That claim stopped being true
   * in `9a5703d`**, which re-derived the generic curve to `clamp(0.42 + d * 0.075,
   * 0.42, 2.0)` for dynamic range and did not reach the copies. This is
   * `docs/LESSONS.md` §5's "one stale COPY of a driver contaminated ten instruments"
   * recurring in shipped source rather than in tools.
   *
   * The size response across the authored damage span (2 -> 18, a 9.0x input):
   *
   *     game/vfx.ts generic     0.57 -> 1.77   **3.11x**
   *     donut   (cap 1.25)      0.92 -> 1.25    1.36x
   *     burrito (cap 1.35)      0.92 -> 1.35    1.47x
   *     hotdog/sushi/pizza      0.92 -> 1.40    1.52x
   *     egg/taco (cap 1.45)     0.92 -> 1.45    1.58x
   *     lollipop (two curves)   0.91 -> 1.39 / 0.97 -> 1.53
   *     hamburger               1.10 -> 1.90    1.73x
   *     waterbottle             1.12 -> 2.08    1.86x
   *     **soup, all three hooks — reads `ctx.damage` NOWHERE. 1.00x.**
   *
   * And it is not a corner: **27 of 33 weapons take a bespoke `impact()`**, so the
   * generic burst — the one that got the range fix — is reached by six.
   *
   * ── Why it is REPORTED and not fixed here ──────────────────────────────────────
   *
   * Because a straight swap is measurably a regression at the small end, and the
   * measurement already exists. Damage is near-constant per weapon (`combat.ts` passes
   * `w.damage * damageMul`), so `impactScale` is effectively a per-weapon CONSTANT —
   * changing the curve rescales every weapon's shipped effect once. The new curve is
   * smaller than the old one below ~11 damage (x0.62 at 2, x0.82 at 6), and `f12c9de`
   * had just spent a pass lifting bespoke impacts off a ~300 px delivered-pixel floor
   * (`waterbottle.Glass` 264 -> 479; `egg.Shards` measures 288-349 today). Sushi's Rice
   * (2 dmg), Soup's Splash/Spray (3) and Pizza's Cheese (4) would all drop 39-62% in
   * area and land back under it.
   *
   * The fix, when someone takes it, is one function here and eleven call sites — the
   * copies get DELETED, not patched (§5 again) — plus a per-weapon FLOOR taken from
   * `tools/tmp/vfx_wcov.mjs` run at each weapon's own damage before and after, since
   * that tool already measures delivered pixels and cast repaint per weapon and grew
   * `--volley` precisely because repeated measurement of unchanged code spreads
   * +/-10-20% at ~300 px.
   */
  damage: number;
  /** The full frozen weapon definition, in case an effect wants to react to more
   * than colour/damage (`range`, `cone`, `effect`, `splatter`, `pellets`, ...).
   * Read-only — this is the exact object `rules.ts` exports; never mutate it. */
  weapon: Weapon;
  characterId: CharacterId;
  /**
   * Add a short-lived, self-owned `Object3D` to the VFX layer; it is removed
   * automatically after `lifetimeSeconds`. Pass `onUpdate` to animate it (fade,
   * scale, drift) over its life — called once per render frame with `progress` in
   * `[0, 1]` and elapsed seconds. Available from every hook, including `projectile`/
   * `trail` (e.g. to drop a droplet as a projectile flies past).
   *
   * Performance contract: build geometries and materials ONCE at module scope (see
   * the two reference conversions) and reuse them across every spawn — only the
   * lightweight `Object3D`/`Mesh` wrapper itself should be created inside a hook.
   * This mirrors the zero-per-frame-allocation discipline the rest of `game/vfx.ts`
   * already holds itself to.
   */
  spawnTransient(
    object: THREE.Object3D,
    lifetimeSeconds: number,
    onUpdate?: (progress: number, elapsedSeconds: number) => void,
  ): void;
  /** `trail()` only: the `Object3D` this weapon's `projectile()` hook returned (or
   * the generic tinted sphere, if this weapon didn't implement `projectile`) —
   * mutate its transform here for per-frame spin/wobble/squash. `undefined` for
   * every other hook. */
  object?: THREE.Object3D;
  /** `trail()` only: seconds since the previous `trail()` call for this same
   * in-flight projectile. This is SIM time (derived from `MatchState.elapsed`), so
   * it freezes during hit-stop right along with the projectile itself — unlike the
   * hit-reaction particle pools in `game/vfx.ts`, which deliberately keep animating
   * through hit-stop. `undefined` for every other hook. */
  dt?: number;
}

export interface WeaponVfx {
  /** Build this weapon's in-flight projectile visual. Called once per projectile id,
   * at spawn — return a FRESH `Object3D` each call (clone from a module-scope
   * template geometry/material; never return one shared singleton instance, since
   * several projectiles from the same weapon — e.g. a multi-pellet spread — can be
   * in flight simultaneously). `sync()` repositions/orients it every frame for you;
   * omit this hook to keep the generic tinted sphere. */
  projectile?(ctx: WeaponVfxCtx): THREE.Object3D;
  /** Called every sim frame the projectile is alive, right after its position has
   * been updated (and it has been given a default facing-travel-direction rotation)
   * — use it for spin/squash/drip, or for dropping small `spawnTransient` flourishes
   * along the flight path. Omit for a projectile that needs nothing beyond that
   * default fly-straight-and-face-travel handling. */
  trail?(ctx: WeaponVfxCtx): void;
  /** The hit/explosion effect, fired once per `hit-landed` event this weapon caused.
   * Omit to keep the generic impact burst (flash + rings + shards). */
  impact?(ctx: WeaponVfxCtx): void;
  /** Muzzle/wind-up flash at the attacker, fired once per `weapon-fired` event this
   * weapon caused. Omit to keep the generic cast flash. */
  cast?(ctx: WeaponVfxCtx): void;
}

/** `${characterId}.${weapon.key}` — the registry's lookup key (see `index.ts`).
 * Weapon keys live in `game/rules.ts`, e.g. `CHARACTERS.hamburger.weapons[1].key`
 * ('Tomato') → `'hamburger.Tomato'`. */
export type WeaponVfxKey = `${CharacterId}.${string}`;

/** What each per-character file exports: ITS OWN weapons only, keyed by the short
 * `Weapon.key` (NOT prefixed with the character id — `index.ts` does that once,
 * centrally, when it builds the combined registry). An empty object is a perfectly
 * valid, working stub. */
export type CharacterWeaponVfxMap = Partial<Record<string, WeaponVfx>>;
