/**
 * Pointer-lock + fullscreen lifecycle for a live match.
 *
 * ── The problem this solves ─────────────────────────────────────────────────
 * Aiming is mouse-driven, so the player is constantly sweeping the cursor toward
 * the edges of the window. On a windowed browser — and especially on a multi-monitor
 * desktop — the cursor walks straight off the canvas and a fire click lands on a
 * bookmark, another window, or the tab strip. Fullscreen alone does NOT fix that:
 * it removes the chrome and enlarges the target, but the cursor can still leave the
 * window on a second display. **Pointer Lock is the actual fix** — the OS cursor is
 * captured by the canvas and physically cannot leave it. Fullscreen is offered
 * alongside as a complement, never as a requirement.
 *
 * ── The four rules the Pointer Lock API imposes ─────────────────────────────
 * 1. It requires TRANSIENT USER ACTIVATION. A request outside a click/keydown is
 *    rejected, so the lock is only ever asked for from a real gesture (the capture
 *    chip, the resume scrim, the pause sheet's Resume button).
 * 2. **Escape is deliberately NOT an activation-triggering key** in Chrome/Firefox,
 *    precisely so a page cannot re-grab the mouse the instant the user asks to be
 *    let go. So "resume with Esc" can never re-acquire the lock — that path is
 *    handled by failing back to the paused scrim rather than resuming uncontrolled.
 * 3. The lock is dropped for free on Esc, alt-tab, window blur and tab switch. Every
 *    one of those means THE PLAYER HAS NO CONTROL, so each pauses the match through
 *    `GameSession.pause()` — the single pause mechanism the screen layer already owns.
 * 4. Rejection must never throw. Chrome also rate-limits re-acquisition for ~1s after
 *    a user-initiated exit, which is exactly why the resume affordance is a click the
 *    player makes rather than an automatic retry.
 *
 * ── Deliberately mouse-only ─────────────────────────────────────────────────
 * The whole module no-ops unless `(pointer: fine)` matches AND the API exists, so a
 * phone in landscape (a shipping target — see `LAUNCH_PLAN.md`) behaves exactly as it
 * does today and the future on-screen sticks inherit nothing from this file.
 *
 * ── QA escape hatch ─────────────────────────────────────────────────────────
 * Several Playwright probes drive REAL mouse events at absolute viewport coordinates
 * (`tools/tmp/menu_accept.mjs`'s `canvas-gets-mousemove` / `canvas-gets-mousedown` /
 * `canvas-is-top-at-centre` guard the input regression fixed in the screens work).
 * Under pointer lock those coordinates stop meaning anything, so:
 *
 *   ?pointerLock=0   force the whole system off (same spirit as `?fogRadius=`)
 *   ?pointerLock=1   force it on, overriding the auto-suppression below
 *   ?pointerLock=sim SIMULATED capture — see below
 *
 * `sim` exists because **Playwright's bundled Chromium refuses `requestPointerLock()`
 * unconditionally**, headed or headless, on a real http page, with the document
 * focused: `WrongDocumentError: The root document of this element is not valid for
 * pointer lock` (proven on a two-line page with nothing else in it). So the captured
 * half of this feature cannot be rendered by any automated probe we own. `sim` runs
 * the entire state machine — capture, virtual cursor, reticle, Esc, resume — with the
 * one call the test browser rejects stubbed out, which makes the aim model and the
 * reticle measurable in pixels. It changes NOTHING for a real player, who never has
 * that parameter on the URL.
 *
 * and it also auto-suppresses whenever `?shot=` or `?simSpeed=` is on the URL, since
 * both are unambiguous capture/QA markers and every screenshot in the project would
 * otherwise pick up the capture chip. Note the system is inert until the player makes
 * a gesture anyway, so a probe that never clicks the chip is unaffected either way.
 */

