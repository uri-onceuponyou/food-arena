/**
 * Screen shell — the whole "app" layer, in one file.
 *
 * ── The shape, and why ──────────────────────────────────────────────────────
 * One live screen at a time; a tagged-union `Route` names it and carries its
 * arguments; a factory table turns a route into a `Screen`. That is the entire
 * router. No paths, no lifecycle hooks beyond `dispose`.
 *
 * ── SESSION CONTINUITY: the URL names the screen ────────────────────────────
 * This file used to touch `history` nowhere at all — `grep -rn "history\.\|popstate"
 * src/` returned zero hits across the whole project. The URL therefore never changed
 * as the player moved through the game, and `main.ts:bootRoute` re-derived the boot
 * route from the ORIGINAL bare `/` on every document load. So ANY reload — a Vite HMR
 * full-reload (measured at one every 9.3 s on the shared dev server, against a 45 s
 * match), a refresh, a restored tab, a mobile tab eviction, a renderer crash — landed
 * the player on the home screen.
 *
 * Uri reported it as *"the game is crashing mid-flight and starting over from
 * homescreen."* HMR was the trigger and `tools/tmp/playtest.mjs` removed it; THIS was
 * the mechanism that made it look like a crash, and it is what makes the app survive
 * a reload at all.
 *
 * Every mount now writes `?screen=<name>` (plus `player`/`enemy` for a match), which
 * is the contract `main.ts` already decodes — so the fix needs no change there, and
 * every existing `?player=…` probe under `tools/` keeps working untouched.
 *
 *   * ALL OTHER QUERY PARAMETERS ARE PRESERVED. `simSpeed`, `fogRadius`, `px`, `py`,
 *     `tier`, `aimMode`, `pointerLock`, `hold` and `apron` are read lazily by six
 *     different modules; a router that "tidied" the URL would silently break most of
 *     the tool suite. `tools/tmp/nav_history_probe.mjs` group 5 is the guard.
 *   * The first mount REPLACES, so the app is never one Back away from a blank tab.
 *   * Leaving the title card REPLACES too. It is boot-only ("a splash you can reach
 *     twice is a splash you are trapped in" — `types.ts`), so pushing it would make
 *     Back from home land on a splash that immediately auto-continues to home again.
 *   * Everything else PUSHES, so Back and the Android hardware back button move the
 *     player one screen out, including out of a match.
 *
 * ── ...and what "resume" means for a MATCH, which is a decision ─────────────
 * A match is the one route that cannot be restored. It is a live simulation with no
 * serialised form anywhere in the project, and inventing one — fighter positions, HP,
 * cooldowns, statuses, fog radius, the event stream, VFX pools, audio state — buys a
 * fight the player did not set up, at a disadvantage they cannot see, with a corrupt
 * match as its failure mode.
 *
 * So a reload of a match URL re-enters the SAME MATCHUP as a FRESH match. That keeps
 * the only durable part of the state — the player's stated intent, "fight this
 * matchup" — and throws away the part that was never recoverable. Nothing is lost by
 * it: `matchScreen.ts` banks a result only on `phase === 'ended'`, so an interrupted
 * match was never recorded either way (measured, `nav_history_probe.mjs` group 3:
 * wins/losses identical across the interruption).
 *
 * ── RENDER ROBUSTNESS: a lost GL context ────────────────────────────────────
 * `render/stage.ts` broadcasts `fa:webglcontextlost` / `fa:webglcontextrestored` when
 * the GPU drops (or returns) a context. This file is what the player sees: a notice
 * over the black canvas, and — if it has not come back after a grace period — a
 * Reload button. That button is only a real recovery BECAUSE of the history work
 * above: before it, "reload" meant "lose your screen and start again at home".
 *
 * The reason it can be this small is that the hard part of a game shell is not
 * routing — it is **resource handoff**. There is exactly one GPU and two things that
 * want it: the menus' character portrait and a live match. So the shell, not the
 * screens, owns that handoff:
 *
 *   * navigating INTO a match destroys the shared portrait context first
 *     (`disposeCharacterStage`), so the game never starts while an idle menu context
 *     is still resident;
 *   * navigating BETWEEN menus keeps that context alive and simply re-parents its
 *     canvas, so bouncing home → foods → home does not thrash WebGL;
 *   * the swap happens behind an opaque curtain, because a single 3D context cannot
 *     be in two places at once and therefore cannot be cross-faded.
 *
 * The shell also owns the ONLY requestAnimationFrame loop the menus use, and runs it
 * only while the mounted screen defines `update()`. A live match defines no `update`
 * — `GameSession` drives its own loop — so there is never a second rAF ticking
 * alongside the game.
 */

