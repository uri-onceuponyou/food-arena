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
 * free, so that is where the post-match menu button lives, inside
 * `env(safe-area-inset-*)`.
 *
 * ── ...and why the pause chip is NOT in that corner ─────────────────────────
 * The trade this header used to record as a future problem has arrived: `game/touch.ts`
 * ships twin FLOATING sticks, and the move stick spawns wherever a thumb lands
 * anywhere in the left half of the screen (`ZONE_SPLIT = 0.5`). A 44px chip parked at
 * the bottom-left corner is therefore sitting inside the move stick's own resting
 * position — a thumb reaching to walk hits Pause instead, mid-fight.
 *
 * Both lower corners belong to thumbs, so "move it to the other corner" is not
 * available; `hud.ts` had the identical problem with the radar and solved it by
 * moving UP the trailing edge. This does the mirror of that on the leading edge: the
 * chip sits directly under the player nameplate, which is the one band of the frame
 * that no HUD element and no thumb occupies.
 *
 * ── ONE position, not two ───────────────────────────────────────────────────
 * The first version of that fix moved the chip only under `html.fa-touch-capable` and
 * left it in the bottom-left corner everywhere else, on the reasoning that a mouse has
 * no thumb zone. That is true and it is still the wrong call: it made the game's one
 * escape hatch live in two different places depending on a capability bit the player
 * cannot see, and a hybrid laptop (touchscreen + mouse, which is the case
 * `game/input.ts` is explicitly built for) picks the touch layout while the player is
 * using the mouse. There is no reading of the frame in which the chip's position is
 * information, so it does not move. Measured cost of standardising on the raised
 * position: nothing — `tools/tmp/thumbzone.mjs` clears the zone in both states and
 * `tools/tmp/chip_probe.mjs` shows zero overlap with any HUD landmark at every
 * viewport, portrait and landscape.
 *
 * The post-match Menu button stays in the corner: it only exists after the match is
 * decided, when there is no stick to collide with.
 *
 * ── 🚨 ...AND ALL OF THAT WAS TRUE WHILE THE CHIP WAS EFFECTIVELY INVISIBLE ──
 * Uri asked for "a quit button in gameplay or the pause screen". Everything above had
 * already shipped, and the bundle deployed to GitHub Pages — the build he plays —
 * contains both the string "Quit to Home" and the class `match-chip`. So the request
 * was not for a missing control. It was `CLAUDE.md` rule 4 again: **it was rendering
 * and it was INVISIBLE.**
 *
 * Measured on a served snapshot at 390x844, six seats, mid-match: the chip's fill
 * against the ring of pixels immediately outside it came to **1.026:1**. One is
 * "identical". The plate was copied from `.hud-clock`, which gets away with it because
 * the clock is mostly large cream numerals; a 44px square whose entire ink is two 4px
 * bars does not. In portrait it sits in the letterbox band, which is very nearly its
 * own colour, so what the player saw was two floating tick marks and no button at all.
 *
 * The whole header above argues about the chip's POSITION, at length, with two
 * instruments behind it — and `chip_probe.mjs` and `thumbzone.mjs` both measure the
 * chip's RECT. **A rect is not a picture.** Neither tool could have failed on this, and
 * nothing anywhere asserted that pressing the control ends the match, tears the session
 * down or leaves the economy alone. `tools/tmp/qx_quit.mjs` is that assertion, at six
 * seats, portrait and landscape, with six known-bad arms.
 *
 * The fix is in the CSS block below (a two-tone edge, not a lighter fill — the reason
 * is measured there) and the boundary now reads **7.19:1 portrait / 3.73:1 landscape**
 * against a 3.0 floor, which is WCAG 2.1 SC 1.4.11 rather than a number invented here.
 *
 * ── ...and leaving now asks first ───────────────────────────────────────────
 * Both quiet buttons in the pause sheet abandon a live match, which banks NOTHING (the
 * profile write is gated on `phase === 'ended'`), and the top one sits one 10px gap
 * under Resume. See `showConfirm` for why the guard is temporal rather than geometric —
 * the geometric version was tried and measurement killed it.
 *
 * ── z-order ─────────────────────────────────────────────────────────────────
 * The HUD's game-over card draws a full-viewport scrim at z-index 20 with
 * `pointer-events: auto`. The screen layer sits at 40, so this screen's buttons stay
 * clickable on top of it — which is exactly what "match end → back to menu" needs.
 */

import { startGame, type GameSession, type MatchOutcome } from '../../game/match';
import type { MatchPayout } from '../hud';
import { CHARACTERS } from '../../game/rules';
import { MAX_FIGHTERS, MIN_FIGHTERS, type FighterRole, type MatchPhase } from '../../game/state';
import { brawlRoster } from './brawl';
// 🚨 THE LOADOUT'S LAST HOP. `loadEquipped` and `ownedItems` both live in `lobby.ts`
// because that is the file that WRITES the storage key, and a second reader with its own
// copy of the format is how the two come to disagree. Importing a screen from a screen is
// this directory's own precedent (`brawlRoster`, `placementXp` on the two lines either
// side of this one), and there is no cycle: `lobby.ts` does not import this file.
import { loadEquipped, ownedItems, rememberSeatCount } from './lobby';
import { placementXp } from './profile';
import type { Route, Screen, ScreenContext } from './types';
import { injectStyles } from './theme';
import { el } from './fx';
import { ensureIconStyles, icon } from '../icons';

