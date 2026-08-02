/**
 * Arena contract.
 *
 * The brief froze the game design with ONE sanctioned exception: the arena. Layout,
 * prop count, scale and specific set-dressing are open to redesign. What must survive
 * is the gameplay *types*:
 *
 *   1. a central hazard players must avoid (the prototype's boiling pot),
 *   2. physical cover objects with real collision,
 *   3. at least one hazard that slows anyone standing in it (the puddle).
 *
 * Everything the simulation needs is expressed in PROTOTYPE WORLD UNITS (see
 * `src/units.ts`), so the frozen balance numbers in `game/rules.ts` keep working
 * unchanged no matter how the arena is redressed.
 */

import type * as THREE from 'three';

/** Axis-aligned solid box. Movement and projectiles both collide against these. */
export interface CoverBox {
  /** Centre, in world units. */
  x: number;
  y: number;
  /** Full extents, in world units. */
  w: number;
  h: number;
  /** Purely descriptive — useful for debugging and for VFX to pick an impact sound. */
  kind?: string;
}

/** Circular area effect on the ground. */
export interface HazardZone {
  x: number;
  y: number;
  radius: number;
  kind: 'damage' | 'slow';
  /** `damage` only: HP per tick and tick period, in ms. */
  damage?: number;
  tickMs?: number;
  /** `slow` only: movement multiplier applied while inside. */
  slowFactor?: number;
}

export interface ArenaDefinition {
  id: string;
  displayName: string;

  /** Playfield extents in world units. The prototype was 900 x 600. */
  width: number;
  height: number;

  /** Where the closing fog ring contracts toward. */
  center: { x: number; y: number };
  /** Fog radius at match start, in world units. */
  maxSafeRadius: number;

  /** Spawn points, in world units. */
  playerSpawn: { x: number; y: number };
  enemySpawn: { x: number; y: number };

  cover: CoverBox[];
  hazards: HazardZone[];

  /** The renderable scene graph. Feet of all props sit at y=0. */
  build(): THREE.Group;

  /**
   * Per-frame hook for ambient life — steam, bubbling, flickering flame, drifting
   * dust. Optional, but it is a large part of why a real game's arena feels alive
   * rather than like a static diorama.
   */
  update?(dt: number, elapsed: number): void;
}

export type ArenaFactory = () => ArenaDefinition;