export interface PointerLockOptions {
  /** The element the mouse is locked to — the WebGL canvas. */
  target: HTMLElement;
  /** Freeze the match. Wired to `GameSession.pause()`. */
  pause: () => void;
  /** Un-freeze the match. Wired to `GameSession.resume()`, which calls `engage()` back. */
  resume: () => void;
  /** Told on every capture-state flip so `InputController` can switch cursor models. */
  onLockChange: (locked: boolean) => void;
}

export interface PointerLockController {
  /** False on touch/coarse-pointer devices, unsupported browsers, or with the hatch on. */
  readonly available: boolean;
  readonly locked: boolean;
  /**
   * Re-acquire the lock IF the player opted in. Safe to call outside a gesture: a
   * rejected request falls back to pausing and showing the resume scrim rather than
   * leaving the match running with no mouse capture.
   */
  engage(): void;
  /** Give the mouse back on purpose — no pause, no scrim. */
  release(): void;
  /** Match over / restarted. While inactive the lock is released so the game-over
   * card's own buttons are clickable, and the capture chip is hidden. */
  setMatchActive(active: boolean): void;
  dispose(): void;
}

type UiState = 'hidden' | 'prompt' | 'toast' | 'lost';

const STYLE_ID = 'pointerlock-styles';

/** How long the "captured" confirmation stays up before the HUD goes clean again. */
const TOAST_MS = 2600;

function lockFlag(): string | null {
  const params = new URLSearchParams(location.search);
  return params.get('pointerLock') ?? params.get('pointerlock');
}

function isEnabled(): boolean {
  const flag = lockFlag();
  if (flag === '0') return false;
  if (flag === '1' || flag === 'sim') return true;
  // Capture/QA runs: keep every screenshot and probe identical to today.
  const params = new URLSearchParams(location.search);
  if (params.has('shot') || params.has('simSpeed')) return false;
  return true;
}

function isMouseDevice(): boolean {
  if (typeof window.matchMedia !== 'function') return true;
  // `(pointer: fine)` is the mouse/trackpad test. A touch-only device reports coarse
  // and must never be handed a desktop-only capture mechanic.
  return window.matchMedia('(pointer: fine)').matches;
}