/**
 * The key that opens and closes the pause sheet, as `KeyboardEvent.key`.
 *
 * Exported for `ui/screens/settings.ts`, whose Controls reference used to hard-code
 * the string "Esc" beside six other bindings it also hard-coded. Every one of those is
 * now read from the module that listens for it — `game/input.ts` owns movement, the
 * weapon digits and mute; this owns pause — so the reference cannot drift from the
 * game. See the header of `game/input.ts` for why that mattered enough to change.
 */
export const PAUSE_KEY = 'Escape';

/** `5` -> `5th`. The same rule `hud.ts` applies to the result card's finishing line. */
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

export function createMatchScreen(ctx: ScreenContext, route: Route): Screen {
  if (route.name !== 'match') throw new Error('createMatchScreen: wrong route');
  injectStyles('fa-match-styles', CSS);
  ensureIconStyles();

  const root = el('div', 'fa-screen-bare fa-match');
  root.innerHTML = `
    <!-- The chip is NOT inside .match-corner. It has to be positioned against the
         screen so it can sit clear of the thumb zone, and .match-corner is itself
         absolutely positioned — so nesting it there made 'top: 96px' resolve against
         the corner and put the chip 140px BELOW the bottom of the frame. Measured,
         not reasoned about: tools/tmp/thumbzone.mjs. -->
    <button class="match-chip" type="button" data-el="pause" aria-label="Pause">${icon('pause', { size: '22px' })}</button>

    <div class="match-corner">
      <button class="fa-btn fa-btn--quiet match-exit" type="button" data-el="exit">${icon('back')} Menu</button>
    </div>

    <div class="match-sheet" data-el="sheet">
      <div class="match-sheet-card">
        <div class="match-sheet-pane" data-el="pane-pause">
          <p class="match-sheet-title">Paused</p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="resume">${icon('play')} Resume</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="change">${icon('swap')} Change Fighter</button>
          <button class="fa-btn fa-btn--quiet" type="button" data-el="quit">${icon('home')} Quit to Home</button>
        </div>
        <div class="match-sheet-pane match-sheet-pane--confirm" data-el="pane-confirm" hidden>
          <p class="match-sheet-title">Leave the match?</p>
          <p class="match-sheet-body" data-el="confirmbody"></p>
          <button class="fa-btn fa-btn--primary" type="button" data-el="keep">${icon('play')} Keep Playing</button>
          <button class="fa-btn fa-btn--quiet match-leave" type="button" data-el="leave">${icon('close')} Leave</button>
        </div>
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
  /**
   * WHAT THIS MATCH'S ONE BANK PAID, as the card shows it — `null` until it has banked.
   *
   * 🚨 IT CAN BANK BEFORE THE WHISTLE NOW — the knocked-out seat at three or more (META-02).
   * `banked` used to be set only on `'ended'`, so a 5th- or 6th-place finisher could Quit while
   * spectating and keep every trophy (+84% trophies per match measured at 1,500 for "leave
   * whenever the delta is negative"), and a 3rd-place finisher who left threw their payout
   * away. The place is final at the knockout (`GameSession.notifyLocalResult` says why), so it
   * is banked THERE — through `bankOnce`, the same single site the whistle uses — and this
   * remembers what it paid so the whistle re-hands it to the card instead of banking again.
   *
   * Cleared with `banked` on every non-`'ended'` transition: a restart is a new match.
   */
  let paidOut: { payout: MatchPayout; place: number; seats: number } | null = null;

  /** The seat-range test the bank applies before it trusts a placement. Outside it the bank
   *  falls back to the old boolean path — see `bankOnce`. */
  const payable = (o: MatchOutcome | null): o is MatchOutcome => o !== null
    && o.localPlace >= 0 && o.seats >= MIN_FIGHTERS && o.seats <= MAX_FIGHTERS;

  /**
   * 🚨 THE ONE PLACE THIS SCREEN BANKS A MATCH — at the whistle, at a six-seat knockout
   * (`onLocalResult`), and on a Leave that forfeits a pending Leftovers revive.
   *
   * ⚠️ ONE SITE, NOT ONE PER CALLER, AND THAT IS THE DOUBLE-BANK DEFENCE. `recordPlacement`
   * mutates and commits the economy, so a second call is a silently doubled payout that looks
   * perfect on screen. `tools/tmp/rc_card.mjs` §F asserts this file has exactly two payout
   * calls — the two arms of the branch below — both after `banked = true`, inside
   * `if (!banked)`. The first cut of META-02 (`3d0cff0`) added a third call in a helper of its
   * own and both of §F's structural rows went red on it ("3 call sites"; the call before the
   * guard); this function is the answer, not a weakened check.
   *
   * After the guard it always re-hands what was paid: harmless before the whistle
   * (`GameSession.hudResult` gates the payout on `endedOutcome`), and at the whistle it is
   * what puts an EARLY bank's numbers on the card without banking them a second time.
   */
  function bankOnce(outcome: MatchOutcome | null, winner: FighterRole | null): void {
    if (!banked) {
      banked = true;
      // ── 🚨 THE PAYOUT JOIN ──────────────────────────────────────────────
      // This was `ctx.profile.recordResult(winner === 'player')` — a BOOLEAN, which
      // `profile.ts` forwards as `recordPlacement(won ? 0 : 1, MIN_FIGHTERS)`. So
      // **every match this product has ever played paid as a duel**, and the whole
      // 3-6 seat curve built in `DECISIONS §59` and wired through in `§61` was
      // unreachable from the game. At 500 trophies a six-player match paid 2nd, 3rd,
      // 4th AND 5th the LAST-PLACE rate — -5 trophies / 20 coins / 35 XP — instead of
      // 11/52/87, 7/44/74, 3/36/61 and -1/28/48. Priced over a real place
      // distribution that is **4.16-6.92 trophies, 11.1 coins and 18.0 XP per match**,
      // silently, every match. `tools/tmp/mp_join.mjs` is the gate and it is RED on
      // the line this replaces.
      //
      // ⚠️ THE FALLBACK IS THE OLD LINE, NOT A GUESS. A session that hands over no
      // outcome, or one whose seat count `trophyRoad.ts:placementRank01` would THROW
      // on, pays exactly what it paid before — correct at two seats, which is the only
      // seat count that path can reach. (The two pre-whistle callers only ever hand in a
      // `payable` outcome, so they can never reach this arm with no winner to read.)
      //
      // ⚠️ AND IT IS A NO-OP AT TWO SEATS BY CONSTRUCTION, NOT BY TUNING: at two seats
      // `resolvePlaces` returns [winner, loser], so `localPlace` is 0 or 1 and `seats`
      // is 2 — the exact arguments `recordResult` forwards. `mp_join.mjs` §B proves
      // that against the shipped boolean path at every standing rather than asserting
      // it.
      const paid = payable(outcome)
        ? ctx.profile.recordPlacement(outcome.localPlace, outcome.seats)
        : ctx.profile.recordResult(winner === 'player');

      // ── 🚨 AND NOW THE PLAYER IS TOLD WHAT IT PAID ────────────────────────
      //
      // `DECISIONS §64` defect 3: the payouts above became correct in `bb00d66` and
      // stayed **invisible** — a 3rd-of-6 finish banks +9 trophies, 44 coins and 74 XP
      // and the result card said none of it. `GameSession.showPayout` is the socket,
      // matching the one `48ad6ca` opened for the finishing PLACE.
      //
      // 🚨 **THE RETURN VALUE OF THE ONE BANK ABOVE, NEVER A SECOND CALL.** The payout
      // is applied as a SIDE EFFECT of banking — `recordPlacement` mutates the economy
      // and commits it — so a display that "looked up" what the match paid would bank
      // it twice, which looks perfect on screen and silently doubles every trophy the
      // player owns. That is why this reads `paid` and why nothing below the session
      // boundary can reach the economy at all.
      //
      // ⚠️ `paid.place`/`paid.seats` RATHER THAN `outcome`, deliberately: they are what
      // `applyMatchPlacement` actually banked (it stores its own arguments on
      // `LastMatch`), so the XP shown is the XP added even on the `recordResult`
      // fallback, where `outcome` is null or unpayable. `placementXp` is a pure
      // function of those two numbers — the same call `recordPlacement` just made, not
      // a second application of it.
      paidOut = {
        payout: { trophies: paid.trophies, coins: paid.coins, xp: placementXp(paid.place, paid.seats), chests: paid.chests },
        place: paid.place,
        seats: paid.seats,
      };
    }
    if (paidOut) session.showPayout(paidOut.payout);
  }

  // ── 🚨 DECISIONS §66'S FLAG, AND IT IS OFF UNLESS A ROUTE SAYS OTHERWISE ─────
  //
  // `route.seats` is OPTIONAL and ~~every shipped navigation omits it
  // (`characterSelect.ts:444` is the only one in the product)~~ — stale since 2026-08-12:
  // the lobby's Start sets it (`DECISIONS §74`), and the citation had drifted besides (both
  // found by META-03's verifiers). Every OTHER navigation omits it, so `roster` is `undefined`
  // and `startGame` takes the two-seat path with not one branch changed — `match.ts`
  // ignores the field entirely when it is absent.
  //
  // ⚠️ **THAT IS GUARDED IN TWO PLACES AND NEITHER OF THEM IS AN ARGUMENT.**
  // `tools/tmp/sp6_seats.mjs` §D is a source census — no screen but `main.ts` may set
  // `seats`, and `Route.match.seats` must stay optional; both are proved red by mutating the
  // real tree (`--selftest`, seven mutations, each required to fail the row it aims at).
  // ⚠️ §D's "no SCREEN sets `seats`" row has been RED since the lobby shipped (58/1 on
  // `f65af2c`, flagging `lobby.ts`): its `FLAG_OWNERS` was never widened after Uri answered
  // §66, and the tool is in no gate table, so nothing ran it. Routed, not edited here.
  // `tools/tmp/sp6_play.mjs` §A is the behavioural half: it boots the shipped URL with no
  // `seats` and requires exactly two plates, and its known-bad `--arm leak` appends
  // `&seats=6` — so the control is falsified by the on-state rather than by nothing, which
  // is the only thing that makes it a measurement of the FLAG and not of the number 2.
  //
  // ⚠️ **NO AFFORDANCE IS INVENTED HERE.** §66 asks three questions and only ONE of them
  // (which five characters) has a defensible default; **where the button lives** is Uri's,
  // and a "Brawl" tile guessed here would be a design decision shipped under a wiring
  // commit. So the flag arrives as a route field plus `?seats=`, exactly like `?player=`,
  // and when Uri answers, the affordance sets `seats` and nothing below this line moves.
  //
  // ⚠️ The rule that picks the other fighters is `./brawl.ts`, NOT this file — it is a
  // design default Uri may want to overrule and it has to be findable to be overruled.
  const roster = route.seats === undefined
    ? undefined
    : brawlRoster(route.player, route.enemy, route.seats);

  const session: GameSession = startGame({
    container: ctx.gameHost,
    hudRoot: ctx.hudRoot,
    playerCharacterId: route.player,
    enemyCharacterId: route.enemy,
    // `undefined` on every shipped navigation, which is identical to omitting the property:
    // `match.ts` reads `opts.roster && …`. Passed unconditionally rather than spread in, so
    // there is one call site to read rather than two shapes of one.
    roster,
    // ── 🚨 THE EQUIPPED LOADOUT, AND UNTIL 2026-09-02 THIS LINE DID NOT EXIST ────
    //
    // Ten items were implemented end to end — `combat.ts` resolves all ten effects, the
    // economy awards them, the lobby equips two and the choice survives a reload — and
    // **not one could reach a match**, because nothing on this screen ever read it.
    // `lobby.ts:LOADOUT_REACHES_MATCH` named this hop and the `GameSessionOptions.items`
    // hop as the only two missing; both are closed and that constant is now `true`.
    //
    // ⚠️ **READ AT MOUNT, EVERY TIME, RATHER THAN CACHED** — this runs on each navigation
    // into a match, so equipping in the lobby and pressing start picks the new pair up
    // with no invalidation to forget. `GameSession` then holds it for the life of the
    // session, so a `restart()` re-equips what the match that just ended had.
    //
    // ⚠️ **`ownedItems(...)` RATHER THAN `ownedItemSet(...)`, AND THE DIFFERENCE IS NOT
    // COSMETIC.** `loadEquipped` filters out any id the player does not own, so passing
    // the raw economy set here would silently drop every item granted by
    // `ITEM_TEST_GRANT_ALL` — Uri equips one of the ten, the match starts, and nothing
    // arrives. One ownership expression, exported from the screen that equips through it.
    //
    // ⚠️ **AND `loadEquipped` IS NOT THE ONLY GUARD.** It filters by OWNERSHIP (a product
    // rule); `match.ts:sanitiseLoadout` filters by what `state.ts:validateLoadout` will
    // ACCEPT (a safety rule), because that function THROWS a `RangeError` from inside
    // `createMatch` and a hand-edited `localStorage` blob must not be able to stop a match
    // starting from a screen with no error surface. The sim's throw is untouched.
    items: loadEquipped(ownedItems(ctx.profile.economy)),
    // The player's CHARACTER level (not the account level on the home bar). The opponent
    // mirrors it inside `GameSession` — see `enemyLevelFor`, which is where Uri's
    // "AI players adjust to the player's level" answer is expressed exactly once.
    playerLevel: ctx.profile.characterLevel(route.player),
    // ── 🚨 THE KNOCKED-OUT SEAT BANKS AT THE KNOCKOUT (META-02) — see `paidOut`. ──
    // Never fires at two seats (a knockout ends a duel on the same tick), so the duel's bank
    // at the whistle is untouched by construction. An unpayable outcome is left for the
    // whistle, whose fallback arm is the one path that can pay it.
    onLocalResult(outcome) {
      if (payable(outcome)) bankOnce(outcome, null);
    },
    onPhase(phase: MatchPhase, winner, outcome) {
      if (phase === 'ended') {
        // Banks here unless the knockout already did — then it only re-hands that payout to
        // the card. See `bankOnce`.
        bankOnce(outcome, winner);
        root.classList.add('is-ended');
      } else {
        banked = false;
        paidOut = null;
        root.classList.remove('is-ended');
      }
    },
  });

  const panePause = q<HTMLDivElement>('pane-pause');
  const paneConfirm = q<HTMLDivElement>('pane-confirm');
  const leaveBtn = q<HTMLButtonElement>('leave');

  /**
   * The chip's glyph is re-rendered on every toggle, so the SIZE has to be re-applied
   * with it or the icon silently shrinks back to its `1em` default the first time the
   * player pauses — a value set once in the template and lost on the first interaction
   * is invisible to every screenshot taken before that interaction.
   *
   * The label flips too. It read "Pause" in both states, so a screen reader announced
   * the resume control as Pause for the whole time the sheet was open.
   */
  const CHIP_ICON_PX = '22px';
  function setChip(paused: boolean): void {
    pauseBtn.innerHTML = icon(paused ? 'play' : 'pause', { size: CHIP_ICON_PX });
    pauseBtn.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  // ── 🚨 THE ONE DESTRUCTIVE ACT IN THE PRODUCT GETS A CONFIRM ────────────────
  //
  // Leaving a live match is not undoable and it is not free: the profile write is
  // guarded by `banked`, so a match abandoned by a fighter STILL STANDING banks
  // **nothing** — no trophies, no coins, no XP, no chest progress. That is correct (you did
  // not finish), and it is exactly why a mis-tap here costs the player the whole match.
  //
  // ⚠️ THIS PARAGRAPH SAID `banked` *"is only ever set from `onPhase(phase === 'ended')`"*,
  // and that was the defect for a KNOCKED-OUT player at three or more seats (META-02): their
  // place was already final, so Quit let a 5th or 6th skip the loss and made a 3rd forfeit
  // the win. `banked` is now also set at the knockout (`onLocalResult`) and on a Leave that
  // forfeits a pending Leftovers revive; `confirmBody` says which of the three applies.
  //
  // ⚠️ AND THE LIKELIEST MIS-TAP IS NOT THE ONE THE OLD LAYOUT DEFENDED AGAINST.
  // The header below argues at length about the *chip* being out of the thumb zone —
  // true, and it is why the chip needs no confirm: pausing is free and reversible.
  // But inside the sheet, BOTH quiet buttons abandon the match and the top one sits
  // one 10px gap under Resume, the button a player actually aims at. "Change Fighter"
  // is therefore the most probable accidental exit in the whole product, and it was
  // the one nobody had guarded. Both route through here.
  //
  // The safe option is the loud primary and it is FIRST; the destructive one repeats
  // the exact label of the button that opened it, because the clearest possible
  // statement of what is about to happen is the words the player just pressed.
  // ⚠️ THE REMAINING ACCIDENT IS A DOUBLE-TAP PUNCHING THROUGH THE CONFIRM AT THE SAME
  // COORDINATE, AND NO WORDING DEFENDS AGAINST IT. The first attempt was geometric —
  // place the destructive button clear of the rect that opened it — and MEASUREMENT
  // killed it: `tools/tmp/qx_quit.mjs` found Leave overlapping Quit by **6,623 px² at
  // 390x844 and 4,656 px² at 844x390**, because both panes are centred in the same card
  // and their button rows land on each other by arithmetic. Making them miss would mean
  // pinning row heights that are `clamp()`s of the viewport, i.e. a fix that holds at
  // the four sizes tested and rots at the fifth.
  //
  // So the guarantee is TEMPORAL and layout-independent: the destructive button is
  // inert for `LEAVE_ARM_MS` after the confirm appears. `.fa-btn[disabled]` already
  // dims in `theme.ts`, so it also reads as arriving rather than as broken, and a
  // disabled button refuses the keyboard as well as the finger. `qx_quit.mjs` §D
  // asserts both halves — a click inside the window does NOT leave, a click after it
  // does — and `--arm passthru` arms the button immediately and requires the row to go
  // red. 350 ms is under the ~500 ms floor for a deliberate second tap and well over
  // the ~120 ms one for an accidental one.
  const LEAVE_ARM_MS = 350;
  let armTimer = 0;
  let pendingExit: Route | null = null;

  /**
   * WHAT LEAVING COSTS, SAID TRUTHFULLY FOR EACH STATE A LIVE MATCH CAN BE IN.
   *
   * ⚠️ It was ONE sentence — *"This match ends now — no trophies, coins or XP from it."* —
   * which is true for a fighter still standing (`DECISIONS §19`: abandoning a live match pays
   * nothing) and became FALSE for a knocked-out one the moment META-02's early bank landed:
   * their place is already paid. It stays word for word for the standing fighter.
   */
  function confirmBody(): string {
    if (paidOut) return `You finished ${ordinal(paidOut.place + 1)} of ${paidOut.seats} — that is already banked.`;
    const ko = session.knockedOutOutcome();
    if (payable(ko)) {
      return `You are out in ${ordinal(ko.localPlace + 1)} of ${ko.seats}. Leaving banks that now and gives up your Leftovers revive.`;
    }
    return 'This match ends now — no trophies, coins or XP from it.';
  }

  function showConfirm(to: Route, label: string, glyph: string): void {
    pendingExit = to;
    leaveBtn.innerHTML = `${icon(glyph)} ${label}`;
    q<HTMLParagraphElement>('confirmbody').textContent = confirmBody();
    // A knocked-out player is not playing; the safe option says what it actually does.
    const out = paidOut !== null || session.knockedOutOutcome() !== null;
    q<HTMLButtonElement>('keep').innerHTML = `${icon('play')} ${out ? 'Keep Watching' : 'Keep Playing'}`;
    panePause.hidden = true;
    paneConfirm.hidden = false;
    leaveBtn.disabled = true;
    window.clearTimeout(armTimer);
    armTimer = window.setTimeout(() => { leaveBtn.disabled = false; }, LEAVE_ARM_MS);
  }

  function closeConfirm(): void {
    pendingExit = null;
    // Disarm on the way out as well as on the way in: a confirm cancelled inside the
    // window would otherwise leave a timer running that arms a button nobody is
    // looking at, and re-opening it would find it already live.
    window.clearTimeout(armTimer);
    leaveBtn.disabled = true;
    paneConfirm.hidden = true;
    panePause.hidden = false;
  }

  function setPaused(on: boolean): void {
    // Closing the sheet always drops any half-made decision: re-opening it must never
    // hand the player a confirm they no longer remember asking for.
    if (!on) closeConfirm();
    if (on) session.pause(); else session.resume();
    sheet.classList.toggle('is-open', on);
    setChip(on);
    // Back in the fight, the GAME owns the keyboard (F3): a control of this screen that kept
    // focus would be re-pressed by the next Space or Enter. Covers the keyboard player who
    // Tabbed to the chip; a mouse click never gives it focus at all (see the chip's mousedown).
    const focused = document.activeElement;
    if (!on && focused instanceof HTMLElement && root.contains(focused)) focused.blur();
  }

  /**
   * ── A MOUSE CLICK ON THE CHIP TAKES NO FOCUS (F3) ───────────────────────────
   *
   * 🚨 **SPACE AND ENTER RE-PRESSED IT.** Chromium focuses a `<button>` on mousedown and nothing
   * in a match moved focus away again, so after a click on the chip (sheet open) and Escape
   * (sheet closed), the next Space — unbound in the game — or Enter pressed the still-focused
   * chip and paused the match. Measured by `tools/tmp/b2_input.mjs` §F3 on `8586f00`: chip
   * clicks 1 -> 2 and the sheet open again, for both keys.
   *
   * `preventDefault` on MOUSEDOWN is the narrow cure: it stops the focus a pointer would give
   * and nothing else — the click still fires, and a keyboard player can still Tab here and
   * toggle with Enter (a `blur()` in the click handler, the first idea, took that away). The
   * same rule is on `pointerLock.ts`'s chips and buttons.
   */
  pauseBtn.addEventListener('mousedown', (ev) => ev.preventDefault());

  /**
   * ── THE CHIP AND ESCAPE TOGGLE THE SHEET, NOT THE SESSION (F6) ──────────────
   *
   * 🚨 **WITH MOUSE CAPTURE ON, THE PAUSE SHEET WAS UNREACHABLE.** Both used to toggle on
   * `!session.paused`. But Escape under capture releases the lock and `pointerLock.ts` pauses
   * the SESSION itself, under its own "Paused / Click to resume" scrim — so `session.paused`
   * was true while this sheet was closed, and the chip labelled "Pause" called
   * `setPaused(false)`: it RESUMED the match and re-captured the mouse. Change Fighter and
   * Quit could not be reached at all while captured. Measured by `tools/tmp/b2_input.mjs` §F6
   * on `8586f00` (`?pointerLock=sim`): capture, Escape, the chip -> sheet closed, mouse
   * re-captured; and Escape ON the scrim did the same without a click.
   *
   * The sheet's own open state is what both controls are FOR, so it is what they read. The
   * session can be paused by two owners (this sheet and the capture scrim); only this one is
   * the player's menu. Escape on the scrim now opens the sheet instead of asking for a re-lock
   * that a real browser refuses anyway (Escape grants no activation — `pointerLock.ts` rule 2).
   */
  const sheetIsOpen = (): boolean => sheet.classList.contains('is-open');
  pauseBtn.addEventListener('click', () => setPaused(!sheetIsOpen()));
  q<HTMLButtonElement>('resume').addEventListener('click', () => setPaused(false));
  // ── 🚨 "CHANGE FIGHTER" FROM A SEATED MATCH GOES BACK THROUGH THE LOBBY (META-03) ──
  //
  // It navigated to the plain roster, whose Fight! starts a duel, so a six-player match came
  // back from the pause sheet as a 1v1: sim 6 -> Change Fighter -> Fight! -> sim 2
  // (`tools/tmp/b6_screens.mjs` §M3 B on `f65af2c`). Written on 2026-08-04 (`da22f58`), when
  // every match was a duel and that was the same thing; it became wrong when the lobby made
  // six seats reachable. A match WITH `seats` came from the lobby (or a `?seats=` QA URL), so
  // the roster opens as the lobby's picker and hands the player back to it — and on Leave the
  // lobby is told this match's count, so it comes back at the count being left whichever way
  // the match was started. A duel (`seats` absent) keeps today's path exactly.
  const changeRoute: Route = roster
    ? { name: 'characters', returnTo: 'lobby' }
    : { name: 'characters' };
  q<HTMLButtonElement>('change').addEventListener('click',
    () => showConfirm(changeRoute, 'Change Fighter', 'swap'));
  q<HTMLButtonElement>('quit').addEventListener('click',
    () => showConfirm({ name: 'home' }, 'Quit to Home', 'home'));
  q<HTMLButtonElement>('keep').addEventListener('click', () => setPaused(false));
  leaveBtn.addEventListener('click', () => {
    if (!pendingExit) return;
    // ⚠️ THE ONE KNOCKED-OUT STATE THE EARLY BANK WAITS OUT — a Leftovers revive still pending
    // (see `GameSession.notifyLocalResult`). Leaving forfeits that revive, so the place held
    // right now IS this player's final place, and banking it here is what stops "leave while
    // the revive is pending" from re-opening the loss-skip META-02 closed. A standing fighter
    // gets `null` and banks nothing, exactly as before (`DECISIONS §19`). Through `bankOnce`,
    // so a seat the knockout already banked is not banked twice.
    const ko = session.knockedOutOutcome();
    if (payable(ko)) bankOnce(ko, null);
    if (roster && pendingExit === changeRoute) rememberSeatCount(roster.length);
    ctx.navigate(pendingExit);
  });
  exitBtn.addEventListener('click', () => ctx.navigate({ name: 'home' }));

  // Escape toggles pause — desktop players reach for it before they look for a chip.
  // ⚠️ It backs out of the confirm FIRST. Escape is the universal "undo that", and a
  // binding that jumped straight from an open confirm back into the match would leave
  // the player unable to cancel with the key they cancel everything else with.
  //
  // 🚨 BUT NOT ONCE THE MATCH IS DECIDED (META-06 / ML-6). It toggled pause in every phase,
  // so Escape on the result card opened "Paused / Resume / Change Fighter / Quit", and Quit's
  // confirm told the player the match paid "no trophies, coins or XP" directly above the card
  // showing what it had just paid — and with mouse capture on, Resume re-captured the pointer
  // over a card whose buttons need a free cursor. The pause CHIP already hides on
  // `.is-ended` because *"once it IS decided, pause means nothing"*; the key now reads the
  // SAME signal, so pointer and keyboard agree. Nothing is mapped in its place: the whistle
  // itself releases the mouse, so a reflexive Escape there must not throw the player off a
  // card they have not read yet.
  //
  // ── 🚨 AND BROWSER / ANDROID BACK IS THE SAME ACTION (ML-4, `DECISIONS §31`) ──
  // Uri's answer to §19 was *"Pause menu is fine"*, recorded in §31 as settled — yet Back
  // still tore a live match down with no sheet and no confirm (measured on `f65af2c`,
  // `tools/tmp/b6_screens.mjs` §ML4: Back mid-match landed on the previous screen, the
  // session gone). `backOut` is the ONE body both bindings run, so the key a desktop player
  // cancels with and the button a phone player cancels with cannot drift apart: with the
  // match live it backs out of an open confirm first, otherwise toggles the sheet; once the
  // match is DECIDED it returns false and lets the key — or the Back — through, so Back on
  // the result card still leaves, exactly as before. The shell asks via `Screen.onBack`.
  function backOut(): boolean {
    if (root.classList.contains('is-ended')) return false;
    if (pendingExit !== null) { closeConfirm(); return true; }
    // The sheet, not the session — see `sheetIsOpen` (F6).
    setPaused(!sheetIsOpen());
    return true;
  }
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== PAUSE_KEY) return;
    if (backOut()) ev.preventDefault();
  };
  window.addEventListener('keydown', onKey);

  // The matchup, for a hover tooltip. Derived from `roster` when there is one rather than
  // from `route.player`/`route.enemy`, which at six seats would name two of six and read as
  // a duel — the same "a two-fighter string describing an N-fighter match" shape that paid a
  // six-player match as a 1v1 loss two screens down.
  exitBtn.title = roster
    ? roster.map((id) => CHARACTERS[id].name).join(' · ')
    : `${CHARACTERS[route.player].name} vs ${CHARACTERS[route.enemy].name}`;

  return {
    root,
    resize() { session.resize(); },
    onBack: backOut,
    dispose() {
      window.removeEventListener('keydown', onKey);
      // The arming timer outlives the screen otherwise. It only touches a detached
      // node, so nothing visible breaks — which is exactly why it would never be
      // noticed, and `shell.ts` tears screens down on every navigation.
      window.clearTimeout(armTimer);
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
   player reaches for while already frustrated.

   ── Out of the left thumb zone, in EVERY input state ────────────────────────
   See the header. 96px clears the player nameplate (topbar top 14 + name pill ~30 +
   gap 5 + health bar 26 = ~75) and the chip's own 44px ends around 140 — comfortably
   above the arc a thumb sweeps from the bottom edge, and it is the same offset
   'hud.ts' uses to lift the radar off the opposite corner, so the two chrome elements
   sit on one line across the frame instead of at two arbitrary heights.

   There is deliberately no 'html.fa-touch-capable' variant of this rule any more. A
   control that changes corner on a capability bit is a control the player has to
   re-find, and the hybrid case (touchscreen laptop driven by a mouse) got the touch
   layout anyway. One position, asserted by 'tools/tmp/chip_probe.mjs' in both DOM
   states at six viewports. */
.fa-match .match-chip {
  position: absolute;
  inset-inline-start: calc(var(--fa-safe-l, 0px) + 14px);
  top: calc(var(--fa-safe-t, 0px) + 96px);
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
  background: rgba(26,18,36,0.88);
  border: 3px solid #1a1224;
  border-radius: 14px;
  /* ── 🚨 THE PLATE WAS INVISIBLE, AND THAT IS THE WHOLE REASON THIS GAME READ AS
     HAVING NO WAY OUT ──────────────────────────────────────────────────────────
     Measured on a served snapshot at 390x844, six seats, mid-match: the chip's fill
     against the ring of pixels immediately outside it came to **1.026:1**. One is
     "identical". The chip copied '.hud-clock''s plate — rgba(26,18,36,0.78) on a
     #1a1224 border — which works for the clock because the clock is mostly big cream
     numerals, and does not work for a 44px square whose entire ink is two 4px bars.
     In portrait that square sits in the letterbox band, which is very nearly the same
     colour as the plate, so the player saw two floating tick marks and no button.
     'src/ui/icons/index.ts''s header already records that this project has shipped the
     dark-on-dark bug three separate times; this is the fourth, and it is the one that
     hid the only exit.

     The fix is a TWO-TONE edge, not a lighter fill, and the reason is that the chip is
     over the arena in landscape and over the letterbox in portrait. A lighter fill
     that clears 3:1 against the letterbox measures 1.37:1 against the arena's pink
     floor — it fixes one orientation and fails the other. Cream outside / ink inside
     always has a >=3:1 step somewhere across the boundary whatever is behind it: cream
     against the letterbox is 17.0:1, cream against the brightest floor pink is 3.45:1,
     and where the backdrop is itself cream the inner ink border carries it at 17:1.
     The floor is WCAG 2.1 SC 1.4.11 (non-text contrast, 3:1) — a published external
     number, not one invented here. 'tools/tmp/qx_quit.mjs' §C measures it. */
  box-shadow: 0 0 0 2px rgba(255,243,222,0.92), 0 5px 0 rgba(0,0,0,0.35);
  transition: transform 0.08s, box-shadow 0.08s, background 0.12s;
}
.fa-match .match-chip:hover { background: rgba(58,40,80,0.9); }
.fa-match .match-chip:active {
  transform: translateY(3px);
  /* The ring survives the press — it is the control's boundary, not its decoration. */
  box-shadow: 0 0 0 2px rgba(255,243,222,0.92), 0 0 0 rgba(0,0,0,0.35);
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
/* ONE "Paused" card, not two (F6). With mouse capture on, the sheet now opens OVER the capture
   scrim ('pointerLock.ts', a layer below '#screens'), which stays in its 'lost' state — two
   0.62 backdrops, a 2px blur, and the scrim card's edges either side of this one. Hidden
   only while the sheet is open: if Resume's re-capture is then refused (Chrome rate-limits
   a re-lock for ~1s after an Esc), the scrim is still 'lost' and comes back by itself. */
body:has(.fa-match .match-sheet.is-open) .plk-scrim { display: none; }
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

/* ⚠️ '[hidden]' IS A UA 'display: none' AND A CLASS RULE OUTRANKS IT. Declaring
   'display: flex' on '.match-sheet-pane' without the line below leaves the hidden pane
   fully laid out and clickable — both panes stacked, and the Leave button live before
   anyone has asked for a confirm. Same shape as every other "it isn't there / it IS
   there and invisible" defect in this repo, inverted. */
.fa-match .match-sheet-pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fa-match .match-sheet-pane[hidden] { display: none; }

.fa-match .match-sheet-body {
  margin: 0 0 2px;
  max-width: min(340px, 70vw);
  text-align: center;
  font-family: 'Rubik', sans-serif;
  font-weight: 500;
  font-size: clamp(0.72rem, 1.7vh, 0.92rem);
  line-height: 1.35;
  color: rgba(255,243,222,0.82);
}

/* The destructive half of the confirm, and the ONLY control in the product that ends
   something the player cannot get back. Tinted rather than restyled: it keeps the
   'fa-btn--quiet' material so it still reads as the same family of button, and the
   ketchup wash plus a smaller footprint say "this is the other one" without inventing
   a variant in 'theme.ts', which this file does not own. */
.fa-match .match-leave {
  align-self: center;
  min-width: 62%;
  background: linear-gradient(180deg, #FFE2DA 0%, #F4B7A6 100%);
  box-shadow: 0 4px 0 rgba(120,40,20,0.45);
  /* The 350ms arming window (see LEAVE_ARM_MS) rides the theme's [disabled] opacity.
     Fading it in makes the wait read as the button ARRIVING rather than as a dead
     control, which is the difference between a safety and a bug report. */
  transition: transform 0.08s, box-shadow 0.08s, filter 0.12s, opacity 0.25s ease-out;
}
.fa-match .match-leave:active { box-shadow: 0 0 0 rgba(120,40,20,0.45); }
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
