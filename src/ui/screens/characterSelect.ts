/**
 * Character select.
 *
 * Information architecture is `reference/prototypes/characters-screen.html`'s: a
 * roster grid of rarity-coloured cards, a detail readout (three 0-10 stat bars plus
 * the ability list), a SELECT action that equips with a confetti burst, and the
 * "⭐ Playing" marker on the equipped card. All of it is still here.
 *
 * Two deliberate changes of execution:
 *
 *  1. **Three landscape columns, not a vertical stack.** The prototype scrolled the
 *     whole page — roster, then stats, then button — which on a phone in landscape
 *     means you cannot see the character you are reading the stats of. Hero | roster
 *     | detail puts all three in view at 844x390 and at 2560x1080 alike, and it is
 *     the layout every shipped brawler select screen uses (see the Zooba plate in
 *     `reference/images/zooba/tablet_5.jpg`: hero large at left, card grid at right).
 *  2. **The hero is the real 3D model**, on a pedestal, through the real Stage
 *     (`charStage.ts`) — the prototype's flat SVGs were placeholders for exactly this.
 *
 * Every number on this screen (roster order, names, rarity, stats, abilities) is read
 * from `game/rules.ts`. Nothing about the cast is duplicated here.
 */

import {
  CHARACTERS, CHARACTER_IDS, RARITY_COLORS, RARITY_CARD_COLORS, REACH,
  type CharacterId, type Weapon,
} from '../../game/rules';
import type { Screen, ScreenContext } from './types';
import { injectStyles, rgba } from './theme';
import { burstConfetti, el } from './fx';
import { getCharacterStage, PORTRAIT_BG_CSS } from './charStage';
import { getCachedThumb, requestThumbnails } from './thumbs';
import { abilityIcon, ensureIconStyles, icon } from '../icons';

/** Stat bar colours, matching the prototype's damage/health/speed semantics. */
const STAT_ROWS = [
  { key: 'damage', icon: 'damage', label: 'Damage', color: '#D62839' },
  { key: 'health', icon: 'health', label: 'Health', color: '#7CB518' },
  { key: 'speed', icon: 'speed', label: 'Speed', color: '#1E90D8' },
] as const;

/** Stats are authored on a 0-10 display scale in `rules.ts`. */
const STAT_MAX = 10;

/** Rarities whose cards animate, per the prototype's zigzag treatment. */
const ANIMATED_RARITIES = new Set(['Neon', 'Cyber']);

/**
 * Reach, as a word.
 *
 * The raw `range` is in world units, which means nothing to a player, but the
 * ladder it is drawn from does: `rules.ts` defines seven named rungs and every
 * weapon sits on exactly one of them. Comparing against the rungs rather than
 * against invented thresholds means this label can never drift out of sync with a
 * balance change — retuning `REACH` retunes the label with it.
 */
function reachLabel(range: number | undefined): string | null {
  if (range === undefined) return null;
  if (range >= REACH.ultimateSlam) return 'Whole map';
  if (range > REACH.rangedLong) return 'Max range';
  if (range > REACH.rangedMid) return 'Long';
  if (range > REACH.rangedClose) return 'Mid';
  if (range > REACH.meleeHeavy) return 'Short';
  return 'Melee';
}

/** The hard numbers behind an ability, straight out of the weapon table. */
function weaponFacts(w: Weapon): string[] {
  const facts: string[] = [];
  if (w.type === 'self' && w.healAmount) {
    facts.push(`${icon('heal')} +${w.healAmount} HP`);
  } else if (w.comboParts?.length) {
    facts.push(`${icon('damage')} ${w.comboParts.map((p) => p.damage).join(' + ')}`);
  } else if (w.pellets && w.pellets > 1) {
    facts.push(`${icon('damage')} ${w.damage} × ${w.pellets}`);
  } else if (w.damage > 0) {
    facts.push(`${icon('damage')} ${w.damage}`);
  }
  const reach = reachLabel(w.range);
  if (reach) facts.push(`${icon('range')} ${reach}`);
  facts.push(`${icon('timer')} ${(w.cooldown / 1000).toFixed(1)}s`);
  if (w.effect) facts.push(w.effect === 'stun' ? `${icon('stun')} Stun` : `${icon('slow')} Slow`);
  return facts;
}

