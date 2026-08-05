/**
 * Twin-stick TOUCH input for the live match — the mobile-landscape half of
 * `src/game/input.ts`.
 *
 * Mobile landscape is a shipping target of this project (see `LAUNCH_PLAN.md`):
 * viewport fairness guarantees an identical 199.2 wu view radius on every aspect, the
 * safe-area insets are wired, the weapon-range table was rebalanced partly for it — and
 * until this module existed nothing in the game read a finger, so a phone could not
 * play at all.
 *
 * ── The control model, and why ──────────────────────────────────────────────
 * Two FLOATING sticks, the Brawl Stars / Zooba idiom: left half of the screen moves,
 * right half aims and fires. Floating, not fixed pads, because a fixed pad on a phone
 * is a mis-hit generator — the thumb has to find an invisible target before the first
 * frame of a fight instead of the pad finding the thumb.
 *
 * The right stick both aims AND fires, rather than being an aim stick beside a separate
 * fire button. `MatchInput.attack` is "one attack attempt this tick, gated by the
 * weapon's own cooldown" (see `state.ts`), which is exactly a held fire button, and it
 * is what a desktop player already gets by holding the left mouse button. A separate
 * button would be a third thing to hit with two thumbs for no new expressive power.
 *
 * ── AIM IS A DIRECTION, so this hands `input.ts` a UNIT VECTOR ──────────────
 * `MatchInput.aim` is a direction from the player, not a target point — `sim.ts`'s
 * `applyAim` normalises the magnitude away entirely. That is what makes a stick a
 * legitimate aiming device here and it is the same reason the desktop pointer-lock
 * cursor is radially clamped into an "aim stick" (`input.ts`'s header).
 *
 * So this module deliberately does NOT invent a second aiming language. It publishes a
 * screen-space unit direction; `InputController` multiplies it by the ONE aim-ring
 * radius it already owns (`aimRadiusPx()`) and republishes it through `aimOffsetPx`,
 * the exact channel pointer lock uses. Downstream — `match.ts`'s NDC -> raycast ->
 * direction-from-player pipeline, and the HUD reticle that draws on top of it — nothing
 * had to learn that touch exists.
 *
 * ── THE LOWER CORNERS ARE RESERVED ─────────────────────────────────────────
 * Thumbs physically occlude the lower corners in landscape; the fair-play work already
 * records that as a HUD constraint. Nothing gameplay-critical may live there, which is
 * why `ui/hud.ts` moves the radar out of the bottom-right in touch mode. The rest stays
 * where it is: the top bar, the clock and the weapon bar are all clear of the arcs.
 *
 * ── Coexistence with mouse + keyboard ──────────────────────────────────────
 * CAPABILITY, never user-agent sniffing. If the device reports no touch points at all
 * this module installs nothing — no listeners, no DOM, no cost — so a mouse-only
 * desktop is bit-for-bit unchanged. On a hybrid (a laptop with a touchscreen) both
 * paths are live at once: touch events drive the sticks, mouse and keyboard keep
 * driving the existing code, and neither disables the other. `InputController` merges
 * them per-axis rather than switching modes.
 *
 * The one thing that must never happen is a full-viewport `pointer-events: auto` layer:
 * that regression previously starved the canvas of firing AND aim-facing at the same
 * time (see `index.html`'s layer-stack comment). So the visual layer here is
 * `pointer-events: none` and claims nothing; every touch is read from window-level
 * listeners and attributed by hit-test TARGET. A touch that lands on a real control
 * (the pause chip, a weapon slot, the Play Again button) targets that control and is
 * ignored here, which is what keeps the two from fighting.
 */

/** A stick's full-deflection travel, as a fraction of the viewport short axis. */
const STICK_FRACTION = 0.15;
const STICK_MIN_PX = 44;
const STICK_MAX_PX = 78;

/** Travel below which a finger is treated as stationary. */
const MOVE_DEADZONE_PX = 5;
/**
 * Aim travel below which the PREVIOUS aim direction is held. A tap with no drag must
 * fire where the player is already facing rather than snapping the fighter to some
 * arbitrary direction, which is what a "quick tap to shoot" is for.
 */
const AIM_DEADZONE_PX = 10;

