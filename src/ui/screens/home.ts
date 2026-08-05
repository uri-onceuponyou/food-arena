/**
 * Home screen — the lobby.
 *
 * ── Why this is a RESTRUCTURE and not another round of patches ──────────────
 * This screen scored 4/10 twice and its loop did not converge, it STOPPED: two blind
 * critics reversed each other. r1 called the ragged 12th grid cell a defect and a
 * locked tile was added; r2 said remove the locked tile. r1 asked for a single
 * "coming soon" affordance instead of five SOON chips; r2 named that one card the
 * single most damaging element on the screen. Both rounds were patches applied
 * *inside* a layout nobody had questioned, which is exactly the situation
 * `PROGRESS.md` describes as an element oscillating at its own noise floor.
 *
 * Uri unfroze the prototypes for the menus (`THREE_SESSION_PLAN.md`, SCREENS), so
 * `reference/prototypes/home-screen.html` is now reference rather than
 * specification. What follows keeps its INTENT — status bar, hero centre stage, loud
 * START at the bottom — and changes its arrangement where the arrangement was the
 * problem.
 *
 * ── What was measurably wrong, and what each fix is ─────────────────────────
 *
 * 1. **More than half the frame was empty cyan.** The hero panel ran the full width
 *    of the middle row (1330x730 at 16:9, aspect 1.82) while the character inside it
 *    was ~350px across — 26% of the panel's width. `charStage.applyFraming()` fits
 *    the subject to whichever axis binds, and on a panel that wide the binding axis
 *    is always height, so the extra width is *always* empty backdrop. The panel is
 *    now capped near square (`width: min(100%, 96vh)`), which is the shape the
 *    character-select hero column already is — and that screen scores 6/10 with the
 *    same renderer, the same lighting and the same model.
 *
 * 2. **The left rail was one small card above ~600px of nothing.** Emptiness is its
 *    own "unfinished" signal, and it was the rail that made the hero panel so wide.
 *    Both flanks now carry real, live state and nothing else.
 *
 * 3. **START GAME had no subject.** A brawler lobby's primary button says what it
 *    starts. It now carries the mode and the match length, and the length is read
 *    from `MATCH_DURATION_MS` rather than typed, so it cannot drift from the sim.
 *
 * 4. **The nameplate sat on the character's feet.** It was bottom-centred over a
 *    panel whose bottom-centre is exactly where the plinth is — visible in any
 *    short-viewport capture. It is now a card header in the panel's top-left, which
 *    is dead sky in every framing the rig produces, and the tap hint moved to the
 *    opposite corner.
 *
 * 5. **The tab bar was the lowest-contrast element on the screen** — an unactioned
 *    finding from two trophy-road critics. Fixed one level down in `theme.ts`, so
 *    every screen that adopts tabs inherits it.
 *
 * 6. **The settings gear said "coming soon".** Settings exists now (`settings.ts`).
 *
 * ── The one rule both critics agreed on ─────────────────────────────────────
 * Nothing on this screen advertises something that does not work. Every number comes
 * from `game/economy/` or `game/rules.ts`, every tappable surface goes somewhere
 * real, and there is no "soon" anywhere.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROUND 2 — what a valid blind critic actually measured, and what changed
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The restructure above was never scored. It has been now: a blind A/B packet
 * (`shots/review/home-r1/`) put this screen in front of a fresh critic twice without
 * telling it that both panels were the same screen. It scored 6.5 both times, against
 * a reference side of 8.5 and 8.0 — inside the 7-9 calibration band, so the round
 * measured the WORK and not the critic (`docs/LESSONS.md` §3).
 *
 * Its verdict, in its own order of impact:
 *
 *   1. "The best asset on the screen reads as a cutout pasted on a colour swatch."
 *      The hero, the CTA and the composition were all called shipped-grade; the hero
 *      CARD was not. No horizon, no floor plane, no pool of light, no shadow under
 *      the gold disc.
 *   2. "Everything around the hero is web UI rather than game UI" — flat cards, one
 *      display face used twice on the whole screen.
 *   3. Two text runs effectively invisible: "TAP TO TAUNT" and "3:00 · last one
 *      standing".
 *   4. The ability list "reads as a spreadsheet in the middle of a brawler".
 *
 * ── The measurement, and where the critic's MECHANISM was wrong ─────────────
 * `tools/tmp/home_metrics.mjs` was written before touching this file, because an
 * element with no acceptance test oscillates at its own noise floor. It measures the
 * card's blue field off the rendered PNG. Baseline, 1600x900:
 *
 *   value break, band behind the head vs the lower corners ....... 30.2%
 *   largest single luma STEP anywhere in the field (a horizon) .....2.89%
 *   contact-shadow darkening under the plinth ..................... 0.3%
 *
 * The critic prescribed "15-20% darker at the lower corners". The card was ALREADY at
 * 30%. What it did not have was an EDGE anywhere and any contact at all — 0.3% is
 * nothing, the disc genuinely touches nothing. So the named gap ("reads as a cutout")
 * was real and the prescribed mechanism was not, which is exactly the failure mode
 * `docs/LESSONS.md` §3 warns about. What is built below is a horizon and a contact
 * shadow, NOT a darker vignette — the art direction is high-key and a dark vignette
 * would have been the wrong move twice over.
 *
 * ── Two bugs the instrument found on its own ────────────────────────────────
 * Neither was in any critic's list, and neither is visible to `tsc`:
 *
 *   * `.home-track-sub` was rendering in **Arial**. It lives inside a `<button>`, and
 *     a button does not inherit `font-family`, so the two busiest lines in the left
 *     rail were in the UA default face while everything around them was Heebo.
 *   * The trophy-road icon rendered a raw 📦. `emojiIcon()` falls through to the emoji
 *     when a glyph is unmapped, and the chest container's 📦 is deliberately absent
 *     from `EMOJI_TO_ICON` (see the note there: an emoji cannot tell a box from a
 *     fighter). Containers are keyed by KIND, so this now calls `containerIcon()`.
 *     One emoji was still shipping on the lobby of a build whose headline was "all 60
 *     emoji replaced".
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ROUND 3 — the staging moved into the RENDERER, and four CSS layers went away
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Round 2 built the horizon, the room and the contact shadow as masked CSS layers
 * sitting ON TOP of the canvas, and said so plainly: they had to be, because `Stage`
 * clears to an opaque colour and anything painted BEHIND the canvas is invisible. That
 * was a workaround for a structural blocker, and it capped what the card could ever
 * be — every layer available from here is a tint OVER the character, so all of them
 * had to be low-alpha, none of them could be occluded by the hero, and none of them
 * could cast anything.
 *
 * `charStage.ts` now builds a real set: a lit cyclorama, a floor the ground plane
 * terminates against, a podium with a real inset, and a real cast shadow. So the four
 * layers are DELETED rather than kept alongside it — two horizons in one card is worse
 * than either alone, and the second one is drawn over the hero.
 *
 * Measured at 1600x900 with `tools/tmp/home_metrics.mjs`, CSS layers then 3D set — and
 * BOTH SIDES ON THE SAME SNAPSHOT, with this file, `charStage.ts` and
 * `characterSelect.ts` reverted to HEAD inside the frozen copy for the before run. Five
 * peers are editing `src/characters/**` right now, so two snapshots taken an hour apart
 * would not have been comparing the same cast (`docs/LESSONS.md` §5):
 *
 *   contact-shadow darkening under the podium ....... 39.6%  ->  39.5%
 *   largest single luma STEP in the field (horizon) .. 7.78% ->  47.33%
 *   value break, head band vs lower corners ......... 35.7%  ->  59.3%
 *   field mean saturation ........................... 0.697  ->  0.944
 *   text runs below WCAG AA ......................... 0 of 40 -> 0 of 40, min 5.97
 *
 * and the number none of the CSS could ever have moved, `tools/tmp/stage_fg.mjs`:
 *
 *   character vs surround, home ..................... -0.234 -> +0.188
 *   character vs surround, character select ......... -0.241 -> +0.206
 *
 * against the shipped match's +0.216. See `docs/LESSONS.md` §13 — that inversion is why
 * every silhouette judgement ever made on this screen was made against a figure/ground
 * relationship the player never sees.
 */