function pickOpponent(player: CharacterId): CharacterId {
  const pool = CHARACTER_IDS.filter((id) => id !== player);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createCharacterSelectScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-chars-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-chars');
  const stage = getCharacterStage();
  let viewed: CharacterId = ctx.profile.selected;

  root.innerHTML = `
    <header class="fa-topbar">
      <button class="fa-iconbtn" type="button" data-el="back" aria-label="Back to home">${icon('back')} Back</button>
      <h1 class="fa-title chars-heading">Choose Your Fighter</h1>
      <div class="fa-topbar-spacer"></div>
      <div class="fa-chip"><span class="fa-chip-em">${icon('medal')}</span>Wins <span class="fa-chip-val" data-el="wins">0</span></div>
    </header>

    <div class="chars-body">
      <section class="chars-hero">
        <div class="chars-hero-3d" data-el="hero3d"></div>
        <div class="chars-hero-vignette"></div>
        <div class="chars-hero-plate">
          <span class="fa-title chars-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <button class="chars-equip" type="button" data-el="select">${icon('star')} Equip</button>
      </section>

      <div class="fa-panel fa-panel--flush chars-rosterwrap">
        <div class="fa-scroll chars-roster" data-el="roster"></div>
      </div>

      <div class="fa-panel chars-detail">
        <p class="fa-panel-title">Stats</p>
        <div class="chars-stats" data-el="stats"></div>
        <p class="fa-panel-title">Abilities</p>
        <div class="fa-scroll chars-abilities" data-el="abilities"></div>
      </div>
    </div>

    <footer class="chars-bottom">
      <button class="fa-btn fa-btn--primary fa-btn--hero" type="button" data-el="fight">${icon('play')} Fight!</button>
    </footer>

    <div class="fa-confetti-layer" data-el="confetti"></div>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`characterSelect: missing element "${sel}"`);
    return node;
  };

  const rosterEl = q<HTMLDivElement>('roster');
  const statsEl = q<HTMLDivElement>('stats');
  const abilitiesEl = q<HTMLDivElement>('abilities');
  const heroHost = q<HTMLDivElement>('hero3d');
  const heroName = q<HTMLSpanElement>('heroname');
  const heroRarity = q<HTMLSpanElement>('herorarity');
  const selectBtn = q<HTMLButtonElement>('select');
  const confetti = q<HTMLDivElement>('confetti');

  // ── Roster grid ────────────────────────────────────────────────────────────
  const cards = new Map<CharacterId, HTMLButtonElement>();
  for (const id of CHARACTER_IDS) {
    const def = CHARACTERS[id];
    const card = el('button', 'chars-card');
    card.type = 'button';
    card.dataset.char = id;
    card.style.setProperty('--card-bg', RARITY_CARD_COLORS[def.rarity]);
    card.style.setProperty('--rarity', RARITY_COLORS[def.rarity]);
    card.style.setProperty('--rarity-glow', rgba(RARITY_COLORS[def.rarity], 0.75));
    if (ANIMATED_RARITIES.has(def.rarity)) card.classList.add('is-animated');
    // Only the FILL is set here. The ink used to be picked per card by luminance in
    // this file; `.fa-rarity` now encloses every glyph in an ink stroke instead, which
    // is colour-independent, needs no JS, and fixes the same badge on `home.ts` —
    // see the block above `.fa-rarity` in `theme.ts` for what was measured.
    card.innerHTML = `
      <img class="chars-card-render" alt="" data-el="render" />
      <span class="chars-card-sheen"></span>
      <span class="chars-card-gloss"></span>
      <span class="chars-card-art">${icon('avatar')}</span>
      <span class="chars-card-name">${def.name}</span>
      <span class="fa-rarity chars-card-rarity"
            style="background:${RARITY_COLORS[def.rarity]}">${def.rarity}</span>
      <span class="chars-card-playing">${icon('star')}</span>
    `;
    card.addEventListener('click', () => view(id, true));
    rosterEl.appendChild(card);
    cards.set(id, card);
  }

  // Real roster art, rendered from the real models. Progressive: each card swaps
  // from its emoji placeholder to its portrait the moment that render lands, so the
  // screen is usable from the first frame regardless of GPU speed.
  const paintThumb = (id: CharacterId, url: string): void => {
    const card = cards.get(id);
    const img = card?.querySelector<HTMLImageElement>('[data-el="render"]');
    if (!img) return;
    img.src = url;
    card!.classList.add('has-render');
  };
  for (const id of CHARACTER_IDS) {
    const hit = getCachedThumb(id);
    if (hit) paintThumb(id, hit);
  }
  requestThumbnails(paintThumb);

  // A twelfth, locked tile. Eleven cards in a four-wide grid leaves a ragged hole in
  // the last row, and an unstyled gap in a roster reads as an unfinished build
  // rather than as a roster of eleven. A locked slot is what a shipped game puts
  // there, and it is honest: there ARE more characters coming.
  const locked = el('div', 'chars-card chars-card--locked');
  locked.innerHTML = `
    <span class="chars-card-art">${icon('lock')}</span>
    <span class="chars-card-name">More soon</span>
  `;
  rosterEl.appendChild(locked);

  // ── Stat bars (built once, widths animate on view change) ─────────────────
  const statFills = new Map<string, HTMLDivElement>();
  const statVals = new Map<string, HTMLSpanElement>();
  for (const row of STAT_ROWS) {
    const wrap = el('div', 'fa-stat');
    // Ten discrete pips, because the scale in `rules.ts` IS out of ten — a smooth
    // bar makes "7" and "8" indistinguishable at a glance, and the numeral was
    // previously flung to the far edge of the panel where the eye could not
    // associate it with its own bar.
    wrap.innerHTML = `
      <span class="fa-stat-label">${icon(row.icon)} ${row.label}</span>
      <div class="fa-stat-track"><div class="fa-stat-fill"></div><div class="fa-stat-pips"></div></div>
      <span class="fa-stat-val"></span>
    `;
    const fill = wrap.querySelector<HTMLDivElement>('.fa-stat-fill')!;
    fill.style.backgroundColor = row.color;
    statFills.set(row.key, fill);
    statVals.set(row.key, wrap.querySelector<HTMLSpanElement>('.fa-stat-val')!);
    statsEl.appendChild(wrap);
  }

  function renderEquippedState(): void {
    const equipped = ctx.profile.selected;
    for (const [id, card] of cards) card.classList.toggle('is-playing', id === equipped);
    const isEquipped = viewed === equipped;
    selectBtn.innerHTML = isEquipped ? `${icon('star')} Equipped` : `${icon('star')} Equip`;
    selectBtn.classList.toggle('is-equipped', isEquipped);
    selectBtn.disabled = isEquipped;
    // The EQUIPPED control on the hero panel is the single place this state is
    // stated. Round 1 said it in three places at once (a badge, a chip and a
    // button), which a critic flagged — a state that needs saying three times is
    // being said badly once.
  }

  function view(id: CharacterId, scrollIntoView = false): void {
    viewed = id;
    const def = CHARACTERS[id];

    for (const [cid, card] of cards) card.classList.toggle('is-viewed', cid === id);
    if (scrollIntoView) cards.get(id)?.scrollIntoView({ block: 'nearest' });

    heroName.textContent = def.name;
    heroRarity.textContent = def.rarity;
    heroRarity.style.background = RARITY_COLORS[def.rarity];

    for (const row of STAT_ROWS) {
      const value = def.stats[row.key];
      statFills.get(row.key)!.style.width = `${(value / STAT_MAX) * 100}%`;
      statVals.get(row.key)!.textContent = String(value);
    }

    abilitiesEl.innerHTML = '';
    for (const ability of def.abilities) {
      // Abilities are the prose; weapons are the numbers. They are two views of the
      // same thing and `rules.ts` names them identically, so pairing them turns a
      // flavour list into a readout you can actually pick a fighter with — and it is
      // what fills the detail panel instead of leaving half of it empty.
      const weapon = def.weapons.find((w) => w.name === ability.name);
      const pill = el('div', 'chars-ability');
      pill.innerHTML = `
        <span class="chars-ability-em">${abilityIcon(ability.emoji)}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">${ability.name}</span>
          <span class="chars-ability-desc">${ability.desc}</span>
          ${weapon ? `<span class="chars-ability-facts">${
            weaponFacts(weapon).map((f) => `<span class="chars-fact">${f}</span>`).join('')
          }</span>` : ''}
        </span>
      `;
      abilitiesEl.appendChild(pill);
    }
    // Donut's Sticky Trail is a passive with no weapon slot; it is already in the
    // ability list, but the trail flag is the one gameplay property a player cannot
    // infer from the abilities alone, so it gets called out.
    if (def.hasTrail) {
      const note = el('div', 'chars-ability chars-ability--passive');
      note.innerHTML = `
        <span class="chars-ability-em">${icon('honey')}</span>
        <span class="chars-ability-body">
          <span class="chars-ability-name">Passive</span>
          <span class="chars-ability-desc">Leaves a damaging speed-boost trail while moving.</span>
        </span>
      `;
      abilitiesEl.appendChild(note);
    }
    abilitiesEl.scrollTop = 0;

    stage.show(id);
    renderEquippedState();
  }

  q<HTMLButtonElement>('back').addEventListener('click', () => ctx.navigate({ name: 'home' }));

  selectBtn.addEventListener('click', () => {
    ctx.profile.select(viewed);
    renderEquippedState();
    burstConfetti(confetti, 50, 24);
    stage.poke();
  });

  q<HTMLButtonElement>('fight').addEventListener('click', () => {
    // FIGHT implies equipping — nobody expects to fight as someone other than the
    // character they were just looking at.
    ctx.profile.select(viewed);
    ctx.navigate({ name: 'match', player: viewed, enemy: pickOpponent(viewed) });
  });

  q('wins').textContent = String(ctx.profile.wins);
  view(viewed);
  stage.attachTo(heroHost);

  return {
    root,
    update(dt) { stage.update(dt); },
    resize() { stage.resize(); },
    dispose() {
      stage.detach();
      root.remove();
    },
  };
}

const CSS = `
.fa-chars .chars-heading { flex: 0 1 auto; }

.fa-chars .chars-body {
  display: grid;
  grid-template-columns:
    clamp(150px, 25vw, 430px)
    minmax(0, 1fr)
    clamp(168px, 21vw, 330px);
  gap: var(--gap);
  min-height: 0;
}

/* ── Hero column ──────────────────────────────────────────────────────────── */
.fa-chars .chars-hero {
  position: relative;
  min-height: 0;
  border: 3px solid var(--ink);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 5px 0 rgba(0,0,0,0.35);
  /* Seen only for the frame before WebGL first presents. Imported from 'charStage.ts'
     so the card and the renderer cannot disagree about the clear colour. */
  background: ${PORTRAIT_BG_CSS};
}
.fa-chars .chars-hero-3d { position: absolute; inset: 0; }
/* A NAMEPLATE SCRIM, and nothing else any more.
   This used to be three layers doing the staging in CSS: a warm spotlight pool behind
   the head, a red corner vignette, and a bottom scrim. The first two are gone, because
   'charStage.ts' now builds the pool and the falloff as a real lit cyclorama and a real
   floor, and painting a second set of them OVER the canvas would be two rooms in one
   panel. The red one had a second cost: it was the largest warm wash in the menus,
   dropped straight onto what is now the largest COOL surface, and 'docs/LESSONS.md' §8
   is explicit that the reference reserves the warm half of the wheel for the CAST.

   What survives is the part that was never staging: a scrim under the nameplate, which
   is a legibility device. The hero name is cream with an ink stroke and the rarity chip
   carries its own plate, so this is now light enough to keep the floor's own value
   while still guaranteeing the type a dark ground. */
.fa-chars .chars-hero-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(0deg, rgba(12,26,40,0.72) 0%, rgba(12,26,40,0.26) 15%, transparent 32%);
}

