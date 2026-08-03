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
  /** Damage carried by this instance: `Weapon.damage` for `cast`/`projectile`, the
   * resolved per-hit amount for `impact` (matches what the generic burst scales its
   * own size by — see `spawnImpactBurst` in `game/vfx.ts`). */
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
