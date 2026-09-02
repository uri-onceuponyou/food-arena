/**
 * Keyboard + mouse input capture for the live match.
 *
 * Purely a DOM listener → raw state accumulator. Turning that raw state into a
 * `MatchInput` (see `state.ts`) happens in `match.ts`, since converting a mouse
 * position into a world-space aim vector requires unprojecting through the active
 * camera, which only the render layer knows about.
 *
 * ── Two cursor models, one aim pipeline ─────────────────────────────────────
 * Free cursor (default, unchanged): `mousemove` gives absolute client coords, which
 * become `mouseNdc` and get raycast onto the ground plane by `match.ts`.
 *
 * Pointer-locked (`src/game/pointerLock.ts`): the browser stops reporting absolute
 * position entirely and hands out `movementX/movementY` DELTAS instead, so a virtual
 * cursor has to be maintained here. It is expressed as an OFFSET IN CSS PIXELS FROM
 * THE AIM ORIGIN (the player's own projected screen position), never as an absolute
 * point — `match.ts` adds the player's screen position back and feeds the result
 * through the exact same NDC → raycast → direction pipeline. Nothing downstream of
 * `mouseNdc` had to learn about pointer lock.
 *
 * ── THE VIRTUAL CURSOR IS AN AIM STICK, NOT A FREE CURSOR ───────────────────
 * The offset is hard-clamped to a DISC of `aimRadiusPx()` around the player rather
 * than to the viewport rectangle. This is the deliberate choice, and the reason is in
 * `state.ts`: `MatchInput.aim` is a DIRECTION from the player, not a target point.
 * `sim.ts` normalises it away, so cursor DISTANCE is information the game does not
 * have and cannot use.
 *
 *   * A free cursor therefore lies. Parked over an enemy 300 wu away it looks like a
 *     lock-on, while the weapon it is aiming reaches 140 wu.
 *   * It is also what makes aiming feel heavy: with the cursor at a screen corner,
 *     reversing your facing means dragging it all the way back across the player. The
 *     travel needed to flip aim depends on where the cursor happens to be sitting.
 *   * The radial clamp fixes both. Aim reversal is always exactly 2R of mouse travel
 *     (~280 px), the reticle can never drift somewhere meaningless, and it reads as
 *     the aim indicator the genre already uses — Brawl Stars aims by direction too.
 *
 * `?aimMode=free` keeps the offset but clamps it to the viewport rectangle instead,
 * so the two models can be compared side by side without a rebuild.
 *
 * ── THIRD BACKEND: TOUCH ────────────────────────────────────────────────────
 * `src/game/touch.ts` adds twin virtual sticks for mobile landscape. It is a BACKEND
 * behind this same interface, not a mode: nothing here switches off when a finger
 * appears, so a laptop with a touchscreen keeps its mouse and its keyboard while the
 * sticks are live. The merge rules are stated at each accessor below, and they are all
 * the same rule — whichever device the player is actually using wins, and neither can
 * silence the other.
 *
 * The aim stick publishes a screen-space UNIT DIRECTION, which is converted to px here
 * (against `aimRadiusPx()`, the one owner of that number) and republished through
 * `aimOffsetPx` — the exact channel pointer lock already uses. So `match.ts` and the
 * HUD reticle never learn that touch exists, and the two aim models cannot drift apart.
 */

import { audio } from '../audio';
import { ITEM_SLOTS } from './rules';
import { createTouchControls, type TouchControls } from './touch';

/** The four axes `moveAxes()` reads. Order inside each list is preference order:
 *  index 0 is the primary binding, everything after it is an alternate. */
export type MoveDirection = 'left' | 'right' | 'up' | 'down';

/**
 * ── THE KEYBOARD MAP, AND IT IS EXPORTED ON PURPOSE ─────────────────────────
 * `ui/screens/settings.ts` draws a Controls reference, and until now it carried a
 * hand-transcribed COPY of this table with a comment saying so. Two copies of one
 * mapping is a defect waiting for the day they disagree — and a settings screen that
 * lies about the controls is worse than one that omits them. So this is the single
 * source of truth and the screen renders off it.
 *
 * Values are `KeyboardEvent.code`, which is what `onKeyDown` stores: a PHYSICAL key
 * position, independent of the layout the OS has loaded, so `KeyW` is the key above
 * `KeyS` on QWERTY and on AZERTY alike. Turning a code into the glyph printed on the
 * cap is a presentation problem and stays in the UI layer — this file has no business
 * knowing that `ArrowLeft` draws as an arrow.
 */
