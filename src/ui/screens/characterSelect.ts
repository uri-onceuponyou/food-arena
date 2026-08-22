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
 *  3. **Levels are here** (`rules.ts` DEVIATION #11), because this is where a player
 *     already comes to compare fighters and it is the only screen that shows one at a
 *     time. The upgrade button and the price are the third real control on the screen.
 *
 * Every number on this screen (roster order, names, rarity, stats, abilities, pools,
 * damage multipliers, prices) is read from `game/rules.ts` or `game/economy/`. Nothing
 * about the cast or the economy is duplicated here — see the block above `renderLevel`
 * for why that matters more for the level readout than for anything else on the panel.
 */

import {
  CHARACTERS, CHARACTER_IDS, LEVEL_MAX, PLAYER_MAX_HP, RARITY_COLORS, RARITY_CARD_COLORS,
  REACH, abilityCards, levelDamageMultiplier, maxHpFor,
  type CharacterId, type Weapon,
} from '../../game/rules';
import type { Screen, ScreenContext } from './types';
import { injectStyles, rgba } from './theme';
import { burstConfetti, el } from './fx';
import { getCharacterStage, PORTRAIT_BG_CSS } from './charStage';
import { getCachedThumb, requestThumbnails } from './thumbs';
import { abilityIcon, ensureIconStyles, icon } from '../icons';

/**
 * Stat colours, damage / health / speed.
 *
 * ⚠️ WAS `#D62839` / `#7CB518` / `#1E90D8` — the raw brand FILLS, which is correct for
 * a bar you look at and wrong for a tile you read an ink glyph on: measured against
 * `--ink`, those three are 3.65 / 7.34 / 5.22 : 1 and the first fails AA outright. One
 * value step up, the same three hues measure 8.07 / 11.19 / 9.74 as a tile, and
 * 7.34 / 10.18 / 8.86 as the label on the slate row's dark stop (5.75 / 7.98 / 6.94 on
 * its light stop, the binding case). The hues are unchanged; only the value moved, and
 * the triple is the same one `home.ts` now uses so the two screens cannot disagree
 * about what "damage" looks like.
 */
const STAT_ROWS = [
  { key: 'damage', icon: 'damage', label: 'Damage', color: '#FF8A96' },
  { key: 'health', icon: 'health', label: 'Health', color: '#8FE04A' },
  { key: 'speed', icon: 'speed', label: 'Speed', color: '#6FC8F5' },
] as const;

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
  // WAS `'Whole map'`. It is not: `REACH.ultimateSlam` is 400 wu against a 3440.93 wu
  // arena diagonal — 14% of the width. `e570dfb` stopped `lollipop.Giant`'s CARD making
  // that claim ("hits the whole map" -> "slams the widest area in the game", and
  // `wm_gate` now asserts the relative claim); this label is the SAME false claim in a
  // second place, which is this project's most-repeated defect shape. Relative, so it
  // stays true if §80's lever 1 shrinks the radius, and it matches the card's wording.
  if (range >= REACH.ultimateSlam) return 'Widest';
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
      <!-- ADOPTED: '.ds-chip' plus '.ds-chip-val' on the numerals. The chip's shape is
           unchanged; what moves is the RELATIONSHIP inside it — theme.ts's recorded
           finding is that on the reference plates the numeral is the loudest thing in a
           counter and ours were the same size as their own labels, "which is why a
           trophy total read as chrome". '.fa-chip' stays: 'chars_metrics' and
           'screen_metrics' both key on it. -->
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${icon('medal')}</span>Wins <span class="fa-chip-val ds-chip-val ds-num" data-el="wins">0</span></div>
      <div class="fa-chip ds-chip"><span class="fa-chip-em">${icon('coin')}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
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
        <div class="chars-level" data-el="level"></div>
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
  const levelEl = q<HTMLDivElement>('level');
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
      <span class="chars-card-lv" data-el="lv"></span>
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

  /**
   * ═════════════════════════════════════════════════════════════════════════════
   * STAT ROWS — AND THE PIPS THIS SCREEN WAS PROUD OF ARE THE THING BEING REMOVED
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * WAS: a `.fa-stat-label` beside a `.fa-stat-track` carrying a `.fa-stat-fill` and ten
   * `.fa-stat-pips`, with the reason "ten discrete pips, because the scale in `rules.ts`
   * IS out of ten — a smooth bar makes 7 and 8 indistinguishable at a glance". That
   * reasoning is sound and it is NOT what was wrong, which is why it is recorded here
   * rather than deleted.
   *
   * What killed it is a paired measurement. `stat-bars` is the worst element in the
   * per-element critique at 3 against a reference 7 — and THIS screen's version, the one
   * with the taller track AND the pips, scored the SAME 3 as `home.ts`'s plain bar. Two
   * critics, two panels, one number. The two places character select overrides the
   * shared chrome are `.fa-stat-track`'s height and `.fa-stat-pips`, and they moved the
   * critic by ZERO. So "a better bar" is refuted by the only paired control this project
   * has: the reference is not drawing a better bar, it is not drawing a bar at all.
   *
   * What it draws instead, and what `.ds-row` / `.ds-tile--stat` in `theme.ts` are:
   * a slab carrying a filled, TINTED icon tile (ours was a 33x33 px, 1.7-px-stroke,
   * `fill: none` line glyph against a ~72x70 filled tile), a small colour-coded label
   * ABOVE the value rather than beside it, and the numeral at display weight.
   *
   * The value is no longer animated, because there is no width to animate. It is
   * rewritten per view, which is what `view()` already did to the numeral.
   *
   * ⚠️ `.fa-stat` stays on the wrapper: `chars_metrics`'s clipping guard lists it in
   * CARES and this screen is one of its two users.
   */
  const statVals = new Map<string, HTMLSpanElement>();
  for (const row of STAT_ROWS) {
    const wrap = el('div', 'fa-stat ds-row ds-row--slate chars-stat');
    wrap.style.setProperty('--ds-row-accent', row.color);
    wrap.innerHTML = `
      <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${row.color}">${icon(row.icon)}</span>
      <span class="ds-row-body">
        <span class="ds-row-label">${row.label}</span>
        <span class="ds-row-val ds-num"></span>
      </span>
    `;
    statVals.set(row.key, wrap.querySelector<HTMLSpanElement>('.ds-row-val')!);
    statsEl.appendChild(wrap);
  }

  /**
   * ── THE LEVEL BLOCK, AND WHY IT IS NOT A FOURTH STAT BAR ──────────────────
   *
   * The three bars above are the AUTHORED card — `def.stats`, integers on a 0-10 scale,
   * asserted by `sim.test.mjs` §22 to be exactly what the sim uses at level 1. They
   * describe the CHARACTER. `rules.ts` DEVIATION #11 is explicit that a level must not
   * write into them: doing so would either turn those gates red or re-create the defect
   * `DECISIONS §13` exists to have fixed — a card that says something the model does not
   * compute. It also could not work: one card point is worth 13.5-27.9 pp of measured
   * strength, so a 0-10 integer scale cannot express fifteen levels even in principle.
   *
   * ⚠️ That figure USED to read "7-12 pp", and the old wording is kept here per CLAUDE.md
   * because several packets quote it. It came from the PRE-FIX driver — the one whose
   * scripted player could not heal — and it is stale by roughly 2x. Re-measured on the
   * fixed driver in `6cc2438`: Sushi h4->h7 gives 30.3 / 43.8 / 59.8 / 73.9, Water Bottle
   * h5->h7 gives 27.5 / 46.3 / 74.2. The conclusion above does not just survive the
   * correction, it gets STRONGER: a coarser point makes the integer scale less able to
   * express a level, not more. Corrected here rather than in the balance pass itself
   * because this file had a live owner at the time and rule 9 outranks a tidy diff.
   *
   * So the level is a SEPARATE, CONTINUOUS readout, and it states the two numbers the
   * simulation literally computes:
   *
   *   * HP is `maxHpFor(id, PLAYER_MAX_HP, level)` — the exact call `sim.ts:createMatch`
   *     makes for the player fighter, imported from `rules.ts` rather than re-derived.
   *   * Damage is `levelDamageMultiplier(level)` — the exact factor `combat.ts:applyDamage`
   *     multiplies every hit by.
   *
   * Neither can drift from the sim, because neither is a copy of it. That is the whole
   * design rule of this screen applied to a new axis.
   */
  function renderLevel(): void {
    const id = viewed;
    const level = ctx.profile.characterLevel(id);
    const price = ctx.profile.nextLevelPrice(id);
    const affordable = ctx.profile.canLevelUp(id);
    const maxed = price === null;

    const hp = maxHpFor(id, PLAYER_MAX_HP, level);
    const dmg = levelDamageMultiplier(level);
    const nextHp = maxed ? hp : maxHpFor(id, PLAYER_MAX_HP, level + 1);
    const nextDmg = maxed ? dmg : levelDamageMultiplier(level + 1);

    // The "+N" previews are the DIFFERENCE between two calls to the same function the
    // sim makes — never a percentage recomputed here. A preview that is arithmetic on a
    // displayed number rather than a second evaluation of the model is exactly how a
    // readout starts lying.
    const gain = maxed ? '' : `
      <span class="chars-lv-gain"><span class="chars-lv-item">${icon('health')} +${nextHp - hp}</span
        ><span class="chars-lv-item">${icon('damage')} +${Math.round((nextDmg / dmg - 1) * 100)}%</span></span>`;

    levelEl.innerHTML = `
      <div class="chars-lv-head">
        <span class="chars-lv-badge${maxed ? ' is-max' : ''}">Lv ${level}${maxed ? '' : ` / ${LEVEL_MAX}`}</span>
        <span class="chars-lv-now"><span class="chars-lv-item">${icon('health')} ${hp} HP</span
          ><span class="chars-lv-item">${icon('damage')} x${dmg.toFixed(2)}</span></span>
      </div>
      ${gain}
      <button class="ds-btn ds-btn--block chars-lv-btn" type="button" data-el="upgrade"${maxed || !affordable ? ' disabled' : ''}>${
        maxed
          ? `${icon('star')} Max level`
          : `${icon('sparkle')} Upgrade <span class="chars-lv-price">${icon('coin')} ${price.coins.toLocaleString()}</span>`
      }</button>
      ${maxed || affordable ? '' : `<span class="chars-lv-short">${
        (price.coins - ctx.profile.coins).toLocaleString()} more coins needed</span>`}
    `;
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

    // WAS also `statFills.get(row.key)!.style.width = (value / STAT_MAX) * 100 + '%'`.
    // `STAT_MAX` went with it: a row with no denominator does not need one, and a
    // constant kept alive only to divide by is how a screen keeps a bar it no longer
    // draws. `rules.ts` remains the authority on the 0-10 scale.
    for (const row of STAT_ROWS) {
      statVals.get(row.key)!.textContent = String(def.stats[row.key]);
    }

    abilitiesEl.innerHTML = '';
    // Abilities are the prose; weapons are the numbers. They are two views of the
    // same thing, so pairing them turns a flavour list into a readout you can
    // actually pick a fighter with — and it is what fills the detail panel instead
    // of leaving half of it empty.
    //
    // ⚠️ THE OLD JOIN IS KEPT HERE WITH ITS REASON, because the reason was the bug:
    //
    // > `const weapon = def.weapons.find((w) => w.name === ability.name);`
    // > *"…and `rules.ts` names them identically, so pairing them…"*
    //
    // It named the load-bearing assumption out loud — the two arrays agreed **by
    // convention**, with nothing in the type system or in any gate holding them
    // together. `AbilityBlurb.weapon` is now a declared key into this character's own
    // `weapons[]`, `abilityCards()` performs the join once, and this screen no longer
    // touches `def.weapons` at all. Identical output on all 34 rows (33 joined + Donut's
    // passive), proven by rendering both arms — `tools/tmp/wj_render.mjs`.
    for (const ability of abilityCards(def)) {
      const weapon = ability.weapon;
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
    renderLevel();
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

  /** Every card carries its own level, so the roster reads as a collection of
   *  investments rather than eleven identical tiles. Hidden at level 1 — a badge on
   *  every card at once is a badge that says nothing. */
  function renderCardLevels(): void {
    for (const [id, card] of cards) {
      const level = ctx.profile.characterLevel(id);
      const badge = card.querySelector<HTMLElement>('[data-el="lv"]');
      if (!badge) continue;
      badge.textContent = level > 1 ? `Lv ${level}` : '';
      card.classList.toggle('has-lv', level > 1);
      card.classList.toggle('is-maxed', level >= LEVEL_MAX);
    }
  }

  function renderHeader(): void {
    q('wins').textContent = String(ctx.profile.wins);
    q('coins').textContent = ctx.profile.coins.toLocaleString();
  }

  /**
   * ⚠️ THE UPGRADE IS OPTIMISTIC AND THE MODEL IS THE ONLY AUTHORITY.
   *
   * `profile.levelUp()` returns null for "maxed" and for "cannot afford" alike, and the
   * screen does nothing on null. There is deliberately NO check here that duplicates the
   * model's — a second copy of an affordability rule in a click handler is the same class
   * of defect as a second copy of a drop-rate table, and the button's disabled state is
   * already derived from `canLevelUp`.
   */
  levelEl.addEventListener('click', (ev) => {
    if (!(ev.target as HTMLElement).closest('[data-el="upgrade"]')) return;
    const got = ctx.profile.levelUp(viewed);
    if (!got) return;
    burstConfetti(confetti, 34, 18);
    stage.poke();
  });

  const unsubscribe = ctx.profile.onChange(() => {
    renderHeader();
    renderCardLevels();
    renderLevel();
  });

  renderHeader();
  renderCardLevels();
  view(viewed);
  stage.attachTo(heroHost);

  return {
    root,
    update(dt) { stage.update(dt); },
    resize() { stage.resize(); },
    dispose() {
      unsubscribe();
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-3);
  overflow: hidden;
  box-shadow: var(--ds-e3);
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
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #EFE2CC 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-chars .chars-equip:hover { filter: brightness(1.05); }
.fa-chars .chars-equip:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
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
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e1);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track);
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e3);
  transition: transform 0.1s, box-shadow 0.1s, border-color 0.12s;
}
.fa-chars .chars-card:hover { transform: translateY(-3px); box-shadow: var(--ds-e4); }
.fa-chars .chars-card:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
/* The card you are LOOKING at: gold frame, the same colour the HUD reserves for
   "this is the selected slot" on the weapon bar. One meaning, one colour. */
