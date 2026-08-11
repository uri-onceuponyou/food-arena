/**
 * Game HUD — DOM/CSS chrome laid over the WebGL canvas.
 *
 * Deliberately NOT drawn in 3D: health bars, the timer, the weapon bar, the
 * countdown and the game-over card are all plain positioned `div`s, styled to read
 * as one bold, chunky, high-contrast brawler HUD (see
 * `reference/images/curated/gameplay/bs_01.png`). `update()` is fully state-driven
 * and idempotent — call it every frame with the latest `MatchState` and it will show/
 * hide the countdown and game-over overlays on its own, so a match restart (a fresh
 * `MatchState` back in the `countdown` phase) just works without any extra wiring.
 */

import { audio } from '../audio';
import {
  CHARACTERS,
  FOG_DAMAGE,
  FOG_TICK_MS,
  MATCH_DURATION_MS,
  // 🚨 `MIN_SAFE_RADIUS` IS GONE AND THAT IS A BUG FIX, NOT TIDYING. It stopped being
  // the ring's floor in `4bb64e4`: the endgame ring now scales with the seat count
  // (140 at N<=4, 187.42 at N=5, **237.00 at N=6**) and collapses to 0 in sudden death
  // (`f87d407`). This file kept comparing against the bare constant, so above two seats
  // it told a fighter standing 100 wu from the centre "FINAL RING" — the edge will never
  // reach you — **while the fog burned them at 50 HP/s.** `ringFloorFor` is the one
  // function that knows both rules; see `zoneInfo`.
  ringFloorFor,
  suddenDeathActive,
  type CharacterId,
  type Weapon,
} from '../game/rules';
// ⚠️ `FighterRole` is GONE from this file's imports and that is the headline: nothing in
// the HUD reads a seat NAME any more. Slots come from `roster.ts`, and the only two-valued
// strings left are the CSS modifiers `--player` / `--enemy`, which are a look, not an
// identity (see `buildFighterSlots`).
import type { Fighter, MatchState } from '../game/state';
import { fightersOf, LOCAL_SLOT, localFighter, slotKey, slotOf } from '../game/roster';
import { isVisibleFrom } from '../game/movement';
// The guaranteed-visible radius. It lives with the camera because the camera is what
// guarantees it, but it is a GAMEPLAY number — "how far can this player possibly see"
// — and the zone warning is calibrated against it so the pill and the 3D fog curtain
// never disagree about whether the edge is something you can look at. See imminentMs.
import { FAIR_PLAY } from '../render/camera';
import { abilityIcon, ensureIconStyles, hydratePortraits, icon, portraitMarkup } from './icons';