import type { Route, RouteName, Screen, ScreenContext } from './types';
import { CHARACTER_IDS, type CharacterId } from '../../game/rules';
import { seatCountFor } from './brawl';
import { PlayerProfile } from './profile';
import { ensureScreenStyles } from './theme';
import { disposeCharacterStage } from './charStage';
import { audio } from '../../audio';
import { createHomeScreen } from './home';
import { createOpeningScreen } from './opening';
import { applyStoredSettings, createSettingsScreen } from './settings';
import { createCharacterSelectScreen } from './characterSelect';
import { createTrophyRoadScreen } from './trophyRoad';
import { createShopScreen } from './shop';
import { createLobbyScreen } from './lobby';
import { createMatchScreen } from './matchScreen';
import { ADMIN_ENABLED, ADMIN_OFF_REASON } from '../../admin/gate';
import { createAdminScreen } from '../../admin/adminScreen';

declare global {
  interface Window {
    /** Name of the mounted screen. Read by screenshot/QA drivers. */
    __screen?: RouteName;
    /** False while a navigation curtain is up. */
    __screenReady?: boolean;
    /** QA-only navigation handle, same spirit as `?simSpeed=` in `match.ts`. */
    __shell?: { navigate(route: Route): void; route(): Route };
    /**
     * QA-only FAULT INJECTION, same spirit as `__shell` above. Each key is a
     * countdown of how many times to throw at that seam:
     *
     *     window.__shellFault = { build: 1 };   // the next screen fails to construct
     *
     * It exists because the three hardening paths below — a screen that throws while
     * building, one that throws in `update()`, one that throws in `dispose()` — are
     * otherwise untestable without committing a deliberately broken screen module,
     * and this project's rule is that a probe which fails before and passes after IS
     * the deliverable. Costs one property read per seam.
     */
    __shellFault?: { build?: number; update?: number; dispose?: number } | null;
  }
}

/**
 * Every route name, as data, so a value off `history.state` can be validated.
 *
 * ⚠️ `main.ts`'s header documents this same ladder in prose and says the two have to be
 * added to together — it went stale once already. `admin` is in both.
 *
 * 🚨 **`admin` IS CONDITIONAL, AND THIS IS THE WEAKEST OF THE THREE GATES ON IT.**
 * It only decides what `parseRoute`/`routeFromSearch` will accept off `history.state` or
 * the address bar. It does NOT cover `window.__shell.navigate({ name: 'admin' })`, which
 * this file publishes in production for QA and which a player with devtools open has the
 * same access to. `build()` is what covers that, and it is the gate `adm_unreachable.mjs`
 * actually points its known-bad at.
 */
const ROUTE_NAMES: readonly string[] = [
  'opening', 'home', 'characters', 'trophies', 'shop', 'settings', 'lobby', 'match',
  ...(ADMIN_ENABLED ? ['admin'] : []),
];

function isCharacterId(v: unknown): v is CharacterId {
  return typeof v === 'string' && (CHARACTER_IDS as readonly string[]).includes(v);
}

/**
 * 🚨 **`seats` USED TO BE DROPPED BY EVERY PATH IN THIS FILE, AND IT WAS SILENT.**
 *
 * `parseRoute` reconstructed `{ name, player, enemy }` and `routeUrl` wrote three keys, so
 * a match route carrying `seats: 6` survived exactly as long as nobody touched history:
 * one `history.back()` — i.e. the **Android hardware back button** — and the same match
 * came back as a 1v1, with nothing red anywhere. Measured on a lobby-shaped arm before this
 * fix (`e858594`'s probe): `route.seats === 6` on mount, **absent from the URL**, and
 * `undefined` after one back and after a reload.
 *
 * It hid because the flag's only caller was `main.ts`, which reads `?seats=` off the boot
 * URL — and `routeUrl` seeds from `location.search`, so a boot parameter was copied forward
 * by the "preserve every other query parameter" rule. **The data was present in two places
 * and the route object still lost it.** A screen that navigates with `seats` set has no such
 * accident to be saved by, which is why this is a prerequisite for the lobby and not a
 * follow-up to it.
 *
 * `seatCountFor` rather than a `typeof v === 'number'` check: `history.state` outlives the
 * build that wrote it, so this is untrusted input and the LEGAL range is `brawl.ts`'s to
 * state — the same function `?seats=` is parsed through.
 */
function seatsOf(raw: unknown): number | undefined {
  return typeof raw === 'number' ? seatCountFor(raw) : undefined;
}

/**
 * Validate an untrusted value into a `Route`, or refuse.
 *
 * `history.state` outlives the code that wrote it — a restored tab can hand this file
 * a state object written by a previous BUILD of the game, and a hand-edited URL can
 * hand it anything at all. `build()` would then index a factory table with a name
 * that is not in it (returning `undefined` for a `Screen`) or hand `startGame` a
 * character id that does not exist. Both are the black-screen-forever failure this
 * whole pass exists to remove, so nothing crosses this boundary unvalidated.
 */
