/**
 * Opening / title card.
 *
 * ── Why this screen exists at all ───────────────────────────────────────────
 * Two reasons, and only one of them is decoration.
 *
 *  1. **It collects the first user gesture.** Every browser blocks Web Audio until
 *     the page has been touched, so until now the theme started on "the first click
 *     anywhere" — which in practice meant the player's first tap on START GAME, or
 *     their first shot in a match, or never. `main.ts` fires `audio.music.play()`
 *     unconditionally at boot precisely because it expects to be refused. A title
 *     card with one obvious control turns that accident into a designed moment: the
 *     tap that starts the game is the tap that unlocks the sound.
 *  2. It is the first frame of the product, and the product had none.
 *
 * ── Skippable, and it cannot trap you ───────────────────────────────────────
 * A splash you cannot skip is hostile, so this one is skippable three ways: the
 * START button, any key, and a pointer press anywhere on the screen. It also
 * auto-continues after `HOLD_MS`, which is a safety net rather than a feature — an
 * automated probe that navigates to `/` and waits for the home screen must never
 * hang on a title card, and a player who walked away must not come back to one.
 * The hairline under the button fills over exactly that time, so the auto-continue
 * is visible rather than surprising.
 *
 * ── The hero is the real model ──────────────────────────────────────────────
 * `reference/prototypes/food-fight-arena-opening.html` puts a hand-drawn SVG burger
 * centre stage. This puts the player's actual equipped fighter there, rendered by
 * the same `Stage` the match uses, via the same shared `charStage` singleton the
 * home screen is about to re-parent — so the character is already on screen and
 * already lit when home builds itself around it, and the whole boot costs one WebGL
 * context rather than two.
 *
 * The prototype's chef silhouette and animated fries are deliberately NOT rebuilt:
 * both were placeholder art for characters that either exist as real models now
 * (so a drawing of them would be worse) or do not exist at all (so drawing them
 * would advertise a fighter nobody can play — the exact defect two blind critics
 * punished on the home screen).
 */