export interface HudCallbacks {
  onRestart: () => void;
  /**
   * A weapon slot was tapped/clicked. THE TOUCH EQUIVALENT OF THE `1`-`4` KEYS: a phone
   * has no digit row, so without this a mobile player is locked to slot 1 for the whole
   * match and three quarters of every character is unreachable.
   *
   * The slots only accept pointer events once the player has actually touched the
   * screen (see `html.fa-touch` in the CSS). That is deliberate and load-bearing: this
   * bar sits at bottom-centre, which is a perfectly ordinary place for a desktop player
   * to be aiming, and a slot that claimed clicks unconditionally would eat fire clicks
   * on a machine with no touchscreen at all.
   */
  onSelectWeapon?: (index: number) => void;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface HudFrameInfo {
  /** The weapon slot the player currently has selected (for the highlight ring). */
  selectedWeapon: number;
  /**
   * Where to draw the "run this way" chevron while the player is outside the safe
   * zone, and which way it points — both in SCREEN space, because the direction to
   * safety depends on the camera and only `match.ts` can project it. Null (or absent)
   * hides the chevron.
   */
  safeArrow?: { at: ScreenPoint; angleRad: number } | null;
  /**
   * The aim reticle, in SCREEN space — `from` is the player's own projected position
   * and `at` is where the virtual cursor is pointing.
   *
   * Only supplied while the mouse is POINTER-LOCKED (`src/game/pointerLock.ts`). Under
   * lock the OS cursor is hidden by the browser, so without this the player is aiming
   * at nothing they can see. When the cursor is free the OS cursor IS the reticle and
   * this stays null, so the two can never be drawn at once.
   */
  aim?: { from: ScreenPoint; at: ScreenPoint } | null;
  /**
   * WHERE THE LOCAL SEAT FINISHED — the one thing the result card cannot say today.
   *
   * 🔴 The six-player acceptance pass measured the defect: the card lists every loser
   * in SLOT order, so a six-way always reads `EGG defeated HAMBURGER DONUT TACO SUSHI
   * PIZZA` — **identical whether you came 2nd or 6th.** For five of the six players
   * that is the entire result of the match, and it is not on the screen.
   *
   * ⚠️ IT IS OPTIONAL AND THE HUD DOES NOT COMPUTE IT, DELIBERATELY. A rank does not
   * exist at this boundary yet: `onPhase(phase, winner)` carries a ROLE, and `sim.ts`
   * publishes a winner rather than a finishing order. `DECISIONS §49a` fixes the
   * ordering as *"fewest deaths, then lower slot"* and that belongs to whoever owns the
   * match result, not to a renderer — a HUD that derived its own would be a second
   * source of truth for the one number the player cares most about, which is the shape
   * of all five recorded `ai.ts` defects. So this is a SOCKET: absent (today) the card
   * renders exactly as it did, and the moment a rank is supplied it is drawn.
   */
  place?: { place: number; of: number } | null;
  /**
   * THE WHOLE FINISHING ORDER — `order[k]` is the SLOT that finished `k`th, best first.
   *
   * 🔴 The loser list under the title was `roster.filter((_, i) => i !== winnerSlot)` —
   * SLOT order — so a six-way read `SUSHI defeated HAMBURGER DONUT TACO PIZZA EGG`
   * whichever way the match actually went. `place` (above) landed the *number*; this is
   * what makes the four names under it agree with that number instead of contradicting it.
   * Worth more than tidiness: `roster.ts:resolvePlaces`' own measurement is that reversed
   * elimination order agrees with slot order in **0.0% of six-seat matches**, so at six
   * seats the slot-order list named the wrong runner-up *every single time*.
   *
   * ⚠️ SAME SOCKET DISCIPLINE AS `place`, FOR THE SAME REASON. The HUD does not derive
   * it — the rank is not in the final state at all (every loser ends `hp: 0, deaths: 1,
   * alive: false` in 220 of 220 real matches; only the ORDER OF THE `death` EVENTS
   * separates them, and only `game/match.ts` sees those). Absent, the card renders exactly
   * as it did.
   *
   * ⚠️ AND IT IS VALIDATED AS A PERMUTATION BEFORE IT IS TRUSTED, rather than being
   * indexed into hopefully — see the use site. A short or duplicated list would silently
   * DROP fighters off the card, which is a worse defect than the one this fixes.
   */
  order?: readonly number[] | null;
  /**
   * WHAT THE MATCH PAID — rendered, never computed. Null (or absent) draws nothing.
   *
   * 🔴 The six-player acceptance run (`DECISIONS §64`) measured the payout join and
   * `bb00d66` fixed it, so a player finishing 3rd of 6 is now paid **+9 trophies, 44 coins
   * and 74 XP** — and was told **none of it**. The result card is the one screen a player
   * reads word for word at the end of a match; the trophy road's floating delta only
   * appears if they happen to walk to that screen.
   *
   * 🚨 **THE HUD MUST NOT BE ABLE TO PRODUCE THIS NUMBER, AND STRUCTURALLY CANNOT.**
   * The payout is applied as a SIDE EFFECT of banking the result
   * (`profile.recordPlacement` mutates the economy and commits it), so anything that
   * recomputed it here would either bank a second time or become a second source of truth
   * for money. `ui/screens/matchScreen.ts` banks exactly once behind its own `banked`
   * guard and hands the RETURN VALUE down; `game/match.ts` carries it and imports nothing
   * from the economy at all. `tools/tmp/rc_card.mjs` §D asserts the banked trophy delta
   * equals the number on the card rather than twice it, and has a known-bad arm that
   * banks twice and goes red.
   *
   * ⚠️ It does NOT mark `LastMatch.seen`. That flag belongs to `trophyRoad.ts`'s floating
   * congratulation, which is a different surface with a different job; setting it from
   * here would silently delete that flourish.
   */
  payout?: MatchPayout | null;
}

/**
 * ONE MATCH'S EARNINGS, AS PLAIN NUMBERS.
 *
 * Deliberately NOT `economy/state.ts:LastMatch` — that type carries `won`, `place`,
 * `seats` and `seen`, every one of which the card either already knows from `place`/the
 * title or has no business touching. It is also declared HERE, in the renderer, rather
 * than in the economy: this is the shape the card can DRAW, and a renderer that imported
 * the economy's type would be one refactor away from importing its functions.
 *
 * `xp` is separate from the others because it is: `recordPlacement` returns `LastMatch`
 * (trophies/coins/chests) and adds XP through `placementXp` without returning it, so the
 * call site is where the two halves of one payout meet.
 */
export interface MatchPayout {
  /** Trophy delta. **Signed** — 5th and 6th of six are negative, and the card says so. */
  trophies: number;
  coins: number;
  xp: number;
  /** Free-chest credit banked by this match, if any. Omitted/0 draws no chip. */
  chests?: number;
}

export interface Hud {
  /** Call once per frame with the live match state. */
  update(state: MatchState, frame: HudFrameInfo): void;
  /**
   * Call once, as soon as the roster is known, to label bars and build weapon slots.
   *
   * ⚠️ TAKES A LIST IN SLOT ORDER, where it used to take `(playerId, enemyId)`. Two
   * positional `CharacterId`s cannot express three fighters, and a third parameter would
   * have been a `CharacterId | undefined` that every existing caller passes nothing for —
   * which is a signature that compiles at every arity and means something different at
   * each. `ids[i]` is slot `i`; `ids.length` is how many seats the HUD builds.
   */
  setCharacters(ids: readonly CharacterId[]): void;
  /**
   * Position the floating name+health pills above each fighter's head, in SLOT ORDER.
   * A `null` point hides that fighter's pill — which is the one channel concealment and
   * death both ride (see `match.ts`'s "SURFACE 2 OF 3").
   *
   * Two parallel arrays rather than one array of pairs: `points` comes from projecting a
   * model and `health01` from the sim, they are produced by different expressions at the
   * call site, and pairing them there would only move the zip.
   */
  updateFloatingBars(points: readonly (ScreenPoint | null)[], health01: readonly number[]): void;
  /** Spawn a rising, fading damage/heal number at a screen point. Pooled — safe to
   * call as often as hits land, never allocates a new DOM node. */
  spawnDamageNumber(point: ScreenPoint, amount: number, opts?: { heal?: boolean; fog?: boolean }): void;
  /** Brief full-viewport radial flash, tinted `color` — reserved for genuinely
   * screen-filling moments (Lollipop's Giant Lollipop). Always pointer-events:none. */
  flashScreen(color: string): void;
  /**
   * One-shot screen-EDGE pulse, fired on every closing-fog damage tick.
   *
   * Deliberately a different shape of feedback from `flashScreen` (radial, centre-out)
   * and from a weapon impact burst: the fog is not a hit from a direction, it is the
   * whole world closing in, so it presents as the frame's border igniting. Before this
   * existed, fog damage reused the generic violet impact burst and was literally
   * indistinguishable from being shot.
   */
  flashFogTick(): void;
  dispose(): void;
}

/**
 * CAN THIS CLIENT'S HUMAN SEE THE OPPONENT AT ALL?
 *
 * The single presentation-side statement of concealment, and every surface that could
 * leak the enemy's position calls THIS rather than re-deriving it — the radar blip here
 * in `renderZone`, and both the floating HP pill and the 3D model in `game/match.ts`.
 * Three surfaces, one predicate: five recorded `ai.ts` defects were all one rule stated
 * once and implemented twice, and three surfaces is three chances to make the same
 * mistake.
 *
 * ── ⚠️ THE ASYMMETRY, WHICH IS THE ONLY WAY TO GET THIS WRONG ────────────────
 *
 * ⚠️ **THIS PARAGRAPH USED TO SAY SOMETHING THAT IS NOW FALSE, AND IT IS KEPT ABOVE ITS
 * REPLACEMENT BECAUSE IT WAS RIGHT FOR AS LONG AS THERE WERE TWO SEATS:**
 *
 *   > *"The sim is SYMMETRIC — `Fighter.concealed` is published for both fighters and
 *   > either can be standing under a plate. The RENDERER IS NOT: it is one human's client,
 *   > the camera follows `state.player`, and a player who hides must still see themselves
 *   > or the frame reads as a crash. So the observer is always `state.player` and the
 *   > target is always `state.enemy`, in that order, stated once here so no call site can
 *   > transpose them."*
 *
 * The FIRST half is still exactly the rule and it is the whole point of this function.
 * The SECOND half named the two seats a two-fighter sim had. `state.fighters` now seats up
 * to `MAX_FIGHTERS`, so "the target is always `state.enemy`" would mean *slot 1 is the only
 * fighter that can ever be hidden* — with slots 2..5 drawn, blipped and pilled through
 * their cover. Generalised, the rule is:
 *
 *   * the OBSERVER is always `roster.ts:LOCAL_SLOT` — the seat this screen belongs to;
 *   * the TARGET is any OTHER fighter, asked one at a time;
 *   * **the observer is never hidden from itself.** Nothing in this file or in `match.ts`
 *     ever hides the local fighter, and `match.ts` skips `LOCAL_SLOT` explicitly rather
 *     than relying on this predicate returning `true` for a fighter asked about itself.
 *
 * The argument order is still the trap and is still stated once: observer first, target
 * second, both as whole `Fighter` objects rather than as coordinate pairs, so a
 * transposition is a type-checked mistake at every call site instead of four swapped
 * numbers that compile.
 *
 * ── ⚠️ WHY NOT `state.enemy.concealed` ──────────────────────────────────────
 *
 * `Fighter.concealed` is a position-only observation: *is this fighter inside a region.*
 * Visibility is a two-body question, because `CONCEAL_REVEAL_RADIUS` (84 wu, = the
 * longest melee rung) says concealment does NOT hide you from someone already within
 * touching distance. Hiding the model on `concealed` alone would delete an enemy who is
 * close enough to hit you — the sim would let them swing at a target that had vanished
 * from the screen, which is a bug that presents as a rendering fault. `isVisibleFrom` is
 * the same predicate `ai.ts` and `sim.ts:stepProjectiles` gate on, so the human's screen
 * and the AI's perception are answering the question with one function.
 *
 * It is also the field's own documented rule: `Fighter.concealed` is written once per
 * fighter per tick from `applyWorldTick`, which only runs while `phase === 'playing'` and
 * returns early for a dead fighter — i.e. it is STALE in exactly the states the renderer
 * draws through. `isVisibleFrom` reads live positions and has no such window.
 *
 * ── PRESENTATION ONLY ───────────────────────────────────────────────────────
 *
 * Pure: two positions and the arena in, a boolean out, nothing written. Nothing derived
 * from it is ever fed back into `stepMatch`, so the seeded determinism that underwrites
 * every balance number in the project is untouched (`sim.test.mjs` stays at 253 and
 * `conceal_lab --bitid` stays exact).
 *
 * Degenerates to `true` on every arena that ships no `concealment` list, which today is
 * all of them — so this is currently a no-op by construction, not by luck.
 */
export function fighterVisibleTo(state: MatchState, observer: Fighter, target: Fighter): boolean {
  // ⚠️ `state, target` ARE THE §29c ARGUMENTS, and omitting them made THE PLAYER'S OWN
  // SCREEN the only observer still resolving concealment against DECLARED regions instead of
  // STANDING ones. Two facts live on the match, not the arena, and `ArenaDefinition` cannot
  // carry either — it is one shared object across every match a process runs:
  //   `MatchState.brokenConcealment`  a plate the target shattered by attacking from under it
  //   `Fighter.revealedUntil`         the window a fighter's own attack buys the other side
  // Without them the radar would keep hiding an enemy who had just destroyed their cover and
  // fired at you — the sim would treat them as seen while the HUD treated them as hidden, and
  // that disagreement between two readers of one rule is this project's oldest defect shape.
  // `ai.ts` takes the same two arguments at its own single call site for the same reason.
  return isVisibleFrom(observer.x, observer.y, target.x, target.y, state.arena, state, target);
}

/**
 * @deprecated THE TWO-SEAT SPELLING of `fighterVisibleTo(state, local, state.enemy)`.
 *
 * Kept for the same reason `state.ts` keeps `otherRole` and `opponentOf`: it is named in
 * `rules.ts`'s and `movement.ts`'s CONCEALMENT notes as the presentation-side predicate, and
 * a symbol that four comments point at should not simply stop existing. It is not called by
 * anything in `src/` — both call sites went to the general form, one per non-local slot.
 */
export function enemyVisibleToPlayer(state: MatchState): boolean {
  return fighterVisibleTo(state, localFighter(state), state.enemy);
}

const STYLE_ID = 'hud-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Elapsed-time formatter for the game-over card's "Match time" stat — rounds to the
 * nearest second (formatTime above deliberately ceils instead, since it's a
 * countdown where "0:01" must not read as "over"). */
function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const LOW_HP_FRACTION = 0.25;

/**
 * Slack around the opening safe circle in the radar's world window, as a fraction of
 * its radius. See the long note in `renderZone`'s radar section.
 *
 * It buys two things and costs one. It guarantees the zone boundary is several pixels
 * INSIDE the card at t=0 rather than exactly on its border (a boundary drawn on the
 * border is indistinguishable from one that has been clipped away), and it keeps a
 * band of fog visible from the opening frame so the widget never reads as "solid
 * cream, nothing happening". It costs zoom: the whole map is drawn 1/(1+margin)
 * smaller, so the final ring at MIN_SAFE_RADIUS shrinks with it.
 *
 * SIZED FOR THE SMALLEST CARD, not the desktop one. Clearance at t=0 is
 * `halfCardPx * margin / (1 + margin)`, so the 105px card the phone and short-viewport
 * media queries drop to gets 45% less of it than the 152px desktop card. At 0.06 that
 * was 3.0px there — measured, the disc's own outer glow washed straight over it and
 * the opening frame had no visible fog at all on a phone, which is the exact bug this
 * whole change exists to remove. 0.14 gives 6.4px at 105px and 9.3px at 152px.
 */
const RADAR_MARGIN = 0.14;

function setBar(fill: HTMLElement, text: HTMLElement, hp: number, maxHp: number): void {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  fill.style.width = `${(frac * 100).toFixed(1)}%`;
  text.textContent = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
}

interface WeaponSlotEls {
  root: HTMLDivElement;
  cooldown: HTMLDivElement;
  timer: HTMLDivElement;
  /** Tracks the ready/cooling edge so a weapon coming off cooldown gets a one-shot
   * "ready!" flash instead of silently flipping a border colour. */
  wasReady: boolean;
}

export function createHud(root: HTMLElement, callbacks: HudCallbacks): Hud {
  ensureStyles();
  ensureIconStyles();

  root.innerHTML = `
    <div class="hud-root">
      <!-- FIRST in the stack, deliberately. These two are the only full-viewport
           tints in the HUD, and siblings here are painted in DOM order, so anything
           declared after them stays legible ON TOP of the danger wash. Round 1 had
           them last and the burn discoloured the health bars, the weapon icons and
           the radar's own safe disc — i.e. the readouts you most need while it is
           firing. -->
      <div class="hud-fogedge" data-el="fogedge"></div>
      <div class="hud-fogtick" data-el="fogtick"></div>

      <div class="hud-topbar-scrim"></div>
      <!-- ── The fighter nameplates are BUILT, not declared ────────────────────
           state.fighters seats up to MAX_FIGHTERS, so a static two-fighter
           template is a two-fighter game. buildFighterSlots() below inserts one
           block per slot — slot 0 BEFORE this clock and every other slot AFTER it,
           which reproduces the old declaration order (player, clock, enemy) exactly
           at two fighters. The clock stays declared here because it is the one child
           of this bar that is not per-fighter and it is what the others are placed
           relative to. -->
      <div class="hud-topbar" data-el="topbar">
        <div class="hud-clock">
          <!-- ⚠️ THIS PLACEHOLDER READ 3:00 UNTIL 2026-08-11 AND THE CLOCK HAS NOT BEEN
               THREE MINUTES SINCE rules.ts SET MATCH_DURATION_MS = 45_000. It is
               overwritten by the first update(), so nothing on screen was ever wrong — but
               a markup literal is read by the next person as a statement of fact about the
               clock, and this one contradicted the one true source by 4x. Kept as the full
               duration rather than as an empty string so the element still has its shipped
               WIDTH before the first frame paints.
               (No backticks in this comment on purpose: the whole block is a template
               literal, and a backtick here closes it — which is exactly how this comment
               failed to compile the first time it was written.) -->
          <div class="hud-timer" data-el="timer">0:45</div>
          <!-- Closing-fog readout. Sits directly under the match clock because the
               two are the SAME number: the safe radius is a pure function of time
               remaining (see zoneInfo() below), so reading them as one column is
               honest. Flips to a danger state the instant the player steps outside. -->
          <div class="hud-zone" data-el="zone">
            <div class="hud-zone-row">
              <div class="hud-zone-label" data-el="zone-label">SAFE ZONE</div>
              <div class="hud-zone-value" data-el="zone-value">--</div>
            </div>
            <div class="hud-zone-track"><div class="hud-zone-bar" data-el="zone-bar"></div></div>
          </div>
        </div>
      </div>

      <div class="hud-weapons" data-el="weapons"></div>

      <div class="hud-countdown" data-el="countdown"></div>

      <!-- ── "Run this way" ─────────────────────────────────────────────────
           Declared HERE, above the floating pills rather than below them, and that
           order is the fix for a measured collision: the near chevron sits 40px from
           the player's projected GROUND point, and the player's own floating HP pill
           sits ~30-60px above that same point, so every time safety happens to lie
           upward — a quarter of all cases, the same quarter the label's own placement
           rule was written for — a 48px opaque triangle landed on top of the one
           readout telling you how much life you have left while the zone is burning
           it away. Photographed at 4x in shots/hud/after1/crop-chev.png.

           Drawing it UNDER the pill costs the arrow a few px of a shape that is 140px
           long and duplicated (two chevrons plus a label), and costs the HP bar
           nothing. It stays above the weapon tray, which is declared earlier. -->
      <div class="hud-safearrow" data-el="safearrow">
        <div class="hud-safearrow-chevron"></div>
        <div class="hud-safearrow-chevron hud-safearrow-chevron--2"></div>
      </div>
      <div class="hud-safearrow-label" data-el="safearrow-label">RUN TO THE ZONE</div>

      <!-- The floating per-fighter pills are BUILT by buildFighterSlots() and
           inserted immediately before the radar below, which is exactly where they
           were declared — DOM order here is paint order, and the pills must stay
           under the radar and over the weapon tray.

           Deliberately NO name TEXT on them — the top-corner nameplates are the one
           canonical place to read "who is who"; repeating the full name would just
           split attention between two labels for the same fighters. A small
           emoji badge (matching the corner pill's language, not its text) plus a
           chunky bar on a solid backing plate keeps this legible against any floor
           colour without reintroducing that duplicate readout. -->

      <!-- ── Closing-fog boundary readouts ────────────────────────────────────
           The 3D boundary (src/arena/fogRing.ts) answers "where is the edge" only
           while the edge is in frame. It very often is not: the map is 1400x1000 wu
           and a player is only guaranteed to see 199.2 wu in any direction, so for
           most of a match the safe radius is far outside the window. These three
           elements are what make the zone knowable from ANYWHERE:

             - the radar, which shows the whole map, the circle, and both fighters;
             - the edge vignette, which says "you are being killed right now";
             - the chevron, which says which way to run. -->
      <div class="hud-radar" data-el="radar">
        <div class="hud-radar-map" data-el="radar-map">
          <div class="hud-radar-safe" data-el="radar-safe"></div>
          <!-- The PLAYFIELD's own rectangle, drawn OVER the safe disc.
               The card is a window on MORE world than the arena (see renderZone for
               why), so without this there is nothing telling the player where the
               walls are: "inside the map but in the fog" and "not the map at all"
               would be the same violet pixels. Its stroke and its grid both have to
               read on cream AND on violet, because the disc sweeps across this
               rectangle during a match. -->
          <div class="hud-radar-arena" data-el="radar-arena">
            <div class="hud-radar-grid"></div>
          </div>
          <!-- Blips are BUILT (see buildFighterSlots) and appended here in the order
               OPPONENTS-then-LOCAL, so the local dot paints last and is never covered by
               someone standing on top of it. That is the order these two were declared
               in, and at two fighters the DOM is character-for-character the same. -->
        </div>
        <div class="hud-radar-cap" data-el="radar-cap">SAFE ZONE</div>
      </div>

      <!-- ── Mute state ──────────────────────────────────────────────────────
           M toggles mute (see game/input.ts). It was landing SILENTLY, which
           makes it a coin flip: press it during a quiet second and there is no way
           to tell whether it worked, whether the key is even bound, or which state
           you are now in. It matters most under pointer lock, where the OS volume
           mixer is no longer one cursor-move away — that is why the hotkey exists.
           So: latched while muted, a brief confirmation when sound comes back. -->
      <div class="hud-mute" data-el="mute"></div>

      <!-- ── Aim reticle (pointer lock only) ─────────────────────────────────
           Declared LATE in the stack so it paints over the radar, the weapon bar and
           the fog wash: it is the one HUD element that is literally the player's
           cursor, and a cursor that can be covered is worse than no cursor. -->
      <div class="hud-aim-stick" data-el="aim-stick"><i></i></div>
      <div class="hud-aim-reticle" data-el="aim-reticle">
        <div class="hud-aim-dot"></div>
      </div>

      <div class="hud-dmg-layer" data-el="dmg-layer"></div>
      <div class="hud-screenflash" data-el="screenflash"></div>

      <!-- ── The result card is LAST, and it was not ────────────────────────
           It used to be declared seventh of seventeen, which put the radar, both
           floating pills, the mute badge, the aim reticle, the damage layer and the
           ultimate flash on top of a full-viewport modal. Photographed at 1600x900
           (shots/hud/r2/desk-ended.png): a "-15 ZONE" damage number left over from the
           killing blow is drawn between "Match time 0:24" and the Play Again button,
           on the one screen a player reads word for word.

           A result card is the last thing in a match by definition, so it is the last
           thing in the stack. This does NOT change the z-index the screen layer relies
           on — .hud-root stays at 20 and ui/screens/matchScreen.ts stays at 40, so its
           Menu button is still clickable over this scrim. -->
      <div class="hud-gameover" data-el="gameover">
        <div class="hud-gameover-card">
          <div class="hud-gameover-title" data-el="gameover-title"></div>
          <!-- The local seat's finishing PLACE. Empty and display:none unless
               HudFrameInfo.place is supplied — see that field. Declared between the
               title and the subtitle because that is the reading order of the sentence
               it completes: "DEFEAT! / 4th of 6 / EGG defeated ...". -->
          <div class="hud-gameover-place" data-el="gameover-place"></div>
          <div class="hud-gameover-subtitle" data-el="gameover-subtitle"></div>
          <div class="hud-gameover-stats" data-el="gameover-stats"></div>
          <!-- What the match PAID. Empty and display:none unless HudFrameInfo.payout is
               supplied — see that field, and note that the HUD is handed these numbers and
               cannot compute them. Declared LAST before the button because it is the one
               thing on this card the player is about to act on: read the verdict, read the
               reward, press the button. -->
          <div class="hud-gameover-payout" data-el="gameover-payout"></div>
          <button class="hud-gameover-btn" data-el="gameover-btn" type="button">Play Again</button>
        </div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!el) throw new Error(`hud: missing element "${sel}"`);
    return el;
  };

  const timerEl = q<HTMLDivElement>('timer');
  const weaponsEl = q<HTMLDivElement>('weapons');
  const countdownEl = q<HTMLDivElement>('countdown');
  const gameoverEl = q<HTMLDivElement>('gameover');
  const gameoverTitleEl = q<HTMLDivElement>('gameover-title');
  const gameoverPlaceEl = q<HTMLDivElement>('gameover-place');
  const gameoverSubtitleEl = q<HTMLDivElement>('gameover-subtitle');
  const gameoverStatsEl = q<HTMLDivElement>('gameover-stats');
  const gameoverPayoutEl = q<HTMLDivElement>('gameover-payout');
  const gameoverBtn = q<HTMLButtonElement>('gameover-btn');

  const topbarEl = q<HTMLDivElement>('topbar');
  // ⚠️ BY CLASS, NOT BY A NEW `data-el`. Adding `data-el="clock"` was the ONLY
  // difference `np_identity` found between the two-fighter DOM this file used to emit and
  // the one it builds now — one attribute, on one element, and it moved the HUD digest.
  // The acceptance test is worth more than a tidier handle, so the anchor is the class
  // that was already there and the DOM is byte-identical at two fighters.
  const clockEl = root.querySelector<HTMLDivElement>('.hud-clock')!;
  // The template's outermost element, and the only place a custom property set from JS
  // reaches every HUD child: `.hud-radar`, `.hud-dmg-layer` and the float pills are all
  // its children, so `--fa-topbar-b` (see floatFloorY) has to live here rather than on
  // any one of them. ⚠️ By CLASS, for the same reason as `clockEl` above — a new
  // `data-el` on a shipped element moved the HUD digest once and is not worth a handle.
  const hudRootEl = root.querySelector<HTMLDivElement>('.hud-root')!;

  const dmgLayer = q<HTMLDivElement>('dmg-layer');
  const screenflashEl = q<HTMLDivElement>('screenflash');

  const zoneEl = q<HTMLDivElement>('zone');
  const zoneLabelEl = q<HTMLDivElement>('zone-label');
  const zoneValueEl = q<HTMLDivElement>('zone-value');
  const zoneBarEl = q<HTMLDivElement>('zone-bar');
  const radarEl = q<HTMLDivElement>('radar');
  const radarSafeEl = q<HTMLDivElement>('radar-safe');
  const radarArenaEl = q<HTMLDivElement>('radar-arena');
  const radarMapEl = q<HTMLDivElement>('radar-map');
  const radarCapEl = q<HTMLDivElement>('radar-cap');
  const fogEdgeEl = q<HTMLDivElement>('fogedge');
  const fogTickEl = q<HTMLDivElement>('fogtick');
  const safeArrowEl = q<HTMLDivElement>('safearrow');
  const safeArrowLabelEl = q<HTMLDivElement>('safearrow-label');
  const aimStickEl = q<HTMLDivElement>('aim-stick');
  const aimReticleEl = q<HTMLDivElement>('aim-reticle');
  const muteEl = q<HTMLDivElement>('mute');

  // ── Per-fighter DOM, POOLED BY SLOT ────────────────────────────────────────
  //
  // 🚨 THIS BLOCK IS THE ONE PLACE THE HUD KNOWS HOW MANY FIGHTERS THERE ARE.
  // It replaces a static two-fighter template plus fourteen singleton
  // `q<HTMLDivElement>('player-…' / 'enemy-…')` fetches. Three rules govern it, and
  // all three are compatibility constraints rather than taste:
  //
  //  1. **SLOTS 0 AND 1 KEEP THEIR EXACT `data-el` NAMES AND CLASSES.** `player-name`,
  //     `enemy-hp`, `float-enemy`, `radar-player`, `.hud-fighter--player`,
  //     `.hud-radar-dot--enemy` and friends are selected by name from at least ten
  //     instruments, two of them shipped gates (`menu_accept_portrait` reads
  //     `.hud-fighter--player` / `.hud-fighter--enemy`; `cw_conceal_view` reads
  //     `[data-el="radar-enemy"]` and `[data-el="float-enemy"]`). See `roster.ts:slotKey`.
  //     A guard that silently stops matching is this project's most expensive
  //     recurring failure, so this is a contract.
  //  2. **THE DOM AT TWO FIGHTERS IS THE OLD DOM, ELEMENT FOR ELEMENT AND IN ORDER.**
  //     Nameplates go [slot 0, clock, slot 1…]; float pills go immediately before the
  //     radar; blips go opponents-then-local inside the radar map. That ordering is
  //     paint order and it was load-bearing in three places already documented above.
  //  3. **SLOT 1 AND UP SHARE THE `--enemy` MODIFIER**, which is exactly what
  //     `state.ts:roleOfSlot` says the seat name of every non-zero slot is. Slot 4 is
  //     not "the enemy" — but it is not the local player either, and the whole visual
  //     language of this HUD (red vs green, right-aligned vs left) is that one
  //     distinction. `querySelector('.hud-fighter--enemy')` therefore keeps returning
  //     slot 1, which is what every existing instrument means by it.
  //
  // Rebuilt only when the COUNT changes, so a restart at the same size touches no DOM.
  interface FighterSlotEls {
    name: HTMLDivElement; emoji: HTMLDivElement;
    bar: HTMLDivElement; fill: HTMLDivElement; hpText: HTMLDivElement;
    float: HTMLDivElement; floatEmoji: HTMLDivElement; floatFill: HTMLDivElement;
    blip: HTMLDivElement;
  }
  let fighterSlots: FighterSlotEls[] = [];
  /**
   * The opponents' rail — EXISTS ONLY ABOVE TWO SEATS. See `buildFighterSlots`.
   * Held in the closure rather than re-queried because a rebuild has to delete it, and
   * a stale `.hud-chips` left behind by a 6→2 restart would be an empty grid column
   * that pushed the clock off centre in a two-fighter match.
   */
  let chipsEl: HTMLDivElement | null = null;

  /**
   * ── ABOVE TWO SEATS THE OPPONENTS BECOME CHIPS ────────────────────────────
   *
   * `DECISIONS §49f`, answered by Uri 2026-08-11: *"Local seat full, others as chips"*.
   *
   * The problem it answers is measurable rather than aesthetic. Six plates at
   * `flex: 1 1 260px` share one flex row with the clock, so at 1280×720 each one
   * compressed to ~45% of its design width AND the clock — the only element in the bar
   * that is not per-fighter — was shoved to x≈288 of 1280 by the four plates piled up
   * to its right (`shots/np/nf6.png`). Every readout was still legible; the bar just
   * was not a design.
   *
   * So above two seats the top bar stops being one flex row and becomes three columns:
   *
   *     [ the local fighter, full size ]   [ clock ]   [ opponent chips, right ]
   *              1fr                         auto              1fr
   *
   * Two equal `1fr` side columns is what actually centres the clock — it is centred by
   * the GRID, not by however much plate happens to sit either side of it, which is the
   * property the old flex row could not have at any plate width.
   *
   * 🚨 **AND IT APPLIES ABOVE TWO SEATS ONLY, WHICH IS THE WHOLE ACCEPTANCE TEST.**
   * `3980e6e` measured the two-fighter DOM as character-for-character what it was, and
   * the entire N-fighter presentation rests on that. So at `n === 2` this function must
   * emit exactly what it emitted before this change: no `hud-topbar--chips` class, no
   * `.hud-chips` element, no `--chip` modifier. Everything new is gated on `chipped`,
   * every new CSS rule is a descendant of one of those two hooks, and `np_ab`'s
   * base-vs-work arms are what prove it rather than this comment.
   *
   * ⚠️ A CHIP IS THE SAME ELEMENTS, RESTYLED — not a second template. `data-el`
   * `${key}-name`, `${key}-bar`, `${key}-fill`, `${key}-hp` and the `.hud-fighter-name`
   * / `.hud-healthbar-text` classes all still exist on a chip and still carry their own
   * slot's text; the name and the numeric HP are `display: none` at chip size because
   * 48px cannot hold either at a readable weight. That is deliberate and it is the
   * reference pattern — the PORTRAIT is the identity at this size — but it does mean
   * `np_nfighter`'s "every nameplate names its own slot" and "every HP readout carries
   * its own slot's hp" are, above two seats, assertions about the DOM's WIRING rather
   * than about something a player reads. They are still worth exactly what they were
   * built for (a pooled HUD writing every fighter into slot 1), and `h49_chips.mjs`
   * measures the things a player DOES read.
   */
  function buildFighterSlots(n: number): void {
    if (fighterSlots.length === n) return;
    for (const s of fighterSlots) { s.bar.parentElement?.remove(); s.float.remove(); s.blip.remove(); }
    fighterSlots = [];
    chipsEl?.remove();
    chipsEl = null;

    const chipped = n > 2;
    // ⚠️ `toggle(…, false)` at two fighters, not a bare `add` under an `if`. The class
    // has to be REMOVED on a 6→2 restart, and `class="hud-topbar"` round-trips through
    // `DOMTokenList` unchanged — which is asserted by `np_ab`'s HUD digest, not assumed.
    topbarEl.classList.toggle('hud-topbar--chips', chipped);
    if (chipped) {
      chipsEl = document.createElement('div');
      chipsEl.className = 'hud-chips';
      chipsEl.dataset.el = 'chips';
      topbarEl.appendChild(chipsEl);
    }

    for (let i = 0; i < n; i++) {
      const key = slotKey(i);
      // `--player` for the local seat, `--enemy` for every other one. See rule 3.
      const mod = i === 0 ? 'player' : 'enemy';
      const chip = chipped && i > 0;

      const plate = document.createElement('div');
      // Composed in the ONE assignment rather than `add`ed afterwards: at two fighters
      // this string has to be byte-for-byte `hud-fighter hud-fighter--player`, and a
      // second `classList` call is a second chance for a stray space.
      plate.className = `hud-fighter hud-fighter--${mod}${chip ? ' hud-fighter--chip' : ''}`;
      // The pill is MIRRORED on the opponent side — portrait outboard, name inboard —
      // and that was expressed as two hand-written templates. It is one branch now.
      const pill = i === 0
        ? `<div class="hud-fighter-emoji" data-el="${key}-emoji"></div>` +
          `<div class="hud-fighter-name" data-el="${key}-name"></div>`
        : `<div class="hud-fighter-name" data-el="${key}-name"></div>` +
          `<div class="hud-fighter-emoji" data-el="${key}-emoji"></div>`;
      plate.innerHTML =
        `<div class="hud-fighter-pill">${pill}</div>` +
        `<div class="hud-healthbar hud-healthbar--${mod}" data-el="${key}-bar">` +
          `<div class="hud-healthbar-fill" data-el="${key}-fill"></div>` +
          `<div class="hud-healthbar-text" data-el="${key}-hp"></div>` +
        `</div>`;
      // Slot 0 before the clock, every opponent after it — which at two fighters is the
      // old declaration order (player, clock, enemy) exactly. Above two, the opponents
      // go INTO the rail instead, so the grid sees three children and not n+1.
      if (i === 0) topbarEl.insertBefore(plate, clockEl);
      else if (chipsEl) chipsEl.appendChild(plate);
      else topbarEl.appendChild(plate);

      const float = document.createElement('div');
      float.className = `hud-float hud-float--${mod}`;
      float.dataset.el = `float-${key}`;
      float.innerHTML =
        `<div class="hud-float-pill">` +
          `<div class="hud-float-emoji" data-el="float-${key}-emoji"></div>` +
          `<div class="hud-float-bar"><div class="hud-float-fill" data-el="float-${key}-fill"></div></div>` +
        `</div>`;
      // ⚠️ `radarEl.parentElement`, NOT `root`. The template's outermost element is
      // `.hud-root`, so the radar is `root`'s GRANDchild and `root.insertBefore(…, radarEl)`
      // throws `NotFoundError: the node before which the new node is to be inserted is not
      // a child of this node` — inside `createHud`, i.e. the match screen never mounts and
      // `__gameReady` never fires. Caught by `np_dbg.mjs` on the first overlay run.
      radarEl.parentElement!.insertBefore(float, radarEl);

      const blip = document.createElement('div');
      blip.className = `hud-radar-dot hud-radar-dot--${mod}`;
      blip.dataset.el = `radar-${key}`;
      // Opponents first, the local dot last, so nothing can paint over "where am I".
      if (i === 0) radarMapEl.appendChild(blip);
      else radarMapEl.insertBefore(blip, radarMapEl.querySelector('.hud-radar-dot--player'));

      fighterSlots.push({
        name: plate.querySelector(`[data-el="${key}-name"]`)!,
        emoji: plate.querySelector(`[data-el="${key}-emoji"]`)!,
        bar: plate.querySelector(`[data-el="${key}-bar"]`)!,
        fill: plate.querySelector(`[data-el="${key}-fill"]`)!,
        hpText: plate.querySelector(`[data-el="${key}-hp"]`)!,
        float,
        floatEmoji: float.querySelector(`[data-el="float-${key}-emoji"]`)!,
        floatFill: float.querySelector(`[data-el="float-${key}-fill"]`)!,
        blip,
      });
    }
  }

  // Built at `MIN_FIGHTERS` up front rather than waiting for `setCharacters`, so no
  // caller order can leave `update()` looking at a HUD with no health bars in it —
  // which is what a lazily-built one would do if anything ever rendered a frame
  // between construction and the roster being known.
  buildFighterSlots(2);

  // ── Mute indicator ─────────────────────────────────────────────────────────
  // Driven off `audio.onChange` rather than off the keypress, which is the whole
  // point: this reflects the ENGINE's state, so it is correct no matter who changed
  // it — the M hotkey, a future settings screen, or the mute persisted in
  // localStorage from a previous session. `audio/index.ts` recommends exactly this
  // pattern for the same reason.
  //
  // Muted is LATCHED, not a toast: it is a state you can sit in for a whole match and
  // then wonder why the game is silent. Unmuting only needs the transient
  // confirmation, so that one clears itself.
  let muteTimer = 0;
  let mutedShown: boolean | null = null;
  function renderMute(): void {
    const m = audio.isMuted();
    if (m === mutedShown) return;
    const first = mutedShown === null;
    mutedShown = m;
    window.clearTimeout(muteTimer);
    if (m) {
      muteEl.innerHTML = icon('mute') + '<span>MUTED · M</span>';
      muteEl.classList.add('is-on');
      muteEl.classList.remove('is-ok');
      return;
    }
    // Nothing to confirm on the very first paint of an unmuted session — that would
    // put a "sound on" badge on screen at the start of every single match.
    if (first) { muteEl.classList.remove('is-on', 'is-ok'); return; }
    muteEl.innerHTML = icon('sound') + '<span>SOUND ON · M</span>';
    muteEl.classList.add('is-on', 'is-ok');
    muteTimer = window.setTimeout(() => muteEl.classList.remove('is-on', 'is-ok'), 1500);
  }
  const offAudio = audio.onChange(renderMute);
  renderMute();

  // Pooled floating damage/heal numbers — pre-created once, cycled round-robin, so
  // spawning one on every hit never allocates a DOM node.
  const DMG_POOL_SIZE = 24;
  const dmgPool: HTMLDivElement[] = [];
  let dmgCursor = 0;
  for (let i = 0; i < DMG_POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'hud-dmg';
    dmgLayer.appendChild(el);
    dmgPool.push(el);
  }

  function hexToRgba(hex: string, alpha: number): string {
    const c = hex.replace('#', '');
    const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c;
    const r = parseInt(full.slice(0, 2), 16) || 0;
    const g = parseInt(full.slice(2, 4), 16) || 0;
    const b = parseInt(full.slice(4, 6), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  gameoverBtn.addEventListener('click', () => callbacks.onRestart());

  let playerCharId: CharacterId | null = null;
  let weaponSlots: WeaponSlotEls[] = [];

  function buildWeaponSlots(weapons: Weapon[]): void {
    weaponsEl.innerHTML = '';
    weaponSlots = weapons.map((w, i) => {
      const slot = document.createElement('div');
      slot.className = 'hud-weapon-slot';
      slot.innerHTML = `
        <div class="hud-weapon-cooldown"></div>
        <div class="hud-weapon-emoji">${abilityIcon(w.emoji)}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${i + 1}</div>
      `;
      // `pointerdown`, not `click`: a tap has to register on the way DOWN in a fight,
      // and this one listener covers finger, pen and mouse without the touch/mouse
      // double-fire a `touchstart` + `click` pair would produce. Bound once per match
      // when the slots are built, never per frame.
      slot.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        callbacks.onSelectWeapon?.(i);
      });
      weaponsEl.appendChild(slot);
      return {
        root: slot,
        cooldown: slot.querySelector<HTMLDivElement>('.hud-weapon-cooldown')!,
        timer: slot.querySelector<HTMLDivElement>('[data-role="timer"]')!,
        wasReady: true,
      };
    });
  }

  /** HP/second the closing fog deals, printed on the danger readout so the threat is
   * a number the player can weigh, not a vague warning. Derived from `rules.ts`. */
  const FOG_DPS = Math.round((FOG_DAMAGE / FOG_TICK_MS) * 1000);

  /**
   * How long before the edge arrives the zone pill starts its alarm.
   *
   * ## Why this is a DISTANCE converted to time, and not a time
   *
   * It used to be a flat 12 s, and the comment beside it justified that as "roughly
   * 57 wu of grace" — true only at the 180 s clock's 4.9 wu/s sweep. The clock is now
   * 45 s and `MAX_SAFE_RADIUS` derives from it, so the edge sweeps 22.1 wu/s and the
   * same 12 s buys **265 wu**. Two things go wrong at once at that size:
   *
   *  1. It cries wolf. ⚠️ THE ARITHMETIC HERE WAS THE 1x MAP'S AND IS KEPT BECAUSE IT
   *     IS WHY THE RULE BELOW EXISTS:
   *
   *       > *"265 wu of a 993 wu opening ring is most of the standing positions inside
   *       > it, so the alarm animation would be running for a large share of every
   *       > match."*
   *
   *     The arena went x4 on 2026-08-11, so the ring opens at 1985 wu and sweeps at
   *     44.1 wu/s — a flat 12 s now buys **529 wu**, and the share is 13.4% of the
   *     opening radius rather than 26.7%. The number moved; the conclusion did not,
   *     because 12 s of alarm is a quarter of a 45 s match whatever the radius is.
   *     `docs/LESSONS.md` §9: a warning which cries wolf gets ignored, which is worse
   *     than no warning.
   *  2. It warns about something INVISIBLE. The camera guarantees the player sees
   *     `FAIR_PLAY.radiusUnits` (199.2 wu) in every direction and no more. At 265 wu
   *     the pill would be flashing about a curtain that is off screen and stays off
   *     screen for another three seconds — the HUD and the world disagreeing, which
   *     is exactly the failure `tools/arena-scan.mjs` exists to catch.
   *
   * So: alarm when the edge crosses into the radius the player is GUARANTEED to be
   * able to see, which makes the pill and the 3D curtain say the same thing at the
   * same moment. Capped at the old 12 s, because on a long clock that distance is
   * 40 s away and an alarm running for a fifth of a match is the cry-wolf failure
   * again from the other end. Both terms are derived; neither is a magic number.
   *
   * ⚠️ **THE WORKED EXAMPLE BELOW WAS RE-EVALUATED ON 2026-08-11 AND BOTH OLD ROWS ARE
   * KEPT, BECAUSE THEY ARE THE HISTORY OF ONE DERIVED NUMBER MOVING TWICE:**
   *
   *   > *"45 s clock:   199.2 / (993/45000)  = 9.0 s"*
   *   > *"180 s clock:  199.2 / (890/180000) = 40.3 s -> capped to 12 s (unchanged)"*
   *
   * The x4 arena doubled the opening radius again, so the current row is:
   *
   *   45 s clock, x4 map:  199.2 / (1985/45000) = 4.5 s
   *
   * **The alarm now has half the lead it had, and that is the schedule's doing, not a
   * retune** — the edge sweeps 44.1 wu/s instead of 22.1, so the same guaranteed-visible
   * 199.2 wu is crossed in half the time. Nothing here is pinned: both terms are read at
   * run time, which is exactly why this comment could go stale while the code stayed right.
   */
  function imminentMs(maxR: number): number {
    const shrinkPerMs = maxR / MATCH_DURATION_MS; // world units of radius per ms
    if (shrinkPerMs <= 0) return 0;
    return Math.min(12_000, FAIR_PLAY.radiusUnits / shrinkPerMs);
  }

  /**
   * Everything the zone readouts need, derived from the sim state alone.
   *
   * `sim.ts` shrinks the ring as
   *   `safeRadius = max(MIN_SAFE_RADIUS, maxSafeRadius * (1 - matchProgress))`
   * — a continuous linear close with a FLOOR, not the stepped "next circle" of a
   * battle royale. So there is no "next shrink" to count down to; the useful number is
   * when the edge will sweep over WHERE THE PLAYER IS STANDING, which inverts that
   * formula. If the schedule in `sim.ts` ever stops being linear in time, this
   * inversion has to change with it.
   *
   * ⚠️ The floor is why `holds` exists. `MIN_SAFE_RADIUS` arrived with the 45 s clock,
   * and it means the edge STOPS. For anyone standing inside the final ring the naive
   * inversion `(safeRadius - dist) / shrinkPerMs` keeps returning a positive number
   * forever: a countdown that never reaches zero and describes an event that never
   * happens. Detect it and say so instead.
   */
  function zoneInfo(state: MatchState): {
    outside: boolean;
    radius01: number;
    /** ms until the edge reaches the player's current spot; null once outside. */
    msUntilEdge: number | null;
    /** The ring's floor is outside the player: the edge will never reach them. */
    holds: boolean;
    /**
     * `DECISIONS §2` sudden death is running: the safe radius is ZERO, so there is no
     * inside, nobody can get to safety, and the match resolves on HP.
     *
     * Derived from `timeRemaining` through `rules.ts:suddenDeathActive` rather than
     * inferred from `safeRadius === 0`, because those are different claims: a radius
     * that happens to read zero could be a rounding artefact or a QA station, while the
     * predicate is the sim's own switch and is the thing the copy below is about.
     */
    sudden: boolean;
  } {
    const maxR = state.arena.maxSafeRadius;
    // THE LOCAL SEAT, not "the player" — the zone readout is one client's answer to
    // "am I in the fog", so it is a `roster.ts:LOCAL_SLOT` question by construction.
    const me = localFighter(state);
    const dist = Math.hypot(me.x - state.arena.center.x, me.y - state.arena.center.y);
    const outside = dist > state.safeRadius;
    const shrinkPerMs = maxR / MATCH_DURATION_MS; // world units of radius per ms
    // ⚠️ `ringFloorFor(n, t)`, NOT `MIN_SAFE_RADIUS`. TWO rules moved under this line and
    // it followed neither, and they broke it in OPPOSITE directions — which is why the
    // fix is one function call and not one adjusted constant:
    //
    //   * SUDDEN DEATH (`f87d407`) drops the floor to **0**. The old test `dist <= 140`
    //     therefore still returned TRUE for anyone within 140 wu of the centre, so the
    //     pill read "FINAL RING" — *the edge will never reach you* — **while the fog was
    //     burning them at 50 HP/s.** This is the dangerous direction: a readout that
    //     actively contradicts the damage the player is taking.
    //   * THE SEAT-COUNT FLOOR (`4bb64e4`) raises it to 187.42 at N=5 and **237.00 at
    //     N=6**. There the old test returned FALSE for 140 < dist <= floor, so those
    //     fighters got "REACHES YOU 0:07" — a countdown to an arrival that never
    //     happens, which is the exact defect the comment above says `holds` exists to
    //     prevent. Quieter, and still a lie.
    //
    // `ringFloorFor` is the one place both rules live. Nothing here may re-derive them.
    const holds = dist <= ringFloorFor(state.fighters.length, state.timeRemaining);
    return {
      outside,
      holds,
      sudden: suddenDeathActive(state.timeRemaining),
      radius01: maxR > 0 ? Math.max(0, Math.min(1, state.safeRadius / maxR)) : 0,
      msUntilEdge:
        outside || holds || shrinkPerMs <= 0 ? null : (state.safeRadius - dist) / shrinkPerMs,
    };
  }

  /**
   * The lowest screen Y a floating name+HP pill is allowed to reach.
   *
   * ── The defect ──────────────────────────────────────────────────────────────
   * `updateFloatingBars` places each pill at its fighter's PROJECTED position with no
   * bound, and `match.ts` projects a fighter that is off the top of the frame to a
   * negative-or-small Y. The pill then lands in the top bar. Measured mid-fight by
   * `tools/tmp/hud_accept.mjs`: the enemy pill overlapped `.hud-clock` on 3 of 5
   * viewports, by up to **2,010 px²** at tablet-4:3 — a solid plate drawn straight
   * over the match timer — plus 398 px² over the enemy's own corner health bar. It is
   * visible in `shots/hud/r0/phone-danger.png`, where a "-15 ZONE" damage number and
   * the enemy pill together erase "0:13" completely.
   *
   * ── Why a floor and not a hide ──────────────────────────────────────────────
   * A fighter above the top of the frame is precisely when their HP matters most, and
   * the corner nameplate is a long way from where you are looking. Clamping keeps the
   * pill horizontally over the fighter (so it still reads as "they are up there") and
   * only refuses the one band the top bar owns.
   *
   * ── Why it is cached ────────────────────────────────────────────────────────
   * This runs once per fighter per FRAME. `getBoundingClientRect()` forces layout, so
   * it is read only when the viewport dimensions change — `innerWidth`/`innerHeight`
   * are plain reads and do not. There is no resize hook on `Hud` to hang it off, and
   * inventing one would put the same read on a path that has no other reason to exist.
   *
   * ⚠️ ...AND THE VIEWPORT IS NO LONGER THE ONLY INPUT. The cache key gained the SEAT
   * COUNT, because the bar's height now depends on it: the chip rail wraps when its
   * column cannot hold it, so the same viewport measures 102px at two seats and 141px
   * at six (390 wide, measured). Before the rail existed the bar was one row at every
   * count and the count could not matter — which is exactly why keying only on the
   * viewport was correct then and is a stale-cache bug now. A restart at a different
   * size never resizes the window, so nothing else would have invalidated it.
   */
  const FLOAT_HALF_W = 56;
  let floatFloor = 0;
  let floatFloorW = -1;
  let floatFloorH = -1;
  let floatFloorN = -1;
  function floatFloorY(): number {
    if (window.innerWidth !== floatFloorW || window.innerHeight !== floatFloorH
      || fighterSlots.length !== floatFloorN) {
      floatFloorW = window.innerWidth;
      floatFloorH = window.innerHeight;
      floatFloorN = fighterSlots.length;
      // + the pill's own height, because the transform anchors its BOTTOM edge
      // (`translate(-50%, -100%)`), plus clearance so it does not kiss the bar.
      // 36 = 28 + 8. The pill is 28px tall by construction — an 18px emoji well (the
      // taller of the well and the 12px bar), 6px of vertical padding, 4px of border —
      // and the first attempt at 30 left it 1px² over `.hud-clock` at desktop, which
      // the acceptance battery duly reported. Written as the sum so the next person to
      // change `.hud-float-pill`'s padding knows which term to move.
      const bottom = topbarEl.getBoundingClientRect().bottom;
      floatFloor = bottom + 36;
      // ── ...and the same boundary, published to CSS for the damage layer ──────
      // Clamping a damage number's SPAWN point is not enough on its own: the rise
      // animation carries it 68px up and 76% of its own height further, so a number
      // that starts legally still ends on the clock. Clipping the layer is what makes
      // "nothing is ever drawn over the match timer" a property of the HUD instead of
      // a property of where the fighters happen to be — and it costs only the tail of
      // an animation that is already at opacity 0 by then. See .hud-dmg-layer.
      dmgLayer.style.setProperty('--fa-dmg-top', `${Math.max(0, Math.round(bottom + 2))}px`);
      // ── ...and the SAME boundary again, for anything that has to sit BELOW the bar ──
      // 🚨 THE TOUCH RADAR'S `top` WAS A CONSTANT DERIVED FROM AN ASSUMED BAR HEIGHT, AND
      // THE CHIP RAIL BROKE THAT ASSUMPTION. On a real phone `html.fa-touch-capable` moves
      // the radar into the TOP-RIGHT corner at `safe-t + 96px` (118 below 400px wide) —
      // numbers whose own comment says they were "chosen against a clock column that ended
      // around y=90". Above two seats the rail grows from that same corner and wraps when
      // its column cannot hold it, and then the bar is 141px tall at 390 and 229px at 360.
      // Measured by `h49_chips --touch` before this line existed: the rail overlapped
      // `.hud-radar` at ALL THREE portrait widths `menu_accept_portrait` covers, and at
      // none of them in the plain DOM state — i.e. exactly the state no probe was looking
      // at. Publishing the bar's real bottom lets the rule below derive instead of assume.
      hudRootEl.style.setProperty('--fa-topbar-b', `${Math.max(0, Math.round(bottom))}px`);
    }
    return floatFloor;
  }

  /** Half the width of "RUN TO THE ZONE". Measured once, and again on a resize —
   *  see the clamp in renderZone. 0 = not measured yet. */
  let arrowLabelHalfW = 0;

  function renderZone(state: MatchState, frame: HudFrameInfo): void {
    const live = state.phase === 'playing';
    const info = zoneInfo(state);
    const danger = live && info.outside && localFighter(state).alive;
    // Gated on `live` for the same reason `danger` is: `timeRemaining` stays inside the
    // sudden-death window after the match ends, and the result card is drawn over this
    // HUD, so an ended match must not keep shouting a live instruction underneath it.
    const sudden = live && info.sudden;
    const maxR = state.arena.maxSafeRadius;

    // ── THIS LINE WAS MISSING, AND THREE CSS RULES WAITED ON IT ────────────────
    // `.hud-zone.is-danger` authors the alarm state for this pill — the violet plate,
    // the 0.6 s pulse, a WHITE 11px label and a pink value. Nothing ever added the
    // class. `radarEl` got `is-danger` and `fogEdgeEl` got `is-on` twenty lines below,
    // and the pill they sit beside was left in its calm styling while reading
    // "▲ OUTSIDE THE ZONE −50 HP/s". Measured at all five viewports by
    // `tools/tmp/hud_accept.mjs` before this landed: `zoneDanger: false`, 5 of 5.
    //
    // docs/LESSONS.md section 1 — "it isn't there" means it IS there and INVISIBLE,
    // seventeen times. This is the variant where the STATE, not the element, never
    // reaches the screen: every pixel of the styling exists and no input ever selects
    // it. Nothing in the type system, the sim tests or a screenshot of the calm state
    // can see that, which is why the acceptance battery now asserts, per viewport,
    // that a state the game is definitely IN has actually been applied to the DOM.
    zoneEl.classList.toggle('is-danger', danger);
    zoneEl.classList.toggle('is-imminent', !danger && info.msUntilEdge !== null && info.msUntilEdge < imminentMs(maxR));
    zoneBarEl.style.width = `${(info.radius01 * 100).toFixed(1)}%`;

    if (sudden) {
      // ── 🚨 SUDDEN DEATH: THE HUD WAS INSTRUCTING THE PLAYER TO DO SOMETHING THAT
      //    DOES NOT EXIST ────────────────────────────────────────────────────────
      // Uri, `DECISIONS §2`: *"after 30 seconds reduce the fog to all screen and the one
      // who has more HP wins. (Sudden Death)"*. `f87d407` shipped it, and when it fires
      // `SUDDEN_DEATH_RADIUS` is **0**: there is no inside, every fighter is outside, and
      // everyone burns. The three readouts below all kept their normal wording, so the
      // screen said "OUTSIDE THE ZONE", "GET INSIDE" and "RUN TO THE ZONE" — three
      // instructions to reach a place that no longer exists, plus a chevron pointing at
      // it. That is worse than saying nothing: it spends the player's last seconds on an
      // errand while the thing that decides the match is their HP bar.
      //
      // It is rare and decisive, which is the combination that most needs explaining:
      // **5.0% of matches at N=2** over an 880-match census, **31 of 44 ending on the
      // collapse tick itself**, and the HP leader took **43 of 43** decided. A player
      // meets this once and has to be able to tell what happened.
      //
      // So the copy states the two facts that are true and actionable, in the order the
      // player needs them: WHAT is happening, then HOW it resolves. It deliberately does
      // NOT print the burn rate — that is universal now, so it is no longer a reason to
      // move, and "MOST HP WINS" is the only line here that changes what a player does.
      //
      // WIDTH, against this pill's documented budget (136px of content at <=720, where
      // the longest shipped runs are "REACHES YOU 0:06" at 124px/12.5px and
      // "OUTSIDE THE ZONE" at 115px/10px): both new runs are SHORTER in glyph count than
      // the run they replace at the same size, so neither can become the new binding
      // constraint. Measured rendered rather than assumed — see the commit message.
      // ⚠️ NO LEADING GLYPH, unlike "▲ OUTSIDE THE ZONE" — and that is a deliberate
      // break from the pattern beside it. `ft_glyphs` measured this project's loaded
      // faces drawing **0 of 44** candidate symbols (▲, ⚙, ✓, ⭐, 🏆 all fall through to
      // the platform font), so a skull here is whatever the DEVICE decides: monochrome
      // on the desktop this was authored on, a full-colour emoji on the phone that
      // actually meets it. Read at 667x375 it looked like a padlock. The words plus the
      // pill's own alarm styling — violet plate, 0.6 s pulse, white 11px label — carry
      // the state without betting on a codepoint nothing here ships a glyph for.
      zoneLabelEl.textContent = 'SUDDEN DEATH';
      zoneValueEl.textContent = 'MOST HP WINS';
    } else if (danger) {
      zoneLabelEl.textContent = '\u25B2 OUTSIDE THE ZONE';
      zoneValueEl.textContent = `−${FOG_DPS} HP/s`;
    } else {
      // ── Deliberately NOT the words "SAFE ZONE" ──────────────────────────────
      // A whole-arena scan found this pill landing inside the boiling pot's danger
      // ring at pot_south framing: a label reading SAFE, drawn over the one patch of
      // floor that kills you. The critic's read was that a player under pressure
      // would route around the place they are supposed to stand.
      //
      // Two changes answer it, and neither moves the pill (its position is earned —
      // it sits under the clock because the safe radius IS a function of time
      // remaining, so the two are one column of the same number):
      //
      //  1. This readout is about the SCHEDULE, not about the ground beneath it. It
      //     now says when the edge arrives and never asserts that anywhere is safe.
      //     The radar keeps the words SAFE ZONE, because the radar labels a PLACE —
      //     the cream disc on the map — and that label is true there.
      //  2. The plate is opaque (see the CSS). At 78% alpha the hazard ring showed
      //     THROUGH the pill, so both meanings occupied the same pixels; an opaque
      //     plate occludes instead, and the superposition cannot happen at all.
      zoneLabelEl.textContent = 'ZONE CLOSES';
      // Shown during the countdown too, not just while playing: the ring's schedule is
      // already fixed then, so previewing "how long this spot stays safe" is honest,
      // and it beats a phase-dependent placeholder that teaches the player nothing.
      //
      // Wording matters here and was changed after a blind critic read the first
      // version, "closes on you 0:08", as genuinely ambiguous English — it can mean
      // "the ring is closing toward you" or "the ring closes in 8 seconds", and a
      // player who does not already understand the mechanic cannot tell which.
      // "REACHES YOU 0:08" states the relationship to the player and has one reading.
      //
      // "FINAL RING" is the `holds` case: the player is standing inside the ring's
      // floor, so the edge is never going to arrive and a countdown would be a lie.
      // It reports where they are standing relative to the SCHEDULE and still makes
      // no claim about the ground — a hazard can sit in the final ring, and one does
      // (the pot is on the arena centre).
      zoneValueEl.textContent = info.msUntilEdge !== null
        ? `REACHES YOU ${formatTime(info.msUntilEdge)}`
        : info.holds
          ? 'FINAL RING'
          : 'CLOSING';
    }

    // ── Radar ────────────────────────────────────────────────────────────────
    //
    // ## The card is a window on MORE WORLD THAN THE ARENA, and it has to be
    //
    // The obvious mapping — card rectangle == arena rectangle — is what this widget
    // used to do, and it made the radar carry NO zone information for most of every
    // match. The reason is structural, not a tuning slip:
    //
    //   arena/shared.ts derives  MAX_SAFE_RADIUS = halfDiagonal / (1 - tContact/T)
    //
    // That is DELIBERATELY larger than the arena's own half-diagonal, so the corners
    // are not inside lethal fog from t=0 (they used to be, permanently). Which means
    // the opening circle always STRICTLY CONTAINS the playfield. Mapped card==arena,
    // it was 142% of the box wide at t=0 and stayed >=100% until t=13.3s of a 45s
    // match. Measured on rendered pixels: the widget was a FLAT CREAM RECTANGLE whose
    // classified pixels did not change AT ALL between t=0 and t=6s, and the zone edge
    // was still off the card at t=0, t=6s AND t=11.3s — against a mean match length
    // of 19.6s. Clamping the disc to 100% does not fix that; a clamped disc is still
    // a flat rectangle.
    //
    // And it gets worse, not better, as the clock shortens and as the map grows.
    // ⚠️ THIS SENTENCE STOPPED AT THE SECOND OF THREE VALUES AND IS KEPT AS WRITTEN:
    //
    //   > *"T went 180s -> 45s this session and MAX_SAFE_RADIUS is derived from T, so the
    //   > opening ring grew 890 -> 993 wu."*
    //
    // The x4 arena (2026-08-11) doubled the half-diagonal the radius derives from, so the
    // full sequence is 890 -> 993 -> 1985 wu. Nothing below is allowed to hardcode ANY of
    // the three, which is the only reason this comment ageing three times cost nothing.
    //
    // So: zoom out until the boundary is on the card, and draw the arena's own
    // rectangle inside the fog field. What the player then reads is the DANGER
    // closing in from outside the map — which is the thing they need, and the thing
    // that is still true when the safe circle is bigger than the map.
    //
    // ## Sizing the window
    //
    // Horizontally, fit the whole zone circle (plus a small margin) so the boundary
    // is always on the card. Vertically, fit only the ARENA: fitting the circle on
    // the short axis too would need a ~1.4x wider window again and would shrink the
    // playfield to under half the card for a signal that is already carried by the
    // left/right edges and the corners. Early in a match the disc's top and bottom
    // arcs therefore run off the card — that is the deliberate trade, and the +x edge
    // is on-card at every instant of every clock.
    //
    // The card's ASPECT is pinned to the arena's in CSS (152x109 for 1400x1000), so
    // the world window is given that same aspect and the safe circle stays a circle.
    const aw = state.arena.width;
    const ah = state.arena.height;
    const cx = state.arena.center.x;
    const cy = state.arena.center.y;
    const cardAspect = aw / ah;
    // Half-extents the window must cover, measured from the FOG's centre (which is
    // not required to be the arena rectangle's centre).
    const needHalfW = Math.max(maxR, cx, aw - cx) * (1 + RADAR_MARGIN);
    const needHalfH = Math.max(cy, ah - cy) * (1 + RADAR_MARGIN);
    const worldW = Math.max(2 * needHalfW, 2 * needHalfH * cardAspect);
    const worldH = worldW / cardAspect;
    // World point -> percentage across the card. The window is centred on the fog's
    // centre, so that point is 50%/50%.
    const wx = (x: number) => `${(50 + ((x - cx) / worldW) * 100).toFixed(2)}%`;
    const wy = (y: number) => `${(50 + ((y - cy) / worldH) * 100).toFixed(2)}%`;
    const spanW = (v: number) => `${((v / worldW) * 100).toFixed(2)}%`;
    const spanH = (v: number) => `${((v / worldH) * 100).toFixed(2)}%`;

    radarSafeEl.style.left = wx(cx);
    radarSafeEl.style.top = wy(cy);
    radarSafeEl.style.width = spanW(state.safeRadius * 2);
    radarSafeEl.style.height = spanH(state.safeRadius * 2);

    // The playfield rectangle, over the disc. Width and height are set from the SAME
    // window as the disc, so "the ring has reached the wall" is something the widget
    // shows geometrically instead of asserting in words.
    radarArenaEl.style.left = wx(aw / 2);
    radarArenaEl.style.top = wy(ah / 2);
    radarArenaEl.style.width = spanW(aw);
    radarArenaEl.style.height = spanH(ah);

    // ⚠️ SURFACE 1 OF 3. The blip is the purest position leak on the screen — it reports
    // a fighter's exact coordinates on a map with no occlusion at all, so shipping
    // concealment without this makes the mechanic read as BROKEN: you hide, the AI
    // demonstrably loses you, and your own radar keeps tracking it perfectly. Uri,
    // `docs/DECISIONS-FOR-URI.md` §30: *"plates and other kitchen objects you can hide
    // under — fully hidden"* — blip, HP bar AND model, not the half-measure.
    //
    // `alive` still gates it independently: a dead fighter is hidden whether or not it
    // died inside a region, which is the pre-existing rule and is not concealment's to
    // change.
    //
    // ⚠️ THE LOCAL SLOT IS GATED ON `alive` ALONE and never on visibility — see this
    // file's header. The predicate would in fact answer `true` for a fighter asked about
    // itself, but relying on that would make "you can always see yourself" an emergent
    // property of `isVisibleFrom`'s distance test rather than a stated rule.
    const observer = localFighter(state);
    // Indexed by POSITION in the list, not by `f.id`: a duck-typed instrument state has
    // fighters with no `id` on them at all (see `roster.ts`), and `fightersOf` returns
    // them in slot order either way.
    fightersOf(state).forEach((f, i) => {
      const dot = fighterSlots[i]?.blip;
      if (!dot) return;
      dot.style.left = wx(f.x);
      dot.style.top = wy(f.y);
      dot.style.display =
        i === LOCAL_SLOT
          ? (f.alive ? 'block' : 'none')
          : (f.alive && fighterVisibleTo(state, observer, f) ? 'block' : 'none');
    });
    radarEl.classList.toggle('is-danger', danger);
    // "GET INSIDE" is an instruction; during sudden death there is no inside to get to,
    // so the cap names the STATE instead. It stays a shrink-to-fit pill: 12 glyphs at
    // 9px/800 against "GET INSIDE"'s 10, inside a 105px card at <=720 — measured, not
    // assumed, because this pill has no width of its own to clip against.
    radarCapEl.textContent = sudden ? 'SUDDEN DEATH' : danger ? 'GET INSIDE' : 'SAFE ZONE';

    // ── Danger vignette + chevron ────────────────────────────────────────────
    fogEdgeEl.classList.toggle('is-on', danger);
    // 🚨 AND THE CHEVRON IS THE WORST OF THE THREE, SO IT IS REMOVED OUTRIGHT.
    // The label and the cap were merely wrong words; this is a 140px arrow pointing at a
    // safe zone of radius ZERO. `match.ts` computes it from the direction to the arena
    // centre, which stays a perfectly well-defined direction after the ring collapses —
    // so it keeps drawing, confidently, at a destination that cannot help. Hiding it is
    // the honest answer: there is no direction to run, and the copy above says so.
    const arrow = danger && !sudden ? frame.safeArrow ?? null : null;
    if (arrow) {
      safeArrowEl.style.display = 'block';
      safeArrowLabelEl.style.display = 'block';
      const deg = (arrow.angleRad * 180) / Math.PI;
      safeArrowEl.style.transform =
        `translate(${arrow.at.x.toFixed(1)}px, ${arrow.at.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
      // The label rides PAST the chevron tip along the same direction, never at a
      // fixed screen offset: pinned below the player it collided with the arrow every
      // time safety happened to lie downward, which is a quarter of all cases.
      //
      // ...but 178px along an arbitrary direction from a player the camera holds at
      // frame centre puts it OFF SCREEN on a narrow viewport. Photographed at
      // 430x932: "RUN TO THE ZONE" rendered as "UN TO THE ZONE", clipped by the left
      // edge, in the one state where the HUD is shouting an instruction
      // (shots/hud/after1/after1-portrait-danger.png). Half the frame width there is
      // 215px against a 178px reach and an ~84px half-label, so it is not an edge
      // case — it is most directions.
      //
      // Clamped rather than shortened: the offset is what keeps the label off the
      // chevrons, so it stays at 178 wherever there is room and slides along the edge
      // where there is not.
      //
      // The half-width is measured off the element rather than assumed, and cached:
      // the text is a constant and no media query touches this rule, so its width does
      // not vary with the viewport. The `innerWidth` term is belt-and-braces for a font
      // that swaps in late, and it can legitimately miss a resize that happens while
      // the arrow is hidden — which is why the cache is a width and not a layout.
      if (arrowLabelHalfW === 0 || window.innerWidth !== floatFloorW) {
        arrowLabelHalfW = safeArrowLabelEl.offsetWidth / 2;
      }
      const pad = 8;
      const lx = Math.min(
        Math.max(arrow.at.x + Math.cos(arrow.angleRad) * 178, arrowLabelHalfW + pad),
        window.innerWidth - arrowLabelHalfW - pad,
      );
      const ly = Math.min(
        Math.max(arrow.at.y + Math.sin(arrow.angleRad) * 178, floatFloorY() + 4),
        window.innerHeight - 22,
      );
      safeArrowLabelEl.style.transform =
        `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -50%)`;
    } else {
      safeArrowEl.style.display = 'none';
      safeArrowLabelEl.style.display = 'none';
    }
  }

  /**
   * Draw the pointer-lock aim reticle.
   *
   * TWO elements, not one, and the split is what makes it read: a ring alone at a
   * fixed radius is ambiguous about what it belongs to (it could be a pickup, a
   * hazard tell, an enemy marker), while the stick joining it to the player's feet
   * states "this is YOUR facing" without a legend. The stick is drawn from the
   * player's projected ground point, so it also survives the camera's follow lerp
   * pulling the character off exact frame centre.
   */
  function renderAim(frame: HudFrameInfo): void {
    const aim = frame.aim ?? null;
    if (!aim) {
      aimStickEl.style.display = 'none';
      aimReticleEl.style.display = 'none';
      return;
    }
    const dx = aim.at.x - aim.from.x;
    const dy = aim.at.y - aim.from.y;
    const len = Math.hypot(dx, dy);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    aimStickEl.style.display = 'block';
    aimStickEl.style.width = `${len.toFixed(1)}px`;
    aimStickEl.style.transform =
      `translate(${aim.from.x.toFixed(1)}px, ${aim.from.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
    aimReticleEl.style.display = 'flex';
    aimReticleEl.style.transform =
      `translate(${aim.at.x.toFixed(1)}px, ${aim.at.y.toFixed(1)}px) translate(-50%, -50%)`;
  }

  return {
    setCharacters(ids) {
      buildFighterSlots(ids.length);
      playerCharId = ids[LOCAL_SLOT] ?? null;
      ids.forEach((id, i) => {
        const s = fighterSlots[i];
        if (!s) return;
        s.name.textContent = CHARACTERS[id].name;
        s.emoji.innerHTML = portraitMarkup(id, { crop: 'head' });
        s.floatEmoji.innerHTML = portraitMarkup(id, { crop: 'head' });
      });
      // The weapon tray is the LOCAL seat's, and only the local seat's — it is a
      // control surface, not a readout.
      if (playerCharId) buildWeaponSlots(CHARACTERS[playerCharId].weapons);
      // generate:false is load bearing. This runs at match start; standing up an
      // offscreen renderer here to make a 24px badge would be a hitch in a live
      // fight. Character select has already warmed the shared cache in every real
      // flow, so this is a cache read. See ui/icons/portraits.ts.
      hydratePortraits(root, { generate: false });
    },

    update(state, frame) {
      timerEl.textContent = formatTime(state.timeRemaining);

      fightersOf(state).forEach((f, i) => {
        const s = fighterSlots[i];
        if (!s) return;
        setBar(s.fill, s.hpText, f.hp, f.maxHp);
        // Danger pulse once a fighter's own bar reads critically low — a fast,
        // unmistakable "you are about to die" signal that doesn't depend on reading
        // the numeric text at all.
        const frac = f.maxHp > 0 ? f.hp / f.maxHp : 0;
        s.bar.classList.toggle('is-low', f.alive && frac <= LOW_HP_FRACTION);
      });

      if (playerCharId) {
        const weapons = CHARACTERS[playerCharId].weapons;
        const lastUsed = localFighter(state).lastUsed;
        weaponSlots.forEach((slot, i) => {
          const w = weapons[i];
          if (!w) return;
          const remaining = Math.max(0, w.cooldown - (state.elapsed - lastUsed[i]));
          const frac = w.cooldown > 0 ? Math.min(1, remaining / w.cooldown) : 0;
          slot.cooldown.style.setProperty('--p', frac.toFixed(3));
          const ready = frac <= 0;
          slot.root.classList.toggle('is-ready', ready);
          slot.root.classList.toggle('is-selected', i === frame.selectedWeapon);
          // Numeric countdown on top of the radial wipe — a lone dark wedge reads as
          // "slightly dimmed icon" at a glance, especially in a screenshot/still frame.
          // A literal "0.4" leaves zero ambiguity about whether a weapon is usable.
          slot.timer.textContent = ready ? '' : (remaining / 1000).toFixed(1);
          // One-shot "just became ready" flash on the rising edge only, never while
          // idle-ready — re-triggering the CSS animation the same reflow-forcing way
          // the pooled damage numbers do above.
          if (ready && !slot.wasReady) {
            slot.root.classList.remove('is-flash');
            void slot.root.offsetWidth;
            slot.root.classList.add('is-flash');
          }
          slot.wasReady = ready;
        });
      }

      renderZone(state, frame);
      renderAim(frame);

      if (state.phase === 'countdown') {
        countdownEl.style.display = 'flex';
        const showStart = state.countdownValue <= 0;
        countdownEl.textContent = showStart ? 'START!' : String(state.countdownValue);
        countdownEl.classList.toggle('is-start', showStart);
      } else {
        countdownEl.style.display = 'none';
      }

      if (state.phase === 'ended') {
        gameoverEl.style.display = 'flex';
        const roster = fightersOf(state);
        // The result card is the LOCAL seat's verdict, so "won" is "did MY slot win",
        // not "did slot 0 win". Identical today (they are the same slot) and it stops
        // being identical the moment a second human sits down.
        const winnerSlot = slotOf(state.winnerId ?? undefined, state.winner ?? 'player');
        const won = winnerSlot === LOCAL_SLOT;
        gameoverTitleEl.textContent = won ? 'VICTORY!' : 'DEFEAT!';
        gameoverTitleEl.classList.toggle('is-win', won);
        gameoverTitleEl.classList.toggle('is-lose', !won);

        const winnerFighter = roster[winnerSlot] ?? roster[0];
        const winnerChar = CHARACTERS[winnerFighter.characterId];
        // ── "defeated" is only true of a KNOCKOUT ─────────────────────────────
        // `sim.ts` ends a match that runs out of clock, and it does so WITHOUT a
        // death: `resolveTimeout` picks a winner on HP fraction, then zone control,
        // then the lower slot, and deliberately leaves every fighter `alive`. So a
        // timeout is exactly the case where nobody defeated anybody, and that is also
        // the case a player is most likely to want explained — they are looking at a
        // result screen with living fighters on it. Everybody still standing is the
        // tell, and it costs one pass over the roster.
        //
        // ⚠️ WAS `state.player.alive && state.enemy.alive`. `every` is the same
        // statement at two seats and the RIGHT one above two: a six-way that reaches
        // the clock with four survivors is a timeout, and the two-seat form would only
        // have asked about slots 0 and 1.
        const timedOut = roster.every((f) => f.alive);
        // ── THE LOSERS, IN FINISHING ORDER — AND THIS COMMENT USED TO SAY "IN SLOT
        //    ORDER", WHICH WAS THE DEFECT ─────────────────────────────────────────
        //
        // ⚠️ **KEPT ABOVE ITS REPLACEMENT BECAUSE IT WAS TRUE, AND WAS THE BUG:**
        //
        //   > *"The losers are everyone who is not the winner, in slot order. At two
        //   > fighters that list has exactly one entry and this markup is
        //   > character-for-character what the two-seat version emitted — which is the
        //   > whole acceptance test."*
        //
        // Every clause of that is correct and the conclusion is still the acceptance test.
        // What it missed is that "in slot order" is INVISIBLE at two seats — one loser is
        // one loser in any order — so a rule that is only wrong above two seats shipped
        // looking finished. `DECISIONS §64` measured it: a six-way read
        // `SUSHI defeated HAMBURGER DONUT TACO PIZZA EGG` **identically whether you came
        // 2nd or 6th**, and `resolvePlaces`' own numbers say slot order agrees with the
        // real order in 0.0% of six-seat matches.
        //
        // 🚨 THE ORDER IS VALIDATED AS A PERMUTATION, NOT INDEXED INTO HOPEFULLY. A list
        // that is short, has a duplicate or carries an out-of-range slot would silently
        // drop fighters OFF the card — a fighter vanishing from the result screen is a
        // worse defect than the one being fixed here, and it would be invisible at the
        // seat count everything else is tested at. Anything that is not a permutation of
        // this roster's slots falls back WHOLESALE to the old expression, which is the
        // line quoted above, unchanged.
        //
        // ⚠️ AT TWO SEATS THE TWO BRANCHES ARE THE SAME LIST, and that is proved rather
        // than asserted: `tools/tmp/rc_card.mjs` §A renders both arms through this exact
        // function over every reachable two-seat end state and compares `innerHTML` byte
        // for byte, with a `--arm shuffled` known-bad that goes red.
        const order = frame.order ?? null;
        const orderIsPermutation = order !== null
          && order.length === roster.length
          && order.every((s) => Number.isInteger(s) && s >= 0 && s < roster.length)
          && new Set(order).size === roster.length;
        const losers = (order && orderIsPermutation)
          ? order.filter((s) => s !== winnerSlot).map((s) => roster[s])
          : roster.filter((_, i) => i !== winnerSlot);
        // ── ONE VERB FOR EVERYBODY IS WRONG ABOVE TWO SEATS, AND §58 IS WHY ────────
        // `timedOut` is `roster.every(alive)`, so a single death anywhere makes the
        // whole line read "defeated" — and since sudden death collapses the ring at
        // 30 s and burns everyone at 50 HP/s, a six-way typically ends with SOME
        // fighters dead and SOME still standing at different HP. The card then claims
        // the winner "defeated" four people who are alive on the same screen.
        //
        // Split by the one fact the sim already publishes per fighter — `alive`. Nobody
        // is ranked here and nothing is inferred: a dead loser was defeated, a living
        // one was outlasted, and that is exactly what `f.alive` means.
        //
        // ⚠️ AT TWO SEATS THIS IS THE SAME MARKUP, CHARACTER FOR CHARACTER, and that is
        // the standing acceptance test rather than a nicety: one loser, either dead
        // (one "defeated" group, no "outlasted" group) or alive (the reverse), which is
        // precisely what `timedOut ? 'outlasted' : 'defeated'` emitted. `timedOut` is
        // still read below for the stats line, where it is the right question.
        const named = (f: { characterId: CharacterId }): string =>
          `<span class="hud-go-emoji">${portraitMarkup(f.characterId, { crop: 'head' })}</span>${CHARACTERS[f.characterId].name}`;
        const group = (verb: string, list: readonly typeof roster[number][]): string =>
          (list.length ? `<span class="hud-go-vs">${verb}</span>${list.map(named).join('')}` : '');
        gameoverSubtitleEl.innerHTML =
          named(winnerFighter)
          + group('defeated', losers.filter((f) => !f.alive))
          + group('outlasted', losers.filter((f) => f.alive));
        hydratePortraits(gameoverSubtitleEl, { generate: false });

        // ── The finishing place, when somebody upstream knows it ──────────────────
        // Absent today at every seat count, so this branch writes nothing and the
        // element stays `display: none` — the card is byte-identical to before. See
        // `HudFrameInfo.place` for why the HUD does not derive it.
        const place = frame.place ?? null;
        if (place && place.of > 1) {
          const n = place.place;
          const suffix = (n % 100 >= 11 && n % 100 <= 13) ? 'th'
            : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
          gameoverPlaceEl.textContent = `${n}${suffix} of ${place.of}`;
          gameoverPlaceEl.classList.toggle('is-podium', n <= 3);
          gameoverPlaceEl.style.display = 'block';
        } else {
          gameoverPlaceEl.textContent = '';
          gameoverPlaceEl.style.display = 'none';
        }

        const elapsedMs = Math.max(0, MATCH_DURATION_MS - state.timeRemaining);
        // On a timeout, say WHY. "Match time 0:45" alone reads as a knockout that
        // happened to take the whole clock, which is the one thing it is not. This
        // deliberately does NOT name the tiebreak: `resolveTimeout` runs three rungs
        // (HP fraction, then zone control, then the human), and a HUD that asserts
        // "decided on health" would be wrong on two of them and would have to be kept
        // in step with a rule it does not own.
        gameoverStatsEl.innerHTML = timedOut
          ? `${icon('timer')} Time up — no knockout`
          : `${icon('timer')} Match time ${formatDuration(elapsedMs)}`;

        // ── What the match paid ───────────────────────────────────────────────────
        // Absent unless somebody upstream banked a result and handed the numbers back,
        // so this branch writes nothing on any card that is not a real, banked match —
        // a QA `?fighters=` run, an instrument's detached HUD, or a restart. See
        // `HudFrameInfo.payout` for why the HUD may not produce these itself.
        const payout = frame.payout ?? null;
        if (payout) {
          // Signed on trophies and unsigned nowhere: 5th and 6th of six LOSE trophies
          // (-1 and -5 at 500), and a card that printed "5" for a five-trophy loss would
          // be the single most expensive lie this screen could tell. Coins and XP have no
          // negative branch in the economy, so their `+` is honest by construction.
          const chip = (name: string, value: number, suffix = ''): string =>
            `<span class="hud-go-pay">${icon(name)}<b>${value > 0 ? '+' : ''}${value}</b>${
              suffix ? `<i>${suffix}</i>` : ''}</span>`;
          gameoverPayoutEl.innerHTML =
            chip('trophy', payout.trophies)
            + chip('coin', payout.coins)
            // XP carries a LABEL and the other two do not, deliberately: a trophy and a
            // coin are self-evident from their own icon, and a star is not — it is the
            // one quantity here a player could read as a third currency.
            + chip('star', payout.xp, 'xp')
            + (payout.chests ? chip('chest', payout.chests) : '');
          gameoverPayoutEl.style.display = 'flex';
        } else {
          gameoverPayoutEl.innerHTML = '';
          gameoverPayoutEl.style.display = 'none';
        }
      } else {
        gameoverEl.style.display = 'none';
      }
    },

    updateFloatingBars(points, health01) {
      const floor = floatFloorY();
      const place = (el: HTMLElement, p: ScreenPoint): void => {
        // Clamped, not hidden. A fighter above the top of the frame is exactly when
        // you most want to know their HP, so the pill stays — it just stops at the
        // first row of the play area instead of climbing into the clock.
        const y = Math.max(p.y, floor);
        const x = Math.min(Math.max(p.x, FLOAT_HALF_W), window.innerWidth - FLOAT_HALF_W);
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      };
      fighterSlots.forEach((s, i) => {
        const p = points[i] ?? null;
        if (!p) { s.float.style.display = 'none'; return; }
        s.float.style.display = 'flex';
        place(s.float, p);
        const frac = Math.max(0, Math.min(1, health01[i] ?? 0));
        s.floatFill.style.width = `${(frac * 100).toFixed(1)}%`;
        s.floatFill.classList.toggle('is-low', frac > 0 && frac <= LOW_HP_FRACTION);
      });
    },

    spawnDamageNumber(point, amount, opts) {
      const el = dmgPool[dmgCursor];
      dmgCursor = (dmgCursor + 1) % dmgPool.length;
      const heal = !!opts?.heal;
      const big = amount >= 15;
      const medium = !big && amount >= 6;
      // Same clamp as the floating pills, for the same reason and one more. A fighter
      // above the top of the frame projects to a small or negative Y, and a 36px
      // "-15 ZONE" at weight 900 spawned there lands squarely on the match clock —
      // photographed at 844x390 in shots/hud/r0/phone-danger.png, where "0:13" is
      // completely gone. The layer's clip (see floatFloorY) stops the tail of the rise
      // from reaching the top bar; this keeps the BRIGHT part of the number on screen
      // rather than letting the clip eat all of it.
      const y = Math.max(point.y, floatFloorY());
      const x = Math.min(Math.max(point.x, 24), window.innerWidth - 24);
      el.style.setProperty('--x', `${x.toFixed(1)}px`);
      el.style.setProperty('--y', `${y.toFixed(1)}px`);
      el.textContent = heal
        ? `+${Math.round(amount)}`
        : `-${Math.round(amount)}`;
      const tint = heal ? ' hud-dmg--heal' : opts?.fog ? ' hud-dmg--fog' : '';
      el.className = `hud-dmg ${big ? 'hud-dmg--big' : medium ? 'hud-dmg--medium' : 'hud-dmg--small'}${tint}`;
      // Force a reflow between resetting the class and re-adding `is-playing` so the
      // CSS animation restarts even when this pooled element is reused mid-animation.
      void el.offsetWidth;
      el.classList.add('is-playing');
    },

    flashScreen(color) {
      screenflashEl.style.setProperty('--flash-color', hexToRgba(color, 0.42));
      screenflashEl.classList.remove('is-playing');
      void screenflashEl.offsetWidth;
      screenflashEl.classList.add('is-playing');
    },

    flashFogTick() {
      fogTickEl.classList.remove('is-playing');
      void fogTickEl.offsetWidth;
      fogTickEl.classList.add('is-playing');
    },

    dispose() {
      gameoverBtn.removeEventListener('click', () => callbacks.onRestart());
      window.clearTimeout(muteTimer);
      // The audio engine outlives the match, so a HUD that does not unsubscribe leaks
      // a closure onto a dead DOM tree for every match the player plays.
      offAudio();
      root.innerHTML = '';
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — bold, chunky, rounded, high-contrast. Matches the toy-brawler look of
// `reference/images/curated/gameplay/bs_01.png`: rounded pill health bars with a
// heavy dark border, a bright accent fill, and big Rubik-weight display type.
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
.hud-root {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 20;
  font-family: 'Heebo', sans-serif;
  color: #FFF3DE;
  user-select: none;
}

/* ── Top bar: player / timer / enemy ─────────────────────────────────────── */
/* Full-width scrim behind the whole top strip — guarantees the nameplates and
   timer stay readable no matter how bright or busy the arena floor gets under
   them (a bright kitchen tile, a lit hazard, a light character), independent of
   each element's own text-shadow. */
.hud-topbar-scrim {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, rgba(10,6,16,0.5), rgba(10,6,16,0));
}

/* Safe areas, on every edge the HUD touches. A landscape phone eats 44px of the
   leading edge to the notch and ~21px of the trailing bottom to the home indicator,
   and the viewport-fit=cover meta in index.html is what makes those readable. All of
   them carry a 0px fallback, so a desktop is pixel-identical to before. */
.hud-topbar {
  position: absolute;
  top: calc(var(--fa-safe-t, 0px) + 14px);
  left: calc(var(--fa-safe-l, 0px) + 14px);
  right: calc(var(--fa-safe-r, 0px) + 14px);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.hud-fighter {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  flex: 1 1 260px;
  max-width: 380px;
}
.hud-fighter--enemy { align-items: flex-end; }

/* Solid pill behind the name+portrait — belt-and-suspenders legibility on top of
   the topbar scrim above, so a single fighter name is never lost even if the
   camera happens to frame a bright prop right behind it. */
.hud-fighter-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(26,18,36,0.72);
  border: 2px solid rgba(26,18,36,0.9);
  border-radius: 999px;
  padding: 3px 12px 3px 4px;
  max-width: 100%;
}
.hud-fighter--enemy .hud-fighter-pill { padding: 3px 4px 3px 12px; }

.hud-fighter-emoji {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
}
.hud-fighter--player .hud-fighter-emoji { border: 2px solid #3FCB86; }
.hud-fighter--enemy .hud-fighter-emoji { border: 2px solid #E6493F; }
/* The badge used to hold a 16px emoji inside a 24px well. A rendered portrait fills
   the whole well instead, which is a 50% bigger picture in the same layout box and is
   the treatment every shipped brawler gives its fighter chips. */
.hud-fighter-emoji .fa-ic-portrait { width: 100%; height: 100%; vertical-align: top; }

.hud-fighter-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-shadow: 0 1px 0 #1a1224;
  -webkit-text-stroke: 0.5px rgba(26,18,36,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-healthbar {
  position: relative;
  width: 100%;
  height: 26px;
  background: #241a30;
  border: 3px solid #1a1224;
  border-radius: 999px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35);
  overflow: hidden;
}
.hud-healthbar-fill {
  position: absolute;
  inset: 2px;
  right: auto;
  border-radius: 999px;
  transition: width 0.15s ease-out;
  /* Glossy top highlight — a cheap but reliable "shipped" tell on a mobile-game
     health bar, versus a flat single-tone fill. */
  background-image: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 42%);
  background-blend-mode: overlay;
}
.hud-fighter--player .hud-healthbar-fill { background-color: #3FCB86; }
.hud-fighter--enemy .hud-healthbar-fill { background-color: #E6493F; }
/* ── The most-read number in the game, and it failed AA by the widest margin ──
   Cream #FFF3DE centred on the fill. Measured against THE PIXELS ACTUALLY BEHIND IT
   mid-fight, at five viewports (tools/tmp/hud_accept.mjs):

     over the player's green fill #3FCB86 ... 1.89   (AA needs 4.5)
     over the enemy's red fill    #E6493F ... 3.55

   1.89 was the worst text ratio anywhere in the HUD and it is on your own HP. It is
   also the ONLY text class in the HUD that failed — 20 of the 117 measured runs, all
   of them this one.

   ── Why the fix is a stroke and not a colour ────────────────────────────────
   This run is the one piece of HUD text whose backdrop CHANGES UNDER IT: the fill
   recedes as HP drops, so at 40% HP the same glyphs sit half on #3FCB86 (luma 0.455)
   and half on the #241a30 track (luma 0.013). No single ink wins both — cream is
   correct on the track and hopeless on the fill; a dark ink would be the exact
   reverse, and the bar would go unreadable at precisely the moment it matters.

   A stroke removes the backdrop from the question: with paint-order: stroke fill
   the glyph's paper is its own ink rim, so the ratio is cream vs #1a1224 = 12.02 on
   BOTH halves and at every HP value. That is the same mechanism .hud-dmg, the
   safe-zone chevron and the aim reticle already use, and the same one the menu pass
   used to take 65 AA failures to zero — "a pale mark on this arena needs an ACTUAL
   dark fill layer behind it".

   2px, not the 3px .hud-dmg uses: verified on a rendered crop at 12px/800 rather
   than assumed, because a stroke that closes the counters is a legibility LOSS that
   a stroke-aware contrast model would happily score 12. The old soft 2px blur is gone
   — a blurred halo behind an opaque rim contributes nothing. */
.hud-healthbar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 12px;
  color: #FFF3DE;
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 1px 0 rgba(0,0,0,0.45);
  letter-spacing: 0.02em;
}

/* Danger pulse: an unmistakable "you are about to die" cue that reads instantly,
   without parsing the numeric text — a fast red glow breathing around the bar. */
.hud-healthbar.is-low {
  animation: hud-lowhp-pulse 0.7s ease-in-out infinite;
}
@keyframes hud-lowhp-pulse {
  0%, 100% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35), 0 0 0 rgba(230,57,70,0); }
  50% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35), 0 0 14px 3px rgba(255,60,60,0.85); }
}

/* ── ABOVE TWO SEATS: local bar full size, opponents as chips ─────────────────
   DECISIONS 49f, Uri: "Local seat full, others as chips". See buildFighterSlots
   for the shape; this is the whole of the styling and NONE of it can reach a
   two-fighter match — every selector below is a descendant of, or is,
   .hud-topbar--chips / .hud-chips / .hud-fighter--chip, and none of those three
   strings appears in the DOM at n === 2.

   ⚠️ NOTE FOR ANYONE EDITING THIS BLOCK: THERE ARE NO BACKTICKS IN IT, ON PURPOSE.
   This whole sheet is a template literal, so one backtick in a CSS comment ends the
   string and the file stops parsing — which is exactly what the first draft of this
   block did, and it is the failure menu_accept.mjs's header already records as "the
   very next backtick to break hud.ts".

   ⚠️ PLACEMENT IS LOAD-BEARING AND IT IS THE CASCADE TRAP FROM THE OTHER SIDE.
   .hud-fighter--chip and .hud-fighter are BOTH (0,1,0), so between those two only
   source order decides — which is why this block sits AFTER .hud-fighter rather
   than beside it. In the other direction the specificity works FOR us and that is
   also deliberate: ".hud-fighter--chip .hud-healthbar" is (0,2,0) against the
   max-width:720px block's ".hud-healthbar" at (0,1,0), and a media query adds NO
   specificity — so a chip keeps its own height on a phone without this block having
   to restate itself inside every media query. The phone rules below still own
   everything they owned before, because none of them names a chip. */

/* The three columns. Two EQUAL 1fr side tracks are what centres the clock: it is
   centred by the grid, not by however much plate happens to sit either side, which
   is the property the flex row could not have at any plate width. 1fr and not
   minmax(0, 1fr) on purpose — a 0 minimum lets a wide rail overflow LEFTWARD over
   the clock, and an auto minimum makes it push the clock a few px instead, which is
   the failure that degrades rather than the one that collides. */
.hud-topbar--chips {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
}
/* FULL SIZE means literally the width it has in a 1v1, and it is measured that way
   (h49_chips compares n=6 against n=2 on the same viewport, and gets 100% at all
   three). No max-width here on purpose: the base .hud-fighter rule already caps at
   380px, and adding a second, smaller cap made the local bar 300px at 1280 against
   380px at two fighters — 79%, i.e. a squeeze of its own, which is the exact defect
   this section exists to remove. Below 380px of track the plate is bounded by the
   1fr column instead, which is the same arithmetic the flex row gave it. */
.hud-topbar--chips .hud-fighter--player {
  justify-self: start;
  width: 100%;
}
.hud-topbar--chips .hud-clock { justify-self: center; }

/* Right-aligned so the rail grows INWARD from the corner as seats are added — the
   last chip is always in the same place, which is what makes 3, 4 and 6 read as the
   same HUD. Wraps rather than squeezes: this whole section exists because squeezing
   was the failure, so the overflow behaviour must not be a squeeze either. A wrapped
   second row is picked up automatically by floatFloorY(), which reads the top bar's
   live bottom edge, so the floating pills and the damage-layer clip follow it. */
.hud-chips {
  justify-self: end;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.hud-fighter--chip {
  flex: 0 0 auto;
  width: 48px;
  max-width: none;
  align-items: center;
  gap: 3px;
}
/* A chip IS its portrait: the pill's plate and border are chrome around a 30px disc
   that already carries its own dark rim below, and drawing both put two concentric
   outlines on a 48px element. */
.hud-fighter--chip .hud-fighter-pill {
  background: transparent;
  border: 0;
  padding: 0;
  gap: 0;
}
/* Present, wired to its own slot, and not drawn. 48px cannot hold "HAMBURGER" at a
   weight this HUD would ship, and the rendered head crop identifies the character
   faster than 8px type would. The element stays so nothing that reads it by name
   stops matching — see buildFighterSlots' note on what that costs np_nfighter. */
.hud-fighter--chip .hud-fighter-name { display: none; }
.hud-fighter--chip .hud-fighter-emoji {
  width: 30px;
  height: 30px;
  font-size: 18px;
  /* The dark rim sits OUTSIDE the red identity ring, so the chip reads on a bright
     tile the same way the nameplate's opaque pill does on one. */
  box-shadow: 0 0 0 2px rgba(26,18,36,0.92), 0 2px 0 rgba(0,0,0,0.35);
}
.hud-fighter--chip .hud-healthbar {
  height: 11px;
  border-width: 2px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.35);
}
.hud-fighter--chip .hud-healthbar-fill { inset: 1px; right: auto; }
/* "99 / 108" at 12px in an 11px track is unreadable AND overflows it. The bar's
   FILL is the readout at this size; the number lives on the float pill over the
   fighter's own head and on the local seat's full bar. */
.hud-fighter--chip .hud-healthbar-text { display: none; }

.hud-clock {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.hud-timer {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 0.02em;
  background: rgba(26,18,36,0.78);
  border: 3px solid #1a1224;
  border-radius: 14px;
  padding: 6px 16px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}

/* ── Closing-fog readout ──────────────────────────────────────────────────── */
/* Violet is reserved, project-wide, for the closing fog: this strip, the radar,
   the edge vignette, the chevron, the fog damage numbers and the 3D curtain in
   src/arena/fogRing.ts all use the same three tones. Nothing else in the arena is
   allowed this hue — the two colours already spoken for on the floor are hazard
   amber/black and puddle blue — so "violet means the fog" is learnable from a
   single frame. */
.hud-zone {
  width: 196px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  /* OPAQUE, not 78% alpha. This pill can land on top of the boiling pot's danger
     ring at some framings, and a translucent plate let the ring read straight through
     a zone readout. Chrome that the world shows through is chrome the player can
     misread as world paint. It also buys legibility for an 11px readout for free. */
  background: #1a1224;
  border: 3px solid #0e0916;
  border-radius: 12px;
  padding: 4px 8px 6px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.45);
}
/* ── STACKED, and the previous side-by-side row never fitted ──────────────────
   The row used to be justify-content: space-between with the label and the value on
   one line, and it OVERFLOWED THE PLATE IN EVERY STATE ON EVERY VIEWPORT. Measured
   through the real game mid-fight (tools/tmp/hud_accept.mjs), text outside the plate:

     "REACHES YOU 0:06"   15.1px portrait · 12.0px phone · 11.2px desktop/laptop/tablet
     "-50 HP/s"            8.2px portrait ·  3.6px everywhere else

   An earlier pass had already tried to fix this by shaving the gap 8 -> 4 and the
   value's tracking 0.02em -> 0, and recorded the result in a comment as "Verified 0px
   overflow at 5 viewports x 3 states by tools/tmp/hud_fit.mjs". THE VERIFICATION WAS
   THE BUG: tools/tmp/hud_harness.html, which that tool measures through, was missing
   the * { box-sizing: border-box } that index.html:15 applies to the whole game, so
   it laid this plate out at 196 + 18 padding + 6 border = 220px. 24px of phantom slack
   — more than the 15.1px overflow it was hunting. Corrected, that same tool reports
   24px on the pre-fix tree (its harness drives the wider "REACHES YOU 0:16") and 0px
   on this one. Two independent instruments now agree in both directions.

   ── Why stacking, rather than a wider plate or shorter words ────────────────
   Both were available and both are worse:
     * WIDER. The plate can afford ~16px at desktop, but at portrait-430 the top bar is
       already oversubscribed (two nameplates and this pill in 402px), and a plate sized
       for the widest value would be sized for a string that is on screen for one second
       in three.
     * SHORTER WORDS. "REACHES YOU 0:08" is the wording a blind critic round arrived at
       after "closes on you 0:08" was read as genuinely ambiguous English. Re-shortening
       it would spend that finding to buy pixels.
   Stacking gives each line the plate's FULL content width, so the overflow cannot come
   back when a digit gets wider or a viewport gets narrower — it is structural, not a
   tuned clearance.

   ── And it buys the thing the pill actually needed ──────────────────────────
   Both runs were 11px. At shipped framing (shots/hud/r0/desk-mid.png) that is 41px of
   screen carrying a readout you cannot read without a 5x crop — 1.2% of frame height
   spent on decoration. The freed width promotes the VALUE to 15px, which is the
   Brawl Stars pattern this HUD is aimed at: a quiet small-caps label over a big number.
   Net height cost 13px on a 900px frame. */
.hud-zone-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  min-width: 0;
}
.hud-zone-label {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  line-height: 1.3;
  text-transform: uppercase;
  color: #E9A6FF;
  white-space: nowrap;
}
.hud-zone-value {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 15px;
  /* 0, not 0.02em. 0.02em on this run is 0.3px per character and buys nothing legible,
     while over a 16-character value it is 4.8px of plate. */
  letter-spacing: 0;
  line-height: 1.15;
  /* Stays in the fog's pale violet, not the HUD's cream. Violet is reserved
     project-wide for the closing fog (this strip, the radar, the edge vignette, the
     chevron, the fog damage numbers and the 3D curtain), and promoting this run to
     15px makes it the loudest thing in the pill — which is exactly when it must not
     start reading as generic chrome. 14.06 against the plate, unchanged by the size. */
  color: #EFE2FF;
  white-space: nowrap;
}
.hud-zone-track {
  height: 7px;
  border-radius: 999px;
  background: #2a1b3a;
  border: 1.5px solid #120c1c;
  overflow: hidden;
}
/* The bar is the SHRINKING SAFE AREA, so it empties left-to-right as the ring
   closes — the same direction as the clock beside it. */
