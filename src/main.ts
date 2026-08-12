/**
 * Game entry point.
 *
 * Mounts the screen shell (`ui/screens/shell.ts`) and hands it a starting route. The
 * shell owns everything after that: which screen is live, when a `GameSession` is
 * created and destroyed, and the single menu rAF loop.
 *
 * ── Boot route ──────────────────────────────────────────────────────────────
 * The default is the home screen. It used to be "straight into a match", and a
 * large amount of this project's tooling was built against that: every probe under
 * `tools/tmp/` drives `http://localhost:5173/?player=…&enemy=…` and waits on
 * `window.__gameReady`. Rather than break all of it, the boot route is derived:
 *
 *   * `?screen=opening|home|characters|trophies|shop|settings|lobby|match` — explicit, wins
 *     over everything. ⚠️ This IS a doc copy of the ladder below and it went stale once
 *     already; `shell.ts:ROUTE_NAMES` is the set a `popstate` validates against and the two
 *     have to be added to together.
 *   * otherwise, if ANY match-only QA parameter is present boot straight into the match,
 *     exactly as before. Those parameters have no meaning anywhere else, so their presence
 *     is an unambiguous statement of intent.
 *     ⚠️ **The list is `MATCH_ONLY_PARAMS` below and NOT a copy of it here.** This sentence
 *     used to enumerate six of them and had already gone stale on `fighters` — a doc copy
 *     of a list is a list that disagrees with itself, which is `CLAUDE.md`'s standing rule
 *     about counts applied to a set.
 *   * otherwise, home.
 *
 *   * otherwise, the OPENING title card, which continues to home on the first tap or
 *     on its own timer.
 *
 * A bare `/` therefore shows the title card and then the menu (the correct new
 * behaviour) while every existing screenshot and measurement script keeps working
 * untouched, because every one of them names a screen or passes a match parameter.
 */

import { createShell } from './ui/screens/shell';
import { audio } from './audio';
import { PlayerProfile } from './ui/screens/profile';
import { CHARACTER_IDS, type CharacterId } from './game/rules';
import { seatsFromParams } from './ui/screens/brawl';
import type { Route } from './ui/screens/types';

const params = new URLSearchParams(location.search);

/** Parameters that only make sense inside a live match — see the header. */
// ⚠️ `fighters` was MISSING here, so `?fighters=…` alone booted the title card and
// `__gameReady` never fired — a 90 s timeout that reads exactly like the sim refusing to
// seat the match. `np_nfighter` never hit it because it also passes `fogRadius`, which is
// on this list: a second parameter was masking the gap in the first.
// ⚠️ `seats` is here for exactly the reason the paragraph above records about `fighters`:
// `?seats=6` alone would otherwise boot the title card, `__gameReady` would never fire, and
// it would read as the sim refusing to seat the match. That note is the only reason this
// did not happen a second time, one parameter later.
const MATCH_ONLY_PARAMS = ['player', 'enemy', 'simSpeed', 'fogRadius', 'px', 'py', 'fighters', 'seats'];

function characterParam(name: string, fallback: CharacterId): CharacterId {
  const raw = params.get(name);
  return raw && (CHARACTER_IDS as readonly string[]).includes(raw) ? (raw as CharacterId) : fallback;
}

function bootRoute(profile: PlayerProfile): Route {
  const wantsMatch =
    params.get('screen') === 'match' ||
    (!params.has('screen') && MATCH_ONLY_PARAMS.some((p) => params.has(p)));

  if (wantsMatch) {
    const player = characterParam('player', profile.selected);
    // Any opponent but yourself. `donut` was the old hardcoded default and stays the
    // fallback so existing captures frame the same matchup.
    const enemyFallback: CharacterId = player === 'donut' ? 'hamburger' : 'donut';
    // `DECISIONS §66`'s flag, and it is a PASS-THROUGH: the whole policy — what counts as a
    // legal seat count, and what `undefined` means — lives in `screens/brawl.ts`, so this
    // file has no second opinion about it. `undefined` is what every other route carries and
    // what every shipped navigation produces, so a bare `/` and every existing `?player=`
    // probe reach `matchScreen` with the field absent, exactly as before this line existed.
    const seats = seatsFromParams(params);
    return { name: 'match', player, enemy: characterParam('enemy', enemyFallback), seats };
  }
  // `DECISIONS §74`'s lobby. It carries no arguments (`types.ts` says why at length), so
  // `?screen=lobby` is a complete description of it and a reload lands on a working screen
  // rather than re-deriving the boot route and showing the title card — which is the trap
  // that once made a capture labelled `home` photograph a different screen entirely.
  if (params.get('screen') === 'lobby') return { name: 'lobby' };
  if (params.get('screen') === 'characters') return { name: 'characters' };
  if (params.get('screen') === 'trophies') return { name: 'trophies' };
  if (params.get('screen') === 'shop') return { name: 'shop' };
  if (params.get('screen') === 'settings') return { name: 'settings' };
  if (params.get('screen') === 'home') return { name: 'home' };
  // A bare `/` is a cold launch, so it gets the title card. Everything above is an
  // explicit request for a specific screen and is honoured unchanged — which is what
  // keeps `?screen=home` and every `?player=…` probe under `tools/` working exactly as
  // before. The title card also auto-continues (see `opening.ts`), so nothing that
  // navigates to `/` and waits for the home screen can hang on it.
  return { name: 'opening' };
}

const profile = new PlayerProfile();

const shell = createShell({
  gameHost: document.getElementById('game')!,
  hudRoot: document.getElementById('hud')!,
  screenRoot: document.getElementById('screens')!,
  profile,
});

shell.navigate(bootRoute(profile));

// Start the theme. This is deliberately unconditional and deliberately not awaited:
// browsers block audio until a user gesture, so this call is expected to be refused on
// a cold load. The refusal is swallowed and the intent remembered, and `music.ts`
// retries once the engine reports `running` — which the engine's own gesture listeners
// keep pursuing, since a first gesture can itself be rejected. Net effect: music starts
// the moment the player touches anything, from any boot route, with no call site
// needing to know about autoplay policy.
audio.music.play();

const boot = document.getElementById('boot')!;
requestAnimationFrame(() => boot.classList.add('hidden'));