export const MOVE_KEYS: Readonly<Record<MoveDirection, readonly string[]>> = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
};

/** Mute / unmute. See `onKeyDown` — deliberately on the keydown edge, gated on
 *  `repeat`, and the only way out of the audio while the pointer is captured. */
export const MUTE_KEY = 'KeyM';

/**
 * The highest weapon slot a digit key can select.
 *
 * `onKeyDown` reads `Number(e.key)` — the CHARACTER, not the code, because a slot
 * number is one of the few places where what is printed on the key is the thing the
 * player means. No character in `rules.ts` carries more than 4 weapons, and the extra
 * headroom costs nothing; `setWeaponCount()` is what actually bounds it at runtime.
 */
export const MAX_WEAPON_SLOT_KEY = 9;

/**
 * ── ONE KEY PER EQUIP SLOT, AND THE PRESS NAMES ITS OWN SLOT ────────────────
 *
 * `state.ts:FighterInput.useItem` is a SLOT INDEX into `Fighter.item.equipped`, not an
 * `ItemId`, and its header gives the reason: *"an item is two buttons on a phone, so the
 * press names its own slot and there is no separate selection"*. This table is the
 * keyboard half of those two buttons, and it is the ONLY thing in the app that decides
 * which key means which slot — `ui/hud.ts` prints these caps on the buttons themselves
 * rather than carrying its own copy, exactly as `settings.ts` was made to render off
 * `MOVE_KEYS` instead of a hand-transcribed duplicate.
 *
 * ⚠️ **DELIBERATELY NOT A DIGIT ROW.** Digits already select weapon slots (`onKeyDown`
 * reads `Number(e.key)` for `1`-`9`), so an item on `5` would be a control whose meaning
 * depends on how many weapons your character happens to carry — and `MAX_WEAPON_SLOT_KEY`
 * is 9, so there is no digit that is safe forever. `Q`/`E` are the pair either index
 * finger already rests beside on WASD and are free of every other binding in this repo
 * (`MUTE_KEY` is `KeyM`, `matchScreen.ts:PAUSE_KEY` is `Escape`).
 *
 * 🔴 **AND `settings.ts` DOES NOT KNOW ABOUT THEM YET, WHICH IS A REPORTED GAP, NOT A
 * DECISION.** That screen builds `RESERVED_KEYS` from `MUTE_KEY`, `PAUSE_KEY` and the
 * weapon digits, all imported from here, and refuses to bind a movement direction onto
 * any of them. These two are not on that list, so a player who rebinds "up" to `Q` gets a
 * key that moves AND fires an item, and the Controls reference does not mention items at
 * all. The fix is two lines in a file this pass does not own; the export exists so it is
 * one import when somebody takes it.
 */
export const ITEM_KEYS = ['KeyQ', 'KeyE'] as const;

/**
 * A COMPILE-TIME tie between the table above and `rules.ts:ITEM_SLOTS`.
 *
 * `ITEM_SLOTS` is the number of equip slots; `ITEM_KEYS` is one cap per slot. A third
 * slot added in `rules.ts` with no third key here would not be a type error anywhere —
 * it would be a slot with a button on a phone and no key on a desktop, which is exactly
 * the class of silent half-wiring this feature is being built to remove. `never` is what
 * makes the mismatch a `tsc` failure at the line below rather than a missing control
 * somebody notices in a screenshot.
 *
 * Verified by planting the bug rather than by reasoning about it: with `ITEM_SLOTS`
 * temporarily set to 3 in a detached worktree, `npx tsc --noEmit` reports exactly
 * `src/game/input.ts(138,7): error TS2322: Type 'true' is not assignable to type 'never'`
 * — one error, on this line, naming this file. Restored, the tree is clean again.
 */
const ITEM_KEYS_COVER_EVERY_SLOT: typeof ITEM_KEYS['length'] extends typeof ITEM_SLOTS ? true : never = true;
void ITEM_KEYS_COVER_EVERY_SLOT;

/** Aim-ring radius as a fraction of the viewport's short axis, with px bounds. */
const AIM_RADIUS_FRACTION = 0.155;
const AIM_RADIUS_MIN = 84;
const AIM_RADIUS_MAX = 190;

