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
  MIN_SAFE_RADIUS,
  type CharacterId,
  type Weapon,
} from '../game/rules';
import type { FighterRole, MatchState } from '../game/state';
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
}

export interface Hud {
  /** Call once per frame with the live match state. */
  update(state: MatchState, frame: HudFrameInfo): void;
  /** Call once, as soon as the two fighters are known, to label bars and build weapon slots. */
  setCharacters(playerId: CharacterId, enemyId: CharacterId): void;
  /** Position the floating name+health pills above each fighter's head. Pass null to hide one. */
  updateFloatingBars(player: ScreenPoint | null, enemy: ScreenPoint | null, player01: number, enemy01: number): void;
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
      <div class="hud-topbar">
        <div class="hud-fighter hud-fighter--player">
          <div class="hud-fighter-pill">
            <div class="hud-fighter-emoji" data-el="player-emoji"></div>
            <div class="hud-fighter-name" data-el="player-name"></div>
          </div>
          <div class="hud-healthbar hud-healthbar--player" data-el="player-bar">
            <div class="hud-healthbar-fill" data-el="player-fill"></div>
            <div class="hud-healthbar-text" data-el="player-hp"></div>
          </div>
        </div>
        <div class="hud-clock">
          <div class="hud-timer" data-el="timer">3:00</div>
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
        <div class="hud-fighter hud-fighter--enemy">
          <div class="hud-fighter-pill">
            <div class="hud-fighter-name" data-el="enemy-name"></div>
            <div class="hud-fighter-emoji" data-el="enemy-emoji"></div>
          </div>
          <div class="hud-healthbar hud-healthbar--enemy" data-el="enemy-bar">
            <div class="hud-healthbar-fill" data-el="enemy-fill"></div>
            <div class="hud-healthbar-text" data-el="enemy-hp"></div>
          </div>
        </div>
      </div>

      <div class="hud-weapons" data-el="weapons"></div>

      <div class="hud-countdown" data-el="countdown"></div>

      <div class="hud-gameover" data-el="gameover">
        <div class="hud-gameover-card">
          <div class="hud-gameover-title" data-el="gameover-title"></div>
          <div class="hud-gameover-subtitle" data-el="gameover-subtitle"></div>
          <div class="hud-gameover-stats" data-el="gameover-stats"></div>
          <button class="hud-gameover-btn" data-el="gameover-btn" type="button">Play Again</button>
        </div>
      </div>

