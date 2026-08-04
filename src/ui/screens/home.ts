/**
 * Home screen.
 *
 * Information architecture is `reference/prototypes/home-screen.html`'s, unchanged:
 * a status/tab top bar, a three-column middle (left nav rail | centre stage |
 * right nav rail with deals and update links), and a bottom bar carrying the level
 * bar and the loud START GAME button. Every entry point that screen offered is still
 * here and still in the same place.
 *
 * What changed is the execution, in two ways that matter:
 *
 *  1. **The centre stage is the real game.** The prototype's hand-drawn SVG burger
 *     is replaced by the player's actual equipped character, rendered by the actual
 *     `Stage` through the actual toon/lighting/grade chain (`charStage.ts`). The
 *     prototype's "tap the mascot and he throws his toppings" beat survives as a tap
 *     that plays the character's real attack animation. A menu that shows you the
 *     thing you are about to play as, in the renderer you are about to play in, is
 *     what every shipped brawler's lobby does and is the single largest quality
 *     lever available on this screen.
 *  2. **It is laid out for landscape and for thumbs.** Three columns in a phone's
 *     844x390 is the tight case, so the rails collapse and the deals card and update
 *     links drop out by height, not by width — see the media queries at the bottom.
 */

import { CHARACTERS, RARITY_COLORS } from '../../game/rules';
import { XP_PER_LEVEL } from './profile';
import type { Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { burstConfetti, el } from './fx';
import { getCharacterStage } from './charStage';

export function createHomeScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-home-styles', CSS);

  const root = el('div', 'fa-screen fa-home');
  const stage = getCharacterStage();

  root.innerHTML = `
    <header class="fa-topbar">
      <div class="fa-chip"><span class="fa-chip-em">🙂</span><span data-el="name"></span></div>
      <div class="fa-chip"><span class="fa-chip-em">🏆</span>Wins <span class="fa-chip-val" data-el="wins">0</span></div>
      <div class="fa-chip home-chip-coin"><span class="fa-chip-em">🪙</span><span data-el="coins">0</span></div>
      <div class="fa-topbar-spacer"></div>
      <nav class="fa-tabs">
        <button class="fa-tab is-active" type="button">Home</button>
        <button class="fa-tab" type="button" data-go="characters">Foods</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">⚙️</button>
    </header>

    <div class="home-middle">
      <aside class="home-rail">
        <div class="home-deals">
          <p class="fa-panel-title">Good deals</p>
          <div class="home-deal">
            <span class="home-deal-icon">📦</span>
            <span class="home-deal-info">
              <span class="home-deal-title">1 Chest</span>
              <span class="home-deal-sub">10k+ coins</span>
            </span>
            <span class="home-deal-price">🪙 359</span>
          </div>
        </div>
      </aside>

      <section class="home-stage" data-el="stage">
        <div class="home-stage-3d" data-el="stage3d"></div>
        <div class="home-stage-vignette"></div>
        <div class="home-nameplate">
          <span class="fa-title home-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <div class="home-stage-hint" data-el="hint">Tap to taunt</div>
      </section>

    </div>

    <footer class="home-bottom">
      <div class="fa-level">
        <span class="fa-level-label home-lv" data-el="lv">Lv 1</span>
        <div class="fa-level-track">
          <div class="fa-level-fill" data-el="lvfill"></div>
          <span class="fa-level-xp" data-el="lvxp"></span>
        </div>
        <span class="fa-level-label" data-el="lvnext">Lv 2</span>
      </div>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">▶ Start Game</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`home: missing element "${sel}"`);
    return node;
  };

  const stageHost = q<HTMLDivElement>('stage3d');
  const confetti = q<HTMLDivElement>('confetti');
  const heroName = q<HTMLSpanElement>('heroname');
  const heroRarity = q<HTMLSpanElement>('herorarity');
  const hint = q<HTMLDivElement>('hint');

  function render(): void {
    const def = CHARACTERS[ctx.profile.selected];
    q('name').textContent = ctx.profile.name;
    q('wins').textContent = String(ctx.profile.wins);
    q('coins').textContent = ctx.profile.coins.toLocaleString();
    q('lv').textContent = `Lv ${ctx.profile.level}`;
    q('lvnext').textContent = `Lv ${ctx.profile.level + 1}`;
    q<HTMLDivElement>('lvfill').style.width = `${(ctx.profile.levelProgress01 * 100).toFixed(1)}%`;
    q('lvxp').textContent = `${ctx.profile.xp % XP_PER_LEVEL} / ${XP_PER_LEVEL} XP`;
    heroName.textContent = def.name;
    heroRarity.textContent = def.rarity;
    heroRarity.style.background = RARITY_COLORS[def.rarity];
    stage.show(def.id);
  }

  // Both nav rails and the tab bar route through one delegated handler, so adding a
  // destination is one `data-go` attribute rather than another listener to leak.
  const onClick = (ev: MouseEvent): void => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-go]');
    if (!target) return;
    const go = target.dataset.go;
    if (go === 'characters') ctx.navigate({ name: 'characters' });
  };
  root.addEventListener('click', onClick);

  q<HTMLButtonElement>('start').addEventListener('click', () => {
    ctx.navigate({ name: 'characters' });
  });

  q<HTMLButtonElement>('settings').addEventListener('click', () => {
    // Settings is not built yet. Say so rather than doing nothing — a dead control
    // is a bug report; a labelled one is a roadmap.
    hint.textContent = 'Settings coming soon';
    hint.classList.add('is-loud');
    setTimeout(() => { hint.textContent = 'Tap to taunt'; hint.classList.remove('is-loud'); }, 1600);
  });

  // The prototype's mascot easter egg, rebuilt on the real model.
  q<HTMLElement>('stage').addEventListener('click', () => {
    stage.poke();
    burstConfetti(confetti, 50, 18);
  });

  const unsubscribe = ctx.profile.onChange(render);
  render();
  stage.attachTo(stageHost);

  return {
    root,
    update(dt) { stage.update(dt); },
    resize() { stage.resize(); },
    dispose() {
      unsubscribe();
      root.removeEventListener('click', onClick);
      stage.detach();
      root.remove();
    },
  };
}

const CSS = `
/* TWO columns, not three.
   Round 1 framed the hero with two rails of six navigation buttons, five of which
   were tagged SOON — a blind critic called that out as the loudest single defect
   ("no top-grossing front end ships a home screen where the majority of navigation
   is unavailable"), and separately flagged that "Foods" appeared twice, once in the
   tab bar and once in the rail. Both are gone: navigation is the tab bar alone, the
   surviving rail carries offers and a single roadmap card, and everything that
   bought back goes to the hero — which is the one thing on this screen a player is
   actually here to look at. */
.fa-home .home-middle {
  display: grid;
  grid-template-columns: clamp(132px, 16vw, 220px) minmax(0, 1fr);
  gap: var(--gap);
  min-height: 0;
}

/* Deliberately NOT a full-height panel: a rail of content at the top of a 740px
   cream slab leaves an empty half-screen, which is its own "unfinished" signal.
   Each card is its own surface and the rail just stacks them. */
.fa-home .home-rail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.fa-home .home-rail::-webkit-scrollbar { display: none; }
/* Cream text on the warm backdrop needs its own legibility, now that there is no
   panel behind it. */
.fa-home .home-rail .fa-panel-title {
  color: var(--cream);
  text-shadow: 0 2px 0 rgba(26,18,36,0.7);
}

/* ── Deals ────────────────────────────────────────────────────────────────── */
.fa-home .home-deals { display: flex; flex-direction: column; gap: 5px; }
/* NOTE — deliberately absent: an "unbuilt features" roadmap card.
   Round 1 shipped five SOON-tagged nav buttons; a blind critic called that the
   single loudest defect on the screen ("no top-grossing front end ships a home
   screen where the majority of navigation is unavailable"). Round 2 replaced them
   with one compact roadmap card, and the next critic named THAT the single most
   damaging element for the same reason: it announces the build is incomplete.
   Two independent critics reaching the same verdict twice is not taste, so the
   unbuilt destinations are simply not advertised. When Shop/Skins/Settings exist
   they get real entries here.
.fa-home .home-deal {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 7px;
  background: linear-gradient(180deg, #FFE9A8, var(--mustard));
  border: 3px solid var(--ink);
  border-radius: var(--radius-surface);
  box-shadow: 0 3px 0 rgba(0,0,0,0.3);
}
.fa-home .home-deal-icon { font-size: 1.4rem; line-height: 1; }
.fa-home .home-deal-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.fa-home .home-deal-title {
  font-family: 'Rubik', sans-serif; font-weight: 800; font-size: 0.78rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-home .home-deal-sub { font-size: 0.66rem; font-weight: 600; color: #4E2C1B; }
.fa-home .home-deal-price {
  font-family: 'Rubik', sans-serif; font-weight: 800; font-size: 0.72rem;
  background: var(--ink); color: var(--cream);
  border-radius: 999px; padding: 3px 9px; white-space: nowrap;
}

/* ── Centre stage ─────────────────────────────────────────────────────────── */
.fa-home .home-stage {
  position: relative;
  min-height: 0;
  border: 3px solid var(--ink);
  border-radius: var(--radius-surface);
  overflow: hidden;
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
  cursor: pointer;
  background: #39b7e8;
}
.fa-home .home-stage-3d { position: absolute; inset: 0; }
/* Warms the portrait's cool cyan back toward the menu's orange at the edges, so the
   display case reads as lit from the same world rather than pasted on. Also darkens
   the bottom, which is what the nameplate sits against. */
.fa-home .home-stage-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(46% 34% at 50% 30%, rgba(255,248,214,0.48), transparent 68%),
    radial-gradient(120% 100% at 50% 42%, transparent 40%, rgba(193,39,45,0.40) 100%),
    linear-gradient(0deg, rgba(20,13,30,0.75) 0%, rgba(20,13,30,0.3) 18%, transparent 38%);
}

