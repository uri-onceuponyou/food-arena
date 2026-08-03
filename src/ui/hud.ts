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

import { CHARACTERS, MATCH_DURATION_MS, type CharacterId, type Weapon } from '../game/rules';
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
  spawnDamageNumber(point: ScreenPoint, amount: number, opts?: { heal?: boolean }): void;
  /** Brief full-viewport radial flash, tinted `color` — reserved for genuinely
   * screen-filling moments (Lollipop's Giant Lollipop). Always pointer-events:none. */
  flashScreen(color: string): void;
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
        <div class="hud-timer" data-el="timer">3:00</div>
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
      el.textContent = heal ? `+${Math.round(amount)}` : `-${Math.round(amount)}`;
      el.className = `hud-dmg ${big ? 'hud-dmg--big' : medium ? 'hud-dmg--medium' : 'hud-dmg--small'}${heal ? ' hud-dmg--heal' : ''}`;
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

.hud-timer {
  flex: 0 0 auto;
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
  align-items: center;
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
}
`;