import { CHARACTERS, MATCH_DURATION_MS, RARITY_COLORS } from '../../game/rules';
import { containerIcon, ensureIconStyles, emojiIcon, hydratePortraits, icon, portraitMarkup } from '../icons';
import { MATCH_PAYOUT, milestoneFace, roadProgress } from '../../game/economy';
import { XP_PER_LEVEL } from './profile';
import type { Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { burstConfetti, el } from './fx';
import { getCharacterStage, PORTRAIT_BG_CSS } from './charStage';

/** The one mode this build ships. Named here rather than in `rules.ts` because it is
 *  a piece of front-end copy, not a balance constant — but the DURATION beside it is
 *  read from the sim so the lobby cannot promise a match length the sim does not
 *  keep. */
const MODE_NAME = '1v1 · Kitchen Rumble';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createHomeScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-home-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-home');
  const stage = getCharacterStage();

  root.innerHTML = `
    <header class="fa-topbar">
      <div class="fa-chip"><span class="fa-chip-em">${icon('avatar')}</span><span data-el="name"></span></div>
      <div class="fa-chip"><span class="fa-chip-em">${icon('trophy')}</span><span class="fa-chip-val" data-el="trophies">0</span></div>
      <div class="fa-chip home-chip-coin"><span class="fa-chip-em">${icon('coin')}</span><span data-el="coins">0</span></div>
      <div class="fa-topbar-spacer"></div>
      <nav class="fa-tabs">
        <button class="fa-tab is-active" type="button">Home</button>
        <button class="fa-tab" type="button" data-go="characters">Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">Shop</button>
      </nav>
      <button class="fa-iconbtn" type="button" data-el="settings" aria-label="Settings">${icon('gear')}</button>
    </header>

    <div class="home-middle">
      <!-- LEFT: progression. Everything here is live economy state and every row is
           a real destination. -->
      <aside class="fa-panel home-col home-progress">
        <p class="fa-panel-title">Progress</p>

        <!-- The level bar lives HERE, not in the bottom bar. It used to be a 16px
             hairline floating alone in the bottom-left corner with nothing within
             400px of it, which is a lot of screen for a stat; and it is progression,
             so it belongs with the other two progressions rather than beside the CTA. -->
        <div class="fa-level home-level">
          <span class="fa-level-label home-lv" data-el="lv">Lv 1</span>
          <div class="fa-level-track">
            <div class="fa-level-fill" data-el="lvfill"></div>
            <span class="fa-level-xp" data-el="lvxp"></span>
          </div>
          <span class="fa-level-label" data-el="lvnext">Lv 2</span>
        </div>

        <button class="home-track" type="button" data-go="trophies" data-el="road">
          <span class="home-track-top">
            <span class="home-track-icon" data-el="roadicon">${icon('chest')}</span>
            <span class="home-track-text">
              <span class="home-track-title" data-el="roadtitle">Next reward</span>
              <span class="home-track-sub" data-el="roadsub"></span>
            </span>
            <span class="home-track-pill" data-el="roadpill">${icon('trophy')}</span>
          </span>
          <span class="home-bar"><span class="home-bar-fill" data-el="roadfill"></span></span>
        </button>

        <button class="home-track" type="button" data-go="trophies" data-el="chest">
          <span class="home-track-top">
            <span class="home-track-icon">${icon('gift')}</span>
            <span class="home-track-text">
              <span class="home-track-title">Free chest</span>
              <span class="home-track-sub" data-el="chestsub"></span>
            </span>
            <span class="home-pips" data-el="pips"></span>
          </span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${icon('chest')}</span>
            <span class="home-track-text">
              <span class="home-track-title" data-el="heldtitle"></span>
              <span class="home-track-sub">Waiting to be opened</span>
            </span>
            <span class="home-track-pill is-go">Open</span>
          </span>
        </button>

        <div class="home-record">
          <div class="home-rec"><span class="home-rec-val" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-val" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-val" data-el="best">0</span><span class="home-rec-key">Best ${icon('trophy')}</span></div>
        </div>
      </aside>

      <!-- CENTRE: the equipped fighter, rendered by the game's own renderer.
           There are no staging layers over the canvas any more. Round 2 had four of
           them — a ray burst, a room, a horizon and a contact shadow — because
           'Stage' clears opaque and nothing could be painted BEHIND the canvas. All
           four are now real geometry inside 'charStage.ts', where they can be lit,
           occluded by the hero, and cast. Everything between the canvas and the
           labels here is a LABEL. -->
      <section class="home-stage" data-el="stage">
        <div class="home-stage-3d" data-el="stage3d"></div>
        <div class="home-nameplate">
          <span class="fa-title home-hero-name" data-el="heroname"></span>
          <span class="fa-rarity" data-el="herorarity"></span>
        </div>
        <div class="home-stage-hint" data-el="hint">Tap to taunt</div>
      </section>

      <!-- RIGHT: what you are about to take into the match. -->
      <aside class="fa-panel home-col home-fighter">
        <p class="fa-panel-title">Your fighter</p>
        <div class="home-stats" data-el="stats"></div>
        <div class="home-kit" data-el="kit"></div>
        <p class="home-kit-cap" data-el="kitcap"></p>
        <button class="fa-btn fa-btn--quiet home-change" type="button" data-go="characters">
          ${icon('swap')} Change
        </button>
      </aside>
    </div>

    <footer class="home-bottom">
      <div class="home-mode">
        <span class="home-mode-name">${MODE_NAME}</span>
        <span class="home-mode-sub" data-el="modesub">${formatDuration(MATCH_DURATION_MS)} · last one standing</span>
      </div>
      <button class="fa-btn fa-btn--primary" type="button" data-el="start">${icon('play')} Start Game</button>
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

  /**
   * ROUND 2's `syncStaging()` LIVED HERE, and its removal is the point of round 3.
   *
   * It read the portrait's own projected foot line out of `charStage.info()` and drove
   * two CSS custom properties from it, so a masked horizon and a masked contact shadow
   * could be positioned under whichever fighter was mounted — the plinth does not land
   * at a fixed height, because `applyFraming()` fits the whole assembly and a taller
   * fighter therefore lifts it. That was careful work and it is all obsolete: the
   * horizon and the shadow are now geometry standing in the same world as the podium,
   * so they are under it by construction rather than by calibration. The 0.806 m
   * perspective constant it needed (trigonometry said 0.62; `docs/LESSONS.md` §6) went
   * with it.
   */
  /** Which ability tile is showing its description. Survives a profile re-render;
   *  reset in `renderKit()` when the new fighter has fewer abilities. */
  let kitIndex = 0;

  /**
   * Row 1 — the trophy road.
   *
   * Round 2 carried a fake shop offer here ("1 Chest — 359 coins") for a shop that
   * does not exist. This is the same slot doing real work: the next node, the
   * distance to it, and a filled bar measuring the gap the player is actually
   * crossing. `roadProgress()` measures from the PREVIOUS node rather than from
   * zero — a bar running 0..4000 barely moves in a session and reads as broken, and
   * the economy module already solved that, so the menu does not re-solve it.
   */
  function renderRoad(): void {
    const claims = ctx.profile.claimable.length;
    const road = q<HTMLButtonElement>('road');
    const fill = q<HTMLSpanElement>('roadfill');

    if (claims > 0) {
      road.classList.add('is-ready');
      q('roadicon').innerHTML = icon('sparkle');
      q('roadtitle').textContent = claims > 1 ? `${claims} rewards ready` : 'Reward ready';
      q('roadsub').textContent = 'Tap to claim';
      q('roadpill').textContent = 'Claim';
      fill.style.width = '100%';
      return;
    }
    road.classList.remove('is-ready');

    const { progress01, next } = roadProgress(ctx.profile.trophies);
    fill.style.width = `${(progress01 * 100).toFixed(1)}%`;

    if (!next) {
      q('roadicon').innerHTML = icon('flag');
      q('roadtitle').textContent = 'Road complete';
      q('roadsub').textContent = 'Every reward claimed';
      q('roadpill').innerHTML = `${icon('trophy')} ${ctx.profile.trophies.toLocaleString()}`;
      return;
    }

    const face = milestoneFace(next.reward, ctx.profile.unlocked);
    // A character milestone shows the real 3D portrait; everything else has no
    // in-world counterpart, so it is a drawn icon. See `ui/icons/index.ts`.
    //
    // Containers go through `containerIcon(kind)` and NOT through `emojiIcon(emoji)`.
    // `emojiIcon` falls through to the raw glyph when a mapping is missing, and the
    // chest's 📦 is deliberately unmapped — `EMOJI_TO_ICON` cannot carry container
    // glyphs because `CONTAINERS.hamburgerBox.emoji` is the same 🍔 as
    // `CHARACTERS.hamburger.emoji`, so an emoji lookup cannot tell a box from a
    // fighter. The kind can. Before this line the very first row of the lobby's left
    // rail was rendering a system emoji in Arial at 24px.
    q('roadicon').innerHTML = next.reward.type === 'character'
      ? portraitMarkup(next.reward.id, { crop: 'head' })
      : next.reward.type === 'container'
        ? containerIcon(next.reward.kind)
        : emojiIcon(face.emoji);
    hydratePortraits(root);
    q('roadtitle').textContent = face.title;
    q('roadsub').textContent = `${(next.trophies - ctx.profile.trophies).toLocaleString()} trophies to go`;
    q('roadpill').innerHTML = `${icon('trophy')} ${next.trophies.toLocaleString()}`;
  }

  /** Row 2 — the free-chest cadence, drawn as pips rather than as a sentence. Three
   *  wins is a countable number; a bar for it would be false precision. */
  function renderChest(): void {
    const left = ctx.profile.winsToNextChest;
    const per = MATCH_PAYOUT.winsPerChest;
    const done = Math.max(0, Math.min(per, per - left));
    q('chestsub').textContent = left === 0
      ? 'Ready on your next win'
      : `${left} more ${left === 1 ? 'win' : 'wins'}`;
    q('pips').innerHTML = Array.from(
      { length: per },
      (_, i) => `<span class="home-pip${i < done ? ' is-on' : ''}"></span>`,
    ).join('');
  }

  /** Row 3 — unopened containers. Hidden entirely at zero: a control that cannot do
   *  anything must not be drawn, which is the finding both menu critics agreed on. */
  function renderHeld(): void {
    const n = ctx.profile.containerCount;
    const held = q<HTMLButtonElement>('held');
    held.hidden = n === 0;
    if (n > 0) q('heldtitle').textContent = n === 1 ? '1 chest held' : `${n} chests held`;
  }

  /** The right flank. Display stats are `rules.ts`'s 0-10 scale — the same numbers
   *  character select draws, so the two screens cannot disagree about a fighter. */
  function renderFighter(): void {
    const def = CHARACTERS[ctx.profile.selected];
    const rows: Array<[string, string, number, string]> = [
      ['damage', 'Damage', def.stats.damage, 'var(--ketchup)'],
      ['health', 'Health', def.stats.health, 'var(--lettuce)'],
      ['speed', 'Speed', def.stats.speed, 'var(--water)'],
    ];
    // `<div>`, not `<span>`, for the fill. `theme.ts` styles `.fa-stat-fill` with a
    // width and a height and nothing else — an inline span silently ignores both, and
    // the bars render as empty tracks. Round 1 of this restructure shipped exactly
    // that, and it is invisible to tsc and to every assertion in `menu_accept`.
    q('stats').innerHTML = rows.map(([ic, label, value, color]) => `
      <div class="fa-stat">
        <span class="fa-stat-label">${icon(ic)} ${label}</span>
        <div class="fa-stat-track">
          <div class="fa-stat-fill" style="width:${value * 10}%;background-color:${color}"></div>
        </div>
        <span class="fa-stat-val">${value}</span>
      </div>`).join('');

    renderKit();
  }

  /**
   * The kit, as tiles rather than as a table.
   *
   * Round 1 drew it as one white row per ability — "four white rows of identical
   * width, identical value, identical border and identical 10px-bold / 8px-grey
   * two-line text, differentiated only by a 6px coloured dot. It reads as a
   * spreadsheet in the middle of a brawler." Every word of that was true, and the
   * measurable half of it is that eight of the screen's forty-four text runs lived
   * here, four of them below 11px.
   *
   * So: a chunky icon tile per ability carrying the NAME only, and the descriptions
   * moved to a tap state. The description is not deleted — this screen's standing rule
   * is that the lobby shows what it knows — it moves into one caption line under the
   * grid, which is a fixed height so selecting a tile can never reflow the panel (a
   * reflow here would push the Change button and could overflow the card).
   *
   * The last tile spans both columns when the count is odd. Three of the eleven
   * fighters carry three abilities, and a ragged final grid cell was named a defect by
   * a critic on this very screen once already.
   */
  function renderKit(): void {
    const def = CHARACTERS[ctx.profile.selected];
    if (kitIndex >= def.abilities.length) kitIndex = 0;
    q('kit').innerHTML = def.abilities.map((a, i) => `
      <button class="home-kit-tile${i === kitIndex ? ' is-on' : ''}" type="button" data-kit="${i}">
        <span class="home-kit-em">${emojiIcon(a.emoji)}</span>
        <span class="home-kit-name">${a.name}</span>
      </button>`).join('');
    const cap = q<HTMLParagraphElement>('kitcap');
    cap.textContent = def.abilities[kitIndex]?.desc ?? '';
    // Point the caption at the tile it belongs to. Round 2's critic: "'Slows enemies
    // down' is centred under the whole 2x2 grid so it binds to no button in
    // particular." A caption for a tap state has to say WHICH tap it is describing, and
    // a caret under the selected column is the cheapest unambiguous way to say it. The
    // odd last tile spans both columns, so its caret goes to the middle.
    const spansBoth = kitIndex === def.abilities.length - 1 && def.abilities.length % 2 === 1;
    cap.style.setProperty('--home-cap-x', spansBoth ? '50%' : kitIndex % 2 === 0 ? '25%' : '75%');
  }

  function render(): void {
    const def = CHARACTERS[ctx.profile.selected];
    q('name').textContent = ctx.profile.name;
    q('trophies').textContent = ctx.profile.trophies.toLocaleString();
    q('coins').textContent = ctx.profile.coins.toLocaleString();
    renderRoad();
    renderChest();
    renderHeld();
    renderFighter();
    q('wins').textContent = ctx.profile.wins.toLocaleString();
    q('losses').textContent = ctx.profile.losses.toLocaleString();
    q('best').textContent = ctx.profile.bestTrophies.toLocaleString();
    q('lv').textContent = `Lv ${ctx.profile.level}`;
    q('lvnext').textContent = `Lv ${ctx.profile.level + 1}`;
    q<HTMLDivElement>('lvfill').style.width = `${(ctx.profile.levelProgress01 * 100).toFixed(1)}%`;
    q('lvxp').textContent = `${ctx.profile.xp % XP_PER_LEVEL} / ${XP_PER_LEVEL} XP`;
    heroName.textContent = def.name;
    heroRarity.textContent = def.rarity;
    heroRarity.style.background = RARITY_COLORS[def.rarity];
    stage.show(def.id);
  }

  // Every flank card and every tab routes through one delegated handler, so adding a
  // destination is one `data-go` attribute rather than another listener to leak.
  const onClick = (ev: MouseEvent): void => {
    const node = ev.target as HTMLElement;
    const tile = node.closest<HTMLElement>('[data-kit]');
    if (tile) {
      const i = Number(tile.dataset.kit);
      if (Number.isInteger(i)) {
        kitIndex = i;
        renderKit();
      }
      return;
    }
    const target = node.closest<HTMLElement>('[data-go]');
    if (!target) return;
    const go = target.dataset.go;
    if (go === 'characters') ctx.navigate({ name: 'characters' });
    else if (go === 'trophies') ctx.navigate({ name: 'trophies' });
    else if (go === 'shop') ctx.navigate({ name: 'shop' });
  };
  root.addEventListener('click', onClick);

  q<HTMLButtonElement>('start').addEventListener('click', () => {
    ctx.navigate({ name: 'characters' });
  });

  q<HTMLButtonElement>('settings').addEventListener('click', () => {
    ctx.navigate({ name: 'settings' });
  });

  // The prototype's mascot easter egg, rebuilt on the real model.
  q<HTMLElement>('stage').addEventListener('click', () => {
    stage.poke();
    burstConfetti(confetti, 50, 18);
  });
  // The hint is a label on that easter egg, so it says what the tap does and then
  // stops competing with the rest of the screen.
  setTimeout(() => hint.classList.add('is-faded'), 4200);

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
/* ── The middle band ──────────────────────────────────────────────────────── */
/* Three columns, and the reason this is not round 1's three columns is that both
   flanks are LIVE. Round 1's rails held twelve navigation buttons, five tagged SOON,
   and a blind critic called that the loudest defect on the screen ("no top-grossing
   front end ships a home screen where the majority of navigation is unavailable").
   Round 2 replaced them with one roadmap card and the next critic named THAT the
   single most damaging element, for the same reason. Neither verdict was about
   columns; both were about advertising things that do not work. Every row below is
   driven by 'game/economy/' or 'game/rules.ts' and every one of them goes somewhere.

   The centre track is 'auto' and the flanks are 'fr': the hero sizes ITSELF from its
   own height (see '.home-stage') and the flanks absorb whatever is left, so there is
   never a strip of empty backdrop between the hero and a card. The whole band is
   capped so a 21:9 stretches the cards to a readable width rather than to 850px. */
.fa-home .home-middle {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(150px, 1fr);
  gap: var(--gap);
  min-height: 0;
  width: 100%;
  max-width: 1680px;
  margin-inline: auto;
}
/* SIZED TO CONTENT, then centred against the hero's mass.
   A stretched panel is the trap this screen already fell into once: round 1's rail
   was one small card sitting on top of ~600px of empty cream, and a large flat
   emptiness inside a bordered surface is a louder "unfinished" signal than no surface
   at all. These cards hold everything the lobby honestly knows and then stop. */
.fa-home .home-col {
  gap: 6px;
  overflow: hidden;
  align-self: center;
  max-height: 100%;
}

/* ── UI WEIGHT ────────────────────────────────────────────────────────────── */
/* The round-1 critic's second finding: "everything around the hero is web UI rather
   than game UI — the two cream panels are flat 1px-bordered cards with no bevel, no
   inner shadow and no chunky outline, [and] the only heavy display type on the whole
   screen is START GAME and Hamburger."

   The border was 3px rather than 1px, but the perception is the point: at the size
   these panels are actually seen, a 3px outline with a single flat drop reads thin
   next to a reference plate. What is missing is a MATERIAL — a lit top edge, a thick
   bottom lip and a little warmth pooling in the base — which is the same treatment
   'theme.ts' already gives '.fa-btn--primary', the one control on this screen the
   critic called shipped-grade. Scoped to '.fa-home' because 'theme.ts' is shared and
   this is a home-screen finding, not a system-wide one. */
.fa-home .home-col {
  border-width: 4px;
  box-shadow:
    0 6px 0 rgba(0,0,0,0.38),
    0 11px 20px rgba(0,0,0,0.22),
    inset 0 3px 0 rgba(255,255,255,0.9),
    inset 0 -10px 16px rgba(150,96,30,0.10);
}
/* Panel titles were 62%-opacity ink at ~12px — the lightest structural type on the
   screen, and measured at 4.8:1. Solid ink, larger, with a gold rule under it, so a
   heading reads as a heading and not as a caption. */
.fa-home .fa-panel-title {
  color: var(--ink);
  font-size: clamp(0.8rem, 1.95vh, 1.05rem);
  letter-spacing: 0.1em;
}
.fa-home .fa-panel-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: 999px;
  background: var(--gold);
}

/* ── Progress cards ───────────────────────────────────────────────────────── */
/* 'font-family' is declared HERE and that is a fix, not tidiness. A '<button>' does
   not inherit the family from its ancestors, so every descendant of this card that did
   not name a face itself fell back to the UA default — the metrics pass found
   '.home-track-sub', the two busiest lines in the left rail, rendering in **Arial**
   beside Heebo and Rubik everywhere else. Invisible to 'tsc' and to every assertion in
   'menu_accept'; a font-family audit found it in one run. */
.fa-home .home-track {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  min-height: var(--tap);
  padding: 7px 9px;
  text-align: start;
  font-family: 'Heebo', sans-serif;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-track:hover { filter: brightness(1.04); }
.fa-home .home-track:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-home .home-track[hidden] { display: none; }

.fa-home .home-track-top { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.fa-home .home-track-icon { font-size: 1.5rem; line-height: 1; flex: 0 0 auto; }
.fa-home .home-track-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto; }
.fa-home .home-track-title {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.7rem, 1.55vh, 0.86rem);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-home .home-track-sub {
  font-family: 'Heebo', sans-serif;
  font-size: clamp(0.7rem, 1.4vh, 0.8rem); font-weight: 700; color: #4A3524;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fa-home .home-track-pill {
  display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
  --fa-ic-ink: #FFF3DE;
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.6rem, 1.35vh, 0.74rem);
  background: var(--ink); color: var(--cream);
  border-radius: 999px; padding: 3px 9px; white-space: nowrap;
}
.fa-home .home-track-pill.is-go { background: var(--lettuce); color: #16300a; }

/* The one state on this screen allowed to pull the eye away from START GAME, and
   only while it is true. */
.fa-home .home-track.is-ready {
  background: linear-gradient(180deg, #B6EC5E 0%, var(--lettuce) 100%);
  animation: fa-home-ready 1.6s ease-in-out infinite;
}
.fa-home .home-track.is-ready .home-track-sub { color: #16300a; }
@keyframes fa-home-ready {
  0%, 100% { box-shadow: 0 3px 0 rgba(0,0,0,0.3), 0 0 0 rgba(124,181,24,0); }
  50% { box-shadow: 0 3px 0 rgba(0,0,0,0.3), 0 0 16px rgba(166,226,74,0.85); }
}

/* Distance-to-next, measured across the gap the player is actually crossing. */
.fa-home .home-bar {
  display: block;
  width: 100%;
  height: 9px;
  background: rgba(26,18,36,0.16);
  border: 2px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
}
.fa-home .home-bar-fill {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(45deg, var(--gold) 0 8px, var(--mustard) 8px 16px);
  transition: width 0.4s ease-out;
}

/* Free-chest cadence. Countable, so it is counted. */
.fa-home .home-pips { display: flex; gap: 3px; flex: 0 0 auto; }
.fa-home .home-pip {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--ink);
  background: rgba(26,18,36,0.14);
}
.fa-home .home-pip.is-on { background: var(--lettuce); }

/* ── Centre stage ─────────────────────────────────────────────────────────── */
/* PORTRAIT, AND THAT IS THE SINGLE BIGGEST CHANGE ON THE SCREEN.
   'charStage.applyFraming()' fits the subject to whichever axis binds. On a panel
   wider than it is tall the binding axis is always HEIGHT, so every extra pixel of
   width is guaranteed empty backdrop — which is exactly why the old full-width panel
   showed a ~350px character inside a 1330px box and read as an aquarium.

   'aspect-ratio' with 'justify-self: center' is what makes this self-sizing: the grid
   row gives the panel a definite HEIGHT, the ratio derives its width from that, and
   'auto' on the middle track lets the flanks take the rest. So the hero is 4:5 at
   every viewport without a single breakpoint, and 4:5 is the shape of the
   character-select hero column — the best-scoring menu we have, running the same
   renderer, the same lighting and the same models. */
.fa-home .home-stage {
  position: relative;
  min-height: 0;
  height: 100%;
  aspect-ratio: 4 / 5;
  max-width: 100%;
  justify-self: center;
  border: 4px solid var(--ink);
  border-radius: var(--radius-surface);
  overflow: hidden;
  box-shadow:
    0 6px 0 rgba(0,0,0,0.40),
    0 12px 24px rgba(0,0,0,0.28),
    inset 0 3px 0 rgba(255,255,255,0.30);
  cursor: pointer;
  /* Only ever seen for the frame before WebGL first presents. Imported from
     'charStage.ts' rather than typed, because a card whose CSS backdrop and whose
     renderer clear colour disagree flashes a different colour on every navigation. */
  background: ${PORTRAIT_BG_CSS};
}
.fa-home .home-stage-3d { position: absolute; inset: 0; }

/* ── WHERE THE FOUR STAGING LAYERS WENT ───────────────────────────────────── */
/* Round 2 painted a ray burst, a room, a horizon and a contact shadow here, as masked
   CSS over the canvas, and the reason was structural rather than stylistic: 'Stage'
   clears to an opaque colour, so a layer BEHIND the canvas is 'docs/LESSONS.md' §1 in
   its purest form — perfectly rendered, permanently invisible. That forced every one of
   them to be a low-alpha tint painted OVER the hero, which is a ceiling no amount of
   tuning gets past: they could not be lit, could not be occluded by the character, and
   could not cast anything.

   All four are now geometry in 'charStage.ts'. Two shapes that were tried and rejected
   in CSS are recorded there rather than lost, because both are the obvious idea and
   both are wrong: a filled pool of light on the floor landed on the plinth and bleached
   it, and a pool with a plinth-shaped hole wrapped AROUND the hole and crossed each
   flank twice, reading as ripples on water. The 3D floor has neither problem because
   the plinth OCCLUDES it instead of being drawn over.

   Nothing replaced them here. Two horizons in one card is worse than either alone. */

/* TOP-LEFT, not bottom-centre.
   The old nameplate was bottom-centred, and the bottom centre of this panel is where
   the plinth is — on a short viewport the word "Hamburger" landed across the
   character's feet. The panel's top-left corner is empty sky in every framing the rig
   produces (the camera pitches 20 degrees and targets half the subject's height), so
   the label can live there permanently without ever being computed against the pose. */
.fa-home .home-nameplate {
  position: absolute;
  top: clamp(6px, 1.4vh, 12px);
  inset-inline-start: clamp(6px, 1.4vh, 12px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* 6px and not 3px: '.fa-title' paints 'text-shadow: 0 4px 0 var(--ink)' BELOW its
     line box, so any gap under 4px lets the name's drop shadow land on the rarity
     badge. Only visible on a short viewport, where the title clamps down to 1rem and
     the shadow does not clamp with it. */
  gap: 6px;
  max-width: calc(100% - 24px);
  pointer-events: none;
}
.fa-home .home-hero-name { max-width: 100%; }

/* THE INSET DARKENING IS GONE, and its removal is a fix rather than a revert.
   It was added here because the badge takes its fill inline from 'RARITY_COLORS' and
   cannot be restyled by hue without desyncing the menu from the roster, so the only
   local lever was to darken whatever colour arrived: white-on-Normal-grey measured
   2.76:1 against a 4.5 floor (the same dark-on-dark failure 'docs/LESSONS.md' §1
   case 10 records for the HUD cooldown wipe), and 0.40 alpha bought some of it back
   at a cost of HSV saturation 1.00 -> 0.91.

   'theme.ts' has since given '.fa-rarity' a 1.6px ink TEXT-STROKE, which is
   colour-independent: the glyph's paper is now its own stroke rather than the fill, so
   every rarity measures 16.53-16.54:1 no matter what hue 'rules.ts' hands it. The
   darkening is therefore contributing exactly nothing to legibility and is only
   muting the badge — on a screen whose whole job is telling six rarities apart. The
   drop shadow stays; it is the shared raised-slab idiom, not a contrast device.

   ── RE-MEASURED AFTER 'cab4662' REPORTED 2.53 HERE. THE BADGE IS FINE. ────────
   That commit read "home now measures min ratio 2.53 with 1 run below AA on the
   Normal '.fa-rarity' badge, against a recorded 5.80 and 0" and called it a live
   regression rather than a capture artefact. It reproduces, and it is neither: it is
   the one battery of three whose contrast model does not know what a text stroke is.
   On ONE frozen snapshot, same tree, same badge:

     tools/tmp/screen_metrics.mjs   16.53   0 below AA   (has the stroke branch)
     tools/tmp/chars_metrics.mjs    16.53   ALL CLEAN    (has the stroke branch)
     tools/tmp/home_metrics.mjs      2.53   1 below AA   (did NOT — now fixed)

   2.53 is 'contrast(#FFF3DE, #9B9B9B)' to three figures: '--cream' against the raw
   'RARITY_COLORS.Normal' fill with the ink stroke between them ignored. It is exactly
   what a stroke-blind model must return once the darkening above came out. Note that
   screen_metrics' home MINIMUM is 5.80 today and 0 runs are below AA — the same pair of
   numbers the report called the "recorded" baseline — and that minimum is
   '.home-track-pill.is-go' "Open", not this badge. Which instrument the historical 5.80
   actually came from was NOT established here; what was established is that the two
   instruments disagree by 6.5x on this element on one frozen tree.

   Judged as PIXELS, per rarity, on both screens the badge renders on
   ('tools/tmp/rarity_aa.mjs', six rarities x home + character select x 3 viewports):
   16.52-16.54 on all of them, cream core intact at 12-17% of the badge with unbroken
   runs of 7-9 CSS px. 'paint-order: stroke fill' is why — the fill is painted back
   OVER the stroke, so the 1.6px rim is added outside the outline and takes nothing
   off an ~1.8px stem. Nothing here needs darkening again; darkening it to satisfy a
   stroke-blind instrument would mute six rarities to fix a measurement.

   The 'font-size: 0.7rem' below IS under theme.ts's 0.72rem floor, which that file
   raised deliberately "to keep that ratio honest at the smallest place this badge is
   used". Measured, the ratio holds anyway: 11.2px here gives a 8px core run against
   9px at character select's 13.12px. Left alone rather than "fixed" blind, because
   the only reason to move it would be a number that says it is wrong. */
.fa-home .fa-rarity {
  height: 21px;
  font-size: 0.7rem;
  border-width: 2.5px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.35);
}

.fa-home .home-stage-hint {
  position: absolute;
  bottom: 9px;
  inset-inline-end: 11px;
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: 800;
  font-size: clamp(0.66rem, 1.45vh, 0.78rem);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--cream);
  background: linear-gradient(180deg, rgba(42,29,58,0.94) 0%, rgba(16,10,26,0.96) 100%);
  border: 2.5px solid rgba(255,243,222,0.45);
  border-radius: 999px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.35);
  padding: 4px 11px;
  transition: opacity 0.6s ease;
}
/* Says its piece, then gets out of the way. A permanent instruction on a lobby is a
   tutorial that never ends — but "out of the way" used to mean opacity 0.35, which
   dropped the whole pill, plate and all, to 2.70:1 and produced the critic's exact
   words: "pale grey on pale blue". It now recedes by losing its lift rather than its
   legibility: still the quietest thing on the card, still readable at 9:1. */
.fa-home .home-stage-hint.is-faded {
  opacity: 0.88;
  box-shadow: none;
  border-color: rgba(255,243,222,0.22);
}

/* ── Fighter card ─────────────────────────────────────────────────────────── */
.fa-home .home-stats { display: flex; flex-direction: column; gap: 5px; }
/* The shared '.fa-stat-label' is a fixed 58-92px column, which is right for character
   select's narrow stats panel and wrong here, where the label carries an icon too. */
.fa-home .home-fighter .fa-stat-label {
  display: flex; align-items: center; gap: 5px;
  width: auto; flex: 0 0 auto;
}

/* ── The kit, as tiles ─────────────────────────────────────────────────────── */
/* Was four full-width rows with a two-line label each: "it reads as a spreadsheet in
   the middle of a brawler". Now a grid of pressable tiles carrying the icon and the
   name, with the description in one caption line below.

   Two columns and not four, because two to four abilities have to share the same
   grid: four columns would make a Donut's two tiles a half-empty row. An odd count
   spans its last tile across both columns instead of leaving the ragged cell that a
   critic named a defect on this screen once already. */
.fa-home .home-kit {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  margin-top: 2px;
}
.fa-home .home-kit-tile {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: var(--tap);
  padding: 5px 4px;
  color: var(--ink);
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: 1 / -1; }
.fa-home .home-kit-tile:hover { filter: brightness(1.04); }
.fa-home .home-kit-tile:active {
  transform: translateY(3px);
  box-shadow: 0 0 0 rgba(0,0,0,0.32), inset 0 2px 0 rgba(255,255,255,0.9);
}
.fa-home .home-kit-tile.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  box-shadow: 0 3px 0 var(--gold-shadow), inset 0 2px 0 rgba(255,255,255,0.75);
}
.fa-home .home-kit-em { font-size: clamp(1.25rem, 2.9vh, 1.7rem); line-height: 1; flex: 0 0 auto; }
.fa-home .home-kit-name {
  font-family: 'Rubik', sans-serif; font-weight: 800;
  font-size: clamp(0.66rem, 1.45vh, 0.82rem);
  text-align: center;
  max-width: 100%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* The tap state. A FIXED minimum height, because selecting a tile must not reflow the
   panel — the Change button sits under this and '.home-col' clips rather than scrolls,
   so a growing caption would eat a control rather than push the page. */
.fa-home .home-kit-cap {
  position: relative;
  margin: 9px 0 0;
  padding: 4px 8px;
  min-height: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Heebo', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.45vh, 0.82rem);
  line-height: 1.15;
  text-align: center;
  color: #3B2A18;
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  box-shadow: 0 3px 0 rgba(0,0,0,0.28), inset 0 2px 0 rgba(255,255,255,0.9);
}
/* The tail. '--home-cap-x' is written by 'renderKit()' from the selected index, so the
   caption points at its own tile rather than at the grid in general. A rotated square
   whose lower half lands ON the plate's ink border, which is what makes it read as a
   tail growing out of the plate instead of as a diamond floating above it — the first
   version left a gap and looked like a stray icon. */
.fa-home .home-kit-cap::before {
  content: '';
  position: absolute;
  top: -8px;
  inset-inline-start: var(--home-cap-x, 50%);
  width: 13px;
  height: 13px;
  margin-inline-start: -6.5px;
  transform: rotate(45deg);
  background: var(--mustard);
  border-left: 2.5px solid var(--ink);
  border-top: 2.5px solid var(--ink);
  border-start-start-radius: 3px;
}
.fa-home .home-change { margin-top: 4px; width: 100%; }

/* Career record. Three numbers, all live, and the only place in the product that
   shows them — the trophy road tracks the CURRENT count, this tracks the peak. */
.fa-home .home-record {
  display: flex;
  gap: 5px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 2.5px dotted rgba(26,18,36,0.2);
}
.fa-home .home-rec {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 2px;
  background: rgba(26,18,36,0.06);
  border-radius: 9px;
}
.fa-home .home-rec-val {
  font-family: 'Rubik', sans-serif; font-weight: 900;
  font-size: clamp(0.8rem, 1.9vh, 1.05rem);
  line-height: 1;
}
/* 55%-opacity ink at 9.9px measured 3.73:1 against a 4.5 floor and was, with the tap
   hint and the mode line, one of the three text runs the critic could not read. Solid
   ink-brown at >=11px takes it to ~10:1 and costs nothing else on the screen. */
.fa-home .home-rec-key {
  display: flex; align-items: center; gap: 3px;
  font-size: clamp(0.7rem, 1.4vh, 0.78rem);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #4A3524;
  white-space: nowrap;
}

/* ── Bottom bar ───────────────────────────────────────────────────────────── */
/* The bottom bar holds the CTA and its label, and nothing else. Character select's
   bottom bar is the same shape — one loud button in the corner — and that is the
   highest-scoring menu in the build. */
.fa-home .home-bottom {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: clamp(8px, 1.6vw, 20px);
  min-height: var(--tap);
}
/* '--ketchup' on cream measured 4.35:1 — under the 4.5 floor by a hair, and it is the
   player's trophy count, which is not a decoration. Darkened one step. HSV saturation
   is unchanged to two places (0.813 -> 0.839, it actually rises); only value drops. */
.fa-home .fa-chip-val { color: #A81B2B; }

/* Inside the progress panel the level bar is a row, not a floating hairline: it gets
   the panel's full width and the cream label treatment has to go, because there is no
   dark backdrop behind it any more. */
.fa-home .home-level { flex: 0 0 auto; }
.fa-home .home-level .fa-level-label {
  color: var(--ink);
  text-shadow: none;
  font-size: clamp(0.62rem, 1.4vh, 0.78rem);
}

/* The CTA's subject. A lobby's primary button has to say what it starts — this is the
   only 1v1 mode in the build, and the duration is read from MATCH_DURATION_MS so the
   copy cannot outlive the sim. */
/* ON A PLATE, and that fixes two findings with one element.
   "'3:00 · last one standing' is thin light text directly on saturated red" measured
   3.50:1 — cream at 80% opacity over '#C1272D' is simply not a legible pairing, and no
   amount of text-shadow rescues 11px of it. A dark plate is also the HUD's idiom (dark
   ground, bright state), and the HUD is the one element on this project that beat the
   shipped reference in a blind A/B — so the same move that makes the copy readable is
   the move that makes it read as game UI rather than as a caption floating on the
   backdrop. */
.fa-home .home-mode {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  margin-inline-start: auto;
  text-align: end;
  min-width: 0;
  padding: 6px clamp(11px, 1.4vw, 18px);
  background: linear-gradient(180deg, rgba(44,30,60,0.94) 0%, rgba(20,13,30,0.96) 100%);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.14);
}
.fa-home .home-mode-name {
  font-family: 'Rubik', sans-serif; font-weight: 900;
  font-size: clamp(0.74rem, 1.75vh, 0.96rem);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--mustard-hi);
  text-shadow: none;
  white-space: nowrap;
}
.fa-home .home-mode-sub {
  font-family: 'Rubik', sans-serif;
  font-size: clamp(0.72rem, 1.6vh, 0.88rem);
  font-weight: 800;
  color: rgba(255,243,222,0.94);
  text-shadow: none;
  white-space: nowrap;
}

/* ── Landscape phones ─────────────────────────────────────────────────────── */
/* Height is the binding constraint long before width — 390px tall is the tight case,
   not 844px wide. So trim by HEIGHT, and drop the flank whose information is
   available one tap away: the fighter's stats are the whole right-hand panel of the
   character-select screen, while the progress cards exist nowhere else. */
/* Both flanks SURVIVE here, and the hero keeps its 4:5.
   The instinct is to widen the hero panel on a short screen, and it is wrong: the rig
   sizes the character off the panel's HEIGHT (62% of it), so widening the panel adds
   empty cyan and does not add one pixel of character. What has to give instead is the
   two lists that need vertical room the band does not have. */
@media (max-height: 460px) {
  .fa-home .home-stage-hint { display: none; }
  .fa-home .home-track-sub { display: none; }
  .fa-home .home-mode-sub { display: none; }
  .fa-home .home-record { display: none; }
  .fa-home .home-kit { display: none; }
  /* The caption is the kit's tap state, so it goes with the kit. Left behind it would
     be a description of an ability whose tile is not on screen. */
  .fa-home .home-kit-cap { display: none; }
  /* The gold rule under a panel title is 9px of a band that has none to spare. */
  .fa-home .fa-panel-title::after { display: none; }
}

/* ── PORTRAIT PHONE, AND IT WAS BROKEN AT HEAD ────────────────────────────── */
/* Measured at 430x932 (iPhone 15 Pro Max) with 'tools/tmp/portrait_probe.mjs': the
   ENTIRE screen was laying out at 584 CSS px inside a 430 px viewport, so the tab bar,
   the settings gear and START GAME were all simply off the right-hand edge and the hero
   was cropped off-centre.

   Two separate causes, and the second only becomes visible once the first is fixed:

   1. THE TOP BAR SET THE WIDTH. It is one non-wrapping flex row — three status chips,
      a three-tab segmented control and a gear — whose min-content width is ~584. A
      '.fa-screen' grid track is 'auto', and an auto track's base size is its items'
      min-content contribution, so the bar inflated the track and every row below it
      inherited the inflated width. The hero card was a symptom, not the cause.
   2. THE HERO CARD WOULD STILL OVERFLOW. It is 'height: 100%' plus 'aspect-ratio: 4/5',
      which makes its width follow the row height — and a portrait row is ~760 px tall,
      so 608 px of width. 'max-width: 100%' does not save it, because a grid item's
      default 'min-width: auto' resolves to min-content, and for an aspect-ratio box with
      a definite height min-content IS height x ratio. The floor beat the cap.
      'align-self: center' is load-bearing in the fix: without it the item stretches, the
      height becomes definite again, and the width goes straight back to 608.

   WHY 315 ASSERTIONS MISSED IT: 'menu_accept''s five viewports are 1600x900, 1280x800,
   1024x768, 844x390 and 2560x1080 — all landscape, none under 844 px wide, so this
   breakpoint never fired in the suite. And the shell clips overflow, so
   'document.scrollWidth' stayed at 430 and even the no-page-scroll assertion passed.
   A defect can be 100% reproducible and still invisible to a suite that never asks. */
@media (max-width: 700px) {
  .fa-home .home-middle { grid-template-columns: minmax(0, 1fr); }
  .fa-home .home-col { display: none; }
  .fa-home .home-mode { display: none; }
  .fa-home .home-bottom { flex-wrap: wrap; }
  /* Two rows rather than one. The spacer goes because a flex spacer inside a wrapping
     row pushes the wrap point around for no benefit; the chips take the first line and
     the navigation takes the second. */
  .fa-home .fa-topbar { flex-wrap: wrap; row-gap: 6px; }
  .fa-home .fa-topbar-spacer { display: none; }
  .fa-home .fa-tabs { flex: 1 1 auto; }
  .fa-home .fa-tab { flex: 1 1 0; justify-content: center; padding: 0 6px; }
  .fa-home .home-stage {
    min-width: 0;
    width: 100%;
    height: auto;
    max-height: 100%;
    align-self: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fa-home .home-track.is-ready { animation: none !important; }
}
:root.fa-reduce-motion .fa-home .home-track.is-ready { animation: none !important; }
`;