import { audio } from '../../audio';
import { CHARACTER_IDS } from '../../game/rules';
import { icon, ensureIconStyles } from '../icons';
import type { Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { el } from './fx';
import { getCharacterStage } from './charStage';

/** Milliseconds before the title card continues on its own. See the header. */
const DEFAULT_HOLD_MS = 4500;

/**
 * The tagline's roster count, COUNTED rather than typed.
 *
 * It read "Eleven fighters." as a literal — true today, and the first line of the
 * product is the worst possible place to keep a number the model does not compute.
 * `shop.ts` already states the rule in its own notice ("the roster size is counted,
 * not typed, so an eleventh-and-a-half character cannot make this sentence wrong")
 * and this screen was the one place still breaking it. The same class of defect has
 * been found three times here — a stat card showing `health`/`speed` the sim did not
 * have, a shop promising "better" for a rarity that stopped granting power, and every
 * "hours to unlock" figure wrong by 4.7x from a leftover literal.
 *
 * Spelled out to 20 because "Eleven fighters" is the line's voice and "11 fighters"
 * is not; past that the digits read fine and the words do not.
 */
const NUMBER_WORDS = [
  'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen', 'Twenty',
] as const;

function spellCount(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/**
 * `?hold=<ms>` — QA only, the same spirit as `?simSpeed=` in `match.ts`.
 *
 * The acceptance test has to audit this screen's LAYOUT (tap targets, safe areas,
 * hero framing) on five viewports, and a screen that navigates away after 4.5s races
 * every one of those measurements. Rather than make the test fast enough to win that
 * race — which is how a suite becomes flaky — it holds the card open. The auto-
 * continue itself is then asserted separately, at its real duration.
 */
function holdMs(): number {
  const raw = new URLSearchParams(location.search).get('hold');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOLD_MS;
}

export function createOpeningScreen(ctx: ScreenContext): Screen {
  injectStyles('fa-opening-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen fa-opening');
  const stage = getCharacterStage();

  root.innerHTML = `
    <header class="open-head">
      <h1 class="open-title">Food Fight Arena</h1>
      <p class="open-tagline">${spellCount(CHARACTER_IDS.length)} fighters. One kitchen. No table manners.</p>
    </header>

    <div class="open-stage">
      <div class="open-stage-3d" data-el="stage3d"></div>
      <div class="open-glow"></div>
    </div>

    <footer class="open-foot">
      <button class="fa-btn fa-btn--primary open-start" type="button" data-el="start">
        ${icon('play')} Tap to start
      </button>
      <div class="open-timer" aria-hidden="true"><span class="open-timer-fill" data-el="timerfill"></span></div>
    </footer>
  `;

  const q = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(`[data-el="${sel}"]`);
    if (!node) throw new Error(`opening: missing element "${sel}"`);
    return node;
  };

  const stageHost = q<HTMLDivElement>('stage3d');

  let entered = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Leave the title card.
   *
   * Idempotent, because it is wired to four things at once (button, window key,
   * window pointer, timeout) and at least two of them fire for a single tap on the
   * button. A second call must not queue a second navigation — the shell guards
   * against overlapping swaps too, but relying on that would make this screen's
   * correctness depend on the router's.
   */
  function enter(): void {
    if (entered) return;
    entered = true;
    if (timer !== null) { clearTimeout(timer); timer = null; }

    // THE POINT OF THIS SCREEN. `unlock()` is safe to call whether or not we are
    // inside a real gesture — the engine simply retries on its own listeners if the
    // browser refuses. `music.play()` re-states the intent that `main.ts` already
    // registered at boot and that was almost certainly refused there.
    audio.unlock();
    audio.music.play();

    ctx.navigate({ name: 'home' });
  }

  // Any key, any press. Capture phase so a press that lands on decorative,
  // pointer-events:none chrome still counts — the promise on screen is "tap to
  // start", not "tap this exact 200px pill".
  const onKey = (ev: KeyboardEvent): void => {
    // Tab must still move focus; a screen with one control is exactly where a
    // keyboard user is most likely to press it.
    if (ev.key === 'Tab') return;
    enter();
  };
  const onPointer = (): void => enter();
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('pointerdown', onPointer, true);
  q<HTMLButtonElement>('start').addEventListener('click', enter);

  const hold = holdMs();
  timer = setTimeout(enter, hold);
  // Drive the hairline off the same number, in one place, so the bar cannot promise a
  // different deadline from the one the timer actually keeps.
  const fill = q<HTMLSpanElement>('timerfill');
  fill.style.transition = `width ${hold}ms linear`;
  requestAnimationFrame(() => { fill.style.width = '100%'; });

  stage.show(ctx.profile.selected);
  stage.attachTo(stageHost);

  return {
    root,
    update(dt) { stage.update(dt); },
    resize() { stage.resize(); },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
      stage.detach();
      root.remove();
    },
  };
}