.fa-chars .chars-card.is-viewed {
  border-color: var(--gold);
  box-shadow: var(--ds-e3), 0 0 0 3px var(--gold), 0 0 16px var(--rarity-glow);
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
   at a 10% bias the landscape crop takes 3% off the top and 25% off the bottom.

   WHAT THIS ELEMENT IS REALLY PROMISING, restated because the previous version of this
   note promised something the render cannot deliver. It said the head keeps ~5% of
   clearance because the render leaves 8% of clear frame above it (TOP_PAD) — and TOP_PAD
   is not a guarantee. It is a PREFERENCE that 'thumbs.ts' gives up, by design, whenever a
   character wears its face low enough that the only other way to lift it off this card's
   own nameplate is to zoom out and hand back the fill. Four of eleven spend it (egg,
   waterbottle, donut, lollipop) and their heads are deliberately cropped by 8-17%.

   The promise that IS kept, and that this object-position is chosen against, is about the
   FACE. These three card aspects (0.814 / 1.172 / 0.793) show three different windows of
   the 416x496 source, and their intersection is x [0.027 .. 0.973], y [0.028 .. 0.744];
   'thumbs.ts' solves every character's framing so the projected face box lands inside it,
   with the vertical aimed at 0.70. Change this percentage or a card's padding and that
   window moves — re-measure it with 'tools/tmp/faceframe.mjs' and feed the result back
   into FACE_SAFE, rather than assuming the faces will follow. Asserted per character per
   viewport by 'chars_metrics.mjs''s FACE-OUT column, not eyeballed. */
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
  font-weight: var(--ds-w-bold);
  /* Step 3 of the type ramp. Was 0.78rem max, which put card names, tab labels and
     currency values all within a couple of pixels of each other — a scale with no
     steps in it is not a hierarchy. */
  font-size: var(--ds-t3);
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
  box-shadow: var(--ds-e3), 0 0 14px var(--rarity-glow);
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

/* ── The level block ──────────────────────────────────────────────────────────
   Deliberately a DIFFERENT shape from the three stat bars above it, because it is a
   different kind of statement. The bars describe the character and never move; this
   describes the player's investment in it and is the one control on the panel. Making
   it a fourth bar would have put "what this fighter is" and "what I have spent on it"
   in the same visual channel — the same mistake the trophy road made when it painted
   rarity onto the node fill that already carried claim state.

   Every colour here is ink-on-cream or ink-on-gold: this panel is the one place on the
   screen a PRICE is stated, and a price that fails AA is a price the player disputes. */
.fa-chars .chars-level {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: var(--ds-stroke-1) solid rgba(26,18,36,0.22);
  border-radius: var(--ds-r-2);
  background: rgba(255,255,255,0.5);
}
.fa-chars .chars-lv-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fa-chars .chars-lv-badge {
  flex: 0 0 auto;
  padding: 1px 8px;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t2);
  color: var(--ink);
  white-space: nowrap;
}
.fa-chars .chars-lv-badge.is-max {
  background: linear-gradient(180deg, #A6E24A 0%, var(--lettuce) 100%);
}
.fa-chars .chars-lv-now,
.fa-chars .chars-lv-gain {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  white-space: nowrap;
}
/* The NEXT-level preview is green because it is a gain, and it is the one run on this
   panel that is not simply a fact. 2E7D32 on the panel's near-white plate is 5.4:1. */
.fa-chars .chars-lv-gain { color: #2E7D32; }
/* ── THE SEPARATOR WAS A MIDDLE DOT AT 0.45 OPACITY, AND PIXELS CAUGHT IT ────
   menu_accept passed it at all six viewports and in portrait; screen_metrics.mjs
   measured the two runs at 1.87:1 and 2.93:1 against a 4.5 floor. Exactly the
   inherited-opacity case that instrument exists to see, and the third time this project
   has shipped one — the trophy road's claimed nodes and its status pill were the others.
   It was also a raw U+00B7, an OS-drawn glyph on a screen whose whole icon pass exists to
   have none. Both problems have the same fix: the dot was never carrying meaning, only
   spacing, so it is a flex gap now and there is no run to fail.

   (And writing THIS note is how the file's own warning about backticks inside a CSS
   template literal got proved a fourth time. There are none below this line.) */
.fa-chars .chars-lv-now,
.fa-chars .chars-lv-gain { display: inline-flex; flex-wrap: wrap; gap: 2px 10px; }
.fa-chars .chars-lv-item { display: inline-flex; align-items: center; gap: 3px; }
/* ADOPTED '.ds-btn'. This was nineteen declarations re-deriving, by hand, the gold
   gradient, the ink line, the pill, the lip and the press travel that theme.ts's button
   already declares -- one of the eleven bespoke buttons its adoption map counts. What
   stays is the two things the component does not know: the weight (this control states a
   PRICE, so it runs at black rather than bold) and the disabled treatment below, which is
   a legibility decision rather than a state. */
.fa-chars .chars-lv-btn {
  font-weight: var(--ds-w-black);
  padding: 0 var(--ds-s4);
  letter-spacing: var(--ds-track-tight);
  text-transform: none;
}
/* A disabled upgrade keeps FULL ink contrast and loses only its lift and its fill.
   The usual 0.5 layer opacity would drop the price below AA, and a price is the last
   run on this screen that may become unreadable — see the identical note on the trophy
   road's claimed nodes, which is where this project learned it. */
.fa-chars .chars-lv-btn:disabled {
  cursor: default;
  background: #E6DAC4;
  box-shadow: none;
  border-color: rgba(26,18,36,0.55);
}
.fa-chars .chars-lv-price {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-variant-numeric: tabular-nums;
}
.fa-chars .chars-lv-short {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-body);
  font-size: var(--ds-t1);
  color: rgba(26,18,36,0.82);
}

/* The card badge. Hidden at level 1 — a badge on all eleven cards says nothing. */
.fa-chars .chars-card-lv {
  position: absolute;
  top: 3px;
  inset-inline-start: 3px;
  display: none;
  padding: 0 5px;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-pill);
  background: var(--mustard);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-black);
  font-size: var(--ds-t1);
  line-height: 1.5;
  color: var(--ink);
  z-index: 3;
}
.fa-chars .chars-card.has-lv .chars-card-lv { display: block; }
.fa-chars .chars-card.is-maxed .chars-card-lv { background: var(--lettuce); }
/* ── THE TALLER TRACK AND THE PIPS ARE DELETED, AND THAT IS THE MEASUREMENT ────
   WAS, verbatim, and kept per this project's rule about reversed assertions:

     "Taller bars, and the value is countable rather than estimated."
     .fa-chars .fa-stat-track { height: clamp(16px, 2.6vh, 24px); }
     .fa-chars .fa-stat-pips  { ... repeating-linear-gradient at 10% ... }
     .fa-chars .fa-stat-val   { width: auto; min-width: 18px; ... }

   These two rules were THE ONLY places character select overrides the shared chrome,
   and a per-element critique (6ebb6d1) measured what they bought: NOTHING. This screen's
   taller, pipped stat bar scored 3 against a reference 7 -- the identical number
   'home.ts''s plain bar scored. Two critics, two panels, one result. That is the finding
   that refutes "make the bar better" and is why 'theme.ts' built a ROW instead of a
   better BAR, and why both screens now draw one.

   '.fa-stat-val' goes with them for a second, independent reason: it carries
   'color: var(--ink)' here and 'rgba(26,18,36,0.7)' in theme.ts, and the row it would
   now sit in is a DARK slate plate. Reusing it to keep a class list tidy would have
   shipped dark ink on a dark ground -- 'docs/LESSONS.md' §1 case 10, for the third time
   in this repo. See '.chars-stat' below for what replaced all of it. */
