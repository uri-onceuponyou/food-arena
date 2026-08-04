/**
 * Screen shell — the whole "app" layer, in one file.
 *
 * ── The shape, and why ──────────────────────────────────────────────────────
 * One live screen at a time; a tagged-union `Route` names it and carries its
 * arguments; a factory table turns a route into a `Screen`. That is the entire
 * router. No paths, no history stack, no lifecycle hooks beyond `dispose`.
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
import { PlayerProfile } from './profile';
import { ensureScreenStyles } from './theme';
import { disposeCharacterStage } from './charStage';
import { createHomeScreen } from './home';
import { createCharacterSelectScreen } from './characterSelect';
import { createMatchScreen } from './matchScreen';

declare global {
  interface Window {
    /** Name of the mounted screen. Read by screenshot/QA drivers. */
    __screen?: RouteName;
    /** False while a navigation curtain is up. */
    __screenReady?: boolean;
    /** QA-only navigation handle, same spirit as `?simSpeed=` in `match.ts`. */
    __shell?: { navigate(route: Route): void; route(): Route };
  }
}

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

  const ctx: ScreenContext = {
    navigate,
    profile,
    gameHost: opts.gameHost,
    hudRoot: opts.hudRoot,
  };

  function build(route: Route): Screen {
    switch (route.name) {
      case 'home': return createHomeScreen(ctx);
      case 'characters': return createCharacterSelectScreen(ctx);
      case 'match': return createMatchScreen(ctx, route);
    }
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
      current?.update?.(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function mount(route: Route): void {
    currentRoute = route;
    // Free the menu's WebGL context BEFORE the match asks for one of its own. Two
    // live contexts plus a full post chain is the one combination that will stutter
    // on a phone, and it is entirely avoidable.
    if (route.name === 'match') disposeCharacterStage();

    root.classList.toggle('is-ingame', route.name === 'match');
    current = build(route);
    stack.appendChild(current.root);

    window.__screen = route.name;
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

  function unmount(): void {
    stopLoop();
    current?.dispose();
    current = null;
    // Screens are responsible for their own DOM, but a screen that threw partway
    // through construction may have left something behind.
    stack.innerHTML = '';
  }

  function navigate(route: Route): void {
    if (disposed || swapping) return;
    swapping = true;
    window.__screenReady = false;
    curtain.classList.add('is-on');
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      unmount();
      mount(route);
      curtain.classList.remove('is-on');
      swapping = false;
      window.__screenReady = true;
    }, CURTAIN_MS);
  }

  const onResize = (): void => current?.resize?.();
  window.addEventListener('resize', onResize);

  window.__shell = { navigate, route: () => currentRoute };

  return {
    navigate(route) {
      // First mount skips the curtain — there is nothing to hide yet, and the boot
      // overlay in index.html is already covering the frame.
      if (!current) {
        mount(route);
        window.__screenReady = true;
        return;
      }
      navigate(route);
    },
    get route() { return currentRoute; },
    dispose() {
      disposed = true;
      if (pendingTimer !== null) clearTimeout(pendingTimer);
      window.removeEventListener('resize', onResize);
      unmount();
      disposeCharacterStage();
      root.remove();
      delete window.__shell;
    },
  };
}