/* Equip lives HERE, on the hero, not in the action row. Two same-shaped pills side
   by side at the bottom right gave the primary action no dominance, and the pale
   one read as a disabled button sitting next to the CTA. */
.fa-chars .chars-equip {
  position: absolute;
  top: 8px;
  inset-inline-end: 8px;
  appearance: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  min-height: var(--tap);
  padding: 0 14px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.66rem, 1.5vh, 0.82rem);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: 3px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.4);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-chars .chars-equip:hover { filter: brightness(1.05); }
.fa-chars .chars-equip:active { transform: translateY(3px); box-shadow: 0 0 0 rgba(0,0,0,0.4); }
.fa-chars .chars-equip.is-equipped {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
  color: #123000;
  opacity: 1;
  cursor: default;
}
.fa-chars .chars-hero-plate {
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(6px, 1.6vh, 14px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  pointer-events: none;
}
.fa-chars .chars-hero-name { max-width: 100%; }
.fa-chars .chars-hero-plate .fa-rarity { align-self: center; }
.fa-chars .chars-hero-badge {
  position: absolute;
  top: 12px;
  inset-inline-start: 8px;
  display: flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  background: var(--lettuce);
  color: #FFFFFF;
  border: 2px solid var(--ink);
  border-radius: 999px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  pointer-events: none;
}

/* ── Roster ───────────────────────────────────────────────────────────────── */
/* The scroller must be a FLEX ITEM WITH A DEFINITE HEIGHT, or the 1fr rows below
   have nothing to resolve against and silently collapse to their minimum — which is
   exactly what left two thirds of this panel empty on the first attempt. */
.fa-chars .chars-rosterwrap { min-height: 0; }
.fa-chars .chars-rosterwrap > .chars-roster { flex: 1 1 auto; }
/* Cards GROW into the panel rather than clustering at the top of it.
   minmax(min, 1fr) rows share whatever height is left over, so 11 cards fill a
   1600x900 roster the same way they fill a 844x390 one — round 1 pinned them to the
   top and left two thirds of a cream panel empty at desktop size, which is the
   thing that reads as unfinished. The column floor keeps the count at 4 across on a
   phone and grows it on a desktop, so the grid is never one lonely card wide. */
/* The 70px floor was measured, and it was wrong in portrait: at 430x932 the roster is
   404px wide, which fits FIVE 64.8px columns — cards so narrow that four of the eleven
   names ellipsised ("Ham...", "Burri...", "Lolli...", "Wato...") and the card's aspect
   went to 0.61, i.e. a third of every card was letterbox no matter how the art was
   framed. 76px drops that to four columns of ~92px, which restores every name, takes
   the card aspect to 0.87 (within 4% of the render's own 0.84, so the crop is
   near-zero), and grows the tap target. Nothing changes above 760px wide, where 10vw
   already exceeds the floor — desktop and landscape phone are untouched. */
.fa-chars .chars-roster {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(76px, 10vw, 180px), 1fr));
  grid-auto-rows: minmax(clamp(68px, 12vh, 128px), 1fr);
  gap: clamp(6px, 1vw, 14px);
  padding: clamp(8px, 1.4vh, 14px);
  align-content: stretch;
}