const CSS = `
.fa-opening {
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: center;
  text-align: center;
}

.fa-opening .open-head { display: flex; flex-direction: column; align-items: center; gap: 2px; }

/* Not '.fa-title': that one is sized for a screen HEADING and clips to one line with
   an ellipsis, which is wrong for the one piece of type on this screen that is
   allowed to be the loudest thing in the frame. The 2 degree tilt is the
   prototype's, and is the single detail that stops a centred sans-serif wordmark
   reading as a placeholder. */
.fa-opening .open-title {
  margin: 0;
  font-family: 'Rubik', sans-serif;
  font-weight: 900;
  font-size: clamp(1.5rem, 7.2vh, 4rem);
  line-height: 1.02;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: var(--cream);
  transform: rotate(-2deg);
  -webkit-text-stroke: 4px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 5px 0 var(--ink), 0 12px 22px rgba(0,0,0,0.4);
  animation: fa-open-slam 0.44s cubic-bezier(0.2, 1.5, 0.35, 1);
}
@keyframes fa-open-slam {
  from { opacity: 0; transform: rotate(-2deg) scale(1.5); }
  to { opacity: 1; transform: rotate(-2deg) scale(1); }
}

.fa-opening .open-tagline {
  margin: 0;
  font-family: 'Heebo', sans-serif;
  font-weight: 800;
  /* Sized to be read from across a room, like the wordmark above it. At the round-1
     size it rendered ~13px under a 64px title and read as a caption on a poster. */
  font-size: clamp(0.72rem, 2.5vh, 1.3rem);
  letter-spacing: 0.01em;
  color: var(--cream);
  -webkit-text-stroke: 2px var(--ink);
  paint-order: stroke fill;
  text-shadow: 0 3px 0 var(--ink);
  transform: rotate(-1deg);
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
/* The portrait context paints its own backdrop (see charStage.ts). On the HOME screen
   that is fine — it is framed as a display case. Here it must not be: a hard rectangle
   of someone else's world in the middle of a title card reads as a video player. So the
   canvas is MASKED to an ellipse that fades out well before its own edge, which turns
   the same pixels into a lit spotlight standing in the menu's world. The mask is on a
   wrapper rather than the canvas so charStage's own sizing is untouched.
 *
 * ── Retuned for the 3D set ──────────────────────────────────────────────────
 * These numbers were authored against a FLAT, bright cyan clear colour. charStage now
 * builds a real lit set — cyclorama, floor, horizon — which is a large win everywhere
 * it is framed as a stage (it flipped the cast's figure/ground polarity from -0.23 to
 * +0.19; LESSONS §13) and a loss in exactly one place: here, where the set is supposed
 * to be invisible. Against a deep-blue cyclorama the old generous ellipse showed a cool
 * smudge with a horizon line running across it, mid-title-card.
 *
 * The fix is NOT simply a smaller ellipse. The mask cuts the CHARACTER as well as the
 * set, and the fighter spans roughly 24-76% of this box, so pulling the opaque core in
 * far enough to hide the horizon starts dissolving the arms. Instead the ellipse keeps
 * enough radius to hold the fighter and the transition is made much steeper — opaque
 * where the fighter is, gone within a short band after it — and the warm rim that beds
 * the patch into the card is roughly doubled and pulled inward to meet it.
 *
 * ── That trade is now MEASURED, and both alternatives are closed ────────────
 * NOTE the single quotes below. This comment sits inside a CSS template literal, and one
 * backtick in it terminates the string — docs/LESSONS.md section 9, which has now bitten
 * eight times and bit here while this very paragraph was being written.
 *
 * The paragraph above was an argument. tools/tmp/openglare.mjs turns it into numbers:
 * shoot the stage box, hide the canvas, shoot it again, and every pixel that MOVED is a
 * pixel the stage delivered — so the warm CARD showing through a transparent part of the
 * mask can never be mistaken for the fighter. (The first version of that probe made
 * exactly that mistake and its own control caught it: the tighter the mask, the more
 * "fighter" it reported. docs/LESSONS.md section 13.)
 *
 * Cool pixels use home_metrics.mjs's own backdrop rule, so the number means the same
 * thing it means on the two other screens that mount this stage. Drift control (two
 * frames, same conditions, the idle sway alone): coolShare ±0.14 pp, warm ±0.45%.
 *
 *     desktop 1600x900         coolShare   fighter+podium px
 *     shipped                      6.15%             168,306
 *     tighter core (56%/38%)       1.88%             116,270   -31%   <- cuts the fighter
 *     tighter still (50%/30%)      0.73%              73,572   -56%
 *     steeper falloff              3.28%              89,806   -47%
 *
 * **Every mask that removes the blue removes the character with it**, by 60x the drift
 * floor. The shipped values are where this lever runs out, and they are correct.
 *
 * The other lever — warming the rim instead of cutting — was priced in the same run and
 * REJECTED on the pixels rather than on the numbers, which is the point of looking:
 * a 0.30 warm veil takes coolShare 7.62% -> 2.16% and loses no geometry at all, and
 * shots/open/phone-portrait-glow-warm-veil-30.png shows it desaturating the hero into
 * a sticker behind frosted glass — spending exactly the figure/ground charStage was
 * built to win (-0.23 to +0.19).
 *
 * So the residual cool is not this file's to remove. What WOULD remove it is a per-mount
 * backdrop colour on the shared stage — a warm cyclorama for the title card only — which
 * lives in charStage.ts. Parked in docs/DECISIONS-FOR-URI.md. */
/* 54vh, not 70vh — and this is the second half of the same fix.
 *
 * charStage frames the fighter off whichever axis binds, so every pixel of panel width
 * past what the fighter needs is guaranteed to be backdrop. That is exactly the defect
 * menu_accept's hero-fills-its-panel floor exists to catch (see MIN_HERO_WIDTH_FRAC,
 * written for the home screen's identical problem), and with the new 3D set behind it
 * the title card had drifted under that floor at 844x390 with a notch: character width
 * over panel width measured 0.396-0.417 against a 0.42 minimum.
 *
 * Swept rather than guessed (tools/tmp/openwidth.mjs, four viewports x six widths,
 * worst-of-six samples per point because the idle animation sways the arms by ~0.03):
 *
 *     width      phone+notch   phone    desktop   tablet    fighter height frac
 *     70vh       0.414 FAIL    0.452    0.515     0.486     0.53
 *     58vh       0.470         0.524    0.578     0.555     0.55
 *     54vh       ~0.545        ~0.59    ~0.65     ~0.62     0.54
 *     46vh       0.678         0.733    0.777     0.775     0.48  <- knee
 *
 * Below ~46vh the height fraction collapses: width starts binding and the fighter
 * itself shrinks, which is the opposite of the point. 54vh sits well clear of that
 * knee with the fighter the same size it always was, and clears the floor by 0.125 at
 * the worst viewport — margin the noise cannot eat.
 *
 * It also happens to be the fix for the OTHER opening-screen problem: the set is drawn
 * to this box, so a narrower box is less visible set. */
.fa-opening .open-stage {
  position: relative;
  width: min(100%, 54vh);
  height: 100%;
  min-height: 0;
}
/* Radii re-expressed as a fraction of the NARROWER box, so the mask's absolute size on
   screen is unchanged: it still goes fully transparent inside the element (0.80 x 62%
   = 49.6% from centre), which is what keeps the box's own corners from showing a faint
   rectangle of cyclorama. */
.fa-opening .open-stage-3d {
  position: absolute;
  inset: 0;
  -webkit-mask-image: radial-gradient(62% 58% at 50% 54%, #000 46%, rgba(0,0,0,0.40) 64%, transparent 80%);
  mask-image: radial-gradient(62% 58% at 50% 54%, #000 46%, rgba(0,0,0,0.40) 64%, transparent 80%);
}
/* Warm rim, so the cool spotlight is bedded into the warm backdrop rather than
   sitting in a hole cut out of it. */
.fa-opening .open-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(64% 60% at 50% 54%, rgba(255,196,96,0.30) 20%, rgba(255,190,86,0.52) 66%, rgba(255,170,60,0.22) 84%, transparent 95%);
  /* soft-light rather than a plain overlay: it warms the cool set that is still
     visible immediately behind the fighter — the part no mask can remove without
     cutting the fighter too — while barely moving an already-saturated warm bun. */
  mix-blend-mode: soft-light;
}

/* ── Start ────────────────────────────────────────────────────────────────── */
/* The extra bottom padding is for the hairline, which is 4px tall and would otherwise
   sit flush against the frame edge — where a rounded phone corner or a home indicator
   eats it. */
.fa-opening .open-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding-bottom: 10px;
}
.fa-opening .open-start { min-width: clamp(180px, 30vw, 340px); }

/* The auto-continue deadline, made visible. A splash that moves on by itself with
   no warning reads as a crash; the same behaviour with a 3px line reads as a
   trailer. */
.fa-opening .open-timer {
  width: clamp(120px, 22vw, 260px);
  height: 9px;
  border-radius: 999px;
  border: 2px solid var(--ink);
  background: rgba(26,18,36,0.4);
  overflow: hidden;
}
.fa-opening .open-timer-fill {
  display: block;
  width: 0%;
  height: 100%;
  border-radius: 999px;
  background: var(--cream);
}

/* The bar's TRANSITION is stopped but the timer behind it is not — the auto-continue
   is a safety net, and silently removing it under a motion preference would leave a
   player who cannot see it stuck on a title card. It simply jumps to full instead. */
@media (prefers-reduced-motion: reduce) {
  .fa-opening .open-title { animation: none !important; }
  .fa-opening .open-timer-fill { transition: none !important; }
}
:root.fa-reduce-motion .fa-opening .open-title { animation: none !important; }
:root.fa-reduce-motion .fa-opening .open-timer-fill { transition: none !important; }
`;