/** Fraction of the viewport width that belongs to the movement stick. */
const ZONE_SPLIT = 0.5;

const STYLE_ID = 'touch-styles';

export interface TouchVec {
  x: number;
  y: number;
}

export interface TouchControlsOptions {
  /**
   * The WebGL canvas. Used for two things and nothing else: deciding whether a touch
   * belongs to the game surface (the canvas is the hit target for everything that is
   * not a real control, since every overlay layer is `pointer-events: none`), and
   * suppressing the browser's own gesture handling on it.
   */
  canvas: HTMLElement;
}

export interface TouchControls {
  /** False on a device that reports no touch points — nothing is installed at all. */
  readonly available: boolean;
  /** True once a real finger has been seen, i.e. the player is actually playing by touch. */
  readonly engaged: boolean;
  /**
   * Movement axes, each independently in [-1, 1] — the same square-space convention
   * `MatchInput.move` uses for WASD. THE SAME OBJECT every read: this is polled once a
   * frame from the game loop and mobile GC pressure is already tight, so it is mutated
   * in place rather than reallocated. Callers must not retain it.
   */
  readonly move: Readonly<TouchVec>;
  /** True while a finger owns the movement stick. */
  readonly moving: boolean;
  /**
   * Screen-space UNIT aim direction, or null until the player has aimed at least once.
   * Also the same object every read, for the same reason. `+y` is screen-DOWN, matching
   * both DOM coordinates and `moveAxes()`'s convention.
   */
  aimDir(): Readonly<TouchVec> | null;
  /** True while the fire finger is down. */
  readonly firing: boolean;
  /**
   * Hand the aim back to the mouse.
   *
   * Called when a real mouse moves (see `input.ts`). Without it a hybrid device — a
   * laptop with a touchscreen — is one stray tap away from an aim the mouse can never
   * take back: the touch direction persists after the finger lifts (deliberately, so
   * facing survives a release) and `aimOffsetPx` prefers it, so the pointer would keep
   * moving with nothing on screen following it. Ignored while a finger is actually on
   * the aim stick, so the two can never fight mid-drag.
   */
  clearAim(): void;
  /** Drop all stick state — call on match restart, blur, or pause. */
  reset(): void;
  dispose(): void;
}

/**
 * Capability test, deliberately not a user-agent test: a laptop with a touchscreen must
 * still work with its mouse, and a desktop that grows a tablet must start working with
 * one. `maxTouchPoints` is the modern signal; `ontouchstart` covers older WebKit.
 */
export function isTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0) return true;
  return 'ontouchstart' in window;
}

/**
 * True when the device's PRIMARY pointer is coarse — a phone or a tablet, as opposed to
 * a touchscreen laptop whose main pointer is still a trackpad. Only used to decide
 * whether to draw the resting-position hints: a mouse user should not have two ghost
 * rings on screen, while a phone player has nothing else to tell them the game has
 * controls at all.
 */