.fa-chars .chars-card {
  position: relative;
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  /* Never below the 44px tap minimum, and in practice much larger. */
  min-height: clamp(68px, 12vh, 128px);
  padding: 6px 4px 7px;
  justify-content: center;
  overflow: hidden;
  /* FLAT rarity colour. The highlight that used to live here now lives in
     .chars-card-gloss, ON TOP of the portrait — which is what lets the square
     render sit inside a portrait-shaped tile with no visible seam, because the
     card's own background and the render's baked background are the same colour. */
  background: var(--card-bg, #BEBEBE);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.35);
  transition: transform 0.1s, box-shadow 0.1s, border-color 0.12s;
}
.fa-chars .chars-card:hover { transform: translateY(-3px); box-shadow: 0 7px 0 rgba(0,0,0,0.35); }
.fa-chars .chars-card:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.35); }
/* The card you are LOOKING at: gold frame, the same colour the HUD reserves for
   "this is the selected slot" on the weapon bar. One meaning, one colour. */
.fa-chars .chars-card.is-viewed {
  border-color: var(--gold);
  box-shadow: 0 4px 0 rgba(0,0,0,0.35), 0 0 0 3px var(--gold), 0 0 16px var(--rarity-glow);
  transform: translateY(-3px);
}
.fa-chars .chars-card.is-viewed:active { transform: translateY(1px); }

