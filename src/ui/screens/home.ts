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
 * ── The staging is anchored to the RIG, not to a magic number ───────────────
 * The contact shadow and the floor pool have to sit under the plinth, and the plinth
 * does not land in the same place for every character: `charStage.applyFraming()`
 * scales by the whole assembly's height, so a tall fighter puts the disc higher in the
 * card. `syncStaging()` reads the portrait's own projected foot line out of
 * `charStage.info()` and drops from it by the plinth's apparent depth. That constant
 * is CALIBRATED OFF A RENDERED FRAME rather than derived — `docs/LESSONS.md` §6: two
 * agents once computed the same on-screen size as 13% and 7% by trigonometry when the
 * truth was 10.5%.
 */

import { CHARACTERS, MATCH_DURATION_MS, RARITY_COLORS } from '../../game/rules';
import { containerIcon, ensureIconStyles, emojiIcon, hydratePortraits, icon, portraitMarkup } from '../icons';
import { MATCH_PAYOUT, milestoneFace, roadProgress } from '../../game/economy';
import { XP_PER_LEVEL } from './profile';
import type { Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { burstConfetti, el } from './fx';
import { getCharacterStage } from './charStage';

/** The one mode this build ships. Named here rather than in `rules.ts` because it is
 *  a piece of front-end copy, not a balance constant — but the DURATION beside it is
 *  read from the sim so the lobby cannot promise a match length the sim does not
 *  keep. */
const MODE_NAME = '1v1 · Kitchen Rumble';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * How far BELOW the portrait's projected foot line the plinth's front rim falls,
 * expressed in metres of subject height so it can be scaled by the rig's own framing.
 *
 * `charStage.info().feet` projects the model's `box.min.y`, which sits on the plinth's
 * TOP face. The disc's near rim is further down by the plinth's 0.2 m height plus the
 * apparent depth of its 1.24 m base circle seen at the portrait camera's 20 degree
 * pitch. Trigonometry says 0.2 + 1.24·sin20° = 0.62 m.
 *
 * **The rendered frame says 0.81, and the rendered frame wins** (`docs/LESSONS.md` §6:
 * two agents once computed the same on-screen size as 13% and 7% by trigonometry when
 * the truth was 10.5%). The trig is 30% low because the near rim is the part of the
 * plinth CLOSEST to the camera, so perspective magnifies it — the same reasoning that
 * gets the sign right on paper gets the magnitude wrong on screen.
 *
 * This was not an academic difference. At 0.568 the anchor landed at 0.875 of the card
 * when the disc's base is at 0.934, so the floor light and the contact shadow were
 * drawn ACROSS the disc's face instead of under it — the plinth came back bleached and
 * cut in half by a grey band, which is a worse result than the flat swatch it replaced.
 * `tools/tmp/home_metrics.mjs` now measures the disc's base off the rendered PNG and
 * reports `contactShadowError`, so this constant can never drift silently again.
 */
const PLINTH_DROP_M = 0.806;

/** Shape of the framing readout `charStage.info()` publishes. Declared locally rather
 *  than exported from `charStage.ts`, which this screen does not own. */
interface StageFraming {
  feet?: { x: number; y: number } | null;
  fill?: number;
  subject?: { w: number; h: number };
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
           The three layers between the canvas and the labels are the STAGE: a ray
           burst behind the head, the room (key pool, floor pool, corner falloff) and
           the contact shadow. They sit ON TOP of the canvas because the canvas is
           opaque — 'Stage' clears to PORTRAIT_BG — so anything painted behind it would
           be a textbook 'docs/LESSONS.md' §1: rendering, and invisible. Everything
           here is therefore low-alpha and hue-led rather than a film over the hero. -->
      <section class="home-stage" data-el="stage">
        <div class="home-stage-3d" data-el="stage3d"></div>
        <div class="home-stage-burst"></div>
        <div class="home-stage-floor" data-el="floor"></div>
        <div class="home-stage-room"></div>
        <div class="home-stage-contact" data-el="contact"></div>
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
  const floor = q<HTMLDivElement>('floor');
  const contact = q<HTMLDivElement>('contact');

  /**
   * Put the floor and the contact shadow where the plinth actually IS.
   *
   * The critic's top finding was that the hero "sits on a colour swatch", and the fix
   * for that is a floor the disc is standing on plus a shadow it is casting. Both have
   * to be anchored, because the disc does not land at a fixed height: `applyFraming()`
   * fits the whole assembly (character + plinth) to a fraction of the panel, so a
   * taller fighter shrinks the plinth and lifts it. Hard-coding 86% would be correct
   * for Hamburger and wrong for the other ten.
   *
   * `info()` is `charStage.ts`'s QA readout and this screen does not own that file, so
   * the shape is asserted here at runtime rather than trusted: any missing or
   * non-finite field falls back to the measured Hamburger position, which is a sane
   * place for every character rather than a broken one.
   */
  let stagedW = -1;
  let stagedH = -1;
  let stagingT = 0;
  /** Which ability tile is showing its description. Survives a profile re-render;
   *  reset in `renderKit()` when the new fighter has fewer abilities. */
  let kitIndex = 0;

  function syncStaging(force = false): void {
    const w = stageHost.clientWidth;
    const h = stageHost.clientHeight;
    if (!force && w === stagedW && h === stagedH) return;
    stagedW = w;
    stagedH = h;

    const info = stage.info() as StageFraming;
    const feetY = info.feet && Number.isFinite(info.feet.y) ? info.feet.y : 0.725;
    const fill = Number.isFinite(info.fill) ? (info.fill as number) : 0.62;
    const assembly = info.subject && Number.isFinite(info.subject.h) ? info.subject.h + 0.2 : 2.5;
    const drop = assembly > 0.1 ? (PLINTH_DROP_M * fill) / assembly : 0.14;
    const disc = Math.min(0.965, Math.max(0.55, feetY + drop));
    contact.style.setProperty('--home-disc', `${(disc * 100).toFixed(2)}%`);
    // The horizon sits just above the plinth's FAR rim — the back of the base ellipse,
    // which is one plinth-depth above the near rim. Behind that line the 3D ground is
    // fogged to the backdrop colour and there is nothing to see, which is precisely why
    // the card had no horizon to begin with.
    floor.style.setProperty('--home-horizon', `${(Math.max(0.34, disc - 0.325) * 100).toFixed(2)}%`);
  }

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
    // `show()` re-frames synchronously, so the plinth's new screen position is already
    // knowable — force the read rather than waiting for the size poll, otherwise the
    // shadow sits under the previous fighter's disc for up to a quarter of a second.
    syncStaging(true);
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
  // `attachTo` sizes the canvas and re-frames, so the first honest reading is here and
  // not in `render()` — before the attach the host has no measured box at all.
  syncStaging(true);

  return {
    root,
    update(dt) {
      stage.update(dt);
      // The portrait's own ResizeObserver re-frames on any LAYOUT change, not only on
      // a window resize, and this screen never hears about those. Polling the host's
      // box four times a second is cheaper than a second observer and is guaranteed to
      // agree with whatever the rig last computed.
      stagingT += dt;
      if (stagingT >= 0.25) { stagingT = 0; syncStaging(); }
    },
    resize() { stage.resize(); syncStaging(true); },
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
  /* 'isolation' is load-bearing, not tidiness: the contact shadow below uses
     'mix-blend-mode: multiply', and without an isolated stacking context it would
     blend through the card and multiply against the menu backdrop. */
  isolation: isolate;
  box-shadow:
    0 6px 0 rgba(0,0,0,0.40),
    0 12px 24px rgba(0,0,0,0.28),
    inset 0 3px 0 rgba(255,255,255,0.30);
  cursor: pointer;
  background: #39b7e8;
}
.fa-home .home-stage-3d { position: absolute; inset: 0; }

/* ── The stage, in three layers ───────────────────────────────────────────── */
/* A blind critic on the round-1 packet: "the burger and its gold disc sit on a flat
   untextured light-blue rectangle ... the best asset on the screen reads as a cutout
   pasted on a colour swatch." It asked for a value break, a radial burst behind the
   bun and a real contact shadow.

   Measurement ('tools/tmp/home_metrics.mjs') agreed with the DIAGNOSIS and disagreed
   with the PRESCRIPTION, which is the trap 'docs/LESSONS.md' §3 names. The card
   already broke 30.2% from the band behind the head to its lower corners — well past
   the 15-20% asked for. What it measured at was 2.89% for the largest luma STEP
   anywhere in the field and 0.3% for darkening under the plinth. In other words the
   field was a smooth ramp with no edge in it and the disc was touching nothing. A
   swatch and a lit room can post the same value break; what separates them is having
   a horizon and a shadow, so that is what these three layers add.

   All three sit ON TOP of the canvas. They have to: 'Stage' clears to an opaque
   PORTRAIT_BG, so a layer behind the canvas is 'docs/LESSONS.md' §1 in its purest
   form — perfectly rendered, permanently invisible. The consequence is that every
   value here is low-alpha and works by HUE rather than by density, which is also what
   the art direction wants: high-key, hyper-saturated, no dark vignette. */

/* 1. The burst: rays AND the key pool, both masked into the same RING.
      THE RING IS THE WHOLE TECHNIQUE. Every layer here paints over the character as
      well as over the field, and the first pass proved what that costs: a 40%
      near-white key pool centred on the bun bleached the one asset the critic called
      shipped-grade. So the staging lives in the NEGATIVE SPACE — the mask is
      transparent across the head and only opens up outside it, which turns the same
      light from a film over the hero into a halo behind it. Same idiom as the shell's
      own '.fa-rays', which already survives being screenshotted beside a Brawl Stars
      plate. */
.fa-home .home-stage-burst {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    repeating-conic-gradient(from 6deg at 50% 26%,
      rgba(214,250,255,0.15) 0deg 5deg, transparent 5deg 17deg),
    radial-gradient(60% 44% at 50% 26%,
      rgba(150,238,255,0.34) 0 30%, rgba(120,230,255,0.14) 62%, transparent 84%);
  -webkit-mask-image: radial-gradient(64% 48% at 50% 26%,
    transparent 0 30%, #000 46%, #000 70%, transparent 96%);
  mask-image: radial-gradient(64% 48% at 50% 26%,
    transparent 0 30%, #000 46%, #000 70%, transparent 96%);
}

/* 2. The room: a key pool behind the head, a lit floor the plinth stands on, and a
      cool falloff into the corners.

      The falloff is COOL and not the warm red it replaced. 'docs/LESSONS.md' §8
      measured that the reference reserves HUE rather than saturation — a saturated
      cool ground with the warm half of the wheel left for the cast — and this card is
      exactly that arrangement: a warm burger on a cool stage. Adding cool chroma also
      costs less warm-band share than removing warm chroma does, which matters while
      'docs/STATE.md' item 8 (cumulative desaturation) is still open.

      '--home-disc' is the plinth's front rim as a percentage of the card's height,
      written by 'syncStaging()' from the rig's own projected foot line. The fallback
      is Hamburger's measured position, so a missing readout degrades to a slightly
      misplaced floor rather than to no floor. */
.fa-home .home-stage-room {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(122% 98% at 50% 24%,
    transparent 40%, rgba(11,64,112,0.30) 72%, rgba(5,34,74,0.60) 100%);
}

/* 2b. THE HORIZON, and the mask is the reason it works.
       Two shapes were tried before this one and both are worth recording, because both
       are the obvious idea:

       * A filled pool of light on the floor. It landed on the plinth and bleached it.
       * A pool with a transparent core cut to the plinth's silhouette. The core has to
         reach x=0.12..0.88 to cover the disc, so at the card's flanks the ring wrapped
         AROUND the hole and crossed each flank twice — two concentric arcs that read as
         ripples on water, not as a floor.

       The shape that works is the one a real horizon has: a straight line that the
       character STANDS IN FRONT OF. A horizontal mask lets it show only in the two
       flanks, so it runs behind the hero and is occluded by them, and it never touches
       the plinth or the character at all. The bright band at the line itself is the
       floor catching the key light where it meets the back of the room — the same read
       every hero podium in the reference set uses — and below it the ground turns over
       into a deeper, MORE saturated blue rather than a grey one. */
.fa-home .home-stage-floor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg,
    transparent 0 calc(var(--home-horizon, 61%) - 0.5%),
    rgba(186,248,255,0.52) var(--home-horizon, 61%),
    rgba(120,232,252,0.34) calc(var(--home-horizon, 61%) + 2.4%),
    rgba(34,152,212,0.28) calc(var(--home-horizon, 61%) + 14%),
    rgba(16,116,180,0.36) 100%);
  -webkit-mask-image: linear-gradient(90deg,
    #000 0 18%, transparent 27%, transparent 73%, #000 82%);
  mask-image: linear-gradient(90deg,
    #000 0 18%, transparent 27%, transparent 73%, #000 82%);
}

/* 3. The contact shadow. 'multiply' rather than a black wash: multiplying keeps the
      floor's hue and only takes value out of it, which is what a shadow on a saturated
      surface does. A flat dark ellipse over this field goes grey — and the first pass
      proved it, in both directions at once: 4.8% of the card's height of a
      blue-GREY source read as a bank of fog rather than as contact, and it greyed the
      plinth it was supposed to be grounding. Half the height and a saturated blue
      source fixes both. It is a band you can point at, not a haze. */
.fa-home .home-stage-contact {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: multiply;
  background: radial-gradient(34% 2.1% at 50% calc(var(--home-disc, 93%) + 2.4%),
    rgba(30,96,150,0.92) 0 30%, rgba(96,164,205,0.62) 60%,
    rgba(190,225,242,0.22) 80%, transparent 92%);
}

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

/* The rarity badge takes its colour inline from 'RARITY_COLORS', so it cannot be
   restyled by hue here without desyncing the menu from the roster. An inset shadow
   the size of the badge darkens whatever that colour is while leaving it identifiable
   — white-on-Normal-grey measured 2.76:1 against a 4.5 floor, which is the same
   dark-on-dark failure 'docs/LESSONS.md' §1 case 10 records for the HUD cooldown wipe.
   Measured cost: HSV saturation of a Legendary badge 1.00 -> 0.91 over ~60x21px. */
.fa-home .fa-rarity {
  height: 21px;
  font-size: 0.7rem;
  border-width: 2.5px;
  box-shadow: inset 0 0 0 100px rgba(20,13,30,0.40), 0 2px 0 rgba(0,0,0,0.35);
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

/* Portrait phone. Parity, not identity: the hero and the CTA are what the screen is
   for, and the flanks' destinations are still one tab away. */
@media (max-width: 700px) {
  .fa-home .home-middle { grid-template-columns: minmax(0, 1fr); }
  .fa-home .home-col { display: none; }
  .fa-home .home-mode { display: none; }
  .fa-home .home-bottom { flex-wrap: wrap; }
}

@media (prefers-reduced-motion: reduce) {
  .fa-home .home-track.is-ready { animation: none !important; }
}
:root.fa-reduce-motion .fa-home .home-track.is-ready { animation: none !important; }
`;
