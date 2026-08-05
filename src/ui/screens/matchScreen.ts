/**
 * Match screen — the shell's wrapper around a live `GameSession`.
 *
 * The session owns the canvas, the sim and its own render loop; this screen owns the
 * two things a session cannot: **getting out** and **what a result means**.
 *
 * ── Why the exit affordance is where it is ──────────────────────────────────
 * `ui/hud.ts` already occupies the top-left (player nameplate), the top-centre
 * (clock + zone strip), the top-right (enemy nameplate), the bottom-centre (weapon
 * bar) and the bottom-right (radar). The bottom-LEFT is the only corner it leaves
 * free, so that is where the pause chip and the post-match menu button live, both
 * inside `env(safe-area-inset-*)`.
 *
 * ── ...and why the pause chip now moves on touch ────────────────────────────
 * The trade this header used to record as a future problem has arrived: `game/touch.ts`
 * ships twin FLOATING sticks, and the move stick spawns wherever a thumb lands
 * anywhere in the left half of the screen (`ZONE_SPLIT = 0.5`). A 44px chip parked at
 * the bottom-left corner is therefore sitting inside the move stick's own resting
 * position — a thumb reaching to walk hits Pause instead, mid-fight.
 *
 * Both lower corners belong to thumbs, so "move it to the other corner" is not
 * available; `hud.ts` had the identical problem with the radar and solved it by
 * moving UP the trailing edge. This does the mirror of that on the leading edge:
 * on touch the chip sits directly under the player nameplate, which is the one band
 * of the frame that no HUD element and no thumb occupies.
 *
 * Keyed on `html.fa-touch-capable` — the same class `hud.ts` keys the radar on, set
 * from device capability rather than from the first finger, so the layout is right on
 * the opening frame instead of jumping once someone touches. On a mouse there is no
 * thumb zone and nothing moves.
 *
 * The post-match Menu button stays in the corner: it only exists after the match is
 * decided, when there is no stick to collide with.
 *
 * ── z-order ─────────────────────────────────────────────────────────────────
 * The HUD's game-over card draws a full-viewport scrim at z-index 20 with
 * `pointer-events: auto`. The screen layer sits at 40, so this screen's buttons stay
 * clickable on top of it — which is exactly what "match end → back to menu" needs.
 */