/* The emoji IS the card art, so it scales with the card. Pinned to vh rather than a
   fixed size: the rows stretch to fill the panel, and a 2.9rem glyph adrift in a
   230px-tall card is the same "unfinished" read the empty panel was. */
/* The rendered portrait, once it lands. It covers the emoji placeholder rather
   than replacing it in the DOM, so there is no reflow at swap time. */
/* COVER now, and the reason the old note here reached the opposite conclusion is that
   it was reasoning about a SQUARE source of a WHOLE STANDING FIGURE. Against that
   source 'cover' really did amputate arms, so 'contain' was correct — and it cost the
   letterbox: mean figure area measured 19.1% of the card at desktop and 14.3% in
   portrait, with the balance dead colour above and below. That is precisely the defect
   a blind critic named as this screen's single fix.

   'thumbs.ts' now renders 416x496 (0.839) framed on the upper body instead of 448²
   framed on the whole figure, so the source and the card agree about shape to within
   4% at desktop and in portrait, and 'cover' crops single-digit percentages there. The
   landscape phone's card is 1.17 wide-over-tall and does crop ~28% of the height — off
   the BOTTOM, by design, which on a 74px card is the difference between a whole body
   at 30px and a head at 30px.

   10% and not 50%: 'cover' distributes its overflow according to object-position, and
   at a 10% bias the landscape crop takes 3% off the top and 25% off the bottom. The
   render already leaves 8% of clear frame above the head (TOP_PAD), so the head keeps
   ~5% of clearance in the tightest crop the layout can produce. Asserted per character
   per viewport by 'chars_metrics.mjs''s FACE-OUT / HEAD-OUT columns, not eyeballed. */