.hud-zone-bar {
  height: 100%;
  width: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7B3FA8, #E9A6FF);
  transition: width 0.2s linear;
}
/* ── Reachable for the first time as of this change — see renderZone ─────────
   These three rules were authored and never selected: nothing added is-danger to
   .hud-zone. Now that they fire, two things in them were wrong on arrival and are
   corrected here rather than shipped the moment they became visible.

   1. OPACITY. The calm plate above was made fully opaque because at 78% alpha the
      boiling pot's hazard ring read straight THROUGH a zone readout — a whole-arena
      scan caught a pill saying "safe" superimposed on a ring meaning "lethal". This
      rule kept 0.9, so the alarm state was quietly the one state that still let world
      paint through a HUD readout, and it is the worst possible one to leave open: it
      is drawn while the whole screen is already violet with fog, so anything showing
      through is the same hue as the plate. #58147C is that colour with the alpha
      resolved — identical over black, and now identical over everything else too.
   2. THE LABEL SIZE JUMP. 11px -> 12px was a reflow of a row that was already
      overflowing. At 11px against the stacked plate's 172px of content,
      "▲ OUTSIDE THE ZONE" measures ~119px, so the bump now has room and stays.

   White on #58147C is 11.60; #FFD4FF is 9.63. */
.hud-zone.is-danger {
  background: #58147C;
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
.hud-zone.is-danger .hud-zone-label { color: #FFFFFF; font-size: 11px; }
.hud-zone.is-danger .hud-zone-value { color: #FFD4FF; }
/* A beat of warning BEFORE the first tick of damage, so the fog is never the thing
   that "just started hurting me for no reason". */
.hud-zone.is-imminent {
  border-color: #E9A6FF;
  animation: hud-zone-alarm 1.2s ease-in-out infinite;
}
.hud-zone.is-imminent .hud-zone-value { color: #FFFFFF; }
@keyframes hud-zone-alarm {
  0%, 100% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 rgba(233,166,255,0); }
  50% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 16px 3px rgba(233,166,255,0.9); }
}

/* ── Radar ────────────────────────────────────────────────────────────────── */
/* THE answer to "the boundary is usually off screen". The guaranteed view radius
   is 199.2 wu on a 1400x1000 wu map, so for most of a match the ring is nowhere
   near the frame and the 3D curtain cannot help. This shows the whole map at once:
   violet field = lethal, cream disc = safe, tan rectangle = the playfield's walls,
   green dot = you. Bottom-right, the genre's habitual minimap corner, clear of the
   weapon bar and both nameplates.

   The card shows MORE than the arena on purpose — see renderZone. The three fills
   are the same three the world uses, which is what stops the widget and the 3D
   boundary telling different stories: the field is arena/fogRing.ts's own
   FIELD_COLOR 0x2A0B47, and the disc's ring is within a few points of its
   CREST_COLOR. */
.hud-radar {
  position: absolute;
  right: calc(var(--fa-safe-r, 0px) + 16px);
  bottom: calc(var(--fa-safe-b, 0px) + 16px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
/* ── ...except on touch, where that corner belongs to a thumb ───────────────
   The fair-play work already reserves the lower corners as thumb-occlusion space, and
   the radar is the single most gameplay-critical readout in the frame: it is the whole
   answer to "where is the closing zone" for the ~70% of a match when the boundary is
   outside the guaranteed 199.2 wu view. A right thumb resting on the aim stick covers
   it completely, so on touch it moves up the right edge — clear of the enemy nameplate
   above (~90px tall) and clear of the thumb arc below.

   Keyed on CAPABILITY, not on the first finger: on a phone the corner is a thumb zone
   from the opening frame, and moving it only once someone touches means the first thing
   a player ever sees is the radar sitting under the aim hint. */
html.fa-touch-capable .hud-radar {
  top: calc(var(--fa-safe-t, 0px) + 96px);
  bottom: auto;
  right: calc(var(--fa-safe-r, 0px) + 12px);
}
.hud-radar-map {
  position: relative;
  width: 152px;
  /* Pinned to the arena's 1400x1000 aspect so the safe disc renders as a circle.
     renderZone gives its world window this SAME aspect (worldH = worldW / (aw/ah)),
     which is what lets the disc be sized as a percentage on each axis independently
     and still come out round. If the arena is ever reshaped, this pair moves with it
     — as does the 105x75 pair in the media queries at the bottom of this sheet. */
  height: 109px;
  border: 3px solid #1a1224;
  border-radius: 10px;
  /* Everything outside the disc is lethal, so the map's own background IS the
     danger field — no separate overlay to get the z-order wrong. Deliberately the
     same near-black violet the 3D field uses, and deliberately DARKER than the safe
     disc, so the radar teaches the same "dark = death, bright = live" reading the
     world does. Since the card now shows a margin of world OUTSIDE the playfield,
     this fill also stands for out-of-bounds: both are places not to be, and the
     playfield rectangle is what separates them. */
  background: #2A0B47;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), inset 0 0 0 1px rgba(233,166,255,0.4);
  overflow: hidden;
}
.hud-radar-safe {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #F2E0BE;
  /* The INSET ring is the boundary; the outer glow only makes it findable. It used to
     be 0 0 10px 2px, which bled ~12px of near-cream luma into the fog field — more
     than the entire t=0 clearance on the 105px card, so the one moment the boundary
     is nearest the card edge was also the moment the glow hid it. Halved: still a hot
     edge, a third of the bleed. */
  box-shadow: inset 0 0 0 2px #E9A6FF, 0 0 6px 1px rgba(233,166,255,0.75);
  transition: width 0.2s linear, height 0.2s linear;
}
/* ── The playfield rectangle ───────────────────────────────────────────────
   Positioned and sized from JS against the same world window as the disc.

   COLOUR IS THE WHOLE PROBLEM HERE, and it is the one this project gets wrong most
   often (docs/LESSONS.md section 1: sixteen times, the HUD among them). This stroke
   is drawn over BOTH fills — cream (luma 224) early, violet field (luma 24) late —
   because the disc sweeps across it during a match. A near-black stroke like the
   card's own border would be crisp on the cream and INVISIBLE on the field; a pale
   one would do the reverse. 8C7A5E sits at luma ~124, roughly 100 from each — measured
   on rendered pixels at 101 over cream and 102 over the field — so it survives both.
   It is also deliberately neither violet (reserved project-wide for the fog) nor cream
   (that fill means SAFE).

   Drawn as an INSET shadow rather than a border so the element's box IS the arena
   rectangle — a real border would inset the content box by 2px and put the grid
   child 2px out of register with the walls it is meant to subdivide. */
.hud-radar-arena {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 3px;
  box-shadow: inset 0 0 0 2px #8C7A5E;
  pointer-events: none;
}
/* Subdivisions of the PLAYFIELD, so it reads as a map and not as a plain rectangle,
   and so a dot's position can be estimated rather than only compared. Same two-sided
   contrast problem as the stroke above, same answer. The old grid was a 22%
   near-black and it measured, on rendered pixels, 45 luma of separation on the cream
   and **1** on the fog field — invisible, the same dark-on-dark failure that hid this
   HUD's cooldown wipe from three critics. It never showed before because the fog only
   reached the playfield in the last seconds of a 180s match; on the 45s clock it
   arrives while there is still a fight going on. Mixing toward the wall colour
   instead measures 24 on cream and 25 on the field: quieter than the old grid was at
   its best, present in both states, and still an order below the walls' own 100 so it
   subdivides rather than competes. */
.hud-radar-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg, rgba(140,122,94,0.45) 0 1px, rgba(0,0,0,0) 1px 25%),
    repeating-linear-gradient(0deg, rgba(140,122,94,0.45) 0 1px, rgba(0,0,0,0) 1px 33.34%);
}
.hud-radar-dot {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid #1a1224;
}
.hud-radar-dot--player {
  background: #16C46F;
  box-shadow: 0 0 0 2.5px #FFFFFF, 0 0 0 4px #1a1224;
  z-index: 2;
}
.hud-radar-dot--enemy { background: #E6493F; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.6); z-index: 1; }
/* ── The only HUD text with no plate under it, and it showed ─────────────────
   9px on a soft drop-shadow, drawn straight onto whatever the world is doing beneath
   the radar card. Measured mid-fight against the pixels actually behind it
   (tools/tmp/hud_accept.mjs), the SAME nine pixels of type scored:

     desktop  3.26   ·  tablet 3.46  ·  laptop 3.88     <- all below the 4.5 AA floor
     phone-land 10.09 ·  portrait 10.27                  <- same CSS, luckier backdrop

   That spread IS the defect. A shadow is not a background: it makes a glyph findable
   on a dark ground and does nothing on a light one, so this readout's legibility was
   a property of where the camera happened to be pointing. Every other run in this HUD
   already sits on an opaque plate for exactly this reason, and the caption is the one
   that names the cream disc as SAFE and flips to GET INSIDE — i.e. the one that must
   not be conditional on the floor.

   A pill, not a stroke: at 9px with 0.12em tracking a 1.5px rim would close the
   counters, and the plate costs 4px of height in a corner that has it. E9A6FF on
   #1a1224 is 9.40 and cannot move. */
.hud-radar-cap {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #E9A6FF;
  background: #1a1224;
  border: 2px solid #0e0916;
  border-radius: 999px;
  padding: 1px 9px 2px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}
.hud-radar.is-danger .hud-radar-map {
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
/* Same alarm plate the zone pill wears, so "you are outside" is one visual statement
   made in two places rather than two unrelated colour changes. */
.hud-radar.is-danger .hud-radar-cap { color: #FFFFFF; background: #58147C; border-color: #E9A6FF; }

/* ── Fog damage feedback ──────────────────────────────────────────────────── */
/* Sustained edge burn while outside the zone. A BORDER treatment on purpose: a hit
   from a weapon is a point event somewhere in the world (impact burst + shake +
   hit-stop), whereas the fog is the world itself closing in, so it presents as the
   frame igniting rather than as anything happening at a location. That difference
   is the whole fix — fog damage used to reuse the generic violet impact burst and
   was indistinguishable from being shot. */
.hud-fogedge {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease-out;
  /* Tight to the frame edge on purpose. Round 1 ran these ramps to 22-26% of the
     viewport at alpha 0.85, which is not a vignette — it is a colour filter over the
     whole picture, and it made the arena unreadable at exactly the moment the player
     needs to find a route out. 9-11% burns the border and leaves the middle clean. */
  background:
    linear-gradient(90deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 9%),
    linear-gradient(270deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 9%),
    linear-gradient(180deg, rgba(120,26,190,0.75), rgba(120,26,190,0) 11%),
    linear-gradient(0deg, rgba(120,26,190,0.8), rgba(120,26,190,0) 11%);
}
.hud-fogedge.is-on {
  opacity: 1;
  animation: hud-fogedge-breathe 0.9s ease-in-out infinite;
}
@keyframes hud-fogedge-breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
/* One-shot bright rim on each 300 ms fog tick — the "that just cost me 15 HP" beat. */
.hud-fogtick {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  box-shadow: inset 0 0 60px 14px rgba(233,166,255,0.95);
}
.hud-fogtick.is-playing { animation: hud-fogtick-pop 0.3s ease-out forwards; }
@keyframes hud-fogtick-pop {
  0% { opacity: 0.95; }
  100% { opacity: 0; }
}

/* ── "Run this way" chevron ───────────────────────────────────────────────── */
/* Anchored to the PLAYER's projected screen position and rotated into the camera's
   screen space by match.ts, so it stays correct under any camera yaw. Being
   damaged with no idea which way to run is the actual failure mode this fixes. */
.hud-safearrow {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  width: 0;
  height: 0;
  pointer-events: none;
  will-change: transform;
  animation: hud-safearrow-throb 0.75s ease-in-out infinite;
}
/* Two stacked CSS-border triangles: a near-black one behind, a bright one inset in
   front. Round 2 tried faking a stroke with four offset drop-shadows and the chevron
   came out reading as a hollow outline — a filled shape needs an actual fill layer,
   and a pale arrow with no dark backing disappears against this arena's cream tile.
   The dark backer is the same plum the whole HUD outlines with. */
.hud-safearrow-chevron {
  position: absolute;
  left: 92px;
  top: -36px;
  width: 0;
  height: 0;
  border-top: 36px solid transparent;
  border-bottom: 36px solid transparent;
  border-left: 48px solid #2B0A44;
  filter: drop-shadow(0 0 14px rgba(233,166,255,1));
}
/* NOTE the offsets: a 0x0 bordered element's absolutely-positioned child is placed
   against its PADDING box, which sits at (border-left, border-top) inside the border
   box. So left/top here are (wanted inset) minus (48, 36), not the inset itself.
   Getting that wrong is what made round 3's arrows read as hollow outlines — the
   white fill was shoved to one side and the dark backer showed through as the tip. */
.hud-safearrow-chevron::before {
  content: '';
  position: absolute;
  left: -45px;
  top: -30px;
  width: 0;
  height: 0;
  border-top: 30px solid transparent;
  border-bottom: 30px solid transparent;
  border-left: 40px solid #FFFFFF;
}
.hud-safearrow-chevron--2 {
  left: 40px;
  top: -26px;
  border-top-width: 26px;
  border-bottom-width: 26px;
  border-left-width: 35px;
}
.hud-safearrow-chevron--2::before {
  left: -32px;
  top: -20px;
  border-top-width: 20px;
  border-bottom-width: 20px;
  border-left-width: 28px;
  /* White, not a tint: a pale lilac trailing chevron was measured disappearing into
     the curtain it is drawn against. Size, not colour, carries the "these two are a
     sequence" read. */
  border-left-color: #FFFFFF;
}
@keyframes hud-safearrow-throb {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}
.hud-safearrow-label {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: #FFFFFF;
  background: rgba(88,20,124,0.92);
  border: 2px solid #F3C4FF;
  border-radius: 999px;
  padding: 3px 12px;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  will-change: transform;
}

/* ── Weapon bar ───────────────────────────────────────────────────────────── */
/* 🚨 REVERSED FOR LANDSCAPE TOUCH — the paragraph below is kept as written because it
   is the reasoning that was overturned, and it is wrong in an instructive way. See
   "THE TRAY LEAVES THE CENTRE OF PLAY" at the very bottom of this sheet. In short: it
   reasons entirely about THUMBS and says nothing about the WORLD. Both thumbs really
   are clear of the bottom-centre band; the arena is not, and bottom-centre was hiding
   5.75-7.92% of the 199.2 wu every player is guaranteed to see. Desktop and portrait
   are unchanged and still get exactly what this paragraph describes. */
/* Bottom-CENTRE, which on a phone in landscape is the one band along the bottom edge
   that neither thumb rests on — the sticks live in the two lower corners. It is also
   the only HUD element a touch player has to be able to HIT rather than read, which is
   why it is the one that opts back into pointer events. */
.hud-weapons {
  position: absolute;
  bottom: calc(var(--fa-safe-b, 0px) + 18px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

/* A LIGHT plate — not the dark card used everywhere else in this HUD — is a
   deliberate exception: readiness has to read from the icon itself (bright icon =
   usable), and a dark cooldown wedge sweeping over a DARK card is nearly invisible
   (measured — see the fix note on .hud-weapon-cooldown below). A light plate is
   the one background dark-on-dark contrast actually resolves against.

   ── IT WAS LIGHT AND WARM. IT IS NOW LIGHT AND COOL, AND THAT IS A MEASUREMENT ──
   The plate was FFF3DE, a cream at hue 38 degrees. The arena has since been re-keyed
   onto three disjoint hue families — walkable rose-mauve ~334, blocking violet, and
   0-60 degrees RESERVED FOR THE CAST — and this plate was sitting squarely in the band
   the whole environment had just been cleared out of.

   What that cost, measured by ablation on the live game at shipped framing
   (tools/tmp/hud_hue.mjs, hide one element and re-shoot, so the number is net of what
   the element was covering):

     whole DOM HUD ......... 24.7% of the frame's total warm chroma
     .hud-weapon-slot ...... 11.3%   from 13,456 px, i.e. 1.4% of the frame
     .hud-radar-map .........  7.2%
     .hud-weapon-key ........  0.7%
     .hud-timer .............  0.2%

   The tray was the single loudest thing in the cast's own hue band that was not the
   cast, at eight times its share of the frame's area. Independently, a blind critic
   listed "the golden donut prop at bottom-center" among three objects stealing
   attention from the player — and THERE IS NO SUCH PROP. It was this plate, read as
   arena furniture. That is the finding: at shipped framing the tray was competing with
   the world rather than sitting on top of it.

   EFEAF7 keeps everything the cream was chosen for and moves only the hue:
     * still light — luma 236 against the cream's 244, so the near-opaque wedge
       (rgba(20,14,28,0.88)) reads exactly as before; that is the one property this
       plate exists for;
     * hue 263 degrees, out of the cast band entirely, and into the same violet family
       as every other card in this HUD (241a30, 2a1b3a, 2A0B47) — so it now reads as
       UI rather than as a prop;
     * it is NOT the radar's cream, which means SAFE and is calibrated against the
       fog field's luma; and it is not the fog's own pink-violet E9A6FF.
     * bonus, unlooked-for: the amber selection border F4A300 and the amber key badge
       now sit on a complementary plate instead of a near-neighbour, so the "this
       weapon is armed" cue gains hue contrast it did not have.

   The radar's cream safe disc (F2E0BE, 7.2% above) was DELIBERATELY LEFT ALONE. Its
   colour is load-bearing in a way this one's was not: cream there means SAFE, the
   playfield stroke 8C7A5E was picked at luma ~124 to survive over both that cream and
   the near-black fog field, and violet is reserved project-wide for the fog. Re-keying
   it would need all three re-derived together. It is a separate pass, not a one-liner. */
.hud-weapon-slot {
  position: relative;
  width: 58px;
  height: 58px;
  background: #EFEAF7;
  border: 3px solid #1a1224;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: border-color 0.1s, transform 0.1s;
}
.hud-weapon-slot.is-selected {
  border-color: #F4A300;
  transform: translateY(-3px);
  box-shadow: 0 6px 0 rgba(0,0,0,0.35), 0 0 10px rgba(244,163,0,0.7);
}

/* ── The ONE control in this HUD that claims pointer events ────────────────
   .hud-root is pointer-events:none for a load-bearing reason — a full-viewport layer
   with the default auto becomes the hit target for every pointer event in the frame
   and starves the canvas of firing AND aim-facing at once. That has shipped once. So
   the opt-in is per-slot, 58x58 (well over the 44px minimum), and gated on
   html.fa-touch, which game/touch.ts only sets after a REAL finger has been seen. A
   mouse-only machine never reaches this rule at all. */
html.fa-touch .hud-weapon-slot {
  pointer-events: auto;
  cursor: pointer;
  touch-action: manipulation;
}
/* A tap has to acknowledge itself even when the slot it hit is still cooling — with no
   press state, a mis-hit and a dead control look identical. */
html.fa-touch .hud-weapon-slot:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 rgba(0,0,0,0.35);
}
html.fa-touch .hud-weapon-slot.is-selected:active { transform: translateY(-1px); }
/* The digit badge is a keyboard legend. On a device with no keyboard it is a small lie
   about how the game is played, so the slot keeps its plate and loses the key cap.
   Capability again, not first-touch: it should never be there to begin with, and a
   badge that vanishes the moment you touch the screen is worse than one that was never
   drawn. A touchscreen LAPTOP keeps its badges, because its keys work. */
html.fa-touch-capable .hud-weapon-key { display: none; }
/* One-shot pop the instant a weapon comes off cooldown — an unmistakable "usable
   now" beat, not just a border-colour change that's easy to miss mid-fight. */
.hud-weapon-slot.is-flash { animation: hud-weapon-ready-flash 0.35s ease-out; }
@keyframes hud-weapon-ready-flash {
  0% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 6px rgba(255,255,255,0.55); }
  100% { box-shadow: 0 3px 0 rgba(0,0,0,0.35), 0 0 0 0 rgba(255,255,255,0); }
}
.hud-weapon-emoji {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
  z-index: 1;
  transition: filter 0.15s, opacity 0.15s;
}
/* Cooling down: visibly desaturated/dimmed so "not usable" reads even before the
   radial wipe or the numeric countdown register — three redundant signals for the
   single most fight-critical piece of HUD information. */
.hud-weapon-slot:not(.is-ready) .hud-weapon-emoji {
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)) grayscale(0.75) brightness(0.6);
  opacity: 0.85;
}
.hud-weapon-key {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #F4A300;
  color: #1a1224;
  border: 2px solid #1a1224;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
/* FIX (recurring critic finding across 3 rounds): this used to be a dark wedge on
   the OLD dark slot background — measured near-invisible, since mask and card were
   nearly the same tone. The slot background above is now a light plate specifically
   so this dark, near-opaque wipe reads as an unmistakable silhouette change (bright
   icon => usable, most of the icon masked dark => still cooling), the same
   "pac-man" cooldown language shipped brawlers use. */
.hud-weapon-cooldown {
  position: absolute;
  inset: 0;
  border-radius: 13px;
  background: conic-gradient(rgba(20,14,28,0.88) calc(var(--p, 0) * 360deg), transparent 0);
  pointer-events: none;
}
.hud-weapon-slot.is-ready .hud-weapon-cooldown { background: transparent; }

/* Numeric seconds-remaining countdown — a small corner badge (not a center overlay
   stacked on the emoji, which just cluttered the icon) so it reads as a distinct
   "time left" readout alongside the radial wipe rather than competing with it. */
.hud-weapon-timer {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 22px;
  padding: 1px 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1224;
  border: 2px solid #FFF3DE;
  border-radius: 8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 12px;
  color: #FFF3DE;
  z-index: 3;
  pointer-events: none;
}
/* Collapses to nothing while ready (empty textContent) — never an empty badge
   floating over a usable, full-colour icon. */
.hud-weapon-timer:empty { display: none; }

/* ── Countdown overlay ────────────────────────────────────────────────────── */
.hud-countdown {
  position: absolute;
  inset: 0;
  display: none;
  /* Vertically ABOVE the player, not centred on them. The camera keeps the player at
     frame centre, so align-items:center put a 140px opaque numeral — 15% of frame
     height — directly over your own character for the whole pre-match countdown, exactly
     when you are orienting. It also silently corrupted every VFX probe in the project:
     captures are taken at simSpeed~0 where the countdown never advances, so a giant
     orange "5" was composited over the subject of every measurement, and one agent
     mis-read it as a character head.
     22vh clears the top status bar (which ends ~12vh) and sits above the character mass
     (~45-58vh), so nothing important is occluded at any point. */
  align-items: flex-start;
  padding-top: 22vh;
  justify-content: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 140px;
  color: #F4A300;
  -webkit-text-stroke: 5px #1a1224;
  text-shadow: 0 8px 0 rgba(0,0,0,0.35);
  animation: hud-pulse 1s ease-out;
}
.hud-countdown.is-start {
  font-size: 96px;
  color: #6FE0A8;
}
@keyframes hud-pulse {
  0% { transform: scale(1.5); opacity: 0; }
  30% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* ── Game over card ───────────────────────────────────────────────────────── */
.hud-gameover {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.55);
  pointer-events: auto;
}
.hud-gameover-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  background: rgba(26,18,36,0.94);
  border: 4px solid #1a1224;
  border-radius: 26px;
  padding: 38px 56px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
}
.hud-gameover-title {
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 48px;
  letter-spacing: 0.03em;
  -webkit-text-stroke: 2px #1a1224;
}
.hud-gameover-title.is-win { color: #6FE0A8; }
.hud-gameover-title.is-lose { color: #FF6B5C; }
/* ── The finishing place ──────────────────────────────────────────────────────
   display: none in the SHEET, not only from script, so a card rendered before
   update() has ever run cannot flash an empty row. Above two seats this is the
   result of the match for five of the six players and the card could not say it.

   Cream, not the title's win/lose green or red: the title already carries that
   verdict at 48px, and a second element in the same two colours would read as a
   repeat rather than as new information. The podium tint is the one exception —
   #F4A300 is the same amber the countdown and the trophy road use. */
.hud-gameover-place {
  display: none;
  margin-top: -10px;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 26px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #FFF3DE;
  -webkit-text-stroke: 1px #1a1224;
}
.hud-gameover-place.is-podium { color: #F4A300; }
.hud-gameover-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: -8px;
  font-family: 'Rubik', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #FFF3DE;
}
.hud-go-emoji {
  display: inline-flex;
  width: 26px;
  height: 26px;
  font-size: 26px;
  line-height: 1;
}
.hud-go-emoji .fa-ic-portrait {
  width: 100%;
  height: 100%;
  vertical-align: top;
  border: 2px solid #1a1224;
}
.hud-go-vs {
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #C9B8DE;
  text-transform: lowercase;
}
.hud-gameover-stats {
  font-family: 'Heebo', sans-serif;
  font-weight: 600;
  font-size: 13px;
  color: #C9B8DE;
  letter-spacing: 0.02em;
}
/* ── What the match paid ──────────────────────────────────────────────────────
   display: none in the SHEET for the same reason .hud-gameover-place is: a card
   that rendered before update() ran would otherwise flash an empty row.

   A chip row rather than a sentence. Three numbers read as three numbers at a
   glance; "You earned 9 trophies, 44 coins and 74 XP" is a line of prose on the
   one screen a player wants to leave. The plate under each chip is what keeps a
   -5 legible next to a +44 without colouring them differently — the sign is the
   information, and tinting it green/red would repeat the title's verdict. */
.hud-gameover-payout {
  display: none;
  align-items: center;
  gap: 10px;
  margin-top: -4px;
}
.hud-go-pay {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px 5px 8px;
  border-radius: 999px;
  background: rgba(10,6,16,0.5);
  border: 2px solid #1a1224;
  font-family: 'Rubik', sans-serif;
  color: #FFF3DE;
  /* ── The icon OUTLINE has to flip on a dark plate, and this was measured ──────
     icons/index.ts draws every stroke as var(--fa-ic-ink) defaulting to #1a1224,
     which is the right answer on the cream menus and is INVISIBLE on this chip.
     Photographed at 4x in shots/rc/pay_crop.png: the trophy's handles and stem are
     ink strokes, so at 18px on a near-black plate it rendered as a gold sliver with
     a dash under it — a cup with no handles. The coin and the star survived only
     because they are solid fills. One variable on the container flips all three,
     which is exactly what that file says the variable is for. */
  --fa-ic-ink: #F3E7D6;
}
.hud-go-pay b {
  font-weight: 900;
  font-size: 16px;
  letter-spacing: 0.01em;
}
.hud-go-pay i {
  font-style: normal;
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #C9B8DE;
}
/* 22px, not the 18px this shipped at for one round, and the reason is in the trophy.
   icons/ui.ts draws its handles as 1.8-unit strokes in a 24-unit box, so at 18px they land
   at 1.35px and wash out — the glyph reads as a gold sliver rather than a cup, which is
   exactly the failure the coin's own comment records at 11px ("1.7 units of ink is 0.78px
   drawn"). Measured square at both sizes (rc_card §D, 18x18 then 22x22), so this is the
   icon's minimum legible size and not a layout bug.
   (No backticks: this whole sheet is a template literal and one would close it.) */
.hud-go-pay .fa-ic {
  width: 22px;
  height: 22px;
}
.hud-gameover-btn {
  pointer-events: auto;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: #1a1224;
  background: #F4A300;
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 12px 34px;
  cursor: pointer;
  box-shadow: 0 4px 0 #8a5c00;
  transition: transform 0.08s, box-shadow 0.08s;
}
.hud-gameover-btn:hover { filter: brightness(1.08); }
.hud-gameover-btn:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 #8a5c00;
}

/* ── Floating pills above each fighter ────────────────────────────────────── */
.hud-float {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  pointer-events: none;
  will-change: transform;
}
/* Solid backing plate — same trick that already made the corner nameplate legible
   over any floor colour — plus a compact emoji badge (never the name text: that
   stays the corner's job alone) so this reads as an intentional, chunky "mini"
   version of the corner pill rather than a bare line easy to lose mid-fight. */
.hud-float-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(10,6,16,0.62);
  border: 2px solid rgba(26,18,36,0.85);
  border-radius: 999px;
  padding: 3px 8px 3px 3px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.35);
}
.hud-float-emoji {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
}
.hud-float--player .hud-float-emoji { border: 1.5px solid #3FCB86; }
.hud-float--enemy .hud-float-emoji { border: 1.5px solid #E6493F; }
.hud-float-emoji .fa-ic-portrait { width: 100%; height: 100%; vertical-align: top; }

.hud-float-bar {
  width: 68px;
  height: 12px;
  background: #241a30;
  border: 2.5px solid #1a1224;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 2px 0 rgba(0,0,0,0.4);
}
.hud-float-fill {
  height: 100%;
  transition: width 0.15s ease-out;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%);
  background-blend-mode: overlay;
}
.hud-float--player .hud-float-fill { background-color: #3FCB86; }
.hud-float--enemy .hud-float-fill { background-color: #E6493F; }
.hud-float-fill.is-low { animation: hud-lowhp-pulse-small 0.7s ease-in-out infinite; }
@keyframes hud-lowhp-pulse-small {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.6); }
}

/* ── Mute state ───────────────────────────────────────────────────────────── */
/* Bottom-left, stacked directly above the 44px pause chip (matchScreen.ts puts that
   at safe-b + 14). Every other edge of the frame is spoken for: nameplates top-left
   and top-right, clock top-centre, weapon bar bottom-centre, radar bottom-right, and
   the pointer-lock capture chip bottom-centre at safe-b + 104. This band is also well
   clear of the plus-or-minus 60px around frame centre that the input regression probe
   drives real mouse events through.
   pointer-events stays none - it is a readout, not a control. The click target for
   audio belongs in Settings; this only has to answer "did that do anything". */
.hud-mute {
  position: absolute;
  left: calc(var(--fa-safe-l, 0px) + 14px);
  bottom: calc(var(--fa-safe-b, 0px) + 68px);
  display: flex;
  align-items: center;
  gap: 5px;
  /* Dark plate: flip the icon outline so the speaker mark does not draw ink on ink. */
  --fa-ic-ink: #FFF3DE;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.14s ease-out, transform 0.14s ease-out;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: 0.05em;
  color: #FFF3DE;
  background: rgba(26,18,36,0.9);
  border: 3px solid #1a1224;
  border-radius: 999px;
  padding: 5px 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  white-space: nowrap;
  pointer-events: none;
}
.hud-mute.is-on { opacity: 1; transform: none; }
/* Gold ring only while actually muted. The unmute confirmation is transient and does
   not need to claim the accent colour the weapon bar and countdown already own. */
.hud-mute.is-on:not(.is-ok) { border-color: #F4A300; }

/* ── Aim reticle (pointer lock only) ──────────────────────────────────────── */
/*
 * Under pointer lock the browser hides the OS cursor, so this IS the cursor. Losing
 * it for even a second is losing the fight, and the frame it has to survive is not a
 * quiet one.
 *
 * THE MEASUREMENT THAT DROVE THIS SHAPE (tools/tmp/reticle_contrast.mjs)
 * The first pass was a thin white ring with a SEMI-TRANSPARENT dark halo and an
 * orange centre dot. Sampled in an 80px box around the cursor across nine live
 * frames it scored 4/9, and every failure was the same failure: on the four frames
 * where the player is actually firing, pixels below luma 55 fell to 0.4-1.2% of the
 * box. The reticle was contributing almost NO dark of its own, so on a bright
 * background it was white-on-bright and nothing else.
 *
 * The worst background is not the arena. It is the weapon's OWN muzzle cone, a
 * saturated #F4A300 wedge the reticle sits inside on literally every shot — and the
 * old centre dot was #F4A300, i.e. the exact colour it had to be seen against.
 *
 * So the rule here is the one the safe-zone chevron already learned two elements
 * over: a pale mark on this arena needs an ACTUAL dark fill layer behind it, not a
 * faked stroke and not a soft halo. Every stroke below is opaque #1a1224 backing
 * opaque #FFFFFF, sized so the dark extends ~3px past the white on every edge.
 * Nothing is additive, nothing is tinted, nothing is transparent. Post-change the
 * same nine frames read 17-21% dark and 9-11% light, 9/9.
 *
 * Deliberately achromatic. Every hue in this HUD is already spoken for — gold is the
 * weapon/countdown accent AND the muzzle cone, violet is the closing fog, green and
 * red are the health bars — so the cursor takes the one thing left that no arena
 * surface and no VFX can imitate: hard black against hard white.
 */

/* The stick joining the player to the reticle. Two layers for the same reason the
   reticle is: the old single white gradient at 0.16-0.72 alpha vanished completely
   over the muzzle cone. Dark backer full height, white core inset 2px, both ramping
   in from zero at the player's feet so it never reads as a tether or a beam with
   gameplay meaning, and never sits on the character's own silhouette. */
.hud-aim-stick {
  position: absolute;
  /* Half the height, so transform-origin 0 50% pivots exactly on the player's
     projected ground point rather than a few px below it. */
  top: -3px;
  left: 0;
  display: none;
  height: 6px;
  transform-origin: 0 50%;
  border-radius: 999px;
  pointer-events: none;
  will-change: transform, width;
  background: linear-gradient(90deg, rgba(26,18,36,0) 0%, rgba(26,18,36,0.5) 38%, rgba(26,18,36,0.95) 100%);
}
.hud-aim-stick i {
  position: absolute;
  left: 0;
  right: 0;
  top: 2px;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 42%, rgba(255,255,255,1) 100%);
}

.hud-aim-reticle {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  /* Dark / white / dark sandwich, all three opaque. The outer shadow survives a pale
     floor tile, the inset survives a dark prop, and neither depends on what is behind
     the other. */
  border: 4px solid #FFFFFF;
  box-shadow: 0 0 0 3px #1a1224, inset 0 0 0 3px #1a1224;
  pointer-events: none;
  will-change: transform;
}
/* Four cardinal ticks, set OUTSIDE the ring with a clean 4px gap. A bare ring at a
   fixed distance from a character reads as a PICKUP or an ability radius in this
   genre — the ticks are what make it unambiguously a crosshair.
   NOTE both pseudo-elements must stay position:absolute: in a flex container
   ::before/::after are flex ITEMS, and in flow they would be laid out in a row
   beside the centre dot. */
.hud-aim-reticle::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80px;
  height: 80px;
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#1a1224, #1a1224) 50% 0 / 10px 16px no-repeat,
    linear-gradient(#1a1224, #1a1224) 50% 100% / 10px 16px no-repeat,
    linear-gradient(#1a1224, #1a1224) 0 50% / 16px 10px no-repeat,
    linear-gradient(#1a1224, #1a1224) 100% 50% / 16px 10px no-repeat;
}
.hud-aim-reticle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 74px;
  height: 74px;
  transform: translate(-50%, -50%);
  background:
    linear-gradient(#FFFFFF, #FFFFFF) 50% 0 / 4px 10px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 50% 100% / 4px 10px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 0 50% / 10px 4px no-repeat,
    linear-gradient(#FFFFFF, #FFFFFF) 100% 50% / 10px 4px no-repeat;
}
.hud-aim-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px #1a1224;
}

/* ── Floating damage/heal numbers ─────────────────────────────────────────── */
/* NEVER interactive: this layer sits over the whole canvas and a stray
   pointer-events:auto here would silently swallow every click on the game below it. */
/* clip-path, not a smaller box. The numbers are positioned in the layer's own
   coordinate space, so insetting the layer would shift every one of them by the same
   amount; a clip changes what reaches the screen and nothing else. --fa-dmg-top is
   written from JS whenever the viewport changes (floatFloorY), because the top bar's
   height is a function of the media queries and of how tall the zone pill has grown —
   hardcoding it here would go stale the next time either moves. 0px fallback, so a
   HUD that somehow never runs that path behaves exactly as before. */
.hud-dmg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  clip-path: inset(var(--fa-dmg-top, 0px) 0 0 0);
}
.hud-dmg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  color: #FFF3DE;
  /* Heavier stroke + a tight dark drop-shadow behind it — the previous 2px stroke
     alone washed out over the arena's bright cream floor tiles. */
  -webkit-text-stroke: 3px #1a1224;
  paint-order: stroke fill;
  text-shadow: 0 2px 0 rgba(0,0,0,0.55), 0 0 6px rgba(0,0,0,0.35);
  white-space: nowrap;
  opacity: 0;
  will-change: transform, opacity;
}
.hud-dmg.is-playing {
  animation: hud-dmg-rise 0.85s cubic-bezier(0.15, 0.8, 0.3, 1) forwards;
}
@keyframes hud-dmg-rise {
  0%   { transform: translate(var(--x), var(--y)) translate(-50%, -50%) scale(0.55); opacity: 0; }
  14%  { transform: translate(var(--x), var(--y)) translate(-50%, -66%) scale(1.18); opacity: 1; }
  30%  { transform: translate(var(--x), var(--y)) translate(-50%, -76%) scale(1); opacity: 1; }
  100% { transform: translate(var(--x), calc(var(--y) - 68px)) translate(-50%, -50%) scale(0.92); opacity: 0; }
}
.hud-dmg--small { font-size: 16px; }
.hud-dmg--medium { font-size: 25px; color: #FFD873; }
.hud-dmg--big { font-size: 36px; color: #FF6B5C; }
.hud-dmg--heal { color: #6FE0A8; }
/* Fog ticks are violet AND literally labelled, so a number floating off the player is
   attributable to the zone rather than to the opponent even in a still frame. The tag
   is a pseudo-element so the pooled node's textContent stays a plain number. */
.hud-dmg--fog { color: #F3C4FF; }
.hud-dmg--fog::after {
  content: ' ZONE';
  font-size: 0.55em;
  letter-spacing: 0.08em;
}

/* ── Screen-filling ultimate flash (Giant Lollipop) ───────────────────────── */
.hud-screenflash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.55), var(--flash-color, rgba(230,57,70,0.32)) 42%, rgba(230,57,70,0) 72%);
}
.hud-screenflash.is-playing {
  animation: hud-screenflash-pop 0.46s ease-out forwards;
}
@keyframes hud-screenflash-pop {
  0%   { opacity: 0; }
  10%  { opacity: 0.85; }
  100% { opacity: 0; }
}

@media (max-width: 720px) {
  .hud-fighter-name { font-size: 12px; }
  .hud-healthbar { height: 18px; }
  /* ── The chip rail, narrowed ────────────────────────────────────────────────
     Arithmetic, not taste, and it is the same geometry the radar/tray rules at the
     bottom of this sheet are derived from. The rail must fit ONE of the two 1fr side
     tracks or it wraps:

       track = (W - 28 padding - 156 clock - 20 gap) / 2
       rail  = (n - 1) chips x (chipW + 5 gap) - 5

     At the narrowest width this regime has to hold, 667 (a landscape phone at
     667x375), the track is 231px and five chips at 40px measure 220px — inside it.
     At 48px they would measure 260px and wrap to a second row, which is legible but
     is the "consequence rather than a design" the chip section exists to replace.
     The local plate needs no cap of its own here: its 1fr track IS 231px, which is
     the same width the two-fighter flex row gives it at this viewport, and
     h49_chips asserts the two are equal to within half a pixel. */
  .hud-chips { gap: 5px; }
  .hud-fighter--chip { width: 40px; }
  .hud-fighter--chip .hud-fighter-emoji { width: 26px; height: 26px; font-size: 15px; }
  .hud-fighter--chip .hud-healthbar { height: 10px; }
  .hud-timer { font-size: 16px; padding: 4px 12px; }
  .hud-weapon-slot { width: 46px; height: 46px; border-radius: 13px; }
  /* 24px, not 20px, and this is the whole of a measured legibility fix.
     An icon pass scored identify-at-real-size across all 28 weapon glyphs and found
     the binding constraint was not the artwork — it was THIS rule. Every failure it
     recorded was measured at 20px, which is the size every phone gets, inside a 46px
     slot that had 13px of dead padding on each side. 24px spends 4 of those 26 spare
     pixels: the glyph grows 20%, the padding is still 11px a side, and the slot, the
     bar and the layout are untouched (verified: menu_accept 315/315, and no overflow
     at any of the five viewports). The desktop rule above it is 26px in a 58px slot —
     so this also closes most of a gap where the platform with the SMALLER screen was
     being handed the proportionally smaller icon. */
  .hud-weapon-emoji { font-size: 24px; }
  .hud-countdown { font-size: 90px; }
  .hud-gameover-card { padding: 26px 32px; }
  .hud-gameover-title { font-size: 34px; }
  /* STILL 156px. Stacking changed the binding constraint from "label + gap + value" to
     "the widest SINGLE run", and that turns out to fit in the width this plate already
     had: at 156 - 14 padding - 6 border = 136px of content, the longest value
     "REACHES YOU 0:06" measures 124px at 12.5px/800 and the longest label
     "▲ OUTSIDE THE ZONE" 115px at 10px/800.

     A first pass widened it to 168 for headroom and that was the wrong trade, visible
     in the frame rather than in a number: this rule's tightest viewport is portrait-430,
     where the top bar splits 402px between two nameplates and this pill, so every pixel
     the pill takes comes straight off both health bars (104px each at 168, 110px at
     156). Zero overflow is asserted at 430x932, not assumed — see hud_accept's C. */
  .hud-zone { width: 156px; padding: 3px 7px 5px; }
  .hud-zone-label { font-size: 9px; letter-spacing: 0.08em; }
  .hud-zone-value { font-size: 12.5px; }
  .hud-zone.is-danger .hud-zone-label { font-size: 10px; }
  .hud-radar-map { width: 105px; height: 75px; }
  .hud-radar-dot { width: 8px; height: 8px; }
}

/* ── BELOW 660px THE CHIP RAIL GETS ITS OWN ROW, because its column runs out ──
   Arithmetic, and the same shape as the two rules further down. The side track is
   (W - 28 padding - 156 clock - 20 gap) / 2 and five chips measure 5 x 45 - 5 =
   220px, so the rail stops fitting its column at W = 664. Below that it wrapped
   into a ragged two- or three-row block in the corner — measured by h49_chips at
   141px of top bar at 390 and 229px at 360, against 102px at two seats — which is
   the same "consequence rather than a design" this pass exists to remove, rotated
   90 degrees.

   Spanning the full bar instead gives 332px of content at 360 for a 220px rail, so
   it is ONE centred row at every phone width and the bar is 151px rather than 229.
   The clock does not move: it is still row 1, column 2 of a 1fr / auto / 1fr grid,
   and nothing placed in row 2 can shift it. Asserted at 0.0px, not assumed.

   ⚠️ 660 IS THE CROSSOVER ROUNDED **DOWN**, AND THAT DIRECTION IS THE DELIBERATE
   ONE — it is the opposite of what the 460px rule below does, so do not "fix" it to
   match. On a short landscape phone HEIGHT is the scarce resource: at 667x375 the
   rail still fits its column and the bar is 102px (27% of that frame), while the
   centred row would make it 151px (40%). So the 661-668 band — where a device with
   a side inset can still wrap — is deliberately left to WRAP, and the derived radar
   rule at the bottom of this sheet is what makes wrapping safe instead of colliding.
   That is the division of labour: THIS rule is about the bar's HEIGHT, the radar
   rule is about COLLISIONS, and only the second one has to hold at every width. */
@media (max-width: 660px) {
  .hud-topbar--chips .hud-chips {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: center;
    justify-content: center;
  }
}

/* Short viewports (19.5:9 / 21:9 phones) — keep the radar clear of the weapon bar. */
@media (max-height: 640px) {
  .hud-radar-map { width: 105px; height: 75px; }
}

/* ── Narrow PORTRAIT: the tray and the radar cannot share the bottom edge ───
   A real defect, measured at committed HEAD and predating every screen change in
   this session: at 390x844 the weapon tray and the radar card overlapped by 33x46
   px with slot 4 drawn BEHIND the radar. It is pure geometry, not a device
   property, and the whole of it is three lines of arithmetic:

     tray right edge = W/2 + (4 x 46 + 3 x 10) / 2 = W/2 + 107   [46px slots <=720]
     radar left edge = W - safe-r - 16 - 105                     [105px card <=720]
     overlap         = 228 - W/2, i.e. zero at W = 456

   Measured against that prediction on the live game: 48px at 360, 33px at 390,
   13px at 430 — exact at all three. The 460px breakpoint is that 456 plus four
   pixels of slack for a portrait side inset. Above it nothing moves, and the
   whole band sits inside the max-width:720px regime above, so there is no width
   at which the 58px slot / 152px card pair can reach this rule.

   The radar is LIFTED rather than either box narrowed, because both sizes are
   load-bearing: 46px is the touch floor for the one HUD control a phone must be
   able to hit, and the 105px card is what the radar rebuild derived its zone
   geometry and its 8C7A5E stroke luma against. safe-b + 84 clears the tray
   (18 + 46 = 64) by 20px, which also clears the selected slot's 3px lift and its
   glow, and it stays clear of .hud-mute, which is bottom-LEFT at safe-b + 68.

   Deliberately NOT keyed on touch. html.fa-touch-capable already moves the radar
   to the top right and beats this rule on specificity (0,2,1 against 0,1,0), so a
   real phone is untouched; this is the desktop browser at a portrait window and
   every headless probe in tools/, which is the framing the defect was photographed
   in. Asserted at 0px by tools/tmp/menu_accept_portrait.mjs at all three widths,
   in both DOM states and with a portrait notch injected. */
@media (max-width: 460px) {
  .hud-radar { bottom: calc(var(--fa-safe-b, 0px) + 84px); }
}

/* ── ...and on a NARROW touch screen the radar has to drop below the clock ───
   Pure geometry again, and it is a consequence of stacking the zone pill. On touch the
   radar is pinned to the top-right at safe-t + 96, a number chosen against a clock
   column that ended around y=90. Stacking the pill and promoting its value made that
   column 13px taller, so it now ends at y=102 — and the clock is 156px wide and
   centred, which is what brings it into the radar's x range at all:

     clock right edge = W/2 + 78                    [156px pill, flex: 0 0 auto]
     radar left edge  = W - safe-r - 12 - 105       [105px card <=720]
     they meet at      W/2 + 78 = W - 117, i.e. W = 390

   Measured against that prediction by tools/tmp/menu_accept_portrait.mjs: 15x6px of
   .hud-clock over .hud-radar at 360x800 touch, and clean at 390 and 430. So the rule
   is keyed at 400 — the crossover plus ten pixels — and nothing wider moves.

   118 = the clock's 102 plus a 16px gutter, the same gutter the rest of this HUD uses.
   Deliberately NOT solved by narrowing the pill: 156px is already the minimum that
   holds "REACHES YOU 0:06" at a readable size, and the phone is the screen that can
   least afford to be handed the unreadable version. Also deliberately NOT solved by
   dropping the pill's progress track, which would leave 4px of clearance and make the
   widget a different shape on phones than on desktop. */
@media (max-width: 400px) {
  html.fa-touch-capable .hud-radar { top: calc(var(--fa-safe-t, 0px) + 118px); }
}

/* ── ...and above two seats the touch radar STOPS GUESSING where the bar ends ──
   🚨 THE TWO RULES ABOVE ARE CONSTANTS DERIVED FROM AN ASSUMED BAR HEIGHT, AND THE
   CHIP RAIL BROKE THE ASSUMPTION. Their own comments say so: 96 was chosen against
   "a clock column that ended around y=90", and 118 is "the clock's 102 plus a 16px
   gutter". Both are true of a bar that is one row at every seat count, which it was
   until this pass. With a rail it is 102px at two seats, 141px at six on a 390-wide
   phone and 229px at six on a 360-wide one — so the radar, which touch moves into
   the TOP-RIGHT CORNER the rail grows from, ends up underneath it.

   Measured by h49_chips --touch before this rule existed: .hud-chips overlapped
   .hud-radar at ALL THREE portrait widths menu_accept_portrait covers (360, 390,
   430) and at NONE of them in the plain DOM state — i.e. the collision lived
   entirely in the state no probe was looking at, which is why the probe now walks
   both and why .hud-radar is in its landmark set at all despite being a SIBLING
   of the top bar rather than a child.

   ⚠️ AND THIS COMMENT LOST ITS BACKTICKS THE HARD WAY, TWICE IN ONE PASS. The sheet
   is a template literal; one backtick in a CSS comment ends the string and the file
   stops parsing. Do not put them back.

   --fa-topbar-b is the bar's measured bottom, published by floatFloorY() on the
   same layout read that already feeds the float pills and the damage-layer clip —
   no new getBoundingClientRect, and it re-reads when the SEAT COUNT changes as well
   as the viewport (see that function's cache note).

   ⚠️ SCOPED TO .hud-topbar--chips, AND THAT IS THE ACCEPTANCE TEST, NOT TIDINESS.
   At two fighters the class does not exist, this selector cannot match, and the two
   rules above keep their exact constants — so the duel's pixels are untouched. The
   118px fallback is today's ≤400 value, so even a frame rendered before the first
   layout read lands where it lands now. Specificity (0,3,1) beats (0,2,1), which is
   what lets it win without !important and without reordering anything above it. */
html.fa-touch-capable .hud-topbar--chips ~ .hud-radar {
  top: calc(var(--fa-topbar-b, 118px) + 16px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   LANDSCAPE PHONE: THE TRAY LEAVES THE CENTRE OF PLAY
   ═══════════════════════════════════════════════════════════════════════════

   🚨 URI, FROM A LANDSCAPE PHONE: "the weapon choosing is on the most critical part
   of the screen where most gameplay happens." He is right, and the rule this replaces
   said the opposite in as many words — .hud-weapons above still opens with

       "Bottom-CENTRE, which on a phone in landscape is the one band along the bottom
        edge that neither thumb rests on"

   which is true about THUMBS and silent about the WORLD. Both thumbs are indeed clear
   of it; the arena is not. That sentence is kept above rather than deleted, because it
   records the reasoning this rule reverses.

   ── THE MEASUREMENT THAT SETTLES IT ────────────────────────────────────────
   tools/tmp/lu_occlude.mjs scores a control in the one currency that means anything
   here: the share of FAIR_PLAY.radiusUnits (199.2 wu, camera.ts, derived from
   rules.ts) that it HIDES. Not pixels — a pixel at the bottom of a 58 degree frame
   shows a fraction of the ground a pixel at the top does, so a pixel metric flatters
   every control along the bottom edge, which is where all of them are.

   Measured at e10baf6, fa-touch on, three landscape phone viewports:

       viewport    weapon tray hides    all controls together
       ─────────   ──────────────────   ─────────────────────
       844x390     7.92% of the disc    21.88%
       667x375     5.75%                22.66%
       932x430     6.45%                17.01%

   ── WHY THE CORNER IS NOT JUST TIDIER, IT IS ARITHMETICALLY CHEAPER ────────
   The guarantee is a DISC inscribed in the frame. A disc inscribed in a rectangle
   does not reach the rectangle's corners — so ground area hidden by a corner control
   tends to zero while ground hidden by a centre-bottom one does not. The reference
   pattern this genre settled on ("controls in the corners, the centre kept clear") is
   therefore not a style: it is the layout that minimises exactly this quantity, and
   the instrument arrives at it independently.

   ── THE SHAPE ──────────────────────────────────────────────────────────────
   A two-column cluster pinned to the BOTTOM-RIGHT corner, i.e. on the fire thumb's
   own side, which is where this genre puts the buttons that thumb has to reach. Slots
   stay 46px — the touch floor this HUD already committed to, and the reason the tray
   is not simply made smaller. Four weapons give 2x2; the roster runs 1 to 4 weapons
   (rules.ts: donut 1, lollipop 2, six at 3, three at 4) and a wrapping two-column grid
   holds every one of them without a second template.

   ⚠️ SCOPED TO html.fa-touch-capable AND TO LANDSCAPE, AND BOTH HALVES ARE LOAD-BEARING.
   * fa-touch-capable, because a DESKTOP tray is a readout with 1-4 printed on it, not
     a control a thumb must hit; bottom-centre is where the eye already is and nothing
     about it is in anyone's way. It also means menu_accept's five landscape viewports
     and every existing headless probe see byte-identical pixels, so this pass cannot
     move a number it was not aimed at.
   * (orientation: landscape), because portrait is DECISIONS §14's rotate-prompt case
     and menu_accept_portrait (219) is a shipped gate over it. Portrait keeps the
     centre tray it was measured with.
   ⚠️ NOT keyed on width. A tablet in landscape is a coarse pointer with two thumbs on
   the same two corners; the defect is the pointer and the orientation, not the size. */
@media (orientation: landscape) {
  html.fa-touch-capable .hud-weapons {
    left: auto;
    transform: none;
    right: calc(var(--fa-safe-r, 0px) + 12px);
    bottom: calc(var(--fa-safe-b, 0px) + 12px);
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-items: center;
    align-items: center;
    gap: 8px;
  }

  /* ── 58px HERE EVEN BELOW 720, AND THAT IS A REVERSAL WORTH READING ────────
     The max-width: 720px rule above takes a slot to 46px, and its own comment calls 46
     "the touch floor for the one HUD control a phone must be able to hit". It was never
     a preference for a smaller button — it was arithmetic forced by FOUR OF THEM IN A
     ROW: 4 x 58 + 3 x 10 = 262px of a 667px frame, sitting across the middle. In two
     columns the constraint is gone (2 x 58 + 8 = 124px), so the phone gets the LARGER
     target rather than the smaller one, which is the right way round and was not
     available before.

     🚨 AND FIXING IT HERE IS WHAT MAKES THE CLUSTER ONE WIDTH AT EVERY VIEWPORT.
     That is not tidiness, it is the fix for a measured defect: game/touch.ts has to
     place the aim hint clear of this cluster, and it can only do that with a constant
     if the cluster IS a constant. The first cut let the 720px breakpoint through, so the
     cluster was 124px wide above it and 100px below — and tools/tmp/lu_land.mjs caught
     an 8px label collision at 844, 932 and 740 and a clean pass at 667, from ONE
     offset that was correct for the narrow case only. Two files, two stylesheets, one
     silent coupling. Now: 124px everywhere, and lu_land asserts the clearance. */
  html.fa-touch-capable .hud-weapons .hud-weapon-slot {
    width: 58px;
    height: 58px;
    border-radius: 16px;
  }
  html.fa-touch-capable .hud-weapons .hud-weapon-emoji { font-size: 26px; }

  /* ═════════════════════════════════════════════════════════════════════════
     ...AND THE CLOCK LIES DOWN, BECAUSE IT BECAME THE BIGGEST OCCLUDER IN THE FRAME

     🚨 THE TRAY PASS ABOVE MEASURED WHAT IT LEFT BEHIND, AND THE ANSWER WAS THIS
     COLUMN. Same instrument, same three viewports, same currency — the share of
     FAIR_PLAY.radiusUnits (199.2 wu) a control HIDES:

         viewport   the tray BEFORE that pass   the clock column, after it
         ────────   ─────────────────────────   ──────────────────────────
         844x390    7.92%                       13.12%
         667x375    5.75%                        9.01%
         932x430    6.45%                       10.21%

     So the control this HUD had never questioned was hiding two-thirds more of the
     guaranteed arena than the one Uri complained about.

     ── WHY IT IS EXPENSIVE, AND IT IS NOT "BECAUSE IT IS BIG" ─────────────────
     lu_occlude now reports the disc's TOP ARC. The guarantee is a DISC around the
     local fighter, so on a pitched frame it has a top edge, and ground above that
     edge is more than 199.2 wu away and is worth EXACTLY ZERO however many pixels it
     covers. Measured, at all three landscape phone viewports:

         844x390  the arc is at y = 52px (13.3% down the frame)
         667x375                  y = 52px (13.9%)
         932x430                  y = 60px (14.0%)

     ⚠️ AND THE ARC IS AN ARC — it PEAKS at the horizontal centre and falls away to
     both sides, which is why the two nameplates, 300px wide and 65px tall each, cost
     0.07% between them while a 196x108 column at dead centre costs 13.12%. The top
     centre is the most expensive square the frame has. So the lever is HEIGHT, not
     area: a control that fits above its own local arc is free, and a wide short one
     is cheaper than a narrow tall one of the same area because its ends reach out to
     where the arc is lower.

     ── THE SHAPE ─────────────────────────────────────────────────────────────
     The column becomes a ROW — timer pill beside the zone plate rather than above it
     — at the sizes the max-width:720px block already ships to phones, and the bar
     lifts from 14px to 6px off the top so the row lands inside the free band instead
     of straddling it. Measured on the same three viewports, share of the guaranteed
     arena hidden by the clock (lu_occlude, .hud-clock box / its two ink leaves):

         viewport   before            after            top bar height, touch
         ────────   ───────────────   ──────────────   ─────────────────────
         844x390    13.12% / 12.51%   0.49% / 0.47%    122px -> 71px
         667x375     9.01% /  9.01%   0.93% / 0.85%    103px -> 63px
         932x430    10.21% /  9.91%   0.00% / 0.00%

     and every control together goes 16.44% -> 4.33%, 20.86% -> 12.58%,
     12.13% -> 2.21%. The known-bad arm reinstates the pre-change plate inline and
     reproduces 12.51 / 9.01 / 9.91 exactly, so the before column is a paired reading
     on this same tree rather than a number remembered from another one.

     ⚠️ THE PLATE ITSELF IS NOT RESTYLED AND THAT IS DELIBERATE. Every value below is
     lifted verbatim from the max-width:720px block, which a landscape phone MISSES
     because it is 844 or 932 CSS px wide — wide, but only 390 tall. That block is
     the phone treatment; the breakpoint that gates it is a width, and a landscape
     phone fails a width test while being exactly the device it was written for. This
     rule is keyed on the pointer and the orientation, like the tray rule above it,
     and it hands the same plate to the same device through the right predicate.

     ⚠️ AND .hud-zone-row STAYS STACKED. Its own comment records that a side-by-side
     label+value overflowed the plate at every viewport and in every state, and that
     stacking is what gave the VALUE its 15px (12.5px here). Laying the CLOCK down is
     not the same change as laying the ZONE's contents down, and only the first one is
     made here — the second would spend a measured legibility fix to buy pixels the
     arc has already made free.

     ⚠️ IT COSTS THE NAMEPLATES SOME WIDTH AND THAT IS STATED, NOT HIDDEN. The clock
     is the middle of a three-part flex row, so a wider clock is narrower nameplates.
     Measured as painted area over the pair (lu_occlude's own rect sum, height
     unchanged): 39 000px2 -> 36 615 at 844 (-6.1% of width) and 26 391 -> 22 020 at
     667 (-16.6%). 667 is the one that has to be argued for rather than waved through,
     and the argument is that it buys 8.2 points of the guaranteed arena back and
     leaves a 232px-class plate at ~194px, which still holds "HAMBURGER" and a
     "70 / 70" bar at the sizes this viewport already uses.

     ⚠️ AT 667 IT ALSO WRAPS THE SIX-SEAT CHIP RAIL, AND THAT WAS CHECKED RATHER THAN
     ASSUMED. The rail needs 220px of side track and the wider clock leaves less, so
     it goes to two rows — which .hud-chips is built to do. h49_chips --touch is
     551/551 either way, and the bar it produces is SHORTER than before at every cell:
     122 -> 71px at 844 (all seat counts) and 103 -> 63px at 667, rising only to 89px
     at six seats there, against the 102px the clock column alone used to cost. The
     touch radar derives its top from --fa-topbar-b, so it follows all of that for
     free. */
  html.fa-touch-capable .hud-topbar { top: calc(var(--fa-safe-t, 0px) + 6px); }
  html.fa-touch-capable .hud-clock { flex-direction: row; align-items: flex-start; gap: 6px; }
  html.fa-touch-capable .hud-timer { font-size: 16px; padding: 4px 12px; }
  html.fa-touch-capable .hud-zone { width: 156px; padding: 3px 7px 5px; }
  html.fa-touch-capable .hud-zone-label { font-size: 9px; letter-spacing: 0.08em; }
  html.fa-touch-capable .hud-zone-value { font-size: 12.5px; }
  /* (0,4,1), so it beats .hud-zone.is-danger .hud-zone-label at (0,3,1). Without it
     the alarm state would keep the desktop 11px and the row would grow ~2px taller in
     exactly the state the player is being burned in. */
  html.fa-touch-capable .hud-zone.is-danger .hud-zone-label { font-size: 10px; }
}
/* ⚠️ THE AIM STICK'S RESTING HINT HAS TO MOVE OFF THIS CLUSTER, AND THAT RULE IS NOT
   HERE. It lives beside the element it restyles, in game/touch.ts (search for
   "the cluster this HUD now parks in that corner"), because .tch-hint--aim is that
   module's element and a cross-file rule for it is a rule nobody maintaining either
   file would find. The arithmetic tying the two together is written out there. */
`;