function parseRoute(raw: unknown): Route | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = (raw as { name?: unknown }).name;
  if (typeof name !== 'string' || !ROUTE_NAMES.includes(name)) return null;
  if (name === 'match') {
    const { player, enemy, seats } = raw as { player?: unknown; enemy?: unknown; seats?: unknown };
    return isCharacterId(player) && isCharacterId(enemy)
      ? { name, player, enemy, seats: seatsOf(seats) }
      : null;
  }
  return { name } as Route;
}

/**
 * The route a URL describes, or null.
 *
 * `main.ts` owns the BOOT decoding (it has extra rules this must not duplicate: a
 * bare `/` is a cold launch and gets the title card, and any match-only QA parameter
 * on its own means "go straight to a match"). This is the narrower question a
 * `popstate` asks — *what does this history entry say?* — and the two agree on the
 * one thing that matters, the `?screen=` contract.
 *
 * Only reached when a history entry carries no state of ours: an entry created before
 * this code shipped, or one produced by someone editing the address bar.
 */
function routeFromSearch(search: string): Route | null {
  const p = new URLSearchParams(search);
  const name = p.get('screen');
  if (name === null || !ROUTE_NAMES.includes(name)) return null;
  if (name === 'match') {
    const player = p.get('player');
    const enemy = p.get('enemy');
    return isCharacterId(player) && isCharacterId(enemy)
      // Parsed through `brawl.ts` exactly as `main.ts` parses the boot URL, so a
      // hand-edited `?seats=99` is refused identically on both paths.
      ? { name, player, enemy, seats: seatsFromSearch(p) }
      : null;
  }
  return { name } as Route;
}

/** `?seats=` off an arbitrary search string. Same policy as `main.ts`, one function down. */
function seatsFromSearch(p: URLSearchParams): number | undefined {
  const raw = p.get('seats');
  return raw === null ? undefined : seatCountFor(Number(raw));
}

function sameRoute(a: Route, b: Route): boolean {
  if (a.name !== b.name) return false;
  // ⚠️ `seats` IS part of a match's identity. Without it, 6 seats → 2 seats on the same
  // matchup was `sameRoute`, so `historyModeFor` REPLACED instead of pushing and Back
  // skipped straight past the six-player match the player had just left.
  if (a.name === 'match' && b.name === 'match') {
    return a.player === b.player && a.enemy === b.enemy && a.seats === b.seats;
  }
  return true;
}

/** How a navigation should move the history stack. `none` = the browser already did. */
type HistoryMode = 'push' | 'replace' | 'none';

/**
 * The URL for a route — the CURRENT url with `screen` (and the match's own arguments)
 * overwritten, and everything else left exactly as it was. See the header: the six
 * modules that read QA parameters lazily all depend on this being additive.
 *
 * `player`/`enemy` are deleted off a non-match route because they would be a lie
 * there — the roster writes the player's pick to the profile, not to the URL — and
 * `main.ts` only reads them when `screen=match`.
 */
function routeUrl(route: Route): string {
  const p = new URLSearchParams(window.location.search);
  p.set('screen', route.name);
  if (route.name === 'match') {
    p.set('player', route.player);
    p.set('enemy', route.enemy);
    // ⚠️ DELETED when absent, not left alone. `?seats=` is a MATCH-ONLY parameter
    // (`main.ts:MATCH_ONLY_PARAMS`) and this function seeds from the current search — so a
    // boot URL of `?seats=6` used to be copied onto every later navigation, including the
    // two-seat duel character select starts. The URL would say 6 while the match played 2,
    // and a reload of it would then honour the URL: the same matchup coming back with four
    // extra fighters. Absent means absent.
    if (route.seats === undefined) p.delete('seats'); else p.set('seats', String(route.seats));
  } else {
    p.delete('player');
    p.delete('enemy');
    p.delete('seats');
  }
  const q = p.toString();
  return `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
}

function writeHistory(route: Route, mode: HistoryMode): void {
  if (mode === 'none') return;
  try {
    const state = { fa: 1, route };
    if (mode === 'push') window.history.pushState(state, '', routeUrl(route));
    else window.history.replaceState(state, '', routeUrl(route));
  } catch {
    // `pushState` throws a SecurityError on `file://` and inside a sandboxed iframe,
    // and some embedded webviews rate-limit it. A game that will not start because it
    // could not update its address bar is a worse bug than the one this fixes.
  }
}

/** How long a lost GL context may stay lost before the player is offered a way out. */
const GL_NOTICE_GRACE_MS = 3000;
/** Consecutive throws from a screen's `update()` before the menu loop is given up on. */
const MAX_UPDATE_FAILURES = 10;

export interface ShellOptions {
  /** `#game` — where a match mounts its WebGL canvas. */
  gameHost: HTMLElement;
  /** `#hud` — where the in-match DOM HUD mounts. */
  hudRoot: HTMLElement;
  /** `#screens` — where this shell builds its own DOM. */
  screenRoot: HTMLElement;
  profile?: PlayerProfile;
}

export interface Shell {
  navigate(route: Route): void;
  readonly route: Route;
  dispose(): void;
}