export function createPointerLock(opts: PointerLockOptions): PointerLockController {
  const { target } = opts;

  /** QA-only: run the state machine without the one API call the test browser
   * rejects. Never true for a real player — see the header. */
  const simulated = lockFlag() === 'sim';
  let simLocked = false;

  const supported =
    typeof document !== 'undefined' &&
    'pointerLockElement' in document &&
    typeof (target as Element).requestPointerLock === 'function';
  const available = supported && isMouseDevice() && isEnabled();

  /** The player's stated intent. Nothing is ever captured without this being true,
   * and it is what separates "the lock dropped, help" from "never wanted it". */
  let wantsLock = false;
  /** Set only while WE are giving the mouse back, so the resulting `pointerlockchange`
   * is not mistaken for the player losing control. */
  let releasing = false;
  let matchActive = true;
  let state: UiState = 'hidden';
  let toastTimer = 0;
  let disposed = false;
  /** A `requestPointerLock()` is in flight. See `engage()`. */
  let pending = false;
  /** QA/diagnostic only — why the last request was refused. Never read by game logic. */
  let lastError = '';

  const root = document.createElement('div');
  root.className = 'plk-root';
  root.innerHTML = `
    <div class="plk-bar" data-el="bar">
      <button class="plk-chip plk-chip--primary" type="button" data-el="capture">🔒 Capture mouse</button>
      <button class="plk-chip" type="button" data-el="fs">⛶ Fullscreen</button>
    </div>
    <div class="plk-toast" data-el="toast">Mouse captured · <b>Esc</b> to release</div>
    <div class="plk-scrim" data-el="scrim">
      <div class="plk-card" data-el="card">
        <div class="plk-card-title">Paused</div>
        <div class="plk-card-sub">The mouse was released, so the match is frozen.</div>
        <button class="plk-btn plk-btn--primary" type="button" data-el="resume">▶ Click to resume</button>
        <div class="plk-card-row">
          <button class="plk-btn plk-btn--quiet" type="button" data-el="fs2">⛶ Fullscreen</button>
          <button class="plk-btn plk-btn--quiet" type="button" data-el="free">Play without capture</button>
        </div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(`[data-el="${sel}"]`)!;
  const fsChip = q<HTMLButtonElement>('fs');
  const fsChip2 = q<HTMLButtonElement>('fs2');

  function isLocked(): boolean {
    return simulated ? simLocked : document.pointerLockElement === target;
  }

  /** QA-only mirror of the state machine, in the same spirit as `__vfxDebugScreen`.
   * A probe cannot reach this closure any other way, and "the lock silently refused"
   * is otherwise indistinguishable from "the lock was never asked for". */
  function publishDebug(): void {
    (window as unknown as { __plockDebug?: unknown }).__plockDebug = {
      state, wantsLock, locked: isLocked(), pending, lastError, available,
    };
  }

  function render(): void {
    root.classList.toggle('is-prompt', state === 'prompt');
    root.classList.toggle('is-toast', state === 'toast');
    root.classList.toggle('is-lost', state === 'lost');
    publishDebug();
  }

  function setState(next: UiState): void {
    if (state === next) return;
    state = next;
    window.clearTimeout(toastTimer);
    if (next === 'toast') {
      toastTimer = window.setTimeout(() => {
        if (!disposed && state === 'toast') setState('hidden');
      }, TOAST_MS);
    }
    render();
  }

  // ── Fullscreen (complementary, never forced) ───────────────────────────────
  function syncFullscreenGlyph(): void {
    const on = !!document.fullscreenElement;
    const label = on ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
    fsChip.textContent = label;
    fsChip2.textContent = label;
  }

  function toggleFullscreen(): void {
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.()?.catch(() => {});
      } else {
        void document.documentElement.requestFullscreen?.()?.catch(() => {});
      }
    } catch {
      /* Refused (iframe policy, no gesture, unsupported). Never fatal. */
    }
  }

  // ── Lock acquisition ───────────────────────────────────────────────────────
  /** The lock was asked for and refused. The match must NOT run uncaptured while the
   * player believes it is captured, so fall back to the paused resume scrim. */
  function onRequestFailed(reason?: unknown): void {
    lastError = reason === undefined ? 'refused' : String((reason as Error)?.message ?? reason);
    publishDebug();
    if (disposed || !wantsLock || isLocked()) return;
    opts.pause();
    setState('lost');
  }

  function engage(): void {
    if (disposed || !available || !wantsLock || isLocked() || pending) return;
    if (simulated) {
      simLocked = true;
      onLockChange();
      return;
    }
    // A request is asynchronous, so a SECOND one fired before the first resolves is
    // rejected by Chrome — and the rejection handler below would then pause a match
    // that is about to be captured perfectly well. Cost: one baffling probe run where
    // the lock never engaged in any browser, headless or headed.
    pending = true;
    try {
      // Chrome returns a Promise; older/other engines return undefined. Both are
      // handled, and neither is allowed to surface an unhandled rejection.
      const r = (target as Element).requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.then === 'function') {
        r.then(() => { pending = false; }, (err) => { pending = false; onRequestFailed(err); });
      } else {
        // No promise to settle on — `pointerlockchange`/`pointerlockerror` are the
        // only signals, and both clear the flag.
        window.setTimeout(() => { pending = false; }, 0);
      }
    } catch (err) {
      pending = false;
      onRequestFailed(err);
    }
  }

  function release(): void {
    if (!isLocked()) return;
    releasing = true;
    if (simulated) {
      simLocked = false;
      onLockChange();
      return;
    }
    try {
      document.exitPointerLock();
    } catch {
      releasing = false;
    }
  }

  /** Every "I want the mouse captured" affordance funnels through here, always from a
   * real click so the request carries transient activation. */
  function requestFromGesture(): void {
    wantsLock = true;
    // `resume()` calls back into `engage()` — still inside this click's call stack, so
    // the activation is intact. Deliberately NOT followed by a second `engage()`: two
    // overlapping requests are refused (see `engage()`).
    opts.resume();
  }

  function playWithoutCapture(): void {
    wantsLock = false;
    release();
    setState('prompt');
    opts.resume();
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  const onLockChange = (): void => {
    if (disposed) return;
    const locked = isLocked();
    opts.onLockChange(locked);

    pending = false;
    if (locked) {
      wantsLock = true;
      releasing = false;
      setState('toast');
      return;
    }

    if (releasing) {
      releasing = false;
      setState(matchActive && available ? 'prompt' : 'hidden');
      return;
    }

    // Unexpected loss: Esc, alt-tab, window blur, tab switch. The player has no
    // control, so the match must not keep running.
    if (wantsLock) {
      opts.pause();
      setState('lost');
    } else {
      setState(matchActive && available ? 'prompt' : 'hidden');
    }
  };

  const onLockError = (): void => {
    pending = false;
    if (disposed) return;
    onRequestFailed('pointerlockerror');
  };

  // Belt and braces. `pointerlockchange` already fires on blur in every engine we
  // support, but a match left running because one engine did not is a lost fight.
  const onBlur = (): void => {
    if (disposed || !wantsLock || !available) return;
    if (isLocked()) return;
    if (state !== 'lost') {
      opts.pause();
      setState('lost');
    }
  };

  const onFullscreenChange = (): void => syncFullscreenGlyph();

  /**
   * SIMULATED mode only. A real browser exits the lock on Escape and CONSUMES the
   * keydown (it never reaches the page, which is why the screen layer's own
   * "Escape toggles pause" handler does not fire while captured). This reproduces
   * both halves so the probe measures what a player would actually get.
   */
  const onSimEscape = (evt: KeyboardEvent): void => {
    if (disposed || !simLocked || evt.key !== 'Escape') return;
    evt.preventDefault();
    evt.stopImmediatePropagation();
    simLocked = false;
    onLockChange();
  };

  if (available) {
    ensureStyles();
    document.body.appendChild(root);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onBlur);
    if (simulated) window.addEventListener('keydown', onSimEscape, true);

    q('capture').addEventListener('click', (e) => { e.stopPropagation(); requestFromGesture(); });
    q('resume').addEventListener('click', (e) => { e.stopPropagation(); requestFromGesture(); });
    // Clicking the frozen frame anywhere resumes — the largest possible target for the
    // one action the player wants at that moment.
    q('scrim').addEventListener('click', () => requestFromGesture());
    q('free').addEventListener('click', (e) => { e.stopPropagation(); playWithoutCapture(); });
    fsChip.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
    fsChip2.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });

    syncFullscreenGlyph();
    setState('prompt');
    render();
  }

  return {
    available,
    get locked() { return available && isLocked(); },
    engage,
    release,
    setMatchActive(active: boolean): void {
      if (!available || matchActive === active) return;
      matchActive = active;
      if (!active) {
        // The game-over card owns the screen now, and its Play Again button needs a
        // real cursor. `wantsLock` is left alone so a restart re-captures.
        release();
        setState('hidden');
      } else if (!isLocked()) {
        setState('prompt');
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      window.clearTimeout(toastTimer);
      if (!available) return;
      release();
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onSimEscape, true);
      root.remove();
    },
  };
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
//
// z-index 30 sits between the HUD (20) and the screen layer (40) — see the layer
// stack in index.html. That is deliberate on both sides: the resume scrim must cover
// the HUD, and matchScreen's own pause sheet and pause chip must stay above it, so
// the two pause affordances can never trap each other.
//
// `.plk-root` is `pointer-events: none` for the same LOAD-BEARING reason `.hud-root`
// and `#screens` are: a full-viewport layer with the default `auto` becomes the hit
// target for every pointer event in the frame and silently starves the canvas of
// firing and aim-facing at once. Only the real controls opt back in — and the resume
// scrim, which only exists while the match is already frozen.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.plk-root {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  font-family: 'Heebo', sans-serif;
  color: #FFF3DE;
  user-select: none;
}