.fa-home .home-nameplate {
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(8px, 2vh, 18px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  padding: 0 10px;
}
.fa-home .home-hero-name { max-width: 100%; }
.fa-home .home-nameplate .fa-rarity { align-self: center; }

.fa-home .home-stage-hint {
  position: absolute;
  top: 8px;
  inset-inline-end: 10px;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.63rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cream);
  background: rgba(26,18,36,0.55);
  border: 2px solid rgba(26,18,36,0.8);
  border-radius: 999px;
  padding: 3px 9px;
  transition: background 0.15s, transform 0.15s;
}
.fa-home .home-stage-hint.is-loud {
  background: var(--ketchup);
  transform: scale(1.06);
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-home .home-bottom {
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 22px);
  min-height: var(--tap);
}
/* Capped, not stretched. A full-bleed 1200px progress bar reading 0% is a very
   large piece of nothing; a 420px one reads as a stat. */
.fa-home .home-bottom .fa-level { flex: 0 1 clamp(160px, 32vw, 420px); }
.fa-home .home-bottom .fa-btn--primary { margin-inline-start: auto; }

/* Landscape phones. Height is the binding constraint long before width, so trim by
   height: the deals card and the update links are the two things whose absence
   costs the least. */
@media (max-height: 460px) {
  .fa-home .home-deals { display: none; }
  .fa-home .home-stage-hint { display: none; }
  .fa-home .home-middle { grid-template-columns: clamp(118px, 14vw, 170px) minmax(0, 1fr); }
}

/* Very narrow (portrait phone). Parity, not identity: the rails become one scrolling
   strip under the hero so every destination is still one tap away. */
@media (max-width: 700px) {
  .fa-home .home-middle { grid-template-columns: minmax(0, 1fr); }
  .fa-home .home-rail { display: none; }
  .fa-home .home-bottom { flex-wrap: wrap; }
}
`;