/** Milliseconds the curtain is opaque before the swap. Matches the CSS transition
 *  on `.fa-curtain`; kept as one constant so the two cannot drift. */
const CURTAIN_MS = 140;

export function createShell(opts: ShellOptions): Shell {
  ensureScreenStyles();
  // Preferences the player set on the settings screen, re-applied before the first
  // screen mounts. Done here rather than inside `settings.ts`'s factory because a
  // preference that only takes effect once you have visited the screen that sets it
  // is not a preference.
  applyStoredSettings();

  const root = document.createElement('div');
  root.className = 'fa-root';
  root.innerHTML = `
    <div class="fa-bg"></div>
    <div class="fa-rays"></div>
    <div class="fa-dots"></div>
    <div class="fa-stack" data-el="stack"></div>
    <div class="fa-curtain" data-el="curtain"></div>
  `;
  opts.screenRoot.appendChild(root);

  const stack = root.querySelector<HTMLDivElement>('[data-el="stack"]')!;
  const curtain = root.querySelector<HTMLDivElement>('[data-el="curtain"]')!;

  const profile = opts.profile ?? new PlayerProfile();

  let current: Screen | null = null;
  let currentRoute: Route = { name: 'home' };
  let raf = 0;
  let lastT = 0;
  /** Set while a curtain-covered swap is in flight, so a double tap on two different
   *  destinations cannot mount two screens. */
  let swapping = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  /** A `popstate` that arrived mid-swap. See `onPopState`. */
  let queuedPop: Route | null = null;
  /** Consecutive `update()` throws from the mounted screen. */
  let updateFailures = 0;

  /** One place that decides what "the app hit a problem" does. Never rethrows. */
  function report(what: string, err: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[shell] ${what}:`, err);
  }

  /**
   * QA fault injection — see `Window.__shellFault`. Returns true once per credit.
   * A missing/absent global is the only path 99.999% of runs ever take.
   */
  function faulting(seam: 'build' | 'update' | 'dispose'): boolean {
    const f = window.__shellFault;
    if (!f) return false;
    const n = f[seam];
    if (typeof n !== 'number' || n <= 0) return false;
    f[seam] = n - 1;
    return true;
  }

  const ctx: ScreenContext = {
    navigate,
    profile,
    gameHost: opts.gameHost,
    hudRoot: opts.hudRoot,
  };

  function build(route: Route): Screen {
    if (faulting('build')) throw new Error(`__shellFault: build ${route.name}`);
    switch (route.name) {
      case 'opening': return createOpeningScreen(ctx);
      case 'home': return createHomeScreen(ctx);
      case 'characters': return createCharacterSelectScreen(ctx);
      case 'trophies': return createTrophyRoadScreen(ctx);
      // Pure DOM, no WebGL: the shop defines no `update()`, so mounting it stops the
      // shell's rAF loop entirely rather than ticking an idle portrait behind it.
      case 'shop': return createShopScreen(ctx);
      case 'settings': return createSettingsScreen(ctx);
      // Pure DOM like the shop — no `update()`, so mounting it stops the rAF loop rather
      // than ticking an idle portrait behind it. The seat portraits are `thumbs.ts` PNGs,
      // not a live stage, which is also why navigating here does not touch the shared
      // WebGL context the way `match` does.
      case 'lobby': return createLobbyScreen(ctx);
      // 🚨 §76 CONSTRAINT 5, AND THIS IS THE GATE THAT COUNTS. Pure DOM like the shop, so
      // it defines no `update()` and mounting it stops the rAF loop entirely.
      //
      // The throw is the point. Every other path to this screen — `?screen=admin`,
      // `history.state`, a hand-edited address bar — is already filtered by ROUTE_NAMES;
      // this one also covers `window.__shell.navigate({ name: 'admin' })`, which is a
      // production global and therefore the path an actual cheat would take. Throwing
      // rather than returning a stub means `mountFailed` runs, and `mountFailed` puts the
      // player on HOME with the URL rewritten — a working game, not a black rectangle.
      case 'admin':
        if (!ADMIN_ENABLED) throw new Error(ADMIN_OFF_REASON);
        return createAdminScreen(ctx);
      case 'match': return createMatchScreen(ctx, route);
    }
    // Unreachable by the type system and NOT unreachable in fact. A `Route` can arrive
    // from `history.state` written by an older build, or from a QA handle. Without
    // this the switch falls through, `build` returns `undefined`, and the caller dies
    // on `screen.root` — one line PAST the try/catch that exists to handle exactly
    // this, leaving an empty stack behind an opaque curtain. Fail where it can be
    // caught.
    throw new Error(`unknown route "${String((route as { name?: unknown }).name)}"`);
  }

  function stopLoop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function startLoop(): void {
    stopLoop();
    lastT = performance.now();
    const tick = (t: number): void => {
      if (disposed) return;
      // Clamped at BOTH ends, and the lower clamp is load-bearing, not defensive.
      //
      // A rAF callback receives the timestamp of when the FRAME BEGAN, which can
      // precede a `performance.now()` taken while scheduling it — so the very first
      // `t - lastT` is routinely negative. `CameraRig.update` computes its follow
      // weight as `1 - Math.pow(1 - followLerp, dt * 60)`; with the portrait's
      // `followLerp: 1` that is `Math.pow(0, negative)` = Infinity, the weight
      // becomes -Infinity, and `Vector3.lerp` turns the camera's look-at target into
      // NaN *permanently* — the portrait renders an empty backdrop and nothing ever
      // recovers it. Cost of the guard: one Math.max. Cost of not having it: a blank
      // hero on every menu, intermittently, depending on frame timing.
      const dt = Math.min(Math.max(0, (t - lastT) / 1000), 1 / 20);
      lastT = t;
      // A throw inside `update()` used to end the loop outright — no rethrow, no
      // reschedule, no message. The menu's 3D portrait simply froze forever while the
      // DOM around it stayed perfectly interactive, which is the hardest possible
      // version of `docs/LESSONS.md` §1 to diagnose: nothing is missing, nothing is
      // broken, one thing has just stopped moving. One bad frame is now survivable;
      // ten in a row is a real fault and the loop is stopped LOUDLY instead of
      // silently, leaving a usable menu rather than a dead one.
      try {
        if (faulting('update')) throw new Error('__shellFault: update');
        current?.update?.(dt);
        updateFailures = 0;
      } catch (err) {
        updateFailures++;
        if (updateFailures === 1) report(`screen "${currentRoute.name}" update() threw`, err);
        if (updateFailures >= MAX_UPDATE_FAILURES) {
          report(`screen "${currentRoute.name}" update() threw ${updateFailures} frames running — stopping the menu loop`, err);
          stopLoop();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function mount(route: Route, mode: HistoryMode): void {
    // Free the menu's WebGL context BEFORE the match asks for one of its own. Two
    // live contexts plus a full post chain is the one combination that will stutter
    // on a phone, and it is entirely avoidable.
    //
    // Guarded for the same reason the music is: this is a GPU teardown, i.e. the one
    // call in this function most likely to fail on a device that is ALREADY in
    // trouble, and it must not be able to stop the match from starting.
    if (route.name === 'match') {
      try {
        disposeCharacterStage();
      } catch (err) {
        report('disposeCharacterStage() threw', err);
      }
    }

    // The theme is MENU music: it stops for a fight and comes back afterwards.
    // Faded rather than cut — pausing a track mid-phrase is audible as a click and
    // reads as a bug. `fadeIn()` resumes from where it stopped rather than restarting,
    // so bouncing between menus never rewinds the track to the top.
    //
    // Done here, at the route transition, rather than inside the match: the shell is
    // the only place that knows both sides of the handoff, and combat SFX are a
    // separate bus that is unaffected either way.
    //
    // Guarded because a music transition must never be able to stop a screen from
    // mounting. The audio engine is a whole subsystem with its own worklets and its
    // own autoplay-policy retries; "the theme failed to fade" is not a reason for the
    // player to end up looking at an empty stack.
    try {
      if (route.name === 'match') audio.music.fadeOut();
      else audio.music.fadeIn();
    } catch (err) {
      report('music transition threw', err);
    }

    root.classList.toggle('is-ingame', route.name === 'match');

    // ── The screen is built BEFORE anything commits to it ─────────────────────
    // `unmount()` has already run, so at this instant there is no screen in the DOM
    // and `.fa-curtain` is opaque. A throw from here used to leave exactly that on
    // screen — forever, with `swapping` latched true so every later navigation was a
    // silent no-op. A black rectangle and a dead router, from one bad constructor.
    let screen: Screen;
    try {
      screen = build(route);
    } catch (err) {
      mountFailed(route, err);
      return;
    }

    currentRoute = route;
    current = screen;
    stack.appendChild(screen.root);
    writeHistory(route, mode);
    // A screen that mounts is a screen that has a live GL context, so whatever the
    // last one lost is no longer the player's problem. This is also what clears the
    // notice when a Stage is DISPOSED while lost — no `restored` event ever arrives
    // for that one.
    hideGlNotice();

    window.__screen = route.name;
    updateFailures = 0;
    if (current.update) startLoop(); else stopLoop();

    // `tools/shoot.mjs` was written for `preview.html` and waits on
    // `window.__previewReady`. Menus set it too (a match sets it from its own first
    // frame), so the existing screenshot harness works on every screen unchanged.
    // Two frames, because a screen that owns a 3D portrait has not rendered anything
    // until its rAF has run at least once.
    if (route.name !== 'match') {
      window.__previewReady = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!disposed) window.__previewReady = true;
      }));
    }
  }

  // ── The "something broke" surface ─────────────────────────────────────────
  // Styled inline rather than through `theme.ts`. Two reasons, and the first is the
  // load-bearing one: this markup exists precisely for the moments when the app is
  // already in trouble, and a panel that depends on a stylesheet having been injected
  // is a panel that can fail for the same reason as the thing it is reporting. The
  // second is that it is built LAZILY — nothing is in the DOM until a GL context is
  // actually lost — so no acceptance battery ever measures it and no screen has to
  // know it exists.

  function cardStyles(el: HTMLElement): void {
    el.style.cssText = [
      'pointer-events:auto', 'background:#FFF3DE', 'color:#1a1224',
      'border-radius:16px', 'padding:18px 22px', 'max-width:min(92vw,420px)',
      'text-align:center', 'box-shadow:0 10px 30px rgba(0,0,0,0.45)',
      "font-family:'Rubik',sans-serif",
    ].join(';');
  }

  function scrimStyles(el: HTMLElement): void {
    // `pointer-events:none` on the scrim and `auto` on the card, deliberately: a lost
    // portrait context on a menu must not lock the menu, and a lost context mid-match
    // must not swallow the pause chip. Only the card itself takes clicks.
    el.style.cssText = [
      'position:absolute', 'inset:0', 'z-index:120', 'display:grid',
      'place-items:center', 'padding:16px', 'background:rgba(20,13,30,0.72)',
      'pointer-events:none',
    ].join(';');
  }

  function reloadButton(label: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'min-height:44px', 'min-width:140px', 'margin-top:14px', 'padding:0 20px',
      'border:0', 'border-radius:999px', 'background:#F4A300', 'color:#1a1224',
      "font-family:'Rubik',sans-serif", 'font-weight:800', 'font-size:16px',
      'cursor:pointer',
    ].join(';');
    b.addEventListener('click', () => window.location.reload());
    return b;
  }

  /** The last-resort screen: home itself could not be built. */
  function fatalPanel(err: unknown): HTMLElement {
    const wrap = document.createElement('div');
    scrimStyles(wrap);
    wrap.style.background = '#16101f';
    wrap.dataset.el = 'fa-fatal';
    const card = document.createElement('div');
    cardStyles(card);
    const h = document.createElement('div');
    h.textContent = 'The kitchen would not open';
    h.style.cssText = 'font-weight:800;font-size:18px';
    const p = document.createElement('div');
    p.textContent = String((err as Error)?.message ?? err ?? 'unknown error');
    p.style.cssText = "margin-top:8px;font-size:13px;opacity:0.75;font-family:'Heebo',sans-serif;word-break:break-word";
    card.append(h, p, reloadButton('Reload'));
    wrap.appendChild(card);
    return wrap;
  }

  let glNotice: HTMLElement | null = null;
  let glNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Tell the player the GPU dropped the game's graphics.
   *
   * Immediately, because the alternative is a black canvas that reads as a crash —
   * which is the exact report this whole pass started from. The way OUT only appears
   * after a grace period: the overwhelmingly common case is a context that the browser
   * restores within a second or two, and offering "Reload" to somebody whose game is
   * about to fix itself would trade a blink for a lost match.
   */
  function showGlNotice(): void {
    if (disposed || glNotice) return;
    const wrap = document.createElement('div');
    scrimStyles(wrap);
    wrap.dataset.el = 'fa-gl-notice';
    const card = document.createElement('div');
    cardStyles(card);
    const h = document.createElement('div');
    h.textContent = 'Graphics interrupted';
    h.style.cssText = 'font-weight:800;font-size:18px';
    const sub = document.createElement('div');
    sub.textContent = 'The device took the graphics back. Restoring…';
    sub.style.cssText = "margin-top:6px;font-size:14px;opacity:0.8;font-family:'Heebo',sans-serif";
    const btn = reloadButton('Reload');
    btn.style.display = 'none';
    card.append(h, sub, btn);
    wrap.appendChild(card);
    root.appendChild(wrap);
    glNotice = wrap;
    glNoticeTimer = setTimeout(() => {
      glNoticeTimer = null;
      if (!glNotice) return;
      sub.textContent = 'The graphics have not come back. Reloading returns you to this same screen.';
      btn.style.display = 'inline-block';
    }, GL_NOTICE_GRACE_MS);
  }

  function hideGlNotice(): void {
    if (glNoticeTimer !== null) { clearTimeout(glNoticeTimer); glNoticeTimer = null; }
    glNotice?.remove();
    glNotice = null;
  }

  /** A thumbnail generator's context is not worth interrupting the player for. */
  function isOffscreenGl(ev: Event): boolean {
    return (ev as CustomEvent<{ offscreen?: boolean }>).detail?.offscreen === true;
  }
  function onGlLost(ev: Event): void { if (!isOffscreenGl(ev)) showGlNotice(); }
  function onGlRestored(ev: Event): void { if (!isOffscreenGl(ev)) hideGlNotice(); }

  /**
   * A screen refused to be built. Fall back rather than leave the app on a curtain.
   *
   * Home is the fallback because it is the one screen with no arguments, no WebGL
   * requirement it does not share with every other menu, and nothing to be wrong
   * about. If HOME is the thing that threw there is nowhere left to go, and the honest
   * answer is a panel that says so and offers a reload — which, now that the URL names
   * the screen, is a real attempt at recovery rather than a trip back to the start.
   */
  function mountFailed(route: Route, err: unknown): void {
    report(`screen "${route.name}" failed to mount`, err);
    stack.innerHTML = '';
    if (route.name !== 'home') {
      // `replace`, not `push`: the URL must end up naming the screen the player is
      // actually looking at, and the route that failed should not be one Back away.
      mount({ name: 'home' }, 'replace');
      return;
    }
    current = null;
    currentRoute = { name: 'home' };
    window.__screen = 'home';
    stopLoop();
    stack.appendChild(fatalPanel(err));
  }

  function unmount(): void {
    stopLoop();
    try {
      if (faulting('dispose')) throw new Error('__shellFault: dispose');
      current?.dispose();
    } catch (err) {
      // A screen that cannot clean itself up must not stop the next one mounting. It
      // may leak a listener or a GL context; the alternative is that the player is
      // stuck on the screen that is already misbehaving.
      report(`screen "${currentRoute.name}" dispose() threw`, err);
    }
    current = null;
    // Screens are responsible for their own DOM, but a screen that threw partway
    // through construction may have left something behind.
    stack.innerHTML = '';
  }

  /** Which way this navigation should move the history stack. */
  function historyModeFor(route: Route): HistoryMode {
    // The title card is boot-only, so its entry is REPLACED on the way out. Pushing
    // it would make Back from home land on a splash that immediately auto-continues
    // to home — a Back button that visibly does nothing.
    if (currentRoute.name === 'opening') return 'replace';
    // Re-selecting the screen you are on is not a place you can go Back to.
    if (sameRoute(route, currentRoute)) return 'replace';
    return 'push';
  }

  function go(route: Route, mode: HistoryMode): void {
    swapping = true;
    window.__screenReady = false;
    curtain.classList.add('is-on');
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      // `finally`, because `swapping` latching true is the single worst failure this
      // file can have: it does not break a screen, it breaks EVERY FUTURE
      // NAVIGATION, silently, with the curtain still up. `mount` has its own fallback
      // and this is the belt to its braces.
      try {
        unmount();
        mount(route, mode);
      } catch (err) {
        report('navigation threw', err);
      } finally {
        curtain.classList.remove('is-on');
        swapping = false;
        window.__screenReady = true;
        drainQueuedPop();
      }
    }, CURTAIN_MS);
  }

  function navigate(route: Route): void {
    if (disposed || swapping) return;
    go(route, historyModeFor(route));
  }

  /**
   * Back / forward, including the Android hardware back button.
   *
   * A `popstate` is not a request — the browser has ALREADY moved the URL — so unlike
   * a tap it cannot simply be dropped when a swap is in flight, or the address bar and
   * the screen would disagree from then on. It is queued instead and drained when the
   * curtain lifts, which is what makes hammering Back on a phone safe.
   */
  const onPopState = (ev: PopStateEvent): void => {
    if (disposed) return;
    const state = ev.state as { route?: unknown } | null;
    const route = parseRoute(state?.route)
      ?? routeFromSearch(window.location.search)
      ?? { name: 'home' };
    if (sameRoute(route, currentRoute)) return;
    if (swapping) { queuedPop = route; return; }
    go(route, 'none');
  };

  function drainQueuedPop(): void {
    const route = queuedPop;
    queuedPop = null;
    if (!route || disposed || sameRoute(route, currentRoute)) return;
    go(route, 'none');
  }

  const onResize = (): void => {
    try {
      current?.resize?.();
    } catch (err) {
      report(`screen "${currentRoute.name}" resize() threw`, err);
    }
  };

  /**
   * ── EVERY BUTTON IN THE GAME NOW MAKES A SOUND ──────────────────────────────
   *
   * Uri: *"i can't hear on menus as well now."* Half of that was a 404 on the deployed
   * theme (`audio/music.ts`, fixed). The other half was this: `uiClick()` has existed in
   * `audio/sounds.ts` since the audio pillar was built and the ONLY caller was the
   * settings screen's volume slider. Every other control in the game — Play, Foods,
   * Trophies, Shop, Back, Fight, every roster card, every milestone claim, every chest —
   * was silent when tapped. A menu that makes no sound on tap reads as unfinished, and
   * on a phone it is the only confirmation that the tap landed at all.
   *
   * ── WHY IT IS ONE DELEGATED LISTENER HERE, NOT A CALL PER BUTTON ────────────
   * There are ~60 click handlers across seven screens, four of which are themselves
   * delegated `[data-go]` / `[data-open]` / `[data-toggle]` dispatchers. Adding a call
   * to each one would mean a new control is silent until somebody remembers — the exact
   * failure this is fixing. The shell owns the only DOM node every screen mounts inside,
   * so one listener here covers every screen that exists and every screen that will.
   *
   * ── CAPTURE PHASE, and that is load-bearing ─────────────────────────────────
   * A bubbling listener never hears a click whose own handler navigates: `go()` unmounts
   * the screen, and a target removed from the document takes its ancestors' bubble path
   * with it. Capture runs before the target's own handler, so the sound is scheduled
   * while the button is still in the tree. This is also why it does NOT need to know
   * which screen it is on.
   *
   * ── ONE SOUND PER COMMITTED ACTION ──────────────────────────────────────────
   * `click`, not `pointerdown`/`pointermove`/`pointerup`: a pointer event fires on drags,
   * on stick grabs and on scroll starts on the trophy road, and wiring three of them
   * turns a menu into a machine gun. A click is the browser's own definition of "the
   * player committed to this control", it fires exactly once, and it fires for the
   * keyboard too (Enter/Space on a focused button), which a pointer event does not.
   *
   * ── WHAT IS DELIBERATELY EXCLUDED ───────────────────────────────────────────
   *   * MUTED. Guarded here rather than left to the master gain: a muted engine still
   *     builds and schedules the voice, and the point of `isMuted()` is that a muted
   *     player never costs anything. Same guard `settings.ts` already uses.
   *   * `input[type=range]`. The sliders own their own feedback on `input` (the audible
   *     ruler you set the level against) and are not in the selector — a second click on
   *     top of that would double-fire on every drag.
   *   * `data-clicksound="off"`. Exactly one control carries it: the MUTE toggle, whose
   *     own handler already says a click confirming that you just silenced the game
   *     would be a joke at the player's expense. Suppression is on the markup rather than
   *     on a class name from another screen, so this file stays decoupled from theirs.
   *   * DISABLED controls. `<button disabled>` does not emit `click` at all, but
   *     `aria-disabled` and `.fa-tab[disabled]`-style controls can, and a locked control
   *     that answers is a lie about what it will do.
   *
   * `data-clicksound="on"` is the opt-IN for the two committed actions that are not
   * buttons — the sheet scrim (tap outside to close) and the home hero (tap to poke).
   *
   * ⚠️ The FIRST tap of a session is silent by design and is not a bug: the engine
   * creates its `AudioContext` from its own `window`-capture gesture listener, which runs
   * before this one, and `resume()` has not resolved by the time `play()` is reached — so
   * that voice is counted as `droppedNotRunning`. The title card's own "tap to start"
   * spends it, which is why home is audible from its first button.
   */
  const CLICK_SOUND_SELECTOR = 'button, [role="button"], a[href], [data-clicksound="on"]';

  const onClickSound = (ev: MouseEvent): void => {
    try {
      if (audio.isMuted()) return;
      const node = (ev.target as HTMLElement | null)?.closest?.(CLICK_SOUND_SELECTOR);
      if (!node) return;
      if (node.closest('[data-clicksound="off"]')) return;
      if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return;
      audio.previewClick();
    } catch (err) {
      // A UI sound is the least important thing on the page and must never be able to
      // stop a button from working. The engine already swallows its own failures; this
      // covers the DOM walk above.
      report('ui click sound threw', err);
    }
  };

  root.addEventListener('click', onClickSound, true);
  window.addEventListener('resize', onResize);
  window.addEventListener('popstate', onPopState);
  window.addEventListener('fa:webglcontextlost', onGlLost);
  window.addEventListener('fa:webglcontextrestored', onGlRestored);

  window.__shell = { navigate, route: () => currentRoute };

  return {
    navigate(route) {
      // First mount skips the curtain — there is nothing to hide yet, and the boot
      // overlay in index.html is already covering the frame.
      //
      // It REPLACES rather than pushes, for two reasons. The boot route was derived
      // from this very URL by `main.ts`, so pushing would be a duplicate entry; and
      // more importantly it means the app is never one Back away from a blank tab,
      // which on Android is the difference between "back goes home" and "back closes
      // the game".
      if (!current) {
        // The title card is the one route whose URL is left alone: `/` already means
        // "cold launch", `main.ts` already answers it with the title card, and writing
        // `?screen=opening` would make a refresh during the 4.5 s splash replay the
        // splash instead of getting on with it.
        mount(route, route.name === 'opening' ? 'none' : 'replace');
        window.__screenReady = true;
        return;
      }
      navigate(route);
    },
    get route() { return currentRoute; },
    dispose() {
      disposed = true;
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      root.removeEventListener('click', onClickSound, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('fa:webglcontextlost', onGlLost);
      window.removeEventListener('fa:webglcontextrestored', onGlRestored);
      hideGlNotice();
      unmount();
      disposeCharacterStage();
      root.remove();
      delete window.__shell;
    },
  };
}
