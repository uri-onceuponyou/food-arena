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

import { CHARACTERS, type CharacterId, type Weapon } from '../game/rules';
import type { MatchState } from '../game/state';

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

function setBar(fill: HTMLElement, text: HTMLElement, hp: number, maxHp: number): void {
  const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  fill.style.width = `${(frac * 100).toFixed(1)}%`;
  text.textContent = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
}

interface WeaponSlotEls {
  root: HTMLDivElement;
  cooldown: HTMLDivElement;
}

export function createHud(root: HTMLElement, callbacks: HudCallbacks): Hud {
  ensureStyles();

  root.innerHTML = `
    <div class="hud-root">
      <div class="hud-topbar">
        <div class="hud-fighter hud-fighter--player">
          <div class="hud-fighter-name" data-el="player-name"></div>
          <div class="hud-healthbar hud-healthbar--player">
            <div class="hud-healthbar-fill" data-el="player-fill"></div>
            <div class="hud-healthbar-text" data-el="player-hp"></div>
          </div>
        </div>
        <div class="hud-timer" data-el="timer">3:00</div>
        <div class="hud-fighter hud-fighter--enemy">
          <div class="hud-fighter-name" data-el="enemy-name"></div>
          <div class="hud-healthbar hud-healthbar--enemy">
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
          <button class="hud-gameover-btn" data-el="gameover-btn" type="button">Play Again</button>
        </div>
      </div>

      <div class="hud-float hud-float--player" data-el="float-player">
        <div class="hud-float-name" data-el="float-player-name"></div>
        <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-player-fill"></div></div>
      </div>
      <div class="hud-float hud-float--enemy" data-el="float-enemy">
        <div class="hud-float-name" data-el="float-enemy-name"></div>
        <div class="hud-float-bar"><div class="hud-float-fill" data-el="float-enemy-fill"></div></div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const el = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!el) throw new Error(`hud: missing element "${sel}"`);
    return el;
  };

  const playerName = q<HTMLDivElement>('player-name');
  const enemyName = q<HTMLDivElement>('enemy-name');
  const playerFill = q<HTMLDivElement>('player-fill');
  const enemyFill = q<HTMLDivElement>('enemy-fill');
  const playerHpText = q<HTMLDivElement>('player-hp');
  const enemyHpText = q<HTMLDivElement>('enemy-hp');
  const timerEl = q<HTMLDivElement>('timer');
  const weaponsEl = q<HTMLDivElement>('weapons');
  const countdownEl = q<HTMLDivElement>('countdown');
  const gameoverEl = q<HTMLDivElement>('gameover');
  const gameoverTitleEl = q<HTMLDivElement>('gameover-title');
  const gameoverBtn = q<HTMLButtonElement>('gameover-btn');

  const floatPlayer = q<HTMLDivElement>('float-player');
  const floatEnemy = q<HTMLDivElement>('float-enemy');
  const floatPlayerName = q<HTMLDivElement>('float-player-name');
  const floatEnemyName = q<HTMLDivElement>('float-enemy-name');
  const floatPlayerFill = q<HTMLDivElement>('float-player-fill');
  const floatEnemyFill = q<HTMLDivElement>('float-enemy-fill');

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
        <div class="hud-weapon-key">${i + 1}</div>
      `;
      weaponsEl.appendChild(slot);
      return {
        root: slot,
        cooldown: slot.querySelector<HTMLDivElement>('.hud-weapon-cooldown')!,
      };
    });
  }

  return {
    setCharacters(playerId, enemyId) {
      playerCharId = playerId;
      playerName.textContent = CHARACTERS[playerId].name;
      enemyName.textContent = CHARACTERS[enemyId].name;
      floatPlayerName.textContent = CHARACTERS[playerId].name;
      floatEnemyName.textContent = CHARACTERS[enemyId].name;
      buildWeaponSlots(CHARACTERS[playerId].weapons);
    },

    update(state, frame) {
      setBar(playerFill, playerHpText, state.player.hp, state.player.maxHp);
      setBar(enemyFill, enemyHpText, state.enemy.hp, state.enemy.maxHp);
      timerEl.textContent = formatTime(state.timeRemaining);

      if (playerCharId) {
        const weapons = CHARACTERS[playerCharId].weapons;
        const lastUsed = state.player.lastUsed;
        weaponSlots.forEach((slot, i) => {
          const w = weapons[i];
          if (!w) return;
          const remaining = Math.max(0, w.cooldown - (state.elapsed - lastUsed[i]));
          const frac = w.cooldown > 0 ? Math.min(1, remaining / w.cooldown) : 0;
          slot.cooldown.style.setProperty('--p', frac.toFixed(3));
          slot.root.classList.toggle('is-ready', frac <= 0);
          slot.root.classList.toggle('is-selected', i === frame.selectedWeapon);
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
      } else {
        gameoverEl.style.display = 'none';
      }
    },

    updateFloatingBars(player, enemy, player01, enemy01) {
      if (player) {
        floatPlayer.style.display = 'flex';
        floatPlayer.style.transform = `translate(${player.x.toFixed(1)}px, ${player.y.toFixed(1)}px) translate(-50%, -100%)`;
        floatPlayerFill.style.width = `${(Math.max(0, Math.min(1, player01)) * 100).toFixed(1)}%`;
      } else {
        floatPlayer.style.display = 'none';
      }
      if (enemy) {
        floatEnemy.style.display = 'flex';
        floatEnemy.style.transform = `translate(${enemy.x.toFixed(1)}px, ${enemy.y.toFixed(1)}px) translate(-50%, -100%)`;
        floatEnemyFill.style.width = `${(Math.max(0, Math.min(1, enemy01)) * 100).toFixed(1)}%`;
      } else {
        floatEnemy.style.display = 'none';
      }
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
  gap: 4px;
  min-width: 0;
  flex: 1 1 260px;
  max-width: 380px;
}
.hud-fighter--enemy { align-items: flex-end; }

.hud-fighter-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-shadow: 0 2px 0 #1a1224, 0 0 6px rgba(0,0,0,0.5);
}

.hud-healthbar {
  position: relative;
  width: 100%;
  height: 22px;
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
}
.hud-fighter--player .hud-healthbar-fill { background: linear-gradient(180deg, #6FE0A8, #2FAE6E); }
.hud-fighter--enemy .hud-healthbar-fill { background: linear-gradient(180deg, #FF8E7A, #E6493F); }
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

.hud-weapon-slot {
  position: relative;
  width: 58px;
  height: 58px;
  background: rgba(26,18,36,0.82);
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
.hud-weapon-emoji {
  font-size: 26px;
  line-height: 1;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));
  z-index: 1;
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
.hud-weapon-cooldown {
  position: absolute;
  inset: 0;
  border-radius: 13px;
  background: conic-gradient(rgba(8,4,12,0.72) calc(var(--p, 0) * 360deg), transparent 0);
  pointer-events: none;
}
.hud-weapon-slot.is-ready .hud-weapon-cooldown { background: transparent; }

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
.hud-float-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 11px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #FFF3DE;
  text-shadow: 0 2px 0 #1a1224, 0 0 4px rgba(0,0,0,0.6);
  white-space: nowrap;
}
.hud-float-bar {
  width: 64px;
  height: 8px;
  background: #241a30;
  border: 2px solid #1a1224;
  border-radius: 999px;
  overflow: hidden;
}
.hud-float-fill { height: 100%; transition: width 0.15s ease-out; }
.hud-float--player .hud-float-fill { background: #3FCB86; }
.hud-float--enemy .hud-float-fill { background: #E6493F; }

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