function isPrimaryCoarse(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function stickRadiusPx(): number {
  const short = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(STICK_MIN_PX, Math.min(STICK_MAX_PX, short * STICK_FRACTION));
}

/**
 * Project a stick deflection from the unit DISC onto the unit SQUARE, preserving
 * direction and proportional magnitude.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `MatchInput.move` is deliberately NOT a normalised vector (see `state.ts`): each axis
 * scales independently, so holding two keys moves diagonally at ~1.41x a single
 * cardinal press. A raw unit-disc stick tops out at magnitude 1.0 on the diagonal,
 * which would make a touch player 29% slower than a desktop player in four of eight
 * directions — a competitive fairness bug in a game whose camera was rebuilt precisely
 * so no device sees more of the arena than another, not a matter of feel.
 *
 * Full deflection therefore lands on the square's boundary in every direction, matching
 * a full key press exactly, and partial deflection stays proportional to how far the
 * thumb has pushed.
 *
 * Exported as a pure function so it can be asserted without a browser — the in-page
 * version of this measurement is frame-rate bound and cannot separate a 40% effect from
 * a software renderer's jitter.
 */
export function squareDeflection(nx: number, ny: number, out: TouchVec): TouchVec {
  const m = Math.max(Math.abs(nx), Math.abs(ny));
  const k = m > 1e-6 ? Math.min(1, Math.hypot(nx, ny)) / m : 0;
  out.x = Math.max(-1, Math.min(1, nx * k));
  out.y = Math.max(-1, Math.min(1, ny * k));
  return out;
}

interface StickState {
  /** `Touch.identifier` of the finger that owns this stick, or null. */
  id: number | null;
  /** Where the stick was planted, in CSS px. Moves with the finger at the rim. */
  baseX: number;
  baseY: number;
  /** Current finger position. */
  curX: number;
  curY: number;
}

function newStick(): StickState {
  return { id: null, baseX: 0, baseY: 0, curX: 0, curY: 0 };
}

export function createTouchControls(opts: TouchControlsOptions): TouchControls {
  const available = isTouchCapable();

  const moveStick = newStick();
  const aimStick = newStick();

  /** Mutated in place — see `TouchControls.move`. */
  const move: TouchVec = { x: 0, y: 0 };
  const aim: TouchVec = { x: 0, y: -1 };
  let hasAim = false;
  let engaged = false;

  let disposed = false;
  let pump = 0;
  /** Last values actually written to the DOM, so a stationary thumb writes nothing. */
  let lastMoveKey = '';
  let lastAimKey = '';

  if (!available) {
    // Nothing installed. A mouse-only machine must be indistinguishable from before
    // this module existed — no listeners, no DOM node, no per-frame work.
    return {
      available: false,
      get engaged() { return false; },
      move,
      get moving() { return false; },
      aimDir: () => null,
      get firing() { return false; },
      clearAim() { /* never aimed */ },
      reset() { /* nothing to reset */ },
      dispose() { /* nothing to dispose */ },
    };
  }

  ensureStyles();

  const root = document.createElement('div');
  root.className = 'tch-root';
  root.innerHTML =
    '<div class="tch-stick tch-stick--move" data-el="move-stick">' +
      '<div class="tch-knob"></div>' +
    '</div>' +
    '<div class="tch-stick tch-stick--aim" data-el="aim-stick">' +
      '<div class="tch-knob"></div>' +
    '</div>' +
    '<div class="tch-hint tch-hint--move" data-el="move-hint">' +
      '<div class="tch-hint-ring"></div><div class="tch-hint-label">MOVE</div>' +
    '</div>' +
    '<div class="tch-hint tch-hint--aim" data-el="aim-hint">' +
      '<div class="tch-hint-ring"></div><div class="tch-hint-label">AIM &amp; FIRE</div>' +
    '</div>';
  document.body.appendChild(root);

  const q = (name: string): HTMLElement => root.querySelector<HTMLElement>('[data-el="' + name + '"]')!;
  const moveEl = q('move-stick');
  const aimEl = q('aim-stick');
  const moveHint = q('move-hint');
  const aimHint = q('aim-hint');

  /**
   * TWO flags, deliberately, because they answer different questions.
   *
   * `fa-touch-capable` (here, at construction, phones and tablets only) is about
   * LAYOUT: on a device whose primary pointer is a thumb, the lower corners are
   * occluded whether or not a finger has landed yet, so the radar has to move on the
   * FIRST frame. Gating that on the first touch instead was tried and shows the opening
   * frame with the radar sitting under the aim hint.
   *
   * `fa-touch` (below, on the first real finger) is about INTERACTION: it is what lets
   * the HUD's weapon slots claim pointer events, and it must not be set on a machine
   * where the player is using a mouse, or the bar would start eating fire clicks.
   */
  const coarse = isPrimaryCoarse();
  if (coarse) {
    root.classList.add('is-hinted');
    document.documentElement.classList.add('fa-touch-capable');
  }

  // The browser's own gestures on the game surface are all wrong for a twin-stick:
  // panning scrolls nothing, double-tap zooms the canvas, and long-press pops a
  // selection callout mid-fight. `touch-action: none` is the one that actually stops
  // the compositor from claiming the gesture before JS sees it.
  //
  // Applied to the canvas AND to the element holding it, for the same reason
  // `ownsTarget` accepts both: on a letterboxed viewport most of the game surface a
  // thumb can reach is not the canvas.
  const surface = opts.canvas.parentElement;
  const prevTouchAction = opts.canvas.style.touchAction;
  const prevSurfaceTouchAction = surface ? surface.style.touchAction : '';
  opts.canvas.style.touchAction = 'none';
  if (surface) surface.style.touchAction = 'none';

  /**
   * Is this touch on the game surface, or on a real control that owns it?
   *
   * Three things count as the game surface, and the third is the one a portrait phone
   * lives or dies on:
   *   * the canvas itself,
   *   * anything inside it,
   *   * an element that CONTAINS the canvas — `#game`, `body`, `html`. Every overlay
   *     layer in this app is `pointer-events: none` by construction (see
   *     `index.html`'s layer stack), so an ancestor of the canvas being the topmost
   *     hit-test target means nothing was painted over that point at all. That is
   *     bare game surface by any reading.
   *
   * ── Why the third case is not a nicety ─────────────────────────────────────
   * `stage.ts` LETTERBOXES any viewport outside `SUPPORTED_ASPECT`, which is what buys
   * the 0.00 wu viewport-fairness guarantee. At 390x844 — an ordinary phone held
   * upright — the canvas is 390x293 inside an 844 px viewport. Measured
   * (`tools/tmp/touchfeel.mjs --mode hitmap`): **83.3% of the bottom 38% of the frame,
   * i.e. the entire thumb band and BOTH resting-position hints, hit-tests to `#game`
   * rather than to the canvas.** Under a canvas-only rule every one of those touches
   * was discarded, so a portrait player was shown two rings labelled MOVE and
   * AIM & FIRE over dead pixels and neither of them did anything at all — a full-
   * deflection drag from the move hint's own centre reached the sim as `moveX = 0.000`.
   *
   * This changes NOTHING about viewport fairness: the letterbox is inert black owned by
   * the game, `aspect.mjs` measures the camera's ground window and this cannot reach it,
   * and `DECISIONS §14` (how hard to letterbox portrait, or whether to prompt a
   * rotation instead) is untouched and still Uri's. It cannot steal a control either —
   * a control over the point IS the hit-test target, and a control fails all three
   * cases.
   */
  function ownsTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    const c = opts.canvas;
    return target === c || c.contains(target) || target.contains(c);
  }

  function radius(): number {
    return stickRadiusPx();
  }

  /**
   * Recompute a stick's normalised deflection, moving the base to follow the finger
   * once it is past the rim.
   *
   * The base-follow is the difference between a stick that feels like a stick and one
   * that feels like it is stuck: without it, a thumb that has over-travelled has to be
   * dragged all the way back inside the ring before the direction starts changing, so
   * a reversal costs an unpredictable amount of travel. With it, the stick is always
   * exactly at its rim in the direction the thumb is pushing, and reversal is always
   * the same 2R — the same property the desktop aim stick's hard clamp buys.
   */
  function deflection(s: StickState, out: TouchVec): number {
    const r = radius();
    let dx = s.curX - s.baseX;
    let dy = s.curY - s.baseY;
    const len = Math.hypot(dx, dy);
    if (len > r) {
      const k = r / len;
      s.baseX = s.curX - dx * k;
      s.baseY = s.curY - dy * k;
      dx *= k;
      dy *= k;
    }
    const mag = Math.hypot(dx, dy);
    out.x = dx;
    out.y = dy;
    return mag;
  }

  const scratch: TouchVec = { x: 0, y: 0 };

  /**
   * Identifiers of touches that landed on the game surface and found their zone
   * already occupied, in arrival order. Newest is adopted first.
   *
   * ── The defect this exists to close ────────────────────────────────────────
   * Measured on HEAD with real CDP touch events (`touchfeel.mjs --mode interrupt`):
   * with a finger owning the movement stick and a second finger down in the same zone,
   * lifting the OWNER correctly released the stick — and then dragging the surviving
   * finger to full deflection reached the sim as **(0.000, 0.000)**. The player has a
   * thumb on the glass, in the movement zone, pushed all the way out, and the fighter
   * does not move until they lift it and put it back down. On the aim stick the same
   * path stops firing.
   *
   * It is not a contrived two-hands case. Re-planting a thumb is a ROLL, not a hop:
   * the new contact routinely registers before the old one lifts, and every one of
   * those re-plants died silently.
   *
   * The adopted finger re-bases the stick AT ITS CURRENT POSITION rather than
   * inheriting the released base. Inheriting would fling the fighter to full
   * deflection in whatever direction the spare finger happened to be sitting — a
   * lurch, from an input the player did not make. Re-basing means movement passes
   * through zero and the thumb pushes again from where it already is, which is what
   * a floating stick does everywhere else in this module.
   */
  const spare: number[] = [];

  function forgetSpare(id: number): void {
    const i = spare.indexOf(id);
    if (i >= 0) spare.splice(i, 1);
  }

  function findLive(list: TouchList, id: number): Touch | null {
    for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }

  /** Hand a just-released stick to a finger that is still down in its zone. */
  function adopt(stick: StickState, leftZone: boolean, live: TouchList): void {
    for (let i = spare.length - 1; i >= 0; i--) {
      const t = findLive(live, spare[i]);
      // A spare that is no longer in `touches` has already gone; drop it either way.
      if (!t) { spare.splice(i, 1); continue; }
      if ((t.clientX < window.innerWidth * ZONE_SPLIT) !== leftZone) continue;
      spare.splice(i, 1);
      stick.id = t.identifier;
      stick.baseX = t.clientX;
      stick.baseY = t.clientY;
      stick.curX = t.clientX;
      stick.curY = t.clientY;
      return;
    }
  }

  function updateMove(): void {
    if (moveStick.id === null) {
      move.x = 0;
      move.y = 0;
      return;
    }
    const mag = deflection(moveStick, scratch);
    if (mag < MOVE_DEADZONE_PX) {
      move.x = 0;
      move.y = 0;
      return;
    }
    const r = radius();
    // Disc -> square, so a diagonal push is worth as much as W+D. See `squareDeflection`.
    squareDeflection(scratch.x / r, scratch.y / r, move);
  }

  function updateAim(): void {
    if (aimStick.id === null) return;
    const mag = deflection(aimStick, scratch);
    // Below the dead zone the previous direction is HELD, never zeroed: a zero-length
    // aim is dropped by `applyAim`, and snapping to a default direction on every tap
    // would make a quick shot fire somewhere the player never pointed.
    if (mag < AIM_DEADZONE_PX) return;
    aim.x = scratch.x / mag;
    aim.y = scratch.y / mag;
    hasAim = true;
  }

  // ── Visuals ───────────────────────────────────────────────────────────────
  // Driven from a rAF pump that only runs while a finger is down, not from the touch
  // events themselves: a dragging thumb emits 60-120 events/s and each style write
  // allocates a string. One write per frame per stick, skipped entirely when the value
  // has not changed, keeps this within the same order as the HUD's existing per-frame
  // transforms rather than adding a new allocation source.
  function paintStick(el: HTMLElement, s: StickState, lastKey: string): string {
    if (s.id === null) {
      if (lastKey !== '') el.style.display = 'none';
      return '';
    }
    const dx = s.curX - s.baseX;
    const dy = s.curY - s.baseY;
    const r = radius();
    const len = Math.hypot(dx, dy);
    const k = len > r ? r / len : 1;
    const bx = Math.round(s.baseX);
    const by = Math.round(s.baseY);
    const kx = Math.round(s.baseX + dx * k);
    const ky = Math.round(s.baseY + dy * k);
    const key = bx + ',' + by + ',' + kx + ',' + ky + ',' + Math.round(r);
    if (key === lastKey) return key;
    if (lastKey === '') el.style.display = 'block';
    el.style.setProperty('--r', r.toFixed(0) + 'px');
    el.style.transform = 'translate(' + bx + 'px,' + by + 'px) translate(-50%,-50%)';
    const knob = el.firstElementChild as HTMLElement | null;
    if (knob) {
      knob.style.transform =
        'translate(' + (kx - bx) + 'px,' + (ky - by) + 'px) translate(-50%,-50%)';
    }
    return key;
  }

  function paint(): void {
    lastMoveKey = paintStick(moveEl, moveStick, lastMoveKey);
    lastAimKey = paintStick(aimEl, aimStick, lastAimKey);
    if (moveStick.id === null && aimStick.id === null) {
      pump = 0;
      return;
    }
    pump = requestAnimationFrame(paint);
  }

  function kick(): void {
    if (!pump && !disposed) pump = requestAnimationFrame(paint);
  }

  // ── Events ────────────────────────────────────────────────────────────────
  const onTouchStart = (ev: TouchEvent): void => {
    if (disposed) return;
    let claimed = false;
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches[i];
      // A touch that landed on a real control belongs to that control. This is the
      // whole coexistence rule in one line — no zone can steal a button, and no button
      // needs to know the sticks exist.
      if (!ownsTarget(t.target)) continue;

      const leftZone = t.clientX < window.innerWidth * ZONE_SPLIT;
      const stick = leftZone ? moveStick : aimStick;
      if (stick.id !== null) {
        // That stick already has a finger. Bank this one: if the owner lifts while
        // this is still down, the stick is handed over instead of dying. Claimed for
        // `preventDefault` purposes too — it is on the game surface, so the browser
        // must not be allowed to turn it into a scroll or a compatibility click.
        if (!spare.includes(t.identifier)) spare.push(t.identifier);
        claimed = true;
        continue;
      }

      stick.id = t.identifier;
      stick.baseX = t.clientX;
      stick.baseY = t.clientY;
      stick.curX = t.clientX;
      stick.curY = t.clientY;
      claimed = true;

      if (leftZone) moveHint.classList.add('is-used');
      else aimHint.classList.add('is-used');
    }
    if (!claimed) return;

    if (!engaged) {
      engaged = true;
      // Published as a capability flag rather than a callback so the HUD (and anything
      // else that wants it later) can style itself off a single global fact without a
      // wiring chain. Set only once a REAL finger has been seen, which is what keeps a
      // touchscreen laptop's weapon bar from claiming mouse clicks in a session where
      // the player never touched the screen.
      document.documentElement.classList.add('fa-touch');
    }
    updateMove();
    updateAim();
    kick();
    // Only for touches we took. A tap on the pause chip keeps its synthesised click.
    ev.preventDefault();
  };

  const onTouchMove = (ev: TouchEvent): void => {
    if (disposed) return;
    let mine = false;
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches[i];
      if (t.identifier === moveStick.id) {
        moveStick.curX = t.clientX;
        moveStick.curY = t.clientY;
        mine = true;
      } else if (t.identifier === aimStick.id) {
        aimStick.curX = t.clientX;
        aimStick.curY = t.clientY;
        mine = true;
      } else if (spare.includes(t.identifier)) {
        // A banked finger. It drives nothing yet, but it is ours, so the browser does
        // not get to reinterpret its drag as a gesture.
        mine = true;
      }
    }
    if (!mine) return;
    updateMove();
    updateAim();
    kick();
    ev.preventDefault();
  };

  /**
   * `touchend` AND `touchcancel`. The second is not a rare path on a phone — it is
   * what fires when an incoming call, a notification shade, a system gesture or a
   * palm rejection interrupts a touch — and a stick left held through one runs the
   * fighter into a wall with no finger on the screen.
   */
  const onTouchEnd = (ev: TouchEvent): void => {
    if (disposed) return;
    let mine = false;
    for (let i = 0; i < ev.changedTouches.length; i++) {
      const t = ev.changedTouches[i];
      if (t.identifier === moveStick.id) {
        moveStick.id = null;
        adopt(moveStick, true, ev.touches);
        mine = true;
      } else if (t.identifier === aimStick.id) {
        // Aim DIRECTION deliberately survives the lift — the fighter keeps facing where
        // it was pointed, exactly as a desktop player's facing survives releasing the
        // mouse button. Only firing stops.
        aimStick.id = null;
        adopt(aimStick, false, ev.touches);
        mine = true;
      } else if (spare.includes(t.identifier)) {
        forgetSpare(t.identifier);
        mine = true;
      }
    }
    if (!mine) return;
    updateMove();
    updateAim();
    kick();
  };

  window.addEventListener('touchstart', onTouchStart, { passive: false });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);

  return {
    available: true,
    get engaged() { return engaged; },
    move,
    get moving() { return moveStick.id !== null; },
    aimDir: () => (hasAim ? aim : null),
    get firing() { return aimStick.id !== null; },

    clearAim(): void {
      if (aimStick.id === null) hasAim = false;
    },

    reset(): void {
      moveStick.id = null;
      aimStick.id = null;
      // Banked fingers go too. `reset()` means "the player is not in control any
      // more" (restart, blur, backgrounded), and re-arming a stick from a finger that
      // was down before that happened is exactly the stale state it exists to clear.
      spare.length = 0;
      move.x = 0;
      move.y = 0;
      hasAim = false;
      kick();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(pump);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      spare.length = 0;
      opts.canvas.style.touchAction = prevTouchAction;
      if (surface) surface.style.touchAction = prevSurfaceTouchAction;
      // Both flags are match-scoped. A stale `fa-touch` would leave the next match's
      // weapon bar claiming pointer events before anyone has touched it.
      document.documentElement.classList.remove('fa-touch', 'fa-touch-capable');
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
// z-index 25 sits between the HUD (20) and pointer lock (30) / the screen layer (40):
// a stick under the player's thumb must paint over the radar and the weapon bar, and
// the pause sheet and the game-over card must paint over IT.
//
// `.tch-root` is pointer-events: none and NOTHING inside it ever opts back in. It is
// pure feedback — every touch is read from window listeners and attributed by hit-test
// target — so it cannot become the hit target that starves the canvas. That failure has
// already shipped once from a full-viewport layer defaulting to `auto`, and it took
// firing and aim-facing down together.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.tch-root {
  position: fixed;
  inset: 0;
  z-index: 25;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}

/* ── The sticks ───────────────────────────────────────────────────────────── */
/* Planted where the thumb lands, so there is no target to find. The ring is the
   travel limit, drawn at the same radius the input math clamps to, which is what
   makes the deflection readable as a stick rather than as a smear. */
.tch-stick {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: calc(var(--r, 60px) * 2);
  height: calc(var(--r, 60px) * 2);
  border-radius: 50%;
  will-change: transform;
  background: rgba(26,18,36,0.34);
  border: 3px solid rgba(255,243,222,0.5);
  box-shadow: 0 0 0 2px rgba(26,18,36,0.45);
}

.tch-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 52px;
  height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  will-change: transform;
  background: #FFF3DE;
  border: 3px solid #1a1224;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}

/* Gold for the fire stick — the weapon accent this HUD already uses for readiness and
   for the muzzle cone. Cream for movement. The two thumbs then never have to be told
   apart by position alone. */
.tch-stick--aim .tch-knob { background: #F4A300; }
.tch-stick--aim { border-color: rgba(244,163,0,0.62); }

/* ── Resting-position hints ───────────────────────────────────────────────── */
/* Shown only on a device whose PRIMARY pointer is coarse, and only until that stick
   has been used once. Floating sticks work anywhere in their half, so this is a hint
   about where a thumb usually rests, NOT a pad: it never claims a touch, and it is
   gone for good after the first one. */
.tch-hint {
  position: absolute;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.42;
  transition: opacity 0.25s ease-out;
  animation: tch-hint-breathe 2.8s ease-in-out infinite;
}
.tch-root.is-hinted .tch-hint { display: flex; }
/* Specificity has to match the rule above, or the hint outlives its own first use. */
.tch-root.is-hinted .tch-hint.is-used { display: none; }
.tch-hint--move {
  left: calc(var(--fa-safe-l, 0px) + 17%);
  bottom: calc(var(--fa-safe-b, 0px) + 22%);
  transform: translate(-50%, 50%);
}
.tch-hint--aim {
  right: calc(var(--fa-safe-r, 0px) + 17%);
  bottom: calc(var(--fa-safe-b, 0px) + 22%);
  transform: translate(50%, 50%);
}
.tch-hint-ring {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 3px dashed rgba(255,243,222,0.85);
  box-shadow: 0 0 0 2px rgba(26,18,36,0.5), inset 0 0 0 2px rgba(26,18,36,0.5);
}
.tch-hint--aim .tch-hint-ring { border-color: rgba(244,163,0,0.9); }
.tch-hint-label {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.82);
  border-radius: 999px;
  padding: 3px 10px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}
@keyframes tch-hint-breathe {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.55; }
}

/* Short landscape phones: keep the hints out of the weapon bar's row. */
@media (max-height: 460px) {
  .tch-hint-ring { width: 76px; height: 76px; }
  .tch-hint { gap: 5px; }
}
`;