.fa-chars .chars-card-render {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 10%;
  opacity: 0;
  transition: opacity 0.25s ease-out;
  pointer-events: none;
}
.fa-chars .chars-card.has-render .chars-card-render { opacity: 1; }
.fa-chars .chars-card.has-render .chars-card-art { display: none; }
/* Top gloss + bottom scrim, over the render: the scrim is what keeps the name and
   the rarity chip legible against whatever the character's own colours happen to be
   down there, which a flat card never had to worry about. */
/* Both stops moved when the art started filling the card, and the top one is the one
   that mattered: a 0.40 white radial centred at 6% used to fall on empty sky, and with
   an upper-body crop it falls on the FACE. It is now weaker and pulled above the frame,
   so it still reads as a glossy tile and no longer washes out the one part of the
   render this screen exists to show. The bottom scrim goes the other way — the name and
   the rarity chip now sit over a character's chest rather than over flat colour, so it
   is deepened to keep them on a dark ground. */
.fa-chars .chars-card-gloss {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 34% at 50% -8%, rgba(255,255,255,0.30), transparent 72%),
    linear-gradient(0deg, rgba(20,13,30,0.74) 0%, rgba(20,13,30,0.30) 26%, transparent 48%);
}

.fa-chars .chars-card-art {
  font-size: clamp(1.6rem, 10vh, 4.6rem);
  line-height: 1.05;
  filter: drop-shadow(0 3px 2px rgba(0,0,0,0.4));
}
.fa-chars .chars-card-art, .fa-chars .chars-card-name, .fa-chars .chars-card-rarity {
  flex: 0 0 auto;
  position: relative;
  z-index: 2;
}
/* Once a portrait is behind it the name has to survive any colour underneath, so it
   flips to the cream-on-ink treatment the rest of the game uses over artwork. */
.fa-chars .chars-card.has-render .chars-card-name {
  color: var(--cream);
  -webkit-text-stroke: 2.5px var(--ink);
  paint-order: stroke fill;
}
/* Portraits are full-bleed, so the content has to be bottom-anchored on top of them
   instead of centred in an empty card. */
.fa-chars .chars-card.has-render { justify-content: flex-end; }
.fa-chars .chars-card-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  /* Step 3 of the type ramp. Was 0.78rem max, which put card names, tab labels and
     currency values all within a couple of pixels of each other — a scale with no
     steps in it is not a hierarchy. */
  font-size: clamp(0.66rem, 1.85vh, 1.02rem);
  color: var(--ink);
  text-align: center;
  line-height: 1.1;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* The floor here was 0.5rem, which put this chip at 8px on a landscape phone and
   10.4px everywhere else — under the 11px legibility floor at every single viewport,
   on the one badge whose whole job is a six-way distinction. It is now never below
   11.5px, which is also what keeps the 1.6px ink stroke '.fa-rarity' paints in
   proportion. Where the card is too small to carry it at that size the chip is dropped
   entirely rather than shrunk (see the landscape block at the bottom of this file) —
   the card's background IS the rarity colour, so nothing is lost that the card was not
   already saying. */
.fa-chars .chars-card-rarity {
  height: clamp(18px, 2.4vh, 22px);
  padding: 0 8px;
  font-size: clamp(0.72rem, 1.35vh, 0.78rem);
  align-self: center;
}

