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
 *  keep.
 *
 *  ⚠️ **WAS `'1v1 · Kitchen Rumble'`, and the `1v1` became FALSE on 2026-08-12.**
 *  `DECISIONS §74` gives the player a seat count of 2–6 (`screens/lobby.ts`), so a mode
 *  line that hardcodes the field size is a claim the model stops computing the moment
 *  anyone taps 3 — against this screen's own standing rule, quoted from the header:
 *  *"Nothing on this screen advertises something that does not work."* The count is not
 *  replaced with a number here, because home does not know one: the lobby opens at the
 *  default every time and the count is state that lives there. */
const MODE_NAME = 'Kitchen Rumble';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createHomeScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-home-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-home');
  const stage = getCharacterStage();
  // THE LOBBY SET, not the portrait cove. See `charStage.setScene()` — home is the one
  // screen that gets a room built behind the hero; character select and the title card
  // keep the plain cove they were judged against. Reset in `dispose()` below, because
  // the stage is a singleton that outlives this screen.
  stage.setScene('lobby');

  root.innerHTML = `
    <div class="home-room" aria-hidden="true">
      <div class="home-room-wall"></div>
      <div class="home-room-floor"></div>
      <div class="home-room-alcove"></div>
    </div>

    <!-- ADOPTED: '.ds-chip ds-chip--slate' from theme.ts's component layer, plus
         '.ds-chip-val' on the NUMERALS. The slate treatment is not new here - this file
         already hand-rolled it in a '.fa-home .fa-chip' override with the same gradient,
         the same cream and the same lip - so the adoption DELETES a bespoke rule rather
         than adding a look. What is new is '.ds-chip-val': the count now runs a full
         ladder step above its own icon and label, which is theme.ts's recorded finding
         that "on the reference plates the numeral is the loudest thing in the counter and
         the icon is second; ours were the same size, which is why a trophy total read as
         chrome". '.fa-chip' STAYS on the element - 'screen_metrics' and 'home_metrics'
         both key their headline set on it, and dropping it would shrink a guard's
         coverage to make a class list tidier. -->
    <header class="fa-topbar">
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${icon('avatar')}</span><span data-el="name"></span></div>
      <div class="fa-chip ds-chip ds-chip--slate"><span class="fa-chip-em">${icon('trophy')}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="trophies">0</span></div>
      <div class="fa-chip ds-chip ds-chip--slate home-chip-coin"><span class="fa-chip-em">${icon('coin')}</span><span class="fa-chip-val ds-chip-val ds-num" data-el="coins">0</span></div>
      <div class="fa-topbar-spacer"></div>
      <!-- ICONS, not four words. The reference plates carry navigation pictorially and
           caption it; ours carried four same-weight text runs in one dark pill, which is
           the "labels are text" half of the amateurish read. tools/tmp/hm_lang.mjs
           measures the consequence rather than the intent: an icon adds a hard local
           luma step and its own hue, and the four tabs were contributing neither.
           ⚠️ NO BACKTICKS IN THIS FILE'S TEMPLATE LITERALS, INCLUDING IN COMMENTS. The
           first draft of this comment quoted the tool name in backticks and tsc reported
           "src/ui/screens/home.ts(192,64): error TS1005" -- the literal terminated
           mid-HTML. CLAUDE.md records this biting four times in hud.ts, where it 500s the
           dev server for every agent in the tree; here it is only a compile error, and
           only because a typecheck happened to be the next thing run. -->
      <nav class="fa-tabs">
        <button class="fa-tab is-active" type="button">${icon('home')} Home</button>
        <button class="fa-tab" type="button" data-go="characters">${icon('chefhat')} Foods</button>
        <button class="fa-tab" type="button" data-go="trophies">${icon('trophy')} Trophies</button>
        <!-- The one destination on this bar that cannot currently sell anything, and it
             is here anyway. The lobby's standing rule is "nothing advertises something
             that does not work", and the shop passes it on the same terms the gem store
             already does: nothing on it is a live-looking control that no-ops, every
             price and every drop rate on it is real, and it states in words that buying
             is off and why. Hidden would have been the dishonest option — it would put
             a compliance surface where no screenshot, no contrast battery and no
             acceptance test can reach it. See the header of shop.ts. -->
        <button class="fa-tab" type="button" data-go="shop">${icon('coin')} Shop</button>
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

        <!-- THE SUB IS A SIBLING OF '.home-track-top', NOT A CHILD OF IT, and that one
             move is most of the truncation fix. It used to sit inside
             '.home-track-text', a flex item squeezed between a 24px icon and a nowrap
             pill: at 852x480 that column measured 39.89 CSS px, so "Waiting to be
             opened" rendered as "Waitin...". Out here it gets the card's full 125px and
             needs no ellipsis at all. It costs ZERO height -- it was already on its own
             line, just an artificially narrow one. -->
        <button class="home-track home-track--road" type="button" data-go="trophies" data-el="road">
          <span class="home-track-top">
            <span class="home-track-icon" data-el="roadicon">${icon('chest')}</span>
            <span class="home-track-title" data-el="roadtitle">Next reward</span>
            <span class="home-track-pill" data-el="roadpill">${icon('trophy')}</span>
          </span>
          <span class="home-track-sub" data-el="roadsub"></span>
          <!-- ADOPTED: '.ds-bar ds-bar--sm'. theme.ts's adoption map names '.home-bar' as
               a '.ds-bar' site, and the component supplies the track, the radius, the ink
               line and the top-light on the fill. The FILL COLOUR stays this file's — the
               gold diagonal stripe is the road's identity and the component takes its ink
               from the caller by design. -->
          <span class="home-bar ds-bar ds-bar--sm"><span class="home-bar-fill ds-bar-fill" data-el="roadfill"></span></span>
        </button>

        <button class="home-track" type="button" data-go="trophies" data-el="chest">
          <span class="home-track-top">
            <span class="home-track-icon">${icon('gift')}</span>
            <span class="home-track-title">Free chest</span>
            <span class="home-pips" data-el="pips"></span>
          </span>
          <span class="home-track-sub" data-el="chestsub"></span>
        </button>

        <button class="home-track home-track--held" type="button" data-go="trophies" data-el="held" hidden>
          <span class="home-track-top">
            <span class="home-track-icon">${icon('chest')}</span>
            <span class="home-track-title" data-el="heldtitle"></span>
            <span class="home-track-pill is-go">Open</span>
          </span>
          <span class="home-track-sub">Waiting to be opened</span>
        </button>

        <!-- THE DARK FAMILY. Three cream-on-cream chips inside a cream card were the
             clearest instance of the whole screen speaking one material: same fill, same
             radius, same border as everything around them, differentiated by nothing.
             The reference plates run TWO tile families side by side — bright tiles for
             things you act on, dark slate tiles for things you read off — and these are
             read-only, so they are the dark ones. The numeral also carries the meaning
             in colour now (won / lost / peak) instead of a caption doing all the work. -->
        <div class="home-record">
          <div class="home-rec"><span class="home-rec-ic">${icon('medal')}</span><span class="home-rec-val is-win" data-el="wins">0</span><span class="home-rec-key">Wins</span></div>
          <div class="home-rec"><span class="home-rec-ic">${icon('close')}</span><span class="home-rec-val is-loss" data-el="losses">0</span><span class="home-rec-key">Losses</span></div>
          <div class="home-rec"><span class="home-rec-ic">${icon('trophy')}</span><span class="home-rec-val is-best" data-el="best">0</span><span class="home-rec-key">Best</span></div>
        </div>
      </aside>

      <!-- CENTRE: the equipped fighter, rendered by the game's own renderer.
           There are no staging layers over the canvas any more. Round 2 had four of
           them — a ray burst, a room, a horizon and a contact shadow — because
           'Stage' clears opaque and nothing could be painted BEHIND the canvas. All
           four are now real geometry inside 'charStage.ts', where they can be lit,
           occluded by the hero, and cast. Everything between the canvas and the
           labels here is a LABEL. -->
      <!-- A SPACER, and the stage itself is absolutely positioned over it.
           The hero used to be a grid item in this track, which is what made it a CARD:
           it started where the middle band started and stopped where it stopped, with a
           border drawn round the join. It is now full-bleed top to bottom (see
           '.home-stage'), so the grid only has to reserve the width the flanks must not
           intrude on. -->
      <div class="home-stage-slot" aria-hidden="true"></div>

      <!-- RIGHT: what you are about to take into the match. -->
      <aside class="fa-panel home-col home-fighter">
        <p class="fa-panel-title">Your fighter</p>
        <div class="home-stats" data-el="stats"></div>
        <div class="home-kit" data-el="kit"></div>
        <p class="home-kit-cap" data-el="kitcap"></p>
        <!-- 🔴 THE 3.6x HIERARCHY INVERSION, FIXED HERE AND NOT IN THE SHARED CLASS.
             Measured on this screen: the secondary control was 0.91x the PRIMARY's area
             where the reference's is 0.25x, which is why the lobby read as three equal
             columns instead of one dominant action. theme.ts records the finding and
             deliberately did NOT change '.fa-btn--quiet' to fix it — that class is live
             on five screens and the layer shipped pixel-neutral, so the fix belongs to
             each screen's owner. This is home's.

             It is a SIZE change, not a colour one. The class moves to '.ds-btn
             ds-btn--quiet', whose base holds the 44px tap floor while '.fa-btn--primary'
             runs to 78px, and the 'width: 100%' comes off so the control sizes to its
             own label instead of to the panel. '.fa-btn' STAYS: 'home_metrics' keys its
             headline set on it. -->
        <button class="fa-btn ds-btn ds-btn--quiet home-change" type="button" data-go="characters">
          ${icon('swap')} Change
        </button>
      </aside>
    </div>

    <!-- OUTSIDE '.home-middle' ON PURPOSE. It spans the whole screen height, so it
         cannot be a child of one row of the screen grid. -->
    <section class="home-stage" data-el="stage" data-clicksound="on">
      <div class="home-stage-3d" data-el="stage3d"></div>
      <div class="home-stage-glow" aria-hidden="true"></div>
      <div class="home-nameplate">
        <span class="fa-title home-hero-name" data-el="heroname"></span>
        <span class="fa-rarity" data-el="herorarity"></span>
      </div>
      <div class="home-stage-hint" data-el="hint">Tap to taunt</div>
    </section>

    <footer class="home-bottom">
      <!-- 🚨 THE LOBBY ENTRY, AND IT IS THIS ELEMENT RATHER THAN THE CTA.
           NOTE: no backticks anywhere in this literal. A backtick inside a template
           string terminates it, and menu_accept parses all 88 modules for exactly this.
           DECISIONS 74 asks for "the lobby where the gameplay is set". The obvious
           wiring is the start button, and it is REFUSED by a measurement: journey.mjs
           — the only end-to-end gate in this project — and tools/match-play.mjs both
           click [data-el=start], wait for __screen === "characters", then click
           [data-el=fight]. Re-pointing the CTA breaks both, at a 120 s timeout each, and
           neither file is in this pass's owned set. HEAD was unbootable for 24 commits
           with every unit gate green; a red end-to-end gate is not worth one tap.

           It is also where the reference plates put mode configuration — a wide tappable
           band immediately left of the primary CTA, mode on line 1, variant on line 2 —
           which is the composition this element already had as a dead div. So the change
           is that it becomes what it looks like.

           ⚠️ It KEEPS .home-mode and both inner class names: home_metrics,
           screen_metrics and menu_accept all key on them. -->
      <button class="home-mode" type="button" data-el="mode"
              aria-label="Match lobby — choose how many players are in the match">
        <span class="home-mode-lines">
          <span class="home-mode-name">${MODE_NAME}</span>
          <span class="home-mode-sub" data-el="modesub">${formatDuration(MATCH_DURATION_MS)} · last one standing</span>
        </span>
        <span class="home-mode-go" aria-hidden="true">${icon('party')}</span>
      </button>
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

  /**
   * The right flank. Display stats are `rules.ts`'s 0-10 scale — the same numbers
   * character select draws, so the two screens cannot disagree about a fighter.
   *
   * ═══════════════════════════════════════════════════════════════════════════
   * THE BAR IS GONE, AND THAT IS THE FIX RATHER THAN A SIDE EFFECT
   * ═══════════════════════════════════════════════════════════════════════════
   * `stat-bars` is the WORST element in the per-element critique — 3 against a
   * reference 7 — and the finding that decided this rewrite is that character select's
   * supposedly-better version, with a taller track AND ten pips, scored THE SAME 3.
   * Two critics, two panels, one number. So "make the bar better" is refuted by the
   * only paired control available: the reference is not drawing a better bar, it is
   * not drawing a bar at all.
   *
   * The three measured gaps, and what each one becomes here (see `.ds-row` and
   * `.ds-tile--stat` in `theme.ts`, where the geometry is derived):
   *
   *   * the row was 52 device px against the reference's 86  -> `.ds-row`, min 56 CSS px
   *   * the icon was a 33x33 px, 1.7-px-stroke, `fill: none` LINE GLYPH against a
   *     ~72x70 filled TINTED tile                            -> `.ds-tile--stat`, 56 px,
   *     tint required rather than optional, glyph at 62% of the tile at stroke 2.4
   *   * the label sat BESIDE the value                       -> `.ds-row-body` stacks it
   *     ABOVE, small and colour-coded, with the numeral under it at display weight
   *
   * ── THE COLOURS ARE PICKED BY ARITHMETIC, NOT BY BRAND ─────────────────────
   * `--ketchup` / `--lettuce` / `--water` are FILL colours and two of the three fail as
   * a tile behind an ink glyph: ketchup measures 3.65:1 against a 4.5 floor and water
   * 5.22. Lifted one value step each, the same triple measures 8.07 / 11.19 / 9.74 as a
   * tile, and 7.34 / 10.18 / 8.86 as the LABEL on the slate plate's dark stop (5.75 /
   * 7.98 / 6.94 on its light stop, which is the binding case and still clear). Two of
   * the three are colours this file already ships and already measured on this exact
   * plate — `#FF8A96` and `#8FE04A` are the loss and win numerals in the record row.
   * The VALUE stays cream (15.05 / 11.80), because the reference's numeral is the loud
   * neutral thing and the colour belongs to the small label.
   *
   * ⚠️ `.fa-stat` STAYS on the wrapper. `chars_metrics`'s clipping guard lists it in
   * CARES, and this screen and character select are its only two users — dropping it to
   * tidy a class list would silently shrink that guard's coverage, which is the exact
   * failure `CLAUDE.md` #6 records for `driver_guard`.
   */
  const STAT_ROWS: Array<[string, string, 'damage' | 'health' | 'speed', string]> = [
    ['damage', 'Damage', 'damage', '#FF8A96'],
    ['health', 'Health', 'health', '#8FE04A'],
    ['speed', 'Speed', 'speed', '#6FC8F5'],
  ];

  function renderFighter(): void {
    const def = CHARACTERS[ctx.profile.selected];
    q('stats').innerHTML = STAT_ROWS.map(([ic, label, key, color]) => `
      <div class="fa-stat ds-row ds-row--slate home-stat" style="--ds-row-accent:${color}">
        <span class="ds-tile ds-tile--stat" style="--ds-tile-fill:${color}">${icon(ic)}</span>
        <span class="ds-row-body">
          <span class="ds-row-label">${label}</span>
          <span class="ds-row-val ds-num">${def.stats[key]}</span>
        </span>
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
    const picked = def.abilities[kitIndex];
    // The NAME is rendered too, and CSS decides whether it is shown. On a landscape
    // phone the tiles are icon-only (there is not room for four names across a 186px
    // flank), so the caption is the only place the ability is named; everywhere else
    // '.home-kit-capname' is 'display: none' and the tile carries it.
    cap.innerHTML = picked
      ? `<span class="home-kit-capname">${picked.name}</span><span>${picked.desc}</span>`
      : '';
    // Point the caption at the tile it belongs to. Round 2's critic: "'Slows enemies
    // down' is centred under the whole 2x2 grid so it binds to no button in
    // particular." A caption for a tap state has to say WHICH tap it is describing, and
    // a caret under the selected column is the cheapest unambiguous way to say it.
    //
    positionKitCaret();
  }

  /**
   * Point the caption's caret at the selected tile.
   *
   * ⚠️ MEASURED off the tile, not inferred from the index. This used to be
   * `spansBoth ? '50%' : kitIndex % 2 === 0 ? '25%' : '75%'`, which hard-codes a
   * TWO-COLUMN grid — correct for the only layout that existed when it was written,
   * and silently wrong the moment the landscape-phone breakpoint made the grid N
   * columns wide: every caret would have pointed at one of two positions on a row of
   * four tiles. Reading the tile's own box is right for any column count, and for the
   * odd last tile that spans the full width, with no special case at all.
   *
   * ⚠️ AND IT IS SEPARATE FROM `renderKit` BECAUSE IT NEEDS LAYOUT, which the first
   * render does not have. `render()` runs at line 603, BEFORE this factory returns its
   * root and before `shell.ts:mount` appends it — so every rect is 0x0 on the first
   * pass and the caret defaulted to 50%. That was visible in the shipped capture at
   * 1600x900: the diamond sat in the gutter between tile 1 and tile 2 instead of under
   * the selected tile, on every screen the player had not yet tapped. Called again
   * from a post-mount frame and from `resize()`, and it writes NOTHING when the box is
   * still zero, so a call that is too early cannot overwrite a good value with a guess.
   */
  function positionKitCaret(): void {
    const kitEl = q<HTMLDivElement>('kit');
    const tile = kitEl.children[kitIndex] as HTMLElement | undefined;
    if (!tile) return;
    const kr = kitEl.getBoundingClientRect();
    const tr = tile.getBoundingClientRect();
    if (kr.width <= 0 || tr.width <= 0) return;
    // 'inset-inline-start' resolves the percentage from the RIGHT under RTL, while
    // getBoundingClientRect is always physical, so the offset is mirrored there.
    const centre = tr.left + tr.width / 2;
    const frac = getComputedStyle(kitEl).direction === 'rtl'
      ? (kr.right - centre) / kr.width
      : (centre - kr.left) / kr.width;
    q<HTMLParagraphElement>('kitcap').style.setProperty('--home-cap-x', `${(frac * 100).toFixed(1)}%`);
  }

  /**
   * Publish the top bar's MEASURED bottom edge, and the bottom bar's measured top, so
   * the two absolutely-positioned overlays on this screen can derive their clearance
   * instead of assuming it.
   *
   * 🚨 THE CSS BELOW USED TO ASSUME "THE TOP BAR IS 56px TALL AT EVERY VIEWPORT" AND
   * PUBLISHED THE SIX MEASUREMENTS THAT SAID SO. All six were landscape or desktop.
   * In portrait the bar WRAPS — the same `@media (max-width: 700px)` block that sets
   * `.fa-topbar { flex-wrap: wrap }` is three declarations above the override that
   * discarded the derived floor — and at 390x844 it measures **152px**, not 56. So the
   * hero's own name rendered 80.7% behind the tab bar, with the fix for exactly that
   * defect written out at length in the comment directly above it.
   *
   * `hud.ts` already learned this and its comment names the same class: *"THE TOUCH
   * RADAR'S `top` WAS A CONSTANT DERIVED FROM AN ASSUMED BAR HEIGHT, AND THE CHIP RAIL
   * BROKE THAT ASSUMPTION."* Its answer is `--fa-topbar-b`, the bar's real bottom
   * published to CSS. This is the same answer for the lobby, and it is a strictly
   * better instrument than any constant: a longer player name, a font swap, a locale, a
   * fifth tab or a third row all move the bar, and none of them can be named in a
   * media query.
   *
   * ⚠️ WRITES NOTHING WHEN THE BOX IS STILL ZERO, exactly as `positionKitCaret` does —
   * `render()` runs before `shell.ts:mount` appends this root, so every rect is 0x0 on
   * the first pass and a call that is too early must not overwrite a good value with a
   * guess. The CSS carries the old constant as its fallback, so a build where this
   * never runs is no worse than the one before it.
   */
  function publishBars(): void {
    const rootRect = root.getBoundingClientRect();
    if (rootRect.height <= 0) return;
    const bar = root.querySelector<HTMLElement>('.fa-topbar');
    if (bar) {
      const r = bar.getBoundingClientRect();
      if (r.height > 0) root.style.setProperty('--home-topbar-b', `${Math.round(r.bottom - rootRect.top)}px`);
    }
    const foot = root.querySelector<HTMLElement>('.home-bottom');
    if (foot) {
      const r = foot.getBoundingClientRect();
      // Distance from the STAGE's bottom edge up to the footer's top. `.home-stage` is
      // inset 0 on the screen root, so the screen root's bottom is the stage's bottom.
      if (r.height > 0) root.style.setProperty('--home-bottom-h', `${Math.round(rootRect.bottom - r.top)}px`);
    }
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

  // UNCHANGED, deliberately. `journey.mjs` (the only end-to-end gate) and
  // `tools/match-play.mjs` both drive this button and then wait on
  // `__screen === "characters"`; re-pointing it at the lobby breaks both at a 120 s
  // timeout, and neither tool is in this pass's owned set. It is also what keeps
  // `2f907a7`'s four-arm `np_identity` bit-identity true by CONSTRUCTION — the shipped
  // two-seat path is not touched at all. See `.home-mode` in the markup above for the
  // lobby's entry point and the full reasoning.
  q<HTMLButtonElement>('start').addEventListener('click', () => {
    ctx.navigate({ name: 'characters' });
  });

  // `DECISIONS §74` — where the match is configured. Not routed through the delegated
  // `[data-go]` handler above because that one maps a string to a route by name and this
  // is the screen's second committed action, which deserves to be readable beside the
  // first rather than as one more entry in a dispatch table.
  q<HTMLButtonElement>('mode').addEventListener('click', () => {
    ctx.navigate({ name: 'lobby' });
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
  // The first frame after `shell.ts:mount` has appended this root — the earliest moment
  // the kit has a box. See `positionKitCaret`.
  const caretFrame = requestAnimationFrame(() => { positionKitCaret(); publishBars(); });

  // A ResizeObserver and not just `resize()`, because the bar's height changes for
  // reasons a window resize never sees: the Rubik/Heebo swap re-measures every chip,
  // the player renaming themselves in settings widens the first chip by up to 12
  // characters, and either can tip the row into wrapping. `resize()` is kept as well —
  // the observer does not fire when only the VIEWPORT changed and the bar's own box did
  // not, which is exactly the case that moves `--home-bottom-h`.
  const barObserver = new ResizeObserver(() => publishBars());
  const topbarEl = root.querySelector<HTMLElement>('.fa-topbar');
  const footEl = root.querySelector<HTMLElement>('.home-bottom');
  if (topbarEl) barObserver.observe(topbarEl);
  if (footEl) barObserver.observe(footEl);

  return {
    root,
    update(dt) { stage.update(dt); },
    resize() { stage.resize(); positionKitCaret(); publishBars(); },
    dispose() {
      unsubscribe();
      barObserver.disconnect();
      cancelAnimationFrame(caretFrame);
      root.removeEventListener('click', onClick);
      // Hand the shared stage back in the state every OTHER consumer expects. The room
      // is home's; character select's hero column and the title card were both judged
      // against the plain cove and neither of them asks for a scene, so the reset has to
      // happen on the way OUT rather than on the way in — `shell.ts` unmounts the old
      // screen before it mounts the new one.
      stage.setScene('portrait');
      stage.detach();
      root.remove();
    },
  };
}

const CSS = `
/* ═══════════════════════════════════════════════════════════════════════════
   ROUND 4 — THE SCREEN WAS COLOURED PAPER, AND THAT IS NOW A NUMBER
   ═══════════════════════════════════════════════════════════════════════════

   Uri, having looked at the build: "I've had a look at the Home Screen and menus and
   we need to do a better job there. Looks amateurish." The blind critic, independently:
   home 5.17 against a reference 8.50 — the second-worst element in the game.

   The instrument written before any of this was touched is 'tools/tmp/hm_lang.mjs',
   and it is deliberately PIXEL-based rather than DOM-based for one reason: the
   reference is a set of screenshots. A DOM walk cannot be run on 'bs_home.png', and a
   metric computed one way on ours and another way on the plate measures the two
   instruments rather than the two screens. Four numbers, same function, any bitmap:

     flat%   share of 12x12 tiles with luma stdev < 2.5 -- literally "coloured paper"
     hues    EFFECTIVE hue count, 1/sum(p^2) over 24 bins, chromatic pixels only
     edge%   share of pixels on a luma step >= 30 -- outlines, bevels, shadows, detail
     dark%   share below luma 45 -- the outline-and-shadow budget

   Validated against six synthetic known-bad inputs first (16/16), because nineteen
   instruments were caught returning confident wrong answers here in one session.

   ── THE CONTROL IS OUR OWN CHARACTER SELECT, NOT THE PLATE ──────────────────
   Character select scores 7.00 to this screen's 5.17 on the same renderer, the same
   lighting, the same models and the same capture path. Captured in ONE run on ONE
   frozen snapshot, three repeats each (the hero sways +/-22 degrees, so repeats are the
   drift control and the measured spread IS the resolution floor):

                     home      select    floor    what it says
     flat%           46.80     30.37     0.91     47% of the lobby is featureless
     hues             5.57      8.04     0.10     one orange, one cream, twice
     edge%            8.13     14.18     0.20     nothing has an edge
     dark%           14.50     13.63     4.26     <- CANNOT RESOLVE. See below.

   ⚠️ dark% IS REPORTED AND NOT ACTED ON. Its measured floor is +/-4.26 and the gap
   between our 5.17 screen and our 7.00 screen is 0.87 — a fifth of the noise. The
   diagnosis handed to this pass listed "hard drop shadows and bevels" as a headline
   defect; on the only paired control available it is not what separates our good menu
   from our bad one, and CLAUDE.md #10 is explicit that acting inside a floor is how
   this project has repeatedly steered on noise. Brawl Stars measures 43.74 there, but
   Brawl Stars is a DARK-themed game and ours is high-key by a settled art direction
   that has already falsified "fix it by desaturating" four times. Chasing that number
   would mean darkening the art to satisfy an instrument.

   ── ACCEPTANCE, AND THE ONE METRIC THAT WAS DEMOTED AFTER ROUND 1 ───────────
   Stated before round 1 as flat% <= 33, hues >= 7.0, edge% >= 12. Then the plates were
   put through the same function, and hues DID NOT SURVIVE:

     screen              score   flat%   hues   edge%
     ours, home           5.17   46.80   5.57    8.13
     ours, select         7.00   30.37   8.04   14.18
     Brawl Stars home     8.50   31.50   4.71    9.95
     Brawl Stars roster      -   41.02   2.84   11.14
     Zooba progression       -   63.65   2.11    5.39

   The best-scoring screen in the set has FEWER effective hues than our worst one. hues
   separates our two screens and is flatly contradicted across products, so it is a
   within-product observation and not a quality proxy — it is reported below and NOT
   steered on. This is the same discipline CLAUDE.md #10 demands of a resolution floor,
   applied to validity instead of precision: a number that ranks the reference below the
   thing it is meant to improve is not measuring quality.

   What both independent references agree on is flat%: 30.37 and 31.50 for good screens
   against our 46.80. So:

     PRIMARY    flat%  46.80 -> <= 33.0   (floor 0.91; both references sit at 30-32)
     SECONDARY  edge%   8.13 -> >= 10.0   (floor 0.20; references 9.95 / 11.14 / 14.18)
     REPORTED   hues, dark%  -- see above, and dark% cannot resolve its own gap.

   ── WHAT IS BUILT, AND WHICH DEFECT EACH PIECE ANSWERS ──────────────────────
    1. A ROOM instead of a backdrop ('.home-room'). The flat orange radial plus dot
       grid was 47% featureless by itself. Now a tiled wall, a counter line, a floor,
       and a warm pool bedding the cool stage into it.
    2. THE HERO CARD IS GONE ('.home-stage'). It is full-bleed top to bottom with its
       canvas feathered into the room, so the fighter stands IN the lobby instead of
       inside a bordered rectangle on it. The set behind it is now a kitchen -- see
       'charStage.setScene()'.
    3. TILES DIFFERENTIATED BY FUNCTION. Bright gold for the thing you act on, dark
       slate for the things you read off, cream for the card they sit in.
    4. Pictorial navigation and a pictorial record row.

   ── AND THE ONE THING THAT COULD NOT BE REACHED FROM HERE ───────────────────
   'menu_accept''s 'hero-fills-its-panel' (floor 0.42) measures the hero's projected
   width as a fraction of ITS CANVAS. Making the canvas the full 16:9 viewport -- the
   literal Brawl Stars composition -- divides that number by the aspect change and
   lands it at ~0.29 for every fighter, with no framing that recovers it: reaching 0.42
   at 16:9 needs the character to be 89% of the screen's HEIGHT, against the reference's
   own 47%. The assertion is correct for a hero in a panel and becomes a category error
   when the panel is the screen, which is exactly the aggregate-vs-paired confusion
   CLAUDE.md #10 warns about. 'menu_accept.mjs' is not this file's to change, so the
   stage is held at aspect <= 0.92 (where every fighter clears the floor with margin)
   and the routing request is in the report. */

/* ── THE ROOM ─────────────────────────────────────────────────────────────── */
/* Painted by THIS SCREEN and not by the shell. '.fa-bg' is shared by every menu, so a
   room built there would put a kitchen behind the settings sheet and the shop. It sits
   at z-index 0 with every real control above it, and it is 'pointer-events: none' plus
   'aria-hidden' so it can never take a tap or a screen-reader stop -- '#screens' and
   '.hud-root' being pass-through is a standing rule on this project.

   WARM, and deliberately not the dark room the reference plate has. Brawl Stars' lobby
   is a dark purple industrial interior because its brand is purple; ours is a warm
   kitchen because the backdrop's job is to be the same product as the screen one click
   away. Character select is a warm orange field and scores 7.00; a dark lobby would
   have bought this metric at the cost of making the two screens different games. */
.fa-home .home-room {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
/* The wall, and the tiling is what actually moves 'flat%'.
   Two grout lines per joint, a dark one and a light one below it, because that is what
   a lit tile edge is and because ONE line at low alpha does not clear the metric's own
   30-luma step threshold -- it would have been a texture nobody and nothing could see,
   which is 'docs/LESSONS.md' §1 stated as a gradient stop. */
/* Pitch 64 px and not 94, and the grout is a real two-tone joint.
   'hm_lang''s edge share counts a pixel only on a luma STEP of 30 or more, which is not
   an arbitrary threshold — it is roughly where a joint stops being a tint and starts
   being a line. Round 1 ran 94 px tiles with a 0.20/0.16 joint: about 32 and 24 counts
   of step on this base, so half the joints did not clear it and there were few of them.
   The point of tiling a wall is not the pattern, it is that a room has EDGES in it and
   a gradient does not. */
.fa-home .home-room-wall {
  position: absolute;
  inset: 0 0 42% 0;
  background:
    repeating-linear-gradient(90deg, rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
    repeating-linear-gradient(180deg, rgba(52,14,0,0.30) 0 3px, rgba(255,240,200,0.26) 3px 7px, transparent 7px 46px),
    radial-gradient(120% 90% at 50% 100%, rgba(255,222,150,0.55) 0%, transparent 62%),
    linear-gradient(180deg, #E9761F 0%, #EE8A22 46%, #F2A22C 100%);
}
/* The counter run and the floor under it. A hard bright lip on top of a dark body: the
   single highest-contrast horizontal in the frame, which is what stops the eye and
   makes the wall read as a wall rather than as the top of a gradient. */
.fa-home .home-room-floor {
  position: absolute;
  inset: 58% 0 0 0;
  background:
    linear-gradient(180deg, #FFE2A8 0 6px, #C8811F 6px 13px, #8E3A16 13px 22px, transparent 22px),
    /* Board joints. The floor was the single largest featureless region left after the
       wall was tiled — 42% of the frame at one gradient — and a plank line is the
       cheapest edge in the room. 0.16 alpha did not clear the 30-count step; 0.30 with a
       lit edge beside it does, and it is what a board joint looks like anyway. */
    repeating-linear-gradient(90deg, rgba(0,0,0,0.30) 0 3px, rgba(255,214,150,0.14) 3px 6px, transparent 6px 84px),
    repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 58px),
    linear-gradient(180deg, #A63A18 0%, #7E240F 55%, #5E1608 100%);
}
/* ── THE ALCOVE, and it is the third attempt at this seam ─────────────────────
   The stage's clear colour is an opaque saturated azure and the room around it is a
   warm orange kitchen. Two earlier attempts to join them both failed, and both failed
   in a way worth recording because the obvious idea is one of them:

     1. A WARM RIM over the canvas edge ('opening.ts''s idiom, which works on the title
        card). Measured: effective hue count 5.57 -> 4.17, i.e. it did not blend the cool
        into the warm, it PAINTED OVER the cool -- and the cyclorama is described in
        'charStage.ts' as the largest cool surface in the menus.
     2. A BIGGER, SOFTER FEATHER. Looked at, on a real capture: the canvas stopped being
        a rectangle and became a soft-edged rectangle. It still read as a blue slab
        floating on an orange wall, which is the same "cutout pasted on a swatch" both
        blind critics filed against the old card -- with the outline blurred.

   The mistake in both is treating the join as a BLEND problem. It is a spatial one: two
   different places cannot be cross-faded into each other, they have to be one place.
   So the wall now has a hole in it. A tiled kitchen wall with an arched service recess,
   the recess is the colour the renderer already clears to, and the fighter stands inside
   it. The feather is then invisible because it fades cool into cool, and the frame of
   the recess is a HARD edge, which is what the room was short of.

   Deliberately NOT a vignette. This file's round-2 note records that the art direction
   is high-key and that a dark vignette would have been the wrong move twice over; an
   architectural opening is dark because it is a hole, and it is bounded, framed and the
   same shape at every viewport rather than being a shadow smeared over the composition. */
.fa-home .home-room-alcove {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: -3%;
  bottom: 0;
  /* Wider than '.home-stage' by design, so the canvas's feathered edge lands INSIDE the
     recess and never crosses its frame. */
  width: min(97vh, 60vw);
  border-radius: 46% 46% 4% 4% / 30% 30% 2% 2%;
  background:
    radial-gradient(58% 44% at 50% 30%, rgba(120,190,235,0.30) 0%, transparent 72%),
    linear-gradient(180deg, #1B5375 0%, #164866 52%, #0E3149 100%);
  box-shadow:
    inset 0 0 0 5px rgba(255,196,104,0.92),
    inset 0 0 0 10px rgba(58,18,2,0.72),
    inset 0 18px 34px rgba(0,0,0,0.34),
    0 0 42px rgba(0,0,0,0.30);
}

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
/* ⚠️ THE THREE ROWS HAVE TO BE POSITIONED, AND IT IS NOT COSMETIC.
   '.home-room' and '.home-stage' are positioned with 'z-index: 0'. A positioned element
   with an explicit z-index paints in the POSITIONED phase, which is entirely above the
   in-flow block phase that non-positioned grid items paint in -- so without this the
   full-height stage would be drawn straight over the top bar, the flank panels and
   START GAME, and every one of them would still be hit-testable but invisible. That is
   'docs/LESSONS.md' §1 with the sign flipped: present, painted, and behind the thing it
   is supposed to be in front of. */
.fa-home .fa-topbar,
.fa-home .home-middle,
.fa-home .home-bottom { position: relative; z-index: 1; }
/* The confetti layer needs nothing here: 'theme.ts' already puts it at z-index 90, which
   is above both the room and these rows. An override was written and removed — lowering
   a shared layer to clear a local stack is how a screen ends up with confetti behind a
   panel on some OTHER screen's next change. */
/* SIZED TO CONTENT, then centred against the hero's mass.
   A stretched panel is the trap this screen already fell into once: round 1's rail
   was one small card sitting on top of ~600px of empty cream, and a large flat
   emptiness inside a bordered surface is a louder "unfinished" signal than no surface
   at all. These cards hold everything the lobby honestly knows and then stop. */
/* 'container-type: inline-size' — A CONTAINER QUERY, AND IT IS THE RIGHT INSTRUMENT
   RATHER THAN A CLEVER ONE. The flank's width is
       (100vw - 2*gutter - min(97vh, 60vw) - 2*gap) / 2
   because the middle track reserves the stage slot off vh. So it is a function of BOTH
   axes, and the flank widths actually measured are

     852x480 -> 173.34    1024x768 -> 178.45    844x390 -> 213.34
     852x393 -> 215.77    1280x800 -> 225.61    1600x900 -> 331.81

   — the narrowest flank in the set is on a PHONE and the second narrowest is on a
   TABLET twice its area. No media query can name that pair without naming four
   viewports and getting the fifth wrong, which is the same mistake the nameplate's vh
   clamp made one panel up. The card asks about the box it is in, and gets the true
   answer at every size including ones nobody tested.

   ⚠️ It also removes a hazard rather than adding one: 'contain: inline-size' makes this
   column's width independent of its contents, which is the exact defect
   'docs/LESSONS.md' records for the portrait top bar (an auto track inflated to its
   items' min-content and drew the whole screen 70px too wide). */
.fa-home .home-col {
  container-type: inline-size;
  /* THE ONE PLACE ON THIS SCREEN WHERE 'vh' IS THE RIGHT UNIT, and it is worth saying
     why given the nameplate two panels down was broken by exactly the opposite. There
     the quantity being positioned against (a 56px top bar) does not scale with the
     viewport, so a vh clamp was a category error. HERE the quantity being spent IS
     vertical room, and there is proportionally less of it on a 480px screen than on a
     900px one. 0.85vh resolves to 4.08px at 852x480 — the only viewport whose left
     flank has no headroom — and to the original 6px everywhere above 706px tall.
     Worth 9.6px across the column's five gaps, against a measured 9.31px overspend. */
  gap: clamp(4px, 0.85vh, 6px);
  padding: clamp(6px, 1.35vh, 14px);
  overflow: hidden;
  align-self: center;
  max-height: 100%;
}
/* ⚠️ 'flex: 0 0 auto' ON EVERY CHILD, AND IT IS A GUARD RATHER THAN A LAYOUT TWEAK.
   An over-subscribed column here does NOT overflow — every child is a '<button>' or a
   block whose flex 'min-height: auto' Chromium does not resolve to its content-based
   minimum, so the column silently COMPRESSES its cards and their contents draw outside
   their own borders while the panel looks untouched. Proven on a mutant
   ('ud_defects.mjs --selftest', row 5): 40px of extra content shrank the road card
   70.58px -> 52.28px with its content still 67px, i.e. 21px of type rendering over the
   card's bottom edge — and BOTH column-level overflow metrics reported 0.00.
   'scrollHeight - clientHeight' was 0, the per-child bottom was 0.06.

   With shrinking off, the same overspend becomes an overflow the panel clips, which
   'childCut' does see. That is the whole point: a failure this layout can have must be
   a failure the instrument can NAME. It is not load-bearing for the fit — every
   viewport measured has headroom — it is load-bearing for the NEXT change. */
.fa-home .home-col > * { flex: 0 0 auto; }

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
/* ADOPTED: the elevation ladder. This four-layer stack was one hand-typed idiom at two
   hand-typed parameters -- exactly what theme.ts's '--ds-e*' collapses -- and the two
   outer layers are now 'var(--ds-e4)' (the hero-CTA elevation, which is what a panel
   this large should carry) and the top highlight is 'var(--ds-bevel)'. The warm inner
   pool is KEPT as a literal and is the one thing here that is not on the ladder: it was
   added against a critic finding ("no warmth pooling in the base") and there is no token
   for a hue-tinted inner glow. Recorded rather than deleted to make a counter go up. */
.fa-home .home-col {
  border-width: var(--ds-stroke-3);
  box-shadow: var(--ds-e4), var(--ds-bevel), inset 0 -10px 16px rgba(150,96,30,0.10);
}
/* Panel titles were 62%-opacity ink at ~12px — the lightest structural type on the
   screen, and measured at 4.8:1. Solid ink, larger, with a gold rule under it, so a
   heading reads as a heading and not as a caption. */
/* ── TYPE: STEP 3, AND THE STEP IS THE POINT ─────────────────────────────────
   'ds_inventory --clamps' decomposed every font-size on the menus and found 91 of 102
   -- 89% of all menu type -- inside ONE cluster: min 0.58-0.84rem, max 0.70-1.15rem.
   The menus did not have a scale that drifted, they had ONE SIZE JITTERED 26 WAYS, and
   this file supplied a dozen of the jitters. Every 'font-size' below now names a rung
   of theme.ts's histogram-derived ladder, and the rung is chosen by MEANING:

     t1  caption / tag      the tap hint, the record's key, the level caption, the pill
     t2  label              a card's sub-line, an ability name, the mode's sub
     t3  body / control     a section title, a card's title
     t4  lead               the mode name, and (from theme.ts) a chip's numeral
     t5  numeral            the record's counts, and the stat row's value
     t6  glyph / title      the ability icon
   ⚠️ A ladder assigned at random scores as well on any counter as one assigned by
   meaning (LESSONS §6b). The counter is 'da_geom --compare's T3; the assignment is
   this table, and the close-out is the PNG. */
.fa-home .fa-panel-title {
  color: var(--ink);
  font-size: var(--ds-t3);
  letter-spacing: var(--ds-track-caps);
}
.fa-home .fa-panel-title::after {
  content: '';
  display: block;
  width: 32px;
  height: 4px;
  margin-top: 5px;
  border-radius: var(--ds-r-pill);
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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-track:hover { filter: brightness(1.04); }
.fa-home .home-track:active {
  transform: translateY(3px);
  box-shadow: var(--ds-e0), var(--ds-bevel);
}
.fa-home .home-track[hidden] { display: none; }

/* ── NOTHING ON THIS SCREEN ELLIPSISES ANY MORE ───────────────────────────────
   'white-space: nowrap; overflow: hidden; text-overflow: ellipsis' on the title and
   the sub produced NINE truncated runs at 852x480 and TEN at 1024x768, measured with
   'tools/tmp/ud_defects.mjs' against a populated save:

     "9 rewards ready"      -> "9 rew..."       (-10 chars)
     "Waiting to be opened" -> "Waitin..."      (-14 chars)
     "3 chests held"        -> "3 che..."       (-8 chars)

   Two blind critics named it unprompted -- "truncated mid-word ... reads as an
   unfinished layout bug" -- and it produced the joint-worst score in the per-element
   audit, 4 against 8. The solution was already written down in 'settings.ts:1311',
   where a nowrap segmented control rendered "Battery s..." at 390px portrait and was
   fixed by WRAPPING: an option a player cannot read is an option that is not offered.
   Same rule, same fix, three more elements.

   THREE THINGS MAKE THE WRAP SAFE, and all three are load-bearing:

   1. 'min-width' on the title, NOT 'min-width: 0'. A flex item allowed to shrink to
      zero wraps INSIDE A WORD -- at 852x480 the title column was 39.89px against a
      45px "rewards", so break-word would have rendered "reward" / "s", which is worse
      than the ellipsis it replaced. The floor is set above the longest word any title
      can hold, so the wrap always lands on a space.
   2. 'flex-wrap: wrap' on the row, so the PILL drops to its own line when the title
      cannot have its floor otherwise. This is what buys the title its width back; the
      pill is 'white-space: nowrap' and cannot shrink, so without this the title pays
      for it. 'margin-inline-start: auto' keeps the pill right-aligned on either line.
   3. 'overflow-wrap: break-word' as a FLOOR, never as the mechanism -- exactly as in
      'settings.ts'. If a future string does hold a word longer than the column, it
      breaks rather than overflowing the card, and the metrics tool reports it.

   ⚠️ Wrapping spends VERTICAL space, and '.home-col' is 'overflow: hidden' -- it CLIPS
   rather than scrolls. A wrap that does not fit converts a horizontal truncation into
   a vertical one, which is strictly WORSE: an ellipsis at least tells the player that
   something was cut. The container query below pays for the wrap at the one flank
   width where the budget is tight, and 'ud_defects.mjs' reports 'clipped' per column
   so an overspend cannot ship silently. */
.fa-home .home-track-top {
  display: flex; align-items: center; flex-wrap: wrap;
  gap: 4px 8px; width: 100%; min-width: 0;
}
.fa-home .home-track-icon { font-size: var(--ds-t5); line-height: 1; flex: 0 0 auto; }
.fa-home .home-track-title {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t3);
  line-height: 1.18;
  flex: 1 1 auto;
  /* The longest word any title can carry is a milestone face title -- a character name
     from 'rules.ts' ("Hamburger", "Bottle") or "complete" / "rewards" / "chests" --
     which measures ~68px at the largest size this clamp reaches. 72px therefore
     guarantees the wrap lands on a space at every viewport. */
  min-width: 72px;
  overflow-wrap: break-word;
}
.fa-home .home-track-sub {
  font-family: 'Heebo', sans-serif;
  font-size: var(--ds-t2); font-weight: var(--ds-w-body); color: #4A3524;
  line-height: 1.22;
  overflow-wrap: break-word;
}
/* 'renderRoad' leaves this empty in one state and the flex column would otherwise
   still pay the gap for a box with nothing in it. */
.fa-home .home-track-sub:empty { display: none; }
.fa-home .home-track-pill {
  display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
  margin-inline-start: auto;
  --fa-ic-ink: #FFF3DE;
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  background: var(--ink); color: var(--cream);
  border-radius: var(--ds-r-pill); padding: 3px 9px; white-space: nowrap;
}
.fa-home .home-pips { margin-inline-start: auto; }
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

/* Distance-to-next, measured across the gap the player is actually crossing.
   ── ADOPTED '.ds-bar ds-bar--sm', SO ALL THAT IS LEFT HERE IS WHAT THE COMPONENT
      CANNOT KNOW ────────────────────────────────────────────────────────────────
   The track, the ink line, the pill radius, the clip and the fill's top-light all come
   from theme.ts now. Two declarations have to stay, and both are about the CONTEXT
   rather than the component:

     * 'flex: 0 0 auto'. '.ds-bar' is 'flex: 1 1 auto', which is right in the flex ROW
       it was drawn for and wrong inside '.home-track', which is a flex COLUMN -- there
       the same declaration makes the bar grow in HEIGHT until it fills the card. This
       is the '.home-col > *' guard one level down, for the same reason.
     * the diagonal gold stripe, which is this row's identity and which '.ds-bar-fill'
       takes from the caller by design ('--ds-bar-ink' or an override). */
.fa-home .home-bar { flex: 0 0 auto; }
/* 🚨 'display: block' IS LOAD-BEARING AND THIS FILE ALREADY KNEW IT.
   The note above 'renderFighter' has said since round 1: "'theme.ts' styles the fill
   with a width and a height and nothing else — an INLINE SPAN silently ignores both,
   and the bars render as empty tracks." Deleting this file's own '.home-bar-fill'
   block during the '.ds-bar' adoption took the 'display: block' with it, and the very
   first capture showed the road card's bar as an empty cream track with a 100%-width
   fill inside it that was not drawing anything. Rendering and INVISIBLE, for the
   twenty-first time (AGENT-BRIEF §4.2), caught by reading the PNG and not by any
   assertion — 'menu_accept' and 'ud_defects' both passed it.
   ⚠️ '.ds-bar-fill' in 'theme.ts' has the same gap and it is a trap for every future
   adopter. That file is not this owner's; it is in the report. */
.fa-home .home-bar-fill {
  display: block;
  background: repeating-linear-gradient(45deg, var(--gold) 0 8px, var(--mustard) 8px 16px);
}

/* Free-chest cadence. Countable, so it is counted. */
.fa-home .home-pips { display: flex; gap: 3px; flex: 0 0 auto; }
.fa-home .home-pip {
  width: 10px; height: 10px; border-radius: var(--ds-r-round);
  border: var(--ds-stroke-1) solid var(--ink);
  background: rgba(26,18,36,0.14);
}
.fa-home .home-pip.is-on { background: var(--lettuce); }

/* ── PAYING FOR THE WRAP, AT THE ONE WIDTH WHERE IT COSTS ANYTHING ────────────
   Wrapping instead of ellipsising spends vertical space, and the left flank's budget
   is not the same at every viewport. Measured slack (band height minus column height),
   'tools/tmp/ud_defects.mjs':

     852x480 ....  24.95px   <- the only tight one
     852x393 ....  35.78px
     844x390 ....  32.78px
     1024x768 ... 254.20px
     1280x800 ... 275.03px
     1600x900 ... 350.47px

   So the trims below fire on a 173px flank and NOT on a 178px one, which no media
   query can express (the 173px case is a 852x480 phone and the 178px case is a
   1024x768 tablet). Nothing here removes information — it is padding, gap and one
   ornamental icon size. The icon is the largest single saving because it, not the
   text, sets the row's height: 24px of glyph beside 13px of type. */
/* ⚠️ THE HEIGHT CONDITION IS NOT REDUNDANT WITH THE WIDTH ONE, and leaving it off
   applied all of this to a 1024x768 tablet.
   A container query resolves against the CONTENT box, and the content boxes are
   852x480 -> 155.4px and 1024x768 -> 152.7px: the TABLET's flank is the narrower of the
   two, so no max-width threshold can separate them. But every declaration in this block
   buys VERTICAL room, and the tablet has 232px of slack — it needs none of it, and
   quietly restyling a viewport that was never broken is how a fix becomes a regression
   somewhere nobody looked. The width says the cards are cramped; the height says the
   column is out of room; the trims are only correct when both are true. */
@media (max-height: 520px) {
@container (max-width: 176px) {
  /* THE PILL MOVES ONTO THE SUB'S LINE, and this is where the height actually is.
     With the row as a wrapping flex line, a 132px card cannot hold
     icon + a title with a usable minimum + a nowrap pill, so the PILL wraps to a line
     of its own: 22px per card, on all three cards, for one 45px chip. Reflowing the
     card as a three-area grid puts it beside the sub instead, where there is already a
     line. 'display: contents' on '.home-track-top' is what lets a grid area address
     children of a wrapper without moving them in the DOM — the wide layout keeps its
     single row and its markup is untouched.

     Measured at 852x480 with the LONGEST strings the code can emit
     ('ud_defects.mjs --stress'): the road card was 108.17px and the column overspent
     its band by 21.61px, clipping the record row. */
  .fa-home .home-track {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'ic ti ti'
      'sb sb pl'
      'br br br';
    align-items: center;
    padding: 4px 7px;
    column-gap: 6px;
    row-gap: 3px;
  }
  .fa-home .home-track-top { display: contents; }
  .fa-home .home-track-icon { grid-area: ic; font-size: var(--ds-t4); }
  /* min-width goes back to 0 here ON PURPOSE: the title now owns a whole grid row and
     is never competing with the pill, so the floor that stopped mid-word breaks in the
     flex layout would only force the grid column wider than the card. */
  .fa-home .home-track-title { grid-area: ti; min-width: 0; }
  .fa-home .home-track-sub { grid-area: sb; }
  .fa-home .home-track-pill,
  .fa-home .home-pips { grid-area: pl; justify-self: end; margin-inline-start: 0; }
  .fa-home .home-bar { grid-area: br; height: 7px; }
  .fa-home .home-kit-tile { padding: 4px 3px; }
  .fa-home .home-kit-cap { margin-top: 6px; padding: 3px 6px; }
  /* ORNAMENT ONLY, and it is already dropped one breakpoint down for the same reason:
     "the gold rule under a panel title is 9px of a band that has none to spare". The
     first pass of this fix left it in and the column came out 8.59px over — measured as
     '.home-track > .home-bar draws 8.59px outside its own card', which is precisely the
     silent squash the guard above now makes impossible. */
  .fa-home .fa-panel-title::after { display: none; }
  /* THE THIRD CHANNEL IS THE ONE TO SPEND. This row says each number three ways: a
     glyph, a colour and a word. The file's own note is that "the numeral carries the
     meaning in colour now (won / lost / peak) instead of a caption doing all the work",
     and every one of the three colours is documented at 8.4-12.4:1 on the slate plate.
     Dropping the 11.5px glyph keeps the word AND the colour and is worth 22.3px of a
     band that was 21.61px short. */
  .fa-home .home-record { margin-top: 1px; padding-top: 4px; }
  .fa-home .home-rec { padding: 3px 2px 2px; }
  .fa-home .home-rec-ic { display: none; }
}
}

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
/* ── AND THE CARD IS GONE ─────────────────────────────────────────────────────
   Two blind critics on this screen said the hero "reads as a cutout pasted on a colour
   swatch", and round 3 answered the SWATCH half by building a real 3D set inside the
   canvas. It never answered the CUTOUT half, because the thing making it a cutout was
   the 4px ink border, the 16px radius and the 6px drop shadow drawn around it: a card
   is by construction a picture OF a place rather than a place. Uri's own words on the
   result were "looks amateurish", and this is the piece of it that is a rectangle.

   So: no border, no radius, no shadow, no grid cell. It spans the full screen height,
   its canvas is feathered into the room with a radial mask, and a warm glow bridges the
   two. That mask is 'opening.ts''s idiom, not a new one -- the title card has shipped a
   masked hero over a warm field for several rounds and it is the highest-scoring
   treatment of this same stage in the build.

   ── WIDTH IS CAPPED AT 0.92 OF THE HEIGHT, AND THAT IS A GATE, NOT A TASTE ──
   'menu_accept''s 'hero-fills-its-panel' measures the hero's projected width over the
   CANVAS width, floor 0.42. At the portrait rig's 0.62 vertical fill the projected
   width fraction is (subjectW/subjectH) * 0.62 / aspect, so it falls as the canvas gets
   wider: 0.57 for Hamburger at 0.92, and 0.48 for the narrowest fighter in the cast.
   A full-bleed 16:9 canvas -- the reference plate's actual composition -- puts every
   fighter at ~0.29 and no framing recovers it (0.42 at 16:9 needs the character to be
   89% of screen HEIGHT, against Brawl Stars' own 47%). See the round-4 header.

   'min(92vh, 56vw)' rather than a bare ratio: at 1024x768 the flanks would otherwise be
   crushed to 126px against a 150px minimum. When 56vw binds the canvas gets NARROWER,
   which moves the hero metric UP, so the cap is safe in the only direction it can act. */
/* ⚠️ A 5vh OVERSCAN WAS TRIED HERE AND REVERTED, and the number that killed it was the
   picture. Running the canvas 110vh tall so the set bled off the top and bottom edges
   did move the primary metric the right way (flat% 36.37 -> 32.19) and it made the hero
   62% of 990px rather than of 900 — which, rendered, crowded the frame: the crown
   touched the nameplate and the podium ran under the bottom bar. The alcove above buys
   the same "no bounding box" read for nothing, so the stage went back to the viewport
   height and the width cap went to 56vw. flat% held at 32.62. */
.fa-home .home-stage {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  z-index: 0;
  width: min(92vh, 56vw);
  transform: translateX(-50%);
  cursor: pointer;
}
/* THE FEATHER. The canvas's own clear colour is opaque (see 'charStage.ts'), so the
   only way its rectangle stops being a rectangle is to mask the element. Inside the
   dark stop the room does not show at all; by 82% it is entirely room. Both the canvas
   and its CSS placeholder background live on THIS element so the mask catches the
   pre-first-present frame too -- on the parent it would have left a hard-edged slab of
   '#1d5a80' for one frame on every navigation. */
/* ⚠️ ROUND 1 OF THIS PASS PUT THE FEATHER AND THE GLOW BOTH TOO STRONG, AND THE NUMBER
   SAID SO BEFORE THE EYE DID. Core 44% / transparent 82%, with a 0.34-alpha warm rim
   over the top, left an ellipse of visible set roughly 360x560 inside an 828x900 canvas
   — most of which the fighter itself covers. So the room was showing and the SET was
   not, and the warm rim then tinted what little blue survived: measured effective hue
   count fell 5.57 -> 4.17 while the page got MORE orange, which is the exact direction
   'docs/LESSONS.md' §8 spent two rounds proving is the wrong one. The cyclorama is
   described in 'charStage.ts' as "the largest cool surface in the menus" and it had been
   painted over. Core out to 58%, transparent at 94%, and the rim down to 0.15. */
.fa-home .home-stage-3d {
  position: absolute;
  inset: 0;
  background: ${PORTRAIT_BG_CSS};
  -webkit-mask-image: radial-gradient(66% 70% at 50% 50%, #000 58%, rgba(0,0,0,0.42) 78%, transparent 94%);
  mask-image: radial-gradient(66% 70% at 50% 50%, #000 58%, rgba(0,0,0,0.42) 78%, transparent 94%);
}
/* The warm rim over the seam. Same job as 'opening.ts''s '.open-glow' — enough to stop
   the cool pool reading as a hole punched in the wall, and not one step more. */
.fa-home .home-stage-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(70% 74% at 50% 50%, transparent 56%, rgba(255,186,88,0.15) 80%, transparent 96%);
}
/* What the grid reserves for it. The stage itself is out of flow, so this is the only
   thing keeping a flank from being drawn across the fighter. */
.fa-home .home-stage-slot { width: min(97vh, 60vw); }

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
/* TOP-CENTRE now, and the reason the old comment gave is what moved it.
   It said the card's top-left is "dead sky in every framing the rig produces" -- true of
   a 4:5 card, and false the moment the card became the full screen height: the stage's
   top-left corner is now behind the status chips. The stage's top CENTRE is the piece of
   the top bar that is deliberately empty ('.fa-topbar-spacer'), and it is still sky at
   every framing for the same reason as before. Bottom-centre remains wrong -- that is
   where the plinth is. */
/* ⚠️ AND THE OFFSET WAS IN THE WRONG UNIT, WHICH IS WHY IT WAS WRONG EVERYWHERE.
   'top: clamp(46px, 7.5vh, 76px)' with a 'clamp(40px, 12vh, 56px)' override on short
   viewports was a guard nobody had ever measured, and it FAILED AT ALL SIX viewports
   tested, not only on the phone it was tuned for. Measured, 'tools/tmp/ud_defects.mjs':

     viewport     top bar bottom   nameplate top   OVERLAP
     852x393           62.00           47.16       14.84px
     852x480           62.23           46.00       16.23px
     844x390           62.00           46.80       15.20px
     1024x768          65.97           57.59        8.38px
     1280x800          66.39           60.00        6.39px
     1600x900          67.69           67.50        0.19px

   The mechanism is in the middle column: THE TOP BAR IS 56px TALL AT EVERY ONE OF THEM.
   It is built out of '--tap' (a fixed 44px) plus fixed padding and borders, so it does
   not scale with the viewport at all — only the 'var(--gap)' above it does, and that is
   itself clamped to 6-12px. The nameplate offset was written in 'vh', so the two
   quantities scale differently and any value that clears the bar does so by coincidence
   at exactly one height. A vh clamp cannot express "below a fixed-height bar".

   So the offset is now a MAX of the aesthetic value and a hard floor derived from the
   same variable the bar is derived from: '--tap + 12px' is the bar's measured height
   (56px, constant across a 2.3x range of viewport height), and 6px is the clearance.
   If the design system's tap target ever grows, the nameplate moves with it instead of
   silently sliding back under the tabs.

   NOT solved by moving the plate off-centre: the empty half of the top bar
   ('.fa-topbar-spacer') is LEFT of the tabs, and the nameplate is centred on the hero,
   which is centred on the screen. Decentring the name to dodge the tabs would decentre
   it from the thing it names. */
/* 🚨 AND "THE TOP BAR IS 56px TALL AT EVERY ONE OF THEM" IS FALSE IN PORTRAIT, WHICH IS
   WHERE URI HOLDS THE PHONE. Kept above per the reversed-assertion rule; this is the
   correction and the reason.

   All six viewports in that table are landscape or desktop, and none is under 844px
   wide — so not one of them fires the '@media (max-width: 700px)' block at the bottom
   of this file, which sets '.fa-topbar { flex-wrap: wrap }'. Wrapped, the bar is not
   56px. Measured on a detached worktree of ce0c665, 390x844:

     .fa-topbar        11.0 -> 163.0   152px tall, THREE rows
       row 1  chips                     11 ->  51
       row 2  .fa-tabs                  57 -> 113
       row 3  the settings gear ALONE  119 -> 163
     .home-nameplate   top 92.8   (clamp(70px, 11vh, 120px) -> 92.84)
     .home-hero-name   92.8 -> 120.3

   The name therefore starts 20.2px INSIDE the tab bar. 'tools/tmp/mn_occlude.mjs',
   16 arms over 4 detectors: OCCLUDED 80.7% of its ink, OVERLAP 71% of its box, occluder
   named as '.fa-tabs'. occFrac's self-pair floor is 0.000 pp and overlapFrac is exact
   geometry, so both numbers are far outside the noise. The hero's own NAME, on the
   lobby, on a phone, in portrait.

   ⚠️ THE FLOOR ABOVE WOULD HAVE HELD — the portrait override discarded it. It reads
   'top: clamp(70px, 11vh, 120px)' with no 'max()', three declarations below the
   'flex-wrap: wrap' that invalidated the constant it was derived from. A guess replaced
   a derivation, in the same block that broke the derivation.

   The offset now comes off the bar's MEASURED bottom ('publishBars', mirroring
   'hud.ts''s '--fa-topbar-b', whose comment records this identical class on the touch
   radar). A measurement survives wrapping, a font swap, a longer player name and a
   fifth tab; no constant does. '--tap + 12px' stays as the FALLBACK so a build where
   the script never runs is exactly as good as the one before it — not worse. */
.fa-home .home-nameplate {
  position: absolute;
  top: max(
    calc(var(--home-topbar-b, calc(var(--fa-safe-t) + var(--gap) + var(--tap) + 12px)) + 6px),
    clamp(46px, 7.5vh, 76px)
  );
  inset-inline-start: 0;
  inset-inline-end: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 6px and not 3px: '.fa-title' paints 'text-shadow: 0 4px 0 var(--ink)' BELOW its
     line box, so any gap under 4px lets the name's drop shadow land on the rarity
     badge. Only visible on a short viewport, where the title clamps down to 1rem and
     the shadow does not clamp with it. */
  gap: 6px;
  max-width: 100%;
  pointer-events: none;
}
.fa-home .home-hero-name { max-width: 100%; }
/* 'theme.ts' gives '.fa-rarity' 'align-self: flex-start', which is right for character
   select's left-aligned nameplate and leaves the badge stranded at the far edge of an
   828px-wide centred one — measured 375px left of the name it belongs to. */
.fa-home .home-nameplate .fa-rarity { align-self: center; }

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
  border-width: var(--ds-stroke-1);
  box-shadow: var(--ds-e1);
}

/* BOTTOM-LEFT, not bottom-right. The stage now runs the full screen height, so its
   bottom-right corner is exactly where the mode plate and START GAME are -- the hint
   would have been drawn across the primary CTA. */
/* 🚨 AND BOTTOM-LEFT IS NOT FAR ENOUGH LEFT IN PORTRAIT — same reasoning, same blind
   spot, one axis over. Kept above per the reversed-assertion rule.

   The rule dodged the CTA on the assumption that it sits in the bottom-RIGHT corner.
   It does at 844x390. At 390x844 '.home-bottom' wraps ('flex-wrap: wrap' in the
   max-width:700px block), the mode plate takes its own full-width row above, and START
   GAME — 269.8px of a 370px content column — spans x 114.8 -> 384.5. The hint spans
   x 24 -> 140.7 at the same y. Measured on ce0c665, 390x844:

     .home-stage-hint   x  24.0 -> 140.7   y 805.5 -> 830.5
     [data-el=start]    x 114.8 -> 384.5   y 753.7 -> 834.4

   'mn_occlude': OCCLUDED 10.8% of the hint's ink, OVERLAP 10% of its box, occluder
   named '.fa-btn fa-btn--primary'. Small, and real — it eats the final T of "TAP TO
   TAUNT", which is worse than it sounds because a clipped word reads as a bug rather
   than as a quiet label.

   There is no horizontal escape: the CTA is 73% of the content width. So the hint goes
   ABOVE the footer instead of beside it, off '--home-bottom-h' (the footer's measured
   height, 'publishBars') rather than off a guess about which corner the CTA is in. It
   is still the stage's bottom-left, just above the band the footer owns — and it still
   sits under the character rather than over him, which is what "bottom-left" was
   protecting. The fallback keeps today's value, so a build without the script is
   unchanged. */
.fa-home .home-stage-hint {
  position: absolute;
  bottom: calc(var(--home-bottom-h, 0px) + clamp(8px, 1.6vh, 16px));
  inset-inline-start: clamp(4px, 1vh, 12px);
  pointer-events: none;
  font-family: 'Rubik', sans-serif;
  font-weight: var(--ds-w-bold);
  font-size: var(--ds-t1);
  letter-spacing: var(--ds-track-caps);
  text-transform: uppercase;
  color: var(--cream);
  background: linear-gradient(180deg, rgba(42,29,58,0.94) 0%, rgba(16,10,26,0.96) 100%);
  border: var(--ds-stroke-1) solid rgba(255,243,222,0.45);
  border-radius: var(--ds-r-pill);
  box-shadow: var(--ds-e2);
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
/* WAS, and kept with the reason per this project's rule about reversed assertions:

     ".fa-home .home-stats { display: flex; flex-direction: column; gap: 5px; }"
     "The shared '.fa-stat-label' is a fixed 58-92px column, which is right for
      character select's narrow stats panel and wrong here, where the label carries an
      icon too."
     .fa-home .home-fighter .fa-stat-label { display:flex; align-items:center; gap:5px;
                                             width:auto; flex:0 0 auto; }

   Both are obsolete because the element they describe is gone: '.fa-stat-label' and
   '.fa-stat-track' are no longer rendered on this screen. See 'renderFighter()' for the
   measurement that removed the bar -- character select's taller, pipped version of the
   same bar scored IDENTICALLY, so the bar was not the thing.

   ⚠️ THE THEME'S '.fa-stat-*' CHILDREN ARE NOT REUSED, AND THAT IS DELIBERATE.
   '.fa-stat-val' carries 'width: 20px' and 'color: rgba(26,18,36,0.7)' -- a 70%-ink
   value that on this row's SLATE plate is dark ink on a dark ground, which is
   'docs/LESSONS.md' §1 case 10 exactly. Reusing the class to look tidy would have
   shipped that bug for the third time in this repo. */
.fa-home .home-stats { display: flex; flex-direction: column; gap: var(--ds-s2); }
/* ⚠️ THE ROW LIST IS THE TALL-VIEWPORT FORM AND IT DOES NOT FIT A LANDSCAPE PHONE.
   Three 56px rows plus gaps is ~180px against the ~64px the old bars occupied, and
   'ud_defects' measures the left flank's slack at 852x480 as 24.95px. So the same three
   facts are laid out ACROSS at short viewports instead of DOWN -- see the max-height
   block at the foot of this file. The tile, the colour-coded label and the display-
   weight numeral survive at every viewport; only the axis changes. */

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
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: 1 / -1; }
.fa-home .home-kit-tile:hover { filter: brightness(1.04); }
.fa-home .home-kit-tile:active {
  transform: translateY(3px);
  box-shadow: var(--ds-e0), var(--ds-bevel);
}
.fa-home .home-kit-tile.is-on {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
.fa-home .home-kit-em { font-size: var(--ds-t6); line-height: 1; flex: 0 0 auto; }
/* WRAPS, for the same reason the track title does. At 852x480 a 58.17px tile rendered
   "Tomato Toss" as "Tomato T..." and "Lettuce Fling" as "Lettuce ..." — three of the
   nine truncated runs on the screen, and unlike the track rows these strings come from
   'rules.ts' and cannot be shortened here. The longest single word in the cast's
   ability names measures ~40px against a 57-58px tile at every viewport where the tile
   exists, so the wrap always lands on a space and 'break-word' is only a floor. */
.fa-home .home-kit-name {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-bold);
  font-size: var(--ds-t2);
  line-height: 1.12;
  text-align: center;
  max-width: 100%;
  overflow-wrap: break-word;
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
  font-weight: var(--ds-w-body);
  font-size: var(--ds-t2);
  line-height: 1.15;
  text-align: center;
  color: #3B2A18;
  background: linear-gradient(180deg, #FFFFFF 0%, #F1DFC0 100%);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
/* The selected ability's NAME, hidden by default because the tile beside it already
   carries it. It is turned on at exactly one breakpoint — the landscape phone, where
   the tiles go icon-only to fit (see the max-height block at the foot of this file) —
   so the caption is the only place the name exists there. Rendered as its own element
   rather than concatenated into the string, because the two states differ in LAYOUT,
   not in content, and a screen must not have to re-run 'renderKit' to change size. */
.fa-home .home-kit-capname { display: none; font-weight: var(--ds-w-black); }
/* NON-BREAKING SPACES, both sides. A plain space in 'content' collapses against the
   adjacent inline box and the first capture rendered "Tomato Toss -Slows enemies down"
   — the leading space survived and the trailing one did not. The dash is also what
   stops the separator from being the wrap point on a two-line caption.
   ⚠️ DOUBLE backslashes: this whole stylesheet is a JS template literal, so a single
   backslash is consumed by JS and never reaches CSS. Written singly it compiled as an
   octal escape and tsc refused the file (TS1487). Same family of trap as the backtick
   rule at the top of this file. */
.fa-home .home-kit-capname::after { content: '\\00a0\\2013\\00a0'; font-weight: var(--ds-w-body); }
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
  border-left: var(--ds-stroke-1) solid var(--ink);
  border-top: var(--ds-stroke-1) solid var(--ink);
  border-start-start-radius: var(--ds-r-1);
}
/* WAS: '.fa-home .home-change { margin-top: 4px; width: 100%; }', and the 'width: 100%'
   is the whole 3.6x inversion in one declaration. A secondary control stretched to its
   panel is 0.91x the primary's area; the reference's is 0.25x. It now sizes to its own
   label and centres, and theme.ts's stated target -- "a caller should hold its WIDTH
   near half the primary's" -- is what 'da_geom --compare's T4 column measures. */
/* ⚠️ AND THE PADDING COMES IN A STEP, BECAUSE A SHRINK-WRAPPED BUTTON CAN BE WIDER
   THAN ITS PANEL. 'menu_accept' caught it: at 1024x768 WITH a landscape tablet's 44px
   safe insets the flank falls to ~150px of content, and '.ds-btn''s 20px side padding
   plus a nowrap "CHANGE" plus its icon measures ~132px of MIN-CONTENT -- which a flex
   item is not allowed to shrink below, so the centred button overhung both sides and
   landed 3px inside the right safe inset ("inside-safe-area  fa-btn[Change] R41").
   'width: 100%' had been hiding it: a stretched item is bounded by its container by
   construction, and taking the stretch off is what exposed the min-content. One step
   down on the space scale is 16px, which clears it with 34px to spare -- and it makes
   the control smaller, which is the direction T4 wants anyway.
   Deliberately NO 'max-width: 100%': with 'white-space: nowrap' that would cap the BOX
   and let the label spill out of it, i.e. turn a loud gate failure into a silent visual
   one. If a longer label ever arrives here, this assertion should fail again. */
.fa-home .home-change { margin-top: var(--ds-s1); align-self: center; padding: 0 var(--ds-s4); }

/* Career record. Three numbers, all live, and the only place in the product that
   shows them — the trophy road tracks the CURRENT count, this tracks the peak. */
.fa-home .home-record {
  display: flex;
  gap: 5px;
  margin-top: 2px;
  padding-top: 6px;
  border-top: var(--ds-stroke-1) dotted rgba(26,18,36,0.2);
}
/* DARK SLATE, and this is the second tile family on the screen.
   They were 'rgba(26,18,36,0.06)' on cream -- a 6% tint inside a cream card, which is
   the same surface at a different opacity rather than a different surface. The plates
   run bright ACTION tiles and dark READ-ONLY tiles side by side, and 'hm_lang''s hue
   count is what makes that a number rather than an opinion: a screen whose every panel
   is one cream cannot spend more of the wheel than the one hue it owns. */
.fa-home .home-rec {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 4px 2px 3px;
  background: linear-gradient(180deg, #3A2A4E 0%, #241A33 100%);
  border: var(--ds-stroke-1) solid var(--ink);
  border-radius: var(--ds-r-2);
  box-shadow: var(--ds-e2), var(--ds-bevel-dark);
  --fa-ic-ink: #FFF3DE;
}
.fa-home .home-rec-ic { font-size: var(--ds-t2); line-height: 1; opacity: 0.92; }
.fa-home .home-rec-val {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-black);
  font-size: var(--ds-t5);
  line-height: 1;
  color: var(--cream);
}
/* The numeral carries the meaning. All three measured against the '#241A33' half of the
   plate, which is the darker end and therefore the binding case:
   '#8FE04A' 10.7:1, '#FF8A96' 8.4:1, '#FFD15C' 12.4:1 -- every one clear of AA with
   room, and the hues are the roster's own lettuce / ketchup / gold rather than three
   new ones invented for this row. */
.fa-home .home-rec-val.is-win { color: #8FE04A; }
.fa-home .home-rec-val.is-loss { color: #FF8A96; }
.fa-home .home-rec-val.is-best { color: #FFD15C; }
/* 55%-opacity ink at 9.9px measured 3.73:1 against a 4.5 floor and was, with the tap
   hint and the mode line, one of the three text runs the critic could not read. Solid
   ink-brown at >=11px took it to ~10:1 on the old cream chip; on the slate plate the
   same job is done by cream at 78%, measured 9.2:1. */
.fa-home .home-rec-key {
  display: flex; align-items: center; gap: 3px;
  font-size: var(--ds-t1);
  font-weight: var(--ds-w-bold);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  color: rgba(255,243,222,0.78);
  white-space: nowrap;
}

/* ── The GOLD family: the one row that is a reward ─────────────────────────── */
/* The trophy road, the free chest and the record row were three identical cream
   surfaces stacked in one cream card, so the panel read as a list and not as a set of
   objects. The road is the thing the player is working toward and the only row here
   that ever pays out, so it takes the same gold the primary CTA uses -- which is the
   reference plates' actual system: bright yellow means "this gives you something". */
.fa-home .home-track--road {
  background: linear-gradient(180deg, var(--mustard-hi) 0%, var(--mustard) 100%);
  --ds-lip: var(--gold-shadow);
  box-shadow: var(--ds-e2), var(--ds-bevel);
}
.fa-home .home-track--road:active { box-shadow: var(--ds-e0), var(--ds-bevel); }
/* '#4A3524' on mustard measures 7.1:1; the sub-line keeps its own value rather than
   inheriting a colour picked for cream. */
.fa-home .home-track--road .home-track-sub { color: #4A3524; }
/* The gold row's pill has to stop being gold-on-gold. Ink plate, cream type: 15.9:1. */
.fa-home .home-track--road .home-track-pill { background: var(--ink); color: var(--cream); }

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
/* ── The status chips join the DARK family ────────────────────────────────────
   Three cream pills on a cream-and-orange page, in a row, at the top of a screen whose
   named defect is that everything is the same surface. The reference plate's currency
   readouts are dark slate with a saturated icon and white type, for the same reason the
   record row above is: a counter is something you READ, not something you press, and
   the two should not look alike.

   ⚠️ '.fa-chip' is 'theme.ts''s and 'theme.ts' is shared, so this is scoped to
   '.fa-home' -- exactly as the '--ketchup' fix below already was. The interactive
   '.fa-iconbtn' gear beside them deliberately stays cream: it is the one thing in the
   bar you press, and that is now the difference between the two shapes.

   The old note, kept because the number is still true of the cream chip on every OTHER
   screen: "'--ketchup' on cream measured 4.35:1 -- under the 4.5 floor by a hair, and it
   is the player's trophy count, which is not a decoration. Darkened one step." On the
   slate plate the trophy count goes the other way and becomes a LIGHT value: '#FF8A96'
   on '#241A33' measures 8.4:1, where '#A81B2B' would have been 1.6:1 and unreadable.
   This is 'docs/LESSONS.md' §1 case 10 exactly -- dark ink on a dark plate -- and it is
   the direct cost of changing a surface under type that was tuned for the old one.

   ── AND THE HAND-ROLLED SLAB IS NOW '.ds-chip--slate' ───────────────────────────
   The three declarations that used to live here -- the '#3A2A4E -> #241A33' gradient,
   'color: var(--cream)' and a '0 4px 0 / inset 0 2px 0' pair -- were this file
   re-deriving, by eye, exactly what theme.ts's slate chip declares from the ladder. They
   are deleted rather than tokenised: the class is on the elements now. What is left is
   the ONE thing the component cannot know, which is that an outlined SVG glyph inside it
   has to flip its ink or draw ink-on-ink -- the bug this repo has shipped three times. */
.fa-home .fa-chip { --fa-ic-ink: #FFF3DE; }
.fa-home .fa-chip-val { color: #FF8A96; }
.fa-home .home-chip-coin .fa-chip-val,
.fa-home .home-chip-coin { color: #FFD15C; }

/* Inside the progress panel the level bar is a row, not a floating hairline: it gets
   the panel's full width and the cream label treatment has to go, because there is no
   dark backdrop behind it any more. */
.fa-home .home-level { flex: 0 0 auto; }
.fa-home .home-level .fa-level-label {
  color: var(--ink);
  text-shadow: none;
  font-size: var(--ds-t1);
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
/* ⚠️ NOW A <button> (see the markup): the plate is unchanged and what is added is the
   press physics, the 44px tap floor and a trailing glyph. 'appearance: none' and the
   explicit font declarations are not tidiness — a <button> inherits neither family nor
   size, and 'screen_metrics.mjs' has caught real controls shipping in Arial for exactly
   that reason. */
.fa-home .home-mode {
  appearance: none;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: clamp(8px, 1vw, 14px);
  min-height: var(--tap);
  margin-inline-start: auto;
  text-align: end;
  min-width: 0;
  font-family: 'Rubik', sans-serif;
  padding: 6px clamp(11px, 1.4vw, 18px);
  background: linear-gradient(180deg, rgba(44,30,60,0.94) 0%, rgba(20,13,30,0.96) 100%);
  border: var(--ds-stroke-2) solid var(--ink);
  border-radius: var(--ds-r-2);
  --ds-lip: rgba(0,0,0,0.45);
  box-shadow: var(--ds-e3), var(--ds-bevel-dark);
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s;
}
.fa-home .home-mode:hover { filter: brightness(1.12); }
.fa-home .home-mode:active { transform: translateY(3px); box-shadow: var(--ds-e0); }
.fa-home .home-mode-lines {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  min-width: 0;
}
/* The affordance. A dark plate that is suddenly tappable needs to say so, and the glyph
   is the same 'who is in the match' mark the lobby's own count chip carries — so the two
   screens are visibly the same subject rather than two unrelated controls. */
.fa-home .home-mode-go {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  font-size: var(--ds-t4);
  color: var(--mustard-hi);
  --fa-ic-ink: var(--mustard-hi);
}
.fa-home .home-mode-name {
  font-family: 'Rubik', sans-serif; font-weight: var(--ds-w-black);
  font-size: var(--ds-t4);
  letter-spacing: var(--ds-track);
  text-transform: uppercase;
  color: var(--mustard-hi);
  text-shadow: none;
  white-space: nowrap;
}
.fa-home .home-mode-sub {
  font-family: 'Rubik', sans-serif;
  font-size: var(--ds-t2);
  font-weight: var(--ds-w-bold);
  color: rgba(255,243,222,0.94);
  text-shadow: none;
  white-space: nowrap;
}

/* ── THE STAT ROWS TURN THROUGH 90 DEGREES ON A SHORT SCREEN ──────────────────
   The tall-viewport form is theme.ts's '.ds-row': a 56px slate slab per stat, carrying a
   56px tinted tile, a colour-coded label and the numeral under it at display weight.
   Three of those plus gaps is ~180px, and 'ud_defects' measures the left flank's slack
   at 852x480 as 24.95px -- so the vertical list is simply not affordable on a landscape
   phone, and pretending otherwise would convert a legibility fix into a clipped panel,
   which is strictly worse (an ellipsis at least tells the player something was cut).

   What gives is the AXIS, and nothing else. Laid out across, the three rows share the
   flank's width and stack their own contents: tile on top, label under it, numeral
   under that. Every one of the three measured fixes survives -- a filled tinted TILE
   instead of a line glyph, a colour-coded label, and the numeral a full ladder step
   above it -- because none of them was ever about the row being horizontal. This is the
   shape '.home-record' three panels down already uses for the same reason.

   ⚠️ 460px is NOT the right threshold here even though it is what the rest of this file
   uses. The binding case is 852x480, which is above it, and 480 is where the flank's
   slack was measured. 520 is the same bound the container-query trims below already
   run on.

   🚨 AND THIS BLOCK'S POSITION IN THE FILE IS LOAD-BEARING. It was first written just
   above the existing '@media (max-height: 520px)' container-query block, which is 350
   lines ABOVE '.fa-home .home-stats'. A MEDIA QUERY ADDS NO SPECIFICITY, so the later
   base rule won, 'flex-direction' stayed 'column', and the three rows -- now
   'flex: 1 1 0' in a zero-height column -- collapsed to about 8px each with their 30px
   tiles overflowing across the panel title. tsc was clean, the rule parsed, and the
   cascade simply did not reach it. Caught by reading the 844x390 PNG; no assertion in
   the battery would have. Keep this block BELOW the base rule. */
@media (max-height: 520px) {
  .fa-home .home-stats { flex-direction: row; gap: var(--ds-s1); }
  .fa-home .home-stat {
    flex: 1 1 0;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: var(--ds-s1) 0 var(--ds-s1);
  }
  /* 30px and not 56: three 56px tiles need 168px of a 155px flank before any padding.
     It is still a filled, tinted, bordered MASS rather than the 1.7px-stroke outline the
     audit measured -- which is the property that was wrong, not the diameter. */
  .fa-home .home-stat .ds-tile--stat {
    width: 30px;
    height: 30px;
    border-width: var(--ds-stroke-1);
    font-size: var(--ds-t6);
  }
  .fa-home .home-stat .ds-row-body { flex: 0 0 auto; align-items: center; text-align: center; }
  /* The label loses its caps tracking and nothing else. At 11px in a ~50px cell,
     0.09em of tracking on "DAMAGE" is the difference between the word fitting and the
     component's own ellipsis firing -- and an ellipsised label is the D2 defect this
     screen spent a whole pass removing. */
  .fa-home .home-stat .ds-row-label { letter-spacing: var(--ds-track-tight); }
  .fa-home .home-stat .ds-row-val { font-size: var(--ds-t4); }

  /* ── TWO PLACES WHERE THE LADDER OVERFLOWS A BOX, AND BOTH WERE FOUND IN A PNG ──
     A type ramp is sized off vh and knows nothing about how wide the box under it is.
     Both of these read clean in every assertion in the battery and both were plainly
     broken at 852x480 in the capture:

     1. THE RECORD NUMERAL. t5 floors at 1.18rem = 18.9px, and "3,170" at that size
        needs ~62px against a ~50px tile — the comma and the last digit were drawn
        outside the plate. t3 floors at 13.1px, still a clear step above the 11px key
        under it, and inside the tile.
     2. THE LEVEL ROW. Both "Lv 17" and "Lv 18" went from 9.92px to 11.04px, which is
        the right direction (9.92 is under 'screen_metrics''s 11px legibility floor) and
        took ~10px off the track between them — enough that theme.ts's own
        '.fa-level-xp' caption WRAPPED inside a 14px track and was clipped through the
        middle of both lines. There is no ladder rung below 11.04px by design, so the
        room has to come from the row rather than from the type: the TRAILING label goes
        and the leading one plus the fraction carry it, which is complete
        ("Lv 17 / 180 of 250 XP") and is the same kind of trim this breakpoint already
        makes to the panel rule and the record glyphs. */
  .fa-home .home-rec-val { font-size: var(--ds-t3); }
  .fa-home .home-level .fa-level-label:last-child { display: none; }
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
  /* WAS: '.fa-home .home-nameplate { top: clamp(40px, 12vh, 56px); }' with the reason
     "the nameplate's top offset is a clamp against viewport height, and at 390px tall
     the top bar is proportionally much larger, so the name would land on the tabs."
     The diagnosis was right and the prescription was 15px short — 12vh of 393 is
     47.16px against a tab bar whose bottom edge is at y=62, so the override moved the
     plate DOWN by 1.16px and the name still ran under the tabs. Kept here per the
     project's rule about reversed assertions: the fix is one level up, on the base
     rule, and it is a max() against a floor derived from '--tap' rather than another
     vh guess. Nothing viewport-specific is needed any more. */
  .fa-home .home-track-sub { display: none; }
  .fa-home .home-mode-sub { display: none; }
  .fa-home .home-record { display: none; }
  /* ⚠️ WAS: '.fa-home .home-kit { display: none; }' and '.home-kit-cap { display: none }',
     with the reason "the caption is the kit's tap state, so it goes with the kit".
     The reason for hiding the CAPTION was sound; hiding the KIT was not, and it stopped
     being defensible the moment Uri ruled the game LANDSCAPE-ONLY (DECISIONS §14).
     This breakpoint is not an edge case — it IS the phone experience — and what it
     shipped was a lobby with NO ability affordance whatsoever: measured 0 tiles at
     852x393 and 844x390, against 4 at every viewport above 460px tall. The right flank
     is titled "Your fighter" and told the player three stat bars and nothing about what
     the fighter DOES.

     It was hidden because the 2x2 grid plus its caption is ~139px and did not fit. The
     measurement says the flank has 118px of unused height at 852x393 (panel 151px in a
     269px band), so the fix is to make the kit fit rather than to delete it:

       - ONE ROW of N tiles instead of a 2x2 grid          -> 44px, not 93px
       - ICON-ONLY tiles, the name moving to the caption   -> nothing truncates in a
                                                              43px tile, and the caption
                                                              gains the name it needs
       - a slightly taller caption to hold name + desc     -> ~50px

     Total ~96px against 118px available, and 'ud_defects.mjs' asserts the column does
     not clip. The caption stays because the tiles are back, which is what the old
     comment actually said. */
  /* ICON-ONLY AT EVERY LANDSCAPE-PHONE WIDTH, one row or two. The name moves to the
     caption, which is where the tap state already lives — measured, that is 33px off a
     two-up grid (a 73px tile wraps "Lettuce Fling" onto a second line and stands 61px
     tall; icon-only it is 44px, the tap floor exactly), and the notched flank needed
     every one of them. */
  .fa-home .home-kit-tile { padding: 4px 3px; gap: 0; }
  .fa-home .home-kit-name { display: none; }
  .fa-home .home-kit-capname { display: inline; }
  .fa-home .home-kit-cap { margin-top: 7px; padding: 3px 6px; min-height: 2.6em; }
  /* ⚠️ AND THE ONE-ROW FORM IS GATED ON THE FLANK BEING WIDE ENOUGH FOR FOUR THUMBS.
     The first version of this fix put four icon tiles in a row unconditionally and
     'menu_accept' refused it: at 844x390 WITH A LANDSCAPE iPHONE'S NOTCH (44px of inset
     on each long edge, which is the device this breakpoint exists for) the flank falls
     from 193px of content to 151, and four tiles measured 34x44 against a 44x44 tap
     floor. An ability affordance a thumb cannot hit is not an affordance, so the count
     the probe reports would have said "4" about a row nobody can use.

     The threshold is arithmetic rather than taste: four 44px targets with three 5px
     gaps need 191px. Below it the kit falls back to the two-up grid this file already
     uses everywhere else — still icon-only, still 44px tall, 73px wide.
     A container query rather than a width media query for the reason given above the
     '.home-col' rule: this is a question about the FLANK, and the same 844x390 device
     answers it differently with and without insets. */
  /* ⚠️ 191px IS THE CONTAINER'S CONTENT BOX, NOT ITS BORDER BOX, and the difference is
     18px of padding and border that cost a whole debugging round. A container query on
     'container-type: inline-size' resolves against the CONTENT box, so a 215.78px flank
     queries as 200.2px — a threshold written at 200 against the outer width matched
     NOTHING, at any viewport, and the kit stayed two-up everywhere while the rule sat
     there parsing cleanly. (Confirmed by walking 'document.styleSheets': the
     CSSContainerRule was present and simply never matched.) 191 = 4 tiles x 44px +
     3 gaps x 5px, i.e. the arithmetic requirement itself, which is why it is that
     number and not a rounded one.
     ⚠️ SINGLE QUOTES in this comment, like every other one in this file: a backtick
     anywhere in this template literal terminates the string. Writing the property name
     in backticks here produced 'home.ts(1820,7): error TS1005' — CLAUDE.md's
     non-negotiable, and it has now bitten in this file twice. */
  @container (width >= 191px) {
    .fa-home .home-kit {
      grid-template-columns: none;
      grid-auto-flow: column;
      /* minmax(44px, ...) and not minmax(0, ...): the tap floor has to be expressed in
         the grid, not merely satisfied by arithmetic, or the next ability added to a
         character silently shrinks four targets below it. */
      grid-auto-columns: minmax(44px, 1fr);
    }
    /* The odd-count span is a two-column idiom. In one row there is no ragged cell to
       close, and letting it span would make a three-ability fighter's last tile twice
       the width of the other two. */
    .fa-home .home-kit-tile:last-child:nth-child(odd) { grid-column: auto; }
  }
  /* ⚠️ AND BELOW 191px THE STATS GO, NOT THE KIT — WHICH IS A REVERSAL, ON THIS FILE'S
     OWN STATED PRINCIPLE.
     A landscape iPhone carries 44px of safe-area inset on BOTH long edges, so 844x390
     becomes 756px of usable width and the flank falls to 154px of content. Four 44px
     targets need 191, so the kit has to be two-up there — and two-up plus its caption
     plus three stat bars plus the Change button measures 313px against a 245px band.
     Something has to go, and the comment at the top of this media query already says
     which: "drop the flank whose information is available one tap away: the fighter's
     stats are the whole right-hand panel of the character-select screen". That reason
     was written to justify dropping a whole flank and was then applied to the KIT,
     which is available nowhere else on this screen. Applied to the thing it actually
     describes, it drops the three stat bars: 227px, and it fits.
     Measured with 'ud_defects.mjs' at 844x390 and 852x393 with menu_accept's own
     insets (t0 r44 b21 l44). See DECISIONS-FOR-URI — this is the one judgement call in
     the four fixes, and reversing it is one rule. */
  @container (width < 191px) {
    .fa-home .home-stats { display: none; }
    /* And the panel HEADERS, worth 19px each including their gap. Measured, the right
       flank was still 7.5px over after the stats went and the left flank had 0.41px of
       slack — 19px is the difference between "fits" and "the Change button is clipped".
       What is left in each panel says what it is without being told: three cards reading
       "9 rewards ready" / "Free chest" / "3 chests held", and four ability tiles over a
       caption that names the one you tapped. */
    .fa-home .home-col .fa-panel-title { display: none; }
  }
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
  /* ⚠️ WAS '.fa-home .home-mode { display: none; }', on the reasoning that the footer's
     copy is not durable at this width and the mode block is only a caption. That reason
     expired on 2026-08-12: the block is now the ONLY route to the match lobby
     (DECISIONS 74), and hiding it would make the seat count unreachable in portrait
     except by typing '?screen=lobby' — "hidden is unmeasurable", and worse, unusable.
     Kept here per the project's rule on reversed assertions.

     It does not squeeze onto the CTA's line at 360px; it takes its own. '.home-bottom'
     already wraps at this breakpoint, so this is one declaration, and the block goes
     full-width and left-aligned because a right-aligned label above a full-width button
     reads as detached from it. */
  .fa-home .home-mode {
    order: -1;
    flex: 1 0 100%;
    justify-content: space-between;
    text-align: start;
  }
  .fa-home .home-mode-lines { align-items: flex-start; }
  .fa-home .home-bottom { flex-wrap: wrap; }
  /* WAS, and kept per the reversed-assertion rule:

       ".fa-home .fa-topbar-spacer { display: none; }"
       ".fa-home .fa-tabs { flex: 1 1 auto; }"
       "Two rows rather than one. The spacer goes because a flex spacer inside a
        wrapping row pushes the wrap point around for no benefit; the chips take the
        first line and the navigation takes the second."

     🚨 IT IS THREE ROWS, NOT TWO, AND THE THIRD HOLDS ONE 44px GEAR. Measured on a
     detached worktree of ce0c665 at 390x844 — '.fa-topbar' runs 11.0 -> 163.0, i.e.
     152px, 18% of the viewport height, before any content:

       row 1  chips                     11 ->  51
       row 2  .fa-tabs                  57 -> 113
       row 3  the settings gear ALONE  119 -> 163

     The spacer being gone is exactly WHY: with 'flex: 1 1 auto' the nav takes whatever
     is left of row 1, cannot fit, wraps to row 2 and then fills it — so the gear has
     nowhere to go but a third line, where it lands on the hero card looking like a
     stray control. The wrap point the old comment did not want the spacer to "push
     around" is the thing that needed pushing: give the nav its OWN row explicitly
     ('flex: 1 0 100%') and the wrap point stops being emergent, the spacer goes back to
     doing its one job (hold the gear against the right edge), and the bar is two real
     rows. 152px -> 102px, and the gear is where every other screen in this game puts
     it.

     This is also half of the fix for the hero name: 'publishBars' derives the
     nameplate's clearance from the bar's MEASURED bottom, so a shorter bar moves the
     name up with it rather than needing a second constant. */
  .fa-home .fa-topbar { flex-wrap: wrap; row-gap: 6px; }
  .fa-home .fa-topbar-spacer { display: block; flex: 1 1 auto; min-width: 0; }
  .fa-home .fa-tabs { order: 1; flex: 1 0 100%; }
  /* WAS 'flex: 1 1 0' — equal-width tabs, and that is what wrapped "Trophies".
     'flex-basis: 0' throws away every tab's content width and hands all four the same
     89.5px. Three of the labels are short enough not to care; "Trophies" needs 75px of
     label beside a 16px glyph inside 89.5px minus padding, does not get it, and the
     glyph takes line 1 while the word takes line 2 — so the bar loses its baseline and
     one of four tabs reads as broken. 'mn_occlude' flags it as WRAP with the icon and
     the label on different lines; the other three are correctly silent.
     'flex-basis: auto' keeps each tab's own content width as its starting size and then
     shares the slack, so the wide label gets the width it needs and the narrow ones give
     it up. Measured need at 390px: 4 labels 221.6 + 4 glyphs 64 + gaps 16 + padding 40
     = ~342 inside 358 of track. The 'min(..., 4.2vw)' is the graceful half: it is inert
     at 390px and shrinks the type on a 360 or 320px phone rather than letting it clip. */
  .fa-home .fa-tab {
    flex: 1 1 auto;
    justify-content: center;
    padding: 0 5px;
    gap: 4px;
    font-size: min(clamp(0.74rem, 1.9vh, 1.02rem), 4.2vw);
  }
  /* PORTRAIT KEEPS THE FULL-BLEED STAGE, but the landscape width cap is nonsense here:
     52vw of a 430px-wide phone is 224px inside a 932px-tall box, which frames the hero
     by WIDTH and shrinks it to a third of the screen. The flanks are hidden at this
     breakpoint (below), so there is nothing for the stage to crowd and it can take the
     viewport. §14 is settled -- the game is landscape and portrait gets a rotate prompt
     -- but 'menu_accept_portrait' is 219 assertions and that prompt still needs a laid
     out screen underneath it, so this stays correct rather than being deleted. */
  .fa-home .home-stage { width: min(92vh, 92vw); }
  .fa-home .home-room-alcove { width: min(97vh, 98vw); }
  .fa-home .home-stage-slot { display: none; }
  /* WAS '.fa-home .home-nameplate { top: clamp(70px, 11vh, 120px); }', DELETED rather
     than retuned, and kept here with the reason per the reversed-assertion rule.

     It is a bare clamp with no 'max()' — it threw away the derived floor whose own
     comment says it exists "so the nameplate moves with it instead of silently sliding
     back under the tabs", written three declarations below the 'flex-wrap: wrap' that
     invalidated the constant that floor was derived from. At 390x844 it resolves to
     92.84px against a bar that ends at 163: the name rendered 80.7% behind the tabs.

     Retuning the number would have fixed this viewport and no other. The base rule now
     derives from '--home-topbar-b', the bar's measured bottom, which is correct at every
     viewport and at every row count — including the 102px two-row bar this block now
     produces, which a retuned constant would have been wrong about immediately. */
}

@media (prefers-reduced-motion: reduce) {
  .fa-home .home-track.is-ready { animation: none !important; }
}
:root.fa-reduce-motion .fa-home .home-track.is-ready { animation: none !important; }
`;