import { startGame, type GameSession } from '../../game/match';
import { CHARACTERS } from '../../game/rules';
import type { MatchPhase } from '../../game/state';
import type { Route, Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { el } from './fx';
import { ensureIconStyles, icon } from '../icons';

export function createMatchScreen(ctx: ScreenContext, route: Route): Screen {
  if (route.name !== 'match') throw new Error('createMatchScreen: wrong route');
  injectStyles('fa-match-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen-bare fa-match');
  root.innerHTML = `
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can move out of the thumb zone on touch, and .match-corner is
         itself absolutely positioned — so nesting it there made 'top: 96px' resolve
         against the corner and put the chip 140px BELOW the bottom of the frame.
         Measured, not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${icon('pause')}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${icon('back')} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <p class="match-sheet-title">Paused</p>
        <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${icon('play')} Resume</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${icon('swap')} Change Fighter</button>
        <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${icon('home')} Quit to Home</button>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`matchScreen: missing element "${sel}"`);
    return node;
  };

  const sheet = q<HTMLDivElement>('sheet');
  const pauseBtn = q<HTMLButtonElement>('pause');
  const exitBtn = q<HTMLButtonElement>('exit');

  /** Guards the profile write: a match can end once, but `phase` is polled from a
   *  callback that fires on every transition, and `restart()` re-enters 'countdown'
   *  — so the result must be banked exactly once per completed match. */
  let banked = false;

  const session: GameSession = startGame({
    container: ctx.gameHost,
    hudRoot: ctx.hudRoot,
    playerCharacterId: route.player,
    enemyCharacterId: route.enemy,
    onPhase(phase: MatchPhase, winner) {
      if (phase === 'ended') {
        if (!banked) {
          banked = true;
          ctx.profile.recordResult(winner === 'player');
        }
        root.classList.add('is-ended');
      } else {
        banked = false;
        root.classList.remove('is-ended');
      }
    },
  });

  function setPaused(on: boolean): void {
    if (on) session.pause(); else session.resume();
    sheet.classList.toggle('is-open', on);
    pauseBtn.innerHTML = on ? icon('play') : icon('pause');
  }

  pauseBtn.addEventListener('click', () => setPaused(!session.paused));
  q<HTMLButtonElement>('resume').addEventListener('click', () => setPaused(false));
  q<HTMLButtonElement>('change').addEventListener('click', () => ctx.navigate({ name: 'characters' }));
  q<HTMLButtonElement>('quit').addEventListener('click', () => ctx.navigate({ name: 'home' }));
  exitBtn.addEventListener('click', () => ctx.navigate({ name: 'home' }));

  // Escape toggles pause — desktop players reach for it before they look for a chip.
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    setPaused(!session.paused);
  };
  window.addEventListener('keydown', onKey);

  exitBtn.title = `${CHARACTERS[route.player].name} vs ${CHARACTERS[route.enemy].name}`;

  return {
    root,
    resize() { session.resize(); },
    dispose() {
      window.removeEventListener('keydown', onKey);
      session.dispose();
      root.remove();
    },
  };
}

const CSS = `
/* Deliberately NOT .fa-screen: a match must not paint a background or claim pointer
   events — the canvas is underneath and every click that is not on a control
   belongs to it. */
.fa-screen-bare {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.fa-match .match-corner {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l) + 14px);
  bottom: calc(var(--fa-safe-b) + 14px);
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: auto;
}

/* Full 44px tap target even though the glyph is small — this is the one control a
   player reaches for while already frustrated. */
.fa-match .match-chip {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l, 0px) + 14px);
  bottom: calc(var(--fa-safe-b, 0px) + 14px);
  pointer-events: auto;
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--tap);
  height: var(--tap);
  padding: 0;
  font-size: 1.05rem;
  line-height: 1;
  color: var(--cream);
  --fa-ic-ink: #FFF3DE;
  background: rgba(26,18,36,0.78);
  border: 3px solid #1a1224;
  border-radius: 14px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-match .match-chip:hover { background: rgba(58,40,80,0.9); }
.fa-match .match-chip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.35); }

/* ── Out of the left thumb zone ────────────────────────────────────────────────
   See the header. 96px clears the player nameplate (topbar top 14 + name pill ~30 +
   gap 5 + health bar 26 = ~75) and the chip's own 44px ends around 140 — comfortably
   above the arc a thumb sweeps from the bottom edge, and it is the same offset
   'hud.ts' uses to lift the radar off the opposite corner, so the two chrome
   elements sit on one line across the frame instead of at two arbitrary heights. */
html.fa-touch-capable .fa-match .match-chip {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l, 0px) + 14px);
  top: calc(var(--fa-safe-t, 0px) + 96px);
  bottom: auto;
}

/* Only after the match is decided. Before that, leaving is a pause-menu decision,
   not a one-tap accident during a fight. */
.fa-match .match-exit { display: none; }
.fa-match.is-ended .match-exit { display: flex; animation: fa-match-exit-in 0.3s ease-out 0.35s backwards; }
/* ...and once it IS decided, pause means nothing, so the corner belongs to Menu
   alone. That is also what keeps the two controls from sharing one spot now that the
   chip is positioned against the screen rather than nested beside the button. */
.fa-match.is-ended .match-chip { display: none; }
@keyframes fa-match-exit-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}

/* ── Pause sheet ──────────────────────────────────────────────────────────── */
.fa-match .match-sheet {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(10,6,16,0.62);
  pointer-events: auto;
}
.fa-match .match-sheet.is-open { display: flex; }
.fa-match .match-sheet-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(300px, 74vw);
  padding: clamp(16px, 3vh, 28px) clamp(20px, 3vw, 34px);
  background: rgba(26,18,36,0.95);
  border: 4px solid #1a1224;
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4), 0 20px 40px rgba(0,0,0,0.5);
  animation: fa-sheet-in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
}
@keyframes fa-sheet-in {
  from { opacity: 0; transform: scale(0.94) translateY(10px); }
  to { opacity: 1; transform: none; }
}
.fa-match .match-sheet-title {
  margin: 0 0 4px;
  text-align: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.1rem, 3vh, 1.7rem);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cream);
  -webkit-text-stroke: 2px #1a1224;
  paint-order: stroke fill;
}
`;