/* ── Capture chip ─────────────────────────────────────────────────────────── */
/* Bottom-centre, ABOVE the weapon bar. Every other edge of the frame is spoken for
   (nameplates top-left/right, clock top-centre, weapon bar bottom-centre, radar
   bottom-right, pause chip bottom-left), and this band is also clear of the ±60px
   around frame centre that the input regression probe drives real mouse events
   through — an overlay there would re-break exactly the bug the screens work fixed. */
.plk-bar {
  position: absolute;
  left: 50%;
  bottom: calc(var(--fa-safe-b, 0px) + 104px);
  transform: translateX(-50%);
  display: none;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}
.plk-root.is-prompt .plk-bar { display: flex; }

.plk-chip {
  appearance: none;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 12px;
  letter-spacing: 0.03em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.82);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 7px 14px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s, filter 0.12s;
  white-space: nowrap;
}
.plk-chip:hover { background: rgba(58,40,80,0.92); }
.plk-chip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.plk-chip--primary {
  color: #1a1224;
  background: #F4A300;
  box-shadow: 0 3px 0 #8a5c00;
  /* A slow breathe rather than a hard flash: this is an offer, not an alarm. */
  animation: plk-breathe 2.4s ease-in-out infinite;
}
.plk-chip--primary:hover { background: #FFB92B; }
@keyframes plk-breathe {
  0%, 100% { box-shadow: 0 3px 0 #8a5c00, 0 0 0 rgba(244,163,0,0); }
  50% { box-shadow: 0 3px 0 #8a5c00, 0 0 14px 2px rgba(244,163,0,0.75); }
}

/* ── "Captured" confirmation ──────────────────────────────────────────────── */
/* Transient on purpose. It says the one thing the player needs at that instant —
   how to get back out — and then leaves the frame clean. */
.plk-toast {
  position: absolute;
  left: 50%;
  bottom: calc(var(--fa-safe-b, 0px) + 104px);
  transform: translateX(-50%);
  display: none;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(26,18,36,0.78);
  border: 2px solid #1a1224;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
}
.plk-toast b { font-family: 'Rubik', sans-serif; font-weight: 900; color: #F4A300; }
.plk-root.is-toast .plk-toast { display: block; animation: plk-toast-out 2.6s ease-in forwards; }
@keyframes plk-toast-out {
  0%, 62% { opacity: 1; }
  100% { opacity: 0; }
}

/* ── Resume scrim ─────────────────────────────────────────────────────────── */
/* Only ever present while the match is ALREADY frozen, which is why it is allowed to
   claim pointer events across the whole viewport. */
.plk-scrim {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.62);
  backdrop-filter: blur(2px);
  cursor: pointer;
  pointer-events: auto;
}
.plk-root.is-lost .plk-scrim { display: flex; }
.plk-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 26px 38px;
  text-align: center;
  background: rgba(26,18,36,0.95);
  border: 4px solid #1a1224;
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
  animation: plk-card-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes plk-card-in {
  from { opacity: 0; transform: scale(0.94) translateY(10px); }
  to { opacity: 1; transform: none; }
}
.plk-card-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3vh, 1.7rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
}
.plk-card-sub { font-size: 12px; color: #C9B8DE; margin-top: -4px; }
.plk-card-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }

.plk-btn {
  appearance: none;
  cursor: pointer;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.03em;
  color: #FFF3DE;
  background: rgba(58,40,80,0.9);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 9px 18px;
  min-height: 40px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.plk-btn:hover { filter: brightness(1.12); }
.plk-btn:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }
.plk-btn--primary {
  color: #1a1224;
  background: #F4A300;
  font-size: 16px;
  padding: 12px 28px;
  min-height: 46px;
  box-shadow: 0 4px 0 #8a5c00;
}
.plk-btn--quiet { font-size: 11px; padding: 7px 14px; min-height: 34px; background: rgba(58,40,80,0.7); }

@media (max-width: 720px) {
  .plk-bar, .plk-toast { bottom: calc(var(--fa-safe-b, 0px) + 86px); }
  .plk-chip { font-size: 11px; padding: 6px 11px; }
}
`;
