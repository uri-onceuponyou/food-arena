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
  /**
   * WHERE A MATCH IS CONFIGURED — `DECISIONS §74`, Uri, 2026-08-12:
   *
   * > *"We need the lobby where the gameplay is set, to be able to choose how many
   * > players, and assign bots to the one who plays locally. Also wire it up to
   * > multiplayer — real users can join the game as well (from UI perspective); the
   * > actual connection to multiplayer will be done later."*
   *
   * 🚨 **IT CARRIES NO ARGUMENTS, AND THAT IS A DECISION.** The obvious shape is
   * `{ name: 'lobby'; player; enemy }` mirroring `match` — and it is wrong here, because
   * the player's fighter already has ONE home (`profile.selected`, written by character
   * select's Equip and read by home's hero) and a route field would be a second. A route
   * argument that duplicates persisted state is a copy that goes stale the moment the
   * player equips someone from anywhere else.
   *
   * The opponent is the other half: `characterSelect.ts:pickOpponent` is `Math.random()`
   * and the lobby rolls its own seat 1 **once per mount**, so the field it SHOWS is the
   * field it starts. Carrying that on the route would put a rolled value in the URL and
   * in `history.state`, i.e. a Back button that re-enters the lobby with an opponent
   * chosen for a different visit. It is screen state, so it lives in the screen.
   *
   * Net effect: `?screen=lobby` is complete, a reload lands on a working lobby, and there
   * is nothing on this route that can disagree with the profile.
   */
  | { name: 'lobby' }
  /**
   * A live match.
   *
   * `seats` is the `DECISIONS §66` flag and it is **default-off by being OPTIONAL**: every
   * shipped navigation omits it (`characterSelect.ts:444` is the only one) and gets the
   * two-fighter duel this product has always played. Present and in
   * `MIN_FIGHTERS+1..MAX_FIGHTERS`, `matchScreen.ts` seats that many — `player` and `enemy`
   * keep their meaning as seats 0 and 1, and `screens/brawl.ts:brawlRoster` fills the rest.
   *
   * ⚠️ **A SEAT COUNT AND NOT A ROSTER, deliberately.** A route carrying the finished list
   * would put the "which five characters" policy in whichever screen happened to navigate —
   * i.e. one copy per affordance — and that policy is a **design default Uri may overrule**
   * (`brawl.ts` says so at length). One rule, one file, and a route field a future mode
   * selector can set without knowing it exists.
   */
  | { name: 'match'; player: CharacterId; enemy: CharacterId; seats?: number };

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
