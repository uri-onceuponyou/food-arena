/**
 * Screen layer contracts.
 *
 * Deliberately tiny. This is a game with four or five screens, not an application,
 * so the "router" is a tagged union plus a factory table — no path parsing, no
 * history stack, no framework. Everything a screen is allowed to do is in
 * `ScreenContext`; everything the shell is allowed to do to a screen is in `Screen`.
 */

import type { CharacterId } from '../../game/rules';
import type { PlayerProfile } from './profile';

/**
 * Every destination in the game, with the data it needs to exist.
 *
 * A route carries its own arguments rather than reading them off shared mutable
 * state — that is what makes "start a match as Pizza against Egg" expressible
 * without a global, and it is why `match` is a route and not a mode flag.
 */
export type Route =
  /**
   * The title card. Boot-only: nothing navigates *back* to it, because a splash you
   * can reach twice is a splash you are trapped in. Its real job is not decoration —
   * it is the place the player's FIRST GESTURE is collected, which is what unlocks
   * Web Audio (see `opening.ts`).
   */
  | { name: 'opening' }
  | { name: 'home' }
  | { name: 'characters' }
  | { name: 'trophies' }
  /**
   * Boxes, their prices and their published drop rates.
   *
   * A route rather than a modal on the trophy road, because it is a destination with
   * its own scroll region, its own bottom bar and its own responsive layout — and
   * because a compliance surface that only exists inside a sheet is a surface no
   * screenshot, no contrast battery and no acceptance test ever sees.
   */
  | { name: 'shop' }
  | { name: 'settings' }
  | { name: 'match'; player: CharacterId; enemy: CharacterId };

export type RouteName = Route['name'];

export interface ScreenContext {
  /** Tear down this screen and mount another. Safe to call from an event handler. */
  navigate(route: Route): void;
  /** Persisted player state. Mutate through its own methods so it saves. */
  profile: PlayerProfile;
  /** Where a live match mounts its WebGL canvas (the `#game` div in index.html). */
  gameHost: HTMLElement;
  /** Where the in-match DOM HUD mounts (the `#hud` div in index.html). */
  hudRoot: HTMLElement;
}

export interface Screen {
  /** The screen's own DOM. The shell parents and removes this; the screen never
   *  touches anything outside it except the hosts handed to it in the context. */
  readonly root: HTMLElement;
  /**
   * Optional per-frame hook, seconds. The shell only runs a rAF loop while the
   * mounted screen defines this — a pure DOM screen costs nothing per frame, and a
   * live match (which drives its own loop inside `GameSession`) must not be ticked
   * twice.
   */
  update?(dtSeconds: number): void;
  /** Optional resize hook. Called on `window.resize` while mounted. */
  resize?(): void;
  dispose(): void;
}

export type ScreenFactory = (ctx: ScreenContext, route: Route) => Screen;