      <!-- Deliberately NO name TEXT here — the top-corner nameplates are the one
           canonical place to read "who is who"; repeating the full name would just
           split attention between two labels for the same two fighters. A small
           emoji badge (matching the corner pill's language, not its text) plus a
           chunky bar on a solid backing plate keeps this legible against any floor
           colour without reintroducing that duplicate readout. -->
      <div class="hud-float hud-float--player" data-el="float-player">
        <div class="hud-float-pill">
          <div class="hud-float-emoji" data-el="float-player-emoji"></div>
          <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-player-fill"></div></div>
        </div>
      </div>
      <div class="hud-float hud-float--enemy" data-el="float-enemy">
        <div class="hud-float-pill">
          <div class="hud-float-emoji" data-el="float-enemy-emoji"></div>
          <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-enemy-fill"></div></div>
        </div>
      </div>

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
          <div class="hud-radar-dot hud-radar-dot--enemy" data-el="radar-enemy"></div>
          <div class="hud-radar-dot hud-radar-dot--player" data-el="radar-player"></div>
        </div>
        <div class="hud-radar-cap" data-el="radar-cap">SAFE ZONE</div>
      </div>

      <div class="hud-safearrow" data-el="safearrow">
        <div class="hud-safearrow-chevron"></div>
        <div class="hud-safearrow-chevron hud-safearrow-chevron--2"></div>
      </div>
      <div class="hud-safearrow-label" data-el="safearrow-label">RUN TO THE ZONE</div>

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
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!el) throw new Error(`hud: missing element "${sel}"`);
    return el;
  };

  const playerName = q<HTMLDivElement>('player-name');
  const enemyName = q<HTMLDivElement>('enemy-name');
  const playerEmoji = q<HTMLDivElement>('player-emoji');
  const enemyEmoji = q<HTMLDivElement>('enemy-emoji');
  const playerBar = q<HTMLDivElement>('player-bar');
  const enemyBar = q<HTMLDivElement>('enemy-bar');
  const playerFill = q<HTMLDivElement>('player-fill');
  const enemyFill = q<HTMLDivElement>('enemy-fill');
  const playerHpText = q<HTMLDivElement>('player-hp');
  const enemyHpText = q<HTMLDivElement>('enemy-hp');
  const timerEl = q<HTMLDivElement>('timer');
  const weaponsEl = q<HTMLDivElement>('weapons');
  const countdownEl = q<HTMLDivElement>('countdown');
  const gameoverEl = q<HTMLDivElement>('gameover');
  const gameoverTitleEl = q<HTMLDivElement>('gameover-title');
  const gameoverSubtitleEl = q<HTMLDivElement>('gameover-subtitle');
  const gameoverStatsEl = q<HTMLDivElement>('gameover-stats');
  const gameoverBtn = q<HTMLButtonElement>('gameover-btn');

  const floatPlayer = q<HTMLDivElement>('float-player');
  const floatEnemy = q<HTMLDivElement>('float-enemy');
  const floatPlayerEmoji = q<HTMLDivElement>('float-player-emoji');
  const floatEnemyEmoji = q<HTMLDivElement>('float-enemy-emoji');
  const floatPlayerFill = q<HTMLDivElement>('float-player-fill');
  const floatEnemyFill = q<HTMLDivElement>('float-enemy-fill');

  const dmgLayer = q<HTMLDivElement>('dmg-layer');
  const screenflashEl = q<HTMLDivElement>('screenflash');

  const zoneEl = q<HTMLDivElement>('zone');
  const zoneLabelEl = q<HTMLDivElement>('zone-label');
  const zoneValueEl = q<HTMLDivElement>('zone-value');
  const zoneBarEl = q<HTMLDivElement>('zone-bar');
  const radarEl = q<HTMLDivElement>('radar');
  const radarSafeEl = q<HTMLDivElement>('radar-safe');
  const radarArenaEl = q<HTMLDivElement>('radar-arena');
  const radarPlayerEl = q<HTMLDivElement>('radar-player');
  const radarEnemyEl = q<HTMLDivElement>('radar-enemy');
  const radarCapEl = q<HTMLDivElement>('radar-cap');
  const fogEdgeEl = q<HTMLDivElement>('fogedge');
  const fogTickEl = q<HTMLDivElement>('fogtick');
  const safeArrowEl = q<HTMLDivElement>('safearrow');
  const safeArrowLabelEl = q<HTMLDivElement>('safearrow-label');
  const aimStickEl = q<HTMLDivElement>('aim-stick');
  const aimReticleEl = q<HTMLDivElement>('aim-reticle');
  const muteEl = q<HTMLDivElement>('mute');

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
   *  1. It cries wolf. 265 wu of a 993 wu opening ring is most of the standing
   *     positions inside it, so the alarm animation would be running for a large
   *     share of every match — and `docs/LESSONS.md` §9's lesson is that a warning
   *     which cries wolf gets ignored, which is worse than no warning.
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
   *   45 s clock:   199.2 / (993/45000)  = 9.0 s
   *   180 s clock:  199.2 / (890/180000) = 40.3 s -> capped to 12 s (unchanged)
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
  } {
    const maxR = state.arena.maxSafeRadius;
    const dist = Math.hypot(state.player.x - state.arena.center.x, state.player.y - state.arena.center.y);
    const outside = dist > state.safeRadius;
    const shrinkPerMs = maxR / MATCH_DURATION_MS; // world units of radius per ms
    const holds = dist <= MIN_SAFE_RADIUS;
    return {
      outside,
      holds,
      radius01: maxR > 0 ? Math.max(0, Math.min(1, state.safeRadius / maxR)) : 0,
      msUntilEdge:
        outside || holds || shrinkPerMs <= 0 ? null : (state.safeRadius - dist) / shrinkPerMs,
    };
  }

  function renderZone(state: MatchState, frame: HudFrameInfo): void {
    const live = state.phase === 'playing';
    const info = zoneInfo(state);
    const danger = live && info.outside && state.player.alive;
    const maxR = state.arena.maxSafeRadius;

    zoneEl.classList.toggle('is-imminent', !danger && info.msUntilEdge !== null && info.msUntilEdge < imminentMs(maxR));
    zoneBarEl.style.width = `${(info.radius01 * 100).toFixed(1)}%`;

    if (danger) {
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
    // And it gets worse, not better, as the clock shortens: T went 180s -> 45s this
    // session and MAX_SAFE_RADIUS is derived from T, so the opening ring grew 890 ->
    // 993 wu. Nothing below is allowed to hardcode either number.
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

    radarPlayerEl.style.left = wx(state.player.x);
    radarPlayerEl.style.top = wy(state.player.y);
    radarPlayerEl.style.display = state.player.alive ? 'block' : 'none';
    radarEnemyEl.style.left = wx(state.enemy.x);
    radarEnemyEl.style.top = wy(state.enemy.y);
    radarEnemyEl.style.display = state.enemy.alive ? 'block' : 'none';
    radarEl.classList.toggle('is-danger', danger);
    radarCapEl.textContent = danger ? 'GET INSIDE' : 'SAFE ZONE';

    // ── Danger vignette + chevron ────────────────────────────────────────────
    fogEdgeEl.classList.toggle('is-on', danger);
    const arrow = danger ? frame.safeArrow ?? null : null;
    if (arrow) {
      safeArrowEl.style.display = 'block';
      safeArrowLabelEl.style.display = 'block';
      const deg = (arrow.angleRad * 180) / Math.PI;
      safeArrowEl.style.transform =
        `translate(${arrow.at.x.toFixed(1)}px, ${arrow.at.y.toFixed(1)}px) rotate(${deg.toFixed(1)}deg)`;
      // The label rides PAST the chevron tip along the same direction, never at a
      // fixed screen offset: pinned below the player it collided with the arrow every
      // time safety happened to lie downward, which is a quarter of all cases.
      const lx = arrow.at.x + Math.cos(arrow.angleRad) * 178;
      const ly = arrow.at.y + Math.sin(arrow.angleRad) * 178;
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
    setCharacters(playerId, enemyId) {
      playerCharId = playerId;
      playerName.textContent = CHARACTERS[playerId].name;
      enemyName.textContent = CHARACTERS[enemyId].name;
      playerEmoji.innerHTML = portraitMarkup(playerId, { crop: 'head' });
      enemyEmoji.innerHTML = portraitMarkup(enemyId, { crop: 'head' });
      floatPlayerEmoji.innerHTML = portraitMarkup(playerId, { crop: 'head' });
      floatEnemyEmoji.innerHTML = portraitMarkup(enemyId, { crop: 'head' });
      buildWeaponSlots(CHARACTERS[playerId].weapons);
      // generate:false is load bearing. This runs at match start; standing up an
      // offscreen renderer here to make a 24px badge would be a hitch in a live
      // fight. Character select has already warmed the shared cache in every real
      // flow, so this is a cache read. See ui/icons/portraits.ts.
      hydratePortraits(root, { generate: false });
    },

    update(state, frame) {
      setBar(playerFill, playerHpText, state.player.hp, state.player.maxHp);
      setBar(enemyFill, enemyHpText, state.enemy.hp, state.enemy.maxHp);
      timerEl.textContent = formatTime(state.timeRemaining);

      // Danger pulse once a fighter's own bar reads critically low — a fast,
      // unmistakable "you are about to die" signal that doesn't depend on reading
      // the numeric text at all.
      const playerFrac = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 0;
      const enemyFrac = state.enemy.maxHp > 0 ? state.enemy.hp / state.enemy.maxHp : 0;
      playerBar.classList.toggle('is-low', state.player.alive && playerFrac <= LOW_HP_FRACTION);
      enemyBar.classList.toggle('is-low', state.enemy.alive && enemyFrac <= LOW_HP_FRACTION);

      if (playerCharId) {
        const weapons = CHARACTERS[playerCharId].weapons;
        const lastUsed = state.player.lastUsed;
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
        const won = state.winner === 'player';
        gameoverTitleEl.textContent = won ? 'VICTORY!' : 'DEFEAT!';
        gameoverTitleEl.classList.toggle('is-win', won);
        gameoverTitleEl.classList.toggle('is-lose', !won);

        const winnerRole: FighterRole = state.winner ?? 'player';
        const loserRole: FighterRole = winnerRole === 'player' ? 'enemy' : 'player';
        const winnerChar = CHARACTERS[state[winnerRole].characterId];
        const loserChar = CHARACTERS[state[loserRole].characterId];
        // ── "defeated" is only true of a KNOCKOUT ─────────────────────────────
        // `sim.ts` now ends a match that runs out of clock, and it does so WITHOUT a
        // death: `resolveTimeout` picks a winner on HP fraction, then zone control,
        // then the human, and deliberately leaves both fighters `alive`. So a timeout
        // is exactly the case where nobody defeated anybody, and that is also the
        // case a player is most likely to want explained — they are looking at a
        // result screen with two living fighters on it. Both fighters still standing
        // is the tell, and it costs one comparison.
        const timedOut = state.player.alive && state.enemy.alive;
        gameoverSubtitleEl.innerHTML =
          `<span class="hud-go-emoji">${portraitMarkup(state[winnerRole].characterId, { crop: 'head' })}</span>${winnerChar.name}` +
          `<span class="hud-go-vs">${timedOut ? 'outlasted' : 'defeated'}</span>` +
          `<span class="hud-go-emoji">${portraitMarkup(state[loserRole].characterId, { crop: 'head' })}</span>${loserChar.name}`;
        hydratePortraits(gameoverSubtitleEl, { generate: false });

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
      } else {
        gameoverEl.style.display = 'none';
      }
    },

    updateFloatingBars(player, enemy, player01, enemy01) {
      if (player) {
        floatPlayer.style.display = 'flex';
        floatPlayer.style.transform = `translate(${player.x.toFixed(1)}px, ${player.y.toFixed(1)}px) translate(-50%, -100%)`;
        const frac = Math.max(0, Math.min(1, player01));
        floatPlayerFill.style.width = `${(frac * 100).toFixed(1)}%`;
        floatPlayerFill.classList.toggle('is-low', frac > 0 && frac <= LOW_HP_FRACTION);
      } else {
        floatPlayer.style.display = 'none';
      }
      if (enemy) {
        floatEnemy.style.display = 'flex';
        floatEnemy.style.transform = `translate(${enemy.x.toFixed(1)}px, ${enemy.y.toFixed(1)}px) translate(-50%, -100%)`;
        const frac = Math.max(0, Math.min(1, enemy01));
        floatEnemyFill.style.width = `${(frac * 100).toFixed(1)}%`;
        floatEnemyFill.classList.toggle('is-low', frac > 0 && frac <= LOW_HP_FRACTION);
      } else {
        floatEnemy.style.display = 'none';
      }
    },

    spawnDamageNumber(point, amount, opts) {
      const el = dmgPool[dmgCursor];
      dmgCursor = (dmgCursor + 1) % dmgPool.length;
      const heal = !!opts?.heal;
      const big = amount >= 15;
      const medium = !big && amount >= 6;
      el.style.setProperty('--x', `${point.x.toFixed(1)}px`);
      el.style.setProperty('--y', `${point.y.toFixed(1)}px`);
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
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
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
  gap: 4px;
  /* OPAQUE, not 78% alpha. This pill can land on top of the boiling pot's danger
     ring at some framings, and a translucent plate let the ring read straight through
     a zone readout. Chrome that the world shows through is chrome the player can
     misread as world paint. It also buys legibility for an 11px readout for free. */
  background: #1a1224;
  border: 3px solid #0e0916;
  border-radius: 12px;
  padding: 5px 9px 6px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.45);
}
/* gap 4, not 8. With justify-content: space-between the gap only binds at the row's
   MINIMUM width, which is precisely the case that was broken: measured on a rendered
   frame, "REACHES YOU 0:16" overflowed the plate by 7px and "-50 HP/s" by 6px, on all
   five supported viewports, so the tail of the value sat on raw world pixels. That
   defeats the reason the plate is opaque at all (see .hud-zone). The pill cannot
   simply grow — at tablet-4:3 and phone-19.5:9 there are only 10px between it and the
   nameplates either side — so the 7px comes out of the gap and the value's tracking
   instead, which changes nothing about the pill's footprint, its type sizes or its
   wording. Verified 0px overflow at 5 viewports x 3 states by tools/tmp/hud_fit.mjs. */
.hud-zone-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
}
.hud-zone-label {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #E9A6FF;
  white-space: nowrap;
}
.hud-zone-value {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 11px;
  /* 0, not 0.02em. See .hud-zone-row: 0.02em on 11px is 0.22px per character and
     bought nothing, while over a 16-character value it was 3.5px of the 7px that put
     this text outside its own plate. */
  letter-spacing: 0;
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
.hud-zone.is-danger {
  background: rgba(88,20,124,0.9);
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
.hud-zone.is-danger .hud-zone-label { color: #FFFFFF; font-size: 12px; }
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
.hud-radar-cap {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #E9A6FF;
  text-shadow: 0 1px 2px rgba(0,0,0,0.9);
}
.hud-radar.is-danger .hud-radar-map {
  border-color: #E9A6FF;
  animation: hud-zone-alarm 0.6s ease-in-out infinite;
}
.hud-radar.is-danger .hud-radar-cap { color: #FFFFFF; }

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
.hud-dmg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
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
  .hud-zone { width: 156px; padding: 4px 7px 5px; }
  .hud-zone-label, .hud-zone-value { font-size: 9px; }
  .hud-radar-map { width: 105px; height: 75px; }
  .hud-radar-dot { width: 8px; height: 8px; }
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
`;