function queryNumber(param: string): number | null {
  const raw = new URLSearchParams(location.search).get(param);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export class InputController {
  private readonly keys = new Set<string>();
  private mouseDown = false;
  private ndcX = 0;
  private ndcY = 0;
  private hasMouse = false;
  private weaponIndex = 0;
  private weaponCount = 1;
  /**
   * ONE PENDING ITEM PRESS, OR NULL — the equip slot named by the last press nobody has
   * collected yet. See `pressItem` / `takeItemPress`.
   */
  private itemPress: number | null = null;

  // ── Virtual cursor (pointer lock only) ──────────────────────────────────────
  private locked = false;
  /** Offset in CSS px from the aim origin. Only meaningful while `locked`. */
  private offX = 0;
  private offY = 0;
  /** Last absolute cursor position, used to seed the virtual cursor on capture so
   * aim does not jump the instant the mouse is taken. */
  private clientX = 0;
  private clientY = 0;

  /** `?aimSens=` — multiplier on raw `movementX/Y`. 1 is 1:1 with the desktop cursor. */
  private readonly sensitivity: number;
  /** `?aimMode=free` clamps to the viewport rect instead of the aim disc. */
  private readonly freeAim: boolean;

  /** Twin virtual sticks. Inert (and installs nothing at all) without touch support. */
  private readonly touch: TouchControls;
  /** Reused for the touch aim offset so polling it every frame allocates nothing. */
  private readonly touchOffset = { x: 0, y: 0 };

  constructor(private readonly canvas: HTMLElement) {
    const sens = queryNumber('aimSens');
    this.sensitivity = sens !== null && sens > 0 ? Math.min(6, sens) : 1;
    this.freeAim = new URLSearchParams(location.search).get('aimMode') === 'free';
    this.touch = createTouchControls({ canvas });

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Call once the player's character is known, so digit keys only select real slots. */
  setWeaponCount(n: number): void {
    this.weaponCount = Math.max(1, n);
    if (this.weaponIndex >= this.weaponCount) this.weaponIndex = 0;
  }

  get selectedWeapon(): number {
    return this.weaponIndex;
  }

  /**
   * Pick a weapon slot directly. Exists for the HUD's weapon bar, which is the touch
   * equivalent of the `1`-`4` keys — there is no keyboard on a phone, and a weapon you
   * cannot select is a weapon you do not have.
   */
  selectWeapon(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.weaponCount) return;
    this.weaponIndex = index;
  }

  /** True once the player has actually used touch. QA/diagnostics only. */
  get touchEngaged(): boolean {
    return this.touch.engaged;
  }

  /**
   * ── PRESS THE ITEM IN EQUIP SLOT `index` ────────────────────────────────────
   *
   * The one entry point for BOTH item controls, exactly as `selectWeapon` is the one
   * entry point for the weapon bar and the digit keys: `onKeyDown` calls it for
   * `ITEM_KEYS`, and `ui/hud.ts`'s item buttons call it through the `onUseItem` callback
   * the way the weapon slots already call `selectWeapon` through `onSelectWeapon`. A
   * second path would be a second place for a press to be dropped.
   *
   * ⚠️ **THIS DOES NOT ASK WHETHER THE ITEM IS USABLE, AND MUST NOT.** `combat.ts`
   * `itemUsable` is the gate, and `attemptItem` is defined as *"if `itemUsable`, spend
   * it"*; that file's own header says a control that greys itself out on a COPY of the
   * rule is a control that will one day disagree with the sim. The HUD reads the real
   * predicate to decide what to DRAW; this layer only reports that a finger went down.
   * Bounds are the exception — an out-of-range slot is not a refused press, it is a
   * caller bug, and `sim.ts` would index `equipped[7]` with it.
   */
  pressItem(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= ITEM_SLOTS) return;
    this.itemPress = index;
  }

  /**
   * CONSUME the pending press. Returns the slot, or null when nothing is queued.
   *
   * ⚠️ **CONSUME-ONCE, WHERE `attackHeld` IS A LEVEL, AND THE ASYMMETRY IS THE FIELD'S
   * OWN.** `MatchInput.attack` is documented as *"one attack attempt this tick"* that a
   * held button may legitimately repeat every tick; `MatchInput.useItem` is *"ONE ITEM
   * ACTIVATION THIS TICK"* named by a press. Reading it as a level would mean a finger
   * resting on a button re-arms the item the instant its cooldown expires, which is a
   * different control from the one the button draws.
   *
   * ⚠️ **A PRESS SURVIVES UNTIL A FRAME COLLECTS IT.** `match.ts`'s loop calls
   * `buildInput()` once per stepping frame and skips it entirely while paused, so a press
   * made behind the pause sheet is delivered on the first frame after the resume rather
   * than being silently eaten. `reset()` and `onBlur` drop it, which covers restart,
   * backgrounding and the app switcher — the three ways a queued press stops meaning
   * what the player meant.
   */
  takeItemPress(): number | null {
    const slot = this.itemPress;
    this.itemPress = null;
    return slot;
  }

  /** Either fire control. Held mouse OR a finger on the aim stick — never one or the
   * other, so a hybrid device can use whichever is in the player's hand. */
  get attackHeld(): boolean {
    return this.mouseDown || this.touch.firing;
  }

  /** Normalized device coords of the last known mouse position, or null before any
   * move. Meaningless while pointer-locked — use `aimOffsetPx` there instead. */
  get mouseNdc(): { x: number; y: number } | null {
    return this.hasMouse && !this.locked ? { x: this.ndcX, y: this.ndcY } : null;
  }

  get pointerLocked(): boolean {
    return this.locked;
  }

  /**
   * Virtual-cursor offset from the aim origin, in CSS px, or null when not locked.
   *
   * `match.ts` adds the player's projected screen position to this — deliberately
   * NOT the viewport centre, even though the camera keeps the player near it: the
   * follow lerp lets the player drift by tens of pixels, and anchoring the reticle to
   * anything but the character makes the aim stick visibly detach from its own pivot.
   */
  get aimOffsetPx(): { x: number; y: number } | null {
    // Touch wins while a direction has been given, because on a device with both, the
    // finger is the thing that just moved. The unit direction becomes an offset at the
    // FULL aim radius rather than a proportional one: magnitude is normalised away by
    // `applyAim` and cannot mean anything, and pinning the reticle to the ring is what
    // the desktop stick's hard clamp already does at full deflection.
    const dir = this.touch.aimDir();
    if (dir) {
      const r = this.aimRadiusPx();
      this.touchOffset.x = dir.x * r;
      this.touchOffset.y = dir.y * r;
      return this.touchOffset;
    }
    return this.locked ? { x: this.offX, y: this.offY } : null;
  }

  /**
   * Switch cursor models. Driven by `pointerlockchange` (see `pointerLock.ts`), never
   * guessed at, so this can never disagree with `document.pointerLockElement`.
   */
  setPointerLocked(locked: boolean): void {
    if (locked === this.locked) return;
    this.locked = locked;
    if (!locked) return;

    // Seed from where the real cursor was relative to the frame centre — the player
    // sits at frame centre, so this hands the capture over with aim roughly where the
    // player was already pointing, instead of snapping to a fixed direction.
    if (this.hasMouse) {
      this.offX = this.clientX - window.innerWidth / 2;
      this.offY = this.clientY - window.innerHeight / 2;
    } else {
      this.offX = 0;
      this.offY = -this.aimRadiusPx();
    }
    this.clampOffset();
    this.hasMouse = true;
  }

  /** Raw move axes, each independently in [-1, 1] — NOT normalized, matching `MatchInput.move`. */
  moveAxes(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keyDown(MOVE_KEYS.left)) x -= 1;
    if (this.keyDown(MOVE_KEYS.right)) x += 1;
    if (this.keyDown(MOVE_KEYS.up)) y -= 1;
    if (this.keyDown(MOVE_KEYS.down)) y += 1;
    // Additive, then re-clamped, rather than "one backend wins": a held key and a
    // pushed stick on the same axis must not cancel to zero, and neither device is
    // allowed to lock the other out mid-match. In practice only one is ever non-zero.
    if (this.touch.moving) {
      x = Math.max(-1, Math.min(1, x + this.touch.move.x));
      y = Math.max(-1, Math.min(1, y + this.touch.move.y));
    }
    return { x, y };
  }

  /** Drop all held state — call on match restart so a stale keydown doesn't carry over. */
  reset(): void {
    this.keys.clear();
    this.mouseDown = false;
    // A press queued in the last match must not fire the first item of the next one.
    this.itemPress = null;
    this.touch.reset();
    if (this.locked) {
      this.offX = 0;
      this.offY = -this.aimRadiusPx();
    }
  }

  dispose(): void {
    this.touch.dispose();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  /** Radius of the aim ring, in CSS px. Scales with the short axis so the stick feels
   * the same on a 1280x800 laptop and a 2560x1080 ultrawide. */
  aimRadiusPx(): number {
    const short = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(AIM_RADIUS_MIN, Math.min(AIM_RADIUS_MAX, short * AIM_RADIUS_FRACTION));
  }

  /** Hard clamp — the stick bottoms out at the ring, exactly like a physical one, so
   * over-travel is discarded and the return stroke starts moving aim immediately. */
  private clampOffset(): void {
    if (this.freeAim) {
      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      this.offX = Math.max(-hw, Math.min(hw, this.offX));
      this.offY = Math.max(-hh, Math.min(hh, this.offY));
      return;
    }
    const r = this.aimRadiusPx();
    const len = Math.hypot(this.offX, this.offY);
    if (len <= r) {
      // Never let the virtual cursor collapse onto the player: a zero-length aim
      // vector is dropped by `applyAim`, which would freeze facing mid-fight.
      if (len < 1e-3) this.offY = -r;
      return;
    }
    const k = r / len;
    this.offX *= k;
    this.offY *= k;
  }

  private keyDown(codes: readonly string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_WEAPON_SLOT_KEY) {
      const idx = n - 1;
      if (idx < this.weaponCount) this.weaponIndex = idx;
    }
    // Items, on the KEYDOWN EDGE and gated on `repeat` for the same reason mute is:
    // the OS repeats a held key at ~30 Hz, and an item press is an EDGE (see
    // `takeItemPress`). Without `!e.repeat` a leaned-on Q would re-arm the item on the
    // frame after every cooldown expiry for as long as the finger was down.
    // ⚠️ Modifier-gated like mute, so browser and OS shortcuts (Cmd-Q quits the app on
    // macOS, Ctrl-Q on some Linux desktops) do not also spend an item on the way out.
    const itemSlot = e.repeat || e.ctrlKey || e.metaKey || e.altKey ? -1 : ITEM_KEYS.indexOf(e.code as typeof ITEM_KEYS[number]);
    if (itemSlot >= 0) this.pressItem(itemSlot);
    // Mute. Deliberately on the KEYDOWN edge and gated on `repeat`, so holding M does
    // not strobe the mix. Under pointer lock this is the only way out of the audio —
    // the OS volume mixer is no longer one cursor-move away.
    if (e.code === MUTE_KEY && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      audio.toggleMuted();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    // A moving mouse takes the aim back from a stick that was used earlier — LAST
    // DEVICE WINS, and it has to, because the touch aim deliberately survives the
    // finger lifting. On a hybrid laptop, without this one call, a single tap leaves
    // the mouse permanently unable to aim again. Above the pointer-lock branch on
    // purpose: a captured mouse is still a mouse, and hybrids can reach that path.
    this.touch.clearAim();
    if (this.locked) {
      // Under pointer lock clientX/clientY are frozen and meaningless; deltas are the
      // only real signal the browser still provides.
      this.offX += (e.movementX ?? 0) * this.sensitivity;
      this.offY += (e.movementY ?? 0) * this.sensitivity;
      this.clampOffset();
      this.hasMouse = true;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.clientX = e.clientX;
    this.clientY = e.clientY;
    this.ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.hasMouse = true;
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = true;
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseDown = false;
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.mouseDown = false;
    // Same reason the held stick is dropped below: a press made on the way out of the
    // app must not fire an item when the player comes back to a fight that has moved on.
    this.itemPress = null;
    // A finger held while the app is backgrounded never sends its `touchend`, so
    // without this the fighter walks into a wall for as long as the player is away.
    this.touch.reset();
  };

  /**
   * The SAME drop, on the signal a phone actually raises.
   *
   * `blur` is a desktop-shaped event. Backgrounding a browser on a phone — the app
   * switcher, a call, the notification shade — reliably fires `visibilitychange`;
   * whether it also fires `blur` is per-platform, and the whole point of the reset
   * above is that being wrong about it leaves the fighter running with no finger on
   * the glass. Measured on HEAD (`tools/tmp/touchfeel.mjs --mode interrupt`): a
   * `visibilitychange` with the stick held at full deflection left the sim receiving
   * `moveX = 1.00`, because nothing was listening.
   *
   * Belt and braces, the same way `pointerLock.ts` keeps its own `blur` handler
   * alongside `pointerlockchange` — the cost is one no-op call per tab switch and the
   * failure it covers is a lost fight.
   */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.onBlur();
  };

  private readonly onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