.fa-chars .chars-abilities { display: flex; flex-direction: column; gap: 5px; min-height: 0; }

.fa-chars .chars-ability {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 8px;
  background: #FFFFFF;
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
}
.fa-chars .chars-ability--passive { background: #FFF0CF; }
.fa-chars .chars-ability-em { font-size: var(--ds-t6); line-height: 1.2; flex: 0 0 auto; }
.fa-chars .chars-ability-body { display: flex; flex-direction: column; min-width: 0; }
.fa-chars .chars-ability-name {
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t3);
  line-height: 1.22;
}
.fa-chars .chars-ability-desc {
  font-size: var(--ds-t2);
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
  border-radius: var(--ds-r-pill);
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track-tight);
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

  /* ── AND THE RING IS WHAT PAYS FOR DROPPING THE CHIP ─────────────────────────
     The comment above says the card BACKGROUND already says what the chip said, and
     that was true while the six fills were six unrelated hues. It stopped being true
     when they collapsed into one family (see 'RARITY_CARD_COLORS'): the fills now
     differ by VALUE and CHROMA inside one hue, and the minimum ADJACENT-tier dE on
     the graded on-card colours is 5.0 (Rare vs Epic) where it used to be 52.4.

     Side by side in a grid that still reads. Alone it is thin — and this is the ONE
     viewport with no second signal, because '.chars-card-rarity' is display:none
     exactly here. Neon and Cyber were already covered by '.is-animated' 's
     '--rarity-glow'; Normal, Rare, Epic and Legendary had nothing, and they are
     precisely the four tiers with the tightest dE.

     So the six-way distinction goes back to a 2px ring in 'RARITY_COLORS' — the
     still-six-hue palette, at a few hundred pixels instead of a full card. That is
     the "small number of accents" half of Uri's item 3 rather than a violation of it:
     hue carries rarity at ACCENT area, the fill stays in one family, and it costs
     ZERO layout height, which is the entire reason the chip was dropped at 86x74.

     🚨 THE RING GOES ON '.chars-card-gloss', NOT ON THE CARD, AND THAT COST A ROUND.
     The obvious form is 'inset 0 0 0 2px var(--rarity)' in the CARD's own box-shadow.
     It renders — and it is INVISIBLE, which is CLAUDE.md rule 4 for the nineteenth
     time. An inset box-shadow paints on the element's own background layer, and
     '.chars-card-render' is an absolutely-positioned full-bleed child at 'inset: 0',
     so the render covers the ring on every card that HAS a render. That is all eleven
     of them; it would have been visible only on the placeholder state nobody sees.
     A pixel diff said 221,455 subpixels had changed and a 6x crop showed the two
     frames identical inside the card border — the change was real and the ring was
     under the portrait. The gloss is the sibling AFTER the render in DOM order, also
     inset:0, also z-index auto, so it paints above it and is already the layer this
     card uses for things that must sit over the artwork. */
  .fa-chars .chars-card:not(.chars-card--locked) .chars-card-gloss {
    box-shadow: inset 0 0 0 2px var(--rarity, transparent);
  }

  /* ── THE ABILITIES LIST WAS 28 CSS PX TALL ────────────────────────────────────
     Measured at 852x393 with 'tools/tmp/ud_defects.mjs' (471x84 DEVICE px at DPR 3,
     which is the number the per-element audit reported):

       .chars-abilities   clientHeight 28   scrollHeight 384   overflowY 356

     — a 28px window onto four rows totalling 384px, so the ONE thing on screen was the
     first ability's name and the first line of its description, sliced 7.05px below its
     own descenders. Four rows of four were cut. There was no scrollbar thumb in view
     and no partial second row, so nothing on the screen said a list existed; it read as
     a rendering fault, and that is exactly how the audit described it.

     The itemised bill for the 281px panel that contains it explains the whole thing:

       Stats title  14      chars-stats   60
       chars-level 119      Abilities ttl 14      chars-abilities 28      gaps 24

     '.chars-level' alone — the Lv badge, the HP/damage readout, the +N preview and the
     44px Upgrade button — is 42% of the panel, and it cannot shrink much: the button is
     a tap target and the price on it is the one number on this screen a player disputes.
     So the room comes from ornament and from padding, in the order of least meaning
     lost, and the acceptance test is stated before the fix rather than after it:

       THE FIRST ABILITY IS WHOLE AT EVERY VIEWPORT.

     Not "no row is ever cut" — a four-row list in a two-row window WILL cut the third,
     and that is what scrolling means. A metric that cannot be satisfied is not a metric.
     What must never happen again is the FIRST row being sliced, because a partially
     visible second row is itself the affordance that says there is more. */
  /* The three bars below it are each labelled "Damage" / "Health" / "Speed" in 11px
     ink. A section header that repeats what its own contents already say is the
     cheapest 20px on the panel. The ABILITIES title stays — the pills below it are not
     self-describing. */
  .fa-chars .chars-detail > .fa-panel-title:first-of-type { display: none; }
  /* 3px, not 4: at 844x390 — the ONE phone in 'menu_accept''s viewport list — the
     region came out 65px against a 67.34px row and cut the first card's border by
     2.34px, while 852x393 passed with 68. Three pixels of viewport height is the whole
     difference between the two, which is why this is tuned against the shortest
     supported screen and not the audit's. */
  /* ⚠️ AND THE NOTCH TAKES ANOTHER 21px THAT NO MEDIA QUERY CAN SEE.
     A landscape iPhone's home indicator is a 21px bottom inset, and '@media
     (max-height: 460px)' reads the VIEWPORT height (390) — which is identical with and
     without it. So the safe-area case cannot be given its own rule; the only way to
     serve it is to make the un-notched case carry the slack. Measured with menu_accept's
     own insets, the region was 49px against a 67.34px row. These are the last pixels
     available without deleting a number a player buys with: the level block's readouts
     and its 44px Upgrade button are untouched. */
  .fa-chars .chars-detail { gap: 2px; padding: 4px; }
  /* ⚠️ DELETED, NOT MOVED: '.fa-chars .chars-stats { gap: 1px; }' stood here.
     'dc_guard' reported it as two CASCADE faults ('row-gap' and 'column-gap') because a
     media query adds NO SPECIFICITY: the '@media (max-height: 560px)' block below sets
     'gap: var(--ds-s1)' on the same selector and is written LATER, so at <=460 the later
     block wins and the delivered value is 3px against a declared 1px. The file already
     solved that trap once — the block at the foot of the 560 one is there on purpose,
     with its own measurement.

     🔴 SO THE REFLEX WAS TO MOVE THIS ONE BELOW TOO, AND THE REFLEX WAS WRONG, BECAUSE
     THE AXIS TURNED UNDER THE DECLARATION. The base rule is 'flex-direction: column',
     and 'gap: 1px' was authored FOR THAT COLUMN — the bill above it is entirely in
     VERTICAL pixels ("the notched landscape budget", "16.39px cut off the first ability
     row"). The 560 block turns this element into 'flex-direction: row', and <=460 is a
     strict subset of <=560, so at every viewport this declaration could ever apply to,
     the element is a ROW with 'flex-wrap: nowrap' and the surviving axis is HORIZONTAL.

     Measured on the live element ('tools/tmp/si_gap.mjs'), 3px -> 1px, at the three
     viewports where both queries are live:

         844x390    .chars-stats 163.23x48.17 -> 163.23x48.17   Δh 0.00
         852x393    .chars-stats 164.91x48.17 -> 164.91x48.17   Δh 0.00
         852x460    .chars-stats 164.91x48.17 -> 164.91x48.17   Δh 0.00
         detail overflow Δ 0 · first ability row's clearance Δ 0.00 at all three

     It buys **0.00px of the budget it was written to buy**, at every viewport. The only
     thing that moves is +1.32px of width per stat cell, and no '.ds-row-label' overflows
     in either arm (Damage/Health/Speed all 0 before and 0 after), so it does not even
     pay off the D2 truncation the 560 block already bought with '--ds-track-tight'.
     Re-ordering it would therefore ship a 1px horizontal gap that no author asked for.
     Deleted; the reasoning is kept here because the next reader will see 'dc_guard''s
     fault disappear and wonder which way it was fixed. */
  .fa-chars .chars-level { padding: 2px 6px; gap: 2px; }
  .fa-chars .chars-abilities { gap: 4px; }
  .fa-chars .chars-ability-desc { line-height: 1.25; }
  /* 2px and not 3: at 852x393 the region came out 68px against a 69.34px row, so the
     first row's own 2.5px ink BORDER was still shaved by 1.34px while every text metric
     read clear. The acceptance test is the row's BOX for that reason. */
  .fa-chars .chars-ability { padding: 1px 6px; gap: 6px; }
  /* The fact pills wrapped to two lines inside a 129px body and were worth ~21px of the
     first row on their own. Tighter pills, not smaller type: 10.24px is already the
     floor here and 'screen_metrics' judges these on contrast, which shrinking would
     not change but which a reader would still lose. */
  .fa-chars .chars-ability-facts { margin-top: 1px; gap: 3px; }
  .fa-chars .chars-fact { padding: 0 5px; }
  /* ── THE STAT BAND PAYS FOR ITSELF HERE, MEASURED IN DEVICE PIXELS ────────────
     The 30px compact cell measures 65.17px tall against the 48px the three bars used,
     and this panel has no slack at all on a NOTCHED landscape phone: 'ud_defects'
     reported the first ability row's BOX cut by 16.39px at 844x390+notch and 13.39px at
     852x393+notch -- D3, one of the four hard defects this file exists to keep fixed.
     The un-notched viewports passed; the notch takes 21px off the bottom and no media
     query can see it, so the un-notched case has to carry the slack (the note above says
     exactly this about the 460px bound).

     So the cell is rebuilt to the height budget rather than to the design: a 24px tile,
     the value one rung down at t3, and both text lines at line-height 1. That is 48.2px,
     which hands back the 16.4 and then some. It is NOT the 56px tile the audit called
     for -- but the property the audit measured as wrong was that our icon was a
     1.7px-stroke 'fill: none' OUTLINE at 16px of actual ink, and a 24px filled, tinted,
     ink-bordered tile is still a MASS. The full geometry runs at every viewport with the
     room for it, which is every viewport above 460px tall. */
}

