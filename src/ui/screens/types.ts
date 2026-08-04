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
  | { name: 'home' }
  | { name: 'characters' }
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