/* The twelfth slot. Deliberately flat and desaturated so it reads as "not yet"
   rather than as a character you have failed to notice. */
.fa-chars .chars-card--locked {
  cursor: default;
  background: rgba(26,18,36,0.1);
  border-style: dashed;
  border-color: rgba(26,18,36,0.45);
  box-shadow: none;
  color: rgba(26,18,36,0.5);
}
.fa-chars .chars-card--locked .chars-card-art { opacity: 0.45; }
/* 0.55 measured 3.62:1 on this tile's own pale ground — under AA, and the only text on
   the roster that was. Quietness on a 'not yet' slot is worth having, but not at the
   cost of the floor: 0.70 measures 5.7 and is still plainly subordinate to the eleven
   cream-on-ink names beside it. */
.fa-chars .chars-card--locked .chars-card-name { color: rgba(26,18,36,0.70); }
/* Equipped marker. A corner star rather than the prototype's "⭐ Playing" pill,
   because at roster-card scale in landscape a pill is wider than the card. */
.fa-chars .chars-card-playing {
  position: absolute;
  top: 3px;
  inset-inline-end: 4px;
  display: none;
  font-size: 0.85rem;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
}
.fa-chars .chars-card.is-playing .chars-card-playing { display: block; }
.fa-chars .chars-card.is-playing { border-color: var(--lettuce); }
.fa-chars .chars-card.is-playing.is-viewed { border-color: var(--gold); }

/* Neon / Cyber shimmer. The prototype scrolled a black zigzag behind these two
   rarities; a sweeping sheen plus a rarity-tinted glow says "this one is special"
   more legibly at card size and does not fight the emoji for attention. */
.fa-chars .chars-card-sheen { display: none; }
.fa-chars .chars-card.is-animated {
  box-shadow: 0 4px 0 rgba(0,0,0,0.35), 0 0 14px var(--rarity-glow);
}
.fa-chars .chars-card.is-animated .chars-card-sheen {
  display: block;
  position: absolute;
  inset: -40%;
  pointer-events: none;
  background: linear-gradient(70deg, transparent 42%, rgba(255,255,255,0.65) 50%, transparent 58%);
  animation: fa-card-sheen 2.6s linear infinite;
}
@keyframes fa-card-sheen {
  0% { transform: translateX(-70%); }
  55%, 100% { transform: translateX(70%); }
}

/* ── Detail column ────────────────────────────────────────────────────────── */
/* Content-sized, not stretched: an ability list four pills long inside a 740px card
   leaves a huge empty cream field. Hugging the content puts the backdrop there
   instead — and max-height:100% still caps it at the row so a ten-ability character
   scrolls rather than overflowing. */
.fa-chars .chars-detail {
  gap: 6px;
  align-self: start;
  max-height: 100%;
}
.fa-chars .chars-stats { display: flex; flex-direction: column; gap: 6px; }
/* Taller bars, and the value is countable rather than estimated. */
.fa-chars .fa-stat-track { height: clamp(16px, 2.6vh, 24px); }
.fa-chars .fa-stat-pips {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent 0 calc(10% - 2px),
    rgba(26,18,36,0.55) calc(10% - 2px) 10%
  );
}
.fa-chars .fa-stat-val {
  width: auto;
  min-width: 18px;
  font-size: clamp(0.72rem, 1.8vh, 0.95rem);
  color: var(--ink);
}
.fa-chars .chars-abilities { display: flex; flex-direction: column; gap: 5px; min-height: 0; }

.fa-chars .chars-ability {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 8px;
  background: #FFFFFF;
  border: 2.5px solid var(--ink);
  border-radius: 11px;
}
.fa-chars .chars-ability--passive { background: #FFF0CF; }
.fa-chars .chars-ability-em { font-size: clamp(1.35rem, 3.2vh, 1.85rem); line-height: 1.2; flex: 0 0 auto; }
.fa-chars .chars-ability-body { display: flex; flex-direction: column; min-width: 0; }
.fa-chars .chars-ability-name {
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.72rem, 1.95vh, 1rem);
  line-height: 1.22;
}
.fa-chars .chars-ability-desc {
  font-size: clamp(0.64rem, 1.55vh, 0.82rem);
  line-height: 1.3;
  color: #4E2C1B;
}
.fa-chars .chars-ability-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.fa-chars .chars-fact {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: var(--ink);
  color: var(--cream);
  /* Ink plate: flip the icon outline, or a stroke-only mark (the range arrows) draws
     ink on ink and disappears completely. */
  --fa-ic-ink: #FFF3DE;
  border-radius: 999px;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.64rem, 1.6vh, 0.82rem);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