/* ── THE STAT ROWS TURN THROUGH 90 DEGREES ON A SHORT SCREEN ──────────────────
   Identical to the rule 'home.ts' carries, for an identical reason and at a threshold
   this panel's own budget sets. The tall form is three 56px slate rows, ~180px; the
   itemised bill above records this panel at 281px total at 852x393, of which
   '.chars-level' alone is 119. Three tall rows would eat the abilities list whole, which
   is D3 -- the defect this file spent a pass measuring in device pixels.

   Laid out across, the same three facts cost about what the bars did. Nothing is
   dropped: the tinted tile, the colour-coded label and the display-weight numeral all
   survive; only the axis changes.

   ⚠️ 560 and not 460. 852x480 is above every other threshold in this file and is where
   'ud_defects' measured the tightest flank, so a 460 bound would leave the one viewport
   the audit used running the tall form. */
@media (max-height: 560px) {
  /* ⚠️ THE CARD NAME DROPS A RUNG, AND IT IS A REGRESSION FIX RATHER THAN A PREFERENCE.
     Ladder step 3 is right on a desktop card and WRONG on a ~96px one: t3 floors at
     0.82rem = 13.1px against the old clamp's 0.66rem = 10.6px, and the first two
     captures after the type pass rendered "Water Bot..." at BOTH 844x390 and 852x480 on
     cards that had shown "Water Bottle" the run before. Step 2 floors at 0.69rem =
     11.04px, over 'screen_metrics''s 11px legibility floor and back inside the card.
     ⚠️ The threshold is 560 and not 460 for exactly the reason the first fix missed:
     852x480 is above 460, so a 460 bound repaired the phone the suite watches and left
     the phone the AUDIT used still truncating. The portrait breakpoint at the foot of
     this file states the same rule for the same element — a ladder step sized off vh
     knows nothing about how wide the card is, and where the two disagree the CARD wins. */
  .fa-chars .chars-card-name { font-size: var(--ds-t2); }
  .fa-chars .chars-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-chars .chars-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0;
  }
  .fa-chars .chars-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-chars .chars-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  /* The caps tracking goes, and only the tracking: at 11px in a ~55px cell, 0.09em on
     "DAMAGE" is the difference between the word fitting and the component's own ellipsis
     firing, and a truncated label is the D2 defect this screen already fixed once. */
  .fa-chars .chars-stat .ds-row-label { letter-spacing: var(--ds-track-tight); }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t4); }
}

