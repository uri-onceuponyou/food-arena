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

import { CHARACTERS, FOG_DAMAGE, FOG_TICK_MS, MATCH_DURATION_MS, type CharacterId, type Weapon } from '../game/rules';
import type { FighterRole, MatchState } from '../game/state';

export interface HudCallbacks {
  onRestart: () => void;
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
          <!-- Drawn OVER the safe disc: at match start the disc is wider than the map
               and the widget would otherwise be a blank cream card with two dots on
               it. A grid makes it read as a map in every state. -->
          <div class="hud-radar-grid"></div>
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
  const radarPlayerEl = q<HTMLDivElement>('radar-player');
  const radarEnemyEl = q<HTMLDivElement>('radar-enemy');
  const radarCapEl = q<HTMLDivElement>('radar-cap');
  const fogEdgeEl = q<HTMLDivElement>('fogedge');
  const fogTickEl = q<HTMLDivElement>('fogtick');
  const safeArrowEl = q<HTMLDivElement>('safearrow');
  const safeArrowLabelEl = q<HTMLDivElement>('safearrow-label');
  const aimStickEl = q<HTMLDivElement>('aim-stick');
  const aimReticleEl = q<HTMLDivElement>('aim-reticle');

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
        <div class="hud-weapon-emoji">${w.emoji}</div>
        <div class="hud-weapon-timer" data-role="timer"></div>
        <div class="hud-weapon-key">${i + 1}</div>
      `;
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
   * Everything the zone readouts need, derived from the sim state alone.
   *
   * `sim.ts` shrinks the ring as `safeRadius = maxSafeRadius * timeRemaining /
   * MATCH_DURATION_MS` — a continuous linear close, NOT the stepped "next circle" of
   * a battle royale. So there is no "next shrink" to count down to; the useful number
   * is when the edge will sweep over WHERE THE PLAYER IS STANDING, which inverts that
   * same formula. If the shrink schedule in `sim.ts` ever stops being linear in time,
   * this inversion has to change with it.
   */
  function zoneInfo(state: MatchState): {
    outside: boolean;
    radius01: number;
    /** ms until the edge reaches the player's current spot; null once outside. */
    msUntilEdge: number | null;
  } {
    const maxR = state.arena.maxSafeRadius;
    const dist = Math.hypot(state.player.x - state.arena.center.x, state.player.y - state.arena.center.y);
    const outside = dist > state.safeRadius;
    const shrinkPerMs = maxR / MATCH_DURATION_MS; // world units of radius per ms
    return {
      outside,
      radius01: maxR > 0 ? Math.max(0, Math.min(1, state.safeRadius / maxR)) : 0,
      msUntilEdge: outside || shrinkPerMs <= 0 ? null : (state.safeRadius - dist) / shrinkPerMs,
    };
  }

  function renderZone(state: MatchState, frame: HudFrameInfo): void {
    const live = state.phase === 'playing';
    const info = zoneInfo(state);
    const danger = live && info.outside && state.player.alive;

    zoneEl.classList.toggle('is-danger', danger);
    // Warn BEFORE it costs HP. The edge sweeps at maxSafeRadius / MATCH_DURATION_MS
    // ~= 4.7 wu/s, so 12 s is roughly 57 wu of grace — comfortably more than the
    // guaranteed view radius gives you to notice the curtain arriving on its own.
    zoneEl.classList.toggle('is-imminent', !danger && info.msUntilEdge !== null && info.msUntilEdge < 12_000);
    zoneBarEl.style.width = `${(info.radius01 * 100).toFixed(1)}%`;

    if (danger) {
      zoneLabelEl.textContent = '\u25B2 OUTSIDE THE ZONE';
      zoneValueEl.textContent = `−${FOG_DPS} HP/s`;
    } else {
      zoneLabelEl.textContent = 'SAFE ZONE';
      // Shown during the countdown too, not just while playing: the ring's schedule is
      // already fixed then, so previewing "how long this spot stays safe" is honest,
      // and it beats a phase-dependent placeholder that teaches the player nothing.
      //
      // Wording matters here and was changed after a blind critic read the first
      // version, "closes on you 0:08", as genuinely ambiguous English — it can mean
      // "the ring is closing toward you" or "the ring closes in 8 seconds", and a
      // player who does not already understand the mechanic cannot tell which.
      // "REACHES YOU 0:08" states the relationship to the player and has one reading.
      zoneValueEl.textContent = info.msUntilEdge !== null
        ? `REACHES YOU ${formatTime(info.msUntilEdge)}`
        : 'CLOSING';
    }

    // ── Radar ────────────────────────────────────────────────────────────────
    // Percentages against the arena's own extents, so the whole widget is correct
    // for any arena size without a magic scale factor. The map box's aspect ratio is
    // pinned to the arena's in CSS, which is what keeps the safe circle circular.
    const aw = state.arena.width;
    const ah = state.arena.height;
    const pct = (v: number, span: number) => `${((v / span) * 100).toFixed(2)}%`;
    radarSafeEl.style.left = pct(state.arena.center.x, aw);
    radarSafeEl.style.top = pct(state.arena.center.y, ah);
    // Diameter as a % of WIDTH for both axes — the box has the arena's aspect, so a
    // square in those terms is a square on screen, and the circle stays a circle.
    const diaPct = ((state.safeRadius * 2) / aw) * 100;
    radarSafeEl.style.width = `${diaPct.toFixed(2)}%`;
    radarSafeEl.style.paddingBottom = '0';
    radarSafeEl.style.height = `${((state.safeRadius * 2) / ah) * 100}%`;
    radarPlayerEl.style.left = pct(state.player.x, aw);
    radarPlayerEl.style.top = pct(state.player.y, ah);
    radarPlayerEl.style.display = state.player.alive ? 'block' : 'none';
    radarEnemyEl.style.left = pct(state.enemy.x, aw);
    radarEnemyEl.style.top = pct(state.enemy.y, ah);
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
      playerEmoji.textContent = CHARACTERS[playerId].emoji;
      enemyEmoji.textContent = CHARACTERS[enemyId].emoji;
      floatPlayerEmoji.textContent = CHARACTERS[playerId].emoji;
      floatEnemyEmoji.textContent = CHARACTERS[enemyId].emoji;
      buildWeaponSlots(CHARACTERS[playerId].weapons);
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
        gameoverSubtitleEl.innerHTML =
          `<span class="hud-go-emoji">${winnerChar.emoji}</span>${winnerChar.name}` +
          `<span class="hud-go-vs">defeated</span>` +
          `<span class="hud-go-emoji">${loserChar.emoji}</span>${loserChar.name}`;

        const elapsedMs = Math.max(0, MATCH_DURATION_MS - state.timeRemaining);
        gameoverStatsEl.textContent = `⏱ Match time ${formatDuration(elapsedMs)}`;
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

.hud-topbar {
  position: absolute;
  top: 14px;
  left: 14px;
  right: 14px;
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
  background: rgba(26,18,36,0.78);
  border: 3px solid #1a1224;
  border-radius: 12px;
  padding: 5px 9px 6px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
}
.hud-zone-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
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
  letter-spacing: 0.02em;
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
   violet field = lethal, cream disc = safe, green dot = you. Bottom-right, the
   genre's habitual minimap corner, clear of the weapon bar and both nameplates. */
.hud-radar {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.hud-radar-map {
  position: relative;
  width: 152px;
  /* Pinned to the arena's 1400x1000 aspect so the safe disc renders as a circle. */
  height: 109px;
  border: 3px solid #1a1224;
  border-radius: 10px;
  /* Everything outside the disc is lethal, so the map's own background IS the
     danger field — no separate overlay to get the z-order wrong. Deliberately the
     same near-black violet the 3D field uses, and deliberately DARKER than the safe
     disc, so the radar teaches the same "dark = death, bright = live" reading the
     world does. */
  background: #2A0B47;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35), inset 0 0 0 1px rgba(233,166,255,0.4);
  overflow: hidden;
}
.hud-radar-safe {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #F2E0BE;
  box-shadow: inset 0 0 0 2px #E9A6FF, 0 0 10px 2px rgba(233,166,255,0.85);
  transition: width 0.2s linear, height 0.2s linear;
}
.hud-radar-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-linear-gradient(90deg, rgba(26,18,36,0.22) 0 1px, rgba(0,0,0,0) 1px 25%),
    repeating-linear-gradient(0deg, rgba(26,18,36,0.22) 0 1px, rgba(0,0,0,0) 1px 33.34%);
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
.hud-weapons {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
}

/* A light, warm plate — not the dark card used everywhere else in this HUD — is a
   deliberate exception: readiness has to read from the icon itself (bright emoji =
   usable), and a dark cooldown wedge sweeping over a DARK card is nearly invisible
   (measured — see the fix note on .hud-weapon-cooldown below). A light plate is
   the one background dark-on-dark contrast actually resolves against. */
.hud-weapon-slot {
  position: relative;
  width: 58px;
  height: 58px;
  background: #FFF3DE;
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
.hud-go-emoji { font-size: 20px; line-height: 1; }
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
  .hud-weapon-emoji { font-size: 20px; }
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
`;