/* The glyph runs a little larger than its own text. 11px was measured to be below the
   floor for any mark with internal structure. */
.fa-chars .chars-fact .fa-ic { font-size: 1.25em; }

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
.fa-chars .chars-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, 1.6vw, 18px);
  min-height: var(--tap);
}

/* Landscape phones: the heading and the "playing as" strip are the two things that
   can go without losing a destination or an action. */
/* Landscape phone. 390px of height has to hold a top bar, three rows of cards and
   an action row, so the card loses ~26px of ornament: a smaller glyph and a shorter
   rarity chip. Names stay — the card background already encodes rarity, nothing
   else encodes identity. */
/* ⚠️ THIS BLOCK WAS UNCLOSED AT HEAD, AND THE PORTRAIT BREAKPOINT WAS NESTED IN IT.
   Found by counting braces in the CSS template literal: +2, i.e. two blocks opened and
   never closed, committed and shipped. The consequence was not cosmetic. Modern CSS
   nesting made it PARSE — as
       (max-height: 460px) AND (max-width: 700px)
   — so every rule below fired only on a viewport that was both under 700px wide and
   under 460px tall. A real portrait phone is 430x932: wide enough to match the first
   condition and far too tall to match the second, so character select had NO portrait
   layout at all and fell back to three landscape columns squeezed into 430px.

   This is exactly the limit 'docs/LESSONS.md' §9 records for the module parser in
   'menu_accept': the file is valid TypeScript, so nothing that reads TypeScript can see
   it, and the five landscape-only viewports in the acceptance suite could never have
   caught a portrait-only defect. */
@media (max-height: 460px) {
  .fa-chars .chars-heading { display: none; }
  /* 390px of height has to hold a top bar, three rows of cards and an action row, so a
     roster card here is ~86x74. The rarity chip and the name together were taking 26px
     of that 74 — a third of the card — to say in 8px type something the card's own
     background already says in colour. Dropping the chip is worth 35% more height for
     the figure, and 8px uppercase was not communicating a six-way distinction anyway.
     The name stays: nothing else on the card encodes identity. */
  .fa-chars .chars-card-rarity { display: none; }
}

@media (max-width: 700px) {
  .fa-chars .chars-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(90px, 0.9fr) minmax(0, 1.1fr) auto;
  }
  .fa-chars .chars-detail { max-height: 34vh; }
  .fa-chars .chars-heading { display: none; }
  /* Step 3 of the type ramp is sized off vh, and in portrait there is a lot of vh and
     very little card: 1.85vh of 932 is 16.3px inside an 84px tile, which ellipsised
     "Hamburger" to "Hambu...". Sizing it off the card instead of off the viewport is
     not something CSS can express, so the ramp step is simply shorter here — 12.1px,
     still over the 11px floor and still a step above the rarity chip below it. */
  .fa-chars .chars-card-name { font-size: clamp(0.66rem, 1.3vh, 0.82rem); }
  /* TOP-LEFT here, bottom-centre everywhere else, and the reason is the panel's shape
     rather than a preference. In portrait the hero row is ~380px tall against a full
     column's ~740, and the rig frames the subject to a fraction of the panel HEIGHT —
     so the character and its podium move down into exactly the strip a bottom-centred
     plate occupies, and the fighter's name lands across its own legs. This is the same
     defect 'home.ts' fixed for the same reason; the panel's top-left is dead sky in
     every framing the rig produces, because the camera pitches 20 degrees and targets
     half the subject's height. */
  .fa-chars .chars-hero-plate {
    top: clamp(6px, 1.4vh, 12px);
    bottom: auto;
    inset-inline-end: auto;
    align-items: flex-start;
    padding-inline-start: clamp(8px, 2vw, 14px);
  }
  .fa-chars .chars-hero-plate .fa-rarity { align-self: flex-start; }
  /* The bottom scrim was there for a bottom-centred plate. With the plate at the top it
     is darkening a corner of the set for nothing. */
  .fa-chars .chars-hero-vignette { background: none; }
}
`;