/* ── AND THE NOTCHED LANDSCAPE PHONE PAYS FOR THE BAND OUT OF THE BAND ─────────
   🚨 THIS BLOCK IS BELOW THE 560px ONE ON PURPOSE, AND THE FIRST ATTEMPT WAS ABOVE IT.
   A MEDIA QUERY ADDS NO SPECIFICITY, so a '@media (max-height: 460px)' rule written
   earlier in the file loses to an identical selector inside '@media (max-height: 560px)'
   written later -- both match at 390px tall and the later one wins. Measured: the tile
   stayed 30px and the band came back 62.73px instead of the ~48 intended, i.e. the fix
   moved 2.44px of the 16.39 it was written to move. Second time this exact trap fired in
   this pass; the first was in 'home.ts'.

   The budget it is paying: 'ud_defects' measured the first ability row's BOX cut by
   16.39px at 844x390+notch and 13.39px at 852x393+notch after the stat band went in --
   D3, one of the four hard defects this file exists to keep fixed. The notch takes 21px
   off the bottom and NO media query can see it (the block above says so), so the
   un-notched case has to carry the slack.

   A 24px tile is not the 56px the audit called for, and that is a stated compromise
   rather than a miss: the property the audit measured as WRONG was that our icon was a
   1.7px-stroke 'fill: none' OUTLINE with 16px of actual ink, and a 24px filled, tinted,
   ink-bordered tile is still a MASS. The full 56px geometry runs at every viewport that
   has the room, which is every viewport above 560px tall. */
@media (max-height: 460px) {
  /* And 4px of headroom on top, because 0.61px is not a margin. With the band at 48.17
     the first ability row cleared its container by 0.61px at 844x390+notch -- a pass
     that the next font-metric change anywhere in the product would turn into a failure.
     The panel's own gap is the cheapest 4px in the bill and it deletes nothing: 1px
     instead of 2px across four gaps. Margin 0.61 -> ~4.6px. */
  .fa-chars .chars-detail { gap: 1px; }
  .fa-chars .chars-stat { padding: 0; }
  .fa-chars .chars-stat .ds-tile--stat { width: 24px; height: 24px; font-size: var(--ds-t4); }
  .fa-chars .chars-stat .ds-row-label { line-height: 1; }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t3); line-height: 1; }
}

@media (max-width: 700px) {
  .fa-chars .chars-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(90px, 0.9fr) minmax(0, 1.1fr) auto;
  }
  .fa-chars .chars-detail { max-height: 34vh; }
  .fa-chars .chars-heading { display: none; }
  /* ── THE STAT BAND GOES ACROSS HERE TOO, AND 'chars_metrics' IS WHAT SAID SO ──
     Portrait caps this panel at 34vh = 317px, and the tall '.ds-row' form is three 56px
     slabs plus gaps = ~180px of it. With the level block at ~100 and two section titles
     at 15 each there is nothing left, so the panel OVERFLOWED and the "Abilities" title
     was drawn on the shell's red backdrop: 'chars_metrics' measured it at 2.95:1 against
     a 4.5 floor -- 'rgba(26,18,36,0.8) on rgb(202,52,45)@27%', which is the page
     background, not a panel. A contrast battery reported it, and what it was actually
     detecting was a LAYOUT overflow. (LESSONS §6b: an acceptance test proves you moved
     the thing you named, not that it was the thing.)
     Across, the band is ~65px and the panel fits. There is far more WIDTH here than on a
     landscape phone, so the tile keeps its 30px rather than dropping to the notched
     phone's 24. */
  .fa-chars .chars-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-chars .chars-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0;
  }
  .fa-chars .chars-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-chars .chars-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  .fa-chars .chars-stat .ds-row-val { font-size: var(--ds-t4); }
  /* Step 3 of the type ramp is sized off vh, and in portrait there is a lot of vh and
     very little card: 1.85vh of 932 is 16.3px inside an 84px tile, which ellipsised
     "Hamburger" to "Hambu...". Sizing it off the card instead of off the viewport is
     not something CSS can express, so the ramp step is simply shorter here — 12.1px,
     still over the 11px floor and still a step above the rarity chip below it. */
  .fa-chars .chars-card-name { font-size: var(--ds-t2); }
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
